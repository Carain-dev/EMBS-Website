if (localStorage.getItem('embs_admin_auth') !== 'true') window.location.href = 'index.html';
'use strict';

const API = window.EMBS_API_BASE;
const TOKEN = () => localStorage.getItem('embs_admin_token');
const authH = () => ({ 'Authorization': `Bearer ${TOKEN()}` });

/* â”€â”€ Sidebar Toggle â”€â”€ */
const sidebar = document.getElementById('sidebar');
const toggle  = document.getElementById('sidebarToggle');
const overlay = document.getElementById('sidebarOverlay');
toggle.addEventListener('click', () => { sidebar.classList.toggle('open'); overlay.classList.toggle('active'); });
overlay.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('active'); });

let members = [];
let editingId = null;
let deleteTarget = null;

/* â”€â”€ Load â”€â”€ */
async function loadMembers() {
  try {
    const res = await fetch(`${API}/members?all=true`, { headers: authH() });
    const data = await res.json();
    members = data.data || [];
    renderTable(); updateStats();
  } catch { showToast('Failed to load members.', 'error'); }
}

/* â”€â”€ Stats â”€â”€ */
function updateStats() {
  document.getElementById('statTotal').textContent    = members.length;
  document.getElementById('statActive').textContent   = members.filter(m => m.active !== false).length;
  document.getElementById('statInactive').textContent = members.filter(m => m.active === false).length;
  document.getElementById('statExec').textContent     = members.filter(m => isExec(m.role)).length;
  document.getElementById('statVolunteer').textContent= members.filter(m => !isExec(m.role) && !isCore(m.role)).length;
}

const EXEC = [
  'Chairperson','Secretary','Joint Secretary','Treasurer','Joint Treasurer',
  'Proposal Lead','Public Relations Officer','ExCom Lead',
  'Event Coordinator Lead','Tech Lead','Design Lead','Designer Lead'
];
const CORE = [
  'Community Service Officer','Outreach Officer','Member Service Coordinator',
  'International Relations Officer','Social Media In-Charge','Documentation Designer',
  'Technical','ExCom Member'
];
function isExec(role) { return EXEC.includes(role); }
function isCore(role) { return CORE.includes(role); }
function roleOf(role) { return isExec(role) ? 'executive' : isCore(role) ? 'core' : 'volunteer'; }

/* â”€â”€ Avatar â”€â”€ */
const COLORS = [['#6B2D8B','#00A99D'],['#1a6b8b','#00A99D'],['#8b2d6b','#a99d00'],['#2d6b1a','#00A99D']];
function avatarHTML(m) {
  if (m.photo) return `<img class="mem-avatar" src="${m.photo}" alt="${m.name}" />`;
  const c = COLORS[members.indexOf(m) % COLORS.length];
  const initials = m.name.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
  return `<div class="mem-avatar-placeholder" style="background:linear-gradient(135deg,${c[0]},${c[1]})">${initials}</div>`;
}

/* â”€â”€ Render Table â”€â”€ */
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
    const orgBadge = m.inOrgChart
      ? `<span style="font-size:0.7rem;background:rgba(107,45,139,0.18);color:#c084fc;border-radius:4px;padding:2px 6px;margin-left:4px;white-space:nowrap;">Org Chart</span>`
      : '';
    const linkedinLink = m.linkedin
      ? `<a class="td-mem-linkedin" href="${m.linkedin}" target="_blank" rel="noopener">LinkedIn</a>` : '';
    return `<tr data-id="${m._id}">
      <td class="col-mem-photo">${avatarHTML(m)}</td>
      <td><div class="td-mem-name">${m.name}</div><div class="td-mem-phone">${m.email||''}</div></td>
      <td><span class="pos-badge pos-badge--${role}">${m.role}</span>${orgBadge}</td>
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

/* â”€â”€ Photo Upload â”€â”€ */
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

/* â”€â”€ Org Chart toggle visual (inline toggle, no settings.css dependency) â”€â”€ */
const orgChartCheckbox = document.getElementById('memInOrgChart');
const orgChartTrack    = document.getElementById('memInOrgChartTrack');
const orgChartThumb    = document.getElementById('memInOrgChartThumb');

function applyOrgToggleVisual(checked) {
  if (!orgChartTrack || !orgChartThumb) return;
  orgChartTrack.style.background = checked
    ? 'rgba(107,45,139,0.85)'
    : 'rgba(107,45,139,0.2)';
  orgChartThumb.style.transform = checked ? 'translateX(18px)' : 'translateX(0)';
}

if (orgChartCheckbox) {
  orgChartCheckbox.addEventListener('change', () => applyOrgToggleVisual(orgChartCheckbox.checked));
  applyOrgToggleVisual(orgChartCheckbox.checked);
}

/* â”€â”€ Form Panel â”€â”€ */
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
  // Reset order to 0 and untick org chart
  const orderEl = document.getElementById('memOrder');
  if (orderEl) orderEl.value = '0';
  if (orgChartCheckbox) { orgChartCheckbox.checked = false; applyOrgToggleVisual(false); }
  editingId = null;
  document.getElementById('formPanelTitle').textContent = 'Add New Member';
  document.getElementById('saveMemberBtn').textContent  = 'Save Member';
}
document.getElementById('resetFormBtn').addEventListener('click', resetForm);

/* â”€â”€ Save Member â”€â”€ */
document.getElementById('saveMemberBtn').addEventListener('click', async () => {
  const name = document.getElementById('memName').value.trim();
  const role = document.getElementById('memPosition').value;
  if (!name || !role) { showToast('Name and Role are required.', 'error'); return; }

  const fd = new FormData();
  fd.append('name',       name);
  fd.append('role',       role);
  fd.append('batch',      document.getElementById('memYear')?.value || '');
  fd.append('email',      document.getElementById('memEmail')?.value.trim() || '');
  fd.append('linkedin',   document.getElementById('memLinkedin')?.value.trim() || '');
  fd.append('active',     (document.getElementById('memStatus')?.value || 'active') === 'active');
  fd.append('order',      document.getElementById('memOrder')?.value || '0');
  fd.append('inOrgChart', String(orgChartCheckbox?.checked === true));
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

/* â”€â”€ Edit â”€â”€ */
function editMember(id) {
  const m = members.find(m => m._id === id); if (!m) return;
  editingId = id;
  document.getElementById('memName').value     = m.name || '';
  document.getElementById('memPosition').value = m.role || '';
  document.getElementById('memYear') && (document.getElementById('memYear').value = m.batch || '');
  document.getElementById('memEmail') && (document.getElementById('memEmail').value = m.email || '');
  document.getElementById('memLinkedin') && (document.getElementById('memLinkedin').value = m.linkedin || '');
  document.getElementById('memStatus') && (document.getElementById('memStatus').value = m.active !== false ? 'active' : 'inactive');
  // Restore order and inOrgChart
  const orderEl = document.getElementById('memOrder');
  if (orderEl) orderEl.value = m.order != null ? String(m.order) : '0';
  if (orgChartCheckbox) {
    orgChartCheckbox.checked = Boolean(m.inOrgChart);
    applyOrgToggleVisual(Boolean(m.inOrgChart));
  }
  if (m.photo) { photoImg.src = m.photo; photoInner.style.display = 'none'; photoPreview.style.display = 'flex'; }
  document.getElementById('formPanelTitle').textContent = 'Edit Member';
  document.getElementById('saveMemberBtn').textContent  = 'Update Member';
  formPanel.classList.remove('collapsed');
  formPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* â”€â”€ Delete â”€â”€ */
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

/* â”€â”€ Search â”€â”€ */
document.getElementById('tableSearch').addEventListener('input', renderTable);

/* â”€â”€ Toast â”€â”€ */
function showToast(msg, type) {
  const toast = document.getElementById('toast');
  toast.textContent = msg; toast.className = `toast toast--${type || 'success'} show`;
  clearTimeout(toast._t); toast._t = setTimeout(() => toast.classList.remove('show'), 3200);
}

loadMembers();



/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   HOME PAGE â€” FACULTY COORDINATORS
   Independent management section appended below the Members table.
   Uses the same /api/members endpoint with isFacultyCoordinator:true.
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

'use strict';

let facCoordinators = [];
let facEditingId    = null;
let facDeleteTarget = null;

/* â”€â”€ Photo upload for faculty coordinator form â”€â”€ */
const facPhotoInput   = document.getElementById('facPhotoInput');
const facPhotoInner   = document.getElementById('facPhotoInner');
const facPhotoPreview = document.getElementById('facPhotoPreview');
const facPhotoImg     = document.getElementById('facPhotoImg');
const facPhotoRemove  = document.getElementById('facPhotoRemove');

if (facPhotoInput) {
  facPhotoInput.addEventListener('change', () => {
    const file = facPhotoInput.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      facPhotoImg.src = e.target.result;
      facPhotoInner.style.display = 'none';
      facPhotoPreview.style.display = 'flex';
    };
    reader.readAsDataURL(file);
  });
}
if (facPhotoRemove) {
  facPhotoRemove.addEventListener('click', e => {
    e.stopPropagation();
    facPhotoInput.value = ''; facPhotoImg.src = '';
    facPhotoPreview.style.display = 'none'; facPhotoInner.style.display = 'flex';
  });
}

/* â”€â”€ Published toggle visual â”€â”€ */
const facActiveCheckbox = document.getElementById('facActive');
const facActiveTrack    = document.getElementById('facActiveTrack');
const facActiveThumb    = document.getElementById('facActiveThumb');

function applyFacActiveVisual(checked) {
  if (!facActiveTrack || !facActiveThumb) return;
  facActiveTrack.style.background = checked ? 'rgba(0,169,157,0.85)' : 'rgba(107,45,139,0.2)';
  facActiveThumb.style.transform  = checked ? 'translateX(18px)' : 'translateX(0)';
}
if (facActiveCheckbox) {
  facActiveCheckbox.addEventListener('change', () => applyFacActiveVisual(facActiveCheckbox.checked));
  applyFacActiveVisual(true);
}

/* â”€â”€ Load â”€â”€ */
async function loadFacultyCoordinators() {
  try {
    const res  = await fetch(`${API}/members?all=true`, { headers: authH() });
    const data = await res.json();
    /* Filter to only faculty coordinator records */
    facCoordinators = (data.data || []).filter(m => m.isFacultyCoordinator === true);
    renderFacTable();
  } catch {
    showToast('Failed to load faculty coordinators.', 'error');
  }
}

/* â”€â”€ Render faculty table â”€â”€ */
function renderFacTable() {
  const tbody = document.getElementById('facTableBody');
  const empty = document.getElementById('facTableEmpty');
  const count = document.getElementById('facTableCount');

  if (!tbody) return;
  count.textContent = `${facCoordinators.length} coordinator${facCoordinators.length !== 1 ? 's' : ''}`;

  if (!facCoordinators.length) {
    tbody.innerHTML = ''; empty.style.display = 'flex'; return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = facCoordinators
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(c => {
      const avatar = c.photo
        ? `<img src="${c.photo}" alt="${c.name}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid rgba(107,45,139,0.3);" />`
        : `<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#6B2D8B,#00A99D);display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;color:#fff;">${(c.name||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()}</div>`;
      const status = c.active !== false ? 'active' : 'inactive';
      return `<tr>
        <td>${avatar}</td>
        <td style="font-size:0.85rem;font-weight:500;">${c.name || ''}</td>
        <td style="font-size:0.82rem;color:var(--text-muted);">${c.role || ''}</td>
        <td style="font-size:0.8rem;color:var(--text-muted);">${c.order ?? 0}</td>
        <td><span class="status-badge status-badge--${status}">${status === 'active' ? 'Published' : 'Unpublished'}</span></td>
        <td><div class="action-btns">
          <button class="action-btn action-btn--edit" onclick="editFacultyCoordinator('${c._id}')">
            <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Edit
          </button>
          <button class="action-btn action-btn--delete" onclick="openFacDeleteModal('${c._id}')">
            <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><polyline points="3,6 5,6 21,6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Delete
          </button>
        </div></td>
      </tr>`;
    }).join('');
}

/* â”€â”€ Form panel toggle â”€â”€ */
const facFormPanel = document.getElementById('facFormPanel');
document.getElementById('addFacBtn').addEventListener('click', () => {
  resetFacForm();
  facFormPanel.classList.remove('collapsed');
  facFormPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
document.getElementById('collapseFacFormBtn').addEventListener('click', () => {
  facFormPanel.classList.toggle('collapsed');
});

/* â”€â”€ Reset form â”€â”€ */
function resetFacForm() {
  document.getElementById('facForm').reset();
  facPhotoInput.value = ''; facPhotoImg.src = '';
  facPhotoPreview.style.display = 'none'; facPhotoInner.style.display = 'flex';
  document.getElementById('facOrder').value = '0';
  if (facActiveCheckbox) { facActiveCheckbox.checked = true; applyFacActiveVisual(true); }
  facEditingId = null;
  document.getElementById('facFormTitle').textContent    = 'Add Faculty Coordinator';
  document.getElementById('saveFacBtnLabel').textContent = 'Save Coordinator';
}
document.getElementById('resetFacFormBtn').addEventListener('click', resetFacForm);

/* â”€â”€ Save â”€â”€ */
document.getElementById('saveFacBtn').addEventListener('click', async () => {
  const name        = document.getElementById('facName').value.trim();
  const designation = document.getElementById('facDesignation').value.trim();
  if (!name)        { showToast('Name is required.', 'error'); return; }
  if (!designation) { showToast('Designation is required.', 'error'); return; }

  const fd = new FormData();
  fd.append('name',                 name);
  fd.append('role',                 designation);   /* role field stores designation */
  fd.append('order',                document.getElementById('facOrder').value || '0');
  fd.append('active',               String(facActiveCheckbox ? facActiveCheckbox.checked : true));
  fd.append('isFacultyCoordinator', 'true');
  if (facPhotoInput.files[0]) fd.append('photo', facPhotoInput.files[0]);

  const url    = facEditingId ? `${API}/members/${facEditingId}` : `${API}/members`;
  const method = facEditingId ? 'PATCH' : 'POST';

  try {
    const res  = await fetch(url, { method, headers: authH(), body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    showToast(facEditingId ? `"${name}" updated.` : `"${name}" added.`, 'success');
    resetFacForm();
    facFormPanel.classList.add('collapsed');
    await loadFacultyCoordinators();
  } catch (err) {
    showToast(err.message || 'Failed to save coordinator.', 'error');
  }
});

/* â”€â”€ Edit â”€â”€ */
function editFacultyCoordinator(id) {
  const c = facCoordinators.find(x => x._id === id); if (!c) return;
  facEditingId = id;
  document.getElementById('facName').value        = c.name || '';
  document.getElementById('facDesignation').value = c.role || '';
  document.getElementById('facOrder').value       = c.order != null ? String(c.order) : '0';
  if (facActiveCheckbox) {
    facActiveCheckbox.checked = c.active !== false;
    applyFacActiveVisual(c.active !== false);
  }
  if (c.photo) {
    facPhotoImg.src = c.photo;
    facPhotoInner.style.display   = 'none';
    facPhotoPreview.style.display = 'flex';
  } else {
    facPhotoImg.src = '';
    facPhotoInner.style.display   = 'flex';
    facPhotoPreview.style.display = 'none';
  }
  document.getElementById('facFormTitle').textContent    = 'Edit Faculty Coordinator';
  document.getElementById('saveFacBtnLabel').textContent = 'Update Coordinator';
  facFormPanel.classList.remove('collapsed');
  facFormPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* â”€â”€ Delete â”€â”€ */
function openFacDeleteModal(id) {
  facDeleteTarget = id;
  const c = facCoordinators.find(x => x._id === id);
  document.getElementById('facDeleteName').textContent = c ? c.name : 'this coordinator';
  document.getElementById('facDeleteModal').style.display = 'flex';
}
document.getElementById('cancelFacDelete').addEventListener('click', () => {
  document.getElementById('facDeleteModal').style.display = 'none';
  facDeleteTarget = null;
});
document.getElementById('facDeleteModal').addEventListener('click', e => {
  if (e.target === document.getElementById('facDeleteModal')) {
    document.getElementById('facDeleteModal').style.display = 'none';
    facDeleteTarget = null;
  }
});
document.getElementById('confirmFacDelete').addEventListener('click', async () => {
  if (!facDeleteTarget) return;
  try {
    const res = await fetch(`${API}/members/${facDeleteTarget}`, { method: 'DELETE', headers: authH() });
    if (!res.ok) throw new Error();
    showToast('Coordinator removed.', 'delete');
    document.getElementById('facDeleteModal').style.display = 'none';
    facDeleteTarget = null;
    await loadFacultyCoordinators();
  } catch {
    showToast('Failed to delete coordinator.', 'error');
  }
});

/* â”€â”€ Init â”€â”€ */
loadFacultyCoordinators();


/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   MEMBERS PAGE â€” FACULTY ADVISORS
   Independent management section below Faculty Coordinators.
   Uses the same /api/members endpoint with isFacultyAdvisor:true.
   Fields saved: name, role (faculty role label), batch (stores designation),
   email, bio, order, active, isFacultyAdvisor:true, photo.
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */



/* ═══════════════════════════════════════════════════════════════════════════
   MEMBERS PAGE — FACULTY ADVISORS
   Uses the same /api/members endpoint with isFacultyAdvisor:true.
   Field mapping (no new schema fields):
     role     → faculty role label  ("Faculty Advisor", "Co-Advisor", …)
     batch    → designation text    (shown on the public card)
     linkedin → department name     (faculty cards show dept, not a LinkedIn link)
     email    → contact email
     bio      → research area / bio text
   ═══════════════════════════════════════════════════════════════════════════ */

let fadAdvisors     = [];
let fadEditingId    = null;
let fadDeleteTarget = null;

/* ── Photo upload ── */
const fadPhotoInput   = document.getElementById('fadPhotoInput');
const fadPhotoInner   = document.getElementById('fadPhotoInner');
const fadPhotoPreview = document.getElementById('fadPhotoPreview');
const fadPhotoImg     = document.getElementById('fadPhotoImg');
const fadPhotoRemove  = document.getElementById('fadPhotoRemove');

if (fadPhotoInput) {
  fadPhotoInput.addEventListener('change', function () {
    var file = fadPhotoInput.files[0]; if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      fadPhotoImg.src = e.target.result;
      fadPhotoInner.style.display   = 'none';
      fadPhotoPreview.style.display = 'flex';
    };
    reader.readAsDataURL(file);
  });
}
if (fadPhotoRemove) {
  fadPhotoRemove.addEventListener('click', function (e) {
    e.stopPropagation();
    if (fadPhotoInput) fadPhotoInput.value = '';
    fadPhotoImg.src = '';
    fadPhotoPreview.style.display = 'none';
    fadPhotoInner.style.display   = 'flex';
  });
}

/* ── Published toggle visual ── */
var fadActiveCheckbox = document.getElementById('fadActive');
var fadActiveTrack    = document.getElementById('fadActiveTrack');
var fadActiveThumb    = document.getElementById('fadActiveThumb');

function applyFadActiveVisual(checked) {
  if (fadActiveTrack) fadActiveTrack.style.background = checked ? 'rgba(0,169,157,0.85)' : 'rgba(107,45,139,0.2)';
  if (fadActiveThumb) fadActiveThumb.style.transform  = checked ? 'translateX(18px)' : 'translateX(0)';
}
if (fadActiveCheckbox) {
  fadActiveCheckbox.addEventListener('change', function () { applyFadActiveVisual(fadActiveCheckbox.checked); });
  applyFadActiveVisual(true);
}

/* ── Load ── */
async function loadFacultyAdvisors() {
  try {
    var res  = await fetch(API + '/members?all=true', { headers: authH() });
    var data = await res.json();
    fadAdvisors = (data.data || []).filter(function (m) { return m.isFacultyAdvisor === true; });
    renderFadTable();
  } catch (e) {
    showToast('Failed to load faculty advisors.', 'error');
  }
}

/* ── Render table ── */
function renderFadTable() {
  var tbody = document.getElementById('fadTableBody');
  var empty = document.getElementById('fadTableEmpty');
  var count = document.getElementById('fadTableCount');
  if (!tbody) return;

  count.textContent = fadAdvisors.length + ' advisor' + (fadAdvisors.length !== 1 ? 's' : '');

  if (!fadAdvisors.length) {
    tbody.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  var sorted = fadAdvisors.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });

  tbody.innerHTML = sorted.map(function (a) {
    var avatar = a.photo
      ? '<img src="' + a.photo + '" alt="' + a.name + '" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid rgba(107,45,139,0.3);" />'
      : '<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#6B2D8B,#00A99D);display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;color:#fff;">' + (a.name || '?').split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase() + '</div>';
    var status = a.active !== false ? 'active' : 'inactive';
    return '<tr>' +
      '<td>' + avatar + '</td>' +
      '<td style="font-size:0.85rem;font-weight:500;">' + (a.name || '') + '</td>' +
      '<td style="font-size:0.82rem;color:var(--text-muted);">' + (a.role || '') + '</td>' +
      '<td style="font-size:0.78rem;color:var(--text-muted);">' + (a.batch || '') + '</td>' +
      '<td style="font-size:0.8rem;color:var(--text-muted);">' + (a.order || 0) + '</td>' +
      '<td><span class="status-badge status-badge--' + status + '">' + (status === 'active' ? 'Published' : 'Unpublished') + '</span></td>' +
      '<td><div class="action-btns">' +
        '<button class="action-btn action-btn--edit" onclick="editFacultyAdvisor(\'' + a._id + '\')">' +
          '<svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Edit' +
        '</button>' +
        '<button class="action-btn action-btn--delete" onclick="openFadDeleteModal(\'' + a._id + '\')">' +
          '<svg viewBox="0 0 24 24" fill="none" width="12" height="12"><polyline points="3,6 5,6 21,6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Delete' +
        '</button>' +
      '</div></td>' +
    '</tr>';
  }).join('');
}

/* ── Form panel toggle ── */
var fadFormPanel = document.getElementById('fadFormPanel');

document.getElementById('addFadBtn').addEventListener('click', function () {
  resetFadForm();
  fadFormPanel.classList.remove('collapsed');
  fadFormPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
document.getElementById('collapseFadFormBtn').addEventListener('click', function () {
  fadFormPanel.classList.toggle('collapsed');
});

/* ── Reset ── */
function resetFadForm() {
  document.getElementById('fadForm').reset();
  if (fadPhotoInput)  fadPhotoInput.value = '';
  if (fadPhotoImg)    fadPhotoImg.src = '';
  if (fadPhotoPreview) fadPhotoPreview.style.display = 'none';
  if (fadPhotoInner)  fadPhotoInner.style.display = 'flex';
  document.getElementById('fadOrder').value = '0';
  if (fadActiveCheckbox) { fadActiveCheckbox.checked = true; applyFadActiveVisual(true); }
  fadEditingId = null;
  document.getElementById('fadFormTitle').textContent    = 'Add Faculty Advisor';
  document.getElementById('saveFadBtnLabel').textContent = 'Save Faculty Advisor';
}
document.getElementById('resetFadFormBtn').addEventListener('click', resetFadForm);

/* ── Save ── */
document.getElementById('saveFadBtn').addEventListener('click', async function () {
  var name        = document.getElementById('fadName').value.trim();
  var role        = document.getElementById('fadRole').value;
  var designation = document.getElementById('fadDesignation').value.trim();
  if (!name)        { showToast('Name is required.', 'error'); return; }
  if (!role)        { showToast('Please select a faculty role.', 'error'); return; }
  if (!designation) { showToast('Designation is required.', 'error'); return; }

  var dept  = document.getElementById('fadDept').value  || '';
  var email = document.getElementById('fadEmail').value.trim();
  var bio   = document.getElementById('fadBio').value.trim();

  var fd = new FormData();
  fd.append('name',             name);
  fd.append('role',             role);
  fd.append('batch',            designation);
  fd.append('linkedin',         dept);
  fd.append('email',            email);
  fd.append('bio',              bio);
  fd.append('order',            document.getElementById('fadOrder').value || '0');
  fd.append('active',           String(fadActiveCheckbox ? fadActiveCheckbox.checked : true));
  fd.append('isFacultyAdvisor', 'true');
  if (fadPhotoInput && fadPhotoInput.files[0]) fd.append('photo', fadPhotoInput.files[0]);

  var url    = fadEditingId ? (API + '/members/' + fadEditingId) : (API + '/members');
  var method = fadEditingId ? 'PATCH' : 'POST';

  try {
    var res  = await fetch(url, { method: method, headers: authH(), body: fd });
    var data = await res.json();
    if (!res.ok) throw new Error(data.message);
    showToast(fadEditingId ? '"' + name + '" updated.' : '"' + name + '" added.', 'success');
    resetFadForm();
    fadFormPanel.classList.add('collapsed');
    await loadFacultyAdvisors();
  } catch (err) {
    showToast(err.message || 'Failed to save faculty advisor.', 'error');
  }
});

/* ── Edit ── */
function editFacultyAdvisor(id) {
  var a = fadAdvisors.find(function (x) { return x._id === id; });
  if (!a) return;
  fadEditingId = id;

  document.getElementById('fadName').value        = a.name  || '';
  document.getElementById('fadRole').value        = a.role  || '';
  document.getElementById('fadDesignation').value = a.batch || '';
  document.getElementById('fadEmail').value       = a.email || '';
  document.getElementById('fadBio').value         = a.bio   || '';

  var deptSel = document.getElementById('fadDept');
  if (deptSel) deptSel.value = a.linkedin || '';

  document.getElementById('fadOrder').value = a.order != null ? String(a.order) : '0';

  if (fadActiveCheckbox) {
    fadActiveCheckbox.checked = a.active !== false;
    applyFadActiveVisual(a.active !== false);
  }

  if (a.photo) {
    if (fadPhotoImg)     fadPhotoImg.src = a.photo;
    if (fadPhotoInner)   fadPhotoInner.style.display   = 'none';
    if (fadPhotoPreview) fadPhotoPreview.style.display = 'flex';
  } else {
    if (fadPhotoImg)     fadPhotoImg.src = '';
    if (fadPhotoInner)   fadPhotoInner.style.display   = 'flex';
    if (fadPhotoPreview) fadPhotoPreview.style.display = 'none';
  }

  document.getElementById('fadFormTitle').textContent    = 'Edit Faculty Advisor';
  document.getElementById('saveFadBtnLabel').textContent = 'Update Faculty Advisor';
  fadFormPanel.classList.remove('collapsed');
  fadFormPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Delete modal ── */
function openFadDeleteModal(id) {
  fadDeleteTarget = id;
  var a = fadAdvisors.find(function (x) { return x._id === id; });
  document.getElementById('fadDeleteName').textContent = a ? a.name : 'this faculty advisor';
  document.getElementById('fadDeleteModal').style.display = 'flex';
}
document.getElementById('cancelFadDelete').addEventListener('click', function () {
  document.getElementById('fadDeleteModal').style.display = 'none';
  fadDeleteTarget = null;
});
document.getElementById('fadDeleteModal').addEventListener('click', function (e) {
  if (e.target === document.getElementById('fadDeleteModal')) {
    document.getElementById('fadDeleteModal').style.display = 'none';
    fadDeleteTarget = null;
  }
});
document.getElementById('confirmFadDelete').addEventListener('click', async function () {
  if (!fadDeleteTarget) return;
  try {
    var res = await fetch(API + '/members/' + fadDeleteTarget, { method: 'DELETE', headers: authH() });
    if (!res.ok) throw new Error();
    showToast('Faculty advisor removed.', 'delete');
    document.getElementById('fadDeleteModal').style.display = 'none';
    fadDeleteTarget = null;
    await loadFacultyAdvisors();
  } catch (e) {
    showToast('Failed to delete faculty advisor.', 'error');
  }
});

loadFacultyAdvisors();
