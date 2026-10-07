/* ================================================================
   loader-scene.js — the specimen: a real anatomical heart model,
   lit like an anatomy-film plate and observed by an orbiting camera.

   Model: "Human heart for Cycles" by elZancudo, CC-BY 3.0
   (see loader/assets/CREDITS.md). Desktop and mobile LODs, Meshopt.

   Exports createScene(), which resolves once the model is ready. The
   orchestrator (loader-ui.js) owns the single rAF loop and calls
   frame() every tick.
   ================================================================ */
import * as THREE from './vendor/three.module.min.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { MeshoptDecoder } from './vendor/meshopt_decoder.module.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

const ASSETS = new URL('./assets/', import.meta.url);
const INK = 0x070b17;                      /* site navy */
const VERDIGRIS = new THREE.Color(0x2fc9bb);   /* conduction wave in the site's teal */
const ROSE = new THREE.Color(0xc8706a);

/* per-part tissue character. thin = how much light scatters through
   (atria and vessel walls are thin, ventricles dense) */
const PARTS = {
  Ventriculos:      { tex: 'ventricles', rough: 0.55, thin: 0.32, beat: 'v', tint: 1.0 },
  Ventriculos_Cava: { tex: 'ventricles', rough: 0.48, thin: 0.75, beat: 'p', tint: 0.95 },
  /* these three meshes' UVs do not match their source textures, so they use solid tissue colours */
  Aorta:            { col: [0.46, 0.1, 0.09],   rough: 0.46, thin: 0.85, beat: 'p' },
  Arteritas:        { col: [0.36, 0.05, 0.045], rough: 0.38, thin: 0.55, beat: 'v', coat: 0.32 },
  Venitas:          { col: [0.16, 0.085, 0.09], rough: 0.4,  thin: 0.55, beat: 'v', coat: 0.3 },
  Auricula_der:     { tex: 'ra',         rough: 0.58, thin: 1.0,  beat: 'a', tint: 1.0 },
  Auricula_izq:     { tex: 'la',         rough: 0.58, thin: 1.0,  beat: 'a', tint: 1.0 },
};

/* electrode sites, chosen from the mesh (model units, y up, +z anterior).
   Labels are anatomical abbreviations only. */
const SITES = [
  { id: 'RA',   mesh: 'Auricula_izq', pick: (p) => (p.y > 2.5 && p.y < 4.2 ? p.z : -1e9), side: -1,
    name: 'Right atrium', note: 'Receives blood returning from the body. The sinoatrial node here starts every heartbeat.' },
  { id: 'RV',   mesh: 'Ventriculos',  pick: (p) => (p.x > -2.2 && p.x < -0.6 && p.y > -1.2 && p.y < 0.6 ? p.z : -1e9), side: -1,
    name: 'Right ventricle', note: 'Pumps blood to the lungs through the pulmonary artery to pick up oxygen.' },
  { id: 'LV',   mesh: 'Ventriculos',  pick: (p) => (p.y > -2.6 && p.y < -0.4 ? p.x * 0.55 + p.z * 0.85 : -1e9), side: 1,     /* anterolateral LV wall */
    name: 'Left ventricle', note: 'The thickest-walled chamber. It pumps oxygen-rich blood out through the aorta to the whole body.' },
  { id: 'APEX', mesh: 'Ventriculos',  pick: (p) => -p.y * 0.8 + p.z * 0.45 + p.x * 0.2, side: 1,                       /* anterior face of the apex */
    name: 'Apex', note: 'The tip of the heart, formed by the left ventricle. Its beat can be felt on the chest wall.' },
];

function ease(x) { x = Math.min(1, Math.max(0, x)); return x * x * x * (x * (x * 6 - 15) + 10); }   /* smootherstep: slow start, slow end */

export async function createScene({ canvas, labelsEl, tier, reduce, small }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier !== 'low', alpha: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = small ? 1.36 : 1.22;   /* the mobile LOD reads a touch darker */
  renderer.setClearColor(0x000000, 0);
  const DPR_CAP = tier === 'high' ? 1.75 : 1.5;
  let dprScale = 1;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(INK, 6, 10.5);           /* far side of the heart falls off into haze */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);

  /* lights: warm key (~3800K) upper-left front, neutral rim (~5200K) behind-right, faint warm fill from below */
  /* key: soft warm-white; rim: cool teal-white to lift the silhouette off the navy; fill: faint EMBS purple */
  const key = new THREE.DirectionalLight(0xfff0e6, 0);
  const rim = new THREE.DirectionalLight(0xbfeef0, 0);
  const fill = new THREE.DirectionalLight(0x9a6be0, 0);
  const KEY = 2.9, RIM = 3.2, FILL = 0.5;
  scene.add(key, rim, fill, key.target, rim.target, fill.target);

  /* ── model ── */
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(new URL(small ? 'heart-m.glb' : 'heart-d.glb', ASSETS).href);
  const texLoader = new THREE.TextureLoader();
  const texCache = {};
  const tex = (name, srgb) => texCache[name] || (texCache[name] = texLoader.loadAsync(new URL(name + '.webp', ASSETS).href).then((t) => {
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.flipY = false; t.anisotropy = tier === 'high' ? 4 : 1;
    return t;
  }));

  const root = gltf.scene;
  const pivot = new THREE.Group();          /* rotation pivot: centre of the ventricles */
  pivot.add(root); scene.add(pivot);
  root.updateMatrixWorld(true);
  const all = new THREE.Box3().setFromObject(root);
  let vBox = new THREE.Box3();
  root.traverse((o) => { if (o.isMesh && o.material.name === 'Ventriculos') vBox.expandByObject(o); });
  if (vBox.isEmpty()) vBox = all.clone();
  const S = 2 / (all.max.y - all.min.y);    /* whole heart incl. great vessels = 2 units tall */
  const vC = vBox.getCenter(new THREE.Vector3());
  root.scale.setScalar(S);
  root.position.copy(vC).multiplyScalar(-S);
  root.updateMatrixWorld(true);
  const frameC = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());   /* what the camera frames */

  /* shared uniforms */
  const U = {
    uWave: { value: -1 }, uWaveI: { value: 0 }, uWaveColor: { value: VERDIGRIS.clone().multiplyScalar(0.9) },
    uRose: { value: ROSE.clone() }, uSSS: { value: 0.32 }, uKeyDir: { value: new THREE.Vector3(0, 0, 1) },
  };

  /* positions are quantized per mesh (Meshopt): convert to the original
     model's units (y up, +z anterior) before choosing anatomical sites */
  const tmp = new THREE.Vector3();
  const meshes = [];
  root.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const rootInv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  meshes.forEach((m) => {
    m.userData.toModel = new THREE.Matrix4().multiplyMatrices(rootInv, m.matrixWorld);
    m.userData.unit = new THREE.Vector3().setFromMatrixScale(m.userData.toModel).x;   /* model units per local unit */
  });
  const modelPos = (m, i, out) => out.fromBufferAttribute(m.geometry.attributes.position, i).applyMatrix4(m.userData.toModel);

  /* SA node: front of the right atrium where the superior vena cava joins it */
  let sa = null, best = -1e9;
  meshes.forEach((m) => {
    if (m.material.name !== 'Auricula_izq') return;
    const n = m.geometry.attributes.position.count;
    for (let i = 0; i < n; i += 3) {
      modelPos(m, i, tmp);
      if (tmp.y > 5.2 && tmp.y < 6.6 && tmp.z > best) { best = tmp.z; sa = { m, i }; }
    }
  });
  sa = sa ? sa.m.localToWorld(new THREE.Vector3().fromBufferAttribute(sa.m.geometry.attributes.position, sa.i)) : new THREE.Vector3(-0.5, 0.6, 0.2);

  /* per-vertex normalised distance from the SA node → drives the conduction wave */
  let maxD = 0;
  const dists = meshes.map((m) => {
    const pos = m.geometry.attributes.position, d = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) { m.localToWorld(tmp.fromBufferAttribute(pos, i)); d[i] = tmp.distanceTo(sa); if (d[i] > maxD) maxD = d[i]; }
    return d;
  });
  meshes.forEach((m, k) => { const d = dists[k]; for (let i = 0; i < d.length; i++) d[i] /= maxD; m.geometry.setAttribute('aDist', new THREE.BufferAttribute(d, 1)); });

  /* electrode anchors (local to their mesh) + normals for occlusion fading */
  const sites = (small ? SITES.filter((s) => s.id !== 'RV') : SITES).map((s) => {
    let bestV = -1e9, bi = -1, mesh = null;
    meshes.forEach((m) => {
      if (m.material.name !== s.mesh) return;
      const n = m.geometry.attributes.position.count;
      for (let i = 0; i < n; i += 2) { modelPos(m, i, tmp); const v = s.pick(tmp); if (v > bestV) { bestV = v; bi = i; mesh = m; } }
    });
    if (!mesh) return null;
    const p = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, bi);
    const n = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.normal, bi).normalize();
    const el = document.createElement('div');
    el.className = 'ld-site ld-site--' + (s.side < 0 ? 'l' : 'r');
    el.innerHTML = '<i></i><b></b><span>' + s.id + '</span><div class="ld-pop"><strong><em>' + s.id + '</em>' + s.name + '</strong><p>' + s.note + '</p></div>';
    labelsEl.appendChild(el);
    return { id: s.id, mesh, p, n, el, shown: 0, at: 0 };
  }).filter(Boolean);

  /* ── materials: tissue, not glass ── */
  const beatU = { v: { value: 0 }, a: { value: 0 }, p: { value: 0 } };
  const mats = [], texJobs = [];
  for (const m of meshes) {
    const P = PARTS[m.material.name] || PARTS.Ventriculos;
    const mat = new THREE.MeshPhysicalMaterial({
      color: P.col ? new THREE.Color().setRGB(P.col[0], P.col[1], P.col[2], THREE.SRGBColorSpace) : new THREE.Color(P.tint * 0.92, P.tint * 0.74, P.tint * 0.72), roughness: P.rough, metalness: 0,
      clearcoat: P.coat || 0.2, clearcoatRoughness: 0.5,             /* wet, soft, broken highlights */
      sheen: 0.35, sheenRoughness: 0.7, sheenColor: new THREE.Color(0x6a2c26),
      envMapIntensity: 0.32,
    });
    mat.name = m.material.name;
    const thin = { value: P.thin }, beat = beatU[P.beat], bk = { value: 1 / (m.userData.unit || 1) };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U, { uThin: thin, uBeat: beat, uBK: bk });
      /* uBeat is in model units; uBK converts it to this mesh's quantized local units */
      sh.vertexShader = 'attribute float aDist;\nvarying float vDist;\nuniform float uBeat, uBK;\n' + sh.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n  transformed += normalize(objectNormal) * uBeat * uBK;\n  vDist = aDist;');
      sh.fragmentShader = 'varying float vDist;\nuniform float uWave, uWaveI, uSSS, uThin;\nuniform vec3 uWaveColor, uRose, uKeyDir;\n' + sh.fragmentShader
        .replace('#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\n  float wv = exp(-pow((vDist - uWave) / 0.075, 2.0));\n  totalEmissiveRadiance += uWaveColor * uWaveI * wv;')
        .replace('#include <opaque_fragment>',
          /* fake subsurface: soft wrap at the terminator + thin-edge back-scatter, tinted rose */
          '  vec3 Vd = normalize(vViewPosition);\n' +
          '  float nl = dot(normal, uKeyDir);\n' +
          '  float wrapT = clamp((nl + 0.45) / 1.45, 0.0, 1.0) - clamp(nl, 0.0, 1.0);\n' +
          '  float edge = pow(1.0 - clamp(dot(normal, Vd), 0.0, 1.0), 2.2);\n' +
          '  outgoingLight += uRose * uSSS * diffuseColor.rgb * (wrapT * 0.9 + edge * 0.55 * uThin) * (0.35 + uThin);\n' +
          '#include <opaque_fragment>');
    };
    if (P.tex) texJobs.push(Promise.all([tex(P.tex + (small ? '-m' : '-d'), true), tier === 'low' ? null : tex(P.tex + '-n', false)]).then(([map, nmap]) => {
      mat.map = map; if (nmap) { mat.normalMap = nmap; mat.normalScale.set(0.55, 0.55); }
      mat.needsUpdate = true;
    }).catch(() => {}));
    m.material.dispose?.();
    m.material = mat; mats.push(mat);
  }

  /* sparse motes in the haze — dust in a lit room, not stars */
  let motes = null;
  const MOTES = reduce ? 0 : tier === 'high' ? 90 : small ? 24 : 50;
  if (MOTES) {
    const g = new THREE.BufferGeometry(), arr = new Float32Array(MOTES * 3), sp = new Float32Array(MOTES);
    for (let i = 0; i < MOTES; i++) { arr[i * 3] = (Math.random() - 0.5) * 6; arr[i * 3 + 1] = (Math.random() - 0.5) * 3.6; arr[i * 3 + 2] = (Math.random() - 0.5) * 4 - 0.5; sp[i] = 0.015 + Math.random() * 0.03; }
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const cx = c.getContext('2d'), gr = cx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(236,229,216,1)'); gr.addColorStop(1, 'rgba(236,229,216,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 32, 32);
    const sprite = new THREE.CanvasTexture(c);
    motes = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.022, map: sprite, transparent: true, opacity: 0.32, depthWrite: false, color: 0xece5d8 }));
    motes.userData.speed = sp;
    scene.add(motes);
  }

  /* ── layout / camera ── */
  let L = null, W = 1, H = 1, D = 7;
  function resize(layout, dpr) {
    L = layout; W = layout.W; H = layout.H;
    renderer.setPixelRatio(Math.min(dpr, DPR_CAP) * dprScale);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.setViewOffset(W, H, W / 2 - L.cx, H / 2 - L.cy, W, H);   /* place the heart where the composition wants it */
    D = 2 / ((L.heartH / H) * 2 * Math.tan((camera.fov * Math.PI) / 360));
    camera.updateProjectionMatrix();
  }

  /* ── state ── */
  let revealAt = -1, exitAt = -1, time = 0, rd = !!reduce;
  const ptr = { x: 0, y: 0, on: false };
  let frameAcc = 0, frameN = 0;
  const camPos = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), keyBase = new THREE.Vector3(), q = new THREE.Vector3(), nW = new THREE.Vector3(), toCam = new THREE.Vector3();
  const sph = (az, el, r, out) => out.set(Math.sin(az) * Math.cos(el) * r, Math.sin(el) * r, Math.cos(az) * Math.cos(el) * r);

  function frame(dt, motion, clock) {
    time += dt;
    /* adaptive quality: if frames average >22 ms over 2 s, step down DPR, then motes */
    frameAcc += dt; frameN++;
    if (frameAcc > 2) {
      if (frameAcc / frameN > 0.022) {
        if (dprScale > 0.6) { dprScale *= 0.8; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP) * dprScale); renderer.setSize(W, H, false); }
        else if (motes && motes.visible) motes.visible = false;
      }
      frameAcc = 0; frameN = 0;
    }

    /* light reveal: the heart is always there — light finds it */
    const tr = revealAt < 0 ? 0 : time - revealAt;
    const keyR = rd ? ease(tr / 0.6) : ease(tr / 1.1), rimR = rd ? keyR : ease((tr - 0.2) / 1.1);
    const exitP = exitAt < 0 ? 0 : ease((time - exitAt) / 0.9);
    const living = rd ? 1 : 1 + 0.035 * Math.sin((2 * Math.PI * time) / 11);
    const vEnv = rd ? 0 : clock.ventricular(), aEnv = rd ? 0 : clock.atrial();
    const prox = motion.prox;
    key.intensity = KEY * keyR * living * (1 + 0.04 * prox) * (1 - exitP);
    rim.intensity = RIM * rimR * (1 - exitP * 0.85);
    fill.intensity = FILL * keyR * (1 - exitP);
    mats.forEach((m) => { m.envMapIntensity = 0.32 * keyR * (1 - exitP); });

    /* key light direction: upper-left front, leaning a few degrees toward the cursor */
    sph(-0.62 + motion.light, 0.58, 6, keyBase); key.position.copy(keyBase); key.target.position.set(0, 0, 0);
    sph(2.45, 0.32, 6, q); rim.position.copy(q);
    sph(0.15, -0.55, 6, q); fill.position.copy(q);

    /* heartbeat (lub-dub), atria earlier and smaller; breath ~5 s */
    beatU.v.value = -0.1 * vEnv;
    beatU.a.value = 0.06 * aEnv - 0.02 * vEnv;
    beatU.p.value = 0.025 * vEnv;
    const breath = rd ? 0 : Math.sin((2 * Math.PI * time) / 5 + 0.7);
    pivot.scale.setScalar(1 + 0.005 * breath);
    pivot.position.y = 0.006 * breath;
    pivot.rotation.set(motion.hx, motion.hy, 0);

    /* conduction wave: SA node → AV pause → apex, every beat */
    if (!rd && clock.running) {
      const c = clock.conduction();
      U.uWave.value = c.front;
      U.uWaveI.value = 0.42 * c.intensity * (1 + 0.15 * prox) * keyR * (1 + exitP * 0.6);
    } else { U.uWaveI.value = 0; }
    U.uSSS.value = 0.32 * (1 + 0.12 * vEnv);

    /* camera orbits the heart; dolly toward it with pointer proximity and on exit */
    const dist = D * (1 - motion.dolly - 0.06 * exitP);
    sph(motion.az, 0.07 + motion.el, dist, camPos);
    camera.position.copy(camPos).add(frameC);
    up.set(Math.sin(motion.roll), Math.cos(motion.roll), 0);
    camera.up.copy(up);
    camera.lookAt(frameC);
    camera.updateMatrixWorld();
    U.uKeyDir.value.copy(keyBase).normalize().transformDirection(camera.matrixWorldInverse);

    if (motes && motes.visible) {
      const a = motes.geometry.attributes.position, sp = motes.userData.speed;
      for (let i = 0; i < a.count; i++) { let y = a.getY(i) + sp[i] * dt; if (y > 1.8) y = -1.8; a.setY(i, y); }
      a.needsUpdate = true;
    }

    renderer.render(scene, camera);

    /* electrode labels: track their anchors, fade when turned away */
    pivot.updateMatrixWorld();
    for (const s of sites) {
      const target = revealAt >= 0 && tr > s.at ? 1 : 0;
      s.shown += (target - s.shown) * Math.min(1, dt * 4);
      q.copy(s.p); s.mesh.localToWorld(q);
      nW.copy(s.n).transformDirection(s.mesh.matrixWorld);
      toCam.copy(camera.position).sub(q).normalize();
      const facing = Math.max(0, Math.min(1, (nW.dot(toCam) - 0.08) / 0.3));
      q.project(camera);
      const x = (q.x * 0.5 + 0.5) * W, y = (-q.y * 0.5 + 0.5) * H;
      const op = s.shown * facing * (1 - exitP);
      s.el.style.opacity = op.toFixed(3);
      s.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
      s.x = x; s.y = y; s.vis = op;
    }

    /* pop-up cards: the electrode nearest the cursor opens; otherwise they
       take turns (one every ~4.2 s, open for ~3.2 s) once all are placed */
    let pick = -1;
    if (ptr.on) {
      let bd = 90;
      sites.forEach((s, i) => { const d = Math.hypot(ptr.x - s.x, ptr.y - s.y); if (s.vis > 0.5 && d < bd) { bd = d; pick = i; } });
    }
    if (pick < 0 && revealAt >= 0 && tr > 2.6 && exitP === 0) {
      const order = sites.map((s, i) => i).filter((i) => sites[i].vis > 0.6);
      const slot = Math.floor((tr - 2.6) / 4.2), phase = (tr - 2.6) % 4.2;
      if (order.length && phase < 3.2) pick = order[slot % order.length];
    }
    sites.forEach((s, i) => { const on = i === pick; if (on !== !!s.popped) { s.popped = on; s.el.classList.toggle('is-pop', on); } });
    /* keep the open card inside the viewport */
    const open = sites[pick];
    if (open) {
      const card = open.card || (open.card = open.el.querySelector('.ld-pop'));
      const r = card.getBoundingClientRect(), cur = open.dx || 0;
      let dx = cur;
      if (r.left - cur < 12) dx = 12 - (r.left - cur);
      else if (r.right - cur > W - 12) dx = W - 12 - (r.right - cur);
      else dx = 0;
      let dy = 0;
      if (r.top < 12) dy = 12 - r.top + (open.dy || 0);
      if (Math.abs(dx - cur) > 0.5 || dy !== (open.dy || 0)) { open.dx = dx; open.dy = dy; card.style.translate = dx.toFixed(0) + 'px ' + dy.toFixed(0) + 'px'; }
    }
  }

  return {
    resize,
    frame,
    /* textures in + shaders compiled off the main thread where supported,
       so revealing the heart does not freeze the page */
    async prepare() {
      await Promise.all(texJobs);
      try { if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera); } catch (e) {}
    },
    reveal() { if (revealAt < 0) { revealAt = time; sites.forEach((s, i) => { s.at = 1.2 + i * 0.13; }); } },
    exit() { if (exitAt < 0) exitAt = time; },
    setReduce(v) { rd = !!v; if (motes) motes.visible = !rd; },
    setPointer(x, y, on) { ptr.x = x; ptr.y = y; ptr.on = !!on; },
    get revealed() { return revealAt >= 0; },
    /* diagnostics for local testing */
    /* local tooling: render the rest pose and return the frame (used to make the fallback still) */
    snapshot() { renderer.render(scene, camera); return canvas.toDataURL('image/png'); },
    get debug() { return { mats: mats.map((m) => m.name + ':' + (m.map ? 'map' : '-') + (m.normalMap ? '+n' : '')), materials: mats, renderer, camera }; },
    dispose() {
      sites.forEach((s) => s.el.remove());
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) [].concat(o.material).forEach((m) => { ['map', 'normalMap'].forEach((k) => m[k] && m[k].dispose()); m.dispose(); });
      });
      Object.values(texCache).forEach((p) => p.then((t) => t.dispose()).catch(() => {}));
      envRT.dispose(); pmrem.dispose();
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
