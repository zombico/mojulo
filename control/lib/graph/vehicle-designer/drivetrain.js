/**
 * drivetrain.js — deriveDrivetrain (drivable-vehicles.plan.md, D3): walk a build's parts, find
 * the engine's `drivetrain` seed (veh-engine.js, D3 data), take the archetype's curb mass and
 * brake row (assembly-bom.js), and return the `drive` rule's params. DRIVABILITY IS DATA: no
 * engine part → no drivetrain → returns null, and the entity refuses a `drive` pilotRule with a
 * clear error upstream. The trailer is not drivable BY DATA (its bom carries no veh-engine).
 *
 * `rig` (optional) is a D1 bake — its wheelbase/wheelRadius fold in through `unitScale` (the
 * shelf speaks cm; the drive rule speaks real-ish meters — one tuning constant, per the plan's
 * open decision 3; a bake already scaled by targetH passes unitScale 1).
 */

import { VEH_ARCHETYPES } from './assembly-bom.js';

const G = 9.81;

export function deriveDrivetrain({ archetype, parts, rig = null, unitScale = 1 } = {}) {
  const row = VEH_ARCHETYPES[archetype];
  if (!row) throw new Error(`deriveDrivetrain: unknown vehicle archetype '${archetype}' - expected one of: ${Object.keys(VEH_ARCHETYPES).join(', ')}`);
  const engine = (Array.isArray(parts) ? parts : []).find(
    (p) => p && p.garage && p.garage.kind === 'veh-engine' && p.garage.drivetrain && Number.isFinite(p.garage.drivetrain.horsepower),
  );
  if (!engine) return null;   // no engine → not drivable; the caller surfaces the refusal
  const mass = row.curbMass;
  const out = {
    horsepower: engine.garage.drivetrain.horsepower,
    mass,
    // trucks pin an absolute `brake` (their brakes don't scale with the load — they stop LONG);
    // everything else defaults to μ_brake 0.8 over its own weight.
    brakeForce: Number.isFinite(row.brake) ? row.brake : Math.round(mass * G * 0.8),
  };
  if (rig) {
    if (Number.isFinite(rig.wheelbase)) out.wheelbase = rig.wheelbase * unitScale;
    if (Number.isFinite(rig.wheelRadius)) out.wheelRadius = rig.wheelRadius * unitScale;
  }
  return out;
}
