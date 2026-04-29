// WhatsApp inbound — A2 scaffolding.
//
// Accepts two payload shapes so the same path serves both a real BSP
// and the local simulator:
//
//   1. Meta WhatsApp Business webhook (full envelope):
//      { entry: [{ changes: [{ value: { messages: [...], metadata: {...} } }] }] }
//
//   2. Flat dev shape (the simulator + Gupshup-normalised webhooks):
//      { from, to, text, mediaUrl?, language?, name? }
//
// Either shape produces a tenant-scoped grievance via submitGrievance.
// Tenant routing: derived from the recipient phone (each ULB owns its
// own WhatsApp number — see TENANTS_FALLBACK.whatsappNumber).
//
// Category classification: keyword-based across EN / HI / TE for v1.
// Deterministic, free, runs in <1 ms. Upgrade path: route to A1's
// LLM/VLM intent extractor once that ships.
//
// This endpoint does NOT yet verify the X-Hub-Signature-256 header
// from Meta; production deployments must add that before publishing
// the URL into Meta's webhook console. Documented in IP-SAFETY.md.

import {
  submitGrievance, tenantIdForWhatsappNumber,
  rateLimit, rateLimited, clientIp,
  readBody, applyCors,
} from '../_lib.js';

// ── Category classifier (EN / HI / TE keyword map) ──────────────────
// Order matters: first match wins. Keep specific terms before generic
// ones (e.g. 'pothole' before 'road').
const CAT_KEYWORDS = [
  ['garbage',     ['garbage','dustbin','bin','trash','waste','collection','కచరా','చెత్త','కుండీ','चिप्स','कचरा','कूड़ा','डस्टबिन','सफाई']],
  ['water',       ['water','tap','supply','leak','pipe','నీరు','నీటి','कूत','पानी','सप्लाई','नल','लीक']],
  ['streetlight', ['streetlight','street light','lamp','dark','లైట్','దీపం','लाइट','स्ट्रीटलाइट','बत्ती']],
  ['roads',       ['pothole','road','potholes','గుంట','రోడ్','सड़क','गड्ढा']],
  ['sewage',      ['sewage','drain','manhole','blocked','మురుగు','डायरेक्ट','नाली','मैनहोल','सीवर']],
  ['mosquito',    ['mosquito','dengue','fogging','దోమ','मच्छर','डेंगू','मलेरिया']],
  ['stray',       ['stray dog','stray','dog','cattle','కుక్క','कुत्ता','मवेशी','गाय']],
  ['encroachment',['encroach','footpath','vendor','hawker','అతిక్రమ','अतिक्रमण','फुटपाथ','हॉकर']],
];

function classify(text) {
  if (!text) return 'other';
  const t = String(text).toLowerCase();
  for (const [cat, kws] of CAT_KEYWORDS) {
    for (const kw of kws) if (t.includes(kw.toLowerCase())) return cat;
  }
  return 'other';
}

// Crude language hint from script ranges. Good enough to tag the row;
// real ASR will overwrite when A1 ships.
function detectLanguage(text) {
  if (!text) return 'en';
  if (/[ఀ-౿]/.test(text)) return 'te'; // Telugu
  if (/[ऀ-ॿ]/.test(text)) return 'hi'; // Devanagari (Hindi)
  if (/[؀-ۿ]/.test(text)) return 'ur'; // Arabic / Urdu
  return 'en';
}

// Normalise a Meta webhook envelope into the flat dev shape.
// Returns { from, to, text, mediaUrl, name } or null if it's not a
// recognisable text/media message (e.g. status callbacks).
function normaliseMeta(body) {
  try {
    const change = body?.entry?.[0]?.changes?.[0];
    const value  = change?.value;
    const msg    = value?.messages?.[0];
    if (!msg) return null;
    const meta   = value?.metadata || {};
    const contact = value?.contacts?.[0];
    let text = '';
    if (msg.type === 'text') text = msg.text?.body || '';
    else if (msg.type === 'image') text = msg.image?.caption || '';
    else if (msg.type === 'audio') text = '[voice note — pending ASR]';
    else if (msg.type === 'location') text = `[location ${msg.location?.latitude},${msg.location?.longitude}]`;
    return {
      from: msg.from ? '+' + msg.from.replace(/^\+?/, '') : '',
      to: meta.display_phone_number ? '+' + meta.display_phone_number.replace(/^\+?/, '') : '',
      text,
      mediaUrl: msg.image?.id || msg.audio?.id || null,
      name: contact?.profile?.name || null,
      lat: msg.location?.latitude,
      lng: msg.location?.longitude,
    };
  } catch { return null; }
}

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Meta verification handshake — they GET ?hub.mode=subscribe with a
  // verify token. Production deploys must set WA_VERIFY_TOKEN; the
  // demo just echoes back so the simulator can be sanity-tested.
  if (req.method === 'GET') {
    const url = new URL(req.url || '/', 'http://localhost');
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const expected = process.env.WA_VERIFY_TOKEN || 'demo-verify-token';
    if (mode === 'subscribe' && token === expected) {
      res.setHeader('Content-Type', 'text/plain');
      return res.status(200).send(challenge || '');
    }
    return res.status(403).json({ error: 'verify token mismatch' });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  // Rate limit: 120/min per IP. A real BSP webhook is a small, known
  // set of source IPs and bursts during peak hours, so this is loose.
  // The simulator (one human clicking) lives well under the cap.
  const ipRl = rateLimit({ key: `wa:ip:${clientIp(req)}`, limit: 120, windowMs: 60_000 });
  if (!ipRl.allowed) return rateLimited(res, ipRl);

  const body = readBody(req);

  // Try Meta envelope first; fall back to flat dev shape.
  let msg = normaliseMeta(body);
  if (!msg) {
    msg = {
      from: body.from || body.citizenPhone || '',
      to:   body.to   || body.tenantNumber || '',
      text: body.text || body.message || body.description || '',
      mediaUrl: body.mediaUrl || null,
      name: body.name || null,
      lat: body.lat,
      lng: body.lng,
    };
  }

  // Validate the minimum we need to make a grievance.
  if (!msg.from && !msg.text) {
    // Still return 200 — Meta retries 4xx for hours. Empty payloads
    // are usually status callbacks; treat as no-op.
    return res.status(200).json({ ok: true, ignored: 'no message body' });
  }

  // Tenant routing from recipient number.
  const tenantId = tenantIdForWhatsappNumber(msg.to);
  const language = body.language || detectLanguage(msg.text);
  const category = body.category || classify(msg.text);

  let grievance;
  try {
    grievance = await submitGrievance({
      tenantId,
      wardId: body.wardId || null,                // BSP can pre-resolve from location
      category,
      description: msg.text || '[empty]',
      citizenPhone: msg.from,
      language,
      channel: 'whatsapp',
      severity: body.severity || 'normal',
      title: (msg.text || category).slice(0, 200),
      mediaUrl: msg.mediaUrl,
      lat: Number.isFinite(msg.lat) ? msg.lat : (Number.isFinite(body.lat) ? body.lat : null),
      lng: Number.isFinite(msg.lng) ? msg.lng : (Number.isFinite(body.lng) ? body.lng : null),
    });
  } catch (e) {
    // 200 to avoid Meta retry storm; log the error.
    console.warn('[wa-inbound] submitGrievance threw:', e.message);
    return res.status(200).json({ ok: false, error: e.message });
  }

  // The reply text the BSP would render back to the citizen. Keep it
  // short — Meta charges per conversation, and Telugu/Hindi text is
  // shorter than the English equivalent.
  const reply = {
    en: `✓ Received. Tracking ID: ${grievance.id}. Reply STATUS to check.`,
    hi: `✓ प्राप्त हुआ। ट्रैकिंग ID: ${grievance.id}. STATUS भेजें स्थिति जानने के लिए।`,
    te: `✓ స్వీకరించబడింది. ట్రాకింగ్ ID: ${grievance.id}. స్థితి తెలుసుకోవడానికి STATUS పంపండి.`,
    ur: `✓ موصول ہوا۔ ٹریکنگ آئی ڈی: ${grievance.id}۔ حیثیت کے لیے STATUS بھیجیں۔`,
  }[language] || `✓ Received. Tracking ID: ${grievance.id}.`;

  return res.status(200).json({
    ok: true,
    grievance,
    routedTenantId: tenantId,
    classified: { category, language },
    reply,
  });
}
