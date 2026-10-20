/**
 * DERMAL HAIR — the hair the dermal map's tracts grow (dermal-map.js), on any body with a chart (dermal-chart.js), for
 * the realistic register. Strands are the truth; a game's cards are derived from them, as the epidermis cube says.
 *
 *   BODY HAIR    the terminal tracts (the forearm, the shin, the chest, the beard's stubble, the axilla …): each follicle
 *                rooted on a skin face at the tract's density, leaving the skin at its `lift` along the tract's FLOW and
 *                bending down to lie on it within a millimetre (the brow's walk, epidermis.js, carried to the body:
 *                a hair never stands off the skin like a pin); a curl by tract (the chest's and the axilla's curl,
 *                the limbs' barely). A render's `share` thins the count; the tally says how many each strand stands for.
 *   SCALP        laid out FRACTALLY, clump by clump, never hair by hair (`growScalp`): the anime figure's named clumps
 *                (`SCALP_CLUMPS`) each own a territory of the scalp; a territory splits into SECTIONS, each the elastica's
 *                lock (polygonizer/hair-spine.js: B from its length³, so long locks fall and short ones stand), coiled by
 *                the hair's TYPE, lying on the scalp first, draped; every root a LEAF copied from its section, closing on
 *                it toward the tip. Each level wanders the length by its own factor, so no hem ends square. A curl's
 *                length is the hair's own (stretched): it FALLS shorter by the coil's shrinkage, as coily hair does.
 *   TYPES        straight, wavy, curly, coily (`HAIR_TYPES`: the curl's radius and period, frizz, stiffness, clumping,
 *                root volume, flyaways, sheen); the egocube's hair textures by the same words, the coily gap closed.
 *   CARDS        the leaves as ribbons on the head's shell over a wider, darker ribbon per section (the inner layer):
 *                the game's hair, derived; a few flyaways stray as strands. `hairShade` gives the shader its numbers (the root darker than the
 *                tip, the shifted dual highlight of a hair shader: the primary toward the root, the secondary tinted
 *                and toward the tip).
 *
 *   readScalp(spec)                       a style word, or { style, type, length, part, fringe, … } → the scalp groom
 *   growScalp(chart, dermis, scalp, opts) → { clumps, sections, leaves, cards, strands, shade, counts }
 *   growBodyHair(chart, dermis, opts)     → { strands, counts: { tract: { strands, represents } } }
 *
 * Metres in the chart's frame (z up). Seeded dice only (city/plan/dice.js `streamOf`): the same chart and dials grow the
 * same hair, strand for strand. No clock.
 */
import { streamOf } from '../city/plan/dice.js';
import { vnoise } from '../era/dirt.js';
import { dermisAt, hairColourOf, linHex, HEAD_LEVELS } from './dermal-map.js';
import { lockSpine, lockB, coilSpine, drapeSpine, keepOut } from '../polygonizer/hair-spine.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.sqrt(dot(a, a));
const unit = (a, fb = [0, 0, 1]) => { const l = len(a); return l > 1e-12 ? scl(a, 1 / l) : fb; };
const perp = (a, t) => sub(a, scl(t, dot(a, t)));
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const ad = (a, b) => { const d = Math.abs(a - b) % 1; return Math.min(d, 1 - d); };

/**
 * The hair's TYPES (hair artists' readings, tuned on the eyes gate): `curl` { radius (m), period (m: one turn's run
 * along the stretched hair), planar (an S-wave, not a helix) }, `frizz` (m, the tips' wander), `stiffness` (a spine word:
 * hair-spine.js SPINE_STIFFNESS), `clump` (0 … 1, how far a clump's children close on its guide at the tip), `volume`
 * (the root's lift, as the share of the lock held along its aim), `flyaways` (the share of children escaping),
 * `roughness` (the highlight's spread: straight hair glossy, coily matte).
 */
export const HAIR_TYPES = Object.freeze({
  straight: { curl: null, frizz: 0.0015, stiffness: 'limp', clump: 0.55, volume: 0.06, flyaways: 0.02, roughness: 0.25 },
  wavy: { curl: { radius: 0.007, period: 0.075, planar: true }, frizz: 0.003, stiffness: 'soft', clump: 0.62, volume: 0.1, flyaways: 0.035, roughness: 0.32 },
  curly: { curl: { radius: 0.008, period: 0.032 }, frizz: 0.004, stiffness: 'springy', clump: 0.72, volume: 0.16, flyaways: 0.05, roughness: 0.42 },
  coily: { curl: { radius: 0.0028, period: 0.008 }, frizz: 0.005, stiffness: 'stiff', clump: 0.5, volume: 0.3, flyaways: 0.07, roughness: 0.6 },
});

/**
 * The scalp's STYLES: `length` (m, stretched, at the back), the region's share of it (`front`, `sides`, `crown`), the
 * `part` (side | centre | none: swept back), a `fringe` (the front combed forward over the brow), `ragged` (how much each
 * level's length wanders: 0 a buzz's even cut). A style under 4 cm lies on the scalp as body hair does: no clumps.
 */
export const SCALP_STYLES = Object.freeze({
  buzz: { length: 0.006, front: 1, sides: 0.8, crown: 1, part: 'none', fringe: false, ragged: 0 },
  crop: { length: 0.03, front: 1.1, sides: 0.6, crown: 1, part: 'none', fringe: false },
  short: { length: 0.07, front: 1, sides: 0.55, crown: 1.05, part: 'side', fringe: false },
  bob: { length: 0.2, front: 0.7, sides: 0.9, crown: 0.6, part: 'side', fringe: false },
  shoulder: { length: 0.32, front: 0.55, sides: 0.85, crown: 0.6, part: 'side', fringe: false },
  long: { length: 0.5, front: 0.5, sides: 0.85, crown: 0.6, part: 'centre', fringe: false },
});
const SCALP_KEYS = ['style', 'type', 'length', 'front', 'sides', 'crown', 'part', 'fringe', 'ragged', 'spacing', 'split', 'seed', 'stiffness', 'volume', 'frizz', 'clump'];

/** The scalp groom: a style word, or { style, type, …the style's numbers over it, spacing (m, between roots), split (roots a
 * section), seed }. */
export function readScalp(spec = 'short') {
  const doc = typeof spec === 'string' ? { style: spec } : spec || {};
  for (const k of Object.keys(doc)) if (!SCALP_KEYS.includes(k)) throw new Error(`scalp: unknown key '${k}' (have ${SCALP_KEYS.join(', ')})`);
  const st = SCALP_STYLES[doc.style || 'short'];
  if (!st) throw new Error(`scalp: unknown style '${doc.style}' (have ${Object.keys(SCALP_STYLES).join(', ')})`);
  const ty = HAIR_TYPES[doc.type || 'straight'];
  if (!ty) throw new Error(`scalp: unknown type '${doc.type}' (have ${Object.keys(HAIR_TYPES).join(', ')})`);
  const out = { style: doc.style || 'short', type: doc.type || 'straight', ragged: 1, ...st, ...ty, spacing: 0.009, split: 8, seed: 1, ...doc };
  if (!['side', 'centre', 'none'].includes(out.part)) throw new Error(`scalp: part '${out.part}' (side | centre | none)`);
  if (!(out.length > 0 && out.length <= 1.2)) throw new Error('scalp: length 0 … 1.2 m');
  if (!(out.spacing >= 0.004 && out.spacing <= 0.04)) throw new Error('scalp: spacing 0.004 … 0.04 m');
  if (!(Number.isInteger(out.split) && out.split >= 1 && out.split <= 60)) throw new Error('scalp: split 1 … 60 (roots a section)');
  if (!(out.ragged >= 0 && out.ragged <= 2)) throw new Error('scalp: ragged 0 … 2 (0 a cut without wander: a buzz)');
  return Object.freeze(out);
}

/** The shrinkage of a coil: the share of the stretched length a curled hair falls (1 straight). */
export function curlShrink(curl) {
  if (!curl || !curl.radius || !curl.period) return 1;
  const r = curl.planar ? curl.radius / 2 : curl.radius;
  return 1 / Math.sqrt(1 + ((2 * Math.PI * r) / curl.period) ** 2);
}

/** The hair shader's numbers from a colour (linear RGB) and a type: the root, the tip, the two highlights. */
export function hairShade(colour, type = 'straight', { bleach = 0.15 } = {}) {
  const T = HAIR_TYPES[type] || HAIR_TYPES.straight;
  const root = colour.map((x) => x * 0.72), tip = colour.map((x) => Math.min(1, x * (1 + bleach) + 0.02 * bleach));
  return {
    root: linHex(root), tip: linHex(tip),
    // Kajiya-Kay / Marschner, as a game shades it: the primary (R) white and shifted toward the root, the secondary (TRT)
    // tinted with the hair's colour, broader and shifted toward the tip
    primary: { shift: -0.08, roughness: T.roughness }, secondary: { shift: 0.12, roughness: Math.min(0.9, T.roughness * 1.8), tint: linHex(colour.map((x) => Math.min(1, x * 1.6 + 0.04))) },
    scatter: 0.4 + 0.4 * (1 - Math.min(1, colour.reduce((a, b) => a + b, 0) / 1.5)),
  };
}

// ─── the skin's hull, for draping: per part, the outermost sample of each (along, around) cell ───
function hullColliders(chart, parts, gap) {
  const out = [];
  for (const key of Object.keys(chart.parts)) {
    if (!parts.includes(chart.parts[key].part)) continue;
    const cells = new Map();
    chart.samples.forEach((s, vi) => {
      if (!s || s.key !== key || s.feature) return;
      const c = `${Math.min(23, Math.floor(s.along * 24))}:${Math.floor(s.around * 32) % 32}`, b = cells.get(c);
      if (!b || s.radius > chart.samples[b].radius) cells.set(c, vi);
    });
    const vis = [...cells.values()].sort((a, b) => a - b);
    if (!vis.length) continue;
    out.push({ surface: { pts: vis.map((vi) => chart.vertices[vi]), nrm: vis.map((vi) => chart.samples[vi].n), gap, reach: 0.05, frame: chart.parts[key].part === 'head' } });
  }
  return out;
}

/** a point on a face at barycentric (b1, b2) with its interpolated frame and address (the around unwrapped) */
function onFace(chart, tri, b1, b2) {
  const w = [1 - b1 - b2, b1, b2], s = tri.map((vi) => chart.samples[vi]);
  const mix = (f) => [0, 1, 2].map((k) => w[0] * f(0)[k] + w[1] * f(1)[k] + w[2] * f(2)[k]);
  const p = mix((i) => chart.vertices[tri[i]]), n = unit(mix((i) => s[i].n));
  const ta = unit(perp(mix((i) => s[i].ta), n)), tr = unit(perp(mix((i) => s[i].tr), n), cross(n, ta));
  let ar = s.map((x) => x.around); if (Math.max(...ar) - Math.min(...ar) > 0.5) ar = ar.map((a) => (a < 0.5 ? a + 1 : a));
  const around = ((w[0] * ar[0] + w[1] * ar[1] + w[2] * ar[2]) % 1 + 1) % 1, along = w[0] * s[0].along + w[1] * s[1].along + w[2] * s[2].along;
  return { p, n, ta, tr, address: { key: s[0].key, part: s[0].part, side: s[0].side, along, around, length: s[0].length, girth: s[0].girth, ...(s[0].marks ? { marks: s[0].marks } : {}) } };
}
const faceArea = (chart, tri) => len(cross(sub(chart.vertices[tri[1]], chart.vertices[tri[0]]), sub(chart.vertices[tri[2]], chart.vertices[tri[0]]))) / 2;
const skinFace = (chart, tri) => tri.every((vi) => chart.samples[vi] && !chart.samples[vi].feature) && tri.every((vi) => chart.samples[vi].key === chart.samples[tri[0]].key);

/** How each tract curls (0 straight … 1 a tight curl) and how long its strands are drawn in steps. */
const TRACT_CURL = { chest: 0.7, trail: 0.5, axilla: 0.9, beard: 0.35, scalp: 0.2, forearm: 0.15, upperArm: 0.15, thigh: 0.2, shank: 0.2, hand: 0.1, finger: 0.1, foot: 0.15, toe: 0.1 };

/** one lying hair: rising at `lift` along `dir`, bending down to lie on the skin, curling sideways by `curl`, kept a
 * hair's breadth above the root's tangent plane */
function lyingHair(root, n, dir, L, lift, curl, dice) {
  const side = cross(n, dir), K = 5, pts = [add(root, scl(n, 0.00005))];
  const ph = dice() * Math.PI * 2, e0 = lift * (0.7 + 0.6 * dice());
  let p = pts[0];
  for (let k = 1; k <= K; k++) {
    const s = (k - 0.5) / K, e = e0 * (1 - s) ** 1.4 - 0.08 * s, phi = curl * 1.1 * Math.sin(ph + 5 * s) + (dice() - 0.5) * 0.25;
    const d = add(scl(add(scl(dir, Math.cos(phi)), scl(side, Math.sin(phi))), Math.cos(e)), scl(n, Math.sin(e)));
    p = add(p, scl(unit(d), L / K));
    const h = dot(sub(p, root), n); if (h < 0.00012) p = add(p, scl(n, 0.00012 - h));
    pts.push(p);
  }
  return pts;
}

/**
 * The body's terminal hair: strands on every skin face whose tract grows terminal hair (the scalp's left to
 * `growScalp`, unless `scalpLength` (m) is given: a buzz lies like body hair). `share` thins the count (0 … 1);
 * `tracts` keeps only those named.
 */
export function growBodyHair(chart, D, { share = 0.25, tracts = null, scalpLength = 0, ragged = 1, seed = D.seed } = {}) {
  const strands = [], counts = {};
  chart.faces.forEach((tri, fi) => {
    if (!skinFace(chart, tri)) return;
    const mid = onFace(chart, tri, 1 / 3, 1 / 3), H = dermisAt(mid.address, D, { detail: false }).hair;
    if (H.kind !== 'terminal' || (tracts && !tracts.includes(H.tract))) return;
    const scalp = H.tract === 'scalp';
    if (scalp && !scalpLength) return;
    const L = (scalp ? scalpLength * 1000 : H.length) / 1000;
    // a beard's shadow (under 1.5 mm) is the texture's follicles, not strands
    if (!(L > 0.0003) || (H.tract === 'beard' && L < 0.0015)) return;
    const dice = streamOf(seed, 'dermal-body', `${fi}`);
    const want = H.density * faceArea(chart, tri) * 1e4 * share, n = Math.floor(want) + (dice() < want % 1 ? 1 : 0);
    const c = (counts[H.tract] ??= { strands: 0, represents: Math.round(1 / share) });
    for (let i = 0; i < n; i++) {
      let b1 = dice(), b2 = dice(); if (b1 + b2 > 1) { b1 = 1 - b1; b2 = 1 - b2; }
      const at = onFace(chart, tri, b1, b2), h = dermisAt(at.address, D, { detail: false }).hair;
      if (h.kind !== 'terminal') continue;
      const th = h.flow + (dice() - 0.5) * 0.35, dir = unit(add(scl(at.ta, Math.cos(th)), scl(at.tr, Math.sin(th))));
      const pts = lyingHair(at.p, at.n, dir, L * (1 + 0.3 * ragged * (2 * dice() - 1)), h.lift, TRACT_CURL[h.tract] ?? 0.2, dice);
      strands.push({ pts, r: 0.00004, groom: h.tract });
      c.strands++;
    }
  });
  return { strands, counts };
}

/** a lock's root zone walked on the head's shell along `dir`, `gap` off it, in 4 mm steps: kept to the nearest hull
 * sample's tangent plane, until the shell faces neither up nor forward (the head's side, the back) or `max` is run; a
 * `hug`ging lock (a short cut) lies the whole of `max` wherever the shell faces */
function lieOnScalp(root, dir, heads, max, gap, hug = false) {
  const pts = heads.flatMap((c) => c.surface.pts), nrm = heads.flatMap((c) => c.surface.nrm);
  const nearest = (p) => { let bi = 0, bd = Infinity; for (let i = 0; i < pts.length; i++) { const d = (p[0] - pts[i][0]) ** 2 + (p[1] - pts[i][1]) ** 2 + (p[2] - pts[i][2]) ** 2; if (d < bd) { bd = d; bi = i; } } return bi; };
  let i0 = nearest(root), n = nrm[i0], p = add(root, scl(n, gap)), d = unit(perp(dir, n), dir), run = 0;
  const out = [p];
  if (!pts.length) return { pts: out, dir, run: 0, n };
  while (run + 0.004 <= max && (hug || n[2] > 0.35 || n[1] > 0.35)) {
    let q = add(p, scl(d, 0.004));
    const j = nearest(q), m = nrm[j];
    q = add(q, scl(m, gap - dot(sub(q, pts[j]), m)));   // back onto the shell, a gap off it
    d = unit(perp(sub(q, p), m), d); n = m; p = q; run += 0.004; out.push(p);
  }
  return { pts: out, dir: d, run, n };
}

/**
 * THE SCALP'S CLUMPS BY NAME: the anime figure's (anime-form.js `ANIME_LOCK_RE`: seven fringe clumps, three temple
 * clumps a side, eleven back clumps, six crown clumps), so one vocabulary directs hair in both registers. Each is placed
 * on whatever scalp it grows on by `az` (degrees round from the face's middle, + the head's right, as the studio's back
 * fan runs) and `rise` (0 the hairline there … 1 the vertex), and names its `region` (which share of the style's length
 * it takes).
 */
export const SCALP_CLUMPS = Object.freeze([
  ...Array.from({ length: 7 }, (_, k) => ({ name: `fringe-${k + 1}`, az: -48 + 16 * k, rise: 0.16, region: 'front' })),
  ...['left', 'right'].flatMap((side) => [0, 1, 2].map((j) => ({ name: `${side}-temple-${j}`, az: (side === 'left' ? -1 : 1) * (74 + 17 * j), rise: 0.28, region: 'sides' }))),
  ...Array.from({ length: 11 }, (_, i) => { const a = 104.4 + i * 15.12; return { name: `back-${i + 1}`, az: a > 180 ? a - 360 : a, rise: 0.42, region: 'back' }; }),
  ...[-1, 1].flatMap((side) => [0, 1, 2].map((j) => ({ name: `crown-${side}-${j}`, az: side * (25 + 55 * j), rise: 0.84, region: 'crown' }))),
].map(Object.freeze));

/** points resampled at equal arc: `n + 1` of them, and the line's length */
function arcResample(pts, n) {
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + len(sub(pts[i], pts[i - 1])));
  const L = cum[cum.length - 1], out = [];
  for (let k = 0, j = 0; k <= n; k++) {
    const s = (L * k) / n; while (j < pts.length - 2 && cum[j + 1] < s) j++;
    const t = cum[j + 1] > cum[j] ? (s - cum[j]) / (cum[j + 1] - cum[j]) : 0;
    out.push(add(pts[j], scl(sub(pts[j + 1], pts[j]), Math.max(0, Math.min(1, t)))));
  }
  return { pts: out, L };
}

/** a few seeded k-means rounds over points (indices into `P`): `k` groups, seeded by the farthest-point rule from the
 * first point, so the same points always split the same way */
function kmeans(P, ids, k) {
  if (k <= 1 || ids.length <= k) return k <= 1 ? [ids] : ids.map((i) => [i]);
  const cs = [P[ids[0]]];
  while (cs.length < k) { let bi = ids[0], bd = -1; for (const i of ids) { const d = Math.min(...cs.map((c) => len(sub(P[i], c)))); if (d > bd) { bd = d; bi = i; } } cs.push(P[bi]); }
  let groups = [];
  for (let it = 0; it < 6; it++) {
    groups = cs.map(() => []);
    for (const i of ids) { let b = 0, bd = Infinity; cs.forEach((c, g) => { const d = len(sub(P[i], c)); if (d < bd) { bd = d; b = g; } }); groups[b].push(i); }
    groups.forEach((g, gi) => { if (g.length) cs[gi] = scl(g.reduce((a, i) => add(a, P[i]), [0, 0, 0]), 1 / g.length); });
  }
  return groups.filter((g) => g.length);
}

/**
 * The scalp, laid out FRACTALLY: not hair by hair, but clump by clump, each level a copy of the one above.
 *
 *   level 0   the named clumps (`SCALP_CLUMPS`), each owning its TERRITORY of the scalp (every root goes to its nearest
 *             clump): its comb, its share of the length, its own length's wander, and the hand and the phase its curls
 *             turn with (a clump's sections coil in step, so it reads as one lock)
 *   level 1   SECTIONS: a territory split into groups of about `split` roots; each section the elastica's lock
 *             (hair-spine.js) from its middle root, combed (the part, the face kept clear, a fringe forward), lying on the
 *             scalp first, coiled by the type, draped; its tip drawn a little toward its clump's (the clump's mass)
 *   level 2   LEAVES: every root a copy of its section's spine, set off by its root's offset and closing on it toward
 *             the tip by the type's `clump` (tight tips, loose roots), its own length's wander again
 *
 * Every level multiplies the length by its own seeded factor (`ragged`: 0 a cut with no wander, a buzz's), so a hem is
 * ragged without a rule for it. The leaves are the game's CARDS (ribbons on the head's shell, a leaf's width at the root
 * narrowing to the tip), the sections a wider, darker card under them (the inner layer, so no scalp shows between), and
 * a few FLYAWAYS stray from the leaves as strands. A style under 4 cm lies on the scalp as body hair does (no clumps).
 * `opts.colliders` the parts the locks drape over (default the head, the neck, the trunk and the upper arms).
 */
export function growScalp(chart, D, scalp, { colliders = ['head', 'neck', 'trunk', 'upperArm'] } = {}) {
  const S = scalp, colour = hairColourOf(D), shade = hairShade(colour, S.type);
  const empty = (extra = {}) => ({ clumps: [], sections: [], leaves: [], cards: [], strands: [], guides: [], shade, counts: { clumps: 0, sections: 0, leaves: 0, cards: 0, strands: 0, ...extra } });
  if (S.length < 0.04) {
    const body = growBodyHair(chart, D, { share: 0.5, tracts: ['scalp'], scalpLength: S.length, ragged: S.ragged, seed: S.seed });
    return { ...empty({ strands: body.strands.length, lying: true }), strands: body.strands };
  }
  // ── the roots: darts thrown over the scalp's faces by area, none nearer than the spacing's 0.8 ──
  const scalpOf = new Map();
  const isScalp = (vi) => { if (!scalpOf.has(vi)) { const s = chart.samples[vi]; scalpOf.set(vi, !!s && !s.feature && s.part === 'head' && (dermisAt(s, D, { detail: false }).regions.scalp || 0) > 0.5); } return scalpOf.get(vi); };
  const faces = chart.faces.filter((tri) => skinFace(chart, tri) && tri.every(isScalp));
  const areas = faces.map((tri) => faceArea(chart, tri)), total = areas.reduce((a, b) => a + b, 0);
  if (!faces.length) return empty();
  const dice = streamOf(S.seed, 'dermal-scalp', 'roots'), sp = S.spacing, cell = sp * 0.8, grid = new Map(), roots = [];
  const cum = []; areas.reduce((a, b, i) => (cum[i] = a + b), 0);
  const tries = Math.ceil((total / (sp * sp)) * 6);
  for (let t = 0; t < tries; t++) {
    const x = dice() * total; let lo = 0, hi = cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < x) lo = m + 1; else hi = m; }
    let b1 = dice(), b2 = dice(); if (b1 + b2 > 1) { b1 = 1 - b1; b2 = 1 - b2; }
    const at = onFace(chart, faces[lo], b1, b2), g = at.p.map((v) => Math.floor(v / cell));
    let ok = true;
    for (let i = -1; i <= 1 && ok; i++) for (let j = -1; j <= 1 && ok; j++) for (let k = -1; k <= 1 && ok; k++) {
      for (const q of grid.get(`${g[0] + i},${g[1] + j},${g[2] + k}`) || []) if (len(sub(q, at.p)) < cell) { ok = false; break; }
    }
    if (!ok) continue;
    const key = g.join(','); (grid.get(key) || grid.set(key, []).get(key)).push(at.p);
    roots.push(at);
  }
  const P = roots.map((r) => r.p);
  // ── level 0: each named clump on this scalp (its azimuth, its rise above the hairline there), and its territory ──
  const BINS = 36, hl = new Array(BINS).fill(1);
  for (const r of roots) { const b = Math.floor(r.address.around * BINS) % BINS; hl[b] = Math.min(hl[b], r.address.along); }
  const riseOf = (r) => { const h = hl[Math.floor(r.address.around * BINS) % BINS]; return (r.address.along - h) / Math.max(1e-6, 1 - h); };
  const named = SCALP_CLUMPS.map((C) => {
    const a0 = (((C.az / 360) % 1) + 1) % 1;
    let bi = -1, bc = Infinity;
    roots.forEach((r, i) => { const d = ad(r.address.around, a0) * 2 * Math.PI, e = riseOf(r) - C.rise, c = d * d + 2 * e * e; if (c < bc) { bc = c; bi = i; } });
    return { ...C, seat: bi };
  }).filter((C) => C.seat >= 0);
  const owner = P.map((p) => { let b = 0, bd = Infinity; named.forEach((C, ci) => { const d = len(sub(p, P[C.seat])); if (d < bd) { bd = d; b = ci; } }); return b; });
  // ── the comb at a root: down from the crown (the whorl radiates), off the part on top, back where there is none; a
  // fringe forward over the brow; otherwise nothing falls in front of the face ──
  const pAround = S.part === 'side' ? 0.92 : 0;
  const combAt = (at) => {
    const a = at.address, fd = ad(a.around, 0), u = a.along, down = scl(at.ta, -1);
    const top = smooth(0.62, 0.86, u) * (1 - smooth(0.3, 0.42, fd));
    let away;
    if (S.part === 'none') { const sg = ((0.5 - a.around) % 1 + 1) % 1 <= 0.5 ? 1 : -1; away = scl(at.tr, sg); }
    else { const d = ((a.around - pAround + 1.5) % 1) - 0.5; away = scl(at.tr, Math.sign(d) || 1); }
    const fringe = S.fringe && fd < 0.13 && u > HEAD_LEVELS.hairline - 0.12, wAway = Math.max(top, fringe ? 0 : 1 - smooth(0.16, 0.24, fd));
    let comb = fringe ? down : unit(add(scl(down, 1 - 0.75 * wAway), scl(away, wAway)));
    if (!fringe && fd < 0.22 && comb[1] > 0) comb = unit([comb[0], 0.15 * comb[1], comb[2]]);
    return { comb, fringe };
  };
  const cols = hullColliders(chart, colliders, 0.004 + 0.01 * S.volume), headC = cols.filter((c) => c.surface.frame);
  const k = curlShrink(S.curl), R0 = S.ragged ?? 1, REG = { front: S.front, sides: S.sides, back: 1, crown: S.crown };
  const jitter = (d, sigma) => 1 + R0 * sigma * (2 * d() - 1);
  const clumps = named.map((C, ci) => {
    const cd = streamOf(S.seed, 'dermal-clump', C.name);
    return { name: C.name, region: C.region, root: P[C.seat], f0: jitter(cd, 0.08), hand: cd() < 0.5 ? 1 : -1, phase: cd() * Math.PI * 2, comb: combAt(roots[C.seat]).comb, roots: P.map((_, i) => i).filter((i) => owner[i] === ci), sections: [] };
  });
  // ── level 1: the sections, each its own lock ──
  const sections = [];
  for (const C of clumps) {
    if (!C.roots.length) continue;
    const groups = kmeans(P, C.roots, Math.max(1, Math.round(C.roots.length / S.split)));
    groups.forEach((ids, gi) => {
      const c = scl(ids.reduce((a, i) => add(a, P[i]), [0, 0, 0]), 1 / ids.length);
      const ri = ids.reduce((b, i) => (len(sub(P[i], c)) < len(sub(P[b], c)) ? i : b), ids[0]), at = roots[ri];
      const sd = streamOf(S.seed, 'dermal-section', `${C.name}/${gi}`);
      const { comb: own, fringe } = combAt(at), comb = unit(perp(add(own, scl(C.comb, 0.6)), at.n), own);
      const L = S.length * REG[C.region] * C.f0 * jitter(sd, 0.1), F = L * k;
      const lie = fringe ? { pts: [add(at.p, scl(at.n, 0.0008))], dir: comb, run: 0, n: at.n } : lieOnScalp(at.p, comb, headC, Math.min((L < 0.12 ? 0.85 : 0.45) * F, 0.12), 0.0008 + 0.004 * S.volume, L < 0.12);
      const free = Math.max(0.004, F - lie.run), lastN = lie.n || at.n;
      const turns = S.curl ? free / (S.curl.period * k) : 0, n = Math.min(220, Math.max(12, Math.ceil(8 * turns) + 4));
      let pts = lockSpine({ root: lie.pts[lie.pts.length - 1], aim: unit(add(fringe ? comb : lie.dir, scl(lastN, 0.12 + 0.6 * S.volume))), L: free, B: lockB(S.stiffness, free), hold: lie.run ? 0 : S.volume, n });
      if (S.curl) pts = coilSpine(pts, { radius: S.curl.radius, turns, hand: C.hand, from: 0.04 }, free, lastN, !!S.curl.planar, C.phase);
      pts = drapeSpine(pts, cols, 0.04);
      const line = arcResample([...lie.pts.slice(0, -1), ...pts], Math.min(240, Math.max(16, n + lie.pts.length)));
      const sec = { clump: C.name, root: at.p, n: at.n, ta: at.ta, tr: at.tr, roots: ids, pts: line.pts, L: line.L };
      C.sections.push(sec); sections.push(sec);
    });
    // the clump's mass: each section's tip drawn a little toward the clump's mean line (a fall's panels)
    if (C.sections.length > 1) {
      const N = Math.min(...C.sections.map((q) => q.pts.length)) - 1, meanAt = (i) => scl(C.sections.reduce((a, q) => add(a, q.pts[Math.min(q.pts.length - 1, Math.round((i * (q.pts.length - 1)) / N))]), [0, 0, 0]), 1 / C.sections.length);
      const pull = 0.25 * S.clump;
      for (const q of C.sections) { const M = q.pts.length - 1; q.pts = q.pts.map((p, i) => { const s = i / M, w = pull * s * s; if (!w) return p; return keepOut(add(scl(p, 1 - w), scl(meanAt(Math.round(s * N)), w)), cols, 0.04).p; }); }
    }
  }
  // ── level 2: the leaves, each a copy of its section ──
  const leaves = [], strands = [];
  for (const sec of sections) {
    const M = sec.pts.length - 1, tan = (i) => unit(sub(sec.pts[Math.min(M, i + 1)], sec.pts[Math.max(0, i - 1)]));
    for (const ri of sec.roots) {
      const ld = streamOf(S.seed, 'dermal-leaf', `${ri}`), off0 = perp(sub(P[ri], sec.root), sec.n);
      const f2 = jitter(ld, 0.16), end = Math.max(2, Math.min(M, Math.round(M * Math.min(1, f2)))), close = S.clump * (0.8 + 0.4 * ld());
      const pts = [];
      for (let i = 0; i <= end; i++) { const s = i / M; let p = add(sec.pts[i], scl(perp(off0, tan(i)), 1 - close * s ** 0.8)); if (i > 1) p = keepOut(p, s < 0.5 ? headC : cols, 0.04).p; pts.push(p); }
      // a leaf longer than its section runs on along the section's last direction
      if (f2 > 1) { const extra = Math.round(M * (f2 - 1)), t = tan(M), step = sec.L / M; for (let i = 1; i <= extra; i++) pts.push(keepOut(add(pts[pts.length - 1], add(scl(t, step), [0, 0, -step * 0.3 * (i / Math.max(1, extra))])), cols, 0.04).p); }
      leaves.push({ clump: sec.clump, section: sections.indexOf(sec), root: P[ri], pts });
      // a few flyaways stray from the leaf as strands, frizzed and lifted off the mass
      if (ld() < S.flyaways * 2) {
        const seed = (S.seed * 131 + ri * 977) | 0, Lf = pts.length - 1, fly = [];
        for (let i = 0; i <= Lf; i++) { const s = i / Lf, f = S.frizz * 3.5 * s ** 1.5; fly.push(add(add(pts[i], scl(sec.n, 0.01 * s * s)), [f * (vnoise(s * 9, 0.5, seed) - 0.5) * 2, f * (vnoise(s * 9, 3.5, seed) - 0.5) * 2, f * (vnoise(s * 9, 6.5, seed) - 0.5) * 2])); }
        strands.push({ pts: fly, r: 0.00004, groom: 'flyaway', clump: sec.clump });
      }
    }
  }
  // ── the cards: a ribbon per leaf over a wider, darker ribbon per section, each lying on the head's shell ──
  const ax = chart.parts[Object.keys(chart.parts).find((q) => chart.parts[q].part === 'head')]?.axis ?? [[0, 0, 0], [0, 0, 1]];
  const mid = scl(add(ax[0], ax[ax.length - 1]), 0.5);
  const ribbon = (pts, w0, w1, level, clump, fb) => {
    const N = pts.length - 1;
    const side = pts.map((p, i) => unit(cross(unit(sub(pts[Math.min(N, i + 1)], pts[Math.max(0, i - 1)])), unit(sub(p, mid))), fb));
    return { level, clump, pts, side, width: pts.map((_, i) => w0 + (w1 - w0) * (i / Math.max(1, N))), v: pts.map((_, i) => i / Math.max(1, N)) };
  };
  const cards = [
    ...sections.map((q) => { const r = Math.sqrt(q.roots.reduce((a, i) => a + len(sub(P[i], q.root)) ** 2, 0) / q.roots.length); const w = Math.max(sp * 1.6, 2.2 * r); return ribbon(q.pts, w, w * (1 - 0.5 * S.clump), 'section', q.clump, q.tr); }),
    ...leaves.map((l) => ribbon(l.pts, sp * 1.4, sp * 1.4 * (1 - 0.7 * S.clump), 'leaf', l.clump, sections[l.section].tr)),
  ];
  return {
    clumps: clumps.map(({ name, region, root, sections: q }) => ({ name, region, root, sections: q.length })), sections, leaves, cards, strands, guides: sections, shade,
    counts: { clumps: clumps.filter((c) => c.sections.length).length, sections: sections.length, leaves: leaves.length, cards: cards.length, strands: strands.length, scalpCm2: Math.round(total * 1e4), shrink: k },
  };
}
