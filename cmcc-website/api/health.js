import { STATE, OPERATORS, applyCors } from './_lib.js';

export default function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  return res.status(200).json({
    ok: true,
    runtime: 'vercel-serverless',
    heartbeats: STATE.heartbeats.size,
    audit: STATE.auditLog.length,
    operators: OPERATORS.size,
  });
}
