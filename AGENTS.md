# AGENTS.md

Orientation for non-Claude agents (Codex, OpenAI agent runtimes, future hosts) working in this repo. Claude Code reads [CLAUDE.md](CLAUDE.md) — the fast orientation and golden rules there are host-neutral and apply to you too; read it first. Use [docs/AGENT-REFERENCE.md](docs/AGENT-REFERENCE.md) when you need the deeper MCP/runtime/data map. This file only covers what Codex needs *before* mojulo's MCP tools are connected, plus pointers to the Codex-specific host adapter.

## Connecting to the dev control plane

The control plane exposes an HTTP MCP server at `/api/mcp` (port 3001 in dev). It is opt-in: with `CONTROL_PLANE_MCP_KEY` unset, the route returns 404. To use it locally you need:

1. `CONTROL_PLANE_MCP_KEY` set in [control/.env](control/.env) (a random ≥32-char string; `openssl rand -hex 32` is fine).
2. The control plane running: `cd control && npm run dev`.
3. Your agent host registered against `http://localhost:3001/api/mcp` with `Authorization: Bearer <CONTROL_PLANE_MCP_KEY>`.

### Codex CLI

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.mojulo]
url = "http://localhost:3001/api/mcp"
headers = { Authorization = "Bearer <CONTROL_PLANE_MCP_KEY>" }
```

Restart the Codex session. `forward_context` should appear in your tool surface — call it first to pull mojulo's routing index and drawer map, then call the specific drawer/tool the task needs.

### Shell fallback (no MCP registration needed)

If you have shell access but no MCP client, the same registry is reachable as a CLI: `node control/scripts/mcp-stdio.mjs tools|packs|help <tool>|call <tool> --json '{…}'`. It runs in-process against the same data (no control plane, no bearer token); results print to stdout, diagnostics to stderr, exit codes 0/1/2 (124 on `--timeout`).

### Cross-host reference

For comparison, Claude Code uses `claude mcp add --transport http mojulo http://localhost:3001/api/mcp --header "Authorization: Bearer <CONTROL_PLANE_MCP_KEY>"`. The full install matrix (Claude Desktop, Claude Code, mcp-inspector) is in [docs/mcp-integration.md](docs/mcp-integration.md).

## After you're connected

- Call `forward_context` once at session start. The `initialize` preamble is deliberately tiny, and `forward_context` stays intentionally lean; heavier orientation lives behind its sibling drawers.
- When a mojulo tool **rejects an input the schema appears to permit** (a motion spec, a nested object, an enum-like string), isolate the constraint with a minimal probe before falling back — do not treat the first rejection as the tool's true limit. Most such rejections are a param that needs an explicit shape (author nested values as real JSON objects, not stringified) or an unknown name where a clear error lists the valid set. Read that error; it usually names the fix. Reach for a different family only once you've confirmed the surface actually can't express the request.
- When materializing a catalyst, read the **Codex host adapter** at [control/lib/mcp/adapters/codex.md](control/lib/mcp/adapters/codex.md). It tells you which artifact target to pick (Codex automation, workspace workflow file, or inline one-shot), how to bake the dry-run pattern in, where to put cursors, and how to handle secrets.
- The catalyst body itself ([control/lib/mcp/catalysts/](control/lib/mcp/catalysts/)) is host-neutral. Combine it with the Codex adapter rules to produce the runnable artifact — don't write `.claude/skills/` files; that's Claude-specific.

## Secrets posture

- Don't `cat` or read `~/.mojulo/**/.env*` directly once connected — route through the `inspect_bot_env` MCP tool, which masks sensitive values. The repo's own [control/.env](control/.env) is a one-time read for the bearer token during registration; after that, prefer MCP tools.
- Never echo the `CONTROL_PLANE_MCP_KEY` into materialized artifacts (automation prompts, workflow files) as plain text. Use Codex's secret-injection mechanism if available; otherwise leave the value out and let the host's stored config supply it at run time.

## Architecture pointers

Everything below is host-neutral. Start with [CLAUDE.md](CLAUDE.md), then use [docs/AGENT-REFERENCE.md](docs/AGENT-REFERENCE.md) for denser agent-facing detail:

- Repo shape (control plane + lite-template), build pipeline, fleet aggregation posture.
- MCP tool rings (Ring 0 orientation through Ring 9 research mode).
- Tamper-evident chain, vector RAG, LLM provider abstraction, per-model protocol gates and task tiers.
- Native-dependency landmines and data layout.

If anything in this file drifts from CLAUDE.md, CLAUDE.md wins on architecture; this file wins on Codex-specific procedure.
