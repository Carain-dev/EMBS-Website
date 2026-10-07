(function () {
  'use strict';

  /* Renders the chapter's faculty advisors into #abFacultyGrid on the
     About page, from the existing public endpoint
       GET /api/members?advisor=true
     (the same data members.html already shows).

     Each advisor becomes a portrait figure:
       .ab-portrait        wrapper
       .ab-portrait-media  photo, or a typographic monogram if no photo
       .ab-portrait-name / .ab-portrait-role / .ab-portrait-meta

     No data → the faculty block is hidden; the rest of the People
     section (student leadership) is unaffected. Read-only.          */

  var API_BASE = window.EMBS_API_BASE;

  function text(v) { return String(v == null ? '' : v).trim(); }

  function esc(s) {
    return text(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* "Dr. ALLWYN GNANADAS A" → "Dr. Allwyn Gnanadas A" (display only) */
  function displayName(name) {
    return text(name).split(/\s+/).map(function (w) {
      if (/^[A-Z]{2,}$/.test(w)) return w.charAt(0) + w.slice(1).toLowerCase();
      return w;
    }).join(' ');
  }

  function initials(name) {
    var parts = text(name).replace(/^(dr|mr|mrs|ms|prof)\.?\s+/i, '').split(/\s+/).filter(Boolean);
    return (parts.slice(0, 2).map(function (w) { return w.charAt(0); }).join('') || 'F').toUpperCase();
  }

  function build(m, i) {
    var name = displayName(m.name);
    var fig = document.createElement('figure');
    fig.className = 'ab-portrait';
    fig.style.setProperty('--i', i);
    fig.innerHTML =
      '<div class="ab-portrait-media">' +
        (m.photo
          ? '<img src="' + esc(m.photo) + '" alt="' + esc(name) + '" loading="lazy" />'
          : '<span class="ab-portrait-mono" aria-hidden="true">' + esc(initials(m.name)) + '</span>') +
      '</div>' +
      '<figcaption>' +
        '<span class="ab-portrait-role">' + esc(m.role || 'Faculty Advisor') + '</span>' +
        '<span class="ab-portrait-name">' + esc(name) + '</span>' +
        (text(m.batch) ? '<span class="ab-portrait-meta">' + esc(m.batch) + '</span>' : '') +
      '</figcaption>';
    return fig;
  }

  async function init() {
    var grid = document.getElementById('abFacultyGrid');
    var block = document.getElementById('abFaculty');
    if (!grid || !API_BASE) return;

    try {
      var res = await fetch(API_BASE + '/members?advisor=true');
      var json = await res.json();
      var list = Array.isArray(json && json.data) ? json.data : Array.isArray(json) ? json : [];
      list = list.filter(function (m) { return m && m.active !== false; })
                 .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });

      if (!list.length) {
        if (block) block.hidden = true;
        return;
      }
      grid.innerHTML = '';
      list.forEach(function (m, i) { grid.appendChild(build(m, i)); });
      if (block) block.classList.add('has-faculty');
    } catch (err) {
      console.warn('about-people: could not load faculty advisors —', err.message);
      if (block) block.hidden = true;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
