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

let achievements = [];
let editingId = null;
let deleteTarget = null;
let activeFilter = 'all';

/* ── Load ── */
async function loadAchievements() {
  try {
    const res = await fetch(`${API}/achievements`);
    const data = await res.json();
    achievements = data.data || [];
    renderTable(); renderSummary();
  } catch { showToast('Failed to load achievements.', 'error'); }
}

/* ── Summary ── */
function renderSummary() {
  document.getElementById('achSummary').innerHTML = `
    <span class="ach-summary-chip ach-summary-chip--total"><span class="chip-dot chip-dot--purple"></span>${achievements.length} Total</span>
    <span class="ach-summary-chip ach-summary-chip--approved"><span class="chip-dot chip-dot--teal"></span>${achievements.length} Approved</span>`;
  const badge = document.getElementById('pendingCountBadge');
  if (badge) badge.textContent = 0;
}

function catClass(cat) {
  const map = { Award:'award', Publication:'publication', Competition:'competition',
    Certification:'certification', Research:'research', Leadership:'leadership' };
  return map[cat] || 'other';
}

/* ── Render Table ── */
function renderTable() {
  const query  = document.getElementById('achSearch').value.toLowerCase();
  const tbody  = document.getElementById('achTableBody');
  const empty  = document.getElementById('achTableEmpty');
  const count  = document.getElementById('achTableCount');

  let filtered = achievements.filter(a => {
    const matchCat    = activeFilter === 'all' || a.category === activeFilter;
    const matchSearch = !query ||
      (a.title || '').toLowerCase().includes(query) ||
      (a.category || '').toLowerCase().includes(query);
    return matchCat && matchSearch;
  });

  count.textContent = `Showing ${filtered.length} achievement${filtered.length !== 1 ? 's' : ''}`;
  if (!filtered.length) { tbody.innerHTML = ''; empty.style.display = 'flex'; return; }
  empty.style.display = 'none';

  tbody.innerHTML = filtered.map(a => `
    <tr data-id="${a._id}">
      <td><div class="td-title">${a.title}</div><div class="td-sub">${a.description || ''}</div></td>
      <td>${a.date || ''}</td>
      <td><span class="pending-tag cat--${catClass(a.category)}">${a.category || ''}</span></td>
      <td><div class="action-btns">
        <button class="action-btn action-btn--edit" onclick="editAch('${a._id}')">
          <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Edit
        </button>
        <button class="action-btn action-btn--delete" onclick="openDeleteModal('${a._id}')">
          <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><polyline points="3,6 5,6 21,6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Delete
        </button>
      </div></td>
    </tr>`).join('');
}

/* ── Edit ── */
function editAch(id) {
  const a = achievements.find(x => x._id === id); if (!a) return;
  editingId = id;
  document.getElementById('achTitle').value    = a.title || '';
  document.getElementById('achCategory').value = a.category || '';
  document.getElementById('achYear').value     = a.date || '';
  document.getElementById('achIssuer') && (document.getElementById('achIssuer').value = '');
  document.getElementById('achDesc').value     = a.description || '';
  document.getElementById('manualFormTitle').textContent = 'Edit Achievement';
  document.getElementById('saveAchBtnLabel').textContent = 'Update Achievement';
  document.getElementById('manualFormPanel').classList.remove('collapsed');
  document.getElementById('manualFormPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Reset ── */
function resetManualForm() {
  document.getElementById('manualForm').reset();
  editingId = null;
  document.getElementById('manualFormTitle').textContent = 'Add Achievement Manually';
  document.getElementById('saveAchBtnLabel').textContent = 'Save Achievement';
}
document.getElementById('resetManualBtn').addEventListener('click', resetManualForm);

/* ── Save ── */
document.getElementById('saveAchBtn').addEventListener('click', async () => {
  const title    = document.getElementById('achTitle').value.trim();
  const category = document.getElementById('achCategory').value;
  const date     = document.getElementById('achYear').value;
  if (!title) { showToast('Title is required.', 'error'); return; }

  const fd = new FormData();
  fd.append('title',       title);
  fd.append('category',    category);
  fd.append('date',        date);
  fd.append('description', document.getElementById('achDesc').value.trim());

  try {
    const url    = editingId ? `${API}/achievements/${editingId}` : `${API}/achievements`;
    const method = editingId ? 'PATCH' : 'POST';
    const res    = await fetch(url, { method, headers: authH(), body: fd });
    const data   = await res.json();
    if (!res.ok) throw new Error(data.message);
    showToast(editingId ? 'Achievement updated.' : 'Achievement saved.', 'success');
    resetManualForm();
    document.getElementById('manualFormPanel').classList.add('collapsed');
    await loadAchievements();
  } catch (err) { showToast(err.message || 'Failed to save.', 'error'); }
});

/* ── Delete ── */
function openDeleteModal(id) {
  deleteTarget = id;
  const a = achievements.find(x => x._id === id);
  document.getElementById('deleteAchName').textContent = a ? a.title : 'this achievement';
  document.getElementById('deleteModal').style.display = 'flex';
}
document.getElementById('cancelDelete').addEventListener('click', () => {
  document.getElementById('deleteModal').style.display = 'none'; deleteTarget = null;
});
document.getElementById('confirmDelete').addEventListener('click', async () => {
  if (!deleteTarget) return;
  try {
    const res = await fetch(`${API}/achievements/${deleteTarget}`, { method: 'DELETE', headers: authH() });
    if (!res.ok) throw new Error();
    showToast('Achievement deleted.', 'delete');
    document.getElementById('deleteModal').style.display = 'none'; deleteTarget = null;
    await loadAchievements();
  } catch { showToast('Failed to delete.', 'error'); }
});
document.getElementById('deleteModal').addEventListener('click', e => {
  if (e.target === document.getElementById('deleteModal')) {
    document.getElementById('deleteModal').style.display = 'none'; deleteTarget = null;
  }
});

/* ── Search & Filter ── */
document.getElementById('achSearch').addEventListener('input', renderTable);
document.querySelectorAll('#achFilterBar .filter-pill').forEach(pill => {
  pill.addEventListener('click', function () {
    document.querySelectorAll('#achFilterBar .filter-pill').forEach(p => p.classList.remove('active'));
    this.classList.add('active'); activeFilter = this.dataset.cat; renderTable();
  });
});

/* ── Form collapse ── */
document.getElementById('collapseManualBtn').addEventListener('click', () => {
  document.getElementById('manualFormPanel').classList.toggle('collapsed');
});

/* ── Toast ── */
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg; toast.className = `toast toast--${type} show`;
  clearTimeout(toast._t); toast._t = setTimeout(() => toast.classList.remove('show'), 3200);
}

loadAchievements();

