/**
 * A TREE READ AS FORM (gen-7): the grower's tree (vegetation/grow.js, a species of vegetation/species.js) as a renderer
 * lights it, no light baked in: its wood as tubes with smooth normals and the bark's coordinates in metres (the bark a
 * material, form/bark-material.js: its colour, its relief, drawn by parallax), its foliage as CLUMPS, the crown's mass,
 * and SITES where a spray is cloned near the eye (vegetation/sprays.js), a clump and the sprays of its cell holding the same
 * leaf area: the crown is clumps everywhere, the sprays coming in inside them close by, never from nothing.
 *
 * The grower's age is costly past youth (an oak's 20 years grow in seconds, 30 in a minute, 40 run out of nodes), so a
 * tree is grown young and RE-STOOD mature (vegetation/grow.js restand: the whole tree scaled, its girth's secondary
 * thickening multiplied, then settled under its own weight), its crown carrying leaves over its larger surface (the fill
 * by the scale squared) and its clumps' cells grown with it. Its leaves sit on its newest shoots only (a shell at the limbs'
 * tips, gaps between), so its crown is filled to a dome: the ENVELOPE the leafy shoots outline round the crown's axis
 * (slice by slice up it, sector by sector round it, smoothed), a clump wherever its surface has none near; the gathered
 * clumps, the real shoots, all kept. A conifer (vegetation/conifer.js, grown by rule) is grown at its age and not re-stood;
 * its slender limbs drawn finer (TREE_FORM.conifer); its foliage needles (vegetation/sprays.js needleHabit), a fir's or a
 * spruce's clumps pads lying along their branches (`pad`), a pine's tufts facing out. A fig grows from its own row.
 *
 *   treeForm(species, { seed?, years?, mature?, minDiameter?, cell?, clumpCell?, far? }) → { species, height, wood, woodFar?,
 *       clumps, sites, bark, needles?, pad?, trunk? }   (far: woodFar too, the thick axes alone, and the trunk's points
 *       and radii, x y z r flat)
 *     mature: the re-standing, TREE_FORM.mature's rule (`aim` m in place of the species' height), { scale, cambium }, or
 *            null for the tree as grown
 *     wood:  { pos, nrm, uv, idx } flat arrays (metres; uv in bark tiles: u round the trunk, v up it), the axes whose
 *            diameter reaches `minDiameter` as grown (the pipe model's cut: a thinner axis is carried by the leaves)
 *     clumps, sites: [{ p, d, o, s, e, r }] one or more a cell of the leafy shoots (`clumpCell` m, a clump's; `cell` m, a spray's;
 *            and the clumps the envelope adds on its surface, `f: 1`)
 *            length): p the shoots' centroid, d their mean direction, o out from the crown's centre, s the scale its leaf
 *            area is the cell's at (× fill: √(fill × leaves / the leaves one holds, vegetation/sprays.js leafHolds)), e the
 *            crown's light there (the grower's own shadow grid, 0..1: kept for occlusion, never as baked light), r a rank
 *            (dice, 0..1: a far crown keeps its clumps below a share, the kept ones grown to hold the cover)
 * Deterministic from the seed.
 */
import { grow, restand, ARCHITECTURES, vec } from '../vegetation/grow.js';
import { growConifer } from '../vegetation/conifer.js';
import { FIGS } from '../vegetation/ficus.js';
import { axisChains } from '../vegetation/tree-mesh.js';
import { SPECIES } from '../vegetation/species.js';
import { leafHolds, needleHabit } from '../vegetation/sprays.js';
import { BARK_TILE_M } from '../vegetation/tiles.js';
import * as dmath from '../../util/dmath.js';

const { add, sub, mul, dot, cross, len, unit } = vec;
const r4 = (v) => Math.round(v * 1e4) / 1e4;
/** The wood's cut (m: an axis thinner than this is carried by the leaves), a ring every `ring` radii along an axis (at
 *  least `ringMin` m apart), a spray's cell and a clump's (m), and how far a clump or a spray may grow or shrink to hold
 *  its cell's leaf area (`fill`: the crown's leaf area over the grower's, the read a stylized crown asks: full, not
 *  botanical). */
export const TREE_FORM = Object.freeze({ minDiameter: 0.06, ring: 6, ringMin: 0.15, cell: 0.6, clumpCell: 1.5, scale: Object.freeze([0.6, 2.6]), fill: 1.6,
  // (past its cap a cell takes more clumps or sprays, not a bigger one: a leaf stays near its size, the masses fill the
  // crown's volume; `spread` how far apart in the cell, × the cell)
  cap: Object.freeze({ clump: 1.6, spray: 2.2 }), spread: 0.35,
  // (the envelope: its sectors round the axis, the spacing of its clumps on the surface, × a clump's cell, and their size,
  // × the clump cap)
  envelope: Object.freeze({ sectors: 24, spacing: 0.6, size: 1 }),
  // (a conifer: its wood's cut (its limbs are slender: a pad must sit on one) and its needles' fill)
  conifer: Object.freeze({ minDiameter: 0.025, fill: 4, ringMin: 0.4, thinSides: 4, clumpCell: 0.75 }),
  // (a mature tree from a young one: scaled toward the top of its species' height range (`toHeight` of it), within
  // `range`, its girth's thickening × `cambium`: an oak's 20 years, 13 m and a trunk 0.36 m across, re-stood at 19 m and
  // 1.1 m)
  mature: Object.freeze({ toHeight: 0.95, range: Object.freeze([1, 2]), cambium: 2.2 }),
  // (a far tree's wood: the axes this many times the cut's thickness)
  farCut: 3 });
const sidesOf = (r) => (r > 0.15 ? 14 : r > 0.06 ? 10 : r > 0.025 ? 7 : 5);

/** One axis as a tube into W ({ pos, nrm, uv, idx }): `k` sides, rings parallel-transported along `pts` with radii `rs`,
 *  its normals the rings' own outward directions, its bark's coordinates in tiles (round it the count its base girth
 *  asks, up it its arc length); `tip`: the last ring drawn in to a point's third (an axis that ends). */
export function pushTube(W, pts, rs, k, tip) {
  const { pos, nrm, uv, idx } = W, m = pts.length, around = Math.max(1, Math.round((2 * Math.PI * rs[0]) / BARK_TILE_M));
  const T = pts.map((_, i) => unit(sub(pts[Math.min(m - 1, i + 1)], pts[Math.max(0, i - 1)])));
  let N = Math.abs(T[0][2]) < 0.9 ? unit(cross([0, 0, 1], T[0])) : unit(cross([1, 0, 0], T[0])), s = 0;
  const base = pos.length / 3;
  for (let i = 0; i < m; i++) {
    N = unit(sub(N, mul(T[i], dot(N, T[i])))); if (len(N) < 1e-6) N = unit(cross([0, 0, 1], T[i]));
    const B = cross(T[i], N); if (i > 0) s += len(sub(pts[i], pts[i - 1]));
    const r = i === m - 1 && tip ? rs[i] * 0.3 : rs[i];
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

// the trunk: the thickest axis, its points and radii flat (x y z r …): the wind bends what leaves it, never it
function trunkOf(chains) {
  const T = chains.reduce((a, c) => (c.dMax > a.dMax ? c : a), chains[0]);
  return T ? T.pts.flatMap((p, i) => [...p.map(r4), r4(T.rs[i])]) : [];
}

export function hashN(n) { let h = (n * 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; }

const YOUNG = new Map();
export function treeForm(species, { seed = 1, years = null, mature = TREE_FORM.mature, minDiameter = TREE_FORM.minDiameter, cell = TREE_FORM.cell, clumpCell = TREE_FORM.clumpCell, far = false } = {}) {
  const S = SPECIES[species]; if (!S || (S.kind !== 'tree' && S.kind !== 'conifer')) throw new Error(`tree-form: '${species}' is not a tree species`);
  const conifer = S.kind === 'conifer', needles = needleHabit(species);
  let plant, height, k = 1;
  if (conifer) {
    // (a conifer is grown by rule at its age, not re-stood: aimed, `mature.aim`, at the age it stands that tall)
    const aim = mature && mature.aim;
    if (aim && !years) for (let y = 8; y <= 80; y += 4) { plant = growConifer(S.conifer, { seed, stand: S.stand ?? 0, years: y }); if (plant.H >= aim) break; }
    else plant = growConifer(S.conifer, { seed, stand: S.stand ?? 0, ...(years ? { years } : {}) });
    height = plant.H; mature = null;
  }
  else {
    const arch = S.fig ? FIGS[S.fig] : S.leafLife || S.over ? { ...ARCHITECTURES[S.arch], ...(S.over || {}), ...(S.leafLife ? { leafLife: S.leafLife } : {}) } : S.arch;
    const yrs = years ?? (S.growth ? S.growth[S.growth.length - 1].years : S.years), yk = `${species}:${yrs}:${seed}`;
    // (the grower is the cost: a young tree grown once a process, re-stood as often as asked; restand reads it, never
    // writes it)
    const young = YOUNG.get(yk) ?? (YOUNG.set(yk, grow(arch, { years: yrs, seed })), YOUNG.get(yk));
    // (re-stood toward the species' mature height, or to `aim` metres where a level asks its trees' own)
    if (mature && mature.scale === undefined) { const h0 = young.nodes.reduce((a, n) => (n.died ? a : Math.max(a, n.pos[2])), 0); mature = { scale: Math.min(mature.range[1], Math.max(mature.range[0], (mature.aim ?? S.heights[1] * mature.toHeight) / Math.max(1e-6, h0))), cambium: mature.cambium }; }
    k = mature ? mature.scale : 1; plant = restand(young, mature ? { scale: k, cambium: mature.cambium } : {}); height = plant.height;
  }
  // (the cut, and a clump's bounds, follow the re-standing: the same limbs drawn, the same masses held; needles, a
  // conifer's or a needled row's, sit on slender limbs: their cut, their cell and their fill)
  const cambium = mature ? mature.cambium : 1;
  const cut = needles ? TREE_FORM.conifer.minDiameter * k : minDiameter * k * cambium, fill = needles ? TREE_FORM.conifer.fill : TREE_FORM.fill;
  if (needles) clumpCell = TREE_FORM.conifer.clumpCell;
  const thinR = 0.025 * Math.max(1, k * cambium * 0.5);
  // the wood: each axis thick enough a tube along its chain (parallel-transported rings), its normals the rings' own
  // outward directions (smooth round, so the sun turns across a limb), its bark's coordinates in tiles: round the axis
  // the tile's count its base girth asks (no seam), up it its arc length
  const chains = axisChains(plant);
  const woodOf = (cut) => {
  const pos = [], nrm = [], uv = [], idx = [];
  for (const ch of chains) {
    if (ch.dMax < cut || ch.pts.length < 2) continue;
    // (rings by arc length: one every few radii, a thick limb's far apart, a twig's close)
    const keep = [0]; let acc = 0;
    // (a conifer's slender limbs: rings far apart, four sides: each only carries its pads)
    const ringMin = needles ? TREE_FORM.conifer.ringMin : TREE_FORM.ringMin;
    for (let i = 1; i < ch.pts.length; i++) { acc += len(sub(ch.pts[i], ch.pts[i - 1])); if (i === ch.pts.length - 1 || acc >= Math.max(ringMin, TREE_FORM.ring * ch.rs[i])) { keep.push(i); acc = 0; } }
    const pts = keep.map((i) => ch.pts[i]), rs = keep.map((i) => ch.rs[i]), k = needles && rs[0] < thinR ? TREE_FORM.conifer.thinSides : sidesOf(rs[0]);
    pushTube({ pos, nrm, uv, idx }, pts, rs, k, !ch.continues);
  }
  return { pos, nrm, uv, idx };
  };
  // the clumps and the sites: the leafy shoots gathered into cells a clump wide and a spray long, each facing out of the
  // crown, each scaled to hold its cell's leaves
  const leafy = plant.nodes.filter((n) => !n.died && n.leaves), holds = leafHolds(species);
  const centre = mul(leafy.reduce((a, n) => add(a, n.pos), [0, 0, 0]), 1 / Math.max(1, leafy.length));
  const gather = (size, per, salt, cap) => {
    const cells = new Map();
    for (const n of leafy) {
      const key = n.pos.map((v) => Math.floor(v / size)).join(',');
      let c = cells.get(key); if (!c) cells.set(key, (c = { p: [0, 0, 0], d: [0, 0, 0], n: 0, leaves: 0, id: n.id }));
      c.p = add(c.p, n.pos); c.d = add(c.d, n.dir); c.n++; c.leaves += n.leaves;
    }
    return [...cells.values()].flatMap((c) => {
      const p0 = mul(c.p, 1 / c.n), d = len(c.d) > 1e-6 ? unit(c.d) : [0, 0, 1];
      // (the cell's leaf area, in what one holds at scale 1; past the cap, shared by more of them)
      const area = (c.leaves * fill * k * k) / per, m = Math.max(1, Math.ceil(area / (cap * cap))), sc = Math.max(TREE_FORM.scale[0], Math.sqrt(area / m));
      return Array.from({ length: m }, (_, j) => {
        const h = (q) => hashN(c.id * 131 + j * 17 + q + salt * 7), off = j === 0 ? [0, 0, 0] : [h(1) - 0.5, h(2) - 0.5, h(3) - 0.5].map((v) => v * 2 * TREE_FORM.spread * size);
        const p = add(p0, off), o0 = sub(p, centre);
        // (out of the crown: from its centre, a little up, as a crown's outside faces the sky)
        const o = unit([o0[0], o0[1], o0[2] * 0.8 + 0.4 * Math.max(0.5, len(o0))]);
        return { p: p.map(r4), d: d.map(r4), o: o.map(r4), s: r4(sc), e: r4(Math.min(1, plant.exposure(p))), r: r4(hashN(c.id * 3 + j * 101 + salt + seed * 7919)) };
      });
    }).sort((a, b) => a.r - b.r);
  };
  const clumps = gather(clumpCell * k, holds.clump, 1, TREE_FORM.cap.clump), sites = gather(cell, holds.spray, 2, TREE_FORM.cap.spray);
  // the envelope: how far out the leafy shoots reach round the crown's axis, slice by slice and sector by sector; empty
  // bins taken from their neighbours, then smoothed; a clump on its surface wherever none stands near
  const E = TREE_FORM.envelope, gap = clumpCell * k * E.spacing, nt = E.sectors, zs = leafy.map((n) => n.pos[2]);
  const z0 = Math.min(...zs), z1 = Math.max(...zs), nz = Math.max(2, Math.ceil((z1 - z0) / gap)), dz = (z1 - z0) / nz, TAU = 2 * Math.PI;
  let R = Array.from({ length: nz }, () => new Float64Array(nt));
  for (const n of leafy) {
    const dx = n.pos[0] - centre[0], dy = n.pos[1] - centre[1], iz = Math.min(nz - 1, Math.floor((n.pos[2] - z0) / Math.max(1e-9, dz)));
    const it = Math.floor(((Math.atan2(dy, dx) / TAU) + 1) * nt) % nt; R[iz][it] = Math.max(R[iz][it], Math.hypot(dx, dy));
  }
  const at = (G, i, j) => G[Math.min(nz - 1, Math.max(0, i))][((j % nt) + nt) % nt];
  for (let pass = 0; pass < 3; pass++) R = R.map((row, i) => row.map((v, j) => (v > 0 ? v : 0.85 * Math.max(at(R, i - 1, j), at(R, i + 1, j), at(R, i, j - 1), at(R, i, j + 1)))));
  R = R.map((row, i) => row.map((v, j) => 0.4 * v + 0.15 * (at(R, i - 1, j) + at(R, i + 1, j) + at(R, i, j - 1) + at(R, i, j + 1))));
  const near = (p) => clumps.some((c) => (c.p[0] - p[0]) ** 2 + (c.p[1] - p[1]) ** 2 + (c.p[2] - p[2]) ** 2 < (gap * 0.75) ** 2);
  for (let i = 0; i < nz; i++) for (let j = 0; j < nt; j++) {
    const r = R[i][j]; if (r < gap * 0.25) continue;
    // (the surface's normal: out round the axis, tipped by how the envelope narrows up it; the top slice faces the sky)
    const slope = (at(R, i + 1, j) - at(R, i - 1, j)) / (2 * dz), m = Math.max(1, Math.round(((r * TAU) / nt) * dz / (gap * gap)));
    for (let q = 0; q < m; q++) {
      const h = (w) => hashN((i * nt + j) * 977 + q * 31 + w + seed * 13), th = ((j + h(1)) / nt) * TAU, z = z0 + (i + h(2)) * dz;
      const p = [centre[0] + r * Math.cos(th), centre[1] + r * Math.sin(th), z]; if (near(p)) continue;
      const o = unit([Math.cos(th), Math.sin(th), -slope + (i === nz - 1 ? 1.5 : 0.3)]);
      clumps.push({ p: p.map(r4), d: o.map(r4), o: o.map(r4), s: r4(TREE_FORM.cap.clump * E.size * (0.85 + 0.3 * h(3))), e: r4(Math.min(1, plant.exposure(p))), r: r4(h(4)), f: 1 });
    }
  }
  // a WEEPING tree (a species' `weep`): curtains of leafy shoots hanging from the crown's outer clumps, each a chain of
  // clumps falling `weep` × its height at most (never to the ground), facing out, its sprays hanging along it
  if (S.weep) {
    // (from every clump on the crown's outside and upper half: the curtains fall from its shoulders as its rim)
    const fall = S.weep * height, step = clumpCell * k * 0.45, outer = clumps.filter((c) => c.f || (c.o[2] < 0.85 && c.p[2] > height * 0.35));
    for (const c of outer) {
      const n = Math.max(2, Math.round((fall * (0.6 + 0.4 * hashN(c.r * 1e4 + 3))) / step)), out = unit([c.o[0], c.o[1], 0]);
      for (let j = 1; j <= n && c.p[2] - j * step > height * 0.12; j++) {
        const p = add(c.p, [out[0] * step * 0.15 * j, out[1] * step * 0.15 * j, -j * step]), o = unit([out[0], out[1], -0.15]), d = [0, 0, -1];
        const h = (w) => hashN(Math.round(c.r * 1e4) * 31 + j * 7 + w);
        clumps.push({ p: p.map(r4), d, o: o.map(r4), s: r4(c.s * (1 - 0.35 * j / (n + 1))), e: c.e, r: r4(h(1)), f: 1 });
        sites.push({ p: add(p, [0, 0, step * 0.3]).map(r4), d: unit([out[0] * 0.25, out[1] * 0.25, -1]).map(r4), o: o.map(r4), s: r4(Math.min(1, c.s)), e: c.e, r: r4(h(2)) });
      }
    }
    sites.sort((a, b) => a.r - b.r);
  }
  clumps.sort((a, b) => a.r - b.r);
  // (far, `far`: the limbs a few times the cut's thickness alone: a tree across a glade shows its trunk and its main limbs)
  return { species, height: r4(height), wood: woodOf(cut), ...(far ? { woodFar: woodOf(Math.min(cut * TREE_FORM.farCut, 0.5 * Math.max(...chains.map((c) => c.dMax)))), trunk: trunkOf(chains) } : {}), clumps, sites, bark: S.bark || 'beech', ...(needles ? { needles, pad: needles !== 'pine' } : {}) };
}
