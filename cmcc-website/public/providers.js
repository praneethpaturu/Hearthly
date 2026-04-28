// Minimal providers used by dashboard.js / dashboard-pro.js.
// Push notifications, OpenAI relay (frontend keeps the key in localStorage,
// same pattern as mobile). Other providers from the mobile app (sms,
// payments, storage, calls, kyc, ai) aren't needed in CMCC.

window.providers = (() => {
  const nid = () => Math.random().toString(36).slice(2, 12);
  const PUSH_STORE = 'vl_cmcc_push';
  function _read() { try { return JSON.parse(localStorage.getItem(PUSH_STORE) || '[]'); } catch { return []; } }
  function _write(arr) { localStorage.setItem(PUSH_STORE, JSON.stringify(arr.slice(0, 100))); }

  const push = {
    show(title, body, opts = {}) {
      const tr = (window.api && window.api.tr) ? window.api.tr : (s) => s;
      const tTitle = tr(title);
      const tBody  = tr(body);
      const note = { id: nid(), title: tTitle, body: tBody, icon: opts.icon || 'notifications', at: Date.now(), read: false };
      const arr = _read(); arr.unshift(note); _write(arr);
      window.dispatchEvent(new CustomEvent('vl:push', { detail: note }));
      const n = document.createElement('div');
      n.className = 'push';
      n.innerHTML = `
        <div class="push-icon">${note.icon}</div>
        <div class="push-body">
          <div class="push-title">${tTitle}</div>
          <div class="push-text">${tBody}</div>
        </div>
        <div class="push-tag">CMCC</div>`;
      document.body.appendChild(n);
      requestAnimationFrame(() => n.classList.add('show'));
      const close = () => { n.classList.remove('show'); setTimeout(() => n.remove(), 300); };
      n.onclick = () => { opts.onClick?.(); close(); };
      setTimeout(close, opts.duration || 4500);
    },
    list() { return _read(); },
    unread() { return _read().filter((n) => !n.read).length; },
    markAllRead() { _write(_read().map((n) => ({ ...n, read: true }))); window.dispatchEvent(new CustomEvent('vl:push', { detail: null })); },
    clear() { _write([]); window.dispatchEvent(new CustomEvent('vl:push', { detail: null })); },
  };

  // OpenAI — two-tier: user's localStorage key (direct OpenAI) or
  // the Hearthly server-side proxy (/api/ai/*) holding the key in env.
  const openai = {
    KEY_STORE: 'vl_cmcc_openai_key',
    PROXY_BASE: '/api/ai',
    getKey() { return localStorage.getItem(this.KEY_STORE) || ''; },
    setKey(k) { if (k) localStorage.setItem(this.KEY_STORE, k); else localStorage.removeItem(this.KEY_STORE); },
    _proxyAvailable() {
      const h = (typeof location !== 'undefined') ? location.hostname : '';
      return h !== 'localhost' && h !== '127.0.0.1' && h !== '';
    },
    hasKey() { return !!this.getKey() || this._proxyAvailable(); },
    async _post(path, body) {
      const userKey = this.getKey();
      const url = userKey ? ('https://api.openai.com/v1' + path) : (this.PROXY_BASE + path.replace('/chat/completions', '/chat'));
      const headers = { 'Content-Type': 'application/json' };
      if (userKey) headers.Authorization = 'Bearer ' + userKey;
      const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      if (!r.ok) throw new Error('OpenAI: ' + r.status);
      return r.json();
    },
    async chat(messages, opts = {}) {
      return this._post('/chat/completions', {
        model: opts.model || 'gpt-4o-mini', messages,
        temperature: opts.temperature ?? 0.2, max_tokens: opts.max_tokens ?? 600,
        response_format: opts.json ? { type: 'json_object' } : undefined,
      });
    },
    async transcribe(audioBlob, language = 'en') {
      const userKey = this.getKey();
      const fd = new FormData(); fd.append('file', audioBlob, 'recording.webm');
      fd.append('model', 'whisper-1'); fd.append('language', language);
      const url = userKey ? 'https://api.openai.com/v1/audio/transcriptions' : (this.PROXY_BASE + '/transcribe');
      const headers = userKey ? { Authorization: 'Bearer ' + userKey } : {};
      const r = await fetch(url, { method: 'POST', headers, body: fd });
      if (!r.ok) throw new Error('Whisper: ' + r.status);
      return r.json();
    },
    async answerAdmin(q, snap) {
      const sys = 'You are an analyst for a residential valet-services platform. Answer concisely (<=120 words) using the JSON snapshot.';
      const r = await this.chat([
        { role: 'system', content: sys },
        { role: 'user', content: 'Snapshot: ' + JSON.stringify(snap).slice(0, 12000) + '\n\nQuestion: ' + q },
      ], { temperature: 0.3, max_tokens: 500 });
      return r.choices[0].message.content;
    },
  };

  // Stub provider needed by dashboard-pro.js for ui.scheduleOta call etc.
  const calls   = { mask: (p) => p ? p.replace(/(\+\d{2})(\d{3})(\d{4})(\d{3})/, '$1-XXX-XXXX-$4') : '' };
  const storage = { fetchUrl: () => null };

  return { push, openai, calls, storage };
})();
