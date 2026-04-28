import express from 'express';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, seed, newId } from './db.js';
import { startBroker, createClient, topics } from './mqtt.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3030);
const MQTT_PORT = Number(process.env.MQTT_PORT || 1883);
const JWT_SECRET = process.env.JWT_SECRET || 'demo-only-secret-do-not-use-in-prod';
const FILL_THRESHOLD = 80;
const COMMUNITY_ID = 'c1';

seed();

// ---------- Auth ----------
function issueToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'unauthorized' });
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET);
    const user = [...db.users.values()].find((u) => u.id === payload.sub);
    if (!user) return res.status(401).json({ error: 'unauthorized' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'invalid token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) =>
    roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'forbidden' });
}

// ---------- App ----------
const app = express();
app.use(cors());
app.use(express.json());
// CMCC moved to its own service — bounce /cmcc.html before static handles it.
app.get('/cmcc.html', (_req, res) => res.redirect(302, process.env.CMCC_URL || 'http://localhost:4040'));
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------- Auth routes ----------
app.post('/api/auth/otp/request', (req, res) => {
  const { phone } = req.body || {};
  if (!phone || !/^\+91\d{10}$/.test(phone)) {
    return res.status(400).json({ error: 'phone must be +91XXXXXXXXXX' });
  }
  if (!db.users.has(phone)) {
    db.users.set(phone, {
      id: newId(), phone, name: null, role: 'RESIDENT', flatId: null, language: 'EN',
    });
  }
  // Demo: fixed OTP, returned in the response so the user can copy/paste.
  const otp = '123456';
  db.otps.set(phone, { otp, exp: Date.now() + 5 * 60_000 });
  console.log(`[OTP] ${phone} -> ${otp}`);
  res.json({ ok: true, demoOtp: otp });
});

app.post('/api/auth/otp/verify', (req, res) => {
  const { phone, otp } = req.body || {};
  const stored = db.otps.get(phone);
  if (!stored || stored.exp < Date.now() || stored.otp !== otp) {
    return res.status(400).json({ error: 'invalid or expired otp' });
  }
  db.otps.delete(phone);
  const user = db.users.get(phone);
  res.json({ token: issueToken(user), user });
});

app.get('/api/me', requireAuth, (req, res) => {
  const flat = req.user.flatId ? db.flats.get(req.user.flatId) : null;
  res.json({ ...req.user, flat });
});

app.patch('/api/me', requireAuth, (req, res) => {
  const { name, flatId, language } = req.body || {};
  if (name !== undefined) req.user.name = name;
  if (flatId !== undefined) req.user.flatId = flatId;
  if (language !== undefined) req.user.language = language;
  res.json(req.user);
});

// ---------- Catalog ----------
app.get('/api/services', (_req, res) => res.json([...db.services.values()]));
app.get('/api/flats', (_req, res) => res.json([...db.flats.values()]));

// ---------- Orders (resident) ----------
function enrich(o) {
  return {
    ...o,
    flat: o.flatId ? db.flats.get(o.flatId) : null,
    service: db.services.get(o.serviceId),
    resident: o.residentId ? findUser(o.residentId) : null,
    agent: o.agentId ? findUser(o.agentId) : null,
  };
}

function findUser(id) {
  const u = [...db.users.values()].find((x) => x.id === id);
  if (!u) return null;
  return { id: u.id, name: u.name, phone: u.phone, role: u.role };
}

function broadcastOrder(order) {
  const enriched = enrich(order);
  if (order.residentId) io.to(`user:${order.residentId}`).emit('order:status', enriched);
  if (order.agentId)    io.to(`user:${order.agentId}`).emit('order:status', enriched);
  io.to('admin').emit('order:status', enriched);
}

app.post('/api/orders', requireAuth, requireRole('RESIDENT'), (req, res) => {
  const { serviceId, scheduledAt, notes } = req.body || {};
  if (!req.user.flatId) return res.status(400).json({ error: 'link a flat in your profile first' });
  const service = db.services.get(serviceId);
  if (!service) return res.status(404).json({ error: 'service not found' });

  const now = new Date().toISOString();
  const order = {
    id: newId(),
    residentId: req.user.id,
    agentId: 'u-agent-1', // single demo agent — auto-assign
    serviceId,
    flatId: req.user.flatId,
    status: 'ASSIGNED',
    scheduledAt: scheduledAt || now,
    amount: service.basePrice,
    notes: notes || null,
    source: 'MANUAL',
    createdAt: now,
    history: [
      { status: 'CREATED',  at: now },
      { status: 'ASSIGNED', at: now, agentId: 'u-agent-1' },
    ],
  };
  db.orders.set(order.id, order);
  io.to('user:u-agent-1').emit('order:new', enrich(order));
  io.to('admin').emit('order:new', enrich(order));
  res.json(enrich(order));
});

app.get('/api/orders', requireAuth, (req, res) => {
  let list = [...db.orders.values()];
  if (req.user.role === 'RESIDENT') list = list.filter((o) => o.residentId === req.user.id);
  if (req.user.role === 'AGENT')    list = list.filter((o) => o.agentId === req.user.id);
  res.json(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(enrich));
});

app.get('/api/orders/:id', requireAuth, (req, res) => {
  const order = db.orders.get(req.params.id);
  if (!order) return res.status(404).json({ error: 'not found' });
  res.json(enrich(order));
});

app.post('/api/orders/:id/cancel', requireAuth, (req, res) => {
  const order = db.orders.get(req.params.id);
  if (!order) return res.status(404).json({ error: 'not found' });
  if (!['CREATED', 'ASSIGNED'].includes(order.status)) {
    return res.status(400).json({ error: `cannot cancel from status ${order.status}` });
  }
  order.status = 'CANCELLED';
  order.history.push({ status: 'CANCELLED', at: new Date().toISOString(), by: req.user.id });
  broadcastOrder(order);
  res.json(enrich(order));
});

app.post('/api/orders/:id/rate', requireAuth, requireRole('RESIDENT'), (req, res) => {
  const order = db.orders.get(req.params.id);
  if (!order || order.residentId !== req.user.id) return res.status(404).json({ error: 'not found' });
  if (order.status !== 'COMPLETED') return res.status(400).json({ error: 'only completed orders' });
  order.rating = Math.max(1, Math.min(5, Number(req.body?.stars || 5)));
  order.ratingComment = req.body?.comment || null;
  io.to('admin').emit('order:status', enrich(order));
  res.json(enrich(order));
});

// ---------- Agent flow ----------
function transition(orderId, agentId, next, extra = {}) {
  const order = db.orders.get(orderId);
  if (!order) return { error: 'not found', code: 404 };
  if (order.agentId !== agentId) return { error: 'not your task', code: 403 };
  order.status = next;
  order.history.push({ status: next, at: new Date().toISOString(), ...extra });
  if (next === 'COMPLETED') order.completedAt = new Date().toISOString();
  broadcastOrder(order);
  return { order: enrich(order) };
}

app.post('/api/agent/tasks/:id/start',    requireAuth, requireRole('AGENT'), (req, res) => respond(res, transition(req.params.id, req.user.id, 'EN_ROUTE')));
app.post('/api/agent/tasks/:id/arrive',   requireAuth, requireRole('AGENT'), (req, res) => respond(res, transition(req.params.id, req.user.id, 'ARRIVED')));
app.post('/api/agent/tasks/:id/complete', requireAuth, requireRole('AGENT'), (req, res) => respond(res, transition(req.params.id, req.user.id, 'COMPLETED')));

app.post('/api/agent/tasks/:id/scan', requireAuth, requireRole('AGENT'), (req, res) => {
  const { code, type } = req.body || {};
  const order = db.orders.get(req.params.id);
  if (!order || order.agentId !== req.user.id) return res.status(404).json({ error: 'not found' });
  if (type === 'RFID') {
    const flat = order.flatId ? db.flats.get(order.flatId) : null;
    if (!flat || flat.rfidTag !== code) return res.status(400).json({ error: 'rfid tag does not match this flat' });
  }
  // QR fallback: in prod we'd verify a signed JWT — for the demo we accept any non-empty code.
  if (type === 'QR' && !code) return res.status(400).json({ error: 'empty qr' });
  respond(res, transition(req.params.id, req.user.id, 'IN_PROGRESS', { via: type, code }));
});

function respond(res, result) {
  if (result.error) return res.status(result.code || 400).json({ error: result.error });
  res.json(result.order);
}

// ---------- Admin ----------
app.get('/api/admin/devices', requireAuth, requireRole('ADMIN'), (_req, res) =>
  res.json([...db.devices.values()]));

app.get('/api/admin/orders', requireAuth, requireRole('ADMIN'), (_req, res) =>
  res.json([...db.orders.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(enrich)));

app.get('/api/admin/communities', requireAuth, requireRole('ADMIN'), (_req, res) => {
  const out = [...db.communities.values()].map((c) => ({
    ...c,
    flats: [...db.flats.values()].filter((f) => f.communityId === c.id),
    deviceCount: [...db.devices.values()].filter((d) => d.communityId === c.id).length,
  }));
  res.json(out);
});

app.get('/api/admin/stats', requireAuth, requireRole('ADMIN'), (_req, res) => {
  const orders = [...db.orders.values()];
  res.json({
    totalOrders: orders.length,
    active: orders.filter((o) => !['COMPLETED', 'CANCELLED'].includes(o.status)).length,
    completedToday: orders.filter((o) => o.completedAt && o.completedAt.slice(0, 10) === new Date().toISOString().slice(0, 10)).length,
    devicesOnline: [...db.devices.values()].filter((d) => d.online).length,
    fullBins: [...db.devices.values()].filter((d) => d.type === 'SMART_BIN' && d.fillLevel >= FILL_THRESHOLD).length,
  });
});

// Admin → simulate IoT events by publishing to MQTT (same path real devices use)
app.post('/api/admin/iot/bin/:id/level', requireAuth, requireRole('ADMIN'), (req, res) => {
  const device = db.devices.get(req.params.id);
  if (!device || device.type !== 'SMART_BIN') return res.status(404).json({ error: 'bin not found' });
  const level = Math.max(0, Math.min(100, Number(req.body?.level)));
  pub.publish(topics.telemetry(COMMUNITY_ID, device.id), JSON.stringify({ ts: Date.now(), v: level, u: '%' }));
  if (level >= FILL_THRESHOLD) {
    pub.publish(topics.event(COMMUNITY_ID, device.id), JSON.stringify({ ts: Date.now(), type: 'FULL', v: level }));
  }
  res.json({ ok: true });
});

app.post('/api/admin/iot/scan', requireAuth, requireRole('ADMIN'), (req, res) => {
  const { tag, orderId } = req.body || {};
  pub.publish(topics.scan(COMMUNITY_ID, 'scanner-gate'), JSON.stringify({ ts: Date.now(), tag, orderId }));
  res.json({ ok: true });
});

// ---------- CMCC bridge ----------
// Per-device snapshots posted by mobile apps. Each device's most recent
// state replaces the previous one. CMCC fetches the aggregated network
// view via /api/cmcc/network.
const cmccDevices = new Map();   // deviceId → { state, at, ip, ua }

app.post('/api/cmcc/heartbeat', (req, res) => {
  const { deviceId, state } = req.body || {};
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
  cmccDevices.set(deviceId, {
    state, at: Date.now(),
    ip: req.ip, ua: req.headers['user-agent'] || '',
  });
  res.json({ ok: true, devices: cmccDevices.size });
});

app.get('/api/cmcc/network', (_req, res) => {
  const stale = Date.now() - 5 * 60 * 1000; // drop devices silent >5 min
  for (const [id, v] of cmccDevices) if (v.at < stale) cmccDevices.delete(id);
  res.json({
    fetchedAt: Date.now(),
    deviceCount: cmccDevices.size,
    devices: [...cmccDevices.entries()].map(([deviceId, v]) => ({
      deviceId, lastSeen: v.at, ua: v.ua, state: v.state,
    })),
  });
});

// ---------- HTTP + Socket.IO ----------
const httpServer = createServer(app);
const io = new SocketIO(httpServer, { cors: { origin: '*' } });

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('no token'));
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    socket.data.userId = payload.sub;
    socket.data.role = payload.role;
    next();
  } catch {
    next(new Error('invalid token'));
  }
});

io.on('connection', (socket) => {
  socket.join(`user:${socket.data.userId}`);
  if (socket.data.role === 'ADMIN') socket.join('admin');

  // Agent broadcasts its location while a task is active.
  socket.on('agent:location', ({ orderId, lat, lng, etaMin }) => {
    const order = db.orders.get(orderId);
    if (!order || order.agentId !== socket.data.userId) return;
    const payload = { orderId, lat, lng, etaMin, agentId: socket.data.userId };
    if (order.residentId) io.to(`user:${order.residentId}`).emit('agent:location', payload);
    io.to('admin').emit('agent:location', payload);
  });
});

// ---------- MQTT broker + IoT consumer ----------
const broker = await startBroker(MQTT_PORT);
console.log(`[MQTT] broker on :${MQTT_PORT}`);

const pub = createClient(MQTT_PORT);
const sub = createClient(MQTT_PORT);

sub.on('connect', () => {
  sub.subscribe('valet/+/+/telemetry');
  sub.subscribe('valet/+/+/event');
  sub.subscribe('valet/+/+/scan');
  console.log('[MQTT] consumer subscribed');
});

sub.on('message', (topic, payloadBuf) => {
  const [, _community, deviceId, kind] = topic.split('/');
  let msg;
  try { msg = JSON.parse(payloadBuf.toString()); } catch { return; }

  if (kind === 'telemetry') {
    const device = db.devices.get(deviceId);
    if (!device) return;
    device.fillLevel = msg.v;
    device.lastSeen = Date.now();
    device.online = true;
    io.to('admin').emit('device:update', device);
  } else if (kind === 'event' && msg.type === 'FULL') {
    autoCreateGarbageOrder(deviceId);
  } else if (kind === 'scan') {
    handleScan(msg);
  }
});

function autoCreateGarbageOrder(deviceId) {
  const dup = [...db.orders.values()].find(
    (o) => o.source === 'AUTO_BIN' && o.deviceId === deviceId && !['COMPLETED', 'CANCELLED'].includes(o.status),
  );
  if (dup) return;
  const now = new Date().toISOString();
  const order = {
    id: newId(),
    residentId: null,
    agentId: 'u-agent-1',
    serviceId: 'svc-garbage',
    flatId: null,
    deviceId,
    status: 'ASSIGNED',
    scheduledAt: now,
    amount: 0,
    notes: `Smart bin ${deviceId} reached threshold`,
    source: 'AUTO_BIN',
    createdAt: now,
    history: [
      { status: 'CREATED',  at: now, via: 'IOT_AUTO' },
      { status: 'ASSIGNED', at: now, agentId: 'u-agent-1' },
    ],
  };
  db.orders.set(order.id, order);
  console.log(`[IOT] auto-created order ${order.id} for full bin ${deviceId}`);
  io.to('user:u-agent-1').emit('order:new', enrich(order));
  io.to('admin').emit('order:new', enrich(order));
}

function handleScan({ tag, orderId }) {
  const flat = [...db.flats.values()].find((f) => f.rfidTag === tag);
  if (!flat) return;
  if (!orderId) return;
  const order = db.orders.get(orderId);
  if (!order || order.flatId !== flat.id) return;
  if (!['EN_ROUTE', 'ARRIVED'].includes(order.status)) return;
  order.status = 'IN_PROGRESS';
  order.history.push({ status: 'IN_PROGRESS', at: new Date().toISOString(), via: 'RFID', tag });
  broadcastOrder(order);
}

// Background: bins slowly fill up, so the demo feels alive without clicks.
setInterval(() => {
  for (const dev of db.devices.values()) {
    if (dev.type !== 'SMART_BIN') continue;
    const next = Math.min(100, dev.fillLevel + Math.random() * 3);
    pub.publish(topics.telemetry(COMMUNITY_ID, dev.id), JSON.stringify({ ts: Date.now(), v: Math.round(next) }));
    if (next >= FILL_THRESHOLD && dev.fillLevel < FILL_THRESHOLD) {
      pub.publish(topics.event(COMMUNITY_ID, dev.id), JSON.stringify({ ts: Date.now(), type: 'FULL', v: Math.round(next) }));
    }
  }
}, 8000);

httpServer.listen(PORT, () => {
  console.log(`\n  Hearthly demo ready`);
  console.log(`  ──────────────────────────────────────────`);
  console.log(`  HTTP   http://localhost:${PORT}`);
  console.log(`  MQTT   mqtt://localhost:${MQTT_PORT}`);
  console.log(`  Resident  +919999900001  (OTP 123456)`);
  console.log(`  Agent     +919999900002  (OTP 123456)`);
  console.log(`  Admin     +919999900003  (OTP 123456)\n`);
});
