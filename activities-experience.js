/* ================================================================
   activities-experience.js — IEEE EMBS KPRIET (activities.html only)

   The single motion engine for the Activities page (GSAP +
   ScrollTrigger, with shared helpers from experience-core.js).
   animations.js and motion.js are not loaded on this page, so every
   animated element has exactly one owner.

   CMS content is never generated here. activities-feed.js,
   activities-stats.js and page-hero-image.js fill the page; this
   engine animates what they insert (the feed announces each finished
   section with an `act:feed` event).

   TIERS (gsap.matchMedia — rebuilt cleanly when they change)
     full   ≥1024px — complete experience; the chronology pins and
                      travels sideways when the viewport is tall enough
     mid    768–1023 — scroll-linked, no pinning, no rail
     small  <768px  (or data-saver) — reveals only, recomposed layout
     reduce          — nothing moves; every element at rest, visible

   TEMPO through the page (Home arrives, About identifies, Activities
   has MOMENTUM — the quickest page, with deliberate rests)
     arrival    strongest — letters set, the signal starts to travel
     ecosystem  responsive — hover/scroll lights a strand + its links
     events     energetic — the featured event opens; the chronology
                is read sideways under a pin
     momentum   live figures count up; the word drifts
     research   technical — the schematic draws as you descend
     knowledge  the rest — slow, read-along
     podcast    media — the cover settles into orbit
     moments    cinematic — photographs open from their frames
     involved   the opening signal gathers at one point
   ================================================================ */

(function (win, doc) {
  'use strict';

  var X = win.EMBSXP;
  if (!X) {                      /* core failed to load: never leave the page hidden */
    doc.documentElement.classList.remove('xp-pending');
    return;
  }

  var gsap = win.gsap;
  var ST = win.ScrollTrigger;
  var q = X.q, qa = X.qa, EASE = X.EASE, clamp = X.clamp;

  /* Triggers created for content that may already be scrolled past
     must still finish: every state change plays. */
  var TA = 'play play play play';

  var JOURNEY = [
    { sel: '.act-hero',            theme: 'dark'  },
    { sel: '#act-ecosystem',       theme: 'light' },
    { sel: '#act-events',          theme: 'dark'  },
    { sel: '#act-impact',          theme: 'light' },
    { sel: '#act-research',        theme: 'dark'  },
    { sel: '#act-knowledge',       theme: 'light' },
    { sel: '#act-podcast',         theme: 'dark'  },
    { sel: '#act-moments',         theme: 'light' },
    { sel: '#act-join',            theme: 'dark'  }
  ];

  var TITLES = ['.act-explore-title', '#actEventsTitle', '.act-impact-title', '#actResearchTitle',
                '#actKnowledgeTitle', '#actPodcastTitle', '#actMomentsTitle', '.act-cta-heading'];

  var NAMES = ['Events', 'Research', 'Articles', 'Podcast', 'Gallery'];

  var activeCtx = null;
  var activeTier = 'reduce';
  var entranceDone = false;
  var counter = null;
  var tierCleanups = [];
  var flow = null;               /* pinned chronology state (full + tall) */

  /* ================================================================
     1. STATIC PREP (works with or without GSAP)
     ================================================================ */

  /* The one-word headline: a line mask holding one span per letter */
  function splitLetters(el) {
    if (!el || el._actLetters) return el ? el._actLetters : [];
    var text = el.textContent.trim();
    el.setAttribute('aria-label', text);
    el.textContent = '';
    var line = doc.createElement('span');
    var inner = doc.createElement('span');
    line.className = 'xp-line';
    inner.className = 'xp-line-inner';
    inner.setAttribute('aria-hidden', 'true');
    var letters = text.split('').map(function (ch) {
      var s = doc.createElement('span');
      s.className = 'act-ch';
      s.textContent = ch;
      inner.appendChild(s);
      return s;
    });
    line.appendChild(inner);
    el.appendChild(line);
    el._actLetters = letters;
    return letters;
  }

  /* Ecosystem: one strand lit at a time, with the strands it connects to */
  var eco = { active: -1 };

  function setStrand(i) {
    if (i === eco.active || i < 0) return;
    eco.active = i;
    var linked = {};
    eco.cards.forEach(function (c, k) { c.classList.toggle('is-active', k === i); });
    eco.links.forEach(function (l) {
      var a = +l.getAttribute('data-a'), b = +l.getAttribute('data-b');
      var hot = a === i || b === i;
      l.classList.toggle('is-hot', hot);
      if (hot) linked[a === i ? b : a] = true;
    });
    eco.pulses.forEach(function (p) {
      var a = +p.getAttribute('data-a'), b = +p.getAttribute('data-b');
      var hot = a === i || b === i;
      p.classList.toggle('is-hot', hot);
      p.classList.toggle('is-rev', hot && b === i);
    });
    eco.pts.forEach(function (p, k) {
      p.classList.toggle('is-active', k === i);
      p.classList.toggle('is-linked', !!linked[k]);
    });
    eco.tethers.forEach(function (t) { t.classList.toggle('is-hot', +t.getAttribute('data-n') === i); });
    if (eco.readout) eco.readout.textContent = NAMES[i] || '';
  }

  function wireEcosystem() {
    eco.cards = qa('.act-explore-section .act-card');
    eco.pts = qa('.act-eco-pt');
    eco.links = qa('.act-eco-link');
    eco.pulses = qa('.act-eco-pulse');
    eco.tethers = qa('.act-eco-tether');
    eco.readout = q('.act-eco-readout-v');
    eco.cards.forEach(function (card, k) {
      card.addEventListener('pointerenter', function (e) {
        if (!e.pointerType || e.pointerType === 'mouse') setStrand(k);
      });
      card.addEventListener('focusin', function () { setStrand(k); });
    });
    setStrand(0);
  }

  /* Decorative CSS loops pause while their section is off screen */
  function watchOffscreen() {
    if (!('IntersectionObserver' in win)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { en.target.classList.toggle('is-offscreen', !en.isIntersecting); });
    }, { rootMargin: '120px 0px' });
    qa('#act-ecosystem, #act-research, #act-podcast').forEach(function (s) { io.observe(s); });
  }

  function prep() {
    splitLetters(q('.act-hero-heading'));
    TITLES.forEach(function (s) { X.splitLines(q(s)); });
    X.prepRail(JOURNEY);
    X.bindGlow();
    wireEcosystem();
    watchOffscreen();
  }

  /* ================================================================
     2. HELPERS
     ================================================================ */

  function shown(el) {
    if (!el || el._xpShown) return false;
    el._xpShown = true;
    return true;
  }

  function ready(id) {
    var el = doc.getElementById(id);
    return el && el.getAttribute('data-state') === 'ready' ? el : null;
  }

  /* add translate hooks + rise into place */
  function rise(els, trigger, opts) {
    els = (els || []).filter(Boolean);
    if (!els.length) return null;
    opts = opts || {};
    els.forEach(function (e) { e.classList.add('xp-t'); });
    return gsap.fromTo(els, { '--xp-ty': (opts.y || 28) + 'px', opacity: 0 }, {
      '--xp-ty': '0px', opacity: 1, duration: opts.duration || 1.25, ease: opts.ease || EASE.reveal,
      stagger: opts.stagger == null ? 0.08 : opts.stagger, delay: opts.delay || 0,
      scrollTrigger: trigger ? { trigger: trigger, start: opts.start || 'top 86%', toggleActions: TA } : undefined
    });
  }

  /* Magnetic buttons, including ones the feed inserts later */
  function bindMagnetic() {
    if (activeTier === 'reduce' || activeTier === 'small' || !win.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    var fresh = qa('.xp-magnetic:not([data-xp-mag])');
    if (!fresh.length) return;
    fresh.forEach(function (b) { b.setAttribute('data-xp-mag', ''); });
    var off = X.magnetic('.xp-magnetic[data-xp-mag]:not([data-xp-mag="1"])');
    fresh.forEach(function (b) { b.setAttribute('data-xp-mag', '1'); });
    tierCleanups.push(function () {
      off();
      fresh.forEach(function (b) { b.removeAttribute('data-xp-mag'); });
    });
  }

  /* ================================================================
     3. CMS-DRIVEN CONTENT (each runs once per tier, when ready)
     ================================================================ */

  function onFeed(key) {
    X.queueRefresh();
    if (!activeCtx || activeTier === 'reduce') return;
    activeCtx.add(function () {
      if (key === 'feature') animateFeature();
      else if (key === 'flow') animateFlow();
      else if (key === 'research') animateResearch();
      else if (key === 'knowledge') animateKnowledge();
      else if (key === 'podcast') animatePodcast();
      else if (key === 'moments') animateMoments();
      else if (key === 'next') animateNext();
      else if (key === 'cover') animateCover();
    });
    bindMagnetic();
  }

  function animateNext() {
    var a = q('#actHeroNext');
    if (!a || a.hidden || !entranceDone || !shown(a)) return;
    gsap.from(a, { opacity: 0, y: 12, duration: 1.1, ease: EASE.soft, clearProps: 'transform' });
  }

  function animateFeature() {
    var box = ready('actEventFeature');
    var card = box && q('.act-feature-card', box);
    if (!shown(card)) return;
    var media = q('.act-feature-media', card);
    var img = q('.act-feature-media img', card);
    var parts = qa('.act-feature-top, .act-feature-date, .act-feature-title, .act-feature-desc, .act-spec > div, .act-feature-actions', card);
    var tl = gsap.timeline({ scrollTrigger: { trigger: card, start: 'top 82%', toggleActions: TA } });
    tl.from(card, { opacity: 0, y: 40, duration: 1.3, ease: EASE.reveal, clearProps: 'transform' }, 0)
      .fromTo(media, { clipPath: 'inset(0% 100% 0% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.6, ease: EASE.sweep, clearProps: 'clipPath' }, 0.15);
    if (img) tl.from(img, { scale: 1.22, duration: 2.2, ease: EASE.reveal }, 0.15);
    tl.from(parts, { opacity: 0, y: 18, duration: 1.1, stagger: 0.07, ease: EASE.soft, clearProps: 'transform' }, 0.45);
    if (img && activeTier !== 'small') {
      gsap.fromTo(img, { yPercent: -3 }, { yPercent: 3, ease: 'none',
        scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true } });
    }
  }

  function animateFlow() {
    var list = ready('actFlowList');
    if (!list) return;
    var items = qa('.act-flow-item', list).filter(shown);
    if (!items.length) return;
    rise(items, list, { y: 34, stagger: 0.08, start: 'top 88%' });
    if (flow) flow.cache();
  }

  function animateResearch() {
    var box = ready('actResearch');
    var lead = box && q('.act-rx-lead', box);
    if (!shown(lead)) return;
    var plate = q('.act-rx-plate', lead);
    var parts = qa('.act-rx-top, .act-rx-title, .act-rx-desc, .act-spec > div, .act-feature-actions', lead);
    var tl = gsap.timeline({ scrollTrigger: { trigger: lead, start: 'top 82%', toggleActions: TA } });
    tl.from(lead, { opacity: 0, y: 36, duration: 1.2, ease: EASE.reveal, clearProps: 'transform' }, 0)
      .fromTo(plate, { clipPath: 'inset(0% 0% 100% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: EASE.sweep, clearProps: 'clipPath' }, 0.1)
      .from(qa('.act-rx-plate-corner', lead), { opacity: 0, scale: 0.4, duration: 0.9, stagger: 0.12, ease: 'back.out(2)', clearProps: 'transform' }, 0.9)
      .from(qa('.act-rx-plate-code, .act-rx-plate img', lead), { opacity: 0, duration: 1.4, ease: EASE.settle }, 0.7)
      .from(parts, { opacity: 0, x: 22, duration: 1.1, stagger: 0.07, ease: EASE.soft, clearProps: 'transform' }, 0.35);
    var rows = qa('.act-rx-list li', box);
    if (rows.length) rise(rows, q('.act-rx-list', box), { y: 18, stagger: 0.07 });
  }

  function animateKnowledge() {
    var box = doc.getElementById('actKnowledge');
    if (!box || box.getAttribute('data-state') === 'loading') return;
    var first = box.firstElementChild;
    if (!shown(first)) return;
    var items = qa('.act-kn-item', box);
    var kinds = qa('.act-kn-kinds li', box);
    if (items.length) {
      rise(items, box, { y: 20, stagger: 0.12, duration: 1.5, ease: EASE.soft });
      var media = q('.act-kn-media', box);
      if (media) gsap.fromTo(media, { clipPath: 'inset(0% 0% 100% 0% round 20px)' },
        { clipPath: 'inset(0% 0% 0% 0% round 20px)', duration: 1.8, ease: EASE.sweep, clearProps: 'clipPath',
          scrollTrigger: { trigger: media, start: 'top 86%', toggleActions: TA } });
    }
    if (kinds.length) {
      rise([q('.act-kn-empty-k', box)], box, { y: 12, duration: 1.2 });
      if (activeTier === 'small') {
        rise(kinds, q('.act-kn-kinds', box), { y: 16, stagger: 0.1, duration: 1.4, ease: EASE.soft });
      } else {
        /* the rest: the contents are read line by line as you descend */
        gsap.fromTo(kinds, { opacity: 0.18 }, { opacity: 1, ease: 'none', stagger: 0.2,
          scrollTrigger: { trigger: q('.act-kn-kinds', box), start: 'top 80%', end: 'bottom 55%', scrub: 0.8 } });
      }
      rise([q('.act-note', box)], q('.act-note', box), { y: 14, duration: 1.3 });
    } else if (!items.length) {
      rise([first], box, { y: 14 });
    }
  }

  function animatePodcast() {
    var box = ready('actPodcast');
    var listEl = box && q('.act-pod-list', box);
    if (!shown(listEl)) return;
    var eps = qa('.act-pod-ep', listEl);
    rise(eps, listEl, { y: 22, stagger: 0.1 });
    gsap.from(qa('.act-pod-play', listEl), { scale: 0.5, opacity: 0, duration: 1, stagger: 0.1, ease: 'back.out(2.4)',
      clearProps: 'transform', scrollTrigger: { trigger: listEl, start: 'top 86%', toggleActions: TA } });
  }

  function animateCover() {
    var im = q('#actPodCover img');
    if (!shown(im)) return;
    gsap.from(im, { scale: 1.12, duration: 2, ease: EASE.reveal, clearProps: 'transform' });
  }

  function animateMoments() {
    var box = ready('actMoments');
    if (!box) return;
    var figs = qa('.act-moment', box).filter(shown);
    if (!figs.length) return;
    figs.forEach(function (f, i) {
      var media = q('.act-moment-media', f);
      var img = q('img', f);
      var cap = q('figcaption', f);
      var tl = gsap.timeline({ scrollTrigger: { trigger: f, start: 'top 88%', toggleActions: TA } });
      tl.fromTo(media, { clipPath: 'inset(14% 10% 14% 10% round 22px)', opacity: 0 },
        { clipPath: 'inset(0% 0% 0% 0% round 22px)', opacity: 1, duration: 1.7, ease: EASE.sweep, clearProps: 'clipPath' }, (i % 3) * 0.12);
      if (img) tl.fromTo(img, { scale: 1.28 }, { scale: 1, duration: 2.2, ease: EASE.reveal }, (i % 3) * 0.12);
      if (cap) tl.from(cap, { opacity: 0, y: 12, duration: 1.1, ease: EASE.soft, clearProps: 'transform' }, 0.9 + (i % 3) * 0.12);
      if (img && activeTier !== 'small') {
        gsap.fromTo(img, { yPercent: -4 }, { yPercent: 4, ease: 'none',
          scrollTrigger: { trigger: f, start: 'top bottom', end: 'bottom top', scrub: true } });
      }
    });
  }

  function animateAll() {
    animateNext();
    animateFeature();
    animateFlow();
    animateResearch();
    animateKnowledge();
    animatePodcast();
    animateCover();
    animateMoments();
    bindMagnetic();
  }

  /* The hero photograph: page-hero-image.js swaps in the CMS image —
     bring it in with a dissolve instead of a hard cut. */
  function watchHeroImage() {
    var img = q('.act-hero-img');
    if (!img) return;
    new MutationObserver(function (muts) {
      if (!muts.some(function (m) { return m.attributeName === 'src'; })) return;
      if (!gsap || activeTier === 'reduce') return;
      gsap.set(img, { opacity: 0 });
      var show = function () { gsap.to(img, { opacity: 1, duration: 1.3, ease: EASE.settle, clearProps: 'opacity' }); };
      if (img.complete && img.naturalWidth) show();
      else {
        img.addEventListener('load', show, { once: true });
        img.addEventListener('error', show, { once: true });
      }
    }).observe(img, { attributes: true, attributeFilter: ['src'] });
  }

  /* ================================================================
     4. CHOREOGRAPHY
     ================================================================ */

  /* ARRIVAL ------------------------------------------------------ */
  function entrance(tier) {
    if (entranceDone) return;
    entranceDone = true;
    if (win.__xpFailed) return;

    var small = tier === 'small';
    var letters = splitLetters(q('.act-hero-heading'));
    var plate = q('.act-hero-plate');
    var img = q('.act-hero-img');

    var tl = gsap.timeline({ defaults: { ease: EASE.reveal } });
    tl.from('.navbar', { yPercent: -100, duration: 1.2, clearProps: 'transform' }, 0)
      .from('.announce-bar', { yPercent: -100, opacity: 0, duration: 1.1, clearProps: 'transform,opacity' }, 0.14)
      .from('.act-hero .xp-depth--far', { opacity: 0, duration: 2.6, ease: EASE.settle }, 0.1)
      .from('.act-hero .xp-depth--near', { opacity: 0, duration: 2.4, ease: EASE.settle }, 0.5)
      .from('.act-hero .xp-hero-light', { opacity: 0, duration: 2.4, ease: EASE.settle }, 0.6)
      .fromTo(qa('.act-hero-top .act-hero-label, .act-hero-top .act-eyebrow'),
        { clipPath: 'inset(0% 100% 0% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: EASE.sweep, stagger: 0.22, clearProps: 'clipPath' }, 0.3)
      .from('.act-hero-rule', { scaleX: 0, transformOrigin: '0% 50%', duration: 1.2, ease: EASE.sweep, clearProps: 'transform' }, 0.45)
      /* the word is set letter by letter — weight, not bounce */
      .from(letters, { yPercent: 108, duration: small ? 1.1 : 1.45, stagger: small ? 0.03 : 0.045, clearProps: 'transform' }, 0.5);

    if (plate) {
      tl.fromTo(plate, { clipPath: 'inset(100% 0% 0% 0% round 28px)' },
        { clipPath: 'inset(0% 0% 0% 0% round 28px)', duration: 1.7, ease: EASE.sweep, clearProps: 'clipPath' }, 0.7);
      if (img) tl.from(img, { scale: 1.25, duration: 2.4, ease: EASE.reveal, clearProps: 'transform' }, 0.7);
      tl.from('.act-hero-plate-tick', { opacity: 0, duration: 1, stagger: 0.15, ease: EASE.settle }, 1.6);
    }

    /* the five strands arrive in sequence, joined by their rules */
    tl.from('.act-streams a', { opacity: 0, y: 14, duration: 0.9, stagger: 0.11, ease: EASE.soft, clearProps: 'transform' }, 1.15)
      .from('.act-streams-sep', { scaleX: 0, duration: 0.7, stagger: 0.11, ease: EASE.sweep, clearProps: 'transform' }, 1.3)
      .from('.act-hero-desc', { opacity: 0, y: 18, duration: 1.2, ease: EASE.soft, clearProps: 'transform' }, 1.45)
      .add(function () { animateNext(); }, 1.6)
      .from('.act-index li', { opacity: 0, y: 10, duration: 1, stagger: 0.05, ease: EASE.soft, clearProps: 'transform' }, 1.7)
      .from('.act-scroll-cue', { opacity: 0, duration: 1.4, ease: EASE.settle }, 2);
  }

  function heroExit() {
    gsap.timeline({ scrollTrigger: { trigger: '.act-hero', start: 'top top', end: 'bottom top', scrub: 0.9 } })
      .to('.act-hero-top, .act-hero-heading, .act-streams, .act-hero-foot, .act-index', { y: -110, opacity: 0.15, ease: 'none' }, 0)
      /* the plate travels slower than the type (the photograph itself
         belongs to the entrance, so it is not touched here) */
      .to('.act-hero-plate', { y: -50, ease: 'none' }, 0)
      .to('.act-hero .mo-aurora', { y: 160, scale: 1.18, ease: 'none' }, 0)
      .to('.act-hero-grid', { y: 80, ease: 'none' }, 0)
      .to('.act-hero-swirl', { rotation: 60, y: 90, ease: 'none' }, 0)
      .to('.act-hero-flow', { y: 70, ease: 'none' }, 0)
      .to('.act-scroll-cue', { opacity: 0, ease: 'none', duration: 0.3 }, 0);
  }

  /* The signal travels: a short bright segment runs the hero lines */
  function heroPulses() {
    var tweens = qa('.act-flow-pulse').map(function (p, i) {
      var len = p.getTotalLength();
      gsap.set(p, { strokeDasharray: '140 ' + len, strokeDashoffset: 140, opacity: 1 });
      return gsap.to(p, { strokeDashoffset: -len, duration: 7 + i * 2.5, delay: 1.8 + i * 1.6,
        ease: 'power1.inOut', repeat: -1, repeatDelay: 1.4 + i });
    });
    ST.create({ trigger: '.act-hero', start: 'top bottom', end: 'bottom top',
      onToggle: function (self) { tweens.forEach(function (t) { t.paused(!self.isActive); }); } });
  }

  /* ECOSYSTEM ---------------------------------------------------- */
  function ecosystem(tier, fine) {
    X.headingReveal({ label: '.act-explore-label', title: '.act-explore-title', extras: ['.act-explore-sub'], small: tier === 'small' });
    rise(eco.cards, '.act-cards-grid', { y: 30, stagger: 0.09, start: 'top 84%' });

    if (tier !== 'small') {
      var map = q('.act-eco-map');
      var rings = qa('.act-eco-pt-ring, .act-eco-pt-core', map);
      var ringLinks = qa('.act-eco-link:not(.act-eco-link--chord)', map);
      var tl = gsap.timeline({ scrollTrigger: { trigger: map, start: 'top 80%', toggleActions: TA } });
      tl.from(qa('.act-eco-sat, .act-eco-tether', map), { opacity: 0, duration: 1.4, stagger: 0.02, ease: EASE.settle }, 0)
        .fromTo(ringLinks,
          { strokeDasharray: function (k, s) { return s.getTotalLength(); }, strokeDashoffset: function (k, s) { return s.getTotalLength(); } },
          { strokeDashoffset: 0, duration: 1.5, stagger: 0.12, ease: 'power2.inOut',
            onComplete: function () { gsap.set(ringLinks, { clearProps: 'strokeDasharray,strokeDashoffset' }); } }, 0.15)
        .from(qa('.act-eco-link--chord', map), { opacity: 0, duration: 1.2, stagger: 0.15, ease: EASE.settle }, 0.9)
        .from(rings, { scale: 0, transformOrigin: '50% 50%', duration: 1, stagger: 0.06, ease: 'back.out(2.2)', clearProps: 'transform' }, 0.3)
        .from(qa('.act-eco-pt-label', map), { opacity: 0, duration: 1, stagger: 0.08, ease: EASE.settle }, 0.7)
        .from('.act-eco-readout', { opacity: 0, y: 10, duration: 1, ease: EASE.soft, clearProps: 'transform' }, 1);
    }

    /* touch / narrow: the strand under the reader's eye lights */
    if (!fine || tier === 'small') {
      eco.cards.forEach(function (card, k) {
        ST.create({ trigger: card, start: 'top 62%', end: 'bottom 62%',
          onToggle: function (self) { if (self.isActive) setStrand(k); } });
      });
    }
  }

  /* EVENTS ------------------------------------------------------- */
  function events(tier) {
    X.headingReveal({ label: '#act-events .act-head .act-eyebrow', title: '#actEventsTitle', extras: ['#act-events .act-sub'], small: tier === 'small' });
    rise(qa('.act-flow-head > *'), '.act-flow-head', { y: 20, stagger: 0.1 });
    animateFeature();

    if (tier !== 'small') {
      gsap.fromTo('#act-events > .mo-aurora', { scale: 0.8, opacity: 0.35 }, { scale: 1.15, opacity: 1, ease: 'none',
        scrollTrigger: { trigger: '#act-events', start: 'top bottom', end: 'bottom top', scrub: true } });
    } else {
      /* the vertical feed draws its thread as it is read */
      gsap.fromTo('#actFlowList', { '--act-fill': 0 }, { '--act-fill': 1, ease: 'none',
        scrollTrigger: { trigger: '#actFlowList', start: 'top 72%', end: 'bottom 72%', scrub: 0.6 } });
    }
  }

  /* The chronology: pinned, read sideways (full tier, tall viewports) */
  function flowPin() {
    var section = q('#actFlow');
    var list = q('#actFlowList');
    var vp = q('.act-flow-viewport');
    var meter = q('.act-flow-meter-fill');
    if (!section || !list || !vp) return;
    section.classList.add('is-pinned', 'is-reading');

    var state = { items: [], visible: 0, padL: 0 };

    function navBottom() {
      var bar = q('.announce-bar') || q('.navbar');
      return bar ? Math.max(0, bar.getBoundingClientRect().bottom) : 0;
    }

    function visibleWidth() {
      var cs = getComputedStyle(vp);
      state.padL = parseFloat(cs.paddingLeft) || 0;
      return vp.clientWidth - state.padL - (parseFloat(cs.paddingRight) || 0);
    }

    function dist() { return Math.max(0, list.offsetWidth - visibleWidth()); }

    function cache() {
      state.visible = visibleWidth();
      state.items = qa('.act-flow-item', list).map(function (li) { return { li: li, x: li.offsetLeft + 6 }; });
      paint();
    }

    function paint() {
      var x = gsap.getProperty(list, 'x') || 0;
      var readAt = state.visible * 0.62;
      var w = list.offsetWidth || 1;
      state.items.forEach(function (it) { it.li.classList.toggle('is-lit', it.x + x <= readAt); });
      list.style.setProperty('--act-fill', clamp((readAt - x) / w, 0, 1).toFixed(4));
      if (meter && tween) gsap.set(meter, { scaleX: tween.progress() });
    }

    var tween = gsap.to(list, {
      x: function () { return -dist(); },
      ease: 'none',
      onUpdate: paint,
      scrollTrigger: {
        trigger: section,
        start: function () { return 'top ' + Math.round(navBottom() + 28) + 'px'; },
        end: function () { return '+=' + Math.max(1, Math.round(dist() * 1.15)); },
        pin: true,
        scrub: 0.8,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onRefresh: cache
      }
    });

    /* keyboard: the browser scrolls a focused card into view by moving
       the clipped viewport's scrollLeft, which would double the track
       offset. Undo that and scroll the page to the card's place in the
       pinned sequence instead. */
    var focusLi = null;
    function bringIntoView() {
      if (!focusLi || !tween.scrollTrigger) return;
      var d = dist();
      var p = d ? clamp((focusLi.offsetLeft - state.visible * 0.3) / d, 0, 1) : 0;
      var st = tween.scrollTrigger;
      win.scrollTo(0, Math.round(st.start + p * (st.end - st.start)));
      focusLi = null;
    }
    function onFocus(e) {
      focusLi = e.target.closest && e.target.closest('.act-flow-item');
      if (focusLi) win.requestAnimationFrame(bringIntoView);
    }
    function onVpScroll() { if (vp.scrollLeft !== 0) vp.scrollLeft = 0; }
    list.addEventListener('focusin', onFocus);
    vp.addEventListener('scroll', onVpScroll, { passive: true });

    flow = { cache: cache };
    tierCleanups.push(function () {
      list.removeEventListener('focusin', onFocus);
      vp.removeEventListener('scroll', onVpScroll);
      section.classList.remove('is-pinned', 'is-reading');
      list.style.removeProperty('--act-fill');
      qa('.act-flow-item', list).forEach(function (li) { li.classList.remove('is-lit'); });
      if (meter) gsap.set(meter, { clearProps: 'transform' });
      flow = null;
    });
  }

  /* MOMENTUM ----------------------------------------------------- */
  function momentum(tier) {
    X.headingReveal({ label: '.act-impact-label', title: '.act-impact-title', small: tier === 'small' });
    var cards = qa('.act-impact-section .act-stat-card');
    cards.forEach(function (c) { c.classList.add('xp-t'); });
    gsap.timeline({ scrollTrigger: { trigger: '.act-impact-section .act-stats-grid', start: 'top 86%', toggleActions: TA,
      onEnter: function () { counter.reveal(); }, onLeave: function () { counter.reveal(); } } })
      .fromTo(cards, { '--xp-ty': '30px', opacity: 0 }, { '--xp-ty': '0px', opacity: 1, duration: 1.3, ease: EASE.reveal, stagger: 0.09 }, 0);
    if (tier !== 'small') {
      gsap.fromTo('.act-bigword span', { x: '6vw' }, { x: '-22vw', ease: 'none',
        scrollTrigger: { trigger: '.act-impact-section', start: 'top bottom', end: 'bottom top', scrub: true } });
    }
  }

  /* RESEARCH ----------------------------------------------------- */
  function research(tier) {
    X.headingReveal({ label: '#act-research .act-eyebrow', title: '#actResearchTitle', extras: ['#act-research .act-sub'], small: tier === 'small' });
    animateResearch();
    rise(qa('#act-research .act-sec-foot'), '#act-research .act-sec-foot', { y: 12 });

    if (tier !== 'small') {
      var svg = q('.act-rx-schematic');
      var strokes = qa('.act-rx-ring, .act-rx-trace, .act-rx-link', svg);
      strokes.forEach(function (s, i) {
        var len = s.getTotalLength();
        gsap.fromTo(s, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, ease: 'none',
          scrollTrigger: { trigger: '#act-research', start: 'top 85%', end: 'center 45%', scrub: 0.8 + i * 0.15 } });
      });
      gsap.from(qa('.act-rx-chip, .xp-signal-node', svg), { opacity: 0, scale: 0.4, transformOrigin: '50% 50%', duration: 1,
        stagger: 0.12, ease: 'back.out(2)', scrollTrigger: { trigger: '#act-research', start: 'top 55%', toggleActions: TA } });
      gsap.fromTo(svg, { rotation: -6, y: 60 }, { rotation: 4, y: -60, ease: 'none',
        scrollTrigger: { trigger: '#act-research', start: 'top bottom', end: 'bottom top', scrub: true } });
    }
  }

  /* KNOWLEDGE — the rest ----------------------------------------- */
  function knowledge(tier) {
    X.headingReveal({ label: '#act-knowledge .act-eyebrow', title: '#actKnowledgeTitle',
      extras: ['#act-knowledge .act-sub', '#act-knowledge .act-kn-head .act-link'], slow: 1.3, small: tier === 'small' });
    animateKnowledge();
  }

  /* PODCAST ------------------------------------------------------ */
  function podcast(tier) {
    X.headingReveal({ label: '#act-podcast .act-eyebrow', title: '#actPodcastTitle', extras: ['#act-podcast .act-sub'], small: tier === 'small' });
    var art = q('.act-pod-art');
    var tl = gsap.timeline({ scrollTrigger: { trigger: art, start: 'top 80%', toggleActions: TA } });
    /* the orbits' transform belongs to their CSS rotation — fade only */
    tl.from('.act-pod-orbit', { opacity: 0, duration: 1.8, stagger: 0.15, ease: EASE.settle }, 0)
      .from('.act-pod-cover', { opacity: 0, y: 40, rotation: -5, duration: 1.6, ease: EASE.reveal, clearProps: 'transform' }, 0.15)
      .fromTo('.act-pod-wave', { clipPath: 'inset(0% 50% 0% 50%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.6, ease: EASE.sweep, clearProps: 'clipPath' }, 0.6);
    animatePodcast();
    animateCover();
    rise(qa('#act-podcast .act-sec-foot'), '#act-podcast .act-sec-foot', { y: 12 });
    if (tier !== 'small') {
      gsap.fromTo(art, { y: 50 }, { y: -50, ease: 'none',
        scrollTrigger: { trigger: '#act-podcast', start: 'top bottom', end: 'bottom top', scrub: true } });
      gsap.fromTo('#act-podcast > .mo-aurora', { scale: 0.8 }, { scale: 1.15, ease: 'none',
        scrollTrigger: { trigger: '#act-podcast', start: 'top bottom', end: 'bottom top', scrub: true } });
    }
  }

  /* MOMENTS ------------------------------------------------------ */
  function moments(tier) {
    X.headingReveal({ label: '#act-moments .act-eyebrow', title: '#actMomentsTitle', extras: ['#act-moments .act-sub'], small: tier === 'small' });
    animateMoments();
    rise(qa('#act-moments .act-sec-foot'), '#act-moments .act-sec-foot', { y: 12 });
  }

  /* GET INVOLVED — the signal gathers ---------------------------- */
  function join(tier) {
    X.headingReveal({ label: '.act-cta-label', title: '.act-cta-heading', extras: ['.act-cta-desc', '.act-cta-buttons'], small: tier === 'small' });
    var paths = qa('.act-cta-path');
    if (tier !== 'small') {
      gsap.fromTo('.act-cta-section .xp-cta-panel',
        { clipPath: 'inset(3% 4% 0% 4% round 40px)' },
        { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none',
          scrollTrigger: { trigger: '.act-cta-section', start: 'top 90%', end: 'top 10%', scrub: 0.6 } });
      gsap.fromTo('.act-cta-section .mo-aurora', { scale: 0.6, opacity: 0.25 }, { scale: 1.12, opacity: 1, ease: 'none',
        scrollTrigger: { trigger: '.act-cta-section', start: 'top bottom', end: 'center center', scrub: true } });
      gsap.fromTo('.act-cta-section .xp-grid--cta', { opacity: 0 }, { opacity: 1, ease: 'none',
        scrollTrigger: { trigger: '.act-cta-section', start: 'top 70%', end: 'center center', scrub: true } });
      /* the four lines run in from the edges and meet behind the heading */
      paths.forEach(function (p, i) {
        var len = p.getTotalLength();
        gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, ease: 'none',
          scrollTrigger: { trigger: '.act-cta-section', start: 'top 80%', end: 'center 55%', scrub: 0.7 + i * 0.2 } });
      });
      gsap.from('.act-cta-core', { scale: 0, opacity: 0, duration: 1.2, ease: 'back.out(2.4)',
        scrollTrigger: { trigger: '.act-cta-section', start: 'center 62%', toggleActions: TA } });
    } else {
      gsap.from(paths, { opacity: 0, duration: 1.6, stagger: 0.15, ease: EASE.settle,
        scrollTrigger: { trigger: '.act-cta-section', start: 'top 75%', toggleActions: TA } });
    }
  }

  function footerSettle() {
    var cols = qa('.footer-col');
    cols.forEach(function (c) { c.classList.add('xp-t'); });
    gsap.timeline({ scrollTrigger: { trigger: '.footer', start: 'top 92%', toggleActions: TA } })
      .fromTo(cols, { '--xp-ty': '26px', opacity: 0 }, { '--xp-ty': '0px', opacity: 1, duration: 1.5, ease: EASE.reveal, stagger: 0.1 }, 0)
      .from('.footer-bottom', { opacity: 0, duration: 1.4, ease: EASE.settle }, 0.5);
  }

  /* ================================================================
     5. BOOT
     ================================================================ */

  function boot() {
    prep();
    doc.addEventListener('act:feed', function (e) { onFeed(e.detail && e.detail.key); });

    if (!gsap || !ST) {
      X.releasePending();
      return;
    }

    gsap.registerPlugin(ST);
    ST.config({ ignoreMobileResize: true });
    watchHeroImage();
    counter = X.createCounter(qa('#statEventsCount, #statProjectsCount'));

    var mm = gsap.matchMedia();
    mm.add({
      full:   '(min-width: 1024px)',
      mid:    '(min-width: 768px) and (max-width: 1023px)',
      small:  '(max-width: 767px)',
      tall:   '(min-height: 760px)',
      reduce: '(prefers-reduced-motion: reduce)',
      fine:   '(hover: hover) and (pointer: fine)'
    }, function (context) {
      var c = context.conditions;

      if (c.reduce) {
        X.releasePending();
        activeCtx = null;
        activeTier = 'reduce';
        entranceDone = true;
        counter.allow(false);
        counter.finish();
        return;
      }

      var tier = (c.small || X.lowPower) ? 'small' : c.full ? 'full' : 'mid';
      activeTier = tier;
      activeCtx = context;
      counter.allow(true);

      /* Same task as the entrance's first frame → no flash */
      X.releasePending();
      entrance(tier);
      ecosystem(tier, c.fine);
      events(tier);
      if (tier === 'full' && c.tall) flowPin();
      animateFlow();
      momentum(tier);
      research(tier);
      knowledge(tier);
      podcast(tier);
      moments(tier);
      join(tier);
      footerSettle();

      if (tier !== 'small') {
        heroExit();
        heroPulses();
        X.progressLine();
        if (tier === 'full') X.rail(JOURNEY, '.footer');
        if (c.fine) tierCleanups.push(X.heroPointer(q('.act-hero')));
      }
      animateAll();

      return function () {
        tierCleanups.forEach(function (fn) { fn(); });
        tierCleanups = [];
        activeCtx = null;
        qa('.act-feature-card, .act-flow-item, .act-rx-lead, .act-pod-list, .act-moment, #actHeroNext, #actPodCover img')
          .forEach(function (el) { el._xpShown = false; });
        var kn = doc.getElementById('actKnowledge');
        if (kn && kn.firstElementChild) kn.firstElementChild._xpShown = false;
      };
    });

    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(X.queueRefresh);
    var main = q('main');
    if (main) main.addEventListener('load', function (e) {
      if (e.target && e.target.tagName === 'IMG') X.queueRefresh();
    }, true);
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();

}(window, document));
