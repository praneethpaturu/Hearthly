import { STATE, authOperator, readBody, applyCors } from '../_lib.js';

export default function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const op = authOperator(req);
  if (!op) return res.status(401).json({ error: 'unauthorized' });

  if (req.method === 'POST') {
    const { action, target } = readBody(req);
    const entry = {
      id: 'au' + Date.now(),
      actor: op.name,
      action,
      target,
      when: Date.now(),
    };
    STATE.auditLog.unshift(entry);
    if (STATE.auditLog.length > 500) STATE.auditLog.length = 500;
    return res.status(200).json(entry);
  }
  if (req.method === 'GET') {
    return res.status(200).json(STATE.auditLog.slice(0, 100));
  }
  return res.status(405).json({ error: 'method not allowed' });
}
