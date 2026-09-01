const API_BASE    = window.EMBS_API_BASE;
const SESSION_KEY = 'embs_admin_auth';
const TOKEN_KEY   = 'embs_admin_token';

// ── DOM refs ─────────────────────────────────────────────
const form     = document.getElementById('loginForm');
const pwInput  = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const errorBox = document.getElementById('loginError');
const togglePw = document.getElementById('togglePw');
const eyeIcon  = document.getElementById('eyeIcon');

// ── Toggle password visibility ───────────────────────────
togglePw.addEventListener('click', () => {
  const isText = pwInput.type === 'text';
  pwInput.type = isText ? 'password' : 'text';
  eyeIcon.innerHTML = isText
    ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/>'
    : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>';
});

// ── Hide error on input ──────────────────────────────────
pwInput.addEventListener('input', () => errorBox.classList.remove('visible'));

// ── Login submit ─────────────────────────────────────────
form.addEventListener('submit', async function (e) {
  e.preventDefault();

  const pw = pwInput.value.trim();
  if (!pw) return;

  loginBtn.disabled = true;
  loginBtn.classList.add('loading');
  errorBox.classList.remove('visible');

  try {
    const res  = await fetch(`${API_BASE}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: 'admin@ieeoembs.com', password: pw }),
    });

    const data = await res.json();

    if (res.ok && data.data && data.data.token) {
      localStorage.setItem(SESSION_KEY, 'true');
      localStorage.setItem(TOKEN_KEY, data.data.token);
      document.getElementById('loginErrorText').textContent = 'Logged in successfully';
      errorBox.classList.add('visible');
      setTimeout(() => { location.href = 'dashboard.html'; }, 300);
    } else {
      throw new Error(data.message || 'Invalid password');
    }
  } catch (err) {
    loginBtn.disabled = false;
    loginBtn.classList.remove('loading');
    document.getElementById('loginErrorText').textContent = err.message || 'Incorrect password. Please try again.';
    errorBox.classList.add('visible');
    pwInput.value = '';
    pwInput.focus();
  }
});
