/* ================================================================
   home-feed.js — IEEE EMBS KPRIET (index.html only)

   Read-only presentation helpers for Home. featuredEventsService.js,
   faculty-coordinators.js and home-stats.js still own their content;
   this script only:
     • renders a compact "Recently held" list (GET /api/events) beside
       the featured event(s), leaving out whatever is already featured
     • tells the CSS how many featured cards there are, so a single
       featured event is set as a wide feature rather than a lone card
     • marks the achievements / faculty sections as empty while their
       scripts report no content, so they compact into honest strips
   home-experience.js animates the rows it inserts.
   ================================================================ */

(function (win, doc) {
  'use strict';

  var API = win.EMBS_API_BASE;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function q(sel, scope) { return (scope || doc).querySelector(sel); }
  function qa(sel, scope) { return Array.prototype.slice.call((scope || doc).querySelectorAll(sel)); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function plain(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    var d = new Date(s);
    return isNaN(d) ? null : d;
  }

  /* Run fn now and whenever the container's children change */
  function watch(el, fn) {
    if (!el) return;
    new MutationObserver(function () { fn(el); }).observe(el, { childList: true });
    fn(el);
  }

  /* ── featured layout + recently held ─────────────────────────── */

  function featuredTitles() {
    return qa('.activities-grid .act-title').map(function (t) { return plain(t.textContent).toLowerCase(); });
  }

  function onFeatured(grid) {
    var section = grid.closest('.activities');
    var n = qa('.act-card', grid).length;
    if (section) section.setAttribute('data-featured', String(n));
    renderRecent();
  }

  var events = null;

  function renderRecent() {
    var box = doc.getElementById('hxRecent');
    if (!box || !events) return;
    var shown = featuredTitles();
    var rows = events
      .filter(function (e) { return e._d && String(e.status || '').toLowerCase() === 'completed' && shown.indexOf(plain(e.title).toLowerCase()) === -1; })
      .sort(function (a, b) { return b._d - a._d; })
      .slice(0, 4);
    var aside = box.closest('.hx-recent');
    if (!rows.length) { if (aside) aside.hidden = true; return; }
    if (aside) aside.hidden = false;
    var html = rows.map(function (e) {
      var type = plain(e.type);
      return '<li class="hx-row"><a href="event.html?id=' + encodeURIComponent(e._id || '') + '">' +
        '<time datetime="' + e._d.toISOString().slice(0, 10) + '"><b>' + String(e._d.getDate()).padStart(2, '0') + '</b>' + MONTHS[e._d.getMonth()] + '</time>' +
        '<span class="hx-row-main">' +
          (type && type.toLowerCase() !== 'other' ? '<span class="hx-row-type">' + esc(type) + '</span>' : '') +
          '<span class="hx-row-title">' + esc(plain(e.title)) + '</span>' +
        '</span>' +
        '<span class="hx-row-go" aria-hidden="true">&rarr;</span>' +
      '</a></li>';
    }).join('');
    if (box.innerHTML !== html) box.innerHTML = html;
  }

  function loadEvents() {
    if (!API) return;
    fetch(API + '/events').then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      var all = Array.isArray(j) ? j : (j && Array.isArray(j.data) ? j.data : []);
      events = all.filter(function (e) { return e && e.title; });
      events.forEach(function (e) { e._d = parseDate(e.date); });
      renderRecent();
    }).catch(function (err) {
      console.warn('home-feed: events unavailable —', err.message);
      var aside = q('.hx-recent');
      if (aside) aside.hidden = true;
    });
  }

  /* ── honest empty sections ───────────────────────────────────── */

  function emptyWatch(gridSel, cardSel) {
    var grid = q(gridSel);
    if (!grid) return;
    var section = grid.closest('section');
    watch(grid, function (g) {
      var hasCards = !!q(cardSel, g);
      var hasNote = !!q(':scope > p', g);
      section.classList.toggle('is-empty', !hasCards && hasNote);
    });
  }

  function init() {
    watch(q('.activities-grid'), onFeatured);
    emptyWatch('.achievements-grid', '.ach-card');
    emptyWatch('#facultyCoordinatorsGrid', '.fac-card');
    loadEvents();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();

}(window, document));
