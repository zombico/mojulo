/**
 * A GEOCUBE'S MICRO-CITY — the geocube kind's `show: 'city'`: a city plan (city/plan/) on the smallest board that makes
 * a block round a street crossing, built in the cube's builders' language (its buildings' anchor, or its domain's
 * town's) on the cube's base kit when that kit has structure rails, painted wholly by the cube (`paint.geocube` at
 * amount 1), no cars, no people. A showcase: the dummy (local-meru/dummy.js) walks the sidewalk round the block nearest
 * its core, at a person's height, so the city's architecture is seen at eye level. Kept apart from geocube.js: the
 * city's modules read the cube.
 *
 *   MICRO_CITY              the board and the dials a micro-city is laid on
 *   geocubeCity(manifest)   the geocube kind's manifest (show 'city') → { city: a city manifest, cube, pick, anchor }
 */
import { readGeocube, readDomainAsk, geocubeTown, cubeBuildings } from './geocube.js';
import { hasStructureRails } from './out-structures.js';
import { civilizationGrammar } from '../city/plan/civilization.js';

// (the paint all the way: a city's skins wholly the cube's stone, trim and accent, so its architecture is reviewed in the
// cube's colours; a game's city level leans halfway, city/plan/look.js)
export const MICRO_CITY = Object.freeze({ board: Object.freeze({ cols: 2, rows: 2 }), cars: false, people: 0, amount: 1 });
const KEYS = ['kind', 'cube', 'show', 'title', 'walk', 'seed', 'domain'];
const no = (msg) => { throw new Error(`geocube: ${msg}`); };

/** The micro-city a geocube's `show: 'city'` builds: its city manifest, and what it was built from. */
export function geocubeCity(manifest) {
  for (const k of Object.keys(manifest)) {
    if (k === 'hour' || k === 'clouds' || k === 'weather') no(`${k} lights a cube's land; a city is lit by its cube's look (show 'land', 'trail' or 'town' for ${k})`);
    if (!KEYS.includes(k)) no(`'${k}' is not a setting of the geocube kind's city (cube, seed, domain)`);
  }
  if (manifest.seed !== undefined && !Number.isInteger(manifest.seed)) no('seed is an integer');
  const cube = readGeocube(manifest.cube ?? no('cube is a preset id or a document')), seed = manifest.seed ?? 1;
  const pick = manifest.domain === undefined ? null : readDomainAsk(cube, manifest.domain);
  if (pick && pick.domain.side !== 'outside') no('the domain is inside: show \'room\' (a city stands outside)');
  // the builders' language: the domain's town's, else the cube's buildings', else the timber hall
  const anchor = (pick?.domain.settlement !== undefined ? geocubeTown(cube, pick.domain).anchor : undefined) ?? cubeBuildings(cube)?.anchor ?? 'timber-hall';
  const kit = hasStructureRails(cube.outside.base) ? cube.outside.base : 'isekai-meadow';
  const city = { kind: 'city', seed, board: { ...MICRO_CITY.board }, grammar: civilizationGrammar(anchor, kit, seed), paint: { geocube: manifest.cube, amount: MICRO_CITY.amount }, cars: MICRO_CITY.cars, people: MICRO_CITY.people };
  return { city, cube, pick, anchor };
}
