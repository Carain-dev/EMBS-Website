/* ================================================================
   home-experience.js — IEEE EMBS KPRIET (index.html only)

   The single motion engine for the Home page (GSAP + ScrollTrigger).
   On Home it replaces animations.js and motion.js, which are not
   loaded there, so every animated element has exactly one owner.
   Shared CSS primitives (aurora, orbs, hover glow, sheen) still come
   from motion.css.

   STRUCTURE
     prep()           static DOM hooks: line masks, rail ticks, glow
                      classes — run once, harmless without motion
     watchCMS()       one MutationObserver for the four API grids and
                      the hero stats; new cards are animated inside the
                      active GSAP context and ScrollTrigger is
                      refreshed on the next frame (no timeouts)
     gsap.matchMedia  motion tiers, rebuilt cleanly when they change:
                        full   ≥1024px    — complete experience
                        mid    768–1023px — no rail, lighter depth
                        small  <768px     — reveals only, no scrub
                        reduce            — nothing moves, all visible
     pointer layer    fine pointers only: cursor light, hero depth,
                      magnetic CTAs, card glow tracking

   TEMPO (cinematic, rising and falling through the page)
     arrival + hero   strongest, sequenced entrance + scroll exit
     research         drawn signal line, diagonal card flow
     podcast          calmer, slower media reveal
     why join         editorial: the light panel rises, icons draw
     achievements     restrained, vertical rhythm
     faculty          slowest tempo, respectful portrait reveal
     final CTA        hero light returns and expands
     footer           the system settles
   ================================================================ */

(function (win, doc) {
  'use strict';

  var root = doc.documentElement;
  var gsap = win.gsap;
  var ST = win.ScrollTrigger;

  function releasePending() {
    if (win.__xpFailsafe) clearTimeout(win.__xpFailsafe);
    root.classList.remove('xp-pending');
  }

  function q(sel, scope) { return (scope || doc).querySelector(sel); }
  function qa(sel, scope) { return Array.prototype.slice.call((scope || doc).querySelectorAll(sel)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ── Motion vocabulary: one set of eases for the whole page ──── */
  var EASE = {
    reveal: 'expo.out',        /* typography + media arrivals */
    sweep:  'expo.inOut',      /* clip / mask transitions */
    soft:   'power3.out',      /* secondary text */
    settle: 'power2.out',      /* ambient light */
    spring: 'elastic.out(1, 0.55)' /* micro-interaction return */
  };

  var lowPower = !!(navigator.connection && navigator.connection.saveData) ||
                 (typeof navigator.deviceMemory === 'number' && navigator.deviceMemory < 4);

  /* ================================================================
     1. STATIC PREP (runs with or without GSAP)
     ================================================================ */

  /* Wrap an element's lines (split on <br>) into masks.
     Returns the inner elements to animate. */
  function splitLines(el) {
    if (!el) return [];
    if (el._xpLines) return el._xpLines;

    var groups = [[]];
    Array.prototype.slice.call(el.childNodes).forEach(function (node) {
      if (node.nodeName === 'BR') groups.push([]);
      else groups[groups.length - 1].push(node);
    });

    var labels = [];
    var inners = [];
    while (el.firstChild) el.removeChild(el.firstChild);

    groups.forEach(function (nodes) {
      var line = doc.createElement('span');
      var inner = doc.createElement('span');
      line.className = 'xp-line';
      inner.className = 'xp-line-inner';
      nodes.forEach(function (n) { inner.appendChild(n); });
      line.appendChild(inner);
      el.appendChild(line);
      labels.push(inner.textContent.trim());
      inners.push(inner);
    });

    /* Block-level line spans would otherwise run the words together
       for assistive tech ("WhereEngineering…") */
    if (groups.length > 1) el.setAttribute('aria-label', labels.join(' ').replace(/\s+/g, ' '));

    el._xpLines = inners;
    return inners;
  }

  var HEADINGS = [
    { section: '.activities',   label: '.activities-label',   title: '.activities-title',   extras: ['.activities-viewall'] },
    { section: '.podcast',      label: '.podcast-label',      title: '.podcast-title',      extras: ['.podcast-desc', '.podcast-spotify-btn'] },
    { section: '.whyjoin',      label: '.whyjoin-label',      title: '.whyjoin-title',      extras: [] },
    { section: '.achievements', label: '.achievements-label', title: '.achievements-title', extras: ['.achievements-viewall'] },
    { section: '.faculty',      label: '.faculty-label',      title: '.faculty-title',      extras: [] },
    { section: '.xp-cta',       label: '.xp-cta-label',       title: '.xp-cta-title',       extras: ['.xp-cta-sub', '.xp-cta-actions'] }
  ];

  /* Sections in journey order, for the rail */
  var JOURNEY = [
    { sel: '.hero',         theme: 'dark'  },
    { sel: '.activities',   theme: 'dark'  },
    { sel: '.podcast',      theme: 'dark'  },
    { sel: '.whyjoin',      theme: 'light' },
    { sel: '.achievements', theme: 'light' },
    { sel: '.faculty',      theme: 'light' },
    { sel: '.xp-cta',       theme: 'dark'  }
  ];

  /* CMS grids: which children are cards, whether they get hover glow */
  var GRIDS = [
    { sel: '.activities-grid',         card: '.act-card', glow: true,  build: buildActivityCards },
    { sel: '.podcast-episodes',        card: '.ep-card',  glow: true,  build: buildEpisodeCards },
    { sel: '.achievements-grid',       card: '.ach-card', glow: false, build: buildAchievementCards },
    { sel: '#facultyCoordinatorsGrid', card: '.fac-card', glow: true,  build: buildFacultyCards },
    { sel: '#hxRecent',                card: '.hx-row',   glow: false, build: buildRecentRows }
  ];

  function prep() {
    splitLines(q('.hero-heading'));
    HEADINGS.forEach(function (h) { splitLines(q(h.title)); });

    /* Rail ticks */
    var rail = q('.xp-rail');
    if (rail && !rail._xpTicks) {
      rail._xpTicks = JOURNEY.map(function () {
        var t = doc.createElement('span');
        t.className = 'xp-rail-tick';
        rail.appendChild(t);
        return t;
      });
    }
  }

  /* ================================================================
     2. POINTER LAYER (vanilla; fine pointers only)
     ================================================================ */

  var glowPending = null;

  function onGlowMove(e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    var first = glowPending === null;
    glowPending = e;
    if (first) win.requestAnimationFrame(flushGlow);
  }

  function flushGlow() {
    var e = glowPending;
    glowPending = null;
    if (!e || !e.target || !e.target.closest) return;
    var host = e.target.closest('.mo-hover-glow');
    if (!host) return;
    var r = host.getBoundingClientRect();
    host.style.setProperty('--mo-mx', (e.clientX - r.left) + 'px');
    host.style.setProperty('--mo-my', (e.clientY - r.top) + 'px');
  }

  /* ================================================================
     3. STATS COUNTING (values arrive from home-stats.js)
     ================================================================ */

  var stats = { revealed: false, allowed: false, tweens: [] };

  function parseStat(text) {
    var m = /^(\d+)(.*)$/.exec(String(text).trim());
    return m ? { n: parseInt(m[1], 10), suffix: m[2], text: String(text).trim() } : null;
  }

  /* Every engine write is recorded, so the MutationObserver can tell
     the engine's own updates apart from new values from home-stats.js */
  function writeStat(el, text) {
    el._xpWrote = text;
    el.textContent = text;
  }

  function countStat(el) {
    var target = el._xpTarget;
    if (!target || el._xpCounted || !stats.allowed || !stats.revealed || !gsap) return;
    el._xpCounted = true;
    if (target.n === 0) return;

    /* Lock the final width first so the card never jitters */
    el.style.minWidth = el.getBoundingClientRect().width + 'px';
    var obj = { v: 0 };
    writeStat(el, '0' + target.suffix);

    var tw = gsap.to(obj, {
      v: target.n,
      duration: clamp(0.9 + target.n * 0.04, 1.1, 2),
      ease: 'power2.out',
      onUpdate: function () { writeStat(el, Math.round(obj.v) + target.suffix); },
      onComplete: function () {
        writeStat(el, target.text);
        el.style.minWidth = '';
      }
    });
    stats.tweens.push(tw);
  }

  function finishCounts() {
    stats.tweens.forEach(function (t) { t.kill(); });
    stats.tweens = [];
    qa('.stat-number').forEach(function (el) {
      if (el._xpTarget) {
        writeStat(el, el._xpTarget.text);
        el.style.minWidth = '';
      }
    });
  }

  function runCounts() { qa('.stat-number').forEach(countStat); }

  /* A zero is not shown as a figure of activity: its tile (and the
     divider before it) leave the row until the CMS has a real value. */
  function hideIfZero(el, t) {
    var item = el.closest('.stat-item');
    if (!item) return;
    item.hidden = t.n === 0;
    var prev = item.previousElementSibling;
    if (prev && prev.classList.contains('stat-divider')) prev.hidden = t.n === 0;
    queueRefresh();
  }

  /* ================================================================
     4. CMS WATCHER
     ================================================================ */

  var activeCtx = null;   /* current matchMedia context, null when reduced */
  var activeTier = 'reduce';
  var refreshQueued = false;

  function queueRefresh() {
    if (!ST || refreshQueued) return;
    refreshQueued = true;
    /* Two frames: let the data script's layout settle first */
    win.requestAnimationFrame(function () {
      win.requestAnimationFrame(function () {
        refreshQueued = false;
        ST.refresh();
      });
    });
  }

  function watchCMS() {
    GRIDS.forEach(function (g) {
      var el = q(g.sel);
      if (!el) return;
      g.el = el;
      var mo = new MutationObserver(function () {
        decorateGrid(g);
        if (activeCtx) activeCtx.add(function () { animateGrid(g); });
        queueRefresh();
      });
      mo.observe(el, { childList: true });
      decorateGrid(g);
    });

    qa('.stat-number').forEach(function (el) {
      var mo = new MutationObserver(function () {
        /* MutationObserver callbacks are async: compare with the engine's
           own last write instead of relying on a synchronous flag */
        if (el.textContent === el._xpWrote) return;
        var t = parseStat(el.textContent);
        if (!t) return;
        el._xpTarget = t;
        el._xpCounted = false;
        hideIfZero(el, t);
        countStat(el);
      });
      mo.observe(el, { childList: true, characterData: true, subtree: true });
    });
  }

  function decorateGrid(g) {
    if (!g.glow) return;
    qa(g.card, g.el).forEach(function (c) { c.classList.add('mo-hover-glow'); });
  }

  /* Animate whatever in the grid has not been shown yet */
  function animateGrid(g) {
    if (!g.el || !gsap || activeTier === 'reduce') return;

    var cards = qa(g.card, g.el).filter(function (c) { return !c._xpShown; });
    var empties = qa(':scope > p', g.el).filter(function (p) { return !p._xpShown; });

    if (empties.length) {
      empties.forEach(function (p) { p._xpShown = true; });
      gsap.from(empties, { opacity: 0, duration: 1.2, ease: EASE.settle,
        scrollTrigger: { trigger: g.el, start: 'top 90%', toggleActions: 'play none none none' } });
    }
    if (!cards.length) return;

    cards.forEach(function (c) { c._xpShown = true; c.classList.add('xp-t'); });
    var tl = g.build(cards, activeTier === 'small');
    ST.create({ trigger: g.el, start: 'top 88%', toggleActions: 'play none none none', onEnter: function () { tl.play(); } });
  }

  /* Research / events: diagonal flow, media opens, details follow */
  function buildActivityCards(cards, small) {
    var tl = gsap.timeline({ paused: true });
    cards.forEach(function (c, i) {
      var at = i * 0.14;
      tl.fromTo(c,
        { '--xp-tx': small ? '0px' : '56px', '--xp-ty': '44px', opacity: 0 },
        { '--xp-tx': '0px', '--xp-ty': '0px', opacity: 1, duration: 1.3, ease: EASE.reveal }, at);
      var top = q('.act-card-top', c);
      if (top) tl.fromTo(top, { clipPath: 'inset(0% 0% 100% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: EASE.sweep, clearProps: 'clipPath' }, at + 0.08);
      var icon = q('.act-icon', c);
      if (icon) tl.from(icon, { opacity: 0, duration: 0.9, ease: EASE.settle }, at + 0.55);
      var details = qa('.act-meta, .act-title, .act-desc, .act-footer', c);
      if (details.length) tl.from(details, { opacity: 0, y: 14, duration: 1, stagger: 0.07, ease: EASE.soft, clearProps: 'transform' }, at + 0.35);
    });
    return tl;
  }

  /* Podcast episodes: calm rise, progress bars draw */
  function buildEpisodeCards(cards) {
    var tl = gsap.timeline({ paused: true });
    tl.fromTo(cards, { '--xp-ty': '40px', opacity: 0 },
      { '--xp-ty': '0px', opacity: 1, duration: 1.4, ease: EASE.reveal, stagger: 0.13 }, 0);
    var fills = qa('.ep-progress-fill', cards[0].parentNode).filter(function (f) {
      return cards.indexOf(f.closest('.ep-card')) !== -1;
    });
    if (fills.length) tl.from(fills, { scaleX: 0, transformOrigin: '0% 50%', duration: 1.6, ease: EASE.sweep, stagger: 0.13, clearProps: 'transform' }, 0.35);
    return tl;
  }

  /* Recently held (home-feed.js): rows draw in from the date column */
  function buildRecentRows(cards) {
    var tl = gsap.timeline({ paused: true });
    tl.fromTo(cards, { '--xp-tx': '24px', opacity: 0 },
      { '--xp-tx': '0px', opacity: 1, duration: 1.2, ease: EASE.reveal, stagger: 0.09 }, 0.2);
    return tl;
  }

  /* Achievements: restrained, editorial rhythm */
  function buildAchievementCards(cards) {
    var tl = gsap.timeline({ paused: true });
    tl.fromTo(cards, { '--xp-ty': '32px', opacity: 0 },
      { '--xp-ty': '0px', opacity: 1, duration: 1.4, ease: EASE.reveal, stagger: 0.15 }, 0);
    var icons = qa('.ach-icon', cards[0].parentNode);
    if (icons.length) tl.from(icons, { opacity: 0, duration: 1.2, stagger: 0.15, ease: EASE.settle }, 0.4);
    return tl;
  }

  /* Faculty: slowest tempo; portraits open from the centre, never distorted */
  function buildFacultyCards(cards) {
    var tl = gsap.timeline({ paused: true });
    tl.fromTo(cards, { '--xp-ty': '26px', opacity: 0 },
      { '--xp-ty': '0px', opacity: 1, duration: 1.6, ease: EASE.reveal, stagger: 0.17 }, 0);
    cards.forEach(function (c, i) {
      var av = q('.fac-avatar', c);
      if (av) tl.fromTo(av, { clipPath: 'circle(0% at 50% 50%)' },
        { clipPath: 'circle(75% at 50% 50%)', duration: 1.7, ease: EASE.sweep, clearProps: 'clipPath' }, 0.15 + i * 0.17);
      var text = qa('.fac-name, .fac-role', c);
      if (text.length) tl.from(text, { opacity: 0, duration: 1.2, stagger: 0.1, ease: EASE.settle }, 0.6 + i * 0.17);
    });
    return tl;
  }

  /* ================================================================
     5. TIMELINES
     ================================================================ */

  var entranceDone = false;

  /* 01 + 02 + 03 — arrival, hero, numbers: one continuous sequence */
  function heroEntrance(tier) {
    if (entranceDone) return;
    /* While the start-up overlay (loader.js) is up, play the entrance as it leaves. */
    if (win.EMBSLoader && win.EMBSLoader.holding()) {
      win.EMBSLoader.onReveal(function () { heroEntrance(tier); });
      return;
    }
    entranceDone = true;

    if (win.__xpFailed) {           /* failsafe already revealed the page */
      stats.revealed = true;
      runCounts();
      return;
    }

    var small = tier === 'small';
    var lines = splitLines(q('.hero-heading'));
    var statItems = qa('.stat-item');
    statItems.forEach(function (s) { s.classList.add('xp-t'); });

    var tl = gsap.timeline({ defaults: { ease: EASE.reveal } });

    tl.from('.navbar', { yPercent: -100, duration: 1.2, clearProps: 'transform' }, 0)
      .from('.announce-bar', { yPercent: -100, opacity: 0, duration: 1.1, clearProps: 'transform,opacity' }, 0.14)

      /* the room lights up before anything is said */
      .from('.xp-depth--far', { opacity: 0, duration: 2.6, ease: EASE.settle }, 0.1)
      .from('.xp-depth--near', { opacity: 0, duration: 2.4, ease: EASE.settle }, 0.35)
      .from('.xp-hero-light', { opacity: 0, duration: 2.4, ease: EASE.settle }, 0.5)

      .fromTo('.hero-badge',
        { clipPath: 'inset(0% 100% 0% 0% round 999px)' },
        { clipPath: 'inset(0% 0% 0% 0% round 999px)', duration: 1.2, ease: EASE.sweep, clearProps: 'clipPath' }, 0.4)

      /* headline: lines rise out of their masks with a slight lean */
      .from(lines, {
        yPercent: 115,
        rotation: small ? 0 : 2.5,
        transformOrigin: '0% 100%',
        duration: small ? 1.15 : 1.45,
        stagger: 0.11,
        clearProps: 'transform'
      }, 0.55)

      .from('.hero-sub', { opacity: 0, y: 18, duration: 1.2, ease: EASE.soft, clearProps: 'transform' }, 1.1)
      .from('.hero-buttons', { opacity: 0, y: 16, duration: 1.1, ease: EASE.soft, clearProps: 'transform' }, 1.25)

      /* numbers emerge from the same light, then lock into one system */
      .fromTo(statItems,
        { '--xp-ty': small ? '20px' : '30px', opacity: 0 },
        { '--xp-ty': '0px', opacity: 1, duration: 1.2, stagger: 0.09 }, 1.4)
      .fromTo('.hero-stats', { '--xp-line': 0 }, { '--xp-line': 1, duration: 1.6, ease: EASE.sweep }, 1.45)
      .add(function () { stats.revealed = true; runCounts(); }, 1.55);

    /* Opacity of the parent containers is restored by the tweens above;
       the hero text containers were only hidden by xp-pending. */
    statItems.forEach(function (s) { s._xpShown = true; });
  }

  /* Hero exit: the scene keeps moving as it hands over to research */
  function heroExit() {
    var tl = gsap.timeline({
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.9 }
    });
    tl.to('.hero-container', { y: -90, opacity: 0.25, ease: 'none' }, 0)
      .to('.hero .mo-aurora', { y: 150, scale: 1.18, ease: 'none' }, 0)
      .to('.xp-grid--hero', { y: 70, ease: 'none' }, 0)
      .to('.mo-hero-swirl', { rotation: 70, y: 90, ease: 'none' }, 0)
      .to('.mo-hero-orb-b', { y: 70, ease: 'none' }, 0)
      .to('.mo-hero-orb-a', { y: 180, ease: 'none' }, 0)
      .to('.hero-heart', { yPercent: -38, scale: 1.08, ease: 'none' }, 0)
      .to('.deco-cross', { y: 130, rotation: 22, ease: 'none' }, 0)
      .to('.deco-pulse', { y: 60, ease: 'none' }, 0);
  }

  /* Section headings: label sweeps open, title rises from its mask */
  function headingReveals(tier) {
    var small = tier === 'small';
    HEADINGS.forEach(function (h) {
      var section = q(h.section);
      var title = q(h.title);
      if (!section || !title) return;

      /* Tempo slows for the human sections */
      var slow = h.section === '.faculty' ? 1.25 : h.section === '.podcast' ? 1.12 : 1;
      var label = q(h.label);
      var inners = splitLines(title);
      var extras = h.extras.map(function (s) { return q(s); }).filter(Boolean);
      extras.forEach(function (e) { e.classList.add('xp-t'); });

      var tl = gsap.timeline({
        scrollTrigger: { trigger: title, start: 'top 86%', toggleActions: 'play none none none' },
        defaults: { ease: EASE.reveal }
      });
      if (label) tl.fromTo(label,
        { clipPath: 'inset(0% 100% 0% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.0 * slow, ease: EASE.sweep, clearProps: 'clipPath' }, 0);
      tl.from(inners, { yPercent: 112, rotation: small ? 0 : 1.5, transformOrigin: '0% 100%',
        duration: 1.3 * slow, stagger: 0.1, clearProps: 'transform' }, 0.12);
      if (extras.length) tl.fromTo(extras,
        { '--xp-ty': '18px', opacity: 0 },
        { '--xp-ty': '0px', opacity: 1, duration: 1.1 * slow, stagger: 0.1, ease: EASE.soft }, 0.45);
    });
  }

  /* Research section: signal line draws as you read, nodes light up */
  function researchSignal() {
    var svg = q('.xp-signal');
    if (!svg) return;
    var paths = qa('.xp-signal-path', svg);
    var nodes = qa('.xp-signal-node', svg);
    paths.forEach(function (p) {
      var len = p.getTotalLength();
      gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
    });
    var tl = gsap.timeline({
      scrollTrigger: { trigger: '.activities', start: 'top 70%', end: 'bottom 55%', scrub: 1 }
    });
    tl.to(paths, { strokeDashoffset: 0, ease: 'none', duration: 1, stagger: 0.12 }, 0);
    nodes.forEach(function (n, i) {
      tl.fromTo(n, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, ease: 'back.out(2)', duration: 0.12 }, 0.22 + i * 0.27);
    });

    /* Hero light carried across the seam */
    gsap.fromTo('.xp-seam', { opacity: 0.25 }, { opacity: 1, ease: 'none',
      scrollTrigger: { trigger: '.activities', start: 'top bottom', end: 'top 35%', scrub: true } });
    gsap.fromTo('.xp-grid--research', { opacity: 0, y: 40 }, { opacity: 0.8, y: -20, ease: 'none',
      scrollTrigger: { trigger: '.activities', start: 'top bottom', end: 'bottom top', scrub: true } });
  }

  /* Podcast: the media arrives slowly; depth while reading */
  function podcastMedia(tier) {
    var cover = q('.podcast-cover');
    var img = q('.podcast-cover-img');
    if (!cover) return;
    var tl = gsap.timeline({ scrollTrigger: { trigger: cover, start: 'top 85%', toggleActions: 'play none none none' } });
    tl.fromTo(cover,
      { clipPath: 'inset(100% 0% 0% 0% round 16px)', rotation: -2.5 },
      { clipPath: 'inset(0% 0% 0% 0% round 16px)', rotation: 0, duration: 1.7, ease: EASE.sweep, clearProps: 'clipPath,transform' }, 0);
    if (img) tl.fromTo(img, { scale: 1.3 }, { scale: 1.1, duration: 2.2, ease: EASE.reveal }, 0.1);

    if (img && tier !== 'small') {
      gsap.fromTo(img, { yPercent: -4 }, { yPercent: 4, ease: 'none',
        scrollTrigger: { trigger: cover, start: 'top bottom', end: 'bottom top', scrub: true } });
    }
  }

  /* What we do: the light panel rises over the dark ground; the four
     cards arrive as one composition; their icons draw like diagrams */
  function whyJoin(tier) {
    var section = q('.whyjoin');
    if (!section) return;

    if (tier !== 'small') {
      gsap.fromTo(section,
        { clipPath: 'inset(0% 4.5% 0% 4.5% round 44px)' },
        { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none',
          scrollTrigger: { trigger: section, start: 'top bottom', end: 'top 22%', scrub: 0.6 } });
    }

    var cards = qa('.wj-card', section);
    cards.forEach(function (c) { c.classList.add('xp-t'); });
    var shapes = [];
    cards.forEach(function (c) {
      qa('.wj-icon svg circle, .wj-icon svg path, .wj-icon svg line, .wj-icon svg rect, .wj-icon svg polygon', c)
        .forEach(function (s) {
          if (typeof s.getTotalLength !== 'function') return;
          if (s.getAttribute('fill') && s.getAttribute('fill') !== 'none' && !s.getAttribute('stroke')) return;
          var len = s.getTotalLength();
          if (!len) return;
          shapes.push(s);
          s._xpLen = len;
        });
    });

    var tl = gsap.timeline({ scrollTrigger: { trigger: '.whyjoin-grid', start: 'top 82%', toggleActions: 'play none none none' } });
    tl.fromTo(cards, { '--xp-ty': '56px', opacity: 0 },
      { '--xp-ty': '0px', opacity: 1, duration: 1.4, ease: EASE.reveal, stagger: 0.09 }, 0);
    if (shapes.length) {
      tl.fromTo(shapes,
        { strokeDasharray: function (i, s) { return s._xpLen; }, strokeDashoffset: function (i, s) { return s._xpLen; } },
        { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut', stagger: 0.025,
          onComplete: function () { gsap.set(shapes, { clearProps: 'strokeDasharray,strokeDashoffset' }); } }, 0.35);
    }

    /* Asymmetric depth inside the composition (desktop) */
    if (tier === 'full') {
      qa('.wj-icon', section).forEach(function (icon, i) {
        gsap.fromTo(icon, { y: i % 2 ? 16 : -10 }, { y: i % 2 ? -16 : 10, ease: 'none',
          scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true } });
      });
    }
  }

  /* Ambient orbs travel with the reader instead of floating on a loop */
  function ambientOrbs() {
    qa('.mo-home-orb').forEach(function (orb, i) {
      var section = orb.parentNode;
      gsap.fromTo(orb, { y: -70, x: i % 2 ? 30 : -30 }, { y: 70, x: i % 2 ? -30 : 30, ease: 'none',
        scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  }

  /* Final CTA: the hero light returns and expands — narrative closure */
  function finalCTA(tier) {
    var cta = q('.xp-cta');
    if (!cta) return;
    var panel = q('.xp-cta-panel', cta);
    var aurora = q('.mo-aurora', cta);

    if (tier !== 'small' && panel) {
      gsap.fromTo(panel,
        { clipPath: 'inset(4% 5% 0% 5% round 44px)' },
        { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none',
          scrollTrigger: { trigger: cta, start: 'top 90%', end: 'top 5%', scrub: 0.6 } });
    }
    if (aurora) {
      gsap.fromTo(aurora, { scale: 0.6, opacity: 0.25 }, { scale: 1.12, opacity: 1, ease: 'none',
        scrollTrigger: { trigger: cta, start: 'top bottom', end: 'center center', scrub: true } });
    }
    gsap.fromTo('.xp-grid--cta', { opacity: 0 }, { opacity: 1, ease: 'none',
      scrollTrigger: { trigger: cta, start: 'top 70%', end: 'center center', scrub: true } });
  }

  /* Footer: the system settles */
  function footerSettle() {
    var cols = qa('.footer-col');
    cols.forEach(function (c) { c.classList.add('xp-t'); });
    var tl = gsap.timeline({ scrollTrigger: { trigger: '.footer', start: 'top 92%', toggleActions: 'play none none none' } });
    tl.fromTo(cols, { '--xp-ty': '26px', opacity: 0 },
      { '--xp-ty': '0px', opacity: 1, duration: 1.5, ease: EASE.reveal, stagger: 0.1 }, 0)
      .from('.footer-bottom', { opacity: 0, duration: 1.4, ease: EASE.settle }, 0.5);
  }

  /* Navigation progress hairline under the announcement bar */
  function progressLine() {
    gsap.to('.xp-progress', { scaleX: 1, ease: 'none',
      scrollTrigger: { start: 0, end: 'max', scrub: 0.4 } });
  }

  /* The rail: one thread through the whole page */
  var railRelease = null;
  var railReleaseBound = false;

  function scrollRail() {
    var rail = q('.xp-rail');
    if (!rail || getComputedStyle(rail).display === 'none') return;
    var fill = q('.xp-rail-fill', rail);
    var node = q('.xp-rail-node', rail);
    var ticks = rail._xpTicks || [];
    var setFill = gsap.quickSetter(fill, 'scaleY');
    var setNode = gsap.quickSetter(node, 'y', 'px');
    var stretch = gsap.quickTo(node, 'scaleY', { duration: 0.5, ease: 'power3.out' });

    function layoutTicks() {
      var max = Math.max(1, ST.maxScroll(win));
      var h = rail.offsetHeight;
      JOURNEY.forEach(function (j, i) {
        var s = q(j.sel);
        if (!s || !ticks[i]) return;
        var top = s.getBoundingClientRect().top + win.pageYOffset;
        ticks[i].style.top = (clamp(top / max, 0, 1) * h) + 'px';
      });
    }

    ST.create({
      start: 0,
      end: 'max',
      onRefresh: layoutTicks,
      onUpdate: function (self) {
        setFill(self.progress);
        setNode(self.progress * rail.offsetHeight);
        /* subtle inertia: the node stretches with scroll velocity */
        stretch(1 + clamp(Math.abs(self.getVelocity()) / 2600, 0, 1.4));
      }
    });
    layoutTicks();

    JOURNEY.forEach(function (j, i) {
      var s = q(j.sel);
      if (!s) return;
      ST.create({
        trigger: s,
        start: 'top 50%',
        end: 'bottom 50%',
        onToggle: function (self) {
          if (!self.isActive) return;
          ticks.forEach(function (t, k) { t.classList.toggle('is-active', k === i); });
          rail.classList.toggle('is-light', j.theme === 'light');
        }
      });
    });

    /* settles as the journey ends */
    gsap.to(rail, { opacity: 0, ease: 'none',
      scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'top 55%', scrub: true } });

    /* release the stretch when scrolling stops (listener added once) */
    railRelease = function () { stretch(1); };
    if (!railReleaseBound) {
      railReleaseBound = true;
      ST.addEventListener('scrollEnd', function () { if (railRelease) railRelease(); });
    }
  }

  /* Pointer: cursor light, hero depth, magnetic CTAs */
  function pointerLayer() {
    var hero = q('.hero');
    var far = q('.xp-depth--far');
    var near = q('.xp-depth--near');
    var light = q('.xp-hero-light');
    if (!hero) return function () {};

    var farX = gsap.quickTo(far, 'x', { duration: 1.4, ease: 'power3.out' });
    var farY = gsap.quickTo(far, 'y', { duration: 1.4, ease: 'power3.out' });
    var nearX = gsap.quickTo(near, 'x', { duration: 1.0, ease: 'power3.out' });
    var nearY = gsap.quickTo(near, 'y', { duration: 1.0, ease: 'power3.out' });
    var lightX = gsap.quickTo(light, 'x', { duration: 1.2, ease: 'power3.out' });
    var lightY = gsap.quickTo(light, 'y', { duration: 1.2, ease: 'power3.out' });

    var rect = hero.getBoundingClientRect();
    gsap.set(light, { x: rect.width * 0.68, y: rect.height * 0.45 });

    var pending = null;
    function onMove(e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      var first = pending === null;
      pending = e;
      if (first) win.requestAnimationFrame(apply);
    }
    function apply() {
      var e = pending;
      pending = null;
      if (!e) return;
      rect = hero.getBoundingClientRect();
      if (rect.bottom < 0) return;
      var inside = e.clientY >= rect.top && e.clientY <= rect.bottom;
      var nx = inside ? ((e.clientX - rect.left) / rect.width) * 2 - 1 : 0;
      var ny = inside ? ((e.clientY - rect.top) / rect.height) * 2 - 1 : 0;
      farX(-nx * 10); farY(-ny * 8);
      nearX(nx * 22); nearY(ny * 14);
      if (inside) { lightX(e.clientX - rect.left); lightY(e.clientY - rect.top); }
    }
    win.addEventListener('pointermove', onMove, { passive: true });

    /* Magnetic CTAs: gentle attraction, spring-like return */
    root.classList.add('xp-magnetic-on');
    var mags = qa('.xp-magnetic').map(function (btn) {
      var xTo = gsap.quickTo(btn, 'x', { duration: 0.6, ease: 'power3.out' });
      var yTo = gsap.quickTo(btn, 'y', { duration: 0.6, ease: 'power3.out' });
      function move(e) {
        var r = btn.getBoundingClientRect();
        xTo(clamp((e.clientX - (r.left + r.width / 2)) * 0.26, -9, 9));
        yTo(clamp((e.clientY - (r.top + r.height / 2)) * 0.34, -6, 6) - 2);
      }
      function leave() { gsap.to(btn, { x: 0, y: 0, duration: 1.1, ease: EASE.spring, overwrite: 'auto' }); }
      btn.addEventListener('pointermove', move);
      btn.addEventListener('pointerleave', leave);
      return { btn: btn, move: move, leave: leave };
    });

    return function cleanup() {
      win.removeEventListener('pointermove', onMove);
      root.classList.remove('xp-magnetic-on');
      mags.forEach(function (m) {
        m.btn.removeEventListener('pointermove', m.move);
        m.btn.removeEventListener('pointerleave', m.leave);
        gsap.set(m.btn, { clearProps: 'transform' });
      });
    };
  }

  /* ================================================================
     6. BOOT
     ================================================================ */

  function boot() {
    prep();

    doc.addEventListener('pointermove', onGlowMove, { passive: true });

    if (!gsap || !ST) {
      /* CDN unavailable — the page simply renders without motion */
      releasePending();
      watchCMS();
      return;
    }

    gsap.registerPlugin(ST);
    ST.config({ ignoreMobileResize: true });

    /* Normalise the heart's CSS centring into GSAP's transform model */
    gsap.set('.hero-heart', { yPercent: -50, y: 0 });

    watchCMS();

    var mm = gsap.matchMedia();
    mm.add({
      full:   '(min-width: 1024px)',
      mid:    '(min-width: 768px) and (max-width: 1023px)',
      small:  '(max-width: 767px)',
      reduce: '(prefers-reduced-motion: reduce)',
      fine:   '(hover: hover) and (pointer: fine)'
    }, function (context) {
      var c = context.conditions;

      if (c.reduce) {
        releasePending();
        activeCtx = null;
        activeTier = 'reduce';
        stats.allowed = false;
        entranceDone = true;
        finishCounts();
        return;
      }

      var tier = (c.small || lowPower) ? 'small' : c.full ? 'full' : 'mid';
      activeTier = tier;
      activeCtx = context;
      stats.allowed = true;

      /* Same task as the first frame of the entrance → no flash */
      releasePending();
      heroEntrance(tier);
      headingReveals(tier);
      GRIDS.forEach(animateGrid);
      podcastMedia(tier);
      whyJoin(tier);
      footerSettle();

      var cleanupPointer = null;
      if (tier !== 'small') {
        heroExit();
        researchSignal();
        ambientOrbs();
        finalCTA(tier);
        progressLine();
        if (tier === 'full') scrollRail();
        if (c.fine) cleanupPointer = pointerLayer();
      }

      return function () {
        if (cleanupPointer) cleanupPointer();
        railRelease = null;
        activeCtx = null;
        /* Re-show anything mid-animation when the tier changes */
        GRIDS.forEach(function (g) {
          if (g.el) qa(g.card, g.el).forEach(function (card) { card._xpShown = false; });
        });
      };
    });

    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(queueRefresh);

    /* Late images (cover, portraits) can change layout */
    var main = q('main');
    if (main) main.addEventListener('load', function (e) {
      if (e.target && e.target.tagName === 'IMG') queueRefresh();
    }, true);
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();

}(window, document));
