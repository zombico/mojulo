/**
 * THE RIDE — a hero who is a vehicle (cosmos soul.hero=vehicle). A quick game's `ride` names one; the run mints its
 * build (an `assembler` sketch: chassis, four wheels seated by the garage, an engine, a body shell) and every stage is
 * piloted by it on the `drive` rule (worlds/controllable/rules-drive.js), its feel derived from the build's own parts
 * (vehicle-designer/drivetrain.js: the engine's horsepower, the archetype's curb mass and brakes, the baked wheelbase).
 *
 *   RIDES          { <ride>: { archetype, chassis, engine, body, words } }   what a game may ride
 *   rideBuild(ride, seed)   → the build's manifest (kind 'assembler'), what the ride step mints
 *   rideRule(ride, seed)    → the drive rule (derived; the build's rig baked at the car's height)
 *
 * Pure and deterministic: the parts are seeded, the bake and the derive are functions of them.
 */
import { deriveDrivetrain } from '../vehicle-designer/drivetrain.js';
import { resolveVehBodyRecipe } from '../vehicle-designer/veh-body.js';
import { resolveVehChassisRecipe } from '../vehicle-designer/veh-chassis.js';
import { resolveVehEngineRecipe } from '../vehicle-designer/veh-engine.js';
import { planComponentFit } from '../vehicle-designer/veh-garage.js';
import { resolveVehWheelRecipe } from '../vehicle-designer/veh-wheel.js';
import { bakeVehicleRig } from '../vehicle-designer/vehicle-rig.js';

export const RIDES = Object.freeze({
  car: { archetype: 'sedan', chassis: 'unibodyPan', engine: 'veeEight', body: 'sedanThree', words: 'a sedan: a V8, sure on the road' },
  coupe: { archetype: 'coupe', chassis: 'sportPan', engine: 'inlineFour', body: 'coupeThree', words: 'a low coupe: light and quick to turn' },
  van: { archetype: 'minivan', chassis: 'unibodyPan', engine: 'transverseFour', body: 'vanOne', words: 'a boxy van: heavy, slow off the line' },
});
// the car's height in the world (metres), and the top speed a trail can hold
export const RIDE_H = 1.5;
const TOP_SPEED = 26;

function parts(ride, seed) {
  const R = RIDES[ride];
  if (!R) throw new Error(`gameworld: ride '${ride}' is not one of ${Object.keys(RIDES).join(', ')}`);
  const chassis = resolveVehChassisRecipe({ family: R.chassis, seed });
  const wheel = resolveVehWheelRecipe({ seed });
  const engine = resolveVehEngineRecipe({ family: R.engine, seed });
  const body = resolveVehBodyRecipe({ family: R.body, seed });
  return { R, chassis, wheel, engine, body };
}

/** The ride's build: an assembler manifest the run mints as its own sketch (the figure's vehicleRef). */
export function rideBuild(ride, seed = 1) {
  const { R, chassis, wheel, engine, body } = parts(ride, seed);
  const wheelFits = planComponentFit(wheel, chassis), engineFit = planComponentFit(engine, chassis);
  return {
    kind: 'assembler',
    title: `${ride}: ${R.words}`,
    units: chassis.units,
    items: [
      { id: 'chassis', source: chassis },
      ...wheelFits.placements.map((p) => ({ source: wheel, at: p.at, ...(p.flip ? { flip: p.flip } : {}) })),
      { id: 'engine', source: engine, at: engineFit.placements[0].at },
      { id: 'body', source: body },
    ],
  };
}

/** The drive rule the ride plays by: its drivetrain from the build's parts and baked rig, a trail's top speed. */
export function rideRule(ride, seed = 1) {
  const { R, chassis, wheel, engine, body } = parts(ride, seed);
  const rig = bakeVehicleRig(rideBuild(ride, seed), { targetH: RIDE_H });
  const dt = deriveDrivetrain({ archetype: R.archetype, parts: [chassis, wheel, engine, body], rig, unitScale: 1 });
  if (!dt) throw new Error(`gameworld: ride '${ride}' has no engine to drive`);
  const r3 = (v) => Math.round(v * 1000) / 1000;
  return { type: 'drive', ...Object.fromEntries(Object.entries(dt).map(([k, v]) => [k, r3(v)])), topSpeed: TOP_SPEED, eye: 0 };
}
