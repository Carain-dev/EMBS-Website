/* ================================================================
   announcements-experience.js — IEEE EMBS KPRIET (announcements.html)

   Presentation layer for Announcements. announcements-public.js still
   owns the notices, the category filters and the pinned bulletin;
   this script only:
     • fills the hero's live board (today's date, open notices, time
       left on each) — read-only from GET /api/announcements, applying
       the same "not yet expired" rule announcements-public.js uses
     • adds a category + posting stamp to each rendered notice
     • releases the sample-bulletin hold once the real one is in
   Motion: motion.js reveals the notices; animations.js the headings.
   ================================================================ */

(function (win, doc) {
  'use strict';

  var K = win.EMBSKit;
  var root = doc.documentElement;
  if (!K) { root.classList.remove('anx-pending'); return; }
  var q = K.q, qa = K.qa, esc = K.esc;

  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function today() {
    var el = doc.getElementById('anxToday');
    if (!el) return;
    var d = new Date();
    el.textContent = DAYS[d.getDay()] + ' · ' + K.dateParts(d).full;
  }

  function leftLabel(ms) {
    var days = Math.ceil(ms / 86400000);
    if (days <= 0) return 'Closes today';
    if (days === 1) return '1 day left';
    return days + ' days left';
  }

  function board(items) {
    var countEl = doc.getElementById('anxCount');
    var list = doc.getElementById('anxList');
    if (!countEl || !list) return;
    var now = Date.now();
    countEl.textContent = String(items.length);
    var label = q('.anx-board-count span');
    if (label) label.textContent = items.length === 1 ? 'notice open' : 'notices open';
    if (!items.length) {
      list.innerHTML = '<li><p class="anx-board-empty">No notices are open right now.</p></li>';
      return;
    }
    var withDeadline = items.filter(function (i) { return i.expiresAt; })
      .sort(function (a, b) { return new Date(a.expiresAt) - new Date(b.expiresAt); });
    var rest = items.filter(function (i) { return !i.expiresAt; });
    list.innerHTML = withDeadline.concat(rest).slice(0, 4).map(function (i) {
      var html = '<li class="anx-board-item"><a href="#announcement-cards"><span class="anx-board-row">' +
        '<span class="anx-board-title">' + esc(K.excerpt(i.title, 60)) + '</span>';
      if (i.expiresAt) {
        var end = new Date(i.expiresAt).getTime();
        var start = new Date(i.createdAt || now).getTime();
        var ms = end - now;
        var p = end > start ? (now - start) / (end - start) : 1;
        var soon = ms < 3 * 86400000;
        html = html.replace('anx-board-item"', 'anx-board-item' + (soon ? ' is-soon' : '') + '"');
        html += '<span class="anx-board-left">' + esc(leftLabel(ms)) + '</span></span>' +
          '<span class="anx-meter" aria-hidden="true"><i style="--p:' + Math.max(0, Math.min(1, p)).toFixed(3) + '"></i></span>';
      } else {
        html += '<span class="anx-board-left">Open</span></span>';
      }
      return html + '</a></li>';
    }).join('');
  }

  function stamp(grid) {
    qa('.ann-card', grid).forEach(function (card) {
      if (card._anx) return;
      card._anx = true;
      var body = q('.ann-card-body', card);
      var badge = q('.ann-card-badge', card);
      if (!body) return;
      var s = doc.createElement('span');
      s.className = 'anx-stamp';
      s.textContent = badge ? K.plain(badge.textContent) : 'Announcement';
      body.insertBefore(s, body.firstChild);
    });
  }

  /* the bulletin is real once its text has changed, or it is hidden */
  function watchBulletin() {
    var sec = doc.getElementById('featured-notice');
    var title = sec && q('.ann-featured-title', sec);
    if (!title) { root.classList.remove('anx-pending'); return; }
    var initial = title.textContent;
    var done = function () { root.classList.remove('anx-pending'); };
    new MutationObserver(function () { if (title.textContent !== initial) done(); })
      .observe(title, { childList: true, characterData: true, subtree: true });
    new MutationObserver(function () { if (sec.style.display === 'none') done(); })
      .observe(sec, { attributes: true, attributeFilter: ['style'] });
    var grid = q('.ann-cards-grid');
    if (grid) new MutationObserver(function () { if (q('.embs-empty', grid)) done(); })
      .observe(grid, { childList: true });
  }

  function load() {
    K.list('/announcements').then(function (items) {
      var now = new Date();
      items = items.filter(function (i) { return i && i.title && (!i.expiresAt || new Date(i.expiresAt) > now); });
      board(items);
    }).catch(function (err) {
      console.warn('announcements-experience: board unavailable —', err.message);
      var list = doc.getElementById('anxList');
      if (list) list.innerHTML = '<li><p class="anx-board-empty">The board could not be loaded right now.</p></li>';
    });
  }

  K.ready(function () {
    K.progress();
    K.magnetic(doc);
    today();
    watchBulletin();
    var grid = q('.ann-cards-grid');
    K.onRender(grid, stamp);
    if (win.EMBSMotion) win.EMBSMotion.watch(grid, '.ann-card', { variant: 'fade' });
    load();
  });

}(window, document));
