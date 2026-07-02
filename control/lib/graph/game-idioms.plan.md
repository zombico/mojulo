# game-idioms — a reusable rule-idiom layer above the event-bus

Status: planned. No code yet. This plan extracts the generic game-design idioms that
[whack-a-mole.js](whack-a-mole.js) hand-inlined into a small composable library, so the *next*
game ports its rules by composing named idioms instead of re-deriving the
`events` manifest from primitives every time.

Files (planned): `game-idioms.js` beside [event-bus.js](event-bus.js) — pure, node-testable,
dependency-free (same discipline as the reducer it feeds). Harness: `game-idioms.test.js`.
whack-a-mole recomposed against it is the proof case.

## The framing — authoring-time composition, not a new runtime

The [event-bus](event-bus.js) is the evaluator: a pure, deterministic in-tick reducer that runs an
`events` manifest (`vars` / `entities` / `timers` / `reactions` / `watches` / `inputs` / `hud`).
That layer is done and proven. What is missing is *above* it: every game today hand-writes its
whole `events` block, re-inlining the same idioms (a score, a clock, a game-over freeze) by hand.

A **game-idiom** is an authoring-time function that expands to a standard `events` fragment built
from the **existing fixed verbs**. Games compose idioms; the composition lowers to exactly the
manifest the bus already runs. The bus never learns what a "clock" is — the idiom is gone by the
time the reducer sees the manifest.

```
text ruleset  →  pick idioms + fill params  →  compose()  →  events manifest  →  bus (unchanged)
                 (authoring)                    (lowering)     (proven evaluator)
```

The consumer is the `/world` page's own HUD (the `hud` channel, already built) — this is internal
world UI, not an app, not MCP, not a model. Nothing here touches the renderer or adds a transport.

## The one fact that drives everything

Strip whack-a-mole down and almost nothing in it is *whack-a-mole*. It is generic idioms wired
from primitives by hand:

| Inlined in whack-a-mole | The idiom underneath |
|---|---|
| `vars.score` + `{on:'whack', do:'inc', var:'score'}` | **scoreCounter** |
| `vars.time` + `{every:1, emit:'tick'}` + `{on:'tick', inc time by:-1}` + `watch time<=0 → game-over` | **countdownClock** (with on-zero signal) |
| `vars.over` + `while:{var:'over',eq:0}` on *every* timer + `{on:'game-over', set over:1}` + banner + clear-all | **gameOverFreeze** (the gate every timer must reference) |
| per-hole `timers` + `{on:'pop', toggle up}` | **spawnOnHeartbeat** |
| `inputs:[{on:'pick', emit:'whack'}]` + `{on:'whack', toggle down}` | **deed** (input → effect) |

Only the deed's *meaning* (a click drops the moused mole) is game-specific. The rest is rewritten
verbatim for the next timed game — and the `over`/`while` freeze gate is exactly the cross-cutting
wiring that is easy to get wrong: forget to gate one timer and game-over fails to freeze it.

## The constraint that keeps this honest (read before adding any idiom)

[event-bus.plan.md](event-bus.plan.md) has an explicit non-goal: *"A general rules engine /
scripting language — verbs stay the small fixed set."* This library stays on the right side of
that line **only as authoring-time composition**:

- An idiom is a pure function returning an `events` fragment. It runs once, at build time.
- It may emit only the existing manifest shapes and the existing verbs
  (`impulse`/`grab`/`spawn`/`toggle`/`move`/`emit`/`set`/`inc`).
- It adds **zero runtime surface**. The bus runs the lowered manifest exactly as if a human had
  typed it. Determinism, replay, `hashState`, and frame-zero degradation are untouched.

If an idiom ever wants a new verb, a runtime interpreter, or a wall-clock/closure, that is the
non-goal being violated — push it back into composition or stop. No model is involved at any point,
runtime or otherwise.

## Lowering contract — `compose()`

`compose(...fragments)` deep-merges idiom outputs into one `events` manifest:

- object channels (`vars`) shallow-merge; later writes lose to earlier on key collision and the
  collision is reported (a game should not declare `score` twice silently).
- array channels (`entities` / `timers` / `reactions` / `watches` / `inputs` / `hud`) concatenate
  in idiom order.

Stage geometry is **not** a rule idiom. `entities` (the mole circles, the banner) and `faces` (the
ground quad) describe *what exists*; idioms describe *what happens*. The author supplies stage and
passes entity ids into the idioms. (Existing layout helpers — e.g. a grid placer — can build the
stage; out of scope here.)

## Idiom catalog (the v1 set, all extracted from whack-a-mole)

Each lowers to a fragment of existing verbs. The `gate` param is the shared freeze var — every
timer-bearing idiom takes it and emits `while:{var:gate,eq:0}`, so a single `gameOverFreeze` halts
all of them and an author cannot forget to gate one.

- **scoreCounter(name='score', {label})** → `vars:{[name]:0}`, `hud:[{var:name,label}]`.
- **countdownClock({var:'time', from, onZero, gate, label:'Time'})** →
  `vars:{[var]:from}`, a 1s `tick:<var>` timer gated by `gate`, an `inc <var> by:-1` reaction, a
  `watch {var, lte:0} → onZero`, and a `hud` row. (Generalizes whack-a-mole's single global
  `tick` to one tick stream per clock so two clocks can coexist.)
- **gameOverFreeze({signal:'game-over', gate:'over', banner?, clear:[]})** →
  `vars:{[gate]:0}`, `{on:signal, set gate:1}`, optional banner toggle, and a `toggle …to:false`
  per `clear` id. The gate var *is* the freeze mechanism the timer idioms reference.
- **spawnOnHeartbeat({targets, periods, pop:'pop', gate, rise:true})** →
  one gated recurring timer per target emitting `{type:pop, hole:id}`, plus `{on:pop, toggle
  target:'event.hole', to:true}`.
- **deed({on:'pick', emit:'whack', effects:[…]})** →
  `inputs:[{on, emit:{type:emit}}]` plus the supplied `effects` reactions (e.g. drop the picked
  target + `inc score`). This is the seam where a game expresses its own specific rule.

The catalog is deliberately small and additive — the same posture as the bus's fixed verb set. New
idioms earn a slot by recurring across ≥2 real games, not speculatively.

## Proof case — whack-a-mole recomposed

`buildWhackAMole` becomes a composition (stage geometry unchanged):

```js
const ev = compose(
  scoreCounter('score'),
  countdownClock({ var: 'time', from: seconds, onZero: 'game-over', gate: 'over' }),
  spawnOnHeartbeat({ targets: ids, periods, pop: 'pop', gate: 'over' }),
  deed({ on: 'pick', emit: 'whack', effects: [
    { on: 'whack', do: 'toggle', target: 'event.target', to: false },
    { on: 'whack', do: 'inc', var: 'score' },
  ] }),
  gameOverFreeze({ signal: 'game-over', gate: 'over', banner: 'banner', clear: ids }),
);
return { kind: 'controllable', events: ev, faces, ids };   // entities/faces authored as today
```

**Definition of done = behavioral equality by the existing oracle.** `game-idioms.test.js` drives a
seeded, scripted playthrough (timer ticks + a fixed `whack` script, no live input) through *both*
the current hand-written manifest and the recomposed one and asserts identical `hashState` at every
step. This reuses the bus's determinism oracle — a stronger guarantee than structural diff, and it
proves the abstraction changed authoring, not behavior. (A structural deep-diff of the two `events`
objects is a nice-to-have for catching expansion drift, not the contract.)

## Porting rules that already exist as text

With no runtime model (correct — none is needed), portability comes from the *vocabulary*: idioms
named after recognizable game-rule patterns, so translating a written ruleset is "pick the idioms,
fill the params," not "derive primitives." The richer the catalog, the more of a ruleset maps
directly. If later an authoring-time agent fills idiom params from prose, that is a build-time
convenience reading this vocab — still deterministic, still no runtime model. The library is the
portability; the port is expressing existing rules against it.

## Non-goals

- No new runtime surface, no new verbs, no scripting language, no runtime interpreter (the bus
  non-goal stands).
- No model anywhere — runtime or authoring — in this plan.
- No renderer / transport / app / MCP changes. Consumer is the existing `/world` HUD.
- No stage/layout system here. Idioms are rules; entities and faces stay authored (or use existing
  layout helpers).
- Not a speculative idiom zoo. v1 is exactly what whack-a-mole already needed.

## Build phases

1. ~~**`compose()` + the lowering contract**, unit-tested on tiny fragments (merge order, `vars`
   collision report, array concat).~~ DONE — [game-idioms.js](game-idioms.js) + [game-idioms.test.js](game-idioms.test.js).
2. ~~**The five v1 idioms**, each unit-tested in isolation: assert the emitted fragment is the exact
   primitive shape it claims (e.g. `countdownClock` emits the timer + inc + watch + hud rows).~~ DONE.
3. ~~**Recompose whack-a-mole** and pass the behavioral-equality (`hashState`) proof above.~~ DONE —
   [whack-a-mole.js](whack-a-mole.js) recomposed; the existing whack-a-mole suite stays green as the
   regression guard, and `game-idioms.test.js` proves byte-equal `hashState` vs a golden copy.
4. **Second game** built *only* from the catalog (a 30s speed-tap or reaction test) — the real test
   of reuse: it should write only its own `deed`, reusing score/clock/freeze unchanged. If it can't,
   the catalog is wrong, not the game. (Superseded as the reuse proof by the laser-whack-a-mole world
   in the extension below, which exercises far more of the substrate.)

## Decisions settled

- Authoring-time composition that lowers to the existing manifest; the bus is unchanged.
- Idioms emit only existing verbs; zero runtime surface.
- `gate` is the shared freeze var threaded through every timer idiom — encapsulates the
  cross-cutting "game-over freezes everything" wiring so it can't be forgotten.
- Done = behavioral equality via the determinism oracle, not structural manifest equality.

## Open questions

- Per-clock `tick:<var>` event types vs whack-a-mole's single global `tick`: confirm the rename is
  invisible under the hash oracle (it should be — only internal event-type strings change).
- Does `deed` deserve sub-shapes (pick / key / drag) or stay one general form parameterized by
  `on`? Defer until the second game shows which.
- Where does stage/layout composition live if it recurs — a sibling `stage-idioms` plan, or fold a
  minimal `grid()` placer in here? Decide when a second game needs the same stage shape.

---

# Extension — contact & ray facts (planned next)

The v1 catalog covers *conceptual* games (timers, score, watches). The next class is games whose
rules fire on **spatial facts** — two things touch, a ray hits something. This extension adds idioms
for those facts WITHOUT changing the contract above. The organizing principle is the bus's own
mechanism/policy membrane ([event-bus.plan.md](event-bus.plan.md)):

> A fact is produced by a **runtime source** (the integrator, the renderer). What a fact *means* is
> **policy** — a declarative reaction. game-idioms owns policy only.

So every item below is one of two kinds, never both in one place:

- **Mechanism (NOT a game-idiom):** a runtime source that emits a fact. Lives in physics-sim.js /
  scene-three.js. Adding one is a renderer/integrator change, not an idiom.
- **Policy (a game-idiom):** composition over a fact the runtime already emits. Pure, existing verbs.

A new fact family never changes the idiom contract — it just gives idioms new events to bind to.

## Contact-policy idioms (the facts already exist)

The integrator already emits `contact` / `rest` (`deriveEvents`), surfaced via the `sources`
allowlist. Today every physics game hand-writes `sources` + matching `reactions`
([newton-cradles.js](newton-cradles.js) does exactly this). That is the whack-a-mole smell in the
contact channel. event-bus.plan.md's own "physical fact → interpretation → world" table is the
catalog waiting to be named:

```js
onContact({ a, b, do, ...spec }) →
  { sources:   [{ type: 'contact', when: { a, b } }],
    reactions: [{ on: 'contact', match: { a, b }, do, ...spec }] }

pickup({ item, by, score }) →            // contact(item,by) → toggle item off + inc score
chainReaction({ among, gain }) →         // contact(among,among) → impulse the struck neighbor (dominoes)
onRest({ body, do, ...spec }) →          // rest(body) → a reaction (delivered / settled)
```

All lower to `sources` + `reactions` over existing facts and verbs. **Proof:** recompose
newton-cradles' hand-written `sources`/`reactions` from these idioms and pass the same
behavioral-equality (`hashState`) test the whack-a-mole recomposition uses.

## Ray facts — line-of-sight aim (new mechanism + policy)

A "laser pointer hit confirm" is a raycast along line of sight. The renderer already has every part:
`camera.getWorldDirection` (the `dir:'camera'` impulse, [scene-three.js](scene-three.js)), the
raycast-and-stamp-target pattern (`__pickEntity` — raycasts marker meshes under the pointer, takes
the nearest, stamps the hit id into the event as `target`), and an occluder set (`walkColliders` /
`solids`). A crosshair laser is `__pickEntity` with the ray set from **screen-center**
(`setFromCamera({x:0,y:0}, camera)`) instead of the cursor — i.e. camera-forward.

- **Mechanism delta (scene-three, sibling of `pick`):** a `fire` input that raycasts camera-forward,
  takes the **nearest** intersection across *markers ∪ occluders*, and emits a bus event with
  `target` **only when the nearest hit is a markable entity**. A wall/obstacle nearer than the target
  ⇒ no event. Optional later: an entity origin (`from:'turret-1'`) for non-camera lasers.
- **Policy idiom (`hitConfirm`):**
  ```js
  hitConfirm({ on:'fire', emit:'shot', marker:'hitmarker', score:'score' }) →
    { inputs:    [{ on:'fire', emit:{ type:'shot' } }],
      reactions: [{ on:'shot', do:'toggle', target:'hitmarker', to:true },
                  { on:'shot', do:'inc',    var:'score' }] }
  ```

Two properties fall out for free, one decision must be made:

- **Hit-confirm is free** — like `pick`, the ray emits only on a hit (carrying the id); a miss emits
  nothing, so "confirm" is just reacting to that event.
- **LOS occlusion is free** — the Raycaster returns the nearest intersection, so a target behind a
  wall is not the nearest hit. This only holds if occluders are in the raycast set.
- **Decision — the occluder set.** Reuse `walkColliders`/`solids` and walls + obstacles block the
  shot (real LOS); raycast only markers and you shoot through walls. Reuse the collider set so "line
  of sight" means line of sight. This single choice *is* the gameplay (peeking around cover).

**Determinism:** a `fire` is just an input deed — already the contracted source of novelty. The hit
resolves at input time and `target` is recorded in the event, so replay is exact; no new surface.

**Deferred — continuous aim.** A reticle that lights while the ray is *on* a target (before firing)
is per-frame fact churn. To stay deterministic it needs edge-triggering — emit `aim-enter` /
`aim-exit` on the onset/offset of the ray crossing a target, same `prev`-snapshot discipline as
`contact`/`rest`. v1 is discrete click-to-fire; continuous aim is a second pass.

## New idiom — `ephemeralTarget` (timed appear / disappear)

whack-a-mole's moles stay up until whacked; a target that **auto-disappears after a lifetime** is new
behavior, needed by the laser world below. It is expressible from existing **sequence** primitives
(scope-keyed sagas, one independent timeline per target id — the same scope isolation newton-cradles
proved):

```js
ephemeralTarget({ on:'pop', ttl:2.0, scope:'event.target' }) →
  { sequences: [{ id:'ttl', scope:'event.target', trigger:{ on:'pop' },
      steps: [ { do:'toggle', target:'event.target', to:true },
               { await:{ timer: ttl } },
               { do:'toggle', target:'event.target', to:false } ] }] }
```

A hit during the window toggles it off + scores; the saga's later toggle-off is then idempotent. No
despawn verb is introduced — appearance is `toggle` over a **pooled** set of pre-placed entities,
exactly as whack-a-mole models visibility. (If genuine spawn/remove is ever wanted, that is a
mechanism change to the verb set, out of scope and against the bus non-goal.)

## Proof world — "laser whack-a-mole in a room"

The capstone integration world — the newton-cradles of *this* layer. A room with obstacles; spheres
appear at seeded points for ≤2s; a WASD camera with a crosshair laser fires on left-click and scores;
walls and obstacles block the shot. It exercises nearly the whole stack at once:

| Piece | Supplied by |
|---|---|
| room + walls + obstacles | existing spatial kind (suite-layout / room) + `walkColliders` |
| WASD camera | existing walk-camera mode ([scene-three.js](scene-three.js):1592–1698) |
| spheres appear ≤2s | `spawnOnHeartbeat` (pooled targets) + `ephemeralTarget` (ttl 2.0) |
| crosshair laser, left-click | the `fire` LOS mechanism above |
| walls/obstacles block the shot | occluder set = `walkColliders` (the LOS decision) |
| scoring | `scoreCounter` + `hitConfirm` |
| timed round (optional) | `countdownClock` + `gameOverFreeze` |

Only the stage (room geometry + the sphere pool's seeded spawn points) is bespoke; every rule is a
composed idiom. **Determinism:** spawn positions come from a fixed, seeded pool cycled
deterministically — never `Math.random` (banned by the contract). The headless node proof drives a
scripted set of `fire` events at recorded camera poses and asserts a reproducible `hashState`; the
`/world` page renders that already-decided truth.

This is the real reuse test (supersedes the phase-4 speed-tap): if it needs more than `fire` +
`ephemeralTarget` + the room stage written from scratch, the catalog is wrong, not the game.

## Build phases (extension)

5. ~~**Contact-policy idioms** (`onContact`/`pickup`/`onRest`) + recompose newton-cradles as the
   proof (behavioral-equality `hashState`).~~ DONE — [game-idioms.js](game-idioms.js) gained
   `onContact`/`pickup`/`onRest` (and `compose` now merges the `sources`/`sequences`/`initial`
   channels); [newton-cradles.js](newton-cradles.js) recomposes its clack policy from `onContact`;
   [game-idioms.test.js](game-idioms.test.js) proves byte-equal `hashState` across the full
   physics→bus loop vs a golden hand-paired copy. `chainReaction` deferred (needs a real domino world
   to pin its impulse direction).
6. ~~**LOS `fire` mechanism** in scene-three (camera-forward raycast, nearest-hit across markers ∪
   occluders, stamp `target`, emit only on hit) + the **`hitConfirm`** idiom. Headless test asserts
   the page emits a center-anchored raycast over the collider set.~~ DONE — [scene-three.js](scene-three.js)
   gained `__aimEntity` (screen-center `setFromCamera` + `intersectObjects(scene.children, true)`, so the
   nearest non-marker hit occludes the shot) and a `fire` input branch; [game-idioms.js](game-idioms.js)
   gained `hitConfirm`. Tests: lowering + raycast-simulated policy (drop target + score, stale-target
   no-op) + a `/world` emission test asserting the LOS wiring. Occluder set = ALL scene geometry
   (recursive raycast) rather than a curated `walkColliders` list — simpler and dependency-free;
   revisit granularity if over-occlusion shows up (extension open question).
7. ~~**`ephemeralTarget`** idiom (sequence-based ttl) + unit + scope-isolation test.~~ DONE —
   [game-idioms.js](game-idioms.js) gained `ephemeralTarget` (a scope-per-target saga: toggle on →
   await ttl → toggle off). Surfaced a real bus gap: a completed saga never freed its scope, so a
   target could pop only ONCE (newton-cradles never re-triggered a scope, so it was latent). Fixed in
   [event-bus.js](event-bus.js) — `runForward` prunes a saga from `sagas`/`sagaIndex` on completion, so
   the scope can re-fire; live scopes still block (isolation holds), and `hashState` excludes sagas so
   it is determinism-neutral. Tests: lowering, appear/live/disappear, **re-pop after completion**,
   scope isolation, byte-reproducible playthrough. All event-bus suites stay green as the regression
   guard.
8. ~~**"laser whack-a-mole in a room"** proof world: room + WASD camera + spawned ephemeral spheres +
   LOS laser + occlusion + score. Node proof (scripted fires → reproducible hash) + `/world` emission
   test.~~ DONE — [laser-range.js](laser-range.js) composes the whole game from idioms; only the room
   geometry + seeded sphere pool are bespoke. A generic `walk` passthrough was added to
   [world-scene.js](world-scene.js) (any kind can opt into the WASD first-person mode), and the wall +
   obstacle FACES become scene `solids` ⇒ both walk-colliders and shot-occluders for free.
   [laser-range.test.js](laser-range.test.js): byte-reproducible playthrough, non-trivial (spheres
   spawn, 5 shots score, clock runs out, board clears), and a `/world` emission test asserting the
   room + walk camera + LOS laser + occlusion raycast + spheres + HUD all land in one page. CAVEAT
   (same as event-bus.scene.test.js): node proves the game logic + that the page emits correct
   machinery; it does NOT verify the live pointer-lock interaction (left-click firing while walking) —
   that needs a real browser.
9. **Continuous aim** (`aim-enter`/`aim-exit` edge-triggered) + reticle feedback. DEFERRED.

## Non-goals (extension)

- No collision *detection* in game-idioms — that is mechanism (physics-sim / the renderer raycast).
- No despawn/remove verb — ephemerality is `toggle` over pooled entities.
- No per-frame aim facts in v1 — continuous aim is edge-triggered and deferred.
- No `enter`/region fact source here — navigation/region collision (a walker stepping on a plate) is
  a separate mechanism piece (event-bus.plan.md's open question), not built by this plan. The same
  contact-policy idioms bind to it for free once it emits facts.

## Open questions (extension)

- Occluder granularity: do thin obstacles need their own colliders, or does reusing `walkColliders`
  (built for movement) give good-enough shot-blocking?
- Should `fire` carry `point` / `distance` for richer policy (range falloff, decals), or just
  `target` like `pick`? Add fields only when an idiom needs them.
- Seeded spawn-point selection: a fixed cycle, or a seeded PRNG threaded through the manifest? Either
  way it must be reproducible and `Math.random`-free.
