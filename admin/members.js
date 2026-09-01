if (localStorage.getItem('embs_admin_auth') !== 'true') window.location.href = 'index.html';
'use strict';

const API = window.EMBS_API_BASE;
const TOKEN = () => localStorage.getItem('embs_admin_token');
const authH = () => ({ 'Authorization': `Bearer ${TOKEN()}` });

/* ── Sidebar Toggle ── */
const sidebar = document.getElementById('sidebar');
const toggle  = document.getElementById('sidebarToggle');
const overlay = document.getElementById('sidebarOverlay');
toggle.addEventListener('click', () => { sidebar.classList.toggle('open'); overlay.classList.toggle('active'); });
overlay.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('active'); });

let members = [];
let editingId = null;
let deleteTarget = null;

/* ── Load ── */
async function loadMembers() {
  try {
    const res = await fetch(`${API}/members?all=true`, { headers: authH() });
    const data = await res.json();
    members = data.data || [];
    renderTable(); updateStats();
  } catch { showToast('Failed to load members.', 'error'); }
}

/* ── Stats ── */
function updateStats() {
  document.getElementById('statTotal').textContent    = members.length;
  document.getElementById('statActive').textContent   = members.filter(m => m.active !== false).length;
  document.getElementById('statInactive').textContent = members.filter(m => m.active === false).length;
  document.getElementById('statExec').textContent     = members.filter(m => isExec(m.role)).length;
  document.getElementById('statVolunteer').textContent= members.filter(m => !isExec(m.role) && !isCore(m.role)).length;
}

const EXEC = ['Chairperson','Vice Chairperson','Secretary','Treasurer','Technical Lead','Events Lead','Design Lead','Content Lead','Social Media Lead','Research Lead'];
const CORE = ['Core Member','Technical Member','Events Member','Design Member','Content Member'];
function isExec(role) { return EXEC.includes(role); }
function isCore(role) { return CORE.includes(role); }
function roleOf(role) { return isExec(role) ? 'executive' : isCore(role) ? 'core' : 'volunteer'; }

/* ── Avatar ── */
const COLORS = [['#6B2D8B','#00A99D'],['#1a6b8b','#00A99D'],['#8b2d6b','#a99d00'],['#2d6b1a','#00A99D']];
function avatarHTML(m) {
  if (m.photo) return `<img class="mem-avatar" src="${m.photo}" alt="${m.name}" />`;
  const c = COLORS[members.indexOf(m) % COLORS.length];
  const initials = m.name.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
  return `<div class="mem-avatar-placeholder" style="background:linear-gradient(135deg,${c[0]},${c[1]})">${initials}</div>`;
}

/* ── Render Table ── */
function renderTable() {
  const q      = document.getElementById('tableSearch').value.toLowerCase();
  const tbody  = document.getElementById('membersTableBody');
  const empty  = document.getElementById('tableEmpty');
  const count  = document.getElementById('tableCount');

  const filtered = members.filter(m => {
    if (q && !((m.name||'').toLowerCase().includes(q) || (m.email||'').toLowerCase().includes(q) || (m.role||'').toLowerCase().includes(q))) return false;
    return true;
  });

  count.textContent = `Showing ${filtered.length} member${filtered.length !== 1 ? 's' : ''}`;
  if (!filtered.length) { tbody.innerHTML = ''; empty.style.display = 'flex'; return; }
  empty.style.display = 'none';

  tbody.innerHTML = filtered.map(m => {
    const role = roleOf(m.role);
    const status = m.active !== false ? 'active' : 'inactive';
    const linkedinLink = m.linkedin
      ? `<a class="td-mem-linkedin" href="${m.linkedin}" target="_blank" rel="noopener">LinkedIn</a>` : '';
    return `<tr data-id="${m._id}">
      <td class="col-mem-photo">${avatarHTML(m)}</td>
      <td><div class="td-mem-name">${m.name}</div><div class="td-mem-phone">${m.email||''}</div></td>
      <td><span class="pos-badge pos-badge--${role}">${m.role}</span></td>
      <td><span style="font-size:0.78rem;color:var(--text-muted)">${m.batch||''}</span></td>
      <td>${linkedinLink}</td>
      <td><span class="status-badge status-badge--${status}">${status === 'active' ? 'Active' : 'Inactive'}</span></td>
      <td><div class="action-btns">
        <button class="action-btn action-btn--edit" onclick="editMember('${m._id}')">
          <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Edit
        </button>
        <button class="action-btn action-btn--delete" onclick="openDeleteModal('${m._id}')">
          <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><polyline points="3,6 5,6 21,6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Delete
        </button>
      </div></td>
    </tr>`;
  }).join('');
}

/* ── Photo Upload ── */
const photoInput   = document.getElementById('photoInput');
const photoInner   = document.getElementById('photoInner');
const photoPreview = document.getElementById('photoPreview');
const photoImg     = document.getElementById('photoImg');
const photoRemove  = document.getElementById('photoRemove');
photoInput.addEventListener('change', () => {
  const file = photoInput.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => { photoImg.src = e.target.result; photoInner.style.display = 'none'; photoPreview.style.display = 'flex'; };
  reader.readAsDataURL(file);
});
photoRemove.addEventListener('click', e => {
  e.stopPropagation(); photoInput.value = ''; photoImg.src = '';
  photoPreview.style.display = 'none'; photoInner.style.display = 'flex';
});

/* ── Form Panel ── */
const formPanel = document.getElementById('memberFormPanel');
document.getElementById('collapseFormBtn').addEventListener('click', () => formPanel.classList.toggle('collapsed'));
document.getElementById('toggleFormBtn').addEventListener('click', () => {
  resetForm(); formPanel.classList.remove('collapsed');
  formPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

function resetForm() {
  document.getElementById('memberForm').reset();
  photoInput.value = ''; photoImg.src = '';
  photoPreview.style.display = 'none'; photoInner.style.display = 'flex';
  editingId = null;
  document.getElementById('formPanelTitle').textContent = 'Add New Member';
  document.getElementById('saveMemberBtn').textContent  = 'Save Member';
}
document.getElementById('resetFormBtn').addEventListener('click', resetForm);

/* ── Save Member ── */
document.getElementById('saveMemberBtn').addEventListener('click', async () => {
  const name = document.getElementById('memName').value.trim();
  const role = document.getElementById('memPosition').value;
  if (!name || !role) { showToast('Name and Role are required.', 'error'); return; }

  const fd = new FormData();
  fd.append('name',     name);
  fd.append('role',     role);
  fd.append('batch',    document.getElementById('memYear')?.value || '');
  fd.append('email',    document.getElementById('memEmail')?.value.trim() || '');
  fd.append('linkedin', document.getElementById('memLinkedin')?.value.trim() || '');
  fd.append('active',   (document.getElementById('memStatus')?.value || 'active') === 'active');
  if (photoInput.files[0]) fd.append('photo', photoInput.files[0]);

  try {
    const url    = editingId ? `${API}/members/${editingId}` : `${API}/members`;
    const method = editingId ? 'PATCH' : 'POST';
    const res    = await fetch(url, { method, headers: authH(), body: fd });
    const data   = await res.json();
    if (!res.ok) throw new Error(data.message);
    showToast(editingId ? `"${name}" updated.` : `"${name}" added.`, 'success');
    resetForm(); formPanel.classList.add('collapsed');
    await loadMembers();
  } catch (err) { showToast(err.message || 'Failed to save.', 'error'); }
});

/* ── Edit ── */
function editMember(id) {
  const m = members.find(m => m._id === id); if (!m) return;
  editingId = id;
  document.getElementById('memName').value     = m.name || '';
  document.getElementById('memPosition').value = m.role || '';
  document.getElementById('memYear') && (document.getElementById('memYear').value = m.batch || '');
  document.getElementById('memEmail') && (document.getElementById('memEmail').value = m.email || '');
  document.getElementById('memLinkedin') && (document.getElementById('memLinkedin').value = m.linkedin || '');
  document.getElementById('memStatus') && (document.getElementById('memStatus').value = m.active !== false ? 'active' : 'inactive');
  if (m.photo) { photoImg.src = m.photo; photoInner.style.display = 'none'; photoPreview.style.display = 'flex'; }
  document.getElementById('formPanelTitle').textContent = 'Edit Member';
  document.getElementById('saveMemberBtn').textContent  = 'Update Member';
  formPanel.classList.remove('collapsed');
  formPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Delete ── */
function openDeleteModal(id) {
  deleteTarget = id;
  const m = members.find(m => m._id === id);
  document.getElementById('deleteMemberName').textContent = m ? m.name : 'this member';
  document.getElementById('deleteModal').style.display = 'flex';
}
document.getElementById('cancelDelete').addEventListener('click', () => {
  document.getElementById('deleteModal').style.display = 'none'; deleteTarget = null;
});
document.getElementById('confirmDelete').addEventListener('click', async () => {
  if (!deleteTarget) return;
  try {
    const res = await fetch(`${API}/members/${deleteTarget}`, { method: 'DELETE', headers: authH() });
    if (!res.ok) throw new Error();
    showToast('Member removed.', 'delete');
    document.getElementById('deleteModal').style.display = 'none'; deleteTarget = null;
    await loadMembers();
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

loadMembers();

