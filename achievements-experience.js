/* ================================================================
   achievements-experience.js — IEEE EMBS KPRIET (achievements.html)

   Presentation layer for Achievements. achievements-public.js still
   owns the records (fetch, render, category filters, figures); this
   script only:
     • releases the sample-card hold once that script has rendered
     • marks the record as empty while nothing is published
     • hides the figures band while every figure is zero, and draws
       each category's share of the total once there are records
   Motion: motion.js reveals the records; animations.js the headings.
   ================================================================ */

(function (win, doc) {
  'use strict';

  var K = win.EMBSKit;
  var root = doc.documentElement;
  if (!K) { root.classList.remove('akx-pending'); return; }
  var q = K.q, qa = K.qa;

  function onRecord(grid) {
    var section = grid.closest('section');
    var cards = qa('.ach-card', grid);
    var note = q(':scope > .embs-empty', grid);
    /* the first render replaces the markup's sample cards */
    if (note || grid._akxSeen) root.classList.remove('akx-pending');
    grid._akxSeen = true;
    section.classList.toggle('is-empty', !cards.length && !!note);
  }

  var IDS = ['achStatTotal', 'achStatPublications', 'achStatCompetitions', 'achStatAwards'];

  function figures() {
    var section = q('.ach-stats-section');
    if (!section) return;
    var vals = IDS.map(function (id) {
      var el = doc.getElementById(id);
      var n = el ? parseInt(el.textContent, 10) : NaN;
      return isNaN(n) ? null : n;
    });
    if (vals[0] === null) return;                 /* still loading */
    section.classList.toggle('is-zero', vals[0] === 0);
    IDS.forEach(function (id, i) {
      var el = doc.getElementById(id);
      var card = el && el.closest('.ach-stat-card');
      if (!card) return;
      var bar = q('.akx-bar', card);
      if (!bar) {
        bar = doc.createElement('span');
        bar.className = 'akx-bar';
        bar.setAttribute('aria-hidden', 'true');
        bar.innerHTML = '<i></i>';
        card.appendChild(bar);
      }
      var p = vals[0] ? (vals[i] || 0) / vals[0] : 0;
      bar.style.setProperty('--p', Math.max(0, Math.min(1, p)).toFixed(3));
    });
  }

  K.ready(function () {
    K.progress();
    K.magnetic(doc);
    var grid = q('.ach-cards-grid');
    K.onRender(grid, onRecord);
    if (win.EMBSMotion) win.EMBSMotion.watch(grid, '.ach-card', { variant: 'fade' });
    var total = doc.getElementById('achStatTotal');
    if (total) new MutationObserver(figures).observe(total, { childList: true, characterData: true, subtree: true });
    figures();
  });

}(window, document));
