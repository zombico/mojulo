/**
 * dismantle — the CONCEPT cut: no material is cut; the relationships between an item's blocks are. The relationships
 * are read off the geometry, never authored per shape:
 *
 *   joints(blocks)   two blocks that touch or overlap are joined (sampled on each box's faces, within `eps`);
 *                    a block on the ground, or in an `anchors` box, is anchored
 *   dismantle(item, { sever })   cut joints: `sever` names parts (each loses every joint), joint ids, or 'all'.
 *                    The connected groups that still reach an anchor stand (static); every other group becomes a body
 *                    that falls as one (the slab keeps its handle; a severed plank goes on its own). Relief (a seam,
 *                    a groove, thinner than `relief` metres) rides the one block it touches most, never on its own.
 *
 * The body list is what collapse.js moves; the static list is what it lands on.
 */
import { boxPolytope, centroid, volume, V } from './polytope.js';
import { itemOf, faceOut } from './cleave.js';

const r5 = (x) => Math.round(x * 1e5) / 1e5 + 0;
const P = (p) => p.map(r5);

// a box as a test: is p inside it, grown by eps
function insideBox(b, p, eps) {
  const d = V.sub(p, b.c);
  return [b.A, b.B, b.C].every((a, k) => Math.abs(V.dot(d, V.unit(a))) <= b.h[k] + eps);
}

// sample points on a box's faces: each face's centre and four points two-thirds out toward its corners
function facePoints(b) {
  const ax = [V.unit(b.A), V.unit(b.B), V.unit(b.C)], out = [];
  for (let k = 0; k < 3; k++) for (const s of [1, -1]) {
    const o = V.add(b.c, V.mul(ax[k], s * b.h[k])), u = ax[(k + 1) % 3], w = ax[(k + 2) % 3], hu = b.h[(k + 1) % 3], hw = b.h[(k + 2) % 3];
    for (const [a, c] of [[0, 0], [0.66, 0.66], [-0.66, 0.66], [0.66, -0.66], [-0.66, -0.66]]) out.push(V.add(o, V.add(V.mul(u, a * hu), V.mul(w, c * hw))));
  }
  return out;
}

/** The joints between blocks and which blocks are anchored. */
export function joints(blocks, { eps = 0.01, ground = null, anchors = [] } = {}) {
  const pts = blocks.map(facePoints), J = [];
  for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
    const hits = pts[i].filter((p) => insideBox(blocks[j], p, eps)).length + pts[j].filter((p) => insideBox(blocks[i], p, eps)).length;
    if (hits) J.push({ id: `j${i}-${j}`, a: i, b: j, hits });
  }
  const zMin = (b) => Math.min(...boxPolytope(b).faces.flatMap((f) => f.pts.map((p) => p[2])));
  const g = ground ?? Math.min(...blocks.map(zMin));
  const anchored = blocks.map((b, i) => zMin(b) <= g + eps || anchors.some((A) => pts[i].some((p) => p.every((x, k) => x >= A.min[k] - eps && x <= A.max[k] + eps))));
  return { joints: J, anchored, ground: r5(g) };
}

/** Sever joints and let what no longer reaches an anchor fall, each connected group as one body. */
export function dismantle(item, { sever = 'all', eps = 0.01, ground = null, anchors = [], relief = 0.024 } = {}) {
  const { blocks } = item.blocks ? item : itemOf(item);
  const G = joints(blocks, { eps, ground, anchors });
  const names = sever === 'all' ? null : [].concat(sever);
  // RELIEF (a seam, a groove, a strap thinner than `relief` on some axis) is skin, not structure: it rides ONE host,
  // the neighbour it touches most, and that joint is never cut; its other joints are (a seam does not glue two boards)
  const isRelief = (i) => Math.min(...blocks[i].h) * 2 < relief;
  const host = new Map();
  blocks.forEach((_, i) => {
    if (!isRelief(i)) return;
    const mine = G.joints.filter((j) => (j.a === i || j.b === i) && !isRelief(j.a === i ? j.b : j.a)).sort((x, y) => y.hits - x.hits);
    if (mine.length) host.set(i, mine[0].id);
  });
  const rides = (j) => host.get(j.a) === j.id || host.get(j.b) === j.id;
  const touchesRelief = (j) => isRelief(j.a) || isRelief(j.b);
  const cut = (j) => !rides(j) && (touchesRelief(j) || names === null || names.includes(j.id) || names.includes(blocks[j.a].part) || names.includes(blocks[j.b].part));
  const kept = G.joints.filter((j) => !cut(j));
  // a severed block also loses its anchor (cut from the ground as from everything else)
  const loose = (i) => names === null || names.includes(blocks[i].part);
  const anchored = G.anchored.map((a, i) => a && !(names !== null && loose(i)));
  // connected groups over the kept joints
  const parent = blocks.map((_, i) => i), find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (const j of kept) parent[find(j.a)] = find(j.b);
  const groups = new Map();
  blocks.forEach((_, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); });
  const bodies = [], statics = [];
  for (const ids of groups.values()) {
    const polys = ids.map((i) => ({ poly: boxPolytope(blocks[i]), part: blocks[i].part }));
    const vol = polys.reduce((a, p) => a + volume(p.poly), 0);
    const c = polys.reduce((a, p) => V.add(a, V.mul(centroid(p.poly), volume(p.poly))), [0, 0, 0]);
    const body = {
      id: `b${ids[0]}`, blocks: ids, pieces: polys.map((p) => ({ poly: p.poly, part: p.part, volume: volume(p.poly) })),
      faces: polys.flatMap((p) => p.poly.faces.map(faceOut)), centroid: P(V.mul(c, 1 / vol)), volume: r5(vol),
      parts: [...new Set(ids.map((i) => blocks[i].part).filter(Boolean))],
    };
    (ids.some((i) => anchored[i]) && names !== null ? statics : bodies).push(body);
    // with sever 'all' nothing holds: every block falls on its own (an anchored one is already down, and settles)
  }
  return { joints: G.joints, kept: kept.map((j) => j.id), bodies, statics, ground: G.ground };
}
