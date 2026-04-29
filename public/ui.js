// ─────────────────────────────────────────────────────────────────────
// Reusable UI components — every flow in the app uses these instead of
// alert/prompt/toast. All visual, all mocked, all working end-to-end.
// ─────────────────────────────────────────────────────────────────────

window.ui = (() => {
  const fmtINR  = (paise) => paise ? '₹ ' + (paise / 100).toFixed(0) : 'Free';
  const fmtTime = (iso)   => new Date(iso).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
  const fmtAgo  = (ms)    => {
    const s = Math.floor((Date.now() - ms) / 1000);
    if (s < 60)  return s + 's';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'h';
    return Math.floor(s / 86400) + 'd';
  };

  // Generic sheet wrapper — auto-closes the previous if any.
  function sheet(html, opts = {}) {
    document.querySelectorAll('.sheet-overlay.modal-stack').forEach((o) => o.remove());
    const wrap = document.createElement('div');
    wrap.className = 'sheet-overlay open modal-stack';
    wrap.innerHTML = `<div class="sheet"><div class="grip"></div>${html}</div>`;
    document.body.appendChild(wrap);
    if (opts.dismissOnBackdrop !== false) {
      wrap.addEventListener('click', (e) => { if (e.target === wrap) wrap.remove(); });
    }
    return {
      el: wrap,
      close: () => wrap.remove(),
    };
  }

  // ── Live tracking map ──────────────────────────────────────────────
  // Uses Leaflet + OpenStreetMap tiles when the script has loaded; falls
  // back to a stylised SVG city map when offline or before Leaflet boots.
  // Honours the device's geolocation when granted (animated agent dot
  // converges on the user's actual position).
  function map(container, opts) {
    if (window.L && navigator.onLine !== false) {
      return liveMap(container, opts);
    }
    return svgMap(container, opts);
  }

  function liveMap(container, opts) {
    const { order, etaMin = 8 } = opts;
    const enRouteAt = order.enRouteAt ? new Date(order.enRouteAt).getTime() : Date.now();
    const tripMs = (opts.tripSec || 60) * 1000;
    const isDemo = order.id === 'demo';

    // Default destination — Bengaluru (Prestige Sunrise Park area). Replaced
    // with the user's actual location once geolocation resolves.
    let dest = [12.9120, 77.6035];
    let start = [12.9080, 77.6005]; // ≈ 600m away

    container.innerHTML = `
      <div class="citymap" id="cm-${order.id}">
        <span class="live-tag">LIVE</span>
        <div class="eta-tag"><b id="cmEta">${etaMin}</b><span class="lbl">min</span></div>
        <span class="compass">N</span>
        <span class="scale" id="cmScale">~600 m</span>
        <div id="cmLeaflet" style="position:absolute; inset:0; border-radius: 14px;"></div>
      </div>`;

    // Material icons rendered into divIcons — gives us crisp markers on
    // top of OSM tiles without bundling marker images.
    const icon = (color, glyph) => L.divIcon({
      html: `<div style="width:32px; height:32px; border-radius:50%; background:${color}; display:grid; place-items:center; box-shadow: 0 4px 12px rgba(15,23,42,.25); border: 3px solid #fff;"><span style="font-family:'Material Symbols Outlined'; color:#fff; font-size:18px;">${glyph}</span></div>`,
      iconSize: [32, 32], iconAnchor: [16, 16], className: '',
    });

    const map = L.map(container.querySelector('#cmLeaflet'), {
      attributionControl: true, zoomControl: false, dragging: false,
      doubleClickZoom: false, scrollWheelZoom: false, touchZoom: false, keyboard: false,
    }).setView(dest, 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, minZoom: 5, subdomains: 'abc',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const homeMarker  = L.marker(dest,  { icon: icon('#f59e0b', 'home') }).addTo(map);
    const agentMarker = L.marker(start, { icon: icon('#6366f1', 'delivery_dining') }).addTo(map);
    const routeLine   = L.polyline([start, dest], {
      color: '#6366f1', weight: 4, opacity: 0.85, dashArray: '6 6',
    }).addTo(map);

    map.fitBounds(L.latLngBounds([start, dest]).pad(0.4));

    function tick() {
      const elapsed = Date.now() - enRouteAt;
      const t = isDemo ? ((elapsed % tripMs) / tripMs)
                       : Math.max(0, Math.min(1, elapsed / tripMs));
      const lat = start[0] + (dest[0] - start[0]) * t;
      const lng = start[1] + (dest[1] - start[1]) * t;
      agentMarker.setLatLng([lat, lng]);
      routeLine.setLatLngs([[lat, lng], dest]);
      const eta = container.querySelector('#cmEta');
      if (eta) eta.textContent = String(Math.max(0, Math.ceil((1 - t) * etaMin)));
    }
    tick();
    const id = setInterval(() => {
      if (!container.isConnected) { clearInterval(id); return; }
      tick();
    }, 1000);

    // Try device geolocation. If granted, snap the home marker to user.
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          dest = [pos.coords.latitude, pos.coords.longitude];
          // Place the agent ~500m south-west, then converge on user.
          start = [dest[0] - 0.0035, dest[1] - 0.0040];
          homeMarker.setLatLng(dest);
          agentMarker.setLatLng(start);
          routeLine.setLatLngs([start, dest]);
          map.setView(dest, 16);
          map.fitBounds(L.latLngBounds([start, dest]).pad(0.4));
          const scale = container.querySelector('#cmScale');
          if (scale) scale.textContent = '~500 m';
        },
        () => { /* permission denied / no fix — stay on default coords */ },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 30_000 }
      );
    }

    return { stop: () => clearInterval(id) };
  }

  // Original SVG map kept as a fallback (no internet / Leaflet failed).
  function svgMap(container, opts) {
    const { order, etaMin = 0 } = opts;
    const enRouteAt = order.enRouteAt ? new Date(order.enRouteAt).getTime() : Date.now();
    const tripMs = (opts.tripSec || 60) * 1000;

    container.innerHTML = `
      <div class="citymap" id="cm-${order.id}">
        <span class="live-tag">LIVE</span>
        <div class="eta-tag"><b id="cmEta">${etaMin}</b><span class="lbl">min</span></div>
        <span class="compass">N</span>
        <span class="scale">200 m</span>
        <svg viewBox="0 0 320 260" preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M20 0 L0 0 0 20" fill="none" stroke="#e7decf" stroke-width="0.6"/>
            </pattern>
          </defs>
          <rect width="320" height="260" fill="url(#grid)"/>
          <!-- Major roads -->
          <rect x="0"   y="120" width="320" height="14" fill="#fef3c7"/>
          <rect x="150" y="0"   width="14"  height="260" fill="#fef3c7"/>
          <line x1="0"   y1="127" x2="320" y2="127" stroke="#fff" stroke-width="1" stroke-dasharray="6 6"/>
          <line x1="157" y1="0"   x2="157" y2="260" stroke="#fff" stroke-width="1" stroke-dasharray="6 6"/>
          <!-- Secondary streets -->
          <rect x="0" y="40"  width="320" height="6" fill="#fef9e6"/>
          <rect x="0" y="200" width="320" height="6" fill="#fef9e6"/>
          <rect x="60"  y="0" width="6" height="260" fill="#fef9e6"/>
          <rect x="240" y="0" width="6" height="260" fill="#fef9e6"/>
          <!-- Buildings -->
          <g fill="#cbd5e1" opacity=".55">
            <rect x="10"  y="10"  width="42" height="22" rx="3"/>
            <rect x="74"  y="10"  width="68" height="22" rx="3"/>
            <rect x="172" y="10"  width="60" height="22" rx="3"/>
            <rect x="254" y="10"  width="56" height="22" rx="3"/>
            <rect x="10"  y="60"  width="42" height="50" rx="3"/>
            <rect x="74"  y="60"  width="68" height="50" rx="3"/>
            <rect x="172" y="60"  width="60" height="50" rx="3"/>
            <rect x="254" y="60"  width="56" height="50" rx="3"/>
            <rect x="10"  y="148" width="42" height="42" rx="3"/>
            <rect x="74"  y="148" width="68" height="42" rx="3"/>
            <rect x="172" y="148" width="60" height="42" rx="3"/>
            <rect x="254" y="148" width="56" height="42" rx="3"/>
            <rect x="10"  y="216" width="42" height="32" rx="3"/>
            <rect x="74"  y="216" width="68" height="32" rx="3"/>
            <rect x="172" y="216" width="60" height="32" rx="3"/>
            <rect x="254" y="216" width="56" height="32" rx="3"/>
          </g>
          <!-- Trees -->
          <g fill="#86efac" opacity=".7">
            <circle cx="40" cy="125" r="3"/><circle cx="100" cy="125" r="3"/><circle cx="200" cy="125" r="3"/>
            <circle cx="280" cy="125" r="3"/><circle cx="160" cy="50" r="3"/><circle cx="160" cy="180" r="3"/>
          </g>
          <!-- Route polyline (from start at lower-left to home at upper-right) -->
          <path id="cmRoute" d="M 30 230 L 30 127 L 157 127 L 157 50 L 280 50" stroke="#6366f1" stroke-width="3"
                fill="none" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="6 4">
            <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="0.8s" repeatCount="indefinite"/>
          </path>
          <!-- Home (destination) -->
          <g transform="translate(280, 50)">
            <circle r="14" fill="#f59e0b"/>
            <circle r="10" fill="#fff"/>
            <text x="0" y="4" text-anchor="middle" fill="#f59e0b" font-family="Material Symbols Outlined" font-size="13">home</text>
          </g>
          <!-- Agent (animated) -->
          <g id="cmAgent" transform="translate(30, 230)">
            <circle r="14" fill="#6366f1">
              <animate attributeName="r" values="14;16;14" dur="1.4s" repeatCount="indefinite"/>
            </circle>
            <circle r="10" fill="#fff"/>
            <text x="0" y="4" text-anchor="middle" fill="#6366f1" font-family="Material Symbols Outlined" font-size="13">delivery_dining</text>
          </g>
        </svg>
      </div>
    `;

    // Sample positions along the polyline above (M 30 230 → 30 127 → 157 127 → 157 50 → 280 50)
    const segs = [
      [30, 230, 30, 127],
      [30, 127, 157, 127],
      [157, 127, 157, 50],
      [157, 50, 280, 50],
    ];
    const total = segs.reduce((s, [x1,y1,x2,y2]) => s + Math.hypot(x2-x1, y2-y1), 0);
    function posAt(t) {
      let target = total * t;
      for (const [x1,y1,x2,y2] of segs) {
        const len = Math.hypot(x2-x1, y2-y1);
        if (target <= len) { const k = target / len; return [x1 + (x2-x1)*k, y1 + (y2-y1)*k]; }
        target -= len;
      }
      return [segs.at(-1)[2], segs.at(-1)[3]];
    }

    function tick() {
      const elapsed = Date.now() - enRouteAt;
      // Demo orders loop forever; real orders progress 0 → 1 then stop.
      const t = order.id === 'demo'
        ? ((elapsed % tripMs) / tripMs)
        : Math.max(0, Math.min(1, elapsed / tripMs));
      const [x, y] = posAt(t);
      const agent = container.querySelector('#cmAgent');
      if (!agent) return; // container was removed → nothing to update
      agent.setAttribute('transform', `translate(${x.toFixed(1)}, ${y.toFixed(1)})`);
      const eta = container.querySelector('#cmEta');
      if (eta) eta.textContent = String(Math.max(0, Math.ceil((1 - t) * (opts.etaMin || 8))));
    }
    tick();
    const id = setInterval(tick, 1000);
    return { stop: () => clearInterval(id) };
  }

  // ── Star rating sheet ──────────────────────────────────────────────
  function starRating({ title = 'Rate this service', subtitle = '', initial = 5 } = {}) {
    return new Promise((resolve) => {
      const s = sheet(`
        <h3>${title}</h3>
        <div class="desc">${subtitle}</div>
        <div class="stars" id="srStars">
          ${[1,2,3,4,5].map((n) => `<div class="s ${n <= initial ? 'on' : ''}" data-n="${n}">star</div>`).join('')}
        </div>
        <div class="field"><label>Add a comment (optional)</label>
          <textarea id="srComment" rows="2" placeholder="Tell us how it went"></textarea>
        </div>
        <div class="field"><button class="btn cta block" id="srSubmit">Submit rating</button></div>
        <div class="field"><button class="btn ghost block" id="srSkip">Skip</button></div>
      `);
      let chosen = initial;
      const stars = s.el.querySelectorAll('.s');
      stars.forEach((el) => el.onclick = () => {
        chosen = Number(el.dataset.n);
        stars.forEach((x) => x.classList.toggle('on', Number(x.dataset.n) <= chosen));
      });
      s.el.querySelector('#srSubmit').onclick = () => { s.close(); resolve({ stars: chosen, comment: s.el.querySelector('#srComment').value }); };
      s.el.querySelector('#srSkip').onclick   = () => { s.close(); resolve(null); };
    });
  }

  // ── Tip sheet ──────────────────────────────────────────────────────
  function tipSheet(agentName) {
    return new Promise((resolve) => {
      const presets = [20, 50, 100, 200];
      let chosen = 50, custom = '';
      const s = sheet(`
        <h3>Tip ${agentName || 'your agent'}</h3>
        <div class="desc">100% goes to ${agentName || 'the agent'}.</div>
        <div class="tip-chips" id="tcChips">
          ${presets.map((p) => `<div class="tc ${p===50?'on':''}" data-amt="${p}">₹${p}</div>`).join('')}
        </div>
        <div class="field"><label>Custom amount</label>
          <input id="tcCustom" inputmode="numeric" placeholder="e.g. 75" />
        </div>
        <div class="field"><button class="btn cta block" id="tcPay">Send tip</button></div>
        <div class="field"><button class="btn ghost block" id="tcSkip">No thanks</button></div>
      `);
      const chips = s.el.querySelectorAll('.tc');
      chips.forEach((c) => c.onclick = () => {
        chips.forEach((x) => x.classList.remove('on'));
        c.classList.add('on'); chosen = Number(c.dataset.amt); s.el.querySelector('#tcCustom').value = '';
      });
      s.el.querySelector('#tcCustom').oninput = (e) => { custom = e.target.value.replace(/\D/g, ''); chips.forEach((x) => x.classList.remove('on')); };
      s.el.querySelector('#tcPay').onclick = async () => {
        const amount = Number(custom || chosen);
        if (!amount) return;
        s.close();
        // Run through Razorpay so it feels real
        const rzp = await providers.payments.createOrder(amount * 100, 'tip-' + Date.now());
        const result = await providers.payments.openCheckout(rzp, {});
        if (result.status === 'captured') {
          providers.push.show('Tip sent', `₹${amount} to ${agentName || 'agent'}`, { icon: 'volunteer_activism' });
          resolve({ amount: amount * 100 });
        } else resolve(null);
      };
      s.el.querySelector('#tcSkip').onclick = () => { s.close(); resolve(null); };
    });
  }

  // ── Notification inbox ─────────────────────────────────────────────
  function inbox() {
    const items = providers.push.list();
    const s = sheet(`
      <h3>Notifications ${items.length ? `<span class="muted" style="font-size:13px;">(${items.length})</span>` : ''}</h3>
      <div style="display:flex; gap:8px; margin: 4px 0 10px;">
        <button class="btn ghost sm" id="ibRead">Mark all read</button>
        <button class="btn ghost sm" id="ibClear">Clear</button>
        <div style="flex:1;"></div>
        <span class="muted" style="font-size:11px;">delivered via FCM</span>
      </div>
      <div id="ibList" style="max-height: 60dvh; overflow-y: auto;">
        ${items.length ? items.map((n) => `
          <div class="inbox-item ${n.read ? '' : 'unread'}">
            <div class="ico">${n.icon || 'notifications'}</div>
            <div class="meta">
              <div class="t1">${n.title}</div>
              <div class="t2">${n.body}</div>
            </div>
            <div class="when">${fmtAgo(n.at)}</div>
          </div>`).join('') : '<div class="muted" style="padding: 24px 0; text-align:center;">No notifications yet.</div>'}
      </div>
      <div class="field"><button class="btn ghost block" id="ibClose">Close</button></div>
    `);
    s.el.querySelector('#ibRead').onclick = () => { providers.push.markAllRead(); s.close(); inbox(); };
    s.el.querySelector('#ibClear').onclick = () => { providers.push.clear(); s.close(); inbox(); };
    s.el.querySelector('#ibClose').onclick = s.close;
  }

  // ── Chat with agent ────────────────────────────────────────────────
  function chat(order) {
    const me = api.user();
    const s = sheet(`
      <h3>Chat with ${order.agent?.name || 'your agent'}</h3>
      <div class="desc">Messages relayed via Exotel — your number stays private.</div>
      <div class="chat-thread" id="ctThread"></div>
      <div class="quick-replies" id="ctQR">
        ${['Where are you?', 'Please ring bell', 'OK come up', 'Thanks'].map((q) => `<span class="qr">${q}</span>`).join('')}
      </div>
      <div style="display:flex; gap:8px;">
        <input id="ctInput" placeholder="Type a message…" />
        <button class="btn cta sm" id="ctSend">Send</button>
      </div>
      <div class="field" style="margin-top:8px;"><button class="btn ghost block" id="ctClose">Close</button></div>
    `);
    function paint() {
      const t = providers.chat.thread(order.id);
      const root = s.el.querySelector('#ctThread');
      root.innerHTML = t.map((m) =>
        `<div class="bubble ${m.from === 'me' ? 'me' : 'them'}">${m.text}<div class="ts">${new Date(m.at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div></div>`
      ).join('') || '<div class="muted">Say hi!</div>';
      root.scrollTop = root.scrollHeight;
    }
    paint();
    const onMsg = (e) => { if (e.detail?.orderId === order.id) paint(); };
    window.addEventListener('vl:chat', onMsg);
    s.el.querySelector('#ctClose').onclick = () => { window.removeEventListener('vl:chat', onMsg); s.close(); };
    const sendIt = (txt) => {
      const v = (txt || s.el.querySelector('#ctInput').value || '').trim();
      if (!v) return;
      providers.chat.send(order.id, v);
      s.el.querySelector('#ctInput').value = '';
    };
    s.el.querySelector('#ctSend').onclick = () => sendIt();
    s.el.querySelector('#ctInput').onkeydown = (e) => { if (e.key === 'Enter') sendIt(); };
    s.el.querySelectorAll('.qr').forEach((el) => el.onclick = () => sendIt(el.textContent));
  }

  // ── Order detail sheet ─────────────────────────────────────────────
  function orderDetail(order) {
    const proofUrl = order.proofKey ? providers.storage.fetchUrl(order.proofKey) : null;
    const tipPaise = order.tipped || 0;
    const total = (order.amount || 0) + tipPaise;
    const status = (order.status || '').toLowerCase();
    const auto = order.source === 'AUTO_BIN' ? '<span class="badge auto" style="margin-left:6px;">AUTO</span>' : '';
    const s = sheet(`
      <h3>${order.service?.name || order.serviceId} ${auto}</h3>
      <div class="desc"><span class="badge ${status}">${order.status.replace('_',' ')}</span> &middot; ${fmtTime(order.scheduledAt)}</div>

      ${proofUrl ? `<h4>Proof of service</h4><img src="${proofUrl}" class="proof-img" />
        ${order.proofVerification ? `<div class="reco" style="margin-top:8px;"><div class="ico">${order.proofVerification.passed ? 'verified' : 'warning'}</div><div class="meta"><b>${order.proofVerification.passed ? 'AI verified' : 'Flagged'}</b> · ${(order.proofVerification.confidence*100|0)}%<div class="sub">${order.proofVerification.notes} · ${order.proofVerification.model}</div></div></div>` : ''}` : ''}

      <h4>Details</h4>
      <div class="kv-row"><span class="k">Order ID</span><span class="v">${order.id}</span></div>
      <div class="kv-row"><span class="k">Flat</span><span class="v">${order.flat?.label || '—'}</span></div>
      <div class="kv-row"><span class="k">Agent</span><span class="v">${order.agent?.name || '—'}</span></div>
      <div class="kv-row"><span class="k">Amount</span><span class="v">${fmtINR(order.amount)}</span></div>
      ${tipPaise ? `<div class="kv-row"><span class="k">Tip</span><span class="v">${fmtINR(tipPaise)}</span></div><div class="kv-row"><span class="k">Total</span><span class="v">${fmtINR(total)}</span></div>` : ''}
      ${order.notes ? `<div class="kv-row"><span class="k">Notes</span><span class="v">${order.notes}</span></div>` : ''}
      ${order.rating ? `<div class="kv-row"><span class="k">Your rating</span><span class="v">${'★'.repeat(order.rating)}${'☆'.repeat(5-order.rating)}</span></div>` : ''}

      <h4>Timeline</h4>
      <div class="timeline">
        ${(order.history || []).slice().reverse().map((h) => `<div class="step"><b>${h.status.replace('_',' ')}</b> &middot; ${new Date(h.at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}${h.via ? ' &middot; via ' + h.via : ''}</div>`).join('')}
      </div>

      ${order.payment_id || order.amount ? `<h4>Payment</h4>
        <div class="kv-row"><span class="k">Method</span><span class="v">UPI · GPay</span></div>
        <div class="kv-row"><span class="k">Razorpay txn</span><span class="v" style="font-family: monospace; font-size: 11px;">pay_${order.id.slice(0,12)}</span></div>
        <div class="kv-row"><span class="k">Receipt</span><span class="v">Tap to download</span></div>` : ''}

      ${order.complaint ? `<h4>Complaint</h4>
        <div class="kv-row"><span class="k">Ticket</span><span class="v">#${order.complaint.id.slice(-5)}</span></div>
        <div class="kv-row"><span class="k">Category</span><span class="v">${order.complaint.category}</span></div>
        <div class="kv-row"><span class="k">Status</span><span class="v">${order.complaint.status}</span></div>` : ''}

      <div class="field" style="margin-top: 14px; display:grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        ${['EN_ROUTE','ARRIVED','IN_PROGRESS'].includes(order.status) ? `<button class="btn ghost" id="odChat">Chat</button><button class="btn cta" id="odCall">Call</button>` : ''}
        ${order.status === 'COMPLETED' && !order.rating ? '<button class="btn cta" id="odRate" style="grid-column: 1/-1;">Rate service</button>' : ''}
      </div>
      <div class="field"><button class="btn ghost block" id="odClose">Close</button></div>
    `);
    s.el.querySelector('#odClose').onclick = s.close;
    s.el.querySelector('#odChat')?.addEventListener('click', () => { s.close(); chat(order); });
    s.el.querySelector('#odCall')?.addEventListener('click', async () => {
      api.toast('Connecting via Exotel…');
      const c = await providers.calls.startMaskedCall(api.user(), order.agent || { phone: '+919999900002' });
      providers.push.show('Call connected', `${c.from_masked} ↔ ${c.to_masked} via ${c.virtual_number}`, { icon: 'call' });
    });
    s.el.querySelector('#odRate')?.addEventListener('click', async () => {
      const r = await starRating({ subtitle: order.service?.name });
      if (!r) return;
      try { await api.http('POST', `/api/orders/${order.id}/rate`, { stars: r.stars, comment: r.comment }); api.toast('Rating saved'); s.close(); }
      catch (e) { api.toast(e.message); }
    });
  }

  // ── Wallet history ─────────────────────────────────────────────────
  function walletHistory() {
    const tx = JSON.parse(localStorage.getItem('vl_wallet_tx') || 'null') || _seedWalletTx();
    const balance = Number(localStorage.getItem('vl_wallet') || 50000);
    const s = sheet(`
      <h3>Wallet</h3>
      <div class="wallet-card" style="margin-bottom: 12px;">
        <div class="lbl">Balance</div>
        <div class="bal">${fmtINR(balance)}</div>
      </div>
      <h4>Transactions</h4>
      <div style="max-height: 50dvh; overflow-y: auto;">
        ${tx.map((t) => `<div class="kv-row" style="border-top: 1px solid var(--line-soft); padding: 10px 0;">
          <div><div style="font-weight:600;">${t.label}</div><div class="muted" style="font-size:11px;">${new Date(t.at).toLocaleString()}</div></div>
          <div style="font-weight:700; color:${t.amount > 0 ? 'var(--ok)' : 'var(--ink)'};">${t.amount > 0 ? '+' : ''}${fmtINR(t.amount)}</div>
        </div>`).join('')}
      </div>
      <div class="field"><button class="btn ghost block" id="wtClose">Close</button></div>
    `);
    s.el.querySelector('#wtClose').onclick = s.close;
  }
  function _seedWalletTx() {
    const tx = [
      { id: 't1', label: 'Initial topup',   amount:  50000, at: Date.now() - 7 * 24 * 3600 * 1000 },
      { id: 't2', label: 'Laundry pickup',  amount: -19900, at: Date.now() - 3 * 24 * 3600 * 1000 },
      { id: 't3', label: 'Cashback bonus',  amount:   2500, at: Date.now() - 2 * 24 * 3600 * 1000 },
      { id: 't4', label: 'Tip to Ravi',     amount:  -5000, at: Date.now() - 1 * 24 * 3600 * 1000 },
    ];
    localStorage.setItem('vl_wallet_tx', JSON.stringify(tx));
    return tx;
  }
  function recordWalletTx(label, amount) {
    const tx = JSON.parse(localStorage.getItem('vl_wallet_tx') || '[]');
    tx.unshift({ id: 't' + Date.now(), label, amount, at: Date.now() });
    localStorage.setItem('vl_wallet_tx', JSON.stringify(tx.slice(0, 50)));
  }

  // ── Schedule (functional CRUD) ─────────────────────────────────────
  // Recurring schedules live in localStorage keyed by `vl_schedules`.
  // Each entry: { id, serviceId, dayOfWeek (0-6), time "HH:MM", notes }.
  const SCH_KEY = 'vl_schedules';
  const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  function readSchedules() { try { return JSON.parse(localStorage.getItem(SCH_KEY) || '[]'); } catch { return []; } }
  function writeSchedules(arr) { localStorage.setItem(SCH_KEY, JSON.stringify(arr)); }
  // YYYY-MM-DD in local time — stable as a calendar key. (toISOString uses
  // UTC and shifts everything one day in IST, which made dots land on the
  // wrong column in the calendar.)
  function localKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  function nextOccurrence(sch, from = new Date()) {
    const [hh, mm] = sch.time.split(':').map(Number);
    const d = new Date(from); d.setHours(hh, mm, 0, 0);
    const diff = (sch.dayOfWeek - d.getDay() + 7) % 7;
    if (diff === 0 && d.getTime() <= from.getTime()) d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + diff);
    return d;
  }
  function occurrencesInRange(sch, start, end) {
    const out = [];
    let d = nextOccurrence(sch, start);
    while (d <= end) { out.push(new Date(d)); d.setDate(d.getDate() + 7); }
    return out;
  }

  function scheduleView(orders) {
    const services = api._state().services;
    let viewMonth = new Date(); viewMonth.setDate(1); viewMonth.setHours(0,0,0,0);

    function render() {
      const today = new Date(); today.setHours(0,0,0,0);
      const monthStart = new Date(viewMonth);
      const gridStart  = new Date(monthStart); gridStart.setDate(1); gridStart.setDate(gridStart.getDate() - gridStart.getDay());
      const gridEnd    = new Date(gridStart);  gridEnd.setDate(gridEnd.getDate() + 41);
      const days = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getTime() + i * 86400_000));
      const monthLabel = monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      const schedules = readSchedules();

      // Build map of day-key → array of {order, schedule, time}.
      const byDay = {};
      orders.forEach((o) => {
        const d = new Date(o.scheduledAt || o.createdAt);
        const k = localKey(d);
        (byDay[k] ||= []).push({ kind: 'order', label: o.service?.name, time: d, ref: o });
      });
      schedules.forEach((sch) => {
        occurrencesInRange(sch, gridStart, gridEnd).forEach((d) => {
          const k = localKey(d);
          (byDay[k] ||= []).push({ kind: 'schedule', label: services.find((s) => s.id === sch.serviceId)?.name + ' (weekly)', time: d, ref: sch });
        });
      });

      s.el.innerHTML = `
        <div class="grip"></div>
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 8px;">
          <button class="icon-btn" id="scPrev">chevron_left</button>
          <h3 style="margin:0;">${monthLabel}</h3>
          <button class="icon-btn" id="scNext">chevron_right</button>
        </div>
        <div class="cal">
          ${['S','M','T','W','T','F','S'].map((h) => `<div class="h">${h}</div>`).join('')}
          ${days.map((d) => {
            const k = localKey(d);
            const isToday = d.getTime() === today.getTime();
            const outside = d.getMonth() !== monthStart.getMonth();
            const has = byDay[k]?.length;
            return `<div class="d ${outside?'outside':''} ${isToday?'today':''}" data-day="${k}">${d.getDate()}${has?'<span class="dot"></span>':''}</div>`;
          }).join('')}
        </div>

        <h4>Recurring schedules <span class="muted" style="font-weight:400; text-transform:none; letter-spacing:0;">(${schedules.length})</span></h4>
        ${schedules.length ? schedules.map((sch) => {
          const svc = services.find((s) => s.id === sch.serviceId);
          return `<div class="kv-row" style="border-top:1px solid var(--line-soft); padding: 10px 0;">
            <div><div style="font-weight:600;">${svc?.name || sch.serviceId}</div><div class="muted" style="font-size:11px;">Every ${DAY_NAMES[sch.dayOfWeek]} at ${sch.time}${sch.notes ? ' · '+sch.notes : ''}</div></div>
            <button class="btn danger" data-del="${sch.id}">Delete</button>
          </div>`;
        }).join('') : '<div class="muted">No recurring schedules yet.</div>'}

        <div class="field" style="margin-top: 14px;">
          <button class="btn cta block" id="scAdd">+ New recurring schedule</button>
        </div>
        <div class="field"><button class="btn ghost block" id="scClose">Close</button></div>
      `;

      s.el.querySelector('#scPrev').onclick = () => { viewMonth.setMonth(viewMonth.getMonth() - 1); render(); };
      s.el.querySelector('#scNext').onclick = () => { viewMonth.setMonth(viewMonth.getMonth() + 1); render(); };
      s.el.querySelector('#scClose').onclick = s.close;
      s.el.querySelectorAll('.cal .d[data-day]').forEach((el) => el.onclick = () => {
        const items = byDay[el.dataset.day] || [];
        showDay(el.dataset.day, items);
      });
      s.el.querySelector('#scAdd').onclick = () => {
        s.close();
        addScheduleSheet().then((created) => { if (created) scheduleView(orders); });
      };
      s.el.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => {
        const id = b.dataset.del;
        writeSchedules(readSchedules().filter((x) => x.id !== id));
        providers?.push?.show?.('Schedule deleted', '', { icon: 'delete' });
        render();
      });
    }

    const s = sheet('');
    render();
  }

  function showDay(dayKey, items) {
    const dayLabel = new Date(dayKey).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    const inner = sheet(`
      <h3>${dayLabel}</h3>
      <div class="desc">${items.length} item${items.length === 1 ? '' : 's'} scheduled</div>
      ${items.length ? items.map((it) => `
        <div class="order" style="margin-bottom: 8px;">
          <div class="ico">${it.kind === 'schedule' ? 'event_repeat' : 'event'}</div>
          <div class="meta">
            <div class="t1">${it.label || ''}</div>
            <div class="t2">${it.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${it.kind === 'schedule' ? 'recurring' : 'one-off'}</div>
          </div>
          <span class="badge ${it.kind === 'schedule' ? 'auto' : (it.ref.status || '').toLowerCase()}">${it.kind === 'schedule' ? 'WEEKLY' : (it.ref.status || '').replace('_', ' ')}</span>
        </div>`).join('') : '<div class="muted">Nothing scheduled. Tap below to add a recurring service.</div>'}
      <div class="field" style="margin-top: 14px;"><button class="btn cta block" id="dyAdd">+ Add recurring</button></div>
      <div class="field"><button class="btn ghost block" id="dyClose">Close</button></div>
    `);
    inner.el.querySelector('#dyClose').onclick = inner.close;
    inner.el.querySelector('#dyAdd').onclick = () => {
      inner.close();
      const dow = new Date(dayKey).getDay();
      addScheduleSheet({ dayOfWeek: dow });
    };
  }

  function addScheduleSheet(prefill = {}) {
    return new Promise((resolve) => {
      const services = api._state().services;
      const s = sheet(`
        <h3>New recurring schedule</h3>
        <div class="desc">Auto-books every week at the chosen time.</div>
        <div class="field"><label>Service</label>
          <select id="ahSvc">${services.map((sv) => `<option value="${sv.id}">${sv.name}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Day of week</label>
          <select id="ahDow">${DAY_NAMES.map((n, i) => `<option value="${i}" ${prefill.dayOfWeek === i ? 'selected' : ''}>${n}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Time</label>
          <input type="time" id="ahTime" value="${prefill.time || '08:00'}" />
        </div>
        <div class="field"><label>Notes (optional)</label>
          <input id="ahNotes" placeholder="e.g. ring bell, leave at door" />
        </div>
        <div class="field"><button class="btn cta block" id="ahSave">Save schedule</button></div>
        <div class="field"><button class="btn ghost block" id="ahCancel">Cancel</button></div>
      `);
      s.el.querySelector('#ahCancel').onclick = () => { s.close(); resolve(null); };
      s.el.querySelector('#ahSave').onclick = () => {
        const sch = {
          id: 'sch_' + Math.random().toString(36).slice(2, 9),
          serviceId: s.el.querySelector('#ahSvc').value,
          dayOfWeek: Number(s.el.querySelector('#ahDow').value),
          time: s.el.querySelector('#ahTime').value || '08:00',
          notes: s.el.querySelector('#ahNotes').value || null,
          createdAt: new Date().toISOString(),
        };
        const all = readSchedules(); all.push(sch); writeSchedules(all);
        providers?.push?.show?.('Schedule added', `Every ${DAY_NAMES[sch.dayOfWeek]} at ${sch.time}`, { icon: 'event_repeat' });
        s.close(); resolve(sch);
      };
    });
  }

  // ── OTA scheduling sheet (admin) ───────────────────────────────────
  function scheduleOta(device) {
    const versions = [
      { v: '1.5.1', notes: 'Battery telemetry fix · LoRaWAN reconnect',  size: '124 KB' },
      { v: '1.5.0', notes: 'Edge-AI bin classification (current)',       size: '210 KB' },
      { v: '1.4.2', notes: 'Stable, security patches',                    size: '98 KB' },
    ];
    let chosen = versions[0].v;
    let when = 'now';
    const s = sheet(`
      <h3>Schedule OTA</h3>
      <div class="desc">${device.label || device.id} &middot; firmware update over-the-air, signed with Ed25519</div>
      <h4>Version</h4>
      <div class="fw-list">
        ${versions.map((f, i) => `<div class="item ${i===0?'on':''}" data-v="${f.v}"><div class="v">${f.v}</div><div class="n">${f.notes} &middot; ${f.size}</div></div>`).join('')}
      </div>
      <h4>When</h4>
      <div class="chips">
        ${['now','tonight 2 AM','this weekend'].map((t,i) => `<div class="chip ${i===0?'on':''}" data-w="${t}">${t}</div>`).join('')}
      </div>
      <div class="field" style="margin-top:14px;"><button class="btn cta block" id="otaGo">Schedule update</button></div>
      <div class="field"><button class="btn ghost block" id="otaClose">Cancel</button></div>
    `);
    s.el.querySelectorAll('.fw-list .item').forEach((el) => el.onclick = () => {
      s.el.querySelectorAll('.fw-list .item').forEach((x) => x.classList.remove('on'));
      el.classList.add('on'); chosen = el.dataset.v;
    });
    s.el.querySelectorAll('.chip').forEach((el) => el.onclick = () => {
      s.el.querySelectorAll('.chip').forEach((x) => x.classList.remove('on'));
      el.classList.add('on'); when = el.dataset.w;
    });
    s.el.querySelector('#otaClose').onclick = s.close;
    s.el.querySelector('#otaGo').onclick = () => {
      s.close();
      providers.push.show('OTA scheduled', `${device.label || device.id} → v${chosen} (${when})`, { icon: 'system_update' });
    };
  }

  // ── Complaint admin queue ──────────────────────────────────────────
  function complaintQueue(orders) {
    const open = orders.filter((o) => o.complaint && o.complaint.status !== 'RESOLVED');
    const s = sheet(`
      <h3>Complaint queue</h3>
      <div class="desc">${open.length} open · auto-escalate at SLA breach</div>
      <div style="max-height: 60dvh; overflow-y: auto;">
        ${open.length ? open.map((o) => {
          const left = new Date(o.complaint.sla_breach_at) - Date.now();
          const cls = left < 0 ? 'bad' : left < 30 * 60_000 ? 'warn' : '';
          const slaTxt = left < 0 ? 'breached' : `${Math.max(0, Math.round(left/60000))}m left`;
          return `<div class="cmp-row">
            <div style="flex:1;">
              <div style="font-weight:700;">#${o.complaint.id.slice(-5)} · ${o.complaint.category}</div>
              <div class="muted" style="font-size:12px; margin-top: 4px;">${o.complaint.description || '—'}</div>
              <div class="muted" style="font-size:11px; margin-top:4px;">Order ${o.id} · ${o.service?.name} · ${o.flat?.label || '—'}</div>
              <div style="display:flex; gap:6px; margin-top: 8px;">
                <button class="btn cta sm" data-resolve="${o.id}">Resolve</button>
                <button class="btn ghost sm" data-escalate="${o.id}">Escalate</button>
              </div>
            </div>
            <span class="sla ${cls}">${slaTxt}</span>
          </div>`;
        }).join('') : '<div class="muted" style="padding:24px 0; text-align:center;">No open complaints. SLAs are healthy.</div>'}
      </div>
      <div class="field"><button class="btn ghost block" id="cqClose">Close</button></div>
    `);
    s.el.querySelector('#cqClose').onclick = s.close;
    s.el.querySelectorAll('[data-resolve]').forEach((b) => b.onclick = () => {
      const ord = orders.find((x) => x.id === b.dataset.resolve);
      ord.complaint.status = 'RESOLVED';
      const all = api._state();
      const o = all.orders.find((x) => x.id === ord.id);
      if (o) { o.complaint = ord.complaint; localStorage.setItem('vl_state_v1', JSON.stringify(all)); }
      providers.push.show('Complaint resolved', `Ticket #${ord.complaint.id.slice(-5)}`, { icon: 'check_circle' });
      s.close(); complaintQueue(orders);
    });
    s.el.querySelectorAll('[data-escalate]').forEach((b) => b.onclick = () => {
      const ord = orders.find((x) => x.id === b.dataset.escalate);
      providers.push.show('Escalated', `Ticket #${ord.complaint.id.slice(-5)} → ops manager`, { icon: 'priority_high' });
    });
  }

  // ── Bell button + badge for any appbar ─────────────────────────────
  function bell() {
    const unread = providers.push.unread();
    return `<button class="icon-btn bell-wrap" id="bellBtn" aria-label="notifications">notifications${unread ? `<span class="badge-num">${unread}</span>` : ''}</button>`;
  }
  function wireBell() {
    const b = document.getElementById('bellBtn');
    if (b) b.onclick = () => inbox();
  }

  // ── Generic prompt sheet (replaces window.prompt) ──────────────────
  function prompt({ title, subtitle = '', label = '', placeholder = '', value = '', cta = 'OK', inputmode = 'text' } = {}) {
    return new Promise((resolve) => {
      const s = sheet(`
        <h3>${title}</h3>
        ${subtitle ? `<div class="desc">${subtitle}</div>` : ''}
        <div class="field"><label>${label}</label>
          <input id="upInp" inputmode="${inputmode}" placeholder="${placeholder}" value="${value || ''}" />
        </div>
        <div class="field"><button class="btn cta block" id="upOk">${cta}</button></div>
        <div class="field"><button class="btn ghost block" id="upCancel">Cancel</button></div>
      `);
      const inp = s.el.querySelector('#upInp'); inp.focus(); inp.select();
      const finish = (v) => { s.close(); resolve(v); };
      s.el.querySelector('#upOk').onclick = () => finish(inp.value);
      s.el.querySelector('#upCancel').onclick = () => finish(null);
      inp.onkeydown = (e) => { if (e.key === 'Enter') finish(inp.value); };
    });
  }

  // Export useful helpers so other pages can list upcoming items.
  function readSchedulesPublic() { return readSchedules(); }
  function nextOccurrencePublic(sch, from) { return nextOccurrence(sch, from); }

  return {
    sheet, map, starRating, tipSheet, inbox, chat, orderDetail,
    walletHistory, recordWalletTx, scheduleView,
    scheduleOta, complaintQueue,
    bell, wireBell, prompt,
    readSchedules: readSchedulesPublic, nextOccurrence: nextOccurrencePublic,
    DAY_NAMES,
  };
})();
