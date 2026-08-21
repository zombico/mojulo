# Install capabilities — kernel + two install packs (ops / creative)

Mojulo is a **kernel** plus **two install-gated capability packs**. This doc is the source of truth for
that shape: what's always present, what's optional, how mojulo knows which it is, and how an operator
grows a lean install into the full workshop. The build log, rationale, and audit evidence live in
[control/lib/mcp/install-capabilities.plan.md](../control/lib/mcp/install-capabilities.plan.md); this is
the orientation layer.

## The shape in one paragraph

There is a small, always-present **kernel** — "what mojulo *is*" — and two bolt-on packs that map to the
two `wing` values already used across the tool registry: **ops** (`wing: 'office'`) and **creative**
(`wing: 'studio'`). "Full install" is not a third thing; it is the union (ops + creative). You can run
ops-only (lean), creative-only, or both. The kernel alone can already mint a diagram.

## What lives where

**Kernel (always present).** The MCP server + tool registry + transport, the SQLite + graph store, the
event/daemon supervisor, the CLI front door (`scripts/mcp-stdio.mjs`), RAG / `semantic_search` (the
text-embedding model), and a **diagram maker** (see the stub below). This is the floor every install
carries — roughly ~340 MB, dominated by the embedder runtime + model.

**Ops pack (`office`).** Deploy and run things: chatbots as their own processes, connected-service
workflows over the operator's other MCPs, and local apps. Pure code — it ships in every install and has
no heavy optional deps to shed.

**Creative pack (`studio`).** The heavy making stack: walkable 3D worlds, synthesized music (beats),
image/illustration recipes, voice, and games composed from the rest. This is the large, optional part —
~82 MB of npm libraries (`three`, `node-web-audio-api`, `opentype.js`) plus a ~535 MB headless Chromium
used only for render bakes.

## Install state is PHYSICAL, not a flag

Mojulo derives what it is from **what's actually on disk**, so `npm install --omit=optional` self-
describes and an env flag can never silently disagree with reality. In
[control/lib/mcp/packs.js](../control/lib/mcp/packs.js):

- Each wing declares an install signal as data (`WING_INSTALL`): `office` is `alwaysInstalled` (pure
  code); `studio` has a `markerModule: 'three'` — installed iff that dep resolves on disk.
- `installedWings()` folds over that with a memoized, import-free probe (`process.getBuiltinModule`
  keeps the module dependency-free).
- `MOJULO_PACKS` (comma list of `ops` / `creative`) is an explicit **override** on top — for dev/test,
  or to gate a present wing's tools off. A typo/unknown value falls through to physical detection, never
  an empty workshop.
- **Adding a future install wing is one `WING_INSTALL` entry** — it never touches the fold, the gates,
  or any caller.

## Growing an install

- **Ops-only, lean:** `npm install --omit=optional` (sheds the ~82 MB creative deps; Chromium is never
  fetched — the fetch is gated on the creative wing in
  [control/lib/graph/scene/chromium.js](../control/lib/graph/scene/chromium.js)).
- **Add the studio:** `mojulo install creative` ([control/scripts/mcp-install.mjs](../control/scripts/mcp-install.mjs))
  runs `npm install --include=optional` and re-probes. `mojulo install` with no arg prints status; `ops`
  is pure code and reports "nothing to install."
- **Full workshop:** a plain `npm install` gets everything (the creative deps are `optionalDependencies`,
  installed by default).

`sharp` is NOT shed — it arrives transitively via the kernel embedder (`@huggingface/transformers`), so
it's always present.

## The iron wall — execution integrity, not information hiding

The boundary is about EXECUTION, not knowledge. An uninstalled pack's tools neither list nor run; a
refusal is a wing-level, terminal advisory that points at `mojulo install creative` and tells the model
to stop retrying (no spinning). Shared context is fine — the model may know the other wing exists and
recommend installing it. Gated by `installNotice` / `packInstallNotice` in `packs.js` and enforced at
every tool-execution chokepoint (`handleToolCall`, `invokeRegisteredTool`, the pack dispatcher). The
build tolerates the creative deps being absent via a request-string `externals` matcher in
[control/next.config.mjs](../control/next.config.mjs) (so `next build` never fails on a missing external).

The orthogonality is kept honest by the static-import guard
[control/lib/mcp/pack-boundary.test.js](../control/lib/mcp/pack-boundary.test.js) (Checks A–E): the two
engines never import each other, no office tool imports the creative engine, and the kernel diagram
surface imports nothing under `lib/graph`.

## Diagram maker in the kernel

The kernel can *make*, not just render, a diagram: **`mint_diagram`** (a SPINE / always-on tool) mints a
diagram from a manifest and returns a `/sketches/<ref>` URL, using only the pure kernel
[control/lib/diagram-core.js](../control/lib/diagram-core.js) (validator + grid expansion) and the sketch
store. `create_sketch` (creative pack) is the superset — recipes, worlds, illustration — and both
delegate diagram validation to `diagram-core`, so they can't drift (enforced by
`control/lib/diagram-core.binding.test.js`).

**Coverage:** flowcharts (boxes + arrows) and common charts (stacked bar, donut/ring, KPI tiles, line)
render identically through both paths, plus the **standard diagram patterns** — sequence (lifelines,
activation bars, self-messages), swimlane lanes, ERD/UML entities, containment/C4 boundaries,
timeline/Gantt on a numeric scale, and richer edge notation (arrowhead styles, multiplicities,
self-loops). These are validated in [control/lib/diagram-core.js](../control/lib/diagram-core.js) and
covered by the `diagram-core.*` suites. Design history and the per-pattern rationale live in
[control/lib/mcp/diagram-patterns-spike.plan.md](../control/lib/mcp/diagram-patterns-spike.plan.md)
and [control/lib/mcp/kernel-diagram-surface.plan.md](../control/lib/mcp/kernel-diagram-surface.plan.md).

## The bot image is unaffected

Pack-splitting is about how the **workshop** is installed on the operator's host. The published bot image
(`ghcr.io/zombico/mojulo-bot`) is bot-agnostic AND pack-agnostic — it is a deploy target, not an install
of the workshop, and carries none of this. See [docs/BOT-ARCHITECTURE.md](BOT-ARCHITECTURE.md).
