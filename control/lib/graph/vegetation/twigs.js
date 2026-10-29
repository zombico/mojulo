// vegetation/twigs — a tree's foliage near the eye as TWIGS: each a short shoot carrying its leaves in two to four planes
// that cross along it (a trident, at three), so from any side some plane faces the eye and the twig reads as a volume,
// never a card seen edge-on. Its leaves are its species' own OUTLINES (a beech's ovate blade and its waved margin, an
// oak's lobes and sinuses, a willow's lance), drawn as polygons with their outline's points, folded along the midrib and
// arched along it, so the crown's edge reads as the leaf it is. For the form render (gen-7): no light baked in, only the
// leaves' own colours (sRGB bytes) and their real facets.
//
//   LEAF_SHAPES                 the outlines: each a function of the run along the midrib (0 at the petiole, 1 at the tip)
//                               to the half-width (× the leaf's length), its points, its fold and its arch
//   leafShape(species)          the outline key a species' leaves take (vegetation/sprays.js leafOutline's, by name)
//   leafBlade(shape, { seed })  → one leaf as triangles, the petiole at the origin, along +x, its face +z: the library's
//                               sheet (for a page that shows the outlines)
//   TWIG                        the twig's planes, how far they splay, its leaves on each, their angle off it, its length
//   leafTwig(species, { seed, planes? }) → { tris: [{ p, c, kind }], leaves, length }: the twig from the origin along +x
//   twigHolds(species)          how many of the species' spray leaves a twig's leaf area holds (a twig and the spray it
//                               stands for, the same leaf area)
//   DART, leafDart(species, { seed }) → { tris, leaves, length }: a twig as a dart: whorls of three blades, each swept back
//                               from where it joins along the twig toward its base, one standing up, one level, one down
//                               and aside (seen down the twig, a trident), each in its own plane; whorl after whorl along
//                               the twig, each turned against the last, so the blades repeat round it in three dimensions
//   CROSS, leafCross(species, { seed, tips? }) → { tris }: a crown's mass as two cards slotted into a cross along a tangent
//                               (the 5th and 6th generations' cross tree, cut, not painted): each card a solid rounded mass
//                               whose rim is a ring of the species' leaf tips (its outline's upper run, protruding), one
//                               lying in the crown's surface (+z out of it), one standing out of it; each card a fan from
//                               its heart, folded a little along the slot; round the origin, the slot along +x
//   OUTLINED, outlinedClump(species, { seed }) → { tris, leaves }: a crown's clump at middle distance broken into more,
//                               smaller leaves than the plain one (vegetation/sprays.js leafClump), each its outline
//                               (fewer points: `OUTLINED.points` of the full), the same leaf area; round the origin, facing +z
//
// A LEAF instead of a species (a bush's: { leafSize, outline, phyllo }) is taken wherever a species is, as by the sprays.
// Needled species are the sprays' (their shoots are already toothed strips in their own planes): leafTwig hands one back.
// Deterministic from the seed (mulberry32).
import { mulberry32, ARCHITECTURES } from './grow.js';
import { SPECIES } from './species.js';
import { TONES } from './tree-mesh.js';
import { leafOutline, leafSpray, leafClump, needleHabit, CLUMP } from './sprays.js';
import { mix } from './util.js';
import * as dmath from '../../util/dmath.js';

const DEG = Math.PI / 180;
const unit3 = (d) => { const l = dmath.hypot(...d); return d.map((v) => v / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add = (a, b) => a.map((v, i) => v + b[i]), mul = (a, k) => a.map((v) => v * k);

// a blade's run: u^a (1 − u)^b, peaking at 1 where a / (a + b) puts its widest
const beta = (u, a, b) => { const m = a / (a + b); return Math.pow(u, a) * Math.pow(1 - u, b) / (Math.pow(m, a) * Math.pow(1 - m, b)); };
// an oak's lobes: rounded bumps centred along the midrib, growing toward the tip, deep sinuses between
const OAK_LOBES = [[0.2, 0.08, 0.55], [0.38, 0.09, 0.8], [0.57, 0.1, 1], [0.76, 0.09, 0.92]];
/** A maple leaf in FOUR TRIANGLES ([across, along] × the leaf's length, its base line at its stalk, 0 along): two big ones
 *  facing each other, each with its base on the base line and an upright inner side, their slopes crossing (the two
 *  points of its middle), and a pointed one on each slope (its side lobes). The operator's drawing, made even. */
export const MAPLE_TRIS = Object.freeze([
  [[-0.85, 0], [0.34, 0], [0.33, 0.96]], [[0.85, 0], [-0.34, 0], [-0.33, 0.96]],
  [[-0.76, 0.65], [-0.35, 0.42], [-0.63, 0.17]], [[0.76, 0.65], [0.35, 0.42], [0.63, 0.17]],
].map((t) => Object.freeze(t.map((p) => Object.freeze(p)))));
/** Every outline as a FEW TRIANGLES (the bundles' leaves, [across, along] × the leaf's length, its stalk at 0 along): a
 *  beech's pointed oval, an oak's blade with three pointed lobes a side and a rounded end, a willow's long narrow blade, a
 *  broad leaf's round one. Each a convex outline fanned from its stalk, or a blade with lobes set on its edges. */
const fanOf = (pts) => pts.slice(1, -1).map((p, i) => [pts[0], p, pts[i + 2]]);
const mirror = (half) => [...half, ...half.slice(1, -1).reverse().map(([w, u]) => [-w, u])];
// (every triangle of a leaf wound the same way, counter-clockwise from its face: its pieces overlap in one plane, and
// a piece showing its back where another shows its front would shade differently at the same depth, and flicker)
const facing = (T) => Object.freeze(T.map(([a, b, c]) => ((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]) < 0 ? [a, c, b] : [a, b, c])));
export const LEAF_TRIS = Object.fromEntries(Object.entries({
  palmate: MAPLE_TRIS,
  ovate: Object.freeze(fanOf(mirror([[0, 0], [0.2, 0.16], [0.27, 0.4], [0.18, 0.72], [0, 1]]))),
  // (the operator's oak: a tall kite in two mirrored halves, its shoulders high; across it two wide triangles pointing down,
  // the upper to a third of the way up, the lower to the stalk: their corners the lobes)
  lobed: Object.freeze([
    [[0, 0], [-0.21, 0.85], [0, 1]], [[0, 0], [0, 1], [0.21, 0.85]],
    [[-0.37, 0.71], [0, 0.31], [0.37, 0.71]], [[-0.35, 0.45], [0, 0], [0.35, 0.45]],
  ]),
  // (the operator's willow: three long narrow blades from one short base at the stalk, fanned ± 40°, the side ones shorter)
  lance: Object.freeze([[-40, 0.85], [0, 1], [40, 0.95]].map(([a, l]) => [[-0.09, 0], [0.09, 0], [l * Math.sin(a * Math.PI / 180), l * Math.cos(a * Math.PI / 180)]])),
  broad: Object.freeze(fanOf(mirror([[0, 0], [0.26, 0.14], [0.36, 0.44], [0.26, 0.8], [0, 1]]))),
}).map(([k, T]) => [k, facing(T)]));
Object.freeze(LEAF_TRIS);
// a maple's lobes: their turn off the midrib (radians) and their reach (× the leaf)
const MAPLE_LOBES = [[0, 1], [0.8, 0.88], [-0.8, 0.88], [1.55, 0.55], [-1.55, 0.55]];
/** The outlines. `w(u)` the half-width along the midrib (u 0 → 1, × the leaf's length), sampled at `points` runs; `fold`
 *  how far the blade rises off its midrib (× the half-width), `arch` how far the midrib bows down toward its tip (× the
 *  length). */
export const LEAF_SHAPES = Object.freeze({
  // a beech's or a cherry's: tapering into its stalk, widest below the middle, drawn out to a point, its margin waved
  // between its veins' ends
  ovate: Object.freeze({ points: 11, fold: 0.3, arch: 0.08, w: (u) => 0.3 * beta(u, 0.85, 1.25) * (1 + 0.05 * Math.sin(u * Math.PI * 16)) }),
  // an oak's: obovate, four rounded lobes a side growing toward the tip, deep sinuses between them, a rounded end
  lobed: Object.freeze({ points: 27, fold: 0.22, arch: 0.06, w: (u) => {
    const env = 0.36 * beta(u, 0.9, 0.55);
    const lobe = OAK_LOBES.reduce((m, [c, r, k]) => Math.max(m, k * Math.sqrt(Math.max(0, 1 - ((u - c) / r) ** 2))), 0);
    return env * (u > 0.86 ? 1 : 0.38 + 0.62 * lobe);
  } }),
  // a narrow blade, long and tapering both ways (the willow's, the bamboo's)
  lance: Object.freeze({ points: 7, fold: 0.28, arch: 0.12, w: (u) => 0.12 * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.85)), 0.8) }),
  // a maple's: PALMATE, five pointed lobes spread from where the stalk joins (a radial outline, `polar`: the reach at each
  // turn off the midrib, ± `spread` radians, sampled at `points`), the middle lobe longest, the lowest short, sharp sinuses
  palmate: Object.freeze({ points: 31, fold: 0.18, arch: 0.04, spread: 1.75, polar: (t) => {
    const lobe = MAPLE_LOBES.reduce((m, [c, l]) => Math.max(m, l * Math.pow(Math.max(0, 1 - Math.abs(t - c) / 0.55), 0.9)), 0);
    return Math.max(0.46, lobe) * (1 + 0.04 * Math.sin(t * 36));
  }, w: (u) => 0.45 * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.6)), 0.6) }),
  // a broad blade for the big-leaved (the umbrella tree's leaflets, the figs'): rounded, to a short drip tip
  broad: Object.freeze({ points: 9, fold: 0.26, arch: 0.07, w: (u) => 0.4 * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.9)), 0.7) * (u > 0.85 ? 1 - (u - 0.85) * 2.5 : 1) }),
});

/** The outline key a species' (or a leaf's) leaves take. */
export const leafShape = (species) => (LEAF_SHAPES[leafOutline(species)] ? leafOutline(species) : 'ovate');

/** A blade's midrib: the points along it its outline is fanned from (each edge segment to the nearest, so a lobe's sinus
 *  stays a sinus). */
export const RIB_POINTS = 4;
// one blade on its petiole at `at`, running along `d`, its face `n` (square to d): its outline's points either side of
// the midrib, each edge segment fanned to its nearest midrib point, folded up along the midrib and arched down along it
function pushBlade(tris, at, d, n, ln, S, c, N = S.points, R = RIB_POINTS) {
  const s = unit3(cross(n, d)), base = add(at, mul(d, ln * 0.1)), L = ln * 0.9;
  // (a radial outline: a fan from where the stalk joins, each point its reach at its turn, the lobes folded up a little)
  if (S.polar) {
    const M = Math.max(9, N), pts = Array.from({ length: M + 1 }, (_, j) => { const t = -S.spread + (2 * S.spread * j) / M, r = S.polar(t) * L * 0.62;
      return add(add(base, add(mul(d, Math.cos(t) * r), mul(s, Math.sin(t) * r))), mul(n, S.fold * Math.abs(Math.sin(t)) * r - S.arch * r * Math.cos(t))); });
    for (let j = 0; j < M; j++) tris.push({ p: [base, pts[j], pts[j + 1]], c, kind: 'leaf' });
    return;
  }
  const rib = (u) => add(add(base, mul(d, u * L)), mul(n, -S.arch * L * u * u));
  const edge = (u, side) => { const w = S.w(u) * L; return add(add(rib(u), mul(s, side * w)), mul(n, S.fold * w)); };
  for (const side of [1, -1]) {
    const E = [rib(0), ...Array.from({ length: N }, (_, j) => edge((j + 1) / (N + 1), side)), rib(1)], U = E.map((_, j) => j / (N + 1));
    const tri = (a, b, q) => tris.push({ p: side > 0 ? [a, b, q] : [a, q, b], c, kind: 'leaf' });
    let rk = null;
    for (let j = 1; j < E.length; j++) {
      const k = Math.min(R, Math.max(0, Math.round(((U[j - 1] + U[j]) / 2) * R)));
      if (rk !== null && k !== rk) tri(rib(rk / R), E[j - 1], rib(k / R));
      if (!(j === 1 && k === 0) && !(j === E.length - 1 && k === R)) tri(rib(k / R), E[j - 1], E[j]);
      rk = k;
    }
  }
}

/** One leaf of an outline, for a sheet of them: the petiole at the origin, along +x, its face +z, a unit long. */
export function leafBlade(shape, { length = 1 } = {}) {
  const tris = []; pushBlade(tris, [0, 0, 0], [1, 0, 0], [0, 0, 1], length, LEAF_SHAPES[shape], TONES.leaf);
  return { tris };
}

/** The twig: its planes (crossing along it, the first nearest level: a twig holds its leaves to the light), how far each
 *  turns off an even split (degrees), the leaves a plane carries (alternate, either side), their angle off the twig
 *  (degrees), the twig's length (× the leaves'), the tip's own leaf. */
export const TWIG = Object.freeze({ planes: 3, splay: 14, perPlane: 2, angle: 48, length: 2.2, tip: true });

const speciesLeaf = (species) => {
  if (species && typeof species === 'object') return species.leafSize;
  const S = SPECIES[species]; if (!S || S.kind !== 'tree') throw new Error(`twigs: '${species}' is not a tree species`);
  const A = { ...ARCHITECTURES[S.arch], ...(S.over || {}) };
  return A.leafSize * (S.leafScale || 1);
};

/**
 * One twig of a species: a shoot along +x, its leaves in TWIG.planes planes crossing along it (rolled round it evenly,
 * each turned a little off), TWIG.perPlane a plane either side alternately, at TWIG.angle off the shoot, the leaf's blade
 * in its plane; a leaf at its tip.
 */
export function leafTwig(species, { seed = 1, planes = TWIG.planes } = {}) {
  if (needleHabit(species)) return leafSpray(species, { seed });
  const rng = mulberry32((seed * 2654435761 + 131) >>> 0), L = speciesLeaf(species), S = LEAF_SHAPES[leafShape(species)];
  const length = L * TWIG.length, tris = [], tw = Math.max(0.003, L * 0.035), X = [1, 0, 0];
  tris.push({ p: [[0, -tw, 0], [length, -tw * 0.4, 0], [length, tw * 0.4, 0]], c: TONES.shoot, kind: 'wood' }, { p: [[0, -tw, 0], [length, tw * 0.4, 0], [0, tw, 0]], c: TONES.shoot, kind: 'wood' });
  let leaves = 0;
  const tone = () => mix(TONES.leaf, TONES.leafLit, 0.25 + 0.55 * rng());
  for (let k = 0; k < planes; k++) {
    // (the plane's face: rolled round the shoot, the first level, the rest evenly round the half turn)
    const roll = (k * 180 / planes + (rng() - 0.5) * 2 * TWIG.splay) * DEG, n = [0, -Math.sin(roll), Math.cos(roll)], side = cross(n, X);
    for (let j = 0; j < TWIG.perPlane; j++) {
      const sg = (j + k) % 2 ? 1 : -1, t = 0.22 + 0.62 * ((j + k / planes) / TWIG.perPlane), a = (TWIG.angle + (rng() - 0.5) * 18) * DEG;
      const d = unit3(add(mul(X, Math.cos(a)), mul(side, sg * Math.sin(a))));
      pushBlade(tris, [length * t, 0, 0], d, n, L * (0.85 + 0.3 * rng()), S, tone()); leaves++;
    }
  }
  if (TWIG.tip) { pushBlade(tris, [length, 0, 0], X, [0, 0, 1], L * 0.9, S, tone()); leaves++; }
  return { tris, leaves, length };
}

const leafArea = (tris) => tris.filter((t) => t.kind === 'leaf').reduce((a, { p: [A, B, C] }) => a + 0.5 * dmath.hypot(...cross(B.map((v, i) => v - A[i]), C.map((v, i) => v - A[i]))), 0);
/** How many of the species' spray leaves a twig's leaf area holds. */
export function twigHolds(species) {
  const sp = leafSpray(species, { seed: 1 }), per = leafArea(sp.tris) / Math.max(1, sp.leaves);
  return Math.round((leafArea(leafTwig(species, { seed: 1 }).tris) / per) * 100) / 100;
}

/** A clump at middle distance: its leaves (more and smaller than the plain clump's, the same leaf area: count × size² the
 *  plain's), each outline at `points` of its full count (at least 3 a side) on `rib` midrib points, the plain clump's
 *  rosette (vegetation/sprays.js CLUMP: its tilt, its lift). */
export const OUTLINED = Object.freeze({ leaves: 10, points: 0.4, rib: 2 });
export function outlinedClump(species, { seed = 1 } = {}) {
  if (needleHabit(species)) return leafClump(species, { seed });
  const rng = mulberry32((seed * 2654435761 + 97) >>> 0), S = LEAF_SHAPES[leafShape(species)], size = CLUMP.size * Math.sqrt(CLUMP.leaves / OUTLINED.leaves);
  const L = speciesLeaf(species) * size, N = Math.max(3, Math.round(S.points * OUTLINED.points)), tris = [];
  for (let k = 0; k < OUTLINED.leaves; k++) {
    // (two rings round the heart: the inner leaves stand up, the outer lie out toward the rim)
    const outer = k % 2 === 1, az = (k * 360 / OUTLINED.leaves + (rng() - 0.5) * 30) * DEG;
    const tilt = (outer ? CLUMP.tilt[1] - 6 + 14 * rng() : CLUMP.tilt[0] - 10 + 20 * rng()) * DEG;
    const d = [Math.sin(tilt) * Math.cos(az), Math.sin(tilt) * Math.sin(az), Math.cos(tilt)];
    // (the blade's face: square to its run, turned toward the clump's own facing)
    const sideways = unit3(cross([0, 0, 1], d.map((v, i) => (i === 2 ? 0 : v)))), n = unit3(cross(d, sideways));
    pushBlade(tris, [0, 0, -L * CLUMP.lift], d, n[2] < 0 ? mul(n, -1) : n, L * (0.85 + 0.3 * rng()) * (outer ? 1.05 : 0.9), S, mix(TONES.leaf, TONES.leafLit, 0.3 + 0.5 * rng()), N, OUTLINED.rib);
  }
  return { tris, leaves: OUTLINED.leaves };
}

/** The dart: where its whorls join (× the twig's length from its base), their blades' rolls round the twig (degrees: up,
 *  level, down and aside), how far each turns off (degrees), how far back a blade sweeps off the twig (degrees), how long
 *  each whorl's blades are (× the leaf), how slim (× the outline's width), how far each whorl turns against the last, the
 *  twig's length (× the leaf) and its tip's own blade, forward along it (× the leaf): the dart's point; its outlines at
 *  `points` of their full count (a dart's blade is seen near, but ten of them to a twig). */
export const DART = Object.freeze({ at: Object.freeze([0.42, 0.64, 0.84]), rolls: Object.freeze([90, 0, 225]), splay: 12, sweep: 20, length: Object.freeze([1.1, 1.3, 1.5]), slim: 0.5, turn: 60, twig: 2.4, tip: 1.3, points: 0.55 });
export function leafDart(species, { seed = 1 } = {}) {
  if (needleHabit(species)) return leafSpray(species, { seed });
  const rng = mulberry32((seed * 2654435761 + 151) >>> 0), L = speciesLeaf(species), S0 = LEAF_SHAPES[leafShape(species)];
  const S = { ...S0, w: (u) => S0.w(u) * DART.slim }, NP = Math.max(3, Math.round(S0.points * DART.points)), length = L * DART.twig, tris = [], tw = Math.max(0.003, L * 0.035), X = [1, 0, 0];
  tris.push({ p: [[0, -tw, 0], [length, -tw * 0.3, 0], [length, tw * 0.3, 0]], c: TONES.shoot, kind: 'wood' }, { p: [[0, -tw, 0], [length, tw * 0.3, 0], [0, tw, 0]], c: TONES.shoot, kind: 'wood' });
  let leaves = 0;
  DART.at.forEach((t, w) => {
    const turn = w * DART.turn;
    for (const r0 of DART.rolls) {
      // (the blade's way: back along the twig, out by its roll; its face square to the plane the twig and that way span)
      const roll = (r0 + turn + (rng() - 0.5) * 2 * DART.splay) * DEG, radial = [0, Math.cos(roll), Math.sin(roll)], sw = (DART.sweep + (rng() - 0.5) * 10) * DEG;
      const d = unit3(add(mul(X, -Math.cos(sw)), mul(radial, Math.sin(sw)))), n = unit3(cross(X, radial));
      pushBlade(tris, [length * t, 0, 0], d, n[2] < -0.2 ? mul(n, -1) : n, L * DART.length[w] * (0.9 + 0.2 * rng()), S, mix(TONES.leaf, TONES.leafLit, 0.25 + 0.55 * rng()), NP); leaves++;
    }
  });
  pushBlade(tris, [length, 0, 0], X, [0, 0, 1], L * DART.tip, S, mix(TONES.leaf, TONES.leafLit, 0.6), NP); leaves++;
  return { tris, leaves, length };
}

/** The cross: its mass (× the clump's leaf reach: CLUMP.size leaves), its width over its length, the leaf tips round each
 *  card's rim, how far each stands out (× the gap between tips), each tip's points a side by outline (a lobed one shows
 *  its lobes), the outline's run each tip takes (its upper part: a leaf's tip, not its stalk), how far each card's halves
 *  fold off the slot (degrees), how lumpy the mass's rim (× its reach), and how far a tip turns off square (degrees). */
export const CROSS = Object.freeze({ size: 1.15, aspect: 0.8, tips: 16, stand: 0.75, points: Object.freeze({ ovate: 3, broad: 3, lance: 2, lobed: 6, palmate: 7 }), from: 0.25, fold: 14, lumps: 0.16, splay: 25, leafCard: true,
  // (a radial leaf's mass, CROSS.leafCard: a BUNDLE of small leaves through the mass's room instead of one card, a HAND:
  // each leaf `scale` of the mass's own leaf, `count` of them spread `spread` × its reach, each its own finger, its tip
  // `out` degrees out of the crown, round it as its place in the bundle is, its face the one most out of the crown rolled
  // askew by ± `roll` degrees and tipped `sun` toward the crown's up; its outline `points`)
  bundle: Object.freeze({ count: 21, scale: 0.13, spread: 0.55, depth: 0.3, out: Object.freeze([25, 70]), roll: 60, sun: 0.2, points: 20 }),
  // (by outline, each holding the maple's cover (count × scale² × its leaf's area): a narrower leaf more of them and each a
  // little larger; a willow's half the cover, airy)
  byShape: Object.freeze({ ovate: Object.freeze({ count: 31, scale: 0.205 }), lobed: Object.freeze({ count: 21, scale: 0.205 }), broad: Object.freeze({ count: 21, scale: 0.21 }), lance: Object.freeze({ count: 16, scale: 0.238 }) }) });
export function leafCross(species, { seed = 1, tips = CROSS.tips, bundle = null } = {}) {
  if (needleHabit(species)) return leafClump(species, { seed });
  const rng = mulberry32((seed * 2654435761 + 173) >>> 0), shape = leafShape(species), S = LEAF_SHAPES[shape], R = speciesLeaf(species) * CLUMP.size * CROSS.size, tris = [], NP = CROSS.points[shape] ?? 3;
  const wMax = Math.max(...Array.from({ length: 21 }, (_, j) => S.w(CROSS.from + (1 - CROSS.from) * j / 20)));
  // (a tip as long for its width as its outline's run is: a lance's long and narrow, an ovate's short; the ovate's the unit)
  const aspect = ((1 - CROSS.from) / (2 * wMax)) / ((1 - CROSS.from) / (2 * 0.3));
  const tone = () => mix(TONES.leaf, TONES.leafLit, 0.3 + 0.5 * rng());
  // (a radial leaf's mass as a BUNDLE of small leaves, a hand: each a leaf's outline from its stalk's notch, one card, its
  // own finger, the bundle spread through the mass's room by the golden angle. Not crossed: a pair on one midrib covers
  // little more than one, where each leaf turned its own way covers its own; two thirds the cards hold the cover)
  if (CROSS.leafCard) {
    const B = { ...CROSS.bundle, ...(CROSS.byShape[shape] || {}), ...(bundle || {}) }, G = R * 1.6 * B.scale, M = B.points;
    // (the leaf in a few triangles, LEAF_TRIS: its stalk at its base, its tip along X; centred on o)
    const leaf = (o, X, n, c) => {
      const v = unit3(cross(n, X)), at = ([w, u]) => add(o, add(mul(X, (u - 0.45) * G), mul(v, w * G)));
      for (const T of LEAF_TRIS[shape] || LEAF_TRIS.ovate) tris.push({ p: T.map(at), c, kind: 'leaf' });
    };
    for (let k = 0; k < B.count; k++) {
      const rr = R * B.spread * Math.sqrt((k + 0.5) / B.count), th = k * 2.39996, o = [Math.cos(th) * rr, Math.sin(th) * rr * CROSS.aspect, (rng() - 0.5) * R * B.depth];
      // (its FINGER: the tip `out` out of the crown (+z), round it as its place is, a little askew, the hand opening)
      const a = (B.out[0] + (B.out[1] - B.out[0]) * rng()) * DEG, ph = th + (rng() - 0.5) * 0.6;
      const X = unit3([Math.sin(a) * Math.cos(ph), Math.sin(a) * Math.sin(ph), Math.cos(a)]);
      // (its face: of the faces it can turn, square to its tip, the one most out of the crown, rolled askew, tipped to the
      // sun, the crown's up (+x, the slot))
      const f0 = unit3(add([0, 0, 1], mul(X, -X[2]))), sd = unit3(cross(X, f0)), r = (rng() - 0.5) * 2 * B.roll * DEG, up = add([1, 0, 0], mul(X, -X[0]));
      const f1 = add(mul(f0, Math.cos(r)), mul(sd, Math.sin(r))), n = unit3(dmath.hypot(...up) > 1e-6 ? add(f1, mul(unit3(up), B.sun)) : f1);
      leaf(o, X, n, tone());
    }
    return { tris };
  }
  // one card: its plane spanned by +x (the slot) and `v`, its face `n`; its rim the mass's ellipse, a leaf tip between
  // each two of its points, standing out along the ellipse's normal
  const card = (v, n, c) => {
    // (a radial leaf's mass is its own outline, grown: the card a maple leaf, its lobes toothed, from its heart)
    if (S.polar && CROSS.leafCard) {
      // (round from the stalk's notch: the lobes over the spread, toothed; behind it the notch closing in to the stalk)
      const M = 64, G = R * 1.6, rim = Array.from({ length: M }, (_, j) => { const t = -Math.PI + (2 * Math.PI * j) / M, back = Math.abs(t) > S.spread;
        const r = G * (back ? 0.12 : S.polar(t) * (1 + 0.05 * (j % 2 ? 1 : -1)));
        return [Math.cos(t) * r - G * 0.4, Math.sin(t) * r]; });
      const f = Math.tan(CROSS.fold * DEG), at = ([x, y]) => add(add(mul([1, 0, 0], x), mul(v, y)), mul(n, Math.abs(y) * f)), heart = at([-G * 0.4, 0]);
      for (let i = 0; i < M; i++) tris.push({ p: [heart, at(rim[i]), at(rim[(i + 1) % M])], c, kind: 'leaf' });
      return;
    }
    // (the mass's rim lumpy: its reach swelling and falling round it, by two waves of its own phase)
    const ph1 = rng() * 6.28, ph2 = rng() * 6.28, lump = (t) => 1 + CROSS.lumps * (0.6 * Math.sin(3 * t + ph1) + 0.4 * Math.sin(5 * t + ph2));
    const rim = [], a = R, b = R * CROSS.aspect, P = (t) => [Math.cos(t) * a * lump(t), Math.sin(t) * b * lump(t)];
    for (let i = 0; i < tips; i++) {
      const t0 = ((i + (rng() - 0.5) * 0.25) / tips) * 2 * Math.PI, t1 = ((i + 1 + (rng() - 0.5) * 0.25) / tips) * 2 * Math.PI, [x0, y0] = P(t0), [x1, y1] = P(t1);
      const gap = Math.hypot(x1 - x0, y1 - y0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2, nl = Math.hypot(mx / (a * a), my / (b * b));
      const tw = (rng() - 0.5) * 2 * CROSS.splay * DEG, ox0 = mx / (a * a) / nl, oy0 = my / (b * b) / nl, ox = ox0 * Math.cos(tw) - oy0 * Math.sin(tw), oy = ox0 * Math.sin(tw) + oy0 * Math.cos(tw);
      const sx = (x1 - x0) / gap, sy = (y1 - y0) / gap, L = gap * CROSS.stand * Math.min(2.6, aspect) * (0.7 + 0.6 * rng());
      const half = (u) => (S.w(CROSS.from + (1 - CROSS.from) * u) / wMax) * gap / 2;
      rim.push([x0, y0]);
      if (S.polar) {
        // (a radial leaf's tip: its whole outline out from the gap's middle, its middle lobe outward)
        const M = 2 * NP + 1, Lp = gap * CROSS.stand * 1.1 * (0.8 + 0.4 * rng());
        for (let j = 1; j < M; j++) { const t = -S.spread * 0.9 + (1.8 * S.spread * j) / M, r = S.polar(t) * Lp; rim.push([mx + (ox * Math.cos(t) - sx * Math.sin(t)) * r, my + (oy * Math.cos(t) - sy * Math.sin(t)) * r]); }
        continue;
      }
      for (let j = 1; j <= NP; j++) { const u = j / (NP + 1); rim.push([mx + ox * L * u - sx * half(u), my + oy * L * u - sy * half(u)]); }
      rim.push([mx + ox * L, my + oy * L]);
      for (let j = NP; j >= 1; j--) { const u = j / (NP + 1); rim.push([mx + ox * L * u + sx * half(u), my + oy * L * u + sy * half(u)]); }
    }
    // (folded along the slot: each half of the card turned off its plane toward its face)
    const f = Math.tan(CROSS.fold * DEG), at = ([x, y]) => add(add(mul([1, 0, 0], x), mul(v, y)), mul(n, Math.abs(y) * f));
    const heart = at([0, 0]);
    for (let i = 0; i < rim.length; i++) { const p = at(rim[i]), q = at(rim[(i + 1) % rim.length]); tris.push({ p: [heart, p, q], c, kind: 'leaf' }); }
  };
  card([0, 1, 0], [0, 0, 1], tone());
  card([0, 0, 1], [0, 1, 0], tone());
  return { tris };
}
