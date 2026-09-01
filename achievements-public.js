(function () {
  'use strict';

  const API_BASE = window.EMBS_API_BASE;

  const CATEGORY_MAP = {
    'student-awards':  { label: 'Student Award',    badgeClass: 'ach-card-badge--award',       icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" stroke="#6B2D8B" stroke-width="1.5" stroke-linejoin="round"/></svg>` },
    'publications':    { label: 'Publication',      badgeClass: 'ach-card-badge--publication',  icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="4" y="2" width="16" height="20" rx="2" stroke="#00A99D" stroke-width="1.5"/><line x1="8" y1="8" x2="16" y2="8" stroke="#00A99D" stroke-width="1.5" stroke-linecap="round"/><line x1="8" y1="12" x2="16" y2="12" stroke="#00A99D" stroke-width="1.5" stroke-linecap="round"/><line x1="8" y1="16" x2="12" y2="16" stroke="#00A99D" stroke-width="1.5" stroke-linecap="round"/></svg>` },
    'competition-wins':{ label: 'Competition Win',  badgeClass: 'ach-card-badge--competition',  icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><polygon points="12,2 15,9 22,9 16,14 18,21 12,17 6,21 8,14 2,9 9,9" stroke="#6B2D8B" stroke-width="1.5" stroke-linejoin="round" fill="rgba(107,45,139,0.08)"/></svg>` },
    'certifications':  { label: 'Certification',    badgeClass: 'ach-card-badge--cert',         icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#00A99D" stroke-width="1.5"/><path d="M8 12l3 3 5-5" stroke="#00A99D" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>` },
    'faculty':         { label: 'Faculty',           badgeClass: 'ach-card-badge--faculty',      icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="2" y="7" width="20" height="14" rx="3" stroke="#00A99D" stroke-width="1.5"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" stroke="#00A99D" stroke-width="1.5" stroke-linecap="round"/><line x1="12" y1="12" x2="12" y2="16" stroke="#00A99D" stroke-width="1.5" stroke-linecap="round"/><line x1="10" y1="14" x2="14" y2="14" stroke="#00A99D" stroke-width="1.5" stroke-linecap="round"/></svg>` },
  };

  const DEFAULT_CAT = { label: 'Achievement', badgeClass: 'ach-card-badge--award', icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" stroke="#6B2D8B" stroke-width="1.5" stroke-linejoin="round"/></svg>` };

  const DATE_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.5"/><line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" stroke-width="1.5"/><line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  const USER_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.5"/><path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;

  function buildCard(item) {
    const catKey = (item.category || '').toLowerCase().replace(/\s+/g, '-');
    const cat = CATEGORY_MAP[catKey] || DEFAULT_CAT;
    const article = document.createElement('article');
    article.className = 'ach-card';
    article.setAttribute('data-category', catKey);
    article.innerHTML = `
      <div class="ach-card-top">
        <div class="ach-card-icon">${cat.icon}</div>
        <span class="ach-card-badge ${cat.badgeClass}">${cat.label}</span>
      </div>
      <div class="ach-card-body">
        <h3 class="ach-card-title">${item.title}</h3>
        ${item.description ? `<p class="ach-card-desc">${item.description}</p>` : ''}
        <div class="ach-card-meta">
          ${item.recipient ? `<span class="ach-card-recipient">${USER_SVG} ${item.recipient}</span>` : ''}
          ${item.date ? `<span class="ach-card-date">${DATE_SVG} ${item.date}</span>` : ''}
        </div>
      </div>`;
    return article;
  }

  function initFilters(cards) {
    document.querySelectorAll('.ach-chip').forEach(chip => {
      chip.addEventListener('click', function () {
        document.querySelectorAll('.ach-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const filter = chip.getAttribute('data-filter');
        cards.forEach(card => {
          card.style.display = (filter === 'all' || card.getAttribute('data-category') === filter) ? '' : 'none';
        });
      });
    });
  }

  const backToTop = document.getElementById('backToTop');
  if (backToTop) {
    window.addEventListener('scroll', () => backToTop.classList.toggle('visible', window.scrollY > 400));
    backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  async function init() {
    const grid = document.querySelector('.ach-cards-grid');
    if (!grid) return;

    try {
      const res = await fetch(`${API_BASE}/achievements`);
      const json = await res.json();
      const items = json.data || json;

      if (!Array.isArray(items) || !items.length) {
        grid.innerHTML = `<p class="embs-empty">No achievements yet.</p>`;
        return;
      }

      grid.innerHTML = '';
      const cards = items.map(item => { const c = buildCard(item); grid.appendChild(c); return c; });
      initFilters(cards);
    } catch {
      grid.innerHTML = `<p class="embs-empty">Failed to load achievements.</p>`;
    }
  }

  init();
})();
