# Agent Reference — the chatbot pack

Dense agent-facing reference for the **optional** chatbot factory. Moved out of the main-line [docs/AGENT-REFERENCE.md](../AGENT-REFERENCE.md) so the default agent-facing map describes the 3D factory without carrying bot internals it will never need.

**Read this only when the work IS bot-factory work.** The factory is install-gated since 2.0 (`mojulo install chatbot`); on a default install its packs are not registered and its tools do not list. Nothing in the main line depends on anything documented here — that direction is enforced by `pack-boundary.test.js` checks F/G/H.

Start at [README.md](README.md) for the pack overview and [BOT-ARCHITECTURE.md](BOT-ARCHITECTURE.md) for the factory flow.

## Pack membership

Three packs, all `wing: 'office'`, all `installGroup: 'chatbot'`, declared in [control/lib/mcp/packs.js](../../control/lib/mcp/packs.js):

- `pack_bot_build` — builder session, identity/protocol composition, typed config generators, documents/RAG, save & deploy, build-job polling.
- `pack_bot_operate` — reads and lifecycle for an already-deployed bot.
- `pack_fleet` — cross-bot rollups and the SQL Explorer.

Every other pack declares either `installGroup: 'creative'` or none. A pack declaring none is unconditional, like the kernel.

## Bot factory and deploy path

The three build entry points — chat builder, modular wizard, and MCP build tools — converge on [buildDeploymentConfig()](../../control/lib/config-builder.js). From there, composer, embedder, and deployer should be paradigm-neutral.

[DockerDeployer.deploy()](../../control/lib/deployers/docker.js) composes `instructions.txt`, copies prebaked `embeddings.json`, writes `config/`, `docker-compose.yml`, `.env`, `.env.example`, and `README.md`, then zips the artifact. Build modes are prebuilt-image by default and offline-build when `MOJULO_OFFLINE_BUILD=1`.

[cloudDeploy()](../../control/lib/deployers/cloud-deploy.js) builds the artifact if stale, harvests config files, decrypts the LLM key, and hands off to [FlyDeployer](../../control/lib/deployers/fly.js). Fly deploy injects per-bot config as base64 files through the Machines API; the image remains bot-agnostic.

## Fleet aggregation

Fleet aggregation is read-only. The `/data` pane and the fleet pack's tools provide cross-bot visibility without persisting conversation content to the control-plane DB.

- [bot-fleet.js](../../control/lib/deployers/bot-fleet.js) fans out through the existing per-bot proxy with timeout/concurrency caps.
- Bots compute rollups locally through `/api/analytics/*`.
- [scoped-sql.js](../../control/lib/fleet/scoped-sql.js) assembles a fresh in-memory SQLite DB per query, accepts only `SELECT` / `WITH` single statements, enforces row/duration caps, then discards the DB.

The event-driven push variant remains deferred; keep the read-only, proxy-backed posture unless a new source-of-truth design says otherwise.

## LLM and protocol behavior

This section describes the **bot runtime's** provider adapter, not the control plane's. Bots host their own inference with their own key; the substrate does not.

[lite-template/helper/llm-client.js](../../lite-template/helper/llm-client.js) supports Anthropic, OpenAI, and Ollama. Anthropic uses forced tool use with the envelope schema; OpenAI and Ollama return raw text and rely on JSON extraction plus fallback synthesis.

The canonical envelope shape is mirrored in [lite-template/helper/envelope-schema.js](../../lite-template/helper/envelope-schema.js) and [control/lib/envelope-schema.js](../../control/lib/envelope-schema.js). When adding fields, update both and cross-check protocol cartridges in [control/lib/composer/protocols/](../../control/lib/composer/protocols/).

Vision is supported on Anthropic and OpenAI. Ollama rejects images at the adapter layer. Control-plane model protocol gates and task tiers live in [control/lib/llm-providers.js](../../control/lib/llm-providers.js); new control-plane LLM call sites should pick a task tier rather than reaching directly for a provider default.

## Builder-session binding

Moved here from [docs/MCP-ARCHITECTURE.md](../MCP-ARCHITECTURE.md#5-session-and-identity) §5 — it is the one MCP flow that binds per-connection state, and it ships with this pack. Creative tools are stateless per call; only the bot builder threads a session.

The web chat-builder threads a `session_id` through every tool call. MCP has no equivalent first-class primitive that's load-bearing for our flow, so we bind one `BuilderSession` per `mcp-session-id` header value, lazily, on first build-tool invocation.

```
   MCP request                  session-binding.js                  SQLite
        │                              │                              │
        │ tools/call build_*           │                              │
        │  (mcpSessionId="abc")        │                              │
        ├─────────────────────────────▶│                              │
        │                              │ bindings.get("abc")?         │
        │                              │   ── miss ──                 │
        │                              │                              │
        │                              │ buildPreloadedContext(user)  │
        │                              │   load apiKeys, documents,   │
        │                              │   existingBots, defaults     │
        │                              │                              │
        │                              │ BuilderSessionRepository     │
        │                              │  .createWithContext(...)     │
        │                              ├─────────────────────────────▶│
        │                              │                              │ INSERT
        │                              │◀─────────────────────────────┤ → session.id
        │                              │                              │
        │                              │ bindings.set("abc",          │
        │                              │              session.id)     │
        │                              │                              │
        │                              │ tool-executor handler        │
        │                              │   sees the same session      │
        │                              │   the web chat builder       │
        │                              │   would see                  │
```

Properties:

- **Mirror of web parity.** The same `builderToolHandlers` (in [tool-executors.js](../../control/lib/builder/tool-executors.js)) run for both MCP and the in-app chat — the only difference is who's the loop. Mojulo's `start_new_bot` MCP tool calls `resetBuilderSession(mcpSessionId)` so the agent can build a second bot in the same MCP connection without restarting the client.
- **In-memory binding map.** On process restart the map is lost; the connecting agent effectively starts a new bot — mirrors the web flow's "tab closed = session orphaned" behavior.
- **Refresh on every call.** `getOrCreateBuilderSession` re-reads the session row from SQLite each time so handlers see writes from prior tool calls in the same connection.
- **LLM key required.** Tool handlers refuse to start a session if no Anthropic/OpenAI/Ollama key is configured on the control plane — cloud-deploy tokens (Fly) don't count.

## MCP tool surface (pack)

Moved here from [docs/mcp-integration.md](../mcp-integration.md) — these tables were labelled "always on" there, which stopped being true when the factory became opt-in. None of them register on a default install.

### Build

| Tool                            | Synchronous / job | Notes                                                                                  |
| ------------------------------- | ----------------- | -------------------------------------------------------------------------------------- |
| `infer_intent`                  | sync              | Heuristic — fast.                                                                       |
| `recommend_protocols`           | sync              |                                                                                        |
| `generate_form_schema`          | sync              | LLM-backed; usually ≤2s.                                                                |
| `generate_appointment_config`   | sync              |                                                                                        |
| `generate_triage_config`        | sync              | Embeds route descriptions into the bot's vector store locally.                          |
| `generate_optical_read_config`  | sync              |                                                                                        |
| `compose_identity`              | sync              | LLM-backed when domain digest is present.                                              |
| `set_suggested_prompts`         | sync              |                                                                                        |
| `generate_bot_summary`          | sync              | LLM-backed.                                                                            |
| `process_documents`             | **job**           | Parses + embeds documents. Returns `{ jobId }`; poll with `poll_job`.                   |
| `save_modular_bot`              | **job**           | Persists the deployment row and builds the artifact. Returns `{ jobId }`.               |
| `upload_document_from_url`      | sync              | MCP-native document ingestion. Accepts `url`, `base64 + fileName`, or `text + fileName` (use `text` when piping already-extracted content from another MCP server like Google Docs — skips the binary round-trip through the model). Returns a `documentId`. |
| `poll_job`                      | sync              | Poll a job started by the job-based tools above.                                        |
| `start_new_bot`                 | sync              | Reset the builder session — call when the user wants to build a second bot.             |
| `get_builder_session`           | sync              | Inspect the current in-progress configuration.                                          |

### Operate

| Tool                  | Reads from                | Notes                                          |
| --------------------- | -------------------------- | ---------------------------------------------- |
| `list_deployments`    | control plane SQLite       | Filter by status / mode.                       |
| `get_deployment`      | control plane SQLite       |                                                |
| `query_conversations` | bot SQLite via bot-proxy   | Summaries only (id, timestamps, turn count). Optional since / until bounds.    |
| `get_conversation`    | bot SQLite via bot-proxy   | Full turn list for one conversation.            |
| `export_conversations`| bot SQLite via bot-proxy   | Full turn dump with optional date bounds. Heavy — bound by date on large bots. |
| `query_submissions`   | bot SQLite via bot-proxy   |                                                |
| `verify_chain`        | bot                        | Walks the tamper-evident hash chain.            |

Conversation- and submission-reading tools proxy through to the bot — they never copy transcript rows into the control-plane DB.

## Composition recipes (pack)

Four worked recipes that either feed a bot or read one. The main line now carries [creative compositions](../mcp-integration.md#recipes--composing-mojulo-tools-with-your-other-mcp-servers) instead; these moved here with the pack.

### 1. Drive folder → bot knowledge base

**You need:** the Google Drive MCP server connected alongside mojulo.

**Prompt:** *"Use every doc in my Drive folder 'Practice SOPs' as the knowledge base for a triage bot for my dental clinic."*

**Flow:** Drive lists + reads each doc → pipe the extracted text into `upload_document_from_url` with `text + fileName` (this mode is what skips the binary round-trip through the model when another MCP server already has parsed content) → `process_documents` returns a `jobId` → `poll_job` until done → `recommend_protocols` / `generate_triage_config` / `save_modular_bot`.

### 2. Linear escalations → triage routes

**You need:** the Linear MCP server connected.

**Prompt:** *"Pull the top 10 escalation labels from Linear project SUPPORT for the last quarter and turn them into triage routes for a customer-service bot."*

**Flow:** Linear queries issues by label/priority → your agent aggregates them into route descriptions → `generate_triage_config` embeds each route description into the bot's vector store → `save_modular_bot`.

### 3. Qualify submission → branch CRM workflow

**You need:** a downstream MCP server for the action — CRM (Salesforce / HubSpot), email (Gmail), ticketing (Linear), or a generic webhook MCP for anything else.

**Example.** A dental clinic intake bot captures: name, DOB, insurance carrier, chief complaint, returning-patient Y/N. The skill pulls new submissions, classifies each on those fields plus the free-text, and branches:

- New patient + accepted insurance → CRM `create_contact` + add to onboarding sequence + draft welcome email
- Returning patient → CRM `update_contact_last_visit` + scheduling email
- Chief complaint flagged urgent → Linear ticket for the on-call coordinator

**Prompt:** *"For new submissions since `2026-05-15` on deployment `<id>`, run the new-patient routing workflow."*

**Flow:** `query_submissions` with a `since` cursor → your agent classifies on the form fields → routes each submission to the right downstream MCP tool. Conversation rows never leave the bot — `query_submissions` proxies through [bot-proxy.js](../../control/lib/deployers/bot-proxy.js).

**Package it as an artifact** (a Claude Code skill at `.claude/skills/route-intake/SKILL.md`, a Codex automation, or whatever your host adapter writes) once the classification rules stabilize. Take `deploymentId` and `since` as args; the cursor is what makes the artifact idempotent across invocations — re-running it won't double-register a patient because already-seen submissions are below the cursor.

**Two things to be deliberate about:**

- **PII back through the LLM.** The form-gathering protocol's design point is that PII bypasses the LLM at *capture* time. This recipe deliberately reintroduces it at *routing* time, since classifying on insurance carrier or chief complaint requires reading those fields. Fine for many setups; worth thinking through against the data-handling posture you advertised to end users.
- **Irreversible writes.** For CRM creates, welcome-email sends, anything you can't easily undo — design the skill to propose the routing decision and confirm before firing, rather than fire-and-forget. The MCP tool surface doesn't enforce this; the skill's prompt does.

**Not event-driven.** Skills are invoked, not subscribed — there's no MCP path that fires on a new submission. If you need true event delivery, point the bot's form webhook ([server.js](../../lite-template/server.js)'s `/api/send-webhook` proxy) at a listener you control; the skill then becomes the "what to do with what arrived" half, invoked by you or the listener-side automation.

### 4. Sampled mention scan → analytical handoff

**You need:** an output target (Linear / Notion / Slack / Google Doc via the matching MCP).

**Example.** A SaaS support bot. Take a recent sample — say, the last 30 conversations — and scan each for competitor mentions, churn-intent language, or recurring feature requests. Anything that fires: file a Linear ticket tagged `voice-of-customer` with the conversation id and the matching snippet.

**Prompt:** *"Sample the 30 most recent conversations from deployment `<id>` and flag any churn-intent signals as Linear tickets."*

**Flow:** `query_conversations` with a small limit → `get_conversation` per id → your agent scans the turn text → matches go to the downstream MCP.

**Sampling is the point.** This recipe is a pattern proof, not a fleet sweep. A bounded sample keeps token cost predictable and lets you tune the signal prompt against real conversations before scaling up. Once the signal looks reliable, the same artifact takes a larger window — or runs on a cadence via your host's scheduler (Claude Code's `/schedule`, Codex automations, cron) for ongoing tuning, without keeping an interactive session open.

**Package it as an artifact** (a Claude Code skill at `.claude/skills/scan-conversations/SKILL.md`, a Codex automation, or whatever your host adapter writes) taking `deploymentId`, `sampleSize`, and the signal definition. Different signals (competitor mentions, churn intent, accessibility complaints) become different invocations of the same artifact rather than separate ones.

Recipes 1 and 2 use another MCP server as the *data source* and mojulo as the artifact producer. Recipes 3 and 4 invert that: the bot's read tools are the source and the downstream MCPs are the actuators. In both directions the operator's agent is the glue.

## Data layout (bot-side)

- Control-plane tables the factory owns: `deployments`, `modular_sessions`, `documents`, `mcp_jobs`, `api_keys`.
- Generated zips: [control/data/artifacts/](../../control/data/), uploaded documents: [control/data/storage/](../../control/data/).
- **Bot SQLite:** `data/conversation.db` inside each bot's own `./data/` mount. It never moves into the control plane.

## Invariants

- **Conversation data never moves into the control-plane DB.** Per-bot conversation and submission reads go through [bot-proxy.js](../../control/lib/deployers/bot-proxy.js).
- **Turn rows must go through the hashing helpers** — never insert turns that bypass `content_hash` / `chain_hash`. See [turn-hashing.md](turn-hashing.md).
- **The bot image is bot-agnostic.** Fly deploy injects per-bot config as files; do not rebuild images per bot. The control plane pins exact bot tags — never `:latest` from deploy code.
- **Nothing outside this pack may import it.** The carve fence covers the import direction plus shrink-only ledgers over the dashboard routes and the retained code still reading bot tables.
