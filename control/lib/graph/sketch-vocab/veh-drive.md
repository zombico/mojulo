---
{ "id": "veh-drive", "name": "Drivable vehicles (the drive rule + affordance facts)", "summary": "board and DRIVE a designed veh-* build inside a controllable world: the `drive` rule is a pure kinematic longitudinal controller (horsepower-shaped acceleration, brakes that fight mass, bicycle-model steering, distance-true wheel roll), entered through the existing entities schema as a pilotable's pilotRule; drivability derives from the parts (deriveDrivetrain — no engine, not drivable), the wheel rig from the build's axle sockets (deriveVehicleRig/bakeVehicleRig, delivered via figures.vehicleRef), and every frame surfaces NAMED affordance facts later effect layers bind against", "when": "make a car/truck drivable / drive the sedan in a world / board a vehicle and drive it / hook a designed vehicle into a controllable world / wire engine tone or brake lights or skid marks to driving", "tier": "recipe", "marks": [], "phase": "p1" }
---

A drivable vehicle is a COMPOSITION over existing seams (drivable-vehicles.plan.md —
nothing here is a new tool):

- **Rig** (D1): `deriveVehicleRig(build)` classifies an assembler build's items into
  `root` + `wheelFL/FR/RL/RR` bones by matching wheel placements to the chassis's
  derived axle sockets BY POSITION; `bakeVehicleRig` lowers to the packed rig-figure
  format with one `roll` clip (phase = one wheel turn). Delivered in a world manifest
  via `figures: { car: { vehicleRef: 'sk_…', targetH? } }` — explicit beside
  `unitRef`, which stays biped-only.
- **Rule** (D2): `rule: { type:'drive', horsepower, mass, wheelbase, wheelRadius, … }`
  — real-ish units (kg, hp, meters). F = P/v capped by traction; brakeForce vs
  momentum; quadratic drag + rolling resistance; slewed bicycle steering tightened
  with speed; ground-locked (ledges followed down at a clamped rate). Registered in
  the engine (`rules-drive.js` builder) — accepted by the mint alongside walk/platform.
- **Drivetrain** (D3): `deriveDrivetrain({ archetype, parts, rig, unitScale })`
  composes the engine part's `garage.drivetrain.horsepower` (transverseFour <
  inlineFour < vintageStacks < veeEight), the archetype's `curbMass` + `brake` row,
  and the rig's wheelbase/wheelRadius into the rule params. **No engine part → null →
  not drivable.** The trailer is not drivable BY DATA.
- **Board/dismount**: the car is a `pilotable` whose pilotRule is `drive` (ambient
  `static`); T (`input.swap`) walks up and boards — zero new machinery.

## The affordance facts (D5 — named once, bind effects later)

| Fact | Type | Effect it affords (later) |
|---|---|---|
| `locomotion:'drive'` | state | clip/body selection (consumed by the rig delivery) |
| `speed` | state (signed u/s) | engine tone macro, speed-lines, camera FOV |
| `wheelPhase` / `wheelSpin` | state | wheel roll (consumed NOW by the `roll` clip) |
| `steerAngle` | state (rad, + = left) | front-wheel yaw visual (deferred D1 follow-up) |
| `throttle` | state 0..1 | exhaust puffs, engine pitch |
| `braking` / `brakeStart` | state + edge | brake-light role (`veh-lights` `light`), skid sfx |
| `skidding` / `skidStart` | state + edge (lateral demand > grip·g) | tire marks, screech |
| `boarded` | edge (first driven frame) | door sfx, camera cut (dismount rides the pilot swap) |

The fx/sfx channels and beats world-bindings already match on entity state and event
types — these facts are the stable names they bind against. The F key is RESERVED
while driving (handbrake vs boost — plan open decision 1).
