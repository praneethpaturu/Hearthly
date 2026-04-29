// Vercel dynamic-route dispatcher for /api/tenants/*.
// Public URLs unchanged:
//   GET /api/tenants/list  → _list
//   GET /api/tenants/me    → _me
//   GET /api/tenants/wards → _wards
import list  from './_list.js';
import me    from './_me.js';
import wards from './_wards.js';

const handlers = { list, me, wards };

export default async function handler(req, res) {
  const action = (req.query?.action || '').toString();
  const fn = handlers[action];
  if (!fn) return res.status(404).json({ error: `unknown tenants action: ${action}` });
  return fn(req, res);
}
