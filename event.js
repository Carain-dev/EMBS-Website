(function () {
  'use strict';

  const API_BASE = window.EMBS_API_BASE;
  const mount = document.getElementById('eventDetail');
  if (!mount) return;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeUrl(value) {
    const url = String(value || '').trim();
    return /^https?:\/\//i.test(url) ? url : '';
  }

  function state(title, detail, showBack) {
    mount.innerHTML = `
      <div class="pd-state">
        <p class="pd-state-title">${esc(title)}</p>
        <p>${esc(detail)}</p>
        ${showBack ? '<p style="margin-top:1.5rem"><a class="pd-btn" href="events.html">Browse all events</a></p>' : ''}
      </div>`;
  }

  function fmtDate(d) {
    if (!d) return '';
    const parsed = new Date(d);
    if (isNaN(parsed)) return String(d);
    return parsed.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  }

  function render(ev) {
    const tags = Array.isArray(ev.tags) ? ev.tags : [];
    const register = safeUrl(ev.registrationLink);
    const isUpcoming = (ev.status || 'upcoming') === 'upcoming';

    const facts = [
      ev.date && { label: 'Date', value: fmtDate(ev.date) },
      ev.venue && { label: 'Venue', value: ev.venue },
      ev.mode && { label: 'Mode', value: ev.mode },
      ev.speaker && { label: 'Speaker', value: ev.speaker },
    ].filter(Boolean);

    document.title = `${ev.title} – Events – IEEE EMBS`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc && ev.description) desc.setAttribute('content', String(ev.description).slice(0, 155));

    mount.innerHTML = `
      <article>
        <div class="pd-meta-row">
          ${ev.type ? `<span class="pd-chip">${esc(ev.type)}</span>` : ''}
          <span class="pd-chip pd-chip--status">${esc(ev.status || 'upcoming')}</span>
        </div>

        <h1 class="pd-title">${esc(ev.title)}</h1>

        ${ev.thumbnail ? `<img class="pd-hero-img" src="${esc(ev.thumbnail)}" alt="" />` : ''}

        ${ev.description ? `
          <h2 class="pd-section-title">About this event</h2>
          <p class="pd-desc">${esc(ev.description)}</p>` : ''}

        ${facts.length ? `
          <div class="pd-facts">
            ${facts.map(f => `
              <div class="pd-fact">
                <span class="pd-fact-label">${esc(f.label)}</span>
                <span class="pd-fact-value">${esc(f.value)}</span>
              </div>`).join('')}
          </div>` : ''}

        ${tags.length ? `
          <h2 class="pd-section-title">Tags</h2>
          <div class="pd-tags">${tags.map(t => `<span class="pd-tag">${esc(t)}</span>`).join('')}</div>` : ''}

        ${register && isUpcoming ? `
          <div class="pd-actions">
            <a class="pd-btn" href="${esc(register)}" target="_blank" rel="noopener">Register for this event</a>
          </div>` : ''}

        ${!isUpcoming ? `<p class="pd-desc" style="margin-top:1.5rem">This event has already taken place.</p>` : ''}
      </article>`;
  }

  async function init() {
    const id = new URLSearchParams(window.location.search).get('id');

    if (!id) {
      state('No event selected', 'Pick an event from the events page to see its details.', true);
      return;
    }

    state('Loading…', 'Fetching event details.', false);

    try {
      const res = await fetch(`${API_BASE}/events/${encodeURIComponent(id)}`);
      const json = await res.json();

      if (!res.ok || !json.data || !json.data._id) {
        state('Event not found', 'This event may have been removed.', true);
        return;
      }

      render(json.data);
    } catch (err) {
      console.error('Failed to load event:', err);
      state('Could not load this event', 'Please check your connection and try again.', true);
    }
  }

  const backToTop = document.getElementById('backToTop');
  if (backToTop) {
    window.addEventListener('scroll', () => backToTop.classList.toggle('visible', window.scrollY > 400));
    backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  init();

})();
