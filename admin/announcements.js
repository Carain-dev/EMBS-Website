if (localStorage.getItem('embs_admin_auth') !== 'true') window.location.href = 'index.html';
'use strict';

const API = window.EMBS_API_BASE;
const TOKEN = () => localStorage.getItem('embs_admin_token');
const authH = () => ({ 'Authorization': `Bearer ${TOKEN()}` });
const jsonH = () => ({ 'Authorization': `Bearer ${TOKEN()}`, 'Content-Type': 'application/json' });

/* ── Sidebar Toggle ── */
const sidebar = document.getElementById('sidebar');
const toggle  = document.getElementById('sidebarToggle');
const overlay = document.getElementById('sidebarOverlay');
toggle.addEventListener('click', () => { sidebar.classList.toggle('open'); overlay.classList.toggle('active'); });
overlay.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('active'); });

let announcements = [];
let editingId = null;
let deleteTarget = null;
let activeFilter = 'all';

/* ── Load ── */
async function loadAnnouncements() {
  try {
    const res = await fetch(`${API}/announcements`);
    const data = await res.json();
    announcements = data.data || [];
    renderTable(); updateStats();
  } catch { showToast('Failed to load announcements.', 'error'); }
}

/* ── Stats ── */
function updateStats() {
  document.getElementById('statTotal').textContent     = announcements.length;
  document.getElementById('statPublished').textContent = announcements.length;
  document.getElementById('statDraft').textContent     = 0;
  document.getElementById('statUrgent').textContent    = announcements.filter(a => a.pinned).length;
  document.getElementById('statExpired').textContent   = announcements.filter(a => a.expiresAt && new Date(a.expiresAt) < new Date()).length;
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

/* ── Render Table ── */
function renderTable() {
  const q     = document.getElementById('tableSearch').value.toLowerCase();
  const tbody = document.getElementById('annTableBody');
  const empty = document.getElementById('tableEmpty');
  const count = document.getElementById('tableCount');

  const filtered = announcements.filter(a => {
    if (q && !((a.title||'').toLowerCase().includes(q) || (a.body||'').toLowerCase().includes(q))) return false;
    return true;
  });

  count.textContent = `Showing ${filtered.length} announcement${filtered.length !== 1 ? 's' : ''}`;
  if (!filtered.length) { tbody.innerHTML = ''; empty.style.display = 'flex'; return; }
  empty.style.display = 'none';

  tbody.innerHTML = filtered.map(a => {
    const expired = a.expiresAt && new Date(a.expiresAt) < new Date();
    const expiryHTML = a.expiresAt
      ? `<span class="td-expiry ${expired ? 'td-expiry--past' : ''}">${fmtDate(a.expiresAt)}</span>`
      : `<span class="td-expiry td-expiry--none">No expiry</span>`;
    return `<tr data-id="${a._id}">
      <td>
        <div class="td-ann-title" title="${a.title}">${a.title}</div>
        <div class="td-ann-body">${(a.body||'').slice(0,80)}${(a.body||'').length > 80 ? '...' : ''}</div>
      </td>
      <td><span class="priority-badge priority-badge--${a.pinned ? 'urgent' : 'normal'}">${a.pinned ? 'Pinned' : 'Normal'}</span></td>
      <td>${expiryHTML}</td>
      <td><span class="status-badge status-badge--${expired ? 'draft' : 'published'}">${expired ? 'Expired' : 'Published'}</span></td>
      <td><div class="action-btns">
        <button class="action-btn action-btn--edit" onclick="editAnn('${a._id}')">
          <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Edit
        </button>
        <button class="action-btn action-btn--delete" onclick="openDeleteModal('${a._id}')">
          <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><polyline points="3,6 5,6 21,6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Delete
        </button>
      </div></td>
    </tr>`;
  }).join('');
}

/* ── Form Panel ── */
const formPanel = document.getElementById('annFormPanel');
document.getElementById('collapseFormBtn').addEventListener('click', () => formPanel.classList.toggle('collapsed'));
document.getElementById('toggleFormBtn').addEventListener('click', () => {
  resetForm(); formPanel.classList.remove('collapsed');
  formPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

function resetForm() {
  document.getElementById('annForm').reset();
  editingId = null;
  document.getElementById('formPanelTitle').textContent = 'New Announcement';
  document.getElementById('publishBtn').textContent     = 'Publish';
}
document.getElementById('resetFormBtn').addEventListener('click', resetForm);

function getFormData() {
  return {
    title:     document.getElementById('annTitle').value.trim(),
    body:      document.getElementById('annBody').value.trim(),
    pinned:    document.getElementById('annPriority')?.value === 'urgent',
    expiresAt: document.getElementById('annExpiry')?.value || null,
  };
}

function validate() {
  const title = document.getElementById('annTitle').value.trim();
  const body  = document.getElementById('annBody').value.trim();
  if (!title) { showToast('Please enter a title.', 'error'); return false; }
  if (!body)  { showToast('Please enter the announcement content.', 'error'); return false; }
  return true;
}

/* ── Save Draft ── */
document.getElementById('saveDraftBtn').addEventListener('click', async () => {
  if (!validate()) return;
  await saveAnn();
  showToast('Announcement saved.', 'draft');
});

/* ── Publish ── */
document.getElementById('publishBtn').addEventListener('click', async () => {
  if (!validate()) return;
  await saveAnn();
  showToast(editingId ? 'Announcement updated.' : 'Announcement published.', 'success');
});

async function saveAnn() {
  const body = getFormData();
  try {
    const url    = editingId ? `${API}/announcements/${editingId}` : `${API}/announcements`;
    const method = editingId ? 'PATCH' : 'POST';
    const res    = await fetch(url, { method, headers: jsonH(), body: JSON.stringify(body) });
    const data   = await res.json();
    if (!res.ok) throw new Error(data.message);
    resetForm(); formPanel.classList.add('collapsed');
    await loadAnnouncements();
  } catch (err) { showToast(err.message || 'Failed to save.', 'error'); }
}

/* ── Edit ── */
function editAnn(id) {
  const a = announcements.find(a => a._id === id); if (!a) return;
  editingId = id;
  document.getElementById('annTitle').value = a.title || '';
  document.getElementById('annBody').value  = a.body  || '';
  document.getElementById('annPriority') && (document.getElementById('annPriority').value = a.pinned ? 'urgent' : 'normal');
  document.getElementById('annExpiry')   && (document.getElementById('annExpiry').value   = a.expiresAt ? a.expiresAt.slice(0,10) : '');
  document.getElementById('formPanelTitle').textContent = 'Edit Announcement';
  document.getElementById('publishBtn').textContent     = 'Update';
  formPanel.classList.remove('collapsed');
  formPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Delete ── */
function openDeleteModal(id) {
  deleteTarget = id;
  const a = announcements.find(a => a._id === id);
  document.getElementById('deleteAnnName').textContent = a ? a.title : 'this announcement';
  document.getElementById('deleteModal').style.display = 'flex';
}
document.getElementById('cancelDelete').addEventListener('click', () => {
  document.getElementById('deleteModal').style.display = 'none'; deleteTarget = null;
});
document.getElementById('confirmDelete').addEventListener('click', async () => {
  if (!deleteTarget) return;
  try {
    const res = await fetch(`${API}/announcements/${deleteTarget}`, { method: 'DELETE', headers: authH() });
    if (!res.ok) throw new Error();
    showToast('Announcement deleted.', 'delete');
    document.getElementById('deleteModal').style.display = 'none'; deleteTarget = null;
    await loadAnnouncements();
  } catch { showToast('Failed to delete.', 'error'); }
});
document.getElementById('deleteModal').addEventListener('click', e => {
  if (e.target === document.getElementById('deleteModal')) {
    document.getElementById('deleteModal').style.display = 'none'; deleteTarget = null;
  }
});

/* ── Search ── */
document.getElementById('tableSearch').addEventListener('input', renderTable);

/* ── Toast ── */
function showToast(msg, type) {
  const toast = document.getElementById('toast');
  toast.textContent = msg; toast.className = `toast toast--${type || 'success'} show`;
  clearTimeout(toast._t); toast._t = setTimeout(() => toast.classList.remove('show'), 3200);
}

loadAnnouncements();

