// Helper to show/hide messages
function showMsg(id, text, isError = true) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.classList.remove('hidden');
  if (isError) el.classList.add('err');
  else el.classList.remove('err');
}

function hideMsg(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

// UI Navigation (switching between Login, Register, Forgot boxes)
document.querySelectorAll('[data-show]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const targetId = link.getAttribute('data-show');
    ['loginBox', 'registerBox', 'forgotBox'].forEach(id => {
      document.getElementById(id).classList.add('hidden');
    });
    document.getElementById(targetId).classList.remove('hidden');
  });
});

// Toggle Student vs Org fields
const regRole = document.getElementById('regRole');
if (regRole) {
  regRole.addEventListener('change', (e) => {
    const isOrg = e.target.value === 'organization';
    document.getElementById('studentFields').classList.toggle('hidden', isOrg);
    document.getElementById('orgFields').classList.toggle('hidden', !isOrg);
  });
}

// --- 1. LOGIN FORM ---
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMsg('loginMsg');
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const btn = loginForm.querySelector('button');

    btn.disabled = true;
    btn.textContent = 'Logging in...';

    try {
      // Relative path for Vercel
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Login failed');

      // Save token and user
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Redirect based on role
      window.location.href = data.redirectUrl;

    } catch (err) {
      showMsg('loginMsg', err.message);
      btn.disabled = false;
      btn.textContent = 'Log in';
    }
  });
}

// --- 2. REGISTER FORM ---
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMsg('registerMsg');
    const btn = registerForm.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Signing up...';

    const role = document.getElementById('regRole').value;
    
    // Build payload based on role
    const payload = {
      role: role,
      name: document.getElementById('regName').value,
      email: document.getElementById('regEmail').value,
      password: document.getElementById('regPassword').value
    };

    if (role === 'student') {
      payload.student_id = document.getElementById('regSid').value;
      payload.department = document.getElementById('regDept').value;
      payload.course = document.getElementById('regCourse').value;
      payload.year = document.getElementById('regYear').value;
      payload.member_org_id = document.getElementById('regMember').value;
    } else {
      payload.org_name = document.getElementById('regOrg').value;
      payload.org_department = document.getElementById('regOrgDept').value;
      payload.position = document.getElementById('regPos').value;
    }

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Registration failed');

      // Show success and switch to login
      alert('Registered successfully! Your account is waiting for SAO verification.');
      document.querySelector('[data-show="loginBox"]').click();
      loginForm.reset();
      
    } catch (err) {
      showMsg('registerMsg', err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign up';
    }
  });
}

// --- 3. FORGOT PASSWORD FORM ---
const forgotForm = document.getElementById('forgotForm');
if (forgotForm) {
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMsg('forgotMsg');
    const btn = forgotForm.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
      const email = document.getElementById('forgotEmail').value;
      const res = await fetch('/api/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send code');

      showMsg('forgotMsg', data.message, false);
      document.getElementById('resetForm').classList.remove('hidden');
      
    } catch (err) {
      showMsg('forgotMsg', err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send code';
    }
  });
}

// --- 4. RESET PASSWORD FORM ---
const resetForm = document.getElementById('resetForm');
if (resetForm) {
  resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMsg('forgotMsg');
    const btn = resetForm.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Updating...';

    try {
      const email = document.getElementById('forgotEmail').value;
      const code = document.getElementById('resetCode').value;
      const password = document.getElementById('resetPassword').value;

      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, password })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to reset password');

      alert('Password updated! You can now log in.');
      document.querySelector('[data-show="loginBox"]').click();
      
    } catch (err) {
      showMsg('forgotMsg', err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Update password';
    }
  });
}