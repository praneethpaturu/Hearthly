import { authOperator, insertAudit, listAudit, readBody, applyCors } from '../_lib.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const op = await authOperator(req);
  if (!op) return res.status(401).json({ error: 'unauthorized' });

  if (req.method === 'POST') {
    const { action, target } = readBody(req);
    const entry = await insertAudit({ actor: op.name, action, target });
    return res.status(200).json(entry);
  }
  if (req.method === 'GET') {
    const rows = await listAudit(100);
    return res.status(200).json(rows);
  }
  return res.status(405).json({ error: 'method not allowed' });
}
