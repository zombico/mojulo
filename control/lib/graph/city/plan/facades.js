/**
 * THE CITY'S FACADES: what each lot wears, laid over the plan and never into it. A lot's skin is the legacy metro city's
 * own (fractal-city.js metroSkins: a material's family and shade, a stone rhythm, a roof), then its grammar's
 * affectations through the legacy city's own `flavorFacade` (a roof cap, balconies, fire escapes, rooftop kit, awnings,
 * shopfronts, signs, blade signs), then the grammar's `wear` (every lot), then the lot's own `facade` (that lot). The
 * scene (scene.js) hands the result to the same facade pipeline the legacy city renders through
 * (scene-css3d.js assembleBoxCityScene), so a Paris street here and there is one Paris street.
 *
 * This layer rolls its own dice, one stream per lot (`${seed}|facade-v1|<lot id>`): a facade tuned, a grammar's look
 * reworded, never moves a street, a lot or a storey.
 *
 * A facade descriptor (the building generator's: architecture/building-facade.js makeFacade) is the unit a caller
 * writes by hand; FACADE_FIELDS is what it may say.
 */
import { flavorFacade, CITY_METERS_PER_UNIT } from '../fractal-city.js';
import { scaleHex } from '../../polygonizer/vexar.js';
import { facadeMetalError } from '../../architecture/facade-card.js';
import { streamOf } from './dice.js';

const U = CITY_METERS_PER_UNIT;
const HEX = /^#[0-9a-f]{6}$/i;
const hex = (v) => typeof v === 'string' && HEX.test(v);
const oneOf = (xs) => (v) => xs.includes(v);
const bool = (v) => typeof v === 'boolean';
const between = (lo, hi) => (v) => typeof v === 'number' && v >= lo && v <= hi;

export const ROOFTOP_KIT = Object.freeze(['mechanical', 'antenna', 'cell-tower', 'water-tank', 'wood-tank', 'satellite-dish', 'smoke-stack', 'billboard']);
/** What a facade descriptor may say: { field: [test, words] }. The colours are hex; the rest are the generator's own words. */
export const FACADE_FIELDS = Object.freeze({
  material: [oneOf(['glass', 'stone', 'brick', 'concrete', 'metal']), "'glass' | 'stone' | 'brick' | 'concrete' | 'metal'"],
  glass: [hex, "'#rrggbb' (glass's panes; stone and brick's dark windows)"],
  frame: [hex, "'#rrggbb' (glass's mullions; stone and brick's body)"],
  roof: [hex, "'#rrggbb'"],
  rhythm: [oneOf(['curtain', 'grid', 'banded', 'pier', 'punched']), "'curtain' | 'grid' | 'banded' | 'pier' | 'punched'"],
  crown: [oneOf(['none', 'parapet', 'screen']), "'none' | 'parapet' | 'screen'"],
  podium: [bool, 'true or false'],
  balcony: [bool, 'true or false'],
  balconyType: [oneOf(['slab', 'vertical-rail', 'french', 'partitioned', 'continuous']), "'slab' | 'vertical-rail' | 'french' | 'partitioned' | 'continuous'"],
  balconyBays: [oneOf(['all', 'alt', 'col']), "'all' | 'alt' | 'col'"],
  loggia: [bool, 'true or false'],
  fireEscape: [bool, 'true or false (brick only)'],
  awning: [bool, 'true or false'],
  awningTint: [hex, "'#rrggbb'"],
  storefront: [bool, 'true or false'],
  storefrontTint: [hex, "'#rrggbb'"],
  storefrontTrim: [hex, "'#rrggbb'"],
  sign: [(v) => v === null || hex(v), "'#rrggbb' or null"],
  mullion: [between(0.5, 3), 'a number 0.5–3'],
  glassVar: [between(0.8, 1.2), 'a number 0.8–1.2'],
  rooftopKit: [(v) => Array.isArray(v) && v.every((k) => ROOFTOP_KIT.includes(k)), `a list of ${ROOFTOP_KIT.join(', ')}`],
  metal: [(v) => !facadeMetalError({ metal: v }), "{ metal, finish } (a metal facade's panels)"],
});

/** A hand-written facade descriptor held to FACADE_FIELDS, refused by name. → the descriptor as given. */
export function readFacade(f, at) {
  if (!f || typeof f !== 'object' || Array.isArray(f)) throw new Error(`city: ${at} is a facade { ${Object.keys(FACADE_FIELDS).join(', ')} }`);
  for (const [k, v] of Object.entries(f)) {
    const row = FACADE_FIELDS[k];
    if (!row) throw new Error(`city: ${at}.${k} is not a facade field (${Object.keys(FACADE_FIELDS).join(', ')})`);
    if (!row[0](v)) throw new Error(`city: ${at}.${k} is ${row[1]} (got ${JSON.stringify(v)})`);
  }
  return f;
}

/** The mass shapes a lot may stand as; a grammar's `shapes` weighs them (towers keep their own). */
export const MASS_SHAPES = Object.freeze(['box', 'setback', 'podium', 'cylinder']);

/**
 * One lot's skin, in the legacy city's skin shape (city units where it measures), and the shape its mass stands as.
 * → { skin, shape }
 */
export function skinLot(lot, G, seed) {
  const r = streamOf(seed, 'facade', lot.id);
  const material = lot.skin;
  const fams = G.skin[material] || G.skin.stone, fam = fams[Math.floor(r() * fams.length)], shade = 0.94 + r() * 0.12;
  const skin = {
    material, glass: scaleHex(fam[0], shade), frame: scaleHex(fam[1], shade),
    ...(material === 'stone' ? { rhythm: G.skin.stoneRhythm ? G.skin.stoneRhythm[Math.floor(r() * G.skin.stoneRhythm.length)] : (r() < 0.6 ? 'punched' : 'pier') } : {}),
    roof: G.skin.roof[Math.floor(r() * G.skin.roof.length)],
  };
  // the grammar's affectations, as the legacy city lays them (a tower keeps its curtainwall, as there)
  if (G.facade && !lot.tower) flavorFacade(skin, G.facade, material, lot.floors, Math.min(lot.x1 - lot.x0, lot.y1 - lot.y0) / U, r);
  // the plan already said which lots open a shop on the street (the walk's beats): the facade wears what the plan counted
  skin.storefront = !!lot.shopfront;
  if (G.wear) Object.assign(skin, G.wear);
  if (lot.facade) Object.assign(skin, lot.facade);
  if (skin.material !== 'brick') skin.fireEscape = false;
  // the mass's shape: a tower its own; a lot by its grammar's weights, a slender one only where it is tall enough
  let shape = lot.tower ? lot.shape : 'box';
  if (!lot.tower && G.shapes && lot.floors >= (G.shapes.minFloors ?? 6)) {
    const w = MASS_SHAPES.map((s) => G.shapes[s] ?? 0), tot = w.reduce((a, b) => a + b, 0);
    if (tot > 0) { let u = r() * tot; shape = MASS_SHAPES[w.findIndex((x) => (u -= x) < 0)] ?? 'box'; }
  }
  return { skin, shape };
}
