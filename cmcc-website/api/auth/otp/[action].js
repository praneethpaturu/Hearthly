// Vercel dynamic-route dispatcher for /api/auth/otp/*.
// Public URLs unchanged:
//   POST /api/auth/otp/request → _request
//   POST /api/auth/otp/verify  → _verify
import request from './_request.js';
import verify  from './_verify.js';

const handlers = { request, verify };

export default async function handler(req, res) {
  const action = (req.query?.action || '').toString();
  const fn = handlers[action];
  if (!fn) return res.status(404).json({ error: `unknown otp action: ${action}` });
  return fn(req, res);
}
