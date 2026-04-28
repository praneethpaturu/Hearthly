// Shared helpers for every CMCC serverless function on Vercel.
//
// State lives at module scope. Vercel reuses warm containers across
// invocations, so the heartbeat / audit Maps survive within a session,
// but cold starts wipe them. That's an explicit trade-off for the
// Hobby-tier demo: no external DB needed, persistence is best-effort.
import crypto from 'node:crypto';

const SECRET = process.env.JWT_SECRET || 'cmcc-demo-secret-do-not-use-in-prod';

// ── Operator allow-list (mirrors cmcc-website/server.js) ────────────
export const OPERATORS = new Map([
  ['+919999900010', { id: 'op1', phone: '+919999900010', name: 'Priya Iyer',   opRole: 'NOC Lead'      }],
  ['+919999900011', { id: 'op2', phone: '+919999900011', name: 'Sandeep Rao',  opRole: 'NOC Operator'  }],
  ['+919999900012', { id: 'op3', phone: '+919999900012', name: 'Rakhi Menon',  opRole: 'NOC Operator'  }],
  ['+919999900013', { id: 'op4', phone: '+919999900013', name: 'Faizan Ahmed', opRole: 'On-Call SRE'   }],
  ['+919999900014', { id: 'op5', phone: '+919999900014', name: 'Akhila Reddy', opRole: 'Compliance'    }],
]);

// ── In-memory shared state (best-effort across warm invocations) ───
const _global = globalThis;
_global.__hearthlyCmccState ||= {
  heartbeats: new Map(),   // deviceId → { state, at, ip, ua }
  auditLog: [],            // { id, actor, action, target, when }
};
export const STATE = _global.__hearthlyCmccState;

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

// ── Auth guard (returns operator or null) ────────────────────────────
export function authOperator(req) {
  const auth = req.headers.authorization || req.headers.Authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  const payload = verifyToken(auth.slice(7));
  if (!payload) return null;
  const op = [...OPERATORS.values()].find((o) => o.id === payload.sub);
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
