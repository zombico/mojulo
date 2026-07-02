# actions-world — a live, interactive class of Mojulo Worlds

Status: working slice landed. Integrator (collisions + forces + spin), renderer wiring, action
verbs (impulse/spawn/grab), and emitters are built, tested, and visually verified. Event→trigger
seam deliberately deferred (see Scope). Remaining: dynamic boxes, more shapes, polish.

Files: [physics-sim.js](physics-sim.js) (pure integrator, single source of truth via `buildSim()`),
its emit into the browser + `physics`/`actions` channels in [scene-three.js](scene-three.js),
manifest passthrough + `nonBakeable` in [world-scene.js](world-scene.js). Tests:
[physics-sim.test.js](physics-sim.test.js), [actions-world.test.js](actions-world.test.js).

## The framing

An **actions-world** is a class of Mojulo World defined by **interactivity** — things *happen*
in it, either autonomously (elements acting on their own) or in response to the user. The unit
is the **action**.

**Physics is a property, not the point.** When a world carries a `physics` property, its bodies
gain a simulated-dynamics substrate (gravity, mass, collision) so that actions like "kick the
ball" have continuous, believable consequences. But an action need not be physical — it can be a
toggle (open a door, switch a light), a spawn, or a pure signal emission. Physics is the
substrate that makes *some* actions continuous; the class is the actions.

```
actions-world
├── actions      ← what can happen + what triggers it   (defines the class)
├── physics?     ← optional property: gravity + bodies w/ mass/restitution/friction
└── events?      ← in-world occurrences driving in-world reactions (stay inside the page; see Scope)
```

## Why a new class (the one fact that drives everything)

Every existing tier rests on a single invariant, stated verbatim across the codebase:

> the stored manifest is a tiny RECIPE; the full world geometry is regenerated
> deterministically; nothing heavy is ever stored — and `/svg`, `/scene`, `/world`,
> and `.glb` all resolve **identical** output from that recipe.

The current `motion` layer obeys it. Despite names like `ballisticArc` / `springSHM` /
`pendulum`, [motion-vocabulary.js](motion-vocabulary.js) is explicitly *pure — same inputs →
byte-identical outputs*: precomputed polylines sampled at equal dt, bakeable straight to GIF/MP4.
That is **animation**, not action. No accumulated state, no collisions, no input.

An actions-world is the opposite on every axis (cf. the `kick.html` spike — a hand-rolled
integrator with `mass` / `velocity` / `impulse` / `gravity` and a `mousedown` kick):

- state accumulates frame to frame,
- the trajectory is **path-dependent**,
- **user input perturbs it**.

You cannot bake that to a still or a deterministic GIF — there is no single "the output"
once a user can touch it. **That break in determinism is the reason this is a new class.**
Treat the break as deliberate and contracted, not discovered later.

## Scope boundary

- `/world` (three.js, `emitThreeWorld`) **only**. This is the sole live tier.
- `/svg` and `/scene` degrade to **frame zero / initial condition** (see Degradation contract).
- `.glb` export = initial-condition geometry only.
- In-house mini-integrator. **No** rapier / ammo / cannon (wasm weight + breaks the
  "live, dependency-free preserve-3d" ethos the scene backend is built on). `kick.html`
  already proves the hand-rolled path.

## The `physics` property (simulated matter)

Today a face carries only *optical* properties (baked `fill`, `transmit`, `cornerAlpha`, …).
When a world has a `physics` property, its bodies add the first *simulated* matter properties
Mojulo has had:

```
physics = {
  gravity: [0,0,-9.8],
  seed,                       // for reproducible no-input playthroughs
  bodies: [{
    id,                       // stable handle for actions / events
    geometry,                 // reuse existing assemblers — a body wraps baked faces
    collider: 'sphere' | 'plane' | 'aabb',   // narrow, fixed set (see Collider scope)
    mass,                     // 0 / Infinity → static (floor, ramp, wall)
    restitution,              // bounciness 0..1
    friction,                 // tangential damping on contact 0..1
    velocity: [x,y,z],        // initial linear velocity
    // (angular left out of slice 1 — see Non-goals)
  }],
}
```

Static world geometry (ground, ramps, walls) is just bodies with `mass: 0`. Existing spatial
kinds (`room`, `floorplan`, `fractal-city` streets) can host a `physics` property without
becoming a different kind.

## `actions` (the defining channel — declared, not implicit)

Actions are data on the manifest, bound to input/time at render time:

```
actions: [
  { on: 'pointer', do: 'impulse', target: 'ball', gain: 5 },   // kick
  { on: 'drag',    do: 'grab',    target: 'ball' },
  { on: 'key', key: 'space', do: 'spawn', template: 'ball' },
  { on: 'pointer', do: 'toggle', target: 'door' },             // non-physics action
]
```

`do` verbs split into **physics actions** (`impulse`, `grab`, `spawn` — require the `physics`
property) and **kinematic actions** (`toggle`, `move`, `emit` — work without it). `emitThreeWorld`
already owns the only three.js surface and already reads channels (`movers`, `signs`). Add an
`actions` channel + a fixed-timestep sim loop beside the existing rAF render. Input mutates body
state; render reads body transforms each frame. Faces stay **unlit `MeshBasicMaterial` +
vertexColors** — actions move the mesh, they do not relight it. The baked-light identity is
untouched.

## Scope as of now: a PURE world depictor with rules (no substrate wiring)

The goal is a **self-contained, interactive world** — a depictor whose declared *rules* make
dynamic action happen, either autonomously (elements acting on their own) or under user input.
It renders, runs, and responds entirely inside the `/world` page. It does NOT (yet) talk back
to mojulo.

Explicitly EXCLUDED — and not merely "later":
- event → trigger / `emit_chat_signal` / `bind_trigger` wiring (the "input device for the
  substrate" idea). The integrator already surfaces `state.contacts` + `body.resting` per step,
  so the detection edges exist when we want them — but nothing routes out of the page today.

This is a **portability guardrail, not a roadmap gap.** A self-contained world is just HTML+JS:
it can be exported, embedded, and run anywhere with zero dependency on mojulo, the agent, or the
localhost MCP transport. The moment a world calls back into the agent/substrate it is tethered to
*this host* — dead on arrival anywhere else. Portability and the determinism contract are the same
contract from two angles: fixed-timestep + seeded + **no outbound calls** is what makes a no-input
playthrough byte-reproducible AND what makes the artifact self-contained. Agent-in-the-loop breaks
both at once. mojulo's role is to *compose and mint* the world (deliberation anchor + audit trail),
not to be its runtime — the thing that "keeps running after the chat ends" is the portable artifact,
precisely because the chat/agent isn't in it.

Trap to watch: the `emit` verb stays **in-world** (it drives in-world reactions via the event-bus).
It must never quietly become an outbound `emit_chat_signal`; the naming collision with the deferred
"second bus" is the easy place to violate this. If world→substrate ever returns, it returns as an
explicit opt-in *export mode* that consciously trades portability away — never as a default baked
into the runtime.

So the work ahead is about RULES, not plumbing: broaden what dynamic action a world can express.

## Degradation contract (write this down now)

| Tier | actions-world resolves to |
|------|------------------------|
| `/svg`   | frame zero, server-rasterized still |
| `/scene` | frame zero, preset preserve-3d shots |
| `/world` | **live**: integrator + collisions + actions |
| `.glb`   | initial-condition geometry |
| motion encode (GIF/MP4) | only for the **no-input** subset; record a seeded fixed-timestep playthrough |

Determinism is preserved exactly until the user touches the world: **fixed timestep +
seeded**, so a no-input playthrough is byte-reproducible. We sacrifice determinism only on
actual input. That keeps the export/encode story alive for the passive case.

## Collider scope (slice 1 — keep it narrow)

- sphere ↔ plane (ball on ground/ramp)
- sphere ↔ sphere (ball ↔ ball)
- sphere ↔ aabb (ball ↔ box/wall)
- semi-implicit Euler, fixed dt (e.g. 1/120 s), accumulator-clamped
- positional correction + restitution/friction impulse resolution

That covers kick-a-ball, ramps, dominoes-as-aabb, simple arenas. A few hundred auditable lines.

## Non-goals (slice 1)

- Angular velocity / rotational inertia / torque (bodies translate; no spin). Revisit once
  translation + contacts are proven snapshot-clean.
- Soft bodies, cloth, fluids (the `fluid-view` / `ocean-view` kinds stay *visualizations*).
- Stacking stability / sleeping islands beyond a basic rest threshold.
- A general constraint solver (joints) — pendulum stays a `motion` rule unless interactive.

## Build phases

1. **Integrator, pure + tested.** `physics-sim.js` beside `motion-vocabulary.js`:
   pure, no three.js, node-testable. `step(state, dt) -> state'`. Snapshot tests for a
   seeded no-input drop/bounce (must be byte-stable — proves the determinism claim). ← IN PROGRESS
2. **Collider set** (the four pairs above), each unit-tested in isolation.
3. **Renderer wiring.** `emitThreeWorld` gains the sim loop + body→mesh transform sync,
   behind the `physics` channel. Faces still unlit. Verify `/world` renders frame zero
   identically to `/svg` (degradation contract).
4. **Actions channel.** pointer/drag/key → impulse/grab/spawn/toggle.
5. **Rule vocabulary.** Broaden what makes action happen: autonomous force/field rules
   (wind, drag, attractors), constraint rules (springs/tethers → pendulums, chains), more
   action verbs (spawn/grab). This is where "rules that allow dynamic action" gets real depth.
6. ~~Event → trigger seam.~~ DEFERRED (see Scope above).
7. **`world-scene.js` dispatch + `nonBakeable` flag.** (passthrough + flag already wired.)

## Decisions settled

- **Class name:** `actions-world`. Physics is a `property`, not the class.
- **Manifest:** additive `physics` + `actions` + `events` blocks on existing spatial kinds
  (not a `sim-*` kind prefix). Any manifest carrying a non-trivial `physics.bodies` is flagged
  `nonBakeable` at resolve time in [world-scene.js](world-scene.js) — explicit clause.

## Open questions

- Event transport: does the bot-proxy / loopback boundary cleanly carry a `/world` →
  substrate post, or is a new tiny endpoint warranted? (Respect: MCP transport is
  localhost-only, no tunnels.)
- How much of `kick.html`'s hand-rolled integrator is worth lifting vs rewriting clean for
  the pure/tested constraint in phase 1.
