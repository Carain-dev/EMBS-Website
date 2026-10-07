/* ================================================================
   blog-experience.js — IEEE EMBS KPRIET (blog.html only)

   Presentation layer for Blog & Articles. blog.js still owns the
   articles (fetch, render, category filters); this script only:
     • writes today's date into the masthead dateline
     • builds the contents list from the page's own category chips and
       shows it while blog.js reports that nothing is published
     • counts the stories and inserts one typographic break after the
       third (decoration only — blog.js filters its own card list)
     • underlines the knowledge-break words when they are reached
   Motion: motion.js reveals the stories; animations.js the headings.
   ================================================================ */

(function (win, doc) {
  'use strict';

  var K = win.EMBSKit;
  if (!K) return;
  var q = K.q, qa = K.qa;

  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function dateline() {
    var t = doc.getElementById('bgxToday');
    if (!t) return;
    var d = new Date();
    t.setAttribute('datetime', K.dateParts(d).iso);
    t.textContent = DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS_FULL[d.getMonth()] + ' ' + d.getFullYear();
  }

  function contents() {
    var toc = doc.getElementById('bgxToc');
    if (!toc) return;
    var chips = qa('.blog-filters .filter-chip').filter(function (c) { return c.getAttribute('data-filter') !== 'all'; });
    toc.innerHTML = chips.map(function (c, i) {
      return '<li><span>' + String(i + 1).padStart(2, '0') + '</span>' + K.esc(K.plain(c.textContent)) + '</li>';
    }).join('');
  }

  function onStories(grid) {
    var section = doc.getElementById('bgxStories');
    var cards = qa('.blog-card', grid);
    var msg = q(':scope > .embs-empty:not([hidden])', grid);
    var loading = msg && /loading/i.test(msg.textContent);
    var empty = !cards.length && msg && !loading;
    section.classList.toggle('is-empty', !!empty);

    var count = doc.getElementById('bgxCount');
    if (count) count.textContent = cards.length ? cards.length + (cards.length === 1 ? ' article' : ' articles') : '';

    if (cards.length > 3 && !q('.bgx-interlude', grid)) {
      var br = doc.createElement('p');
      br.className = 'bgx-interlude';
      br.setAttribute('aria-hidden', 'true');
      br.textContent = 'More from the chapter';
      grid.insertBefore(br, cards[3]);
    }
    if (empty) K.reveal(qa('.bgx-contents > *, .bgx-toc li'), 'fade');
  }

  function underline() {
    var quote = q('.bgx-quote');
    if (!quote) return;
    if (!('IntersectionObserver' in win) || K.reduced()) { quote.classList.add('is-in'); return; }
    var io = new IntersectionObserver(function (en) {
      if (en[0].isIntersecting) { quote.classList.add('is-in'); io.disconnect(); }
    }, { threshold: 0.5 });
    io.observe(quote);
  }

  K.ready(function () {
    K.progress();
    K.magnetic(doc);
    dateline();
    contents();
    underline();
    var grid = doc.getElementById('articlesGrid');
    K.onRender(grid, onStories);
    if (win.EMBSMotion) win.EMBSMotion.watch(grid, '.blog-card', { variant: 'fade' });
  });

}(window, document));
