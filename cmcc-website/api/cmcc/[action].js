// Vercel dynamic-route dispatcher for /api/cmcc/*.
// Public URLs unchanged:
//   POST /api/cmcc/heartbeat → _heartbeat
//   GET  /api/cmcc/network   → _network
//   GET|POST /api/cmcc/audit → _audit
import audit     from './_audit.js';
import heartbeat from './_heartbeat.js';
import network   from './_network.js';

const handlers = { audit, heartbeat, network };

export default async function handler(req, res) {
  const action = (req.query?.action || '').toString();
  const fn = handlers[action];
  if (!fn) return res.status(404).json({ error: `unknown cmcc action: ${action}` });
  return fn(req, res);
}
