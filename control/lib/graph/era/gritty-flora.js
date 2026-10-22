/**
 * GRITTY FLORA — what grows on a gritty land drawn in detail, as its walls and its rock are: a grey relief tile laid over
 * each face's own colour and light (matte-paint/detail.js layDetail, the natural cuts of matte-paint/dressed.js), its
 * strength the land's grit. No colour of its own: the face's paint and light come back, the relief rides on them.
 *
 *   crowns   (isekai:crown) the `leaves` cut: leaves over one another in masses, a crown's top laid as a floor and its
 *            sides as a wall, so a mass reads from the street and its leaves near it
 *   trunks   (isekai:wood) the `bark` cut up the trunk: plates between furrows
 *
 *   withGrittyFlora(faces, grit)   → the faces, the flora's laid; a grit under GRIT_PIXELS lays nothing (as it came)
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

const r2 = (v) => Math.round(v * 100) / 100;
/** The faces with the flora's relief laid on them, as strong as the land is gritty. */
export function withGrittyFlora(faces, grit) {
  if (!(grit >= GRIT_PIXELS)) return faces;
  const keys = new Map();
  const keyOf = (C, v) => {
    const k = `${C.cut}${v}`;
    if (!keys.has(k)) {
      const { seed = 1, ...params } = normalizeTileSpec({ gen: 'dressed', cut: C.cut, stone: GREY, mortar: DIM, vary: C.vary, grit: r2(grit), seed: C.seed }, 'gritty flora').params;
      keys.set(k, detailKey(params, seed, C.metres, v));
    }
    return keys.get(k);
  };
  return faces.map((f) => {
    const C = FLORA_CUTS[f.group];
    if (!C || f.texture || !Array.isArray(f.normal) || typeof f.fill !== 'string' || !f.corners || f.corners.length < 3) return f;
    const flat = Math.abs(f.normal[2]) > 0.7;
    if (C.wall && flat) return f;
    const c0 = f.corners[0], v = Math.floor(Math.abs(c0[0] * 0.37 + c0[1] * 0.61 + c0[2] * 0.13)) % 2;
    const out = layDetail(f.cornerFills ? f : { ...f, cornerFills: f.corners.map(() => f.fill) }, { key: keyOf(C, v), metres: C.metres, as: flat ? 'floor' : 'wall' });
    return out.texture ? out : f;
  });
}
