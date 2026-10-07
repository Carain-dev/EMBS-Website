/* ================================================================
   motion.js — IEEE EMBS KPRIET
   Additive motion layer. Runs alongside animations.js; it does not
   replace it and never touches elements animations.js owns.
   Vanilla JS, no dependencies.

   LOAD IT IN <head>, NOT DEFERRED:
     <link rel="stylesheet" href="motion.css" />
     <script src="motion.js"></script>
   It only sets a class on <html> immediately; all DOM work waits for
   DOMContentLoaded. Loading it late would let opted-in content paint
   visible, then hide, then reveal (a flash).

   WHAT IT DOES
   ──────────────────────────────────────────────────────────────
   • Adds `embs-motion` to <html> so motion.css applies.
   • Reveals .mo-reveal elements as they enter the viewport, staggering
     the ones that enter together (one shared IntersectionObserver).
   • Watches API-rendered containers with one MutationObserver, so
     cards inserted later by the data scripts are revealed too —
     without any change to those scripts.
   • Decorative parallax for [data-mo-parallax] (one passive scroll
     listener + rAF, only on fine-pointer devices, only for elements
     near the viewport).
   • Cursor-tracked glow for .mo-hover-glow (one delegated, rAF-
     throttled pointermove listener, attached only when needed).
   • Pauses offscreen decorative animations.
   • Honours prefers-reduced-motion, including live changes.

   OPT-IN CONFIG (inline, before DOMContentLoaded):
     window.EMBS_MOTION_CONFIG = {
       watch: [
         { container: '#eventsGrid', child: '.event-card', variant: 'scale',
           classes: 'mo-hover-glow' }   ← extra classes added to each card
       ]
     };
   or on the element:
     <div id="eventsGrid" data-mo-watch=".event-card" data-mo-variant="scale"
          data-mo-classes="mo-hover-glow">

   DELAYS
     data-mo-delay="120"        always added to the reveal delay
     data-mo-load-delay="700"   only applied if the element reveals during
                                the first moments after load — for hero
                                entrance sequencing. Ignored once the user
                                is scrolling, so nothing feels sluggish.

   PUBLIC API  (window.EMBSMotion)
     refresh(root?)                    scan root (default document) again
     watch(container, child, opts?)    watch a container for new cards
     reveal(elOrList)                  show immediately, no animation
     isReduced()                       current reduced-motion state
   ================================================================ */

(function (global, doc) {
  'use strict';

  var root = doc.documentElement;

  /* ── Capability gate ───────────────────────────────────────── */
  /* Without these, motion.css stays inert and everything renders
     exactly as it does today. */
  if (
    !root.classList ||
    typeof IntersectionObserver === 'undefined' ||
    typeof MutationObserver === 'undefined' ||
    !global.matchMedia
  ) {
    return;
  }

  root.classList.add('embs-motion');

  /* ── Constants ─────────────────────────────────────────────── */
  var STAGGER_MS     = 70;
  var STAGGER_MAX    = 6;      /* cap so long grids don't drag on */
  var FAILSAFE_MS    = 2200;   /* mark done even if animationend is missed */
  var PARALLAX_MAX   = 120;    /* px clamp for parallax offset */
  var LOAD_WINDOW_MS = 1500;   /* data-mo-load-delay only applies in this window */

  var VARIANTS = { fade: 1, scale: 1, left: 1, right: 1, down: 1 };

  var bootTime = 0;

  /* Elements already animated by another system. We never add our
     reveal to these, to avoid double animation. */
  var FOREIGN = '.embs-reveal, .embs-word-split, .embs-section-label, ' +
                '.embs-hero-sub, .embs-hero-cta, .mem-fade-in, .gal-reveal-target';

  var DECOR = '.mo-aurora, .mo-swirl, .mo-blob, .mo-float, .mo-gradient-text';

  var mqReduce = global.matchMedia('(prefers-reduced-motion: reduce)');
  var mqFine   = global.matchMedia('(hover: hover) and (pointer: fine)');

  function isReduced() { return mqReduce.matches; }

  /* ── State ─────────────────────────────────────────────────── */
  var revealIO   = null;   /* reveal on enter */
  var viewIO     = null;   /* tracks decor + parallax visibility */
  var mutationOb = null;
  var watched    = [];     /* [{ el, child, variant }] */

  var parallaxEls     = [];   /* all registered */
  var parallaxVisible = new Set();
  var parallaxOn      = false;
  var parallaxTicking = false;

  var glowBound   = false;
  var glowPending = null;

  /* ── Helpers ───────────────────────────────────────────────── */
  function toArray(list) {
    if (!list) return [];
    if (list.nodeType === 1) return [list];
    return Array.prototype.slice.call(list);
  }

  function resolve(target) {
    return typeof target === 'string' ? doc.querySelector(target) : target;
  }

  function markDone(el) {
    el.classList.add('is-in', 'mo-done');
    el.style.removeProperty('--mo-d');
  }

  /* ── 1. REVEAL ─────────────────────────────────────────────── */

  function onRevealEnter(entries) {
    /* Elements entering in the same callback form one stagger group,
       ordered top-to-bottom, left-to-right. */
    var entering = [];
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].isIntersecting) entering.push(entries[i]);
    }
    if (!entering.length) return;

    entering.sort(function (a, b) {
      var ra = a.boundingClientRect, rb = b.boundingClientRect;
      return (ra.top - rb.top) || (ra.left - rb.left);
    });

    var duringLoad = (global.performance ? performance.now() : Date.now()) - bootTime < LOAD_WINDOW_MS;

    entering.forEach(function (entry, idx) {
      var el = entry.target;
      revealIO.unobserve(el);

      var extra = parseInt(el.getAttribute('data-mo-delay'), 10) || 0;
      if (duringLoad) extra += parseInt(el.getAttribute('data-mo-load-delay'), 10) || 0;
      var delay = Math.min(idx, STAGGER_MAX) * STAGGER_MS + extra;
      el.style.setProperty('--mo-d', delay + 'ms');
      el.classList.add('is-in');

      /* Failsafe in case animationend never fires (e.g. tab hidden) */
      setTimeout(function () { markDone(el); }, delay + FAILSAFE_MS);
    });
  }

  /* One delegated listener finishes every reveal */
  function onAnimationEnd(e) {
    var el = e.target;
    if (
      el.classList &&
      el.classList.contains('mo-reveal') &&
      typeof e.animationName === 'string' &&
      e.animationName.indexOf('mo-') === 0
    ) {
      markDone(el);
    }
  }

  function prepareReveal(el, variant, classes) {
    if (!el || el.nodeType !== 1) return;

    /* Extra classes (e.g. hover effects) apply even with reduced motion */
    if (classes) {
      classes.split(/\s+/).forEach(function (c) { if (c) el.classList.add(c); });
    }
    if (el.classList.contains('mo-hover-glow')) bindGlow();

    /* Already registered. If it was moved (e.g. re-sorted) before it
       revealed, the removal unobserved it, so observe it again. */
    if (el.hasAttribute('data-mo-ready')) {
      if (!el.classList.contains('is-in') && !isReduced()) revealIO.observe(el);
      return;
    }

    if (el.matches(FOREIGN)) return;

    el.setAttribute('data-mo-ready', '');

    if (!el.classList.contains('mo-reveal')) el.classList.add('mo-reveal');
    if (variant && VARIANTS[variant]) el.classList.add('mo-reveal--' + variant);

    if (isReduced()) {
      markDone(el);
      return;
    }

    revealIO.observe(el);
  }

  /* Show immediately, skipping animation */
  function reveal(target) {
    toArray(typeof target === 'string' ? doc.querySelectorAll(target) : target)
      .forEach(function (el) {
        if (revealIO) revealIO.unobserve(el);
        markDone(el);
      });
  }

  /* ── 2. DYNAMIC CONTENT (API-rendered cards) ───────────────── */

  function prepareWithin(node, entry) {
    if (node.nodeType !== 1) return;
    if (node.matches(entry.child)) prepareReveal(node, entry.variant, entry.classes);
    var inner = node.querySelectorAll(entry.child);
    for (var i = 0; i < inner.length; i++) prepareReveal(inner[i], entry.variant, entry.classes);
  }

  function forgetWithin(node) {
    if (node.nodeType !== 1) return;
    if (node.hasAttribute('data-mo-ready')) revealIO.unobserve(node);
    var inner = node.querySelectorAll('[data-mo-ready]');
    for (var i = 0; i < inner.length; i++) revealIO.unobserve(inner[i]);
  }

  function onMutations(records) {
    for (var r = 0; r < records.length; r++) {
      var rec = records[r];

      /* Find which watched container this mutation belongs to */
      var entry = null;
      for (var w = 0; w < watched.length; w++) {
        if (watched[w].el === rec.target || watched[w].el.contains(rec.target)) {
          entry = watched[w];
          break;
        }
      }
      if (!entry) continue;

      var removed = rec.removedNodes;
      for (var i = 0; i < removed.length; i++) forgetWithin(removed[i]);

      var added = rec.addedNodes;
      for (var j = 0; j < added.length; j++) prepareWithin(added[j], entry);
    }
  }

  function watch(container, childSelector, opts) {
    var el = resolve(container);
    if (!el || !childSelector) return false;

    for (var i = 0; i < watched.length; i++) {
      if (watched[i].el === el) return true;
    }

    var entry = {
      el: el,
      child: childSelector,
      variant: (opts && opts.variant) || el.getAttribute('data-mo-variant') || '',
      classes: (opts && opts.classes) || el.getAttribute('data-mo-classes') || ''
    };
    watched.push(entry);

    /* Children that already exist (static fallback content) */
    prepareWithin(el, entry);

    if (!mutationOb) mutationOb = new MutationObserver(onMutations);
    mutationOb.observe(el, { childList: true, subtree: true });

    return true;
  }

  /* ── 3. DECOR VISIBILITY + PARALLAX ────────────────────────── */

  function onViewChange(entries) {
    var parallaxChanged = false;

    entries.forEach(function (entry) {
      var el = entry.target;

      if (el.matches(DECOR)) {
        el.classList.toggle('mo-paused', !entry.isIntersecting);
      }

      if (el.hasAttribute('data-mo-parallax')) {
        if (entry.isIntersecting) parallaxVisible.add(el);
        else parallaxVisible.delete(el);
        parallaxChanged = true;
      }
    });

    if (parallaxChanged) requestParallax();
  }

  function parallaxEnabled() {
    return !isReduced() && mqFine.matches && parallaxEls.length > 0;
  }

  function requestParallax() {
    if (!parallaxOn || parallaxTicking) return;
    parallaxTicking = true;
    global.requestAnimationFrame(updateParallax);
  }

  function updateParallax() {
    parallaxTicking = false;
    if (!parallaxOn) return;

    var vh = global.innerHeight;
    var scrollY = global.pageYOffset || root.scrollTop || 0;
    var reads = [];

    /* Read phase — no writes, so no layout thrash.
       Offset is measured from the scroll position at which the element
       first enters the viewport, so every element sits exactly where the
       page design puts it until scrolling begins (hero decor at the top
       of the page therefore starts at 0). */
    parallaxVisible.forEach(function (el) {
      var rect    = el.getBoundingClientRect();
      var current = el._moPy || 0;
      /* Subtract our own offset so it doesn't feed back into itself */
      var docTop  = rect.top - current + scrollY;
      var anchor  = Math.max(0, docTop - vh);
      var offset  = Math.max(0, scrollY - anchor) * el._moSpeed;
      if (offset >  PARALLAX_MAX) offset =  PARALLAX_MAX;
      if (offset < -PARALLAX_MAX) offset = -PARALLAX_MAX;
      reads.push([el, Math.round(offset * 10) / 10]);
    });

    /* Write phase */
    for (var i = 0; i < reads.length; i++) {
      var el = reads[i][0], val = reads[i][1];
      if (el._moPy !== val) {
        el._moPy = val;
        el.style.setProperty('--mo-py', val + 'px');
      }
    }
  }

  function startParallax() {
    if (parallaxOn || !parallaxEnabled()) return;
    parallaxOn = true;
    root.classList.add('mo-parallax-on');
    global.addEventListener('scroll', requestParallax, { passive: true });
    global.addEventListener('resize', requestParallax, { passive: true });
    requestParallax();
  }

  function stopParallax() {
    if (!parallaxOn) return;
    parallaxOn = false;
    root.classList.remove('mo-parallax-on');
    global.removeEventListener('scroll', requestParallax);
    global.removeEventListener('resize', requestParallax);
    parallaxEls.forEach(function (el) {
      el._moPy = 0;
      el.style.removeProperty('--mo-py');
    });
  }

  function registerParallax(el) {
    if (el._moSpeed !== undefined) return;
    var speed = parseFloat(el.getAttribute('data-mo-parallax'));
    if (!isFinite(speed)) speed = 0.15;
    el._moSpeed = Math.max(-1, Math.min(1, speed));
    parallaxEls.push(el);
    viewIO.observe(el);
  }

  function registerDecor(el) {
    if (el._moDecor) return;
    el._moDecor = true;
    viewIO.observe(el);
  }

  /* ── 4. HOVER GLOW ─────────────────────────────────────────── */

  function onPointerMove(e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    var target = e.target && e.target.closest ? e.target.closest('.mo-hover-glow') : null;
    if (!target) return;

    var first = glowPending === null;
    glowPending = { el: target, x: e.clientX, y: e.clientY };
    if (first) global.requestAnimationFrame(flushGlow);
  }

  function flushGlow() {
    var p = glowPending;
    glowPending = null;
    if (!p) return;
    var rect = p.el.getBoundingClientRect();
    p.el.style.setProperty('--mo-mx', (p.x - rect.left) + 'px');
    p.el.style.setProperty('--mo-my', (p.y - rect.top) + 'px');
  }

  function bindGlow() {
    if (glowBound || !mqFine.matches) return;
    glowBound = true;
    doc.addEventListener('pointermove', onPointerMove, { passive: true });
  }

  /* ── 5. SCAN ───────────────────────────────────────────────── */

  function refresh(scope) {
    var base = resolve(scope) || doc;

    /* Static reveals */
    toArray(base.querySelectorAll('.mo-reveal')).forEach(function (el) {
      var variant = '';
      for (var v in VARIANTS) {
        if (el.classList.contains('mo-reveal--' + v)) { variant = v; break; }
      }
      prepareReveal(el, variant);
    });

    /* Declarative watchers */
    toArray(base.querySelectorAll('[data-mo-watch]')).forEach(function (el) {
      watch(el, el.getAttribute('data-mo-watch'));
    });

    /* Decor + parallax */
    toArray(base.querySelectorAll(DECOR)).forEach(registerDecor);
    toArray(base.querySelectorAll('[data-mo-parallax]')).forEach(registerParallax);

    if (base.querySelector('.mo-hover-glow')) bindGlow();

    startParallax();
  }

  /* ── 6. REDUCED-MOTION / POINTER CHANGES ───────────────────── */

  function onReduceChange() {
    if (isReduced()) {
      /* Show everything that is still waiting, stop moving parts */
      toArray(doc.querySelectorAll('.mo-reveal[data-mo-ready]:not(.mo-done)'))
        .forEach(function (el) {
          revealIO.unobserve(el);
          markDone(el);
        });
      stopParallax();
    } else {
      startParallax();
    }
  }

  function onPointerChange() {
    if (mqFine.matches) {
      startParallax();
      if (doc.querySelector('.mo-hover-glow')) bindGlow();
    } else {
      stopParallax();
    }
  }

  function listen(mq, fn) {
    if (mq.addEventListener) mq.addEventListener('change', fn);
    else if (mq.addListener) mq.addListener(fn);
  }

  /* ── 7. BOOT ───────────────────────────────────────────────── */

  function boot() {
    try {
      bootTime = global.performance ? performance.now() : Date.now();

      /* No negative bottom margin: it would make short elements at the
         very end of the page (e.g. a footer bar) impossible to reveal,
         since they can never scroll above the excluded strip. */
      revealIO = new IntersectionObserver(onRevealEnter, {
        threshold: 0.12,
        rootMargin: '0px'
      });

      viewIO = new IntersectionObserver(onViewChange, {
        rootMargin: '20% 0px 20% 0px'
      });

      doc.addEventListener('animationend', onAnimationEnd);
      listen(mqReduce, onReduceChange);
      listen(mqFine, onPointerChange);

      var config = global.EMBS_MOTION_CONFIG;
      if (config && Array.isArray(config.watch)) {
        config.watch.forEach(function (w) {
          if (w) watch(w.container, w.child, { variant: w.variant, classes: w.classes });
        });
      }

      refresh(doc);
    } catch (err) {
      /* Never leave content hidden because of a script error */
      root.classList.remove('embs-motion');
      if (global.console && console.warn) console.warn('[motion] disabled:', err);
    }
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* ── Public API ────────────────────────────────────────────── */
  global.EMBSMotion = {
    refresh:   function (scope) { if (revealIO) refresh(scope); },
    watch:     function (c, s, o) { return revealIO ? watch(c, s, o) : false; },
    reveal:    reveal,
    isReduced: isReduced
  };

}(window, document));
