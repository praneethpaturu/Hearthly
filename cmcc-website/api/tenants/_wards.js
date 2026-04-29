// Public read — wards within a tenant. Used by the citizen grievance
// form to render the ward picker after a ULB is selected.
//
//   GET /api/tenants/wards?tenant_id=ghmc
import { listWards, applyCors } from '../_lib.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

  const url = new URL(req.url || '/', 'http://localhost');
  const tenantId = url.searchParams.get('tenant_id') || url.searchParams.get('tenantId');
  if (!tenantId) return res.status(400).json({ error: 'tenant_id required' });

  const wards = await listWards({ tenantId });
  return res.status(200).json({ tenantId, wards });
}
