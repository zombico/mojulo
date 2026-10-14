/**
 * THE ADAPTERS — a solved palette (solve.js) written into the shapes the rest of mojulo already reads, so nothing
 * downstream changes its own:
 *
 *   gameTheme(contract)              → a game's `theme` tokens { accent, accent2, ink, bg, panel, line } (game-manifest.js)
 *   coverPalette(contract)           → a cover's `artDirection.palette` { bg, accent, ink } (cover-manifest.js)
 *   landSwatches(contract, swatches) → a kit's swatches { land, made, accent } (era/style/swatches.js) at the base kit's
 *                                      own ramp lengths, so its tile windows still index inside them
 *   lightOf(contract, sky)           → the card's sky light { key.color, ambient } in the palette's temperature
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
