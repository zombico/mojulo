# Mojulo

**MCP server for building self-hosted chatbots from inside Claude.** Describe the bot you want — Mojulo compiles it into a portable Docker artifact you own. Conversations live in the bot's own SQLite, hash-chained turn by turn. The MCP surface composes alongside your other MCPs (Drive, Gmail, your CRM), so the build/deploy/operate loop runs entirely inside a Claude session.

## Quickstart

```bash
# 1. Wire mojulo into Claude (Claude Code or Claude Desktop)
claude mcp add mojulo --command "npx -y mojulo"

# 2. Configure at least one LLM provider key
#    (mojulo-config ships inside the mojulo package, so -p mojulo is required)
npx -y -p mojulo mojulo-config set anthropic sk-ant-...

# 3. In a Claude session, ask:
#    "build me a triage bot for my dental practice"
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

There's a browser dashboard (Settings UI, in-app builder, wizard) but it's not shipped in this npm package yet — clone the repo to run it:

```bash
git clone https://github.com/zombico/mojulo.git
cd mojulo/control && cp .env.example .env && npm install && npm run dev
```

The MCP surface in the npm package covers the build/deploy/operate loop end-to-end without it.

## More

- Full repo and docs: <https://github.com/zombico/mojulo>
- Architecture: [ARCHITECTURE.md](https://github.com/zombico/mojulo/blob/main/ARCHITECTURE.md)
- MCP integration: [docs/mcp-integration.md](https://github.com/zombico/mojulo/blob/main/docs/mcp-integration.md)
- Catalysts: [docs/catalysts.md](https://github.com/zombico/mojulo/blob/main/docs/catalysts.md)

## License

[Apache License 2.0](https://github.com/zombico/mojulo/blob/main/LICENSE)
