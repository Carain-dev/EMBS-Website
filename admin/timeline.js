if (localStorage.getItem('embs_admin_auth') !== 'true') window.location.href = 'index.html';
'use strict';

const API    = window.EMBS_API_BASE;
const TOKEN  = () => localStorage.getItem('embs_admin_token');
const authH  = () => ({ Authorization: `Bearer ${TOKEN()}` });
const jsonH  = () => ({ 'Content-Type': 'application/json', ...authH() });

/* ── Sidebar toggle ─────────────────────────── */
const sidebar  = document.getElementById('sidebar');
const toggle   = document.getElementById('sidebarToggle');
const overlay  = document.getElementById('sidebarOverlay');
toggle.addEventListener('click',  () => { sidebar.classList.toggle('open'); overlay.classList.toggle('active'); });
overlay.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('active'); });

let entries     = [];
let editingId   = null;
let deleteTarget = null;

/* ── Visibility toggle visual ─────────────────── */
const activeCheckbox = document.getElementById('tlActive');
const activeTrack    = document.getElementById('tlActiveTrack');
const activeThumb    = document.getElementById('tlActiveThumb');

function applyActiveVisual(checked) {
  activeTrack.style.background   = checked ? 'rgba(0,169,157,0.85)' : 'rgba(107,45,139,0.2)';
  activeThumb.style.transform    = checked ? 'translateX(18px)'      : 'translateX(0)';
}
activeCheckbox.addEventListener('change', () => applyActiveVisual(activeCheckbox.checked));
applyActiveVisual(activeCheckbox.checked);

/* ── Load ────────────────────────────────────── */
async function loadEntries() {
  try {
    const res  = await fetch(`${API}/timeline?all=true`, { headers: authH() });
    const data = await res.json();
    entries = data.data || [];
    renderTable();
  } catch {
    showToast('Failed to load timeline entries.', 'error');
  }
}

/* ── Render Table ────────────────────────────── */
function renderTable() {
  const q      = document.getElementById('tableSearch').value.toLowerCase();
  const tbody  = document.getElementById('timelineTableBody');
  const empty  = document.getElementById('tableEmpty');
  const count  = document.getElementById('tableCount');

  const filtered = entries.filter(e =>
    !q ||
    (e.year  || '').toLowerCase().includes(q) ||
    (e.title || '').toLowerCase().includes(q) ||
    (e.description || '').toLowerCase().includes(q)
  );

  count.textContent = `Showing ${filtered.length} entr${filtered.length !== 1 ? 'ies' : 'y'}`;

  if (!filtered.length) {
    tbody.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = filtered.map(e => {
    const status = e.active !== false ? 'active' : 'inactive';
    const shortDesc = (e.description || '').length > 80
      ? (e.description || '').slice(0, 80) + '…'
      : (e.description || '');
    return `<tr data-id="${e._id}">
      <td><strong style="font-family:'Syne',sans-serif;color:var(--purple-light)">${e.year || ''}</strong></td>
      <td><div class="td-title">${e.title || ''}</div></td>
      <td><div class="td-sub" style="max-width:280px;">${shortDesc}</div></td>
      <td><span style="font-size:0.78rem;color:var(--text-muted)">${e.order ?? 0}</span></td>
      <td><span class="status-badge status-badge--${status}">${status === 'active' ? 'Visible' : 'Hidden'}</span></td>
      <td><div class="action-btns">
        <button class="action-btn action-btn--edit" onclick="editEntry('${e._id}')">
          <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Edit
        </button>
        <button class="action-btn action-btn--delete" onclick="openDeleteModal('${e._id}')">
          <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><polyline points="3,6 5,6 21,6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Delete
        </button>
      </div></td>
    </tr>`;
  }).join('');
}

/* ── Form panel ──────────────────────────────── */
const formPanel = document.getElementById('timelineFormPanel');

document.getElementById('toggleFormBtn').addEventListener('click', () => {
  resetForm();
  formPanel.classList.remove('collapsed');
  formPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
document.getElementById('collapseFormBtn').addEventListener('click', () => {
  formPanel.classList.toggle('collapsed');
});

function resetForm() {
  document.getElementById('timelineForm').reset();
  document.getElementById('tlOrder').value = '0';
  activeCheckbox.checked = true;
  applyActiveVisual(true);
  editingId = null;
  document.getElementById('formPanelTitle').textContent    = 'Add Timeline Entry';
  document.getElementById('saveEntryBtnLabel').textContent = 'Save Entry';
}
document.getElementById('resetFormBtn').addEventListener('click', resetForm);

/* ── Save ────────────────────────────────────── */
document.getElementById('saveEntryBtn').addEventListener('click', async () => {
  const year  = document.getElementById('tlYear').value.trim();
  const title = document.getElementById('tlTitle').value.trim();
  if (!year)  { showToast('Year is required.', 'error');  return; }
  if (!title) { showToast('Title is required.', 'error'); return; }

  const payload = {
    year,
    title,
    description: document.getElementById('tlDesc').value.trim(),
    order:       Number(document.getElementById('tlOrder').value) || 0,
    active:      activeCheckbox.checked,
  };

  try {
    const url    = editingId ? `${API}/timeline/${editingId}` : `${API}/timeline`;
    const method = editingId ? 'PATCH' : 'POST';
    const res    = await fetch(url, {
      method,
      headers: jsonH(),
      body:    JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Save failed');
    showToast(editingId ? 'Entry updated.' : 'Entry saved.', 'success');
    resetForm();
    formPanel.classList.add('collapsed');
    await loadEntries();
  } catch (err) {
    showToast(err.message || 'Failed to save.', 'error');
  }
});

/* ── Edit ────────────────────────────────────── */
function editEntry(id) {
  const e = entries.find(e => e._id === id);
  if (!e) return;
  editingId = id;
  document.getElementById('tlYear').value  = e.year  || '';
  document.getElementById('tlTitle').value = e.title || '';
  document.getElementById('tlDesc').value  = e.description || '';
  document.getElementById('tlOrder').value = e.order != null ? String(e.order) : '0';
  activeCheckbox.checked = e.active !== false;
  applyActiveVisual(activeCheckbox.checked);
  document.getElementById('formPanelTitle').textContent    = 'Edit Timeline Entry';
  document.getElementById('saveEntryBtnLabel').textContent = 'Update Entry';
  formPanel.classList.remove('collapsed');
  formPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Delete ──────────────────────────────────── */
function openDeleteModal(id) {
  deleteTarget = id;
  const e = entries.find(e => e._id === id);
  document.getElementById('deleteEntryTitle').textContent =
    e ? `"${e.title} (${e.year})"` : 'this entry';
  document.getElementById('deleteModal').style.display = 'flex';
}
document.getElementById('cancelDelete').addEventListener('click', () => {
  document.getElementById('deleteModal').style.display = 'none';
  deleteTarget = null;
});
document.getElementById('deleteModal').addEventListener('click', e => {
  if (e.target === document.getElementById('deleteModal')) {
    document.getElementById('deleteModal').style.display = 'none';
    deleteTarget = null;
  }
});
document.getElementById('confirmDelete').addEventListener('click', async () => {
  if (!deleteTarget) return;
  try {
    const res = await fetch(`${API}/timeline/${deleteTarget}`, {
      method:  'DELETE',
      headers: authH(),
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
    showToast('Entry deleted.', 'delete');
    document.getElementById('deleteModal').style.display = 'none';
    deleteTarget = null;
    await loadEntries();
  } catch (err) {
    showToast(err.message || 'Failed to delete.', 'error');
  }
});

/* ── Search ──────────────────────────────────── */
document.getElementById('tableSearch').addEventListener('input', renderTable);

/* ── Toast ───────────────────────────────────── */
function showToast(msg, type) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast toast--${type || 'success'} show`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 3200);
}

loadEntries();
