if (localStorage.getItem('embs_admin_auth') !== 'true') window.location.href = 'index.html';
'use strict';

const API = window.EMBS_API_BASE;
const TOKEN = () => localStorage.getItem('embs_admin_token');
const authH = () => ({ 'Authorization': `Bearer ${TOKEN()}` });

/* ── Sidebar toggle ── */
const sidebar = document.getElementById('sidebar');
const toggle  = document.getElementById('sidebarToggle');
const overlay = document.getElementById('sidebarOverlay');
toggle.addEventListener('click', () => { sidebar.classList.toggle('open'); overlay.classList.toggle('active'); });
overlay.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('active'); });

let projects = [];
let editingId = null;
let deleteTarget = null;
let activeFilter = 'all';

/* ── Load ── */
async function loadProjects() {
  try {
    const res = await fetch(`${API}/projects`);
    const data = await res.json();
    projects = data.data || [];
    renderTable(); updateStats();
  } catch { showToast('Failed to load projects.', 'error'); }
}

/* ── Stats ── */
function updateStats() {
  document.getElementById('statTotal').textContent     = projects.length;
  document.getElementById('statPublished').textContent = projects.filter(p => p.featured).length;
  document.getElementById('statDraft').textContent     = projects.filter(p => !p.featured).length;
  document.getElementById('statOngoing').textContent   = 0;
  document.getElementById('statCompleted').textContent = projects.length;
}

/* ── Render Table ── */
function renderTable() {
  const q     = document.getElementById('tableSearch').value.toLowerCase();
  const tbody = document.getElementById('projectTableBody');
  const empty = document.getElementById('tableEmpty');
  const count = document.getElementById('tableCount');

  const filtered = projects.filter(p => {
    const matchSearch = !q ||
      (p.title||'').toLowerCase().includes(q) ||
      (p.description||'').toLowerCase().includes(q);
    return matchSearch;
  });

  count.textContent = `Showing ${filtered.length} project${filtered.length !== 1 ? 's' : ''}`;
  if (!filtered.length) { tbody.innerHTML = ''; empty.style.display = 'flex'; return; }
  empty.style.display = 'none';

  tbody.innerHTML = filtered.map(p => {
    const thumbCell = p.thumbnail
      ? `<img class="td-thumb" src="${p.thumbnail}" alt="thumb" />`
      : `<div class="td-thumb-placeholder"></div>`;
    const githubBtn = `<a class="td-link-btn td-link-btn--github ${p.repoUrl ? '' : 'disabled'}" ${p.repoUrl ? `href="${p.repoUrl}" target="_blank" rel="noopener"` : ''} title="GitHub">GitHub</a>`;
    const liveBtn   = `<a class="td-link-btn ${p.liveUrl ? '' : 'disabled'}" ${p.liveUrl ? `href="${p.liveUrl}" target="_blank" rel="noopener"` : ''} title="Live">Live</a>`;
    return `<tr data-id="${p._id}">
      <td class="col-proj-thumb">${thumbCell}</td>
      <td><div class="td-proj-title" title="${p.title}">${p.title}</div></td>
      <td><span class="cat-badge">${(p.tags||[]).join(', ') || '—'}</span></td>
      <td><div class="td-links">${githubBtn}${liveBtn}</div></td>
      <td><span class="status-badge status-badge--${p.featured ? 'published' : 'draft'}">${p.featured ? 'Featured' : 'Normal'}</span></td>
      <td><div class="action-btns">
        <button class="action-btn action-btn--edit" onclick="editProject('${p._id}')">
          <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Edit
        </button>
        <button class="action-btn action-btn--delete" onclick="openDeleteModal('${p._id}')">
          <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><polyline points="3,6 5,6 21,6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Delete
        </button>
      </div></td>
    </tr>`;
  }).join('');
}

/* ── Thumbnail ── */
const thumbInput   = document.getElementById('thumbInput');
const thumbInner   = document.getElementById('thumbInner');
const thumbPreview = document.getElementById('thumbPreview');
const thumbImg     = document.getElementById('thumbImg');
const thumbRemove  = document.getElementById('thumbRemove');
thumbInput.addEventListener('change', () => {
  const file = thumbInput.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => { thumbImg.src = e.target.result; thumbInner.style.display = 'none'; thumbPreview.style.display = 'flex'; };
  reader.readAsDataURL(file);
});
thumbRemove.addEventListener('click', e => {
  e.stopPropagation(); thumbInput.value = ''; thumbImg.src = '';
  thumbPreview.style.display = 'none'; thumbInner.style.display = 'flex';
});

/* ── Form collapse ── */
const formPanel = document.getElementById('projectFormPanel');
document.getElementById('collapseFormBtn').addEventListener('click', () => formPanel.classList.toggle('collapsed'));
document.getElementById('toggleFormBtn').addEventListener('click', () => {
  resetForm(); formPanel.classList.remove('collapsed');
  formPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

function resetForm() {
  document.getElementById('projectForm').reset();
  thumbInput.value = ''; thumbImg.src = '';
  thumbPreview.style.display = 'none'; thumbInner.style.display = 'flex';
  editingId = null;
  document.getElementById('formPanelTitle').textContent = 'Add New Project';
  document.getElementById('publishBtn').textContent     = 'Publish Project';
}
document.getElementById('resetFormBtn').addEventListener('click', resetForm);

function getFormData(featured) {
  const fd = new FormData();
  fd.append('title',       document.getElementById('projTitle').value.trim());
  fd.append('description', document.getElementById('projDesc').value.trim());
  fd.append('repoUrl',     document.getElementById('projGithub')?.value.trim() || '');
  fd.append('liveUrl',     document.getElementById('projPaper')?.value.trim() || '');
  fd.append('featured',    featured);
  const tagsVal = document.getElementById('projCategory')?.value;
  if (tagsVal) fd.append('tags', tagsVal);
  if (thumbInput.files[0]) fd.append('thumbnail', thumbInput.files[0]);
  return fd;
}

document.getElementById('saveDraftBtn').addEventListener('click', async () => {
  const title = document.getElementById('projTitle').value.trim();
  if (!title) { showToast('Please enter a project title.', 'error'); return; }
  await saveProject(false);
});
document.getElementById('publishBtn').addEventListener('click', async () => {
  const title = document.getElementById('projTitle').value.trim();
  if (!title) { showToast('Title is required.', 'error'); return; }
  await saveProject(true);
});

async function saveProject(featured) {
  const fd = getFormData(featured);
  try {
    const url    = editingId ? `${API}/projects/${editingId}` : `${API}/projects`;
    const method = editingId ? 'PATCH' : 'POST';
    const res    = await fetch(url, { method, headers: authH(), body: fd });
    const data   = await res.json();
    if (!res.ok) throw new Error(data.message);
    showToast(editingId ? 'Project updated.' : 'Project published.', 'success');
    resetForm(); formPanel.classList.add('collapsed');
    await loadProjects();
  } catch (err) { showToast(err.message || 'Failed to save.', 'error'); }
}

function editProject(id) {
  const p = projects.find(p => p._id === id); if (!p) return;
  editingId = id;
  document.getElementById('projTitle').value    = p.title || '';
  document.getElementById('projDesc').value     = p.description || '';
  document.getElementById('projGithub') && (document.getElementById('projGithub').value = p.repoUrl || '');
  document.getElementById('projPaper')  && (document.getElementById('projPaper').value  = p.liveUrl || '');
  document.getElementById('projCategory') && (document.getElementById('projCategory').value = (p.tags||[])[0] || '');
  if (p.thumbnail) { thumbImg.src = p.thumbnail; thumbInner.style.display = 'none'; thumbPreview.style.display = 'flex'; }
  document.getElementById('formPanelTitle').textContent = 'Edit Project';
  document.getElementById('publishBtn').textContent     = 'Update Project';
  formPanel.classList.remove('collapsed');
  formPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openDeleteModal(id) {
  deleteTarget = id;
  const p = projects.find(p => p._id === id);
  document.getElementById('deleteProjectName').textContent = p ? p.title : 'this project';
  document.getElementById('deleteModal').style.display = 'flex';
}
document.getElementById('cancelDelete').addEventListener('click', () => {
  document.getElementById('deleteModal').style.display = 'none'; deleteTarget = null;
});
document.getElementById('confirmDelete').addEventListener('click', async () => {
  if (!deleteTarget) return;
  try {
    const res = await fetch(`${API}/projects/${deleteTarget}`, { method: 'DELETE', headers: authH() });
    if (!res.ok) throw new Error();
    showToast('Project deleted.', 'delete');
    document.getElementById('deleteModal').style.display = 'none'; deleteTarget = null;
    await loadProjects();
  } catch { showToast('Failed to delete.', 'error'); }
});
document.getElementById('deleteModal').addEventListener('click', e => {
  if (e.target === document.getElementById('deleteModal')) {
    document.getElementById('deleteModal').style.display = 'none'; deleteTarget = null;
  }
});

document.getElementById('tableSearch').addEventListener('input', renderTable);

function showToast(msg, type) {
  const toast = document.getElementById('toast');
  toast.textContent = msg; toast.className = `toast toast--${type || 'success'} show`;
  clearTimeout(toast._timer); toast._timer = setTimeout(() => toast.classList.remove('show'), 3200);
}

loadProjects();

