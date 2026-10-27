// vegetation/sprays — a tree's foliage as a few SPRAYS cloned over its crown, for a renderer that lights it (the form
// render, gen-7): no light, no exposure baked in, only the leaves' own colours and their real facets.
//
// A spray is a short twig carrying its leaves as its species carries them: the architecture's phyllotaxis (a spiral at
// the golden angle, or distichous, two ranks in one plane), its leaves per node, its leaf size; the leaf's outline its
// species' (an oak's lobes, a beech's or a cherry's ovate blade), each leaf folded along its midrib so a sun finds two
// facets. A CLUMP is the crown's mass: a rosette of a few oversized leaves of the same outline (simplified), cupped round
// its centre and facing out (+z), standing for a cell of the crown several sprays wide. The crown is clumps everywhere,
// and near the eye the sprays come in inside them, the clumps drawing in (the grass's carpet and blades: nothing comes
// from nothing); a clump and the sprays of its cell hold the same leaf area (form/tree-form.js scales each to its cell's).
//
//   SPRAY_LEAVES                    the leaf outlines: half-widths along the midrib, the fold, a spray's leaves, a clump's
//   leafOutline(species)            the outline a species' leaves take (by its architecture and name)
//   leafSpray(species, { seed, leaves?, size? }) → { tris: [{ p: [3 points], c: [r, g, b], kind }], leaves, length }
//     in metres, the twig from the origin along +x, up +z; c the albedo (sRGB bytes), never lit
//   leafClump(species, { seed }) → { tris, leaves }  in metres, round the origin, facing +z
//   leafHolds(species) → { spray, clump }: how many of the species' leaves a spray's and a clump's leaf area holds
// Deterministic from the seed (mulberry32).
import { mulberry32, ARCHITECTURES } from './grow.js';
import { SPECIES } from './species.js';
import { TONES } from './tree-mesh.js';
import { mix } from './util.js';
import * as dmath from '../../util/dmath.js';

const DEG = Math.PI / 180;

// one leaf on its petiole at `at`, running along `d` (a unit vector) `ln` long: its outline's half-widths `w`, folded
// up off the midrib by `fold`, each half-blade a fan from the petiole round the outline to the tip
function pushLeaf(tris, at, d, ln, w, fold, c) {
  // (the blade's width across: level, square to its own run and the up)
  let s = [-d[1], d[0], 0]; const sl = dmath.hypot(...s); s = sl < 1e-6 ? [0, 1, 0] : s.map((v) => v / sl);
  const up = [d[1] * s[2] - d[2] * s[1], d[2] * s[0] - d[0] * s[2], d[0] * s[1] - d[1] * s[0]];
  const base = at.map((v, i) => v + d[i] * ln * 0.12), n = w.length, mid = (q) => base.map((v, i) => v + d[i] * ln * q);
  const edge = (q, hw, side) => mid(q).map((v, i) => v + s[i] * side * hw * ln + up[i] * fold * hw * ln);
  for (const side of [1, -1]) {
    let prevE = null;
    for (let j = 0; j < n; j++) { const e = edge((j + 1) / (n + 1), w[j], side); if (prevE) tris.push({ p: side > 0 ? [base, prevE, e] : [base, e, prevE], c, kind: 'leaf' }); prevE = e; }
    tris.push({ p: side > 0 ? [base, edge(0.5 / (n + 1), w[0] * 0.5, side), prevE] : [base, prevE, edge(0.5 / (n + 1), w[0] * 0.5, side)], c, kind: 'leaf' });
    tris.push({ p: side > 0 ? [base, prevE, mid(1)] : [base, mid(1), prevE], c, kind: 'leaf' });
  }
}
const unit3 = (d) => { const l = dmath.hypot(...d); return d.map((v) => v / l); };
const leafArea = (tris) => tris.filter((t) => t.kind === 'leaf').reduce((a, { p: [A, B, C] }) => {
  const u = B.map((v, i) => v - A[i]), v = C.map((x, i) => x - A[i]);
  return a + 0.5 * dmath.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]);
}, 0);
const speciesOf = (species) => { const S = SPECIES[species]; if (!S || S.kind !== 'tree') throw new Error(`sprays: '${species}' is not a tree species`); return { S, A: { ...ARCHITECTURES[S.arch], ...(S.over || {}) }, O: SPRAY_LEAVES[leafOutline(species)] }; };

/** The leaf outlines: each a list of half-widths (× the leaf's length) at even steps from the petiole to the tip (each
 *  half-blade a fan from the petiole: two triangles a leaf per point), how far the blade folds up along its midrib (× the
 *  half-width), the leaves a spray of it carries (a many-lobed leaf, fewer), and a clump's leaf: the outline simplified,
 *  blunt (a sharp sinus at a clump's size reads as a shard). */
export const SPRAY_LEAVES = Object.freeze({
  // a beech's or a cherry's blade: widest a little below the middle, to a point
  ovate: Object.freeze({ w: [0.3, 0.2], fold: 0.35, leaves: 8, clump: Object.freeze([0.3, 0.22]) }),
  // an oak's: rounded lobes, deep sinuses between them
  lobed: Object.freeze({ w: [0.26, 0.12, 0.3, 0.13, 0.2], fold: 0.25, leaves: 5, clump: Object.freeze([0.28, 0.24]) }),
  // a broad blade for the big-leaved (the umbrella tree's leaflets, the figs')
  broad: Object.freeze({ w: [0.38, 0.26], fold: 0.3, leaves: 6, clump: Object.freeze([0.38, 0.3]) }),
});
/** A clump: its leaves (a rosette round its centre), their length (× the species' leaf), how far each tilts off the
 *  clump's facing (degrees), and its own little lift (× its leaves' length): a cupped dome. */
export const CLUMP = Object.freeze({ leaves: 6, size: 3.5, tilt: Object.freeze([50, 76]), lift: 0.12 });
/** The twig's length (× the leaves' length) and the leaf's angle off it (degrees), and how far a leaf hangs. */
export const SPRAY = Object.freeze({ twig: 2.4, angle: 52, droop: 0.25 });

/** The outline a species' leaves take. */
export function leafOutline(species) {
  if (species === 'oak') return 'lobed';
  const S = SPECIES[species]; const A = S && ARCHITECTURES[S.arch];
  return A && A.leafSize >= 0.14 ? 'broad' : 'ovate';
}

/**
 * One spray of a species: its twig and `leaves` leaves (its outline's, near), each `size` (× the species' leaf size: its
 * architecture's, by its leafScale). The twig is a narrow strip along +x; the leaves set along it by the phyllotaxis,
 * each on its petiole at SPRAY.angle off the twig, hanging a little.
 */
export function leafSpray(species, { seed = 1, leaves = null, size = 1 } = {}) {
  const { S, A, O } = speciesOf(species), rng = mulberry32((seed * 2654435761 + 41) >>> 0);
  const L = A.leafSize * (S.leafScale || 1) * size, length = L * SPRAY.twig, tris = [];
  const twigC = TONES.shoot, tw = Math.max(0.003, L * 0.04);
  tris.push({ p: [[0, -tw, 0], [length, -tw * 0.4, 0], [length, tw * 0.4, 0]], c: twigC, kind: 'wood' }, { p: [[0, -tw, 0], [length, tw * 0.4, 0], [0, tw, 0]], c: twigC, kind: 'wood' });
  const distich = A.phyllo === 'distichous'; leaves = leaves ?? O.leaves;
  for (let k = 0; k < leaves; k++) {
    const t = 0.15 + 0.85 * (k + 0.5) / leaves, at = [length * t, 0, 0];
    // (round the twig: the golden angle, or two ranks level either side of it, alternating: a flat spray to the sky)
    const phi = distich ? (k % 2 ? 0 : 180) * DEG + (rng() - 0.5) * 0.3 : (k * 137.5 + rng() * 20) * DEG;
    const out = [0, dmath.cos(phi), dmath.sin(phi)], a = (SPRAY.angle + (rng() - 0.5) * 16) * DEG;
    const d = unit3([dmath.cos(a), out[1] * dmath.sin(a), out[2] * dmath.sin(a) - SPRAY.droop]);
    pushLeaf(tris, at, d, L * (0.85 + 0.3 * rng()), O.w, O.fold, mix(TONES.leaf, TONES.leafLit, 0.3 + 0.5 * rng()));
  }
  return { tris, leaves, length };
}

/**
 * One clump of a species: CLUMP.leaves oversized leaves of its outline simplified, a rosette round the origin, each
 * tilted off the clump's facing (+z) and turned round it, their petioles lifted a little off the centre: a cupped dome.
 */
export function leafClump(species, { seed = 1 } = {}) {
  const { S, A, O } = speciesOf(species), rng = mulberry32((seed * 2654435761 + 97) >>> 0), L = A.leafSize * (S.leafScale || 1) * CLUMP.size, tris = [];
  for (let k = 0; k < CLUMP.leaves; k++) {
    const az = (k * 360 / CLUMP.leaves + (rng() - 0.5) * 40) * DEG, tilt = (CLUMP.tilt[0] + (CLUMP.tilt[1] - CLUMP.tilt[0]) * rng()) * DEG;
    const d = [dmath.sin(tilt) * dmath.cos(az), dmath.sin(tilt) * dmath.sin(az), dmath.cos(tilt)];
    pushLeaf(tris, [0, 0, -L * CLUMP.lift], d, L * (0.85 + 0.3 * rng()), O.clump, O.fold, mix(TONES.leaf, TONES.leafLit, 0.3 + 0.5 * rng()));
  }
  return { tris, leaves: CLUMP.leaves };
}

/** How many of a species' leaves (a spray's mean leaf) a spray's and a clump's leaf area hold: the scales a crown's
 *  cells take so a clump and the sprays of its cell hold the same leaf area. */
export function leafHolds(species) {
  const sp = leafSpray(species, { seed: 1 }), per = leafArea(sp.tris) / sp.leaves;
  return { spray: sp.leaves, clump: Math.round((leafArea(leafClump(species, { seed: 1 }).tris) / per) * 100) / 100 };
}
