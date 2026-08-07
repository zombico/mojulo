# Controllable-world decomposition — monolith → composed builders

`worlds/controllable-world.js` (3,305 lines) is ONE self-contained closure holding
the entire action-game engine: the rule shelf, collision, the weapon/melee/reaction
combat framework, the arena match layer, and the mobile-suit arena content woven
through all of it. This plan splits it into a series of system files — SYSTEMATIC
instead of done-in-one — without breaking the single-source-of-truth browser
emission, and without changing a single frame of behavior until the split is done.

Sibling plan: `vehicle-designer/drivable-vehicles.plan.md` is deliberately OUT of
scope here (built separately, later). Its one engine touchpoint — the D2 `drive`
rule — becomes the first EXTERNAL tenant of this plan's architecture when it
starts: a new `rules-drive.js` builder, never a monolith edit.

## The thesis

The monolith exists because of one architectural bet: the whole model lives in
`buildControllable()`, an import-free closure, so the browser runs
`buildControllable.toString()` and there is no second, drifting copy
(`scene/channels/controllable/index.js:72`, parity-tested at
`worlds/controllable-world.test.js:1066`). A naive ES-module split breaks that
bet — an imported helper is not inside the stringified function.

So the unit of decomposition is NOT "module with imports". It is a set of
**import-free builder closures composed over a shared namespace**:

```js
// compose.js — the kernel, itself stringifiable
function composeControllable(builders) {
  const E = {};                     // the shared engine namespace
  for (const b of builders) b(E);   // each builder attaches its system onto E
  return E;                         // E ends with createWorld, stepWorld, RULES, …
}
```

Each file exports one `buildX(E)` that is import-free INSIDE the function: it
defines its functions closing over `E`, attaches its public pieces
(`E.armReaction = armReaction`), and reaches siblings the same way
(`E.sightBlocked(...)` instead of today's lexical call). Node composes the live
instance; the emitter emits
`(${composeControllable})([${builders.map(String).join(',')}])`. The
single-source guarantee survives, now per-system.

## What we deliberately do NOT do (during the split)

- **No behavior change.** Every stage lands byte-identical on the golden trace
  (below). The split and the semantics are separate migrations.
- **No de-flavoring / renames.** The mobile-suit vocabulary (egg, boost, suit)
  stays where it is until S4. Splitting files and splitting meaning at the same
  time is how byte-identical guarantees get lost.
- **No per-world pack selection.** Every world keeps emitting every builder for
  now. Manifest-driven emission (smaller HTML for non-combat worlds) is a later
  optimization, after S4.
- **No vehicles.** Drivable-vehicles proceeds on its own plan after this one has
  at least S0 landed.
- **No maneuver API before S4.** `platform()`'s interior (boost/dodge/tackle/
  strike blocks) moves as-is with its file; the plugin contract comes last, when
  the mobile-suit pack extraction actually needs it.

## Conventions pinned up front

- **Builder signature**: `export function buildX(E) { … }` — import-free inside
  the function body. Module-top imports are allowed ONLY for server-side extras
  that never enter the closure (e.g. `assembleControllableScene`'s lazy
  arena-atmosphere import, the existing precedent at `controllable-world.js:3253`).
- **Order is fixed in one place**: `compose.js` exports the ordered `EMISSION`
  list. Registration order = array order = emission order. Deterministic.
- **Core first**: later builders MAY destructure hot core helpers at build time
  (`const { add, scl, clamp } = E;`) because core is builder #1. Cross-SYSTEM
  calls (combat ↔ match ↔ rules) go through `E.` at runtime — late-binding, so
  ordering between non-core builders never matters.
- **Comments travel with their functions.** The R-numbers and operator-dated
  comments are load-bearing history; a carve moves them verbatim.
- **Entity fields stay a shared flat namespace** (that is what makes the systems
  composable today), but each builder file's header comment documents which
  `e.*` / `state.*` fields it OWNS.
- **The golden trace is the gate, not HTML bytes.** Emission shape changes at S0
  by design; sim behavior never does.
- **The façade stays.** `worlds/controllable-world.js` remains the assembly
  point: imports the builders, composes the live instance, re-exports the same
  API (`createWorld`, `stepWorld`, `normalizeEntity`, `RULES`, `AI_DIFFICULTY`,
  `gaitFramePair`, `advanceGaitMix`) plus `assembleControllableScene`. The ~13
  consumers (`world-scene.js`, `game-manifest.js`, `operator-world.js`,
  `platform-field.js`, the MCP tools, the emitter) change zero import lines —
  except the emitter, which switches to mapping over `EMISSION`.

## Target file map

```
worlds/controllable/
  compose.js          composeControllable kernel + the ordered EMISSION list
  core.js             vec/smooth, input snapshot + key registry, colliders & sight
                      (resolveBlocking 2D/3D, segAabbT/sightBlocked/nearestWallT,
                      normalizeColliders, eggRadius), normalizeEntity/createWorld
                      scaffold + extension hooks, stepWorld pipeline, RULES registry,
                      stepBodyCollisions, stepCarry
  gait.js             gaitFramePair, advanceGaitMix
  rules-basic.js      glide, walk, clock, mover, follow
  rules-platform.js   platform — maneuvers still inline until S4
  combat-hit.js       hitbox volumes (hitEgg/pointInEgg/latR/hullZ/eggLean),
                      armReaction, stepReaction, breakGuards, beginDodge,
                      wake/spawn guards, boostStunFactor
  combat-ranged.js    initWeapon, tickWeapon, stepWeapon, stepProjectiles,
                      burstProjectile, cancelWeaponCharge
  combat-melee.js     meleeSwingSpec, stepMelee, beginClash/stepClash,
                      stepTackle, beginTackleCounter, tackle cinematic
  combat-match.js     match layer (stepMatch, matchStat), respawnEntity,
                      applySpawnProtect, stepDrop, explodeUnit, death burst
worlds/controllable-world.js       ← the façade (assembly + re-exports +
                                     assembleControllableScene/defaultGround)
mobile-suit/  (S4)
  ms-maneuvers.js     boost economy (gauge/overheat/hover/armor/thrust fx),
                      acrobatic dodge, tackle, loadout cycling, egg-lean coupling
  ms-ai.js            the ai rule + AI_DIFFICULTY
```

Judgment calls pinned (veto in review, not mid-carve): `combat-hit` keeps
`boostStunFactor` and the egg-lean coupling until S4; `rules-platform` keeps its
maneuvers inline through S3. One concern per migration.

## The stages

### S0 — the compose kernel, nothing moves

- Land `worlds/controllable/compose.js`: the kernel + `EMISSION`, with exactly
  ONE builder — the entire current closure body wrapped as
  `buildControllableAll(E)` (mechanically: the existing `buildControllable`
  return object spread onto `E`, plus the helpers later stages will need
  attached: `fwdXY`, `rightXY`, `clamp`, `smooth`, `resolveBlocking`,
  `resolveBlocking3D`, `sightBlocked`, `RULES`, …).
- Switch the façade's live instance and the emitter
  (`scene/channels/controllable/index.js:72`) to the composed form.
- Test updates: `controllable-world.emit.test.js:18` asserts the composed
  emission; the parity test (`controllable-world.test.js:1066`) generalizes to a
  parameterized **per-builder self-containment test** — every builder in
  `EMISSION` must instantiate via `new Function` (this is the tripwire that
  catches an accidentally-imported symbol before it silently ships a broken
  browser copy).
- Add the **golden-trace test** if no equivalent exists: scripted input sequence
  (walk, jump, boost, dodge, fire, melee, swap, a match kill/respawn) → N frames
  of `stepWorld` → JSON snapshot. Every later stage is measured against it.

Gate: suite green, golden trace recorded, emitted world plays identically.

### S1 — carve the leaves

Lowest-risk moves, in order: `gait.js` (pure math, no deps) → colliders/sight
consolidated in `core.js` → `rules-basic.js` (glide/walk/clock/mover/follow).
Each carve: move functions + comments, `E.`-prefix cross-references, suite +
trace green before the next.

Gate: monolith shrinks by ~500 lines; trace unchanged after every carve.

### S2 — carve combat

`combat-hit.js` → `combat-ranged.js` → `combat-melee.js` → `combat-match.js`.
Densest cross-links (`stepWeapon` → `armReaction`/`matchStat`/`absorbShield`/
`breakGuards`) — all through `E.`, no ordering puzzle. Alongside each carve, its
`normalizeEntity` hoists (poise/shield/collideVol, loadout, liveries/seat/team,
match/wreckExplodes state) move behind new core hooks:
`E.registerNormalize(fn)` and `E.registerStateInit(fn)`. Core stops knowing
combat's fields.

Gate: `normalizeEntity`/`createWorld` in core contain no combat-specific field
knowledge; trace unchanged.

### S3 — decompose stepWorld into a registered pipeline

The step that makes it SYSTEMATIC rather than merely multi-file. The current
per-entity sequence is intricate and preserved exactly:

```
per entity:  timers → body-owners (reaction, clash, cinematic, drop; first
             owner suppresses rule+weapon; spawn-guard assert) → rule (else
             suppressed-fallback tickers, e.g. tickBoostRecovery) → actions
             (weapon w/ fire-routing policy, melee, tackle)
world-level: bodyCollisions → carry → projectiles → deathBurst → match → camera
```

Core defines those named slots; each system registers into a slot
(`E.registerOwner`, `E.registerAction`, `E.registerWorldPass`, `E.registerTimer`);
`EMISSION` order breaks ties. A snapshot test pins the RESOLVED pipeline order
(replay determinism depends on it). After S3, adding a system = writing a
builder file + one `EMISSION` entry — `stepWorld` is never edited again.

Gate: pipeline-order snapshot committed; stepWorld's body is the slot runner and
nothing else; trace unchanged.

### S4 — the maneuver seam + the mobile-suit pack

Only now touch semantics:

- Formalize `platform()`'s opt-in blocks as registered maneuvers with the
  contract `{ id, gate(rule), step(e, input, dt, ctx), ownsBody?, haltsDrive? }`
  — formalizing exactly what the boost/dodge/tackle/strike blocks already are.
- Lift into `mobile-suit/` builders: `ms-maneuvers.js` (boost economy, dodge,
  tackle + counter + cinematic, loadout cycling, egg-lean) and `ms-ai.js` (the
  ai rule + `AI_DIFFICULTY`), appended to `EMISSION`. Arena match dressing
  (drop-in, fire-guard, wreck-explodes, liveries, seats) moves with them.
- Pack-absent behavior mirrors the arena-atmosphere precedent
  (`controllable-world.js:3253`): a walk/platform world runs without the pack.

Gate: mobile-suit worlds trace-identical with the pack loaded; a pack-less
compose still runs the basic-rules worlds; core + combat files contain no
mobile-suit flavor defaults.

## Order and independence

S0 → S1 → S2 → S3 → S4, strictly. S1–S3 are pausable at any carve — every
intermediate state is a working, shippable engine. Feature work (vehicles D-plan,
parry probe, AI drivers) can interleave any time after S0, landing as builders.

## Open decisions (recommendations inline)

1. **Namespace name** — `E` vs something longer. Recommend `E` (it appears in
   thousands of call sites post-split; short wins).
2. **Directory** — `worlds/controllable/` as mapped. The plan file moves in with
   it if folderization wants that later.
3. **Combat as always-on vs opt-in emission** — always-on through S4; revisit
   with per-manifest pack selection afterwards.
4. **Golden-trace breadth** — one long scripted trace vs several scenario
   traces (ground arena / space / match / no-combat walk world). Recommend four
   short traces; a single trace hides coverage gaps in mode branches.

## Later (explicitly after S4)

- Per-manifest pack selection in the emitter (smaller HTML for non-combat worlds).
- De-flavoring pass on combat vocabulary (neutral names; MS defaults into pack
  config) — doc-comment rewrites, not API churn.
- Parry/guard verb as a clash-variant maneuver — the cheapest probe that the
  maneuver contract generalizes beyond the mecha fantasy.
- ~~Drivable-vehicles D2 lands as `rules-drive.js`~~ — LANDED 2026-08-06: the
  first external tenant of the architecture (see drivable-vehicles.plan.md's
  build log); a rule-level builder needed zero engine edits, as designed.
- Promote proven idioms (reaction chain, commitment maneuver, resource gauge,
  contact-window melee, additive match layer) into `game-idioms.js` / vocab cards.

## Status / build log

| Stage | State | Notes |
|---|---|---|
| S0 kernel + wrap | **landed 2026-08-06** | see build log below |
| S1 leaf carves | **landed 2026-08-06** | see build log below |
| S2 combat carves | **landed 2026-08-06** | hit → match → ranged → melee (see log) |
| S3 pipeline | **landed 2026-08-06** | see log |
| S4 maneuvers + MS pack | **landed 2026-08-06** | see log — the split is COMPLETE |

(Keep this table + dated notes current as stages land; a landed stage's notes
record any deviation from the plan above.)

### S0 — landed 2026-08-06

- `worlds/controllable/compose.js` (kernel + `EMISSION` + `composeLive` +
  `emissionSource`) and `worlds/controllable/all.js` (the monolith closure moved
  verbatim: signature → `buildControllableAll(E)`, tail `return {…}` →
  `Object.assign(E, {…})` + the widened core-helper attach). The façade
  `controllable-world.js` went 3,305 → 86 lines: header, the standalone-scene
  section (defaultGround / assembleControllableScene / arena-atmosphere lazy
  import, unchanged), and the composed live-instance re-exports. `buildControllable`
  is gone as an export; the emitter now interpolates `emissionSource()`.
- **Golden traces** landed FIRST, recorded against the pre-split monolith
  (`controllable-world.trace.test.js`, 4 scenarios: walk / groundArena / space /
  teamMatch-dropIn; full-precision digests every 6 frames). Deviation from open
  decision 4's sketch: the ground-arena hunter is a pure SHOOTER with two ranged
  slots (ai weapon rotation) — a meleeSeek hunter stun-locked the scripted pilot
  and starved the bazooka/tackle branches; the space seeker keeps ai-melee
  coverage. Traces passed unchanged against the composed engine.
- Parity test generalized to the per-builder self-containment tripwire + a
  stringified-vs-module identical-step assertion (`controllable-world.test.js`,
  "single source of truth" block). Emit test asserts `emissionSource()` inline.
- **Char-net re-pin** (the emission-shape change this plan announced): 10
  fixtures re-pinned in `scene/emit-channels.char.test.js.snap` — capture-controllable,
  cast-shadows, controllable, controllable-figure, controllable-hangar,
  controllable-shadows, controllable-smoke, fx, kitchen-sink, kitchen-sink-capture.
  Every non-controllable fixture hash unchanged.
- Full suite: 6072 passed; the only 2 failures (`mcp/tools/tool-descriptions.test.js`
  catalyst description budgets) reproduce with the working tree stashed —
  pre-existing at HEAD, unrelated.

### S1 — landed 2026-08-06

- Three carves out of `all.js` (3,247 → 2,911 lines), one composition:
  `core.js` (vec/heading math, smooth, TAU/HALF_PI, lerp3, resolveBlocking 2D/3D,
  segAabbT/sightBlocked/nearestWallT, normalizeColliders, eggRadius, **and the
  RULES registry** — an empty shared object rule builders register into),
  `gait.js` (gaitFramePair, advanceGaitMix), `rules-basic.js` (glide, walk,
  follow, clock, mover — registered via `Object.assign(RULES, {…})`).
- `EMISSION = [buildCore, buildGait, buildRulesBasic, buildControllableAll]` —
  core first; `all.js` destructures the core helpers + RULES at build time and
  registers its remaining rules (platform, ai) into the shared registry.
- SIDE_STRIKE_YAW stayed in `all.js` (melee flavor — meleeSwingSpec's only
  consumer); follow moved WITH its cinematic branch (semantics move in S4, the
  read is a nullable world field).
- Golden traces + full worlds suite unchanged; char-net re-pinned (same 10
  controllable-channel fixtures — every carve changes emission bytes by design).

### S2 — landed 2026-08-06

- Four carves (all.js 2,911 → 1,463 lines), order **hit → match → ranged → melee**
  (match moved BEFORE ranged/melee — deviation from the sketched order — so
  `matchStat` is build-time destructurable by both; the one backward edge,
  respawnEntity → cancelWeaponCharge, is late-bound via `E.*`).
- `combat-hit.js`: egg family, shields, breakGuards, boostStunFactor, armReaction,
  beginDodge + stepReaction; registers the poise/collide/hpMax/shield normalize
  extension. `combat-match.js`: matchStat, applySpawnProtect, stepDrop,
  respawnEntity, stepMatch, explodeUnit; registers the match/wreckExplodes STATE
  INIT. `combat-ranged.js`: initWeapon, cancelWeaponCharge, tickWeapon, stepWeapon,
  stepProjectiles, burstProjectile. `combat-melee.js`: SIDE_STRIKE_YAW +
  meleeSwingSpec, stepMelee, clash, stepTackle, tackle counter + cinematic.
- Core grew the S2 hooks (`registerNormalize`/`registerStateInit` + runners) and
  took `stepBodyCollisions` + `stepCarry` (the file-map's core passes).
  `createWorld` restructured: state literal (match/wreckExplodes null) →
  `runStateInits(state, spec)` → return.
- Still in `all.js` (by design): platform + ai rules, AI_DIFFICULTY,
  armSwitchReady, beginAiSwing*, tickBoostRecovery, input snapshot,
  normalizeEntity/createWorld/stepWorld, loadout/pilotable/seat/team/livery
  hoists — the S3/S4 material.
- Golden traces byte-identical after every carve; char-net re-pinned (same 10);
  full suite at baseline (6,072 + the 2 pre-existing catalyst-budget failures).

### S3 — landed 2026-08-06

- `stepWorld` moved to core as the SLOT RUNNER; the frame sequence is now registered,
  not hardcoded. Slots in run order: preSteps (may replace input) → per entity:
  entityTimers → bodyOwners (truthy = owns; any owner suppresses rule+weapon) →
  entityAsserts → rule (else suppressedTicks) → entityActions → worldPasses →
  camera → time. Entries sort by explicit `order`, ties by EMISSION position.
- Registrations, preserving the pre-split sequence exactly: match-over-zero(10,
  match) → ai-toggle(20, all) → pilot-swap(30, all) → carry-snapshot(40, core);
  owners reaction(10, hit) → clash(20, melee) → cine(30, melee) → drop(40, match);
  asserts charge-cancel(10, ranged) → spawn-guard(20, match); actions
  weapon/melee/tackle (all.js — they carry the ai-fire routing + pilot gating, S4
  redistributes); world passes body-collisions(10, core) → carry(20, core) →
  projectiles(30, ranged) → death-burst(40, match) → match(50, match).
- ZERO_INPUT/readInput moved to core (still carrying the MS keys — S4 splits them
  via input-defaults registration). `hooks.physics` now runs before the pre-steps
  instead of between match-zero and ai-toggle — commutes (physics reads no input,
  match-zero writes only input); traces confirm.
- Gate landed: the pipeline-order PIN test (controllable-world.test.js, "step
  pipeline") — an exact `toEqual` on `pipelineOrder()`, not a snapshot, so a
  reorder is a loud diff. Golden traces byte-identical; full suite at baseline.
- normalizeEntity/createWorld stay in `all.js` (deliberate: they move with the S4
  redistribution so the loadout/pilot/seat/team/livery hoists move once, not twice).

### S4 — landed 2026-08-06 (the split is complete; all.js dissolved)

- **Sub-stage A** (scaffold to core + registration redistribution): normalizeEntity/
  createWorld moved to core — weapon init late-bound (`E.initWeapon`), aiTuning
  deferred to a pack state-init, seat/liveries/loadout hoists lifted out to a
  registered normalizer; the pilot-swap pre-step moved to core (possession is
  engine); the weapon timers + weapon action → combat-ranged, melee/tackle
  actions → combat-melee.
- **Sub-stage B** (the maneuver seam + the pack lift): `rules-platform.js` holds
  the platform rule with the S4 maneuver-phase registry — five phases over a
  shared per-frame ctx (`maneuver → equip → act → dash → claim`), each hook the
  verbatim inline block reading/writing the same locals via ctx at the same point
  in the frame. `registerPlatformManeuver(phase, key, fn, order)` +
  `platformPhaseOrder()` are the seam API. combat-melee registers strike/throw
  (act) + cleave-step (dash) — melee ACTING is combat, not pack (the parry/GoW
  argument). `mobile-suit/ms-maneuvers.js` registers dodge/tackle (maneuver),
  loadout (equip), their dashes and locomotion claims, the arena dressing
  normalizer (seat/liveries/loadout), and attaches armSwitchReady.
  `mobile-suit/ms-ai.js` holds the ai rule + AI_DIFFICULTY + the ai melee
  strings, the ai-toggle pre-step, and the difficulty state-init. `all.js` is
  DELETED. `EMISSION_ENGINE` (8 builders, pack-less) + `EMISSION` (10, the packs
  appended) are both exported; the emitter ships EMISSION.
- Gates, all landed: golden traces byte-identical against the unwoven engine;
  the platform-phase order pin (exact toEqual beside the pipeline pin); the
  pack-less test (EMISSION_ENGINE runs walk + basic platform with jump/landing;
  RULES.ai and AI_DIFFICULTY undefined); char-net re-pinned (same 10
  controllable fixtures); full suite at baseline (6,075 + the 2 pre-existing).
- **Residual MS flavor, deliberate (the "de-flavor pass" in Later owns these):**
  the boost/thruster layer (gauge/overheat/hover/flame) stays in rules-platform
  as ENGINE — it is load-bearing across movement/vertical/locomotion and a
  jetpack platformer is a generic genre; only its arena tuning is MS. eggLean's
  boost-clip coupling stays in combat-hit. ZERO_INPUT keeps all keys in core
  (per-pack input-key registration deferred). createWorld's `spec.ai !== 'off'`
  read stays in core (inert without an ai rule).
- Two generation faults caught by the gates during the lift (a stripped gauge
  close-brace; the throw hook losing the strike block's shared `strikeOn`
  local) — both surfaced before any suite ran, by the import tripwire + traces.
