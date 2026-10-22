const API = ''; 
const el = (id) => document.getElementById(id);

const post = async (path, body) => {
  let res;
  try {
    res = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch (e) {
    throw new Error('Cannot reach the server');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
};

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
const options = (list, placeholder) =>
  '<option value="">' + placeholder + '</option>' + list.map((x) => '<option value="' + x + '">' + x + '</option>').join('');
el('regDept').innerHTML = options(DEPARTMENTS, 'Select department');
el('regYear').innerHTML = options(YEARS, 'Select year level');
el('regMember').innerHTML = '<option value="">None</option>';
fetch(API + '/api/public/orgs')
  .then((r) => r.json())
  .then((list) => {
    el('regMember').innerHTML = '<option value="">None</option>' + list.map((o) => '<option value="' + o.id + '">' + o.name.replace(/</g, '&lt;') + '</option>').join('');
  })
  .catch(() => {});
el('regOrgDept').innerHTML = options(DEPARTMENTS, 'University-wide (no specific department)');

const show = (id) => {
  ['loginBox', 'registerBox', 'forgotBox'].forEach((b) => el(b).classList.toggle('hidden', b !== id));
};

const note = (id, text, type) => {
  const m = el(id);
  m.textContent = text;
  m.className = 'msg ' + (type || 'err') + (text ? '' : ' hidden');
};

document.querySelectorAll('[data-show]').forEach((a) => {
  a.onclick = () => show(a.dataset.show);
});
if (location.search.includes('register=true')) show('registerBox');

const syncRole = () => {
  const org = el('regRole').value === 'organization';
  el('studentFields').classList.toggle('hidden', org);
  el('orgFields').classList.toggle('hidden', !org);
};
el('regRole').onchange = syncRole;
syncRole();

const submit = async (form, fn) => {
  const btn = form.querySelector('button');
  btn.disabled = true;
  try {
    await fn();
  } finally {
    btn.disabled = false;
  }
};

el('loginForm').onsubmit = (e) => {
  e.preventDefault();
  submit(e.target, async () => {
    note('loginMsg', '');
    try {
      const d = await post('/api/login', { email: el('loginEmail').value, password: el('loginPassword').value });
      localStorage.setItem('token', d.token);
      localStorage.setItem('user', JSON.stringify(d.user));
      location.href = d.redirectUrl.replace(/^\//, '');
    } catch (err) {
      note('loginMsg', err.message);
    }
  });
};

el('registerForm').onsubmit = (e) => {
  e.preventDefault();
  submit(e.target, async () => {
    note('registerMsg', '');
    const role = el('regRole').value;
    const body = { role, name: el('regName').value, email: el('regEmail').value, password: el('regPassword').value };
    if (role === 'student') {
      Object.assign(body, { student_id: el('regSid').value, department: el('regDept').value, course: el('regCourse').value, year: el('regYear').value, member_org_id: el('regMember').value });
    } else {
      Object.assign(body, { org_name: el('regOrg').value, org_department: el('regOrgDept').value, position: el('regPos').value });
    }
    try {
      const d = await post('/api/register', body);
      e.target.reset();
      syncRole();
      show('loginBox');
      note('loginMsg', d.message, 'ok');
    } catch (err) {
      note('registerMsg', err.message);
    }
  });
};

el('forgotForm').onsubmit = (e) => {
  e.preventDefault();
  submit(e.target, async () => {
    try {
      const d = await post('/api/auth/forgot', { email: el('forgotEmail').value });
      note('forgotMsg', d.dev_code ? d.message + ' (Email is not configured. Dev code: ' + d.dev_code + ')' : d.message, 'ok');
      el('resetForm').classList.remove('hidden');
    } catch (err) {
      note('forgotMsg', err.message);
    }
  });
};

el('resetForm').onsubmit = (e) => {
  e.preventDefault();
  submit(e.target, async () => {
    try {
      const d = await post('/api/auth/reset', { email: el('forgotEmail').value, code: el('resetCode').value, password: el('resetPassword').value });
      e.target.reset();
      el('resetForm').classList.add('hidden');
      show('loginBox');
      note('loginMsg', d.message, 'ok');
    } catch (err) {
      note('forgotMsg', err.message);
    }
  });
};

const saved = JSON.parse(localStorage.getItem('user') || 'null');
const dest = { student: 'student-dashboard.html', organization: 'org-dashboard.html', personnel: 'personnel-dashboard.html', superadmin: 'superadmin-dashboard.html' };
if (localStorage.getItem('token') && saved && dest[saved.role]) location.replace(dest[saved.role]);