/* ── Sidebar toggle ── */
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebarOverlay = document.getElementById('sidebarOverlay');

sidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('open');
  sidebarOverlay.classList.toggle('active');
});
sidebarOverlay.addEventListener('click', () => {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('active');
});

/* ── Profile picture upload ── */
const uploadPicBtn = document.getElementById('uploadPicBtn');
const profilePicInput = document.getElementById('profilePicInput');
const profileAvatarImg = document.getElementById('profileAvatarImg');
const profileAvatarInitial = document.getElementById('profileAvatarInitial');

uploadPicBtn.addEventListener('click', () => profilePicInput.click());

profilePicInput.addEventListener('change', () => {
  const file = profilePicInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    profileAvatarImg.src = e.target.result;
    profileAvatarImg.style.display = 'block';
    profileAvatarInitial.style.display = 'none';
  };
  reader.readAsDataURL(file);
});

/* ── Sync display name as user types ── */
const profileNameInput = document.getElementById('profileName');
const profileDisplayName = document.getElementById('profileDisplayName');
const profileAvatarInitialEl = document.getElementById('profileAvatarInitial');

profileNameInput.addEventListener('input', () => {
  const val = profileNameInput.value.trim();
  profileDisplayName.textContent = val || 'Admin';
  if (profileAvatarImg.style.display === 'none') {
    profileAvatarInitialEl.textContent = val.charAt(0).toUpperCase() || 'A';
  }
});

/* ── Save Changes ── */
document.getElementById('saveProfileBtn').addEventListener('click', () => {
  showToast('Profile saved successfully!');
});

/* ── Toast helper ── */
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

/* ── Show/Hide password toggles ── */
document.querySelectorAll('.pwd-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    btn.querySelector('.eye-show').style.display = isHidden ? 'none' : '';
    btn.querySelector('.eye-hide').style.display = isHidden ? '' : 'none';
  });
});

/* ── Password strength ── */
const newPwdInput = document.getElementById('newPwd');
const strengthWrap = document.getElementById('pwdStrengthWrap');
const strengthLabel = document.getElementById('pwdStrengthLabel');
const bars = [document.getElementById('bar1'), document.getElementById('bar2'),
              document.getElementById('bar3'), document.getElementById('bar4')];

const LEVELS = [
  { label: 'Weak',   cls: 'weak',   fill: 1 },
  { label: 'Fair',   cls: 'fair',   fill: 2 },
  { label: 'Good',   cls: 'good',   fill: 3 },
  { label: 'Strong', cls: 'strong', fill: 4 },
];

function getStrength(pwd) {
  let score = 0;
  if (pwd.length >= 8)  score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score;
}

newPwdInput.addEventListener('input', () => {
  const val = newPwdInput.value;
  if (!val) { strengthWrap.style.display = 'none'; return; }
  strengthWrap.style.display = 'flex';
  const score = Math.max(1, getStrength(val)) - 1;
  const level = LEVELS[score];
  bars.forEach((b, i) => {
    b.className = 'pwd-bar' + (i < level.fill ? ' ' + level.cls : '');
  });
  strengthLabel.textContent = level.label;
  strengthLabel.className = 'pwd-strength-label ' + level.cls;

  /* live confirm match check */
  const confirmVal = document.getElementById('confirmPwd').value;
  if (confirmVal) validateConfirm(val, confirmVal);
});

/* ── Inline validation helpers ── */
function setError(inputId, errId, msg) {
  const input = document.getElementById(inputId);
  const err   = document.getElementById(errId);
  input.classList.toggle('input-error', !!msg);
  input.classList.toggle('input-ok', !msg && input.value.length > 0);
  err.textContent = msg;
}

function validateConfirm(newVal, confirmVal) {
  if (confirmVal && newVal !== confirmVal) {
    setError('confirmPwd', 'confirmPwdErr', 'Passwords do not match.');
    return false;
  }
  setError('confirmPwd', 'confirmPwdErr', '');
  return true;
}

document.getElementById('confirmPwd').addEventListener('input', () => {
  validateConfirm(newPwdInput.value, document.getElementById('confirmPwd').value);
});

/* ── Social Media & Branding ── */
function setupUpload(zoneId, inputId, innerId, previewId, previewImgId, removeId, onLoad) {
  const zone    = document.getElementById(zoneId);
  const input   = document.getElementById(inputId);
  const inner   = document.getElementById(innerId);
  const preview = document.getElementById(previewId);
  const img     = document.getElementById(previewImgId);
  const remove  = document.getElementById(removeId);

  zone.addEventListener('click', (e) => {
    if (!e.target.closest('.branding-remove')) input.click();
  });

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
      inner.style.display = 'none';
      preview.style.display = 'flex';
      if (onLoad) onLoad(e.target.result);
    };
    reader.readAsDataURL(file);
  });

  remove.addEventListener('click', (e) => {
    e.stopPropagation();
    input.value = '';
    img.src = '';
    preview.style.display = 'none';
    inner.style.display = 'flex';
    if (onLoad) onLoad(null);
  });
}

setupUpload('logoZone', 'logoInput', 'logoInner', 'logoPreview', 'logoPreviewImg', 'logoRemove', (src) => {
  document.getElementById('bppLogo').src = src || '../logo-cropped.png';
});

setupUpload('faviconZone', 'faviconInput', 'faviconInner', 'faviconPreview', 'faviconPreviewImg', 'faviconRemove', (src) => {
  document.getElementById('bppFavicon').src = src || '../logo-cropped.png';
});

document.getElementById('siteName') && document.getElementById('siteName').addEventListener('input', () => {
  const v = document.getElementById('siteName').value.trim();
  document.getElementById('bppTabTitle').textContent = v || 'IEEE EMBS Student Chapter';
});

document.getElementById('saveBrandingBtn').addEventListener('click', () => {
  showToast('Branding settings saved!');
});

/* ── Appearance Settings ── */

function applyTheme(theme) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
  root.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

function applyAccent(color) {
  document.documentElement.style.setProperty('--purple', color);
}

function loadAppearance() {
  const saved = JSON.parse(localStorage.getItem('embs_appearance') || '{}');
  const theme = saved.theme || 'dark';
  const accent = saved.accent || '#6B2D8B';

  // Apply theme
  applyTheme(theme);
  const radio = document.querySelector(`.theme-option input[value="${theme}"]`);
  if (radio) radio.checked = true;

  // Apply accent
  applyAccent(accent);
  document.getElementById('accentColorPicker').value = accent;
  document.querySelectorAll('.accent-swatch').forEach(s => {
    s.classList.toggle('accent-swatch--active', s.dataset.color === accent);
  });

  // Apply toggles
  if (saved.sidebarCollapsed) sidebar.classList.add('collapsed');
  if (saved.animations === false) document.documentElement.style.setProperty('--transition', 'none');
  if (saved.glass === false) document.documentElement.classList.add('no-glass');

  const toggleSidebar = document.getElementById('toggleSidebar');
  const toggleAnimations = document.getElementById('toggleAnimations');
  const toggleGlass = document.getElementById('toggleGlass');
  if (toggleSidebar) toggleSidebar.checked = !!saved.sidebarCollapsed;
  if (toggleAnimations) toggleAnimations.checked = saved.animations !== false;
  if (toggleGlass) toggleGlass.checked = saved.glass !== false;
}

/* Theme radio cards */
document.querySelectorAll('.theme-option input').forEach(radio => {
  radio.addEventListener('change', () => applyTheme(radio.value));
});

/* Accent swatches */
document.querySelectorAll('.accent-swatch').forEach(swatch => {
  swatch.addEventListener('click', () => {
    document.querySelectorAll('.accent-swatch').forEach(s => s.classList.remove('accent-swatch--active'));
    swatch.classList.add('accent-swatch--active');
    document.getElementById('accentColorPicker').value = swatch.dataset.color;
    applyAccent(swatch.dataset.color);
  });
});

document.getElementById('accentColorPicker').addEventListener('input', (e) => {
  document.querySelectorAll('.accent-swatch').forEach(s => s.classList.remove('accent-swatch--active'));
  applyAccent(e.target.value);
});

document.getElementById('saveAppearanceBtn').addEventListener('click', () => {
  const theme = document.querySelector('.theme-option input:checked')?.value || 'dark';
  const accent = document.getElementById('accentColorPicker').value;
  const sidebarCollapsed = document.getElementById('toggleSidebar').checked;
  const animations = document.getElementById('toggleAnimations').checked;
  const glass = document.getElementById('toggleGlass').checked;
  localStorage.setItem('embs_appearance', JSON.stringify({ theme, accent, sidebarCollapsed, animations, glass }));
  showToast('Appearance settings saved!');
});

loadAppearance();

/* ── Danger Zone ── */
document.getElementById('logoutBtn').addEventListener('click', () => {
  showToast('Logging out…');
  setTimeout(() => { window.location.href = 'index.html'; }, 1200);
});

document.getElementById('clearCacheBtn').addEventListener('click', () => {
  showToast('Cache cleared. Reloading…');
  setTimeout(() => { window.location.reload(); }, 1400);
});

const resetModal = document.getElementById('resetModal');

document.getElementById('resetSettingsBtn').addEventListener('click', () => {
  resetModal.style.display = 'flex';
});

document.getElementById('cancelReset').addEventListener('click', () => {
  resetModal.style.display = 'none';
});

resetModal.addEventListener('click', (e) => {
  if (e.target === resetModal) resetModal.style.display = 'none';
});

document.getElementById('confirmReset').addEventListener('click', () => {
  resetModal.style.display = 'none';
  showToast('Settings have been reset to defaults.');
});

/* ── Save Website Information ── */
document.getElementById('saveSiteBtn').addEventListener('click', () => {
  showToast('Website information saved!');
});

/* ── Save Password ── */
document.getElementById('savePwdBtn').addEventListener('click', () => {
  const current = document.getElementById('currentPwd').value;
  const newPwd  = newPwdInput.value;
  const confirm = document.getElementById('confirmPwd').value;
  let valid = true;

  if (!current) {
    setError('currentPwd', 'currentPwdErr', 'Current password is required.');
    valid = false;
  } else {
    setError('currentPwd', 'currentPwdErr', '');
  }

  if (!newPwd) {
    setError('newPwd', 'newPwdErr', 'New password is required.');
    valid = false;
  } else if (newPwd.length < 8) {
    setError('newPwd', 'newPwdErr', 'Must be at least 8 characters.');
    valid = false;
  } else {
    setError('newPwd', 'newPwdErr', '');
  }

  if (!confirm) {
    setError('confirmPwd', 'confirmPwdErr', 'Please confirm your new password.');
    valid = false;
  } else if (!validateConfirm(newPwd, confirm)) {
    valid = false;
  }

  if (!valid) return;

  /* Call real API */
  const token = localStorage.getItem('embs_admin_token');
  fetch(`${window.EMBS_API_BASE}/auth/update-password`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ currentPassword: current, newPassword: newPwd })
  }).then(async res => {
    const data = await res.json();
    if (!res.ok) { showToast(data.message || 'Failed to update password.'); return; }
    if (data.data?.token) localStorage.setItem('embs_admin_token', data.data.token);
    document.getElementById('currentPwd').value = '';
    newPwdInput.value = '';
    document.getElementById('confirmPwd').value = '';
    strengthWrap.style.display = 'none';
    ['currentPwd','newPwd','confirmPwd'].forEach(id => {
      document.getElementById(id).classList.remove('input-ok', 'input-error');
    });
    showToast('Password updated successfully!');
  }).catch(() => showToast('Network error. Please try again.'));
});
