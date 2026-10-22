const PRIVS = [['verify_accounts', 'Verify accounts'], ['manage_subscriptions', 'Fees and wallet'], ['monitor_events', 'Monitor events'], ['view_reports', 'View reports'], ['manage_events', 'Manage events'], ['approve_events', 'Approve events']];

const P = {
  uq: '',
  urole: '',
  ustatus: '',
  rq: '',
  lq: '',

  async users(el) {
    const [all, st] = await Promise.all([api('/api/admin/users'), api('/api/settings')]);
    P.userList = all;
    const count = (f) => all.filter(f).length;
    const me = Session.user.id;
    const win = st.profile_window || {};
    const inp = (iso) => (iso ? toLocalInput(iso) : '');
    const canCredit = (u) => u.role === 'student' || u.role === 'organization';
    const actions = (u) => {
      if (u.id === me) return '<small>You</small>';
      const id = esc(u.id);
      return `${u.status === 'suspended' ? `<button class="btn sm" onclick="P.setStatus('${id}','active')">Restore</button>` : `<button class="btn sm ghost" onclick="P.setStatus('${id}','suspended')">Suspend</button>`}${canCredit(u) ? `<button class="btn sm ghost" onclick="P.credits('${id}')">Edit credits</button>` : ''}<button class="btn sm danger" onclick="P.delUser('${id}')">Delete</button>`;
    };
    el.innerHTML = tilesHtml([['Total accounts', all.length], ['Students', count((u) => u.role === 'student')], ['Officers', count((u) => u.role === 'organization')], ['Personnel and admins', count((u) => u.role === 'personnel' || u.role === 'superadmin')], ['Suspended', count((u) => u.status === 'suspended')]]) +
      `<div class="card"><div class="win-head"><h3>Student profile update period</h3><p class="hint">Students can change their information only inside this period, or when you give them edit credits.</p></div>
        <div class="form-grid"><div class="f"><label for="wStart">Opens</label><input id="wStart" type="datetime-local" value="${inp(win.start)}"></div><div class="f"><label for="wEnd">Closes</label><input id="wEnd" type="datetime-local" value="${inp(win.end)}"></div></div>
        <div class="page-actions"><button class="btn" id="wSave">Save period</button><button class="btn ghost" id="wClear">Clear period</button></div></div>` +
      `<div class="card"><div class="toolbar"><div class="tools"><label class="search">${icon('search', 16)}<input id="uq" placeholder="Search name or email" value="${esc(P.uq)}"></label>
      <select class="pill" id="ur"><option value="">All roles</option>${Object.keys(ROLE_LABEL).map((r) => `<option value="${r}" ${r === P.urole ? 'selected' : ''}>${esc(ROLE_LABEL[r])}</option>`).join('')}</select>
      <select class="pill" id="us"><option value="">All statuses</option>${['active', 'pending', 'rejected', 'suspended'].map((s) => `<option value="${s}" ${s === P.ustatus ? 'selected' : ''}>${label(s)}</option>`).join('')}</select></div>
      <button class="btn big" onclick="P.createUser()">+ Create account</button></div>
      <div id="uTable"></div></div>`;
    const saveWin = async (clear) => {
      const iso = (id) => ($(id, el).value ? new Date($(id, el).value).toISOString() : '');
      const body = clear ? { start: '', end: '' } : { start: iso('#wStart'), end: iso('#wEnd') };
      const r = await run(null, () => api('/api/admin/profile-window', { method: 'PUT', body }), (x) => x.message);
      if (r) refresh();
    };
    $('#wSave', el).onclick = () => saveWin(false);
    $('#wClear', el).onclick = () => saveWin(true);
    const fill = () => {
      const qq = P.uq.toLowerCase();
      const list = all.filter((u) => (!P.urole || u.role === P.urole) && (!P.ustatus || u.status === P.ustatus) && (!qq || (u.name + u.email + (u.org_name || '')).toLowerCase().includes(qq)));
      $('#uTable', el).innerHTML = list.length ? tableHtml(['Account', 'Role', 'Status', 'Created', ''], list.map((u) => `<tr>
        <td><b>${esc(u.name)}</b><small>${esc(u.email)}${u.org_name ? ' · ' + esc(u.org_name) : ''}</small></td>
        <td>${chip('role', ROLE_LABEL[u.role])}${canCredit(u) ? `<small>Edit credits: ${esc(u.edit_credits || 0)}</small>` : ''}</td>
        <td>${chip(u.status, label(u.status))}</td><td>${esc(fmtD(u.created_at))}</td>
        <td><div class="btns">${actions(u)}</div></td></tr>`)) : '<div class="empty">No accounts match</div>';
    };
    $('#uq', el).oninput = (e) => { P.uq = e.target.value; fill(); };
    $('#ur', el).onchange = (e) => { P.urole = e.target.value; fill(); };
    $('#us', el).onchange = (e) => { P.ustatus = e.target.value; fill(); };
    fill();
  },

  credits(id) {
    const u = P.userList.find((x) => x.id === id);
    if (!u) return;
    const m = modal('Edit credits', `<form id="crForm"><div class="ef-note" style="margin-bottom:14px"><b>${esc(u.name)}</b> currently has <b>${esc(u.edit_credits || 0)}</b> edit credit(s). Each saved change to their information uses one credit.</div>
      <div class="form-grid"><div class="f"><label for="crN">Credits</label><input id="crN" type="number" min="0" max="100" value="1" required></div>
      <div class="f"><label for="crMode">Action</label><select id="crMode"><option value="add">Add to current balance</option><option value="set">Set balance to</option></select></div></div>
      <div class="modal-actions"><button type="button" class="btn ghost" id="crCancel">Cancel</button><button class="btn" type="submit">Save credits</button></div></form>`);
    $('#crCancel', m.el).onclick = m.close;
    $('#crForm', m.el).onsubmit = async (e) => {
      e.preventDefault();
      const body = { credits: $('#crN', m.el).value, mode: $('#crMode', m.el).value };
      const r = await run($('button[type=submit]', m.el), () => api('/api/admin/users/' + id + '/credits', { method: 'POST', body }), (x) => x.message);
      if (r) { m.close(); refresh(); }
    };
  },

  createUser() {
    const m = modal('Create account', `<form id="cuForm"><div class="form-grid">
      <div class="f full"><label>Role</label><select id="cuRole">${Object.keys(ROLE_LABEL).map((r) => `<option value="${r}" ${r === 'personnel' ? 'selected' : ''}>${esc(ROLE_LABEL[r])}</option>`).join('')}</select></div>
      <div class="f"><label>Full name</label><input id="cuName" required></div><div class="f"><label>Email</label><input id="cuEmail" type="email" required></div>
      <div class="f full"><label>Temporary password</label><input id="cuPw" type="text" minlength="6" required></div>
      <div class="f full hidden" id="cuOrgBox"><label>Organization name</label><input id="cuOrg"></div>
      </div><div class="modal-actions"><button type="button" class="btn ghost" id="cuCancel">Cancel</button><button class="btn" type="submit">Create</button></div></form>`);
    const sync = () => $('#cuOrgBox', m.el).classList.toggle('hidden', $('#cuRole', m.el).value !== 'organization');
    $('#cuRole', m.el).onchange = sync;
    $('#cuCancel', m.el).onclick = m.close;
    $('#cuForm', m.el).onsubmit = async (e) => {
      e.preventDefault();
      const body = { role: $('#cuRole', m.el).value, name: $('#cuName', m.el).value, email: $('#cuEmail', m.el).value, password: $('#cuPw', m.el).value, org_name: $('#cuOrg', m.el).value };
      const r = await run($('button[type=submit]', m.el), () => api('/api/admin/users', { method: 'POST', body }), 'Account created');
      if (r) { m.close(); refresh(); }
    };
  },

  async setStatus(id, status) {
    const r = await run(null, () => api('/api/admin/users/' + id + '/status', { method: 'POST', body: { status } }), (x) => x.message);
    if (r) refresh();
  },

  async resetPw(id) {
    const password = prompt('Enter a new temporary password (min 6 characters):');
    if (!password) return;
    await run(null, () => api('/api/admin/users/' + id + '/password', { method: 'POST', body: { password } }), 'Password reset');
  },

  async delUser(id) {
    if (!(await confirmBox('Delete account', 'Delete this account permanently?', 'Delete', true))) return;
    const r = await run(null, () => api('/api/admin/users/' + id, { method: 'DELETE' }), 'Account deleted');
    if (r) refresh();
  },

  async orgs(el) {
    const all = await api('/api/admin/orgs');
    el.innerHTML = `<div class="card"><div class="toolbar"><h3 style="margin:0">Organizations</h3><label class="search">${icon('search', 16)}<input id="oq" placeholder="Search organization" value="${esc(P.rq)}"></label></div><div id="oTable"></div></div>`;
    const fill = () => {
      const q = P.rq.toLowerCase();
      const list = all.filter((o) => !q || o.name.toLowerCase().includes(q));
      $('#oTable', el).innerHTML = list.length ? tableHtml(['Organization', 'Officers', 'Accreditation', ''], list.map((o) => {
        return `<tr><td><b>${esc(o.name)}</b><small>${esc(o.department || 'University-wide')}</small>${o.suspended ? '<small>Suspended</small>' : ''}${o.accredited_until ? '<small>Valid until ' + esc(fmtD(o.accredited_until)) + '</small>' : '<small>No expiry set</small>'}${o.accreditation_expired ? '<small class="acc-exp">Expired, awaiting re-approval</small>' : ''}</td><td>${o.officers.map((x) => esc(x.name)).join(', ') || '—'}</td><td>${chip(o.status, label(o.status))}</td>
          <td><div class="btns"><button class="btn sm ghost" onclick="P.editOrg('${esc(o.id)}')">Edit</button><button class="btn sm ghost" onclick="P.suspendOrg('${esc(o.id)}',${!o.suspended})">${o.suspended ? 'Restore' : 'Suspend'}</button><button class="btn sm danger" onclick="P.delOrg('${esc(o.id)}')">Delete</button></div></td></tr>`;
      })) : '<div class="empty">No organizations yet</div>';
    };
    P.orgList = all;
    $('#oq', el).oninput = (e) => { P.rq = e.target.value; fill(); };
    fill();
  },

  editOrg(id) {
    const o = P.orgList.find((x) => x.id === id);
    const m = modal('Edit organization', `<form id="eoForm"><div class="form-grid">
      <div class="f full"><label for="eoName">Name</label><input id="eoName" value="${esc(o.name)}" required></div>
      <div class="f"><label for="eoStatus">Accreditation</label><select id="eoStatus">${['accredited', 'pending', 'not_accredited'].map((x) => `<option value="${x}" ${x === o.status ? 'selected' : ''}>${label(x)}</option>`).join('')}</select></div>
      <div class="f"><label for="eoValid">Accreditation valid until</label><input id="eoValid" type="date" value="${o.accredited_until ? toDateInput(o.accredited_until) : ''}"></div>
      <div class="f full"><div class="ef-note">When this date passes, the organization is moved to pending. Personnel must check its accreditation and approve it again before it can create events.</div></div>
      </div><div class="modal-actions"><button type="button" class="btn ghost" id="eoCancel">Cancel</button><button class="btn" type="submit">Save</button></div></form>`);
    $('#eoCancel', m.el).onclick = m.close;
    $('#eoForm', m.el).onsubmit = async (e) => {
      e.preventDefault();
      const d = $('#eoValid', m.el).value;
      const body = { name: $('#eoName', m.el).value, status: $('#eoStatus', m.el).value, accredited_until: d ? new Date(d + 'T23:59:59').toISOString() : '' };
      const r = await run($('button[type=submit]', m.el), () => api('/api/admin/orgs/' + id, { method: 'PUT', body }), 'Organization saved');
      if (r) { m.close(); refresh(); }
    };
  },

  async suspendOrg(id, suspended) {
    const r = await run(null, () => api('/api/admin/orgs/' + id, { method: 'PUT', body: { suspended } }), suspended ? 'Organization suspended' : 'Organization restored');
    if (r) refresh();
  },

  async delOrg(id) {
    if (!(await confirmBox('Delete organization', 'Delete this organization and all of its events, registrations and reports?', 'Delete', true))) return;
    const r = await run(null, () => api('/api/admin/orgs/' + id, { method: 'DELETE' }), 'Organization deleted');
    if (r) refresh();
  },

  async roles(el) {
    const all = (await api('/api/admin/users')).filter((u) => u.role !== 'student');
    el.innerHTML = `<div class="card"><h3>Roles and privileges</h3>${all.length ? tableHtml(['Account', 'Role', 'Privileges', ''], all.map((u) => {
      const own = u.id === Session.user.id;
      return `<tr><td><b>${esc(u.name)}</b><small>${esc(u.email)}</small></td>
        <td><select id="role_${esc(u.id)}" ${own ? 'disabled' : ''}>${Object.keys(ROLE_LABEL).map((r) => `<option value="${r}" ${r === u.role ? 'selected' : ''}>${esc(ROLE_LABEL[r])}</option>`).join('')}</select></td>
        <td><div class="privs">${PRIVS.map((p) => `<label><input type="checkbox" data-u="${esc(u.id)}" value="${p[0]}" ${(u.privileges || []).includes(p[0]) ? 'checked' : ''} ${u.role === 'superadmin' ? 'disabled' : ''}>${esc(p[1])}</label>`).join('')}</div></td>
        <td><button class="btn sm" onclick="P.saveRole('${esc(u.id)}','${u.role}',this)">Save</button></td></tr>`;
    })) : '<div class="empty">No staff accounts yet</div>'}</div>`;
  },

  async saveRole(id, current, btn) {
    const roleEl = $('#role_' + id);
    const role = roleEl.value;
    const privileges = $$('input[data-u="' + id + '"]:checked').map((c) => c.value);
    const body = role === current ? { privileges } : { role, privileges };
    const r = await run(btn, () => api('/api/admin/users/' + id, { method: 'PUT', body }), 'Roles and privileges saved');
    if (r && role !== current) refresh();
  },

  async logs(el) {
    const rows = await api('/api/admin/logs?limit=500' + (P.lq ? '&q=' + encodeURIComponent(P.lq) : ''));
    el.innerHTML = `<div class="card"><div class="toolbar"><h3 style="margin:0">System log</h3><div class="tools"><label class="search">${icon('search', 16)}<input id="lq" placeholder="Search actor, action, detail" value="${esc(P.lq)}"></label><button class="btn ghost" onclick="refresh()">Refresh</button></div></div>
      ${rows.length ? tableHtml(['Time', 'Actor', 'Action', 'Detail'], rows.map((l) => `<tr><td style="white-space:nowrap">${esc(fmtDT(l.at))}</td><td>${esc(l.actor_name)}<small>${esc(label(l.actor_role))}</small></td><td>${chip('role', l.action)}</td><td>${esc(l.detail)}</td></tr>`)) : '<div class="empty">No log entries</div>'}</div>`;
    let timer;
    $('#lq', el).oninput = (e) => {
      P.lq = e.target.value;
      clearTimeout(timer);
      timer = setTimeout(refresh, 400);
    };
  }
};

mountShell({
  role: 'superadmin',
  home: 'users',
  nav: [
    { id: 'users', label: 'Users', icon: 'users' },
    { id: 'orgs', label: 'Organizations', icon: 'building' },
    { id: 'approvals', label: 'Event Approvals', icon: 'check' },
    { id: 'fees', label: 'Fees & Wallet', icon: 'card' },
    { id: 'roles', label: 'Roles & Privileges', icon: 'key' },
    { id: 'logs', label: 'System Log', icon: 'list' },
    { id: 'profile', label: 'Profile', icon: 'user' }
  ],
  views: {
    users: { title: 'User Accounts', render: P.users },
    orgs: { title: 'Organizations', render: P.orgs },
    approvals: { title: 'Event Approvals', render: ApprovalsUI.view },
    fees: { title: 'Fees and Wallet', render: FeesUI.view },
    roles: { title: 'Roles and Privileges', render: P.roles },
    logs: { title: 'System Log', render: P.logs, after: (el) => { const i = $('#lq', el); if (i && P.lq) { i.focus(); i.setSelectionRange(P.lq.length, P.lq.length); } } },
    profile: { title: 'Profile', render: profileView }
  }
});