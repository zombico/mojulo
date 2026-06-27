# controllable-world — one primitive for "control a thing in a world"

Status: building. Done & verified live — pure model ([controllable-world.js](./controllable-world.js),
tested), the `controllable` channel in [scene-three.js](./scene-three.js), and three configs rendered
headlessly: drone-through-city (glide), walk-capsule (walk+follow), and the **walking figure through a
city** (walk + `figure-frames` body + follow) — i.e. the over-shoulder spike re-expressed as pure
config on the unified primitive (Phase 4a parity).

**WIRED INTO PRODUCTION.** `resolveWorldScene` ([world-scene.js](./world-scene.js)) now passes
`manifest.entities` / `camera` / `figures` onto the payload (additive, like physics/actions), bakes
`figure-frames` figure *specs* at resolve time via `renderFigureWorldFrames` (manifest stays a recipe),
and flags `nonBakeable`. A new `kind: 'controllable'` + `assembleControllableScene` gives a standalone
stage (default floor or `manifest.faces`) so an entities-only manifest renders without piggybacking on
another kind. Verified end-to-end: a `controllable` manifest (walking figure + drone + follow camera)
rendered through the real `resolveWorldScene → emitThreeWorld` seam. The `/world` route reaches it
unchanged.

**OPERATOR-ACCESSIBLE.** `create_controllable_world`
([lib/mcp/tools/scene-controllable.js](../mcp/tools/scene-controllable.js)) mints a `controllable`
sketch from a recipe (entities + camera + figure specs), validates the rule shelf / figure refs /
camera target, stores the manifest, and returns the `/world` URL. Registered in
[server.js](../mcp/server.js) and listed in the `TOOL_INDEX` + `ROUTING_INDEX`
([lib/mcp/tools/context.js](../mcp/tools/context.js)). So an agent can now say "fly a drone through
the city" and get a live world — no hand-authoring.

**Superseded & DELETED** (zero code call sites — confirmed by trace; only spike HTMLs were generated
ad-hoc): `emitFigureWalkWorld` (→ walk + figure-frames + follow, verified live) and `emitFigureWorld`
(→ `clock` rule + figure-frames body under default OrbitControls, verified live). ~329 lines removed
from scene-three.js; the primitive now sits where they sat. The channel splits `__ctrlActive` (step
entities) from `__ctrlOwnsCamera` (drive camera + disable orbit), so a clock turntable runs under
OrbitControls while an over-shoulder/drone owns the camera.

Remaining before the LAST duplicate can be deleted (Phase 6):
- **4b — FPS-look walk**: the `walk` rule needs a `turnMode:'look'` + camera pitch to match
  `walkModeScript` (mouse-look, gravity/jump, wall-slide, head-bob). `walkModeScript` is wired as the
  `walk` toggle on EVERY world, so it is the riskiest to retire.
- **4b — physics-rule entities**: fold the actions-world `physics`/`actions` channels in as a
  `rule: physics` entity (shared integrator subscription) so the bowling playground is config too.
Only once 4b lands is deleting `emitFigureWalkWorld` / `walkModeScript` safe.

Supersedes the per-spike controllers; absorbs the actions-world physics work
([actions-world.plan.md](./actions-world.plan.md)) as one case.

## The realization

Three pieces of code today all do the same job — *input → a thing moves → the screen updates* —
and each was written from scratch:

1. **First-person walk** — `walkModeScript` in [scene-three.js](./scene-three.js): WASD +
   pointer-lock look, gravity, ground-snap, wall-slide, baked gait head-bob. The camera *is* the
   walker. (Demo: `0621/.../fractal-city-fpv.html`.)
2. **Over-the-shoulder figure** — `emitFigureWalkWorld` in [scene-three.js](./scene-three.js):
   tank controls steering a root transform, gait frame picked by distance walked, camera trails
   behind. (Demo: `0624/.../over-shoulder/walk-male.over-shoulder.html`.)
3. **Physics actions** — the `physics` + `actions` channels (actions-world): pointer/key → impulse
   / spawn / grab, bodies driven by the integrator.

They overlap ~80%: each captures input its own way, runs its own per-frame update, manages its own
camera. The walking-figure-through-a-city spike proved the deeper point — it conveys a complete
experience with **zero physics** (baked gait + kinematic steering). So physics is not the center;
the center is the *control loop*, and physics is one way to move a thing.

## The single primitive

> **An entity is a transform (position + facing) plus a RULE that updates it each frame.**

Everything in a world is an entity: the figure, the ball, the drone — **and the camera.** They are
the same shape. What differs is only:

- **the rule** — what drives the transform each frame
- **the body** — what the entity looks like (or, for a camera, that it emits the *view*)

A "figure + camera" is therefore not a special case — it is **two entities of the one primitive**,
wired so the camera's rule follows the figure. (See the camera discussion below.)

### The rule shelf (what drives a transform)

Each rule is a small function `step(entity, input, dt, world) → mutates entity.transform`:

| rule | reads | used for |
|------|-------|----------|
| `glide` | input | free fly, momentum, no gravity — camera, **drone**, spectator |
| `walk` | input + ground | WASD, gravity + ground-snap + wall-slide; advances a gait phase — figure / FPS |
| `physics` | the shared integrator | balls, anything that collides/falls (delegates to physics-sim) |
| `follow` | another entity | a chase/over-the-shoulder camera; a trailing object |
| `orbit` | input (mouse) | the default orbit camera; no target motion |
| `path` | the clock | a baked cinematic move; reuses motion-vocabulary paths |

New movement types (a boat's buoyancy, a car's ground-vehicle handling) are **new rules added to
this shelf, once** — then every boat/car is config.

### The body shelf (what an entity looks like)

| body | render |
|------|--------|
| `mesh` | a three primitive (sphere/box) — physics bodies, the drone |
| `figure-frames` | baked gait frames (the existing `packFigureFrames`); frame chosen by the entity's gait phase |
| `faces` | baked scene geometry (the static world) |
| `none` | invisible — a pure camera, or an FPS entity where the camera *is* the body |

### The camera is just an entity

A camera is an entity flagged `isCamera` (its "body" is the viewpoint it emits). Its rule is
usually `follow` (track the entity you're driving) or `orbit` (mouse) or `glide` (free spectator).
The camera modes then *fall out* of rule + target, instead of being bespoke code:

- **first-person** — one entity, `walk` rule, `isCamera`, body `none`. Camera and walker are the
  same object; you drive the camera directly.
- **over-the-shoulder** — walker entity (`walk`, `figure-frames`) + camera entity (`follow`,
  target = walker, offset behind/above).
- **orbit playground** — ball entities (`physics`) + camera entity (`orbit`).
- **drone (chase or FPV)** — drone entity (`glide`, `mesh`) + camera entity (`follow`; offset 0 =
  ride inside for FPV).

Control flows downstream: `input → the entity you drive → the camera that follows it`. The camera
is rarely "controlled" directly — it's slaved to the thing you control. Its one special trait is
its output (the view).

## How the existing three re-express

- FPS walk = `[{ rule: walk, body: none, isCamera: true }]`
- over-the-shoulder = `[{ id: hero, rule: walk, body: figure-frames }, { rule: follow, target: hero, isCamera: true }]`
- physics playground = `[ …balls with rule: physics, … ] + { rule: orbit, isCamera: true }` plus the
  world-level `actions` (spawn/kick/grab) unchanged.

And the new one this should make trivial:

- **drone through the city** = `[{ id: drone, rule: glide(+momentum), body: mesh:drone }, { rule: follow|fpv, target: drone, isCamera: true }]` over the same city `faces`. No new plumbing — only the `glide` rule (≈ the spectator camera rule + momentum) and a drone mesh.

## Two kinds of input binding (keep them distinct)

- **rule** = a *continuous* per-entity self-update (hold W to walk/thrust). This is the new shared
  machinery.
- **action** = a *discrete* world-level input→mutation (click to spawn, press to kick, drag to
  grab). This is the actions-world channel, kept as-is. Both read one shared input snapshot.

## The loop & input

One `setAnimationLoop` replaces the three:

1. capture input once → a shared snapshot `{ heldKeys, pointerDelta, buttons, pointerLock }`
2. step the shared **physics** system once (all `physics`-rule entities interact — collisions mean
   they can't be stepped independently; the rule just subscribes an entity to the solver)
3. run every other entity's rule `(entity, input, dt, world)`
4. run world-level **actions** (discrete)
5. sync each entity's body to its transform (mesh position/quaternion; figure-frame index)
6. update the active camera entity, then render

`world` carries the static `faces` for ground-snap / wall-slide raycasts (reused from
`walkModeScript`) and the collider set for physics.

## Manifest shape (additive, like physics/actions)

```
{
  kind: 'room', faces: [...],            // static world geometry (unchanged)
  entities: [
    { id, transform: { pos:[x,y,z], heading }, rule: { type, ...params }, body: { type, ...} },
    ...
  ],
  camera: { rule: 'follow'|'orbit'|'fpv', target: 'id', offset:[...], lerp },  // sugar for an isCamera entity
  actions: [ ... ],                      // discrete verbs (unchanged)
  physics: { gravity, forces, ... },     // world-level sim config for physics-rule entities
}
```

`physics.bodies` from actions-world migrates to `entities` with `rule: physics`. Anything with an
input-driven rule, a physics rule, or a discrete action is `nonBakeable` (live); a world of only
`path`/clock rules stays bakeable. The frame-zero degradation contract carries over.

## Build phases

1. **Model + loop.** Define the entity/rule/input/camera model and the single loop as a new
   `controllable` channel in `emitThreeWorld`, beside (not replacing) the existing emitters yet.
2. **Port rules.** `glide`, `walk` (lift from `walkModeScript`), `physics` (wrap actions-world),
   `follow` + `orbit` (camera). Each a small unit.
3. **Parity.** Re-express the three existing experiences as configs; verify each matches the old
   behavior (FPS walk, over-shoulder gait, physics playground) — these are battle-tested, so parity
   is the gate, not vibes.
4. **Prove extensibility.** Add `glide`→drone as a brand-new experience that is *pure config* + one
   small rule. This is the payoff test: a new "thing to move" with no new plumbing.
5. **Deprecate.** Once parity holds, fold `emitFigureWalkWorld` / `walkModeScript` / the standalone
   physics+actions wiring into the one channel and delete the duplicates.

## Risks & open questions

- **Physics entities interact.** "One rule per entity" must accommodate the shared solver — model
  physics as a world system that physics-tagged entities subscribe to (step once, then read back).
- **Parity risk.** Three mature controllers; consolidation can regress feel. Gate every phase on
  side-by-side comparison, not just "it runs."
- **Input conflicts.** pointer-drag actions vs orbit/pointer-lock camera (already a known rough
  edge); the shared input snapshot is the place to resolve precedence once.
- **rest-snap blocks held forces** (found in actions-world): a `physics`-rule entity can't be driven
  by a slow continuous force until sleep/wake is fixed — relevant if a "physics drone/car" is wanted
  vs a `glide` one.
- **Scope boundary.** This primitive is transforms + rules + camera + input. Geometry building
  (figure-frame packing, faces assembly, fractal-city) stays separate; the loop only *consumes* it.
- **Where it lives.** A `controllable` channel in `emitThreeWorld` (consistent with the existing
  channel pattern) vs a new top-level emitter. Leaning channel, so a city/room/figure world can all
  gain controllable entities the same way.
