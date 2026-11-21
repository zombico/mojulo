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
  // (a broadleaf's crown begins this share of its height up: below, its stem bare, its lower limbs shed as a grown tree
  // sheds them (a limb rising below `bole` of its height); and the whole tree drawn in toward its stem by `narrow`, its spread a grown tree's among others, not a
  // young one's stood alone and scaled up)
  lift: 0.3, bole: 0.25, narrow: 0.8,
  // (each tree its own within these, by its seed: its spread × narrow, its stem's share bare, its lean in degrees)
  vary: Object.freeze({ narrow: Object.freeze([0.72, 1.05]), bole: Object.freeze([0.2, 0.3]), lean: 6 }),
  // (a mature tree from a young one: scaled toward the top of its species' height range (`toHeight` of it), within
  // `range`, its girth's thickening × `cambium`: an oak's 20 years, 13 m and a trunk 0.36 m across, re-stood at 19 m and
  // 1.1 m)
  mature: Object.freeze({ toHeight: 0.75, range: Object.freeze([1, 2]), cambium: 2.2 }),
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
/**
 * A broadleaf's CANOPY FORM (`treeForm(…, { canopy: true })`, the crowns a stage's `crowns` reads): a tree grown up to a
 * canopy, its stem bare higher (its limbs shed below `bole` of its height, its leafy crown from `lift`), its spread WIDER
 * (× `narrow` about its foot, in place of TREE_FORM's drawn-in spread) and FLARING up the crown (× 1 + `flare` from the
 * bole to its top): an umbrella over a bare trunk, not a branchy column.
 */
export const CANOPY = Object.freeze({ lift: 0.5, bole: Object.freeze([0.42, 0.52]), narrow: 1.15, flare: 0.45 });

/**
 * THE EVOKED WOOD (a realistic crown's, `evoke: { balls, lead }`): the trunk and the LIMBS that carry its masses, grown
 * from the masses back to the trunk; no other wood. The view evoked, not the tree's anatomy: every limb leads to leaves.
 *  - Each mass is a limb's END, entering it from below (`reach` of its radius in), as thick as `girth` × `tip` of its
 *    radius (never under the cut).
 *  - The two ends nearest each other MERGE at a FORK, nearness weighing height `level` times over breadth (masses at
 *    one height share a limb; masses at another keep their own): the fork below the lower of them by `drop` × their
 *    separation, drawn in toward the trunk by `inward`, its girth theirs as the pipe model has it. Merged until one
 *    limb stands for every `limbs` masses (a mass for each where there are few), each a MAIN LIMB.
 *  - The trunk runs on as a LEADER to `lead` of the way up the crown (the masses' bottom to their top: a species'
 *    habit, a beech's high, an oak's dividing lower), at least as thick at each height as the limbs over it together.
 *  - A main limb leaves the leader CLIMBING at `climb` degrees over the level toward its fork, between `low` of the
 *    trunk's height and the leader's top; no two within `stagger` m. Its girth there no more than `hold` × the leader's.
 *  - Up the crown no stretch of leader is BARE past `gap` × the tree's height: where the masses leave one, a short FILL
 *    limb (`fill`: its length a share of the height, its cloud's mass a share of the masses') leaves it at the stretch's
 *    middle, turned the golden angle from the limb below.
 *  - Each fork SPLITS its limb: set `split` of the way from where the limb leaves to its children's middle, `rise` m
 *    under its lowest child and over where it leaves at least: every length climbs.
 *  - No length longer than `most` of the tree's height, a main limb `base` of that: a longer one ends sooner, the mass
 *    it carries drawn in along it.
 *  - A main limb held thinner than the leader thins all it carries alike; none under the cut's girth.
 *  - Each length of limb is bowed up by `bend` × its length (an arch, never a hook) through `segs` segments.
 */
export const EVOKE = Object.freeze({ reach: 0.5, girth: 0.13, tip: 0.5, drop: 0.22, inward: 0.3, limbs: 2, level: 2, climb: 38, low: 0.4,
  stagger: 0.45, hold: 0.8, bend: 0.08, segs: 4, split: 0.4, rise: 0.3, most: 0.25, base: 0.75, lead: 0.6, gap: 0.08,
  fill: Object.freeze({ length: 0.12, size: 0.7 }),
  twigs: Object.freeze({ stem: 0.7, n: 3, fill: 2, fan: 70, climb: 28, length: 0.9, size: 0.75, tip: 0.6 }) });
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
/** The limbs as a tree of lengths: `trunk` its points and radii, `pads` [{ p, s }], `cut` the thinnest drawn, `lead`
 *  the leader's share of the crown. → { edges: [{ from, to, r0, r1, end, main, s, fill? }], trunk: { pts, rs }, top }
 *  (`end`: the pad a length ends in (a fill limb's past the pads), or -1 at a fork; `s` the mass it leads to, a fork's
 *  its largest; `trunk` the leader as drawn, `top` its height). */
/** A habit's numbers over EVOKE's (REALISTIC_HABITS, form/flora-read.js): `trunk` { form: single | Y | V, fork, spread,
 *  girth, lead }, `limbs` { girth, climb }, `twigs` (EVOKE.twigs' keys). */
export function evokeOf(habit = {}) {
  const t = habit.trunk || {}, l = habit.limbs || {};
  return { ...EVOKE, girth: EVOKE.girth * (l.girth ?? 1), climb: l.climb ?? EVOKE.climb, lead: t.lead ?? EVOKE.lead, twigs: { ...EVOKE.twigs, ...(habit.twigs || {}) },
    trunk: { form: 'single', girth: 1, fork: 0.45, spread: 25, ...t } };
}
/** The limbs as a tree of lengths: `trunk` its points and radii, `pads` [{ p, s }], `cut` the thinnest drawn, `habit`
 *  its species' (evokeOf). A Y or V habit FORKS its trunk at `fork` of the tree's height (a Y high, a V low, never into
 *  its crown) into two STEMS, `spread` degrees off upright, one each side of its crown's long axis, its masses each
 *  the stem's on its side, and grows each stem's limbs as a single trunk's. → { edges: [{ from, to, r0, r1, end, main,
 *  s, fill?, stem?, leaf? }], trunk: { pts, rs }, stems: [{ pts, rs }], top } (`end`: the pad a length ends in (a fill
 *  limb's past the pads), or -1 for a structural length; `s` the mass it leads to; `trunk` the leader as drawn, or the
 *  bole to the fork; `top` the highest drawn). Each trunk and stem × the habit's trunk `girth`. */
export function limbTree(trunk, pads, cut, habit = {}) {
  const E = evokeOf(habit), T = E.trunk, girth = (L) => ({ ...L, trunk: { ...L.trunk, rs: L.trunk.rs.map((r) => r * T.girth) }, stems: (L.stems || []).map((q) => ({ ...q, rs: q.rs.map((r) => r * T.girth) })) });
  const tp = trunk.pts, base = tp[0], z0 = base[2], ct = Math.max(...pads.map((b) => b.p[2] + b.s * 0.5)), H = ct - z0;
  if ((T.form !== 'Y' && T.form !== 'V') || pads.length < 4) return girth({ ...limbTreeOne(trunk, pads, cut, E), stems: [] });
  // (its crown's long axis: the masses' spread round the trunk's foot, its principal direction)
  let sxx = 0, syy = 0, sxy = 0; for (const b of pads) { const x = b.p[0] - base[0], y = b.p[1] - base[1]; sxx += x * x; syy += y * y; sxy += x * y; }
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy), u = [Math.cos(th), Math.sin(th)];
  const sides = [pads.map((b, i) => i).filter((i) => (pads[i].p[0] - base[0]) * u[0] + (pads[i].p[1] - base[1]) * u[1] >= 0), pads.map((b, i) => i).filter((i) => (pads[i].p[0] - base[0]) * u[0] + (pads[i].p[1] - base[1]) * u[1] < 0)];
  if (sides.some((g) => g.length < 2)) return girth({ ...limbTreeOne(trunk, pads, cut, E), stems: [] });
  // (the fork: its share of the height, under the crown)
  const zF = Math.min(z0 + T.fork * H, Math.min(...pads.map((b) => b.p[2] - b.s)) - E.rise);
  const bole = { pts: [], rs: [] };
  for (let i = 0; i < tp.length; i++) { if (tp[i][2] >= zF) { const a = tp[i - 1] ?? tp[i], f = i ? (zF - a[2]) / Math.max(1e-9, tp[i][2] - a[2]) : 0; bole.pts.push([0, 1, 2].map((k) => a[k] + f * (tp[i][k] - a[k]))); bole.rs.push(i ? trunk.rs[i - 1] + f * (trunk.rs[i] - trunk.rs[i - 1]) : trunk.rs[i]); break; } bole.pts.push(tp[i]); bole.rs.push(trunk.rs[i]); }
  if (bole.pts[bole.pts.length - 1][2] < zF - 1e-6) { const q = bole.pts[bole.pts.length - 1]; bole.pts.push([q[0], q[1], zF]); bole.rs.push(bole.rs[bole.rs.length - 1]); }
  const F = bole.pts[bole.pts.length - 1], rF = bole.rs[bole.rs.length - 1], a = (T.spread * Math.PI) / 180;
  const edges = [], stems = []; let fills = 0, top = zF;
  sides.forEach((ids, side) => {
    const sg = side ? -1 : 1, dir = [sg * u[0] * Math.sin(a), sg * u[1] * Math.sin(a), Math.cos(a)], P = ids.map((i) => pads[i]);
    const cbg = Math.min(...P.map((b) => b.p[2] - b.s)), ctg = Math.max(...P.map((b) => b.p[2] + b.s * 0.5)), topg = Math.max(zF + 2 * E.rise, cbg + E.lead * (ctg - cbg));
    const Ls = (topg - zF) / Math.cos(a), n = 6, stem = { pts: Array.from({ length: n + 1 }, (_, k) => add(F, mul(dir, (Ls * k) / n))), rs: Array.from({ length: n + 1 }, (_, k) => (rF / Math.SQRT2) * (1 - 0.6 * (k / n))) };
    const L = limbTreeOne(stem, P, cut, E, { lowZ: Math.max(zF + E.rise, z0 + E.low * H), H, z0 });
    // (its ends the crown's masses again; its fill limbs counted past them)
    const fillAt = new Map();
    for (const g of L.edges) {
      let end = g.end;
      if (end >= 0 && end < P.length) end = ids[end];
      else if (end >= P.length) { if (!fillAt.has(end)) fillAt.set(end, pads.length + fills++); end = fillAt.get(end); }
      edges.push({ ...g, end });
    }
    stems.push(L.trunk); top = Math.max(top, L.top);
  });
  // (the bole as thick as its stems together)
  const over = Math.sqrt(stems.reduce((a2, q) => a2 + q.rs[0] * q.rs[0], 0));
  return girth({ edges, trunk: { pts: bole.pts, rs: bole.rs.map((r) => Math.max(r, over)) }, stems, top });
}
function limbTreeOne(trunk, pads, cut, E, { lowZ: low0 = null, H: H0 = null, z0: zb = null } = {}) {
  const tp0 = trunk.pts, tr0 = trunk.rs, z0 = zb ?? tp0[0][2], lead = E.lead;
  const cb = Math.min(...pads.map((b) => b.p[2] - b.s)), ct = Math.max(...pads.map((b) => b.p[2] + b.s * 0.5)), H = H0 ?? ct - z0;
  const leadZ = Math.max((low0 ?? z0 + E.low * H) + E.rise, cb + lead * (ct - cb), tp0[0][2] + E.rise);
  // (the leader: the grown trunk to its top, or carried straight up to it)
  const tp = [], tr = [];
  for (let i = 0; i < tp0.length; i++) { if (tp0[i][2] >= leadZ) { const a = tp0[i - 1] ?? tp0[i], f = i ? (leadZ - a[2]) / Math.max(1e-9, tp0[i][2] - a[2]) : 0; tp.push([0, 1, 2].map((k) => a[k] + f * (tp0[i][k] - a[k]))); tr.push(i ? tr0[i - 1] + f * (tr0[i] - tr0[i - 1]) : tr0[i]); break; } tp.push(tp0[i]); tr.push(tr0[i]); }
  if (tp[tp.length - 1][2] < leadZ - 1e-6) { const q = tp[tp.length - 1]; tp.push([q[0], q[1], leadZ]); tr.push(tr[tr.length - 1] * 0.8); }
  const at = (z) => { for (let i = 1; i < tp.length; i++) if (tp[i][2] >= z) { const a = tp[i - 1], b = tp[i], f = (z - a[2]) / Math.max(1e-9, b[2] - a[2]); return { p: [0, 1, 2].map((k) => a[k] + f * (b[k] - a[k])), r: tr[i - 1] + f * (tr[i] - tr[i - 1]) }; } return { p: tp[tp.length - 1], r: tr[tr.length - 1] }; };
  // (the ends: one a mass; the merging, nearest first by breadth and height, ties by their order)
  let active = pads.map((b, i) => ({ p: [b.p[0], b.p[1], b.p[2] - b.s * (1 - E.reach)], r: Math.max(cut * 0.6, b.s * E.girth * E.tip), kids: [], end: i, s: b.s }));
  const want = pads.length <= 3 ? pads.length : Math.max(2, Math.round(pads.length / E.limbs));
  const near = (a, b) => Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], E.level * (a.p[2] - b.p[2]));
  while (active.length > want) {
    let bi = 0, bj = 1, bd = Infinity;
    for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) { const d = near(active[i], active[j]); if (d < bd - 1e-9) { bd = d; bi = i; bj = j; } }
    const A = active[bi], B = active[bj], wA = A.r * A.r, wB = B.r * B.r, m = mul(add(mul(A.p, wA), mul(B.p, wB)), 1 / (wA + wB)), sep = len(sub(A.p, B.p));
    const F = { p: [m[0] * (1 - E.inward), m[1] * (1 - E.inward), Math.min(A.p[2], B.p[2]) - E.drop * sep], r: Math.sqrt(wA + wB), kids: [A, B], end: -1, s: Math.max(A.s, B.s) };
    active = [...active.filter((_, k) => k !== bi && k !== bj), F];
  }
  // (each main limb from the leader, climbing; staggered up it)
  const tan = Math.tan((E.climb * Math.PI) / 180), lowZ = low0 ?? z0 + E.low * H, topZ = tp[tp.length - 1][2];
  const hiOf = (n) => Math.min(topZ, n.p[2] - E.rise);
  const mains = active.map((n) => { const c = at(n.p[2]), h = Math.hypot(n.p[0] - c.p[0], n.p[1] - c.p[1]); return { n, z: Math.max(lowZ, Math.min(hiOf(n), n.p[2] - h * tan)) }; }).sort((a, b) => a.z - b.z || a.n.p[0] - b.n.p[0]);
  for (let i = 1; i < mains.length; i++) if (mains[i].z - mains[i - 1].z < E.stagger) mains[i].z = Math.min(hiOf(mains[i].n), mains[i - 1].z + E.stagger);
  mains.sort((a, b) => a.z - b.z || a.n.p[0] - b.n.p[0]);
  // (the gaps up the leader filled: a short limb at each bare stretch's middle, turned the golden angle from the one below)
  const gap = E.gap * H, fills = [], sMean = pads.reduce((a, b) => a + b.s, 0) / pads.length;
  const stops = [...mains.map((m) => m.z), topZ];
  let az = mains.length ? Math.atan2(mains[0].n.p[1] - at(mains[0].z).p[1], mains[0].n.p[0] - at(mains[0].z).p[0]) : 0;
  for (let i = 0; i + 1 < stops.length; i++) {
    const g = stops[i + 1] - stops[i], k = Math.ceil(g / gap) - 1;
    for (let j = 1; j <= k; j++) {
      const z = stops[i] + (g * j) / (k + 1), c = at(z), l = E.fill.length * H, cl = (E.climb * Math.PI) / 180; az += GOLDEN;
      const s0 = E.fill.size * sMean, p = [c.p[0] + Math.cos(az) * Math.cos(cl) * l, c.p[1] + Math.sin(az) * Math.cos(cl) * l, z + Math.sin(cl) * l];
      fills.push({ z, n: { p, r: Math.max(cut * 0.6, s0 * E.girth * E.tip), kids: [], end: pads.length + fills.length, s: s0 }, fill: true });
    }
  }
  // (the forks split; no length past its share of the tree)
  const most = E.most * H;
  const capped = (P, X, m = most) => { const d = sub(X, P), l = len(d); return l > m ? add(P, mul(d, m / l)) : X; };
  const place = (P, n, m = most) => {
    if (n.end >= 0) { n.p = capped(P, n.p, m); return; }
    const cm = mul(n.kids.reduce((a, k) => add(a, k.p), [0, 0, 0]), 1 / n.kids.length), lo = Math.min(...n.kids.map((k) => k.p[2]));
    const X = add(P, mul(sub(cm, P), E.split));
    X[2] = Math.max(P[2] + E.rise, Math.min(X[2], lo - E.rise));
    if (X[2] > lo - 1e-6) X[2] = (P[2] + lo) / 2;
    n.p = capped(P, X, m);
    for (const k of n.kids) place(n.p, k);
  };
  // (the leader at least as thick at each height as the limbs over it together: the pipe model up the trunk)
  const all = [...mains, ...fills], over = (z) => Math.sqrt(all.filter((m) => m.z >= z - 1e-9).reduce((a, m) => a + m.n.r * m.n.r, 0));
  const trs = tp.map((q, i) => Math.max(tr[i], over(q[2]), cut * 0.6));
  const rAt = (z) => { for (let i = 1; i < tp.length; i++) if (tp[i][2] >= z) { const f = (z - tp[i - 1][2]) / Math.max(1e-9, tp[i][2] - tp[i - 1][2]); return trs[i - 1] + f * (trs[i] - trs[i - 1]); } return trs[trs.length - 1]; };
  // (a limb held thinner than the leader thins all it carries alike; none under the cut's girth)
  const thin = cut * 0.55, gr = (r) => Math.max(thin, r);
  const edges = [], walk = (from, n, f) => { edges.push({ from, to: n.p, r0: gr(n.r * f), r1: gr((n.end >= 0 ? n.r : n.r * 0.92) * f), end: n.end, main: false, s: n.s }); for (const k of n.kids) walk(n.p, k, f); };
  for (const { n, z, fill } of all.sort((a, b) => a.z - b.z)) {
    const c = at(Math.min(z, topZ)), r0 = Math.min(n.r, rAt(z) * E.hold), f = r0 / n.r;
    if (!fill) place(c.p, n, most * E.base);
    edges.push({ from: c.p, to: n.p, r0: gr(r0), r1: gr((n.end >= 0 ? n.r : n.r * 0.92) * f), end: n.end, main: true, s: n.s, ...(fill ? { fill: true } : {}) });
    for (const k of n.kids) walk(n.p, k, f);
  }
  // (STRUCTURAL and LEAF-HOLDING: a length that ended in a mass stops at `stem` of its way, structural, and grows its
  // mass's TWIGS, the leaf-holding branches the clouds sit on)
  return { edges: sprouted(edges, thin, E.twigs), trunk: { pts: tp, rs: trs }, top: topZ };
}
/**
 * THE TWIGS (EVOKE.twigs): the branches a tree's leaves are held by. A length that held a mass is made STRUCTURAL: it
 * stops `stem` of its way along, and from there grows `n` leaf-holding twigs (a fill limb's `fill` of them), fanned
 * `fan` degrees round the way it ran and climbing `climb` degrees, each `length` × its mass's radius long, its girth
 * its share of the stem's (the pipe model), tapering to `tip`; each twig's cloud a mass `size` of the mass's. No cloud
 * on a structural branch: only on a twig.
 */
function sprouted(edges, thin = 0, T = EVOKE.twigs) {
  const out = [];
  edges.forEach((g, gi) => {
    if (g.end < 0) { out.push(g); return; }
    const S = add(g.from, mul(sub(g.to, g.from), T.stem)), d = sub(g.to, g.from), hd = Math.hypot(d[0], d[1]);
    const head = hd > 1e-6 ? Math.atan2(d[1], d[0]) : 2 * Math.PI * hashN(gi * 31 + 7), n = g.fill ? T.fill : T.n, rT = Math.max(thin, g.r1 / Math.sqrt(n));
    out.push({ ...g, to: S.map(r4), r1: g.r1, end: -1, stem: true });
    for (let j = 0; j < n; j++) {
      const az = head + (n > 1 ? (j / (n - 1) - 0.5) * T.fan * Math.PI / 180 : 0), cl = (T.climb * Math.PI) / 180, l = T.length * g.s;
      const to = [S[0] + Math.cos(az) * Math.cos(cl) * l, S[1] + Math.sin(az) * Math.cos(cl) * l, S[2] + Math.sin(cl) * l];
      out.push({ from: S.map(r4), to: to.map(r4), r0: rT, r1: Math.max(thin, rT * T.tip), end: g.end, main: false, s: g.s * T.size, leaf: true, ...(g.fill ? { fill: true } : {}) });
    }
  });
  return out;
}
// a length of limb at `t` of its way: bowed up through its middle by EVOKE.bend × its length (an arch)
export const limbAt = (g, t) => { const l = len(sub(g.to, g.from)), mid = add(mul(add(g.from, g.to), 0.5), [0, 0, EVOKE.bend * l]), u = 1 - t; return [0, 1, 2].map((a) => u * u * g.from[a] + 2 * u * t * mid[a] + t * t * g.to[a]); };
/**
 * THE CLOUDS a realistic crown's leaves are (`evoke`): one on each DISCRETE SECTION of its limbs, every length that
 * is LEAF-HOLDING (a twig, EVOKE.twigs); every structural branch bare. A
 * cloud is a run of PUFFS along its section from `from` of its way to `over` × its mass's radius past its end, spaced
 * `step` × a puff's size, `least` to `most` of them; each puff `size` × its mass's radius, the fullest at the run's
 * middle (`swell`), its own by `jitter`; each SITS on its branch, its middle `sit` × its radius over it, and strays
 * `side` × its radius to either side. → [{ p, o, d, s, e, r }], o the section's heading.
 */
export const CLOUD = Object.freeze({ from: 0.3, over: 0.35, step: 1.25, least: 2, most: 4, size: 0.5, swell: 0.45, jitter: 0.18, sit: 0.5, side: 0.35 });
export function branchClouds(edges, seed = 1, cloud = {}) {
  const out = [], CL = { ...CLOUD, ...cloud };
  edges.forEach((g, gi) => {
    if (!g.leaf) return;
    const h = (k) => hashN(seed * 7919 + gi * 131 + k), S = g.s * CL.size, d = sub(g.to, g.from), l = len(d);
    const hd = Math.hypot(d[0], d[1]), o = hd > 1e-6 ? [d[0] / hd, d[1] / hd, 0] : [1, 0, 0], side = [-o[1], o[0], 0];
    const run = (1 - CL.from) * l + CL.over * g.s, n = Math.max(CL.least, Math.min(CL.most, Math.round(run / (CL.step * S)) + 1));
    for (let k = 0; k < n; k++) {
      const u = n === 1 ? 0.5 : k / (n - 1), a = CL.from * l + u * run;
      // (along the section, and past its end along its last heading)
      const base = a <= l ? limbAt(g, a / l) : add(g.to, mul(o, a - l));
      const r = S * (1 - CL.swell + CL.swell * Math.sin(Math.PI * (0.15 + 0.7 * u))) * (1 + CL.jitter * (h(k * 3) - 0.5) * 2);
      const p = add(add(base, mul(side, CL.side * r * (h(k * 3 + 1) - 0.5) * 2)), [0, 0, CL.sit * r]);
      out.push({ p: p.map(r4), o: o.map(r4), d: [1, 0, 0], s: r4(r), e: 0.5, r: r4(h(k * 3 + 2)) });
    }
  });
  return out;
}
function supportedChains(chains, balls, cut, seed = 1, habit = {}) {
  const trunk0 = chains.filter((c) => c.order === 0).reduce((a, c) => (!a || c.dMax > a.dMax ? c : a), null);
  if (!trunk0 || !balls.length) return { chains, clouds: [], low: 0 };
  const L = limbTree(trunk0, balls, cut, habit), clouds = branchClouds(L.edges, seed, habit.cloud);
  // (the leader as the limbs have it: the grown trunk to its top, as thick as the limbs over it ask)
  const out = [{ ...trunk0, pts: L.trunk.pts.map((q) => q.map(r4)), rs: L.trunk.rs, nodes: [], dMax: 2 * Math.max(...L.trunk.rs), continues: true },
    // (a Y's or a V's stems, from its fork)
    ...L.stems.map((q, i) => ({ axis: -1000 - i, order: 1, nodes: [], pts: q.pts.map((v) => v.map(r4)), rs: q.rs, dMax: 2 * Math.max(...q.rs), continues: true }))];
  L.edges.forEach((g, i) => {
    // (a length bowed up through its middle: an arch)
    const pts = [], rs = [];
    for (let k = 0; k <= EVOKE.segs; k++) { const t = k / EVOKE.segs; pts.push(limbAt(g, t).map(r4)); rs.push(g.r0 + (g.r1 - g.r0) * t); }
    out.push({ axis: -1 - i, order: g.main ? 1 : 2, nodes: [], pts, rs, dMax: 2 * Math.max(g.r0, g.r1), continues: true });
  });
  // (its lowest limb: where the lowest leaves the trunk)
  return { chains: out, clouds, limbs: L.edges, top: L.top, skeleton: out.map((c) => ({ pts: c.pts, rs: c.rs, order: c.order })), low: Math.min(...L.edges.filter((g) => g.main).map((g) => g.from[2])) };
}
export function treeForm(species, { seed = 1, years = null, mature = TREE_FORM.mature, minDiameter = TREE_FORM.minDiameter, cell = TREE_FORM.cell, clumpCell = TREE_FORM.clumpCell, far = false, twigs = false, canopy = false, evoke = null } = {}) {
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
    if (!needles) plant = growUp(plant, height, seed, canopy ? CANOPY : null);
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
  const chains0 = axisChains(plant), SC = evoke && evoke.balls && evoke.balls.length && !needles ? supportedChains(chains0, evoke.balls, cut, seed, evoke.habit ?? (evoke.lead ? { trunk: { lead: evoke.lead } } : {})) : null, chains = SC ? SC.chains : chains0;
  // (`twigs`, a crossed crown's: a chain under the cut drawn too where it carries a shoot, and the limbs it grows on: no
  // leaf without its twig, no twig without its leaf)
  const carry = new Set(), drawn = (ch, c) => ch.dMax >= c || (c === cut && !evoke && carry.has(ch.axis));
  const woodOf = (cut) => {
  const pos = [], nrm = [], uv = [], idx = [];
  for (const ch of chains) {
    if (!drawn(ch, cut) || ch.pts.length < 2) continue;
    // (rings by arc length: one every few radii, a thick limb's far apart, a twig's close)
    const keep = [0]; let acc = 0;
    // (a conifer's slender limbs: rings far apart, four sides: each only carries its pads)
    // (a twig drawn for its spray, under the cut: rings SHOOTS.ring apart, three sides when thin, five at most)
    const twig = ch.dMax < cut;
    const ringMin = needles ? TREE_FORM.conifer.ringMin : twig ? SHOOTS.ring : TREE_FORM.ringMin;
    for (let i = 1; i < ch.pts.length; i++) { acc += len(sub(ch.pts[i], ch.pts[i - 1])); if (i === ch.pts.length - 1 || acc >= Math.max(ringMin, TREE_FORM.ring * ch.rs[i])) { keep.push(i); acc = 0; } }
    const pts = keep.map((i) => ch.pts[i]), rs = keep.map((i) => ch.rs[i]), k = needles && rs[0] < thinR ? TREE_FORM.conifer.thinSides : twig ? (rs[0] < SHOOTS.thin ? 3 : Math.min(5, sidesOf(rs[0]))) : sidesOf(rs[0]);
    pushTube({ pos, nrm, uv, idx }, pts, rs, k, !ch.continues);
  }
  return { pos, nrm, uv, idx };
  };
  // the clumps and the sites: the leafy shoots gathered into cells a clump wide and a spray long, each facing out of the
  // crown, each scaled to hold its cell's leaves
  // (a broadleaf's crown lifted off its trunk, TREE_FORM.lift: no leafy shoot low on it, the stem and its first limbs bare)
  const lift = needles ? 0 : (canopy ? CANOPY.lift : TREE_FORM.lift) * height;
  const leafy = plant.nodes.filter((n) => !n.died && n.leaves && n.pos[2] >= lift), holds = leafHolds(species);
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
        clumps.push({ p: p.map(r4), d, o: o.map(r4), s: r4(c.s * (1 - 0.35 * j / (n + 1))), e: c.e, r: r4(h(1)), f: 1, w: 1 });
        sites.push({ p: add(p, [0, 0, step * 0.3]).map(r4), d: unit([out[0] * 0.25, out[1] * 0.25, -1]).map(r4), o: o.map(r4), s: r4(Math.min(1, c.s)), e: c.e, r: r4(h(2)) });
      }
    }
    sites.sort((a, b) => a.r - b.r);
  }
  clumps.sort((a, b) => a.r - b.r);
  // the TIPS: the leafy shoots no live leafy shoot grows on from, gathered into cells (TIPS.cell × a clump's): where the
  // crown's leaves are, at its branches' ends, each its shoots' mean place and run and the sun it gets
  const kids = (id) => plant.children.get(id) || [], ends = leafy.filter((n) => !kids(n.id).some((c) => !plant.nodes[c].died && plant.nodes[c].leaves));
  const tcell = clumpCell * k * TIPS.cell, tmap = new Map();
  for (const n of ends) { const key = n.pos.map((v) => Math.floor(v / tcell)).join(','); let c = tmap.get(key); if (!c) tmap.set(key, (c = { p: [0, 0, 0], d: [0, 0, 0], n: 0, id: n.id })); c.p = add(c.p, n.pos); c.d = add(c.d, n.dir); c.n++; }
  const tips = [...tmap.values()].map((c) => { const p = mul(c.p, 1 / c.n), d = len(c.d) > 1e-6 ? unit(c.d) : [0, 0, 1]; return { p: p.map(r4), d: d.map(r4), e: r4(Math.min(1, plant.exposure(p))), r: r4(hashN(c.id * 7 + seed * 131)), n: c.n }; }).sort((a, b) => a.r - b.r);
  // the SHOOTS (`twigs`): of the leafy nodes on the crown's axes, one a cell (SHOOTS.cell × a tip's), the one standing
  // furthest out of the crown, where it stands on its twig and the way the twig runs; its twig drawn and the limbs it
  // grows on: the leaves only where the wood is
  const shoots = [];
  if (twigs) {
    // (a sparse crown's cell narrowed, SHOOTS.least: its few twigs leafed along them, not only at their ends)
    const byAxis = new Map(chains.map((ch) => [ch.axis, ch]));
    const pickAt = (size) => {
      const pick = new Map();
      for (const ch of chains) for (const n of ch.nodes || []) {
        if (n.died || !n.leaves || n.pos[2] < lift) continue;
        const key = n.pos.map((v) => Math.floor(v / size)).join(','), out = len(sub(n.pos, centre)), c = pick.get(key);
        if (!c || out > c.out) pick.set(key, { n, ch, out });
      }
      return pick;
    };
    const cell = tcell * SHOOTS.cell;
    let size = cell, pick = pickAt(size);
    while (pick.size < SHOOTS.least && size > cell * SHOOTS.narrow) pick = pickAt((size *= 0.8));
    for (const { n, ch } of pick.values()) {
      shoots.push({ p: n.pos.map(r4), d: unit(n.dir).map(r4), e: r4(Math.min(1, plant.exposure(n.pos))), r: r4(hashN(n.id * 7 + seed * 131)), n: 1 });
      for (let c = ch; c && !carry.has(c.axis); c = byAxis.get(plant.nodes[c.baseNode].axis)) carry.add(c.axis);
    }
  }
  shoots.sort((a, b) => a.r - b.r);
  // (far, `far`: the limbs a few times the cut's thickness alone: a tree across a glade shows its trunk and its main limbs)
  return { species, height: r4(height), wood: woodOf(cut), ...(far ? { woodFar: woodOf(Math.min(cut * TREE_FORM.farCut, 0.5 * Math.max(...chains.map((c) => c.dMax)))), trunk: trunkOf(chains) } : {}), clumps, sites, tips: twigs ? shoots : tips, ...(twigs ? { twigs: true } : {}), ...(SC ? { clouds: SC.clouds, limbs: SC.limbs, skeleton: SC.skeleton, trunkTop: r4(SC.top ?? 0), limbLow: r4(SC.low) } : {}), bark: S.bark || 'beech', ...(needles ? { needles, pad: needles !== 'pine', sleeve: sleevesOf(chains, needles, k) } : {}) };
}

/** The crown's RIM, where its twigs come in near the eye (vegetation/twigs.js): the clumps on its surface (the envelope's,
 *  or the ones the sun reaches past `exposed`), each throwing `per` twigs from its heart, radiating in its plane and out of
 *  the crown, reaching its rim (`reach` × its scale: a twig and the clump it rides, the same reach), so the outline a
 *  switch shows is the clump's, now drawn in leaves. */
export const RIM = Object.freeze({ exposed: 0.6, per: 3, reach: 0.95, out: 0.45 });
export function rimTwigs(form, { per = RIM.per } = {}) {
  const twigs = [];
  form.clumps.forEach((c, ci) => {
    if (!(c.f || c.e >= RIM.exposed)) return;
    const o = c.o, t1 = Math.abs(o[2]) > 0.95 ? [1, 0, 0] : unit(cross(o, [0, 0, 1])), t2 = cross(o, t1), a0 = 2 * Math.PI * hashN(Math.round(c.r * 1e5) + ci * 7);
    for (let j = 0; j < per; j++) {
      const a = a0 + (2 * Math.PI * j) / per, u = add(mul(t1, Math.cos(a)), mul(t2, Math.sin(a)));
      twigs.push({ p: c.p, d: unit(add(u, mul(o, RIM.out))).map(r4), o, s: r4(c.s * RIM.reach), e: c.e, r: r4(hashN(Math.round(c.r * 1e5) * 3 + j)) });
    }
  });
  return twigs.sort((a, b) => a.r - b.r);
}

// a broadleaf grown up: every limb that rises below the crown's base shed with all it carries (its stem bare to there),
// and the tree drawn in toward its stem (its spread × `narrow`, about its foot)
function growUp(plant, height, seed = 1, shape = null) {
  const V = TREE_FORM.vary, h = (k) => hashN(seed * 7919 + k), mixv = ([a, b], t) => a + (b - a) * t;
  const { nodes, axes } = plant, bole = mixv(shape ? shape.bole : V.bole, h(1)) * height, shed = new Set(), root = nodes.find((n) => n.parent < 0) || nodes[0];
  const kids = (id) => plant.children.get(id) || [];
  const firstOf = new Map(); for (const n of nodes) if (n.parent >= 0 && !firstOf.has(n.axis)) firstOf.set(n.axis, n);
  for (const [a, first] of firstOf) {
    if (!axes[a] || axes[a].order < 1 || nodes[first.parent].pos[2] >= bole) continue;
    const stack = [first.id]; while (stack.length) { const id = stack.pop(); if (shed.has(id)) continue; shed.add(id); stack.push(...kids(id)); }
  }
  // (drawn in, and leaning a few degrees its own way: the higher, the further over)
  const nw0 = (shape ? shape.narrow : TREE_FORM.narrow) * mixv(V.narrow, h(2)) / ((V.narrow[0] + V.narrow[1]) / 2), [rx, ry, rz] = root.pos, az = 2 * Math.PI * h(3), lean = Math.tan((V.lean * (h(4) * 2 - 1)) * Math.PI / 180);
  // (a canopy's spread flaring up its crown: wider the higher, from its bole to its top)
  const top = Math.max(...nodes.map((n) => n.pos[2] - rz)), nwAt = (up) => (shape ? nw0 * (1 + shape.flare * Math.max(0, Math.min(1, (up - bole) / Math.max(1e-6, top - bole)))) : nw0);
  return { ...plant, nodes: nodes.map((n) => { const up = n.pos[2] - rz, nw = nwAt(up); return { ...n, pos: [rx + (n.pos[0] - rx) * nw + Math.cos(az) * lean * up, ry + (n.pos[1] - ry) * nw + Math.sin(az) * lean * up, n.pos[2]], ...(shed.has(n.id) ? { died: true } : {}) }; }) };
}

/** The crown as CROSSES (vegetation/twigs.js leafCross), fewer and aimed: of its clumps the share `keep` (the envelope's
 *  always), each grown to hold the cover the rest left; each cross's slot upright, its lying card facing out of the crown
 *  level on its sides and tipping up toward its top (from a walker's eye a side clump's card faces it square, its standing
 *  card square to the one beside: every way round a card faces the eye), turned a little round by an even step, not by
 *  dice. → [{ p, o, d, s, e, r }]: `o` the lying card's face, `d` the slot. */
export const CROSSES = Object.freeze({ keep: 0.5, tip: 0.5, turn: 18, alone: 1.8 });
/** The tips' cells (× a clump's cell) and a tip's cross (× the crown's middle clump): one cross a cell of branch ends. */
export const TIPS = Object.freeze({ cell: 0.8, size: 0.85 });
/** A needled crown's SLEEVES (channels/form-flora.js draws its needles in them): round each run of leafy shoots along an
 *  axis a tube of `sides`, a ring every `every` shoots, its radius the needles' reach (`radius` by habit, m, × the tree's
 *  scale), narrowing to `tip` × it at the run's end. One smooth sleeve a run, no needle a polygon: the needles are the
 *  page's, found in the sleeve by its shader. */
export const SLEEVE = Object.freeze({ sides: 5, every: 2, radius: Object.freeze({ pine: 0.15, spruce: 0.11, silverfir: 0.11 }), tip: 0.45, least: 2 });
// the sleeves: each axis's runs of leafy shoots, a tube round each, its coordinates in metres (round it and along it),
// each vertex knowing where its run's axis is (aOut: from the axis to it) and which way the axis runs (aAx)
function sleevesOf(chains, habit, k) {
  const pos = [], nrm = [], uv = [], out = [], ax = [], idx = [], R0 = (SLEEVE.radius[habit] ?? SLEEVE.radius.spruce) * Math.max(0.7, Math.min(1.4, k)), K = SLEEVE.sides;
  const tube = (pts) => {
    const m = pts.length; if (m < 2) return;
    const T = pts.map((_, i) => unit(sub(pts[Math.min(m - 1, i + 1)], pts[Math.max(0, i - 1)])));
    let N = Math.abs(T[0][2]) < 0.9 ? unit(cross([0, 0, 1], T[0])) : unit(cross([1, 0, 0], T[0])), sAt = 0;
    const base = pos.length / 3;
    for (let i = 0; i < m; i++) {
      N = unit(sub(N, mul(T[i], dot(N, T[i])))); if (len(N) < 1e-6) N = unit(cross([0, 0, 1], T[i]));
      const B = cross(T[i], N); if (i > 0) sAt += len(sub(pts[i], pts[i - 1]));
      const r = R0 * (i === m - 1 ? SLEEVE.tip : i === 0 ? 0.8 : 1);
      for (let j = 0; j <= K; j++) {
        const a = (2 * Math.PI * j) / K, o = add(mul(N, dmath.cos(a)), mul(B, dmath.sin(a)));
        pos.push(...add(pts[i], mul(o, r)).map(r4)); nrm.push(...o.map(r4)); uv.push(r4((j / K) * 2 * Math.PI * R0), r4(sAt));
        out.push(...mul(o, r).map(r4)); ax.push(...T[i].map(r4));
      }
    }
    for (let i = 0; i < m - 1; i++) for (let j = 0; j < K; j++) { const a = base + i * (K + 1) + j, b = a + K + 1; idx.push(a, a + 1, b + 1, a, b + 1, b); }
  };
  for (const ch of chains) {
    // (a node and its point: the chain's first point is its base, each node the point after)
    let run = [];
    const flush = () => { if (run.length >= SLEEVE.least) tube(run.filter((_, i) => i % SLEEVE.every === 0 || i === run.length - 1)); run = []; };
    (ch.nodes || []).forEach((n, i) => { if (!n.died && n.leaves) { if (!run.length) run.push(ch.pts[i]); run.push(ch.pts[i + 1]); } else flush(); });
    flush();
  }
  return { pos, nrm, uv, out, ax, idx, radius: r4(R0) };
}
/** A crossed crown's sprays and their twigs (`twigs`): one spray a cell (`cell` × a tip's, TIPS) on a leafy node, its twig
 *  drawn under the cut, three-sided under `thin` m radius, its rings `ring` m apart on a thin one; a crown of fewer than `least` the
 *  cell narrowed, down to `narrow` of it. */
export const SHOOTS = Object.freeze({ thin: 0.015, ring: 0.45, least: 40, narrow: 0.4, cell: 1.13 });
export function crossClumps(form, { keep = CROSSES.keep } = {}) {
  // (at the branch tips, TIPS: one cross a cell of the shoots' ends, out of the crown from its middle, sized to the
  // crown's middle clump; a weeping crown's curtains as they hang. No tips read: the clumps, a share kept)
  const up = [0, 0, 1];
  let thinned, grow;
  if (form.tips && form.tips.length) {
    const ss = form.clumps.filter((c) => !c.f).map((c) => c.s).sort((a, b) => a - b), s = (ss[Math.floor(ss.length / 2)] ?? 1) * TIPS.size;
    const ctr = mul(form.tips.reduce((a, t) => add(a, t.p), [0, 0, 0]), 1 / form.tips.length);
    thinned = [...form.tips.map((t) => { const o0 = sub(t.p, ctr), o = unit([o0[0], o0[1], o0[2] * 0.8 + 0.4 * Math.max(0.5, len(o0))]); return { p: t.p, o: unit(add(o, mul(t.d, 0.5))), s, e: t.e, r: t.r }; }), ...form.clumps.filter((c) => c.w)];
    grow = 1;
  } else { thinned = form.clumps.filter((c) => c.f || c.r < keep); grow = 1 / Math.sqrt(keep); }
  // (no clump alone: one whose second nearest stands past `alone` × the crown's usual spacing is a dangler, dropped)
  const d2 = (a, b) => (a.p[0] - b.p[0]) ** 2 + (a.p[1] - b.p[1]) ** 2 + (a.p[2] - b.p[2]) ** 2;
  const second = thinned.map((c) => { let a = Infinity, b = Infinity; for (const o of thinned) { if (o === c) continue; const q = d2(c, o); if (q < a) { b = a; a = q; } else if (q < b) b = q; } return Math.sqrt(b); });
  const usual = [...second].sort((x, y) => x - y)[Math.floor(second.length / 2)] || 1, kept = thinned.filter((_, i) => second[i] <= CROSSES.alone * usual);
  return kept.map((c, k) => {
    const h = Math.hypot(c.o[0], c.o[1]), el = Math.atan2(c.o[2], Math.max(1e-6, h)) * CROSSES.tip;
    // (round the crown by an even step: the golden angle's turn, folded into ± turn degrees)
    const az = Math.atan2(c.o[1], c.o[0]) + ((((k * 137.508) % 360) / 360) * 2 - 1) * CROSSES.turn * Math.PI / 180;
    const o = h < 0.25 ? c.o : [Math.cos(az) * Math.cos(el), Math.sin(az) * Math.cos(el), Math.sin(el)];
    const d = unit(sub(up, mul(o, dot(up, o))));
    return { p: c.p, o: o.map(r4), d: (len(d) > 1e-6 ? d : [1, 0, 0]).map(r4), s: r4(c.s * grow), e: c.e, r: c.r, ...(c.f ? { f: 1 } : {}) };
  });
}

/**
 * THE MASS CROWN (a stage's `crowns: 'masses'`): a crown read as a few BIG BLOBS round its branches, the leaf mass the
 * eye reads there, and its leaf bundles moved off the branch tips to ADORN the blobs' surfaces. The bundles (crossClumps)
 * are gathered into `k` groups (a seeded k-means over their places, first centres the farthest apart: `per` bundles a
 * group, `least` to `most` groups), each group a blob at its middle as wide as its bundles spread (`fit`, plus `pad` of a
 * bundle's size); each bundle stands on its blob's surface where its own direction from the blob's middle meets it,
 * facing out (its `o` that direction), its slot level round it; `drop` of a bundle's size it sinks into the surface, so
 * its leaves break it. → { blobs: [{ p, o, d, s, e, r }], clumps } (a blob's `s` its radius, `o` up).
 */
export const MASSES = Object.freeze({ per: 7, least: 3, most: 9, fit: 0.8, pad: 0.2, drop: -0.15, rounds: 6 });
export function massCrown(clumps, { per = MASSES.per } = {}) {
  const n = clumps.length;
  if (!n) return { blobs: [], clumps };
  const k = Math.max(Math.min(MASSES.least, n), Math.min(MASSES.most, Math.round(n / per)));
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  // (the first centre the highest bundle, each next the one farthest from those chosen)
  const top = clumps.reduce((a, c, i) => (c.p[2] > clumps[a].p[2] ? i : a), 0), C = [clumps[top].p.slice()];
  while (C.length < k) { let best = 0, far = -1; clumps.forEach((c, i) => { const m = Math.min(...C.map((q) => d2(q, c.p))); if (m > far) { far = m; best = i; } }); C.push(clumps[best].p.slice()); }
  let of = new Array(n).fill(0);
  for (let r = 0; r < MASSES.rounds; r++) {
    of = clumps.map((c) => C.reduce((a, q, j) => (d2(q, c.p) < d2(C[a], c.p) ? j : a), 0));
    C.forEach((q, j) => { const m = clumps.filter((_, i) => of[i] === j); if (m.length) for (let t = 0; t < 3; t++) q[t] = m.reduce((a, c) => a + c.p[t], 0) / m.length; });
  }
  const sMid = [...clumps.map((c) => c.s)].sort((a, b) => a - b)[Math.floor(n / 2)];
  const blobs = C.map((q, j) => {
    const m = clumps.filter((_, i) => of[i] === j);
    const spread = m.length ? Math.sqrt(m.reduce((a, c) => a + d2(c.p, q), 0) / m.length) : 0;
    return { p: q.map(r4), o: [0, 0, 1], d: [1, 0, 0], s: r4(spread * MASSES.fit + sMid * MASSES.pad + 0.05), e: r4(m.length ? m.reduce((a, c) => a + c.e, 0) / m.length : 1), r: r4(j / k), n: m.length };
  }).filter((b) => b.n > 0).map(({ n: _n, ...b }) => b);
  const up = [0, 0, 1], near = (p) => blobs.reduce((a, b) => (d2(b.p, p) < d2(a.p, p) ? b : a), blobs[0]);
  const moved = clumps.map((c) => {
    const B = near(c.p), v = sub(c.p, B.p), o = len(v) > 1e-6 ? unit(v) : [0, 0, 1], t = unit(sub(up, mul(o, dot(up, o))));
    return { ...c, p: add(B.p, mul(o, Math.max(0.05, B.s - c.s * MASSES.drop))).map(r4), o: o.map(r4), d: (len(t) > 1e-6 ? t : [1, 0, 0]).map(r4) };
  });
  return { blobs, clumps: moved };
}

/**
 * THE BLOBS AT THE BRANCH ENDS (a stage's `crowns: 'blobs'`, the crown's form studied with its leaves set aside): a blob
 * at each branch end the crossed crown stands a bundle at (crossClumps), stood `out` of its radius further out along the
 * bundle's way out of the crown, so the branch runs into it: lollipops on the limbs. Each blob is as big as its room:
 * `touch` × the distance to the nearest other end (where the ends crowd, the blobs are small and meet; where they are
 * few, large), within `least`..`most` of the crown's middle bundle, and narrowing up the crown by `taper` (the top's a
 * share smaller than the bottom's). About a third of them are then gathered into larger masses, solved outward
 * (TIP_BLOBS.merge). → { blobs: [{ p, o, d, s, e, r }] } (a blob's `s` its radius, `o` its way out).
 */
export const TIP_BLOBS = Object.freeze({ touch: 0.62, least: 0.35, most: 1.15, taper: 0.35, out: 0.1,
  // (MERGED: about `share` of the blobs gathered into larger masses, the most crowded first, each with up to `group` - 1
  // of its nearest unmerged neighbours within `reach` × their two radii; the mass as big as encloses them (× `fit`, at
  // least `grow` × its largest, at most `cap` × it), SOLVED OUTWARD: its outer surface where its group's outermost
  // reached, the crown's silhouette kept and the mass filling in behind it, never past its outermost member's middle: it
  // stays on its branches)
  merge: Object.freeze({ share: 1 / 3, group: 3, reach: 1.2, fit: 0.92, grow: 1.3, cap: 2.2 }) });
export function tipBlobs(clumps) {
  const n = clumps.length;
  if (!n) return { blobs: [] };
  const sMid = [...clumps.map((c) => c.s)].sort((a, b) => a - b)[Math.floor(n / 2)];
  const zs = clumps.map((c) => c.p[2]), z0 = Math.min(...zs), z1 = Math.max(...zs);
  const blobs = clumps.map((c, i) => {
    let dn = Infinity;
    for (let j = 0; j < n; j++) if (j !== i) dn = Math.min(dn, len(sub(clumps[j].p, c.p)));
    if (!Number.isFinite(dn)) dn = sMid * 2;
    const up = z1 > z0 ? (c.p[2] - z0) / (z1 - z0) : 0.5;
    const r = Math.min(TIP_BLOBS.most * sMid, Math.max(TIP_BLOBS.least * sMid, TIP_BLOBS.touch * dn)) * (1 - TIP_BLOBS.taper * up);
    return { p: add(c.p, mul(c.o, r * TIP_BLOBS.out)).map(r4), o: c.o, d: c.d, s: r4(r), e: c.e, r: c.r };
  });
  return { blobs: mergeOutward(blobs) };
}
// about a third of the blobs gathered into larger masses, each solved outward (TIP_BLOBS.merge)
function mergeOutward(blobs) {
  const G = TIP_BLOBS.merge, n = blobs.length;
  if (n < 3) return blobs;
  const C = mul(blobs.reduce((a, b) => add(a, b.p), [0, 0, 0]), 1 / n), dist = (a, b) => len(sub(a.p, b.p));
  // (the most crowded first: the nearest other end the closest, by its two radii)
  const room = blobs.map((b, i) => Math.min(...blobs.map((o, j) => (j === i ? Infinity : dist(b, o) / (b.s + o.s)))));
  const order = blobs.map((_, i) => i).sort((a, b) => room[a] - room[b] || a - b);
  const used = new Set(), groups = [], goal = Math.round(n * G.share);
  let merged = 0;
  for (const i of order) {
    if (merged >= goal) break;
    if (used.has(i)) continue;
    const near = blobs.map((_, j) => j).filter((j) => j !== i && !used.has(j) && dist(blobs[i], blobs[j]) <= G.reach * (blobs[i].s + blobs[j].s))
      .sort((a, b) => dist(blobs[i], blobs[a]) - dist(blobs[i], blobs[b]) || a - b).slice(0, G.group - 1);
    if (!near.length) continue;
    const g = [i, ...near]; g.forEach((k) => used.add(k)); groups.push(g); merged += g.length;
  }
  const masses = groups.map((g) => {
    const M = g.map((k) => blobs[k]), mid = mul(M.reduce((a, b) => add(a, b.p), [0, 0, 0]), 1 / M.length), u0 = sub(mid, C), u = len(u0) > 1e-6 ? unit(u0) : [0, 0, 1];
    const big = Math.max(...M.map((b) => b.s)), R = Math.min(G.cap * big, Math.max(G.grow * big, G.fit * Math.max(...M.map((b) => len(sub(b.p, mid)) + b.s))));
    // (outward: the mass's outer surface where its group's outermost blob's was, along its way out of the crown)
    const reach = Math.max(...M.map((b) => dot(sub(b.p, C), u) + b.s)), along = dot(sub(mid, C), u), outMost = Math.max(...M.map((b) => dot(sub(b.p, C), u)));
    const p = add(add(C, mul(u, Math.min(outMost, Math.max(along, reach - R)))), sub(mid, mul(u, along)));
    const top = M.reduce((a, b) => (b.r < a.r ? b : a));
    return { p: p.map(r4), o: u.map(r4), d: top.d, s: r4(R), e: r4(M.reduce((a, b) => a + b.e, 0) / M.length), r: top.r };
  });
  return [...blobs.filter((_, k) => !used.has(k)), ...masses];
}

/**
 * Blobs ANCHORED to the wood that is drawn (a crown's wood is cut where an axis thins, TREE_FORM.minDiameter: the twigs
 * past it are not drawn): a blob whose middle stands farther than `hold` × its radius from the nearest drawn wood is drawn
 * in toward it until it touches, so no blob floats over a twig no one sees. `wood` the wood's positions, flat (x y z…).
 */
export const BLOB_HOLD = 0.9;
export function anchorBlobs(blobs, wood, { hold = BLOB_HOLD } = {}) {
  const n = Math.floor(wood.length / 3);
  if (!n) return blobs;
  return blobs.map((b) => {
    let best = -1, bd = Infinity;
    for (let i = 0; i < n; i++) { const d = (wood[i * 3] - b.p[0]) ** 2 + (wood[i * 3 + 1] - b.p[1]) ** 2 + (wood[i * 3 + 2] - b.p[2]) ** 2; if (d < bd) { bd = d; best = i; } }
    const d = Math.sqrt(bd), lim = hold * b.s;
    if (d <= lim) return b;
    const w = [wood[best * 3], wood[best * 3 + 1], wood[best * 3 + 2]], t = (d - lim) / d;
    return { ...b, p: add(b.p, mul(sub(w, b.p), t)).map(r4) };
  });
}

/**
 * THE MAJOR BALLS (a stage's `crowns: 'blobs'`, the crown's form reconsolidated): the crown read as its 3 or 4 great
 * masses. Its branch ends (crossClumps) gathered by a seeded k-means into `k` groups (`k[0]`, or `k[1]` from `many` ends
 * up), each a ball at its group's middle, as big as holds `hold` of its ends (the share nearest, plus `pad` of a bundle),
 * SOLVED OUTWARD: moved out along its way out of the crown until its surface reaches its group's outermost end (never
 * past `push` of its own radius), so the crown's silhouette is its ends' and its mass fills in behind; and a GAP between
 * them (`sep`): the crown read as separate masses, sky between; then the lobes that JOIN them to the tree (a core at the
 * fork, a bridge out to each, a join between neighbours), so each clump reads as carried by its limbs.
 * → { blobs: [{ p, o, d, s, e, r }] } (the balls first, then their joining lobes).
 */
export const BALLS = Object.freeze({ k: Object.freeze([3, 4]), many: 40, hold: 0.6, pad: 0.3, push: 0.35, rounds: 8,
  // (a GAP between the balls: two whose surfaces would meet both shrunk until their radii add to `sep` of the distance
  // between their middles, `passes` times round, none under `least` of its own size: the crown read as separate masses)
  sep: 0.92, passes: 3, least: 0.45,
  // (JOINED TO ITS TREE: a CORE lobe where the trunk forks into the crown (`core` × the balls' mean radius, `sink` of it
  // below their middles), a BRIDGE of lobes from it out to each ball (`bridge` × that ball's radius, each `step` of its
  // radius from the next so they overlap, at most `links` a ball, grown when more would be needed: a limb's leaf), and a JOIN lobe between each ball and its nearest neighbour where they stand within `near` × their two radii
  // (at their middle, `drop` of the smaller radius lower, `join` × it): the clumps meet in spots, each hanging off the
  // limbs that carry it)
  core: 0.55, sink: 0.45, bridge: 0.42, step: 1.5, links: 3, near: 1.45, drop: 0.2, join: 0.48 });
// (`k` and `sep` a caller's own: a realistic crown's cloud, more of them and overlapping, form/flora-read.js REALISTIC;
// `joined: false`, the balls alone, their joining lobes left to the branches that carry them)
export function majorBalls(clumps, { k: ks = BALLS.k, sep = BALLS.sep, joined = true } = {}) {
  const n = clumps.length;
  if (!n) return { blobs: [] };
  const k = Math.min(n, n >= BALLS.many ? ks[1] : ks[0]), d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const C0 = mul(clumps.reduce((a, c) => add(a, c.p), [0, 0, 0]), 1 / n);
  // (first centres: the highest end, then each the farthest from those chosen)
  const top = clumps.reduce((a, c, i) => (c.p[2] > clumps[a].p[2] ? i : a), 0), C = [clumps[top].p.slice()];
  while (C.length < k) { let best = 0, far = -1; clumps.forEach((c, i) => { const m = Math.min(...C.map((q) => d2(q, c.p))); if (m > far) { far = m; best = i; } }); C.push(clumps[best].p.slice()); }
  let of = new Array(n).fill(0);
  for (let r = 0; r < BALLS.rounds; r++) {
    of = clumps.map((c) => C.reduce((a, q, j) => (d2(q, c.p) < d2(C[a], c.p) ? j : a), 0));
    C.forEach((q, j) => { const m = clumps.filter((_, i) => of[i] === j); if (m.length) for (let t = 0; t < 3; t++) q[t] = m.reduce((a, c) => a + c.p[t], 0) / m.length; });
  }
  const sMid = [...clumps.map((c) => c.s)].sort((a, b) => a - b)[Math.floor(n / 2)];
  const blobs = C.map((q, j) => {
    const M = clumps.filter((_, i) => of[i] === j);
    if (!M.length) return null;
    const ds = M.map((c) => Math.sqrt(d2(c.p, q))).sort((a, b) => a - b), R = ds[Math.min(ds.length - 1, Math.floor(ds.length * BALLS.hold))] + sMid * BALLS.pad;
    const u0 = sub(q, C0), u = len(u0) > 1e-6 ? unit(u0) : [0, 0, 1];
    const reach = Math.max(...M.map((c) => dot(sub(c.p, q), u))), shift = Math.max(0, Math.min(BALLS.push * R, reach - R));
    return { p: add(q, mul(u, shift)).map(r4), o: u.map(r4), d: [1, 0, 0], s: r4(R), e: r4(M.reduce((a, c) => a + c.e, 0) / M.length), r: r4(j / k) };
  }).filter(Boolean);
  // (the gaps between them)
  const r0 = blobs.map((b) => b.s), r = r0.slice();
  for (let pass = 0; pass < BALLS.passes; pass++) for (let i = 0; i < blobs.length; i++) for (let j = 0; j < i; j++) {
    const d = len(sub(blobs[i].p, blobs[j].p)), room = sep * d;
    if (r[i] + r[j] > room) { const f = room / (r[i] + r[j]); r[i] = Math.max(BALLS.least * r0[i], r[i] * f); r[j] = Math.max(BALLS.least * r0[j], r[j] * f); }
  }
  const balls = blobs.map((b, i) => ({ ...b, s: r4(r[i]) }));
  return { blobs: joined ? [...balls, ...joinedTo(balls)] : balls };
}
// the lobes that join a crown's balls to its tree and in spots to each other (BALLS core, bridge, join)
function joinedTo(balls) {
  const m = balls.length;
  if (m < 2) return [];
  const mid = mul(balls.reduce((a, b) => add(a, b.p), [0, 0, 0]), 1 / m), mR = balls.reduce((a, b) => a + b.s, 0) / m;
  const coreP = [mid[0], mid[1], mid[2] - BALLS.sink * mR], lobe = (p, s, r) => ({ p: p.map(r4), o: [0, 0, 1], d: [1, 0, 0], s: r4(s), e: 0.5, r: r4(r) });
  const out = [lobe(coreP, BALLS.core * mR, 0.13)];
  const cs = out[0].s;
  balls.forEach((b, i) => {
    // (from the core's middle to the ball's, lobes overlapping all the way; any wholly inside either left out)
    const D = len(sub(b.p, coreP)), u = D > 1e-6 ? mul(sub(b.p, coreP), 1 / D) : [0, 0, 1];
    let rb = BALLS.bridge * b.s, n = Math.max(1, Math.ceil(D / (BALLS.step * rb)) - 1);
    const inside = (x) => x + rb <= cs || D - x + rb <= b.s;
    if (Array.from({ length: n }, (_, t) => (D * (t + 1)) / (n + 1)).filter((x) => !inside(x)).length > BALLS.links) {
      n = BALLS.links; rb = D / ((n + 1) * BALLS.step);
    }
    for (let t = 1; t <= n; t++) { const x = (D * t) / (n + 1); if (!inside(x)) out.push(lobe(add(coreP, mul(u, x)), rb, 0.31 + 0.17 * i + 0.05 * t)); }
  });
  const seen = new Set();
  balls.forEach((b, i) => {
    let j = -1, dj = Infinity;
    balls.forEach((o, k) => { if (k === i) return; const d = len(sub(o.p, b.p)); if (d < dj) { dj = d; j = k; } });
    const key = i < j ? `${i}:${j}` : `${j}:${i}`, o = balls[j];
    if (j < 0 || seen.has(key) || dj > BALLS.near * (b.s + o.s)) return;
    seen.add(key);
    const sm = Math.min(b.s, o.s), at = mul(add(b.p, o.p), 0.5);
    out.push(lobe([at[0], at[1], at[2] - BALLS.drop * sm], BALLS.join * sm, 0.57 + 0.11 * out.length));
  });
  return out;
}
