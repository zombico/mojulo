/**
 * THE ATTACHMENT RULE: everything on a feature animal is attached, to the body or to something attached to it
 * (docs/feature-style.md, principle 11). The skin is one smooth union of its shapes (feature-body.js eggField: each
 * pair blended by a polynomial smooth-min as wide as the softer of their joins, a head shape and a body shape no softer
 * than the seam), so two shapes are ONE where the gap between their surfaces is narrower than the blend can bridge: half
 * its width. A shape whose surfaces stay further apart from every other floats: a pom tail behind the rump, a tuft off
 * the haunch, a foot apart from its ankle.
 *
 *   gapOf(A, B)            the narrowest gap between two shapes' surfaces (an egg's surface sampled, a tuft's or a
 *                          cone's spine less its radius; negative where they overlap), metres
 *   bridges(A, B, { seam }) the gap the blend between them bridges
 *   pieces(shapes, { seam }) → the shapes' connected pieces (index lists), the body's (the one holding `belly`) first
 *   attachAll(shapes, { seam }) → { shapes, moved }: every piece apart from the body's moved, whole, toward the nearest
 *                          shape already attached until it is attached (the shape it reaches, how far): its design kept,
 *                          only its place corrected. Nothing apart: the very same shapes, none moved
 *
 * Pure and deterministic: fixed sampling, ties by index.
 */
import { egg, eggDistance } from './feature-body.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const P = (q) => [q.x, q.y, q.z];

/** the rule's numbers: the share of the blend's width a gap may be and still be bridged, the margin a moved piece is
 *  set into its new neighbour by (a share of the bridge), the most passes */
export const FEATURE_ATTACH = Object.freeze({ bridge: 0.4, margin: 0.5, passes: 6 });

/** the directions an egg's surface is sampled along (the 26 of a cube's faces, edges and corners) */
const DIRS = (() => { const out = []; for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) if (x || y || z) out.push(unit([x, y, z])); return out; })();

/** a shape's samples: { p, r } (a point and how far the shape's surface stands off it) */
function samplesOf(E) {
  if (E.kind === 'tuft') {
    const out = [];
    for (const [a, b, ra, rb] of E.segs) for (const t of [0, 0.5, 1]) out.push({ p: add(P(a), mul(sub(P(b), P(a)), t)), r: ra + (rb - ra) * t });
    return out;
  }
  // (an egg's surface, along each direction from its centre: in its own frame, found by bisection on its distance)
  const R = Math.max(...E.r) * (1 + E.e) * 1.5;
  return DIRS.map((d0) => {
    const d = unit(add(add(mul(E.u, d0[0]), mul(E.v, d0[1])), mul(E.w, d0[2])));
    let lo = 0, hi = R;
    for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; (eggDistance(E, add(E.c, mul(d, m))) < 0 ? (lo = m) : (hi = m)); }
    return { p: add(E.c, mul(d, lo)), r: 0 };
  });
}

const SAMPLES = new WeakMap();
const samples = (E) => { let s = SAMPLES.get(E); if (!s) { s = samplesOf(E); SAMPLES.set(E, s); } return s; };

/** the narrowest gap from B's surface to A's, and where on B it is */
function gapFrom(A, B) {
  let best = Infinity, at = null;
  for (const s of samples(B)) { const g = eggDistance(A, s.p) - s.r; if (g < best) { best = g; at = s.p; } }
  return { gap: best, at };
}
export function gapOf(A, B) { return Math.min(gapFrom(A, B).gap, gapFrom(B, A).gap); }

export function bridges(A, B, { seam = 0 } = {}) {
  const k = Math.min(A.join, B.join), cross = seam > 0 && (A.bone === 'head') !== (B.bone === 'head');
  return FEATURE_ATTACH.bridge * (cross ? Math.min(k, seam) : k);
}

/** the shapes near enough to be tested at all: their bounding balls within reach */
const ballOf = (E) => (E.kind === 'tuft' ? { c: E.c, R: E.R } : { c: E.c, R: Math.max(...E.r) * (1 + E.e / 2) });
const near = (A, B) => { const a = ballOf(A), b = ballOf(B); return Math.hypot(...sub(a.c, b.c)) < a.R + b.R + Math.max(A.join, B.join); };

export function pieces(shapes, { seam = 0 } = {}) {
  const n = shapes.length, up = Array.from({ length: n }, (_, i) => i), find = (i) => (up[i] === i ? i : (up[i] = find(up[i])));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (find(i) === find(j) || !near(shapes[i], shapes[j])) continue;
    if (gapOf(shapes[i], shapes[j]) <= bridges(shapes[i], shapes[j], { seam })) up[find(i)] = find(j);
  }
  const by = new Map(); for (let i = 0; i < n; i++) { const r = find(i); (by.get(r) ?? by.set(r, []).get(r)).push(i); }
  const body = shapes.findIndex((E) => E.name === 'belly');
  return [...by.values()].sort((a, b) => (a.includes(body) ? -1 : b.includes(body) ? 1 : a[0] - b[0]));
}

/** a shape moved by v, otherwise the same */
function shifted(E, v) {
  if (E.kind === 'tuft') {
    const mv = (q) => ({ x: q.x + v[0], y: q.y + v[1], z: q.z + v[2] });
    return Object.freeze({ ...E, segs: E.segs.map(([a, b, ra, rb]) => [mv(a), mv(b), ra, rb]), c: add(E.c, v) });
  }
  return egg({ name: E.name, c: add(E.c, v), u: E.u, r: E.r, e: E.e, hint: E.v, bone: E.bone, group: E.group, join: E.join });
}

export function attachAll(shapes0, { seam = 0 } = {}) {
  let shapes = shapes0;
  const moved = [];
  for (let pass = 0; pass < FEATURE_ATTACH.passes; pass++) {
    const ps = pieces(shapes, { seam });
    if (ps.length <= 1) break;
    const body = new Set(ps[0]);
    // each piece apart, toward its nearest attached shape: along that shape's surface normal at the piece's nearest point
    for (const piece of ps.slice(1)) {
      let best = null;
      for (const i of [...body].sort((a, b) => a - b)) for (const j of piece) {
        const { gap, at } = gapFrom(shapes[i], shapes[j]), need = gap - bridges(shapes[i], shapes[j], { seam });
        if (!best || need < best.need) best = { i, j, gap, at, need };
      }
      const A = shapes[best.i], e = 1e-5, g = [0, 1, 2].map((k) => { const d = [0, 0, 0]; d[k] = e; return eggDistance(A, add(best.at, d)) - eggDistance(A, sub(best.at, d)); });
      const step = best.need + FEATURE_ATTACH.margin * bridges(A, shapes[best.j], { seam }), v = mul(unit(g), -step);
      shapes = shapes.map((E, k) => (piece.includes(k) ? shifted(E, v) : E));
      moved.push({ shapes: piece.map((k) => shapes[k].name), to: A.name, by: Math.round(Math.hypot(...v) * 1e4) / 1e4 });
    }
  }
  return { shapes, moved };
}
