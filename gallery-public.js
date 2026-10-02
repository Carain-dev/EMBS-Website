/* ============================================================
   gallery-public.js — IEEE EMBS KPRIET
   Public Gallery page driver.

   Backend contract (no backend changes made):
     GET /api/gallery?type=gallery
       → { success, data: [ { _id, title, imageUrl, caption,
                              order, published, publishedAt,
                              type, videoUrl, event, createdAt } ] }
     GET /api/gallery?type=video
       → { success, data: [ { _id, title, videoUrl, caption,
                              order, published, createdAt } ] }
     GET /api/site-settings/public
       → { success, data: { galleryFeaturedHeading, galleryFeaturedDesc, … } }

   Albums: there is no separate Album model.
   The `caption` field on each Gallery document is used as the
   album / collection name.  Distinct captions = distinct albums.

   Events: the `event` field is an ObjectId reference.
   The public GET /api/gallery endpoint populates it with
   { title } only.  No event description is available on the
   public gallery endpoint without a separate events API call,
   so we display the event title where present but do not invent
   descriptions.
   ============================================================ */

(function () {
  'use strict';

  /* ── API base ──────────────────────────────────────────────── */
  var API = window.EMBS_API_BASE;

  /* ── State ─────────────────────────────────────────────────── */
  var allPhotos    = [];   /* normalised published photos  */
  var allVideos    = [];   /* normalised published videos  */
  var activeFilter = 'all';

  /* ══════════════════════════════════════════════════════════════
     UTILITY HELPERS
  ══════════════════════════════════════════════════════════════ */

  /* Safe HTML escape */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* Format ISO date → "Oct 2026" */
  function fmtDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    } catch (_) { return ''; }
  }

  /* Extract YouTube video ID from any standard YouTube URL */
  function extractYtId(url) {
    if (!url) return null;
    var pats = [
      /youtu\.be\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    ];
    for (var i = 0; i < pats.length; i++) {
      var m = url.match(pats[i]);
      if (m) return m[1];
    }
    return null;
  }

  /* ══════════════════════════════════════════════════════════════
     DATA NORMALISATION
     Produces a consistent shape regardless of what optional
     fields the backend happens to fill in.
  ══════════════════════════════════════════════════════════════ */

  function normalizePhoto(raw) {
    /* event may be an ObjectId string, null, or a populated
       object { _id, title } from the backend's populate() call */
    var eventTitle = '';
    if (raw.event && typeof raw.event === 'object' && raw.event.title) {
      eventTitle = raw.event.title;
    }
    return {
      _id:        raw._id        || '',
      title:      (raw.title     || '').trim(),
      imageUrl:   (raw.imageUrl  || '').trim(),
      caption:    (raw.caption   || '').trim(),   /* caption = album name */
      order:      raw.order      || 0,
      date:       fmtDate(raw.publishedAt || raw.createdAt),
      eventTitle: eventTitle,
    };
  }

  function normalizeVideo(raw) {
    return {
      _id:      raw._id       || '',
      title:    (raw.title    || '').trim(),
      videoUrl: (raw.videoUrl || '').trim(),
      caption:  (raw.caption  || '').trim(),
      order:    raw.order     || 0,
      date:     fmtDate(raw.publishedAt || raw.createdAt),
    };
  }

  /* ══════════════════════════════════════════════════════════════
     HERO STATS
     Calculated from real data only.  No hardcoded numbers.
  ══════════════════════════════════════════════════════════════ */
  function updateHeroStats() {
    var albums = new Set(allPhotos.map(function(p){ return p.caption; }).filter(Boolean));

    var elPhotos = document.getElementById('galStatPhotos');
    var elAlbums = document.getElementById('galStatAlbums');
    var elVideos = document.getElementById('galStatVideos');

    if (elPhotos) elPhotos.textContent = String(allPhotos.length);
    if (elAlbums) elAlbums.textContent = String(albums.size || (allPhotos.length ? 1 : 0));
    if (elVideos) elVideos.textContent = String(allVideos.length);
  }

  /* ══════════════════════════════════════════════════════════════
     FILTER BAR
     "All" + one button per distinct caption value.
     If there are no captions at all, just shows "All".
     Also adds "Videos" tab when videos exist.
  ══════════════════════════════════════════════════════════════ */
  function buildFilters() {
    var container = document.getElementById('galFiltersInner');
    var skeleton  = document.getElementById('galFilterSkeleton');
    if (!container) return;

    /* Gather distinct captions sorted by frequency */
    var freq = {};
    allPhotos.forEach(function(p) {
      if (p.caption) freq[p.caption] = (freq[p.caption] || 0) + 1;
    });
    var captions = Object.keys(freq).sort(function(a,b){ return freq[b] - freq[a]; });

    /* Remove skeleton */
    if (skeleton) skeleton.remove();
    container.innerHTML = '';

    function makeBtn(label, filterVal) {
      var b = document.createElement('button');
      b.className = 'gal-filter-btn' + (filterVal === activeFilter ? ' active' : '');
      b.setAttribute('data-filter', filterVal);
      b.setAttribute('aria-pressed', String(filterVal === activeFilter));
      b.textContent = label;
      return b;
    }

    container.appendChild(makeBtn('All', 'all'));

    /* Album buttons */
    captions.forEach(function(cap) {
      container.appendChild(makeBtn(cap, cap));
    });

    /* "Images" shortcut when no captions exist but photos do */
    if (!captions.length && allPhotos.length) {
      container.appendChild(makeBtn('Photos', 'photos'));
    }

    /* "Videos" tab */
    if (allVideos.length) {
      var vidBtn = makeBtn('Videos', 'videos');
      container.appendChild(vidBtn);
    }

    /* Event delegation for clicks */
    container.addEventListener('click', function(e) {
      var btn = e.target.closest('.gal-filter-btn');
      if (!btn) return;
      container.querySelectorAll('.gal-filter-btn').forEach(function(b) {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      activeFilter = btn.getAttribute('data-filter');
      applyFilter();
    });
  }

  /* ══════════════════════════════════════════════════════════════
     FILTER APPLICATION
  ══════════════════════════════════════════════════════════════ */
  function applyFilter() {
    var photoSection = document.getElementById('gal-grid');
    var albumSection = document.getElementById('gal-albums');
    var videoSection = document.getElementById('gal-videos');
    var featSection  = document.getElementById('gal-featured-header');

    if (activeFilter === 'videos') {
      /* Show only video section */
      if (photoSection)  photoSection.style.display  = 'none';
      if (albumSection)  albumSection.style.display  = 'none';
      if (featSection)   featSection.style.display   = 'none';
      if (videoSection)  videoSection.style.display  = '';
      return;
    }

    /* Restore sections */
    if (photoSection) photoSection.style.display  = '';
    if (albumSection) albumSection.style.display  = '';
    if (featSection)  featSection.style.display   = '';
    if (videoSection) videoSection.style.display  = allVideos.length ? '' : 'none';

    /* Filter photo grid items */
    var grid = document.getElementById('galPhotoGrid');
    if (!grid) return;
    var items   = grid.querySelectorAll('.gal-photo-item');
    var visible = 0;

    items.forEach(function(item) {
      var cap  = item.getAttribute('data-caption') || '';
      var show = activeFilter === 'all' || activeFilter === 'photos' || cap === activeFilter;
      item.style.display = show ? '' : 'none';
      if (show) visible++;
    });

    /* Update empty state visibility */
    var emptyEl = document.getElementById('galGridEmpty');
    if (emptyEl) emptyEl.style.display = visible ? 'none' : '';
  }

  /* ══════════════════════════════════════════════════════════════
     ALBUM CARDS
     Groups photos by caption, shows cover image (first photo),
     photo count, and the caption as the album title.
  ══════════════════════════════════════════════════════════════ */
  function renderAlbums() {
    var grid    = document.getElementById('galAlbumsGrid');
    var section = document.getElementById('gal-albums');
    if (!grid) return;

    /* Remove skeletons */
    grid.innerHTML = '';

    /* Build album map: caption → [photos] */
    var albumMap = {};
    var uncaptioned = [];

    allPhotos.forEach(function(p) {
      if (p.caption) {
        if (!albumMap[p.caption]) albumMap[p.caption] = [];
        albumMap[p.caption].push(p);
      } else {
        uncaptioned.push(p);
      }
    });

    /* If everything is uncaptioned, hide the albums section */
    var albumKeys = Object.keys(albumMap);
    if (!albumKeys.length) {
      if (section) section.style.display = 'none';
      return;
    }

    if (section) section.style.display = '';

    /* Sort album keys by photo count descending */
    albumKeys.sort(function(a,b){ return albumMap[b].length - albumMap[a].length; });

    albumKeys.forEach(function(caption, i) {
      var photos = albumMap[caption];
      var cover  = photos[0]; /* first photo = cover */
      var card   = buildAlbumCard(caption, photos.length, cover, i);
      grid.appendChild(card);
    });

    /* Scroll-reveal album cards */
    initReveal(grid.querySelectorAll('.gal-album-card'));
  }

  function buildAlbumCard(caption, count, coverPhoto, idx) {
    var li = document.createElement('li');
    li.className = 'gal-album-card';
    li.setAttribute('role', 'listitem');
    li.setAttribute('tabindex', '0');
    li.setAttribute('aria-label', 'Album: ' + caption + ', ' + count + ' photo' + (count !== 1 ? 's' : ''));

    /* Cover area */
    var coverDiv = document.createElement('div');
    coverDiv.className = 'gal-album-cover';

    if (coverPhoto && coverPhoto.imageUrl) {
      var img = document.createElement('img');
      img.src     = coverPhoto.imageUrl;
      img.alt     = caption;
      img.loading = 'lazy';
      img.addEventListener('error', function() { img.replaceWith(makeCoverPlaceholder()); });
      coverDiv.appendChild(img);
    } else {
      coverDiv.appendChild(makeCoverPlaceholder());
    }

    /* Count badge */
    var badge = document.createElement('span');
    badge.className = 'gal-album-count-badge';
    badge.textContent = count + ' photo' + (count !== 1 ? 's' : '');
    badge.setAttribute('aria-hidden', 'true');
    coverDiv.appendChild(badge);

    /* Body */
    var body = document.createElement('div');
    body.className = 'gal-album-body';

    var name = document.createElement('h3');
    name.className = 'gal-album-name';
    name.textContent = caption;

    var meta = document.createElement('p');
    meta.className = 'gal-album-meta';
    meta.textContent = count + ' photo' + (count !== 1 ? 's' : '');

    var cta = document.createElement('button');
    cta.className = 'gal-album-cta';
    cta.setAttribute('aria-label', 'View ' + caption + ' album');
    cta.innerHTML =
      'View Album' +
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
        '<polyline points="13,6 19,12 13,18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';

    /* Clicking the card or CTA button applies that album filter */
    function applyAlbumFilter() {
      activeFilter = caption;
      /* Update filter bar */
      var bar = document.getElementById('galFiltersInner');
      if (bar) {
        bar.querySelectorAll('.gal-filter-btn').forEach(function(b) {
          var isThis = b.getAttribute('data-filter') === caption;
          b.classList.toggle('active', isThis);
          b.setAttribute('aria-pressed', String(isThis));
        });
      }
      applyFilter();
      /* Scroll to photo grid */
      var gridSection = document.getElementById('gal-grid');
      if (gridSection) {
        gridSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    li.addEventListener('click', applyAlbumFilter);
    li.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); applyAlbumFilter(); }
    });
    cta.addEventListener('click', function(e) { e.stopPropagation(); applyAlbumFilter(); });

    body.appendChild(name);
    body.appendChild(meta);
    body.appendChild(cta);
    li.appendChild(coverDiv);
    li.appendChild(body);
    return li;
  }

  function makeCoverPlaceholder() {
    var d = document.createElement('div');
    d.className = 'gal-album-cover-placeholder';
    d.innerHTML =
      '<svg width="40" height="40" viewBox="0 0 56 56" fill="none">' +
        '<rect x="6" y="6" width="44" height="44" rx="8" stroke="currentColor" stroke-width="1.4"/>' +
        '<circle cx="19" cy="20" r="4" stroke="currentColor" stroke-width="1.4"/>' +
        '<path d="M6 38l13-11 9 8 6-5 16 14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';
    return d;
  }

  /* ══════════════════════════════════════════════════════════════
     PHOTO GRID
  ══════════════════════════════════════════════════════════════ */
  function renderPhotoGrid() {
    var grid = document.getElementById('galPhotoGrid');
    if (!grid) return;

    if (!allPhotos.length) {
      grid.innerHTML = '';
      grid.className = 'gal-photo-grid';
      renderGridEmpty('No gallery photos have been published yet. Check back soon.');
      return;
    }

    /* Clear skeleton, set up for animation */
    grid.innerHTML = '';
    grid.className = 'gal-photo-grid gal-will-animate';

    allPhotos.forEach(function(photo, idx) {
      grid.appendChild(buildPhotoItem(photo, idx));
    });

    initReveal(grid.querySelectorAll('.gal-photo-item'));
  }

  function buildPhotoItem(photo, idx) {
    var item = document.createElement('div');
    item.className = 'gal-photo-item';
    item.setAttribute('data-idx',     String(idx));
    item.setAttribute('data-caption', photo.caption);
    item.setAttribute('role',         'button');
    item.setAttribute('tabindex',     '0');
    item.setAttribute('aria-label',   'View photo' + (photo.title ? ': ' + photo.title : ''));

    if (photo.imageUrl) {
      var img = document.createElement('img');
      img.src     = photo.imageUrl;
      img.alt     = photo.title || (photo.caption ? photo.caption + ' photo' : 'Gallery photo');
      img.loading = 'lazy';
      img.addEventListener('error', function() { replaceWithFallback(item, photo.title); });

      var overlay = document.createElement('div');
      overlay.className  = 'gal-photo-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      if (photo.title) {
        var t = document.createElement('p');
        t.className   = 'gal-photo-title';
        t.textContent = photo.title;
        overlay.appendChild(t);
      }
      if (photo.caption) {
        var c = document.createElement('p');
        c.className   = 'gal-photo-album-tag';
        c.textContent = photo.caption;
        overlay.appendChild(c);
      }

      var zoom = document.createElement('div');
      zoom.className = 'gal-photo-zoom';
      zoom.setAttribute('aria-hidden', 'true');
      zoom.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none">' +
          '<circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.8"/>' +
          '<line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
          '<line x1="11" y1="8" x2="11" y2="14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
          '<line x1="8" y1="11" x2="14" y2="11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
        '</svg>';

      item.appendChild(img);
      item.appendChild(overlay);
      item.appendChild(zoom);
    } else {
      replaceWithFallback(item, photo.title);
    }

    /* Open lightbox */
    item.addEventListener('click', function() { openLightbox(idx); });
    item.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(idx); }
    });

    return item;
  }

  function replaceWithFallback(item, title) {
    /* Remove everything except event listeners (new div) */
    var fb = document.createElement('div');
    fb.className = 'gal-photo-fallback';
    fb.innerHTML =
      '<svg width="28" height="28" viewBox="0 0 24 24" fill="none">' +
        '<rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.4"/>' +
        '<circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" stroke-width="1.4"/>' +
        '<path d="M21 15l-5-5a1.5 1.5 0 0 0-2 0l-5 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
      '</svg>' +
      (title ? '<span>' + esc(title) + '</span>' : '<span>Image unavailable</span>');

    /* Clear children but keep the item element intact (preserves event listeners) */
    while (item.firstChild) item.removeChild(item.firstChild);
    item.appendChild(fb);
  }

  /* Grid empty / error states */
  function renderGridEmpty(msg) {
    var grid = document.getElementById('galPhotoGrid');
    if (!grid) return;
    var wrap = document.createElement('div');
    wrap.className = 'gal-state';
    wrap.id = 'galGridEmpty';
    wrap.innerHTML =
      '<svg class="gal-state-icon" width="48" height="48" viewBox="0 0 56 56" fill="none" aria-hidden="true">' +
        '<rect x="6" y="6" width="44" height="44" rx="10" stroke="currentColor" stroke-width="1.4"/>' +
        '<circle cx="19" cy="20" r="3" stroke="currentColor" stroke-width="1.3"/>' +
        '<path d="M6 38l13-11 9 8 6-5 16 14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>' +
      '<p class="gal-state-title">No photos yet</p>' +
      '<p class="gal-state-sub">' + esc(msg) + '</p>';
    grid.appendChild(wrap);
  }

  function renderGridError() {
    var grid = document.getElementById('galPhotoGrid');
    if (!grid) return;
    grid.className = 'gal-photo-grid';
    grid.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.className = 'gal-state';
    wrap.innerHTML =
      '<svg class="gal-state-icon" width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.4"/>' +
        '<line x1="12" y1="8" x2="12" y2="12.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
        '<circle cx="12" cy="15.5" r="0.85" fill="currentColor"/>' +
      '</svg>' +
      '<p class="gal-state-title">Unable to load the gallery right now.</p>' +
      '<p class="gal-state-sub">Please check your connection and try again.</p>';
    var retryBtn = document.createElement('button');
    retryBtn.className = 'gal-retry-btn';
    retryBtn.textContent = 'Try Again';
    retryBtn.addEventListener('click', function() { init(true); });
    wrap.appendChild(retryBtn);
    grid.appendChild(wrap);
  }

  /* ══════════════════════════════════════════════════════════════
     VIDEO GRID
  ══════════════════════════════════════════════════════════════ */
  function renderVideos() {
    var grid    = document.getElementById('galVideosGrid');
    var section = document.getElementById('gal-videos');
    if (!grid) return;

    /* Remove skeletons */
    grid.innerHTML = '';

    if (!allVideos.length) {
      /* Show a proper empty state — do NOT hide the section */
      var empty = document.createElement('div');
      empty.className = 'gal-state gal-video-empty';
      empty.innerHTML =
        '<svg class="gal-state-icon" width="48" height="48" viewBox="0 0 56 56" fill="none" aria-hidden="true">' +
          '<rect x="4" y="10" width="48" height="36" rx="7" stroke="currentColor" stroke-width="1.4"/>' +
          '<polygon points="22,20 38,28 22,36" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>' +
        '</svg>' +
        '<p class="gal-state-title">No videos yet</p>' +
        '<p class="gal-state-sub">Video highlights from our events will appear here once uploaded.</p>';
      grid.appendChild(empty);
      return;
    }

    /* Render video cards */
    grid.classList.add('gal-will-animate');
    allVideos.forEach(function(video) {
      grid.appendChild(buildVideoCard(video));
    });
    initReveal(grid.querySelectorAll('.gal-video-card'));
  }

  function buildVideoCard(video) {
    var ytId  = extractYtId(video.videoUrl);
    var card  = document.createElement('article');
    card.className = 'gal-video-card';

    /* Thumbnail area */
    var thumb = document.createElement('div');
    thumb.className = 'gal-video-thumb';

    if (ytId) {
      /* Use YouTube's hqdefault thumbnail */
      var tnImg = document.createElement('img');
      tnImg.src     = 'https://img.youtube.com/vi/' + ytId + '/hqdefault.jpg';
      tnImg.alt     = video.title ? video.title + ' thumbnail' : 'Video thumbnail';
      tnImg.loading = 'lazy';
      tnImg.addEventListener('error', function() { tnImg.style.display = 'none'; });

      var playOverlay = document.createElement('div');
      playOverlay.className = 'gal-video-play';
      playOverlay.setAttribute('aria-hidden', 'true');

      var playBtn = document.createElement('div');
      playBtn.className = 'gal-video-play-btn';
      playBtn.innerHTML =
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="margin-left:2px">' +
          '<polygon points="5,3 19,12 5,21"/>' +
        '</svg>';

      playOverlay.appendChild(playBtn);
      thumb.appendChild(tnImg);
      thumb.appendChild(playOverlay);

      /* Clicking the thumb swaps to an embedded iframe (privacy-enhanced) */
      var _ytId  = ytId;
      var _title = video.title || 'Video';
      thumb.setAttribute('role', 'button');
      thumb.setAttribute('tabindex', '0');
      thumb.setAttribute('aria-label', 'Play ' + _title);

      function playVideo() {
        var iframe = document.createElement('iframe');
        iframe.src             = 'https://www.youtube-nocookie.com/embed/' + _ytId + '?autoplay=1';
        iframe.allow           = 'autoplay; encrypted-media; picture-in-picture';
        iframe.allowFullscreen = true;
        iframe.style.cssText   = 'width:100%;height:100%;border:0;display:block;';
        iframe.title           = _title;
        while (thumb.firstChild) thumb.removeChild(thumb.firstChild);
        thumb.appendChild(iframe);
      }
      thumb.addEventListener('click', playVideo);
      thumb.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); playVideo(); }
      });

    } else {
      /* No recognisable YouTube URL — show placeholder */
      var ph = document.createElement('div');
      ph.className = 'gal-video-placeholder';
      ph.setAttribute('aria-hidden', 'true');
      ph.innerHTML =
        '<svg width="36" height="36" viewBox="0 0 24 24" fill="none">' +
          '<rect x="2" y="5" width="20" height="14" rx="4" stroke="currentColor" stroke-width="1.4"/>' +
          '<polygon points="10,9 16,12 10,15" fill="currentColor"/>' +
        '</svg>';
      thumb.appendChild(ph);
    }

    /* Info area */
    var info = document.createElement('div');
    info.className = 'gal-video-info';

    var titleEl = document.createElement('p');
    titleEl.className   = 'gal-video-title';
    titleEl.textContent = video.title || 'Untitled Video';
    info.appendChild(titleEl);

    if (video.caption || video.date) {
      var meta = document.createElement('p');
      meta.className   = 'gal-video-meta';
      meta.textContent = [video.caption, video.date].filter(Boolean).join(' · ');
      info.appendChild(meta);
    }

    card.appendChild(thumb);
    card.appendChild(info);
    return card;
  }

  /* ══════════════════════════════════════════════════════════════
     LIGHTBOX
  ══════════════════════════════════════════════════════════════ */
  var lbCurrentIdx = 0;
  var lbItems      = [];   /* photos visible under current filter */

  function openLightbox(globalIdx) {
    var lb = document.getElementById('gal-lightbox');
    if (!lb) return;

    /* Build nav list from currently-visible photo items */
    var grid = document.getElementById('galPhotoGrid');
    lbItems = [];
    if (grid) {
      grid.querySelectorAll('.gal-photo-item:not([style*="display: none"])').forEach(function(el) {
        var i = parseInt(el.getAttribute('data-idx'), 10);
        if (!isNaN(i) && allPhotos[i]) lbItems.push({ photo: allPhotos[i], domIdx: i });
      });
    }

    /* Find position within lbItems */
    lbCurrentIdx = 0;
    for (var i = 0; i < lbItems.length; i++) {
      if (lbItems[i].domIdx === globalIdx) { lbCurrentIdx = i; break; }
    }

    lb.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    lb.style.display = 'flex';
    requestAnimationFrame(function() { lb.classList.add('lb-open'); });
    showLightboxImage();
  }

  function closeLightbox() {
    var lb = document.getElementById('gal-lightbox');
    if (!lb) return;
    lb.classList.remove('lb-open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    setTimeout(function() {
      if (!lb.classList.contains('lb-open')) lb.style.display = 'none';
    }, 260);
  }

  function lbNavigate(dir) {
    if (!lbItems.length) return;
    lbCurrentIdx = (lbCurrentIdx + dir + lbItems.length) % lbItems.length;
    showLightboxImage();
  }

  function showLightboxImage() {
    var entry   = lbItems[lbCurrentIdx];
    var wrap    = document.getElementById('lbImgWrap');
    var capEl   = document.getElementById('lbCaption');
    var counter = document.getElementById('lbCounter');
    var prevBtn = document.getElementById('lbPrev');
    var nextBtn = document.getElementById('lbNext');
    if (!wrap || !entry) return;

    var photo = entry.photo;

    /* Clear inner content but keep nav buttons */
    var oldImg = wrap.querySelector('img, .lb-error');
    if (oldImg) oldImg.remove();

    if (photo.imageUrl) {
      var img = document.createElement('img');
      img.alt = photo.title || '';
      img.addEventListener('error', function() { img.replaceWith(buildLbError()); });
      /* Insert before Next button */
      if (nextBtn) wrap.insertBefore(img, nextBtn);
      else wrap.appendChild(img);
      /* Set src after inserting to avoid race in some browsers */
      img.src = photo.imageUrl;
    } else {
      var errEl = buildLbError();
      if (nextBtn) wrap.insertBefore(errEl, nextBtn);
      else wrap.appendChild(errEl);
    }

    /* Caption: title · album · date */
    if (capEl) {
      capEl.textContent = [photo.title, photo.caption, photo.date]
        .filter(Boolean).join('  ·  ');
    }
    if (counter) counter.textContent = (lbCurrentIdx + 1) + ' / ' + lbItems.length;

    /* Hide arrows when only one image */
    var showNav = lbItems.length > 1;
    if (prevBtn) prevBtn.style.display = showNav ? '' : 'none';
    if (nextBtn) nextBtn.style.display = showNav ? '' : 'none';
  }

  function buildLbError() {
    var d = document.createElement('div');
    d.className = 'lb-error';
    d.innerHTML =
      '<svg width="32" height="32" viewBox="0 0 24 24" fill="none">' +
        '<rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.4"/>' +
        '<line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
        '<line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
      '</svg>' +
      '<span>Image unavailable</span>';
    return d;
  }

  /* Wire lightbox controls (called once on init) */
  function initLightbox() {
    var lb      = document.getElementById('gal-lightbox');
    var close   = document.getElementById('lbClose');
    var prevBtn = document.getElementById('lbPrev');
    var nextBtn = document.getElementById('lbNext');
    if (!lb) return;

    if (close)   close.addEventListener('click', closeLightbox);
    if (prevBtn) prevBtn.addEventListener('click', function() { lbNavigate(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function() { lbNavigate(+1); });

    /* Backdrop click */
    lb.addEventListener('click', function(e) { if (e.target === lb) closeLightbox(); });

    /* Keyboard */
    document.addEventListener('keydown', function(e) {
      if (lb.style.display !== 'flex') return;
      if (e.key === 'Escape')     { closeLightbox(); }
      if (e.key === 'ArrowLeft')  { lbNavigate(-1); }
      if (e.key === 'ArrowRight') { lbNavigate(+1); }
    });

    /* Touch swipe */
    var startX = null;
    lb.addEventListener('touchstart', function(e) { startX = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function(e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) lbNavigate(dx < 0 ? 1 : -1);
      startX = null;
    }, { passive: true });
  }

  /* ══════════════════════════════════════════════════════════════
     SCROLL REVEAL  (IntersectionObserver)
     Used for both individual cards and section headers.
  ══════════════════════════════════════════════════════════════ */
  function initReveal(nodeList) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      nodeList.forEach(function(el) { el.classList.add('gal-reveal-in', 'gal-revealed'); });
      return;
    }
    if (!window.IntersectionObserver) {
      nodeList.forEach(function(el) { el.classList.add('gal-reveal-in', 'gal-revealed'); });
      return;
    }
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry, i) {
        if (!entry.isIntersecting) return;
        var delay = (i % 4) * 75;   /* stagger up to 4 per row */
        setTimeout(function() {
          entry.target.classList.add('gal-reveal-in', 'gal-revealed');
        }, delay);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -30px 0px' });

    nodeList.forEach(function(el) { observer.observe(el); });
  }

  /* Section header reveal (applied to .gal-reveal-target elements) */
  function initSectionReveal() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.gal-reveal-target').forEach(function(el) {
        el.classList.add('gal-revealed');
      });
      return;
    }
    if (!window.IntersectionObserver) {
      document.querySelectorAll('.gal-reveal-target').forEach(function(el) {
        el.classList.add('gal-revealed');
      });
      return;
    }
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('gal-revealed');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('.gal-reveal-target').forEach(function(el) {
      observer.observe(el);
    });
  }

  /* ── Back-to-top button ─────────────────────────────────────── */
  (function() {
    var btn = document.getElementById('backToTop');
    if (!btn) return;
    window.addEventListener('scroll', function() {
      btn.classList.toggle('visible', window.scrollY > 450);
    }, { passive: true });
    btn.addEventListener('click', function() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  })();

  /* ══════════════════════════════════════════════════════════════
     RETRY SKELETON  (reset grid to loading state before retry)
  ══════════════════════════════════════════════════════════════ */
  function showSkeleton() {
    var grid = document.getElementById('galPhotoGrid');
    if (grid) {
      grid.className = 'gal-photo-grid gal-skeleton-grid';
      grid.innerHTML =
        '<div class="gal-skeleton-item" style="height:220px"></div>' +
        '<div class="gal-skeleton-item" style="height:290px"></div>' +
        '<div class="gal-skeleton-item" style="height:200px"></div>' +
        '<div class="gal-skeleton-item" style="height:260px"></div>' +
        '<div class="gal-skeleton-item" style="height:240px"></div>' +
        '<div class="gal-skeleton-item" style="height:210px"></div>';
    }
    var albumGrid = document.getElementById('galAlbumsGrid');
    if (albumGrid) {
      albumGrid.innerHTML =
        '<div class="gal-album-skeleton" aria-hidden="true"></div>' +
        '<div class="gal-album-skeleton" aria-hidden="true"></div>' +
        '<div class="gal-album-skeleton" aria-hidden="true"></div>';
    }
    var vidGrid = document.getElementById('galVideosGrid');
    if (vidGrid) {
      vidGrid.innerHTML =
        '<div class="gal-video-skeleton" aria-hidden="true"></div>' +
        '<div class="gal-video-skeleton" aria-hidden="true"></div>' +
        '<div class="gal-video-skeleton" aria-hidden="true"></div>';
    }
  }

  /* ══════════════════════════════════════════════════════════════
     INIT — fires three parallel fetches, then renders in one pass
  ══════════════════════════════════════════════════════════════ */
  async function init(isRetry) {
    if (isRetry) showSkeleton();

    /* Wire lightbox once — idempotent because it only runs on first call
       or after the DOM has been reconstructed (which it hasn't). */
    initLightbox();
    initSectionReveal();

    try {
      var results = await Promise.allSettled([
        fetch(API + '/site-settings/public').then(function(r) { return r.json(); }),
        fetch(API + '/gallery?type=gallery').then(function(r)  { return r.json(); }),
        fetch(API + '/gallery?type=video').then(function(r)    { return r.json(); }),
      ]);

      /* ── Site settings ── */
      if (results[0].status === 'fulfilled') {
        var settings = (results[0].value && results[0].value.data) || {};
        var hEl = document.getElementById('galleryFeaturedHeading');
        var dEl = document.getElementById('galleryFeaturedDesc');
        if (hEl && settings.galleryFeaturedHeading) {
          hEl.textContent = settings.galleryFeaturedHeading;
        }
        if (dEl && settings.galleryFeaturedDesc) {
          dEl.textContent = settings.galleryFeaturedDesc;
        }
      }

      /* ── Photos ── */
      if (results[1].status === 'fulfilled') {
        var pData   = results[1].value;
        var rawPics = Array.isArray(pData && pData.data)
          ? pData.data : (Array.isArray(pData) ? pData : []);
        allPhotos = rawPics
          .filter(function(p) { return p && p.published !== false; })
          .sort(function(a,b)  { return (a.order || 0) - (b.order || 0); })
          .map(normalizePhoto);
      }

      /* ── Videos ── */
      if (results[2].status === 'fulfilled') {
        var vData   = results[2].value;
        var rawVids = Array.isArray(vData && vData.data)
          ? vData.data : (Array.isArray(vData) ? vData : []);
        allVideos = rawVids
          .filter(function(v) { return v && v.published !== false; })
          .sort(function(a,b)  { return (a.order || 0) - (b.order || 0); })
          .map(normalizeVideo);
      }

      /* ── Render ── */
      updateHeroStats();
      buildFilters();
      renderAlbums();
      renderPhotoGrid();
      renderVideos();

    } catch (err) {
      console.error('gallery-public: init failed —', err);
      renderGridError();
    }
  }

  /* Start */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { init(false); });
  } else {
    init(false);
  }

})();
