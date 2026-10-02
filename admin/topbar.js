'use strict';
/**
 * topbar.js — Shared topbar controls for all admin pages.
 *
 * 1. Notification / bell button (.topbar-btn / .topbar-notice):
 *    - Removes the hardcoded fake "3" badge.
 *    - Clicking navigates to announcements.html (the real notices source).
 *
 * 2. Admin profile button (.topbar-profile):
 *    - Opens a small dropdown with:
 *        • Admin name (from localStorage embs_admin_profile or "Admin")
 *        • Go to Settings
 *        • Logout
 *    - Logout clears embs_admin_auth + embs_admin_token and redirects to index.html.
 *
 * Loaded once via <script src="topbar.js"> on every admin page.
 * Does not depend on any backend API.
 * Does not expose tokens, passwords, or sensitive data.
 */

(function () {

  /* ── 1. Bell / Notices button ────────────────────────────── */

  var noticeBtn = document.querySelector('.topbar-btn');
  if (noticeBtn) {
    /* Remove the hardcoded fake "3" badge */
    var badge = noticeBtn.querySelector('.topbar-badge');
    if (badge) badge.remove();

    /* Clicking navigates to Announcements (the real notices source) */
    noticeBtn.addEventListener('click', function () {
      window.location.href = 'announcements.html';
    });

    /* Cursor hint */
    noticeBtn.style.cursor = 'pointer';
    noticeBtn.title = 'Go to Announcements';
  }

  /* ── 2. Admin profile button & dropdown ─────────────────── */

  var profileBtn = document.querySelector('.topbar-profile');
  if (!profileBtn) return;

  /* Read the saved admin name from localStorage if available */
  var savedProfile = {};
  try { savedProfile = JSON.parse(localStorage.getItem('embs_admin_profile') || '{}'); } catch (_) {}
  var adminName = savedProfile.name || 'Admin';

  /* Update the visible name in the button */
  var nameSpan = profileBtn.querySelector('.topbar-profile-name');
  if (nameSpan) nameSpan.textContent = adminName;

  /* Update the avatar initial */
  var avatarEl = profileBtn.querySelector('.topbar-avatar');
  if (avatarEl && adminName) avatarEl.textContent = adminName.charAt(0).toUpperCase();

  /* Build the dropdown element */
  var dropdown = document.createElement('div');
  dropdown.id = 'topbarProfileDropdown';
  dropdown.setAttribute('role', 'menu');
  dropdown.style.cssText = [
    'position:absolute',
    'top:calc(100% + 8px)',
    'right:0',
    'min-width:180px',
    'background:#0e1226',
    'border:1px solid rgba(107,45,139,0.35)',
    'border-radius:12px',
    'box-shadow:0 8px 32px rgba(0,0,0,0.5)',
    'padding:0.5rem 0',
    'z-index:20000',
    'display:none',
    'backdrop-filter:blur(12px)',
    '-webkit-backdrop-filter:blur(12px)',
  ].join(';');

  var itemStyle = [
    'display:flex',
    'align-items:center',
    'gap:0.6rem',
    'width:100%',
    'padding:0.6rem 1rem',
    'font-family:var(--font-body,"DM Sans",sans-serif)',
    'font-size:0.82rem',
    'color:rgba(200,210,230,0.8)',
    'background:none',
    'border:none',
    'cursor:pointer',
    'text-align:left',
    'text-decoration:none',
    'transition:background 0.15s,color 0.15s',
  ].join(';');

  /* Header row — shows admin name */
  var header = document.createElement('div');
  header.style.cssText = 'padding:0.6rem 1rem 0.5rem;border-bottom:1px solid rgba(107,45,139,0.2);margin-bottom:0.25rem;';
  header.innerHTML = '<span style="font-family:var(--font-body,sans-serif);font-size:0.75rem;color:rgba(200,210,230,0.45);text-transform:uppercase;letter-spacing:0.08em;">Signed in as</span><br>' +
    '<strong style="font-family:var(--font-heading,sans-serif);font-size:0.88rem;color:#e8eaf6;">' + adminName + '</strong>';
  dropdown.appendChild(header);

  /* Settings link */
  var settingsLink = document.createElement('a');
  settingsLink.href = 'settings.html';
  settingsLink.setAttribute('role', 'menuitem');
  settingsLink.style.cssText = itemStyle;
  settingsLink.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="flex-shrink:0"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" stroke-width="1.6"/></svg>' +
    'Settings';
  settingsLink.addEventListener('mouseover', function () { this.style.background = 'rgba(107,45,139,0.15)'; this.style.color = '#e8eaf6'; });
  settingsLink.addEventListener('mouseout',  function () { this.style.background = 'none'; this.style.color = 'rgba(200,210,230,0.8)'; });
  dropdown.appendChild(settingsLink);

  /* Divider */
  var divider = document.createElement('div');
  divider.style.cssText = 'height:1px;background:rgba(107,45,139,0.2);margin:0.25rem 0;';
  dropdown.appendChild(divider);

  /* Logout button */
  var logoutBtn = document.createElement('button');
  logoutBtn.setAttribute('role', 'menuitem');
  logoutBtn.style.cssText = itemStyle + ';color:rgba(239,68,68,0.8);';
  logoutBtn.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="flex-shrink:0"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><polyline points="16,17 21,12 16,7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' +
    'Logout';
  logoutBtn.addEventListener('mouseover', function () { this.style.background = 'rgba(239,68,68,0.08)'; this.style.color = '#ef4444'; });
  logoutBtn.addEventListener('mouseout',  function () { this.style.background = 'none'; this.style.color = 'rgba(239,68,68,0.8)'; });
  logoutBtn.addEventListener('click', function () {
    localStorage.removeItem('embs_admin_auth');
    localStorage.removeItem('embs_admin_token');
    window.location.href = 'index.html';
  });
  dropdown.appendChild(logoutBtn);

  /* Attach dropdown to a positioned wrapper */
  profileBtn.style.position = 'relative';
  profileBtn.appendChild(dropdown);

  /* Toggle open/close */
  var isOpen = false;
  function openDropdown()  { dropdown.style.display = 'block'; isOpen = true; profileBtn.setAttribute('aria-expanded', 'true'); }
  function closeDropdown() { dropdown.style.display = 'none';  isOpen = false; profileBtn.setAttribute('aria-expanded', 'false'); }

  profileBtn.setAttribute('aria-haspopup', 'true');
  profileBtn.setAttribute('aria-expanded', 'false');
  profileBtn.style.cursor = 'pointer';

  profileBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    isOpen ? closeDropdown() : openDropdown();
  });

  /* Close when clicking outside */
  document.addEventListener('click', function (e) {
    if (isOpen && !profileBtn.contains(e.target)) closeDropdown();
  });

  /* Close on Escape */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) { closeDropdown(); profileBtn.focus(); }
  });

})();
