// Returns the calling operator's own tenant. Used by the dashboard to
// render the brand strip ("GHMC · Greater Hyderabad Municipal Corp.")
// and to scope downstream calls.
import { authOperator, getTenant, applyCors } from '../_lib.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  const op = await authOperator(req);
  if (!op) return res.status(401).json({ error: 'unauthorized' });
  const tenant = await getTenant(op.tenantId);
  if (!tenant) return res.status(404).json({ error: 'tenant not found' });
  return res.status(200).json({ tenant });
}
