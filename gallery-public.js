(function () {
  'use strict';

  var API_BASE = window.EMBS_API_BASE;

  /* ── YouTube ID extraction (safe — no innerHTML from user input) ── */
  function extractYouTubeId(url) {
    if (!url) return null;
    var patterns = [
      /youtu\.be\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = url.match(patterns[i]);
      if (m) return m[1];
    }
    return null;
  }

  var EMPTY_SVG_PHOTO = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none">'
    + '<rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.5"/>'
    + '<circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" stroke-width="1.5"/>'
    + '<path d="M21 15l-5-5a1.5 1.5 0 0 0-2 0l-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
    + '</svg>';

  var EMPTY_SVG_VIDEO = '<svg width="36" height="36" viewBox="0 0 24 24" fill="none">'
    + '<rect x="2" y="5" width="20" height="14" rx="4" stroke="currentColor" stroke-width="1.5"/>'
    + '<polygon points="10,9 16,12 10,15" fill="currentColor"/>'
    + '</svg>';

  var PLAY_BTN = '<div class="gallery-play-btn" aria-label="Play video">'
    + '<svg width="20" height="20" viewBox="0 0 24 24" fill="none">'
    + '<circle cx="12" cy="12" r="10" stroke="#ffffff" stroke-width="1.5"/>'
    + '<polygon points="10,8 17,12 10,16" fill="#ffffff"/>'
    + '</svg></div>';

  var EMPTY_P = 'color:rgba(107,45,139,0.45);font-size:0.88rem;'
    + 'text-align:center;padding:2.5rem 0;width:100%;grid-column:1/-1;';

  /* ════════════════════════════════════════════════════════
     0. FEATURED COLLECTION TEXT  (heading + description from CMS)
     ════════════════════════════════════════════════════════ */
  async function loadFeaturedText() {
    try {
      var res  = await fetch(API_BASE + '/site-settings/public');
      var json = await res.json();
      var data = json && json.data ? json.data : {};

      var headingEl = document.getElementById('galleryFeaturedHeading');
      var descEl    = document.getElementById('galleryFeaturedDesc');

      if (headingEl && data.galleryFeaturedHeading) {
        headingEl.textContent = data.galleryFeaturedHeading;
      }
      if (descEl && data.galleryFeaturedDesc) {
        descEl.textContent = data.galleryFeaturedDesc;
      }
    } catch (err) {
      /* Silently leave the fallback text already in the HTML */
      console.warn('gallery-public: failed to load featured text —', err.message);
    }
  }

  /* ════════════════════════════════════════════════════════
     1. FEATURED PREVIEW CARD  (existing behaviour preserved)
     ════════════════════════════════════════════════════════ */
  async function loadFeaturedPreview() {
    var featImg         = document.querySelector('.gallery-preview-img');
    var featPlaceholder = document.querySelector('.gallery-placeholder-view');
    if (!featImg) return;

    try {
      var res  = await fetch(API_BASE + '/gallery?type=gallery');
      var json = await res.json();
      var items = Array.isArray(json && json.data) ? json.data
                : Array.isArray(json) ? json : [];
      items = items.filter(function (i) { return i && i.published !== false; });

      if (items.length && items[0].imageUrl) {
        featImg.src            = items[0].imageUrl;
        featImg.style.display  = 'block';
        if (featPlaceholder) featPlaceholder.style.display = 'none';
      }
    } catch (err) {
      console.warn('gallery-public: featured preview failed —', err.message);
    }
  }

  /* ════════════════════════════════════════════════════════
     2. EVENT GALLERY GRID
     ════════════════════════════════════════════════════════ */
  async function loadEventGallery() {
    var grid = document.getElementById('eventGalleryGrid');
    if (!grid) return;

    try {
      var res  = await fetch(API_BASE + '/gallery?type=gallery');
      var json = await res.json();
      var items = Array.isArray(json && json.data) ? json.data
                : Array.isArray(json) ? json : [];
      items = items
        .filter(function (i) { return i && i.published !== false; })
        .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });

      if (!items.length) {
        grid.innerHTML = '<p style="' + EMPTY_P + '">No event gallery items added yet.</p>';
        return;
      }

      grid.innerHTML = '';
      items.forEach(function (item) {
        var article = document.createElement('article');
        article.className = 'gallery-grid-card';

        var imgWrap = document.createElement('div');
        imgWrap.className = 'gallery-grid-img-wrap';

        if (item.imageUrl) {
          var img = document.createElement('img');
          img.src          = item.imageUrl;
          img.alt          = item.title || '';
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
          img.loading      = 'lazy';
          imgWrap.appendChild(img);
        } else {
          var ph = document.createElement('div');
          ph.className  = 'gallery-grid-placeholder';
          ph.innerHTML  = EMPTY_SVG_PHOTO;
          imgWrap.appendChild(ph);
        }

        var titleP = document.createElement('p');
        titleP.className   = 'gallery-grid-title';
        titleP.textContent = item.title || '';

        article.appendChild(imgWrap);
        article.appendChild(titleP);
        grid.appendChild(article);
      });

    } catch (err) {
      console.warn('gallery-public: event gallery failed —', err.message);
      var g2 = document.getElementById('eventGalleryGrid');
      if (g2) g2.innerHTML = '<p style="' + EMPTY_P + '">No event gallery items added yet.</p>';
    }
  }

  /* ════════════════════════════════════════════════════════
     3. HIGHLIGHTED VIDEOS GRID
     ════════════════════════════════════════════════════════ */
  async function loadHighlightedVideos() {
    var grid = document.getElementById('highlightedVideosGrid');
    if (!grid) return;

    try {
      var res  = await fetch(API_BASE + '/gallery?type=video');
      var json = await res.json();
      var items = Array.isArray(json && json.data) ? json.data
                : Array.isArray(json) ? json : [];
      items = items
        .filter(function (i) { return i && i.published !== false; })
        .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });

      if (!items.length) {
        grid.innerHTML = '<p style="' + EMPTY_P + '">No highlighted videos added yet.</p>';
        return;
      }

      grid.innerHTML = '';
      items.forEach(function (item) {
        var ytId = extractYouTubeId(item.videoUrl || '');

        var article = document.createElement('article');
        article.className = 'gallery-video-card';

        var thumb = document.createElement('div');
        thumb.className = 'gallery-video-thumb';

        if (ytId) {
          /* Render as a YouTube thumbnail that opens the embed on click.
             We use a thumbnail image + play button that replaces itself with
             an <iframe> on click — safe, no innerHTML from user data.        */
          var tnImg = document.createElement('img');
          tnImg.src          = 'https://img.youtube.com/vi/' + ytId + '/hqdefault.jpg';
          tnImg.alt          = item.title || 'Video thumbnail';
          tnImg.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
          tnImg.loading      = 'lazy';

          var playBtn = document.createElement('div');
          playBtn.className   = 'gallery-play-btn';
          playBtn.setAttribute('aria-label', 'Play video');
          playBtn.innerHTML   = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none">'
            + '<circle cx="12" cy="12" r="10" stroke="#ffffff" stroke-width="1.5"/>'
            + '<polygon points="10,8 17,12 10,16" fill="#ffffff"/></svg>';

          /* On click: swap thumbnail for YouTube iframe */
          var _ytId = ytId; /* closure capture */
          thumb.addEventListener('click', function () {
            var iframe = document.createElement('iframe');
            iframe.src             = 'https://www.youtube-nocookie.com/embed/' + _ytId + '?autoplay=1';
            iframe.allow           = 'autoplay; encrypted-media; picture-in-picture';
            iframe.allowFullscreen = true;
            iframe.style.cssText   = 'width:100%;height:100%;border:0;display:block;';
            iframe.title           = item.title || 'Video';
            /* Remove thumbnail children, insert iframe */
            while (thumb.firstChild) thumb.removeChild(thumb.firstChild);
            thumb.appendChild(iframe);
          });

          thumb.appendChild(tnImg);
          thumb.appendChild(playBtn);
        } else {
          /* Invalid / unsupported URL — show placeholder */
          var ph2 = document.createElement('div');
          ph2.className = 'gallery-video-placeholder';
          ph2.innerHTML = EMPTY_SVG_VIDEO;
          thumb.appendChild(ph2);
          thumb.innerHTML += PLAY_BTN;
        }

        var titleP = document.createElement('p');
        titleP.className   = 'gallery-video-title';
        titleP.textContent = item.title || '';

        article.appendChild(thumb);
        article.appendChild(titleP);
        grid.appendChild(article);
      });

    } catch (err) {
      console.warn('gallery-public: highlighted videos failed —', err.message);
      var g3 = document.getElementById('highlightedVideosGrid');
      if (g3) g3.innerHTML = '<p style="' + EMPTY_P + '">No highlighted videos added yet.</p>';
    }
  }

  /* ════════════════════════════════════════════════════════
     INIT
     ════════════════════════════════════════════════════════ */
  async function init() {
    await Promise.all([
      loadFeaturedText(),
      loadFeaturedPreview(),
      loadEventGallery(),
      loadHighlightedVideos(),
    ]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
