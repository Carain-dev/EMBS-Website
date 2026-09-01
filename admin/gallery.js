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

let images = [];
let deleteTarget = null;
let lbIndex = 0;
let lbFiltered = [];
let pendingFiles = [];

/* ── Load ── */
async function loadGallery() {
  try {
    const res = await fetch(`${API}/gallery`);
    const data = await res.json();
    images = data.data || [];
    renderGallery(); updateStats();
  } catch { showToast('Failed to load gallery.', 'error'); }
}

/* ── Stats ── */
function updateStats() {
  document.getElementById('statTotal').textContent      = images.length;
  document.getElementById('statAlbums').textContent     = new Set(images.map(i => i.caption||'')).size;
  document.getElementById('statEvents').textContent     = new Set(images.map(i => i.event?._id||i.event||'').filter(Boolean)).size;
  document.getElementById('statCategories').textContent = 1;
}

/* ── Render Gallery Grid ── */
function renderGallery() {
  const q       = document.getElementById('gallerySearch').value.toLowerCase();
  const grid    = document.getElementById('galleryGrid');
  const empty   = document.getElementById('galleryEmpty');
  const counter = document.getElementById('galleryCount');

  const filtered = images.filter(img => {
    return !q || (img.title||'').toLowerCase().includes(q) || (img.caption||'').toLowerCase().includes(q);
  });

  lbFiltered = filtered;
  counter.textContent = `Showing ${filtered.length} image${filtered.length !== 1 ? 's' : ''}`;

  if (!filtered.length) { grid.innerHTML = ''; empty.style.display = 'flex'; return; }
  empty.style.display = 'none';

  grid.innerHTML = filtered.map((img, idx) => {
    const imgContent = img.imageUrl
      ? `<img src="${img.imageUrl}" alt="${img.title}" loading="lazy" />`
      : `<div class="gal-card-img-placeholder">${(img.title||'').slice(0,2).toUpperCase()}</div>`;
    return `<div class="gal-card" data-id="${img._id}" data-idx="${idx}">
      <div class="gal-card-img-wrap">
        ${imgContent}
        <div class="gal-card-overlay">
          <button class="gal-card-action gal-card-action--view" onclick="openLightbox(${idx});event.stopPropagation();" title="View">
            <svg viewBox="0 0 24 24" fill="none" width="13" height="13"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/></svg>
          </button>
          <button class="gal-card-action gal-card-action--delete" onclick="openDeleteModal('${img._id}');event.stopPropagation();" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" width="13" height="13"><polyline points="3,6 5,6 21,6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
      <div class="gal-card-body">
        <div class="gal-card-name" title="${img.title}">${img.title}</div>
        <div class="gal-card-meta"><span class="gal-album-tag">${img.caption||''}</span></div>
      </div>
    </div>`;
  }).join('');
}

/* ── Upload Panel toggle ── */
const uploadPanel = document.getElementById('uploadPanel');
document.getElementById('collapseUploadBtn').addEventListener('click', () => uploadPanel.classList.toggle('collapsed'));
document.getElementById('toggleUploadBtn').addEventListener('click', () => {
  uploadPanel.classList.remove('collapsed');
  uploadPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

/* ── Drop Zone ── */
const dropZone     = document.getElementById('dropZone');
const fileInput    = document.getElementById('fileInput');
const previewStrip = document.getElementById('previewStrip');
const previewGrid  = document.getElementById('previewGrid');
const previewCount = document.getElementById('previewCount');

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('drag-over');
  addFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')));
});
fileInput.addEventListener('change', () => { addFiles(Array.from(fileInput.files)); fileInput.value = ''; });

function addFiles(files) {
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => { pendingFiles.push({ file, src: e.target.result }); renderPreview(); };
    reader.readAsDataURL(file);
  });
}
function renderPreview() {
  if (!pendingFiles.length) { previewStrip.style.display = 'none'; return; }
  previewStrip.style.display = 'flex';
  previewCount.textContent = `${pendingFiles.length} image${pendingFiles.length !== 1 ? 's' : ''} selected`;
  previewGrid.innerHTML = pendingFiles.map((pf, i) =>
    `<div class="gal-preview-item"><img src="${pf.src}" alt="preview" /><button class="gal-preview-remove" onclick="removePreview(${i})">x</button></div>`
  ).join('');
}
function removePreview(idx) { pendingFiles.splice(idx, 1); renderPreview(); }
document.getElementById('clearFilesBtn').addEventListener('click', () => { pendingFiles = []; renderPreview(); });

function resetUpload() {
  document.getElementById('upAlbum') && (document.getElementById('upAlbum').value = '');
  document.getElementById('upCategory') && (document.getElementById('upCategory').value = '');
  document.getElementById('upEvent') && (document.getElementById('upEvent').value = '');
  pendingFiles = []; renderPreview();
}
document.getElementById('resetUploadBtn').addEventListener('click', resetUpload);

/* ── Submit Upload ── */
document.getElementById('uploadSubmitBtn').addEventListener('click', async () => {
  const caption = document.getElementById('upAlbum')?.value.trim() || '';
  if (!pendingFiles.length) { showToast('Please select at least one image.', 'error'); return; }

  let uploaded = 0;
  for (const pf of pendingFiles) {
    const fd = new FormData();
    const name = pf.file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    fd.append('title',   name);
    fd.append('caption', caption);
    fd.append('image',   pf.file);
    try {
      const res = await fetch(`${API}/gallery`, { method: 'POST', headers: authH(), body: fd });
      if (res.ok) uploaded++;
    } catch {}
  }

  showToast(`${uploaded} image${uploaded !== 1 ? 's' : ''} uploaded.`, 'success');
  resetUpload(); uploadPanel.classList.add('collapsed');
  await loadGallery();
});

/* ── Search ── */
document.getElementById('gallerySearch').addEventListener('input', renderGallery);

/* ── Lightbox ── */
function openLightbox(idx) {
  lbIndex = idx; showLbImage();
  document.getElementById('lightbox').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
function showLbImage() {
  const img = lbFiltered[lbIndex]; if (!img) return;
  const lbImg = document.getElementById('lbImg');
  if (img.imageUrl) { lbImg.src = img.imageUrl; lbImg.style.display = 'block'; }
  else { lbImg.src = ''; lbImg.style.display = 'none'; }
  document.getElementById('lbTitle').textContent = img.title;
  document.getElementById('lbMeta').textContent  = img.caption || '';
}
function closeLightbox() { document.getElementById('lightbox').style.display = 'none'; document.body.style.overflow = ''; }
document.getElementById('lbClose').addEventListener('click', closeLightbox);
document.getElementById('lightbox').addEventListener('click', e => { if (e.target === document.getElementById('lightbox')) closeLightbox(); });
document.getElementById('lbPrev').addEventListener('click', () => { lbIndex = (lbIndex - 1 + lbFiltered.length) % lbFiltered.length; showLbImage(); });
document.getElementById('lbNext').addEventListener('click', () => { lbIndex = (lbIndex + 1) % lbFiltered.length; showLbImage(); });
document.addEventListener('keydown', e => {
  if (document.getElementById('lightbox').style.display === 'none') return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft')  { lbIndex = (lbIndex - 1 + lbFiltered.length) % lbFiltered.length; showLbImage(); }
  if (e.key === 'ArrowRight') { lbIndex = (lbIndex + 1) % lbFiltered.length; showLbImage(); }
});

/* ── Delete ── */
function openDeleteModal(id) {
  deleteTarget = id;
  const img = images.find(i => i._id === id);
  document.getElementById('deleteImgName').textContent = img ? img.title : 'this image';
  document.getElementById('deleteModal').style.display = 'flex';
}
document.getElementById('cancelDelete').addEventListener('click', () => {
  document.getElementById('deleteModal').style.display = 'none'; deleteTarget = null;
});
document.getElementById('confirmDelete').addEventListener('click', async () => {
  if (!deleteTarget) return;
  try {
    const res = await fetch(`${API}/gallery/${deleteTarget}`, { method: 'DELETE', headers: authH() });
    if (!res.ok) throw new Error();
    showToast('Image deleted.', 'delete');
    document.getElementById('deleteModal').style.display = 'none'; deleteTarget = null;
    await loadGallery();
  } catch { showToast('Failed to delete.', 'error'); }
});
document.getElementById('deleteModal').addEventListener('click', e => {
  if (e.target === document.getElementById('deleteModal')) {
    document.getElementById('deleteModal').style.display = 'none'; deleteTarget = null;
  }
});

/* ── Toast ── */
function showToast(msg, type) {
  const toast = document.getElementById('toast');
  toast.textContent = msg; toast.className = `toast toast--${type || 'success'} show`;
  clearTimeout(toast._t); toast._t = setTimeout(() => toast.classList.remove('show'), 3200);
}

loadGallery();

