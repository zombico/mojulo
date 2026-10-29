/**
 * The BAY EXTERIOR — what a composed building (a base's barracks, armoury, comms building) wears outside when it stands
 * on open ground (era/stage-buildings.js), so it reads as built of what its inside is built of, not as a town's house.
 * Its two halves are the composer's axes (era/style/bay-axes.js):
 *
 *   EXTERIORS        by CONSTRUCTION: the wall's material and the roof's (a made cut, matte-paint/dressed.js, at the
 *                    metres it is laid at), the roof's form (`flat` behind a parapet `parapet` m high, or `low`, a
 *                    standing-seam roof at `pitch` degrees) and whether the construction keeps its material's own colour
 *                    (`own`: concrete is concrete, whatever it is painted inside)
 *   EXTERIOR_PAINT   by PALETTE: the wall's and the roof's swatch, each the face and its joints
 *
 *   exteriorOf({ construction, palette }) → { wall: { family, scale, key }, roof: { family, scale, key }, cap, pitch, parapet }
 *
 * Pure data and a lookup; a tile family is named from its numbers (era/tile-specs.js), so the same look is the same tiles.
 */
import { tileFamilyOf } from '../tile-specs.js';

// a made cut at the metres it is laid at
const d = (cut, metres, o = {}) => ({ cut, metres, o });

export const EXTERIORS = Object.freeze({
  // corrugated steel sheeted over the frame, a standing-seam roof at a low pitch: a shed on a base
  military: { wall: d('corrugated', 3, { cols: 12, grit: 0.6 }), roof: d('seam', 3, { cols: 6, grit: 0.5 }), cap: 'low', pitch: 8 },
  // board-formed concrete to the parapet and a flat concrete roof: hardened, the material its own grey
  bunker: { wall: d('concrete', 4, { cols: 2, rows: 2, grit: 0.7 }), roof: d('concrete', 3, { cols: 2, rows: 2, grit: 0.6 }), cap: 'flat', parapet: 0.6, own: { stone: [132, 130, 124], mortar: [92, 90, 86] } },
  // concrete block, painted, under a standing-seam roof
  utility: { wall: d('block', 2, { rows: 10, cols: 5, grit: 0.5 }), roof: d('seam', 3, { cols: 6, grit: 0.5 }), cap: 'low', pitch: 8 },
  // sheet panels with their reveal joints over a flat roof behind a parapet
  science: { wall: d('panel', 2.4, { cols: 2, rows: 1, grit: 0.3 }), roof: d('concrete', 3, { cols: 2, rows: 2, grit: 0.4 }), cap: 'flat', parapet: 0.5 },
  // a floated coat over block, a flat roof behind a parapet
  everyday: { wall: d('stucco', 3, { grit: 0.4 }), roof: d('concrete', 3, { cols: 2, rows: 2, grit: 0.4 }), cap: 'flat', parapet: 0.6 },
});

export const EXTERIOR_PAINT = Object.freeze({
  // olive drab sheeting, a dark green roof
  military: { wall: { stone: [96, 102, 78], mortar: [52, 56, 44] }, roof: { stone: [70, 78, 64], mortar: [40, 44, 38] } },
  // pale warm block, a galvanised roof
  utility: { wall: { stone: [178, 172, 158], mortar: [140, 136, 126] }, roof: { stone: [150, 154, 154], mortar: [96, 100, 102] } },
  // off-white panels, a pale roof
  science: { wall: { stone: [214, 218, 216], mortar: [120, 126, 128] }, roof: { stone: [176, 178, 176], mortar: [130, 132, 130] } },
  // a sand-coloured coat, a grey roof
  everyday: { wall: { stone: [204, 192, 170], mortar: [170, 160, 142] }, roof: { stone: [150, 148, 142], mortar: [110, 108, 104] } },
});

const tile = (m, sw) => {
  const family = tileFamilyOf({ gen: 'dressed', cut: m.cut, stone: sw.stone, mortar: sw.mortar, ...m.o, scale: m.metres }, 'bay exterior');
  return { family, scale: m.metres, key: `${family}-a` };
};

/** A composed building's outside, from its axes (the construction's materials and form, the palette's colours). */
export function exteriorOf({ construction, palette } = {}) {
  const E = EXTERIORS[construction] ?? EXTERIORS.utility, P = EXTERIOR_PAINT[palette] ?? EXTERIOR_PAINT.utility;
  return { wall: tile(E.wall, E.own ?? P.wall), roof: tile(E.roof, E.own ?? P.roof), cap: E.cap, pitch: E.pitch ?? 0, parapet: E.parapet ?? 0 };
}
