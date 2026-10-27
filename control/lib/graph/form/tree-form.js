/**
 * A TREE READ AS FORM (gen-7): the grower's tree (vegetation/grow.js, a species of vegetation/species.js) as a renderer
 * lights it, no light baked in: its wood as tubes with smooth normals and the bark's coordinates in metres (the bark a
 * material, form/bark-material.js: its colour, its relief, drawn by parallax), its foliage as CLUMPS, the crown's mass,
 * and SITES where a spray is cloned near the eye (vegetation/sprays.js), a clump and the sprays of its cell holding the same
 * leaf area: the crown is clumps everywhere, the sprays coming in inside them close by, never from nothing.
 *
 *   treeForm(species, { seed?, years?, minDiameter?, cell?, clumpCell? }) → { species, height, wood, clumps, sites, bark }
 *     wood:  { pos, nrm, uv, idx } flat arrays (metres; uv in bark tiles: u round the trunk, v up it), the axes whose
 *            diameter reaches `minDiameter` (the pipe model's cut: a thinner axis is carried by the leaves)
 *     clumps, sites: [{ p, d, o, s, e, r }] one a cell of the leafy shoots (`clumpCell` m, a clump's; `cell` m, a spray's
 *            length): p the shoots' centroid, d their mean direction, o out from the crown's centre, s the scale its leaf
 *            area is the cell's at (× fill: √(fill × leaves / the leaves one holds, vegetation/sprays.js leafHolds)), e the
 *            crown's light there (the grower's own shadow grid, 0..1: kept for occlusion, never as baked light), r a rank
 *            (dice, 0..1: a far crown keeps its clumps below a share, the kept ones grown to hold the cover)
 * Deterministic from the seed.
 */
import { grow, measure, ARCHITECTURES, vec } from '../vegetation/grow.js';
import { axisChains } from '../vegetation/tree-mesh.js';
import { SPECIES } from '../vegetation/species.js';
import { leafHolds } from '../vegetation/sprays.js';
import { BARK_TILE_M } from '../vegetation/tiles.js';
import * as dmath from '../../util/dmath.js';

const { add, sub, mul, dot, cross, len, unit } = vec;
const r4 = (v) => Math.round(v * 1e4) / 1e4;
/** The wood's cut (m: an axis thinner than this is carried by the leaves), a ring every `ring` radii along an axis (at
 *  least `ringMin` m apart), a spray's cell and a clump's (m), and how far a clump or a spray may grow or shrink to hold
 *  its cell's leaf area (`fill`: the crown's leaf area over the grower's, the read a stylized crown asks: full, not
 *  botanical). */
export const TREE_FORM = Object.freeze({ minDiameter: 0.06, ring: 6, ringMin: 0.15, cell: 0.6, clumpCell: 1.5, scale: Object.freeze([0.6, 2.6]), fill: 2.4 });
const sidesOf = (r) => (r > 0.15 ? 14 : r > 0.06 ? 10 : r > 0.025 ? 7 : 5);

function hashN(n) { let h = (n * 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; }

export function treeForm(species, { seed = 1, years = null, minDiameter = TREE_FORM.minDiameter, cell = TREE_FORM.cell, clumpCell = TREE_FORM.clumpCell } = {}) {
  const S = SPECIES[species]; if (!S || S.kind !== 'tree') throw new Error(`tree-form: '${species}' is not a tree species`);
  const arch = S.leafLife || S.over ? { ...ARCHITECTURES[S.arch], ...(S.over || {}), ...(S.leafLife ? { leafLife: S.leafLife } : {}) } : S.arch;
  const plant = grow(arch, { years: years ?? (S.growth ? S.growth[S.growth.length - 1].years : S.years), seed });
  const height = measure(plant).height;
  // the wood: each axis thick enough a tube along its chain (parallel-transported rings), its normals the rings' own
  // outward directions (smooth round, so the sun turns across a limb), its bark's coordinates in tiles: round the axis
  // the tile's count its base girth asks (no seam), up it its arc length
  const pos = [], nrm = [], uv = [], idx = [];
  for (const ch of axisChains(plant)) {
    if (ch.dMax < minDiameter || ch.pts.length < 2) continue;
    // (rings by arc length: one every few radii, a thick limb's far apart, a twig's close)
    const keep = [0]; let acc = 0;
    for (let i = 1; i < ch.pts.length; i++) { acc += len(sub(ch.pts[i], ch.pts[i - 1])); if (i === ch.pts.length - 1 || acc >= Math.max(TREE_FORM.ringMin, TREE_FORM.ring * ch.rs[i])) { keep.push(i); acc = 0; } }
    const pts = keep.map((i) => ch.pts[i]), rs = keep.map((i) => ch.rs[i]), m = pts.length, k = sidesOf(rs[0]), around = Math.max(1, Math.round((2 * Math.PI * rs[0]) / BARK_TILE_M));
    const T = pts.map((_, i) => unit(sub(pts[Math.min(m - 1, i + 1)], pts[Math.max(0, i - 1)])));
    let N = Math.abs(T[0][2]) < 0.9 ? unit(cross([0, 0, 1], T[0])) : unit(cross([1, 0, 0], T[0])), s = 0;
    const base = pos.length / 3;
    for (let i = 0; i < m; i++) {
      N = unit(sub(N, mul(T[i], dot(N, T[i])))); if (len(N) < 1e-6) N = unit(cross([0, 0, 1], T[i]));
      const B = cross(T[i], N); if (i > 0) s += len(sub(pts[i], pts[i - 1]));
      // (the last ring of an axis that ends draws in to its tip)
      const r = i === m - 1 && !ch.continues ? rs[i] * 0.3 : rs[i];
      for (let j = 0; j <= k; j++) {
        const a = (2 * Math.PI * j) / k, o = add(mul(N, dmath.cos(a)), mul(B, dmath.sin(a)));
        pos.push(...add(pts[i], mul(o, r)).map(r4)); nrm.push(...o.map(r4)); uv.push(r4((j / k) * around), r4(s / BARK_TILE_M));
      }
    }
    for (let i = 0; i < m - 1; i++) for (let j = 0; j < k; j++) {
      const a = base + i * (k + 1) + j, b = a + k + 1;
      idx.push(a, a + 1, b + 1, a, b + 1, b);
    }
  }
  // the clumps and the sites: the leafy shoots gathered into cells a clump wide and a spray long, each facing out of the
  // crown, each scaled to hold its cell's leaves
  const leafy = plant.nodes.filter((n) => !n.died && n.leaves), holds = leafHolds(species);
  const centre = mul(leafy.reduce((a, n) => add(a, n.pos), [0, 0, 0]), 1 / Math.max(1, leafy.length));
  const gather = (size, per, salt) => {
    const cells = new Map();
    for (const n of leafy) {
      const key = n.pos.map((v) => Math.floor(v / size)).join(',');
      let c = cells.get(key); if (!c) cells.set(key, (c = { p: [0, 0, 0], d: [0, 0, 0], n: 0, leaves: 0, id: n.id }));
      c.p = add(c.p, n.pos); c.d = add(c.d, n.dir); c.n++; c.leaves += n.leaves;
    }
    return [...cells.values()].map((c) => {
      const p = mul(c.p, 1 / c.n), d = len(c.d) > 1e-6 ? unit(c.d) : [0, 0, 1];
      // (out of the crown: from its centre, a little up, as a crown's outside faces the sky)
      const o0 = sub(p, centre), o = unit([o0[0], o0[1], o0[2] * 0.8 + 0.4 * Math.max(0.5, len(o0))]);
      const sc = Math.min(TREE_FORM.scale[1], Math.max(TREE_FORM.scale[0], Math.sqrt((c.leaves * TREE_FORM.fill) / per)));
      return { p: p.map(r4), d: d.map(r4), o: o.map(r4), s: r4(sc), e: r4(Math.min(1, plant.exposure(p))), r: r4(hashN(c.id * 3 + salt + seed * 7919)) };
    }).sort((a, b) => a.r - b.r);
  };
  const clumps = gather(clumpCell, holds.clump, 1), sites = gather(cell, holds.spray, 2);
  return { species, height: r4(height), wood: { pos, nrm, uv, idx }, clumps, sites, bark: S.bark || 'beech' };
}
