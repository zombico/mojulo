/**
 * vehicle-registry/ride — the vehicle a quick game's hero drives, read through the registry at the game's tier.
 *
 * A quick game's `ride` is the hero (gameworld/ride.js). It names a registry row: by the legacy key of an assembled
 * ride (car | coupe | van, the rows sedan | coupe | minivan) or by the row's own id (a pickup, a box truck, a bus: any
 * row with a build that can be driven). The game's tier (`quick.tier`, stamped at mint from the tier read, tier.js) picks
 * the build:
 *
 *   assembly   the vehicle designer's assembled ride (the stylised build, minted as its own sketch, as it always was)
 *   loft       the class's realistic loft at its true numbers (car-designer/realistic.js), a figure the world compiles
 *              in place (nothing to mint), driven on its class's own row (roads/vehicles.js)
 *   cycle      a machine ridden astride, the cycle shelf's (cycle-shelf/): its rider seated on it, a figure the world
 *              compiles in place, driven on its archetype's class (a motorcycle, a quad, a tuk-tuk, a bicycle)
 *
 * A row with no build at the tier falls to the nearest one (said in `fell`): a pickup has no stylised ride, so a
 * stylised game drives its loft; a sedan has no toy build, so a toy game drives its assembled ride.
 *
 *   rideOf(Q)          → { id, kind: 'assembly', ride } | { id, kind: 'loft', class, tier, fell? }
 *                        | { id, kind: 'cycle', archetype, class, tier, fell? }   throws when the
 *                        word names no row or a row nothing can drive
 *   rideableRows()     → the rows a ride can name by id (those with a driven assembly or loft build)
 *   loftCamera(dims)   the follow camera a loft ride is chased by, scaled to its length
 *   rideLivery(Q)      the ride's livery read (car-designer/livery-cut.js), or throws: a livery paints a field vehicle
 *   rideWear(Q)        the ride's wear read (car-designer/mil-wear.js), or throws: a wear weathers a field vehicle
 *   settingLivery(Q, { style?, words? })   the camo a new quick world's field vehicle is stamped with at mint, read from
 *                      its setting (its kit's name, its words: a jungle's tiger stripe), or null: the operator's word, a
 *                      ride that is no field vehicle, or a setting no camo answers stamps nothing
 *
 * Pure: reads the registry and the quick spec.
 */
import { VEHICLES, handlesOf, rowOfHandle, suggestVehicles } from './roster.js';
import { buildsOf, buildOf } from './builds.js';
import { RIDES } from '../gameworld/ride.js';
import { CYCLE_ARCHETYPES } from '../cycle-shelf/cycle-archetypes.js';
import { MILITARY_CLASSES } from '../car-designer/road-military.js';
import { readLivery, camoForSetting } from '../car-designer/livery-cut.js';
import { readWear } from '../car-designer/mil-wear.js';

const DRIVEN = ['ride', 'loft', 'cycle'];
const drivable = (id) => buildsOf(id).some((b) => DRIVEN.includes(b.via) && b.uses.includes('driven'));

let ROWS = null;
/** The rows a ride can name by their own id: each has an assembled ride or a realistic loft to drive. */
export function rideableRows() {
  ROWS ??= Object.keys(VEHICLES).filter(drivable);
  return ROWS;
}

/** The row a ride word names (a legacy ride key, or a rideable row's id), or null. */
export function rideRowOf(word) {
  if (typeof word !== 'string') return null;
  if (RIDES[word]) return rowOfHandle('ride', word);
  return rideableRows().includes(word) ? word : null;
}

/** The ride a quick game drives: its row's build at the game's tier, among the builds a ride can be. */
export function rideOf(Q) {
  const id = rideRowOf(Q?.ride);
  if (!id) throw new Error(`gameworld: quick.ride is one of ${Object.keys(RIDES).join(', ')} or a vehicle the registry can drive (${rideableRows().join(', ')}); ${suggestVehicles(String(Q?.ride ?? ''))}`);
  const tier = Q.tier ?? 'stylised';
  const at = buildOf(id, tier, { use: 'driven' });
  // (a build a ride cannot be, a racer's grammar or a supercar, is the quick race's: the nearest a ride can be instead)
  const build = DRIVEN.includes(at.build.via) ? at.build : buildsOf(id).find((b) => DRIVEN.includes(b.via));
  const fell = build === at.build ? at.fell : `its ${tier} build is a ${at.build.via}, which a ride is not: drawn as its ${build.via}`;
  if (build.via === 'ride') return { id, kind: 'assembly', ride: build.key, tier: build.tier, ...(fell ? { fell } : {}) };
  if (build.via === 'cycle') return { id, kind: 'cycle', archetype: build.key, class: CYCLE_ARCHETYPES[build.key].physics, tier: build.tier, ...(fell ? { fell } : {}) };
  return { id, kind: 'loft', class: build.key, tier: build.tier, ...(fell ? { fell } : {}) };
}

/** The class a ride's physics come from when the quick game asks for a tuning or conditions (its row's first). */
export function rideClassOf(word) {
  const id = rideRowOf(word);
  return id ? (handlesOf(id).physics ?? [])[0] ?? null : null;
}

/** The chase behind a loft: a car's length and a half back, its height in proportion (a bus is chased farther). */
export function loftCamera(dims) {
  const L = dims?.L ?? 4.8, H = dims?.H ?? 1.45;
  const r2 = (v) => Math.round(v * 100) / 100;
  return { dist: r2(Math.max(7, 1.6 * L + 3)), height: r2(Math.max(2.6, 1.5 * H + 1)), lead: 5, lookH: r2(Math.max(1, 0.75 * H)) };
}

/** The ride's livery read, or null; a livery paints a field vehicle (a military class's realistic body) only. */
export function rideLivery(Q) {
  if (Q?.livery === undefined) return null;
  const r = rideOf(Q);
  if (r.kind !== 'loft' || !MILITARY_CLASSES[r.class]) {
    const field = rideableRows().filter((id) => (handlesOf(id).physics ?? []).some((k) => MILITARY_CLASSES[k]));
    throw new Error(`gameworld: quick.livery paints a field vehicle (${field.join(', ')}); the ${r.id} is painted by its own build`);
  }
  return readLivery(Q.livery);
}

/** The ride's wear read, or null; a wear's words are a field vehicle's (a road car's is its sheet's brief). */
export function rideWear(Q) {
  if (Q?.wear === undefined) return null;
  const r = rideOf(Q);
  if (r.kind !== 'loft' || !MILITARY_CLASSES[r.class]) throw new Error(`gameworld: quick.wear weathers a field vehicle; the ${r.id} is weathered by its own build`);
  return readWear(Q.wear);
}

/** The camo a new quick world's field vehicle is stamped with: its setting's, or null. */
export function settingLivery(Q, { style = null, words = null } = {}) {
  if (Q?.ride === undefined || Q.livery !== undefined) return null;
  const r = rideOf(Q);
  if (r.kind !== 'loft' || !MILITARY_CLASSES[r.class]) return null;
  return camoForSetting({ kit: typeof style?.kit === 'string' ? style.kit : null, words });
}
