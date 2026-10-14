/**
 * THE ADAPTERS — a solved palette (solve.js) written into the shapes the rest of mojulo already reads, so nothing
 * downstream changes its own:
 *
 *   gameTheme(contract)              → a game's `theme` tokens { accent, accent2, ink, bg, panel, line } (game-manifest.js)
 *   coverPalette(contract)           → a cover's `artDirection.palette` { bg, accent, ink } (cover-manifest.js)
 *   landSwatches(contract, swatches) → a kit's swatches { land, made, accent } (era/style/swatches.js) at the base kit's
 *                                      own ramp lengths, so its tile windows still index inside them
 *   lightOf(contract, sky)           → the card's sky light { key.color, ambient } in the palette's temperature
 *   interiorPalette(contract, card)  → a room's 60-30-10 { walls, trim, upholstery, rug, casework, accent } (interior/styles.js)
 *   artPalette(contract)             → a room stage's `art.palette` ramps and torch (era/art-direction.js)
 *
 * Pure.
 */
import { rampOf, rampNear } from './solve.js';
import { oklch, lchOf, hexToRgb, rgbToHex, mixHue } from './oklab.js';

export const gameTheme = (K) => ({ ...K.ui });

/** A cover: the world's hue, dark (or light in a high key) behind; the accent; ink that reads on it. */
export function coverPalette(K) {
  const light = K.read.key === 'high', ground = K.roles.ground[2], [, , h] = lchOf(hexToRgb(ground));
  const bg = light ? oklch(0.93, 0.03, h) : oklch(0.2, 0.04, h);
  return { bg: rgbToHex(bg), accent: K.ui.accent, ink: K.ui.ink };
}

// the kit's land ramps the palette has a role for; the rest (a blossom, fruit, a glow, gold, violet, a bamboo culm)
// are drawn off the second accent, each turned a little further round, the culm off the foliage
const LAND_ROLE = { grass: 'ground', soil: 'soil', rock: 'rock', foliage: 'foliage', bark: 'bark', far: 'far', sky: 'sky', cloud: 'cloud' };
const MADE_ROLE = { timber: 'made', rope: 'rope', paint: 'accent', moss: 'foliage', lens: 'accent2' };

/** A kit's swatches recoloured by the palette: every ramp kept at its length, the kit's accent ramp the accent's. */
export function landSwatches(K, sw) {
  const [accRamp] = sw.accent ?? ['paint', 1];
  const land = {}, made = {};
  let extra = 0;
  for (const [name, r] of Object.entries(sw.land ?? {})) {
    if (name === accRamp) land[name] = rampOf(K, 'accent', r.length);
    else if (LAND_ROLE[name]) land[name] = rampOf(K, LAND_ROLE[name], r.length);
    else if (name === 'culm') land[name] = rampNear(K, 'foliage', r.length, 24);
    else { land[name] = rampNear(K, 'accent2', r.length, extra * 40); extra += 1; }
  }
  for (const [name, r] of Object.entries(sw.made ?? {})) {
    if (!Array.isArray(r)) { made[name] = r; continue; }   // an alias ('stone' → the rock ramp)
    made[name] = name === accRamp ? rampOf(K, 'accent', r.length) : MADE_ROLE[name] ? rampOf(K, MADE_ROLE[name], r.length) : rampNear(K, 'accent2', r.length, (extra++) * 40);
  }
  return { ...sw, land, made, accent: sw.accent };
}

/** The sun's colour the palette's light; the sky's fill between the sky and the palette's shadow. */
export function lightOf(K, light) {
  const [, , skyH] = lchOf(hexToRgb(K.roles.sky[2])), [, , sh] = lchOf(hexToRgb(K.shadow));
  return { ...light, key: { ...light.key, color: K.light }, ambient: rgbToHex(oklch(0.74, 0.07, mixHue(skyH, sh, 0.5))) };
}

// an interior's casework the card gives as a material (a wood, a metal, concrete) stays that material: the palette
// paints what is painted
const MATERIAL_WORDS = new Set(['white-oak', 'oak', 'walnut', 'teak', 'ashwood', 'birch', 'blackened-steel', 'concrete', 'chrome', 'nickel', 'brass', 'bronze']);
// the room's values by key: the walls carry the 60 (light and quiet, or dark and moody in a low key)
const ROOM_KEY = {
  high: { walls: [0.93, 0.02], trim: [0.97, 0.008], upholstery: 0.78, rug: 0.84, casework: 0.62 },
  mid: { walls: [0.86, 0.035], trim: [0.95, 0.01], upholstery: 0.62, rug: 0.72, casework: 0.5 },
  low: { walls: [0.38, 0.05], trim: [0.25, 0.03], upholstery: 0.5, rug: 0.42, casework: 0.34 },
};
/**
 * A room's 60-30-10 (interior/styles.js palette) from the palette: the walls in the world's hue, quiet; the trim toward
 * the light (or the shadow, in a low key); the upholstery the made things' hue, the rug the foliage's, the casework the
 * made things' unless the card's is a material; the accent the accent. → { walls, trim, upholstery, rug, casework, accent }
 */
export function interiorPalette(K, cardPalette = {}) {
  const R = ROOM_KEY[K.read.key], hue = (role) => lchOf(hexToRgb(K.roles[role][2])), [, , hA] = hue('ground');
  const [, cM, hM] = hue('made'), [, cF, hF] = hue('foliage'), [, , hL] = lchOf(hexToRgb(K.light)), [, , hS] = lchOf(hexToRgb(K.shadow));
  const hex = (L, C, h) => rgbToHex(oklch(L, C, h));
  return {
    walls: hex(R.walls[0], R.walls[1], hA),
    trim: hex(R.trim[0], R.trim[1], K.read.key === 'low' ? hS : hL),
    upholstery: hex(R.upholstery, Math.max(0.03, cM), hM),
    rug: hex(R.rug, Math.max(0.025, cF * 0.8), hF),
    casework: MATERIAL_WORDS.has(cardPalette.casework) ? cardPalette.casework : hex(R.casework, Math.max(0.02, cM * 0.7), hM),
    accent: K.roles.accent[2],
  };
}

/**
 * A room stage's art palette (era/art-direction.js `art.palette`: five-stop [r, g, b] ramps, darkest first, and the
 * torch): the stone the world's secondary, quiet; the floor its earth; the vault the stone, darker and quieter; the trim
 * the world's own hue; the wood its made things; the accent the accent; the torch a flame in the palette's light.
 */
export function artPalette(K) {
  const [, , hL] = lchOf(hexToRgb(K.light));
  return {
    family: `palette ${K.id}`,
    stone: rampOf(K, 'rock', 5),
    floor: rampOf(K, 'soil', 5),
    vault: rampNear(K, 'rock', 5, 10, { dL: -0.12, kC: 0.7 }),
    trim: rampNear(K, 'ground', 5, 0, { dL: 0.04, kC: 0.8 }),
    wood: rampOf(K, 'made', 5),
    accent: rampOf(K, 'accent', 5),
    light: oklch(0.74, 0.15, hL),
  };
}
