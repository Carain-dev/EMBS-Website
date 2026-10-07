/* ================================================================
   loader-ui.js — presentation orchestrator. Imported by loader.js
   after first paint. Owns the single rAF loop, the composition, input,
   the instrument overlay and (lazily) the 3D scene. It only *listens*
   to the logic layer and can never delay or block readiness.
   ================================================================ */
import { createMotion, BeatClock } from './loader-motion.js';
import { createSignal } from './loader-signal.js';

const FIRST_BEAT = 1.3;     /* s after start: first heartbeat, trace begins */
const HEART_LIGHT = 0.3;    /* s: earliest moment light may find the heart */

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return false;
    const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
    return true;
  } catch (e) { return false; }
}

export function start(B) {
  const el = B.el;
  const glCanvas = el.querySelector('.ld-gl');
  const sigCanvas = el.querySelector('.ld-sig');
  const labels = el.querySelector('.ld-labels');
  const pool = el.querySelector('.ld-pool');

  let rd = B.reduce();
  const clock = new BeatClock();
  const motion = createMotion({ reduce: rd, touch: B.touch });
  const signal = createSignal(sigCanvas);
  let scene = null, L = null, uiTime = 0, raf = 0, running = true, last = 0;
  let exiting = false, exitT = 0, ptrX = null, ptrY = null, lastPtr = -1e9;
  const dpr = () => Math.min(window.devicePixelRatio || 1, B.small ? 1.5 : 2);

  /* composition: desktop heart right of centre with text on the left;
     portrait heart in the upper part; phone landscape heart left */
  function layout() {
    const W = window.innerWidth, H = window.innerHeight;
    let cx, cy, heartH, trace;
    if (H < 520 && W > H) {
      heartH = H * 0.8; cx = W * 0.3; cy = H * 0.5;
      trace = { x0: W * 0.06, x1: W * 0.54, y: H * 0.93 };
    } else if (W / H < 0.9) {
      heartH = Math.min(H * 0.42, W * 1.1); cx = W * 0.5; cy = Math.max(heartH * 0.56 + 12, H * 0.27);
      trace = { x0: 24, x1: W - 24, y: cy + heartH * 0.62 };
    } else {
      heartH = H * 0.64; cx = W * 0.54; cy = H * 0.48;
      trace = { x0: W * 0.36, x1: W * 0.7, y: Math.min(H * 0.9, cy + heartH * 0.6) };
    }
    L = { W, H, cx, cy, heartH, trace };
    signal.resize(L, dpr());
    if (scene) scene.resize(L, dpr());
    motion.setHeart(cx, cy, Math.min(W, H));
    el.style.setProperty('--ld-trace-y', trace.y + 'px');
    el.style.setProperty('--ld-cx', cx + 'px'); el.style.setProperty('--ld-cy', cy + 'px'); el.style.setProperty('--ld-hh', heartH + 'px');
    el.style.setProperty('--ld-heart-bottom', (cy + heartH * 0.5) + 'px');
    pool.style.left = cx + 'px'; pool.style.top = cy + 'px';
  }
  layout();

  /* ── input ── */
  const onMove = (e) => {
    if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
      const nx = Math.max(-1, Math.min(1, (e.clientX - L.W / 2) / (L.W / 2)));
      const ny = Math.max(-1, Math.min(1, (e.clientY - L.H / 2) / (L.H / 2)));
      const speed = ptrX == null ? 0 : Math.hypot(e.clientX - ptrX, e.clientY - ptrY);
      ptrX = e.clientX; ptrY = e.clientY; lastPtr = uiTime;
      motion.pointer(nx, ny, speed);
    } else if (dragging) {
      motion.drag((e.clientX - dragX) / L.W, (e.clientY - dragY) / L.H);
      dragX = e.clientX; dragY = e.clientY;
    }
  };
  let dragging = false, dragX = 0, dragY = 0;
  const onDown = (e) => { if (e.pointerType === 'touch' && !e.target.closest('button')) { dragging = true; dragX = e.clientX; dragY = e.clientY; } };
  const onUp = () => { if (dragging) { dragging = false; motion.release(); } };
  el.addEventListener('pointermove', onMove, { passive: true });
  el.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  window.addEventListener('pointercancel', onUp, { passive: true });
  let resizeT = 0;
  const onResize = () => { clearTimeout(resizeT); resizeT = setTimeout(layout, 100); };
  window.addEventListener('resize', onResize);
  const onVis = () => {
    if (document.hidden) { running = false; cancelAnimationFrame(raf); }
    else if (!running && el.isConnected) { running = true; last = 0; raf = requestAnimationFrame(frame); }
  };
  document.addEventListener('visibilitychange', onVis);

  /* ── the 3D specimen, loaded after first paint; failures fall back to the still ── */
  /* The live 3D heart costs ~1 MB and some main-thread work, so it is loaded
     only when the backend is slow: if the critical data has not arrived by
     LIVE_AFTER, the still upgrades to the live specimen. A warm backend never
     pays for it and the loader leaves as quickly as before. */
  const LIVE_AFTER = 1500;
  const force = /[?&]ldLive\b/.test(location.search);               /* local testing */
  function loadLive() {
    if (B.isDone() || !running || !webglAvailable()) return;
    import('./loader-scene.js')
      .then((m) => (B.isDone() || !running ? null : m.createScene({ canvas: glCanvas, labelsEl: labels, tier: B.tier, reduce: rd, small: B.small })))
      .then((s) => {
        if (!s) return;
        if (B.isDone() || !running || !el.isConnected) { s.dispose(); return; }   /* data won the race: drop it */
        scene = s; scene.resize(L, dpr());
        if (/[?&]ldDebug\b/.test(location.search)) window.__ldScene = s;   /* local diagnostics only */
        return s.prepare().then(() => {
          if (!scene || B.isDone()) return;
          const wait = Math.max(0, HEART_LIGHT - uiTime);
          setTimeout(() => { if (scene) { scene.reveal(); el.classList.add('is-live'); } }, wait * 1000);
        });
      })
      .catch(() => {});
  }
  setTimeout(loadLive, force ? 0 : Math.max(0, LIVE_AFTER - B.elapsed()));

  /* ── single loop ── */
  function frame(now) {
    if (!running) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now; uiTime += dt;
    if (uiTime >= FIRST_BEAT && !clock.running) { clock.start(); signal.startTrace(); }
    motion.update(dt, ptrX, ptrY);
    clock.step(dt);
    if (exiting) exitT += dt;
    const exitAlpha = exiting ? Math.max(0, 1 - exitT / 0.75) : 1;
    signal.draw(dt, motion, clock, { reduce: rd, uiTime, exiting, exitAlpha });
    if (scene) { try { scene.setPointer(ptrX, ptrY, ptrX != null && uiTime - lastPtr < 2.5); scene.frame(dt, motion, clock); } catch (e) { const s = scene; scene = null; try { s.dispose(); } catch (x) {} B.showStill(); } }
    pool.style.transform = 'translate3d(' + (motion.S.poolX.x * L.W - L.W * 0.03).toFixed(1) + 'px,' + (motion.S.poolY.x * L.H).toFixed(1) + 'px,0) translate(-50%,-50%)';
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  const mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const onReduce = () => setReduce(mqReduce.matches);
  if (mqReduce && mqReduce.addEventListener) mqReduce.addEventListener('change', onReduce);
  function setReduce(v) { rd = !!v; motion.setReduce(rd); if (scene) scene.setReduce(rd); }

  return {
    setReduce,
    /* exit choreography: lands on the end of the current heartbeat, then
       ~900 ms of dolly-in while the light falls away. Resolves when the
       loader layer should start dissolving (overlapping the tail). */
    exit() {
      return new Promise((resolve) => {
        /* land on the beat only if it is close; never add more than ~0.3 s */
        const toBeatEnd = rd ? 0 : Math.min(0.3, clock.timeToBeatEnd());
        setTimeout(() => {
          B.status('Ready');
          el.classList.add('is-exiting');
          exiting = true;
          if (scene) scene.exit();
          setTimeout(resolve, rd ? 80 : 260);
        }, toBeatEnd * 1000);
      });
    },
    dispose() {
      running = false; cancelAnimationFrame(raf);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVis);
      if (mqReduce && mqReduce.removeEventListener) mqReduce.removeEventListener('change', onReduce);
      if (scene) { try { scene.dispose(); } catch (e) {} scene = null; }
      signal.dispose();
    },
  };
}
