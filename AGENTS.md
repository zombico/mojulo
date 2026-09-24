# AGENTS.md

Orientation for non-Claude agents (Codex, Grok Build, Hermes, other MCP hosts) working in this repo. Claude Code reads [CLAUDE.md](CLAUDE.md) — the fast orientation and golden rules there are host-neutral and apply to you too; read it first. Use [docs/AGENT-REFERENCE.md](docs/AGENT-REFERENCE.md) when you need the deeper MCP/runtime/data map. This file only covers what a non-Claude host needs *before* mojulo's MCP tools are connected, plus pointers to its own host adapter.

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

### Grok Build

Add to `~/.grok/config.toml` (same stanza shape as Codex):

```toml
[mcp_servers.mojulo]
url = "http://localhost:3001/api/mcp"
headers = { Authorization = "Bearer <CONTROL_PLANE_MCP_KEY>" }
startup_timeout_sec = 120
```

For a non-repo install, use the tokenless stdio form instead — `command = "npx"`, `args = ["-y", "mojulo"]`, same `startup_timeout_sec` (the first run fetches the package; a default timeout marks the server dead mid-download). Needs Node ≥22.12. `npx mojulo init` writes this stanza for you.

**Two Grok-specific notes.** Your MCP output cap (~20k) is below several mojulo surfaces — never call `get_tool_index`; start at `forward_context` and pull one drawer at a time. And you carry `image_gen`/`image_edit`, so you are your own image worker: mint the scaffold, paint it yourself, bind it back with `bind_image_render`. Studio sessions: `get_adapter` once before the first mint — the card is the rider (form-split, paint-and-bind, `when` line), not only a catalyst-skill writer. Details in [control/lib/mcp/adapters/grok-build.md](control/lib/mcp/adapters/grok-build.md).

### Hermes

**Use stdio, not HTTP.** The stdio front door (`command = "npx"`, `args = ["-y", "mojulo"]`) is tokenless and host-spawned, so the interactive bearer-token prompt never fires and a dead control plane becomes a spawn failure at session start instead of a mid-task hang. Give it a ≥120s startup timeout; needs Node ≥22.12.

`npx mojulo init` detects Hermes but does **not** write its config — the file path and format aren't verified, and writing to a guessed path would report success against a file Hermes never reads. It prints the snippet for you to paste. If you can confirm the real path and format from your own runtime, say so: it's a small edit to [control/lib/mcp/hosts/hermes.json](control/lib/mcp/hosts/hermes.json) and it moves Hermes onto the same footing as Claude Code and Codex. Adapter card: [control/lib/mcp/adapters/hermes.md](control/lib/mcp/adapters/hermes.md).

### Shell fallback (no MCP registration needed)

If you have shell access but no MCP client, the same registry is reachable as a CLI: `node control/scripts/mcp-stdio.mjs orient|tools|packs|help <tool>|call <tool> --json '{…}'`. Run `orient` first: a shell caller never sends `initialize`, so that command prints the same preamble an MCP client is handed at connect, translated to the bin's forms, and names `MOJULO_HOST` / `MOJULO_SURFACE`. It runs in-process against the same data (no control plane, no bearer token); results print to stdout, diagnostics to stderr, exit codes 0/1/2 (124 on `--timeout`).

### Inside a box (the agent's own machine)

When mojulo runs inside your own box — a disk the operator never sees — every export has to leave through the door your host already has, and the dashboard's loopback URL is not one. Every written export (`export_model`, `export_game`, `cook`) returns a `handoff` naming this host's door and `fits` against its byte limit; the door table is data, one JSON profile per host in [control/lib/mcp/hosts/](control/lib/mcp/hosts/), each marked `field` / `docs` / `inferred` for how it was established. `clientInfo` cannot tell a host's local surface from its box, so set `MOJULO_SURFACE=box` when you are in one (the note states both rows when it is unset), and `MOJULO_HOST=<profile id>` on the CLI, which never sees an `initialize`.

| Host surface | The box | Page door | File door | The ask |
|---|---|---|---|---|
| Claude Code on the web | ephemeral VM, egress allowlisted | the Artifact tool: one self-contained `world.html` ≤ 16 MiB (`cdn: true` when close) | the bundle's `<ref>.courier.html` published with `capabilities: { downloads: true }` — its Save button hands over the zip (no archive or model rides as a supporting file, and a page cannot start a download itself) — or the branch | `format: 'html'` and `format: 'bundle'` |
| Codex cloud task | ephemeral, internet off by default | none | the PR carries the outcome folder or `<ref>.zip` | `format: 'bundle'`, commit the folder |
| Grok chat's sandbox | ephemeral, no MCP client | file card (`world.html` opens from `file://`) | file card ≤ 25 MB | `npx mojulo call export_model --json '{"ref":"…","format":"bundle"}'` |
| Grok Build CLI, Claude Desktop, Codex desktop, Hermes | none — the operator's machine | the dashboard or the host's preview | the file on disk | the path |

The shell-only case in detail (Grok chat's Linux container is the field-run case): no MCP client, no dashboard and usually no browser, so do not run `init` or `mojulo-ui` there. Orient with `npx mojulo orient`, health-check with `npx mojulo call version`; learn a tool with `npx mojulo help <tool>` and a world's dials with `call get_view_vocab --json '{"id":"city"}'`; mint once with `call compose_world --json '{…}'`; then `call export_model --json '{"ref":"<ref>","format":"bundle"}'` for one zip — `world.html` (opens straight from `file://`, no server, no network), `model.glb`, `model.stl` for literal-scale kinds, `recipe.json`, README — or `"format":"html"` / `"glb"` for one file. The export folder under `~/.mojulo/data/outcomes/<ref>/` holds the same files unzipped. Because the sandbox disk may be wiped between conversations, the recipe JSON (or the `compose_world` arguments) is what to keep: any host running mojulo re-mints it. Name collision to keep straight: **Grok Build** is xAI's CLI agent with a real MCP config (the section above, [grok-build.md](control/lib/mcp/adapters/grok-build.md)); **Grok chat** in its sandbox is this CLI-only class, `get_adapter` cannot resolve it because there is no MCP `clientInfo` to read, and `MOJULO_HOST=grok-chat` is how its door table is reached.

### Cross-host reference

For comparison, Claude Code uses `claude mcp add --transport http mojulo http://localhost:3001/api/mcp --header "Authorization: Bearer <CONTROL_PLANE_MCP_KEY>"`. The full install matrix (Claude Desktop, Claude Code, mcp-inspector) is in [docs/mcp-integration.md](docs/mcp-integration.md).

## After you're connected

- Call `forward_context` once at session start. The `initialize` preamble is deliberately tiny, and `forward_context` stays intentionally lean; heavier orientation lives behind its sibling drawers.
- When a mojulo tool **rejects an input the schema appears to permit** (a motion spec, a nested object, an enum-like string), isolate the constraint with a minimal probe before falling back — do not treat the first rejection as the tool's true limit. Most such rejections are a param that needs an explicit shape (author nested values as real JSON objects, not stringified) or an unknown name where a clear error lists the valid set. Read that error; it usually names the fix. Reach for a different family only once you've confirmed the surface actually can't express the request.
- Read **your own host adapter** once per session before making or synthesizing — [codex.md](control/lib/mcp/adapters/codex.md), [grok-build.md](control/lib/mcp/adapters/grok-build.md), [hermes.md](control/lib/mcp/adapters/hermes.md), or [generic.md](control/lib/mcp/adapters/generic.md); `get_adapter` resolves yours from your `clientInfo`. It is the first-session card for how you ride this substrate (Grok: native image as the paint worker). For catalysts it also names the artifact target (a Codex automation, a `~/.grok/skills/` skill, a workspace workflow file, an inline one-shot), how to bake the dry-run pattern in, where to put cursors, and how to handle secrets.
- The catalyst body itself ([control/lib/mcp/catalysts/](control/lib/mcp/catalysts/)) is host-neutral. Combine it with your adapter's rules to produce the runnable artifact — don't write `.claude/skills/` files; that's Claude-specific, and a host that compat-scans it (Grok does) still deserves its own native layout.

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
