import { STATE, OPERATORS_FALLBACK, supabaseConfigured, listHeartbeats, applyCors } from './_lib.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  let dbHealthy = false;
  if (supabaseConfigured()) {
    try {
      // Light probe: list heartbeats (already prunes stale + caps results).
      await listHeartbeats();
      dbHealthy = true;
    } catch { /* keep false */ }
  }
  // STATE shape since D1 v1: heartbeats is one Map keyed by
  // `${tenantId}:${deviceId}`, audit is a Map<tenantId → array>.
  let auditTotal = 0;
  if (STATE.auditLogByTenant) {
    for (const arr of STATE.auditLogByTenant.values()) auditTotal += arr.length;
  }
  return res.status(200).json({
    ok: true,
    runtime: 'vercel-serverless',
    storage: supabaseConfigured() ? (dbHealthy ? 'supabase' : 'supabase-degraded') : 'in-memory',
    heartbeats_inmem: STATE.heartbeats.size,
    audit_inmem: auditTotal,
    audit_tenants: STATE.auditLogByTenant?.size || 0,
    operators_fallback: OPERATORS_FALLBACK.size,
  });
}
