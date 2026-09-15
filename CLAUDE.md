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

Two packages. [control/](control/) is the product (Next.js 16 on 3001, ESM, vitest); almost all work happens
here. [lite-template/](lite-template/) is the runtime for the opt-in chatbot pack; read
[docs/chatbot/](docs/chatbot/) only when the work is bot-factory work.

## Where truth lives

- Current state of the branch: the Unreleased section of [control/CHANGELOG.md](control/CHANGELOG.md).
  `docs/STATUS.md` is the maintainer's gitignored ledger; regenerate it from tree state, never trust it.
- Version: `package.json` says 2.0.3 (released 2026-09-15; the chatbot pack is opt-in since 2.0.0).
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
  builder, not a core addition.
- **Single operator, loopback only.** No user identity by default; the roles pack is operator-owned
  delegation, not multi-tenancy. Do not add tenant isolation, tunnels, or public exposure. The MCP route is
  bearer-gated and 404s without a key; that is the whole auth surface, by design.
- **The dashboard is not a conversational surface.** The operator drives from their host agent. Do not add
  `HomeAgentChat` / `useAgentChatStream` consumers to deliberation surfaces (the bot builder chat is the
  one exception).
- **Suitability is the operator's.** Do not add intent classification, use-case gating, or content-policy
  layers over what the operator's LLM provider already enforces. Posture: [TERMS.md](TERMS.md).
- Never read or echo `.env` secrets from generated app or bot directories.
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
npx vitest run               # the whole suite; *.spike.gen.test.js are excluded and gitignored
node scripts/mcp-stdio.mjs tools|packs|help <tool>|call <tool> --json '{…}'   # CLI over the registry
node scripts/reindex-embeddings.js
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

Control plane: add `## [X.Y.Z] - YYYY-MM-DD` to the changelog, commit, tag `vX.Y.Z`; the workflow slices
that section. Bot image: tag `bot-vX.Y.Z`; control pins exact bot tags, never `:latest`. `bot-v*` tags do
not release the control plane.

## Data and native landmines

- Two path resolvers. Bins use `~/.mojulo` via `scripts/mojulo-paths.mjs`; `next dev` uses `control/.env`
  (`SQLITE_PATH=./data/…`). Repo-dev exports `MOJULO_DATA_DIR="$(pwd)/data"
  MOJULO_OUTCOMES_DIR="$(pwd)/data/outcomes"` before any script. Quote them.
- Schema and migrations are hand-written, idempotent, and ordered in `control/lib/db/index.js`. No version
  ledger. `getDb()` has side effects (backfill, daemons).
- `better-sqlite3` compiles per arch; new native server deps go in `next.config.mjs` `serverExternalPackages`.
  No `postinstall` model download; `fetch-embed-model.js` is explicit so `npx mojulo` stays fast.
- Chatbot pack: Debian slim Node 20, never Alpine (`onnxruntime-node` is glibc-only).

## Architecture map

Pointers only; each target carries its own design notes.

- MCP: [server.js](control/lib/mcp/server.js), [tools/](control/lib/mcp/tools/), [packs.js](control/lib/mcp/packs.js).
- Recipe dispatch: [sketch-manifest.js](control/lib/graph/sketch/sketch-manifest.js) (render mode + bucket),
  [world-scene.js](control/lib/graph/worlds/world-scene.js) (world resolution and opt-in channels),
  [world-kinds.js](control/lib/graph/worlds/world-kinds.js) (the registry).
- Emitters: [control/lib/graph/scene/](control/lib/graph/scene/); native frame is z-up, 1 unit = 1 m
  ([engine-score.js](control/lib/graph/scene/engine-score.js)); each emitter owns its conversion.
  Engine legs: `godot-project.js`, `unity-project.js`, `unreal-project.js`, `blender-project.js`; CLIs in
  `control/scripts/export-*.mjs`; gates are advisory and need `MOJULO_GODOT` / `MOJULO_UNITY` / `MOJULO_UNREAL`.
- Solids: [polygonizer/](control/lib/graph/polygonizer/) (`field-terms.js`, `code-realm.js`),
  [worlds/workbench.js](control/lib/graph/worlds/workbench.js); manuals are the `solid-vocab/` cards.
- Recipe book: [views/recipe-book/](control/lib/graph/views/recipe-book/). Vocab cards: `*-vocab/` dirs.
- Beats [graph/beats/](control/lib/graph/beats/), voice [graph/voice/](control/lib/graph/voice/), image
  outcomes [graph/image-outcomes/](control/lib/graph/image-outcomes/), edifice
  [architecture/edifice.js](control/lib/graph/architecture/edifice.js).
- Rendering docs: [docs/scene-css3d-lighting.md](docs/scene-css3d-lighting.md),
  [docs/raymarch-effects-layer.md](docs/raymarch-effects-layer.md), [docs/local-blender-worker.md](docs/local-blender-worker.md).
- Chatbot pack rules and map: [docs/chatbot/AGENT-REFERENCE.md](docs/chatbot/AGENT-REFERENCE.md).
