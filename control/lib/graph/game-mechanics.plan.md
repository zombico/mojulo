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
| **defeat-all** | (opt character) | `spawnOnHeartbeat` enemies + cleared watch → `enemies:cleared` | `on:{'enemies:cleared':{end:'success'}}` | **HARD** — needs combat input (deferred) |
| **party-battle** | party | a turn-based encounter sub-system (new) | resolves to xp/casualty events + end | **HARD** — own sub-system (deferred) |

### Emitters — write the outcome envelope during play (non-terminal)

| Mechanic | Requires | World lowering | Contract lowering | Note |
|---|---|---|---|---|
| **collect** | inventory | `pickup` variant emitting `pickup:<tag>` | `on:{'pickup:<tag>':{emit:{grant,item}}}` + `produces` grant | collect-all = collect + terminal |
| **loot-cache** | inventory | interactable (`deed`) → `open:cache` | `on:{'open:cache':{emit:{grant,...bundle}}}` | a container that grants a bundle |
| **defeat-yields** | inventory\|character | enemy-down event → `enemy:down` | `on:{'enemy:down':{emit:grant\|levelUp\|setStat}}` | pairs with defeat-all once combat lands |
| **rescue** | party | NPC reach trigger → `rescued:<id>` | `on:{'rescued:*':{emit:recruit}}` + `produces` recruit | **audit: free** — walkability to the NPC |
| **hazard-damage** | character | hazard contact `source` → `hurt` | `on:{'hurt':{emit:{setStat,hp,delta<0}}}`; hp≤0 → `end('fail')` | an emitter that also owns a fail-terminal |

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
`switch→gate` · `hazard-damage` · `rescue` · `toll-gate`.

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

## Phases

**M0 — the lowering core.** `lib/graph/game/mechanics.js`: the role taxonomy, the
`lowerMechanic(kind, params, storeSchema) → { world, produces, on, consumes, requires, audit }`
registry, and `composeMechanics(list, storeSchema)` (compose world fragments via the idiom
`compose()`, merge contract fragments, enforce ≥1 terminal + required-slice presence). Node tests:
each starter mechanic lowers to the expected fragments; a terminal-less list is rejected; lowering
is deterministic. No MCP, no world wiring.

**M1 — the game channel consumes mechanics.** `game.mechanics` in the world-scene game-channel
resolve → lowered into the world `events` manifest + the normalized contract. Exit: a level
declared purely by mechanics renders and plays; its contract is synthesized; a level with no
terminal is refused at mint.

**M2 — vocabulary + discovery.** `game_mechanic` embeddings kind + mechanic cards + `reindexAll` +
`get_game_vocab` extension + index rows. Exit: an agent finds a mechanic by intent, reads its
manual, and composes a level from mechanics over MCP; context sweep green.

**M3 — mechanic-derived audits.** Each mechanic emits its G4 completability recipe; `create_game`
can auto-run the cheap ones (walkability / idle) so a level backed by only auto-auditable
mechanics needs no hand-authored traversal to pass the gate. Exit: a crawler level minted from
mechanics passes the G4 gate with an auto-generated audit.

**M4 — later.** Game kits (the second layer: store schema + level templates from mechanics);
the combat idiom that unblocks `defeat-*`; the tactics turn sub-system for `party-battle`.

## Deliberately out

- **Arbitrary mechanic code / a plugin API** — closed card-backed vocabulary or nothing.
- **Combat** (`defeat-all`, `defeat-yields`, `party-battle`) — needs a world idiom / sub-system
  first; parked with a visible marker, not faked.
- **New store slices or typed events** — mechanics compose the EXISTING vocabulary; a mechanic
  that needs a new event is a store-layer change first (game-metacontext.plan.md), not here.
- **Runtime mechanic behavior** — everything lowers to declarative world+contract at author time.

## Open questions (flagged, not decided)

1. **fail-on-death as its own mechanic?** Split the lethality/fail-terminal out of `hazard-damage`
   so any level can opt into "hp≤0 → fail" independently of hazards. Leaning yes — it's a
   cross-cutting terminal, and decoupling it lets `survive`/`collect-all` levels be lethal.
2. **A timed/par MODIFIER rather than a mechanic?** "Finish under T for a bonus grant" is
   cross-cutting garnish on any terminal, not a role. Likely a `modifiers` field on the mechanics
   block, not a mechanic — decide when M0's shape settles.
3. **Combat now or a no-combat v1?** A no-combat v1 covers crawler/collectathon/delivery/rescue
   and is fully auto-auditable; combat is a separate, heavier thread (idiom + audit machinery).
   Leaning no-combat-first unless a real target demands it.
