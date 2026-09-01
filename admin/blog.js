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

let blogs = [];
let editingId = null;
let deleteTargetId = null;
let tags = [];

/* ── DOM Refs ── */
const blogForm       = document.getElementById('blogForm');
const blogTitle      = document.getElementById('blogTitle');
const blogCategory   = document.getElementById('blogCategory');
const blogAuthor     = document.getElementById('blogAuthor');
const editorBody     = document.getElementById('editorBody');
const tagsInput      = document.getElementById('tagsInput');
const tagsList       = document.getElementById('tagsList');
const tagsWrap       = document.getElementById('tagsWrap');
const uploadZone     = document.getElementById('uploadZone');
const coverInput     = document.getElementById('coverImageInput');
const coverPreview   = document.getElementById('coverPreview');
const uploadPlaceholder = document.getElementById('uploadPlaceholder');
const blogSearch     = document.getElementById('blogSearch');
const blogTableBody  = document.getElementById('blogTableBody');
const tableEmpty     = document.getElementById('tableEmpty');
const formTitle      = document.getElementById('formTitle');
const modalOverlay   = document.getElementById('modalOverlay');
const toast          = document.getElementById('toast');

/* ── Load blogs ── */
async function loadBlogs() {
  try {
    const res = await fetch(`${API}/blogs?drafts=true`, { headers: authH() });
    const data = await res.json();
    blogs = data.data || [];
    renderTable(blogSearch.value);
  } catch { showToast('Failed to load blogs.', 'error'); }
}

/* ── Render Table ── */
function renderTable(filter = '') {
  const q = filter.toLowerCase();
  const filtered = blogs.filter(b =>
    (b.title || '').toLowerCase().includes(q) ||
    (b.tags || []).some(t => t.toLowerCase().includes(q))
  );

  blogTableBody.innerHTML = '';
  tableEmpty.style.display = filtered.length === 0 ? 'block' : 'none';

  filtered.forEach(b => {
    const status = b.published ? 'published' : 'draft';
    const date   = b.publishedAt ? new Date(b.publishedAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '—';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="td-title" title="${b.title}">${b.title}</td>
      <td>${b.tags ? b.tags.join(', ') : ''}</td>
      <td><span class="status-badge status-badge--${status}">${status === 'published' ? 'Published' : 'Draft'}</span></td>
      <td>${date}</td>
      <td><div class="td-actions">
        <button class="action-btn action-btn--edit" data-id="${b._id}" title="Edit">
          <svg viewBox="0 0 24 24" fill="none" width="13" height="13"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="action-btn action-btn--delete" data-id="${b._id}" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" width="13" height="13"><polyline points="3,6 5,6 21,6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div></td>`;
    blogTableBody.appendChild(tr);
  });

  blogTableBody.querySelectorAll('.action-btn--edit').forEach(btn =>
    btn.addEventListener('click', () => loadEdit(btn.dataset.id))
  );
  blogTableBody.querySelectorAll('.action-btn--delete').forEach(btn =>
    btn.addEventListener('click', () => openDeleteModal(btn.dataset.id))
  );
}

/* ── Tags ── */
function renderTags() {
  tagsList.innerHTML = tags.map((t, i) =>
    `<span class="tag-chip">${t}<button class="tag-remove" data-i="${i}" type="button">×</button></span>`
  ).join('');
  tagsList.querySelectorAll('.tag-remove').forEach(btn =>
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

/* ── Cover Image Upload ── */
uploadZone.addEventListener('click', () => coverInput.click());
coverInput.addEventListener('change', () => {
  const file = coverInput.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => showPreview(e.target.result);
  reader.readAsDataURL(file);
});
function showPreview(src) {
  coverPreview.src = src; coverPreview.classList.add('visible');
  uploadPlaceholder.style.display = 'none';
}
function clearPreview() {
  coverPreview.src = ''; coverPreview.classList.remove('visible');
  uploadPlaceholder.style.display = ''; coverInput.value = '';
}

/* ── Toolbar ── */
document.querySelectorAll('.tb-btn').forEach(btn => {
  btn.addEventListener('mousedown', e => {
    e.preventDefault(); const cmd = btn.dataset.cmd; editorBody.focus();
    if (cmd === 'bold') document.execCommand('bold');
    else if (cmd === 'italic') document.execCommand('italic');
    else if (cmd === 'list') document.execCommand('insertUnorderedList');
    else if (cmd === 'link') { const url = prompt('Enter URL:'); if (url) document.execCommand('createLink', false, url); }
  });
});

/* ── Save / Publish ── */
function collectForm(published) {
  const title   = blogTitle.value.trim();
  const content = editorBody.innerHTML.trim();
  if (!title || !content || content === '<p>Start writing your blog post here…</p>') {
    showToast('Please fill in title and content.', 'error'); return null;
  }
  const fd = new FormData();
  fd.append('title',     title);
  fd.append('content',   content);
  fd.append('published', published);
  tags.forEach(t => fd.append('tags', t));
  if (coverInput.files[0]) fd.append('thumbnail', coverInput.files[0]);
  return fd;
}

document.getElementById('saveDraftBtn').addEventListener('click', async () => {
  const fd = collectForm(false); if (!fd) return;
  await savePost(fd, false);
});
document.getElementById('publishBtn').addEventListener('click', async () => {
  const fd = collectForm(true); if (!fd) return;
  await savePost(fd, true);
});

async function savePost(fd, published) {
  try {
    const url    = editingId ? `${API}/blogs/${editingId}` : `${API}/blogs`;
    const method = editingId ? 'PATCH' : 'POST';
    const res    = await fetch(url, { method, headers: authH(), body: fd });
    const data   = await res.json();
    if (!res.ok) throw new Error(data.message);
    showToast(published ? 'Blog post published!' : 'Draft saved successfully.', 'success');
    resetForm(); await loadBlogs();
  } catch (err) { showToast(err.message || 'Failed to save.', 'error'); }
}

/* ── Edit ── */
function loadEdit(id) {
  const b = blogs.find(b => b._id === id); if (!b) return;
  editingId = id;
  blogTitle.value      = b.title;
  editorBody.innerHTML = b.content;
  tags = [...(b.tags || [])]; renderTags();
  formTitle.textContent = 'Edit Blog Post';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Delete ── */
function openDeleteModal(id) { deleteTargetId = id; modalOverlay.classList.add('active'); }
document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
  modalOverlay.classList.remove('active'); deleteTargetId = null;
});
document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
  try {
    const res = await fetch(`${API}/blogs/${deleteTargetId}`, { method: 'DELETE', headers: authH() });
    if (!res.ok) throw new Error();
    modalOverlay.classList.remove('active'); deleteTargetId = null;
    showToast('Blog post deleted.', 'error'); await loadBlogs();
  } catch { showToast('Failed to delete.', 'error'); }
});
modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) { modalOverlay.classList.remove('active'); deleteTargetId = null; }
});

/* ── Reset ── */
function resetForm() {
  editingId = null; blogForm.reset();
  editorBody.innerHTML = '<p>Start writing your blog post here…</p>';
  tags = []; renderTags(); clearPreview();
  formTitle.textContent = 'Create New Blog Post';
}
document.getElementById('resetFormBtn').addEventListener('click', resetForm);

/* ── Search ── */
blogSearch.addEventListener('input', () => renderTable(blogSearch.value));

/* ── Toast ── */
let toastTimer;
function showToast(msg, type = 'success') {
  toast.textContent = msg; toast.className = `toast toast--${type} show`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

loadBlogs();

