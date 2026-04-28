import { authOperator, applyCors } from './_lib.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

  const op = await authOperator(req);
  if (!op) return res.status(401).json({ error: 'unauthorized' });
  return res.status(200).json(op);
}
