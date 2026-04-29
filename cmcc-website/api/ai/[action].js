// Vercel dynamic-route dispatcher for /api/ai/*.
// Public URLs unchanged:
//   POST /api/ai/chat       → _chat
//   POST /api/ai/transcribe → _transcribe
import chat       from './_chat.js';
import transcribe from './_transcribe.js';

const handlers = { chat, transcribe };

export default async function handler(req, res) {
  const action = (req.query?.action || '').toString();
  const fn = handlers[action];
  if (!fn) return res.status(404).json({ error: `unknown ai action: ${action}` });
  return fn(req, res);
}
