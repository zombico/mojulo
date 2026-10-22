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
 *   toneRamps(contract, names)       → a stage tone's ramps by the preset's own names, and where its middle light sits (era/tone.js)
 *   pixelPalette(contract, budget)   → a pixelizer palette at a register's budget (3 / 15 / 61 colours, darkest roles first)
  *   lookCard(card, contract)         → a sixth-gen reference card (era/sixth-gen.js) in the palette: its palette, light and air
 *   skinDirection(contract, shading) → a character's skin and light in the game's art direction: the dermis's `shade`
 *                                      (its depth by the key and the weight, its colour the palette's fill, its bands the
 *                                      shading's) and the light { key, fill, rim, exposure } a preview or an engine lights it by
 *   natureColours(contract)          → a nature or jungle stage's `palette` data (color-theorist/recolour.js reads it)
 *   cubeColours(contract)            → a geocube's key colours, its tone's key, its moon and its sky (era/geocube.js)
 *
 * Pure.
 */
import { rampOf, rampNear } from './solve.js';
import { oklch, lchOf, hexToRgb, rgbToHex, mixHue } from './oklab.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
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

/** The fill: the sky's light between the sky's hue and the shadow's at lightness L; in vacuum there is no sky to fill
 * the shade, only the planet's light, dark and in its hue. */
function fillOf(K, L) {
  const [, , sh] = lchOf(hexToRgb(K.shadow));
  if (K.read.air === 'none') return rgbToHex(oklch(Math.min(L, 0.3), 0.045, sh));
  const [, , skyH] = lchOf(hexToRgb(K.roles.sky[2]));
  return rgbToHex(oklch(L, 0.07, mixHue(skyH, sh, 0.5)));
}

/** The sun's colour the palette's light; the sky's fill between the sky and the palette's shadow. */
export function lightOf(K, light) {
  return { ...light, key: { ...light.key, color: K.light }, ambient: fillOf(K, 0.74) };
}

/**
 * THE SHADINGS a game designer names (with the palette, the art direction): how the skin's shade is painted.
 *   painted   smooth, as a painted texture carries its light
 *   cel       three hard bands (a toon's shade)
 *   graphic   two bands, deeper (a comic's ink-and-flat)
 *   chiaroscuro  painted, and a near-black only where the skin is enclosed deepest (the `deep` curve)
 *   none      no shade painted (an engine that lights and occludes for itself)
 */
export const SKIN_SHADINGS = Object.freeze({ painted: { steps: 0, k: 1 }, cel: { steps: 3, k: 1 }, graphic: { steps: 2, k: 1.25 }, chiaroscuro: { steps: 0, k: 1, curve: 'deep' }, none: null });
const SHADE_BY_KEY = { high: 0.35, mid: 0.55, low: 0.75 }, EXPOSURE_BY_KEY = { high: 1.08, mid: 1, low: 0.82 };
/** A character's skin and light in the palette (see the head of the file). → { shade?: { amount, colour, steps }, light } */
export function skinDirection(K, shading = 'painted') {
  if (!(shading in SKIN_SHADINGS)) throw new Error(`skinDirection: shading is one of ${Object.keys(SKIN_SHADINGS).join(', ')}`);
  const S = SKIN_SHADINGS[shading], key = K.read.key || 'mid', w = K.read.weight || 0;
  const amount = S ? r3(Math.max(0.15, Math.min(1, (SHADE_BY_KEY[key] + 0.15 * w) * S.k))) : 0;
  return {
    ...(S ? { shade: { amount, colour: fillOf(K, 0.5), steps: S.steps, ...(S.curve ? { curve: S.curve } : {}) } } : {}),
    light: { key: K.light, fill: fillOf(K, 0.74), rim: K.roles.sky[3], exposure: EXPOSURE_BY_KEY[key] },
  };
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

// a tone ramp's name → the role it is drawn from (a preset's names: noir's night, flat's wall/floor/trim/accent, isekai's
// stone/floor/trim/green); a name the palette has no role for is drawn off the second accent, each turned further
const TONE_ROLE = { night: 'rock', wall: 'rock', stone: 'rock', floor: 'soil', trim: 'ground', accent: 'accent', green: 'foliage', wood: 'made' };
const TONE_KEY = { high: 0.62, mid: 0.5, low: 0.34 };
/** A stage tone (era/tone.js) from the palette: its ramps, by the names the preset gives them, as five hex stops shadow
 * to light; and the tone's `key` (where the middle light lands) from the palette's. → { ramps, key } */
export function toneRamps(K, names) {
  let extra = 0;
  const ramps = Object.fromEntries(names.map((n) => [n, (TONE_ROLE[n] ? rampOf(K, TONE_ROLE[n], 5) : rampNear(K, 'accent2', 5, (extra++) * 40)).map(rgbToHex)]));
  return { ramps, key: TONE_KEY[K.read.key] };
}

// a register's palette: which stops of which roles, by budget (8bit a dark, a middle and the accent; 16bit the land's
// values and two of the accent's; 32bit every stop of every role and the light)
const PIXEL_PICKS = {
  3: [['ground', 0], ['ground', 3], ['accent', 2]],
  15: [['ground', 0], ['ground', 2], ['ground', 4], ['foliage', 1], ['foliage', 3], ['sky', 2], ['sky', 4], ['rock', 1], ['rock', 3], ['soil', 1], ['soil', 3], ['made', 2], ['accent', 1], ['accent', 3], ['accent2', 2]],
};
/** A pixelizer palette (pixelizer/cutscene.js budgets) from the palette: '#rrggbb' × at most `budget`, no repeats. */
export function pixelPalette(K, budget) {
  const picks = PIXEL_PICKS[budget] ?? [...Object.keys(K.roles).flatMap((r) => [0, 1, 2, 3, 4].map((i) => [r, i])), ['light']];
  const out = [...new Set(picks.map(([r, i]) => (r === 'light' ? K.light : K.roles[r][i])))];
  return out.slice(0, budget);
}

/** A sixth-gen reference card recoloured: its palette (the ground, the accent, the light), its light (the fill a mix of
 * the sky and the shadow, the key the palette's light where the card has a sun), its air (the fog the far layers', the
 * dome the sky's). The card's placements, contrast and setting are kept. */
export function lookCard(card, K) {
  const rgb = (h) => hexToRgb(h), [, , skyH] = lchOf(rgb(K.roles.sky[2])), [, , sh] = lchOf(rgb(K.shadow));
  return {
    ...card,
    palette: { base: K.roles.ground[2], accent: K.roles.accent[2], warm: K.light },
    light: { ...card.light, ambient: K.read.air === 'none' ? fillOf(K, 0.24) : rgbToHex(oklch(K.read.key === 'low' ? 0.32 : 0.62, 0.06, mixHue(skyH, sh, 0.5))), ...(card.light.key ? { key: { ...card.light.key, color: K.light } } : {}) },
    air: { ...card.air, fog: { ...card.air.fog, color: K.fog }, dome: { zenith: rgb(K.roles.sky[1]), horizon: rgb(K.roles.sky[4]) } },
  };
}

/** A nature or jungle stage's palette, as the data its builder reads (color-theorist/recolour.js): each role's middle
 * stop, the water the sky sunk, the light, the fill, the fog, the sky's zenith and horizon, the key. */
export function natureColours(K) {
  const [, , skyH] = lchOf(hexToRgb(K.roles.sky[2])), [, , sh] = lchOf(hexToRgb(K.shadow));
  const mid = (r) => K.roles[r][2];
  return {
    palette: K.id, key: K.read.key,
    roles: { ground: mid('ground'), soil: mid('soil'), rock: mid('rock'), foliage: mid('foliage'), bark: mid('bark'), accent: mid('accent'), far: mid('far'), water: rgbToHex(rampNear(K, 'sky', 5, 0, { dL: -0.3 })[2]) },
    light: K.light, ambient: K.read.air === 'none' ? fillOf(K, 0.3) : rgbToHex(oklch(K.read.key === 'low' ? 0.5 : 0.72, 0.07, mixHue(skyH, sh, 0.5))), fog: K.fog,
    sky: { zenith: hexToRgb(K.roles.sky[1]), horizon: hexToRgb(K.roles.sky[4]) },
    ...(K.read.air && K.read.air !== 'full' ? { air: K.read.air } : {}),
  };
}

/**
 * A geocube's colours (era/geocube.js) from the palette: the stone its rock, the floor its soil, the trim its made
 * things lifted and quieter, the accent the accent, the grass its ground, the foliage its foliage, the
 * water the sky sunk (as the nature stage's), the sand the soil's light end, and `shade` the hue of the palette's
 * shadow, which every ramp's dark end leans to. The tone's key is where the palette's middle light sits; the moon is
 * the palette's light (a moonlit palette's is cool); the sky is the sky ramp's zenith and horizon, and the fog.
 * → { colour, key, moon, sky: { zenith, horizon, fog } }
 */
export function cubeColours(K) {
  const mid = (r) => K.roles[r][2];
  const colour = {
    stone: mid('rock'), floor: mid('soil'), trim: rgbToHex(rampNear(K, 'made', 5, 0, { dL: 0.08, kC: 0.7 })[2]),
    accent: mid('accent'), grass: mid('ground'), foliage: mid('foliage'),
    water: rgbToHex(rampNear(K, 'sky', 5, 0, { dL: -0.3 })[2]), sand: K.roles.soil[3],
    shade: Math.round(lchOf(hexToRgb(K.shadow))[2]) % 360,
  };
  return { colour, key: TONE_KEY[K.read.key], moon: K.light, sky: { zenith: K.roles.sky[1], horizon: K.roles.sky[4], fog: K.fog } };
}
