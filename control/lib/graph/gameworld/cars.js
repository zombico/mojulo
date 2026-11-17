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
 *   carsExtra()              → (ends) → { figures, entities } | null: a stage extra (stage-figures.js): each parked car a
 *                            body drawn from the town's own template of its model (`mount.pool`), and the spares a
 *                            vehicle taken from the traffic becomes
 *   patrolCar({ id, at, heading, model, paint, target, roads, posts })
 *                            → a police car (gameworld/law.js): its model's body (`carBody`, drawn as a cab is, a light
 *                            bar on its roof) on its class's drive, driven by the `chaser` rule after `target` along
 *                            `roads`, a hull the player's car bumps (`carHull`); no one gets into it. Asleep and gone
 *                            until the wanted level brings it
 *
 * Pure, no dice: a car's place, model and paint are its town's.
 */
import { CAR_CARDS } from '../car-shelf/car-library.js';
import { carModel } from '../geotown/cars.js';
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
  most: 120, far: 900,
  // the cabs kept out of the world for a vehicle taken from the traffic (scene/channels/cab-pool.js)
  spares: 6,
});

// a paint as the tint over a pale body (linear rgb, as the town's parked cars are tinted: geotown/cars.js)
const lin = (h) => [1, 3, 5].map((k) => { const c = parseInt(h.slice(k, k + 2), 16) / 255; return Math.round((c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4) * 1e4) / 1e4; });
// a parked vehicle's physics class: its card's, or its loft's own (`loft:<class>|<brief>`); a class the road's table
// does not carry drives as a midsize car
const ruleOf = (model) => { const cls = CAR_CARDS[model]?.class ?? (model.startsWith('loft:') ? model.slice(5).split('|')[0] : 'midsize'); try { return vehicleRule(cls, { tuning: 'arcade' }); } catch { return vehicleRule('midsize', { tuning: 'arcade' }); } };

export function levelCars(ends) {
  const from = ends?.spawn, parked = ends?.parked ?? [];
  if (!from || !parked.length) return [];
  const d = (c) => Math.hypot(c.at[0] - from[0], c.at[1] - from[1]);
  return parked.map((c, i) => ({ c, i, d: d(c) })).filter((x) => x.d <= CAB.far).sort((a, b) => a.d - b.d || a.i - b.i).slice(0, CAB.most).map((x) => x.c);
}

const cab = (hull) => ({ cab: true, hull, reach: Math.max(CAB.reach, hull[0] + 2), stand: [r3(-(hull[0] + CAB.door)), CAB.stand[1]], mount: { s: CAB.in }, dismount: { s: CAB.out }, slow: CAB.slow, camera: { ...CAB.camera } });
const box = (rule) => ({ ...rule, eye: 0, collideRadius: CAB.radius, collideHeight: CAB.height, step: CAB.step });

export function carsExtra() {
  return (ends) => {
    const cars = levelCars(ends);
    if (!cars.length) return null;
    const part = { figures: {}, entities: [] };
    cars.forEach((c, i) => {
      // (its hull against another car and a body on foot, mount.js: half its width, half its length; its body the
      // town's own template of its model, in its paint: scene/channels/cab-pool.js)
      const M = carModel(c.model), hull = [r3(M.W / 2), r3(M.L / 2)];
      part.entities.push({
        id: `car-${i + 1}`, pilotable: false, rule: box(ruleOf(c.model)),
        mount: { ...cab(hull), pool: { model: c.model, tint: lin(c.paint) } },
        body: { type: 'none' },
        transform: { pos: [r3(c.at[0]), r3(c.at[1]), r3(c.at[2])], heading: r3(c.heading) },
      });
    });
    // (the spares: out of the world until a vehicle is taken from the traffic, then that vehicle)
    const at = cars[0].at;
    for (let k = 0; k < CAB.spares; k++) part.entities.push({
      id: `car-spare-${k + 1}`, pilotable: false, rule: box(vehicleRule('midsize', { tuning: 'arcade' })),
      mount: { ...cab([0.95, 2.3]), spare: true },
      body: { type: 'none' },
      transform: { pos: [r3(at[0]), r3(at[1]), r3(at[2] - 60)], heading: 0 },
    });
    return part;
  };
}

export function patrolCar({ id, at, heading = 0, model, paint, target, roads, posts }) {
  const M = carModel(model), hull = [r3(M.W / 2), r3(M.L / 2)];
  return {
    id, pilotable: false, rule: { ...box(ruleOf(model)), type: 'chaser', target, roads },
    carBody: { pool: { model, tint: lin(paint) }, lights: 'rb' }, carHull: hull, posts,
    body: { type: 'none' }, dormant: true, gone: true,
    transform: { pos: [r3(at[0]), r3(at[1]), r3(at[2])], heading: r3(heading) },
  };
}
