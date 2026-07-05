# game metacontext — the standalone game artifact (shell + store + level contracts)

Status: G0–G4 BUILT (first pass, 2026-07-05); G5 (later) remains. What shipped: the store kernel +
level/game contracts + six slice-cards (G0); the `game:` world-manifest channel + the `__mojGame`
postMessage bridge in scene-three.js (G1); `emitGameShell` (G2); the MCP surface — `create_game` /
`get_game_vocab`, the `game_vocab` embeddings kind (CHECK-rebuild migration, verified against the
live DB: 2610 rows preserved), the served shell at `/api/sketches/<ref>/game` + `game` render mode,
and TOOL_INDEX / ROUTING_INDEX rows (G3); and the VERIFICATION GATE (G4) — `game-audit.js`
(`dryRunContract` + `probeShowsCompletion` + `readTraversalAudit`), the `game` field on the capture
probe surface so a traversal doubles as a completability audit, and `create_game`'s per-level gate
(contract dry-run always; completability via an `audits` map of stored traversals that reached the
win condition; `allow_unaudited` override, recorded per level). ~150 tests green across
`lib/graph/game/` + `create-game*.test.js`; context registry sweep + world/motion suites (226)
green. Per-phase deviations recorded inline below. The one scope call worth flagging up top: the served
form (levels hosted in an iframe pointing at their live `/world` page) shipped first; the fully
standalone folder export — where each level is inlined self-contained HTML with three.js vendored
in — is deferred to a later phase (it needs the .glb-export-class bundling seam). "Standalone by
construction" holds at the contract/store/kernel layer today; the artifact is served, not yet a
loose folder.

Drafted 2026-07-04 from a design conversation on
the heels of the renderer-convergence landing ([renderer-convergence.plan.md](renderer-convergence.plan.md)).
Convergence gave worlds inhabitants (rigs + waypoints), audio cues, and a traverse-and-verify
loop; this plan is the abstraction layer that turns those worlds into *games* — and it
deliberately does so as a **fourth artifact paradigm** (Bot / Connected Service / App /
**Game**), not as a feature of the World route.

## The idea in one paragraph

A game is a **standalone artifact**: one shell page that owns a typed store, plus N
single-file HTML levels that are pure functions of their inputs. Mojulo is the *factory and
design-time substrate* — it holds the game's metacontext (store schema, slice choices, level
contracts, the sealed record of what was decided), mints and verifies levels, and stages the
artifact. The artifact then runs anywhere, forever, with no mojulo, no network, no keys.
This is the bot-artifact relationship applied to games: mojulo builds the zip; the runtime
owns its own state; play data never flows back into the control-plane DB.

## Doctrine (decided)

- **Play data never enters mojulo.** The runtime invariant, mirroring "conversation data
  never moves into the control-plane DB." Mojulo holds recipes, schemas, contracts, and
  verification evidence. When the operator wants play data analyzed, a *save file* is
  imported through a defined read-once channel (late phase) — a door, never a wire.
- **The game is standalone by construction, not by export.** No loopback POST, no
  agent-tasks queue, no daemon. The shell + levels + saves work from any static file server
  (and degrade gracefully to `file://` where browser storage allows). If a design forces a
  runtime dependency on mojulo, the design is wrong.
- **A level is a pure function.** `(recipe, params, seed, input ticks) → outcome envelope`.
  Levels never touch storage, never know a store exists, never mutate anything outside
  themselves. Purity is what keeps levels replayable, diffable, auditable, and cheap to
  mint — it is the load-bearing constraint of this plan, the way pure-world (all-vector,
  no-pixels) is for the visual arm.
- **The store is a closed vocabulary, not a generic redux.** A small set of **slice kinds**
  (v1: `character`, `inventory`, `party`, `progression`, `flags`) mutated ONLY by **typed
  events** (v1: `grant`, `consume`, `setStat`, `levelUp`, `setFlag`, `promote`,
  `recruit`, `dismiss`). No arbitrary reducers, ever — the moment a game "needs" one, that
  is either a new slice-kind card or authoring-time logic the agent bakes into level
  parameters. The substrate stores what was decided; the shell executes it. Content-
  extensible by dropping a card, code-extensible only for new event semantics.
- **Reducers ship in the artifact, generated at build time.** Standalone means there is no
  agent at runtime to interpret anything. The store kernel's reducers are generated from
  the game's declared schema (slices × typed events) when the shell is emitted. This is why
  the closed vocabulary is structural, not taste.
- **Mid-session state never touches the store.** Current HP mid-fight, ammo mid-wave — that
  is level-internal sim state. The store only ever sees the outcome envelope at level exit.
  One write per session, validated against the level's `produces` schema. This preserves
  replayability and keeps the shell↔level channel non-chatty.
- **Saves are verifiable.** A save = `{ storeState, runLog, contractVersion }`, where each
  runLog entry MAY carry the session's `{ seed, ticks }`. Because outcomes are pure
  functions, a save that carries tick scripts can be *replayed* — a claimed outcome is
  checkable, portable across machines as a JSON file (export/import by download +
  drag-drop in the shell).
- **Seeded determinism.** Levels take a `seed`; kernels use mulberry32, never
  `Math.random` (beats-kernel precedent). Live human play is not deterministic — recording
  input ticks is what makes any given session replayable after the fact.
- **The postMessage contract is versioned from day one.** Shells and levels are minted at
  different times with no substrate mediating drift at runtime; both directions carry
  `contractVersion` and the shell refuses (with a legible error screen) on mismatch.
- **Commitment ladder unchanged.** Game declared (proposed) → store schema materialized
  (metacontext commit) → level dry-run against synthetic params → promoted into the game's
  level list → artifact staged. The four Ring-0 gate distinctions map one-to-one; no new
  trust model.

## Architecture

```
control/lib/graph/game/
  store-kernel.js      dependency-free store kernel, emitted via .toString()
                       (beats-kernel / physics-sim precedent):
                       - slice state shapes per slice kind
                       - typed-event reducers generated from the game schema
                       - persistence adapter: IndexedDB primary, localStorage
                         fallback, in-memory last resort (feature-detected)
                       - save export/import ({storeState, runLog, contractVersion})
  game-shell.js        emitGameShell(gameManifest, levels) → self-contained
                       game.html: level select / pre-level setup screen
                       (a param composer over each level's declared `consumes`),
                       iframe host, postMessage broker, save management UI
  level-contract.js    validate/normalize a level contract; validate an outcome
                       envelope against `produces`; the postMessage wire schema
  game-manifest.js     validate/normalize the game manifest (see below)
  slice-cards/*.md     vocab cards (JSON frontmatter), one per slice kind + one
                       per typed event family; loader.js mirroring beats-vocab
```

### The three manifests

All small, deterministic, sketches-table-shaped (recipes, not renders):

- **Game manifest** (`kind: 'game'`, one row): `{ kind, title, contractVersion,
  store: { slices: [{ name, kind: character|inventory|party|progression|flags,
  schema-per-kind params }] }, levels: [{ ref, title, order, gate? }] }`. The `levels`
  list holds refs to promoted level rows; `gate` is an optional flags-predicate for
  unlock ordering (declarative, no code).
- **Level contract** (rides the level's existing world manifest as a `game:` channel,
  beside `walk`/`fog`/`audio`): `{ consumes: [{ slice, projection }], produces:
  { events: [allowed typed events], result: enum(success|fail|abort), payloadSchema } ,
  presets: { <named default param sets> } }`. A level with no shell still runs — it
  falls back to its `presets` (levels are playable standalone in dev, parameterized in
  a game).
- **Outcome envelope** (never persisted by mojulo; lives in the artifact's runLog):
  `{ contractVersion, levelRef, seed, result, events: [typed events], ticks? }`.

### The session loop (runtime, entirely inside the artifact)

1. Shell reads store → renders the pre-level setup screen from the level's `consumes`
   (the tactics army picker and the loadout screen are both just this composer).
2. Shell → level iframe: `{ contractVersion, params, seed }` via postMessage.
3. Level runs pure. At exit it posts back the outcome envelope. One message, once.
4. Shell validates the envelope against `produces` (allowed events only), applies the
   typed events through the generated reducers, appends the envelope to the runLog,
   persists.

### Verification (design time, in mojulo — the payoff no engine has)

- **Completability audit**: renderer-convergence step 3's walkability audit generalized —
  mint level → `compileWalkTo` / tick script to the exit condition → probe-assert the
  outcome envelope's `result: success`. A level is not promoted into a game manifest
  until a compiled run completes it. Runs through the existing `__mojCapture` /
  `renderWorldTraversal` machinery; the outcome envelope is captured from the same
  postMessage the shell would receive.
- **Contract dry-run**: exercise a level against synthetic params drawn from each
  `consumes` slice's schema (empty inventory, maxed loadout, minimal party) and assert
  the envelope validates. The dry-run → inspect → promote posture, verbatim.
- Evidence lands in `lite-template/integration/<date>/spike-output/game-*/` per house
  convention.

### MCP surface (one dispatcher mint + one vocab drawer, create_view/create_beats precedent)

- `create_game` — mint/revise the game manifest: declare store slices, attach/promote
  level refs, emit the artifact (staged zip into `control/data/artifacts/`, docker.js
  staging precedent — shell + levels + a README). Hand-validated with teaching errors.
- `get_game_vocab` — list/read slice + event cards; embedded under a new
  `meta_embeddings` `source_kind = 'game_vocab'` (the `migrateStashItemTypeCheck`
  CHECK-rebuild idiom), wired into `reindexAll`, so
  `semantic_search({ kinds: ['game_vocab'] })` routes intent → slice card.
- Level contracts ride `compose_world` (a `game:` manifest channel), not a new tool.
- Registration next to the visual-mint cluster; both tools get `TOOL_INDEX` rows
  (context.test.js sweep enforces); one ROUTING_INDEX row for the framing
  "make/design a game." Metacontext commits: game declaration and level promotion are
  `meta_context_commit` events — the *why* is sealed; the manifest is the present-state.

## Phases

**G0 — store kernel + contracts (no UI, no MCP).** `store-kernel.js`,
`level-contract.js`, `game-manifest.js`, slice cards, node tests: reducers generated
from a schema apply typed events deterministically; envelope validation rejects
undeclared events; save export → import round-trips byte-identically.

**G1 — level contract channel + presets.** The `game:` channel in
`resolveWorldScene()` (additive, beside `audio`); a level with the channel but no shell
runs on its `presets`; a recipe without `game:` emits byte-identical HTML to today.
Exit: one existing action world gains a contract and still renders unchanged everywhere.

**G2 — shell.** `emitGameShell` + the postMessage broker + setup-screen composer +
save UI. Exit: a two-level game runs from a static folder — loadout chosen on the setup
screen reaches level 1 as params; level 1's outcome (loot granted) is visible in level
2's setup screen; refresh persists; save exports and re-imports.

**G3 — MCP + artifact.** `create_game` + `get_game_vocab` + embeddings migration +
staged zip + metacontext commits + TOOL_INDEX/ROUTING_INDEX rows. Exit: an agent mints
a game over MCP end to end and the zip runs standalone; context.test.js sweep green.

**G4 — verification loop.** [BUILT] Two checks feed `create_game`'s per-level promotion
gate ([game-audit.js](game/game-audit.js)): (1) a CONTRACT DRY-RUN (pure, always-on) —
synthesize the maximal outcome the level's `produces` permits, seed a store so state-dependent
events have targets, confirm it validates + applies; a contract that could never emit a valid
envelope is refused at mint. (2) COMPLETABILITY (evidence-based) — the `game` field added to
the capture probe surface (scene-three.js `__mojCapture.probe()`) makes a `forge_motion`
TRAVERSAL double as a completability audit; the caller passes `audits: { <ref>: { motion_ref } }`
and the gate reads that stored traversal's `recipe.json` + `probes.json`, confirming it was OF
this level and its final probe shows `game.result === 'success'`. A level with no audit is
refused unless `allow_unaudited: true` (recorded per level in the result's `audits[]`, `audited:
false`). Deviations from the design: (a) evidence is a stored traversal on disk, not a
metacontext commit — games don't yet write commits (that rides with the standalone-export/G5
work); the override is recorded in the mint RESULT, not a commit. (b) The dry-run proves
contract COMPOSABILITY (one valid envelope exists), not per-`consumes`-permutation validation —
the level is arbitrary code, so what an actual playthrough emits is only knowable from the
completability run, which is the real gate.

**G5 — later.** Save-file *import into mojulo* for analysis (read-once, likely a
`gather` item type — needs the stash type migration, decide then); a whole-game
single-file build (levels inlined via `srcdoc` — attractive, but size says folder first);
NPC/store interplay (persistent NPC state as a slice kind — only with a real game
demanding it); CLAUDE.md architecture-map entry.

## Deliberately out

- **Any runtime dependency on mojulo** — no telemetry, no live observation of play, no
  inference at runtime. The agent's role ends when the artifact is staged.
- **Arbitrary reducers / user code in the store** — closed vocabulary or nothing.
- **Mid-session store writes** — one envelope per session, at exit.
- **Multiplayer, accounts, cloud saves, DRM** — single-player, single-file saves;
  portability is the feature.
- **Asset import** — levels are worlds; worlds are pure-vector recipes. Unchanged.
- **A visual game editor** — the manifest is the only source of truth; the shell renders
  and plays, it does not author.
- **Pathfinding/AI beyond what convergence landed** — NPC behavior widening is a
  different thread.

## Open questions (flagged, not decided)

- `file://` storage quirks vary by browser; the kernel's persistence adapter
  feature-detects, but the honest baseline may be "run it with any static server" —
  decide the documented posture in G2 when the adapter is real.
- Whether the pre-level setup screen ever needs game-specific layout beyond what
  `consumes` schemas can drive declaratively; hold the line until a real game breaks it.
- Ref/URL shape for the staged artifact page(s) vs the existing `/sketches/<ref>`
  render modes — G3 decision, alongside the zip layout.
