if (localStorage.getItem('embs_admin_auth') !== 'true') window.location.href = 'index.html';
'use strict';

const API    = window.EMBS_API_BASE;
const TOKEN  = () => localStorage.getItem('embs_admin_token');
const authH  = () => ({ 'Authorization': `Bearer ${TOKEN()}` });

/* ── Sidebar Toggle ── */
const sidebar        = document.getElementById('sidebar');
const sidebarToggle  = document.getElementById('sidebarToggle');
const sidebarOverlay = document.getElementById('sidebarOverlay');
if (sidebarToggle) {
  sidebarToggle.addEventListener('click', () => { sidebar.classList.toggle('open'); sidebarOverlay.classList.toggle('active'); });
  sidebarOverlay.addEventListener('click', () => { sidebar.classList.remove('open'); sidebarOverlay.classList.remove('active'); });
}

let episodes      = [];
let editingId     = null;
let deleteTargetId = null;
let activeFilter  = 'all';   /* 'all' | 'published' | 'draft' */

/* ── DOM refs — episode form ── */
const episodeForm      = document.getElementById('episodeForm');
const epNumber         = document.getElementById('epNumber');
const epTitle          = document.getElementById('epTitle');
const epDuration       = document.getElementById('epDuration');
const epGuest          = document.getElementById('epGuest');
const epDesignation    = document.getElementById('epDesignation');
const epSpotify        = document.getElementById('epSpotify');
const epDesc           = document.getElementById('epDesc');
const coverInput       = document.getElementById('coverInput');
const coverPreview     = document.getElementById('coverPreview');
const coverImg         = document.getElementById('coverImg');
const coverInner       = document.getElementById('coverInner');
const coverRemove      = document.getElementById('coverRemove');
const episodeFormPanel = document.getElementById('episodeFormPanel');
const tableSearch      = document.getElementById('tableSearch');

/* ── Tags ── */
const tagsInput = document.getElementById('tagsInput');
const tagsList  = document.getElementById('tagsList');
let currentTags = [];   /* live tag array for the open form */

function renderTagsList() {
  if (!tagsList) return;
  tagsList.innerHTML = currentTags.map((t, i) =>
    `<span class="tag-item">${t}<button type="button" class="tag-remove" data-idx="${i}" aria-label="Remove tag ${t}">×</button></span>`
  ).join('');
  tagsList.querySelectorAll('.tag-remove').forEach(btn =>
    btn.addEventListener('click', () => {
      currentTags.splice(Number(btn.dataset.idx), 1);
      renderTagsList();
    })
  );
}

if (tagsInput) {
  tagsInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagsInput.value.trim().replace(/,+$/, '');
      if (val && !currentTags.includes(val)) { currentTags.push(val); renderTagsList(); }
      tagsInput.value = '';
    }
  });
}
const episodeTableBody = document.getElementById('episodeTableBody');
const tableCount       = document.getElementById('tableCount');
const tableEmpty       = document.getElementById('tableEmpty');
const deleteModal      = document.getElementById('deleteModal');
const deleteEpName     = document.getElementById('deleteEpName');
const toast            = document.getElementById('toast');

/* ══════════════════════════════════════════════
   EPISODE LOADING & STATS
══════════════════════════════════════════════ */
async function loadEpisodes() {
  try {
    /* ?drafts=true → backend isAdminRequest() returns ALL episodes (published + unpublished) */
    const res  = await fetch(`${API}/podcasts?drafts=true`, { headers: authH() });
    const data = await res.json();
    episodes = data.data || [];
    renderTable();
    updateStats();
  } catch {
    showToast('Failed to load episodes.', 'error');
  }
}

/* ── Stats row ──
   Root cause fix #5: publishBtn was missing from HTML so episodes were never
   marked published=true via the form. Now that buttons are restored, this
   counter reads the actual `published` boolean from MongoDB correctly. */
function updateStats() {
  const publishedCount = episodes.filter(e => e.published).length;
  document.getElementById('statTotal').textContent     = episodes.length;
  document.getElementById('statPublished').textContent = publishedCount;
  document.getElementById('statDraft').textContent     = episodes.length - publishedCount;
  document.getElementById('statGuests').textContent    =
    new Set(episodes.map(e => (e.guestName || '').trim().toLowerCase()).filter(Boolean)).size;
}

/* ══════════════════════════════════════════════
   RENDER TABLE
   Fix #7 (filter pills) + Fix #8 (quick publish toggle per row)
══════════════════════════════════════════════ */
function renderTable() {
  const q = (tableSearch.value || '').toLowerCase();

  /* Fix #7: apply activeFilter set by pill listeners below */
  let filtered = episodes.filter(e => {
    const matchFilter =
      activeFilter === 'all' ||
      (activeFilter === 'published' && e.published) ||
      (activeFilter === 'draft'     && !e.published);
    const matchSearch = !q ||
      (e.title          || '').toLowerCase().includes(q) ||
      (e.guestName      || '').toLowerCase().includes(q) ||
      (e.description    || '').toLowerCase().includes(q) ||
      String(e.episodeNumber || '').includes(q);
    return matchFilter && matchSearch;
  });

  filtered.sort((a, b) => Number(b.episodeNumber || 0) - Number(a.episodeNumber || 0));

  episodeTableBody.innerHTML = '';
  tableEmpty.style.display   = filtered.length === 0 ? 'flex' : 'none';
  tableCount.textContent     = `Showing ${filtered.length} episode${filtered.length !== 1 ? 's' : ''}`;

  filtered.forEach(ep => {
    const tr           = document.createElement('tr');
    const statusClass  = ep.published ? 'status-badge--published' : 'status-badge--draft';
    const statusLabel  = ep.published ? 'Published' : 'Draft';

    /* Fix #8: quick publish/unpublish toggle button in every row */
    const toggleLabel  = ep.published ? 'Unpublish' : 'Publish';
    const toggleClass  = ep.published ? 'action-btn--unpublish' : 'action-btn--publish-quick';

    tr.innerHTML = `
      <td><span class="td-ep-num">${ep.episodeNumber}</span></td>
      <td>
        <div class="td-title">${ep.title}</div>
        ${ep.spotifyUrl ? `<a class="td-spotify-link" href="${ep.spotifyUrl}" target="_blank" rel="noopener">Spotify ↗</a>` : ''}
      </td>
      <td>
        <div class="td-guest-name">${ep.guestName || ''}</div>
        <div class="td-guest-desig">${ep.guestDesignation || ''}</div>
      </td>
      <td><span class="td-duration">${ep.duration || ''}</span></td>
      <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
      <td>
        <div class="action-btns">
          <button class="action-btn ${toggleClass}" data-id="${ep._id}" data-published="${ep.published}">
            <svg viewBox="0 0 24 24" fill="none" width="12" height="12">
              ${ep.published
                ? '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>'
                : '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><polyline points="8,12 11,15 16,10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>'}
            </svg>
            ${toggleLabel}
          </button>
          <button class="action-btn action-btn--edit" data-id="${ep._id}">
            <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Edit
          </button>
          <button class="action-btn action-btn--delete" data-id="${ep._id}">
            <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><polyline points="3,6 5,6 21,6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
            Delete
          </button>
        </div>
      </td>`;
    episodeTableBody.appendChild(tr);
  });

  /* Attach per-row listeners after DOM is built */
  episodeTableBody.querySelectorAll('.action-btn--publish-quick, .action-btn--unpublish').forEach(btn =>
    btn.addEventListener('click', () => quickTogglePublish(btn.dataset.id, btn.dataset.published === 'true'))
  );
  episodeTableBody.querySelectorAll('.action-btn--edit').forEach(btn =>
    btn.addEventListener('click', () => loadEdit(btn.dataset.id))
  );
  episodeTableBody.querySelectorAll('.action-btn--delete').forEach(btn =>
    btn.addEventListener('click', () => openDeleteModal(btn.dataset.id))
  );
}

/* ── Quick publish/unpublish toggle (Fix #8) ──
   PATCH /api/podcasts/:id  { published: !current }
   On success → update local episodes array + re-render (no full reload needed) */
async function quickTogglePublish(id, currentlyPublished) {
  try {
    const newState = !currentlyPublished;
    const fd = new FormData();
    fd.append('published', String(newState));
    const res  = await fetch(`${API}/podcasts/${id}`, { method: 'PATCH', headers: authH(), body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    /* Update local state without another network request */
    const ep = episodes.find(e => e._id === id);
    if (ep) ep.published = newState;

    renderTable();
    updateStats();
    showToast(newState ? 'Episode published.' : 'Episode moved to drafts.', 'success');
  } catch (err) {
    showToast(err.message || 'Failed to update publish state.', 'error');
  }
}

/* ── Filter pill listeners (Fix #7) ── */
document.querySelectorAll('.filter-bar .filter-pill').forEach(pill => {
  pill.addEventListener('click', function () {
    document.querySelectorAll('.filter-bar .filter-pill').forEach(p => p.classList.remove('active'));
    this.classList.add('active');
    activeFilter = this.dataset.filter;
    renderTable();
  });
});

/* ── Search ── */
tableSearch.addEventListener('input', renderTable);

/* ══════════════════════════════════════════════
   EPISODE COVER UPLOAD
══════════════════════════════════════════════ */
coverInput.addEventListener('change', () => handleCoverFile(coverInput.files[0]));
function handleCoverFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    coverImg.src = e.target.result;
    coverPreview.style.display = 'flex';
    coverInner.style.display   = 'none';
  };
  reader.readAsDataURL(file);
}
coverRemove.addEventListener('click', e => {
  e.stopPropagation();
  coverImg.src = '';
  coverPreview.style.display = 'none';
  coverInner.style.display   = 'flex';
  coverInput.value = '';
});

/* ══════════════════════════════════════════════
   COLLECT FORM DATA
══════════════════════════════════════════════ */
function collectForm(isPublished) {
  const num   = parseInt(epNumber.value);
  const title = epTitle.value.trim();
  const dur   = epDuration.value.trim();
  const guest = epGuest.value.trim();
  if (!num || !title || !dur || !guest) {
    showToast('Please fill in Episode No., Title, Duration and Guest Name.', 'error');
    return null;
  }
  const fd = new FormData();
  fd.append('episodeNumber',    num);
  fd.append('title',            title);
  fd.append('guestName',        guest);
  fd.append('guestDesignation', epDesignation.value.trim());
  fd.append('spotifyUrl',       epSpotify.value.trim());
  fd.append('audioUrl',         (document.getElementById('epAudioUrl') || {value:''}).value.trim());
  fd.append('duration',         dur);
  fd.append('description',      epDesc.value.trim());
  fd.append('published',        String(Boolean(isPublished)));
  /* Append each tag individually so the backend receives tags[] */
  currentTags.forEach(t => fd.append('tags', t));
  fd.append('showInUpdates',    String(Boolean(
    document.getElementById('podShowInUpdates') &&
    document.getElementById('podShowInUpdates').checked
  )));
  if (coverInput.files[0]) fd.append('thumbnail', coverInput.files[0]);
  return fd;
}

/* ══════════════════════════════════════════════
   SAVE / PUBLISH  (Fix #5 — buttons now exist in HTML)
══════════════════════════════════════════════ */
document.getElementById('saveDraftBtn').addEventListener('click', async () => {
  const fd = collectForm(false);
  if (!fd) return;
  await saveEpisode(fd, false);
});

document.getElementById('publishBtn').addEventListener('click', async () => {
  const fd = collectForm(true);
  if (!fd) return;
  await saveEpisode(fd, true);
});

async function saveEpisode(fd, isPublished) {
  try {
    const url    = editingId ? `${API}/podcasts/${editingId}` : `${API}/podcasts`;
    const method = editingId ? 'PATCH' : 'POST';
    const res    = await fetch(url, { method, headers: authH(), body: fd });
    const data   = await res.json();
    if (!res.ok) throw new Error(data.message);
    showToast(
      isPublished
        ? `EP ${epNumber.value} published successfully.`
        : 'Episode saved as draft.',
      'success'
    );
    resetForm();
    await loadEpisodes();
  } catch (err) {
    showToast(err.message || 'Failed to save episode.', 'error');
  }
}

/* ══════════════════════════════════════════════
   EDIT
══════════════════════════════════════════════ */
function loadEdit(id) {
  const ep = episodes.find(e => e._id === id);
  if (!ep) return;
  editingId           = id;
  epNumber.value      = ep.episodeNumber;
  epTitle.value       = ep.title;
  epDuration.value    = ep.duration       || '';
  epGuest.value       = ep.guestName      || '';
  epDesignation.value = ep.guestDesignation || '';
  epSpotify.value     = ep.spotifyUrl     || '';
  const epAudioUrlEl = document.getElementById('epAudioUrl');
  if (epAudioUrlEl) epAudioUrlEl.value = ep.audioUrl || '';
  epDesc.value        = ep.description    || '';
  /* Restore tags */
  currentTags = Array.isArray(ep.tags) ? ep.tags.slice() : [];
  renderTagsList();
  if (tagsInput) tagsInput.value = '';

  /* Restore episode thumbnail preview */
  if (ep.thumbnail) {
    coverImg.src                   = ep.thumbnail;
    coverPreview.style.display     = 'flex';
    coverInner.style.display       = 'none';
  } else {
    coverImg.src                   = '';
    coverPreview.style.display     = 'none';
    coverInner.style.display       = 'flex';
  }

  /* Restore showInUpdates toggle */
  const siuCb = document.getElementById('podShowInUpdates');
  if (siuCb) {
    siuCb.checked = Boolean(ep.showInUpdates);
    applyUpdatesToggle(Boolean(ep.showInUpdates));
  }

  document.getElementById('formPanelTitle').textContent =
    `Edit Episode — EP ${ep.episodeNumber}`;
  episodeFormPanel.classList.remove('collapsed');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ══════════════════════════════════════════════
   DELETE
══════════════════════════════════════════════ */
function openDeleteModal(id) {
  const ep = episodes.find(e => e._id === id);
  if (!ep) return;
  deleteTargetId = id;
  deleteEpName.textContent = `EP ${ep.episodeNumber}: ${ep.title}`;
  deleteModal.style.display = 'flex';
}
document.getElementById('cancelDelete').addEventListener('click', () => {
  deleteModal.style.display = 'none';
  deleteTargetId = null;
});
deleteModal.addEventListener('click', e => {
  if (e.target === deleteModal) { deleteModal.style.display = 'none'; deleteTargetId = null; }
});
document.getElementById('confirmDelete').addEventListener('click', async () => {
  try {
    const res = await fetch(`${API}/podcasts/${deleteTargetId}`, { method: 'DELETE', headers: authH() });
    if (!res.ok) throw new Error();
    deleteModal.style.display = 'none';
    deleteTargetId = null;
    showToast('Episode deleted.', 'delete');
    await loadEpisodes();
  } catch {
    showToast('Failed to delete episode.', 'error');
  }
});

/* ══════════════════════════════════════════════
   RESET FORM
══════════════════════════════════════════════ */
function resetForm() {
  editingId = null;
  episodeForm.reset();
  const epAudioUrlEl = document.getElementById('epAudioUrl');
  if (epAudioUrlEl) epAudioUrlEl.value = '';
  /* Clear tags */
  currentTags = [];
  renderTagsList();
  if (tagsInput) tagsInput.value = '';
  coverImg.src               = '';
  coverPreview.style.display = 'none';
  coverInner.style.display   = 'flex';
  coverInput.value           = '';
  const siuCb = document.getElementById('podShowInUpdates');
  if (siuCb) { siuCb.checked = false; applyUpdatesToggle(false); }
  document.getElementById('formPanelTitle').textContent = 'Add New Episode';
}
document.getElementById('resetFormBtn').addEventListener('click', resetForm);

/* ══════════════════════════════════════════════
   FORM COLLAPSE / TOGGLE
══════════════════════════════════════════════ */
document.getElementById('collapseFormBtn').addEventListener('click', () =>
  episodeFormPanel.classList.toggle('collapsed')
);
document.getElementById('toggleFormBtn').addEventListener('click', () => {
  episodeFormPanel.classList.remove('collapsed');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ══════════════════════════════════════════════
   SHOW IN UPDATES TOGGLE
══════════════════════════════════════════════ */
function applyUpdatesToggle(v) {
  const track = document.getElementById('podUpdatesTrack');
  const thumb = document.getElementById('podUpdatesThumb');
  if (track) track.style.background = v ? 'rgba(0,169,157,0.85)' : 'rgba(107,45,139,0.2)';
  if (thumb) thumb.style.transform  = v ? 'translateX(18px)'     : 'translateX(0)';
}
(function () {
  const cb = document.getElementById('podShowInUpdates');
  if (cb) {
    cb.addEventListener('change', () => applyUpdatesToggle(cb.checked));
    applyUpdatesToggle(cb.checked);
  }
})();

/* ══════════════════════════════════════════════
   GENERAL PODCAST COVER  (Part 1 — displayed in podcast.html panel)
   Uses the existing SiteSettings.podcastCoverUrl field.
   Uploads via PATCH /api/site-settings/branding  { podcastCover: <file> }
══════════════════════════════════════════════ */
const gcInput   = document.getElementById('gcInput');
const gcInner   = document.getElementById('gcInner');
const gcPreview = document.getElementById('gcPreview');
const gcImg     = document.getElementById('gcImg');
const gcRemove  = document.getElementById('gcRemove');
const gcSaveBtn = document.getElementById('gcSaveBtn');

let _pendingGcFile   = null;
let _currentGcUrl    = '';

/* Load current general cover from SiteSettings */
async function loadGeneralCover() {
  try {
    const res  = await fetch(`${API}/site-settings/public`);
    const data = await res.json();
    const url  = data && data.data && data.data.podcastCoverUrl;
    _currentGcUrl = url || '';
    if (_currentGcUrl && gcImg && gcPreview && gcInner) {
      gcImg.src              = _currentGcUrl;
      gcPreview.style.display = 'flex';
      gcInner.style.display   = 'none';
    }
  } catch { /* silent — cover simply shows placeholder */ }
}

if (gcInput) {
  gcInput.addEventListener('change', () => {
    const file = gcInput.files[0];
    if (!file) return;
    _pendingGcFile = file;
    const reader = new FileReader();
    reader.onload = e => {
      gcImg.src              = e.target.result;
      gcPreview.style.display = 'flex';
      gcInner.style.display   = 'none';
    };
    reader.readAsDataURL(file);
  });
}

if (gcRemove) {
  gcRemove.addEventListener('click', e => {
    e.stopPropagation();
    _pendingGcFile = null;
    gcImg.src              = '';
    gcPreview.style.display = 'none';
    gcInner.style.display   = 'flex';
    if (gcInput) gcInput.value = '';
  });
}

if (gcSaveBtn) {
  gcSaveBtn.addEventListener('click', async () => {
    if (!_pendingGcFile) {
      showToast('Please select a cover image first.', 'error');
      return;
    }
    try {
      gcSaveBtn.disabled    = true;
      gcSaveBtn.textContent = 'Saving…';
      const fd = new FormData();
      fd.append('podcastCover', _pendingGcFile);
      const res  = await fetch(`${API}/site-settings/branding`, {
        method: 'PATCH', headers: authH(), body: fd
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      _currentGcUrl  = (data.data && data.data.podcastCoverUrl) || _currentGcUrl;
      _pendingGcFile = null;
      if (gcInput) gcInput.value = '';
      showToast('General podcast cover saved.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to save cover.', 'error');
    } finally {
      gcSaveBtn.disabled    = false;
      gcSaveBtn.textContent = 'Save Cover';
    }
  });
}

/* ══════════════════════════════════════════════
   TOAST
══════════════════════════════════════════════ */
let toastTimer;
function showToast(msg, type = 'success') {
  toast.textContent  = msg;
  toast.className    = `toast toast--${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

/* ── Init ── */
loadGeneralCover();
loadEpisodes();
