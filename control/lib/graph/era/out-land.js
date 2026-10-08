/**
 * THE LAND INDEX — the natural world as designed forms, the way the flora index makes plants: shapes built for look,
 * read and cost from a few primitives under a few dials, in values on named parts, skinned by a kit's swatches. No
 * creatures: what lives on the land is left open.
 *
 * Six FORMS make the land a kit needs:
 *   landscape  the lie of the ground: a swath of it, from a flat meadow to rugged hills, downs, hummocks, terraces
 *   rock       rock formations standing on it: boulders, a tor, a sea stack, a hoodoo, a balanced rock
 *   strata     the sediment in a cliff: its beds, even, graded, tilted, folded, or tilted under level ones
 *   face       what a cliff or a crag is built of: columns, blocks, slabs, flutes, a jagged crag
 *   cloud      cloud shapes: cumulus, towering, stratus, cirrus streaks, stacked lenses
 *   landmark   natural landmarks: a monolith, an arch, a spire, a butte, a split rock, a fall of water
 *
 * Each form has a LITTLE-TO-MANY dial, `many` 0…1: how much of it there is, in five named steps (clear to overcast,
 * massive to laminated, bare to a boulder field). A world's style picks a point on it; the dial pins the form's count
 * so the step reads the same at any seed. Pure: the same form, variant, seed and level build the same faces.
 */
import { blobTris } from '../vegetation/tree-mesh.js';
import { mulberry32 } from '../vegetation/grow.js';
import { vnoise } from './dirt.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mix = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r3 = (x) => Math.round(x * 1000) / 1000 + 0;
const subSeed = (seed, key) => { let h = (seed >>> 0) ^ 0x9e3779b9; for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0; return (h % 99998) + 1; };

/** The parts land is built of, and the swatch ramp each takes. */
export const LAND_PARTS = Object.freeze({
  ground: { role: 'grass', read: 'the ground\'s cover: grass, turf, a cap of green on a cliff' },
  soil: { role: 'soil', read: 'bare earth, a soft bed in a cliff' },
  rock: { role: 'rock', read: 'stone: a cliff\'s face, a formation, a landmark' },
  cloud: { role: 'cloud', read: 'a cloud: lit on top, a step darker underneath' },
  water: { role: 'sky', read: 'water: a fall, a pool; it takes the sky' },
});

/** By ring: grid cell (metres), mass detail, polygon sides, and the face budget a form must keep. */
export const LAND_LEVELS = Object.freeze({
  near: { cell: 1.5, detail: 1, sides: 7, segs: 16, puffs: 3, budget: 2600 },
  mid: { cell: 3, detail: 0, sides: 6, segs: 10, puffs: 1, budget: 900 },
  far: { cell: 6, detail: 0, sides: 4, segs: 6, puffs: 0, budget: 520 },
});

function face(out, corners, part, value, centre = null) {
  let n = unit(cross(sub(corners[1], corners[0]), sub(corners[2], corners[0])));
  if (centre) { const m = mul(corners.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / corners.length); if (dot(n, sub(m, centre)) < 0) { corners = corners.slice().reverse(); n = mul(n, -1); } }
  out.push({ corners: corners.map((p) => p.map(r3)), normal: n.map(r3), part, value: r3(value) });
}
// an extruded irregular prism: a footprint of `sides` corners round c, from z0 to z1, its top `taper` of its foot
function prism(out, c, rx, ry, z0, z1, sides, rand, { part = 'rock', value = 0.5, taper = 0.85, yaw = 0, jit = 0.18 } = {}) {
  const foot = Array.from({ length: sides }, (_, i) => { const a = yaw + (2 * Math.PI * i) / sides, j = 1 + jit * (rand() * 2 - 1); return [Math.cos(a) * rx * j, Math.sin(a) * ry * j]; });
  const P = (k, top) => [c[0] + foot[k][0] * (top ? taper : 1), c[1] + foot[k][1] * (top ? taper : 1), top ? z1 : z0];
  const mid = [c[0], c[1], (z0 + z1) / 2];
  for (let k = 0; k < sides; k++) { const k2 = (k + 1) % sides; face(out, [P(k, false), P(k2, false), P(k2, true), P(k, true)], part, value + (rand() - 0.5) * 0.1, mid); }
  face(out, Array.from({ length: sides }, (_, k) => P(k, true)), part, value + 0.08, mid);
}
// a rounded mass (an icosphere), its foot cut flat at `floor`
function lump(out, c, radii, detail, part, value, floor = -Infinity) {
  for (const t of blobTris(c, radii, null, { detail })) {
    const p = t.p.map((q) => [q[0], q[1], Math.max(floor, q[2])]);
    if (p.every((q) => q[2] <= floor + 1e-6)) continue;
    face(out, p, part, value, c);
  }
}
// an axis-aligned box from [x0, y0, z0] to [x1, y1, z1]; `skip` names sides not drawn (a back against a cliff)
function box(out, a, b, part, value, skip = '') {
  const [x0, y0, z0] = a, [x1, y1, z1] = b, c = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  const sides = {
    front: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], back: [[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]],
    left: [[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], right: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]],
    top: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], bottom: [[x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0]],
  };
  for (const [k, q] of Object.entries(sides)) if (!skip.includes(k)) face(out, q, part, k === 'top' ? value + 0.1 : k === 'front' ? value : value - 0.06, c);
}

/**
 * Each form: what it reads as, what it makes, its RAILS (every dial's [lo, hi]; a seed rolls inside them), its
 * VARIANTS (named narrowings), its MANY (the dial little-to-many pins, and the words for its five steps) and its build.
 */
export const LAND_FORMS = Object.freeze({
  landscape: {
    read: 'the lie of the ground: a swath of it as far as a trail sees', makes: ['meadow', 'downs', 'hummocks', 'terraces', 'rugged hills'],
    rails: { relief: [0.5, 14], wave: [8, 40], bumps: [0, 1], terraces: [0, 4] },
    variants: { meadow: { relief: [0.6, 3], wave: [20, 36], bumps: [0.1, 0.3] }, downs: { relief: [3, 8], wave: [30, 40], bumps: [0, 0.1] }, hummocky: { relief: [1, 3], wave: [8, 13], bumps: [0.5, 1] }, terraced: { relief: [4, 10], wave: [22, 34], terraces: [2, 4] }, rugged: { relief: [8, 14], wave: [12, 20], bumps: [0.4, 0.8] } },
    many: { dial: 'relief', span: 'variant', words: ['flat', 'gentle', 'rolling', 'hilly', 'rugged'] },
    build: buildLandscape,
  },
  rock: {
    read: 'rock formations standing on the ground', makes: ['boulders', 'a tor', 'a sea stack', 'a hoodoo', 'a balanced rock'],
    rails: { height: [0.8, 9], count: [1, 14], round: [0, 1], lean: [0, 0.2], spread: [4, 14] },
    variants: { boulders: { height: [0.8, 2.4], round: [0.6, 1], spread: [6, 14], count: [4, 10] }, tor: { height: [3, 6], round: [0.3, 0.6], spread: [4, 6], count: [1, 3] }, stack: { height: [6, 9], round: [0, 0.25], spread: [6, 10], count: [1, 3] }, hoodoo: { height: [3, 6], round: [0.2, 0.5], spread: [5, 9], count: [3, 6] }, balanced: { height: [2.5, 4], round: [0.5, 0.8], spread: [6, 10], count: [1, 2] } },
    many: { dial: 'count', words: ['bare', 'a few', 'scattered', 'strewn', 'a field'] },
    build: buildRock,
  },
  strata: {
    read: 'the sediment in a cliff: beds laid down and lifted', makes: ['layered', 'graded', 'tilted', 'folded', 'unconformity'],
    rails: { beds: [2, 26], vary: [0, 0.6], dip: [-14, 14], fold: [0, 2.2], grade: [-1, 1] },
    variants: { layered: { dip: [-2, 2], fold: [0, 0], vary: [0.1, 0.3] }, graded: { grade: [0.6, 1], dip: [-2, 2], fold: [0, 0] }, tilted: { dip: [8, 14], fold: [0, 0.3] }, folded: { fold: [1.2, 2.2], dip: [-3, 3] }, unconformity: { dip: [10, 14], fold: [0, 0.4], kind: 'unconformity' } },
    many: { dial: 'beds', words: ['massive', 'a few beds', 'bedded', 'thin-bedded', 'laminated'] },
    build: buildStrata,
  },
  face: {
    read: 'what a cliff or a crag is built of, seen face on', makes: ['columns', 'blocks', 'slabs', 'flutes', 'a crag'],
    rails: { joints: [2, 18], relief: [0.3, 2.5], overhang: [0, 1], jag: [0, 1], courses: [1, 5] },
    variants: { columnar: { relief: [0.3, 0.8], courses: [1, 1], jag: [0.1, 0.3], overhang: [0, 0] }, blocky: { relief: [0.8, 2], courses: [3, 5], jag: [0.1, 0.3], overhang: [0, 0.2] }, slabby: { relief: [0.3, 0.8], courses: [1, 2], overhang: [0.5, 1], jag: [0, 0.1] }, fluted: { relief: [0.4, 1], courses: [1, 1], jag: [0.2, 0.4], overhang: [0, 0], kind: 'fluted' }, crag: { relief: [1.2, 2.5], courses: [2, 3], jag: [0.6, 1], overhang: [0, 0.3] } },
    many: { dial: 'joints', words: ['smooth', 'a few joints', 'jointed', 'blocky', 'shattered'] },
    build: buildFace,
  },
  cloud: {
    read: 'cloud shapes over the land', makes: ['cumulus', 'towering', 'stratus', 'cirrus', 'lenticular'],
    rails: { puffs: [1, 24], size: [3, 12], tall: [0.05, 1.6], spread: [24, 90] },
    variants: { cumulus: { size: [5, 9], tall: [0.6, 0.9], puffs: [3, 7] }, towering: { size: [6, 10], tall: [1.2, 1.6], puffs: [1, 3] }, stratus: { size: [7, 11], tall: [0.15, 0.3], puffs: [5, 10] }, cirrus: { size: [8, 12], tall: [0.05, 0.1], puffs: [4, 9], kind: 'cirrus' }, lenticular: { size: [10, 12], tall: [0.18, 0.26], puffs: [1, 3], kind: 'lens' } },
    many: { dial: 'puffs', words: ['clear', 'fair', 'scattered', 'broken', 'overcast'] },
    build: buildCloud,
  },
  landmark: {
    read: 'natural landmarks: the shape a player is pulled toward', makes: ['a monolith', 'an arch', 'a spire', 'a butte', 'a split rock', 'a fall of water'],
    rails: { height: [8, 40], width: [3, 22], lean: [0, 0.15], satellites: [0, 8] },
    variants: { monolith: { height: [10, 16], width: [4, 7], satellites: [0, 2] }, arch: { height: [10, 16], width: [14, 20], kind: 'arch', satellites: [0, 2] }, spire: { height: [24, 40], width: [3, 5], lean: [0.04, 0.12], satellites: [0, 2] }, butte: { height: [10, 16], width: [16, 22], lean: [0, 0], kind: 'butte', satellites: [0, 2] }, split: { height: [8, 12], width: [8, 12], kind: 'split', satellites: [0, 2] }, falls: { height: [12, 20], width: [14, 20], lean: [0, 0], kind: 'falls', satellites: [0, 2] } },
    many: { dial: 'satellites', words: ['alone', 'a pair', 'a group', 'a cluster', 'a range'] },
    build: buildLandmark,
  },
});
export const LAND_FORM_IDS = Object.freeze(Object.keys(LAND_FORMS));
/** The step of little-to-many a dial value reads as: 0…4. */
export const manyStep = (many) => clamp(Math.round(many * 4), 0, 4);

/** Roll a form's dials: the variant narrows the rails, `over` pins them, `many` (0…1) pins its little-to-many dial. */
export function landDials(form, variant, seed, { over = {}, many = null } = {}) {
  const F = LAND_FORMS[form];
  if (!F) throw new Error(`land: '${form}' is not a land form (${LAND_FORM_IDS.join(', ')})`);
  const V = F.variants[variant];
  if (!V) throw new Error(`land: '${variant}' is not a ${form} (${Object.keys(F.variants).join(', ')})`);
  const rand = mulberry32(subSeed(seed, `land:${form}:${variant}`)), X = { form, variant };
  for (const [k, rail] of Object.entries(F.rails)) {
    let [lo, hi] = V[k] ?? rail;
    if (over[k] != null) [lo, hi] = Array.isArray(over[k]) ? over[k] : [over[k], over[k]];
    X[k] = mix(lo, hi, rand());
  }
  for (const [k, v] of Object.entries(V)) if (!Array.isArray(v)) X[k] = v;
  // little to many spans the whole rail, or (where the variant is its character: a hummock stays a hummock) the variant's
  if (many != null) { const [lo, hi] = F.many.span === 'variant' ? (V[F.many.dial] ?? F.rails[F.many.dial]) : F.rails[F.many.dial]; X[F.many.dial] = mix(lo, hi, clamp(many, 0, 1)); X.many = clamp(many, 0, 1); }
  for (const k of ['count', 'beds', 'joints', 'courses', 'terraces', 'puffs', 'satellites']) if (k in X) X[k] = Math.round(X[k]);
  return { X, rand };
}

/** One land form: its dials rolled for `seed`, built at a ring's level. → { dials, faces, elements, level }. */
export function designLand(form, variant, seed, { level = 'mid', over = {}, many = null } = {}) {
  const { X, rand } = landDials(form, variant, seed, { over, many }), L = { ...LAND_LEVELS[level], name: level }, faces = [], elements = [];
  LAND_FORMS[form].build(X, rand, L, faces, elements, seed);
  return { dials: X, faces, elements, level };
}

// ── the builds ────────────────────────────────────────────────────────────────
function buildLandscape(X, rand, L, out, el, seed) {
  const W = 60, D = 40, n = Math.max(4, Math.round(W / L.cell)), m = Math.max(3, Math.round(D / L.cell)), s = subSeed(seed, 'landscape');
  const h = (x, y) => {
    let z = X.relief * (0.65 * vnoise(x / X.wave, y / X.wave, s) + 0.35 * vnoise((2 * x) / X.wave, (2 * y) / X.wave, s + 7));
    z += X.bumps * 0.6 * (vnoise(x / 2.2, y / 2.2, s + 13) - 0.5);
    if (X.terraces >= 1) { const step = X.relief / (X.terraces + 1), k = Math.floor(z / step), f = z / step - k; z = (k + Math.min(1, Math.max(0, (f - 0.7) / 0.3))) * step; }
    return z;
  };
  const Z = Array.from({ length: m + 1 }, (_, j) => Array.from({ length: n + 1 }, (_, i) => h((i / n) * W, (j / m) * D)));
  const lo = Math.min(...Z.flat()), hi = Math.max(...Z.flat());
  for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
    const P = (a, b) => [((i + a) / n) * W - W / 2, ((j + b) / m) * D, Z[j + b][i + a] - lo];
    const q = [P(0, 0), P(1, 0), P(1, 1), P(0, 1)], nz = unit(cross(sub(q[1], q[0]), sub(q[3], q[0])))[2];
    const steep = nz < 0.72, low = (Z[j][i] - lo) / Math.max(0.01, hi - lo);
    face(out, q, steep ? 'rock' : 'ground', steep ? 0.5 : mix(0.35, 0.7, low));
  }
  // the skirt: the swath cut as a block at its front and its side, down to a base, so its relief reads
  const base = -1.2, P = (i, j) => [(i / n) * W - W / 2, (j / m) * D, Z[j][i] - lo];
  for (let i = 0; i < n; i++) { const a = P(i, 0), b = P(i + 1, 0); face(out, [[a[0], 0, base], [b[0], 0, base], b, a], 'soil', 0.4); }
  for (let j = 0; j < m; j++) { const a = P(n, j), b = P(n, j + 1); face(out, [[W / 2, a[1], base], [W / 2, b[1], base], b, a], 'soil', 0.34); }
  el.push({ what: X.variant, size: r3(hi - lo) });
}

function buildRock(X, rand, L, out, el) {
  const n = Math.max(1, X.count), sizes = [];
  for (let i = 0; i < n; i++) {
    const lead = i === 0, H = X.height * (lead ? 1 : mix(0.3, 0.7, rand())), a = rand() * 2 * Math.PI, d = lead ? 0 : X.spread * Math.sqrt(mix(0.15, 1, rand())), c = [Math.cos(a) * d, Math.sin(a) * d, 0];
    const lean = [X.lean * (rand() - 0.5) * H, X.lean * (rand() - 0.5) * H];
    if (X.variant === 'boulders' || (!lead && X.variant !== 'stack')) {
      const w = H * mix(0.6, 0.9, rand());
      if (X.round > 0.5) lump(out, [c[0], c[1], H * 0.4], [w * 0.6, w * 0.5, H * 0.55], L.detail, 'rock', mix(0.4, 0.6, rand()), 0);
      else prism(out, c, w * 0.6, w * 0.5, 0, H, L.sides, rand, { value: mix(0.4, 0.6, rand()), yaw: rand() * 3 });
    } else if (X.variant === 'tor') {
      // blocks stacked, each smaller and turned, the joints between them rounded
      let z = 0, w = H * 0.5;
      for (let k = 0; k < 3; k++) { const hk = H / 3; if (X.round > 0.45) lump(out, [c[0] + lean[0] * k / 3, c[1], z + hk / 2], [w, w * 0.8, hk * 0.62], L.detail, 'rock', 0.48 + k * 0.04, z); else prism(out, [c[0] + lean[0] * k / 3, c[1]], w, w * 0.8, z, z + hk, L.sides, rand, { value: 0.48 + k * 0.04, yaw: rand() }); z += hk * 0.92; w *= 0.8; }
    } else if (X.variant === 'stack') {
      prism(out, c, H * 0.22, H * 0.18, 0, H * 0.82, L.sides, rand, { value: 0.5, taper: 0.8 });
      prism(out, [c[0] + lean[0] * 0.3, c[1]], H * 0.17, H * 0.14, H * 0.82, H, L.sides, rand, { value: 0.56, taper: 0.7 });
    } else if (X.variant === 'hoodoo') {
      // a soft pillar under a hard cap, wider than its neck
      prism(out, c, H * 0.16, H * 0.15, 0, H * 0.8, L.sides, rand, { value: 0.44, taper: 0.55, part: lead ? 'soil' : 'rock' });
      prism(out, [c[0], c[1]], H * 0.17, H * 0.15, H * 0.8, H, L.sides, rand, { value: 0.56, taper: 0.9 });
    } else {
      // balanced: a narrow pedestal and a broad rock on it
      prism(out, c, H * 0.12, H * 0.1, 0, H * 0.45, L.sides, rand, { value: 0.44, taper: 0.7 });
      lump(out, [c[0] + lean[0], c[1], H * 0.72], [H * 0.36, H * 0.3, H * 0.28], L.detail, 'rock', 0.55, H * 0.45);
    }
    sizes.push(H);
  }
  for (const H of sizes) el.push({ what: X.variant, size: r3(H) });
}

function buildStrata(X, rand, L, out, el) {
  const W = 24, H = 14, T = 4, segs = L.segs, beds = Math.max(1, X.beds);
  // the bed boundaries: thickness graded and varied, then each line dipped and folded across the face
  const raw = Array.from({ length: beds }, (_, i) => Math.max(0.15, (1 + X.vary * (rand() * 2 - 1)) * (1 + X.grade * (0.5 - i / Math.max(1, beds - 1)) * 0.8)));
  const tot = raw.reduce((a, b) => a + b, 0), base = [0];
  for (const t of raw) base.push(base[base.length - 1] + (t / tot) * H);
  const tilt = Math.tan((X.dip * Math.PI) / 180), cut = X.kind === 'unconformity' ? H * 0.62 : Infinity;
  const line = (k, x) => {
    if (base[k] >= cut) return base[k];   // above the unconformity the beds lie level
    const z = base[k] + tilt * (x - W / 2) + X.fold * Math.sin((2 * Math.PI * x) / (W / 1.4));
    return clamp(Math.min(z, cut), 0, H);
  };
  for (let k = 0; k < beds; k++) {
    const soft = k % 2 === 1, y = soft ? 0.3 : 0, val = soft ? 0.36 + 0.1 * rand() : 0.52 + 0.14 * rand();
    for (let s = 0; s < segs; s++) {
      const xa = (s / segs) * W, xb = ((s + 1) / segs) * W, a0 = line(k, xa), b0 = line(k, xb), a1 = line(k + 1, xa), b1 = line(k + 1, xb);
      if (a1 - a0 < 0.02 && b1 - b0 < 0.02) continue;
      face(out, [[xa - W / 2, y, a0], [xb - W / 2, y, b0], [xb - W / 2, y, b1], [xa - W / 2, y, a1]], soft && X.vary > 0.35 ? 'soil' : 'rock', val);
    }
  }
  box(out, [-W / 2, 0.01, H], [W / 2, T, H + 0.4], 'ground', 0.55, 'front');
  face(out, [[W / 2, 0, 0], [W / 2, T, 0], [W / 2, T, H], [W / 2, 0, H]], 'rock', 0.4);
  el.push({ what: 'cliff', size: H });
}

function buildFace(X, rand, L, out, el) {
  const W = 24, H = 16, n = Math.max(1, X.joints), courses = Math.max(1, X.courses), wide = W / n;
  for (let i = 0; i < n; i++) {
    const x0 = -W / 2 + i * wide, x1 = x0 + wide * (X.kind === 'fluted' ? 0.86 : 0.98), top = H * (1 - X.jag * 0.35 * rand());
    let z = 0;
    for (let c = 0; c < courses; c++) {
      const hc = top / courses, last = c === courses - 1;
      const set = X.relief * rand() - (last ? X.overhang * 1.2 : 0), y0 = Math.max(-1.4, set);
      box(out, [x0, y0, z], [x1, 3 + y0, z + hc], 'rock', mix(0.42, 0.6, rand()), 'back bottom');
      z += hc;
    }
    if (X.jag > 0.5 && rand() < X.jag) prism(out, [(x0 + x1) / 2, 1.5], wide * 0.4, 1, top, top + X.jag * 3 * rand(), 4, rand, { value: 0.56, taper: 0.3 });
  }
  el.push({ what: 'cliff', size: H });
}

function buildCloud(X, rand, L, out, el) {
  // a lens is a stack of them, so a sky holds half as many, stacked lower nearer the far ring
  const n = Math.max(1, X.kind === 'lens' ? Math.ceil(X.puffs / 2) : X.puffs), lenses = Math.max(1, L.puffs), sizes = [];
  for (let i = 0; i < n; i++) {
    const a = rand() * 2 * Math.PI, d = X.spread * 0.5 * Math.sqrt(rand()), c = [Math.cos(a) * d, Math.sin(a) * d * 0.6, 0], s = X.size * mix(0.6, 1.1, rand());
    if (X.kind === 'cirrus') {
      // a streak: a long thin mass, combed one way
      lump(out, [c[0], c[1], 40], [s * 1.8, s * 0.18, s * X.tall], 0, 'cloud', 0.82);
    } else if (X.kind === 'lens') {
      for (let k = 0; k < Math.min(3, lenses + 1); k++) lump(out, [c[0], c[1], 30 + k * s * X.tall * 1.6], [s * (1 - k * 0.18), s * 0.7 * (1 - k * 0.18), s * X.tall], 0, 'cloud', 0.8 - k * 0.03);
    } else {
      // a flat-based heap: a broad base and puffs on it, taller where `tall`
      const base = 30;
      // the low poly a cloud is drawn in at every ring; far keeps only the heap, mid one puff on it, near three
      lump(out, [c[0], c[1], base], [s, s * 0.7, s * X.tall * 0.55], 0, 'cloud', 0.75, base);
      const puffs = X.variant === 'stratus' ? Math.min(1, L.puffs) : L.puffs;
      for (let k = 0; k < puffs; k++) lump(out, [c[0] + s * mix(-0.5, 0.5, rand()), c[1], base + s * X.tall * mix(0.2, 0.6, rand())], [s * 0.55, s * 0.45, s * X.tall * 0.6], 0, 'cloud', 0.85, base);
    }
    sizes.push(s);
  }
  // the underside a step darker: every face looking down
  for (const f of out) if (f.part === 'cloud' && f.normal[2] < -0.3) f.value = r3(f.value - 0.25);
  el.push({ what: X.variant, size: r3(Math.max(...sizes)) });
}

function buildLandmark(X, rand, L, out, el) {
  const H = X.height, Wd = X.width, sides = L.sides + 1;
  if (X.kind === 'arch') {
    // two legs and the span across them, bowed
    const leg = Wd * 0.18, span = Wd - 2 * leg;
    prism(out, [-Wd / 2 + leg / 2, 0], leg / 2, leg * 0.5, 0, H * 0.75, sides, rand, { taper: 0.9, value: 0.5 });
    prism(out, [Wd / 2 - leg / 2, 0], leg / 2, leg * 0.5, 0, H * 0.7, sides, rand, { taper: 0.9, value: 0.5 });
    const k = 8;
    for (let i = 0; i < k; i++) { const t0 = i / k, t1 = (i + 1) / k, xa = -span / 2 + span * t0, xb = -span / 2 + span * t1, za = H * 0.7 + Math.sin(Math.PI * t0) * H * 0.12, zb = H * 0.7 + Math.sin(Math.PI * t1) * H * 0.12; box(out, [xa - leg * 0.1, -leg * 0.4, Math.min(za, zb) + 0.2], [xb + leg * 0.1, leg * 0.4, Math.max(za, zb) + H * 0.18], 'rock', 0.54); }
  } else if (X.kind === 'butte') {
    prism(out, [0, 0], Wd / 2, Wd * 0.35, 0, H * 0.25, sides + 2, rand, { taper: 0.82, value: 0.42, part: 'soil' });
    prism(out, [0, 0], Wd * 0.41, Wd * 0.29, H * 0.25, H, sides + 2, rand, { taper: 0.94, value: 0.52 });
  } else if (X.kind === 'split') {
    prism(out, [-Wd * 0.22, 0], Wd * 0.22, Wd * 0.3, 0, H, sides, rand, { taper: 0.75, value: 0.5 });
    prism(out, [Wd * 0.24, 0], Wd * 0.2, Wd * 0.28, 0, H * 0.92, sides, rand, { taper: 0.75, value: 0.54 });
  } else if (X.kind === 'falls') {
    // a cliff with a notch, the water falling from it into a pool
    box(out, [-Wd / 2, 0, 0], [-1.6, 4, H], 'rock', 0.48, 'back bottom');
    box(out, [1.6, 0, 0], [Wd / 2, 4, H * 0.95], 'rock', 0.5, 'back bottom');
    box(out, [-1.6, 0.6, 0], [1.6, 4, H * 0.88], 'rock', 0.42, 'back bottom');
    face(out, [[-1.4, 0.4, 0.3], [1.4, 0.4, 0.3], [1.4, 0.4, H * 0.88], [-1.4, 0.4, H * 0.88]], 'water', 0.82);
    face(out, [[-4, -5, 0.05], [4, -5, 0.05], [4, 0.4, 0.05], [-4, 0.4, 0.05]], 'water', 0.6);
  } else {
    const lean = X.lean * H;
    prism(out, [0, 0], Wd / 2, Wd * 0.4, 0, H * 0.6, sides, rand, { taper: 0.82, value: 0.5 });
    prism(out, [lean * 0.5, 0], Wd * 0.41, Wd * 0.33, H * 0.6, H, sides, rand, { taper: X.variant === 'spire' ? 0.35 : 0.8, value: 0.55 });
  }
  el.push({ what: X.variant, size: r3(H) });
  for (let i = 0; i < X.satellites; i++) {
    const a = (i / Math.max(1, X.satellites)) * 2 * Math.PI + rand(), d = Wd * mix(0.9, 1.6, rand()), h = H * mix(0.2, 0.5, rand());
    prism(out, [Math.cos(a) * d, Math.sin(a) * d * 0.6 + Wd * 0.3], h * 0.25, h * 0.22, 0, h, L.sides, rand, { taper: 0.7, value: mix(0.45, 0.55, rand()) });
    el.push({ what: 'satellite', size: r3(h) });
  }
}

// ── the laws ──────────────────────────────────────────────────────────────────
/** What a form must keep: its ring's face budget; in a group, one leads (the greatest a quarter over the next). */
export const LAND_LAWS = Object.freeze([
  { id: 'budget', want: 'the faces inside the ring\'s budget', why: 'a far hill costs what a far hill is worth' },
  { id: 'one-leads', want: 'the greatest element at least 1.25 times the next', why: 'a group reads as one thing with company, not a crowd of equals' },
]);
export function landLaws(d) {
  const out = [], B = LAND_LEVELS[d.level].budget;
  if (d.faces.length > B) out.push({ law: 'budget', value: d.faces.length, want: `≤ ${B}` });
  const s = d.elements.map((e) => e.size).sort((a, b) => b - a);
  if (['rock', 'landmark'].includes(d.dials.form) && s.length > 1 && s[0] < 1.25 * s[1]) out.push({ law: 'one-leads', value: r3(s[0] / s[1]), want: '≥ 1.25' });
  return out;
}
