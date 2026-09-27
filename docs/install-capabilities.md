# Install capabilities — kernel + always-on packs + three install groups (creative / recall / chatbot)

Mojulo is a **kernel** plus **always-present packs** plus **install groups**, two of them opt-in. This doc is the
source of truth for that shape: what's always present, what's optional, how mojulo knows which it is, and
how an operator grows a lean install into the full workshop. The build log, rationale, and audit evidence
live in install-capabilities.plan.md;
this is the orientation layer.

## The shape in one paragraph

There is a small, always-present **kernel** — "what mojulo *is*" — surrounded by packs. A pack declares an
`installGroup` and is gatable, or declares none and is unconditional like the kernel. Three groups exist:
**creative** (the render / media / games stack — the flagship default, always installed), **recall** (the
embedding runtime behind vector `semantic_search`; opt-in, no pack of its own) and **chatbot** (the bot
factory; opt-in).
Everything else — connected services, catalysts, triggers, apps/daemons, plan, research, stash — declares
no group and is always present. The kernel alone can already mint a diagram.

> **Install is PACK-grain, not wing-grain (2.0).** Until 2.0 a pack's install state was a function of its
> `wing`, which tied the whole office wing's fate to the chatbot factory's. `wing` is now the
> taxonomy/routing field only; install is orthogonal. See
> `mojulo-2.0-pure-creative.plan.md` (Phase 1a).

## What lives where

**Kernel (always present).** The MCP server + tool registry + transport, the SQLite + graph store, the
event/daemon supervisor, the CLI front door (`scripts/mcp-stdio.mjs`), `semantic_search` as a lexical
index (SQLite FTS5, inside `better-sqlite3`; the embedding model is the opt-in **recall** group), and a
**diagram maker** (see the stub below). This is the floor every install carries; its measured size is in
[tech-requirements.md](tech-requirements.md#package-size-and-disk-footprint).

**Always-present packs (no `installGroup`).** The orchestration plumbing: connected-service workflows
over the operator's other MCPs, catalysts, triggers, local apps/daemons, plan, research, stash. Pure code
with no heavy optional deps to shed, so it ships in every install and is never gated.

**Chatbot group — OPT-IN since 2.0.** The bot factory: chatbots built, deployed, and operated as their
own processes. **A fresh install does not have it.** `mojulo install chatbot` writes a marker file at
`$MOJULO_HOME/packs/chatbot`, which flips physical detection on; `mojulo install chatbot --remove`
deletes it. The code is still in-tree (the package split waits on the Phase 3 ABI), so this is a
LOGICAL gate — but from the operator's side it behaves exactly like the eventual `@mojulo/chatbot`
package: absent until asked for. Already-DEPLOYED bots are unaffected either way; they run as their own
processes and were never part of the workshop install.

**Creative group — always installed.** The making stack: walkable 3D worlds, synthesized music (beats),
image/illustration recipes, voice, and games composed from the rest. Its code ships in the package and its
tools list on every install; only an explicit `MOJULO_PACKS` override gates it off. What is heavy about it
is a set of helpers some of its calls load on first use: the `optionalDependencies` (`node-web-audio-api`,
`manifold-3d`, `openscad-wasm-prebuilt`, `opentype.js`, `sharp`; about 150 MB installed with what they
pull in), and a ~535 MB headless Chromium used only for render bakes. A call whose helper is missing says
so in-band; the rest of the pack works.

## Install state is PHYSICAL, not a flag

Mojulo derives what it is from **what's actually on disk**, so an install self-describes and an env flag
can never silently disagree with reality. In [control/lib/mcp/packs.js](../control/lib/mcp/packs.js):

- Each group declares an install signal as data (`INSTALL_GROUPS`): `creative` is `alwaysInstalled` (until
  2.2 it was keyed on the `three` package resolving, which no Node code imports, so an install without
  `three` hid the whole studio); `chatbot` has a
  `markerFile: 'packs/chatbot'` — installed iff that file exists under `$MOJULO_HOME`; `recall` has
  both — the runtime's own `package.json` under `$MOJULO_HOME/recall/node_modules/`, or the module
  resolving from the package (repo-dev, installed by hand).
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

- **Lean:** `npm install --omit=optional` sheds the optional helpers (about 150 MB). The creative tools
  still list and run; the calls that need a missing helper fail in-band naming it. `sharp` loads on
  first use ([control/lib/sharp-lazy.js](../control/lib/sharp-lazy.js)), so `mojulo call version`, every
  mint and every export run, and only the raster tools (skins, sprite sheets, the PNG bake, the
  keyframe and scene forges) fail in-band naming `npm install sharp`. Since creative stays installed, an
  explicit render (a world `forge_motion`, `export_game` hangar portraits, `create_game` with
  `auto_audit`, the dashboard's PNG download) on a host with no Chromium-family browser still fetches
  Chrome for Testing ([control/lib/graph/scene/chromium.js](../control/lib/graph/scene/chromium.js));
  background bakes never do. A `MOJULO_PACKS` override that leaves creative out, or `$MOJULO_CHROMIUM`,
  prevents it.
- **The studio needs no install step.** `mojulo install creative`
  ([control/scripts/mcp-install.mjs](../control/scripts/mcp-install.mjs)) installs nothing: it says so and
  lists any optional helper that does not resolve. `mojulo install` with no arg prints status for all
  three groups. `mojulo install chatbot` writes the marker; `--remove` takes it away again.
- **Add vector recall:** `mojulo install recall` installs `@huggingface/transformers` (and with it
  `onnxruntime-node`, about 480 MB) into `$MOJULO_HOME/recall/` — its own `package.json` plus an
  `entry.mjs` shim that [control/lib/embedder/local.js](../control/lib/embedder/local.js) imports by file
  URL — then fetches the ~130 MB model into `$MOJULO_HOME/models/`. Outside the package on purpose: it
  survives a package upgrade and never edits the shipped `package.json`. Without it `semantic_search`
  ranks lexically (FTS5, trigram tokenizer) over the same rows and reports `mode: 'lexical'`; rows
  written meanwhile are stored text-only and get their vectors on the first boot after the install.
  `--remove` deletes the dir (the model cache stays). `mojulo install chatbot` installs recall first,
  because the builder's preview RAG must rank the way the deployed bot does.
- **What a default `npx mojulo` gets:** kernel + creative + the always-present orchestration packs —
  every pack outside the chatbot group. The chatbot packs are listed by `mojulo tools` / `mojulo packs` as
  "not installed" with the command that adds them, so the capability stays discoverable without
  advertising tools that would refuse to run.
- **Full workshop:** a plain `npm install` gets everything (the creative helpers are `optionalDependencies`,
  installed by default — `opentype.js`, `node-web-audio-api`, `manifold-3d`, the WASM CSG
  kernel behind `export_model({ union: true })`, and `openscad-wasm-prebuilt`, OpenSCAD itself as WASM,
  the mesher behind `mint_solid kind:'scad'`; absent, `union: true` reports and ships the plain shells,
  an `exact: true` field or cut refuses with the install line, and a `scad` mint refuses likewise — a stored
  `scad` row cannot render until the package is installed).
- **Host binaries are a separate axis from install groups.** Blender, the slicers, the engines and
  OpenSCAD are operator-hosted workers probed at call time, not npm dependencies — no install group
  contains them, and every one of them degrades to a stamped "skipped" with its env var named. Worth
  saying because it cuts the other way too: `export_model({ format: 'scad' })` is pure text and needs
  NO optional dependency, so the sharp-edge exit works in a lean install where `union: true` cannot.

`sharp` is an `optionalDependency` of its own (it used to arrive through the embedder) and belongs to
the creative group like the rest of the optional set; `sharp-lazy.js` keeps the kernel up without it.

## The iron wall — execution integrity, not information hiding

The boundary is about EXECUTION, not knowledge. An uninstalled pack's tools neither list nor run; a
refusal is a group-level, terminal advisory that points at what enables the group (`mojulo install
chatbot`, or for creative, which only an override can gate, the `MOJULO_PACKS` flag) and tells the model
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

## What `npx mojulo` downloads, and what a boot loads

A host spawns `npx -y mojulo` and waits for MCP `initialize` inside its own startup timeout: Claude Code's
`MCP_TIMEOUT` defaults to 30 s, a stdio server gets no retry, and a plugin cannot raise the timeout. That
window covers npm's install on a cold cache as well as the boot, so the install stays small and the boot
loads almost nothing:

- **The boot set is `better-sqlite3` and `croner`.** Every other package loads on the first call that needs
  it: puppeteer-core, archiver, pdf2json, officeparser, react and react-dom through
  [control/lib/lazy-deps.js](../control/lib/lazy-deps.js) (a package that cannot load is an in-band error on
  that one call), `sharp` through `sharp-lazy.js`, and the other creative helpers inside the modules that
  use them.
  [control/scripts/mcp-stdio.boot-guard.test.js](../control/scripts/mcp-stdio.boot-guard.test.js) boots the
  stdio server with every other declared package unresolvable and asserts the same tool list, so a static
  import that puts one back on the boot path fails the suite.
- **No JSX compiler at runtime.** The one `.jsx` the package ships, `components/graph/CreationMap.jsx`, is
  compiled at prepack into `CreationMap.jsx.mjs` ([control/scripts/precompile-jsx.mjs](../control/scripts/precompile-jsx.mjs));
  the stdio loader serves it while the source hash on its first line matches, so `@swc/core` is a
  devDependency.
- **Dashboard-only packages are devDependencies.** The Next build compiles them into its standalone
  server; the stdio server never imports them.
- **The dashboard is its own package.** The standalone Next.js server and the bot template ship in
  `mojulo-ui` ([control/ui-package](../control/ui-package/), staged by
  [control/scripts/stage-ui-package.mjs](../control/scripts/stage-ui-package.mjs)), published at the same
  version as `mojulo` and depending on exactly that version, so `npx mojulo` downloads neither. The
  dashboard resolves native and shared packages (better-sqlite3, sharp, the geometry, archive, document and
  browser packages) from the install it shares with core, never from copies traced into its build, and
  declares them with core's ranges. `mojulo-ui` inside core is a shim: it runs the dashboard package
  installed beside it, or downloads the matching version with `npm exec` after saying so
  (`MOJULO_UI_NO_FETCH=1` refuses). `npm run smoke:tarball` packs and installs both.
- **The tarball carries only what runs.** `files` leaves out the dashboard build, the bot template, the
  locale JSON (compiled into the dashboard bundle), test snapshots and scratch output.
- **Measured once for the 2.2 changes** (macOS arm64, one tree under the 2.1 and then the 2.2
  `package.json`). The tarball went from 30.2 MB to 25.5 MB (121 MB to 100 MB unpacked). Installing the
  tarball without its dashboard build into an empty npm cache added 426 packages (427 MB on disk, 278 MB
  downloaded) before and 264 packages (305 MB on disk, 191 MB downloaded) after; `--omit=optional`
  brings it to 151 MB on disk. These are single samples; re-measure a release with `npm run smoke:tarball`.
  With the dashboard split out, core's tarball is 6.0 MB (19.2 MB unpacked, from 25.5 MB and 100 MB) and
  `mojulo-ui`'s is 13.2 MB (59.9 MB unpacked). A cold `npx mojulo` from an empty cache then added 251
  packages (303 MB on disk), three samples through a local registry stand-in.

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
diagram-patterns-spike.plan.md
and kernel-diagram-surface.plan.md.

## The bot image is unaffected

Pack-splitting is about how the **workshop** is installed on the operator's host. The published bot image
(`ghcr.io/zombico/mojulo-bot`) is bot-agnostic AND pack-agnostic — it is a deploy target, not an install
of the workshop, and carries none of this. It is also *separately versioned* (tagged `bot-v*`, released on
its own cadence), so it shares no version number with the workshop and cannot be broken by a workshop
major bump. See [docs/chatbot/BOT-ARCHITECTURE.md](chatbot/BOT-ARCHITECTURE.md).
