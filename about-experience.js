/* ================================================================
   about-experience.js — IEEE EMBS KPRIET (about.html only)

   The single motion engine for the About page (GSAP + ScrollTrigger,
   with shared helpers from experience-core.js). animations.js and
   motion.js are not loaded on this page, so every animated element
   has exactly one owner.

   CMS content is never generated here. The data scripts
   (about-info, about-timeline, members-public, about-people,
   about-brochure, page-hero-image, home-stats) fill the page; this
   engine observes what they insert and animates it.

   TIERS (gsap.matchMedia — rebuilt cleanly when they change)
     full   ≥1024px — complete experience; Mission→Vision pins when
                      the viewport is tall enough to hold it
     mid    768–1023 — scroll-linked but no pinning, no rail
     small  <768px  (or data-saver) — reveals only, recomposed layout
     reduce          — nothing moves; every element at rest, visible

   TEMPO through the story
     arrival   strongest — sequenced entrance, scroll exit with depth
     who       editorial — the photograph opens, type drifts behind
     purpose   a pause — the statement is read word by word
     mission → vision — the signature: the signal travels between them
     what we do — the system assembles; lines light on hover
     focus     the axis lights term by term; icons draw
     journey   the track draws as you move through time
     people    slowest — portraits open gently, never distorted
     community live figures count up
     join      the opening light returns and expands
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
  var q = X.q, qa = X.qa, EASE = X.EASE;

  var JOURNEY = [
    { sel: '.ab-hero',         theme: 'dark'  },
    { sel: '#about-embs',      theme: 'light' },
    { sel: '#purpose',         theme: 'dark'  },
    { sel: '#vision-mission',  theme: 'light' },
    { sel: '#what-we-do',      theme: 'dark'  },
    { sel: '#focus-areas',     theme: 'light' },
    { sel: '#chapter-history', theme: 'dark'  },
    { sel: '#people',          theme: 'light' },
    { sel: '#community',       theme: 'dark'  },
    { sel: '#join-embs',       theme: 'dark'  }
  ];

  var TITLES = ['.ab-hero-title', '.about-embs-heading', '.ab-mv-title', '.ab-do-title',
                '.focus-title', '.timeline-title', '.ab-people-title', '.ab-impact-title', '.join-title'];

  var activeCtx = null;
  var activeTier = 'reduce';
  var entranceDone = false;
  var counter = null;

  /* ================================================================
     1. STATIC PREP (works with or without GSAP)
     ================================================================ */

  /* Mirror the CMS "established" year (written into #aboutEstYear by
     about-info.js) into every [data-ab-est] slot. */
  function mirrorEst(force) {
    var src = doc.getElementById('aboutEstYear');
    if (!src) return;
    var year = src.textContent.trim();
    if (!year) return;
    qa('[data-ab-est]').forEach(function (el) {
      if (force || el.textContent.trim() === '—' || el._abMirrored) {
        el.textContent = year;
        el._abMirrored = true;
      }
    });
  }

  function watchEst() {
    var src = doc.getElementById('aboutEstYear');
    if (!src) return;
    new MutationObserver(function () { mirrorEst(true); })
      .observe(src, { childList: true, characterData: true, subtree: true });
  }

  /* The ecosystem lines: hub → each node, recomputed from real layout */
  function layoutEco() {
    var eco = q('.ab-eco');
    var svg = q('.ab-eco-lines');
    var hub = q('.ab-eco-hub');
    if (!eco || !svg || !hub || getComputedStyle(svg).display === 'none') return;
    var er = eco.getBoundingClientRect();
    var hr = hub.getBoundingClientRect();
    var hx = hr.left - er.left + hr.width / 2;
    var hy = hr.top - er.top + hr.height / 2;
    svg.setAttribute('viewBox', '0 0 ' + er.width + ' ' + er.height);

    qa('.ab-eco-node', eco).forEach(function (node, i) {
      var nr = node.getBoundingClientRect();
      var nx = nr.left - er.left + nr.width / 2;
      var ny = nr.top - er.top + nr.height / 2;
      /* end on the node edge nearest the hub */
      var ex = nx < hx - 10 ? nr.right - er.left : nx > hx + 10 ? nr.left - er.left : nx;
      var ey = Math.abs(nx - hx) <= 10 ? nr.top - er.top : ny;
      var mx = (hx + ex) / 2;
      var d = 'M' + hx.toFixed(1) + ' ' + hy.toFixed(1) +
              ' C' + mx.toFixed(1) + ' ' + hy.toFixed(1) + ', ' + mx.toFixed(1) + ' ' + ey.toFixed(1) +
              ', ' + ex.toFixed(1) + ' ' + ey.toFixed(1);
      var path = node._abLine;
      if (!path) {
        path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'ab-eco-line');
        svg.appendChild(path);
        node._abLine = path;
        node.addEventListener('pointerenter', function () { path.classList.add('is-hot'); });
        node.addEventListener('pointerleave', function () { path.classList.remove('is-hot'); });
        node.addEventListener('focus', function () { path.classList.add('is-hot'); });
        node.addEventListener('blur', function () { path.classList.remove('is-hot'); });
      }
      path.setAttribute('d', d);
      void i;
    });
  }

  function prep() {
    TITLES.forEach(function (s) { X.splitLines(q(s)); });
    X.splitWords(q('.ab-purpose-title'));
    X.prepRail(JOURNEY);
    X.bindGlow();
    watchEst();      /* mirrored on the CMS write, or when first revealed */
    layoutEco();
  }

  /* ================================================================
     2. CMS-DRIVEN CONTENT
     ================================================================ */

  function observe(el, fn) {
    if (!el) return;
    new MutationObserver(function () {
      fn();
      X.queueRefresh();
    }).observe(el, { childList: true });
  }

  /* Timeline milestones from GET /api/timeline */
  function animateTimeline() {
    if (!activeCtx || activeTier === 'reduce') return;
    activeCtx.add(function () {
      qa('#timelineContainer > *').forEach(function (el) {
        if (el._xpShown) return;
        el._xpShown = true;
        revealMilestone(el);
      });
    });
  }

  /* Faculty portraits from about-people.js */
  function animateFaculty() {
    if (!activeCtx || activeTier === 'reduce') return;
    activeCtx.add(function () {
      var figs = qa('#abFacultyGrid .ab-portrait').filter(function (f) { return !f._xpShown; });
      if (!figs.length) return;
      figs.forEach(function (f) { f._xpShown = true; });
      var tl = gsap.timeline({ paused: true });
      figs.forEach(function (f, i) {
        var media = q('.ab-portrait-media', f);
        var cap = qa('figcaption > *', f);
        tl.fromTo(media, { clipPath: 'inset(100% 0% 0% 0% round 24px)' },
          { clipPath: 'inset(0% 0% 0% 0% round 24px)', duration: 1.7, ease: EASE.sweep, clearProps: 'clipPath' }, i * 0.2)
          .from(cap, { opacity: 0, y: 12, duration: 1.2, stagger: 0.09, ease: EASE.soft, clearProps: 'transform' }, i * 0.2 + 0.6);
      });
      ST.create({ trigger: '#abFacultyGrid', start: 'top 85%', toggleActions: 'play none none none',
        onEnter: function () { tl.play(); } });
    });
  }

  /* The chapter photograph (page-hero-image.js creates the <img>) */
  function animatePhoto() {
    if (!activeCtx || activeTier === 'reduce' || activeTier === 'small') return;
    var img = q('.about-embs .about-hero-img');
    if (!img || img._xpShown) return;
    img._xpShown = true;
    activeCtx.add(function () {
      gsap.fromTo(img, { scale: 1.16, yPercent: -4 }, { scale: 1.06, yPercent: 4, ease: 'none',
        scrollTrigger: { trigger: '.about-embs .about-img-placeholder', start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  }

  function watchCMS() {
    observe(doc.getElementById('timelineContainer'), animateTimeline);
    observe(doc.getElementById('abFacultyGrid'), animateFaculty);
    observe(q('.about-embs .about-img-placeholder'), animatePhoto);

    /* Live figures: count up once the section is seen; a zero figure is
       left out rather than presented as evidence of activity. */
    counter = X.createCounter(qa('.ab-impact .stat-number'));
    counter.onValue = function (el, t) {
      var tile = el.closest('.ab-stat');
      if (tile) tile.hidden = t.n === 0;
      X.queueRefresh();
    };
  }

  /* ================================================================
     3. CHOREOGRAPHY
     ================================================================ */

  function revealMilestone(el) {
    var dot = q('.ab-milestone-dot, .timeline-dot', el);
    var parts = qa('.ab-milestone-year, .ab-milestone-title, .ab-milestone-desc, .timeline-year, .timeline-entry-title, .timeline-entry-desc', el);
    if (!parts.length) parts = [el];
    var tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 84%', toggleActions: 'play none none none' } });
    if (dot) tl.from(dot, { scale: 0, duration: 0.9, ease: 'back.out(2.2)', clearProps: 'transform' }, 0);
    tl.from(parts, { opacity: 0, x: -24, duration: 1.2, stagger: 0.08, ease: EASE.reveal, clearProps: 'transform' }, 0.1);
  }

  /* ARRIVAL ------------------------------------------------------ */
  function entrance(tier) {
    if (entranceDone) return;
    entranceDone = true;
    if (win.__xpFailed) { mirrorEst(false); return; }

    var small = tier === 'small';
    var lines = X.splitLines(q('.ab-hero-title'));
    var heart = q('.ab-hero-heart');
    if (heart) gsap.set(heart, { yPercent: -50, y: 0 });

    var tl = gsap.timeline({ defaults: { ease: EASE.reveal } });
    tl.from('.navbar', { yPercent: -100, duration: 1.2, clearProps: 'transform' }, 0)
      .from('.announce-bar', { yPercent: -100, opacity: 0, duration: 1.1, clearProps: 'transform,opacity' }, 0.14)
      .from('.ab-hero .xp-depth--far', { opacity: 0, duration: 2.8, ease: EASE.settle }, 0.1)
      .from('.ab-hero .xp-depth--near', { opacity: 0, duration: 2.6, ease: EASE.settle }, 0.4)
      .from('.ab-hero .xp-hero-light', { opacity: 0, duration: 2.4, ease: EASE.settle }, 0.6)
      .fromTo('.ab-hero-top .ab-eyebrow',
        { clipPath: 'inset(0% 100% 0% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: EASE.sweep, stagger: 0.25, clearProps: 'clipPath' }, 0.35)
      .from('.ab-hero-rule', { scaleX: 0, transformOrigin: '0% 50%', duration: 1.2, ease: EASE.sweep, clearProps: 'transform' }, 0.5)
      .from(lines, {
        yPercent: 116, rotation: small ? 0 : 2.5, transformOrigin: '0% 100%',
        duration: small ? 1.2 : 1.55, stagger: 0.12, clearProps: 'transform'
      }, 0.6)
      .from('.ab-hero-sub', { opacity: 0, y: 18, duration: 1.2, ease: EASE.soft, clearProps: 'transform' }, 1.25)
      .add(function () { mirrorEst(false); }, 1.3)
      .from('.ab-meta-item', { opacity: 0, y: 14, duration: 1.1, stagger: 0.1, ease: EASE.soft, clearProps: 'transform' }, 1.35)
      .from('.ab-index li', { opacity: 0, y: 10, duration: 1, stagger: 0.05, ease: EASE.soft, clearProps: 'transform' }, 1.55)
      .from('.ab-scroll-cue', { opacity: 0, duration: 1.4, ease: EASE.settle }, 1.9);
  }

  function heroExit() {
    gsap.timeline({ scrollTrigger: { trigger: '.ab-hero', start: 'top top', end: 'bottom top', scrub: 0.9 } })
      .to('.ab-hero-inner', { y: -100, opacity: 0.2, ease: 'none' }, 0)
      .to('.ab-hero .mo-aurora', { y: 160, scale: 1.18, ease: 'none' }, 0)
      .to('.ab-hero-grid', { y: 80, ease: 'none' }, 0)
      .to('.ab-hero-swirl', { rotation: 60, y: 90, ease: 'none' }, 0)
      .to('.ab-hero-heart', { yPercent: -40, scale: 1.08, ease: 'none' }, 0)
      .to('.ab-hero-trace', { rotation: -8, y: 60, transformOrigin: '62% 48%', ease: 'none' }, 0)
      .to('.ab-scroll-cue', { opacity: 0, ease: 'none', duration: 0.3 }, 0);
  }

  /* WHO WE ARE --------------------------------------------------- */
  function whoWeAre(tier) {
    X.headingReveal({ label: '.about-embs-label', title: '.about-embs-heading',
      extras: ['.about-embs-desc'], small: tier === 'small' });

    var facts = qa('.ab-fact');
    facts.forEach(function (f) { f.classList.add('xp-t'); });
    gsap.fromTo(facts, { '--xp-ty': '20px', opacity: 0 }, { '--xp-ty': '0px', opacity: 1, duration: 1.2,
      stagger: 0.08, ease: EASE.reveal, scrollTrigger: { trigger: '.ab-facts', start: 'top 88%', toggleActions: 'play none none none' } });

    var plate = q('.about-embs .about-img-placeholder');
    var est = q('.about-embs .about-est-card');
    if (est) est.classList.add('xp-t');
    var tl = gsap.timeline({ scrollTrigger: { trigger: '.about-embs .about-embs-right', start: 'top 80%', toggleActions: 'play none none none' } });
    if (plate) tl.fromTo(plate, { clipPath: 'inset(0% 0% 0% 100%)' },
      { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.8, ease: EASE.sweep, clearProps: 'clipPath' }, 0);
    if (est) tl.fromTo(est, { '--xp-ty': '30px', opacity: 0 }, { '--xp-ty': '0px', opacity: 1, duration: 1.3, ease: EASE.reveal }, 0.9);
    tl.from('.ab-figcap', { opacity: 0, duration: 1.2, ease: EASE.settle }, 1.1);

    if (tier !== 'small') {
      var words = qa('.ab-bigword span');
      if (words[0]) gsap.fromTo(words[0], { x: '4vw' }, { x: '-10vw', ease: 'none',
        scrollTrigger: { trigger: '#about-embs', start: 'top bottom', end: 'bottom top', scrub: true } });
      if (words[1]) gsap.fromTo(words[1], { x: '-6vw' }, { x: '6vw', ease: 'none',
        scrollTrigger: { trigger: '#about-embs', start: 'top bottom', end: 'bottom top', scrub: true } });
      animatePhoto();
    }
  }

  /* PURPOSE — the pause ------------------------------------------ */
  function purpose(tier) {
    var title = q('.ab-purpose-title');
    var words = X.splitWords(title);
    gsap.fromTo('.ab-purpose .ab-eyebrow', { clipPath: 'inset(0% 100% 0% 0%)' },
      { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: EASE.sweep, clearProps: 'clipPath',
        scrollTrigger: { trigger: '.ab-purpose', start: 'top 75%', toggleActions: 'play none none none' } });

    if (tier === 'small') {
      title.classList.add('xp-t');
      gsap.fromTo(title, { '--xp-ty': '24px', opacity: 0 }, { '--xp-ty': '0px', opacity: 1, duration: 1.4,
        ease: EASE.reveal, scrollTrigger: { trigger: title, start: 'top 85%', toggleActions: 'play none none none' } });
    } else {
      /* read along: each word brightens as the reader moves through it */
      gsap.fromTo(words, { opacity: 0.14 }, { opacity: 1, ease: 'none', stagger: 0.1,
        scrollTrigger: { trigger: title, start: 'top 78%', end: 'bottom 42%', scrub: 0.6 } });
    }

    var sub = q('.ab-purpose-sub');
    sub.classList.add('xp-t');
    gsap.fromTo(sub, { '--xp-ty': '18px', opacity: 0 }, { '--xp-ty': '0px', opacity: 1, duration: 1.3,
      ease: EASE.soft, scrollTrigger: { trigger: sub, start: 'top 88%', toggleActions: 'play none none none' } });

    /* the triad lights term by term */
    var triad = q('.ab-triad');
    var items = qa('.ab-triad-item');
    triad.classList.add('is-reading');
    ST.create({
      trigger: triad, start: 'top 88%', end: 'top 40%',
      onUpdate: function (self) {
        var lit = Math.ceil(self.progress * items.length);
        items.forEach(function (it, i) { it.classList.toggle('is-lit', i < lit); });
      },
      onLeave: function () { items.forEach(function (it) { it.classList.add('is-lit'); }); }
    });

    if (tier !== 'small') {
      qa('.ab-purpose .xp-signal-path').forEach(function (p, i) {
        var len = p.getTotalLength();
        gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, ease: 'none',
          scrollTrigger: { trigger: '.ab-purpose', start: 'top 60%', end: 'bottom 70%', scrub: 1 + i * 0.4 } });
      });
      gsap.fromTo('.ab-purpose .mo-aurora', { scale: 0.8, opacity: 0.4 }, { scale: 1.15, opacity: 1, ease: 'none',
        scrollTrigger: { trigger: '.ab-purpose', start: 'top bottom', end: 'bottom top', scrub: true } });
    }
  }

  /* MISSION → VISION — the signature transition ------------------ */
  function missionVision(tier, tall) {
    X.headingReveal({ label: '.ab-mv .ab-eyebrow', title: '.ab-mv-title', small: tier === 'small' });

    var mission = q('.ab-mv-card--mission');
    var vision = q('.ab-mv-card--vision');
    var link = q('.ab-mv-link');
    var fill = q('.ab-mv-link-fill');
    var node = q('.ab-mv-link-node');
    var glow = q('.ab-mv-glow');
    var stacked = tier !== 'full';
    [mission, vision].forEach(function (c) { c.classList.add('xp-t'); });

    var missionParts = qa('.ab-mv-kicker, .about-vm-icon, .about-vm-title, .about-vm-text', mission);
    var visionParts = qa('.ab-mv-kicker, .about-vm-icon, .about-vm-title, .about-vm-text', vision);

    if (tier === 'full' && tall) {
      /* Mission is stated as the reader arrives (never an empty stage)… */
      gsap.timeline({ scrollTrigger: { trigger: '.ab-mv-stage', start: 'top 82%', toggleActions: 'play none none none' } })
        .fromTo(mission, { '--xp-tx': '-40px', opacity: 0 }, { '--xp-tx': '0px', opacity: 1, duration: 1.4, ease: EASE.reveal }, 0)
        .from(missionParts, { opacity: 0, y: 18, stagger: 0.08, duration: 1.1, ease: EASE.soft, clearProps: 'transform' }, 0.25);

      /* …then, pinned: the signal travels and Vision comes into the light.
         Vision rests visible but dimmed, so the stage is never empty. */
      var tl = gsap.timeline({
        defaults: { ease: 'none' },
        /* the card stage holds the centre of the screen (clear of the
           fixed navigation) while the header scrolls away */
        scrollTrigger: { trigger: '.ab-mv-stage', start: 'center 56%', end: '+=90%', pin: true, scrub: 0.8,
          anticipatePin: 1, invalidateOnRefresh: true }
      });
      tl.fromTo(fill, { scaleX: 0 }, { scaleX: 1, duration: 0.4 }, 0)
        .fromTo(node, { x: function () { return -link.offsetWidth; } }, { x: 0, duration: 0.4 }, 0)
        .fromTo(vision, { '--xp-tx': '24px' }, { '--xp-tx': '0px', duration: 0.35 }, 0.32)
        .fromTo(glow, { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5 }, 0.36)
        /* the text is always legible; the pin only brings it into full light */
        .fromTo(visionParts, { opacity: 0.6, y: 10 }, { opacity: 1, y: 0, stagger: 0.05, duration: 0.25 }, 0.45)
        .to(mission, { opacity: 0.72, duration: 0.3 }, 0.5)
        .to({}, { duration: 0.12 });
    } else {
      var tl2 = gsap.timeline({ scrollTrigger: { trigger: '.ab-mv-stage', start: 'top 78%', toggleActions: 'play none none none' } });
      tl2.fromTo(mission, { '--xp-ty': '36px', opacity: 0 }, { '--xp-ty': '0px', opacity: 1, duration: 1.3, ease: EASE.reveal }, 0)
        .fromTo(fill, stacked ? { scaleY: 0 } : { scaleX: 0 }, stacked ? { scaleY: 1, duration: 0.9, ease: EASE.sweep } : { scaleX: 1, duration: 0.9, ease: EASE.sweep }, 0.55)
        .fromTo(node, stacked ? { y: -64 } : { x: function () { return -link.offsetWidth; } },
          stacked ? { y: 0, duration: 0.9, ease: EASE.sweep } : { x: 0, duration: 0.9, ease: EASE.sweep }, 0.55)
        .fromTo(vision, { '--xp-ty': '36px', opacity: 0 }, { '--xp-ty': '0px', opacity: 1, duration: 1.3, ease: EASE.reveal }, 1.15)
        .fromTo(glow, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 2, ease: EASE.settle }, 1.2);
    }
  }

  /* WHAT WE DO — the system assembles ----------------------------- */
  function whatWeDo(tier) {
    X.headingReveal({ label: '.ab-do .ab-eyebrow', title: '.ab-do-title', extras: ['.ab-do-sub'], small: tier === 'small' });
    var nodes = qa('.ab-eco-node');
    nodes.forEach(function (n) { n.classList.add('xp-t'); });
    var tl = gsap.timeline({ scrollTrigger: { trigger: '.ab-eco', start: 'top 80%', toggleActions: 'play none none none' } });
    tl.from('.ab-eco-hub', { opacity: 0, scale: 0.86, duration: 1.4, ease: EASE.reveal, clearProps: 'transform' }, 0)
      .fromTo(nodes, { '--xp-ty': '40px', opacity: 0 }, { '--xp-ty': '0px', opacity: 1, duration: 1.3, ease: EASE.reveal, stagger: 0.1 }, 0.2);
    var ecoLines = qa('.ab-eco-line');
    if (ecoLines.length) tl.from(ecoLines, { opacity: 0, duration: 1.2, stagger: 0.08, ease: EASE.settle }, 0.6);
    if (tier !== 'small') {
      gsap.to('.ab-eco-hub-ring', { rotation: 90, ease: 'none',
        scrollTrigger: { trigger: '.ab-do', start: 'top bottom', end: 'bottom top', scrub: true } });
    }
  }

  /* FOCUS — biology × engineering --------------------------------- */
  function focusAreas(tier) {
    X.headingReveal({ label: '.focus-label', title: '.focus-title', extras: ['.ab-focus-intro'], small: tier === 'small' });

    var axis = q('.ab-axis');
    var terms = qa('.ab-axis-term');
    axis.classList.add('is-reading');
    ST.create({
      trigger: axis, start: 'top 85%', end: 'top 45%',
      onUpdate: function (self) {
        var lit = Math.ceil(self.progress * terms.length);
        terms.forEach(function (t, i) { t.classList.toggle('is-lit', i < lit); });
        axis.style.setProperty('--ab-axis', self.progress.toFixed(3));
      },
      onLeave: function () { terms.forEach(function (t) { t.classList.add('is-lit'); }); axis.style.setProperty('--ab-axis', 1); }
    });

    var cards = qa('.focus-section .focus-card');
    cards.forEach(function (c) { c.classList.add('xp-t'); });
    var shapes = [];
    cards.forEach(function (c) { shapes = shapes.concat(X.strokeShapes(q('.focus-icon', c))); });
    var tl = gsap.timeline({ scrollTrigger: { trigger: '.focus-section .focus-grid', start: 'top 82%', toggleActions: 'play none none none' } });
    tl.fromTo(cards, { '--xp-ty': '44px', opacity: 0 }, { '--xp-ty': '0px', opacity: 1, duration: 1.4, ease: EASE.reveal, stagger: 0.1 }, 0);
    if (shapes.length) tl.fromTo(shapes,
      { strokeDasharray: function (i, s) { return s._xpLen; }, strokeDashoffset: function (i, s) { return s._xpLen; } },
      { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut', stagger: 0.02,
        onComplete: function () { gsap.set(shapes, { clearProps: 'strokeDasharray,strokeDashoffset' }); } }, 0.4);

    var helix = q('.ab-helix');
    if (helix) {
      gsap.fromTo(helix, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 2, ease: EASE.sweep,
        clearProps: 'clipPath', scrollTrigger: { trigger: '.focus-section', start: 'top 75%', toggleActions: 'play none none none' } });
      if (tier !== 'small') {
        gsap.fromTo('.ab-helix img', { yPercent: -6 }, { yPercent: 6, ease: 'none',
          scrollTrigger: { trigger: '.focus-section', start: 'top bottom', end: 'bottom top', scrub: true } });
      }
    }
  }

  /* JOURNEY ------------------------------------------------------- */
  function journey() {
    X.headingReveal({ label: '.timeline-label', title: '.timeline-title', extras: ['.ab-journey-intro'] });
    gsap.fromTo('.ab-journey-fill', { scaleY: 0 }, { scaleY: 1, ease: 'none',
      scrollTrigger: { trigger: '.timeline-section .timeline-layout', start: 'top 70%', end: 'bottom 70%', scrub: 0.6 } });
    qa('.ab-milestone').forEach(revealMilestone);
    animateTimeline();
  }

  /* PEOPLE — the slowest tempo ------------------------------------ */
  function people(tier) {
    X.headingReveal({ label: '.ab-people .ab-eyebrow', title: '.ab-people-title', extras: ['.ab-people-sub'],
      slow: 1.2, small: tier === 'small' });
    gsap.fromTo('.ab-people-kicker', { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)',
      duration: 1.4, ease: EASE.sweep, clearProps: 'clipPath',
      scrollTrigger: { trigger: '.ab-faculty', start: 'top 85%', toggleActions: 'play none none none' } });
    animateFaculty();

    var panel = q('.ab-people .timeline-right-panel');
    var levels = qa('.ab-people .org-level');
    var connectors = qa('.ab-people .org-connector');
    var tl = gsap.timeline({ scrollTrigger: { trigger: panel, start: 'top 80%', toggleActions: 'play none none none' } });
    tl.from(qa('.timeline-right-label, .timeline-right-heading', panel), { opacity: 0, y: 14, duration: 1.2, stagger: 0.1, ease: EASE.soft, clearProps: 'transform' }, 0)
      .from(levels, { opacity: 0, y: 18, duration: 1.3, stagger: 0.16, ease: EASE.reveal, clearProps: 'transform' }, 0.25)
      .from(connectors, { scaleY: 0, duration: 0.9, stagger: 0.16, ease: EASE.sweep, clearProps: 'transform' }, 0.45)
      .from('.ab-people-more', { opacity: 0, duration: 1, ease: EASE.settle }, 1);
  }

  /* COMMUNITY ----------------------------------------------------- */
  function community(tier) {
    X.headingReveal({ label: '.ab-impact .ab-eyebrow', title: '.ab-impact-title', extras: ['.ab-impact-sub'], small: tier === 'small' });
    var stats = qa('.ab-stat');
    stats.forEach(function (s) { s.classList.add('xp-t'); });
    gsap.timeline({ scrollTrigger: { trigger: '.ab-impact-grid', start: 'top 85%', toggleActions: 'play none none none',
      onEnter: function () { mirrorEst(false); counter.reveal(); } } })
      .fromTo(stats, { '--xp-ty': '30px', opacity: 0 }, { '--xp-ty': '0px', opacity: 1, duration: 1.3, ease: EASE.reveal, stagger: 0.09 }, 0);
    if (tier !== 'small') {
      gsap.fromTo('.ab-impact .mo-aurora', { scale: 0.75 }, { scale: 1.1, ease: 'none',
        scrollTrigger: { trigger: '.ab-impact', start: 'top bottom', end: 'bottom top', scrub: true } });
    }
  }

  /* JOIN — the opening light returns ------------------------------ */
  function join(tier) {
    X.headingReveal({ label: '.join-label', title: '.join-title', extras: ['.join-desc', '.join-actions'], small: tier === 'small' });
    if (tier !== 'small') {
      gsap.fromTo('.join-section .xp-cta-panel',
        { clipPath: 'inset(3% 4% 0% 4% round 40px)' },
        { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none',
          scrollTrigger: { trigger: '.join-section', start: 'top 90%', end: 'top 10%', scrub: 0.6 } });
      gsap.fromTo('.join-section .mo-aurora', { scale: 0.6, opacity: 0.25 }, { scale: 1.12, opacity: 1, ease: 'none',
        scrollTrigger: { trigger: '.join-section', start: 'top bottom', end: 'center center', scrub: true } });
      gsap.fromTo('.join-section .xp-grid--cta', { opacity: 0 }, { opacity: 1, ease: 'none',
        scrollTrigger: { trigger: '.join-section', start: 'top 70%', end: 'center center', scrub: true } });
    }
  }

  function footerSettle() {
    var cols = qa('.footer-col');
    cols.forEach(function (c) { c.classList.add('xp-t'); });
    gsap.timeline({ scrollTrigger: { trigger: '.footer', start: 'top 92%', toggleActions: 'play none none none' } })
      .fromTo(cols, { '--xp-ty': '26px', opacity: 0 }, { '--xp-ty': '0px', opacity: 1, duration: 1.5, ease: EASE.reveal, stagger: 0.1 }, 0)
      .from('.footer-bottom', { opacity: 0, duration: 1.4, ease: EASE.settle }, 0.5);
  }

  /* ================================================================
     4. BOOT
     ================================================================ */

  function boot() {
    prep();
    win.addEventListener('resize', layoutEco, { passive: true });

    if (!gsap || !ST) {
      X.releasePending();
      mirrorEst(false);
      watchCMS();
      return;
    }

    gsap.registerPlugin(ST);
    ST.config({ ignoreMobileResize: true });
    ST.addEventListener('refresh', layoutEco);
    watchCMS();

    var mm = gsap.matchMedia();
    mm.add({
      full:   '(min-width: 1024px)',
      mid:    '(min-width: 768px) and (max-width: 1023px)',
      small:  '(max-width: 767px)',
      tall:   '(min-height: 700px)',
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
        mirrorEst(false);
        qa('.ab-triad, .ab-axis').forEach(function (el) { el.classList.remove('is-reading'); });
        return;
      }

      var tier = (c.small || X.lowPower) ? 'small' : c.full ? 'full' : 'mid';
      activeTier = tier;
      activeCtx = context;
      counter.allow(true);

      /* Same task as the entrance's first frame → no flash */
      X.releasePending();
      entrance(tier);
      whoWeAre(tier);
      purpose(tier);
      missionVision(tier, c.tall);
      whatWeDo(tier);
      focusAreas(tier);
      journey();
      people(tier);
      community(tier);
      join(tier);
      footerSettle();

      var cleanups = [];
      if (tier !== 'small') {
        heroExit();
        X.progressLine();
        if (tier === 'full') X.rail(JOURNEY, '.footer');
        if (c.fine) {
          cleanups.push(X.heroPointer(q('.ab-hero')));
          cleanups.push(X.magnetic('.xp-magnetic'));
        }
      }

      return function () {
        cleanups.forEach(function (fn) { fn(); });
        activeCtx = null;
        qa('#timelineContainer > *, #abFacultyGrid .ab-portrait, .about-embs .about-hero-img')
          .forEach(function (el) { el._xpShown = false; });
        qa('.ab-triad, .ab-axis').forEach(function (el) { el.classList.remove('is-reading'); });
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
