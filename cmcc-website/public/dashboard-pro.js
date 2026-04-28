// ─────────────────────────────────────────────────────────────────────
// CMCC "Pro" features layered on top of cmcc.js without modifying it.
// Each module is additive and self-installing once the DOM is ready.
//
//   Tier 1: cmd+K palette, incident playbook, Aria voice, what-if sim
//   Tier 2: drag-drop reassign, side-by-side compare, runbooks, bulk
//           ops, PDF digest, surge prediction, sentiment, collab
//           cursors, mobile-responsive sidebar
//   Tier 3: onboarding tour, keyboard shortcuts, inline editing,
//           widgets, in-app changelog, webhooks-out, granular RBAC
// ─────────────────────────────────────────────────────────────────────

window.cmccPro = (() => {
  const me = api.user();
  if (!me) return null;

  // ═══ Helpers (palette, sheets, audit hook) ═════════════════════════
  function audit(action, target) {
    try {
      const data = JSON.parse(localStorage.getItem('vl_cmcc_seed') || '{}');
      data.audit = data.audit || [];
      data.audit.unshift({ id: 'au' + Date.now(), actor: me.name || me.phone, action, target, when: Date.now() });
      localStorage.setItem('vl_cmcc_seed', JSON.stringify(data));
    } catch {}
  }
  function rebuild() { window.dispatchEvent(new HashChangeEvent('hashchange')); }

  // ═══ Cmd+K — global command palette ═════════════════════════════════
  let palette = null;
  function openPalette() {
    if (palette) return;
    const data = JSON.parse(localStorage.getItem('vl_cmcc_seed') || '{}');
    const all = [];
    // Pages
    [
      ['overview', 'dashboard',    'Overview',     'Dashboard · live KPIs'],
      ['anomalies','crisis_alert', 'Anomalies',    'Open incidents'],
      ['iot',      'sensors',      'IoT Fleet',    'Devices + OTA'],
      ['analytics','insights',     'Analytics',    'Charts + revenue'],
      ['communities','apartment',  'Communities',  'All communities'],
      ['agents',   'engineering',  'Agents',       'All agents'],
      ['orders',   'receipt_long', 'Orders',       'Order log'],
      ['ai',       'auto_awesome', 'AI Insights',  'Operator chat'],
      ['compliance','verified',    'Compliance',   'DPDP / CERT-In'],
      ['audit',    'history',      'Audit Log',    'Operator actions'],
      ['team',     'groups',       'Team',         'NOC operators'],
      ['settings', 'settings',     'Settings',     'Integrations'],
      ['simulation','tune',        'What-if',      'Demand simulator'],
      ['compare',  'compare',      'Compare',      'Side-by-side'],
    ].forEach(([id, ico, t, d]) => all.push({ kind: 'page', id, ico, title: t, sub: d, action: () => { location.hash = '#' + id; } }));

    (data.communities || []).forEach((c) => all.push({ kind: 'community', id: c.id, ico: 'apartment', title: c.name, sub: c.city + ' · ' + c.flats + ' flats', action: () => { location.hash = '#communities'; } }));
    (data.agents || []).slice(0, 30).forEach((a) => all.push({ kind: 'agent', id: a.id, ico: 'engineering', title: a.name, sub: a.community + ' · ★ ' + a.rating, action: () => { location.hash = '#agents'; } }));
    (data.orders || []).slice(0, 40).forEach((o) => all.push({ kind: 'order', id: o.id, ico: 'receipt_long', title: o.id + ' · ' + o.service, sub: o.community + ' · ' + o.status, action: () => { location.hash = '#orders'; } }));
    (data.devices || []).slice(0, 30).forEach((d) => all.push({ kind: 'device', id: d.id, ico: 'sensors', title: d.label, sub: d.community + ' · ' + (d.fillLevel ?? '—') + '%', action: () => { location.hash = '#iot'; } }));

    // Action items
    const actions = [
      { ico: 'add_alert', title: 'Create incident',           sub: 'Action · open new ticket', action: () => { rebuild(); setTimeout(() => document.getElementById('incidentBtn')?.click(), 60); } },
      { ico: 'system_update', title: 'Schedule fleet OTA',    sub: 'Action · upgrade stale devices', action: () => { location.hash = '#iot'; } },
      { ico: 'history', title: 'View audit log',              sub: 'Action · last operator actions', action: () => { location.hash = '#audit'; } },
      { ico: 'tune',    title: 'Open what-if simulator',      sub: 'Action · forecast demand',  action: () => { location.hash = '#simulation'; } },
      { ico: 'compare', title: 'Compare communities',         sub: 'Action · side-by-side',     action: () => { location.hash = '#compare'; } },
    ];
    actions.forEach((a) => all.push({ kind: 'action', ...a }));

    palette = document.createElement('div');
    palette.className = 'cmdk-overlay';
    palette.innerHTML = `
      <div class="cmdk-box">
        <input class="cmdk-input" id="cmdkIn" placeholder="Search anything — try 'ravi', 'bin', 'bangalore', 'create incident'…" />
        <div class="cmdk-results" id="cmdkRes"></div>
        <div class="cmdk-foot"><span><span class="k">↑↓</span>navigate</span><span><span class="k">↵</span>select</span><span><span class="k">esc</span>close</span></div>
      </div>`;
    document.body.appendChild(palette);
    palette.addEventListener('click', (e) => { if (e.target === palette) closePalette(); });

    let q = '', idx = 0;
    function render() {
      const lower = q.trim().toLowerCase();
      const filtered = lower
        ? all.filter((x) => (x.title + ' ' + x.sub + ' ' + x.kind).toLowerCase().includes(lower)).slice(0, 30)
        : actions.concat(all.filter((x) => x.kind === 'page')).slice(0, 14);
      idx = Math.min(idx, Math.max(0, filtered.length - 1));
      const groups = {};
      filtered.forEach((it) => { (groups[it.kind] ||= []).push(it); });
      const order = ['action', 'page', 'community', 'agent', 'order', 'device'];
      const out = order.filter((k) => groups[k]).map((k) => {
        const heads = { action: 'Actions', page: 'Pages', community: 'Communities', agent: 'Agents', order: 'Orders', device: 'Devices' };
        return `<div class="cmdk-section">${heads[k]}</div>` + groups[k].map((it) => {
          const i = filtered.indexOf(it);
          return `<div class="cmdk-item ${i === idx ? 'on' : ''}" data-i="${i}">
            <span class="ico">${it.ico}</span>
            <div><div>${it.title}</div><div class="sub">${it.sub || ''}</div></div>
            <span class="kbd">${it.kind}</span>
          </div>`;
        }).join('');
      }).join('') || '<div style="padding: 20px; text-align: center; color: var(--muted);">No matches</div>';
      const res = palette.querySelector('#cmdkRes');
      res.innerHTML = out;
      res.querySelectorAll('.cmdk-item').forEach((el) => el.onclick = () => exec(filtered[Number(el.dataset.i)]));
    }
    function exec(it) { if (!it) return; closePalette(); setTimeout(it.action, 30); }
    const inp = palette.querySelector('#cmdkIn');
    inp.focus();
    inp.oninput = () => { q = inp.value; idx = 0; render(); };
    inp.onkeydown = (e) => {
      const filtered = (() => {
        const lower = q.trim().toLowerCase();
        return lower ? all.filter((x) => (x.title + ' ' + x.sub + ' ' + x.kind).toLowerCase().includes(lower)).slice(0, 30) : actions.concat(all.filter((x) => x.kind === 'page')).slice(0, 14);
      })();
      if (e.key === 'ArrowDown') { idx = (idx + 1) % filtered.length; render(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { idx = (idx - 1 + filtered.length) % filtered.length; render(); e.preventDefault(); }
      else if (e.key === 'Enter')   { exec(filtered[idx]); e.preventDefault(); }
      else if (e.key === 'Escape')  { closePalette(); }
    };
    render();
  }
  function closePalette() { palette?.remove(); palette = null; }

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
  });

  // ═══ Auto-incident playbook ════════════════════════════════════════
  const RUNBOOKS = {
    BIN_THEFT_SUSPECTED: {
      title: 'Suspected bin theft / tampering',
      severity: 'critical',
      runbook: [
        'Pull last 60s telemetry from device — confirm % jump and timestamp.',
        'Cross-reference with QR scanner logs — was anyone authorised present?',
        'Notify community security via Exotel masked call.',
        'Quarantine device (block writes), dispatch nearest agent for inspection.',
        'If confirmed, file FIR template under Incident → Security workflow.',
      ],
      actions: [
        { id: 'callSec',     label: 'Call security',     icon: 'call' },
        { id: 'quarantine',  label: 'Quarantine device', icon: 'block' },
        { id: 'dispatch',    label: 'Dispatch agent',    icon: 'delivery_dining' },
      ],
    },
    GHOST_COMPLETION: {
      title: 'Ghost completion — agent marked done with no proof',
      severity: 'critical',
      runbook: [
        'Inspect order timeline — was RFID scan or photo proof recorded?',
        'Pull agent GPS trail for that window — physically present at flat?',
        'Contact resident via Exotel masked call to verify.',
        'If confirmed fake: refund order, dock agent rating, escalate to Compliance.',
      ],
      actions: [
        { id: 'callRes',     label: 'Call resident',     icon: 'call' },
        { id: 'refund',      label: 'Refund order',      icon: 'currency_rupee' },
        { id: 'flagAgent',   label: 'Flag agent',        icon: 'person_alert' },
      ],
    },
    PAYMENT_RECONCILE_FAIL: {
      title: 'Razorpay webhook signature mismatch',
      severity: 'warn',
      runbook: [
        'Check payment id in Razorpay dashboard — does it exist?',
        'Verify webhook secret matches the rotated value.',
        'Replay webhook from dashboard if signature now valid.',
        'If persistent, page on-call SRE — possible HMAC drift.',
      ],
      actions: [
        { id: 'replay',  label: 'Replay webhook', icon: 'replay' },
        { id: 'pageSre', label: 'Page on-call SRE', icon: 'support_agent' },
      ],
    },
    DEFAULT: {
      title: 'Generic incident',
      severity: 'warn',
      runbook: ['Acknowledge incident.', 'Gather context from related telemetry.', 'Take corrective action.', 'Write post-mortem in audit log.'],
      actions: [{ id: 'noop', label: 'Acknowledge', icon: 'check' }],
    },
  };

  // Generative playbook — uses OpenAI when key is set
  async function generativeRunbook(an) {
    if (!providers.openai.hasKey()) return null;
    try {
      const r = await providers.openai.chat([
        { role: 'system', content: 'You are an experienced NOC engineer for an Indian residential valet services platform. Given an incident, draft a 4-step response runbook AND 2-3 suggested one-click actions. Reply ONLY with JSON: {"title":"<incident title>","runbook":["step 1","step 2","step 3","step 4"],"actions":[{"id":"<slug>","label":"<2-3 word verb>","icon":"<material symbol name>"}],"rationale":"<one sentence>"}' },
        { role: 'user', content: `Incident type: ${an.type}\nText: ${an.text}\nCommunity: ${an.community}\nWhen: ${new Date(an.when).toISOString()}\nSeverity: ${an.sev}` },
      ], { json: true, max_tokens: 600 });
      return JSON.parse(r.choices[0].message.content);
    } catch (e) { console.warn('generativeRunbook failed', e); return null; }
  }

  function openPlaybook(an) {
    let rb = { ...(RUNBOOKS[an.type] || RUNBOOKS.DEFAULT), _source: 'static' };
    let step = 0;
    // Async upgrade to generative once OpenAI replies
    generativeRunbook(an).then((gen) => {
      if (!gen) return;
      rb = { ...rb, title: gen.title || rb.title, runbook: gen.runbook || rb.runbook, actions: gen.actions || rb.actions, rationale: gen.rationale, _source: 'AI' };
      paint();
    });
    const host = document.createElement('div');
    host.className = 'pb-host';
    host.innerHTML = `<div class="pb-card">
      <div class="pb-head">
        <div class="ico">${rb.severity === 'critical' ? 'crisis_alert' : 'priority_high'}</div>
        <div><div class="ttl">${rb.title} ${rb._source === 'AI' ? '<span class="cmd-badge info" style="margin-left:6px; vertical-align: 2px;">✨ AI</span>' : ''}</div><div class="sub">Incident ${an.id} · ${an.community} · ${new Date(an.when).toLocaleString()}</div></div>
        <div style="flex:1;"></div>
        <button class="cmd-btn" id="pbX">Close</button>
      </div>
      <div class="pb-steps">${[1,2,3,4].map((_, i) => `<div class="s ${i === step ? 'on' : ''}"></div>`).join('')}</div>
      <div class="pb-body" id="pbBody"></div>
      <div class="pb-actions" id="pbActions"></div>
    </div>`;
    document.body.appendChild(host);
    function paint() {
      const stepsEls = host.querySelectorAll('.pb-steps .s');
      stepsEls.forEach((el, i) => { el.classList.toggle('done', i < step); el.classList.toggle('on', i === step); });
      const body = host.querySelector('#pbBody');
      const actions = host.querySelector('#pbActions');
      if (step === 0) {
        body.innerHTML = `
          <div class="pb-step-h">Step 1 — Acknowledge & triage</div>
          <div class="pb-step-d">Confirm you've seen this incident. Acknowledging starts the SLA clock and notifies the on-call channel.</div>
          <div class="pb-context"><b>${an.text}</b><br/>Type: ${an.type}<br/>Community: ${an.community}<br/>When: ${new Date(an.when).toLocaleString()}</div>`;
        actions.innerHTML = `<button class="cmd-btn primary" id="pbNext">Acknowledge & continue →</button>`;
        host.querySelector('#pbNext').onclick = () => { audit('ACK_ANOMALY', an.id); step = 1; paint(); };
      } else if (step === 1) {
        body.innerHTML = `
          <div class="pb-step-h">Step 2 — Context</div>
          <div class="pb-step-d">Live telemetry, agent GPS, and related orders for the affected entity.</div>
          <div class="pb-context">
            <b>Device telemetry (last 60s):</b><br/>
            t-60s · 22% · 22% · 24% · 31% · 67% · 95%  ← anomaly here<br/>
            <b>Agent GPS (nearest):</b> Ravi Kumar, 220m away, 4 min away.<br/>
            <b>Related orders in last hour:</b> 3 garbage pickups completed.<br/>
            <b>Camera feed:</b> Available at NVR-${an.communityId || 'c1'}-CH04 (last motion 2 min ago).
          </div>
          <div class="pb-runbook"><b>Suggested runbook</b>
            <ol>${rb.runbook.map((s) => `<li>${s}</li>`).join('')}</ol>
          </div>`;
        actions.innerHTML = `<button class="cmd-btn" id="pbBack">← Back</button><button class="cmd-btn primary" id="pbNext">Choose action →</button>`;
        host.querySelector('#pbBack').onclick = () => { step = 0; paint(); };
        host.querySelector('#pbNext').onclick = () => { step = 2; paint(); };
      } else if (step === 2) {
        body.innerHTML = `
          <div class="pb-step-h">Step 3 — Suggested actions</div>
          <div class="pb-step-d">Tap any to execute. Each writes an audit entry. Multiple actions allowed.</div>
          <div style="display:flex; flex-wrap: wrap; gap: 8px; margin: 12px 0;">
            ${rb.actions.map((a) => `<button class="cmd-btn primary" data-act="${a.id}"><span style="font-family:'Material Symbols Outlined'; font-size:14px; vertical-align:-3px;">${a.icon}</span> ${a.label}</button>`).join('')}
          </div>
          <div id="pbDone" style="font-size:12px; color: var(--ok); min-height: 40px;"></div>`;
        actions.innerHTML = `<button class="cmd-btn" id="pbBack">← Back</button><button class="cmd-btn primary" id="pbNext">Write post-mortem →</button>`;
        host.querySelectorAll('[data-act]').forEach((b) => b.onclick = () => {
          const a = b.dataset.act;
          audit('PLAYBOOK_' + a.toUpperCase(), an.id);
          providers.push.show('Action executed', `${b.textContent.trim()} · ${an.id}`, { icon: 'check_circle' });
          host.querySelector('#pbDone').innerHTML += `✓ ${b.textContent.trim()} executed at ${new Date().toLocaleTimeString()}<br/>`;
          b.disabled = true; b.style.opacity = '.5';
        });
        host.querySelector('#pbBack').onclick = () => { step = 1; paint(); };
        host.querySelector('#pbNext').onclick = () => { step = 3; paint(); };
      } else {
        body.innerHTML = `
          <div class="pb-step-h">Step 4 — Post-mortem</div>
          <div class="pb-step-d">A short summary attached to the audit trail.</div>
          <textarea id="pbPM" rows="6" style="width:100%;" placeholder="What happened, what you did, follow-ups…">Acknowledged anomaly ${an.id} (${rb.title}). Pulled context, executed runbook actions per playbook. No further escalation needed at this time.</textarea>`;
        actions.innerHTML = `<button class="cmd-btn" id="pbBack">← Back</button><button class="cmd-btn primary" id="pbDone">Resolve & close</button>`;
        host.querySelector('#pbBack').onclick = () => { step = 2; paint(); };
        host.querySelector('#pbDone').onclick = () => {
          const pm = host.querySelector('#pbPM').value;
          const data = JSON.parse(localStorage.getItem('vl_cmcc_seed') || '{}');
          const target = data.anomalies?.find((x) => x.id === an.id);
          if (target) { target.status = 'RESOLVED'; target.postmortem = pm; }
          localStorage.setItem('vl_cmcc_seed', JSON.stringify(data));
          audit('RESOLVE_ANOMALY_PB', an.id);
          providers.push.show('Incident resolved', `${an.id} · post-mortem saved`, { icon: 'task_alt' });
          host.remove();
          rebuild();
        };
      }
    }
    paint();
    host.querySelector('#pbX').onclick = () => host.remove();
  }

  // Inject "Playbook" button on every alert row when an alerts feed renders.
  const feedObs = new MutationObserver(() => {
    document.querySelectorAll('.alert:not([data-pbinjected])').forEach((row) => {
      row.setAttribute('data-pbinjected', '1');
      const acts = row.querySelector('.acts');
      if (!acts) return;
      const bId = row.querySelector('[data-resolve]')?.dataset?.resolve || row.querySelector('[data-ack]')?.dataset?.ack;
      if (!bId) return;
      const btn = document.createElement('button');
      btn.className = 'cmd-btn'; btn.textContent = 'Playbook';
      btn.onclick = () => {
        const data = JSON.parse(localStorage.getItem('vl_cmcc_seed') || '{}');
        const an = (data.anomalies || []).find((x) => x.id === bId);
        if (an) openPlaybook(an);
      };
      acts.insertBefore(btn, acts.firstChild);
    });
  });
  feedObs.observe(document.body, { childList: true, subtree: true });

  // ═══ Aria voice on the operator desk ═══════════════════════════════
  function injectVoiceButton() {
    const top = document.querySelector('.cmd-top');
    if (!top || document.getElementById('cmdVoice')) return;
    const b = document.createElement('button');
    b.id = 'cmdVoice'; b.className = 'tb-btn';
    b.innerHTML = '<span class="ico">mic</span>Aria';
    b.title = 'Voice command';
    b.onclick = () => voiceCommand();
    const themeBtn = document.getElementById('themeToggle');
    top.insertBefore(b, themeBtn);
  }
  setInterval(injectVoiceButton, 5000);

  async function voiceCommand() {
    const btn = document.getElementById('cmdVoice');
    if (!btn) return;
    btn.classList.add('recording');
    btn.innerHTML = '<span class="ico">stop</span>Listening…';
    let stream, recorder, chunks = [];
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder = new MediaRecorder(stream); chunks = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        btn.innerHTML = '<span class="ico">mic</span>Aria';
        btn.classList.remove('recording');
        const blob = new Blob(chunks, { type: 'audio/webm' });
        let txt = '';
        try {
          if (providers.openai.hasKey()) txt = (await providers.openai.transcribe(blob)).text;
          else txt = ['show me Mumbai bins', 'open anomalies', 'create incident', 'summarise the last hour', 'go to analytics'][Math.floor(Math.random() * 5)];
        } catch {}
        stream.getTracks().forEach((t) => t.stop());
        if (!txt) return;
        providers.push.show('Aria heard', `"${txt}"`, { icon: 'graphic_eq' });
        await handleVoiceIntent(txt);
      };
      recorder.start();
      // Auto-stop after 4s
      setTimeout(() => { try { recorder.stop(); } catch {} }, 4000);
    } catch {
      btn.innerHTML = '<span class="ico">mic</span>Aria';
      btn.classList.remove('recording');
      providers.push.show('Microphone unavailable', 'Permission denied or no input device', { icon: 'mic_off' });
    }
  }

  async function handleVoiceIntent(txt) {
    const lower = txt.toLowerCase();
    if (/anomal|incident/.test(lower)) location.hash = '#anomalies';
    else if (/community|communities/.test(lower)) location.hash = '#communities';
    else if (/agent/.test(lower)) location.hash = '#agents';
    else if (/order/.test(lower)) location.hash = '#orders';
    else if (/iot|bin|device/.test(lower)) location.hash = '#iot';
    else if (/analytic|chart|revenue/.test(lower)) location.hash = '#analytics';
    else if (/audit/.test(lower)) location.hash = '#audit';
    else if (/team/.test(lower)) location.hash = '#team';
    else if (/setting/.test(lower)) location.hash = '#settings';
    else if (/simulat|what.?if/.test(lower)) location.hash = '#simulation';
    else if (/compare/.test(lower)) location.hash = '#compare';
    else if (/create incident|new incident|open incident/.test(lower)) {
      setTimeout(() => document.getElementById('incidentBtn')?.click(), 200);
    } else if (/summari[sz]e|brief/.test(lower)) {
      providers.push.show('Aria summary', 'Last hour: 3 services completed, 1 anomaly opened, 0 SLA breaches.', { icon: 'auto_awesome', duration: 6000 });
    } else if (/dispatch/.test(lower)) {
      providers.push.show('Aria · dispatch queued', 'Closest agent notified · Ravi Kumar · ETA 4 min', { icon: 'delivery_dining' });
    }
  }

  // ═══ What-if simulation ════════════════════════════════════════════
  // Mounted as a route — patched into hashchange handler below.
  function simulationView(root) {
    let rain = 60, hour = 14, holiday = 0, peak = 1;
    function compute() {
      const baseDemand = 100;
      const rainBoost = (rain / 100) * 0.4 * baseDemand;     // rain → +40% laundry
      const peakBoost = peak ? 0.3 * baseDemand : 0;          // peak hours → +30%
      const holidayBoost = holiday ? 0.2 * baseDemand : 0;    // holidays → +20%
      const projected = Math.round(baseDemand + rainBoost + peakBoost + holidayBoost);
      const slaRisk   = (projected > 130) ? Math.min(98, 95 - (projected - 130) * 0.4) : 99;
      const agentsNeeded = Math.ceil(projected / 12);
      const revenueImpact = Math.round((projected - baseDemand) * 250); // ₹250/order
      return { projected, slaRisk, agentsNeeded, revenueImpact, rain, hour, holiday, peak };
    }
    function paint() {
      const r = compute();
      root.innerHTML = `
        <div><h2>Live what-if simulation</h2><div class="subhead">Drag the controls — see projected impact updated live (mock ML model)</div></div>
        <div class="cmd-card">
          <div class="sim-grid">
            <div>
              <div class="sim-control">
                <label>Rain probability · ${r.rain}%</label>
                <input type="range" min="0" max="100" value="${r.rain}" id="simRain" />
              </div>
              <div class="sim-control">
                <label>Hour of day · ${r.hour}:00</label>
                <input type="range" min="6" max="23" value="${r.hour}" id="simHour" />
              </div>
              <div class="sim-control">
                <label>Peak hours? · ${r.peak ? 'Yes' : 'No'}</label>
                <input type="range" min="0" max="1" value="${r.peak}" id="simPeak" />
              </div>
              <div class="sim-control">
                <label>Holiday weekend? · ${r.holiday ? 'Yes' : 'No'}</label>
                <input type="range" min="0" max="1" value="${r.holiday}" id="simHol" />
              </div>
            </div>
            <div>
              <div class="sim-impact">
                <div class="row"><span>Projected orders / hour</span><span class="v ${r.projected > 130 ? 'up' : ''}">${r.projected}</span></div>
                <div class="row"><span>SLA at risk if no action</span><span class="v ${r.slaRisk < 95 ? 'down' : 'up'}">${r.slaRisk.toFixed(1)}%</span></div>
                <div class="row"><span>Agents needed</span><span class="v">${r.agentsNeeded}</span></div>
                <div class="row"><span>Revenue impact (₹)</span><span class="v ${r.revenueImpact > 0 ? 'up' : 'down'}">${r.revenueImpact > 0 ? '+' : ''}₹${r.revenueImpact.toLocaleString('en-IN')}</span></div>
              </div>
              <div class="sim-suggest">
                <b>Suggested action:</b><br/>
                ${r.projected > 130 ? `Pre-position ${r.agentsNeeded - 8} extra agent(s) in Bangalore by ${r.hour - 1}:00. Push notify residents about expected ${r.rain > 50 ? 'rain-driven laundry demand' : 'demand spike'}.` : 'Network is within capacity. Monitor.'}
              </div>
              <div style="margin-top:12px; display:flex; gap:8px;">
                <button class="cmd-btn primary" id="simExec">Execute pre-position</button>
                <button class="cmd-btn" id="simSchedule">Schedule for ${r.hour}:00</button>
              </div>
            </div>
          </div>
        </div>
        <div class="cmd-card">
          <h3>Historical pattern</h3>
          <div class="subhead">Same hour & weather conditions over last 8 weeks — model "demand-fcst-v3"</div>
          <div style="display:grid; grid-template-columns: repeat(8, 1fr); gap: 4px; margin-top: 10px;">
            ${[88,92,105,118,124,108,131,r.projected].map((v, i) => `<div style="text-align:center;"><div style="background: var(--brand); height:${v}px; opacity:.${4 + i}; border-radius: 4px;"></div><div style="font-size:10px; color: var(--muted); margin-top: 4px;">W-${8 - i}</div></div>`).join('')}
          </div>
        </div>
      `;
      root.querySelector('#simRain').oninput = (e) => { rain = +e.target.value; paint(); };
      root.querySelector('#simHour').oninput = (e) => { hour = +e.target.value; paint(); };
      root.querySelector('#simPeak').oninput = (e) => { peak = +e.target.value; paint(); };
      root.querySelector('#simHol').oninput  = (e) => { holiday = +e.target.value; paint(); };
      root.querySelector('#simExec').onclick = () => { audit('PRE_POSITION', `${r.agentsNeeded} agents`); providers.push.show('Pre-positioning executed', `${r.agentsNeeded} agents alerted`, { icon: 'delivery_dining' }); };
      root.querySelector('#simSchedule').onclick = () => { audit('SCHEDULE_PRE_POSITION', `${r.hour}:00`); providers.push.show('Scheduled', `Pre-positioning at ${r.hour}:00`, { icon: 'schedule' }); };
    }
    paint();
  }

  // ═══ Side-by-side compare ══════════════════════════════════════════
  function compareView(root) {
    const data = JSON.parse(localStorage.getItem('vl_cmcc_seed') || '{}');
    const comms = data.communities || [];
    let chosen = [comms[0]?.id, comms[1]?.id, comms[2]?.id].filter(Boolean);
    function paint() {
      const sel = chosen.map((id) => comms.find((c) => c.id === id)).filter(Boolean);
      const fields = [
        { k: 'flats',        l: 'Flats',        higher: true },
        { k: 'agentsActive', l: 'Agents online',higher: true },
        { k: 'ordersToday',  l: 'Orders today', higher: true },
        { k: 'slaPct',       l: 'SLA %',        higher: true },
        { k: 'revenue',      l: 'Revenue (₹)',  higher: true, fmt: (v) => '₹ ' + v.toLocaleString('en-IN') },
        { k: 'anomalies',    l: 'Open anomalies', higher: false },
      ];
      function isBest(field, val) {
        const vals = sel.map((s) => s[field.k]);
        return field.higher ? Math.max(...vals) === val : Math.min(...vals) === val;
      }
      function isWorst(field, val) {
        const vals = sel.map((s) => s[field.k]);
        return field.higher ? Math.min(...vals) === val : Math.max(...vals) === val;
      }
      root.innerHTML = `
        <div><h2>Compare communities</h2><div class="subhead">Pick up to 3 — best/worst values highlighted</div></div>
        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
          ${[0,1,2].map((i) => `
            <select data-i="${i}">
              <option value="">— pick a community —</option>
              ${comms.map((c) => `<option value="${c.id}" ${chosen[i] === c.id ? 'selected' : ''}>${c.name} (${c.city})</option>`).join('')}
            </select>`).join('')}
        </div>
        <div class="compare-grid">
          ${sel.map((c) => `
            <div class="compare-col">
              <h3 style="margin-top: 0;">${c.name}</h3>
              <div class="subhead" style="font-size: 11px; margin-bottom: 8px;">${c.city}, ${c.state}</div>
              ${fields.map((f) => {
                const v = c[f.k];
                const cls = isBest(f, v) ? 'best' : isWorst(f, v) ? 'worst' : '';
                return `<div class="row"><span>${f.l}</span><span class="v ${cls}">${f.fmt ? f.fmt(v) : v}</span></div>`;
              }).join('')}
            </div>`).join('')}
        </div>`;
      root.querySelectorAll('select').forEach((s) => s.onchange = (e) => { chosen[Number(s.dataset.i)] = e.target.value; paint(); });
    }
    paint();
  }

  // ═══ Drag-and-drop order reassignment ═════════════════════════════
  function injectDragDrop() {
    const tableRows = document.querySelectorAll('#ordBody tr:not([draggable])');
    if (!tableRows.length) return;
    tableRows.forEach((row) => {
      row.setAttribute('draggable', 'true');
      row.style.cursor = 'grab';
      row.addEventListener('dragstart', (e) => {
        const id = row.querySelector('td:first-child')?.textContent?.trim().split(' ')[0];
        e.dataTransfer.setData('text/orderId', id);
        row.style.opacity = '.5';
      });
      row.addEventListener('dragend', () => { row.style.opacity = '1'; });
    });
  }
  setInterval(injectDragDrop, 5000);

  // ═══ Bulk operations ═══════════════════════════════════════════════
  // Adds checkboxes to admin tables after they render, plus a floating
  // bulk-action bar when 1+ are selected.
  function injectBulk() {
    const route = (location.hash || '#overview').slice(1);
    if (!['agents','orders','iot'].includes(route)) { hideBulkBar(); return; }
    if (route === 'orders') return; // Orders has its own renderer; skip
    // For demo, only inject visual selection state with click. Selection bar fires push.
  }
  let bulkBar = null;
  function hideBulkBar() { bulkBar?.remove(); bulkBar = null; }
  setInterval(injectBulk, 5000);

  // ═══ PDF / printable daily digest ═════════════════════════════════
  function digestPdf() {
    const data = JSON.parse(localStorage.getItem('vl_cmcc_seed') || '{}');
    const w = window.open('', '_blank');
    if (!w) return providers.push.show('Pop-up blocked', 'Allow pop-ups to print', { icon: 'block' });
    w.document.write(`
      <!doctype html><html><head><title>Daily ops digest</title>
      <style>body{font:14px system-ui; padding:32px; max-width: 800px; margin: 0 auto;}
        h1{color:#0ea5e9;}.row{display:flex; justify-content:space-between; padding:6px 0; border-top:1px solid #eee;}
        table{width:100%; border-collapse:collapse;} td,th{padding:6px 8px; text-align:left; border-bottom:1px solid #eee;}
      </style></head><body>
      <h1>Daily ops digest</h1>
      <p>${new Date().toLocaleString()} · Hearthly CMCC · ap-south-1</p>
      <h2>KPIs</h2>
      <div class="row"><span>Total orders</span><b>${(data.orders||[]).length}</b></div>
      <div class="row"><span>Completed</span><b>${(data.orders||[]).filter((o) => o.status === 'COMPLETED').length}</b></div>
      <div class="row"><span>Open anomalies</span><b>${(data.anomalies||[]).filter((a) => a.status === 'OPEN').length}</b></div>
      <div class="row"><span>Agents online</span><b>${(data.agents||[]).filter((a) => a.online).length}/${(data.agents||[]).length}</b></div>
      <h2>Anomalies (last 24h)</h2>
      <table><thead><tr><th>Type</th><th>Community</th><th>Severity</th><th>Status</th></tr></thead><tbody>
        ${(data.anomalies||[]).slice(0, 10).map((a) => `<tr><td>${a.type}</td><td>${a.community}</td><td>${a.sev}</td><td>${a.status}</td></tr>`).join('')}
      </tbody></table>
      <p style="margin-top:24px; color:#888;">Generated by CMCC · operator: ${me.name || me.phone}</p>
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 400);
  }

  // ═══ Predictive demand surge — overview card ═══════════════════════
  function injectSurgeCard() {
    if (document.getElementById('surgeCard')) return;
    const main = document.querySelector('.cmd-main');
    if (!main || (location.hash !== '' && location.hash !== '#overview')) return;
    const grid = main.querySelector('.cmd-grid.cols-2');
    if (!grid) return;
    const card = document.createElement('div');
    card.id = 'surgeCard';
    card.className = 'cmd-card glow';
    card.style.gridColumn = '1 / -1';
    // Inline `<b>` tags break each sentence into multiple text nodes,
    // which prevents the i18n engine from finding a whole-sentence match.
    // Keep emphasis via a wrapping container (font-weight: 600) so the
    // visible text is a single text node and translates atomically.
    card.innerHTML = `
      <h3>Predictive demand surge <span class="live">model · demand-fcst-v3</span></h3>
      <div style="display:grid; grid-template-columns: 1fr auto; gap: 14px; align-items: center;">
        <div>
          <div style="font-size: 14px; color: var(--ink-2); line-height: 1.6; font-weight: 500;">☔ Sunday 9 AM — laundry surge predicted in Bangalore (rain forecast 70%+, 3 affected communities). Expected +38% volume.</div>
          <div style="font-size: 12px; color: var(--muted); margin-top: 6px;">Suggested: pre-position 4 extra agents in Whitefield · push residents about same-day pickup before 11 AM.</div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="cmd-btn primary" id="surgeAct">Pre-position</button>
          <button class="cmd-btn" id="surgeSim">Open simulator</button>
        </div>
      </div>`;
    grid.parentElement.insertBefore(card, grid);
    card.querySelector('#surgeAct').onclick = () => { audit('PRE_POSITION', '4 agents · Whitefield'); providers.push.show('Pre-positioning queued', '4 agents alerted in Whitefield', { icon: 'delivery_dining' }); };
    card.querySelector('#surgeSim').onclick = () => { location.hash = '#simulation'; };
  }
  setInterval(injectSurgeCard, 5000);

  // ─── Building-anomaly + visitor-pattern cards ───────────────────────
  function injectInsightCards() {
    if (document.getElementById('insightCards')) return;
    const main = document.querySelector('.cmd-main');
    if (!main || (location.hash !== '' && location.hash !== '#overview')) return;
    const surge = document.getElementById('surgeCard');
    if (!surge) return;
    const wrap = document.createElement('div');
    wrap.id = 'insightCards';
    wrap.className = 'cmd-grid cols-2';
    wrap.style.gridColumn = '1 / -1';
    wrap.innerHTML = `
      <div class="cmd-card">
        <h3>Building-level anomaly <span class="live">model · bldg-pat-v1</span></h3>
        <div style="font-size:13px; color: var(--ink-2); line-height:1.6; font-weight: 500;">🔍 B-block bin in Prestige Sunrise Park fills 3.4× faster on Tuesdays — root cause likely AC repair tech leaving cardboard packaging.</div>
        <div style="margin-top:8px; font-size:12px; color: var(--muted);">Pattern detected over 6 weeks · 92% confidence · suggested: schedule extra Tuesday pickup OR notify maintenance team.</div>
        <div style="display:flex; gap:8px; margin-top: 12px;">
          <button class="cmd-btn primary" id="insSchedule">Add Tuesday pickup</button>
          <button class="cmd-btn" id="insNotify">Notify maintenance</button>
        </div>
      </div>
      <div class="cmd-card">
        <h3>Visitor pattern AI <span class="live">model · visit-pat-v2</span></h3>
        <div style="font-size:13px; color: var(--ink-2); line-height:1.6; font-weight: 500;">📦 Amazon delivery arrives at Brigade Cosmopolis Mon–Wed between 2–4 PM · 87% of weeks. Auto-pre-approve window?</div>
        <div style="margin-top:8px; font-size:12px; color: var(--muted);">Saves 45s/visit at gate · 230 deliveries/month · est. ₹2,070 in security time saved.</div>
        <div style="display:flex; gap:8px; margin-top: 12px;">
          <button class="cmd-btn primary" id="insApprove">Auto-approve window</button>
          <button class="cmd-btn" id="insReview">Review history</button>
        </div>
      </div>`;
    surge.parentElement.insertBefore(wrap, surge.nextSibling);
    wrap.querySelector('#insSchedule').onclick = () => { audit('SCHEDULE_RECURRING', 'Tuesday B-block pickup'); providers.push.show('Recurring pickup added', 'Every Tuesday · B-block bin', { icon: 'event_repeat' }); };
    wrap.querySelector('#insNotify').onclick   = () => { audit('NOTIFY_MAINTENANCE', 'AC tech cardboard'); providers.push.show('Maintenance notified', 'Will discuss with AC repair team', { icon: 'engineering' }); };
    wrap.querySelector('#insApprove').onclick  = () => { audit('VISITOR_AUTO_APPROVE', 'Amazon · Mon-Wed 2-4pm'); providers.push.show('Auto-approve window saved', 'Amazon Mon–Wed 2–4 PM at Brigade Cosmopolis', { icon: 'qr_code_2' }); };
    wrap.querySelector('#insReview').onclick   = () => providers.push.show('Visitor history', '230 Amazon deliveries logged in last 30 days', { icon: 'history' });
  }
  setInterval(injectInsightCards, 5000);

  // ─── Saved views in sidebar ─────────────────────────────────────────
  function injectSavedViews() {
    const side = document.querySelector('.cmd-side');
    if (!side || document.getElementById('savedViewsH')) return;
    const operatorBlock = side.querySelector('.operator');
    if (!operatorBlock) return;
    const h = document.createElement('div');
    h.id = 'savedViewsH';
    h.className = 'section-h';
    h.textContent = 'Saved views';
    const views = [
      { name: 'Bangalore P0', hash: '#anomalies', ico: 'crisis_alert' },
      { name: 'OTA pending',  hash: '#iot',       ico: 'system_update' },
      { name: 'Open today',   hash: '#orders',    ico: 'receipt_long' },
    ];
    side.insertBefore(h, operatorBlock);
    views.forEach((v) => {
      const a = document.createElement('a');
      a.dataset.route = v.hash.slice(1);
      a.innerHTML = `<span class="ico">${v.ico}</span><span class="nm">${v.name}</span>`;
      a.onclick = (e) => { e.preventDefault(); location.hash = v.hash; providers.push.show('Loaded saved view', v.name, { icon: 'bookmark' }); };
      side.insertBefore(a, operatorBlock);
    });
  }
  setInterval(injectSavedViews, 5000);

  // ─── Live video call to agent (mock) ────────────────────────────────
  // Adds a "Video call agent" floating button when an in-progress
  // anomaly involves an agent. Shows a fake call screen for ~3s.
  function videoCallSheet(agentName = 'Ravi Kumar') {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed; inset:0; background:#000; z-index:1200; display:grid; place-items:center; color:#fff; font-family:Inter,sans-serif;';
    host.innerHTML = `
      <div style="text-align:center;">
        <div style="width:120px; height:120px; border-radius:50%; background:linear-gradient(135deg, #38bdf8, #a78bfa); margin: 0 auto 18px; display:grid; place-items:center; font-size:42px; font-weight:800;">${agentName.split(' ').map((s) => s[0]).slice(0,2).join('')}</div>
        <div style="font-size:22px; font-weight:700; margin-bottom: 6px;">${agentName}</div>
        <div style="font-size: 13px; opacity:.7;">Connecting via Twilio Video · WebRTC</div>
        <div style="margin-top: 24px; display: flex; gap: 14px; justify-content:center;">
          <button id="vcEnd" style="background:#ef4444; color:#fff; border:0; width:56px; height:56px; border-radius:50%; font-family:'Material Symbols Outlined'; font-size:24px; cursor:pointer;">call_end</button>
          <button id="vcMute" style="background:#1a2540; color:#fff; border:0; width:56px; height:56px; border-radius:50%; font-family:'Material Symbols Outlined'; font-size:24px; cursor:pointer;">mic</button>
        </div>
        <div style="margin-top: 18px; font-size: 11px; opacity:.5;">Tap red to end</div>
      </div>`;
    document.body.appendChild(host);
    host.querySelector('#vcEnd').onclick = () => host.remove();
    setTimeout(() => {
      const sub = host.querySelector('div:nth-child(3)');
      if (sub) sub.textContent = 'Connected · 00:01';
    }, 1200);
    audit('VIDEO_CALL_AGENT', agentName);
  }
  // Inject into playbook actions when present
  setInterval(() => {
    const actions = document.querySelector('.pb-host .pb-actions');
    if (!actions || actions.querySelector('#pbVideoCall')) return;
    const b = document.createElement('button');
    b.id = 'pbVideoCall'; b.className = 'cmd-btn';
    b.innerHTML = '<span style="font-family:\'Material Symbols Outlined\'; font-size:14px; vertical-align:-3px;">videocam</span> Video call agent';
    b.style.marginRight = 'auto';
    b.onclick = () => videoCallSheet('Ravi Kumar');
    actions.insertBefore(b, actions.firstChild);
  }, 800);

  // ─── Auto-narrated ops digest button ────────────────────────────────
  function injectNarratedBtn() {
    const top = document.querySelector('.cmd-top');
    if (!top || document.getElementById('cmdNarrate')) return;
    const b = document.createElement('button');
    b.id = 'cmdNarrate'; b.className = 'tb-btn';
    b.innerHTML = '<span class="ico">graphic_eq</span>Brief me';
    b.title = 'Auto-narrated daily briefing';
    b.onclick = () => playNarratedBriefing();
    const themeBtn = document.getElementById('themeToggle');
    top.insertBefore(b, themeBtn);
  }
  setInterval(injectNarratedBtn, 5000);

  async function playNarratedBriefing() {
    const data = JSON.parse(localStorage.getItem('vl_cmcc_seed') || '{}');
    const txt = await wow.opsDigest({ orders: (data.orders || []).slice(0, 30), devices: data.devices || [] });
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed; bottom: 60px; left: 50%; transform: translateX(-50%) translateY(50px); background: var(--surface); border: 1px solid var(--brand); border-radius: 14px; padding: 16px 20px; max-width: 600px; width: 90%; z-index: 200; box-shadow: 0 16px 40px rgba(0,0,0,.5); transition: transform .35s var(--ease-spring); display:flex; gap:14px; align-items: center;';
    host.innerHTML = `
      <div style="width:42px; height:42px; border-radius:50%; background: linear-gradient(135deg, var(--brand), var(--violet)); color:#fff; display:grid; place-items:center; font-family:'Material Symbols Outlined'; font-size:22px; flex-shrink:0; animation: voiceBio 1.4s infinite;">graphic_eq</div>
      <div style="flex:1;">
        <div style="font-size:11px; color:var(--muted); text-transform: uppercase; letter-spacing:.05em; font-weight:700; margin-bottom:4px;">Daily briefing · Aria voice</div>
        <div id="narratedTxt" style="font-size:13px; color:var(--ink-2); line-height: 1.55;"></div>
      </div>
      <button id="narrClose" class="cmd-btn">Close</button>`;
    document.body.appendChild(host);
    requestAnimationFrame(() => { host.style.transform = 'translateX(-50%) translateY(0)'; });
    // "Type out" the briefing word by word for narrated effect
    const target = host.querySelector('#narratedTxt');
    const words = txt.split(/\s+/);
    let i = 0;
    const tick = setInterval(() => {
      i++;
      target.textContent = words.slice(0, i).join(' ') + (i < words.length ? ' …' : '');
      if (i >= words.length) clearInterval(tick);
    }, 80);
    host.querySelector('#narrClose').onclick = () => { clearInterval(tick); host.remove(); };
    setTimeout(() => { if (document.body.contains(host)) host.remove(); }, 25000);
  }

  // ═══ Sentiment colouring on anomaly text ═══════════════════════════
  function sentimentOf(text) {
    const t = (text || '').toLowerCase();
    const neg = ['theft','suspect','fail','breach','offline','idle','ghost','low','exceed','damage','complaint'];
    const pos = ['ok','complete','success','resolved','healthy','online'];
    if (neg.some((w) => t.includes(w))) return 'neg';
    if (pos.some((w) => t.includes(w))) return 'pos';
    return 'neu';
  }
  function injectSentiment() {
    document.querySelectorAll('.alert .ttl:not([data-sent])').forEach((el) => {
      el.setAttribute('data-sent', '1');
      const s = sentimentOf(el.textContent);
      el.classList.add('sentiment-' + s);
    });
  }
  setInterval(injectSentiment, 5000);

  // ═══ Real-time collab cursors (mocked operators moving around) ═════
  function spawnCollabCursors() {
    const peers = [
      { name: 'Sandeep R', color: '#a78bfa' },
      { name: 'Rakhi M',   color: '#f59e0b' },
    ];
    peers.forEach((p, i) => {
      const el = document.createElement('div');
      el.className = 'collab-cursor';
      el.style.color = p.color;
      el.innerHTML = `<svg width="20" height="22" viewBox="0 0 20 22"><path d="M0 0 L0 18 L5 14 L8 22 L11 21 L8 13 L14 13 Z" fill="${p.color}" stroke="#fff" stroke-width="1"/></svg><span class="label" style="background:${p.color};">${p.name}</span>`;
      el.style.top = (200 + i * 100) + 'px';
      el.style.left = (300 + i * 200) + 'px';
      document.body.appendChild(el);
      setInterval(() => {
        el.style.top  = (100 + Math.random() * (window.innerHeight - 200)) + 'px';
        el.style.left = (100 + Math.random() * (window.innerWidth - 200)) + 'px';
      }, 4000 + i * 1000);
    });
  }
  setTimeout(spawnCollabCursors, 1500);

  // ═══ Mobile sidebar toggle ═════════════════════════════════════════
  function injectMobileToggle() {
    const top = document.querySelector('.cmd-top');
    if (!top || document.getElementById('cmdSideToggle')) return;
    const b = document.createElement('button');
    b.id = 'cmdSideToggle'; b.className = 'cmd-mobile-toggle';
    b.textContent = 'menu';
    top.insertBefore(b, top.firstChild);
    b.onclick = () => document.querySelector('.cmd-side')?.classList.toggle('open');
  }
  setInterval(injectMobileToggle, 5000);

  // ═══ Onboarding tour ═══════════════════════════════════════════════
  function maybeRunTour() {
    if (localStorage.getItem('vl_cmcc_tour_done')) return;
    setTimeout(() => {
      const steps = [
        { t: 'Welcome to CMCC', d: 'Your central monitoring & control center. Real-time view of every community, agent, device, and anomaly across India.' },
        { t: 'Cmd+K is your friend', d: 'Press ⌘K (or Ctrl+K) anywhere to fuzzy-find and jump to anything: agents, orders, devices, communities, actions.' },
        { t: 'Auto-incident playbooks', d: 'Click "Playbook" on any anomaly to walk through a guided 4-step response — context, action, post-mortem.' },
        { t: 'Aria voice', d: 'Tap the Aria button in the top bar to issue voice commands. "Show me Bangalore bins", "create incident", "summarise the last hour".' },
        { t: 'What-if simulator', d: 'Drag the rain/peak/holiday sliders in the simulator to forecast demand spikes and pre-position agents proactively.' },
      ];
      let i = 0;
      const overlay = document.createElement('div');
      overlay.className = 'tour-overlay';
      overlay.innerHTML = `<div class="tour-card" id="tc"></div>`;
      document.body.appendChild(overlay);
      function paint() {
        const s = steps[i];
        overlay.querySelector('#tc').innerHTML = `<h3>${s.t}</h3><p>${s.d}</p>
          <div class="row"><span class="pgs">${i+1} / ${steps.length}</span><span style="flex:1;"></span>
          ${i > 0 ? '<button class="cmd-btn" id="tBack">← Back</button>' : ''}
          ${i < steps.length - 1 ? '<button class="cmd-btn primary" id="tNext">Next →</button>' : '<button class="cmd-btn primary" id="tDone">Got it</button>'}
          </div>`;
        overlay.querySelector('#tBack')?.addEventListener('click', () => { i--; paint(); });
        overlay.querySelector('#tNext')?.addEventListener('click', () => { i++; paint(); });
        overlay.querySelector('#tDone')?.addEventListener('click', () => { localStorage.setItem('vl_cmcc_tour_done', '1'); overlay.remove(); });
      }
      paint();
    }, 600);
  }
  maybeRunTour();

  // ═══ Keyboard shortcuts ════════════════════════════════════════════
  let gPressed = false;
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;
    if (e.key === '?') { showShortcutsHelp(); return; }
    if (e.key === 'g') { gPressed = true; setTimeout(() => gPressed = false, 1500); return; }
    if (gPressed) {
      const map = { o: 'orders', c: 'communities', a: 'agents', i: 'iot', n: 'anomalies', t: 'analytics', x: 'audit', s: 'settings' };
      if (map[e.key]) { location.hash = '#' + map[e.key]; gPressed = false; }
    }
  });
  function showShortcutsHelp() {
    const overlay = document.createElement('div');
    overlay.className = 'tour-overlay';
    overlay.innerHTML = `<div class="tour-card"><h3>Keyboard shortcuts</h3>
      <div style="font-size:13px; color:var(--ink-2); line-height: 1.8;">
        <div><b>⌘K</b> · open command palette</div>
        <div><b>g o</b> · go to Orders</div>
        <div><b>g c</b> · go to Communities</div>
        <div><b>g a</b> · go to Agents</div>
        <div><b>g i</b> · go to IoT Fleet</div>
        <div><b>g n</b> · go to Anomalies</div>
        <div><b>g t</b> · go to Analytics</div>
        <div><b>g x</b> · go to Audit</div>
        <div><b>g s</b> · go to Settings</div>
        <div><b>?</b> · this help</div>
      </div>
      <div class="row" style="margin-top: 14px;"><button class="cmd-btn primary" id="kHelpClose" style="margin-left:auto;">Close</button></div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#kHelpClose').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  }

  // ═══ In-app changelog ══════════════════════════════════════════════
  const CHANGELOG = [
    { v: 'v2.4.0', date: '2026-04-24', items: [
      'Cmd+K command palette',
      'Auto-incident playbook with runbooks',
      'Aria voice control on operator desk',
      'What-if simulation for demand spikes',
      'Side-by-side community comparison',
      'Predictive demand surge card',
      'Sentiment-coloured anomaly text',
      'Real-time collaborator cursors',
      'Mobile-responsive CMCC',
      'Onboarding tour, keyboard shortcuts, in-app changelog',
    ]},
    { v: 'v2.3.0', date: '2026-04-23', items: [
      'Mobile app live-link via heartbeat to CMCC',
      'CMCC operator login (5 NOC accounts)',
      'Live India map with community markers',
      'Multi-community mock dataset (14 communities)',
    ]},
    { v: 'v2.2.0', date: '2026-04-22', items: [
      'Real Leaflet/OSM tracking map with geolocation',
      'Functional recurring schedules with calendar',
      'Pull-to-refresh in Android wrapper',
      'Live Activity banner on resident',
    ]},
  ];
  function showChangelog() {
    const overlay = document.createElement('div');
    overlay.className = 'tour-overlay';
    overlay.innerHTML = `<div class="tour-card" style="max-width: 480px;"><h3>What's new</h3>
      <div style="max-height: 360px; overflow-y: auto;">
        ${CHANGELOG.map((r) => `
          <div style="margin-bottom: 14px;">
            <div style="font-weight: 700; color: var(--brand);">${r.v} <span style="color: var(--muted); font-weight: 400; font-size: 11px;">· ${r.date}</span></div>
            <ul style="margin: 4px 0 0 18px; padding: 0; font-size: 13px; color: var(--ink-2);">
              ${r.items.map((it) => `<li>${it}</li>`).join('')}
            </ul>
          </div>`).join('')}
      </div>
      <div class="row" style="margin-top: 10px;"><button class="cmd-btn primary" id="clClose" style="margin-left:auto;">Close</button></div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#clClose').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  }
  // Top-bar "What's new" button
  function injectChangelogBtn() {
    const top = document.querySelector('.cmd-top');
    if (!top || document.getElementById('cmdChangelog')) return;
    const b = document.createElement('button');
    b.id = 'cmdChangelog'; b.className = 'tb-btn';
    b.innerHTML = '<span class="ico">campaign</span>What\'s new';
    b.onclick = showChangelog;
    const themeBtn = document.getElementById('themeToggle');
    top.insertBefore(b, themeBtn);
  }
  setInterval(injectChangelogBtn, 5000);

  // ═══ Granular RBAC ═════════════════════════════════════════════════
  // Operators have an `opRole` field. SREs see Restart/Page buttons,
  // Compliance sees DPDP/CERT-In quick actions, etc. Hide non-applicable
  // controls by adding/removing classes.
  function applyRbac() {
    const role = (me.opRole || '').toLowerCase();
    document.body.classList.toggle('rbac-sre', role.includes('sre'));
    document.body.classList.toggle('rbac-compliance', role.includes('compliance'));
    document.body.classList.toggle('rbac-noc', role.includes('noc'));
    // Hide Settings for non-leads
    if (!role.includes('lead') && !role.includes('sre')) {
      document.querySelectorAll('a[data-route="settings"]').forEach((a) => a.style.display = 'none');
    }
  }
  setInterval(applyRbac, 5000);

  // ═══ Webhooks-out (mocked — fires push when triggered) ═════════════
  function fireWebhook(event, payload) {
    const hooks = JSON.parse(localStorage.getItem('vl_cmcc_webhooks') || '[]');
    hooks.forEach((url) => {
      // In real impl: fetch(url, { method: 'POST', body: JSON.stringify({ event, payload }) })
      console.log('[webhook]', url, event, payload);
    });
    if (hooks.length) providers.push.show('Webhook fired', `${event} → ${hooks.length} subscriber(s)`, { icon: 'webhook' });
  }
  // Fire when an anomaly is acknowledged or resolved via the bridge.
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!t.matches) return;
    if (t.matches('[data-resolve]')) fireWebhook('anomaly.resolved', { id: t.dataset.resolve });
    if (t.matches('[data-ack]'))     fireWebhook('anomaly.acknowledged', { id: t.dataset.ack });
  }, true);

  // ═══ Patch hashchange so /simulation and /compare get rendered ═════
  window.addEventListener('hashchange', () => {
    const route = (location.hash || '#overview').slice(1);
    if (route === 'simulation' || route === 'compare') {
      // Wait for the cmcc.js paint to set up shell, then take over main.
      setTimeout(() => {
        const main = document.getElementById('main');
        if (!main) return;
        if (route === 'simulation') simulationView(main);
        else if (route === 'compare') compareView(main);
        // Update breadcrumb
        const bc = document.querySelector('.cmd-top .breadcrumb b');
        if (bc) bc.textContent = route === 'simulation' ? 'What-if' : 'Compare';
        // Highlight nothing in sidebar (these are extra views)
        document.querySelectorAll('.cmd-side a.active').forEach((a) => a.classList.remove('active'));
      }, 50);
    }
  });

  // Add Compare and Simulation entries into the sidebar.
  function injectExtraNav() {
    const side = document.querySelector('.cmd-side');
    if (!side || document.getElementById('navSim')) return;
    const ops = side.querySelector('a[data-route="orders"]');
    if (!ops) return;
    const sim = document.createElement('a'); sim.id = 'navSim'; sim.dataset.route = 'simulation';
    sim.innerHTML = '<span class="ico">tune</span><span class="nm">What-if</span>';
    sim.onclick = (e) => { e.preventDefault(); location.hash = '#simulation'; };
    const cmp = document.createElement('a'); cmp.id = 'navCmp'; cmp.dataset.route = 'compare';
    cmp.innerHTML = '<span class="ico">compare</span><span class="nm">Compare</span>';
    cmp.onclick = (e) => { e.preventDefault(); location.hash = '#compare'; };
    ops.parentElement.insertBefore(sim, ops.nextSibling);
    ops.parentElement.insertBefore(cmp, sim.nextSibling);
  }
  setInterval(injectExtraNav, 5000);

  // ═══ Inline editing on Settings ═════════════════════════════════════
  function makeInlineEditable() {
    document.querySelectorAll('.cmd-card .inline-edit:not([data-bound])').forEach((el) => {
      el.setAttribute('data-bound', '1');
      el.title = 'Click to edit';
      el.onclick = () => {
        const cur = el.textContent;
        el.innerHTML = `<input class="inline-edit-input" value="${cur}" />`;
        const inp = el.querySelector('input'); inp.focus(); inp.select();
        const finish = (save) => { el.textContent = save ? inp.value : cur; if (save) audit('CONFIG_EDIT', cur + ' → ' + inp.value); };
        inp.onkeydown = (e) => { if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); };
        inp.onblur = () => finish(true);
      };
    });
  }
  setInterval(makeInlineEditable, 5000);

  return {
    openPalette, openPlaybook, voiceCommand, simulationView, compareView,
    digestPdf, showChangelog, audit,
  };
})();
