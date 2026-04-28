// Minimal UI helpers reused by the dashboard.
// (Sheets, prompts, OTA scheduler, complaint queue, leaderboard.)

window.ui = (() => {
  function sheet(html, opts = {}) {
    document.querySelectorAll('.sheet-overlay.modal-stack').forEach((o) => o.remove());
    const wrap = document.createElement('div');
    wrap.className = 'sheet-overlay open modal-stack';
    wrap.innerHTML = `<div class="sheet"><div class="grip"></div>${html}</div>`;
    document.body.appendChild(wrap);
    if (opts.dismissOnBackdrop !== false) {
      wrap.addEventListener('click', (e) => { if (e.target === wrap) wrap.remove(); });
    }
    return { el: wrap, close: () => wrap.remove() };
  }

  function prompt({ title, subtitle = '', label = '', placeholder = '', value = '', cta = 'OK', inputmode = 'text' } = {}) {
    return new Promise((resolve) => {
      const s = sheet(`
        <h3>${title}</h3>${subtitle ? `<div class="desc">${subtitle}</div>` : ''}
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

  function bell() {
    const u = providers.push.unread();
    return `<button class="icon-btn bell-wrap" id="bellBtn" aria-label="notifications">notifications${u ? `<span class="badge-num">${u}</span>` : ''}</button>`;
  }
  function wireBell() {
    const b = document.getElementById('bellBtn');
    if (b) b.onclick = () => inbox();
  }

  function inbox() {
    const items = providers.push.list();
    const s = sheet(`
      <h3>Notifications ${items.length ? `<span class="muted" style="font-size:13px;">(${items.length})</span>` : ''}</h3>
      <div style="display:flex; gap:8px; margin: 4px 0 10px;">
        <button class="cmd-btn" id="ibRead">Mark all read</button>
        <button class="cmd-btn" id="ibClear">Clear</button>
      </div>
      <div style="max-height: 60dvh; overflow-y: auto;">
        ${items.length ? items.map((n) => `
          <div class="inbox-item ${n.read ? '' : 'unread'}">
            <div class="ico">${n.icon || 'notifications'}</div>
            <div class="meta"><div class="t1">${n.title}</div><div class="t2">${n.body}</div></div>
            <div class="when">${Math.floor((Date.now() - n.at) / 60000)}m</div>
          </div>`).join('') : '<div class="muted" style="padding:24px 0; text-align:center;">No notifications.</div>'}
      </div>
      <div class="field"><button class="btn ghost block" id="ibClose">Close</button></div>
    `);
    s.el.querySelector('#ibRead').onclick = () => { providers.push.markAllRead(); s.close(); inbox(); };
    s.el.querySelector('#ibClear').onclick = () => { providers.push.clear(); s.close(); inbox(); };
    s.el.querySelector('#ibClose').onclick = s.close;
  }

  function scheduleOta(device) {
    const versions = [
      { v: '1.5.1', notes: 'Battery telemetry fix · LoRaWAN reconnect',  size: '124 KB' },
      { v: '1.5.0', notes: 'Edge-AI bin classification (current)',       size: '210 KB' },
      { v: '1.4.2', notes: 'Stable, security patches',                    size: '98 KB' },
    ];
    let chosen = versions[0].v, when = 'now';
    const s = sheet(`
      <h3>Schedule OTA</h3>
      <div class="desc">${device.label || device.id} · firmware update over-the-air, signed with Ed25519</div>
      <h4>Version</h4>
      <div class="fw-list">
        ${versions.map((f, i) => `<div class="item ${i===0?'on':''}" data-v="${f.v}"><div class="v">${f.v}</div><div class="n">${f.notes} &middot; ${f.size}</div></div>`).join('')}
      </div>
      <h4>When</h4>
      <div class="chips">
        ${['now','tonight 2 AM','this weekend'].map((tt,i) => `<div class="chip ${i===0?'on':''}" data-w="${tt}">${tt}</div>`).join('')}
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

  function complaintQueue(orders) {
    const open = orders.filter((o) => o.complaint && o.complaint.status !== 'RESOLVED');
    const s = sheet(`
      <h3>Complaint queue</h3>
      <div class="desc">${open.length} open · auto-escalate at SLA breach</div>
      <div style="max-height: 60dvh; overflow-y: auto;">
        ${open.length ? open.map((o) => {
          const left = new Date(o.complaint.sla_breach_at) - Date.now();
          const cls = left < 0 ? 'bad' : left < 30 * 60_000 ? 'warn' : 'ok';
          const slaTxt = left < 0 ? 'breached' : `${Math.max(0, Math.round(left/60000))}m left`;
          return `<div style="padding:12px; border-bottom: 1px solid var(--line); display:flex; gap: 12px;">
            <div style="flex:1;"><b>#${o.complaint.id.slice(-5)}</b> · ${o.complaint.category}<br/>
            <span class="muted" style="font-size:12px;">${o.complaint.description || '—'}</span></div>
            <span class="cmd-badge ${cls}">${slaTxt}</span>
          </div>`;
        }).join('') : '<div class="muted" style="padding:24px 0; text-align:center;">No open complaints.</div>'}
      </div>
      <div class="field"><button class="btn ghost block" id="cqClose">Close</button></div>
    `);
    s.el.querySelector('#cqClose').onclick = s.close;
  }

  return { sheet, prompt, bell, wireBell, inbox, scheduleOta, complaintQueue };
})();
