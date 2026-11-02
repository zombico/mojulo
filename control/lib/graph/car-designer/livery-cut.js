/**
 * THE LIVERY, CUT: a vehicle's paint as words, the pattern cut into its painted faces as geometry (no texture, so any
 * engine gets it as drawn). The supercar's livery (vehicle-livery.js) cuts at planes; this cuts at contours too, for
 * CAMO: a seeded field over the vehicle's own space, its bands the pattern's colours, each painted face divided and cut
 * exactly where the field crosses a band's edge, so a blotch is crisp and runs on over seams, plates and fittings as a
 * sprayed one does. A shared edge is cut at one point from either side (computed from its ends in sorted order).
 *
 *   livery  'woodland' | { pattern, colours?, scale?, angle?, seed?, marks? }
 *     pattern   mono (one colour) or a camo: CAMO's (woodland, desert, tiger, winter, urban, digital)
 *     colours   ['#rrggbb', …] over the pattern's own, in band order (the first is the base, the most of it)
 *     scale     the blotch's size in metres (0.15 to 3; the pattern's own by default)
 *     angle     degrees the pattern turns about the vertical (a tiger's stripes along the hull by default)
 *     seed      the field's (the vehicle's seed by default)
 *     marks     { number?: '<digits>' | false, emblem?: 'chevron' | 'bar' | false } | false: stencils on the body's
 *               mark anchors (a number from the seed and a chevron by default)
 *
 *   readLivery(livery)                         → the livery read whole (pattern, colours, scale, angle, seed?, marks),
 *                                                or throws naming what it takes; absent → null
 *   camoForSetting({ kit?, biome?, words? })   → the camo a setting reads (a jungle's tiger, a desert's sand), or null
 *   liveryBase(L)                              → the base colour (its first band)
 *   paintLivery(faces, L, { base, seed })      → the faces in `base` paint cut and coloured; every other face as it was
 *   stencilMarks(anchors, L, { seed, emblemAt?, numberAt? }) → the marks' faces on the body's mark anchors
 *
 * Pure and deterministic: the field is hashed integer noise (Math.imul), interpolated in plain arithmetic.
 */
import { face } from './mil-hull.js';
import { mulberry32 } from '../vegetation/grow.js';

// ── the patterns ────────────────────────────────────────────────────────────────
// each: its colours in band order (the base first), each band's share of the painted area, the blotch scale (m), its
// stretch per axis (x across, y along, z up: a tiger's stripes long along the hull and short up it), how far its field
// is warped (an organic edge), and for a digital pattern the cell it is quantised to
export const CAMO = Object.freeze({
  woodland: Object.freeze({ reads: 'four-tone woodland: green, dark green, brown and black blotches', colours: ['#56653a', '#3a472a', '#5b4631', '#1e1f1a'], shares: [0.4, 0.25, 0.2, 0.15], scale: 0.55, stretch: [1, 1, 1], warp: 0.55 }),
  desert: Object.freeze({ reads: 'desert: sand with soft brown and pale clouds', colours: ['#b49b6c', '#8a6e48', '#d3c398'], shares: [0.52, 0.3, 0.18], scale: 0.9, stretch: [1, 1.2, 0.9], warp: 0.4 }),
  tiger: Object.freeze({ reads: 'tiger stripe: long dark stripes along the hull over green', colours: ['#5a643a', '#2e3922', '#1b1c17'], shares: [0.46, 0.32, 0.22], scale: 0.45, stretch: [1, 3.4, 0.55], warp: 0.32 }),
  winter: Object.freeze({ reads: 'winter: white wash over the base, patches showing through', colours: ['#dfe2dc', '#4b5320'], shares: [0.7, 0.3], scale: 0.7, stretch: [1, 1, 1], warp: 0.6 }),
  urban: Object.freeze({ reads: 'urban: greys, blotched hard', colours: ['#8c9090', '#5e6365', '#c3c5c0', '#2c2f31'], shares: [0.36, 0.28, 0.21, 0.15], scale: 0.6, stretch: [1, 1, 1], warp: 0.25 }),
  digital: Object.freeze({ reads: 'digital: woodland\'s tones in square cells', colours: ['#56653a', '#3a472a', '#6e5f42', '#24261e'], shares: [0.4, 0.27, 0.2, 0.13], scale: 0.5, stretch: [1, 1, 1], warp: 0.4, cell: 0.14 }),
});
export const CAMO_IDS = Object.freeze(Object.keys(CAMO));
export const LIVERY_PATTERNS = Object.freeze(['mono', ...CAMO_IDS]);
export const EMBLEMS = Object.freeze(['chevron', 'bar']);
const LIVERY_KEYS = Object.freeze(['pattern', 'colours', 'scale', 'angle', 'seed', 'marks']);
const HEX = /^#[0-9a-f]{6}$/;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** The livery read whole, or null when absent; a word is its pattern. */
export function readLivery(livery) {
  if (livery === undefined || livery === null) return null;
  const L = typeof livery === 'string' ? { pattern: livery } : livery;
  const fail = (m) => new Error(`livery: ${m} (a livery is a pattern, ${LIVERY_PATTERNS.join(' | ')}, or { ${LIVERY_KEYS.join(', ')} })`);
  if (!isObj(L)) throw fail('it is a word or an object');
  for (const k of Object.keys(L)) if (!LIVERY_KEYS.includes(k)) throw fail(`'${k}' is not one of its words`);
  const pattern = L.pattern ?? 'mono';
  if (!LIVERY_PATTERNS.includes(pattern)) throw fail(`'${pattern}' is no pattern`);
  const P = CAMO[pattern] ?? { colours: ['#4b5320'], scale: 1 };
  if (L.colours !== undefined && (!Array.isArray(L.colours) || !L.colours.length || L.colours.length > P.colours.length || !L.colours.every((c) => typeof c === 'string' && HEX.test(c.toLowerCase())))) {
    throw fail(`colours are up to ${P.colours.length} '#rrggbb' for ${pattern}, the base first`);
  }
  const colours = P.colours.map((c, i) => (L.colours?.[i] ?? c).toLowerCase());
  const scale = L.scale ?? P.scale;
  if (typeof scale !== 'number' || !(scale >= 0.15 && scale <= 3)) throw fail('scale is a blotch\'s size in metres, 0.15 to 3');
  const angle = L.angle ?? 0;
  if (typeof angle !== 'number' || !Number.isFinite(angle)) throw fail('angle is degrees about the vertical');
  if (L.seed !== undefined && !Number.isInteger(L.seed)) throw fail('seed is an integer');
  let marks = { number: null, emblem: 'chevron' };
  if (L.marks === false) marks = false;
  else if (L.marks !== undefined) {
    if (!isObj(L.marks) || Object.keys(L.marks).some((k) => !['number', 'emblem'].includes(k))) throw fail('marks are { number?, emblem? } or false');
    const { number = null, emblem = 'chevron' } = L.marks;
    if (number !== null && number !== false && !(typeof number === 'string' && /^\d{1,4}$/.test(number))) throw fail('a mark\'s number is one to four digits, or false');
    if (emblem !== false && !EMBLEMS.includes(emblem)) throw fail(`a mark's emblem is one of ${EMBLEMS.join(', ')}, or false`);
    marks = { number, emblem };
  }
  return { pattern, colours, scale, angle, ...(L.seed !== undefined ? { seed: L.seed } : {}), marks };
}

export const liveryBase = (L) => L.colours[0];

// the settings that read a camo: a world's kit by name, a biome, else the words in either (a jungle's tiger stripe, a
// desert's sand, the snow's white, a city's greys, an alien world's cells; a green land's woodland)
const SETTING_WORDS = Object.freeze([
  [['jungle', 'bamboo', 'swamp', 'tropical', 'rainforest'], 'tiger'],
  [['desert', 'dune', 'sand', 'arid', 'mesa', 'canyon', 'savanna', 'coast', 'beach'], 'desert'],
  [['snow', 'alpine', 'arctic', 'winter', 'tundra', 'ice', 'glacier', 'boreal'], 'winter'],
  [['city', 'urban', 'metro', 'street', 'airless', 'moon', 'lunar', 'industrial'], 'urban'],
  [['alien', 'future', 'neon', 'cyber'], 'digital'],
  [['valley', 'meadow', 'forest', 'wood', 'garden', 'sakura', 'trail', 'farm', 'hill', 'temperate', 'grass'], 'woodland'],
]);
/** The camo a setting reads, from its kit, its biome or its words, or null when it says nothing a camo answers. */
export function camoForSetting({ kit = null, biome = null, words = null } = {}) {
  const text = [kit, biome, words].filter((w) => typeof w === 'string').join(' ').toLowerCase();
  if (!text) return null;
  for (const [stems, camo] of SETTING_WORDS) if (stems.some((s) => text.includes(s))) return camo;
  return null;
}

// ── the field ───────────────────────────────────────────────────────────────────
function hash(x, y, z, s) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1442695041) ^ Math.imul(s, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
function valueNoise(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), u = fade(x - xi), v = fade(y - yi), w = fade(z - zi);
  const L = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz, s);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
// (two octaves: a blotch's edge is smooth, as a sprayed one is; a finer octave only wrinkles it and multiplies its cuts)
const fbm = (x, y, z, s) => 0.72 * valueNoise(x, y, z, s) + 0.28 * valueNoise(2.03 * x, 2.03 * y, 2.03 * z, s + 17);
/** The livery's field over vehicle space: its pattern's scale and stretch, turned by its angle, warped, summed. */
function fieldOf(L, seed) {
  const P = CAMO[L.pattern], a = (L.angle * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a), s = (seed * 7919 + 13) | 0;
  const k = [L.scale * P.stretch[0], L.scale * P.stretch[1], L.scale * P.stretch[2]];
  return (p) => {
    const x = (p[0] * ca - p[1] * sa) / k[0], y = (p[0] * sa + p[1] * ca) / k[1], z = p[2] / k[2];
    const wx = valueNoise(x * 0.7 + 11.3, y * 0.7, z * 0.7, s + 101) - 0.5, wy = valueNoise(x * 0.7, y * 0.7 + 7.1, z * 0.7, s + 211) - 0.5, wz = valueNoise(x * 0.7, y * 0.7, z * 0.7 + 3.7, s + 307) - 0.5;
    return fbm(x + 2 * P.warp * wx, y + 2 * P.warp * wy, z + 2 * P.warp * wz, s);
  };
}

// ── the cut ─────────────────────────────────────────────────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const unit = (a) => { const d = len(a) || 1; return [a[0] / d, a[1] / d, a[2] / d]; };
const r6 = (v) => Math.round(v * 1e6) / 1e6 + 0;
const before = (a, b) => (a[0] - b[0] || a[1] - b[1] || a[2] - b[2]) < 0;
const areaOf = (P) => { const n = [0, 0, 0]; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; n[0] += a[1] * b[2] - a[2] * b[1]; n[1] += a[2] * b[0] - a[0] * b[2]; n[2] += a[0] * b[1] - a[1] * b[0]; } return len(n) / 2; };

// a vertex: { p, n, v } (position, normal, the cutting function's value); the point where an edge crosses v = t, from its
// ends in sorted order, so the faces either side of it cut it at one point
function crossing(a, b, t) {
  const [P, Q] = before(a.p, b.p) ? [a, b] : [b, a], k = (t - P.v) / (Q.v - P.v);
  return { p: lerp(P.p, Q.p, k).map(r6), n: unit(lerp(P.n, Q.n, k)), v: t };
}
/** A polygon cut where its value crosses t: [the part below, the part at or above] (either may be empty). */
function clip(poly, t) {
  const lo = [], hi = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], ina = a.v < t, inb = b.v < t;
    (ina ? lo : hi).push(a);
    if (ina !== inb) { const c = crossing(a, b, t); lo.push(c); hi.push(c); }
  }
  return [lo, hi];
}
// a face's polygon divided into triangles, each split at its longest edge's middle while it is longer than `hMax` (a
// blotch could hide inside), or longer than `hMin` with a band's edge crossing it (`varies`): fine only along the
// contours, a band's breadth left whole
function divide(corners, normals, { hMax, hMin = hMax, varies = () => false }) {
  const out = [], mid = (a, b) => ({ p: [0, 1, 2].map((k) => r6((a.p[k] + b.p[k]) / 2)), n: unit([0, 1, 2].map((k) => a.n[k] + b.n[k])) });
  const split = (A, B, Cc, depth) => {
    const e = [len(sub(B.p, A.p)), len(sub(Cc.p, B.p)), len(sub(A.p, Cc.p))], m = Math.max(...e);
    if (depth > 16 || m <= hMin || (m <= hMax && !varies(A.p, B.p, Cc.p))) { out.push([A, B, Cc]); return; }
    if (e[0] === m) { const M = mid(A, B); split(A, M, Cc, depth + 1); split(M, B, Cc, depth + 1); }
    else if (e[1] === m) { const M = mid(B, Cc); split(A, B, M, depth + 1); split(A, M, Cc, depth + 1); }
    else { const M = mid(Cc, A); split(A, B, M, depth + 1); split(M, B, Cc, depth + 1); }
  };
  for (let i = 1; i + 1 < corners.length; i++) split({ p: corners[0], n: normals[0] }, { p: corners[i], n: normals[i] }, { p: corners[i + 1], n: normals[i + 1] }, 0);
  return out;
}

// a thin quad sliced across its length into pieces no longer than h: `along` 0 when its long sides are its first and
// third edges (corners 0→1 and 3→2), 1 when they are its second and fourth (1→2 and 0→3)
function strip(q, along, h) {
  const [a0, a1, b0, b1] = along === 0 ? [q[0], q[1], q[3], q[2]] : [q[1], q[2], q[0], q[3]];
  const n = Math.max(1, Math.ceil(Math.max(len(sub(a1.p, a0.p)), len(sub(b1.p, b0.p))) / h));
  const at = (A, B, t) => ({ p: lerp(A.p, B.p, t).map(r6), n: unit(lerp(A.n, B.n, t)) });
  const out = [];
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    out.push(along === 0 ? [at(a0, a1, t0), at(a0, a1, t1), at(b0, b1, t1), at(b0, b1, t0)] : [at(b0, b1, t0), at(a0, a1, t0), at(a0, a1, t1), at(b0, b1, t1)]);
  }
  return out;
}

// one face cut at a field's levels: a thin strip (a tube's side, a plate's round) sliced along its length, anything broader
// divided fine only where a level's contour crosses it (`varies`); each piece handed on with its band (the levels below it)
function cutFace(f, poly0, { valueAt, levels, hMax, hMin, stripH, varies }, onPiece) {
  const e = poly0.map((q, k) => len(sub(poly0[(k + 1) % poly0.length].p, q.p)));
  const thin = poly0.length === 4 && Math.min(Math.max(e[0], e[2]), Math.max(e[1], e[3])) < hMin;
  const pieces = thin ? strip(poly0, e[0] + e[2] >= e[1] + e[3] ? 0 : 1, stripH) : divide(f.corners, poly0.map((q) => q.n), { hMax, hMin, varies });
  for (const tri of pieces) {
    let rest = tri.map((q) => ({ ...q, v: valueAt(q.p) }));
    for (let b = 0; b < levels.length && rest.length >= 3; b++) {
      const [lo, hi] = clip(rest, levels[b]);
      if (lo.length >= 3 && areaOf(lo.map((q) => q.p)) >= 1e-9) onPiece(lo, b);
      rest = hi;
    }
    if (rest.length >= 3 && areaOf(rest.map((q) => q.p)) >= 1e-9) onPiece(rest, levels.length);
  }
}

/** Faces cut where a field crosses its levels: each face `select` takes divided along the contours (a thin strip sliced,
 *  a face too small to carry a contour or facing the ground left whole, its middle's band) and each piece remade by
 *  `remake(face, piece, band)` → { part, material, albedo } (the piece's look; the face's own when it returns null);
 *  every other face as it was. A piece keeps its face's part, edge and fitting unless remade. */
export function cutByField(faces, { select, valueAt, levels, hMax, hMin = hMax * 0.4, stripH = hMax * 0.5, remake }) {
  const centre = (P3) => [0, 1, 2].map((k) => P3.reduce((s2, q) => s2 + q[k], 0) / P3.length);
  const bandOf = (v) => levels.filter((t) => v >= t).length;
  const varies = (a, b, c) => {
    const pts = [a, b, c, centre([a, b]), centre([b, c]), centre([c, a]), centre([a, b, c])], b0 = bandOf(valueAt(pts[0]));
    return pts.some((p) => bandOf(valueAt(p)) !== b0);
  };
  const out = [];
  const piece = (f, poly, band) => {
    const look = remake(f, poly, band) ?? { part: f.part, material: f.material, albedo: f.albedo };
    const g = face(poly.map((q) => q.p), look, f.outNormal, poly.map((q) => q.n), f.edge ? { edge: true } : {});
    if (g) out.push(f.fitting ? { ...g, fitting: f.fitting } : g);
  };
  for (const f of faces) {
    if (!select(f)) { out.push(f); continue; }
    const ns = f.cornerNormals ?? f.corners.map(() => f.outNormal), poly0 = f.corners.map((p, k) => ({ p, n: ns[k] }));
    const tiny = Math.max(...f.corners.map((p, k) => len(sub(p, f.corners[(k + 1) % f.corners.length])))) < hMin;
    if (tiny || f.outNormal[2] < -0.6) {
      // (left whole: its band its middle's; a face no level reaches keeps its own look and its bytes)
      const band = bandOf(valueAt(centre(f.corners)));
      if (band === 0) out.push(f); else piece(f, poly0, band);
      continue;
    }
    // (a face no level reaches anywhere it is sampled kept whole, its bytes its own)
    const probe = [...f.corners, centre(f.corners), ...f.corners.map((p, k) => centre([p, f.corners[(k + 1) % f.corners.length]]))];
    const reach = Math.max(...f.corners.map((p, k) => len(sub(p, f.corners[(k + 1) % f.corners.length]))));
    if (reach <= 2 * hMax && probe.every((p) => bandOf(valueAt(p)) === 0)) { out.push(f); continue; }
    cutFace(f, poly0, { valueAt, levels, hMax, hMin, stripH, varies }, (poly, band) => piece(f, poly, band));
  }
  return out;
}

/** The value noise the livery's fields are made of (hashed integer lattice, smoothed): [0, 1). */
export const noise3 = (p, seed) => valueNoise(p[0], p[1], p[2], seed | 0);

/** The faces in `base` paint cut into the livery's bands and coloured; every other face as it was. */
export function paintLivery(faces, L, { base, seed = 1 } = {}) {
  if (!L) return faces;
  const painted = (f) => f.material === 'milPaint' && String(f.albedo).toLowerCase() === String(base).toLowerCase();
  if (L.pattern === 'mono') return faces.map((f) => (painted(f) ? { ...f, albedo: L.colours[0] } : f));
  const P = CAMO[L.pattern], field = fieldOf(L, L.seed ?? seed);
  // (a digital pattern's field is read at its cell's centre: a cell one colour, cut exactly at the cells' planes)
  const cellOf = (p) => p.map((x) => Math.floor(x / P.cell));
  const valueAt = P.cell ? (p) => field(cellOf(p).map((c) => (c + 0.5) * P.cell)) : field;
  const mine = faces.filter(painted), hMax = L.scale * 0.6, hMin = L.scale * 0.25;
  const normalsOf = (f) => f.cornerNormals ?? f.corners.map(() => f.outNormal);
  // (what faces the ground is one colour, its middle's, and stands out of the shares: it is not seen; a camo's face too
  // small to carry a contour is one colour too, a digital one is cut at its cells all the same)
  const down = (f) => f.outNormal[2] < -0.6;
  const small = (f) => !P.cell && Math.max(...f.corners.map((p, k) => len(sub(p, f.corners[(k + 1) % f.corners.length])))) < hMin;
  // the bands' edges: the field's levels that give each band its share of THIS vehicle's painted area, read from its
  // faces divided evenly (each piece's middle, by its area)
  const centre = (P3) => [0, 1, 2].map((k) => P3.reduce((s2, q) => s2 + q[k], 0) / P3.length);
  const samples = mine.filter((f) => !down(f)).flatMap((f) => divide(f.corners, normalsOf(f), { hMax: Math.min(hMax, P.cell ?? hMax) }).map((t) => ({ v: valueAt(centre(t.map((q) => q.p))), a: areaOf(t.map((q) => q.p)) }))).sort((a, b) => a.v - b.v);
  const total = samples.reduce((s2, x) => s2 + x.a, 0), levels = [];
  let acc = 0, want = 0, i = 0;
  for (let b = 0; b + 1 < P.shares.length; b++) {
    want += P.shares[b] * total;
    while (i < samples.length && acc + samples[i].a < want) acc += samples[i++].a;
    levels.push(samples[Math.min(i, samples.length - 1)]?.v ?? 0.5);
  }
  const bandOf = (v) => levels.filter((t) => v >= t).length;
  // where a band's edge may cross a triangle: its corners', its edges' middles' and its middle's bands differ
  const varies = (a, b, c) => {
    const pts = [a, b, c, centre([a, b]), centre([b, c]), centre([c, a]), centre([a, b, c])], b0 = bandOf(valueAt(pts[0]));
    return pts.some((p) => bandOf(valueAt(p)) !== b0);
  };
  const out = faces.filter((f) => !painted(f)), paint = (f, poly, band) => {
    if (areaOf(poly.map((q) => q.p)) < 1e-9) return;
    const g = face(poly.map((q) => q.p), { part: f.part, material: f.material, albedo: L.colours[band] }, f.outNormal, poly.map((q) => q.n), f.edge ? { edge: true } : {});
    if (g) out.push(f.fitting ? { ...g, fitting: f.fitting } : g);
  };
  for (const f of mine) {
    const ns = normalsOf(f), poly0 = f.corners.map((p, k) => ({ p, n: ns[k] }));
    if (down(f) || small(f)) { paint(f, poly0, bandOf(valueAt(centre(f.corners)))); continue; }
    if (P.cell) {
      // the digital pattern: the face cut at the cells' planes it crosses, each piece its cell's band
      let polys = [poly0];
      for (let k = 0; k < 3; k++) {
        const vs = f.corners.map((q) => q[k]), lo = Math.floor(Math.min(...vs) / P.cell) + 1, hi = Math.floor(Math.max(...vs) / P.cell);
        for (let c = lo; c <= hi; c++) polys = polys.flatMap((poly) => clip(poly.map((q) => ({ ...q, v: q.p[k] })), c * P.cell)).filter((poly) => poly.length >= 3);
      }
      for (const poly of polys) paint(f, poly, bandOf(valueAt(centre(poly.map((q) => q.p)))));
      continue;
    }
    // a camo: divided fine along its contours, each piece cut at the levels and coloured by its band
    cutFace(f, poly0, { valueAt, levels, hMax, hMin, stripH: L.scale * 0.3, varies }, (poly, band) => paint(f, poly, band));
  }
  return out;
}

// ── the marks ───────────────────────────────────────────────────────────────────
// a stencil digit's segments (a seven-segment figure with the stencil's bridges): [x0, z0, x1, z1] in a cell 0.6 wide and
// 1 high, its foot at 0
const SEG = Object.freeze({
  a: [0.08, 0.86, 0.52, 1], b: [0.46, 0.54, 0.6, 0.92], c: [0.46, 0.08, 0.6, 0.46], d: [0.08, 0, 0.52, 0.14],
  e: [0, 0.08, 0.14, 0.46], f: [0, 0.54, 0.14, 0.92], g: [0.08, 0.43, 0.52, 0.57],
});
const DIGIT = Object.freeze(['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abcdfg']);
/** The marks' colour against the base: a dark stencil on a pale camo, a pale one on a dark. */
const markColour = (L) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(L.colours[0].slice(i, i + 2), 16) / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#1f201c' : '#d8d3bf'; };

/** The marks' faces on the body's anchors (a mark anchor: { id, kind: 'mark', at, out, up, role: 'number' | 'emblem', h }). */
export function stencilMarks(anchors, L, { seed = 1 } = {}) {
  if (!L || !L.marks) return [];
  const look = { part: 'mark', material: 'primer', albedo: markColour(L) }, out = [];
  const number = L.marks.number === false ? null : L.marks.number ?? String(10 + (((seed * 2654435761) >>> 0) % 890));
  for (const A of anchors.filter((a) => a.kind === 'mark')) {
    // (reading left to right as one faces the surface: across is up × out)
    const ex = [A.up[1] * A.out[2] - A.up[2] * A.out[1], A.up[2] * A.out[0] - A.up[0] * A.out[2], A.up[0] * A.out[1] - A.up[1] * A.out[0]];
    const at = (x, z) => [0, 1, 2].map((k) => r6(A.at[k] + ex[k] * x + A.up[k] * z + A.out[k] * 0.003));
    const quad = (x0, z0, x1, z1) => face([at(x0, z0), at(x1, z0), at(x1, z1), at(x0, z1)], look, A.out);
    if (A.role === 'number' && number) {
      const h = A.h, w = 0.6 * h, gap = 0.18 * h, W = number.length * w + (number.length - 1) * gap;
      [...number].forEach((d, i) => {
        const x0 = -W / 2 + i * (w + gap);
        for (const s of DIGIT[Number(d)]) { const [a, b, c, e] = SEG[s]; out.push(quad(x0 + a * h, b * h - h / 2, x0 + c * h, e * h - h / 2)); }
      });
    }
    if (A.role === 'emblem' && L.marks.emblem) {
      const h = A.h;
      if (L.marks.emblem === 'bar') out.push(quad(-h, -h * 0.18, h, h * 0.18));
      else {
        // a chevron, point down: two bars meeting at the foot
        const t = h * 0.22, P2 = (x, z) => at(x, z);
        out.push(face([P2(-h, h / 2), P2(-h + t, h / 2), P2(t / 2, -h / 2 + t * 0.9), P2(0, -h / 2)].map((p) => p), look, A.out));
        out.push(face([P2(0, -h / 2), P2(-t / 2, -h / 2 + t * 0.9), P2(h - t, h / 2), P2(h, h / 2)], look, A.out));
      }
    }
  }
  return out.filter(Boolean);
}
