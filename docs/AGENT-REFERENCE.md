# Agent Reference

Dense agent-facing reference for details that used to live in `CLAUDE.md`. This doc is intentionally more specific than the fast orientation file, but still points to source-of-truth docs and code for the deepest details.

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

## Ring 6 deliberation surfaces

- Contextmap: [meta-context.js](../control/lib/mcp/tools/meta-context.js), [docs/meta-context.md](meta-context.md). `meta_context_brief` / `meta_context_commit` record durable structural decisions. Structural commits land at deliberation rate; outcome-rate principles use source events such as `app_inference` and `trigger_firing`.
- Inventory: [mcp-inventory.js](../control/lib/mcp/tools/mcp-inventory.js). `meta_context_declare_inventory` is a replace-semantic cache of the connecting agent's current MCP servers and tools. It is present environment, not sealed history.
- Capabilities: [mcp-capabilities.js](../control/lib/mcp/tools/mcp-capabilities.js). `record_mcp_capabilities` / `get_mcp_capabilities` store vendor research on a shared provider identity layer. Seeded bodies live under [control/lib/mcp/seeds/](../control/lib/mcp/seeds/).
- mcp-orbit composer: [mcp-orbit.js](../control/lib/mcp/tools/mcp-orbit.js), [docs/mcp-orbit.md](mcp-orbit.md). Components are typed by kind, while `source` and `destination` are composition roles. Recommendations persist as proposed compositions for auditability.
- Primitive binding: [mcp-primitive-binding.js](../control/lib/mcp/tools/mcp-primitive-binding.js). `bind_primitives` generates provider artifacts from the operator's actual MCP inventory and schemas, not curated guesses.
- Trigger binding: [mcp-trigger-binding.js](../control/lib/mcp/tools/mcp-trigger-binding.js). `bind_trigger` persists activation artifacts. Scheduled triggers are backed by [control/lib/triggers/scheduler.js](../control/lib/triggers/scheduler.js) and gated by `MOJULO_TRIGGER_RUNTIME=enabled`.
- Semantic recall: [semantic-search.js](../control/lib/mcp/tools/semantic-search.js). `semantic_search` indexes durable mojulo state in `meta_embeddings`. Results are retrieve-not-resolve: pair hits with structured readers for full bodies. Manual recovery is [control/scripts/reindex-embeddings.js](../control/scripts/reindex-embeddings.js).

## Runtime surfaces

### App runner

Runner tools live in [runner.js](../control/lib/mcp/tools/runner.js): `install_scaffold`, `start_app`, `stop_app`, `status_app`, `list_runners`, `list_running`, `list_env`, `set_env`, and `delete_env`.

The runner is a standalone daemon (`mojulo-app-runtime`, gated by `MOJULO_APP_RUNTIME=enabled`) so app lifecycle can survive control-plane restarts. The engine lives in [control/lib/runners/engine.js](../control/lib/runners/engine.js); [control/lib/runners/local.js](../control/lib/runners/local.js) is a loopback client used by MCP tools. Env CRUD stays local filesystem work. See [docs/app-runtime.md](app-runtime.md).

### Agent-task queue

Agent-task tools live in [agent-tasks.js](../control/lib/mcp/tools/agent-tasks.js): `pull_agent_task`, `submit_envelope_inference`, and `cancel_agent_task`. The queue is in-memory FIFO single-claim in [queue.js](../control/lib/mcp/agent-tasks/queue.js). Current entry points are HTTP `/api/app-inference/envelope` and the scheduler daemon. The fulfiller stack is invariant to who parked the task; audit principles distinguish scheduler-fired and app-inference outcomes.

## Plan and research modes

Plan mode lives in [plan-mode.js](../control/lib/mcp/tools/plan-mode.js). Plans are rows in the `plans` table: proposed reality, not contextmap commits. `compile_plan` validates manifest tool calls against the live registry; `execute_plan` requires confirmation and invokes registered tools through the same handler path as remote MCP calls. When execution materializes artifacts, [plan-release.js](../control/lib/mcp/meta-context/plan-release.js) writes `plan_release` principles onto artifact histories and archives the plan.

Research mode lives in [research-mode.js](../control/lib/mcp/tools/research-mode.js). It is an optional accretive drawer upstream of plans, storing broad research items and append-only abstracts. `synthesize_abstract` can evaluate through the research-to-plan bridge in [evaluate.js](../control/lib/research/evaluate.js); a draft plan is forged only when the recommendation is `forge`. See [research-mode.md](../lite-template/integration/app-system/0528/research-mode.md).

## Bot factory and deploy path

The three build entry points - chat builder, modular wizard, and MCP build tools - converge on [buildDeploymentConfig()](../control/lib/config-builder.js). From there, composer, embedder, and deployer should be paradigm-neutral.

[DockerDeployer.deploy()](../control/lib/deployers/docker.js) composes `instructions.txt`, copies prebaked `embeddings.json`, writes `config/`, `docker-compose.yml`, `.env`, `.env.example`, and `README.md`, then zips the artifact. Build modes are prebuilt-image by default and offline-build when `MOJULO_OFFLINE_BUILD=1`.

[cloudDeploy()](../control/lib/deployers/cloud-deploy.js) builds the artifact if stale, harvests config files, decrypts the LLM key, and hands off to [FlyDeployer](../control/lib/deployers/fly.js). Fly deploy injects per-bot config as base64 files through the Machines API; the image remains bot-agnostic.

## Fleet aggregation

Fleet aggregation is read-only. The `/data` pane and Ring 4 tools provide cross-bot visibility without persisting conversation content to the control-plane DB.

- [bot-fleet.js](../control/lib/deployers/bot-fleet.js) fans out through the existing per-bot proxy with timeout/concurrency caps.
- Bots compute rollups locally through `/api/analytics/*`.
- [scoped-sql.js](../control/lib/fleet/scoped-sql.js) assembles a fresh in-memory SQLite DB per query, accepts only `SELECT` / `WITH` single statements, enforces row/duration caps, then discards the DB.

The event-driven push variant remains deferred; keep the read-only, proxy-backed posture unless a new source-of-truth design says otherwise.

## LLM and protocol behavior

[lite-template/helper/llm-client.js](../lite-template/helper/llm-client.js) supports Anthropic, OpenAI, and Ollama. Anthropic uses forced tool use with the envelope schema; OpenAI and Ollama return raw text and rely on JSON extraction plus fallback synthesis.

The canonical envelope shape is mirrored in [lite-template/helper/envelope-schema.js](../lite-template/helper/envelope-schema.js) and [control/lib/envelope-schema.js](../control/lib/envelope-schema.js). When adding fields, update both and cross-check protocol cartridges in [control/lib/composer/protocols/](../control/lib/composer/protocols/).

Vision is supported on Anthropic and OpenAI. Ollama rejects images at the adapter layer. Control-plane model protocol gates and task tiers live in [control/lib/llm-providers.js](../control/lib/llm-providers.js); new control-plane LLM call sites should pick a task tier rather than reaching directly for a provider default.

## Data layout

- Control plane SQLite: [control/data/mojulo-lite.db](../control/data/), schema/migrations in [control/lib/db/index.js](../control/lib/db/index.js). Core tables include `api_keys`, `documents`, `deployments`, `modular_sessions`, and `mcp_jobs`.
- Deliberation tables: `meta_nodes`, `meta_edges`, `meta_principles`, `meta_mcp_inventory`, `meta_mcp_providers`, `meta_mcp_capabilities`, `mcp_orbit_components`, `mcp_orbit_compositions`, `mcp_orbit_provider_artifacts`, `mcp_orbit_trigger_artifacts`, and `meta_embeddings`.
- Plan/research tables: `plans`, `research_sessions`, `research_items`, and `research_abstracts`.
- Generated zips: [control/data/artifacts/](../control/data/artifacts/).
- Uploaded documents: [control/data/storage/](../control/data/storage/).
- Bot SQLite: `data/conversation.db` inside each bot's data mount.

SQLite runs with WAL and foreign keys. Repositories live in [control/lib/db/repositories/](../control/lib/db/repositories/).
