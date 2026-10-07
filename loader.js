/* ================================================================
   loader.js — EMBS biomedical start-up overlay (index.html only)

   Why: the API runs on Render's free tier and sleeps when idle, so the
   first visit can wait 30–60s for data. This overlay covers that wait.

   1. Wakes the API the instant the page opens (GET /api/health).
   2. Observes — never duplicates — the home page's own API requests
      (by wrapping fetch, after config.js has set EMBS_API_BASE) and
      leaves once the CRITICAL ones have succeeded:
        CRITICAL      /events   (featured activities, recent events, stats)
                      /members  (hero member count)
        non-critical  everything else; it keeps loading afterwards.
   3. Shows for at least MIN_SHOW_MS on a first visit, so it reads as an
      intentional start-up rather than a flash; a warm repeat visit
      within the same tab skips it entirely.
   4. Network errors / 5xx on a critical request → waits for /health and
      reloads once; after 75s a calm failure message offers Retry or
      Continue. A critical 4xx counts as answered (page shows its own
      empty state).

   Must load synchronously as the first thing in <body>, after config.js.
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
  var REDUCE = mq('(prefers-reduced-motion: reduce)');
  var FINE = mq('(hover: hover) and (pointer: fine)');
  var SMALL = win.innerWidth < 760;
  var LOW = SMALL || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  var INTERACTIVE = FINE && !REDUCE;

  var CRITICAL = ['/events', '/members'];
  var GIVE_UP_MS = 75000;
  var MIN_SHOW_MS = 2600;
  var t0 = performance.now();

  var st = { issued: 0, settled: 0, responded: false, critical: {}, criticalFailed: false, done: false, revealed: false, failed: false, stage: 0 };
  var revealFns = [];

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
    if (!st.responded) setStatus('CONNECTING TO CHAPTER SERVICES…');
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
  /* A network error is not a response: it must not advance the stages. */
  function settle(gotResponse) { st.settled++; if (gotResponse) st.responded = true; }
  function criticalProblem(key) {
    if (st.critical[key] === 'ok') return;
    st.critical[key] = 'failed';
    st.criticalFailed = true;
    reconnect();
  }

  /* ── DOM ─────────────────────────────────────────────────────── */
  var root = doc.documentElement;
  root.classList.add('embs-loading');

  var ICONS = {
    pulse: '<path d="M2 12h4.5l2-5 4 10 2.5-5H22"/>',
    data: '<ellipse cx="12" cy="5.5" rx="7.5" ry="2.8"/><path d="M4.5 5.5v13c0 1.6 3.4 2.8 7.5 2.8s7.5-1.2 7.5-2.8v-13"/><path d="M4.5 12c0 1.6 3.4 2.8 7.5 2.8s7.5-1.2 7.5-2.8"/>',
    people: '<circle cx="9" cy="8" r="3.2"/><circle cx="16.5" cy="9" r="2.5"/><path d="M3 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M14.5 14.3c3.2-.4 6.5 1.4 6.5 4.7"/>',
    doc: '<path d="M6 2.5h8.5l4 4v15H6z"/><path d="M14.5 2.5v4h4"/><path d="M9 14.5l2.2 2.2 4.3-4.4"/>'
  };
  var ico = function (k) { return '<span class="ld-ico"><svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[k] + '</svg></span>'; };

  var BODY_SVG =
    '<svg viewBox="0 0 160 260" preserveAspectRatio="xMidYMid meet">' +
    '<g fill="none" stroke="rgba(122,162,255,0.55)" stroke-width="1">' +
    '<circle cx="62" cy="30" r="13"/>' +
    '<path d="M62 44c-6 0-8 4-8 8l-12 6c-6 3-8 8-9 16l-4 42c-1 6 3 7 5 2l6-36 2 30-2 46 3 56c0 6 9 6 9 0l6-56 4-32 4 32 6 56c0 6 9 6 9 0l3-56-2-46 2-30 6 36c2 5 6 4 5-2l-4-42c-1-8-3-13-9-16l-12-6c0-4-2-8-8-8z"/>' +
    '<path d="M62 48v78" stroke-dasharray="2 3"/>' +
    '<path d="M52 66c6 3 14 3 20 0M51 74c7 3 15 3 22 0M51 82c7 3 15 3 22 0M52 90c6 3 14 3 20 0" stroke="rgba(122,162,255,0.35)"/>' +
    '<path d="M50 126c4 6 20 6 24 0" stroke="rgba(122,162,255,0.35)"/></g>' +
    '<circle cx="66" cy="70" r="3.2" fill="rgba(214,120,255,0.85)"/>' +
    '<g stroke="rgba(122,162,255,0.4)" stroke-width="1"><path d="M108 40h40M108 50h28M108 60h34"/>' +
    '<path d="M112 120v-14M120 120v-24M128 120v-10M136 120v-30M144 120v-18" stroke="rgba(139,92,246,0.6)" stroke-width="3"/></g></svg>';
  var BRAIN_SVG =
    '<svg viewBox="0 0 140 90" preserveAspectRatio="xMidYMid meet"><g fill="none" stroke="rgba(122,162,255,0.6)" stroke-width="1">' +
    '<path d="M44 78c-2-8-10-10-10-20 0-6 2-9 2-14C36 26 52 12 74 12c20 0 34 14 34 30 0 12-6 18-14 22-2 8-8 12-16 12-6 0-8 4-8 6"/>' +
    '<path d="M52 40c4-8 12-10 18-6M74 26c8-2 16 2 18 10M58 52c6 4 14 4 20-2M82 50c4 4 10 4 14 0M48 30c2-4 6-6 10-6M68 42c2 4 2 8 0 12" stroke="rgba(183,148,255,0.6)"/></g>' +
    '<g stroke="rgba(122,162,255,0.35)"><path d="M8 20h14M8 28h10M8 36h12M118 70h14M122 78h10"/></g></svg>';

  var el = doc.createElement('div');
  el.id = 'embs-loader';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'IEEE EMBS website is starting');
  el.innerHTML =
    '<canvas class="ld-canvas" aria-hidden="true"></canvas>' +
    '<div class="ld-mark ld-mark--l" aria-hidden="true"><b>IEEE</b><span>Advancing Technology<br>for Humanity</span></div>' +
    '<div class="ld-mark ld-mark--r" aria-hidden="true"><b>EMBS</b><span>IEEE Engineering in<br>Medicine &amp; Biology Society</span></div>' +
    '<ul class="ld-side ld-side--a" aria-hidden="true"><li>HUMAN SYSTEMS</li><li>BIOMEDICAL ENGINEERING</li><li>INNOVATION</li></ul>' +
    '<ul class="ld-side ld-side--b" aria-hidden="true"><li>RESEARCH</li><li>INNOVATION</li><li>HEALTHCARE</li><li>TECHNOLOGY</li><li>HUMANITY</li></ul>' +
    '<ul class="ld-side ld-side--c" aria-hidden="true"><li>ENGINEERING</li><li>BIOLOGY</li><li>FOR A HEALTHIER</li><li>TOMORROW</li></ul>' +
    '<div class="ld-panel ld-panel--body" aria-hidden="true">' + BODY_SVG + '<canvas class="ld-ecg"></canvas></div>' +
    '<div class="ld-panel ld-panel--brain" aria-hidden="true">' + BRAIN_SVG + '</div>' +
    '<div class="ld-copy">' +
      '<p class="ld-brand">IEEE <em>EMBS</em></p>' +
      '<p class="ld-inst">KPR INSTITUTE OF ENGINEERING AND TECHNOLOGY</p>' +
      '<p class="ld-chapter">STUDENT CHAPTER</p>' +
      '<div class="ld-bar" aria-hidden="true"><i></i></div>' +
      '<p class="ld-status" role="status" aria-live="polite">INITIALIZING BIOMEDICAL SYSTEMS…</p>' +
      '<ol class="ld-stages" aria-hidden="true">' +
        '<li class="is-active">' + ico('pulse') + 'CONNECTING<small><br>TO CHAPTER SERVICES</small></li>' +
        '<li>' + ico('data') + 'SYNCING<small><br>CHAPTER DATA</small></li>' +
        '<li>' + ico('people') + 'LOADING<small><br>ACTIVITIES &amp; EVENTS</small></li>' +
        '<li>' + ico('doc') + 'ALMOST THERE…</li>' +
      '</ol>' +
      '<div class="ld-fail">' +
        '<p class="ld-fail-note">The chapter’s live data could not be reached right now. You can try again, or continue to the website.</p>' +
        '<div class="ld-btns"><button type="button" class="ld-btn" data-ld="retry">RETRY CONNECTION</button>' +
        '<button type="button" class="ld-btn ld-btn--ghost" data-ld="continue">CONTINUE TO WEBSITE</button></div>' +
      '</div>' +
    '</div>';
  doc.body.insertBefore(el, doc.body.firstChild);

  var $ = function (s) { return el.querySelector(s); };
  var statusEl = $('.ld-status');
  var stageEls = el.querySelectorAll('.ld-stages li');
  var barEl = $('.ld-bar i');
  var BAR = [12, 40, 70, 100];

  var statusTimer = 0;
  function setStatus(text) {
    if (statusEl.textContent === text) return;
    if (REDUCE) { statusEl.textContent = text; return; }
    statusEl.classList.add('is-swap');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { statusEl.textContent = text; statusEl.classList.remove('is-swap'); }, 180);
  }
  function setStage(i) {
    st.stage = Math.max(st.stage, i);
    for (var k = 0; k < stageEls.length; k++) stageEls[k].className = k < st.stage ? 'is-done' : k === st.stage ? 'is-active' : '';
    barEl.style.width = BAR[st.stage] + '%';
  }
  function okCount() {
    var n = 0;
    CRITICAL.forEach(function (k) { if (st.critical[k] === 'ok' || st.critical[k] === 'answered') n++; });
    return n;
  }

  /* ── progress: driven only by real responses ─────────────────── */
  function progress() {
    if (st.done) return;
    if (st.responded && !st.criticalFailed) {
      setStage(1);
      setStatus('SYNCHRONIZING CHAPTER DATA…');
      var evts = st.critical['/events'], mems = st.critical['/members'];
      if (evts || mems) {
        setStage(2);
        if (!evts) setStatus('LOADING ACTIVITIES & EVENTS…');
        else if (!mems) setStatus('LOADING CHAPTER DATA…');
      }
    }
    if (okCount() === CRITICAL.length) ready();
  }

  setTimeout(function () {
    if (!st.responded && !st.done && !st.failed) setStatus('WAKING CHAPTER SERVICES — THIS CAN TAKE UP TO A MINUTE…');
  }, 6000);

  win.addEventListener('load', function () {
    setTimeout(function () { if (!st.done && st.issued === 0) ready(); }, 800);
  });

  var giveUp = setTimeout(fail, GIVE_UP_MS);

  var polling = false;
  function reconnect() {
    if (polling || st.done) return;
    polling = true;
    setStatus('RECONNECTING TO CHAPTER SERVICES…');
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

  function fail() {
    if (st.done) return;
    st.failed = true;
    el.classList.add('is-failed');
    setStatus('WE’RE HAVING TROUBLE CONNECTING TO CHAPTER SERVICES.');
    var b = $('[data-ld=retry]');
    if (b) b.focus({ preventScroll: true });
  }

  $('[data-ld=continue]').addEventListener('click', function () { ready(true); });
  $('[data-ld=retry]').addEventListener('click', function () {
    var btn = this, tries = 0;
    btn.disabled = true;
    setStatus('RECONNECTING TO CHAPTER SERVICES…');
    (function poll() {
      nativeFetch(API + '/health', { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw 0;
        try { sessionStorage.removeItem(RELOAD_KEY); } catch (e) {}
        win.location.reload();
      }).catch(function () {
        if (++tries < 10) return setTimeout(poll, 3000);
        btn.disabled = false;
        setStatus('WE’RE HAVING TROUBLE CONNECTING TO CHAPTER SERVICES.');
      });
    })();
  });

  /* ── leaving ─────────────────────────────────────────────────── */
  function ready(skipped) {
    if (st.done) return;
    st.done = true;
    clearTimeout(giveUp);
    if (skipped) return leave(0);
    try { sessionStorage.setItem(WARM_KEY, String(Date.now())); sessionStorage.removeItem(RELOAD_KEY); } catch (e) {}
    setStage(3);
    setStatus('ALMOST THERE…');
    /* data is in: hold to the minimum display time, then a short "ready" beat */
    var wait = Math.max(0, MIN_SHOW_MS - (performance.now() - t0));
    setTimeout(function () {
      setStatus('SYSTEM READY');
      stageEls[3].className = 'is-done';
      scene.disperse();
      leave(450);
    }, wait);
  }
  function leave(hold) {
    setTimeout(function () {
      el.classList.add('is-leaving');
      root.classList.remove('embs-loading');
      st.revealed = true;
      revealFns.splice(0).forEach(function (fn) { try { fn(); } catch (e) {} });
      setTimeout(function () { scene.stop(); if (el.parentNode) el.parentNode.removeChild(el); }, REDUCE ? 320 : 780);
    }, hold);
  }

  /* Home-page animation hook: run fn once the overlay starts to leave. */
  win.EMBSLoader = {
    holding: function () { return !st.revealed; },
    onReveal: function (fn) { if (st.revealed) fn(); else revealFns.push(fn); }
  };

  /* ================================================================
     SCENE — Canvas 2D, no dependencies.
     An anatomical heart rendered as a translucent hologram (rim-lit
     myocardium + great vessels, glowing coronary network), orbital
     rings, slow DNA helices, a few dust motes, an ECG in the side
     panel. One spring system driven by the cursor moves it all.
     ================================================================ */
  var scene = (function () {
    var canvas = el.querySelector('.ld-canvas');
    var ctx = canvas.getContext('2d');
    var ecgCanvas = el.querySelector('.ld-ecg');
    var ectx = ecgCanvas && ecgCanvas.getContext('2d');
    if (!ctx) return { disperse: function () {}, stop: function () {} };

    var DPR = Math.min(win.devicePixelRatio || 1, LOW ? 1 : 1.6);
    var W = 0, H = 0, CX = 0, CY = 0, R = 0;
    var C = { blue: '79,125,255', blueL: '122,162,255', violet: '139,92,246', violetL: '183,148,255', magenta: '214,120,255' };

    /* ── anatomical model (anterior view): x → viewer's right (patient's
       left), z up, y into the screen (posterior) ── */
    var S0 = 0.9, Z0 = -0.35;
    function fin(p) { return [p[0] * S0, p[1] * S0, (p[2] + Z0) * S0]; }
    function rotY(p, a) { var c = Math.cos(a), s = Math.sin(a); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; }
    /* ellipsoid in a frame tilted about y; `taper` narrows it toward local -z
       (the apex), turning the ventricles into the organ's blunt cone */
    function ell(p, c, r, tilt, taper) {
      var q = rotY([p[0] - c[0], p[1] - c[1], p[2] - c[2]], -tilt);
      var sN = taper && q[2] < 0 ? Math.min(1, -q[2] / r[2]) : 0;
      var f = sN ? Math.max(0.12, 1 - taper * Math.pow(sN, 1.6)) : 1;
      return (Math.sqrt(q[0] * q[0] / (r[0] * r[0] * f * f) + q[1] * q[1] / (r[1] * r[1] * f * f) + q[2] * q[2] / (r[2] * r[2])) - 1) * Math.min(r[0], r[1], r[2]);
    }
    function smin(a, b, k) { var h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
    var TILT = -0.95;
    var PARTS = [
      [[0.24, 0.1, -0.28], [0.58, 0.6, 1.18], TILT, 0.9],       /* left ventricle (forms the apex) */
      [[-0.2, -0.22, -0.08], [0.56, 0.44, 0.8], TILT, 0.8],     /* right ventricle */
      [[-0.6, 0.05, 0.38], [0.34, 0.34, 0.36], 0],       /* right atrium */
      [[0.12, 0.42, 0.42], [0.46, 0.3, 0.28], 0],        /* left atrium */
      [[0.56, -0.08, 0.46], [0.22, 0.12, 0.11], 0.3],    /* left auricle */
      [[-0.42, -0.3, 0.55], [0.2, 0.12, 0.13], -0.3]     /* right auricle */
    ];
    /* surface grooves (interventricular + atrioventricular sulci) where the
       coronary arteries run: an inward dent around each path's directions */
    var CEN0 = [0.0, 0.05, -0.05];
    var GROOVE_P = [
      [[0.18, -0.55, 0.42], [0.3, -0.68, 0.0], [0.55, -0.55, -0.6], [0.78, -0.25, -1.05]],
      [[0.25, -0.4, 0.42], [0.6, -0.25, 0.35], [0.75, 0.1, 0.25], [0.55, 0.45, 0.1]],
      [[-0.15, -0.5, 0.42], [-0.55, -0.4, 0.25], [-0.75, -0.05, 0.0], [-0.55, 0.3, -0.35]]
    ];
    var GROOVE_D = [];
    GROOVE_P.forEach(function (P) {
      for (var k = 0; k <= 22; k++) {
        var t = k / 22, u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
        var q = [a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0] - CEN0[0], a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1] - CEN0[1], a * P[0][2] + b * P[1][2] + c * P[2][2] + d * P[3][2] - CEN0[2]];
        var l = Math.hypot(q[0], q[1], q[2]); GROOVE_D.push(q[0] / l, q[1] / l, q[2] / l);
      }
    });
    function groove(x, y, z) {
      var dx = x - CEN0[0], dy = y - CEN0[1], dz = z - CEN0[2], l = Math.hypot(dx, dy, dz) || 1, best = 1;
      dx /= l; dy /= l; dz /= l;
      for (var k = 0; k < GROOVE_D.length; k += 3) { var ad = 1 - (dx * GROOVE_D[k] + dy * GROOVE_D[k + 1] + dz * GROOVE_D[k + 2]); if (ad < best) best = ad; }
      return 0.05 * Math.exp(-best / 0.0035);
    }
    function SDF(x, y, z) {
      var p = [x, y, z], d = 0;
      for (var i = 0; i < PARTS.length; i++) { var e = ell(p, PARTS[i][0], PARTS[i][1], PARTS[i][2], PARTS[i][3]); d = i ? smin(d, e, 0.22) : e; }
      return d + groove(x, y, z);
    }
    function norm(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
    function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
    function grad(p) {
      var h = 0.01;
      return norm([SDF(p[0] + h, p[1], p[2]) - SDF(p[0] - h, p[1], p[2]), SDF(p[0], p[1] + h, p[2]) - SDF(p[0], p[1] - h, p[2]), SDF(p[0], p[1], p[2] + h) - SDF(p[0], p[1], p[2] - h)]);
    }
    var CEN = [0.0, 0.05, -0.05];
    function surfR(dx, dy, dz) {
      var lo = 0, hi = 0;
      for (var r = 0.04; r < 2.4; r += 0.04) { if (SDF(CEN[0] + r * dx, CEN[1] + r * dy, CEN[2] + r * dz) > 0) { hi = r; lo = r - 0.04; break; } }
      if (!hi) return 1;
      for (var b = 0; b < 14; b++) { var m = (lo + hi) / 2; if (SDF(CEN[0] + m * dx, CEN[1] + m * dy, CEN[2] + m * dz) > 0) hi = m; else lo = m; }
      return (lo + hi) / 2;
    }
    function bezAt(P, t) {
      var u = 1 - t, a = u * u * u, b2 = 3 * u * u * t, c2 = 3 * u * t * t, d2 = t * t * t;
      return [a * P[0][0] + b2 * P[1][0] + c2 * P[2][0] + d2 * P[3][0], a * P[0][1] + b2 * P[1][1] + c2 * P[2][1] + d2 * P[3][1], a * P[0][2] + b2 * P[1][2] + c2 * P[2][2] + d2 * P[3][2]];
    }

    /* vertices (model position) + normals; quads index into them */
    var VX = [], VN = [], QUADS = [], QHUE = [];
    var LAT = LOW ? 18 : 30, LON = LOW ? 32 : 56;
    for (var i = 0; i < LAT; i++) {
      var phi = -Math.PI / 2 + (i + 0.5) * Math.PI / LAT;
      for (var j = 0; j < LON; j++) {
        var th = j * 2 * Math.PI / LON;
        var dx = Math.cos(phi) * Math.cos(th), dy = Math.cos(phi) * Math.sin(th), dz = Math.sin(phi), rr = surfR(dx, dy, dz);
        var raw = [CEN[0] + rr * dx, CEN[1] + rr * dy, CEN[2] + rr * dz];
        VX.push(fin(raw)); VN.push(grad(raw));
      }
    }
    for (var i1 = 0; i1 < LAT - 1; i1++) for (var j1 = 0; j1 < LON; j1++) {
      var a0 = i1 * LON + j1, b0 = i1 * LON + (j1 + 1) % LON;
      QUADS.push(a0, b0, b0 + LON, a0 + LON);
      QHUE.push(VX[a0][2] > 0.12 ? 1 : 0);          /* atria / base violet, ventricles blue */
    }

    var RING_PTS = LOW ? 8 : 12;
    var VESSELS = [];
    function tube(P, r0, r1, rings, hue, inflow) {
      var first = VX.length, cl = [];
      for (var k = 0; k <= rings; k++) {
        var t = k / rings, p = bezAt(P, t), q = bezAt(P, Math.min(1, t + 0.02)), o = bezAt(P, Math.max(0, t - 0.02));
        var T = norm([q[0] - o[0], q[1] - o[1], q[2] - o[2]]);
        var up = Math.abs(T[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
        var Nn = norm(cross(T, up)), Bn = cross(T, Nn), r = r0 + (r1 - r0) * t;
        for (var a = 0; a < RING_PTS; a++) {
          var an = a / RING_PTS * Math.PI * 2, c1 = Math.cos(an), s1 = Math.sin(an);
          var nrm = [Nn[0] * c1 + Bn[0] * s1, Nn[1] * c1 + Bn[1] * s1, Nn[2] * c1 + Bn[2] * s1];
          VX.push(fin([p[0] + nrm[0] * r, p[1] + nrm[1] * r, p[2] + nrm[2] * r])); VN.push(nrm);
        }
        cl.push(fin(p));
      }
      for (var k2 = 0; k2 < rings; k2++) for (var a2 = 0; a2 < RING_PTS; a2++) {
        var v0 = first + k2 * RING_PTS + a2, v1 = first + k2 * RING_PTS + (a2 + 1) % RING_PTS;
        QUADS.push(v0, v1, v1 + RING_PTS, v0 + RING_PTS); QHUE.push(hue);
      }
      VESSELS.push({ cl: cl, inflow: !!inflow, big: r0 > 0.12, r: (r0 + r1) / 2, hue: hue });
    }
    var RF = LOW ? 0.6 : 1, nr = function (n) { return Math.max(4, Math.round(n * RF)); };
    tube([[0.02, -0.02, 0.45], [-0.08, -0.06, 1.15], [0.28, 0.08, 1.58], [0.55, 0.32, 1.3]], 0.16, 0.15, nr(18), 1);      /* aorta + arch */
    tube([[0.55, 0.32, 1.3], [0.7, 0.44, 1.05], [0.66, 0.5, 0.6], [0.62, 0.55, 0.1]], 0.15, 0.13, nr(12), 1);           /* descending aorta */
    tube([[0.06, -0.02, 1.36], [0.0, -0.04, 1.6], [-0.12, -0.02, 1.75], [-0.18, 0, 1.95]], 0.07, 0.055, nr(8), 1);      /* brachiocephalic */
    tube([[0.24, 0.06, 1.48], [0.25, 0.07, 1.65], [0.28, 0.08, 1.8], [0.3, 0.08, 1.98]], 0.055, 0.045, nr(8), 1);       /* left common carotid */
    tube([[0.4, 0.17, 1.44], [0.45, 0.2, 1.62], [0.58, 0.24, 1.76], [0.7, 0.26, 1.86]], 0.055, 0.047, nr(8), 1);        /* left subclavian */
    tube([[0.12, -0.42, 0.42], [0.2, -0.4, 0.75], [0.26, -0.18, 0.98], [0.26, 0.0, 1.02]], 0.15, 0.13, nr(10), 0);      /* pulmonary trunk */
    tube([[0.26, 0.0, 1.02], [0.45, 0.05, 1.05], [0.62, 0.15, 1.02], [0.82, 0.22, 0.98]], 0.1, 0.08, nr(9), 0);         /* left pulmonary a. */
    tube([[0.26, 0.0, 1.02], [0.05, 0.2, 1.0], [-0.3, 0.25, 0.98], [-0.62, 0.28, 0.95]], 0.1, 0.08, nr(10), 0);        /* right pulmonary a. */
    tube([[-0.6, 0.02, 0.62], [-0.6, 0.02, 0.95], [-0.58, 0.02, 1.3], [-0.56, 0.02, 1.62]], 0.12, 0.11, nr(9), 0, true);   /* superior vena cava */
    tube([[-0.58, 0.3, 0.05], [-0.6, 0.34, -0.15], [-0.6, 0.36, -0.3], [-0.58, 0.38, -0.45]], 0.1, 0.09, nr(5), 0, true); /* inferior vena cava (posterior) */
    tube([[-0.1, 0.62, 0.48], [-0.25, 0.72, 0.5], [-0.4, 0.78, 0.52], [-0.52, 0.82, 0.55]], 0.055, 0.05, nr(6), 0, true);  /* pulmonary veins */
    tube([[0.38, 0.62, 0.46], [0.55, 0.7, 0.48], [0.68, 0.74, 0.5], [0.8, 0.78, 0.52]], 0.055, 0.05, nr(6), 0, true);
    var NV = VX.length, NQ = QHUE.length;
    var PX = new Float32Array(NV), PY = new Float32Array(NV), FC = new Float32Array(NV), LM = new Float32Array(NV);

    /* coronary network pressed onto the surface, with procedural twigs */
    var seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    function rawOnSurface(q) { var d = norm([q[0] - CEN[0], q[1] - CEN[1], q[2] - CEN[2]]), r = surfR(d[0], d[1], d[2]) * 1.012; return [CEN[0] + d[0] * r, CEN[1] + d[1] * r, CEN[2] + d[2] * r]; }
    function trace(P, n) { var out = []; for (var k = 0; k <= n; k++) out.push(rawOnSurface(bezAt(P, k / n))); return out; }
    var CN = LOW ? 16 : 30;
    var MAIN = [
      [[0.18, -0.55, 0.42], [0.3, -0.68, 0.0], [0.55, -0.55, -0.6], [0.78, -0.25, -1.05]],     /* LAD */
      [[0.25, -0.4, 0.42], [0.6, -0.25, 0.35], [0.75, 0.1, 0.25], [0.55, 0.45, 0.1]],          /* circumflex */
      [[-0.15, -0.5, 0.42], [-0.55, -0.4, 0.25], [-0.75, -0.05, 0.0], [-0.55, 0.3, -0.35]],    /* right coronary */
      [[-0.65, -0.3, 0.12], [-0.55, -0.42, -0.15], [-0.35, -0.45, -0.45], [-0.15, -0.42, -0.7]] /* right marginal */
    ];
    var CORONARY = [], MAIN_LINES = [];
    MAIN.forEach(function (P, mi) {
      var raw = trace(P, CN);
      var mainPts = raw.map(fin);
      CORONARY.push({ w: 1, pts: mainPts }); MAIN_LINES.push(mainPts);
      var twigs = LOW ? 3 : (mi === 0 ? 7 : 5);
      for (var tw = 0; tw < twigs; tw++) {
        var at = 0.15 + 0.75 * (tw + rnd() * 0.5) / twigs, base = raw[Math.min(CN, Math.round(at * CN))];
        var side = (tw % 2 ? 1 : -1), len = 0.22 + rnd() * 0.22;
        var end = [base[0] + side * len * 0.8 + 0.06, base[1] + (rnd() - 0.5) * 0.25, base[2] - len * 0.7];
        var mid = [(base[0] + end[0]) / 2 + side * 0.06, (base[1] + end[1]) / 2, (base[2] + end[2]) / 2 + 0.04];
        var tp = trace([base, mid, mid, end], LOW ? 5 : 8);
        CORONARY.push({ w: 0.6, pts: tp.map(fin) });
        if (!LOW && rnd() < 0.6) {
          var b2 = tp[4] || tp[tp.length - 1], e2 = [b2[0] - side * 0.12, b2[1], b2[2] - 0.14];
          CORONARY.push({ w: 0.4, pts: trace([b2, b2, e2, e2], 4).map(fin) });
        }
      }
    });

    /* particles: blood along vessel centrelines + main coronaries */
    var VP = [], FLOW = [];
    if (!REDUCE) {
      VESSELS.forEach(function (v, vi) { for (var k = 0; k < (LOW ? 1 : (v.big ? 4 : 2)); k++) VP.push({ v: vi, s: Math.random(), sp: 0.22 + Math.random() * 0.2 }); });
      for (var f = 0; f < (LOW ? 8 : 18); f++) FLOW.push({ k: (Math.random() * MAIN_LINES.length) | 0, s: Math.random(), v: 0.18 + Math.random() * 0.16 });
    }
    var DUST_N = REDUCE ? 20 : LOW ? 18 : 45;
    var dust = [];
    function seedDust() {
      dust = [];
      for (var d = 0; d < DUST_N; d++) dust.push({ x: Math.random() * W, y: Math.random() * H, z: 0.25 + Math.random() * 0.75, vx: (Math.random() - 0.5) * 5, vy: -2 - Math.random() * 5, ox: 0, oy: 0 });
    }
    var trail = [];

    var ptr = { x: 0, y: 0, nx: 0, ny: 0, on: false };
    var sp = { yaw: -0.12, yv: 0, pitch: 0.06, pv: 0, ox: 0, oxv: 0, oy: 0, oyv: 0, near: 0 };
    var disperseAt = 0, ecgW = 0, ecgH = 0;

    function layout() {
      W = win.innerWidth; H = win.innerHeight;
      canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      var copy = el.querySelector('.ld-copy');
      var copyTop = copy ? copy.getBoundingClientRect().top : H * 0.62;
      var top = SMALL ? 70 : 24, avail = Math.max(170, copyTop - top - 16);
      /* vessels reach ~1.55R above the centre, apex/rings ~1.45R below */
      /* the apex may tuck just behind the title, as in the reference art */
      R = Math.max(46, Math.min(W * (SMALL ? 0.36 : 0.26), avail / 2.45));
      CX = W / 2;
      CY = top + Math.max(0, (avail - R * 2.8) / 2) + R * 1.5;
      if (ecgCanvas) {
        var rc = ecgCanvas.getBoundingClientRect();
        ecgW = Math.round(rc.width); ecgH = Math.round(rc.height);
        if (ecgW > 0) { ecgCanvas.width = ecgW * DPR; ecgCanvas.height = ecgH * DPR; ectx.setTransform(DPR, 0, 0, DPR, 0, 0); }
      }
      seedDust();
    }

    var PERIOD = 0.9;
    function ecgAt(ph) {
      ph = ph - Math.floor(ph);
      var g = function (c, w, a) { var d = (ph - c) / w; return a * Math.exp(-d * d); };
      return g(0.12, 0.03, 0.12) + g(0.27, 0.008, -0.14) + g(0.30, 0.011, 1) + g(0.335, 0.01, -0.28) + g(0.55, 0.05, 0.26);
    }
    function pulseAt(ph) { ph = ph - Math.floor(ph); var d = (ph - 0.32) / 0.07; return Math.exp(-d * d); }

    var glowSprite = (function () {
      var s = doc.createElement('canvas'); s.width = s.height = 64;
      var g = s.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      return s;
    })();

    var cyw = 1, syw = 0, cpt = 1, spt = 0, scale = 1, OX = 0, OY = 0;
    function projP(p, out) {
      var x = p[0] * cyw - p[1] * syw, y = p[0] * syw + p[1] * cyw, z = p[2];
      var y2 = y * cpt - z * spt, z2 = y * spt + z * cpt, k = 3.4 / (3.4 + y2);
      out[0] = CX + OX + x * scale * k; out[1] = CY + OY - z2 * scale * k; out[2] = y2;
    }

    var last = 0, tSec = 0, raf = 0, running = false;
    function frame(now) {
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now; tSec += dt;
      var k = dt * 60;
      var tx, ty;
      if (INTERACTIVE && ptr.on) { tx = ptr.nx; ty = ptr.ny; }
      else { tx = Math.sin(tSec * 0.4) * 0.4; ty = Math.sin(tSec * 0.26) * 0.2; }
      var tYaw = -0.12 + Math.sin(tSec * 0.2) * 0.14 + tx * 0.85, tPitch = 0.06 + ty * 0.42;
      sp.yv = (sp.yv + (tYaw - sp.yaw) * 0.045 * k) * Math.pow(0.86, k); sp.yaw += sp.yv * k;
      sp.pv = (sp.pv + (tPitch - sp.pitch) * 0.045 * k) * Math.pow(0.86, k); sp.pitch += sp.pv * k;
      sp.oxv = (sp.oxv + (tx * 22 - sp.ox) * 0.05 * k) * Math.pow(0.85, k); sp.ox += sp.oxv * k;
      sp.oyv = (sp.oyv + (ty * 14 - sp.oy) * 0.05 * k) * Math.pow(0.85, k); sp.oy += sp.oyv * k;
      var dist = INTERACTIVE && ptr.on ? Math.hypot(ptr.x - CX, ptr.y - CY) : 9999;
      sp.near += (Math.max(0, 1 - dist / (R * 3)) - sp.near) * Math.min(1, 0.08 * k);
      draw(tSec, dt);
      if (running) raf = win.requestAnimationFrame(frame);
    }

    var tmp = [0, 0, 0], tmp2 = [0, 0, 0];
    function strokeLine(line, rgb, aFront, aBack, width) {
      var front = new Path2D(), back = new Path2D();
      projP(line[0], tmp);
      for (var s3 = 1; s3 < line.length; s3++) {
        projP(line[s3], tmp2);
        var path = (tmp[2] + tmp2[2] < 0) ? front : back;
        path.moveTo(tmp[0], tmp[1]); path.lineTo(tmp2[0], tmp2[1]);
        tmp[0] = tmp2[0]; tmp[1] = tmp2[1]; tmp[2] = tmp2[2];
      }
      ctx.lineWidth = width;
      ctx.strokeStyle = 'rgba(' + rgb + ',' + aBack + ')'; ctx.stroke(back);
      ctx.strokeStyle = 'rgba(' + rgb + ',' + aFront + ')'; ctx.stroke(front);
    }

    function helix(x0, y0, x1, y1, amp, steps, t, alpha, par) {
      var ax = x1 - x0, ay = y1 - y0, L = Math.hypot(ax, ay), nx = -ay / L, ny = ax / L;
      for (var s = 0; s <= steps; s++) {
        var f = s / steps, cxp = x0 + ax * f + OX * par, cyp = y0 + ay * f + OY * par, ph = f * 13 + t * (REDUCE ? 0 : 0.35);
        var o1 = Math.sin(ph) * amp, d1 = Math.cos(ph);
        var x1p = cxp + nx * o1, y1p = cyp + ny * o1, x2p = cxp - nx * o1, y2p = cyp - ny * o1;
        if (s % 2 === 0) {
          ctx.strokeStyle = 'rgba(' + C.blueL + ',' + (alpha * 0.25).toFixed(3) + ')'; ctx.lineWidth = Math.max(1, amp * 0.08);
          ctx.beginPath(); ctx.moveTo(x1p, y1p); ctx.lineTo(x2p, y2p); ctx.stroke();
        }
        var s1 = amp * (0.22 + 0.1 * d1), s2 = amp * (0.22 - 0.1 * d1);
        ctx.globalAlpha = alpha * (0.45 + 0.35 * d1); ctx.drawImage(glowSprite, x1p - s1, y1p - s1, s1 * 2, s1 * 2);
        ctx.globalAlpha = alpha * (0.45 - 0.35 * d1); ctx.drawImage(glowSprite, x2p - s2, y2p - s2, s2 * 2, s2 * 2);
        ctx.globalAlpha = 1;
      }
    }

    var RINGS = [[1.5, 0.1, 0.12, C.violetL], [1.78, -0.12, -0.08, C.blueL]];
    var cang = 0;
    function ring(rg, wantFront, t) {
      var rad = rg[0], tilt = rg[1], spin = t * rg[2] * (REDUCE ? 0 : 1);
      /* nearly flat rings round the heart's middle, viewed slightly from above */
      var lean = 0.24 + tilt * 0.6 + sp.pitch * 0.5, ct = Math.cos(lean), stt = Math.sin(lean), cy2 = Math.cos(sp.yaw * 0.4 + tilt), sy2 = Math.sin(sp.yaw * 0.4 + tilt);
      var prev = null, beads = [], pth = new Path2D();
      for (var a3 = 0; a3 <= 120; a3++) {
        var ang = a3 / 120 * Math.PI * 2 + spin;
        var px3 = Math.cos(ang) * rad, py3 = Math.sin(ang) * rad;
        var x3 = px3 * cy2 - py3 * sy2, y3 = px3 * sy2 + py3 * cy2;
        var yt = y3 * ct, zt = y3 * stt - 0.12, kk = 3.4 / (3.4 + yt);
        var sx = CX + OX * 0.6 + x3 * scale * kk, sy = CY + OY * 0.6 - zt * scale * kk;
        var warp = 1 + 0.06 * sp.near * Math.cos(Math.atan2(sy - CY, sx - CX) - cang);
        sx = CX + (sx - CX) * warp; sy = CY + (sy - CY) * warp;
        var isFront = yt < 0;
        if (prev && isFront === wantFront) { pth.moveTo(prev[0], prev[1]); pth.lineTo(sx, sy); }
        if (a3 % 30 === 7 && isFront === wantFront) beads.push([sx, sy]);
        prev = [sx, sy];
      }
      var af = wantFront ? 0.55 : 0.16;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(' + rg[3] + ',' + (af * 0.16).toFixed(3) + ')'; ctx.stroke(pth);
      ctx.lineWidth = 1.1; ctx.strokeStyle = 'rgba(' + rg[3] + ',' + af.toFixed(3) + ')'; ctx.stroke(pth);
      beads.forEach(function (bd) {
        var near = INTERACTIVE && ptr.on ? Math.max(0, 1 - Math.hypot(ptr.x - bd[0], ptr.y - bd[1]) / 120) : 0;
        ctx.globalAlpha = (wantFront ? 0.7 : 0.25) + near * 0.3; ctx.drawImage(glowSprite, bd[0] - 6, bd[1] - 6, 12, 12); ctx.globalAlpha = 1;
      });
    }

    var LEVELS = 16, paths = [];
    function draw(t, dt) {
      ctx.clearRect(0, 0, W, H);
      var ph = t / PERIOD, pulse = REDUCE ? 0 : pulseAt(ph);
      var disp = disperseAt ? Math.min(1, (t - disperseAt) / 0.7) : 0;
      scale = R * (1 + 0.025 * pulse + 0.05 * disp);
      cyw = Math.cos(sp.yaw); syw = Math.sin(sp.yaw); cpt = Math.cos(sp.pitch); spt = Math.sin(sp.pitch);
      OX = sp.ox; OY = sp.oy;
      cang = INTERACTIVE && ptr.on ? Math.atan2(ptr.y - CY, ptr.x - CX) : 0;
      ctx.globalCompositeOperation = 'lighter';

      /* DNA helices (background, slow, soft) */
      if (!SMALL) {
        helix(W * 0.78, -H * 0.1, W * 1.0, H * 1.1, Math.min(70, W * 0.045), 46, t, 0.6, 0.5);
        helix(-W * 0.06, H * 0.55, W * 0.28, H * 1.14, Math.min(58, W * 0.038), 30, t + 2, 0.42, 0.8);
      }

      /* dust motes (few, faint) */
      for (var d = 0; d < dust.length; d++) {
        var q = dust[d];
        if (!REDUCE) {
          q.x += (q.vx + (disp ? (q.x - CX) * 1.5 : 0)) * dt; q.y += (q.vy + (disp ? (q.y - CY) * 1.5 : 0)) * dt;
          if (q.y < -10) { q.y = H + 10; q.x = Math.random() * W; }
          if (q.x < -10) q.x = W + 10; else if (q.x > W + 10) q.x = -10;
        }
        var px = q.x + OX * q.z * 1.6, py = q.y + OY * q.z * 1.6, glow = 0;
        if (INTERACTIVE && ptr.on) {
          var ddx = px - ptr.x, ddy = py - ptr.y, dd = Math.hypot(ddx, ddy);
          if (dd < 140) { var push = 1 - dd / 140; q.ox += (ddx / (dd || 1)) * push * 1.3; q.oy += (ddy / (dd || 1)) * push * 1.3; glow = push; }
        }
        q.ox *= 0.94; q.oy *= 0.94;
        ctx.fillStyle = 'rgba(' + C.blueL + ',' + ((0.06 + 0.14 * q.z) + glow * 0.35).toFixed(3) + ')';
        var sz = 0.6 + q.z;
        ctx.fillRect(px + q.ox - sz / 2, py + q.oy - sz / 2, sz, sz);
      }

      /* volumetric glow behind the heart */
      var gr = ctx.createRadialGradient(CX + OX, CY + OY, 0, CX + OX, CY + OY, scale * 2);
      var ga = 0.2 + 0.08 * pulse + 0.1 * sp.near + 0.25 * disp;
      gr.addColorStop(0, 'rgba(' + C.blue + ',' + ga.toFixed(3) + ')'); gr.addColorStop(0.5, 'rgba(' + C.violet + ',' + (ga * 0.35).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(' + C.violet + ',0)');
      ctx.fillStyle = gr; ctx.fillRect(CX + OX - scale * 2, CY + OY - scale * 2, scale * 4, scale * 4);

      /* orbital rings: back halves behind the heart */
      RINGS.forEach(function (rg) { ring(rg, false, t); });

      /* hologram: project vertices, rim-light each quad (fresnel), batch by level */
      for (var v = 0; v < NV; v++) {
        projP(VX[v], tmp); PX[v] = tmp[0]; PY[v] = tmp[1];
        var n = VN[v], nxv = n[0] * cyw - n[1] * syw, ny2 = n[0] * syw + n[1] * cyw;
        var nd = ny2 * cpt - n[2] * spt, nu = ny2 * spt + n[2] * cpt;
        FC[v] = -nd;                                   /* +1 = facing the viewer */
        /* key light from the upper left, in front of the organ */
        var lam = nxv * -0.45 + nd * -0.55 + nu * 0.7;
        LM[v] = lam > 0 ? lam : 0;
      }
      for (var lv = 0; lv < LEVELS * 2; lv++) paths[lv] = new Path2D();
      var amp = 1 + 0.25 * pulse + 0.15 * sp.near;
      for (var qd = 0; qd < NQ; qd++) {
        var o = qd * 4, A = QUADS[o], B = QUADS[o + 1], Cc = QUADS[o + 2], D = QUADS[o + 3];
        var fc = (FC[A] + FC[B] + FC[Cc] + FC[D]) * 0.25, rim = 1 - Math.abs(fc);
        var lit = (LM[A] + LM[B] + LM[Cc] + LM[D]) * 0.25;
        /* lambert form shading + hologram rim; back faces faint */
        var alpha = (0.07 + 0.3 * Math.pow(lit, 1.3) + 0.32 * rim * rim * rim) * (fc < 0 ? 0.24 : 1) * amp;
        if (alpha < 0.012) continue;
        var pth2 = paths[QHUE[qd] * LEVELS + Math.min(LEVELS - 1, Math.floor(alpha / 0.032))];
        pth2.moveTo(PX[A], PY[A]); pth2.lineTo(PX[B], PY[B]); pth2.lineTo(PX[Cc], PY[Cc]); pth2.lineTo(PX[D], PY[D]); pth2.closePath();
      }
      for (var h2 = 0; h2 < 2; h2++) for (var l2 = 0; l2 < LEVELS; l2++) {
        ctx.fillStyle = 'rgba(' + (h2 ? C.violet : C.blue) + ',' + ((l2 + 0.5) * 0.032).toFixed(3) + ')';
        ctx.fill(paths[h2 * LEVELS + l2]);
      }
      /* soft body for the great vessels */
      ctx.lineCap = 'round';
      VESSELS.forEach(function (V) {
        strokeLine(V.cl, V.hue ? C.violetL : C.blueL, '0.12', '0.04', Math.max(2, V.r * 2 * S0 * scale));
      });
      ctx.lineCap = 'butt';
      /* myocardial fibres: oblique spiral strands over the ventricles */
      ctx.lineWidth = 0.55;
      ctx.strokeStyle = 'rgba(' + C.blueL + ',0.1)';
      ctx.beginPath();
      for (var i3 = 0; i3 < LAT - 1; i3++) for (var j3 = 0; j3 < LON; j3 += 3) {
        var aa = i3 * LON + j3, bb = (i3 + 1) * LON + (j3 + 1) % LON;
        if (FC[aa] > 0.15 && VX[aa][2] < 0.1) { ctx.moveTo(PX[aa], PY[aa]); ctx.lineTo(PX[bb], PY[bb]); }
      }
      ctx.stroke();

      /* coronary network */
      CORONARY.forEach(function (c) {
        strokeLine(c.pts, C.magenta, (0.12 * c.w + 0.06 * pulse).toFixed(3), '0.02', 3 * c.w + 0.6);
        strokeLine(c.pts, C.magenta, (0.55 + 0.35 * c.w + 0.15 * pulse).toFixed(3), (0.08 * c.w).toFixed(3), 0.55 + 0.7 * c.w);
      });

      /* blood flow (subtle) */
      VP.forEach(function (vp) {
        var V = VESSELS[vp.v]; vp.s += vp.sp * dt * (1 + pulse * 2); if (vp.s > 1) vp.s -= 1;
        var ss = V.inflow ? 1 - vp.s : vp.s, pi = ss * (V.cl.length - 1), i5 = Math.floor(pi), f5 = pi - i5, P = V.cl[i5], Q = V.cl[Math.min(V.cl.length - 1, i5 + 1)];
        projP([P[0] + (Q[0] - P[0]) * f5, P[1] + (Q[1] - P[1]) * f5, P[2] + (Q[2] - P[2]) * f5], tmp);
        ctx.globalAlpha = tmp[2] < 0 ? 0.55 : 0.18; ctx.drawImage(glowSprite, tmp[0] - 5, tmp[1] - 5, 10, 10); ctx.globalAlpha = 1;
      });
      FLOW.forEach(function (fp) {
        var line = MAIN_LINES[fp.k]; fp.s += fp.v * dt * (1 + pulse * 1.5); if (fp.s > 1) fp.s -= 1;
        var pos = fp.s * (line.length - 1), i4 = Math.floor(pos), fr = pos - i4, A2 = line[i4], B2 = line[Math.min(line.length - 1, i4 + 1)];
        projP([A2[0] + (B2[0] - A2[0]) * fr, A2[1] + (B2[1] - A2[1]) * fr, A2[2] + (B2[2] - A2[2]) * fr], tmp);
        ctx.globalAlpha = tmp[2] < 0 ? 0.7 : 0.15; ctx.drawImage(glowSprite, tmp[0] - 4, tmp[1] - 4, 8, 8); ctx.globalAlpha = 1;
      });

      /* orbital rings: front halves over the heart */
      RINGS.forEach(function (rg) { ring(rg, true, t); });

      /* cursor trail: tiny, short-lived */
      for (var tr = trail.length - 1; tr >= 0; tr--) {
        var tp = trail[tr]; tp.l -= dt / 0.35;
        if (tp.l <= 0) { trail.splice(tr, 1); continue; }
        ctx.fillStyle = 'rgba(' + C.blueL + ',' + (tp.l * 0.45).toFixed(3) + ')';
        ctx.fillRect(tp.x - 0.8, tp.y - 0.8, 1.6, 1.6);
      }
      ctx.globalCompositeOperation = 'source-over';

      /* ECG in the side panel, phase-locked to the beat */
      if (ectx && ecgW > 0) {
        ectx.clearRect(0, 0, ecgW, ecgH);
        var base = ecgH * 0.6, ampE = ecgH * 0.42;
        ectx.strokeStyle = 'rgba(' + C.violetL + ',0.85)'; ectx.lineWidth = 1.2; ectx.beginPath();
        for (var e = 0; e <= 90; e++) {
          var xf = e / 90, val = ecgAt(ph - (1 - xf) * 2.2), X = xf * ecgW, Y = base - val * ampE;
          if (e) ectx.lineTo(X, Y); else ectx.moveTo(X, Y);
        }
        ectx.stroke();
      }
    }

    function onMove(e) {
      ptr.x = e.clientX; ptr.y = e.clientY; ptr.on = true;
      ptr.nx = Math.max(-1, Math.min(1, (e.clientX - W / 2) / (W / 2)));
      ptr.ny = Math.max(-1, Math.min(1, (e.clientY - CY) / (H / 2)));
      if (trail.length < 30) trail.push({ x: e.clientX + (Math.random() - 0.5) * 3, y: e.clientY + (Math.random() - 0.5) * 3, l: 1 });
    }
    function onLeave() { ptr.on = false; }
    function onVis() {
      if (doc.hidden) { running = false; win.cancelAnimationFrame(raf); }
      else if (!running && !REDUCE && el.parentNode) { running = true; last = 0; raf = win.requestAnimationFrame(frame); }
    }
    var resizeT = 0;
    function onResize() { clearTimeout(resizeT); resizeT = setTimeout(function () { layout(); if (REDUCE) draw(0, 0); }, 120); }

    layout();
    win.addEventListener('resize', onResize);
    if (INTERACTIVE) { el.addEventListener('pointermove', onMove, { passive: true }); el.addEventListener('pointerleave', onLeave); }
    if (REDUCE) draw(0, 0);
    else { running = true; raf = win.requestAnimationFrame(frame); doc.addEventListener('visibilitychange', onVis); }

    return {
      disperse: function () { if (!REDUCE) disperseAt = tSec; },
      stop: function () {
        running = false; win.cancelAnimationFrame(raf);
        win.removeEventListener('resize', onResize);
        doc.removeEventListener('visibilitychange', onVis);
      }
    };
  })();
})(window, document);
