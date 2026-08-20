# Mojulo

**Mojulo is a workshop for coding agents** — local, yours, not a hosted service. You talk to the agent you already run (Claude Code, Codex); it does the reasoning, and mojulo is the machine it works in, where what it builds accumulates on your own disk. And what it builds isn't a menu of separate features — it's a **ladder**: a chatbot becomes a connected service when you wire in your MCPs, apps and services become experiences, worlds and music become a game's assets, and a game composes the whole stack. Each rung is a tiny deterministic **recipe** — small enough to read, seeded to regenerate identically, never a render.

**Not a second brain — a body.** Your agent is the only intelligence in the loop. Mojulo holds state, runtime, and the audit trail, and needs no LLM credentials of its own: apps park inference back on the agent's queue, photo references are read by the agent's eyes, publications are agent-authored, games are verified by agent-compiled traversals. Mojulo supplies what a stateless agent lacks — persistence, runtime, memory; the agent supplies what mojulo refuses to embed — judgment, vision, language. Optional local workers (Blender, image and audio models) add compositional capability.

**Built for fresh context.** The tool surface unfolds progressively — modular packs are read only when your intent calls for them, so a session spends tokens only on what it fires. And because every artifact is anchored by a recipe, a later agent iterates it with a parameter change instead of a rebuild — a fresh session picks up and improves what the last one made, instead of starting over.

Three binaries, one install:

- `mojulo` — stdio MCP server (`npx -y mojulo`, wired into Claude Code, Codex, or any other MCP host).
- `mojulo-ui` — local dashboard for visual operation (`npx -y -p mojulo mojulo-ui`).
- `mojulo-config` — provider key CLI (`npx -y -p mojulo mojulo-config set anthropic sk-...`).

Both `mojulo` and `mojulo-ui` share the same `~/.mojulo/` state, so anything you mint from your agent shows up in the dashboard immediately, and vice versa.

## Quickstart

Prerequisite: **Node.js 22.12+** (`node --version`). Everything below runs through
`npx`, which ships with Node — if you don't have it, install it from
[nodejs.org](https://nodejs.org), or ask your coding agent to install it for you.

```bash
# 1. Wire mojulo into your MCP-capable agent. The one-shot installer detects
#    Claude Code, Codex, and Claude Desktop, asks y/n per host, and opens the dashboard:
npx mojulo init
#    Or wire manually —
#    Claude Code:
#      claude mcp add --scope user mojulo -- npx -y mojulo
#    Codex CLI: add to ~/.codex/config.toml
#      [mcp_servers.mojulo]
#      command = "npx"
#      args = ["-y", "mojulo"]
#    Claude Desktop: add under "mcpServers" in claude_desktop_config.json, then restart it
#      "mojulo": { "command": "npx", "args": ["-y", "mojulo"] }
#    Other MCP hosts: register the same `npx -y mojulo` stdio command.

# 2. (Only needed for deployed bots — they bring their own LLM key.
#    Everything else runs keyless.)
npx -y -p mojulo mojulo-config set anthropic sk-ant-...

# 3. In an agent session, just ask.
```

### CLI

The same `mojulo` bin doubles as a command-line front door over the same
engine and data — no agent, no dashboard, no API key required. Useful for
spot checks, cron jobs, and CI:

```bash
npx mojulo tools                      # the connect surface: spine + packs
npx mojulo tools pack_audio           # one pack's members
npx mojulo packs                      # pack ids with their recognizers
npx mojulo help create_beats          # full description + input schema
npx mojulo call version               # invoke any tool
npx mojulo call create_beats --json '{"intent":"calm loop"}'
npx mojulo pack_audio                 # open a pack: orientation + member manual
npx mojulo pack_audio create_beats --json '{"intent":"calm loop"}'
```

Arguments can be inline JSON (`--json '{…}'`, `@file.json`, or `-` for
stdin) or per-property flags derived from the tool's schema
(`--theme dungeon --seed 7`; flags win over `--json`). `--timeout <ms>`
bounds long-poll tools (exit code 124), `--quiet` keeps only the exit code
(0 success, 1 tool error, 2 usage). Results print to stdout as-is, so
`npx mojulo call version | jq .` works; diagnostics go to stderr. Bare
`npx mojulo` remains the stdio MCP server.

## What you can make

- **"Build me a triage bot for my dental practice"** → a compiled, self-hosted chatbot artifact — its own Docker zip, its own SQLite, every turn hash-chained. Run it locally or deploy to Fly.
- **"Every Monday, digest my form submissions into Drive"** → a connected service over the MCPs you already have installed, with an append-only record of *why* it's composed the way it is.
- **"Give me a local app that extracts fields from these scans"** → a scaffolded local process + MCP sidecar; its inference queues back to *your agent* — no per-app API key.
- **"Draw the architecture" / "a walkable city at dusk" / "an ambient loop for it"** → media: diagrams, worlds, figures, music, films, publications — minted as tiny deterministic recipes (a world is ~30 tokens, not megabytes of mesh), re-rendered byte-identically on demand, exportable (`.glb`, `.stl`, WAV/MIDI, self-contained HTML).
- **"Make me a game"** → composition: media levels, music, and art bound to a typed store with rules — playable standalone, and a level is refused until proven completable. 2D reducer games land in the built-in Arcade.

On first connect your agent calls `forward_context` — a thin routing index that unfolds progressively, so a session spends tokens only on the tools it actually fires; the full tool surface stays behind drawers until needed. The optional `mojulo-orient` gallery gives consent-first guided tours that mint real starter artifacts.

## Why it's different

- **Keyless.** Installed from npm, runs on your machine, nothing to sign up for. The MCP binds to localhost only.
- **Recipes, not renders.** Creative artifacts are seeded deterministic recipes — diffable, replayable, re-mintable on any mojulo host. Painted images and audio renders are derived files with provenance, never the sovereign artifact.
- **It remembers why.** Every artifact is minted beside an append-only record of intent (the contextmap), so a fresh session reconstructs prior decisions and improves the existing outcome instead of minting a stranger next to it.
- **Verification gates.** Bots are hash-chain auditable (`verify_chain`), games are completability-gated, workflows dry-run before they promote.

## Dashboard

```bash
npx -y -p mojulo mojulo-ui                # auto-port, opens browser
npx -y -p mojulo mojulo-ui --port 3999    # pin the port
npx -y -p mojulo mojulo-ui --no-open      # skip browser launch
```

Same primitives as the MCP, different face: browse conversations and fleet analytics, walk your worlds, play your games in the Arcade, review game projects at a glance. It renders state and hands authoring back to your agent — the workshop is driven from the conversation.

## 1.0

From `1.0.0` the five paradigm loops (bot · connected service · app · media · game) and the recipe format are the stable surface: additive-only DB migrations, deterministic re-render of stored recipes, loopback-only transport. The creative vocabularies keep growing in minor releases. See the [changelog](https://github.com/zombico/mojulo/blob/main/control/CHANGELOG.md).

## More

- Full repo and docs: <https://github.com/zombico/mojulo>
- Architecture: [docs/BOT-ARCHITECTURE.md](https://github.com/zombico/mojulo/blob/main/docs/BOT-ARCHITECTURE.md) (bot factory + artifact lifecycle), [docs/MCP-ARCHITECTURE.md](https://github.com/zombico/mojulo/blob/main/docs/MCP-ARCHITECTURE.md) (MCP control surface), [docs/POLYGONIZER-SYNTHESIS.md](https://github.com/zombico/mojulo/blob/main/docs/POLYGONIZER-SYNTHESIS.md) (the visual substrate)
- MCP integration: [docs/mcp-integration.md](https://github.com/zombico/mojulo/blob/main/docs/mcp-integration.md)
- Catalysts: [docs/catalysts.md](https://github.com/zombico/mojulo/blob/main/docs/catalysts.md)
- Terms & responsibility model: [TERMS.md](https://github.com/zombico/mojulo/blob/main/TERMS.md), [docs/responsibility-model.md](https://github.com/zombico/mojulo/blob/main/docs/responsibility-model.md)

## License

[Apache License 2.0](https://github.com/zombico/mojulo/blob/main/LICENSE)
