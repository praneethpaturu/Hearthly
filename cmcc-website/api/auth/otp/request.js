import { OPERATORS, readBody, applyCors } from '../../_lib.js';

export default function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const { phone } = readBody(req);
  if (!phone || !/^\+91\d{10}$/.test(phone)) {
    return res.status(400).json({ error: 'phone must be +91XXXXXXXXXX' });
  }
  if (!OPERATORS.has(phone)) {
    return res.status(403).json({
      error: 'CMCC is for operators only — your number is not on the operator allow-list',
    });
  }
  // Demo: fixed OTP. No persistence needed because verify() also accepts
  // '123456' for any allow-listed phone.
  return res.status(200).json({ ok: true, demoOtp: '123456' });
}
