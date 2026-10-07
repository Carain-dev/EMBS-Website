/* ================================================================
   loader.js — EMBS start-up overlay (index.html only)

   LOGIC LAYER (behaviour unchanged from the previous loader)
   1. Wakes the API the instant the page opens (GET /api/health),
      before any 3D code is even requested.
   2. Observes — never duplicates — the home page's own API requests
      (by wrapping fetch, after config.js has set EMBS_API_BASE) and
      leaves once the CRITICAL ones have succeeded:
        CRITICAL      /events   (featured activities, recent events, stats)
                      /members  (hero member count)
        non-critical  everything else; it keeps loading afterwards.
   3. Shows for at least MIN_SHOW_MS on a first visit; a warm repeat
      visit within the same tab skips it entirely (embs.apiWarmAt, 10 min).
   4. Network errors / 5xx on a critical request → polls /health every 3s
      and reloads once (embs.loaderReloaded); after GIVE_UP_MS a calm
      failure message offers Try again (10 polls × 3s) or Continue.
      A critical 4xx counts as answered.

   PRESENTATION ("Specimen & Instrument") is a separate layer:
   loader/loader-ui.js + loader-scene.js (Three.js), imported only after
   first paint. It listens to the states below and can never delay or
   block readiness; if it fails, the shell and logic carry on alone.

   Must load synchronously as the first thing in <body>, after config.js
   and loader/loader-facts.js.
   ================================================================ */
(function (win, doc) {
  'use strict';

  var API = win.EMBS_API_BASE;
  if (!API || typeof win.fetch !== 'function' || !doc.body) return;

  var nativeFetch = win.fetch;
  /* 1 — kick the (possibly sleeping) API awake immediately */
  try { nativeFetch(API + '/health', { cache: 'no-store' }).catch(function () {}); } catch (e) {}

  var WARM_KEY = 'embs.apiWarmAt';
  var RELOAD_KEY = 'embs.loaderReloaded';
  try {
    var warmAt = +sessionStorage.getItem(WARM_KEY);
    if (warmAt && Date.now() - warmAt < 10 * 60 * 1000) return;
  } catch (e) { /* storage blocked: show the loader */ }

  var mq = function (q) { return !!(win.matchMedia && win.matchMedia(q).matches); };
  var reduceNow = function () { return mq('(prefers-reduced-motion: reduce)'); };
  var REDUCE = reduceNow();
  var TOUCH = !mq('(hover: hover) and (pointer: fine)');
  var SMALL = Math.min(win.innerWidth, win.innerHeight) < 600;
  var CORES = navigator.hardwareConcurrency || 4, MEM = navigator.deviceMemory || 4;
  var TIER = (!SMALL && CORES >= 8 && MEM >= 8) ? 'high' : ((SMALL && (CORES <= 4 || MEM <= 3)) ? 'low' : 'mid');

  var CRITICAL = ['/events', '/members'];
  var GIVE_UP_MS = 75000;
  var MIN_SHOW_MS = 2600;
  var COLD_MS = 6000;          /* no response yet → cold start */
  var LONG_MS = 20000;         /* long wait copy */
  var t0 = performance.now();

  var st = { issued: 0, settled: 0, responded: false, critical: {}, criticalFailed: false, done: false, revealed: false, failed: false };
  var revealFns = [];
  var ui = null;               /* presentation layer, once loaded */

  /* ── observe the page's own API requests ─────────────────────── */
  win.fetch = function (input) {
    var p = nativeFetch.apply(this, arguments);
    try {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      if (url.indexOf(API) === 0) track(url.slice(API.length), p);
    } catch (e) { /* never interfere with the request itself */ }
    return p;
  };

  function track(path, p) {
    var key = path.split('?')[0];
    var isCritical = CRITICAL.indexOf(key) !== -1 && key === path;
    st.issued++;
    p.then(function (res) {
      settle(true);
      if (isCritical) {
        if (res.ok) st.critical[key] = 'ok';
        else if (res.status < 500) st.critical[key] = st.critical[key] || 'answered';
        else criticalProblem(key);
      }
      progress();
    }, function () {
      settle(false);
      if (isCritical) criticalProblem(key);
      progress();
    });
  }
  /* A network error is not a response. */
  function settle(gotResponse) { st.settled++; if (gotResponse) st.responded = true; }
  function criticalProblem(key) {
    if (st.critical[key] === 'ok') return;
    st.critical[key] = 'failed';
    st.criticalFailed = true;
    reconnect();
  }

  /* ── HTML shell: renders before any 3D code runs ─────────────── */
  var root = doc.documentElement;
  root.classList.add('embs-loading');
  if (REDUCE) root.classList.add('embs-loading-rm');

  var el = doc.createElement('div');
  el.id = 'embs-loader';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'IEEE EMBS Student Chapter website is starting');
  el.innerHTML =
    '<div class="ld-pool" aria-hidden="true"></div>' +
    '<canvas class="ld-gl" aria-hidden="true"></canvas>' +
    '<img class="ld-still" alt="" aria-hidden="true" decoding="async">' +
    '<canvas class="ld-sig" aria-hidden="true"></canvas>' +
    '<div class="ld-labels" aria-hidden="true"></div>' +
    '<div class="ld-grain" aria-hidden="true"></div>' +
    '<div class="ld-text"><div class="ld-mark">' +
      '<p class="ld-mark-kicker">Engineering in Medicine &amp; Biology</p>' +
      '<p class="ld-mark-name">IEEE <em>EMBS</em></p>' +
      '<p class="ld-mark-sub">Student Chapter</p>' +
      '<p class="ld-mark-inst">KPR Institute of Engineering and Technology</p>' +
      '<ul class="ld-pillars" aria-hidden="true"><li>Biosignals</li><li>Medical imaging</li><li>Neural engineering</li><li>Biomaterials</li></ul>' +
    '</div></div>' +
    '<figure class="ld-fact"><figcaption class="ld-fact-cat"></figcaption><p class="ld-fact-text"></p></figure>' +
    '<div class="ld-status">' +
      '<p class="ld-status-text" role="status" aria-live="polite">Preparing the chapter</p>' +
      '<i class="ld-status-line" aria-hidden="true"></i>' +
      '<div class="ld-fail"><button type="button" data-ld="retry">Try again</button>' +
      '<button type="button" data-ld="continue">Continue to the website</button></div>' +
    '</div>';
  doc.body.insertBefore(el, doc.body.firstChild);

  var $ = function (s) { return el.querySelector(s); };
  var statusEl = $('.ld-status-text');

  /* status copy, crossfaded */
  var statusTimer = 0;
  function setStatus(text) {
    if (statusEl.textContent === text) return;
    if (REDUCE) { statusEl.textContent = text; return; }
    statusEl.classList.add('is-swap');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { statusEl.textContent = text; statusEl.classList.remove('is-swap'); }, 200);
  }

  /* imperceptible film grain (skipped for reduced motion) */
  if (!REDUCE) try {
    var gc = doc.createElement('canvas'); gc.width = gc.height = 96;
    var gx = gc.getContext('2d'), gd = gx.createImageData(96, 96);
    for (var gi = 0; gi < gd.data.length; gi += 4) { var gv = Math.random() * 255; gd.data[gi] = gd.data[gi + 1] = gd.data[gi + 2] = gv; gd.data[gi + 3] = 255; }
    gx.putImageData(gd, 0, 0);
    $('.ld-grain').style.backgroundImage = 'url(' + gc.toDataURL() + ')';
  } catch (e) {}

  /* ── facts: shuffle-bag in localStorage, same fact for the session ── */
  var FACTS = win.EMBS_LOADER_FACTS || [];
  function rnd(n) {
    try { var a = new Uint32Array(1); win.crypto.getRandomValues(a); return a[0] % n; } catch (e) { return Math.floor(Math.random() * n); }
  }
  function nextFromBag() {
    var bag = null;
    try { bag = JSON.parse(localStorage.getItem('embs.factBag') || 'null'); } catch (e) { bag = null; }
    var ids = FACTS.map(function (f) { return f.id; });
    if (!bag || !bag.order || bag.order.length !== ids.length || bag.pos >= bag.order.length) {
      var lastId = bag && bag.order ? bag.order[bag.order.length - 1] : null;
      var order = ids.slice();
      for (var i = order.length - 1; i > 0; i--) { var j = rnd(i + 1), tmp = order[i]; order[i] = order[j]; order[j] = tmp; }
      if (order.length > 1 && order[0] === lastId) { var t = order[0]; order[0] = order[1]; order[1] = t; }
      bag = { order: order, pos: 0 };
    }
    var id = bag.order[bag.pos++];
    try { localStorage.setItem('embs.factBag', JSON.stringify(bag)); } catch (e) {}
    var f = FACTS.filter(function (x) { return x.id === id; })[0] || FACTS[rnd(FACTS.length)];
    try { sessionStorage.setItem('embs.factCurrent', String(f.id)); } catch (e) {}
    return f;
  }
  function firstFact() {
    if (!FACTS.length) return null;
    try {
      var cur = +sessionStorage.getItem('embs.factCurrent');
      var same = FACTS.filter(function (x) { return x.id === cur; })[0];
      if (same) return same;
    } catch (e) {}
    try { return nextFromBag(); } catch (e) { return FACTS[rnd(FACTS.length)]; }
  }
  /* render a fact; lines are wrapped so they can settle in one by one */
  function showFact(f) {
    var box = $('.ld-fact'), txt = $('.ld-fact-text');
    if (!f) { box.hidden = true; return; }
    $('.ld-fact-cat').textContent = f.cat;
    /* one paragraph that settles in (natural wrapping, no broken words) */
    txt.textContent = '';
    var l = doc.createElement('span'); l.className = 'ld-line'; l.textContent = f.text; txt.appendChild(l);
  }
  var fact = firstFact();

  /* ── first-visit timeline (DOM part; the scene keeps its own clock) ── */
  function at(ms, fn) { setTimeout(fn, REDUCE ? 0 : ms); }
  at(1900, function () { $('.ld-mark').classList.add('is-on'); });
  at(2600, function () { if (st.revealed) return; showFact(fact); requestAnimationFrame(function () { $('.ld-fact').classList.add('is-on'); }); });
  at(2800, function () { $('.ld-status').classList.add('is-on'); });
  /* a long cold start gets a second fact (never faster than every ~9 s) */
  (function rotate(delay) {
    setTimeout(function () {
      if (st.done || st.failed || !FACTS.length) return;
      var f; try { f = nextFromBag(); } catch (e) { f = FACTS[rnd(FACTS.length)]; }
      var box = $('.ld-fact');
      box.classList.remove('is-on');
      setTimeout(function () { showFact(f); requestAnimationFrame(function () { box.classList.add('is-on'); }); }, 450);
      rotate(9000);
    }, delay);
  })(10000);

  function okCount() {
    var n = 0;
    CRITICAL.forEach(function (k) { if (st.critical[k] === 'ok' || st.critical[k] === 'answered') n++; });
    return n;
  }

  /* ── progress: driven only by real responses ─────────────────── */
  function progress() {
    if (st.done) return;
    if (okCount() === CRITICAL.length) ready();
  }

  setTimeout(function () { if (!st.responded && !st.done && !st.failed) setStatus('Waking chapter services'); }, COLD_MS);
  setTimeout(function () { if (!st.done && !st.failed) setStatus('Still connecting — thank you for your patience'); }, LONG_MS);

  win.addEventListener('load', function () {
    setTimeout(function () { if (!st.done && st.issued === 0) ready(); }, 800);
  });

  var giveUp = setTimeout(fail, GIVE_UP_MS);

  var polling = false;
  function reconnect() {
    if (polling || st.done) return;
    polling = true;
    (function poll() {
      if (st.done || st.failed) { polling = false; return; }
      nativeFetch(API + '/health', { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw 0;
        var reloaded = false;
        try { reloaded = sessionStorage.getItem(RELOAD_KEY) === '1'; sessionStorage.setItem(RELOAD_KEY, '1'); } catch (e) { reloaded = true; }
        if (!reloaded) { win.location.reload(); return; }
        polling = false; ready(true);
      }).catch(function () { setTimeout(poll, 3000); });
    })();
  }

  var FAIL_COPY = 'The chapter services are taking longer than usual.';
  function fail() {
    if (st.done) return;
    st.failed = true;
    el.classList.add('is-failed');
    $('.ld-status').classList.add('is-on');
    setStatus(FAIL_COPY);
    var b = $('[data-ld=retry]');
    if (b) b.focus({ preventScroll: true });
  }

  $('[data-ld=continue]').addEventListener('click', function () { ready(true); });
  $('[data-ld=retry]').addEventListener('click', function () {
    var btn = this, tries = 0;
    btn.disabled = true;
    setStatus('Waking chapter services');
    (function poll() {
      nativeFetch(API + '/health', { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw 0;
        try { sessionStorage.removeItem(RELOAD_KEY); } catch (e) {}
        win.location.reload();
      }).catch(function () {
        if (++tries < 10) return setTimeout(poll, 3000);
        btn.disabled = false;
        setStatus(FAIL_COPY);
      });
    })();
  });

  /* ── leaving: logic decides; the visual exit is best-effort ──── */
  function ready(skipped) {
    if (st.done) return;
    st.done = true;
    clearTimeout(giveUp);
    if (skipped) return leave();
    try { sessionStorage.setItem(WARM_KEY, String(Date.now())); sessionStorage.removeItem(RELOAD_KEY); } catch (e) {}
    var wait = Math.max(0, MIN_SHOW_MS - (performance.now() - t0));
    setTimeout(function () {
      var visual;
      try { visual = ui ? ui.exit() : null; } catch (e) { visual = null; }
      if (!visual) { setStatus('Ready'); el.classList.add('is-exiting'); visual = new Promise(function (r) { setTimeout(r, 300); }); }
      /* never trap the visitor: the homepage is revealed even if the visual exit stalls */
      Promise.race([visual, new Promise(function (r) { setTimeout(r, 2200); })]).then(leave, leave);
    }, wait);
  }
  var left = false;
  function leave() {
    if (left) return; left = true;
    el.classList.add('is-leaving');
    root.classList.remove('embs-loading', 'embs-loading-rm');
    st.revealed = true;
    revealFns.splice(0).forEach(function (fn) { try { fn(); } catch (e) {} });
    setTimeout(function () {
      try { if (ui) ui.dispose(); } catch (e) {}
      ui = null;
      if (el.parentNode) el.parentNode.removeChild(el);
      var main = doc.getElementById('main-content');
      if (main && (!doc.activeElement || doc.activeElement === doc.body)) { try { main.focus({ preventScroll: true }); } catch (e) {} }
    }, 450);
  }

  /* Home-page animation hook: run fn once the overlay starts to leave. */
  win.EMBSLoader = {
    holding: function () { return !st.revealed; },
    onReveal: function (fn) { if (st.revealed) fn(); else revealFns.push(fn); }
  };

  /* ── presentation layer: imported after first paint ── */
  var bridge = {
    el: el, touch: TOUCH, small: SMALL, tier: TIER,
    reduce: reduceNow,
    status: setStatus,
    /* has the critical data already arrived? (then the live 3D is not worth loading) */
    isDone: function () { return st.done; },
    elapsed: function () { return performance.now() - t0; },
    showStill: function () {
      if (el.classList.contains('is-still')) return;
      var img = $('.ld-still');
      img.onload = function () { el.classList.add('is-still-ready'); };
      img.src = new URL('loader/assets/heart-still.webp', doc.baseURI).href;
      el.classList.add('is-still');
    }
  };
  /* The pre-rendered heart (19 KB) is on screen from the first frame. On a warm
     backend that is all the visitor needs; the live 3D heart is only loaded
     when the wait turns out to be long (see loader-ui.js). */
  bridge.showStill();
  function loadUI() {
    if (st.revealed) return;
    import(new URL('loader/loader-ui.js', doc.baseURI).href).then(function (m) {
      if (st.revealed) return;
      ui = m.start(bridge);
    }).catch(function () { bridge.showStill(); });
  }
  win.requestAnimationFrame(function () { setTimeout(loadUI, 0); });
})(window, document);
