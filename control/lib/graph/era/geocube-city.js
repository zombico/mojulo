/**
 * A GEOCUBE'S MICRO-CITY — the geocube kind's `show: 'city'`: a city plan (city/plan/) on the smallest board that makes
 * a block round a street crossing, built in the cube's builders' language (its buildings' anchor, or its domain's
 * town's) on the cube's base kit when that kit has structure rails, painted wholly by the cube (`paint.geocube` at
 * amount 1), no cars, no people. A showcase: the dummy (local-meru/dummy.js) walks the sidewalk round the block nearest
 * its core, at a person's height, so the city's architecture is seen at eye level. At an `hour` (its domain's, unless
 * it names its own) and under `clouds` the cube lights it as it lights its land (city/plan/look.js cubeLookSpec): the
 * moon and the lit windows past dusk, the hour's dome and air, the clouds round it. Kept apart from geocube.js: the
 * city's modules read the cube.
 *
 *   MICRO_CITY              the board and the dials a micro-city is laid on
 *   geocubeCity(manifest)   the geocube kind's manifest (show 'city') → { city: a city manifest, cube, pick, anchor }
 *   withSidewalkCamera(p)   the city seen first from its sidewalk, at a person's eye, along the block's facades
 */
import { readGeocube, readDomainAsk, geocubeTown, cubeBuildings } from './geocube.js';
import { hasStructureRails } from './out-structures.js';
import { civilizationGrammar } from '../city/plan/civilization.js';

// (the paint all the way: a city's skins wholly the cube's stone, trim and accent, so its architecture is reviewed in the
// cube's colours; a game's city level leans halfway, city/plan/look.js)
export const MICRO_CITY = Object.freeze({ board: Object.freeze({ cols: 2, rows: 2 }), cars: false, people: 0, amount: 1 });
const KEYS = ['kind', 'cube', 'show', 'title', 'walk', 'seed', 'domain', 'hour', 'clouds', 'materials'];
const no = (msg) => { throw new Error(`geocube: ${msg}`); };

/** The micro-city a geocube's `show: 'city'` builds: its city manifest, and what it was built from. */
export function geocubeCity(manifest) {
  for (const k of Object.keys(manifest)) {
    if (k === 'weather') no('weather is the land\'s live channel; a micro-city takes its sky as clouds (clear, fair, overcast, storm, haze, high)');
    if (!KEYS.includes(k)) no(`'${k}' is not a setting of the geocube kind's city (cube, seed, domain, hour, clouds, materials)`);
  }
  if (manifest.seed !== undefined && !Number.isInteger(manifest.seed)) no('seed is an integer');
  const cube = readGeocube(manifest.cube ?? no('cube is a preset id or a document')), seed = manifest.seed ?? 1;
  const pick = manifest.domain === undefined ? null : readDomainAsk(cube, manifest.domain);
  if (pick && pick.domain.side !== 'outside') no('the domain is inside: show \'room\' (a city stands outside)');
  // the builders' language: the domain's town's, else the cube's buildings', else the timber hall
  const anchor = (pick?.domain.settlement !== undefined ? geocubeTown(cube, pick.domain).anchor : undefined) ?? cubeBuildings(cube)?.anchor ?? 'timber-hall';
  const kit = hasStructureRails(cube.outside.base) ? cube.outside.base : 'isekai-meadow';
  // the hour: the recipe's, else its domain's
  const hour = manifest.hour ?? pick?.domain.hour;
  const paint = { geocube: manifest.cube, amount: MICRO_CITY.amount, ...(hour !== undefined ? { hour } : {}), ...(manifest.clouds !== undefined ? { clouds: manifest.clouds } : {}), ...(manifest.materials !== undefined ? { materials: manifest.materials } : {}) };
  const city = { kind: 'city', seed, board: { ...MICRO_CITY.board }, grammar: civilizationGrammar(anchor, kit, seed), paint, cars: MICRO_CITY.cars, people: MICRO_CITY.people };
  return { city, cube, pick, anchor };
}

/** The city's payload, its `sidewalk` camera first: a person's eye at the block ring's first corner, looking down its
 * first side and a little up, so the facades stand along it against the sky. In the city's units. */
export function withSidewalkCamera(p, { metersPerUnit }) {
  const R = p.route;
  if (!Array.isArray(R) || R.length < 2) return p;
  const [a, b] = R, d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(...d) || 1, u = 1 / metersPerUnit, r = (v) => Math.round(v * 1000) / 1000;
  // (stood out from the block by a step and a half, toward the street, so the facades rise beside the walk, not against it)
  const c = [R.reduce((s, q) => s + q[0], 0) / R.length, R.reduce((s, q) => s + q[1], 0) / R.length], o = [a[0] - c[0], a[1] - c[1]], ol = Math.hypot(...o) || 1, out = [(o[0] / ol) * 1.5 * u, (o[1] / ol) * 1.5 * u];
  const from = [a[0] - (d[0] / l) * 2 * u + out[0], a[1] - (d[1] / l) * 2 * u + out[1], 1.7 * u], to = [a[0] + (d[0] / l) * 30 * u, a[1] + (d[1] / l) * 30 * u, 6 * u];
  return { ...p, cameras: [{ name: 'sidewalk', worldFraming: { cameraPosition: from.map(r), lookAt: to.map(r), horizontalFov: 75 } }, ...p.cameras] };
}
