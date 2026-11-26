/**
 * JOBSIFIED — the phone app of the city's driving jobs. A job on it is a SHIFT done in one of the city's own vehicles:
 * taken on the phone, the hero goes to the DEPOT that keeps that vehicle (a yard of the metro's: geocity/fleets.js
 * YARDS), gets into one there, drives its route (its STOPS, each reached in the vehicle) and brings it back to the depot,
 * where it is paid. A standing shift (`repeat`) is driven again for more pay.
 *
 * A shift is an errand with `vehicle` (gameworld/errand.js): the word is a row of SHIFTS, and the row says the rest. Its
 * MODE is how it is worked:
 *   collect  a round of piles (a garbage truck's): got into at its depot, driven to a pile and held at (a key held,
 *            `hold` seconds) to take it on, `load` of them filling the truck; full, it is driven to the district's
 *            DUMP (geocity `dump`, a tipping hall on a car park) and emptied there, which pays. A district with no dump
 *            unloads at the depot. Taken piles are laid again once every one is taken (the city makes more)
 *   route    a round of stops in order (a bus's): at the next stop, held at (`hold` seconds, the doors open) the people
 *            waiting there board and those who boarded at the stop before get off; the last stop pays, and the round
 *            begins again
 *   haul     a heavy vehicle driven to a job (a general heavy driver's): one is ISSUED at the kerb by the yard (one of
 *            the `fleet`'s models, stood there for the job: issuedOf), got into and driven across the district to a
 *            building site (a construction lot near the eye, else a far place), which pays; left there, it is taken
 *            back to the yard for the next
 * Its vehicle is either the depot's own (a collect's garbage trucks, a fleet role its yard keeps whose body a hero can get
 * into: no roof extra yet, geocity/fleets.js `extra`) or ISSUED (a row with a `fleet`: a haul's truck, a route's bus,
 * stood at the kerb by its yard, or by the start where the district keeps no such yard). A new kind of driving job is a
 * row.
 *
 *   JOBSIFIED          the app's id (phone-ui.js: a shift's app unless it names its own)
 *   SHIFT_MODES        collect | route | haul
 *   SHIFTS             { <word>: { name, mode, yard, vehicle, item, stops, stop?, done, load?, hold?, fleet?, to?, riders? } }
 *   YARD_NAMES         a yard as people call it (the works yard, the bus depot)
 *   SHIFT              the laying's numbers: how far a stop is driven from the one before, how far apart, the depot's reach
 *   shiftOf(word)      → the row, or throws (teaching)
 *   shiftRoles(errands, level) → the fleet roles a level's shifts are driven in from their depots (its depots'
 *                      vehicles made cabs: gameworld/cars.js levelCars `roles`)
 *   issuedOf(ends, errands, level) → [{ id, at, heading, model, paint, word, place }]: the vehicles a level's shifts
 *                      issue, each at the kerb by its yard (gameworld/cars.js levelCars `issue`)
 *
 * Pure.
 */
import { YARDS, fleetOf } from '../geocity/fleets.js';

export const JOBSIFIED = 'jobsified';
export const SHIFT_MODES = Object.freeze(['collect', 'route', 'haul']);

export const YARD_NAMES = Object.freeze({ works: 'works yard', depot: 'bus depot', emergency: 'emergency station', contractor: 'contractor\'s yard', lot: 'car park' });

// each driving job: its mode, the yard it starts from, the vehicle as it is called, what is had at a stop (an item word:
// the round's), how many stops (piles) a round has (an errand's list count says its own), what a stop says and what
// doing it says; a collect's `load` (piles a truck holds); `hold` (seconds a pile or a stop is held at); `fleet` (the
// fleet its vehicle is issued from, where it is not the depot's own); a haul's `to` (where it is driven); a route's
// `riders` (how few and how many wait at a stop); `licence`: taken only with the papers a world's forger sells
// (gameworld/shops.js FORGED, a heavy machinery licence), where it sells them
export const SHIFTS = Object.freeze({
  garbage: Object.freeze({ name: 'Bin round', mode: 'collect', yard: 'works', vehicle: 'garbage truck', item: 'garbage', stops: 8, load: 4, hold: 1.5, stop: 'Collect the garbage', done: 'Garbage collected' }),
  bus: Object.freeze({ name: 'Bus route', mode: 'route', yard: 'depot', fleet: 'bus', vehicle: 'bus', item: 'riders', stops: 5, hold: 1.5, riders: Object.freeze([1, 3]), stop: 'Pick up at the bus stop', done: 'Doors closed' }),
  heavy: Object.freeze({ name: 'Heavy vehicle call', mode: 'haul', yard: 'works', vehicles: 'heavy', calls: 3, licence: true, vehicle: 'heavy vehicle', item: 'haul', stops: 1, to: 'building site', done: 'Delivered' }),
});
// THE HEAVY CALL'S VEHICLES (a row's `vehicles: 'heavy'`): trucks and a site's machines turn about, each a body a hero
// can drive (a car shelf loft or a construction shelf machine, geotown/cars.js carModel), what it is called and its
// paint (a machine wears its own colours). A job's calls are the next `calls` of them from its own word
export const HEAVY_VEHICLES = Object.freeze([
  Object.freeze({ model: 'site:mixerTruck', word: 'concrete mixer', paint: '#d8d4ca' }),
  Object.freeze({ model: 'loft:flatbedTruck', word: 'flatbed truck', paint: '#20497f' }),
  Object.freeze({ model: 'site:wheelLoader', word: 'wheel loader', paint: '#e0b02a' }),
  Object.freeze({ model: 'site:tipperTruck', word: 'tipper truck', paint: '#d8d4ca' }),
  Object.freeze({ model: 'loft:skipLoader', word: 'skip lorry', paint: '#c45a1d' }),
  Object.freeze({ model: 'site:backhoeLoader', word: 'backhoe', paint: '#e0b02a' }),
  Object.freeze({ model: 'loft:straightBox', word: 'box truck', paint: '#e6e6e2' }),
  Object.freeze({ model: 'site:wheeledExcavator', word: 'wheeled excavator', paint: '#e0b02a' }),
]);
const VEHICLE_LISTS = Object.freeze({ heavy: HEAVY_VEHICLES });
/** Whether a row's vehicle is issued (a fleet's, or one of a list's turn about), not the depot's own. */
export const issues = (S) => !!(S && (S.fleet || S.vehicles));
for (const [word, S] of Object.entries(SHIFTS)) {
  if (!SHIFT_MODES.includes(S.mode)) throw new Error(`jobsified: '${word}' works as ${SHIFT_MODES.join(', ')}`);
  if (!issues(S) && !YARDS[S.yard]?.roles?.[word]) throw new Error(`jobsified: the ${S.yard} yard keeps no ${word} (geocity/fleets.js YARDS); a vehicle it does not keep is issued (fleet, vehicles)`);
  if (S.mode === 'haul' && !issues(S)) throw new Error(`jobsified: '${word}' is a haul: its vehicle is issued (fleet, vehicles)`);
  if (S.vehicles && !VEHICLE_LISTS[S.vehicles]) throw new Error(`jobsified: '${word}' issues from no list (${Object.keys(VEHICLE_LISTS).join(', ')})`);
}

// how a round is laid (m): each stop about `hop` from the one before (the nearest place to that), never nearer than
// `apart` to another stop or the depot; the depot reached within its yard, `reach` at the least; a haul's site at least
// `haul` from its yard, reached `site` past its lot's edge
export const SHIFT = Object.freeze({ hop: 160, apart: 60, reach: 9, haul: 300, site: 8 });

export function shiftOf(word) {
  const S = SHIFTS[word];
  if (!S) throw new Error(`jobsified: '${word}' is no driving job (vehicle: ${Object.keys(SHIFTS).join(', ')})`);
  return S;
}

export const shiftRoles = (errands, level) => [...new Set((errands ?? []).filter((E) => E?.vehicle && E.giver === level && SHIFTS[E.vehicle] && !issues(SHIFTS[E.vehicle])).map((E) => E.vehicle))];

// (a word's own number, for a choice no die makes: the same job issues the same truck)
const hashOf = (w) => [...String(w)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
/** The vehicles a level's shifts issue: a fleet's one (a route's bus) or a list's `calls` (a heavy call's, each the next
 *  of the list from the job's own word, `call` its number), each at the kerb before one of the places nearest its yard
 *  (the start where the district keeps no such yard), turned along the street. */
export function issuedOf(ends, errands, level) {
  const out = [], d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]), taken = [];
  for (const E of errands ?? []) {
    const S = E?.vehicle && E.giver === level ? SHIFTS[E.vehicle] : null;
    if (!issues(S) || typeof ends?.kerbAt !== 'function') continue;
    const D = (ends.depots ?? []).find((x) => x.yard === S.yard), from = D ? D.at : ends.spawn;
    const list = S.vehicles ? VEHICLE_LISTS[S.vehicles] : null, n = list ? Math.min(S.calls ?? 1, list.length) : 1, h = hashOf(E.id);
    const which = (k) => { if (list) return list[(h + k) % list.length]; const rows = fleetOf(S.fleet), R = rows[h % rows.length]; return { model: R.model, word: R.word, paint: R.paints[0] }; };
    const near = (ends.places ?? []).slice().sort((a, b) => d2(a.at, from) - d2(b.at, from) || a.at[0] - b.at[0] || a.at[1] - b.at[1]);
    let k = 0;
    // (each at a kerb of its own, clear of the others' by a long vehicle's length)
    for (const q of near.slice(0, 12 + n * 4)) {
      if (k >= n) break;
      if (!taken.every((t) => d2(q.at, t) > 16)) continue;
      const spot = ends.kerbAt(q.at, q.N);
      if (!spot || !taken.every((t) => d2(spot.at, t) > 16)) continue;
      const V = which(k);
      out.push({ id: E.id, ...(list ? { call: k + 1 } : {}), at: spot.at, heading: spot.heading, model: V.model, paint: V.paint, word: V.word, place: q.card, yard: D ? YARD_NAMES[S.yard] : null });
      taken.push(spot.at);
      k++;
    }
  }
  return out;
}
