(function () {
  'use strict';

  const API_BASE = window.EMBS_API_BASE;

  /* ── SVG constants ── */
  const SPOTIFY_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.623.623 0 0 1-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.623.623 0 1 1-.277-1.215c3.809-.87 7.076-.496 9.712 1.115a.623.623 0 0 1 .207.857zm1.223-2.722a.78.78 0 0 1-1.072.257c-2.687-1.652-6.785-2.131-9.965-1.166a.78.78 0 0 1-.973-.519.781.781 0 0 1 .52-.973c3.632-1.102 8.147-.568 11.233 1.329a.78.78 0 0 1 .257 1.072zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71a.937.937 0 1 1-.543-1.793c3.532-1.072 9.404-.865 13.115 1.338a.937.937 0 0 1-.955 1.612z"/></svg>`;
  const PLAY_SVG    = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5,3 19,12 5,21"/></svg>`;
  const CLOCK_SVG   = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
  const USER_SVG    = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.582-7 8-7s8 3 8 7"/></svg>`;

  const WAVE_BARS = Array.from({length: 15}, (_, i) => {
    const heights = [40,65,50,80,60,90,70,100,75,55,85,45,65,35,55];
    return `<span style="--h:${heights[i]}%"></span>`;
  }).join('');

  const FALLBACK_IMG = 'bg-image-embs/bluebg.jpeg';

  /* Global Spotify channel URL (SiteSettings.socialLinks.spotify) */
  let globalSpotifyUrl = '';

  /* ══════════════════════════════════════════════════════════
     SPOTIFY EMBED UTILITIES

     Official Spotify embed URL format:
       https://open.spotify.com/embed/episode/<EPISODE_ID>?utm_source=generator

     We extract the episode ID from any standard Spotify episode URL:
       https://open.spotify.com/episode/<ID>
       https://open.spotify.com/episode/<ID>?si=...
       https://open.spotify.com/intl-XX/episode/<ID>
  ══════════════════════════════════════════════════════════ */

  /**
   * Extract the Spotify episode ID from a Spotify episode URL.
   * Returns the ID string, or null if the URL is not a valid episode URL.
   */
  function spotifyEpisodeId(url) {
    if (!url || typeof url !== 'string') return null;
    // Match /episode/<ID> anywhere in the path (handles intl- prefixes too)
    const m = url.match(/\/episode\/([A-Za-z0-9]+)/);
    return m ? m[1] : null;
  }

  /**
   * Build the Spotify embed URL from an episode URL.
   * Returns a string, or null if the URL is not a valid episode URL.
   */
  function spotifyEmbedUrl(episodeUrl) {
    const id = spotifyEpisodeId(episodeUrl);
    if (!id) return null;
    return `https://open.spotify.com/embed/episode/${id}?utm_source=generator&theme=0`;
  }

  /* ══════════════════════════════════════════════════════════
     PLAYER
  ══════════════════════════════════════════════════════════ */
  /* CMS fields are plain text: escape them before they go into HTML, and
     only allow http(s)/mailto/tel or same-site links (never javascript:). */
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function safeUrl(u, fallback) {
    var s = String(u == null ? '' : u).trim();
    var probe = s.replace(/[\u0000-\u0020\u007f]/g, '');
    if (!s) return fallback || '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(probe) && !/^(https?|mailto|tel):/i.test(probe)) return fallback || '';
    return s;
  }

  const player = document.getElementById('pod-player');
  let episodeMap = {};   /* _id → episode object */

  function showPlayer() {
    if (!player) return;
    player.setAttribute('aria-hidden', 'false');
    player.classList.add('pod-player--visible');
    document.body.classList.add('pod-player-open');
  }

  function hidePlayer() {
    if (!player) return;
    player.setAttribute('aria-hidden', 'true');
    player.classList.remove('pod-player--visible');
    document.body.classList.remove('pod-player-open');
    /* Remove iframe to stop playback */
    const wrap = document.getElementById('pod-player-embed-wrap');
    if (wrap) wrap.innerHTML = '';
  }

  function loadEpisodeInPlayer(ep) {
    if (!player) return;

    /* Update episode label */
    const epNumEl = document.getElementById('pod-player-epnum');
    const titleEl = document.getElementById('pod-player-title');
    if (epNumEl) epNumEl.textContent = `EP ${String(ep.episodeNumber || '').padStart(2, '0')}`;
    if (titleEl) titleEl.textContent = ep.title || '';

    /* Spotify link (direct open in new tab) */
    const spotifyLink = document.getElementById('pod-player-spotify');
    const epSpotify   = safeUrl(ep.spotifyUrl) || safeUrl(globalSpotifyUrl);
    if (spotifyLink) {
      spotifyLink.href  = epSpotify || '#';
      spotifyLink.style.display = epSpotify ? '' : 'none';
    }

    const noAudio     = document.getElementById('pod-player-no-audio');
    const noAudioLink = document.getElementById('pod-player-no-audio-link');
    const embedWrap   = document.getElementById('pod-player-embed-wrap');
    const actionsEl   = player.querySelector('.pod-player-actions');

    /* Try to build embed URL from episode's spotifyUrl */
    const embedUrl = spotifyEmbedUrl(ep.spotifyUrl);

    if (!embedUrl) {
      /* No valid Spotify episode URL — show fallback */
      if (embedWrap) embedWrap.innerHTML = '';
      if (embedWrap) embedWrap.style.display = 'none';
      if (noAudio)   noAudio.style.display = '';
      if (noAudioLink) {
        noAudioLink.href = epSpotify || '#';
        noAudioLink.style.display = epSpotify ? '' : 'none';
      }
      /* Still show the Spotify link button if available */
      if (actionsEl) actionsEl.style.display = '';
      showPlayer();
      return;
    }

    /* Valid embed URL — inject iframe */
    if (noAudio)   noAudio.style.display = 'none';
    if (embedWrap) {
      embedWrap.style.display = '';
      embedWrap.innerHTML = `<iframe
        src="${embedUrl}"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        title="Spotify player — ${esc(ep.title)}"
      ></iframe>`;
    }
    if (actionsEl) actionsEl.style.display = '';
    showPlayer();
  }

  /* Close button */
  const closeBtn = document.getElementById('pod-player-close');
  if (closeBtn) closeBtn.addEventListener('click', hidePlayer);

  /* ══════════════════════════════════════════════════════════
     EPISODE CARD BUILDER
     [ ▶ Play Episode ]   [ 🎧 Listen on Spotify ]
  ══════════════════════════════════════════════════════════ */
  function buildEpisodeCard(ep) {
    const article = document.createElement('article');
    article.className = 'pod-ep-card';
    article.setAttribute('data-ep-id', ep._id || '');

    /* Spotify link for "Listen on Spotify" button:
       episode-specific first, then global fallback */
    const epSpotify = safeUrl(ep.spotifyUrl) || safeUrl(globalSpotifyUrl);
    /* Only show Play button if a Spotify episode URL exists (embed requires it) */
    const hasEmbed  = Boolean(spotifyEpisodeId(ep.spotifyUrl || ''));

    article.innerHTML = `
      <div class="pod-ep-thumb-wrap">
        <img src="${esc(ep.thumbnail || FALLBACK_IMG)}" alt="${esc(ep.title)}" class="pod-ep-thumb" loading="lazy" />
        <span class="pod-ep-num">EP. ${esc(String(ep.episodeNumber || '').padStart(2, '0'))}</span>
        ${ep.guestName ? `<span class="pod-ep-badge">${esc(String(ep.guestName).split(' ').pop())}</span>` : ''}
      </div>
      <div class="pod-ep-body">
        <h3 class="pod-ep-title">${esc(ep.title)}</h3>
        <div class="pod-ep-meta">
          ${ep.guestName ? `<span class="pod-ep-guest">${USER_SVG} ${esc(ep.guestName)}</span>` : ''}
          ${ep.duration  ? `<span class="pod-ep-duration">${CLOCK_SVG} ${esc(ep.duration)}</span>` : ''}
        </div>
        ${ep.description ? `<p class="pod-ep-desc">${esc(ep.description)}</p>` : ''}
        <div class="pod-ep-waveform" aria-hidden="true">${WAVE_BARS}</div>
        <div class="pod-ep-actions">
          ${hasEmbed
            ? `<button class="pod-ep-btn pod-ep-btn--play" data-ep-id="${esc(ep._id)}"
                        aria-label="Play ${esc(ep.title || 'episode')} on this page">
                 ${PLAY_SVG} Play Episode
               </button>`
            : ''}
          ${epSpotify
            ? `<a href="${esc(epSpotify)}" target="_blank" rel="noopener noreferrer"
                  class="pod-ep-btn pod-ep-btn--spotify" aria-label="Listen on Spotify">
                 ${SPOTIFY_SVG} Listen on Spotify
               </a>`
            : ''}
          ${!hasEmbed && !epSpotify
            ? `<span class="pod-ep-unavail">Not yet available</span>`
            : ''}
        </div>
      </div>`;
    return article;
  }

  /* ══════════════════════════════════════════════════════════
     FEATURED CARD (latest episode)
  ══════════════════════════════════════════════════════════ */
  function renderFeatured(ep) {
    const card = document.querySelector('.pod-feat-card');
    if (!card) return;

    const img = card.querySelector('.pod-feat-thumb-img');
    if (img) { img.src = ep.thumbnail || FALLBACK_IMG; img.alt = ep.title || ''; }

    const epNum = card.querySelector('.pod-feat-ep-num');
    if (epNum) epNum.textContent = `EP. ${String(ep.episodeNumber || '').padStart(2, '0')}`;

    const dur = card.querySelector('.pod-feat-duration');
    if (dur && ep.duration) dur.innerHTML = `${CLOCK_SVG} ${esc(ep.duration)}`;

    const title   = card.querySelector('.pod-feat-ep-title');
    if (title) title.textContent = ep.title || '';

    const guestName = card.querySelector('.pod-feat-guest-name');
    if (guestName) guestName.textContent = ep.guestName || '';

    const guestRole = card.querySelector('.pod-feat-guest-role');
    if (guestRole) guestRole.textContent = ep.guestDesignation || '';

    const summary = card.querySelector('.pod-feat-summary');
    if (summary) summary.textContent = ep.description || '';

    /* Play Episode → in-page Spotify embed */
    const playBtn = card.querySelector('.pod-feat-btn--play');
    if (playBtn) {
      const hasEmbed = Boolean(spotifyEpisodeId(ep.spotifyUrl || ''));
      playBtn.setAttribute('data-ep-id', ep._id || '');
      playBtn.removeAttribute('href');
      playBtn.hidden = !hasEmbed;
    }

    /* Listen on Spotify → new tab */
    const spotifyBtn  = card.querySelector('.pod-feat-btn--spotify');
    const featSpotify = safeUrl(ep.spotifyUrl) || safeUrl(globalSpotifyUrl);
    if (spotifyBtn) {
      spotifyBtn.href   = featSpotify || '#';
      spotifyBtn.target = '_blank';
      spotifyBtn.rel    = 'noopener noreferrer';
      spotifyBtn.style.display = featSpotify ? '' : 'none';
    }
  }

  /* ══════════════════════════════════════════════════════════
     GUESTS SECTION
  ══════════════════════════════════════════════════════════ */
  function renderGuests(episodes) {
    const grid    = document.querySelector('.pod-guests-grid');
    const section = document.getElementById('pod-guests');
    if (!grid || !section) return;

    const seen = new Set();
    const guests = [];
    episodes.forEach(ep => {
      const name = (ep.guestName || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      guests.push({ name, designation: (ep.guestDesignation || '').trim() });
    });

    if (!guests.length) { section.style.display = 'none'; return; }

    const GUEST_SVG     = `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="20" cy="15" r="7" stroke="rgba(0,169,157,0.7)" stroke-width="1.5"/><path d="M6 36c0-7.732 6.268-14 14-14s14 6.268 14 14" stroke="rgba(0,169,157,0.7)" stroke-width="1.5" stroke-linecap="round"/></svg>`;
    const SPOTIFY_BADGE = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.623.623 0 0 1-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.623.623 0 1 1-.277-1.215c3.809-.87 7.076-.496 9.712 1.115a.623.623 0 0 1 .207.857zm1.223-2.722a.78.78 0 0 1-1.072.257c-2.687-1.652-6.785-2.131-9.965-1.166a.78.78 0 0 1-.973-.519.781.781 0 0 1 .52-.973c3.632-1.102 8.147-.568 11.233 1.329a.78.78 0 0 1 .257 1.072zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71a.937.937 0 1 1-.543-1.793c3.532-1.072 9.404-.865 13.115 1.338a.937.937 0 0 1-.955 1.612z"/></svg>`;

    grid.innerHTML = guests.map(g => `
      <article class="pod-guest-card">
        <div class="pod-guest-avatar-wrap">
          <div class="pod-guest-avatar" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;">${GUEST_SVG}</div>
        </div>
        <div class="pod-guest-info">
          <h3 class="pod-guest-name">${esc(g.name)}</h3>
          ${g.designation ? `<span class="pod-guest-designation">${esc(g.designation)}</span>` : ''}
          <span class="pod-guest-spotify-badge" aria-label="Podcast guest">${SPOTIFY_BADGE} Podcast Guest</span>
        </div>
      </article>`).join('');
  }

  /* ══════════════════════════════════════════════════════════
     CLICK HANDLER (delegated)
  ══════════════════════════════════════════════════════════ */
  function attachPlayHandlers(container) {
    if (!container) return;
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-ep-id].pod-ep-btn--play, .pod-feat-btn--play[data-ep-id]');
      if (!btn) return;
      e.preventDefault();
      const id = btn.getAttribute('data-ep-id');
      const ep = episodeMap[id];
      if (!ep) return;

      loadEpisodeInPlayer(ep);

      /* Visually mark active card */
      document.querySelectorAll('.pod-ep-card').forEach(c => c.classList.remove('pod-ep-card--playing'));
      const card = container.querySelector(`.pod-ep-card[data-ep-id="${id}"]`);
      if (card) card.classList.add('pod-ep-card--playing');
    });
  }

  /* ══════════════════════════════════════════════════════════
     TOPIC FILTER  (Discover by Topic section)
     Chips are <button data-topic="..."> elements.
     Episodes are already in memory (episodeMap).
     Filtering is purely client-side — no extra API call.
  ══════════════════════════════════════════════════════════ */
  function initTopicFilter(allEpisodes) {
    const chips       = document.querySelectorAll('.pod-topic-chip[data-topic]');
    const resultsBox  = document.getElementById('pod-topic-results');
    const resultsName = document.getElementById('pod-topic-results-name');
    const resultsGrid = document.getElementById('pod-topic-ep-grid');
    const clearBtn    = document.getElementById('pod-topic-clear');

    if (!chips.length || !resultsBox || !resultsGrid) return;

    function showTopicResults(topic) {
      /* Case-insensitive tag match */
      const topicLower = topic.toLowerCase();
      const matched = allEpisodes.filter(ep =>
        Array.isArray(ep.tags) &&
        ep.tags.some(t => t.toLowerCase() === topicLower)
      );

      /* Update active chip state */
      chips.forEach(c => {
        const isThis = c.getAttribute('data-topic').toLowerCase() === topicLower;
        c.setAttribute('aria-pressed', isThis ? 'true' : 'false');
      });

      /* Populate results name */
      if (resultsName) resultsName.textContent = topic;

      /* Build result cards */
      resultsGrid.innerHTML = '';
      if (!matched.length) {
        resultsGrid.innerHTML = `<p class="pod-topic-empty">No published episodes found for this topic yet.</p>`;
      } else {
        matched.forEach(ep => {
          const card = buildEpisodeCard(ep);
          resultsGrid.appendChild(card);
        });
        /* Wire Play buttons in the new cards */
        attachPlayHandlers(resultsGrid);
      }

      /* Show panel and scroll to it */
      resultsBox.style.display = '';
      resultsBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function clearTopicFilter() {
      chips.forEach(c => c.setAttribute('aria-pressed', 'false'));
      resultsBox.style.display = 'none';
      resultsGrid.innerHTML = '';
    }

    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const topic = chip.getAttribute('data-topic');
        /* Clicking the already-active chip clears the filter */
        if (chip.getAttribute('aria-pressed') === 'true') {
          clearTopicFilter();
        } else {
          showTopicResults(topic);
        }
      });
    });

    if (clearBtn) clearBtn.addEventListener('click', clearTopicFilter);
  }

  /* ══════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════ */
  async function init() {
    const epGrid = document.querySelector('.pod-ep-grid');
    if (!epGrid) return;

    /* Fetch global Spotify URL + episodes in parallel */
    const settingsPromise = fetch(`${API_BASE}/site-settings/public`)
      .then(r => r.json())
      .then(json => {
        const url = json && json.data && json.data.socialLinks && json.data.socialLinks.spotify;
        globalSpotifyUrl = safeUrl(url);
        if (globalSpotifyUrl) {
          document.querySelectorAll('[data-social="spotify"]').forEach(el => {
            el.href   = globalSpotifyUrl;
            el.target = '_blank';
            el.rel    = 'noopener noreferrer';
          });
        }
      })
      .catch(() => {});

    try {
      const [res] = await Promise.all([
        fetch(`${API_BASE}/podcasts`).then(r => r.json()),
        settingsPromise,
      ]);

      const episodes = (res.data || res).sort((a, b) => b.episodeNumber - a.episodeNumber);

      if (!episodes.length) {
        epGrid.innerHTML = `<p class="embs-empty">No episodes yet.</p>`;
        const section = document.getElementById('pod-guests');
        if (section) section.style.display = 'none';
        return;
      }

      /* Build lookup map */
      episodes.forEach(ep => { episodeMap[ep._id] = ep; });

      /* Render featured card */
      renderFeatured(episodes[0]);
      attachPlayHandlers(document.querySelector('.pod-feat-card'));

      /* Render episode grid */
      epGrid.innerHTML = '';
      episodes.forEach(ep => epGrid.appendChild(buildEpisodeCard(ep)));
      attachPlayHandlers(epGrid);

      /* Guests */
      renderGuests(episodes);

      /* Topic filter */
      initTopicFilter(episodes);

      /* Hero meta count */
      const metaNums = document.querySelectorAll('.pod-hero-meta-num');
      if (metaNums[0]) metaNums[0].textContent = `${episodes.length}+`;

    } catch (err) {
      console.error('Failed to load podcasts:', err);
      epGrid.innerHTML = `<p class="embs-empty">Could not load episodes. Please try again later.</p>`;
      const section = document.getElementById('pod-guests');
      if (section) section.style.display = 'none';
    }
  }

  init();
})();
