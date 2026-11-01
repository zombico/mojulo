/**
 * A BAMBOO READ AS FORM (gen-7): a culm the vegetation library grows (vegetation/bamboo.js growCulm: jointed, tapering,
 * nodding under its leaves, its branches alternating sides) drawn as the trees are (form/tree-form.js): its culm a tube
 * through its nodes with smooth normals, a darker band at each node (its colour its age's, culmColor), its branches thin
 * tubes; its foliage the trees' CLUMPS (vegetation/sprays.js, a narrow `lance` leaf at the species' length), one a cell of
 * its leaves, facing out of the culm and up, and SITES where its sprays come in near the eye inside them (the outline
 * kept: a spray from its cell's heart, its reach inside the clump's). No trunk: the culm itself bends in the wind, from
 * its foot.
 *
 *   bambooForm(species, { seed?, height?, age? }) → { species, height, radius, wood, woodFar, clumps, sites, leaf, culm }
 *     wood, woodFar: { pos, nrm, uv, idx, col } (the culm and its branches; far, the culm alone and coarser), col the
 *       vertex colours (sRGB bytes); clumps, sites: as treeForm's
 * Deterministic from the seed.
 */
import { growCulm, culmColor, BAMBOOS } from '../vegetation/bamboo.js';
import { vec } from '../vegetation/grow.js';
import { leafClump, leafSpray } from '../vegetation/sprays.js';
import { pushTube, hashN } from './tree-form.js';
import * as dmath from '../../util/dmath.js';

const { add, sub, mul, len, unit, cross } = vec;
const r4 = (v) => Math.round(v * 1e4) / 1e4;
/** A clump's cell (m), the culm's sides near and far, a node band's darkening and its length (× the node's diameter),
 *  and the sprays a clump's heart throws, inside its rim by `reach`. */
export const BAMBOO_FORM = Object.freeze({ cell: 0.7, sides: 8, sidesFar: 4, band: 0.62, bandLen: 0.5, sprays: 2, reach: 0.8 });

export function bambooForm(species, { seed = 1, height = null, age = 3 } = {}) {
  const sp = BAMBOOS[species]; if (!sp || sp.perNode === 0) throw new Error(`bamboo-form: '${species}' is not a branching bamboo (${Object.keys(BAMBOOS).filter((k) => BAMBOOS[k].perNode).join(', ')})`);
  // (its size class from the height asked: H ∝ size^hExp)
  const size = height ? dmath.pow(height / sp.H, 1 / sp.hExp) : 1, c = growCulm(species, { seed, size, age });
  const culmC = culmColor(sp, age), bandC = culmC.map((v) => Math.round(v * BAMBOO_FORM.band)), leaf = { leafSize: sp.leafLen, outline: 'lance', phyllo: 'distichous' };
  // the culm: a tube through its nodes, a ring either side of each node so its band is drawn darker, tapering to its tip
  const tube = (sides) => {
    const W = { pos: [], nrm: [], uv: [], idx: [], col: [] }, pts = [], rs = [], cols = [];
    for (let k = 0; k <= c.N; k++) {
      const r = (c.D[Math.min(c.N - 1, k)] / 2) * (k === c.N ? 0.4 : 1), T = c.Tn[k], b = Math.min(c.L[Math.max(0, k - 1)] ?? 0, c.L[Math.min(c.N - 1, k)] ?? 0) * 0.5;
      const bl = Math.min(b, c.D[Math.min(c.N - 1, k)] * BAMBOO_FORM.bandLen);
      if (k > 0 && k < c.N && bl > 1e-3) { pts.push(sub(c.P[k], mul(T, bl)), c.P[k], add(c.P[k], mul(T, bl))); rs.push(r, r * 1.06, r); cols.push(culmC, bandC, culmC); }
      else { pts.push(c.P[k]); rs.push(r); cols.push(culmC); }
    }
    pushTube(W, pts, rs, sides, true);
    for (const col of cols) for (let j = 0; j <= sides; j++) W.col.push(...col);
    return W;
  };
  const wood = tube(BAMBOO_FORM.sides), woodFar = tube(BAMBOO_FORM.sidesFar), branchC = sp.colors.branch;
  // its branches: thin tubes along their curves (the twigs are carried by the leaves)
  for (const br of c.branches) {
    // (every other point of its curve: a branch is a few centimetres thick, its bend reads at half the points)
    const P = br.pts.filter((_, i) => i % 2 === 0 || i === br.pts.length - 1), n0 = wood.pos.length / 3, rs = P.map((_, i) => br.r0 * (1 - 0.7 * (i / (P.length - 1))));
    pushTube(wood, P, rs, 3, true);
    for (let i = n0; i < wood.pos.length / 3; i++) wood.col.push(...branchC);
  }
  // the clumps: its leaves gathered into cells, each facing out of the culm (from its axis at that height) and up
  const cells = new Map(), axisAt = (z) => { let k = 0; while (k < c.N - 1 && c.P[k + 1][2] < z) k++; return c.P[k]; };
  for (const L of c.leaves) {
    const key = L.base.map((v) => Math.floor(v / BAMBOO_FORM.cell)).join(',');
    let q = cells.get(key); if (!q) cells.set(key, (q = { p: [0, 0, 0], d: [0, 0, 0], n: 0 }));
    q.p = add(q.p, L.base); q.d = add(q.d, L.dir); q.n++;
  }
  // (a clump stands for its cell's leaves: grown with their count, over the leaves three clumps' worth would hold)
  const perClump = leafClump(leaf, { seed: 1 }).tris.length / 6;
  const clumps = [], sites = [], H = c.height;
  let i = 0;
  for (const q of cells.values()) {
    const p = mul(q.p, 1 / q.n), ax = axisAt(p[2]), out0 = [p[0] - ax[0], p[1] - ax[1], 0], o = unit(add(len(out0) > 1e-3 ? unit(out0) : [1, 0, 0], [0, 0, 0.5]));
    const d = len(q.d) > 1e-6 ? unit(q.d) : o, s = Math.max(0.7, Math.min(1.8, Math.sqrt(q.n / (perClump * 3)))), e = Math.min(1, 0.4 + 0.6 * (p[2] / H));
    clumps.push({ p: p.map(r4), d: d.map(r4), o: o.map(r4), s: r4(s), e: r4(e), r: r4(hashN(seed * 7919 + i * 131)) });
    i++;
  }
  // the sprays near, the outline kept: from each clump's heart, radiating in its plane, inside its rim
  const reach = (T) => Math.max(...T.tris.flatMap((t) => t.p.map((pt) => Math.hypot(...pt))));
  const ss = BAMBOO_FORM.reach * reach(leafClump(leaf, { seed: 1 })) / reach(leafSpray(leaf, { seed: 1 }));
  clumps.forEach((cl, ci) => {
    const t1 = Math.abs(cl.o[2]) > 0.95 ? [1, 0, 0] : unit(cross(cl.o, [0, 0, 1])), t2 = cross(cl.o, t1), a0 = 2 * Math.PI * hashN(seed * 31 + ci);
    for (let j = 0; j < BAMBOO_FORM.sprays; j++) {
      const a = a0 + (2 * Math.PI * j) / BAMBOO_FORM.sprays, u = add(mul(t1, dmath.cos(a)), mul(t2, dmath.sin(a)));
      sites.push({ p: cl.p, d: unit(add(mul(u, 0.85), mul(cl.o, 0.3), [0, 0, -0.25])).map(r4), o: cl.o, s: r4(ss * cl.s), e: cl.e, r: r4(hashN(seed * 977 + ci * 7 + j)) });
    }
  });
  clumps.sort((a, b) => a.r - b.r); sites.sort((a, b) => a.r - b.r);
  return { species, height: r4(H), radius: r4(Math.max(0.5, ...clumps.map((q) => Math.hypot(q.p[0], q.p[1])))), wood, woodFar, clumps, sites, leaf, culm: { color: culmC, nodes: c.N } };
}
