/**
 * consist — cars coupled into a train: a train's composition by its family (its cab at the front and, for a unit, its
 * cab turned end for end at the rear; its cars between), each car compiled (cab-surface.js, car-surface.js), laid out
 * nose to tail along the track with the gap their ends' gear needs (two gangways' bellows meeting, two buffers' heads
 * touching, a module's articulation ring), the rear cab turned about the vertical. Pure and deterministic.
 *
 *   TRAIN_PLANS   family → its default composition: { cab, cars: [archetype…], rear: true | false }
 *   planTrain({ family, cars? }) → { family, cab, cars, rear }: the composition, `cars` an explicit list (a freight
 *                 train's wagons behind its locomotive)
 *   composeTrain({ family, cars?, seed, quality, livery, pose, interior }) → { plan, vehicles: [{ kind, archetype, y, facing,
 *                 length }], length, faces: { [vehicle]: [faces] }, couplings: [{ between, kinds, gap, meets }], laws,
 *                 valid, census, materials }
 *     y        each vehicle's middle along the track (the leading cab's nose ahead of 0's), facing +1 or −1
 *     couplings each pair's two ends and the gap between their bodies; `meets` that the two kinds couple
 *
 * Track space: +y the train's way, x right, z up from the rail.
 */
import { compileCabSurface } from './cab-surface.js';
import { compileCarSurface } from './car-surface.js';
import { CAB_ARCHETYPES } from './cab-odm.js';
import { CAR_ARCHETYPES } from './car-odm.js';
import { r4 } from './rail-geom.js';

export const TRAIN_PLANS = Object.freeze({
  metro: Object.freeze({ cab: 'metro', cars: ['metroCar', 'metroCar', 'metroCar', 'metroCar'], rear: true }),
  tram: Object.freeze({ cab: 'tram', cars: ['tramModule', 'tramCentre', 'tramModule'], rear: true }),
  regional: Object.freeze({ cab: 'regional', cars: ['regionalCar', 'regionalCar'], rear: true }),
  highSpeed: Object.freeze({ cab: 'highSpeed', cars: ['highSpeedCoach', 'highSpeedCoach', 'highSpeedCoach', 'highSpeedCoach'], rear: true }),
  boxCab: Object.freeze({ cab: 'boxCab', cars: ['coach', 'coach', 'coach'], rear: false }),
  freight: Object.freeze({ cab: 'boxCab', cars: ['boxcar', 'hopper', 'tank', 'flat', 'boxcar', 'hopper'], rear: false }),
});
// which ends couple: two gangways, two articulations, two sets of buffers (a unit's gangway to a coach's: no)
const COUPLES = (a, b) => a === b;

export function planTrain({ family = 'metro', cars } = {}) {
  const P = TRAIN_PLANS[family];
  if (!P) throw new Error(`rail-consist: unknown family ${family} (known: ${Object.keys(TRAIN_PLANS).join(', ')})`);
  const list = cars ?? P.cars;
  if (!Array.isArray(list) || list.some((k) => !CAR_ARCHETYPES[k])) throw new Error('rail-consist: cars are car archetypes (car-odm.js)');
  return { family, cab: P.cab, cars: [...list], rear: P.rear };
}

export function composeTrain({ family = 'metro', cars, seed = 1, quality = 'game', livery, pose = {}, interior } = {}) {
  const plan = planTrain({ family, cars });
  const front = compileCabSurface({ seed, archetype: plan.cab }, { quality, livery, pose, ...(interior ? { interior } : {}) });
  const bodies = plan.cars.map((k) => compileCarSurface({ seed, archetype: k }, { quality, livery: CAB_ARCHETYPES[plan.cab] && CAR_ARCHETYPES[k].kind === 'passenger' ? livery : undefined, pose, ...(interior ? { interior } : {}) }));
  const rear = plan.rear ? compileCabSurface({ seed, archetype: plan.cab }, { quality, livery, pose, ...(interior ? { interior } : {}) }) : null;
  // lay them out from the leading cab's middle back: each next body a gap behind the last, the gap its two ends' depths
  const vehicles = [], couplings = [], faces = {};
  const L0 = front.design.frame.length;
  vehicles.push({ kind: 'cab', archetype: plan.cab, y: 0, facing: 1, length: L0, ends: { rear: front.ends.rear } });
  let tail = -L0 / 2, prevEnd = front.ends.rear, prevName = 'cab';
  for (const [i, c] of bodies.entries()) {
    const L = c.design.frame.length, gap = r4(prevEnd.depth + c.ends.front.depth), y = r4(tail - gap - L / 2);
    couplings.push({ between: [prevName, `car${i}`], kinds: [prevEnd.kind, c.ends.front.kind], gap, meets: COUPLES(prevEnd.kind, c.ends.front.kind) });
    vehicles.push({ kind: 'car', archetype: c.design.archetype, y, facing: 1, length: L });
    tail = y - L / 2; prevEnd = c.ends.rear; prevName = `car${i}`;
  }
  if (rear) {
    const L = rear.design.frame.length, gap = r4(prevEnd.depth + rear.ends.rear.depth), y = r4(tail - gap - L / 2);
    couplings.push({ between: [prevName, 'rearCab'], kinds: [prevEnd.kind, rear.ends.rear.kind], gap, meets: COUPLES(prevEnd.kind, rear.ends.rear.kind) });
    vehicles.push({ kind: 'cab', archetype: plan.cab, y, facing: -1, length: L });
    tail = y - L / 2;
  }
  // each vehicle's faces in track space: moved along, the rear cab turned about the vertical
  const place = (c, v) => Object.values(c.faces).flat().map((f) => {
    const T = (p) => (v.facing > 0 ? [p[0], r4(p[1] + v.y), p[2]] : [r4(-p[0]), r4(-p[1] + v.y), p[2]]), N = (n) => (v.facing > 0 ? n : [-n[0], -n[1], n[2]]);
    return { ...f, corners: f.corners.map(T), outNormal: N(f.outNormal), ...(f.cornerNormals ? { cornerNormals: f.cornerNormals.map(N) } : {}) };
  });
  const compiled = [front, ...bodies, ...(rear ? [rear] : [])];
  vehicles.forEach((v, i) => { faces[i === 0 ? 'cab' : i === vehicles.length - 1 && rear ? 'rearCab' : `car${i - 1}`] = place(compiled[i], v); });
  const lead = front.design.anchors.tip, length = r4(lead - tail);
  const laws = [
    { id: 'ends-couple', pass: couplings.every((c) => c.meets) },
    { id: 'cars-valid', pass: compiled.every((c) => c.design.valid) },
    // (a unit's cars of its own family; a locomotive's anything its buffers couple to)
    { id: 'one-family', pass: plan.rear ? bodies.every((c) => c.design.family === plan.cab) : true },
  ];
  const all = Object.values(faces).flat();
  return { plan, vehicles, length, couplings, faces, laws, valid: laws.every((l) => l.pass), materials: front.materials,
    census: { vehicles: vehicles.length, faces: all.length, triangles: all.reduce((t, f) => t + f.corners.length - 2, 0) } };
}
