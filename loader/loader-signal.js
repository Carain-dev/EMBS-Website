/* ================================================================
   loader-signal.js — the instrument drawn in 2D over the heart:
   two partial calibration arcs (goniometer-like, with fine ticks) and
   the single recorded trace that runs on the heart's own beat clock.
   Hairlines stay crisp at any DPR because they are drawn in 2D.
   ================================================================ */

const COPPER = '160,120,230', HAIR = '196,206,240', VERDIGRIS = '47,201,187';   /* purple ticks, cool hairlines, teal trace */
const TAU = Math.PI * 2;

export function createSignal(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, L = null;
  let reveal = 0, exitP = 0;            /* 0→1 arc stroke reveal; 0→1 exit retraction */
  let started = -1;                     /* trace starts with the first heartbeat */
  let buf = null, pen = 0, staticDone = false, dtLast = 0;

  function resize(layout, dpr) {
    L = layout; W = layout.W; H = layout.H;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.max(40, Math.round((L.trace.x1 - L.trace.x0) / 2));
    const old = buf; buf = new Float32Array(n).fill(NaN);
    if (old) for (let i = 0; i < Math.min(n, old.length); i++) buf[i] = old[i];
    pen = Math.min(pen, n - 1); staticDone = false;
  }

  function arcs(motion, prox, alpha) {
    const p = Math.max(0, reveal - exitP);
    if (p <= 0.001) return;
    /* the instrument frame stays above the trace, clear of the text */
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, L.trace.y - 8); ctx.clip();
    const R1 = L.heartH * 0.66, R2 = L.heartH * 0.76;
    const spec = [
      { r: R1, span: 200 * Math.PI / 180, start: -Math.PI * 0.95 + motion.az * 0.45, ticks: 6 },
      { r: R2, span: 120 * Math.PI / 180, start: -Math.PI * 0.1 - motion.az * 0.3, ticks: 4 },
    ];
    spec.forEach((s, i) => {
      const span = s.span * p, a0 = s.start, a1 = a0 + span;
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${HAIR},${((0.13 + 0.013 * prox) * alpha).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(L.cx, L.cy, s.r, a0, a1); ctx.stroke();
      /* fine, evenly spaced ticks; every fifth slightly longer, in copper */
      const step = (s.ticks * Math.PI) / 180;
      ctx.beginPath();
      for (let a = a0, k = 0; a <= a1 + 1e-6; a += step, k++) {
        const len = k % 5 === 0 ? 7 : 3.5, c = Math.cos(a), sn = Math.sin(a);
        ctx.moveTo(L.cx + c * s.r, L.cy + sn * s.r);
        ctx.lineTo(L.cx + c * (s.r + (i ? -len : len)), L.cy + sn * (s.r + (i ? -len : len)));
      }
      ctx.strokeStyle = `rgba(${COPPER},${((0.36 + 0.04 * prox) * alpha).toFixed(3)})`;
      ctx.stroke();
    });
    ctx.restore();
  }

  function trace(clock, motion, reduce, alpha) {
    const { x0, x1, y } = L.trace, n = buf.length, dx = (x1 - x0) / (n - 1), amp = Math.min(26, L.heartH * 0.055);
    if (reduce) {
      /* a static recorded segment */
      if (!staticDone) {
        const period = clock.base;
        for (let i = 0; i < n; i++) { const tt = ((i / n) * 3.6 * period) % period; buf[i] = clock.ecg(tt, 1); }
        staticDone = true; pen = n - 1;
      }
    } else if (started >= 0) {
      /* the pen sweeps left→right, ~4.5 beats per width, writing the live signal */
      const speed = n / (4.5 * clock.base);
      penAcc += Math.min(n, dtLast * speed);
      while (penAcc >= 1) {
        penAcc -= 1;
        pen = (pen + 1) % n;
        const noise = motion.state.disturb * (Math.sin(pen * 1.7 + clock.t * 40) * 0.5 + Math.sin(pen * 0.37) * 0.5) * 0.18;
        buf[pen] = clock.ecg() + noise;
        for (let e = 1; e <= 6; e++) buf[(pen + e) % n] = NaN;   /* erase band ahead of the pen */
      }
    }
    /* draw with a faint fade on the trailing (older) edge */
    ctx.lineWidth = 1.15;
    ctx.lineJoin = 'round';
    const BINS = 10;
    for (let b = 0; b < BINS; b++) {
      const a = reduce ? 0.72 : (0.12 + 0.78 * (b + 1) / BINS);
      ctx.strokeStyle = `rgba(${VERDIGRIS},${(a * alpha).toFixed(3)})`;
      ctx.beginPath();
      let drawing = false;
      for (let k = Math.floor((b * n) / BINS); k <= Math.floor(((b + 1) * n) / BINS); k++) {
        const idx = reduce ? Math.min(n - 1, k) : (pen + 1 + k) % n;   /* oldest → newest */
        const v = buf[idx];
        if (Number.isNaN(v) || (!reduce && k >= n)) { drawing = false; continue; }
        const X = x0 + idx * dx, Y = y - v * amp;
        if (!drawing || (!reduce && idx === 0)) { ctx.moveTo(X, Y); drawing = true; } else ctx.lineTo(X, Y);
      }
      ctx.stroke();
    }
    if (!reduce && started >= 0 && !Number.isNaN(buf[pen])) {
      ctx.fillStyle = `rgba(${VERDIGRIS},${(0.9 * alpha).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(x0 + pen * dx, y - buf[pen] * amp, 1.6, 0, TAU); ctx.fill();
    }
  }
  let penAcc = 0;

  return {
    resize,
    startTrace() { if (started < 0) started = 0; },
    draw(dt, motion, clock, { reduce, uiTime, exiting, exitAlpha }) {
      dtLast = dt;
      ctx.clearRect(0, 0, W, H);
      if (!L) return;
      reveal = reduce ? 1 : Math.min(1, uiTime / 0.4);
      reveal = 1 - Math.pow(1 - reveal, 3);                         /* ease-out stroke reveal */
      if (exiting) exitP = Math.min(1, exitP + dt / 0.75);
      const alpha = exitAlpha;
      arcs(motion, motion.prox, alpha);
      trace(clock, motion, reduce, alpha);
    },
    dispose() { ctx.clearRect(0, 0, W, H); buf = null; },
  };
}
