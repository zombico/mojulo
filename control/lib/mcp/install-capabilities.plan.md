# Install capabilities — kernel + two install-gated packs (ops / creative)

---

## HANDOFF — start here (fresh agent, 2026-08-20)

**The goal in one line.** Carve mojulo into a KERNEL + two install packs (**ops** | **creative**),
gated by `MOJULO_PACKS`. The end state is an **iron wall**: an ops install (bots/services/apps) never
*downloads* the creative render stack, and the model can never *run* — or *spin on* — a creative tool
it doesn't have. Iron = EXECUTION integrity, NOT information hiding (shared context is fine;
recommending "install creative" is fine; never hide the other wing).

**Repo state.** Branch `installer-split`. HEAD `7f90ef2` ("install packs P2b: ops install sheds creative
deps + skips Chromium") holds Step 0 + P1 + P2 + P3a + P3b + P3c-1/2 + iron-wall dispatcher + all of P2b
"don't download" (externals-by-name matcher, lazy opentype, `optionalDependencies`, Chromium-fetch gate).
**Uncommitted delta — "make the split real" (physical install detection + CLI):** `lib/mcp/packs.js`
(per-wing `WING_INSTALL` signals + `installedWings` physical probe + advisory copy), `lib/mcp/packs.test.js`
(4 detection tests), `scripts/mcp-install.mjs` (new — `mojulo install creative`), `scripts/mcp-stdio.mjs`
(install branch), this doc, and `kernel-diagram-surface.plan.md` (untracked — the Job-2 briefing). Packs +
pack-boundary suites green (47 tests).

**DONE and how it behaves today:**
- **Kernel + two-pack boundary**, enforced by a static-import guard `lib/mcp/pack-boundary.test.js`
  (Checks A–D). Ops is provably clean of the whole creative concern (sim + render).
- **Install gate (P2)** — `packs.js` install axis (`installedWings` / `isPackInstalled` /
  `installedPacks` / `isToolInstalled` / `installNotice` / `packInstallNotice`), read from
  `MOJULO_PACKS` (`ops` / `creative` / `ops,creative`); **unset or unknown ⇒ full install, byte-
  identical to before**. `server.js` gates `tools/list` (both modes) and every tool-execution path:
  `handleToolCall` (RPC), `invokeRegisteredTool` (plan-executor), and the **pack dispatcher**
  (`packs-tools.js` `dispatch()` — the iron-wall fix this batch). Uninstalled tools neither list nor
  run; refusal is a wing-level, terminal advisory ("…not installed … Do not retry …").
- **Diagram RENDERER is kernel** (P3c-1/2) — a bare no-packs mojulo can *render* a diagram. Chain
  `lib/sketch-svg → components/graph/CreationMap → lib/signage-chrome → lib/color`, provably
  `lib/graph`-free (`lib/sketch-svg.nopacks.test.js`).

**LEFT — P2b, the last phase (full spec below in "## P2b").** A second build spike (2026-08-20)
DISSOLVED most of the phase — the feared "Part 1 funnel refactor + opaque-import + standalone-tracing
crux" is CANCELLED. The webpack-compile layer is fixed CONFIG-ONLY by an **externals-by-request-string**
matcher in `next.config.mjs` (externalizes the 5 creative-only deps by name without resolving disk;
`serverExternalPackages` failed because it *resolves* to decide, and a missing pkg falls back to
bundling → "Module not found"). Landed + proven non-regressive (full build green with all deps present;
webpack-compile green with them absent). **DONE this batch (the "don't download" mechanism, spike-proven):**
- (a) ✅ externals-by-request-string matcher (`next.config.mjs`).
- (b) ✅ the "render-route page-data lazying" turned out to need only ONE leaf edit, not 11 route
  edits. The reachability analyzer (scratch `reach.mjs`) flagged 11 routes, but: `three` was a FALSE
  POSITIVE (its only `import * as THREE from 'three'` sites are inside template literals — browser-side
  `<script>` that `scene-three.js` EMITS as HTML; the server never imports three); `node-web-audio-api`
  was already lazy in `beats-render`; the real culprit reaching all 11 was ONE top-level
  `require('opentype.js')` in `lib/motion/glyph-carver.js`. Made it a lazy sync getter (require stays
  sync). The kernel MCP funnel needed nothing, as predicted.
- (c) ✅ packaging — `three`, `node-web-audio-api`, `opentype.js` → `optionalDependencies`. `sharp`
  STAYS (transitive via the kernel embedder; not even a direct dep). Default `npm install` gets all 3;
  `npm install --omit=optional` sheds them.

**LEFT (smaller now):**
- **`puppeteer-core` (14 MB) shedding DEFERRED** — real top-level `import puppeteer` in `scene-png.js`
  / `chromium.js` / `world-frames.js` (~6 launch sites); reached only by `png`/`play` routes. Needs the
  same lazy conversion; small win, so it stays in `dependencies` for now.
- ✅ **don't-fetch-Chromium in ops (DONE)** — `lib/graph/scene/chromium.js` `resolveChromium` now gates
  the ~500 MB Chrome-for-Testing fetch on the creative wing being installed (`installedWings().has('studio')`).
  Cheap detection (override / cached / system browser) still runs; only the heavy FETCH is skipped, with
  a creative-install advisory. Default full install byte-identical (verified: fetch allowed unless
  `MOJULO_PACKS=ops`). This is the single biggest disk win (~535 MB) and it never touched `package.json`.
- ✅ **"make the split real" — install state = PHYSICAL presence, per wing (DONE, 2026-08-21).** The
  packaging above made env and disk able to disagree (omit the deps but forget `MOJULO_PACKS=ops` ⇒
  mojulo LISTS creative tools it can't fulfill). Fixed by making physical presence the source of truth:
  - `packs.js` — each wing declares an install signal as DATA (`WING_INSTALL`: office `alwaysInstalled`;
    studio `markerModule:'three'`). `installedWings()` folds over it with a memoized, import-free probe
    (`process.getBuiltinModule('module')` → `require.resolve`), `MOJULO_PACKS` an explicit OVERRIDE on
    top; typo/unknown falls through to detection. **A NEW install wing adds ONE `WING_INSTALL` entry —
    it never touches the fold, the gates, or any caller** (the design that survives a 3rd pack). Test
    seam `_setWingPresence`; 4 new tests.
  - `mojulo install creative` CLI verb — `scripts/mcp-install.mjs` (spawns `npm install --include=optional`,
    re-probes; `ops` is pure code = nothing to install; status/unknown-pack paths), wired in
    `scripts/mcp-stdio.mjs` next to `init`.
  - Advisory copy (`installNotice`/`packInstallNotice`) now points at `mojulo install creative` for the
    physically-installable wing (setting `MOJULO_PACKS` alone would only LIST-then-fail), and at the flag
    for ops.
- **LEFT: diagram MINT tool (step 3A)** — the `kernel-diagram-surface.plan.md` moves (Move 0 confirmed:
  CreationMap is render-light). This is the last capability piece: a no-creative install that can still
  *mint* a flowchart/chart, not just render one.
Part 1 (pack-partition `ensureToolsRegistered`) is NOT needed for the build; optional runtime-load nicety only.

**Verify / run** (from `control/`):
- Full suite: `npx vitest run` — baseline **461 files / 6569 tests green**.
- Guard: `npx vitest run lib/mcp/pack-boundary.test.js` (Checks A–D, each negative-tested).
- Gate E2E: `npx vitest run lib/mcp/packs.test.js` (install axis + the iron-wall dispatcher test).
- No repo-wide lint/typecheck. `node --check <file>` for JS smoke checks. JSX parses with
  `@babel/parser` from the `control` package.
- **Test gotcha:** env-toggling tests MUST `await` INSIDE the `MOJULO_PACKS` window — a real process
  fixes the env at start, but the deep dispatch path reads it well past the first `await`, so a sync
  `try { return fn() } finally { restore }` restores too early and the gate reads the wrong value. See
  the async `withInstall` in `packs.test.js`.

**Locked decisions — do NOT relitigate:**
- Exactly **two** install packs: Ops | Creative. Creative is **undivided** (sim + render together). A
  sim/render install split (headless "Kernel+Sim") was explored and **rejected**.
- The wall is **execution integrity, not information hiding**. Never make orientation install-aware to
  *hide* the other wing (labeling install state to prevent doomed attempts is allowed but optional).
- **Diagrams are a KERNEL capability** ("just SVGs"); heavy 3D/scene/image render stays creative.
- Homes: `lib/outcomes` = **office**; kernel-relocated pure modules = `lib/sketch-derive`,
  `lib/outcomes-paths`, `lib/color`, `lib/signage-chrome`, `lib/sketch-svg`, and `lib/visual-language`
  (pure theme-config). `vexar` stays in creative (40 importers) — diagrams don't need it.
- **Fail-open** on unset/unknown `MOJULO_PACKS` (a typo never empties the workshop).

Below: the full rationale, the audit evidence, the P2b spec (incl. the packaging analysis), and the
per-phase log. A fresh agent can act from the HANDOFF + "## P2b" sections alone; the rest is context.

---

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

## The iron wall — execution integrity, NOT information hiding (2026-08-20)

Operator's framing correction: the wall is about EXECUTION, not knowledge. Shared context is fine —
the model may know the other wing exists, and recommending "install creative to do X" is fine. Two
things are NOT ok: (1) **running a job with a tool you don't have** (executing creative logic in an
ops install), and (2) **spinning in circles** (looping on an unavailable tool instead of a clean,
terminal "not here — do this instead"). So do NOT make orientation install-aware to hide the other
wing; instead make every EXECUTION path refuse cleanly.

- **Can't-run — every tool-execution chokepoint gates (airtight at the logical level).** Audited: the
  only paths that invoke a tool handler are `handleToolCall` (RPC), `invokeRegisteredTool` (plan
  executor) — both gated in P2 — and the **pack dispatcher** (`packs-tools.js` `dispatch()`), which
  was the one BREACH: it resolved a member and `instrumentedInvoke`d it with no install check, so
  `pack_world({tool:'compose_world'})` would actually mint a world in an ops install. Now gated with
  `packInstallNotice(pack)` (pack-level) + `installNotice(name)` (belt-and-suspenders for a shared
  cross-pack member). Triggers/scheduler, app sidecars, and agent-tasks do not invoke tool handlers
  directly (audited — no other path). Direct-dispatch tools (`create_view`, `compose_world` retired
  aliases) are safe: reached only after their own creative tool passed the entry gate.
- **No-spin — wing-level, terminal advisory.** `packInstallNotice` names the whole pack ("the creative
  capability pack is not installed … Do not retry … until installed"), so the model stops trying
  creative tools and pivots (recommend install / use the other wing) instead of looping tool-by-tool.
- **Physical backstop = P2b.** The logical gate is airtight but bypass-able in principle (it's a code
  check). P2b (uninstalled packs never registered / imported) makes "can't run what isn't there"
  unbypassable, and is also the "ops users don't download creative" half. Still the remaining phase.
- **Optional proactive no-spin:** `forward_context` MAY *label* install state ("studio: not installed —
  install to enable") so the model routes correctly without a doomed attempt. Allowed (it informs,
  doesn't hide) but not required — the terminal advisory already prevents spinning.

Regression test: `packs.test.js` "iron wall — dispatcher cannot RUN an uninstalled pack tool".

## P2b — physical "don't download / don't import" (the remaining phase)

P2 gates the LOGICAL surface (tools don't list, don't run). P2b makes it PHYSICAL: an ops install
neither imports creative code nor downloads its deps.

**Build spike RESULT (2026-08-20) — the plan's core packaging premise was WRONG; parts are NOT
independent.** Ran the faithful spike: added `three` to `serverExternalPackages`, physically removed
the 6 creative dep dirs (`three`, `puppeteer-core`, `@puppeteer/browsers`, `node-web-audio-api`,
`opentype.js`, `sharp`) from `node_modules`, ran `next build --webpack`. **It FAILED to compile** —
`Module not found: Can't resolve 'sharp'` / `'node-web-audio-api'`, etc. Critically, `sharp` and
`node-web-audio-api` were **already** in `serverExternalPackages` before this batch, so this is not a
missing-external problem: **`serverExternalPackages` does NOT make `next build` tolerate an absent
dep.** Webpack still *resolves* every static `import` edge reachable from a built entrypoint at compile
time; externalization only changes bundle-vs-`require()` for edges that resolve. The failing import
traces prove the two entrypoints that statically reach creative deps:
- `app/api/mcp/route.js` → `lib/mcp/server.js` → `ensureToolsRegistered` static-imports every tool
  module (`render-handoff`→keyframe-audit→sharp, `motion`→keyframe-composite→sharp, `sketches`→sharp);
- the creative render routes (`app/api/sketches/[ref]/cover.png|final.png|scene|world|png`,
  `app/api/beats/[ref]`) static-import the render stack directly.

**SECOND SPIKE (2026-08-20) — the webpack-resolve problem is fixed CONFIG-ONLY; the crux dissolved.**
Root cause of the first failure: `serverExternalPackages` *resolves* each package to decide whether to
externalize, so a MISSING package falls back to bundling → "Module not found." Fix: a webpack
`externals` matcher keyed on the **request string** (in `next.config.mjs`, server side only) that
externalizes the creative deps as `commonjs <name>` WITHOUT touching disk. Result with the 6 deps
absent: **webpack compile PASSES** (warnings only). Two further facts surfaced past the compile layer,
at Next's *page-data collection* (Next LOADS each route/page module at build to read its exports):
- **`sharp` is NOT creative-only.** It is a hard transitive import of `@huggingface/transformers`
  (`transformers.node.mjs`) — the KERNEL embedder. An ops install keeps the embedder, so **`sharp`
  stays.** Sheddable set drops to 5: `three`, `puppeteer-core`, `@puppeteer/browsers`,
  `node-web-audio-api`, `opentype.js`.
- **Page-data collection executes route module-load.** A route that TOP-LEVEL-imports a creative module
  whose chain reaches an absent dep throws at load (`Cannot find module 'opentype.js'` via
  `cover.png/route.js`). Fix = move that import INTO the handler (`await import()`): still externalized
  by the same matcher (not resolved at build), and NOT executed at page-data collection (handler isn't
  called). Bounded to the Class-A render routes. **The kernel MCP funnel needs NOTHING** — its creative
  imports are dynamic AND only run at request time inside `ensureToolsRegistered`, so page-data
  collection never trips them, and the externals matcher covers the compile.

**Consequence — Part 1 (pack-partition `ensureToolsRegistered`) is CANCELLED as a build requirement.**
The whole "opaque-import + standalone-tracing crux" is moot; externals-by-name sidesteps it. Part 1
survives only as an optional runtime-load optimization (don't even `import()` creative in an ops
process), not a correctness or packaging need. The config change is proven non-regressive: full build
with all deps present is green.

Sequencing now: **(1) render-route page-data lazying, (2) `package.json` optionalDependencies for the 5,
(3) re-run the deps-absent spike to confirm a full green build, (4) don't-fetch-Chromium + CLI.** The
externals matcher is already landed (`next.config.mjs`).

### Part 2 — packaging (the "don't download" half). Analysis (2026-08-20)

**Sheddable creative-only deps (verified 2026-08-20 — 5, NOT 6):** `three`, `puppeteer-core`,
`@puppeteer/browsers`, `node-web-audio-api`, `opentype.js`. **`sharp` is NOT sheddable** — hard
transitive dep of the kernel embedder (`@huggingface/transformers`); stays. **`image-size` is NOT
sheddable** — imported by `app/api/stashes/[ref]/items/route.js` (kernel-side); stays. Measured disk
win: ~96 MB of these 5 npm dirs + ~535 MB Chromium (already a separate lazy fetch, free to skip) ≈
~630 MB; the kernel floor an ops install always carries is the embedder runtime+model (~340 MB).

**Creative-only deps an ops install sheds** (verified: importers only in `lib/graph`/`lib/motion`):

| dep | importers | weight | build status |
|---|---|---|---|
| `puppeteer-core` + `@puppeteer/browsers` | 5 (render bakes: `scene-png`, `chromium`, `scene-png-warm`, `world-frames`, `auto-audit-runner`) | **huge — pulls Chromium** | already external ✓ |
| `three` | 1 (`lib/graph/scene/scene-three.js`) | ~few MB | **BUNDLED — the one gap** ✗ |
| `node-web-audio-api` | 1 (`lib/graph/beats/beats-render.js`) | native | already external ✓ |
| `opentype.js` | 1 (font render) | small | already external ✓ |

**Stays (ops can't shed):** `better-sqlite3` (kernel DB), `@huggingface/transformers` + `onnxruntime-node`
(the embedder — big, but RAG / `semantic_search` is kernel), `officeparser` / `pdf2json` (ops document
processing), `archiver` (ops zips), `react`. `sharp` / `image-size` — verify importers to decide.

**The steps (reordered after the spike — see the RESULT above):**
1. ✅ DONE (this batch) — `next.config.mjs`: add `'three'` to `serverExternalPackages`. Inert until
   steps below remove the static import edges.
2. **BLOCKED on Part 1 + route lazy-load.** Move creative-only deps → `optionalDependencies` in
   `package.json`. Default `npm install` gets everything (full workshop); ops uses
   `npm install --omit=optional`. Do NOT do this until a re-run of the spike is green, or `--omit=optional`
   ops installs fail to build.
3. The creative **HTTP render routes** must **lazy-load the render stack via `await import()` inside the
   handler** — a top-level `import` is a build edge that fails when the dep is absent (spike-proven).
   Routes: `app/api/sketches/[ref]/{scene,world,png,cover.png,final.png}`, `app/api/beats/[ref]`. In an
   ops install they're naturally cold (no world/scene/beats artifacts exist), so on a direct hit they
   should catch the failed dynamic import and return a clean advisory rather than a raw 500.
4. `mojulo install creative` CLI verb → `npm install` the optional deps on demand (mirrors the existing
   lazy `scripts/fetch-embed-model` philosophy — "no postinstall 113 MB download").
5. **Re-run the spike** (remove the 6 dep dirs, `next build --webpack`) — must be green before step 2 ships.

**Build spike — DONE (2026-08-20), result folded into the RESULT block above.** It failed as run
(static creative import edges reachable from `app/api/mcp/route.js` and the render routes), which is the
signal that reordered this phase. The spike method that works in-place without a fresh install: move the
6 creative dep dirs out of `node_modules`, `next build --webpack`, then move them back.

### Part 1 — pack-partition registration (the "don't import" half) — CANCELLED as a build requirement

**Superseded by the SECOND SPIKE (2026-08-20): the externals-by-name matcher makes the build tolerate
absent creative deps WITHOUT partitioning registration.** The kernel MCP funnel needs no surgery (its
imports are dynamic + request-time; page-data collection never runs them). Part 1 remains only as an
OPTIONAL runtime-load optimization (an ops *process* never even `import()`s creative), which is a nice-
to-have, not a correctness or packaging need. The analysis below is retained for that optional future.

**Correction (2026-08-20 spike) — this is NOT "eager static import," and the naive fix is
insufficient.** `ensureToolsRegistered` ALREADY uses `await import('@/lib/mcp/tools/…')` for every tool
module (all dynamic). The build still failed with those modules in the trace, because **webpack
resolves a dynamic `import()` whose specifier is a static string** — it compiles the async chunk and
its transitive `sharp`/`three`/`node-web-audio-api` deps at build time regardless of any runtime
`if (installed)` guard. So "make registration pack-aware by keying the dynamic import on
`installedWings`" does NOT remove the module from the build graph; it only skips it at runtime.

To actually exclude creative modules from an ops build's webpack graph, the import specifier must be
**opaque to webpack's static analysis**. The candidate mechanisms (undecided — pick during
implementation):
- **`import(/* webpackIgnore: true */ specifier)`** — leaves it a native runtime import webpack never
  bundles/resolves. BUT the tool modules are FIRST-PARTY (`lib/mcp/tools/*`), so `webpackIgnore` means
  they're not in `.next`; `output: 'standalone'` tracing wouldn't include them → breaks standalone.
  Viable only if the ignored import resolves to a real on-disk path at runtime (needs a resolved
  absolute path, not the `@/` alias) AND those files ship alongside standalone. Non-trivial.
- **A non-analyzable specifier** (variable/template webpack can't constant-fold) — same runtime-resolve
  caveat as above.
- **Two build entrypoints / conditional compilation** (e.g. a build-time flag that tree-shakes the
  creative registration list) — heaviest, but keeps first-party modules bundled when present.

**Open: the standalone-tracing interaction is the crux and is unresolved.** The next spike should test
ONE mechanism end-to-end (build + `output:'standalone'` trace + boot the standalone server with deps
absent) before committing. This is a genuine research task, not a mechanical refactor — the P2 runtime
gate already delivers correctness; P2b Part 1 is purely about build-graph exclusion and its cost is now
known to be higher than the plan assumed.

### Part 3 — diagram MINT tool → kernel/spine (step 3A, folds P3c here)

The diagram RENDERER is already kernel (P3c-1/2), but the MINT tool `create_sketch`
(`lib/mcp/tools/sketches.js`, **2026-line creative mega-tool**, ~20 static creative imports) is not.
For a no-packs mojulo to *make* a diagram: extract a minimal `mintDiagram` (diagram-kind validator —
the `viewBox`/`marks`/`stations` slice of `sketch-manifest.js` — + `SketchRepository.create`) into the
kernel, expose it as a small SPINE tool. Leave the mega-tool in `pack_diagram` (studio) for full multi-
kind sketching. Cost: two ways to make a diagram; benefit: the mega-tool never needs untangling. (The
rejected alternative was lazy-loading all ~20 heavy imports inside `create_sketch` — real surgery on
2026 lines.)

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
- **Iron-wall dispatcher gate** (DONE, uncommitted) — the pack dispatcher (`packs-tools.js`
  `dispatch()`) was the one execution path that ran a member with no install check; now gated
  (`packInstallNotice` + `installNotice`). Regression test in `packs.test.js`. Full suite green
  (461 / 6569). This closed the "pack-dispatcher force-call edge" noted earlier.
- **P2b** (the remaining phase) — physical "don't download / don't import." **Full spec: see the
  "## P2b" section above.** Three parts: (1) pack-partition `ensureToolsRegistered` (don't import
  creative in an ops install); (2) packaging — creative-only deps → `optionalDependencies` + `three` →
  `serverExternalPackages` (don't download); (3) diagram MINT tool → kernel/spine `mintDiagram` (step
  3A). Do the **build spike first**. Subsumes the old P4 (packaging + `mojulo install <pack>` CLI +
  advisory router copy).
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
- **P4** (subsumed into P2b Part 2) Packaging + `mojulo install <pack>` CLI + advisory router copy.
  Still open within it: nest the worker bicycles (Blender/ComfyUI/Kokoro) under the creative pack.
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
