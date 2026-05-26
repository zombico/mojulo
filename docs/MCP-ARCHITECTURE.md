# Mojulo MCP Architecture

The headless face of mojulo: the same control plane that compiles bots also exposes itself as a **remote MCP server** so a user's own MCP-capable agent (Claude Code, Claude Desktop, Codex CLI, any HTTP MCP client) can design, deploy, observe, and reason about the fleet without touching the Next.js UI. For the bot factory and artifact lifecycle, see [BOT-ARCHITECTURE.md](BOT-ARCHITECTURE.md).

The Next.js UI (chat builder, wizard, `/data` pane) and the MCP tool registry are **two faces of the same primitives** — the same `BuilderSession` + tool-executor pair, the same proxy reads, the same fleet rollups. Don't add MCP-only or UI-only branches past the primitive layer.

---

## 1. Topology

The MCP surface is a single Next.js route ([api/mcp/route.js](../control/app/api/mcp/route.js)) that owns transport + auth and forwards parsed JSON-RPC into [server.js](../control/lib/mcp/server.js), which owns protocol semantics + tool dispatch. Tools live in **rings** under [control/lib/mcp/tools/](../control/lib/mcp/tools/).

```
   MCP client agent                Control plane (Next.js, port 3001)
   (Claude Code, Codex, …)
        │
        │  POST /api/mcp                 ┌─────────────────────────────────────┐
        │  Authorization: Bearer <key>   │       app/api/mcp/route.js          │
        │  mcp-session-id: <uuid>        │                                     │
        ├───────────────────────────────▶│  • checkBearer(CONTROL_PLANE_MCP_KEY)│
        │  { jsonrpc, method, params }   │      unset → 404, wrong → 401       │
        │                                │  • ensureToolsRegistered() (lazy)   │
        │                                │  • buildContext(request)            │
        │                                │      { mcpSessionId, userId:'local'}│
        │                                │  • dispatchMcpRequest(body, ctx)    │
        │                                └─────────────────┬───────────────────┘
        │                                                  │
        │                                                  ▼
        │                                ┌─────────────────────────────────────┐
        │                                │      lib/mcp/server.js              │
        │                                │                                     │
        │                                │  initialize     → preamble + caps   │
        │                                │  tools/list     → registered tools  │
        │                                │  tools/call     → handler(input,ctx)│
        │                                │  ping           → {}                │
        │                                │                                     │
        │                                │  Tool registry (Map<name, tool>)    │
        │                                │  populated by registerTool() from   │
        │                                │  the per-ring registrar modules.    │
        │                                └─────────────────┬───────────────────┘
        │                                                  │
        │   { jsonrpc, id, result }                        │
        │◀─────────────────────────────────────────────────┘
```

Key invariants:

- **Auth is opt-in.** With `CONTROL_PLANE_MCP_KEY` unset the route returns `404` (not `401`) so external probes can't fingerprint whether MCP is "off" vs "wrong key". Same single-user posture as the rest of the control plane — never expose `/api/mcp` to the public internet.
- **Tool execution failures return as MCP `tool_result` with `isError:true`**, not JSON-RPC errors — per spec, so the connecting model sees the failure and can react inside its loop.
- **Lazy tool registration.** `ensureToolsRegistered()` (in [server.js](../control/lib/mcp/server.js)) fires on first request; the registration order is **deliberate** because most MCP clients surface `tools/list` to the model as a list — the natural reading order surfaces orientation → per-bot → fleet → outcome → deliberation. Don't reorder casually.
- **GET on `/api/mcp` is reserved** by the Streamable HTTP spec for server-initiated SSE; we 405 it for now. The wire shape currently in use is "POST a JSON-RPC message, get one back" plus batch arrays.

---

## 2. The ring model

Every tool slots into one of seven rings. The rings carry meaning — they're how the connecting model orients itself, and how `forward_context`'s tool index groups things.

```
                    ┌───────────────────────────────────────────────────┐
                    │  Ring 0 — orientation                             │
                    │  forward_context, get_adapter                     │
                    │  The agent calls these BEFORE acting.             │
                    └────────────────────┬──────────────────────────────┘
                                         │
       ┌─────────────────────┬───────────┴───────────┬─────────────────────┐
       ▼                     ▼                       ▼                     ▼
 ┌───────────┐         ┌───────────┐           ┌───────────┐         ┌───────────┐
 │  Ring 1   │         │  Ring 2   │           │  Ring 3   │         │  Ring 4   │
 │  build_*  │         │  jobs_*   │           │  operate_*│         │  fleet_*  │
 │ (design)  │         │ (async)   │           │ (per-bot) │         │(cross-bot)│
 │           │         │ deploy/   │           │ proxied   │         │ rollups + │
 │ wraps     │         │ rebuild   │           │ reads of  │         │ SQL       │
 │ Builder-  │         │ poll-able │           │ a single  │         │ Explorer  │
 │ Session   │         │ from MCP  │           │ deployment│         │ in-memory │
 └─────┬─────┘         └─────┬─────┘           └─────┬─────┘         └─────┬─────┘
       │                     │                       │                     │
       └─────────────────────┴───────────┬───────────┴─────────────────────┘
                                         ▼
                            ┌───────────────────────────┐
                            │  Ring 5 — catalysts       │
                            │  list/get/recommend       │
                            │  curated MD recipes the   │
                            │  agent synthesizes into a │
                            │  local Claude Code skill. │
                            └─────────────┬─────────────┘
                                          ▼
                ┌─────────────────────────────────────────────────────┐
                │  Ring 6 — deliberation (six surfaces, bot-indep.)   │
                │                                                     │
                │  contextmap          meta_context_brief / commit    │
                │  inventory           meta_context_declare_inventory │
                │  capabilities        record_/get_mcp_capabilities   │
                │  mcp-orbit composer  recommend_mcp_orbit_compositions
                │  primitive binding   bind_primitives                │
                │  semantic recall     semantic_search                │
                │                                                     │
                │  Reasoning ABOUT structure, not reading content.    │
                └─────────────────────────────────────────────────────┘
```

| Ring | Purpose | What flows | Source |
|---|---|---|---|
| 0 | Orientation — load the full briefing on demand | Glossary, capability model, deploy/connect lifecycle, tool index | [context.js](../control/lib/mcp/tools/context.js), [adapters.js](../control/lib/mcp/tools/adapters.js) |
| 1 | Bot design (parity with chat builder) | `BuilderSession` + tool-executor calls | [build.js](../control/lib/mcp/tools/build.js) |
| 2 | Async deploy / rebuild jobs | Poll-able job state in `mcp_jobs` | [jobs-tools.js](../control/lib/mcp/tools/jobs-tools.js), [jobs.js](../control/lib/mcp/jobs.js) |
| 3 | Per-bot reads | All forwarded through [bot-proxy.js](../control/lib/deployers/bot-proxy.js); never copied locally | [operate.js](../control/lib/mcp/tools/operate.js) |
| 4 | Cross-bot rollups + ad-hoc SQL | Per-bot `/api/analytics/*` rollups composed into a fresh in-memory SQLite per query | [fleet.js](../control/lib/mcp/tools/fleet.js), [fleet/scoped-sql.js](../control/lib/fleet/scoped-sql.js) |
| 5 | Curated workflow recipes | Markdown nuclei in [catalysts/](../control/lib/mcp/catalysts/); agent fuses with bot shape + local MCPs into `.claude/skills/<name>/SKILL.md` | [catalysts.js](../control/lib/mcp/tools/catalysts.js) |
| 6 | Deliberation about structure | Contextmap, inventory, capabilities, mcp-orbit composer, primitive binding, semantic recall — all bot-independent | see §4 |

**Why `forward_context` matters.** The `initialize` preamble surfaced to the connecting model is deliberately *tiny* — one framing sentence + a pointer to call `forward_context`. The full briefing (glossary, capability model, lifecycle, every tool's one-line description) lives in that tool's response. The agent only pays the context cost when the user actually needs orientation. **When you add a tool, the tool index in [context.js](../control/lib/mcp/tools/context.js) must be updated** — a missing entry leaves the connecting agent flying blind.

**Standing secrets rule.** The initialize preamble also tells the connecting agent: treat `.env` files under `$MOJULO_HOME` and inside any unzipped mojulo bot as user secrets. To inspect a bot's environment, call `inspect_bot_env` — it returns masked values. The agent must never `cat`, `Read`, or echo raw `.env` contents.

---

## 3. Request lifecycle

```
 MCP client                Next.js route                 server.js              Tool handler
   │                            │                            │                       │
   │ POST /api/mcp              │                            │                       │
   │  + Bearer                  │                            │                       │
   │  + mcp-session-id          │                            │                       │
   ├───────────────────────────▶│                            │                       │
   │                            │ checkBearer()              │                       │
   │                            │   no env  → 404            │                       │
   │                            │   bad key → 401            │                       │
   │                            │                            │                       │
   │                            │ ensureToolsRegistered()    │                       │
   │                            │   (once per process)       │                       │
   │                            │                            │                       │
   │                            │ buildContext()             │                       │
   │                            │   { mcpSessionId, userId } │                       │
   │                            │                            │                       │
   │                            │ dispatchMcpRequest(body,   │                       │
   │                            │                    ctx)    │                       │
   │                            ├───────────────────────────▶│                       │
   │                            │                            │ switch(method):       │
   │                            │                            │  initialize           │
   │                            │                            │   rememberClientInfo  │
   │                            │                            │     (for adapter      │
   │                            │                            │      auto-resolution) │
   │                            │                            │   → preamble + caps   │
   │                            │                            │                       │
   │                            │                            │  tools/list           │
   │                            │                            │   → registry snapshot │
   │                            │                            │                       │
   │                            │                            │  tools/call           │
   │                            │                            │   lookup by name      │
   │                            │                            │   tool.handler(       │
   │                            │                            ├──────────────────────▶│
   │                            │                            │     input, ctx)       │ ring-specific
   │                            │                            │                       │   logic
   │                            │                            │◀──────────────────────┤
   │                            │                            │ wrap → MCP content[]  │
   │                            │◀───────────────────────────┤                       │
   │◀───────────────────────────┤  { jsonrpc, id, result }   │                       │
```

The execution context (`{ mcpSessionId, userId }`) carried on every dispatch is what makes session-scoped state possible without a per-tool session-id parameter — see §5.

---

## 4. Ring 6 in detail

Ring 6 is the deliberation layer. Where Rings 1–5 do work (design, deploy, read, recommend recipes), Ring 6 records **why** structural decisions were made, what the operator's environment looks like, what vendors are known to support what, what compositions have been proposed, what artifacts have been bound — and lets the agent recall any of it.

### 4a. Contextmap — `meta_context_brief` / `meta_context_commit`

Writeable, durable, append-only. Records *why* this artifact was materialized via that adapter for this bot, what locked-in constraints the operator declared, what mapping decisions a specific binding encodes.

Three MVP write triggers:

- **Operator KYC** — optional bootstrap commit when the operator declares their situation up front.
- **`artifact_materialization`** — bot-shaped catalyst flow. One atomic commit per materialization.
- **`primitive_artifact_materialization`** — no-bot primitive-binding flow. Sibling commit path that records the artifact → bound MCP tools audit chain.

Writes happen at **structural events only**, never at outcome events — outcomes (a conversation, an automation run) happen at run-rate; structural decisions (a fleet pivot, an artifact being materialized) happen at deliberation-rate. The asymmetry is what makes the layer auditable.

Adapter-delegated verification runs before each commit ([meta-context/verification.js](../control/lib/mcp/meta-context/verification.js)): claude-code/generic require `existsSync` against the materialized path; codex accepts opaque automation handles on the agent's assertion (deliberate MVP relaxation).

Source: [meta-context.js](../control/lib/mcp/tools/meta-context.js). Full spec: [meta-context.md](meta-context.md).

### 4b. Inventory — `meta_context_declare_inventory`

Replace-semantic current-state cache of the connecting agent's MCP environment: which servers are connected, which tools they expose, optionally with per-tool `inputSchema` + `introspectionConfidence` (richer-snapshot mode used by primitive binding).

Sits **alongside** the append-only contextmap on purpose: inventory is *present environment*, not a sealed decision, so it gets DELETE+INSERT semantics in one transaction. This is the entry point for using mojulo without deploying a chatbot — once inventory is declared, MCP-to-MCP workflows have something to compose against.

A compact snapshot rides on `meta_context_brief({kind:'fleet'})` as `inventory.{servers, declaredAt, ageSeconds, toolCount}` so a single brief call yields both deliberation history and environment shape.

Source: [mcp-inventory.js](../control/lib/mcp/tools/mcp-inventory.js). Full spec: [lite-template/integration/MCP_INVENTORY_PLAN.md](../lite-template/integration/MCP_INVENTORY_PLAN.md).

### 4c. Capabilities — `record_mcp_capabilities` / `get_mcp_capabilities`

The **research facet** of a provider, sibling to inventory's introspection facet. `record_mcp_capabilities` writes a vendor knowledge body (frontmatter + prose + cited URLs) for one canonical `provider_ref` with transactional supersession preserving full history; `get_mcp_capabilities` reads the current row or walks the chain via `asOf`.

Both write into provider rows on a **shared identity layer** (`meta_mcp_providers`) — one logical "Gmail" in mojulo regardless of which path arrived at it. Mojulo ships four seeded vendor bodies on first install (gmail, notion, linear, google_drive) honestly attributed via `source_urls[0]=mojulo://CHANGELOG#v0.5.0`; the [research-mcp-vendor catalyst](../control/lib/mcp/catalysts/research-mcp-vendor.md) refreshes them.

Source: [mcp-capabilities.js](../control/lib/mcp/tools/mcp-capabilities.js). Seed bodies: [seeds/mcp-capabilities/](../control/lib/mcp/seeds/mcp-capabilities/).

### 4d. mcp-orbit composer — `list_mcp_orbit_components` / `get_mcp_orbit_component` / `get_meta_catalyst` / `recommend_mcp_orbit_compositions`

Sits **on top of** contextmap + inventory + capabilities through a consolidated view (`CapabilitiesRepository.consolidatedView`). Decomposes the non-bot workflow space into five typed component kinds (`mcp` × `trigger` × `pattern` × `idempotency` × `render`) the agent composes under the meta-catalyst's discipline. The server provides components + constraint validation; the agent provides judgment.

`source` and `destination` are **composition roles** carried per-entry in `component_refs`, not kinds — each `mcp` component declares an `affordances` map (`read` / `write` / `watch`) and plays whichever role its affordances support, so the same Gmail MCP can play source in one composition and destination in another.

Five composer states per chosen provider (`research` / `seed` / `inventory_only` / `capabilities_only` / `none`) each surface as their own warning tag so the agent routes remediation directly. Every recommendation persists as a `proposed` composition row so the deliberation log itself is auditable; on materialization, `meta_context_commit` records the composition ref in an artifact-scope principle as the durable link between the artifact and the components it was built from.

Source: [mcp-orbit.js](../control/lib/mcp/tools/mcp-orbit.js). Full spec: [mcp-orbit.md](mcp-orbit.md).

### 4e. Primitive binding — `bind_primitives`

The **runtime-introspected composer** for MCP-to-MCP workflows. Takes a vendor-agnostic primitive (`document-store`, `structured-record-store`, `messaging-channel`, `message-thread`) + a composition role (`source` | `destination`) + a server from declared inventory + an affordance→tool bindings map, runs the deterministic generator in [mcp-orbit-components/generator.js](../control/lib/mcp/mcp-orbit-components/generator.js), and persists the result in `mcp_orbit_provider_artifacts` as a session-scoped provider artifact (`prov_<id>`).

The artifact's body is the primitive's role template filled with the **actual bound tool names + schemas from the operator's installed MCP** — not a curated guess. Graduates via `meta_context_commit({type:'primitive_artifact_materialization', ...})`.

This is the **supported path** for composing MCP-to-MCP workflows from typed primitives; the vendor-shaped `recommend_mcp_orbit_compositions` flow remains as a seed-reasoning surface for first-encounter scaffolding. The four primitives live in [mcp-orbit-components/primitive/](../control/lib/mcp/mcp-orbit-components/primitive/) as body + source-role template + destination-role template triples.

Source: [mcp-primitive-binding.js](../control/lib/mcp/tools/mcp-primitive-binding.js).

### 4f. Semantic recall — `semantic_search`

**Fuzzy lookup over durable mojulo state** — the recall counterpart to the five structured readers above. Backed by a single embedding sidecar table (`meta_embeddings`) keyed on `(source_kind, source_ref)` and populated atomically alongside every source-row write through the split sync/async helpers in [repositories/embeddings.js](../control/lib/db/repositories/embeddings.js).

Covers seven source kinds: `principle`, `mcp_tool` (declared inventory), `mcp_capability` (current row only — supersession filter is load-bearing), `orbit_component`, `orbit_composition`, `orbit_artifact`, `catalyst`. Returns ranked `{ source_kind, source_ref, score, snippet }` rows — *retrieve, don't resolve*; the agent pairs results with the structured readers to pull full bodies.

Embeddings use the **same in-process multilingual-e5-small ONNX** that powers bot-side RAG (no new dependency). First-boot backfill via `maybeBackfillEmbeddings` in [db/index.js](../control/lib/db/index.js); `MOJULO_SEMANTIC_INDEX_DISABLED=1` skips the auto-run, and [scripts/reindex-embeddings.js](../control/scripts/reindex-embeddings.js) is the manual recovery / body-composition-change path.

Source: [semantic-search.js](../control/lib/mcp/tools/semantic-search.js). Full spec: [lite-template/integration/SEMANTIC_INDEX_PLAN.md](../lite-template/integration/SEMANTIC_INDEX_PLAN.md).

---

## 5. Session binding

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

- **Mirror of web parity.** The same `builderToolHandlers` (in [tool-executors.js](../control/lib/builder/tool-executors.js)) run for both MCP and the in-app chat — the only difference is who's the loop. Mojulo's `start_new_bot` MCP tool calls `resetBuilderSession(mcpSessionId)` so the agent can build a second bot in the same MCP connection without restarting the client.
- **In-memory binding map.** On process restart the map is lost; the connecting agent effectively starts a new bot — mirrors the web flow's "tab closed = session orphaned" behavior.
- **Refresh on every call.** `getOrCreateBuilderSession` re-reads the session row from SQLite each time so handlers see writes from prior tool calls in the same connection.
- **LLM key required.** Tool handlers refuse to start a session if no Anthropic/OpenAI/Ollama key is configured on the control plane — cloud-deploy tokens (Fly) don't count.

Single-user posture: every call is scoped to `userId='local'`. There is no multi-tenant identity inside MCP (see [auth/service.js](../control/lib/auth/service.js)).

---

## 6. The two MCP-to-MCP composition flows

mcp-orbit and primitive-binding (both in Ring 6) are **sibling composers**, not replacements. They synthesize the same downstream — a host-adapter materialization sealed via `meta_context_commit` — but differ in what flows into the synthesis.

```
                                    ┌────────────────────────────┐
                                    │  Operator's installed MCPs │
                                    │  (Gmail, Notion, Linear,   │
                                    │   Drive, Slack, …)         │
                                    └─────────────┬──────────────┘
                                                  │
                          ┌───────────────────────┴───────────────────────┐
                          ▼                                               ▼
        ┌─────────────────────────────────┐         ┌─────────────────────────────────┐
        │  Vendor-shaped (seed)           │         │  Primitive-binding (supported)  │
        │  recommend_mcp_orbit_           │         │  bind_primitives                │
        │    compositions                 │         │                                 │
        │                                 │         │                                 │
        │  5 typed component kinds        │         │  4 vendor-agnostic primitives   │
        │  • mcp                          │         │  • document-store               │
        │  • trigger                      │         │  • structured-record-store      │
        │  • pattern                      │         │  • messaging-channel            │
        │  • idempotency                  │         │  • message-thread               │
        │  • render                       │         │                                 │
        │                                 │         │  + composition role             │
        │  Provides curated seed          │         │  + server from inventory        │
        │  combinations for first-        │         │  + affordance→tool bindings     │
        │  encounter scaffolding.         │         │                                 │
        │                                 │         │  Generator fills the primitive's│
        │  Persists in                    │         │  role template with the actual  │
        │  mcp_orbit_compositions as      │         │  bound tool names + schemas     │
        │  'proposed' rows for audit.     │         │  from the operator's MCP.       │
        │                                 │         │                                 │
        │                                 │         │  Persists in                    │
        │                                 │         │  mcp_orbit_provider_artifacts   │
        │                                 │         │  as session-scoped prov_<id>.   │
        └─────────────────┬───────────────┘         └────────────────┬────────────────┘
                          │                                          │
                          └────────────────────┬─────────────────────┘
                                               ▼
                          ┌─────────────────────────────────────────┐
                          │  Host adapter materialization           │
                          │  (Claude Code skill, Codex automation,  │
                          │   generic workflow.md)                  │
                          │                                         │
                          │  Sealed via meta_context_commit:        │
                          │  • artifact_materialization (bot-shaped │
                          │    catalyst flow)                       │
                          │  • primitive_artifact_materialization   │
                          │    (no-bot primitive-binding flow)      │
                          └─────────────────────────────────────────┘
```

Use **primitive-binding** when the operator wants the workflow grounded in their real, introspected MCPs. Use the **vendor-shaped composer** when scaffolding from curated seed knowledge before the operator has declared inventory yet — or when reasoning about a workflow type's shape independent of any specific server.

---

## 7. Catalysts: nucleation, not artifact

Catalysts (Ring 5) are curated workflow recipes shipped as markdown in [control/lib/mcp/catalysts/](../control/lib/mcp/catalysts/). The connecting agent pulls one via `get_catalyst`, combines it with a specific bot's shape (via Ring 3 tools) and the user's already-installed MCPs, and **synthesizes a local Claude Code skill** into `.claude/skills/<name>/SKILL.md`. The catalyst is the nucleation point, not the artifact — it persists in the library, the synthesized skill is what actually runs.

Frontmatter is **JSON** (not YAML) and the loader requires `id`, `name`, `summary`, and `valueHook` (one-sentence outcome framing used by `recommend_catalysts` in consultation mode). Validation faults throw — the library is curated, not user input. Authoring is repo-side only; there is no user-writable catalyst directory. See [catalysts.md](catalysts.md) for the author spec, and use the [/write-catalyst](../.claude/skills/) skill to draft new ones.

---

## 8. Data layout (Ring 6 tables)

All Ring 6 state lives in the control plane SQLite at [control/data/mojulo-lite.db](../control/data/). WAL mode, foreign keys on, repositories in [control/lib/db/repositories/](../control/lib/db/repositories/).

| Table | Owner | Semantics |
|---|---|---|
| `meta_nodes`, `meta_edges`, `meta_principles` | contextmap | Append-only; the durable graph of structural decisions. See [meta-context.md](meta-context.md). |
| `meta_mcp_inventory` | inventory | Replace-semantic. Per-tool `input_schema_json` + `introspection_confidence` columns for richer-snapshot mode. |
| `meta_mcp_providers` | shared identity | The "what's a Gmail" layer — both inventory and capabilities write into it. One logical provider regardless of arrival path. |
| `meta_mcp_capabilities` | capabilities | Transactional supersession via `superseded_by`. Unique-partial index on `current` rows per provider. History preserved. |
| `mcp_orbit_components` | mcp-orbit composer | Typed component store (`source='builtin'` or `'custom'`). Loaded from disk at startup. |
| `mcp_orbit_compositions` | mcp-orbit composer | Composition log. Every recommendation persists as a `proposed` row; promotion is its own state transition. |
| `mcp_orbit_provider_artifacts` | primitive binding | Session-scoped bound primitive artifacts (`prov_<id>`) — affordance manifest + bindings + body. |
| `meta_embeddings` | semantic recall | One row per `(source_kind, source_ref)` across the seven indexed kinds. Raw `float32[384]` BLOB embedding, `content_hash` skip-on-unchanged, `model` column reserved for future model swaps. |

Migration is in the migration block in [db/index.js](../control/lib/db/index.js).

---

## 9. Key files

| File | Role |
|------|------|
| [control/app/api/mcp/route.js](../control/app/api/mcp/route.js) | HTTP transport + bearer auth; forwards JSON-RPC into server.js |
| [control/lib/mcp/server.js](../control/lib/mcp/server.js) | Protocol dispatch, tool registry, initialize preamble |
| [control/lib/mcp/session-binding.js](../control/lib/mcp/session-binding.js) | `mcpSessionId` → `BuilderSession` lazy binding |
| [control/lib/mcp/client-bindings.js](../control/lib/mcp/client-bindings.js) | `clientInfo` capture for host-adapter auto-resolution |
| [control/lib/mcp/jobs.js](../control/lib/mcp/jobs.js) | Async job state machine for Ring 2 (deploy/rebuild from short-lived MCP clients) |
| [control/lib/mcp/tools/context.js](../control/lib/mcp/tools/context.js) | Ring 0 — `forward_context`. The tool index lives here; keep it in sync when adding tools |
| [control/lib/mcp/tools/adapters.js](../control/lib/mcp/tools/adapters.js) | Ring 0 — `get_adapter` (host adapter binding) |
| [control/lib/mcp/tools/build.js](../control/lib/mcp/tools/build.js) | Ring 1 — wraps `BuilderSession` + tool-executors |
| [control/lib/builder/tool-executors.js](../control/lib/builder/tool-executors.js) | The shared builder handlers — same for MCP and web chat |
| [control/lib/mcp/tools/jobs-tools.js](../control/lib/mcp/tools/jobs-tools.js) | Ring 2 — `create_job`, `get_job_status` |
| [control/lib/mcp/tools/operate.js](../control/lib/mcp/tools/operate.js) | Ring 3 — per-bot reads (all through bot-proxy) |
| [control/lib/deployers/bot-proxy.js](../control/lib/deployers/bot-proxy.js) | `normalizeBotUrl`, `probeBotConnection`, `fetchFromBot` — used by Ring 3 |
| [control/lib/mcp/tools/fleet.js](../control/lib/mcp/tools/fleet.js) | Ring 4 — cross-bot rollups + SQL Explorer |
| [control/lib/fleet/scoped-sql.js](../control/lib/fleet/scoped-sql.js) | Builds a fresh in-memory SQLite per SQL Explorer query; SELECT/WITH only, single statement, row + duration caps |
| [control/lib/deployers/bot-fleet.js](../control/lib/deployers/bot-fleet.js) | Fans the per-bot proxy across all connected deployments (timeout + concurrency capped) |
| [control/lib/mcp/tools/catalysts.js](../control/lib/mcp/tools/catalysts.js) | Ring 5 — `list/get/recommend_catalysts` |
| [control/lib/mcp/catalysts/loader.js](../control/lib/mcp/catalysts/loader.js) | JSON frontmatter loader; requires `id`, `name`, `summary`, `valueHook` |
| [control/lib/mcp/catalysts/](../control/lib/mcp/catalysts/) | The curated library |
| [control/lib/mcp/tools/meta-context.js](../control/lib/mcp/tools/meta-context.js) | Ring 6 — contextmap (`brief` / `commit` / `declare_inventory`) |
| [control/lib/mcp/meta-context/verification.js](../control/lib/mcp/meta-context/verification.js) | Adapter-delegated pre-commit verification |
| [control/lib/mcp/tools/mcp-inventory.js](../control/lib/mcp/tools/mcp-inventory.js) | Ring 6 — inventory cache |
| [control/lib/mcp/tools/mcp-capabilities.js](../control/lib/mcp/tools/mcp-capabilities.js) | Ring 6 — capabilities (vendor research bodies on the providers identity layer) |
| [control/lib/mcp/seeds/mcp-capabilities/](../control/lib/mcp/seeds/mcp-capabilities/) | The four seeded vendor bodies (gmail, notion, linear, google_drive) |
| [control/lib/mcp/tools/mcp-orbit.js](../control/lib/mcp/tools/mcp-orbit.js) | Ring 6 — vendor-shaped composer (`list/get/recommend`) |
| [control/lib/mcp/mcp-orbit-components/](../control/lib/mcp/mcp-orbit-components/) | Curated component library + meta-catalyst |
| [control/lib/mcp/mcp-orbit-components/generator.js](../control/lib/mcp/mcp-orbit-components/generator.js) | Deterministic primitive-binding generator |
| [control/lib/mcp/tools/mcp-primitive-binding.js](../control/lib/mcp/tools/mcp-primitive-binding.js) | Ring 6 — `bind_primitives` |
| [control/lib/mcp/mcp-orbit-components/primitive/](../control/lib/mcp/mcp-orbit-components/primitive/) | The four primitives (body + source-role template + destination-role template) |
| [control/lib/mcp/tools/semantic-search.js](../control/lib/mcp/tools/semantic-search.js) | Ring 6 — `semantic_search` |
| [control/lib/db/repositories/embeddings.js](../control/lib/db/repositories/embeddings.js) | Split sync/async helpers that keep `meta_embeddings` in lockstep with source writes |
| [control/scripts/reindex-embeddings.js](../control/scripts/reindex-embeddings.js) | Manual recovery / body-composition-change path |

---

## 10. Related docs

- [mcp-integration.md](mcp-integration.md) — client setup (Claude Desktop, Claude Code, Codex), enabling `/api/mcp`, the bearer-key model
- [meta-context.md](meta-context.md) — full spec for the contextmap layer (the bright line, write triggers, the graph)
- [mcp-orbit.md](mcp-orbit.md) — full spec for the vendor-shaped composer and the primitive-binding companion
- [catalysts.md](catalysts.md) — what a catalyst is, the frontmatter contract, the author spec
- [chat-builder.md](chat-builder.md) — the web-side counterpart to Ring 1 (same BuilderSession + tool executors)
- [wizard-builder.md](wizard-builder.md) — the form-driven third entry point that also converges on `buildDeploymentConfig()`
- [conversations-api.md](conversations-api.md) — the bot-side API that Ring 3 proxies through
- [federated-routing.md](federated-routing.md) — cross-bot handoffs and how the tamper-evident chain extends through them
- [BOT-ARCHITECTURE.md](BOT-ARCHITECTURE.md) — the bot-shaped face: how the artifact is compiled and what runs inside it
