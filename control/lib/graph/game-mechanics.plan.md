# game mechanics — reusable level verbs that lower into world + contract at once

Status: DESIGN ONLY, nothing implemented. Drafted 2026-07-05 from a design conversation after
G0–G4 of [game-metacontext.plan.md](game-metacontext.plan.md) landed (store spine + level
contracts + shell + verification gate). This plan specifies the FIRST of the two "don't rebuild
every game from scratch" layers: **mechanics** (level primitives). The second layer — **game
kits** (named
store-schema + level-template bundles) — is a curated composition of mechanics and gets its own
plan once these exist. Build order is mechanics first: kits are cheap once mechanics are real,
not the reverse.

## The problem this removes

After G0–G4, authoring a level means writing three things by hand and keeping them in sync:

1. a world manifest (geometry + an `action`-base `idioms`/`events` recipe for behavior),
2. a `game:` level contract (`consumes` / `produces` / `on`), and
3. the WIRING between them — every `on: { 'goal:reached': { end: 'success' } }` and
   `on: { 'pickup:coin': { emit: { grant, ... } } }` is bespoke, and it is the SAME wiring in
   every crawler, every collectathon, every arena.

That wiring is the from-scratch tax. A **mechanic** is the unit that removes it: one declaration
that lowers into BOTH the world side and the contract side (and an audit recipe) at once.

## The lowering model (the whole idea)

A mechanic is a pure function of `(params, storeSchema) → fragments`, emitting up to three:

- **world** — an [game-idioms.js](worlds/game-idioms.js) fragment (an `events` manifest built
  only from the fixed verbs toggle/move/spawn/emit/set/inc). Mechanics REUSE the existing idiom
  catalog (`scoreCounter`, `countdown`, `spawnOnHeartbeat`, `pickup`, `ephemeralTarget`,
  `hitConfirm`, `deed`, contact `sources`) — a mechanic is mostly "an existing idiom + the store
  mapping it never had." A mechanic that needs genuinely new world behavior is a NEW IDIOM first,
  then a mechanic that wraps it (this is how combat stays out of scope until its idiom lands).
- **contract** — `produces` events + `on` map entries + optional `consumes`, spliced into the
  level's `game` channel ([level-contract.js](game/level-contract.js)). This is the wiring that
  used to be hand-authored.
- **audit** — a completability recipe the G4 gate can run without the author writing a traversal:
  a waypoint route, an idle-and-assert, or a scripted input. Because a mechanic KNOWS its win
  condition, it can say what winning looks like.

Authoring becomes: `game: { mechanics: [ { kind, ...params }, ... ] }` on the world manifest. The
game channel resolve ([worlds/world-scene.js](worlds/world-scene.js)) lowers the mechanics,
composes their world fragments into the `events` manifest (the idiom `compose()` already throws
on var collisions), and SYNTHESIZES the `produces`/`on`/`consumes` — the author declares intent,
never the plumbing. Hand-written `produces`/`on` still work and merge, for the escape hatch.

## Doctrine (decided)

- **Closed, card-backed vocabulary.** Mechanics are a fixed set, each a `game_mechanic` vocab
  card (routing phrases + param manual) discovered via `semantic_search({kinds:['game_mechanic']})`
  and read via `get_game_vocab`. Extensible by dropping a card + a lowering fn; NOT open to
  arbitrary code — same discipline as slices/typed-events. A mechanic lowers to existing
  primitives or it doesn't ship.
- **Levels stay pure.** A mechanic lowers to declarative world+contract; no runtime coupling, no
  server logic. The lowered level is byte-identical to one hand-authored with the same fragments.
- **Every level needs ≥1 TERMINAL mechanic.** Something must call `end()`. A level whose declared
  mechanics contain no terminal is refused at mint ("this level can't be won or lost") — a cheap
  structural check that pairs with the G4 completability gate. This is the mechanics layer's own
  golden rule.
- **A mechanic declares the store it REQUIRES.** `collect` needs an inventory slice; `rescue`
  needs a party slice. The declaration lets a level (and later a kit) validate that the game's
  store actually hosts its mechanics, and it is what lets the model start from a working shape.
- **Mechanics know their own audit.** The completability recipe is part of the mechanic, so G4
  drops from "author a traversal by hand" to "the mechanic already told us what winning is." A
  mechanic whose win condition can't be auto-audited (combat) is flagged, not faked.
- **Seeded + deterministic.** Lowering is a pure function of `(params, storeSchema)` — no clock,
  no RNG. Same declaration → same lowered manifest (a lowering test asserts hashState stability,
  mirroring game-idioms.test.js).

## The role taxonomy

A level composes as **1+ terminal · N emitters · M gates**. Every mechanic has exactly one role.

### Terminal — decides success/fail (a level picks ≥1)

| Mechanic | Requires | World lowering | Contract lowering | Auto-audit |
|---|---|---|---|---|
| **reach-exit** | — | goal trigger zone (contact `source`) → emit `goal:reached` | `on:{'goal:reached':{end:'success'}}` | **free** — `compileWalkTo(exit)`, the existing walkability audit |
| **survive** | — | `countdown` timer → `time:up` | `on:{'time:up':{end:'success'}}` (+ fail hook via hazard) | **trivial** — idle N s, assert alive |
| **collect-all** | inventory | `pickup` idioms + an all-collected watch → `all:collected` | `on:{'pickup:*':{emit:grant},'all:collected':{end:'success'}}` + `produces` grant | **cheap** — waypoints through every pickup |
| **deliver** | — (opt inventory) | pickup + dropzone trigger → `delivered` | `on:{'delivered':{end:'success'}}` | **cheap** — waypoints A→B |
| **score-goal** | — | `scoreCounter` + threshold watch → `score:reached`; `countdown` → `time:up` | `on:{'score:reached':{end:'success'},'time:up':{end:'fail'}}` | **medium** — depends what raises score |
| **puzzle-solve** | (opt flags) | switches (`deed`) + a condition watch → `solved` | `on:{'solved':{end:'success'}}` | **medium** — scripted switch route |
| **fail-on-death** | character | hp watch → `dead` when hp≤0 | `on:{'dead':{end:'fail'}}` | trivial — a lethality opt-in, composes with ANY terminal (decided 2026-07-05, split from hazard-damage) |
| **defeat-all** | (opt character) | `spawnOnHeartbeat` enemies + cleared watch → `enemies:cleared` | `on:{'enemies:cleared':{end:'success'}}` | **HARD** — needs combat input (deferred) |
| **party-battle** | party | a turn-based encounter sub-system (new) | resolves to xp/casualty events + end | **HARD** — own sub-system (deferred) |

### Emitters — write the outcome envelope during play (non-terminal)

| Mechanic | Requires | World lowering | Contract lowering | Note |
|---|---|---|---|---|
| **collect** | inventory | `pickup` variant emitting `pickup:<tag>` | `on:{'pickup:<tag>':{emit:{grant,item}}}` + `produces` grant | collect-all = collect + terminal |
| **loot-cache** | inventory | interactable (`deed`) → `open:cache` | `on:{'open:cache':{emit:{grant,...bundle}}}` | a container that grants a bundle |
| **defeat-yields** | inventory\|character | enemy-down event → `enemy:down` | `on:{'enemy:down':{emit:grant\|levelUp\|setStat}}` | pairs with defeat-all once combat lands |
| **rescue** | party | NPC reach trigger → `rescued:<id>` | `on:{'rescued:*':{emit:recruit}}` + `produces` recruit | **audit: free** — walkability to the NPC |
| **hazard-damage** | character | hazard `zone` → `hurt` | `on:{'hurt':{emit:{setStat,hp,delta<0}}}` | pure emitter now — lethality is the separate `fail-on-death` terminal (decided 2026-07-05) |

### Gates — in-level progression (flags; some persist to the store)

| Mechanic | Requires | World lowering | Persists? | Note |
|---|---|---|---|---|
| **key→door** | (opt flags) | key pickup sets a var; door reaction gated on it | in-level, or `setFlag` if cross-level | audit: waypoints key→door→exit |
| **switch→gate** | — | switch (`deed`) sets a var; barrier reaction | in-level | classic lever/barrier |
| **wave/phase** | — | `spawnOnHeartbeat` sequencing (clear wave 1 → spawn 2) | in-level | ramps difficulty |
| **toll-gate** | inventory | gate checks a loadout item; passing consumes it | `consumes` + `produces` consume | audit needs the item in the loadout |

## The audit gradient (why v1 excludes combat)

Everything tagged **free / trivial / cheap** auto-verifies with machinery that already exists —
the waypoint compiler (`compileWalkTo`), or literally waiting. Everything tagged **HARD**
(`defeat-all`, `party-battle`) needs a *combat traversal* the substrate does not have: an enemy
AI or a scripted attack sequence. Combat is therefore NOT a mechanic we add — it is a new **world
idiom** (and, for tactics, a turn sub-system) that must land first; the mechanic wraps it later.
Keeping that boundary visible is the discipline: mechanics lower onto existing idioms, and the
frontier is named, not smuggled.

## Composition — coverage without combat

- **Dungeon crawler level:** reach-exit + collect + key→door + hazard-damage.
- **Collectathon level:** collect-all + hazard-damage.
- **Arena / survival level:** survive (or score-goal) + defeat-yields (combat-gated) / hazards.
- **Delivery run:** deliver + toll-gate.
- **Rescue level:** reach-exit + rescue.

All but the arena's `defeat-yields` are buildable from the cheap cluster with ZERO combat — a lot
of game for a v1.

## v1 starter set (all auto-auditable, no new world behavior)

`reach-exit` · `collect` (+`collect-all`) · `survive` · `deliver` · `key→door` ·
`switch→gate` · `hazard-damage` · `fail-on-death` · `rescue` · `toll-gate`.

Covers crawler / collectathon / delivery / rescue / (hazard-)arena game types end to end,
each level auto-verifiable by G4.

**Second wave:** `score-goal`, `puzzle-solve`, `loot-cache`, `wave/phase`.
**Deferred behind a combat idiom:** `defeat-all`, `defeat-yields`, `party-battle`.

## Authoring & MCP surface

- **Declaration:** `game: { levelRef, mechanics: [ { kind, ...params } ], ... }` on the world
  manifest (an additive field beside the existing `consumes`/`produces`/`on`/`presets`). Lowering
  runs in the game-channel resolve; the synthesized `produces`/`on`/`consumes` merge with any
  hand-authored ones (hand-authored wins on conflict, and a conflict is a teaching error).
- **Vocabulary:** a new `game_mechanic` embeddings kind (CHECK-rebuild migration, the
  `beats_vocab`/`game_vocab` idiom) + cards under `lib/graph/game/mechanic-cards/`, wired into
  `reindexAll`. `get_game_vocab` extended to read mechanic cards too (or a peer reader). Discovery:
  `semantic_search({kinds:['game_mechanic']})` → intent → mechanic card.
- **No new mint tool.** Mechanics ride the existing `compose_world` + `create_game` path;
  `create_game`'s ≥1-terminal check and the mechanic-derived audit recipes plug into the G4 gate.
- **`get_game_vocab` / TOOL_INDEX / ROUTING_INDEX** gain the mechanic vocabulary rows (the
  context.test.js sweep enforces registration).

## World-affordance prerequisite (verified 2026-07-05)

The mechanics are all "the walking player touches a level object → a fact fires," but the world
runtime does not emit that fact today. Verified against the code: contact facts come ONLY from
`physics-sim.js` (rigid-body sphere/box pairs, fed to the bus via `deriveEvents`); the
CONTROLLABLE (walk) entity in `controllable-world.js` does movement only and emits no contact /
zone / proximity fact. The contact idioms (`pickup`, `onContact`) were built for physics-body
worlds (whack-a-mole, billiards), not a walked character. Making the player a physics body doesn't
help — physics RESOLVES every contact (shoves the player off the item); there is no non-blocking
sensor overlap.

So the cheap-cluster mechanics share ONE missing keystone: **a trigger/zone fact source for
controllable entities** — a per-tick, deterministic overlap test (entity positions vs declared
zones) emitting `enter`/`exit` facts into the SAME bus the reactions consume. It is a new FACT
source, the exact seam the physics→facts→bus model was built to extend (`deriveEvents` has a
sibling `deriveZoneEvents`). This one affordance unlocks reach-exit, collect, hazard-damage,
rescue, deliver, and key-pickup — the entire v1 cheap cluster. Two lesser gaps: toggleable
barriers (`key→door`/`switch→gate` want to remove a solid's collision at runtime; the walk
`solids` set is static — degrade to visual+flag for v1) and carry/attach (`deliver` — fakeable as
collect-flag + reach-dropzone). Neither blocks v1.

Consequence: the lowering core is NOT M0. The zone fact source is.

## Phases

**M0-pre — the controllable trigger/zone fact source. [BUILT 2026-07-05]** `deriveZoneEvents(entities,
prev, zoneSources)` in [event-bus.js](worlds/event-bus.js) (exported on the bus + as a module
binding), mirroring `deriveEvents`: edge-triggered `enter`/`exit` facts from a per-tick overlap test
of entity positions against `{ type:'zone', zone, at, radius|half, watch?, planar? }` sources.
Tolerates controllable (`transform.pos`) and physics-body (`position`) shapes; `planar` ignores Z
(a floor footprint a jumping player still triggers); `watch` globs which entity a zone reacts to.
Wired into the events-channel loop in [channels.js](scene/channels.js) beside the physics deriver,
gated on `window.__mojCtrl`, threading its own `__zonePrev`. 10 tests in
[zone-source.test.js](worlds/zone-source.test.js): edge-trigger onset/exit, sphere-vs-box geometry,
planar, watch-glob, determinism, physics-body tolerance, the full path through the REAL bus reducer
(enter fact → reaction → var), and emit guards (a controllable world with a zone source emits the
deriver; a world with no events channel does not — additive/byte-identical). 218 world+bus+channels
tests green, no regression. This is the affordance every spatial mechanic lowers onto: a reach-exit
mechanic emits a `zone` source + `on:{'enter'...}:{end:'success'}}`; collect/hazard/rescue/deliver
follow the same shape.

**M0 — the lowering core. [BUILT 2026-07-05]** [game/mechanics.js](game/mechanics.js): the
`lowerMechanic(kind, params, ctx)` registry + `composeMechanics(list, ctx)`. Shipped mechanics:
`reach-exit` (success terminal → zone + `goal:reached` → end, walkto audit), `survive` (success
terminal → self-gated countdown → `time:up`, idle audit), `collect` (emitter → per-pickup zone →
`pickup:<item>`, grouped on-map → grant), `hazard-damage` (emitter → hazard zones → in-level hp
decrement), `fail-on-death` (fail terminal → `hp≤0` watch → end fail). `composeMechanics` merges
fragments (dedup-merging shared vars like `hp`, concat arrays, conflict-checking the on-map),
enforces the two rules (≥1 SUCCESS-capable terminal; every required slice present in the store),
and lowers the cross-cutting **fall policy** (catch-box below the world → respawn `move` + a
clamped `-penalty min:1` so a fall never reaches 0). Two prerequisite bus affordances also landed:
the `min`/`max` CLAMP on `inc`/`set`, and `syncToCtrl` (a `move` on a controllable id → a warp
intent teleporting the walking player). 28 tests: per-mechanic lowering, the two refusal rules,
var-conflict detection, all three fall modes, and TWO end-to-end proofs driving the REAL bus
reducer (exit-zone → goal:reached; hazard → hp drop → fail-on-death fires). Affordances: 11 tests
([fall-affordances.test.js](worlds/fall-affordances.test.js)). 301 game+world+channel tests green,
no regression. Deviation: `collect-all` (the terminal variant) and per-hit store persistence
(stat-carry) deferred — `hazard-damage` damages the in-level hp var only in M0 (feeds fail-on-death
/ HUD); persisting final hp to the store needs end-of-level var→envelope wiring, a later pass. No
world wiring or MCP yet (M1/M2).

**M1 — the game channel consumes mechanics. [BUILT 2026-07-05]** `game.mechanics` (+ `game.fall`)
in [world-scene.js](worlds/world-scene.js) `resolveWorldScene`: composed ONCE (before the events
block), the lowered `events` fragment merged into the manifest's own events (`mergeEventManifests`
— both run on the one bus), and the synthesized contract merged into the game channel
(`mergeContract` — mechanic `produces` nest under `produces.events`, `on`-map spliced, hand-authored
keys win, `audits` carried for G4). Player id + spawn derived from the level's walk/platform entity
(`deriveLevelPlayer`). The store isn't known at level-resolve, so mechanics NAME their slices
(`into:'bag'`) and `composeMechanics` defers the store-presence check (create_game re-validates the
synthesized contract against the real store). A bad mechanic set fails the resolve loudly. 6
integration tests ([mechanics-resolve.test.js](game/mechanics-resolve.test.js)): lowering into
events + synthesized contract, teaching-error on a bad set, hand+mechanic event coexistence,
additive no-op without mechanics, and TWO end-to-end proofs (walking the hero to the exit fires
`goal:reached` through the real bus; the emitted World HTML carries both the zone deriver and the
`__mojGame` bridge — a playable level). 116 game+world+create-game tests green; the 2
education-module failures are pre-existing (view-consolidation thread), confirmed by stash-diff.
Exit met: **a level declared purely by mechanics renders, plays, and has its contract synthesized.**

**M2 — vocabulary + discovery. [BUILT 2026-07-05]** A new `game_mechanic` embeddings kind
([mechanic-cards/loader.js](game/mechanic-cards/loader.js) + one card per shipped mechanic +
`fall-policy` + a `mechanics-guide` overview), wired into `reindexAll` (`BodyComposition.gameMechanic`,
`SOURCE_KINDS`), the CHECK-rebuild migration (verified against the live DB: 2610 rows preserved,
`game_mechanic` inserts), and the pinned `SOURCE_KINDS` test. `get_game_vocab` now serves BOTH
families — store `slice` cards and level `mechanic` cards — with an optional `scope` filter and a
per-row `scope` tag; reading by id searches both catalogs. `create_game` + `get_game_vocab`
descriptions and the context.js TOOL_INDEX/ROUTING_INDEX rows updated to route "declare a level from
verbs" → `semantic_search({kinds:['game_mechanic']})` → `get_game_vocab`. 143 tests green (card
coverage ↔ MECHANIC_KINDS, both-family serving + scope filter, embeddings SOURCE_KINDS, context
sweep). Exit met: **an agent finds a mechanic by intent, reads its manual, and composes a level from
mechanics over MCP.**

**M3 — mechanic-derived audits. [BUILT 2026-07-05]** `compileMechanicAudit(contract)` in
[game-audit.js](game/game-audit.js) turns a success-terminal's audit hint into a runnable
forge_motion traversal PLAN — `reach-exit`'s `walkto` → a waypoint route to the exit; `survive`'s
`idle` → idle ticks past the timer. `auditLevel` is now async and takes an injectable `autoRun`:
with no `motion_ref` it compiles + auto-runs the plan and judges the probe's `game.result`; the
real runner ([auto-audit-runner.js](game/auto-audit-runner.js)) drives the same headless traversal
`forge_motion` uses (probes-only, PNG-skipped) and is lazy-imported ONLY when `auto_audit` is set,
so a normal mint never pulls in the render pipeline. `create_game` gains `auto_audit`; a level built
from auto-auditable mechanics passes the gate with **no hand-authored traversal**, and an unaudited
auto-auditable level's refusal now carries the exact compiled plan (`audit_plan` in the result).
Refactor: the M1 lowering helpers were extracted to [level-synth.js](game/level-synth.js)
(`synthesizeLevel`), now shared by world-scene (render) AND game-resolve (mint/serve) so a
mechanics-authored level's contract is synthesized identically on both paths — this fixed a real
gap where `resolveGame` validated the un-synthesized `game.mechanics` channel. 15 M3 tests
(pure compile; injected-runner gate — win/lose/throw; the full mint auto-auditing a mechanics
crawler with no motion_ref) + 246 worlds/motion + 143 game/create-game green. Exit met: **a crawler
minted from mechanics passes the G4 gate with an auto-generated audit** (`auto_audit:true`).

**M4 — game kits. [BUILT 2026-07-05]** The second "don't start from scratch" layer:
[kits.js](game/kits.js) — a registry of 3 kits (`dungeon-crawler`, `collectathon`,
`survival-arena`), each a curated store + a `levelChannel(geometry) → game channel (mechanics+fall)`
+ a progression convention. `scaffoldGameFromKit(kitId, { title, levels })` turns per-level geometry
into a complete `create_game` input (store + gated `levels`) PLUS the per-level `game` channels to
attach when minting each world — a whole game shape becomes fill-in-the-geometry. Kits compose
mechanics (M0–M3), nothing new underneath. Enabler: **shell auto-promote on success**
([game-shell.js](game/game-shell.js)) — beating a level records completion in the progression
slice, so `gated` progression works universally (mechanics levels don't emit their own promote).
Discovery: a `game_kit` embeddings kind ([kit-cards/loader.js](game/kit-cards/loader.js) — cards
GENERATED from the registry so they can't drift, each with the store + a two-level worked example),
wired into `reindexAll` + the CHECK-rebuild migration (verified on the live DB) + the pinned
`SOURCE_KINDS`. `get_game_vocab` now serves THREE families (slice / mechanic / kit) with `scope`;
`create_game` + context.js route "make a dungeon crawler / survival arena" → `game_kit`. 81 M4 tests
(scaffold validity — store validates, channels lower, the assembled game passes resolveGame with
its synthesized produces + audits; linear vs gated; card↔registry no-drift; shell auto-promote
intact) + 179 game/world/context/embeddings green. Exit met: **a kit hands you a ready store +
level templates + gates; you fill geometry and mint a verified game.**

**Deferred (still M4/later):** the combat idiom that unblocks `defeat-*`; the tactics turn
sub-system for `party-battle`; second-wave mechanics (`collect-all`, `deliver`, `key→door`,
`rescue`, `toll-gate`); a `tactics-campaign` kit (needs the party-battle terminal).

## Deliberately out

- **Arbitrary mechanic code / a plugin API** — closed card-backed vocabulary or nothing.
- **Combat** (`defeat-all`, `defeat-yields`, `party-battle`) — needs a world idiom / sub-system
  first; parked with a visible marker, not faked.
- **New store slices or typed events** — mechanics compose the EXISTING vocabulary; a mechanic
  that needs a new event is a store-layer change first (game-metacontext.plan.md), not here.
- **Runtime mechanic behavior** — everything lowers to declarative world+contract at author time.

## Decisions (settled 2026-07-05)

1. **fail-on-death is its own terminal mechanic**, split from `hazard-damage`. Any level opts into
   "hp≤0 → fail" independently of hazards; `hazard-damage` is now a pure emitter (the setStat).
   Composes with any success-terminal so `survive` / `collect-all` levels can be lethal.
2. **Timed/par is a MODIFIER, not a mechanic.** "Finish under T for a bonus grant" (and peers like
   no-damage bonus) live in a `modifiers` field on the mechanics block, garnishing whatever
   terminal the level has — cross-cutting, so it never duplicates per terminal. The mechanic list
   stays true roles only. (M0 defines the `modifiers` shape; the par-time modifier itself can land
   in the second wave.)
3. **Fall handling is a cross-cutting `fall` POLICY (not a mechanic), with a humane default.** A
   walkable level with edges/void needs a catch policy; it lowers onto a **catch-zone** (a `planar`
   `zone` source at the world's bottom Z — the M0-pre affordance). Modes:
   `fall: { mode:'respawn', penalty?:n, floor:1, to?:'spawn'|checkpointId } | 'lethal' | 'none'`.
   The DEFAULT is `respawn` with penalty 0 (a fall costs position, not health). The opt-in the
   operator asked for (2026-07-05) is `respawn` with a penalty **clamped so hp floors at 1** — so a
   fall can NEVER reach hp≤0 and therefore never trips `fail-on-death`. Falls stay decoupled from
   the lethal-hazard path by construction. **Two small world affordances this needs (fall-handling
   prerequisites, in-grain, not yet built):** (a) a `min`/`max` CLAMP on the bus `inc`/`set` verbs
   (`{do:'inc',var:'hp',by:-20,min:1}`) — trivial, reusable for any capped resource; (b) a RESPAWN
   teleport — bus `move` repositions bus entities + physics-linked bodies but NOT the controllable
   player (lives in `__mojCtrl`), so respawn needs a bus→controllable position write, the symmetric
   inverse of the M0-pre zone read (`syncToCtrl`, mirroring `syncToBodies`). Build both in the
   fall-handling slice; `checkpoint` (respawn target) integration is later, v1 respawns to spawn.

## Open questions (flagged, not decided)

1. **Combat now or a no-combat v1?** A no-combat v1 covers crawler/collectathon/delivery/rescue
   and is fully auto-auditable; combat is a separate, heavier thread (idiom + audit machinery).
   Leaning no-combat-first unless a real target demands it.
