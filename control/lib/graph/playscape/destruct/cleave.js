/**
 * cleave — the SHAPED cut: dice an item into chunks by a pattern, whatever the item is. The item is its blocks (the
 * boxes its skin built, recorded by a `blockSink`) and a frame; the pattern is a set of convex CELLS, and a chunk is
 * the pieces of every block inside one cell, so a handle stays with the slab it is fixed to.
 *
 *   grid      dice: a lattice in the item's frame, `cell` metres (or `count` chunks), each axis split evenly over
 *             the item's extent; an axis thinner than ~1.5 cells is not cut (a door does not delaminate)
 *   voronoi   shatter: `count` seeded sites inside the item, at least `minSize` apart; on a thin axis the sites sit
 *             on the midplane, so the breaks run through the thickness like a plate's
 *
 * Every cut face is the inside: the block's value a step darker (`INSIDE_STEP`), so a break reads as a break under
 * any tone. Seeded (`seed`, mulberry32), pure, the same chunks for the same item forever.
 *
 *   cleave(item, { pattern, cell?, count?, minSize?, seed? }) → { pattern, chunks: [{ id, pieces, faces, centroid, volume, parts }] }
 *   itemOf(resolved)                                           → { blocks, frame } from any playscape resolved object
 */
import { boxPolytope, clip, volume, centroid, vertices, V } from './polytope.js';

export const INSIDE_STEP = 0.16;   // two emboss steps: the inside reads darker than any skin's own relief
export const CLEAVE_PATTERNS = Object.freeze(['grid', 'voronoi']);

const r5 = (x) => Math.round(x * 1e5) / 1e5 + 0;
const P = (p) => p.map(r5);

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** The blocks and frame of a resolved playscape object (its faces carry the boxes its skin built). */
export function itemOf(o) {
  const blocks = o.faces && o.faces.boxes;
  if (!blocks || !blocks.length) throw new Error(`cleave: ${o.entry || 'this item'} has no recorded blocks (its skin must build through obox into a blockSink)`);
  return { blocks, frame: o.frame || { at: [0, 0, 0], N: [0, -1, 0], U: [1, 0, 0] } };
}

// the item's own axes: across (U), out of its front (N), up
const axesOf = (frame) => { const U = V.unit(frame.U), Z = [0, 0, 1], N = V.unit(V.cross(Z, U)); return [U, N, Z]; };

// the item's extent along its axes: [min, max] per axis, over every block's corners
function extent(blocks, axes) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const b of blocks) for (const p of vertices(boxPolytope(b))) axes.forEach((e, k) => { const s = V.dot(p, e); lo[k] = Math.min(lo[k], s); hi[k] = Math.max(hi[k], s); });
  return { lo, hi, size: hi.map((h, k) => h - lo[k]) };
}

const insideOf = (src) => ({ ...src, value: src.value == null ? null : r5(Math.max(0, src.value - INSIDE_STEP)), cut: true });

// clip one block by a cell's half-spaces [n, d]; the caps wear the block's inside
function clipBy(poly, planes, cap) {
  let q = poly;
  for (const [n, d] of planes) { q = clip(q, n, d, cap); if (!q) return null; }
  return q;
}

function gridCells(blocks, frame, { cell, count }) {
  const axes = axesOf(frame), X = extent(blocks, axes);
  const vol = X.size.reduce((a, b) => a * Math.max(b, 1e-3), 1);
  const s = cell > 0 ? cell : Math.cbrt(vol / Math.max(1, count || 8));
  const n = X.size.map((L) => Math.max(1, Math.round(L / s)));
  const cells = [];
  for (let i = 0; i < n[0]; i++) for (let j = 0; j < n[1]; j++) for (let k = 0; k < n[2]; k++) {
    const idx = [i, j, k], planes = [];
    axes.forEach((e, a) => {
      const step = X.size[a] / n[a], lo = X.lo[a] + idx[a] * step, hi = lo + step;
      if (idx[a] > 0) planes.push([V.mul(e, -1), -lo]);         // e·p ≥ lo
      if (idx[a] < n[a] - 1) planes.push([e, hi]);               // e·p ≤ hi
    });
    cells.push({ id: `g${i}.${j}.${k}`, planes });
  }
  return { cells, split: n };
}

function voronoiCells(blocks, frame, { count = 8, minSize = 0.25, seed = 1 }) {
  const axes = axesOf(frame), X = extent(blocks, axes), rnd = mulberry32(seed >>> 0);
  const polys = blocks.map(boxPolytope);
  const inside = (p) => polys.some((q) => q.faces.every((f) => V.dot(f.n, V.sub(p, f.pts[0])) <= 1e-9));
  const sites = [];
  for (let tries = 0; sites.length < count && tries < count * 60; tries++) {
    const s = axes.map((e, a) => (X.size[a] < 2 * minSize ? (X.lo[a] + X.hi[a]) / 2 : X.lo[a] + rnd() * X.size[a]));
    const p = V.add(V.add(V.mul(axes[0], s[0]), V.mul(axes[1], s[1])), V.mul(axes[2], s[2]));
    if (!inside(p)) continue;
    if (sites.some((q) => V.len(V.sub(p, q)) < minSize)) continue;
    sites.push(p);
  }
  const cells = sites.map((si, i) => ({
    id: `v${i}`, site: P(si),
    planes: sites.filter((_, j) => j !== i).map((sj) => { const n = V.sub(sj, si); return [n, (V.dot(sj, sj) - V.dot(si, si)) / 2]; }),
  }));
  return { cells, sites };
}

/** Cut an item into chunks. */
export function cleave(item, { pattern = 'grid', cell, count, minSize = 0.25, seed = 1 } = {}) {
  if (!CLEAVE_PATTERNS.includes(pattern)) throw new Error(`cleave: pattern must be one of ${CLEAVE_PATTERNS.join(', ')}`);
  const { blocks, frame } = item.blocks ? item : itemOf(item);
  const { cells, split } = pattern === 'grid' ? gridCells(blocks, frame, { cell, count }) : voronoiCells(blocks, frame, { count, minSize, seed });
  const polys = blocks.map((b) => ({ b, poly: boxPolytope(b) }));
  const chunks = [];
  for (const C of cells) {
    const pieces = [];
    for (const { b, poly } of polys) {
      const q = clipBy(poly, C.planes, insideOf({ value: b.value, group: b.group, part: b.part }));
      if (q && volume(q) > 1e-7) pieces.push({ poly: q, part: b.part, volume: volume(q) });
    }
    if (!pieces.length) continue;
    const vol = pieces.reduce((a, p) => a + p.volume, 0);
    const c = pieces.reduce((a, p) => V.add(a, V.mul(centroid(p.poly), p.volume)), [0, 0, 0]);
    chunks.push({
      id: C.id, pieces,
      faces: pieces.flatMap((p) => p.poly.faces.map((f) => faceOut(f))),
      centroid: P(V.mul(c, 1 / vol)), volume: r5(vol),
      parts: [...new Set(pieces.map((p) => p.part).filter(Boolean))],
    });
  }
  return { pattern, chunks, ...(split ? { split } : {}) };
}

/** A polytope face as a scene-ready face: values only (tint is the value), the cut flagged. */
export function faceOut(f) {
  const v = f.src && f.src.value != null ? f.src.value : 0.5;
  return { corners: f.pts.map(P), normal: P(f.n), outNormal: P(f.n), tint: [v, v, v], value: v, group: f.src?.group ?? 'obj:body', part: f.src?.part ?? null, ...(f.src?.cut ? { cut: true } : {}) };
}
