/**
 * GRITTY FLORA — what grows on a gritty land drawn in detail, as its walls and its rock are: a grey relief tile laid over
 * each face's own colour and light (matte-paint/detail.js layDetail, the natural cuts of matte-paint/dressed.js), its
 * strength the land's grit. No colour of its own: the face's paint and light come back, the relief rides on them.
 *
 *   crowns   (isekai:crown) the `leaves` cut: leaves over one another in masses, a crown's top laid as a floor and its
 *            sides as a wall, so a mass reads from the street and its leaves near it
 *   trunks   (isekai:wood) the `bark` cut up the trunk: plates between furrows
 *   the path (isekai:trail) the `path` cut: packed earth, crumbs, stones pressed into it
 *   the ground (isekai:ground, the talus) the `turf` cut: blades in tussocks; sand (isekai:sand) the `sand` cut; a
 *            formation's pavement (isekai:pavement) the `karst` cut, its loose talus (isekai:talus) the `scree` cut
 *   its edge (the trail's fringe lanes) the `verge` cut laid ACROSS the lane: earth and stones at the path's side giving
 *            way to turf at the land's, so the two meet in a band, not a line
 *
 *   withGrittyFlora(faces, grit)   → the faces, the flora's laid; a grit under GRIT_PIXELS lays nothing (as it came)
 *   withGrittyGround(faces, grit, { verge, nearTrail, trail })   → the land's faces laid: path, turf, and the verge on the
 *                                    faces `verge(i)` names (a fringe lane), `nearTrail(corner)` its distance to the trail;
 *                                    `trail` a paved trail's tile ({ params, seed, metres }) laid on it for the path
 *
 * era/isekai.js lays it on a gritty polygon land (`shading.grit`). Pure: two tiles a cut, alternated by where a face lies.
 */
import { detailKey, detailSeed, layDetail } from '../matte-paint/detail.js';
import { karstJoints } from '../matte-paint/karst.js';
import { GRIT_PIXELS } from '../matte-paint/fabric.js';
import { normalizeTileSpec } from './tile-specs.js';

const GREY = [200, 200, 200], DIM = [120, 120, 120];
// each group's cut: its metres a repeat, its tone's spread, its seed
export const FLORA_CUTS = Object.freeze({
  'isekai:crown': Object.freeze({ cut: 'leaves', metres: 3, vary: 22, seed: 73 }),
  'isekai:wood': Object.freeze({ cut: 'bark', metres: 1, vary: 10, seed: 79, wall: true }),
});
/** A formation's talus (era/isekai.js formationGround): its scree's stones by the rock (limestone in blocks, flagstone
 *  in plates, sandstone weathered to cobbles), and its coarse patches (`isekai:rubble`) the rock's own big blocks among
 *  the small. Over GROUND_CUTS' talus and rubble for a land of that rock. */
export const TALUS_CUTS = Object.freeze({
  limestone: Object.freeze({ 'isekai:talus': Object.freeze({ cut: 'scree', form: 'blocks', metres: 1.5, vary: 12, seed: 103 }), 'isekai:rubble': Object.freeze({ cut: 'scree', form: 'rubble', metres: 2.4, vary: 12, seed: 107 }) }),
  flagstone: Object.freeze({ 'isekai:talus': Object.freeze({ cut: 'scree', form: 'plates', metres: 1.8, vary: 12, seed: 103 }), 'isekai:rubble': Object.freeze({ cut: 'scree', form: 'plates', metres: 3, vary: 14, seed: 107 }) }),
  sandstone: Object.freeze({ 'isekai:talus': Object.freeze({ cut: 'scree', form: 'cobbles', metres: 1.2, vary: 10, seed: 103 }), 'isekai:rubble': Object.freeze({ cut: 'scree', form: 'rubble', metres: 2.2, vary: 12, seed: 107 }) }),
});
export const GROUND_CUTS = Object.freeze({
  'isekai:trail': Object.freeze({ cut: 'path', metres: 1.5, vary: 14, seed: 83 }),
  'isekai:ground': Object.freeze({ cut: 'turf', metres: 1.5, vary: 12, seed: 71 }),
  'isekai:scree': Object.freeze({ cut: 'turf', metres: 1.5, vary: 12, seed: 71 }),
  // (sand, where the substrate is: era/substrate.js)
  // (one variant: its ripples run on across the faces, where a change of tile would show as a square)
  'isekai:sand': Object.freeze({ cut: 'sand', metres: 1.2, vary: 10, seed: 97, one: true }),
  // (a formation's rock ground, where the land names one: era/isekai.js formationGround) the pavement in clints and
  // grikes (its joints the rock flora roots in: era/rock-flora.js), the talus in loose stones
  'isekai:pavement': Object.freeze({ cut: 'karst', metres: 3.6, vary: 10, seed: 101, one: true, rows: 3, cols: 2 }),
  'isekai:talus': Object.freeze({ cut: 'scree', form: 'blocks', metres: 1.5, vary: 12, seed: 103 }),
  'isekai:rubble': Object.freeze({ cut: 'scree', form: 'rubble', metres: 2.4, vary: 12, seed: 107 }),
  verge: Object.freeze({ cut: 'verge', metres: 1, vary: 12, seed: 89 }),
});

const r2 = (v) => Math.round(v * 100) / 100, r4 = (v) => Math.round(v * 1e4) / 1e4;
// a cut's two tiles at a grit, made once a call
const keysFor = (grit) => {
  const keys = new Map();
  return (C, v) => {
    const k = `${C.cut}${C.form ?? ''}${C.metres}${v}`;
    if (!keys.has(k)) {
      const { seed = 1, ...params } = normalizeTileSpec({ gen: 'dressed', cut: C.cut, stone: GREY, mortar: DIM, vary: C.vary, grit: r2(grit), seed: C.seed, ...(C.rows ? { rows: C.rows, cols: C.cols } : {}), ...(C.form ? { form: C.form } : {}) }, 'gritty flora').params;
      keys.set(k, detailKey(params, seed, C.metres, v));
    }
    return keys.get(k);
  };
};
const variantOf = (f) => { const c0 = f.corners[0]; return Math.floor(Math.abs(c0[0] * 0.37 + c0[1] * 0.61 + c0[2] * 0.13)) % 2; };
const withFills = (f) => (f.cornerFills ? f : { ...f, cornerFills: f.corners.map(() => f.fill) });
const laid = (f) => !f.texture && Array.isArray(f.normal) && typeof f.fill === 'string' && f.corners && f.corners.length >= 3;

/** The trail's own path tile at a grit, variant `v` (0 | 1): what its edge's spill is laid with (era/trail-dress.js). */
export const trailKey = (grit, v) => keysFor(grit)(GROUND_CUTS['isekai:trail'], v);
/** A formation's pavement's joints as its `karst` tile draws them (matte-paint/karst.js), in world metres on the floor:
 *  what the rock flora roots in. (A floor's v is y over its metres, and the page loads a tile's image with its first row
 *  at v = 1: the tile's own y runs against the world's.) */
export const pavementJoints = () => {
  const C = GROUND_CUTS['isekai:pavement'], J = karstJoints({ M: C.metres, rows: C.rows, cols: C.cols, seed: detailSeed(C.seed, 0) });
  return { dist: (x, y) => J.dist(x, -y), clint: (x, y) => J.clint(x, -y) };
};
/** A ground cut's tile at a grit (its first variant): what a cutout of it is made from (era/scree-tiles.js). */
export const groundKey = (C, grit) => keysFor(grit)(C, 0);
/** The land's own turf tile at a grit, variant `v`: what the verge's outer edge is turfed with (era/trail-dress.js). */
export const turfKey = (grit, v) => keysFor(grit)(GROUND_CUTS['isekai:ground'], v);

/** The faces with the flora's relief laid on them, as strong as the land is gritty. */
export function withGrittyFlora(faces, grit) {
  if (!(grit >= GRIT_PIXELS)) return faces;
  const keyOf = keysFor(grit);
  return faces.map((f) => {
    const C = FLORA_CUTS[f.group];
    if (!C || !laid(f)) return f;
    const flat = Math.abs(f.normal[2]) > 0.7;
    if (C.wall && flat) return f;
    const out = layDetail(withFills(f), { key: keyOf(C, variantOf(f)), metres: C.metres, as: flat ? 'floor' : 'wall' });
    return out.texture ? out : f;
  });
}

/** The land's faces with the path, the turf and the verge laid on them, as strong as the land is gritty. */
export function withGrittyGround(faces, grit, { verge = () => false, nearTrail = null, trail = null, cuts = null } = {}) {
  if (!(grit >= GRIT_PIXELS)) return faces;
  const keyOf = keysFor(grit);
  // (a paved trail's own tile, era/trail-dress.js surfaceDress, over the path's)
  const paved = trail ? [detailKey(trail.params, trail.seed, trail.metres, 0)] : null;
  return faces.map((f, i) => {
    if (!laid(f)) return f;
    if (verge(i) && nearTrail) {
      // across the lane: v 0 at its two corners nearest the trail, 1 at the far two; u along it, world-locked
      const C = GROUND_CUTS.verge, d = f.corners.map(nearTrail), near = d.map((x, k) => k).sort((a, b) => d[a] - d[b]).slice(0, 2);
      const uv = f.corners.map((c, k) => [r4(c[1] / C.metres), near.includes(k) ? 0 : 0.999]);
      const F = withFills(f), lift = layDetail(F, { key: keyOf(C, variantOf(f)), metres: C.metres, as: 'floor' });
      return lift.texture ? { ...lift, uv } : f;
    }
    // (a land's own cuts, `cuts`, over the ground's: a formation's talus)
    const C = cuts?.[f.group] ?? GROUND_CUTS[f.group];
    if (!C || Math.abs(f.normal[2]) <= 0.7) return f;
    // (one variant only: a paving's joints run on across the faces, where a path's noise would hide a change)
    if (paved && f.group === 'isekai:trail') { const out = layDetail(withFills(f), { key: paved[0], metres: trail.metres, as: 'floor' }); return out.texture ? out : f; }
    const out = layDetail(withFills(f), { key: keyOf(C, C.one ? 0 : variantOf(f)), metres: C.metres, as: 'floor' });
    return out.texture ? out : f;
  });
}
