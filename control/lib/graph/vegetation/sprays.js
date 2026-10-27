// vegetation/sprays — a tree's foliage as a few SPRAYS cloned over its crown, for a renderer that lights it (the form
// render, gen-7): no light, no exposure baked in, only the leaves' own colours and their real facets.
//
// A spray is a short twig carrying its leaves as its species carries them: the architecture's phyllotaxis (a spiral at
// the golden angle, or distichous, two ranks in one plane), its leaves per node, its leaf size; the leaf's outline its
// species' (an oak's lobes, a beech's or a cherry's ovate blade), each leaf folded along its midrib so a sun finds two
// facets. A crown is the grower's leafy shoots gathered into cells a spray long, one spray per cell, scaled so its leaf
// area is the cell's (form/tree-form.js); a few seeded patterns per species, turned and scaled, are the whole crown.
//
//   SPRAY_LEAVES                    the leaf outlines: half-widths along the midrib, and the midrib's fold
//   leafOutline(species)            the outline a species' leaves take (by its architecture and name)
//   leafSpray(species, { seed, leaves?, size? }) → { tris: [{ p: [3 points], c: [r, g, b], kind }], leaves, length }
//     in metres, the twig from the origin along +x, up +z; c the albedo (sRGB bytes), never lit.
// Deterministic from the seed (mulberry32).
import { mulberry32, ARCHITECTURES } from './grow.js';
import { SPECIES } from './species.js';
import { TONES } from './tree-mesh.js';
import { mix } from './util.js';
import * as dmath from '../../util/dmath.js';

const DEG = Math.PI / 180;

/** The leaf outlines: each a list of half-widths (× the leaf's length) at even steps from the petiole to the tip (each
 *  half-blade a fan from the petiole: two triangles a leaf per point), how far the blade folds up along its midrib (× the
 *  half-width), and the leaves a spray of it carries (a many-lobed leaf, fewer). */
export const SPRAY_LEAVES = Object.freeze({
  // a beech's or a cherry's blade: widest a little below the middle, to a point
  ovate: Object.freeze({ w: [0.3, 0.2], fold: 0.35, leaves: 8 }),
  // an oak's: rounded lobes, deep sinuses between them
  lobed: Object.freeze({ w: [0.26, 0.12, 0.3, 0.13, 0.2], fold: 0.25, leaves: 5 }),
  // a broad blade for the big-leaved (the umbrella tree's leaflets, the figs')
  broad: Object.freeze({ w: [0.38, 0.26], fold: 0.3, leaves: 6 }),
});
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
  const S = SPECIES[species]; if (!S || S.kind !== 'tree') throw new Error(`sprays: '${species}' is not a tree species`);
  const A = { ...ARCHITECTURES[S.arch], ...(S.over || {}) }, O = SPRAY_LEAVES[leafOutline(species)], rng = mulberry32((seed * 2654435761 + 41) >>> 0);
  const L = A.leafSize * (S.leafScale || 1) * size, length = L * SPRAY.twig, tris = [];
  const twigC = TONES.shoot, tw = Math.max(0.003, L * 0.04);
  tris.push({ p: [[0, -tw, 0], [length, -tw * 0.4, 0], [length, tw * 0.4, 0]], c: twigC, kind: 'wood' }, { p: [[0, -tw, 0], [length, tw * 0.4, 0], [0, tw, 0]], c: twigC, kind: 'wood' });
  const distich = A.phyllo === 'distichous'; leaves = leaves ?? O.leaves;
  for (let k = 0; k < leaves; k++) {
    const t = 0.15 + 0.85 * (k + 0.5) / leaves, at = [length * t, 0, 0];
    // (round the twig: the golden angle, or two ranks level either side of it, alternating: a flat spray to the sky)
    const phi = distich ? (k % 2 ? 0 : 180) * DEG + (rng() - 0.5) * 0.3 : (k * 137.5 + rng() * 20) * DEG;
    const out = [0, dmath.cos(phi), dmath.sin(phi)], a = (SPRAY.angle + (rng() - 0.5) * 16) * DEG;
    let d = [dmath.cos(a), out[1] * dmath.sin(a), out[2] * dmath.sin(a) - SPRAY.droop];
    const dl = dmath.hypot(...d); d = d.map((v) => v / dl);
    // (the blade's width across: level, square to its own run and the up)
    let s = [-d[1], d[0], 0]; const sl = dmath.hypot(...s); s = sl < 1e-6 ? [0, 1, 0] : s.map((v) => v / sl);
    const up = [d[1] * s[2] - d[2] * s[1], d[2] * s[0] - d[0] * s[2], d[0] * s[1] - d[1] * s[0]];
    const ln = L * (0.85 + 0.3 * rng()), base = at.map((v, i) => v + d[i] * ln * 0.12);
    const c = mix(TONES.leaf, TONES.leafLit, 0.3 + 0.5 * rng());
    const n = O.w.length, mid = (q) => base.map((v, i) => v + d[i] * ln * q);
    const edge = (q, w, side) => mid(q).map((v, i) => v + s[i] * side * w * ln + up[i] * O.fold * w * ln);
    // (each half-blade a fan from the petiole round its outline to the tip, folded up off the midrib)
    for (const side of [1, -1]) {
      let prevE = null;
      for (let j = 0; j < n; j++) { const e = edge((j + 1) / (n + 1), O.w[j], side); if (prevE) tris.push({ p: side > 0 ? [base, prevE, e] : [base, e, prevE], c, kind: 'leaf' }); prevE = e; }
      tris.push({ p: side > 0 ? [base, edge(0.5 / (n + 1), O.w[0] * 0.5, side), prevE] : [base, prevE, edge(0.5 / (n + 1), O.w[0] * 0.5, side)], c, kind: 'leaf' });
      tris.push({ p: side > 0 ? [base, prevE, mid(1)] : [base, mid(1), prevE], c, kind: 'leaf' });
    }
  }
  return { tris, leaves, length };
}
