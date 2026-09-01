(function () {
  'use strict';

  const API_BASE = window.EMBS_API_BASE;

  const LI_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="4" stroke="currentColor" stroke-width="1.5"/><line x1="7" y1="10" x2="7" y2="17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="7" cy="7" r="1" fill="currentColor"/><path d="M11 17v-4a2 2 0 0 1 4 0v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="11" y1="10" x2="11" y2="17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;

  const CORE_ROLES = ['chapter chair', 'vice chair', 'secretary', 'treasurer', 'president', 'vice president'];

  function initials(name) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  function isCore(member) {
    return CORE_ROLES.some(r => (member.role || '').toLowerCase().includes(r));
  }

  function buildCoreCard(member, index) {
    const badgeColors = ['', '--teal', '', '--teal'];
    const badgeClass = `cteam-role-badge${badgeColors[index % 4] || ''}`;
    const article = document.createElement('article');
    article.className = 'cteam-card';
    article.innerHTML = `
      <div class="cteam-card-top">
        <div class="cteam-avatar-wrap">
          ${member.photo ? `<img src="${member.photo}" alt="${member.name}" class="cteam-avatar-img" />` : ''}
          <div class="cteam-avatar-placeholder" aria-hidden="true">${initials(member.name)}</div>
        </div>
        <div class="${badgeClass}">${member.role}</div>
      </div>
      <div class="cteam-card-body">
        <h3 class="cteam-name">${member.name}</h3>
        <p class="cteam-position">${member.role}</p>
        ${member.batch ? `<p class="cteam-dept">${member.batch}</p>` : ''}
        <div class="cteam-actions">
          <a href="${member.linkedin || '#'}" target="_blank" rel="noopener" class="cteam-btn cteam-btn--linkedin" aria-label="LinkedIn">
            ${LI_SVG} LinkedIn
          </a>
        </div>
      </div>`;
    return article;
  }

  function buildMemberCard(member) {
    const article = document.createElement('article');
    article.className = 'smem-card';
    const nameWords = member.name.toLowerCase().split(' ');
    article.setAttribute('data-search', `${member.name} ${member.role} ${member.batch || ''}`.toLowerCase());
    article.innerHTML = `
      <div class="smem-avatar-wrap">
        ${member.photo ? `<img src="${member.photo}" alt="${member.name}" class="smem-avatar-img" />` : ''}
        <div class="smem-avatar-placeholder" aria-hidden="true">${initials(member.name)}</div>
      </div>
      <div class="smem-card-body">
        <h3 class="smem-name">${member.name}</h3>
        <p class="smem-dept">${member.role}</p>
        ${member.batch ? `<p class="smem-meta"><span class="smem-year">${member.batch}</span></p>` : ''}
      </div>`;
    return article;
  }

  function initSearch(cards) {
    const searchInput = document.getElementById('memberSearch');
    const emptyState = document.getElementById('memberEmpty');
    if (!searchInput) return;

    searchInput.addEventListener('input', function () {
      const q = this.value.trim().toLowerCase();
      let visible = 0;
      cards.forEach(card => {
        const match = !q || (card.getAttribute('data-search') || '').includes(q);
        card.classList.toggle('hidden', !match);
        if (match) visible++;
      });
      if (emptyState) emptyState.classList.toggle('visible', visible === 0);
    });
  }

  const backToTop = document.getElementById('backToTop');
  if (backToTop) {
    window.addEventListener('scroll', () => backToTop.classList.toggle('visible', window.scrollY > 400));
    backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  async function init() {
    const coreGrid = document.querySelector('.cteam-grid');
    const memberGrid = document.getElementById('memberGrid');
    if (!coreGrid && !memberGrid) return;

    try {
      const res = await fetch(`${API_BASE}/members`);
      const json = await res.json();
      const members = json.data || json;
      if (!Array.isArray(members) || !members.length) return;

      const coreMembers = members.filter(m => isCore(m));
      const studentMembers = members.filter(m => !isCore(m));

      // Render core team
      if (coreGrid && coreMembers.length) {
        coreGrid.innerHTML = '';
        coreMembers.forEach((m, i) => coreGrid.appendChild(buildCoreCard(m, i)));
      }

      // Render student members
      if (memberGrid && studentMembers.length) {
        memberGrid.innerHTML = '';
        const cards = studentMembers.map(m => { const c = buildMemberCard(m); memberGrid.appendChild(c); return c; });
        initSearch(cards);
      }
    } catch (err) {
      console.error('Failed to load members:', err);
    }
  }

  init();
})();
