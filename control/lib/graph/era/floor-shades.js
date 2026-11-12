/**
 * WHY A FLOOR IS NOT ONE SHADE (a kit's `floorPlan`, era/stage.js; era/laws.js 'floor-is-laid', 'by-cause'): the same
 * stone, laid the same way, is seen in different shades across one room, and each shade has a cause. A part of a
 * floor names its cause and takes its shade from here: a tone (how much lighter or darker than the floor as laid) and
 * a hue (which way it leans), each a multiplier on the floor's own tint.
 *
 *   FLOOR_SHADES   { <cause>: { tone, hue: [r, g, b], why } }
 *     plain      the floor as laid
 *     worn       feet polish stone: the walk down a room, a threshold. Lighter
 *     unwalked   dust and grime lie where nobody steps: the course along a wall. Darker
 *     soot       flame blackens what stands under it: the apron round a tomb's candles, a hearth. Darker and warmer
 *     damp       water darkens stone and cools it: a low bay, a wall's foot. Darker and cooler
 *     relaid     a repair: newer slabs, paler and cleaner than their neighbours. Lighter and a little cooler
 *   floorShade(cause) → the row, or the plain one for a cause it does not know
 *   shadeTint(tint, cause) → the floor's tint in that shade (each channel held at 1)
 *
 * Data and two readers: nothing here draws.
 */
export const FLOOR_SHADES = Object.freeze({
  plain: Object.freeze({ tone: 1, hue: Object.freeze([1, 1, 1]), why: 'the floor as laid' }),
  worn: Object.freeze({ tone: 1.1, hue: Object.freeze([1, 1, 1]), why: 'feet polish stone: the walk down a room, a threshold' }),
  unwalked: Object.freeze({ tone: 0.84, hue: Object.freeze([1, 1, 1]), why: 'dust and grime lie where nobody steps: the course along a wall' }),
  soot: Object.freeze({ tone: 0.76, hue: Object.freeze([1.04, 0.98, 0.9]), why: 'flame blackens what stands under it: the apron round a tomb\'s candles' }),
  damp: Object.freeze({ tone: 0.8, hue: Object.freeze([0.94, 1, 1.04]), why: 'water darkens stone and cools it: a low bay, a wall\'s foot' }),
  relaid: Object.freeze({ tone: 1.16, hue: Object.freeze([0.98, 1, 1.03]), why: 'a repair: newer slabs, paler and cleaner than their neighbours' }),
});

export const floorShade = (cause) => FLOOR_SHADES[cause] || FLOOR_SHADES.plain;
export const shadeTint = (tint, cause) => { const S = floorShade(cause); return tint.map((v, k) => Math.round(Math.min(1, v * S.tone * S.hue[k]) * 1e5) / 1e5); };
