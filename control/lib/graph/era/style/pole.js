/**
 * THE POLE — a look's one decision about how everything in it is drawn, made once and read by every drawer:
 *
 *   banded    (absent: the isekai look) colour is a choice of ramp stop and light is a band — a face is one stop
 *   material  (the realistic pole) colour is the MATERIAL's: every surface is a pixel tile of its material, painted in
 *             the stops round its colour, and light only moves it — on a 3D page texel × baked light, on a plate the
 *             tile in the five stops round the face's lit stop
 *
 * Pixel-map the dirt and every asset is pixel-mapped: a building's walls, a machine's body, a tree's crown, a rock,
 * the town's paving — or the art style comes apart. So no drawer decides it; each asks `poleOf(kit)`.
 *
 * A surface's material is named by the RAMP its colour comes from (`materialOf(ramp)`: rock is a rock face, worked stone
 * is stone); what is a mark, a light or a
 * void (paint, lens, glow, the accent, an opening) stays flat. Past the far ring the texel is under the eye spot, and
 * the air carries the colour: far layers and clouds stay flat on either pole.
 *
 *   poleOf(kitOrCard)                          → 'banded' | 'material'
 *   materialOf(rampName)                       → a material (era/isekai-tiles.js MATERIALS) | null (flat)
 *   platePattern(defs, { stops, i, material, seed, px, kit, step })  → an SVG fill (`url(#…)`), its <pattern> put in `defs`
 *     (foliage on a look with a leaf die: its canopy skin, banded by `step`, the face's light)
 */
import { lookOf } from './looks.js';
import { materialBlocks } from '../isekai-tiles.js';

export const POLES = Object.freeze(['banded', 'material']);
export function poleOf(kit) {
  const card = typeof kit === 'string' ? lookOf(kit)?.card : kit;
  return card && card.pole === 'material' ? 'material' : 'banded';
}

const BY_RAMP = [
  [/^(rock|basalt|granite|far)$/, 'rockface'], [/^(stone|slate)$/, 'stone'], [/^(timber|bark|rope|thatch|wood)$/, 'grain'],
  [/^(foliage|moss|blossom|leaf|bloom)$/, 'leaf'], [/^(soil|grass|earth|dust)$/, 'dirt'],
];
const FLAT = /^(paint|lens|glow|accent|opening|sky|cloud|water|glass)$/;   // (metal is a material: plaster's scuffed smooth)
export function materialOf(ramp) {
  if (!ramp || FLAT.test(ramp)) return null;
  for (const [re, m] of BY_RAMP) if (re.test(ramp)) return m;
  return 'plaster';
}

/** The five stops round stop `i` of a ramp (the ends repeated): the window a plate's face is painted in. */
export const windowRound = (stops, i) => [-2, -1, 0, 1, 2].map((d) => stops[Math.max(0, Math.min(stops.length - 1, i + d))]);

/**
 * A face's fill on a plate, on the material pole: a <pattern> of its material's blocks in the window round its lit
 * stop, each block `px` pixels square (one: a block is a plate's pixel) (the texel sized to the plate: a plate is read at its own scale), drawn
 * pixelated. The pattern goes into `defs` (a Map, id → markup) once; the fill names it.
 */
export function platePattern(defs, { stops, i, material, seed = 'plate', px = 1, kit = null, step = 0 }) {
  // foliage on a look with a leaf die is its CANOPY: the die's skin in the band of the face's light (a stop up: lit, as
  // it is: the next, a stop down: the ground gone dark), as on the stage
  const die = material === 'leaf' && kit ? lookOf(kit)?.card?.trees?.die : null, band = Math.max(0, Math.min(3, 1 - step));
  if (die) material = 'canopy';
  const win = windowRound(stops, i), B = materialBlocks(material, win, seed, die ? { die, bandIndex: band } : {});
  const id = `m-${material}${die ? `-${die}${band}` : ''}-${win.map((c) => c.map((v) => v.toString(16).padStart(2, '0')).join('')).join('')}-${px}`.slice(0, 80);
  if (!defs.has(id)) defs.set(id, `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${B.W * px}" height="${B.H * px}"><image href="${B.url}" width="${B.W * px}" height="${B.H * px}" style="image-rendering:pixelated" preserveAspectRatio="none"/></pattern>`);
  return `url(#${id})`;
}
