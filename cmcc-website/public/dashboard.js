// ─────────────────────────────────────────────────────────────────────
// Centralized Monitoring & Control Center (CMCC)
// NOC/SOC-style web console for the Hearthly HQ ops team.
// All-mock multi-community dataset, hash-router SPA.
// ─────────────────────────────────────────────────────────────────────

(() => {
  const app = document.getElementById('app');

  // ─── Operator login gate (validates token against the server) ───────
  if (!api.token() || !api.user()) { location.replace('/login.html'); return; }
  const ME = api.user();
  api.http('GET', '/api/me').catch(() => { api.setToken(null); api.setUser(null); location.replace('/login.html'); });

  // ═══ Mock dataset (deterministic-ish; seeded into localStorage) ═══
  function seed() {
    if (localStorage.getItem('vl_cmcc_seed')) {
      return JSON.parse(localStorage.getItem('vl_cmcc_seed'));
    }
    const cities = [
      { name: 'Bangalore',  state: 'KA', lat: 12.9716, lng: 77.5946 },
      { name: 'Hyderabad',  state: 'TS', lat: 17.3850, lng: 78.4867 },
      { name: 'Mumbai',     state: 'MH', lat: 19.0760, lng: 72.8777 },
      { name: 'Pune',       state: 'MH', lat: 18.5204, lng: 73.8567 },
      { name: 'Delhi NCR',  state: 'DL', lat: 28.6139, lng: 77.2090 },
      { name: 'Chennai',    state: 'TN', lat: 13.0827, lng: 80.2707 },
      { name: 'Kolkata',    state: 'WB', lat: 22.5726, lng: 88.3639 },
      { name: 'Ahmedabad',  state: 'GJ', lat: 23.0225, lng: 72.5714 },
    ];
    const builders = ['Prestige', 'Brigade', 'Sobha', 'My Home', 'Lodha', 'Godrej', 'DLF', 'Hiranandani'];
    const suffixes = ['Park', 'Heights', 'Greens', 'Towers', 'Enclave', 'Residency', 'Boulevard', 'Skyline'];

    const communities = [];
    for (let i = 0; i < 14; i++) {
      const city = cities[i % cities.length];
      const flats = 80 + Math.floor(Math.random() * 380);
      const jitter = () => (Math.random() - 0.5) * 0.06;
      communities.push({
        id: 'c' + (i + 1),
        name: builders[Math.floor(Math.random() * builders.length)] + ' ' + suffixes[Math.floor(Math.random() * suffixes.length)],
        city: city.name, state: city.state,
        lat: city.lat + jitter(), lng: city.lng + jitter(),
        flats, agentsActive: 3 + Math.floor(Math.random() * 8),
        ordersToday: 20 + Math.floor(Math.random() * 80),
        slaPct: 92 + Math.floor(Math.random() * 8),
        revenue: Math.floor(60000 + Math.random() * 240000),
        anomalies: Math.floor(Math.random() * 3),
        status: Math.random() > 0.85 ? 'WARN' : 'OK',
      });
    }

    const firstNames = ['Ravi','Priya','Arjun','Lakshmi','Karthik','Anita','Vijay','Suresh','Meera','Amit','Sunita','Manoj','Kavya','Rahul','Pooja','Deepak','Asha','Ramesh','Naveen','Geeta'];
    const lastNames  = ['Kumar','Sharma','Reddy','Singh','Iyer','Pillai','Naidu','Verma','Rao','Khan','Patel','Joshi','Gupta','Nair','Menon','Das'];
    const agents = [];
    for (let i = 0; i < 64; i++) {
      const c = communities[i % communities.length];
      agents.push({
        id: 'ag' + i,
        name: firstNames[Math.floor(Math.random() * firstNames.length)] + ' ' + lastNames[Math.floor(Math.random() * lastNames.length)],
        community: c.name, communityId: c.id,
        rating: +(4 + Math.random()).toFixed(1),
        completed: 5 + Math.floor(Math.random() * 60),
        kyc: Math.random() > 0.05 ? 'VERIFIED' : 'PENDING',
        online: Math.random() > 0.25,
        battery: 30 + Math.floor(Math.random() * 70),
      });
    }

    const services = ['Garbage','Laundry','Car Wash','Grocery','Maintenance'];
    const orders = [];
    for (let i = 0; i < 220; i++) {
      const c = communities[Math.floor(Math.random() * communities.length)];
      const ag = agents[Math.floor(Math.random() * agents.length)];
      const created = Date.now() - Math.floor(Math.random() * 24 * 3600 * 1000);
      const statuses = ['ASSIGNED','EN_ROUTE','ARRIVED','IN_PROGRESS','COMPLETED','COMPLETED','COMPLETED','CANCELLED'];
      orders.push({
        id: 'o' + i,
        community: c.name, communityId: c.id,
        agent: ag.name, agentId: ag.id,
        service: services[Math.floor(Math.random() * services.length)],
        status: statuses[Math.floor(Math.random() * statuses.length)],
        createdAt: created,
        amount: [0, 9900, 19900, 29900, 49900][Math.floor(Math.random() * 5)],
      });
    }

    const devices = [];
    communities.forEach((c) => {
      const cnt = 4 + Math.floor(Math.random() * 6);
      for (let i = 0; i < cnt; i++) {
        const fill = Math.floor(Math.random() * 100);
        devices.push({
          id: 'd-' + c.id + '-' + i,
          type: i === 0 ? 'QR_SCANNER' : 'SMART_BIN',
          label: i === 0 ? 'Gate scanner ' + (i + 1) : 'Bin ' + String.fromCharCode(65 + i) + (i + 1),
          community: c.name, communityId: c.id,
          fillLevel: i === 0 ? null : fill,
          fwVersion: Math.random() > 0.7 ? '1.4.2' : '1.5.1',
          battery: 50 + Math.floor(Math.random() * 50),
          lastSeen: Date.now() - Math.floor(Math.random() * 3600 * 1000),
          online: Math.random() > 0.05,
        });
      }
    });

    const anomalies = [];
    const types = [
      { type: 'BIN_THEFT_SUSPECTED',    sev: 'critical', icon: 'priority_high', text: 'Bin filled 22% → 95% in 4 minutes' },
      { type: 'GHOST_COMPLETION',       sev: 'critical', icon: 'person_alert',  text: 'Agent marked complete in 18s — no RFID scan' },
      { type: 'AGENT_IDLE',             sev: 'warn',     icon: 'pace',          text: 'Agent idle 40+ min during active shift' },
      { type: 'DEVICE_OFFLINE',         sev: 'warn',     icon: 'wifi_off',      text: 'Bin offline for 6+ hours' },
      { type: 'SLA_BREACH',             sev: 'warn',     icon: 'timer_off',     text: 'Service exceeded 30 min SLA' },
      { type: 'PAYMENT_RECONCILE_FAIL', sev: 'warn',     icon: 'receipt_long',  text: 'Razorpay webhook signature mismatch' },
      { type: 'BATTERY_LOW',            sev: 'info',     icon: 'battery_alert', text: 'Bin sensor battery <20%' },
      { type: 'HIGH_VOLUME',            sev: 'info',     icon: 'trending_up',   text: 'Order volume +40% vs hourly avg' },
    ];
    for (let i = 0; i < 24; i++) {
      const t = types[Math.floor(Math.random() * types.length)];
      const c = communities[Math.floor(Math.random() * communities.length)];
      anomalies.push({
        id: 'an' + i,
        ...t,
        community: c.name, communityId: c.id,
        when: Date.now() - Math.floor(Math.random() * 6 * 3600 * 1000),
        status: Math.random() > 0.7 ? 'RESOLVED' : Math.random() > 0.5 ? 'ACK' : 'OPEN',
      });
    }

    const operators = [
      { id: 'op1', name: 'Priya Iyer',    role: 'NOC Lead',     online: true },
      { id: 'op2', name: 'Sandeep Rao',   role: 'NOC Operator', online: true },
      { id: 'op3', name: 'Rakhi Menon',   role: 'NOC Operator', online: true },
      { id: 'op4', name: 'Faizan Ahmed',  role: 'On-Call SRE',  online: false },
      { id: 'op5', name: 'Akhila Reddy',  role: 'Compliance',   online: true },
    ];

    const audit = [];
    const actions = ['ACK_ANOMALY','RESOLVE_ANOMALY','SCHEDULE_OTA','QUARANTINE_DEVICE','REASSIGN_ORDER','CREATE_INCIDENT','DPDP_EXPORT','DPDP_DELETE','APPROVE_KYC','BLOCK_AGENT'];
    for (let i = 0; i < 30; i++) {
      audit.push({
        id: 'au' + i,
        actor: operators[Math.floor(Math.random() * operators.length)].name,
        action: actions[Math.floor(Math.random() * actions.length)],
        target: ['Bin d-c3-2','Order o122','Agent ag18','Community c4'][Math.floor(Math.random() * 4)],
        when: Date.now() - Math.floor(Math.random() * 24 * 3600 * 1000),
      });
    }
    audit.sort((a, b) => b.when - a.when);

    const data = { cities, communities, agents, orders, devices, anomalies, operators, audit, generatedAt: Date.now() };
    localStorage.setItem('vl_cmcc_seed', JSON.stringify(data));
    return data;
  }

  let DATA = seed();
  // Defensive: clean up any seed that has grown past expected bounds.
  // Past versions of the merge logic could persist mobile-linked devices
  // into DATA, so the seeded counts could climb across sessions and bog
  // down paint() (DATA.devices > 200 in the wild). Cap and reset if bad.
  const MAX_SEED_DEVICES = 140;
  if ((DATA.devices?.length || 0) > MAX_SEED_DEVICES) {
    console.warn('[CMCC] seed devices grew to', DATA.devices.length, '— resetting');
    localStorage.removeItem('vl_cmcc_seed');
    DATA = seed();
  }
  let NETWORK = { devices: [] }; // populated from /api/cmcc/network
  let LIVE = null;               // merged view rebuilt every paint

  // ─── Merge live mobile state into the network view ─────────────────
  // Two inputs:
  //   (a) localStorage `vl_state_v1` — same-browser case (open both
  //       /resident.html and /cmcc.html in tabs)
  //   (b) polled /api/cmcc/network — cross-device case (phone APK
  //       heartbeating to the server while CMCC runs on a laptop)
  function readMobileLocal() {
    try { return JSON.parse(localStorage.getItem('vl_state_v1') || 'null'); } catch { return null; }
  }
  function buildLive() {
    // Start with the seed snapshot (deep-ish copy of the parts we mutate).
    // Source is DATA — LIVE is the *result* of this function and is null
    // on first call.
    const live = {
      ...DATA,
      communities: DATA.communities.slice(),
      agents: DATA.agents.slice(),
      orders: DATA.orders.slice(),
      devices: DATA.devices.slice(),
      anomalies: DATA.anomalies.slice(),
    };
    // (a) Merge same-browser localStorage state.
    const local = readMobileLocal();
    if (local) mergeMobileSnapshot(live, local, 'browser:' + (api.deviceId?.() || 'self'));
    // (b) Merge each remote device snapshot.
    (NETWORK.devices || []).forEach((d) => mergeMobileSnapshot(live, d.state, d.deviceId));
    return live;
  }

  function mergeMobileSnapshot(live, snap, source) {
    if (!snap || !snap.users) return;
    // Resolve / inject the community.
    const commName = snap.community?.name || 'Prestige Sunrise Park';
    let comm = live.communities.find((c) => c.name === commName);
    if (!comm) {
      comm = {
        id: 'mob-' + commName.replace(/\s+/g,'-').toLowerCase(),
        name: commName,
        city: snap.community?.city || 'Bangalore', state: 'KA',
        lat: 12.9120, lng: 77.6035,
        flats: Object.keys(snap.flats || {}).length,
        agentsActive: 0, ordersToday: 0, slaPct: 100,
        revenue: 0, anomalies: 0, status: 'OK',
        mobileLinked: true,
      };
      live.communities.unshift(comm);
    }
    comm.mobileLinked = true;
    // Agents from mobile users.
    Object.values(snap.users || {}).forEach((u) => {
      if (u.role !== 'AGENT') return;
      if (live.agents.find((a) => a.id === u.id)) return;
      live.agents.unshift({
        id: u.id, name: u.name || u.phone, community: comm.name, communityId: comm.id,
        rating: 4.9,
        completed: (snap.orders || []).filter((o) => o.agentId === u.id && o.status === 'COMPLETED').length,
        kyc: 'VERIFIED', online: true, battery: 95, mobileLinked: true, source,
      });
    });
    // Orders.
    const newOrders = (snap.orders || []).map((o) => {
      const ag = Object.values(snap.users || {}).find((u) => u.id === o.agentId);
      const svc = (snap.services || []).find((s) => s.id === o.serviceId);
      return {
        id: o.id,
        community: comm.name, communityId: comm.id,
        agent: ag?.name || '—', agentId: o.agentId,
        service: (svc?.name || o.serviceId || '').replace(' Pickup', ''),
        status: o.status,
        createdAt: typeof o.createdAt === 'string' ? new Date(o.createdAt).getTime() : (o.createdAt || Date.now()),
        amount: o.amount || 0,
        mobileLinked: true, source,
      };
    });
    // De-duplicate (same id may exist from a previous merge pass).
    const seen = new Set(live.orders.map((o) => o.id));
    newOrders.forEach((o) => { if (!seen.has(o.id)) live.orders.unshift(o); });
    // Devices.
    Object.values(snap.devices || {}).forEach((d) => {
      if (live.devices.find((x) => x.id === d.id)) return;
      live.devices.unshift({
        id: d.id, type: d.type,
        label: d.label, community: comm.name, communityId: comm.id,
        fillLevel: d.fillLevel ?? null,
        fwVersion: '1.5.1', battery: 95,
        lastSeen: d.lastSeen || Date.now(),
        online: d.online !== false,
        mobileLinked: true, source,
      });
    });
    // Recompute community KPIs from merged orders.
    const todayOrders = live.orders.filter((o) => o.communityId === comm.id);
    comm.ordersToday = todayOrders.length;
    comm.revenue = todayOrders.reduce((s, o) => s + (o.amount || 0), 0);
    comm.agentsActive = live.agents.filter((a) => a.communityId === comm.id && a.online).length;
  }

  // Cross-device polling — every 10s, check the server's aggregated state.
  // Routes that depend on live network data — only these get auto-repainted
  // when the polling loop fires. Static views like analytics, ai, audit,
  // settings, simulation, compare don't need rebuilding every 10 s and
  // doing so caused page lockups in HI mode (the i18n MutationObserver
  // had to re-translate the whole subtree each paint).
  const LIVE_DATA_ROUTES = new Set(['', 'overview', 'iot', 'orders', 'anomalies', 'communities', 'agents']);
  let _lastNetworkSig = '';
  let _polling = false;
  async function pollNetwork() {
    // Single-flight: never overlap two fetches. Cold-start delays on
    // Vercel functions could otherwise pile multiple in-flight requests.
    if (_polling) return;
    _polling = true;
    try {
      const r = await fetch('/api/cmcc/network', {
        headers: api.token() ? { Authorization: 'Bearer ' + api.token() } : {},
      });
      if (!r.ok) return;
      NETWORK = await r.json();
    } catch { /* server unreachable, keep last */ }
    finally { _polling = false; }
  }
  pollNetwork();
  // Background refresh of NETWORK state ONLY — never auto-paint. Auto-
  // paint of full views in Hindi mode caused the page-unresponsive bug
  // even at 30-60s intervals (every paint = full DOM rebuild + i18n
  // traversal + Leaflet teardown/re-init). The user sees fresh data on
  // their next navigation or manual refresh, which is the right UX
  // trade-off for a Hobby-tier deploy.
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    pollNetwork();
  }, 30_000);

  // Listen for same-browser mobile mutations.
  window.addEventListener('storage', (e) => {
    if (!e.key) return;
    if (e.key === 'vl_state_v1' || e.key.startsWith('vl_')) paint();
  });

  // ═══ Helpers ════════════════════════════════════════════════════════
  const $ = (sel, root = document) => root.querySelector(sel);
  const fmtINR = (paise) => paise ? '₹ ' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '—';
  const fmtAbbr = (n) => n >= 10000000 ? (n / 10000000).toFixed(1) + ' Cr' : n >= 100000 ? (n / 100000).toFixed(1) + ' L' : n.toLocaleString('en-IN');
  const fmtAgo = (ms) => {
    const s = Math.floor((Date.now() - ms) / 1000);
    if (s < 60)   return s + 's ago';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  };
  const sevClass = (s) => s === 'critical' ? 'critical' : s === 'warn' ? 'warn' : s === 'info' ? 'info' : 'ok';

  function spark(data, opts = {}) {
    const w = 120, h = 36;
    if (!data?.length) data = Array(12).fill(0).map(() => Math.random() * 10 + 2);
    const max = Math.max(...data, 1), min = Math.min(...data);
    const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / (max - min || 1)) * (h - 4) - 2}`);
    const linePath = `M ${pts.join(' L ')}`;
    const fillPath = `${linePath} L ${w},${h} L 0,${h} Z`;
    return `<svg class="sp ${opts.cls || ''}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <path class="fill" d="${fillPath}"/>
      <path class="line" d="${linePath}"/>
    </svg>`;
  }

  function hashSeries(seed, n, base, vol) {
    const out = [];
    let s = 0; for (const c of seed) s = (s * 31 + c.charCodeAt(0)) | 0;
    for (let i = 0; i < n; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      out.push(base + Math.sin(i / 1.5) * vol + ((s & 0xff) / 255) * vol * 0.5);
    }
    return out;
  }

  // ═══ Routes ═════════════════════════════════════════════════════════
  const ROUTES = {
    '': overview, 'overview': overview,
    'communities': communitiesView, 'agents': agentsView, 'orders': ordersView,
    'iot': iotView, 'anomalies': anomaliesView, 'analytics': analyticsView,
    'ai': aiView, 'compliance': complianceView, 'audit': auditView,
    'team': teamView, 'settings': settingsView,
  };
  function currentRoute() { return (location.hash || '#overview').slice(1); }
  function navigate(r) { location.hash = '#' + r; }

  // ═══ Shell render ═══════════════════════════════════════════════════
  function paint() {
    // Pause i18n observer for the duration of the paint — innerHTML
    // rewrites would otherwise fire thousands of mutation events,
    // each translated synchronously. resumeI18n() runs one batch
    // translateNode() pass over the new tree.
    api.pauseI18n?.();
    try {
      _paint();
    } catch (e) {
      console.error('CMCC paint() failed:', e);
      const dataKeys = (() => { try { return Object.keys(JSON.parse(localStorage.getItem('vl_cmcc_seed') || '{}')); } catch { return []; }})();
      app.innerHTML = `<div style="padding:40px; color:#fff; font-family: monospace; max-width: 100%; box-sizing: border-box;">
        <h2 style="color:#ef4444; font-family: 'Inter', sans-serif;">CMCC dashboard error</h2>
        <pre style="background:#1a1a1a; padding:14px; border-radius:8px; overflow:auto; white-space: pre-wrap; word-wrap: break-word; max-width: 100%; font-size: 12px; line-height: 1.5;">${(e.stack || e.message || String(e)).replace(/</g, '&lt;')}</pre>
        <div style="background:#1a1a1a; padding:14px; border-radius:8px; margin-top: 10px; font-size: 12px;">
          <b>Seed data keys present:</b> ${dataKeys.join(', ') || '<i>none</i>'}
        </div>
        <p style="color:#94a3b8; font-family: 'Inter', sans-serif;">A stale or partial seed in localStorage usually causes this. Tap "Reset data" — it wipes the dashboard's local cache and reloads with a fresh seed.</p>
        <div style="display: flex; gap: 8px; margin-top: 14px;">
          <button id="errReset" style="padding:10px 16px; background:#38bdf8; border:0; border-radius:8px; color:#052030; font-weight:700; cursor:pointer; font-family: 'Inter', sans-serif;">Reset data</button>
          <button id="errLogout" style="padding:10px 16px; background:transparent; border:1px solid #1a2540; border-radius:8px; color:#cbd5e1; cursor:pointer; font-family: 'Inter', sans-serif;">Sign out</button>
        </div>
      </div>`;
      document.getElementById('errReset').onclick = () => { localStorage.removeItem('vl_cmcc_seed'); location.reload(); };
      document.getElementById('errLogout').onclick = () => api.logout();
    } finally {
      // Resume the observer and run a single batched HI translation pass
      // over the freshly-rendered DOM.
      api.resumeI18n?.();
    }
  }
  function _paint() {
    const route = currentRoute();
    const renderer = ROUTES[route] || overview;
    LIVE = buildLive();
    app.innerHTML = `
      ${sidebar(route)}
      ${topbar(route)}
      <main class="cmd-main" id="main"></main>
      ${ticker()}
    `;
    renderer($('#main'));
    document.querySelectorAll('.cmd-side a[data-route]').forEach((a) => a.onclick = (e) => { e.preventDefault(); navigate(a.dataset.route); });
    document.getElementById('cmccLogout').onclick = () => api.logout();
    // Topbar handlers — must be wired in paint(), not in any single
    // route renderer, so they keep working when the user navigates.
    const incidentBtn = document.getElementById('incidentBtn');
    if (incidentBtn) incidentBtn.onclick = () => createIncidentSheet();
    const perCommBtn = document.getElementById('perCommBtn');
    if (perCommBtn) perCommBtn.onclick = () => {
      // Resolve the mobile-app URL the same way the mobile resolves CMCC.
      // Order: ?mobile=<url>, localStorage, window.HEARTHLY_MOBILE_URL,
      // /admin.html on this origin, http://localhost:3030.
      const params = new URLSearchParams(location.search);
      const override = params.get('mobile');
      if (override) localStorage.setItem('vl_mobile_url', override);
      const stored = localStorage.getItem('vl_mobile_url');
      const envUrl = window.HEARTHLY_MOBILE_URL;
      let base;
      if (stored) base = stored;
      else if (envUrl) base = envUrl;
      else if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') base = 'http://localhost:3030';
      else base = 'https://hearthly-drab.vercel.app'; // production sibling project
      window.open(base.replace(/\/$/, '') + '/admin.html', '_blank');
    };
    const bellBtn = document.getElementById('bellBtn');
    const bellBadge = document.getElementById('bellBadge');
    function refreshBell() {
      const n = providers.push.unread();
      if (bellBadge) bellBadge.textContent = n ? String(n) : '';
      if (bellBadge) bellBadge.style.display = n ? '' : 'none';
    }
    refreshBell();
    if (bellBtn) bellBtn.onclick = () => { ui.inbox(); setTimeout(refreshBell, 100); };
    window.addEventListener('vl:push', refreshBell);
    // Topbar search wires into the global command palette (cmcc-pro.js).
    const searchInp = document.querySelector('.cmd-top .search input');
    if (searchInp) {
      const open = () => { window.cmccPro?.openPalette?.(); searchInp.blur(); };
      searchInp.onfocus = open;
      searchInp.onclick = open;
    }
    // Theme toggle on the CMCC operator console is currently a no-op.
    // The console's legacy chrome (sidebar, topbar, ticker) is hard-
    // coded dark via legacy --bg/--surface tokens that aren't theme-
    // aware. The previous handler toggled [data-cmd] off, which only
    // flipped the *new* design-system tokens to light — the legacy
    // chrome stayed dark, producing a half-flipped state with white
    // cards on a dark canvas.
    //
    // Re-introduce a working light mode for CMCC in Phase 6 by adding
    // a light variant of the legacy palette and tying it to the
    // toggle. Until then we keep the operator console permanently
    // dark and surface a small toast explaining the choice.
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
      themeBtn.onclick = () => {
        // Keep [data-cmd] in place so the new design-system tokens
        // continue to resolve to dark.
        if (!document.documentElement.hasAttribute('data-cmd')) {
          document.documentElement.setAttribute('data-cmd', '');
        }
        api.toast?.('Operator console is dark-only for now');
      };
      // Visually demote the button — Phase 6 will replace it with a
      // working theme switcher.
      themeBtn.style.opacity = '0.35';
      themeBtn.title = 'Operator console is dark-only';
    }
    // Self-heal: if a previous session toggled data-cmd off, restore
    // it on next paint so cards re-cascade to dark.
    if (!document.documentElement.hasAttribute('data-cmd')) {
      document.documentElement.setAttribute('data-cmd', '');
    }
    const langSel = document.getElementById('cmccLang');
    if (langSel) langSel.onchange = (e) => api.setLang(e.target.value);
  }

  function sidebar(route) {
    const openAlerts = LIVE.anomalies.filter((a) => a.status === 'OPEN').length;
    const item = (id, ico, label, badge) =>
      `<a data-route="${id}" class="${route === id ? 'active' : ''}"><span class="ico">${ico}</span><span class="nm">${label}</span>${badge ? `<span class="pill">${badge}</span>` : ''}</a>`;
    return `
      <aside class="cmd-side">
        <div class="brand">
          <div class="mark">hub</div>
          <div>
            <div class="t1">Hearthly</div>
            <div class="t2">CMCC · LIVE</div>
          </div>
        </div>
        <div class="section-h">Monitor</div>
        ${item('overview',    'dashboard',    'Overview')}
        ${item('anomalies',   'crisis_alert', 'Anomalies', openAlerts || '')}
        ${item('iot',         'sensors',      'IoT Fleet')}
        ${item('analytics',   'insights',     'Analytics')}
        <div class="section-h">Operate</div>
        ${item('communities', 'apartment',    'Communities')}
        ${item('agents',      'engineering',  'Agents')}
        ${item('orders',      'receipt_long', 'Orders')}
        <div class="section-h">Govern</div>
        ${item('ai',          'auto_awesome', 'AI Insights')}
        ${item('compliance',  'verified',     'Compliance')}
        ${item('audit',       'history',      'Audit Log')}
        ${item('team',        'groups',       'Team')}
        ${item('settings',    'settings',     'Settings')}
        <div class="operator">
          <div class="av">${(ME.name || ME.phone).split(' ').map((s) => s[0]).slice(0,2).join('')}</div>
          <div style="flex:1;"><div class="nm">${ME.name || ME.phone}</div><div class="rl">${ME.opRole || ME.role}</div></div>
          <button class="cmd-btn" id="cmccLogout" title="Sign out" style="padding:4px 8px;"><span style="font-family:'Material Symbols Outlined'; font-size:14px;">logout</span></button>
        </div>
      </aside>`;
  }

  function topbar(route) {
    const labels = {
      overview:'Overview', communities:'Communities', agents:'Agents', orders:'Orders',
      iot:'IoT Fleet', anomalies:'Anomalies', analytics:'Analytics',
      ai:'AI Insights', compliance:'Compliance', audit:'Audit Log',
      team:'Team', settings:'Settings',
    };
    return `
      <header class="cmd-top">
        <div class="breadcrumb">CMCC / <b>${labels[route] || route}</b></div>
        <div class="search"><span style="font-family:'Material Symbols Outlined'; color: var(--muted); font-size:18px;">search</span>
          <input placeholder="Search community, agent, order, device..." />
          <span class="kbd">⌘K</span>
        </div>
        <div class="spacer"></div>
        ${(() => {
          const live = (LIVE.orders || []).filter((o) => o.mobileLinked).length
                     + (LIVE.devices || []).filter((d) => d.mobileLinked).length
                     + (LIVE.agents || []).filter((a) => a.mobileLinked).length;
          return live ? `<span class="status-pill" style="background: rgba(56,189,248,.1); color: var(--brand); border-color: rgba(56,189,248,.3);">${live} mobile-linked</span>` : '';
        })()}
        <span class="status-pill">All systems nominal</span>
        <button class="tb-btn" id="incidentBtn"><span class="ico">add_alert</span>Create incident</button>
        <button class="tb-btn" id="perCommBtn"><span class="ico">open_in_new</span>Per-community</button>
        <button class="tb-btn bell-tb" id="bellBtn" title="Notifications"><span class="ico">notifications</span><span class="badge-num" id="bellBadge"></span></button>
        <select class="tb-btn" id="cmccLang" title="Language" style="padding: 0 10px;">
          <option value="EN" ${api.lang() === 'EN' ? 'selected' : ''}>EN</option>
          <option value="HI" ${api.lang() === 'HI' ? 'selected' : ''}>हि</option>
        </select>
        <button class="tb-btn" id="themeToggle" title="Toggle theme"><span class="ico">contrast</span></button>
      </header>`;
  }

  function ticker() {
    const events = [
      ...LIVE.anomalies.slice(0, 8).map((a) => ({ cls: a.sev === 'critical' ? 'bad' : a.sev === 'warn' ? 'warn' : 'ok', text: `${a.community}: ${a.text}` })),
      ...LIVE.orders.filter((o) => o.status === 'COMPLETED').slice(0, 8).map((o) => ({ cls: 'ok', text: `${o.community}: ${o.service} completed by ${o.agent}` })),
      ...LIVE.devices.filter((d) => d.fillLevel >= 80).slice(0, 4).map((d) => ({ cls: 'warn', text: `${d.label} (${d.community}) at ${d.fillLevel}%` })),
    ];
    return `
      <div class="cmd-ticker">
        <span class="tag">LIVE FEED</span>
        <div class="stream"><div class="strip">${events.map((e) => `<span class="${e.cls}">▶ ${e.text}</span>`).join('')}</div></div>
      </div>`;
  }

  // ═══ Pages ══════════════════════════════════════════════════════════

  // Overview ----------------------------------------------------------
  function overview(root) {
    const totalOrders = LIVE.orders.length;
    const completed   = LIVE.orders.filter((o) => o.status === 'COMPLETED').length;
    const active      = LIVE.orders.filter((o) => !['COMPLETED','CANCELLED'].includes(o.status)).length;
    const revenue     = LIVE.orders.reduce((s, o) => s + (o.amount || 0), 0);
    const onlineAg    = LIVE.agents.filter((a) => a.online).length;
    const fullBins    = LIVE.devices.filter((d) => d.type === 'SMART_BIN' && d.fillLevel >= 80).length;
    const offline     = LIVE.devices.filter((d) => !d.online).length;
    const slaPct      = (LIVE.communities.reduce((s, c) => s + c.slaPct, 0) / LIVE.communities.length).toFixed(1);

    root.innerHTML = `
      <div>
        <h2>Live network status <span class="cmd-badge ok" style="font-size:11px;">14 communities · 8 cities</span></h2>
        <div class="subhead">Updated ${new Date().toLocaleTimeString()}</div>
      </div>

      <div class="cmd-grid cols-4">
        <div class="cmd-card cmd-kpi glow"><div class="lbl">Active orders</div><div class="val">${active}</div><div class="delta up">▲ 12% vs yesterday</div>${spark(hashSeries('o', 24, 18, 8))}</div>
        <div class="cmd-card cmd-kpi glow"><div class="lbl">Revenue today</div><div class="val">${fmtINR(revenue)}</div><div class="delta up">▲ 8.4%</div>${spark(hashSeries('r', 24, 80, 40), { cls: 'ok' })}</div>
        <div class="cmd-card cmd-kpi glow"><div class="lbl">SLA compliance</div><div class="val">${slaPct}%</div><div class="delta ${slaPct < 95 ? 'down' : 'up'}">target 95%</div>${spark(hashSeries('s', 24, 95, 4), { cls: slaPct >= 95 ? 'ok' : 'warn' })}</div>
        <div class="cmd-card cmd-kpi glow"><div class="lbl">Open anomalies</div><div class="val">${LIVE.anomalies.filter((a) => a.status === 'OPEN').length}</div><div class="delta down">${LIVE.anomalies.filter((a) => a.sev === 'critical').length} critical</div>${spark(hashSeries('a', 24, 5, 4), { cls: 'bad' })}</div>
      </div>

      <div class="cmd-grid cols-4">
        <div class="cmd-card cmd-kpi"><div class="lbl">Agents online</div><div class="val">${onlineAg}/${LIVE.agents.length}</div></div>
        <div class="cmd-card cmd-kpi"><div class="lbl">Full bins ≥80%</div><div class="val">${fullBins}</div></div>
        <div class="cmd-card cmd-kpi"><div class="lbl">Devices offline</div><div class="val">${offline}</div></div>
        <div class="cmd-card cmd-kpi"><div class="lbl">Completed today</div><div class="val">${completed}</div></div>
      </div>

      <div class="cmd-grid cols-2">
        <div class="cmd-card">
          <h3>National live map <span class="live">live</span></h3>
          <div class="cmd-map" id="overviewMap">
            <div class="legend">
              <span><span class="dot" style="background: var(--ok);"></span>OK</span>
              <span><span class="dot" style="background: var(--warn);"></span>Warn</span>
              <span><span class="dot" style="background: var(--danger);"></span>Critical</span>
            </div>
          </div>
        </div>
        <div class="cmd-card">
          <h3>Anomaly feed <span class="live">live</span></h3>
          <div class="cmd-alerts" style="max-height: 400px; overflow-y: auto;">
            ${LIVE.anomalies.filter((a) => a.status !== 'RESOLVED').slice(0, 8).map((a) => alertRow(a)).join('')}
          </div>
        </div>
      </div>

      <div class="cmd-grid cols-2">
        <div class="cmd-card">
          <h3>Top communities by activity</h3>
          <table class="cmd-table">
            <thead><tr><th>Community</th><th>City</th><th>Orders</th><th>SLA</th><th>Status</th></tr></thead>
            <tbody>
              ${LIVE.communities.slice().sort((a, b) => b.ordersToday - a.ordersToday).slice(0, 6).map((c) => `
                <tr>
                  <td><b>${c.name}</b></td>
                  <td>${c.city}</td>
                  <td>${c.ordersToday}</td>
                  <td>${c.slaPct}%</td>
                  <td><span class="cmd-badge ${c.status === 'OK' ? 'ok' : 'warn'}">${c.status}</span></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div class="cmd-card">
          <h3>Recent control actions</h3>
          <table class="cmd-table">
            <thead><tr><th>When</th><th>Operator</th><th>Action</th><th>Target</th></tr></thead>
            <tbody>
              ${DATA.audit.slice(0, 6).map((a) => `<tr>
                <td>${fmtAgo(a.when)}</td>
                <td>${a.actor}</td>
                <td><span class="cmd-badge info">${a.action}</span></td>
                <td>${a.target}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    setTimeout(() => mountIndiaMap(document.getElementById('overviewMap')), 50);
    wireAlertActions();
  }

  function mountIndiaMap(container) {
    if (!window.L || !container) return;
    container.querySelectorAll('.leaflet-container').forEach((x) => x.remove());
    const div = document.createElement('div');
    div.style.cssText = 'position:absolute; inset:0;';
    container.appendChild(div);
    const m = L.map(div, { zoomControl: false, attributionControl: true }).setView([22.0, 79.0], 5);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
      subdomains: 'abcd', maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(m);
    LIVE.communities.forEach((c) => {
      const color = c.anomalies > 0 ? '#ef4444' : c.status === 'WARN' ? '#f59e0b' : '#10b981';
      const r = 6 + Math.min(8, c.ordersToday / 10);
      L.circleMarker([c.lat, c.lng], {
        radius: r, color: color, fillColor: color, fillOpacity: 0.6, weight: 2,
      }).addTo(m).bindPopup(`<b>${c.name}</b><br/>${c.city} · ${c.flats} flats<br/>${c.ordersToday} orders today · SLA ${c.slaPct}%`);
    });
  }

  function alertRow(a) {
    return `<div class="alert ${a.sev}">
      <div class="bar"></div>
      <div class="ico">${a.icon}</div>
      <div>
        <div class="ttl">${a.text}</div>
        <div class="sub">${a.community} · ${fmtAgo(a.when)} · ${a.type}</div>
      </div>
      <div class="acts">
        <button class="cmd-btn" data-ack="${a.id}">Ack</button>
        <button class="cmd-btn primary" data-resolve="${a.id}">Resolve</button>
      </div>
    </div>`;
  }
  function wireAlertActions() {
    document.querySelectorAll('[data-ack]').forEach((b) => b.onclick = () => {
      const an = LIVE.anomalies.find((x) => x.id === b.dataset.ack);
      if (!an) return;
      an.status = 'ACK';
      saveData();
      writeAudit('ACK_ANOMALY', an.id);
      paint();
    });
    document.querySelectorAll('[data-resolve]').forEach((b) => b.onclick = () => {
      const an = LIVE.anomalies.find((x) => x.id === b.dataset.resolve);
      if (!an) return;
      an.status = 'RESOLVED';
      saveData();
      writeAudit('RESOLVE_ANOMALY', an.id);
      paint();
    });
  }
  function saveData() { localStorage.setItem('vl_cmcc_seed', JSON.stringify(DATA)); }
  function writeAudit(action, target) {
    DATA.audit.unshift({ id: 'au' + Date.now(), actor: ME.name || ME.phone, action, target, when: Date.now() });
    saveData();
  }

  // Communities -------------------------------------------------------
  function communitiesView(root) {
    root.innerHTML = `
      <div><h2>Communities <span class="cmd-badge info">${LIVE.communities.length}</span></h2></div>
      <div class="cmd-grid" style="gap:10px;">
        ${LIVE.communities.map((c) => `
          <div class="community-row">
            <div class="logo">${c.name.split(' ').map((s) => s[0]).slice(0,2).join('')}</div>
            <div>
              <div class="nm">${c.name} ${c.mobileLinked ? '<span class="cmd-badge info" title="has mobile users">📱 LIVE</span>' : ''}</div>
              <div class="loc">${c.city}, ${c.state} · ${c.flats} flats · ${c.agentsActive} agents online</div>
            </div>
            <div class="kpi"><div class="v">${c.ordersToday}</div><div class="l">Orders</div></div>
            <div class="kpi"><div class="v">${c.slaPct}%</div><div class="l">SLA</div></div>
            <div class="kpi"><div class="v">${fmtINR(c.revenue)}</div><div class="l">Revenue today</div></div>
          </div>`).join('')}
      </div>`;
  }

  // Agents ------------------------------------------------------------
  function agentsView(root) {
    const sorted = LIVE.agents.slice().sort((a, b) => b.completed - a.completed);
    root.innerHTML = `
      <div><h2>Agents <span class="cmd-badge info">${LIVE.agents.length}</span> <span class="cmd-badge ok" style="margin-left:6px;">${LIVE.agents.filter((a) => a.online).length} online</span></h2></div>
      <div class="cmd-grid cols-3">
        ${sorted.slice(0, 24).map((a) => `
          <div class="agent-card">
            <div class="av">${a.name.split(' ').map((s) => s[0]).slice(0,2).join('')}</div>
            <div class="meta">
              <div class="nm">${a.name} ${a.kyc === 'VERIFIED' ? '<span class="cmd-badge ok" style="margin-left:4px;">KYC</span>' : '<span class="cmd-badge warn" style="margin-left:4px;">KYC PENDING</span>'} ${a.mobileLinked ? '<span class="cmd-badge info" style="margin-left:4px;" title="active in mobile app">📱</span>' : ''}</div>
              <div class="loc">${a.community} · ${a.completed} services this week</div>
            </div>
            <div style="text-align:right;">
              <div class="rating">★ ${a.rating}</div>
              <div class="cmd-badge ${a.online ? 'ok' : 'mute'}" style="margin-top:4px;">${a.online ? 'ONLINE' : 'OFFLINE'}</div>
            </div>
          </div>`).join('')}
      </div>`;
  }

  // Orders ------------------------------------------------------------
  function ordersView(root) {
    const sorted = LIVE.orders.slice().sort((a, b) => b.createdAt - a.createdAt);
    root.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px;">
        <h2>Orders <span class="cmd-badge info">${LIVE.orders.length}</span></h2>
        <div style="flex:1;"></div>
        <select id="ordFilter">
          <option value="">All statuses</option>
          ${['ASSIGNED','EN_ROUTE','ARRIVED','IN_PROGRESS','COMPLETED','CANCELLED'].map((s) => `<option>${s}</option>`).join('')}
        </select>
      </div>
      <div class="cmd-card" style="padding: 0;">
        <table class="cmd-table">
          <thead><tr><th>Order</th><th>Service</th><th>Community</th><th>Agent</th><th>Status</th><th>Amount</th><th>Created</th></tr></thead>
          <tbody id="ordBody">
            ${rowsFor(sorted)}
          </tbody>
        </table>
      </div>`;
    document.getElementById('ordFilter').onchange = (e) => {
      const f = e.target.value;
      document.getElementById('ordBody').innerHTML = rowsFor(sorted.filter((o) => !f || o.status === f));
    };
    function rowsFor(list) {
      return list.slice(0, 60).map((o) => `<tr>
        <td style="font-family: 'JetBrains Mono', monospace; color: var(--muted);">${o.id} ${o.mobileLinked ? '<span class="cmd-badge info" title="from mobile app">📱 LIVE</span>' : ''}</td>
        <td><b>${o.service}</b></td>
        <td>${o.community} ${o.mobileLinked ? '' : ''}</td>
        <td>${o.agent}</td>
        <td><span class="cmd-badge ${o.status === 'COMPLETED' ? 'ok' : o.status === 'CANCELLED' ? 'bad' : 'info'}">${o.status.replace('_',' ')}</span></td>
        <td>${fmtINR(o.amount)}</td>
        <td>${fmtAgo(o.createdAt)}</td>
      </tr>`).join('');
    }
  }

  // IoT Fleet ---------------------------------------------------------
  function iotView(root) {
    const bins = LIVE.devices.filter((d) => d.type === 'SMART_BIN');
    const stale = LIVE.devices.filter((d) => d.fwVersion === '1.4.2');
    root.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px;">
        <h2>IoT Fleet <span class="cmd-badge info">${LIVE.devices.length}</span></h2>
        <div style="flex:1;"></div>
        <button class="cmd-btn primary" id="bulkOta"><span>Schedule fleet OTA</span> (${stale.length})</button>
      </div>
      <div class="cmd-grid cols-4">
        <div class="cmd-card cmd-kpi"><div class="lbl">Total bins</div><div class="val">${bins.length}</div></div>
        <div class="cmd-card cmd-kpi"><div class="lbl">≥80% fill</div><div class="val">${bins.filter((b) => b.fillLevel >= 80).length}</div></div>
        <div class="cmd-card cmd-kpi"><div class="lbl">Offline</div><div class="val">${LIVE.devices.filter((d) => !d.online).length}</div></div>
        <div class="cmd-card cmd-kpi"><div class="lbl">Need OTA</div><div class="val">${stale.length}</div></div>
      </div>
      <div class="cmd-card">
        <h3>Smart bins by community ${bins.length > 48 ? `<span class="cmd-badge info" style="margin-left:6px;">showing 48 of ${bins.length}</span>` : ''}</h3>
        <div class="cmd-grid cols-4" id="binsGrid">
          ${bins.slice(0, 48).map((b) => {
            const cls = b.fillLevel >= 80 ? 'critical' : b.fillLevel >= 60 ? 'warn' : '';
            return `<div class="dev-card ${cls}" data-dev="${b.id}">
              <div class="dr"><span>${b.community.split(' ').slice(0, 2).join(' ')}${b.mobileLinked ? ' 📱' : ''}</span><span>${b.fwVersion}${b.fwVersion === '1.4.2' ? ' ⚠' : ''}</span></div>
              <div class="nm">${b.label}</div>
              <div class="bar"><div style="width:${b.fillLevel}%"></div></div>
              <div class="dr"><span>${b.fillLevel}% · 🔋${b.battery}%</span><span>${fmtAgo(b.lastSeen)}</span></div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    document.getElementById('bulkOta').onclick = () => {
      stale.forEach((d) => { d.fwVersion = '1.5.1'; });
      saveData();
      writeAudit('SCHEDULE_OTA', `${stale.length} devices`);
      providers.push.show('OTA scheduled', `${stale.length} devices → v1.5.1 (Ed25519-signed)`, { icon: 'system_update' });
      paint();
    };
    document.querySelectorAll('[data-dev]').forEach((el) => el.onclick = () => {
      const d = LIVE.devices.find((x) => x.id === el.dataset.dev);
      ui.scheduleOta(d);
    });
  }

  // Anomalies ---------------------------------------------------------
  function anomaliesView(root) {
    root.innerHTML = `
      <div><h2>Anomalies & incidents</h2><div class="subhead">${LIVE.anomalies.filter((a) => a.status === 'OPEN').length} open · ${LIVE.anomalies.filter((a) => a.status === 'ACK').length} acknowledged · ${LIVE.anomalies.filter((a) => a.status === 'RESOLVED').length} resolved</div></div>
      <div class="cmd-card cmd-alerts" style="padding:0;">
        ${LIVE.anomalies.slice().sort((a, b) => b.when - a.when).map((a) => alertRow(a)).join('')}
      </div>`;
    wireAlertActions();
  }

  // Analytics ---------------------------------------------------------
  function analyticsView(root) {
    const series = hashSeries('rev', 14, 100, 60);
    const max = Math.max(...series);
    const w = 800, h = 220, bw = w / series.length - 6;
    root.innerHTML = `
      <div><h2>Analytics</h2></div>
      <div class="cmd-grid cols-3">
        <div class="cmd-card cmd-kpi"><div class="lbl">MRR</div><div class="val">₹ 18.4 L</div><div class="delta up">▲ 12.1% MoM</div>${spark(hashSeries('mrr', 12, 80, 30), { cls: 'ok' })}</div>
        <div class="cmd-card cmd-kpi"><div class="lbl">Active residents</div><div class="val">${fmtAbbr(7240)}</div><div class="delta up">▲ 4.2%</div>${spark(hashSeries('res', 12, 100, 20))}</div>
        <div class="cmd-card cmd-kpi"><div class="lbl">Churn (90d)</div><div class="val">2.1%</div><div class="delta up">▼ 0.4pt</div>${spark(hashSeries('ch', 12, 5, 2), { cls: 'warn' })}</div>
      </div>
      <div class="cmd-card">
        <h3>Daily revenue (last 14 days)</h3>
        <svg class="cmd-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
          ${series.map((v, i) => {
            const bh = (v / max) * (h - 30);
            return `<rect class="bar" x="${i * (bw + 6)}" y="${h - bh - 14}" width="${bw}" height="${bh}" rx="3"></rect>`;
          }).join('')}
          ${series.map((v, i) => `<text x="${i * (bw + 6) + bw / 2}" y="${h - 2}" text-anchor="middle" fill="#64748b" font-size="9">D-${series.length - i}</text>`).join('')}
        </svg>
      </div>
      <div class="cmd-grid cols-2">
        <div class="cmd-card">
          <h3>Revenue by service</h3>
          <table class="cmd-table">
            ${['Garbage','Laundry','Car Wash','Grocery','Maintenance'].map((s, i) => {
              const rev = [320000, 1240000, 980000, 410000, 870000][i];
              const pct = [8, 32, 25, 11, 24][i];
              return `<tr><td><b>${s}</b></td><td>${fmtINR(rev)}</td><td><div style="background: var(--surface-2); width: 120px; height: 6px; border-radius: 4px; overflow: hidden;"><div style="width:${pct}%; height: 100%; background: var(--brand);"></div></div></td><td>${pct}%</td></tr>`;
            }).join('')}
          </table>
        </div>
        <div class="cmd-card">
          <h3>City breakdown</h3>
          <table class="cmd-table">
            <thead><tr><th>City</th><th>Communities</th><th>Orders today</th><th>Revenue</th></tr></thead>
            <tbody>
              ${DATA.cities.map((city) => {
                const cs = LIVE.communities.filter((c) => c.city === city.name);
                if (!cs.length) return '';
                const ot = cs.reduce((s, c) => s + c.ordersToday, 0);
                const rv = cs.reduce((s, c) => s + c.revenue, 0);
                return `<tr><td><b>${city.name}</b></td><td>${cs.length}</td><td>${ot}</td><td>${fmtINR(rv)}</td></tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  // AI Insights -------------------------------------------------------
  function aiView(root) {
    root.innerHTML = `
      <div><h2>AI Insights <span class="cmd-badge ${providers.openai.hasKey() ? 'ok' : 'mute'}">${providers.openai.hasKey() ? 'OpenAI · gpt-4o-mini' : 'mock mode'}</span></h2><div class="subhead">Ask anything about the network.</div></div>
      <div class="cmd-grid cols-2">
        <div class="cmd-card">
          <h3>Operator console</h3>
          <div class="cmd-chat" id="aiLog"></div>
          <div style="display:flex; gap:8px; margin-top: 10px;">
            <input id="aiInp" placeholder='Ask: "which cities are missing SLA today?"' style="flex:1;" />
            <button class="cmd-btn primary" id="aiSend">Ask</button>
            <button class="cmd-btn" id="aiKey">Key</button>
          </div>
          <div style="display:flex; gap:6px; margin-top: 8px; flex-wrap:wrap;">
            ${['Top performing community','Worst SLA today','Most anomalies last hour','Revenue forecast next 7 days'].map((q) => `<button class="cmd-btn" data-q="${q}">${q}</button>`).join('')}
          </div>
        </div>
        <div class="cmd-card">
          <h3>Auto-summary (last 24h)</h3>
          <div id="aiDigest" style="font-size: 13px; color: var(--ink-2); line-height: 1.55;">Generating digest…</div>
          <h3 style="margin-top: 16px;">Predicted incidents (24h)</h3>
          <div class="cmd-alerts">
            ${LIVE.devices.filter((d) => d.battery < 40).slice(0, 4).map((d) => `<div class="alert warn"><div class="bar"></div><div class="ico">battery_alert</div><div><div class="ttl">${d.label} battery may fail in 18h</div><div class="sub">${d.community} · model: pm-bin-xgb-v4 · 87% conf</div></div><div class="acts"><button class="cmd-btn">Dispatch</button></div></div>`).join('')}
          </div>
        </div>
      </div>`;
    const log = document.getElementById('aiLog');
    function add(text, from) {
      const m = document.createElement('div'); m.className = 'msg ' + from; m.textContent = text; log.appendChild(m); log.scrollTop = log.scrollHeight;
    }
    add('Hi — I\'m your CMCC analyst. Ask me anything about the live network.', 'bot');
    async function ask(q) {
      add(q, 'user');
      add('Thinking…', 'bot');
      const last = log.lastChild;
      const snap = {
        communities: LIVE.communities.slice(0, 12),
        devices: LIVE.devices.filter((d) => d.fillLevel >= 60).slice(0, 20),
        anomalies: LIVE.anomalies.filter((a) => a.status !== 'RESOLVED'),
      };
      try {
        let answer;
        if (providers.openai.hasKey()) answer = await providers.openai.answerAdmin(q, snap);
        else answer = mockAnswer(q, snap);
        last.textContent = answer;
      } catch (e) { last.textContent = e.message; last.style.color = 'var(--danger)'; }
    }
    document.getElementById('aiSend').onclick = () => { const v = document.getElementById('aiInp').value.trim(); if (!v) return; document.getElementById('aiInp').value = ''; ask(v); };
    document.getElementById('aiInp').onkeydown = (e) => { if (e.key === 'Enter') document.getElementById('aiSend').click(); };
    document.querySelectorAll('[data-q]').forEach((b) => b.onclick = () => ask(b.dataset.q));
    document.getElementById('aiKey').onclick = async () => {
      const cur = providers.openai.getKey();
      const k = await ui.prompt({ title: 'OpenAI key', label: 'sk-...', value: cur, cta: 'Save' });
      if (k !== null) providers.openai.setKey(k);
      paint();
    };
    // Digest
    wow.opsDigest({ orders: LIVE.orders.slice(0, 30), devices: LIVE.devices }).then((d) => {
      const el = document.getElementById('aiDigest'); if (el) el.textContent = d;
    });
  }
  function mockAnswer(q, snap) {
    const lower = q.toLowerCase();
    if (lower.includes('sla')) {
      const worst = snap.communities.slice().sort((a, b) => a.slaPct - b.slaPct).slice(0, 5);
      return 'Worst SLA today:\n' + worst.map((c) => `• ${c.name} (${c.city}) — ${c.slaPct}%`).join('\n');
    }
    if (lower.includes('top') || lower.includes('best')) {
      const best = snap.communities.slice().sort((a, b) => b.ordersToday - a.ordersToday)[0];
      return `Top community: ${best.name} (${best.city}) — ${best.ordersToday} orders, SLA ${best.slaPct}%, revenue ${fmtINR(best.revenue)}.`;
    }
    if (lower.includes('anomal')) {
      const c = snap.anomalies.filter((a) => a.sev === 'critical').length;
      return `${snap.anomalies.length} active anomalies (${c} critical). Most common: ${snap.anomalies.map((a) => a.type)[0] || '—'}.`;
    }
    if (lower.includes('revenue') || lower.includes('forecast')) {
      return 'Revenue forecast (next 7d): ₹ 19.6 L (+6.4% vs prior week). Driven by laundry subscriptions in Bangalore (+12%) and car-wash uptake in Hyderabad (+18%).';
    }
    return 'Mock analyst: paste an OpenAI key (Key button) for richer responses.';
  }

  // Compliance --------------------------------------------------------
  function complianceView(root) {
    root.innerHTML = `
      <div><h2>Compliance <span class="cmd-badge ok">DPDP 2023 · CERT-In</span></h2></div>
      <div class="cmd-grid cols-3">
        <div class="cmd-card cmd-kpi"><div class="lbl">Consent rate</div><div class="val">98.2%</div><div class="delta up">target ≥95%</div></div>
        <div class="cmd-card cmd-kpi"><div class="lbl">Data export requests (30d)</div><div class="val">14</div><div class="delta">all fulfilled in &lt;72h</div></div>
        <div class="cmd-card cmd-kpi"><div class="lbl">Erasure requests (30d)</div><div class="val">3</div><div class="delta">all fulfilled</div></div>
      </div>
      <div class="cmd-grid cols-2">
        <div class="cmd-card">
          <h3>CERT-In incident hooks</h3>
          <div class="cmd-alerts">
            <div class="alert info"><div class="bar"></div><div class="ico">shield</div><div><div class="ttl">No reportable incidents in last 30d</div><div class="sub">6h reporting hook armed · ap-south-1</div></div></div>
          </div>
        </div>
        <div class="cmd-card">
          <h3>Data residency</h3>
          <table class="cmd-table">
            <tr><td>Primary DB</td><td>RDS · ap-south-1a</td><td><span class="cmd-badge ok">healthy</span></td></tr>
            <tr><td>Read replica</td><td>RDS · ap-south-1b</td><td><span class="cmd-badge ok">healthy</span></td></tr>
            <tr><td>Cold storage</td><td>S3 IA · ap-south-1</td><td><span class="cmd-badge ok">healthy</span></td></tr>
            <tr><td>Backups</td><td>S3 Glacier · ap-south-1c</td><td><span class="cmd-badge ok">healthy</span></td></tr>
            <tr><td>Audit log</td><td>QLDB · tamper-evident</td><td><span class="cmd-badge ok">healthy</span></td></tr>
          </table>
        </div>
      </div>`;
  }

  // Audit Log ---------------------------------------------------------
  function auditView(root) {
    root.innerHTML = `
      <div><h2>Audit log <span class="cmd-badge info">${DATA.audit.length} entries</span></h2><div class="subhead">Tamper-evident · ap-south-1 · QLDB</div></div>
      <div class="cmd-card" style="padding:0;">
        <table class="cmd-table">
          <thead><tr><th>When</th><th>Operator</th><th>Action</th><th>Target</th><th>Hash</th></tr></thead>
          <tbody>
            ${DATA.audit.map((a) => `<tr>
              <td>${new Date(a.when).toLocaleString()}</td>
              <td>${a.actor}</td>
              <td><span class="cmd-badge info">${a.action}</span></td>
              <td>${a.target}</td>
              <td style="font-family: 'JetBrains Mono', monospace; color: var(--muted); font-size: 10px;">${('0x' + (a.id + a.action).split('').reduce((s, c) => ((s * 31 + c.charCodeAt(0)) >>> 0), 0).toString(16)).padEnd(12, '0')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  // Team --------------------------------------------------------------
  function teamView(root) {
    root.innerHTML = `
      <div><h2>NOC Team <span class="cmd-badge info">${DATA.operators.length}</span></h2></div>
      <div class="cmd-grid cols-3">
        ${DATA.operators.map((o) => `
          <div class="agent-card">
            <div class="av">${o.name.split(' ').map((s) => s[0]).slice(0,2).join('')}</div>
            <div class="meta"><div class="nm">${o.name}</div><div class="loc">${o.role}</div></div>
            <span class="cmd-badge ${o.online ? 'ok' : 'mute'}">${o.online ? 'ONLINE' : 'OFFLINE'}</span>
          </div>`).join('')}
      </div>`;
  }

  // Settings ----------------------------------------------------------
  function settingsView(root) {
    root.innerHTML = `
      <div><h2>Settings</h2></div>
      <div class="cmd-grid cols-2">
        <div class="cmd-card">
          <h3>Integrations <span class="cmd-badge mute" style="margin-left: 8px;">design-ready · demo</span></h3>
          <p style="color: var(--muted); font-size: 12px; margin-top: 0;">All third-party / government integrations below are <b>mocked for demonstration</b>. None imply a current contract, certification, or live data feed. Adapter contracts are documented and ready to wire once partner agreements are signed.</p>
          <table class="cmd-table">
            <tr><td><b>Telangana eGov stack</b></td><td colspan="2" style="color: var(--muted);">───────────</td></tr>
            <tr><td>Mee-Seva (T-App Folio)</td><td><span class="cmd-badge mute">mock</span></td><td>adapter ready · 200+ services target</td></tr>
            <tr><td>T-Wallet</td><td><span class="cmd-badge mute">mock</span></td><td>fee + scholarship + subsidy</td></tr>
            <tr><td>TS-bPASS</td><td><span class="cmd-badge mute">mock</span></td><td>building permits · self-certify</td></tr>
            <tr><td>SBM portal (MoHUA)</td><td><span class="cmd-badge mute">mock</span></td><td>star-rating feed format defined</td></tr>
            <tr><td>NDMA SACHET</td><td><span class="cmd-badge mute">mock</span></td><td>early warning · all hazards</td></tr>
            <tr><td>CPCB air quality</td><td><span class="cmd-badge mute">mock</span></td><td>15-min refresh planned</td></tr>
            <tr><td>Bhuvan GIS (NRSC)</td><td><span class="cmd-badge mute">mock</span></td><td>ward boundaries · WMS</td></tr>
            <tr><td>PFMS (fund tracking)</td><td><span class="cmd-badge mute">mock</span></td><td>real-time utilisation</td></tr>
            <tr><td>GeM (procurement)</td><td><span class="cmd-badge mute">mock</span></td><td>GFR-compliant target</td></tr>
            <tr><td>Aadhaar / DigiLocker</td><td><span class="cmd-badge mute">mock</span></td><td>AUA / KUA design — requires UIDAI approval</td></tr>
            <tr><td>RTI portal</td><td><span class="cmd-badge mute">mock</span></td><td>30-day SLA workflow</td></tr>
            <tr><td><b>Communication channels</b></td><td colspan="2" style="color: var(--muted);">───────────</td></tr>
            <tr><td>MSG91 (SMS-DLT)</td><td><span class="cmd-badge mute">mock</span></td><td>12 languages target</td></tr>
            <tr><td>WhatsApp Business</td><td><span class="cmd-badge mute">mock</span></td><td>citizen reports + alerts</td></tr>
            <tr><td>Exotel (IVR + masked calls)</td><td><span class="cmd-badge mute">mock</span></td><td>missed-call grievance</td></tr>
            <tr><td>FCM push</td><td><span class="cmd-badge mute">mock</span></td><td>token registry stubbed</td></tr>
            <tr><td><b>Storage + AI</b></td><td colspan="2" style="color: var(--muted);">───────────</td></tr>
            <tr><td>AWS S3 + CloudFront</td><td><span class="cmd-badge mute">design</span></td><td>ap-south-1 target region</td></tr>
            <tr><td>Digio (eKYC)</td><td><span class="cmd-badge mute">mock</span></td><td>${LIVE.agents.filter((a) => a.kyc === 'VERIFIED').length} simulated workers verified</td></tr>
            <tr><td>Google Maps</td><td><span class="cmd-badge mute">demo (OSM)</span></td><td>swap when ready</td></tr>
            <tr><td>OpenAI</td><td><span class="cmd-badge ${providers.openai.hasKey() ? 'ok' : 'mute'}">${providers.openai.hasKey() ? 'connected' : 'mock'}</span></td><td>used by AI Insights & voice booking</td></tr>
          </table>
        </div>
        <div class="cmd-card">
          <h3>Reset demo data</h3>
          <p style="color: var(--muted); font-size: 13px;">Wipes the CMCC seed (orders, anomalies, audit) and regenerates fresh mock data.</p>
          <button class="cmd-btn danger" id="resetBtn">Reset</button>
        </div>
      </div>`;
    document.getElementById('resetBtn').onclick = () => {
      localStorage.removeItem('vl_cmcc_seed');
      DATA = seed();
      paint();
      providers.push.show('CMCC reset', 'New mock dataset generated', { icon: 'refresh' });
    };
  }

  // Create incident ---------------------------------------------------
  function createIncidentSheet() {
    const s = ui.sheet(`
      <h3>Create incident</h3>
      <div class="desc">Open an investigation, page on-call, or quarantine a device.</div>
      <div class="field"><label>Type</label>
        <select id="iType">
          <option>Service outage</option>
          <option>Device tampering</option>
          <option>Agent escalation</option>
          <option>Payment reconciliation</option>
          <option>Security / breach</option>
        </select>
      </div>
      <div class="field"><label>Severity</label>
        <select id="iSev"><option value="critical">Critical (page SRE)</option><option value="warn">Warning</option><option value="info">Info</option></select>
      </div>
      <div class="field"><label>Description</label>
        <textarea id="iDesc" rows="3" placeholder="Details, affected scope, suggested action…"></textarea>
      </div>
      <div class="field"><button class="btn cta block" id="iGo">Open incident</button></div>
      <div class="field"><button class="btn ghost block" id="iCancel">Cancel</button></div>
    `);
    s.el.querySelector('#iCancel').onclick = s.close;
    s.el.querySelector('#iGo').onclick = () => {
      const sev = s.el.querySelector('#iSev').value;
      const type = s.el.querySelector('#iType').value;
      const desc = s.el.querySelector('#iDesc').value;
      LIVE.anomalies.unshift({
        id: 'an' + Date.now(), type: type.toUpperCase().replace(/ /g, '_'), sev,
        icon: 'error', text: desc || type, community: 'HQ',
        when: Date.now(), status: 'OPEN',
      });
      writeAudit('CREATE_INCIDENT', type);
      saveData();
      providers.push.show('Incident opened', `${sev.toUpperCase()} · ${type}`, { icon: 'add_alert' });
      s.close(); paint();
    };
  }

  // Live updates — mutate DATA in the background but DO NOT auto-paint.
  // Was the second source of the page-unresponsive bug: even at 60s,
  // a full overview repaint (KPIs + sparklines + Leaflet map + table)
  // through the i18n translator combined with the polling loop blocked
  // the main thread enough for Chrome to flag the tab. Saved data is
  // visible on the user's next navigation or refresh.
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    const candidate = DATA.orders.find((o) => ['ASSIGNED','EN_ROUTE','ARRIVED','IN_PROGRESS'].includes(o.status));
    if (candidate) candidate.status = Math.random() > 0.3 ? 'COMPLETED' : 'IN_PROGRESS';
    DATA.devices.filter((d) => d.type === 'SMART_BIN').forEach((d) => {
      d.fillLevel = Math.min(100, (d.fillLevel || 0) + Math.random() * 4);
      d.lastSeen = Date.now();
    });
    saveData();
  }, 60_000);

  // ═══ Boot ═══════════════════════════════════════════════════════════
  window.addEventListener('hashchange', paint);
  // Vercel Web Analytics pageview tracking for hash-routed SPA. The
  // injected script only auto-tracks pushState/popstate, so on
  // hashchange we manually fire a pageview event with the new hash as
  // the path so each #overview, #anomalies, … counts as its own view.
  function _trackPageview() {
    if (typeof window.va === 'function') {
      try {
        window.va('event', { name: 'pageview', data: { url: location.href } });
      } catch {}
    }
  }
  window.addEventListener('hashchange', _trackPageview);
  // Also fire once after the analytics script has had time to load.
  setTimeout(_trackPageview, 1500);
  paint();
})();
