# Tool packs — the tools/list surface becomes result-shaped, tools unveil on demand

Status: PROPOSED; **P0 spike EXECUTED (2026-08-06) — list_changed is a dead end on the primary
host today; see "P0 results" below.** The plan's unveil mechanism must ship as the dispatcher
hybrid (P0-R) or park until anthropics/claude-code#66084 lands.
Supersedes: `orientation-containment.plan.md` C5 (studio-gated registration — two wings were the
coarsest possible packs; this is the same idea at the right grain). C4 (schema diet) remains open
but demoted: fat schemas only load when their pack opens, so C4 becomes per-pack hygiene, not the
headline economic fix.
Owner seams: `control/lib/mcp/server.js` (registration + capabilities + notifications),
`control/app/api/mcp/route.js` (transport — currently 405s GET; see P0), pack registry (new,
`control/lib/mcp/packs.js`), `control/lib/mcp/tools/context.js` (routing rows name packs),
`control/lib/mcp/routing-cards/` (the `when` fields become pack-description recognizers).

## Problem

The orientation layer is contained (office/studio bodies, drawers, routing cards — all lazy,
all ratcheted), but the **registration layer is still eager**: `tools/list` returns all 178 tools
with full schemas — measured 374.7KB (~93K tokens, ~47% of a 200K window) at connect, 64% of it
creative, paid by every session before any intent exists. `forward_context` cannot delay this:
tool definitions are host-injected context, a layer above tool results. The self-routing
description — load-bearing in mojulo's design — is exactly what makes the eager layer heavy.

## The move

**Self-routing moves up a level; it does not die.** Connect-time `tools/list` returns a small
SPINE plus one tool per PACK (~16–20 packs). A pack is a result-shaped bundle ("deploy a
chatbot", "make audio", "operate the fleet") whose *description* is its recognizer — content
mojulo has already authored as routing-card `when` fields and FORM_TOOLSETS `makes` lines.
Calling a pack tool does two things atomically:

1. registers the pack's member tools and emits `notifications/tools/list_changed`;
2. returns the pack's orientation body (the same prose the drawer system serves today) plus a
   one-line "these tools are now callable" so the model proceeds even if the host's list lags.

One call = unveil + orient. Routing stays description-driven at both levels: ~18 pack
descriptions route at connect; each pack's member tools self-route normally once unveiled. Packs
are additive within a session — the bench accumulates the toolboxes in use (the workshop metaphor
made literal). Composition across packs rides three surfaces: pack descriptions cross-reference
their composers ("Game — composes worlds + beats + sprites"), forward_context routing rows name
packs instead of tools, and worked examples demonstrate multi-pack traces. The global safety nets
(`semantic_search`, `get_tool_index`) sweep the whole registry regardless of what's unveiled, so
no capability flies dark.

**Token math (target):** spine + 18 pack descriptions at ≤700 chars each ≈ 25–35KB (~6–9K
tokens) at connect, from 374.7KB (~93K). Opening a pack costs its members' real schemas — a few
K tokens, paid only for packs the session uses. A two-pack bot-deploy session lands under ~15K
tokens of tool surface with named tools, per-tool permissions, and full schema fidelity intact.

## Why not a gateway (the road not taken)

Collapsing to dispatcher tools (`studio({tool, args})`) saves ~another 20–30K but forfeits: the
model's routing over visible names (every action gains a retrieval hop; misroutes become opaque
composed calls instead of self-evident wrong picks), host permission granularity (allowlists key
on tool names), and telemetry/audit legibility. Packs keep all three — the gateway is the
documented escalation path ONLY if packs land and the surface is still too heavy.

## P0 — the host spike (everything hangs on this)

The hard dependency is `tools/list_changed` actually causing hosts to re-fetch. Two dimensions:

- **Protocol:** does the host client re-issue `tools/list` on the notification, and are
  newly-listed tools then callable mid-session by the model?
- **Transport:** mojulo is Streamable HTTP and **currently 405s GET** (`api/mcp/route.js` —
  "POST a JSON-RPC message, get one back"; no SSE anywhere). Notifications have two spec
  delivery paths: interleaved in an SSE response to the triggering POST, or the standalone GET
  stream. The spike must learn which (if either) the host consumes — this may force implementing
  SSE on the mojulo route as part of P1.

Spike harness: a minimal standalone MCP server (no SDK, mirrors mojulo's hand-rolled JSON-RPC)
in both stdio and Streamable-HTTP modes, initial tools `open_pack` (+ `ping`), where `open_pack`
registers `secret_reveal` and emits list_changed; server logs every request to a file. Driven by
Claude Code headless (`claude -p` + `--mcp-config`) prompted to open the pack then call the
unveiled tool. Pass = `secret_reveal` executes; the request log shows whether a re-`tools/list`
followed the notification. Repeat for Codex CLI if installed. Matrix rows: Claude Code × stdio,
Claude Code × HTTP (notification-in-POST-SSE), Claude Code × HTTP (GET stream), Codex × same.

**Fallback posture (required regardless of spike outcome):** `MOJULO_TOOL_PACKS=off` restores
flat registration for hosts that never refresh; the pack response's "now callable" line lets a
model on a stale-list host retry via a fresh `tools/list` pull where the host supports manual
refresh. If NO host path works, this plan parks and C4 resumes as the headline fix.

### P0 results (executed 2026-08-06, Claude Code 2.1.143 headless, spike server hand-rolled
### stdio + Streamable HTTP; harness in the session scratchpad, ~200 lines, reproducible from
### this section)

| Host × transport | Notification delivered? | Client re-lists? | Unveiled tool callable? |
|---|---|---|---|
| Claude Code × stdio | yes (in-stream) | **no** | **no** (call blocked client-side, never reached server) |
| Claude Code × HTTP, notification in POST SSE response | yes | **no** | **no** |
| Claude Code × HTTP, standalone GET SSE stream | yes (client DOES open the GET stream) | **no** | **no** |
| Codex CLI | — | — | not installed on this host; untested |

Corroborated by documentation/issues: Claude Code receives `tools/list_changed` but never
re-fetches — the deferred-tool index is populated only at initialization
(anthropics/claude-code#66084, open at v2.1.165; #31893 spec-compliance audit; #4118 closed
without covering the tool-invocation surface). Only recovery is `/mcp` reconnect or restart —
no in-session path. The MCP spec requires clients to refresh; Claude Code is non-compliant
today.

**Second finding, which changes the economics:** the spike's transcript shows Claude Code
already DEFERS MCP tool schemas client-side (a names-only deferred registry + on-demand
ToolSearch load — observed in headless too: "the tool wasn't found in the deferred registry").
On current Claude Code, the 93K eager tax is substantially mitigated by the HOST, exactly the
"hosts are solving it from their side" scenario. The pack mechanism's urgency on Claude Code
specifically is therefore lower than the raw payload numbers suggest; the tax persists in full
on hosts without deferral.

### P0-R — revised mechanism (dispatcher hybrid, works on non-compliant hosts today)

Since unveil-by-registration is dead on the primary host: each pack tool doubles as its own
dispatcher. First call (no args) = unveil: returns the pack's orientation body + member tool
manual. Subsequent calls `pack_audio({tool:'create_beats', args:{…}})` dispatch to members
server-side. On hosts that honor list_changed (future Claude Code, compliant clients), the
server ALSO registers real member tools on unveil and the model uses those — self-adapting:
after emitting list_changed, if no re-list arrives within a beat, the session is dispatcher-
mode. Costs (scoped to within-a-pack, not global): per-tool host permissions collapse to
per-pack; member routing rides the unveil body instead of visible names. This is the gateway
trade-off from "Why not a gateway" accepted PARTIALLY and TEMPORARILY, bounded per pack, with
the registration path already wired for the day #66084 lands.

**Recommendation given P0:** do not build packs now purely for Claude Code (host deferral
already blunts the tax there). Build P0-R only if/when a non-deferring host matters (Codex
untested, claude.ai connectors unknown), or park this plan tracking #66084 and let C4 (schema
diet) resume as the near-term economic work — it helps every host unconditionally.

## P1 — pack registry + unveil mechanics

- `control/lib/mcp/packs.js`: `{ id, title, description (recognizer), members: [toolNames],
  body }` — pure data + a partition assertion (every registered tool in exactly one pack or the
  spine). Server: `registerTool` gains pack awareness; `listTools()` returns spine + pack tools +
  unveiled members (per-session unveil state keyed by MCP session id); `tools/call` on a pack
  tool = unveil + body. Capabilities advertise `tools: { listChanged: true }`. Transport work on
  the route per P0 findings (likely: implement the GET SSE stream and/or SSE POST responses).
- Flat-mode flag wired first so every test can run both shapes.

## P2 — the partition + description budgets

Candidate partition (~19 packs; final membership by registry sweep at implementation):
office — chatbot-build, chatbot-operate, fleet, connected-services (Ring 6 deliberation +
binding), apps+daemons, plan, research, stash-cook/publish, catalysts+extend; studio — the 11
FORM_TOOLSETS drawers promoted to packs (diagram, illustration, reference, image-render, object,
world, view, motion, audio, voice, game). Spine: forward_context, semantic_search,
get_tool_index, get_register_kit, get_worked_example, get_ui_map, get_substrate, version,
check_for_updates, get_tool_telemetry (~10; get_creative_toolset folds into the studio packs'
unveil bodies or stays as the no-unveil reader — decide at P2).

Budgets, all test-pinned in the house pattern: PACK_DESCRIPTION_CEILING 700 (the existing
description ceiling, applied to packs — "abstract what shows up in the packs" as a ratchet, or
packs refatten into what they replaced); connect-payload pin ≤ ~35KB (spine + packs, replaces
today's 372KB pin as the headline number; the full-unveil payload keeps a secondary pin);
partition sweep; unveil integration test (call pack → members listed + notification emitted).

## P3 — orientation rewiring

forward_context office/studio routing rows name packs as the entry surface (entry tools stay
named inside the row for hosts running flat mode); SERVER_INSTRUCTIONS teaches "match the ask to
a pack, open it"; TOOL_INDEX gains the pack column; worked examples show the unveil step.
Office/studio bodies stay — packs gate *registration*, the wings gate *orientation*; the two
compose (opening a studio pack ≠ reading the studio routing index).

## P4 — eval + telemetry

Routing eval extends with query → expected-PACK rows (the same fixture style, one level up).
`get_tool_telemetry` records pack-opens — which results operators actually reach for becomes
first-class product signal, and "pack opened then zero member calls" joins the orientation-gap
cut as a routing-quality alarm.

## Success criteria

- Connect-time tools/list ≤ ~35KB in packs mode (from 374.7KB), pinned.
- Host matrix documented; at least Claude Code green on one transport path end-to-end
  (open pack → unveiled tool called by the model without user intervention).
- Partition sweep, pack-description ratchet, unveil integration test, eval pack-fixtures: green.
- Flat mode (`MOJULO_TOOL_PACKS=off`) byte-identical to today's surface.
- No tool renamed, no repo restructuring — registration choreography only.
