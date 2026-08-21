# Kernel diagram surface — extract the diagram core to kernel, BIND both wings to it

Status: PROPOSED (2026-08-21, revised). A scoped sub-finding of
[install-capabilities.plan.md](install-capabilities.plan.md) — the last *capability* piece of the
install split (Job 2). Supersedes the earlier "three incremental moves" draft: the same end (a kernel
that can MINT a diagram) reached by **extract-and-bind** instead of copy-or-invert.

**Parallel track:** a 2026-08-21 visual review of the isolated surface found the standard *diagram
patterns* it's missing (sequence / swimlane / ERD-UML / containment / Gantt + edge notation) — spiked
independently in [diagram-patterns-spike.plan.md](diagram-patterns-spike.plan.md). That work only
extends the diagram vocab/renderer; it does not touch the install split.

## The claim under test

"**Kernel mojulo is a diagram/flowchart/chart maker.**" An install with the creative pack *absent* can
still take a flowchart/data-chart manifest and return an SVG + a persisted `/sketches/<ref>` — because
box-and-arrow diagrams and the dataviz vocabulary are dependency-light SVG, not the heavy `lib/graph`
render stack.

## The decision: extract-and-bind (not copy, not invert)

Three options were weighed:
- **Copy the diagram slice into a kernel tool** — cheap, but two implementations DRIFT ("we forget").
- **Full registry inversion** (kernel owns `create_sketch`, creative plugs heavy kinds into a
  kind→handler registry) — cleanest topology, but real surgery on the 2026-line mega-tool's dispatch,
  and the maintainer judged it not worth the effort right now.
- **✅ Extract-and-bind (chosen)** — lift the diagram core into ONE kernel module that BOTH the new
  kernel mint tool AND the creative mega-tool import. No copy ⇒ nothing to keep in sync ⇒ drift is
  impossible by construction. A binding test makes divergence un-mergeable. Cheaper than the inversion
  (the heavy-kind dispatch is untouched — creative keeps world/beats/voice exactly as-is), cleaner than
  a copy (single source of truth), and `sharp`-free / guard-green (the core is light).

**`sharp` is a non-factor and never enters this work.** It is already a KERNEL dep (transitive via
`@huggingface/transformers`, the embedder), physically present in every install, never shed. The
diagram core touches neither `sharp` nor any `lib/graph` render module. `sharp` lives only in the
creative mega-tool's *other* modes (cover/keyframe compositing), which this plan does not move.

## Evidence (audit 2026-08-20/21)

- **The diagram render path is already kernel + light.** `lib/sketch-svg.js` (renders `CreationMap`)
  reaches ZERO heavy deps; `CreationMap` imports only `@/lib/signage-chrome` (kernel). Move 0 (renderer
  is kernel-clean) is CONFIRMED.
- **The diagram vocab/validator is light and cleanly separable.** `validateSketchManifest`
  (`sketch-manifest.js:609`) is already a kind-dispatch:
  1. `isImageOutcomesKind` → `normalizeImageOutcomesManifest` → return  ← the ONE heavy-bucketed edge
     (`../image-outcomes/manifest.js`), exits BEFORE the diagram path;
  2. `floorplan`/`restaurant` → light seed check → return (world kinds, also exits first);
  3. **default branch = pure diagram/chart** (title + `viewBox` + `grid` + `geo` + `signage` +
     `stations` + `marks` + `edges`, L641–699), using only the light validators.
  The whole module reaches NO heavy dep (`three`/`sharp`/`opentype`/audio/puppeteer). It is "creative"
  only by DIRECTORY bucketing (`lib/graph/`), not by dependency — same situation `visual-language` was
  in before it was reclassified kernel (P3b).
- **The diagram slice is a self-contained cluster.** Constants `MARK_KINDS` / `STATION_KINDS` /
  `EDGE_VIA_VALUES` / `PULSE_DIRS` / `SIGNAGE_*`; validators `validateMark` / `validateStation` /
  `validateEdge` / `validateSignage*` / `validatePulse` / `validateGeo` / `validateGrid` /
  `validateMarkStyle` / `validateBoxPosition` / `validateOptional*` / `isFiniteNumber` / `hasCell`; the
  default-branch logic; and `expandGridLayout` / `resolveCell`. None reference the heavy kind lists
  (`WORLD_RENDER_KINDS` etc., which live further down and feed `sketchRenderMode`/`classifyBucket`).

## The architecture

**One kernel module owns the diagram core; both wings bind to it.**

`lib/diagram-core.js` (kernel, top-level `lib/` ⇒ kernel by the guard's bucketing):
- the diagram-mark vocabulary + all the light validators listed above;
- `validateDiagramManifest(manifest)` — exactly the default-branch logic (title/viewBox/grid/geo/
  signage/stations/marks/edges);
- `expandGridLayout(manifest)` (grid → concrete coords, run before validate+store);
- `mintDiagram(manifest, opts)` — `expandGridLayout` → `validateDiagramManifest` → `SketchRepository.create`.
  Imports ONLY kernel: `@/lib/db/repositories/sketches`, `@/lib/outcomes-paths`. No `sharp`, no `lib/graph`.

The binding (nothing duplicated):
- **`sketch-manifest.js` delegates.** Its `validateSketchManifest` keeps the kind DISPATCH (image-
  outcomes early-return, floorplan/restaurant, then the default) but the default branch now CALLS
  `validateDiagramManifest` from `diagram-core`; the mark/station/… validators + `expandGridLayout`
  re-export from the core. So the creative mega-tool's diagram path (which already routes through
  `validateSketchManifest` + `expandGridLayout`) physically executes the kernel code — **bound
  automatically, with almost no change to `sketches.js` itself.**
- **Kernel mint tool.** A small SPINE/kernel `create_sketch` (diagram kinds only) — or `mint_diagram` —
  calls `diagram-core.mintDiagram`. Rendering on read is the existing kernel `/api/sketches/[ref]/svg`
  path (`sketch-svg`). The creative mega-tool stays registered for every heavy kind.

Dependency direction: `diagram-core` (kernel) ← `sketch-manifest` (creative) and ← kernel mint tool.
**Kernel never imports creative.**

## Anti-drift enforcement (the "so we don't forget")

1. **Binding test** — a shared fixture set of diagram/chart manifests, run through BOTH the kernel mint
   tool and the creative `create_sketch`, asserting **byte-identical persisted manifest + identical
   SVG**. Forking the logic turns CI red. Same posture as the codebase's other byte-identical
   invariants (muted beats capture, seeded worlds).
2. **Structural guard** (extend `pack-boundary.test.js`, "Check E") — assert NO diagram-mark validator
   / `validateDiagramManifest` implementation exists outside `lib/diagram-core.js`, and that the kernel
   mint tool + `sketch-svg` + `diagram-core` statically import nothing under `lib/graph/`/`lib/motion/`/
   `lib/preview/`. Negative-tested (a probe import must fail it). A second implementation can't merge.

## Moves (revised — extract-and-bind)

1. **✅ DONE (2026-08-21) — Extract `diagram-core.js` to kernel.** Moved the diagram cluster (constants
   + light validators + `validateDiagramManifest` + `expandGridLayout` + `resolveCell`) verbatim out of
   `sketch-manifest.js` into `lib/diagram-core.js` (728 lines, **zero imports** — pure kernel, no
   `lib/graph`/`sharp`). `sketch-manifest.js` (963→277 lines) now imports `isFiniteNumber` +
   `validateDiagramManifest` from the core, re-exports the diagram surface (so every importer is
   unchanged), and its `validateSketchManifest` keeps the kind DISPATCH (image-outcomes early-return →
   floorplan/restaurant → default `validateDiagramManifest`). **Verified byte-identical: full suite
   461 files / 6573 tests green.** The image-outcomes edge stayed in `sketch-manifest` (creative); the
   creative `create_sketch` diagram path is now BOUND to the kernel core (delegates through
   `validateSketchManifest`).
2. **✅ DONE (2026-08-21) — Kernel mint tool.** `lib/mcp/tools/diagram.js` registers `mint_diagram` —
   a SPINE (always-on) tool that mirrors `create_sketch`'s core diagram pipeline
   (`expandGridLayout → validateDiagramManifest → SketchRepository.create`) and returns `{ ok, ref, url }`.
   Imports only kernel (pure `diagram-core` + the sketch store). It refuses the creative-composition
   fields (`recipe` / `polygonizer`) with an advisory, and non-diagram manifests fail
   `validateDiagramManifest` by shape. Wired: `mint_diagram` → `SPINE` (packs.js), `registerDiagramTools()`
   in `ensureToolsRegistered` (server.js), `TOOL_INDEX` entry + a <700-char description (context.js).
   `create_sketch` stays the creative superset in `pack_diagram`; both delegate diagram validation to
   `diagram-core`. Distinct name (not a second `create_sketch`) avoids the registration collision.
3. **✅ DONE (2026-08-21) — Bind + guard.** `lib/diagram-core.binding.test.js` mints the same fixtures
   through BOTH `mint_diagram` and `create_sketch` and asserts **identical rendered SVG** (the user-visible
   invariant) for flowchart / chart / gridded, plus **byte-identical stored manifest** for the
   stations-only ones, plus the refusal/rejection cases. `pack-boundary.test.js` **Check E** asserts the
   kernel diagram surface (`diagram-core` + `diagram.js` + `sketch-svg`) statically imports nothing under
   the creative engine. Full suite green (the only 2 red are pre-existing slow render/game tests that
   pass in isolation — unrelated).

**Move 2b (deferred) — full chart parity.** The binding test surfaced that marks-based charts run through
`expandNeoRembrandt` (the "Rendrant" mark→spatial-plan expander) in `create_sketch`. For SIMPLE dataviz
marks (bars/donut/KPI = rect/wedge/text) the annotation is INERT — the rendered SVG is identical, so
`mint_diagram` mints a leaner-but-equivalent chart. COMPOSITE/layout marks (`mandalaArrangement`,
`horizontalStack`, `array`, `partition`, …) genuinely need that expander. `neo-rembrandt` is LIGHT (no
heavy dep) but a multi-file subdir; bringing it into the kernel path (relocate, or accept one light
`lib/graph` edge) is the follow-up for composite-mark chart parity. Flowcharts + simple charts work now.

Scope: **mint first** (create + render-on-read + persist). `update_sketch` / `diff_sketches` diagram
paths can bind to `diagram-core` in a follow-up so a no-creative install can also EDIT diagrams — same
mechanism, second PR. Not required for the claim.

## Done-criteria

1. With creative absent (`MOJULO_PACKS=ops` OR the deps physically omitted), the kernel `create_sketch`
   takes a flowchart manifest AND a data-chart manifest, each returning SVG + a persisted
   `/sketches/<ref>` — no `lib/graph` / no `sharp` loaded on that path.
2. Binding test green: kernel mint and creative `create_sketch` are byte-identical for the shared diagram
   fixtures.
3. Check E green: the kernel diagram surface (`diagram-core` + mint tool + `sketch-svg`) imports zero
   `lib/graph`; no second diagram validator exists.
4. Full suite green; pack-boundary A–D (+E) green.
5. Byte-identical default: a full install renders + mints every sketch kind exactly as before.

## Scope guards

- **PNG bake stays creative** (`sketch-png.js` → `sharp`/`scene-png`). Floor-1 ships SVG.
- **Illustration + world/beats/voice kinds stay creative** — this plan does NOT invert the heavy-kind
  dispatch; the creative mega-tool keeps them inline. Only the DIAGRAM core is lifted + bound.
- **`sharp` is untouched.** It is kernel-and-always-present and lives only in the mega-tool's non-diagram
  modes; `diagram-core` never imports it.
