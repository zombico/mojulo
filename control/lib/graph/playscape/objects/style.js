/**
 * shape styles — what tone is to colour, a shape style is to proportion. The recipe builds the REALISTIC object; a
 * style passes its faces through a resizer that exaggerates parts and warps them out of true, then fits the result
 * back into the realistic object's own bounds. The space it takes never changes, so neither does play: the collider,
 * the hinge, the pick target and the doorway fit all come from the realistic recipe, and a door plays the same in
 * every look. Only the render changes.
 *
 *   styleObject(resolved, style, { seed }) → resolved, its faces styled (realistic: unchanged)
 *
 * A style, in three steps, all seeded (mulberry32), so a styled object is still a recipe: `{ shape, seed }`.
 *   1. RESIZE    each part by its own factors, per axis of the object's frame (u across, n out, z up): the 33 a little
 *                bigger, the handle chunky, the grooves deep.
 *   2. INCONGRUE each piece twists a little on its own: the out-of-true that reads as hand-made, never as broken. A
 *                twist is held to `reach`, so a long piece barely tilts; the parts stay tidy and the outline carries the style.
 *   3. WARP      the whole, by straight lines: the width at each height from a profile (a narrow foot flaring to a
 *                shoulder, then breaking in), the head lifted to a point. Lines inside lean in proportion to their
 *                distance from the middle, so every inner edge echoes the outline's angle and the middle stays plumb.
 * Then FIT: each axis mapped back onto the realistic bounds. Normals are recomputed from the warped corners.
 */

import { resolveObject } from './index.js';

export const SHAPE_STYLES = Object.freeze({
  realistic: null,
  isekai: {
    cell: 0.12,   // the faces split this fine so a bend has corners to land on
    // [across, out, up] per part; `thin` scales only a piece's thin in-plane side, so fill fattens and deepens but never
    // outgrows the part it sits on (a strap gets thicker, not longer)
    resize: { body: [1, 1, 1], fill: { thin: 1.6, out: 3 }, detail: [1.22, 1.6, 1.22], handle: [1.7, 1.7, 1.7] },
    // the parts stay tidy: a little out of true each, the incongruity is the outline's
    twist: { body: 0, fill: 0.02, detail: 0.04, handle: 0.06 },   // radians, each piece its own sign and share
    reach: 0.02,   // metres: no piece's end moves further than this by its twist, so a long strip barely tilts
    bow: { body: 0, fill: 0, detail: 0, handle: 0 },
    // the outline: straight sides at angles, never curves. `profile` is the width at heights up the object (0 the
    // sill, 1 the top), joined by straight lines: a narrow foot, the sides flaring out to a shoulder, then breaking in.
    // `point` lifts the head's middle in two straight facets to a point. Every line inside leans in proportion to its
    // distance from the middle, so the panels and the grooves echo the sides' angle and the middle stays plumb.
    warp: { profile: [[0, 0.84], [0.68, 1.06], [1, 0.62]], point: 0.12, lean: 0.015, bulge: 0.02 },
  },
});
export const SHAPE_IDS = Object.freeze(Object.keys(SHAPE_STYLES));

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const r5 = (x) => Math.round(x * 1e5) / 1e5 + 0;
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return a.map((x) => r5(x / l)); };
const bounds = (pts) => [0, 1, 2].map((k) => [Math.min(...pts.map((p) => p[k])), Math.max(...pts.map((p) => p[k]))]);

export function styleObject(o, shape = 'realistic', { seed = 1 } = {}) {
  const S = SHAPE_STYLES[shape];
  if (S === undefined) throw new Error(`playscape: unknown shape style '${shape}' (known: ${SHAPE_IDS.join(', ')})`);
  if (!S) return o;
  const { at, N, U } = o.frame, Z = [0, 0, 1];
  const toL = (p) => { const d = sub(p, at); return [dot(d, U), dot(d, N), d[2]]; };
  const toW = (q) => [0, 1, 2].map((k) => r5(at[k] + U[k] * q[0] + N[k] * q[1] + Z[k] * q[2]));
  const R = mulberry32(seed >>> 0 || 1), rnd = () => R() * 2 - 1;

  const faces = o.faces.map((f) => ({ ...f, L: f.corners.map(toL) }));
  const B0 = bounds(faces.flatMap((f) => f.L));   // the realistic object's space, kept to the end
  const W = (B0[0][1] - B0[0][0]) / 2, H = B0[2][1] - B0[2][0], u0 = (B0[0][0] + B0[0][1]) / 2;

  // 1 + 2: each piece about its own centre — resized by its part's factors, then its own twist and bow
  const pieces = new Map();
  for (const f of faces) { const k = f.piece ?? f.part; if (!pieces.has(k)) pieces.set(k, []); pieces.get(k).push(f); }
  for (const [, fs] of [...pieces].sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'en', { numeric: true }))) {
    const part = fs[0].part, r = S.resize[part] || [1, 1, 1];
    const pts = fs.flatMap((f) => f.L), c = [0, 1, 2].map((i) => pts.reduce((s, p) => s + p[i], 0) / pts.length);
    const b = bounds(pts), ph = b[2][1] - b[2][0] || 1, pw = b[0][1] - b[0][0];
    const k = Array.isArray(r) ? r : [pw < ph ? r.thin : 1, r.out, pw < ph ? 1 : r.thin];
    const half = Math.max(b[0][1] - b[0][0], ph) / 2, cap = S.reach ? Math.asin(Math.min(1, S.reach / (half || 1))) : Infinity;
    const a = Math.max(-cap, Math.min(cap, rnd() * (S.twist[part] || 0))), bow = rnd() * (S.bow[part] || 0), ca = Math.cos(a), sa = Math.sin(a);
    for (const f of fs) f.L = f.L.map((p) => {
      let u = (p[0] - c[0]) * k[0], n = (p[1] - c[1]) * k[1], z = (p[2] - c[2]) * k[2];
      [u, z] = [ca * u - sa * z, sa * u + ca * z];
      u += bow * Math.sin((Math.PI * (p[2] - b[2][0])) / ph);
      return [c[0] + u, c[1] + n, c[2] + z];
    });
  }
  // 3: the whole, in the frame's own proportions (s across from the middle, t up from the sill): the width scaled by
  // the profile at each height, the head lifted to a point, all by straight lines
  const w = S.warp, lean = rnd() >= 0 ? w.lean : -w.lean, P = w.profile, shoulder = P[P.length - 2][0];
  const widthAt = (t) => {
    if (t <= P[0][0]) return P[0][1];
    for (let i = 1; i < P.length; i++) if (t <= P[i][0]) return P[i - 1][1] + ((t - P[i - 1][0]) / (P[i][0] - P[i - 1][0])) * (P[i][1] - P[i - 1][1]);
    return P[P.length - 1][1];
  };
  for (const f of faces) f.L = f.L.map(([u, n, z]) => {
    const s = (u - u0) / (W || 1), t = (z - B0[2][0]) / (H || 1), as = Math.min(1, Math.abs(s));
    const head = Math.max(0, (t - shoulder) / (1 - shoulder));
    return [u0 + (u - u0) * widthAt(t) + lean * t * H, n - w.bulge * (1 - as), z + w.point * H * head * (1 - as)];
  });
  // FIT: back into the realistic object's space, axis by axis
  const B1 = bounds(faces.flatMap((f) => f.L));
  const fit = (q) => q.map((x, k) => (B1[k][1] - B1[k][0] < 1e-9 ? x : B0[k][0] + ((x - B1[k][0]) / (B1[k][1] - B1[k][0])) * (B0[k][1] - B0[k][0])));
  const out = faces.map(({ L, ...f }) => {
    const corners = L.map((q) => toW(fit(q)));
    const was = f.corners, sgn = Math.sign(dot(cross(sub(was[2], was[0]), sub(was[3] || was[2], was[1])), f.normal)) || 1;
    const n = unit(cross(sub(corners[2], corners[0]), sub(corners[3] || corners[2], corners[1])).map((x) => x * sgn));
    return { ...f, corners, normal: n, outNormal: n };
  });
  return { ...o, faces: out, style: { shape, seed } };
}

/** Resolve an archetype and give it a shape style in one step: built split as fine as the style needs, then styled. */
export function resolveStyled(args, shape = 'realistic', { seed = 1 } = {}) {
  const S = SHAPE_STYLES[shape];
  return styleObject(resolveObject({ ...args, ...(S ? { cell: S.cell } : {}) }), shape, { seed });
}
