import { b64, safeJson } from '../emit-util.js';
import { aquaPatchScript } from './aqua-glsl.js';

// In-page script: shallow water you can touch (materials/shallows.js builds the bodies). Each body's surface is a
// heightfield h over its grid, stepped with the linear shallow-water wave equation
//     ∂v/∂t = c²·∇²h − damping·v,   ∂h/∂t = v,   c² = g·D·speed²
// (D the still depth there), so waves slow and bunch in the shallows; a pool's walls reflect (a dry neighbour mirrors
// the cell), a pond's bank shoals and drinks them (extra damping where D is small). Fixed substeps (1/60 s) off the
// channel clock, so a capture's stepped frames are reproducible.
//
// Everything that touches the water goes through one bus, `window.__aqWater`:
//   query(x, y)               → { body, level, depth, h, sx, sy } | null    (h: the live surface over the still level)
//   disturb(x, y, r, amt, f)  push the surface down by a gaussian of radius r (amt in m/s; f adds foam)
//   setLevel(id, z)           move a body's still level (a basin filling or draining): cells wet and dry with it
//   bedAt(x, y)               the bed's z under (x, y), wet or dry | null
// and the channel drives the standard responses itself each frame: the walk camera and controllable bodies wade
// (slowed by how deep they stand, a wake behind them, a splash on entry, floating once the water is over their
// chest), floaters bob on the live surface and drift down its slope, and rain rings it.
export function shallowsChannelScript({ bodies, floaters = [], rain = 0, toLight = [0.4, 0.3, 0.8], walk = false, ctrl = true, metersPerUnit = 1 }) {
  const pack = bodies.map((b) => ({
    id: b.id, kind: b.kind, level: b.level, color: b.color, look: b.look, sim: b.sim,
    grid: { nx: b.grid.nx, ny: b.grid.ny, x0: b.grid.x0, y0: b.grid.y0, dx: b.grid.dx, dy: b.grid.dy, depth: b64(new Float32Array(b.grid.depth)) },
  }));
  return `${aquaPatchScript()}
// --- shallows (pools and ponds you can touch: a simulated surface + the __aqWater bus) ---
let stepShallows = () => {};
{
  let __shWalkBase = null;
  const SH = ${safeJson(pack)}, FLOAT = ${safeJson(floaters)}, RAIN = ${+rain || 0};
  // L = world units per metre: the tuning below is in metres (radii, depths, speeds) and scales to the scene's unit
  const L = ${+(1 / (metersPerUnit > 0 ? metersPerUnit : 1)).toFixed(6)}, G = 9.8 * L, DT = 1 / 60, hex = (c) => new THREE.Color(c), SUN = ${safeJson(toLight.map((x) => +(+x).toFixed(6)))};
  // the water and the floaters are lit (the baked faces aren't): one sun along the scene's light, a sky fill — only
  // when no other channel has lit the scene already (walkers, cars, surfaces bring their own)
  if (!scene.children.some((o) => o.isLight)) { const sun = new THREE.DirectionalLight(0xfff4e0, 2.0); sun.position.set(SUN[0] * 100, SUN[1] * 100, SUN[2] * 100); scene.add(sun);
    const hemi = new THREE.HemisphereLight(0xcfe3f2, 0x5a6a48, 0.9); hemi.position.set(0, 0, 1); scene.add(hemi); }
  const B = SH.map((b) => {
    const { nx, ny, x0, y0, dx, dy } = b.grid, N = nx * ny, D = decodeF32(b.grid.depth);
    const wet = new Uint8Array(N), c2 = new Float32Array(N), sink = new Float32Array(N);
    const k2 = b.sim.speed * b.sim.speed * G / (dx * dy);
    for (let i = 0; i < N; i++) if (D[i] > 0) { wet[i] = 1; c2[i] = k2 * Math.max(D[i], 0.04 * L); sink[i] = b.sim.wall ? 0 : 0.6 / (D[i] / L + 0.12); }
    let c2max = 0; for (let i = 0; i < N; i++) c2max = Math.max(c2max, c2[i]);
    const h = new Float32Array(N), v = new Float32Array(N), foam = new Float32Array(N);
    // the sheet: one vertex per cell, a triangle pair wherever a corner is wet (a pond's waterline is where the
    // sheet dips under its bank)
    const pos = new Float32Array(N * 3), nor = new Float32Array(N * 3), col = new Float32Array(N * 3), fa = new Float32Array(N), ca = new Float32Array(N), idx = [];
    const c = hex(b.color);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const q = j * nx + i, o = 3 * q;
      pos[o] = x0 + i * dx; pos[o + 1] = y0 + j * dy; pos[o + 2] = b.level; nor[o + 2] = 1;
      col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b;
    }
    const tris = () => { idx.length = 0; for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const q = j * nx + i; if (wet[q] | wet[q + 1] | wet[q + nx] | wet[q + nx + 1]) idx.push(q, q + 1, q + nx, q + 1, q + nx + 1, q + nx); } };
    tris();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aAqFoam', new THREE.BufferAttribute(fa, 1));
    geo.setAttribute('aAqCaus', new THREE.BufferAttribute(ca, 1));
    geo.setIndex(idx);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide, transparent: true, depthWrite: false });
    const U = __aqPatch(mat, b.look, { sun: ${safeJson(toLight.map((x) => +(+x).toFixed(6)))}, foamCol: [0.93, 0.96, 0.97], refract: 0.07, caustic: true });
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 1; m.raycast = () => {};            // not footing: walkers and bodies stand on the bed, not the skin
    __aqShared.meshes.push(m); scene.add(m);
    let wetN = 0; for (let i = 0; i < N; i++) wetN += wet[i];
    // explicit wave step: stable while c·dt < dx/√2; a small body (a basin's cm cells) takes substeps
    return { ...b, area: wetN * dx * dy, nx, ny, x0, y0, dx, dy, N, D, wet, c2, sink, h, v, foam, pos, nor, fa, ca, geo, U, k2, tris, idx, mesh: m, sub: Math.max(1, Math.ceil(DT * Math.sqrt(c2max) / 0.5)) };
  });
  function setLevel(id, z) {
    const b = B.find((o) => o.id === id); if (!b || !Number.isFinite(z)) return;
    const dz = z - b.level; if (Math.abs(dz) < 1e-9) return;
    b.level = z; let flip = false, c2max = 0, wetN = 0;
    for (let q = 0; q < b.N; q++) {
      b.D[q] += dz; const w = b.D[q] > 0 ? 1 : 0;
      if (w !== b.wet[q]) { flip = true; b.wet[q] = w; b.h[q] = 0; b.v[q] = 0; }
      b.c2[q] = w ? b.k2 * Math.max(b.D[q], 0.04 * L) : 0; if (w && !b.sim.wall) b.sink[q] = 0.6 / (b.D[q] / L + 0.12);
      c2max = Math.max(c2max, b.c2[q]); wetN += w;
    }
    b.sub = Math.max(1, Math.ceil(DT * Math.sqrt(c2max) / 0.5)); b.area = wetN * b.dx * b.dy;
    if (flip) { b.tris(); b.geo.setIndex(b.idx); }
  }
  function bedAt(x, y) {
    for (const b of B) {
      const fi = (x - b.x0) / b.dx, fj = (y - b.y0) / b.dy; if (fi < 0 || fj < 0 || fi > b.nx - 1 || fj > b.ny - 1) continue;
      const i = Math.min(b.nx - 2, Math.floor(fi)), j = Math.min(b.ny - 2, Math.floor(fj)), u = fi - i, w = fj - j, q = j * b.nx + i;
      return b.level - ((b.D[q] * (1 - u) + b.D[q + 1] * u) * (1 - w) + (b.D[q + b.nx] * (1 - u) + b.D[q + b.nx + 1] * u) * w);
    }
    return null;
  }

  function step(b, dt) {
    const { nx, ny, wet, c2, sink, h, v, foam } = b, damp = b.sim.damp, ff = Math.exp(-dt / 1.4);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const q = j * nx + i; if (!wet[q]) continue;
      const hq = h[q];
      const l = i > 0 && wet[q - 1] ? h[q - 1] : hq, r = i < nx - 1 && wet[q + 1] ? h[q + 1] : hq;
      const d = j > 0 && wet[q - nx] ? h[q - nx] : hq, u = j < ny - 1 && wet[q + nx] ? h[q + nx] : hq;
      v[q] = (v[q] + dt * c2[q] * (l + r + d + u - 4 * hq)) * (1 - dt * (damp + sink[q]));
    }
    // the linear model knows no bed: a trough can't sink below it, a crest stands at most half the depth
    for (let q = 0; q < b.N; q++) if (wet[q]) { const hn = h[q] + dt * v[q], lo = -0.85 * b.D[q], hi = 0.5 * b.D[q] + b.sim.crest * L; h[q] = hn < lo ? lo : hn > hi ? hi : hn; if (hn !== h[q]) v[q] *= 0.5; foam[q] *= ff; }
  }
  function cellOf(b, x, y) {
    const fi = (x - b.x0) / b.dx, fj = (y - b.y0) / b.dy;
    if (fi < 0 || fj < 0 || fi > b.nx - 1 || fj > b.ny - 1) return null;
    return { fi, fj };
  }
  function query(x, y) {
    for (const b of B) {
      const c = cellOf(b, x, y); if (!c) continue;
      const i = Math.min(b.nx - 2, Math.floor(c.fi)), j = Math.min(b.ny - 2, Math.floor(c.fj)), u = c.fi - i, w = c.fj - j, q = j * b.nx + i;
      const bl = (A) => (A[q] * (1 - u) + A[q + 1] * u) * (1 - w) + (A[q + b.nx] * (1 - u) + A[q + b.nx + 1] * u) * w;
      const depth = bl(b.D); if (depth <= 0) continue;
      const h = bl(b.h);
      return { body: b.id, level: b.level, depth, h, sx: ((b.h[q + 1] - b.h[q]) + (b.h[q + b.nx + 1] - b.h[q + b.nx])) / (2 * b.dx), sy: ((b.h[q + b.nx] - b.h[q]) + (b.h[q + b.nx + 1] - b.h[q + 1])) / (2 * b.dy) };
    }
    return null;
  }
  function disturb(x, y, r, amt, f = 0) {
    for (const b of B) {
      const c = cellOf(b, x, y); if (!c) continue;
      const ri = Math.ceil(2 * r / b.dx), rj = Math.ceil(2 * r / b.dy), ci = Math.round(c.fi), cj = Math.round(c.fj);
      for (let j = Math.max(0, cj - rj); j <= Math.min(b.ny - 1, cj + rj); j++) for (let i = Math.max(0, ci - ri); i <= Math.min(b.nx - 1, ci + ri); i++) {
        const q = j * b.nx + i; if (!b.wet[q]) continue;
        const ex = b.x0 + i * b.dx - x, ey = b.y0 + j * b.dy - y, g = Math.exp(-(ex * ex + ey * ey) / (r * r));
        b.v[q] -= amt * g; if (f) b.foam[q] = Math.min(1.5, b.foam[q] + f * g);
      }
      return true;
    }
    return false;
  }

  // floaters: a buoyancy spring toward the live surface, tilted by its slope, sliding down it; they ring the water
  // as they bob, and a wader shoulders them aside
  const FL = FLOAT.map((f) => {
    const r = f.r || 0.25, grp = new THREE.Group();
    const mt = new THREE.MeshStandardMaterial({ color: f.color || '#f5c542', roughness: 0.55 });
    if (f.shape === 'duck') {
      const body = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), mt); body.scale.set(1.25, 0.9, 0.7); grp.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(r * 0.48, 14, 10), mt); head.position.set(r * 0.85, 0, r * 0.62); grp.add(head);
      const bill = new THREE.Mesh(new THREE.ConeGeometry(r * 0.16, r * 0.42, 10), new THREE.MeshStandardMaterial({ color: '#f07a1a', roughness: 0.5 }));
      bill.rotation.z = -Math.PI / 2; bill.position.set(r * 1.42, 0, r * 0.58); grp.add(bill);
    } else if (f.shape === 'leaf') {
      const lf = new THREE.Mesh(new THREE.CircleGeometry(r, 14), new THREE.MeshStandardMaterial({ color: f.color || '#7a9a38', roughness: 0.8, side: THREE.DoubleSide }));
      lf.scale.set(1, 0.55, 1); grp.add(lf);
    } else grp.add(new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mt));
    grp.rotation.z = f.yaw || 0; scene.add(grp);
    const s = { f, r, grp, x: f.at[0], y: f.at[1], z: 0, vx: 0, vy: 0, vz: 0, draft: f.shape === 'leaf' ? -0.004 * L : r * 0.35 };
    const q = query(s.x, s.y); s.z = q ? q.level - s.draft : 0;
    return s;
  });

  // rain: a seeded stream of drops (mulberry32), so a capture rains the same rings
  let seed = 0x5eed1004;
  const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let rainAcc = 0;

  // waders: the walk camera and every controllable body. A wader is { x, y, foot, eye, moved, vz }; the channel
  // remembers whether each stood in water last frame (the entry splash) and the speed it slows from.
  const wade = new Map();
  function wader(key, x, y, foot, eye, dt, vz) {
    const q = query(x, y), was = wade.get(key) || { x, y, sub: 0 };
    const sub = q ? Math.max(0, q.level + q.h - foot) : 0, mv = Math.hypot(x - was.x, y - was.y), spd = dt > 0 ? mv / dt : 0;
    if (q && sub > 0) {
      if (was.sub <= 0 && vz < -L) disturb(x, y, 0.7 * L, Math.min(1.5 * L, -vz * 0.4), 1.2);           // the entry splash
      const k = Math.min(1, sub / (0.35 * L));
      if (spd > 0.05 * L) {                                                                         // the wake:
        // a body moving through water heaps it ahead and leaves a hollow behind (a dipole along the motion — no net
        // water added, so nothing builds up under a wader who keeps walking); the trailing edge froths
        const ux = (x - was.x) / mv, uy = (y - was.y) / mv, a = Math.min(2.5 * L, spd) * 0.8 * k * dt * 10;
        disturb(x + ux * 0.25 * L, y + uy * 0.25 * L, 0.3 * L, -a); disturb(x - ux * 0.25 * L, y - uy * 0.25 * L, 0.3 * L, a, 0.3 * k * dt * 10);
      }
      for (const s of FL) {                                                                     // shoulder floaters aside
        const ex = s.x - x, ey = s.y - y, d = Math.hypot(ex, ey), reach = s.r + 0.45 * L;
        if (d < reach && d > 1e-3) { const p = (reach - d) / reach * (2 * L + spd); s.vx += ex / d * p; s.vy += ey / d * p; }
      }
    }
    wade.set(key, { x, y, sub });
    return { q, sub, k: q ? Math.min(1, sub / Math.max(0.2 * L, eye * 0.7)) : 0 };
  }

  let last = null, acc = 0;
  stepShallows = (t) => {
    let dt = last == null ? 0 : (t - last) / 1000; last = t;
    if (!(dt > 0)) dt = 0; if (dt > 0.1) dt = 0.1;
${walk ? `    // the walk camera wades: slower with depth, and once the water reaches the chest it floats you (head up)
    if (typeof walkOn !== 'undefined' && walkOn && walkMode === 'walk') {
      if (__shWalkBase == null) __shWalkBase = WALK.speed;
      const p = camera.position, w = wader('walk', p.x, p.y, p.z - walkEye, walkEye, dt, walkVZ);
      WALK.speed = __shWalkBase * (1 - 0.65 * w.k);
      if (w.q && p.z < w.q.level + w.q.h + 0.3 * L) { p.z = w.q.level + w.q.h + 0.3 * L; walkVZ = Math.max(0, walkVZ); }
    } else if (__shWalkBase != null && typeof WALK !== 'undefined') { WALK.speed = __shWalkBase; __shWalkBase = null; }
` : ''}${ctrl ? `    // controllable bodies wade the same way (their rule speed scales; the bed stays their ground)
    const cw = window.__mojCtrl && window.__mojCtrl.world;
    if (cw) for (const e of cw.entities || []) {
      if (!e || !e.transform || !e.rule) continue;
      if (e.__shSpeed == null && Number.isFinite(e.rule.speed)) e.__shSpeed = e.rule.speed;
      const p = e.transform.pos, w = wader(e.id, p[0], p[1], p[2], 1.6 * L, dt, e.vel ? e.vel[2] || 0 : 0);
      if (e.__shSpeed != null) e.rule.speed = e.__shSpeed * (1 - 0.6 * w.k);
    }
` : ''}    if (RAIN > 0 && dt > 0) {
      rainAcc += dt * RAIN;
      while (rainAcc >= 1) { rainAcc -= 1; const b = B[Math.floor(rnd() * B.length)]; disturb(b.x0 + rnd() * (b.nx - 1) * b.dx, b.y0 + rnd() * (b.ny - 1) * b.dy, 0.09 * L, 0.9 * L); }
    }
    // breeze: wide, faint puffs keep a still surface alive (and its caustics moving)
    if (dt > 0) for (const b of B) {
      b.puff = (b.puff || 0) + dt * b.sim.breeze * b.area / (L * L);
      while (b.puff >= 1) { b.puff -= 1; const x = b.x0 + rnd() * (b.nx - 1) * b.dx, y = b.y0 + rnd() * (b.ny - 1) * b.dy; disturb(x, y, (0.45 + 0.5 * rnd()) * L, (rnd() - 0.5) * 0.5 * L); }
    }
    acc += dt; let n = 0;
    while (acc >= DT && n < 6) {
      acc -= DT; n++;
      for (const b of B) for (let k = 0; k < b.sub; k++) step(b, DT / b.sub);
      for (const s of FL) {
        const q = query(s.x, s.y), bz = bedAt(s.x, s.y);
        // no water under it (a basin drained): it settles on the bed and waits
        if (!q && bz != null) { s.vz = 0; s.vx *= 0.9; s.vy *= 0.9; s.z += (bz + s.r * 0.55 - s.z) * Math.min(1, DT * 6); continue; }
        if (!q) { s.vx *= -0.5; s.vy *= -0.5; s.x += s.vx * DT * 2; s.y += s.vy * DT * 2; continue; }
        const target = Math.max(q.level + q.h - s.draft, bz != null ? bz + s.r * 0.55 : -Infinity), az = 60 * (target - s.z) - 6 * s.vz;
        s.vz += az * DT; s.z += s.vz * DT;
        s.vx += (-G * q.sx * 0.5 - 0.9 * s.vx) * DT; s.vy += (-G * q.sy * 0.5 - 0.9 * s.vy) * DT;
        const nx = s.x + s.vx * DT, ny = s.y + s.vy * DT, qn = query(nx, ny);
        if (qn && qn.depth > s.r * 0.6) { s.x = nx; s.y = ny; } else { s.vx *= -0.4; s.vy *= -0.4; }   // grounded at the edge: bounce
        // only the floater's motion RELATIVE to the surface displaces water (riding the swell displaces none), so
        // the coupling can't feed on itself
        const e = target - s.z; if (Math.abs(e) > 0.004 * L) disturb(s.x, s.y, s.r, Math.max(-0.25 * L, Math.min(0.25 * L, e * 2.5)));
      }
    }
    // the sheet follows the field: heights, normals from central differences, foam
    for (const b of B) {
      const { nx, ny, h, pos, nor, fa, ca, foam, wet, dx, dy, D } = b;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const q = j * nx + i, o = 3 * q;
        pos[o + 2] = b.level + h[q];
        const gx = ((i < nx - 1 ? h[q + 1] : h[q]) - (i > 0 ? h[q - 1] : h[q])) / (2 * dx), gy = ((j < ny - 1 ? h[q + nx] : h[q]) - (j > 0 ? h[q - nx] : h[q])) / (2 * dy);
        const inv = 1 / Math.hypot(gx, gy, 1); nor[o] = -gx * inv; nor[o + 1] = -gy * inv; nor[o + 2] = inv;
        fa[q] = wet[q] ? Math.min(1, foam[q]) : 0;
        // a crest (∇²h < 0) is a converging lens: it focuses the sun on the bed a depth D below
        const lap = ((i < nx - 1 ? h[q + 1] : h[q]) + (i > 0 ? h[q - 1] : h[q]) - 2 * h[q]) / (dx * dx) + ((j < ny - 1 ? h[q + nx] : h[q]) + (j > 0 ? h[q - nx] : h[q]) - 2 * h[q]) / (dy * dy);
        ca[q] = wet[q] ? Math.max(-0.45, Math.min(1.6, -lap * Math.max(D[q], 0) * 0.5)) : 0;
      }
      b.geo.attributes.position.needsUpdate = true; b.geo.attributes.normal.needsUpdate = true; b.geo.attributes.aAqFoam.needsUpdate = true; b.geo.attributes.aAqCaus.needsUpdate = true;
      b.U.uAqTime.value = t / 1000;
    }
    for (const s of FL) {
      const q = query(s.x, s.y);
      s.grp.position.set(s.x, s.y, s.z);
      if (q) { s.grp.rotation.x = Math.atan(q.sy) * 0.8; s.grp.rotation.y = -Math.atan(q.sx) * 0.8; }
      if (s.vx * s.vx + s.vy * s.vy > 0.01 * L * L && s.f.shape === 'duck') s.grp.rotation.z += (Math.atan2(s.vy, s.vx) - s.grp.rotation.z) * 0.05;
    }
  };
  // click the water (orbit view) to splash it — the bus from the outside
  canvas.addEventListener('pointerdown', (e) => {
    if (typeof walkOn !== 'undefined' && walkOn) return;
    const r = canvas.getBoundingClientRect(), ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    for (const b of B) {
      const o = ray.ray.origin, d = ray.ray.direction; if (Math.abs(d.z) < 1e-6) continue;
      const s = (b.level - o.z) / d.z; if (s <= 0) continue;
      if (disturb(o.x + d.x * s, o.y + d.y * s, 0.35 * L, 1.6 * L, 0.9)) break;
    }
  });
  window.__aqWater = { bodies: B.map((b) => ({ id: b.id, kind: b.kind, level: b.level })), query, disturb, setLevel, bedAt, floaters: FL, waders: wade, _sim: B };
}`;
}
