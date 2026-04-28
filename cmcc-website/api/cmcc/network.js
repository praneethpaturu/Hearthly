import { STATE, authOperator, applyCors } from '../_lib.js';

export default function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

  if (!authOperator(req)) return res.status(401).json({ error: 'unauthorized' });

  // Drop devices silent for >5 min so the network view stays fresh.
  const stale = Date.now() - 5 * 60 * 1000;
  for (const [id, v] of STATE.heartbeats) {
    if (v.at < stale) STATE.heartbeats.delete(id);
  }
  return res.status(200).json({
    fetchedAt: Date.now(),
    deviceCount: STATE.heartbeats.size,
    devices: [...STATE.heartbeats.entries()].map(([deviceId, v]) => ({
      deviceId, lastSeen: v.at, ua: v.ua, state: v.state,
    })),
  });
}
