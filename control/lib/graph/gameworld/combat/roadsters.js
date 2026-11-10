/**
 * THE MACHINES RIDDEN ASTRIDE ON THE RANGE — the cycle shelf's motorcycles (and its scooters, its bicycles, its quads)
 * ridden on the artillery range's land: each on the drive rule at its class's own row (roads/vehicles.js: its power,
 * its mass, its drag, its grip, its turning radius), drawn as the shelf rides it (cycle-shelf/cycle-figure.js: its
 * rider astride, its front turned about its steering axis, the machine and its rider leaning into a turn by the drive
 * rule's own lean), its rider aiming a gun fitted for the range (a 12.7 mm light gun, the range's smallest round: aimed
 * by the rider's hands and arms, all round but behind, held on its aim while the machine turns under it).
 *
 *   cycleReady(archetype)                 → (async) its rider solved, once a process (the realistic hero's build)
 *   cycleBase(id, archetype, { rider, reload }) → the range's base (aircraft.js airBase's shape); with `rider: false` it is
 *                                           ridden riderless and needs no cycleReady
 *
 * Vehicle space as the shelves' (+y the front, +x right, metres). Pure but for the rider's build, cached.
 */
import { rideFigureOf, riderOf } from '../../cycle-shelf/cycle-figure.js';
import { CYCLE_ARCHETYPES } from '../../cycle-shelf/cycle-archetypes.js';
import { vehicleRule, VEHICLES as PHYSICS } from '../../roads/vehicles.js';
import { ordnanceWeapon } from './ordnance.js';
import { mountOf } from './mount.js';

const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
const RIDERS = new Map();
const specOf = (archetype, rider) => ({ archetype, ride: true, ...(rider ? { rider: true } : {}) });

/** A machine's rider, solved on the realistic hero's rig once a process (half a minute the first time). */
export async function cycleReady(archetype) {
  if (!RIDERS.has(archetype)) RIDERS.set(archetype, await riderOf(specOf(archetype, true)));
  return RIDERS.get(archetype);
}

/** A machine ridden astride as the range's base. */
export function cycleBase(id, archetype, { rider = true, reload = 6 } = {}) {
  const A = CYCLE_ARCHETYPES[archetype];
  if (!A) throw new Error(`artillery range: no machine '${archetype}' on the cycle shelf`);
  const R = rider ? RIDERS.get(archetype) : null;
  if (rider && !R) throw new Error(`artillery range: the ${id}'s rider is built once a process: await artilleryReady(spec) before the range (or ride it riderless: base.rider false)`);
  const figure = rideFigureOf(specOf(archetype, rider), R);
  const cls = A.physics, P = PHYSICS[cls];
  // (the rider's gun: at the rider's chest over the seat, all round but behind them, its aim held by their arms)
  const at = [-0.1, 0, r3(Math.max(0.9, 0.78 * figure.figH))];
  const T = mountOf('light-tank', { mount: { at, traverse: { rate: 160, accel: 800, min: -140, max: 140 }, elevation: { rate: 120, accel: 600, min: -20, max: 45 }, stabilized: true, look: 0.08 }, gun: { barrel: 0.9 } });
  const rounds = [(({ cooldown: _c, ...x }) => ({ ...x, auto: true, rof: 9, magazine: 200, reserve: 400 }))(ordnanceWeapon('ap127', { reload }))];
  const size = r3(Math.max(figure.figH, (P?.L ?? 2) / 2.6, 1.5));
  return {
    id, archetype, class: cls, figure, rule: vehicleRule(cls), turret: T, rounds, size, cycle: true,
    gun: { label: '12.7 mm light gun', fitted: true },
    transform: { pos: [0, 0, 0], heading: 0, pitch: 0 },
    engine: P && P.power > 2 ? 'motorbike-engine' : null,
    keys: 'W / S  throttle, brake · A / D  steer (it leans into the turn) · mouse  aim · click  fire',
  };
}
