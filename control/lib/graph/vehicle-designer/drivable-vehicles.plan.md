# Drivable vehicles — the veh-* shelf meets the controllable world

Successor to `vehicle-designer.plan.md` (archived at
`lite-template/integration/plan-archive/vehicle-designer.plan.md`; V0–VA
landed, shelf consolidated in this folder). This plan promotes roadmap item
VE from "optional wheel-spin rig" to the real thing: a designed vehicle you
can walk up to, board, and DRIVE inside a controllable world — with momentum
from a force model, horsepower seeded on the engine parts, brakes that fight
mass, and named affordance facts for visual/audio effects LATER.

## The thesis

The veh-* shelf and the worlds engine have never met. A designed sedan is
static workbench geometry; a controllable world's only locomotion is legs
(walk/platform), thrusters (boost/space), or free flight (glide). But the
survey shows every hard problem is already solved by an existing seam —
this plan is mostly CONSUMING data and patterns that are sitting there
unread:

1. **Mount/dismount exists.** `pilotable` entities carry a `pilotRule`
   (under the player) + `ambientRule` (vacated), and T (`input.swap`)
   transfers the pilot between them (`worlds/controllable-world.js:3091`).
   A car is a pilotable whose pilotRule is `drive`. Zero new machinery.
2. **The animation driver is the gait driver.** Walking figures animate by
   a scalar phase advanced by ground distance ÷ stride
   (`worlds/controllable-world.js:437`, `scene/channels/walkers.js:132`).
   A rolling wheel is the same driver with stride = 2πr — and every
   veh-wheel already carries `dims.radius`, `localFrame.axle:'x'`, and
   `hardpoints.hubCenter` in its garage block (`veh-wheel.js:315-330`).
   Nothing consumes that data today; this plan is its consumer.
3. **The player is kinematic, and that is the pattern.** The platform rule
   is explicitly NOT a rigid body (`worlds/controllable-world.js:443-444`)
   — a tuned controller with its own gravity/momentum math, z from the
   `world.ground` raycast hook, walls via `resolveBlocking` (kill the
   inward velocity component, slide the rest — `:197-240`). The drive rule
   is the same species: a longitudinal-dynamics controller, NOT a
   four-wheel rigid-body sim. `physics-sim.js` stays untouched.
4. **The garage already knows the geometry.** `deriveAxleSockets` returns
   FL/FR/RL/RR hub sockets, sides from POSITION never ids
   (`veh-garage.js:39-64`) — which gives the rig its wheel bones and the
   drive model its wheelbase for free.

What is genuinely new: one rule (`drive`), one rig deriver + bake
(`deriveVehicleRig`/`bakeVehicleRig`), one drivetrain-seeding pass on the
part shelf, and one world-scene binding (`vehicleRef`). Everything else is
reuse.

## What we deliberately do NOT build

- **No rigid-body vehicle.** No per-wheel suspension, no tire slip model,
  no torque curves. Force-based longitudinal math gives the momentum FEEL
  (heavy stops long, power fades at speed); the sim stays out of it.
- **No visual/audio effects.** Exhaust, skid marks, engine tone, working
  headlights are LATER bindings. This plan only guarantees the named facts
  they will bind against (§ D5) — the fx/sfx channels
  (`worlds/world-scene.js:394-399`, `scene/channels/fx.js:70`) and the
  beats world-bindings already match on entity state and event types.
- **No new MCP tool.** `compose_world` + `create_assembler` already cover
  minting; the drive rule enters through the existing `entities` schema
  (same posture as the VD catalyst decision in the parent plan).

## Conventions pinned up front

- **Vehicle frame** unchanged from the shelf: `+y` forward of travel,
  `+z` up, `+x` right (`veh-garage.js:13`).
- **The drive rule is pure.** Reads only the input snapshot + `world`
  hooks, writes only its entity — same contract as walk/platform, so it
  replays deterministically and tests headless in Node.
- **Drivability is data.** A build derives a drivetrain from its parts; no
  engine part → no drivetrain → not drivable. The trailer stays a row, not
  a special case (the assembly-bom doctrine).
- **Input mapping reuses the snapshot** (`channels/controllable/index.js:856`):
  `forward` = throttle/brake-reverse, `turn` = steer, `boost` (F) reserved
  for a later handbrake/boost decision (§ open decisions). No new keys.
- **Facts are named once, here** (§ D5), so later effect layers bind
  against a stable vocabulary.

## The phases

### D1 — `deriveVehicleRig` + `bakeVehicleRig` (the VE rig, promoted)

New `vehicle-rig.js` in this folder, mirroring the biped pair
(`worlds/unit-pose.js:134` deriveBipedRig / `worlds/unit-rig.js:912`
bakeUnitRig):

- `deriveVehicleRig(manifest)` — takes an assembler build of veh-* parts.
  Classifies items into vehicle bones: `root` (chassis + everything welded
  to it: body, lights, payload, interior) and `wheelFL/FR/RL/RR`. Wheels
  are found by matching item placements to the chassis's derived axle
  sockets BY POSITION (`deriveAxleSockets`, `veh-garage.js:39`) — the ms
  rule, inherited verbatim. Output mirrors the biped rig shape: `{ model:
  'vehicle', facing, bones, wheels: [{ bone, side, axle, hubCenter,
  radius, spinAxis }], wheelbase, track, warnings }`. Radius and hub come
  from each wheel item's `source.garage` block (`veh-wheel.js:323-329`).
- `bakeVehicleRig(manifest, opts)` — lowers to the SAME packed rig-figure
  format `bakeUnitRig` emits (bones + per-clip pose curves), so the
  browser's existing `figure-rig` body path renders it unchanged. One
  clip: `roll` — phase ∈ [0,1) rotates each wheel bone 2π about its hub
  axis. The renderer's phase driver does the rest.
- **Steering visual**: the gait machinery is single-phase, so front-wheel
  steer yaw needs a second channel. The aim-blend machinery suits use for
  arm aiming is the likely template; if it resists, steer yaw ships in a
  later pass — D2's bicycle-model HEADING (the whole car yawing) carries
  the read of "it turns" on its own. Do not block on this.

Gate: unit test derives a sedan build (chassis + 4 wheels + body via
`planComponentFit`) → 4 wheel bones classified FL/FR/RL/RR by position,
wheelbase = front/rear socket y-distance; bake emits the packed format and
a probe frame shows wheel vertices displaced between phase 0 and 0.5.

### D2 — the `drive` rule

New rule in `worlds/controllable-world.js` (`RULES`, `:1630`) + mint
acceptance in `KNOWN_RULES` (`lib/mcp/tools/scene-controllable.js:23`).
A pure kinematic ground-vehicle controller, sibling of platform:

- **State on the entity**: signed scalar `speed` along heading (the
  longitudinal model is 1-D; heading owns direction), `steerAngle`,
  `wheelPhase`.
- **Throttle** (`input.forward > 0`): engine force
  `F = min(powerN / max(|v|, vFloor), tractionCap)` — the real power
  curve `F = P/v`, capped by traction at low speed so horsepower shapes
  acceleration falloff naturally. `powerN` derives from horsepower (× 745.7
  W), `tractionCap ≈ grip · mass · g`.
- **Brake / reverse** (`input.forward < 0`): while moving forward, apply
  `brakeForce` opposing motion (momentum vs. mass, explicitly); at
  standstill, reverse at a capped `reverseSpeed`. Arcade-standard S.
- **Coasting**: quadratic drag `½ρ·cdA·v²` + constant rolling resistance,
  so lifting off decays speed believably (the walker's flat damping reads
  wrong for a car).
- **Steering**: bicycle model — `headingRate = v / wheelbase · tan(steer)`,
  with `steer` slewed toward `input.turn · steerMax` at `steerSpeed` and
  `steerMax` tightened as speed rises. Wheelbase comes from the rig (D1),
  so a long truck genuinely turns wider than a coupe.
- **Wheel spin**: `wheelPhase += v · dt / (2π · radius)` — distance-true,
  no skate; drives the D1 `roll` clip exactly as gaitPhase drives walks.
- **Vertical + walls**: z from the `world.ground` probe (walk's hook,
  `:434-435`); walls via `resolveBlocking` — inward velocity dies, the
  slide component survives, so momentum against a wall behaves right for
  free. Ground-locked in v1 (no airborne cars; a fall off an edge follows
  the probe down at a clamped rate — revisit if a world wants jumps).

Rule params (all with tuned defaults):
`{ horsepower, mass, brakeForce?, topSpeed?, wheelbase, wheelRadius, grip?,
drag?, rollResist?, steerMax?, steerSpeed?, reverseSpeed?, eye? }`.

Gate: headless determinism test (same inputs + dt → identical replay,
house standard) + physics-shape assertions: double the horsepower →
measurably faster 0→15 u/s; double the mass → longer braking distance;
turning radius at steady speed ≈ wheelbase / tan(steer).

### D3 — seed the drivetrain in the parts

The "engines with horsepower" layer. Data lands ON the parts; a deriver
composes the feel:

- `veh-engine.js`: each family's garage block gains
  `drivetrain: { horsepower }` — as data, per family (transverseFour <
  inlineFour < vintageStacks < veeEight; exact numbers tuned at the gate).
- `assembly-bom.js`: `VEH_ARCHETYPES` rows gain `curbMass` (kg-ish in
  world units; sedan < suv < towtruck) and optional `brake` overrides.
- New `deriveDrivetrain({ archetype, parts })` in this folder, exported
  from the barrel: walks a build's parts → finds the engine's
  `drivetrain`, the archetype's mass, defaults `brakeForce = m·g·μ_brake`
  → returns the D2 rule params (+ wheelbase/wheelRadius from the D1 rig).
  No engine part → returns null → the entity refuses a `drive` pilotRule
  with a clear error. The trailer is not drivable BY DATA.

Gate: unit test — sedan derives (veeEight beats transverseFour on
horsepower), trailer derives null, towtruck's mass exceeds the coupe's and
its derived braking distance is longer under the D2 model.

### D4 — the world binding

- `worlds/world-scene.js` figures map (`:263-336`) gains `vehicleRef:
  'sk_…'` beside `unitRef` — explicit, keeping `unitRef` biped-only.
  Loads the stored assembler build, bakes via `bakeVehicleRig`, delivers
  as the existing `figure-rig` body type. Mint validation in
  `scene-controllable.js` accepts it wherever `unitRef` is accepted.
- The composed manifest for a drivable car is then just:

  ```
  figures: { sedan: { vehicleRef: 'sk_…' } },
  entities: [
    { id:'player', rule:{ type:'walk' }, body:{…} },
    { id:'car', pilotable:true,
      rule:{ type:'drive', ...deriveDrivetrain(…) },   // pilotRule
      ambientRule:{ type:'static' },
      body:{ type:'figure-rig', figure:'sedan' } },
  ]
  ```

  Walk up, T to board (existing swap), drive, T to hop out.
- Camera: the existing `follow` rule chase-cam targets the car when
  piloted — verify the framing reads at car speeds; tune `follow`
  distance knobs only if needed.

Gate: the eyes-gate spike, in the boost-hover mold
(`worlds/boost-hover.spike.gen.test.js`): mint a proving-ground world
(sedan + walking player), replay deterministic ticks — board via swap,
40 throttle, 40 coast, 40 brake, a steer arc — assert speed rises then
decays then stops, heading sweeps the predicted arc, wheelPhase matches
distance/2πr; write the frame strip (board / cruise / corner money shots).

### D5 — the affordance vocabulary (named facts, no effects)

The drive rule surfaces state + edges on the entity, then STOPS. This is
the seam later effect layers bind against — the fx/sfx channels match
entity state and event types (`scene/channels/fx.js:70`), zone events
already fire from entity positions (`worlds/event-bus.js:462`), and beats
world-bindings already read sim state for audio macros:

| Fact | Type | Effect it affords (later) |
|---|---|---|
| `locomotion:'drive'` | state | clip/body selection (exists via D1) |
| `speed` | state (signed u/s) | engine tone macro, speed-lines, camera FOV |
| `wheelPhase` / `wheelSpin` | state | wheel roll (consumed NOW by D1) |
| `steerAngle` | state | front-wheel yaw visual (D1 follow-up) |
| `throttle` | state 0..1 | exhaust puffs, engine pitch |
| `braking` | edge + state | brake-light role (`veh-lights` `light` role), skid sfx |
| `skidding` | edge + state (lateral demand > grip) | tire marks, screech |
| `boarded` / `dismounted` | edges (from the swap) | door sfx, camera cut |

Gate: doc-level — this table lands in the shelf's vocab (a `veh-drive`
card or a section on the chassis card) so agents composing worlds can
discover the vocabulary; a test asserts the fields exist on a stepped
drive entity.

## Order and independence

D1 and D2 are independent (rig vs. rule) and can land in either order;
D3 needs only the shelf; D4 needs all three; D5 is mostly naming and rides
D2/D4. Suggested: D2 first (the feel is provable headless with a box
body), D1 beside it, then D3 → D4 → D5.

## Open decisions (recommendations inline)

1. **F key while driving** — handbrake (drift-lite: drop grip on the rear
   axle heading calc) vs. boost. Recommend RESERVING it (no-op) in v1;
   decide when a world wants it. Both fit the input snapshot unchanged.
2. **Steer visual channel** (D1) — aim-blend template vs. defer. Recommend
   attempting the aim-blend analog once, timeboxed; defer without guilt —
   body yaw carries the read.
3. **Units for mass/power** — real-ish (kg, hp) mapped through one
   tuning constant, vs. abstract "feel" numbers. Recommend real-ish: the
   shelf already speaks real units (`units` on workbench manifests), and
   "a 300 hp car" is the vocabulary the operator will reach for.
4. **AI drivers** — the `ai` rule is combat-shaped, not path-shaped.
   Ambient traffic (cars driving city loops the way `walkers.js` drives
   pedestrians) is a natural NEXT plan on top of D1's rig + a path
   follower; explicitly out of scope here.
