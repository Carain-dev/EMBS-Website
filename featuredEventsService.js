(function () {
  'use strict';

  const API_BASE = window.EMBS_API_BASE;

  /* ── Helpers ─────────────────────────────────── */

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return isNaN(d) ? dateStr : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function statusTag(status) {
    if (status === 'upcoming') return '<span class="act-tag act-tag--upcoming">Upcoming</span>';
    if (status === 'completed') return '<span class="act-tag act-tag--completed">Completed</span>';
    return `<span class="act-tag act-tag--hackathon">${status || ''}</span>`;
  }

  function actionBtn(event) {
    if (event.status === 'completed') {
      return `<a href="events.html" class="act-btn act-btn--ghost">View</a>`;
    }
    if (event.registrationLink) {
      return `<a href="${event.registrationLink}" target="_blank" rel="noopener" class="act-btn act-btn--primary">Register</a>`;
    }
    return `<a href="events.html" class="act-btn act-btn--primary">Details</a>`;
  }

  const GRADIENTS = [
    'linear-gradient(135deg, #3a0d5e, #00A99D)',
    'linear-gradient(135deg, #1a0a3a, #6B2D8B)',
    'linear-gradient(135deg, #003d3a, #0d1530)',
  ];

  const ICON_SVG = `<svg class="act-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="14" width="32" height="26" rx="3" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>
    <line x1="8" y1="22" x2="40" y2="22" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
    <line x1="16" y1="8" x2="16" y2="18" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="32" y1="8" x2="32" y2="18" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" stroke-linecap="round"/>
    <rect x="14" y="28" width="6" height="6" rx="1" fill="rgba(255,255,255,0.25)"/>
    <rect x="22" y="28" width="6" height="6" rx="1" fill="rgba(255,255,255,0.25)"/>
  </svg>`;

  const LOC_SVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="rgba(0,169,157,0.8)" stroke-width="1.8"/><circle cx="12" cy="9" r="2.5" stroke="rgba(0,169,157,0.8)" stroke-width="1.5"/></svg>`;

  function buildEventCard(event, idx) {
    return `
      <div class="act-card">
        <div class="act-card-top" style="background: ${GRADIENTS[idx % 3]}">
          ${statusTag(event.status)}
          ${ICON_SVG}
        </div>
        <div class="act-card-body">
          <div class="act-meta">
            <span class="act-type">${event.type || 'Event'}</span>
            <span class="act-date">${formatDate(event.date)}</span>
          </div>
          <h3 class="act-title">${event.title}</h3>
          <p class="act-desc">${event.description || ''}</p>
          <div class="act-footer">
            <span class="act-location">${LOC_SVG} ${event.venue || event.mode || ''}</span>
            ${actionBtn(event)}
          </div>
        </div>
      </div>`;
  }

  /* ── Featured Events ─────────────────────────── */

  async function loadFeaturedEvents() {
    const grid = document.querySelector('.activities-grid');
    if (!grid) return;

    try {
      const res = await fetch(`${API_BASE}/events`);
      const json = await res.json();
      const all = json.data || json;

      if (!Array.isArray(all) || !all.length) return;

      const now = new Date().toISOString().split('T')[0];
      const featured = all.filter(e => e.featured);
      const upcoming = featured.filter(e => (e.date || '') >= now).sort((a, b) => a.date > b.date ? 1 : -1);
      const past     = featured.filter(e => (e.date || '') <  now).sort((a, b) => a.date < b.date ? 1 : -1);
      const events   = [...upcoming, ...past].slice(0, 3);

      if (!events.length) return; // keep hardcoded fallback

      grid.innerHTML = events.map((e, i) => buildEventCard(e, i)).join('');
    } catch {
      // keep hardcoded fallback on error
    }
  }

  /* ── Homepage Podcast Section ────────────────── */

  const PLAY_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>`;

  function buildEpCard(ep) {
    const num = String(ep.episodeNumber).padStart(2, '0');
    const pct = Math.min(100, Math.max(5, ((ep.episodeNumber * 17) % 80) + 20));
    return `
      <div class="ep-card">
        <div class="ep-num">EP ${num}</div>
        <div class="ep-info">
          <h4 class="ep-title">${ep.title}</h4>
          <span class="ep-speaker">${ep.guestName || ''}${ep.guestDesignation ? ' &mdash; ' + ep.guestDesignation : ''}</span>
        </div>
        <div class="ep-controls">
          <a href="${ep.audioUrl || ep.spotifyUrl || 'podcast.html'}" ${ep.audioUrl || ep.spotifyUrl ? 'target="_blank" rel="noopener"' : ''} class="ep-play" aria-label="Play">
            ${PLAY_SVG}
          </a>
          <div class="ep-progress"><div class="ep-progress-fill" style="width:${pct}%"></div></div>
          <span class="ep-duration">${ep.duration || ''}</span>
        </div>
      </div>`;
  }

  async function loadHomepagePodcast() {
    const epContainer = document.querySelector('.podcast-episodes');
    const coverImg    = document.querySelector('.podcast-cover-img');
    const spotifyBtn  = document.querySelector('.podcast-spotify-btn');
    if (!epContainer) return;

    try {
      const res = await fetch(`${API_BASE}/podcasts`);
      const json = await res.json();
      const episodes = (json.data || json).sort((a, b) => b.episodeNumber - a.episodeNumber).slice(0, 3);

      if (!episodes.length) return;

      epContainer.innerHTML = episodes.map(buildEpCard).join('');

      // Update cover image with latest episode thumbnail
      if (coverImg && episodes[0].thumbnail) {
        coverImg.src = episodes[0].thumbnail;
        coverImg.style.display = 'block';
        const placeholder = coverImg.nextElementSibling;
        if (placeholder && placeholder.classList.contains('podcast-cover-placeholder')) {
          placeholder.style.display = 'none';
        }
      }

      // Update Spotify button link
      if (spotifyBtn && episodes[0].spotifyUrl) {
        spotifyBtn.href = episodes[0].spotifyUrl;
      }
    } catch {
      // keep hardcoded fallback
    }
  }

  /* ── Homepage Achievements Section ──────────── */

  const ACH_CATEGORY_MAP = {
    'student-awards':   { label: 'Award',       cls: 'ach-tag--award' },
    'publications':     { label: 'Publication', cls: 'ach-tag--publication' },
    'competition-wins': { label: 'Competition', cls: 'ach-tag--competition' },
    'certifications':   { label: 'Certification', cls: 'ach-tag--award' },
    'faculty':          { label: 'Faculty',     cls: 'ach-tag--publication' },
  };

  const STAR_SVG = `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6l3.09 9.26H32l-7.27 5.27 2.77 8.53L20 24l-7.5 5.06 2.77-8.53L8 15.26h8.91z" stroke="#6B2D8B" stroke-width="1.8" stroke-linejoin="round"/></svg>`;

  function buildAchCard(item) {
    const catKey = (item.category || '').toLowerCase().replace(/\s+/g, '-');
    const cat = ACH_CATEGORY_MAP[catKey] || { label: 'Achievement', cls: 'ach-tag--award' };
    return `
      <div class="ach-card">
        <div class="ach-card-top">
          <div class="ach-icon">${STAR_SVG}</div>
          <span class="ach-tag ${cat.cls}">${cat.label}</span>
        </div>
        <h3 class="ach-title">${item.title}</h3>
        <p class="ach-meta">${item.description || ''}</p>
      </div>`;
  }

  async function loadHomepageAchievements() {
    const grid = document.querySelector('.achievements-grid');
    if (!grid) return;

    try {
      const res = await fetch(`${API_BASE}/achievements`);
      const json = await res.json();
      const all = json.data || json;

      if (!Array.isArray(all) || !all.length) return;

      const featured = all.filter(a => a.featured).slice(0, 3);
      const items = featured.length ? featured : all.slice(0, 3);

      if (!items.length) return;

      grid.innerHTML = items.map(buildAchCard).join('');
    } catch {
      // keep hardcoded fallback
    }
  }

  /* ── Fix footer "View All" links ─────────────── */

  function fixViewAllLinks() {
    const eventsViewAll = document.querySelector('.activities-viewall');
    if (eventsViewAll) eventsViewAll.href = 'events.html';

    const achViewAll = document.querySelector('.achievements-viewall');
    if (achViewAll) achViewAll.href = 'achievements.html';
  }

  /* ── Init ────────────────────────────────────── */

  function init() {
    loadFeaturedEvents();
    loadHomepagePodcast();
    loadHomepageAchievements();
    fixViewAllLinks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
