/* ================================================================
   projects-experience.js — IEEE EMBS KPRIET (projects.html only)

   Presentation layer for Projects & Research. projects.js still owns
   the project cards (fetch, render, category filters); this script:
     • releases the sample-card hold once projects.js has rendered
     • adds a spec code (P—01…) to each rendered card and marks the
       first as the case study (decoration only)
     • fills, read-only from GET /api/projects, the hero index and the
       status pipeline — using the same selection projects.js shows
     • lets CSS draw the signal schematic when it is reached
   Motion: motion.js reveals the cards; animations.js the headings.
   ================================================================ */

(function (win, doc) {
  'use strict';

  var K = win.EMBSKit;
  if (!K) { doc.documentElement.classList.remove('prx-pending'); return; }
  var q = K.q, qa = K.qa;

  /* the statuses projects.js styles; anything else reads as ongoing there */
  function stageOf(p) {
    var s = String(p.status || '').toLowerCase();
    return s === 'completed' || s === 'published' ? s : 'ongoing';
  }

  function categoryOf(p) {
    if (p.category) return p.category;
    return Array.isArray(p.tags) && p.tags.length ? p.tags[0] : '';
  }

  function tagCards(grid) {
    var cards = qa('.proj-card', grid);
    /* the first render from projects.js replaces the sample markup */
    if (grid._prxFirst === undefined) grid._prxFirst = true;
    else doc.documentElement.classList.remove('prx-pending');
    if (q('.embs-empty', grid)) doc.documentElement.classList.remove('prx-pending');
    cards.forEach(function (card, i) {
      if (card._prx || card.parentNode !== grid) return;
      card._prx = true;
      var body = q('.proj-card-body', card);
      if (!body) return;
      var code = doc.createElement('span');
      code.className = 'prx-code';
      code.setAttribute('aria-hidden', 'true');
      code.textContent = 'P—' + String(i + 1).padStart(2, '0') + (i === 0 ? '  ·  Case study' : '');
      body.insertBefore(code, body.firstChild);
    });
  }

  function load() {
    K.list('/projects').then(function (ps) {
      ps = ps.filter(function (p) { return p && p.featured && p.visibility !== 'hidden'; });
      var fields = {};
      var stages = { ongoing: 0, completed: 0, published: 0 };
      ps.forEach(function (p) {
        var c = K.plain(categoryOf(p)).toLowerCase();
        if (c) fields[c] = true;
        stages[stageOf(p)]++;
      });
      var set = function (k, v) { var el = q('[data-prx="' + k + '"]'); if (el) el.textContent = v; };
      set('total', String(ps.length));
      set('fields', String(Object.keys(fields).length));
      set('ongoing', String(stages.ongoing));
      qa('#prxFlow li').forEach(function (li) {
        var n = stages[li.getAttribute('data-stage')] || 0;
        q('.prx-flow-n', li).textContent = String(n);
        li.classList.toggle('has-items', n > 0);
      });
    }).catch(function (err) {
      console.warn('projects-experience: projects unavailable —', err.message);
      var p = q('.prx-pipeline'); if (p) p.hidden = true;
    });
  }

  function drawSignal() {
    var sys = doc.getElementById('prxSystem');
    if (!sys) return;
    qa('.prx-wave-path, .prx-wave-edge', sys).forEach(function (s) {
      try { s.style.setProperty('--len', Math.ceil(s.getTotalLength() * 1.6)); } catch (e) {}
    });
    if (!('IntersectionObserver' in win) || K.reduced()) { sys.classList.add('is-in'); return; }
    var io = new IntersectionObserver(function (en) {
      if (en[0].isIntersecting) { sys.classList.add('is-in'); io.disconnect(); }
    }, { threshold: 0.3 });
    io.observe(sys);
  }

  function scanHeight() {
    var frame = q('.prx-viewport-frame');
    if (!frame) return;
    var set = function () { frame.style.setProperty('--prx-scan-h', Math.round(frame.clientHeight) + 'px'); };
    set();
    win.addEventListener('resize', set, { passive: true });
  }

  K.ready(function () {
    K.progress();
    K.magnetic(doc);
    var grid = doc.getElementById('projectsGrid');
    K.onRender(grid, tagCards);
    if (win.EMBSMotion) win.EMBSMotion.watch(grid, '.proj-card', { variant: 'fade' });
    drawSignal();
    scanHeight();
    load();
  });

}(window, document));
