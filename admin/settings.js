if (localStorage.getItem('embs_admin_auth') !== 'true') window.location.href = 'index.html';

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

/* ── Phase 1 API helpers ── */
const API = window.EMBS_API_BASE;
const TOKEN = () => localStorage.getItem('embs_admin_token');
const authHeaders = () => ({ Authorization: `Bearer ${TOKEN()}` });
const jsonHeaders = () => ({ 'Content-Type': 'application/json', ...authHeaders() });

async function apiFetch(url, options = {}) {
  const res = await fetch(url, options);
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.message || 'Request failed');
  return payload;
}

async function loadSiteSettings() {
  try {
    const payload = await apiFetch(`${API}/site-settings`, { headers: authHeaders() });
    const data = payload.data || {};
    const social = data.socialLinks || {};
    const reg = data.registrationLinks || {};
    const docs = data.brochureLinks || {};

    document.getElementById('siteName').value = data.siteName || 'IEEE EMBS Student Chapter';
    document.getElementById('chapterName').value = data.chapterName || 'IEEE Engineering in Medicine and Biology Society';
    document.getElementById('institutionName').value = data.institution || '';
    document.getElementById('departmentName').value = data.department || '';
    document.getElementById('siteEmail').value = data.officialEmail || '';
    document.getElementById('sitePhone').value = data.phone || '';
    document.getElementById('siteAddress').value = data.address || '';
    document.getElementById('facultyContact').value = data.facultyContact || '';
    document.getElementById('mapsLink').value = data.mapUrl || '';
    document.getElementById('footerText').value = data.footerText || '';
    document.getElementById('fbUrl').value = social.facebook || social.facebook === '' ? social.facebook : '';
    document.getElementById('igUrl').value = social.instagram || '';
    document.getElementById('liUrl').value = social.linkedin || '';
    document.getElementById('ytUrl').value = social.youtube || '';
    document.getElementById('twUrl').value = social.x || '';
    document.getElementById('spotifyUrl').value = social.spotify || '';
    document.getElementById('webUrl').value = data.websiteUrl || '';
    document.getElementById('bppTabTitle').textContent = document.getElementById('siteName').value || 'IEEE EMBS Student Chapter';
    document.getElementById('profileDisplayName').textContent = document.getElementById('profileName').value || 'Admin';

    const siteNameField = document.getElementById('siteName');
    if (siteNameField) siteNameField.addEventListener('input', () => {
      const v = siteNameField.value.trim();
      document.getElementById('bppTabTitle').textContent = v || 'IEEE EMBS Student Chapter';
    });

    if (reg.events) document.getElementById('regEventUrl')?.setAttribute('value', reg.events);
    if (docs.chapter) document.getElementById('brochureChapterUrl')?.setAttribute('value', docs.chapter);
  } catch (error) {
    console.warn('Settings load failed:', error.message);
    showToast('Unable to load saved site settings.', 'error');
  }
}

async function saveSiteSettings() {
  try {
    const payload = {
      siteName: document.getElementById('siteName').value.trim(),
      chapterName: document.getElementById('chapterName').value.trim(),
      institution: document.getElementById('institutionName').value.trim(),
      department: document.getElementById('departmentName').value.trim(),
      officialEmail: document.getElementById('siteEmail').value.trim(),
      phone: document.getElementById('sitePhone').value.trim(),
      address: document.getElementById('siteAddress').value.trim(),
      facultyContact: document.getElementById('facultyContact').value.trim(),
      mapUrl: document.getElementById('mapsLink').value.trim(),
      footerText: document.getElementById('footerText').value.trim(),
      socialLinks: {
        facebook: document.getElementById('fbUrl').value.trim(),
        instagram: document.getElementById('igUrl').value.trim(),
        linkedin: document.getElementById('liUrl').value.trim(),
        youtube: document.getElementById('ytUrl').value.trim(),
        x: document.getElementById('twUrl').value.trim(),
        spotify: document.getElementById('spotifyUrl').value.trim(),
      },
      registrationLinks: {
        events: '',
        membership: '',
        ieeeDay: '',
        other: {},
      },
      brochureLinks: {
        chapter: '',
        membership: '',
        annualReport: '',
        other: {},
      },
    };

    const res = await apiFetch(`${API}/site-settings`, {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify(payload),
    });

    if (res?.data) {
      const data = res.data;
      document.getElementById('siteName').value = data.siteName || '';
      document.getElementById('bppTabTitle').textContent = data.siteName || 'IEEE EMBS Student Chapter';
    }
    showToast('Site settings saved successfully!');
  } catch (error) {
    console.error('saveSiteSettings error:', error);
    showToast(error.message || 'Failed to save site settings.', 'error');
  }
}

async function loadDocuments() {
  try {
    const payload = await apiFetch(`${API}/documents?all=true`, { headers: authHeaders() });
    const documents = payload.data || [];
    const tbody = document.getElementById('documentsTableBody');
    if (!tbody) return;

    if (!documents.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="table-empty-state">No documents available.</td></tr>';
      return;
    }

    tbody.innerHTML = documents.map(doc => `
      <tr>
        <td>${doc.title || 'Untitled'}</td>
        <td>${doc.category || 'General'}</td>
        <td>${doc.published && doc.public ? 'Published' : doc.published ? 'Draft' : 'Hidden'}</td>
        <td><a href="${doc.fileUrl || '#'}" target="_blank" rel="noreferrer">${doc.fileUrl ? 'Open file' : 'No file'}</a></td>
        <td>
          <div class="document-actions">
            <button class="mini-action-btn" data-action="edit" data-id="${doc._id}">Edit</button>
            <button class="mini-action-btn danger-btn" data-action="delete" data-id="${doc._id}">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-action="edit"]').forEach(button => {
      button.addEventListener('click', () => populateDocumentForm(button.dataset.id));
    });
    tbody.querySelectorAll('[data-action="delete"]').forEach(button => {
      button.addEventListener('click', () => deleteDocument(button.dataset.id));
    });
  } catch (error) {
    console.warn('Document load failed:', error.message);
    document.getElementById('documentsTableBody').innerHTML = '<tr><td colspan="5" class="table-empty-state">Unable to load documents.</td></tr>';
  }
}

async function saveDocument() {
  const title = document.getElementById('docTitle').value.trim();
  const category = document.getElementById('docCategory').value.trim();
  const description = document.getElementById('docDescription').value.trim();
  const fileInput = document.getElementById('docFileInput');
  const published = document.getElementById('docPublished').checked;
  const publicDoc = document.getElementById('docPublic').checked;
  const currentId = document.getElementById('docFileInput').dataset.documentId;

  if (!title) return showToast('Document title is required.', 'error');

  try {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('category', category);
    formData.append('description', description);
    formData.append('published', String(published));
    formData.append('public', String(publicDoc));

    if (fileInput.files && fileInput.files[0]) formData.append('file', fileInput.files[0]);

    const url = currentId ? `${API}/documents/${currentId}` : `${API}/documents`;
    const method = currentId ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: authHeaders(),
      body: formData,
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.message || 'Failed to save document');

    resetDocumentForm();
    await loadDocuments();
    showToast(currentId ? 'Document updated.' : 'Document uploaded.');
  } catch (error) {
    console.error('saveDocument error:', error);
    showToast(error.message || 'Failed to save document.', 'error');
  }
}

async function deleteDocument(id) {
  if (!id) return;
  if (!window.confirm('Delete this document?')) return;

  try {
    const res = await fetch(`${API}/documents/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.message || 'Delete failed');
    showToast('Document deleted.');
    await loadDocuments();
  } catch (error) {
    console.error('deleteDocument error:', error);
    showToast(error.message || 'Unable to delete document.', 'error');
  }
}

async function populateDocumentForm(id) {
  try {
    const payload = await apiFetch(`${API}/documents/${id}`, { headers: authHeaders() });
    const doc = payload.data || {};
    document.getElementById('docTitle').value = doc.title || '';
    document.getElementById('docCategory').value = doc.category || '';
    document.getElementById('docDescription').value = doc.description || '';
    document.getElementById('docPublished').checked = !!doc.published;
    document.getElementById('docPublic').checked = !!doc.public;
    document.getElementById('docFileInput').dataset.documentId = doc._id;
    document.getElementById('docFileName').textContent = doc.fileUrl ? 'Current file: ' + doc.fileUrl.split('/').pop() : 'No file selected';
    document.getElementById('saveDocumentBtn').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (error) {
    showToast(error.message || 'Unable to load document details.', 'error');
  }
}

function resetDocumentForm() {
  document.getElementById('docTitle').value = '';
  document.getElementById('docCategory').value = '';
  document.getElementById('docDescription').value = '';
  document.getElementById('docPublished').checked = true;
  document.getElementById('docPublic').checked = true;
  const fileInput = document.getElementById('docFileInput');
  fileInput.value = '';
  delete fileInput.dataset.documentId;
  document.getElementById('docFileName').textContent = 'No file selected';
}

/* ── Save Changes ── */
document.getElementById('saveProfileBtn').addEventListener('click', () => {
  showToast('Profile saved successfully!');
});

/* ── Existing settings save handlers ── */
document.getElementById('saveSiteBtn').addEventListener('click', saveSiteSettings);
document.getElementById('saveDocumentBtn').addEventListener('click', saveDocument);
document.getElementById('resetDocumentFormBtn').addEventListener('click', resetDocumentForm);
document.getElementById('docFileInput').addEventListener('change', () => {
  const file = document.getElementById('docFileInput').files && document.getElementById('docFileInput').files[0];
  document.getElementById('docFileName').textContent = file ? file.name : 'No file selected';
});

if (localStorage.getItem('embs_admin_auth') === 'true') {
  loadSiteSettings();
  loadDocuments();
}

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
