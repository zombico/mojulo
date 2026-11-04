/**
 * rupa/tree-blocks.js — a level's trees as the blocks destructible physics breaks, burns and fells: each tree built whole
 * near the trail (era/isekai.js `physicalTrees`: its foot, height, trunk radius and crown) as a trunk of green wood in
 * courses and a crown resting on it. Under `destruction: 'physical'` only; the stamped and far trees stay scenery. rupa is
 * the internal name.
 *
 *   THE TRUNK  a square post of the trunk's own cross-section (side √π·r: the same area, so the same wood to break and
 *              burn), from its foot to its crown's underside, in courses no taller than COURSE: green wood (`pine`, or
 *              the cube's `wood` role) at a growing trunk's moisture
 *   THE CROWN  the crown's sphere as the box round it, resting on the trunk: leaves and twigs, CROWN_FILL of its volume
 *              (a broadleaf crown is mostly air: its leaf and twig mass is a few kg a cubic metre), CROWN_POROSITY open to
 *              the wind (so it drags as a crown does, not as a wall), as combustible as fine fuel is
 *   ITS WIND   the wind that snaps it, from its plant form at its height (rupa/wind-solver.js plantKind, breakSpeed: an
 *              evergreen spire a conifer, every other crown a broadleaf): the runtime fells it downwind about its foot
 *              when the gust at its crown passes it
 *   ITS FACES  each tree face (its wood, its crown, its blossom, its core and chips) goes with the tree whose trunk it stands
 *              nearest, and within that tree with the block that holds its middle (else the nearest)
 *
 *   ITS ROOTS  a fixed footing under its foot where the land stands above the level's floor, so it stands at minute zero
 *
 *   treeBlocks(trees, faces, { matterOf?, floor? }) → { breakables, faces, footings, trees: [{ id, blocks, foot, crown,
 *                                                     breakSpeed }] } | null
 */
import { blockMatter, resolveMatter, cutOfMatter } from './matter.js';
import { plantKind, breakSpeed, plantOfLeaf } from './wind-solver.js';

export const COURSE = 3;
export const CROWN_FILL = 0.004;
export const CROWN_POROSITY = 0.8;
export const TREE_GROUPS = Object.freeze(['isekai:wood', 'isekai:crown', 'isekai:blossom', 'isekai:core', 'isekai:chips']);
const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;
const mid = (f) => [0, 1, 2].map((k) => f.corners.reduce((s, c) => s + c[k], 0) / f.corners.length);
const boxDist = (b, p) => Math.hypot(...[0, 1, 2].map((k) => Math.max(b.min[k] - p[k], 0, p[k] - b.max[k])));

export function treeBlocks(trees, faces = [], { matterOf = null, hp = 6, floor = 0 } = {}) {
  if (!Array.isArray(trees) || !trees.length) return null;
  const wood = matterOf && matterOf.wood && matterOf.wood.why === 'the cube says so' ? matterOf.wood.matter : 'pine';
  const breakables = [], out = [], byTree = new Map(), footings = [];
  for (const t of trees) {
    const side = Math.sqrt(Math.PI) * t.trunk, half = side / 2, [x, y, z0] = t.foot;
    const crownLow = t.crownAt[2] - t.crownR, top = Math.max(z0 + 0.5, crownLow);
    const n = Math.max(1, Math.ceil((top - z0) / COURSE - 1e-9)), own = [];
    for (let k = 0; k < n; k++) {
      const a = r4(z0 + ((top - z0) * k) / n), b = r4(z0 + ((top - z0) * (k + 1)) / n);
      own.push({ id: `${t.id}:trunk#${k}`, min: [r4(x - half), r4(y - half), a], max: [r4(x + half), r4(y + half), b], matter: wood });
    }
    // its roots in the land: a fixed footing under its foot where the land stands above the level's floor
    if (z0 > floor + 0.02) footings.push({ min: [r4(x - half), r4(y - half), r4(z0 - 0.1)], max: [r4(x + half), r4(y + half), r4(z0)], of: `${t.id}:footing` });
    const R = t.crownR, c = t.crownAt;
    own.push({ id: `${t.id}:crown`, min: [r4(c[0] - R), r4(c[1] - R), r4(top)], max: [r4(c[0] + R), r4(c[1] + R), r4(c[2] + R)], matter: 'pine', fill: CROWN_FILL, porosity: CROWN_POROSITY });
    for (const b of own) {
      const m = resolveMatter(b.matter);
      breakables.push({ id: b.id, min: b.min, max: b.max, hp, ...blockMatter(b, { matter: b.matter, ...(b.fill ? { fill: b.fill } : {}) }), ...(b.porosity ? { porosity: b.porosity } : {}), cut: cutOfMatter(m) });
    }
    const kind = plantOfLeaf(t.form) ?? 'tree';
    byTree.set(t.id, { id: t.id, blocks: own.map((b) => b.id), foot: own[0].id, crown: [...c], breakSpeed: r4(breakSpeed(plantKind(kind, t.h))), list: breakables.slice(-own.length), at: [x, y] });
  }
  const list = [...byTree.values()];
  for (const f of faces) {
    if (!f || !Array.isArray(f.corners) || typeof f.node === 'string' || !TREE_GROUPS.includes(f.group)) { out.push(f); continue; }
    const p = mid(f);
    // the tree whose trunk it stands nearest (across the ground), then the block of that tree nearest its middle
    let T = null, td = Infinity;
    for (const tr of list) { const d = Math.hypot(p[0] - tr.at[0], p[1] - tr.at[1]); if (d < td - 1e-9) { td = d; T = tr; } }
    const reach = trees.find((t) => t.id === T.id).crownR * 2.5;
    if (td > reach) { out.push(f); continue; }
    let best = null, bd = Infinity;
    for (const b of T.list) { const d = boxDist(b, p); if (d < bd - 1e-9) { bd = d; best = b; } }
    out.push({ ...f, node: best.id, group: `break:${best.id}` });
  }
  return { breakables, faces: out, footings, trees: list.map(({ list: _l, at: _a, ...t }) => t) };
}
