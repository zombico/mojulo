# Mojulo

**MCP server for building self-hosted chatbots from inside Claude.** Describe the bot you want — Mojulo compiles it into a portable Docker artifact you own. Conversations live in the bot's own SQLite, hash-chained turn by turn. The MCP surface composes alongside your other MCPs (Drive, Gmail, your CRM), so the build/deploy/operate loop runs entirely inside a Claude session.

Two binaries, one install:

- `mojulo` — stdio MCP server (`npx -y mojulo`, wired into Claude).
- `mojulo-ui` — local dashboard for visual operation (`npx -y -p mojulo mojulo-ui`).
- `mojulo-config` — provider key CLI (`npx -y -p mojulo mojulo-config set anthropic sk-...`).

Both `mojulo` and `mojulo-ui` share the same `~/.mojulo/` state, so anything you mint through Claude shows up in the dashboard's fleet view immediately, and vice versa.

## Quickstart

```bash
# 1. Wire mojulo into Claude (Claude Code or Claude Desktop)
claude mcp add mojulo --command "npx -y mojulo"

# 2. Configure at least one LLM provider key
#    (mojulo-config ships inside the mojulo package, so -p mojulo is required)
npx -y -p mojulo mojulo-config set anthropic sk-ant-...

# 3. In a Claude session, ask:
#    "build me a triage bot for my dental practice"

# 4. Operate the fleet visually (optional, anytime):
npx -y -p mojulo mojulo-ui
#    Opens a local dashboard at 127.0.0.1 and pops your browser. Shares
#    ~/.mojulo/ with the MCP, so any bot you mint via Claude appears in
#    the fleet view immediately. Flags: --port <n>, --no-open, --help.
```

Compiled bots land in `~/.mojulo/data/artifacts/`. Run them with `docker compose up`, or set a Fly token (`npx -y -p mojulo mojulo-config set fly fo1_...`) and ask Claude to deploy to the cloud.

On first connect, Claude calls `forward_context` to read mojulo's glossary, lifecycle, and tool index — so the session orients itself before doing anything.

## Tools at a glance

- **Build** — `infer_intent`, `generate_*`, `save_modular_bot`. Describe a bot in free text; the tools sequence themselves into a compiled zip.
- **Operate** — `get_deployment`, `query_conversations`, `get_conversation`, `query_submissions`, `verify_chain`. Read what each connected bot has captured. Transcript content never leaves the bot's SQLite — these tools proxy through.
- **Fleet** — `fleet_query_conversations`, `fleet_analytics_summary`, `verify_fleet_chains`. Cross-bot rollups; same posture, just batched.
- **Catalysts** — `list_catalysts`, `recommend_catalysts`, `get_catalyst`. Curated workflow recipes Claude turns into local skills in your `.claude/skills/`.

## Catalysts shipped

`qualify-lead-to-crm` · `appointment-to-calendar` · `submission-to-ticket` · `submissions-to-warehouse` · `document-extract-to-store` · `scan-conversations-for-signal` · `knowledge-gap-miner` · `weekly-submissions-digest` · `conversations-to-channel-digest`

Claude reads one, binds it to a destination MCP you already have installed, and writes a local skill. The catalyst is the nucleation point; the resulting skill is yours.

## Dashboard

The `mojulo-ui` bin boots a local Next.js dashboard on 127.0.0.1, no clone required:

```bash
npx -y -p mojulo mojulo-ui                # auto-port, opens browser
npx -y -p mojulo mojulo-ui --port 3999    # pin the port
npx -y -p mojulo mojulo-ui --no-open      # skip browser launch
```

Same primitives as the MCP, different face — useful when you want to:

- Browse conversations and submissions interactively (filter, scroll, scan).
- Mint a bot via the wizard form rather than chat-builder turn-taking.
- See fleet analytics as charts rather than JSON tables.
- Click around between bots without leaving the browser.

Shares `~/.mojulo/data/mojulo-lite.db` with the MCP via WAL mode, so the two can run side-by-side.

## More

- Full repo and docs: <https://github.com/zombico/mojulo>
- Architecture: [ARCHITECTURE.md](https://github.com/zombico/mojulo/blob/main/ARCHITECTURE.md)
- MCP integration: [docs/mcp-integration.md](https://github.com/zombico/mojulo/blob/main/docs/mcp-integration.md)
- Catalysts: [docs/catalysts.md](https://github.com/zombico/mojulo/blob/main/docs/catalysts.md)

## License

[Apache License 2.0](https://github.com/zombico/mojulo/blob/main/LICENSE)
