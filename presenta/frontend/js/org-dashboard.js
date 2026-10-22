const prep = async () => {
  try {
    Session.setUser((await api('/api/me')).user);
    P.settings = await api('/api/settings');
    P.orgs = await api('/api/public/orgs');
  } catch (e) {
    return;
  }
};

const P = {
  tab: 'active',
  settings: { paid_rate: 5, free_fee: 100 },
  orgs: [],
  q: '',
  cat: '',
  list: [],
  qrCache: {},
  roster: '',

  form(ev) {
    const v = ev || {};
    const now = Date.now();
    const start = v.starts_at ? toLocalInput(v.starts_at) : toLocalInput(new Date(now + 86400000).toISOString());
    const end = v.ends_at ? toLocalInput(v.ends_at) : toLocalInput(new Date(now + 86400000 + 7200000).toISOString());
    const me = Session.user || {};
    const deptLocked = Boolean(me.org_department);
    const aud = v.audience || { department: 'All', year: 'All', org_id: '' };
    const locked = Boolean(ev && ev.status === 'published');
    const g = v.geo || {};
    const orgChoices = P.orgs.filter((o) => !deptLocked || !o.department || o.department === me.org_department);
    const opt = (val, text, cur) => `<option value="${esc(val)}" ${String(val) === String(cur) ? 'selected' : ''}>${esc(text)}</option>`;
    const audience = `<div class="f"><label for="fAudDept">Department</label><select id="fAudDept" ${deptLocked ? 'disabled' : ''}>${deptLocked ? opt(me.org_department, me.org_department, me.org_department) : opt('All', 'All departments', aud.department) + DEPARTMENTS.map((d) => opt(d, d, aud.department)).join('')}</select></div>
      <div class="f"><label for="fAudYear">Year level</label><select id="fAudYear">${opt('All', 'All year levels', aud.year) + YEARS.map((y) => opt(y, 'Year ' + y, aud.year)).join('')}</select></div>
      <div class="f full"><label for="fAudOrg">Organization members only (optional)</label><select id="fAudOrg">${opt('', 'Open to everyone in the audience above', aud.org_id) + orgChoices.map((o) => opt(o.id, o.name + ' members', aud.org_id)).join('')}</select></div>`;
    const cats = Array.from(new Set(['Seminar', 'Workshop', 'Sports', 'Cultural', 'Meeting', 'Outreach'].concat(P.list.map((e) => e.category))));
    const m = modal(ev ? 'Edit event' : 'Create event', `<form id="evForm" class="ev-form">
      <section class="ef-sec"><h4><i>1</i>Event details</h4><div class="form-grid">
        <div class="f full"><label for="fTitle">Title</label><input id="fTitle" value="${esc(v.title || '')}" placeholder="e.g. Intramurals Opening" required></div>
        <div class="f"><label for="fCat">Category</label><input id="fCat" list="catList" value="${esc(v.category || '')}" placeholder="e.g. Seminar"><datalist id="catList">${cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></div>
        <div class="f"><label for="fVenue">Venue</label><input id="fVenue" value="${esc(v.venue || '')}" placeholder="e.g. Cebu Coliseum" required></div>
        <div class="f full"><label for="fDesc">Description</label><textarea id="fDesc" placeholder="What is this event about?">${esc(v.description || '')}</textarea></div>
      </div></section>
      <section class="ef-sec"><h4><i>2</i>Schedule and capacity</h4><div class="form-grid">
        <div class="f"><label for="fStart">Starts</label><input id="fStart" type="datetime-local" value="${start}" required></div>
        <div class="f"><label for="fEnd">Ends</label><input id="fEnd" type="datetime-local" value="${end}" required></div>
        <div class="f"><label for="fSeats">Seat limit</label><input id="fSeats" type="number" min="1" value="${esc(v.seat_limit || 50)}" required></div>
        <div class="f"><label for="fPrice">Ticket price (₱)</label><input id="fPrice" type="number" min="1" step="0.01" value="${esc(v.ticket_price || '')}" ${v.is_paid ? '' : 'disabled'} ${locked ? 'readonly' : ''}></div>
        <label class="ef-check full"><input type="checkbox" id="fPaid" ${v.is_paid ? 'checked' : ''} ${locked ? 'disabled' : ''}><span>This is a paid event <small>(organizers collect fees themselves, outside Presenta)</small></span></label>
        <div class="f full"><div class="ef-note" id="fFee"></div></div>
      </div></section>
      <section class="ef-sec"><h4><i>3</i>Attendance location</h4><div class="form-grid">
        <div class="f"><label for="fRadius">Check-in radius (meters)</label><input id="fRadius" type="number" min="5" max="1000" step="1" value="${esc(v.radius_m || 50)}" required></div>
        <div class="f ef-geo-btn"><button type="button" class="btn ghost" id="fGeo">${icon('pin', 16)}<span>Use my current location</span></button></div>
        <div class="f full"><div class="ef-note" id="fGeoNote"></div></div>
        <input type="hidden" id="fLat" value="${esc(g.lat)}"><input type="hidden" id="fLng" value="${esc(g.lng)}">
      </div></section>
      <section class="ef-sec"><h4><i>4</i>Audience</h4><div class="form-grid">${audience}</div></section>
      ${ev ? '' : '<label class="ef-check ef-pay"><input type="checkbox" id="fPub" checked><span>Continue to payment after saving</span></label>'}
      <div class="modal-actions"><button type="button" class="btn ghost" id="fCancel">Cancel</button><button class="btn" type="submit">${ev ? 'Save changes' : 'Save event'}</button></div>
    </form>`, { wide: true });
    const fee = () => {
      const paid = $('#fPaid', m.el).checked;
      $('#fPrice', m.el).disabled = !paid || locked;
      const st = P.settings;
      const seats = Number($('#fSeats', m.el).value) || 0;
      const price = Number($('#fPrice', m.el).value) || 0;
      $('#fFee', m.el).textContent = paid
        ? 'Platform fee: ' + st.paid_rate + '% of ₱' + price + ' × ' + seats + ' seats = ₱' + (Math.round(price * seats * st.paid_rate) / 100).toFixed(2) + '. Paid to the SAO wallet before approval.'
        : 'Platform fee for a free event: ₱' + st.free_fee + ' per event. Paid to the SAO wallet before approval.';
    };
    const geoNote = () => {
      const la = $('#fLat', m.el).value;
      const ln = $('#fLng', m.el).value;
      const r = $('#fRadius', m.el).value || 50;
      $('#fGeoNote', m.el).textContent = la && ln
        ? 'Venue point saved at ' + Number(la).toFixed(5) + ', ' + Number(ln).toFixed(5) + '. Students can check in within ' + r + ' m of this point.'
        : 'No venue point yet. Stand at the venue and tap "Use my current location". The QR code stays hidden until this is set.';
    };
    $('#fGeo', m.el).onclick = () => {
      const b = $('#fGeo', m.el);
      if (!navigator.geolocation) return toast('This browser cannot read your location', 'err');
      b.disabled = true;
      navigator.geolocation.getCurrentPosition((p) => {
        $('#fLat', m.el).value = p.coords.latitude.toFixed(6);
        $('#fLng', m.el).value = p.coords.longitude.toFixed(6);
        b.disabled = false;
        geoNote();
        toast('Venue point saved', 'ok');
      }, () => {
        b.disabled = false;
        toast('Allow location access to set the venue point', 'err');
      }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    };
    $('#fRadius', m.el).oninput = geoNote;
    ['fPaid', 'fPrice', 'fSeats'].forEach((id) => { $('#' + id, m.el).oninput = fee; $('#' + id, m.el).onchange = fee; });
    fee();
    geoNote();
    $('#fCancel', m.el).onclick = m.close;
    $('#evForm', m.el).onsubmit = async (e) => {
      e.preventDefault();
      const paid = $('#fPaid', m.el).checked;
      const body = {
        title: $('#fTitle', m.el).value, category: $('#fCat', m.el).value, venue: $('#fVenue', m.el).value,
        starts_at: new Date($('#fStart', m.el).value).toISOString(), ends_at: new Date($('#fEnd', m.el).value).toISOString(),
        seat_limit: $('#fSeats', m.el).value, is_paid: paid, ticket_price: paid ? $('#fPrice', m.el).value : 0,
        aud_department: $('#fAudDept', m.el).value, aud_year: $('#fAudYear', m.el).value, aud_org: $('#fAudOrg', m.el).value,
        description: $('#fDesc', m.el).value,
        radius_m: $('#fRadius', m.el).value, geo_lat: $('#fLat', m.el).value, geo_lng: $('#fLng', m.el).value
      };
      const goPay = !ev && $('#fPub', m.el).checked;
      const r = await run($('button[type=submit]', m.el), () => api(ev ? '/api/events/' + ev.id : '/api/events', { method: ev ? 'PUT' : 'POST', body }), ev ? 'Event updated' : 'Event saved');
      if (r) {
        m.close();
        refresh();
        if (goPay) P.pay(r.id);
      }
    };
  },

  async pay(id) {
    const [d, st] = await Promise.all([run(null, () => api('/api/events/' + id + '/registrations')), api('/api/settings')]);
    if (!d) return;
    const e = d.event;
    const detail = `<div class="detail"><div>${icon('calendar', 16)}<span><b>${esc(e.title)}</b></span></div>
      <div>${icon('card', 16)}<span>${e.is_paid ? 'Paid event · ' + esc(st.paid_rate) + '% of ₱' + esc(e.ticket_price) + ' × ' + esc(e.seat_limit) + ' seats' : 'Free event · flat fee per event'}</span></div></div>
      <div style="font-size:26px;font-weight:700;margin:12px 0">₱${esc(e.fee_due)}</div>`;
    if (!st.wallet_qr) {
      modal('Pay event fee', detail + '<p class="hint">SAO has not set up the payment wallet yet. Please try again later.</p>');
      return;
    }
    const m = modal('Pay event fee', `${detail}
      <div style="text-align:center"><img src="${esc(st.wallet_qr)}" alt="Wallet QR" style="max-width:220px;width:100%;border-radius:12px;border:1px solid var(--line)"><div style="font-size:13px;margin-top:8px"><b>${esc(st.wallet_name)}</b> ${esc(st.wallet_number)}</div></div>
      <p class="hint">Scan the QR with your wallet app and pay the exact amount. Then enter the reference number from your receipt. SAO will approve or disapprove the event after checking the payment.</p>
      <form id="payForm"><div class="form-grid"><div class="f"><label>Payment reference number</label><input id="pRef" required minlength="4"></div><div class="f"><label>Sender name (optional)</label><input id="pPayer"></div></div>
      <div class="modal-actions"><button type="button" class="btn ghost" id="pCancel">Later</button><button class="btn" type="submit">I have paid, submit for approval</button></div></form>`);
    $('#pCancel', m.el).onclick = m.close;
    $('#payForm', m.el).onsubmit = async (ev) => {
      ev.preventDefault();
      const r = await run($('button[type=submit]', m.el), () => api('/api/events/' + id + '/submit', { method: 'POST', body: { reference: $('#pRef', m.el).value, payer: $('#pPayer', m.el).value } }), 'Event submitted for SAO approval');
      if (r) { m.close(); refresh(); }
    };
  },

  async create() {
    await prep();
    if (!P.list.length) P.list = await api('/api/events').catch(() => []);
    P.form();
  },

  async edit(id) {
    await prep();
    const e = P.list.find((x) => x.id === id) || (await api('/api/events/' + id + '/registrations')).event;
    P.form(e);
  },

  submit(id) {
    return P.pay(id);
  },

  async toggleReg(id, open) {
    const r = await run(null, () => api('/api/events/' + id + '/registration', { method: 'POST', body: { open } }), open ? 'Registration opened' : 'Registration closed');
    if (r) refresh();
  },

  async remove(id) {
    if (!(await confirmBox('Delete event', 'Delete this event? This cannot be undone.', 'Delete', true))) return;
    const r = await run(null, () => api('/api/events/' + id, { method: 'DELETE' }), 'Event deleted');
    if (r) { location.hash = '#events'; refresh(); }
  },

  async report(id) {
    const r = await run(null, () => api('/api/events/' + id + '/report', { method: 'POST' }), 'Attendance report saved');
    if (r) ReportsUI.open(r.report.id);
  },

  async exportPdf(id) {
    const r = await run(null, () => api('/api/events/' + id + '/report', { method: 'POST' }));
    if (r) ReportsUI.pdf(r.report.id);
  },

  acts(e) {
    const id = esc(e.id);
    let h = `<a class="btn sm" href="#event/${id}">Manage</a>`;
    if (e.status === 'draft' || e.status === 'rejected') h += `<button class="btn sm ghost" onclick="P.submit('${id}')">Pay and submit</button>`;
    if (e.status === 'rejected' && e.approval_note) h += `<small style="max-width:200px">Reason: ${esc(e.approval_note)}</small>`;
    h += `<button class="btn sm ghost" onclick="P.edit('${id}')">Edit</button>`;
    if (e.status === 'draft' || !e.seats_taken) h += `<button class="btn sm danger" onclick="P.remove('${id}')">Delete</button>`;
    return h;
  },

  async events(el) {
    P.list = await api('/api/events');
    const sets = {
      active: P.list.filter((e) => e.status === 'published' && e.phase !== 'past'),
      pending: P.list.filter((e) => e.status === 'pending'),
      rejected: P.list.filter((e) => e.status === 'rejected'),
      draft: P.list.filter((e) => e.status === 'draft'),
      past: P.list.filter((e) => e.status === 'published' && e.phase === 'past')
    };
    const regs = P.list.reduce((n, e) => n + e.seats_taken, 0);
    const cats = Array.from(new Set(P.list.map((e) => e.category))).sort();
    el.innerHTML = tilesHtml([['Active events', sets.active.length], ['Pending approval', sets.pending.length], ['Drafts', sets.draft.length], ['Total registrations', regs], ['Past events', sets.past.length]]) +
      `<div class="card"><div class="toolbar">${tabsHtml([{ id: 'active', label: 'Active', count: sets.active.length }, { id: 'pending', label: 'Pending', count: sets.pending.length }, { id: 'rejected', label: 'Disapproved', count: sets.rejected.length }, { id: 'draft', label: 'Draft', count: sets.draft.length }, { id: 'past', label: 'Past', count: sets.past.length }], P.tab)}
      <div class="tools"><label class="search">${icon('search', 16)}<input id="q" placeholder="Search event, venue" value="${esc(P.q)}"></label>
      <select class="pill" id="cat"><option value="">All categories</option>${cats.map((c) => `<option ${c === P.cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <button class="btn big" onclick="P.create()">+ Create event</button></div></div><div class="list" id="evList"></div></div>`;
    const fill = () => {
      const q = P.q.toLowerCase();
      const rows = sets[P.tab].filter((e) => (!P.cat || e.category === P.cat) && (!q || (e.title + ' ' + e.venue).toLowerCase().includes(q)));
      $('#evList', el).innerHTML = rows.length ? rows.map((e) => eventRow(e, P.acts(e))).join('') : '<div class="empty">No events here yet</div>';
    };
    bindTabs(el, (t) => { P.tab = t; refresh(); });
    $('#q', el).oninput = (e) => { P.q = e.target.value; fill(); };
    $('#cat', el).onchange = (e) => { P.cat = e.target.value; fill(); };
    fill();
  },

  async detail(el, id) {
    el.innerHTML = `<div id="evHead"></div><div id="evStats"></div><div class="card hidden" id="qrCard"></div><div class="card"><div class="toolbar"><h3 style="margin:0"><span class="live-dot"></span>Live attendance</h3><label class="search">${icon('search', 16)}<input id="rq" placeholder="Search student" value="${esc(P.roster)}"></label></div><div id="evTable"></div></div>`;
    let data = null;
    const paint = () => {
      const e = data.event;
      const id2 = esc(e.id);
      $('#evHead', el).innerHTML = `<div class="card"><div class="toolbar"><div><span class="chip">${esc(e.category)}</span> ${chip(e.phase, PHASE[e.phase])} ${e.status === 'published' ? chip(e.registration === 'open' ? 'ok' : 'warn', e.registration === 'open' ? 'Registration open' : 'Registration closed') : ''}
        <h3 style="margin:10px 0 6px;font-size:20px">${esc(e.title)}</h3><div style="font-size:13px;color:var(--muted)">${esc(e.venue)} · ${esc(fmtDT(e.starts_at))} – ${esc(fmtT(e.ends_at))} · ${e.geo ? 'Check-in within ' + esc(e.radius_m) + ' m' : '<span style="color:var(--bad)">Venue point not set</span>'}</div></div>
        <a class="btn ghost" href="#events">Back to events</a></div>
        <div class="page-actions">
          ${e.status === 'draft' || e.status === 'rejected' ? `<button class="btn" onclick="P.submit('${id2}')">Pay and submit</button>` : e.status === 'pending' ? '<span class="chip warn">Waiting for SAO approval</span>' : `<button class="btn" onclick="P.toggleReg('${id2}',${e.registration !== 'open'})">${e.registration === 'open' ? 'Close registration' : 'Open registration'}</button><button class="btn dark" onclick="P.showQR('${id2}')">Display QR code</button>`}
          <button class="btn ghost" onclick="P.edit('${id2}')">Edit</button><button class="btn ghost" onclick="P.report('${id2}')">Generate attendance report</button><button class="btn ghost" onclick="P.exportPdf('${id2}')">Export PDF</button></div>${e.status === 'rejected' && e.approval_note ? `<p class="hint">Disapproved by SAO. Reason: ${esc(e.approval_note)}</p>` : ''}</div>`;
      const s = data.stats;
      $('#evStats', el).innerHTML = tilesHtml([['Registered', s.registered + ' / ' + e.seat_limit], ['Seats left', e.seats_left], ['Present', s.present], ['Not yet in', s.pending], ['Attendance', s.rate + '%']]);
      const q = P.roster.toLowerCase();
      $('#evTable', el).innerHTML = attendanceTable(data.rows.filter((r) => !q || (r.name + r.student_id + r.email).toLowerCase().includes(q)));
    };
    const load = async () => { data = await api('/api/events/' + id + '/registrations'); paint(); };
    await load();
    $('#rq', el).oninput = (e) => { P.roster = e.target.value; paint(); };
    const t = setInterval(() => { load().catch(() => {}); }, 5000);
    App.cleanup = () => clearInterval(t);
  },

  async showQR(id) {
    const card = $('#qrCard');
    if (!card) return;
    if (!card.classList.contains('hidden')) { card.classList.add('hidden'); return; }
    try {
      const q = P.qrCache[id] || (P.qrCache[id] = await api('/api/events/' + id + '/qr'));
      card.innerHTML = `<h3>Event QR code</h3><div class="qr-box"><img src="${q.image}" alt="Event QR code"><div style="flex:1;min-width:220px"><p style="font-size:13px;color:var(--muted);line-height:1.6;margin-bottom:10px">Students scan this code from their dashboard to confirm attendance. Check-in opens one hour before the start time.</p><div class="code">${esc(q.code)}</div></div></div>`;
      card.classList.remove('hidden');
    } catch (e) {
      toast(e.message, 'err');
    }
  }
};

mountShell({
  role: 'organization',
  home: 'events',
  nav: [
    { id: 'events', label: 'Events', icon: 'calendar' },
    { id: 'records', label: 'Records', icon: 'archive' },
    { id: 'notifications', label: 'Notifications', icon: 'bell' },
    { id: 'profile', label: 'Profile', icon: 'user' }
  ],
  views: {
    events: { title: 'Events', render: P.events },
    event: { title: 'Event Control', nav: 'events', render: P.detail },
    records: { title: 'Records', render: ReportsUI.view },
    notifications: { title: 'Notifications', render: notificationsView },
    profile: { title: 'Profile', render: profileView }
  }
});