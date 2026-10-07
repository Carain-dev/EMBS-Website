/* events.js — Fetch events from API and render */
(function () {
  'use strict';

  const API_BASE = window.EMBS_API_BASE;
  const CARDS_PER_PAGE = 9;
  let currentPage  = 1;
  let activeFilter = 'all';
  let searchQuery  = '';
  let allCards     = [];

  const grid       = document.getElementById('eventsGrid');
  const emptyState = document.getElementById('eventsEmpty');
  const pagination = document.getElementById('eventsPagination');
  const searchInput = document.getElementById('eventsSearch');
  const filterChips = document.querySelectorAll('.filter-chip');
  const backToTop   = document.getElementById('backToTop');

  if (!grid) return;

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

  function fmtDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function buildCard(ev) {
    const eventUrl = `event.html?id=${encodeURIComponent(ev._id)}`;
    const registrationUrl = /^https?:\/\//i.test(String(ev.registrationLink || '')) ? ev.registrationLink : '';
    const actionUrl = esc(registrationUrl || eventUrl);
    const actionText = registrationUrl ? 'Register' : 'View Details';
    const shouldOpenNewTab = Boolean(registrationUrl);

    const div = document.createElement('div');
    div.className = 'ev-card';
    div.setAttribute('data-category', (ev.type || '').toLowerCase().replace(/\s+/g, '-'));
    div.setAttribute('data-search', `${ev.title || ''} ${ev.speaker || ''} ${ev.venue || ''} ${(ev.tags||[]).join(' ')}`.toLowerCase());
    div.innerHTML = `
      <div class="ev-card-top" style="background:linear-gradient(135deg,#1a0533,#0a2a2a)">
        ${ev.thumbnail ? `<img src="${esc(ev.thumbnail)}" alt="${esc(ev.title)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.55;" loading="lazy" />` : ''}
        <span class="ev-tag ev-tag--${esc(ev.status || 'upcoming')}">${esc(ev.status || 'Upcoming')}</span>
        <div class="ev-card-type">${esc(ev.type)}</div>
      </div>
      <div class="ev-card-body">
        <div class="ev-meta">
          <span class="ev-date">${fmtDate(ev.date)}</span>
          ${ev.time ? `<span class="ev-mode">${esc(ev.time)}</span>` : ''}
          ${ev.mode ? `<span class="ev-mode">${esc(ev.mode)}</span>` : ''}
        </div>
        <h3 class="ev-title"><a href="${eventUrl}">${esc(ev.title)}</a></h3>
        <p class="ev-desc">${esc(ev.description)}</p>
        <div class="ev-footer">
          ${ev.venue ? `<span class="ev-location">${esc(ev.venue)}</span>` : ''}
          <a href="${actionUrl}" class="act-btn act-btn--primary" ${shouldOpenNewTab ? 'target="_blank" rel="noopener noreferrer"' : ''}>${actionText}</a>
        </div>
      </div>`;
    return div;
  }

  function getVisibleCards() {
    return allCards.filter(card => {
      const cat  = card.getAttribute('data-category') || '';
      const text = card.getAttribute('data-search') || '';
      const matchFilter = activeFilter === 'all' || cat === activeFilter;
      const matchSearch = searchQuery === '' || text.includes(searchQuery);
      return matchFilter && matchSearch;
    });
  }

  function renderPage() {
    const visible    = getVisibleCards();
    const totalPages = Math.max(1, Math.ceil(visible.length / CARDS_PER_PAGE));
    if (currentPage > totalPages) currentPage = 1;
    const start = (currentPage - 1) * CARDS_PER_PAGE;
    const end   = start + CARDS_PER_PAGE;
    allCards.forEach(c => c.classList.add('hidden'));
    visible.forEach((c, i) => { if (i >= start && i < end) c.classList.remove('hidden'); });
    emptyState && (emptyState.classList.toggle('visible', visible.length === 0));
    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    if (!pagination) return;
    pagination.innerHTML = '';
    if (totalPages <= 1) return;
    const prev = makeBtn('← Prev', currentPage === 1);
    prev.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderPage(); scrollToGrid(); } });
    pagination.appendChild(prev);
    for (let i = 1; i <= totalPages; i++) {
      const btn = makeBtn(i, false);
      if (i === currentPage) btn.classList.add('active');
      btn.addEventListener('click', () => { currentPage = i; renderPage(); scrollToGrid(); });
      pagination.appendChild(btn);
    }
    const next = makeBtn('Next →', currentPage === totalPages);
    next.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; renderPage(); scrollToGrid(); } });
    pagination.appendChild(next);
  }

  function makeBtn(label, disabled) {
    const btn = document.createElement('button');
    btn.className = 'pg-btn'; btn.textContent = label; btn.disabled = disabled;
    return btn;
  }

  function scrollToGrid() {
    const target = document.getElementById('eventsGridSection');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      searchQuery = this.value.trim().toLowerCase(); currentPage = 1; renderPage();
    });
  }

  filterChips.forEach(chip => {
    chip.addEventListener('click', function () {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.getAttribute('data-filter') || 'all';
      currentPage = 1; renderPage();
    });
  });

  if (backToTop) {
    window.addEventListener('scroll', () => backToTop.classList.toggle('visible', window.scrollY > 400));
    backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  async function init() {
    try {
      const res  = await fetch(`${API_BASE}/events`);
      const data = await res.json();
      const events = data.data || [];
      grid.innerHTML = '';
      if (!events.length) { emptyState && emptyState.classList.add('visible'); return; }
      allCards = events.map(ev => { const card = buildCard(ev); grid.appendChild(card); return card; });
      renderPage();
    } catch {
      grid.innerHTML = '<p class="embs-empty">Failed to load events.</p>';
    }
  }

  init();
})();
