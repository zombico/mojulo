/**
 * THE CARS OF A TOWN — a world's `cars`: cars parked at the kerb beside where each town and district level starts
 * (a geotown's, a geocity's), each one the hero walks up to, gets into, drives and gets out of. A car is a RIDE's build
 * (ride.js: its chassis, wheels, engine and shell, minted once a ride by the run) on that ride's own drive rule, with a
 * CAB (worlds/controllable/mount.js `mount.cab`): its door on its left, where its driver gets in and is set down.
 *
 *   cars: true | 1…4 | [{ ride?: car | coupe | van }]     true is one car
 *
 *   CAB                      a cab's numbers: its reach, its door, how long getting in and out take, how slow it lets
 *                            its driver out, the camera behind it, its box
 *   readCars(spec)           → [{ ride }] or null; throws, teaching
 *   carRides(cars)           → the rides they are, each once: what the run mints
 *   carsExtra(cars, refOf, seed) → (ends) → { figures, entities } | null: a stage extra (stage-figures.js); the stage's
 *                            ends tell where a car may stand (`kerbs`: [{ at, heading }], levels.js), one car a spot
 *
 * Pure, no dice: a car's place is its level's kerb, its build its ride's and the game's seed.
 */
import { RIDES, RIDE_H, rideRule } from './ride.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const r3 = (v) => Math.round(v * 1000) / 1000;

export const CAB = Object.freeze({
  reach: 3.2,
  // its door, in the car's frame (+y forward, +x its right): on its left, a little forward of its middle
  stand: Object.freeze([-1.35, 0.25]),
  in: 0.35, out: 0.35, slow: 1.5,
  camera: Object.freeze({ dist: 8.5, height: 3.2, lookH: 1.1 }),
  // its box against a wall: half its width, its height; a kerb it climbs
  radius: 1, height: 1.5, step: 0.3,
  most: 4,
});

export function readCars(spec) {
  if (spec === undefined || spec === null || spec === false) return null;
  const no = (m) => { throw new Error(`gameworld: cars${m[0] === '[' ? '' : ' '}${m}`); };
  const say = `is true, a count (1 to ${CAB.most}) or a list of [{ ride?: ${Object.keys(RIDES).join(' | ')} }]: cars parked beside where each town and district level starts`;
  if (spec === true) return [{ ride: 'car' }];
  if (Number.isInteger(spec)) { if (spec < 1 || spec > CAB.most) no(say); return Array.from({ length: spec }, (_, i) => ({ ride: Object.keys(RIDES)[i % Object.keys(RIDES).length] })); }
  if (!Array.isArray(spec) || !spec.length || spec.length > CAB.most) no(say);
  return spec.map((c, i) => {
    if (!isObj(c)) no(`[${i}] is { ride? }`);
    for (const k of Object.keys(c)) if (k !== 'ride') no(`[${i}].${k} is not a car's setting (ride)`);
    if (c.ride !== undefined && !RIDES[c.ride]) no(`[${i}].ride is ${Object.keys(RIDES).join(', ')}`);
    return { ride: c.ride ?? 'car' };
  });
}

export const carRides = (cars) => [...new Set((cars ?? []).map((c) => c.ride))];

export function carsExtra(cars, refOf, seed = 1) {
  if (!cars?.length) return null;
  return (ends) => {
    const spots = ends.kerbs ?? [];
    if (!spots.length) return null;
    const part = { figures: {}, entities: [] };
    cars.slice(0, spots.length).forEach((c, i) => {
      const id = `car-${i + 1}`, K = spots[i], rule = rideRule(c.ride, seed);
      part.figures[id] = { vehicleRef: refOf(c.ride), targetH: RIDE_H };
      part.entities.push({
        id, pilotable: false,
        rule: { ...rule, collideRadius: rule.collideRadius ?? CAB.radius, collideHeight: rule.collideHeight ?? CAB.height, step: rule.step ?? CAB.step },
        mount: { cab: true, reach: CAB.reach, stand: [...CAB.stand], mount: { s: CAB.in }, dismount: { s: CAB.out }, slow: CAB.slow, camera: { ...CAB.camera } },
        body: { type: 'figure-rig', figure: id },
        transform: { pos: [r3(K.at[0]), r3(K.at[1]), r3(K.at[2] + (rule.eye ?? 0))], heading: r3(K.heading) },
      });
    });
    return part.entities.length ? part : null;
  };
}
