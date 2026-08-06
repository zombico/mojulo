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
- Drivable-vehicles D2 lands as `rules-drive.js` (its plan's engine touchpoint,
  re-pointed here).
- Promote proven idioms (reaction chain, commitment maneuver, resource gauge,
  contact-window melee, additive match layer) into `game-idioms.js` / vocab cards.

## Status / build log

| Stage | State | Notes |
|---|---|---|
| S0 kernel + wrap | not started | |
| S1 leaf carves | not started | gait → colliders → rules-basic |
| S2 combat carves | not started | hit → ranged → melee → match |
| S3 pipeline | not started | |
| S4 maneuvers + MS pack | not started | |

(Keep this table + dated notes current as stages land; a landed stage's notes
record any deviation from the plan above.)
