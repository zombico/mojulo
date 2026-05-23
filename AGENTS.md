# AGENTS.md

Orientation for non-Claude agents (Codex, OpenAI agent runtimes, future hosts) working in this repo. Claude Code reads [CLAUDE.md](CLAUDE.md) — the architecture content there is host-neutral and applies to you too; read it first. This file only covers what Codex needs *before* mojulo's MCP tools are connected, plus pointers to the Codex-specific host adapter.

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

Restart the Codex session. `forward_context` should appear in your tool surface — call it first to pull the full mojulo orientation (glossary, capability model, deploy/connect lifecycle, tool index).

### Cross-host reference

For comparison, Claude Code uses `claude mcp add --transport http mojulo http://localhost:3001/api/mcp --header "Authorization: Bearer <CONTROL_PLANE_MCP_KEY>"`. The full install matrix (Claude Desktop, Claude Code, mcp-inspector) is in [docs/mcp-integration.md](docs/mcp-integration.md).

## After you're connected

- Call `forward_context` once at session start. The `initialize` preamble is deliberately tiny — orientation lives behind that tool on purpose.
- When materializing a catalyst, read the **Codex host adapter** at [control/lib/mcp/adapters/codex.md](control/lib/mcp/adapters/codex.md). It tells you which artifact target to pick (Codex automation, workspace workflow file, or inline one-shot), how to bake the dry-run pattern in, where to put cursors, and how to handle secrets.
- The catalyst body itself ([control/lib/mcp/catalysts/](control/lib/mcp/catalysts/)) is host-neutral. Combine it with the Codex adapter rules to produce the runnable artifact — don't write `.claude/skills/` files; that's Claude-specific.

## Secrets posture

- Don't `cat` or read `~/.mojulo/**/.env*` directly once connected — route through the `inspect_bot_env` MCP tool, which masks sensitive values. The repo's own [control/.env](control/.env) is a one-time read for the bearer token during registration; after that, prefer MCP tools.
- Never echo the `CONTROL_PLANE_MCP_KEY` into materialized artifacts (automation prompts, workflow files) as plain text. Use Codex's secret-injection mechanism if available; otherwise leave the value out and let the host's stored config supply it at run time.

## Architecture pointers

Everything below is host-neutral and lives in [CLAUDE.md](CLAUDE.md):

- Repo shape (control plane + lite-template), build pipeline, fleet aggregation posture.
- MCP tool rings (Ring 0 orientation → Ring 5 catalysts).
- Tamper-evident chain, vector RAG, LLM provider abstraction, per-model protocol gates.
- Native-dependency landmines and data layout.

If anything in this file drifts from CLAUDE.md, CLAUDE.md wins on architecture; this file wins on Codex-specific procedure.
