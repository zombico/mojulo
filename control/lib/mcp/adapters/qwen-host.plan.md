---
{
  "id": "qwen-host-plan",
  "name": "Local Qwen Host Plan",
  "summary": "Planning notes for a future local Qwen MCP host adapter.",
  "artifactTarget": "planning document only",
  "schedulingMechanism": "not materialized",
  "secretsPosture": "no secrets in this planning card"
}
---

# Local Qwen operator — enablement plan

Goal: a locally-served Qwen model drives mojulo through the existing MCP surface, the same way Claude Code does — connect, orient via `forward_context`, pull drawers, mint artifacts, materialize catalysts. The substrate needs almost nothing; the work is host wiring, one adapter card, and an honest evaluation of whether the model holds up as an operator.

## Ground truth that shapes the plan

- Mojulo's MCP surface is already host-neutral: HTTP + bearer at `http://localhost:3001/api/mcp`, loopback-only, opt-in via `CONTROL_PLANE_MCP_KEY` (AGENTS.md documents the Codex registration; the same shape works for any MCP client).
- **Claude Code cannot be the host for a Qwen model.** Verified against current official docs (2026-07): `ANTHROPIC_BASE_URL` only redirects to Anthropic-protocol endpoints (gateways, Bedrock, Vertex, Foundry); `ANTHROPIC_MODEL` must be a Claude model; Anthropic's gateway docs state they don't support routing Claude Code to non-Claude models through any gateway. Community translation proxies (LiteLLM anthropic→openai, claude-code-router, LM Studio's Anthropic-compat `/v1/messages` mode) exist but are unsupported, lossy on tool-call fidelity, and drop prompt caching. Treat that route as an experiment (appendix), not the plan.
- The host adapter layer is drop-in: `adapters/loader.js` scans this directory, matches `clientInfo.name` against each card's `supportsClientInfoHint` (case-insensitive), and falls back to `generic.md`. Adding `qwen-code.md` requires no registry changes.
- Telemetry already gives us the eval instrument for free: every tool call writes an `mcp_tool_calls` row and a structured stderr line, surfaced at `/observability`.

## Phase 0 — Serve the model (no repo changes)

1. Pick a serving stack. Recommended: **LM Studio** or **Ollama** for one-command setup; **vLLM** if there's a real GPU and you want throughput + the most faithful OpenAI-compatible function calling.
2. Pick the model. Realistic floor for mojulo's multi-hop tool discipline: **Qwen3-Coder-30B-A3B** (MoE, fast on Apple silicon, strong tool calls) or **Qwen3-32B**. Configure ≥32k context (128k if RAM allows) and native function calling ON. Small quantized models will connect fine and then flail past two tool hops — don't start there.
3. Acceptance gate: `curl` the OpenAI-compatible endpoint with a `tools` array and confirm well-formed `tool_calls` JSON comes back (not tool-call text in the content field — a common quantization/template failure).

## Phase 1 — Wire an MCP-native host (no repo changes)

1. Primary host: **Qwen Code CLI** (MCP-native, points at any OpenAI-compatible endpoint). Alternatives with the same shape: OpenCode, Goose, Cline/Roo.
2. Control-plane side: set `CONTROL_PLANE_MCP_KEY` in `control/.env` (`openssl rand -hex 32`), `npm run dev`.
3. Host side: register mojulo in the host's `mcpServers` config — `url: http://localhost:3001/api/mcp`, header `Authorization: Bearer <key>`. Same loopback rule as every other host: the agent runs on this machine.
4. Acceptance gates, in order:
   - host lists mojulo tools (`tools/list` round-trip);
   - `forward_context` call returns and the model routes off it instead of dumping it;
   - `create_sketch` smoke → open the returned `/sketches/<ref>` URL and see the sketch.

## Phase 2 — Host adapter card + registration doc (the actual repo work)

1. Write `control/lib/mcp/adapters/qwen-code.md` paralleling `codex.md`:
   - frontmatter (JSON, not YAML): `supportsClientInfoHint: ["qwen", "qwen-code", "qwen-coder", "qwencode"]` — verify the actual `clientInfo.name` the host sends during Phase 1 and pin that string.
   - Artifact targets: Qwen Code has no automation runtime — so (1) workspace workflow file scheduled by system cron/launchd invoking a headless Qwen Code session, (2) inline one-shot. Reuse codex.md's standing-moves preamble, dry-run flip (`config.json` `liveMode`), state-file cursor, and secrets posture (`inspect_bot_env`, never `cat` `.env`) nearly verbatim — those sections are host-neutral discipline.
   - No `.claude/skills/` and no Codex automations; say so explicitly like codex.md does.
2. Add a Qwen Code registration snippet to `AGENTS.md` beside the Codex TOML block.
3. Acceptance: `loader.test.js` passes with the new card; `get_host_adapter` (Ring tool in `tools/adapters.js`) resolves it from the hint.

## Phase 3 — Operator evaluation (assets already exist)

Task ladder, run through the Qwen host, judged via `/observability` + `mcp_tool_calls` rows against a Claude Code baseline session doing the same ladder:

1. Orientation: `forward_context` → pull exactly the drawers needed for a named task (measures routing discipline, not just success).
2. Mint: `create_sketch` from a one-line intent.
3. Compose: `compose_world` (or `create_view`) + open the artifact.
4. Bot flow: build a bot config dry-run through the MCP build tools (converges on `buildDeploymentConfig()` — good test of multi-step schema adherence).
5. Materialize: one catalyst end-to-end via the new adapter card, dry-run mode.

Metrics: malformed/retried tool-call rate, wrong-tool-first-call rate, drawer pulls per task (context discipline), ladder completion. Rough bar: ≥90% valid calls and completes rungs 1–3 unassisted; rungs 4–5 tell us whether it's a real operator or a demo.

## Phase 4 — Only if the eval shows strain (optional substrate ergonomics)

Don't build these speculatively:

- A lean-registry mode (env flag) exposing only main-flow rings to reduce schema token load for small-context hosts — the description-budget ratchet may already be enough.
- Context guidance in the adapter card (minimum window, "pull one drawer at a time" phrasing) tuned to observed failure modes.

## Appendix — Claude Code as host via translation proxy (experimental, unsupported)

If we want Claude Code's harness ergonomics over a local model anyway: LiteLLM's anthropic-format proxy or LM Studio ≥0.4.1's Anthropic-compatible `/v1/messages` mode, with `ANTHROPIC_BASE_URL` pointed at it. Expect: no prompt caching, tool-call translation drift, silent field drops, breakage on Claude Code updates; explicitly outside Anthropic support. Worth at most a one-session spike after Phase 3, purely to compare harness quality — never the foundation for the adapter card.
