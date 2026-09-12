# Mojulo

![A coding agent wired to mojulo over MCP: "build a 20 by 24 ft living room with a door on the south wall" mints a 12-line floorplan recipe, the dashboard shows the furnished room shaded with turnable views and HTML / glb / STL downloads, "add pot lights to the ceiling" edits one field on the same recipe, a couch-facing fix lands in the kernel with the recipe unchanged, and the same recipe renders in Blender Cycles before and after — same seed, same camera](https://raw.githubusercontent.com/zombico/mojulo/main/docs/images/lounge-handoff-demo.gif)

Mojulo is a 3D factory for agents: a local MCP server where everything your coding agent makes is a small recipe it can re-run identically.

```bash
npx mojulo init
```

That wires mojulo into the coding agents on this machine (Claude Code, Codex, Claude Desktop — one yes/no each) and opens the dashboard. Node 22.12+. No API key; your agent is the reasoning loop.

You talk to the agent you already run; it does the reasoning, and mojulo is the machine it works in. Build **objects, worlds, and games by conversation.** An object blocks out at literal scale, a world is a place you can walk, a level is a world under a game contract, a game composes the levels — and music folds in as an asset, synthesized from seeded math with no samples. Each rung is a small deterministic **recipe**: readable, seeded to regenerate identically, never a render.

**Two pipelines out.** DIGITAL: worlds, levels and scenes render dependency-free in the browser and export to **Godot** as a real project, to **Unity** and **Unreal** as a data pack plus importer (each with an advisory gate when the engine is installed), and to **Blender** as an art-pass pack — with `.glb` and OpenUSD for everything else. PHYSICAL: objects, vehicles and wordmarks export as **print-ready STL or 3MF at true scale** — mm units, z-up, slicer-ready, with a slicer gate that stamps what it measured.

Mojulo is the **upstream** that feeds the tools you already use. It does not try to out-render a game engine, and it is not just an exporter: the recipe is where the thing is born and re-renders; the engine or the printer is where it is optionally finished. Every handoff carries a ledger of what did not travel.

**Not a second brain — a body.** Your agent is the only intelligence in the loop. Mojulo holds state, runtime, and the audit trail, and needs no LLM credentials of its own. Optional local workers — Blender, a slicer, a mesh sculptor — are yours to host and never dependencies.

The bins, one install:

- `mojulo` — stdio MCP server (`npx -y mojulo`, wired into Claude Code, Codex, or any other MCP host); also the installer and a CLI front door (below).
- `mojulo-ui` — local dashboard (`npx -y -p mojulo mojulo-ui`).
- `mojulo-config` — provider key CLI, only needed for directed images or the optional chatbot pack.

`mojulo` and `mojulo-ui` share the same `~/.mojulo/` state, so anything you mint from your agent shows up in the dashboard immediately.

## Quickstart

Prerequisite: **Node.js 22.12+** (`node --version`). Everything below runs through
`npx`, which ships with Node — if you don't have it, install it from
[nodejs.org](https://nodejs.org), or ask your coding agent to install it for you.
No provider key: your agent is the reasoning loop. Verified on macOS (Apple Silicon),
on native Windows (`init` and a first render, under Claude Code), and, for a cold
install, on Linux x64 and arm64.

```bash
# 1. Wire mojulo into your MCP-capable agent. The one-shot installer detects
#    the MCP hosts on this machine by declared profile (Claude Code, Codex,
#    Claude Desktop, and others), asks y/n per host, and opens the dashboard:
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

# 2. In an agent session, just ask:
#      what is this?                      → mojulo orients itself, out loud
#      make me a coffee mug, 90 mm tall   → a solid; download the .stl
#      generate a 3D city at night        → a world; open the /scene URL
#      turn that into a game              → a game; export it for Godot

# 3. Optional. The chatbot factory is an install-gated pack (a compiled bot
#    is the one artifact that needs an LLM key of its own):
#      npx -y -p mojulo mojulo install chatbot
#      npx -y -p mojulo mojulo-config set anthropic sk-ant-...
```

First install is the big one: npx pulls a ~36 MB tarball plus its native dependencies
(measured at about 985 MB on disk), and the first launch fetches a ~130 MB embedding
model in the background. Measured sizes, lazy downloads, and what each engine leg
needs: [docs/tech-requirements.md](https://github.com/zombico/mojulo/blob/main/docs/tech-requirements.md).

**Why these dependencies.** The install is mostly three things, and all of them run on your machine.
`onnxruntime-node` and `@huggingface/transformers` run the *local* search model behind
`semantic_search` — the runtime ships binaries for every platform in one package, which is most
of the size. `puppeteer-core` drives a *local* headless Chrome for stills and bakes; the browser
itself is fetched on first use, or skipped if you already have Chrome. `better-sqlite3` is the one
database file under `~/.mojulo/`. Nothing in that list reaches the network on its own. The
per-dependency sheet, with sizes, is in the same tech-requirements page.

### CLI

The same `mojulo` bin doubles as a command-line front door over the same
engine and data — no agent, no dashboard, no API key required. Useful for
spot checks, cron jobs, and CI:

```bash
npx mojulo tools                      # the connect surface: spine + packs
npx mojulo tools pack_object          # one pack's members
npx mojulo packs                      # pack ids with their recognizers
npx mojulo help export_model          # full description + input schema
npx mojulo call version               # invoke any tool
npx mojulo call export_model --json '{"ref":"sk_…","format":"3mf"}'
npx mojulo pack_object                # open a pack: orientation + member manual
```

Arguments can be inline JSON (`--json '{…}'`, `@file.json`, or `-` for
stdin) or per-property flags derived from the tool's schema
(`--theme dungeon --seed 7`; flags win over `--json`). `--timeout <ms>`
bounds long-poll tools (exit code 124), `--quiet` keeps only the exit code
(0 success, 1 tool error, 2 usage). Results print to stdout as-is, so
`npx mojulo call version | jq .` works; diagnostics go to stderr. Bare
`npx mojulo` remains the stdio MCP server.

## What you can make

- **"Model me a bracket that fits this shelf"** → a solid at literal scale on the workbench: lathes, sweeps, extrudes, fields; a hole is a line in the recipe; parts seat by declared relation. Measured without exporting, then out as print-ready STL or 3MF with process-aware print advisories — the conversation ends at the printer.
- **"A posed archer" / "a wolf, mid-stride"** → figures and animals on one armature, with gaits and emotes; rigs export as glTF clips, skinned meshes, or VRM humanoids.
- **"A six-storey building with a set-back penthouse" / "a walkable city at dusk"** → furnished floorplans that stack, bespoke buildings, caves and dungeons, cities, transit hubs, campuses, landscapes — every one a place you can walk, and every one exportable.
- **"Make me a game"** → composition: levels, music, and figures bound to a typed store with rules — playable standalone, or exported as a **Godot** project, a **Unity** pack, or an **Unreal** pack. 2D reducer games land in the built-in Arcade.
- **"An ambient loop for it"** → music and SFX from seeded math, never samples; worlds opt in to soundtracks and footsteps; a score exports as WAV or MIDI.
- **"Here's a photo of the room"** → your agent is the vision adapter: it recovers a room's perspective, a figure's pose, or an object's part-graph as a scaffold. No vision key; the image never reaches mojulo.

Iterate in place — `update_sketch` changes a field on the stored recipe; nothing is re-minted — and keep what you tuned: `save_recipe` writes it to a cookbook of plain files in a local git repo with no remote, recallable by intent in a later session. Attach the public [recipe book](https://github.com/zombico/mojulo-recipe-book) to add chapters and whole new kinds from disk.

Also in the box, present by default and never in the way: diagrams and charts, directed images an external model paints, publications, research, plans, local apps whose inference parks back on your agent, and connected services over the MCPs you already run. The chatbot factory is opt-in.

## Why it's different

- **Keyless.** Installed from npm, runs on your machine, nothing to sign up for. The stdio MCP has no network surface; the HTTP route is bearer-gated and 404s without a key.
- **Recipes, not renders.** Every artifact is a seeded deterministic recipe — diffable, replayable, re-mintable on any mojulo host. Exports and painted renders are derived files with provenance, never the sovereign artifact.
- **Two gates, never conflated.** A machine gate imports the pack headless when the engine or slicer is installed and stamps what it measured; a human looking at the result is the eyes gate. Gates advise; none refuse, and none claim the other one passed.
- **It remembers why — where that matters.** Connected services and apps are sealed beside an append-only record of intent (the contextmap), so a fresh session improves the existing wiring instead of minting a stranger next to it. Studio artifacts are recalled by ref, by semantic search, and by their cookbook card.
- **Pay for what you install.** The kernel plus the creative studio is the default; the chatbot factory is opt-in (`mojulo install chatbot`). Uninstalled packs neither list nor run, so your agent's context isn't spent on tools this host doesn't have.

## Dashboard

```bash
npx -y -p mojulo mojulo-ui                # auto-port, opens browser
npx -y -p mojulo mojulo-ui --port 3999    # pin the port
npx -y -p mojulo mojulo-ui --no-open      # skip browser launch
```

Same primitives as the MCP, different face: **Studio** leads and opens by default — browse the Library, walk your worlds, play your games in the Arcade, review motion, beats, and voice at a glance — with **Ideate** (research, plans, stashes) beside it and **Operate** tiles appearing only once something actually runs there. It renders state and hands authoring back to your agent — the workshop is driven from the conversation.

The dashboard starts in English but ships fully translated in every locale under `messages/`, including right-to-left scripts — switch anytime under **Settings → Language**; the choice is remembered per browser.

## Stability

The five paradigm loops (media · game · connected service · app · bot) and the recipe format are the stable surface: additive-only DB migrations, deterministic re-render of stored recipes, loopback-only transport. A kernel's output for given params is a compatibility promise over already-minted rows. The creative vocabularies keep growing in minor releases. See the [changelog](https://github.com/zombico/mojulo/blob/main/control/CHANGELOG.md).

## More

- Full repo and docs: <https://github.com/zombico/mojulo>
- What it needs: [docs/tech-requirements.md](https://github.com/zombico/mojulo/blob/main/docs/tech-requirements.md) (footprint, engine legs, slicers, workers, platform notes)
- The handoff doctrine: [docs/bicycles.md](https://github.com/zombico/mojulo/blob/main/docs/bicycles.md) (machine gate, eyes gate); the Unreal worked example: [docs/examples/unreal-night-run/](https://github.com/zombico/mojulo/blob/main/docs/examples/unreal-night-run/)
- Optional workers: [Blender](https://github.com/zombico/mojulo/blob/main/docs/local-blender-worker.md), [slicers](https://github.com/zombico/mojulo/blob/main/docs/local-slicer-worker.md), [mesh sculptors](https://github.com/zombico/mojulo/blob/main/docs/local-mesh-worker.md), [image](https://github.com/zombico/mojulo/blob/main/docs/local-image-worker.md), [voice](https://github.com/zombico/mojulo/blob/main/docs/local-voice-worker.md)
- Architecture: [docs/MCP-ARCHITECTURE.md](https://github.com/zombico/mojulo/blob/main/docs/MCP-ARCHITECTURE.md) (the headless control surface), [docs/AGENT-REFERENCE.md](https://github.com/zombico/mojulo/blob/main/docs/AGENT-REFERENCE.md) (the creative substrate, data layout), [docs/POLYGONIZER-SYNTHESIS.md](https://github.com/zombico/mojulo/blob/main/docs/POLYGONIZER-SYNTHESIS.md) (the geometry substrate)
- MCP integration: [docs/mcp-integration.md](https://github.com/zombico/mojulo/blob/main/docs/mcp-integration.md); catalysts: [docs/catalysts.md](https://github.com/zombico/mojulo/blob/main/docs/catalysts.md); the optional chatbot pack: [docs/chatbot/](https://github.com/zombico/mojulo/blob/main/docs/chatbot/)
- Terms & responsibility model: [TERMS.md](https://github.com/zombico/mojulo/blob/main/TERMS.md), [docs/responsibility-model.md](https://github.com/zombico/mojulo/blob/main/docs/responsibility-model.md)

## License

[Apache License 2.0](https://github.com/zombico/mojulo/blob/main/LICENSE)
