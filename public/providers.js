// ─────────────────────────────────────────────────────────────────────
// Provider modules — swappable interfaces for every external system.
//
// Every provider object below mirrors the shape of the real SDK it
// stands in for. To productionize, replace one provider at a time with
// the real implementation; UI code does not change.
//
//   sms       → MSG91 (DLT-approved templates)
//   payments  → Razorpay UPI Orders + Webhooks
//   storage   → AWS S3 (presigned PUT)
//   calls     → Exotel (call masking)
//   push      → Firebase Cloud Messaging
//   kyc       → Digio
//   maps      → Google Maps Distance Matrix
//   ai        → in-house ML mocks (anomaly, predictive, ETA, recos)
//   openai    → OpenAI (Whisper, gpt-4o-mini, vision) — uses key from
//               localStorage entered via Settings; falls back to mock.
// ─────────────────────────────────────────────────────────────────────

window.providers = (() => {
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const nid = () => Math.random().toString(36).slice(2, 12);
  const now = () => new Date().toISOString();

  // ── SMS / OTP delivery (MSG91 mock) ──────────────────────────────────
  const sms = {
    // Real call:  POST https://api.msg91.com/api/v5/otp  with template_id
    async sendOtp(phone, lang = 'EN') {
      await delay(700);
      const tpl = { EN: 'OTP_EN_TEMPL_ID', HI: 'OTP_HI_TEMPL_ID', TE: 'OTP_TE_TEMPL_ID' }[lang] || 'OTP_EN_TEMPL_ID';
      console.log('[SMS:msg91] template=%s to=%s', tpl, phone);
      return {
        request_id: 'req_' + nid(),
        provider: 'MSG91',
        template: tpl,
        otp: '123456', // demo only — real returns nothing
        deliveredAt: now(),
      };
    },
    async verifyOtp(phone, otp) {
      await delay(300);
      return { type: 'success' };
    },
  };

  // ── Payments (Razorpay UPI mock) ─────────────────────────────────────
  // Real:
  //   1) Backend: POST /v1/orders { amount, currency: 'INR' } → { id }
  //   2) Frontend: new Razorpay(opts).open()
  //   3) Webhook: payment.captured / payment.failed (HMAC-signed)
  //   4) Backend: idempotent reconciliation
  const payments = {
    async createOrder(amountPaise, ourOrderId) {
      await delay(350);
      return {
        id: 'order_' + nid(),
        amount: amountPaise,
        currency: 'INR',
        status: 'created',
        receipt: ourOrderId,
        upi: `upi://pay?pa=hearthly@upi&pn=Valet%20Living&am=${amountPaise / 100}&tn=${encodeURIComponent('Order ' + ourOrderId)}&cu=INR`,
      };
    },
    // Returns a promise that resolves with the payment, mirrors Checkout
    async openCheckout(rzpOrder, opts = {}) {
      return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'sheet-overlay open';
        overlay.innerHTML = `
          <div class="sheet" style="max-width: 460px;">
            <div class="grip"></div>
            <div style="display:flex; align-items:center; gap:10px; margin-bottom: 8px;">
              <div style="width:36px; height:36px; border-radius:10px; background:#0d2240; color:#fff; display:grid; place-items:center; font-weight:800;">R</div>
              <div>
                <div style="font-weight:800;">Razorpay</div>
                <div style="font-size:12px; color: var(--muted);">Secure UPI checkout</div>
              </div>
              <div style="flex:1;"></div>
              <span class="badge in_progress">UPI</span>
            </div>
            <div class="card" style="background:linear-gradient(135deg,#f8fafc,#eef2ff); margin-bottom:14px;">
              <div style="display:flex; justify-content:space-between; align-items:baseline;">
                <div>
                  <div class="muted" style="font-size:11px;">PAYING TO</div>
                  <div style="font-weight:700;">Hearthly</div>
                </div>
                <div style="text-align:right;">
                  <div class="muted" style="font-size:11px;">AMOUNT</div>
                  <div style="font-size:22px; font-weight:800;">₹ ${(rzpOrder.amount / 100).toFixed(0)}</div>
                </div>
              </div>
              <div class="muted" style="font-size:11px; margin-top:8px; word-break: break-all;">
                Order id: ${rzpOrder.id}
              </div>
            </div>
            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; margin-bottom: 12px;">
              ${['GPay','PhonePe','Paytm','BHIM'].map((m) =>
                `<button class="btn ghost sm" data-app="${m}" style="display:flex; flex-direction:column; gap:4px; padding:10px 6px;"><span style="font-weight:800;">${m[0]}</span><span style="font-size:11px;">${m}</span></button>`
              ).join('')}
            </div>
            <button class="btn cta block" id="payNow">Pay ₹ ${(rzpOrder.amount / 100).toFixed(0)}</button>
            <div style="height:8px;"></div>
            <button class="btn ghost block" id="payCancel">Cancel</button>
            <div class="muted" style="font-size:10px; text-align:center; margin-top:10px;">PCI-DSS · DPDP Act 2023 compliant · ap-south-1</div>
          </div>`;
        document.body.appendChild(overlay);
        let chosen = 'GPay';
        overlay.querySelectorAll('[data-app]').forEach((b) => b.onclick = () => {
          overlay.querySelectorAll('[data-app]').forEach((x) => x.style.borderColor = 'var(--line)');
          b.style.borderColor = 'var(--brand)';
          chosen = b.dataset.app;
        });
        const close = (v) => { overlay.remove(); resolve(v); };
        overlay.querySelector('#payCancel').onclick = () => { opts.onCancel?.(); close({ status: 'cancelled' }); };
        overlay.querySelector('#payNow').onclick = async () => {
          overlay.querySelector('#payNow').textContent = 'Verifying signature…';
          overlay.querySelector('#payNow').disabled = true;
          await delay(900);
          const result = {
            status: 'captured',
            payment_id: 'pay_' + nid(),
            order_id: rzpOrder.id,
            amount: rzpOrder.amount,
            method: 'upi',
            vpa: chosen.toLowerCase() + '@oksbi',
            captured_at: now(),
            signature: 'mock_hmac_' + nid(),
          };
          opts.onSuccess?.(result);
          close(result);
        };
      });
    },
    async refund(paymentId, amountPaise) {
      await delay(700);
      return { id: 'rfnd_' + nid(), payment_id: paymentId, amount: amountPaise, status: 'processed' };
    },
    // In production: POST /api/payments/webhook with X-Razorpay-Signature header.
    verifyWebhookSignature(_payload, _signature, _secret) { return true; },
  };

  // ── Storage (S3 presigned-PUT mock) ──────────────────────────────────
  const storage = {
    async getPresignedPut(key, contentType = 'image/jpeg') {
      await delay(180);
      return {
        uploadUrl: `https://valet-media.s3.ap-south-1.amazonaws.com/${key}?X-Amz-Signature=mock`,
        publicUrl: `https://cdn.hearthly.in/${key}`,
        key,
        expiresIn: 900,
      };
    },
    async upload(file, key) {
      await delay(400);
      // Persist as data URL in localStorage so the demo can show it back later.
      const dataUrl = await new Promise((res) => {
        const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file);
      });
      try { localStorage.setItem('vl_media_' + key, dataUrl); } catch {}
      return { key, url: dataUrl, etag: 'mock_' + nid() };
    },
    fetchUrl(key) { return localStorage.getItem('vl_media_' + key) || null; },
  };

  // ── Calls (Exotel masked-call mock) ──────────────────────────────────
  const calls = {
    mask(phone) {
      if (!phone) return '';
      return phone.replace(/(\+\d{2})(\d{3})(\d{4})(\d{3})/, '$1-XXX-XXXX-$4');
    },
    async startMaskedCall(fromUser, toUser) {
      await delay(300);
      return {
        call_sid: 'CA' + nid(),
        from_masked: '+91-080-XXXX-' + (fromUser.phone || '').slice(-3),
        to_masked: this.mask(toUser.phone),
        virtual_number: '+91-80-6900-XXXX',
        provider: 'Exotel',
        status: 'connecting',
      };
    },
  };

  // ── Push (FCM mock) ──────────────────────────────────────────────────
  // Renders an in-app notification AND persists it to localStorage so
  // the inbox can list every push that ever fired.
  const PUSH_STORE = 'vl_push_inbox';
  function _readPush() { try { return JSON.parse(localStorage.getItem(PUSH_STORE) || '[]'); } catch { return []; } }
  function _writePush(arr) { localStorage.setItem(PUSH_STORE, JSON.stringify(arr.slice(0, 100))); }

  const push = {
    async registerToken() { return { token: 'fcm_' + nid(), provider: 'Firebase' }; },
    show(title, body, opts = {}) {
      // Translate before persisting + rendering. The persisted copy is what
      // shows up later in the inbox sheet, so we translate up front.
      const tr = (window.api && window.api.tr) ? window.api.tr : (s) => s;
      const tTitle = tr(title);
      const tBody  = tr(body);
      const inbox = _readPush();
      const note = { id: nid(), title: tTitle, body: tBody, icon: opts.icon || 'notifications', at: Date.now(), read: false };
      inbox.unshift(note);
      _writePush(inbox);
      window.dispatchEvent(new CustomEvent('vl:push', { detail: note }));

      const n = document.createElement('div');
      n.className = 'push';
      n.innerHTML = `
        <div class="push-icon">${note.icon}</div>
        <div class="push-body">
          <div class="push-title">${tTitle}</div>
          <div class="push-text">${tBody}</div>
        </div>
        <div class="push-tag">FCM</div>`;
      document.body.appendChild(n);
      requestAnimationFrame(() => n.classList.add('show'));
      const close = () => { n.classList.remove('show'); setTimeout(() => n.remove(), 300); };
      n.onclick = () => { opts.onClick?.(); close(); };
      setTimeout(close, opts.duration || 4500);
    },
    list() { return _readPush(); },
    unread() { return _readPush().filter((n) => !n.read).length; },
    markAllRead() {
      const arr = _readPush().map((n) => ({ ...n, read: true }));
      _writePush(arr);
      window.dispatchEvent(new CustomEvent('vl:push', { detail: null }));
    },
    clear() { _writePush([]); window.dispatchEvent(new CustomEvent('vl:push', { detail: null })); },
  };

  // ── Chat (mock — agent has scripted replies) ─────────────────────────
  const CHAT_STORE = 'vl_chat_';
  const AGENT_REPLIES = {
    'where are you':   ['Just exited the lift on your floor', 'Walking up — 30 seconds away'],
    'please ring bell':['Will do, ringing now'],
    'ok come up':      ['Coming up, please open the door'],
    'thanks':          ['Thank you ma\'am, please rate me!'],
    default:           ['Acknowledged.', 'On my way.', 'Will do.', 'Got it, thanks.'],
  };
  const chat = {
    thread(orderId) { try { return JSON.parse(localStorage.getItem(CHAT_STORE + orderId) || '[]'); } catch { return []; } },
    _save(orderId, arr) { localStorage.setItem(CHAT_STORE + orderId, JSON.stringify(arr)); },
    async send(orderId, text, from = 'me') {
      const t = this.thread(orderId);
      t.push({ id: nid(), from, text, at: Date.now() });
      this._save(orderId, t);
      window.dispatchEvent(new CustomEvent('vl:chat', { detail: { orderId } }));
      if (from === 'me') {
        // Schedule a scripted agent reply after a short delay.
        await delay(600 + Math.random() * 800);
        const key = text.toLowerCase().trim();
        const matched = Object.keys(AGENT_REPLIES).find((k) => key.includes(k));
        const replies = AGENT_REPLIES[matched] || AGENT_REPLIES.default;
        const reply = replies[Math.floor(Math.random() * replies.length)];
        const t2 = this.thread(orderId);
        t2.push({ id: nid(), from: 'them', text: reply, at: Date.now() });
        this._save(orderId, t2);
        window.dispatchEvent(new CustomEvent('vl:chat', { detail: { orderId } }));
        push.show(`Agent replied`, reply, { icon: 'chat' });
      }
    },
  };

  // ── KYC (Digio mock) ─────────────────────────────────────────────────
  const kyc = {
    async start(user) {
      await delay(1200);
      return { id: 'kyc_' + nid(), provider: 'Digio', status: 'verified', verifiedAt: now(), pan: 'ABCDE1234F', aadhaarLast4: '1234' };
    },
    async getStatus(userId) {
      // Demo: agent is verified, others depend on saved state.
      const cached = localStorage.getItem('vl_kyc_' + userId);
      if (cached) return JSON.parse(cached);
      const agentVerified = { id: 'kyc_seed', provider: 'Digio', status: 'verified', verifiedAt: '2025-11-12T09:00:00Z', pan: 'AAGPK1234F' };
      if (userId === 'u-agent-1') return agentVerified;
      return { status: 'not_started', provider: 'Digio' };
    },
    saveStatus(userId, status) { localStorage.setItem('vl_kyc_' + userId, JSON.stringify(status)); },
  };

  // ── Maps (Google Distance Matrix mock) ───────────────────────────────
  const maps = {
    async distanceMatrix(origin, dest) {
      await delay(150);
      const dx = dest.lat - origin.lat;
      const dy = dest.lng - origin.lng;
      const km = Math.sqrt(dx * dx + dy * dy) * 110; // rough
      return { distance_km: +km.toFixed(2), duration_min: Math.max(2, Math.round(km * 4)), provider: 'Google Maps' };
    },
  };

  // ── In-house ML mocks (would be a Python μsvc + scikit/xgboost) ───────
  // Pure heuristics dressed up as ML for the demo. The function shapes
  // mirror what a real model server would return.
  function hashCode(s) {
    let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  }

  const ai = {
    // Bin telemetry anomaly detection (real would be IsolationForest / autoencoder).
    detectAnomaly(deviceId, beforePct, afterPct, secondsElapsed) {
      const rate = (afterPct - beforePct) / Math.max(1, secondsElapsed / 60); // %/min
      if (rate >= 6) {
        return {
          anomaly: true,
          type: rate > 12 ? 'POSSIBLE_THEFT' : 'SUDDEN_FILL',
          rate_per_min: +rate.toFixed(1),
          confidence: Math.min(0.99, 0.7 + rate / 50),
          model: 'isofo-bin-v2',
          suggested_action: rate > 12 ? 'Dispatch security to bin' : 'Inspect bin / verify sensor',
        };
      }
      return null;
    },
    // Predictive maintenance — gradient-boosting on telemetry deltas.
    predictMaintenance(device) {
      const seed = hashCode(device.id);
      const battery = 100 - (seed % 35);
      const days = 90 - (seed % 60);
      return {
        device_id: device.id,
        battery_health_pct: battery,
        sensor_drift_pct: (seed % 10) / 10,
        predicted_failure_in_days: days,
        confidence: 0.82 + (seed % 15) / 100,
        model: 'pm-bin-xgb-v4',
      };
    },
    // ML-based ETA — beats raw distance because it knows the building.
    estimateEta(originLat, originLng, flatLabel) {
      const seed = hashCode((flatLabel || 'X') + Date.now().toString().slice(0, -4));
      const base = 4 + (seed % 8);
      return {
        eta_min: base,
        confidence_low: Math.max(2, base - 2),
        confidence_high: base + 3,
        features_used: ['gate_distance', 'lift_wait_time_of_day', 'block_history'],
        model: 'eta-tower-v3',
      };
    },
    // Service recommendations from order history.
    recommendNext(orderHistory) {
      const out = [];
      const laundry = orderHistory.filter((o) => o.serviceId === 'svc-laundry').length;
      const carwash = orderHistory.filter((o) => o.serviceId === 'svc-carwash').length;
      if (laundry >= 2) out.push({ kind: 'recurring', serviceId: 'svc-laundry', message: 'You book laundry weekly — set up an auto-schedule?', confidence: 0.91 });
      if (carwash >= 1) out.push({ kind: 'cross_sell', serviceId: 'svc-grocery', message: 'Residents who use car wash also use grocery pickup', confidence: 0.74 });
      if (orderHistory.length >= 3) out.push({ kind: 'wallet', message: 'Add ₹500 to wallet, get ₹50 bonus.', confidence: 0.6 });
      return out;
    },
    // Edge AI bin-content classification (would run on ESP32-S3).
    classifyBinContents(deviceId) {
      const seed = hashCode(deviceId);
      const organic = 35 + (seed % 30);
      const recyclable = 20 + ((seed >> 3) % 30);
      const mixed = Math.max(0, 100 - organic - recyclable);
      return {
        device_id: deviceId,
        organic_pct: organic,
        recyclable_pct: recyclable,
        mixed_pct: mixed,
        model: 'binclass-mobv3-int8',
        on_device: true,
      };
    },
    // CV proof-of-service verification (mock — overridden by openai.verifyProof if key present).
    async verifyProofPhoto(serviceType, dataUrl) {
      await delay(900);
      const pass = Math.random() > 0.1;
      return {
        passed: pass,
        confidence: pass ? 0.92 : 0.51,
        notes: pass ? `Photo confirms ${serviceType.toLowerCase()} completed.` : `Image quality low — please retake.`,
        model: 'proof-cv-v2 (mock)',
      };
    },
    // Churn prediction — for admin dashboard.
    predictChurn(recentOrders) {
      const score = Math.random() * 0.4;
      return { risk_pct: Math.round(score * 100), top_features: ['days_since_last_order', 'rating_trend'], model: 'churn-lgbm-v1' };
    },
  };

  // ── OpenAI ───────────────────────────────────────────────────────────
  // Two-tier auth: if the user has set their own personal key in
  // localStorage we send requests directly to api.openai.com (their key,
  // their bill). Otherwise we fall back to the Hearthly server-side
  // proxy at /api/ai/* which holds OPENAI_API_KEY in Vercel env vars —
  // the key never reaches the browser.
  const openai = {
    KEY_STORE: 'vl_openai_key',
    PROXY_BASE: '/api/ai',
    getKey() { return localStorage.getItem(this.KEY_STORE) || ''; },
    setKey(k) { if (k) localStorage.setItem(this.KEY_STORE, k); else localStorage.removeItem(this.KEY_STORE); },
    // Treat the proxy as "has key" on any non-localhost host (the
    // deployed sites have the function; local dev doesn't unless the
    // user runs `vercel dev`). The user's own key, if set, always wins.
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
      if (!r.ok) throw new Error('OpenAI: ' + r.status + ' ' + (await r.text()).slice(0, 200));
      return r.json();
    },

    async chat(messages, opts = {}) {
      return this._post('/chat/completions', {
        model: opts.model || 'gpt-4o-mini',
        messages,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.max_tokens ?? 600,
        response_format: opts.json ? { type: 'json_object' } : undefined,
      });
    },

    // Whisper STT — accepts a Blob/File.
    async transcribe(audioBlob, language = 'en') {
      const userKey = this.getKey();
      const fd = new FormData();
      fd.append('file', audioBlob, 'recording.webm');
      fd.append('model', 'whisper-1');
      fd.append('language', language);
      const url = userKey ? 'https://api.openai.com/v1/audio/transcriptions' : (this.PROXY_BASE + '/transcribe');
      const headers = userKey ? { Authorization: 'Bearer ' + userKey } : {};
      const r = await fetch(url, { method: 'POST', headers, body: fd });
      if (!r.ok) throw new Error('Whisper: ' + r.status);
      return r.json();
    },

    // Vision proof-of-service verification.
    async verifyProof(serviceType, dataUrl) {
      const r = await this.chat([
        { role: 'system', content: 'You are a strict auditor verifying photo proofs of household services. Reply ONLY with JSON: {"passed": bool, "confidence": 0..1, "notes": string}.' },
        { role: 'user', content: [
          { type: 'text', text: `Service: ${serviceType}. Does this photo credibly show the service was completed?` },
          { type: 'image_url', image_url: { url: dataUrl } },
        ]},
      ], { json: true, max_tokens: 200 });
      const out = JSON.parse(r.choices[0].message.content);
      return { ...out, model: 'gpt-4o-mini' };
    },

    // Voice booking: transcript → structured intent.
    async parseBookingIntent(transcript, services) {
      const sys = `You convert a resident's spoken request into a booking intent. Available services: ${services.map((s) => `${s.id} (${s.name})`).join(', ')}. Reply ONLY with JSON: {"serviceId": "<id>", "scheduleHint": "<freeform>", "notes": "<extra>", "confidence": 0..1}. If unclear set serviceId to null.`;
      const r = await this.chat([
        { role: 'system', content: sys },
        { role: 'user', content: transcript },
      ], { json: true, max_tokens: 200 });
      return JSON.parse(r.choices[0].message.content);
    },

    // Admin natural-language analytics.
    async answerAdmin(question, snapshot) {
      const sys = `You are an analyst for a residential valet-services platform. Answer concisely (<= 120 words) using the JSON snapshot. Show a small table or bullet list when helpful. If the data doesn't contain the answer, say so.`;
      const r = await this.chat([
        { role: 'system', content: sys },
        { role: 'user', content: `Snapshot:\n\n${JSON.stringify(snapshot).slice(0, 12000)}\n\nQuestion: ${question}` },
      ], { temperature: 0.3, max_tokens: 500 });
      return r.choices[0].message.content;
    },
  };

  return { sms, payments, storage, calls, push, kyc, maps, ai, openai, chat };
})();
