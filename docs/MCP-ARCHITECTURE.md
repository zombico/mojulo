# Mojulo MCP Architecture

The headless face of mojulo: the control plane exposes itself as a **local MCP server** so the operator's own MCP-capable agent (Claude Code, Claude Desktop, Codex CLI, any HTTP MCP client) can make things, wire things, and reason about state without touching the Next.js UI. This is the primary way mojulo is driven — the dashboard renders what accumulates; the agent is what acts.

The dashboard and the MCP tool registry are **two faces of the same primitives**. Don't add MCP-only or UI-only branches past the primitive layer.

This doc covers the control surface: transport, gating, session binding, the deliberation surfaces, and the request lifecycle. The **creative substrate** those tools mint into — kinds, kernels, render and export emitters — is [POLYGONIZER-SYNTHESIS.md](POLYGONIZER-SYNTHESIS.md) and [AGENT-REFERENCE.md](AGENT-REFERENCE.md#the-creative-substrate). The **optional chatbot pack** is [docs/chatbot/](chatbot/).

---

## 1. Topology

The MCP surface is a single Next.js route ([api/mcp/route.js](../control/app/api/mcp/route.js)) that owns transport + auth and forwards parsed JSON-RPC into [server.js](../control/lib/mcp/server.js), which owns protocol semantics + tool dispatch. Tools live under [control/lib/mcp/tools/](../control/lib/mcp/tools/), grouped for the agent into **wings and packs** (§2).

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

- **Auth is opt-in.** With `CONTROL_PLANE_MCP_KEY` unset the route returns `404` (not `401`) so external probes can't fingerprint whether MCP is "off" vs "wrong key". Same single-operator posture as the rest of the control plane — never expose `/api/mcp` to the public internet.
- **Tool execution failures return as MCP `tool_result` with `isError:true`**, not JSON-RPC errors — per spec, so the connecting model sees the failure and can react inside its loop.
- **Lazy tool registration.** `ensureToolsRegistered()` (in [server.js](../control/lib/mcp/server.js)) fires on first request; the registration order is **deliberate** because most MCP clients surface `tools/list` to the model as a list — the natural reading order surfaces orientation first, then the creative mints, then the automation backend. Don't reorder casually.
- **GET on `/api/mcp` is reserved** by the Streamable HTTP spec for server-initiated SSE; we 405 it for now. The wire shape currently in use is "POST a JSON-RPC message, get one back" plus batch arrays.

---

## 2. Wings, packs, and gating

What the connecting agent actually sees is **two wings over twenty packs**, gated by what is installed on the host. (The ring numbering below predates this and survives as registration order — read it second, not first.)

A **wing** is taxonomy and routing: `forward_context()` opens the STUDIO wing by default, `forward_context({mode:'office'})` opens the automation backend. A **pack** is the unit of install and the unit the agent opens. Each pack declares a `wing`, and either an `installGroup` (`creative` | `chatbot`) or none — a pack declaring none is unconditional, like the kernel.

```
                       ┌──────────────────────────────────────┐
                       │  Ring 0 — orientation (always on)    │
                       │  forward_context · get_adapter       │
                       │  get_tool_index · get_substrate · …  │
                       │  + the KERNEL: mint_diagram          │
                       └──────────────┬───────────────────────┘
                                      │
        forward_context()  ◄──────────┴──────────►  forward_context({mode:'office'})
        ┌───────────────────────────┐         ┌────────────────────────────────────┐
        │  STUDIO — the 3D factory  │         │  OFFICE — automation backend       │
        │  (the DEFAULT read)       │         │                                    │
        │                           │         │  installGroup: none (always on)    │
        │  installGroup: 'creative' │         │   pack_connected_services          │
        │   pack_diagram            │         │   pack_runtime                     │
        │   pack_illustration       │         │   pack_plan                        │
        │   pack_reference          │         │   pack_research                    │
        │   pack_image_render       │         │   pack_stash                       │
        │   pack_object             │         │   pack_catalysts                   │
        │   pack_world              │         │                                    │
        │   pack_view               │         │  ╷ installGroup: 'chatbot' ╷        │
        │   pack_motion             │         │  ╷ ABSENT unless installed ╷        │
        │   pack_audio              │         │  ╷  pack_bot_build        ╷        │
        │   pack_voice              │         │  ╷  pack_bot_operate      ╷        │
        │   pack_game               │         │  ╷  pack_fleet            ╷        │
        │                           │         │  ╵ mojulo install chatbot ╵        │
        │  mojulo install creative  │         │                                    │
        └───────────────────────────┘         └────────────────────────────────────┘
```

| Wing | Install group | Pack | What it makes |
|---|---|---|---|
| studio | creative | `pack_diagram` | Diagrams & charts |
| studio | creative | `pack_illustration` | Scene & figure illustration |
| studio | creative | `pack_reference` | Visual reference (from a photo) |
| studio | creative | `pack_image_render` | AI-image render pipeline (the director layer) |
| studio | creative | `pack_object` | 3D solids, figures & objects |
| studio | creative | `pack_world` | Worlds (traversable) |
| studio | creative | `pack_view` | Study views (science / math / bio) |
| studio | creative | `pack_motion` | Motion, film & motion-comic |
| studio | creative | `pack_audio` | Audio — Mojulo Beats |
| studio | creative | `pack_voice` | Voice — Mojulo Voice |
| studio | creative | `pack_game` | Game |
| office | *(none)* | `pack_connected_services` | MCP deliberation & binding |
| office | *(none)* | `pack_runtime` | Apps, daemons & agent tasks |
| office | *(none)* | `pack_plan` | Plan mode |
| office | *(none)* | `pack_research` | Research mode |
| office | *(none)* | `pack_stash` | Gather / stash / cook / publish |
| office | *(none)* | `pack_catalysts` | Catalysts, adapters & extension |
| office | **chatbot** | `pack_bot_build` | Chatbot — build & deploy |
| office | **chatbot** | `pack_bot_operate` | Chatbot — operate deployed bots |
| office | **chatbot** | `pack_fleet` | Fleet — cross-bot aggregation |

Roster and membership: [packs.js](../control/lib/mcp/packs.js).

**Install is PACK-grain, and derived from disk.** State comes from what is physically present on the host, with `MOJULO_PACKS` as an explicit override. The heavy creative stack is optional (`mojulo install creative`); the chatbot factory is opt-in since 2.0 (`mojulo install chatbot`, `--remove` to take it away) and is **absent from a default install** — 17 of 20 packs, no bot tools listed. The kernel alone can still mint a diagram: `mint_diagram` is spine, not pack. See [install-capabilities.md](install-capabilities.md).

**The iron wall is execution, not information.** An uninstalled pack's tools do not list and do not run, and refuse with an advisory naming the install rather than pretending not to exist. `mojulo tools` / `mojulo packs` list only installed packs with a `not installed: … add with: …` footer. Knowledge is never hidden; only execution is walled.

**Packs mode.** On hosts that do not already defer tool schemas client-side, `tools/list` carries a small spine plus **one tool per pack** — a result-shaped bundle whose description says what it makes. The agent calls a pack with no arguments to open it (orientation + a member manual with names, descriptions, and input schemas), then runs members through it: `pack_audio({ tool: 'create_beats', args: { … } })`. Packs are additive — open what the session needs, no more. Hosts that defer schemas natively get the flat registry instead ([server.js](../control/lib/mcp/server.js), `clientDefersSchemas`).

### Rings — registration order (legacy vocabulary)

Rings are the order tools register in, and the vocabulary much of the code and prose still uses. They are **not** how the agent orients — that is the wing/pack split above. Read them when you are working *inside* the server.

| Ring | Purpose | Source |
|---|---|---|
| 0 | Orientation — routing index + drawers | [context.js](../control/lib/mcp/tools/context.js), [adapters.js](../control/lib/mcp/tools/adapters.js) |
| 1–4 | **Chatbot pack only** — bot design, async deploy/rebuild jobs, per-bot proxied reads, cross-bot rollups + scoped SQL. Registered only when the pack is installed. | [build.js](../control/lib/mcp/tools/build.js), [jobs-tools.js](../control/lib/mcp/tools/jobs-tools.js), [operate.js](../control/lib/mcp/tools/operate.js), [fleet.js](../control/lib/mcp/tools/fleet.js) |
| 5 | Curated workflow recipes (catalysts) | [catalysts.js](../control/lib/mcp/tools/catalysts.js) |
| 6 | Deliberation about structure — seven surfaces, all paradigm-independent (see §4) | see §4 |
| 7 | Runtime: app lifecycle + the agent-task queue | [runner.js](../control/lib/mcp/tools/runner.js), [agent-tasks.js](../control/lib/mcp/tools/agent-tasks.js) |
| 8 | Plan mode — proposed/speculative, compiles against the live registry | [plan-mode.js](../control/lib/mcp/tools/plan-mode.js) |
| 9 | Research mode — accretive exploratory drawer upstream of plans | [research-mode.js](../control/lib/mcp/tools/research-mode.js) |
| 10 | **Creative mints — the whole studio.** Re-cut by FORM rather than listed flat: `get_creative_toolset` (no arg → the form map; `{ form }` → that form's tools) is the reader, and `get_tool_index` points at it instead of enumerating. | [creative-forms.js](../control/lib/mcp/creative-forms.js), [context.js](../control/lib/mcp/tools/context.js) |

Ring number is a poor proxy for weight — Ring 10 carries eleven packs behind one folded reader, while Rings 1–4 may not exist on a given host at all. **Ring 11** ("operations view") is deprecated; it survives only as internal naming in [ops-tags.js](../control/lib/db/repositories/ops-tags.js).

**Why `forward_context` matters.** The `initialize` preamble surfaced to the connecting model is deliberately *tiny* — it names the five paradigms with their entry tools — Media and Game leading, Bot flagged as an opt-in pack that may be absent — then points at `forward_context`. `forward_context` is itself a **thin routing index** (pinned by the body-ceiling test in `context.test.js`, ~2.5K tokens), not a full briefing: a lean opener, a `user-framing → entry-tool` table, a directory of drawers, and the standing safety + commitment rules. Its Create-things section is a **mini segmented index** — one row per FORM (picture / object / world / motion / audio / game / publication) naming recognizers + entry tool; the full per-family routing rows (recognizer quotes + fork sentences) live as **routing cards** under [lib/mcp/routing-cards/](../control/lib/mcp/routing-cards/), indexed as `routing` in semantic recall and returned *whole* by `semantic_search({kinds:['routing']})` (no follow-up reader). The rest of the heavy content drawerizes behind sibling Ring 0 tools the agent pulls only when a task needs depth — `get_register_kit` (concept glossary + narration register), `get_tool_index` (the full one-line-per-tool index), `get_deliberation_overview` (the Ring 6 structural model), `get_creative_toolset` (one creative FORM's tools), `get_ui_map` (dashboard pages), `get_substrate` (PLAYful Cloud / cloud-comparison positioning). Most tool descriptions in `tools/list` self-route, so the agent often routes from the outer layers (preamble + tool descriptions + this index) without drilling further. **When you add a tool, the routing index and tool index in [context.js](../control/lib/mcp/tools/context.js) must be updated** — a missing entry leaves the connecting agent flying blind; the registry-sweep test in `context.test.js` enforces this (every listed tool name must appear in `TOOL_INDEX`; unlisted deprecated aliases are exempt). A new `create_view` kind or `compose_world` base is NOT a new tool — it needs a view-vocab card under [lib/graph/views/view-vocab/](../control/lib/graph/views/view-vocab/), not an index row; a kind contributed by an attached recipe book needs neither, since its card travels with it. A new **creative capability** needs a routing card + fixture rows in the retrieval eval ([routing-eval.integration.test.js](../control/lib/mcp/routing-cards/routing-eval.integration.test.js) — paraphrased phrasings → expected entry tool against the real local embedder), NOT a new fat Create-things row. See [tool-list-drawerization.plan.md](../control/lib/mcp/tools/tool-list-drawerization.plan.md).

**Standing secrets rule.** The initialize preamble also tells the connecting agent: treat `.env` files under `$MOJULO_HOME`, inside any generated app directory, and inside any unzipped mojulo bot as user secrets. Use the masking helpers or the purpose-built inspectors (`inspect_bot_env` returns masked values; `list_env` / `set_env` for app runtimes). The agent must never `cat`, `Read`, or echo raw `.env` contents.

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

### 3a. Tool-call telemetry (observability)

The `tool.handler(input, ctx)` step above is wrapped by a single instrumentation seam, `instrumentedInvoke` in [`lib/mcp/telemetry.js`](../control/lib/mcp/telemetry.js). Both handler entry points route through it — `handleToolCall` (rpc `tools/call`) and `invokeRegisteredTool` (the plan-mode executor) — so every invocation, including future transports, is timed and recorded from one place. Each call emits one structured stderr line (`[mcp] tool=… ms=… ok via=rpc session=…`) and one `mcp_tool_calls` row.

**What is recorded:** tool name (the name *as called* — an alias records the alias, not its canonical target), `via`, session id, client name/version (from `rememberClientInfo`), start time, duration, status (`ok` / `error` / `timeout` / `late_settle`), a truncated error message on the error path, and the input's **shape** — top-level key *names* plus serialized byte size — and the result byte size.

**What is deliberately NOT recorded:** input *values* and conversation content. Telemetry stores shapes and sizes only. The one exception is the explicit debug flag `MOJULO_MCP_TELEMETRY_CAPTURE=full`, which additionally stores truncated (~4KB) input/result JSON into nullable columns — off by default, documented with the secrets warning in `.env.example`. This upholds the same data-locality rule as the rest of the substrate: the control DB describes tool *calls*, never the conversations behind `get_conversation` and friends.

**Soft timeout:** `MOJULO_MCP_TOOL_TIMEOUT_MS` (default 120s; per-tool override via `registerTool({ timeoutMs })`). JS can't cancel a running handler, so on expiry the seam unblocks the session with an `isError` result, records a `timeout` row, and attaches a watcher to the orphaned promise — when it finally settles, a second `late_settle` row records the true duration. `timeout` + `late_settle` distinguishes "slow" from "hung forever" after the fact. Long-running work should use the async jobs ring (`{ jobId }`) rather than a raised budget.

**Retention:** `pruneMcpToolCalls` keeps ≤30 days and ≤50k rows (whichever bounds tighter), run on startup init and piggybacked on `scripts/cleanup-stale-artifacts.js`.

**Read surfaces:** the `get_tool_telemetry` tool (in-session: aggregates + recent errors, or one tool's recent calls), the `/observability` dashboard page, and `GET /api/mcp-telemetry`. Flags: `MOJULO_MCP_TELEMETRY=off` disables recording entirely.

---

## 4. Ring 6 in detail

Ring 6 is the deliberation layer. Where Rings 1–5 do work (design, deploy, read, recommend recipes), Ring 6 records **why** structural decisions were made, what the operator's environment looks like, what vendors are known to support what, what compositions have been proposed, what artifacts have been bound — and lets the agent recall any of it.

### 4a. Contextmap — `meta_context_brief` / `meta_context_commit`

Writeable, durable, append-only. Records *why* this artifact was materialized via that adapter for this subject, what locked-in constraints the operator declared, what mapping decisions a specific binding encodes.

Six structural commit types:

- **`operator_kyc`** — optional one-time bootstrap when the operator declares their situation up front.
- **`operator_workspace_setup`** — records `workspace_root` + `workspace_conventions` for local-storage technique bindings; append-only.
- **`artifact_materialization`** — bot-shaped catalyst flow. One atomic commit per materialization.
- **`primitive_artifact_materialization`** — no-bot primitive-binding flow. Records the artifact → bound MCP tools audit chain.
- **`app_materialization`** — App paradigm SPA + four bindings.
- **`trigger_artifact_materialization`** — composer-anchored activation binding via `bind_trigger`.

Writes happen at **structural events only**, never at outcome events — outcomes (a conversation, an automation run) happen at run-rate; structural decisions (a fleet pivot, an artifact being materialized) happen at deliberation-rate. The asymmetry is what makes the layer auditable.

Adapter-delegated verification runs before each commit ([meta-context/verification.js](../control/lib/mcp/meta-context/verification.js)): claude-code/generic require `existsSync` against the materialized path; codex accepts opaque automation handles on the agent's assertion (deliberate MVP relaxation).

Source: [meta-context.js](../control/lib/mcp/tools/meta-context.js). Full spec: [meta-context.md](meta-context.md).

### 4b. Inventory — `meta_context_declare_inventory`

Replace-semantic current-state cache of the connecting agent's MCP environment: which servers are connected, which tools they expose, optionally with per-tool `inputSchema` + `introspectionConfidence` (richer-snapshot mode used by primitive binding).

Sits **alongside** the append-only contextmap on purpose: inventory is *present environment*, not a sealed decision, so it gets DELETE+INSERT semantics in one transaction. This is the entry point for using mojulo without deploying a chatbot — once inventory is declared, MCP-to-MCP workflows have something to compose against.

A compact snapshot rides on `meta_context_brief({kind:'fleet'})` as `inventory.{servers, declaredAt, ageSeconds, toolCount}` so a single brief call yields both deliberation history and environment shape.

Source: [mcp-inventory.js](../control/lib/mcp/tools/mcp-inventory.js).

### 4c. Capabilities — `record_mcp_capabilities` / `get_mcp_capabilities`

The **research facet** of a provider, sibling to inventory's introspection facet. `record_mcp_capabilities` writes a vendor knowledge body (frontmatter + prose + cited URLs) for one canonical `provider_ref` with transactional supersession preserving full history; `get_mcp_capabilities` reads the current row or walks the chain via `asOf`.

Both write into provider rows on a **shared identity layer** (`meta_mcp_providers`) — one logical "Gmail" in mojulo regardless of which path arrived at it. Mojulo ships four seeded vendor bodies on first install (gmail, notion, linear, google_drive) honestly attributed via `source_urls[0]=mojulo://CHANGELOG#v0.5.0`; the [research-mcp-vendor catalyst](../control/lib/mcp/catalysts/research-mcp-vendor.md) refreshes them.

Source: [mcp-capabilities.js](../control/lib/mcp/tools/mcp-capabilities.js). Seed bodies: [seeds/mcp-capabilities/](../control/lib/mcp/seeds/mcp-capabilities/).

### 4d. mcp-orbit composer — `list_mcp_orbit_components` / `get_mcp_orbit_component` / `get_meta_catalyst` / `recommend_mcp_orbit_compositions`

Sits **on top of** contextmap + inventory + capabilities through a consolidated view (`CapabilitiesRepository.consolidatedView`). Decomposes the connected-service workflow space into five typed component kinds (`mcp` × `trigger` × `pattern` × `idempotency` × `render`) the agent composes under the meta-catalyst's discipline. The server provides components + constraint validation; the agent provides judgment.

`source` and `destination` are **composition roles** carried per-entry in `component_refs`, not kinds — each `mcp` component declares an `affordances` map (`read` / `write` / `watch`) and plays whichever role its affordances support, so the same Gmail MCP can play source in one composition and destination in another.

Five composer states per chosen provider (`research` / `seed` / `inventory_only` / `capabilities_only` / `none`) each surface as their own warning tag so the agent routes remediation directly. Every recommendation persists as a `proposed` composition row so the deliberation log itself is auditable; on materialization, `meta_context_commit` records the composition ref in an artifact-scope principle as the durable link between the artifact and the components it was built from.

Source: [mcp-orbit.js](../control/lib/mcp/tools/mcp-orbit.js). Full spec: [mcp-orbit.md](mcp-orbit.md).

### 4e. Primitive binding — `bind_primitives`

The **runtime-introspected composer** for MCP-to-MCP workflows. Takes a vendor-agnostic primitive (`document-store`, `structured-record-store`, `messaging-channel`, `message-thread`) + a composition role (`source` | `destination`) + a server from declared inventory + an affordance→tool bindings map, runs the deterministic generator in [mcp-orbit-components/generator.js](../control/lib/mcp/mcp-orbit-components/generator.js), and persists the result in `mcp_orbit_provider_artifacts` as a session-scoped provider artifact (`prov_<id>`).

The artifact's body is the primitive's role template filled with the **actual bound tool names + schemas from the operator's installed MCP** — not a curated guess. Graduates via `meta_context_commit({type:'primitive_artifact_materialization', ...})`.

This is the **supported path** for composing MCP-to-MCP workflows from typed primitives; the vendor-shaped `recommend_mcp_orbit_compositions` flow remains as a seed-reasoning surface for first-encounter scaffolding. The four primitives live in [mcp-orbit-components/primitive/](../control/lib/mcp/mcp-orbit-components/primitive/) as body + source-role template + destination-role template triples.

Source: [mcp-primitive-binding.js](../control/lib/mcp/tools/mcp-primitive-binding.js).

### 4f. Trigger binding — `bind_trigger` / `unbind_trigger` / `list_triggers` / `get_trigger`

Composer-anchored activation. Takes a typed `component_ref` from the orbit composer (Phase 1 ships `trigger/scheduled@0.1.0`), validates `binding_params` (cron parsed at bind time), and persists in `mcp_orbit_trigger_artifacts` as a session-scoped trigger artifact (`trig_<id>`). Graduates via `meta_context_commit({type:'trigger_artifact_materialization', ...})`.

The scheduler daemon at [control/lib/triggers/scheduler.js](../control/lib/triggers/scheduler.js) is gated by `MOJULO_TRIGGER_RUNTIME=enabled` (symmetric with `MOJULO_APP_RUNTIME`). On each fire it renders the payload template, calls `parkRequestForTrigger` (fire-and-forget sibling to `parkRequest`), and writes a `trigger_firing` principle on the target artifact node. The audit chain `trigger_firing → app_inference → trigger_firing → app_inference` on an artifact node tells the full story of each autonomous cycle.

Adding a new trigger kind = ship a typed component + its runtime daemon; the bind tool needs no per-kind code branch.

Source: [mcp-trigger-binding.js](../control/lib/mcp/tools/mcp-trigger-binding.js).

### 4g. Semantic recall — `semantic_search`

**Fuzzy lookup over durable mojulo state** — the recall counterpart to the five structured readers above. Backed by a single embedding sidecar table (`meta_embeddings`) keyed on `(source_kind, source_ref)` and populated atomically alongside every source-row write through the split sync/async helpers in [repositories/embeddings.js](../control/lib/db/repositories/embeddings.js).

Covers seven source kinds: `principle`, `mcp_tool` (declared inventory), `mcp_capability` (current row only — supersession filter is load-bearing), `orbit_component`, `orbit_composition`, `orbit_artifact`, `catalyst`. Returns ranked `{ source_kind, source_ref, score, snippet }` rows — *retrieve, don't resolve*; the agent pairs results with the structured readers to pull full bodies.

Embeddings use an in-process multilingual-e5-small ONNX model — the same one the optional bot runtime uses for its own RAG, so no new dependency either way. First-boot backfill via `maybeBackfillEmbeddings` in [db/index.js](../control/lib/db/index.js); `MOJULO_SEMANTIC_INDEX_DISABLED=1` skips the auto-run, and [scripts/reindex-embeddings.js](../control/scripts/reindex-embeddings.js) is the manual recovery / body-composition-change path.

Source: [semantic-search.js](../control/lib/mcp/tools/semantic-search.js).

---

## 5. Session and identity

**Single-operator posture.** By default every call is scoped to `userId='local'` — there is no user identity (see [auth/service.js](../control/lib/auth/service.js)). With the opt-in roles pack enabled, the presented bearer resolves to an operator-issued key with its own scoped identity; this is operator-owned delegation (the operator cutting keys to their own house), never multi-tenant identity — there is exactly one owner, and every key is operator-issued and operator-revocable.

**Creative tools are stateless per call.** Minting, editing, and exporting take a `ref` and return one; nothing is threaded through a session object. `forward_context`'s `mode` is likewise stateless per call. The state that matters lives in the row, not in the connection — which is what lets a session die mid-work and the next one pick the recipe up by `ref`.

**Builder-session binding (chatbot pack).** The one flow that *does* bind per-connection state is the bot builder, which threads a `BuilderSession` per `mcp-session-id`. It ships with the optional pack; the mechanism, its in-memory binding map, and the LLM-key requirement are documented at [docs/chatbot/AGENT-REFERENCE.md](chatbot/AGENT-REFERENCE.md#builder-session-binding).

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

Catalysts (Ring 5) are curated workflow recipes shipped as markdown in [control/lib/mcp/catalysts/](../control/lib/mcp/catalysts/). The connecting agent pulls one via `get_catalyst`, combines it with the shape of whatever it is operating on and the user's already-installed MCPs, and **synthesizes a runnable artifact** through the host adapter — a Claude Code skill at `.claude/skills/<name>/SKILL.md`, a Codex automation, or a generic `workflow.md`. The catalyst is the nucleation point, not the artifact — it persists in the library, the synthesized skill is what actually runs.

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
| `mcp_orbit_trigger_artifacts` | trigger binding | Session-scoped activation bindings (`trig_<id>`) — `component_ref`, `binding_params_json`, `payload_template_json`. Unique partial index on `(composition_ref, artifact_ref, component_ref)`. |
| `meta_embeddings` | semantic recall | One row per `(source_kind, source_ref)` across the seven indexed kinds. Raw `float32[384]` BLOB embedding, `content_hash` skip-on-unchanged, `model` column reserved for future model swaps. |
| `plans` | plan mode | Proposed/speculative layer (`status`: draft→actionable→executing→executed/failed). JSON columns for manifest, frame, analysis, revision log, execution log. `archived` / `release_json` set when a plan graduates to contextmap. |
| `research_sessions`, `research_items` | research mode | Durable research book. Items have freeform `kind` (link / article / summary / screencap / note / quote / snippet). |
| `research_abstracts` | research mode | Append-only synthesis history. `plan_ref` + `assessment_json` backfilled when abstract is evaluated by plan mojulo. |

Migration is in the migration block in [db/index.js](../control/lib/db/index.js).

---

## 9. Key files

| File | Role |
|------|------|
| [control/app/api/mcp/route.js](../control/app/api/mcp/route.js) | HTTP transport + bearer auth; forwards JSON-RPC into server.js |
| [control/lib/mcp/server.js](../control/lib/mcp/server.js) | Protocol dispatch, tool registry, initialize preamble |
| [control/lib/mcp/session-binding.js](../control/lib/mcp/session-binding.js) | `mcpSessionId` → `BuilderSession` lazy binding *(chatbot pack)* |
| [control/lib/mcp/client-bindings.js](../control/lib/mcp/client-bindings.js) | `clientInfo` capture for host-adapter auto-resolution |
| [control/lib/mcp/jobs.js](../control/lib/mcp/jobs.js) | Async job state machine for Ring 2 (deploy/rebuild from short-lived MCP clients) *(chatbot pack)* |
| [control/lib/mcp/tools/context.js](../control/lib/mcp/tools/context.js) | Ring 0 — `forward_context`. The tool index lives here; keep it in sync when adding tools |
| [control/lib/mcp/tools/adapters.js](../control/lib/mcp/tools/adapters.js) | Ring 0 — `get_adapter` (host adapter binding) |
| [control/lib/mcp/tools/build.js](../control/lib/mcp/tools/build.js) | Ring 1 — wraps `BuilderSession` + tool-executors *(chatbot pack)* |
| [control/lib/builder/tool-executors.js](../control/lib/builder/tool-executors.js) | The shared builder handlers — same for MCP and web chat *(chatbot pack)* |
| [control/lib/mcp/tools/jobs-tools.js](../control/lib/mcp/tools/jobs-tools.js) | Ring 2 — `create_job`, `get_job_status` *(chatbot pack)* |
| [control/lib/mcp/tools/operate.js](../control/lib/mcp/tools/operate.js) | Ring 3 — per-bot reads (all through bot-proxy) *(chatbot pack)* |
| [control/lib/deployers/bot-proxy.js](../control/lib/deployers/bot-proxy.js) | `normalizeBotUrl`, `probeBotConnection`, `fetchFromBot` — used by Ring 3 *(chatbot pack)* |
| [control/lib/mcp/tools/fleet.js](../control/lib/mcp/tools/fleet.js) | Ring 4 — cross-bot rollups + SQL Explorer *(chatbot pack)* |
| [control/lib/fleet/scoped-sql.js](../control/lib/fleet/scoped-sql.js) | Fresh in-memory SQLite per SQL Explorer query; SELECT/WITH only, single statement, row + duration caps *(chatbot pack)* |
| [control/lib/deployers/bot-fleet.js](../control/lib/deployers/bot-fleet.js) | Fans the per-bot proxy across all connected deployments (timeout + concurrency capped) *(chatbot pack)* |
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
| [control/lib/mcp/tools/mcp-trigger-binding.js](../control/lib/mcp/tools/mcp-trigger-binding.js) | Ring 6 — `bind_trigger` / `unbind_trigger` / `list_triggers` / `get_trigger` |
| [control/lib/triggers/scheduler.js](../control/lib/triggers/scheduler.js) | Scheduler daemon for `trigger/scheduled` artifacts; gated by `MOJULO_TRIGGER_RUNTIME=enabled` |
| [control/lib/mcp/tools/semantic-search.js](../control/lib/mcp/tools/semantic-search.js) | Ring 6 — `semantic_search` |
| [control/lib/db/repositories/embeddings.js](../control/lib/db/repositories/embeddings.js) | Split sync/async helpers that keep `meta_embeddings` in lockstep with source writes |
| [control/scripts/reindex-embeddings.js](../control/scripts/reindex-embeddings.js) | Manual recovery / body-composition-change path |
| [control/lib/mcp/tools/runner.js](../control/lib/mcp/tools/runner.js) | Ring 7 — app lifecycle tools (`install_scaffold`, `start_app`, `stop_app`, `status_app`, `list_running`, env CRUD) |
| [control/lib/mcp/packs.js](../control/lib/mcp/packs.js) | The 20-pack roster — wing, installGroup, members. The grouping the agent sees (§2) |
| [control/lib/mcp/creative-forms.js](../control/lib/mcp/creative-forms.js) | The creative-mint FORM enum behind `get_creative_toolset` (Ring 10) |
| [control/lib/mcp/routing-cards/](../control/lib/mcp/routing-cards/) | Per-capability routing cards, returned whole by `semantic_search({kinds:['routing']})` |
| [control/lib/runners/local.js](../control/lib/runners/local.js) | Loopback HTTP client; lifecycle verbs proxy to the daemon, env CRUD stays local filesystem |
| [control/lib/runners/engine.js](../control/lib/runners/engine.js) | App runtime engine inside the daemon |
| [control/lib/mcp/tools/agent-tasks.js](../control/lib/mcp/tools/agent-tasks.js) | Ring 7 — `pull_agent_task`, `submit_envelope_inference`, `cancel_agent_task` |
| [control/lib/mcp/agent-tasks/queue.js](../control/lib/mcp/agent-tasks/queue.js) | In-memory FIFO single-claim queue; `parkRequest` / `parkRequestForTrigger` entry points |
| [control/lib/mcp/tools/plan-mode.js](../control/lib/mcp/tools/plan-mode.js) | Ring 8 — plan mode tools (`enter_plan_mode`, `forge_plan`, `compile_plan`, `execute_plan`, `list_plans`, `get_plan`) |
| [control/lib/mcp/meta-context/plan-release.js](../control/lib/mcp/meta-context/plan-release.js) | One-way plan→contextmap bridge; writes `plan_release` principles and archives plans on materialization |
| [control/app/plan/page.jsx](../control/app/plan/page.jsx) | Dashboard plan inbox (read-only; archived plans hidden behind toggle) |
| [control/lib/mcp/tools/research-mode.js](../control/lib/mcp/tools/research-mode.js) | Ring 9 — research mode tools (`enter_research_mode`, `start_research`, `bind_research_item`, `synthesize_abstract`, `get_research`, `list_research`) |
| [control/lib/research/evaluate.js](../control/lib/research/evaluate.js) | Shared research→plan evaluator; also surfaced at `POST /api/plans/from-abstract` |

---

## 10. Related docs

**The substrate:**

- [AGENT-REFERENCE.md](AGENT-REFERENCE.md) — the dense agent-facing map: the creative substrate, packs and gating, rings, data layout
- [POLYGONIZER-SYNTHESIS.md](POLYGONIZER-SYNTHESIS.md) — the geometry substrate the studio tools mint into
- [install-capabilities.md](install-capabilities.md) — kernel, always-on packs, and the two install groups (§2's source of truth)
- [bicycles.md](bicycles.md) — the machine-gate / eyes-gate doctrine every handoff runs

**The control surface:**

- [mcp-integration.md](mcp-integration.md) — client setup (Claude Desktop, Claude Code, Codex), enabling `/api/mcp`, the bearer-key model
- [meta-context.md](meta-context.md) — full spec for the contextmap layer (the bright line, write triggers, the graph)
- [mcp-orbit.md](mcp-orbit.md) — full spec for the vendor-shaped composer and the primitive-binding companion
- [catalysts.md](catalysts.md) — what a catalyst is, the frontmatter contract, the author spec
- [app-runtime.md](app-runtime.md) — Ring 7 app runner daemon: lifecycle, reconciliation, env CRUD, daemon posture

**Optional chatbot pack** — Rings 1–4, absent from a default install. Start at [docs/chatbot/](chatbot/):

- [chatbot/AGENT-REFERENCE.md](chatbot/AGENT-REFERENCE.md) — the pack's dense reference, including builder-session binding
- [chatbot/BOT-ARCHITECTURE.md](chatbot/BOT-ARCHITECTURE.md) — how the artifact is compiled and what runs inside it
- [chatbot/chat-builder.md](chatbot/chat-builder.md), [chatbot/wizard-builder.md](chatbot/wizard-builder.md) — the other two entry points onto `buildDeploymentConfig()`
- [chatbot/conversations-api.md](chatbot/conversations-api.md) — the bot-side API that Ring 3 proxies through
- [chatbot/federated-routing.md](chatbot/federated-routing.md) — cross-bot handoffs and how the tamper-evident chain extends through them
