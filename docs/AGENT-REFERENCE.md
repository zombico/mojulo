# Agent Reference

Dense agent-facing reference for details that used to live in `CLAUDE.md`. This doc is intentionally more specific than the fast orientation file, but still points to source-of-truth docs and code for the deepest details.

Mojulo is a **3D compiler for agents** (a compiler, not a generator: the recipe is the source, renders are derived): the creative substrate is the main line, and the automation backend sits behind it. The chatbot factory is an **optional install-gated pack** — its dense reference is isolated at [docs/chatbot/AGENT-REFERENCE.md](chatbot/AGENT-REFERENCE.md) and nothing here depends on it.

## The creative substrate

**One table, one row per recipe.** Every creative artifact — sketch, view, world, solid, edifice, motion, beats score, voice register, game, cook — is a row in `sketches` (`ref`, `title`, `manifest_json`). The manifest's `kind` is the dispatch key; the params beside it are the whole artifact. There is no stored render anywhere in the substrate.

**Recipes, not renders — and what that obliges.** A kernel in the control plane regenerates the artifact on *every* read, so a kernel's output for given params is a compatibility promise over already-minted rows. Seeded dice only (`mulberry32`); never `Math.random` or `Date.now` in a builder. A byte-identical re-render is the baseline test for any change to a kernel.

**Entry tools by form** — `create_sketch` (2D diagrams/charts), `create_view` (study objects; the kinds enumerated in `create-view.js` across science/math/bio), `compose_world` (generated worlds), `mint_solid` / `edit_solid` (objects, figures, vehicles, manji-trees; `kind:'scad'` stores an OpenSCAD program as the recipe), `edifice` (authored buildings), `forge_motion` / `stitch_motion` (camera shots and clips), `create_beats` (audio), `create_voice`, `create_game`, `cook` / `forge_publications`, `request_image_render` (the director layer for external painting). Recipes are **starters**: `update_sketch` iterates in place on the same ref rather than re-minting; its `patch` form edits a stored recipe by monomer `id` or JSON Pointer `path` (applier in [manifest-patch.js](../control/lib/mcp/tools/manifest-patch.js)), and `readout:'changed'` reports only the parts that moved.

**Render and export dispatch.** `sketchRenderMode` in [sketch-manifest.js](../control/lib/graph/sketch/sketch-manifest.js) routes a stored manifest kind to its render path; `WORLD_KINDS` in [world-scene.js](../control/lib/graph/worlds/world-scene.js) resolves world geometry. One geometry spec serves several emitters off a single ref — SVG ([scene-png.js](../control/lib/graph/scene/scene-png.js)), dependency-free CSS-3D ([scene-css3d.js](../control/lib/graph/scene/scene-css3d.js)), traversable WebGL ([scene-three.js](../control/lib/graph/scene/scene-three.js)), `.glb` ([scene-gltf.js](../control/lib/graph/scene/scene-gltf.js)), `.stl` ([scene-stl.js](../control/lib/graph/scene/scene-stl.js)), and a Godot project ([godot-project.js](../control/lib/graph/scene/godot-project.js)); pixelizer reducer games have no scene and take the arcade leg instead ([godot-arcade.js](../control/lib/graph/scene/godot-arcade.js), its own kernel, a replay probe as the gate). Each emitter owns its own frame and unit conversion; the shared engine-agnostic digest is [engine-score.js](../control/lib/graph/scene/engine-score.js), in z-up at 1 unit = 1 meter.

**Every handoff carries an honest ledger, and every gate is advisory.** `engine-score` emits what did *not* travel; [engine-portability.js](../control/lib/graph/scene/engine-portability.js) flags gameplay outside the shared mechanics vocabulary; STL export stamps a closure audit. None of them refuse — suitability is the operator's call ([docs/responsibility-model.md](responsibility-model.md)). Two gates, never conflated: a **machine gate** (measured, automated) and an **eyes gate** (a human looks). See [docs/bicycles.md](bicycles.md).

**Vocab cards are the discovery layer.** Each family ships markdown cards with JSON frontmatter (`id/name/family/entry/summary/when`) under `*-vocab/` directories, read by `get_view_vocab` / `get_solid_vocab` / `get_beats_vocab` / `get_motion_vocab` / `get_sketch_vocab` / `get_game_vocab` and indexed into `meta_embeddings` under matching source kinds (`view_vocab`, `solid_vocab`, `beats_vocab`, `motion_vocab`, `sketch_vocab`, `game_vocab`, plus `routing` for the routing cards). A new kind needs a **card**, not a new tool or index row.

**The kind roster is extensible without touching core.** An attached [recipe book](https://github.com/zombico/mojulo-recipe-book) (`MOJULO_RECIPE_BOOK`) contributes Door-1 recipes as pure data and Door-2 **builders** as new `create_view` kinds, dynamically imported at boot by [recipe-book/loader.js](../control/lib/graph/views/recipe-book/loader.js). Book builders import nothing — core injects `ctx.toolkit` (versioned, frozen, append-only; [toolkit.js](../control/lib/graph/views/recipe-book/toolkit.js)). The operator's own **cookbook** (`<data dir>/cookbook`, `MOJULO_COOKBOOK`) is the same format, written by `save_recipe`, Door-1 only, its own git repo with no remote. Precedence is first-wins: **core > cookbook > upstream book**. Absent both, behavior is byte-for-byte unchanged. Attachment is local-disk only; nothing is ever fetched at runtime.

**Optional local workers** are operator-hosted and never dependencies — Blender for GI bakes ([local-blender-worker.md](local-blender-worker.md)), ComfyUI for painted images ([local-image-worker.md](local-image-worker.md)), Kokoro for voice ([local-voice-worker.md](local-voice-worker.md)), a PrusaSlicer-family slicer for the print machine gate ([local-slicer-worker.md](local-slicer-worker.md)), Godot for the engine leg. The substrate holds no binaries, keys, or worker state; absence of a worker degrades the loop, never breaks it.

## Packs, wings, and install gating

Install is **pack-grain**. Each pack in [packs.js](../control/lib/mcp/packs.js) declares a `wing` (`studio` | `office` — taxonomy and routing only) and either an `installGroup` (`creative` | `chatbot`) or none. A pack declaring none is unconditional, like the kernel; the orchestration plumbing (connected services, catalysts, triggers, apps, plan/research/stash) is in that category. Install state is derived from disk, with `MOJULO_PACKS` as an explicit override. The kernel alone can still mint a diagram. See [install-capabilities.md](install-capabilities.md).

Execution is walled; knowledge is not. `mojulo tools` / `mojulo packs` list only installed packs with a `not installed: … add with: …` footer, and an uninstalled pack's tools refuse with an advisory naming the install rather than pretending not to exist.

## MCP control surface

The control plane exposes an HTTP MCP server at `/api/mcp` with bearer auth. Protocol dispatch lives in [control/lib/mcp/server.js](../control/lib/mcp/server.js); tools are registered lazily in [control/lib/mcp/tools/](../control/lib/mcp/tools/).

Tool registration order matters. `forward_context` is first, fleet sits between per-bot operate and catalysts, Ring 6 registers in the order contextmap -> inventory -> capabilities -> composer -> primitive-binding -> trigger-binding -> semantic-search, then Ring 7 runtime tools, Ring 8 plan mode, and Ring 9 research mode. When adding a main-flow MCP tool, slot it into the right ring and update `TOOL_INDEX` and, if it is an entry point, `ROUTING_INDEX` in [context.js](../control/lib/mcp/tools/context.js). Low-prominence optional drawers such as sketches and research mode deliberately stay out of the routing index.

Auth is local-user only. MCP calls are scoped to the single control-plane user through [control/lib/auth/service.js](../control/lib/auth/service.js); there is no multi-tenant identity model.

### Ring map

- Ring 0, orientation: [context.js](../control/lib/mcp/tools/context.js). `forward_context` is a lean routing index. Heavy material belongs behind drawers such as `get_register_kit`, `get_tool_index`, `get_deliberation_overview`, `get_ui_map`, and `get_substrate`.
- Ring 1, build: [build.js](../control/lib/mcp/tools/build.js). Wraps `BuilderSession` and the same [tool-executors.js](../control/lib/builder/tool-executors.js) used by the UI chat builder.
- Ring 2, jobs: [jobs-tools.js](../control/lib/mcp/tools/jobs-tools.js) and [jobs.js](../control/lib/mcp/jobs.js). Long-running deploy/rebuild work is surfaced as pollable jobs because MCP clients can be short-lived.
- Ring 3, operate: [operate.js](../control/lib/mcp/tools/operate.js). Per-bot reads forward through [bot-proxy.js](../control/lib/deployers/bot-proxy.js); they must not copy conversation data into control-plane SQLite.
- Ring 4, fleet: [fleet.js](../control/lib/mcp/tools/fleet.js). Cross-bot rollups and SQL Explorer over fresh in-memory SQLite.
- Ring 5, catalysts: [catalysts.js](../control/lib/mcp/tools/catalysts.js). Curated workflow recipes from [control/lib/mcp/catalysts/](../control/lib/mcp/catalysts/).
- Ring 6, deliberation: contextmap, inventory, capabilities, mcp-orbit composer, primitive binding, trigger binding, and semantic recall.
- Ring 7, runtime: app runner plus agent-task queue.
- Ring 8, plan mode: proposed/speculative layer for executable plans.
- Ring 9, research mode: accretive exploratory layer upstream of plans.
- Ring 10, creative mints: the studio's make-something tools. **Re-cut by FORM, not listed flat** — `get_creative_toolset` (no arg → the form map; `{ form }` → that form's tools) is the reader, and `get_tool_index` points at it rather than enumerating them. Form enum in [creative-forms.js](../control/lib/mcp/creative-forms.js).

**The rings predate the studio; read them as registration order.** Rings 1–4 are the chatbot factory's build/jobs/operate/fleet lanes and register only when that pack is installed. Ring 10 carries the whole creative substrate behind one folded reader, so ring number is a poor proxy for weight. Ring 11 ("operations view") is deprecated — surviving only as naming inside [ops-tags.js](../control/lib/db/repositories/ops-tags.js). What the connecting agent actually sees is grouped by **wing and pack** ([packs.js](../control/lib/mcp/packs.js)); `forward_context` splits on wing (`mode:'studio'` default, `mode:'office'`), not on ring.

## Ring 6 deliberation surfaces

- Contextmap: [meta-context.js](../control/lib/mcp/tools/meta-context.js), [docs/meta-context.md](meta-context.md). `meta_context_brief` / `meta_context_commit` record durable structural decisions. Structural commits land at deliberation rate; outcome-rate principles use source events such as `app_inference` and `trigger_firing`.
- Inventory: [mcp-inventory.js](../control/lib/mcp/tools/mcp-inventory.js). `meta_context_declare_inventory` is a replace-semantic cache of the connecting agent's current MCP servers and tools. It is present environment, not sealed history.
- Capabilities: [mcp-capabilities.js](../control/lib/mcp/tools/mcp-capabilities.js). `record_mcp_capabilities` / `get_mcp_capabilities` store vendor research on a shared provider identity layer. Seeded bodies live under [control/lib/mcp/seeds/](../control/lib/mcp/seeds/).
- mcp-orbit composer: [mcp-orbit.js](../control/lib/mcp/tools/mcp-orbit.js), [docs/mcp-orbit.md](mcp-orbit.md). Components are typed by kind, while `source` and `destination` are composition roles. Recommendations persist as proposed compositions for auditability.
- Primitive binding: [mcp-primitive-binding.js](../control/lib/mcp/tools/mcp-primitive-binding.js). `bind_primitives` generates provider artifacts from the operator's actual MCP inventory and schemas, not curated guesses.
- Trigger binding: [mcp-trigger-binding.js](../control/lib/mcp/tools/mcp-trigger-binding.js). `bind_trigger` persists activation artifacts. Scheduled triggers are backed by [control/lib/triggers/scheduler.js](../control/lib/triggers/scheduler.js) and gated by `MOJULO_TRIGGER_RUNTIME=enabled`.
- Semantic recall: [semantic-search.js](../control/lib/mcp/tools/semantic-search.js). `semantic_search` indexes durable mojulo state in `meta_embeddings`, lexically (FTS5 `meta_fts`) on a default install and by vector with the opt-in `recall` group (`mojulo install recall`; [lib/embedder/local.js](../control/lib/embedder/local.js)). Results are retrieve-not-resolve: pair hits with structured readers for full bodies. Manual recovery is [control/scripts/reindex-embeddings.js](../control/scripts/reindex-embeddings.js).

## Runtime surfaces

### App runner

Runner tools live in [runner.js](../control/lib/mcp/tools/runner.js): `install_scaffold`, `start_app`, `stop_app`, `status_app`, `list_runners`, `list_running`, `list_env`, `set_env`, and `delete_env`.

The runner is a standalone daemon (`mojulo-app-runtime`, gated by `MOJULO_APP_RUNTIME=enabled`) so app lifecycle can survive control-plane restarts. The engine lives in [control/lib/runners/engine.js](../control/lib/runners/engine.js); [control/lib/runners/local.js](../control/lib/runners/local.js) is a loopback client used by MCP tools. Env CRUD stays local filesystem work. See [docs/app-runtime.md](app-runtime.md).

### Agent-task queue

Agent-task tools live in [agent-tasks.js](../control/lib/mcp/tools/agent-tasks.js): `pull_agent_task`, `submit_envelope_inference`, and `cancel_agent_task`. The queue is in-memory FIFO single-claim in [queue.js](../control/lib/mcp/agent-tasks/queue.js). Current entry points are HTTP `/api/app-inference/envelope` and the scheduler daemon. The fulfiller stack is invariant to who parked the task; audit principles distinguish scheduler-fired and app-inference outcomes.

## Plan and research modes

Plan mode lives in [plan-mode.js](../control/lib/mcp/tools/plan-mode.js). Plans are rows in the `plans` table: proposed reality, not contextmap commits. `compile_plan` validates manifest tool calls against the live registry; `execute_plan` requires confirmation and invokes registered tools through the same handler path as remote MCP calls. When execution materializes artifacts, [plan-release.js](../control/lib/mcp/meta-context/plan-release.js) writes `plan_release` principles onto artifact histories and archives the plan.

Research mode lives in [research-mode.js](../control/lib/mcp/tools/research-mode.js). It is an optional accretive drawer upstream of plans, storing broad research items and append-only abstracts. `synthesize_abstract` can evaluate through the research-to-plan bridge in [evaluate.js](../control/lib/research/evaluate.js); a draft plan is forged only when the recommendation is `forge`.

## Chatbot factory (optional pack)

Install-gated since 2.0 and absent from a default install. The dense reference — build entry points and `buildDeploymentConfig()`, the Docker/Fly deploy path, fleet aggregation and scoped SQL, the bot runtime's LLM/protocol adapter, and the pack's own invariants — is isolated at **[docs/chatbot/AGENT-REFERENCE.md](chatbot/AGENT-REFERENCE.md)**, alongside the rest of the pack's docs in [docs/chatbot/](chatbot/).

Two things carry into main-line work even when you are not touching the pack:

- **Conversation data never moves into the control-plane DB.** Per-bot reads go through [bot-proxy.js](../control/lib/deployers/bot-proxy.js).
- **Nothing outside the pack may import it** — enforced by `pack-boundary.test.js` checks F/G/H, plus shrink-only ledgers over the dashboard routes and the retained code still reading bot tables.

## Data layout

- Control plane SQLite: [control/data/mojulo-lite.db](../control/data/), schema/migrations in [control/lib/db/index.js](../control/lib/db/index.js).
- **Creative tables:** `sketches` (one row per recipe — `ref`, `title`, `manifest_json`) and `sketch_folders`; `beats_revisions` / `beats_annotations`; `image_render_requests` (the durable render handoff). Domain layers ride on `sketches` rather than forking it — that is deliberate.
- **The cookbook is not a table.** Kept recipes are plain `card.md` + `recipe.json` folders under `<data dir>/cookbook`, a local git repo with no remote.
- Deliberation tables: `meta_nodes`, `meta_edges`, `meta_principles`, `meta_mcp_inventory`, `meta_mcp_providers`, `meta_mcp_capabilities`, `mcp_orbit_components`, `mcp_orbit_compositions`, `mcp_orbit_provider_artifacts`, `mcp_orbit_trigger_artifacts`, and `meta_embeddings`.
- Plan/research tables: `plans`, `research_sessions`, `research_items`, and `research_abstracts`.
- Derived outcomes (painted PNGs, baked meshes, render sidecars): `MOJULO_OUTCOMES_DIR`, default `<data dir>/outcomes`.
- Chatbot-pack storage (generated zips, uploaded documents, per-bot SQLite): see [docs/chatbot/AGENT-REFERENCE.md](chatbot/AGENT-REFERENCE.md#data-layout-bot-side).

SQLite runs with WAL and foreign keys. Repositories live in [control/lib/db/repositories/](../control/lib/db/repositories/).
