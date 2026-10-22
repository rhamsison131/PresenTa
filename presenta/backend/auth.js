const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const mailer = require('./mailer');

const SECRET = process.env.JWT_SECRET || 'presenta_dev_secret_change_me';
const REDIRECT = {
  student: '/student-dashboard.html',
  organization: '/org-dashboard.html',
  personnel: '/personnel-dashboard.html',
  superadmin: '/superadmin-dashboard.html'
};

const clean = (v) => String(v === undefined || v === null ? '' : v).trim();
const sign = (u) => jwt.sign({ id: u.id, role: u.role }, SECRET, { expiresIn: '1d' });

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  });

const authenticate = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  try {
    const payload = jwt.verify(token, SECRET);
    const user = db.data.users.find((u) => u.id === payload.id);
    if (!user) return res.status(401).json({ message: 'Session expired' });
    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Account is ' + user.status, code: 'ACCOUNT_INACTIVE' });
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Session expired' });
  }
};

const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ message: 'Not allowed for your role' });

const requirePriv = (priv) => (req, res, next) =>
  db.hasPriv(req.user, priv) ? next() : res.status(403).json({ message: 'Missing privilege: ' + priv });

const findOrCreateOrg = (name, department) => {
  let org = db.data.orgs.find((o) => o.name.toLowerCase() === name.toLowerCase());
  if (!org) {
    org = {
      id: db.uid('o_'),
      name,
      department: department || '',
      status: 'pending',
      suspended: false,
      subscription: { plan: 'Basic', status: 'inactive', expires_at: null },
      created_at: db.now()
    };
    db.data.orgs.push(org);
  }
  return org;
};

const confirmed = async (u) => {
  if (u.email_verified !== false || !u.supabase_id) return false;
  try {
    const { data, error } = await db.supabase.auth.admin.getUserById(u.supabase_id);
    if (!error && data && data.user && data.user.email_confirmed_at) {
      u.email_verified = true;
      u.email_verified_at = db.now();
      return true;
    }
  } catch (e) {}
  return false;
};

const syncVerified = async () => {
  const list = db.data.users.filter((u) => u.email_verified === false && u.supabase_id);
  const res = await Promise.all(list.map(confirmed));
  if (res.some(Boolean)) await db.save();
};

const publicOrgs = () =>
  db.data.orgs
    .filter((o) => o.status === 'accredited' && !o.suspended)
    .map((o) => ({ id: o.id, name: o.name, department: o.department || '' }))
    .sort((a, b) => a.name.localeCompare(b.name));

const register = wrap(async (req, res) => {
  const b = req.body || {};
  const role = b.role === 'organization' ? 'organization' : 'student';
  const name = clean(b.name);
  const email = clean(b.email).toLowerCase();
  const password = String(b.password || '');

  if (!name || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ message: 'A valid name and email are required' });
  }
  if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
  if (db.findUser(email)) return res.status(400).json({ message: 'Email is already registered' });

  const user = {
    id: db.uid('u_'),
    name,
    email,
    password: await bcrypt.hash(password, 10),
    role,
    status: 'pending',
    phone: clean(b.phone),
    department: clean(b.department),
    course: clean(b.course),
    year: clean(b.year),
    student_id: clean(b.student_id),
    position: clean(b.position),
    privileges: db.DEFAULT_PRIVS[role].slice(),
    created_at: db.now()
  };

  if (role === 'student') {
    if (!user.student_id || !user.department || !user.course) {
      return res.status(400).json({ message: 'Student ID, department and course are required' });
    }
    if (!db.DEPARTMENTS.includes(user.department)) return res.status(400).json({ message: 'Select a valid department' });
    if (!db.YEARS.includes(user.year)) return res.status(400).json({ message: 'Select a valid year level' });
    const member = clean(b.member_org_id);
    if (member && !publicOrgs().some((o) => o.id === member)) return res.status(400).json({ message: 'Select a valid organization' });
    user.member_org_id = member;
  } else {
    const orgName = clean(b.org_name);
    if (!orgName) return res.status(400).json({ message: 'Organization name is required' });
    const dept = clean(b.org_department);
    if (dept && !db.DEPARTMENTS.includes(dept)) return res.status(400).json({ message: 'Select a valid department' });
    user.org_id = findOrCreateOrg(orgName, dept).id;
    user.department = '';
  }

  const base = (process.env.APP_URL || '').replace(/\/$/, '');
  const { data: sg, error: sgErr } = await db.supabase.auth.signUp({
    email,
    password,
    options: base ? { emailRedirectTo: base + '/login.html' } : {}
  });
  if (sgErr) return res.status(400).json({ message: sgErr.message });
  if (!sg.user || !sg.user.identities || !sg.user.identities.length) {
    return res.status(400).json({ message: 'Email is already registered' });
  }
  user.supabase_id = sg.user.id;
  user.email_verified = false;

  db.data.users.push(user);
  await db.save();
  db.log(user, 'register', role + ' account created: ' + email);
  res.status(201).json({ message: 'Registered. Confirm your email using the link sent to your Gmail. After that, SAO will verify your account.' });
});

const login = wrap(async (req, res) => {
  await db.ready;
  
  const user = db.findUser(req.body && req.body.email);
  const password = String((req.body && req.body.password) || '');
  
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  
  if (user.email_verified === false) {
    if (await confirmed(user)) await db.save();
    if (user.email_verified === false) {
      return res.status(403).json({ message: 'Please confirm your email first. Check your Gmail inbox.', code: 'EMAIL_UNCONFIRMED' });
    }
  }

  if (user.status === 'pending') return res.status(403).json({ message: 'Your account is waiting for SAO verification.' });
  if (user.status === 'rejected') return res.status(403).json({ message: 'Your account was rejected by SAO.' });
  if (user.status === 'suspended') return res.status(403).json({ message: 'Your account is suspended.' });
  
  db.log(user, 'login', 'Signed in');
  await db.save();
  res.json({ token: sign(user), user: db.pub(user), redirectUrl: REDIRECT[user.role] });
});

const forgot = wrap(async (req, res) => {
  const user = db.findUser(req.body && req.body.email);
  const out = { message: 'If the account exists, a reset code has been sent.' };
  if (user) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    user.reset_code = await bcrypt.hash(code, 8);
    user.reset_expires = Date.now() + 15 * 60 * 1000;
    await db.save();
    const result = await mailer.send(user.email, 'Presenta password reset', 'Your reset code is ' + code + '. It expires in 15 minutes.');
    if (!result.sent) {
      console.log('[reset] ' + user.email + ' code: ' + code);
      if (process.env.NODE_ENV !== 'production') out.dev_code = code;
    }
  }
  res.json(out);
});

const reset = wrap(async (req, res) => {
  const b = req.body || {};
  const user = db.findUser(b.email);
  const password = String(b.password || '');
  if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
  if (!user || !user.reset_code || Date.now() > (user.reset_expires || 0) || !(await bcrypt.compare(clean(b.code), user.reset_code))) {
    return res.status(400).json({ message: 'Invalid or expired reset code' });
  }
  user.password = await bcrypt.hash(password, 10);
  delete user.reset_code;
  delete user.reset_expires;
  await db.save();
  db.log(user, 'password_reset', 'Password reset with code');
  res.json({ message: 'Password updated. You can log in now.' });
});

const updateMe = wrap(async (req, res) => {
  const u = req.user;
  const b = req.body || {};
  const touchesProfile = ['name', 'email', 'phone', 'position', 'student_id', 'department', 'course', 'year', 'member_org_id'].some((k) => b[k] !== undefined);
  const useCredit = touchesProfile && u.status === 'active' && (u.role === 'student' || u.role === 'organization') && !(u.role === 'student' && db.windowState().open);
  if (touchesProfile && db.pub(u).profile_locked) {
    return res.status(403).json({ message: 'Your profile was verified by SAO and can no longer be edited. Contact SAO if something needs to be corrected.' });
  }
  if (b.email !== undefined) {
    const email = clean(b.email).toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address' });
    const taken = db.findUser(email);
    if (taken && taken.id !== u.id) return res.status(400).json({ message: 'Email is already registered' });
  }
  if (b.new_password) {
    if (String(b.new_password).length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters' });
    if (!(await bcrypt.compare(String(b.current_password || ''), u.password))) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    u.password = await bcrypt.hash(String(b.new_password), 10);
    db.log(u, 'password_change', 'Password changed');
  }
  if (b.name !== undefined) {
    if (!clean(b.name)) return res.status(400).json({ message: 'Name cannot be empty' });
    u.name = clean(b.name);
  }
  if (b.email !== undefined) u.email = clean(b.email).toLowerCase();
  ['phone', 'position'].forEach((k) => {
    if (b[k] !== undefined) u[k] = clean(b[k]);
  });
  if (u.role === 'student') {
    if (b.department !== undefined && !db.DEPARTMENTS.includes(clean(b.department))) return res.status(400).json({ message: 'Select a valid department' });
    if (b.year !== undefined && !db.YEARS.includes(clean(b.year))) return res.status(400).json({ message: 'Select a valid year level' });
    if (b.member_org_id !== undefined) {
      const member = clean(b.member_org_id);
      if (member && !publicOrgs().some((o) => o.id === member)) return res.status(400).json({ message: 'Select a valid organization' });
      u.member_org_id = member;
    }
    ['student_id', 'department', 'course', 'year'].forEach((k) => {
      if (b[k] !== undefined) u[k] = clean(b[k]);
    });
  }
  if (useCredit && (u.edit_credits || 0) > 0) u.edit_credits -= 1;
  await db.save();
  db.log(u, 'profile_update', 'Profile updated');
  res.json({ user: db.pub(u) });
});

const mount = (app) => {
  app.get('/api/public/orgs', (req, res) => res.json(publicOrgs()));
  app.post('/api/register', register);
  app.post('/api/login', login);
  app.post('/api/auth/resend', wrap(async (req, res) => {
    const u = db.findUser(req.body && req.body.email);
    if (u && u.email_verified === false) {
      await db.supabase.auth.resend({ type: 'signup', email: u.email });
    }
    res.json({ message: 'If the account is waiting for confirmation, a new email was sent.' });
  }));
  app.post('/api/auth/forgot', forgot);
  app.post('/api/auth/reset', reset);
  app.get('/api/me', authenticate, (req, res) => res.json({ user: db.pub(req.user) }));
  app.put('/api/me', authenticate, updateMe);
  app.get('/api/notifications', authenticate, (req, res) => {
    const items = db.data.notifications
      .filter((n) => n.user_id === req.user.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 100);
    res.json({ items, unread: items.filter((n) => !n.read).length });
  });
  app.post('/api/notifications/read', authenticate, async (req, res) => {
    db.data.notifications.forEach((n) => {
      if (n.user_id === req.user.id) n.read = true;
    });
    await db.save();
    res.json({ ok: true });
  });
};

const seed = async () => {
  if (db.data.users.some((u) => u.role === 'superadmin')) return;
  const email = clean(process.env.ADMIN_EMAIL || 'admin@presenta.local').toLowerCase();
  db.data.users.push({
    id: db.uid('u_'),
    name: process.env.ADMIN_NAME || 'Super Admin',
    email,
    username: clean(process.env.ADMIN_USERNAME || 'admin'),
    password: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10),
    role: 'superadmin',
    status: 'active',
    privileges: db.ALL_PRIVS.slice(),
    created_at: db.now()
  });
  await db.save();
  console.log('Super admin created: ' + email);
};

module.exports = { mount, seed, authenticate, requireRole, requirePriv, wrap, clean, findOrCreateOrg, syncVerified };