/**
 * SILHOUETTE GATES: a figure's outline from the views a player reads it by, and the two machine gates over it.
 *
 *   figureMask(mesh, az, { res, frame })        the outline seen from azimuth `az` (degrees, the depth-raster
 *                                               convention: 180 the front, 150 the three-quarter, 90 the side), an
 *                                               orthographic Uint8Array res × res, in `frame` (below)
 *   keepsSilhouette(ref, mesh, { views, min })  the TEST gate: a pass over an authored figure keeps its outline. Both
 *                                               are drawn in the reference's own frame (metres), so a change of size
 *                                               is a change of outline. → { ok, min, views: { name: iou }, worst }
 *   distinctSilhouettes(figures, { views, ceiling })   the PRODUCTION gate: composed figures differ in outline. Each is
 *                                               drawn in its own height frame (feet at the bottom, the figure's height
 *                                               the frame's), so it reads shape; heights are reported beside it.
 *                                               → { ok, ceiling, pairs: [{ a, b, iou }] most alike first, mostAlike }
 *
 * A FRAME is { u0, v0, span }: the square [u0, u0 + span] × [v0, v0 + span] of the view plane (u across, v up, metres).
 * `heightFrame(mesh, az)` frames a figure by its height: its feet on the bottom row, centred across on its footprint,
 * the span 1.1 × its height. Pure and deterministic; no camera, no perspective (an outline is compared, not a picture).
 */
import { maskIoU } from '../scene/wire-compare.js';

export const SILHOUETTE_VIEWS = Object.freeze({ front: 180, 'three-quarter': 150, side: 90 });
/** the production gate's ceiling on two figures' mean overlap, set from the boards: the Egocube's rolled lineages on one
 * shared body read 0.76–0.84 and a brief that moved no facet 1.0; one girl at 11 and 16, and two different heroes,
 * 0.71–0.73. A pair above it reads as one silhouette. */
export const DISTINCT_CEILING = 0.75;
const R6 = (v) => Math.round(v * 1e6) / 1e6;
const r3 = (v) => Math.round(v * 1000) / 1000;

/** a vertex on the view plane: u across (the camera's right), v up */
const planeOf = (az) => { const a = az * Math.PI / 180; return [Math.cos(a), Math.sin(a)]; };
const project = (mesh, az) => { const [cx, cy] = planeOf(az); return mesh.vertices.map((p) => [p[0] * cx + p[1] * cy, p[2]]); };

/** the figure's own frame from a view: feet on the bottom row, centred on its footprint, 1.1 × its height across */
export function heightFrame(mesh, az) {
  const q = project(mesh, az);
  let v0 = Infinity, v1 = -Infinity; for (const p of q) { v0 = Math.min(v0, p[1]); v1 = Math.max(v1, p[1]); }
  const H = v1 - v0, foot = q.filter((p) => p[1] <= v0 + 0.05 * H);
  const uc = (Math.min(...foot.map((p) => p[0])) + Math.max(...foot.map((p) => p[0]))) / 2, span = 1.1 * H;
  return { u0: uc - span / 2, v0, span, height: H };
}

export function figureMask(mesh, az, { res = 160, frame = heightFrame(mesh, az) } = {}) {
  const q = project(mesh, az), m = new Uint8Array(res * res), k = res / frame.span;
  // pixel (i, j): column i across, row j up from the frame's bottom
  const px = q.map((p) => [(p[0] - frame.u0) * k, (p[1] - frame.v0) * k]);
  for (const f of mesh.faces) {
    const [a, b, c] = [px[f[0]], px[f[1]], px[f[2]]];
    const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(den) <= 1e-12) continue;
    const i0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), i1 = Math.min(res - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const j0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), j1 = Math.min(res - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = i + 0.5, y = j + 0.5;
      const wa = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / den, wb = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / den;
      if (wa >= -1e-9 && wb >= -1e-9 && 1 - wa - wb >= -1e-9) m[j * res + i] = 1;
    }
  }
  return m;
}

const viewsOf = (views) => (Array.isArray(views) ? views : Object.keys(views)).map((v) => [v, SILHOUETTE_VIEWS[v] ?? Number(v)]);

export function keepsSilhouette(ref, mesh, { views = SILHOUETTE_VIEWS, min = 0.95, res = 160 } = {}) {
  const out = {};
  for (const [name, az] of viewsOf(views)) { const frame = heightFrame(ref, az); out[name] = r3(maskIoU(figureMask(ref, az, { res, frame }), figureMask(mesh, az, { res, frame }))); }
  const worst = Object.entries(out).sort((x, y) => x[1] - y[1])[0];
  return { ok: worst[1] >= min, min, views: out, worst: { view: worst[0], iou: worst[1] } };
}

export function distinctSilhouettes(figures, { views = SILHOUETTE_VIEWS, ceiling = DISTINCT_CEILING, res = 160 } = {}) {
  const names = Object.keys(figures), V = viewsOf(views);
  const masks = Object.fromEntries(names.map((n) => [n, V.map(([, az]) => figureMask(figures[n], az, { res }))]));
  const heights = Object.fromEntries(names.map((n) => [n, R6(heightFrame(figures[n], 180).height)]));
  const pairs = [];
  for (let x = 0; x < names.length; x++) for (let y = x + 1; y < names.length; y++) {
    const per = V.map((_, k) => maskIoU(masks[names[x]][k], masks[names[y]][k]));
    pairs.push({ a: names[x], b: names[y], iou: r3(per.reduce((t, v) => t + v, 0) / per.length), views: Object.fromEntries(V.map(([n], k) => [n, r3(per[k])])) });
  }
  pairs.sort((p, q) => q.iou - p.iou || (p.a + p.b < q.a + q.b ? -1 : 1));
  return { ok: !pairs.length || pairs[0].iou <= ceiling, ceiling, pairs, mostAlike: pairs[0] ?? null, heights };
}
