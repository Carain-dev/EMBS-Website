if (localStorage.getItem('embs_admin_auth') !== 'true') window.location.href = 'index.html';
'use strict';

const API = window.EMBS_API_BASE;
const TOKEN = () => localStorage.getItem('embs_admin_token');
const authH = () => ({ 'Authorization': `Bearer ${TOKEN()}` });
const jsonH = () => ({ 'Authorization': `Bearer ${TOKEN()}`, 'Content-Type': 'application/json' });

/* ── Sidebar toggle ── */
const sidebar = document.getElementById('sidebar');
const toggle  = document.getElementById('sidebarToggle');
const overlay = document.getElementById('sidebarOverlay');
toggle.addEventListener('click', () => { sidebar.classList.toggle('open'); overlay.classList.toggle('active'); });
overlay.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('active'); });

let events = [];
let editingId = null;
let deleteTarget = null;
let activeTags = [];
let activeFilter = 'all';

/* ── Load events from API ── */
async function loadEvents() {
  try {
    const res = await fetch(`${API}/events`);
    const data = await res.json();
    events = data.data || [];
    renderTable();
  } catch {
    showToast('Failed to load events.', 'error');
  }
}

/* ── Helpers ── */
function typeClass(type) {
  const map = { Workshop:'workshop', Hackathon:'hackathon', Seminar:'seminar',
    'Guest Lecture':'lecture', Competition:'competition', Webinar:'webinar' };
  return map[type] || 'other';
}
function modeClass(mode) {
  return mode === 'offline' ? 'inperson' : mode === 'online' ? 'online' : 'hybrid';
}
function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ── Render Table ── */
function renderTable() {
  const query = document.getElementById('tableSearch').value.toLowerCase();
  const tbody = document.getElementById('eventsTableBody');
  const empty = document.getElementById('tableEmpty');
  const count = document.getElementById('tableCount');

  let filtered = events.filter(ev => {
    const matchFilter = activeFilter === 'all' || ev.status === activeFilter;
    const matchSearch = !query ||
      (ev.title || '').toLowerCase().includes(query) ||
      (ev.type || '').toLowerCase().includes(query) ||
      (ev.speaker || '').toLowerCase().includes(query);
    return matchFilter && matchSearch;
  });

  count.textContent = `Showing ${filtered.length} event${filtered.length !== 1 ? 's' : ''}`;

  if (!filtered.length) { tbody.innerHTML = ''; empty.style.display = 'flex'; return; }
  empty.style.display = 'none';

  tbody.innerHTML = filtered.map(ev => `
    <tr data-id="${ev._id}">
      <td><div class="td-title">${ev.title}</div><div class="td-speaker">${ev.speaker || ''}</div></td>
      <td><span class="type-badge type-badge--${typeClass(ev.type)}">${ev.type || ''}</span></td>
      <td>${fmtDate(ev.date)}</td>
      <td><span class="mode-badge"><span class="mode-dot mode-dot--${modeClass(ev.mode)}"></span>${ev.mode || ''}</span></td>
      <td><span class="status-badge status-badge--${ev.status}">${ev.status ? ev.status.charAt(0).toUpperCase()+ev.status.slice(1) : ''}</span></td>
      <td><div class="action-btns">
        <button class="action-btn action-btn--edit" onclick="editEvent('${ev._id}')">
          <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Edit
        </button>
        <button class="action-btn action-btn--delete" onclick="openDeleteModal('${ev._id}')">
          <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><polyline points="3,6 5,6 21,6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Delete
        </button>
      </div></td>
    </tr>`).join('');
}

/* ── Tags ── */
function renderTags() {
  document.getElementById('tagsList').innerHTML = activeTags.map((t, i) =>
    `<span class="tag-chip">${t}<button type="button" class="tag-chip-remove" onclick="removeTag(${i})">✕</button></span>`
  ).join('');
}
function removeTag(i) { activeTags.splice(i, 1); renderTags(); }

document.getElementById('tagsInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const val = e.target.value.replace(',', '').trim();
    if (val && !activeTags.includes(val)) { activeTags.push(val); renderTags(); }
    e.target.value = '';
  }
});
document.getElementById('tagsWrap').addEventListener('click', () => document.getElementById('tagsInput').focus());

/* ── Image Upload Previews ── */
function setupUpload(inputId, innerId, previewId, imgId, removeId) {
  const input = document.getElementById(inputId);
  const inner = document.getElementById(innerId);
  const preview = document.getElementById(previewId);
  const img = document.getElementById(imgId);
  const remove = document.getElementById(removeId);
  input.addEventListener('change', () => {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => { img.src = e.target.result; inner.style.display = 'none'; preview.style.display = 'flex'; };
    reader.readAsDataURL(file);
  });
  remove.addEventListener('click', e => {
    e.stopPropagation(); input.value = ''; img.src = '';
    preview.style.display = 'none'; inner.style.display = 'flex';
  });
}
setupUpload('thumbInput', 'thumbInner', 'thumbPreview', 'thumbImg', 'thumbRemove');
setupUpload('speakerInput', 'speakerInner', 'speakerPreview', 'speakerImg', 'speakerRemove');

['thumbZone','speakerZone'].forEach(id => {
  const zone = document.getElementById(id);
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('drag-over'); });
});

/* ── Form Collapse ── */
const formPanel = document.getElementById('eventFormPanel');
document.getElementById('collapseFormBtn').addEventListener('click', () => formPanel.classList.toggle('collapsed'));
document.getElementById('toggleFormBtn').addEventListener('click', () => {
  resetForm(); formPanel.classList.remove('collapsed');
  formPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

/* ── Reset Form ── */
function resetForm() {
  document.getElementById('eventForm').reset();
  activeTags = []; renderTags();
  ['thumbInput','speakerInput'].forEach(id => document.getElementById(id).value = '');
  ['thumbPreview','speakerPreview'].forEach(id => document.getElementById(id).style.display = 'none');
  ['thumbInner','speakerInner'].forEach(id => document.getElementById(id).style.display = 'flex');
  document.getElementById('thumbImg').src = '';
  document.getElementById('speakerImg').src = '';
  editingId = null;
  document.getElementById('formPanelTitle').textContent = 'Add New Event';
  document.getElementById('publishBtn').textContent = 'Publish Event';
}
document.getElementById('resetFormBtn').addEventListener('click', resetForm);

/* ── Edit Event ── */
function editEvent(id) {
  const ev = events.find(e => e._id === id); if (!ev) return;
  editingId = id;
  document.getElementById('evTitle').value   = ev.title || '';
  document.getElementById('evType').value    = ev.type || '';
  document.getElementById('evDate').value    = ev.date || '';
  document.getElementById('evVenue').value   = ev.venue || '';
  document.getElementById('evMode').value    = ev.mode || '';
  document.getElementById('evSpeaker').value = ev.speaker || '';
  document.getElementById('evRegLink').value = ev.registrationLink || '';
  document.getElementById('evDesc').value    = ev.description || '';
  activeTags = [...(ev.tags || [])]; renderTags();
  document.getElementById('formPanelTitle').textContent = 'Edit Event';
  document.getElementById('publishBtn').textContent = 'Update Event';
  formPanel.classList.remove('collapsed');
  formPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Get Form Data ── */
function getFormData(status) {
  const fd = new FormData();
  fd.append('title',            document.getElementById('evTitle').value.trim());
  fd.append('type',             document.getElementById('evType').value);
  fd.append('date',             document.getElementById('evDate').value);
  fd.append('venue',            document.getElementById('evVenue').value.trim());
  fd.append('mode',             document.getElementById('evMode').value || 'offline');
  fd.append('speaker',          document.getElementById('evSpeaker').value.trim());
  fd.append('registrationLink', document.getElementById('evRegLink').value.trim());
  fd.append('description',      document.getElementById('evDesc').value.trim());
  fd.append('status',           status);
  activeTags.forEach(t => fd.append('tags', t));
  const thumbFile   = document.getElementById('thumbInput').files[0];
  const speakerFile = document.getElementById('speakerInput').files[0];
  if (thumbFile)   fd.append('thumbnail',    thumbFile);
  if (speakerFile) fd.append('speakerPhoto', speakerFile);
  return fd;
}

/* ── Save Draft ── */
document.getElementById('saveDraftBtn').addEventListener('click', async () => {
  const title = document.getElementById('evTitle').value.trim();
  if (!title) { showToast('Please enter an event title.', 'error'); return; }
  await saveEvent('upcoming');
});

/* ── Publish Event ── */
document.getElementById('publishBtn').addEventListener('click', async () => {
  const title = document.getElementById('evTitle').value.trim();
  const date  = document.getElementById('evDate').value;
  if (!title || !date) { showToast('Title and Date are required.', 'error'); return; }
  const status = new Date(date) > new Date() ? 'upcoming' : 'completed';
  await saveEvent(status);
});

async function saveEvent(status) {
  const fd = getFormData(status);
  try {
    const url = editingId ? `${API}/events/${editingId}` : `${API}/events`;
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: authH(), body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    showToast(editingId ? 'Event updated successfully.' : 'Event published successfully.', 'success');
    resetForm(); formPanel.classList.add('collapsed');
    await loadEvents();
  } catch (err) {
    showToast(err.message || 'Failed to save event.', 'error');
  }
}

/* ── Delete Modal ── */
function openDeleteModal(id) {
  deleteTarget = id;
  const ev = events.find(e => e._id === id);
  document.getElementById('deleteEventName').textContent = ev ? ev.title : 'this event';
  document.getElementById('deleteModal').style.display = 'flex';
}
document.getElementById('cancelDelete').addEventListener('click', () => {
  document.getElementById('deleteModal').style.display = 'none'; deleteTarget = null;
});
document.getElementById('confirmDelete').addEventListener('click', async () => {
  if (!deleteTarget) return;
  try {
    const res = await fetch(`${API}/events/${deleteTarget}`, { method: 'DELETE', headers: authH() });
    if (!res.ok) throw new Error();
    showToast('Event deleted.', 'delete');
    document.getElementById('deleteModal').style.display = 'none'; deleteTarget = null;
    await loadEvents();
  } catch { showToast('Failed to delete event.', 'error'); }
});
document.getElementById('deleteModal').addEventListener('click', e => {
  if (e.target === document.getElementById('deleteModal')) {
    document.getElementById('deleteModal').style.display = 'none'; deleteTarget = null;
  }
});

/* ── Search & Filter ── */
document.getElementById('tableSearch').addEventListener('input', renderTable);
document.querySelectorAll('.filter-pill').forEach(pill => {
  pill.addEventListener('click', function () {
    document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
    this.classList.add('active'); activeFilter = this.dataset.filter; renderTable();
  });
});

/* ── Toast ── */
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg; toast.className = `toast toast--${type} show`;
  clearTimeout(toast._timer); toast._timer = setTimeout(() => toast.classList.remove('show'), 3200);
}

loadEvents();

