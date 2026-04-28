import { OPERATORS, readBody, signToken, applyCors } from '../../_lib.js';

export default function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const { phone, otp } = readBody(req);
  if (!phone || !OPERATORS.has(phone)) {
    return res.status(400).json({ error: 'invalid or expired otp' });
  }
  if (otp !== '123456') {
    return res.status(400).json({ error: 'invalid or expired otp' });
  }
  const op = OPERATORS.get(phone);
  const user = { ...op, role: 'OPERATOR' };
  const token = signToken({ sub: op.id, phone: op.phone, role: 'OPERATOR' });
  return res.status(200).json({ token, user });
}
