/**
 * bridge — a walkable way over a gap: a static PLATFORM stretched from one bank to the other. Called by its ENDS: `from`
 * and `to`, the points where the walk meets the gap (the deck's top there), and the walkable `width`; or `over` a
 * pit hazard (a trail's `{ hazard: 'pit', box, at }` anchor), which gives the ends and the width itself.
 *
 * What it is built of is ELEMENTS, the words a style guide uses for a bridge, each a named part the model can turn
 * off or tune (`elements: { rails: false, posts: { every: 2 } }`), so the guide's motifs and elements and the entry
 * are one vocabulary:
 *
 *   plank   one board across (two side by side when wide), chocked on stones at each bank; no rails
 *   deck    planks across two stringers, posts and a top rail each side, an abutment on each bank, piers when long
 *   rope    planks laid on two footropes that sag between posts, handropes over them, suspenders between
 *   arch    a stone arch: the ring of voussoirs and its keystone, spandrels up to a slab deck, parapets with coping
 *           (and a `motif` along them: dentils, or a plain band)
 *
 * It answers as a platform does: its deck (a centreline the walk follows, the top at any station), how its width
 * reads as a crossing (road, path, plank, beam) and its steepest grade (walk or scramble), its bearings (where each
 * bank must hold it), the clearance under it, and the pieces the world runs (the deck's floor faces and colliders,
 * the rails as lines a walker is kept inside). It is built of blocks, so it can be dismantled: sever a rope bridge's
 * ropes and its planks fall.
 */
import { obox, blockSink } from '../../era/props.js';
import { r5, P } from '../../era/geom.js';

const Z = [0, 0, 1];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// how a width reads to a walker crossing, and how steep a deck may be walked (the trail's grade)
export const CROSSING = Object.freeze([
  { read: 'road', from: 2.4 },   // two abreast, a cart
  { read: 'path', from: 1.2 },   // walk across without thinking
  { read: 'plank', from: 0.6 },  // mind your feet
  { read: 'beam', from: 0 },     // a balance
]);
export const crossingRead = (w) => CROSSING.find((c) => w >= c.from).read;
export const WALK_GRADE = 0.3;

export const BRIDGE_VARIANTS = {
  plank: { about: 'one board across, chocked on a stone at each bank, cleated under its middle', elements: ['boards', 'chocks', 'cleats'] },
  deck: { about: 'planks across two stringers, posts and rails each side, X-braces in the middle bays, an abutment on each bank', elements: ['planks', 'stringers', 'posts', 'rails', 'braces', 'abutments', 'piers'] },
  rope: { about: 'planks on two sagging footropes between posts, handropes over them, the middle planks lashed', elements: ['planks', 'footropes', 'handropes', 'suspenders', 'posts', 'lashings'] },
  arch: { about: 'a stone arch: the ring and its crown (the keystone and its neighbours), spandrels to a slab deck, parapets with coping', elements: ['ring', 'crown', 'keystone', 'spandrels', 'deck', 'parapets', 'coping', 'abutments'] },
};
export const BRIDGE_VARIANT_IDS = Object.freeze(Object.keys(BRIDGE_VARIANTS));
export const BRIDGE_ELEMENTS = Object.freeze([...new Set(Object.values(BRIDGE_VARIANTS).flatMap((v) => v.elements))]);
export const BRIDGE_MOTIFS = Object.freeze(['dentil', 'band']);

/** The ends of a pit hazard anchor: the gap's near and far edges on the walk, the width the trail gives. */
export function endsOver(anchor, { margin = 0.2 } = {}) {
  const { min, max } = anchor.box, x = anchor.at[0], z = min[2];
  const alongY = max[1] - min[1] <= max[0] - min[0];   // the gap is the box's short side
  return alongY
    ? { from: [x, r5(min[1] - margin), z], to: [x, r5(max[1] + margin), z], width: r5(Math.min(2.4, (max[0] - min[0]) / 2)) }
    : { from: [r5(min[0] - margin), anchor.at[1], z], to: [r5(max[0] + margin), anchor.at[1], z], width: r5(Math.min(2.4, (max[1] - min[1]) / 2)) };
}

export function bridgeParams({ variant = 'deck', from, to, over, width, sag = 0.08, rise, floor, bearing = 0.45, elements = {}, motif } = {}) {
  if (!BRIDGE_VARIANTS[variant]) throw new Error(`playscape: a bridge has no variant '${variant}' (variants: ${BRIDGE_VARIANT_IDS.join(', ')})`);
  const E = over ? endsOver(over) : null;
  const a = from || E?.from, b = to || E?.to;
  if (!a || !b) throw new Error('bridge: give its ends (from, to: where the walk meets the gap) or a pit to span (over)');
  const flat = [b[0] - a[0], b[1] - a[1], 0], L = Math.hypot(flat[0], flat[1]);
  if (!(L >= 1)) throw new Error('bridge: its ends must stand at least 1 m apart across the gap');
  const w = width ?? E?.width ?? (variant === 'plank' ? 0.5 : variant === 'arch' ? 2.4 : 1.2);
  if (!(w > 0.2)) throw new Error('bridge: width is the walkable metres across, above 0.2');
  for (const k of Object.keys(elements)) if (!BRIDGE_ELEMENTS.includes(k)) throw new Error(`bridge: '${k}' is not a bridge element (${BRIDGE_ELEMENTS.join(', ')})`);
  if (motif !== undefined && !BRIDGE_MOTIFS.includes(motif)) throw new Error(`bridge: motif is one of ${BRIDGE_MOTIFS.join(', ')}`);
  const lo = Math.min(a[2], b[2]);
  return {
    variant, from: P(a), to: P(b), span: r5(L), width: r5(w), D: P(unit(flat)), S: P(unit([-flat[1], flat[0], 0])),
    sag: variant === 'rope' ? sag : 0, rise: variant === 'arch' ? r5(rise ?? Math.min(0.32 * L, Math.max(1, lo - (floor ?? lo - 6) - 1))) : 0,
    floor: r5(floor ?? lo - 6), bearing, elements, motif: motif ?? (variant === 'arch' ? 'dentil' : null),
  };
}

/** The deck's top at station s (metres from `from` along the span; negative or past the span is on a bank): straight,
 * sagging (rope) or humped (arch). */
export function deckTop(p, s) {
  // past either end (a bearing on the bank) the deck runs on level with that end: no sag, no rise
  const u = Math.min(1, Math.max(0, s / p.span)), base = add(add(p.from, mul(add(p.to, mul(p.from, -1)), u)), mul(p.D, s - u * p.span));
  // a humpback arch rises over its whole length, the approaches on the banks included, so the crown has no kink
  const e = p.variant === 'arch' ? p.bearing + 0.15 : 0, ua = Math.min(1, Math.max(0, (s + e) / (p.span + 2 * e)));
  const sag = p.variant === 'rope' ? -p.sag * p.span * 4 * u * (1 - u) : p.variant === 'arch' ? 0.04 * p.span * 4 * ua * (1 - ua) : 0;
  return P(add(base, [0, 0, sag]));
}

const on = (p, k) => p.elements[k] !== false;
const opt = (p, k) => (typeof p.elements[k] === 'object' ? p.elements[k] : {});

// ── the build: blocks along the span, values only on the obj:* groups ───────────────────────────────────────────
const surf = (group, v) => ({ key: null, scale: 1, tint: [v, v, v], group });
function put(out, part, group, v, c, A, B, C, h) {
  const from = out.length;
  obox(out, c, A, B, C, h, surf(group, v), 8);
  for (let i = from; i < out.length; i++) Object.assign(out[i], { part, value: v });
  if (out.boxes) out.boxes[out.boxes.length - 1].part = part;
}
// a box along the span between stations s0 and s1, `off` across, `dz` under the deck top, its thickness `t` and height `h`
function along(out, p, part, group, v, s0, s1, off, dz, t, h) {
  const a = add(deckTop(p, s0), mul(p.S, off)), b = add(deckTop(p, s1), mul(p.S, off));
  const d = add(b, mul(a, -1)), len = Math.hypot(...d), A = unit(d), C = unit([-A[0] * A[2], -A[1] * A[2], 1 - A[2] * A[2]]), B = unit([A[1] * C[2] - A[2] * C[1], A[2] * C[0] - A[0] * C[2], A[0] * C[1] - A[1] * C[0]]);
  put(out, part, group, v, add(mul(add(a, b), 0.5), [0, 0, -dz - h / 2]), A, B, C, [len / 2, t / 2, h / 2]);   // offset straight down: a rail over a sag stays over its posts
}
// a long part that follows the deck's curve (a sag, a hump): pieces no longer than half a metre, each a hair long so
// the joints between them close
function run(out, p, part, group, v, s0, s1, off, dz, t, h) {
  const n = Math.max(1, Math.ceil((s1 - s0) / 0.5)), step = (s1 - s0) / n;
  for (let i = 0; i < n; i++) along(out, p, part, group, v, s0 + i * step - (i ? 0.02 : 0), s0 + (i + 1) * step + (i < n - 1 ? 0.02 : 0), off, dz, t, h);
}
// an upright box at station s, `off` across, from `z0` to `z1` above the deck top there, `t` along the span (`across`
// wide, default t)
function upright(out, p, part, group, v, s, off, z0, z1, t, across = t) {
  const c = add(deckTop(p, s), add(mul(p.S, off), [0, 0, (z0 + z1) / 2]));
  put(out, part, group, v, c, p.D, p.S, Z, [t / 2, across / 2, (z1 - z0) / 2]);
}

const BUILD = {
  plank(out, p) {
    const n = p.width > 0.6 ? 2 : 1, bw = p.width / n, L = p.span + 2 * p.bearing;
    if (on(p, 'boards')) for (let i = 0; i < n; i++) along(out, p, 'boards', 'obj:body', 0.58, -p.bearing, p.span + p.bearing, (i - (n - 1) / 2) * bw, 0, bw - 0.02, 0.08);
    if (on(p, 'chocks')) for (const s of [-p.bearing / 2, p.span + p.bearing / 2]) upright(out, p, 'chocks', 'obj:fill', 0.7, s, 0, -0.38, -0.08, p.bearing, p.width + 0.2);
    // the 33: cleats across the boards' underside through the middle third, binding them
    if (on(p, 'cleats')) for (let k = 0; k < 3; k++) { const s = p.span * (1 / 3 + k / 6); along(out, p, 'cleats', 'obj:detail', 0.22, s - 0.06, s + 0.06, 0, 0.08, p.width + 0.04, 0.12); }
    return L;
  },
  deck(out, p) {
    const w = p.width, half = w / 2, every = opt(p, 'planks').every ?? 0.28, posts = opt(p, 'posts').every ?? 1.6, H = 1.0;
    if (on(p, 'stringers')) for (const o of [-half + 0.12, half - 0.12]) run(out, p, 'stringers', 'obj:body', 0.46, -p.bearing, p.span + p.bearing, o, 0.06, 0.14, 0.26);
    const np = Math.max(1, Math.round((p.span + 2 * p.bearing) / every)), pe = (p.span + 2 * p.bearing) / np;   // planks that end where the deck ends
    if (on(p, 'planks')) for (let i = 0; i < np; i++) { const s = -p.bearing + (i + 0.5) * pe; along(out, p, 'planks', 'obj:fill', 0.72 - 0.06 * (i % 2), s - pe / 2 + 0.012, s + pe / 2 - 0.012, 0, 0, w + 0.1, 0.06); }
    const n = Math.max(1, Math.round(p.span / posts));
    // posts from end to end of the deck (an end post at each bank closes the silhouette there), the rail along their tops
    const e0 = -p.bearing + 0.06, e1 = p.span + p.bearing - 0.06;
    if (on(p, 'posts')) for (let i = 0; i <= n; i++) for (const o of [-half - 0.05, half + 0.05]) upright(out, p, 'posts', 'obj:fill', 0.62, e0 + ((e1 - e0) * i) / n, o, -0.3, H, 0.12);
    if (on(p, 'rails')) for (const o of [-half - 0.05, half + 0.05]) run(out, p, 'rails', 'obj:fill', 0.66, e0 - 0.06, e1 + 0.06, o, -H - 0.04, 0.1, 0.08);   // over the end posts' tops
    // the 33: X-braces between the posts through the middle third, dark against the light rails
    if (on(p, 'braces')) {
      const s0 = p.span * 0.3, s1 = p.span * 0.7;
      for (const o of [-half - 0.05, half + 0.05]) { along(out, p, 'braces', 'obj:detail', 0.12, s0, s1, o, -H + 0.1, 0.06, 0.07); along(out, p, 'braces', 'obj:detail', 0.12, s0, s1, o, -0.15, 0.06, 0.07); upright(out, p, 'braces', 'obj:detail', 0.12, (s0 + s1) / 2, o, 0.1, H - 0.1, 0.08); }
    }
    if (on(p, 'abutments')) for (const s of [-p.bearing / 2, p.span + p.bearing / 2]) upright(out, p, 'abutments', 'obj:body', 0.36, s, 0, -1.0, -0.32, p.bearing, w + 0.5);
    if (on(p, 'piers') && p.span > 7) {
      const k = Math.floor(p.span / 6);
      for (let i = 1; i <= k; i++) { const s = (p.span * i) / (k + 1), top = deckTop(p, s)[2] - 0.32; upright(out, p, 'piers', 'obj:body', 0.38, s, 0, p.floor - top - 0.32, -0.32, 0.5, w); }
    }
  },
  rope(out, p) {
    const w = p.width, half = w / 2, every = opt(p, 'planks').every ?? 0.32, H = 1.0, seg = Math.max(8, Math.round(p.span / 0.5));
    for (const s of [0, p.span]) if (on(p, 'posts')) for (const o of [-half - 0.06, half + 0.06]) upright(out, p, 'posts', 'obj:body', 0.4, s, o, -0.6, H + 0.25, 0.16);
    const rope = (part, off, dz) => { for (let i = 0; i < seg; i++) along(out, p, part, 'obj:fill', 0.64, (p.span * i) / seg, (p.span * (i + 1)) / seg, off, dz, 0.05, 0.05); };
    if (on(p, 'footropes')) for (const o of [-half + 0.02, half - 0.02]) rope('footropes', o, 0.05);   // under the planks' ends, tied to the posts
    if (on(p, 'handropes')) for (const o of [-half - 0.06, half + 0.06]) {
      // a handrope runs from post to post H over the deck, following its sag
      for (let i = 0; i < seg; i++) along(out, p, 'handropes', 'obj:fill', 0.64, (p.span * i) / seg, (p.span * (i + 1)) / seg, o, -H, 0.04, 0.04);
    }
    if (on(p, 'planks')) for (let s = every / 2; s < p.span; s += every) along(out, p, 'planks', 'obj:fill', 0.7 - 0.08 * (Math.round(s / every) % 2), s - every / 2 + 0.03, s + every / 2 - 0.03, 0, 0, w, 0.05);
    // the 33: the middle third's planks lashed to the footropes, dark knots under each
    if (on(p, 'lashings')) for (let s = every / 2; s < p.span; s += every) if (s > p.span * 0.3 && s < p.span * 0.7) for (const o of [-half + 0.02, half - 0.02]) along(out, p, 'lashings', 'obj:detail', 0.2, s - 0.07, s + 0.07, o, 0.02, 0.09, 0.08);   // flush with the footrope's underside
    if (on(p, 'suspenders')) for (let s = 1.2; s < p.span - 0.6; s += 1.2) for (const o of [-half - 0.04, half + 0.04]) upright(out, p, 'suspenders', 'obj:fill', 0.6, s, o, 0.01, H - 0.02, 0.02);
  },
  arch(out, p) {
    const w = p.width, half = w / 2, R = p.rise, L = p.span, n = Math.max(7, Math.round(L / 0.55) | 1), deckZ = (s) => deckTop(p, s)[2], ringT = Math.max(0.35, 0.09 * L), depth = ringT + 0.4;   // the crown sits under the slab, never through it
    const E = p.bearing + 0.15;   // the abutment's outer face: the slab, parapets and coping end flush with it
    // the ring: voussoirs on a segmental arch from bank to bank, its crown `rise` over the springing, under the deck
    const spring = Math.min(p.from[2], p.to[2]) - depth - R, archZ = (s) => spring + R * (1 - ((2 * s) / L - 1) ** 2);
    for (let i = 0; i < n; i++) {
      const s0 = (L * i) / n, s1 = (L * (i + 1)) / n, a = add(add(p.from, mul(p.D, s0)), [0, 0, 0]), z0 = archZ(s0), z1 = archZ(s1);
      const c0 = [a[0], a[1], z0], c1 = [p.from[0] + p.D[0] * s1, p.from[1] + p.D[1] * s1, z1], d = add(c1, mul(c0, -1)), A = unit(d), C = unit([-A[0] * A[2], -A[1] * A[2], 1 - A[2] * A[2]]);
      const B = unit([A[1] * C[2] - A[2] * C[1], A[2] * C[0] - A[0] * C[2], A[0] * C[1] - A[1] * C[0]]), key = i === (n - 1) / 2, crown = (s0 + s1) / 2 >= L / 3 && (s0 + s1) / 2 <= (2 * L) / 3;
      const part = key ? 'keystone' : crown ? 'crown' : 'ring';   // the 33: the crown's voussoirs and the keystone, the middle third of the ring
      if (on(p, part)) put(out, part, key || crown ? 'obj:detail' : 'obj:body', key ? 0.16 : crown ? 0.24 : 0.46 - 0.05 * (i % 2), add(mul(add(c0, c1), 0.5), mul(C, ringT / 2)), A, B, C, [Math.hypot(...d) / 2 + 0.02, half + 0.12, ringT / 2 + (key ? 0.06 : 0)]);   // a hair long: the voussoirs close the intrados
      // the spandrel over this voussoir: from the ring's back up to the deck slab
      const sm = (s0 + s1) / 2, z = archZ(sm) + ringT, top = deckZ(sm) - 0.3;
      if (on(p, 'spandrels') && top - z > 0.05) put(out, 'spandrels', 'obj:fill', 0.62, [p.from[0] + p.D[0] * sm, p.from[1] + p.D[1] * sm, (z + top) / 2], p.D, p.S, Z, [(s1 - s0) / 2, half + 0.1, (top - z) / 2]);
    }
    if (on(p, 'deck')) run(out, p, 'deck', 'obj:fill', 0.7, -E, L + E, 0, 0, w + 0.3, 0.3);
    if (on(p, 'parapets')) for (const o of [-half - 0.15, half + 0.15]) run(out, p, 'parapets', 'obj:body', 0.5, -E, L + E, o, -0.62, 0.28, 0.62);
    if (on(p, 'coping')) for (const o of [-half - 0.15, half + 0.15]) run(out, p, 'coping', 'obj:fill', 0.74, -E, L + E, o, -0.72, 0.36, 0.1);
    if (p.motif === 'dentil' && on(p, 'parapets')) for (const o of [-half - 0.31, half + 0.31]) for (let s = 0.2; s < L; s += 0.42) along(out, p, 'dentils', 'obj:fill', 0.4, s - 0.1, s + 0.1, o, -0.58, 0.06, 0.1);
    if (p.motif === 'band' && on(p, 'parapets')) for (const o of [-half - 0.3, half + 0.3]) run(out, p, 'band', 'obj:fill', 0.4, -E, L + E, o, -0.5, 0.04, 0.08);
    if (on(p, 'abutments')) for (const s of [(-E - 0.12 + 0.3) / 2, L + (E + 0.12 - 0.3) / 2]) upright(out, p, 'abutments', 'obj:body', 0.4, s, 0, spring - deckZ(s) - 0.2, 0.72, E + 0.42, w + 0.8);   // from the springing up to an end pier over the coping: each end one clean upright
  },
};

export const BRIDGE = {
  id: 'bridge',
  name: 'Bridge',
  role: 'a walkable way over a gap: a static platform from bank to bank',
  interest: 'prop',
  variants: BRIDGE_VARIANTS,
  skins: { greybox: true },
  when: 'a bridge, cross the chasm, over the gap, a plank across, a rope bridge, a footbridge, a stone bridge, an arch over the river, span the pit',

  resolve({ variant, skin = 'greybox', params, ...spec } = {}) {
    if (skin !== 'greybox') throw new Error("playscape: a bridge has no skin '" + skin + "' (skins: greybox)");
    const p = params || bridgeParams({ variant: variant ?? spec.variant, ...spec });
    const faces = blockSink();
    BUILD[p.variant](faces, p);
    const stations = Array.from({ length: Math.max(2, Math.ceil(p.span / 0.5) + 1) }, (_, i) => (p.span * i) / Math.max(1, Math.ceil(p.span / 0.5)));
    const line = stations.map((s) => deckTop(p, s));
    const grade = Math.max(...line.slice(1).map((q, i) => Math.abs(q[2] - line[i][2]) / Math.max(1e-6, Math.hypot(q[0] - line[i][0], q[1] - line[i][1]))));
    const railed = (p.variant === 'deck' && on(p, 'rails')) || (p.variant === 'rope' && on(p, 'handropes')) || (p.variant === 'arch' && on(p, 'parapets'));
    const under = Math.min(...stations.map((s) => deckTop(p, s)[2])) - (p.variant === 'arch' ? 0.3 + p.rise + 0.5 : p.variant === 'rope' ? 0.1 : 0.32);
    const mid = deckTop(p, p.span / 2);
    return {
      entry: 'bridge', variant: p.variant, skin, params: p, interest: this.interest,
      frame: { at: P([mid[0], mid[1], Math.min(p.from[2], p.to[2])]), N: P(p.S.map((x) => -x)), U: p.D },   // judged side-on: its elevation
      faces,
      deck: { line, width: p.width },
      crossing: { width: p.width, read: crossingRead(p.width), railed, grade: r5(grade), walk: grade <= WALK_GRADE ? 'walk' : 'scramble' },
      bearings: [p.from, p.to].map((e, i) => ({ end: i ? 'to' : 'from', at: e, depth: p.bearing, keep: 'solid bank under this end' })),
      clearance: { under: r5(under), over: r5(p.floor) },
      elements: [...new Set(faces.boxes.map((b) => b.part))],
      world: this.lower(p, line),
    };
  },

  /** The deck as floor faces (a quad per stretch, sloped with it) and a collider under each; the rails as lines. */
  lower(p, line) {
    const h = p.width / 2, faces = [], colliders = [];
    for (let i = 0; i + 1 < line.length; i++) {
      const a = line[i], b = line[i + 1], A = add(a, mul(p.S, -h)), B = add(b, mul(p.S, -h)), C = add(b, mul(p.S, h)), D = add(a, mul(p.S, h));
      faces.push({ corners: [A, B, C, D].map(P), fill: '#9aa0a8', group: 'floor' });
      const xs = [A, B, C, D].map((q) => q[0]), ys = [A, B, C, D].map((q) => q[1]), zs = [a[2], b[2]];
      colliders.push({ min: P([Math.min(...xs), Math.min(...ys), Math.min(...zs) - 0.1]), max: P([Math.max(...xs), Math.max(...ys), Math.max(...zs)]) });
    }
    const railed = p.variant !== 'plank' && (on(p, 'rails') || on(p, 'handropes') || on(p, 'parapets'));
    const rails = railed ? [-1, 1].map((sd) => ({ line: line.map((q) => P(add(q, mul(p.S, sd * (h + 0.05))))), height: 1.0 })) : [];
    return { faces, colliders, rails, entities: [] };
  },
};
