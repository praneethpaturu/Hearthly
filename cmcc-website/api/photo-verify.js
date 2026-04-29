// A3 · photo-evidence verification.
//
// Worker / citizen captures a photo → client computes pHash + extracts
// EXIF → posts here → we run dedup + tamper checks against the same
// tenant's recent photo ledger and return a verdict the UI can show.
//
// Body:
//   {
//     tenantId:   required
//     workerId?:  optional — narrows duplicate-detection to one worker
//     grievanceId?: optional — links the hash to a specific ticket
//     hash:       required — 16-hex-char pHash from /phash.js
//     takenAt?:   optional — EXIF DateTimeOriginal as ms since epoch
//     lat?, lng?: optional — EXIF GPS in decimal degrees
//     claimedLat?, claimedLng?: optional — citizen-reported location
//   }
//
// Response:
//   {
//     verdict: 'ok' | 'suspect_duplicate' | 'suspect_tamper'
//     flags:   string[]                            // human-readable
//     hammingMin?: number                          // closest match
//     similarTo?: { grievanceId, workerId, recordedAt, hammingDistance }
//     confidence: 0..1                             // 1.0 = clean
//     hash: string                                 // echo
//   }
//
// No auth — workers are anonymous device-identified. Tenant routing is
// caller-supplied for v1; in production this comes from worker JWT.
import {
  recordPhotoHash, findSimilarPhotoHashes,
  hammingHex, haversineKm,
  readBody, applyCors,
} from './_lib.js';

const DEDUP_HARD_THRESHOLD = 5;   // ≤5/64 bits differ → duplicate (very strong)
const DEDUP_SOFT_THRESHOLD = 10;  // ≤10/64 → similar (worth flagging)
const TAMPER_LOCATION_KM   = 5;   // photo > 5 km from claimed location → tamper
const TAMPER_AGE_HOURS     = 24;  // EXIF older than 24 h → tamper (re-uploaded?)

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const body = readBody(req);
  if (!body.hash || typeof body.hash !== 'string') {
    return res.status(400).json({ error: 'hash required' });
  }
  if (!/^[0-9a-f]{16}$/i.test(body.hash)) {
    return res.status(400).json({ error: 'hash must be 16 lowercase hex chars' });
  }
  if (!body.tenantId) return res.status(400).json({ error: 'tenantId required' });

  const flags = [];
  let verdict = 'ok';
  let confidence = 1.0;

  // ── 1. Dedup against this tenant's recent ledger ────────────────────
  const matches = findSimilarPhotoHashes({
    tenantId: body.tenantId,
    hash: body.hash,
    hours: 24,
    threshold: DEDUP_SOFT_THRESHOLD,
  });
  // Filter to "different submission" — same grievanceId is the worker
  // re-submitting their own photo, not a fraud signal.
  const otherMatches = matches.filter((m) =>
    !body.grievanceId || m.grievanceId !== body.grievanceId
  );
  const closest = otherMatches[0];
  let hammingMin;
  if (closest) {
    hammingMin = closest.hammingDistance;
    if (closest.hammingDistance <= DEDUP_HARD_THRESHOLD) {
      verdict = 'suspect_duplicate';
      flags.push(`Same photo (or near-identical) submitted ${closest.workerId === body.workerId ? 'by this worker' : 'by another worker'} ${humanAge(closest.recordedAt)} ago — hamming ${closest.hammingDistance}/64`);
      confidence = 0.05;
    } else if (closest.hammingDistance <= DEDUP_SOFT_THRESHOLD) {
      flags.push(`Similar photo seen ${humanAge(closest.recordedAt)} ago — hamming ${closest.hammingDistance}/64 (review)`);
      if (verdict === 'ok') confidence = Math.min(confidence, 0.55);
    }
  }

  // ── 2. EXIF age check ──────────────────────────────────────────────
  if (Number.isFinite(body.takenAt)) {
    const ageH = (Date.now() - body.takenAt) / 3600000;
    if (ageH > TAMPER_AGE_HOURS) {
      flags.push(`Photo EXIF says taken ${ageH.toFixed(1)}h ago — too old for fresh evidence`);
      if (verdict === 'ok') verdict = 'suspect_tamper';
      confidence = Math.min(confidence, 0.2);
    } else if (ageH < -0.5) {
      flags.push(`Photo EXIF is dated in the future (camera clock skew?) — ${Math.abs(ageH).toFixed(1)}h ahead`);
      confidence = Math.min(confidence, 0.6);
    }
  } else {
    flags.push('No EXIF DateTimeOriginal — likely screenshot or stripped-metadata image');
    confidence = Math.min(confidence, 0.7);
  }

  // ── 3. GPS-vs-claim check ──────────────────────────────────────────
  if (Number.isFinite(body.lat) && Number.isFinite(body.lng) &&
      Number.isFinite(body.claimedLat) && Number.isFinite(body.claimedLng)) {
    const km = haversineKm(body.lat, body.lng, body.claimedLat, body.claimedLng);
    if (km > TAMPER_LOCATION_KM) {
      flags.push(`Photo GPS is ${km.toFixed(1)} km from claimed location`);
      if (verdict === 'ok') verdict = 'suspect_tamper';
      confidence = Math.min(confidence, 0.25);
    }
  } else if (!Number.isFinite(body.lat) || !Number.isFinite(body.lng)) {
    // No GPS in EXIF — common (privacy-stripped). Not a hard fail.
    flags.push('No GPS in photo metadata');
    confidence = Math.min(confidence, 0.85);
  }

  // ── 4. Record the hash so future photos can be compared ────────────
  recordPhotoHash({
    tenantId: body.tenantId,
    workerId: body.workerId,
    grievanceId: body.grievanceId,
    hash: body.hash,
    takenAt: body.takenAt,
    lat: body.lat,
    lng: body.lng,
  });

  return res.status(200).json({
    verdict,
    flags,
    hammingMin,
    similarTo: closest ? {
      grievanceId: closest.grievanceId,
      workerId: closest.workerId,
      recordedAt: closest.recordedAt,
      hammingDistance: closest.hammingDistance,
    } : null,
    confidence,
    hash: body.hash,
  });
}

function humanAge(ms) {
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return `${s.toFixed(0)}s`;
  if (s < 3600) return `${(s / 60).toFixed(0)}m`;
  if (s < 86400) return `${(s / 3600).toFixed(1)}h`;
  return `${(s / 86400).toFixed(1)}d`;
}
