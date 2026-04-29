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
import { submitGrievance, rateLimit, rateLimited, clientIp, readBody, applyCors } from '../_lib.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const body = readBody(req);
  if (!body.tenantId) return res.status(400).json({ error: 'tenantId required' });
  if (!body.category) return res.status(400).json({ error: 'category required' });

  // Rate limit: 5 submissions/min per IP and per phone (when given).
  // Stops a citizen reporting the same pothole 50 times in a tantrum,
  // and stops a bot from flooding a tenant's queue. Phone-key rate
  // limit only applies when a phone is provided — anonymous reporters
  // get IP-based throttling only.
  const ip = clientIp(req);
  const ipRl = rateLimit({ key: `submit:ip:${ip}`, limit: 5, windowMs: 60_000 });
  if (!ipRl.allowed) return rateLimited(res, ipRl);
  if (body.citizenPhone) {
    const phoneRl = rateLimit({ key: `submit:phone:${body.citizenPhone}`, limit: 10, windowMs: 60_000 });
    if (!phoneRl.allowed) return rateLimited(res, phoneRl);
  }

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
