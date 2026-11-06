/**
 * THE OUTLINE GATE — are the variants different shapes, or one shape in other coats? A machine gate over the
 * silhouette axis: each variant's faces (any kind the World draws) seen flat from three sides (the three axis planes,
 * so it needs no knowledge of which way a kind stands), each in its own square frame (so a shape is compared, not a
 * size), and every pair's overlap averaged over the three. Advisory, as every gate: it stamps, it never refuses.
 *
 *   meshOfFaces(faces)                          a World payload's faces (corners, studio left out) → { vertices, faces }
 *   outlinesApart(meshes, { res?, ceiling? })   { name: mesh } → { ok, ceiling, pairs: [{ a, b, iou }] most alike first,
 *                                               mostAlike, from? } (`from`: each variant's overlap with `design`, when
 *                                               the meshes hold one by that name)
 *
 * The ceiling is the production silhouette gate's (polygonizer/silhouette-gates.js DISTINCT_CEILING): two outlines
 * overlapping more than it read as one. Pure and deterministic.
 */
import { figureMask, DISTINCT_CEILING } from '../polygonizer/silhouette-gates.js';
import { maskIoU } from '../scene/wire-compare.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
const PLANES = Object.freeze([[0, 1], [0, 2], [1, 2]]);

/** A payload's faces as one triangle mesh (each face fanned from its first corner; the studio's floor left out). */
export function meshOfFaces(faces) {
  const vertices = [], tris = [];
  for (const f of faces ?? []) {
    if (f.studio || !Array.isArray(f.corners) || f.corners.length < 3) continue;
    const at = vertices.length;
    for (const c of f.corners) vertices.push([c[0], c[1], c[2]]);
    for (let k = 1; k + 1 < f.corners.length; k++) tris.push([at, at + k, at + k + 1]);
  }
  return { vertices, faces: tris };
}

/** The outline on one axis plane, in its own square frame. figureMask draws the view from the front (u = −x, v = z),
 * so the plane's two axes are set there. */
function planeMask(mesh, [a, b], res) {
  const vertices = mesh.vertices.map((p) => [p[a], 0, p[b]]);
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const p of vertices) { u0 = Math.min(u0, -p[0]); u1 = Math.max(u1, -p[0]); v0 = Math.min(v0, p[2]); v1 = Math.max(v1, p[2]); }
  const span = Math.max(u1 - u0, v1 - v0, 1e-9) * 1.05;
  const frame = { u0: (u0 + u1) / 2 - span / 2, v0: (v0 + v1) / 2 - span / 2, span };
  return figureMask({ vertices, faces: mesh.faces }, 180, { res, frame });
}

export function outlinesApart(meshes, { res = 96, ceiling = DISTINCT_CEILING } = {}) {
  const names = Object.keys(meshes).filter((n) => meshes[n]?.faces?.length);
  const masks = Object.fromEntries(names.map((n) => [n, PLANES.map((pl) => planeMask(meshes[n], pl, res))]));
  const iou = (x, y) => r3(PLANES.reduce((t, _, k) => t + maskIoU(masks[x][k], masks[y][k]), 0) / PLANES.length);
  const variants = names.filter((n) => n !== 'design');
  const pairs = [];
  for (let i = 0; i < variants.length; i++) for (let j = i + 1; j < variants.length; j++) pairs.push({ a: variants[i], b: variants[j], iou: iou(variants[i], variants[j]) });
  pairs.sort((p, q) => q.iou - p.iou || (p.a + p.b < q.a + q.b ? -1 : 1));
  const from = names.includes('design') ? Object.fromEntries(variants.map((v) => [v, iou('design', v)])) : undefined;
  return { ok: !pairs.length || pairs[0].iou <= ceiling, ceiling, pairs, mostAlike: pairs[0] ?? null, ...(from ? { from } : {}) };
}
