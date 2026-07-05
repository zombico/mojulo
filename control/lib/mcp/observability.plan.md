# MCP tool-layer observability

## The gap

The MCP layer is the substrate's busiest surface (~143 tools, two transports) and
its darkest. Today the only signal is a single `console.error('[mcp] dispatch
error', …)` in [server.js](server.js) — and that fires only for *protocol*-level
failures. Tool-handler failures are swallowed into the MCP `isError: true`
result (correct per spec, invisible to the operator). There is:

- no record of which tool was called, when, by which session/client;
- no timing — a slow handler and a fast one look identical;
- no error history — "which tool broke yesterday?" is unanswerable;
- no stuck-handler protection — a hung handler blocks the MCP session
  indefinitely with zero trace.

This is at odds with the substrate's own pitch: auditable state mutations on
the operator's host. The contextmap seals *structural* decisions; nothing
records the *operational* surface those decisions ride on.

## Invariants this plan must hold

- **Never persist tool input values by default.** Inputs can carry pasted
  documents, env-adjacent strings, personal text. Telemetry stores the input's
  *shape* (top-level key names + serialized byte size), never values. Full
  capture is an explicit debug flag, off by default, documented as such.
- **Conversation data never moves into the control-plane DB.** Telemetry rows
  describe tool calls, not conversations — but `get_conversation` etc. must not
  leak turn content through result-capture. Same rule: shapes and sizes only.
- Single-user, localhost. No multi-tenant fields, no auth on read surfaces
  beyond what the dashboard/API already has.
- The dashboard renders state; it is not a conversational surface. The
  observability page shows tables and offers copy-starter-prompt affordances.
- Any new *listed* MCP tool needs a `TOOL_INDEX` row in
  [tools/context.js](tools/context.js) — the registry-sweep test in
  [tools/context.test.js](tools/context.test.js) enforces it.

## Design

One instrumentation seam, one table, one guard, three read surfaces.

There are exactly two paths into a handler — `handleToolCall()` (JSON-RPC
`tools/call`) and `invokeRegisteredTool()` (plan-mode executor) — both in
[server.js](server.js). Both transports (HTTP route, stdio bin) converge on
`dispatchMcpRequest`, so instrumenting in server.js covers everything,
including future transports.

### Phase 1 — the seam (structured log, no persistence yet)

Extract a shared `instrumentedInvoke(tool, input, context, { via })` in
server.js and route both call paths through it. Per call it captures:

| field | source |
|---|---|
| `tool` | registration name (alias name as called, not the canonical target) |
| `via` | `'rpc'` \| `'plan-executor'` |
| `session_id` | `context.mcpSessionId` |
| `client` | `clientInfo` from `rememberClientInfo` (name + version), nullable |
| `started_at`, `duration_ms` | monotonic clock around the handler await |
| `status` | `'ok'` \| `'error'` \| `'timeout'` \| `'late_settle'` |
| `error_message` | truncated (~500 chars), error path only |
| `input_shape` | JSON: top-level key names + `JSON.stringify(input).length` |
| `result_bytes` | serialized result size (post-`toMcpToolResult`) |

Emit one structured line per call to stderr:
`[mcp] tool=create_view ms=142 ok via=rpc session=abc123` — immediately useful
under `next dev` and in stdio-mode logs, before any DB work lands.

Config: `MOJULO_MCP_TELEMETRY=off` disables everything (default: on — the cost
is one object build + one log line + later one SQLite INSERT per call, nothing
at single-operator scale).

### Phase 2 — persistence (`mcp_tool_calls` + repository)

- Migration in [../db/index.js](../db/index.js): `mcp_tool_calls` with the
  Phase-1 fields, an autoincrement id, and indexes on `(tool, started_at)` and
  `(status, started_at)`.
- Repository `../db/repositories/mcpToolCalls.js` following the existing
  repository idiom: `record(row)`, `recent({ limit, tool, status })`,
  `aggregates({ sinceDays })` → per-tool `{ calls, errorRate, p50, p95,
  lastError, lastCalledAt }`.
- **Retention**: unbounded growth is the classic telemetry failure. Prune on a
  startup sweep + piggyback on `scripts/cleanup-stale-artifacts.js`: keep 30
  days or 50k rows, whichever is smaller. The prune itself logs one line.
- Writes are fire-and-forget inside `instrumentedInvoke` — a telemetry INSERT
  failure must never fail or slow a tool call (wrap in try/catch, degrade to
  the stderr line).
- Debug flag `MOJULO_MCP_TELEMETRY_CAPTURE=full` additionally stores truncated
  input/result JSON (say 4KB each) into nullable `input_json` / `result_json`
  columns. Off by default; documented in `.env.example` with the secrets
  warning.

### Phase 3 — stuck-handler guard (soft timeout + late-settle)

JS can't cancel a running handler, so this is a *soft* timeout: it unblocks
the session and flags the handler; it does not kill the work.

- `registerTool` accepts optional `timeoutMs`; default from
  `MOJULO_MCP_TOOL_TIMEOUT_MS` (proposed default: **120s** — generous, because
  the design intent is that anything long-running already goes through the
  async jobs ring (`save_modular_bot`, `process_documents` return `{ jobId }`),
  so a sync handler exceeding 120s is a bug signal, not a workload).
- `Promise.race` in `instrumentedInvoke`: on timeout, return an
  `isError: true` result — `"<tool> exceeded its <n>ms budget; the work may
  still be running. Check /observability or get_tool_telemetry."` — and record
  a `status: 'timeout'` row.
- Attach a `.then/.catch` to the orphaned promise: when it eventually settles,
  record a second row with `status: 'late_settle'` and the true duration.
  That pairing (timeout + late_settle vs timeout alone) is what distinguishes
  "slow" from "hung forever" after the fact.
- Audit pass: grep the sync handlers that can legitimately run long (render
  bakes in `forge_motion` / `stitch_motion`, gif encodes) and give them explicit
  higher budgets at registration rather than raising the global default.

### Phase 4 — read surfaces

1. **API route** `control/app/api/mcp-telemetry/route.js` — `recent` +
   `aggregates` from the repository. Powers the page; localhost like the rest.
2. **Dashboard page** `/observability` (sibling of `/apps` and `/data` in
   `control/app/`): per-tool aggregate table (calls, error rate, p50/p95, last
   error), a recent-errors feed, and a recent-calls tail. i18n-ready strings.
   Add its row to `DASHBOARD_UI_MAP` in [tools/context.js](tools/context.js)
   and to [docs …](../../docs/) where `get_ui_map` output is described.
3. **Agent-facing drawer tool** `get_tool_telemetry` — registers beside
   `version` / `check_for_updates` in the orientation cluster. One tool, two
   modes: no-args → aggregate summary + last N errors; `{ tool }` → that
   tool's recent calls. This is the surface that actually matters given the
   operator drives mojulo from their host agent: "which tool broke?" gets
   answered in-session without leaving the chat. Needs a `TOOL_INDEX` row +
   a `get_tool_index` entry (registry-sweep test will enforce).

### Phase 5 — tests + docs

- Vitest (in-memory SQLite, existing idiom):
  - success/error/timeout/late_settle each write the right row;
  - alias calls record the *called* name;
  - telemetry INSERT failure doesn't break the tool call;
  - `MOJULO_MCP_TELEMETRY=off` writes nothing;
  - capture flag off ⇒ `input_json` stays null even when inputs are rich;
  - prune respects both caps;
  - repository aggregates (p50/p95, error rate) against a seeded set;
  - `get_tool_telemetry` handler shape + its TOOL_INDEX row (sweep test
    covers the latter automatically).
- Docs: a short "Observability" section in
  [docs/MCP-ARCHITECTURE.md](../../docs/MCP-ARCHITECTURE.md) (what is recorded,
  what is deliberately NOT recorded, the flags); `.env.example` entries.

## Decisions (recommendations inline)

1. **Telemetry default** — recommend **on** (stderr line + DB row). Off-switch
   exists. A single-operator localhost substrate has no privacy argument
   against recording its own tool-call metadata, and dark-by-default is how
   the gap got here.
2. **Default timeout** — recommend **120s soft**. Alternatives: none (status
   quo) or 60s (will false-positive on heavy renders until per-tool budgets
   are tuned).
3. **`get_tool_telemetry` in v1** — recommend **yes**; it's the cheapest
   surface and the one the operator will actually touch. The dashboard page
   can trail it by a release if Phase 4 needs splitting.

## Out of scope (adjacent, tracked here so they don't creep in)

- Lazy per-kind handler imports in [tools/create-view.js](tools/create-view.js)
  (boot-failure isolation) — related robustness, different seam.
- Deprecated-alias sunset tracking — telemetry actually *enables* it (an alias
  with zero calls in 60 days is safe to drop); do it as a follow-up query, not
  as part of this plan.
- Tracing across bot-proxy / fleet calls into per-bot runtimes — bot-side
  observability is a separate concern with its own data-locality rules.

## Build order

Phase 1 → 2 → 3 land as one reviewable slice (the seam is the same code
region); Phase 4.3 (drawer tool) next; Phase 4.1/4.2 (route + page) after;
Phase 5 accompanies each slice, not a trailing phase.
