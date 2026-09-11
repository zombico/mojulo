# Mojulo

[![npm](https://img.shields.io/npm/v/mojulo)](https://www.npmjs.com/package/mojulo)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)
[![node](https://img.shields.io/badge/node-%E2%89%A522.12-brightgreen)](control/package.json)

![A coding agent wired to mojulo over MCP: "build a 20 by 24 ft living room with a door on the south wall" mints a 12-line floorplan recipe, the dashboard shows the furnished room shaded with turnable views and HTML / glb / STL downloads, "add pot lights to the ceiling" edits one field on the same recipe, a couch-facing fix lands in the kernel with the recipe unchanged, and the same recipe renders in Blender Cycles before and after — same seed, same camera](docs/images/lounge-handoff-demo.gif)

<sub>One conversation, one recipe. <i>"Build a 20 by 24 ft living room with a door on the south wall"</i> mints a twelve-line floorplan recipe (`create_sketch`, kind <code>floorplan</code>) — walls, windows, sofa, two chairs, rug, lamp — served shaded and turnable at <code>/sketches/&lt;ref&gt;</code>. <i>"Add pot lights"</i> flips one field on the stored recipe (`update_sketch`); nothing is re-minted. <i>"The couch has its back to the TV"</i> is not the recipe's fault: a two-line kernel fix turns the sofa, and every lounge in every floorplan re-renders seated toward the screen while this recipe stays the same twelve lines, same seed. The handoff is the same file rendered in Blender Cycles, before and after, same camera. No key, no cloud render.</sub>

Mojulo is a 3D factory for agents: a local MCP server where everything your coding agent makes is a small recipe it can re-run identically.

**Install:** `npx mojulo init` — detects the MCP hosts on your machine (Claude Code, Codex, Claude Desktop, and others by declared profile), wires mojulo in, opens the dashboard. No API key needed. [Quickstart ↓](#quickstart)

**Mojulo is a 3D factory for agents** — local, yours, not a hosted service. Point the agent you already run (Claude Code, Codex) at it and build **objects, worlds, and games by conversation**: you talk; the agent does the generating and the reasoning. Mojulo catches that output as a deterministic **recipe** on your own disk — a few kilobytes of parameters that regenerate identically, are editable a line at a time, and outlive the chat.

**One ladder.** An **object** blocks out at literal scale. A **world** is a place you can walk. A **level** is a world minted under a game contract. A **game** composes the levels. Every rung is the same kind of recipe — deterministic geometry built from primitives on your machine, no image model, no cloud render, **no provider key** — so pieces compose upward, and **sound comes free**: SFX and music synthesized from pure math and seeded dice, no samples.

**Two pipelines out.** DIGITAL: worlds, levels and scenes render dependency-free in the browser (CSS-3D, WebGL) and export to **Godot** as a real project, to **Unity** and **Unreal** as a data pack plus importer (each with an advisory gate when the engine is installed), and to **Blender** as an art-pass pack — with `.glb` and OpenUSD for everything else. PHYSICAL: objects, vehicles and wordmarks export as **print-ready STL or 3MF at true scale** — mm units, z-up, slicer-ready, with a slicer gate that stamps what it measured — so a conversation ends at your 3D printer; figures and worlds print as maquettes fit to a size you choose.

**Mojulo feeds the tools you already use; it does not compete with them.** It is the agent-driven upstream — it authors the truth at home, and the edge tool consumes it without guessing at the seam. It is not a renderer trying to out-render Unreal, and it is not merely an exporter: the recipe is where the thing is born, lives, and re-renders. The engine or the printer is where it is optionally *finished*.

**Not a second brain — a body.** Your agent is the only intelligence in the loop. Mojulo holds state, runtime, and the audit trail, and needs no LLM credentials of its own: photo references are read by the agent's eyes, games are verified by agent-compiled traversals, and the reasoning bill stays on your existing Claude or ChatGPT subscription.

---

## What you can make

Every kind below is a recipe your agent mints from a sentence, iterates in place, and hands off through the same doors ([Where it goes](#where-it-goes)). Find a kind by intent with `sketch_what_possible` or `semantic_search`; read its manual with `get_solid_vocab` / `get_view_vocab` before passing a spec.

**Objects, at literal scale.**

- **Parts and mechanisms** — `mint_solid` on the workbench: lathes, sweeps, extrudes, lofts and field solids in real millimetres; **booleans are a line in the recipe** (`cuts[]` names a body and the parts that bore or intersect it); assemblies seat parts by declared relation ("the mug on the table"), not coordinates. `measure_solid` reads bounds, printed size, closure, Manifold volume and genus, overhang and wall thickness off the stored recipe without exporting.
- **Figures and animals** — a posed human body (stances, a reach, a walking gait, named emotes) and the same armature reoriented horizontal for dressed species and bare archetypes from rodent to theropod. Rigs export as glTF clips, as skinned meshes, or with VRM humanoid bone names.
- **Vehicles, wordmarks, everyday things** — vehicle-family instances, carved metal or bevelled wordmarks and badges, turntable solids, and blocked-out objects (a candlestick, a lamp, a snowman with a top hat).
- **Machina** — `verify_machina` checks a mechanism chain (levers, pulleys, screws, inclines) against a load: work conservation, force capacity, rate and storage margins. A verdict, not a picture.

**Places, walkable.**

- **Buildings and interiors** — furnished floorplans that stack (`levels[]` gives a building storeys, stairs through the slabs, set-back terraces as real decks), bespoke buildings authored as masses and concourses, and caves and dungeons grown procedurally. All traversable, all exportable.
- **Cities, hubs and campuses** — `compose_world` picks a base (a recursive skyline, an airport or station, a K-12 campus, a planetary body, a walkable Cayley graph) and a theme, then takes the base's own knobs. A city declares what one unit is in metres, so mechanics and exports scale with it.
- **Landscapes** — painterly terrain composed from sky, palette and geometry glyphs, or map-backed from real geo data.
- **Drivable worlds** — a live world you walk, fly or platform through, with the camera and entities as first-class primitives; an `action` base adds rules (score, timer, spawns, pickups). Opt-in WebXR on walkable worlds. A volumetric effects layer rides over the mesh.
- **Study objects** — animated science and math explainers (fission, the double slit, a derivative, DNA) from one kind plus a few knobs. The catalog is open: an attached recipe book adds chapters and whole new kinds.

**Games, composed.**

- `create_game` binds levels, music, figures and sprites by ref into a standalone playable artifact: a shell that owns a typed store (character, inventory, party, progression, flags) and a list of levels minted under a `game:` contract. Improve a bound world or score and the game inherits it. Arcade cabinets compile 2D reducer games to a single HTML file.
- `export_game` writes the game to a plain folder you host anywhere, or emits a Godot, Unity or Unreal pack instead. Play data never enters mojulo.

**Assets that fold in.**

- **Sound** — Beats synthesizes ambient loops, grooves, SFX cues, footsteps and full scores from seeded math, never samples; a part can sing; a deterministic voice register narrates. Worlds opt in to soundtracks; a score exports as WAV or MIDI.
- **From a photo** — your agent is the vision adapter: show it a picture and `reference_protocol` → `capture_reference` recover a room's perspective, a figure's pose, a landscape's gesture, or an object's part-graph as a scaffold. No vision key; the image never reaches mojulo.
- **Skins and surface detail** — a polygomer or figure can wear a painted skin; a mesh sculpted outside (TripoSR, Hunyuan3D, a cloud API, a hand pass in Blender) binds back to its recipe with hash provenance.
- **Motion** — any of the above set moving: a turntable, an orbit, a fly-through, baked to a GIF with `forge_motion`; clips stitch into an MP4.

![A terminal prompt — "create a snowman with a top hat" — becomes a bonded part-graph recipe, then the shaded snowman in the dashboard viewer with turnable views and HTML / glb / STL downloads — no API key, no image model](docs/images/snowman-demo.gif)

<sub>One prompt: <i>"Connect to mojulo and create a snowman with a top hat."</i> Your agent mints a bonded part-graph (`mint_solid` — three snowballs, a brimmed top hat, twig arms, a carrot nose, coal buttons, a scarf) as an editable deterministic recipe, then iterates coloration in place on the same ref. The dashboard serves the shaded model with turnable views at `/sketches/top_hat_snowman`; the same ref downloads as a self-contained HTML viewer, a <code>.glb</code> for Blender or Godot, or a print-ready <code>.stl</code>. No key, no cloud render.</sub>

---

## Where it goes

**One geometry spec, several targets, all off a single minted ref:** `/api/sketches/<ref>/{svg,scene,world,model.glb,model.stl,model.3mf,model.usdz}`. Each URL regenerates the file deterministically on request. Each emitter owns its own frame and unit conversion from mojulo's native z-up metres, and every handoff carries an **honest-loss ledger** naming what did not travel.

| Target | What you get | The gate |
|---|---|---|
| **Browser** | A still SVG; a dependency-free CSS-3D `preserve-3d` scene (real 3D in a plain HTML file, no WebGL, no build step); a traversable WebGL world you walk with WASD. | Your eyes. |
| **`.glb`** | glTF with mojulo's lighting baked into vertex colours and exported unlit, so it looks identical from any camera with no setup downstream — or `lit` for real PBR materials the engine lights itself. Rig clips as animations, skinned meshes, VRM humanoid names, optional quantization. Opens in Blender, three.js, Quick Look. | The USD/GLB verify gate, when Blender is installed. |
| **OpenUSD** | `usda` / `usdz` for DCC interchange and AR Quick Look at true scale. | `usdcat` and Blender, both optional. |
| **Godot** (first-class) | A real Godot 4 project: `project.godot`, the versioned `mojulo-godot` kernel scripts, the GLB, `score.json`, export presets. Playable when the gameplay is declarative. | Headless import and a one-frame run of every scene, when `MOJULO_GODOT` names the binary. |
| **Unity** (gated leg) | A data pack — GLB, `score.json`, audio, recipe — plus a C# editor importer, runtime scripts (walker, mechanics, menu), deterministic `.meta` files and a T-numbered import guide. | A scratch project imported headless, when `MOJULO_UNITY` names the editor. |
| **Unreal** (gated leg) | The same data pack plus a dependency-free editor Python importer; game packs add the `MojuloKernel` C++ plugin your project compiles. Worked example: [Night Run](docs/examples/unreal-night-run/), three levels minted by conversation under Epic's own animated character. | A scratch project imported headless, when `MOJULO_UNREAL` names the editor. |
| **Blender** (art pass) | An art-pass pack — GLB, `pack.json`, two Python scripts, a guide — and, in the other direction, a Cycles bake of traced global illumination back into the geometry's own vertex colours, so the lit result runs anywhere at zero runtime cost. | The pack's own importer run headless, when `MOJULO_BLENDER` names the binary. |
| **STL / 3MF** | Print-ready at true scale: mm, z-up, slicer-ready. 3MF declares its units in-file and carries colours and instanced repeats; `union: true` fuses the shells into one measured solid through Manifold. Print advisories know the process (FDM, SLA, SLS, MJF): wall floors, self-support angle, overhang area, bores that will close up. Figures, worlds and views print as maquettes fit to a target size. | A local slicer run headless over the 3MF, stamping layers, time, filament and supports beside it. PrusaSlicer and Bambu Studio verified. |

The ladder is honest on purpose: **Godot first-class, Unity and Unreal as gated legs, Blender as an art pass.** Never "identical across all four." Every export works with nothing installed — the pack and its import guide are written and the gate reports "skipped" with the reason. Installing the engine adds the machine gate. Gates advise and stamp; none refuse. A human looking at the result in the engine or in the slicer is the eyes gate, and no gate ever claims that one passed. Doctrine: [docs/bicycles.md](docs/bicycles.md). Engine versions, what each leg needs, and platform notes: [docs/tech-requirements.md](docs/tech-requirements.md).

Speak modeler? `translate_modeler_lingo` maps pipeline vocabulary (blockout, kitbash, set dressing, base mesh, LOD, lookdev turntable) to the right entry tool and the `.glb` handoff, and says plainly which steps — retopo, UV unwrap, normal bakes, PBR authoring — belong in your DCC, not here.

![A described mug — two lathes and a swept handle — gravity-seated on a table, shown as flat albedo on mojulo's measured studio grid under the default house light](docs/images/object-bake-before.jpg) ![The same object recipe after one optional trip through a local Blender Cycles bake — traced global illumination baked into the geometry's own vertex colours, grounded contact shadows, studio backdrop](docs/images/object-bake-after.jpg)

<sub>The same described object — a mug (two lathes + a swept handle) seated on a table by declared relation, not coordinates. <b>Left:</b> mojulo's house light, on the workbench's measured grid. <b>Right:</b> the same recipe after one optional pass through a local Blender Cycles bake — the traced light lands in the mesh's own vertex colours, so the lit result runs anywhere with no Blender and zero runtime cost. Every frame is from one real run. See <a href="docs/local-blender-worker.md">docs/local-blender-worker.md</a>.</sub>

---

## Recipes, not renders

Everything above is a few kilobytes of parameters plus a `kind`. A kernel regenerates it on every read, so nothing is a stored render, and a kernel's output for given params is a compatibility promise: same seed, same file, byte for byte. Renders under `data/outcomes/` are derived and disposable.

- **Iterate in place.** `update_sketch` changes a field on the stored recipe; `edit_solid` dresses or emotes a minted solid; `diff_sketches` shows what moved. You review what the model made the way you review code: as a diff, kept or reverted a line at a time. Don't re-mint what you can edit.
- **Keep what you tuned.** `save_recipe` promotes a recipe into your **cookbook** at `~/.mojulo/data/cookbook` — plain `card.md` + `recipe.json` folders in a local git repo with **no remote**. Your agent writes the card's `when` line from the conversation, so months later a paraphrase recalls it through `semantic_search` and it re-mints exactly.
- **Extend the catalog from disk.** [mojulo-recipe-book](https://github.com/zombico/mojulo-recipe-book) is a public catalog you clone and point `MOJULO_RECIPE_BOOK` at — chapters of solids, worlds, loops, shots and study objects. Some entries are params over kinds mojulo already has; others are builders that add a whole new kind without touching core. Strictly additive, never fetched at runtime. A cookbook **is** a book, same format, so a friend can clone yours as their upstream. Precedence is first-wins: core kinds > your cookbook > any attached book.

---

## Quickstart

The fastest path: don't install anything yourself. Paste this into the coding
agent you already run (Claude Code, Codex) and let it drive — it checks the
machine first, reports what it found, and asks before installing anything:

```text
Help me install mojulo — a free, local 3D factory you'll drive over MCP.
Orientation, if you can fetch it: https://mojulo.ai/llms.txt
(mirror if the site is down: https://github.com/zombico/mojulo)

1. First just check: run `node --version`. Mojulo needs Node 22.12+.
   Tell me what you found before changing anything.
2. If Node is missing or too old, ask my permission, then install it
   the way this machine expects (brew / winget / nvm / apt).
3. With my go-ahead, run `npx mojulo init`. It wires mojulo into the
   coding agents on this machine (one yes/no per host) and opens a
   dashboard at localhost:3001. Everything stays on my machine.
4. When it finishes, tell me to open a fresh session and ask you:
   "what is this?"

Never install anything without asking me first.
```

Driving it yourself instead? You need two things installed first:

1. **Node.js 22.12 or newer** — mojulo is installed and run through `npx`, which ships
   with Node. Check with `node --version`; if you don't have it (or it's older than
   22.12), install it from [nodejs.org](https://nodejs.org) — or ask your coding
   agent to install it for you.
2. A **desktop coding agent** (Claude Code/Codex) or a high-end local model —
   mojulo is model-agnostic and runs on whatever model your harness provides.
   (Claude Desktop works too — `init` detects and wires it — but a coding agent
   gets more out of the workshop.)

Platforms, honestly: built and verified on macOS (Apple Silicon). Linux runs the test
suite in CI and a cold install of 2.0.1 was checked on x64 and arm64 containers. Windows
was verified natively with Claude Code — `npx mojulo init` completed and a first render
landed — but Codex there, and the engine gates on any platform but macOS, have not been.
If you run it somewhere we haven't, open an issue with what you saw.

No provider key. Your agent is the reasoning loop, so objects, worlds, games,
scores and exports all run keyless. A key enters only when something has to
*paint* a directed image, or if you install the optional chatbot pack.

```bash
npx mojulo init
```

`init` detects your MCP host(s), wires mojulo into each (one yes/no per host),
and opens the dashboard at `http://localhost:3001` (or the next free port — the
installer prints the URL). Nothing is sent anywhere; state lands in `~/.mojulo/`.
The first install is the big one: npx pulls a ~35 MB package plus its native
dependencies (measured at about 970 MB on disk before any model), and the first
launch fetches a ~130 MB embedding model in the background — after that, starts
are instant. Measured sizes, lazy first-use downloads, and what each engine leg
needs: [docs/tech-requirements.md](docs/tech-requirements.md).

**Why these dependencies.** The install is mostly three things, and all of them run on your machine.
`onnxruntime-node` and `@huggingface/transformers` run the *local* search model behind
`semantic_search` — the runtime ships binaries for every platform in one package, which is most
of the size. `puppeteer-core` drives a *local* headless Chrome for stills and bakes; the browser
itself is fetched on first use, or skipped if you already have Chrome. `better-sqlite3` is the one
database file under `~/.mojulo/`. Nothing in that list reaches the network on its own. The
per-dependency sheet, with sizes, is in the same tech-requirements page.

The dashboard opens in English but ships fully translated in every locale under `control/messages/`,
including right-to-left scripts — switch anytime under **Settings → Language**.

On a slow connection, or if you'd rather your agent's first connect never wait on
npx resolving the package, install globally instead and re-run `init`:

```bash
npm install -g mojulo && mojulo init     # update later with: npm update -g mojulo
```

### First look — no key required

Back in your agent, try these in order. Each renders locally and hands you a URL:

```
what is this?                        → forward_context: mojulo orients itself, out loud
make me a coffee mug, 90 mm tall     → mint_solid (workbench) → open /sketches/<ref>, download the .stl
generate a 3D city at night          → compose_world (base: city) → open the /scene URL
make me a walkable world             → compose_world (base: controllable) → drive it at /world
turn those into a game               → create_game → play at /sketches/<ref>
export it for Godot                  → export_game { target: 'godot' } → open the project
```

The first prompt is the one to watch: your agent reads mojulo's own routing
index (`forward_context`) to decide what to do. That's the substrate explaining
itself — no key, no cloud call, nothing deployed.

### Handing off from the command line

The MCP tools cover every export. The CLIs add the machine gate and are what
you run when the engine is installed. Always from `control/`:

```bash
node scripts/export-godot.mjs   --ref <ref>          # Godot project + headless gate (MOJULO_GODOT)
node scripts/export-unity.mjs   --ref <ref>          # Unity pack + gate (MOJULO_UNITY)
node scripts/export-unreal.mjs  --ref <ref> --lit    # Unreal pack + gate (MOJULO_UNREAL); --lit lets the engine light it
node scripts/export-blender.mjs --ref <ref>          # Blender art-pass pack + gate (MOJULO_BLENDER)
node scripts/slice-print.mjs    --ref <ref>          # export the 3MF and slice it; stamps mojulo-print-gate.json (MOJULO_SLICER)
```

Every leg takes `--out <dir>` to write somewhere other than `data/outcomes/<ref>/`, `--no-gate` to
emit without the engine, and `--lit` for the PBR handoff. The slicer also takes `--3mf <file>` for a
file you already have and `--target-mm` to fit a maquette first.

### Optional workers for the 3D loop

Each is a separate install you host yourself; mojulo never starts or depends on
them, your agent is the bridge, and absence degrades one loop without breaking any.

- **Blender** — the GI bake into vertex colours, premium stills, and the USD/GLB verify gate. [docs/local-blender-worker.md](docs/local-blender-worker.md)
- **A slicer** — PrusaSlicer, Bambu Studio (OrcaSlicer is detected but not yet run) for the print gate. [docs/local-slicer-worker.md](docs/local-slicer-worker.md)
- **A mesh sculptor** — TripoSR, Hunyuan3D or a cloud API for high-frequency surface detail over mojulo's greybox; the result binds back with provenance. [docs/local-mesh-worker.md](docs/local-mesh-worker.md)
- **An image painter** — for directed images only: an image-capable agent, or a self-hosted ComfyUI + Qwen worker (large models, loopback only). [docs/local-image-worker.md](docs/local-image-worker.md)

### Manual wiring (if you prefer)

If you'd rather not run the installer, wire mojulo into your host directly:

```bash
# Claude Code (--scope user makes mojulo available in every project, not just this directory):
claude mcp add --scope user mojulo -- npx -y mojulo

# Codex: add to ~/.codex/config.toml
[mcp_servers.mojulo]
command = "npx"
args = ["-y", "mojulo"]
```

```jsonc
// Claude Desktop: add under "mcpServers" in claude_desktop_config.json
// (macOS: ~/Library/Application Support/Claude/ · Windows: %APPDATA%\Claude\)
// then restart Claude Desktop. If it fails to start with "spawn npx ENOENT",
// replace "npx" with the absolute path from `which npx` — the app's GUI
// environment often can't see nvm/homebrew installs.
"mojulo": { "command": "npx", "args": ["-y", "mojulo"] }
```

Open the dashboard separately anytime with `npx -y -p mojulo mojulo-ui`.

### Commands

`init` is the one command you need; these are the pieces it wires up, for reference:

- `npx mojulo init` — one-shot installer: detect hosts, wire each, optional key, open the dashboard.
- `npx -y mojulo` — the stdio MCP server itself (what `init` wires your agent to run).
- `npx -y -p mojulo mojulo-ui` — open the dashboard (`--port N`, `--no-open`).
- `npx -y -p mojulo mojulo-config set <provider> <key>` — store a provider key, encrypted (`anthropic` / `openai` / `ollama` / `fly`).

---

## What stays on your machine

- **Recipes.** Every object, world, game and score is a few kilobytes of parameters in SQLite at `~/.mojulo/mojulo-lite.db`. Renders are derived and disposable; the recipe is the thing you own.
- **Your cookbook.** Recipes you `save_recipe` land in `~/.mojulo/data/cookbook` as plain folders in their own git repo with **no remote**. Sharing is your act, with your git.
- **Derived outputs.** Exported `.glb` / `.usdz` / `.stl` / `.3mf` / `.wav` files, engine packs and game folders write to plain files you can open in anything. Nothing is locked to the runtime.
- **Encryption / keys.** Provider keys, if you save any, are AES-256-GCM encrypted at rest.

No telemetry. No phone-home. Outbound traffic is explicit and listed: npm at install; a handful of one-time lazy downloads on first use (the embedding model, a pinned browser for scene bakes if you have none, ffmpeg for MP4 stitching, geo data for map-backed landscapes); an update check when your agent asks for one; and whatever your agent and anything you deploy yourself initiate. Full list, with where each cache lands: [docs/tech-requirements.md](docs/tech-requirements.md#network-posture).

---

## How it works

The control plane is a Next.js app exposing two surfaces over the same state:

- **MCP** (stdio for the npm package, HTTP for remote clients) — what your agent calls.
- **Dashboard** at `localhost:3001` — what you look at. **Studio** leads and opens by default; **Ideate** holds research, plans and stashes; **Operate** appears only once something is running there. You drive from the agent; the dashboard renders what accumulates.

Your agent calls mojulo's tools via MCP; the tools mutate state in `~/.mojulo/`; the dashboard renders that state. When your agent first connects it calls `forward_context` to read mojulo's routing index, so the session orients itself before doing anything. The tool surface unfolds progressively behind that thin index, so a session spends tokens only on the tools it actually fires. Hosts are declared profiles, not vendor special-cases; the matching adapter is auto-resolved from the connecting client. Non-Claude agents should also read [AGENTS.md](AGENTS.md).


---

## Also in the box

The factory is the point. The same recipe discipline covers a wider shelf, present by default and never in the way:

- **Diagrams and charts** — flowcharts, stacked bars, donuts, KPI tiles via `create_sketch`; one geometry family draws a flowchart and climbs the whole 3D ladder.
- **Directed images** — a composition-locked scaffold that an external image model paints (your agent's own image capability, or the local worker). The design stays sovereign; the painted render binds back with provenance.
- **Publications, research, plans, stashes** — cooks (briefs, decks, comics, picture books, whole static sites), a searchable research notebook, plans tracked from draft to executed, and typed buckets the agent files inputs into. All land as plain files you diff and regenerate.
- **Connected services** — workflows over the MCPs you already run (Drive, Gmail, Linear, your CRM), synthesized by your agent from a **catalyst** into a runnable artifact you own, with the wiring recorded in a durable contextmap. Mojulo ships no native integrations by design. [docs/catalysts.md](docs/catalysts.md), [docs/meta-context.md](docs/meta-context.md)
- **Local apps** — a local process plus MCP sidecar whose inference parks back on your agent, so no per-app LLM key. [docs/app-runtime.md](docs/app-runtime.md)
- **The chatbot factory (opt-in)** — not part of a default install since 2.0. `mojulo install chatbot` adds compiled bots with hash-chained transcripts and offline RAG; `--remove` puts it away. A compiled bot is the one artifact that needs an LLM key of its own, because it runs without you. Already-deployed bots are unaffected either way. Everything about it: [docs/chatbot/](docs/chatbot/).

---

## Security & deployment posture

The control plane is **single-operator, self-hosted, localhost-only by default** — no user identity unless you enable the opt-in roles pack to issue scoped, revocable keys to your own delegates (operator-owned delegation, not multi-tenancy). Three access-control affordances, all opt-in:

- **HTTP login** (for the dashboard UI). Set `CONTROL_PLANE_USER` + `CONTROL_PLANE_PASSWORD` in `control/.env`. Sessions are HMAC-signed with the password itself, so rotating it invalidates every outstanding session. Intentionally minimal — no MFA, no lockout, no multi-user.
- **MCP bearer token** (for HTTP MCP). Set `CONTROL_PLANE_MCP_KEY` to enable `/api/mcp`; with the key unset, the route 404s. The stdio transport (`npx -y mojulo`) is local-only and doesn't use this key.
- **Roles pack** (operator-owned delegation). Set `MOJULO_ROLES=enabled`, then cut scoped bearer keys for your own delegates with the admin-only `mint_role_key` / `list_role_keys` / `revoke_role_key` tools. A delegate key sees only its granted capability packs and can never touch secrets, daemon control, or roles admin. With `MOJULO_ROLES` unset, behavior is byte-identical to a roles-less install.

**Network posture:** don't expose the control plane to the public internet. Use localhost (the default), Tailscale / WireGuard, an SSH tunnel (`ssh -L 3001:localhost:3001 your-host`), or a reverse proxy with auth. Bots compiled by the optional pack face end users and have their own posture. Threat model: [SECURITY.md](SECURITY.md).

---

## Responsibility model

Mojulo runs on your machine, on your credentials, driven by your agent. There is no hosted service, no telemetry, no remote kill switch — which means the operator (you) is the only party in the system with the context to evaluate intent, capability, and suitability for any given use. The terms of use formalize that posture; the architecture is what makes it true.

- [TERMS.md](TERMS.md) — terms of use.
- [docs/responsibility-model.md](docs/responsibility-model.md) — the architectural reasoning behind those terms.

If you're using mojulo in a regulated industry, with restricted data, or in a safety-critical setting, read both before you proceed.

---

## Who builds with this

A spectrum, all driving the same open-source, self-hosted stack from their own MCP-capable agent:

- **Game developers & technical artists** wanting an agent-driven *upstream*: blockouts, levels and assets authored by conversation, handed to Godot as a real project, to Unity or Unreal as a gated data pack, or to Blender as an art pass, with an honest ledger of what didn't travel.
- **People who print things** — objects, parts, vehicles and wordmarks exported as print-ready STL or 3MF at true scale, in mm, z-up, slicer-ready, with the slicer's own stamp beside the file; figures and worlds as sized maquettes. The conversation ends at the printer.
- **Makers, worldbuilders & educators** — a walkable world, a playable game, a synthesized score, an animated STEM explainer. Each kept as a recipe they re-render and edit, not a render they'd have to redo.
- **Teachers and course builders** who tune a study object once, keep it in their cookbook, and recall it by intent a term later.
- **Anyone with a Claude/ChatGPT subscription** who wants their agent to ship files other tools already read, not chat transcripts.

The wider shelf reaches further: indie makers vibe-coding side projects without a SaaS bill, teams with a pile of MCPs who want them wired together once with the reasoning recorded, and, with the optional chatbot pack, agencies, internal IT and regulated SMBs who need a bot the client keeps.

---

## Architecture in one paragraph

The control plane is a Next.js app exposing both a dashboard and an MCP server (stdio for the npm package, HTTP for remote clients). Workshop state — every recipe, plus plans, research, stashes, and cooks — lives in a single SQLite under `~/.mojulo/`. A recipe is params plus a `kind`; a **kernel** in the control plane regenerates it on every read, so nothing is a stored render. One geometry spec then serves several targets off a single ref — SVG, a dependency-free CSS-3D scene, a traversable WebGL world, `.glb`, OpenUSD, STL and 3MF, and the Godot, Unity, Unreal and Blender packs — each emitter owning its own frame and unit conversion from the native z-up metre frame, and each handoff carrying an honest ledger of what did *not* travel. The kind roster is extensible without touching core: an attached [recipe book](https://github.com/zombico/mojulo-recipe-book) contributes recipes as data, and pure builder modules as new kinds. Optional local workers (Blender, slicers, mesh sculptors, ComfyUI, Kokoro) are operator-hosted and never dependencies. Apps — and bots, if that pack is installed — run as separate processes supervised by a daemon.

Full diagrams: [docs/MCP-ARCHITECTURE.md](docs/MCP-ARCHITECTURE.md) (the headless control surface), [docs/POLYGONIZER-SYNTHESIS.md](docs/POLYGONIZER-SYNTHESIS.md) (the geometry substrate), [docs/chatbot/BOT-ARCHITECTURE.md](docs/chatbot/BOT-ARCHITECTURE.md) (the optional bot factory).

---

## Repo layout

```
mojulo/
├── control/        Next.js control plane: MCP server, dashboard, the geometry/audio/publication
│                   kernels, render + export emitters, runtime supervisor
├── lite-template/  Runtime for the OPTIONAL chatbot pack: Express server, RAG, LLM client, Dockerfile
└── docs/           Concept docs; the bot factory's own set is isolated under docs/chatbot/
```

Per-package docs: [control/README.md](control/README.md) — the npm package overview (what's published to npmjs.com/package/mojulo). [lite-template/](lite-template/) — bot runtime internals.

Separate repo: [mojulo-recipe-book](https://github.com/zombico/mojulo-recipe-book) — the attachable catalog of mintable recipes. Clone it, point `MOJULO_RECIPE_BOOK` at it; strictly additive, never fetched at runtime. See [CONTRIBUTING.md](CONTRIBUTING.md).

**Concept docs — the factory:**

- [docs/POLYGONIZER-SYNTHESIS.md](docs/POLYGONIZER-SYNTHESIS.md) — the geometry substrate: wave primitives, structure-manji, field kinds, shelf cards
- [docs/HTML-CSS-NATIVE-RENDERING.md](docs/HTML-CSS-NATIVE-RENDERING.md), [docs/scene-css3d-lighting.md](docs/scene-css3d-lighting.md) — the dependency-free scene backend and its baked lighting model
- [docs/raymarch-effects-layer.md](docs/raymarch-effects-layer.md) — volumetric effects as an overlay over the mesh worlds
- [docs/bicycles.md](docs/bicycles.md) — the two-gate doctrine (machine gate, eyes gate) every handoff runs
- [docs/tech-requirements.md](docs/tech-requirements.md) — measured footprint, engine legs, slicers, workers, platform notes
- [docs/examples/unreal-night-run/](docs/examples/unreal-night-run/) — the Unreal worked example: recipes, mint script, project-side wiring
- [docs/local-blender-worker.md](docs/local-blender-worker.md), [docs/local-slicer-worker.md](docs/local-slicer-worker.md), [docs/local-mesh-worker.md](docs/local-mesh-worker.md), [docs/local-image-worker.md](docs/local-image-worker.md), [docs/local-voice-worker.md](docs/local-voice-worker.md) — the optional operator-hosted workers

**Concept docs — the substrate and the backend:**

- [docs/MCP-ARCHITECTURE.md](docs/MCP-ARCHITECTURE.md) — the headless control surface: transport, session binding, deliberation surfaces
- [docs/mcp-integration.md](docs/mcp-integration.md) — connecting an agent, the tool surface, the session model
- [docs/install-capabilities.md](docs/install-capabilities.md) — kernel, always-on packs, and the two install-gated groups
- [docs/catalysts.md](docs/catalysts.md) — what a catalyst is and how to author one
- [docs/meta-context.md](docs/meta-context.md), [docs/mcp-orbit.md](docs/mcp-orbit.md) — connected-services composition
- [docs/app-runtime.md](docs/app-runtime.md) — the app runner daemon
- [docs/responsibility-model.md](docs/responsibility-model.md) — the operator-owns-consequences posture

**Optional pack:** the chatbot factory's docs live together under **[docs/chatbot/](docs/chatbot/)** — start at its [README](docs/chatbot/README.md).

---

## Contributing

One maintainer, no SLA — issues and PRs are read, but triage can take days or weeks.

**The widest door is the recipe book, not this repo.** [mojulo-recipe-book](https://github.com/zombico/mojulo-recipe-book) is a separate public catalog of mintable recipes that mojulo reads off local disk — clone it, point `MOJULO_RECIPE_BOOK` at it, and it attaches. Adding an entry there is a folder (`card.md` + `recipe.json`, or a pure `builder.js` for a whole new kind) and needs no change to the substrate. You can also just **keep your own book**: `save_recipe` writes a cookbook beside your instance data, in the identical format, as its own local git repo with no remote — publish it yourself, or copy a folder into a PR.

Here in core, bug reports (with a reproducer — recipes are deterministic, so a pasted manifest reproduces your bug exactly), correctness fixes to shipped kinds, translation and documentation fixes, and tests targeting the listed surfaces are always welcome. Concept PRs that change *how* mojulo works will likely sit; forks are the open door and Apache 2.0 is why. There are also standing open requests — math and science views, native WebGL, engine handoff idioms, and reproducers.

Full stance, both doors, and the open requests: [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[Apache License 2.0](LICENSE)
