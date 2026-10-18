/**
 * fractal-structure / plan — the MANDALA: a structure's plan, top-down, as one closed ring of [x, y] points.
 *
 * Every plan is counter-clockwise, star-shaped about its centre (each edge seen from the origin turns the same way,
 * so a fan from the centre caps it and a ray from the centre meets it once), and scaled so its farthest point sits on
 * the unit circle. A face of a square-born plan looks down an axis (±x, ±y): a structure turned 0° fronts −y like
 * every other piece in a world.
 *
 *   square           the four-sided base
 *   circle           `sides` facets (the round plan, vritta)
 *   turned           `k` copies of a regular `sides`-gon, each turned 360° / (sides · k) past the last, unioned: the
 *                    turning square. k = 2 squares is the eight-point star, k = 4 the sixteen-point stellate plan.
 *   star             any star: `points` tips on the unit circle, notches at `inner`
 *   stepped-circle   orthogonal steps whose inner corners ride x² + y² = 1, `steps` to a quadrant: a round
 *                    silhouette built of square blocks
 *   offset           a square whose faces are cut into `bays` (odd), the middle bay projecting most by `project` of
 *                    the face, stepping down to the corners; the middle bay is cut again, to `depth` (ratha: the plan's
 *                    own fractal)
 *
 * Pure numbers; nothing here builds a face.
 */

import { isConvexRing } from '../polygonizer/ring-cap.js';

const TAU = Math.PI * 2;
const r6 = (v) => Math.round(v * 1e6) / 1e6 + 0;

export const PLAN_FORMS = Object.freeze(['square', 'circle', 'turned', 'star', 'stepped-circle', 'offset']);

/** Each form's dials and their bounds: [default, min, max, integer?]. */
export const PLAN_DIALS = Object.freeze({
  square: {},
  circle: { sides: [32, 6, 96, true] },
  turned: { sides: [4, 3, 12, true], k: [2, 1, 8, true] },
  star: { points: [8, 3, 64, true], inner: [0.72, 0.2, 0.98, false] },
  'stepped-circle': { steps: [5, 1, 16, true] },
  offset: { bays: [5, 3, 9, true], project: [0.1, 0, 0.3, false], depth: [2, 1, 3, true] },
});

const polar = (r, a) => [r * Math.cos(a), r * Math.sin(a)];

/** The inner (notch) radius of k turned regular n-gons inscribed in the unit circle: cos(π/n) / cos(π/n − π/(n·k)). */
export function turnedInner(sides, k) {
  return Math.cos(Math.PI / sides) / Math.cos(Math.PI / sides - Math.PI / (sides * k));
}

function regular(sides, phase) {
  const out = [];
  for (let j = 0; j < sides; j += 1) out.push(polar(1, phase + (j * TAU) / sides));
  return out;
}

function star(points, inner, phase) {
  const out = [];
  for (let j = 0; j < points; j += 1) {
    out.push(polar(1, phase + (j * TAU) / points));
    out.push(polar(inner, phase + ((j + 0.5) * TAU) / points));
  }
  return out;
}

function steppedCircle(steps) {
  // a quadrant: each corner on the circle, then the outer corner of its step; (0, 1) opens the next quadrant
  const q = [];
  for (let i = 0; i < steps; i += 1) {
    const a0 = (i / steps) * (Math.PI / 2), a1 = ((i + 1) / steps) * (Math.PI / 2);
    q.push([Math.cos(a0), Math.sin(a0)], [Math.cos(a0), Math.sin(a1)]);
  }
  const out = [];
  for (let k = 0; k < 4; k += 1) {
    const c = Math.cos(k * Math.PI / 2), s = Math.sin(k * Math.PI / 2);
    for (const [x, y] of q) out.push([c * x - s * y, s * x + c * y]);
  }
  return out;
}

// One face of the offset plan in its own frame: `along` 0 → 1 from corner to corner, `out` the projection, in units of
// the face's length L. Returns the points from the face's start (included) to its end (excluded).
function offsetFace(bays, project, depth, L) {
  const m = (bays - 1) / 2, w = 1 / bays, pts = [];
  const lift = (j) => ((m - Math.abs(j - m)) / m) * project * L;
  for (let j = 0; j < bays; j += 1) {
    const s0 = j * w, d = lift(j);
    if (j === 0) pts.push([0, 0]);
    else { pts.push([s0 * L, lift(j - 1)]); pts.push([s0 * L, d]); }
    if (j === m && depth > 1) {
      // the middle bay is a face of its own: cut it again, on its own length
      for (const [a, o] of offsetFace(bays, project, depth - 1, w * L).slice(1)) pts.push([s0 * L + a, d + o]);
    }
  }
  pts.push([L, 0]);
  return pts.slice(0, -1);
}

function offsetPlan(bays, project, depth) {
  // a square of half-width 1, faces walked counter-clockwise from the corner (1, −1)
  const corners = [[1, -1], [1, 1], [-1, 1], [-1, -1]];
  const out = [];
  for (let f = 0; f < 4; f += 1) {
    const A = corners[f], B = corners[(f + 1) % 4];
    const u = [(B[0] - A[0]) / 2, (B[1] - A[1]) / 2];      // unit along the face
    const n = [u[1], -u[0]];                                // outward (the ring runs counter-clockwise)
    for (const [a, o] of offsetFace(bays, project, depth, 2)) out.push([A[0] + u[0] * a + n[0] * o, A[1] + u[1] * a + n[1] * o]);
  }
  return out;
}

const dedupe = (pts) => pts.filter((p, i) => {
  const q = pts[(i + pts.length - 1) % pts.length];
  return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-9;
});

const normalized = (pts) => {
  const R = Math.max(...pts.map(([x, y]) => Math.hypot(x, y)));
  return Object.freeze(dedupe(pts).map(([x, y]) => Object.freeze([r6(x / R), r6(y / R)])));
};

/** Read a plan word or `{ form, …dials }` → { form, ...resolved dials }. Throws naming the choices. */
export function readPlan(plan, at = 'plan') {
  const p = typeof plan === 'string' ? { form: plan } : plan;
  if (!p || typeof p !== 'object' || !PLAN_FORMS.includes(p.form)) {
    throw new Error(`${at}: a plan is one of ${PLAN_FORMS.join(', ')}, or { form, …dials } (got ${JSON.stringify(plan)})`);
  }
  const out = { form: p.form };
  for (const [k, [def, lo, hi, int]] of Object.entries(PLAN_DIALS[p.form])) {
    const v = p[k] ?? def;
    if (!Number.isFinite(v) || v < lo || v > hi || (int && !Number.isInteger(v))) throw new Error(`${at}.${k}: ${int ? 'a whole number' : 'a number'} from ${lo} to ${hi} (got ${JSON.stringify(p[k])})`);
    out[k] = v;
  }
  if (p.form === 'offset' && out.bays % 2 === 0) throw new Error(`${at}.bays: an odd number, so one bay stands in the middle (got ${out.bays})`);
  for (const k of Object.keys(p)) if (k !== 'form' && !(k in PLAN_DIALS[p.form])) throw new Error(`${at}.${k}: the ${p.form} plan's dials are ${Object.keys(PLAN_DIALS[p.form]).join(', ') || 'none'}`);
  return out;
}

const cache = new Map();
/** The plan's ring: counter-clockwise [x, y] points, farthest on the unit circle. Frozen and memoised. */
export function planRing(plan) {
  const p = readPlan(plan);
  const key = JSON.stringify(p);
  if (cache.has(key)) return cache.get(key);
  let pts;
  switch (p.form) {
    case 'square': pts = regular(4, Math.PI / 4); break;
    case 'circle': pts = regular(p.sides, 0); break;
    case 'turned': pts = star(p.sides * p.k, turnedInner(p.sides, p.k), Math.PI / p.sides); break;
    case 'star': pts = star(p.points, p.inner, 0); break;
    case 'stepped-circle': pts = steppedCircle(p.steps); break;
    default: pts = offsetPlan(p.bays, p.project, p.depth);
  }
  const ring = normalized(pts);
  cache.set(key, ring);
  return ring;
}

/** How far the ring reaches from its centre along `angle` (radians): the one crossing of a star-shaped ring. */
export function radiusAt(ring, angle) {
  const d = [Math.cos(angle), Math.sin(angle)];
  let best = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const e = [b[0] - a[0], b[1] - a[1]];
    const den = d[0] * e[1] - d[1] * e[0];
    if (Math.abs(den) < 1e-12) continue;
    const t = (a[0] * e[1] - a[1] * e[0]) / den;         // along the ray
    const s = (a[0] * d[1] - a[1] * d[0]) / den;         // along the edge
    if (t > 0 && s >= -1e-9 && s <= 1 + 1e-9) best = Math.max(best, t);
  }
  return best;
}

const convex = new WeakMap();
/** Whether a ring is convex (one cap polygon) or only star-shaped (a fan from the centre). Memoised per ring. */
export function ringConvex(ring) {
  if (!convex.has(ring)) convex.set(ring, isConvexRing(ring.map(([u, v]) => ({ u, v }))));
  return convex.get(ring);
}
