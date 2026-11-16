/**
 * THE CARS OF A TOWN — the cars a town or a district parks itself (geotown/cars.js: the car shelf's cards, each in its
 * own paint, at its kerbs, on its drives, in its lots) are the cars its level's hero gets into. The ones nearest where
 * the level starts become bodies on the runtime: the same card in the same paint where the town stood it, on its
 * class's own drive rule (roads/vehicles.js), with a CAB (worlds/controllable/mount.js `mount.cab`): its door on its
 * left, where its driver gets in and is set down. The scene draws every other parked car as it did, and none where a
 * body stands (its `driven`). Nothing is asked for and nothing is minted: a level on a town or a district has them.
 *
 *   CAB                      a cab's numbers: its reach, its door, how long getting in and out take, how slow it lets
 *                            its driver out, the camera behind it, its box, how many cars and how far from the start
 *   levelCars(ends)          → [{ at, heading, model, paint }]: the parked cars (`ends.parked`, levels.js) a level's hero
 *                            may get into, nearest its spawn first
 *   carsExtra()              → (ends) → { figures, entities } | null: a stage extra (stage-figures.js); a figure a model
 *                            and paint, shared by the cars that are it
 *
 * Pure, no dice: a car's place, model and paint are its town's.
 */
import { CAR_CARDS, composeCar } from '../car-shelf/car-library.js';
import { vehicleRule } from '../roads/vehicles.js';

const r3 = (v) => Math.round(v * 1000) / 1000;

export const CAB = Object.freeze({
  reach: 3.2,
  // its door, in the car's frame (+y forward, +x its right): on its left, a little forward of its middle
  stand: Object.freeze([-1.35, 0.25]),
  // (how far off its side its driver stands at the door: clear of its hull, a body's half width and a hand)
  door: 0.5,
  in: 0.35, out: 0.35, slow: 1.5,
  camera: Object.freeze({ dist: 8.5, height: 3.2, lookH: 1.1 }),
  // its box against a wall: half its width, its height; a kerb it climbs
  radius: 1, height: 1.5, step: 0.3,
  // how many of a level's parked cars are bodies, and how far from its start one may stand (m)
  most: 3, far: 160,
});

export function levelCars(ends) {
  const from = ends?.spawn, parked = ends?.parked ?? [];
  if (!from || !parked.length) return [];
  const d = (c) => Math.hypot(c.at[0] - from[0], c.at[1] - from[1]);
  return parked.map((c, i) => ({ c, i, d: d(c) })).filter((x) => CAR_CARDS[x.c.model] && x.d <= CAB.far).sort((a, b) => a.d - b.d || a.i - b.i).slice(0, CAB.most).map((x) => x.c);
}

const figureKey = (c) => `car-${c.model}-${String(c.paint).replace(/[^0-9a-z]/gi, '').toLowerCase()}`;

export function carsExtra() {
  return (ends) => {
    const cars = levelCars(ends);
    if (!cars.length) return null;
    const part = { figures: {}, entities: [] };
    cars.forEach((c, i) => {
      const key = figureKey(c), rule = vehicleRule(CAR_CARDS[c.model].class, { tuning: 'arcade' });
      // (its hull against another car and a body on foot, mount.js: half its width, half its length)
      const F = composeCar({ preset: c.model }).frame, hull = [r3(F.W / 2), r3(F.L / 2)];
      part.figures[key] = { loft: { car: { preset: c.model, paint: { colour: c.paint } }, light: 'form' } };
      part.entities.push({
        id: `car-${i + 1}`, pilotable: false,
        rule: { ...rule, eye: 0, collideRadius: CAB.radius, collideHeight: CAB.height, step: CAB.step },
        mount: { cab: true, hull, reach: CAB.reach, stand: [r3(-(hull[0] + CAB.door)), CAB.stand[1]], mount: { s: CAB.in }, dismount: { s: CAB.out }, slow: CAB.slow, camera: { ...CAB.camera } },
        body: { type: 'figure-rig', figure: key },
        transform: { pos: [r3(c.at[0]), r3(c.at[1]), r3(c.at[2])], heading: r3(c.heading) },
      });
    });
    return part;
  };
}
