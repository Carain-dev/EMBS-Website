if (localStorage.getItem('embs_admin_auth') !== 'true') window.location.href = 'index.html';
'use strict';

const API = window.EMBS_API_BASE;
const TOKEN = () => localStorage.getItem('embs_admin_token');
const authH = () => ({ 'Authorization': `Bearer ${TOKEN()}` });

/* ── Sidebar Toggle ── */
const sidebar        = document.getElementById('sidebar');
const sidebarToggle  = document.getElementById('sidebarToggle');
const sidebarOverlay = document.getElementById('sidebarOverlay');
if (sidebarToggle) {
  sidebarToggle.addEventListener('click', () => { sidebar.classList.toggle('open'); sidebarOverlay.classList.toggle('active'); });
  sidebarOverlay.addEventListener('click', () => { sidebar.classList.remove('open'); sidebarOverlay.classList.remove('active'); });
}

let episodes = [];
let editingId = null;
let deleteTargetId = null;
let tags = [];
let activeFilter = 'all';

/* ── DOM ── */
const episodeForm      = document.getElementById('episodeForm');
const epNumber         = document.getElementById('epNumber');
const epTitle          = document.getElementById('epTitle');
const epDuration       = document.getElementById('epDuration');
const epGuest          = document.getElementById('epGuest');
const epDesignation    = document.getElementById('epDesignation');
const epSpotify        = document.getElementById('epSpotify');
const epDesc           = document.getElementById('epDesc');
const coverInput       = document.getElementById('coverInput');
const coverZone        = document.getElementById('coverZone');
const coverPreview     = document.getElementById('coverPreview');
const coverImg         = document.getElementById('coverImg');
const coverInner       = document.getElementById('coverInner');
const coverRemove      = document.getElementById('coverRemove');
const tagsWrap         = document.getElementById('tagsWrap');
const tagsList         = document.getElementById('tagsList');
const tagsInput        = document.getElementById('tagsInput');
const episodeFormPanel = document.getElementById('episodeFormPanel');
const tableSearch      = document.getElementById('tableSearch');
const episodeTableBody = document.getElementById('episodeTableBody');
const tableCount       = document.getElementById('tableCount');
const tableEmpty       = document.getElementById('tableEmpty');
const deleteModal      = document.getElementById('deleteModal');
const deleteEpName     = document.getElementById('deleteEpName');
const toast            = document.getElementById('toast');

/* ── Load ── */
async function loadEpisodes() {
  try {
    const res = await fetch(`${API}/podcasts`);
    const data = await res.json();
    episodes = data.data || [];
    renderTable(); updateStats();
  } catch { showToast('Failed to load episodes.', 'error'); }
}

/* ── Stats ── */
function updateStats() {
  document.getElementById('statTotal').textContent     = episodes.length;
  document.getElementById('statPublished').textContent = episodes.length;
  document.getElementById('statDraft').textContent     = 0;
  document.getElementById('statGuests').textContent    = new Set(episodes.map(e => (e.guestName||'').trim().toLowerCase()).filter(Boolean)).size;
}

/* ── Render Table ── */
function renderTable() {
  const q = tableSearch.value.toLowerCase();
  let filtered = episodes.filter(e => {
    const matchSearch = !q ||
      (e.title||'').toLowerCase().includes(q) ||
      (e.guestName||'').toLowerCase().includes(q);
    return matchSearch;
  });
  filtered.sort((a, b) => b.episodeNumber - a.episodeNumber);

  episodeTableBody.innerHTML = '';
  tableEmpty.style.display = filtered.length === 0 ? 'flex' : 'none';
  tableCount.textContent = `Showing ${filtered.length} episode${filtered.length !== 1 ? 's' : ''}`;

  filtered.forEach(ep => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="td-ep-num">${ep.episodeNumber}</span></td>
      <td>
        <div class="td-title">${ep.title}</div>
        ${ep.spotifyUrl ? `<a class="td-spotify-link" href="${ep.spotifyUrl}" target="_blank" rel="noopener">Spotify</a>` : ''}
      </td>
      <td>
        <div class="td-guest-name">${ep.guestName||''}</div>
        <div class="td-guest-desig">${ep.guestDesignation||''}</div>
      </td>
      <td><span class="td-duration">${ep.duration||''}</span></td>
      <td><span class="status-badge status-badge--published">Published</span></td>
      <td><div class="action-btns">
        <button class="action-btn action-btn--edit" data-id="${ep._id}">
          <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg> Edit
        </button>
        <button class="action-btn action-btn--delete" data-id="${ep._id}">
          <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><polyline points="3,6 5,6 21,6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg> Delete
        </button>
      </div></td>`;
    episodeTableBody.appendChild(tr);
  });

  episodeTableBody.querySelectorAll('.action-btn--edit').forEach(btn =>
    btn.addEventListener('click', () => loadEdit(btn.dataset.id))
  );
  episodeTableBody.querySelectorAll('.action-btn--delete').forEach(btn =>
    btn.addEventListener('click', () => openDeleteModal(btn.dataset.id))
  );
}

/* ── Tags ── */
function renderTags() {
  tagsList.innerHTML = tags.map((t, i) =>
    `<span class="tag-chip">${t}<button class="tag-chip-remove" data-i="${i}" type="button">×</button></span>`
  ).join('');
  tagsList.querySelectorAll('.tag-chip-remove').forEach(btn =>
    btn.addEventListener('click', () => { tags.splice(parseInt(btn.dataset.i), 1); renderTags(); })
  );
}
tagsInput.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ',') && tagsInput.value.trim()) {
    e.preventDefault();
    const val = tagsInput.value.trim().replace(/,$/, '');
    if (val && !tags.includes(val)) { tags.push(val); renderTags(); }
    tagsInput.value = '';
  }
  if (e.key === 'Backspace' && !tagsInput.value && tags.length) { tags.pop(); renderTags(); }
});
tagsWrap.addEventListener('click', () => tagsInput.focus());

/* ── Cover Upload ── */
coverInput.addEventListener('change', () => handleCoverFile(coverInput.files[0]));
function handleCoverFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => { coverImg.src = e.target.result; coverPreview.style.display = 'flex'; coverInner.style.display = 'none'; };
  reader.readAsDataURL(file);
}
coverRemove.addEventListener('click', e => {
  e.stopPropagation(); coverImg.src = ''; coverPreview.style.display = 'none';
  coverInner.style.display = 'flex'; coverInput.value = '';
});

/* ── Collect Form ── */
function collectForm() {
  const num   = parseInt(epNumber.value);
  const title = epTitle.value.trim();
  const dur   = epDuration.value.trim();
  const guest = epGuest.value.trim();
  if (!num || !title || !dur || !guest) { showToast('Please fill in all required fields.', 'error'); return null; }
  const fd = new FormData();
  fd.append('episodeNumber',    num);
  fd.append('title',            title);
  fd.append('guestName',        guest);
  fd.append('guestDesignation', epDesignation.value.trim());
  fd.append('spotifyUrl',       epSpotify.value.trim());
  fd.append('duration',         dur);
  fd.append('description',      epDesc.value.trim());
  if (coverInput.files[0]) fd.append('thumbnail', coverInput.files[0]);
  return fd;
}

/* ── Save ── */
document.getElementById('saveDraftBtn').addEventListener('click', async () => {
  const fd = collectForm(); if (!fd) return;
  await saveEpisode(fd);
  showToast('Episode saved!', 'success');
});
document.getElementById('publishBtn').addEventListener('click', async () => {
  const fd = collectForm(); if (!fd) return;
  await saveEpisode(fd);
  showToast(`EP ${epNumber.value} published!`, 'success');
});

async function saveEpisode(fd) {
  try {
    const url    = editingId ? `${API}/podcasts/${editingId}` : `${API}/podcasts`;
    const method = editingId ? 'PATCH' : 'POST';
    const res    = await fetch(url, { method, headers: authH(), body: fd });
    const data   = await res.json();
    if (!res.ok) throw new Error(data.message);
    resetForm(); await loadEpisodes();
  } catch (err) { showToast(err.message || 'Failed to save.', 'error'); }
}

/* ── Edit ── */
function loadEdit(id) {
  const ep = episodes.find(e => e._id === id); if (!ep) return;
  editingId = id;
  epNumber.value      = ep.episodeNumber;
  epTitle.value       = ep.title;
  epDuration.value    = ep.duration;
  epGuest.value       = ep.guestName || '';
  epDesignation.value = ep.guestDesignation || '';
  epSpotify.value     = ep.spotifyUrl || '';
  epDesc.value        = ep.description || '';
  if (ep.thumbnail) { coverImg.src = ep.thumbnail; coverPreview.style.display = 'flex'; coverInner.style.display = 'none'; }
  document.getElementById('formPanelTitle').textContent = `Edit Episode — EP ${ep.episodeNumber}`;
  episodeFormPanel.classList.remove('collapsed');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Delete ── */
function openDeleteModal(id) {
  const ep = episodes.find(e => e._id === id); if (!ep) return;
  deleteTargetId = id;
  deleteEpName.textContent = `EP ${ep.episodeNumber}: ${ep.title}`;
  deleteModal.style.display = 'flex';
}
document.getElementById('cancelDelete').addEventListener('click', () => { deleteModal.style.display = 'none'; deleteTargetId = null; });
deleteModal.addEventListener('click', e => { if (e.target === deleteModal) { deleteModal.style.display = 'none'; deleteTargetId = null; } });
document.getElementById('confirmDelete').addEventListener('click', async () => {
  try {
    const res = await fetch(`${API}/podcasts/${deleteTargetId}`, { method: 'DELETE', headers: authH() });
    if (!res.ok) throw new Error();
    deleteModal.style.display = 'none'; deleteTargetId = null;
    showToast('Episode deleted.', 'delete'); await loadEpisodes();
  } catch { showToast('Failed to delete.', 'error'); }
});

/* ── Reset ── */
function resetForm() {
  editingId = null; episodeForm.reset(); tags = []; renderTags();
  coverImg.src = ''; coverPreview.style.display = 'none'; coverInner.style.display = 'flex'; coverInput.value = '';
  document.getElementById('formPanelTitle').textContent = 'Add New Episode';
}
document.getElementById('resetFormBtn').addEventListener('click', resetForm);

/* ── Collapse / Toggle ── */
document.getElementById('collapseFormBtn').addEventListener('click', () => episodeFormPanel.classList.toggle('collapsed'));
document.getElementById('toggleFormBtn').addEventListener('click', () => {
  episodeFormPanel.classList.remove('collapsed'); window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ── Search ── */
tableSearch.addEventListener('input', renderTable);

/* ── Toast ── */
let toastTimer;
function showToast(msg, type = 'success') {
  toast.textContent = msg; toast.className = `toast toast--${type} show`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

loadEpisodes();

