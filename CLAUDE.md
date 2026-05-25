# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo shape

Two-package monorepo. Both must usually be understood together:

- [control/](control/) — Next.js 16 control plane (port 3001). The "factory" that compiles bots **and** the MCP server external Claude Code sessions drive.
- [lite-template/](lite-template/) — Express 5 bot runtime (port 3000). The thing that gets compiled and shipped.

The control plane stages files from [lite-template/](lite-template/) into a per-bot zip; the same source tree is also published as the GHCR image `ghcr.io/zombico/mojulo-bot:X.Y.Z` via [.github/workflows/publish-bot-image.yml](.github/workflows/publish-bot-image.yml). When you change [lite-template/](lite-template/) you typically also need to bump [BOT_IMAGE](control/.env.example) (or rely on `MOJULO_OFFLINE_BUILD=1` to bundle source instead of pulling).

The control plane is increasingly used **headlessly** — a user runs Claude Code against the control plane's MCP server ([control/lib/mcp/](control/lib/mcp/)) to design, deploy, observe, and act on the bot fleet. The Next.js UI (chat builder + wizard + `/data` pane) and the MCP tools are two faces of the same primitives. Changes that touch builder, deployer, or fleet code should be reviewed against both faces.

[ARCHITECTURE.md](ARCHITECTURE.md) is the source of truth for build-time → runtime data flow, including diagrams. Always read it before non-trivial changes that cross the control/lite-template boundary.

## Commands

### Control plane ([control/](control/))

```bash
cd control
cp .env.example .env        # first-time only
npm install
npm run dev                 # Next.js on http://localhost:3001
npm run build               # next build
npm run start               # next start -p 3001
npm run build:bot           # docker build -t mojulo/bot:latest ../lite-template (offline-mode artifacts)
node scripts/cleanup-stale-artifacts.js [--dry-run]   # GC zips whose deployment_id is gone
node scripts/reindex-embeddings.js [--verbose]        # Manual reindex of the meta_embeddings semantic-search sidecar (idempotent)
```

There is **no test runner, lint, or typecheck script** in either package. To smoke-check a JS file: `node --check <file>`. For JSX, parse with `@babel/parser` (see [.claude/settings.local.json](.claude/settings.local.json) for the exact invocation that has been pre-approved).

Path alias in control: `@/*` → `./*` (see [control/jsconfig.json](control/jsconfig.json)).

### Bot runtime ([lite-template/](lite-template/))

```bash
cd lite-template
npm install                 # postinstall fetches multilingual-e5-small q8 ONNX (~113MB) into models/
npm start                   # node server.js  (port 3000)
docker compose up           # uses the local Dockerfile; Debian slim Node 20
```

The `.onnx` weights are gitignored (>100MB). They're fetched by [scripts/fetch-embed-model.mjs](lite-template/scripts/fetch-embed-model.mjs) at `npm install` and again inside the Docker build. **Do not commit them.**

### Bot image publish

Tag a release `bot-vX.Y.Z` and push the tag — [publish-bot-image.yml](.github/workflows/publish-bot-image.yml) builds multi-arch (amd64+arm64) and pushes `ghcr.io/zombico/mojulo-bot:X.Y.Z` plus `:latest` (latest only on default branch). The control plane pins an exact tag in [control/lib/deployers/docker.js](control/lib/deployers/docker.js) — never use `:latest` from the control plane side.

### Control-plane release

Add a `## [X.Y.Z] — YYYY-MM-DD` section to [control/CHANGELOG.md](control/CHANGELOG.md), commit, then `git tag vX.Y.Z && git push origin vX.Y.Z`. [publish-release.yml](.github/workflows/publish-release.yml) fires on the tag push, slices the matching changelog section, and creates a GitHub Release with that body marked as `--latest`. The workflow fails loudly if the section is missing — don't push the tag before the changelog entry exists. `bot-v*` tags do not trigger this workflow (they don't start with `v`).

## Architecture, the parts that need multiple files to grasp

### MCP control surface

The control plane runs an MCP server at `/api/mcp` (HTTP transport + bearer auth) so any Claude Code session can drive bot design, deploy, observation, and outcome workflows from outside the UI. Protocol dispatch lives in [control/lib/mcp/server.js](control/lib/mcp/server.js); tools are registered in **rings** under [control/lib/mcp/tools/](control/lib/mcp/tools/):

- Ring 0 — [context.js](control/lib/mcp/tools/context.js): `forward_context`. The `initialize` preamble is deliberately tiny; this tool hands the connecting agent the full glossary, capability model, deploy/connect lifecycle, and tool index on demand.
- Ring 1 — [build.js](control/lib/mcp/tools/build.js): bot design tools that wrap `BuilderSession` and call into the same [tool-executors.js](control/lib/builder/tool-executors.js) the chat builder uses. Sessions are attached via [session-binding.js](control/lib/mcp/session-binding.js) keyed on `mcpSessionId`.
- Ring 2 — [jobs-tools.js](control/lib/mcp/tools/jobs-tools.js): async deploy / rebuild jobs ([jobs.js](control/lib/mcp/jobs.js)). MCP clients are short-lived, so long-running deploys are surfaced as poll-able jobs.
- Ring 3 — [operate.js](control/lib/mcp/tools/operate.js): per-bot read tools (`get_deployment`, conversation/submission readers, chain verification). All forward through [bot-proxy.js](control/lib/deployers/bot-proxy.js); none copy data into the control-plane DB.
- Ring 4 — [fleet.js](control/lib/mcp/tools/fleet.js): cross-bot rollups + the SQL Explorer (see Fleet aggregation below).
- Ring 5 — [catalysts.js](control/lib/mcp/tools/catalysts.js): `list_catalysts` / `get_catalyst` / `recommend_catalysts` (see Catalysts below).
- Ring 6 — six deliberation surfaces, all bot-independent and used together when the agent reasons about structure rather than reads content:
  - **Contextmap** — [meta-context.js](control/lib/mcp/tools/meta-context.js): `meta_context_brief` / `meta_context_commit`. Writeable, durable layer that records *why* structural decisions were made — what host adapter materialized which artifact for which bot, what locked-in constraints the operator declared, what mapping decisions specific bindings encode. Three MVP write triggers: operator KYC (optional bootstrap), `artifact_materialization` (bot-shaped catalyst flow, atomic per-materialization), and `primitive_artifact_materialization` (no-bot primitive-binding flow, sibling commit path that records the artifact → bound MCP tools audit chain). Writes happen at structural events only, never at outcome events — outcomes happen at run-rate, structural decisions at deliberation-rate, and the asymmetry is what makes the layer auditable. Adapter-delegated verification runs before each commit ([meta-context/verification.js](control/lib/mcp/meta-context/verification.js)) — claude-code/generic require existsSync, codex accepts opaque automation handles on the agent's assertion (deliberate MVP relaxation). See [docs/meta-context.md](docs/meta-context.md).
  - **Inventory** — [mcp-inventory.js](control/lib/mcp/tools/mcp-inventory.js): `meta_context_declare_inventory`. Replace-semantic current-state cache of the connecting agent's MCP environment (which servers are connected, which tools they expose, optionally with per-tool `inputSchema` + `introspectionConfidence` in richer-snapshot mode for primitive binding). Sits alongside the append-only contextmap on purpose: inventory is *present environment*, not a sealed decision, so it gets DELETE+INSERT semantics in one transaction. The entry point for using mojulo without deploying a chatbot — once inventory is declared, MCP-to-MCP workflows have something to compose against. Snapshot rides on `meta_context_brief({kind:'fleet'})` as `inventory.{servers, declaredAt, ageSeconds, toolCount}`. See [lite-template/integration/MCP_INVENTORY_PLAN.md](lite-template/integration/MCP_INVENTORY_PLAN.md).
  - **Capabilities** — [mcp-capabilities.js](control/lib/mcp/tools/mcp-capabilities.js): `record_mcp_capabilities` / `get_mcp_capabilities`. The **research facet** of a provider, sibling to inventory's introspection facet. `record_mcp_capabilities` writes a vendor knowledge body (frontmatter + prose + cited URLs) for one canonical `provider_ref` with transactional supersession preserving full history; `get_mcp_capabilities` reads the current row or walks the chain via `asOf`. Both write into provider rows on a shared identity layer (`meta_mcp_providers`) — one logical "Gmail" in mojulo regardless of which path arrived at it. Mojulo ships four seeded vendor bodies on first install (gmail, notion, linear, google_drive) honestly attributed via `source_urls[0]=mojulo://CHANGELOG#v0.5.0`; the `research-mcp-vendor` catalyst refreshes them. See [lib/mcp/seeds/mcp-capabilities/](control/lib/mcp/seeds/mcp-capabilities/) for the seed bodies and the catalyst at [lib/mcp/catalysts/research-mcp-vendor.md](control/lib/mcp/catalysts/research-mcp-vendor.md).
  - **mcp-orbit composer** — [mcp-orbit.js](control/lib/mcp/tools/mcp-orbit.js): `list_mcp_orbit_components` / `get_mcp_orbit_component` / `get_meta_catalyst` / `recommend_mcp_orbit_compositions`. Sits on top of contextmap + inventory + capabilities through a consolidated view (`CapabilitiesRepository.consolidatedView`). Decomposes the non-bot workflow space into five typed component kinds (`mcp` × `trigger` × `pattern` × `idempotency` × `render`) the agent composes under the meta-catalyst's discipline; the server provides components + constraint validation, the agent provides judgment. `source` and `destination` are **composition roles** carried per-entry in `component_refs`, not kinds — each `mcp` component declares an `affordances` map (`read` / `write` / `watch`) and plays whichever role its affordances support, so the same Gmail MCP can play source in one composition and destination in another. Five composer states per chosen provider (`research` / `seed` / `inventory_only` / `capabilities_only` / `none`) each surface as their own warning tag so the agent routes remediation directly. Every recommendation persists as a `proposed` composition row so the deliberation log itself is auditable; on materialization, `meta_context_commit` records the composition ref in an artifact-scope principle as the durable link between the artifact and the components it was built from. See [docs/mcp-orbit.md](docs/mcp-orbit.md).
  - **Primitive binding** — [mcp-primitive-binding.js](control/lib/mcp/tools/mcp-primitive-binding.js): `bind_primitives`. The **runtime-introspected composer** for MCP-to-MCP workflows. Takes a vendor-agnostic primitive (`document-store`, `structured-record-store`, `messaging-channel`, `message-thread`) + a composition role (`source` | `destination`) + a server from declared inventory + an affordance→tool bindings map, runs the deterministic generator in [mcp-orbit-components/generator.js](control/lib/mcp/mcp-orbit-components/generator.js), and persists the result in `mcp_orbit_provider_artifacts` as a session-scoped provider artifact (`prov_<id>`). The artifact's body is the primitive's role template filled with the **actual bound tool names + schemas from the operator's installed MCP** — not a curated guess. Graduates via `meta_context_commit({type:'primitive_artifact_materialization', ...})`. This is the supported path for composing MCP-to-MCP workflows from typed primitives; the vendor-shaped `recommend_mcp_orbit_compositions` flow remains as a seed-reasoning surface for first-encounter scaffolding. The four primitives live in [mcp-orbit-components/primitive/](control/lib/mcp/mcp-orbit-components/primitive/) as body + source-role template + destination-role template triples.
  - **Semantic recall** — [semantic-search.js](control/lib/mcp/tools/semantic-search.js): `semantic_search`. **Fuzzy lookup over durable mojulo state** — the recall counterpart to the five structured readers above. Backed by a single embedding sidecar table ([meta_embeddings](control/lib/db/index.js)) keyed on `(source_kind, source_ref)` and populated atomically alongside every source-row write through the split sync/async helpers in [lib/db/repositories/embeddings.js](control/lib/db/repositories/embeddings.js). Covers seven source kinds: `principle`, `mcp_tool` (declared inventory), `mcp_capability` (current row only — supersession filter is load-bearing), `orbit_component`, `orbit_composition`, `orbit_artifact`, `catalyst`. Returns ranked `{ source_kind, source_ref, score, snippet }` rows — *retrieve, don't resolve*; the agent pairs results with the structured readers to pull full bodies. Embeddings use the in-process multilingual-e5-small ONNX model (same one that powers bot-side RAG; no new dependency). First-boot backfill via `maybeBackfillEmbeddings` in [lib/db/index.js](control/lib/db/index.js); `MOJULO_SEMANTIC_INDEX_DISABLED=1` skips the auto-run, and [scripts/reindex-embeddings.js](control/scripts/reindex-embeddings.js) is the manual recovery / body-composition-change path. See [lite-template/integration/SEMANTIC_INDEX_PLAN.md](lite-template/integration/SEMANTIC_INDEX_PLAN.md).

Tool registration is lazy ([`ensureToolsRegistered`](control/lib/mcp/server.js)) and ordered — `forward_context` first, fleet between per-bot operate and catalysts, then Ring 6 in the order contextmap → inventory → capabilities → composer → primitive-binding → semantic-search so the natural reading order surfaces orientation → per-bot → fleet → outcome → deliberation (structured walks) → deliberation (fuzzy recall). When you add a tool, slot it into the right ring and update the tool index in [context.js](control/lib/mcp/tools/context.js); the agent reads that index to disambiguate, so a missing entry leaves it flying blind.

Auth is `local`-user only: there's no multi-tenant identity inside MCP — every call is scoped to the single control-plane user (see [auth/service.js](control/lib/auth/service.js)).

### Catalysts

Catalysts are curated workflow recipes shipped as markdown in [control/lib/mcp/catalysts/](control/lib/mcp/catalysts/) (e.g. [qualify-lead-to-crm.md](control/lib/mcp/catalysts/qualify-lead-to-crm.md), [appointment-to-calendar.md](control/lib/mcp/catalysts/appointment-to-calendar.md), [scan-conversations-for-signal.md](control/lib/mcp/catalysts/scan-conversations-for-signal.md)). The connecting agent pulls one via `get_catalyst`, combines it with a specific bot's shape (via Ring 3 tools) and the user's already-installed MCPs (Gmail, Drive, Calendar, CRM, ticketing, warehouse, etc.), and **synthesizes a local Claude Code skill** into the user's `.claude/skills/<name>/SKILL.md`. The catalyst is the nucleation point, not the artifact — it persists, the synthesized skill is what actually runs.

Frontmatter is **JSON** (not YAML) and the loader ([catalysts/loader.js](control/lib/mcp/catalysts/loader.js)) requires `id`, `name`, `summary`, and `valueHook` (one-sentence outcome framing used by `recommend_catalysts` in consultation mode). Validation faults throw — the library is curated, not user input. Authoring is repo-side only; there is no user-writable catalyst directory. Use the [/write-catalyst](.claude/skills/) skill to draft a new one. See [docs/catalysts.md](docs/catalysts.md).

### Fleet aggregation, read-only

The control plane has a `/data` pane (Explorer / Analytics / SQL Explorer tabs) and Ring 4 MCP tools that give fleet-wide visibility **without** persisting conversation content to the control-plane DB. The posture: "conversation data never leaves the bot's SQLite" extends to fleet too.

- [bot-fleet.js](control/lib/deployers/bot-fleet.js) fans out the existing per-bot proxy across all connected deployments (timeout + concurrency capped).
- Each bot computes its own rollups via local `/api/analytics/*` endpoints (SELECT/COUNT/GROUP-BY over its turns table).
- The SQL Explorer ([control/lib/fleet/scoped-sql.js](control/lib/fleet/scoped-sql.js)) assembles a **fresh in-memory SQLite** per query from rollup endpoints, validates the user's SQL (SELECT/WITH only, single statement, no ATTACH/PRAGMA/destructive verbs), runs it with row + duration caps, and discards the DB. Nothing crosses to control-plane SQLite.

We deliberately deferred the event-driven push variant (bots POSTing turns home). See [FLEET_AGGREGATION_PLAN.md](FLEET_AGGREGATION_PLAN.md) for the rationale and the conditions under which that decision flips.

### Three entry points, one config

The chat builder ([control/app/chat-builder/](control/app/chat-builder/), [control/lib/builder/](control/lib/builder/)), the wizard ([control/components/wizard/modular/](control/components/wizard/modular/)), and the MCP Ring 1 `build_*` tools all converge on [buildDeploymentConfig()](control/lib/config-builder.js), producing the **same deployment config shape**. From that point downstream — composer, embedder, deployer — there is no branch on which builder produced the config. Don't add paradigm-specific logic past `config-builder.js`.

The chat builder is Claude tool-use over SSE. Tools are defined in [control/lib/builder/tools.js](control/lib/builder/tools.js), executed in [control/lib/builder/tool-executors.js](control/lib/builder/tool-executors.js), driven from [control/app/api/builder/stream/route.js](control/app/api/builder/stream/route.js). The MCP build ring wraps the **same `BuilderSession` + executor pair** so MCP-driven design behaves identically to in-UI chat. See [docs/chat-builder.md](docs/chat-builder.md) and [docs/wizard-builder.md](docs/wizard-builder.md).

### Build pipeline (control plane → zip)

[DockerDeployer.deploy()](control/lib/deployers/docker.js) is the entrypoint. It:

1. Composes `instructions.txt` from the enabled cartridges in [control/lib/composer/protocols/](control/lib/composer/protocols/) (`00_base`, `01_knowledge`, `02_form-gathering`, `03_appointments`, `04_triage`, `05_optical-read`).
2. Copies the prebaked `embeddings.json` (built upstream by [control/app/api/vectorize-rag/route.js](control/app/api/vectorize-rag/route.js)) — knowledge chunks AND triage-route chunks share one cosine index, distinguished by `metadata.source`.
3. Writes `config/`, `docker-compose.yml`, `.env`, `.env.example`, `README.md` into a staging dir and zips it.

Two build modes — see `PREBUILT_EXCLUDES` in [control/lib/deployers/docker.js](control/lib/deployers/docker.js):

- **Prebuilt-image** (default): zip ships only config; bot pulls from GHCR.
- **Offline-build** (`MOJULO_OFFLINE_BUILD=1`): zip bundles full lite-template source + Dockerfile so `docker compose up --build` works air-gapped.

### Cloud deploy (Fly.io)

Same artifact path. [cloudDeploy()](control/lib/deployers/cloud-deploy.js) builds the zip if stale, harvests `config/*` files, decrypts the LLM key from `api_keys`, and hands off to [FlyDeployer](control/lib/deployers/fly.js). Per-bot config is injected via the Machines API `files[]` field as base64 — **the image is bot-agnostic, never rebuilt per bot**. The patterns codified at the top of `fly.js` (deterministic app name, find-or-create volume, idempotent lifecycle) are load-bearing — read those comments before changing anything in that file.

### Connect Bot proxy

Conversation data **never leaves the bot's SQLite**. The control plane stores only `url` + `last_seen_at` on the `deployments` row. Both sides already share `MOJULO_API_KEY` (written into the artifact's `.env` at build time, kept on the deployment row). [bot-proxy.js](control/lib/deployers/bot-proxy.js) (`probeBotConnection`, `fetchFromBot`) is the only path; all `/api/deployments/[id]/conversations*` and `/api/deployments/[id]/submissions*` routes in the control plane forward through it. Don't introduce a route that copies conversation rows into the control-plane DB.

### Tamper-evident chain

Every bot turn writes `content_hash` + `chain_hash` to SQLite; `/verify/:id` walks the chain. Triage handoffs extend the chain across bots via URL-carried tip-of-chain + a `sendBeacon`-posted `handoff` event row on the sender. See [docs/turn-hashing.md](docs/turn-hashing.md) and [docs/federated-routing.md](docs/federated-routing.md). Don't insert turn rows that bypass the hashing helpers.

### Vector RAG, fully in-process

[lite-template/helper/embedder-local.js](lite-template/helper/embedder-local.js) loads multilingual-e5-small q8 ONNX via `@huggingface/transformers` with `env.allowRemoteModels = false` — **the bot never makes embedding-API calls at runtime**. The query embedder runs in-process; cosine search runs over the baked `config/embeddings.json`. If `embeddings.json` is missing, RAG silently disables. See [docs/vector-rag.md](docs/vector-rag.md).

### LLM provider abstraction

[lite-template/helper/llm-client.js](lite-template/helper/llm-client.js) supports Anthropic, OpenAI, and Ollama. Anthropic uses forced tool use (`tool_choice: { type: 'tool', name: 'respond' }`) with `input_schema = ENVELOPE_SCHEMA` — schema-valid envelope is enforced at the API boundary, so the prose-to-fallback path is unreachable on that provider. OpenAI and Ollama return raw text against the composed cartridge guidance and rely on [server.js](lite-template/server.js)'s `extractJSON` + fallback synthesis when the model leans prose. The canonical envelope shape lives at [lite-template/helper/envelope-schema.js](lite-template/helper/envelope-schema.js) and is mirrored to [control/lib/envelope-schema.js](control/lib/envelope-schema.js) — when adding envelope fields, update both files and cross-check protocol cartridges in [control/lib/composer/protocols/](control/lib/composer/protocols/).

Vision input is supported on Anthropic and OpenAI; the runtime adapter check lives in [llm-client.js](lite-template/helper/llm-client.js) and the wizard/preview gates use `providerSupportsVision` from [control/lib/llm-providers.js](control/lib/llm-providers.js). Ollama rejects images at the adapter level.

**Per-model protocol gates (control plane).** Anthropic runs every protocol. On OpenAI, gpt-5 and gpt-5-mini run every protocol; gpt-4.1 is gated off `formGathering` — without wire-level enforcement, 4.1 doesn't reliably track form-field state across turns. On Ollama, llama3.3 (70B) runs everything; qwen3 and mistral-nemo are gated to `knowledge` only — the multi-step tool-following that form-gathering, appointments, triage, and optical-read need is unreliable on smaller local models. The gate is `getAllowedProtocolsForModel(provider, model)` / `isProtocolAllowedForModel(...)` in [control/lib/llm-providers.js](control/lib/llm-providers.js), enforced at three points: the wizard's [ProtocolSelection.jsx](control/components/wizard/modular/steps/ProtocolSelection.jsx) disables the cards (and [ModularWizardContext.jsx](control/components/wizard/modular/ModularWizardContext.jsx) prunes `enabledProtocols` when provider/model changes), the chat builder's `recommend_protocols` handler in [tool-executors.js](control/lib/builder/tool-executors.js) clamps its suggestions against the allowlist, and [buildDeploymentConfig](control/lib/config-builder.js) throws if a disallowed protocol slips through. New control-plane code that drives the wizard or composes a config should consult `isProtocolAllowedForModel` before enabling a protocol.

**Per-task model tiers (control plane).** `MODEL_TIERS` and `getDefaultModelForTask(provider, task)` in [control/lib/llm-providers.js](control/lib/llm-providers.js) pick the right model within a provider for the workload at hand. Three tiers: `reasoning` (chat-builder agentic loop), `structured` (form gen, identity gen, builder form-tool calls), `summary` (RAG summary, federation metadata, doc digests). Wired call sites: [stream/route.js](control/app/api/builder/stream/route.js), [generate-form/route.js](control/app/api/generate-form/route.js), [generate-rag/route.js](control/app/api/generate-rag/route.js), and per-handler in [tool-executors.js](control/lib/builder/tool-executors.js) via `getLLMConfigFromSession(session, userId, task)`. New control-plane LLM call sites should pick a tier rather than reaching for `providerConfig.defaultModel`; wizard user-overrides still win — tier resolution only fires when no explicit model is passed. See [lite-template/integration/provider_model_optimizer.md](lite-template/integration/provider_model_optimizer.md). The bot runtime stays single-model per artifact — tiers are control-plane only.

## Native dependency landmines

- **`onnxruntime-node` is glibc-only.** The Dockerfile uses `node:20-bookworm-slim`, not Alpine. Don't switch to Alpine — the prebuilt binaries crash on musl.
- **`better-sqlite3` compiles per arch.** That's why the GHCR build is multi-arch; on the host, `npm install` rebuilds against the local arch.
- **The 113MB ONNX file** is gitignored and fetched independently per package — don't try to share the scripts. [lite-template/scripts/fetch-embed-model.mjs](lite-template/scripts/fetch-embed-model.mjs) runs as the bot's `postinstall` (also during the Docker build). [control/scripts/fetch-embed-model.js](control/scripts/fetch-embed-model.js) is invoked **explicitly** — `npm run fetch-models` in the clone-and-dev path, or lazy `preloadModel()` on bin cold-start when `MOJULO_MODELS_DIR` is set (the `npx mojulo` path). The control plane intentionally has no `postinstall` so an `npx mojulo` install isn't forced to download 113MB.
- **Next.js externals.** The control plane's [next.config.mjs](control/next.config.mjs) marks `better-sqlite3`, `archiver`, `pdf2json`, `officeparser`, `@huggingface/transformers`, `onnxruntime-node`, `sharp` as `serverExternalPackages` — adding another native dep usually means adding it here too.

## Data layout

- Control plane SQLite: [control/data/mojulo-lite.db](control/data/) — tables `api_keys`, `documents`, `deployments`, `modular_sessions`, `mcp_jobs`, plus the Ring 6 stack: contextmap tables `meta_nodes` / `meta_edges` / `meta_principles` (see [docs/meta-context.md](docs/meta-context.md)); inventory cache `meta_mcp_inventory` (replace-semantic, with per-tool `input_schema_json` + `introspection_confidence` columns for richer-snapshot mode); the providers identity layer `meta_mcp_providers` + the research-facet `meta_mcp_capabilities` (transactional supersession via `superseded_by`, unique-partial index on `current` rows per provider); the mcp-orbit composer's `mcp_orbit_components` / `mcp_orbit_compositions` (typed component store + composition log); the primitive-binding `mcp_orbit_provider_artifacts` (session-scoped bound primitive artifacts with affordance manifest + bindings + body — see [docs/mcp-orbit.md](docs/mcp-orbit.md)); and the semantic-search sidecar `meta_embeddings` (one row per `(source_kind, source_ref)` across the seven indexed kinds — principles, mcp tools, capabilities, orbit components/compositions/artifacts, catalysts — with a raw `float32[384]` BLOB embedding, `content_hash` skip-on-unchanged, and a `model` column reserved for future model swaps; see [lite-template/integration/SEMANTIC_INDEX_PLAN.md](lite-template/integration/SEMANTIC_INDEX_PLAN.md)). Migration-added columns on `deployments` (`config_hash`, `last_built_hash`, `url`, `last_seen_at`, `cloud_progress`, etc — see migration block in [control/lib/db/index.js](control/lib/db/index.js)). WAL mode, foreign keys on. Repositories live in [control/lib/db/repositories/](control/lib/db/repositories/).
- Generated zips: [control/data/artifacts/](control/data/artifacts/) (cleaned by `scripts/cleanup-stale-artifacts.js`).
- Uploaded documents (originals + parsed text): [control/data/storage/](control/data/storage/).
- Bot SQLite: `data/conversation.db` inside each bot's `./data/` mount (created at first run).

## Status reminders baked into the project

- The control plane is **single-user, self-hosted**, with an **opt-in HTTP login** (see [control/middleware.js](control/middleware.js), [control/lib/auth/session.js](control/lib/auth/session.js)). Set `CONTROL_PLANE_USER` + `CONTROL_PLANE_PASSWORD` in env to enable; sessions are HMAC-signed with the password itself. The login is a last-line-of-defense affordance — don't expose the control plane to the public internet, and don't add features that assume multi-tenancy.
- Versioning is `0.x`. The bot image pin tracks **lite-template releases**, not control-plane releases — bump the [BOT_IMAGE](control/.env.example) tag in `.env.example` and the matching constant in [docker.js](control/lib/deployers/docker.js) when a new `bot-vX.Y.Z` tag ships out of `lite-template/`. The two must move together. A control-plane release with no `lite-template/` runtime changes since the last `bot-vX.Y.Z` does not need a pin bump.

## Coding Standards
- When outputting new UI, ensure strings are i18n in EN