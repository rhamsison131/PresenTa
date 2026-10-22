const P = {
  tab: 'foryou',
  q: '',
  cat: '',
  mineTab: 'upcoming',
  list: [],
  scanner: null,

  act(e) {
    if (e.my_reg) {
      if (e.phase === 'upcoming') return `<span class="chip ok">Seat ${e.my_reg.seat_no}</span><button class="btn sm ghost" onclick="event.stopPropagation();P.cancel('${esc(e.id)}')">Cancel seat</button>`;
      if (e.phase === 'live') return `<span class="chip ok">Seat ${e.my_reg.seat_no}</span><a class="btn sm" href="#scan" onclick="event.stopPropagation()">Scan QR</a>`;
      return `<span class="chip ok">Seat ${e.my_reg.seat_no}</span>`;
    }
    if (e.phase === 'past') return chip('past', 'Ended');
    if (!e.eligible) return chip('warn', 'View only');
    if (e.registration !== 'open') return chip('warn', 'Registration closed');
    if (e.seats_left < 1) return chip('warn', 'Full');
    return `<button class="btn sm" onclick="event.stopPropagation();P.reserve('${esc(e.id)}')">Register</button>`;
  },

  async reserve(id) {
    const e = P.list.find((x) => x.id === id);
    const info = e ? `<b>${esc(e.title)}</b><br>${esc(e.venue)}<br>${esc(fmtDT(e.starts_at))} – ${esc(fmtT(e.ends_at))}<br>${esc(e.org_name)}<br><br>` : '';
    const ok = await confirmBox('Confirm registration', info + 'Do you want to reserve a seat for this event?', 'Yes, register');
    if (!ok) return;
    const r = await run(null, () => api('/api/events/' + id + '/register', { method: 'POST' }), (x) => x.message);
    if (r) { closeModals(); refresh(); pollNotifs(); }
  },

  async cancel(id) {
    if (!(await confirmBox('Cancel seat', 'Do you want to cancel your seat for this event?', 'Yes, cancel seat', true))) return;
    const r = await run(null, () => api('/api/events/' + id + '/register', { method: 'DELETE' }), 'Seat cancelled');
    if (r) { closeModals(); refresh(); pollNotifs(); }
  },

  openEvent(id) {
    const e = P.list.find((x) => x.id === id);
    if (!e) return;
    modal(e.title, `<div style="height:110px;border-radius:14px;background:${coverOf(e.category)};margin-bottom:14px"></div>
      <span class="chip">${esc(e.category)}</span> ${chip(e.phase, PHASE[e.phase])}
      <p style="margin:12px 0;color:#55527a;line-height:1.6;font-size:14px">${esc(e.description || 'No description provided.')}</p>
      <div class="detail"><div>${icon('building', 16)}<span>${esc(e.org_name)}</span></div><div>${icon('pin', 16)}<span>${esc(e.venue)}</span></div>
      <div>${icon('calendar', 16)}<span>${esc(fmtDT(e.starts_at))} – ${esc(fmtT(e.ends_at))}</span></div>
      <div>${icon('users', 16)}<span>${e.seats_left} of ${e.seat_limit} seats left · Open to: ${esc(e.eligibility)}</span></div></div>
      ${e.is_paid ? `<p class="hint">Ticket price: ₱${esc(e.ticket_price)}. Fees are collected by the organizers outside Presenta.</p>` : ''}
      ${e.eligible ? '' : '<p class="hint">This event is limited to its audience. You can view it but cannot register.</p>'}
      <div class="modal-actions">${P.act(e).replace(/event\.stopPropagation\(\);/g, '')}</div>`);
  },

  async foryou(el) {
    P.list = await api('/api/events');
    const live = P.list.filter((e) => e.phase !== 'past');
    const sets = {
      foryou: live.filter((e) => e.eligible),
      all: live.filter((e) => !e.eligible),
      past: P.list.filter((e) => e.phase === 'past')
    };
    const cats = Array.from(new Set(P.list.map((e) => e.category))).sort();
    el.innerHTML = `<div class="card"><div class="toolbar">
      ${tabsHtml([{ id: 'foryou', label: 'For You', count: sets.foryou.length }, { id: 'all', label: 'All events', count: sets.all.length }, { id: 'past', label: 'Past', count: sets.past.length }], P.tab)}
      <div class="tools"><label class="search">${icon('search', 16)}<input id="q" placeholder="Search event, venue, organization" value="${esc(P.q)}"></label>
      <select class="pill" id="cat"><option value="">All categories</option>${cats.map((c) => `<option ${c === P.cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div></div>
      <div class="list" id="evList"></div></div>`;
    const fill = () => {
      const q = P.q.toLowerCase();
      const rows = sets[P.tab].filter((e) => (!P.cat || e.category === P.cat) && (!q || (e.title + ' ' + e.venue + ' ' + e.org_name + ' ' + e.description).toLowerCase().includes(q)));
      $('#evList', el).innerHTML = rows.length
        ? rows.map((e) => eventRow(e, P.act(e)).replace('class="ev-row"', 'class="ev-row clickable"')).join('')
        : '<div class="empty">No events match right now</div>';
      $$('.ev-row', el).forEach((r) => { r.onclick = () => P.openEvent(r.dataset.id); });
    };
    bindTabs(el, (t) => { P.tab = t; refresh(); });
    $('#q', el).oninput = (e) => { P.q = e.target.value; fill(); };
    $('#cat', el).onchange = (e) => { P.cat = e.target.value; fill(); };
    fill();
  },

  async mine(el) {
    const regs = await api('/api/my/registrations');
    const kept = regs.filter((r) => r.status === 'reserved');
    const sets = {
      upcoming: kept.filter((r) => r.event.phase !== 'past'),
      history: kept.filter((r) => r.event.phase === 'past'),
      cancelled: regs.filter((r) => r.status === 'cancelled')
    };
    const attended = kept.filter((r) => r.attended).length;
    const pastCount = sets.history.length;
    const rate = pastCount ? Math.round((sets.history.filter((r) => r.attended).length / pastCount) * 100) : 0;
    const state = (r) => {
      if (r.status === 'cancelled') return chip('cancelled', 'Cancelled');
      if (r.left_at) return chip('absent', 'Left the venue');
      if (r.attended) return chip('present', 'Present · ' + fmtT(r.attended_at));
      if (r.event.phase === 'past') return chip('absent', 'Absent');
      return chip('pending', 'Registered');
    };
    el.innerHTML = tilesHtml([['Registered events', kept.length], ['Attended', attended], ['Upcoming', sets.upcoming.length], ['Attendance rate', rate + '%']]) +
      `<div class="card"><div class="toolbar">${tabsHtml([{ id: 'upcoming', label: 'Upcoming', count: sets.upcoming.length }, { id: 'history', label: 'History', count: sets.history.length }, { id: 'cancelled', label: 'Cancelled', count: sets.cancelled.length }], P.mineTab)}</div>
      <div class="list">${sets[P.mineTab].length ? sets[P.mineTab].map((r) => eventRow(r.event, state(r) + (r.status === 'reserved' && r.event.phase === 'upcoming' ? `<button class="btn sm ghost" onclick="P.cancel('${esc(r.event_id)}')">Cancel seat</button>` : ''))).join('') : '<div class="empty">Nothing here yet</div>'}</div></div>`;
    bindTabs(el, (t) => { P.mineTab = t; refresh(); });
  },

  here() {
    return new Promise((res, rej) => {
      if (!navigator.geolocation) return rej(new Error('This device cannot share its location'));
      navigator.geolocation.getCurrentPosition(
        (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => rej(new Error('Allow location access, then try again')),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  },

  watch(eventId, until) {
    clearInterval(P.watchTimer);
    P.watchTimer = setInterval(async () => {
      if (Date.now() > new Date(until)) return clearInterval(P.watchTimer);
      try {
        const pos = await P.here();
        const r = await api('/api/attendance/ping', { method: 'POST', body: { event_id: eventId, ...pos } });
        if (r.left) {
          clearInterval(P.watchTimer);
          toast(r.message, 'err');
          pollNotifs();
        }
      } catch (e) {}
    }, 30000);
  },

  async scan(el) {
    el.innerHTML = `<div class="split2 scan-grid">
      <div class="card scan-card"><h3>Scan event QR</h3><div id="reader"></div>
        <div class="scan-foot"><button class="btn" id="startScan">Start camera</button><button class="btn ghost hidden" id="stopScan">Stop camera</button></div></div>
      <div class="card scan-card"><h3>Enter code manually</h3><p class="scan-help">If the camera is unavailable, type the code shown under the organizer's QR.</p>
        <div class="f"><input id="manual" placeholder="PRESENTA|..."></div>
        <div class="scan-foot"><button class="btn" id="sendManual">Confirm attendance</button></div>
        <div id="scanOut"></div></div></div>`;
    const out = $('#scanOut', el);
    const submit = async (code) => {
      out.innerHTML = '<div class="scan-result">Checking your location…</div>';
      try {
        const pos = await P.here();
        const r = await api('/api/attendance/scan', { method: 'POST', body: { code, ...pos } });
        out.innerHTML = `<div class="scan-result ok"><b>${esc(r.message)}</b><br>${esc(r.event.title)} · ${esc(r.event.venue)}<br>${esc(fmtDT(r.attended_at))}<br><small>Stay within the venue for 5 minutes to keep your attendance.</small></div>`;
        toast('Attendance recorded', 'ok');
        pollNotifs();
        P.watch(r.event.id, r.monitor_until);
      } catch (e) {
        out.innerHTML = `<div class="scan-result err"><b>Rejected</b><br>${esc(e.message)}</div>`;
      }
    };
    const stop = async () => {
      if (P.scanner) {
        try { await P.scanner.stop(); } catch (e) {}
        P.scanner = null;
      }
      $('#startScan', el).classList.remove('hidden');
      $('#stopScan', el).classList.add('hidden');
    };
    App.cleanup = () => { stop(); };
    $('#startScan', el).onclick = async () => {
      if (!window.Html5Qrcode) return toast('Scanner library did not load. Use the manual code.', 'err');
      P.scanner = new Html5Qrcode('reader');
      try {
        await P.scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } }, async (text) => {
          await stop();
          submit(text);
        }, () => {});
        $('#startScan', el).classList.add('hidden');
        $('#stopScan', el).classList.remove('hidden');
      } catch (e) {
        P.scanner = null;
        toast('Camera unavailable. Use the manual code.', 'err');
      }
    };
    $('#stopScan', el).onclick = stop;
    $('#sendManual', el).onclick = () => {
      const v = $('#manual', el).value.trim();
      if (v) submit(v);
    };
  }
};

mountShell({
  role: 'student',
  home: 'foryou',
  nav: [
    { id: 'foryou', label: 'Dashboard', icon: 'grid' },
    { id: 'mine', label: 'My Events', icon: 'ticket' },
    { id: 'scan', label: 'Scan QR', icon: 'qr' },
    { id: 'notifications', label: 'Notifications', icon: 'bell' },
    { id: 'profile', label: 'Profile', icon: 'user' }
  ],
  views: {
    foryou: { title: 'Dashboard', render: P.foryou },
    mine: { title: 'My Events', render: P.mine },
    scan: { title: 'Scan QR', render: P.scan },
    notifications: { title: 'Notifications', render: notificationsView },
    profile: { title: 'Profile', render: profileView }
  }
});