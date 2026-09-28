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
    const res = await fetch(`${API}/gallery?drafts=true`, { headers: authH() });
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
    const statusClass = img.published ? 'published' : 'draft';
    const statusText = img.published ? 'Published' : 'Draft';
    return `<div class="gal-card" data-id="${img._id}" data-idx="${idx}">
      <div class="gal-card-img-wrap">
        ${imgContent}
        <div class="gal-card-overlay">
          <button class="gal-card-action gal-card-action--view" onclick="openLightbox(${idx});event.stopPropagation();" title="View">
            <svg viewBox="0 0 24 24" fill="none" width="13" height="13"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/></svg>
          </button>
          <button class="gal-card-action gal-card-action--toggle" onclick="toggleGalleryPublished('${img._id}', ${!!img.published});event.stopPropagation();" title="${img.published ? 'Unpublish' : 'Publish'}">
            <svg viewBox="0 0 24 24" fill="none" width="13" height="13"><path d="M12 2v20M2 12h20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>
          <button class="gal-card-action gal-card-action--delete" onclick="openDeleteModal('${img._id}');event.stopPropagation();" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" width="13" height="13"><polyline points="3,6 5,6 21,6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
      <div class="gal-card-body">
        <div class="gal-card-name" title="${img.title}">${img.title}</div>
        <div class="gal-card-meta"><span class="gal-album-tag">${img.caption||''}</span></div>
        <div class="gal-card-meta"><span class="status-badge status-badge--${statusClass}">${statusText}</span></div>
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
    fd.append('title', name);
    fd.append('caption', caption);
    fd.append('published', 'true');
    fd.append('image', pf.file);
    try {
      const res = await fetch(`${API}/gallery`, { method: 'POST', headers: authH(), body: fd });
      if (res.ok) uploaded++;
    } catch {}
  }

  showToast(`${uploaded} image${uploaded !== 1 ? 's' : ''} uploaded.`, 'success');
  resetUpload(); uploadPanel.classList.add('collapsed');
  await loadGallery();
});

async function toggleGalleryPublished(id, currentPublished) {
  try {
    const res = await fetch(`${API}/gallery/${id}`, {
      method: 'PATCH',
      headers: { ...authH(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: !currentPublished })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update image status');
    showToast(currentPublished ? 'Image moved to draft.' : 'Image published.', 'success');
    await loadGallery();
  } catch (err) {
    showToast(err.message || 'Failed to update image status.', 'error');
  }
}
window.toggleGalleryPublished = toggleGalleryPublished;

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



/* ═══════════════════════════════════════════════════════════════════════════
   EVENT GALLERY — CMS section for public gallery.html #gallery-grid
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

let evtGalItems    = [];
let evtGalEditId   = null;
let evtGalDeleteId = null;

/* ── Photo upload ── */
const evtGalPhotoInput   = document.getElementById('evtGalPhotoInput');
const evtGalPhotoInner   = document.getElementById('evtGalPhotoInner');
const evtGalPhotoPreview = document.getElementById('evtGalPhotoPreview');
const evtGalPhotoImg     = document.getElementById('evtGalPhotoImg');
const evtGalPhotoRemove  = document.getElementById('evtGalPhotoRemove');

evtGalPhotoInput.addEventListener('change', () => {
  const f = evtGalPhotoInput.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = e => { evtGalPhotoImg.src = e.target.result; evtGalPhotoInner.style.display = 'none'; evtGalPhotoPreview.style.display = 'flex'; };
  r.readAsDataURL(f);
});
evtGalPhotoRemove.addEventListener('click', e => {
  e.stopPropagation(); evtGalPhotoInput.value = ''; evtGalPhotoImg.src = '';
  evtGalPhotoPreview.style.display = 'none'; evtGalPhotoInner.style.display = 'flex';
});

/* ── Published toggle visual ── */
const evtGalPubCheckbox = document.getElementById('evtGalPublished');
const evtGalPubTrack    = document.getElementById('evtGalPubTrack');
const evtGalPubThumb    = document.getElementById('evtGalPubThumb');
function applyEvtGalPubVisual(v) {
  evtGalPubTrack.style.background = v ? 'rgba(0,169,157,0.85)' : 'rgba(107,45,139,0.2)';
  evtGalPubThumb.style.transform  = v ? 'translateX(18px)' : 'translateX(0)';
}
evtGalPubCheckbox.addEventListener('change', () => applyEvtGalPubVisual(evtGalPubCheckbox.checked));
applyEvtGalPubVisual(true);

/* ── Load ── */
async function loadEvtGallery() {
  try {
    const res  = await fetch(`${API}/gallery?drafts=true&type=gallery`, { headers: authH() });
    const data = await res.json();
    evtGalItems = (data.data || []).filter(i => !i.type || i.type === 'gallery');
    renderEvtGalTable();
  } catch { showToast('Failed to load event gallery.', 'error'); }
}

/* ── Render table ── */
function renderEvtGalTable() {
  const tbody = document.getElementById('evtGalTableBody');
  const empty = document.getElementById('evtGalTableEmpty');
  const count = document.getElementById('evtGalCount');
  count.textContent = `${evtGalItems.length} photo${evtGalItems.length !== 1 ? 's' : ''}`;
  if (!evtGalItems.length) { tbody.innerHTML = ''; empty.style.display = 'flex'; return; }
  empty.style.display = 'none';
  tbody.innerHTML = evtGalItems.sort((a,b) => (a.order??0)-(b.order??0)).map(i => {
    const thumb = i.imageUrl
      ? `<img src="${i.imageUrl}" alt="${i.title}" style="width:36px;height:36px;border-radius:6px;object-fit:cover;" />`
      : `<div style="width:36px;height:36px;border-radius:6px;background:rgba(107,45,139,0.15);display:flex;align-items:center;justify-content:center;font-size:0.7rem;color:#c084fc;">${(i.title||'').slice(0,2).toUpperCase()}</div>`;
    const st = i.published ? 'published' : 'draft';
    return `<tr>
      <td>${thumb}</td>
      <td style="font-size:0.83rem;font-weight:500;">${i.title||''}</td>
      <td style="font-size:0.78rem;color:var(--text-muted);">${i.caption||''}</td>
      <td style="font-size:0.78rem;color:var(--text-muted);">${i.order??0}</td>
      <td><span class="status-badge status-badge--${st}">${i.published?'Published':'Draft'}</span></td>
      <td><div class="action-btns">
        <button class="action-btn action-btn--edit" onclick="editEvtGal('${i._id}')">
          <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Edit
        </button>
        <button class="action-btn action-btn--delete" onclick="openEvtGalDelete('${i._id}')">
          <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><polyline points="3,6 5,6 21,6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Delete
        </button>
      </div></td>
    </tr>`;
  }).join('');
}

/* ── Form panel ── */
const evtGalFormPanel = document.getElementById('evtGalFormPanel');
document.getElementById('addEvtGalBtn').addEventListener('click', () => {
  resetEvtGalForm();
  evtGalFormPanel.classList.remove('collapsed');
  evtGalFormPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
document.getElementById('collapseEvtGalFormBtn').addEventListener('click', () => evtGalFormPanel.classList.toggle('collapsed'));

function resetEvtGalForm() {
  document.getElementById('evtGalForm').reset();
  evtGalPhotoInput.value = ''; evtGalPhotoImg.src = '';
  evtGalPhotoPreview.style.display = 'none'; evtGalPhotoInner.style.display = 'flex';
  document.getElementById('evtGalOrder').value = '0';
  evtGalPubCheckbox.checked = true; applyEvtGalPubVisual(true);
  evtGalEditId = null;
  document.getElementById('evtGalFormTitle').textContent    = 'Add Event Gallery Item';
  document.getElementById('saveEvtGalBtnLabel').textContent = 'Save Photo';
}
document.getElementById('resetEvtGalFormBtn').addEventListener('click', resetEvtGalForm);

/* ── Save ── */
document.getElementById('saveEvtGalBtn').addEventListener('click', async () => {
  const title = document.getElementById('evtGalTitle').value.trim();
  if (!title) { showToast('Title is required.', 'error'); return; }
  if (!evtGalEditId && !evtGalPhotoInput.files[0]) { showToast('Please select a photo.', 'error'); return; }

  const fd = new FormData();
  fd.append('title',     title);
  fd.append('caption',   document.getElementById('evtGalCaption').value.trim());
  fd.append('order',     document.getElementById('evtGalOrder').value || '0');
  fd.append('published', String(evtGalPubCheckbox.checked));
  fd.append('type',      'gallery');
  if (evtGalPhotoInput.files[0]) fd.append('image', evtGalPhotoInput.files[0]);

  const url    = evtGalEditId ? `${API}/gallery/${evtGalEditId}` : `${API}/gallery`;
  const method = evtGalEditId ? 'PATCH' : 'POST';
  try {
    const res  = await fetch(url, { method, headers: authH(), body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    showToast(evtGalEditId ? 'Photo updated.' : 'Photo added.', 'success');
    resetEvtGalForm(); evtGalFormPanel.classList.add('collapsed');
    await loadEvtGallery();
  } catch (err) { showToast(err.message || 'Failed to save.', 'error'); }
});

/* ── Edit ── */
function editEvtGal(id) {
  const i = evtGalItems.find(x => x._id === id); if (!i) return;
  evtGalEditId = id;
  document.getElementById('evtGalTitle').value   = i.title || '';
  document.getElementById('evtGalCaption').value = i.caption || '';
  document.getElementById('evtGalOrder').value   = i.order != null ? String(i.order) : '0';
  evtGalPubCheckbox.checked = i.published !== false; applyEvtGalPubVisual(evtGalPubCheckbox.checked);
  if (i.imageUrl) { evtGalPhotoImg.src = i.imageUrl; evtGalPhotoInner.style.display='none'; evtGalPhotoPreview.style.display='flex'; }
  else            { evtGalPhotoImg.src=''; evtGalPhotoInner.style.display='flex'; evtGalPhotoPreview.style.display='none'; }
  document.getElementById('evtGalFormTitle').textContent    = 'Edit Event Gallery Item';
  document.getElementById('saveEvtGalBtnLabel').textContent = 'Update Photo';
  evtGalFormPanel.classList.remove('collapsed');
  evtGalFormPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
window.editEvtGal = editEvtGal;

/* ── Delete ── */
function openEvtGalDelete(id) {
  evtGalDeleteId = id;
  const i = evtGalItems.find(x => x._id === id);
  document.getElementById('evtGalDeleteName').textContent = i ? `"${i.title}"` : 'this photo';
  document.getElementById('evtGalDeleteModal').style.display = 'flex';
}
window.openEvtGalDelete = openEvtGalDelete;
document.getElementById('cancelEvtGalDelete').addEventListener('click', () => {
  document.getElementById('evtGalDeleteModal').style.display = 'none'; evtGalDeleteId = null;
});
document.getElementById('evtGalDeleteModal').addEventListener('click', e => {
  if (e.target === document.getElementById('evtGalDeleteModal')) { document.getElementById('evtGalDeleteModal').style.display = 'none'; evtGalDeleteId = null; }
});
document.getElementById('confirmEvtGalDelete').addEventListener('click', async () => {
  if (!evtGalDeleteId) return;
  try {
    const res = await fetch(`${API}/gallery/${evtGalDeleteId}`, { method: 'DELETE', headers: authH() });
    if (!res.ok) throw new Error();
    showToast('Photo deleted.', 'delete');
    document.getElementById('evtGalDeleteModal').style.display = 'none'; evtGalDeleteId = null;
    await loadEvtGallery();
  } catch { showToast('Failed to delete.', 'error'); }
});

/* ── Init ── */
loadEvtGallery();


/* ═══════════════════════════════════════════════════════════════════════════
   HIGHLIGHTED VIDEOS — CMS section for public gallery.html #gallery-videos
   ═══════════════════════════════════════════════════════════════════════════ */

let vidItems    = [];
let vidEditId   = null;
let vidDeleteId = null;

/* ── Published toggle visual ── */
const vidPubCheckbox = document.getElementById('vidPublished');
const vidPubTrack    = document.getElementById('vidPubTrack');
const vidPubThumb    = document.getElementById('vidPubThumb');
function applyVidPubVisual(v) {
  vidPubTrack.style.background = v ? 'rgba(0,169,157,0.85)' : 'rgba(107,45,139,0.2)';
  vidPubThumb.style.transform  = v ? 'translateX(18px)' : 'translateX(0)';
}
vidPubCheckbox.addEventListener('change', () => applyVidPubVisual(vidPubCheckbox.checked));
applyVidPubVisual(true);

/* ── Load ── */
async function loadVideos() {
  try {
    const res  = await fetch(`${API}/gallery?drafts=true&type=video`, { headers: authH() });
    const data = await res.json();
    vidItems = (data.data || []).filter(i => i.type === 'video');
    renderVidTable();
  } catch { showToast('Failed to load videos.', 'error'); }
}

/* ── Render table ── */
function renderVidTable() {
  const tbody = document.getElementById('vidTableBody');
  const empty = document.getElementById('vidTableEmpty');
  const count = document.getElementById('vidCount');
  count.textContent = `${vidItems.length} video${vidItems.length !== 1 ? 's' : ''}`;
  if (!vidItems.length) { tbody.innerHTML = ''; empty.style.display = 'flex'; return; }
  empty.style.display = 'none';
  tbody.innerHTML = vidItems.sort((a,b) => (a.order??0)-(b.order??0)).map(i => {
    const urlShort = (i.videoUrl||'').length > 40 ? (i.videoUrl||'').slice(0,40)+'…' : (i.videoUrl||'');
    const st = i.published ? 'published' : 'draft';
    return `<tr>
      <td style="font-size:0.83rem;font-weight:500;">${i.title||''}</td>
      <td style="font-size:0.75rem;color:var(--text-muted);font-family:monospace;">${urlShort}</td>
      <td style="font-size:0.78rem;color:var(--text-muted);">${i.order??0}</td>
      <td><span class="status-badge status-badge--${st}">${i.published?'Published':'Draft'}</span></td>
      <td><div class="action-btns">
        <button class="action-btn action-btn--edit" onclick="editVid('${i._id}')">
          <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Edit
        </button>
        <button class="action-btn action-btn--delete" onclick="openVidDelete('${i._id}')">
          <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><polyline points="3,6 5,6 21,6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Delete
        </button>
      </div></td>
    </tr>`;
  }).join('');
}

/* ── Form panel ── */
const vidFormPanel = document.getElementById('vidFormPanel');
document.getElementById('addVidBtn').addEventListener('click', () => {
  resetVidForm();
  vidFormPanel.classList.remove('collapsed');
  vidFormPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
document.getElementById('collapseVidFormBtn').addEventListener('click', () => vidFormPanel.classList.toggle('collapsed'));

function resetVidForm() {
  document.getElementById('vidForm').reset();
  document.getElementById('vidOrder').value = '0';
  vidPubCheckbox.checked = true; applyVidPubVisual(true);
  vidEditId = null;
  document.getElementById('vidFormTitle').textContent    = 'Add Highlighted Video';
  document.getElementById('saveVidBtnLabel').textContent = 'Save Video';
}
document.getElementById('resetVidFormBtn').addEventListener('click', resetVidForm);

/* ── YouTube ID extraction ── */
function extractYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/* ── Save ── */
document.getElementById('saveVidBtn').addEventListener('click', async () => {
  const title    = document.getElementById('vidTitle').value.trim();
  const videoUrl = document.getElementById('vidUrl').value.trim();
  if (!title)    { showToast('Title is required.', 'error');    return; }
  if (!videoUrl) { showToast('Video URL is required.', 'error'); return; }
  if (!extractYouTubeId(videoUrl)) { showToast('Please enter a valid YouTube URL.', 'error'); return; }

  const payload = {
    title,
    videoUrl,
    caption:   document.getElementById('vidCaption').value.trim(),
    order:     Number(document.getElementById('vidOrder').value) || 0,
    published: vidPubCheckbox.checked,
    type:      'video',
    /* imageUrl must not be empty for validation — use a placeholder for video items */
    imageUrl:  '',
  };

  const url    = vidEditId ? `${API}/gallery/${vidEditId}` : `${API}/gallery`;
  const method = vidEditId ? 'PATCH' : 'POST';
  try {
    const res  = await fetch(url, {
      method,
      headers: { ...authH(), 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    showToast(vidEditId ? 'Video updated.' : 'Video added.', 'success');
    resetVidForm(); vidFormPanel.classList.add('collapsed');
    await loadVideos();
  } catch (err) { showToast(err.message || 'Failed to save.', 'error'); }
});

/* ── Edit ── */
function editVid(id) {
  const i = vidItems.find(x => x._id === id); if (!i) return;
  vidEditId = id;
  document.getElementById('vidTitle').value   = i.title || '';
  document.getElementById('vidUrl').value     = i.videoUrl || '';
  document.getElementById('vidCaption').value = i.caption || '';
  document.getElementById('vidOrder').value   = i.order != null ? String(i.order) : '0';
  vidPubCheckbox.checked = i.published !== false; applyVidPubVisual(vidPubCheckbox.checked);
  document.getElementById('vidFormTitle').textContent    = 'Edit Highlighted Video';
  document.getElementById('saveVidBtnLabel').textContent = 'Update Video';
  vidFormPanel.classList.remove('collapsed');
  vidFormPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
window.editVid = editVid;

/* ── Delete ── */
function openVidDelete(id) {
  vidDeleteId = id;
  const i = vidItems.find(x => x._id === id);
  document.getElementById('vidDeleteName').textContent = i ? `"${i.title}"` : 'this video';
  document.getElementById('vidDeleteModal').style.display = 'flex';
}
window.openVidDelete = openVidDelete;
document.getElementById('cancelVidDelete').addEventListener('click', () => {
  document.getElementById('vidDeleteModal').style.display = 'none'; vidDeleteId = null;
});
document.getElementById('vidDeleteModal').addEventListener('click', e => {
  if (e.target === document.getElementById('vidDeleteModal')) { document.getElementById('vidDeleteModal').style.display = 'none'; vidDeleteId = null; }
});
document.getElementById('confirmVidDelete').addEventListener('click', async () => {
  if (!vidDeleteId) return;
  try {
    const res = await fetch(`${API}/gallery/${vidDeleteId}`, { method: 'DELETE', headers: authH() });
    if (!res.ok) throw new Error();
    showToast('Video deleted.', 'delete');
    document.getElementById('vidDeleteModal').style.display = 'none'; vidDeleteId = null;
    await loadVideos();
  } catch { showToast('Failed to delete.', 'error'); }
});

/* ── Init ── */
loadVideos();
