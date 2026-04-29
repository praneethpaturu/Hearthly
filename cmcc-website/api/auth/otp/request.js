import {
  getOperatorByPhone, isDemoMode, rateLimit, rateLimited, clientIp,
  readBody, applyCors,
} from '../../_lib.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const { phone } = readBody(req);
  if (!phone || !/^\+91\d{10}$/.test(phone)) {
    return res.status(400).json({ error: 'phone must be +91XXXXXXXXXX' });
  }

  // Rate limit: 3 per 5 min per phone, 30 per hour per IP. Stops a
  // bored attacker from enumerating the operator allow-list.
  const ip = clientIp(req);
  const phoneRl = rateLimit({ key: `otp:phone:${phone}`, limit: 3, windowMs: 5 * 60_000 });
  if (!phoneRl.allowed) return rateLimited(res, phoneRl);
  const ipRl = rateLimit({ key: `otp:ip:${ip}`, limit: 30, windowMs: 60 * 60_000 });
  if (!ipRl.allowed) return rateLimited(res, ipRl);

  const op = await getOperatorByPhone(phone);
  if (!op) {
    return res.status(403).json({
      error: 'CMCC is for operators only — your number is not on the operator allow-list',
    });
  }

  // In demo mode, return the demo OTP so the auto-fill UX works.
  // In safe-prod mode, do NOT leak the bypass code; production deploys
  // must wire a real SMS provider before going live (see SECURITY.md
  // "Production hardening checklist").
  if (isDemoMode()) {
    return res.status(200).json({ ok: true, demoOtp: '123456' });
  }
  // Real-prod path: no SMS provider integration yet, so refuse rather
  // than silently lock the operator out without ever sending an SMS.
  return res.status(503).json({
    error: 'OTP service not configured for this deployment — set DEMO_MODE=1 for the demo, or wire MSG91/Twilio',
  });
}
