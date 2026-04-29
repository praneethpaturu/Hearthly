// A6 · find similar grievances within a tenant.
//
// Citizens / operators can ask "is anyone else reporting this?" before
// submitting a duplicate. Used by:
//   - citizen portal — debounced lookup as the user types the
//     description (planned in v2)
//   - operator queue — "similar to GRV-X" badge on rows that have a
//     near-twin (live in the dashboard via the existing list-merge)
//
// Body: { tenantId, text, excludeId?, limit?, minScore? }
//   tenantId: required
//   text:     required
//   excludeId: optional — exclude one id (caller's own row)
//   limit:    optional — 1..20, default 5
//   minScore: optional — 0..1 cosine threshold, default 0.45
//
// Response: { count, similar: [{id, category, description, status, score, createdAt, ...}] }
//
// No auth — tenant scoping is by the body parameter, same shape as
// /api/grievances/submit. Rate-limited per IP.
import {
  findSimilarGrievances,
  rateLimit, rateLimited, clientIp,
  readBody, applyCors,
} from '../_lib.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  // Rate limit: 30/min per IP. This is a debounced lookup as the
  // citizen types — a few keystrokes per second is fine.
  const ip = clientIp(req);
  const ipRl = rateLimit({ key: `similar:ip:${ip}`, limit: 30, windowMs: 60_000 });
  if (!ipRl.allowed) return rateLimited(res, ipRl);

  const body = readBody(req);
  if (!body.tenantId) return res.status(400).json({ error: 'tenantId required' });
  if (!body.text || typeof body.text !== 'string') return res.status(400).json({ error: 'text required' });

  const limit    = Math.min(20, Math.max(1, parseInt(body.limit || 5, 10) || 5));
  const minScore = Math.min(0.99, Math.max(0.1, parseFloat(body.minScore) || 0.45));

  let similar;
  try {
    similar = await findSimilarGrievances({
      tenantId: body.tenantId,
      text: body.text,
      excludeId: body.excludeId,
      limit,
      minScore,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'similar failed' });
  }

  return res.status(200).json({
    count: similar.length,
    similar: similar.map((g) => ({
      id: g.id,
      category: g.category,
      description: g.description,
      status: g.status,
      createdAt: g.createdAt,
      slaDueAt: g.slaDueAt,
      score: Math.round(g.score * 100) / 100,
    })),
  });
}
