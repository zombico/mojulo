/**
 * JOBSIFIED — the phone app of the city's driving jobs. A job on it is a SHIFT done in one of the city's own vehicles:
 * taken on the phone, the hero goes to the DEPOT that keeps that vehicle (a yard of the metro's: geocity/fleets.js
 * YARDS), gets into one there, drives its route (its STOPS, each reached in the vehicle) and brings it back to the depot,
 * where it is paid. A standing shift (`repeat`) is driven again for more pay.
 *
 * A shift is an errand with `vehicle` (gameworld/errand.js): the word is a row of SHIFTS, the fleet role whose vehicle it
 * is done in. The row says the rest: the yard that keeps it, what the vehicle is called, what is had at a stop, how many
 * stops a round has, what a stop says. A new kind of driving job is a row (its role a fleet's with a yard that keeps it
 * and a body a hero can get into: no roof extra yet, geocity/fleets.js `extra`).
 *
 *   JOBSIFIED          the app's id (phone-ui.js: a shift's app unless it names its own)
 *   SHIFTS             { <role>: { name, yard, vehicle, item, stops, stop, done } }
 *   YARD_NAMES         a yard as people call it (the works yard, the bus depot)
 *   SHIFT              the laying's numbers: how far a stop is driven from the one before, how far apart, the depot's reach
 *   shiftOf(role)      → the row, or throws (teaching)
 *   shiftWords(row, place?) → { clock, stop, back }: the guide's lines for its steps
 *   shiftRoles(errands, level) → the fleet roles a level's shifts are driven in (its depots' vehicles made cabs:
 *                      gameworld/cars.js levelCars `roles`)
 *
 * Pure.
 */
import { YARDS } from '../geocity/fleets.js';

export const JOBSIFIED = 'jobsified';

export const YARD_NAMES = Object.freeze({ works: 'works yard', depot: 'bus depot', emergency: 'emergency station', contractor: 'contractor\'s yard', lot: 'car park' });

// a fleet role's driving job: the yard that keeps its vehicles, the vehicle as it is called, what is had at each stop (an
// item word: the round's), how many stops a round has (an errand's list count says its own), and the stop's verb
export const SHIFTS = Object.freeze({
  garbage: Object.freeze({ name: 'Bin round', yard: 'works', vehicle: 'garbage truck', item: 'bins', stops: 4, stop: 'Empty the bins', done: 'Bins emptied' }),
  bus: Object.freeze({ name: 'Bus route', yard: 'depot', vehicle: 'bus', item: 'riders', stops: 5, stop: 'Stop for riders', done: 'Riders aboard' }),
});
for (const [role, S] of Object.entries(SHIFTS)) if (!YARDS[S.yard]?.roles?.[role]) throw new Error(`jobsified: the ${S.yard} yard keeps no ${role} (geocity/fleets.js YARDS)`);

// how a round is laid (m): each stop about `hop` from the one before (the nearest place to that), never nearer than
// `apart` to another stop or the depot; the depot reached within its yard, `reach` at the least
export const SHIFT = Object.freeze({ hop: 160, apart: 60, reach: 9 });

export function shiftOf(role) {
  const S = SHIFTS[role];
  if (!S) throw new Error(`jobsified: '${role}' is no driving job (vehicle: ${Object.keys(SHIFTS).join(', ')})`);
  return S;
}

const shopOf = (card) => { const w = String(card).replace(/-/g, ' '); return /(store|shop|pharmacy|diner|market|bakery|cafe|bar)$/.test(w) ? w : `${w} shop`; };
/** The guide's lines for a shift's steps: getting in at the depot, a stop (at a place, when it has one), back. */
export function shiftWords(S, place = null) {
  const yard = YARD_NAMES[S.yard] ?? S.yard;
  return {
    clock: `Get in a ${S.vehicle} at the ${yard}`,
    stop: `${S.stop}${place ? ` at the ${shopOf(place)}` : ''}`,
    back: `Bring the ${S.vehicle} back to the ${yard}`,
  };
}

export const shiftRoles = (errands, level) => [...new Set((errands ?? []).filter((E) => E?.vehicle && E.giver === level).map((E) => E.vehicle))];
