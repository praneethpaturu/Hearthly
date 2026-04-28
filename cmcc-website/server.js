// ─────────────────────────────────────────────────────────────────────
// Hearthly — Centralized Monitoring & Control Center (standalone)
// Own server, own login (operators only), own bridge endpoint.
// Mobile clients heartbeat their state here; operators see live network.
// ─────────────────────────────────────────────────────────────────────

import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4040);
const SECRET = process.env.JWT_SECRET || 'cmcc-demo-secret-do-not-use-in-prod';

// ── Operator directory (in-memory; production would be a real DB) ───
const operators = new Map([
  ['+919999900010', { id: 'op1', phone: '+919999900010', name: 'Priya Iyer',   opRole: 'NOC Lead'      }],
  ['+919999900011', { id: 'op2', phone: '+919999900011', name: 'Sandeep Rao',  opRole: 'NOC Operator'  }],
  ['+919999900012', { id: 'op3', phone: '+919999900012', name: 'Rakhi Menon',  opRole: 'NOC Operator'  }],
  ['+919999900013', { id: 'op4', phone: '+919999900013', name: 'Faizan Ahmed', opRole: 'On-Call SRE'   }],
  ['+919999900014', { id: 'op5', phone: '+919999900014', name: 'Akhila Reddy', opRole: 'Compliance'    }],
]);

const otps = new Map();          // phone → { otp, exp }
const heartbeats = new Map();    // deviceId → { state, at, ip, ua }
const auditLog = [];             // { id, actor, action, target, when }

// ── Middleware ──────────────────────────────────────────────────────
const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function authGuard(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'unauthorized' });
  try {
    const payload = jwt.verify(auth.slice(7), SECRET);
    const op = [...operators.values()].find((o) => o.id === payload.sub);
    if (!op) return res.status(401).json({ error: 'unknown operator' });
    req.user = { ...op, role: 'OPERATOR' };
    next();
  } catch {
    res.status(401).json({ error: 'invalid token' });
  }
}

// ── Auth (OTP, operator-only) ───────────────────────────────────────
app.post('/api/auth/otp/request', (req, res) => {
  const { phone } = req.body || {};
  if (!phone || !/^\+91\d{10}$/.test(phone)) return res.status(400).json({ error: 'phone must be +91XXXXXXXXXX' });
  if (!operators.has(phone)) return res.status(403).json({ error: 'CMCC is for operators only — your number is not on the operator allow-list' });
  const otp = '123456';
  otps.set(phone, { otp, exp: Date.now() + 5 * 60 * 1000 });
  console.log(`[OTP] ${phone} -> ${otp}`);
  res.json({ ok: true, demoOtp: otp });
});

app.post('/api/auth/otp/verify', (req, res) => {
  const { phone, otp } = req.body || {};
  const stored = otps.get(phone);
  if (!stored || stored.exp < Date.now() || stored.otp !== otp) return res.status(400).json({ error: 'invalid or expired otp' });
  otps.delete(phone);
  const op = operators.get(phone);
  const user = { ...op, role: 'OPERATOR' };
  const token = jwt.sign({ sub: op.id, phone: op.phone, role: 'OPERATOR' }, SECRET, { expiresIn: '7d' });
  res.json({ token, user });
});

app.get('/api/me', authGuard, (req, res) => res.json(req.user));

app.get('/api/operators', authGuard, (_req, res) => res.json([...operators.values()]));

// ── Bridge: mobile devices report state ─────────────────────────────
// No auth needed — deviceId is the credential. In prod we'd issue
// per-device certs and enforce mTLS, but the contract stays the same.
app.post('/api/cmcc/heartbeat', (req, res) => {
  const { deviceId, state } = req.body || {};
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
  heartbeats.set(deviceId, {
    state, at: Date.now(),
    ip: req.ip, ua: req.headers['user-agent'] || '',
  });
  res.json({ ok: true, devices: heartbeats.size });
});

app.get('/api/cmcc/network', authGuard, (_req, res) => {
  const stale = Date.now() - 5 * 60 * 1000;
  for (const [id, v] of heartbeats) if (v.at < stale) heartbeats.delete(id);
  res.json({
    fetchedAt: Date.now(),
    deviceCount: heartbeats.size,
    devices: [...heartbeats.entries()].map(([deviceId, v]) => ({
      deviceId, lastSeen: v.at, ua: v.ua, state: v.state,
    })),
  });
});

// ── Server-side audit log (operator actions) ────────────────────────
app.post('/api/cmcc/audit', authGuard, (req, res) => {
  const { action, target } = req.body || {};
  const entry = { id: 'au' + Date.now(), actor: req.user.name, action, target, when: Date.now() };
  auditLog.unshift(entry);
  if (auditLog.length > 500) auditLog.length = 500;
  res.json(entry);
});

app.get('/api/cmcc/audit', authGuard, (_req, res) => res.json(auditLog.slice(0, 100)));

// ── Health ──────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({
  ok: true,
  uptime: process.uptime(),
  heartbeats: heartbeats.size,
  audit: auditLog.length,
  operators: operators.size,
}));

// ── Routes for unauth users → login ─────────────────────────────────
// (static handles index.html / login.html)

app.listen(PORT, () => {
  console.log(`\n  Valet CMCC — Centralized Monitoring & Control Center`);
  console.log(`  ──────────────────────────────────────────────────────`);
  console.log(`  Web   http://localhost:${PORT}`);
  console.log(`  Operators (any of these, OTP 123456):`);
  for (const op of operators.values()) console.log(`    ${op.phone}  ${op.name.padEnd(16)} ${op.opRole}`);
  console.log(`\n  Mobile bridge: POST http://localhost:${PORT}/api/cmcc/heartbeat\n`);
});
