/**
 * landform — cliffs and mountains from a few mixable operators on one heightfield state.
 *
 * The state is a square-celled grid over a domain: height `z`, rock `hard`ness (0 soil … 1 bedrock), the loose `apron`
 * a talus left, and what the operators registered (the bed table, the joint fabric, scree placements). Each operator
 * reads and writes it in place, so they chain in any order:
 *
 *   peaks  — ridged multifractal relief (Musgrave): each octave folds into a crease and is weighted by the one above,
 *            so ridgelines stay sharp and valleys broad; amplitudes follow the two-regime roughness law (fracture-rough
 *            H 0.8 below the crossover, relief-smooth H 0.5 above).
 *   strata — beds of jittered thickness, hard or soft. Inside a hard bed the surface rises at the bed's base (the
 *            cliff) and benches on top; a soft bed keeps the slope. `dip` tilts the beds (cuestas, hogbacks). Hardness is
 *            registered as a function of height, so erosion reads the bed the surface is in *now*.
 *   scarp  — a cliff line along a path: one side raised by `throw` through a face of `face`°, the throw tapering to the
 *            tips (a fault's displacement profile), the trace wiggling self-affinely (H 0.8). The face is bedrock.
 *   joints — where the ground is steep, it breaks into planar facets, one per joint-bounded cell: faces whose aspect
 *            snaps to a joint normal (blocky), flat column tops (columnar), or the cleavage plane (slabby). Facets cut and
 *            never build: the steps between cells are the ledges and re-entrant corners.
 *   talus  — each face sheds a `retreat`-thick skin that runs down the steepest path until the ground eases below the
 *            angle of repose; then only that loose layer relaxes at the repose angle (bedrock never moves). Debris that
 *            runs off the map is gone. `scree` places power-law fragments (D 2.5) on the apron.
 *
 * `applyLandform` runs a list in declared order, then `erosion` (terrain-erosion.js, reading hardness: rivers cut soft
 * beds and not hard ones, bedrock holds its face), then the talus ops — debris falls on what the rivers left.
 *
 * Pure: integer hashing and a local mulberry32, no Math.random, no clock. Same state and ops → the same landform.
 */
import { erodeHeightfield, EROSION_DEFAULTS } from './terrain-erosion.js';

export const LANDFORM_OPS = Object.freeze(['peaks', 'strata', 'scarp', 'joints', 'talus']);
export const JOINT_PATTERNS = Object.freeze({
  blocky: { cell: [1, 0.8], lattice: 'rect', plane: 'snap' },    // granite, sandstone: two vertical sets + sheeting
  columnar: { cell: [1, 1], lattice: 'hex', plane: 'flat' },     // basalt: hexagonal cooling columns
  slabby: { cell: [1, 0.35], lattice: 'rect', plane: 'dip' },    // slate, schist: one dominant dipping plane
});
/** The joint pattern a rock preset weathers into. */
export const ROCK_JOINTS = Object.freeze({ granite: 'blocky', marble: 'blocky', quartzite: 'blocky', basalt: 'columnar', slate: 'slabby' });
export const LANDFORM_RES = 192;

const D2R = Math.PI / 180;
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const smoother = (t) => { const x = clamp01(t); return x * x * x * (x * (x * 6 - 15) + 10); };
const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

// ─── dice ────────────────────────────────────────────────────────────────────────────────────────────────────
export function hashSeed(seed) {
  if (Number.isFinite(seed)) return Math.floor(seed) >>> 0;
  const s = String(seed ?? 'landform'); let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function h32(i, j, s) { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(s + 1, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; }
/** 2D gradient noise, ≈ [−1, 1]. */
export function gnoise(x, y, s) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const gd = (a, b, px, py) => { const t = h32(a, b, s) * (6.283185307179586 / 4294967296); return Math.cos(t) * px + Math.sin(t) * py; };
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const n00 = gd(i, j, fx, fy), n10 = gd(i + 1, j, fx - 1, fy), n01 = gd(i, j + 1, fx, fy - 1), n11 = gd(i + 1, j + 1, fx - 1, fy - 1);
  const a = n00 + u * (n10 - n00), b = n01 + u * (n11 - n01);
  return (a + v * (b - a)) * 1.41;
}
function fbm1(t, seed, hurst = 0.8, octaves = 5) { let s = 0, n = 0; for (let o = 0; o < octaves; o++) { const a = 2 ** (-o * hurst); s += a * gnoise(t * 2 ** o, 0.5 + o * 7.3, seed + o); n += a; } return s / n; }

// ─── the state ───────────────────────────────────────────────────────────────────────────────────────────────
/** A square-celled grid covering [x0, x1] × [y0, y1] with `res` samples along y (x gets as many as cover it). */
export function landformGrid({ x0, x1, y0, y1, res = LANDFORM_RES }) {
  const dx = (y1 - y0) / (res - 1); const ny = res, nx = Math.ceil((x1 - x0) / dx - 1e-9) + 1; const N = nx * ny;
  return { nx, ny, x0, y0, dx, z: new Float64Array(N), hard: new Float64Array(N), apron: new Float64Array(N), hardFns: [], strata: null, fabric: null, rock: null, scree: [] };
}
export const gridX = (s, i) => s.x0 + i * s.dx;
export const gridY = (s, j) => s.y0 + j * s.dx;
export function bakeGrid(s, heightAt) { for (let j = 0; j < s.ny; j++) for (let i = 0; i < s.nx; i++) s.z[j * s.nx + i] = heightAt(gridX(s, i), gridY(s, j)); return s; }
/** Central-difference gradient of `z` (one-sided at the border). */
export function gridGradient(s, z = s.z) {
  const { nx, ny, dx } = s; const gx = new Float64Array(nx * ny), gy = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = Math.max(0, i - 1), b = Math.min(nx - 1, i + 1), c = Math.max(0, j - 1), d = Math.min(ny - 1, j + 1);
    gx[j * nx + i] = (z[j * nx + b] - z[j * nx + a]) / ((b - a) * dx); gy[j * nx + i] = (z[d * nx + i] - z[c * nx + i]) / ((d - c) * dx);
  }
  return { gx, gy };
}
/** Bilinear read of a per-cell array at (x, y); clamps outside. */
export function gridSample(s, x, y, arr = s.z) {
  const u = Math.min(Math.max((x - s.x0) / s.dx, 0), s.nx - 1), v = Math.min(Math.max((y - s.y0) / s.dx, 0), s.ny - 1);
  const i = Math.min(Math.floor(u), s.nx - 2), j = Math.min(Math.floor(v), s.ny - 2), fu = u - i, fv = v - j, n = s.nx;
  return (arr[j * n + i] * (1 - fu) + arr[j * n + i + 1] * fu) * (1 - fv) + (arr[(j + 1) * n + i] * (1 - fu) + arr[(j + 1) * n + i + 1] * fu) * fv;
}
/** Hardness at cell k if its surface stood at height z: the stamped grid, or a bed registered by strata. */
export function hardnessAt(s, k, z = s.z[k]) {
  let h = s.hard[k]; if (!s.hardFns.length) return h;
  const x = gridX(s, k % s.nx), y = gridY(s, (k / s.nx) | 0); for (const f of s.hardFns) h = Math.max(h, f(x, y, z));
  return h;
}
/** The bed index at (x, y, z), or −1 without strata. */
export function bedAt(s, x, y, z) { return s.strata ? s.strata.find(z - s.strata.off(x, y)) : -1; }

// ─── peaks ───────────────────────────────────────────────────────────────────────────────────────────────────
export function peaks(s, { height, wavelength = 12, sharp = 2, gain = 1.8, warp = 0.3, hurst = null, center = null, radius = null, seed = 1 }) {
  const cross = hurst?.crossover ?? wavelength / 4, Hs = hurst?.small ?? 0.8, Hl = hurst?.large ?? 0.5;
  const octaves = Math.max(1, Math.min(8, Math.floor(Math.log2(wavelength / (3 * s.dx))) + 1));   // none finer than 3 cells: it aliases to needles
  const amps = [...Array(octaves)].map((_, o) => { const L = wavelength / 2 ** o; return cross * (L / cross) ** (L >= cross ? Hl : Hs); });
  const norm = amps.reduce((a, b) => a + b, 0);
  for (let j = 0; j < s.ny; j++) for (let i = 0; i < s.nx; i++) {
    const x = gridX(s, i), y = gridY(s, j); let win = 1;
    if (center) { win = 1 - smoother(Math.hypot(x - center[0], y - center[1]) / radius); if (win <= 0) continue; }
    let px = x / wavelength, py = y / wavelength;
    px += warp * gnoise(px * 0.8 + 11.3, py * 0.8, seed + 900); py += warp * gnoise(px * 0.8, py * 0.8 + 7.1, seed + 901);
    let sum = 0, w = 1;
    for (let o = 0; o < octaves; o++) {
      const f = 2 ** o; let sg = 1 - Math.abs(gnoise(px * f, py * f, seed + o)); sg = Math.max(0, sg) ** sharp * w;
      sum += sg * amps[o]; w = clamp01(sg * gain);
    }
    s.z[j * s.nx + i] += height * win * (sum / norm);
  }
  return s;
}

// ─── strata ──────────────────────────────────────────────────────────────────────────────────────────────────
export function strata(s, { thickness, contrast = 0.9, hardShare = 0.5, jitter = 0.35, dip = 0, dipAz = 0, sharp = 10, tones = null, seed = 1 }) {
  const tanD = Math.tan(dip * D2R), cx = Math.cos(dipAz * D2R), cy = Math.sin(dipAz * D2R);
  const off = (x, y) => tanD * (x * cx + y * cy);
  let lo = Infinity, hi = -Infinity;
  for (let j = 0; j < s.ny; j++) for (let i = 0; i < s.nx; i++) { const v = s.z[j * s.nx + i] - off(gridX(s, i), gridY(s, j)); if (v < lo) lo = v; if (v > hi) hi = v; }
  const r = mulberry32(seed * 7717 + 3); const layers = []; let b = lo - 4 * thickness; let prevHard = false;
  while (b < hi + 4 * thickness) { const t = thickness * (1 + jitter * (2 * r() - 1)); const hard = !prevHard && r() < hardShare; layers.push({ b, t, hard }); prevHard = hard; b += t; }
  const find = (v) => { let a = 0, c = layers.length - 1; while (a < c) { const m = (a + c + 1) >> 1; if (layers[m].b <= v) a = m; else c = m - 1; } return a; };
  const k = 1 + sharp * contrast;
  for (let j = 0; j < s.ny; j++) for (let i = 0; i < s.nx; i++) {
    const q = j * s.nx + i, o = off(gridX(s, i), gridY(s, j)); const v = s.z[q] - o; const L = layers[find(v)];
    const u = clamp01((v - L.b) / L.t); s.z[q] = L.b + L.t * (L.hard ? 1 - (1 - u) ** k : u) + o;
  }
  s.strata = { layers, off, find, tones, dipped: dip !== 0, tanD, cx, cy };
  s.hardFns.push((x, y, z) => (layers[find(z - off(x, y))].hard ? contrast : 0));
  return s;
}

// ─── scarp ───────────────────────────────────────────────────────────────────────────────────────────────────
export function scarp(s, { path, throw: T, face = 75, side = 'left', rough = 0.03, taper = 0.15, seed = 1 }) {
  const segs = []; let total = 0;
  for (let k = 0; k + 1 < path.length; k++) { const a = path[k], b = path[k + 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L > 0) { segs.push({ a, b, L, s0: total }); total += L; } }
  if (!segs.length) return s;
  const W = T / Math.tan(face * D2R); const sgn = side === 'right' ? -1 : 1; const rho = (1.5 * s.dx) / W;
  for (let j = 0; j < s.ny; j++) for (let i = 0; i < s.nx; i++) {
    const x = gridX(s, i), y = gridY(s, j); let best = Infinity, sd = 0, arc = 0;
    segs.forEach((sg, n) => {
      const ux = (sg.b[0] - sg.a[0]) / sg.L, uy = (sg.b[1] - sg.a[1]) / sg.L; const px = x - sg.a[0], py = y - sg.a[1];
      const tRaw = px * ux + py * uy; const t = Math.max(n === 0 ? -Infinity : 0, Math.min(n === segs.length - 1 ? Infinity : sg.L, tRaw));   // the end segments extend
      const d = Math.hypot(px - t * ux, py - t * uy); if (d < best) { best = d; sd = (ux * py - uy * px >= 0 ? 1 : -1) * d; arc = sg.s0 + t; }
    });
    const u = clamp01(arc / total); const tip = taper > 0 ? Math.min(1, Math.min(u, 1 - u) / taper) : 1;
    const v = sgn * sd - rough * total * fbm1(arc / (total / 6), seed + 50); const Tu = T * Math.sqrt(tip);
    if (Tu <= 0) continue;
    const q = j * s.nx + i; s.z[q] += Tu * smooth(-rho, 1 + rho, v / W + 0.5);
    if (Tu > 0.05 * T && v > -0.5 * W - s.dx && v < 0.5 * W + 1.5 * s.dx) s.hard[q] = 1;
  }
  return s;
}

// ─── joints ──────────────────────────────────────────────────────────────────────────────────────────────────
export function joints(s, { pattern = 'blocky', spacing, strike = 0, steep = 38, band = 12, strength = 1, dip = 60, cut = pattern === 'columnar' ? 1.5 : 0.6, lip = 0.08, seed = 1 }) {
  const P = JOINT_PATTERNS[pattern]; const { gx, gy } = gridGradient(s); const z0 = Float64Array.from(s.z); s.fabric = pattern;
  const cs = Math.cos(strike * D2R), sn = Math.sin(strike * D2R); const sx = spacing * P.cell[0], sy = spacing * P.cell[1];
  const toL = (x, y) => [(x * cs + y * sn) / sx, (-x * sn + y * cs) / sy]; const fromL = (u, v) => [u * sx * cs - v * sy * sn, u * sx * sn + v * sy * cs];
  const hex = P.lattice === 'hex';
  const site = (a, b) => {
    const h = h32(a, b, seed * 13 + 5); const jx = ((h & 1023) / 1023 - 0.5) * 0.5, jy = (((h >>> 10) & 1023) / 1023 - 0.5) * 0.5;
    return hex ? fromL(a + 0.5 * (b & 1) + jx * 0.3, b * 0.866 + jy * 0.3) : fromL(a + 0.5 + jx, b + 0.5 + jy);
  };
  const lo = Math.tan((steep - band / 2) * D2R), hi = Math.tan((steep + band / 2) * D2R); const tanDip = Math.tan(dip * D2R); const dipN = [-sn, cs];
  const planes = new Map();
  const planeOf = (a, b) => {
    const key = `${a},${b}`; let pl = planes.get(key); if (pl) return pl;
    const [cx, cy] = site(a, b); const zc = gridSample(s, cx, cy, z0); const gxc = gridSample(s, cx, cy, gx), gyc = gridSample(s, cx, cy, gy);
    const m = Math.hypot(gxc, gyc); let px = 0, py = 0;
    if (P.plane === 'snap' && m > 1e-9) {                              // the aspect snaps to the nearer joint normal, a little steeper
      const along = gxc * cs + gyc * sn, across = -gxc * sn + gyc * cs;
      if (Math.abs(along) >= Math.abs(across)) { px = Math.sign(along) * m * 1.25 * cs; py = Math.sign(along) * m * 1.25 * sn; } else { px = -Math.sign(across) * m * 1.25 * sn; py = Math.sign(across) * m * 1.25 * cs; }
    } else if (P.plane === 'dip') {
      const g = Math.sign(gxc * dipN[0] + gyc * dipN[1]) || 1; px = g * tanDip * dipN[0]; py = g * tanDip * dipN[1];
    } else if (P.plane === 'flat') {
      const h = h32(a, b, seed * 7 + 1); px = ((h & 255) / 255 - 0.5) * 0.12; py = (((h >>> 8) & 255) / 255 - 0.5) * 0.12;
    }
    pl = { cx, cy, zc, px, py }; planes.set(key, pl); return pl;
  };
  // each steep cell's owner (the nearest joint site); a column's top is its cell's lowest ground, so it is flat and only cuts
  const owner = new Array(s.z.length); const floorOf = new Map();
  for (let j = 0; j < s.ny; j++) for (let i = 0; i < s.nx; i++) {
    const q = j * s.nx + i; if (smooth(lo, hi, Math.hypot(gx[q], gy[q])) * strength <= 0) continue;
    const x = gridX(s, i), y = gridY(s, j); const [u, v] = toL(x, y); const a0 = Math.floor(u), b0 = Math.floor(hex ? v / 0.866 : v);
    let best = Infinity, key = null;
    for (let da = -1; da <= 1; da++) for (let db = -1; db <= 1; db++) { const [cx, cy] = site(a0 + da, b0 + db); const d = (cx - x) ** 2 + (cy - y) ** 2; if (d < best) { best = d; key = [a0 + da, b0 + db]; } }
    owner[q] = key; if (P.plane === 'flat') { const kk = `${key[0]},${key[1]}`; floorOf.set(kk, Math.min(floorOf.get(kk) ?? Infinity, z0[q])); }
  }
  for (let j = 0; j < s.ny; j++) for (let i = 0; i < s.nx; i++) {
    const q = j * s.nx + i; const key = owner[q]; if (!key) continue; const w = smooth(lo, hi, Math.hypot(gx[q], gy[q])) * strength;
    const x = gridX(s, i), y = gridY(s, j); const pl = planeOf(key[0], key[1]);
    const zp = P.plane === 'flat' ? floorOf.get(`${key[0]},${key[1]}`) + pl.px * (x - pl.cx) + pl.py * (y - pl.cy) : pl.zc + pl.px * (x - pl.cx) + pl.py * (y - pl.cy);
    const zf = Math.min(z0[q] + lip * spacing, Math.max(z0[q] - cut * spacing, zp));
    s.z[q] = z0[q] + w * (zf - z0[q]); s.hard[q] = Math.max(s.hard[q], w);
  }
  return s;
}

// ─── talus ───────────────────────────────────────────────────────────────────────────────────────────────────
export function talus(s, { angle = 34, cliff = 52, retreat = 0.3, iterations = 120, scree = 0, rmin = 0.08, rmax = 0.5, seed = 1 }) {
  const { nx, ny, dx } = s; const N = nx * ny; const z = s.z; const { gx, gy } = gridGradient(s);
  const tc = Math.tan(cliff * D2R), tr = Math.tan(angle * D2R); const ND = NB.map(([a, b]) => dx * Math.hypot(a, b));
  const loose = new Float64Array(N); let supplied = 0, left = 0;
  for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const k0 = j * nx + i; const sl0 = Math.hypot(gx[k0], gy[k0]); if (sl0 <= tc) continue;
    const v = retreat * sl0; supplied += v; let ci = i, cj = j, gone = false;
    for (let step = 0; step < 4 * (nx + ny); step++) {                  // down the steepest descent until the ground eases
      const k = cj * nx + ci; let best = 0, bi = -1;
      for (let n = 0; n < 8; n++) { const a = ci + NB[n][0], b = cj + NB[n][1]; const g = (z[k] - z[b * nx + a]) / ND[n]; if (g > best) { best = g; bi = n; } }
      if (bi < 0 || best <= tr) break;
      ci += NB[bi][0]; cj += NB[bi][1]; if (ci <= 0 || cj <= 0 || ci >= nx - 1 || cj >= ny - 1) { gone = true; break; }
    }
    if (gone) left += v; else loose[cj * nx + ci] += v;
  }
  const surf = new Float64Array(N), flow = new Float64Array(N), ex = new Float64Array(8);
  for (let it = 0; it < iterations; it++) {
    for (let k = 0; k < N; k++) surf[k] = z[k] + loose[k];
    flow.fill(0);
    for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const k = j * nx + i; if (loose[k] <= 0) continue; let tot = 0;
      for (let n = 0; n < 8; n++) { const q = (j + NB[n][1]) * nx + i + NB[n][0]; const e = surf[k] - surf[q] - tr * ND[n]; ex[n] = e > 0 ? e * 0.125 : 0; tot += ex[n]; }
      if (tot <= 0) continue; const sc = Math.min(1, loose[k] / tot);
      for (let n = 0; n < 8; n++) if (ex[n] > 0) { const q = (j + NB[n][1]) * nx + i + NB[n][0]; const m = ex[n] * sc; flow[k] -= m; flow[q] += m; }
    }
    for (let k = 0; k < N; k++) loose[k] += flow[k];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) { const k = j * nx + i; if (loose[k] > 0) { left += loose[k]; loose[k] = 0; } }   // the edge is the map's outlet
  }
  let maxL = 0;
  for (let k = 0; k < N; k++) if (loose[k] > 1e-6) { z[k] += loose[k]; s.apron[k] += loose[k]; s.hard[k] = 0; if (loose[k] > maxL) maxL = loose[k]; }
  s.talusStats = { supplied, left };
  if (scree > 0 && maxL > 0) {
    const r = mulberry32(seed * 4409 + 1); const D = 2.5; const A = rmin ** -D, B = rmax ** -D;
    for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const k = j * nx + i; const a = s.apron[k]; if (a < 0.03) continue;
      if (r() > scree * Math.min(1, a / 0.6)) continue;
      const u = r(); const distal = 1 - Math.min(1, a / (0.6 * maxL));    // thin distal edge → the big blocks
      const size = (A - (u ** (1 + 2 * (1 - distal))) * (A - B)) ** (-1 / D);
      const x = gridX(s, i) + (r() - 0.5) * dx, y = gridY(s, j) + (r() - 0.5) * dx;
      s.scree.push({ x, y, z0: gridSample(s, x, y), size });
    }
  }
  return s;
}

// ─── the runner ──────────────────────────────────────────────────────────────────────────────────────────────
const OPS = { peaks, strata, scarp, joints, talus };
/** An op's seed: its own, or the scene seed hashed with its index. */
export const opSeed = (op, seed, i) => (op.seed !== undefined ? hashSeed(op.seed) : hashSeed(`${seed}::landform::${i}`)) % 1000003;
/**
 * Run `ops` on the state: declared order, then `erosion` (a spec or true) reading hardness, then every talus op.
 * An op's `rock` (a preset) picks the joint pattern when `pattern` is absent.
 */
export function applyLandform(s, ops, { seed = 'landform', erosion = null } = {}) {
  const deferred = [];
  ops.forEach((op, i) => {
    const { op: kind, rock, ...params } = op; const p = { ...params, seed: opSeed(op, seed, i) };
    if (kind === 'joints' && !p.pattern && rock) p.pattern = ROCK_JOINTS[rock] || 'blocky';
    if (rock && !s.rock) s.rock = rock;                               // the first rock named colours the stone
    if (kind === 'talus') deferred.push(p); else OPS[kind](s, p);
  });
  if (erosion) {
    const spec = erosion === true ? {} : erosion;
    const { z } = erodeHeightfield(s.z, s.nx, s.ny, s.dx, spec, { hardness: (k, zk) => hardnessAt(s, k, zk) });
    s.z.set(z);
  }
  for (const p of deferred) talus(s, p);
  return s;
}

// ─── validation ──────────────────────────────────────────────────────────────────────────────────────────────
const isPt = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
/** Errors (strings) for a `landform` list; [] when it runs. */
export function validateLandform(list, at = 'landform') {
  if (!Array.isArray(list) || !list.length) return [`${at} must be a non-empty list of operations: [{ op: ${LANDFORM_OPS.join(' | ')}, … }], applied in order`];
  const errs = [];
  list.forEach((op, i) => {
    const here = `${at}[${i}]`;
    if (!op || typeof op !== 'object' || Array.isArray(op)) { errs.push(`${here} must be an object { op, … }`); return; }
    if (!LANDFORM_OPS.includes(op.op)) { errs.push(`${here}.op must be one of ${LANDFORM_OPS.join(', ')} (got ${JSON.stringify(op.op)})`); return; }
    const num = (k, lo, hi, what, req = false) => { const v = op[k]; if (v === undefined) { if (req) errs.push(`${here}.${k} is required: ${what}`); return; } if (!(Number.isFinite(v) && v >= lo && v <= hi)) errs.push(`${here}.${k} must be ${what}`); };
    if (op.seed !== undefined && !(Number.isFinite(op.seed) || typeof op.seed === 'string')) errs.push(`${here}.seed must be a number or string`);
    if (op.op === 'peaks') {
      num('height', 0.01, 100, 'the peaks\' height in the terrain\'s units, 0.01–100', true);
      num('wavelength', 0.5, 200, 'the main ridge spacing, 0.5–200 (12 default)');
      num('sharp', 0.5, 4, '0.5–4, how knife-edged the ridges are (2 default)');
      if ((op.center === undefined) !== (op.radius === undefined)) errs.push(`${here}: center and radius go together (a massif), or neither (everywhere)`);
      if (op.center !== undefined && !isPt(op.center)) errs.push(`${here}.center must be [x, y]`);
      num('radius', 0.1, 500, 'the massif\'s radius, > 0');
    } else if (op.op === 'strata') {
      num('thickness', 0.02, 50, 'the mean bed thickness in height units, 0.02–50', true);
      num('contrast', 0, 1, '0–1: how much harder the hard beds are (0.9 default; 0 is plain terracing)');
      num('hardShare', 0, 1, '0–1: the share of hard beds (0.5 default)');
      num('dip', 0, 60, 'the beds\' tilt in degrees, 0–60');
      num('dipAz', -360, 360, 'the direction the beds dip toward, in degrees');
      if (op.tones !== undefined && !(Array.isArray(op.tones) && op.tones.length && op.tones.every((t) => typeof t === 'string' && /^#[0-9a-f]{6}$/i.test(t)))) errs.push(`${here}.tones must be a list of '#rrggbb' colours, one per bed in turn`);
    } else if (op.op === 'scarp') {
      if (!Array.isArray(op.path) || op.path.length < 2 || !op.path.every(isPt)) errs.push(`${here}.path must be [[x, y], [x, y], …] with at least two points (the cliff line, in the terrain's coordinates)`);
      num('throw', 0.01, 100, 'how much higher the raised side stands, 0.01–100', true);
      num('face', 30, 89, 'the face angle in degrees, 30–89 (75 default)');
      if (op.side !== undefined && op.side !== 'left' && op.side !== 'right') errs.push(`${here}.side must be 'left' or 'right' (the raised side, walking the path)`);
      num('rough', 0, 0.2, '0–0.2: how far the trace wanders, as a share of its length (0.03 default)');
      num('taper', 0, 0.5, '0–0.5: the share of the path at each end over which the throw dies away (0.15 default)');
    } else if (op.op === 'joints') {
      if (op.pattern !== undefined && !JOINT_PATTERNS[op.pattern]) errs.push(`${here}.pattern must be one of ${Object.keys(JOINT_PATTERNS).join(', ')}`);
      if (op.rock !== undefined && !ROCK_JOINTS[op.rock]) errs.push(`${here}.rock must be one of ${Object.keys(ROCK_JOINTS).join(', ')} (it picks the pattern)`);
      num('spacing', 0.05, 50, 'the joint spacing (the block size), 0.05–50', true);
      num('strike', -360, 360, 'the joint set\'s bearing in degrees');
      num('steep', 10, 80, 'the slope in degrees above which ground breaks into facets, 10–80 (38 default)');
    } else if (op.op === 'talus') {
      num('angle', 20, 45, 'the angle of repose in degrees, 20–45 (34 default)');
      num('retreat', 0, 5, 'how thick a skin the faces have shed, 0–5 (0.3 default)');
      num('cliff', 35, 85, 'the slope in degrees that counts as a face, 35–85 (52 default)');
      num('scree', 0, 1, 'the density of scree fragments on the apron, 0–1 (0: none)');
    }
  });
  return errs;
}
