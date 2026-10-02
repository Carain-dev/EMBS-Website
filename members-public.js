(function () {
  'use strict';

  const API_BASE = window.EMBS_API_BASE;

  const LI_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="4" stroke="currentColor" stroke-width="1.5"/><line x1="7" y1="10" x2="7" y2="17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="7" cy="7" r="1" fill="currentColor"/><path d="M11 17v-4a2 2 0 0 1 4 0v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="11" y1="10" x2="11" y2="17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;

  /* ═══════════════════════════════════════════════════════════════════════
     ORG CHART ROLE MAPPING
     Each slot has an ordered list of exact-string matches (tried first,
     case-insensitive) then a regex fallback.  Exact strings correspond to
     the option values in the admin Position dropdown so an admin picks the
     right role and it reliably maps to the right slot with no code changes.
  ═══════════════════════════════════════════════════════════════════════ */
  const ORG_SLOTS = {
    advisor: {
      exact: ['faculty advisor', 'faculty in-charge', 'faculty incharge',
              'faculty co-ordinator', 'faculty coordinator', 'advisor', 'faculty'],
      regex: /faculty\s*advisor|faculty\s*in.?charge|faculty\s*co.?ordinator|faculty\s*member|advisor/i,
    },
    chair: {
      exact: ['chapter chair', 'chairperson', 'chair', 'president'],
      regex: /chapter\s*chair|chairperson|^chair$|president/i,
    },
    viceChair: {
      exact: ['vice chair', 'vice chairperson', 'vice president'],
      regex: /vice\s*chair|vice\s*chairperson|vice\s*president/i,
    },
    secretary: {
      exact: ['secretary'],
      regex: /\bsecretary\b/i,
    },
    treasurer: {
      /* Must NOT match "Joint Treasurer" — test exact first, then regex. */
      exact: ['treasurer'],
      regex: /^treasurer$/i,
    },
    jointTreasurer: {
      exact: ['joint treasurer'],
      regex: /joint\s*treasurer/i,
    },
  };

  /**
   * Match a member's role string to an org slot key.
   * Exact (lowercase) match is tried before the regex fallback.
   * Returns the slot key string or null if no slot matches.
   */
  function matchSlot(role) {
    if (!role) return null;
    const lower = role.trim().toLowerCase();
    for (const [key, cfg] of Object.entries(ORG_SLOTS)) {
      if (cfg.exact.includes(lower)) return key;
    }
    for (const [key, cfg] of Object.entries(ORG_SLOTS)) {
      if (cfg.regex.test(role)) return key;
    }
    return null;
  }

  /* ─── Helpers ─────────────────────────────────────────────────────── */

  function safeText(value, fallback) {
    if (fallback === undefined) fallback = '';
    const text = String(value != null ? value : '').trim();
    return text || fallback;
  }

  function initials(name) {
    const safeName = safeText(name, 'M');
    return safeName.split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase() || 'M';
  }

  /* ═══════════════════════════════════════════════════════════════════════
     ORG CHART DOM RENDERER
     Fills the fixed card slots already present in about.html.
     Does NOT rebuild the structure — only replaces text/image content
     inside existing cards.  All CSS classes and connector divs are kept
     exactly as authored.
  ═══════════════════════════════════════════════════════════════════════ */

  function fillOrgCard(cardEl, member) {
    if (!cardEl) return;

    const nameEl = cardEl.querySelector('.org-name');
    const deptEl = cardEl.querySelector('.org-dept');

    if (nameEl) {
      nameEl.textContent = member ? safeText(member.name, 'To be added') : 'To be added';
      nameEl.classList.toggle('org-name--vacant', !member);
    }

    if (deptEl) {
      deptEl.textContent = member ? safeText(member.batch || member.department, '') : '';
      deptEl.style.display = (member && deptEl.textContent) ? '' : 'none';
    }

    /* Inject a profile photo if the member has one and no img already exists */
    if (member && member.photo) {
      var imgEl = cardEl.querySelector('.org-photo');
      if (!imgEl) {
        imgEl = document.createElement('img');
        imgEl.className = 'org-photo';
        imgEl.alt       = safeText(member.name);
        imgEl.style.cssText =
          'width:48px;height:48px;border-radius:50%;object-fit:cover;' +
          'margin-bottom:6px;border:2px solid rgba(107,45,139,0.35);display:block;';
        cardEl.insertBefore(imgEl, cardEl.firstChild);
      }
      imgEl.src = member.photo;
    }
  }

  /* Fixed canonical labels for each slot (displayed in .org-role spans) */
  var SLOT_LABELS = {
    advisor:        'Faculty Advisor',
    chair:          'Chapter Chair',
    viceChair:      'Vice Chair',
    secretary:      'Secretary',
    treasurer:      'Treasurer',
    jointTreasurer: 'Joint Treasurer',
  };

  function renderAboutLeadership(orgMembers) {
    var chart = document.querySelector('.org-chart');
    if (!chart) return;

    /* Build slot → member map (lower order wins for duplicate slot matches) */
    var slotMap = {};
    for (var i = 0; i < orgMembers.length; i++) {
      var m    = orgMembers[i];
      var slot = matchSlot(m.role);
      if (!slot) continue;
      var prev = slotMap[slot];
      if (!prev || (m.order != null ? m.order : 999) < (prev.order != null ? prev.order : 999)) {
        slotMap[slot] = m;
      }
    }

    /* Fill the two named cards */
    fillOrgCard(chart.querySelector('.org-card--advisor'), slotMap.advisor       || null);
    fillOrgCard(chart.querySelector('.org-card--chair'),   slotMap.chair         || null);

    /* Fill the two row groups:
         .org-level--row[0]: Vice Chair (card 0) + Secretary (card 1)
         .org-level--row[1]: Treasurer  (card 0) + Joint Treasurer (card 1) */
    var rowLevels = chart.querySelectorAll('.org-level--row');
    var rowSlotGroups = [
      ['viceChair', 'secretary'],
      ['treasurer', 'jointTreasurer'],
    ];

    for (var r = 0; r < rowLevels.length; r++) {
      var cards = rowLevels[r].querySelectorAll('.org-card');
      var group = rowSlotGroups[r];
      if (!group) continue;
      for (var c = 0; c < cards.length; c++) {
        var slotKey = group[c];
        if (!slotKey) continue;
        fillOrgCard(cards[c], slotMap[slotKey] || null);

        /* Ensure the canonical role label is always shown (never stale) */
        var roleSpan = cards[c].querySelector('.org-role');
        if (roleSpan) roleSpan.textContent = SLOT_LABELS[slotKey];
      }
    }

    /* Also update named-card role labels */
    var advisorRoleEl = chart.querySelector('.org-card--advisor .org-role');
    var chairRoleEl   = chart.querySelector('.org-card--chair .org-role');
    if (advisorRoleEl) advisorRoleEl.textContent = SLOT_LABELS.advisor;
    if (chairRoleEl)   chairRoleEl.textContent   = SLOT_LABELS.chair;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     MEMBER DIRECTORY (members.html, about.html core/student grids)
  ═══════════════════════════════════════════════════════════════════════ */

  var CORE_ROLE_PATTERNS = [
    /^faculty advisor$|^faculty in-?charge$|^faculty co-?ordinator$/i,
    /chapter chair|chairperson|president/i,
    /vice chair|vice chairperson|vice president/i,
    /^secretary$/i,
    /^treasurer$|^joint treasurer$/i,
    /technical lead/i,
    /events lead|event coordinator lead/i,
    /design lead|designer lead/i,
    /content lead/i,
    /social media lead|social media in-?charge/i,
    /research lead/i,
    /^proposal lead$|^public relations officer$|^excom lead$/i,
    /^community service officer$|^outreach officer$/i,
    /^member service coordinator$|^international relations officer$/i,
    /^documentation designer$|^excom member$|^technical$/i,
  ];

  function isCore(member) {
    /* Faculty advisor/coordinator flags take priority — never treat these as core */
    if (member && (member.isFacultyAdvisor || member.isFacultyCoordinator)) return false;
    var role = safeText(member && member.role, '').toLowerCase().trim();
    return CORE_ROLE_PATTERNS.some(function (p) { return p.test(role); });
  }

  function buildCoreCard(member, index) {
    var badgeColors = ['', '--teal', '', '--teal'];
    var badgeClass  = 'cteam-role-badge' + (badgeColors[index % 4] || '');
    var name  = safeText(member && member.name, 'Member');
    var role  = safeText(member && member.role, 'Member');
    var article = document.createElement('article');
    article.className = 'cteam-card';
    article.innerHTML = '\n' +
      '      <div class="cteam-card-top">\n' +
      '        <div class="cteam-avatar-wrap">\n' +
      (member && member.photo ? '          <img src="' + member.photo + '" alt="' + name + '" class="cteam-avatar-img" />\n' : '') +
      '          <div class="cteam-avatar-placeholder" aria-hidden="true">' + initials(name) + '</div>\n' +
      '        </div>\n' +
      '        <div class="' + badgeClass + '">' + role + '</div>\n' +
      '      </div>\n' +
      '      <div class="cteam-card-body">\n' +
      '        <h3 class="cteam-name">' + name + '</h3>\n' +
      '        <p class="cteam-position">' + role + '</p>\n' +
      (member && member.batch ? '        <p class="cteam-dept">' + member.batch + '</p>\n' : '') +
      (member && member.linkedin
        ? '        <div class="cteam-actions"><a href="' + member.linkedin + '" target="_blank" rel="noopener" class="cteam-btn cteam-btn--linkedin" aria-label="LinkedIn">' + LI_SVG + ' LinkedIn</a></div>\n'
        : '') +
      '      </div>';
    return article;
  }

  function buildMemberCard(member) {
    var article = document.createElement('article');
    article.className = 'smem-card';
    var id    = member && member._id ? String(member._id) : '';
    var name  = safeText(member && member.name, 'Member');
    var role  = safeText(member && member.role, 'Member');
    var batch = safeText(member && member.batch, '');

    /* data-search covers every visible text field */
    article.setAttribute('data-search', (name + ' ' + role + ' ' + batch).toLowerCase());
    /* store id for profile link */
    article.setAttribute('data-id', id);

    var PROFILE_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    article.innerHTML =
      '<div class="smem-avatar-wrap">' +
        (member && member.photo ? '<img src="' + member.photo + '" alt="' + name + '" class="smem-avatar-img" />' : '') +
        '<div class="smem-avatar-placeholder" aria-hidden="true">' + initials(name) + '</div>' +
      '</div>' +
      '<div class="smem-card-body">' +
        '<h3 class="smem-name">' + name + '</h3>' +
        '<p class="smem-dept">' + role + '</p>' +
        (batch ? '<p class="smem-meta"><span class="smem-year">' + batch + '</span></p>' : '') +
        (id
          ? '<a href="student-profile.html?id=' + id + '" class="smem-connect-btn" aria-label="View profile of ' + name + '">' + PROFILE_SVG + ' View Profile</a>'
          : '') +
      '</div>';
    return article;
  }

  function initSearch(cards) {
    var searchInput = document.getElementById('memberSearch');
    var deptSel     = document.getElementById('deptFilter');
    var yearSel     = document.getElementById('yearFilter');
    var emptyState  = document.getElementById('memberEmpty');
    if (!searchInput) return;

    function applyFilters() {
      var q    = searchInput.value.trim().toLowerCase();
      var dept = deptSel ? deptSel.value : 'all';
      var year = yearSel ? yearSel.value : 'all';
      var visible = 0;

      cards.forEach(function (card) {
        /* data-search = name + role + batch (all lowercased) */
        var searchText = (card.getAttribute('data-search') || '');
        /* data-batch   = batch field lowercased (set in init after build) */
        var batchText  = (card.getAttribute('data-batch')  || '').toLowerCase();
        /* data-dept    = department name lowercased (set in init after build) */
        var deptText   = (card.getAttribute('data-dept')   || '').toLowerCase();

        /* ── Text search: name, role, batch, department ── */
        var matchSearch = !q
          || searchText.includes(q)
          || deptText.includes(q);

        /* ── Department filter ──
           Option values are full department name strings (e.g. "Biomedical Engineering").
           We normalise both sides to lowercase for comparison. */
        var matchDept = (dept === 'all')
          || deptText.includes(dept.toLowerCase())
          || searchText.includes(dept.toLowerCase());

        /* ── Year/batch filter ──
           Option values: "1st Year", "2nd Year", "3rd Year", "4th Year", "Alumni"
           batchText is already lowercase so compare case-insensitively. */
        var matchYear = (year === 'all')
          || batchText.includes(year.toLowerCase());

        var show = matchSearch && matchDept && matchYear;
        card.classList.toggle('hidden', !show);
        if (show) visible++;
      });

      if (emptyState) {
        emptyState.classList.toggle('visible', visible === 0);
      }
    }

    searchInput.addEventListener('input', applyFilters);
    if (deptSel) deptSel.addEventListener('change', applyFilters);
    if (yearSel) yearSel.addEventListener('change', applyFilters);
  }

  /* Back-to-top button */
  var backToTop = document.getElementById('backToTop');
  if (backToTop) {
    window.addEventListener('scroll', function () {
      backToTop.classList.toggle('visible', window.scrollY > 400);
    });
    backToTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════
     INIT
  ═══════════════════════════════════════════════════════════════════════ */

  /* ── Faculty Advisor card builder ── */
  var EMAIL_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" stroke-width="1.5"/><path d="M2 7l10 7 10-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

  /* Role → badge colour class: "Faculty Advisor" gets the purple default,
     "Co-Advisor" and others get teal.  Matches the existing CSS. */
  function fadRoleTagClass(role) {
    if (!role) return 'fac-adv-role-tag';
    var r = role.toLowerCase();
    if (r === 'faculty advisor') return 'fac-adv-role-tag';
    return 'fac-adv-role-tag fac-adv-role-tag--teal';
  }

  function buildFacAdvCard(member) {
    var name   = safeText(member.name,    'Faculty Member');
    var role   = safeText(member.role,    'Faculty Advisor');
    var desig  = safeText(member.batch,   '');   /* batch stores designation */
    var dept   = safeText(member.linkedin,'');   /* linkedin stores department */
    var bio    = safeText(member.bio,     '');
    var email  = safeText(member.email,   '');
    var inits  = initials(name);

    var photoHTML = member.photo
      ? '<img src="' + member.photo + '" alt="' + name + '" class="fac-adv-avatar-img" />'
      : '';

    var deptLine  = dept  ? '<p class="fac-adv-dept">' + dept  + '</p>' : '';
    var bioBlock  = bio   ? '<p class="fac-adv-research"><span class="fac-adv-research-label">Research Area</span>' + bio + '</p>' : '';
    var emailBtn  = email ? '<div class="fac-adv-actions"><a href="mailto:' + email + '" class="fac-adv-btn fac-adv-btn--email">' + EMAIL_SVG + ' Email</a></div>' : '';

    var article = document.createElement('article');
    article.className = 'fac-adv-card';
    article.innerHTML =
      '<div class="fac-adv-card-left">' +
        '<div class="fac-adv-avatar-wrap">' +
          photoHTML +
          '<div class="fac-adv-avatar-placeholder" aria-hidden="true">' + inits + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="fac-adv-card-body">' +
        '<span class="' + fadRoleTagClass(role) + '">' + role + '</span>' +
        '<h3 class="fac-adv-name">' + name + '</h3>' +
        (desig ? '<p class="fac-adv-designation">' + desig + '</p>' : '') +
        deptLine +
        bioBlock +
        emailBtn +
      '</div>';
    return article;
  }

  /* ── Load + render Faculty Advisors section ── */
  async function loadFacultyAdvisors() {
    var grid    = document.getElementById('facAdvGrid');
    var loading = document.getElementById('facAdvLoading');
    var empty   = document.getElementById('facAdvEmpty');
    if (!grid) return;   /* not on members.html — skip silently */

    try {
      var res  = await fetch(API_BASE + '/members?advisor=true');
      var json = await res.json();
      var advisors = Array.isArray(json && json.data) ? json.data
                   : Array.isArray(json) ? json : [];

      /* Remove loading spinner */
      if (loading) loading.style.display = 'none';

      if (!advisors.length) {
        grid.innerHTML = '';
        if (empty) empty.style.display = 'flex';
        return;
      }

      if (empty) empty.style.display = 'none';

      /* Sort by display order then render */
      advisors.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      grid.innerHTML = '';
      advisors.forEach(function (m) {
        grid.appendChild(buildFacAdvCard(m));
      });
    } catch (err) {
      /* Network failure — hide spinner, show empty state rather than broken UI */
      console.warn('Faculty advisors: could not load —', err.message);
      if (loading) loading.style.display = 'none';
      if (empty)   empty.style.display   = 'flex';
    }
  }

  async function init() {
    var coreGrid        = document.querySelector('.cteam-grid');
    var memberGrid      = document.getElementById('memberGrid');
    var aboutLeadership = document.querySelector('.org-chart');

    /* ── Org Chart (?orgchart=true returns only inOrgChart members) ── */
    if (aboutLeadership) {
      try {
        var res  = await fetch(API_BASE + '/members?orgchart=true');
        var json = await res.json();
        var orgMembers = Array.isArray(json && json.data) ? json.data
                       : Array.isArray(json) ? json : [];
        renderAboutLeadership(orgMembers);
      } catch (err) {
        /* API failure: keep the existing DOM as-is (shows "To be added").
           Do NOT throw — the rest of the page must still work. */
        console.warn('Org chart: could not load members —', err.message);
      }
    }

    /* ── Member directory cards (members.html, about.html) ── */
    if (coreGrid || memberGrid) {
      try {
        var res2  = await fetch(API_BASE + '/members');
        var json2 = await res2.json();
        var members = Array.isArray(json2 && json2.data) ? json2.data
                    : Array.isArray(json2) ? json2 : [];
        var activeMembers = members.filter(function (m) { return m && m.active !== false; });

        if (coreGrid) {
          var coreMembers = activeMembers.filter(function (m) { return isCore(m); });
          if (coreMembers.length) {
            coreGrid.innerHTML = '';
            coreMembers.forEach(function (m, i) { coreGrid.appendChild(buildCoreCard(m, i)); });
          }
        }

        if (memberGrid) {
          /* Exclude core roles AND faculty advisors from the student directory */
          var studentMembers = activeMembers.filter(function (m) {
            return !isCore(m) && !m.isFacultyAdvisor && !m.isFacultyCoordinator;
          });
          memberGrid.innerHTML = '';
          if (studentMembers.length) {
            var cards = studentMembers.map(function (m) {
              var card = buildMemberCard(m);
              /* data-batch: batch field (year label) for year filter */
              card.setAttribute('data-batch', (m.batch || '').toLowerCase());
              /* data-dept: Member schema has no dept field for students.
                 We store empty string — dept filter will only fire on 'all'.
                 If a future schema adds department, update this line. */
              card.setAttribute('data-dept', '');
              memberGrid.appendChild(card);
              return card;
            });
            initSearch(cards);
          } else {
            /* No students — show empty state immediately */
            var emptyState = document.getElementById('memberEmpty');
            if (emptyState) emptyState.classList.add('visible');
          }
        }
      } catch (err) {
        console.error('Members directory: could not load members —', err.message);
      }
    }

    /* ── Faculty Advisors section (?advisor=true, members.html only) ── */
    await loadFacultyAdvisors();
  }

  init();

})();
