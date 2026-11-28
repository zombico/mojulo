/**
 * THE CARS OF A TOWN — the cars a town or a district parks itself (geotown/cars.js: the car shelf's cards, each in its
 * own paint, at its kerbs, on its drives, in its lots) are the cars its level's hero gets into. The ones nearest where
 * the level starts become bodies on the runtime: the same card in the same paint where the town stood it, on its
 * class's own drive rule (roads/vehicles.js), with a CAB (worlds/controllable/mount.js `mount.cab`): its door on its
 * left, where its driver gets in and is set down. The scene draws every other parked car as it did, and none where a
 * body stands (its `driven`). Nothing is asked for and nothing is minted: a level on a town or a district has them.
 *
 *   CAB                      a cab's numbers: its reach, its door, how long getting in and out take, how slow it lets
 *                            its driver out, the camera behind a car (a bigger vehicle's framed by its size,
 *                            cab-pool.js cabView), its box, how many cars and how far from the start
 *   levelCars(ends, { roles? }) → [{ at, heading, model, paint }]: the parked cars (`ends.parked`, levels.js) a level's
 *                            hero may get into, nearest its spawn first; then, for each fleet role in `roles` (a driving
 *                            job's, gameworld/jobsified.js), its depots' vehicles (`ends.depots`) not among them, so a
 *                            car's id (`car-<i>`, its place in this list) is the same with roles as without
 *                            ; then the trucks a job ISSUES (`issue`: [{ at, heading, model, paint }], jobsified.js
 *                            issuedOf), after all of them
 *   depotCabs(ends, role, { roles? }) → [{ depot, ids }]: each depot keeping the role's vehicles, and their cab ids
 *   issuedCabs(ends, issue, { roles? }) → the cab ids of the issued trucks, in order
 *   carsExtra({ roles?, issue?, operate? }) → (ends) → (`operate`: a dig job's machines, jobsified.js operatedOf: its
 *                            machine got into and never driven, `op-<job>`, drawn by scene/channels/operate.js; its
 *                            tipper a cab from the pool, `op-<job>-truck`; after every car, so no car's id moves) { figures, entities } | null: a stage extra (stage-figures.js): each parked car a
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
import { cabView, CAB_VIEW } from '../scene/channels/cab-pool.js';

const r3 = (v) => Math.round(v * 1000) / 1000;

export const CAB = Object.freeze({
  reach: 3.2,
  // its door, in the car's frame (+y forward, +x its right): on its left, a little forward of its middle
  stand: Object.freeze([-1.35, 0.25]),
  // (how far off its side its driver stands at the door: clear of its hull, a body's half width and a hand)
  door: 0.5,
  in: 0.35, out: 0.35, slow: 1.5,
  // (`lookEase`: the chase's aim eased after the car's heading, worlds/controllable/rules-basic.js, so a steering tap does not jerk the view)
  camera: Object.freeze({ dist: 8.5, height: 3.2, lookH: 1.1, lookEase: 5 }),
  // (the chase kept this far off a wall that stands between it and its car, while it is driven: worlds/controllable/mount.js `pullIn`)
  pullIn: 0.6,
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
// (a site's machine, `site:<archetype>`, drives as its own class: roads/vehicles.js mixerTruck, wheelLoader, …)
const ruleOf = (model) => { const cls = CAR_CARDS[model]?.class ?? (model.startsWith('loft:') ? model.slice(5).split('|')[0] : model.startsWith('site:') ? model.slice(5) : 'midsize'); try { return vehicleRule(cls, { tuning: 'arcade' }); } catch { return vehicleRule('midsize', { tuning: 'arcade' }); } };

export function levelCars(ends, { roles = [], issue = [] } = {}) {
  const from = ends?.spawn, parked = ends?.parked ?? [];
  if (!from || !parked.length) return [];
  const d = (c) => Math.hypot(c.at[0] - from[0], c.at[1] - from[1]);
  const near = parked.map((c, i) => ({ c, i, d: d(c) })).filter((x) => x.d <= CAB.far).sort((a, b) => a.d - b.d || a.i - b.i).slice(0, CAB.most).map((x) => x.c);
  if (!roles.length && !issue.length) return near;
  const had = new Set(near), more = [];
  for (const D of ends.depots ?? []) for (const v of D.cabs) if (roles.includes(v.role) && !had.has(v.car)) { had.add(v.car); more.push(v.car); }
  return [...near, ...more, ...issue];
}

export function issuedCabs(ends, issue, { roles = [] } = {}) {
  const cars = levelCars(ends, { roles, issue }), n = cars.length - issue.length;
  return issue.map((_, k) => `car-${n + k + 1}`);
}

export function depotCabs(ends, role, { roles = [role] } = {}) {
  const cars = levelCars(ends, { roles }), idOf = new Map(cars.map((c, i) => [c, `car-${i + 1}`]));
  return (ends?.depots ?? []).map((D) => ({ depot: D, ids: D.cabs.filter((v) => v.role === role && idOf.has(v.car)).map((v) => idOf.get(v.car)) })).filter((x) => x.ids.length);
}

// (its camera framed by its size, scene/channels/cab-pool.js cabView: a car's the CAB's, a truck's further back and higher)
const cab = (hull, height = null) => ({ cab: true, hull, reach: Math.max(CAB.reach, hull[0] + 2), stand: [r3(-(hull[0] + CAB.door)), CAB.stand[1]], mount: { s: CAB.in }, dismount: { s: CAB.out }, slow: CAB.slow, camera: { ...CAB.camera, ...(height === null ? {} : cabView({ length: 2 * hull[1], height }, CAB.camera, CAB_VIEW)), pullIn: CAB.pullIn } });
const box = (rule) => ({ ...rule, eye: 0, collideRadius: CAB.radius, collideHeight: CAB.height, step: CAB.step });

export function carsExtra({ roles = [], issue = null, operate = null } = {}) {
  return (ends) => {
    const cars = levelCars(ends, { roles, issue: typeof issue === 'function' ? issue(ends) : issue ?? [] });
    if (!cars.length) return null;
    const part = { figures: {}, entities: [] };
    // (a depot's vehicles a driving job is done in, `roles`: their bodies move their parts where their model has them, a
    // garbage truck's tailgate, scene/channels/cab-pool.js `gate`)
    const depot = new Set();
    for (const D of ends.depots ?? []) for (const v of D.cabs) if (roles.includes(v.role)) depot.add(v.car);
    cars.forEach((c, i) => {
      // (its hull against another car and a body on foot, mount.js: half its width, half its length; its body the
      // town's own template of its model, in its paint: scene/channels/cab-pool.js)
      const M = carModel(c.model), hull = [r3(M.W / 2), r3(M.L / 2)];
      part.entities.push({
        id: `car-${i + 1}`, pilotable: false, rule: box(ruleOf(c.model)),
        mount: { ...cab(hull, M.H), pool: { model: c.model, tint: lin(c.paint), ...(depot.has(c) && M.gate ? { gate: { pivot: M.gate.pivot, tip: M.gate.tip } } : {}) } },
        body: { type: 'none' },
        transform: { pos: [r3(c.at[0]), r3(c.at[1]), r3(c.at[2])], heading: r3(c.heading) },
      });
    });
    // (a dig job's machine, operated where it stands: a cab got into, its rule still, its body the operate channel's;
    // and its tipper, a cab of the pool's)
    for (const O of typeof operate === 'function' ? operate(ends) : operate ?? []) {
      const M = carModel(`site:${O.archetype}`), T = carModel(O.truck.model), at = (p) => p.map(r3);
      part.entities.push({ id: O.cab, pilotable: false, rule: { type: 'static' }, mount: { ...cab([r3(M.W / 2), r3(M.L / 2)], M.H), operate: O.id }, body: { type: 'none' }, transform: { pos: at(O.at), heading: r3(O.heading) } });
      part.entities.push({ id: O.truckCab, pilotable: false, rule: box(ruleOf(O.truck.model)), mount: { ...cab([r3(T.W / 2), r3(T.L / 2)], T.H), pool: { model: O.truck.model, tint: lin('#d8d4ca') } }, body: { type: 'none' }, transform: { pos: at(O.truck.at), heading: r3(O.truck.heading) } });
    }
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
