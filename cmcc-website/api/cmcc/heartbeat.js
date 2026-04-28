import { STATE, readBody, applyCors } from '../_lib.js';

// Mobile devices report state here. No auth — deviceId is the credential
// (matches the Express server's contract).
export default function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const { deviceId, state } = readBody(req);
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
  STATE.heartbeats.set(deviceId, {
    state,
    at: Date.now(),
    ip: req.headers['x-forwarded-for'] || '',
    ua: req.headers['user-agent'] || '',
  });
  return res.status(200).json({ ok: true, devices: STATE.heartbeats.size });
}
