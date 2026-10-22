const crypto = require('crypto');
const QRCode = require('qrcode');
const db = require('./db');
const { authenticate, requireRole, requirePriv, wrap, clean } = require('./auth');
const pdf = require('./pdf');

const toIso = (v) => {
  const d = new Date(v);
  return isNaN(d) ? null : d.toISOString();
};

const ATTEND_WINDOW_MS = 5 * 60 * 1000;

const distanceM = (a, b) => {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

const geoIn = (b) => {
  if (!b || b.lat === undefined || b.lng === undefined || b.lat === null || b.lng === null || b.lat === '' || b.lng === '') return null;
  const lat = Number(b.lat);
  const lng = Number(b.lng);
  return isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
};

const phaseOf = (e) => {
  if (e.status !== 'published') return e.status;
  const t = Date.now();
  if (t > new Date(e.ends_at)) return 'past';
  if (t >= new Date(e.starts_at)) return 'live';
  return 'upcoming';
};

const activeRegs = (eventId) => db.data.registrations.filter((r) => r.event_id === eventId && r.status === 'reserved');
const orgOf = (e) => db.data.orgs.find((o) => o.id === e.org_id);
const userById = (id) => db.data.users.find((u) => u.id === id);

const schoolYear = (iso) => {
  const d = new Date(iso);
  const y = d.getFullYear();
  return d.getMonth() >= 5 ? y + '-' + (y + 1) : (y - 1) + '-' + y;
};

const eligible = (e, u) => {
  if (e.audience) {
    const a = e.audience;
    if (a.department !== 'All' && a.department !== u.department) return false;
    if (a.year !== 'All' && String(a.year) !== String(u.year)) return false;
    if (a.org_id && a.org_id !== u.member_org_id) return false;
    return true;
  }
  const list = String(e.eligibility || 'All').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!list.length || list.includes('all')) return true;
  return list.includes(String(u.department || '').toLowerCase());
};

const feeOf = (e) => {
  const s = db.data.settings;
  return e.is_paid ? Math.round(Number(e.ticket_price) * Number(e.seat_limit) * Number(s.paid_rate)) / 100 : Number(s.free_fee);
};

const present = (e, user) => {
  const out = { ...e };
  delete out.qr_token;
  const taken = activeRegs(e.id).length;
  out.phase = phaseOf(e);
  out.seats_taken = taken;
  out.seats_left = Math.max(e.seat_limit - taken, 0);
  const org = orgOf(e);
  out.org_name = org ? org.name : '';
  out.org_department = org ? org.department || '' : '';
  if (user.role !== 'student') out.fee_due = feeOf(e);
  if (user.role === 'student') {
    delete out.payment;
    delete out.geo;
    out.for_dept = e.audience
      ? e.audience.department === user.department
      : String(e.eligibility || 'All').split(',').map((x) => x.trim().toLowerCase()).includes(String(user.department || '').toLowerCase());
    out.my_reg = db.data.registrations.find((r) => r.event_id === e.id && r.student_id === user.id && r.status === 'reserved') || null;
    out.eligible = eligible(e, user);
  }
  return out;
};

const orgGate = (u) => {
  const org = db.data.orgs.find((o) => o.id === u.org_id);
  if (!org) return 'No organization is linked to this account';
  if (org.suspended) return 'Your organization is suspended';
  if (org.status !== 'accredited') return org.accreditation_expired ? 'Your organization accreditation has expired. SAO needs to check and approve it again.' : 'Your organization has not been verified by SAO yet';
  return null;
};

const audienceOf = (b, org) => {
  const department = org && org.department ? org.department : clean(b.aud_department) || 'All';
  const year = clean(b.aud_year) || 'All';
  const orgId = clean(b.aud_org);
  if (department !== 'All' && !db.DEPARTMENTS.includes(department)) return { error: 'Select a valid department for the audience' };
  if (year !== 'All' && !db.YEARS.includes(year)) return { error: 'Select a valid year level for the audience' };
  let target = null;
  if (orgId) {
    target = db.data.orgs.find((o) => o.id === orgId && o.status === 'accredited');
    if (!target) return { error: 'Select a valid organization for the audience' };
  }
  const parts = [];
  if (department !== 'All') parts.push(department);
  if (year !== 'All') parts.push('Year ' + year);
  if (target) parts.push(target.name + ' members');
  return { audience: { department, year, org_id: target ? target.id : '' }, eligibility: parts.join(' · ') || 'All' };
};

const approvers = () =>
  db.data.users.filter((u) => u.status === 'active' && (u.role === 'personnel' || u.role === 'superadmin') && db.hasPriv(u, 'approve_events'));

const officersOf = (e) => db.data.users.filter((u) => u.org_id === e.org_id && u.role === 'organization');

const parseEvent = (b, org) => {
  const title = clean(b.title);
  const venue = clean(b.venue);
  const starts = toIso(b.starts_at);
  const ends = toIso(b.ends_at);
  const limit = Math.floor(Number(b.seat_limit));
  const aud = audienceOf(b, org);
  const paid = Boolean(b.is_paid);
  const price = paid ? Math.round(Number(b.ticket_price) * 100) / 100 : 0;
  const radius = Math.round(Number(b.radius_m || 50));
  const geo = geoIn({ lat: b.geo_lat, lng: b.geo_lng });
  if (!title || !venue) return { error: 'Title and venue are required' };
  if (!starts || !ends) return { error: 'Valid start and end date and time are required' };
  if (new Date(ends) <= new Date(starts)) return { error: 'End time must be after the start time' };
  if (!(limit >= 1 && limit <= 100000)) return { error: 'Seat limit must be a positive number' };
  if (aud.error) return { error: aud.error };
  if (paid && !(price > 0 && price <= 100000)) return { error: 'Enter a ticket price greater than zero' };
  if (!(radius >= 5 && radius <= 1000)) return { error: 'Attendance radius must be between 5 and 1000 meters' };
  return {
    value: {
      title,
      venue,
      description: clean(b.description),
      category: clean(b.category) || 'General',
      starts_at: starts,
      ends_at: ends,
      seat_limit: limit,
      eligibility: aud.eligibility,
      audience: aud.audience,
      is_paid: paid,
      ticket_price: price,
      radius_m: radius,
      geo
    }
  };
};

const findEvent = (req, res, mode) => {
  const e = db.data.events.find((x) => x.id === req.params.id);
  if (!e) {
    res.status(404).json({ message: 'Event not found' });
    return null;
  }
  const u = req.user;
  let ok = false;
  if (mode === 'own') ok = u.role === 'organization' && Boolean(u.org_id) && e.org_id === u.org_id;
  else if (u.role === 'organization') ok = e.org_id === u.org_id;
  else if (u.role === 'superadmin') ok = true;
  else if (u.role === 'personnel') ok = db.hasPriv(u, 'monitor_events');
  if (!ok) {
    res.status(403).json({ message: 'You do not have access to this event' });
    return null;
  }
  return e;
};

const attendanceRows = (e) =>
  activeRegs(e.id)
    .sort((a, b) => a.seat_no - b.seat_no)
    .map((r) => {
      const s = userById(r.student_id) || {};
      return {
        id: r.id,
        seat_no: r.seat_no,
        name: s.name || 'Unknown',
        email: s.email || '',
        student_id: s.student_id || '',
        department: s.department || '',
        course: s.course || '',
        year: s.year || '',
        reserved_at: r.reserved_at,
        attended: Boolean(r.attended),
        attended_at: r.attended_at || null,
        left: Boolean(r.left_at),
        left_at: r.left_at || null
      };
    });

const statsOf = (rows) => {
  const presentCount = rows.filter((r) => r.attended).length;
  return {
    registered: rows.length,
    present: presentCount,
    pending: rows.length - presentCount,
    rate: rows.length ? Math.round((presentCount / rows.length) * 100) : 0
  };
};

const csvCell = (v) => {
  const s = String(v === undefined || v === null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

const canSeeReport = (u, r) => {
  if (u.role === 'superadmin') return true;
  if (u.role === 'personnel') return db.hasPriv(u, 'view_reports');
  if (u.role === 'organization') return Boolean(u.org_id) && r.org_id === u.org_id;
  return false;
};

const mount = (app) => {
  const orgAccess = [authenticate, requireRole('organization'), requirePriv('manage_events')];

  app.get('/api/events', authenticate, wrap((req, res) => {
    const u = req.user;
    let list = db.data.events;
    if (u.role === 'student') list = list.filter((e) => e.status === 'published');
    else if (u.role === 'organization') list = list.filter((e) => u.org_id && e.org_id === u.org_id);
    else if (u.role === 'personnel' && !db.hasPriv(u, 'monitor_events')) {
      return res.status(403).json({ message: 'Missing privilege: monitor_events' });
    }
    const out = list.map((e) => present(e, u));
    if (u.role === 'student') {
      const rank = (e) => (e.phase === 'past' ? -10 : 0) + (e.eligible ? 2 : 0) + (e.eligible && String(e.eligibility).toLowerCase() !== 'all' ? 1 : 0);
      out.sort((a, b) => rank(b) - rank(a) || new Date(a.starts_at) - new Date(b.starts_at));
    } else {
      out.sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at));
    }
    res.json(out);
  }));

  app.post('/api/events', ...orgAccess, wrap((req, res) => {
    const blocked = orgGate(req.user);
    if (blocked) return res.status(403).json({ message: blocked });
    const org = db.data.orgs.find((o) => o.id === req.user.org_id);
    const parsed = parseEvent(req.body || {}, org);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const e = {
      id: db.uid('e_'),
      org_id: req.user.org_id,
      created_by: req.user.id,
      ...parsed.value,
      status: 'draft',
      registration: 'closed',
      qr_token: crypto.randomBytes(12).toString('hex'),
      created_at: db.now()
    };
    db.data.events.push(e);
    db.save();
    db.log(req.user, 'event_create', e.title + ' (draft)');
    res.status(201).json(present(e, req.user));
  }));

  app.put('/api/events/:id', ...orgAccess, wrap((req, res) => {
    const e = findEvent(req, res, 'own');
    if (!e) return;
    const blocked = orgGate(req.user);
    if (blocked) return res.status(403).json({ message: blocked });
    if (e.status === 'pending') return res.status(400).json({ message: 'Wait for the SAO decision before editing this event' });
    const parsed = parseEvent(req.body || {}, orgOf(e));
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    if (e.status === 'published') {
      parsed.value.is_paid = e.is_paid;
      parsed.value.ticket_price = e.ticket_price;
      if (e.payment && parsed.value.seat_limit > e.payment.seat_limit) {
        return res.status(400).json({ message: 'Seat limit cannot exceed the ' + e.payment.seat_limit + ' seats covered by your payment' });
      }
    }
    const taken = activeRegs(e.id).length;
    if (parsed.value.seat_limit < taken) {
      return res.status(400).json({ message: 'Seat limit cannot be lower than the ' + taken + ' seats already reserved' });
    }
    Object.assign(e, parsed.value);
    db.save();
    db.log(req.user, 'event_edit', e.title);
    res.json(present(e, req.user));
  }));

  app.post('/api/events/:id/submit', ...orgAccess, wrap((req, res) => {
    const e = findEvent(req, res, 'own');
    if (!e) return;
    const blocked = orgGate(req.user);
    if (blocked) return res.status(403).json({ message: blocked });
    if (!['draft', 'rejected'].includes(e.status)) return res.status(400).json({ message: 'This event cannot be submitted' });
    if (new Date(e.ends_at) < new Date()) return res.status(400).json({ message: 'This event has already ended' });
    const st = db.data.settings;
    if (!st.wallet_qr) return res.status(400).json({ message: 'SAO has not set up the payment wallet yet. Please try again later.' });
    const reference = clean(req.body && req.body.reference);
    if (reference.length < 4) return res.status(400).json({ message: 'Enter the payment reference number' });
    const amount = feeOf(e);
    e.payment = {
      amount,
      reference,
      payer: clean(req.body && req.body.payer),
      is_paid: e.is_paid,
      seat_limit: e.seat_limit,
      rate: e.is_paid ? Number(st.paid_rate) : Number(st.free_fee),
      status: 'submitted',
      submitted_at: db.now()
    };
    e.status = 'pending';
    e.registration = 'closed';
    e.approval_note = '';
    db.save();
    db.log(req.user, 'event_submit', e.title + ' fee ' + amount + ' ref ' + reference);
    const org = orgOf(e);
    approvers().forEach((a) => db.notify(a.id, 'Event awaiting approval', '"' + e.title + '" from ' + (org ? org.name : 'an organization') + ' paid ' + amount + ' (ref ' + reference + ') and needs SAO approval.'));
    res.json(present(e, req.user));
  }));

  app.get('/api/settings', authenticate, (req, res) => {
    if (req.user.role === 'student') return res.status(403).json({ message: 'Not allowed' });
    res.json(db.data.settings);
  });

  app.put('/api/settings', authenticate, requirePriv('manage_subscriptions'), wrap((req, res) => {
    const b = req.body || {};
    const st = db.data.settings;
    if (b.paid_rate !== undefined) {
      const v = Number(b.paid_rate);
      if (!(v >= 0 && v <= 100)) return res.status(400).json({ message: 'Rate must be between 0 and 100' });
      st.paid_rate = v;
    }
    if (b.free_fee !== undefined) {
      const v = Number(b.free_fee);
      if (!(v >= 0 && v <= 1000000)) return res.status(400).json({ message: 'Enter a valid fee' });
      st.free_fee = v;
    }
    if (b.wallet_name !== undefined) st.wallet_name = clean(b.wallet_name);
    if (b.wallet_number !== undefined) st.wallet_number = clean(b.wallet_number);
    if (b.wallet_qr !== undefined) {
      const q = String(b.wallet_qr);
      if (q && (!/^data:image\/(png|jpeg|jpg|webp|gif);base64,/.test(q) || q.length > 3000000)) {
        return res.status(400).json({ message: 'Upload a valid QR image under 2 MB' });
      }
      st.wallet_qr = q;
    }
    db.save();
    db.log(req.user, 'settings_update', 'rate ' + st.paid_rate + '% free ' + st.free_fee);
    res.json(st);
  }));

  app.get('/api/payments', authenticate, requirePriv('manage_subscriptions'), wrap((req, res) => {
    const list = db.data.events
      .filter((e) => e.payment)
      .map((e) => ({
        id: e.id,
        title: e.title,
        org_id: e.org_id,
        org_name: (orgOf(e) || {}).name || '',
        is_paid: e.is_paid,
        ticket_price: e.ticket_price,
        seat_limit: e.payment.seat_limit,
        amount: e.payment.amount,
        reference: e.payment.reference,
        payer: e.payment.payer,
        submitted_at: e.payment.submitted_at,
        payment_status: e.payment.status,
        event_status: e.status
      }))
      .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
    res.json(list);
  }));

  app.get('/api/approvals', authenticate, requirePriv('approve_events'), wrap((req, res) => {
    const list = db.data.events
      .filter((e) => ['pending', 'published', 'rejected'].includes(e.status))
      .map((e) => present(e, req.user))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    res.json(list);
  }));

  app.post('/api/events/:id/approval', authenticate, requirePriv('approve_events'), wrap((req, res) => {
    const e = db.data.events.find((x) => x.id === req.params.id);
    if (!e) return res.status(404).json({ message: 'Event not found' });
    if (e.status !== 'pending') return res.status(400).json({ message: 'This event is not waiting for approval' });
    const decision = req.body && req.body.decision;
    const note = clean(req.body && req.body.note);
    if (!['approve', 'reject'].includes(decision)) return res.status(400).json({ message: 'Invalid decision' });
    if (decision === 'reject' && !note) return res.status(400).json({ message: 'Provide a reason for disapproval' });
    if (e.payment) e.payment.status = decision === 'approve' ? 'verified' : 'rejected';
    if (decision === 'approve') {
      e.status = 'published';
      e.registration = 'open';
      e.approval_note = '';
    } else {
      e.status = 'rejected';
      e.registration = 'closed';
      e.approval_note = note;
    }
    e.decided_by = req.user.id;
    e.decided_at = db.now();
    db.save();
    db.log(req.user, 'event_' + (decision === 'approve' ? 'approved' : 'disapproved'), e.title);
    const payNote = e.payment ? (decision === 'approve' ? ' Your payment (ref ' + e.payment.reference + ') was verified.' : ' Your payment (ref ' + e.payment.reference + ') was not verified.') : '';
    const msg = decision === 'approve'
      ? db.withNote('"' + e.title + '" was approved by SAO and is now published.' + payNote, note, req.user)
      : '"' + e.title + '" was disapproved by SAO.' + payNote + ' Reason: ' + note;
    officersOf(e).forEach((u) => db.notify(u.id, decision === 'approve' ? 'Event approved' : 'Event disapproved', msg));
    res.json({ message: decision === 'approve' ? 'Event approved' : 'Event disapproved', event: present(e, req.user) });
  }));

  app.post('/api/events/:id/registration', ...orgAccess, wrap((req, res) => {
    const e = findEvent(req, res, 'own');
    if (!e) return;
    if (e.status !== 'published') return res.status(400).json({ message: 'Publish the event first' });
    e.registration = req.body && req.body.open ? 'open' : 'closed';
    db.save();
    db.log(req.user, 'registration_' + e.registration, e.title);
    res.json(present(e, req.user));
  }));

  app.delete('/api/events/:id', ...orgAccess, wrap((req, res) => {
    const e = findEvent(req, res, 'own');
    if (!e) return;
    if (e.status !== 'draft' && activeRegs(e.id).length) {
      return res.status(400).json({ message: 'Events with registrations cannot be deleted' });
    }
    db.data.events = db.data.events.filter((x) => x.id !== e.id);
    db.data.registrations = db.data.registrations.filter((r) => r.event_id !== e.id);
    db.save();
    db.log(req.user, 'event_delete', e.title);
    res.json({ message: 'Event deleted' });
  }));

  app.get('/api/events/:id/registrations', authenticate, wrap((req, res) => {
    const e = findEvent(req, res, 'view');
    if (!e) return;
    const rows = attendanceRows(e);
    res.json({ event: present(e, req.user), rows, stats: statsOf(rows) });
  }));

  app.get('/api/events/:id/qr', ...orgAccess, wrap(async (req, res) => {
    const e = findEvent(req, res, 'own');
    if (!e) return;
    if (e.status !== 'published') return res.status(400).json({ message: 'Publish the event to display its QR code' });
    if (!e.geo) return res.status(400).json({ message: 'Set the venue point and check-in radius before displaying the QR code' });
    const code = 'PRESENTA|' + e.id + '|' + e.qr_token;
    const image = await QRCode.toDataURL(code, { width: 360, margin: 2 });
    res.json({ code, image });
  }));

  app.post('/api/events/:id/register', authenticate, requireRole('student'), wrap((req, res) => {
    const e = db.data.events.find((x) => x.id === req.params.id && x.status === 'published');
    const u = req.user;
    if (!e) return res.status(404).json({ message: 'Event not found' });
    if (phaseOf(e) === 'past') return res.status(400).json({ message: 'This event has already ended' });
    if (e.registration !== 'open') return res.status(400).json({ message: 'Registration is closed for this event' });
    if (!eligible(e, u)) return res.status(403).json({ message: 'This event is limited to: ' + e.eligibility });
    const regs = activeRegs(e.id);
    if (regs.some((r) => r.student_id === u.id)) return res.status(409).json({ message: 'You already have a seat for this event' });
    if (regs.length >= e.seat_limit) return res.status(409).json({ message: 'No seats left for this event' });
    const used = new Set(regs.map((r) => r.seat_no));
    let seat = 1;
    while (used.has(seat)) seat += 1;
    const reg = {
      id: db.uid('r_'),
      event_id: e.id,
      student_id: u.id,
      seat_no: seat,
      status: 'reserved',
      reserved_at: db.now(),
      attended: false
    };
    db.data.registrations.push(reg);
    db.save();
    db.log(u, 'seat_reserve', e.title + ' seat ' + seat);
    db.notify(u.id, 'Seat confirmed', 'Seat ' + seat + ' is reserved for "' + e.title + '" at ' + e.venue + '.');
    res.status(201).json({ message: 'Seat ' + seat + ' confirmed', registration: reg });
  }));

  app.delete('/api/events/:id/register', authenticate, requireRole('student'), wrap((req, res) => {
    const e = db.data.events.find((x) => x.id === req.params.id);
    const reg = db.data.registrations.find((r) => r.event_id === req.params.id && r.student_id === req.user.id && r.status === 'reserved');
    if (!e || !reg) return res.status(404).json({ message: 'No seat found for this event' });
    if (reg.attended) return res.status(400).json({ message: 'Attendance is already recorded' });
    if (phaseOf(e) !== 'upcoming') return res.status(400).json({ message: 'You cannot cancel after the event has started' });
    reg.status = 'cancelled';
    reg.cancelled_at = db.now();
    db.save();
    db.log(req.user, 'seat_cancel', e.title);
    db.notify(req.user.id, 'Seat cancelled', 'Your seat for "' + e.title + '" was cancelled.');
    res.json({ message: 'Seat cancelled' });
  }));

  app.get('/api/my/registrations', authenticate, requireRole('student'), wrap((req, res) => {
    const out = db.data.registrations
      .filter((r) => r.student_id === req.user.id)
      .map((r) => {
        const e = db.data.events.find((x) => x.id === r.event_id);
        return e ? { ...r, event: present(e, req.user) } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.reserved_at.localeCompare(a.reserved_at));
    res.json(out);
  }));

  app.post('/api/attendance/scan', authenticate, requireRole('student'), wrap((req, res) => {
    const reject = (message, status) => res.status(status || 400).json({ valid: false, message });
    const parts = clean(req.body && req.body.code).split('|');
    if (parts.length !== 3 || parts[0] !== 'PRESENTA') return reject('Invalid QR code');
    const e = db.data.events.find((x) => x.id === parts[1]);
    if (!e || e.status !== 'published' || e.qr_token !== parts[2]) return reject('Invalid QR code');
    const reg = db.data.registrations.find((r) => r.event_id === e.id && r.student_id === req.user.id && r.status === 'reserved');
    if (!reg) return reject('You have no reserved seat for this event', 403);
    if (reg.left_at) return reject('You left the venue within 5 minutes of checking in, so your attendance is not valid', 403);
    if (reg.attended) return reject('Attendance was already recorded', 409);
    const t = Date.now();
    if (t < new Date(e.starts_at) - 60 * 60 * 1000) return reject('Check-in opens one hour before the event starts');
    if (t > new Date(e.ends_at)) return reject('This event has already ended');
    if (!e.geo) return reject('The organizer has not set the venue location yet');
    const here = geoIn(req.body);
    if (!here) return reject('Your location is required to check in. Allow location access and try again.');
    const dist = distanceM(here, e.geo);
    if (dist > e.radius_m) return reject('You are about ' + Math.round(dist) + ' m from the venue. Check-in works within ' + e.radius_m + ' m.', 403);
    reg.attended = true;
    reg.attended_at = db.now();
    db.save();
    db.log(req.user, 'attendance', e.title);
    db.notify(req.user.id, 'Attendance recorded', 'You were checked in to "' + e.title + '". Stay within the venue for 5 minutes to keep your attendance.');
    res.json({ valid: true, message: 'Attendance recorded', attended_at: reg.attended_at, monitor_until: new Date(t + ATTEND_WINDOW_MS).toISOString(), event: { id: e.id, title: e.title, venue: e.venue } });
  }));

  app.post('/api/attendance/ping', authenticate, requireRole('student'), wrap((req, res) => {
    const e = db.data.events.find((x) => x.id === clean(req.body && req.body.event_id));
    const here = geoIn(req.body);
    const reg = e && db.data.registrations.find((r) => r.event_id === e.id && r.student_id === req.user.id && r.attended);
    if (!reg || !here || !e.geo) return res.json({ active: false });
    if (Date.now() - new Date(reg.attended_at) > ATTEND_WINDOW_MS) return res.json({ active: false });
    if (distanceM(here, e.geo) <= e.radius_m) return res.json({ active: true });
    reg.attended = false;
    reg.left_at = db.now();
    db.save();
    db.log(req.user, 'left_venue', e.title);
    const message = 'You left the venue within 5 minutes of checking in, so your attendance is not valid.';
    db.notify(req.user.id, 'Attendance not valid', message);
    res.json({ active: false, left: true, message });
  }));

  app.post('/api/events/:id/report', ...orgAccess, wrap((req, res) => {
    const e = findEvent(req, res, 'own');
    if (!e) return;
    const rows = attendanceRows(e).map((r) => ({ ...r, status: r.attended ? 'Present' : r.left ? 'Left the venue' : 'Absent' }));
    const stats = statsOf(rows);
    let rep = db.data.reports.find((r) => r.event_id === e.id);
    if (!rep) {
      rep = { id: db.uid('rp_'), event_id: e.id };
      db.data.reports.push(rep);
    }
    Object.assign(rep, {
      event_title: e.title,
      org_id: e.org_id,
      org_name: (orgOf(e) || {}).name || '',
      venue: e.venue,
      event_date: e.starts_at,
      school_year: schoolYear(e.starts_at),
      total_registered: stats.registered,
      total_present: stats.present,
      total_absent: stats.pending,
      rate: stats.rate,
      generated_at: db.now(),
      generated_by: req.user.name,
      rows
    });
    db.save();
    db.log(req.user, 'report_generate', e.title);
    res.json({ message: 'Attendance report saved', report: rep });
  }));

  app.get('/api/reports', authenticate, wrap((req, res) => {
    const u = req.user;
    if (!['organization', 'personnel', 'superadmin'].includes(u.role)) return res.status(403).json({ message: 'Not allowed' });
    if (u.role === 'personnel' && !db.hasPriv(u, 'view_reports')) return res.status(403).json({ message: 'Missing privilege: view_reports' });
    const year = clean(req.query.school_year);
    const list = db.data.reports
      .filter((r) => canSeeReport(u, r) && (!year || r.school_year === year))
      .sort((a, b) => b.event_date.localeCompare(a.event_date))
      .map(({ rows, ...rest }) => rest);
    res.json(list);
  }));

  app.get('/api/reports/:id', authenticate, wrap((req, res) => {
    const r = db.data.reports.find((x) => x.id === req.params.id);
    if (!r || !canSeeReport(req.user, r)) return res.status(404).json({ message: 'Report not found' });
    res.json(r);
  }));

  app.get('/api/reports/:id/pdf', authenticate, wrap((req, res) => {
    const r = db.data.reports.find((x) => x.id === req.params.id);
    if (!r || !canSeeReport(req.user, r)) return res.status(404).json({ message: 'Report not found' });
    pdf.send(r, res);
  }));

  app.get('/api/reports/:id/csv', authenticate, wrap((req, res) => {
    const r = db.data.reports.find((x) => x.id === req.params.id);
    if (!r || !canSeeReport(req.user, r)) return res.status(404).json({ message: 'Report not found' });
    const head = ['Seat', 'Name', 'Student ID', 'Department', 'Course', 'Year', 'Email', 'Status', 'Checked in at'];
    const lines = [
      ['Event', r.event_title].map(csvCell).join(','),
      ['Organization', r.org_name].map(csvCell).join(','),
      ['Venue', r.venue].map(csvCell).join(','),
      ['Date', r.event_date].map(csvCell).join(','),
      ['School year', r.school_year].map(csvCell).join(','),
      ['Registered', r.total_registered].map(csvCell).join(','),
      ['Present', r.total_present].map(csvCell).join(','),
      '',
      head.join(',')
    ];
    r.rows.forEach((x) => {
      lines.push([x.seat_no, x.name, x.student_id, x.department, x.course, x.year, x.email, x.status, x.attended_at || ''].map(csvCell).join(','));
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="attendance-report.csv"');
    res.send('\ufeff' + lines.join('\r\n'));
  }));
};

module.exports = { mount };