/**
 * TOWN DRESS — a gritty cube's street painted from relief, as its island's rock is: the walls' plaster a lime render
 * fallen away here and there to the coursed stone under it (the Dust map), the stone walls ashlar, the plinths a course of
 * long blocks (matte-paint/dressed.js). Each is laid on a placed face as a DETAIL: the painted tile divided by its own
 * mean (per channel, in linear light) and set to `DETAIL_MEAN`; and its roofs' tiles and slates in lapped courses and its
 * timber in boards, the face's own colour and baked light lifted by its
 * inverse, so the face keeps its paint (the cube's ramps, era/out-structures-paint.js) and its light, and the stone's
 * relief, its patches and its joints ride on them. Laid world-locked (a metre is a metre on every wall: u along the
 * wall, v up it; on a roof u along the eave, v up the slope), the two variants by where the face stands.
 *
 *   townDressOf(cube)                        → the street's dress (a cube's grit ≥ GRIT_PIXELS), or null
 *   dressTownFace(face, group, dress)        → the face dressed for its source group ('str:plaster', 'str:stone',
 *                                              'str:timber', 'plinth'; a roof's 'str:tile', 'str:slate', 'str:shingle'),
 *                                              or the face itself (no dress for it, or not a wall, or not a roof); a
 *                                              street's paving ('street:setts', 'street:flags', 'street:slabs', a
 *                                              style's 'street:road', 'street:walk') laid as a floor; an
 *                                              entry's `colour` (a style's, era/arch-style.js) leans the face's hue first
 *   leanHue(hex, colour, share)              a lit face's colour leant toward a material's hue, its luminance (the
 *                                              light baked in it) kept
 *   DETAIL_MEAN                              the mean a detail is set to (linear)
 *
 * The laying is matte-paint/detail.js's (its tiles served by the `detail:` resolver). Pure: the cube's numbers and the
 * walls' places only. Absent a dress, a town is as it was, byte for byte.
 */
import { detailKey, layDetail, DETAIL_MEAN } from '../matte-paint/detail.js';
import { normalizeTileSpec } from './tile-specs.js';
import { GRIT_PIXELS } from '../matte-paint/fabric.js';

export { DETAIL_MEAN };
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hexOf = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const srgb = (c) => 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/** A gritty cube's street dress: each source group's dressed stone, in the cube's own colours, tuned by its grit. */
export function townDressOf(cube) {
  const g = cube.grit;
  if (g === undefined || g < GRIT_PIXELS) return null;
  const stone = rgbOf(cube.colour.stone), mortar = stone.map((v) => Math.round(v * 0.68)), coat = rgbOf(cube.colour.floor).map((v) => Math.min(255, Math.round(v * 1.05 + 10)));
  const wear = { grit: g, spall: Math.min(1, g), pit: Math.round(60 * g) / 100 };
  return {
    // (a render's repeat is long: its patches are a wall's few, not a tile's one)
    'str:plaster': { spec: { gen: 'dressed', cut: 'render', stone, mortar, render: coat, rows: 6, cols: 2, ...wear, loss: Math.round(Math.min(1, 0.1 + 0.6 * g) * 100) / 100, seed: 23 }, metres: 3 },
    'str:stone': { spec: { gen: 'dressed', stone, mortar, rows: 5, cols: 2, tool: g >= 0.85 ? 'pitched' : 'tooled', ...wear, seed: 29 }, metres: 2.4 },
    plinth: { spec: { gen: 'dressed', stone: stone.map((v) => Math.round(v * 0.9)), mortar, rows: 2, cols: 2, tool: 'pitched', ...wear, seed: 31 }, metres: 1.6 },
    'str:timber': { spec: { gen: 'dressed', cut: 'boards', stone: rgbOf(cube.colour.trim), mortar, cols: 9, ...wear, seed: 41 }, metres: 2 },
    // the roofs: a course of tiles a fifth of a metre, slates a sixth (a roof's colour is its paint's: the floor's)
    'str:tile': { spec: { gen: 'dressed', cut: 'tile', stone: rgbOf(cube.colour.floor), mortar, rows: 10, cols: 8, ...wear, seed: 43 }, metres: 2, roof: true },
    'str:slate': { spec: { gen: 'dressed', cut: 'slate', stone: rgbOf(cube.colour.floor), mortar, rows: 12, cols: 6, ...wear, seed: 47 }, metres: 2, roof: true },
    'str:shingle': { spec: { gen: 'dressed', cut: 'slate', stone: rgbOf(cube.colour.trim), mortar, rows: 14, cols: 8, ...wear, seed: 53 }, metres: 2, roof: true },
    // the street's pavings (era/stage-street.js), by the language's words: setts in courses, flagstones, door slabs
    'street:setts': { spec: { gen: 'dressed', cut: 'setts', face: 'floor', stone, mortar: rgbOf(cube.colour.floor), rows: 10, cols: 8, vary: 24, ...wear, seed: 63 }, metres: 1.2, floor: true },
    'street:flags': { spec: { gen: 'dressed', face: 'floor', stone: rgbOf(cube.colour.floor), mortar, rows: 3, cols: 3, tool: 'none', ...wear, seed: 61 }, metres: 1.8, floor: true },
    'street:slabs': { spec: { gen: 'dressed', face: 'floor', stone: rgbOf(cube.colour.floor), mortar, rows: 2, cols: 2, tool: 'none', ...wear, seed: 65 }, metres: 1.4, floor: true },
  };
}

const keyOf = (entry, v) => {
  // (the spec on the dressed tile's rails, in their order: anything off them refused)
  const { seed = 1, ...params } = normalizeTileSpec(entry.spec, 'town dress').params;
  return detailKey(params, seed, entry.metres, v);
};
/** A lit face's colour leant toward a material's hue, `share` of the way: its luminance kept, so the light baked in
 *  it (and the value its language gave it) stays the cube's, and the material says its hue. */
export function leanHue(hex, colour, share = 0.65) {
  const f = rgbOf(hex).map(lin), c = rgbOf(colour).map(lin), Lf = lum(f), Lc = lum(c) || 1e-6;
  const m = f.map((v, k) => v + ((c[k] * Lf) / Lc - v) * share), top = Math.max(...m);
  // (a pale face leant to a deep colour would clip: it gives up chroma, toward its own grey, and keeps its light)
  const t = top > 1 ? (1 - Lf) / (top - Lf) : 1;
  return hexOf(m.map((v) => srgb(Math.max(0, Math.min(1, Lf + (v - Lf) * t)))));
}
const leanFace = (face, colour) => ({ ...face, fill: leanHue(face.fill, colour), ...(face.cornerFills ? { cornerFills: face.cornerFills.map((c) => leanHue(c, colour)) } : {}) });

/** A placed face dressed for its source group: a wall of a group the dress names, or a pitched roof of one; its hue
 *  leant first when the entry carries a colour (a colour alone dresses no relief). */
export function dressTownFace(face, group, dress) {
  const E = dress && dress[group];
  if (!E || !face.normal || !face.corners || face.corners.length < 3) return face;
  const F = E.colour && typeof face.fill === 'string' ? leanFace(face, E.colour) : face;
  if (!E.spec) return F;
  const c0 = F.corners[0], v = Math.floor(Math.abs(c0[0] * 0.37 + c0[1] * 0.61 + c0[2] * 0.13)) % 2;
  const out = layDetail({ ...F, cornerFills: F.cornerFills ?? [F.fill] }, { key: keyOf(E, v), metres: E.metres, as: E.roof ? 'roof' : E.floor ? 'floor' : 'wall' });
  return out.texture ? out : F;
}
