/**
 * THE FEATURE COAT: a feature animal's markings as THIN LAYERS over its skin, like clothes (docs/mascot.md, the feature
 * style's principles: harmonious fur shape patterns, not ink blots; thin layers to indicate detail). A marking is a shape
 * DESIGNED with the head and its tufts, drawn in a few strokes the way the realistic hair is combed (a root, a flow, a
 * point), and laid on the skin as a layer of its own: the skin under it refined, clipped exactly along the marking's edge,
 * lifted a hair off the skin, its edge given a thin wall, so the edge is its own clean geometry with a thickness, never
 * the skin's facets painted.
 *
 *   stroke({ points, r })        a lock laid on the skin: a chain of round cones through its points (snapped onto the skin)
 *                                with a radius at each (a rounded root, a pointed tip: the last radius small)
 *   band({ c, axis, w, R, teeth, depth })   a ring about an axis (a tail's): |(p − c)·axis| within w, inside a ball of R;
 *                                its edges notched in `teeth` points `depth` deep, round the axis
 *   cutSkin({ V, F }, marks, { field, shapes })   → { V, F, groups }: a ZONE (a mark of territories alone: the muzzle, the
 *                                belly, the paws) cut into the skin itself along its exact edge, its faces in its group: no
 *                                face added under a big zone, its edge a clean line, never the skin's facets
 *   coatLayers({ V, F, field, shapes, weights }, marks, { lift })   → the layers: a layer-1 open mesh part a marking, each
 *                                point bound by the skin's weights there. A mark: { name, group, strokes?, bands?, eggs?
 *                                (the territory of these shapes: where they are nearer than every other shape) }, the later
 *                                lying over the earlier
 *   FEATURE_COAT                 the lift (metres), each later layer's added lift, the refinement, the stroke budget
 *
 * Pure and deterministic: fixed loops, ties by index; no dice, no clock.
 */
import { sdRoundCone } from '../polygonizer/vajra.js';
import { simplifyMesh } from '../polygonizer/skin-net.js';
import { eggDistance } from './feature-body.js';

/** the layer's lift off the skin and each later layer's over it (metres), the refinement under a marking (levels of
 *  four-way splits), the faces a layer keeps per face of the skin under it, and the STROKE BUDGET: a figure's strokes
 *  and bands together (the hair's lesson: few strokes, well placed) */
export const FEATURE_COAT = Object.freeze({ lift: 0.0016, step: 0.0009, levels: 1, keep: 1.2, budget: 24 });

const r4 = (x) => Math.round(x * 1e4) / 1e4 + 0;
const r6 = (x) => Math.round(x * 1e6) / 1e6 + 0;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const P3 = (p) => ({ x: p[0], y: p[1], z: p[2] });

export const stroke = ({ points, r }) => Object.freeze({ kind: 'stroke', points, r });
export const band = ({ c, axis, w, R, teeth = 0, depth = 0 }) => Object.freeze({ kind: 'band', c, axis: unit(axis), w, R, teeth, depth });

/** a point carried onto the skin: Newton steps along the field's gradient */
function onSkin(field, p, e = 1e-4) {
  let q = p;
  for (let i = 0; i < 6; i++) {
    const f = field(P3(q)), g = [field(P3(add(q, [e, 0, 0]))) - field(P3(sub(q, [e, 0, 0]))), field(P3(add(q, [0, e, 0]))) - field(P3(sub(q, [0, e, 0]))), field(P3(add(q, [0, 0, e]))) - field(P3(sub(q, [0, 0, e])))].map((x) => x / (2 * e));
    const g2 = dot(g, g); if (g2 < 1e-12) break;
    q = sub(q, mul(g, f / g2));
    if (Math.abs(f) < 1e-6) break;
  }
  return q;
}

/** a marking's field on the skin (negative inside): the union of its strokes, bands and territory */
function markField(mark, field, shapes) {
  const parts = [];
  for (const s of mark.strokes ?? []) {
    const pts = s.points.map((p) => P3(onSkin(field, p)));
    parts.push((q) => { let d = Infinity; for (let i = 0; i + 1 < pts.length; i++) d = Math.min(d, sdRoundCone(q, pts[i], pts[i + 1], s.r[i], s.r[i + 1])); return d; });
  }
  for (const B of mark.bands ?? []) {
    // (a reference across the axis, so a tooth's angle round it is fixed)
    const ref = unit(Math.abs(B.axis[2]) < 0.9 ? sub([0, 0, 1], mul(B.axis, B.axis[2])) : sub([1, 0, 0], mul(B.axis, B.axis[0]))), side2 = [B.axis[1] * ref[2] - B.axis[2] * ref[1], B.axis[2] * ref[0] - B.axis[0] * ref[2], B.axis[0] * ref[1] - B.axis[1] * ref[0]];
    parts.push((q) => {
      const p = [q.x, q.y, q.z], d = sub(p, B.c), a = dot(d, B.axis), th = Math.atan2(dot(d, side2), dot(d, ref));
      const tooth = B.teeth ? B.depth * (1 - 2 * Math.abs(((th / (2 * Math.PI)) * B.teeth + 1000) % 1 - 0.5)) : 0;
      return Math.max(Math.abs(a) - (B.w + tooth), Math.hypot(...d) - B.R);
    });
  }
  if (mark.eggs?.length) {
    const own = shapes.filter((E) => mark.eggs.includes(E.name)), rest = shapes.filter((E) => !mark.eggs.includes(E.name));
    parts.push((q) => { const p = [q.x, q.y, q.z]; let a = Infinity, b = Infinity; for (const E of own) a = Math.min(a, eggDistance(E, p)); for (const E of rest) b = Math.min(b, eggDistance(E, p)); return a - b; });
  }
  return (p) => { let d = Infinity; for (const f of parts) d = Math.min(d, f(P3(p))); return d; };
}

/** the strokes and bands of a set of marks: what the budget counts */
export const strokesOf = (marks) => marks.reduce((n, m) => n + (m.strokes?.length ?? 0) + (m.bands?.length ?? 0), 0);

export function cutSkin({ V, F }, marks, { field, shapes }) {
  let P = V.map((p) => [...p]), T = F.map((t) => [...t]), G = T.map(() => null);
  for (const mark of marks) {
    const m = markField(mark, field, shapes), d = P.map(m), cut = new Map(), nT = [], nG = [];
    const cross = (a, b) => { const k = a < b ? `${a}|${b}` : `${b}|${a}`; let i = cut.get(k); if (i === undefined) { const t = d[a] / (d[a] - d[b]); i = P.length; P.push(onSkin(field, lerp(P[a], P[b], t))); d.push(0); cut.set(k, i); } return i; };
    T.forEach((t, fi) => {
      const inn = t.map((v) => d[v] < 0), n = inn.filter(Boolean).length;
      if (n === 0 || n === 3) { nT.push(t); nG.push(n === 3 ? mark.group : G[fi]); return; }
      // (the lone corner's piece and the other two's quad, each in its side's group)
      const k = inn.findIndex((x) => (n === 1 ? x : !x)), a = t[k], b = t[(k + 1) % 3], c = t[(k + 2) % 3], ab = cross(a, b), ca = cross(c, a);
      const lone = n === 1 ? mark.group : G[fi], pair = n === 1 ? G[fi] : mark.group;
      nT.push([a, ab, ca], [ab, b, c], [ab, c, ca]); nG.push(lone, pair, pair);
    });
    T = nT; G = nG;
  }
  return { V: P, F: T, groups: G };
}

export function coatLayers({ V, F, field, shapes, weights }, marks, { lift = FEATURE_COAT.lift, step = FEATURE_COAT.step, levels = FEATURE_COAT.levels } = {}) {
  const used = strokesOf(marks);
  if (used > FEATURE_COAT.budget) throw new Error(`feature coat: ${used} strokes over the budget of ${FEATURE_COAT.budget} (few strokes, well placed)`);
  const grad = (p, e = 1e-4) => unit([field(P3(add(p, [e, 0, 0]))) - field(P3(sub(p, [e, 0, 0]))), field(P3(add(p, [0, e, 0]))) - field(P3(sub(p, [0, e, 0]))), field(P3(add(p, [0, 0, e]))) - field(P3(sub(p, [0, 0, e])))]);
  return marks.map((mark, order) => {
    const m = markField(mark, field, shapes), mv = V.map(m);
    // 1. the skin's faces under the marking or at its edge (a margin of an edge's length), split `levels` times four ways,
    // each new point carried onto the skin (no face kept here touches one not kept that is inside: no crack)
    const edgeLen = (t) => Math.max(...[0, 1, 2].map((k) => Math.hypot(...sub(V[t[k]], V[t[(k + 1) % 3]]))));
    let P = [], T = [], idx = new Map();
    const pid = (p) => { const k = p.map((x) => Math.round(x * 1e7)).join(','); let i = idx.get(k); if (i === undefined) { i = P.length; P.push(p); idx.set(k, i); } return i; };
    for (const t of F) if (Math.min(mv[t[0]], mv[t[1]], mv[t[2]]) < edgeLen(t)) T.push(t.map((v) => pid(V[v])));
    for (let l = 0; l < levels; l++) {
      const mid = new Map(), next = [];
      const midOf = (a, b) => { const k = a < b ? `${a}|${b}` : `${b}|${a}`; let i = mid.get(k); if (i === undefined) { i = P.length; P.push(onSkin(field, lerp(P[a], P[b], 0.5))); mid.set(k, i); } return i; };
      for (const [a, b, c] of T) { const ab = midOf(a, b), bc = midOf(b, c), ca = midOf(c, a); next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]); }
      T = next;
    }
    // 2. clipped exactly along the marking's edge: a face across it cut on its edges' crossings (shared by both faces)
    const d = P.map(m), cut = new Map(), Q = [...P], out = [];
    const cross = (a, b) => { const k = a < b ? `${a}|${b}` : `${b}|${a}`; let i = cut.get(k); if (i === undefined) { const t = d[a] / (d[a] - d[b]); i = Q.length; Q.push(onSkin(field, lerp(Q[a], Q[b], t))); cut.set(k, i); } return i; };
    for (const t of T) {
      const inn = t.map((v) => d[v] < 0), n = inn.filter(Boolean).length;
      if (n === 3) out.push(t); else if (n === 0) continue;
      else for (let k = 0; k < 3; k++) {
        const a = t[k], b = t[(k + 1) % 3], c = t[(k + 2) % 3];
        if (n === 1 && inn[k]) out.push([a, cross(a, b), cross(c, a)]);
        if (n === 2 && !inn[(k + 2) % 3] && inn[k] && inn[(k + 1) % 3]) { const bc = cross(b, c), ca = cross(c, a); out.push([a, b, bc], [a, bc, ca]); }
      }
    }
    // 3. simplified back toward the skin's density inside, its edge kept
    const ids = [...new Set(out.flat())].sort((a, b) => a - b), re = new Map(ids.map((v, i) => [v, i]));
    const V0 = ids.map((v) => Q[v]), F0 = out.map((t) => t.map((v) => re.get(v)));
    const edges = new Map(); for (const t of F0) for (let k = 0; k < 3; k++) { const a = t[k], b = t[(k + 1) % 3], key = a < b ? `${a}|${b}` : `${b}|${a}`; edges.set(key, (edges.get(key) ?? 0) + 1); }
    const rim = new Set(); for (const [key, n] of edges) if (n === 1) for (const v of key.split('|')) rim.add(+v);
    const under = F.filter((t) => Math.max(mv[t[0]], mv[t[1]], mv[t[2]]) < 0).length + rim.size / 2;
    const S = F0.length > 64 ? simplifyMesh(V0, F0, { target: Math.max(64, Math.round(under * FEATURE_COAT.keep)), locked: V0.map((_, v) => (rim.has(v) ? 1 : 0)), turn: 0.3 }) : { V: V0, F: F0, of: V0.map((_, i) => i) };
    // 4. lifted off the skin, the later over the earlier; its edge walled down to the skin
    const h = lift + order * step, points = {}, normals = {}, faces = {}, blend = {};
    const N = S.V.map((p) => grad(p));
    S.V.forEach((p, i) => { points[`v${i}`] = add(p, mul(N[i], h)).map(r6); normals[`v${i}`] = N[i].map(r4); blend[`st0.v${i}`] = weights(p); });
    S.F.forEach((t, i) => { faces[`f${i}`] = t.map((v) => `v${v}`); });
    const E2 = new Map(); for (const t of S.F) for (let k = 0; k < 3; k++) { const a = t[k], b = t[(k + 1) % 3]; E2.set(`${a}|${b}`, true); }
    const boundary = []; let w = 0;
    for (const t of S.F) for (let k = 0; k < 3; k++) {
      const a = t[k], b = t[(k + 1) % 3]; if (E2.has(`${b}|${a}`)) continue;
      // (a rim edge a→b, wound as its face: the wall a, b, b's foot, a's foot)
      for (const v of [a, b]) if (!points[`w${v}`]) { points[`w${v}`] = sub(S.V[v], mul(N[v], h * 0.5)).map(r6); normals[`w${v}`] = normals[`v${v}`]; blend[`st0.w${v}`] = blend[`st0.v${v}`]; }
      faces[`w${w++}`] = [`v${a}`, `w${b}`, `v${b}`]; faces[`w${w++}`] = [`v${a}`, `w${a}`, `w${b}`];
      boundary.push([`w${a}`, `w${b}`]);
    }
    return { name: `coat${mark.name[0].toUpperCase()}${mark.name.slice(1)}`, kind: 'mesh', closure: 'open', group: mark.group, mesh: { points, faces, normals, boundary }, bind: { bone: 'head', blend } };
  });
}
