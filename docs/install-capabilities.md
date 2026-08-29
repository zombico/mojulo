# Install capabilities — kernel + always-on packs + two install groups (creative / chatbot)

Mojulo is a **kernel** plus **always-present packs** plus **two install-gated groups**. This doc is the
source of truth for that shape: what's always present, what's optional, how mojulo knows which it is, and
how an operator grows a lean install into the full workshop. The build log, rationale, and audit evidence
live in [control/lib/mcp/install-capabilities.plan.md](../control/lib/mcp/install-capabilities.plan.md);
this is the orientation layer.

## The shape in one paragraph

There is a small, always-present **kernel** — "what mojulo *is*" — surrounded by packs. A pack declares an
`installGroup` and is gatable, or declares none and is unconditional like the kernel. Two groups exist:
**creative** (the render / media / games stack — the flagship default) and **chatbot** (the bot factory).
Everything else — connected services, catalysts, triggers, apps/daemons, plan, research, stash — declares
no group and is always present. The kernel alone can already mint a diagram.

> **Install is PACK-grain, not wing-grain (2.0).** Until 2.0 a pack's install state was a function of its
> `wing`, which tied the whole office wing's fate to the chatbot factory's. `wing` is now the
> taxonomy/routing field only; install is orthogonal. See
> `lite-template/integration/_0828/mojulo-2.0-pure-creative.plan.md` (Phase 1a).

## What lives where

**Kernel (always present).** The MCP server + tool registry + transport, the SQLite + graph store, the
event/daemon supervisor, the CLI front door (`scripts/mcp-stdio.mjs`), RAG / `semantic_search` (the
text-embedding model), and a **diagram maker** (see the stub below). This is the floor every install
carries — roughly ~340 MB, dominated by the embedder runtime + model.

**Always-present packs (no `installGroup`).** The orchestration plumbing: connected-service workflows
over the operator's other MCPs, catalysts, triggers, local apps/daemons, plan, research, stash. Pure code
with no heavy optional deps to shed, so it ships in every install and is never gated.

**Chatbot group.** The bot factory: chatbots built, deployed, and operated as their own processes. Pure
code today, so like the plumbing it ships in every install and is only ever off via an explicit
`MOJULO_PACKS` override — but unlike the plumbing it is *gatable*, and it becomes a real install when it
ships as `@mojulo/chatbot`.

**Creative group.** The heavy making stack: walkable 3D worlds, synthesized music (beats),
image/illustration recipes, voice, and games composed from the rest. This is the large, optional part —
~82 MB of npm libraries (`three`, `node-web-audio-api`, `opentype.js`) plus a ~535 MB headless Chromium
used only for render bakes.

## Install state is PHYSICAL, not a flag

Mojulo derives what it is from **what's actually on disk**, so `npm install --omit=optional` self-
describes and an env flag can never silently disagree with reality. In
[control/lib/mcp/packs.js](../control/lib/mcp/packs.js):

- Each group declares an install signal as data (`INSTALL_GROUPS`): `chatbot` is `alwaysInstalled` (pure
  in-tree code); `creative` has a `markerModule: 'three'` — installed iff that dep resolves on disk.
- Each pack declares its `installGroup`, or none. **A pack with no group is always installed**, so the
  plumbing and the kernel share one rule.
- `installedGroups()` folds over that with a memoized, import-free probe (`process.getBuiltinModule`
  keeps the module dependency-free).
- `MOJULO_PACKS` (comma list of `creative` / `chatbot`) is an explicit **override** on top — for dev/test,
  or to gate a present group's tools off. `ops` is accepted as a deprecated alias for `chatbot` so an
  existing config keeps its bots; note it now grants strictly less than it used to, since the plumbing it
  also covered is unconditional. A typo/unknown value falls through to physical detection, never an empty
  workshop.
- **Adding a future install group is one `INSTALL_GROUPS` entry plus an `installGroup` on the packs that
  join it** — it never touches the fold, the gates, or any caller. When the bot factory ships as
  `@mojulo/chatbot`, its entry becomes `{ markerModule: '@mojulo/chatbot' }` and nothing else changes.

## Growing an install

- **Lean, no creative:** `npm install --omit=optional` (sheds the ~82 MB creative deps; Chromium is never
  fetched — the fetch is gated on the creative group in
  [control/lib/graph/scene/chromium.js](../control/lib/graph/scene/chromium.js)).
- **Add the studio:** `mojulo install creative` ([control/scripts/mcp-install.mjs](../control/scripts/mcp-install.mjs))
  runs `npm install --include=optional` and re-probes. `mojulo install` with no arg prints status;
  `chatbot` is in-tree code and reports "nothing to install."
- **Full workshop:** a plain `npm install` gets everything (the creative deps are `optionalDependencies`,
  installed by default).

`sharp` is NOT shed — it arrives transitively via the kernel embedder (`@huggingface/transformers`), so
it's always present.

## The iron wall — execution integrity, not information hiding

The boundary is about EXECUTION, not knowledge. An uninstalled pack's tools neither list nor run; a
refusal is a group-level, terminal advisory that points at `mojulo install creative` and tells the model
to stop retrying (no spinning). Shared context is fine — the model may know the other group exists and
recommend installing it. Gated by `installNotice` / `packInstallNotice` in `packs.js` and enforced at
every tool-execution chokepoint (`handleToolCall`, `invokeRegisteredTool`, the pack dispatcher). The
build tolerates the creative deps being absent via a request-string `externals` matcher in
[control/next.config.mjs](../control/next.config.mjs) (so `next build` never fails on a missing external).

The orthogonality is kept honest by the static-import guard
[control/lib/mcp/pack-boundary.test.js](../control/lib/mcp/pack-boundary.test.js). Checks A–E: the two
engines never import each other, no office tool imports the creative engine, and the kernel diagram
surface imports nothing under `lib/graph`. Checks F–H are the 2.0 carve fence — nothing outside the
chatbot factory imports the factory engine (F), and two shrink-only ledgers freeze the dashboard routes
(G) and the retained code still reading bot tables (H) so that coupling can only decrease.

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
of the workshop, and carries none of this. It is also *separately versioned* (tagged `bot-v*`, released on
its own cadence), so it shares no version number with the workshop and cannot be broken by a workshop
major bump. See [docs/BOT-ARCHITECTURE.md](BOT-ARCHITECTURE.md).
