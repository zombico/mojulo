# Install capabilities — kernel + two install-gated packs (ops / creative)

Status: PROPOSED (2026-08-20). Step 0 (operator-world removal) + P1 (boundary guard) + P2 (install
manifest + gate) + P3a (deliberation decoupled) + P3b (office↔creative bridges lazified; office wing
now statically render-free) + P3c-1/2 (diagram RENDERER → kernel) DONE. P3c-3 (diagram TOOLS → spine)
and P2b (physical import-skipping) deferred.

## P3c — diagrams are a KERNEL capability (a bare no-packs mojulo can render a diagram)

Decision (2026-08-20): the 2D diagram renderer is kernel, not creative — "diagrams are just SVGs."
Heavy 3D/scene/image renders stay creative. Progress:
- **Step 1 (DONE) — sever the signage tie.** The diagram renderer's only creative dependency was
  `CreationMap → signage-chrome → vexar` (an OPTIONAL `manifest.signage` annotation overlay; core
  diagrams never call it). Lifted the 3 trivial colour primitives to kernel `lib/color.js` (vexar and
  its 40 creative importers untouched), and relocated the shared `signage-chrome` annotation util
  (used by CreationMap + 2 scene backends) to kernel `lib/signage-chrome.js`.
- **Step 2 (DONE) — renderer → kernel.** `sketch-svg.js` (`renderSketchToSvg`, React SSR of
  `CreationMap`) relocated to `lib/sketch-svg.js`; 6 importers repointed. The whole chain
  (`sketch-svg → CreationMap → signage-chrome → color`) is now provably `lib/graph`-free — verified
  functionally by `lib/sketch-svg.nopacks.test.js` (renders a diagram to SVG) and structurally by the
  guard. Full suite green (460 / 6566).
- **Step 3 (deferred → fold into P2b) — diagram TOOLS → spine.** Investigated 2026-08-20:
  `create_sketch` (`lib/mcp/tools/sketches.js`) is a **2026-line creative mega-tool** — it handles
  every sketch kind (worlds, solids, image-outcomes, beats, voice, glb/stl export, skinning) with ~20
  static creative imports; the diagram path is the light default buried in it. Validation is in
  `sketch-manifest.js` (creative), diagram + heavy validators intermixed. So "create_sketch → spine" is
  a large, risky refactor of a central hot-path file, NOT a pragmatic increment — and it only *pays
  off* at P2b (pre-P2b, all code is on disk and create_sketch works; a no-packs install only needs to
  MINT a diagram once P2b physically removes creative). **Decision: defer to P2b and design it with the
  registration partitioning.** Two approaches when we get there:
  - **(A, preferred)** extract a minimal `mintDiagram` (diagram validator + store) into kernel, expose
    a small spine diagram tool; leave the mega-tool in `pack_diagram`. Truer to "diagrams are just
    SVGs"; small; cost = two ways to make a diagram.
  - **(B)** lazy-load `create_sketch`'s ~20 heavy imports so the module loads in kernel and diagram
    minting works there. One tool; real surgery on 2026 lines.
  The RENDERER (steps 1–2, done) was the load-bearing piece; a no-packs mojulo can already *render* a
  diagram — only the mint-tool surface remains, and it belongs with P2b.
Supersedes the *coarse-grain* half of `tool-packs.plan.md` (deleted) — that plan correctly rejected
"two wings" as the grain for the **tools/list presentation** problem and chose ~18 fine packs. This
plan claims the **other axis**: two coarse packs as the grain for **machine install / dependency**
footprint. The two are layered, not competing (see "Two axes").

Owner seams: `control/lib/mcp/packs.js` (already carries `wing:`), `control/lib/mcp/server.js`
(registration + capabilities), `control/lib/mcp/tools/assembler.js` (tool registration), a new
install manifest (env or `mojulo.config`), and a CI dependency-direction guard (new).

## Thesis

Reposition mojulo as **a workshop kernel** — the event queue, the MCP tool registry, the CLI front
door, and the SQLite + graph store — with **ops** and **creative** as modular capabilities **gated
by what is installed on the machine**. "Full install" is not a third thing; it is the functional
union of the two packs (ops = 1, creative = 1, full = 1+1). This matches the posture the codebase
already uses for heavy optional capability (the "bicycle" workers — Blender / ComfyUI / Kokoro —
are already operator-hosted, install-gated, keyless; see [docs/bicycles.md](../../../docs/bicycles.md)).
Two coarse packs generalize that posture from single workers to the two capability engines.

## Two axes (why this doesn't duplicate packs.js)

| | **Presentation axis** — `packs.js` (exists) | **Install axis** — this plan |
|---|---|---|
| Gates | which tool *schemas* enter the agent's context at connect | which *code + node_modules + models* exist on disk |
| Driver | connect-time token cost (~93K tokens, 64% creative) | install footprint & native-dep surface |
| Grain | ~18 fine packs (`wing:'office'` / `wing:'studio'`) | **2 coarse packs** (ops / creative) |
| Blocked by | `notifications/tools/list_changed` host gap (claude-code#66084) | **nothing** — presence is fixed at process start |

They **layer**: install decides which packs *can* register; presentation decides which of the
installed packs' schemas *load lazily*. The bridge already exists — `packs.js` tags every pack with
`wing`, and the two install packs are exactly the two `wing` values. Install-gating = "no
`wing:'studio'` pack present on disk → those packs never enter the registry, static `tools/list` per
install, no `list_changed` needed." **The install axis is more shippable than the parked presentation
plan precisely because it never mutates the list mid-session.**

## Audit evidence (2026-08-20) — the split is already clean

- **Engine level: 0 cross-pack import edges.** Nothing under `lib/graph` · `lib/motion` ·
  `lib/outcomes` imports `lib/deployers` · `lib/builder` · `lib/composer` · `lib/fleet` · `lib/apps` ·
  `lib/triggers` · `lib/connected-services` — and vice versa. The two engines already don't know
  about each other.
- **Kernel is empirically a two-module surface: `lib/db` + `lib/mcp`.** That is what *both* packs
  reach for structurally and nothing else. (Creative → `lib/db` ×30, `lib/mcp` ×18; ops → `lib/db`
  repositories.)
- **Tool-handler layer:** 87 tool files import creative, 6 import ops, and **exactly one imported
  both** — `scene-operator-world.js`. That single bridge is now removed (Step 0).
- **Three minor kernel leaks to absorb:** `lib/graph` imports `lib/deployment-auth`,
  `lib/llm-providers`, and `lib/embedder` once each. All three arguably belong *in* the kernel, which
  dissolves the leak rather than cutting an edge.

## Step 0 — remove operator-world (DONE)

`operator-world` was the only tool that composed ops state (connected-services) into a creative
artifact (a walkable world) via direct import — the one edge that would have straddled the pack
boundary. Removed entirely as a concept:
- deleted `lib/graph/worlds/operator-world.js` (+ `.test.js`), `lib/mcp/tools/scene-operator-world.js`,
  `lib/graph/views/view-vocab/operator.md`;
- unwired from `compose-world.js` (base `operator`, retired `create_operator_world`, enum, prose),
  `world-kinds.js` (registry entry), `sketch-manifest.js` (`WALKABLE_WORLD_KINDS`), `motion.js` /
  `world-motion.js` (world_ref kind lists), `motion-vocab/world.md`;
- test counts / snapshot / kinds-literals updated. Full suite green (6551 passed).

Rationale beyond the audit: operator-world was the one place ops and creative were *conceptually*
fused, not just code-coupled. If a future need to "walk your services" returns, it re-enters as a
**bridge capability** that reads an ops artifact through a kernel ref (see "Composition"), never as a
creative module importing the ops loader.

## The kernel boundary

Kernel = "what mojulo IS", always present, the only allowed coupling surface between packs:
- **event queue / daemon supervisor** — `lib/daemons`, the supervisory half of `lib/runners`
  (`list_daemons` / `start`/`stop_daemon` / `poll_job` / `list_running`)
- **MCP tool registry + transport** — `lib/mcp` (server, packs, session-binding, telemetry, jobs)
- **store** — `lib/db` (schema, migrations, repositories) + the sketches/graph store
- **CLI front door** — `scripts/mcp-stdio.mjs`
- **routing** — `forward_context` + `lib/mcp/tools/context.js`
- **absorb the leaks** — move/keep `lib/llm-providers`, `lib/embedder`, `lib/deployment-auth`,
  `resolve-api-key`, `storage`, `version`, `config-builder`, `module-dir` in kernel.

Everything inside a pack may churn freely; discipline concentrates on this one small, stable surface.

## Pack membership (proposed — ambiguous dirs flagged)

**Ops pack** (office wing): `lib/deployers`, `lib/composer`, `lib/builder`, `lib/fleet`,
`lib/fleet-scene`, `lib/connected-services`, `lib/triggers`, `lib/apps`, `lib/app-mcp-scaffold`,
`lib/runtime-adapters`, `lib/form-schema-config`, the app-runtime half of `lib/runners`, + their
`lib/mcp/tools/*` handlers. Heavy deps: docker/fly, bot-runtime staging.

**Creative pack** (studio wing): `lib/graph` (scenes, worlds, beats, materials, dungeon, edifice,
image-outcomes, voice, motion-vocab, …), `lib/motion`, `lib/outcomes`, `lib/visual-language`,
`lib/preview`, + their `lib/mcp/tools/*` handlers (the 87 creative tool files). Heavy deps: the graph
render stack; the further install-gated worker bicycles nest *under* this pack.

**To classify (decisions, not defaults):**
- `plan-mode.js` / `research-mode.js` — RESOLVED (P3a): office; their only creative import was a pure
  mapper, now relocated to kernel (`lib/sketch-derive.js`). `lib/reference` still open (leaning kernel).
- **`lib/outcomes`** — RESOLVED (P3b): OPS. The one creative bridge (`resolvers/sketch.js`) is now
  lazy+advisory; `outcomes/paths` relocated to kernel (`lib/outcomes-paths.js`); guard rebucketed
  CREATIVE→OPS. `lib/visual-language` also reclassified creative→kernel (pure theme-config vocabulary).
- `lib/agent-chat` / `lib/agent-ui` / `lib/agent-tasks` — host-adapter surface. Kernel-ish.
- `assembler.js` — the `create_assembler` TOOL (not registry glue); studio (imports the creative
  engine). Registration itself is `ensureToolsRegistered` in `server.js` — must become pack-partitioned
  for the physical split (P2b), not `assembler.js`.

## Mechanism — manifest-gated registration

1. **Install manifest** (env `MOJULO_PACKS=ops,creative` or a `mojulo.config` field) read once at
   boot. Default (dev / current npm install) = both = today's behavior, byte-identical.
2. **Registration reads the manifest.** `packs.js` already tags `wing`; add an `installed(pack)`
   gate keyed on `wing ∈ manifest`. A pack whose wing is absent never registers its member tools —
   its schemas never enter `tools/list`. `assembler.js` moves from static `import` of pack tool
   modules to a registry keyed by pack, so an absent pack's modules are never imported (and their
   deps never `require`'d — the point of *install* gating, not just *presentation* gating).
3. **Static list per install.** Because presence is fixed at start, each install emits one stable
   `tools/list`; no `list_changed`, sidestepping the host gap that parked `tool-packs.plan.md`.
4. **Router honesty.** `forward_context` routing rows for an absent pack render as advisory
   ("creative pack not installed — `mojulo install creative` to enable") rather than dead entries.

## Composition across the pack boundary

The moat (games compose over media; bots wear worlds) must survive a partial install **as data
composition, never code coupling**:
- a pack produces an artifact into the **kernel store**, addressed by ref;
- the other pack reads that **ref through a kernel interface**, never importing the producer;
- producer pack absent → dangling ref → **advisory degrade** ("install creative to bake this
  world"), the same graceful-gap posture used everywhere else — never a silent failure or a refusal.

This is exactly why operator-world had to go as a *direct import* and would only ever return as a
kernel-ref bridge.

## The office↔creative seam — full map + the model/render principle (P3 exploration, 2026-08-20)

Exploring the seam before committing to fixes, the ENTIRE office→creative code surface (after P3a)
turned out to be tiny and to share one shape:

| edge | kind | fix |
|---|---|---|
| `plan-mode`/`research-mode` → `sketch-derive` | pure mapper mis-filed in `lib/graph` | ✅ relocated to kernel (P3a) |
| `research-sweep` → `mechanics-view` (`sampleMechanicsPhysics`) | pure physics **model**, co-located in a render file | lazy the import (P3b) |
| `outcomes/resolvers/sketch.js` → graph renderers | **true render consumption** (embeds a rendered SVG) | lazy + advisory (P3b) |
| `game-audit` (creative) → `outcomes/paths` | pure path helper pulled by creative | → kernel (P3b) |

**Principle: the install boundary is RENDER, not "creative."** The creative engine conflates two
things — **models** (pure, deterministic, dependency-light: `physics/flight.js`, `sketch-derive`,
`sampleMechanicsPhysics`, `motion-vocabulary` MECHANICS_RULES — all render-free) and **renders** (the
heavy stack: `scene`/`polygonizer`/`worlds`/`views`/`beats`, three.js/WebGL/SVG/AO/GI). Every apparent
office→creative edge is really office→**model**; the one true exception is `outcomes/resolvers/sketch.js`,
which needs an actual rendered artifact. So the wings are ~perfectly separable — the "entanglement"
was 3 files, mostly pure models shelved in the render wing.

**Decision (2026-08-20): lean PRAGMATIC (P), model/render seam (M) as north star.** Handle the ~3
real bridges case-by-case with the principle as the tiebreaker (relocate a pure model to kernel; lazy
a true render), rather than doing an upfront scattered-model extraction. `lib/outcomes` is **office**
(17/18 files render-free). See P3b in Rollout.

**Refined decision (2026-08-20): the split is exactly TWO packs — Ops | Creative — and creative is
UNDIVIDED (sim + render stay one concern).** A sim/render *install* split (a headless `Kernel+Sim`
node) was explored and rejected: sim and render belong together as "the making substrate," and the
only invariant that matters is that **Ops is clean of the ENTIRE creative concern — both mechanism/
simulation (physics, `machina`, beats synth, game rules) AND render.** The model/render seam survives
only as a *code-organization lens* (it justifies relocating a genuinely pure, shared model to the
kernel — `sketch-derive`, `visual-language` — when doing so removes an ops↔creative edge), never as a
pack boundary. Enforced comprehensively by pack-boundary Check D (below). Ops is verified sim-free +
render-free today.

## Enforcement — pack-boundary guard (`lib/mcp/pack-boundary.test.js`)

A static-import scan, run in CI as a vitest test, so the orthogonality can't rot. Four checks (all
green; each negative-tested to confirm it bites):
- **A** — creative-engine (`lib/graph`/`lib/motion`/`lib/preview`) and ops-engine (`lib/deployers`/
  `builder`/`composer`/`fleet`/`fleet-scene`/`connected-services`/`triggers`/`apps`/`app-mcp-scaffold`/
  `runtime-adapters`/`form-schema-config`/`outcomes`) never import each other.
- **B** — no single file imports both engines (the operator-world guard).
- **C** — the named office deliberation surfaces (`plan-mode`/`research-mode`/`research-sweep`) stay off
  the creative engine (robust hardcode, independent of name-parsing).
- **D** — the general form: **no office tool file statically imports the creative engine (sim OR
  render)**. Wing resolved from `packs.js` membership. This is the invariant "Ops is clean of the whole
  creative concern," enforced comprehensively. Any creative touch an office capability needs rides a
  lazy `import()` + advisory, which the static scan (correctly) doesn't see.
Note: `lib/visual-language` (pure theme-config) and `lib/sketch-derive` / `lib/outcomes-paths` (pure
helpers relocated in P3a/P3b) are kernel — imported freely by both wings.

## Rollout

- **P1** (DONE) Guard landed as `lib/mcp/pack-boundary.test.js` — Check A (no creative↔ops edges) +
  Check B (no single file imports both engines; the operator-world guard). Green today; negative-tested
  (a probe creative→ops import correctly fails it). The three kernel leaks are absorbed by
  classification: `llm-providers` (no lib deps), `embedder` (→ `module-dir` only), and `deployment-auth`
  (no lib deps — API-key crypto used by the polygonizer) are all kernel-clean and already live at
  `lib/` top level (kernel territory), so `lib/graph`'s only non-creative out-edges are now `lib/db`,
  `lib/mcp`, and those three kernel helpers. No file moves needed at this phase.
- **P2** (DONE) Install manifest + gate. `packs.js` gained the pure-data install axis —
  `installedWings` / `isPackInstalled` / `installedPacks` / `isToolInstalled` / `installNotice`, read
  from `MOJULO_PACKS` (comma list of `ops`/`creative`); unset or unrecognized ⇒ full install (fail
  open, byte-identical to today). `server.js` gates both `listTools` branches (packs-mode uses
  `installedPacks`; flat-mode filters `isToolInstalled`) and both invoke chokepoints (`handleToolCall`
  RPC + `invokeRegisteredTool` plan-executor) with the advisory `installNotice` — an uninstalled
  pack's tools neither list nor run. SPINE / FOLDED / unpacked tools are kernel, always on. Covered by
  new tests in `packs.test.js` (unit + server-wiring E2E under `MOJULO_PACKS=ops`); full suite green
  (460 files / 6560 tests), proving the default is unchanged.
- **P2b** (deferred) Physical import-skipping: today registration is still eager (`ensureToolsRegistered`
  imports every tool module, so an ops-only install still *loads* creative code + deps — the gate hides
  and refuses them but doesn't save the footprint). Make registration pack-partitioned so an absent
  pack's modules are never imported. Larger, riskier refactor of `ensureToolsRegistered`; needs the
  pack→module map and lazy/dynamic import. The gate landed in P2 makes this a pure optimization, not a
  correctness change. Also handle the pack-dispatcher force-call edge (an uninstalled pack's dispatcher
  called by name) if it survives P2b.
- **P3a** (DONE) Deliberation surfaces decoupled. A tool-handler-layer audit found the office
  deliberation tools' only creative-engine import was `sketch-derive` — a PURE, zero-dependency
  plan/research→sketch-manifest mapper that merely *lived* under `lib/graph/sketch/`. Relocated it to
  its real home, `lib/sketch-derive.js` (kernel), and rewrote its 4 importers. `plan-mode.js` and
  `research-mode.js` now have zero creative-engine imports (an ops-only install can load them; the
  sketch *render* stays a creative route, unaffected). Locked in by pack-boundary Check C. Full suite
  green (460 / 6565). `mintSketch` comes from the tools layer, not the creative engine — not a
  boundary edge (its own transitive deps are a P2b module-partition concern).
- **P3b** (DONE) The office wing is now statically render-free — the two real bridges load creative
  lazily, and the decision from the P3 exploration ("`lib/outcomes` → office") is realized + enforced:
  1. `research-sweep.js` — `mintMechanicsView` + the physics sampler now load via a lazy `loadMechanics()`
     (dynamic `import()`), advisory-degrading when creative is absent. No static creative import.
  2. `lib/outcomes/resolvers/sketch.js` — the one true render bridge; the 4 sketch/image renderers now
     load via a lazy `loadRenderers()` with an advisory. The 17 report-kind writers were already
     render-free.
  3. `lib/outcomes/paths.js` (pure helper used by BOTH wings) relocated to the kernel as
     `lib/outcomes-paths.js`; all ~27 importers (src + tests, incl. relative `../paths.js` in the kind
     writers) rewritten.
  4. Guard rebucketed: `lib/outcomes/` moved CREATIVE→OPS; `research-sweep.js` added to Check C. A
     sub-finding fell out of the model/render principle: `lib/visual-language` is a single zero-import
     pure-config module (presentation-theme presets, shared by cook/figure/motion) — reclassified from
     creative to **kernel** (it's vocabulary, not render), which cleared cook.js's straddle correctly.
  Full suite green (460 / 6565); pack-boundary Checks A/B/C all green with the new buckets.
- **P4** Package: two install targets (`ops`, `creative`) over the kernel; wire the CLI
  (`mojulo install <pack>`); nest the worker bicycles under creative. Advisory router copy for absent
  packs.
- **P5** Docs: fold into CLAUDE.md "Repo shape" + a `docs/install-capabilities.md`; note that the
  bot image is unaffected (it is already bot-agnostic and pack-agnostic — a deploy target, not an
  install of the workshop).

## Open questions / risks

- **Shared tool files.** A few `lib/mcp/tools/*` files may reference both packs' *concepts* even
  without both imports (e.g. `forward_context` routing, `create-game` composing media). Confirm none
  hard-`require` an absent pack at module top-level; lazy-import at call time where they do.
- **DB schema is kernel, but pack tables live in it.** `beats_*`, `image_render_requests`, deploy
  tables all sit in the one kernel DB. Acceptable (schema is kernel), but a creative-only install
  carries ops table DDL it never writes. Decide: unified schema (simplest) vs. per-pack migrations.
- **The 6 ops tool files** (`build.js`, `fleet.js`, `jobs-tools.js`, `mcp-trigger-binding.js`,
  `operate.js`) are the ops tool surface — verify they register only under the ops pack.
- **Grain creep.** Resist splitting into >2 install packs; fine grain is the *presentation* axis's
  job (`packs.js`), already solved.
