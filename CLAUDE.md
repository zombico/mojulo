# CLAUDE.md

Fast orientation for agents working in this repo. Rules and pointers only. If a line needs a paragraph of
caveats it belongs in `docs/` with a pointer here. Do not cite `*.plan.md` files from this file, code
comments, docs, or the changelog: plans are working documents that move to
`lite-template/integration/plan-archive/` once merged, and the whole `integration/` tree is gitignored.

## What this is

In one line: a modular 3D creative studio, built for agents to help a person make content that is composable, editable
and theirs for good. Every tool, rail and composition is an assistive guide toward that. Game makers before us turned
their craft into words ("concepts": a core loop, a walled-core dungeon, game feel); mojulo binds those words to code that
runs the same way every time, so an agent writes a recipe in them and mojulo reads it as the detail of a character or a
world. For games the goal is to take a person from nothing to a first level they can play:
[docs/zero-to-level-one.md](docs/zero-to-level-one.md).

A local MCP server with a dashboard that turns the operator's agent into a 3D creative studio: 3D objects, characters,
environments, interactive worlds and even playable games, exported to the person's desktop. Inside, the agent works
through its departments (`DEPARTMENTS` in `gameworld/chapters.js` is the list): worlds and levels (art direction, light, set pieces, cities planned for play),
characters, props and vehicles (`create_character`, `mint_solid`), play modes, animation and sound (`create_game`, feel,
juice, `create_beats`), foes and bosses, cinematics (the actor: a persona's `style` and `role`, scenes and their coverage,
`forge_motion`, the scenes card; craft in [docs/cinematics.md](docs/cinematics.md)), and game design and
production (`design_game`, the bibles, plans and sweeps), which ties the rest into a game, interface and UX (menus, a
game's front, screen and HUD; its runtime is mana-ui, below), level design (each block's play layer) and music (the
score and the audio direction). The last three are the newest and are not yet in the README or the `get_substrate`
drawer: a designed game's menus, pause, HUD and touch pad now run on mana-ui, so they are due there. The audit and the engine legs
are how everything holds up, not departments. Every department writes into one tiny deterministic recipe (a `sketches`
row) that regenerates on every read and exports to the web, a team's engine (Godot, Unity, Unreal, Blender), GLB, STL,
3MF, USD, which is why a game's bible, its levels and its export agree. Play, Print, Read, Hear and Observe are what
the departments' combinations make; rooms, prints and science views are the same studio's other outcomes.
Underneath, it is a 3D compiler for agents: that is how it works and what the agent is told, not what the person is
sold. Mojulo is the agent-driven upstream that feeds those tools, never a fidelity rival and never "just an exporter."
It makes single-player and couch-multiplayer games (online is out of scope) for two audiences: a solo creator gets the
whole game end to end on the web (`export_game`); developers and teams get a handoff of assets, animation and levels to
their engine, with the recipe and its bible as the team's design source and the web build as the prototype that
validated the loop (the `engine-handoff` theme).

The game rails take a person with an idea or a sketch from 0 to level 1. Every rail, studio tool and geocube
orchestration serves that: decide the characters, validate the loop, build the level, tune the play, run it in a shell
that links to the next level. The first session's goalposts ([goalposts.js](control/lib/graph/gameworld/goalposts.js))
are that path, and `design_game`'s readout says which is next. Level 1 is proved by the machine gate and approved by
the person, who plays it: it is the game they want to play. The level played as a turn (set-up, load, play, pause,
results: `game/turn.js`, mana-ui drawing it) is most games and the default to build toward; an open world (the quest
open world, a world map) is a different paradigm and is said to be. A new operator with no ask is offered four starts
(a character, a game, an object, a 3D exhibit) by the `initialize` preamble; for a game the agent expects
attachments (drawings, plans, docs) and knows what to do with each, where it would otherwise guess from the start;
the loop runs on what is missing. That step is the producer's ([intake.js](control/lib/graph/gameworld/intake.js), the
`gameworld-producer` card: the seat that faces the person and hands the director the work, one agent in both; the
assistant director holds a unit to its remit): a gameworld's `intake` records each thing brought as placed or set aside,
never dropped, and the readout says which goalposts it answered. A new kind of material is a row of `INTAKE_KINDS`.
The producer's rails, its pitch and its hand-off: [rails.js](control/lib/graph/gameworld/rails.js); the steps are the
`gameworld-producer` card's and the `game-design` routing card's.

Two audiences, one truth. The README, the plugin and the manifests speak to the person (the 3D creative studio): they
open broad, show the pieces it makes from the easy (an object) up to the hard (a game), and say what the person gets,
never how (no departments, requisitions, orders, gates or install weight). The drawers and the `initialize` preamble
speak to the agent (the compiler). The canonical self-description is the `get_substrate`
drawer in [control/lib/mcp/tools/context.js](control/lib/mcp/tools/context.js): its one-breath answer is what the
agent says to the person, so it and the README agree. The office wing (apps, daemons, contextmap, MCP-to-MCP binding)
left the tool surface in 3.1.0: `RETIRED_PACKS` in `packs.js`, callable by name, never listed or routed to.

One package. [control/](control/) is the product (Next.js 16 on 3001, ESM, vitest); all work happens here.
The chatbot factory and its bot runtime left in 3.0.0 for their own project; the unmaintained 2.x line still carries them.

## Where truth lives

- Current state of the branch: what is unreleased, `node scripts/changelog.mjs` (from `control/`): the Unreleased section
  of [control/CHANGELOG.md](control/CHANGELOG.md), then the theme files under `control/changelog/`.
  Releases before 3.0.0, and the detailed log behind 3.0.0, are in
  [control/CHANGELOG-2.x.md](control/CHANGELOG-2.x.md); the detailed log behind 3.1.1 is
  [control/CHANGELOG-3.1.md](control/CHANGELOG-3.1.md) (archives; add nothing new to either).
  `docs/STATUS.md` is the maintainer's gitignored ledger; regenerate it from tree state, never trust it.
- Version: `package.json` says 3.1.1, released 2026-10-16, the 3.1 line's first published release (`mojulo` 3.1.0 reached npm from a stale build of 2026-10-10 and is deprecated, since npm will not unpublish a package others depend on; npm never reuses a version, so the release is 3.1.1, and code and docs that say 3.1.0 mean this release; 3.0.0 was released 2026-10-01; 3.0.1 was prepared and never released, and its work ships in 3.1.0; 2.1.0 was released 2026-09-23; 2.2 was prepared and never released, and its work ships in 3.0.0; the plugin, `glama.json` and `server.json` pin the same version, checked by `control/scripts/check-plugin-version.mjs`; `mojulo orient` is the shell's `initialize` since 2.1.0; the exported World page is self-contained by default again since 3.0.0 (2.0.9 through 2.1 loaded three.js from the pinned CDN) — `cdn: true` for the CDN build an artifact host needs; 2.0.5 is broken on fresh installs, see `CHANGELOG-2.x.md`; the embedding runtime is the opt-in `recall` group since 2.0.7; the chatbot factory left in 3.0.0).
  New work never edits `CHANGELOG.md`: each theme is its own file, `control/changelog/<MMYY>/<MMDD>/<theme>.md` (the
  month, then the branch's day: `1026/1027/racing-arenas.md`), its first line `### <title>`; edit only your own theme's
  file. Two branches never touch the same lines. [control/changelog/README.md](control/changelog/README.md).
- Deep maps: [docs/AGENT-REFERENCE.md](docs/AGENT-REFERENCE.md) (rings and packs, workflows, substrate, data),
  [docs/MCP-ARCHITECTURE.md](docs/MCP-ARCHITECTURE.md) (transport, sessions, deliberation),
  [docs/install-capabilities.md](docs/install-capabilities.md) (kernel + packs + install groups),
  [CONTRIBUTING.md](CONTRIBUTING.md) (recipe book vs core), [AGENTS.md](AGENTS.md) (non-Claude hosts).
- What games can be made, and what to build next: [docs/tool-surface/hillclimb.md](docs/tool-surface/hillclimb.md)
  (generated from the cosmos registry and sweep; internal, not an MCP surface). Read it before picking game work;
  after changing the registry, `npm run tool-surface` (a critical test fails on a stale page). Skill: `/hillclimb`.
- What grows on what ground, and the flora library's gaps: [docs/flora-gaps.md](docs/flora-gaps.md) (generated from
  `era/substrate.js` and `era/substrate-flora.js`; after changing either or the library, `npm run flora-gaps`: a test
  fails on a stale page). Read it before adding flora.
- Where a game is made and where it is seen: [docs/workshop.md](docs/workshop.md). A cloud box builds and checks any game
  but shows a level only under its page limit, draws in software and forgets its data at session end; say so before a
  big game (a glyph-map chapter) is built there (design_game's `workshop` step; `pack-data` carries the database over).
- Never hardcode an enumerable count in docs (kinds, packs, tools, locales, test files). Point at the
  list that defines it; counts drift the day after they are written.
- "graph" means three things: `control/lib/graph/` is the geometry library; the contextmap is the
  `meta_*` tables in the same SQLite file; `/graph` is a static pipeline SVG.

## Golden rules

- **Recipes, not renders.** The manifest is the artifact; kernels regenerate on every read, so a kernel's
  output for given params is a compatibility promise over already-minted rows. Byte-identical re-render on the
  reference runtime (Node 22, both CPUs) is the baseline test for any kernel change; across Node majors a render is
  equal within tolerance, not byte for byte (CI runs the byte pins on the reference legs only). Seeded dice only (`mulberry32`); never `Math.random`, `Date`,
  `Intl` in a builder. An absent opt-in channel must contribute zero bytes.
- **Two gates, never conflated.** Machine gate (measured, automated) and eyes gate (a human looks). Never
  claim the eyes gate passed. All gates advise and stamp; none refuse. Say which gate ran and what was seen.
  [docs/bicycles.md](docs/bicycles.md), [docs/responsibility-model.md](docs/responsibility-model.md).
- **Recipes are starters.** Iterate in place with `update_sketch` / `edit_solid`; don't re-mint.
- **A capability joins a department and composes.** A new row on a shelf (a place, a foe, a look, a game type) is
  reachable from the keys that compose it, read in its book (the bibles), carried by its exports and checked by its
  audit. One that only works alone is a spike. The README's combinations stay true only while this holds.
- **Core is capability, the book is repertoire.** A new study-object kind is normally a recipe-book Door-2
  builder in [control/book/](control/book/), not a core addition. The book ships bundled (3.1.0); the
  separate `mojulo-recipe-book` repo and `MOJULO_RECIPE_BOOK` are deprecated (they cannot load in an agent box).
- **Single operator, loopback only.** No user identity by default; the roles pack is operator-owned
  delegation, not multi-tenancy. Do not add tenant isolation, tunnels, or public exposure. The MCP route is
  bearer-gated and 404s without a key; that is the whole auth surface, by design.
- **The dashboard is not a conversational surface.** The operator drives from their host agent. Do not add
  chat surfaces to the dashboard.
- **Suitability is the operator's.** Do not add intent classification, use-case gating, or content-policy
  layers over what the operator's LLM provider already enforces. Posture: [TERMS.md](TERMS.md).
- Never read or echo `.env` secrets from generated app directories.
- UI strings go through `next-intl`; add to `control/messages/en.json`, then `/sync-locales`. CI checks parity.
- Optional workers (Blender, ComfyUI, Kokoro, slicer, OpenSCAD, Godot, Unity, Unreal) are never dependencies.
  Absence degrades a loop, never breaks one. Search orders live in `control/lib/workers/find.js` (`version({ workers: true })`).
- Do not commit unless asked. Never touch `control/.next/`, `control/data/`, `.claude/worktrees/`.

## MCP tool surface (the tests that bite)

`tools/list` cannot be drawerized, so it is budgeted. The per-description ceiling and the flat payload pin
live in `tool-descriptions.test.js`; the packs payload pin lives in `packs.test.js`. If a legitimate
addition crosses a pin, re-pin it in the same commit with a comment saying why. A door is an intent the user voices:
a new capability is first an argument on the door that owns its intent, a routing card and a vocab drawer. A new listed
tool needs a phrasing no listed door owns, as a `routing-eval.fixture.js` row (a `create` / `compose` tool without one
fails `routing-cards.test.js`), and gate 2b showing the fold would route worse. New tool checklist: register in ring order in
`server.js`; exactly one pack home in `packs.js`; one line and a verb in `tool-lines.js` (the tool index, the form
bodies and the pack menus are generated from it), plus its form's `tools` in `context.js` if creative; a routing card (ceiling in `routing-cards/loader.js`) plus a `routing-eval.fixture.js` row if creative; the
`RING10_TOOLS` list in `context.test.js`; its row in `tool-annotations.js`. An unlisted tool is unreachable from the agent (CLI and plan steps only), so a fold rewrites every pointer to the old name. `forward_context` is a routing index, not a glossary; its bodies
have their own byte ceilings. Full map: [docs/AGENT-REFERENCE.md](docs/AGENT-REFERENCE.md#mcp-control-surface).

## Commands

```bash
cd control
cp .env.example .env         # first time
npm install
npm run dev                  # must stay --webpack; Turbopack melts down watching control/data/
npm run build                # --webpack too: Turbopack ignores next.config's webpack rules and fails on an absent pack or recall runtime
npm run test:changed         # the tests a change reaches on the import graph, its byte pins and deep sweeps (--since <ref>, --list)
npx vitest run               # the whole suite but the e2e tier (CI's); *.spike.gen.test.js are excluded and gitignored
npm run test:critical        # the contracts only (MCP surface, pins, guards, db, scripts), no geometry-heavy suites
npm run test:deep:changed    # the *.deep.test.js sweeps whose imports touch an uncommitted change (none if none do)
npm run test:e2e             # whole worlds through the real handlers, games whose audit walks each level in headless Chrome
node scripts/mcp-stdio.mjs orient|tools|packs|help <tool>|call <tool> --json '{…}'   # CLI over the registry; orient = initialize for a shell
node scripts/reindex-embeddings.js   # text-only without the recall group; vectors with it
node scripts/mcp-stdio.mjs install recall   # the embedding runtime, opt-in, lands in ~/.mojulo/recall
node scripts/runnability.mjs <page.html> --cams cams.json   # what a World page asks of Chrome: docs/runnability.md
node scripts/hover.mjs <tour.json> [--out dir]   # the hover bot: teleport shots, flights sampled at a speed (docs/hover-bot.md)
node scripts/pack-page.mjs <page.html> [--parts]   # a World page gzipped, nothing cut: one file, or parts under a host's limit (docs/workshop.md)
```

No lint, formatter, or types. CI runs `node --check` and the locale validator. Always run from `control/`:
entry points `chdir` there and `getServerVersion` reads `package.json` from cwd. macOS has no `timeout`.

Test tiers: a change to prose only (root docs, `docs/`, the changelog, a README, `NOTICE`) runs no tests and needs no
`npm install` (generated pages such as the hillclimb page are code: regenerate them). Otherwise, while iterating and
before a commit, `npm run test:changed`: the tests that import the changed modules, every byte pin the change reaches
at any depth, its deep sweeps, and the critical tier for a config change (`scripts/test-changed.mjs` says how it picks;
`--list` shows the pick). Add `test:critical` for a change to the MCP surface, a pin or a guard, and `test:e2e` only
for a gameworld, city, game or structure kernel change. Do not run whole folders or the whole suite locally. The
whole suite, `test:deep` and `test:e2e` run in CI, sharded, on every PR, on pushes to `main` and the
release-candidate branches (`*-consolidated`), and on demand for any branch (the workflow's manual run): the whole suite on
Node 22, the critical tier and its byte pins on the other runtimes (22.14.0, 24, macOS). Before merging
a branch into a release candidate, merge the candidate into it, push it and open a pull request from it into the
candidate: the workflow runs on every pull request (the whole suite, the deep sweeps and the e2e tier, sharded); land it
on green by fast-forwarding the candidate (work on the next branch meanwhile). A prose-only branch needs no run. CI then runs everything again on the candidate's push, and a red there is the next fix. A module that reads files beside it is declared in
`scripts/test-changed.mjs` (a reader of code or of data); a guard test names one that is not.

Test the concept, not the catalog. Species, presets, cultures, landmarks and climates are inputs to procedures:
a test picks one case per distinct procedure (a rig topology, a family, a code path), chosen in code from the
catalog rather than a hand list, and asserts the concept (rig, motion, chirality, growth, determinism, absence
adds nothing) on it. No test iterates a whole catalog, in any tier; a new entry is covered by the procedure it
runs through. Build the smallest input that still exercises the concept (a small board, a short run, one city).
An exhaustive sweep over a word's range ends goes in a `*.deep.test.js` beside the law
tests, importing only the modules it sweeps, so `--changed` can select it. A suite that makes whole worlds or
mints with `autoAudit: true` goes on the `E2E` list in `vitest.config.js`, never in critical or `npm test` (guarded by
`lib/mcp/test-tiers.test.js`); test the audit gate itself with a stub `runTraversal`.

Byte-pin conventions: `*.char.test.js` and `*.trace.test.js` are characterization pins; `__snapshots__/`
hashes are structural on purpose. A pin change is legitimate only when the step says emission changes.

## Plans and changelog

Design happens in `*.plan.md` under `lite-template/integration/<MMDD>/` (gitignored). Skeleton: status
line, "what exists (reuse, don't design)", numbered phases, Gates split machine/eyes, out of scope, open
questions, a Log appended as built. Write the plan and its theme file (`control/changelog/<MMYY>/<MMDD>/<theme>.md`,
one per theme, named for the plan, its first line `### <title>`) before the code. A leftover "remaining" section is a recorded stopping point, not a backlog.
On merge the plan moves to `plan-archive/`. Nothing tracked may cite a plan path.

## Release

Control plane: `node scripts/changelog.mjs --release X.Y.Z` (writes `## [X.Y.Z] - YYYY-MM-DD` with everything
unreleased in it and deletes the theme files), run `npm run smoke:tarball` (packs, installs
the tarball into an empty temp dir, boots the dashboard; the npx cache reuses old trees and hides
fresh-install breakage), commit, tag `vX.Y.Z`, push the tag; the workflow slices that section. The Claude plugin
installs only what its lockfile names, and the lockfile needs the published tarball's hash: `npm publish` before the
tag, then `node control/scripts/plugin-lock.mjs` and commit its two files, since the tag's version check refuses a
lockfile for another version.

## Data and native landmines

- Two path resolvers. Bins use `~/.mojulo` via `scripts/mojulo-paths.mjs`; `next dev` uses `control/.env`
  (`SQLITE_PATH=./data/…`). Repo-dev exports `MOJULO_DATA_DIR="$(pwd)/data"
  MOJULO_OUTCOMES_DIR="$(pwd)/data/outcomes"` before any script. Quote them. `middleware.js` runs on the Node
  runtime (since 3.0.0) so `lib/auth/delegate-session.js` can check a delegate's session; it carries its own
  copy of the `SQLITE_PATH` fallback, pinned by its test.
- Schema and migrations are hand-written, idempotent, and ordered in `control/lib/db/index.js`. No version
  ledger. `getDb()` has side effects (backfill, daemons).
- `better-sqlite3` compiles per arch; new native server deps go in `next.config.mjs` `serverExternalPackages`.
  No `postinstall` model download. The embedding runtime is not a dependency at all: `mojulo install
  recall` installs it under `~/.mojulo/recall/` and runs `fetch-embed-model.js`; `semantic_search` is
  FTS5-lexical without it. Never add `@huggingface/transformers` or `onnxruntime-node` back to `dependencies`.

## Architecture map

Pointers only; each target carries its own design notes.

- MCP: [server.js](control/lib/mcp/server.js), [tools/](control/lib/mcp/tools/), [packs.js](control/lib/mcp/packs.js).
  Claude plugin profile (`MOJULO_DISTRIBUTION=claude-plugin`): [plugin-profile.js](control/lib/mcp/plugin-profile.js)
  and [plugin-profile-cards.js](control/lib/mcp/plugin-profile-cards.js) hide the AI-generator handoffs, the
  keyed prompt door, automatic downloads and CDN pages; npm and source builds must stay byte-identical.
- Recipe dispatch: [sketch-manifest.js](control/lib/graph/sketch/sketch-manifest.js) (render mode + bucket),
  [world-scene.js](control/lib/graph/worlds/world-scene.js) (world resolution and opt-in channels),
  [world-kinds.js](control/lib/graph/worlds/world-kinds.js) (the registry).
- Emitters: [control/lib/graph/scene/](control/lib/graph/scene/); native frame is z-up, 1 unit = 1 m
  ([engine-score.js](control/lib/graph/scene/engine-score.js)); each emitter owns its conversion.
  The engine handoff (`export_model { engine }`): `handoff.js` and an adapter per engine, Godot's in `handoff-godot.js`
  (a project of a world's or a game's levels), Blender's in `handoff-blender.js` (the same, built into a .blend; the art
  pack, `format: 'blender'`, stays `blender-pack.js`); Unreal's in `handoff-unreal.js` (the same, a UE5 project its
  Python importer builds; one thing by its ref stays the asset pack, `unreal-pack.js`); Unity's in `handoff-unity.js`
  (the same, a Unity 6 URP project its C# importer builds in batchmode); the registry in
  `scene/engines/`. The visual gate (`scene/visual-gate.js`, `scripts/visual-gate.mjs`) renders a level's cameras on the
  page and in each engine installed and scores each shot. Gates are advisory and need `MOJULO_GODOT` / `MOJULO_BLENDER` /
  `MOJULO_UNREAL` / `MOJULO_UNITY`; CI's `godot` job runs Godot's legs (the handoff, a humanoid's import, the visual
  gate's) on a pinned Godot; the others run locally. No engine runs a game: the game runtimes (Godot's, Roblox's,
  Unity's) are retired, and the web build is the game.
- The realistic hero body (`form: 'realistic'`, the form field's slice): [docs/realistic-body.md](docs/realistic-body.md).
  Its garments: the construction in [body-relational-tailor.js](control/lib/graph/polygonizer/body-relational-tailor.js), the
  principles a silhouette is read by in [docs/garment-principles.md](docs/garment-principles.md); skill: `/garment-design`.
  Played as an engine gets it (the skinned GLB, its clips and face morphs, variants bare and armoured): `/hero-live`.
- The anime face's principles (the brow never covers the eye, no line where the form carries it, drawings snap):
  [docs/anime-face-principles.md](docs/anime-face-principles.md); its head casts (Shonen High the default; siblings by figure and theme, never by game type): `anime-styles.js`; its
  bodies (codenames, each a simplified form and a muscular form over the same base): `anime-bodies.js`, the muscles in
  `musculature/`; the socket each brow drawing carries: `anime-sockets.js`.
- What it wears: the wearable libraries [footwear/](control/lib/graph/footwear/), [handwear/](control/lib/graph/handwear/) and
  [plating/](control/lib/graph/plating/) (card → passes → laws → adapter; a new look is a card): [docs/plating.md](docs/plating.md).
  On the head, [headgear/](control/lib/graph/headgear/): the cards (masks, cowls, eyegear, helmets, circlets and hats) worn by the hero door's
  `headgear` word, and the helmets by tradition an outfit's `language.head` wears; a new look is a card.
- Arms: [equipment/arms/](control/lib/graph/equipment/arms/) (modern and future guns and knives for the gen-7 look: a
  model row and its builder → tunable parts → a finish card, held to the laws in `laws.js`; a new look is a finish card,
  a new archetype a model row). Manual: the `equipment` solid-vocab card; review: `scripts/render-arms.mjs`. In a
  shooter's hands a gun is its parts' boxes unless its slot asks for the arm itself (`gameworld/arms-kit.js` `armDetailed`;
  the mission and the firing range ask).
- Solids: [polygonizer/](control/lib/graph/polygonizer/) (`field-terms.js`, `code-realm.js`,
  `field-exact.js` for `exact: true` through Manifold), [worlds/workbench.js](control/lib/graph/worlds/workbench.js);
  manuals are the `solid-vocab/` cards. OpenSCAD both ways: [scad/scad-render.js](control/lib/graph/scad/scad-render.js)
  (the `scad` kind, OpenSCAD-in-WASM) and [scene/scene-scad.js](control/lib/graph/scene/scene-scad.js) (the transpiler).
- Recipe book: [views/recipe-book/](control/lib/graph/views/recipe-book/). Vocab cards: `*-vocab/` dirs.
- Retail: [retail/](control/lib/graph/retail/) (concept cards → the `store` / `mall` kinds; a new store is a card, not code).
- Historic cultures: [historic/](control/lib/graph/historic/) (a real place at its period → the `historic` kind and its
  encyclopedia entry); adding or deepening one: [docs/historic/README.md](docs/historic/README.md), `/historic-culture`.
- Room furniture: [furnishings/roster.js](control/lib/graph/furnishings/roster.js) names every piece (one row, the
  words people say, its handles into the floorplan, preset, net and room-asset tables); a new piece is a row first.
- Vehicles: [vehicle-registry/roster.js](control/lib/graph/vehicle-registry/roster.js) names every vehicle (one row, the
  words people say, its handles into the tables that build it); the old tables are frozen behind it, every door reads a
  vehicle word through it, and a new vehicle is a row first. The shelves that build them (road, the car shelf's
  personal cars, the mecha shelf's legged frames, the craft shelf's aircraft and boats, the rail shelf), file by file:
  [docs/vehicles.md](docs/vehicles.md).
- A track's design language: [roads/track-language.js](control/lib/graph/roads/track-language.js) (one card says what a raced
  track is made of and how its parts are shaped: way, kerb, rail, flags, trees, sky; a kart track's chunky drawing,
  `roads/chunky-look.js`; a street circuit's town, `roads/street-frontage.js`; a mine's galleries under a hill, lit as
  a cave, `roads/mine.js`; a new map is a card), the principles a card is written by:
  [docs/track-design-principles.md](docs/track-design-principles.md).
- Airports: [airport/](control/lib/graph/airport/) (the transport hub's grammar laid at an airport's real figures, `plan.js`:
  piers, nose-in stands sized to the craft shelf's liners and their jet bridges, the taxiway and runway at their
  separations, the tower and hangar, each concourse a wing; drawn whole as a miniature on a plinth, `miniature.js`, or one
  wing at full scale, `wing.js`: its piers, its apron's marks, its stands' aircraft, crews and jet bridges, `jet-bridge.js`;
  the `/world` kind `airport`, minted by the transport hub's `mode: 'airport', show: 'miniature' | 'wing'`).
- Books: [book/](control/lib/graph/book/) (the press: a style library of looks, formats and faces from the font shelf,
  one self-contained page a book, printed to PDF by headless Chromium; its drawn plates, `book/drawn-plate.js`: field-term
  forms seen from a two-point station under one light, toned in curves as a wash, an engraving or a woodcut):
  [docs/books.md](docs/books.md).
- Publications: [publication/](control/lib/graph/publication/) (a grimoire, a bestiary, a manual, a notebook, a comic as
  one recipe of data, its front a cover, `cover.js`, read as the press's printed book, as an open book turned a spread at a time, `reader.js`, and in a level as
  `play.library`, a shelf opened with L, `playscape/ui/library.js`; plates from the prop shelf, `props.js`, a new prop a
  row; the lorecube's manual and tree published by `from-lore.js`): [docs/publications.md](docs/publications.md).
- Table RPG: [table-rpg/](control/lib/graph/table-rpg/) (a pen-and-paper module played in text: rules as procedures, a
  generic starter each and no published game, portable words, the kernel a page emits; composed with the egocube, the
  live RPG, programs and the epoch map; its game book on the press; minted by `create_game({ table_rpg })`, engine
  `table-rpg`): [docs/table-rpg.md](docs/table-rpg.md); play it with `node scripts/table-rpg.mjs`. "Tabletop" is the
  board-game type.
- Fractal structures: [fractal-structure/](control/lib/graph/fractal-structure/) (towers from a plan, a rise, a crown and
  an echo, the `structures` world channel any kind takes; manual: the `structures` view-vocab card).
- Vegetation: [vegetation/](control/lib/graph/vegetation/) (grown trees, palms, bamboo; pooled like `rock-pool.js`);
  read [docs/vegetation.md](docs/vegetation.md) before changing a preset or a level of detail.
- The game book's chapters: [gameworld/chapters.js](control/lib/graph/gameworld/chapters.js) (each page a chapter in one of
  the departments: the recipe paths, review parts, run steps and cards it owns, and the chapters it reads; a new one
  that joins no chapter fails `chapters.test.js`). `design_game`'s readout says them (`chapters`); `{ ref, chapter }`
  is one chapter's view ([gameworld/chapter-view.js](control/lib/graph/gameworld/chapter-view.js)), a department's; the
  studio card (`gameworld-studio`, generated from the registry) teaches the agent to work them in waves.
- A game's flow (what plays when, from the first screen to the credits: screens, cinematics, levels, holds), the game
  director's page, the main agent's own: [game/flow.js](control/lib/graph/game/flow.js) (the shape, the reader, the
  default, the kernel the play shell's flow runner inlines) and [gameworld/game-flow.js](control/lib/graph/gameworld/game-flow.js)
  (a world's flow, the story's opening, prologue and ending placed in it, the storyboard): [docs/game-flow.md](docs/game-flow.md).
- Game UI runtime (internal name mana-ui): [control/lib/mana-ui/](control/lib/mana-ui/) (the one runtime playscape's UI
  words run on, so a screen is built once and not game by game: components with props passed down, the game's state
  read through bindings and never copied, a form that is a tree of data, a function that is cue effects; greybox first,
  styles a layer over it, `theme.js`, a world's guide reaching it through `playscape/ui/mana-theme.js`; a new look is a theme card in `playscape/ui/theme-cards/`, a game's `ui` dressed by the interface chapter in `playscape/ui/interface-look.js`; the shared screens and HUD parts as compositions in `idioms-*.js`, all drawn live by the
  wireframe board, `board.js`; imports nothing outside its folder; a view that reads no device: the controls layer drives
  it, `controls/mana-host.js`): [docs/mana-ui.md](docs/mana-ui.md). Its surfaces: a designed game's title, set-up picks, pause, result, HUD and touch pad (`game/play-shell-mana.js`, `game/hud-mana.js`), the tabletop and board pages, and the RPG's battles, party menu and
  shops, a spec in `playscape/rpg/rpg-ui.js` hosted by the page's RPG channel.
- Combat: [gameworld/combat/](control/lib/graph/gameworld/combat/) (a made game's player and foe measured on its runtime:
  movement against its feel's card, each gun's rounds to drop the foe, cone, climb, marks by matter, switching; the gym
  laid from those numbers; the combat book, `/bible?book=combat`; the firing range, `range.js`: a game being designed,
  its weapons by fire type and numbers, skins optional, measured and played before there are levels; the turret's mounts
  by class and their measures, `mount.js`, the runtime's turret `worlds/controllable/turret.js`: one gun on a mount,
  aimed by hand on any base; its rounds `ordnance.js`, what they do to matter `terminal.js`, the artillery range
  `artillery.js`, the mecha shelf's frames as its bases `frames.js`, the craft shelf's fighters `aircraft.js` and its
  helicopters and drones `rotorcraft.js` (on the runtime's `worlds/controllable/rules-hover.js`), its boats `boats.js` (on
  `worlds/controllable/rules-boat.js`, their water `scene/channels/controllable/boat-water.js`), its motorcycles
  `roadsters.js` (its cars through `artillery.js` `vehicleBase`), its page's view
  `scene/channels/controllable/turret-view.js`); the tester's spike, its findings and the grown arena are
  `control/scripts/spikes/combat-tester/`.
- Game feel: [gameworld/feel/](control/lib/graph/gameworld/feel/) (the action lab's cards and templates, a gameworld's
  `feel` lowered onto the hero's platform rule, its suggestions, the feel book); the lab and its gate are
  `control/scripts/spikes/action-lab/` (`verify.mjs` holds the lowered rule to the lab's numbers). How a hero swings a
  blade (an arsenal's `art`: `SWORD_ARTS` in `polygonizer/hero-swing-body.js`): [docs/sword-arts.md](docs/sword-arts.md). A game's play
  tried before its levels (the action and platform rooms, the mount lane, the firing and artillery ranges, the roll room, the work room and the game room, chosen by how
  it plays): [gameworld/practice.js](control/lib/graph/gameworld/practice.js), [docs/practice-rooms.md](docs/practice-rooms.md).
- Missions (a shooter's first level): [mission/](control/lib/graph/mission/) (the firing range stretched into sections,
  each a band the world's guns are for with a task in it: the section table, the brief read from the guns, the seeded
  composition, the laws; a new section is a row) and [gameworld/mission-level.js](control/lib/graph/gameworld/mission-level.js)
  (the level: `levels.<id>.mission`, a quick shooter's `mission`, the practice door's `mission` room; its tasks the
  `objectives` mechanic, `game/objectives.js`; its briefing, HUD, pause and debrief on mana-ui through the page's mission
  channel, `gameworld/mission-mana.js`; proved on the bus and played headless, `gameworld/mission-proof.js`):
  [docs/missions.md](docs/missions.md). Arena maps (a fighting map as blocks on a grid, the principles of line-of-sight
  combat as laws, a generator that grows a template under them; laid as a mission's ground, `mission.map`, by `ground.js` and
  `phases.js`; a building's `fight` dials are the geocube's answer to the same laws; a town's or a city's cut read as a map, `read-town.js`; an industrial yard found under the laws, `facility.js`; a mission laid on a place the geocube builds, read off its colliders, `read-colliders.js`, `gameworld/mission-site.js`; an industrial level, a yard designed piece by piece under the laws and built by the geocube, `yard.js`, `gameworld/mission-industrial.js`):
  [arena-map/](control/lib/graph/arena-map/), [docs/arena-maps.md](docs/arena-maps.md). The damage ring (where a hit came from, round the aim) is its own concept,
  `gameworld/damage-ring.js`: a mission draws it on mana-ui, a quick shooter's level and a deathmatch through the page's
  damage ring channel.
- The game producer: [gameworld/rails.js](control/lib/graph/gameworld/rails.js) (a new game type is a row first),
  [gameworld/pitch-start.js](control/lib/graph/gameworld/pitch-start.js), [gameworld/hand-off.js](control/lib/graph/gameworld/hand-off.js).
- The exhibit producer: [exhibit/producer.js](control/lib/graph/exhibit/producer.js) (`create_exhibit({ start })`),
  [exhibit/scales.js](control/lib/graph/exhibit/scales.js), [exhibit/fit.js](control/lib/graph/exhibit/fit.js),
  [exhibit/intake.js](control/lib/graph/exhibit/intake.js); the steps are the `exhibit-producer` routing card's.
- The platformer's rail (a mascot platformer from its feel to a first level and the flow that plays it, in two
  dimensions: `2d` the side-scroller, one strip and one turn, its home the title; `3d` opt-in, courses up a hill, a
  turn each, its home the courses screen; both on one flow shape, a start menu, a screen on its side, the
  `hilltop` theme card and the `sherbet-orchard` geocube; offered by `design_game` as `next: first-level`, never laid): [gameworld/platformer-game.js](control/lib/graph/gameworld/platformer-game.js) over
  [gameworld/first-level.js](control/lib/graph/gameworld/first-level.js); manual: the `gameworld-course` card. A course in
  the round is skinned by [gameworld/course-skin.js](control/lib/graph/gameworld/course-skin.js) (floors the land's turf,
  dirt and rock; stairs and walls a geocube's stone and trim, the cube read from the level, the world or the kit). The
  land behind a side strip's lane is dressed by [docs/side-strip-principles.md](docs/side-strip-principles.md).
- Title cards: [game/title-carve.js](control/lib/graph/game/title-carve.js) (a HUD banner `as: 'title'`: its words carved
  by [motion/glyph-carver.js](control/lib/motion/glyph-carver.js) into the glyph atlas the page plays, slam | rise | stamp,
  in the juice register's look; words by key in the world's `locale` from `control/messages/`: `game/title-words.js`);
  manual: the `hud-title` card. A host that cannot carve shows the banner.
- One room for a game (the game room): [gameroom/](control/lib/graph/gameroom/) (room primitives, the brief read from the
  world, a seeded composition, the room laws, the dress by trade), played as the practice door's `room`
  (`gameworld/game-room.js`) and dressing the work room:
  [docs/game-room.md](docs/game-room.md).
- Walled-core dungeons: [docs/walled-core-dungeon.md](docs/walled-core-dungeon.md) (layers on a critical path toward a
  core, a `design_game` world's `wcd`; its principles as laws; a space builds its level; a military base's buildings,
  stocked by `era/stocking.js`).
- Room craft: [era/room-craft.js](control/lib/graph/era/room-craft.js) (the craft laws of `era/laws.js` as the questions a room is
  asked, each with its reason and how different places answer it; a new interior answers the questions, never copies
  another kit's things; `readRoomCraft` says which a kit's card answers; the agent's card: `room-craft`).
- Networks of passages: [network/](control/lib/graph/network/) (buildings or rooms joined by passages: `sections.js`, what
  a passage is, a new kind a row; `edges.js`, which nodes join and by what path, straight or a dog-leg; `passage.js`, one
  built to its section along its path, at its cover, level through its turns; `laws.js`; `walk-gate.js`, a payload walked
  as the page walks it). Its clients: the geocity's `under` (podiums and their concourses: `geocity/podium.js`) and a
  stage's `complex` (buildings with basements on one yard, `complex.js`; a WCD level's spaces; a campus by its name,
  `campuses.js`, a new campus a row).
- Hijack City (the open city's crime game, a starter for a GTA-like: the `hijack-city` rail and its starter,
  [gameworld/hijack-city.js](control/lib/graph/gameworld/hijack-city.js), the `open-city-crime` genre):
  [docs/hijack-city.md](docs/hijack-city.md).
- Quest open worlds: [docs/quest-open-world.md](docs/quest-open-world.md) (the WCD's opposite pole: a geocity's regions
  joined sideways, never gated on the way on; a `design_game` world's `qow`; its principles as laws). The metro it is
  laid on: [geocity/](control/lib/graph/geocity/) (the geocube's `show: 'geocity'`: major streets first, rings, roads,
  evocations at game scale, the street's kit near the camera only).
- Foes: [docs/foes.md](docs/foes.md) (layer 0, the skeleton under every foe, and the shelves over it: behaviour, skin,
  modes, states, death; a new thing on a shelf is a row, never a foe special-cased). Their book is the cast sheet
  (`/bible?book=foes`, [gameworld/foe-cast-html.js](control/lib/graph/gameworld/foe-cast-html.js)), and a world with
  none is proposed a cast by the casting call ([foe-casting.js](control/lib/graph/gameworld/foe-casting.js)).
- Worker bots: [workbots/](control/lib/graph/workbots/) (a toy world's worker bots in their own low-poly language: a
  few big primitives in toy colours by role, a face of two lit eyes and a mouth; a bot is a card, stood as a rig figure
  by a figures-map `workbot`; level 0's boss Bulwark is one).
- Fight levels (Mojulo Fighter, internal name versus): a fight is laid on any level by its LANE
  ([versus/versus-lane.js](control/lib/graph/versus/versus-lane.js): where it runs, its walls, its floor, the camera's
  room); [versus/versus-levels.js](control/lib/graph/versus/versus-levels.js) turns each kind of level into a world
  recipe and its lane (a new kind of level is a row); the runtime draws in the lane's frame. Blockouts:
  [level/greybox-scene.js](control/lib/graph/level/greybox-scene.js).
- The cast rig (the one light every body is drawn under, in both eras): [color-theorist/cast-rig.js](control/lib/graph/color-theorist/cast-rig.js)
  (the key the world's solved sun, the sky over the floor's bounce, the horizon's rim, a body's own gains) and the page's
  material, [scene/channels/cast-rig.js](control/lib/graph/scene/channels/cast-rig.js) (the sky and the rim in the body's
  own shader, so they light nothing else; one key a page). Its clients: a fight's and a brawl's bodies under a register,
  the hero a player pilots on a form page, a vehicle's form body. It is light only: a body moves as its client moves it.
  [docs/hero-form-light.md](docs/hero-form-light.md).
- The animation studio (a FILM of scenes: one cast, sets, a look, an edit; a sketch of kind `film`, its page its book):
  [film/](control/lib/graph/film/) (the recipe, its departments and their waves, the readout, the book), the door
  `forge_motion`'s `film` and `subject.screenplay` ([tools/film.js](control/lib/mcp/tools/film.js),
  [tools/scene-film.js](control/lib/mcp/tools/scene-film.js): a scene's storyboard and animatic, its voice, dub and set,
  the film shot natively as a video, its Blender film pack as the high-end version; a cutscene another studio orders,
  `film/order.js`); craft in [docs/cinematics.md](docs/cinematics.md). A camera directed in words (a shoot plan's
  framing and moves, `shoot/`; a scene's camera style, `actor/camera-styles.js`) and looked at on a contact sheet:
  `/direct`.
- The game's colour: [gameworld/colour.js](control/lib/graph/gameworld/colour.js) (the bridge from a game to the colour
  theorist: its cast read as figures on its ground, `color-theorist/figures.js`, kept in their hue families; the ways it
  could be oriented, `color-theorist/directions.js`, each a patch; the colour book, `/bible?book=colour`; a new kind of
  figure, direction or genre decision is a row): [docs/colour.md](docs/colour.md).
- Destructible physics (internal name rupa; `destruction: 'physical'`, opt-in, never a default):
  [rupa/](control/lib/graph/rupa/) (matter, heat, ground) and the runtime builder
  [controllable/rupa.js](control/lib/graph/worlds/controllable/rupa.js): [docs/rupa.md](docs/rupa.md).
- Effects: [playscape/elements/](control/lib/graph/playscape/elements/) (attacks, blasts, puffs, looks), raised to the style
  floor [scene/effect-style.js](control/lib/graph/scene/effect-style.js), composed per game by
  [scene/juice-style.js](control/lib/graph/scene/juice-style.js) (register anime | western × the game type's flavor; a
  gameworld's `juice`); the proving ground and its board are `control/scripts/spikes/effects/`.
- Broadcast: [broadcast/](control/lib/graph/broadcast/) (the graphics over every contest and tabletop page: the packages,
  the colour theory, metal from measured reflectance, a cue per kernel call, the director's closeup; the board games in
  their own `table` furniture by `broadcast-dom.js`; a contest's or a tabletop's `broadcast` key):
  [docs/broadcast.md](docs/broadcast.md). A new contest page feeds it or its guard test fails. It owns a sport's coverage;
  the menus around it are mana-ui's, in its look (`broadcast-mana.js`), the results read by `contest/contest-results.js`.
- Science worlds: [science-worlds/](control/lib/graph/science-worlds/) (`classical`, `microscopic`, `quantum`, `relativistic`: a demo composed from a
  law table, model examined and dress declared; a law the scale lacks is a gap from `scales.js`, never approximated; a
  picture drawn by a shader is generated from the model's numbers and held to them by `conformance.js`).
- Beats [graph/beats/](control/lib/graph/beats/), voice [graph/voice/](control/lib/graph/voice/), image
  outcomes [graph/image-outcomes/](control/lib/graph/image-outcomes/), edifice
  [architecture/edifice.js](control/lib/graph/architecture/edifice.js).
- Game audio: the play department's sound sheet (which shelf sound plays each thing the game does, `gameworld/sound-sheet.js`,
  its book `/bible?book=sound`) and the music department's audio direction and cue sheet (the score by request, on one
  identity: `gameworld/audio-direction.js`, `gameworld/cue-sheet.js`; the recipe's `sound` and `music`): [docs/game-audio.md](docs/game-audio.md).
- Game sounds: [sfx-shelf/](control/lib/graph/sfx-shelf/) (the SFX library: one row per sound under the words people
  say, voiced by style, the palettes frozen behind it; recipes, never samples: cues, held voices, and families that
  build them from dials, a variation a dial point; measured on `measure.js`'s yardstick and held to `register.js`; a new
  sound is a row first, a new variation a dial value): [docs/sfx-shelf.md](docs/sfx-shelf.md). The one opt-in exception:
  the recorded sound library ([sound-library/](control/lib/graph/sound-library/), installed per machine, never in the
  package) voices the realistic one-shots it records, each falling back to its synthesized voice:
  [docs/sound-library.md](docs/sound-library.md). Kits pick a thing's sounds by its axes (a new value is a row): a mobile
  suit's (`sfx-shelf/suit-sounds.js`: weight, drive, loadout) and magic's (`sfx-shelf/magic-sounds.js`: each element by
  phase and tier, statuses, spells, a battle's moments, the world's effects) and the animals' (`sfx-shelf/animal-sounds.js`:
  each species to a voice class by its family, order or name, each class's call, alert, hurt and death), their variants
  recorded rows heard as a `standIn` (or silent) without the library.
- Underwater: [scene/channels/sea.js](control/lib/graph/scene/channels/sea.js) (a geocube's `sea`: its land put under
  water by light alone on a gen-7 page, the air's sibling on three's fog chunk; waters and depth zones are rows, a zone
  says what the read stands on; lamps where the sun does not reach) and what grows on the bed,
  [marine/](control/lib/graph/marine/) (a biocube's `flora.marine`: primitives in one kernel the page inlines, a roster by
  depth, mixes, a lay made as an aquarium is; the `seabed` biocube and biome; a new thing is a row, a new composition a
  mix) and who lives there (`marine/fauna.js`, a biocube's `fauna.sea`: the encyclopedia's sea animals called by depth,
  room, habitat and a pyramid, searched by `searchMarine` and `scripts/marine.mjs`, swum on loops by the walkers channel): [docs/underwater.md](docs/underwater.md).
- Rendering docs: [docs/scene-css3d-lighting.md](docs/scene-css3d-lighting.md),
  [docs/raymarch-effects-layer.md](docs/raymarch-effects-layer.md), [docs/local-blender-worker.md](docs/local-blender-worker.md).
