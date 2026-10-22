const P = {
  vTab: 'students',
  vStatus: 'pending',
  mTab: 'active',
  list: [],
  students: [],
  orgs: [],

  async decideStudent(id, decision) {
    const u = P.students.find((x) => x.id === id);
    const who = u ? `<b>${esc(u.name)}</b> · ${esc(u.email)}` : '';
    const cfg = {
      approve: { title: 'Approve student account', intro: who + '<br>The account will be verified and the student can register for events. Once approved, the student can no longer edit their profile.', okLabel: 'Approve', required: false },
      hold: { title: 'Put account on hold', intro: who, okLabel: 'Put on hold', required: true, placeholder: 'Tell the student what information SAO still needs.' },
      reject: { title: 'Disapprove student account', intro: who, okLabel: 'Disapprove', required: true, danger: true, placeholder: 'Explain why the account was disapproved.' }
    }[decision];
    const note = await decisionBox({ ...cfg, label: 'Message to the student' });
    if (note === null) return;
    const r = await run(null, () => api('/api/verify/students/' + id, { method: 'POST', body: { decision, note } }), (x) => x.message);
    if (r) refresh();
  },

  async decideOrg(id, decision) {
    const o = P.orgs.find((x) => x.id === id);
    const who = o ? `<b>${esc(o.name)}</b>` : '';
    const cfg = {
      accredit: { title: 'Accredit organization', intro: who + '<br>Officers will be able to create events.', okLabel: 'Accredit', required: false },
      pending: { title: 'Mark organization as pending', intro: who, okLabel: 'Mark pending', required: true, placeholder: 'Tell the officers what is still needed.' },
      not_accredited: { title: 'Do not accredit organization', intro: who, okLabel: 'Not accredited', required: true, danger: true, placeholder: 'Explain why the organization was not accredited.' }
    }[decision];
    const note = await decisionBox({ ...cfg, label: 'Message to the organization' });
    if (note === null) return;
    const r = await run(null, () => api('/api/verify/orgs/' + id, { method: 'POST', body: { decision, note } }), 'Organization updated');
    if (r) refresh();
  },

  async verify(el) {
    const [students, orgs] = await Promise.all([api('/api/verify/students'), api('/api/verify/orgs')]);
    P.students = students;
    P.orgs = orgs;
    const sMatch = (u) => P.vStatus === 'all' || (P.vStatus === 'pending' ? u.status === 'pending' : P.vStatus === 'approved' ? u.status === 'active' : u.status === P.vStatus);
    const oMatch = (o) => P.vStatus === 'all' || (P.vStatus === 'approved' ? o.status === 'accredited' : o.status === (P.vStatus === 'rejected' ? 'not_accredited' : P.vStatus));
    const opts = [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']];
    const sRows = students.filter(sMatch);
    const oRows = orgs.filter(oMatch);
    const pendS = students.filter((u) => u.status === 'pending').length;
    const pendO = orgs.filter((o) => o.status === 'pending').length;
    const body = P.vTab === 'students'
      ? (sRows.length ? tableHtml(['Student', 'ID number', 'Department / Course', 'Registered', 'Status', 'Decision'], sRows.map((u) => `<tr>
          <td><b>${esc(u.name)}</b><small>${esc(u.email)}</small></td><td>${esc(u.student_id || '—')}</td><td>${esc(u.department)} · ${esc(u.course)}${u.year ? '<small>Year ' + esc(u.year) + '</small>' : ''}</td>
          <td>${esc(fmtD(u.created_at))}</td><td>${chip(u.status, label(u.status))}</td>
          <td><div class="btns"><button class="btn sm" onclick="P.decideStudent('${esc(u.id)}','approve')">Approve</button><button class="btn sm ghost" onclick="P.decideStudent('${esc(u.id)}','hold')">Hold</button><button class="btn sm danger" onclick="P.decideStudent('${esc(u.id)}','reject')">Disapprove</button><button class="btn sm ghost" data-msg="user" data-id="${esc(u.id)}" data-name="${esc(u.name)}">Message</button></div></td></tr>`)) : '<div class="empty">No student accounts in this list</div>')
      : (oRows.length ? tableHtml(['Organization', 'Officers', 'Registered', 'Status', 'Decision'], oRows.map((o) => `<tr>
          <td><b>${esc(o.name)}</b>${o.suspended ? '<small>Suspended</small>' : ''}${o.accreditation_expired ? '<small class="acc-exp">Accreditation expired. Check and approve again.</small>' : o.accredited_until ? '<small>Valid until ' + esc(fmtD(o.accredited_until)) + '</small>' : ''}</td><td>${o.officers.map((x) => esc(x.name) + '<small>' + esc(x.email) + '</small>').join('') || '—'}</td>
          <td>${esc(fmtD(o.created_at))}</td><td>${chip(o.status, label(o.status))}</td>
          <td><div class="btns"><button class="btn sm" onclick="P.decideOrg('${esc(o.id)}','accredit')">Accredit</button><button class="btn sm ghost" onclick="P.decideOrg('${esc(o.id)}','pending')">Pending</button><button class="btn sm danger" onclick="P.decideOrg('${esc(o.id)}','not_accredited')">Not accredited</button><button class="btn sm ghost" data-msg="org" data-id="${esc(o.id)}" data-name="${esc(o.name)}">Message</button></div></td></tr>`)) : '<div class="empty">No organizations in this list</div>');
    el.innerHTML = `<div class="card"><div class="toolbar">${tabsHtml([{ id: 'students', label: 'Student accounts', count: pendS }, { id: 'orgs', label: 'Organizations', count: pendO }], P.vTab)}
      <select class="pill" id="vs">${opts.map((o) => `<option value="${o[0]}" ${o[0] === P.vStatus ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div>${body}</div>`;
    bindTabs(el, (t) => { P.vTab = t; refresh(); });
    $('#vs', el).onchange = (e) => { P.vStatus = e.target.value; refresh(); };
  },

  async roster(id) {
    const d = await run(null, () => api('/api/events/' + id + '/registrations'));
    if (!d) return;
    const e = d.event;
    modal(e.title, `<div class="detail"><div>${icon('building', 16)}<span>${esc(e.org_name)}</span></div><div>${icon('pin', 16)}<span>${esc(e.venue)}</span></div><div>${icon('calendar', 16)}<span>${esc(fmtDT(e.starts_at))}</span></div>
      <div>${icon('users', 16)}<span>${d.stats.present} present of ${d.stats.registered} registered (${d.stats.rate}%) · ${e.seats_left} seats left</span></div></div>${attendanceTable(d.rows)}`, { wide: true });
  },

  async monitor(el) {
    P.list = await api('/api/events');
    const sets = {
      active: P.list.filter((e) => e.status === 'published' && e.phase !== 'past'),
      past: P.list.filter((e) => e.status === 'published' && e.phase === 'past')
    };
    const regs = P.list.reduce((n, e) => n + e.seats_taken, 0);
    el.innerHTML = tilesHtml([['Active events', sets.active.length], ['Past events', sets.past.length], ['Total registrations', regs], ['Organizations', new Set(P.list.map((e) => e.org_id)).size]]) +
      `<div class="card"><div class="toolbar">${tabsHtml([{ id: 'active', label: 'Active', count: sets.active.length }, { id: 'past', label: 'Past', count: sets.past.length }], P.mTab)}</div>
      <div class="list">${sets[P.mTab].length ? sets[P.mTab].map((e) => eventRow(e, `<button class="btn sm" onclick="P.roster('${esc(e.id)}')">Attendance</button>`)).join('') : '<div class="empty">No events here yet</div>'}</div></div>`;
    bindTabs(el, (t) => { P.mTab = t; refresh(); });
  }
};

mountShell({
  role: 'personnel',
  home: 'verify',
  nav: [
    { id: 'verify', label: 'Verification', icon: 'shield' },
    { id: 'subs', label: 'Fees & Wallet', icon: 'card' },
    { id: 'approvals', label: 'Event Approvals', icon: 'check' },
    { id: 'monitor', label: 'Events', icon: 'calendar' },
    { id: 'reports', label: 'Reports', icon: 'file' },
    { id: 'notifications', label: 'Notifications', icon: 'bell' },
    { id: 'profile', label: 'Profile', icon: 'user' }
  ],
  views: {
    verify: { title: 'Verification', render: P.verify },
    subs: { title: 'Fees and Wallet', render: FeesUI.view },
    approvals: { title: 'Event Approvals', render: ApprovalsUI.view },
    monitor: { title: 'Events and Attendance', render: P.monitor },
    reports: { title: 'Reports', render: ReportsUI.view },
    notifications: { title: 'Notifications', render: notificationsView },
    profile: { title: 'Profile', render: profileView }
  }
});