// Public read — list of active tenants for the future tenant-picker
// UI. Sensitive ops continue to require an operator-scoped token.
import { listTenants, applyCors } from '../_lib.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  const tenants = await listTenants();
  return res.status(200).json({ tenants });
}
