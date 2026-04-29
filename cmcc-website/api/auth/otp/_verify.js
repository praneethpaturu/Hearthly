import {
  getOperatorByPhone, isDemoMode, rateLimit, rateLimited, clientIp,
  readBody, signToken, applyCors,
} from '../../_lib.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const { phone, otp } = readBody(req);

  // Rate limit: 5 verify attempts per 5 min per phone, 60/hour per IP.
  // Tighter than /request because this is the brute-force surface.
  const ip = clientIp(req);
  const phoneRl = rateLimit({ key: `verify:phone:${phone}`, limit: 5, windowMs: 5 * 60_000 });
  if (!phoneRl.allowed) return rateLimited(res, phoneRl);
  const ipRl = rateLimit({ key: `verify:ip:${ip}`, limit: 60, windowMs: 60 * 60_000 });
  if (!ipRl.allowed) return rateLimited(res, ipRl);

  // OTP gate. In demo mode the fixed '123456' works; in safe-prod
  // mode we'd verify against a stored OTP from a real SMS provider.
  // Production deploys without a provider get 503, not "invalid OTP",
  // so operators don't get cryptic auth failures.
  if (isDemoMode()) {
    if (otp !== '123456') {
      return res.status(400).json({ error: 'invalid or expired otp' });
    }
  } else {
    // No real OTP store wired yet. Refuse explicitly.
    return res.status(503).json({
      error: 'OTP verify not configured for this deployment — set DEMO_MODE=1 for the demo, or wire MSG91/Twilio',
    });
  }

  const op = await getOperatorByPhone(phone);
  if (!op) return res.status(400).json({ error: 'invalid or expired otp' });

  const user = { ...op, role: 'OPERATOR' };
  const token = signToken({ sub: op.id, phone: op.phone, role: 'OPERATOR', tenantId: op.tenantId });
  return res.status(200).json({ token, user });
}
