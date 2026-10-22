const bcrypt = require('bcryptjs');
const db = require('./db');
const { authenticate, requireRole, requirePriv, wrap, clean, findOrCreateOrg } = require('./auth');

const ROLES = ['student', 'organization', 'personnel', 'superadmin'];
const addYear = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString();
};
const officersOf = (orgId) => db.data.users.filter((u) => u.org_id === orgId);
const orgView = (o) => ({
  ...o,
  officers: officersOf(o.id).map((u) => ({ id: u.id, name: u.name, email: u.email, status: u.status }))
});

const mount = (app) => {
  const verifier = [authenticate, requirePriv('verify_accounts')];
  const subscriber = [authenticate, requirePriv('manage_subscriptions')];
  const superOnly = [authenticate, requireRole('superadmin')];

  app.get('/api/verify/students', ...verifier, (req, res) => {
    res.json(db.data.users.filter((u) => u.role === 'student').map(db.pub).reverse());
  });

  app.post('/api/verify/students/:id', ...verifier, wrap(async (req, res) => {
    const u = db.data.users.find((x) => x.id === req.params.id && x.role === 'student');
    if (!u) return res.status(404).json({ message: 'Student not found' });
    const map = { approve: 'active', hold: 'pending', reject: 'rejected' };
    const decision = req.body && req.body.decision;
    if (!map[decision]) return res.status(400).json({ message: 'Invalid decision' });
    if (u.status === 'suspended') return res.status(400).json({ message: 'Account is suspended. Restore it from the admin panel.' });
    const note = clean(req.body && req.body.note);
    if (decision !== 'approve' && !note) return res.status(400).json({ message: 'Write a message for the student explaining this decision' });
    
    u.status = map[decision];
    await db.save(); // FIXED: Wait for save to complete
    db.log(req.user, 'student_' + decision, u.email + (note ? ' | message: ' + note : ''));
    
    const text = {
      approve: 'Your student account is verified. You can now register for events.',
      hold: 'Your account is on hold. SAO needs more information.',
      reject: 'Your student account was rejected by SAO.'
    };
    db.notify(u.id, decision === 'approve' ? 'Account verified' : decision === 'hold' ? 'Account on hold' : 'Account disapproved', db.withNote(text[decision], note, req.user));
    res.json({ message: 'Student ' + ({ approve: 'approved', hold: 'put on hold', reject: 'rejected' })[decision], user: db.pub(u) });
  }));

  app.get('/api/verify/orgs', ...verifier, (req, res) => {
    res.json(db.data.orgs.map(orgView).reverse());
  });

  app.post('/api/verify/orgs/:id', ...verifier, wrap(async (req, res) => {
    const o = db.data.orgs.find((x) => x.id === req.params.id);
    if (!o) return res.status(404).json({ message: 'Organization not found' });
    const decision = req.body && req.body.decision;
    if (!['accredit', 'pending', 'not_accredited'].includes(decision)) return res.status(400).json({ message: 'Invalid decision' });
    const note = clean(req.body && req.body.note);
    if (decision !== 'accredit' && !note) return res.status(400).json({ message: 'Write a message for the organization explaining this decision' });
    const officers = officersOf(o.id);
    if (decision === 'accredit') {
      o.status = 'accredited';
      o.accredited_at = db.now();
      officers.forEach((u) => {
        if (u.status === 'pending' || u.status === 'rejected') u.status = 'active';
      });
      if (!o.subscription || o.subscription.status !== 'active') {
        o.subscription = { plan: (o.subscription && o.subscription.plan) || 'Basic', status: 'active', expires_at: addYear() };
      }
      if (!o.accredited_until || new Date(o.accredited_until) <= new Date()) o.accredited_until = addYear();
      o.accreditation_expired = false;
    } else {
      o.status = decision;
      officers.forEach((u) => {
        if (u.status === 'active') u.status = 'pending';
      });
    }
    await db.save(); // FIXED: Wait for save to complete
    db.log(req.user, 'org_' + decision, o.name + (note ? ' | message: ' + note : ''));
    const msg = decision === 'accredit'
      ? 'Your organization is accredited. You can now create events.'
      : 'Your organization is marked as ' + decision.replace('_', ' ') + '.';
    officers.forEach((u) => db.notify(u.id, decision === 'accredit' ? 'Organization accredited' : 'Organization update', db.withNote(msg, note, req.user)));
    res.json({ message: 'Organization updated', org: orgView(o) });
  }));

  // ... [Rest of admin.js remains the same as the original file you provided] ...
  
  app.get('/api/subscriptions', ...subscriber, (req, res) => {
    res.json(db.data.orgs.map(orgView).reverse());
  });

  app.put('/api/subscriptions/:id', ...subscriber, wrap(async (req, res) => {
    const o = db.data.orgs.find((x) => x.id === req.params.id);
    if (!o) return res.status(404).json({ message: 'Organization not found' });
    const b = req.body || {};
    const plan = clean(b.plan) || 'Basic';
    const status = b.status === 'active' ? 'active' : 'inactive';
    const expires = b.expires_at ? new Date(b.expires_at) : null;
    if (expires && isNaN(expires)) return res.status(400).json({ message: 'Invalid expiry date' });
    o.subscription = { plan, status, expires_at: expires ? expires.toISOString() : null };
    await db.save();
    db.log(req.user, 'subscription_update', o.name + ': ' + plan + ' / ' + status);
    officersOf(o.id).forEach((u) => db.notify(u.id, 'Subscription update', 'Your subscription is now ' + plan + ' (' + status + ').'));
    res.json({ message: 'Subscription saved', org: orgView(o) });
  }));

  app.get('/api/admin/users', ...superOnly, (req, res) => {
    res.json(db.data.users.map(db.pub).reverse());
  });

  app.post('/api/admin/users', ...superOnly, wrap(async (req, res) => {
    const b = req.body || {};
    const role = ROLES.includes(b.role) ? b.role : 'student';
    const name = clean(b.name);
    const email = clean(b.email).toLowerCase();
    if (!name || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'A valid name and email are required' });
    if (String(b.password || '').length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    if (db.findUser(email)) return res.status(400).json({ message: 'Email is already registered' });
    const user = {
      id: db.uid('u_'),
      name,
      email,
      password: await bcrypt.hash(String(b.password), 10),
      role,
      status: 'active',
      phone: clean(b.phone),
      department: clean(b.department),
      course: clean(b.course),
      year: clean(b.year),
      student_id: clean(b.student_id),
      position: clean(b.position),
      privileges: db.DEFAULT_PRIVS[role].slice(),
      created_at: db.now()
    };
    if (role === 'organization') {
      const orgName = clean(b.org_name);
      if (!orgName) return res.status(400).json({ message: 'Organization name is required' });
      user.org_id = findOrCreateOrg(orgName).id;
    }
    db.data.users.push(user);
    await db.save();
    db.log(req.user, 'user_create', email + ' as ' + role);
    res.status(201).json({ message: 'Account created', user: db.pub(user) });
  }));

  app.put('/api/admin/users/:id', ...superOnly, wrap(async (req, res) => {
    const u = db.data.users.find((x) => x.id === req.params.id);
    if (!u) return res.status(404).json({ message: 'User not found' });
    const b = req.body || {};
    if (b.name !== undefined && clean(b.name)) u.name = clean(b.name);
    if (b.role !== undefined && b.role !== u.role) {
      if (!ROLES.includes(b.role)) return res.status(400).json({ message: 'Invalid role' });
      if (u.id === req.user.id) return res.status(400).json({ message: 'You cannot change your own role' });
      u.role = b.role;
      u.privileges = db.DEFAULT_PRIVS[b.role].slice();
    }
    if (Array.isArray(b.privileges)) {
      u.privileges = b.privileges.filter((p) => db.ALL_PRIVS.includes(p));
      if (u.role === 'superadmin') u.privileges = db.ALL_PRIVS.slice();
    }
    await db.save();
    db.log(req.user, 'user_update', u.email + ' role=' + u.role + ' privileges=' + u.privileges.join('|'));
    res.json({ message: 'User updated', user: db.pub(u) });
  }));

  app.post('/api/admin/users/:id/status', ...superOnly, wrap(async (req, res) => {
    const u = db.data.users.find((x) => x.id === req.params.id);
    if (!u) return res.status(404).json({ message: 'User not found' });
    const status = req.body && req.body.status;
    if (!['active', 'suspended'].includes(status)) return res.status(400).json({ message: 'Invalid status' });
    if (u.id === req.user.id) return res.status(400).json({ message: 'You cannot change your own status' });
    u.status = status;
    await db.save();
    db.log(req.user, status === 'suspended' ? 'user_suspend' : 'user_restore', u.email);
    res.json({ message: status === 'suspended' ? 'Account suspended' : 'Account restored', user: db.pub(u) });
  }));

  app.post('/api/admin/users/:id/password', ...superOnly, wrap(async (req, res) => {
    const u = db.data.users.find((x) => x.id === req.params.id);
    if (!u) return res.status(404).json({ message: 'User not found' });
    const password = String((req.body && req.body.password) || '');
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    u.password = await bcrypt.hash(password, 10);
    await db.save();
    db.log(req.user, 'user_password_reset', u.email);
    res.json({ message: 'Password reset' });
  }));

  app.delete('/api/admin/users/:id', ...superOnly, wrap(async (req, res) => {
    const u = db.data.users.find((x) => x.id === req.params.id);
    if (!u) return res.status(404).json({ message: 'User not found' });
    if (u.id === req.user.id) return res.status(400).json({ message: 'You cannot delete your own account' });
    db.data.users = db.data.users.filter((x) => x.id !== u.id);
    db.data.registrations = db.data.registrations.filter((r) => r.student_id !== u.id);
    db.data.notifications = db.data.notifications.filter((n) => n.user_id !== u.id);
    await db.save();
    db.log(req.user, 'user_delete', u.email);
    res.json({ message: 'Account deleted' });
  }));

  app.get('/api/admin/orgs', ...superOnly, (req, res) => {
    res.json(db.data.orgs.map(orgView).reverse());
  });

  app.put('/api/admin/orgs/:id', ...superOnly, wrap(async (req, res) => {
    const o = db.data.orgs.find((x) => x.id === req.params.id);
    if (!o) return res.status(404).json({ message: 'Organization not found' });
    const b = req.body || {};
    if (b.name !== undefined && clean(b.name)) o.name = clean(b.name);
    if (b.status !== undefined) {
      if (!['accredited', 'pending', 'not_accredited'].includes(b.status)) return res.status(400).json({ message: 'Invalid status' });
      o.status = b.status;
    }
    if (b.suspended !== undefined) o.suspended = Boolean(b.suspended);
    if (b.accredited_until !== undefined) {
      const until = b.accredited_until ? new Date(b.accredited_until) : null;
      if (until && isNaN(until)) return res.status(400).json({ message: 'Invalid validity date' });
      o.accredited_until = until ? until.toISOString() : null;
      o.accreditation_expired = false;
    }
    if (b.subscription) {
      const expires = b.subscription.expires_at ? new Date(b.subscription.expires_at) : null;
      if (expires && isNaN(expires)) return res.status(400).json({ message: 'Invalid expiry date' });
      o.subscription = {
        plan: clean(b.subscription.plan) || 'Basic',
        status: b.subscription.status === 'active' ? 'active' : 'inactive',
        expires_at: expires ? expires.toISOString() : null
      };
    }
    db.sweepAccreditation();
    await db.save();
    db.log(req.user, 'org_update', o.name + ' status=' + o.status + ' suspended=' + o.suspended);
    res.json({ message: 'Organization updated', org: orgView(o) });
  }));

  app.delete('/api/admin/orgs/:id', ...superOnly, wrap(async (req, res) => {
    const o = db.data.orgs.find((x) => x.id === req.params.id);
    if (!o) return res.status(404).json({ message: 'Organization not found' });
    const eventIds = db.data.events.filter((e) => e.org_id === o.id).map((e) => e.id);
    db.data.registrations = db.data.registrations.filter((r) => !eventIds.includes(r.event_id));
    db.data.events = db.data.events.filter((e) => e.org_id !== o.id);
    db.data.reports = db.data.reports.filter((r) => r.org_id !== o.id);
    officersOf(o.id).forEach((u) => {
      u.status = 'suspended';
      u.org_id = null;
    });
    db.data.orgs = db.data.orgs.filter((x) => x.id !== o.id);
    await db.save();
    db.log(req.user, 'org_delete', o.name);
    res.json({ message: 'Organization deleted' });
  }));

  app.post('/api/admin/users/:id/credits', ...superOnly, wrap(async (req, res) => {
    const u = db.data.users.find((x) => x.id === req.params.id);
    if (!u) return res.status(404).json({ message: 'User not found' });
    if (!['student', 'organization'].includes(u.role)) return res.status(400).json({ message: 'Edit credits apply to students and organization officers only' });
    const b = req.body || {};
    const n = Math.floor(Number(b.credits));
    if (!(n >= 0 && n <= 100)) return res.status(400).json({ message: 'Enter a number of credits from 0 to 100' });
    const set = b.mode === 'set';
    if (set) {
      u.edit_credits = n;
    } else {
      if (n < 1) return res.status(400).json({ message: 'Enter at least 1 credit to add' });
      u.edit_credits = (u.edit_credits || 0) + n;
    }
    await db.save();
    db.log(req.user, 'edit_credits', u.email + (set ? ' set to ' : ' +') + n + ' (balance ' + u.edit_credits + ')');
    db.notify(u.id, 'Edit credits', set
      ? 'SAO set your edit credits to ' + u.edit_credits + '.'
      : 'SAO gave you ' + n + ' edit credit(s) to update your information. Each saved change uses one credit. Balance: ' + u.edit_credits + '.');
    res.json({ message: 'Edit credits saved', user: db.pub(u) });
  }));

  app.put('/api/admin/profile-window', ...superOnly, wrap(async (req, res) => {
    const b = req.body || {};
    const start = b.start ? new Date(b.start) : null;
    const end = b.end ? new Date(b.end) : null;
    if ((start && isNaN(start)) || (end && isNaN(end))) return res.status(400).json({ message: 'Invalid date' });
    if (Boolean(start) !== Boolean(end)) return res.status(400).json({ message: 'Set both the opening and closing date, or clear both' });
    if (start && end <= start) return res.status(400).json({ message: 'The closing date must be after the opening date' });
    db.data.settings.profile_window = { start: start ? start.toISOString() : '', end: end ? end.toISOString() : '' };
    await db.save();
    const fmt = (d) => d.toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
    db.log(req.user, 'profile_window', start ? fmt(start) + ' to ' + fmt(end) : 'cleared');
    if (start) {
      db.data.users.filter((u) => u.role === 'student' && u.status !== 'suspended').forEach((u) => {
        db.notify(u.id, 'Profile update period', 'You can update your information from ' + fmt(start) + ' until ' + fmt(end) + '.');
      });
    }
    res.json({ message: start ? 'Update period saved' : 'Update period cleared', profile_window: db.data.settings.profile_window });
  }));

  const canMessage = [authenticate, (req, res, next) =>
    ['verify_accounts', 'manage_subscriptions', 'approve_events'].some((p) => db.hasPriv(req.user, p))
      ? next()
      : res.status(403).json({ message: 'Not allowed' })];

  app.post('/api/messages', ...canMessage, wrap(async (req, res) => {
    const b = req.body || {};
    const message = clean(b.message);
    const subject = clean(b.subject) || 'Message from SAO';
    if (!message) return res.status(400).json({ message: 'Write a message first' });
    if (message.length > 1000) return res.status(400).json({ message: 'Message is too long (max 1000 characters)' });
    let targets = [];
    let name = '';
    if (b.target === 'org') {
      const o = db.data.orgs.find((x) => x.id === b.id);
      if (!o) return res.status(404).json({ message: 'Organization not found' });
      targets = officersOf(o.id);
      name = o.name;
      if (!targets.length) return res.status(400).json({ message: 'This organization has no officers to message' });
    } else {
      const u = db.data.users.find((x) => x.id === b.id);
      if (!u) return res.status(404).json({ message: 'User not found' });
      targets = [u];
      name = u.name;
    }
    targets.forEach((u) => db.notify(u.id, subject, message + '\n\n— ' + req.user.name + ', SAO'));
    db.log(req.user, 'message_sent', name + ': ' + subject);
    res.json({ message: 'Message sent to ' + name });
  }));

  app.get('/api/admin/logs', ...superOnly, (req, res) => {
    const q = clean(req.query.q).toLowerCase();
    const limit = Math.min(Number(req.query.limit) || 200, 1000);
    const out = db.data.logs
      .filter((l) => !q || (l.actor_name + ' ' + l.action + ' ' + l.detail).toLowerCase().includes(q))
      .slice(-limit)
      .reverse();
    res.json(out);
  });
};

module.exports = { mount };