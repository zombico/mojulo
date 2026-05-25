# meta_context — the deliberation surface

`meta_context` is mojulo's Ring 6 MCP surface: a writeable, durable layer that records *why* structural decisions were made. It answers questions like:

- "Why does bot-3 route field X to tool Y?"
- "Why is this catalyst materialized as a Codex automation instead of a Claude Code skill?"
- "What catalysts have I materialized across the fleet, and via which host adapter?"
- "What constraints did the operator lock in for this fleet?"

The materialized artifact (a Claude Code `SKILL.md`, a Codex automation, a generic `workflow.md`) is the *execution* of an outcome. `meta_context` is the *codified reasoning* that led to it. Artifacts run; `meta_context` persists.

For the design rationale see [lite-template/integration/META_CONTEXT_PLAN_v3.md](../lite-template/integration/META_CONTEXT_PLAN_v3.md); for the broader MCP control surface see [docs/mcp-integration.md](mcp-integration.md).

---

## The bright line

**Writes happen only at structural events, never at outcome events.**

| Structural (writes allowed)                      | Outcome (writes forbidden)        |
| ------------------------------------------------ | --------------------------------- |
| Operator KYC sealed                              | Artifact fired                    |
| Artifact materialized via adapter                | Conversation occurred             |
| (Post-MVP) New catalyst shipped                  | Transcript ingested               |
| (Post-MVP) New host adapter shipped              | Submission created                |
|                                                  | Automation run completed          |

The connecting agent's **current MCP inventory** is a separate category — present-state, not a sealed decision — so it lives in its own table with replace semantics (see [Inventory (current-state cache, alongside the contextmap)](#inventory-current-state-cache-alongside-the-contextmap) below), not in the append-only contextmap.

This asymmetry is what makes the layer auditable. Outcomes happen at run-rate (every conversation, every automation execution); structural decisions happen at deliberation-rate (a user pivoting their fleet, an artifact being materialized). MVP ships only the two write triggers in the table above — passive triggers stay off until we know what they'd write.

---

## Two layers, one store

**Contextmap (graph).** Typed graph of current bindings.

- **Node kinds:** `bot`, `mcp_tool`, `catalyst`, `adapter`, `artifact`, `operator`. `operator` is a singleton — at most one node per fleet, ref `'self'`.
- **Edge kinds:**
  - `catalyst —seeded→ artifact` (this artifact was materialized from that catalyst)
  - `artifact —materialized_by→ adapter` (this host adapter produced the artifact)
  - `artifact —runs_for→ bot` (the artifact operates on this bot's data)
  - `artifact —binds→ mcp_tool` (the artifact's runtime depends on this tool; payload carries `fields_bound`)

The graph answers questions like "what artifacts bind to HubSpot?", "which catalysts have been materialized into Codex automations vs Claude Code skills?", "what artifacts run against bot-3 and why?".

**Principles (rationale).** Markdown attached to a node or an edge, recording the *why* at materialization time. Format convention: lead with the decision, then a **Context:** line (what prompted it) and an **Applies to:** line (scope). The convention isn't enforced in v0 — the loader stores `body_md` verbatim.

---

## Schema

Three tables in [control/lib/db/index.js](../control/lib/db/index.js), accessed via [control/lib/db/repositories/meta-context.js](../control/lib/db/repositories/meta-context.js).

```sql
CREATE TABLE meta_nodes (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('bot', 'mcp_tool', 'catalyst', 'adapter', 'artifact', 'operator')),
  ref TEXT NOT NULL,
  label TEXT NOT NULL,
  payload_json TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(kind, ref)
);

CREATE TABLE meta_edges (
  id INTEGER PRIMARY KEY,
  src_id INTEGER NOT NULL REFERENCES meta_nodes(id) ON DELETE CASCADE,
  dst_id INTEGER NOT NULL REFERENCES meta_nodes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('binds', 'seeded', 'materialized_by', 'runs_for')),
  payload_json TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(src_id, dst_id, kind)
);

CREATE TABLE meta_principles (
  id INTEGER PRIMARY KEY,
  scope_kind TEXT NOT NULL CHECK(scope_kind IN ('node', 'edge')),
  scope_id INTEGER NOT NULL,
  body_md TEXT NOT NULL,
  source_event TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

`UNIQUE(kind, ref)` on `meta_nodes` makes upserts idempotent — re-materializing the same artifact reuses the same artifact node and just stacks new principles. `UNIQUE(src_id, dst_id, kind)` on `meta_edges` does the same for relationships. Principles are append-only; multiple principles per scope are expected, and the most-recent-first display convention is left to consumers.

Artifact refs are composite: `${adapter_id}:${locator}`. The same locator under two adapters (e.g. a `workflow.md` path that exists under both `generic` and `codex` with different runtime semantics) needs two artifact nodes — adapter is part of the artifact's identity.

---

## MVP tool surface

Two tools, registered as Ring 6 after catalysts (see [control/lib/mcp/server.js](../control/lib/mcp/server.js)):

### `meta_context_brief`

Read the contextmap subgraph + principles for a scope.

```jsonc
// Whole-fleet brief
{ "scope": { "kind": "fleet" } }

// Per-scope brief (1-hop neighborhood around the named node)
{ "scope": { "kind": "bot", "ref": "deploy-123" } }
{ "scope": { "kind": "catalyst", "ref": "qualify-lead-to-crm" } }
{ "scope": { "kind": "adapter", "ref": "claude-code" } }
{ "scope": { "kind": "artifact", "ref": "claude-code:.claude/skills/qualify-lead/SKILL.md" } }
```

Returns `{ nodes, edges, principles, meta }`. The `meta` block carries hints:

- `meta.empty: true` — no nodes at all.
- `meta.suggest_kyc: true` — the operator node is missing. Set on an empty fleet brief, AND on any per-scope brief whose anchor doesn't exist when no operator node has been committed yet. Cue for the agent to surface the bootstrap KYC.
- `meta.capped: true, meta.nodeCap: 500` — fleet brief truncated at the in-process cap (raise if it becomes a real ceiling rather than premature optimization).

**When to call:**
- Wondering "has the fleet already committed to something related to what I'm about to do?" before materializing an artifact.
- User asks "why does bot-3 route field X to tool Y?" or "why is this a Codex automation and not a skill?"
- First-session orientation against the fleet to discover whether the operator anchor exists.

**When NOT to call:**
- Routine orientation (use `forward_context`).
- Operational metrics (use Ring 4 `fleet_*`).
- Content questions (use Ring 3 `operate.*`).
- Looking up an adapter's shape (use Ring 0 `list_adapters` / `get_adapter`).

### `meta_context_commit`

Seal a structural decision. One verb, dispatches by `type`. MVP supports three types: `operator_kyc` (bootstrap), `artifact_materialization` (bot-shaped catalyst flow), and `primitive_artifact_materialization` (no-bot primitive-binding flow).

#### `operator_kyc`

Optional one-time bootstrap that anchors the fleet on role + primary goal + locked-in constraints. The first commit creates the singleton operator node and one principle.

```json
{
  "type": "operator_kyc",
  "role": "Agency owner serving dental practices in the Pacific Northwest.",
  "primary_goal": "Convert dental leads to booked appointments via SMS-first triage.",
  "constraints": [
    "CRM is HubSpot — do not propose alternatives without explicit override.",
    "Connecting agent is Claude Code.",
    "All bots must capture HIPAA-relevant fields with consent prompts."
  ]
}
```

Rejection conditions:
- Missing `role` or empty `constraints` → throws.
- Operator node already exists and the commit lacks `revise: true` → returns `{ ok: false, existing_operator: true, reason: 'operator_anchor_already_exists', hint: '…' }`. Soft rejection so the agent can confirm the pivot with the user and retry.

With `revise: true`, the commit stacks a new principle on the same operator node (old one stays for audit) and updates the operator label to the new role.

#### `artifact_materialization`

Atomic per-materialization seal. Run only AFTER materializing the artifact on disk / in the host substrate.

```json
{
  "type": "artifact_materialization",
  "adapter_id": "claude-code",
  "artifact": {
    "locator": "/abs/path/to/.claude/skills/qualify-lead/SKILL.md",
    "label": "Qualify Lead to CRM"
  },
  "bot_ref": "dep_abc-123",
  "catalyst_ref": "qualify-lead-to-crm",
  "bindings": [
    { "mcp_tool": "hubspot.create_contact", "fields_bound": ["name", "email", "phone"] }
  ],
  "principles": [
    {
      "scope": "artifact",
      "body_md": "Route qualified leads to HubSpot contacts.\n\n**Context:** User confirmed HubSpot as CRM.\n\n**Applies to:** All bots with form-gathering."
    },
    {
      "scope": "materialized_by",
      "body_md": "Materialized as Claude Code skill because the connecting agent was Claude Code.\n\n**Context:** clientInfo.name='claude-code' at session start.\n\n**Applies to:** This artifact only."
    }
  ]
}
```

Behavior:
1. Resolve adapter — `adapter_id` must exist in the adapter catalog ([loader.js](../control/lib/mcp/adapters/loader.js)).
2. Adapter-delegated verification (below). Failure rejects before any DB writes.
3. Resolve bot — `bot_ref` must match a deployment row.
4. In one transaction: upsert bot / adapter / catalyst / artifact / mcp_tool nodes, upsert edges (`seeded`, `materialized_by`, `runs_for`, one `binds` per binding), insert principles attached to the appropriate scopes.
5. Returns `{ ok: true, artifactNodeId, nodes, edges, principlesCreated, verification, warnings? }`.

`warnings: ['no_operator_anchor']` is appended when the commit succeeds but no operator node exists yet — cue for the agent to offer the KYC inline.

**Principle scopes:** `'artifact' | 'catalyst' | 'adapter' | 'bot'` map to node ids; `'seeded' | 'materialized_by' | 'runs_for'` map to the specific edge ids the commit just inserted; `'binds'` fans out to every binding edge; `'binds:<mcp_tool_ref>'` targets one specific binding edge.

#### `primitive_artifact_materialization`

Sibling commit path for the **no-bot primitive-binding flow** (see [docs/mcp-orbit.md#the-primitive-binding-layer](mcp-orbit.md#the-primitive-binding-layer)). Where `artifact_materialization` records "this catalyst was materialized into this artifact for this bot," `primitive_artifact_materialization` records "this composition intent was materialized into this artifact from these bound primitive artifacts" — bot-independent, with the audit chain pointing at the `prov_<id>` refs returned from `bind_primitives` calls rather than at a catalyst id.

```json
{
  "type": "primitive_artifact_materialization",
  "adapter_id": "claude-code",
  "artifact": {
    "locator": "/abs/path/to/.claude/skills/weekly-linear-digest/SKILL.md",
    "label": "Weekly Linear digest to Drive"
  },
  "composition_intent": "Weekly digest of open Linear issues into a Google Drive folder, Monday 9am.",
  "provider_artifact_refs": ["prov_abc12345", "prov_def67890"],
  "principles": [
    {
      "scope": "artifact",
      "body_md": "Operator confirmed Monday 9am cadence and the gdrive-projects folder scope.\n\n**Context:** KYC names Drive as the primary documentation surface.\n\n**Applies to:** This composition only."
    }
  ]
}
```

Behavior:
1. Resolve adapter — `adapter_id` must exist in the adapter catalog.
2. Adapter-delegated verification on the artifact locator (same rules as `artifact_materialization`).
3. Resolve provider artifacts — every ref in `provider_artifact_refs` must exist in [mcp_orbit_provider_artifacts](mcp-orbit.md#schema); resolution fails the commit if any are missing.
4. In one transaction: upsert the artifact / adapter nodes; insert one `materialized_by` edge from artifact → adapter; insert one `binds` edge per **bound affordance** across all referenced provider artifacts (each carrying `fields_bound = [<primitive>, <role>, <affordance>, <tool>, <confidence>]` in its payload); insert principles attached to scope; **auto-write a summary principle on the artifact node** that records `composition_intent` + the full binding list inline so future readers don't need to dereference the `prov_*` rows to understand what the artifact was built from.
5. Returns `{ ok: true, artifactNodeId, nodes, edges, principlesCreated, verification, warnings? }`.

There is **no** `runs_for` edge — no bot in the picture. There is **no** `seeded` edge — no catalyst nucleated the artifact; primitives + bound tools are the substrate. The audit chain reads as: composition_intent (in the auto-principle) → primitive artifacts (named in the principle, persisted in `mcp_orbit_provider_artifacts`) → bound MCP tools (one `binds` edge per affordance).

If commit fails (adapter-rejection, missing provider artifact, scope error), roll back the materialization via the host adapter's affordance — same rule as `artifact_materialization`.

---

## Inventory (current-state cache, alongside the contextmap)

The contextmap above is append-only by design. The connecting agent's **current MCP inventory** — which servers are connected to its Claude Code (or other MCP client) session and which tools each exposes — is a different kind of fact: present-state, not a sealed decision. Forcing it into the append-only graph would let it slowly diverge from the operator's actual environment.

So inventory lives in its own table with **replace semantics**:

```sql
CREATE TABLE meta_mcp_inventory (
  id INTEGER PRIMARY KEY,
  server TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  tool_ref TEXT NOT NULL,           -- canonical "${server}.${tool_name}"
  description TEXT,
  declared_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(server, tool_name)
);
```

The contextmap's `mcp_tool` node kind is unchanged — those nodes are still created **only at binding time** (`artifact_materialization`), recording "this artifact was sealed against this tool ref" as a frozen decision. The inventory table is independent: it records "as of the latest declaration, the operator has these tools available." Cross-referencing the two is what surfaces stale bindings.

### `meta_context_declare_inventory`

Replace-semantic write, sibling to `meta_context_commit`. In one transaction: `DELETE FROM meta_mcp_inventory; INSERT` the declared snapshot.

```jsonc
{
  "servers": [
    {
      "name": "gmail",
      "tools": [
        { "name": "send_message", "description": "Send a Gmail message" },
        { "name": "search_messages" }
      ]
    },
    { "name": "gdrive", "tools": [{ "name": "list_recent_files" }] }
  ]
}
```

Returns `{ ok: true, serversSeen, toolsSeen, replaced, declaredAt, warnings? }`. `warnings: ['no_operator_anchor']` is appended when no operator KYC has been committed yet — inventory still saves; the warning is a cue to surface KYC inline.

Pass `servers: []` to explicitly wipe the inventory.

**When to call:**
- At session start if the environment may have changed since the last declaration (new MCP installed, one removed, server reconnected).
- Before materializing a catalyst-derived artifact that depends on a specific tool being available — re-declare so consumers know the inventory reflects the current moment.

**When NOT to call:**
- As a routine lifecycle event ("about to plan, better re-declare"). MCP is one-way; the connecting agent's environment doesn't change between turns within a single session.

### Freshness — what mojulo can and can't enforce

MCP is one-way; mojulo cannot introspect the client. The honest mitigations:

1. **Replacement semantic.** Latest declaration is authoritative — no partial-merge ambiguity.
2. **`declaredAt` in every read.** Surfaced on fleet briefs (`inventory.declaredAt`, `inventory.ageSeconds`) so callers decide freshness.
3. **Re-declare-at-session-start guidance.** The tool description and the `forward_context` glossary instruct the agent to call again when its environment may have changed.
4. **Downstream freshness checks.** Partially landed: `recommend_mcp_orbit_compositions` emits `inventory_empty` and `inventory_stale` warnings when `toolCount === 0` or `ageSeconds > 7 days` so the agent re-declares before composing. `recommend_catalysts` / `get_catalyst` don't yet enforce a freshness threshold — that's a follow-up.

### Reading inventory off the brief

`meta_context_brief({ kind: 'fleet' })` returns `inventory: { servers, declaredAt, ageSeconds, toolCount }` alongside the contextmap subgraph. When never declared: `{ servers: [], declaredAt: null, ageSeconds: null, toolCount: 0 }`. Per-scope briefs (`{ kind: 'bot', ref: ... }` etc.) do not include `inventory` — it's a fleet-level fact, not a neighborhood property.

---

## What sits on top: composers + capabilities

Contextmap (append-only) and inventory (replace-semantic) are the two Ring 6 primitives this doc covers. Four more Ring 6 surfaces sit on top:

- **Capabilities** — `record_mcp_capabilities` / `get_mcp_capabilities` ([control/lib/mcp/tools/mcp-capabilities.js](../control/lib/mcp/tools/mcp-capabilities.js)). The research facet of a provider, sibling to inventory's introspection facet. Writes vendor knowledge bodies (frontmatter + prose + cited URLs) to `meta_mcp_capabilities` with transactional supersession preserving full history; reads the current row or walks the chain via `asOf`. Both write into the providers identity layer (`meta_mcp_providers`) so the same logical "Gmail" surfaces under one row regardless of which path arrived at it.
- **mcp-orbit composer** — the vendor-shaped composer (`recommend_mcp_orbit_compositions` etc.) reads inventory to pre-filter what compositions are possible, reads capabilities + contextmap to pull operator KYC and prior materializations into ranking, and writes back into the contextmap via `meta_context_commit({type:'artifact_materialization', ...})` when a composition materializes. Composition itself is logged in `mcp_orbit_compositions`.
- **Primitive binding** — `bind_primitives` ([control/lib/mcp/tools/mcp-primitive-binding.js](../control/lib/mcp/tools/mcp-primitive-binding.js)). The runtime-introspected composer that composes MCP-to-MCP workflows from four vendor-agnostic primitives (`document-store`, `structured-record-store`, `messaging-channel`, `message-thread`) bound to runtime-introspected MCPs. Persists session-scoped provider artifacts in `mcp_orbit_provider_artifacts`; graduates via `meta_context_commit({type:'primitive_artifact_materialization', ...})`. The supported path for composing from typed primitives; the vendor-shaped composer above remains as the seed-reasoning surface for first-encounter scaffolding.
- **Semantic recall** — `semantic_search` ([control/lib/mcp/tools/semantic-search.js](../control/lib/mcp/tools/semantic-search.js)). Fuzzy lookup over a unified embedding sidecar (`meta_embeddings`) covering seven source kinds: principles, declared MCP inventory tools, current capability bodies, mcp-orbit components / compositions / provider artifacts, and the shipped catalyst markdown. Complements the structured readers above — those answer "give me the full row at this ref"; semantic_search answers the other direction, "which refs are even relevant to this intent?" Returns ranked `{ source_kind, source_ref, score, snippet }` rows the agent then resolves through the typed readers. Capability rows that have been superseded never surface — the index quietly filters against the current row per provider. Backed by the same in-process multilingual-e5-small ONNX model that powers bot-side RAG; first call after a control-plane restart pays ~2–4s of model load, subsequent calls sub-50ms at expected corpus size. See [lite-template/integration/SEMANTIC_INDEX_PLAN.md](../lite-template/integration/SEMANTIC_INDEX_PLAN.md) for the full design.

The reading order across all six is: contextmap → inventory → capabilities → composer → primitive-binding → semantic-recall. Reading anything on top of `meta_context` starts with knowing what's been sealed (contextmap), what materials the operator has right now (inventory), and what vendor knowledge has been recorded (capabilities); the two composers consume that triple; semantic recall sits across all five as a fuzzy retrieval layer for when the agent has intent but not yet refs. See [docs/mcp-orbit.md](mcp-orbit.md) for both composers' full specs.

---

## Append-only, by design

The contextmap is **append-only**. Nothing the MVP ships ever deletes nodes, retires edges, or tombstones principles. New principles stack on the same scope (most-recent-first on read); revising operator KYC inserts a new principle alongside the old one; re-materializing an artifact reuses the same node ids and stacks new principles on the same edges.

This means **brief returns the contextmap as *recorded*, not as *currently active***. If the operator runs `rm` against a `SKILL.md`, the `runs_for` and `binds` edges that pointed at it stay in the graph. A future `meta_context_brief({kind:'bot', ref:…})` will still report those edges — they're a historical record of a binding that was sealed, not a live assertion that the binding is in force.

Two consequences worth being deliberate about:

- **The agent must cross-reference before acting on a binding as live.** A skill the brief reports may not exist on disk anymore. The current-state surfaces are the filesystem (for filesystem-shaped adapters) and `list_deployments` (for the bot's existence). The brief tells you what *was decided*; those other surfaces tell you what *is still there*.
- **Cleanup is operator-driven, not system-driven.** When a binding genuinely needs to leave the graph (artifact retired, bot deleted, fleet pivoted), the operator runs SQL directly:

  ```bash
  # remove all rows associated with a specific artifact
  sqlite3 control/data/mojulo-lite.db \
    "DELETE FROM meta_nodes WHERE kind='artifact' AND ref='claude-code:/path/to/SKILL.md'"
  # FK cascade drops associated edges; principles attached via scope_id must be cleared manually
  sqlite3 control/data/mojulo-lite.db \
    "DELETE FROM meta_principles WHERE scope_kind='node' AND scope_id NOT IN (SELECT id FROM meta_nodes)"
  ```

What the MVP explicitly does **not** ship — and isn't planning to — is a deprecation event type, a `retired_at` column, an `artifact_removed` commit, or an auto-pruning sweep. Each would add a state machine ("alive vs retired") to a graph that's currently dead-simple ("present vs absent"), and the operator-owned escape hatch above covers the rare case. If multi-operator deliberation ever ships (post-MVP), this rule gets revisited — at that point an audit trail of *who retired what* matters, and append-only stops being sufficient.

---

## Adapter-delegated verification

v2 assumed every artifact was a file on disk so verification was just `existsSync(skill_path)`. v3 had to absorb adapters whose artifacts may be opaque automation handles (Codex automations) with no local path the control plane can stat. Verification routes through the bound adapter ([control/lib/mcp/meta-context/verification.js](../control/lib/mcp/meta-context/verification.js)):

| Adapter        | Verification rule                                                          |
| -------------- | -------------------------------------------------------------------------- |
| `claude-code`  | `existsSync(locator)` — artifact is a `SKILL.md` on local disk.            |
| `generic`      | `existsSync(locator)` — artifact is a `workflow.md` on local disk.         |
| `codex`        | If locator looks like a filesystem path: `existsSync`. If it's an opaque automation handle: **accept on agent assertion** (deliberate MVP relaxation; response carries `verification.note: 'codex_accept_on_assertion'`). |

Unknown adapter ids are rejected — the adapter loader is the source of truth, and we never seal an artifact node whose host context we can't name.

The accept-on-assertion path is the deliberate MVP relaxation. If misuse surfaces, the post-MVP arbiter can add a "verify" tool the adapter wires to its host (e.g. `automation_list` on Codex). For now, the agent that just materialized the artifact is the trust anchor.

---

## Cross-ring integration

The Ring 5 `recommend_catalysts` tool consults `meta_context` on every call:

- No operator node → response carries `suggest_kyc: true`. Agent should consider offering the one-time KYC before showing picks.
- Operator node present → response carries `operatorAnchor: { role, latestPrinciple }`. Agent uses the locked-in constraints to self-clamp suggestions (e.g. "CRM is HubSpot" → don't lead with Salesforce catalysts).

The actual clamping is left to the agent's judgment — automated filtering needs the post-MVP arbiter.

---

## Worked example — catalyst → adapter → artifact

1. Agent connects via MCP. Control plane auto-binds an adapter via `clientInfo` ([client-bindings.js](../control/lib/mcp/client-bindings.js)).
2. Agent calls `forward_context` (Ring 0) for orientation.
3. Agent calls `meta_context_brief({ scope: { kind: 'fleet' } })` (Ring 6) → returns empty graph with `meta: { empty: true, suggest_kyc: true }`.
4. Agent surfaces the KYC to the user; user answers role + goal + constraints. Agent calls `meta_context_commit({ type: 'operator_kyc', … })`. (Skip 3–4 if the anchor already exists, or skip step 4 if the user declines.)
5. Agent calls `get_adapter()` (Ring 0) to confirm the materialization shape.
6. Agent calls `recommend_catalysts(deploymentId, …)` (Ring 5). Response now carries `operatorAnchor` — agent uses its constraints to clamp suggestions.
7. Agent calls `get_catalyst(id)` (Ring 5) — receives `CATALYST_CORE_PREAMBLE + adapter body + catalyst body`.
8. Agent calls `meta_context_brief({ scope: { kind: 'bot', ref } })` to see existing bindings on this bot.
9. Agent calls Ring 3 readers to inspect the bot's submission shape.
10. Agent materializes the artifact per adapter instructions (writes `SKILL.md` / posts to Codex automation / writes `workflow.md`).
11. Agent calls `meta_context_commit({ type: 'artifact_materialization', adapter_id, … })` — atomic write.

If step 11 fails, the agent rolls back step 10 by the adapter's own affordance (delete the file / cancel the automation).

---

## What does NOT belong in meta_context

- Outcome counts, conversation content (use Ring 3 / Ring 4 / Ring 6 of the bot's SQLite — never copy into the control plane).
- Auto-memory user preferences (lives in the agent's harness, not in mojulo).
- Session state or in-flight work (use `BuilderSession` / `mcp_jobs`).
- Anything inferable from `git log` or current code.
- Speculative "I might do this" records (commits record decisions that were *sealed*, not intentions).
- The adapter catalog itself (lives in [control/lib/mcp/adapters/](../control/lib/mcp/adapters/)) — `meta_context` references adapter ids but doesn't replicate the prose.

The discriminator: **meta_context records decisions that were sealed, not intentions or outcomes.**

---

## UX contract

When a user sees `meta_context_brief` or `meta_context_commit` in a transcript, they should expect:

- 0–3 calls per session, not 12.
- Each call followed by something load-bearing (a planning insight, a sealed binding).
- Clear purpose visible in the parameters.

Tool descriptions reinforce this; agents that lifecycle-call `meta_context_brief` ("entering planning mode, better check") are misusing it.

---

## Deferred (post-MVP)

The MVP ships the smallest useful slice. The following extensions are designed-around but not built:

- **Arbiter layer** — `meta_context_analyze(scope, lens)` that returns findings (tensions, gaps, opportunities). Wait for fleet inconsistencies to actually surface before building.
- **Curation** — `meta_context_propose_curation(patch)` + user-confirmation flow with adapter-delegated diffing (filesystem diff for skill/workflow; remote fetch for Codex). Wait for hand-edited-artifact problems.
- **Passive writes** — auto-writes when new catalysts or adapters load. Every passive write is a new way for the graph to lie about what the operator actually decided; don't ship until we know what we'd write. (Inventory turned out to belong in its own current-state cache, not the contextmap — see the Inventory section. So the remaining "passive write" candidates are catalyst/adapter ship events.)
- **Stale-binding audit lens** — `LEFT JOIN meta_nodes mcp_tool` (with incoming `binds` edges) against `meta_mcp_inventory` to surface "this sealed artifact binds to a tool no longer in your environment." Designed-around but not yet built; follow-up to the inventory primitive.
- **Re-materialization tracking UX** — graph already supports the same catalyst materialized into multiple hosts via multiple `materialized_by` edges; a surfacing layer is a follow-up.
- **Dashboard** — `/data` pane tab rendering contextmap as a graph, adapter colour-coded for multi-host fleets.
