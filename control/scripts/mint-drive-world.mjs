/**
 * Mint the DRIVE proving ground (drivable-vehicles.plan.md D4, the eyes gate):
 * a real sedan BUILD (chassis + 4 wheels + veeEight engine + body shell, seated
 * by planComponentFit) plus a playable world where you walk up to it, board it
 * with T, and DRIVE — the D2 rule end-to-end in the real emitted runtime.
 *
 *   sk_veh_drive_sedan_build     the assembler build (kind 'assembler')
 *   sk_veh_drive_proving_ground  the world (kind 'controllable')
 *
 * CONTROLS: WASD walks the driver (tank turn). T boards / dismounts (the pilot
 * swap — both entities are pilotable). Driving: W throttle, S brake (held past
 * the stop = reverse), A/D steer. F is reserved. The follow camera retargets
 * with the swap.
 *
 * The rig bake + drivetrain derive are validated HERE so a bad build fails at
 * mint, not in the browser; the world manifest stays a tiny recipe (only
 * figures.sedan.vehicleRef persists — the bake happens at world-resolve time).
 *
 *   cd control
 *   node scripts/mint-drive-world.mjs             # mint / refresh both refs
 *   node scripts/mint-drive-world.mjs --dry-run   # build + bake + derive only
 */

import { SketchRepository } from '../lib/db/repositories/sketches.js';
import { deriveDrivetrain } from '../lib/graph/vehicle-designer/drivetrain.js';
import { resolveVehBodyRecipe } from '../lib/graph/vehicle-designer/veh-body.js';
import { resolveVehChassisRecipe } from '../lib/graph/vehicle-designer/veh-chassis.js';
import { resolveVehEngineRecipe } from '../lib/graph/vehicle-designer/veh-engine.js';
import { planComponentFit } from '../lib/graph/vehicle-designer/veh-garage.js';
import { resolveVehWheelRecipe } from '../lib/graph/vehicle-designer/veh-wheel.js';
import { bakeVehicleRig } from '../lib/graph/vehicle-designer/vehicle-rig.js';

const BASE_URL = 'http://127.0.0.1:3001';
const BUILD_REF = 'sk_veh_drive_sedan_build';
const WORLD_REF = 'sk_veh_drive_proving_ground';
const CAR_H = 1.5;   // world meters — the drive rule speaks real-ish units (kg / hp / m/s)
const dryRun = process.argv.includes('--dry-run');

// ── the sedan build: the archetype's parts, seated by the garage ─────────────────────────────────
const chassis = resolveVehChassisRecipe({ family: 'unibodyPan', seed: 11 });
const wheel = resolveVehWheelRecipe({ seed: 11 });
const engine = resolveVehEngineRecipe({ family: 'veeEight', seed: 11 });
const body = resolveVehBodyRecipe({ family: 'sedanThree', seed: 11 });
const wheelFits = planComponentFit(wheel, chassis);
const engineFit = planComponentFit(engine, chassis);
for (const w of [...wheelFits.warnings, ...engineFit.warnings]) console.warn(`  fit: ${w}`);

const buildManifest = {
  kind: 'assembler',
  title: 'drive proving ground - sedan build (veeEight)',
  units: chassis.units,
  items: [
    { id: 'chassis', source: chassis },                       // authored at ride height (contact patch z=0)
    ...wheelFits.placements.map((p) => ({ source: wheel, at: p.at, ...(p.flip ? { flip: p.flip } : {}) })),
    { id: 'engine', source: engine, at: engineFit.placements[0].at },
    { id: 'body', source: body },                             // the shell superposes over its chassis
  ],
};

// ── validate at mint: the rig bakes, the drivetrain derives ──────────────────────────────────────
const baked = bakeVehicleRig(buildManifest, { targetH: CAR_H });
if (baked.warnings.length) for (const w of baked.warnings) console.warn(`  rig: ${w}`);
const drivetrain = deriveDrivetrain({
  archetype: 'sedan',
  parts: [chassis, wheel, engine, body],
  rig: baked,          // already world-scaled by targetH
  unitScale: 1,
});
if (!drivetrain) { console.error('the build derived NO drivetrain (no engine?) — not drivable'); process.exit(1); }
console.log(`sedan bakes: figH ${baked.figH}m, wheelbase ${drivetrain.wheelbase}m, wheelRadius ${drivetrain.wheelRadius}m`);
console.log(`drivetrain:  ${drivetrain.horsepower} hp, ${drivetrain.mass} kg, brake ${drivetrain.brakeForce} N`);

// ── the proving-ground world ─────────────────────────────────────────────────────────────────────
const worldManifest = {
  kind: 'controllable',
  title: 'drive proving ground - sedan (walk up, T to board)',
  note: `drivable-vehicles D4 eyes gate · drive rule v1 · build ${BUILD_REF}`,
  ground: { size: 600, cell: 6 },                             // a big flat lot to open the throttle on
  worldFraming: { cameraPosition: [12, -16, 6], lookAt: [6, 0, 1], horizontalFov: 60 },
  figures: { sedan: { vehicleRef: BUILD_REF, targetH: CAR_H } },
  pilot: 'driver',
  entities: [
    {
      id: 'driver', pilotable: true,
      transform: { pos: [0, 0, 0.85], heading: 0 },
      rule: { type: 'walk', speed: 3, turn: 2.2, stride: 1.4, eye: 0.85 },
      ambient: { type: 'static' },
      body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] },
    },
    {
      id: 'car', pilotable: true,
      transform: { pos: [8, 0, 0], heading: 0 },
      // the D3-derived feel + proving-ground tuning: topSpeed keeps the lot drivable, the rest
      // is the derive (real-ish: a 300 hp / 1450 kg sedan).
      rule: { type: 'drive', ...drivetrain, topSpeed: 32, eye: 0 },
      ambient: { type: 'static' },
      body: { type: 'figure-rig', figure: 'sedan' },
    },
    {
      // the PLANE (rules-fly.js — the second vehicle feel model). No plane shelf yet, so the
      // body is a flat wide mesh slab the tilt sync banks and pitches — the mechanics ARE the
      // read. Sporty prop numbers: rotate ~23 m/s, stall 18, vMax 70.
      id: 'plane', pilotable: true,
      transform: { pos: [-10, 6, 0.6], heading: 0 },
      rule: { type: 'fly', mass: 1200, thrust: 7200, stallSpeed: 18, takeoffSpeed: 23, maxSpeed: 70, eye: 0.6 },
      ambient: { type: 'static' },
      body: { type: 'mesh', shape: 'box', size: [4.4, 3.6, 0.7] },
    },
  ],
  camera: { rule: 'follow', target: 'driver', dist: 14, height: 6, lead: 5, lookH: 1.2 },
};

// mint-or-update, then smoke-render the REAL page (resolve + emit — a broken bind fails here)
function put(ref, manifest) {
  try {
    SketchRepository.create({ title: manifest.title, manifest, ref });
    console.log(`minted  ${ref}`);
  } catch (err) {
    if (/UNIQUE constraint failed/.test(err?.message || '')) {
      SketchRepository.update({ ref, title: manifest.title, manifest });
      console.log(`updated ${ref} in place`);
    } else throw err;
  }
}

if (dryRun) {
  console.log('dry run — nothing minted');
  process.exit(0);
}
put(BUILD_REF, buildManifest);
put(WORLD_REF, worldManifest);

// (the resolve+emit smoke lives in vitest land — resolveWorldScene transitively imports JSX
// the Next alias/transform handles; drive-world.spike.gen.test.js is the eyes-gate home.)
console.log('');
console.log(`build  ${BASE_URL}/api/sketches/${encodeURIComponent(BUILD_REF)}/world`);
console.log(`DRIVE  ${BASE_URL}/api/sketches/${encodeURIComponent(WORLD_REF)}/world`);
console.log('controls: WASD walk · T cycles driver → car → plane');
console.log('  car:   W throttle · S brake (hold past stop = reverse) · A/D steer  |  pad: RT/LT + left stick');
console.log('  plane: W throttle · A/D bank-to-turn · mouse Y or Space/Shift pitch · S airbrake/wheel brakes');
