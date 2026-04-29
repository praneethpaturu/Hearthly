// Operator-only GET — returns grievances scoped to the calling
// operator's tenant. The CMCC dashboard merges these into the legacy
// seed so a GHMC operator only sees GHMC tickets.
//
// Optional: ?status=open|assigned|resolved|rejected | ?limit=N (1..500)
import { authOperator, listGrievances, applyCors } from '../_lib.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

  const op = await authOperator(req);
  if (!op) return res.status(401).json({ error: 'unauthorized' });

  const url = new URL(req.url || '/', 'http://localhost');
  const status = url.searchParams.get('status') || undefined;
  const limitParam = parseInt(url.searchParams.get('limit') || '100', 10);
  const limit = Number.isFinite(limitParam) ? Math.min(500, Math.max(1, limitParam)) : 100;

  const grievances = await listGrievances({ tenantId: op.tenantId, status, limit });
  return res.status(200).json({
    tenantId: op.tenantId,
    count: grievances.length,
    grievances,
  });
}
