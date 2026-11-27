/**
 * THE BOX ON ITS GEOCUBE (docs/metroidvania-map.md "The box on its geocube"): a metroidvania box takes its look from the
 * cube its level is painted by, as a side strip and a geotown do, so a game's world says one style and its box agrees
 * with it. A cube's `box` (era/geocube.js) names a LIBRARY (themes.js BOX_THEMES: the castle's, the planet's), the
 * places, pieces, locales and night ring by ring; the cube supplies the rest:
 *
 *   colour    each ring's look tinted toward the cube's colour by role (back, stone and mortar toward its stone, the
 *             tops toward its floor, the trim toward its trim, a carpet toward its accent), its hue and saturation moved
 *             by `tint` (0 the library's own, 1 the cube's hue), its LIGHTNESS kept: the light pools, the walk reads and
 *             the rings stand apart as the library was laid to
 *   crystals  the cube's `outside.crystals` (local-meru/crystals.js): the gem every ring's druses are, and their glow
 *   rock      the box's `rock` (polygonizer/rock-minerals.js): what every ring's boulders are
 *
 * The look is resolved in one order: the box's words' `theme` (as written, byte for byte as it always was), else its
 * cube's `box`, else none (the greybox).
 *
 *   BOX_TINT, BOX_TINT_ROLES
 *   boxLookOf(words, cube?) → { id, theme, from: 'words' | 'cube', cube? } | null   the look a box is dressed in
 *   cubeBoxTheme(cube)      → a theme: the cube's library in the cube's colour, gem and rock (the library itself, the
 *                             same object, where the cube changes nothing: tint 0, no crystals, no rock)
 *
 * Pure.
 */
import { readGeocube } from '../../era/geocube.js';
import { readCrystals } from '../../local-meru/crystals.js';
import { ROCK_PRESET_IDS } from '../../polygonizer/rock-minerals.js';
import { BOX_THEMES, BOX_THEME_IDS } from './themes.js';

/** how far a cube's hue moves its library's colours, unsaid */
export const BOX_TINT = 0.5;
/** which of the cube's colours each of a look's colours is tinted toward */
export const BOX_TINT_ROLES = Object.freeze({ back: 'stone', stone: 'stone', mortar: 'stone', top: 'floor', trim: 'trim', carpet: 'accent' });

const no = (m) => { throw new Error(`metroidvania: ${m}`); };
const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const rgbHex = (c) => `#${c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('')}`;
function hsl([r, g, b]) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1)), h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
function rgb([h, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m];
}
/** `hex` moved toward `to`'s hue and saturation by `k` (the short way round), its own lightness kept */
export function tintToward(hex, to, k) {
  if (!k) return hex;
  const [h0, s0, l0] = hsl(hexRgb(hex)), [h1, s1] = hsl(hexRgb(to)), dh = ((h1 - h0 + 540) % 360) - 180;
  return rgbHex(rgb([(h0 + dh * k + 360) % 360, s0 + (s1 - s0) * k, l0]));
}

/** The cube's library in the cube's colour, gem and rock. */
export function cubeBoxTheme(cube) {
  const C = typeof cube === 'string' || cube?.box === undefined || cube?.colour === undefined ? readGeocube(cube) : cube, box = C.box;
  if (!box) return null;
  const lib = BOX_THEMES[box.library];
  if (!lib) no(`the cube's box.library is ${BOX_THEME_IDS.join(' | ')} (themes.js)`);
  if (box.rock !== undefined && !ROCK_PRESET_IDS.includes(box.rock)) no(`the cube's box.rock is ${ROCK_PRESET_IDS.join(' | ')}`);
  const tint = box.tint ?? BOX_TINT, raw = C.outside?.crystals, crystals = raw ? readCrystals(raw) : null;
  if (!tint && !crystals && box.rock === undefined) return lib;
  const paint = (L) => {
    const o = { ...L };
    for (const [k, role] of Object.entries(BOX_TINT_ROLES)) if (typeof L[k] === 'string' && C.colour?.[role]) o[k] = tintToward(L[k], C.colour[role], tint);
    if (crystals) { o.gem = crystals.gem; if (typeof raw === 'object' && raw.glow !== undefined) o.glow = crystals.glow; }
    if (box.rock !== undefined) o.rock = box.rock;
    return Object.freeze(o);
  };
  return Object.freeze({ ...lib, name: `${lib.name}, on ${C.title ?? C.id}`, looks: Object.freeze(lib.looks.map(paint)), locales: Object.freeze(Object.fromEntries(Object.entries(lib.locales ?? {}).map(([id, L]) => [id, paint(L)]))) });
}

/** The look a box is dressed in: its words' theme, else its cube's box, else none. */
export function boxLookOf(words, cube) {
  if (words?.theme !== undefined) return { id: words.theme, theme: BOX_THEMES[words.theme], from: 'words' };
  if (cube === undefined || cube === null) return null;
  const C = readGeocube(cube);
  if (!C.box) return null;
  return { id: C.box.library, theme: cubeBoxTheme(C), from: 'cube', cube: C.id };
}
