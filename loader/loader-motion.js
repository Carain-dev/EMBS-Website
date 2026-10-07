/* ================================================================
   loader-motion.js — springs, the beat clock, and camera input.
   Everything that moves in the loader reads its values from here.
   ================================================================ */

const DEG = Math.PI / 180;

/* Damped spring (unit mass). Integrated in fixed 1/240 s substeps so it
   behaves identically at 60, 90 or 120 Hz. `stiffness` sets speed,
   `ratio` the damping (1 = no overshoot, <1 = a little). */
export class Spring {
  constructor(stiffness, ratio, value = 0) {
    this.k = stiffness;
    this.c = 2 * ratio * Math.sqrt(stiffness);
    this.x = value; this.v = 0; this.target = value;
  }
  step(dt, maxVel = Infinity) {
    let t = dt;
    while (t > 1e-6) {
      const h = Math.min(t, 1 / 240);
      this.v += (-this.k * (this.x - this.target) - this.c * this.v) * h;
      if (this.v > maxVel) this.v = maxVel; else if (this.v < -maxVel) this.v = -maxVel;
      this.x += this.v * h;
      t -= h;
    }
    return this.x;
  }
  snap(v) { this.x = this.target = v; this.v = 0; }
}

/* ── Beat clock: resting ~62 bpm with ±3% beat-to-beat variability.
   Times below are seconds from the start of each beat. ─────────── */
const g = (t, c, w) => { const d = (t - c) / w; return Math.exp(-d * d); };

export class BeatClock {
  constructor() {
    this.base = 60 / 62;
    this.period = this.base; this.amp = 1;
    this.t = 0; this.index = 0; this.running = false;
    this.listeners = [];
    this.beats = [];                 /* recent beats, for the trace */
  }
  start() { if (this.running) return; this.running = true; this.t = 0; this._emit(); }
  onBeat(fn) { this.listeners.push(fn); }
  step(dt) {
    if (!this.running) return;
    this.t += dt;
    while (this.t >= this.period) { this.t -= this.period; this._next(); }
  }
  _next() {
    this.index++;
    this.period = this.base * (1 + (Math.random() - 0.5) * 0.06);
    this.amp = 1 + (Math.random() - 0.5) * 0.06;
    this._emit();
  }
  _emit() { this.listeners.forEach((fn) => fn(this.index)); }
  timeToBeatEnd() { return this.running ? this.period - this.t : 0; }

  /* atrial contraction (small, early) */
  atrial(t = this.t) { return g(t, 0.07, 0.045); }
  /* ventricular "lub" then a smaller relaxation "dub" */
  ventricular(t = this.t) { return this.amp * (g(t, 0.22, 0.075) + 0.32 * g(t, 0.44, 0.06)); }
  /* surface ECG-style complex for the trace (P, QRS, T) */
  ecg(t = this.t, amp = this.amp) {
    return amp * (0.11 * g(t, 0.06, 0.024) - 0.11 * g(t, 0.145, 0.008) + g(t, 0.162, 0.011) - 0.24 * g(t, 0.18, 0.01) + 0.27 * g(t, 0.4, 0.045));
  }
  /* conduction front over the heart, 0 = SA node … 1 = apex, and its intensity:
     atria first, a short AV-node pause, then the ventricles */
  conduction(t = this.t) {
    let front;
    if (t < 0.09) front = (t / 0.09) * 0.36;
    else if (t < 0.15) front = 0.36;                              /* AV-node delay */
    else if (t < 0.3) front = 0.36 + ((t - 0.15) / 0.15) * 0.66;
    else front = 1.02;
    const intensity = t < 0.3 ? 1 : Math.max(0, 1 - (t - 0.3) / 0.25);
    return { front, intensity };
  }
}

/* ── Camera / heart / light targets from pointer, touch and idle drift ── */
export function createMotion({ reduce, touch }) {
  /* Different stiffness on azimuth and elevation makes a diagonal move
     trace a curve — that curve is the "swirl". Values tuned by eye. */
  const S = {
    az: new Spring(38, 0.9),          /* camera azimuth */
    el: new Spring(26, 0.85),         /* camera elevation */
    roll: new Spring(12, 0.9),        /* velocity-coupled roll, slower */
    hy: new Spring(14, 0.9),          /* heart counter-rotation (lags the camera) */
    hx: new Spring(12, 0.9),
    light: new Spring(8, 0.95),       /* key light follows last, like an examiner's lamp */
    dolly: new Spring(18, 1),
    prox: new Spring(10, 1),
    poolX: new Spring(10, 1), poolY: new Spring(10, 1),
  };
  const state = { reduce: !!reduce, nx: 0, ny: 0, lastMove: -1e9, dragging: false, dragX: 0, dragY: 0, disturb: 0, time: 0, heartX: 0, heartY: 0, minSide: 1 };
  const AMP = touch ? { az: 7, el: 3 } : { az: 4, el: 2 };

  function pointer(nx, ny, speed) {
    state.nx = nx; state.ny = ny; state.lastMove = state.time;
    state.disturb = Math.min(1, state.disturb + Math.min(0.35, speed * 0.002));
  }
  function drag(dx, dy) {              /* touch drag, in viewport fractions */
    state.dragging = true;
    state.dragX = Math.max(-1, Math.min(1, state.dragX + dx * 2.2));
    state.dragY = Math.max(-1, Math.min(1, state.dragY + dy * 2.2));
    state.lastMove = state.time;
  }
  function release() { state.dragging = false; }

  function update(dt, px, py) {
    state.time += dt;
    const t = state.time;
    let tx = 0, ty = 0;
    if (!state.reduce) {
      /* idle Lissajous drift (19 s / 23 s, never visibly loops) + sub-pixel handheld wobble */
      const idleAz = AMP.az * Math.sin((2 * Math.PI * t) / 19) + 0.08 * Math.sin(t * 1.7) + 0.05 * Math.sin(t * 2.9);
      const idleEl = AMP.el * Math.sin((2 * Math.PI * t) / 23 + 1.3) + 0.06 * Math.sin(t * 2.3);
      const recent = t - state.lastMove < 2.5;
      let inAz = 0, inEl = 0;
      if (state.dragging || (touch && recent)) { inAz = state.dragX; inEl = state.dragY; }
      else if (!touch && recent) { inAz = state.nx; inEl = state.ny; }
      if (!state.dragging && !recent) { state.dragX *= Math.pow(0.2, dt); state.dragY *= Math.pow(0.2, dt); }
      const active = recent || state.dragging;
      tx = active ? inAz : 0; ty = active ? inEl : 0;
      S.az.target = (active ? tx * 18 : idleAz) * DEG;
      S.el.target = (active ? -ty * 9 : idleEl) * DEG;
      S.hy.target = -tx * 7 * DEG;
      S.hx.target = ty * 4 * DEG;
      S.light.target = tx * 5 * DEG;
      S.poolX.target = tx * 0.02; S.poolY.target = ty * 0.02;
      /* proximity of the pointer to the heart's projected centre */
      let prox = 0;
      if (!touch && recent && px != null) {
        const d = Math.hypot(px - state.heartX, py - state.heartY) / (0.35 * state.minSide);
        prox = Math.max(0, 1 - d);
      }
      S.prox.target = prox;
      S.dolly.target = 0.03 * prox;
      S.roll.target = Math.max(-1.5 * DEG, Math.min(1.5 * DEG, -S.az.v * 0.12));
    } else {
      for (const k in S) S[k].target = 0;
    }
    const maxAng = 40 * DEG;              /* clamp angular velocity: never fast */
    S.az.step(dt, maxAng); S.el.step(dt, maxAng); S.roll.step(dt);
    S.hy.step(dt, maxAng); S.hx.step(dt, maxAng); S.light.step(dt);
    S.dolly.step(dt); S.prox.step(dt); S.poolX.step(dt); S.poolY.step(dt);
    state.disturb *= Math.pow(0.0015, dt);   /* motion artefact settles in ~600 ms */
  }

  function setReduce(v) { state.reduce = !!v; if (v) for (const k in S) S[k].snap(0); }
  function setHeart(x, y, minSide) { state.heartX = x; state.heartY = y; state.minSide = minSide; }

  return {
    S, state, update, pointer, drag, release, setReduce, setHeart,
    get az() { return S.az.x; }, get el() { return S.el.x; }, get roll() { return S.roll.x; },
    get hy() { return S.hy.x; }, get hx() { return S.hx.x; }, get light() { return S.light.x; },
    get dolly() { return S.dolly.x; }, get prox() { return S.prox.x; },
  };
}
