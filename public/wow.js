// ─────────────────────────────────────────────────────────────────────
// "Wow factor" features — Live Activity, ESG, weather nudges, festival
// theme, visitor QR, photo service request, smart locker, subscription
// tiers, sparklines, heatmap, leaderboard, ops digest, Aria assistant.
// All mocked, all working end-to-end.
// ─────────────────────────────────────────────────────────────────────

window.wow = (() => {
  const fmtINR = (paise) => paise ? '₹ ' + (paise / 100).toFixed(0) : 'Free';

  // ─── Theme (light / dark) ───────────────────────────────────────────
  const THEME_KEY = 'vl_theme';
  function applyTheme() {
    const t = localStorage.getItem(THEME_KEY) || 'light';
    document.documentElement.setAttribute('data-theme', t);
  }
  function toggleTheme() {
    const next = (localStorage.getItem(THEME_KEY) || 'light') === 'light' ? 'dark' : 'light';
    localStorage.setItem(THEME_KEY, next);
    applyTheme();
  }
  applyTheme();

  // ─── Festival mode (Diwali/Holi/Pongal/default) ─────────────────────
  // Auto-detect from date, but a manual override wins.
  const FESTIVAL_KEY = 'vl_festival';
  function detectFestival() {
    const m = new Date().getMonth() + 1;
    if (m === 10 || m === 11) return 'diwali';
    if (m === 3) return 'holi';
    if (m === 1) return 'pongal';
    return 'none';
  }
  function applyFestival() {
    const stored = localStorage.getItem(FESTIVAL_KEY);
    const f = stored || detectFestival();
    if (f && f !== 'none') document.documentElement.setAttribute('data-festival', f);
    else document.documentElement.removeAttribute('data-festival');
    return f;
  }
  function setFestival(f) {
    if (!f || f === 'none') localStorage.removeItem(FESTIVAL_KEY);
    else localStorage.setItem(FESTIVAL_KEY, f);
    applyFestival();
  }
  applyFestival();

  // ─── Sound + haptic feedback ────────────────────────────────────────
  let actx;
  function tone(freq, ms = 100, vol = 0.06) {
    try {
      actx ||= new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.frequency.value = freq; o.type = 'sine';
      g.gain.value = vol; o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + ms / 1000);
    } catch {}
  }
  function chime() { tone(660, 80); setTimeout(() => tone(990, 100), 90); }
  function ding()  { tone(880, 50); }
  function buzz()  { tone(220, 120, 0.08); }
  function haptic(pattern = 12) { try { navigator.vibrate?.(pattern); } catch {} }

  function success() { chime(); haptic([12, 30, 24]); }
  function tap()     { haptic(8); }
  function error()   { buzz(); haptic([20, 40, 20]); }

  // ─── Confetti ───────────────────────────────────────────────────────
  function confetti({ pieces = 80, duration = 2200 } = {}) {
    const host = document.createElement('div');
    host.className = 'confetti-host';
    document.body.appendChild(host);
    const colors = ['#6366f1','#f59e0b','#10b981','#ec4899','#06b6d4','#facc15'];
    for (let i = 0; i < pieces; i++) {
      const p = document.createElement('div');
      p.className = 'conf-piece';
      const c = colors[Math.floor(Math.random() * colors.length)];
      p.style.left = (Math.random() * 100) + '%';
      p.style.background = c;
      p.style.transform = `rotate(${Math.random() * 360}deg)`;
      p.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
      p.style.animationDelay = (Math.random() * 0.4) + 's';
      p.style.borderRadius = Math.random() > 0.5 ? '2px' : '50%';
      p.style.width = (4 + Math.random() * 6) + 'px';
      p.style.height = (8 + Math.random() * 8) + 'px';
      host.appendChild(p);
    }
    setTimeout(() => host.remove(), duration + 600);
    success();
  }

  // ─── Skeleton helper ────────────────────────────────────────────────
  function skel(opts = {}) {
    const lines = opts.lines || 3;
    return `<div class="card"><div class="skeleton" style="height: 18px; width: 60%; margin-bottom: 10px;">.</div>
      ${Array(lines).fill(0).map(() => `<div class="skeleton" style="height: 14px; margin-top: 8px;">.</div>`).join('')}
    </div>`;
  }

  // ─── Live Activity banner (resident) ────────────────────────────────
  let liveEl = null;
  function liveActivity(active) {
    // No active order → tear it down entirely so nothing peeks out.
    if (!active) {
      if (liveEl) { liveEl.remove(); liveEl = null; }
      return;
    }
    if (!liveEl) {
      liveEl = document.createElement('div');
      liveEl.className = 'live-activity';
      document.body.appendChild(liveEl);
    }
    const enRouteAt = active.enRouteAt ? new Date(active.enRouteAt).getTime() : Date.now();
    const tripMs = 60_000;
    const elapsed = Date.now() - enRouteAt;
    const eta = Math.max(0, Math.ceil(((tripMs - elapsed) / tripMs) * 8));
    const stages = { ASSIGNED: 'Assigned', EN_ROUTE: 'En route', ARRIVED: 'At your door', IN_PROGRESS: 'In progress' };
    liveEl.innerHTML = `
      <div class="mini">${active.service?.icon || 'delivery_dining'}</div>
      <div class="meta">
        <div class="t1">${active.service?.name || 'Service'}</div>
        <div class="t2">${active.agent?.name || 'Agent'} &middot; ${stages[active.status] || active.status}</div>
      </div>
      <div class="eta"><div>${eta}</div><div class="lbl">MIN</div></div>
    `;
    liveEl.onclick = () => {
      // Switch to the Track tab (resident SPA convention).
      if (window.activeTab !== undefined) { window.activeTab = 'track'; window.paint?.(); }
      else if (window.location.pathname.endsWith('resident.html')) {
        window.dispatchEvent(new CustomEvent('vl:goto', { detail: 'track' }));
      }
    };
    requestAnimationFrame(() => liveEl.classList.add('show'));
  }

  // ─── Carbon / ESG card ──────────────────────────────────────────────
  function esgCard(orderHistory = []) {
    // Mock formula: each completed pickup saves a small amount of CO2.
    const completed = orderHistory.filter((o) => o.status === 'COMPLETED');
    const garbageSavings = completed.filter((o) => o.serviceId === 'svc-garbage').length * 0.6;
    const recyclingSavings = completed.length * 0.35;
    const carbonKg = +(garbageSavings + recyclingSavings + 1.2).toFixed(1);
    const treeMonths = +(carbonKg / 1.4).toFixed(1);
    const streak = Math.max(1, Math.min(8, completed.length));
    const rank = completed.length > 5 ? 12 : completed.length > 2 ? 28 : 42;
    return `
      <div class="esg-card">
        <div class="lbl">CO₂ saved this month</div>
        <div class="val">${carbonKg} kg</div>
        <div class="sub">≈ ${treeMonths} tree-months · top ${rank}% in your community</div>
        <div class="badges">
          <span class="badge-streak">🔥 ${streak}-week streak</span>
          ${streak >= 4 ? '<span class="badge-streak">🏆 Eco-hero</span>' : ''}
          <span class="badge-streak">♻️ Segregator</span>
        </div>
      </div>`;
  }

  // ─── Weather-aware nudge ────────────────────────────────────────────
  // Mocked forecast — varies by hour so the demo never looks stale.
  function getForecast() {
    const h = new Date().getHours();
    if (h >= 14 && h <= 18) return { cond: 'rain', icon: '🌧', text: 'Rain expected at 3 PM' };
    if (h >= 6 && h <= 9)   return { cond: 'cool', icon: '🌤', text: 'Pleasant morning, perfect for car wash' };
    if (h >= 19 && h <= 22) return { cond: 'cool', icon: '🌙', text: 'Cooler evening, ideal for laundry pickup' };
    return { cond: 'hot', icon: '☀️', text: 'Hot afternoon — good time to schedule indoor services' };
  }
  function weatherNudge(orders, services) {
    const fc = getForecast();
    let serviceId = 'svc-laundry', cta = 'Reschedule';
    if (fc.cond === 'cool')  serviceId = 'svc-carwash', cta = 'Book now';
    if (fc.cond === 'hot')   serviceId = 'svc-grocery', cta = 'Order';
    const svc = services.find((s) => s.id === serviceId);
    return `
      <div class="weather-nudge" id="weatherNudge" data-svc="${serviceId}">
        <div class="icon">${fc.icon}</div>
        <div class="meta">
          <div class="t1">${fc.text}</div>
          <div class="t2">${svc ? svc.name + ' suggested' : ''}</div>
        </div>
        <button data-svc-id="${serviceId}">${cta}</button>
      </div>`;
  }

  // ─── Visitor pre-approval (with SVG QR placeholder) ─────────────────
  function visitorSheet() {
    return new Promise((resolve) => {
      const s = ui.sheet(`
        <h3>Pre-approve visitor</h3>
        <div class="desc">Generate a QR for the gate. Valid for 24h.</div>
        <div class="field"><label>Visitor name</label><input id="vsName" placeholder="e.g. Amazon delivery" /></div>
        <div class="field"><label>When</label>
          <select id="vsWhen">
            <option>Now</option><option>In 1 hour</option><option>This evening</option><option>Tomorrow morning</option>
          </select>
        </div>
        <div class="field"><label>Purpose</label>
          <select id="vsPurpose">
            <option>Delivery</option><option>Service</option><option>Guest</option><option>Cab</option>
          </select>
        </div>
        <div class="field"><button class="btn cta block" id="vsGo">Generate QR</button></div>
      `);
      s.el.querySelector('#vsGo').onclick = () => {
        const name = s.el.querySelector('#vsName').value.trim() || 'Visitor';
        const when = s.el.querySelector('#vsWhen').value;
        const purpose = s.el.querySelector('#vsPurpose').value;
        const code = ('VL-' + Math.random().toString(36).slice(2, 8) + '-' + Math.random().toString(36).slice(2, 5)).toUpperCase();
        const expiry = new Date(Date.now() + 24 * 3600 * 1000).toLocaleString();
        const visitor = { code, name, when, purpose, expiry, createdAt: Date.now() };
        const all = JSON.parse(localStorage.getItem('vl_visitors') || '[]');
        all.unshift(visitor); localStorage.setItem('vl_visitors', JSON.stringify(all.slice(0, 30)));
        s.close();
        success();
        showVisitorQR(visitor);
        providers.push.show('Visitor pass ready', `${name} · code ${code}`, { icon: 'qr_code_2' });
        resolve(visitor);
      };
    });
  }
  function showVisitorQR(v) {
    ui.sheet(`
      <h3>${v.name}</h3>
      <div class="desc">Show this QR at the gate · ${v.purpose} · ${v.when}</div>
      ${fakeQrSvg(v.code)}
      <div class="qr-code-text">${v.code}</div>
      <div class="muted" style="font-size:11px; text-align:center; margin-top: 8px;">Valid until ${v.expiry}</div>
      <div class="field" style="margin-top:14px;"><button class="btn cta block" onclick="navigator.share?.({title:'Hearthly visitor pass', text:'${v.name} · code ${v.code}'}).catch(()=>{});api.toast('Shared')">Share</button></div>
      <div class="field"><button class="btn ghost block" id="qrCloseBtn">Close</button></div>
    `).el.querySelector('#qrCloseBtn').onclick = (e) => e.target.closest('.sheet-overlay').remove();
  }
  // Fake QR — visually convincing pattern derived from a string hash.
  function fakeQrSvg(seed) {
    const N = 21;
    let h = 0; for (let i = 0; i < seed.length; i++) { h = (h * 31 + seed.charCodeAt(i)) | 0; }
    const cells = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      h = (h * 1103515245 + 12345) & 0x7fffffff;
      cells.push((h >> 8) & 1);
    }
    // Force the three corner finder patterns
    const finder = (x0, y0) => {
      for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
        const on = (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) ? 1 : 0;
        cells[(y0 + r) * N + (x0 + c)] = on;
      }
    };
    finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
    let rects = '';
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (cells[r * N + c]) rects += `<rect x="${c}" y="${r}" width="1" height="1" fill="#0f172a"/>`;
    }
    return `<svg class="qr-canvas" viewBox="0 0 ${N} ${N}">${rects}</svg>`;
  }

  // ─── Photo-based service request ────────────────────────────────────
  function photoServiceSheet(services) {
    return new Promise((resolve) => {
      const s = ui.sheet(`
        <h3>Report an issue</h3>
        <div class="desc">Snap a photo — we'll suggest a service.</div>
        <div class="field"><label>Photo</label>
          <input type="file" id="prFile" accept="image/*" capture="environment" />
        </div>
        <div id="prPrev"></div>
        <div id="prResult" style="margin-top: 10px;"></div>
        <div class="field"><button class="btn cta block" id="prGo" disabled>Analyse with AI</button></div>
        <div class="field"><button class="btn ghost block" id="prCancel">Cancel</button></div>
      `);
      let chosenFile = null, dataUrl = null;
      s.el.querySelector('#prFile').onchange = (e) => {
        chosenFile = e.target.files[0]; if (!chosenFile) return;
        const reader = new FileReader();
        reader.onload = () => {
          dataUrl = reader.result;
          s.el.querySelector('#prPrev').innerHTML = `<img class="proof-img" src="${dataUrl}" />`;
          s.el.querySelector('#prGo').disabled = false;
        };
        reader.readAsDataURL(chosenFile);
      };
      s.el.querySelector('#prCancel').onclick = () => { s.close(); resolve(null); };
      s.el.querySelector('#prGo').onclick = async () => {
        const btn = s.el.querySelector('#prGo'); btn.disabled = true; btn.textContent = 'Analysing…';
        let suggestion;
        try {
          if (providers.openai.hasKey()) {
            const r = await providers.openai.chat([
              { role: 'system', content: 'You suggest household services from a photo. Reply ONLY with JSON: {"category":"PLUMBING|ELECTRICAL|CLEANING|MAINTENANCE|LAUNDRY","summary":"<short>","confidence":0..1}' },
              { role: 'user', content: [{ type: 'text', text: 'What service does this photo need?' }, { type: 'image_url', image_url: { url: dataUrl } }] },
            ], { json: true, max_tokens: 200 });
            suggestion = JSON.parse(r.choices[0].message.content);
          } else {
            await new Promise((r) => setTimeout(r, 800));
            suggestion = { category: 'MAINTENANCE', summary: 'Looks like a fixture issue — book maintenance.', confidence: 0.83 };
          }
        } catch {
          suggestion = { category: 'MAINTENANCE', summary: 'Looks like a maintenance issue.', confidence: 0.6 };
        }
        const serviceId = ({ PLUMBING: 'svc-maintenance', ELECTRICAL: 'svc-maintenance', CLEANING: 'svc-maintenance', MAINTENANCE: 'svc-maintenance', LAUNDRY: 'svc-laundry' })[suggestion.category] || 'svc-maintenance';
        s.el.querySelector('#prResult').innerHTML = `<div class="reco"><div class="ico">auto_awesome</div><div class="meta"><b>${suggestion.summary}</b><div class="sub">Category ${suggestion.category} · ${(suggestion.confidence*100|0)}% confidence</div></div></div>`;
        btn.textContent = 'Book service'; btn.disabled = false;
        btn.onclick = () => { s.close(); resolve({ ...suggestion, serviceId }); };
      };
    });
  }

  // ─── Smart locker code ──────────────────────────────────────────────
  function smartLockerSheet() {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiry = new Date(Date.now() + 24 * 3600 * 1000).toLocaleString();
    const s = ui.sheet(`
      <h3>Smart locker code</h3>
      <div class="desc">Tell your delivery to drop the package in locker <b>L-12</b> using this code.</div>
      <div class="card" style="text-align:center; margin-top: 8px; background: linear-gradient(135deg,#0f172a,#312e81); color: #fff;">
        <div style="font-size:11px; opacity:.8; letter-spacing:.1em;">UNLOCK CODE</div>
        <div style="font-size:42px; font-weight:800; letter-spacing:.4em; margin: 10px 0;">${code}</div>
        <div style="font-size:11px; opacity:.7;">Locker L-12 · valid until ${expiry}</div>
      </div>
      <div class="field" style="margin-top:14px;"><button class="btn cta block" id="lkShare">Share with delivery</button></div>
      <div class="field"><button class="btn ghost block" id="lkClose">Close</button></div>
    `);
    s.el.querySelector('#lkShare').onclick = () => { providers.push.show('Locker code shared', `Code ${code} sent to delivery`, { icon: 'lock_open' }); success(); };
    s.el.querySelector('#lkClose').onclick = s.close;
  }

  // ─── Subscription tiers ─────────────────────────────────────────────
  function plansSheet() {
    const current = localStorage.getItem('vl_plan') || 'silver';
    const s = ui.sheet(`
      <h3>Choose your plan</h3>
      <div class="desc">Save more with a monthly subscription.</div>
      <div class="plans">
        <div class="plan bronze ${current==='bronze'?'current':''}" data-plan="bronze">
          <div class="h"><div class="nm">Bronze</div><div class="pr">₹ 199/mo</div></div>
          <ul><li>4 garbage pickups</li><li>Standard support</li></ul>
        </div>
        <div class="plan silver ${current==='silver'?'current':''}" data-plan="silver">
          <div class="h"><div class="nm">Silver</div><div class="pr">₹ 499/mo</div></div>
          <ul><li>Unlimited garbage</li><li>2 free laundry pickups</li><li>Priority support</li></ul>
        </div>
        <div class="plan gold ${current==='gold'?'current':''}" data-plan="gold">
          <div class="h"><div class="nm">Gold</div><div class="pr">₹ 999/mo</div></div>
          <ul><li>All Silver features</li><li>1 free car wash/week</li><li>Dedicated valet</li><li>20% off all services</li></ul>
        </div>
      </div>
      <div class="field" style="margin-top:14px;"><button class="btn ghost block" id="plClose">Close</button></div>
    `);
    s.el.querySelectorAll('.plan').forEach((p) => p.onclick = async () => {
      const plan = p.dataset.plan;
      if (plan === current) return;
      const price = { bronze: 19900, silver: 49900, gold: 99900 }[plan];
      s.close();
      const rzp = await providers.payments.createOrder(price, 'sub-' + plan + '-' + Date.now());
      const r = await providers.payments.openCheckout(rzp, {});
      if (r.status === 'captured') {
        localStorage.setItem('vl_plan', plan);
        ui.recordWalletTx?.(`Subscription ${plan}`, -price);
        confetti();
        providers.push.show('Plan upgraded', `Welcome to ${plan.toUpperCase()}`, { icon: 'workspace_premium' });
      }
    });
    s.el.querySelector('#plClose').onclick = s.close;
  }

  // ─── Sparkline (admin KPI) ──────────────────────────────────────────
  function spark(data) {
    if (!data?.length) data = Array(12).fill(0).map(() => Math.random() * 10 + 2);
    const w = 100, h = 30;
    const max = Math.max(...data, 1);
    const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * (h - 4) - 2}`);
    const linePath = `M ${pts.join(' L ')}`;
    const fillPath = `${linePath} L ${w},${h} L 0,${h} Z`;
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <path class="fill" d="${fillPath}"/>
      <path class="line" d="${linePath}"/>
    </svg>`;
  }

  // ─── Heatmap overlay (admin community map) ──────────────────────────
  function heatmapPoints(orders) {
    // Map orders → fake (x,y) per block + heat from count.
    const buckets = { A: 0, B: 0, COMMON: 0 };
    orders.forEach((o) => {
      if (o.flat?.block === 'A') buckets.A++;
      else if (o.flat?.block === 'B') buckets.B++;
      else buckets.COMMON++;
    });
    const max = Math.max(1, ...Object.values(buckets));
    const positions = { A: { x: 70, y: 50 }, B: { x: 250, y: 50 }, COMMON: { x: 160, y: 170 } };
    return Object.entries(buckets).map(([k, v]) => {
      const intensity = v / max;
      const r = 40 + intensity * 60;
      const p = positions[k];
      return `<div class="heatmap-pt" style="left: ${p.x - r/2}px; top: ${p.y - r/2}px; width: ${r}px; height: ${r}px; opacity: ${0.2 + intensity * 0.5};"></div>`;
    }).join('');
  }

  // ─── Agent leaderboard (admin) ──────────────────────────────────────
  function leaderboard() {
    const agents = [
      { id: 'a1', name: 'Ravi Kumar',     completed: 38, rating: 4.9 },
      { id: 'a2', name: 'Priya Singh',    completed: 32, rating: 4.8 },
      { id: 'a3', name: 'Arjun Reddy',    completed: 27, rating: 4.7 },
      { id: 'a4', name: 'Lakshmi Devi',   completed: 24, rating: 4.9 },
      { id: 'a5', name: 'Karthik Iyer',   completed: 21, rating: 4.6 },
      { id: 'a6', name: 'Anita Pillai',   completed: 18, rating: 4.7 },
      { id: 'a7', name: 'Vijay Naidu',    completed: 14, rating: 4.5 },
    ];
    const s = ui.sheet(`
      <h3>Agent leaderboard</h3>
      <div class="desc">This week · top performers across the community</div>
      <div style="max-height: 60dvh; overflow-y: auto;">
        ${agents.map((a, i) => `
          <div class="lb-row ${i===0?'top1':i===1?'top2':i===2?'top3':''}">
            <div class="rank">${i+1}</div>
            <div class="av">${a.name.split(' ').map((s) => s[0]).join('').slice(0,2)}</div>
            <div class="meta">
              <div class="nm">${a.name}</div>
              <div class="st">★ ${a.rating} · ${a.completed} services</div>
            </div>
            <div class="ct">${a.completed}</div>
          </div>`).join('')}
      </div>
      <div class="field"><button class="btn ghost block" id="lbClose">Close</button></div>
    `);
    s.el.querySelector('#lbClose').onclick = s.close;
  }

  // ─── Daily ops digest (admin) ───────────────────────────────────────
  async function opsDigest(snapshot) {
    if (providers.openai.hasKey()) {
      try {
        const r = await providers.openai.chat([
          { role: 'system', content: 'Write a one-paragraph (≤80 words) operations digest for a residential valet platform manager. Highlight: orders completed, SLA breaches, IoT anomalies, top agent.' },
          { role: 'user', content: 'Snapshot: ' + JSON.stringify(snapshot).slice(0, 8000) },
        ], { max_tokens: 200 });
        return r.choices[0].message.content;
      } catch (e) { return mockDigest(snapshot); }
    }
    return mockDigest(snapshot);
  }
  function mockDigest(snap) {
    const t = snap.orders.length;
    const done = snap.orders.filter((o) => o.status === 'COMPLETED').length;
    const cmp = snap.orders.filter((o) => o.complaint).length;
    const fb = (snap.devices || []).filter((d) => d.fillLevel >= 80).length;
    return `Yesterday: ${t} services scheduled, ${done} completed (98.4% on-time). ${fb} bin(s) crossed the 80% threshold and were auto-dispatched. ${cmp} new complaint(s) — all within SLA. Top agent: Ravi Kumar with ${Math.max(1, done)} services and 4.9★. No anomalies escalated.`;
  }

  // ─── Aria assistant (resident chat with tool-calling) ───────────────
  // Stores thread + speaks with the user in EN/HI/TE; falls back to
  // pattern-matching when no OpenAI key.
  function ariaSheet({ services, me, orders }) {
    const s = ui.sheet(`
      <h3>Aria <span class="role-pill" style="margin-left:6px;">${providers.openai.hasKey() ? 'OpenAI' : 'mock'}</span></h3>
      <div class="desc">Your home-services assistant. Try: "Book my usual laundry", "What's my balance?", "Cancel my last order".</div>
      <div class="chat-thread" id="ariaThread"></div>
      <div class="quick-replies" id="ariaQR">
        ${['Book my usual', "What's my schedule?", 'Top up wallet ₹500', 'Cancel my last order', 'Show ESG savings'].map((q) => `<span class="qr">${q}</span>`).join('')}
      </div>
      <div style="display:flex; gap:8px;">
        <input id="ariaInp" placeholder="Ask anything…" />
        <button class="icon-btn" id="ariaMic" aria-label="voice">mic</button>
        <button class="btn cta sm" id="ariaSend">Ask</button>
      </div>
      <div class="field" style="margin-top:8px;"><button class="btn ghost block" id="ariaClose">Close</button></div>
    `);
    let thread = JSON.parse(localStorage.getItem('vl_aria_thread') || '[]');
    function paint() {
      const root = s.el.querySelector('#ariaThread');
      root.innerHTML = thread.length
        ? thread.map((m) => `<div class="bubble ${m.from==='me'?'me':'them'}">${m.text}<div class="ts">${new Date(m.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div></div>`).join('')
        : '<div class="muted">Hi! I\'m Aria. Ask me to book, cancel, top up your wallet, or anything else.</div>';
      root.scrollTop = root.scrollHeight;
    }
    function save() { localStorage.setItem('vl_aria_thread', JSON.stringify(thread.slice(-30))); }
    function add(text, from = 'me') { thread.push({ text, from, at: Date.now() }); save(); paint(); }
    paint();

    async function handle(text) {
      add(text, 'me'); ding();
      const reply = await ariaRespond(text, { services, me, orders });
      add(reply, 'them'); chime();
    }

    s.el.querySelector('#ariaSend').onclick = () => {
      const v = s.el.querySelector('#ariaInp').value.trim(); if (!v) return;
      s.el.querySelector('#ariaInp').value = '';
      handle(v);
    };
    s.el.querySelector('#ariaInp').onkeydown = (e) => { if (e.key === 'Enter') s.el.querySelector('#ariaSend').click(); };
    s.el.querySelectorAll('.qr').forEach((el) => el.onclick = () => handle(el.textContent));
    s.el.querySelector('#ariaClose').onclick = s.close;

    // Voice input
    let recorder, chunks = [], recording = false;
    s.el.querySelector('#ariaMic').onclick = async () => {
      const mic = s.el.querySelector('#ariaMic');
      if (!recording) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          recorder = new MediaRecorder(stream); chunks = [];
          recorder.ondataavailable = (e) => chunks.push(e.data);
          recorder.onstop = async () => {
            mic.textContent = 'mic'; mic.style.background = '';
            const blob = new Blob(chunks, { type: 'audio/webm' });
            let txt = '';
            try {
              if (providers.openai.hasKey()) txt = (await providers.openai.transcribe(blob)).text;
              else txt = 'book my usual laundry';
            } catch { txt = ''; }
            stream.getTracks().forEach((t) => t.stop());
            if (txt) handle(txt);
          };
          recorder.start(); recording = true;
          mic.textContent = 'stop'; mic.style.background = '#ef4444'; mic.style.color = '#fff';
        } catch { api.toast('Microphone permission needed'); }
      } else {
        recorder?.stop(); recording = false;
      }
    };
  }

  async function ariaRespond(text, ctx) {
    const lower = text.toLowerCase();
    // Tool intents (executed locally regardless of LLM availability)
    if (/balance|wallet/.test(lower)) {
      const bal = Number(localStorage.getItem('vl_wallet') || 50000);
      return `Your wallet balance is ${fmtINR(bal)}.`;
    }
    if (/top\s*up|add money/.test(lower)) {
      const m = lower.match(/\d+/); const rs = m ? Number(m[0]) : 500;
      try {
        const rzp = await providers.payments.createOrder(rs * 100, 'aria-' + Date.now());
        const r = await providers.payments.openCheckout(rzp, {});
        if (r.status === 'captured') {
          const cur = Number(localStorage.getItem('vl_wallet') || 50000);
          localStorage.setItem('vl_wallet', String(cur + rs * 100));
          ui.recordWalletTx?.(`Wallet topup (Aria)`, rs * 100);
          return `Done! Added ₹${rs} to your wallet.`;
        }
        return 'Payment cancelled.';
      } catch (e) { return 'Couldn\'t top up — ' + e.message; }
    }
    if (/cancel.*last|cancel.*recent/.test(lower)) {
      const last = ctx.orders.find((o) => ['CREATED','ASSIGNED'].includes(o.status));
      if (!last) return "You don't have a cancellable order.";
      try { await api.http('POST', `/api/orders/${last.id}/cancel`); return `Cancelled your ${last.service?.name}.`; }
      catch (e) { return e.message; }
    }
    if (/schedule|calendar|upcoming/.test(lower)) {
      const next = ctx.orders.filter((o) => !['COMPLETED','CANCELLED'].includes(o.status)).slice(0, 3);
      if (!next.length) return 'No upcoming orders.';
      return 'Upcoming:\n' + next.map((o) => `• ${o.service?.name} at ${new Date(o.scheduledAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}`).join('\n');
    }
    if (/esg|carbon|co2|saved/.test(lower)) {
      const completed = ctx.orders.filter((o) => o.status === 'COMPLETED').length;
      return `You\'ve saved ~${(completed * 0.95 + 1.2).toFixed(1)} kg of CO₂ this month — top 12% in your community.`;
    }
    if (/^book|\bbook\b|order/.test(lower)) {
      let svcId = 'svc-laundry';
      if (lower.includes('garbage') || lower.includes('trash')) svcId = 'svc-garbage';
      else if (lower.includes('car wash') || lower.includes('carwash')) svcId = 'svc-carwash';
      else if (lower.includes('grocery')) svcId = 'svc-grocery';
      else if (lower.includes('maintenance')) svcId = 'svc-maintenance';
      const svc = ctx.services.find((s) => s.id === svcId);
      try {
        const o = await api.http('POST', '/api/orders', { serviceId: svcId, scheduledAt: new Date(Date.now() + 3600 * 1000).toISOString(), notes: 'via Aria' });
        return `Booked ${svc?.name} for the next hour. Order ${o.id}.`;
      } catch (e) { return e.message; }
    }
    // LLM fallback
    if (providers.openai.hasKey()) {
      try {
        const r = await providers.openai.chat([
          { role: 'system', content: 'You are Aria, a helpful Indian household-services concierge. Be concise (<=60 words). Reply in the user\'s language.' },
          { role: 'user', content: text },
        ], { max_tokens: 200 });
        return r.choices[0].message.content;
      } catch {}
    }
    return "I can book a service, cancel your last order, top up your wallet, or show your schedule. What would you like?";
  }

  // ─── Damage / refund vision (resident) ───────────────────────────────
  // Snap photo of damaged item → vision model returns category + severity
  // + suggested compensation. One-tap accept credits the wallet.
  function damageReportSheet() {
    return new Promise((resolve) => {
      const s = ui.sheet(`
        <h3>Report damage</h3>
        <div class="desc">Snap a photo of the damaged item — AI suggests compensation.</div>
        <div class="field"><label>Photo</label>
          <input type="file" id="dmFile" accept="image/*" capture="environment" />
        </div>
        <div id="dmPrev"></div>
        <div id="dmResult" style="margin-top: 10px;"></div>
        <div class="field"><button class="btn cta block" id="dmGo" disabled>Analyse with AI</button></div>
        <div class="field"><button class="btn ghost block" id="dmCancel">Cancel</button></div>
      `);
      let dataUrl = null;
      s.el.querySelector('#dmFile').onchange = (e) => {
        const f = e.target.files[0]; if (!f) return;
        const r = new FileReader();
        r.onload = () => {
          dataUrl = r.result;
          s.el.querySelector('#dmPrev').innerHTML = `<img class="proof-img" src="${dataUrl}" />`;
          s.el.querySelector('#dmGo').disabled = false;
        };
        r.readAsDataURL(f);
      };
      s.el.querySelector('#dmCancel').onclick = () => { s.close(); resolve(null); };
      s.el.querySelector('#dmGo').onclick = async () => {
        const btn = s.el.querySelector('#dmGo'); btn.disabled = true; btn.textContent = 'Analysing…';
        let result;
        try {
          if (providers.openai.hasKey()) {
            const r = await providers.openai.chat([
              { role: 'system', content: 'You are a customer-care vision agent for a household-services platform. Inspect the photo and reply ONLY with JSON: {"category":"LAUNDRY|CARWASH|GROCERY|OTHER","severity":"MINOR|MODERATE|SEVERE","compensation_inr":<int>,"reasoning":"<one sentence>","confidence":0..1}.' },
              { role: 'user', content: [{ type: 'text', text: 'Damage report — what compensation do you suggest?' }, { type: 'image_url', image_url: { url: dataUrl } }] },
            ], { json: true, max_tokens: 250 });
            result = JSON.parse(r.choices[0].message.content);
          } else {
            await new Promise((r) => setTimeout(r, 900));
            const sevOpts = [['MINOR', 50], ['MODERATE', 150], ['SEVERE', 400]];
            const [severity, comp] = sevOpts[Math.floor(Math.random() * 3)];
            result = { category: 'LAUNDRY', severity, compensation_inr: comp, reasoning: 'Visible staining on fabric — likely transit damage.', confidence: 0.84 };
          }
        } catch (e) {
          result = { category: 'OTHER', severity: 'MODERATE', compensation_inr: 100, reasoning: 'Fallback estimate.', confidence: 0.5 };
        }
        s.el.querySelector('#dmResult').innerHTML = `<div class="reco">
          <div class="ico">${result.severity === 'SEVERE' ? 'priority_high' : 'auto_awesome'}</div>
          <div class="meta">
            <b>${result.category} · ${result.severity}</b> · suggested <b>₹${result.compensation_inr}</b>
            <div class="sub">${result.reasoning} · ${(result.confidence*100|0)}% confidence</div>
          </div>
        </div>`;
        btn.textContent = `Accept ₹${result.compensation_inr} credit`;
        btn.disabled = false;
        btn.onclick = () => {
          // Credit wallet
          const cur = Number(localStorage.getItem('vl_wallet') || 50000);
          localStorage.setItem('vl_wallet', String(cur + result.compensation_inr * 100));
          ui.recordWalletTx?.(`Damage refund (${result.category})`, result.compensation_inr * 100);
          providers.push.show('Refund credited', `₹${result.compensation_inr} added to wallet`, { icon: 'currency_rupee' });
          success();
          s.close();
          resolve(result);
        };
      };
    });
  }

  // ─── Voice biometric (mock) ─────────────────────────────────────────
  // Used to gate sensitive actions (e.g. refunds, KYC change). Records a
  // 2s sample and "matches" against the saved voiceprint with 92% conf.
  function voiceBio({ purpose = 'this action' } = {}) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'sheet-overlay open';
      overlay.innerHTML = `<div class="sheet" style="text-align:center;">
        <div class="grip"></div>
        <h3>Voice verification</h3>
        <div class="desc">Say "Hearthly verify me" to authorise ${purpose}.</div>
        <div class="voicebio">graphic_eq</div>
        <div id="vbStatus" style="font-size:13px; color:var(--muted); margin-bottom: 14px;">Listening…</div>
        <div class="field"><button class="btn ghost block" id="vbCancel">Cancel</button></div>
      </div>`;
      document.body.appendChild(overlay);
      const status = overlay.querySelector('#vbStatus');
      const cancel = () => { overlay.remove(); resolve(false); };
      overlay.querySelector('#vbCancel').onclick = cancel;
      // Mock progression
      setTimeout(() => { status.textContent = 'Capturing voiceprint…'; }, 700);
      setTimeout(() => { status.textContent = 'Matching against enrolled sample…'; }, 1600);
      setTimeout(() => {
        status.innerHTML = '<span style="color:var(--ok);">✓ Match · 94% confidence · enrolled 2 weeks ago</span>';
      }, 2500);
      setTimeout(() => { overlay.remove(); resolve(true); }, 3300);
    });
  }

  // ─── Onboarding tour (generic) ──────────────────────────────────────
  function tour(steps, key) {
    if (key && localStorage.getItem('vl_tour_' + key)) return;
    let i = 0;
    const overlay = document.createElement('div');
    overlay.className = 'sheet-overlay open';
    overlay.style.background = 'rgba(15,23,42,0.6)';
    overlay.innerHTML = `<div class="sheet" id="tourSheet" style="max-width: 360px; text-align: center;"></div>`;
    document.body.appendChild(overlay);
    function paint() {
      const s = steps[i];
      overlay.querySelector('#tourSheet').innerHTML = `
        <div class="grip"></div>
        <div style="font-size:48px; margin-bottom: 8px;">${s.emoji || '👋'}</div>
        <h3>${s.title}</h3>
        <div class="desc">${s.body}</div>
        <div style="display:flex; gap:8px; justify-content:center; margin-top: 18px; align-items: center;">
          <span class="muted" style="font-size:11px;">${i+1} / ${steps.length}</span>
          <span style="flex:1;"></span>
          ${i > 0 ? '<button class="btn ghost sm" id="tourBack">Back</button>' : ''}
          ${i < steps.length - 1 ? '<button class="btn cta sm" id="tourNext">Next</button>' : '<button class="btn cta sm" id="tourDone">Got it!</button>'}
        </div>
      `;
      overlay.querySelector('#tourBack')?.addEventListener('click', () => { i--; paint(); });
      overlay.querySelector('#tourNext')?.addEventListener('click', () => { i++; paint(); });
      overlay.querySelector('#tourDone')?.addEventListener('click', () => { if (key) localStorage.setItem('vl_tour_' + key, '1'); overlay.remove(); confetti({ pieces: 50 }); });
    }
    paint();
  }

  // ─── Dynamic-Island-style live activity (mobile, top of screen) ─────
  // Replaces the bottom banner. Morphs: dot when idle, pill when active,
  // expanded card when tapped.
  let dynEl = null, dynState = 'collapsed';
  function dynamicIsland(active) {
    if (!active) {
      if (dynEl) { dynEl.classList.remove('show'); setTimeout(() => { dynEl?.remove(); dynEl = null; }, 260); }
      return;
    }
    if (!dynEl) {
      dynEl = document.createElement('div');
      dynEl.className = 'dyn-island';
      document.body.appendChild(dynEl);
      dynEl.onclick = () => {
        dynState = dynState === 'expanded' ? 'collapsed' : 'expanded';
        renderDyn(active);
        if (dynState === 'expanded' && active.id) {
          // Tap → jump to track tab
          window.dispatchEvent(new CustomEvent('vl:goto', { detail: 'track' }));
          setTimeout(() => { dynState = 'collapsed'; renderDyn(active); }, 350);
        }
      };
    }
    renderDyn(active);
    requestAnimationFrame(() => dynEl.classList.add('show'));
  }
  function renderDyn(o) {
    if (!dynEl) return;
    const enRoute = o.enRouteAt ? new Date(o.enRouteAt).getTime() : Date.now();
    const tripMs = 60_000;
    const eta = Math.max(0, Math.ceil(((tripMs - (Date.now() - enRoute)) / tripMs) * 8));
    dynEl.dataset.state = dynState;
    if (dynState === 'collapsed') {
      dynEl.innerHTML = `
        <span class="dyn-ico" style="font-family:'Material Symbols Outlined';">${o.service?.icon || 'delivery_dining'}</span>
        <span class="dyn-eta">${eta} min</span>
        <span class="dyn-name">${o.service?.name || 'Service'}</span>
      `;
    } else {
      dynEl.innerHTML = `
        <div class="dyn-row">
          <span class="dyn-ico" style="font-family:'Material Symbols Outlined';">${o.service?.icon || 'delivery_dining'}</span>
          <div style="flex:1;">
            <div class="dyn-name" style="font-weight:700;">${o.service?.name}</div>
            <div class="dyn-sub">${o.agent?.name || 'Agent'} · ${o.status.replace('_',' ')}</div>
          </div>
          <span class="dyn-eta-big">${eta}<small>min</small></span>
        </div>
      `;
    }
  }
  // Tick every second so ETA stays fresh
  setInterval(() => { if (dynEl && dynEl.classList.contains('show')) renderDyn(JSON.parse(localStorage.getItem('vl_active_dyn') || '{}')); }, 1000);

  // ─── Smart "Book your usual" prediction ─────────────────────────────
  function smartUsualSuggestion(orders) {
    const completed = orders.filter((o) => o.status === 'COMPLETED');
    if (completed.length < 2) return null;
    const counts = {};
    completed.forEach((o) => { counts[o.serviceId] = (counts[o.serviceId] || 0) + 1; });
    const topSvc = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (!topSvc || topSvc[1] < 2) return null;
    // Predict next slot: if user usually books mornings, suggest morning
    const hours = completed.map((o) => new Date(o.scheduledAt).getHours());
    const avgHour = Math.round(hours.reduce((s, h) => s + h, 0) / hours.length);
    const next = new Date(); next.setHours(avgHour, 0, 0, 0);
    if (next < new Date()) next.setDate(next.getDate() + 1);
    return { serviceId: topSvc[0], confidence: Math.min(0.95, 0.55 + topSvc[1] * 0.08), at: next, count: topSvc[1] };
  }

  // ─── Bulk-buy coalition (mock) ──────────────────────────────────────
  function bulkBuyCoalition(serviceId) {
    const seed = serviceId.split('').reduce((s, c) => (s * 31 + c.charCodeAt(0)) | 0, 0);
    const peers = 8 + (Math.abs(seed) % 28);
    const discount = peers >= 30 ? 25 : peers >= 20 ? 18 : peers >= 10 ? 12 : 8;
    const target = peers >= 30 ? 50 : peers >= 20 ? 30 : 20;
    return { peers, target, discount, savings: 80 + (peers * 6) };
  }

  // ─── ANPR (License-plate recognition) mock ──────────────────────────
  async function anprFromPhoto(dataUrl) {
    if (providers.openai.hasKey()) {
      try {
        const r = await providers.openai.chat([
          { role: 'system', content: 'You are an ANPR system. Extract the license plate from the photo. Reply ONLY with JSON: {"plate":"<plate or null>","make":"<best guess>","model":"<best guess>","color":"<color>","confidence":0..1}' },
          { role: 'user', content: [{ type: 'text', text: 'Read the license plate.' }, { type: 'image_url', image_url: { url: dataUrl } }] },
        ], { json: true, max_tokens: 120 });
        return JSON.parse(r.choices[0].message.content);
      } catch {}
    }
    await new Promise((r) => setTimeout(r, 700));
    const plates = ['KA 03 MK 1729', 'KA 51 AB 7642', 'TS 09 EF 4521', 'MH 12 JR 8896'];
    const p = plates[Math.floor(Math.random() * plates.length)];
    return { plate: p, make: 'Hyundai', model: 'Creta', color: 'Cosmic Blue', confidence: 0.94 };
  }

  // ─── Garment recognition for laundry mock ───────────────────────────
  async function garmentRecognition(dataUrl) {
    if (providers.openai.hasKey()) {
      try {
        const r = await providers.openai.chat([
          { role: 'system', content: 'Identify garments in the photo for a laundry service quote. Reply ONLY with JSON: {"items":[{"type":"<shirt|trouser|saree|kurta|jeans|towel|other>","count":<int>,"fabric":"<cotton|silk|wool|synthetic>"}],"total_items":<int>,"estimated_kg":<number>,"quote_inr":<int>,"confidence":0..1}' },
          { role: 'user', content: [{ type: 'text', text: 'Quote this laundry pile.' }, { type: 'image_url', image_url: { url: dataUrl } }] },
        ], { json: true, max_tokens: 400 });
        return JSON.parse(r.choices[0].message.content);
      } catch {}
    }
    await new Promise((r) => setTimeout(r, 800));
    return {
      items: [
        { type: 'shirt',   count: 4, fabric: 'cotton' },
        { type: 'trouser', count: 2, fabric: 'cotton' },
        { type: 'kurta',   count: 1, fabric: 'cotton' },
        { type: 'towel',   count: 3, fabric: 'cotton' },
      ],
      total_items: 10, estimated_kg: 3.2, quote_inr: 199, confidence: 0.87,
    };
  }

  // ─── Time-of-day theming ────────────────────────────────────────────
  function applyTimeTheme() {
    const h = new Date().getHours();
    const tone = h >= 6 && h < 11 ? 'morning' : h >= 17 && h < 20 ? 'evening' : h >= 20 || h < 6 ? 'night' : 'day';
    document.documentElement.setAttribute('data-tone', tone);
  }
  applyTimeTheme();
  setInterval(applyTimeTheme, 5 * 60 * 1000);

  // Honour prefers-reduced-motion automatically (no-op — CSS does it).

  // ─── One-handed mode ────────────────────────────────────────────────
  function setOneHand(on) {
    document.documentElement.classList.toggle('one-hand', !!on);
    localStorage.setItem('vl_one_hand', on ? '1' : '0');
  }
  if (localStorage.getItem('vl_one_hand') === '1') document.documentElement.classList.add('one-hand');

  return {
    applyTheme, toggleTheme, applyFestival, setFestival, detectFestival,
    success, tap, error, chime, haptic, confetti, skel,
    liveActivity, dynamicIsland,
    esgCard, weatherNudge, getForecast,
    visitorSheet, photoServiceSheet, smartLockerSheet, plansSheet,
    spark, heatmapPoints, leaderboard, opsDigest,
    ariaSheet, damageReportSheet, voiceBio, tour,
    smartUsualSuggestion, bulkBuyCoalition, anprFromPhoto, garmentRecognition,
    applyTimeTheme, setOneHand,
  };
})();
