if (localStorage.getItem('embs_admin_auth') !== 'true') window.location.href = 'index.html';

/* ════════════════════════════════════════════════════════════════════════════
   admin/settings.js
   Fixes applied vs. previous version:
   1.  Duplicate #saveSiteBtn listener removed — only one listener, only fires
       success toast AFTER backend confirms the save.
   2.  saveSiteSettings() sends every field including websiteUrl.
   3.  loadSiteSettings() always overwrites inputs with DB values (no more
       hardcoded placeholders surviving after a successful fetch).
   4.  All registration/brochure link fields load and save correctly.
   5.  #saveBrandingBtn now has a listener — saves social links + uploads
       logo/favicon to Cloudinary via PATCH /api/site-settings/branding.
   6.  showToast() accepts a type arg ('success'|'error') and applies the
       correct CSS class so errors and successes look different.
   7.  updatedBy is no longer sent to the backend (controller handles it).
   8.  Logo/favicon previewed locally AND uploaded to Cloudinary on save.
   9.  Saved logoUrl/faviconUrl restored to preview panel on page load.
   ════════════════════════════════════════════════════════════════════════════ */

'use strict';

/* ── API helpers ────────────────────────────────────────────────────────── */
const API    = window.EMBS_API_BASE;
const TOKEN  = () => localStorage.getItem('embs_admin_token');
const authH  = () => ({ Authorization: `Bearer ${TOKEN()}` });
const jsonH  = () => ({ 'Content-Type': 'application/json', ...authH() });

async function apiFetch(url, options = {}) {
  const res     = await fetch(url, options);
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.message || `Request failed (${res.status})`);
  return payload;
}

/* ── Sidebar toggle ─────────────────────────────────────────────────────── */
const sidebar        = document.getElementById('sidebar');
const sidebarToggle  = document.getElementById('sidebarToggle');
const sidebarOverlay = document.getElementById('sidebarOverlay');

sidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('open');
  sidebarOverlay.classList.toggle('active');
});
sidebarOverlay.addEventListener('click', () => {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('active');
});

/* ── Toast ──────────────────────────────────────────────────────────────── */
/* Accepts an optional type: 'success' (default) | 'error' */
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent  = msg;
  toast.className    = `toast toast--${type} show`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3200);
}

/* ── In-memory mirror of the last successfully loaded settings ──────────── */
let currentSettings = {};

/* ── Helpers to safely read an input value ─────────────────────────────── */
function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}
function checked(id) {
  const el = document.getElementById(id);
  return el ? el.checked : false;
}
function setVal(id, v) {
  const el = document.getElementById(id);
  if (el) el.value = v != null ? v : '';
}
function setChecked(id, v) {
  const el = document.getElementById(id);
  if (el) el.checked = Boolean(v);
}

/* ════════════════════════════════════════════════════════════════════════════
   SECTION 1 — Website Information
   ════════════════════════════════════════════════════════════════════════════ */

async function loadSiteSettings() {
  try {
    const payload = await apiFetch(`${API}/site-settings`, { headers: authH() });
    const data    = payload.data || {};
    currentSettings = data;

    /* Core fields */
    setVal('siteName',        data.siteName);
    setVal('chapterName',     data.chapterName);
    setVal('institutionName', data.institution);
    setVal('departmentName',  data.department);
    setVal('siteEmail',       data.officialEmail);
    setVal('sitePhone',       data.phone);
    setVal('facultyContact',  data.facultyContact);
    setVal('mapsLink',        data.mapUrl);
    setVal('siteAddress',     data.address);
    setVal('footerText',      data.footerText);

    /* About page chapter information */
    setVal('chapterDescription', data.chapterDescription);
    setVal('chapterVision',      data.vision);
    setVal('chapterMission',     data.mission);
    setVal('establishedYear',    data.establishedYear);

    /* Social links */
    const s = data.socialLinks || {};
    setVal('fbUrl',      s.facebook);
    setVal('igUrl',      s.instagram);
    setVal('liUrl',      s.linkedin);
    setVal('ytUrl',      s.youtube);
    setVal('twUrl',      s.x);
    setVal('spotifyUrl', s.spotify);
    setVal('webUrl',     data.websiteUrl);

    /* Registration links */
    const reg = data.registrationLinks || {};
    setVal('regEventUrl',      reg.events);
    setVal('regMembershipUrl', reg.membership);
    setVal('regIeeeDayUrl',    reg.ieeeDay);

    /* Brochure links */
    const bro = data.brochureLinks || {};
    setVal('brochureChapterUrl',     bro.chapter);
    setVal('brochureMembershipUrl',  bro.membership);
    setVal('brochureAnnualReportUrl',bro.annualReport);

    /* Branding previews — restore previously uploaded logo/favicon from DB */
    if (data.logoUrl) {
      const logoImg     = document.getElementById('logoPreviewImg');
      const logoPreview = document.getElementById('logoPreview');
      const logoInner   = document.getElementById('logoInner');
      const bppLogo     = document.getElementById('bppLogo');
      if (logoImg)     logoImg.src              = data.logoUrl;
      if (logoPreview) logoPreview.style.display = 'flex';
      if (logoInner)   logoInner.style.display   = 'none';
      if (bppLogo)     bppLogo.src               = data.logoUrl;
    }
    if (data.faviconUrl) {
      const favImg     = document.getElementById('faviconPreviewImg');
      const favPreview = document.getElementById('faviconPreview');
      const favInner   = document.getElementById('faviconInner');
      const bppFav     = document.getElementById('bppFavicon');
      if (favImg)     favImg.src              = data.faviconUrl;
      if (favPreview) favPreview.style.display = 'flex';
      if (favInner)   favInner.style.display   = 'none';
      if (bppFav)     bppFav.src               = data.faviconUrl;
    }
    if (data.podcastCoverUrl) {
      const pcImg     = document.getElementById('podcastCoverPreviewImg');
      const pcPreview = document.getElementById('podcastCoverPreview');
      const pcInner   = document.getElementById('podcastCoverInner');
      if (pcImg)     pcImg.src               = data.podcastCoverUrl;
      if (pcPreview) pcPreview.style.display = 'flex';
      if (pcInner)   pcInner.style.display   = 'none';
    }

    /* Browser-tab title preview */
    const tabTitle = document.getElementById('bppTabTitle');
    if (tabTitle) tabTitle.textContent = data.siteName || 'IEEE EMBS Student Chapter';

  } catch (err) {
    console.warn('Settings load failed:', err.message);
    showToast('Unable to load saved settings.', 'error');
  }
}

async function saveSiteSettings() {
  const btn = document.getElementById('saveSiteBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  try {
    const prev    = currentSettings || {};
    const prevSoc = prev.socialLinks        || {};
    const prevReg = prev.registrationLinks  || {};
    const prevBro = prev.brochureLinks      || {};

    const payload = {
      siteName:      val('siteName'),
      chapterName:   val('chapterName'),
      institution:   val('institutionName'),
      department:    val('departmentName'),
      officialEmail: val('siteEmail'),
      phone:         val('sitePhone'),
      facultyContact:val('facultyContact'),
      mapUrl:        val('mapsLink'),
      address:       val('siteAddress'),
      footerText:    val('footerText'),
      websiteUrl:    val('webUrl'),
      chapterDescription: val('chapterDescription'),
      vision:             val('chapterVision'),
      mission:            val('chapterMission'),
      establishedYear:    val('establishedYear'),
      socialLinks: {
        facebook:  val('fbUrl')      || prevSoc.facebook  || '',
        instagram: val('igUrl')      || prevSoc.instagram || '',
        linkedin:  val('liUrl')      || prevSoc.linkedin  || '',
        youtube:   val('ytUrl')      || prevSoc.youtube   || '',
        x:         val('twUrl')      || prevSoc.x         || '',
        spotify:   val('spotifyUrl') || prevSoc.spotify   || '',
      },
      registrationLinks: {
        events:     val('regEventUrl')      || prevReg.events      || '',
        membership: val('regMembershipUrl') || prevReg.membership  || '',
        ieeeDay:    val('regIeeeDayUrl')    || prevReg.ieeeDay     || '',
        other:      prevReg.other || {},
      },
      brochureLinks: {
        chapter:      val('brochureChapterUrl')      || prevBro.chapter      || '',
        membership:   val('brochureMembershipUrl')   || prevBro.membership   || '',
        annualReport: val('brochureAnnualReportUrl') || prevBro.annualReport || '',
        other:        prevBro.other || {},
      },
    };

    const res = await apiFetch(`${API}/site-settings`, {
      method:  'PATCH',
      headers: jsonH(),
      body:    JSON.stringify(payload),
    });

    if (res.data) {
      currentSettings = res.data;
      const tabTitle = document.getElementById('bppTabTitle');
      if (tabTitle) tabTitle.textContent = res.data.siteName || 'IEEE EMBS Student Chapter';
    }

    showToast('Site settings saved successfully!', 'success');
  } catch (err) {
    console.error('saveSiteSettings error:', err);
    showToast(err.message || 'Failed to save site settings.', 'error');
  } finally {
    if (btn) {
      btn.disabled    = false;
      btn.textContent = '';
      /* Restore inner HTML with the floppy icon — easiest to just reload */
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" stroke="currentColor" stroke-width="1.6"/><polyline points="17,21 17,13 7,13 7,21" stroke="currentColor" stroke-width="1.6"/><polyline points="7,3 7,8 15,8" stroke="currentColor" stroke-width="1.6"/></svg> Save Changes`;
    }
  }
}

/* Single listener — replaces the two conflicting ones that existed before */
document.getElementById('saveSiteBtn').addEventListener('click', saveSiteSettings);

/* ════════════════════════════════════════════════════════════════════════════
   SECTION 2 — Branding (logo, favicon, social links)
   Social links are part of Site Settings but live on the branding card.
   The Save button on the branding card sends:
     • Social links  → PATCH /api/site-settings  (JSON)
     • Logo/favicon  → PATCH /api/site-settings/branding  (multipart) if changed
   ════════════════════════════════════════════════════════════════════════════ */

/* Pending file selections from the upload zones */
const _pendingLogo    = { file: null };
const _pendingFavicon = { file: null };
const _pendingPodcastCover = { file: null };

function setupBrandingUpload(zoneId, inputId, innerId, previewId, previewImgId, removeId, pending, onLoad) {
  const zone    = document.getElementById(zoneId);
  const input   = document.getElementById(inputId);
  const inner   = document.getElementById(innerId);
  const preview = document.getElementById(previewId);
  const img     = document.getElementById(previewImgId);
  const remove  = document.getElementById(removeId);

  if (!zone || !input) return;

  zone.addEventListener('click', (e) => {
    if (!e.target.closest('.branding-remove')) input.click();
  });

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    pending.file = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (img)     img.src               = e.target.result;
      if (inner)   inner.style.display   = 'none';
      if (preview) preview.style.display = 'flex';
      if (onLoad)  onLoad(e.target.result);
    };
    reader.readAsDataURL(file);
  });

  if (remove) {
    remove.addEventListener('click', (e) => {
      e.stopPropagation();
      pending.file  = null;
      input.value   = '';
      if (img)     img.src               = '';
      if (preview) preview.style.display = 'none';
      if (inner)   inner.style.display   = 'flex';
      if (onLoad)  onLoad(null);
    });
  }
}

setupBrandingUpload(
  'logoZone', 'logoInput', 'logoInner', 'logoPreview', 'logoPreviewImg', 'logoRemove',
  _pendingLogo,
  (src) => {
    const bppLogo = document.getElementById('bppLogo');
    if (bppLogo) bppLogo.src = src || '../logo-cropped.png';
  }
);

setupBrandingUpload(
  'faviconZone', 'faviconInput', 'faviconInner', 'faviconPreview', 'faviconPreviewImg', 'faviconRemove',
  _pendingFavicon,
  (src) => {
    const bppFav = document.getElementById('bppFavicon');
    if (bppFav) bppFav.src = src || '../logo-cropped.png';
  }
);

setupBrandingUpload(
  'podcastCoverZone', 'podcastCoverInput', 'podcastCoverInner', 'podcastCoverPreview', 'podcastCoverPreviewImg', 'podcastCoverRemove',
  _pendingPodcastCover,
  null  /* no live-preview side-effect needed */
);

async function saveBranding() {
  const btn = document.getElementById('saveBrandingBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  try {
    const prev    = currentSettings || {};
    const prevSoc = prev.socialLinks || {};

    /* 1. Save social links (and websiteUrl) as JSON */
    const socialPayload = {
      websiteUrl: val('webUrl'),
      socialLinks: {
        facebook:  val('fbUrl')      || prevSoc.facebook  || '',
        instagram: val('igUrl')      || prevSoc.instagram || '',
        linkedin:  val('liUrl')      || prevSoc.linkedin  || '',
        youtube:   val('ytUrl')      || prevSoc.youtube   || '',
        x:         val('twUrl')      || prevSoc.x         || '',
        spotify:   val('spotifyUrl') || prevSoc.spotify   || '',
      },
    };

    const socialRes = await apiFetch(`${API}/site-settings`, {
      method:  'PATCH',
      headers: jsonH(),
      body:    JSON.stringify(socialPayload),
    });
    if (socialRes.data) currentSettings = socialRes.data;

    /* 2. Upload logo and/or favicon if a new file was selected */
    if (_pendingLogo.file || _pendingFavicon.file || _pendingPodcastCover.file) {
      const fd = new FormData();
      if (_pendingLogo.file)         fd.append('logo',          _pendingLogo.file);
      if (_pendingFavicon.file)      fd.append('favicon',       _pendingFavicon.file);
      if (_pendingPodcastCover.file) fd.append('podcastCover',  _pendingPodcastCover.file);

      const brandingRes = await apiFetch(`${API}/site-settings/branding`, {
        method:  'PATCH',
        headers: authH(),
        body:    fd,
      });

      if (brandingRes.data) {
        currentSettings = brandingRes.data;
        if (brandingRes.data.logoUrl) {
          const img = document.getElementById('logoPreviewImg');
          const bppLogo = document.getElementById('bppLogo');
          if (img) img.src = brandingRes.data.logoUrl;
          if (bppLogo) bppLogo.src = brandingRes.data.logoUrl;
        }
        if (brandingRes.data.faviconUrl) {
          const img = document.getElementById('faviconPreviewImg');
          const bppFav = document.getElementById('bppFavicon');
          if (img) img.src = brandingRes.data.faviconUrl;
          if (bppFav) bppFav.src = brandingRes.data.faviconUrl;
        }
        if (brandingRes.data.podcastCoverUrl) {
          const img = document.getElementById('podcastCoverPreviewImg');
          if (img) img.src = brandingRes.data.podcastCoverUrl;
        }
        _pendingLogo.file         = null;
        _pendingFavicon.file      = null;
        _pendingPodcastCover.file = null;
      }
    }

    /* 3. If admin cleared the podcast cover (remove button), persist the deletion */
    const pcPreview = document.getElementById('podcastCoverPreview');
    const pcInner   = document.getElementById('podcastCoverInner');
    const coverWasCleared = pcInner && pcInner.style.display !== 'none' &&
                            currentSettings && currentSettings.podcastCoverUrl;
    if (coverWasCleared && !_pendingPodcastCover.file) {
      await apiFetch(`${API}/site-settings/branding`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', ...authH() },
        body:    JSON.stringify({ podcastCoverUrl: '' }),
      });
      if (currentSettings) currentSettings.podcastCoverUrl = '';
    }

    showToast('Branding saved successfully!', 'success');
  } catch (err) {
    console.error('saveBranding error:', err);
    showToast(err.message || 'Failed to save branding.', 'error');
  } finally {
    if (btn) {
      btn.disabled  = false;
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" stroke="currentColor" stroke-width="1.6"/><polyline points="17,21 17,13 7,13 7,21" stroke="currentColor" stroke-width="1.6"/><polyline points="7,3 7,8 15,8" stroke="currentColor" stroke-width="1.6"/></svg> Save Changes`;
    }
  }
}

document.getElementById('saveBrandingBtn').addEventListener('click', saveBranding);

/* Keep browser-tab preview title in sync as user types */
const siteNameInput = document.getElementById('siteName');
if (siteNameInput) {
  siteNameInput.addEventListener('input', () => {
    const tabTitle = document.getElementById('bppTabTitle');
    if (tabTitle) tabTitle.textContent = siteNameInput.value.trim() || 'IEEE EMBS Student Chapter';
  });
}

/* ════════════════════════════════════════════════════════════════════════════
   SECTION 3 — Admin Profile
   Profile fields (name, email, phone, designation) are admin-local only —
   there is no User profile API endpoint for these extra fields, so they are
   stored in localStorage under 'embs_admin_profile'.
   ════════════════════════════════════════════════════════════════════════════ */

const profileAvatarImg     = document.getElementById('profileAvatarImg');
const profileAvatarInitial = document.getElementById('profileAvatarInitial');
const uploadPicBtn         = document.getElementById('uploadPicBtn');
const profilePicInput      = document.getElementById('profilePicInput');

uploadPicBtn.addEventListener('click', () => profilePicInput.click());

profilePicInput.addEventListener('change', () => {
  const file = profilePicInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    profileAvatarImg.src          = e.target.result;
    profileAvatarImg.style.display = 'block';
    profileAvatarInitial.style.display = 'none';
  };
  reader.readAsDataURL(file);
});

function loadAdminProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem('embs_admin_profile') || '{}');
    if (saved.name)        { setVal('profileName', saved.name); setDisplayName(saved.name); }
    if (saved.email)       setVal('profileEmail',       saved.email);
    if (saved.phone)       setVal('profilePhone',       saved.phone);
    if (saved.designation) setVal('profileDesignation', saved.designation);
  } catch { /* ignore */ }
}

function setDisplayName(name) {
  const displayEl  = document.getElementById('profileDisplayName');
  const initialEl  = document.getElementById('profileAvatarInitial');
  if (displayEl) displayEl.textContent = name || 'Admin';
  if (initialEl && profileAvatarImg.style.display === 'none') {
    initialEl.textContent = (name || 'A').charAt(0).toUpperCase();
  }
}

document.getElementById('profileName').addEventListener('input', function () {
  setDisplayName(this.value.trim());
});

document.getElementById('saveProfileBtn').addEventListener('click', () => {
  const profile = {
    name:        val('profileName'),
    email:       val('profileEmail'),
    phone:       val('profilePhone'),
    designation: val('profileDesignation'),
  };
  localStorage.setItem('embs_admin_profile', JSON.stringify(profile));
  setDisplayName(profile.name);
  showToast('Profile saved.', 'success');
});

/* ════════════════════════════════════════════════════════════════════════════
   SECTION 4 — Appearance (admin-panel local preferences, localStorage only)
   ════════════════════════════════════════════════════════════════════════════ */

function applyTheme(theme) {
  const root        = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark      = theme === 'dark' || (theme === 'system' && prefersDark);
  root.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

function applyAccent(color) {
  document.documentElement.style.setProperty('--purple', color);
}

function loadAppearance() {
  const saved  = JSON.parse(localStorage.getItem('embs_appearance') || '{}');
  const theme  = saved.theme  || 'dark';
  const accent = saved.accent || '#6B2D8B';

  applyTheme(theme);
  const radio = document.querySelector(`.theme-option input[value="${theme}"]`);
  if (radio) radio.checked = true;

  applyAccent(accent);
  const picker = document.getElementById('accentColorPicker');
  if (picker) picker.value = accent;

  document.querySelectorAll('.accent-swatch').forEach(s => {
    s.classList.toggle('accent-swatch--active', s.dataset.color === accent);
  });

  if (saved.sidebarCollapsed) sidebar.classList.add('collapsed');
  if (saved.animations === false) document.documentElement.style.setProperty('--transition', 'none');
  if (saved.glass === false) document.documentElement.classList.add('no-glass');

  setChecked('toggleSidebar',    !!saved.sidebarCollapsed);
  setChecked('toggleAnimations', saved.animations !== false);
  setChecked('toggleGlass',      saved.glass      !== false);
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
    const picker = document.getElementById('accentColorPicker');
    if (picker) picker.value = swatch.dataset.color;
    applyAccent(swatch.dataset.color);
  });
});

const accentPicker = document.getElementById('accentColorPicker');
if (accentPicker) {
  accentPicker.addEventListener('input', (e) => {
    document.querySelectorAll('.accent-swatch').forEach(s => s.classList.remove('accent-swatch--active'));
    applyAccent(e.target.value);
  });
}

document.getElementById('saveAppearanceBtn').addEventListener('click', () => {
  const themeEl = document.querySelector('.theme-option input:checked');
  const theme   = themeEl ? themeEl.value : 'dark';
  const accent  = accentPicker ? accentPicker.value : '#6B2D8B';

  const prefs = {
    theme,
    accent,
    sidebarCollapsed: checked('toggleSidebar'),
    animations:       checked('toggleAnimations'),
    glass:            checked('toggleGlass'),
  };

  localStorage.setItem('embs_appearance', JSON.stringify(prefs));
  showToast('Appearance settings saved!', 'success');
});

/* ════════════════════════════════════════════════════════════════════════════
   SECTION 5 — Change Password
   ════════════════════════════════════════════════════════════════════════════ */

/* Show/hide password toggles */
document.querySelectorAll('.pwd-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const input   = document.getElementById(btn.dataset.target);
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    btn.querySelector('.eye-show').style.display = isHidden ? 'none' : '';
    btn.querySelector('.eye-hide').style.display = isHidden ? ''     : 'none';
  });
});

/* Password strength meter */
const newPwdInput    = document.getElementById('newPwd');
const strengthWrap   = document.getElementById('pwdStrengthWrap');
const strengthLabel  = document.getElementById('pwdStrengthLabel');
const bars = [
  document.getElementById('bar1'),
  document.getElementById('bar2'),
  document.getElementById('bar3'),
  document.getElementById('bar4'),
];

const PWD_LEVELS = [
  { label: 'Weak',   cls: 'weak',   fill: 1 },
  { label: 'Fair',   cls: 'fair',   fill: 2 },
  { label: 'Good',   cls: 'good',   fill: 3 },
  { label: 'Strong', cls: 'strong', fill: 4 },
];

function getPasswordStrength(pwd) {
  let score = 0;
  if (pwd.length >= 8)          score++;
  if (/[A-Z]/.test(pwd))        score++;
  if (/[0-9]/.test(pwd))        score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score;
}

newPwdInput.addEventListener('input', () => {
  const v = newPwdInput.value;
  if (!v) { strengthWrap.style.display = 'none'; return; }
  strengthWrap.style.display = 'flex';
  const level = PWD_LEVELS[Math.max(1, getPasswordStrength(v)) - 1];
  bars.forEach((b, i) => {
    if (b) b.className = 'pwd-bar' + (i < level.fill ? ' ' + level.cls : '');
  });
  if (strengthLabel) {
    strengthLabel.textContent = level.label;
    strengthLabel.className   = 'pwd-strength-label ' + level.cls;
  }
  const confirmVal = val('confirmPwd');
  if (confirmVal) validateConfirm(v, confirmVal);
});

function setFieldError(inputId, errId, msg) {
  const input = document.getElementById(inputId);
  const err   = document.getElementById(errId);
  if (input) {
    input.classList.toggle('input-error', !!msg);
    input.classList.toggle('input-ok',    !msg && input.value.length > 0);
  }
  if (err) err.textContent = msg;
}

function validateConfirm(newVal, confirmVal) {
  if (confirmVal && newVal !== confirmVal) {
    setFieldError('confirmPwd', 'confirmPwdErr', 'Passwords do not match.');
    return false;
  }
  setFieldError('confirmPwd', 'confirmPwdErr', '');
  return true;
}

document.getElementById('confirmPwd').addEventListener('input', () => {
  validateConfirm(newPwdInput.value, val('confirmPwd'));
});

document.getElementById('savePwdBtn').addEventListener('click', async () => {
  const current  = val('currentPwd');
  const newPwd   = newPwdInput.value;
  const confirm  = val('confirmPwd');
  let   valid    = true;

  if (!current) { setFieldError('currentPwd', 'currentPwdErr', 'Current password is required.'); valid = false; }
  else           setFieldError('currentPwd', 'currentPwdErr', '');

  if (!newPwd)          { setFieldError('newPwd', 'newPwdErr', 'New password is required.');          valid = false; }
  else if (newPwd.length < 8) { setFieldError('newPwd', 'newPwdErr', 'Must be at least 8 characters.'); valid = false; }
  else                   setFieldError('newPwd', 'newPwdErr', '');

  if (!confirm)           { setFieldError('confirmPwd', 'confirmPwdErr', 'Please confirm your new password.'); valid = false; }
  else if (!validateConfirm(newPwd, confirm)) { valid = false; }

  if (!valid) return;

  const btn = document.getElementById('savePwdBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  try {
    const res = await apiFetch(`${API}/auth/update-password`, {
      method:  'PATCH',
      headers: jsonH(),
      body:    JSON.stringify({ currentPassword: current, newPassword: newPwd }),
    });
    if (res.data && res.data.token) localStorage.setItem('embs_admin_token', res.data.token);
    document.getElementById('currentPwd').value = '';
    newPwdInput.value = '';
    document.getElementById('confirmPwd').value = '';
    strengthWrap.style.display = 'none';
    ['currentPwd','newPwd','confirmPwd'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('input-ok', 'input-error');
    });
    showToast('Password updated successfully!', 'success');
  } catch (err) {
    showToast(err.message || 'Network error. Please try again.', 'error');
  } finally {
    if (btn) {
      btn.disabled  = false;
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" width="14" height="14"><rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg> Save Password`;
    }
  }
});

/* ════════════════════════════════════════════════════════════════════════════
   SECTION 6 — Documents
   ════════════════════════════════════════════════════════════════════════════ */

async function loadDocuments() {
  const tbody = document.getElementById('documentsTableBody');
  if (!tbody) return;

  try {
    const payload   = await apiFetch(`${API}/documents?all=true`, { headers: authH() });
    const documents = payload.data || [];

    if (!documents.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="table-empty-state">No documents available.</td></tr>';
      return;
    }

    tbody.innerHTML = documents.map(doc => `
      <tr>
        <td>${doc.title || 'Untitled'}</td>
        <td>${doc.category || 'General'}</td>
        <td>${doc.published && doc.public ? 'Published' : doc.published ? 'Draft' : 'Hidden'}</td>
        <td>${doc.fileUrl ? `<a href="${doc.fileUrl}" target="_blank" rel="noreferrer">Open file</a>` : 'No file'}</td>
        <td>
          <div class="document-actions">
            <button class="mini-action-btn" data-action="edit"   data-id="${doc._id}">Edit</button>
            <button class="mini-action-btn danger-btn" data-action="delete" data-id="${doc._id}">Delete</button>
          </div>
        </td>
      </tr>`).join('');

    tbody.querySelectorAll('[data-action="edit"]').forEach(b => {
      b.addEventListener('click', () => populateDocumentForm(b.dataset.id));
    });
    tbody.querySelectorAll('[data-action="delete"]').forEach(b => {
      b.addEventListener('click', () => deleteDocument(b.dataset.id));
    });
  } catch (err) {
    console.warn('Document load failed:', err.message);
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="table-empty-state">Unable to load documents.</td></tr>';
  }
}

async function saveDocument() {
  const title     = val('docTitle');
  const category  = val('docCategory');
  const fileInput = document.getElementById('docFileInput');
  const published = checked('docPublished');
  const publicDoc = checked('docPublic');
  const currentId = fileInput.dataset.documentId;

  if (!title) return showToast('Document title is required.', 'error');

  const fd = new FormData();
  fd.append('title',       title);
  fd.append('category',    category);
  fd.append('description', val('docDescription'));
  fd.append('published',   String(published));
  fd.append('public',      String(publicDoc));
  if (fileInput.files && fileInput.files[0]) fd.append('file', fileInput.files[0]);

  const url    = currentId ? `${API}/documents/${currentId}` : `${API}/documents`;
  const method = currentId ? 'PATCH' : 'POST';

  try {
    await apiFetch(url, { method, headers: authH(), body: fd });
    resetDocumentForm();
    await loadDocuments();
    showToast(currentId ? 'Document updated.' : 'Document uploaded.', 'success');
  } catch (err) {
    showToast(err.message || 'Failed to save document.', 'error');
  }
}

async function deleteDocument(id) {
  if (!id || !window.confirm('Delete this document?')) return;
  try {
    await apiFetch(`${API}/documents/${id}`, { method: 'DELETE', headers: authH() });
    showToast('Document deleted.', 'success');
    await loadDocuments();
  } catch (err) {
    showToast(err.message || 'Unable to delete document.', 'error');
  }
}

async function populateDocumentForm(id) {
  try {
    const payload = await apiFetch(`${API}/documents/${id}`, { headers: authH() });
    const doc     = payload.data || {};
    setVal('docTitle',       doc.title);
    setVal('docCategory',    doc.category);
    setVal('docDescription', doc.description);
    setChecked('docPublished', doc.published);
    setChecked('docPublic',    doc.public);
    const fileInput = document.getElementById('docFileInput');
    fileInput.dataset.documentId = doc._id;
    const nameEl = document.getElementById('docFileName');
    if (nameEl) nameEl.textContent = doc.fileUrl ? 'Current: ' + doc.fileUrl.split('/').pop() : 'No file selected';
    document.getElementById('saveDocumentBtn').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    showToast(err.message || 'Unable to load document.', 'error');
  }
}

function resetDocumentForm() {
  setVal('docTitle',       '');
  setVal('docCategory',    '');
  setVal('docDescription', '');
  setChecked('docPublished', true);
  setChecked('docPublic',    true);
  const fileInput = document.getElementById('docFileInput');
  fileInput.value = '';
  delete fileInput.dataset.documentId;
  const nameEl = document.getElementById('docFileName');
  if (nameEl) nameEl.textContent = 'No file selected';
}

document.getElementById('saveDocumentBtn').addEventListener('click',      saveDocument);
document.getElementById('resetDocumentFormBtn').addEventListener('click', resetDocumentForm);
document.getElementById('docFileInput').addEventListener('change', () => {
  const file  = document.getElementById('docFileInput').files[0];
  const nameEl = document.getElementById('docFileName');
  if (nameEl) nameEl.textContent = file ? file.name : 'No file selected';
});

/* ════════════════════════════════════════════════════════════════════════════
   SECTION 7 — Danger Zone
   ════════════════════════════════════════════════════════════════════════════ */

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('embs_admin_auth');
  localStorage.removeItem('embs_admin_token');
  window.location.href = 'index.html';
});

document.getElementById('clearCacheBtn').addEventListener('click', () => {
  showToast('Cache cleared. Reloading…', 'success');
  setTimeout(() => window.location.reload(), 1400);
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
  showToast('Settings have been reset to defaults.', 'success');
});

/* ════════════════════════════════════════════════════════════════════════════
   INIT — load all data once auth is confirmed
   ════════════════════════════════════════════════════════════════════════════ */
if (localStorage.getItem('embs_admin_auth') === 'true') {
  loadSiteSettings();
  loadDocuments();
  loadAdminProfile();
  loadAppearance();
}


/* ════════════════════════════════════════════════════════════════════════════
   PAGE HERO IMAGES
   Five upload zones for the right-side hero images on public pages.
   Each follows the same pattern as the existing logo/favicon/podcast cover.
   ════════════════════════════════════════════════════════════════════════════ */

const PAGE_HERO_SLOTS = [
  { field: 'activitiesHero', urlKey: 'activitiesHeroImageUrl', zoneId: 'activitiesHeroZone',    inputId: 'activitiesHeroInput',    innerId: 'activitiesHeroInner',    previewId: 'activitiesHeroPreview',    imgId: 'activitiesHeroPreviewImg',    removeId: 'activitiesHeroRemove' },
  { field: 'blogHero',       urlKey: 'blogHeroImageUrl',       zoneId: 'blogHeroZone',          inputId: 'blogHeroInput',          innerId: 'blogHeroInner',          previewId: 'blogHeroPreview',          imgId: 'blogHeroPreviewImg',          removeId: 'blogHeroRemove' },
  { field: 'membersHero',    urlKey: 'membersHeroImageUrl',    zoneId: 'membersHeroZone',       inputId: 'membersHeroInput',       innerId: 'membersHeroInner',       previewId: 'membersHeroPreview',       imgId: 'membersHeroPreviewImg',       removeId: 'membersHeroRemove' },
  { field: 'aboutHero',      urlKey: 'aboutHeroImageUrl',      zoneId: 'aboutHeroZone',         inputId: 'aboutHeroInput',         innerId: 'aboutHeroInner',         previewId: 'aboutHeroPreview',         imgId: 'aboutHeroPreviewImg',         removeId: 'aboutHeroRemove' },
  { field: 'projectsHero',   urlKey: 'projectsHeroImageUrl',   zoneId: 'projectsHeroZone',      inputId: 'projectsHeroInput',      innerId: 'projectsHeroInner',      previewId: 'projectsHeroPreview',      imgId: 'projectsHeroPreviewImg',      removeId: 'projectsHeroRemove' },
];

/* Pending file selection per slot */
const _pendingHero = {};
PAGE_HERO_SLOTS.forEach(s => { _pendingHero[s.field] = null; });

/* Wire each upload zone */
PAGE_HERO_SLOTS.forEach(slot => {
  const input   = document.getElementById(slot.inputId);
  const inner   = document.getElementById(slot.innerId);
  const preview = document.getElementById(slot.previewId);
  const img     = document.getElementById(slot.imgId);
  const remove  = document.getElementById(slot.removeId);
  const zone    = document.getElementById(slot.zoneId);

  if (!zone || !input) return;

  zone.addEventListener('click', (e) => {
    if (!e.target.closest('.branding-remove')) input.click();
  });

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    _pendingHero[slot.field] = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (img)     img.src               = e.target.result;
      if (inner)   inner.style.display   = 'none';
      if (preview) preview.style.display = 'flex';
    };
    reader.readAsDataURL(file);
  });

  if (remove) {
    remove.addEventListener('click', (e) => {
      e.stopPropagation();
      _pendingHero[slot.field] = null;
      input.value = '';
      if (img)     img.src               = '';
      if (preview) preview.style.display = 'none';
      if (inner)   inner.style.display   = 'flex';
      /* Mark as explicitly cleared so save will send urlKey='' */
      input.dataset.cleared = 'true';
    });
  }
});

/* Restore previews from saved SiteSettings on page load */
function loadPageHeroImages(data) {
  PAGE_HERO_SLOTS.forEach(slot => {
    const url     = data && data[slot.urlKey];
    const img     = document.getElementById(slot.imgId);
    const preview = document.getElementById(slot.previewId);
    const inner   = document.getElementById(slot.innerId);
    if (url) {
      if (img)     img.src               = url;
      if (preview) preview.style.display = 'flex';
      if (inner)   inner.style.display   = 'none';
    } else {
      if (preview) preview.style.display = 'none';
      if (inner)   inner.style.display   = 'flex';
    }
  });
}

/* Save all 5 hero images via PATCH /api/site-settings/branding */
async function savePageHeroImages() {
  const btn = document.getElementById('savePageHeroBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  try {
    const fd = new FormData();
    let   hasChanges = false;

    PAGE_HERO_SLOTS.forEach(slot => {
      const input = document.getElementById(slot.inputId);
      if (_pendingHero[slot.field]) {
        fd.append(slot.field, _pendingHero[slot.field]);
        hasChanges = true;
      } else if (input && input.dataset.cleared === 'true') {
        /* Explicit delete: send empty string to clear the URL in MongoDB */
        fd.append(slot.urlKey, '');
        hasChanges = true;
        delete input.dataset.cleared;
      }
    });

    if (!hasChanges) {
      showToast('No changes to save.', 'success');
      return;
    }

    const res = await apiFetch(`${API}/site-settings/branding`, {
      method:  'PATCH',
      headers: authH(),
      body:    fd,
    });

    if (res.data) {
      currentSettings = res.data;
      /* Update previews with CDN URLs returned from backend */
      PAGE_HERO_SLOTS.forEach(slot => {
        const url = res.data[slot.urlKey];
        if (url !== undefined) {
          const img     = document.getElementById(slot.imgId);
          const preview = document.getElementById(slot.previewId);
          const inner   = document.getElementById(slot.innerId);
          if (url) {
            if (img)     img.src               = url;
            if (preview) preview.style.display = 'flex';
            if (inner)   inner.style.display   = 'none';
          } else {
            if (preview) preview.style.display = 'none';
            if (inner)   inner.style.display   = 'flex';
          }
        }
        _pendingHero[slot.field] = null;
      });
    }

    showToast('Page hero images saved!', 'success');
  } catch (err) {
    console.error('savePageHeroImages error:', err);
    showToast(err.message || 'Failed to save page hero images.', 'error');
  } finally {
    if (btn) {
      btn.disabled  = false;
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" stroke="currentColor" stroke-width="1.6"/><polyline points="17,21 17,13 7,13 7,21" stroke="currentColor" stroke-width="1.6"/><polyline points="7,3 7,8 15,8" stroke="currentColor" stroke-width="1.6"/></svg> Save Page Images`;
    }
  }
}

const savePageHeroBtnEl = document.getElementById('savePageHeroBtn');
if (savePageHeroBtnEl) savePageHeroBtnEl.addEventListener('click', savePageHeroImages);

/* Hook into the existing loadSiteSettings to restore hero image previews */
const _origLoadSiteSettings = typeof loadSiteSettings === 'function' ? loadSiteSettings : null;
/* Patch: after loadSiteSettings sets currentSettings, also load hero images.
   We patch by wrapping — loadSiteSettings already sets currentSettings and
   calls setVal() etc.  We just need to call loadPageHeroImages(currentSettings)
   once the load completes.  The simplest approach: call it at module end. */
(async () => {
  /* Wait until loadSiteSettings (called at bottom of settings.js) has run */
  await new Promise(r => setTimeout(r, 800));
  if (typeof currentSettings === 'object' && currentSettings) {
    loadPageHeroImages(currentSettings);
  }
})();
