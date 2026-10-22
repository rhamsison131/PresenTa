const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const mailer = require('./mailer');

const ROW_ID = 'main';
const COLLECTIONS = ['users', 'orgs', 'events', 'registrations', 'notifications', 'reports', 'logs'];
const ALL_PRIVS = ['verify_accounts', 'manage_subscriptions', 'monitor_events', 'view_reports', 'manage_events', 'approve_events'];
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
const DEFAULT_PRIVS = {
  student: [],
  organization: ['manage_events'],
  personnel: ['verify_accounts', 'manage_subscriptions', 'monitor_events', 'view_reports', 'approve_events'],
  superadmin: ALL_PRIVS.slice()
};

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

const data = {};
let queue = Promise.resolve();

const persist = async () => {
  try {
    const { error } = await supabase
      .from('app_state')
      .upsert({ id: ROW_ID, data, updated_at: new Date().toISOString() });
    if (error) console.error('Supabase save failed:', error.message);
  } catch (err) {
    console.error('Supabase save failed:', err.message);
  }
};

const save = () => {
  queue = queue.then(persist);
  return queue;
};

const flush = () => queue;

const normalize = () => {
  COLLECTIONS.forEach((k) => {
    if (!Array.isArray(data[k])) data[k] = [];
  });
  if (!data.settings || typeof data.settings !== 'object') data.settings = {};
  data.settings = {
    wallet_name: '',
    wallet_number: '',
    wallet_qr: '',
    paid_rate: 5,
    free_fee: 100,
    profile_window: { start: '', end: '' },
    ...data.settings
  };
  data.users.forEach((u) => {
    u.email = String(u.email || '').toLowerCase();
    if (!Array.isArray(u.privileges)) u.privileges = (DEFAULT_PRIVS[u.role] || []).slice();
    if (!u.status) u.status = 'active';
  });
};

const load = async () => {
  await queue;
  const { data: row, error } = await supabase
    .from('app_state')
    .select('data')
    .eq('id', ROW_ID)
    .maybeSingle();
  if (error) throw new Error('Supabase load failed: ' + error.message);
  Object.keys(data).forEach((k) => delete data[k]);
  Object.assign(data, (row && row.data) || {});
  normalize();
  if (!data.approvalMigrated) {
    data.users.forEach((u) => {
      if (u.role === 'personnel' && !u.privileges.includes('approve_events')) u.privileges.push('approve_events');
    });
    data.approvalMigrated = true;
    await save();
  }
};

const ready = load();
ready.catch((err) => console.error(err.message));
const reload = () => load();

const uid = (prefix) => prefix + crypto.randomBytes(6).toString('hex');
const now = () => new Date().toISOString();
const findUser = (key) => {
  const k = String(key || '').trim().toLowerCase();
  return data.users.find((u) => u.email === k || (u.username && u.username.toLowerCase() === k));
};
const hasPriv = (u, p) => u.role === 'superadmin' || (u.privileges || []).includes(p);

const log = (actor, action, detail) => {
  data.logs.push({
    id: uid('l_'),
    at: now(),
    actor_id: actor ? actor.id : null,
    actor_name: actor ? actor.name : 'System',
    actor_role: actor ? actor.role : 'system',
    action,
    detail: detail || ''
  });
  if (data.logs.length > 5000) data.logs.splice(0, data.logs.length - 5000);
  save();
};

const withNote = (text, note, by) => {
  const n = String(note || '').trim();
  return n ? text + '\n\nMessage from ' + (by ? by.name : 'SAO') + ': ' + n : text;
};

const notify = (userId, title, message) => {
  data.notifications.push({ id: uid('n_'), user_id: userId, title, message, created_at: now(), read: false });
  save();
  const user = data.users.find((u) => u.id === userId);
  if (user) mailer.send(user.email, title, message).catch(() => {});
};

const windowState = () => {
  const w = data.settings.profile_window || {};
  const s = w.start ? new Date(w.start).getTime() : NaN;
  const e = w.end ? new Date(w.end).getTime() : NaN;
  const t = Date.now();
  return { open: !isNaN(s) && !isNaN(e) && t >= s && t <= e, start: w.start || '', end: w.end || '' };
};

const sweepAccreditation = () => {
  const t = Date.now();
  let changed = false;
  data.orgs.forEach((o) => {
    if (o.status === 'accredited' && o.accredited_until && t > new Date(o.accredited_until).getTime()) {
      o.status = 'pending';
      o.accreditation_expired = true;
      changed = true;
      data.users.filter((u) => u.org_id === o.id && u.role === 'organization').forEach((u) => {
        notify(u.id, 'Accreditation expired', o.name + ' accreditation has expired. SAO will check it again and approve it before events can be created.');
      });
    }
  });
  if (changed) save();
};

const pub = (u) => {
  const { password, reset_code, reset_expires, ...rest } = u;
  const org = u.org_id ? data.orgs.find((o) => o.id === u.org_id) : null;
  const member = u.member_org_id ? data.orgs.find((o) => o.id === u.member_org_id) : null;
  const win = windowState();
  const profile_locked = (u.role === 'student' || u.role === 'organization') && u.status === 'active' && !(u.edit_credits > 0) && !(u.role === 'student' && win.open);
  return {
    ...rest,
    profile_locked,
    edit_credits: u.edit_credits || 0,
    profile_window_open: win.open,
    profile_window_end: win.end,
    member_org_name: member ? member.name : '',
    org_name: org ? org.name : null,
    org_status: org ? org.status : null,
    org_department: org ? org.department || '' : ''
  };
};

module.exports = {
  data,
  ready,
  reload,
  save,
  flush,
  uid,
  now,
  findUser,
  hasPriv,
  log,
  notify,
  withNote,
  pub,
  windowState,
  sweepAccreditation,
  ALL_PRIVS,
  DEFAULT_PRIVS,
  DEPARTMENTS,
  YEARS
};