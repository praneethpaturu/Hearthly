// Vercel dynamic-route dispatcher for /api/grievances/*.
// Counts as ONE serverless function on the Hobby tier; the four
// underscore-prefixed handler files (_list, _submit, _update,
// _similar) are not exposed as functions but provide the actual
// request handling.
//
// Public URLs unchanged:
//   POST /api/grievances/submit  → _submit
//   GET  /api/grievances/list    → _list
//   POST /api/grievances/update  → _update
//   POST /api/grievances/similar → _similar
import list    from './_list.js';
import submit  from './_submit.js';
import update  from './_update.js';
import similar from './_similar.js';

const handlers = { list, submit, update, similar };

export default async function handler(req, res) {
  const action = (req.query?.action || '').toString();
  const fn = handlers[action];
  if (!fn) return res.status(404).json({ error: `unknown grievances action: ${action}` });
  return fn(req, res);
}
