# Tech requirements — what it takes to run mojulo

The full-disclosure page for "what does mojulo need, how big is it, and what do the engine
extensions actually require." Written for the marketing site and for anyone confused later.
Every figure below is either read from the source tree (cited) or measured on a stated date on a
stated machine; nothing is a round number from memory. When a number and the code disagree, the
code wins and this page is wrong — fix it here.

Companion facts: the `get_substrate` drawer in
[control/lib/mcp/tools/context.js](../control/lib/mcp/tools/context.js) (the canonical
self-description; keep site copy consistent with it), [install-capabilities.md](install-capabilities.md)
(kernel + packs), and the [README quickstart](../README.md#quickstart).

---

## The shape in one paragraph

Mojulo is an npm package that runs **two local processes** on your machine: an MCP server your
coding agent spawns over stdio (`npx -y mojulo`), and a dashboard (`mojulo-ui`) that binds to
`127.0.0.1` on port 3001 or the next free port. Both read and write the same state under
`~/.mojulo/`. There is no hosted service, no account, no telemetry, and no LLM key for the studio:
your agent is the reasoning loop. Game engines, Blender, slicers, and image or voice models are
**never installed by mojulo** — you install them if you want them, and mojulo detects them.

---

## Baseline requirements

| Requirement | What exactly | Where it's enforced |
|---|---|---|
| **Node.js 22.12 or newer** | Hard floor, checked at startup; older Nodes exit with a message. | `engines` in [control/package.json](../control/package.json); the check in [scripts/mcp-stdio.mjs](../control/scripts/mcp-stdio.mjs) |
| **An MCP host** | Claude Code or Codex get the most out of it; Claude Desktop and other hosts wire by declared profile. | [scripts/mcp-init.mjs](../control/scripts/mcp-init.mjs) |
| **A desktop OS** | macOS is the development and verification platform. Windows and Linux are handled by the installer and the native binaries below, but the engine gates are not verified there (see [Platform notes](#platform-notes)). | — |
| **No GPU** | Headless WebGL bakes rasterize on the CPU via SwiftShader. A GPU only matters for optional workers you host yourself (Blender Cycles, ComfyUI). | [lib/graph/scene/chromium.js](../control/lib/graph/scene/chromium.js) |
| **No provider key** | Studio, games, publications, research, apps: keyless. A key enters only when something must *paint* (image models) or when you install the chatbot pack. | [README](../README.md#quickstart) |
| **RAM / CPU** | **No measured minimum.** Nothing in the tree states one. Do not put a number on the site until one is measured. | — |

---

## Package size and disk footprint

Measured **2026-09-21** against the packed `mojulo@2.0.7` tarball cold-installed into an empty
directory on macOS arm64 by `npm run smoke:tarball`, which is how these numbers are re-measured for
every release. The 2.0.6 figures it replaces were 27.3 MB / 110 MB / ~775 MB / ~885 MB; the drop is
the embedding runtime (`@huggingface/transformers`, `onnxruntime-node`, `onnxruntime-web`, plus the
~130 MB model) leaving the package's dependencies to become the opt-in **recall** install group
(`mojulo install recall`, installed under `~/.mojulo/recall/`; see
[install-capabilities.md](install-capabilities.md#growing-an-install)). A default install carries none
of it and `semantic_search` ranks lexically. Versions 2.0.3 through 2.0.5 shipped 639 MB unpacked
because 502 MB of Next.js `.nft.json` build-trace manifests rode along in the standalone bundle; they
have been excluded since 2.0.6.

| Layer | Size | Notes |
|---|---|---|
| npm tarball (what `npx` downloads) | **30 MB** | `mojulo-2.0.7.tgz` |
| Unpacked package | **116 MB** | Includes the prebuilt Next.js dashboard (`.next/standalone`), translations, and the bot-runtime template. |
| Production dependencies npm installs | **~470 MB** | Measured from a cold install of the tarball on macOS arm64. Breakdown below. |
| **Total after `npx mojulo init`** | **~590 MB** | Before any browser download. No model download on a default install. |
| Recall group (`mojulo install recall`) | **~480 MB** runtime + **~130 MB** model | `@huggingface/transformers` with `onnxruntime-node` and `onnxruntime-web` under `~/.mojulo/recall/`, and `Xenova/multilingual-e5-small` (q8 ONNX) under `~/.mojulo/models/`. Gives `semantic_search` vector ranking; runs in-process. Opt-in. |
| Your data | **kilobytes per recipe** | One SQLite file under `~/.mojulo/data/`. The maintainer's own `~/.mojulo/data` measures 11 MB. |

**Why the dependencies are ~470 MB.** The largest pieces, all runtime deps of the kernel unless noted:

| Dependency | Size | Why it's there |
|---|---|---|
| `node-web-audio-api` | 41 MB | Audio synthesis (beats, SFX). Creative group, optional. |
| `three` | 38 MB | WebGL worlds. Creative group, optional. |
| `better-sqlite3` | 27 MB | The database. |
| `@swc/core` | 26 MB | Compiles generated code. |
| `sharp` + libvips | 17 MB | Image handling (skins, sprite sheets, the PNG bake, the forges). Creative group, optional. |
| `puppeteer-core` | 13 MB | Drives a browser for scene bakes. The browser itself is **not** included (below). |
| `opentype.js`, `manifold-3d` | 7 MB | Fonts for wordmarks; WASM CSG for `union: true` exports. Creative group, optional. |
| `openscad-wasm-prebuilt` | 11 MB | OpenSCAD 2025.01.19 as WASM with the Manifold backend: the in-process mesher for `mint_solid kind:'scad'` and the exact twin behind `exact: true`. A fresh instance per render, about 210 MB RSS while one runs. Creative group, optional; a stored `scad` row cannot render without it. |

**Lean install.** `npm install --omit=optional` sheds the four creative deps (~86 MB) and turns the
creative tools off; it can also leave `sharp` without its native binary (`@img/sharp-<platform>`
is an optional dependency). The kernel and the CLI still run: `sharp` is loaded on first use, so
only the raster tools fail, in-band, naming `npm install sharp`. `mojulo install creative` adds
everything back. See [install-capabilities.md](install-capabilities.md).

### Downloads that happen later, on first use only

Mojulo has **no postinstall download**. These fetch lazily the first time a feature needs them,
are cached, and are skipped entirely if you already have the tool:

| What | When | Size | Skipped if |
|---|---|---|---|
| Chrome for Testing (pinned build in [chromium.js](../control/lib/graph/scene/chromium.js)) | First scene-to-PNG bake or motion render | **~500 MB** | Chrome, Chromium, Edge, or Brave is installed at a standard path, or `MOJULO_CHROMIUM` points at one |
| ffmpeg static build (pinned in [ffmpeg.js](../control/lib/motion/ffmpeg.js)) | First multi-clip MP4 stitch | ~19 MB download | `ffmpeg` is on PATH or `MOJULO_FFMPEG` points at one |
| Geo data (Natural Earth, Nominatim) | First map-backed landscape | small, disk-cached | — |
| Embedding model | `mojulo install recall` (never on a default install) | ~130 MB | Already in `~/.mojulo/models/` |

> **Where the browser and ffmpeg caches live.** They default to `data/chromium` and `data/ffmpeg`
> under the *installed package directory* (the process `chdir`s there), not under `~/.mojulo/`.
> For an `npx` install that is inside the npx cache. Set `MOJULO_CHROMIUM_DIR` /
> `MOJULO_FFMPEG_DIR` to move them. This is the one exception to "delete `~/.mojulo` and it's gone."

---

## Network posture

No telemetry, no phone-home. Outbound traffic happens only on explicit actions, and the site
should list them rather than say "never":

- `npm` fetching the package and its dependencies at install and at `npx` resolution.
- The one-time lazy downloads in the table above.
- `check_for_updates`, when your agent calls it (npm and GHCR version lookups).
- Anything your agent's own provider does. That traffic is your agent's, not mojulo's.
- With the chatbot pack: image pulls during bot builds, a running bot's LLM provider calls, and
  Fly.io deploys if you configure Fly.

Source of truth: fact 4 of the substrate facts in
[context.js](../control/lib/mcp/tools/context.js).

---

## Engine extensions: Godot, Unity, Unreal, Blender

The rule for all four legs: **mojulo emits a pack; you supply the engine.** Every export works with
nothing installed (the pack plus a step-by-step import guide are written, and the machine gate
reports "skipped" with the reason). Installing the engine adds an **advisory machine gate** that
imports the pack headless and stamps what it measured. Gates advise; they never refuse. A human
looking at the result in the engine is the eyes gate, and no gate claims that passed.

Auto-detection of engine binaries is written for **macOS paths only**. On Windows or Linux, set the
environment variable named in each row.

| Engine | What mojulo emits | You need | Version target | Gate env var | Leg |
|---|---|---|---|---|---|
| **Godot** (first-class) | A real Godot 4 project: `project.godot`, the versioned `mojulo-godot` kernel scripts, the GLB, `score.json`, export presets. Playable when the gameplay is declarative. | Godot **4.5 or newer** to open the pack. Free, open source. | Gate verified against Godot 4.7 | `MOJULO_GODOT` (default `/Applications/Godot.app/Contents/MacOS/Godot`) | kernel [0.2.1](../control/lib/graph/scene/godot-kernel/VERSION) |
| **Unity** (gated leg) | A data pack: GLB + `score.json` + audio + recipe, a C# editor importer, runtime scripts (walker, mechanics, menu), deterministic `.meta` files, and a T-numbered `IMPORT-GUIDE.md`. | **Unity 6 (6000.2.x)**, URP template, the `com.unity.cloud.gltfast` package installed from Package Manager (the gate pins 6.9.1). The editor must be **activated** (signed in); an unactivated editor is reported by name and the gate skips. | `UNITY_EDITOR_TARGET` in [unity-project.js](../control/lib/graph/scene/unity-project.js) | `MOJULO_UNITY` (auto-found under `/Applications/Unity/Hub/Editor/`) | 0.4.0 |
| **Unreal** (gated leg) | A data pack: GLB + `score.json` + audio + recipe, a dependency-free editor Python importer, `IMPORT-GUIDE.md`. **Game** packs add the `MojuloKernel` C++ plugin your project compiles. | **UE 5.4 or newer**; proven against **5.8.0**. Plugins: `Interchange glTF` (on by default since 5.3) and `Python Editor Script Plugin` (you enable it). Game packs compile C++, so: **full Xcode on macOS** (Xcode 26+ also needs `xcodebuild -downloadComponent MetalToolchain`) or **Visual Studio on Windows**. | `UNREAL_EDITOR_TARGET` in [unreal-project.js](../control/lib/graph/scene/unreal-project.js) | `MOJULO_UNREAL` (auto-found under `/Users/Shared/Epic Games/`); `MOJULO_UNREAL_TIMEOUT_MS` watchdog, default 15 min | 0.4.2 |
| **Blender** (art pass + worker) | An art-pass pack (GLB + `pack.json` + two Python scripts + `ARTPASS-GUIDE.md`), and separately the GI-bake and render workers that bind results back as vertex colours. No add-on, no socket. | **Blender 4.x or newer**; 5.2 LTS verified. | `BLENDER_TARGET` in [blender-project.js](../control/lib/graph/scene/blender-project.js) | `MOJULO_BLENDER` (default `/Applications/Blender.app/Contents/MacOS/Blender`) | 0.1.0 |

What the engines themselves cost in disk and licensing is theirs, not mojulo's: Unreal and Unity
are multi-gigabyte installs with their own accounts and license terms; Godot and Blender are free
and open source. The site should say that plainly instead of implying the engines come along.

**Honesty rule for copy** (from `get_substrate`): ladder it as "Godot first-class, Unity and
Unreal as gated legs, Blender as an art pass." Never "identical across all four." Every pack ships
an honest-loss ledger naming what did not travel.

### Everything else that exports without an engine

- **`.glb`** (glTF, unlit vertex colours, animation clips) for Blender, three.js, Quick Look.
- **OpenUSD** (`usda` / `usdz`). The verify gate uses `usdcat`, which ships with macOS, and Blender
  as the reader; both optional.
- **STL / 3MF** for printing: mm, z-up, slicer-ready. Say "print-ready STL at true scale" for the
  literal object kinds; figures, worlds and views print as maquettes fit to a target size. Do not
  say "guaranteed watertight": it is honest triangle soup with a closure audit, and slicer repair is
  standard practice.
- **`.scad`** — the odd one out: a **program**, not a mesh. A `scad` recipe returns its own source
  verbatim; a workbench recipe is transpiled term by term into OpenSCAD solids and booleans, and a
  term with no OpenSCAD equivalent arrives as a frozen `polyhedron()` named in the coverage ledger.
  Needs no dependency, since it is text; the OpenSCAD binary, when installed, re-renders it as an
  advisory gate (`scripts/scad-gate.mjs`). Sharp edges do not need this exit: `exact: true` on a
  field or a cut composes it with Manifold inside the recipe, and `mint_solid kind:'scad'` meshes
  an OpenSCAD program in-process. Say "an OpenSCAD program is a recipe" and "exact booleans in the
  recipe", never "mojulo replaces OpenSCAD"; and the round trip runs both ways, since
  `bind_mesh_render` takes an STL or 3MF made outside.

### The print gate: slicers

Optional, same posture as the engines. `scripts/slice-print.mjs` runs a local slicer headless over
the exported 3MF and stamps `mojulo-print-gate.json` beside it.

| Slicer | Status | Found at | Env |
|---|---|---|---|
| PrusaSlicer 2.6+ / SuperSlicer | Verified (2.9.6, macOS) | PATH or `/Applications/PrusaSlicer.app` | `MOJULO_SLICER` |
| Bambu Studio | Verified (02.08.02, macOS); needs its own JSON profiles passed by role | `/Applications/BambuStudio.app` | `MOJULO_SLICER`, `MOJULO_SLICER_PROFILE` |
| OrcaSlicer | Detected, **not** run; its stamp says so | `/Applications/OrcaSlicer.app` | `MOJULO_SLICER` |

Details: [local-slicer-worker.md](local-slicer-worker.md).

### The sharp-edge gate: OpenSCAD

Optional, same posture. `scripts/scad-gate.mjs` renders the exported `.scad` headless and stamps
`mojulo-scad-gate.json` beside it: did it render, and does the solid OpenSCAD computed match the
size (and volume, when one was declared) that mojulo said it would.

| Tool | Status | Found at | Env |
|---|---|---|---|
| OpenSCAD | Verified (snapshot **2026.09.10**, macOS) | PATH or `/Applications/OpenSCAD.app` | `MOJULO_OPENSCAD`, `MOJULO_OPENSCAD_TIMEOUT_MS` |

Install note: the stable `openscad` Homebrew cask has been **disabled since 2026-09-01** for failing
the macOS Gatekeeper check — use `brew install --cask openscad@snapshot`.

Two things this gate deliberately does. It never compares triangle counts (OpenSCAD tessellates
exact solids by `$fn` while mojulo marched a grid, so agreement would be coincidence), and it
expects a sub-cell size disagreement on a field part: mojulo declares its marched MESH and OpenSCAD
renders the IDEAL solid, so a 40 mm disc declares 79.9 mm and renders 80.

Details: [local-openscad-worker.md](local-openscad-worker.md).

---

## Optional local workers (operator-hosted, never dependencies)

Each is a separate install you run yourself. Mojulo never starts, probes, or depends on them; your
agent is the bridge. Absence degrades one loop and breaks nothing.

| Worker | What it adds | Size | Requirements | Doc |
|---|---|---|---|---|
| Blender (bake / render) | Path-traced global illumination baked into vertex colours; premium stills; the USD/GLB verify gate | Blender's own install | Blender 4.x+; GPU helps Cycles but is not required | [local-blender-worker.md](local-blender-worker.md) |
| ComfyUI + Qwen-Image-Edit | Paints the directed-image scaffolds when your agent has no image capability | **~31 GB** (fp8); `--gguf` adds a ~17 GB quant for lower RAM; `--sdxl` ~15 GB; `--anime` ~6.8 GB | Python venv, loopback port 8188 (ComfyUI has no auth: keep it on 127.0.0.1). Documented performance is on an M1-class machine with 64 GB. Apple Silicon needs the GGUF quant. | [local-image-worker.md](local-image-worker.md) |
| Kokoro TTS | Spoken narration when your agent cannot speak | ~92 MB weights plus a few MB of npm deps | Node; runs on onnxruntime | [local-voice-worker.md](local-voice-worker.md) |
| Mesh sculptors (TripoSR, Hunyuan3D, or cloud APIs) | High-frequency surface detail over mojulo's greybox | TripoSR: ~1.4 GB on the maintainer's machine; Hunyuan3D needs a GPU | Python 3.11 + torch; cloud keys live in your worker script, never in mojulo | [local-mesh-worker.md](local-mesh-worker.md) |
| Ollama (via the chatbot pack) | A local LLM for compiled bots | Ollama's own models | The chatbot pack | [chatbot/](chatbot/) |

---

## The chatbot pack (opt-in since 2.0)

Absent from a default install; `mojulo install chatbot` writes a marker file and turns the tools
on, installing the **recall** group first (the builder's preview RAG embeds with the same model the
deployed bot uses). What it needs beyond the baseline:

- **An LLM provider key** (OpenAI, Anthropic, or local Ollama). A compiled bot calls a model on its
  own because it runs without you. This is the one artifact mojulo makes that needs a key.
- **Docker** for the default local deploy (`docker compose up` on the exported zip). The bot image
  is `ghcr.io/zombico/mojulo-bot`, Debian bookworm slim on Node 20, pinned to an exact tag in
  [control/.env.example](../control/.env.example); never `:latest`.
- **A Fly.io token**, only if you want cloud deploy. Your Fly account, your bill. No `flyctl`
  install needed.
- **Air-gapped**: `MOJULO_OFFLINE_BUILD=1` bundles full source and Dockerfile so the image builds
  on the target machine.

Full requirements and deploy options: [chatbot/README.md](chatbot/README.md).

---

## Platform notes

- **macOS** is where everything above was built and verified, on Apple Silicon. All engine and
  worker auto-detect paths are macOS application-bundle paths.
- **Windows**: the installer handles `.cmd` shims and writes an absolute `npx` path for hosts that
  cannot see it; Chrome and Edge are detected under Program Files. `better-sqlite3`, `sharp`, and
  `onnxruntime-node` ship prebuilt binaries for Windows x64. Engine gates need the env vars set by
  hand and are **not verified** on Windows. Verified on a native Windows machine on 2026-09-11:
  `npx mojulo init` completed under Claude Code and a first render landed. Codex on Windows, the
  engine gates and the export legs are still unverified there.
- **Linux**: the test suite runs on Ubuntu in CI, and a cold install of the 2.0.1 tarball was
  checked on 2026-09-10 in `node:22` containers on x64 and arm64 (install exits clean, the
  `better-sqlite3` prebuilt loads, `mojulo tools` lists). On 2026-09-21 the published 2.0.6
  tarball was driven end to end from an ephemeral Linux x64 sandbox on Node 24.15 by a chat agent
  with no MCP binding and no browser: cold install from registry.npmjs.org with `--omit=optional`
  (then `sharp` added by hand — the 2.0.6 CLI would not start without it; 2.0.7 carries the fix),
  `compose_world` for a city, `export_model` to GLB. The same day a Claude cloud sandbox with an
  egress allowlist installed 2.0.6 only after skipping `onnxruntime-node`'s postinstall (it fetches
  from nuget) and drove `mint_solid` to a true-scale phone exported as glTF; 2.0.7 removes that
  runtime from the default install and lets `init` run without a terminal. Re-minting that
  recipe on macOS gives byte-identical geometry, index, colour and UV buffers; the one embedded
  texture PNG is pixel-identical but its deflate stream differs (see the determinism caveat
  under [Where it goes](../README.md#where-it-goes)). Still unverified on Linux: the dashboard,
  the embedder, the stdio MCP transport under a host, the Chrome bake, and the engine gates.
  Chrome and Chromium are detected at the usual `/usr/bin` and snap paths; the app-runtime
  daemon has a systemd user-unit recipe in [app-runtime.md](app-runtime.md). Same env-var story
  for engines; not verified.
- **Native modules**: `better-sqlite3` uses a prebuilt binary when one exists for your OS, CPU, and
  Node version and otherwise compiles with `node-gyp`, which needs a C++ toolchain. If an install
  fails on an unusual platform, that is the first place to look.
- **Node version pinning**: the floor is 22.12 because that is where ESM detection defaults
  changed. There is no upper pin. Node 24 is recorded as verified for the CLI and the kernel
  (24.15 on Linux x64, the 2026-09-21 sandbox run above; the dev suite runs on 24.8 on macOS).

---

## Uninstall footprint

Unwire mojulo from the MCP host config, remove the npm package, delete `~/.mojulo/` (or
`$MOJULO_HOME`), and remove any bot containers, images, or Fly apps you created. Also delete the
browser and ffmpeg caches if they were fetched (see the note under
[Downloads that happen later](#downloads-that-happen-later-on-first-use-only)). Engines and workers
you installed yourself are yours to remove.

---

## What the site must not claim

- A RAM or CPU minimum. None has been measured.
- "Works on Windows and Linux" without the qualifier that engine gates are verified on macOS only.
- That Unity, Unreal, Godot, or Blender are included, downloaded, or configured by mojulo.
- "Identical output across all four engines." Godot is first-class; the others are gated legs with
  honest-loss ledgers.
- "Watertight" or "manifold" STL. Say "print-ready at true scale" for literal objects.
- "Zero network." Say "no telemetry" and list the explicit outbound actions above.
- Any enumerable count (tools, kinds, locales, packs). Point at the list that defines it.
- The old size figures ("a few hundred MB", "~340 MB kernel"). Use the measured table above and
  re-measure at each release.

---

## Discrepancies found while writing this (2026-09-09)

Recorded so nobody rediscovers them. None are fixed by this page.

1. **A fresh `npm install mojulo@1.5.0` failed twice today** with registry 404s on
   `@aws-sdk/credential-provider-login@3.972.78` and `@aws-sdk/core@3.978.0` tarballs, reached
   through the caret range on `@aws-sdk/client-bedrock-runtime`. The AWS SDK publishes many
   packages per release and its metadata can lead its tarballs by hours, so this is most likely
   transient. The durable point: an npm package ships no lockfile, so every fresh install floats to
   whatever the AWS SDK published that day. Pinning exact, or moving that dependency behind the
   chatbot pack, would remove the exposure. **Resolved in 2.0.1:** the Bedrock provider and
   `@aws-sdk/client-bedrock-runtime` were removed from the package; there is no AWS SDK in the
   tree.
2. **The install-capabilities size figures are understated.** Measured install is ~850 MB before
   models, not "a few hundred MB"; the "~340 MB kernel" predates `onnxruntime-node` shipping three
   platforms' binaries in one package. Both the README and `install-capabilities.md` now point at
   the measured table above.
3. **Browser and ffmpeg caches land outside `$MOJULO_HOME`** (see the note above), which
   contradicts substrate fact 11's "delete `$MOJULO_HOME`, that is the whole footprint."
4. **Substrate fact 8** lists exports as "zip, HTML, glb, stl, WAV, MIDI, a Godot project" and
   omits 3MF, USD, and the Unity, Unreal, and Blender packs.
5. **The embedding model** was described as ~113 MB in the README; it is ~130 MB on disk including
   the tokenizer. The README now says ~130 MB.
