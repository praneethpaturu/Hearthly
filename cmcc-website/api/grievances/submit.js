// Public POST — citizen grievance ingestion. The citizen portal
// submits here; the same endpoint will later be reused by the WhatsApp
// inbound webhook (A2) and IVR / missed-call workers.
//
// Tenant routing:
//   - tenantId is required (citizen portal picks via the new ULB
//     dropdown; WhatsApp inbound infers from the recipient number).
//   - wardId is optional — submissions without a ward go to a
//     statewide triage queue.
//
// No auth: citizens are anonymous by default. Per-citizen rate
// limiting is a follow-up (TODO: tie to citizenPhone + IP).
import { submitGrievance, readBody, applyCors } from '../_lib.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const body = readBody(req);
  if (!body.tenantId) return res.status(400).json({ error: 'tenantId required' });
  if (!body.category) return res.status(400).json({ error: 'category required' });

  try {
    const grievance = await submitGrievance({
      tenantId: body.tenantId,
      wardId: body.wardId,
      category: body.category,
      description: body.description,
      citizenPhone: body.citizenPhone,
      language: body.language,
      channel: body.channel || 'web',
      severity: body.severity,
      title: body.title,
      mediaUrl: body.mediaUrl,
      lat: body.lat,
      lng: body.lng,
    });
    return res.status(200).json({ ok: true, grievance });
  } catch (e) {
    return res.status(400).json({ error: e.message || 'submit failed' });
  }
}
