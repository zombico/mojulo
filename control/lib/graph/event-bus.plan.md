# event-bus — deterministic in-tick reactions for actions-worlds

Status: Phases 1–2 landed. Phase 1 = pure reducer ([event-bus.js](event-bus.js)) + the full
7-assertion harness ([event-bus.test.js](event-bus.test.js), all green): isolated reactions,
`emit` chaining, depth + budget caps (loud), stale-ref no-ops, scope-keyed sequences. Phase 2 =
`deriveEvents` turns the integrator's per-step `contact`/`rest` detections into bus events
(edge-triggered, source-allowlisted), with a real physics→bus integration suite
([event-bus.physics.test.js](event-bus.physics.test.js): a dropped ball lights a goal, floor
strikes spawn splashes, end-to-end determinism holds across the seam). Phase 5a = the `/world`
EVENTS channel — `buildBus().toString()` emitted beside the physics channel in
[scene-three.js](scene-three.js), `stepEvents(t)` after `stepPhysics(t)`, verb effects reflected
onto marker meshes, `window.__mojBus` exposed
([event-bus.scene.test.js](event-bus.scene.test.js)). Remaining: 5b (reactions reaching back into
physics), `world-scene.js` passthrough, world→substrate publish (separate). Extends the `events`
seam reserved in
[actions-world.plan.md](actions-world.plan.md) — but scoped to the **in-world** bus only
(everything stays inside the `/world` tick). The world→substrate transport (Phase 6 of the
actions-world plan, `emit_chat_signal` / `bind_trigger`) is a *separate, later* channel and is
explicitly out of scope here; see Two buses.

Files (planned): reactions/event reducer beside [physics-sim.js](physics-sim.js) (pure,
node-testable), emit into the browser + `events` channel in [scene-three.js](scene-three.js),
manifest passthrough in [world-scene.js](world-scene.js). Harness: `event-bus.test.js`.

## The framing — what we are actually building for

The bus is infrastructure whose value is **invisible until many events fire at scale and
nothing breaks**. A three-event demo looks identical whether the bus is sound or held together
with tape; the tape only tears when ~hundreds of events collide in a tick in an order nobody
pinned. So the design target is not "events work" — it is **correctness-under-load**, and the
deliverable that proves it is a replay/fuzz harness, not a demo.

The one fact that makes that provable: actions-worlds already run a **fixed-timestep, seeded**
loop, so a no-input playthrough is byte-reproducible (the determinism contract in
[actions-world.plan.md](actions-world.plan.md)). That gives us an **oracle** most event systems
never have: hash the final state, replay, assert identical. *The thing you can't see, you can
hash.* Every rule below exists to keep that oracle valid at scale.

## Mechanism vs policy — physics emits facts, rules assign meaning

This is the *why* behind every schema decision below; the rest of the file is the *what*.

The physics step knows **what happened** and nothing about what it *means*. It emits physical
truths — `contact(a, b, point, impulse)`, `rest(body)`, `enter(entity, region)`,
`threshold-cross` — that are true regardless of what game is being played. The integrator has
never heard of a "pocket," a "goal," or a "point." The **rules layer assigns meaning** to those
truths, declaratively, at the membrane:

> A pocket is just a region. *Potting* is just `contact(ball, pocket-region)`. Nothing in the
> physics knows that — a rule **declares** that this contact means "potted."

The failure mode this forbids: hand-authored sims let game logic reach *into* the physics step
("while integrating, also check if the ball is in a pocket and bump the score"). That reach-in
fuses mechanism and policy into one tangle. **The bus forbids the reach-in** — physics emits,
rules react, neither imports the other. Every time you're tempted to teach the physics what a
pocket is, that's the bug; push it back across the membrane into a rule.

What the separation buys (each is a consequence, not a feature we add):

1. **One substrate, many games.** The same integrator becomes billiards / shuffleboard /
   demolition / a platformer / domino art purely by swapping the rule-set attached to it,
   because the physics carries no game knowledge.

   | Physical fact | Rule's interpretation | World |
   |---|---|---|
   | `contact(ball, region)` | potted → despawn + score | billiards |
   | `rest(ball, region)` | delivered → score by distance | shuffleboard / curling |
   | `contact(a,b)` `impulse>τ` | shatter → spawn fragments | demolition |
   | `enter(entity, region)` | trap sprung → spawn hazard | platformer |
   | `contact(domino, domino)` | kick → impulse neighbor | chain-reaction art |

2. **Facts carry magnitudes → quantitative rules → emergence.** `contact` carries point,
   normal, impulse, so a rule can threshold on physical quantity (`speed > τ` → "rattles out"
   → re-impulse). Combined with verbs that feed *back* into physics (`impulse`, `spawn`), the
   membrane is bidirectional: a single local rule ("a domino kicks its neighbor on contact")
   produces global behavior (the whole chain) that nobody storyboarded.

3. **The membrane is a test seam.** Policy is testable with synthetic events and *no physics
   running*; mechanism is testable with *no rules attached*. Harness assertions 1–7 lean on
   exactly this split.

The actual design work this exposes: the **fact vocabulary** (`sources`) is the interface
between mechanism and policy. Make it rich and quantitative and rules can express almost any
game; make it impoverished and rules starve.

## Compute is truth; render is projection (the ordering that makes mojulo not-a-game-engine)

A game engine *simulates reality* — the simulation is the product, experienced live, and the
event is transient scaffolding that exists to drive the next frame. Deciding, recording, and
showing are not separated; the truth is usually neither canonical nor reproducible (variable
timestep, float drift, logic in render-coupled callbacks), and nothing is kept.

Mojulo inverts the priority. The tick is a deterministic, seeded **function**; within it the
order is strict:

```
decide   → physics + bus reduce the tick to canonical state + an event record
record   → events are the durable artifact (the same DNA as turn-hashing: content_hash/chain_hash)
project  → meshes sync, renderer draws — a READ-ONLY view of an already-decided truth
```

By the time a single pixel is drawn, **the goal has already occurred in the data.** The renderer
never decides anything — it executes a foregone conclusion. The frame is the disposable artifact;
the **event is the product.** This is why `/svg`, `/scene`, `/world`, and `.glb` can all be
honest projections of the same recipe, and why replay/undo/instant-replay are free rather than
bolted on: there is one authoritative computed truth and N interchangeable views of it.

That ordering — decide, record, then project — is also what makes the world→substrate transport
(the *other* bus) coherent: you can route a goal outward to mojulo because it is a recorded fact,
not a rendering side-effect.

## Conceptual triggers: a fact is an edge on a predicate; physics is one family

`contact` and `rest` were never special — they are built-in PHYSICS predicates. The general
mechanism is a **watch**: a declarative predicate over world state, edge-triggered (fires the tick
its condition flips false→true, same `prev`-snapshot discipline). This makes non-physics,
purely-conceptual triggers the general case, with physics as one source. Three pieces (all DONE,
[event-bus.js](event-bus.js); proven with zero physics in
[event-bus.conceptual.test.js](event-bus.conceptual.test.js)):

1. **Conceptual state — `vars`.** A bag of named non-physical quantities (score, keys, phase,
   temperature, flags). Where *meaning* accumulates, vs physics' positions/velocities. Folded into
   `hashState`, so the determinism oracle still covers it.
2. **State verbs — `set` / `inc`.** Write `vars` (no entity target), beside the entity verbs
   (toggle/move/spawn) and `emit`.
3. **`watches` — `watchEvents(state)`.** Each `{ type, when }` emits its event on the edge the
   predicate becomes true. The `when` vocabulary is deliberately small (no scripting language):
   - `{ var:'score', gte:10 }` — a var vs a number (`gte/gt/lte/lt/eq/ne`)
   - `{ count:'potted', gte:3 }` — count of logged events of a type
   - `{ entity:'reactor', field:'z', gt:5 }` — an entity field (incl `x`/`y`/`z`)
   - `{ all:'lever-*', field:'on', eq:true }` / `{ any:… }` — aggregate over matching entities

The loop closes with NO physics in it: a reaction `inc`s a var → a watch fires → a reaction
toggles a door → a watch on the door fires. Pure in-world state machine. Call `watchEvents` AFTER
`processEvents` each tick and loop to a fixed point (depth-capped) so a var written by a reaction
can trip a watch the same tick; deeper sensor→actuator→sensor loops settle across ticks (one
sample per tick, physically reasonable). Wired into the `/world` channel via `__watchFix()`.

### Four sources, one bus

With this, every trigger is a *source* feeding the same deterministic bus: **physics facts**
(`deriveEvents`), **timers** (sequence `await`), **conceptual watches** (`watchEvents`), and
**input** (`events.inputs`: bind key/pointer → a bus event, queued and drained each frame; the
`/world` channel wires `__inputQueue`). Bus entities carry optional `color`/`radius` so conceptual
entities render as legible markers.

Proof: a purely physics-FREE clickable world, [conceptual-vault.js](conceptual-vault.js) +
[conceptual-vault.test.js](conceptual-vault.test.js) — grab three keys (keys 1/2/3 → input
source), an `all key-* off` aggregate watch unlocks the gate, a timed sequence reveals the
treasure. The page emits the events + input channels and **no physics channel at all**
(spike: `integration/0627/spike-output/conceptual-vault/world-vault.html`).

## The trap we are avoiding

A web-style `EventEmitter` (`.on('hit', cb)`, fire-and-forget closures, async handlers)
dissolves the determinism contract: handler order is unpinned, async handlers cross frame
boundaries, arbitrary closures mutate arbitrary state. Then no replay, no bake, no frame-zero
degradation. **Yes to events, no to an EventEmitter.** The bus is a *deterministic in-tick queue
with declarative reactions*, same discipline as the existing `actions` and entity `rules`.

## Two buses (do not conflate)

1. **In-world bus** (this plan) — lives in the browser tick, deterministic, never leaves the
   page. Sources: contact, rest, region-enter, timer, input, emitter-spawn, sequence-step.
2. **World→substrate transport** (the actions-world `events` block, deferred) — async,
   fire-and-forget, crosses loopback to mojulo. A thin allowlist decides which in-world event
   *types* are also published outward. Its async nature must never leak back into the tick.

## The two reaction shapes (the isolated / sequenced axis)

- **isolated** = fan-out pub/sub. One event, N independent reactions, no ordering between them,
  all resolved within the tick. "Ball hits floor → spawn dust AND wobble lamp." Neither cares
  about the other.
- **sequenced** = a saga keyed by **scope**. Ordering is total *within* a scope key, fully
  concurrent *across* keys. Scope is an id (entity / region / recipe), never a hand-listed
  participant set — that is what makes "doesn't block anything but its own parties" automatic:
  east-wing doors and west-wing doors are different keys, so they advance independently with
  zero coordination.

## Manifest schema (additive, sits beside `physics` / `actions` / `entities`)

```
events: {
  // SOURCES — what the loop turns into events each tick. Most already exist as detections;
  // this just names which to surface. type strings are the bus vocabulary.
  sources?: [
    { type: 'contact',  when: { a: 'ball', b: 'ground' } },   // from state.contacts
    { type: 'rest',     when: { body: 'ball' } },             // from body.resting edge
    { type: 'enter',    when: { entity: 'hero', region: 'gate' } },
    { type: 'timer',    every: 2.0, id: 'pulse' },            // deterministic, dt-accumulated
  ],

  // REACTIONS — isolated fan-out. on:type → verb. Verbs are the EXISTING action verbs
  // (impulse / spawn / toggle / move) plus `emit` (enqueue another event, enables chaining).
  reactions?: [
    { on: 'contact', match: { a: 'ball' }, do: 'spawn',  template: 'splash', at: 'event.point' },
    { on: 'contact', match: { a: 'ball' }, do: 'emit',   type: 'scored' },   // chained
    { on: 'rest',    match: { body: 'ball' }, do: 'toggle', target: 'goal-light' },
  ],

  // SEQUENCES — ordered sagas, one independent timeline per resolved scope key.
  sequences?: [
    {
      id: 'open-gate',
      scope: 'event.region',          // resolved per-event → one live instance per region
      trigger: { on: 'enter', region: 'gate' },
      steps: [
        { do: 'move', target: 'gate', to: 'open', await: 'done' },   // blocks THIS scope only
        { do: 'toggle', target: 'gate-light' },
        { await: { timer: 1.5 } },
        { do: 'emit', type: 'gate-opened' },
      ],
    },
  ],
}
```

Field discipline: every field that can be `'event.*'` is resolved against the firing event at
process time; targets resolve by **id lookup that can fail gracefully** (never captured
pointer). No field may carry a closure or a wall-clock read.

## Where it sits in the tick (one ordered pass, recursive-drain)

```
step(dt):
  drain input            → events          (existing)
  physics.step(dt)       → contact/rest events
  entities/emitters      → enter/spawn/timer events
  --- bus ---
  sort queue by stable key                 # (type, source, monotonic seq)
  drain FIFO, depth-capped:
    for event:
      isolated reactions  → run verb (verb may `emit` → enqueue, drained THIS tick)
      sequence triggers   → instantiate saga at resolved scope key
      sequence awaits     → advance any saga whose await this event satisfies
  sync meshes; render
```

## Determinism rules (each one closes a scale-only failure mode)

| Rule | Failure it closes (invisible at 3 events, constant at scale) |
|------|-------------------------------------------------------------|
| **Content-derived stable sort key** on every event (`ss(event)`, NOT an arrival counter) | Order instability when 2+ events collide in a tick. A counter would make the result depend on emit order — the exact thing assertion 2 forbids — so the key is derived from event content. Truly-identical events tie and are interchangeable. Never iterate a `Set`/object for order. |
| **Recursive same-tick drain** of `emit`ted events | Preserves within-frame causality (hit→spawn→trigger) instead of one-tick-per-link latency. |
| **Cascade depth cap** (reuse the `guard++ < 8` pattern from the physics accumulator) | Feedback loop A→B→A. Over-cap events are **logged/counted, never silently dropped** (silent drop is itself an invisible bug). |
| **Per-tick event budget** | Frame-budget starvation: an event storm blows the frame, physics accumulator spirals, motion goes wrong even though the bus "worked." |
| **Target resolution by failable id lookup** | Stale references to bodies/entities despawned between emit and process (constant once emitters churn). |
| **Scope key, not participant list**, for sequences | Cross-saga interleave nondeterminism; guarantees concurrent sagas can't touch each other's ordering. |

## Harness contract — the deliverable (`event-bus.test.js`)

The bus's definition of done. Written *with* the schema so the schema cannot add a field the
harness can't pin. Each assertion turns an invisible property into a checkable one:

1. **Replay-equality.** Seed a world, fire a scripted event script, hash final state. Run again
   → byte-identical hash. (Proves the loop stayed deterministic.)
2. **Order-invariance.** Same event *set*, shuffled emit order → identical hash. (Proves the
   stable sort key normalizes collisions — the #1 scale bug.)
3. **No-explosion under storm.** Fuzz: random high-rate event storms. Assert: never throws; no
   `NaN`/`Infinity` in any body position or entity transform; event-queue depth never exceeds
   the cap; cascade depth never exceeds the cap.
4. **Cap is loud.** When the depth/budget cap trips, a counter increments — assert the count is
   reported, never a silent swallow.
5. **Scope isolation.** Two sagas on distinct scope keys, interleaved triggers → each saga's
   step sequence is identical to running it alone. (Proves "doesn't block anything but its own
   parties.")
6. **Stale-ref safety.** Emit events targeting a body despawned mid-tick → no throw, reaction
   is a documented no-op, hash stable across replay.
7. **No-input determinism preserved.** A world *with* an `events` block but no user input still
   produces a byte-reproducible seeded playthrough (the export/encode case stays alive).

## Build phases

1. ~~**Pure reducer + harness, no renderer.**~~ DONE — [event-bus.js](event-bus.js) +
   [event-bus.test.js](event-bus.test.js). Front-loaded phases 3 (`emit` chaining + caps) and 4
   (scope-keyed sequences) too, since the whole pure core is dependency-free and the harness
   proves all 7 assertions at once. `processEvents(state, incoming) -> state'`, plus
   `stepTime` (timer awaits) and `hashState` (the replay oracle).
2. ~~**Wire two real sources:** `contact` + `rest` into the tick beside `physics-sim.step`.~~
   DONE — `deriveEvents(physState, prev, sources)` in [event-bus.js](event-bus.js) is pure (reads
   the physics state as data, no import, stays `.toString()`-able) and EDGE-TRIGGERED (onset only,
   via the carried `prev`, so a resting ball emits one `rest` not one-per-tick). `sources` is the
   allowlist of which facts surface. Contact orientation is normalized so `event.a` aligns with the
   source's `when.a` regardless of physics pair order. Integration proven in
   [event-bus.physics.test.js](event-bus.physics.test.js).
3. ~~`emit` chaining + cascade/budget caps.~~ DONE in phase 1 (assertions 3/4 green).
4. ~~Sequences with scope keys + `await`.~~ DONE in phase 1 (assertions 5/6/7 green).
5. **Renderer channel** in `scene-three.js` (`events` channel emitted via `.toString()`).
   - 5a ~~emit `buildBus().toString()` beside the physics channel; `stepEvents(t)` runs after
     `stepPhysics(t)` in `__mojStep` (facts before reactions); `deriveEvents` off `window.__mojSim`
     each frame; verb effects (spawn/toggle/move) reflected onto marker meshes; `window.__mojBus`
     exposed for headless checks; frame-zero preserved (dt 0 on frame one). Gated on `events`
     carrying reactions/sequences.~~ DONE — wiring + runnable-source verified in
     [event-bus.scene.test.js](event-bus.scene.test.js). NOTE: not yet visually confirmed in a real
     browser (no headless GL here); the node checks prove the page emits valid, behaviourally-correct
     reducer source, not that pixels move.
   - 5b ~~reaching back INTO physics from a reaction (`impulse`/`move` a body).~~ DONE — the
     bus↔physics bridge (`linkPhysics`/`syncFromBodies`/`syncToBodies` in [event-bus.js](event-bus.js))
     registers each physics body as a bus entity proxy; reactions impulse/move the proxy, synced back
     to the body each frame. Wired into the `/world` channel (skips body proxies when reflecting
     markers). Proven by the cradle world below.
   - ~~`world-scene.js` passthrough for the `events` manifest block.~~ DONE — any stored manifest
     carrying `events` (with reactions/sequences) rides through kind dispatch onto the payload and is
     flagged `nonBakeable`, exactly like `physics`/`actions`/`entities`. So an operator persists a
     manifest and the `/world` route emits the live page with no per-world code. End-to-end (stored
     cradle manifest → resolve → emit) covered in [world-scene.test.js](world-scene.test.js).

### The proof world: two Newton's cradles ([newton-cradles.js](newton-cradles.js))

A complex action world that exercises the whole stack at once, requested as the proof case. Two
independent tethered cradles, each rigged from a direction on a staggered timer.
- needed a pendulum constraint (a single distance tether, NOT a general solver) — added to
  [physics-sim.js](physics-sim.js), tested in [physics-tether.test.js](physics-tether.test.js)
  (rigid rod holds; momentum transfers down a touching row; far ball ejects).
- the whole world runs in node ([newton-cradles.test.js](newton-cradles.test.js)) — physics +
  tether + bus + bridge — proving: momentum crosses the row, **scope isolation** (rig A → B dead
  silent, zero B-scoped clacks, not one B ball moves), the rig is a delayed REACTION into physics,
  and the autonomous playthrough is byte-reproducible. The `/world` page is the renderer of this
  already-proven truth.
- one honest physics note: the sequential impulse solver resolves pairs in increasing index order,
  so a left→right pulse cascades the whole row in one step (textbook "skip the middle") while a
  right→left pulse advances one ball/step. Same OUTCOME (far ball ejects at ~full input), different
  per-step path. Documented in the test.
6. ~~World→substrate publish allowlist.~~ Separate plan; see Two buses.

## Decisions settled

- In-world bus is a **deterministic in-tick queue**, not an EventEmitter.
- Reactions reuse existing action verbs + one new `emit`. No new imperative handler surface.
- `emit`ted events drain **same-tick, recursively, depth-capped** (causality over latency).
- Sequences are keyed by **scope id**, ordered within a key, concurrent across keys.
- A sequence scope holds **one CONCURRENT instance**: a live saga blocks re-triggers of its scope,
  but a **completed saga frees its scope** (pruned from `sagas`/`sagaIndex` in `runForward`) so the
  same scope can fire a fresh instance later. This is what lets a scoped saga model a *repeating*
  lifecycle (e.g. game-idioms' `ephemeralTarget` — a target that pops, lives, drops, pops again).
  `hashState` excludes sagas, so pruning is determinism-neutral. (Added when `ephemeralTarget` became
  the first repeated-scope user; newton-cradles' rig fires once per scope, so it never surfaced.)
- Harness is part of done; written alongside the schema.

## Non-goals

- World→substrate transport (separate, deferred).
- Async / cross-frame reactions of any kind inside the tick.
- A general rules engine / scripting language — verbs stay the small fixed set.
- Priority queues / preemption between events (stable FIFO by sort key is the whole model).

## Open questions

- `emit` chaining vs sequences overlap: when does a chained `emit` want to be a sequence step
  instead? Lean: `emit` for stateless fan-out, sequences when a step must *await*.
- Budget unit: cap total events/tick, or cap per-source, or both? Storm test should decide
  empirically rather than guessing a number now.
- Region/`enter` detection cost: do regions reuse the aabb collider, or a lighter point-in-box
  test run only for entities flagged as region-watched?
