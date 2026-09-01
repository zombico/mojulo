# Mojulo

[![npm](https://img.shields.io/npm/v/mojulo)](https://www.npmjs.com/package/mojulo)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)
[![node](https://img.shields.io/badge/node-%E2%89%A522.12-brightgreen)](control/package.json)

**Mojulo is a 3D factory for agents** — local, yours, not a hosted service. Point the agent you already run (Claude Code, Codex) at it and build **worlds, objects, and games by conversation**: you talk; the agent does the generating and the reasoning. Mojulo catches that output as a deterministic **recipe** on your own disk — a few kilobytes of parameters that regenerate identically, are editable a line at a time, and outlive the chat.

**Two pipelines out.** DIGITAL: worlds, levels and scenes render dependency-free in the browser (CSS-3D, WebGL) and export to **Godot** as a real project — `.glb` for Blender, Unreal spec'd next. PHYSICAL: objects, figures, vehicles and wordmarks export as **print-ready STL at true scale** — mm units, z-up, slicer-ready — so a conversation ends at your 3D printer. Because everything is the same kind of recipe, pieces **compose upward** into a playable **game**. And **sound comes free**: SFX and music synthesized from pure math and seeded dice — no samples, no key — dropped straight in.

**Mojulo feeds the tools you already use; it does not compete with them.** It is the agent-driven upstream — it authors the truth at home, and the edge tool consumes it without guessing at the seam. It is not a renderer trying to out-render Unreal, and it is not merely an exporter: the recipe is where the thing is born, lives, and re-renders. The engine or the printer is where it is optionally *finished*.

Underneath is one move: mojulo pairs the coding agent's **generative capability** with a **standard file format** and focuses it into an **artifact you own**. It specs a world; mojulo bakes a `.glb`. It designs a chart; mojulo emits SVG. It writes the essay; mojulo pins it to clean HTML or Markdown. What comes out is never a transcript to copy-paste — it's a standard file other tools already read, sitting on your disk. Publications, research, diagrams — the rest of the shelf — land the same way.

It runs on your laptop and doesn't host inference, so the reasoning bill stays on your existing Claude or ChatGPT subscription.

**Optional packs.** Beyond the factory, mojulo carries an automation backend for wiring work into the MCPs you already have (Drive, Gmail, your CRM) — present by default, never in the way. The **chatbot factory** — compile a bot to a runnable process with hash-chained transcripts and offline RAG — is **opt-in since 2.0**: `mojulo install chatbot` adds it. Upgrading from 1.x? Your deployed bots are untouched; they always ran as their own processes, separate from the workshop.

**Install:** `npx mojulo init` — detects Claude Code, Codex, or Claude Desktop, wires mojulo in, opens the dashboard. No API key needed for most of it. [Quickstart ↓](#quickstart)

![A generative low-poly city with pedestrians crossing and traffic flowing, the camera drifting around the central intersection — minted by an agent as a deterministic recipe, no API key, no image model](docs/images/city-walkers-traffic.gif)

<sub>One prompt: <i>"generate a 3D city with walkers and traffic."</i> Your agent mints a deterministic recipe (`kind: fractal-city, seed: 42` — that's most of it); mojulo renders it live with pedestrians and traffic simulated in-world. This clip is itself a recipe — a <code>forge_motion</code> camera shot over the stored world, re-bakeable frame-identically. The same ref serves a walkable WebGL world, a CSS-3D still, and a <code>.glb</code>. No key, no cloud render.</sub>

![The mojulo Workshop Home at localhost:3001 — Studio, Ideate, and Operate across the top, with the making bays your agent fills](docs/images/workshop_home.png)

<sub>The workshop at `localhost:3001` — the shelf of bays your agent fills. **Studio** leads and opens by default; **Operate** appears only once you have something running there. You drive it from the agent you already run; the dashboard renders what accumulates.</sub>

---

## What you can build

The dashboard at `localhost:3001` is a shelf of bays. Your agent fills them, grouped into two halves — the factory, and the automation backend behind it.

**The 3D factory — geometry that composes upward into a game, or out to a printer.**

- **Sketches & worlds** — the visual bay. Two-dimensional diagrams (flowcharts, stacked bars, donuts, KPI tiles, decision diamonds via `create_sketch`) *and* generative 3D: cities, posed figures, painted landscapes, carved wordmarks, transit hubs, everyday objects, and drivable worlds. One geometry spec renders as an SVG, a dependency-free CSS-3D scene, a traversable WebGL world, or a `.glb`. Minted by your agent, served under `/sketches/<ref>`. See [Worlds & 3D](#worlds--3d).
- **Games & arcade** — playable artifacts. Arcade cabinets compile to a single HTML file (a pure reducer, the skin, and a score synthesized in-page); composed games bind worlds, music, and machines by ref into a standalone playable artifact. **Sound comes free**: Beats synthesizes ambient loops, grooves, SFX cues, and footsteps from pure math and seeded dice — never samples — exported as WAV or MIDI and dropped straight into the game.
- **Maker** — the visual workbench. Browse and compose the illustrations, worlds, and motion your agent mints — where the `create_*` visual family and `forge_motion` land.
- **Your cookbook** — keep a recipe you've tuned (`save_recipe`) and recall it by intent a term later; attach a cloned [recipe book](https://github.com/zombico/mojulo-recipe-book) to add whole chapters, or new object kinds, without touching mojulo. See [Keeping what you make](#keeping-what-you-make).

**The automation backend — wiring what you make into the tools you already run.**

- **Connected Services** — workflows over the MCPs you already have (Drive, Gmail, Linear, your CRM). Either as agent-side skills synthesized from catalysts, or as composed mcp-orbit chains.
- **Optional packs** — the **chatbot factory** installs separately (`mojulo install chatbot`); everything about it lives in [docs/chatbot/](docs/chatbot/).

**Recipes, not renders.** All of it — plus **Cooks** (typed publications: briefs, essays, decks, resumes, newsletters, comics, picture books, whole static sites), **Research** (a searchable notebook of sources, snippets, screenshots, abstracts), **Plans** (goals framed, scoped, and tracked from draft to executed), and **Stashes** (typed buckets the agent files inputs into and cooks pull from) — lands as a plain file you diff, version, and regenerate. You review what the model made the way you review code: as a diff, kept or reverted a line at a time. Same seed, same file.

Plus **Settings** for host config. The reasoning happens in your agent; mojulo persists state, supervises processes, and renders the shelf.

---

## Quickstart

The fastest path: don't install anything yourself. Paste this into the coding
agent you already run (Claude Code, Codex) and let it drive — it checks the
machine first, reports what it found, and asks before installing anything:

```text
Help me install mojulo — a free, local workshop you'll drive over MCP.
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
   22.12), install it from [nodejs.org](https://nodejs.org) — or just ask your coding
   agent to install it for you ("install Node 22 with brew/winget and verify
   `node --version`").
2. A **desktop coding agent** (Claude Code/Codex) or a high-end local model —
   mojulo is model-agnostic and runs on whatever model your harness provides.
   (Claude Desktop works too — `init` detects and wires it — but a coding agent
   gets more out of the workshop.)

You don't give mojulo its own provider key for most of it — your agent is the
reasoning loop, so sketches, worlds, objects, games, scores, cooks, research, and
apps all run keyless. A key only enters when something has to *paint*: a directed
image needs either your agent's own image capability or a local worker. (If you
install the optional chatbot pack, a compiled bot also needs one — it calls an LLM
on its own, because it runs without you.)

```bash
npx mojulo init
```

`init` detects your MCP host(s), wires mojulo into each (one yes/no per host),
*optionally* offers to set a provider key, and opens the dashboard at
`http://localhost:3001` (or the next free port — the installer prints the URL).
Nothing is sent anywhere; state lands in `~/.mojulo/`. The first install is the
big one: npx pulls a ~26 MB package plus its native runtime deps (a few hundred
MB on disk), and the first launch fetches a ~113 MB embedding model in the
background — after that, starts are instant.

The dashboard opens in English but ships fully translated in ~two dozen
languages, including right-to-left scripts (Arabic, Farsi, Urdu) — switch
anytime under **Settings → Language**.

On a slow connection, or if you'd rather your agent's first connect never wait on
npx resolving the package, install globally instead and re-run `init` — it wires
whatever `npx -y mojulo` resolves to, and a global install makes that resolution
local and instant:

```bash
npm install -g mojulo && mojulo init     # update later with: npm update -g mojulo
```

### First look — no key required

Back in your agent, try these in order. They render locally and hand you a URL:

```
what is this?                  → forward_context: mojulo orients itself, out loud
generate a 3D city             → compose_world (base: city) → open the /scene URL
make me a walkable world       → compose_world (base: controllable) → drive it at /world
```

The first prompt is the one to watch: your agent reads mojulo's own routing
index (`forward_context`) to decide what to do. That's the substrate explaining
itself — no key, no cloud call, nothing deployed.

### Everything else, keyless

Because your agent is the reasoning loop, most of mojulo needs no provider key —
your agent authors the content and mojulo materializes it:

```
draft a one-page brief on X          → a cook (your agent writes it)
research W and synthesize what I find → the research notebook
spin up a local app for Z            → app inference parks back on your agent
```

### When you want painted images

Mojulo's directed-images loop *designs* pictures — composition-locked scaffolds — but painting one takes an image model, and **Claude doesn't generate images**: Claude Code has no native image capability, so with Claude alone the loop stops at the scaffold. Two ways to add the painter:

- **An image-capable agent.** Codex or an image-capable ChatGPT plan paints the scaffold directly — nothing to install.
- **The local image worker.** A self-hosted ComfyUI + Qwen backend, installed from a checkout of this repo (the models are ~31 GB and are not part of the npm package):

```bash
control/scripts/install-local-imagegen.sh          # ComfyUI + Qwen-Image-Edit + Lightning LoRA (~31GB)
control/scripts/install-local-imagegen.sh --gguf   # + the Q6_K quant — use this on Apple Silicon / lower RAM
cd ~/mojulo-imagegen/ComfyUI && source venv/bin/activate
python main.py --listen 127.0.0.1 --port 8188      # loopback only — ComfyUI has no auth layer
```

On Apple Silicon, run with the GGUF quant — the fp8 checkpoint hits an MPS dtype error. Everything else in mojulo works without any of this, and the scaffold recipes stay sovereign either way: install the painter later and every staged picture becomes paintable retroactively. See [docs/local-image-worker.md](docs/local-image-worker.md).

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

- **Recipes.** Every world, object, game, score, and publication is a few kilobytes of parameters in SQLite at `~/.mojulo/mojulo-lite.db` — alongside plans, research, stashes, and cooks. Renders are derived and disposable; the recipe is the thing you own.
- **Your cookbook.** Recipes you `save_recipe` land in `~/.mojulo/data/cookbook` as plain `card.md` + `recipe.json` folders, in its own git repo with **no remote** — a local ledger of what you kept. Sharing it is your act, with your git.
- **Derived outputs.** Exported `.glb` / `.stl` / `.wav` / game folders and painted PNGs write to plain files you can open in anything.
- **Encryption / keys.** Provider keys AES-256-GCM encrypted at rest.
- **Chatbot transcripts** (optional pack). Every bot you compile has its *own* SQLite. The control plane stores only `url` + `last_seen_at`; transcripts are read live through a bearer-authenticated proxy, never replicated.

No telemetry. No phone-home. Nothing is fetched at runtime — an attached recipe book is a folder you cloned. The only outbound traffic is what your agent, and anything you explicitly deploy, initiates.

---

## How it works

The control plane is a Next.js app exposing two surfaces over the same encrypted state:

- **MCP** (stdio for the npm package, HTTP for remote clients) — what your agent calls.
- **Dashboard** at `localhost:3001` — what you look at.

Your agent calls mojulo's tools via MCP; the tools mutate state in `~/.mojulo/`; the dashboard renders that state. Long-running local processes — apps, and bots if you installed that pack — are supervised by a daemon the control plane manages.

When your agent first connects, it calls `forward_context` to read mojulo's concept glossary, lifecycle, and tool index — so the session orients itself before doing anything destructive. Host adapters (`claude-code`, `codex`, `generic`) are auto-resolved from the connecting client; non-Claude agents should also read [AGENTS.md](AGENTS.md).

---

## Creative

The creative half reads as one progression: an **object** blocks out at literal scale, a **world** is a place you can walk, a **level** is a world minted under a game contract, and a **game** composes the levels. All of it is deterministic geometry — recipes, not renders — built from primitives on your machine: no image model, no cloud render, **no provider key**. Sound comes free.

### Worlds & 3D

The same family that draws a flowchart climbs the whole progression:

- **Cities & structures** — recursive skylines, airports, stations and subways; structural illustration on a cardinal grammar.
- **Figures** — a posed human body: male or female, stances, a reach, a walking gait.
- **Objects & marks** — everyday objects blocked out at literal scale (candlestick, lamp, dumbbell), and metal or beveled wordmarks, logos and badges.
- **Landscapes** — painterly scenes composed from sky, palette and geometry glyphs.
- **Drivable worlds** — places you walk or fly through, with the camera and entities as first-class primitives.
- **Study objects** — animated science / math / bio explainers (nuclear fission, the double-slit experiment, a derivative, DNA) from one kind plus a few knobs. The catalog is open: attach a cloned recipe book to add chapters, and keep a setup you've tuned in your own cookbook, recallable by intent in a later session.
- **Directed images** — a composition-locked scaffold that an external image model paints: your agent's own image capability, or an optional local ComfyUI + Qwen worker. The design stays sovereign; the painted render binds back with provenance. See [docs/local-image-worker.md](docs/local-image-worker.md).
- **Motion** — any of the above set moving: a turntable, an orbit, a fly-through, or a paced concept explainer, rendered to a shareable GIF (clips stitch into an MP4).
- **Audio & voice** — music synthesized from seeded math, never samples: ambient loops, grooves, full scores — a part can even *sing* — plus SFX cues, and a deterministic voice register for narration. Worlds opt in to soundtracks and footsteps; a score exports as WAV or MIDI.
- **Buildings & interiors** — bespoke walkable buildings authored as masses and concourses, and organic caves and dungeons grown procedurally — both traversable, both exportable.

The distinctive part is the render pipeline: **one geometry spec, several targets.** The same world serves as a still (SVG, or a dependency-free CSS-3D `preserve-3d` scene — a real 3D view in a plain HTML file, no WebGL and no build step), a **traversable** WebGL world you walk with WASD, a `.glb` you export into Blender or Unreal, or a printable `.stl` you can slice and 3D-print — all off a single minted ref at `/api/sketches/<ref>/{svg,scene,world,model.glb,model.stl}`. The exported glTF carries animation clips; a mesh refined outside binds back with hash provenance; and with Blender installed, an optional pass bakes real traced global illumination into the geometry's own vertex colours, so the lit result runs anywhere at zero runtime cost. The chat ends; the city doesn't; it can leave the screen entirely.

![A described mug — two lathes and a swept handle — gravity-seated on a table, shown as flat albedo on mojulo's measured studio grid under the default house light](docs/images/object-bake-before.jpg) ![The same object recipe after one optional trip through a local Blender Cycles bake — traced global illumination baked into the geometry's own vertex colours, grounded contact shadows, studio backdrop](docs/images/object-bake-after.jpg)

<sub>The same described object — a mug (two lathes + a swept handle) seated on a table by declared relation, not coordinates. <b>Left:</b> mojulo's house light, on the workbench's measured grid. <b>Right:</b> the same recipe after one optional pass through a local Blender Cycles bake — the traced light lands in the mesh's own vertex colours, so the lit result runs anywhere with no Blender and zero runtime cost. Every frame is from one real run. See <a href="docs/local-blender-worker.md">docs/local-blender-worker.md</a>.</sub>

Because it's deterministic geometry, the first render costs nothing but the render — this is the keyless first look in the [Quickstart](#quickstart). And live *rule-driven* worlds are no longer a further layer — the same geometry becomes a game's level — the composition the next subsection, **Games**, walks through.

---

### Games

A game is the top of that progression: not a new kind of media beside the others, but a composition **of** them. `create_game` binds worlds, music, figures, and sprites by reference into a standalone playable artifact — a shell that owns a typed **store** and a set of **levels** (worlds minted with a `game:` contract). Improve a bound world or score and the game inherits it.

- **Persistent state that carries between levels.** The store holds what survives a level — a character's level, an inventory or loadout, a customizable party, campaign flags and unlocks — across five slice kinds (`character` / `inventory` / `party` / `progression` / `flags`). The shell renders each level's pre-level setup screen, hosts it, and folds its one outcome back into the store.
- **Two forms.** Composed games bind worlds, music, and machines by ref and play at `/sketches/<ref>`. **Arcade cabinets** compile to a single self-contained HTML file — a pure reducer, a skin, and an in-page synthesized score — for 2D reducer games.
- **Yours to ship.** `export_game` writes a game to a plain folder (with deduped shared asset banks) that you can host anywhere — GitHub Pages, your own static host.

Play data never enters mojulo. The artifact runs on its own; the substrate keeps the recipe, not the playthrough.

---

### Keeping what you make

A recipe you tuned for twenty minutes shouldn't die with the session.

**`save_recipe`** promotes it into your **cookbook** — a folder beside your instance data (`~/.mojulo/data/cookbook`) holding plain `card.md` + `recipe.json`, in its own git repo with **no remote**. Mojulo makes local commits only; an inspectable ledger of what you kept. Pushing is your act, with your git.

The point is *recall by meaning*. Your agent writes the card's `when` line from the conversation — "the pendulum setup for my Tuesday class" — so months later a paraphrase finds it, and the recipe re-mints exactly as it was.

```
create_view / create_beats  →  tune it  →  save_recipe({ ref, id, when })  →  recall, re-mint, adjust
```

**The kind catalog is open, too.** [mojulo-recipe-book](https://github.com/zombico/mojulo-recipe-book) is a public catalog you clone and point `MOJULO_RECIPE_BOOK` at — chapters of study objects, worlds, loops, solids, and shots. Some entries are pure params over kinds mojulo already has; others are *builders* that add an entirely new kind without touching mojulo core. Strictly additive: without the clone, behavior is byte-for-byte identical, and nothing is ever fetched at runtime — you cloned it, mojulo reads local disk.

A cookbook **is** a book — same format, exactly. So a friend can clone yours as *their* upstream, and contributing to the public catalog is copying a folder into a PR. Precedence is first-wins: core kinds > your cookbook > any attached book. See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Optional: the chatbot factory

Not part of a default install since 2.0. `mojulo install chatbot` adds it; `--remove` puts it away. Compiled bots, hash-chained transcripts, offline multilingual RAG, five stackable protocols, cloud or air-gapped deploy — all of it, including setup and deploy options, is documented in **[docs/chatbot/](docs/chatbot/)**.

Already-deployed bots are unaffected either way: they run as their own processes, from a separately versioned image.

---

## Connected services

Beyond the factory, mojulo carries an automation backend: workflows over the MCPs you already run, so the things you make can be wired into the rest of your work. It is present by default and never in the way.

Mojulo ships **no native integrations** — no built-in Gmail node, no bundled CRM connector, no directory of plugins to enable. That's deliberate. A connected service is a workflow over the MCPs *you* already run (Drive, Gmail, Linear, your calendar), and the thing that builds it is your host agent, not a mojulo adapter someone at mojulo had to write first.

The mechanism is a **catalyst**: a host-neutral workflow recipe mojulo hands your agent via `get_catalyst`. The agent reads the recipe, introspects a bot's shape (or whatever data you're wiring), picks a destination from the MCPs installed on your machine, and materializes a **runnable artifact you own** — a Claude Code skill under `.claude/skills/`, a Codex automation, or a plain `workflow.md` + runner. The catalyst is spent at synthesis and can catalyze again for the next bot; mojulo never sees the artifact it produced.

What mojulo keeps is the **memory of the wiring**, not the runtime. You declare your installed MCPs once (`meta_context_declare_inventory`), and every service the agent composes is sealed into the **contextmap** via `meta_context_commit` — a durable, auditable record of what was wired, to which MCP, and why. So months later the substrate can still tell you how a service was built, even though it never held a token for your CRM or proxied a single call. See [docs/catalysts.md](docs/catalysts.md) and [docs/MCP-ARCHITECTURE.md](docs/MCP-ARCHITECTURE.md).

---


## Security & deployment posture

The control plane is **single-operator, self-hosted, localhost-only by default** — no user identity unless the operator enables the opt-in roles pack to issue scoped, revocable keys to their own delegates (operator-owned delegation, not multi-tenancy). Three access-control affordances, all opt-in:

- **HTTP login** (for the dashboard UI). Set `CONTROL_PLANE_USER` + `CONTROL_PLANE_PASSWORD` in `control/.env`. Sessions are HMAC-signed with the password itself, so rotating it invalidates every outstanding session. Intentionally minimal — no MFA, no lockout, no multi-user (per-delegate logins arrive only with the opt-in roles pack).
- **MCP bearer token** (for HTTP MCP). Set `CONTROL_PLANE_MCP_KEY` to enable `/api/mcp`; with the key unset, the route 404s. The stdio transport (`npx -y mojulo`) is local-only and doesn't use this key.
- **Roles pack** (operator-owned delegation). Set `MOJULO_ROLES=enabled` in `control/.env`, then cut scoped bearer keys for your own delegates with the admin-only `mint_role_key` / `list_role_keys` / `revoke_role_key` tools. A delegate key sees only its granted capability packs, uses only its own LLM credentials, and can never touch secrets, daemon control, or roles admin; revoking a key also kills its dashboard sessions (delegates log in with key name + key). `CONTROL_PLANE_MCP_KEY` remains the operator's admin key either way; with `MOJULO_ROLES` unset, behavior is byte-identical to a roles-less install.

**Network posture:** don't expose the control plane to the public internet. Pick whichever fits:

- **localhost** (the default).
- **Tailscale / WireGuard / VPN.**
- **SSH tunnel.** `ssh -L 3001:localhost:3001 your-host`.
- **Reverse proxy with auth.** Caddy, nginx, Traefik with basic auth — or OAuth2 Proxy, Cloudflare Access, Authelia, Tailscale Funnel.

**The bots it compiles have a different posture** — they're designed to face end users. The control plane → bot proxy is authenticated by a shared `MOJULO_API_KEY` baked into the artifact at build time. See [SECURITY.md](SECURITY.md) for the threat model.

---

## Responsibility model

Mojulo runs on your machine, on your credentials, driven by your agent. There is no hosted service, no telemetry, no remote kill switch — which means the operator (you) is the only party in the system with the context to evaluate intent, capability, and suitability for any given use. The terms of use formalize that posture; the architecture is what makes it true.

- [TERMS.md](TERMS.md) — terms of use.
- [docs/responsibility-model.md](docs/responsibility-model.md) — the architectural reasoning behind those terms.

If you're using mojulo in a regulated industry, with restricted data, or in a safety-critical setting, read both before you proceed.

---

## Who builds with this

A spectrum, all driving the same open-source, self-hosted stack from their own MCP-capable agent:

- **Makers, worldbuilders & educators** — a walkable world, a playable game, a synthesized score, an animated STEM explainer, a picture book. Each kept as a recipe they re-render and edit, not a render they'd have to redo.
- **Game developers & technical artists** wanting an agent-driven *upstream*: blockouts, levels, and assets authored by conversation, handed to Godot as a real project or to Blender as `.glb`, with an honest ledger of what didn't travel.
- **People who print things** — objects, figures and wordmarks exported as print-ready STL at true scale, in mm, z-up, slicer-ready. The conversation ends at the printer.
- **Teachers and course builders** who tune a study object once, keep it in their cookbook, and recall it by intent a term later.
- **Indie makers** vibe-coding side projects without a SaaS bill — a weekly newsletter cook, a local app for a personal workflow, a small game to hand a friend.
- **Teams with a pile of MCPs** — Drive, Linear, a CRM — who want them wired together once, with the reasoning recorded and the artifact theirs to keep.
- **Anyone with a Claude/ChatGPT subscription** who wants their agent to ship more than chat transcripts.

With the optional chatbot pack (`mojulo install chatbot`), three more: **agencies** building per-client bots as deliverables the client keeps; **internal IT** rolling out air-gapped helpers inside firewalled networks, where offline RAG means no embedding API to allow-list; and **regulated SMBs** — clinics, law offices, financial pre-screen — where the tamper-evident transcript is an internal audit trail.

---

## Architecture in one paragraph

The control plane is a Next.js app exposing both a dashboard and an MCP server (stdio for the npm package, HTTP for remote clients). Workshop state — every recipe, plus plans, research, stashes, and cooks — lives in a single SQLite under `~/.mojulo/`. A recipe is params plus a `kind`; a **kernel** in the control plane regenerates it on every read, so nothing is a stored render. One geometry spec then serves several targets off a single ref — SVG, a dependency-free CSS-3D scene, a traversable WebGL world, `.glb`, `.stl`, a Godot project — each emitter owning its own frame and unit conversion, and each handoff carrying an honest ledger of what did *not* travel. The kind roster is extensible without touching core: an attached [recipe book](https://github.com/zombico/mojulo-recipe-book) contributes recipes as data, and pure builder modules as new kinds. Optional local workers (Blender, ComfyUI, Kokoro) are operator-hosted and never dependencies. Apps — and bots, if that pack is installed — run as separate processes supervised by a daemon.

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
- [docs/local-blender-worker.md](docs/local-blender-worker.md), [docs/local-image-worker.md](docs/local-image-worker.md), [docs/local-voice-worker.md](docs/local-voice-worker.md) — the optional operator-hosted workers

**Concept docs — the substrate and the backend:**

- [docs/MCP-ARCHITECTURE.md](docs/MCP-ARCHITECTURE.md) — the headless control surface: transport, session binding, deliberation surfaces
- [docs/mcp-integration.md](docs/mcp-integration.md) — connecting an agent, the tool surface, the session model
- [docs/install-capabilities.md](docs/install-capabilities.md) — kernel, always-on packs, and the two install-gated groups
- [docs/catalysts.md](docs/catalysts.md) — what a catalyst is and how to author one
- [docs/meta-context.md](docs/meta-context.md), [docs/mcp-orbit.md](docs/mcp-orbit.md) — connected-services composition
- [docs/app-runtime.md](docs/app-runtime.md) — the app runner daemon
- [docs/responsibility-model.md](docs/responsibility-model.md) — the operator-owns-consequences posture

**Optional pack:** the chatbot factory's thirteen docs live together under **[docs/chatbot/](docs/chatbot/)** — start at its [README](docs/chatbot/README.md).

---

## Contributing

One maintainer, no SLA — issues and PRs are read, but triage can take days or weeks.

**The widest door is the recipe book, not this repo.** [mojulo-recipe-book](https://github.com/zombico/mojulo-recipe-book) is a separate public catalog of mintable recipes that mojulo reads off local disk — clone it, point `MOJULO_RECIPE_BOOK` at it, and it attaches. Adding an entry there is a folder (`card.md` + `recipe.json`, or a pure `builder.js` for a whole new study-object kind) and needs no change to the substrate. You can also just **keep your own book**: `save_recipe` writes a cookbook beside your instance data, in the identical format, as its own local git repo with no remote — publish it yourself, or copy a folder into a PR.

Here in core, bug reports (with a reproducer — recipes are deterministic, so a pasted manifest reproduces your bug exactly), correctness fixes to shipped kinds, translation and documentation fixes, and tests targeting the listed surfaces are always welcome. Concept PRs that change *how* mojulo works will likely sit; forks are the open door and Apache 2.0 is why. There are also four standing open requests — math and science views, native WebGL, Unreal/Godot handoff idioms, and reproducers.

Full stance, both doors, and the open requests: [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[Apache License 2.0](LICENSE)
