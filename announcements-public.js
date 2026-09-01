(function () {
  'use strict';

  const API_BASE = window.EMBS_API_BASE;

  const CLOCK_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/><path d="M12 7v5l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;

  const CAT_MAP = {
    internships:  { badgeClass: 'ann-card-badge--internship',  icon: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><rect x="2" y="7" width="20" height="14" rx="3" stroke="#6B2D8B" stroke-width="1.5"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" stroke="#6B2D8B" stroke-width="1.5" stroke-linecap="round"/></svg>` },
    competitions: { badgeClass: 'ann-card-badge--competition', icon: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><polygon points="12,2 15,9 22,9 16,14 18,21 12,17 6,21 8,14 2,9 9,9" stroke="#00A99D" stroke-width="1.5" stroke-linejoin="round"/></svg>` },
    scholarships: { badgeClass: 'ann-card-badge--scholarship', icon: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 3L2 8l10 5 10-5-10-5z" stroke="#6B2D8B" stroke-width="1.5" stroke-linejoin="round"/><path d="M2 8v6c0 3 4.5 5 10 5s10-2 10-5V8" stroke="#6B2D8B" stroke-width="1.5" stroke-linecap="round"/></svg>` },
    conferences:  { badgeClass: 'ann-card-badge--conference',  icon: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="3" stroke="#00A99D" stroke-width="1.5"/><line x1="3" y1="9" x2="21" y2="9" stroke="#00A99D" stroke-width="1.5"/><line x1="8" y1="2" x2="8" y2="6" stroke="#00A99D" stroke-width="1.5" stroke-linecap="round"/><line x1="16" y1="2" x2="16" y2="6" stroke="#00A99D" stroke-width="1.5" stroke-linecap="round"/></svg>` },
    workshops:    { badgeClass: 'ann-card-badge--workshop',    icon: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 20h9" stroke="#6B2D8B" stroke-width="1.5" stroke-linecap="round"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="#6B2D8B" stroke-width="1.5" stroke-linejoin="round"/></svg>` },
    deadlines:    { badgeClass: 'ann-card-badge--deadline',    icon: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#00A99D" stroke-width="1.5"/><line x1="12" y1="7" x2="12" y2="12" stroke="#00A99D" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="16" r="1" fill="#00A99D"/></svg>` },
  };
  const DEFAULT_CAT = { badgeClass: 'ann-card-badge--workshop', icon: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#6B2D8B" stroke-width="1.5"/><line x1="12" y1="8" x2="12" y2="12" stroke="#6B2D8B" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="16" r="1" fill="#6B2D8B"/></svg>` };

  function fmtDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function buildCard(item) {
    const catKey = (item.category || '').toLowerCase();
    const cat = CAT_MAP[catKey] || DEFAULT_CAT;
    const label = catKey ? catKey.charAt(0).toUpperCase() + catKey.slice(1) : 'Announcement';
    const article = document.createElement('article');
    article.className = 'ann-card';
    article.setAttribute('data-category', catKey || 'all');
    article.innerHTML = `
      <div class="ann-card-top">
        <div class="ann-card-icon">${cat.icon}</div>
        <span class="ann-card-badge ${cat.badgeClass}">${label}</span>
      </div>
      <div class="ann-card-body">
        <h3 class="ann-card-title">${item.title}</h3>
        <p class="ann-card-desc">${item.body}</p>
        ${item.expiresAt ? `<span class="ann-card-deadline">${CLOCK_SVG} Deadline: ${fmtDate(item.expiresAt)}</span>` : ''}
      </div>
      ${item.link ? `<div class="ann-card-footer"><a href="${item.link}" target="_blank" rel="noopener" class="ann-card-apply">Learn More</a></div>` : ''}`;
    return article;
  }

  function initFilters(cards) {
    document.querySelectorAll('.ann-chip').forEach(chip => {
      chip.addEventListener('click', function () {
        document.querySelectorAll('.ann-chip').forEach(c => c.classList.remove('active'));
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
    const grid = document.querySelector('.ann-cards-grid');
    if (!grid) return;

    try {
      const res = await fetch(`${API_BASE}/announcements`);
      const json = await res.json();
      const items = json.data || json;

      if (!Array.isArray(items) || !items.length) {
        grid.innerHTML = `<p class="embs-empty">No announcements yet.</p>`;
        // hide featured section too
        const feat = document.getElementById('featured-notice');
        if (feat) feat.style.display = 'none';
        return;
      }

      grid.innerHTML = '';
      const cards = items.map(item => { const c = buildCard(item); grid.appendChild(c); return c; });
      initFilters(cards);

      // Populate featured section with pinned item or first item
      const featured = items.find(i => i.pinned) || items[0];
      const featSection = document.getElementById('featured-notice');
      if (featSection && featured) {
        const catKey = (featured.category || '').toLowerCase();
        const label = catKey ? catKey.charAt(0).toUpperCase() + catKey.slice(1) : 'Announcement';
        featSection.querySelector('.ann-featured-title').textContent = featured.title;
        featSection.querySelector('.ann-featured-desc').textContent = featured.body;
        featSection.querySelector('.ann-featured-badge').textContent = label;
        const deadlineEl = featSection.querySelector('.ann-featured-deadline');
        if (deadlineEl) {
          deadlineEl.style.display = featured.expiresAt ? '' : 'none';
          if (featured.expiresAt) deadlineEl.innerHTML = `${CLOCK_SVG} Deadline: ${fmtDate(featured.expiresAt)}`;
        }
        /* Fall back to the contact page rather than "#". An announcement
           without its own application link still needs somewhere to send
           an interested reader. */
        const applyBtn = featSection.querySelector('.ann-featured-apply');
        if (applyBtn) {
          const target = featured.link || 'contact.html';
          applyBtn.href = target;
          const external = /^https?:\/\//i.test(target);
          if (external) {
            applyBtn.target = '_blank';
            applyBtn.rel = 'noopener';
          } else {
            applyBtn.removeAttribute('target');
            applyBtn.removeAttribute('rel');
          }
        }
      }
    } catch {
      grid.innerHTML = `<p class="embs-empty">Failed to load announcements.</p>`;
    }
  }

  init();
})();
