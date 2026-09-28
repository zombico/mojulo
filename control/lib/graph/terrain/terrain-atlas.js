/**
 * terrain-atlas — a terrain world composed from named features at real scale, in the fractal city's order.
 *
 *   ANCHOR FIRST. The first feature is the anchor; its size band (a real-world one: a great river is 1,500–4,000 km,
 *   a lake 15–60 km, a cordillera 1,500–5,000 km) sets the frame's span. So the scale follows from what is asked for.
 *   RESERVED BEFORE THE NETWORK. Every declared feature is placed on the frame before any drainage: a coast turns a
 *   side into sea past a fractal shoreline, a range lays its spine, a plateau its rim, a volcano its cone, a lake its
 *   basin (with a rim the water can leave only by its outlet). Later features take the place that overlaps the earlier
 *   ones least (the city's side seat), or the place the anchor gives them (a range where the river rises, a lake on its
 *   course). A declared river is a corridor laid before the network: a fractal path from its source to its mouth with
 *   a concave long profile that never climbs, carved as a valley through whatever it crosses.
 *   THE NETWORK IS THE SKELETON. Erosion (stream power on a flooded surface, terrain-erosion.js's priority-flood and D8
 *   drainage) grows the tributaries around the reserved corridor; lakes are where the flood stands; rivers are traced
 *   from the accumulation, their widths from hydraulic geometry (w = a·A^0.4, `a` calibrated so the anchor's mouth
 *   sits in its band), their water levels from the flood, never rising downstream.
 *   LEFTOVER IS COUNTRY. What no feature claims is the continent's own relief: a rise from the coast and a noise
 *   ladder whose amplitudes follow one spectrum at every scale (so the relief a level bakes and the detail the kernel
 *   adds below it are the same law).
 *   RECURSE TOWARD WHAT MATTERS. The plan is a stack of 256² levels, each an eighth the width of its parent and centred
 *   on the focus (where you stand): the parent upsampled plus the band of the composition it could not hold, eroded
 *   again with the parent's rivers flowing in at its edge, its own smaller rivers traced. Until a cell is ~16 m. So
 *   the ground is planned at metres where you walk and at kilometres where you only fly.
 *
 * The kernel (atlas-kernel.js) reads the levels, the rivers and the water, and adds the ladder's octaves below the
 * finest level at each point. Deterministic: a seeded composition, typed arrays, no clock.
 */
import { priorityFlood, drainage } from '../polygonizer/terrain-erosion.js';
import { atlasKernel } from './atlas-kernel.js';

// ── the size bands: metres; the first size of each feature is its default ────────────────────────────────────────────
export const ATLAS_SIZES = Object.freeze({
  river: { river: { length: [150e3, 600e3], mouth: [60, 250] }, stream: { length: [5e3, 30e3], mouth: [3, 12] }, great: { length: [1500e3, 4000e3], mouth: [800, 2000] } },
  range: { range: { length: [150e3, 500e3], width: [60e3, 150e3], peak: [2000, 3500] }, ridge: { length: [10e3, 40e3], width: [3e3, 10e3], peak: [400, 1000] }, cordillera: { length: [1500e3, 5000e3], width: [200e3, 600e3], peak: [4000, 6500] } },
  lake: { lake: { length: [15e3, 60e3], depth: [50, 300] }, tarn: { length: [300, 1500], depth: [10, 40] }, great: { length: [150e3, 550e3], depth: [150, 600] } },
  plateau: { plateau: { size: [20e3, 80e3], height: [300, 1200] }, mesa: { size: [1e3, 8e3], height: [100, 400] }, tableland: { size: [200e3, 600e3], height: [1000, 2500] } },
  volcano: { volcano: { base: [20e3, 40e3], height: [2000, 4000] }, cone: { base: [2e3, 6e3], height: [200, 800] }, shield: { base: [80e3, 150e3], height: [3000, 4500] } },
});
export const ATLAS_FEATURES = Object.freeze([...Object.keys(ATLAS_SIZES), 'coast']);
export const ATLAS_SIDES = Object.freeze({ N: [0, 1], S: [0, -1], E: [1, 0], W: [-1, 0] });
const ALONG = { NS: [0, 1], EW: [1, 0], NE: [0.7071, 0.7071], NW: [-0.7071, 0.7071] };
const LEVEL_N = 256, RATIO = 8, FINEST = 16, MAX_LEVELS = 6, MIN_L = 0.5;

const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const ramp = (a, b, c, d, gamma = 1) => ({ stops: [a, b, c, d].map(rgb), pos: [0, 1 / 3, 2 / 3, 1], gamma });
export const ATLAS_CLIMATES = Object.freeze({
  temperate: { snow: 3100, tree: 1900, sky: { zenith: [96, 146, 206], horizon: [196, 214, 226], day: 1 },
    ramps: { forest: ramp('#1c2c16', '#2f4724', '#435f31', '#5d7a44'), low: ramp('#2c3f1f', '#4d6a31', '#6f8c45', '#98ad62'), high: ramp('#3b3a27', '#6b6844', '#8f8a5c', '#b3ac80'), rock: ramp('#3f3c38', '#6e6962', '#958f86', '#bdb7ad'), snow: ramp('#8e9aa8', '#c9d3dc', '#e8eef2', '#fbfdff'), sand: ramp('#6f6450', '#a8977a', '#c9b995', '#e2d6b4'), water: ramp('#1f4a5e', '#2f6a80', '#3f7f93', '#5c97a8'), deep: ramp('#0e2638', '#163a52', '#1d4964', '#285a76'), silt: ramp('#4d5a45', '#6d7657', '#8a8e68', '#a3a47c') } },
  arid: { snow: 4600, tree: 2600, sky: { zenith: [110, 160, 214], horizon: [226, 214, 190], day: 1 },
    ramps: { forest: ramp('#3c3a22', '#5c5a36', '#77744a', '#96915f'), low: ramp('#5a4127', '#8f6a40', '#b58c5a', '#d4ae7c'), high: ramp('#4f3a2c', '#7e5f47', '#a07c5e', '#c29f80'), rock: ramp('#4a2f24', '#7f4f3a', '#a86b4e', '#cf9270'), snow: ramp('#9aa2ab', '#d0d6db', '#eceff1', '#fdfdfd'), sand: ramp('#8a7253', '#c2a57c', '#dcc29a', '#efdcb8'), water: ramp('#244d5c', '#346b7a', '#478393', '#63a0ae'), deep: ramp('#10283a', '#183d53', '#214c66', '#2c5d78'), silt: ramp('#6e5c44', '#907a5a', '#a99270', '#c0a986') } },
  alpine: { snow: 2700, tree: 1700, sky: { zenith: [80, 132, 200], horizon: [190, 208, 224], day: 1 },
    ramps: { forest: ramp('#152419', '#26392a', '#38503b', '#4f6a50'), low: ramp('#243a22', '#3f5e33', '#5c7c47', '#809d63'), high: ramp('#3a3d2f', '#646750', '#86886d', '#a9aa8e'), rock: ramp('#3a3a3c', '#66666a', '#8e8e92', '#b8b8bb'), snow: ramp('#8c99a9', '#cbd5df', '#e9eff4', '#fcfeff'), sand: ramp('#5f5c52', '#908b7c', '#b3ad9b', '#d2ccba'), water: ramp('#1c4e63', '#2a6f86', '#3c879b', '#58a1b2'), deep: ramp('#0b2536', '#12384f', '#1a4861', '#245a74'), silt: ramp('#4f5d52', '#6e7b6c', '#889381', '#a1aa96') } },
  tropical: { snow: 4900, tree: 3300, sky: { zenith: [84, 150, 214], horizon: [206, 224, 226], day: 1 },
    ramps: { forest: ramp('#0e2410', '#1a3d1a', '#285627', '#3b7237'), low: ramp('#173717', '#2a5a23', '#3f7a31', '#5c9a45'), high: ramp('#23391f', '#3d5d34', '#577a49', '#789a63'), rock: ramp('#3b342d', '#665b50', '#8a7e70', '#b0a392'), snow: ramp('#909ba7', '#cbd4dc', '#e8eef2', '#fbfdff'), sand: ramp('#7a6b4f', '#b6a27a', '#d4c29a', '#ebdcba'), water: ramp('#15515e', '#207482', '#2f8c98', '#4aa6ae'), deep: ramp('#0a2a38', '#0f4052', '#165166', '#1f6379'), silt: ramp('#5a5536', '#7d774d', '#999260', '#b1aa75') } },
  boreal: { snow: 1500, tree: 900, sky: { zenith: [92, 128, 176], horizon: [192, 204, 214], day: 1 },
    ramps: { forest: ramp('#131e16', '#223326', '#324836', '#46604a'), low: ramp('#1e2d1f', '#344a33', '#4a6446', '#6a825f'), high: ramp('#35382f', '#5b5f50', '#7c806c', '#9fa28c'), rock: ramp('#38393b', '#626468', '#898b8f', '#b1b3b6'), snow: ramp('#8d98a6', '#c8d1db', '#e6ecf1', '#fafcfe'), sand: ramp('#5a584e', '#8a8676', '#aca795', '#cac5b2'), water: ramp('#1b3f52', '#285a6f', '#377085', '#4f8a9d'), deep: ramp('#0a1f2e', '#102f43', '#173d53', '#204d65'), silt: ramp('#454c41', '#646b5b', '#7e8472', '#979c88') } },
});

// ── dice and noise ───────────────────────────────────────────────────────────────────────────────────────────────────
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hashSeed(seed) {
  if (Number.isFinite(seed)) return Math.floor(seed) >>> 0;
  const t = String(seed ?? 'atlas'); let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0;
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const pick = (rng, [lo, hi]) => lo * (hi / lo) ** (0.3 + 0.4 * rng());   // geometric, within the band's middle
/** The noise ladder: wavelengths S/2 down to half a metre, amplitudes on one spectrum (H 0.75 below 10 km, 0.3 above). */
export function noiseLadder(S) {
  const sig = (L) => (L <= 1e4 ? 22 * (L / 1000) ** 0.75 : 22 * 10 ** 0.75 * (L / 1e4) ** 0.3);
  const out = []; for (let L = S / 2; L >= MIN_L; L /= 2) out.push([L, sig(L)]); return out;
}
const cutOf = (oct, dx) => { let k = 0; while (k < oct.length && oct[k][0] >= 2 * dx) k++; return k; };

// ── validation ───────────────────────────────────────────────────────────────────────────────────────────────────────
const isPt = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
/** Errors (strings) for `world`; [] when it composes. */
export function validateAtlas(w, at = 'terrain.world') {
  if (!w || typeof w !== 'object' || Array.isArray(w)) return [`${at} must be { features: [{ feature, size? }…], climate?, focus?, seed? }`];
  const e = [];
  if (!Array.isArray(w.features) || !w.features.length) e.push(`${at}.features must be a non-empty list: the first is the anchor, and its size sets the world's (${ATLAS_FEATURES.join(', ')})`);
  else {
    if (w.features.every((f) => f && f.feature === 'coast')) e.push(`${at}.features needs one feature besides coasts: a coast is the edge of something`);
    w.features.forEach((f, i) => {
      const here = `${at}.features[${i}]`;
      if (!f || typeof f !== 'object') { e.push(`${here} must be { feature, size? }`); return; }
      if (!ATLAS_FEATURES.includes(f.feature)) { e.push(`${here}.feature must be one of ${ATLAS_FEATURES.join(', ')}`); return; }
      if (f.feature === 'coast') { if (f.side !== undefined && !ATLAS_SIDES[f.side]) e.push(`${here}.side must be N, E, S or W`); return; }
      const sizes = Object.keys(ATLAS_SIZES[f.feature]);
      if (f.size !== undefined && !sizes.includes(f.size)) e.push(`${here}.size must be one of ${sizes.join(', ')} (${sizes[0]} default)`);
      if (f.length !== undefined && !(Number.isFinite(f.length) && f.length >= 200 && f.length <= 6e6)) e.push(`${here}.length must be metres, 200–6000000 (overrides the size band)`);
      if (f.along !== undefined && !ALONG[f.along]) e.push(`${here}.along must be NS, EW, NE or NW`);
      if (f.at !== undefined && !isPt(f.at)) e.push(`${here}.at must be [x, y]: fractions of the frame, −0.5…0.5`);
    });
  }
  if (w.climate !== undefined && !ATLAS_CLIMATES[w.climate]) e.push(`${at}.climate must be one of ${Object.keys(ATLAS_CLIMATES).join(', ')}`);
  if (w.focus !== undefined && !isPt(w.focus)) e.push(`${at}.focus must be [x, y] in metres (where the plan is finest and the walk starts)`);
  return e;
}

// ── geometry ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// midpoint displacement between two points: a fractal path, `amp` of the chord at the first split, `decay` per split
function fractalPath(a, b, rng, { depth = 7, amp = 0.18, decay = 0.55 } = {}) {
  let pts = [a, b], A = amp;
  for (let d = 0; d < depth; d++) {
    const nx = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const p = pts[i], q = pts[i + 1], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy), o = (rng() * 2 - 1) * A * L;
      nx.push(p, [(p[0] + q[0]) / 2 - (dy / (L || 1)) * o, (p[1] + q[1]) / 2 + (dx / (L || 1)) * o]);
    }
    nx.push(pts[pts.length - 1]); pts = nx; A *= decay;
  }
  return pts;
}
function resample(pts, step) {
  const out = [pts[0]]; let carry = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const p = pts[i], q = pts[i + 1], L = Math.hypot(q[0] - p[0], q[1] - p[1]); let s = step - carry;
    while (s <= L) { out.push([p[0] + ((q[0] - p[0]) * s) / L, p[1] + ((q[1] - p[1]) * s) / L]); s += step; }
    carry = L - (s - step);
  }
  const last = pts[pts.length - 1], tail = out[out.length - 1]; if (Math.hypot(last[0] - tail[0], last[1] - tail[1]) > step * 0.25) out.push(last); else out[out.length - 1] = last;
  return out;
}
/** Nearest point on a polyline (with a coarse bucket skip): → [distance, along-fraction 0..1, segment index]. */
function polyNear(P, x, y) {
  let best = Infinity, bi = 0, bt = 0;
  for (let i = 0; i + 1 < P.pts.length; i++) {
    const a = P.pts[i], b = P.pts[i + 1], ex = b[0] - a[0], ey = b[1] - a[1], ll = ex * ex + ey * ey;
    let t = ll > 0 ? ((x - a[0]) * ex + (y - a[1]) * ey) / ll : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = a[0] + ex * t - x, dy = a[1] + ey * t - y, d = dx * dx + dy * dy; if (d < best) { best = d; bi = i; bt = t; }
  }
  return [Math.sqrt(best), (P.cum[bi] + bt * (P.cum[bi + 1] - P.cum[bi])) / P.cum[P.cum.length - 1], bi];
}
const withCum = (pts) => { const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, cum }; };

// ── the composition ──────────────────────────────────────────────────────────────────────────────────────────────────
function extentOf(f, v) {
  switch (f.feature) {
    case 'river': return v.length / 1.25;
    case 'range': return v.length * 1.15;
    case 'lake': return v.length * 3;
    case 'plateau': return v.size * 2.6;
    case 'volcano': return v.base * 4;
    default: return 0;
  }
}
function sizeOf(f, rng) {
  const bands = ATLAS_SIZES[f.feature], size = f.size || Object.keys(bands)[0], b = bands[size], v = { name: size };
  for (const [k, band] of Object.entries(b)) v[k] = pick(rng, band);
  if (Number.isFinite(f.length)) { const key = 'length' in b ? 'length' : 'size' in b ? 'size' : 'base'; const k = f.length / v[key]; v[key] = f.length; for (const kk of ['width']) if (v[kk]) v[kk] *= k; }
  return v;
}

/**
 * Place the features and return the analytic composition `A(x, y, cut)`: every declared shape with the noise ladder's
 * octaves [0, cut). Pure given (world, seed).
 */
function planFeatures(world) {
  const seed = hashSeed(world.seed ?? 'atlas'), rng = mulberry32(seed);
  const feats = world.features.map((f) => ({ ...f, v: f.feature === 'coast' ? null : sizeOf(f, rng) }));
  const anchor = feats.find((f) => f.feature !== 'coast');
  const S = Math.max(2000, Math.min(6e6, extentOf(anchor, anchor.v))), H = S / 2;
  const tierH = S > 8e5 ? 520 : S > 5e4 ? 260 : S > 5e3 ? 90 : 30;       // the interior's height above the sea
  const oct = noiseLadder(S), K0 = { oct, seed: seed % 100003, levels: [] }, NZ = atlasKernel(K0);
  const coasts = feats.filter((f) => f.feature === 'coast').map((f) => ({ side: f.side || 'S' }));
  const claims = [];                                                        // footprints, for the least-overlap seat
  const overlap = (r) => claims.reduce((s, c) => s + Math.max(0, Math.min(r[2], c[2]) - Math.max(r[0], c[0])) * Math.max(0, Math.min(r[3], c[3]) - Math.max(r[1], c[1])), 0);
  const seatFor = (half, prefer = null) => {
    const cands = [[0, 0], [-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]].map(([a, b]) => [a * S, b * S]);
    if (prefer) cands.unshift(prefer);
    let best = null; for (const c of cands) { const r = [c[0] - half, c[1] - half, c[0] + half, c[1] + half], o = overlap(r); if (!best || o < best.o - 1e-6) best = { c, o }; }
    return best.c;
  };
  const rot = (u, a) => [u[0] * Math.cos(a) - u[1] * Math.sin(a), u[0] * Math.sin(a) + u[1] * Math.cos(a)];
  const coastDir = coasts.length ? ATLAS_SIDES[coasts[0].side] : null;
  // the river's mouth side: the first coast, else south; its source: the far side
  const mouthDir = coastDir || [0, -1];
  const placed = { ranges: [], lakes: [], plateaus: [], volcanoes: [], rivers: [] };
  const rangeAt = (f, centre, axis) => {
    const L = f.v.length, W = f.v.width, pts = []; for (let i = 0; i <= 6; i++) { const t = i / 6 - 0.5, j = (rng() * 2 - 1) * 0.06 * L; pts.push([centre[0] + axis[0] * t * L - axis[1] * j, centre[1] + axis[1] * t * L + axis[0] * j]); }
    const r = { ...withCum(pts), W, peak: f.v.peak, seed: (seed + 17 * (placed.ranges.length + 1)) % 100003 }; placed.ranges.push(r);
    claims.push([centre[0] - L / 2, centre[1] - W, centre[0] + L / 2, centre[1] + W]); return r;
  };
  const lakeAt = (f, centre, dirAng) => {
    const a = f.v.length / 2, asp = 1.4 + rng() * 2.1, b = a / asp, ang = dirAng ?? rng() * Math.PI;
    const k = { c: centre, a, b, ang, depth: f.v.depth, seed: (seed + 31 * (placed.lakes.length + 1)) % 100003 }; placed.lakes.push(k);
    claims.push([centre[0] - a, centre[1] - a, centre[0] + a, centre[1] + a]); return k;
  };
  const edgePoint = (dir, lateral) => [dir[0] * H * 0.97 - dir[1] * lateral, dir[1] * H * 0.97 + dir[0] * lateral];
  const coastLine = (dir) => [dir[0] * (H - 0.15 * S), dir[1] * (H - 0.15 * S)];
  // the anchor, then the rest in declared order
  for (const f of feats) {
    if (f.feature === 'coast') continue;
    const isAnchor = f === anchor; const at = isPt(f.at) ? [f.at[0] * S, f.at[1] * S] : null;
    const axis = f.along ? ALONG[f.along] : null;
    if (f.feature === 'range') {
      const riv = placed.rivers[0];
      if (isAnchor || !riv) { const ax = axis || (coastDir ? [coastDir[1], -coastDir[0]] : rot([1, 0], rng() * Math.PI)); const c = at || (isAnchor ? [0, 0] : (coastDir ? [-coastDir[0] * 0.28 * S, -coastDir[1] * 0.28 * S] : seatFor(f.v.width))); rangeAt(f, c, ax); }
      else { const s = riv.pts[0], d = [riv.pts[1][0] - s[0], riv.pts[1][1] - s[1]], l = Math.hypot(...d); rangeAt(f, at || [s[0] - (d[0] / l) * 0.2 * f.v.width, s[1] - (d[1] / l) * 0.2 * f.v.width], axis || [-d[1] / l, d[0] / l]); }
    } else if (f.feature === 'lake') {
      const riv = placed.rivers[0];
      if (!isAnchor && riv && !at) { const i = Math.floor(riv.pts.length * (0.5 + 0.2 * rng())), p = riv.pts[i], q = riv.pts[Math.min(riv.pts.length - 1, i + 3)]; const k = lakeAt(f, p, Math.atan2(q[1] - p[1], q[0] - p[0])); riv.lakes.push(k); }
      else lakeAt(f, at || (isAnchor ? [0.04 * S * (rng() - 0.5), 0.04 * S * (rng() - 0.5)] : seatFor(f.v.length / 2)));
    } else if (f.feature === 'plateau') {
      const c = at || (isAnchor ? [0, 0] : seatFor(f.v.size / 2)); placed.plateaus.push({ c, r: f.v.size / 2, h: f.v.height, seed: (seed + 43 * (placed.plateaus.length + 1)) % 100003 }); claims.push([c[0] - f.v.size / 2, c[1] - f.v.size / 2, c[0] + f.v.size / 2, c[1] + f.v.size / 2]);
    } else if (f.feature === 'volcano') {
      const c = at || (isAnchor ? [0, 0] : seatFor(f.v.base / 2)); placed.volcanoes.push({ c, rb: f.v.base / 2, h: f.v.height, shield: f.v.name === 'shield', seed: (seed + 59 * (placed.volcanoes.length + 1)) % 100003 }); claims.push([c[0] - f.v.base / 2, c[1] - f.v.base / 2, c[0] + f.v.base / 2, c[1] + f.v.base / 2]);
    } else if (f.feature === 'river') {
      // source on the far side (or a range's flank, or a lake), mouth at the coast (or the anchor lake, or the edge)
      const lake = !isAnchor && placed.lakes[0] ? placed.lakes[0] : null, range = placed.ranges[0];
      const chord = Math.min(f.v.length / 1.3, 0.94 * S);
      let mouth = lake ? lake.c : coastDir ? [...coastLine(coastDir)] : edgePoint(mouthDir, 0);
      if (!lake) { const lat = (rng() - 0.5) * 0.35 * S; mouth = [mouth[0] - mouthDir[1] * lat, mouth[1] + mouthDir[0] * lat]; }
      // the source: on a range's flank when there is a range, else `chord` upstream (inland from the coast, or across the
      // frame from the lake it feeds)
      let src;
      if (range && !isAnchor) { const m = range.pts[3]; src = [m[0] + (mouth[0] - m[0]) * 0.12, m[1] + (mouth[1] - m[1]) * 0.12]; }
      else {
        let dir = lake ? [lake.c[0], lake.c[1]] : [mouthDir[0], mouthDir[1]]; let l = Math.hypot(...dir);
        if (l < 1e-9) { const a = rng() * 2 * Math.PI; dir = [Math.cos(a), Math.sin(a)]; l = 1; }
        src = [mouth[0] - (dir[0] / l) * chord, mouth[1] - (dir[1] / l) * chord];
      }
      src = [Math.max(-0.47 * S, Math.min(0.47 * S, src[0])), Math.max(-0.47 * S, Math.min(0.47 * S, src[1]))];
      const pts = fractalPath(src, mouth, rng, { depth: 8, amp: 0.24, decay: 0.62 }).map((p) => [Math.max(-0.48 * S, Math.min(0.48 * S, p[0])), Math.max(-0.48 * S, Math.min(0.48 * S, p[1]))]);
      placed.rivers.push({ ...withCum(pts), mouthW: f.v.mouth, size: f.v.name, lakes: [], toLake: lake, toSea: !lake && !!coastDir, declared: true });
    }
  }
  // an anchor lake drains: an outlet river from its shore to the coast or the lowest side, a tenth of the lake's size wide in metres per km
  if (anchor.feature === 'lake' && !placed.rivers.length) {
    const k = placed.lakes[0], dir = coastDir || mouthDir, mouth = coastDir ? coastLine(coastDir) : edgePoint(dir, 0);
    const start = [k.c[0] + dir[0] * k.a * 0.8, k.c[1] + dir[1] * k.a * 0.8];
    const pts = fractalPath(start, mouth, rng, { depth: 7, amp: 0.15 }).map((p) => [Math.max(-0.48 * S, Math.min(0.48 * S, p[0])), Math.max(-0.48 * S, Math.min(0.48 * S, p[1]))]);
    placed.rivers.push({ ...withCum([k.c, ...pts]), mouthW: Math.max(20, Math.min(2500, k.a / 150)), size: 'outlet', lakes: [k], toLake: null, toSea: !!coastDir, declared: true, fromLake: k });
  }
  // ── the shapes ──
  const coastZ = (x, y, cut) => {
    let z = Infinity;
    for (const c of coasts) {
      const d = ATLAS_SIDES[c.side], along = -d[1] * x + d[0] * y, dist = H - (d[0] * x + d[1] * y);
      const wig = (0.05 * S * NZ.band(along, 1.3e7, 1, Math.min(cut, 10))) / (1.6 * oct[1][1]);
      const dc = dist - 0.15 * S + wig;
      const zc = dc >= 0 ? tierH * (1 - Math.exp(-dc / (0.18 * S))) : -150 * smooth(0, 0.03 * S, -dc) - 2800 * smooth(0.03 * S, 0.12 * S, -dc) - 5;
      if (zc < z) z = zc;
    }
    return z;
  };
  const baseZ = (x, y, cut) => {
    const zc = coasts.length ? coastZ(x, y, cut) : 0.6 * tierH - 0.3 * tierH * ((x * mouthDir[0] + y * mouthDir[1]) / H);
    const land = coasts.length ? smooth(-0.02 * S, 0.02 * S, zc) : 1;
    return zc + land * NZ.band(x, y, 0, cut);
  };
  // ridged multifractal from W/3 down: normalised by the whole ladder below W/3 (not by the octaves a level holds), so a
  // finer level only ADDS its octaves and the levels agree on everything coarser
  // the longest ridge wavelength is the main valleys' spacing, about half the range's half-width (Hovius 1996); the
  // shorter ones keep two thirds of the amplitude each, so side ridges and gullies stand out
  const ridged = (x, y, W, cut, sd) => {
    let v = 0, n = 0, a = 1; const ox = (sd % 97) * 1.37e5, oy = (sd % 89) * -2.11e5;
    for (let k = 0; k < oct.length; k++) {
      if (oct[k][0] > W / 4.3) continue;
      if (k < cut) { const r = 1 - Math.abs(NZ.band(x + ox, y + oy, k, k + 1) / oct[k][1]); v += a * r * r; }
      n += a; a *= 0.66;
    }
    return n ? v / n : 0.5;
  };
  const featuresZ = (x, y, cut) => {
    let z = 0;
    for (const R of placed.ranges) {
      const [d, t] = polyNear(R, x, y); if (d > 1.6 * R.W) continue;
      const env = Math.exp(-2 * (d / (R.W / 2)) ** 2) * smooth(0, 0.14, t) * smooth(1, 0.86, t);
      // valleys cut deep between sharp crests: the ridged value raised to 1.4 (a floor at 6 % of the peak inside the core)
      z += R.peak * env * (0.06 + 1.15 * ridged(x, y, R.W, cut, R.seed) ** 1.4) + 0.14 * R.peak * Math.exp(-((d / R.W) ** 2)) * smooth(0, 0.1, t) * smooth(1, 0.9, t);
    }
    for (const P of placed.plateaus) {
      const d = Math.hypot(x - P.c[0], y - P.c[1]); if (d > 1.5 * P.r) continue;
      const edge = P.r * (1 + 0.22 * NZ.band(x * 1.7 + 911, y * 1.7, Math.max(0, cutOf(oct, P.r / 2) - 1), Math.min(cut, cutOf(oct, P.r / 60))) / 200);
      z += P.h * smooth(-0.012 * P.r, 0.012 * P.r, edge - d);
    }
    for (const V of placed.volcanoes) {
      const d = Math.hypot(x - V.c[0], y - V.c[1]); if (d > V.rb) continue;
      z += V.h * (1 - d / V.rb) ** (V.shield ? 1.1 : 1.7);
      if (d > 0.06 * V.rb) { const th = Math.atan2(y - V.c[1], x - V.c[0]), wob = NZ.band(d * 0.8 + 3.3e5, V.seed, 2, Math.min(cut, 12)) / (2 * oct[2][1]); let g = 0; for (const [m, a] of [[23, 1], [47, 0.5], [97, 0.25]]) g += a * (1 - Math.abs(Math.sin(m * th / 2 + wob * m * 0.3))) ** 3; z -= 0.035 * V.h * (d / V.rb) * (1 - d / V.rb) * 4 * g; }
      const cr = 0.05 * V.rb; if (d < cr && !V.shield) z -= 0.09 * V.h * (1 - (d / cr) ** 2);
    }
    return z;
  };
  const A0 = (x, y, cut) => baseZ(x, y, cut) + featuresZ(x, y, cut);
  // lakes: a basin below its level, a rim the water can leave only where a river cuts it
  for (const k of placed.lakes) {
    let lo = Infinity; for (let i = 0; i < 24; i++) { const a = (i / 24) * 2 * Math.PI, p = [k.c[0] + Math.cos(a) * Math.cos(k.ang) * k.a - Math.sin(a) * Math.sin(k.ang) * k.b, k.c[1] + Math.cos(a) * Math.sin(k.ang) * k.a + Math.sin(a) * Math.cos(k.ang) * k.b]; lo = Math.min(lo, A0(p[0], p[1], 6)); }
    k.level = Math.max(coasts.length ? 2 : -1e9, lo - 0.02 * k.depth);
  }
  const lakeRho = (k, x, y, cut) => {
    const dx = x - k.c[0], dy = y - k.c[1], u = (dx * Math.cos(k.ang) + dy * Math.sin(k.ang)) / k.a, v = (-dx * Math.sin(k.ang) + dy * Math.cos(k.ang)) / k.b;
    const rho = Math.sqrt(u * u + v * v); if (rho > 1.8) return rho;
    const k0 = cutOf(oct, k.b); return rho * (1 + (0.16 * NZ.band(x + 7.7e5, y - 3.1e5, k0, Math.min(cut, cutOf(oct, k.b / 40)))) / (1.5 * oct[Math.min(oct.length - 1, k0)][1]));
  };
  // the declared rivers' long profiles: concave from source to mouth, never above the ground upstream of any point. A
  // lake on a river stands where the river enters it (the first pass), and the river crosses it flat (the second)
  const profile = (R, withLakes) => {
    const n = R.pts.length, zs = A0(R.pts[0][0], R.pts[0][1], 5), zm = R.toLake ? R.toLake.level : R.toSea ? 0 : Math.min(zs, A0(R.pts[n - 1][0], R.pts[n - 1][1], 5)) - 5;
    const prof = []; let run = zs;
    for (let i = 0; i < n; i++) {
      const t = R.cum[i] / R.cum[n - 1], p = R.pts[i];
      let z = zm + (zs - zm) * (1 - t) ** 2.1, inLake = null;
      if (withLakes) for (const k of R.lakes) if (lakeRho(k, p[0], p[1], 5) < 1) inLake = k;
      if (inLake) z = inLake.level;
      run = Math.min(run, A0(p[0], p[1], 5) - 3, z); if (inLake) run = Math.min(run, inLake.level);
      prof.push(Math.max(run, R.toSea ? 0 : -1e9));
    }
    return prof;
  };
  for (const R of placed.rivers) {
    if (R.lakes.length && !R.fromLake) {
      const p0 = profile(R, false);
      for (const k of R.lakes) { const e = R.pts.findIndex((p) => lakeRho(k, p[0], p[1], 5) < 1); if (e >= 0) k.level = p0[e] - 1; }
    }
    R.prof = profile(R, true);
    R.halfW = (t) => 0.5 * R.mouthW * (0.12 + 0.88 * t ** 0.7);
    R.flood = (t) => Math.max(10 * R.halfW(t), 60);                     // the floodplain's half-width
    R.side = S > 8e5 ? 0.02 : S > 5e4 ? 0.05 : 0.1;                     // the valley sides' slope
  }
  const A = (x, y, cut) => {
    let z = A0(x, y, cut);
    for (const k of placed.lakes) {
      const rho = lakeRho(k, x, y, cut); if (rho > 1.6) continue;
      if (rho < 1) z = Math.min(z, k.level - 1.5 - k.depth * (1 - rho * rho) ** 1.3);   // a shelving shore, deep in the middle
      else z = Math.max(z, k.level + 3 + 0.004 * (rho - 1) * k.b);        // a low rim: the water leaves only where a river cuts it
    }
    for (const R of placed.rivers) {
      const [d, t, i] = polyNear(R, x, y), wf = R.flood(t); if (d > wf + 60 * wf) continue;
      z = Math.min(z, R.prof[i] + Math.max(0, d - wf) * R.side + (d < wf ? 0.5 * (d / wf) : 0.5));
    }
    return z;
  };
  const inLake = (x, y) => placed.lakes.some((k) => lakeRho(k, x, y, 0) < 1.05);
  return { S, H, oct, seed: K0.seed, rngSeed: seed, A, A0, placed, coasts, tierH, anchor, NZ, feats, inLake };
}

// ── erosion with inflow, on a level ──────────────────────────────────────────────────────────────────────────────────
// the flood with the level's edge held at its parent's water (where the parent has water there): a lake or a sea the
// edge cuts through stays full instead of draining out through the edge
function floodHeld(z, n, edgeWater) {
  if (!edgeWater) return priorityFlood(z, n, n);
  const zb = Float64Array.from(z); for (const [k, w] of edgeWater) if (w > zb[k]) zb[k] = w;
  return priorityFlood(zb, n, n);
}
function erodeLevel(z, n, dx, { steps, strength = 0.6, m = 0.5, inflow = null, thermal = 0, edgeWater = null, noCut = null }) {
  const N = n * n; let rec = null, order = null, area = null, filled = null;
  for (let step = 0; step <= steps; step++) {
    filled = floodHeld(z, n, edgeWater); ({ rec, order } = drainage(filled, n, n, dx));
    area = new Float64Array(N).fill(1); if (inflow) for (let k = 0; k < N; k++) area[k] += inflow[k];
    for (let t = N - 1; t >= 0; t--) { const k = order[t]; if (rec[k] >= 0) area[rec[k]] += area[k]; }
    if (step === steps) break;
    let maxA = 0; for (let k = 0; k < N; k++) if (area[k] > maxA) maxA = area[k];
    const Ac = Math.max(2, 0.002 * N);
    for (const k of order) {
      const r = rec[k]; if (r < 0 || area[k] <= Ac || z[k] <= 0 || (noCut && noCut[k])) continue;
      const F = strength * ((area[k] - Ac) / maxA) ** m, zn = (z[k] + F * z[r]) / (1 + F);
      if (zn < z[k] && zn >= z[r]) z[k] = zn;
    }
    if (thermal > 0) {
      const talus = Math.tan((35 * Math.PI) / 180), dz = new Float64Array(N);
      for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
        const k = j * n + i;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = (j + dj) * n + (i + di), ex = z[k] - z[q] - talus * dx; if (ex > 0) { const mm = (thermal * ex) / 8; dz[k] -= mm; dz[q] += mm; } }
      }
      for (let k = 0; k < N; k++) z[k] += dz[k];
    }
  }
  return { z, filled, rec, order, area };
}

// ── rivers: traced on a level, smoothed, meandered, bucketed for the kernel ──────────────────────────────────────────
function traceRivers(lv, { minArea, exclude, aw, maxRivers = 80 }) {
  const { n, dx, x0, y0 } = lv, N = n * n, { rec, area, filled, z, water } = lv;
  const isCh = new Uint8Array(N); for (let k = 0; k < N; k++) if (area[k] * dx * dx >= minArea && !water[k] && !exclude(x0 + (k % n) * dx, y0 + Math.floor(k / n) * dx)) isCh[k] = 1;
  const donors = new Int32Array(N); for (let k = 0; k < N; k++) if (isCh[k] && rec[k] >= 0 && isCh[rec[k]]) donors[rec[k]]++;
  const heads = []; for (let k = 0; k < N; k++) if (isCh[k] && donors[k] === 0) heads.push(k);
  const seen = new Uint8Array(N), chains = [];
  heads.sort((a, b) => a - b);
  for (const h of heads) {
    const c = [h]; let k = h; seen[k] = 1;
    for (;;) { const r = rec[k]; if (r < 0) break; c.push(r); if (!isCh[r] || seen[r]) break; seen[r] = 1; k = r; }
    if (c.length >= 3) chains.push(c);
  }
  // the biggest first (by the area where each ends), capped
  chains.sort((a, b) => area[b[b.length - 1]] - area[a[a.length - 1]] || a[0] - b[0]);
  return chains.slice(0, maxRivers).map((c) => {
    const pts = c.map((k) => [x0 + (k % n) * dx, y0 + Math.floor(k / n) * dx]);
    let lvl = c.map((k) => (water[c[c.length - 1]] && k === c[c.length - 1] ? lv.wl[k] : filled[k]));
    for (let i = 1; i < lvl.length; i++) if (lvl[i] > lvl[i - 1]) lvl[i] = lvl[i - 1];
    const half = c.map((k) => 0.5 * aw * (area[k] * dx * dx) ** 0.4);
    return chaikin(pts, half, lvl, 2);
  });
}
function chaikin(pts, half, lvl, it) {
  for (let r = 0; r < it; r++) {
    const P = [pts[0]], Hh = [half[0]], Lv = [lvl[0]];
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1];
      P.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
      Hh.push(0.75 * half[i] + 0.25 * half[i + 1], 0.25 * half[i] + 0.75 * half[i + 1]); Lv.push(0.75 * lvl[i] + 0.25 * lvl[i + 1], 0.25 * lvl[i] + 0.75 * lvl[i + 1]);
    }
    P.push(pts[pts.length - 1]); Hh.push(half[half.length - 1]); Lv.push(lvl[lvl.length - 1]); pts = P; half = Hh; lvl = Lv;
  }
  for (let i = 1; i < lvl.length; i++) if (lvl[i] > lvl[i - 1]) lvl[i] = lvl[i - 1];
  return { pts, half, lvl };
}
/** A declared river as channel data: resampled at a tenth of its meander wavelength, meandered, with half-widths and levels. */
function declaredChannel(R, rng) {
  const L = R.cum[R.cum.length - 1], hm = R.halfW(1), lam = 22 * hm, step = Math.max(lam / 12, L / 8000);
  const base = resample(R.pts, step), cb = withCum(base), out = { pts: [], half: [], lvl: [] }; let ph = rng() * 6.283;
  // slow random walks for the meander's amplitude and wavelength (a river's bends are never a sine)
  let am = 0.8, wl = 1, ps = rng() * 6.283;
  for (let i = 0; i < base.length; i++) {
    const t = cb.cum[i] / cb.cum[cb.cum.length - 1], h = R.halfW(t), la = 22 * h;
    if (i) { am = Math.max(0.25, Math.min(1.3, am + (rng() - 0.5) * 0.18)); wl = Math.max(0.6, Math.min(1.5, wl + (rng() - 0.5) * 0.12)); ph += (2 * Math.PI * (cb.cum[i] - cb.cum[i - 1])) / (la * wl); ps += (rng() - 0.5) * 0.3; }
    const p = base[i], q = base[Math.min(i + 1, base.length - 1)], o = base[Math.max(i - 1, 0)], dx = q[0] - o[0], dy = q[1] - o[1], l = Math.hypot(dx, dy) || 1;
    const amp = Math.min(3 * h, 0.5 * R.flood(t)) * am * smooth(0, 0.03, t) * smooth(1, 0.97, t) * (R.fromLake && t < 0.02 ? 0 : 1);
    const off = amp * (Math.sin(ph) + 0.3 * Math.sin(2 * ph + ps)) / 1.15;
    out.pts.push([p[0] - (dy / l) * off, p[1] + (dx / l) * off]); out.half.push(h);
    const [, tt, ii] = polyNear(R, p[0], p[1]); void tt; out.lvl.push(R.prof[ii]);
  }
  for (let i = 1; i < out.lvl.length; i++) if (out.lvl[i] > out.lvl[i - 1]) out.lvl[i] = out.lvl[i - 1];
  return out;
}
function bucketRivers(chans, lv, reachOf) {
  const ext = lv.dx * (lv.n - 1), bn = 64, bdx = ext / bn, seg = [], lists = Array.from({ length: bn * bn }, () => []);
  for (const c of chans) for (let i = 0; i + 1 < c.pts.length; i++) {
    const a = c.pts[i], b = c.pts[i + 1], reach = reachOf(Math.max(c.half[i], c.half[i + 1]));
    const lx = Math.min(a[0], b[0]) - reach, hx = Math.max(a[0], b[0]) + reach, ly = Math.min(a[1], b[1]) - reach, hy = Math.max(a[1], b[1]) + reach;
    const i0 = Math.max(0, Math.floor((lx - lv.x0) / bdx)), i1 = Math.min(bn - 1, Math.floor((hx - lv.x0) / bdx)), j0 = Math.max(0, Math.floor((ly - lv.y0) / bdx)), j1 = Math.min(bn - 1, Math.floor((hy - lv.y0) / bdx));
    if (i0 > i1 || j0 > j1) continue;
    const id = seg.length / 8; seg.push(a[0], a[1], b[0], b[1], c.half[i], c.half[i + 1], c.lvl[i], c.lvl[i + 1]);
    for (let j = j0; j <= j1; j++) for (let q = i0; q <= i1; q++) lists[j * bn + q].push(id);
  }
  const boff = new Int32Array(bn * bn + 1); let tot = 0; for (let b = 0; b < bn * bn; b++) { boff[b] = tot; tot += lists[b].length; } boff[bn * bn] = tot;
  const bidx = new Int32Array(tot); let p = 0; for (const l of lists) for (const id of l) bidx[p++] = id;
  return { seg: new Float32Array(seg), bx0: lv.x0, by0: lv.y0, bdx, bn, boff, bidx, segments: seg.length / 8 };
}

// ── levels toward the focus ──────────────────────────────────────────────────────────────────────────────────────────
// the parent upsampled by Catmull-Rom: bilinear would print the parent's cells into the child as creases
function bicubicOf(lv) {
  const { n, dx, x0, y0, z } = lv;
  const at = (i, j) => z[Math.max(0, Math.min(n - 1, j)) * n + Math.max(0, Math.min(n - 1, i))];
  const cr = (a, b, c, d, t) => b + 0.5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)));
  return (x, y) => {
    let u = (x - x0) / dx, v = (y - y0) / dx; u = u < 0 ? 0 : u > n - 1 ? n - 1 : u; v = v < 0 ? 0 : v > n - 1 ? n - 1 : v;
    let i = Math.floor(u), j = Math.floor(v); if (i > n - 2) i = n - 2; if (j > n - 2) j = n - 2; const fu = u - i, fv = v - j;
    const row = (jj) => cr(at(i - 1, jj), at(i, jj), at(i + 1, jj), at(i + 2, jj), fu);
    return cr(row(j - 1), row(j), row(j + 1), row(j + 2), fv);
  };
}
function buildLevel(C, idx, region, parent, rivers, focusPts) {
  const n = LEVEL_N, dx = region.ext / (n - 1), x0 = region.x0, y0 = region.y0, N = n * n, cut = cutOf(C.oct, dx);
  const z = new Float64Array(N), up = parent ? bicubicOf(parent) : null;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = x0 + i * dx, y = y0 + j * dx;
    z[j * n + i] = parent ? up(x, y) + C.A(x, y, cut) - C.A(x, y, parent.cut) : C.A(x, y, cut);
  }
  // the parent's rivers flow in where they cross this level's edge
  let inflow = null;
  if (parent) {
    inflow = new Float64Array(N); const inside = (p) => p[0] > x0 + dx && p[0] < x0 + region.ext - dx && p[1] > y0 + dx && p[1] < y0 + region.ext - dx;
    for (const c of rivers) for (let i = 1; i < c.pts.length; i++) if (!inside(c.pts[i - 1]) && inside(c.pts[i])) {
      const ii = Math.max(1, Math.min(n - 2, Math.round((c.pts[i][0] - x0) / dx))), jj = Math.max(1, Math.min(n - 2, Math.round((c.pts[i][1] - y0) / dx)));
      inflow[jj * n + ii] += (c.area || 0) / (dx * dx);
    }
  }
  // lakes are the declared ones: every other closed hollow is filled (a plain drains; noise alone makes no lakes), before
  // the rain and after it
  const keep = new Uint8Array(N); for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (C.inLake(x0 + i * dx, y0 + j * dx)) keep[j * n + i] = 1;
  const sea = C.coasts.length > 0;
  let edgeWater = null;
  if (parent) {
    edgeWater = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      if (i && j && i < n - 1 && j < n - 1) continue;
      const pi = Math.round((x0 + i * dx - parent.x0) / parent.dx), pj = Math.round((y0 + j * dx - parent.y0) / parent.dx), pk = Math.max(0, Math.min(parent.n - 1, pj)) * parent.n + Math.max(0, Math.min(parent.n - 1, pi));
      if (parent.water[pk]) edgeWater.push([j * n + i, parent.wl[pk]]);
    }
  }
  const fill = () => { const f = floodHeld(z, n, edgeWater); for (let k = 0; k < N; k++) if (!keep[k] && (z[k] > 0 || !sea) && f[k] > z[k]) z[k] = f[k]; };
  fill();
  const er = erodeLevel(z, n, dx, { steps: idx === 0 ? 40 : 24, strength: 0.5, inflow, thermal: dx < 60 ? 0.2 : 0, edgeWater, noCut: keep });
  fill(); er.filled = floodHeld(z, n, edgeWater);
  const water = new Uint8Array(N), wl = new Float64Array(N);
  for (let k = 0; k < N; k++) {
    if (C.coasts.length && z[k] < 0) { water[k] = 1; wl[k] = Math.max(0, er.filled[k]); }
    else if (er.filled[k] - z[k] > 0.3) { water[k] = 1; wl[k] = er.filled[k]; }
  }
  void focusPts;
  return { idx, n, dx, x0, y0, ext: region.ext, z, filled: er.filled, rec: er.rec, area: er.area, water, wl, cut };
}

/**
 * composeAtlas(world) → the plan: levels (typed grids), rivers per level, the placed features, the focus and spawn, and
 * `K` for atlasKernel. Memoised on the recipe (a composition takes seconds; the recipe regenerates on every read).
 */
const MEMO = new Map();
export function composeAtlas(world) {
  const key = JSON.stringify(world); if (MEMO.has(key)) return MEMO.get(key);
  const errs = validateAtlas(world); if (errs.length) throw new Error(`terrain: ${errs.join('; ')}`);
  const t0 = Date.now(), C = planFeatures(world), rng = mulberry32(C.rngSeed ^ 0x5bd1e995), clim = ATLAS_CLIMATES[world.climate || 'temperate'];
  C.climate = world.climate || 'temperate';
  const declared = C.placed.rivers.map((R) => ({ R, chan: declaredChannel(R, rng) }));
  // the focus: where the anchor is most itself — a great river's lower course, a lake's shore, a range's valley floor
  const focus = isPt(world.focus) ? world.focus.slice() : focusOf(C);
  // level 0, then the stack toward the focus
  const levels = []; let region = { x0: -C.H, y0: -C.H, ext: C.S }, parentRivers = [];
  const aw = { v: 0.012 };
  for (let l = 0; l < MAX_LEVELS; l++) {
    const lv = buildLevel(C, l, region, levels[l - 1] || null, parentRivers, [focus]);
    if (l === 0 && declared.length) {                                   // calibrate widths: the anchor's mouth in its band
      const R = declared[0].R, m = R.pts[R.pts.length - 1], i = Math.round((m[0] - lv.x0) / lv.dx), j = Math.round((m[1] - lv.y0) / lv.dx);
      let A = 0; for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) { const ii = Math.max(0, Math.min(lv.n - 1, i + a)), jj = Math.max(0, Math.min(lv.n - 1, j + b)); A = Math.max(A, lv.area[jj * lv.n + ii]); }
      aw.v = R.mouthW / Math.max(1e6, A * lv.dx * lv.dx) ** 0.4;
    }
    const exclude = (x, y) => declared.some(({ R }) => { const [d, t] = polyNear(R, x, y); return d < R.flood(t); });
    const minArea = (lv.ext * lv.ext) * (l === 0 ? 0.004 : 0.006);
    const traced = traceRivers(lv, { minArea, exclude, aw: aw.v, maxRivers: 60 }).map((c) => ({ ...c, area: 0 }));
    for (const c of traced) {
      const e = c.pts[c.pts.length - 1];
      for (const { R, chan } of declared) {
        const [d, t] = polyNear(R, e[0], e[1]); if (d > R.flood(t) * 1.2) continue;
        let bi = 0, bd = Infinity; for (let q = 0; q < chan.pts.length; q++) { const dd = (chan.pts[q][0] - e[0]) ** 2 + (chan.pts[q][1] - e[1]) ** 2; if (dd < bd) { bd = dd; bi = q; } }
        const m = chan.pts[bi], L = Math.sqrt(bd), st = Math.max(1, Math.ceil(L / lv.dx)), h = c.half[c.half.length - 1], z0 = c.lvl[c.lvl.length - 1], z1 = Math.min(z0, chan.lvl[bi]);
        for (let s = 1; s <= st; s++) { const f = s / st; c.pts.push([e[0] + (m[0] - e[0]) * f, e[1] + (m[1] - e[1]) * f]); c.half.push(h); c.lvl.push(z0 + (z1 - z0) * f); }
        break;
      }
    }
    for (const c of traced) { const e = c.pts[c.pts.length - 1]; const q = Math.round((e[1] - lv.y0) / lv.dx) * lv.n + Math.round((e[0] - lv.x0) / lv.dx); c.area = (lv.area[Math.max(0, Math.min(lv.n * lv.n - 1, q))] || 1) * lv.dx * lv.dx; }
    lv.traced = traced; levels.push(lv); parentRivers = traced;
    if (lv.dx < 2 * FINEST) break;
    const ext = lv.ext / RATIO, m = 2 * lv.dx;
    region = { x0: Math.max(lv.x0 + m, Math.min(lv.x0 + lv.ext - m - ext, focus[0] - ext / 2)), y0: Math.max(lv.y0 + m, Math.min(lv.y0 + lv.ext - m - ext, focus[1] - ext / 2)), ext };
  }
  // the kernel's levels: grids quantised, rivers bucketed (declared + traced), blends
  const Klevels = levels.map((lv) => {
    let lo = Infinity, hi = -Infinity; for (let k = 0; k < lv.z.length; k++) { const a = lv.z[k], b = lv.water[k] ? lv.wl[k] : a; if (a < lo) lo = a; if (b > hi) hi = b; if (a > hi) hi = a; }
    const hStep = (hi - lo) / 65000 || 1e-6, h = new Uint16Array(lv.z.length), wq = new Uint16Array(lv.z.length);
    for (let k = 0; k < lv.z.length; k++) { h[k] = Math.round((lv.z[k] - lo) / hStep); if (lv.water[k]) wq[k] = 1 + Math.round((lv.wl[k] - lo) / hStep); }
    // the water reaches one cell further, so the shore is where the ground rises through it, not the grid's staircase
    const n = lv.n, wq2 = Uint16Array.from(wq);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const k = j * n + i; if (wq[k]) continue; let top = 0; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + a, jj = j + b; if (ii >= 0 && jj >= 0 && ii < n && jj < n && wq[jj * n + ii] > top) top = wq[jj * n + ii]; } if (top && h[k] + 1 < top) wq2[k] = top; }
    wq.set(wq2);
    const chans = [...declared.map((d) => d.chan), ...lv.traced];
    const rivers = bucketRivers(chans, lv, (hh) => hh + Math.max(1.5 * hh, 2 * lv.dx) + lv.dx);
    return { x0: lv.x0, y0: lv.y0, dx: lv.dx, n: lv.n, hMin: lo, hStep, h, wq, blend: lv.ext * 0.08, cut: lv.cut, rivers };
  });
  const K = {
    atlas: true, S: C.S, seed: C.seed, oct: C.oct, levels: Klevels, rough: { soil: 0.55, rock: 1.8 }, seaLevel: C.coasts.length ? 0 : null,
    // the snowline: the climate's, or where the anchor's peaks catch it, whichever is higher (a cordillera is not a
    // snowfield: its valleys and most of its slopes are bare)
    zones: { snow: Math.max(clim.snow, 0.72 * Math.max(0, ...C.placed.ranges.map((r) => r.peak), ...C.placed.volcanoes.map((v) => v.h))), tree: clim.tree }, ramps: clim.ramps,
    light: (() => { const l = [0.5, 0.32, 0.8], m = Math.hypot(...l); return l.map((v) => v / m); })(), lambert: { ambient: 0.36, gain: 0.72 },
  };
  const out = { K, C, levels, focus, clim, declared, ms: Date.now() - t0 };
  MEMO.set(key, out); if (MEMO.size > 4) MEMO.delete(MEMO.keys().next().value);
  return out;
}

function focusOf(C) {
  const a = C.anchor, P = C.placed;
  if (a.feature === 'river' && P.rivers[0]) { const R = P.rivers[0], i = Math.floor(R.pts.length * 0.72); return R.pts[i].slice(); }
  if (a.feature === 'lake' && P.lakes[0]) { const k = P.lakes[0], an = 2.2; return [k.c[0] + Math.cos(an) * Math.cos(k.ang) * k.a * 0.98 - Math.sin(an) * Math.sin(k.ang) * k.b * 0.98, k.c[1] + Math.cos(an) * Math.sin(k.ang) * k.a * 0.98 + Math.sin(an) * Math.cos(k.ang) * k.b * 0.98]; }
  if (a.feature === 'range' && P.ranges[0]) {
    // out from the spine's middle, away from any coast, to where the ground first falls below the treeline: the foot
    const R = P.ranges[0], m = R.pts[3], q = R.pts[4], d = [q[0] - m[0], q[1] - m[1]], l = Math.hypot(...d) || 1; let nrm = [-d[1] / l, d[0] / l];
    if (C.coasts.length) { const cd = ATLAS_SIDES[C.coasts[0].side]; if (nrm[0] * cd[0] + nrm[1] * cd[1] > 0) nrm = [-nrm[0], -nrm[1]]; }
    const tree = (ATLAS_CLIMATES[C.climate] || ATLAS_CLIMATES.temperate).tree;
    // a valley inside the range: the first place out from the spine whose floor (the lowest ground within 3 km) is
    // below the treeline while peaks over half the range's height stand within 10 km
    const clim = ATLAS_CLIMATES[C.climate] || ATLAS_CLIMATES.temperate, foot = Math.min(0.35 * R.peak, 0.8 * clim.snow, 1.4 * tree), ck = cutOf(C.oct, 800);
    for (let s = 0.08; s < 0.9; s += 0.02) {
      const c = [m[0] + nrm[0] * s * R.W, m[1] + nrm[1] * s * R.W]; let lo = Infinity, lp = c, hi = -Infinity;
      for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const p = [c[0] + i * 1500, c[1] + j * 1500], z = C.A(p[0], p[1], ck); if (z < lo) { lo = z; lp = p; } }
      if (lo >= foot) continue;
      for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) hi = Math.max(hi, C.A(c[0] + i * 3300, c[1] + j * 3300, ck));
      if (hi > 0.5 * R.peak) return lp;
    }
    for (let s = 0.05; s < 1.5; s += 0.005) { const p = [m[0] + nrm[0] * s * R.W, m[1] + nrm[1] * s * R.W]; if (C.A(p[0], p[1], 6) < foot) return p; }
    return [m[0] + nrm[0] * 0.6 * R.W, m[1] + nrm[1] * 0.6 * R.W];
  }
  if (a.feature === 'plateau' && P.plateaus[0]) { const p = P.plateaus[0]; return [p.c[0] + 1.08 * p.r, p.c[1]]; }
  if (a.feature === 'volcano' && P.volcanoes[0]) { const v = P.volcanoes[0]; return [v.c[0] + 0.55 * v.rb, v.c[1] - 0.2 * v.rb]; }
  return [0, 0];
}

// ── the field: what terrain-world reads ──────────────────────────────────────────────────────────────────────────────
const typed = (a) => ({ __b64: Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64'), t: a.constructor.name });
function encodeDeep(v) {
  if (ArrayBuffer.isView(v)) return typed(v);
  if (Array.isArray(v)) return v.map(encodeDeep);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encodeDeep(x)]));
  return v;
}
/** The inverse of the page config's encoding (tests, and anything reading a page back). */
export function decodeDeep(v) {
  if (v && typeof v === 'object' && typeof v.__b64 === 'string') { const u = Buffer.from(v.__b64, 'base64'), T = globalThis[v.t]; return new T(u.buffer, u.byteOffset, u.byteLength / T.BYTES_PER_ELEMENT); }
  if (Array.isArray(v)) return v.map(decodeDeep);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, decodeDeep(x)]));
  return v;
}

/**
 * atlasField({ world, planet?, seed? }) → the terrain field of a composed world, in the shape terrain-world reads from a
 * painted one (`kernel`, `heightAt`…, `bounds`, `meta`, `pageConfig()`), plus `kernelSource`, `atlas` (the plan's facts)
 * and `views` (the bookmarks: standing at the anchor, above it, the anchor whole, the world).
 */
export function atlasField(spec) {
  const world = { ...spec.world, seed: spec.world.seed ?? spec.seed ?? 'atlas' };
  const P = composeAtlas(world), K = { ...P.K }, S = P.C.S, H = P.C.H;
  if (spec.planet) {
    const R = (spec.planet === true ? null : spec.planet.radius) ?? (S >= 5e5 ? 6.371e6 : Math.max(8 * S, 2e4));
    K.planet = { R, inner: H / R, outer: (1.35 * H) / R, cont: { amp: Math.max(1200, P.C.tierH * 3), wl: 0.9 * R, bias: 0.12, base: P.C.coasts.length ? -250 : 50 }, seed: (P.C.seed + 911) % 100003, sea: 0 };
  }
  const kernel = atlasKernel(K), fin = P.levels[P.levels.length - 1];
  let lo = Infinity, hi = -Infinity; for (const lv of P.levels) for (let k = 0; k < lv.z.length; k += 7) { if (lv.z[k] < lo) lo = lv.z[k]; if (lv.z[k] > hi) hi = lv.z[k]; }
  const views = atlasViews(P, kernel);
  return {
    atlas: { span: S, anchor: { feature: P.C.anchor.feature, ...P.C.anchor.v }, features: P.C.feats.map((f) => ({ feature: f.feature, ...(f.v || { side: f.side || 'S' }) })), levels: P.levels.map((l) => ({ extent: Math.round(l.ext), cell: +l.dx.toFixed(2), rivers: l.traced.length })), focus: P.focus, ms: P.ms, climate: world.climate || 'temperate' },
    K, kernel, kernelSource: atlasKernel.toString(), heightAt: kernel.heightAt, groundAt: kernel.groundAt, normalAt: kernel.normalAt, colorAt: kernel.colorAt,
    bounds: { x: [-H, H], y: [-H, H], z: [lo, hi], cell: fin.dx }, siteBounds: { x: [fin.x0, fin.x0 + fin.ext], y: [fin.y0, fin.y0 + fin.ext], z: [lo, hi], cell: fin.dx },
    patches: P.levels.slice(1).map((l) => ({ x0: l.x0, y0: l.y0, w: l.ext, d: l.ext, spacing: 2 * l.dx })),
    meta: { span: S, relief: 1, horizon: 'none', sea: P.C.coasts.length ? 0 : null, planet: K.planet || null, sky: P.clim.sky, rock: 'granite', octaves: P.C.oct.length, scree: [] },
    views,
    pageConfig() { return encodeDeep(K); },
    /** The same field over another K (a grade layer added: terrain-city.js). */
    withK(K2) { const k2 = atlasKernel(K2); return { ...this, K: K2, kernel: k2, heightAt: k2.heightAt, groundAt: k2.groundAt, normalAt: k2.normalAt, colorAt: k2.colorAt, pageConfig() { return encodeDeep(K2); } }; },
  };
}

// the bookmarks: a place to stand at the anchor (a river's bank, a lake's shore, a valley floor under a range, an
// escarpment's foot, a volcano's flank), found on the finest level; then above it, the anchor whole, the world
function atlasViews(P, k) {
  const a = P.C.anchor.feature, S = P.C.S, f = P.focus; let at = f.slice(), look = null;
  const dry = (x, y) => k.waterAt(x, y) === null;
  if (a === 'river' || a === 'lake') {
    // walk out from the water to dry ground, then stand a little back from the edge, looking at the water
    const r = k.riverAt(f[0], f[1]); let dir;
    if (a === 'river' && r) { const e = 2; const gx = (k.riverAt(f[0] + e, f[1]) || r)[0] - (k.riverAt(f[0] - e, f[1]) || r)[0], gy = (k.riverAt(f[0], f[1] + e) || r)[0] - (k.riverAt(f[0], f[1] - e) || r)[0]; const l = Math.hypot(gx, gy) || 1; dir = [gx / l, gy / l]; at = [f[0] - dir[0] * (r[0] - 0), f[1] - dir[1] * (r[0] - 0)]; }
    else { const c = P.C.placed.lakes[0] ? P.C.placed.lakes[0].c : [0, 0], l = Math.hypot(f[0] - c[0], f[1] - c[1]) || 1; dir = [(f[0] - c[0]) / l, (f[1] - c[1]) / l]; }
    let s = 0; while (s < 20000 && !dry(at[0] + dir[0] * s, at[1] + dir[1] * s)) s += 5;
    const edge = [at[0] + dir[0] * s, at[1] + dir[1] * s]; let t = s + 45; while (t < s + 300 && !dry(at[0] + dir[0] * t, at[1] + dir[1] * t)) t += 5;
    look = [edge[0] - dir[0] * 800 + dir[1] * 600, edge[1] - dir[1] * 800 - dir[0] * 600]; at = [at[0] + dir[0] * t, at[1] + dir[1] * t];
  } else if (a === 'range') {
    // the lowest dry ground within six kilometres of the focus: a valley floor under the range, looking up at it
    let best = at, bz = Infinity; for (let j = -15; j <= 15; j++) for (let i = -15; i <= 15; i++) { const x = f[0] + i * 400, y = f[1] + j * 400; if (!dry(x, y)) continue; const z = k.groundAt(x, y); if (z < bz) { bz = z; best = [x, y]; } }
    at = best; let hz = -Infinity; for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) { const x = at[0] + i * 2000, y = at[1] + j * 2000, z = k.groundAt(x, y); if (z > hz && Math.hypot(i, j) > 1.5) { hz = z; look = [x, y]; } }
  } else if (a === 'plateau') { look = P.C.placed.plateaus[0].c; }
  else if (a === 'volcano') { look = P.C.placed.volcanoes[0].c; }
  if (!look) look = [at[0] + 500, at[1]];
  const d = [look[0] - at[0], look[1] - at[1]], dl = Math.hypot(...d) || 1, u = [d[0] / dl, d[1] / dl];
  const gz = k.heightAt(at[0], at[1]), up = a === 'range' || a === 'volcano' || a === 'plateau';
  // on water, a point across it; under a summit, the summit itself (the camera tilts up to it)
  const lookAt = up ? look.slice() : [at[0] + u[0] * Math.min(dl, 3000), at[1] + u[1] * Math.min(dl, 3000)]; const lz = k.heightAt(lookAt[0], lookAt[1]);
  const regional = Math.min(0.12 * S, 60000);
  return {
    spawn: [at[0] + 0.37, at[1] + 0.21], look: lookAt, lookZ: lz, groundZ: gz, dir: u,
    aerial: { cameraPosition: [at[0] - u[0] * 1500, at[1] - u[1] * 1500, gz + 900 + (up ? 0.5 * Math.max(0, lz - gz) : 0)], lookAt: up ? [lookAt[0], lookAt[1], lz] : [at[0] + u[0] * 3000, at[1] + u[1] * 3000, lz] },
    region: { cameraPosition: [at[0] - u[0] * regional, at[1] - u[1] * regional, gz + 0.6 * regional], lookAt: [at[0] + u[0] * regional * 0.8, at[1] + u[1] * regional * 0.8, 0] },
    world: { cameraPosition: [0.35 * S, -0.9 * S, 0.95 * S], lookAt: [0, 0, 0] },
  };
}

/** The frame alone (no levels): the span the anchor sets, the anchor's measures, and where each feature was placed. */
export function atlasFrame(world) {
  const errs = validateAtlas(world); if (errs.length) throw new Error(`terrain: ${errs.join('; ')}`);
  const C = planFeatures({ ...world, seed: world.seed ?? 'atlas' });
  return { span: C.S, anchor: { feature: C.anchor.feature, ...C.anchor.v }, placed: C.placed, coasts: C.coasts };
}
/** Forget memoised compositions (tests that time or re-derive one). */
export function clearAtlasMemo() { MEMO.clear(); }
