# CLAUDE.md

Fast orientation for agents working in this repo. Rules and pointers only. If a line needs a paragraph of
caveats it belongs in `docs/` with a pointer here. Do not cite `*.plan.md` files from this file, code
comments, docs, or the changelog: plans are working documents that move to
`lite-template/integration/plan-archive/` once merged, and the whole `integration/` tree is gitignored.

## What this is

A local MCP server with a dashboard. The agent builds worlds, objects, games, audio, and publications by
conversation; each one is a tiny deterministic recipe (a `sketches` row) that regenerates on every read and
exports to Godot, Unity, Unreal, Blender, GLB, STL, 3MF, USD. Mojulo is the agent-driven upstream that feeds
those tools, never a fidelity rival and never "just an exporter." The canonical self-description is the
`get_substrate` drawer in [control/lib/mcp/tools/context.js](control/lib/mcp/tools/context.js); keep
user-facing copy consistent with it.

One package. [control/](control/) is the product (Next.js 16 on 3001, ESM, vitest); all work happens here.
The chatbot factory and its bot runtime left in 3.0.0 for their own project; the unmaintained 2.x line still carries them.

## Where truth lives

- Current state of the branch: the Unreleased section of [control/CHANGELOG.md](control/CHANGELOG.md).
  Releases before 3.0.0, and the detailed log behind 3.0.0, are in
  [control/CHANGELOG-2.x.md](control/CHANGELOG-2.x.md) (archive; add nothing new there).
  `docs/STATUS.md` is the maintainer's gitignored ledger; regenerate it from tree state, never trust it.
- Version: `package.json` says 3.0.0, the release the Unreleased section becomes (2.1.0 was released 2026-09-23; 2.2 was prepared and never released, and its work ships in 3.0.0; the plugin, `glama.json` and `server.json` pin the same version, checked by `control/scripts/check-plugin-version.mjs`; `mojulo orient` is the shell's `initialize` since 2.1.0; the exported World page is self-contained by default again since 3.0.0 (2.0.9 through 2.1 loaded three.js from the pinned CDN) — `cdn: true` for the CDN build an artifact host needs; 2.0.5 is broken on fresh installs, see `CHANGELOG-2.x.md`; the embedding runtime is the opt-in `recall` group since 2.0.7; the chatbot factory left in 3.0.0).
  Unreleased is empty at the tag; new work goes under it as `###` themes.
- Deep maps: [docs/AGENT-REFERENCE.md](docs/AGENT-REFERENCE.md) (substrate, rings, data, daemons),
  [docs/MCP-ARCHITECTURE.md](docs/MCP-ARCHITECTURE.md) (transport, sessions, deliberation),
  [docs/install-capabilities.md](docs/install-capabilities.md) (kernel + packs + install groups),
  [CONTRIBUTING.md](CONTRIBUTING.md) (recipe book vs core), [AGENTS.md](AGENTS.md) (non-Claude hosts).
- Never hardcode an enumerable count in docs (kinds, packs, tools, locales, test files). Point at the
  list that defines it; counts drift the day after they are written.
- "graph" means three things: `control/lib/graph/` is the geometry library; the contextmap is the
  `meta_*` tables in the same SQLite file; `/graph` is a static pipeline SVG.

## Golden rules

- **Recipes, not renders.** The manifest is the artifact; kernels regenerate on every read, so a kernel's
  output for given params is a compatibility promise over already-minted rows. Byte-identical re-render is
  the baseline test for any kernel change. Seeded dice only (`mulberry32`); never `Math.random`, `Date`,
  `Intl` in a builder. An absent opt-in channel must contribute zero bytes.
- **Two gates, never conflated.** Machine gate (measured, automated) and eyes gate (a human looks). Never
  claim the eyes gate passed. All gates advise and stamp; none refuse. Say which gate ran and what was seen.
  [docs/bicycles.md](docs/bicycles.md), [docs/responsibility-model.md](docs/responsibility-model.md).
- **Recipes are starters.** Iterate in place with `update_sketch` / `edit_solid`; don't re-mint.
- **Core is capability, the book is repertoire.** A new study-object kind is normally a recipe-book Door-2
  builder in [control/book/](control/book/), not a core addition. The book ships bundled (3.0.1); the
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
  Absence degrades a loop, never breaks one.
- Do not commit unless asked. Never touch `control/.next/`, `control/data/`, `.claude/worktrees/`.

## MCP tool surface (the tests that bite)

`tools/list` cannot be drawerized, so it is budgeted. The per-description ceiling and the flat payload pin
live in `tool-descriptions.test.js`; the packs payload pin lives in `packs.test.js`. If a legitimate
addition crosses a pin, re-pin it in the same commit with a comment saying why. New tool checklist: register in ring order in
`server.js`; exactly one pack home in `packs.js`; a `TOOL_INDEX` row or one `FORM_TOOLSETS` bullet in
`context.js`; a routing card (ceiling in `routing-cards/loader.js`) plus a `routing-eval.fixture.js` row if creative; the
`RING10_TOOLS` list in `context.test.js`. `forward_context` is a routing index, not a glossary; its bodies
have their own byte ceilings. Full map: [docs/AGENT-REFERENCE.md](docs/AGENT-REFERENCE.md#mcp-control-surface).

## Commands

```bash
cd control
cp .env.example .env         # first time
npm install
npm run dev                  # must stay --webpack; Turbopack melts down watching control/data/
npm run build                # --webpack too: Turbopack ignores next.config's webpack rules and fails on an absent pack or recall runtime
npx vitest run               # the whole suite; *.spike.gen.test.js are excluded and gitignored
npm run test:critical        # the contracts only (MCP surface, pins, guards, db, scripts), no geometry-heavy suites
node scripts/mcp-stdio.mjs orient|tools|packs|help <tool>|call <tool> --json '{…}'   # CLI over the registry; orient = initialize for a shell
node scripts/reindex-embeddings.js   # text-only without the recall group; vectors with it
node scripts/mcp-stdio.mjs install recall   # the embedding runtime, opt-in, lands in ~/.mojulo/recall
```

No lint, formatter, or types. CI runs `node --check` and the locale validator. Always run from `control/`:
entry points `chdir` there and `getServerVersion` reads `package.json` from cwd. macOS has no `timeout`.

Byte-pin conventions: `*.char.test.js` and `*.trace.test.js` are characterization pins; `__snapshots__/`
hashes are structural on purpose. A pin change is legitimate only when the step says emission changes.

## Plans and changelog

Design happens in `*.plan.md` under `lite-template/integration/<MMDD>/` (gitignored). Skeleton: status
line, "what exists (reuse, don't design)", numbered phases, Gates split machine/eyes, out of scope, open
questions, a Log appended as built. Write the plan and its Unreleased `###` section (one per theme, named
for the plan) before the code. A leftover "remaining" section is a recorded stopping point, not a backlog.
On merge the plan moves to `plan-archive/`. Nothing tracked may cite a plan path.

## Release

Control plane: add `## [X.Y.Z] - YYYY-MM-DD` to the changelog, run `npm run smoke:tarball` (packs, installs
the tarball into an empty temp dir, boots the dashboard; the npx cache reuses old trees and hides
fresh-install breakage), commit, tag `vX.Y.Z`, push the tag; the workflow slices that section.

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
  Engine legs: `godot-project.js`, `unity-project.js`, `unreal-project.js`, `blender-project.js`; CLIs in
  `control/scripts/export-*.mjs`; gates are advisory and need `MOJULO_GODOT` / `MOJULO_UNITY` / `MOJULO_UNREAL`.
- Solids: [polygonizer/](control/lib/graph/polygonizer/) (`field-terms.js`, `code-realm.js`,
  `field-exact.js` for `exact: true` through Manifold), [worlds/workbench.js](control/lib/graph/worlds/workbench.js);
  manuals are the `solid-vocab/` cards. OpenSCAD both ways: [scad/scad-render.js](control/lib/graph/scad/scad-render.js)
  (the `scad` kind, OpenSCAD-in-WASM) and [scene/scene-scad.js](control/lib/graph/scene/scene-scad.js) (the transpiler).
- Recipe book: [views/recipe-book/](control/lib/graph/views/recipe-book/). Vocab cards: `*-vocab/` dirs.
- Retail: [retail/](control/lib/graph/retail/) (concept cards → the `store` / `mall` kinds; a new store is a card, not code).
- Historic cultures: [historic/](control/lib/graph/historic/) (a real place at its period → the `historic` kind and its
  encyclopedia entry); adding or deepening one: [docs/historic/README.md](docs/historic/README.md), `/historic-culture`.
- Vegetation: [vegetation/](control/lib/graph/vegetation/) (grown trees, palms, bamboo; pooled like `rock-pool.js`);
  read [docs/vegetation.md](docs/vegetation.md) before changing a preset or a level of detail.
- Beats [graph/beats/](control/lib/graph/beats/), voice [graph/voice/](control/lib/graph/voice/), image
  outcomes [graph/image-outcomes/](control/lib/graph/image-outcomes/), edifice
  [architecture/edifice.js](control/lib/graph/architecture/edifice.js).
- Rendering docs: [docs/scene-css3d-lighting.md](docs/scene-css3d-lighting.md),
  [docs/raymarch-effects-layer.md](docs/raymarch-effects-layer.md), [docs/local-blender-worker.md](docs/local-blender-worker.md).
