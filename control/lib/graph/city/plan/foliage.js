/**
 * FOLIAGE: the city's leaves through the year and in its world's colours.
 *
 *   season: 'spring' | 'summer' | 'autumn' | 'winter'   spring as grown (a cherry in bloom); summer its blossom gone to
 *                                                         leaf; autumn the deciduous crowns turned (orange, red, gold);
 *                                                         winter the deciduous bare. Evergreens keep theirs.
 *   paint: { geocube, amount }                            (look.js) leans every leaf toward the cube's foliage
 *
 * A leaf is told by its colour (green, or a blossom's pink) from the bark and wood it grows on (brown, grey, or a bark
 * tile): the grown faces carry no mark of their own, and the pool's other readers keep their bytes. Its light is kept:
 * a new colour takes the old one's lightness, so a crown stays shaded as it was baked. Pure; the change of colour is a
 * hash of the face's place in its template, never a die.
 */
import { hexToRgb, rgbToHex } from '../../polygonizer/vexar.js';

export const SEASONS = Object.freeze(['spring', 'summer', 'autumn', 'winter']);
/** The species that lose their leaves (the vegetation library's), and so turn and go bare. */
export const DECIDUOUS = Object.freeze(['oak', 'beech', 'cherry']);
const AUTUMN = ['#c8642a', '#d9952f', '#b8402a', '#e0b84a', '#9a5a2a', '#cf7a2c'];
const SUMMER = ['#4f7a3a', '#5e8a42', '#456d34'];

/** A recipe's `season`, checked → it, or null. */
export function readSeason(v) {
  if (v === undefined || v === null) return null;
  if (!SEASONS.includes(v)) throw new Error(`city: season is ${SEASONS.map((s) => `'${s}'`).join(' | ')} (got ${JSON.stringify(v)})`);
  return v;
}

const lum = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
/** Is this face a leaf (or a petal)? Green, or a blossom's pink; never a textured bark face. */
export function isLeaf(f) {
  if (!f || f.texture || typeof f.fill !== 'string' || f.fill[0] !== '#') return false;
  const [r, g, b] = hexToRgb(f.fill);
  return (g > r + 6 && g >= b) || blossomRgb(r, g, b);
}
// a blossom's hue at any lightness (a petal in the crown's shade is a dull mauve): red over green, blue not under it; a
// bark or a twig is brown or grey, its blue under its green
const blossomRgb = (r, g, b) => r > g + 8 && b >= g - 2;
const isBlossom = (f) => blossomRgb(...hexToRgb(f.fill));
// a colour from a palette at the old colour's lightness (the baked shade kept)
const relight = (fill, hex) => { const c = hexToRgb(hex), k = Math.max(0.35, Math.min(1.6, lum(hexToRgb(fill)) / Math.max(0.05, lum(c)))); return rgbToHex(c.map((v) => Math.min(255, v * k))); };
const mixHex = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex(A.map((v, i) => v + (B[i] - v) * t)); };

/** A template's faces in a season and a paint: [faces] (leaves dropped in a deciduous winter, recoloured otherwise). */
export function seasonFaces(faces, { season = null, deciduous = false, foliage = null, amount = 0 } = {}) {
  if (!season && !(foliage && amount > 0)) return faces;
  const out = [];
  faces.forEach((f, i) => {
    if (!isLeaf(f)) { out.push(f); return; }
    if (deciduous && season === 'winter') return;
    let fill = f.fill;
    if (deciduous && season === 'autumn') fill = relight(fill, AUTUMN[(i * 2654435761 >>> 0) % AUTUMN.length]);
    else if (season === 'summer' && isBlossom(f)) fill = relight(fill, SUMMER[(i * 2654435761 >>> 0) % SUMMER.length]);
    if (foliage && amount > 0 && !(deciduous && season === 'autumn')) fill = mixHex(fill, relight(fill, foliage), amount);
    out.push(fill === f.fill ? f : { ...f, fill });
  });
  return out;
}

/** A pool (vegetation/pool.js plantPool) with every variant's levels in a season and a paint. */
export function seasonPool(pool, opts) {
  if (!opts.season && !(opts.foliage && opts.amount > 0)) return pool;
  const deciduous = DECIDUOUS.includes(pool.species);
  return { ...pool, variants: pool.variants.map((v) => (v.levels ? { ...v, levels: Object.fromEntries(Object.entries(v.levels).map(([l, fs]) => [l, seasonFaces(fs, { ...opts, deciduous })])) } : v)) };
}
