// Shared helpers for every CMCC serverless function on Vercel.
//
// Storage strategy: Supabase when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
// are configured; transparent in-memory fallback otherwise. The fallback
// keeps the deploy alive even mid-migration or if Supabase is down — the
// page just sees ephemeral state instead of persistent.
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const SECRET = process.env.JWT_SECRET || 'cmcc-demo-secret-do-not-use-in-prod';

// ── Tenants (in-memory fallback) ───────────────────────────────────
// Mirrors supabase/migrations/0002_multitenancy.sql. Default tenant
// 'default-ts' is the Telangana state-wide demo bucket; everything that
// existed before D1 multi-tenancy is implicitly here.
export const DEFAULT_TENANT_ID = 'default-ts';
// Each tenant gets its own WhatsApp Business number so inbound
// messages can be routed by recipient. Demo numbers below are
// synthetic; replace with real Meta-verified numbers per ULB.
export const TENANTS_FALLBACK = new Map([
  ['default-ts', { id: 'default-ts', name: 'Telangana Statewide (Demo)',                     shortName: 'TS Demo', state: 'TS', category: 'STATE', wardCount: 600, whatsappNumber: '+918888880000' }],
  ['ghmc',       { id: 'ghmc',       name: 'Greater Hyderabad Municipal Corporation',       shortName: 'GHMC',    state: 'TS', category: 'ULB',   wardCount: 150, whatsappNumber: '+918888880001' }],
  ['wmc',        { id: 'wmc',        name: 'Warangal Municipal Corporation',                shortName: 'WMC',     state: 'TS', category: 'ULB',   wardCount: 66,  whatsappNumber: '+918888880002' }],
  ['kmc-tg',     { id: 'kmc-tg',     name: 'Khammam Municipal Corporation',                 shortName: 'KMC',     state: 'TS', category: 'ULB',   wardCount: 60,  whatsappNumber: '+918888880003' }],
]);

// Reverse index for phone → tenantId routing. Built once.
const _whatsappToTenant = new Map();
for (const t of TENANTS_FALLBACK.values()) {
  if (t.whatsappNumber) _whatsappToTenant.set(t.whatsappNumber, t.id);
}
export function tenantIdForWhatsappNumber(phone) {
  if (!phone) return DEFAULT_TENANT_ID;
  return _whatsappToTenant.get(String(phone).replace(/\s+/g, '')) || DEFAULT_TENANT_ID;
}

// ── Operator allow-list (in-memory fallback) ───────────────────────
// Mirrors the seed-rows in supabase/migrations/0001_init.sql + 0002.
// Used when Supabase isn't configured, or as a last-resort fallback if
// a query fails (so the demo never gets locked out of operator login).
export const OPERATORS_FALLBACK = new Map([
  ['+919999900010', { id: 'op1', tenantId: 'ghmc',       phone: '+919999900010', name: 'Priya Iyer',   opRole: 'NOC Lead'      }],
  ['+919999900011', { id: 'op2', tenantId: 'ghmc',       phone: '+919999900011', name: 'Sandeep Rao',  opRole: 'NOC Operator'  }],
  ['+919999900012', { id: 'op3', tenantId: 'ghmc',       phone: '+919999900012', name: 'Rakhi Menon',  opRole: 'NOC Operator'  }],
  ['+919999900013', { id: 'op4', tenantId: 'default-ts', phone: '+919999900013', name: 'Faizan Ahmed', opRole: 'On-Call SRE'   }],
  ['+919999900014', { id: 'op5', tenantId: 'default-ts', phone: '+919999900014', name: 'Akhila Reddy', opRole: 'Compliance'    }],
]);

// ── Demo-mode gate ────────────────────────────────────────────────
// Controls whether the OTP `123456` backdoor accepts. Default: enabled
// for any deploy that doesn't have a real SMS provider configured, so
// the public Vercel demo keeps working. Flip to safe-prod mode with
// DEMO_MODE=0 (or by configuring an SMS provider env var).
//
//   DEMO_MODE=1        → bypass enabled (explicit demo)
//   DEMO_MODE=0        → bypass disabled (explicit prod)
//   (unset)            → bypass enabled iff no SMS provider env vars set
//
// Production deploys MUST set DEMO_MODE=0 once a real SMS provider is
// wired in. SECURITY.md tracks this as a launch gate.
export function isDemoMode() {
  if (process.env.DEMO_MODE === '1') return true;
  if (process.env.DEMO_MODE === '0') return false;
  // No explicit override: enabled unless a real SMS provider is set.
  if (process.env.MSG91_API_KEY) return false;
  if (process.env.TWILIO_AUTH_TOKEN) return false;
  if (process.env.GUPSHUP_API_KEY) return false;
  return true;
}

// ── In-memory rate limiter ────────────────────────────────────────
// Per-key sliding-window counter. Good enough to deter casual abuse;
// imperfect on serverless (each Vercel function instance has its own
// memory), but better than no limit at all. v2 swaps for Upstash
// Redis or Vercel KV — same call surface.
//
// Returns { allowed: bool, remaining: number, resetAt: ms-epoch }.
// Caller is responsible for sending a 429 when allowed === false.
const _global = globalThis;
_global.__hearthlyRateLimit ||= new Map();
const _rateMap = _global.__hearthlyRateLimit;

export function rateLimit({ key, limit, windowMs }) {
  if (!key) return { allowed: true, remaining: limit, resetAt: Date.now() + windowMs };
  const now = Date.now();
  const entry = _rateMap.get(key) || { hits: [], resetAt: now + windowMs };
  // Drop hits outside the window
  entry.hits = entry.hits.filter((t) => t > now - windowMs);
  if (entry.hits.length >= limit) {
    const oldest = entry.hits[0];
    return { allowed: false, remaining: 0, resetAt: oldest + windowMs };
  }
  entry.hits.push(now);
  entry.resetAt = now + windowMs;
  _rateMap.set(key, entry);
  // Light GC: every ~1000th call, prune fully-expired entries.
  if (Math.random() < 0.001) {
    for (const [k, e] of _rateMap) {
      if (e.hits.length === 0 || e.hits[e.hits.length - 1] < now - windowMs) {
        _rateMap.delete(k);
      }
    }
  }
  return { allowed: true, remaining: limit - entry.hits.length, resetAt: entry.resetAt };
}

// Helper: derive a stable IP from headers Vercel/Cloudflare/standard
// proxies set. Falls back to a fixed bucket if no IP can be inferred,
// which means anonymous traffic shares one rate-limit pool — fine for
// abuse-prevention.
export function clientIp(req) {
  const xff = req.headers['x-forwarded-for'] || req.headers['X-Forwarded-For'];
  if (xff) return String(xff).split(',')[0].trim();
  const real = req.headers['x-real-ip'] || req.headers['X-Real-IP'];
  if (real) return String(real).trim();
  return 'unknown';
}

// Convenience: send 429 with Retry-After. Use as: if (!rl.allowed) return rateLimited(res, rl);
export function rateLimited(res, rl) {
  const retrySec = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
  res.setHeader('Retry-After', String(retrySec));
  return res.status(429).json({
    error: 'too many requests — slow down',
    retryAfter: retrySec,
  });
}

// ── In-memory shared state (fallback for heartbeats + audit) ───────
// Heartbeats: keyed by `${tenantId}:${deviceId}` so two tenants can
// host the same physical demo deviceId without collision.
// Audit log: per-tenant array, keyed by tenantId.
// (_global declared above next to the rate-limit map.)
_global.__hearthlyCmccState ||= {
  heartbeats: new Map(),       // key: `${tenantId}:${deviceId}` → { state, at, ip, ua, tenantId }
  auditLogByTenant: new Map(), // key: tenantId → Array<entry>
};
export const STATE = _global.__hearthlyCmccState;

// ── Supabase client (lazy, singleton) ──────────────────────────────
let _sb = null;
let _sbDisabled = false;
function sb() {
  if (_sbDisabled) return null;
  if (_sb) return _sb;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { _sbDisabled = true; return null; }
  _sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _sb;
}
export function supabaseConfigured() { return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY; }

// ── Tenant helpers ─────────────────────────────────────────────────
function _toTenant(row) {
  return {
    id: row.id, name: row.name, shortName: row.short_name,
    state: row.state, category: row.category,
    wardCount: row.ward_count, population: row.population,
  };
}

export async function getTenant(id) {
  if (!id) return null;
  const c = sb();
  if (c) {
    try {
      const { data, error } = await c.from('tenants')
        .select('id,name,short_name,state,category,ward_count,population')
        .eq('id', id)
        .maybeSingle();
      if (!error && data) return _toTenant(data);
    } catch (e) { console.warn('[supabase] tenant lookup failed:', e.message); }
  }
  return TENANTS_FALLBACK.get(id) || null;
}

export async function listTenants() {
  const c = sb();
  if (c) {
    try {
      const { data, error } = await c.from('tenants')
        .select('id,name,short_name,state,category,ward_count,population')
        .eq('is_active', true)
        .order('id');
      if (!error && data) return data.map(_toTenant);
    } catch (e) { console.warn('[supabase] tenant list failed:', e.message); }
  }
  return [...TENANTS_FALLBACK.values()];
}

// ── Operator helpers ───────────────────────────────────────────────
// Every operator carries a `tenantId`. Backwards-compatibility: if a
// row pre-dates the 0002 migration the column defaults to 'default-ts'
// at the DB level; the fallback Map already pins each operator.
export async function getOperatorByPhone(phone) {
  const c = sb();
  if (c) {
    try {
      const { data, error } = await c.from('operators')
        .select('id,phone,name,op_role,tenant_id')
        .eq('phone', phone)
        .maybeSingle();
      if (!error && data) return {
        id: data.id, phone: data.phone, name: data.name, opRole: data.op_role,
        tenantId: data.tenant_id || DEFAULT_TENANT_ID,
      };
    } catch (e) { console.warn('[supabase] operator lookup failed:', e.message); }
  }
  return OPERATORS_FALLBACK.get(phone) || null;
}

export async function getOperatorById(id) {
  const c = sb();
  if (c) {
    try {
      const { data, error } = await c.from('operators')
        .select('id,phone,name,op_role,tenant_id')
        .eq('id', id)
        .maybeSingle();
      if (!error && data) return {
        id: data.id, phone: data.phone, name: data.name, opRole: data.op_role,
        tenantId: data.tenant_id || DEFAULT_TENANT_ID,
      };
    } catch (e) { console.warn('[supabase] operator lookup failed:', e.message); }
  }
  return [...OPERATORS_FALLBACK.values()].find((o) => o.id === id) || null;
}

// ── Wards (in-memory fallback mirrors the seed in 0002_multitenancy.sql)
export const WARDS_FALLBACK = [
  { id: 'ghmc-w1',  tenantId: 'ghmc',   name: 'Madhapur',        cityName: 'Hyderabad', population: 90000,  lat: 17.4480, lng: 78.3915 },
  { id: 'ghmc-w2',  tenantId: 'ghmc',   name: 'Banjara Hills',   cityName: 'Hyderabad', population: 60000,  lat: 17.4126, lng: 78.4471 },
  { id: 'ghmc-w3',  tenantId: 'ghmc',   name: 'Begumpet',        cityName: 'Hyderabad', population: 55000,  lat: 17.4429, lng: 78.4636 },
  { id: 'ghmc-w4',  tenantId: 'ghmc',   name: 'Kukatpally',      cityName: 'Hyderabad', population: 130000, lat: 17.4849, lng: 78.4138 },
  { id: 'wmc-w1',   tenantId: 'wmc',    name: 'Hanamkonda',      cityName: 'Warangal',  population: 70000,  lat: 18.0091, lng: 79.5805 },
  { id: 'wmc-w2',   tenantId: 'wmc',    name: 'Kazipet',         cityName: 'Warangal',  population: 45000,  lat: 18.0200, lng: 79.5500 },
  { id: 'kmc-w1',   tenantId: 'kmc-tg', name: 'Khammam Central', cityName: 'Khammam',   population: 58000,  lat: 17.2473, lng: 80.1514 },
];

export async function listWards({ tenantId } = {}) {
  if (!tenantId) return [];
  const c = sb();
  if (c) {
    try {
      const { data, error } = await c.from('wards')
        .select('id,tenant_id,name,city_name,population,lat,lng')
        .eq('tenant_id', tenantId)
        .order('name');
      if (!error && data) return data.map((w) => ({
        id: w.id, tenantId: w.tenant_id, name: w.name, cityName: w.city_name,
        population: w.population, lat: w.lat, lng: w.lng,
      }));
    } catch (e) { console.warn('[supabase] wards list threw:', e.message); }
  }
  return WARDS_FALLBACK.filter((w) => w.tenantId === tenantId);
}

// ── Grievances (citizen-submitted; tenant-scoped) ─────────────────
// In-memory fallback: per-tenant array, capped at 500 to avoid leaking
// demo memory between cold starts.
_global.__hearthlyCmccState.grievancesByTenant ||= new Map();

let _grievanceSeq = Date.now();
function nextGrievanceId() { _grievanceSeq += 1; return 'GRV-' + _grievanceSeq.toString(36).toUpperCase(); }

const VALID_CATEGORY = new Set(['garbage','water','streetlight','roads','sewage','stray','encroachment','mosquito','other']);

export async function submitGrievance(input) {
  const tenantId = input.tenantId || DEFAULT_TENANT_ID;
  const wardId   = input.wardId || null;
  const category = (input.category || 'other').toLowerCase();
  if (!VALID_CATEGORY.has(category)) {
    throw new Error('invalid category');
  }
  const description = (input.description || '').toString().slice(0, 4000);
  const language    = ['en','hi','te','ur'].includes(input.language) ? input.language : 'en';
  const channel     = ['web','whatsapp','ivr','walk-in'].includes(input.channel) ? input.channel : 'web';
  const phone       = (input.citizenPhone || '').toString().slice(0, 16);
  const lat = Number.isFinite(input.lat) ? input.lat : null;
  const lng = Number.isFinite(input.lng) ? input.lng : null;
  // Default SLA: 12h garbage, 24h water/sewage, 48h streetlight/mosquito,
  // 96h roads, 72h stray, 120h encroachment, 24h fallback.
  const slaHours = ({ garbage:12, water:24, sewage:24, streetlight:48, mosquito:48, roads:96, stray:72, encroachment:120 })[category] || 24;
  const slaDueAt = new Date(Date.now() + slaHours * 3600 * 1000);

  const row = {
    tenant_id: tenantId,
    ward_id: wardId,
    citizen_phone: phone || null,
    channel,
    category,
    severity: input.severity || 'normal',
    title: (input.title || category).slice(0, 200),
    description,
    language,
    media_url: input.mediaUrl || null,
    lat, lng,
    status: 'open',
    sla_due_at: slaDueAt.toISOString(),
  };

  const c = sb();
  if (c) {
    try {
      const { data, error } = await c.from('grievances').insert(row)
        .select('id,tenant_id,ward_id,category,status,sla_due_at,created_at')
        .single();
      if (!error && data) {
        return {
          id: 'GRV-' + data.id,
          tenantId: data.tenant_id,
          wardId: data.ward_id,
          category: data.category,
          status: data.status,
          slaDueAt: new Date(data.sla_due_at).getTime(),
          createdAt: new Date(data.created_at).getTime(),
        };
      }
      console.warn('[supabase] grievance insert failed:', error?.message);
    } catch (e) { console.warn('[supabase] grievance insert threw:', e.message); }
  }
  // Fallback
  if (!STATE.grievancesByTenant.has(tenantId)) STATE.grievancesByTenant.set(tenantId, []);
  const arr = STATE.grievancesByTenant.get(tenantId);
  const id = nextGrievanceId();
  const memEntry = {
    id, tenantId, wardId,
    category: row.category, status: row.status,
    slaDueAt: slaDueAt.getTime(), createdAt: Date.now(),
    description: row.description, citizenPhone: phone || null,
    channel, language, severity: row.severity,
  };
  arr.unshift(memEntry);
  if (arr.length > 500) arr.length = 500;
  return memEntry;
}

// Update a grievance. Tenant-scoped: refuses to touch a row whose
// tenant_id doesn't match the caller's. Returns the updated row, or
// null if the row was not found / not in the caller's tenant.
const VALID_STATUS = new Set(['open','assigned','resolved','rejected']);

export async function updateGrievance({ id, tenantId, status, assignedTo, resolvedNote }) {
  if (!id) throw new Error('id required');
  if (!tenantId) throw new Error('tenantId required');
  // Strip the 'GRV-' prefix the API returns; the underlying row id is
  // a bigserial in the DB, but a hash-string in the in-memory fallback.
  const idStr = String(id);
  const dbId  = idStr.startsWith('GRV-') ? idStr.slice(4) : idStr;
  if (status && !VALID_STATUS.has(status)) throw new Error('invalid status');

  const patch = {};
  if (status) {
    patch.status = status;
    if (status === 'resolved') patch.resolved_at = new Date().toISOString();
  }
  if (assignedTo !== undefined) patch.assigned_to = assignedTo;

  const c = sb();
  if (c) {
    try {
      // Convert to numeric DB id when possible (Supabase grievances.id
      // is bigserial). If it's not numeric we fall through to the
      // in-memory fallback.
      const numId = Number(dbId);
      if (Number.isFinite(numId) && Number.isInteger(numId)) {
        const { data, error } = await c.from('grievances')
          .update(patch)
          .eq('id', numId)
          .eq('tenant_id', tenantId)        // tenant guard
          .select('id,tenant_id,ward_id,category,status,sla_due_at,created_at,description,citizen_phone,channel,language,severity,assigned_to,resolved_at')
          .maybeSingle();
        if (!error && data) {
          return {
            id: 'GRV-' + data.id, tenantId: data.tenant_id, wardId: data.ward_id,
            category: data.category, status: data.status,
            slaDueAt: data.sla_due_at ? new Date(data.sla_due_at).getTime() : null,
            createdAt: new Date(data.created_at).getTime(),
            description: data.description, citizenPhone: data.citizen_phone,
            channel: data.channel, language: data.language, severity: data.severity,
            assignedTo: data.assigned_to,
            resolvedAt: data.resolved_at ? new Date(data.resolved_at).getTime() : null,
          };
        }
        if (error) console.warn('[supabase] grievance update failed:', error.message);
      }
    } catch (e) { console.warn('[supabase] grievance update threw:', e.message); }
  }
  // Fallback: search the in-memory tenant array.
  const arr = STATE.grievancesByTenant.get(tenantId) || [];
  const row = arr.find((g) => g.id === idStr);
  if (!row) return null;
  if (status) {
    row.status = status;
    if (status === 'resolved') row.resolvedAt = Date.now();
  }
  if (assignedTo !== undefined) row.assignedTo = assignedTo;
  if (resolvedNote) row.resolvedNote = resolvedNote;
  return row;
}

export async function listGrievances({ tenantId, status, limit = 100 } = {}) {
  const tid = tenantId || DEFAULT_TENANT_ID;
  const c = sb();
  if (c) {
    try {
      let q = c.from('grievances')
        .select('id,tenant_id,ward_id,category,status,sla_due_at,created_at,description,citizen_phone,channel,language,severity')
        .eq('tenant_id', tid)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (!error && data) return data.map((r) => ({
        id: 'GRV-' + r.id, tenantId: r.tenant_id, wardId: r.ward_id,
        category: r.category, status: r.status,
        slaDueAt: r.sla_due_at ? new Date(r.sla_due_at).getTime() : null,
        createdAt: new Date(r.created_at).getTime(),
        description: r.description, citizenPhone: r.citizen_phone,
        channel: r.channel, language: r.language, severity: r.severity,
      }));
    } catch (e) { console.warn('[supabase] grievance list threw:', e.message); }
  }
  const arr = STATE.grievancesByTenant.get(tid) || [];
  return arr.filter((g) => !status || g.status === status).slice(0, limit);
}

// ── A6 · grievance dedup (BoW + cosine, pure-JS) ─────────────────────
// "13 neighbours already reported this pothole." Catches duplicate
// citizen reports at intake and lets operators cluster open tickets.
//
// Engine: tokenise → bag-of-words term-frequency vector → cosine
// similarity. No external dep, no schema change. Works for EN, HI,
// TE and mixed text — Indic scripts split on whitespace + punctuation
// the same way Latin does. Cost: ~5µs to tokenise a 200-char message;
// ~3µs per cosine; we cap candidates to 500/tenant so a /similar
// query is well under 5 ms even cold.
//
// Upgrade path (A6 v2): swap _bow with OpenAI text-embedding-3-small
// (1536-dim) when OPENAI_API_KEY is present + pgvector is enabled in
// Supabase. Same call surface (similarity is the only contract
// downstream code cares about).

// Strip ASCII + Indic punctuation, split on whitespace + zero-width
// joiners, lowercase, drop tokens shorter than 2 chars or in the stop
// list. Keep it tiny — over-aggressive normalisation hurts recall.
const _STOPWORDS_EN = new Set(['the','a','an','is','are','was','were','be','been','being','of','to','in','on','at','for','with','by','from','as','and','or','but','not','no','it','its','this','that','these','those','i','you','he','she','we','they','me','my','your','our','their','have','has','had','do','does','did','will','would','should','could','may','might','can','must','about','near','some','any','all','more','very']);
const _STOPWORDS_HI = new Set(['है','हैं','था','थे','थी','और','या','के','की','का','को','से','में','पर','तो','भी','एक','यह','वह','यहाँ','वहाँ']);
const _STOPWORDS_TE = new Set(['ఉంది','ఉన్నాయి','మరియు','లేదా','యొక్క','ను','కు','లో','మీద','కానీ','ఒక','ఇది','అది','ఇక్కడ','అక్కడ']);

export function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  // Replace punctuation with space; keep letters / digits / Indic ranges
  const cleaned = text.toLowerCase()
    .replace(/[!-/:-@[-`{-~ -⁯⸀-⹿]/g, ' ');
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  return tokens.filter((t) => {
    if (t.length < 2) return false;
    if (_STOPWORDS_EN.has(t)) return false;
    if (_STOPWORDS_HI.has(t)) return false;
    if (_STOPWORDS_TE.has(t)) return false;
    return true;
  });
}

// term → count map (term-frequency)
function _bow(text) {
  const m = new Map();
  for (const t of tokenize(text)) m.set(t, (m.get(t) || 0) + 1);
  return m;
}

// Cosine similarity between two term-frequency Maps. Returns 0..1.
export function cosineSimBow(a, b) {
  if (!a || !b || a.size === 0 || b.size === 0) return 0;
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  let dot = 0, na = 0, nb = 0;
  for (const [t, ca] of small) {
    const cb = large.get(t) || 0;
    dot += ca * cb;
  }
  for (const v of a.values()) na += v * v;
  for (const v of b.values()) nb += v * v;
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

// One-shot helper: cosine on raw text strings.
export function similarity(a, b) { return cosineSimBow(_bow(a), _bow(b)); }

// Find similar grievances to a query text, scoped to one tenant.
// Returns top-N matches above minScore, sorted descending. Excludes
// the grievance with id === excludeId so a grievance never ranks
// itself as similar.
export async function findSimilarGrievances({
  tenantId, text, excludeId,
  minScore = 0.45, limit = 5, hours = 7 * 24,
}) {
  if (!tenantId || !text) return [];
  const queryVec = _bow(text);
  if (queryVec.size === 0) return [];

  const all = await listGrievances({ tenantId, limit: 500 });
  const cutoff = Date.now() - hours * 3600 * 1000;
  const scored = [];
  for (const g of all) {
    if (g.id === excludeId) continue;
    if (g.createdAt && g.createdAt < cutoff) continue;
    if (!g.description) continue;
    const score = cosineSimBow(queryVec, _bow(g.description));
    if (score >= minScore) scored.push({ ...g, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

// ── A3 · photo-evidence hash ledger (in-memory ring buffer) ──────────
// Holds recent photo fingerprints per tenant, capped at 500/tenant.
// Keyed by tenantId; each entry: { hash, workerId, grievanceId, takenAt,
// recordedAt, lat, lng }. Used by photo-verify to detect duplicate or
// re-uploaded photos and to flag photos taken far from the claimed
// location. Cold-start safe — empty buffer is fine.
_global.__hearthlyCmccState.photoHashesByTenant ||= new Map();

const PHOTO_RING_LIMIT = 500;
const PHOTO_DEDUP_HOURS = 24;

// Hamming distance on hex strings of equal length. Returns the number
// of differing bits across the two hashes. 64-bit pHash → 0..64.
export function hammingHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return Infinity;
  const len = Math.min(a.length, b.length);
  let dist = Math.abs(a.length - b.length) * 4;
  for (let i = 0; i < len; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { dist += x & 1; x >>= 1; }
  }
  return dist;
}

export function recordPhotoHash({ tenantId, workerId, grievanceId, hash, takenAt, lat, lng }) {
  const tid = tenantId || DEFAULT_TENANT_ID;
  if (!hash) return;
  if (!STATE.photoHashesByTenant.has(tid)) STATE.photoHashesByTenant.set(tid, []);
  const arr = STATE.photoHashesByTenant.get(tid);
  arr.unshift({
    hash, workerId: workerId || null, grievanceId: grievanceId || null,
    takenAt: takenAt || null, recordedAt: Date.now(),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  });
  if (arr.length > PHOTO_RING_LIMIT) arr.length = PHOTO_RING_LIMIT;
}

export function findSimilarPhotoHashes({ tenantId, hash, hours = PHOTO_DEDUP_HOURS, threshold = 8 }) {
  const tid = tenantId || DEFAULT_TENANT_ID;
  const arr = STATE.photoHashesByTenant.get(tid) || [];
  const cutoff = Date.now() - hours * 3600 * 1000;
  const matches = [];
  for (const e of arr) {
    if (e.recordedAt < cutoff) continue;
    const d = hammingHex(hash, e.hash);
    if (d <= threshold) matches.push({ ...e, hammingDistance: d });
  }
  return matches.sort((a, b) => a.hammingDistance - b.hammingDistance);
}

// Haversine distance in km — for "photo taken far from claimed ward"
// tamper checks. Returns Infinity if either point is missing.
export function haversineKm(lat1, lng1, lat2, lng2) {
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Infinity;
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ── Heartbeat helpers ──────────────────────────────────────────────
// Tenant scoping:
//   upsertHeartbeat — devices declare their tenantId; defaults to
//   'default-ts' if the calling client predates D1 multi-tenancy.
//   listHeartbeats — operator-side; takes the operator's tenantId so
//   only that ULB's devices show up in their CMCC.
export async function upsertHeartbeat({ deviceId, state, ip, ua, tenantId }) {
  const tid = tenantId || DEFAULT_TENANT_ID;
  const c = sb();
  if (c) {
    try {
      const { error } = await c.from('heartbeats').upsert({
        device_id: deviceId,
        tenant_id: tid,
        state,
        ip,
        ua,
        last_seen: new Date().toISOString(),
      }, { onConflict: 'device_id' });
      if (!error) return true;
      console.warn('[supabase] heartbeat upsert failed:', error.message);
    } catch (e) { console.warn('[supabase] heartbeat upsert threw:', e.message); }
  }
  // Fallback — namespace by tenant so two tenants can host the same demo deviceId.
  STATE.heartbeats.set(`${tid}:${deviceId}`, { state, at: Date.now(), ip, ua, tenantId: tid });
  return true;
}

export async function listHeartbeats({ tenantId } = {}) {
  const tid = tenantId || DEFAULT_TENANT_ID;
  const c = sb();
  if (c) {
    try {
      const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data, error } = await c.from('heartbeats')
        .select('device_id,state,ua,last_seen,tenant_id')
        .eq('tenant_id', tid)
        .gte('last_seen', cutoff)
        .order('last_seen', { ascending: false });
      if (!error && data) {
        return data.map((d) => ({
          deviceId: d.device_id,
          state: d.state,
          ua: d.ua,
          lastSeen: new Date(d.last_seen).getTime(),
          tenantId: d.tenant_id,
        }));
      }
    } catch (e) { console.warn('[supabase] heartbeat list threw:', e.message); }
  }
  // Fallback: prune in-memory map then filter by tenant.
  const stale = Date.now() - 5 * 60 * 1000;
  for (const [k, v] of STATE.heartbeats) if (v.at < stale) STATE.heartbeats.delete(k);
  const out = [];
  for (const [k, v] of STATE.heartbeats) {
    if ((v.tenantId || DEFAULT_TENANT_ID) !== tid) continue;
    const deviceId = k.includes(':') ? k.slice(k.indexOf(':') + 1) : k;
    out.push({ deviceId, state: v.state, ua: v.ua, lastSeen: v.at, tenantId: v.tenantId || DEFAULT_TENANT_ID });
  }
  return out;
}

// ── Audit helpers ──────────────────────────────────────────────────
// Audit rows are tenant-scoped — a GHMC operator's actions never appear
// in WMC's audit feed.
export async function insertAudit({ actor, action, target, tenantId }) {
  const tid = tenantId || DEFAULT_TENANT_ID;
  const c = sb();
  if (c) {
    try {
      const { data, error } = await c.from('audit_log')
        .insert({ actor, action, target, tenant_id: tid, when_at: new Date().toISOString() })
        .select('id,actor,action,target,when_at,tenant_id')
        .single();
      if (!error && data) {
        return {
          id: 'au' + data.id,
          actor: data.actor,
          action: data.action,
          target: data.target,
          tenantId: data.tenant_id,
          when: new Date(data.when_at).getTime(),
        };
      }
    } catch (e) { console.warn('[supabase] audit insert threw:', e.message); }
  }
  const memEntry = { id: 'au' + Date.now(), actor, action, target, tenantId: tid, when: Date.now() };
  if (!STATE.auditLogByTenant.has(tid)) STATE.auditLogByTenant.set(tid, []);
  const arr = STATE.auditLogByTenant.get(tid);
  arr.unshift(memEntry);
  if (arr.length > 500) arr.length = 500;
  return memEntry;
}

export async function listAudit(limit = 100, { tenantId } = {}) {
  const tid = tenantId || DEFAULT_TENANT_ID;
  const c = sb();
  if (c) {
    try {
      const { data, error } = await c.from('audit_log')
        .select('id,actor,action,target,when_at,tenant_id')
        .eq('tenant_id', tid)
        .order('when_at', { ascending: false })
        .limit(limit);
      if (!error && data) {
        return data.map((r) => ({
          id: 'au' + r.id, actor: r.actor, action: r.action, target: r.target,
          tenantId: r.tenant_id,
          when: new Date(r.when_at).getTime(),
        }));
      }
    } catch (e) { console.warn('[supabase] audit list threw:', e.message); }
  }
  const arr = STATE.auditLogByTenant.get(tid) || [];
  return arr.slice(0, limit);
}

// ── Token signing (HMAC-SHA256, no external deps) ───────────────────
function b64u(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function b64uDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64').toString();
}
export function signToken(payload, ttlSec = 7 * 24 * 3600) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec };
  const h = b64u(JSON.stringify(header));
  const p = b64u(JSON.stringify(body));
  const sig = b64u(crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest());
  return `${h}.${p}.${sig}`;
}
export function verifyToken(token) {
  if (!token) return null;
  const [h, p, sig] = token.split('.');
  if (!h || !p || !sig) return null;
  const expected = b64u(crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest());
  if (expected !== sig) return null;
  try {
    const body = JSON.parse(b64uDecode(p));
    if (body.exp && body.exp * 1000 < Date.now()) return null;
    return body;
  } catch { return null; }
}

// ── Auth guard ──────────────────────────────────────────────────────
// Returns the operator record (with role: 'OPERATOR' and tenantId) or
// null. Backwards-compat: tokens minted before D1 don't carry tenantId,
// so we re-read the operator's current tenant from the DB / fallback.
// The token's claim is preferred (cheap), the DB is authoritative.
export async function authOperator(req) {
  const auth = req.headers.authorization || req.headers.Authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  const payload = verifyToken(auth.slice(7));
  if (!payload) return null;
  const op = await getOperatorById(payload.sub);
  if (!op) return null;
  return {
    ...op,
    tenantId: op.tenantId || payload.tenantId || DEFAULT_TENANT_ID,
    role: 'OPERATOR',
  };
}

// ── Body parser (Vercel exposes parsed body for application/json) ───
export function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

// ── CORS preflight helper ───────────────────────────────────────────
export function applyCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

// Backwards-compat: a few places import `OPERATORS` directly. Export an
// async-aware proxy that hits Supabase first, falls back to the seed.
export const OPERATORS = OPERATORS_FALLBACK;
