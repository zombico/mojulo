# CLAUDE.md

Guidance for Claude Code (claude.ai/code) and other agent runtimes working in this repository. Keep this file as the fast orientation layer: commands, invariants, and pointers to deeper docs. If a detail needs a paragraph of caveats, it probably belongs in `docs/` or an integration plan, then linked here.

## First read

- [docs/BOT-ARCHITECTURE.md](docs/BOT-ARCHITECTURE.md) is the source of truth for bot factory flow: cartridge composition, vector baking, artifact layout, Fly deploy, and Connect Bot proxy.
- [docs/MCP-ARCHITECTURE.md](docs/MCP-ARCHITECTURE.md) is the source of truth for the headless control surface: transport, ring model, session binding, deliberation surfaces, catalysts, mcp-orbit, and primitive binding.
- [docs/AGENT-REFERENCE.md](docs/AGENT-REFERENCE.md) is the deeper agent-facing map for MCP rings, data layout, runtime daemons, and release notes that are too dense for this file.
- [AGENTS.md](AGENTS.md) adds Codex-specific setup for connecting to the local MCP control plane.

Read the relevant deeper doc before non-trivial work that crosses `control/` and `lite-template/`, changes deploy/build behavior, or touches the MCP tool registry.

## Repo shape

Two-package monorepo. Both usually matter:

- [control/](control/) - Next.js 16 control plane on port 3001. It is the bot factory, dashboard, and HTTP MCP server.
- [lite-template/](lite-template/) - Express 5 bot runtime on port 3000. It is the source staged into per-bot artifacts and published as the GHCR bot image.

The control plane stages files from `lite-template/` into a per-bot zip. The same runtime is published as `ghcr.io/zombico/mojulo-bot:X.Y.Z` via [.github/workflows/publish-bot-image.yml](.github/workflows/publish-bot-image.yml). When changing `lite-template/`, check whether [control/.env.example](control/.env.example)'s `BOT_IMAGE` and the matching constant in [control/lib/deployers/docker.js](control/lib/deployers/docker.js) need a bot tag bump.

The control plane is increasingly headless: the dashboard, chat builder, wizard, and MCP tools are different faces over the same primitives. Changes to builder, deployer, fleet, or app runtime code should be checked against both UI and MCP call paths.

## Golden rules

- Conversation data never moves into the control-plane DB. Per-bot conversation and submission reads must go through [control/lib/deployers/bot-proxy.js](control/lib/deployers/bot-proxy.js).
- The chat builder, modular wizard, and MCP build tools converge on [buildDeploymentConfig()](control/lib/config-builder.js). Do not add paradigm-specific branches downstream of config composition.
- Bot turn rows must go through the hashing helpers. Do not insert turns that bypass `content_hash` / `chain_hash`; see [docs/turn-hashing.md](docs/turn-hashing.md).
- The bot image is bot-agnostic. Fly deploy injects per-bot config as files; do not rebuild images per bot.
- `forward_context` is a thin routing index, not a glossary. Keep heavy orientation behind Ring 0 drawers and update `TOOL_INDEX` / `ROUTING_INDEX` when adding main-flow MCP tools.
- The control plane is single-user and self-hosted. Do not introduce multi-tenant assumptions.
- The MCP transport binds to localhost. Do not expose it publicly or add a tunnel path — the substrate has no auth layer and assumes loopback-only reachability. Remote agents reach mojulo by being run on the same host, not by the substrate reaching out to them.
- The dashboard is not a conversational surface. The operator drives mojulo from their host MCP agent (Claude Code / Codex / etc.); dashboard pages render state and offer "copy starter prompt" affordances that direct the operator to drive work from that agent. The bot builder chat is the deliberate exception (it is the bot's own chat, not a chat with the substrate). Do not add `HomeAgentChat`/`useAgentChatStream` consumers to deliberation surfaces.
- Do not read or echo `.env` secrets from generated bot/app directories. Use masking helpers or MCP tools designed for env inspection.
- UI strings should be i18n-ready in the English source messages.

## Commands

### Control plane

```bash
cd control
cp .env.example .env        # first-time only
npm install
npm run dev                 # Next.js on http://localhost:3001
npm run build               # next build
npm run start               # next start -p 3001
npm run build:bot           # docker build -t mojulo/bot:latest ../lite-template
node scripts/cleanup-stale-artifacts.js [--dry-run]
node scripts/reindex-embeddings.js [--verbose]
```

There is no repo-wide lint/typecheck script. For simple JS smoke checks, use `node --check <file>`. For JSX, parse with `@babel/parser` from the `control` package. The control path alias is `@/*` -> `./*` in [control/jsconfig.json](control/jsconfig.json).

### Bot runtime

```bash
cd lite-template
npm install                 # fetches multilingual-e5-small q8 ONNX into models/
npm start                   # node server.js on port 3000
docker compose up           # Debian slim Node 20 runtime
```

The `.onnx` weights are gitignored and larger than 100MB. They are fetched by [lite-template/scripts/fetch-embed-model.mjs](lite-template/scripts/fetch-embed-model.mjs) during bot install/build. Do not commit model weights.

## Release notes

### Bot image

Tag a bot runtime release as `bot-vX.Y.Z` and push it. The publish workflow builds multi-arch images and pushes `ghcr.io/zombico/mojulo-bot:X.Y.Z` plus `:latest` on the default branch. The control plane pins exact bot tags; never use `:latest` from control-plane deploy code.

### Control plane

Add a `## [X.Y.Z] - YYYY-MM-DD` section to [control/CHANGELOG.md](control/CHANGELOG.md), commit, then tag `vX.Y.Z`. The release workflow slices that changelog section. `bot-v*` tags do not trigger control-plane releases.

## Architecture map

- MCP server: [control/lib/mcp/server.js](control/lib/mcp/server.js), tools in [control/lib/mcp/tools/](control/lib/mcp/tools/), full model in [docs/MCP-ARCHITECTURE.md](docs/MCP-ARCHITECTURE.md).
- Bot build pipeline: [control/lib/deployers/docker.js](control/lib/deployers/docker.js), [control/lib/composer/](control/lib/composer/), [docs/BOT-ARCHITECTURE.md](docs/BOT-ARCHITECTURE.md).
- Cloud deploy: [control/lib/deployers/cloud-deploy.js](control/lib/deployers/cloud-deploy.js), [control/lib/deployers/fly.js](control/lib/deployers/fly.js). Read the top comments in `fly.js` before changing lifecycle behavior.
- Builder/wizard convergence: [control/lib/builder/](control/lib/builder/), [control/components/wizard/modular/](control/components/wizard/modular/), [docs/chat-builder.md](docs/chat-builder.md), [docs/wizard-builder.md](docs/wizard-builder.md).
- Fleet aggregation and scoped SQL: [control/lib/deployers/bot-fleet.js](control/lib/deployers/bot-fleet.js), [control/lib/fleet/scoped-sql.js](control/lib/fleet/scoped-sql.js), and [docs/AGENT-REFERENCE.md](docs/AGENT-REFERENCE.md#fleet-aggregation).
- Catalysts: [control/lib/mcp/catalysts/](control/lib/mcp/catalysts/), [docs/catalysts.md](docs/catalysts.md). Catalyst frontmatter is JSON, not YAML.
- App runtime: [control/lib/runners/](control/lib/runners/), [docs/app-runtime.md](docs/app-runtime.md).
- Vector RAG: [docs/vector-rag.md](docs/vector-rag.md), [lite-template/helper/embedder-local.js](lite-template/helper/embedder-local.js).
- Protocol and LLM behavior: [lite-template/helper/llm-client.js](lite-template/helper/llm-client.js), [control/lib/llm-providers.js](control/lib/llm-providers.js), [docs/protocol-composition.md](docs/protocol-composition.md).
- Plan mode (Ring 8): [control/lib/mcp/tools/plan-mode.js](control/lib/mcp/tools/plan-mode.js), dashboard at [control/app/plan/](control/app/plan/). Plans are the proposed speculative layer; contextmap is sealed reality. See [docs/AGENT-REFERENCE.md](docs/AGENT-REFERENCE.md#plan-and-research-modes).
- Research mode (Ring 9): [control/lib/mcp/tools/research-mode.js](control/lib/mcp/tools/research-mode.js). Accretive optional drawer upstream of plans; deliberately not woven into `forward_context`. See [docs/AGENT-REFERENCE.md](docs/AGENT-REFERENCE.md#plan-and-research-modes).

## Native dependency landmines

- `onnxruntime-node` is glibc-only. Keep the bot Dockerfile on Debian slim Node 20; do not switch it to Alpine.
- `better-sqlite3` compiles per architecture. The GHCR bot image is multi-arch for this reason.
- The control plane intentionally has no `postinstall` model download. `control/scripts/fetch-embed-model.js` is explicit/lazy so `npx mojulo` does not immediately fetch 113MB.
- When adding native server dependencies to control, check [control/next.config.mjs](control/next.config.mjs)'s `serverExternalPackages`.

## Data layout

- Control SQLite: [control/data/mojulo-lite.db](control/data/), schema and migrations in [control/lib/db/index.js](control/lib/db/index.js), repositories in [control/lib/db/repositories/](control/lib/db/repositories/).
- Generated zips: [control/data/artifacts/](control/data/artifacts/).
- Uploaded documents: [control/data/storage/](control/data/storage/).
- Bot SQLite: `data/conversation.db` inside each bot's `./data/` mount.

For table-level orientation, see [docs/AGENT-REFERENCE.md](docs/AGENT-REFERENCE.md#data-layout).
