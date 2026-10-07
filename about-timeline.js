(function () {
  'use strict';

  /* Fetch visible timeline entries and render them into the existing
     .timeline container in about.html.

     Design constraints preserved:
       - .timeline-entry  wrapper
       - .timeline-left / .timeline-year
       - .timeline-dot / .timeline-dot--active  (last entry gets --active)
       - .timeline-right / .timeline-entry-title / .timeline-entry-desc
     All CSS, connectors, and layout remain untouched.                   */

  var API_BASE = window.EMBS_API_BASE;

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

  function buildEntry(entry, isLast) {
    var div = document.createElement('div');
    div.className = 'timeline-entry';
    div.innerHTML =
      '<div class="timeline-left">' +
        '<span class="timeline-year">' + esc(entry.year) + '</span>' +
      '</div>' +
      '<div class="timeline-dot' + (isLast ? ' timeline-dot--active' : '') + '"></div>' +
      '<div class="timeline-right">' +
        '<h4 class="timeline-entry-title">' + esc(entry.title) + '</h4>' +
        (entry.description
          ? '<p class="timeline-entry-desc">' + esc(entry.description) + '</p>'
          : '') +
      '</div>';
    return div;
  }

  async function init() {
    var container = document.getElementById('timelineContainer');
    if (!container || !API_BASE) return;

    try {
      var res  = await fetch(API_BASE + '/timeline');
      var json = await res.json();
      var entries = Array.isArray(json && json.data) ? json.data
                  : Array.isArray(json) ? json : [];

      if (!entries.length) {
        /* No entries: show a subtle empty state. The section heading and
           layout box remain visible; only the inner list is affected.   */
        container.innerHTML =
          '<p style="color:var(--text-muted,#9ba4c0);font-size:0.85rem;' +
          'padding:1.5rem 0;text-align:center;">No timeline entries yet.</p>';
        return;
      }

      container.innerHTML = '';
      entries.forEach(function (entry, i) {
        container.appendChild(buildEntry(entry, i === entries.length - 1));
      });

    } catch (err) {
      /* API failure: do NOT crash the rest of the About page.
         Leave the container empty rather than showing broken content. */
      console.warn('Chapter timeline: could not load entries —', err.message);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
