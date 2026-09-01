(function () {
  'use strict';

  const API_BASE = window.EMBS_API_BASE;

  const PLAY_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5,3 19,12 5,21"/></svg>`;
  const SPOTIFY_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.623.623 0 0 1-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.623.623 0 1 1-.277-1.215c3.809-.87 7.076-.496 9.712 1.115a.623.623 0 0 1 .207.857zm1.223-2.722a.78.78 0 0 1-1.072.257c-2.687-1.652-6.785-2.131-9.965-1.166a.78.78 0 0 1-.973-.519.781.781 0 0 1 .52-.973c3.632-1.102 8.147-.568 11.233 1.329a.78.78 0 0 1 .257 1.072zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71a.937.937 0 1 1-.543-1.793c3.532-1.072 9.404-.865 13.115 1.338a.937.937 0 0 1-.955 1.612z"/></svg>`;
  const CLOCK_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
  const USER_SVG  = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.582-7 8-7s8 3 8 7"/></svg>`;

  const WAVE_BARS = Array.from({length: 15}, (_,i) => {
    const heights = [40,65,50,80,60,90,70,100,75,55,85,45,65,35,55];
    return `<span style="--h:${heights[i]}%"></span>`;
  }).join('');

  const FALLBACK_IMG = 'bg-image-embs/bluebg.jpeg';

  function buildEpisodeCard(ep) {
    const article = document.createElement('article');
    article.className = 'pod-ep-card';
    article.innerHTML = `
      <div class="pod-ep-thumb-wrap">
        <img src="${ep.thumbnail || FALLBACK_IMG}" alt="${ep.title}" class="pod-ep-thumb" loading="lazy" />
        <span class="pod-ep-num">EP. ${String(ep.episodeNumber).padStart(2,'0')}</span>
        ${ep.guestName ? `<span class="pod-ep-badge">${ep.guestName.split(' ').pop()}</span>` : ''}
      </div>
      <div class="pod-ep-body">
        <h3 class="pod-ep-title">${ep.title}</h3>
        <div class="pod-ep-meta">
          ${ep.guestName ? `<span class="pod-ep-guest">${USER_SVG} ${ep.guestName}</span>` : ''}
          ${ep.duration ? `<span class="pod-ep-duration">${CLOCK_SVG} ${ep.duration}</span>` : ''}
        </div>
        ${ep.description ? `<p class="pod-ep-desc">${ep.description}</p>` : ''}
        <div class="pod-ep-waveform" aria-hidden="true">${WAVE_BARS}</div>
        <div class="pod-ep-actions">
          ${(ep.audioUrl || ep.spotifyUrl)
            ? `<a href="${ep.audioUrl || ep.spotifyUrl}" target="_blank" rel="noopener" class="pod-ep-btn pod-ep-btn--play">${PLAY_SVG} Play Episode</a>`
            : ''}
          ${ep.spotifyUrl ? `<a href="${ep.spotifyUrl}" target="_blank" rel="noopener" class="pod-ep-btn pod-ep-btn--spotify">${SPOTIFY_SVG} Spotify</a>` : ''}
        </div>
      </div>`;
    return article;
  }

  function renderFeatured(ep) {
    const card = document.querySelector('.pod-feat-card');
    if (!card) return;

    const img = card.querySelector('.pod-feat-thumb-img');
    if (img) { img.src = ep.thumbnail || FALLBACK_IMG; img.alt = ep.title; }

    const epNum = card.querySelector('.pod-feat-ep-num');
    if (epNum) epNum.textContent = `EP. ${String(ep.episodeNumber).padStart(2,'0')}`;

    const dur = card.querySelector('.pod-feat-duration');
    if (dur && ep.duration) dur.innerHTML = `${CLOCK_SVG} ${ep.duration}`;

    const title = card.querySelector('.pod-feat-ep-title');
    if (title) title.textContent = ep.title;

    const guestName = card.querySelector('.pod-feat-guest-name');
    if (guestName) guestName.textContent = ep.guestName || '';

    const guestRole = card.querySelector('.pod-feat-guest-role');
    if (guestRole) guestRole.textContent = ep.guestDesignation || '';

    const summary = card.querySelector('.pod-feat-summary');
    if (summary) summary.textContent = ep.description || '';

    const playBtn = card.querySelector('.pod-feat-btn--play');
    if (playBtn) {
      const playUrl = ep.audioUrl || ep.spotifyUrl;
      playBtn.href = playUrl || '#';
      // No audio uploaded yet, so hide it rather than offer a button to nowhere.
      playBtn.hidden = !playUrl;
    }

    const spotifyBtn = card.querySelector('.pod-feat-btn--spotify');
    if (spotifyBtn) {
      spotifyBtn.href = ep.spotifyUrl || '#';
      spotifyBtn.style.display = ep.spotifyUrl ? '' : 'none';
    }
  }

  async function init() {
    const epGrid = document.querySelector('.pod-ep-grid');
    if (!epGrid) return;

    try {
      const res = await fetch(`${API_BASE}/podcasts`);
      const json = await res.json();
      const episodes = (json.data || json).sort((a, b) => b.episodeNumber - a.episodeNumber);

      if (!episodes.length) {
        epGrid.innerHTML = `<p class="embs-empty">No episodes yet.</p>`;
        return;
      }

      // Render featured (latest episode)
      renderFeatured(episodes[0]);

      // Render episode grid
      epGrid.innerHTML = '';
      episodes.forEach(ep => epGrid.appendChild(buildEpisodeCard(ep)));

      // Update hero meta counts
      const metaNums = document.querySelectorAll('.pod-hero-meta-num');
      if (metaNums[0]) metaNums[0].textContent = `${episodes.length}+`;
    } catch (err) {
      console.error('Failed to load podcasts:', err);
    }
  }

  init();
})();
