/**
 * TRAIL DRESS — what a trail is made of and how it is worn, read off its recipe (`trail`, out-trail.js) by the isekai
 * stage (era/isekai.js), which draws it:
 *
 *   surface   a ground word (era/arch-style.js MATERIAL_WORDS, the street's own): 'earth' (the dirt, the default),
 *             'stone-road', 'gravel' (the outdoor ones, IN_DIRT), 'flags', 'setts', 'pavement', 'asphalt',
 *             'brick-paving'. A paved trail leans its faces to the word's colour (a stone word with none, to the kit's
 *             rock) and, on a gritty land, takes its tile as a detail. An outdoor one is laid in the dirt: leant part of
 *             the way, its edge the dirt trail's (the verge from the dirt, the dirt spilled over its outer stones, the
 *             rubble beside it). A made one is kept: its fringe turf to its edge, no rubble
 *   rubble    false: no stones along a gritty dirt trail's edges (local-meru/broken-land.js strewEdge); true the default
 *   patches   false, or the patch kinds a gritty dirt trail is worn in (PATCH_KINDS); absent, PATCH_DEFAULT
 *
 *   readTrailDress(trail)   → { surface, rubble, patches } (the recipe's, checked; the defaults where it says nothing)
 *
 * Pure.
 */
import { MATERIAL_WORDS } from './arch-style.js';
import { hash3, vnoise } from './dirt.js';
import { kept } from './reserve.js';
import { normalizeTileSpec } from './tile-specs.js';
import { detailKey, layDetail } from '../matte-paint/detail.js';
import { GRIT_PIXELS } from '../matte-paint/fabric.js';

export const TRAIL_SURFACES = Object.freeze(Object.keys(MATERIAL_WORDS).filter((w) => MATERIAL_WORDS[w].on === 'ground'));
export const PATCH_KINDS = Object.freeze(['worn', 'damp', 'gravel', 'crown', 'puddle']);
export const PATCH_DEFAULT = Object.freeze(['worn', 'damp', 'gravel']);
export const TRAIL_DRESS_KEYS = Object.freeze(['surface', 'rubble', 'patches']);
// the outdoor surfaces, laid in the dirt: how far each leans from the dirt toward its own colour, and how far in from the
// edge the dirt covers it (m)
export const IN_DIRT = Object.freeze({ 'stone-road': Object.freeze({ share: 0.45, inward: 0.3 }), gravel: Object.freeze({ share: 0.5, inward: 0.15 }) });

/** A trail recipe's dress, checked: the defaults where it says nothing. */
export function readTrailDress(trail) {
  const t = trail && typeof trail === 'object' ? trail : {};
  const surface = t.surface ?? 'earth';
  if (!TRAIL_SURFACES.includes(surface)) throw new Error(`stage: trail.surface '${surface}' is not a ground word (${TRAIL_SURFACES.join(', ')})`);
  if (t.rubble !== undefined && typeof t.rubble !== 'boolean') throw new Error('stage: trail.rubble is true (stones along a gritty dirt trail\'s edges, the default) or false');
  let patches = PATCH_DEFAULT;
  if (t.patches === false) patches = [];
  else if (t.patches !== undefined && t.patches !== true) {
    if (!Array.isArray(t.patches) || !t.patches.length) throw new Error(`stage: trail.patches is false, true, or a list of patch kinds (${PATCH_KINDS.join(', ')})`);
    for (const k of t.patches) if (!PATCH_KINDS.includes(k)) throw new Error(`stage: trail.patches: '${k}' is not a patch kind (${PATCH_KINDS.join(', ')})`);
    patches = [...new Set(t.patches)];
  }
  return { surface, rubble: t.rubble !== false, patches };
}

// ── patches ─────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * The patches a gritty dirt trail is worn in, each a kind's blobs along it: `every` metres apart about (at a grit of 1),
 * `len` long, `wid` of the trail's half-width across, its middle `across` of the half-width off the line; `shade` its
 * trail's colour a shade up or down (linear), and its relief the `cut` at `grit` of the land's. Its edge feathered: the
 * outer ring's corners the trail's own colour, so the shade fades out to it. `ground`: the patch is the land's colour (a
 * crown of turf), not the trail's; `core`: a darker middle with no relief (a puddle's water).
 */
export const PATCHES = Object.freeze({
  worn: Object.freeze({ every: 4.5, len: [1.8, 3.6], wid: [0.35, 0.55], across: 0.45, shade: 1.3, cut: 'path', grit: 0.3, metres: 1.5, seed: 101 }),
  damp: Object.freeze({ every: 7, len: [1.2, 2.6], wid: [0.45, 0.8], across: 0.4, shade: 0.6, cut: 'path', grit: 0.2, metres: 1.5, seed: 103 }),
  gravel: Object.freeze({ every: 7, len: [1.2, 2.8], wid: [0.3, 0.5], across: 0.7, shade: 0.92, cut: 'gravel', grit: 1, metres: 1, seed: 107 }),
  crown: Object.freeze({ every: 6, len: [4, 8], wid: [0.24, 0.34], across: 0, shade: 1, cut: 'turf', grit: 1, metres: 1.5, seed: 109, ground: true }),
  puddle: Object.freeze({ every: 12, len: [1, 1.8], wid: [0.45, 0.65], across: 0.25, shade: 0.62, cut: 'path', grit: 0.2, metres: 1.5, seed: 113, core: 0.42 }),
});
const LIFT = 0.05, RISE = 0.012, RIM = 14;
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const srgb = (c) => 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const hexOf = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const shadeOf = (hex, k) => hexOf(rgbOf(hex).map((v) => srgb(Math.min(1, lin(v) * k))));
const r5 = (v) => Math.round(v * 1e5) / 1e5;
// a face's unit normal by Newell's sum
const upOf = (cs) => { let x = 0, y = 0, z = 0; for (let i = 0; i < cs.length; i++) { const a = cs[i], b = cs[(i + 1) % cs.length]; x += (a[1] - b[1]) * (a[2] + b[2]); y += (a[2] - b[2]) * (a[0] + b[0]); z += (a[0] - b[0]) * (a[1] + b[1]); } const l = Math.hypot(x, y, z) || 1; return [x, y, z].map((v) => r5(v / l)); };

/**
 * The trail ribbon's frame and height (nature.js trailFaces: stations every 0.75 m, a trail lane from the line out to
 * the edge each side and a fringe lane past it, `LIFT` over the ground): `xyAt(y, off)` a point `off` across the trail at
 * station `y`, `ribbonZ(y, off)` the ribbon's height there, as its lanes' triangles carry it.
 */
function ribbonOf(site) {
  const frame = (y) => { const sl = (site.trailX(y + 0.01) - site.trailX(y - 0.01)) / 0.02, l = Math.hypot(sl, 1); return { c: [site.trailX(y), y], n: [1 / l, -sl / l] }; };
  const xyAt = (y, off) => { const S = frame(y); return [S.c[0] + S.n[0] * off, S.c[1] + S.n[1] * off]; };
  const zSt = (y, off) => { const [x, yy] = xyAt(y, off); return site.ground(x, yy) + LIFT; };
  const ribbonZ = (y, off) => {
    const j = Math.floor(y / 0.75), ya = j * 0.75, yb = Math.min(site.D, ya + 0.75), f = yb > ya ? (y - ya) / (yb - ya) : 0;
    const at = (ys) => {
      const hw = site.halfWAt(ys), sg = Math.sign(off || 1), a = Math.abs(off);
      if (a <= hw) { const z0 = zSt(ys, 0), z1 = zSt(ys, sg * hw); return z0 + (z1 - z0) * Math.min(1, a / hw); }
      // (past the edge, across the fringe lane)
      const fw = site.fringeAt(ys), z1 = zSt(ys, sg * hw), z2 = zSt(ys, sg * (hw + fw)); return z1 + (z2 - z1) * Math.min(1, (a - hw) / fw);
    };
    return at(ya) + (at(yb) - at(ya)) * f;
  };
  return { xyAt, ribbonZ };
}

/**
 * A gritty dirt trail's patches: { site, lanes (the ribbon's lanes as the land coloured them, each its `cls`, 'trail'
 * or 'fringe': the colours are read off them), kinds, grit, seed, keep } → faces in group 'isekai:trail', each laid with its kind's relief (a puddle's core
 * plain). Blobs in the trail's own frame, on the ribbon's own heights (nature.js trailFaces: its stations, its lanes,
 * `LIFT` over the ground) a hair over it; none on ground a town has claimed.
 */
export function trailPatches({ site, lanes, kinds, grit, seed, keep = null }) {
  if (!kinds.length) return [];
  const t = Math.max(0, Math.min(1, (grit - GRIT_PIXELS) / (1 - GRIT_PIXELS))), H = (a, b, s) => hash3(a, b, seed + s);
  // (the colours to read: the trail's lanes and the fringe's, their middles)
  const of = (cls) => lanes.filter((f) => f.cls === cls && typeof f.fill === 'string').map((f) => ({ c: [0, 1].map((k) => f.corners.reduce((a, q) => a + q[k], 0) / f.corners.length), fill: f.fill }));
  const trail = of('trail'), fringe = of('fringe');
  const near = (L, x, y) => L.reduce((b, q) => (Math.hypot(q.c[0] - x, q.c[1] - y) < Math.hypot(b.c[0] - x, b.c[1] - y) ? q : b), L[0]).fill;
  if (!trail.length) return [];
  const { xyAt, ribbonZ } = ribbonOf(site);
  const keys = new Map(), keyOf = (C, v) => {
    const k = `${C.cut}${v}`;
    if (!keys.has(k)) { const { seed: s = 1, ...params } = normalizeTileSpec({ gen: 'dressed', cut: C.cut, stone: [200, 200, 200], mortar: [120, 120, 120], vary: 14, grit: Math.round(Math.min(1, grit * C.grit) * 100) / 100, seed: C.seed }, 'trail patches').params; keys.set(k, detailKey(params, s, C.metres, v)); }
    return keys.get(k);
  };
  const out = [];
  kinds.forEach((kind, ki) => {
    const C = PATCHES[kind], rise = RISE + 0.004 * ki;
    let n = 0;
    for (let y = 2 + C.every * H(ki, 1, 0); y < site.D - 2; y += (C.every * (0.6 + 0.8 * H(ki, n, 1))) / (0.5 + 0.5 * t), n++) {
      const hw = site.halfWAt(y), len = C.len[0] + (C.len[1] - C.len[0]) * H(ki, n, 2), b0 = hw * (C.wid[0] + (C.wid[1] - C.wid[0]) * H(ki, n, 3));
      if (site.gapAt && (site.gapAt(y - len / 2) || site.gapAt(y + len / 2) || site.gapAt(y))) continue;
      const tc0 = C.across * hw * (2 * H(ki, n, 4) - 1), b = Math.min(b0, hw - 0.06), tc = Math.max(-hw + 0.06 + b, Math.min(hw - 0.06 - b, tc0));
      const [cx, cy] = xyAt(y, tc);
      if (!kept(keep, cx, cy, len / 2 + 0.5)) continue;
      const fill0 = C.ground ? near(fringe.length ? fringe : trail, cx, cy) : near(trail, cx, cy), fill = shadeOf(fill0, C.shade);
      // the blob: a rim of RIM points wobbling about an ellipse, an inner ring six tenths out (the feather between), the
      // middle; every point on the ribbon's height a hair over it
      const ring = (k) => { const a = (2 * Math.PI * k) / RIM, r = 1 + 0.5 * (vnoise(Math.cos(a) * 1.6 + n * 3.1, Math.sin(a) * 1.6 + ki * 5.7, seed + C.seed) - 0.5); return [Math.cos(a) * r, Math.sin(a) * r]; };
      const P = (s, q) => { const yy = Math.max(0, Math.min(site.D, y + s)), off = Math.max(-hw + 0.04, Math.min(hw - 0.04, tc + q)), [x, y2] = xyAt(yy, off); return [r5(x), r5(y2), r5(ribbonZ(yy, off) + rise)]; };
      const rim = Array.from({ length: RIM }, (_, k) => ring(k)), mid = P(0, 0);
      const outer = rim.map(([u, v]) => P((u * len) / 2, v * b)), inner = rim.map(([u, v]) => P((u * len) * 0.3, v * b * 0.6));
      const v = (Math.floor(Math.abs(cx * 0.37 + cy * 0.61)) % 2), key = keyOf(C, v), edge = near(trail, cx, cy), faceOf = (cs, f, plain, fs = null) => {
        // (wound to face up: the rim runs clockwise seen from above)
        const c2 = cs.slice().reverse(), F = { corners: c2, normal: upOf(c2), group: 'isekai:trail', fill: f, cornerFills: fs ? fs.slice().reverse() : c2.map(() => f), patch: kind };
        if (plain) return F;
        const L = layDetail(F, { key, metres: C.metres, as: 'floor' });
        return L.texture ? L : F;
      };
      for (let k = 0; k < RIM; k++) {
        const k1 = (k + 1) % RIM, core = C.core !== undefined;
        out.push(faceOf([mid, inner[k], inner[k1]], core ? shadeOf(fill0, C.core) : fill, core));
        out.push(faceOf([inner[k], outer[k], outer[k1], inner[k1]], fill, false, [fill, edge, edge, fill]));
      }
    }
  });
  return out;
}

// ── surfaces ────────────────────────────────────────────────────────────────────────────────────────────────────────
// the rock ramp's stop a stone word with no colour of its own leans to; the greys a word's tile is painted from where it
// names none (laid as a detail, only its relative tones ride on the face)
const ROCK_STOP = 3, NEUTRAL = Object.freeze({ stone: [200, 200, 200], mortar: [136, 136, 136], floor: [184, 184, 184], trim: [150, 150, 150], coat: [206, 206, 206] });

/**
 * A paved trail's dress: { colour (the hex its lanes lean to), share (how far), dirt (laid in the dirt: IN_DIRT), tile
 * ({ params, seed, metres }: the word's tile, a gritty land's only) | null }; null for the dirt ('earth').
 */
export function surfaceDress(word, { grit = 0, rock = null } = {}) {
  if (word === 'earth') return null;
  const W = MATERIAL_WORDS[word], colour = W.colour ?? (rock ? hexOf(rock[Math.min(ROCK_STOP, rock.length - 1)]) : null), dirt = word in IN_DIRT, share = IN_DIRT[word]?.share ?? 0.65;
  if (!(grit >= GRIT_PIXELS) || !W.tile) return { colour, share, dirt, tile: null };
  const g = Math.round(grit * 100) / 100, X = { ...NEUTRAL, grit: g, wear: { grit: g, spall: Math.min(1, g), pit: Math.round(60 * g) / 100 }, machine: { grit: g, spall: 0, pit: Math.round(10 * g) / 100 }, loss: Math.round(Math.min(1, 0.1 + 0.6 * g) * 100) / 100 };
  // (a word's tile is dressed stone unless it names its own generator: the floor brick's)
  const T = W.tile(X), N = normalizeTileSpec({ gen: 'dressed', ...T.params, seed: 127 }, `trail.surface '${word}'`), { seed = 1, ...params } = N.params;
  return { colour, share, dirt, tile: { params: N.gen === 'dressed' ? params : { gen: N.gen, ...params }, seed, metres: T.metres } };
}

// ── the edge ────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * The edge of a gritty dirt trail spilled over: blobs of the trail's own dirt, its own relief (the path's tile, `key(v)`),
 * straddling the edge every `every` metres or so a side and reaching out over the verge, each feathered to whatever
 * lies under its rim, so the trail meets its verge in a ragged band and not a ruled line.
 */
export const SPILL = Object.freeze({ every: 0.9, len: [0.8, 2.2], wid: [0.14, 0.34], out: [0.02, 0.16], rise: 0.008, rim: 10 });

/**
 * { site, lanes (the ribbon's lanes as the land coloured them, each its `cls`), grit, seed, keep, key (v → the trail's
 * path tile), metres, inward (m: how far in a surface laid in the dirt is covered at its edge) } → faces in group
 * 'isekai:trail'.
 */
export function edgeSpill({ site, lanes, grit, seed, keep = null, key, metres, inward = 0 }) {
  const t = Math.max(0, Math.min(1, (grit - GRIT_PIXELS) / (1 - GRIT_PIXELS))), H = (a, b, s) => hash3(a, b, seed + 1301 + s);
  const { xyAt, ribbonZ } = ribbonOf(site);
  // the colour under a point: the nearest corner's of the trail's and the fringe's lanes (a 1 m grid of them)
  const cells = new Map(), C = 1, cell = (x, y) => `${Math.floor(x / C)},${Math.floor(y / C)}`;
  for (const f of lanes) if ((f.cls === 'trail' || f.cls === 'fringe') && typeof f.fill === 'string') f.corners.forEach((c, k) => { const q = cell(c[0], c[1]); if (!cells.has(q)) cells.set(q, []); cells.get(q).push([c[0], c[1], f.cornerFills?.[k] ?? f.fill]); });
  const under = (x, y) => {
    let best = null, d = Infinity;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const p of cells.get(`${Math.floor(x / C) + i},${Math.floor(y / C) + j}`) || []) { const e = Math.hypot(p[0] - x, p[1] - y); if (e < d) { d = e; best = p[2]; } }
    return best;
  };
  const out = [];
  let n = 0;
  for (const side of [-1, 1]) for (let y = 0.6 + SPILL.every * H(side, 0, 0); y < site.D - 0.6; y += (SPILL.every * (0.5 + H(side, n, 1))) / (0.6 + 0.4 * t), n++) {
    if (site.gapAt && site.gapAt(y)) continue;
    const hw = site.halfWAt(y), len = SPILL.len[0] + (SPILL.len[1] - SPILL.len[0]) * H(side, n, 2), b = SPILL.wid[0] + (SPILL.wid[1] - SPILL.wid[0]) * H(side, n, 3) + inward * 0.5;
    const tc = side * (hw - inward * (0.5 + H(side, n, 5)) + SPILL.out[0] + (SPILL.out[1] - SPILL.out[0]) * H(side, n, 4)), [cx, cy] = xyAt(y, tc), [ex, ey] = xyAt(y, side * hw);
    if (!kept(keep, cx, cy, len / 2 + 0.5)) continue;
    const fill = under(ex, ey), rise = SPILL.rise + 0.0004 * (n % 8);
    if (!fill) continue;
    const ring = (k) => { const a = (2 * Math.PI * k) / SPILL.rim, r = 1 + 0.6 * (vnoise(Math.cos(a) * 1.8 + n * 2.3, Math.sin(a) * 1.8 + side * 4.1, seed + 1307) - 0.5); return [Math.cos(a) * r, Math.sin(a) * r]; };
    // (no further in than the trail's middle, no further out than the fringe's edge)
    const P = (s2, q) => { const yy = Math.max(0, Math.min(site.D, y + s2)), off = Math.max(-hw - site.fringeAt(yy) + 0.04, Math.min(hw + site.fringeAt(yy) - 0.04, tc + q)), [x, y2] = xyAt(yy, side * Math.max(0, side * off)); return [r5(x), r5(y2), r5(ribbonZ(yy, side * Math.max(0, side * off)) + rise)]; };
    const rim = Array.from({ length: SPILL.rim }, (_, k) => ring(k)), mid = P(0, 0);
    const outer = rim.map(([u, v]) => P((u * len) / 2, v * b)), inner = rim.map(([u, v]) => P(u * len * 0.3, v * b * 0.6)), rimFill = outer.map((p) => under(p[0], p[1]) ?? fill);
    const k0 = key((Math.floor(Math.abs(cx * 0.37 + cy * 0.61)) % 2)), faceOf = (cs, fs) => {
      const c2 = cs.slice().reverse(), F = { corners: c2, normal: upOf(c2), group: 'isekai:trail', fill, cornerFills: fs.slice().reverse(), spill: true };
      const L = layDetail(F, { key: k0, metres, as: 'floor' });
      return L.texture ? L : F;
    };
    for (let k = 0; k < SPILL.rim; k++) {
      const k1 = (k + 1) % SPILL.rim;
      out.push(faceOf([mid, inner[k], inner[k1]], [fill, fill, fill]));
      out.push(faceOf([inner[k], outer[k], outer[k1], inner[k1]], [fill, rimFill[k], rimFill[k1], fill]));
    }
  }
  return out;
}

/** A gritty dirt trail's fringe lanes, their corners at the trail's edge the trail's own colour there (`lane(i)` a land
 *  face's lane class): so a verge fades from the trail's dirt to the land across its width. */
export function verged(land, lane) {
  const key = (c) => `${c[0].toFixed(3)},${c[1].toFixed(3)}`, at = new Map();
  land.forEach((f, i) => { if (lane(i) === 'trail') f.corners.forEach((c, k) => at.set(key(c), f.cornerFills?.[k] ?? f.fill)); });
  return land.map((f, i) => (lane(i) === 'fringe' ? { ...f, cornerFills: f.corners.map((c, k) => at.get(key(c)) ?? f.cornerFills?.[k] ?? f.fill) } : f));
}
