const DEPARTMENTS = [
  'College of Arts and Sciences',
  'College of Computer Studies',
  'College of Criminal Justice',
  'College of Business Administration',
  'College of Customs Administration',
  'College of Engineering',
  'College of Nursing',
  'College of Social Work',
  'College of Teacher Education'
];
const YEARS = ['1', '2', '3', '4'];
const API = '';

const Session = {
  get token() { return localStorage.getItem('token'); },
  get user() {
    try { return JSON.parse(localStorage.getItem('user')); } catch (e) { return null; }
  },
  set(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },
  setUser(user) { localStorage.setItem('user', JSON.stringify(user)); },
  clear() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
};

const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  ticket: '<path d="M3 9a2 2 0 0 0 0 6v3h18v-3a2 2 0 0 1 0-6V6H3z"/><path d="M14 6v12" stroke-dasharray="2 3"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM17 20h4M20 17v3"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 21c0-3.5 3-5.5 7-5.5s7 2 7 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 15.5c2.5.5 4 2 4 5"/>',
  building: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>',
  logout: '<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
  pin: '<path d="M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v12h14V8M10 12h4"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>'
};
const icon = (name, size) => `<svg viewBox="0 0 24 24" width="${size || 18}" height="${size || 18}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;

const PALETTE = [['#6f6fd8', '#030164'], ['#4f8cf0', '#1a1990'], ['#7dd3fc', '#2f4bd0'], ['#8ab4ff', '#0b0a7a'], ['#a5b4fc', '#26249e'], ['#60a5fa', '#1e1b8f']];
const hashOf = (s) => Array.from(String(s)).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const coverOf = (cat) => {
  const p = PALETTE[hashOf(cat || 'General') % PALETTE.length];
  return `linear-gradient(135deg,${p[0]},${p[1]})`;
};

const fmtDT = (iso) => (iso ? new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');
const fmtD = (iso) => (iso ? new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
const fmtT = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—');
const toLocalInput = (iso) => {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const toDateInput = (iso) => (iso ? toLocalInput(iso).slice(0, 10) : '');
const label = (s) => String(s || '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
const PHASE = { draft: 'Draft', pending: 'Pending approval', rejected: 'Disapproved', upcoming: 'Upcoming', live: 'Live now', past: 'Ended' };
const ROLE_LABEL = { student: 'Student', organization: 'Organization Officer', personnel: 'SAO Personnel', superadmin: 'Super Admin' };

async function api(path, opt) {
  const o = opt || {};
  const headers = { 'Content-Type': 'application/json' };
  if (Session.token) headers.Authorization = 'Bearer ' + Session.token;
  let res;
  try {
    res = await fetch(API + path, { method: o.method || 'GET', headers, body: o.body ? JSON.stringify(o.body) : undefined });
  } catch (e) {
    throw new Error('Cannot reach the server');
  }
  if (o.raw) {
    if (res.status === 401) logout();
    return res;
  }
  const data = await res.json().catch(() => ({}));
  if ((res.status === 401 || data.code === 'ACCOUNT_INACTIVE') && Session.token) logout();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

async function download(path, filename) {
  const res = await api(path, { raw: true });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.message || 'Download failed');
  }
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function logout() {
  Session.clear();
  location.href = 'login.html';
}

function toast(msg, type) {
  let box = $('#toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    document.body.appendChild(box);
  }
  const t = document.createElement('div');
  t.className = 'toast ' + (type || '');
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), 3600);
}

function modal(title, html, opt) {
  const o = document.createElement('div');
  o.className = 'overlay';
  o.innerHTML = `<div class="modal ${opt && opt.wide ? 'wide' : ''}"><div class="modal-h"><h3>${esc(title)}</h3><button class="x" aria-label="Close">&times;</button></div><div class="modal-b">${html}</div></div>`;
  document.body.appendChild(o);
  const close = () => o.remove();
  $('.x', o).onclick = close;
  o.addEventListener('mousedown', (e) => { if (e.target === o) close(); });
  return { el: $('.modal-b', o), close };
}

function confirmBox(title, html, okLabel, danger) {
  return new Promise((resolve) => {
    const o = document.createElement('div');
    o.className = 'overlay';
    o.style.zIndex = 90;
    o.innerHTML = `<div class="modal"><div class="modal-h"><h3>${esc(title)}</h3><button class="x" aria-label="Close">&times;</button></div><div class="modal-b"><div style="font-size:14px;line-height:1.6;color:#55527a">${html}</div><div class="modal-actions"><button class="btn ghost" data-r="0">Cancel</button><button class="btn ${danger ? 'danger' : ''}" data-r="1">${esc(okLabel || 'Confirm')}</button></div></div></div>`;
    document.body.appendChild(o);
    const done = (v) => {
      o.remove();
      resolve(v);
    };
    $('.x', o).onclick = () => done(false);
    $$('[data-r]', o).forEach((b) => { b.onclick = () => done(b.dataset.r === '1'); });
    o.addEventListener('mousedown', (e) => { if (e.target === o) done(false); });
  });
}

function askLogout() {
  confirmBox('Sign out', 'Are you sure you want to sign out of Presenta?', 'Sign out', true).then((ok) => {
    if (ok) logout();
  });
}

const closeModals = () => $$('.overlay').forEach((o) => o.remove());

async function run(btn, fn, okMsg) {
  if (btn) btn.disabled = true;
  try {
    const r = await fn();
    if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg, 'ok');
    return r;
  } catch (e) {
    toast(e.message, 'err');
    return null;
  } finally {
    if (btn) btn.disabled = false;
  }
}

const tabsHtml = (items, active) =>
  `<div class="tabs">${items.map((t) => `<button class="tab ${t.id === active ? 'on' : ''}" data-tab="${t.id}">${esc(t.label)}${t.count !== undefined ? ` <em>${t.count}</em>` : ''}</button>`).join('')}</div>`;
const bindTabs = (el, fn) => $$('[data-tab]', el).forEach((b) => { b.onclick = () => fn(b.dataset.tab); });

const tilesHtml = (items) =>
  `<div class="tiles">${items.map((t, i) => `<div class="tile ${i === 0 ? 'accent' : ''}"><small>${esc(t[0])}</small><b>${esc(t[1])}</b></div>`).join('')}</div>`;

const tableHtml = (heads, rows) =>
  `<div class="tbl-wrap"><table><thead><tr>${heads.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;

const chip = (cls, text) => `<span class="chip ${esc(cls)}">${esc(text)}</span>`;

function eventRow(e, actions) {
  const pct = e.seat_limit ? Math.min(100, Math.round((e.seats_taken / e.seat_limit) * 100)) : 0;
  return `<div class="ev-row" data-id="${esc(e.id)}">
    <div class="ev-cover" style="background:${coverOf(e.category)}">${esc((e.title || 'E').charAt(0).toUpperCase())}</div>
    <div class="ev-main"><span class="chip">${esc(e.category)}</span> ${chip(e.phase, PHASE[e.phase])} ${e.is_paid ? chip('warn', 'Paid ₱' + e.ticket_price) : chip('ok', 'Free')}<h4>${esc(e.title)}</h4><p>${esc(e.description || e.org_name)}</p></div>
    <div class="ev-meta"><div>${icon('pin', 14)}<span>${esc(e.venue)}</span></div>${e.payment ? `<div>${icon('card', 14)}<span>Fee ₱${esc(e.payment.amount)} · Ref ${esc(e.payment.reference)}</span></div>` : ''}<div>${icon('users', 14)}<span>${esc(e.eligibility || 'All')}</span></div><div>${icon('calendar', 14)}<span>${esc(fmtDT(e.starts_at))}</span></div>${e.letters_request && e.status === 'pending' ? `<div>${icon('file', 14)}<span>Letters needed: ${esc(e.letters_request.note)}</span></div>` : ''}${e.org_name ? `<div>${icon('building', 14)}<span>${esc(e.org_name)}</span></div>` : ''}</div>
    <div class="ev-seats"><div class="bar"><i style="width:${pct}%"></i></div><small>${pct}% seats filled</small></div>
    <div class="ev-left"><b>${e.seats_left}</b><small>Seats left</small></div>
    <div class="ev-act">${actions || ''}</div>
  </div>`;
}

const App = { views: {}, nav: [], home: '', cleanup: null, seq: 0, notifs: [] };

function mountShell(cfg) {
  const u = Session.user;
  if (!Session.token || !u || u.role !== cfg.role) {
    Session.clear();
    location.href = 'login.html';
    return;
  }
  App.views = cfg.views;
  App.nav = cfg.nav;
  App.home = cfg.home;
  $('#app').innerHTML = `<div class="mbar"><button class="burger" id="burger" aria-label="Open menu"><span></span><span></span><span></span></button><div class="brand"><img class="brand-mark" src="logo.png" alt="Presenta"></div></div>
  <div class="scrim" id="scrim"></div>
  <div class="shell">
    <aside class="side" id="side">
      <div class="brand"><img class="brand-mark" src="logo.png" alt="Presenta"></div>
      <nav class="nav" id="nav">${cfg.nav.map((n) => `<a href="#${n.id}" data-nav="${n.id}">${icon(n.icon)}<span>${esc(n.label)}</span></a>`).join('')}</nav>
      <button class="side-out" id="signOut">${icon('logout')}<span>Sign Out</span></button>
    </aside>
    <main class="main">
      <header class="top">
        <div><div class="crumb" id="crumb"></div><h1 id="title"></h1></div>
        <div class="top-right">
          <button class="bell" id="bell" aria-label="Notifications">${icon('bell')}<span class="dot" id="bellDot"></span></button>
          <div class="who"><div class="avatar" id="avatar"></div><div class="who-txt"><b id="whoName"></b><small id="whoSub"></small></div></div>
        </div>
      </header>
      <section id="view"></section>
    </main>
  </div>
  <div class="panel hidden" id="panel"></div>`;
  paintUser();
  $('#signOut').onclick = askLogout;
  const setNav = (open) => document.body.classList.toggle('nav-open', open);
  $('#burger').onclick = () => setNav(!document.body.classList.contains('nav-open'));
  $('#scrim').onclick = () => setNav(false);
  $('#nav').addEventListener('click', (e) => { if (e.target.closest('a')) setNav(false); });
  window.addEventListener('resize', () => { if (window.innerWidth > 900) setNav(false); });
  $('#bell').onclick = toggleNotifs;
  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('#panel') && !e.target.closest('#bell')) $('#panel').classList.add('hidden');
  });
  window.addEventListener('hashchange', () => route());
  route();
  pollNotifs();
  setInterval(pollNotifs, 30000);
  livePulse();
  setInterval(livePulse, 4000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) livePulse(); });
}

let liveRev = null;
let liveBusy = false;
async function livePulse() {
  if (liveBusy || document.hidden) return;
  liveBusy = true;
  try {
    const d = await api('/api/pulse');
    if (liveRev === null) {
      liveRev = d.rev;
    } else if (d.rev !== liveRev) {
      pollNotifs();
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      const busy = /^(INPUT|TEXTAREA|SELECT)$/.test(tag) || $('.overlay') || App.cleanup;
      if (!busy) {
        liveRev = d.rev;
        route(true);
      }
    }
  } catch (e) {
    return;
  } finally {
    liveBusy = false;
  }
}

function paintUser() {
  const u = Session.user;
  $('#avatar').textContent = (u.name || '?').charAt(0).toUpperCase();
  $('#whoName').textContent = u.name;
  $('#whoSub').textContent = (u.role === 'organization' && u.org_name) || ROLE_LABEL[u.role] || '';
}

async function route(silent) {
  const parts = (location.hash.slice(1) || App.home).split('/');
  const id = App.views[parts[0]] ? parts[0] : App.home;
  const v = App.views[id];
  const seq = ++App.seq;
  if (!silent) {
    if (App.cleanup) {
      App.cleanup();
      App.cleanup = null;
    }
    closeModals();
  }
  $$('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === (v.nav || id)));
  $('#title').textContent = v.title;
  $('#crumb').textContent = 'Dashboard / ' + v.title;
  const el = $('#view');
  if (!silent) el.innerHTML = '<div class="loading">Loading…</div>';
  try {
    const out = document.createElement('div');
    await v.render(out, parts[1]);
    if (seq !== App.seq) return;
    el.replaceChildren(out);
    if (v.after) v.after(out, parts[1]);
  } catch (e) {
    if (seq === App.seq && !silent) el.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}

const refresh = () => route();

async function pollNotifs() {
  try {
    const d = await api('/api/notifications');
    App.notifs = d.items;
    const dot = $('#bellDot');
    dot.classList.toggle('on', d.unread > 0);
    dot.textContent = d.unread > 9 ? '9+' : d.unread;
  } catch (e) {
    return;
  }
}

const notifHtml = (items) =>
  items.length
    ? items.map((n) => `<div class="notif ${n.read ? '' : 'unread'}"><b>${esc(n.title)}</b>${esc(n.message)}<br><small>${esc(fmtDT(n.created_at))}</small></div>`).join('')
    : '<div class="empty">No notifications yet</div>';

async function toggleNotifs() {
  const p = $('#panel');
  if (!p.classList.contains('hidden')) {
    p.classList.add('hidden');
    return;
  }
  await pollNotifs();
  p.innerHTML = notifHtml(App.notifs.slice(0, 20));
  p.classList.remove('hidden');
  if ($('#bellDot').classList.contains('on')) {
    api('/api/notifications/read', { method: 'POST' }).then(() => {
      $('#bellDot').classList.remove('on');
    }).catch(() => {});
  }
}

async function notificationsView(el) {
  const d = await api('/api/notifications');
  el.innerHTML = `<div class="card">${notifHtml(d.items)}</div>`;
  if (d.unread) api('/api/notifications/read', { method: 'POST' }).then(pollNotifs).catch(() => {});
}

async function profileView(el) {
  const me = (await api('/api/me')).user;
  Session.setUser(me);
  paintUser();
  const isStudent = me.role === 'student';
  const locked = Boolean(me.profile_locked);
  const orgs = isStudent ? await api('/api/public/orgs').catch(() => []) : [];
  const ro = locked ? 'readonly' : '';
  const dis = locked ? 'disabled' : '';
  const pick = (id, lab, list, val) => `<div class="f"><label for="${id}">${lab}</label><select id="${id}" ${dis}>${list.map((x) => `<option ${x === val ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>`;
  const field = (id, lab, val, o) => `<div class="f"><label for="${id}">${lab}</label><input id="${id}" value="${esc(val)}" ${o && o.fixed ? 'readonly' : ro} ${o && o.type ? 'type="' + o.type + '"' : ''} ${o && o.ph && !locked ? 'placeholder="' + esc(o.ph) + '"' : ''}></div>`;
  const orgPick = `<div class="f"><label for="pMember">Organization (optional)</label><select id="pMember" ${dis}><option value="">None</option>${orgs.map((o) => `<option value="${esc(o.id)}" ${o.id === me.member_org_id ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></div>`;
  const lockNote = `<div class="note-lock">${icon('shield', 18)}<div><b>Verified by SAO</b><span>Your profile has been approved, so it can no longer be edited. Please contact SAO if something needs to be corrected.</span></div></div>`;
  const windowNote = `<div class="note-lock">${icon('clock', 18)}<div><b>Update period is open</b><span>You can update your information until ${esc(fmtDT(me.profile_window_end))}.</span></div></div>`;
  const creditNote = `<div class="note-lock">${icon('key', 18)}<div><b>Edit credits: ${esc(me.edit_credits || 0)}</b><span>Each saved change uses one credit.</span></div></div>`;
  const notice = locked ? lockNote : me.profile_window_open ? windowNote : me.edit_credits ? creditNote : '';
  el.innerHTML = `<form class="card profile-card" id="profileForm" novalidate><h3>Profile</h3>${notice}<div class="form-grid">
      ${field('pName', 'Full name', me.name)}
      ${field('pEmail', 'Email', me.email, { type: 'email' })}
      ${field('pPhone', 'Phone', me.phone || '', { type: 'tel', ph: 'e.g. 0917 123 4567' })}
      ${me.role === 'organization' ? field('pPos', 'Position', me.position || '', { ph: 'e.g. President' }) + field('pOrg', 'Organization', me.org_name || '', { fixed: true }) + field('pOrgDept', 'Organization department', me.org_department || 'University-wide', { fixed: true }) : ''}
      ${isStudent ? field('pSid', 'Student ID', me.student_id || '') + pick('pDept', 'Department', DEPARTMENTS, me.department) + field('pCourse', 'Course', me.course || '') + pick('pYear', 'Year level', YEARS, me.year) + orgPick : ''}
    </div>${locked ? '' : '<div class="modal-actions"><button class="btn big" type="submit">Save profile</button></div>'}</form>`;
  $('#profileForm', el).onsubmit = async (e) => {
    e.preventDefault();
    if (locked) return;
    const body = { name: $('#pName', el).value, email: $('#pEmail', el).value, phone: $('#pPhone', el).value };
    if (me.role === 'organization') body.position = $('#pPos', el).value;
    if (isStudent) Object.assign(body, { student_id: $('#pSid', el).value, department: $('#pDept', el).value, course: $('#pCourse', el).value, year: $('#pYear', el).value, member_org_id: $('#pMember', el).value });
    const r = await run($('button[type=submit]', e.target), () => api('/api/me', { method: 'PUT', body }), 'Profile saved');
    if (r) {
      Session.setUser(r.user);
      paintUser();
    }
  };
}

function decisionBox(opt) {
  return new Promise((resolve) => {
    const o = document.createElement('div');
    o.className = 'overlay';
    o.style.zIndex = 90;
    o.innerHTML = `<div class="modal"><div class="modal-h"><h3>${esc(opt.title)}</h3><button class="x" type="button" aria-label="Close">&times;</button></div><div class="modal-b">
      ${opt.intro ? `<div class="dec-intro">${opt.intro}</div>` : ''}
      <form id="decForm"><div class="f"><label for="decNote">${esc(opt.label || 'Message to the recipient')}${opt.required ? '' : ' (optional)'}</label>
      <textarea id="decNote" maxlength="1000" ${opt.required ? 'required' : ''} placeholder="${esc(opt.placeholder || 'Write a message that will be sent to them as a notification and email.')}"></textarea></div>
      <div class="modal-actions"><button type="button" class="btn ghost" data-r="0">Cancel</button><button type="submit" class="btn ${opt.danger ? 'danger' : ''}">${esc(opt.okLabel || 'Send')}</button></div></form></div></div>`;
    document.body.appendChild(o);
    const done = (v) => { o.remove(); resolve(v); };
    $('.x', o).onclick = () => done(null);
    $('[data-r]', o).onclick = () => done(null);
    o.addEventListener('mousedown', (e) => { if (e.target === o) done(null); });
    $('#decForm', o).onsubmit = (e) => { e.preventDefault(); done($('#decNote', o).value.trim()); };
    setTimeout(() => $('#decNote', o).focus(), 30);
  });
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-msg]');
  if (b) Msg.open(b.dataset.msg, b.dataset.id, b.dataset.name, b.dataset.sub);
});

const Msg = {
  async open(target, id, name, subject) {
    const o = document.createElement('div');
    o.className = 'overlay';
    o.style.zIndex = 90;
    o.innerHTML = `<div class="modal"><div class="modal-h"><h3>Message ${esc(name)}</h3><button class="x" type="button" aria-label="Close">&times;</button></div><div class="modal-b"><form id="msgForm">
      <div class="f"><label for="msgSub">Subject</label><input id="msgSub" maxlength="80" value="${esc(subject || 'Message from SAO')}" required></div>
      <div class="f" style="margin-top:12px"><label for="msgBody">Message</label><textarea id="msgBody" maxlength="1000" required placeholder="This is delivered as a notification and an email."></textarea></div>
      <div class="modal-actions"><button type="button" class="btn ghost" data-r="0">Cancel</button><button type="submit" class="btn">Send message</button></div></form></div></div>`;
    document.body.appendChild(o);
    const close = () => o.remove();
    $('.x', o).onclick = close;
    $('[data-r]', o).onclick = close;
    o.addEventListener('mousedown', (e) => { if (e.target === o) close(); });
    $('#msgForm', o).onsubmit = async (e) => {
      e.preventDefault();
      const r = await run($('button[type=submit]', o), () => api('/api/messages', { method: 'POST', body: { target, id, subject: $('#msgSub', o).value, message: $('#msgBody', o).value } }), (x) => x.message);
      if (r) close();
    };
  }
};

function attendanceTable(rows, evId) {
  if (!rows.length) return '<div class="empty">No registrations yet</div>';
  const heads = ['Seat', 'Student', 'ID', 'Course', 'Status', 'Checked in'];
  if (evId) heads.push('');
  return tableHtml(heads, rows.map((r) => `<tr>
    <td>${r.walk_in ? chip('warn', 'Walk-in') : esc(r.seat_no)}</td><td>${esc(r.name)}<small>${esc(r.email)}</small></td><td>${esc(r.student_id)}</td>
    <td>${esc(r.course)}${r.year ? ' · Y' + esc(r.year) : ''}<small>${esc(r.department)}</small></td>
    <td>${r.left ? chip('absent', 'Left the venue') : chip(r.attended ? 'present' : 'pending', r.attended ? 'Present' : 'Not yet')}</td><td>${r.attended_at ? esc(fmtT(r.attended_at)) : '—'}</td>${evId ? `<td>${r.walk_in ? `<button class="btn sm danger" onclick="P.rmWalkin('${esc(evId)}','${esc(r.id)}')">Remove</button>` : ''}</td>` : ''}</tr>`));
}

const pad2 = (n) => String(n).padStart(2, '0');
function dtPicker(id, iso, minToday) {
  const d = iso ? new Date(iso) : new Date();
  let h = d.getHours();
  const pm = h >= 12;
  h = h % 12 || 12;
  const m = d.getMinutes();
  const mins = Array.from({ length: 12 }, (_, i) => i * 5);
  if (!mins.includes(m)) mins.push(m);
  mins.sort((a, b) => a - b);
  const today = new Date();
  const min = minToday ? ` min="${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}"` : '';
  return `<div class="dt" id="${id}"><input type="date" class="dt-d" value="${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}"${min} required>
    <select class="dt-h" aria-label="Hour">${Array.from({ length: 12 }, (_, i) => i + 1).map((x) => `<option value="${x}" ${x === h ? 'selected' : ''}>${x}</option>`).join('')}</select>
    <select class="dt-m" aria-label="Minute">${mins.map((x) => `<option value="${x}" ${x === m ? 'selected' : ''}>${pad2(x)}</option>`).join('')}</select>
    <select class="dt-p" aria-label="AM or PM"><option ${pm ? '' : 'selected'}>AM</option><option ${pm ? 'selected' : ''}>PM</option></select></div>`;
}
function dtGet(root) {
  const v = $('.dt-d', root).value;
  if (!v) return null;
  const [y, mo, da] = v.split('-').map(Number);
  let h = Number($('.dt-h', root).value) % 12;
  if ($('.dt-p', root).value === 'PM') h += 12;
  return new Date(y, mo - 1, da, h, Number($('.dt-m', root).value));
}
function dtSet(root, d) {
  $('.dt-d', root).value = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const h = d.getHours();
  $('.dt-h', root).value = String(h % 12 || 12);
  const m = d.getMinutes();
  if (![...$('.dt-m', root).options].some((o) => Number(o.value) === m)) {
    const o = document.createElement('option');
    o.value = m;
    o.textContent = pad2(m);
    $('.dt-m', root).appendChild(o);
  }
  $('.dt-m', root).value = String(m);
  $('.dt-p', root).value = h >= 12 ? 'PM' : 'AM';
}

const ReportsUI = {
  year: '',
  async view(el) {
    const all = await api('/api/reports');
    const years = Array.from(new Set(all.map((r) => r.school_year))).sort().reverse();
    const list = ReportsUI.year ? all.filter((r) => r.school_year === ReportsUI.year) : all;
    el.innerHTML = `<div class="card"><div class="toolbar"><h3 style="margin:0">Attendance records</h3>
      <select class="pill" id="yearSel"><option value="">All school years</option>${years.map((y) => `<option ${y === ReportsUI.year ? 'selected' : ''}>${esc(y)}</option>`).join('')}</select></div>
      ${list.length ? tableHtml(['Event', 'Organization', 'Date', 'School year', 'Registered', 'Present', 'Rate', 'Saved', ''], list.map((r) => `<tr>
        <td><b>${esc(r.event_title)}</b><small>${esc(r.venue)}</small></td><td>${esc(r.org_name)}</td><td>${esc(fmtD(r.event_date))}</td><td>${esc(r.school_year)}</td>
        <td>${r.total_registered}</td><td>${r.total_present}</td><td>${r.rate}%</td><td>${esc(fmtDT(r.generated_at))}</td>
        <td><div class="btns"><button class="btn sm ghost" onclick="ReportsUI.open('${esc(r.id)}')">View</button><button class="btn sm" onclick="ReportsUI.pdf('${esc(r.id)}')">Download PDF</button></div></td></tr>`)) : '<div class="empty">No saved reports yet</div>'}</div>`;
    $('#yearSel', el).onchange = (e) => { ReportsUI.year = e.target.value; refresh(); };
  },
  async open(id) {
    const r = await api('/api/reports/' + id);
    modal(r.event_title, `<div class="detail"><div>${icon('building', 16)}<span>${esc(r.org_name)} · ${esc(r.venue)}</span></div><div>${icon('calendar', 16)}<span>${esc(fmtDT(r.event_date))} · SY ${esc(r.school_year)}</span></div><div>${icon('users', 16)}<span>${r.total_present} of ${r.total_registered} present (${r.rate}%)</span></div></div>${attendanceTable(r.rows.map((x) => ({ ...x, attended: x.status === 'Present', left: x.status === 'Left the venue' })))}<div class="modal-actions"><button class="btn" onclick="ReportsUI.pdf('${esc(r.id)}')">Download PDF</button></div>`, { wide: true });
  },
  async pdf(id) {
    try {
      await download('/api/reports/' + id + '/pdf', 'attendance-report-' + id + '.pdf');
    } catch (e) {
      toast(e.message, 'err');
    }
  }
};

const ApprovalsUI = {
  tab: 'pending',
  list: [],

  async decide(id, decision) {
    const ev = ApprovalsUI.list.find((x) => x.id === id);
    const title = ev ? `<b>${esc(ev.title)}</b>${ev.org_name ? ' · ' + esc(ev.org_name) : ''}<br>` : '';
    const pay = ev && ev.payment ? `Payment of <b>₱${esc(ev.payment.amount)}</b> with reference <b>${esc(ev.payment.reference)}</b>${ev.payment.payer ? ' from ' + esc(ev.payment.payer) : ''}.<br>` : '';
    if (decision === 'approve') {
      const note = await decisionBox({ title: 'Approve event', intro: title + pay + (pay ? 'Confirm it was received in the SAO wallet. ' : '') + 'The event will be published and registration will open.', label: 'Message to the organization', okLabel: 'Approve event' });
      if (note === null) return;
      const r = await run(null, () => api('/api/events/' + id + '/approval', { method: 'POST', body: { decision, note } }), 'Event approved');
      if (r) refresh();
      return;
    }
    const note = await decisionBox({ title: 'Disapprove event', intro: title + pay, label: 'Reason / message to the organization', required: true, danger: true, okLabel: 'Disapprove', placeholder: 'Explain why the event or payment was not approved.' });
    if (note === null) return;
    const r = await run(null, () => api('/api/events/' + id + '/approval', { method: 'POST', body: { decision, note } }), 'Event disapproved');
    if (r) refresh();
  },

  async letters(id) {
    const ev = ApprovalsUI.list.find((x) => x.id === id);
    const title = ev ? `<b>${esc(ev.title)}</b>${ev.org_name ? ' · ' + esc(ev.org_name) : ''}<br>` : '';
    const note = await decisionBox({ title: 'Request letters', intro: title + 'The organization will be notified of the letters they must submit before SAO decides.', label: 'Needed letters', required: true, okLabel: 'Notify organization', placeholder: 'Example: Letter of intent, adviser endorsement, venue permit.' });
    if (note === null) return;
    const r = await run(null, () => api('/api/events/' + id + '/request-letters', { method: 'POST', body: { note } }), 'Organization notified');
    if (r) refresh();
  },

  async view(el) {
    const list = await api('/api/approvals');
    ApprovalsUI.list = list;
    const sets = {
      pending: list.filter((e) => e.status === 'pending'),
      approved: list.filter((e) => e.status === 'published'),
      rejected: list.filter((e) => e.status === 'rejected')
    };
    const acts = (e) => {
      const id = esc(e.id);
      if (e.status === 'pending') return `<button class="btn sm ghost" onclick="ApprovalsUI.letters('${id}')">Request letters</button><button class="btn sm" onclick="ApprovalsUI.decide('${id}','approve')">Approve</button><button class="btn sm danger" onclick="ApprovalsUI.decide('${id}','reject')">Disapprove</button>`;
      if (e.status === 'rejected') return `<small style="max-width:200px">Reason: ${esc(e.approval_note)}</small>`;
      return chip('ok', 'Approved');
    };
    el.innerHTML = `<div class="card"><div class="toolbar">${tabsHtml([{ id: 'pending', label: 'Pending', count: sets.pending.length }, { id: 'approved', label: 'Approved', count: sets.approved.length }, { id: 'rejected', label: 'Disapproved', count: sets.rejected.length }], ApprovalsUI.tab)}</div>
      <div class="list">${sets[ApprovalsUI.tab].length ? sets[ApprovalsUI.tab].map((e) => eventRow(e, acts(e))).join('') : '<div class="empty">No events here</div>'}</div></div>`;
    bindTabs(el, (t) => { ApprovalsUI.tab = t; refresh(); });
  }
};

const FeesUI = {
  qr: '',

  async save(btn) {
    const body = {
      paid_rate: $('#fsRate').value,
      free_fee: $('#fsFree').value,
      wallet_name: $('#fsName').value,
      wallet_number: $('#fsNumber').value,
      wallet_qr: $('#fsQrUrl').value // Grab the URL
    };
    const r = await run(btn, () => api('/api/settings', { method: 'PUT', body }), 'Fees and wallet saved');
    if (r) refresh();
  },

  async view(el) {
    const s = await api('/api/settings');
    let pays = [];
    try {
      pays = await api('/api/payments');
    } catch (e) {
      pays = [];
    }
    FeesUI.qr = s.wallet_qr || '';
    const verified = pays.filter((p) => p.payment_status === 'verified');
    const total = verified.reduce((n, p) => n + Number(p.amount), 0);
    
    el.innerHTML = tilesHtml([['Paid event fee', s.paid_rate + '%'], ['Free event fee', '₱' + s.free_fee], ['Verified payments', verified.length], ['Total verified', '₱' + total.toFixed(2)]]) +
      `<div class="split2"><div class="card"><h3>Fee rates</h3><div class="form-grid">
        <div class="f"><label>Paid event fee (% of expected ticket sales)</label><input id="fsRate" type="number" min="0" max="100" step="0.1" value="${esc(s.paid_rate)}"></div>
        <div class="f"><label>Free event fee (₱ per event)</label><input id="fsFree" type="number" min="0" step="1" value="${esc(s.free_fee)}"></div></div>
        <p class="hint">Expected ticket sales = ticket price × seat limit. Paid events are charged the percentage, free events the flat fee.</p></div>
      <div class="card"><h3>Payment wallet</h3><div class="form-grid">
        <div class="f"><label>Account name</label><input id="fsName" value="${esc(s.wallet_name)}"></div>
        <div class="f"><label>Account number</label><input id="fsNumber" value="${esc(s.wallet_number)}"></div>
        
        <!-- NEW: URL INPUT INSTEAD OF FILE UPLOAD -->
        <div class="f full"><label>Wallet QR code Image URL</label><input id="fsQrUrl" placeholder="https://example.com/qr.png" value="${esc(s.wallet_qr)}"></div></div>
        
        <div style="margin-top:12px">
            <img id="fsPrev" alt="Wallet QR" style="max-width:200px;border-radius:12px;border:1px solid var(--line);${s.wallet_qr ? '' : 'display:none'}" src="${esc(s.wallet_qr)}">
        </div>
      </div></div>
      
      <div class="page-actions"><button class="btn big" id="fsSave">Save fees and wallet</button></div>
      <div class="card"><h3>Event payments</h3>${pays.length ? tableHtml(['Event', 'Organization', 'Type', 'Amount', 'Reference', 'Paid on', 'Status', ''], pays.map((p) => `<tr>
        <td><b>${esc(p.title)}</b><small>${esc(label(p.event_status))}</small></td><td>${esc(p.org_name)}</td><td>${p.is_paid ? 'Paid · ₱' + esc(p.ticket_price) + ' × ' + esc(p.seat_limit) : 'Free'}</td>
        <td>₱${esc(p.amount)}</td><td>${esc(p.reference)}${p.payer ? '<small>' + esc(p.payer) + '</small>' : ''}</td><td>${esc(fmtDT(p.submitted_at))}</td>
        <td>${chip(p.payment_status === 'verified' ? 'ok' : p.payment_status === 'rejected' ? 'bad' : 'warn', label(p.payment_status))}</td>
        <td><button class="btn sm ghost" data-msg="org" data-id="${esc(p.org_id)}" data-name="${esc(p.org_name)}" data-sub="${esc('Payment for "' + p.title + '"')}">Message</button></td></tr>`)) : '<div class="empty">No payments yet</div>'}</div>`;
    
    // NEW: Preview image when URL is typed
    $('#fsQrUrl', el).oninput = (e) => {
      FeesUI.qr = e.target.value.trim();
      const prev = $('#fsPrev', el);
      if (FeesUI.qr) {
        prev.src = FeesUI.qr;
        prev.style.display = '';
      } else {
        prev.style.display = 'none';
      }
    };
    
    $('#fsSave', el).onclick = (e) => FeesUI.save(e.target);
  }
};

// Mobile: tables turn into stacked cards, so every cell needs its column name.
(function () {
  let queued = false;
  const label = () => {
    queued = false;
    $$('table:not([data-lbl])').forEach((t) => {
      t.dataset.lbl = '1';
      const heads = $$('thead th', t).map((th) => th.textContent.trim());
      $$('tbody tr', t).forEach((tr) => {
        Array.from(tr.children).forEach((td, i) => {
          td.setAttribute('data-label', heads[i] || '');
          if (td.firstElementChild && td.firstElementChild.classList.contains('cv')) return;
          const w = document.createElement('div');
          w.className = 'cv';
          while (td.firstChild) w.appendChild(td.firstChild);
          td.appendChild(w);
        });
      });
    });
  };
  new MutationObserver(() => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(label);
    }
  }).observe(document.body, { childList: true, subtree: true });
})();