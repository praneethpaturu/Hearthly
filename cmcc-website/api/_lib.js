// Shared helpers for every CMCC serverless function on Vercel.
//
// Storage strategy: Supabase when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
// are configured; transparent in-memory fallback otherwise. The fallback
// keeps the deploy alive even mid-migration or if Supabase is down — the
// page just sees ephemeral state instead of persistent.
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const SECRET = process.env.JWT_SECRET || 'cmcc-demo-secret-do-not-use-in-prod';

// ── Operator allow-list (in-memory fallback) ───────────────────────
// Mirrors the seed-rows in supabase/migrations/0001_init.sql. Used when
// Supabase isn't configured, or as a last-resort fallback if a query
// fails (so the demo never gets locked out of operator login).
export const OPERATORS_FALLBACK = new Map([
  ['+919999900010', { id: 'op1', phone: '+919999900010', name: 'Priya Iyer',   opRole: 'NOC Lead'      }],
  ['+919999900011', { id: 'op2', phone: '+919999900011', name: 'Sandeep Rao',  opRole: 'NOC Operator'  }],
  ['+919999900012', { id: 'op3', phone: '+919999900012', name: 'Rakhi Menon',  opRole: 'NOC Operator'  }],
  ['+919999900013', { id: 'op4', phone: '+919999900013', name: 'Faizan Ahmed', opRole: 'On-Call SRE'   }],
  ['+919999900014', { id: 'op5', phone: '+919999900014', name: 'Akhila Reddy', opRole: 'Compliance'    }],
]);

// ── In-memory shared state (fallback for heartbeats + audit) ───────
const _global = globalThis;
_global.__hearthlyCmccState ||= {
  heartbeats: new Map(),
  auditLog: [],
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

// ── Operator helpers ───────────────────────────────────────────────
export async function getOperatorByPhone(phone) {
  const c = sb();
  if (c) {
    try {
      const { data, error } = await c.from('operators')
        .select('id,phone,name,op_role')
        .eq('phone', phone)
        .maybeSingle();
      if (!error && data) return { id: data.id, phone: data.phone, name: data.name, opRole: data.op_role };
    } catch (e) { console.warn('[supabase] operator lookup failed:', e.message); }
  }
  return OPERATORS_FALLBACK.get(phone) || null;
}

export async function getOperatorById(id) {
  const c = sb();
  if (c) {
    try {
      const { data, error } = await c.from('operators')
        .select('id,phone,name,op_role')
        .eq('id', id)
        .maybeSingle();
      if (!error && data) return { id: data.id, phone: data.phone, name: data.name, opRole: data.op_role };
    } catch (e) { console.warn('[supabase] operator lookup failed:', e.message); }
  }
  return [...OPERATORS_FALLBACK.values()].find((o) => o.id === id) || null;
}

// ── Heartbeat helpers ──────────────────────────────────────────────
export async function upsertHeartbeat({ deviceId, state, ip, ua }) {
  const c = sb();
  if (c) {
    try {
      const { error } = await c.from('heartbeats').upsert({
        device_id: deviceId,
        state,
        ip,
        ua,
        last_seen: new Date().toISOString(),
      }, { onConflict: 'device_id' });
      if (!error) return true;
      console.warn('[supabase] heartbeat upsert failed:', error.message);
    } catch (e) { console.warn('[supabase] heartbeat upsert threw:', e.message); }
  }
  // Fallback
  STATE.heartbeats.set(deviceId, { state, at: Date.now(), ip, ua });
  return true;
}

export async function listHeartbeats() {
  const c = sb();
  if (c) {
    try {
      const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data, error } = await c.from('heartbeats')
        .select('device_id,state,ua,last_seen')
        .gte('last_seen', cutoff)
        .order('last_seen', { ascending: false });
      if (!error && data) {
        return data.map((d) => ({
          deviceId: d.device_id,
          state: d.state,
          ua: d.ua,
          lastSeen: new Date(d.last_seen).getTime(),
        }));
      }
    } catch (e) { console.warn('[supabase] heartbeat list threw:', e.message); }
  }
  // Fallback: prune in-memory map and return.
  const stale = Date.now() - 5 * 60 * 1000;
  for (const [id, v] of STATE.heartbeats) if (v.at < stale) STATE.heartbeats.delete(id);
  return [...STATE.heartbeats.entries()].map(([deviceId, v]) => ({
    deviceId, state: v.state, ua: v.ua, lastSeen: v.at,
  }));
}

// ── Audit helpers ──────────────────────────────────────────────────
export async function insertAudit({ actor, action, target }) {
  const entry = { actor, action, target, when_at: new Date().toISOString() };
  const c = sb();
  if (c) {
    try {
      const { data, error } = await c.from('audit_log')
        .insert(entry)
        .select('id,actor,action,target,when_at')
        .single();
      if (!error && data) {
        return {
          id: 'au' + data.id,
          actor: data.actor,
          action: data.action,
          target: data.target,
          when: new Date(data.when_at).getTime(),
        };
      }
    } catch (e) { console.warn('[supabase] audit insert threw:', e.message); }
  }
  const memEntry = { id: 'au' + Date.now(), actor, action, target, when: Date.now() };
  STATE.auditLog.unshift(memEntry);
  if (STATE.auditLog.length > 500) STATE.auditLog.length = 500;
  return memEntry;
}

export async function listAudit(limit = 100) {
  const c = sb();
  if (c) {
    try {
      const { data, error } = await c.from('audit_log')
        .select('id,actor,action,target,when_at')
        .order('when_at', { ascending: false })
        .limit(limit);
      if (!error && data) {
        return data.map((r) => ({
          id: 'au' + r.id, actor: r.actor, action: r.action, target: r.target,
          when: new Date(r.when_at).getTime(),
        }));
      }
    } catch (e) { console.warn('[supabase] audit list threw:', e.message); }
  }
  return STATE.auditLog.slice(0, limit);
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
// Returns the operator record (with role: 'OPERATOR') or null.
export async function authOperator(req) {
  const auth = req.headers.authorization || req.headers.Authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  const payload = verifyToken(auth.slice(7));
  if (!payload) return null;
  const op = await getOperatorById(payload.sub);
  return op ? { ...op, role: 'OPERATOR' } : null;
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
