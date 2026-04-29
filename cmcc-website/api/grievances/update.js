// Operator-only POST — assign / resolve / reject a grievance.
// Tenant-scoped: an operator from tenant A cannot touch a grievance
// belonging to tenant B (enforced both by passing op.tenantId into
// updateGrievance and by the WHERE tenant_id = ... clause inside).
//
// Body: { id, status?, assignedTo?, resolvedNote? }
//   id:           required (GRV-...)
//   status:       optional; one of 'open' | 'assigned' | 'resolved' | 'rejected'
//   assignedTo:   optional; operator/worker id to attach
//   resolvedNote: optional; free text recorded with the action
import { authOperator, updateGrievance, insertAudit, readBody, applyCors } from '../_lib.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const op = await authOperator(req);
  if (!op) return res.status(401).json({ error: 'unauthorized' });

  const body = readBody(req);
  if (!body.id) return res.status(400).json({ error: 'id required' });

  let updated;
  try {
    updated = await updateGrievance({
      id: body.id,
      tenantId: op.tenantId,                    // tenant guard
      status: body.status,
      assignedTo: body.assignedTo,
      resolvedNote: body.resolvedNote,
    });
  } catch (e) {
    return res.status(400).json({ error: e.message || 'update failed' });
  }
  if (!updated) {
    // Either the id doesn't exist, or it belongs to a different tenant.
    // Both cases look the same to the caller — no information leak.
    return res.status(404).json({ error: 'grievance not found in your tenant' });
  }

  // Audit-log the operator's action, scoped to their tenant.
  await insertAudit({
    actor: op.name,
    action: 'grievance:' + (body.status || 'update'),
    target: body.id,
    tenantId: op.tenantId,
  });

  return res.status(200).json({ ok: true, grievance: updated });
}
