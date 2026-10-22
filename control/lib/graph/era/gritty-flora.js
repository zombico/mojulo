/**
 * GRITTY FLORA — what grows on a gritty land drawn in detail, as its walls and its rock are: a grey relief tile laid over
 * each face's own colour and light (matte-paint/detail.js layDetail, the natural cuts of matte-paint/dressed.js), its
 * strength the land's grit. No colour of its own: the face's paint and light come back, the relief rides on them.
 *
 *   crowns   (isekai:crown) the `leaves` cut: leaves over one another in masses, a crown's top laid as a floor and its
 *            sides as a wall, so a mass reads from the street and its leaves near it
 *   trunks   (isekai:wood) the `bark` cut up the trunk: plates between furrows
 *   the path (isekai:trail) the `path` cut: packed earth, crumbs, stones pressed into it
 *   the ground (isekai:ground, the talus) the `turf` cut: blades in tussocks
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
import { detailKey, layDetail } from '../matte-paint/detail.js';
import { GRIT_PIXELS } from '../matte-paint/fabric.js';
import { normalizeTileSpec } from './tile-specs.js';

const GREY = [200, 200, 200], DIM = [120, 120, 120];
// each group's cut: its metres a repeat, its tone's spread, its seed
export const FLORA_CUTS = Object.freeze({
  'isekai:crown': Object.freeze({ cut: 'leaves', metres: 3, vary: 22, seed: 73 }),
  'isekai:wood': Object.freeze({ cut: 'bark', metres: 1, vary: 10, seed: 79, wall: true }),
});
export const GROUND_CUTS = Object.freeze({
  'isekai:trail': Object.freeze({ cut: 'path', metres: 1.5, vary: 14, seed: 83 }),
  'isekai:ground': Object.freeze({ cut: 'turf', metres: 1.5, vary: 12, seed: 71 }),
  'isekai:scree': Object.freeze({ cut: 'turf', metres: 1.5, vary: 12, seed: 71 }),
  verge: Object.freeze({ cut: 'verge', metres: 1, vary: 12, seed: 89 }),
});

const r2 = (v) => Math.round(v * 100) / 100, r4 = (v) => Math.round(v * 1e4) / 1e4;
// a cut's two tiles at a grit, made once a call
const keysFor = (grit) => {
  const keys = new Map();
  return (C, v) => {
    const k = `${C.cut}${v}`;
    if (!keys.has(k)) {
      const { seed = 1, ...params } = normalizeTileSpec({ gen: 'dressed', cut: C.cut, stone: GREY, mortar: DIM, vary: C.vary, grit: r2(grit), seed: C.seed }, 'gritty flora').params;
      keys.set(k, detailKey(params, seed, C.metres, v));
    }
    return keys.get(k);
  };
};
const variantOf = (f) => { const c0 = f.corners[0]; return Math.floor(Math.abs(c0[0] * 0.37 + c0[1] * 0.61 + c0[2] * 0.13)) % 2; };
const withFills = (f) => (f.cornerFills ? f : { ...f, cornerFills: f.corners.map(() => f.fill) });
const laid = (f) => !f.texture && Array.isArray(f.normal) && typeof f.fill === 'string' && f.corners && f.corners.length >= 3;

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
export function withGrittyGround(faces, grit, { verge = () => false, nearTrail = null, trail = null } = {}) {
  if (!(grit >= GRIT_PIXELS)) return faces;
  const keyOf = keysFor(grit);
  // (a paved trail's own tile, era/trail-dress.js surfaceDress, over the path's)
  const paved = trail ? [0, 1].map((v) => detailKey(trail.params, trail.seed, trail.metres, v)) : null;
  return faces.map((f, i) => {
    if (!laid(f)) return f;
    if (verge(i) && nearTrail) {
      // across the lane: v 0 at its two corners nearest the trail, 1 at the far two; u along it, world-locked
      const C = GROUND_CUTS.verge, d = f.corners.map(nearTrail), near = d.map((x, k) => k).sort((a, b) => d[a] - d[b]).slice(0, 2);
      const uv = f.corners.map((c, k) => [r4(c[1] / C.metres), near.includes(k) ? 0 : 0.999]);
      const F = withFills(f), lift = layDetail(F, { key: keyOf(C, variantOf(f)), metres: C.metres, as: 'floor' });
      return lift.texture ? { ...lift, uv } : f;
    }
    const C = GROUND_CUTS[f.group];
    if (!C || Math.abs(f.normal[2]) <= 0.7) return f;
    if (paved && f.group === 'isekai:trail') { const out = layDetail(withFills(f), { key: paved[variantOf(f)], metres: trail.metres, as: 'floor' }); return out.texture ? out : f; }
    const out = layDetail(withFills(f), { key: keyOf(C, variantOf(f)), metres: C.metres, as: 'floor' });
    return out.texture ? out : f;
  });
}
