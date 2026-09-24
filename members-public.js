(function () {
  'use strict';

  const API_BASE = window.EMBS_API_BASE;

  const LI_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="4" stroke="currentColor" stroke-width="1.5"/><line x1="7" y1="10" x2="7" y2="17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="7" cy="7" r="1" fill="currentColor"/><path d="M11 17v-4a2 2 0 0 1 4 0v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="11" y1="10" x2="11" y2="17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;

  const CORE_ROLE_PATTERNS = [
    /faculty advisor|advisor/i,
    /chapter chair|chairperson|president/i,
    /vice chair|vice chairperson|vice president/i,
    /secretary/i,
    /treasurer|joint treasurer/i,
    /technical lead/i,
    /events lead/i,
    /design lead/i,
    /content lead/i,
    /social media lead/i,
    /research lead/i,
  ];

  function safeText(value, fallback = '') {
    const text = String(value ?? '').trim();
    return text || fallback;
  }

  function initials(name) {
    const safeName = safeText(name, 'M');
    return safeName.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'M';
  }

  function isCore(member) {
    const role = safeText(member && member.role, '').toLowerCase();
    return CORE_ROLE_PATTERNS.some(pattern => pattern.test(role));
  }

  function findMemberByRole(members, pattern) {
    return (members || []).find(member => pattern.test(safeText(member && member.role, '').toLowerCase()));
  }

  function fillOrgCard(card, roleLabel, member, fallbackLabel) {
    if (!card) return;
    const roleEl = card.querySelector('.org-role');
    const nameEl = card.querySelector('.org-name');
    const deptEl = card.querySelector('.org-dept');

    if (roleEl) roleEl.textContent = roleLabel;
    if (nameEl) {
      nameEl.textContent = member ? safeText(member.name, fallbackLabel) : fallbackLabel;
      nameEl.classList.toggle('org-name--vacant', !member);
    }
    if (deptEl) {
      deptEl.textContent = member ? safeText(member.batch || member.department || 'Biomedical Engineering') : 'Biomedical Engineering';
    }
  }

  function renderAboutLeadership(members) {
    const chart = document.querySelector('.org-chart');
    if (!chart) return;

    const advisor = findMemberByRole(members, /faculty advisor|advisor/i);
    const chair = findMemberByRole(members, /chapter chair|chairperson|president/i);
    const viceChair = findMemberByRole(members, /vice chair|vice chairperson|vice president/i);
    const secretary = findMemberByRole(members, /secretary/i);
    const treasurer = findMemberByRole(members, /treasurer|joint treasurer/i);

    fillOrgCard(document.querySelector('.org-card--advisor'), 'Faculty Advisor', advisor, 'To be added');
    fillOrgCard(document.querySelector('.org-card--chair'), 'Chapter Chair', chair, 'To be added');

    const rowCards = Array.from(document.querySelectorAll('.org-level--row .org-card'));
    const rowAssignments = [
      { role: 'Vice Chair', member: viceChair },
      { role: 'Secretary', member: secretary },
      { role: 'Treasurer', member: treasurer },
      { role: 'Joint Treasurer', member: null },
    ];

    rowCards.forEach((card, index) => {
      const assignment = rowAssignments[index] || { role: 'Member', member: null };
      fillOrgCard(card, assignment.role, assignment.member, 'To be added');
    });
  }

  function buildCoreCard(member, index) {
    const badgeColors = ['', '--teal', '', '--teal'];
    const badgeClass = `cteam-role-badge${badgeColors[index % 4] || ''}`;
    const name = safeText(member && member.name, 'Member');
    const role = safeText(member && member.role, 'Member');
    const article = document.createElement('article');
    article.className = 'cteam-card';
    article.innerHTML = `
      <div class="cteam-card-top">
        <div class="cteam-avatar-wrap">
          ${member && member.photo ? `<img src="${member.photo}" alt="${name}" class="cteam-avatar-img" />` : ''}
          <div class="cteam-avatar-placeholder" aria-hidden="true">${initials(name)}</div>
        </div>
        <div class="${badgeClass}">${role}</div>
      </div>
      <div class="cteam-card-body">
        <h3 class="cteam-name">${name}</h3>
        <p class="cteam-position">${role}</p>
        ${member && member.batch ? `<p class="cteam-dept">${member.batch}</p>` : ''}
        ${member && member.linkedin ? `<div class="cteam-actions"><a href="${member.linkedin}" target="_blank" rel="noopener" class="cteam-btn cteam-btn--linkedin" aria-label="LinkedIn">${LI_SVG} LinkedIn</a></div>` : ''}
      </div>`;
    return article;
  }

  function buildMemberCard(member) {
    const article = document.createElement('article');
    article.className = 'smem-card';
    const name = safeText(member && member.name, 'Member');
    const role = safeText(member && member.role, 'Member');
    const batch = safeText(member && member.batch, '');
    article.setAttribute('data-search', `${name} ${role} ${batch}`.toLowerCase());
    article.innerHTML = `
      <div class="smem-avatar-wrap">
        ${member && member.photo ? `<img src="${member.photo}" alt="${name}" class="smem-avatar-img" />` : ''}
        <div class="smem-avatar-placeholder" aria-hidden="true">${initials(name)}</div>
      </div>
      <div class="smem-card-body">
        <h3 class="smem-name">${name}</h3>
        <p class="smem-dept">${role}</p>
        ${batch ? `<p class="smem-meta"><span class="smem-year">${batch}</span></p>` : ''}
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
    const aboutLeadership = document.querySelector('.org-chart');

    try {
      const res = await fetch(`${API_BASE}/members`);
      const json = await res.json();
      const members = Array.isArray(json && json.data) ? json.data : (Array.isArray(json) ? json : []);
      const activeMembers = members.filter(member => member && member.active !== false);

      if (aboutLeadership) {
        renderAboutLeadership(activeMembers);
      }

      if (coreGrid) {
        const coreMembers = activeMembers.filter(member => isCore(member));
        if (coreMembers.length) {
          coreGrid.innerHTML = '';
          coreMembers.forEach((member, index) => coreGrid.appendChild(buildCoreCard(member, index)));
        }
      }

      if (memberGrid) {
        const studentMembers = activeMembers.filter(member => !isCore(member));
        memberGrid.innerHTML = '';
        if (studentMembers.length) {
          const cards = studentMembers.map(member => {
            const card = buildMemberCard(member);
            memberGrid.appendChild(card);
            return card;
          });
          initSearch(cards);
        }
      }
    } catch (err) {
      console.error('Failed to load members:', err);
    }
  }

  init();
})();
