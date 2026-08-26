# CLAUDE.md

Guidance for Claude Code (claude.ai/code) and other agent runtimes working in this repository. Keep this file as the fast orientation layer: commands, invariants, and pointers to deeper docs. If a detail needs a paragraph of caveats, it probably belongs in `docs/` or an integration plan, then linked here.

## First read

- The current-state snapshot of unreleased branch work is the **Unreleased** section of [control/CHANGELOG.md](control/CHANGELOG.md). (The maintainer keeps a denser private working-tree ledger at `docs/STATUS.md`, gitignored — not present on a clean clone, not part of repo-dev orientation.)
- [docs/BOT-ARCHITECTURE.md](docs/BOT-ARCHITECTURE.md) is the source of truth for bot factory flow: cartridge composition, vector baking, artifact layout, Fly deploy, and Connect Bot proxy.
- [docs/MCP-ARCHITECTURE.md](docs/MCP-ARCHITECTURE.md) is the source of truth for the headless control surface: transport, ring model, session binding, deliberation surfaces, catalysts, mcp-orbit, and primitive binding.
- [docs/POLYGONIZER-SYNTHESIS.md](docs/POLYGONIZER-SYNTHESIS.md) is the source of truth for the polygonizer/manji-tree substrate as it stands today: the four wave primitives, structure-manji, the seven field kinds, shelf cards, and how they all couple. Supersedes the dozen integration plan files in `lite-template/integration/0605/`.
- [docs/AGENT-REFERENCE.md](docs/AGENT-REFERENCE.md) is the deeper agent-facing map for MCP rings, data layout, runtime daemons, and release notes that are too dense for this file.
- [docs/install-capabilities.md](docs/install-capabilities.md) is the source of truth for the install shape: the kernel + two install-gated packs (ops / creative), physical pack detection, `mojulo install creative`, and the kernel diagram maker.
- [AGENTS.md](AGENTS.md) adds Codex-specific setup for connecting to the local MCP control plane.

Read the relevant deeper doc before non-trivial work that crosses `control/` and `lite-template/`, changes deploy/build behavior, or touches the MCP tool registry.

## Repo shape

Mojulo is the agent's workshop — a local, stateful substrate that turns conversations into things that keep existing after the chat ends: running chatbots, connected services, apps, media (worlds, views, films, audio, publications — minted as tiny deterministic recipes), and playable games composed from the rest. The canonical self-description lives in the `get_substrate` drawer ([control/lib/mcp/tools/context.js](control/lib/mcp/tools/context.js)); keep user-facing copy consistent with it.

Mojulo installs as a **kernel + two install-gated capability packs** — ops (bots / services / apps) and creative (the render / media / games stack) — keyed to what's physically present on the host. A lean ops-only install stays small and the heavy creative stack is optional (`mojulo install creative`); the kernel alone can still mint a diagram. Install state is derived from disk, with `MOJULO_PACKS` as an explicit override. See [docs/install-capabilities.md](docs/install-capabilities.md).

Two-package monorepo. Both usually matter:

- [control/](control/) - Next.js 16 control plane on port 3001. It is the bot factory, dashboard, and HTTP MCP server.
- [lite-template/](lite-template/) - Express 5 bot runtime on port 3000. It is the source staged into per-bot artifacts and published as the GHCR bot image.

The control plane stages files from `lite-template/` into a per-bot zip. The same runtime is published as `ghcr.io/zombico/mojulo-bot:X.Y.Z` via [.github/workflows/publish-bot-image.yml](.github/workflows/publish-bot-image.yml). When changing `lite-template/`, check whether [control/.env.example](control/.env.example)'s `BOT_IMAGE` and the matching constant in [control/lib/deployers/docker.js](control/lib/deployers/docker.js) need a bot tag bump.

The control plane is increasingly headless: the dashboard, chat builder, wizard, and MCP tools are different faces over the same primitives. Changes to builder, deployer, fleet, or app runtime code should be checked against both UI and MCP call paths.

## Golden rules

- Conversation data never moves into the control-plane DB. Per-bot conversation and submission reads must go through [control/lib/deployers/bot-proxy.js](control/lib/deployers/bot-proxy.js).
- The chat builder, modular wizard, and MCP build tools converge on [buildDeploymentConfig()](control/lib/config-builder.js). Do not add paradigm-specific branches downstream of config composition.
- Bot turn rows must go through the hashing helpers. Do not insert turns that bypass `content_hash` / `chain_hash`; see [docs/turn-hashing.md](docs/turn-hashing.md).
- The bot image is bot-agnostic. Fly deploy injects per-bot config as files; do not rebuild images per bot.
- `forward_context` is a thin routing index, not a glossary. Keep heavy orientation behind Ring 0 drawers and update `TOOL_INDEX` / `ROUTING_INDEX` when adding main-flow MCP tools.
- The control plane is single-operator and self-hosted; there is no user identity by default. The opt-in roles pack lets the operator issue scoped, revocable keys to their own delegates — operator-owned delegation, not multi-tenancy. Do not introduce multi-tenant assumptions (mutually-distrusting tenants, platform-as-referee isolation); hostile-tenant isolation is out of scope.
- The MCP transport binds to localhost. Do not expose it publicly or add a tunnel path — the substrate has no auth layer and assumes loopback-only reachability. Remote agents reach mojulo by being run on the same host, not by the substrate reaching out to them.
- The dashboard is not a conversational surface. The operator drives mojulo from their host MCP agent (Claude Code / Codex / etc.); dashboard pages render state and offer "copy starter prompt" affordances that direct the operator to drive work from that agent. The bot builder chat is the deliberate exception (it is the bot's own chat, not a chat with the substrate). Do not add `HomeAgentChat`/`useAgentChatStream` consumers to deliberation surfaces.
- Do not read or echo `.env` secrets from generated bot/app directories. Use masking helpers or MCP tools designed for env inspection.
- UI strings should be i18n-ready in the English source messages.
- Capability, intent, and suitability assessments belong to the operator, not to mojulo or the maintainer. When drafting user-facing copy, marketing material, dashboard affordances, or refusal/gating logic, default to the posture in [TERMS.md](TERMS.md) and [docs/responsibility-model.md](docs/responsibility-model.md): the substrate composes primitives, the operator owns the consequences. Do not introduce intent-classification, use-case gating, or content-policy enforcement layers on top of what the operator's LLM provider already enforces.

## Commands

### Control plane

```bash
cd control
cp .env.example .env        # first-time only
npm install
npm run dev                 # Next.js on http://localhost:3001
npm run build               # next build
npm run start               # next start -p 3001
npm run build:bot           # docker build -t mojulo/bot:latest ../lite-template
node scripts/cleanup-stale-artifacts.js [--dry-run]
node scripts/reindex-embeddings.js [--verbose]
node scripts/mcp-stdio.mjs tools|packs|help|call|pack_* …   # CLI front door over the tool registry (in-process, no dashboard needed); see scripts/mojulo-cli.plan.md
```

There is no repo-wide lint/typecheck script. For simple JS smoke checks, use `node --check <file>`. For JSX, parse with `@babel/parser` from the `control` package. The control path alias is `@/*` -> `./*` in [control/jsconfig.json](control/jsconfig.json).

### Bot runtime

```bash
cd lite-template
npm install                 # fetches multilingual-e5-small q8 ONNX into models/
npm start                   # node server.js on port 3000
docker compose up           # Debian slim Node 20 runtime
```

The `.onnx` weights are gitignored and larger than 100MB. They are fetched by [lite-template/scripts/fetch-embed-model.mjs](lite-template/scripts/fetch-embed-model.mjs) during bot install/build. Do not commit model weights.

## Release notes

### Bot image

Tag a bot runtime release as `bot-vX.Y.Z` and push it. The publish workflow builds multi-arch images and pushes `ghcr.io/zombico/mojulo-bot:X.Y.Z` plus `:latest` on the default branch. The control plane pins exact bot tags; never use `:latest` from control-plane deploy code.

### Control plane

Add a `## [X.Y.Z] - YYYY-MM-DD` section to [control/CHANGELOG.md](control/CHANGELOG.md), commit, then tag `vX.Y.Z`. The release workflow slices that changelog section. `bot-v*` tags do not trigger control-plane releases.

## Architecture map

- MCP server: [control/lib/mcp/server.js](control/lib/mcp/server.js), tools in [control/lib/mcp/tools/](control/lib/mcp/tools/), full model in [docs/MCP-ARCHITECTURE.md](docs/MCP-ARCHITECTURE.md).
- Bot build pipeline: [control/lib/deployers/docker.js](control/lib/deployers/docker.js), [control/lib/composer/](control/lib/composer/), [docs/BOT-ARCHITECTURE.md](docs/BOT-ARCHITECTURE.md).
- Cloud deploy: [control/lib/deployers/cloud-deploy.js](control/lib/deployers/cloud-deploy.js), [control/lib/deployers/fly.js](control/lib/deployers/fly.js). Read the top comments in `fly.js` before changing lifecycle behavior.
- Builder/wizard convergence: [control/lib/builder/](control/lib/builder/), [control/components/wizard/modular/](control/components/wizard/modular/), [docs/chat-builder.md](docs/chat-builder.md), [docs/wizard-builder.md](docs/wizard-builder.md).
- Fleet aggregation and scoped SQL: [control/lib/deployers/bot-fleet.js](control/lib/deployers/bot-fleet.js), [control/lib/fleet/scoped-sql.js](control/lib/fleet/scoped-sql.js), and [docs/AGENT-REFERENCE.md](docs/AGENT-REFERENCE.md#fleet-aggregation).
- Catalysts: [control/lib/mcp/catalysts/](control/lib/mcp/catalysts/), [docs/catalysts.md](docs/catalysts.md). Catalyst frontmatter is JSON, not YAML.
- App runtime: [control/lib/runners/](control/lib/runners/), [docs/app-runtime.md](docs/app-runtime.md).
- Vector RAG: [docs/vector-rag.md](docs/vector-rag.md), [lite-template/helper/embedder-local.js](lite-template/helper/embedder-local.js).
- Protocol and LLM behavior: [lite-template/helper/llm-client.js](lite-template/helper/llm-client.js), [control/lib/llm-providers.js](control/lib/llm-providers.js), [docs/protocol-composition.md](docs/protocol-composition.md).
- CSS-3D scene backend (a live, dependency-free `preserve-3d` second renderer beside the SVG path — rooms, suites, cities from the same world geometry): [control/lib/graph/scene-css3d.js](control/lib/graph/scene-css3d.js), suites [control/lib/graph/suite-layout.js](control/lib/graph/suite-layout.js), cities [control/lib/graph/fractal-city.js](control/lib/graph/fractal-city.js). The baked, camera-independent lighting/atmosphere model (vexar + traced diffusion + soft pools + cast/contact shadows + moonlight + sky) is in [docs/scene-css3d-lighting.md](docs/scene-css3d-lighting.md).
- Dungeon-designer (the fantasy-interior primitive — organic, not-flat caves/dungeons, as opposed to the flat generative houses/rooms of suite-layout; invariant: there is a ceiling and a floor, but no surface is assumed flat): [control/lib/graph/dungeon-designer.js](control/lib/graph/dungeon-designer.js), design + roadmap (texture tiles, airsealed corridors, castle interiors) in [control/lib/graph/dungeon-designer.plan.md](control/lib/graph/dungeon-designer.plan.md). A `{chambers, tunnels}` graph spec → walkable World or ant-farm section; composes the round-chamber + golden-relief + carved-mouth + traced-fire kernels in scene-css3d.js.
- Raymarch effects layer (volumetric effects — fog first — raymarched as a transparent overlay that composites OVER the three.js mesh worlds, occluding against the world's own solids via a grid-culled scene SDF; NOT a world-replacement raymarch): primitives in [control/lib/graph/volume-raymarch.js](control/lib/graph/volume-raymarch.js) (`buildVolumeFrag`, `overlay:true`), [control/lib/graph/effects-occluder.js](control/lib/graph/effects-occluder.js) (grid-culled box-field SDF), [control/lib/graph/effects-fog.js](control/lib/graph/effects-fog.js) (`composeVolumeFog`); hosted by `emitThreeWorld({ fog })` in scene-three.js and exposed as an opt-in `fog` manifest setting in [control/lib/graph/world-scene.js](control/lib/graph/world-scene.js). Read [docs/raymarch-effects-layer.md](docs/raymarch-effects-layer.md) (principles + primitive inventory + how to add a new effect layer) before building another raymarch visual layer; build log in [control/lib/graph/effects-layer.plan.md](control/lib/graph/effects-layer.plan.md).
- Procedural materials (the texture-free vertex-colour material system — the Wii/PS2-era metal look: lambert base + top-lit ramp + brushed cloud + weathering, all baked into per-corner `cornerFills`, NOT textures or shaders; peer to `surface-textures.js`): registry + layers + `resolveFaceMaterials` in [control/lib/graph/materials/procedural-material.js](control/lib/graph/materials/procedural-material.js), exposed as a generic opt-in — any mesh-world face carrying `material: '<preset>'` (or `{ kind, grid?, tint?, wear?, cloud?, seed?, lit? }`) is tessellated + vertex-coloured by `resolveFaceMaterials` in [control/lib/graph/worlds/world-scene.js](control/lib/graph/worlds/world-scene.js) (runs before the AO bake; composes with `vao`/`spec`). Presets: `gradient-plate`/`brushed-steel`/`brushed-hull`/`weathered-hull`/`weathered-heavy`. The render primitive underneath is per-corner `cornerFills` in [control/lib/graph/figures/face-mesh.js](control/lib/graph/figures/face-mesh.js). Invariants: seeded noise only (deterministic, byte-identical re-render); absent `material` ⇒ face list untouched; grid² tessellation cost → grid ≤4 for live worlds, grid 8 + AO for offline hero renders. Design + usage: [control/lib/graph/materials/procedural-material.plan.md](control/lib/graph/materials/procedural-material.plan.md).
- Beats (the audio primitive family — synthesized-never-sampled musical artifacts as tiny seeded recipes; kinds: ambient loop / composition score / pattern groove / sfx cues): kernel + patches + instruments + manifests + player + offline WAV render in [control/lib/graph/beats/](control/lib/graph/beats/), MCP tools (create / get / update / annotate / diff / export + vocab) in [control/lib/mcp/tools/beats.js](control/lib/mcp/tools/beats.js), the studio at [control/app/beats/](control/app/beats/) over the `control/app/api/beats/[ref]/` routes (revisions + annotations ride `beats_revisions` / `beats_annotations`; rows stay in `sketches` — the domain layer is the sovereignty). Worlds opt in via the manifest `audio` channel (soundtrack / SFX cues / footsteps / wind / macro `bindings`), resolved by [control/lib/graph/beats/beats-world.js](control/lib/graph/beats/beats-world.js). Design + build log: [control/lib/graph/beats/beats.plan.md](control/lib/graph/beats/beats.plan.md). Invariants: recipes not renders; seeded dice only (mulberry32, never `Math.random`); audio reads sim state and never writes back; muted capture stays byte-identical. A composition can *sing*: a `patch:'voice'` part is realized by the in-process parametric formant synth ([control/lib/graph/beats/beats-song-voice-parametric.js](control/lib/graph/beats/beats-song-voice-parametric.js) + the beats-song-* siblings) — no external worker, no new tool or route; design + engine decision in [control/lib/graph/beats/beats-song.plan.md](control/lib/graph/beats/beats-song.plan.md).
- Image outcomes (the director layer for external image generation — mojulo designs pictures but cannot paint them; scaffold recipes stay sovereign, painted PNGs are bound derived renders with provenance): [control/lib/graph/image-outcomes/](control/lib/graph/image-outcomes/), durable worker handoff (`request/pull/submit/accept/reject_image_render` over the `image_render_requests` table) in [control/lib/mcp/tools/render-handoff.js](control/lib/mcp/tools/render-handoff.js), optional local ComfyUI+SDXL worker in [docs/local-image-worker.md](docs/local-image-worker.md). The seam doctrine ("bicycles": self-documenting loops with a machine gate and an eyes gate, never conflated) is [docs/bicycles.md](docs/bicycles.md).
- Voice (deterministic voice-register recipes — confidence × depth resolved to Kokoro blend weights, pure math, no dice; WAVs are disposable derived renders via the optional local Kokoro worker): [control/lib/graph/voice/](control/lib/graph/voice/), MCP tools in [control/lib/mcp/tools/voice.js](control/lib/mcp/tools/voice.js), worker doc [docs/local-voice-worker.md](docs/local-voice-worker.md). Scope: voiceovers and narration; character acting is out of scope.
- World GI bake — the "blenderification" bicycle (an OPTIONAL, operator-hosted capability that bakes Blender Cycles global illumination into a world's OWN vertex colours, which mojulo's unlit runtime draws at ZERO runtime cost — soft AO + contact shadow with no runtime shadow map; same posture as the image/voice workers — needs a local Blender, substrate holds no Blender/keys/state). **If the user has Blender installed, this path is available; if not, skip it — nothing else depends on it.** Driver [control/scripts/bake-world-gi.mjs](control/scripts/bake-world-gi.mjs) + headless worker [control/scripts/bake-world-gi.py](control/scripts/bake-world-gi.py). A fixed DRIVETRAIN (FACING→EXPORT→BAKE→machine-gate→BIND→eyes-gate) with swappable GEAR ADAPTERS per world kind: `inline-faces` (frozen `manifest.faces` maps — recolours faces in place, so `mapRef` mode-variants inherit) and `generated-mesh` (fractal-city / dungeon / floorplan — `resolveWorldScene`→bake→a `<ref>_gi` meshRef variant). Run: `node scripts/bake-world-gi.mjs --ref <world> --preset interior-day|exterior|space|interior-lit --write` (repo-dev exports `MOJULO_DATA_DIR="$(pwd)/data" MOJULO_OUTCOMES_DIR="$(pwd)/data/outcomes"`; `--preview` for a dry run). Prereq: authored face normals — the migration stamps `outNormal` per face, else a bake blackens back-faces ([control/lib/graph/scene/export-normals.plan.md](control/lib/graph/scene/export-normals.plan.md)). The baked WORLDS are ungated — they ship to any player/bot/deploy as plain vertex colours, no Blender. Design + rollout + presets + the two gates: [control/lib/graph/scene/map-gi-bake.plan.md](control/lib/graph/scene/map-gi-bake.plan.md); worker posture + hero-object bake sibling: [docs/local-blender-worker.md](docs/local-blender-worker.md); the "bicycle" doctrine (machine gate + eyes gate, never conflated): [docs/bicycles.md](docs/bicycles.md).
- Edifice (the workbench for buildings — a bespoke walkable building authored as a graph of masses + concourses with doorway punches, vs. the frozen generators of compose_world; advisory livability checks, never gated): [control/lib/graph/architecture/edifice.js](control/lib/graph/architecture/edifice.js), tool in [control/lib/mcp/tools/edifice.js](control/lib/mcp/tools/edifice.js), design + roadmap in [control/lib/graph/architecture/dream-architecture.plan.md](control/lib/graph/architecture/dream-architecture.plan.md).
- Plan mode (Ring 8): [control/lib/mcp/tools/plan-mode.js](control/lib/mcp/tools/plan-mode.js), dashboard at [control/app/plan/](control/app/plan/). Plans are the proposed speculative layer; contextmap is sealed reality. See [docs/AGENT-REFERENCE.md](docs/AGENT-REFERENCE.md#plan-and-research-modes).
- Research mode (Ring 9): [control/lib/mcp/tools/research-mode.js](control/lib/mcp/tools/research-mode.js). Accretive optional drawer upstream of plans; deliberately not woven into `forward_context`. See [docs/AGENT-REFERENCE.md](docs/AGENT-REFERENCE.md#plan-and-research-modes).

## Native dependency landmines

- `onnxruntime-node` is glibc-only. Keep the bot Dockerfile on Debian slim Node 20; do not switch it to Alpine.
- `better-sqlite3` compiles per architecture. The GHCR bot image is multi-arch for this reason.
- The control plane intentionally has no `postinstall` model download. `control/scripts/fetch-embed-model.js` is explicit/lazy so `npx mojulo` does not immediately fetch 113MB.
- When adding native server dependencies to control, check [control/next.config.mjs](control/next.config.mjs)'s `serverExternalPackages`.

## Data layout

- Control SQLite: [control/data/mojulo-lite.db](control/data/), schema and migrations in [control/lib/db/index.js](control/lib/db/index.js), repositories in [control/lib/db/repositories/](control/lib/db/repositories/).
- Generated zips: [control/data/artifacts/](control/data/artifacts/).
- Uploaded documents: [control/data/storage/](control/data/storage/).
- Bot SQLite: `data/conversation.db` inside each bot's `./data/` mount.

For table-level orientation, see [docs/AGENT-REFERENCE.md](docs/AGENT-REFERENCE.md#data-layout).
