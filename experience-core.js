/* ================================================================
   experience-core.js — IEEE EMBS KPRIET
   Shared building blocks for the GSAP "experience" page engines.
   Exposes window.EMBSXP. Contains no page-specific choreography —
   page engines (about-experience.js, …) compose these pieces and own
   every animation on their page.

   Requires gsap + ScrollTrigger for the motion helpers; the static
   helpers (splitLines/splitWords/glow) work without them.
   ================================================================ */

(function (win, doc) {
  'use strict';

  var root = doc.documentElement;

  function q(sel, scope) { return (scope || doc).querySelector(sel); }
  function qa(sel, scope) { return Array.prototype.slice.call((scope || doc).querySelectorAll(sel)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* One motion vocabulary for every experience page */
  var EASE = {
    reveal: 'expo.out',             /* typography + media arrivals   */
    sweep:  'expo.inOut',           /* clip / mask transitions       */
    soft:   'power3.out',           /* secondary text                */
    settle: 'power2.out',           /* ambient light                 */
    spring: 'elastic.out(1, 0.55)'  /* micro-interaction return      */
  };

  var lowPower = !!(navigator.connection && navigator.connection.saveData) ||
                 (typeof navigator.deviceMemory === 'number' && navigator.deviceMemory < 4);

  function releasePending() {
    if (win.__xpFailsafe) clearTimeout(win.__xpFailsafe);
    root.classList.remove('xp-pending');
  }

  /* ── Typography ──────────────────────────────────────────────── */

  /* Wrap each <br>-separated line in a mask. Returns the inner spans. */
  function splitLines(el) {
    if (!el) return [];
    if (el._xpLines) return el._xpLines;

    var groups = [[]];
    Array.prototype.slice.call(el.childNodes).forEach(function (n) {
      if (n.nodeName === 'BR') groups.push([]);
      else groups[groups.length - 1].push(n);
    });

    var labels = [], inners = [];
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

    /* Block line spans would otherwise run words together for AT */
    if (groups.length > 1) el.setAttribute('aria-label', labels.join(' ').replace(/\s+/g, ' '));
    el._xpLines = inners;
    return inners;
  }

  /* Wrap words in spans (for read-along reveals). Text nodes only;
     inline elements are kept whole. Returns the word spans. */
  function splitWords(el) {
    if (!el) return [];
    if (el._xpWords) return el._xpWords;
    var words = [];
    Array.prototype.slice.call(el.childNodes).forEach(function (n) {
      if (n.nodeType === 3) {
        var frag = doc.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(function (chunk) {
          if (!chunk) return;
          if (/^\s+$/.test(chunk)) { frag.appendChild(doc.createTextNode(chunk)); return; }
          var w = doc.createElement('span');
          w.className = 'xp-word';
          w.textContent = chunk;
          frag.appendChild(w);
          words.push(w);
        });
        el.replaceChild(frag, n);
      } else if (n.nodeType === 1) {
        n.classList.add('xp-word');
        words.push(n);
      }
    });
    el._xpWords = words;
    return words;
  }

  /* ── Card glow (vanilla, fine pointers) ──────────────────────── */

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
  var glowBound = false;
  function bindGlow() {
    if (glowBound) return;
    glowBound = true;
    doc.addEventListener('pointermove', onGlowMove, { passive: true });
  }

  /* ── ScrollTrigger refresh queue ─────────────────────────────── */

  var refreshQueued = false;
  function queueRefresh() {
    var ST = win.ScrollTrigger;
    if (!ST || refreshQueued) return;
    refreshQueued = true;
    win.requestAnimationFrame(function () {
      win.requestAnimationFrame(function () {
        refreshQueued = false;
        ST.refresh();
      });
    });
  }

  /* ── Counting numbers fed by CMS scripts ─────────────────────── */
  /* The CMS script writes the final text ("10+"); this observes it
     and counts up to it once `allow()` + `reveal()` have both been
     called. MutationObserver callbacks are async, so engine writes
     are recognised by value, not by a flag. */

  function createCounter(elements) {
    var state = { allowed: false, revealed: false, tweens: [] };
    function write(el, text) { el._xpWrote = text; el.textContent = text; }
    function parse(text) {
      var m = /^(\d+)(.*)$/.exec(String(text).trim());
      return m ? { n: parseInt(m[1], 10), suffix: m[2], text: String(text).trim() } : null;
    }
    function count(el) {
      var t = el._xpTarget;
      if (!t || el._xpCounted || !state.allowed || !state.revealed || !win.gsap) return;
      el._xpCounted = true;
      if (t.n === 0) return;
      el.style.minWidth = el.getBoundingClientRect().width + 'px';
      var obj = { v: 0 };
      write(el, '0' + t.suffix);
      state.tweens.push(win.gsap.to(obj, {
        v: t.n,
        duration: clamp(0.9 + t.n * 0.04, 1.1, 2),
        ease: 'power2.out',
        onUpdate: function () { write(el, Math.round(obj.v) + t.suffix); },
        onComplete: function () { write(el, t.text); el.style.minWidth = ''; }
      }));
    }
    elements.forEach(function (el) {
      var t0 = parse(el.textContent);
      if (t0) el._xpTarget = t0;
      new MutationObserver(function () {
        if (el.textContent === el._xpWrote) return;
        var t = parse(el.textContent);
        if (!t) return;
        el._xpTarget = t;
        el._xpCounted = false;
        if (typeof api.onValue === 'function') api.onValue(el, t);
        count(el);
      }).observe(el, { childList: true, characterData: true, subtree: true });
    });
    var api = {
      onValue: null,
      allow: function (v) { state.allowed = v; },
      reveal: function () { state.revealed = true; elements.forEach(count); },
      finish: function () {
        state.tweens.forEach(function (t) { t.kill(); });
        state.tweens = [];
        elements.forEach(function (el) {
          if (el._xpTarget) { write(el, el._xpTarget.text); el.style.minWidth = ''; }
        });
      }
    };
    return api;
  }

  /* ── Journey rail ────────────────────────────────────────────── */
  /* journey: [{ sel, theme: 'dark'|'light' }]. Returns nothing; all
     triggers belong to the caller's gsap context. */

  var railRelease = null, railReleaseBound = false;

  function prepRail(journey) {
    var rail = q('.xp-rail');
    if (!rail || rail._xpTicks) return;
    rail._xpTicks = journey.map(function () {
      var t = doc.createElement('span');
      t.className = 'xp-rail-tick';
      rail.appendChild(t);
      return t;
    });
  }

  function rail(journey, endTrigger) {
    var gsap = win.gsap, ST = win.ScrollTrigger;
    var el = q('.xp-rail');
    if (!el || getComputedStyle(el).display === 'none') return;
    prepRail(journey);
    var fill = q('.xp-rail-fill', el);
    var node = q('.xp-rail-node', el);
    var ticks = el._xpTicks;
    var setFill = gsap.quickSetter(fill, 'scaleY');
    var setNode = gsap.quickSetter(node, 'y', 'px');
    var stretch = gsap.quickTo(node, 'scaleY', { duration: 0.5, ease: 'power3.out' });

    function layoutTicks() {
      var max = Math.max(1, ST.maxScroll(win));
      var h = el.offsetHeight;
      journey.forEach(function (j, i) {
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
        setNode(self.progress * el.offsetHeight);
        stretch(1 + clamp(Math.abs(self.getVelocity()) / 2600, 0, 1.4));
      }
    });
    layoutTicks();

    journey.forEach(function (j, i) {
      var s = q(j.sel);
      if (!s) return;
      ST.create({
        trigger: s, start: 'top 50%', end: 'bottom 50%',
        onToggle: function (self) {
          if (!self.isActive) return;
          ticks.forEach(function (t, k) { t.classList.toggle('is-active', k === i); });
          el.classList.toggle('is-light', j.theme === 'light');
        }
      });
    });

    if (endTrigger) {
      gsap.to(el, { opacity: 0, ease: 'none',
        scrollTrigger: { trigger: endTrigger, start: 'top bottom', end: 'top 55%', scrub: true } });
    }

    railRelease = function () { stretch(1); };
    if (!railReleaseBound) {
      railReleaseBound = true;
      ST.addEventListener('scrollEnd', function () { if (railRelease) railRelease(); });
    }
  }

  function progressLine() {
    win.gsap.to('.xp-progress', { scaleX: 1, ease: 'none',
      scrollTrigger: { start: 0, end: 'max', scrub: 0.4 } });
  }

  /* ── Pointer: cursor light + two-depth parallax in a hero ───── */

  function heroPointer(hero) {
    var gsap = win.gsap;
    if (!hero) return function () {};
    var far = q('.xp-depth--far', hero), near = q('.xp-depth--near', hero), light = q('.xp-hero-light', hero);
    var to = function (el, p, d) { return el ? gsap.quickTo(el, p, { duration: d, ease: 'power3.out' }) : function () {}; };
    var farX = to(far, 'x', 1.4), farY = to(far, 'y', 1.4);
    var nearX = to(near, 'x', 1.0), nearY = to(near, 'y', 1.0);
    var lightX = to(light, 'x', 1.2), lightY = to(light, 'y', 1.2);

    var rect = hero.getBoundingClientRect();
    if (light) gsap.set(light, { x: rect.width * 0.68, y: rect.height * 0.45 });

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
    return function () { win.removeEventListener('pointermove', onMove); };
  }

  /* ── Magnetic CTAs: gentle attraction, spring-like return ────── */

  function magnetic(selector) {
    var gsap = win.gsap;
    root.classList.add('xp-magnetic-on');
    var mags = qa(selector || '.xp-magnetic').map(function (btn) {
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
    return function () {
      root.classList.remove('xp-magnetic-on');
      mags.forEach(function (m) {
        m.btn.removeEventListener('pointermove', m.move);
        m.btn.removeEventListener('pointerleave', m.leave);
        gsap.set(m.btn, { clearProps: 'transform' });
      });
    };
  }

  /* ── Section heading reveal: label sweeps open, title rises ──── */

  function headingReveal(opts) {
    var gsap = win.gsap;
    var title = typeof opts.title === 'string' ? q(opts.title) : opts.title;
    if (!title) return null;
    var label = typeof opts.label === 'string' ? q(opts.label) : opts.label;
    var extras = (opts.extras || []).map(function (s) { return typeof s === 'string' ? q(s) : s; }).filter(Boolean);
    var slow = opts.slow || 1;
    var inners = splitLines(title);
    extras.forEach(function (e) { e.classList.add('xp-t'); });

    var tl = gsap.timeline({
      scrollTrigger: { trigger: title, start: opts.start || 'top 86%', toggleActions: 'play none none none' },
      defaults: { ease: EASE.reveal }
    });
    if (label) tl.fromTo(label, { clipPath: 'inset(0% 100% 0% 0%)' },
      { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.0 * slow, ease: EASE.sweep, clearProps: 'clipPath' }, 0);
    tl.from(inners, { yPercent: 112, rotation: opts.small ? 0 : 1.5, transformOrigin: '0% 100%',
      duration: 1.3 * slow, stagger: 0.1, clearProps: 'transform' }, 0.12);
    if (extras.length) tl.fromTo(extras, { '--xp-ty': '18px', opacity: 0 },
      { '--xp-ty': '0px', opacity: 1, duration: 1.1 * slow, stagger: 0.1, ease: EASE.soft }, 0.45);
    return tl;
  }

  /* ── Stroke drawing helper (SVG shapes) ──────────────────────── */

  function strokeShapes(scope) {
    return qa('path, line, circle, rect, polyline, polygon', scope).filter(function (s) {
      if (typeof s.getTotalLength !== 'function') return false;
      var stroke = s.getAttribute('stroke');
      if (!stroke || stroke === 'none') return false;
      try { s._xpLen = s.getTotalLength(); } catch (e) { return false; }
      return s._xpLen > 0;
    });
  }

  win.EMBSXP = {
    EASE: EASE,
    lowPower: lowPower,
    q: q, qa: qa, clamp: clamp,
    releasePending: releasePending,
    splitLines: splitLines,
    splitWords: splitWords,
    bindGlow: bindGlow,
    queueRefresh: queueRefresh,
    createCounter: createCounter,
    prepRail: prepRail,
    rail: rail,
    progressLine: progressLine,
    heroPointer: heroPointer,
    magnetic: magnetic,
    headingReveal: headingReveal,
    strokeShapes: strokeShapes
  };

}(window, document));
