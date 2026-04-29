// ─────────────────────────────────────────────────────────────────────
// Municipal layer — Real-Time Governance for Indian ULBs.
// Adds ward-level operations, citizen grievance queue, SBM compliance
// scorecard, sanitation-worker welfare, GIS heatmap, disaster mgmt,
// and CAG-ready compliance reports. Additive — does not modify the
// existing operator-mode views.
// ─────────────────────────────────────────────────────────────────────

window.cmccMunicipal = (() => {
  // ─── Mock municipal dataset (deterministic seed) ────────────────────
  function municipalSeed() {
    const cached = localStorage.getItem('vl_cmcc_muni_seed');
    if (cached) return JSON.parse(cached);

    // Telangana state ULBs — 6 corporations, 600+ wards represented at sample
    const cities = [
      { id: 'ghmc', name: 'GHMC — Greater Hyderabad', state: 'TS', wards: 24, population: '1.0 Cr', lat: 17.3850, lng: 78.4867 },
      { id: 'wmc',  name: 'GWMC — Warangal',           state: 'TS', wards: 10, population: '8.3 L',  lat: 17.9784, lng: 79.5941 },
      { id: 'kmc',  name: 'KMC — Karimnagar',          state: 'TS', wards:  8, population: '3.0 L',  lat: 18.4386, lng: 79.1288 },
      { id: 'nmc',  name: 'NMC — Nizamabad',           state: 'TS', wards:  8, population: '3.1 L',  lat: 18.6725, lng: 78.0941 },
      { id: 'khmc', name: 'KMC — Khammam',             state: 'TS', wards:  8, population: '2.0 L',  lat: 17.2473, lng: 80.1514 },
      { id: 'mmc',  name: 'MMC — Mahabubnagar',        state: 'TS', wards:  6, population: '2.4 L',  lat: 16.7488, lng: 77.9856 },
    ];

    // Real Hyderabad / Telangana ward & locality names
    const wardNames = [
      'Banjara Hills','Madhapur','Gachibowli','Jubilee Hills','Begumpet','Secunderabad','Kukatpally','LB Nagar',
      'Charminar','Mehdipatnam','Tolichowki','Kondapur','Hitech City','Manikonda','Miyapur','Ameerpet',
      'Dilsukhnagar','Uppal','Habsiguda','Tarnaka','Saidabad','Malakpet','Chandrayangutta','Falaknuma',
      // Warangal
      'Hanamkonda','Kazipet','Subedari','Mulugu Road','Hunter Road','Naimnagar','Kishanpura','Excise Colony','Kothawada','Subash Nagar',
      // Karimnagar
      'Mukarampura','Vavilalapally','Bhagat Nagar','Telangana Chowk','Mancherial Road','Kothirampur','Subash Nagar K','Rekurthi',
      // Nizamabad
      'Khaleelwadi','Subash Nagar N','Vinayak Nagar','Old Nizamabad','Yellareddy Pet','Auto Nagar','Mubarak Nagar','Sarangpur',
      // Khammam
      'Wyra Road','Pavithra Nagar','Sarpaka','Ballepalli','Bhaktanagar','SBI Colony','Thirumalayapalem','Mamillagudem',
      // Mahabubnagar
      'Shantinagar','Kotha Pet','Alampur Road','Christian Bazar','Boyapalli','Wakulpur',
    ];

    const wards = [];
    let wardIdx = 0;
    cities.forEach((c) => {
      for (let i = 0; i < c.wards; i++) {
        const id = `w-${c.id}-${i + 1}`;
        const name = wardNames[wardIdx++ % wardNames.length] + ' Ward';
        const sbm = 60 + Math.floor(Math.random() * 40);
        const popK = 30 + Math.floor(Math.random() * 220);
        wards.push({
          id, name, cityId: c.id, cityName: c.name.split(' — ')[1], state: c.state,
          population_k: popK, area_sqkm: +(2 + Math.random() * 12).toFixed(1),
          workers: 30 + Math.floor(Math.random() * 80),
          bins_total: 50 + Math.floor(Math.random() * 150),
          bins_full: Math.floor(Math.random() * 12),
          coverage_pct: 80 + Math.floor(Math.random() * 20),
          sbm_score: sbm,
          star_rating: sbm >= 90 ? 5 : sbm >= 75 ? 4 : sbm >= 60 ? 3 : 2,
          grievances_open: Math.floor(Math.random() * 18),
          grievances_resolved_30d: 30 + Math.floor(Math.random() * 280),
          ods_status: Math.random() > 0.05 ? 'ODF+' : 'ODF',  // Open Defecation Free
          revenue_per_capita_inr: 80 + Math.floor(Math.random() * 220),
          air_quality: 60 + Math.floor(Math.random() * 200),  // AQI
        });
      }
    });

    // Citizens
    const citizens = [];
    for (let i = 0; i < 80; i++) {
      const w = wards[Math.floor(Math.random() * wards.length)];
      citizens.push({
        id: 'cit' + i, name: ['Rajesh','Priya','Suresh','Anita','Vijay','Lakshmi','Karthik','Meera','Arjun','Pooja'][i % 10] + ' ' + ['Sharma','Kumar','Reddy','Singh','Iyer','Pillai','Naidu','Verma','Rao','Khan'][(i*3)%10],
        ward: w.name, wardId: w.id,
        aadhaar_verified: Math.random() > 0.1, digilocker_linked: Math.random() > 0.4,
        phone: '+91' + (9000000000 + i * 137).toString().slice(0, 10),
      });
    }

    // Grievances — the heart of citizen service
    const griTypes = [
      { cat: 'Garbage',     icon: 'recycling',   sla_h: 12, examples: ['Bin overflowing for 3 days','Door-to-door collection skipped','Stray dogs raiding bin'] },
      { cat: 'Water',       icon: 'water_drop',  sla_h: 24, examples: ['Tap water unavailable since morning','Pipe burst near gate','Water bill error'] },
      { cat: 'Streetlight', icon: 'lightbulb',   sla_h: 48, examples: ['Streetlight off for a week','Pole leaning dangerously','Wires hanging low'] },
      { cat: 'Roads',       icon: 'route',       sla_h: 96, examples: ['Pothole near junction','Speed breaker missing','Manhole open'] },
      { cat: 'Sewage',      icon: 'plumbing',    sla_h: 24, examples: ['Drain blocked','Sewage overflow on road','Septic tank smell'] },
      { cat: 'Stray',       icon: 'pets',        sla_h: 72, examples: ['Stray dog menace','Cattle on road','Monkey infestation'] },
      { cat: 'Encroachment',icon: 'fence',       sla_h:120, examples: ['Footpath encroached','Vendor blocking road','Illegal hoarding'] },
      { cat: 'Mosquito',    icon: 'pest_control',sla_h: 48, examples: ['Stagnant water','Fogging not done','Dengue cases reported'] },
    ];
    const grievances = [];
    for (let i = 0; i < 60; i++) {
      const t = griTypes[Math.floor(Math.random() * griTypes.length)];
      const w = wards[Math.floor(Math.random() * wards.length)];
      const c = citizens[Math.floor(Math.random() * citizens.length)];
      const opened = Date.now() - Math.floor(Math.random() * 96 * 3600 * 1000);
      const sla = opened + t.sla_h * 3600 * 1000;
      const status = Math.random() > 0.6 ? 'OPEN' : Math.random() > 0.5 ? 'ASSIGNED' : Math.random() > 0.3 ? 'RESOLVED' : 'ESCALATED';
      grievances.push({
        id: 'GRV-' + (10000 + i),
        category: t.cat, icon: t.icon, sla_h: t.sla_h,
        text: t.examples[i % t.examples.length],
        ward: w.name, wardId: w.id,
        citizen: c.name, citizenId: c.id, citizen_phone: c.phone,
        opened, sla_breach_at: sla, status,
        nps: status === 'RESOLVED' ? 7 + Math.floor(Math.random() * 4) : null,
      });
    }
    grievances.sort((a, b) => b.opened - a.opened);

    // Sanitation workers
    const workers = [];
    for (let i = 0; i < 60; i++) {
      const w = wards[Math.floor(Math.random() * wards.length)];
      workers.push({
        id: 'sw' + i,
        name: ['Ramesh','Suresh','Lakshmi','Geeta','Manoj','Sunita','Rajesh','Anita','Vijay','Pooja'][i % 10] + ' ' + ['Devi','Kumar','Bai','Singh','Rao','Reddy'][i % 6],
        ward: w.name, wardId: w.id,
        attendance_pct: 85 + Math.floor(Math.random() * 15),
        safety_kit: Math.random() > 0.05,
        insurance_active: Math.random() > 0.02,
        last_health_check_days_ago: Math.floor(Math.random() * 180),
        skill_courses: Math.floor(Math.random() * 5),
      });
    }

    // Disaster / hazard incidents
    const hazards = [
      { id: 'h1', type: 'HEATWAVE',  city: 'BBMP — Bengaluru',  severity: 'warn',     text: 'Heatwave alert for HSR + Whitefield · 41°C tomorrow', citizens_alerted: 180000, time: Date.now() - 4 * 3600 * 1000, status: 'MONITORING' },
      { id: 'h2', type: 'FLOODING',  city: 'MCGM — Mumbai',     severity: 'critical', text: 'Borivali waterlogging · 4 streets · pumps deployed',  citizens_alerted: 60000,  time: Date.now() - 1 * 3600 * 1000, status: 'ACTIVE' },
      { id: 'h3', type: 'POOR_AQI',  city: 'MCD — Delhi NCR',   severity: 'critical', text: 'AQI 380 (Severe) · advisory issued · schools alerted',  citizens_alerted: 950000, time: Date.now() - 2 * 3600 * 1000, status: 'ACTIVE' },
      { id: 'h4', type: 'DENGUE',    city: 'GHMC — Hyderabad',  severity: 'warn',     text: '7 confirmed cases in Madhapur · fogging dispatched',    citizens_alerted: 24000,  time: Date.now() - 8 * 3600 * 1000, status: 'CONTAINED' },
    ];

    const data = { cities, wards, citizens, grievances, workers, hazards };
    localStorage.setItem('vl_cmcc_muni_seed', JSON.stringify(data));
    return data;
  }

  let MUNI = municipalSeed();

  // ─── D1 v4 · server-side tenant-scoped grievance merge ──────────────
  // Pull the current operator's tenant grievances from the new API and
  // prepend them to MUNI.grievances so they show up alongside the demo
  // seed in the queue. Failure is non-fatal — the legacy seed remains
  // visible. Re-renders the grievances view if it's currently active.
  function mapServerToMuni(g) {
    const cat = String(g.category || 'other');
    const display = cat[0].toUpperCase() + cat.slice(1);
    const ICON = { garbage:'recycling', water:'water_drop', streetlight:'lightbulb', roads:'route', sewage:'plumbing', stray:'pets', encroachment:'fence', mosquito:'pest_control', other:'priority_high' };
    const SLA_H = { garbage:12, water:24, sewage:24, streetlight:48, mosquito:48, roads:96, stray:72, encroachment:120, other:24 };
    return {
      id: g.id,
      tenantId: g.tenantId,
      category: display,
      icon: ICON[cat] || 'priority_high',
      sla_h: SLA_H[cat] || 24,
      text: g.description || ('New ' + display + ' grievance'),
      ward: g.wardId || 'Statewide triage',
      wardId: g.wardId || null,
      citizen: g.channel === 'whatsapp' ? 'WhatsApp citizen' : 'Citizen Portal user',
      citizenId: null,
      citizen_phone: g.citizenPhone || '',
      opened: g.createdAt || Date.now(),
      sla_breach_at: g.slaDueAt || (g.createdAt || Date.now()) + (SLA_H[cat] || 24) * 3600 * 1000,
      status: String(g.status || 'open').toUpperCase(),
      nps: null,
      _serverSourced: true,
    };
  }

  // ── A6 v1 · client-side BoW + cosine for the "similar to GRV-X" badge ──
  // Same algorithm as cmcc-website/api/_lib.js · cosineSimBow, just
  // running here to avoid one /api/grievances/similar call per row.
  // Pairwise scan over recent open server-sourced rows; if two rows
  // score >= 0.6 they get cross-linked via _similarTo.
  const _STOPWORDS = new Set([
    'the','a','an','is','are','was','were','be','been','being','of','to','in','on','at','for','with','by','from','as','and','or','but','not','no','it','its','this','that','these','those','have','has','had','do','does','did','will','would','should','could','may','might','can','must','about','near','some','any','all','more','very',
    'है','हैं','था','थे','थी','और','या','के','की','का','को','से','में','पर','तो','भी','एक','यह','वह',
    'ఉంది','ఉన్నాయి','మరియు','లేదా','యొక్క','ను','కు','లో','మీద','కానీ','ఒక','ఇది','అది',
  ]);
  function _tokens(text) {
    if (!text) return [];
    const cleaned = String(text).toLowerCase().replace(/[!-/:-@[-`{-~ -⁯⸀-⹿]/g, ' ');
    return cleaned.split(/\s+/).filter((t) => t.length >= 2 && !_STOPWORDS.has(t));
  }
  function _bow(text) {
    const m = new Map();
    for (const t of _tokens(text)) m.set(t, (m.get(t) || 0) + 1);
    return m;
  }
  function _cosine(a, b) {
    if (!a || !b || !a.size || !b.size) return 0;
    const [s, l] = a.size < b.size ? [a, b] : [b, a];
    let dot = 0, na = 0, nb = 0;
    for (const [t, c] of s) dot += c * (l.get(t) || 0);
    for (const v of a.values()) na += v * v;
    for (const v of b.values()) nb += v * v;
    return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
  }
  function annotateSimilar(rows, threshold = 0.6) {
    const open = rows.filter((g) => g._serverSourced && g.status !== 'RESOLVED' && g.text).slice(0, 50);
    if (open.length < 2) return;
    const vecs = open.map((g) => _bow(g.text));
    for (let i = 0; i < open.length; i++) {
      for (let j = i + 1; j < open.length; j++) {
        const s = _cosine(vecs[i], vecs[j]);
        if (s >= threshold) {
          // Attach the OLDEST id as the canonical "original" so the
          // badge always points back, not forward in time.
          const [older, newer] = open[i].opened <= open[j].opened
            ? [open[i], open[j]] : [open[j], open[i]];
          if (!newer._similarTo || (newer._similarToScore || 0) < s) {
            newer._similarTo = older.id;
            newer._similarToScore = s;
          }
        }
      }
    }
  }

  async function refreshServerGrievances() {
    if (!window.api?.token?.()) return;
    let json;
    try {
      json = await window.api.http('GET', '/api/grievances/list?limit=200');
    } catch { return; /* offline / endpoint missing — keep legacy seed */ }
    if (!json?.grievances?.length) return;

    const incoming = json.grievances.map(mapServerToMuni);
    // Merge: incoming server rows take priority over any same-id legacy
    // duplicate (server has the canonical state). Server-sourced rows
    // are also persisted into the muni seed so a refresh shows them.
    const byId = new Map();
    incoming.forEach((g) => byId.set(g.id, g));
    (MUNI.grievances || []).forEach((g) => { if (!byId.has(g.id)) byId.set(g.id, g); });
    MUNI.grievances = [...byId.values()].sort((a, b) => b.opened - a.opened);
    annotateSimilar(MUNI.grievances);
    try { localStorage.setItem('vl_cmcc_muni_seed', JSON.stringify(MUNI)); } catch {}

    // If the operator is on the grievances tab right now, re-render it.
    const route = (location.hash || '').slice(1);
    if (route === 'grievances' && typeof MUNI_ROUTES?.grievances === 'function') {
      const main = document.getElementById('main');
      if (main) MUNI_ROUTES.grievances(main);
    }
  }

  // Fire once at boot, then refresh every 30s. Cheap GET; tenant-scoped.
  setTimeout(refreshServerGrievances, 1500);
  setInterval(refreshServerGrievances, 30000);

  // ─── Helpers ────────────────────────────────────────────────────────
  const fmtAgo = (ms) => {
    const s = Math.floor((Date.now() - ms) / 1000);
    if (s < 60) return s + 's';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'h';
    return Math.floor(s / 86400) + 'd';
  };
  const fmtINR = (n) => '₹ ' + n.toLocaleString('en-IN');
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
  const audit = (action, target) => {
    try {
      const d = JSON.parse(localStorage.getItem('vl_cmcc_seed') || '{}');
      d.audit = d.audit || [];
      d.audit.unshift({ id: 'au' + Date.now(), actor: api.user()?.name || 'op', action, target, when: Date.now() });
      localStorage.setItem('vl_cmcc_seed', JSON.stringify(d));
    } catch {}
  };

  // ─── Views ──────────────────────────────────────────────────────────
  function wardsView(root) {
    const cityFilter = '';
    const wards = MUNI.wards;
    const slaBreaching = MUNI.grievances.filter((g) => g.status !== 'RESOLVED' && g.sla_breach_at < Date.now() + 4 * 3600 * 1000).length;
    const totalCitizens = wards.reduce((s, w) => s + w.population_k * 1000, 0);
    root.innerHTML = `
      <div><h2>Wards <span class="cmd-badge info">${wards.length}</span></h2>
        <div class="subhead">${MUNI.cities.length} ULBs · ${(totalCitizens/10000000).toFixed(1)} Cr citizens · live ward-level operations</div>
      </div>

      <div class="cmd-grid cols-4">
        <div class="cmd-card cmd-kpi"><div class="lbl">Wards live</div><div class="val">${wards.length}</div></div>
        <div class="cmd-card cmd-kpi"><div class="lbl">Avg SBM score</div><div class="val">${Math.round(wards.reduce((s,w)=>s+w.sbm_score,0)/wards.length)}</div></div>
        <div class="cmd-card cmd-kpi"><div class="lbl">Open grievances</div><div class="val">${MUNI.grievances.filter((g)=>g.status==='OPEN').length}</div></div>
        <div class="cmd-card cmd-kpi ${slaBreaching > 5 ? 'danger' : ''}"><div class="lbl">SLA at risk (4h)</div><div class="val">${slaBreaching}</div></div>
      </div>

      <div class="cmd-card" style="padding: 0;">
        <table class="cmd-table">
          <thead><tr><th>Ward</th><th>City</th><th>Population</th><th>Workers</th><th>Bins</th><th>Coverage</th><th>SBM</th><th>Star</th><th>Grievances</th><th>ODF</th></tr></thead>
          <tbody>
            ${wards.slice().sort((a,b)=>b.sbm_score-a.sbm_score).map((w) => {
              const sbmCls = w.sbm_score >= 85 ? 'ok' : w.sbm_score >= 70 ? 'warn' : 'bad';
              return `<tr>
                <td><b>${w.name}</b></td>
                <td>${w.cityName}, ${w.state}</td>
                <td>${w.population_k}K</td>
                <td>${w.workers}</td>
                <td>${w.bins_total - w.bins_full}/${w.bins_total} ${w.bins_full ? `<span class="cmd-badge warn" style="margin-left:4px;">${w.bins_full} full</span>`:''}</td>
                <td>${w.coverage_pct}%</td>
                <td><span class="cmd-badge ${sbmCls}">${w.sbm_score}</span></td>
                <td style="color: var(--accent); font-weight:700;">${stars(w.star_rating)}</td>
                <td>${w.grievances_open}</td>
                <td><span class="cmd-badge ${w.ods_status === 'ODF+' ? 'ok' : 'info'}">${w.ods_status}</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function grievancesView(root) {
    const open = MUNI.grievances.filter((g) => g.status !== 'RESOLVED');
    const breaching = open.filter((g) => g.sla_breach_at < Date.now() + 2 * 3600 * 1000);
    const resolvedToday = MUNI.grievances.filter((g) => g.status === 'RESOLVED' && g.opened > Date.now() - 24*3600*1000).length;
    const npsAvg = MUNI.grievances.filter((g) => g.nps).reduce((s, g, _, arr) => s + g.nps / arr.length, 0).toFixed(1);

    root.innerHTML = `
      <div><h2>Citizen Grievances <span class="cmd-badge info">${open.length} open</span></h2>
        <div class="subhead">Live grievance queue · auto-routed to ward officers · SLA-tracked · CPGRAMS-compatible</div>
      </div>

      <div class="cmd-grid cols-4">
        <div class="cmd-card cmd-kpi"><div class="lbl">Open</div><div class="val">${open.length}</div></div>
        <div class="cmd-card cmd-kpi ${breaching.length > 5 ? 'danger':''}"><div class="lbl">SLA risk (2h)</div><div class="val">${breaching.length}</div></div>
        <div class="cmd-card cmd-kpi"><div class="lbl">Resolved (24h)</div><div class="val">${resolvedToday}</div></div>
        <div class="cmd-card cmd-kpi"><div class="lbl">Citizen NPS</div><div class="val">${npsAvg}</div></div>
      </div>

      <div class="cmd-grid cols-2">
        <div class="cmd-card">
          <h3>By category (last 30 days)</h3>
          ${(() => {
            const counts = {};
            MUNI.grievances.forEach((g) => counts[g.category] = (counts[g.category] || 0) + 1);
            const max = Math.max(...Object.values(counts));
            return Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([cat, n]) => `
              <div style="padding: 6px 0; display: grid; grid-template-columns: 100px 1fr 40px; gap: 10px; align-items: center;">
                <span style="font-size: 12px;">${cat}</span>
                <div style="background: var(--surface-2); height: 8px; border-radius: 4px; overflow: hidden;">
                  <div style="width: ${(n/max)*100}%; height: 100%; background: var(--brand);"></div>
                </div>
                <span style="font-size: 12px; font-weight: 700; text-align: right;">${n}</span>
              </div>`).join('');
          })()}
        </div>
        <div class="cmd-card">
          <h3>SLA performance</h3>
          <div style="font-size: 13px; line-height: 1.8; color: var(--ink-2);">
            <div style="display:flex; justify-content:space-between;"><span>Within SLA</span><b style="color: var(--ok);">${Math.round(((open.length-breaching.length)/Math.max(1,open.length))*100)}%</b></div>
            <div style="display:flex; justify-content:space-between;"><span>SLA breached</span><b style="color: var(--danger);">${breaching.length}</b></div>
            <div style="display:flex; justify-content:space-between;"><span>Avg resolution time</span><b>17h 32m</b></div>
            <div style="display:flex; justify-content:space-between;"><span>Auto-escalated</span><b>${MUNI.grievances.filter((g) => g.status === 'ESCALATED').length}</b></div>
            <div style="display:flex; justify-content:space-between;"><span>Multilingual intake</span><b>EN · हि · తె · த · ಕ · বা</b></div>
            <div style="display:flex; justify-content:space-between;"><span>WhatsApp reports</span><b>34%</b></div>
          </div>
        </div>
      </div>

      <div class="cmd-card" style="padding: 0;">
        <table class="cmd-table cmd-grievance-table">
          <thead><tr><th>ID</th><th>Category</th><th>Issue</th><th>Ward</th><th>Citizen</th><th>Status</th><th>SLA</th><th>Opened</th><th>Actions</th></tr></thead>
          <tbody>
            ${open.slice(0, 30).map((g) => {
              const left = g.sla_breach_at - Date.now();
              const slaCls = left < 0 ? 'bad' : left < 2*3600*1000 ? 'warn' : 'ok';
              const slaTxt = left < 0 ? 'BREACHED' : left < 3600*1000 ? Math.round(left/60000)+'m left' : Math.round(left/3600000)+'h left';
              const actions = g._serverSourced
                ? `<button class="cmd-btn gri-act" data-id="${g.id}" data-act="assigned" title="Assign to ward officer">Assign</button>
                   <button class="cmd-btn gri-act" data-id="${g.id}" data-act="resolved" title="Mark resolved">Resolve</button>
                   <button class="cmd-btn gri-act" data-id="${g.id}" data-act="rejected" title="Reject (duplicate / out-of-scope)">Reject</button>`
                : `<span class="cmd-badge mute" title="Demo seed — server actions only on real grievances">demo</span>`;
              const simPill = g._similarTo
                ? `<span class="cmd-badge warn" title="Possible duplicate of ${g._similarTo} (cosine ${(g._similarToScore || 0).toFixed(2)})" style="margin-left: 6px; font-family:'JetBrains Mono', monospace; font-size:10px;">↗ similar to ${g._similarTo}</span>`
                : '';
              return `<tr>
                <td style="font-family: 'JetBrains Mono', monospace; color: var(--muted);">${g.id}</td>
                <td><span style="font-family:'Material Symbols Outlined'; font-size: 14px; vertical-align: -3px; color: var(--brand);">${g.icon}</span> ${g.category}</td>
                <td>${g.text}${simPill}</td>
                <td>${g.ward}</td>
                <td>${g.citizen}</td>
                <td><span class="cmd-badge ${g.status === 'OPEN' ? 'info' : g.status === 'ESCALATED' ? 'bad' : 'warn'}">${g.status}</span></td>
                <td><span class="cmd-badge ${slaCls}">${slaTxt}</span></td>
                <td>${fmtAgo(g.opened)}</td>
                <td style="white-space: nowrap;">${actions}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;

    // Wire row-action buttons (only attached to server-sourced rows).
    root.querySelectorAll('.gri-act').forEach((btn) => {
      btn.onclick = async () => {
        const id  = btn.dataset.id;
        const act = btn.dataset.act;
        if (!id || !act) return;
        // Disable all action buttons on this row while in flight.
        const tr = btn.closest('tr');
        tr?.querySelectorAll('.gri-act').forEach((b) => b.disabled = true);
        try {
          const r = await window.api.http('POST', '/api/grievances/update', { id, status: act });
          if (r?.grievance) {
            // Patch the in-memory MUNI row, persist, re-render the view.
            const idx = MUNI.grievances.findIndex((g) => g.id === id);
            if (idx >= 0) {
              MUNI.grievances[idx].status = String(r.grievance.status || act).toUpperCase();
              if (r.grievance.assignedTo) MUNI.grievances[idx].assignedTo = r.grievance.assignedTo;
            }
            try { localStorage.setItem('vl_cmcc_muni_seed', JSON.stringify(MUNI)); } catch {}
            window.api.toast?.(`${id} → ${act}`);
            // Re-render in place.
            const main = document.getElementById('main');
            if (main) MUNI_ROUTES.grievances(main);
          }
        } catch (e) {
          window.api.toast?.('Update failed: ' + (e.message || 'unknown'));
          tr?.querySelectorAll('.gri-act').forEach((b) => b.disabled = false);
        }
      };
    });
  }

  function sbmView(root) {
    const wards = MUNI.wards;
    const totalBins = wards.reduce((s, w) => s + w.bins_total, 0);
    const fullBins = wards.reduce((s, w) => s + w.bins_full, 0);
    const odfPlus = wards.filter((w) => w.ods_status === 'ODF+').length;
    const avgScore = Math.round(wards.reduce((s, w) => s + w.sbm_score, 0) / wards.length);
    const fiveStars = wards.filter((w) => w.star_rating === 5).length;
    root.innerHTML = `
      <div><h2>Swachh Bharat Mission Compliance <span class="cmd-badge ok">SBM-Urban 2.0</span></h2>
        <div class="subhead">Real-time scorecard aligned with MoHUA Star Rating Protocol · auto-feeds SBM portal</div>
      </div>
      <div class="cmd-grid cols-4">
        <div class="cmd-card cmd-kpi"><div class="lbl">Avg SBM score</div><div class="val">${avgScore}</div><div class="delta up">▲ 4 vs last month</div></div>
        <div class="cmd-card cmd-kpi"><div class="lbl">5-star wards</div><div class="val">${fiveStars}</div><div class="delta up">${Math.round(fiveStars/wards.length*100)}%</div></div>
        <div class="cmd-card cmd-kpi"><div class="lbl">ODF+ wards</div><div class="val">${odfPlus}/${wards.length}</div></div>
        <div class="cmd-card cmd-kpi"><div class="lbl">Bin coverage</div><div class="val">${Math.round((1-fullBins/totalBins)*100)}%</div></div>
      </div>
      <div class="cmd-grid cols-2">
        <div class="cmd-card">
          <h3>SBM Star Rating Protocol</h3>
          <table class="cmd-table">
            <tr><td><b>Door-to-door collection</b></td><td>96.4%</td><td><span class="cmd-badge ok">Star 5</span></td></tr>
            <tr><td><b>Source segregation</b></td><td>78.2%</td><td><span class="cmd-badge warn">Star 4</span></td></tr>
            <tr><td><b>Sweeping coverage</b></td><td>91.8%</td><td><span class="cmd-badge ok">Star 5</span></td></tr>
            <tr><td><b>Waste processing</b></td><td>72.0%</td><td><span class="cmd-badge warn">Star 3</span></td></tr>
            <tr><td><b>Plastic waste mgmt</b></td><td>68.5%</td><td><span class="cmd-badge warn">Star 3</span></td></tr>
            <tr><td><b>Public toilets functional</b></td><td>94.0%</td><td><span class="cmd-badge ok">Star 5</span></td></tr>
            <tr><td><b>Citizen satisfaction</b></td><td>4.3/5</td><td><span class="cmd-badge ok">Star 4</span></td></tr>
            <tr><td><b>Information transparency</b></td><td>Active</td><td><span class="cmd-badge ok">Active</span></td></tr>
          </table>
        </div>
        <div class="cmd-card">
          <h3>Auto-reported to portals <span class="cmd-badge mute" style="margin-left: 8px;">design-ready · demo</span></h3>
          <p style="color: var(--muted); font-size: 12px; margin-top: 0;">Report formats and cadences below are <b>designed to match</b> each programme's published spec. No live partner connections in this build — values shown are illustrative.</p>
          <table class="cmd-table">
            <tr><td><b>SBM Portal (MoHUA)</b></td><td>Daily</td><td><span class="cmd-badge mute">mock</span></td></tr>
            <tr><td><b>Swachh Survekshan</b></td><td>Live</td><td><span class="cmd-badge mute">mock</span></td></tr>
            <tr><td><b>AMRUT 2.0 dashboard</b></td><td>Weekly</td><td><span class="cmd-badge mute">mock</span></td></tr>
            <tr><td><b>Smart Cities Mission</b></td><td>Monthly</td><td><span class="cmd-badge mute">mock</span></td></tr>
            <tr><td><b>NITI Aayog SDG dashboard</b></td><td>Quarterly</td><td><span class="cmd-badge mute">SDG 6, 11, 12 (mock)</span></td></tr>
            <tr><td><b>CAG audit trail</b></td><td>On-demand</td><td><span class="cmd-badge mute">tamper-evident · design</span></td></tr>
            <tr><td><b>RTI compliance</b></td><td>30-day SLA</td><td><span class="cmd-badge mute">workflow only</span></td></tr>
          </table>
        </div>
      </div>
      <div class="cmd-card">
        <h3>Top-performing wards</h3>
        <div class="cmd-grid cols-3">
          ${wards.slice().sort((a,b)=>b.sbm_score-a.sbm_score).slice(0,6).map((w) => `
            <div style="padding: 14px; background: var(--surface-2); border-radius: 10px; border-left: 4px solid ${w.sbm_score>=90?'var(--ok)':w.sbm_score>=80?'var(--brand)':'var(--warn)'};">
              <div style="font-weight:700;">${w.name}</div>
              <div style="font-size: 11px; color: var(--muted); margin: 4px 0;">${w.cityName}</div>
              <div style="display:flex; justify-content:space-between; align-items: center; margin-top: 8px;">
                <span style="font-size: 22px; font-weight: 800;">${w.sbm_score}</span>
                <span style="color: var(--accent); font-weight:700;">${stars(w.star_rating)}</span>
              </div>
            </div>`).join('')}
        </div>
      </div>`;
  }

  function welfareView(root) {
    const w = MUNI.workers;
    const noKit = w.filter((x) => !x.safety_kit).length;
    const noIns = w.filter((x) => !x.insurance_active).length;
    const overdueHealth = w.filter((x) => x.last_health_check_days_ago > 90).length;
    const avgAttendance = Math.round(w.reduce((s, x) => s + x.attendance_pct, 0) / w.length);

    root.innerHTML = `
      <div><h2>Sanitation Worker Welfare <span class="cmd-badge info">${w.length} workers</span></h2>
        <div class="subhead">Real-time safety, attendance, insurance, and skill-development tracking · aligned with Safai Mitra Suraksha</div>
      </div>
      <div class="cmd-grid cols-4">
        <div class="cmd-card cmd-kpi"><div class="lbl">Workers tracked</div><div class="val">${w.length}</div></div>
        <div class="cmd-card cmd-kpi"><div class="lbl">Avg attendance</div><div class="val">${avgAttendance}%</div></div>
        <div class="cmd-card cmd-kpi ${noKit > 5 ? 'danger':''}"><div class="lbl">No safety kit</div><div class="val">${noKit}</div></div>
        <div class="cmd-card cmd-kpi ${overdueHealth > 10 ? 'danger':''}"><div class="lbl">Overdue health check</div><div class="val">${overdueHealth}</div></div>
      </div>
      <div class="cmd-grid cols-2">
        <div class="cmd-card">
          <h3>Welfare schemes coverage <span class="cmd-badge mute" style="margin-left: 8px;">simulated</span></h3>
          <table class="cmd-table">
            <tr><td><b>PMSBY (insurance ₹2L)</b></td><td>${w.length - noIns}/${w.length}</td><td>${Math.round((1-noIns/w.length)*100)}%</td></tr>
            <tr><td><b>Aasara pension eligible</b></td><td>14</td><td><span class="cmd-badge mute">mock</span></td></tr>
            <tr><td><b>Arogyasri health card</b></td><td>${w.length}/${w.length}</td><td>100%</td></tr>
            <tr><td><b>Safety kit issued</b></td><td>${w.length - noKit}/${w.length}</td><td>${Math.round((1-noKit/w.length)*100)}%</td></tr>
            <tr><td><b>2BHK housing scheme</b></td><td>9 allotted</td><td><span class="cmd-badge mute">mock</span></td></tr>
            <tr><td><b>KCR Kit (maternity)</b></td><td>3 distributed</td><td><span class="cmd-badge mute">mock</span></td></tr>
            <tr><td><b>T-SAT skill training</b></td><td>${w.filter((x) => x.skill_courses > 0).length}/${w.length}</td><td>${Math.round(w.filter((x) => x.skill_courses > 0).length/w.length*100)}%</td></tr>
          </table>
        </div>
        <div class="cmd-card">
          <h3>Active alerts</h3>
          <div class="cmd-alerts">
            <div class="alert warn"><div class="bar"></div><div class="ico">health_and_safety</div><div><div class="ttl">${noKit} workers without safety kit</div><div class="sub">Auto-PO raised on GeM · ETA 3 days</div></div><div class="acts"><button class="cmd-btn">View</button></div></div>
            <div class="alert warn"><div class="bar"></div><div class="ico">vaccines</div><div><div class="ttl">${overdueHealth} workers overdue for health check</div><div class="sub">Auto-scheduled at ESI Hospital · SMS sent</div></div><div class="acts"><button class="cmd-btn">View</button></div></div>
            <div class="alert info"><div class="bar"></div><div class="ico">school</div><div><div class="ttl">12 workers eligible for Skill India promotion</div><div class="sub">Training slots available next week</div></div><div class="acts"><button class="cmd-btn">Enroll</button></div></div>
          </div>
        </div>
      </div>
      <div class="cmd-card" style="padding: 0;">
        <table class="cmd-table">
          <thead><tr><th>Worker</th><th>Ward</th><th>Attendance</th><th>Safety kit</th><th>Insurance</th><th>Last health check</th><th>Skill courses</th></tr></thead>
          <tbody>
            ${w.slice(0, 30).map((x) => `<tr>
              <td><b>${x.name}</b></td><td>${x.ward}</td>
              <td><span class="cmd-badge ${x.attendance_pct>=95?'ok':x.attendance_pct>=85?'info':'warn'}">${x.attendance_pct}%</span></td>
              <td>${x.safety_kit ? '<span class="cmd-badge ok">✓</span>' : '<span class="cmd-badge bad">missing</span>'}</td>
              <td>${x.insurance_active ? '<span class="cmd-badge ok">PMSBY</span>' : '<span class="cmd-badge bad">expired</span>'}</td>
              <td>${x.last_health_check_days_ago > 90 ? `<span class="cmd-badge warn">${x.last_health_check_days_ago}d ago</span>` : `${x.last_health_check_days_ago}d ago`}</td>
              <td>${x.skill_courses}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function gisView(root) {
    root.innerHTML = `
      <div><h2>GIS — Live City Map <span class="cmd-badge info">Bhuvan-compatible</span></h2>
        <div class="subhead">Ward boundaries · grievance heatmap · sanitation routes · live incidents</div>
      </div>
      <div class="cmd-card" style="padding:0; overflow: hidden;">
        <div class="cmd-map" id="gisMap" style="height: 560px;">
          <div class="legend">
            <span><span class="dot" style="background: var(--ok);"></span>SBM ≥ 85</span>
            <span><span class="dot" style="background: var(--brand);"></span>70-84</span>
            <span><span class="dot" style="background: var(--warn);"></span>< 70</span>
            <span><span class="dot" style="background: var(--danger);"></span>SLA breach</span>
          </div>
        </div>
      </div>
      <div class="cmd-grid cols-3">
        <div class="cmd-card cmd-kpi"><div class="lbl">Wards mapped</div><div class="val">${MUNI.wards.length}</div></div>
        <div class="cmd-card cmd-kpi"><div class="lbl">Live incidents</div><div class="val">${MUNI.hazards.filter((h) => h.status === 'ACTIVE').length}</div></div>
        <div class="cmd-card cmd-kpi"><div class="lbl">Avg AQI</div><div class="val">${Math.round(MUNI.wards.reduce((s,w)=>s+w.air_quality,0)/MUNI.wards.length)}</div></div>
      </div>`;

    setTimeout(() => {
      if (!window.L) return;
      const el = document.getElementById('gisMap');
      const div = document.createElement('div');
      div.style.cssText = 'position:absolute; inset:0;';
      el.appendChild(div);
      const m = L.map(div, { zoomControl: true, attributionControl: true }).setView([22.0, 78.0], 5);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
        subdomains: 'abcd', maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }).addTo(m);
      MUNI.wards.forEach((w) => {
        const c = MUNI.cities.find((x) => x.id === w.cityId);
        if (!c) return;
        const lat = c.lat + (Math.random() - 0.5) * 0.15;
        const lng = c.lng + (Math.random() - 0.5) * 0.15;
        const color = w.sbm_score >= 85 ? '#34d399' : w.sbm_score >= 70 ? '#60a5fa' : '#fbbf24';
        L.circleMarker([lat, lng], {
          radius: 8 + Math.min(8, w.population_k / 20),
          color, fillColor: color, fillOpacity: 0.55, weight: 2,
        }).addTo(m).bindPopup(`<b>${w.name}</b><br/>${w.cityName} · ${w.population_k}K population<br/>SBM ${w.sbm_score} · ${stars(w.star_rating)}<br/>${w.workers} workers · ${w.bins_total} bins · ${w.grievances_open} open grievances`);
      });
    }, 80);
  }

  function disasterView(root) {
    root.innerHTML = `
      <div><h2>Disaster & Public Safety</h2>
        <div class="subhead">Real-time hazard detection · NDMA-compatible · auto-citizen alerts · resource dispatch</div>
      </div>
      <div class="cmd-grid cols-4">
        <div class="cmd-card cmd-kpi"><div class="lbl">Active incidents</div><div class="val">${MUNI.hazards.filter((h)=>h.status==='ACTIVE').length}</div></div>
        <div class="cmd-card cmd-kpi"><div class="lbl">Citizens alerted (24h)</div><div class="val">${(MUNI.hazards.reduce((s,h)=>s+h.citizens_alerted,0)/100000).toFixed(1)} L</div></div>
        <div class="cmd-card cmd-kpi"><div class="lbl">Channels</div><div class="val">SMS · WhatsApp · IVR</div></div>
        <div class="cmd-card cmd-kpi"><div class="lbl">Languages</div><div class="val">12</div></div>
      </div>
      <div class="cmd-card cmd-alerts" style="padding: 0;">
        ${MUNI.hazards.map((h) => `
          <div class="alert ${h.severity}">
            <div class="bar"></div>
            <div class="ico">${h.type === 'FLOODING' ? 'water_full' : h.type === 'HEATWAVE' ? 'wb_sunny' : h.type === 'POOR_AQI' ? 'air' : 'pest_control'}</div>
            <div>
              <div class="ttl">${h.text}</div>
              <div class="sub">${h.city} · ${(h.citizens_alerted/100000).toFixed(1)} L citizens alerted · ${fmtAgo(h.time)}</div>
            </div>
            <div class="acts">
              <span class="cmd-badge ${h.status === 'ACTIVE' ? 'bad' : h.status === 'CONTAINED' ? 'warn' : 'info'}">${h.status}</span>
              <button class="cmd-btn">Dispatch</button>
              <button class="cmd-btn">Alert again</button>
            </div>
          </div>`).join('')}
      </div>
      <div class="cmd-grid cols-2">
        <div class="cmd-card">
          <h3>Citizen alert channels</h3>
          <table class="cmd-table">
            <tr><td><b>SMS (DLT-approved)</b></td><td>1.2 Cr/day capacity</td><td><span class="cmd-badge ok">Active</span></td></tr>
            <tr><td><b>WhatsApp Business</b></td><td>Real-time push</td><td><span class="cmd-badge ok">Verified</span></td></tr>
            <tr><td><b>IVR auto-call</b></td><td>12 languages</td><td><span class="cmd-badge ok">Active</span></td></tr>
            <tr><td><b>Loudspeaker dispatch</b></td><td>Mobile units</td><td><span class="cmd-badge ok">8 ready</span></td></tr>
            <tr><td><b>App push</b></td><td>FCM</td><td><span class="cmd-badge ok">4.2L tokens</span></td></tr>
          </table>
        </div>
        <div class="cmd-card">
          <h3>NDMA + State integrations</h3>
          <table class="cmd-table">
            <tr><td><b>SACHET (NDMA early warning)</b></td><td>Subscribed</td><td><span class="cmd-badge ok">Live feed</span></td></tr>
            <tr><td><b>IMD weather feed</b></td><td>15-min refresh</td><td><span class="cmd-badge ok">Live</span></td></tr>
            <tr><td><b>CPCB air quality</b></td><td>Hourly</td><td><span class="cmd-badge ok">Live</span></td></tr>
            <tr><td><b>NIDM training calendar</b></td><td>Synced</td><td><span class="cmd-badge ok">Active</span></td></tr>
            <tr><td><b>State DM Authority</b></td><td>Real-time</td><td><span class="cmd-badge ok">Connected</span></td></tr>
          </table>
        </div>
      </div>`;
  }

  function reportsView(root) {
    root.innerHTML = `
      <div><h2>Compliance Reports <span class="cmd-badge ok">CAG audit-ready</span></h2>
        <div class="subhead">One-click reports for MoHUA · NITI Aayog · CAG · Smart Cities Mission · AMRUT</div>
      </div>
      <div class="cmd-grid cols-3">
        ${[
          { title: 'SBM Monthly Progress',          ver: 'MoHUA + TG-MAUD', dl: 'PDF · 2.4 MB' },
          { title: 'TG MAUD Performance Scorecard', ver: 'CDMA Telangana',  dl: 'XLSX · 1.6 MB' },
          { title: 'Mee-Seva grievance digest',     ver: 'TS eGov',          dl: 'XLSX · 980 KB' },
          { title: 'Smart Cities KPIs',              ver: 'MoUD',           dl: 'XLSX · 1.1 MB' },
          { title: 'AMRUT 2.0 quarterly',            ver: 'MoHUA',          dl: 'PDF · 3.8 MB' },
          { title: 'NITI Aayog SDG dashboard',       ver: 'SDG 6, 11, 12',  dl: 'JSON · 480 KB' },
          { title: 'CAG audit trail (Q3)',           ver: 'Tamper-evident', dl: 'PDF · 12 MB' },
          { title: 'TS-bPASS building permits',      ver: 'TS Online',      dl: 'JSON · 720 KB' },
          { title: 'Mission Bhagiratha water audit', ver: 'PHED Telangana', dl: 'XLSX · 2.1 MB' },
          { title: 'Aasara pension disbursement',    ver: 'TG SERP',        dl: 'XLSX · 540 KB' },
          { title: 'GeM procurement summary',        ver: 'GFR-compliant',  dl: 'XLSX · 680 KB' },
          { title: 'PFMS fund utilization',          ver: 'PFMS API',       dl: 'JSON · 1.4 MB' },
        ].map((r) => `
          <div class="cmd-card" style="cursor:pointer;" data-rep>
            <h3>${r.title}</h3>
            <div style="font-size: 12px; color: var(--muted); margin-bottom: 14px;">For ${r.ver}</div>
            <div style="display:flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; color: var(--muted);">${r.dl}</span>
              <button class="cmd-btn primary">Generate</button>
            </div>
          </div>`).join('')}
      </div>`;
    root.querySelectorAll('[data-rep] button').forEach((b) => b.onclick = () => {
      providers.push.show('Report generated', 'Saved to Downloads · audit logged', { icon: 'download' });
      audit('GENERATE_REPORT', b.closest('[data-rep]').querySelector('h3').textContent);
    });
  }

  // ─── Inject municipal sidebar section + route handlers ──────────────
  const MUNI_ROUTES = {
    wards: wardsView,
    grievances: grievancesView,
    sbm: sbmView,
    welfare: welfareView,
    gis: gisView,
    disaster: disasterView,
    reports: reportsView,
  };

  function injectSidebar() {
    const side = document.querySelector('.cmd-side');
    if (!side || document.getElementById('muniH')) return;
    const operatorBlock = side.querySelector('.operator');
    if (!operatorBlock) return;
    const h = document.createElement('div');
    h.id = 'muniH';
    h.className = 'section-h';
    h.textContent = 'Municipal · ULB';
    side.insertBefore(h, operatorBlock);
    const items = [
      ['wards',     'apartment',     'Wards'],
      ['grievances','support_agent', 'Grievances'],
      ['sbm',       'recycling',     'SBM Compliance'],
      ['welfare',   'health_and_safety', 'Worker Welfare'],
      ['gis',       'public',        'GIS Map'],
      ['disaster',  'crisis_alert',  'Disaster Mgmt'],
      ['reports',   'description',   'Compliance Reports'],
    ];
    items.forEach(([id, ico, label]) => {
      const a = document.createElement('a');
      a.dataset.route = id;
      a.innerHTML = `<span class="ico">${ico}</span><span class="nm">${label}</span>`;
      a.onclick = (e) => { e.preventDefault(); location.hash = '#' + id; };
      side.insertBefore(a, operatorBlock);
    });
  }
  setInterval(injectSidebar, 5000);

  // Hashchange handler for municipal routes
  function maybeRender() {
    const route = (location.hash || '').slice(1);
    if (!MUNI_ROUTES[route]) return;
    setTimeout(() => {
      const main = document.getElementById('main');
      if (!main) return;
      MUNI_ROUTES[route](main);
      const bc = document.querySelector('.cmd-top .breadcrumb b');
      const labels = { wards:'Wards', grievances:'Grievances', sbm:'SBM Compliance', welfare:'Worker Welfare', gis:'GIS Map', disaster:'Disaster Mgmt', reports:'Compliance Reports' };
      if (bc) bc.textContent = labels[route] || route;
      document.querySelectorAll('.cmd-side a.active').forEach((a) => a.classList.remove('active'));
      document.querySelector(`.cmd-side a[data-route="${route}"]`)?.classList.add('active');
    }, 50);
  }
  window.addEventListener('hashchange', maybeRender);
  if (MUNI_ROUTES[(location.hash || '').slice(1)]) setTimeout(maybeRender, 200);

  // Reframe brand for Real-Time Governance · Telangana. Throttled to 5s
  // (was 800ms) — the brand text is stable after the first paint.
  setInterval(() => {
    const t1 = document.querySelector('.cmd-side .brand .t1');
    const t2 = document.querySelector('.cmd-side .brand .t2');
    if (t1 && t1.textContent === 'Hearthly') t1.textContent = 'Hearthly Governance';
    if (t2 && t2.textContent === 'CMCC · LIVE') t2.textContent = 'TELANGANA · LIVE';
    document.title = 'Hearthly Governance · Telangana';
  }, 5000);

  return { MUNI };
})();
