/**
 * fire-shot.js — a world's fire at one instant, for an offline renderer (a Blender Cycles still): the same kernel the
 * World page runs (fire.js fireKernel), read at time t and turned into what a path tracer wants.
 *
 *   · each flamelet becomes a VOLUME of light: the page's flame shader (a ray marched through a box around the
 *     flamelet's spine) evaluated at every voxel instead of along a ray, so the soot glow cooling toward the tip, the
 *     eddy-wrinkled edge, a laminar flame's blue sheet and a colorant's lines are the page's own; it is emission per
 *     metre, linear (no tonemap: the renderer's view transform is the tonemap);
 *   · each fire's smoke becomes a density volume: its puffs as soft blobs, broken up by noise;
 *   · embers are short streaks (where each is and where it was a moment ago), glowing in the page's colours;
 *   · each fire is a light (where the page's light stands, its colour, its flicker now), and stands on its prop
 *     (fire.js firePropParts, the page's own), its coals glowing as hard as it burns.
 *
 * Pure and deterministic: same fire, same t → same bytes. The grids are dense boxes sent sparse (the voxels that glow);
 * the renderer side (the Blender pack's import_mojulo.py) writes them to OpenVDB.
 */
import { fireKernel, fireLightRGB, firePropParts, FIRE_PROP_COLORS } from './fire.js';
import { windField, resolveTerrainWind } from '../vegetation/wind.js';

const DEG = Math.PI / 180;
const sm = (e0, e1, x) => { const u = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return u * u * (3 - 2 * u); };
const fract = (v) => v - Math.floor(v);
// the page shader's value noise (fh3 / fn3), in doubles
const fh3 = (x, y, z) => { x = fract(x * 0.3183099 + 0.1) * 17; y = fract(y * 0.3183099 + 0.1) * 17; z = fract(z * 0.3183099 + 0.1) * 17; return fract(x * y * z * (x + y + z)); };
function fn3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z); let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const l = (a, b, f) => a + (b - a) * f;
  return l(l(l(fh3(ix, iy, iz), fh3(ix + 1, iy, iz), fx), l(fh3(ix, iy + 1, iz), fh3(ix + 1, iy + 1, iz), fx), fy),
    l(l(fh3(ix, iy, iz + 1), fh3(ix + 1, iy, iz + 1), fx), l(fh3(ix, iy + 1, iz + 1), fh3(ix + 1, iy + 1, iz + 1), fx), fy), fz);
}
const sootColor = (T) => { const a = [1, 0.1, 0.01], b = [1, 0.34, 0.05], c = [1, 0.62, 0.26]; return T < 0.5 ? a.map((v, j) => v + (b[j] - v) * 2 * T) : b.map((v, j) => v + (c[j] - v) * (2 * T - 1)); };
const r6 = (v) => Math.round(v * 1e6) / 1e6;

/** The air a world's fire burns in, off the page: a terrain's wind field (vegetation/wind.js, the page's own), at the
 *  height the page reads it. null in still air. */
export function fireAirFor(manifest, payload) {
  const W = manifest && manifest.wind; if (!payload || !payload.fire || !payload.fire.terrainAir || !W) return { air: null, wind: null };
  const w = resolveTerrainWind(W); if (!w) return { air: null, wind: null };
  const f = windField({ speed: w.speed, dir: w.dir * DEG, gust: w.gust, scale: w.scale, evolve: w.evolve, veer: w.veer * DEG, seed: w.seed, z0: 0.05 });
  return { air: (x, y, z, t) => f.at(x, y, 1.2, t), wind: { speed: w.speed, dir: w.dir * DEG } };
}

/** A terrain world's ground off the page: the page's own terrain kernel (payload.terrain.kernel) built from its config,
 *  as the World page builds it. → { groundAt, burnable } or null. */
export function fireWorldFor(payload) {
  const T = payload && payload.terrain; if (!T || !T.kernel || !T.K) return null;
  const kernel = new Function(`return (${T.kernel});`)();
  const dec = (b, Ty) => { const u = Buffer.from(b, 'base64'); return new Ty(u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength)); };
  const K = T.K, G = K.grids, deep = (v) => (v && typeof v === 'object' ? (typeof v.__b64 === 'string' ? dec(v.__b64, globalThis[v.t]) : Array.isArray(v) ? v.map(deep) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deep(x)]))) : v);
  let tk;
  if (K.atlas) tk = kernel(deep(K));
  else {
    const grade = K.grade ? K.grade.map((L) => ({ ...L, dq: dec(L.dq, Uint16Array), w: dec(L.w, Uint8Array), ...(L.paint ? { paint: { ...L.paint, pc: dec(L.paint.pc, Uint8Array) } } : {}) })) : undefined;
    tk = kernel({ ...K, hq: dec(G.hq, Uint16Array), hard: dec(G.hard, Uint8Array), apron: dec(G.apron, Uint8Array), ...(grade ? { grade } : {}) });
  }
  const water = T.water;
  return { groundAt: (x, y) => tk.groundAt(x, y), burnable: (x, y) => !(water && tk.groundAt(x, y) < water.z) };
}

// one flamelet's light, voxel by voxel: the page's flame shader, per point instead of per ray step
function flameletGrid(f, s, t, { gain, detail }) {
  const NP = f.rad.length, P = f.pts, Rm = Math.max(f.rad[2], 1e-4);
  const lam = s.lam ? 1 : 0, ball = s.path ? 1 : 0, edge = s.lam ? 0.08 : 0.45, rise = Math.sqrt(9.81 * s.L), lineK = s.lineK || 0, line = s.line || [1, 1, 1], soot0 = s.soot;
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let k = 0; k < NP; k++) { const r = 1.8 * f.rad[k] + 0.002; for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], P[3 * k + c] - r); mx[c] = Math.max(mx[c], P[3 * k + c] + r); } }
  // a voxel a fourteenth of the flamelet's width (the eddies' finest wrinkle spans a few), finer with `detail`; at most
  // about a million voxels a flamelet
  let v = Rm / (14 * detail); const vol = (mx[0] - mn[0]) * (mx[1] - mn[1]) * (mx[2] - mn[2]);
  if (vol / v ** 3 > 1.2e6) v = Math.cbrt(vol / 1.2e6);
  const dims = [0, 1, 2].map((c) => Math.max(2, Math.ceil((mx[c] - mn[c]) / v) + 1)), [nx, ny, nz] = dims;
  const idx = [], val = [];
  for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy < ny; iy++) for (let iz = 0; iz < nz; iz++) {
    const px = mn[0] + ix * v, py = mn[1] + iy * v, pz = mn[2] + iz * v;
    let best = 1e9, bs = 0;
    for (let k = 0; k < NP - 1; k++) {
      const ax = P[3 * k], ay = P[3 * k + 1], az = P[3 * k + 2], bx = P[3 * k + 3] - ax, by = P[3 * k + 4] - ay, bz = P[3 * k + 5] - az;
      const h = Math.min(1, Math.max(0, ((px - ax) * bx + (py - ay) * by + (pz - az) * bz) / Math.max(bx * bx + by * by + bz * bz, 1e-14)));
      const qx = px - ax - bx * h, qy = py - ay - by * h, qz = pz - az - bz * h, d2 = qx * qx + qy * qy + qz * qz;
      if (d2 < best) { best = d2; bs = (k + h) / (NP - 1); }
    }
    const fi = bs * (NP - 1), i0 = Math.min(Math.floor(fi), NP - 2), R = Math.max(f.rad[i0] + (f.rad[i0 + 1] - f.rad[i0]) * (fi - i0), 1e-4), r = Math.sqrt(best) / R;
    if (r > 1.8) continue;
    const nX = (px / Rm) * 1.6, nY = (py / Rm) * 1.6, nZ = (pz / Rm) * 0.8 - (t * rise / Rm) * 0.8;
    const n = 0.62 * fn3(nX, nY, nZ) + 0.38 * fn3(nX * 2.07 + 7.1, nY * 2.07 + 7.1, nZ * 2.07 + 7.1);
    const dd = r + edge * (n - 0.5) * (0.4 + 1.6 * bs), inside = 1 - sm(0.55, 1, dd);
    const zone = (sm(0.03, 0.25 + 0.1 * lam, bs) * (1 - ball) + ball) * (1 - sm(0.78 + (0.55 - 0.78) * ball, 1, bs + 0.25 * edge * (n - 0.5)));
    const core = lam * (1 - sm(0, 0.62, dd)) * (1 - sm(0.12, 0.5, bs));
    const soot = inside * zone * (1 - 0.85 * core) * soot0;
    const T = Math.min(1, Math.max(0, 1.05 - 0.85 * sm(0.35, 1, bs) - 0.4 * dd * dd)), sc = sootColor(T), sk = soot * (0.25 + 0.75 * T * T);
    const sheet = Math.exp(-(((dd - 0.9) / 0.12) ** 2)) * (1 - sm(0.04, 0.3, bs)) * (0.12 + 0.5 * lam) * (1 - 0.7 * lineK) * 0.4;
    const lines = inside * sm(0.02, 0.2, bs) * (1 - sm(0.75, 1.02, bs + 0.25 * edge * (n - 0.5))) * (0.45 + 0.55 * T) * lineK * 0.45;
    const g = gain / Rm, e = [(sk * sc[0] + lines * line[0] + sheet * 0.08) * g, (sk * sc[1] + lines * line[1] + sheet * 0.18) * g, (sk * sc[2] + lines * line[2] + sheet) * g];
    if (e[0] + e[1] + e[2] < 1e-4 * g) continue;
    idx.push((ix * ny + iy) * nz + iz); val.push(r6(e[0]), r6(e[1]), r6(e[2]));
  }
  return { origin: mn.map(r6), voxel: r6(v), dims, idx, val };
}

// a fire's smoke: its puffs as soft blobs, the noise breaking them up as the page's sprite texture cannot
function smokeGrid(puffs, s, { detail }) {
  if (!puffs.length) return null;
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; let rMin = 1e9;
  for (let o = 0; o < puffs.length; o += 5) { const r = puffs[o + 3]; rMin = Math.min(rMin, r); for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], puffs[o + c] - 1.6 * r); mx[c] = Math.max(mx[c], puffs[o + c] + 1.6 * r); } }
  let v = rMin / (5 * detail); const vol = (mx[0] - mn[0]) * (mx[1] - mn[1]) * (mx[2] - mn[2]);
  if (vol / v ** 3 > 2e6) v = Math.cbrt(vol / 2e6);
  const dims = [0, 1, 2].map((c) => Math.max(2, Math.ceil((mx[c] - mn[c]) / v) + 1)), [nx, ny, nz] = dims, D = new Float32Array(nx * ny * nz);
  for (let o = 0; o < puffs.length; o += 5) {
    const [cx, cy, cz, r, a] = puffs.slice(o, o + 5), rr = 1.6 * r;
    // optical depth through a puff's middle as the page's sprite is opaque: a gaussian across ≈ 1.25 r
    const peak = (a * 0.55) / (1.25 * r) * 2.5;
    const i0 = Math.max(0, Math.floor((cx - rr - mn[0]) / v)), i1 = Math.min(nx - 1, Math.ceil((cx + rr - mn[0]) / v));
    const j0 = Math.max(0, Math.floor((cy - rr - mn[1]) / v)), j1 = Math.min(ny - 1, Math.ceil((cy + rr - mn[1]) / v));
    const k0 = Math.max(0, Math.floor((cz - rr - mn[2]) / v)), k1 = Math.min(nz - 1, Math.ceil((cz + rr - mn[2]) / v));
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) {
      const dx = mn[0] + i * v - cx, dy = mn[1] + j * v - cy, dz = mn[2] + k * v - cz, q = (dx * dx + dy * dy + dz * dz) / (r * r);
      if (q < 2.56) D[(i * ny + j) * nz + k] += peak * Math.exp(-2 * q);
    }
  }
  const idx = [], val = [], sc = 2.2 / rMin;
  for (let i = 0; i < D.length; i++) {
    if (!(D[i] > 1e-3)) continue;
    const ix = Math.floor(i / (ny * nz)), iy = Math.floor(i / nz) % ny, iz = i % nz, x = (mn[0] + ix * v) * sc, y = (mn[1] + iy * v) * sc, z = (mn[2] + iz * v) * sc;
    const n = 0.6 * fn3(x, y, z) + 0.4 * fn3(2.1 * x + 3.3, 2.1 * y + 1.7, 2.1 * z + 5.1);
    const d = D[i] * Math.max(0, 0.25 + 1.5 * (n - 0.35)); if (d > 1e-3) { idx.push(i); val.push(r6(d)); }
  }
  return { origin: mn.map(r6), voxel: r6(v), dims, idx, val, color: s.smokeColor || null };
}

/**
 * fireShot(fireCfg, t, { air, wind, world, detail, cameras }) → the fire at time t, for a path tracer:
 *   { t, fires: [{ i, kind, centre, intensity, light: { at, power, color, radius }, flames: [grid…], peak (its flames' brightest
 *     voxel), smoke: grid | null,
 *     coal: glow, props: parts }], embers: [x, y, z, px, py, pz, r, g, b, …], prop_colors, cameras }
 * fireCfg: the world payload's `fire` (fire.js firePageChannel). power: the page's light (its kind's strength, its
 * flicker now) in the units `light` scales — the renderer sets watts per unit. A grid: { origin (its first voxel's
 * centre), voxel, dims [nx, ny, nz], idx (x-major voxel indices), val (rgb per index for a flame, density for smoke) }.
 */
export function fireShot(fireCfg, t, { air = null, wind = null, world = null, detail = 1, cameras = [] } = {}) {
  const F = wind && fireCfg.spread ? { ...fireCfg, wind } : fireCfg, K = fireKernel(F, air, world), fires = [], embers = [];
  for (let i = 0; i < K.N; i++) {
    const s = K.src(i), c = K.centre(i, t), k = c ? K.intensity(i, t) : 0, col = fireLightRGB(s);
    const gain = s.lam ? 1.4 : s.path ? 0.3 : s.kind === 'grass' ? 0.55 : 0.85 / (1 + 0.3 * (s.n - 1));
    const flames = c ? K.flames(i, t).filter(Boolean).map((f) => flameletGrid(f, s, t, { gain, detail })).filter((g) => g.idx.length) : [];
    const sm0 = c || s.path ? K.smoke(i, t) : [];
    const lk = c ? K.light(i, t) : 0;
    if (c || s.path) {
      const e = K.embers(i, t), L = s.line, q = L ? 0.6 * s.lineK : 0;
      for (let o = 0; o + 6 < e.length; o += 7) {
        const g = e[o + 6];
        embers.push(...e.slice(o, o + 6).map(r6), r6((1 - q + q * (L ? L[0] : 0)) * g), r6(((0.3 + 0.5 * g) * (1 - q) + q * (L ? L[1] : 0)) * g), r6((0.06 * g * (1 - q) + q * (L ? L[2] : 0)) * g));
      }
    }
    fires.push({
      i, kind: s.kind, ...(s.color !== undefined ? { color: s.color } : {}), centre: c ? c.map(r6) : null, intensity: r6(k),
      light: c ? { at: [c[0], c[1], c[2] + (s.path ? 0 : 0.4 * s.L)].map(r6), power: r6(s.light * lk * (F.light ?? 1)), color: col.map(r6), radius: r6(0.35 * (0.7 * s.L + 0.3 * s.D)) } : null,
      flames, peak: r6(Math.max(1e-6, ...flames.map((g) => { let m = 0; for (let j = 0; j < g.val.length; j++) m = Math.max(m, g.val[j]); return m; }))),
      smoke: F.smoke === false ? null : smokeGrid(sm0, s, { detail }),
      coal: r6(0.3 + 0.7 * Math.min(2, lk)), props: i < K.NS ? firePropParts(s) : [],
    });
  }
  return { t, fires, embers, prop_colors: Object.fromEntries(Object.entries(FIRE_PROP_COLORS).map(([k, v]) => [k, `#${v.toString(16).padStart(6, '0')}`])), cameras };
}

/** A shot's still: the time a fire reads best, when none is asked — after a kindle has caught, a fireball mid-flight. */
export function fireShotTime(fireCfg) {
  const ball = (fireCfg.sources || []).find((s) => s.path);
  if (ball) { const P = ball.path, T = Math.hypot(P.to[0] - P.from[0], P.to[1] - P.from[1], P.to[2] - P.from[2]) / P.speed; return +(P.delay + 0.6 * T).toFixed(3); }
  const kindle = Math.max(0, ...(fireCfg.sources || []).map((s) => (s.life && s.life.kindle ? (s.life.start || 0) + 1.5 * s.life.kindle : 0)));
  const spread = Math.max(0, ...(fireCfg.spread || []).map((g) => g.start + 8));
  return Math.max(6, kindle, spread);
}

const hex = (c) => `#${c.map((v) => Math.round(Math.min(1, Math.max(0, v)) ** (1 / 2.2) * 255).toString(16).padStart(2, '0')).join('')}`;
const add3 = (a, b, k = 1) => [a[0] + k * b[0], a[1] + k * b[1], a[2] + k * b[2]];
const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const ortho = (z) => norm3(Math.abs(z[2]) < 0.9 ? cross3(z, [0, 0, 1]) : cross3(z, [1, 0, 0]));
const ICO = (() => { const t = (1 + Math.sqrt(5)) / 2, v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(norm3);
  return { v, f: [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]] }; })();

/**
 * fireShotFaces(shot) → the shot's solid parts as world faces (the GLB writer's input): each fire's props (group
 * `fire-props-<i>`, PBR: iron metal, the rest rough), its coals (`fire-coals-<i>`, their glow's colour) and every ember
 * as a thin spindle from where it was to where it is (`fire-embers`, each its own colour). The renderer makes the
 * coals' and embers' colours light.
 */
export function fireShotFaces(shot) {
  const faces = [], col = shot.prop_colors;
  for (const f of shot.fires) {
    const g = `fire-props-${f.i}`;
    for (const p of f.props) {
      if (p.shape === 'cyl') {
        const z = norm3([p.b[0] - p.a[0], p.b[1] - p.a[1], p.b[2] - p.a[2]]), x = ortho(z), y = cross3(z, x), ring = (c, r) => Array.from({ length: p.seg }, (_, k) => { const q = (2 * Math.PI * k) / p.seg; return add3(add3(c, x, r * Math.cos(q)), y, r * Math.sin(q)).map(r6); });
        const A = ring(p.a, p.r0), B = ring(p.b, p.r1), face = (corners) => faces.push({ corners, fill: col[p.mat], group: g, pbr: p.mat === 'iron' ? [0.8, 0.45] : [0, 0.85] });
        for (let k = 0; k < p.seg; k++) { const k1 = (k + 1) % p.seg; face([A[k], A[k1], B[k1], B[k]]); }
        // caps as fans: the GLB writer meshes triangles and quads
        if (!p.open) for (let k = 1; k < p.seg - 1; k++) { face([A[0], A[k + 1], A[k]]); face([B[0], B[k], B[k + 1]]); }
      } else if (p.shape === 'stone') {
        const c = Math.cos(p.rotZ), s = Math.sin(p.rotZ), P = ICO.v.map((v) => { const u = [v[0] * p.r * p.scale[0], v[1] * p.r * p.scale[1], v[2] * p.r * p.scale[2]]; return [p.at[0] + c * u[0] - s * u[1], p.at[1] + s * u[0] + c * u[1], p.at[2] + u[2]].map(r6); });
        for (const t of ICO.f) faces.push({ corners: t.map((j) => P[j]), fill: col[p.mat], group: g, pbr: [0, 0.9] });
      } else if (p.shape === 'coal') {
        const ring = Array.from({ length: 20 }, (_, k) => [p.at[0] + p.r * Math.cos((2 * Math.PI * k) / 20), p.at[1] + p.r * Math.sin((2 * Math.PI * k) / 20), p.at[2]].map(r6));
        for (let k = 1; k < 19; k++) faces.push({ corners: [ring[0], ring[k], ring[k + 1]], fill: hex([1, 0.21, 0.032]), group: `fire-coals-${f.i}` });
      }
    }
  }
  const E = shot.embers;
  for (let o = 0; o + 8 < E.length; o += 9) {
    const p = E.slice(o, o + 3), q = E.slice(o + 3, o + 6);
    let d = [p[0] - q[0], p[1] - q[1], p[2] - q[2]]; if (Math.hypot(...d) < 1e-5) d = [0, 0, 1e-3];
    const z = norm3(d), x = ortho(z).map((v) => v * 0.0016), y = cross3(z, x), mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
    const ring = [add3(mid, x), add3(mid, y), add3(mid, x, -1), add3(mid, y, -1)].map((v) => v.map(r6)), fill = hex([E[o + 6], E[o + 7], E[o + 8]]);
    for (let j = 0; j < 4; j++) { const a = ring[j], b = ring[(j + 1) % 4]; faces.push({ corners: [q.map(r6), b, a], fill, group: 'fire-embers' }, { corners: [p.map(r6), a, b], fill, group: 'fire-embers' }); }
  }
  return faces;
}
