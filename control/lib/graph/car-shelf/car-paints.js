/**
 * car-paints — the colours a car is sold in, by the language's time (its palette), and how each is finished. A
 * composition names a colour (any palette's, by name, or a hex), or its seed picks one from its language's palette; a
 * scheme lays a second colour on its roof (and pillars) or on its upper body.
 *
 *   CAR_PALETTES        palette → [{ name, hex, finish }]
 *   PAINT_FINISHES      solid | metallic | pearl: the paint slot's response (vehicle-surface-finish.js's terms)
 *   PAINT_SCHEMES       mono | roof | split
 *   readPaint(paint, { palette, seed }) → { body, second, scheme, finish, name }
 *
 * Pure: the seed's dice are mulberry32's.
 */
import { mulberry32 } from '../vegetation/grow.js';

const c = (name, hex, finish = 'metallic') => Object.freeze({ name, hex, finish });
export const CAR_PALETTES = Object.freeze({
  chrome: Object.freeze([c('seafoam', '#8fc9b9', 'solid'), c('cream', '#efe6cc', 'solid'), c('coral', '#df6f66', 'solid'), c('turquoise', '#3fa3ab', 'solid'), c('robin', '#8cb8d8', 'solid'), c('fire red', '#a3262a', 'solid'), c('onyx', '#141416', 'solid')]),
  wedge: Object.freeze([c('silver', '#b4b8bc'), c('maroon', '#5e1f24'), c('champagne', '#c9b691'), c('chocolate', '#5b4636', 'solid'), c('alpine white', '#e8e6df', 'solid'), c('navy', '#1f2b46'), c('signal red', '#b0241f', 'solid')]),
  jellybean: Object.freeze([c('teal', '#2e7d7a'), c('forest', '#28483a'), c('plum', '#4d3463'), c('quicksilver', '#aeb2b6'), c('white', '#e9e8e2', 'solid'), c('cherry', '#9d1f2a')]),
  current: Object.freeze([c('glacier white', '#e9eae8', 'solid'), c('obsidian', '#121315'), c('graphite', '#5f6368'), c('moonstone', '#a9adb1'), c('deep blue', '#1d3557'), c('crimson', '#9e1b1f'), c('steel blue', '#2f5d8a')]),
  aero: Object.freeze([c('pearl', '#eeeef0', 'pearl'), c('cloud grey', '#8d9196'), c('void', '#141519'), c('ice blue', '#bcd3e0', 'pearl'), c('midnight', '#20263a')]),
  rugged: Object.freeze([c('olive', '#5a6142', 'solid'), c('sand', '#c2ac83', 'solid'), c('chalk', '#e4e2da', 'solid'), c('tar', '#1a1b1c', 'solid'), c('rust orange', '#c96a24', 'solid'), c('pine', '#2f4a35')]),
  cute: Object.freeze([c('mint', '#bfe3cf', 'solid'), c('butter', '#f2df9a', 'solid'), c('rose', '#efb7b5', 'solid'), c('sky', '#b9d7ee', 'solid'), c('milk', '#f1efe8', 'solid'), c('lilac', '#cbb9e0', 'solid')]),
});
export const PALETTE_IDS = Object.freeze(Object.keys(CAR_PALETTES));

/** The paint slot's response by finish (ROAD_MATERIALS.paint is the metallic one). */
export const PAINT_FINISHES = Object.freeze({
  solid: Object.freeze({ metalness: 0.04, roughness: 0.34, clearcoat: 0.8, clearcoatRoughness: 0.14 }),
  metallic: Object.freeze({ metalness: 0.42, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.12 }),
  pearl: Object.freeze({ metalness: 0.28, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 }),
});
export const PAINT_SCHEMES = Object.freeze({ mono: 'one colour', roof: 'a second colour on the roof and its pillars', split: 'a second colour above the shoulder line' });

const HEX = /^#[0-9a-f]{6}$/i;
const byName = new Map(Object.values(CAR_PALETTES).flat().map((p) => [p.name, p]));
export const PAINT_NAMES = Object.freeze([...byName.keys()]);
const colourOf = (word) => {
  if (HEX.test(word)) return { name: word.toLowerCase(), hex: word.toLowerCase(), finish: null };
  const p = byName.get(word);
  if (!p) throw new Error(`car-shelf: a paint is a hex ('#a3262a') or one of ${PAINT_NAMES.join(', ')}`);
  return p;
};

/** A composition's paint: a colour word or { colour?, second?, scheme?, finish? }. */
export function readPaint(paint, { palette = 'current', seed = 1 } = {}) {
  const P = typeof paint === 'string' ? { colour: paint } : paint ?? {};
  if (typeof P !== 'object' || Array.isArray(P)) throw new Error('car-shelf: paint is a colour or { colour?, second?, scheme?, finish? }');
  for (const k of Object.keys(P)) if (!['colour', 'second', 'scheme', 'finish'].includes(k)) throw new Error(`car-shelf: paint takes colour, second, scheme and finish (not ${k})`);
  if (P.scheme !== undefined && !PAINT_SCHEMES[P.scheme]) throw new Error(`car-shelf: a paint scheme is one of ${Object.keys(PAINT_SCHEMES).join(', ')}`);
  if (P.finish !== undefined && !PAINT_FINISHES[P.finish]) throw new Error(`car-shelf: a paint finish is one of ${Object.keys(PAINT_FINISHES).join(', ')}`);
  const list = CAR_PALETTES[palette], rnd = mulberry32((seed * 2654435761 + 11) >>> 0);
  const pick = list[Math.floor(rnd() * list.length)];
  const body = P.colour !== undefined ? colourOf(P.colour) : pick;
  const scheme = P.scheme ?? (P.second !== undefined ? 'roof' : 'mono');
  // (a second colour unnamed: the palette's lightest for a dark body, its darkest for a light one)
  const lum = (h) => [1, 3, 5].reduce((s, i) => s + parseInt(h.slice(i, i + 2), 16), 0);
  const contrast = [...list].sort((a, b) => lum(a.hex) - lum(b.hex))[lum(body.hex) > 380 ? 0 : list.length - 1];
  const second = scheme === 'mono' ? null : (P.second !== undefined ? colourOf(P.second) : contrast).hex;
  return { name: body.name, body: body.hex, second, scheme, finish: P.finish ?? body.finish ?? 'metallic' };
}
