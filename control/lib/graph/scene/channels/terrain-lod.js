import { safeJson } from '../emit-util.js';

// In-page script: the TERRAIN channel (opt-in via emitThreeWorld({ terrain })). The page
// carries the terrain world's RECIPE — the kernel's source (terrain-kernel.js, inlined as text) and its quantised grids —
// not a mesh, and builds the ground around the camera itself.
//
// Flat world: a CDLOD quadtree over the world and its horizon. Planet (`planet` set): six quadtrees on a cube-sphere of
// radius R centred R below the painting, which sits at the north pole; nodes below the camera's horizon are culled.
// Either way a leaf is a chunk of n×n quads (heights from the kernel, normals from the chunk's own vertices, colours from
// the kernel's painter — lit by the global normal on the planet, so there is a night side) with a skirt that hides the
// step between neighbouring levels. A node splits while the camera is nearer than `split` × its size (height above the
// ground counts as distance), and refines into its four children only when all four are built: until then it draws
// itself and queues them, nearest first, within `budgetMs` a frame — nothing overlaps and there is always ground.
// Built chunks live in an LRU capped at `maxChunks`; the drawn tree, its ancestors and the queue are never evicted.
// Hidden chunks leave the raycast layer, so walk (which raycasts `walkColliders`) stands on exactly what is drawn.
// Near and far follow altitude, haze thins with it, the sky rides with the camera, and high above a planet the sky
// gives way to space and an atmosphere rim. In fly, WALK.speed grows with height above the ground.
// Absent `terrain` ⇒ NOT emitted, so every other World stays byte-identical.
// `cfg`: { kernel: source text, K: the kernel's page config, root: { cx, cy, size }, n, split, minSize, maxChunks,
//          budgetMs, skirt, hazeHeight, bg, rect | null, water: { z, color, opacity } | null,
//          speeds: { walk, flyMin, flyPerAlt }, planet: null | { R, sea, space, rim, ocean } }
export function terrainChannelScript(cfg) {
  const { kernel, ...rest } = cfg;
  return `
// --- terrain world (opt-in): the recipe's ground, meshed around the camera ---
const TERRAIN = ${safeJson(rest)};
const __tKernel = (${kernel});
const __tk = (function () {
  const K = TERRAIN.K, G = K.grids;
  const dec = (b, T) => { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new T(u.buffer); };
  return __tKernel(Object.assign({}, K, { hq: dec(G.hq, Uint16Array), hard: dec(G.hard, Uint8Array), apron: dec(G.apron, Uint8Array) }));
})();
const __tN = TERRAIN.n, __tV = __tN + 1, __tPL = TERRAIN.planet;
const __tChunks = new Map();                       // key → { mesh, f, level, ix, iy, used }
const __tStat = { built: 0, evicted: 0, buildMs: 0, shown: 0, live: 0 };
window.__mojTerrain = { kernel: __tk, chunks: __tChunks, stat: __tStat, cfg: TERRAIN };
const __tLin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
// one index buffer for every chunk: the (n+1)² grid, then the skirt ring hanging below the perimeter
const __tPerim = (() => { const p = []; for (let i = 0; i < __tN; i++) p.push(i); for (let j = 0; j < __tN; j++) p.push(j * __tV + __tN); for (let i = __tN; i > 0; i--) p.push(__tN * __tV + i); for (let j = __tN; j > 0; j--) p.push(j * __tV); return p; })();
const __tIndex = (() => {
  const idx = [];
  for (let j = 0; j < __tN; j++) for (let i = 0; i < __tN; i++) { const a = j * __tV + i, b = a + 1, c = a + __tV, d = c + 1; idx.push(a, b, d, a, d, c); }
  const P = __tPerim.length, base = __tV * __tV;
  for (let p = 0; p < P; p++) { const a = __tPerim[p], b = __tPerim[(p + 1) % P], a2 = base + p, b2 = base + (p + 1) % P; idx.push(a, b, b2, a, b2, a2); }
  return new THREE.BufferAttribute(new Uint32Array(idx), 1);
})();
const __tMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
const __tKey = (f, l, i, j) => f + ':' + l + ':' + i + ':' + j;
// the planet: its centre, the six cube faces (normal, u axis, v axis), a node's direction
const __tC = __tPL ? new THREE.Vector3(0, 0, -__tPL.R) : null;
const __tFaces = [[[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [1, 0, 0], [0, -1, 0]], [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, -1, 0], [0, 0, 1]], [[0, 1, 0], [-1, 0, 0], [0, 0, 1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]]];
function __tDir(f, u, v) { const F = __tFaces[f]; const x = F[0][0] + u * F[1][0] + v * F[2][0], y = F[0][1] + u * F[1][1] + v * F[2][1], z = F[0][2] + u * F[1][2] + v * F[2][2], l = Math.sqrt(x * x + y * y + z * z); return [x / l, y / l, z / l]; }
function __tFinish(pos, col, cx, cy, cz) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(__tIndex);
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, __tMat); mesh.position.set(cx, cy, cz); mesh.userData.g = 'terrain'; mesh.layers.set(1); mesh.visible = false;
  scene.add(mesh); if (typeof walkColliders !== 'undefined') walkColliders.push(mesh);
  return mesh;
}
// the skirt: each perimeter vertex again, dropped along 'down' (straight down, or toward the planet's centre)
function __tSkirt(pos, col, drop, down) {
  const base = __tV * __tV;
  for (let p = 0; p < __tPerim.length; p++) {
    const s = __tPerim[p], d = base + p, dx = down ? down[s * 3] : 0, dy = down ? down[s * 3 + 1] : 0, dz = down ? down[s * 3 + 2] : 1;
    pos[d * 3] = pos[s * 3] - dx * drop; pos[d * 3 + 1] = pos[s * 3 + 1] - dy * drop; pos[d * 3 + 2] = pos[s * 3 + 2] - dz * drop;
    col[d * 3] = col[s * 3]; col[d * 3 + 1] = col[s * 3 + 1]; col[d * 3 + 2] = col[s * 3 + 2];
  }
}
function __tBuildFlat(l, ix, iy) {
  const size = TERRAIN.root.size / (1 << l), x0 = TERRAIN.root.cx - TERRAIN.root.size / 2 + ix * size, y0 = TERRAIN.root.cy - TERRAIN.root.size / 2 + iy * size;
  const step = size / __tN, W = __tV + 2, Hg = new Float64Array(W * W);
  for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) Hg[j * W + i] = __tk.heightAt(x0 + (i - 1) * step, y0 + (j - 1) * step);
  const cx = x0 + size / 2, cy = y0 + size / 2, nv = __tV * __tV + __tPerim.length;
  const pos = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
  for (let j = 0; j < __tV; j++) for (let i = 0; i < __tV; i++) {
    const v = j * __tV + i, h = Hg[(j + 1) * W + i + 1], X = x0 + i * step, Y = y0 + j * step;
    const gx = (Hg[(j + 1) * W + i + 2] - Hg[(j + 1) * W + i]) / (2 * step), gy = (Hg[(j + 2) * W + i + 1] - Hg[j * W + i + 1]) / (2 * step);
    const ln = Math.sqrt(gx * gx + gy * gy + 1), c = __tk.colorAt(X, Y, h, [-gx / ln, -gy / ln, 1 / ln]);
    pos[v * 3] = X - cx; pos[v * 3 + 1] = Y - cy; pos[v * 3 + 2] = h;
    col[v * 3] = __tLin(c[0]); col[v * 3 + 1] = __tLin(c[1]); col[v * 3 + 2] = __tLin(c[2]);
  }
  __tSkirt(pos, col, TERRAIN.skirt * size, null);
  return __tFinish(pos, col, cx, cy, 0);
}
const __tSea = __tPL ? __tPL.sea : null;
function __tBuildPlanet(f, l, ix, iy) {
  const R = __tPL.R, span = 2 / (1 << l), u0 = -1 + ix * span, v0 = -1 + iy * span, step = span / __tN, W = __tV + 2;
  const P = new Float64Array(W * W * 3), H = new Float64Array(W * W), XY = new Float64Array(W * W * 2), D = new Float64Array(W * W * 3);
  for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
    const d = __tDir(f, u0 + (i - 1) * step, v0 + (j - 1) * step), r = __tk.planetAt(d[0], d[1], d[2]), q = j * W + i, rr = R + r[0];
    P[q * 3] = d[0] * rr; P[q * 3 + 1] = d[1] * rr; P[q * 3 + 2] = d[2] * rr; H[q] = r[0]; XY[q * 2] = r[1]; XY[q * 2 + 1] = r[2]; D[q * 3] = d[0]; D[q * 3 + 1] = d[1]; D[q * 3 + 2] = d[2];
  }
  const cdir = __tDir(f, u0 + span / 2, v0 + span / 2), cx = cdir[0] * R, cy = cdir[1] * R, cz = cdir[2] * R - R;
  const nv = __tV * __tV + __tPerim.length, pos = new Float32Array(nv * 3), col = new Float32Array(nv * 3), down = new Float32Array(__tV * __tV * 3);
  const L = TERRAIN.K.light, A = TERRAIN.K.lambert;
  for (let j = 0; j < __tV; j++) for (let i = 0; i < __tV; i++) {
    const q = (j + 1) * W + i + 1, v = j * __tV + i, qe = q + 1, qw = q - 1, qn = q + W, qs = q - W;
    const ax = P[qe * 3] - P[qw * 3], ay = P[qe * 3 + 1] - P[qw * 3 + 1], az = P[qe * 3 + 2] - P[qw * 3 + 2];
    const bx = P[qn * 3] - P[qs * 3], by = P[qn * 3 + 1] - P[qs * 3 + 1], bz = P[qn * 3 + 2] - P[qs * 3 + 2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const ln = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= ln; ny /= ln; nz /= ln; const up = nx * D[q * 3] + ny * D[q * 3 + 1] + nz * D[q * 3 + 2];
    if (up < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const cu = Math.abs(up), lam = A.ambient + A.gain * Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
    let c = __tk.colorAt(XY[q * 2], XY[q * 2 + 1], H[q], [Math.sqrt(Math.max(0, 1 - cu * cu)), 0, cu], lam);
    if (H[q] < __tSea) { const t = Math.min(1, (__tSea - H[q]) / 60); c = [c[0] * (1 - t) + 40 * t, c[1] * (1 - t) + 70 * t, c[2] * (1 - t) + 95 * t]; }
    pos[v * 3] = P[q * 3] - cx; pos[v * 3 + 1] = P[q * 3 + 1] - cy; pos[v * 3 + 2] = P[q * 3 + 2] - R - cz;
    down[v * 3] = D[q * 3]; down[v * 3 + 1] = D[q * 3 + 1]; down[v * 3 + 2] = D[q * 3 + 2];
    col[v * 3] = __tLin(c[0]); col[v * 3 + 1] = __tLin(c[1]); col[v * 3 + 2] = __tLin(c[2]);
  }
  __tSkirt(pos, col, TERRAIN.skirt * R * span, down);
  return __tFinish(pos, col, cx, cy, cz);
}
function __tBuild(f, l, i, j) {
  const t0 = performance.now(); const mesh = f < 0 ? __tBuildFlat(l, i, j) : __tBuildPlanet(f, l, i, j);
  __tStat.built++; __tStat.buildMs += performance.now() - t0;
  return mesh;
}
function __tDrop(key) {
  const r = __tChunks.get(key); if (!r) return; __tChunks.delete(key);
  scene.remove(r.mesh); r.mesh.geometry.dispose();
  if (typeof walkColliders !== 'undefined') { const q = walkColliders.indexOf(r.mesh); if (q >= 0) walkColliders.splice(q, 1); }
  __tStat.evicted++;
}
function __tAlt() {
  const c = camera.position;
  if (!__tPL) return Math.max(0, c.z - __tk.groundAt(c.x, c.y));
  const dx = c.x - __tC.x, dy = c.y - __tC.y, dz = c.z - __tC.z, D = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return Math.max(0, D - __tPL.R - __tk.planetAt(dx / D, dy / D, dz / D)[0]);
}
// the tree the camera wants, drawn as far as it is built: a node refines into its four children only when all four
// exist (until then it draws itself and queues the missing ones, nearest first)
function __tSelect() {
  const c = camera.position, alt = __tAlt(), show = [], queue = [], keep = new Set(), R = TERRAIN.root, lim = TERRAIN.rect;
  const visit = (f, l, i, j, size, d, rec) => {
    const k = __tKey(f, l, i, j); keep.add(k);
    if (size > TERRAIN.minSize && d < TERRAIN.split * size) {
      const kids = [[2 * i, 2 * j], [2 * i + 1, 2 * j], [2 * i, 2 * j + 1], [2 * i + 1, 2 * j + 1]];
      if (kids.every(([a, b]) => __tChunks.has(__tKey(f, l + 1, a, b)))) { for (const [a, b] of kids) rec(f, l + 1, a, b); return; }
      for (const [a, b] of kids) { const kk = __tKey(f, l + 1, a, b); keep.add(kk); if (!__tChunks.has(kk)) queue.push([f, l + 1, a, b, d]); }
    }
    show.push(k);
  };
  if (!__tPL) {
    const rec = (f, l, i, j) => {
      const size = R.size / (1 << l), x0 = R.cx - R.size / 2 + i * size, y0 = R.cy - R.size / 2 + j * size;
      if (lim && (x0 > lim[1] || x0 + size < lim[0] || y0 > lim[3] || y0 + size < lim[2])) return;   // horizon 'none': the world ends
      const dx = Math.max(0, Math.abs(x0 + size / 2 - c.x) - size / 2), dy = Math.max(0, Math.abs(y0 + size / 2 - c.y) - size / 2);
      visit(f, l, i, j, size, Math.sqrt(dx * dx + dy * dy + alt * alt), rec);
    };
    rec(-1, 0, 0, 0);
  } else {
    const Rp = __tPL.R, ex = c.x - __tC.x, ey = c.y - __tC.y, ez = c.z - __tC.z, Dc = Math.sqrt(ex * ex + ey * ey + ez * ez);
    const horizon = Math.acos(Math.min(1, Rp / Math.max(Dc, Rp))) + Math.acos(Math.min(1, Rp / (Rp + 3000)));   // the camera's horizon, plus the tallest ground's
    const rec = (f, l, i, j) => {
      const span = 2 / (1 << l), d = __tDir(f, -1 + (i + 0.5) * span, -1 + (j + 0.5) * span), size = Rp * span * 0.785;
      const cosg = (d[0] * ex + d[1] * ey + d[2] * ez) / Dc, ang = Math.acos(Math.max(-1, Math.min(1, cosg)));
      if (l > 0 && ang > horizon + size / Rp) return;                // behind the planet from here
      const px = d[0] * Rp - ex, py = d[1] * Rp - ey, pz = d[2] * Rp - ez;
      visit(f, l, i, j, size, Math.max(0, Math.sqrt(px * px + py * py + pz * pz) - 0.7 * size), rec);
    };
    for (let f = 0; f < 6; f++) rec(f, 0, 0, 0);
  }
  return { show, queue: queue.sort((a, b) => a[4] - b[4]), keep };
}
const __tShown = new Set();
let __tSel = null, __tLastSel = -1e9, __tFog0 = null, __tSpace = false;
// the sky dome, stars, sun and moon (render order < 0, background-drawn) ride with the camera
const __tSky = []; scene.traverse((o) => { if (o !== scene && o.renderOrder < 0 && o.parent === scene) __tSky.push(o); });
let __tRim = null;
if (__tPL) {                                                      // a rim of air seen from orbit, and the sea as a sphere
  __tRim = new THREE.Mesh(new THREE.SphereGeometry(__tPL.R * 1.03, 96, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(__tPL.rim), transparent: true, opacity: 0.32, side: THREE.BackSide, depthWrite: false }));
  __tRim.position.copy(__tC); __tRim.visible = false; scene.add(__tRim);
  const ocean = new THREE.Mesh(new THREE.SphereGeometry(__tPL.R + __tPL.sea, 128, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(__tPL.ocean), transparent: true, opacity: 0.86, depthWrite: false }));
  ocean.position.copy(__tC); ocean.renderOrder = 1; scene.add(ocean);
}
function __tTick() {
  const now = performance.now();
  if (!__tSel || now - __tLastSel > 100) { __tSel = __tSelect(); __tLastSel = now; }
  let built = 0;
  for (const [f, l, i, j] of __tSel.queue) {                      // the nearest missing children, within the frame budget
    if (performance.now() - now > TERRAIN.budgetMs) break;
    const k = __tKey(f, l, i, j); if (!__tChunks.has(k)) { __tChunks.set(k, { mesh: __tBuild(f, l, i, j), f, level: l, ix: i, iy: j, used: now }); built++; }
  }
  if (built) __tLastSel = -1e9;                                   // refine as soon as a family is complete
  const show = new Set(__tSel.show);
  for (const k of __tShown) if (!show.has(k)) { const r = __tChunks.get(k); if (r) { r.mesh.visible = false; r.mesh.layers.set(1); } }
  for (const k of show) { const r = __tChunks.get(k); if (r) { r.mesh.visible = true; r.mesh.layers.set(0); r.used = now; } }
  __tShown.clear(); for (const k of show) __tShown.add(k);
  for (const k of __tSel.keep) { const r = __tChunks.get(k); if (r) r.used = now; }
  if (__tChunks.size > TERRAIN.maxChunks) {                       // the least recently wanted go first; the drawn tree, its ancestors and the queue stay
    const idle = [...__tChunks].filter(([k, r]) => !__tSel.keep.has(k) && r.level > 1).sort((a, b) => a[1].used - b[1].used);
    for (let q = 0; q < idle.length && __tChunks.size > TERRAIN.maxChunks; q++) __tDrop(idle[q][0]);
  }
  __tStat.shown = show.size; __tStat.live = __tChunks.size;
  const alt = __tAlt(), reach = __tPL ? camera.position.distanceTo(__tC) + __tPL.R : 0;
  const near = Math.min(2, Math.max(0.05, alt * 0.0015)), far = Math.max(8000, TERRAIN.root.size * 2, alt * 40, reach * 1.5);
  if (Math.abs(camera.near - near) > near * 0.25 || camera.far !== far) { camera.near = near; camera.far = far; camera.updateProjectionMatrix(); }
  __tStat.near = camera.near; __tStat.far = camera.far; __tStat.alt = alt; __tStat.eye = [camera.position.x, camera.position.y, camera.position.z];
  if (scene.fog && scene.fog.isFogExp2) { if (__tFog0 === null) __tFog0 = scene.fog.density; scene.fog.density = __tSpace ? 0 : __tFog0 * TERRAIN.hazeHeight / (TERRAIN.hazeHeight + alt); }   // less air between a high eye and the ground
  for (const o of __tSky) o.position.copy(camera.position);   // the sky is where the viewer is, at any distance from the world
  if (__tPL) {                                                    // high above the planet the sky gives way to space and a rim of air
    const space = alt > __tPL.space * (__tSpace ? 0.9 : 1);
    if (space !== __tSpace) { __tSpace = space; for (const o of __tSky) o.visible = !space; scene.background = new THREE.Color(space ? '#02040a' : TERRAIN.bg); }
    __tRim.visible = alt > __tPL.space * 0.4;
  }
  if (typeof walkOn !== 'undefined' && walkOn && typeof WALK !== 'undefined') WALK.speed = (typeof walkMode !== 'undefined' && walkMode === 'fly') ? Math.max(TERRAIN.speeds.flyMin, alt * TERRAIN.speeds.flyPerAlt) : TERRAIN.speeds.walk;
  requestAnimationFrame(__tTick);
}
// walk's ground is a ray straight down from the eye against what is drawn; while the ground refines under a walker a
// finer chunk can rise past the eye and the ray starts below it. The kernel is the ground's truth: when the ray finds
// nothing, or lands well under the true surface, the kernel answers (a roof or a placed piece above the ground still
// wins, being the nearer hit from above)
function __tGroundZ(x, y) {
  if (!__tPL) return __tk.heightAt(x, y);
  const R = __tPL.R, r2 = x * x + y * y; let z = __tk.heightAt(x, y) - r2 / (2 * R);
  for (let it = 0; it < 3; it++) { const D = Math.sqrt(r2 + (z + R) * (z + R)), h = __tk.planetAt(x / D, y / D, (z + R) / D)[0]; z = -R + Math.sqrt(Math.max(0, (R + h) * (R + h) - r2)); }
  return z;
}
if (typeof groundBelow === 'function') {
  const __tRay = groundBelow;
  groundBelow = function (x, y, zFrom) { const g = __tRay(x, y, zFrom), t = __tGroundZ(x, y); __tStat.ray = g === null ? null : g - t; /* the drawn ground's offset from the kernel's, for diagnosis */ return (g === null || g < t - 0.5) ? t : g; };   // eslint-disable-line no-func-assign
}
window.__mojTerrain.groundZ = __tGroundZ;
// the coarse levels exist before the first frame, so there is always ground
if (!__tPL) { for (let l = 0; l <= 2; l++) for (let i = 0; i < (1 << l); i++) for (let j = 0; j < (1 << l); j++) __tChunks.set(__tKey(-1, l, i, j), { mesh: __tBuild(-1, l, i, j), f: -1, level: l, ix: i, iy: j, used: 0 }); }
else { for (let f = 0; f < 6; f++) for (let l = 0; l <= 1; l++) for (let i = 0; i < (1 << l); i++) for (let j = 0; j < (1 << l); j++) __tChunks.set(__tKey(f, l, i, j), { mesh: __tBuild(f, l, i, j), f, level: l, ix: i, iy: j, used: 0 }); }
if (TERRAIN.water && !__tPL) {
  const W = TERRAIN.water, S = TERRAIN.root.size * 4;
  const wm = new THREE.Mesh(new THREE.PlaneGeometry(S, S), new THREE.MeshBasicMaterial({ color: new THREE.Color(W.color), transparent: true, opacity: W.opacity, depthWrite: false }));
  wm.position.set(TERRAIN.root.cx, TERRAIN.root.cy, W.z); wm.renderOrder = 1; scene.add(wm);
}
__tTick();
`;
}
