# Changelog

All notable changes to the `mojulo` npm package are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
From `1.0.0`, the five paradigm loops and the recipe format are the stable
surface (see "The 1.0 contract" below); the bundled bot image stays pinned
exact per control-plane version.

## [1.4.1] - 2026-08-24

### Connected-services drift audit + refresher (version control for one-time-created services)

Connected services (Skills / mcp-orbit compositions sealed once via
`meta_context_commit`) bind to installed MCP tools by name and then rot silently
as vendors rename or remove tools — nothing re-checks a sealed binding until it
fails. Two new surfaces close that loop, split by shape: detection is a
deterministic join (a tool), remediation is a judgment call (a catalyst).

- **`meta_context_analyze` (Ring 6, read-only)** — the deferred "stale-binding
  audit lens." One lens ships: `stale-bindings` cross-references every sealed
  `binds` edge against the current declared inventory (`meta_mcp_inventory`) and
  the researched capability layer (`meta_mcp_capabilities`), classifying each
  binding `missing` (bound tool gone — the service will fail at runtime),
  `stale-capability` (tool present but vendor knowledge aged past the freshness
  window), `no-capability`, `unknown` (inventory never declared — never a false
  `missing`), or `ok`. Returns findings ranked most-actionable-first with
  per-finding re-research recommendations, an `inventory` freshness block, and a
  `summary` (severity counts + `providersToRefresh`). Scope `{kind:'fleet'}` or
  `{kind:'artifact',ref}`. No LLM — the audit is a graph join, not a judgment.
- **`refresh-connected-services` catalyst** — the remediation half. Materializes
  a scheduled artifact that re-declares inventory, runs the audit, deltas against
  the last run (anti alert-fatigue), optionally fans out the `research-mcp-vendor`
  catalyst over drifted providers (`refreshPolicy: report-only` default, writes
  nothing), and produces a dated report + operator action plan. Reports and
  proposes — never auto-mutates a binding (the contextmap stays append-only,
  cleanup operator-driven) and never spams the audit trail (its only writes are
  capability-row supersessions).

`meta_context_analyze` folds into `pack_connected_services`, so it stays off the
default `tools/list` payload (behind the pack dispatcher) with its full detail in
the forward_context deliberation drawer. Curation/patch write-side
(`meta_context_propose_curation`) stays deferred until real hand-edited-artifact
drift surfaces.

## [1.4.0] - 2026-08-22

### Install-gated capability packs (kernel + ops / creative)

Mojulo now installs as a KERNEL + two install packs — ops (`wing: office`:
bots / connected services / apps, pure code) and creative (`wing: studio`:
the render / media / games stack). "Full install" is their union; ops-only and
creative-only are both valid. Install state is PHYSICAL — `installedWings()`
derives each wing from what's on disk (`WING_INSTALL`: office is
`alwaysInstalled`, studio is present iff its optional deps resolve), with
`MOJULO_PACKS` as an explicit override and a memoized, import-free probe; a
future install wing is one `WING_INSTALL` entry. The creative render deps
(`three` / `node-web-audio-api` / `opentype.js`, ~82 MB) move to
`optionalDependencies` so `npm install --omit=optional` sheds them and
`next build` still passes (a request-string `externals` matcher in
`next.config.mjs` tolerates their absence); the ~535 MB Chrome-for-Testing
fetch is gated on the creative wing. `sharp` stays (transitive via the kernel
embedder). `mojulo install creative` (`scripts/mcp-install.mjs`) grows a lean
install into the full workshop. Uninstalled tools neither list nor run — the
refusal is a wing-level terminal advisory pointing at `mojulo install creative`
(execution integrity, not information hiding), enforced at every tool
chokepoint and kept orthogonal by the `pack-boundary` static guard (Checks
A–E). The published bot image is unaffected (pack-agnostic). See
`docs/install-capabilities.md`.

**Upgrading from 1.2.x:** no action needed and nothing is lost. npm installs
`optionalDependencies` by default, so a normal update (`npm i mojulo@latest`,
`npx mojulo@latest`, `npm update`) keeps the full workshop — physical detection
sees the creative deps on disk and every tool behaves exactly as before, plus
the new `mint_diagram`. Going lean is strictly opt-in: only an install run with
`--omit=optional` (or an npm config already carrying `omit=optional`) sheds the
creative pack, and even then the loss self-describes — a creative tool answers
with a terminal advisory to run `mojulo install creative`, which restores it.
No schema/data migration; existing bots, sketches, and worlds are untouched.

### Kernel diagram maker

A creative-absent mojulo can now MINT a diagram, not just render one:
`mint_diagram` (SPINE, always-on) validates + persists a diagram from the pure
kernel `lib/diagram-core.js` (extracted verbatim from `sketch-manifest`, which
now delegates to it) and returns a `/sketches/<ref>` URL. `create_sketch`
(creative) is the superset; both share `diagram-core`, so they can't drift (a
binding test asserts identical rendered SVG + byte-identical manifest;
pack-boundary Check E keeps the kernel diagram surface off `lib/graph`).
Coverage is flowcharts + common charts (bar / donut / KPI / line) plus the
standard diagram patterns — sequence (lifelines + activation bars + self-
messages), swimlane lanes, ERD entities, containment/C4 boundaries, Gantt
schedules on a numeric scale, and richer edge notation (arrowhead styles,
multiplicities, self-loops) — all validated in `lib/diagram-core.js` and
covered by the `diagram-core.*` suites. See
`lib/mcp/diagram-patterns-spike.plan.md`.

### Consolidated tool packs (opt-in, `MOJULO_TOOL_PACKS=on`)

The connect-time `tools/list` surface can now ship as a 10-tool SPINE plus 20
stateless PACK dispatchers — 28,669 bytes measured, from ~250KB flat (89%
cut). A pack called bare returns its orientation body (studio packs serve the
FORM_TOOLSETS prose — one source with `get_creative_toolset`, which folds to
unlisted in packs mode) plus a member manual with real schemas; called with
`{ tool, args }` it dispatches to the member server-side through the
single-writer queue with the MEMBER's own concurrency flag (long-polls
bypass, writers stay FIFO). No session state, no `tools/list_changed` — works
on hosts that never re-list (the P0 spike finding). Flat mode (default) is
byte-identical to the previous surface. Partition (every listed tool: exactly
one home pack, spine, or folded), pack-description 700-char ceiling, and a
35KB packs-mode payload pin are all test-gated; the routing eval gains a
DERIVED pack-level layer (fixtures lift entry-tool → home-pack via the
partition; multi-vector max-pool proxy over recognizer anchors; collision
rows hold rank-0 + margin). See `lib/mcp/packs.js`.

### CLI subcommands on the `mojulo` bin

The `mojulo` bin now doubles as a command-line front door over the same
registry: `npx mojulo tools|packs|help|call|pack_* …` (bare `npx mojulo`
stays the stdio MCP server, byte-identical; the subcommand names and the
`pack_` prefix become reserved words on the bin). Invocation is in-process —
no HTTP, no bearer token, no running dashboard — dispatching through the
same `tools/call` path with `mcpSessionId: 'cli'`, so serialization,
telemetry, masking, and deprecated-alias resolution match the MCP surface.
Listings and help are generated from the registry and pack partition (the
CLI authors no prose). Arguments ride `--json` (inline / `@file` / stdin) or
schema-derived per-property flags (flags win); `--timeout` (exit 124),
`--quiet`, TTY-aware column output, exit codes 0/1/2. `mojulo <pack_id>`
unveils a pack; `mojulo <pack_id> <tool>` dispatches through the pack
dispatcher with server-side membership validation. Serves shell-driven
agents, no-AI automation (cron/CI), and human spot checks. See
`scripts/mcp-cli.mjs`.

## [1.2.2] — 2026-08-18

### Windows dashboard boots again (re-land)

The 1.2.1 rewrite of `scripts/mcp-ui.mjs` (module-dir anchor work) started
from a copy predating e6e42e5 and dropped its two `pathToFileURL` wraps,
regressing the published dashboard to fully unbootable on Windows: `await
import(...)` was handed a raw `C:\...` path, which the ESM loader parses as
URL protocol `c:` and rejects with `ERR_UNSUPPORTED_ESM_URL_SCHEME` before
the server starts. POSIX was unaffected (a bare absolute path happens to
parse as a URL), which is why it slipped through. Both wraps are re-landed —
the fatal standalone-server import and the non-fatal embedder preload —
field-verified on Windows 11 / Node 24.19.0 against the published 1.2.1
layout: dashboard boots, the module-dir anchor resolves the formerly baked
paths, and DB routes run on the per-platform native modules.

### Install slimming: tarball 249MB → 115MB unpacked, host install −~430MB

Two structural cuts to what a fresh `npx mojulo` pays, with no behavior
change (full measurements, audits, and the verification record in
`install-splitting.plan.md`):

- **The double-shipped natives are gone from the tarball.**
  `onnxruntime-node` (90MB) and `node-web-audio-api` (42MB) were shipped
  inside the standalone dashboard bundle's private `node_modules` AND
  installed again at the host root as runtime dependencies. They now join
  `better-sqlite3` / `@img` in the standalone `files` excludes and resolve
  via the same host walk-up — the mechanism the 1.2.1 Windows field report
  confirmed works cross-platform with no hand-copying. Tarball: 249MB →
  115.4MB unpacked (25.7MB download).
- **`next` + `next-intl` move to `devDependencies` (host install −~287MB).**
  A published install never executes host `next`: `mojulo-ui` boots the
  prebuilt standalone `server.js`, which carries its own traced Next subset,
  and the only `next` import outside `app/` is the app-route-only
  `lib/auth/gate.js`. `next-intl` is forced along — it peers on `next`, and
  npm auto-installs missing peers, which would silently pull `next` back
  (a sweep found no other runtime dep peering on `next`). `sharp` stays
  host-resolvable through the `@huggingface/transformers` edge, so the
  1.2.1 `@img` platform-binary fix is unaffected. `react` / `react-dom`
  stay: `sketch-svg` and `motion/deck` render JSX at runtime.

Verified against a real `npm pack` + clean tarball install: natives load
(not just resolve) from the standalone context via walk-up, the stdio MCP
server answers `initialize` + `tools/list` (168 tools), and the standalone
dashboard serves `/` and DB-backed API routes. The remaining 130MB of
`onnxruntime-web` (transitive, dead weight on a Node host) is documented as
not-fixable-from-here in the plan file: npm honors `overrides` only in the
root package.json, which a published package never is.

## [1.2.1] — 2026-08-18

### Published dashboard works off the build machine (Windows field report)

A 1.2.0 field report from Windows 11 exposed that the packaged `mojulo-ui`
standalone bundle only ever worked on the machine that built it — every npm
install, every platform:

- **Bundler-baked absolute paths:** `next build --webpack` inlines
  `import.meta.url` as a literal build-machine string, so ~40 lib modules that
  located sibling resources (vocab cards, catalysts, adapters, outcome
  templates, vendored fonts/three, the embedder cache fallback) resolved to
  `file:///Users/<builder>/…` inside the standalone bundle — nonexistent paths
  on macOS/Linux installs, an `ERR_INVALID_FILE_URL_PATH` module-scope throw
  (→ route 500s) on Windows. New `lib/module-dir.js` resolves resource dirs
  env-first from `MOJULO_CONTROL_DIR` (the installed package root, which ships
  the complete `lib/` tree), exported by all four bins; the `import.meta.url`
  fallback stays for repo-dev and is only parsed when the env var is absent.
  Same treatment for the `process.cwd()`-anchored readers (composer protocols,
  pixelizer game shells) whose dynamically-read siblings file tracing can't
  see. `public/vendor/**` now ships at the package root so the three.js
  vendor modes resolve there too.
- **Build-platform-only native binaries:** the standalone `node_modules`
  shipped `better-sqlite3` and sharp's `@img/*` as darwin-arm64 only
  (`better_sqlite3.node is not a valid Win32 application` from every
  DB-touching route). Both are now excluded from the tarball; Node module
  resolution walks up from `.next/standalone/` to the host install's
  `node_modules`, where npm already put the right platform build.
  (`onnxruntime-node` / `node-web-audio-api` ship all platforms in-package
  and are untouched.)
- **`city` vocab card documented knobs the adapter never read:** the card
  listed `time` / `anchor` / `landmark` / `civicAreas` as flat override keys,
  but `cityThemeAdapter` reads theme slots (`context.time`, `asset.anchor`,
  `asset.monument`, `asset.civic`) — flat keys silently produced a flat-lit
  render. The card now documents the real slot paths (with an example), and
  `region` / `viewBox` pass through the adapter top-level like `fog` / `audio`
  (they had no reachable path since `create_fractal_city` retired).

### Routing telemetry + retrieval hardening (routing context weaving)

The tool-routing path — `forward_context` rows, routing cards behind
`semantic_search({kinds:['routing']})`, vocab drawers — gets its measurement
floor and a hardened retrieval hop (threads A/B/C/E of the 0818
routing-context-weaving plan; thread D, multilingual intent surfaces, still
open):

- **First-hop attribution, no schema change:** `forward_context` emits a
  mode-tagged telemetry signal (office vs studio reads become distinguishable),
  and the orientation cut (`get_tool_telemetry({orientation:true})`) now
  derives a first-hop histogram — per routing read, the next non-orientation
  tool in the same session — plus routing-card coverage: cards whose entry
  tool saw zero calls in the window render as "never routed". This is the
  instrument for orientation-diet's parked question ("which routing rows never
  route?"); pruning still waits on weeks of real-session data.
- **Hybrid margin guard on routing-card retrieval:** routing-kind search
  re-ranks with a small lexical tiebreaker (`cosine + 0.03 ×` query-term
  overlap against the card's When line; case/diacritic folding, whole-phrase
  substring fallback for non-segmenting scripts) — anchor quotes now do double
  duty as retrieval signal. The collision fixture gates rank-0 AND
  `top1 − top2 ≥ 0.01`, printing margins every run; the thinnest pre-guard
  margin (~0.004) widened ~5×.
- **Weak retrieval is actionable in-band:** zero-result or weak-scoring
  searches append a `hint` (routing-specific: rephrase with the artifact's
  FORM or open `forward_context({mode:'studio'})`; generic otherwise) behind
  the shared `WEAK_SEARCH_TOP_SCORE` constant; query-embed failure returns
  `{ results: [], degraded: true, hint }` instead of a bare `[]`, and the
  telemetry signal records `degraded: true` — the agent can now tell "nothing
  exists" from "index degraded" from "rephrase".
- **Drawer-miss coverage completed:** every `get_*_vocab` /
  `get_creative_toolset` miss is countable by the orientation cut (`unknown
  card` / `unknown form` phrasing + hit/index signals), with a registry sweep
  test pinning the convention for every future drawer.

A broad routing simulation (178 authored multilingual paraphrases through the
real embedder) validated the top-3 entry contract at 91% — including zh/es/ja —
and its findings (the dead `WEAK_SEARCH_TOP_SCORE` threshold, the
`diagram-chart` card weakness, thin non-English margins) are recorded in the
plan as the next round of work.

### Mechanics view: real-air `flight` scenario (the physics/flight kernel)

The spin-aware ballistic primitive is promoted from `vehicles/ball-flight.js`
to `lib/graph/physics/flight.js` — gravity, drag with a speed-dependent C_d
(the drag crisis), and Magnus lift with a spin-ratio-dependent C_l, constants
from the soccer-ball aerodynamics literature (Goff & Carré; Asai). The
projectile registry is closed vocabulary (the validated FIFA soccer preset),
with a custom-sphere spec (`{ mass | density, radius | diameter |
circumference, aero? }`) as the operator's own explicit dial; pure and
deterministic (launch spec in → identical trajectory anywhere), zero imports
so page emitters can inline the very source the server tests validate.

`mechanics_view` gains the `flight` scenario on top of it: a ball in real air
with `curl` (sidespin) and `spin` (back/topspin) dials so carry, dip and curl
are physically faithful; `compare:'air'` races the identical launch against
its vacuum twin from the same spot, and `stage:'goal'` dresses a pitch with a
regulation goal at `goalDist` so the bend reads against something. The
`mechanics` vocab card carries the new framing ("a free kick that curls /
banana shot / knuckle-drop"). The interim `ball-kick-emit.js` spike is
superseded and removed.

## [1.2.0] — 2026-08-17

Two threads: games gain a provenance surface (an about page plus an
operator-owned attribution default), and the npm package's stdio MCP server
now actually boots on a clean install — the fix that came out of the first
Windows install attempt.

### Games: about page + attribution (operator-owned)

- **`kind:'about'` menu entry** — the game's provenance page, content carried
  on the entry itself (body paragraphs with inline anchors, link cards, footer
  lines), rendered by the shell as a static screen. A root-level about lives on
  the title screen (Start / About); nested inside a `kind:'menu'` group it
  renders as a normal menu row.
- **Attribution default:** a game with a menu but no declared about entry gets
  a generated default about page at resolve time — provenance + links back to
  mojulo, identical in the served copy and the export, injected at resolve so
  the stored recipe stays clean. A courtesy credit, not a lock: declare your
  own about entry to replace it wholesale, or set `menu.attribution: false` to
  remove it.
- **`music.about`** — the score's about-screen loop (falls back to the menu
  track when absent); `export_game` bundles its WAV render alongside
  menu/battle.

### npm package: stdio MCP server boots on a clean install

The published package could not start its stdio MCP server:
`ensureToolsRegistered()` reaches `@/components/graph/CreationMap` (a JSX
component) through `sketch-svg.js`, and that one import path was broken three
independent ways — the process died with `ERR_MODULE_NOT_FOUND` before writing
a single JSON-RPC frame.

- **`components/graph/CreationMap.jsx` now ships** — it was missing from the
  npm `files` list. It is the only component lib imports, and it pulls only
  `lib/graph/scene/signage-chrome`, so nothing else in the UI tree rides along.
- **The stdio loader resolves `.jsx` and extensionless relative imports**
  (`./files`, `./exports-dir`, `./meta-context`, `./motion-comic-manifest`) —
  specifiers Next resolves but Node rejects.
- **A loader `load` hook compiles `.jsx` via `@swc/core`**, loaded lazily so
  the native addon costs nothing on boots that never touch a `.jsx` file.
  `@swc/core` is now a direct dependency (it was never actually installed
  transitively — it sits in next's devDependencies); lockfile updated to match.
- **Node floor corrected to `>=22.12`:** `lib/` ships ESM in `.js` files with
  no `"type": "module"`, which only loads on runtimes where module-syntax
  detection is on by default — on Node 20/21 the first lib import fails well
  before the old `<20` guard could matter. Engines and the runtime check both
  move to 22.12.

## [1.1.1] — 2026-08-16

A first-contact release, shaped by a six-persona post-install simulation (0816
persona sims): a first-run install hardening pass — everything between "I have
an MCP host" and "mojulo is wired everywhere and I'm looking at the dashboard" —
plus the other half of first contact: the substrate can now answer questions
about *itself* (posture, privacy, cost, uninstall) through the same
ask-the-agent channel the install docs point at. One engine addition rides
along: boost inertia for the mobile-suit pack.

### Substrate self-description — meta-questions get in-substrate answers

The persona sims showed a clean split: agents routed *build* asks perfectly but
had no in-substrate source for questions about mojulo itself — "does it phone
home?" retrieved a declared vendor tool (`gmail.untrash_thread`), "how do I
uninstall?" had no answer anywhere on the tool surface.

- **`get_substrate` now ends with the substrate facts:** twelve falsifiable
  architecture invariants (localhost-only process, one SQLite under
  `$MOJULO_HOME`, bot data stays in the bot's own DB, no telemetry / no
  phone-home, the one LLM flow that leaves the machine, AES-256-GCM key storage,
  Apache-2.0 / no subscription, plain-file exports, tamper-evident hash chain,
  full uninstall steps, single-user tenancy, and the source-repo pointer read at
  the installed tag). Facts, not an FAQ — the agent *derives* answers, including
  to questions nobody anticipated, and each fact names its own check
  (`list_daemons`, `verify_chain`, `version`).
- **Three routes lead there,** because agents take different paths:
  meta-question trigger phrases in `get_substrate`'s tools/list description, the
  `forward_context` drawer directory (both wings), and a new `substrate-self`
  routing card in the semantic index — "phone home" and "uninstall" now surface
  the referral at rank 0 instead of vendor-tool noise.
- **Pinned:** new `context.test.js` assertions on the facts body, four
  meta-question families in the routing eval's office fixture, and the
  description-budget re-pin (`get_substrate` 914 → 1023 chars; tools/list grows
  109 bytes, everything else stays behind the drawer).

### Boost inertia — the mobile-suit dash ends in a skid

Ground dashes used to snap to walk speed the frame F was released. An opt-in
`boostInertia` (seconds) on the rule leaves the suit *sliding* along the last
thrust vector, full boost speed decaying linearly to zero — with the transposed
brake pose (lean against the momentum, thrusters vectored the other way).
Deterministic pure-dt math; walls still stop it; a fresh boost swallows the
slide, and a melee swing / dodge / tackle / stagger kills it on the spot (the
strike is always planted). Ground mode only — space keeps its own Newtonian
coasting undecorated. Absent the knob: byte-identical runtime behavior. The
maneuver source is inlined into every emitted world, so all 10
`emit-channels` characterization hashes were re-pinned.

### `init` fixes — first-run correctness

- **Claude Code is now wired at user scope.** The previous `init` used the CLI's
  default `local` scope, registering mojulo only for the directory `init` happened
  to run from. Now: `claude mcp add --scope user mojulo -- npx -y mojulo` (also
  the current CLI syntax — the old `--command "..."` form predated it).
- **Claude Desktop detection covers fresh installs.** A fresh Desktop has no
  `claude_desktop_config.json` until developer settings are opened — config-file
  detection missed exactly the first-timers `init` exists for. Detection now falls
  back to the app's install footprint (`/Applications/Claude.app`,
  `%LOCALAPPDATA%\AnthropicClaude`); the writer creates the config when missing.
- **Absolute `npx` for Desktop.** Desktop spawns MCP servers from the GUI
  environment, whose PATH often lacks nvm/homebrew node (`spawn npx ENOENT`).
  The writer now resolves an absolute npx — first hit on the installer's PATH
  (stable symlinks win), then the running node's sibling.
- **Windows:** host probes and `claude` shell-outs route through the shell so the
  `.cmd` shims resolve.
- **Dashboard port honesty:** prefer 3001 (what every doc says), fall back to the
  next free port, print the real URL in the final banner; the UI child's stderr
  stays attached so a failed boot is visible.

### `init` repairs stale entries

Re-running `npx mojulo init` now heals installs wired by older inits instead of
skipping them: a project-local Claude Code registration is re-added at user scope,
and a Desktop entry carrying bare `npx` (or an absolute npx path that no longer
exists) is rewritten to the current form — backup + atomic write as always.
Entries the operator customized (env, extra keys, different args) are never
touched. Codex detection now also recognizes hand-written config variants
(inline table, dotted key, `[mcp_servers]` section key) so none of them gets a
duplicate appended.

### Node.js floor made explicit

- The `mojulo` bin checks for Node 20+ **before** loading anything
  version-sensitive and exits with a plain-language pointer (nodejs.org, or ask
  your coding agent to install it) instead of the previous cryptic
  missing-export crash on old Nodes.
- READMEs state the prerequisite up front — Node 20+, installed manually or by
  asking your agent — and document a global-install alternative
  (`npm install -g mojulo && mojulo init`) for slow connections, since a global
  bin makes `npx -y mojulo` resolve locally without a registry round-trip.

### Tests

- The init config writers (Codex, Claude Desktop) are now covered by
  `scripts/mcp-init.test.js` — the real bin driven against a temp `HOME`:
  merge-beside-existing, backup-once, idempotent re-run, all three hand-written
  Codex forms, the bare-npx / dead-path repairs, customized-entry hands-off,
  invalid-JSON fallback, and `--print` as a true dry run.

## [1.1.0] — 2026-08-13

A creative-surface and engine release: one new creative FORM (the motion comic), one new
walkable world kind (the dungeon), a key-free authoring path for the polygonizer, the
match-mode layer promoted from game content into the tracked engine, a baked
coverage-shading pass for rigged units — and the glTF interchange arc: animated GLB
export, a bind-back door for externally refined meshes, semantic level export, and
Blender as an optional local worker that bakes Cycles GI into a world's (or a walking
figure's) own vertex colours at zero runtime cost. Additive throughout — absent the new
opt-ins, every existing recipe renders byte-identical. Under the hood, a tool-list
token-load pass consolidates the figure/solid family behind one door and extends the
routing-card two-step to the office paradigms — the callable surface shrinks while the
substrate does not.

### Motion comic — a new creative FORM

`create_sketch { kind: 'motion-comic' }` mints the click-gated comic presentation — "the
powerpoint of comics": a fixed BOX + matte, no pages, bound by PANELS. Each scene frames one
panel crop (`{pageRef, panel}`) as the showcase and its events piecemeal balloons and
elements out one click at a time. The delta vocabulary: `show` / `say` / `swap` (direct
single-panel action — same frame, new art, cut by default; the reader interpolates) /
`move` (the camera cheat: shrink = depth, grow = approach) / `letter` (SFX lettering as
mojulo-drawn z-index overlays — the image worker never letters) / `focus` / `hold` /
`hide` / `clear`; balloon `tail`s foreshadow. The grammar is Turbomedia (Balak / Marvel
Infinite Comics lineage); the keyframe cheat shelf ships as the `motion-comic-tricks`
vocab card. Scene layouts: `full-spread` / `splash` / `two-panel` (slot-placed,
aspect-fitted at mint). Two lettering modes over the same says: drawn `bubbles` or
movie-style `subtitles`. State is a pure fold — insert/reorder events freely. Plays at
`/api/sketches/<ref>/play` (four-move navigation, deep-linkable); `?download=1` exports
ONE self-contained HTML file (player + art inlined, opens from disk). The form costs a
vocab card + routing card + `FORM_TOOLSETS` entry — no new tool registrations.

### Dungeon — a new `compose_world` base

The fantasy-interior primitive graduates into the world registry: `base: 'dungeon'` mints
a torch-lit walkable INTERIOR from a tiny `{ chambers, tunnels }` graph recipe — organic
round chambers at elevation joined by sloping tube/corridor tunnels, traced-fire lit,
deliberately the opposite of the flat generative house/room generators (the one invariant:
there is a ceiling and a floor, but no surface is assumed flat). Structural validity (a
tunnel to an unknown chamber, an unknown material) fails at mint; the movement-flow check
is advisory, never gated. Walkable `/world` + `.glb` export follow free from
`WORLD_KINDS` membership; the parameter manual is the `dungeon` view-vocab card.

### Key-free polygonizer authoring

`get_polygonizer_packet` / `submit_polygonizer_manifest` — the key-free twin of
`create_polygonized_sketch`, where the calling agent IS the generative model. The packet
hands the agent the same system/user prompts + JSON schema the keyed path would send a
provider; the submit runs the model-independent tail (validate → deterministic repairs →
lower → mint). A failed submit returns `repairPrompt` — the server-side repair loop
becomes conversational. Plan-then-skin passes the planning manifest back into submit; the
solved scaffold is recomputed server-side, never trusted from the agent. The polygonizer
analogue of `get_skin_packet`: natural-language → sketch now needs no provider key at all.

### Match modes in the engine

The game-mode layer joins the tracked engine as `worlds/match-modes.js`: five suit-agnostic
mode builders (solo / practice / ffa / team / watch) + geometry/seat/match helpers +
`lightenMatchLevel`, with `prelude`/`nameOf` hooks for content packs. The `compose_world`
controllable base now takes `match: { mode, killTarget?, rivals?, teamNames?, … }` and
`mapRef` — ANY stored controllable world with pilotable entities mints as a match level in
light form, promotable via `create_game`. `mapRef` terrain inheritance
(`worlds/map-ref.js`: spread-merge, level wins, `null` tombstones) resolves at the top of
`resolveWorldScene`, so `/world`, `.glb` export, `export_game`, and the audit runner all
inherit through one seam — a level row stores the mode's own output (~46KB), not a terrain
clone. Game shells gain the `roster` setup style (named-member check-picks, spectate-aware:
all-AI setups drop the difficulty card and despawn unpicked fighters).

### Tutorial mode — the scripted teaching layer

The controllable engine gains the TUTORIAL DIRECTOR (`worlds/controllable/tutorial.js`): an
opt-in `tutorial: { steps }` manifest channel — ordered prompt + goal steps the director
advances by edge-detecting live sim state each frame (no emissions added to the combat
systems; a world without steps is byte-identical). Facts: move / ascend / descend (vertical
travel — the space thrust lessons) / boost / boost-steer /
jump / hit / clip-empty / switch / swing (directional) / combo / tackle / dodge / stagger /
destroy — the maneuver facts edge-read the engine commit counters
(`e.tackleCount` / `e.dodgeCount`), so the director stays pack-agnostic; a destroy `of`
may name an id SET (all must fall). The
director is the level terminal (no match layer): the objective HUD card renders the active
prompt top-center, completion (or losing the suit) emits the one outcome envelope. Steps'
entry actions: `activate` (wake dormant seats), `heal` (restore a body to its minted
hull + shield — the between-phases repair), `set.aiDifficulty` (retune mid-level); an
`optional: true` step is a BONUS phase — the clear is already earned when it enters, so
the pilot going down there ends the level in success, not fail. Two
sibling affordances land with it: the `patrol` rule (a passive waypoint walker — hittable,
staggerable, never fires) and DORMANT seats (`dormant: true` — minted into the roster but
absent from play until a step's `activate` wakes them with the sky drop-in; the
deterministic mid-level reinforcement). `aiDifficulty` on a manifest seeds the AI tier at
mint. A tutorial track's levels store light like every matrix cell. (The optional
step-`gate` mechanism — a level locked until a prior one clears — was exercised end-to-end
then retired by operator call; `evalGate` and the shell's lock rendering remain available.)

### `export_game` — shared asset banks

Exported level pages were ~98% inlined rigged-figure bank, repeated identically per page —
past static-host file limits at roster scale. The export now hoists the figure bank and
big geometry literals (`GROUPS`/`REPEATS`/`TEXTURES`) into content-hashed, deduped
`assets/figures/` and `assets/geometry/` files with a top-level-await fetch shim; mode
variants of one map ship their terrain once, and a referenced map recipe ships beside a
light level's recipe so `recipe/` stays re-mintable. Trade-off, recorded in the tool
description: exported folders now need an HTTP server — `file://` no longer loads levels.
(Real-world validation: a 35-level export dropped from ~5GB to under 1GB, no file over
20MB, and published clean to GitHub Pages.)

### Level-load performance

A roster-scale controllable level went from a ~40–55s server bake + a 148.5MB page on
EVERY play to **~0.6–1.5s warm bakes, a 47.7MB page (−68%), and ~10ms 304 replays**.
Five stacked fixes, all engine-general:

- **Rig-bake LRU** (`worlds/unit-rig.js`): `bakeUnitRig` is now a keyed cache
  (manifest + opts hash; function-bearing overrides bypass; hits return
  shallow-protected copies) — levels sharing a roster re-bake nothing.
- **Indexed + quantized rig parts** (`figures/rig-bake.js`): positions on a per-part
  uint16 grid (worst-case error 1.3e-4 world units, verified numerically), deduped
  vertices, uint16/uint32 triangle indices, spec as u8 pairs. Self-describing per part —
  pages without unit rigs stay byte-identical.
- **Figure-buffer pool**: the controllable channel dedupes repeated packed buffers across
  the figure bank into a `__FIGPOOL` + in-page rehydration (livery variants share
  geometry); `export_game` hoists the pool into the content-hashed figure bank.
- **`/world` browser-cache tier**: the route sends an `ETag` (= the server world-cache
  key) under `no-cache`; a matching `If-None-Match` 304s before any resolve work, even
  across server restarts. `?nocache=1` stays `no-store`; the world cache budget is
  env-tunable (`MOJULO_WORLD_CACHE_MB`).
- **Level pre-warm**: game shells warm level worlds after the suit previews, using the
  exact launch URL so the cache key + ETag match the play request.

Also in the engine from the same tuning pass: per-weapon `chargedRangeMul` /
`chargedDamage` knobs (combat-ranged), the AI tackle-guard facing cone (ms-ai), opt-in
`manifest.jets` thruster families (unit-rig), and AI maneuver playbacks now running the
same blocking resolution as pilot dashes.

### Baked coverage shading (visual layer)

- `bakeSkyShadow` (`effects/ao-bake.js`) — the directional sibling of the AO bake: per-corner
  overhead rays (a small cone fan tilted toward the face's open side) darken whatever sits
  under solid geometry, with distance falloff, multiplying into existing `vao`. Pure
  deterministic arithmetic; LRU-cached like the AO bake (cache sized up 16 → 32).
- `bakeUnitRig` opt-in `ao:` — crevice AO × sky shadow over the rest-pose body, folded into
  per-part vertex colours: armor that covers a section now shades it (the bicep under a
  pauldron), pose-invariant at zero runtime cost. Absent ⇒ byte-identical bake.
- `shadows.cast.noCastGroups` — a declared roof/ceiling group receives shadows but never
  casts, so enclosed interiors no longer blanket their floors; emitted only when declared.
- `materials/face-material-roles.js` — a pure manifest→manifest selector that stamps
  procedural-material presets onto a finished map's faces by height band or baked fill
  colour, preset-validated at mint.

### glTF interchange — standard formats at the edge (I1–I4)

The `interchange.plan.md` sequence landed whole: recipes stay sovereign at home; the
edge speaks standard glTF both directions.

- **Animated export** (`scene/scene-gltf.js`): `export_model` takes opt-in `clips`
  (names or `'_all'`) — every packed rig figure exports as bone-local mesh nodes with
  one glTF animation per clip (FK→TRS, LINEAR samplers, 1 s/cycle, K+1 wrap key so
  loops don't hitch, hemisphere continuity enforced per bone). Absent ⇒ byte-identical
  (pinned).
- **Three new exportable kinds** (`worlds/world-kinds.js`): `figure`
  (`figures/figure-world.js` — static posed mesh + the packed FK rig with a clip from
  the stored motion vocabulary; the rig declares `embodies:'body'` so the clips path
  drops the static ghost), `carved-solid` (`effects/carved-solid-world.js` — the SVG
  frame's geometry/shading kernels replicated so the GLB matches the still's palette;
  caps via the existing ear-clipper), and `css3d-turntable` (an assembler beside
  `planSolidTurntable`, CSS→z-up). All three also serve `/world` live orbit.
- **The bind-back door** (`bind_mesh_render`, `scene/mesh-store.js`,
  `scene/scene-gltf-read.js`): an externally refined GLB binds onto its sketch as an
  append-only derived artifact (`data/outcomes/<ref>/mesh-<n>.glb` + sha256 provenance
  sidecar), machine-gated by a FULL geometry decode at the door. `meshRef` joins the
  figures map as the sixth body source — lowered server-side into `payload.faces` (no
  runtime GLB loader ships; a bound mesh picks up `ao:` etc. for free and rides every
  consumer: svg / scene / world / export). Reader: pure-Buffer writer's-mirror —
  indexed+soup tris → padded quads, COLOR_0/baseColor → per-corner fills round-tripping
  flat hexes byte-exact, TRS and matrix trees, y-up→z-up.
- **Semantic level export** (`scene/scene-gltf-level.js`, default-on): `worldFraming`
  cameras become posed glTF cameras; entities become identifiable nodes (a baked rig's
  wrapper IS its placement, standing at spawn facing its heading) carrying
  `moj:entity`/`moj:rule`/`moj:body` extras; scene extras carry `moj:spawn`,
  `moj:colliders`, and the `moj:game` contract digest. `export_model({write:true})` now
  writes the sketch's outcome folder — `model.glb` beside `recipe.json` and a README
  with the import notes (`data/exports/` is beats-only now).
- **Gates closed in real Blender** (5.2 LTS, headless): 351 animations imported off a
  roster-level export with the designed key/duration shape; cameras and `moj:` extras
  readable; mid-stride eyes gate clean; a Blender edit re-exported by Blender decodes
  cleanly back through the bind gate (COLOR_0 survives the round trip).
- Bound statues can opt into `singleSide` front-face culling (`scene/scene-three.js`) —
  interior-culled closed solids halve fragment cost; absent ⇒ byte-identical. Game
  levels also stop rendering the corner control-hint (the pause menu teaches).

### Blender as a local worker — hero bakes, world GI, prelit figures

Same posture as the image/voice workers: optional, operator-hosted, produces bound
derived artifacts, holds no substrate state. The runtime stays 100% unlit vertex
colour — a bake is a colour swap, never a lighting engine, so baked results ship to any
player/bot/deploy with no Blender anywhere.

- **Hero-object bake** (`scripts/blender-bake.mjs` + `.py`,
  `docs/local-blender-worker.md`): export → Cycles diffuse GI baked into vertex
  colours → bound back through the `bind_mesh_render` gate → placed via `meshRef`.
  The `statue` preset carries the eyes-gate findings (ambient fill + no-cast shoulder
  groups, a dense plinth for the baked shadow).
- **World GI bake — the "blenderification" bicycle** (`scripts/bake-world-gi.mjs` +
  `.py`, design in `scene/map-gi-bake.plan.md`): a fixed drivetrain
  (FACING→EXPORT→BAKE→machine gate→BIND→eyes gate) with gear adapters per world kind —
  `inline-faces` (recolours frozen `manifest.faces` in place, so `mapRef` mode
  variants inherit) and `generated-mesh` (resolve→bake→a `<ref>_gi` meshRef variant).
  Presets `interior-day` / `exterior` / `space` / `interior-lit`.
- **Unshaded export mode** — the substrate change the bakes ride:
  `resolveWorldScene(sketch, { unshaded:true })` exports RAW ALBEDO (a `FLAT_LIGHT`
  in `vexar.js` plus skipping the material/AO/weathering darkening channels; the light
  seam threaded through workbench/assembler/polygomer/city paths), so the bake's GI is
  the only lighting. Deliberately not an MCP schema field (description-payload
  ceiling); lives in the resolver + workers. Absent the flag, every output byte is
  identical.
- **Authored outward normals, P1** (`export-normals.plan.md`): the root cause of black
  parts on baked mirror-built units is winding-derived normals flipping under mirror.
  Lathe parts now author `outNormal`, carried through the assembler mirror and emitted
  as the GLB NORMAL attribute with winding made to agree
  (`faceListToMesh({withNormals})` — opt-in, every other consumer byte-identical).
  P2 (remaining generators) / P3 (rig-packed path) staked in the plan.
- **Prelit figures, P1** (`worlds/prelit-transfer.js`): a `unitRef` figure may carry
  `prelit:'<ref>'` naming a bound GI-baked transfer mesh — the rig's rest faces are
  recoloured through a quantised position→colour map before packing, so a
  premium-lit suit WALKS at zero runtime cost (rigid FK parts carry baked form-shading
  correctly). Cacheable via `prelitKey` (append-only bind slots name the bake
  content). Absent ⇒ the bake is byte-identical.

### Painted landscape — ground, extent, builds

The painterly terrain kind grows a walkable-world material layer, all seeded and
deterministic, world-route (and glTF export) only — the SVG path is untouched.

- `ground` — slope-routed surface textures for the `/world` mesh (steep cliff faces vs
  gentle ground), with a world-space grime-cloud + weather-streak bake into the vertex
  colours so tiling can never show, and a deepened facet-shading curve. Presets:
  `sandstone` / `granite` / `red-rock` / `meadow` / `snow`; object form for per-world
  tuning. Two new rock tile FAMILIES in `landscape/surface-textures.js`
  (`rock-sandstone`, `rock-snowcrag` — one structural DNA, four seed variants rotated
  per tile-repeat region).
- `extent` — uniform world-mesh magnification: a longer crossing under proportionally
  taller relief, without re-gridding.
- `builds` — terrain-anchored placed structures (launchpads, towers, decks): boxes,
  `shape:'cylinder'` prisms, `slope` ramps you can walk up, `rotZ` spins, `sink`
  bedding (negative = elevated walkways); one finish channel per build — a
  procedural-material preset + tint, or a panel texture tile. Absent ⇒ byte-identical
  face list.

### Fixed

- Polygonizer house recipes: the whole house assembly is now authored in one
  compiler-owned oblique space (facade datum, shared recession, forward apron) instead of
  mixing in renderer-anchored solids — the bug that detached roofs from bodies. Plus
  entry-door and furnishing upgrades in `floorplan-structure.js`.
- `create_sketch` can now MINT the seeded interior kinds (`floorplan` / `restaurant`), not
  just render ones minted elsewhere — the manifest gate dispatches on kind.
- `procedural-material.js` imports vexar relatively so mint scripts run under plain `node`.

### Tool-list token load — consolidation + routing

The figure/solid family collapses behind one door: `mint_solid(kind)` / `edit_solid(op)` /
`get_solid_vocab` replace ~15 closed `create_*` tools (figure, manji-tree, workbench,
assembler, carved-solid, solid-turntable, edifice, vehicle; skin + emote as `edit_solid`
ops), every retired name kept callable as an unlisted alias and every per-kind manual
parked in a `solid_vocab` card pulled on demand. The science-process views fold into
`create_view` kinds (`dna-process` / `energy-cycle`), and `forge_motion` / `stitch_motion`
shed their essay descriptions into `motion_vocab` cards. The routing-card two-step then
extends from the studio wing to the OFFICE wing: new `bot` / `app` / `connected-service`
paradigm cards turn the "is this a bot, an app, or a service?" boundary into a
surface-the-candidate-set → decide-by-who-touches-it → ask-if-underdetermined flow,
relocating the build-flow prose out of the always-resident office index. Retrieval is
pinned by an expanded eval harness (rank-0 collision ordering, office top-3 entry, two-step
SET coverage). Net: the always-on `tools/list` payload holds at ~250 KB while ~15 tool
names leave the surface; `PAYLOAD_CEILING` ratchets 381,500 → 255,000 to lock the reclaim
in. Additive — every retired name still resolves; recipes and renders are byte-identical.

### Docs

- README: npm/license/node badges + the `npx mojulo init` install one-liner above the fold.
- README + `package.json` description repositioned around composability ("the range is
  what allows composability" — recipes compose into bigger works; no prompt
  engineering, the vocabularies carry the small decisions).
- New plan: `lib/graph/interchange.plan.md` — "standard formats at the edge, recipes at
  home" (animated GLB export, eligibility widening, the bind-back door, semantic level
  GLB), with blender-mcp as the standing verification rig. The dungeon kind above is its
  I0 — and I1–I4 landed in this release (see the interchange section above), with the
  build logs and closed Blender gates recorded in the plan.
- New worker doc: `docs/local-blender-worker.md` (posture + both bake legs); CLAUDE.md
  gains the world-GI-bake capability row.
- New plans from the Blender arc: `scene/map-gi-bake.plan.md` (the bicycle, generalized),
  `scene/level-gi-spike.plan.md` (the throwaway proof), `scene/export-normals.plan.md`
  (authored normals, P1 landed), `worlds/prelit-figure.plan.md` (the moving prelit suit),
  `interchange-render-leg.plan.md` (the Cycles render seam — orientation, no code).

## [1.0.3] — 2026-08-07

A CI-portability patch — test-only, no runtime or API change. Once 1.0.2 cleared the module-load
break, CI surfaced a second, older problem: the visualization-era characterization snapshots were
pinned on the developer's machine (node 24 / macOS) and hashed **full-precision, trig-derived
floats** (camera pitch, entity positions). Those values drift ~1 ULP across V8 versions and libm
builds, so the pins mismatched on CI (node 20, ubuntu/glibc) — the reason CI had been red across
1.0.0–1.0.2. This is why the local "6,134 green" gate never reproduced in CI: the char-net was
never environment-portable.

Fix — make the two offending pins portable by construction so they are byte-identical on any node/OS:

- `world-scene.kinds`' broad per-arm hash is now **structural** (integers/strings/booleans/array
  -lengths/key-sets exactly; non-integer numbers as presence only) **and local-only** (skipped under
  `CI`). The complex generated kinds (planetary, orbit-view, …) build geometry through threshold
  -based vertex/face decisions, and a few payload coordinates are near-zero cancellation values
  (~1e-9) that differ by V8 build — when one straddles a dedup/cull threshold the FACE COUNT itself
  flips, so even a structural hash diverges between environments. The payload is deterministic
  *within* an environment (the `resolves are deterministic` sub-test proves this and runs on CI); it
  is simply not portable *between* them. The pin stays a local transcription-error guard; the
  emitted-output char-net (`emit-channels.char` et al.) is the portable guard on the float geometry.
- The controllable golden traces round every float to 6 significant figures — coarser than the
  cross-environment drift, finer than any behavioral change (a maneuver firing, a hit landing shows
  as a structural diff). Both snapshots were regenerated in the full-suite context (async-texture
  warming makes the world-scene hashes context-sensitive, so an isolated regen would not match CI).
- Also fixes a time-seeded flake in the session-token test: flipping the **last** base64url char of
  a 32-byte HMAC signature can be a no-op on the trailing padding bits and still verify; flip the
  first char, which always maps to real signature bytes.

Green on node 24 across two consecutive full runs (424 files / 6,134 tests); the node-20
ubuntu+macOS CI matrix is the portability gate.

## [1.0.2] — 2026-08-07

A stability patch that closes the 1.0.0/1.0.1 CI break at its root. The controllable-world
decomposition in 1.0.0 had lifted three modules into the gitignored mobile-suit content pack and
then **statically imported them back** into tracked source — `ms-maneuvers.js` (dodge/tackle
maneuvers), `ms-ai.js` (the AI opponent brain), and `agent-commander.js` (the 0807 "agent-spectate"
spike: a live commander that reads the fight and drives a suit). On a clean checkout — CI or a
fresh `npx mojulo` — those imports resolved to absent files and threw `ERR_MODULE_NOT_FOUND` at
module load, taking down the whole controllable-world path. (The published 1.0.0 tarball happened
to bundle the pack via its `files` allowlist, so `npx` ran; CI on the bare repo did not.)

Resolution — **cull the spike, keep the behavior**:

- The `agentSpectate` / agent-commander plumbing (the "make an agent play the arena" experiment)
  is removed from tracked source. Its emit blocks were gated and byte-neutral when a manifest did
  not stamp `agentSpectate`, so no world or fixture changes bytes. Touches the controllable channel
  emitter, `scene-three.js`, and `world-scene.js`.
- `ms-maneuvers.js` and `ms-ai.js` are engine **behavior** — they carry tracked test coverage in
  `controllable-world.test.js` — not content, so they are now tracked directly (a `.gitignore`
  exception) and resolve on a clean checkout. The rest of the mobile-suit content pack stays
  gitignored.

Verified green in BOTH states: pack present (424 files / 6134 tests) and, crucially, pack absent —
the real clean-checkout condition — (412 files / 6025 tests). Folds in the 1.0.1 characterization
snapshot re-pin. No API or world-recipe change.

## [1.0.1] — 2026-08-07

A test-pin patch — no runtime or API change. The `1.0.0` release commit shipped a stale
characterization snapshot: the final edits in the controllable-world decomposition changed the
emitted bytes of the ten controllable / shadow / fx / capture channel fixtures, but
`lib/graph/scene/__snapshots__/emit-channels.char.test.js.snap` was regenerated one edit too
early, so `emitThreeWorld`'s byte-level pins failed in CI. The emitted world code itself was
correct throughout (the behavioral trace / parity / emit / determinism suites all passed on
`1.0.0`); only the stored hashes lagged. This release re-pins those ten hashes so the suite is
green (424 files / 6134 tests). No consumer of the package is affected — the snapshot is a
test-only artifact, never executed at runtime.

## [1.0.0] — 2026-08-07

An editorial release. Everything since 0.8.0 — the visualization era — consolidated into one
release, plus the statement of what the version number now promises. (The consolidation dated
2026-08-04; a coherent late batch landed 2026-08-06 and folded in before the merge — see "Late
additions" below.) 0.8.0 shipped a bot
factory that had just learned to run apps; 1.0.0 ships **the agent's workshop**: five creatable
paradigms — bot / connected service / app / **media** / **game** — where **Media** is the creative
arm promoted to first class (diagrams, walkable worlds, figures, synthesized music and song,
voice registers, films, publications, covers, directed pictures — all tiny deterministic
recipes, never renders) and a **Game** is composition over it: Media levels, music, and art
bound to a typed store with rules.

### The 1.0 contract

- **Stable surface:** the five paradigm loops (bot mint→deploy→verify_chain · connected-service
  deliberation→bind→trigger · app scaffold→start→envelope-inference · media mint→render→export ·
  game mint→play→export),
  the recipe→render doctrine (stored manifests re-render deterministically; derived renders are
  disposable, provenance-bound files under `data/outcomes/`), additive-only DB migrations
  (existing DBs upgrade at open), the loopback-only MCP transport, and the no-LLM-keys posture
  on creative/vision/inference paths.
- **Moving surface (minor releases):** the creative vocabularies — sketch/view/world/beats/game
  kinds, vocab cards, routing cards, registers, catalysts. Content-extensible by design;
  expected to keep accreting through 1.x without a major bump.
- **Bot image:** pinned exact (`bot-v0.5.1`); the bot runtime is unchanged in this release.
- **Taxonomy note:** Media is promoted from "the creative arm beside the paradigms" to the
  fourth paradigm, and Game moves to fifth as composition over it. The worked-example key
  `creative-mint` is renamed `media` (the old key still resolves as an alias).

### Media — the fourth paradigm (the visualization + audio substrate, Ring 10)

Recipe→render across four backends over one engine-agnostic payload: SVG (two-point
perspective), CSS-3D (dependency-free `matrix3d` scenes), three.js (traversable Worlds with
orbit/WASD, `.glb` + z-up `.stl` export), and GLSL raymarch (painted landscapes + the fog
effects overlay). Worlds/objects split into distinct concern buckets with their own rails;
45 science/math/bio study kinds drawerized under `create_view`; figures gained rigs, emotes,
garments-as-data, fluff bodies with SDF welding, and skin projection; per-surface material
response (Blinn-Phong over the baked vexar solve, diffuse-preserving); real-unit read-back via
`measure_view`; films via `forge_motion` / `stitch_motion`. `lib/graph/` folderized a second
pass (`derivers/`, `geo/`, `landmarks/`, `layout/`, the `scene/channels/` registry split).

### Game — the fifth paradigm: composition

`create_game` (typed store + levels-as-worlds, **completability-gated at mint**), level-verb
mechanics + game kits + the glyph/sfx UI language — all proven on the **Mobile Suit Arena**
build line, whose lasting deposit in the repo is *engine*: assembler units made posable →
walkable → playable (the station-graph walking-unit layer — unit-pose/anchors/rig,
dodge-poses, pose-lab), the controllable-world combat/match machinery (AI fire-back with
boost-juking, spawn drop-ins, contact shadows, egg-exact target reticle, match stats,
proximity audio), the game shell's hangar/setup/score-screen machinery, **gamepad support**
(standard-mapping pads merged into the one input snapshot, weapon-select chords, a
controller-diagram pause sheet) and **practice mode**. The arena's game *content* — weapons,
shields, maps, liveries, suit vocab — ships as an operator-local content pack behind guarded
lazy-import seams that degrade clean when absent: game content is an artifact, not source.
Around the paradigm, the project layer: **game projects** (`create_game_project` /
`bind_to_game_project`, the read-only Game Developer studio at `/games/<ref>`), the **Mojulo
Arcade** (`/arcade`), the **pixelizer** 2D register (declarative PPU-model frames, pure
`step(state, action)` reducer games — brickster + philosopher's stone seeded —
`create_pixelizer_game`), the **sprite-sheet** pipeline over the image-render handoff
(`create_sprite_sheet` / `bake_sprite_sheet`), publication **covers** (`create_cover`), and
**`export_game`** — a stored game materialized as a self-contained folder, one `git init` from
a public GitHub-Pages playable URL.

### Audio, voice, song

Beats (synthesized-never-sampled seeded recipes: ambient / composition / groove / SFX) grew a
domain layer (revisions + annotations + the `/beats/<ref>` studio), world bindings driven by
sim state, WAV/MIDI export, foley, and **song**: a composition sings via the in-process
parametric formant vocaloid (`patch:'voice'`) — grown in-house where a borrowed sense failed
the determinism bar. Voice registers (`create_voice` — confidence × depth resolved to Kokoro
blend weights, pure math) with WAVs as disposable derived renders via the optional local
worker. In-world combat audio is proximity-scaled.

### Borrowed senses (image outcomes)

Mojulo designs pictures it cannot paint: designed-picture sketch kinds (`image-outcome` /
`sequential-art` / `character-sheet` / keyframes / scene-motion), the durable render-worker
handoff (`request/pull/submit/accept/reject_image_render` over `image_render_requests`, two-gate
machine+eyes doctrine), the optional local ComfyUI worker reweighed SDXL → **Qwen-Image-Edit**
(one protocol over two transports), skin projection onto polygomers and assembled units, and
the agent-as-vision-adapter reference protocol.

### Orientation & operations

`forward_context` dieted to a thin routing index (routing cards + FORM-scoped
`get_creative_toolset` subdrawers), tool telemetry + `/observability`, worked examples + the
register kit, description-budget ratchets + payload pins enforced by test, the workshop nav
drawer + `/maker` hub tiles, and **mojulo-orient** — a separate consent-first stdio MCP
carrying founding works as mintable recipes for practical orientation.

### Deprecated / removed

Operations mode (Ring 11) removed as unused (`ops_tags` retained as motion's grouping store);
the ~40 per-view tools retired into `create_view` kinds (retired names still execute as
unlisted aliases); the pixelizer artifact gallery archived out of the tree (engine + two
reference games remain, gallery recipes retained as test fixtures); **the mobile-suit game
content extracted** to a gitignored operator-local pack (`lib/graph/mobile-suit/`) behind
guarded seams — the `g-series-livery` module and the g/z-series livery vocab cards leave the
tree, cold copies in `lite-template/integration/archive-mobile-suit/`; closed plan/spike
files consolidated into the changelog and `control/docs/` orientation docs.

### Data & migrations

All additive: `beats_revisions` / `beats_annotations`, `game_projects` (+ typed-role members),
`image_render_requests`, sketches `bucket` / `folder_ref` columns (buckets derive at read
time — existing rows reclassify with no migration), new embeddings kinds (routing / vocab
families). No destructive migration; existing 0.x DBs upgrade at open.

### Late additions (2026-08-06, folded into 1.0.0 before the merge)

A coherent batch landed on the branch after the 08-04 consolidation and ships in 1.0.0. Build
logs live in the plan files named inline.

- **Controllable-world engine decomposed** (`worlds/controllable-split.plan.md`, complete). The
  3,305-line `worlds/controllable-world.js` monolith — the whole action-game engine as one
  import-free closure — was split into **import-free builder closures composed over a shared
  namespace** (`worlds/controllable/`: `compose`/`core`/`gait`/`rules-*`/`combat-{hit,ranged,melee,match}`;
  the mobile-suit maneuvers + AI lifted into the operator-local content pack), so the
  single-source-of-truth browser emission survives per-system rather than as one blob.
  `stepWorld` became a **registered slot-runner** with the frame order test-pinned. The façade
  `controllable-world.js` shrank 3,305 → 86 lines, re-exporting the same API; behavior is
  **byte-identical**, gated by four golden scenario traces and a per-builder `new Function`
  self-containment tripwire (char-net re-pinned on the 10 controllable-channel fixtures — every
  carve changes emission bytes by design).

- **Drivable and flyable vehicles** (`vehicle-designer/drivable-vehicles.plan.md`, D1–D5 +
  gamepad + fly). The veh-* part shelf meets the worlds engine as the **first external tenants**
  of the decomposition — rule-level builders that needed zero engine edits. A `drive` rule
  (pure kinematic longitudinal dynamics: real `F=P/v` power curve capped by traction, quadratic
  drag, bicycle-model steering off the rig wheelbase, distance-true wheel spin) and a `fly` rule
  (energy-and-attitude flight with stall + coordinated bank-to-turn). A vehicle rig
  (`deriveVehicleRig`/`bakeVehicleRig`, wheels classified FL/FR/RL/RR by position, a single
  `roll` clip) renders through the existing figure-rig path; drivetrain data is seeded **on the
  parts** (`VEH_ENGINE_DRIVETRAIN`, `curbMass`/brake overrides on the archetypes) and composed by
  `deriveDrivetrain` — no engine part → not drivable, by data. Worlds bind a vehicle via
  `figures.vehicleRef` beside `unitRef`; board / drive / dismount ride the existing pilot-swap
  (T); gamepad RT/LT map to throttle/brake off the live pilot each frame; opt-in mesh `tilt`
  banks planes. The `veh-drive` vocab card names the affordance facts (`speed` / `throttle` /
  `braking` / `skidding` / `boarded` …) later fx/sfx layers bind against.

- **`forward_context` office/studio split** (`mcp/tools/orientation-containment.plan.md`, C1–C3).
  `forward_context` gains a stateless `mode: 'office' | 'studio'` (default office). The creative
  FORM recognizer rows + the game row relocate **verbatim** into a standalone studio body reached
  by one hook row, dieting the always-paid office body from ~11.6K to ~9.4K chars/cell; the single
  `BODY_CEILING` retires for per-mode pins (office 9,600 / studio 7,400). `SERVER_INSTRUCTIONS`
  Media/Game bullets collapse to one line each teaching the two wings. Follow-on schema-diet and
  result-shaped tool-pack work is staked in plan files; a host spike found
  `notifications/tools/list_changed` non-actionable on the primary host today (client never
  re-lists mid-session), so dynamic tool-packs park behind a dispatcher-hybrid fallback and the
  near-term economic fix stays the per-schema diet.

- **Volumetric fog depth-clip** (`map-treatment.plan.md`, engine seam). Fog gains an opt-in
  `depthClip`: a per-frame depth prepass clamps the raymarch at the rasterized scene's foreground
  meshes (rigged suits, walkers, cars) the box-field SDF doesn't carry, so fog stops painting over
  them. Opt-in — absent, the composed frag and every emitted page stay **byte-identical**.

Recorded gate at the batch's close: **6,075 tests green**. The description-budget ratchets were
re-pinned upward in the batch — `PAYLOAD_CEILING` 372,000 → 376,000 and three catalyst
descriptions allowlisted — to bless the local-catalyst shelf and absorb the `forward_context`
mode schema; the payload now sits at 374,898/376,000. The downward schema diet (moving the
`create_manji_tree` / `forge_motion` enums behind their vocab cards to shrink the ~94K-token
connect surface) stays open as an orientation-containment follow-up.

### Previously-unreleased sections

The six dated sections below were accumulated as "Unreleased" between 0.8.0 and this release;
they ship in 1.0.0 and are retained verbatim for the record.

### 2026-06-16
Bring visual capability to browser-based 3D via css3D and three.js. Enhance scene composition and enable figure drawing. See HTML-CSS-NATIVE-RENDERING and POLYGONIZER-SYNTHESIS 

### 2026-06-07 (was "Unreleased (minor)")

Painted landscapes — closed-vocabulary, glyph-driven landscape primitive. The model picks one **heartbeat** (geometry recipe), one **splatch** (3-seed palette), and an optional **structure-glyph** (scatter recipe); the substrate samples wave parameters within the heartbeat's declared ranges using a seed, derives a balanced 4-stop palette from the splatch via Rec.709 luminance-sorted interpolation, scatters obelisks/boxes at footprints whose `z_base` rides the wave surface, and renders a flat-Lambert borderless SVG with back-to-front depth sort. Authoring surface collapses to `{heartbeat, splatch, structures?, seed?, light?}` — measured at ~30 tokens vs ~14K for the equivalent raw SVG (~449× reduction) and ~250 for a fully-specified manifest (~8× reduction). Math provenance and design ladder in the spike series: [field-coupled-wedges.spike.gen.test.js](lib/graph/polygonizer/field-coupled-wedges.spike.gen.test.js) → [-lambert](lib/graph/polygonizer/field-coupled-wedges-lambert.spike.gen.test.js) → [-step3](lib/graph/polygonizer/field-coupled-wedges-step3.spike.gen.test.js) → [-step4](lib/graph/polygonizer/field-coupled-wedges-step4.spike.gen.test.js) → [-structures](lib/graph/polygonizer/field-coupled-wedges-structures.spike.gen.test.js) → [glyph-driven-landscape](lib/graph/polygonizer/glyph-driven-landscape.spike.gen.test.js).

### Added

- **`renderPaintedLandscapeToSvg` primitive** at [lib/graph/polygonizer/painted-landscape.js](lib/graph/polygonizer/painted-landscape.js). Closed-enum `HEARTBEATS` (4 entries: `gentle-pulse`, `breathing`, `chop`, `ridge-step`), `SPLATCHES` (6 entries: `meadow-trio`, `dusk-trio`, `glacier-trio`, `firelight-trio`, `bone-trio`, `verdure-trio`), `STRUCTURE_GLYPHS` (3 entries: `monument-row`, `village-cluster`, `scattered-totems`). Seeded variation via xmur3 + mulberry32 — same seed → byte-identical scene; new seed → coherent variation within recipe rules. Palette is splatch-deterministic (seed only varies geometry and structure placement). Validation surfaces "unknown X (available: …)" errors mirroring the substrate's `fields.js` pattern. Combinatorics shipped: 4 × 6 × 4 = 96 distinct scene templates, each with within-recipe variation.
- **`create_painted_landscape` MCP tool** at [lib/mcp/tools/painted-landscape.js](lib/mcp/tools/painted-landscape.js). Validates the manifest, persists via `SketchRepository` with `manifest.kind === 'painted-landscape'`, returns `{ ok, ref, url, svgUrl }`. Registered in [lib/mcp/server.js](lib/mcp/server.js) adjacent to `create_manji_tree` so both illustration entry points sit together in `tools/list`. The tool description embeds the glyph catalogues (heartbeat/splatch/structure intents) so the model can pick by intent without a separate lookup.
- **Sketch SVG route dispatches on `painted-landscape`** in [app/api/sketches/[ref]/svg/route.js](app/api/sketches/[ref]/svg/route.js). The route now branches `manji-tree → renderManjiTreeToSvg`, `painted-landscape → renderPaintedLandscapeToSvg`, fallthrough → `renderSketchToSvg`. No new persistence layer — painted landscapes ride the existing sketch artifact system like manji-trees.
- **Test coverage** at [lib/graph/polygonizer/painted-landscape.test.js](lib/graph/polygonizer/painted-landscape.test.js) (18 unit tests covering tables, seeded determinism, range conformance, palette derivation luminance ordering, validation surfaces, render output) and [lib/mcp/tools/painted-landscape.test.js](lib/mcp/tools/painted-landscape.test.js) (11 integration tests covering mint→persist→render flow, missing/unknown input rejection, seed determinism, and light-override propagation).
- **`paletteOverrides` on the manifest** for fine-grained color tuning that keeps the splatch contract. Three independent sub-fields: `stops: { shadow?, base?, mid?, highlight? }` replaces any subset of derived stops with explicit `#rrggbb` hex; `positions: [0, p1, p2, 1]` repositions the four stops on the brightness ramp (strictly increasing, default linear `[0, 1/3, 2/3, 1]`); `gamma: number` curves the Lambert→stop mapping (default 1.0). The closed-vocabulary splatch stays the default; overrides express "this splatch under tuned lighting" without inventing a new palette. Validation enforces hex format, strict-increase + endpoint constraints on positions, and positive-finite on gamma — bad overrides fail at mint, not render. Eight new unit tests + two new MCP integration tests cover the round-trip.
- **`heartbeatOverrides` on the manifest** for fine-grained geometry tuning that keeps the heartbeat enum. Two sub-fields: `waves: [{ ampScale?, cuScale?, cvScale? }, ...]` applies per-component multiplicative scales to amplitude / cycles-u / cycles-v ranges BEFORE seeded sampling (null entries skip; length must be ≤ the heartbeat's component count); `samples: { u, v }` overrides the heartbeat's recommended cell density (integers ≥ 2). The seeded property is preserved: `(heartbeat, seed, heartbeatOverrides)` → identical waves. Eleven new unit tests + two new MCP integration tests cover the round-trip and validation.
- **Shelf-card loader at [lib/graph/painted-landscape-cards/](lib/graph/painted-landscape-cards/)** with [loader.js](lib/graph/painted-landscape-cards/loader.js) scanning the directory for `*.md` files with JSON frontmatter, validating each card against its family schema, and exposing frozen `HEARTBEATS` / `SPLATCHES` registries keyed by card id. Heartbeat and splatch families are content-extensible — adding a glyph is a content edit (drop a new card here); shipping a new family kind is still a code change. Structure glyphs intentionally stay code-defined (algorithmic, not pure data). Ten seed cards now ride this path: four heartbeats (`gentle-pulse`, `breathing`, `chop`, `ridge-step`) and six splatches (`meadow-trio`, `dusk-trio`, `glacier-trio`, `firelight-trio`, `bone-trio`, `verdure-trio`). The renderer's `HEARTBEATS` and `SPLATCHES` exports re-export the loader's output, so callers see no API change. Five loader unit tests cover the seeded set, frozen-at-every-level invariant, and field shape conformance.
- **fBm engine for fractal terrain** — second wave-generation engine alongside `sine-stack`. Heartbeat cards declare `"engine": "fbm"` and a `fbm: { octaves, persistence, lacunarity, baseScale, amplitude }` parameter block (each a `[lo, hi]` range, same range-authoring discipline as sine cards). The renderer's value-noise + fractional-Brownian-motion implementation (~60 LOC) produces irregular omnidirectional bumpiness with statistical self-similarity — "bumpy throughout, scales naturally with the quad" — which sine waves cannot express. Engine is loader-dispatched: `evalHeightAt(x, y, hb)` and `evalLambertAt(x, y, hb, light)` branch on `hb.engine` so build helpers don't know which engine they're sampling. fBm uses world coords directly (slope by finite differences with ε=0.01); sine path uses normalized `(u, v)` (analytic slope). Three seed fBm cards land: `gentle-roughness` (3-4 octaves, soft naturalistic hills), `rocky-irregular` (5-7 octaves, broken ground), `glacial-smooth` (2-3 octaves, broad swells). Seven seven new unit tests + comparison spike at [`lite-template/integration/spike-output/fbm-engine-comparison/`](../lite-template/integration/spike-output/fbm-engine-comparison/) (sine vs fBm under matched splatch + seed). Engine guidance: pick `fbm` for natural terrain (meadows, dunes, glaciers, broken ground); pick `sine-stack` when periodicity is the intent (terraced fields, ocean swell stacks, ribbed forms).
- **`renderStyle` field on the manifest** — closed enum `['painterly', 'topographic', 'wireframe']`. Orthogonal to heartbeat and splatch; geometry + Lambert math unchanged across styles, only polygon stroke/fill changes. `painterly` (default) = stroke=fill, no visible borders, cinematic / classic-landscape read. `topographic` = Lambert fill WITH dark cell borders, vector-map / topo-chart / textbook-chart read. `wireframe` = `fill="none"` with Lambert-colored strokes on the shadow stop as background, pure-vector-display / 80s-textbook-math-cover / outrun-grid read. One additional token at authoring time unlocks three categorically different visual registers from the same scene. Six new unit tests + two new MCP integration tests cover the round-trip and the visual-mode invariants (`painterly` has no `fill="none"`; `wireframe` is all `fill="none"`; `topographic` has a single shared stroke color).
- **Seven new stylistic splatches** in [painted-landscape-cards/](lib/graph/painted-landscape-cards/) covering the cinematic / vector-technical / textbook registers: `terminal-amber` (amber-on-black phosphor / retrocomputing); `synthwave-neon` (deep-purple → hot-pink outrun / 80s math cover); `vector-cyan` (deep-blue → electric-cyan CAD / blueprint); `chart-primary` (deep textbook-blue + vermilion + bone-white scholastic chart); `velvet-cinema` (inky-midnight + velvet-violet + antique-gold noir); `harvest-gold` (deep-umber + fired-amber + burnished-gold autumnal); `mist-coastal` (slate + muted-teal + pale-fog overcast cinematic). Splatch count goes from 6 to 13; combinatorics now ~12K distinct templates excluding overrides. Showcase spike at [`lite-template/integration/spike-output/stylistic-register-showcase/`](../lite-template/integration/spike-output/stylistic-register-showcase/) demonstrates the same primitive covering cinematic / vector-technical / topographic registers.
- **`camera` glyph family** — closed-vocabulary cards that lock the scene's projection (vanishing points + room basis + vertical axis + depth foreshortening). The loader gains a third family (`camera`) alongside `heartbeat` and `splatch`; five seed cards land in [painted-landscape-cards/](lib/graph/painted-landscape-cards/): `medium-survey` (substrate default baseline), `wide-cinematic` (panoramic letterbox with deep room), `close-up-detail` (tight foreshortening + taller verticality), `low-angle-hero` (horizon pushed high + 48-unit verticality for monumental structures), `top-down-survey` (near-orthographic / topographic / map-view). The renderer threads `(camera, roomBasis)` through every `projectTwoPoint` call; omitting `camera` falls back to the substrate's prior default projection so existing renders are byte-identical. Six new loader/unit tests + two MCP integration tests cover the round-trip and the multi-camera differentiation. Showcase spike at [`lite-template/integration/spike-output/camera-lock-showcase/`](../lite-template/integration/spike-output/camera-lock-showcase/) renders the same fixed scene under all five cameras (1–5) plus four recommended pairings (P1–P4) demonstrating camera × renderStyle × splatch composability. **One extra named pick rotates / tilts / zooms the camera without touching terrain or palette** — combinatorics now roll in the camera dimension on top of heartbeat × splatch × structure × renderStyle.

### 2026-06-03 (was "Unreleased (patch)")

Stash mode (Ring 9 v2) earns its **operator-facing surface**. v0.9.0 shipped the substrate — `mint_stash` / `gather` / `mint_drawer` / `cook` as MCP tools, with the agent the only reader. This patch lands the **`/stashes` inbox + per-stash detail pane** so the operator can browse what the agent has gathered and shape it (rename, archive, file into drawers, move between drawers, prune) without round-tripping back through chat. Two structural beats ride along: a **`stash_bindings` adjacency table** (many-to-many edges from a stash to a bot / app / plan / cook / contextmap node — the substrate that turns "stash inbox" into "this bot's knowledge corpus, this plan's working memory"), and **soft-delete for stash items** (an `archived_at` column on `stash_items` so the operator can prune the inbox without breaking downstream cook citations — the citable-atoms posture).

The shared posture across the surface: **structural edits ride on HTTP; content edits stay on the MCP path.** The dashboard surfaces rename / move / archive / status — operations that don't touch the per-type contract gate — while item body / metadata edits stay on the MCP `update_item` path so the gather contract has a single substrate path. Plan at [lite-template/integration/app-system/0601/STASH_VIEW_LAYER.md](../lite-template/integration/app-system/0601/STASH_VIEW_LAYER.md); supporting atomicity work (citable atoms, adjacency table, soft-delete) at [lite-template/integration/app-system/0602/STASH_RELATIONAL_ATOMS.md](../lite-template/integration/app-system/0602/STASH_RELATIONAL_ATOMS.md).

### Added

- **`/stashes` inbox** at [app/stashes/page.jsx](app/stashes/page.jsx). Row-per-stash list with status filter (open / archived / all), title-or-ref search, item + drawer counts, and hover affordances for inline rename and archive / unarchive. Backed by `GET /api/stashes` ([app/api/stashes/route.js](app/api/stashes/route.js)) — item and drawer counts are computed server-side so the inbox shows density without a second round-trip.
- **`/stashes/[ref]` detail page** at [app/stashes/[ref]/page.jsx](app/stashes/[ref]/page.jsx). Header with inline title rename + status toggle; a drawer rail with "+ New drawer" inline input, per-drawer rename, and a Root pseudo-drawer for unfiled items; an item list that dispatches on `type` — `text` / `markdown` / `image` / `svg` / `link` render in full; `script` and `pointer` fall to small stub cards (placeholders for later). Each item card carries a move-to-drawer dropdown and an archive button — the two-step `pendingConfirm` flow surfaces a warning when an item is cited by any cook.
- **Stash HTTP surface** under [app/api/stashes/](app/api/stashes/). `GET /api/stashes/[ref]` returns the full stash (drawers + items; archived items hidden by default, `?include_archived=1` surfaces them for audit views). `PATCH /api/stashes/[ref]` accepts `{ title?, status? }` for rename and archive / unarchive. Drawer routes at `POST /api/stashes/[ref]/drawers` (mint, idempotent on existing `(stash, name)`) and `PATCH /api/stashes/[ref]/drawers/[name]` (rename, clean 409 on UNIQUE collision instead of a raw SQL error). Item routes at `PATCH /api/stashes/[ref]/items/[id]` (move between drawers; `drawer: null` for root) and `POST /api/stashes/[ref]/items/[id]/archive` (soft-delete with the two-step `pendingConfirm` flow for cook-cited items, mirroring the MCP `archive_item` gate). Image bytes streamed via `GET /api/stashes/[ref]/media/[id]` ([app/api/stashes/[ref]/media/[id]/route.js](app/api/stashes/[ref]/media/[id]/route.js)) — resolves `doc_…` media refs through `DocumentRepository`, treats anything else as a literal storage key under `control/data/storage/`. The route only serves items of `type:'image'` to keep the surface narrow.
- **`stash_bindings` table** in [lib/db/index.js](lib/db/index.js) — the adjacency layer: many-to-many edges from a stash to other substrate resources. Composite primary key `(stash_id, bound_kind, bound_ref)` with `bound_kind` CHECK-constrained to `'bot' | 'app' | 'plan' | 'cook' | 'contextmap_node'`. `bound_ref` is deliberately NOT a foreign key — deletion of a bound resource leaves the binding as a "linked resource removed" chip (stashes survive the resources they're linked to). Optional `role` slot (`corpus` / `working_memory` / `ingredient` / `reference`) for downstream framing without a code change. Reverse-edge index on `(bound_kind, bound_ref)` so "stashes linked to plan X" is a cheap lookup. Purely navigational in v0 — no automatic context injection mid-conversation.
- **Soft-delete for stash items** via the `archived_at` migration on `stash_items` (`migrateStashItemColumns` in [lib/db/index.js](lib/db/index.js)). Archived rows stay in the table so cook slices and other downstream citations still resolve to last-known content (the citable-atoms posture). List reads gain an `includeArchived` flag, default false; lookups by id (`getItemById`) always return the row regardless of state — hiding archived rows is a list-view concern, not a citation concern. Hard delete remains sweep-only and never user-triggered.
- **`stashes.*` i18n namespace** in [messages/en.json](messages/en.json) — inbox strings (title / subtitle, status pills, counts, search placeholder, empty / no-match states), detail-page strings (drawer rail, item-type labels, move / archive prompts, image fallback), and an `actions` sub-namespace (rename / archive / unarchive / save / cancel + error strings).
- **Home launcher "Stash" tile** in [components/HomeLauncher.jsx](components/HomeLauncher.jsx) — new `StashIcon` (tray of layered cards) routes to `/stashes` from the home grid, sibling to the existing Research tile. `home.tiles.stash` lands in the i18n catalog.

### Changed

- **`StashRepository` grows structural verbs** in [lib/db/repositories/stashes.js](lib/db/repositories/stashes.js). `renameDrawer({ stashRef, oldName, newName })` enforces the UNIQUE collision in JS for a clean error; `moveItem({ stashRef, itemId, drawer })` validates that the target drawer belongs to the same stash before flipping `drawer_id`; `unarchive(stashRef)` flips an archived stash back to open (idempotent on open). `updateItem` re-runs the per-type contract gate against the MERGED state (existing row + patch fields) so a partial update can't corrupt the contract — type itself is intentionally NOT mutable (items are citable atoms; archive + re-gather instead). `archiveItem({ itemId })` is the idempotent soft-delete verb; `scanItemReferences(itemId)` walks `stash_cooks` slices in-process to feed the warn-and-proceed UX.
- **`StashRepository.listItems` / `countItems` gain `includeArchived`** — defaults to `false` so the inbox surfaces only live items; the explicit-opt-in flag preserves the audit path.

### Notes

- **No bot image bump.** All changes are control-plane.
- **Two additive migrations.** New `stash_bindings` table (composite PK + reverse-edge index). One new column (`stash_items.archived_at`) plus its index. No data rewrites; existing items default to `archived_at IS NULL` (i.e. live).
- **Structural edits via HTTP, content edits via MCP.** The dashboard owns rename / move / archive / status — operations that don't touch the per-type contract gate. Item body / metadata edits stay on the MCP `update_item` path so there is one substrate path through the gate. The HTTP move route deliberately exposes only the structural slice.
- **Stash bindings are navigational in v0.** `stash_bindings` rows feed operator-facing chips ("linked to bot X, plan Y") without auto-injecting context mid-conversation. The wiring surface that turns a binding into a runtime side-effect ships in a later patch when a concrete consumer demands it.

### 2026-06-01 (was "Unreleased")

The release where mojulo's deliberation rings gain an **exit door** and the operator's host agent becomes the substrate's **inference layer**. Two complementary beats run through every other thread.

**Materialization across the deliberation stack.** **Ring 8 — plan mode** seals a session into a Plan that compiles to a manifest of tool calls and executes under per-execution operator approval; when an executed manifest commits an artifact to the contextmap, a **plan→contextmap bridge** stamps a `plan_release` principle on the artifact node and archives the plan. **Ring 9 — stash mode** (the sharper-edged successor to `research_sessions`) accretes typed gathered items into renameable buckets; **cook** then takes ≥2 stashes plus an agent-authored report and materializes an **Outcome Artifact** — a self-contained folder on disk (`report.md` + `index.html` + `manifest.json` + visuals) served at `/outcomes/<cook_ref>/`, frozen to the template version it was authored against. Deliberation stops being a place where thinking accumulates and becomes one where thinking produces durable, addressable artifacts.

**Agent-as-inference, mojulo-as-porthole.** Every browser inference surface is rewired to route through the operator's host MCP agent rather than a control-plane LLM key. The **chat builder** gains an `agent` driver mode that parks each user message as a `chat_turn` task on the agent-tasks queue and awaits the host agent's envelope; the **home-page chat** parks `host_chat` turns through the same relay (`lib/agent-chat/relay.js` is the shared seam). An **agent-ui signal bus** closes the loop on both surfaces — the fulfilling worker narrates progress (`emit_chat_signal`) and raises structured decisions (`request_chat_decision`) mid-turn, rendered as inline cards the operator answers without leaving the chat.

Three supporting threads ride alongside. The **app-runtime substrate** promotes from in-process singleton to a standalone `mojulo-app-runtime` daemon (and a unified `mojulo-daemons` host that co-manages the scheduler too) that reconciles pidfiles + inventory on boot — killing the orphan-row `UNIQUE` collision the v0 could hit after a restart. **Connected Services (Phase 1)** canonizes the agent-layer-solution paradigm via `declare_skills` (host-side skill mirror) and projects skills ∪ materialized mcp-orbit compositions through a single canonical loader, surfaced as list / detail / graph views at `/mcp-skills` and a live fleet topology at `/map`. And the **sketchbook** earns folders, SVG export, diff, and an auto-mint posterity link from plan compile and stash cook; a new **Rendrant** layer (a polygonizer + neo-rembrandt rendering engine) ships inside the sketchbook as a planning tool the agent uses to draft visuals — treated as scratch, not substrate.

Two structural refinements: **`forward_context` becomes a thin routing index** (~1.4K tokens) with the heavy briefing drawerized behind five new Ring 0 sibling tools — `get_tool_index` / `get_register_kit` / `get_deliberation_overview` / `get_ui_map` / `get_substrate` — so a connecting agent pays each slice of context only when a task needs it. And the **`initialize` preamble** is rewritten to name the three creatable artifacts (Bot / Connected Service / App) with their entry tools, so a connecting agent self-routes from `tools/list` without drilling further.

The load-bearing posture across plan mode, stash/cook, and Connected Services: **mojulo's deliberation surfaces own different temporal postures, and the storage shape follows the posture.** A Plan is pre-reality (sibling `plans` table); a Stash is collected-but-not-yet-thought (sibling `stashes` + gathered-items tables); a Cook is a thought that produced a document (sibling `cooks` table + filesystem folder under `data/outcomes/`); a Skill is present-environment owned by the host (replace-semantic `meta_skills` mirror). None are contextmap commits; all sit *beside* it deliberately. The contextmap remains the sealed audit chain.

### Added — Ring 8 (plan mode)

- **Plan-mode tool family** at [lib/mcp/tools/plan-mode.js](lib/mcp/tools/plan-mode.js): `enter_plan_mode` / `forge_plan` / `revise_plan` / `compile_plan` / `execute_plan` / `list_plans` / `get_plan`. The **proposed** layer of the deliberation model. `enter_plan_mode` returns the deliberation discipline (the four lenses held loosely — spike / segment-expansion / vertical-reinforcement / collider; the shadow-scratchpad step-0 where the agent drafts but never fires tool calls; introspection-on-signal; the frame-for-approval). `forge_plan` seals a Draft from a session (`{ title, goal, lens?, frame?, manifest?, analysis? }`); `revise_plan` appends to the revision log and resets status to `draft` (touching the schematic un-commits the compile). `compile_plan` is a **compile step, not a status flip** — it validates the manifest against the live tool registry; tractable (→ `actionable`) iff every call resolves to a shipped tool, else stays `draft` with a structured `unknown_tools` / `illegal_tools` / `errors` reason. `execute_plan` is the **per-execution gate** (requires `confirm:true` + status `actionable`), re-validates, runs each call in order through the same handler path a remote `tools/call` hits, and stops on first failure (completed steps recorded, plan marked `failed` for re-forge; full success → `executed`). Registered after Ring 7; indexed in [lib/mcp/tools/context.js](lib/mcp/tools/context.js).
- **`plans` table** in [lib/db/index.js](lib/db/index.js) (repository at [lib/db/repositories/plans.js](lib/db/repositories/plans.js)) — `status` (draft → actionable → executing → executed/failed), `seen` inbox flag, `lens` CHECK column, JSON columns `frame_json` / `manifest_json` / `analysis_json` / `revision_log_json` / `execution_log_json`. Migration-added columns: `archived` / `archived_at` / `release_json` (close-the-loop), `sketch_ref` / `sketch_pinned` (diagram posterity). Sibling table — not a contextmap commit type.
- **Plan→contextmap close-the-loop bridge** at [lib/mcp/meta-context/plan-release.js](lib/mcp/meta-context/plan-release.js). When `execute_plan` runs a manifest that contains an artifact-creating `meta_context_commit` (`app_materialization` / `primitive_artifact_materialization` / `artifact_materialization`), execute_plan detects the resulting `artifactNodeId` and calls the bridge: a `plan_release` principle is timestamped on each materialized artifact node's subhistory, and the plan is **archived** (`archived` is orthogonal to `status` — an archived plan stays `executed`; `release_json` carries the bidirectional link). Trigger binding does **not** archive. Release-recording is soft — a failure surfaces as `release_warning`, never failing a successful execution. Coupling is one-way: plan mode imports the bridge; the contextmap never imports plan mode.
- **Direct tool-invocation seam** in [lib/mcp/server.js](lib/mcp/server.js): `hasRegisteredTool(name)`, `listRegisteredToolNames()`, and `invokeRegisteredTool(name, input, context)`. The compile validator checks each manifest call against `hasRegisteredTool`; the executor runs the manifest through `invokeRegisteredTool`, bypassing JSON-RPC framing so executed plans behave identically to operator-typed calls.
- **Plan inbox page** at [app/plan/page.jsx](app/plan/page.jsx) — read-only list + detail view (status/lens chips, goal, frame + discarded lenses, manifest, revision log, execution log, release link, diagram link with "Pinned" badge) served by [`/api/plans`](app/api/plans/route.js) + [`/api/plans/[ref]`](app/api/plans/[ref]/route.js). Semi-hides archived plans behind a "Show archived" toggle. New Plan opens a modal with a paste-able host-agent starter prompt. New `plan.*` i18n namespace.
- **Plan-mode diagram posterity** in [lib/mcp/tools/plan-mode.js](lib/mcp/tools/plan-mode.js). `compile_plan` auto-mints a pipeline diagram of the compiled manifest and links it on the plan (`sketch_url` in the response) — unless the operator pinned a hand-authored sketch. `forge_plan` / `revise_plan` accept an optional `sketch_ref` to pin a `sk_<…>` sketch; pass an empty string on revise to clear the pin. Auto-mint is **soft-fail** — a sketch hiccup surfaces as `sketch_warning`, never failing a successful compile. `PlanRepository.setSketchRef()` + pin-aware `forge` / `revise` paths added in [lib/db/repositories/plans.js](lib/db/repositories/plans.js).

### Added — Ring 9 (stash mode + cook + Outcome Artifacts)

- **Stash-mode tool family** at [lib/mcp/tools/stash-mode.js](lib/mcp/tools/stash-mode.js): `mint_stash` / `gather` / `mint_drawer` / `rename_stash` / `list_stashes` / `get_stash`. A **Stash** is a renameable user-facing bucket with optional Drawers; **gather** is the verb that mints typed items into it. Seven item types — `text` / `markdown` / `image` / `svg` / `script` / `pointer` / `link` — each with a required-per-type contract validated at intake. The contract is what lets the UI dispatch on type and Cook treat items as ingredients. Coexists with the legacy `research_*` tools (migration option 3 — legacy data untouched; new gatherings land here).
- **Cook tool family** at [lib/mcp/tools/cook.js](lib/mcp/tools/cook.js): `cook` / `get_cook` / `list_cooks`. The **multi-input collider** on Stashes — takes ≥2 ingredients (≥1 stash + 1 user query, optional additional stashes + optional MCP `additional_context` the agent looped in) and materializes an Outcome Artifact. **Authoring model: the agent authors `report.md` (and provides visuals); cook just materializes the folder.** No server-side LLM call. Cook does NOT compile, NOT execute, and NOT flip a status flag — it writes a row + a folder, returns the URL, and is done. **Cook stops at cook** — there is no cook outlet to plan mode; if a cook outcome later reads as tractable work, plan mode pulls it via `forge_plan({ source: { kind: 'cook', cook_ref } })` (plan-side decision, made later — see the Cook→plan bridge entry below).
- **Outcome Artifact writer** at [lib/outcomes/write.js](lib/outcomes/write.js) (+ [markdown.js](lib/outcomes/markdown.js) and the HTML template). Materializes a Cook under `data/outcomes/<cook_ref>/` as a self-contained folder: `report.md` (the load-bearing artifact), `index.html` (static doc, all visuals inlined or referenced), `manifest.json` (machine-readable index recording the template version), and any `*.svg` / `*.png` the agent provided. Strictly static — no JS framework, no client-side rendering — so the folder can be opened directly from disk, served via the `/outcomes/<ref>/` route, or zipped and emailed.
- **Outcome serve route** at [app/outcomes/[...slug]/route.js](app/outcomes/[...slug]/route.js) — `GET /outcomes/<cook_ref>/[...path]` streams files from the outcome folder. Bare URL resolves to `index.html`. Strictly static — no React, no app shell. Path-traversal hardening: each segment is validated as a safe filename, and the resolved path is asserted to live within the outcomes base directory.
- **`stashes` + `cooks` repositories + tables** in [lib/db/index.js](lib/db/index.js) ([lib/db/repositories/stashes.js](lib/db/repositories/stashes.js), [lib/db/repositories/cooks.js](lib/db/repositories/cooks.js)). Stashes hold renameable buckets with optional drawers + typed gathered items; cooks record the multi-input materialization (slices, aim, agent-authored report, suggested lens, visuals manifest). Additive migrations; both are sibling tables, not contextmap commit types.
- **Ring 9 v1 — research mode (legacy path)** at [lib/mcp/tools/research-mode.js](lib/mcp/tools/research-mode.js): `enter_research_mode` / `start_research` / `bind_research_item` / `synthesize_abstract` / `get_research` / `list_research`. The original accretive layer (links / articles / summaries / screencaps / notes / quotes / snippets) plus `synthesize_abstract` distilling the book into a thesis. With `evaluate:true` it sends the thesis to plan mode via the **research→plan bridge** ([lib/research/evaluate.js](lib/research/evaluate.js), surfaced over HTTP at `POST /api/plans/from-abstract`); a Draft plan is forged only when the agent's `recommendation === 'forge'`. Ships in this entry but is now the legacy v1 path — stash/cook is the v2 path for new gatherings.
- **Ring 9 v1 tables** in [lib/db/index.js](lib/db/index.js) (repository at [lib/db/repositories/research.js](lib/db/repositories/research.js)) — `research_sessions`, `research_items`, `research_abstracts` (with a migration-added `sketch_ref` column for diagram posterity).
- **Research inbox page** at [app/research/page.jsx](app/research/page.jsx) — read-only list + notebook view served by `GET /api/research` + `/api/research/[ref]` ([app/api/research/](app/api/research/)). Items grouped by kind with optional source links and sketch links; abstracts with optional plan / sketch links. "+ New book" opens a host-agent starter-prompt modal. New `research.*` i18n namespace.
- **Stash / research diagram posterity.** `synthesize_abstract` auto-mints a hub-spoke diagram of the book (items → thesis) attached to each append-only abstract snapshot (`sketch_url` in the response, surfaced in the `/research` pane); soft-fail, same posterity posture as plan compile. The cook path mints the equivalent diagram for its ingredients → aim. `bind_research_item` gains a `sketch` item kind for pinning an existing `sk_<…>` diagram into a book via `media_ref`.

### Added — Cook→plan bridge (research path convergence)

- **`forge_plan` accepts `source: { kind: 'cook', cook_ref }`** in [lib/mcp/tools/plan-mode.js](lib/mcp/tools/plan-mode.js) — the plan-side cook→plan bridge. When a cook outcome later reads as tractable work, the agent seeds a Draft plan from it: the cook's `aim` becomes the seeded goal (overridable via the top-level `goal` arg), its `suggested_lens` becomes the seeded lens, and the source ref is recorded in `analysis.source` for the triangle backlink (stash → cook → plan). `goal` is now optional when a source is supplied; either path must produce one. The discriminator (`PLAN_SOURCE_KINDS`) is forward-compatible — future source kinds (`'stash'`, `'sketch'`, …) follow the same shape. Replaces the never-built `synthesize_abstract({ from_cook })` slice 3 path.
- **Cook stops at cook.** The `cook` tool gains a "**no outlet, cook is a node**" framing across [lib/mcp/tools/cook.js](lib/mcp/tools/cook.js) — header doc, tool description, the success message, and the `get_cook` / `list_cooks` descriptions all teach the new mental model: cook materializes one outcome and is done; any ring (plan via `forge_plan` source, future audit/compose/brief surfaces) reads the cook node and acts on it. The substrate-vibe replacement for a `cook({ outlet: 'plan' })` shape that was never going to exist.
- **`RESEARCH_BRIEF` rewrite** in [lib/mcp/tools/research-mode.js](lib/mcp/tools/research-mode.js) — `enter_research_mode` now teaches the "Cook stops at cook" subsection with an explicit anti-pattern callout ("Don't look for a `cook({ outlet: 'plan' })` shape. It doesn't exist on purpose."). The Gather/Stash section is sharpened from "coexists with the legacy book" to **"prefer Gather/Stash for new gatherings"** — the typed-intake path is the only one Cook collides and the only one that lands as a first-class deliberation node other rings can read.
- **`forward_context` routing updated** in [lib/mcp/tools/context.js](lib/mcp/tools/context.js) — the `ROUTING_INDEX` "gather / research broadly" row nudges new gatherings toward `mint_stash` → `gather` → optional `cook`, and names the `forge_plan({ source })` bridge inline. The `TOOL_INDEX` entry for `forge_plan` advertises the new `source?` parameter.
- **Research path convergence plan** at [../lite-template/integration/app-system/0601/RESEARCH_PATH_CONVERGENCE.md](../lite-template/integration/app-system/0601/RESEARCH_PATH_CONVERGENCE.md) — sequencing for the larger Book→Stash collapse (legacy alias layer + read-projection + `/research` → `/stashes` redirect + streaming notebook + triangle backlinks). Substrate-side bridge ships this entry; the alias/projection layer is a follow-up.

### Added — Agent-as-inference porthole

- **Builder driver mode** — the chat builder web UI can now be driven by the operator's own agent rather than the control plane's own Claude loop. When `builderDriverMode === 'agent'`, the `/chat-builder` SSE endpoint parks each user message as a `chat_turn` task on the agent-tasks queue and awaits the agent's envelope, resolving it back over the same SSE event vocabulary the self-hosted loop uses — the browser UI is unchanged. A new **Builder** tab in [app/settings/page.jsx](app/settings/page.jsx) (`BuilderModeSection`) lets the operator toggle the mode and shows a live worker-liveness indicator. API at [app/api/settings/app/route.js](app/api/settings/app/route.js). In `self-hosted` mode the existing control-plane Claude loop runs unchanged; the 409 LLM-key guard now applies only to non-agent mode so agent mode never requires a control-plane API key.
- **`app_settings` table + `AppSettingsRepository`** in [lib/db/index.js](lib/db/index.js) / [lib/db/repositories/appSettings.js](lib/db/repositories/appSettings.js) — key/value store for single-user control-plane preferences. Absence of a key IS its fresh-install default (resolved in the repository, no seed row). First use: `builderDriverMode` (`'agent'` | `'self-hosted'`).
- **`chat_turn` task kind** in [lib/mcp/tools/agent-tasks.js](lib/mcp/tools/agent-tasks.js) — sibling to `envelope_inference`. Rides `submit_envelope_inference` (both are envelope-shaped); the `pull_agent_task` tool gains an optional `kinds` filter so a specialized chat-builder worker can claim only `chat_turn` tasks. `chat_turn` submits do **not** write a contextmap principle. Claude Code headless adapter gains `chat_turn` support with its own `CHAT_TURN_SYSTEM_PROMPT` and `buildChatTurnUserPrompt()` (conversational relay: history + locale + `inputs.text`; answer goes in the `answer` envelope field).
- **`run-chat-builder-worker` catalyst** at [lib/mcp/catalysts/run-chat-builder-worker.md](lib/mcp/catalysts/run-chat-builder-worker.md) — operating instructions for running the chat-builder worker loop (`pull_agent_task({ kinds: ['chat_turn'] })` → answer → `submit_envelope_inference`). Designed to pair with `/loop` so the web chat is live whenever the operator is in the terminal. Includes a "Talking to the operator mid-turn" section documenting `emit_chat_signal` and `request_chat_decision`.
- **Home-page chat porthole** — the home page hosts a second chat window that talks directly to the operator's host agent (no builder persona, no protocol framing — full toolset). Backed by a new `host_chat` task kind in [lib/mcp/tools/agent-tasks.js](lib/mcp/tools/agent-tasks.js) + the [app/api/agent-chat/stream/route.js](app/api/agent-chat/stream/route.js) SSE route. Paired with the **`run-host-chat-worker` catalyst** at [lib/mcp/catalysts/run-host-chat-worker.md](lib/mcp/catalysts/run-host-chat-worker.md). "A porthole straight to you" is the framing — sibling to the chat builder, without the builder framing.
- **Shared agent-chat relay** at [lib/agent-chat/relay.js](lib/agent-chat/relay.js) — the common body the chat builder (`chat_turn`) and home-page chat (`host_chat`) share. Both subscribe the open SSE stream to the agent-ui signal bus for the turn, park the turn, stream the answer back, and unsubscribe. What differs — session bookkeeping, audit, the `done` payload — is injected via callbacks so neither surface leaks into the other.
- **`HomeLauncher` component** at [components/HomeLauncher.jsx](components/HomeLauncher.jsx) — extracted home-page launcher (6-tile grid + agent status footer) so the home page can host both the launcher and the home-chat porthole side by side.
- **Agent-ui signal bus** at [lib/agent-ui/signal-bus.js](lib/agent-ui/signal-bus.js) — in-memory pub/sub keyed on the builder `sessionId` (`subscribe` / `publish` / `hasSubscriber`) plus a pending-decision registry for the reverse operator→agent path (`createDecision` / `resolveDecision` / `awaitDecision` / `disposeDecision`). Decisions auto-expire after a 10-min TTL kept deliberately under the parked turn's HTTP timeout so a stuck decision settles as `expired` before the parked HTTP does. Bus events are shaped to the existing builder SSE `EventTypes` so subscribers forward them verbatim; settled decisions are GC'd 60s after settling. In-memory only — a control-plane restart drops subscribers and settles outstanding decisions as expired.
- **MCP Ring 7 — agent-ui tools** at [lib/mcp/tools/agent-ui.js](lib/mcp/tools/agent-ui.js): `emit_chat_signal` (fire-and-forget narration — `kind:'note'` → a `text` delta into the reply bubble, `kind:'phase'` → a `modulo_expression` avatar state; returns `{ delivered }` so the worker stops emitting once the stream is closed) and `request_chat_decision` (publishes a `decision` event the UI renders as an inline card, then long-polls up to `wait_ms` ≤45s; returns `answered` / `waiting` / `expired` / `no_listener`). Both take the builder `session_id` from the pulled task's `caller_ref.sessionId`; only the interactive MCP-connected worker can call them (the headless node-fulfiller has no MCP connection).
- **`/api/agent-ui/respond` route** at [app/api/agent-ui/respond/route.js](app/api/agent-ui/respond/route.js) — the reverse path. Browser-facing (same-origin, session-cookie auth via `getCurrentUser`, unlike the bearer-gated agent surface); POSTs the operator's `{ selected | text }` answer, resolves the pending decision in the signal bus, and unblocks the worker's `request_chat_decision` long-poll. Guards that the posting session owns the decision's `sessionId`.
- **`DecisionCard` + `respondToDecision`** — [components/ModularChat/DecisionCard.jsx](components/ModularChat/DecisionCard.jsx) renders a mid-turn decision (options and/or a free-text input), then disables and shows the chosen value once answered. [hooks/useModularStream.js](hooks/useModularStream.js) gains a `decision` event handler (new `MESSAGE_TYPES.DECISION`) and the `respondToDecision(promptId, answer)` action (optimistic answer with rollback on a failed POST); [InvertedModularChatPanel.jsx](components/ModularChat/InvertedModularChatPanel.jsx) wires the card into the grouped-message renderer.

### Added — App-runtime daemon

- **App-runtime daemon** at [lib/runners/daemon/server.js](lib/runners/daemon/server.js) and engine at [lib/runners/engine.js](lib/runners/engine.js). The runner engine moves out of the control plane's process into a standalone loopback-HTTP daemon gated by `MOJULO_APP_RUNTIME=enabled`. On boot the daemon **reconciles** ([lib/runners/daemon/reconcile.js](lib/runners/daemon/reconcile.js)): for each per-app pidfile (`~/.mojulo/app-runtime/runs/<ref>.json`) it adopts (sidecar still answers) or sweeps (dead), and sweeps inventory rows whose `running_ref` has no pidfile — killing the orphan-row `UNIQUE(server, tool_name)` collision from the in-process v0. SIGTERM + SIGINT drain in-flight starts before exiting. Phase 2 (launchd/systemd keep-alive) is deferred. See [docs/app-runtime.md](docs/app-runtime.md).
- **`mojulo-app-runtime` bin** in [bin/app-runtime.mjs](bin/app-runtime.mjs) — registered in `package.json`'s `bin` field alongside `mojulo` / `mojulo-config` / `mojulo-ui`. `MOJULO_APP_RUNTIME=enabled npx mojulo-app-runtime` starts the daemon; without the flag the bin is a no-op. The control plane never auto-spawns the daemon; if the daemon is down, `start_app`/`stop_app` throw a clear `AppRuntimeUnavailableError` pointing to the bin.
- **Unified runtime daemon host** at [lib/daemons/server.js](lib/daemons/server.js) and new **`mojulo-daemons` bin** in [bin/daemons.mjs](bin/daemons.mjs). Co-hosts the app-runtime daemon and the scheduler daemon under one loopback HTTP server so a single process manages all runtime side-effects. Gated by `MOJULO_DAEMONS=enabled`; per-daemon gates `MOJULO_APP_RUNTIME` / `MOJULO_TRIGGER_RUNTIME` default to enabled inside the host. The host exposes `/health`, `/daemons` (list), `/daemons/:name/status`, and `/daemons/:name` (POST start / stop / restart). Client at [lib/daemons/client.js](lib/daemons/client.js) reads the runtime port + bearer from `~/.mojulo/daemons/{port,bearer}` written by the host on boot; `bestEffortDaemonReload(name)` sends a reload signal without throwing if the host is down. The standalone `mojulo-app-runtime` bin remains for operators who don't want the scheduler co-hosted; the in-process scheduler fallback also remains.
- **MCP Ring 7 — daemon lifecycle tools** at [lib/mcp/tools/runtime-daemons.js](lib/mcp/tools/runtime-daemons.js): `list_daemons`, `status_daemon`, `start_daemon`, `stop_daemon`, `restart_daemon`. Thin client over the unified daemon host. Registered between the runner tools and agent-tasks tools so the natural Ring 7 reading order is app lifecycle → daemon host lifecycle → agent-tasks. `list_daemons` degrades gracefully when the host is down (returns `[]`).

### Added — Connected Services (Phase 1)

- **`declare_skills`** at [lib/mcp/tools/skills.js](lib/mcp/tools/skills.js). The mirror entry point for the **Skill** member of the Connected Services paradigm: a workflow synthesized into the host adapter (`.claude/skills/<name>/SKILL.md`) that the host owns and mojulo only reflects for observation — it never writes to the host. Replace-semantic, agent-declared, sibling to `meta_context_declare_inventory` (declares the MCP servers each skill `calls`, resolved against declared inventory to mark wired vs missing, plus any unbound capability `needs`).
- **`meta_skills` table** in [lib/db/index.js](lib/db/index.js) (repository at [lib/db/repositories/skills.js](lib/db/repositories/skills.js)) — replace-semantic mirror of host skills: `ref` (deterministic from `host_path` so re-mirroring is idempotent), `name`, `description`, `host_path`, `host_adapter`, `catalyst_id` (lineage if synthesized from a catalyst), `calls_json`, `needs_json`, `mirrored_at`. `declare()` is a DELETE-all + INSERT-set transaction.
- **Connected Services loader** at [lib/connected-services/loader.js](lib/connected-services/loader.js): `listConnectedServices()` / `getConnectedService(ref)`. The **canonical union view** — projects the skills mirror (kind `skill`) ∪ materialized mcp-orbit compositions (kind `mcp_solution`) into one shape, resolving each service's `calls` against the current MCP inventory (wired vs missing). Uncapped reads straight from the repositories, same posture as [lib/apps/loader.js](lib/apps/loader.js). The contract every downstream viewer consumes; defined here and projected, never redefined downstream.
- **Connected Services list / detail APIs** at [app/api/connected-services/route.js](app/api/connected-services/route.js) (list) and [app/api/connected-services/[ref]/route.js](app/api/connected-services/[ref]/route.js) (detail) — HTTP-facing projection of the canonical loader.
- **Connected Services topology** at [lib/graph/derivers/connected-service.js](lib/graph/derivers/connected-service.js) + [lib/graph/layout/connected-service.js](lib/graph/layout/connected-service.js) — pure projection from a canonical service shape into a `{ nodes, edges }` topology rendered through the existing `CreationMap`. Used by the per-service `/graph` view.
- **`/mcp-skills` surface.** [app/mcp-skills/page.jsx](app/mcp-skills/page.jsx) is the list view; [app/mcp-skills/[ref]/page.jsx](app/mcp-skills/[ref]/page.jsx) is the per-service detail pane; the per-service graph at `[ref]/graph/` renders the topology via the new deriver + layout pair. The previous Coming Soon stub graduates into the live Connected Services viewer.
- **Fleet scene + Map view** — a live topology of the full connected workspace. [lib/fleet-scene/loader.js](lib/fleet-scene/loader.js) assembles the view model (apps, bots, declared MCP servers, Connected Services) from existing repositories with no new DB I/O. [lib/graph/derivers/fleet-scene.js](lib/graph/derivers/fleet-scene.js) projects to a `{ nodes, edges }` topology (four existing station kinds: apps → `filesystem`, bots → `db_row`, servers → `mcp_tool`, services → `input`; framing-gated edge kinds: `exposes` for the stratified `/map` view, `exposes` + `calls` for the bipartite per-service web). Layout via the new slot-based [lib/graph/layout/](lib/graph/layout/) pass. Renders at [app/map/page.jsx](app/map/page.jsx) through the existing `CreationMap`; API at [app/api/connected-services/graph/route.js](app/api/connected-services/graph/route.js) with `?framing=map`. Read-on-refresh; nothing persisted.

### Added — Sketchbook (the planning surface, scratch)

- **Sketch folders** — [lib/db/repositories/sketch-folders.js](lib/db/repositories/sketch-folders.js) + a `folder_ref` column on `sketches`. Folders are a flat scratch-grouping over sketches; no nesting. APIs at [app/api/sketches/folders/route.js](app/api/sketches/folders/route.js) (list + create) and [app/api/sketches/folders/[ref]/route.js](app/api/sketches/folders/[ref]/route.js) (single fetch + delete), plus [app/api/sketches/move/route.js](app/api/sketches/move/route.js) for moving a sketch between folders. Per-folder sketch counts shown as badges so the operator can see folder density at a glance.
- **SVG export** at [app/api/sketches/[ref]/svg/route.js](app/api/sketches/[ref]/svg/route.js) — renders the stored manifest to a fully self-contained `.svg` via `CreationMap` + `renderToStaticMarkup`. CSS custom properties are resolved to literal hex/families so the file is portable to vector tools and image viewers that don't honor `var(...)`. `?inline=1` serves inline instead of forcing a download.
- **Sketch diff** at [lib/graph/sketch-diff.js](lib/graph/sketch-diff.js) — pure derived visual diff of two sketch manifests (no DB, no MCP, no renderer dependency). Exposed via the **`diff_sketches`** MCP tool — the agent reads two sketches, the tool returns a third manifest highlighting added / removed / changed / moved / unchanged stations, then persists through the normal sketchbook path.
- **Sketch vocab catalog** at [lib/graph/sketch-vocab/](lib/graph/sketch-vocab/) — markdown specs for each chart kind (`donut-ring`, `grid-layout`, `map-boundary`, `pipeline`, `stacked-bar`, `stat-tile`, `z-layering`). Loader at [lib/graph/sketch-vocab/loader.js](lib/graph/sketch-vocab/loader.js) feeds two consumers: the **`get_sketch_vocab`** MCP tool (the agent fetches vocab on demand rather than memorizing it) and a new `sketch_vocab` kind in `semantic_search` so the agent can pull the right vocab by intent.
- **Deterministic sketch derivation** at [lib/graph/sketch-derive.js](lib/graph/sketch-derive.js) — pure functions (no DB, no LLM) that turn structure into a sketch manifest: `planToSketchManifest` draws a compiled plan as a left→right pipeline (goal `input` station → one `mcp_tool` station per manifest call, chained in order), `researchToSketchManifest` draws a research / cook book as a hub-spoke (each bound item is a spoke feeding the central thesis `db_row`, capped at the 24 most recent with a "+N earlier" note). Emits the same manifest shape `validateSketchManifest` accepts and `/sketches/<ref>` renders. Coupling stays one-way — plan / research / cook import this + the sketch persister; sketches never import them.
- **`mintSketch()` shared persist seam** in [lib/mcp/tools/sketches.js](lib/mcp/tools/sketches.js) — the validate-and-store core (returns `{ ok, ref, url }`) extracted out of `createSketchHandler` so the plan-mode / stash-mode auto-mint path gets the same validation + ref + URL shape as a hand-authored `create_sketch`. `createSketchHandler` now wraps it.
- **Rendrant — the agent's visual planning layer** at [lib/graph/polygonizer/](lib/graph/polygonizer/) + [lib/graph/neo-rembrandt/](lib/graph/neo-rembrandt/) + [app/api/polygonizer/route.js](app/api/polygonizer/route.js). The agent describes a visual intent; Rendrant returns a sketch manifest (constellation grid + depiction layout + recipe compiler + neo-rembrandt rendering passes for cuboids, perspective, palette). Shipped as a **planning tool inside the sketchbook** — the manifests it produces are stored as ordinary sketches and treated as scratch. Not part of the deliberation rings.

### Added — Ring 0 drawer tools

- **Ring 0 drawer tools** in [lib/mcp/tools/context.js](lib/mcp/tools/context.js): `get_tool_index` / `get_register_kit` / `get_deliberation_overview` / `get_ui_map` / `get_substrate`, registered as siblings right after `forward_context`. `forward_context` becomes a **thin routing index** — a lean opener, a `user-framing → entry-tool` table (`ROUTING_INDEX`), a directory of the drawers, and the standing safety + commitment rules. The heavy content moves into the drawers, each pulled on demand: `get_tool_index` (the full one-line-per-tool `TOOL_INDEX` across every ring), `get_register_kit` (the concept glossary in the operator's active `vocabulary_register` + the disclosure directive + the commitment-level floor — the vocabulary now lives here, optional per-call `register` / `disclosure` override), `get_deliberation_overview` (the Ring 6 structural model + daemon runtime-gating posture), `get_ui_map` (the `mojulo-ui` dashboard page map), `get_substrate` (the PLAYful Cloud positioning). "Index, not glossary" is load-bearing — the glossary, lifecycle prose, and substrate philosophy stay out of the `forward_context` body.

### Added — Dev tooling

- **`gen-app.js` scaffold script** at [scripts/gen-app.js](scripts/gen-app.js) — generates a minimal mojulo app wired to one primitive end-to-end via agent-routed inference, with no hosted LLM API key required (the Claude Code agent is the inference engine via the `run-inference-worker` catalyst). Accepts `--name <slug>`, `--primitive <type>` (`document-store` / `structured-record-store` / `messaging-channel` / `message-thread`), `--out <dir>`, and `--wire` (bakes `MOJULO_CONTROL_PLANE_URL`/`KEY` into the app's `.env` from the current process env). Dev / onboarding tooling; not part of the shipped runtime package.
- **`find-unused-locale-keys` dev tooling** — repo-side garbage collector for the i18n catalog: [scripts/find-unused-locale-keys.mjs](scripts/find-unused-locale-keys.mjs) (conservative static analysis of next-intl translator usage — protects dynamically-built key prefixes, zero false positives by design) driven by the `/find-unused-locale-keys` skill. Reports first; deletes from `en.json` only on confirmation, then `/sync-locales` propagates the removals. Dev-only; not part of the shipped runtime.

### Changed

- **`LocalRunner` promoted to daemon client** in [lib/runners/local.js](lib/runners/local.js) — lifecycle verbs (`start` / `stop` / `status` / `list`) now proxy to the standalone app-runtime daemon over loopback HTTP, reading the daemon's `port` + `bearer` from `~/.mojulo/app-runtime/{port,bearer}` before each call. Env CRUD (`listEnv` / `setEnv` / `deleteEnv`) deliberately stays local — pure `.env` filesystem work with no shared runtime state. Reads degrade gracefully when the daemon is unreachable (`list_running → []`, `status_app → 'unknown'`); writes throw `AppRuntimeUnavailableError`.
- **`pull_agent_task` kinds filter** in [lib/mcp/tools/agent-tasks.js](lib/mcp/tools/agent-tasks.js) — optional `kinds: string[]` input. Enables specialized workers (chat-builder claims `chat_turn`; host-chat claims `host_chat`; inference claims `envelope_inference`) without task-kind collisions.
- **`submit_envelope_inference` services `chat_turn` + `host_chat`** — `ENVELOPE_SHAPED_KINDS` set grows; both new kinds skip principle recording (run-rate conversational turns, not structural outcomes).
- **`chat_turn` + `host_chat` skip principle recording in node-fulfiller** in [lib/agent-tasks/node-fulfiller.js](lib/agent-tasks/node-fulfiller.js). The fulfiller gates `recordInferenceOutcome` on the task kind, matching the existing gating in the MCP submit handler.
- **MCP server tool registration order** in [lib/mcp/server.js](lib/mcp/server.js) — `registerSkillsTools()` slots immediately after inventory; `registerAgentUiTools()` slots immediately after the agent-tasks tools (the chat worker's narration + decision surface, keeping the Ring 7 reading order pull → submit → cancel → emit → decide); `registerPlanModeTools()` slots after Ring 7; `registerResearchModeTools()` / `registerStashModeTools()` / `registerCookTools()` slot after plan mode (v1 then v2; research forges Draft plans, so plan tools exist first).
- **`runAgentChatTurn` subscribes the open SSE stream to the signal bus** in [app/api/builder/stream/route.js](app/api/builder/stream/route.js) and the shared [lib/agent-chat/relay.js](lib/agent-chat/relay.js) — for the duration of the turn, worker narration + decision prompts forward verbatim to the browser over the same `EventTypes`; unsubscribed in a `finally` before the controller closes. The parked turn's `submitTimeoutMs` is widened 180s → 900s (15 min) so the parked HTTP outlives an in-flight decision (10-min TTL) rather than expiring under the operator mid-choice.
- **`meta_context_brief({kind:'fleet'})` gains Ring 8 plan summary** — plan count by status appended to the fleet brief so the agent gets a lightweight signal about pending plans without a separate `list_plans` call.
- **`bind_trigger` / `unbind_trigger` dual-signal scheduler reload** in [lib/mcp/tools/mcp-trigger-binding.js](lib/mcp/tools/mcp-trigger-binding.js). Both handlers now call `signalSchedulerReload()` which fires both the in-process `requestSchedulerReload()` (effective when the control-plane hosts the scheduler) and `bestEffortDaemonReload('scheduler')` on the unified daemon host. Best-effort — if the daemon host is down the signal is a no-op and the binding row remains durable for the next boot.
- **Agent-tasks puller liveness signals** in [app/api/agent-tasks/status/route.js](app/api/agent-tasks/status/route.js). The status endpoint surfaces `waitingPullers`, `recentPullCount`, and `lastPullAt` alongside the existing `pendingCount` / `inFlightCount` / `fulfiller`. The `BuilderModeSection` worker-liveness indicator reads all three fields to show "live" only when a real puller is connected, not just the background daemon.
- **`CreationMap` clickable nodes and layer ordering** in [components/graph/CreationMap.jsx](components/graph/CreationMap.jsx). New `onNodeClick` prop — when a station carries `href` and `onNodeClick` is provided, the station renders as an accessible link. Layer ordering: stations are stable-sorted by `layer` before paint so `layer:'air'` stations always render above `layer:'ground'` — keeps `/graph` and `/sketches` pixel-identical while the fleet scene's two-plane layout paints correctly. New `elevation` SVG filter for air-layer stations.
- **Bots page deep-link from map** in [app/bots/page.jsx](app/bots/page.jsx). The page reads `?id=` from the query string and pre-selects that deployment in the detail pane as soon as the `/api/deployments` list resolves. Enables `/map` bot nodes to carry `href=/bots?id=<deployment_id>` and deep-link straight to the detail pane.
- **`isSchedulerRunning()` exported** from [lib/triggers/scheduler.js](lib/triggers/scheduler.js) — returns the boolean `started` flag. Consumed by the unified daemon host to surface scheduler status in `status_daemon` responses; also useful for health checks.
- **`InventoryRepository.listAppRunningRefs()`** added in [lib/db/repositories/mcp-inventory.js](lib/db/repositories/mcp-inventory.js) — returns the distinct `running_ref`s that currently have app inventory rows, each with server name + tool count. Consumed by the daemon's reconcile-on-boot to decide adopt vs sweep.
- **`principle-embeddings.js` extracted** from [lib/mcp/tools/meta-context.js](lib/mcp/tools/meta-context.js) into [lib/mcp/meta-context/principle-embeddings.js](lib/mcp/meta-context/principle-embeddings.js) — the async pre-embedding pass (batch distinct bodies before the sync transaction) now lives alongside the plan-release bridge rather than inline in the commit handler.
- **Rendrant guide-bound cuboids** in [lib/graph/neo-rembrandt/index.js](lib/graph/neo-rembrandt/index.js) — guide-binding for shelves and datacenter rows so cuboids snapped to constellation guides don't flare open. The opt-in `solidProjectionMode: "constellation-hit-cuboid"` resolves the eight named CCA hit points first and then skins the six cuboid faces from that coordinate lattice. Focused coverage in `index.test.js` guards structural guide binding, top guide binding, no-flare paired-edge propagation, and hit-point-first face skinning. (Internal to the sketchbook's planning layer; not part of the substrate.)
- **Branding: "Mojulo-Lite" → "Mojulo"** throughout source code. Comments, user-facing strings, auth service email (`local@mojulo`), MCP session binding workspace name ("Mojulo Control"), builder system prompt, deploy route comment, doc-string references updated. No functional change.
- **`initialize` preamble rewritten** in [lib/mcp/server.js](lib/mcp/server.js) — `SERVER_INSTRUCTIONS` now leads with mojulo's software primitives (stateful MCP server + process supervisor) and names the three creatable artifacts with their entry tools (Bot → `start_new_bot`; Connected Service → `get_catalyst` or the mcp-orbit path; App → `install_scaffold` → commit → `start_app`), then points at `forward_context` as a cheap routing index. Replaces the prior two-axes framing + inline dashboard pitch. Budgeted ~180–200 words, paid once per session by every connecting agent.
- **`forward_context` reframed to a thin routing index** in [lib/mcp/tools/context.js](lib/mcp/tools/context.js) — its tool description and body advertise the drawer directory instead of carrying the full glossary / lifecycle / substrate prose; the disclosure directive still branches on the operator's `procedural_disclosure`, but the register-varying glossary moves to `get_register_kit`. `context.test.js` updated to the new index/drawer shape.
- **`install_scaffold` description gains App-paradigm entry framing** in [lib/mcp/tools/runner.js](lib/mcp/tools/runner.js) — leads with "**Entry point for the App paradigm**" plus the user-framings that route to it and the `install_scaffold → meta_context_commit({type:'app_materialization'}) → start_app` path, so the tool self-routes from `tools/list` without the agent needing `forward_context` first.
- **Docs follow the drawerization** — [CLAUDE.md](../CLAUDE.md)'s Ring 0 description and [docs/MCP-ARCHITECTURE.md](../docs/MCP-ARCHITECTURE.md) §2 now describe `forward_context` as a thin routing index over the five sibling drawers, and note that a new tool must update both `TOOL_INDEX` and `ROUTING_INDEX` in [context.js](lib/mcp/tools/context.js).
- **`find-unused-locale-keys` GC run on `en.json`** — the dev-tooling garbage collector ran: ~900 lines of dead keys across no-longer-referenced namespaces (`auth`, `actions`, `deployments`, `analytics`, `logs`, `accessLevels`, `errors`, `deleteAccount`, `botSpaceInvite`, `auditLog*`, plus dead `dashboard.*` / `common.*` leaves) are removed.
- **i18n catch-up across the cycle's surfaces** in [messages/en.json](messages/en.json) — `home.*` (tile launcher + agent status), `sketches.*` / `sketchesIndex.*` + folder strings, `breadcrumbs.*`, `mcpSkills.*`, app-graph strings, `dashboard.dataLink`, `plan.*`, `research.*`, `chatBuilder.decision.*`, `stash.*` / `cook.*`, `outcomes.*` all land here. [messages/sv.json](messages/sv.json) brought back in sync via `/sync-locales`.

### Notes

- **No bot image bump.** All changes are control-plane.
- **Additive migrations.** New tables: `app_settings`, `plans`, `meta_skills`, `research_sessions`, `research_items`, `research_abstracts`, `stashes` (+ drawer / gathered-items shape), `cooks`, `sketch_folders`. Migration-added columns: `archived` / `archived_at` / `release_json` / `sketch_ref` / `sketch_pinned` on `plans`; `sketch_ref` on `research_abstracts`; `folder_ref` on `sketches`. No data rewrites.
- **App-runtime daemon is opt-in.** `MOJULO_APP_RUNTIME=enabled` is required when running the standalone `mojulo-app-runtime` bin; set `MOJULO_DAEMONS=enabled` instead to use the unified `mojulo-daemons` host (recommended — it co-manages the scheduler too). Without either, existing `start_app` / `stop_app` calls throw `AppRuntimeUnavailableError`. Upgrade path: start the daemon once; it reconciles any processes that survived from a prior in-process run.
- **Unified daemon host is the recommended runtime posture** for operators who use both the app-runtime and the trigger scheduler. The standalone `mojulo-app-runtime` bin and the in-process scheduler fallback (in `lib/db/index.js`, gated by `MOJULO_TRIGGER_RUNTIME`) remain for backward compatibility and standalone / split-process deployments.
- **Plan→contextmap close-the-loop ships in this entry.** The prior patch entry's Note about deferral is superseded: `plan-release.js` + the `archived` columns land here.
- **Research mode v1 ships and is now legacy.** The original `research_*` tools work as-is and remain wired; **new gatherings should use stash mode** (migration option 3 — legacy data is untouched, new data lands in `stashes` + gathered-items). The cook→plan bridge lives on the plan side via `forge_plan({ source: { kind: 'cook', cook_ref } })` — cook stops at cook, and any ring that wants to deliberate on a cook output reads it via `get_cook` / `list_cooks`. `synthesize_abstract` remains the Book→plan bridge for legacy research books.
- **Outcome Artifacts are frozen to the template version** they were authored against. Bumping `TEMPLATE_VERSION` does not regenerate existing outcomes — they stay as documents at their original version (recorded in `manifest.json`).
- **Sketch posterity keeps sketches scratch.** Plan compile and stash cook auto-mint a diagram, but the link is a pointer column (`sketch_ref`), not contextmap integration — auto-mint is soft-fail and an operator pin (`sketch_pinned`) is never clobbered. Sketches still aren't structural commits.
- **Rendrant is a planning tool, not a substrate surface.** It lives inside the sketchbook and produces ordinary sketch manifests. If a Rendrant output earns a durable place later, it graduates explicitly through a Ring 6 surface, not by feature-creep on the sketchbook.
- **Dashboard is not a conversational surface.** Mid-cycle we explored wiring `HomeAgentChat` into the home page and the `/plan` and `/research` detail panes, plus an inline iteration chat into `/sketches`. We've since formalized the inverse posture: the dashboard renders state and offers "New plan / New stash / New sketch" modals with paste-able host-agent starter prompts. The **chat builder** and the **home-page chat** remain as deliberate exceptions — both are framed as **portholes to the operator's host agent** (not chats with the substrate), and both route through the agent-tasks queue. A pair of golden rules lands in [CLAUDE.md](../CLAUDE.md): the MCP transport binds to localhost (no tunneling — the substrate has no auth layer and assumes loopback-only reachability), and dashboard surfaces do not host conversational chat with the MCP agent except via the porthole pattern. The shared backend (`/api/agent-chat/stream`, `host_chat` task kind, `lib/agent-chat/relay.js`) is the load-bearing primitive; fork-hackers wiring their own UI surface have a working hook to start from.
- **`forward_context` drawerization is backward-compatible.** Existing agents that call `forward_context` still get a coherent orientation (now a routing index); the five drawer tools are additive — an agent that never pulls them loses depth, not correctness. Most `tools/list` descriptions self-route, so the common path doesn't drill further.
- **Builder driver mode is additive and opt-in.** Fresh installs default to `self-hosted` (existing behavior unchanged). Switching to `agent` requires the operator to run the chat-builder worker loop (`run-chat-builder-worker` catalyst) in their host agent. The `self-hosted` path is unchanged end-to-end.
- **i18n synced this cycle.** Both `en.json` and `sv.json` are up to date; future locale additions should run `/sync-locales` against the new keys.
- **Going forward.** This entry is sealed as the comprehensive snapshot of the cycle that brought materialization + agent-as-inference online. Subsequent in-flight work — even still `Unreleased` — opens a new section above this one rather than appending here.

### 2026-05-27 (was "Unreleased (patch)")

The follow-up patch on 0.8.0's app substrate plus the **UI refactor that lets the new primitives breathe**. The dashboard's bot-centric home page assumed mojulo only built one kind of thing; 0.8.0 added apps and 0.9.0 added trigger-binding, and the home page didn't move with them. This patch reshapes `/` into a six-tile launcher (Bots / MCP+Skills / Apps / Sketch / Plan / Settings) and moves the prior bot-detail surface to `/bots`. Two new agent-facing surfaces ride along: a **sketchbook** (the operator agent mints flow-charty diagrams via a new `create_sketch` MCP tool that reuse the existing `CreationMap` renderer) and a **per-app derived graph view** (`/apps/<ref>/graph` projects an app's contextmap node + bindings + active triggers into a topology, lays it out via slot-based geometry, and renders it through the same compact-mode `CreationMap`). On the substrate side, two small follow-ups land: the app-MCP scaffold optionally seeds the app's `.env` with its own MCP bearer + URL + materialization ref (opt-in, bearer never crosses the response), and the apps loader stops routing reads through the agent-capped fleet brief.

The shared posture across the surfaces: **one renderer, three call sites.** [CreationMap.jsx](components/graph/CreationMap.jsx) already drove the curated `/graph` page; this patch grows it (four-sided `via` routing, `curvature` multiplier on the default S-curve, `compact` type-scale preset, label pills elevated via drop-shadow) and the new per-app graph + sketchbook surfaces consume it without a parallel SVG layer. The sketchbook is deliberately *not* integrated into `forward_context` / Ring 6 / the contextmap — sketches are scratch visualizations, not structural decisions; the agent discovers `create_sketch` through `tools/list` and earns its place if the surface proves out.

### Added

- **Home page tile launcher** at [app/page.jsx](app/page.jsx). Replaces the bot list/detail UI with a 2×3 grid of workspace tiles (Bots / MCP + Skills / Apps / Sketch / Plan / Settings). Each tile links to its surface; the old bot management surface moves to [app/bots/page.jsx](app/bots/page.jsx) intact. Brand identity in chrome: [AuthNav.jsx](components/AuthNav.jsx) swaps the line-art home icon for the actual favicon (3-card stack with teal gradient) and drops the inline Apps / Graph / Data nav links — discoverability lives in the launcher now. The Data link moves under `dashboard.dataLink`; consumers like the deployments pages still link to `/data` directly.
- **Agent status footer** on the home page ([app/page.jsx](app/page.jsx) `AgentStatus` component) backed by **[app/api/agent-status/route.js](app/api/agent-status/route.js)**. Surfaces the connected operator agent's harness name + version + session count (via the new [getAllClientInfo()](lib/mcp/client-bindings.js) accessor on the live MCP client bindings table) and the declared inventory's server + tool counts + age. Green dot when a session is currently connected *or* inventory was declared in the last 5 minutes; amber for older snapshots. Polls every 15s via SWR; renders nothing on a fresh install with no agent ever attached.
- **Sketchbook (`create_sketch` MCP tool)** at [lib/mcp/tools/sketches.js](lib/mcp/tools/sketches.js). The operator agent POSTs a manifest (same vocab as the curated `/graph` map — stations with explicit x/y/w/h, kinds `input` / `mcp_tool` / `filesystem` / `db_row`, edges with optional `via` + `curvature`) and gets back `{ ok, ref, url }`. The URL resolves to a viewer at [app/sketches/[ref]/page.jsx](app/sketches/[ref]/page.jsx); the index at [app/sketches/page.jsx](app/sketches/page.jsx) is a list-with-preview surface (search by title/ref, fullscreen-toggle). Manifest validator at [lib/graph/sketch-manifest.js](lib/graph/sketch-manifest.js) (shape check + station-id uniqueness + edge endpoint resolution + curvature clamps). Repository at [lib/db/repositories/sketches.js](lib/db/repositories/sketches.js) mints `sk_<10-char>` refs by default; user-supplied refs accepted. API surface at [app/api/sketches/route.js](app/api/sketches/route.js) (list) and [app/api/sketches/[ref]/route.js](app/api/sketches/[ref]/route.js) (single fetch). [AuthNav.jsx](components/AuthNav.jsx) hides surrounding chrome on `/sketches/*` routes so the agent can hand the user a bare URL and the diagram fills the viewport. See [lite-template/integration/app-system/0527/SKETCHBOOK_PLAN.md](../lite-template/integration/app-system/0527/SKETCHBOOK_PLAN.md).
- **`sketches` table** in [lib/db/index.js](lib/db/index.js) — `id`, `ref` (UNIQUE), `title`, `manifest_json`, `created_at`. Plus an index on `created_at DESC` so the list page's recency sort is cheap. Additive migration; no data rewrite. Deliberately separate from the contextmap stack — sketches are scratch, not commits.
- **Per-app graph view** at [app/apps/[ref]/graph/page.jsx](app/apps/[ref]/graph/page.jsx). For any materialized app, projects the contextmap node + four bindings (runner / durability / inference / mcp_self) + active triggers + aggregated `app_inference` / `trigger_firing` principle counts into a `{ nodes, edges }` topology via the pure [lib/graph/derivers/app.js](lib/graph/derivers/app.js) deriver, then lays it out via [lib/graph/layout.js](lib/graph/layout.js)'s slot-based geometry. Renders through the existing `CreationMap` in `compact` mode. Read-on-refresh; never persisted. API at [app/api/apps/[ref]/graph/route.js](app/api/apps/[ref]/graph/route.js). The split deriver / layout pair is the substrate for future entity-kind graphs (MCPs, bots, compositions reuse the same layout pass).
- **`CreationMap` renderer enhancements** in [components/graph/CreationMap.jsx](components/graph/CreationMap.jsx). Four-sided `via` routing (added `left` / `top` / `bottom` to the previously right-only channel router) so edges in either lane orientation can route around stations sitting in between. New `curvature` prop on edges (0.2 – 3, default 1) multiplies the default S-curve's control-point offset — swoop wider when the straight line slices through territory, flatten for short hops. New `compact` prop swaps the type scale (font sizes, paddings, pill height) to a tighter preset used by the derived per-app graph. Label pills now elevate via a small drop-shadow filter instead of a faint outline, so chips read as lifted tokens rather than inline gaps.
- **Stub pages** for [app/mcp-skills/page.jsx](app/mcp-skills/page.jsx) and [app/plan/page.jsx](app/plan/page.jsx) — coming-soon placeholders that round out the home tile grid without claiming surfaces that haven't shipped yet. New `mcpSkills.*` and `plan.*` namespaces in [messages/en.json](messages/en.json).
- **`wire_control_plane_key` opt-in on `install_scaffold`** in [lib/app-mcp-scaffold/install.js](lib/app-mcp-scaffold/install.js) and [lib/mcp/tools/runner.js](lib/mcp/tools/runner.js). When `true`, the control plane writes `MOJULO_CONTROL_PLANE_URL`, `MOJULO_CONTROL_PLANE_KEY`, and `MOJULO_APP_REF` into the app's `.env` from its own process env (`CONTROL_PLANE_MCP_KEY` / `CONTROL_PLANE_URL`). The bearer never crosses the tool's response — only the three `*_wired` booleans confirming what landed on disk. Idempotent: existing values are left intact (operator may have set them intentionally). Default `false` — pre-0.8.1 behavior is byte-identical without the flag. Test coverage in [install.test.js](lib/app-mcp-scaffold/install.test.js) pins all four paths (default off, on + key set, on + key unset, idempotent re-run).

### Changed

- **Bot management surface moves to `/bots`** ([app/bots/page.jsx](app/bots/page.jsx)) — same list / detail / connect-modal / embed surface that previously rendered at `/`. The home page now hosts the workspace launcher described above. Dashboard subpages ([dashboard/page.jsx](app/dashboard/page.jsx), [conversations](app/dashboard/deployments/[id]/conversations/page.jsx), [submissions](app/dashboard/deployments/[id]/submissions/page.jsx), [cloud-deploy](app/dashboard/deployments/[id]/cloud-deploy/page.jsx)) update their "back" links to point at `/bots`.
- **Apps loader bypasses the brief cap** in [lib/apps/loader.js](lib/apps/loader.js). `listApps()` and `getApp()` previously read app nodes via `MetaContextRepository.brief({kind:'fleet'})`, which is capped by design — the brief is the *agent's reading window*, not a ground-truth fetch. UI surfaces (`/apps`, the new `/graph` overlay, the apps loader's API consumers) want uncapped state. Switches to `MetaNodeRepository.listByKind('artifact')` + `InventoryRepository.currentInventory()` directly. New regression test in [loader.test.js](lib/apps/loader.test.js) seeds 600 app nodes and asserts every one comes back.
- **MCP server tool registration order** in [lib/mcp/server.js](lib/mcp/server.js) — `registerSketchTools()` slots after `registerAgentTaskTools()`. Sketches are deliberately outside the Ring 6 deliberation stack (not woven into `forward_context`); they sit at the tail of `tools/list` so the agent discovers them through the protocol surface rather than the orientation tool.

### Fixed

- **Filesystem capability seed self-citation** in [lib/mcp/seeds/mcp-capabilities/filesystem.md](lib/mcp/seeds/mcp-capabilities/filesystem.md). The `<!-- sources -->` block cited `mojulo://CHANGELOG#v0.7.0` but the seed shipped in 0.8.0; the citation now matches the version that actually introduced it.

### Notes

- **No bot image bump.** All changes are control-plane.
- **One additive migration.** New `sketches` table with one supporting index; no data rewrite, no column changes elsewhere. The apps-loader switch and the `wire_control_plane_key` flag are read-path / additive-input changes against existing tables.
- **Bearer posture preserved.** `wire_control_plane_key` was deliberately designed so the bearer never crosses the MCP tool's response value — the control plane writes its own key to the app's `.env` server-side; the app reads it from disk at boot. The static-per-app `APP_MCP_BEARER` policy from 0.8.0 is unchanged.
- **Sketches stay outside the contextmap on purpose.** They aren't structural commits; they're scratch visualizations. If a sketch surface earns a durable place later (e.g. attaching one to a materialization principle as a structural overlay), it graduates explicitly through a Ring 6 surface — not by gradual feature-creep on the sketchbook table.
- **Per-app graph derives, never persists.** Every `/apps/<ref>/graph` request walks the contextmap node + inventory + triggers fresh. There is no derived-graph cache row; rename a binding, restart a trigger, and the next refresh shows it.

### 2026-05-27 (was "Unreleased")

The release where mojulo's typed shapes become **more legible** — both to the operator (a new graph view at `/graph` that visualizes the app-creation paradigm) and to itself (composer-anchored runtime for the `trigger` axis: every activation binding references a typed component by ref, so the contextmap's audit chain walks back to *which shape* was bound, not just that something was bound). Capability growth slows here on purpose; the substrate has accreted Rings and surfaces across several quiet releases (0.5.0 primitives + capabilities; 0.6.0 semantic recall; 0.7.0 register tuning; 0.8.0 apps + local-storage). 0.9.0 lets the operator see what mojulo has become — at design time (the graph view) and at runtime (autonomous firing whose every fire leaves a `trigger_firing → app_inference` chain on the artifact node).

The first half — **`trigger` axis runtime**. Where 0.5.0 made the `mcp` axis operational via [bind_primitives](lib/mcp/tools/mcp-primitive-binding.js) — resolving a typed primitive against an operator's runtime-introspected tools — this release does the same for activation. A typed trigger component (Phase 1 ships `trigger/scheduled@0.1.0`) becomes the materialization target for a runtime daemon that fires at the operator's declared cadence. Composer goes from 1-of-5 axes operational to 2-of-5; the path for `pattern` / `idempotency` / `render` is now the same shape repeated *when those axes need runtime binding* — some may stay declarative because they aren't operator-environment-specific the way `mcp` and `trigger` are.

The second half — **the app-creation graph view at `/graph`**. A hand-curated declarative manifest of the App paradigm's creation flow ([control/lib/graph/creation-map.js](lib/graph/creation-map.js)) renders as a two-lane vertical map of stations (operator inputs / MCP tools / outputs) and edges (which tools consume which inputs and produce which outputs). The manifest is validated at render time against the live MCP registry + contextmap schema enums ([control/lib/graph/validate.js](lib/graph/validate.js)) — if the manifest references a tool that's been renamed or a node kind that's been retired, the page surfaces the divergence rather than rendering a quietly-out-of-date picture. Bi-register, per 0.7.0's register tuning: a "Technical" toggle in the toolbar swaps every station's labels between the codebase's exact tool names + payload shapes and the operator-facing translation ("Which generator to use" / "A name for the app" / "Where it lives on disk"). The page exists to make the substrate's structural decisions visible without requiring the operator to read MCP tool descriptions — a small step toward the substrate looking at itself in human terms.

The trigger-binding half deliberately ships **without** an applied first artifact. Per the posture captured in [TRIGGER_BINDING_PLAN.md](../lite-template/integration/app-system/0526/TRIGGER_BINDING_PLAN.md), each release plants one substrate axis; the demonstrated closed-loop artifact arrives when enough axes are operational to make a single artifact worth pointing at. Operators wanting to apply trigger-binding today can: `bind_trigger({component_ref:'trigger/scheduled@0.1.0', ...})` against a previously-materialized app artifact with `MOJULO_TRIGGER_RUNTIME=enabled` set.

The load-bearing posture across both halves is **composer-anchored runtime**: when a deliberation surface goes operational, it resolves against the composer's typed components, never a parallel enum. `bind_trigger` takes a `component_ref` and resolves it via `MCPOrbitComponentRepository.findByRef`; adding a new trigger kind = ship a typed component in [mcp-orbit-components/trigger/](lib/mcp/mcp-orbit-components/trigger/) plus its runtime daemon. The bind tool needs no per-kind code branch beyond the schema validator the component declares. This preserves the contextmap's audit chain: every binding row + every commit principle references the typed component by ref. The graph view enacts the same principle on the UI side — the manifest cites tool names + node kinds the schema actually exposes; render-time validation enforces it.

### Trigger-binding substrate (Ring 6)

The `trigger` axis becomes operational through a sibling shape to `bind_primitives`. A typed component → runtime-bound artifact → audit principle. Same shape as the primitive-binding layer; the agent's mental model carries forward without per-axis surprises.

#### Added

- **Ring 6 — Trigger binding tools** at [lib/mcp/tools/mcp-trigger-binding.js](lib/mcp/tools/mcp-trigger-binding.js): `bind_trigger`, `unbind_trigger`, `list_triggers`, `get_trigger`. `bind_trigger` accepts `{ component_ref, binding_params, payload_template, artifact_ref, composition_ref? }`. Composer-anchored ref resolution at bind time — unknown components, non-trigger kinds, and components whose runtime isn't shipped (e.g. `trigger/signal-polled@0.1.0` typed in 0.5.0 but its daemon ships in Phase 3) all reject with clear messages. Schedule-kind validation parses `binding_params.cron` via croner upfront, so invalid expressions fail at bind time, not at first fire. Returns `{ trigger_ref, component_ref, artifact_ref, principle_id, next_fire_at }`.
- **`mcp_orbit_trigger_artifacts` table** in [lib/db/index.js](lib/db/index.js) — sibling to `mcp_orbit_provider_artifacts`. Carries `trigger_ref` (PK), `component_ref`, `binding_params_json`, `payload_template_json`, `composition_ref` / `artifact_ref` (nullable), `enabled`, `superseded_by`, `created_at`. Unique partial index on `(COALESCE(composition_ref,''), COALESCE(artifact_ref,''), component_ref) WHERE enabled = 1 AND superseded_by IS NULL` — load-bearing COALESCE so two same-target bindings with null `composition_ref` correctly collide (SQLite's default UNIQUE treats NULL as distinct from NULL, which would let duplicates slip past). Repository at [lib/db/repositories/trigger-artifacts.js](lib/db/repositories/trigger-artifacts.js) with `insert` / `getByRef` / `listActive({componentRef, compositionRef, artifactRef})` / `disable`.
- **`trigger_artifact_materialization` commit event type** in [lib/mcp/tools/meta-context.js](lib/mcp/tools/meta-context.js). Resolves the trigger artifact by ref and writes an audit principle on the target artifact node summarizing the binding (component_ref, binding_params, payload_template). Phase 1 requires the trigger to carry an `artifact_ref` — composition-only triggers are deferred. The handler validates the target artifact node exists; the `bind_trigger` tool catches commit failure and auto-disables the orphan trigger row so the operator can retry cleanly without manual cleanup.
- **`trigger_firing` principle source_event** in [lib/db/repositories/meta-context.js](lib/db/repositories/meta-context.js) `PRINCIPLE_SOURCE_EVENTS` whitelist. Outcome-rate principle (sibling to `app_inference`) written by the scheduler daemon on every fire. The convention is formalized in [docs/meta-context.md](../docs/meta-context.md#the-trigger_firing-principle-convention) so future outcome principle kinds inherit the same shape.
- **Scheduler daemon** at [lib/triggers/scheduler.js](lib/triggers/scheduler.js) — croner-backed, UTC scheduling math throughout. Reads active triggers from `mcp_orbit_trigger_artifacts` at boot, registers each in a croner instance. On each fire: renders the payload template with `{{fired_at}}` / `{{fired_at_date}}` / `{{scheduled_at}}` / `{{fired_at_unix}}` flat-key substitutions, parks the task via `parkRequestForTrigger`, writes a `trigger_firing` principle with `scheduled_at / fired_at / drift_ms` evidence on the target artifact node. **Manual-drain shutdown discipline:** `stopScheduler()` cancels future schedules sync, then awaits an in-flight `Set` of fire promises via `Promise.allSettled` — verified clean against SIGTERM mid-fire via pre-flight spike (croner v10.0.1's `job.stop()` does NOT abort in-flight callbacks; the daemon owns the drain).
- **`parkRequestForTrigger(payload, opts)`** in [lib/mcp/agent-tasks/queue.js](lib/mcp/agent-tasks/queue.js) — fire-and-forget sibling to `parkRequest`. Returns `{ request_id }` synchronously; consumes the eventual promise rejection internally so an expired task (NO_AGENT_WORKER, etc.) doesn't bubble up as an unhandled rejection. The scheduler daemon (and future webhook / watch daemons) use this; the existing HTTP-driven `parkRequest` stays unchanged.
- **`MOJULO_TRIGGER_RUNTIME=enabled` opt-in gate** in [.env.example](.env.example). Without the flag, `bind_trigger` calls still succeed (the binding rows are durable) but nothing fires until a later boot enables the runtime. Symmetric with `MOJULO_AGENT_RUNTIME`'s opt-in posture so an operator who hasn't configured automation doesn't get background daemons by default. SIGTERM + SIGINT handlers installed once at boot when the runtime is enabled; both defer to `stopScheduler()` for the drain.
- **Filesystem capabilities seed update:** the `mojulo://CHANGELOG#` self-reference in [filesystem.md](lib/mcp/seeds/mcp-capabilities/filesystem.md) is unchanged — that seed shipped in 0.8.0 and continues to attribute itself to its actual ship date. Future seed bodies authored under 0.9.0+ should cite the version they ship in.
- **`triggers` summary on fleet brief** in [lib/db/repositories/meta-context.js](lib/db/repositories/meta-context.js). `meta_context_brief({kind:'fleet'})` now returns a `triggers: { count, byComponent }` field alongside `inventory` and `vendorKnowledge`. Counts active rows grouped by `component_ref` so the agent can see "what's wired to fire automatically" at a glance; decoupled from the daemon's runtime state (the brief returns the same shape regardless of `MOJULO_TRIGGER_RUNTIME`).
- **Croner dependency.** `croner@^10.0.1` added to [package.json](package.json). Used both for bind-time cron validation (so invalid expressions reject upfront with the same parser the daemon uses at runtime) and for the daemon's scheduling. Small, modern, no transitive deps, clean SIGTERM-mid-fire behavior verified.
- **Test coverage** — 84 new tests across 4 new files and 2 expanded files: trigger-artifacts repository (22), audit composer + recorder (6), meta-context commit handler (7), trigger-binding tool surface (29), scheduler daemon (18), plus 2 fleet-brief assertions covering the new `triggers` field. **All 996 tests pass.**

#### Changed

- **`meta_context_commit` tool description and input schema** updated to list six commit event types (added `trigger_artifact_materialization`) and surface the new `trigger_ref` input field. The dispatcher in [lib/mcp/tools/meta-context.js](lib/mcp/tools/meta-context.js) routes the new type to its handler.
- **Tool registration order** in [lib/mcp/server.js](lib/mcp/server.js) — `registerTriggerBindingTools()` slots immediately after `registerPrimitiveBindingTools()` and before `registerSemanticSearchTools()`. The natural reading order in `tools/list` is composer → primitive binding → trigger binding → semantic recall.

### App-creation graph view (UI)

A new page at `/graph` renders mojulo's app-creation paradigm as a hand-tuned two-lane vertical map of stations + edges. The point isn't to be a layout engine; it's to make the substrate's structural decisions legible without requiring the operator to navigate MCP tool descriptions. The manifest is the source of truth ([control/lib/graph/creation-map.js](lib/graph/creation-map.js)) and is validated at render time against the *live* MCP registry + contextmap schema enums — if a manifest claim ever falls out of sync with the code, the page surfaces the gap.

#### Added

- **`/graph` page** at [control/app/graph/page.jsx](app/graph/page.jsx). Refresh-on-demand (no streaming, no polling); the full per-app listing lives at `/apps`. Hydration-safe `localStorage` toggle for technical/friendly register persisted as `mojulo.graph.technical`.
- **Creation-map manifest** at [control/lib/graph/creation-map.js](lib/graph/creation-map.js). Hand-curated; each station declares `id`, `kind` (`input` / `mcp_tool` / `output`), positioning (`x, y, w, h` — no layout engine), the technical view (`label`, `sublabel`, `items`), and a `friendly` register-tuned translation. Two pipelines side by side: `install_scaffold` on the left, `meta_context_commit` on the right.
- **Render-time validator** at [control/lib/graph/validate.js](lib/graph/validate.js). Walks the manifest and confirms every claim — `mcp_tool` references resolve in the registered MCP tools, node-kind references appear in `NODE_KINDS`, edge-kind references appear in `EDGE_KINDS`, principle source_event references appear in `PRINCIPLE_SOURCE_EVENTS`. Successful validation returns counts; failures return per-issue messages the page renders inline so an out-of-date manifest is visible, not silent.
- **API endpoint** at [control/app/api/graph/creation-map/route.js](app/api/graph/creation-map/route.js). Returns `{ manifest, validation, overlay }` — the overlay carries `{ appCount, lastMaterializedAt }` read from [control/lib/apps/loader.js](lib/apps/loader.js)'s `listApps()` so the page shows live state alongside the static map. Validation failures don't error the endpoint; the page renders the gap and the manifest both, because a manifest with a tool rename in it is still useful as orientation.
- **`CreationMap` SVG component** at [control/components/graph/CreationMap.jsx](components/graph/CreationMap.jsx). Pure SVG; no graph library. Stations and edges respond to the technical/friendly toggle.
- **Nav entry** in [control/components/AuthNav.jsx](components/AuthNav.jsx) linking to `/graph`, alongside Bots / Apps / Data. New `graph` namespace in [control/messages/en.json](messages/en.json) (~20 lines for nav label, title/subtitle by register, technical toggle, validation messages, overlay strings, legend keys).
- **Plan that motivates the shape** lives at [lite-template/integration/APP_CREATION_MAP_PLAN.md](../lite-template/integration/APP_CREATION_MAP_PLAN.md). Names the manifest-as-source-of-truth claim, the validate-at-render rule, and why this stays read-only (deferred surfaces — clickability that drills into a station's MCP tool, per-app overlay highlighting which stations a specific app's audit chain traversed — earn their place when an operator demands them).

### Posture captured for future plans

Two design-shaping principles got named on 2026-05-26 and now apply across every successor plan in [lite-template/integration/app-system/](../lite-template/integration/app-system/):

1. **Composer-anchored runtime.** When a deliberation surface goes operational, it resolves against the composer's typed components, never a parallel enum. This release enacts the principle for the `trigger` axis (same shape as `bind_primitives` did for `mcp` in 0.5.0). Adding a new bindable kind = ship a typed component first, then the bind tool resolves against it — no per-kind code branch.
2. **Substrate-first; one artifact at the end.** Each release plants one substrate axis. Applied artifacts arrive once enough axes are operational that a single artifact demonstrates them all at once — at that point the operator-facing demo earns its place. Substrate-only releases are deliberate, not deferred.

Both are documented at the top of [TRIGGER_BINDING_PLAN.md](../lite-template/integration/app-system/0526/TRIGGER_BINDING_PLAN.md) and should propagate into a shared `RELEASE_POSTURE.md` if a third plan needs to reference them verbatim.

### Notes

- **No bot image bump.** All changes are control-plane; nothing in `lite-template/` changes. The pinned `BOT_IMAGE` tag in [.env.example](.env.example) and [lib/deployers/docker.js](lib/deployers/docker.js) stays at the v0.6.x value.
- **DB migration is additive.** One new table (`mcp_orbit_trigger_artifacts`), two indexes (one regular, one unique partial with COALESCE). No data rewrite. Two new principle source_events (`trigger_artifact_materialization`, `trigger_firing`) ride on the existing `meta_principles` table via the in-code whitelist.
- **Graph view is fully read-only and additive.** No schema changes, no migrations, no daemons. The `/graph` page reads the static manifest + live MCP registry + live contextmap enums + the existing apps loader; on a fresh DB the overlay shows "No apps made yet" rather than erroring. Open-on-load behavior is unauthed if `CONTROL_PLANE_PASSWORD` isn't set (same as the rest of the dashboard); behind the bearer / cookie middleware otherwise.
- **Phase 1 substrate ships without an applied artifact.** The folder-digester / scheduled-summarizer demo discussed during planning is deliberately not part of this release. When the operator decides what their first scheduled artifact should be, the substrate is ready to bind it; no further code is needed.
- **Webhook (Phase 2) and watch (Phase 3) intentionally deferred.** Webhook requires a deployment-posture decision (mojulo on localhost can't receive an internet POST without a tunnel — ngrok / cloudflare-tunnel / equivalent); shipping it alongside the scheduler would bundle two distinct topics. Watch carries materially more state than the other two combined (per-MCP cursor management, polling cadence vs source rate-limits, idempotency on partial failure). Both reuse `mcp_orbit_trigger_artifacts` and the `bind_trigger` tool without schema changes — they ship as new typed components plus their daemons.
- **The `trigger` axis has shipped typed components since 0.5.0** (`trigger/scheduled@0.1.0`, `trigger/signal-polled@0.1.0`). Until this release the components were declarative only; agents could `get_mcp_orbit_component('trigger/scheduled@0.1.0')` and read their bodies but nothing in mojulo actually fired anything. The composer was honest about typing the axis; the runtime caught up here.
- **Missed fires are not replayed.** If the control plane is down for hours across a scheduled fire, the daemon does not replay missed fires on restart — only future fires execute. The first post-restart firing's audit principle records `drift_ms` against `scheduled_at` so the gap is visible to the operator.
- **No rate cap.** Phase 1 ships no per-trigger or global rate limit. `/api/agent-tasks/status` surfaces queue depth so runaway burn is observable; rate-capping is deferred to a later phase if operator pain motivates it.

## [0.8.0] — 2026-05-26

Mojulo's artifact taxonomy expands. Before this release, the system materialized two kinds of thing — chatbots (compiled via the bot factory, shipped via Fly/Docker) and skills (synthesized via workflow catalysts into the operator's host adapter). Now there's a third: **apps** — local processes the control plane spawns, paired with their own MCP sidecar, with per-inference round-trips parked on an in-process queue so the operator's Claude Code session doesn't get occupied while the app does work. And the substrate that lets artifacts bind to runtime primitives (filesystem, future http-api, future local-sql) lands as **technique catalysts** — a second `kind` of catalyst alongside the existing workflow kind, with the first member (`local-storage`) shipping as substrate only.

The two tracks are independent on their faces but share one architectural beat: **bearer-first middleware**. Apps need their MCP sidecar to call `/api/app-inference/envelope` without a session cookie; the optional Node fulfiller pulls from `/api/agent-tasks` the same way. Both routes (and any future agent-callable surface) now accept `Authorization: Bearer <CONTROL_PLANE_MCP_KEY>` as a unified credential — the cookie path stays for browser UI; the bearer path serves external processes. The change is a small one in [middleware.js](middleware.js) and load-bearing for everything Track A ships.

### Apps + node-driven fulfillment (Ring 7)

The App paradigm spike landed: substrate → protocol → runner → audit → surface, MCP-only, single-operator, grep-verifiable on the "no LLM credentials on the inference path" claim. One app shape ships (R1-Inference image extraction) against one inference flavor with one operator and one agent. Every "one" is a planted axis to press against in subsequent releases.

Apps differ from bots and skills in the dimensions that matter operationally: they run **locally on the operator's machine** (no Fly deploy, no GHCR pull, no compiled artifact), they're **runner-mediated** (the control plane owns their lifecycle, not the operator's shell), and they **defer LLM work back to an agent** through the agent-tasks queue (no per-app API key, no inference credentials on the runtime path). Inventory rows for app MCPs auto-declare as the runner spawns them; `stop_app` removes the rows by `running_ref`.

The Node fulfiller is opt-in. Without it, the operator's own Claude Code session runs `/loop /get_catalyst run-inference-worker` and pulls inference tasks itself. With `MOJULO_AGENT_RUNTIME=claude-code-headless` set, the control plane also runs an in-process poller that spawns a one-shot `claude --print` subprocess per task — the operator's main session stays free. Both fulfillers can coexist; the queue is FIFO single-claim so each task is handled by exactly one.

#### Added

- **Ring 7 — Runner tools** at [lib/mcp/tools/runner.js](lib/mcp/tools/runner.js): `install_scaffold` (scaffold a new app with bundled MCP sidecar), `start_app` / `stop_app` / `status_app` (lifecycle), `list_runners` / `list_running` (introspection), `list_env` / `set_env` / `delete_env` (per-app env management). Backed by [lib/runners/local.js](lib/runners/local.js) — an in-memory singleton that spawns the app + sidecar as an atomic pair with port allocation, env-file management, and stdout parsing for URLs. Restart loses tracking (deliberate v0 scope; runner state is process-local).
- **Ring 7 — Agent-tasks queue tools** at [lib/mcp/tools/agent-tasks.js](lib/mcp/tools/agent-tasks.js): `pull_agent_task` (long-poll, optional `wait_ms` + `kinds` filter), `submit_envelope_inference` (per-kind submit surface validating against the envelope schema embedded in the task payload), `cancel_agent_task` (escape hatch — releases the parked HTTP with `INFERENCE_CANCELLED`). Backed by [lib/mcp/agent-tasks/queue.js](lib/mcp/agent-tasks/queue.js) — an in-memory FIFO single-claim queue; parked promises reject with `INFERENCE_PARKED_LOST` on control-plane restart. Today: one task kind (`envelope_inference`); the substrate generalizes to future classification / decision / structuring kinds.
- **App MCP scaffold** at [lib/app-mcp-scaffold/](lib/app-mcp-scaffold/) — template `server.js` + envelope-client helper + health/describe tools that get installed into every materialized app source tree. Apps don't write their own MCP plumbing; they import it.
- **Claude Code runtime adapter** at [lib/runtime-adapters/claude-code.js](lib/runtime-adapters/claude-code.js) — one-shot Claude subprocess executor for headless fulfillment. Builds system + user prompts from the task payload, validates the JSON response against the envelope schema, returns the result to the queue. The piece that lets `MOJULO_AGENT_RUNTIME=claude-code-headless` actually fulfill work without an interactive session.
- **`app_materialization` commit event type** added to `meta_context_commit` (handler in [lib/mcp/tools/meta-context.js](lib/mcp/tools/meta-context.js)). Per-app atomic seal: adapter_id + artifact + app_name + four bindings (runner / durability / inference / mcp_self). Verification additionally requires the scaffolded `<locator>/app-mcp/server.js` to exist — the runner can't lifecycle an app whose sidecar is incomplete, so the commit refuses at the gate.
- **`app_inference` principle source_event** in [lib/db/repositories/meta-context.js](lib/db/repositories/meta-context.js) `PRINCIPLE_SOURCE_EVENTS` whitelist. Per-inference principle written on the app's artifact node so future audit walks can recover what each inference cost / produced.
- **`run-inference-worker` catalyst** at [lib/mcp/catalysts/run-inference-worker.md](lib/mcp/catalysts/run-inference-worker.md) — the per-loop body the operator's agent runs (pull → dispatch by task_kind → submit via kind-specific tool → loop). Wrappable in `/loop` for continuous operation; finite without `/loop`.
- **Apps dashboard pane** at [app/apps/](app/apps/) and [app/api/apps/](app/api/apps/). Loader at [lib/apps/loader.js](lib/apps/loader.js) stitches contextmap artifact nodes (payload.app) + runner state + inventory (filtered to `server_kind='app'`) into one view model. New i18n strings in [messages/en.json](messages/en.json) under the `apps` namespace.
- **`MOJULO_AGENT_RUNTIME` env var** in [.env.example](.env.example) — opt-in switch for the Node fulfiller. Default unset means `/loop`-based fulfillment via the operator's interactive session; `claude-code-headless` enables the in-process headless poller. `disabled` is an explicit kill switch.
- **`meta_mcp_inventory.server_kind` + `running_ref` columns** via additive migration in [lib/db/index.js](lib/db/index.js). `server_kind` partitions vendor MCPs (default `'vendor'`) from runner-managed app MCPs (`'app'`); `running_ref` links app rows to runner state so `stop_app` removes inventory entries by ref. Indexes on both. Existing rows backfill to `'vendor'` — the inventory before this migration was vendor-only.

#### Changed

- **`meta_context_commit` tool description and input schema** in [lib/mcp/tools/meta-context.js](lib/mcp/tools/meta-context.js) — gains the `app_materialization` event-type branch alongside the existing `operator_kyc` / `artifact_materialization` / `primitive_artifact_materialization` types. The commit-discipline rule is the same as for primitive artifacts: call only after the artifact exists on disk; verification runs before write; the auto-summary principle on the artifact node renders the four bindings for audit + semantic recall.
- **Inventory snapshot logic** in [lib/db/repositories/mcp-inventory.js](lib/db/repositories/mcp-inventory.js) — read/write paths carry `server_kind` + `running_ref` so the apps loader, the runner, and `meta_context_brief({kind:'fleet'})` agree on which inventory rows are vendor vs app. Replace-semantic on declared inventory only touches `server_kind='vendor'` rows; app rows are owned by the runner.

### Local-storage technique infrastructure (Ring 6 + catalyst kinds)

The substrate gains a second catalyst `kind`. Workflow catalysts (the existing kind, unchanged) materialize a runnable artifact through a host adapter against a bot's data + a destination MCP. **Technique catalysts** bind a runtime substrate to an artifact, with the binding recorded as an artifact-scope principle in the contextmap. The technique catalyst is the curated walkthrough; the binding pipeline (`bind_primitives` → `meta_context_commit({type:'primitive_artifact_materialization'})`) is the existing substrate that the technique calls into.

One technique ships in this release: **`local-storage`** — bind a folder on the operator's machine as a `document-store` primitive against the filesystem MCP, with two variants (`:persistent` rooted under `operator.workspace_root`, `:temporary` rooted under `os.tmpdir()/mojulo/<artifact_ref>/`). The substrate is end-to-end — loader picks up the catalyst, generator accepts the `pathPrefix` scoping field, filesystem MCP has a seeded capabilities body, the new `operator_workspace_setup` commit type writes the principle — but **no first applied artifact ships against it yet**. The first demand drives the first application; per the "first ship one boring thing" discipline in [TECHNIQUE_FAMILY_TEMPLATE.md](../lite-template/integration/app-system/primitives/TECHNIQUE_FAMILY_TEMPLATE.md), shipping the substrate without a forced applied use is correct, not incomplete.

#### Added

- **`kind: 'technique'` discriminator** in the catalyst loader at [lib/mcp/catalysts/loader.js](lib/mcp/catalysts/loader.js). Two shelves: `catalysts/*.md` defaults to `kind: 'workflow'`, `catalysts/techniques/*.md` defaults to `kind: 'technique'`. Frontmatter `kind` is optional; if present, must match the shelf — mismatch throws. `listCatalysts({ kind })` filter, `getCatalyst(id)` returns `kind` on response.
- **`list_catalysts` gains a `kind` filter** in [lib/mcp/tools/catalysts.js](lib/mcp/tools/catalysts.js). Tool description carves the workflow/technique distinction explicitly. `get_catalyst` skips the workflow-shaped preamble + host adapter section for technique catalysts (they bind primitives directly, not through host adapters). `recommend_catalysts` filters out technique catalysts in both single-bot and fleet modes (techniques don't recommend against a bot's protocol set).
- **`pathPrefix` first-class through the binding pipeline.** Generator at [lib/mcp/mcp-orbit-components/generator.js](lib/mcp/mcp-orbit-components/generator.js) accepts an optional `pathPrefix` input, validates (non-empty string, no `..` segments), renders into `{{path_prefix}}` substitution + `{{if-path-prefix}}` / `{{if-no-path-prefix}}` conditional pair, and surfaces on the manifest as `manifest.pathPrefix` for programmatic consumers (the Runner MCP reading addressing, future deliberation surfaces). `bind_primitives` at [lib/mcp/tools/mcp-primitive-binding.js](lib/mcp/tools/mcp-primitive-binding.js) forwards the field; it persists into the `mcp_orbit_provider_artifacts` row body alongside the existing manifest.
- **Filesystem capabilities seed** at [lib/mcp/seeds/mcp-capabilities/filesystem.md](lib/mcp/seeds/mcp-capabilities/filesystem.md) — sixth seed alongside gmail / google_drive / linear / notion / slack. Honest about scope: POSIX-ish operations, launch-time allow-list, no auth, no soft-delete, no retention. Sub-path enforcement is mojulo's discipline (the binding's `pathPrefix`), not the MCP's — the body says so explicitly. Picked up automatically on first install via the existing idempotent seed migration; existing installs gain only the `filesystem` row on next boot.
- **`operator_workspace_setup` commit event type** in [lib/mcp/tools/meta-context.js](lib/mcp/tools/meta-context.js). Records `workspace_root` (absolute path) and optional `workspace_conventions` (free-form prose) as flat principles on the operator node. Append-only — re-running stacks fresh principles, latest wins for readers. Distinct from `operator_kyc`'s revise path because the principle body shape is different (`**Workspace root:**` header vs the KYC body's `**Locked-in constraints:**` list). Validation: requires the operator anchor to exist; rejects relative paths and `..` segments.
- **`local-storage` technique catalyst** at [lib/mcp/catalysts/techniques/local-storage.md](lib/mcp/catalysts/techniques/local-storage.md). Five-step walkthrough: resolve or set `operator.workspace_root` → confirm filesystem MCP in inventory → choose sub-path + apply `conflict-vs-claim` discipline → call `bind_primitives` with `pathPrefix` → graduate via `meta_context_commit({type:'primitive_artifact_materialization'})` → wire the artifact (skill: path baked into SKILL.md; app: injected as env var via the Runner MCP — naming convention `MOJULO_LOCAL_STORAGE_PATH` for single-binding artifacts, `MOJULO_LOCAL_STORAGE_<TAG>_PATH` for multi-binding). Two variants documented; pitfalls (workspace at home root, symlink escape, concurrent writers, no native retention) called out with concrete mitigations.
- **`operator_workspace_setup` in `PRINCIPLE_SOURCE_EVENTS` whitelist** in [lib/db/repositories/meta-context.js](lib/db/repositories/meta-context.js). No schema change — the existing `meta_principles` table accepts the new source_event value; the whitelist is the only thing that needed expanding.

#### Changed

- **`document-store.destination.template.md`** in [lib/mcp/mcp-orbit-components/primitive/](lib/mcp/mcp-orbit-components/primitive/document-store.destination.template.md) gains a `## Write scope (path prefix)` section that renders only when `pathPrefix` is bound. Body is candid that the MCP itself can't enforce sub-path scopes smaller than its launch-time allow-list — the constraint is *guidance* for honest agents, evidenced by the audit chain rather than blocked by the runtime. Operators relying on the audit trail to certify "nothing was written outside `<path_prefix>`" should pair the binding with regular contextmap reviews.
- **Setup doc for the filesystem MCP** added to [docs/mcp-integration.md](../docs/mcp-integration.md) — new "Technique catalysts" subsection covering the one-time `claude mcp add filesystem npx -y @modelcontextprotocol/server-filesystem <workspace_root>` install command, the `--scope user` choice for cross-project availability, and the workspace-root-change posture (manual re-materialization in v0).

### Cross-cutting: bearer-first middleware

The architectural beat that ties both tracks. Mojulo's middleware previously enforced a session-cookie gate on all `/api/*` paths, with `/api/mcp` carrying its own bearer-token check inside the route handler. With apps shipping their own MCP sidecar that calls back into `/api/app-inference/envelope`, and with the optional Node fulfiller pulling from `/api/agent-tasks`, every bearer-protected route would have needed per-route auth plumbing. Lifting the bearer check into middleware unifies the two auth schemes (cookie OR token) so any future agent-callable route just works.

#### Changed

- **[middleware.js](middleware.js) accepts bearer tokens.** New `presentedBearerMatchesMcpKey(req)` check fires before the session-cookie path; when the `Authorization: Bearer <CONTROL_PLANE_MCP_KEY>` header matches in constant-time, the request bypasses the cookie gate entirely. Tokens are compared via `constantTimeEquals` to avoid early-exit timing leaks on a mismatched prefix.
- **401 response shape upgraded** from plain text (`"Authentication required"`) to JSON with `code: 'SESSION_REQUIRED'` and a body explaining the two acceptable credentials. Existing browser clients keep working (cookie path unchanged); programmatic callers get a structured error.

### Notes

- **No bot image bump.** All changes are control-plane; nothing in `lite-template/` changes. The pinned `BOT_IMAGE` tag in [.env.example](.env.example) and [lib/deployers/docker.js](lib/deployers/docker.js) stays at the v0.6.x value.
- **DB migration is additive.** Two new columns on `meta_mcp_inventory` (`server_kind` default `'vendor'`, `running_ref` nullable) plus two indexes. No data rewrite, no breaking change for existing rows. The `meta_principles` table is unchanged — `app_inference` and `operator_workspace_setup` ride on the existing `source_event` column; the new values land via the in-code whitelist.
- **Track B substrate ships without an applied first artifact.** A daily-digest skill or a text-extraction app would be the canonical first use, but neither lands in 0.8.0. The first demand drives the first application; pressure-testing the technique against a real artifact is the next move and may reshape the substrate's open questions (path-prefix UX edge cases, retention enforcement, workspace-root migration). Operators wanting to apply the technique today can do so — the catalyst body is fully agent-walkable — but the canonical-shape claim is unproven until a real artifact uses it.
- **No mojulo CHANGELOG entry yet for the filesystem seed body's self-reference.** The seed body cites `mojulo://CHANGELOG#v0.7.0` in its `<!-- sources -->` block as a placeholder; that reference points at the *prior* release. The honest move once 0.8.0 ships is to update the citation to `mojulo://CHANGELOG#v0.8.0` — a one-line edit to [lib/mcp/seeds/mcp-capabilities/filesystem.md](lib/mcp/seeds/mcp-capabilities/filesystem.md). Not load-bearing; flagged for honesty in the provenance trail.
- **The bearer-first middleware change widens the auth surface.** A leaked `CONTROL_PLANE_MCP_KEY` now grants the same access as a valid session cookie — previously it granted only the MCP route. Mojulo's threat model (single-operator, self-hosted, opt-in HTTP login) accepts this; an operator who shares mojulo across machines or a future multi-tenant posture would need to revisit. The key was already the MCP credential; unifying it with the session is the explicit choice, not an accident.
- **Test count.** 912 passing across the control plane (up from 832 at 0.7.0 release). New coverage spans the Ring 7 runner + agent-tasks tools, the Apps loader and dashboard data path, the catalyst loader's kind discriminator, the generator's `pathPrefix` round-trip, the `bind_primitives` `pathPrefix` plumbing, the filesystem seed inclusion, and the `operator_workspace_setup` commit's round-trip via `meta_context_brief`.

## [0.7.0] — 2026-05-25

Ring 6's operator anchor gains a **communication-style dimension**, and `forward_context` learns to read it. Before this release the agent re-derived how technical to talk to the user every turn from in-conversation cues alone; the standing-rule directive said "respond at a reflective degree of technical sophistication" but gave the agent no durable signal for *which* register fit *this* user. Now the operator declares a preference once via two optional fields on `operator_kyc` (`vocabulary_register: 'plain' | 'mixed' | 'mojulo'`, `procedural_disclosure: 'terse' | 'reflective' | 'pedagogical'`), it persists on the operator node's payload, and `forward_context` branches three sections of its body — opening orientation, concept glossary, disclosure directive — to match. Two orthogonal axes, six real cells in the 3×3 (`plain + terse` is "novice in a hurry"; `plain + pedagogical` is "novice learning the model"; `mojulo + terse` is power-user; etc.). The plan that motivates the shape lives in [lite-template/integration/REGISTER_TUNING_PLAN.md](../lite-template/integration/REGISTER_TUNING_PLAN.md).

The load-bearing constraint is the **floor rule**: the four commitment gates the user needs to course-correct on (*proposed* vs *materialized*, *dry-run* vs *promoted*, *watched* vs *read-once*, *recorded in the audit trail* vs *not*) must stay legible in every register cell. `plain` is "gate language in plain English," not "no gate language." The unit suite includes a smoke test that fails if any cell drops any gate phrase — the design contract is structurally enforced, not aspirational.

The complementary `semantic_search` surface shipped in v0.6.0 is what makes the `plain` end of the register newly viable. Before, plain-English intent forced the agent to teach mojulo's nouns to the user just to disambiguate which tool to reach for. With semantic recall, the agent maps "log new Gmail to a sheet" → ranked refs for the gmail capability, sheets capability, messaging-channel and structured-record-store primitives **without surfacing those jargon names to the user at all**. The bridge claim was validated in a real 4-turn session before release: agent answered in depth without once naming a tool or primitive.

### Added

- **`operator_kyc` carries two new optional fields** in [lib/mcp/tools/meta-context.js](lib/mcp/tools/meta-context.js): `vocabulary_register` (`'plain' | 'mixed' | 'mojulo'`) and `procedural_disclosure` (`'terse' | 'reflective' | 'pedagogical'`). Enum-validated; both default to today's posture (`mixed + reflective`) when absent. Composed into the principle body under a `**Communication preferences:**` block so an agent reading `meta_context_brief({kind:'fleet'})` sees them alongside role + primary_goal + constraints. The programmatic source of truth lives on the operator node's `payload` (JSON-serialized) — `forward_context` reads from there.
- **Exported register enums + defaults** from [lib/mcp/tools/meta-context.js](lib/mcp/tools/meta-context.js): `VOCABULARY_REGISTERS`, `PROCEDURAL_DISCLOSURES`, `DEFAULT_VOCABULARY_REGISTER`, `DEFAULT_PROCEDURAL_DISCLOSURE`. One source of truth shared between the kyc validator, the `forward_context` handler, and the test suites.
- **`forward_context` learns per-call overrides** in [lib/mcp/tools/context.js](lib/mcp/tools/context.js). Input schema gains optional `register` and `disclosure` fields with the same enum validation. Override > operator anchor > defaults, resolved per-axis — overriding one axis inherits the other from the anchor. Useful when the agent wants to bump to `mojulo` for one detailed explanation mid-`plain` session without committing a new kyc revision. The override is local to the call; it does not write to the contextmap.
- **`buildForwardContextBody({register, disclosure, source})` composer** exported from [lib/mcp/tools/context.js](lib/mcp/tools/context.js). Pulls the three branched sections from variant tables (`OPENING_PARAGRAPH_VARIANTS`, `CONCEPT_GLOSSARY_VARIANTS`, `DISCLOSURE_DIRECTIVE_VARIANTS`) and stitches them with the ~10 shared section constants. The shared spine — lifecycle, tool index, two-faces, secrets, verification, catalyst texture, quick-orientation rules — is single-source; only the prose that actually carries register voice branches.
- **Dual-purpose preamble** at the top of every `forward_context` body. Names the document's two readers explicitly: the **agent** reading for orientation, and the **system reader** (a contributor adding a tool, the future `meta_context_arbitrate` coherence pass) reading it as mojulo's canonical reference. Replaces the older "cognitive assistance" directive — the new register signal does that work better, freeing the preamble to capture the most valuable insight from the dropped drawer/tier draft: that `forward_context` plays two roles, named here without paying for a tool split.
- **Communication settings notice** rendered into every `forward_context` body just under the preamble. Reports the active cell (`vocabulary_register: plain, procedural_disclosure: pedagogical`) and the resolution source (`override` / `operator_anchor` / `defaults`) so the agent has an explicit signal instead of an ambient directive, and so the user — if they read the body — can tell *why* the agent is talking the way it is.
- **Test coverage** — 5 new register-tuning tests added to [lib/mcp/tools/meta-context.test.js](lib/mcp/tools/meta-context.test.js) (round-trip onto payload + into principle body; omit when neither field set; enum validation for both axes; revise preserves prior payload when not re-specified; revise updates one axis without resetting the other). New [lib/mcp/tools/context.test.js](lib/mcp/tools/context.test.js) with 16 tests covering: every register × disclosure cell renders without throwing; **floor rule survives every cell** (the four-gate phrases asserted across the 3×3); dual-purpose preamble in every cell; branched-section content checks (`plain` says "Gmail, your calendar, Drive" + "Don't surface to the user"; `mojulo` strips ramp prose; disclosure variants each insert exactly one paragraph); concept names invariant across registers (`**Bot**`, `**Deployment**`, etc.); tool-index single-source (representative tool one-liner verbatim in every register); fallback to defaults on invalid inputs; and handler resolution (defaults / anchor / per-call override / per-axis composition / invalid rejects / floor in handler output). **All 69 tests pass.**

### Changed

- **`FORWARD_CONTEXT_BODY` refactored from a monolithic template literal into composable sections.** Today's body was ~200 lines of one template string; the refactor breaks it into ~10 shared section constants (`HEADER`, `DUAL_PURPOSE_PREAMBLE`, `TWO_FACES_ONE_STATE`, `SECRETS_HANDLING`, `VERIFICATION_POSTURE`, `STANDING_RULE_FLOOR`, `CATALYST_TEXTURE_PREVIEW`, `LIFECYCLE`, `TOOL_INDEX`, `QUICK_ORIENTATION_RULES`) plus the three variant tables. The exported `FORWARD_CONTEXT_BODY` constant survives as a back-compat shim that renders the `mixed + reflective` default cell — any importer that still references it (mostly tests) sees the same body shape the tool emitted before register tuning landed.
- **Operator node payload now carries register prefs.** [lib/mcp/tools/meta-context.js](lib/mcp/tools/meta-context.js) `commitOperatorKyc` reads the existing operator node's `payload` before upserting and merges per-axis: register fields explicitly provided in the new commit win; absent fields preserve their prior value. Without this, a revise call that only updates `role` would silently reset register prefs set in an earlier commit. The merged payload is what `forward_context` reads via `MetaNodeRepository.findByRef('operator', 'self')` at handler time.
- **`Commitment-level vocabulary` standing rule rewritten.** The original opening paragraph ("respond in a similar register with one degree of sophistication above, to ramp the user") was the old form of the register concept; it's superseded by the operator's declared `vocabulary_register` and the active-cell notice at the top of the body. The standing rule now leads directly with the four-gate floor list, then inserts the active disclosure directive (`terse` / `reflective` / `pedagogical`) below as a separate paragraph keyed on axis 2. The floor list itself is invariant across cells.
- **`forward_context` tool description and input schema updated.** The description now names the per-call override and explains which sections branch (opening, glossary, disclosure) vs. which stay invariant (concept names, tool descriptions). Input schema declares both new optional fields with enum and one-line descriptions.
- **`meta_context_commit` tool description and input schema** updated to declare `vocabulary_register` and `procedural_disclosure` alongside the other operator_kyc fields, including the "absence preserves any prior setting on revise" semantics.

### Notes

- **No migration.** No database column changes — register prefs ride on the operator node's existing `payload` column. No new repository, no new index, no schema bump. Existing operators with no register prefs keep getting today's `mixed + reflective` body verbatim.
- **No bot image bump.** Purely a control-plane MCP behavior; nothing in `lite-template/` changes. The pinned `BOT_IMAGE` tag in [.env.example](.env.example) and [lib/deployers/docker.js](lib/deployers/docker.js) stays at the v0.6.x value.
- **Floor rule is structurally enforced.** A unit test iterates every register × disclosure cell and asserts every gate phrase appears in the rendered body. Future edits to the branched sections cannot accidentally drop the floor without the test catching it — the design contract is mechanically protected, not authorial discipline.
- **Tool surface is invariant across registers.** Tool descriptions in MCP `list_tools` stay in mojulo idiom regardless (they're agent-facing — the agent uses them to call tools). Concept *names* (`primitive`, `composer`, `materialized`, `inventory`, `capabilities`) never branch (the agent uses them too). Only the user-facing prose in the three branched sections changes. Agent-to-agent surfaces — `meta_context_brief` outputs, future `meta_context_arbitrate` plans, catalyst bodies, meta-catalyst bodies, primitive role templates — all stay technical regardless of operator register. The boundary is "prose-to-user branches; data-and-tools-for-agents doesn't."
- **No auto-detection.** Tempting to infer the register from the user's word choice ("they said `primitive`, bump to mojulo") — explicitly rejected for v1. The register signal lives on the contextmap; auto-mutating it violates append-only discipline, and misdetection on a quoted doc shouldn't silently change session behavior. Promotion is an operator decision: the agent should surface it as a soft suggestion ("you've been asking about composer internals — want me to switch to the technical orientation?") and commit on explicit yes via `meta_context_commit({type:'operator_kyc', revise: true, vocabulary_register: 'mojulo'})`.
- **Validation step 3 field-validated.** The plan's load-bearing claim was that `semantic_search` makes `plain` mode viable by moving the noun-disambiguation bridge into the tool layer. Tested in a real 4-turn session before release: agent answered in depth across the chatbot-and-mcp-orbit axes without surfacing a single jargon term. The bridge holds.

## [0.6.0] — 2026-05-25

Ring 6 gains a **semantic recall surface** over the durable app state it already accumulates. The structured readers (`meta_context_brief`, `get_mcp_orbit_component`, `get_catalyst`, `get_mcp_capabilities`, …) answer "give me the full row at this ref"; the new `semantic_search` answers the other direction — "which refs are relevant to this intent at all?" One unified sidecar (`meta_embeddings`) covers seven source kinds — principles, declared MCP inventory tools, current capability bodies, mcp-orbit components / compositions / provider artifacts, and the shipped catalyst markdown — keyed on `(source_kind, source_ref)` with `content_hash`-based skip on re-embed. Embeddings are computed by the already-in-process multilingual-e5-small ONNX model that powers bot-side RAG; no new native dependency, no external API. The plan that motivates the shape lives in [lite-template/integration/SEMANTIC_INDEX_PLAN.md](../lite-template/integration/SEMANTIC_INDEX_PLAN.md).

### Added

- **`meta_embeddings` table** in [lib/db/index.js](lib/db/index.js) — single sidecar, `(source_kind, source_ref)` unique, raw little-endian `float32[384]` BLOB embedding, `content_hash` sha256 of the body, `model` column reserved for future model swaps without a destructive rebuild. CHECK constraint pins the seven source kinds. Backed by a per-kind index on `source_kind`.
- **`EmbeddingsRepository`** at [lib/db/repositories/embeddings.js](lib/db/repositories/embeddings.js) — split sync/async API forced by better-sqlite3's "transaction fn must be synchronous" rule against `generateEmbeddings(...)` being async. The contract every source-row write path follows: *compose body text → `await embed(...)` outside the txn → enter the sync `db.transaction(fn)` that writes the source row + `upsertSync` the embedding row together*. Atomicity is preserved end-to-end: if the host write rolls back, the embedding write rolls back with it. `embed` / `embedMany` are hash-skip-aware (existing row, same hash → returns `vector: null` so the upsert no-ops); pass `{ skipUnchanged: false }` from write paths whose host txn deletes the prior embedding row first (inventory replace) where the skip would silently lose the vector. `deleteByRefSync` and `deleteByRefPrefixSync` cover the deletion paths (the prefix variant LIKE-escapes wildcards so a server name containing `_` or `%` doesn't widen the delete). `search(query, { kinds, limit })` runs the query through the existing `generateEmbeddings(..., { inputType: 'search_query' })` (which owns the e5 `query: ` prefix), loads the optionally-kind-filtered rows, scores cosine in JS, sorts, slices — sub-50ms at expected corpus size after model warm-up.
- **Capability supersession filter on search** — `search` joins against `meta_mcp_capabilities` + `meta_mcp_providers` and quietly drops any `mcp_capability` row whose backing capability is no longer the current one for its provider. A row in `meta_embeddings` without a current capability entry is never returned. This is the load-bearing property pinned by the embeddings test suite — a regression here would let the agent recall stale vendor knowledge.
- **`semantic_search` MCP tool** at [lib/mcp/tools/semantic-search.js](lib/mcp/tools/semantic-search.js) — Ring 6, registered LAST so the reading order is *orientation → action → deliberation (structured walks: brief, inventory, capabilities, composer, primitive-binding) → deliberation (fuzzy recall: semantic_search)*. Returns `{ results: [{ source_kind, source_ref, score, snippet }] }` with snippets capped at ~280 chars — the contract is *retrieve, don't resolve*; the agent pairs results with the structured readers to pull full bodies for any row worth the context cost. Optional `kinds` filter restricts to one or more of the seven source kinds; default returns all. Read-only.
- **`reindexAll()` helper + `scripts/reindex-embeddings.js` CLI** at [scripts/reindex-embeddings.js](scripts/reindex-embeddings.js) — one-shot backfill across every source kind (`SELECT` per source table → compose body via the kind's `BodyComposition` helper → batched `embedMany` → single sync `db.transaction(fn)` of `upsertSync` calls). Idempotent (hash-skip on every row). Use when body-composition logic changes (e.g. mcp_tool body shape evolves) so existing rows recompute their hashes against the new shape, or when first-boot auto-run failed and the operator wants to retry manually, or when catalyst markdown was updated in-place without a source-row write to trigger the per-write hook.
- **First-boot auto-backfill** via `maybeBackfillEmbeddings(db)` in [lib/db/index.js](lib/db/index.js) — runs after `migrateInventoryColumns` + `reapStaleMcpJobs`. Short-circuits when `meta_embeddings` already has rows; further short-circuits when *no source-row exists yet across the entire corpus* (catalysts are filesystem-only and small; reindexing them on every fresh boot pre-source-write is wasteful). Fires the reindex as fire-and-forget so `getDb()` isn't blocked on model load. `MOJULO_SEMANTIC_INDEX_DISABLED=1` skips the auto-run; the CLI ignores that flag (it's the manual recovery path).
- **Body composition helpers** exported alongside the repo: `composeMcpToolRef`, `composeMcpToolBody`, `composeOrbitComponentRef`, and the per-kind `BodyComposition` map (`principle` / `capability` / `orbitComponent` / `orbitComposition` / `orbitArtifact` / `catalyst`). Centralizing composition keeps the index consistent across the per-write hooks and the bulk reindex — the canonical body shape per source kind is defined once.
- **Test suites** for every source kind's write-path integration with the sidecar: [embeddings.test.js](lib/db/repositories/embeddings.test.js), [mcp-capabilities-embedding.test.js](lib/db/repositories/mcp-capabilities-embedding.test.js), [mcp-inventory-embedding.test.js](lib/db/repositories/mcp-inventory-embedding.test.js), [mcp-orbit-embedding.test.js](lib/db/repositories/mcp-orbit-embedding.test.js), [mcp-orbit-provider-artifacts-embedding.test.js](lib/db/repositories/mcp-orbit-provider-artifacts-embedding.test.js), [meta-context-embedding.test.js](lib/mcp/tools/meta-context-embedding.test.js), and the cross-kind [semantic-search.integration.test.js](lib/mcp/tools/semantic-search.integration.test.js). Coverage pins: per-source upsert on insert, hash-skip on unchanged body, replace-semantic deletion of stale tool rows on inventory replace, current-row-only recall on capability supersession, soft-fail posture (host write commits even if the embed fails), and cross-kind cosine recall against a populated corpus.

### Changed

- **Source-row write paths upsert into the sidecar.** Per the plan's pre-embed-then-sync-txn discipline, every write that lands new body text in a source table now mirrors into `meta_embeddings` atomically:
  - **`meta_context_commit`** in [lib/mcp/tools/meta-context.js](lib/mcp/tools/meta-context.js) — pre-embeds every principle's `body_md` in one `embedMany` batch before opening the commit txn; inside the sync txn, `upsertSync('principle', String(insertedId), ...)` rides alongside each `INSERT INTO meta_principles`. A `meta_context_commit` that writes 10+ principles for an artifact materialization pays one batched embed call before the txn opens.
  - **`InventoryRepository.replaceInventory`** in [lib/db/repositories/mcp-inventory.js](lib/db/repositories/mcp-inventory.js) — batched `embedMany({ skipUnchanged: false })` for every tool body across all servers, then in the sync txn each server's prior tool embeddings are dropped via `deleteByRefPrefixSync('mcp_tool', `${server}::`)` and the new ones inserted. `skipUnchanged: false` is load-bearing — the prefix delete would otherwise lose any vector that hash-matched a since-deleted row.
  - **`CapabilitiesRepository.record`** in [lib/db/repositories/mcp-capabilities.js](lib/db/repositories/mcp-capabilities.js) — embed the new row's `body_md` before the 3-statement supersession dance; inside the sync txn, `upsertSync('mcp_capability', provider_ref, ...)` writes the new vector and the prior superseded row's embedding stays in place (search filters by `superseded_by IS NULL` so it never surfaces). No churn on supersession; full history walks (`asOf`) still work against the source table.
  - **`MCPOrbitComponentRepository.upsert` / `MCPOrbitCompositionRepository.create` / `MCPOrbitProviderArtifactRepository.create`** in [lib/db/repositories/mcp-orbit.js](lib/db/repositories/mcp-orbit.js) + [lib/db/repositories/mcp-orbit-provider-artifacts.js](lib/db/repositories/mcp-orbit-provider-artifacts.js) — embed `body_md` / `intent_md` / `body_md` (respectively) before the insert; `upsertSync` inside the txn under the kind's composed ref (`${kind}/${ref}@${version}` for components, raw `ref` for compositions, raw `ref` for provider artifacts).
  - **Catalyst seeds** in [lib/mcp/seeds/mcp-capabilities-seed.js](lib/mcp/seeds/mcp-capabilities-seed.js) — first-install seeding through the same `CapabilitiesRepository.record` path mirrors into the sidecar, so the four shipped vendor bodies (gmail / notion / linear / google_drive) are searchable from the first session without an explicit reindex.
  - **Catalyst markdown library** — no per-write hook (catalysts are filesystem-immutable per install). The auto-backfill on first boot picks them up via the `BodyComposition.catalyst` helper (full markdown recomposed from the loader's structured form); operators who hand-edit catalysts re-run `scripts/reindex-embeddings.js`.
- **`forward_context` Ring 6 tool index** in [lib/mcp/tools/context.js](lib/mcp/tools/context.js) gains a `semantic_search` entry that names the read-side relationship explicitly: *brief* / structured readers answer ref-then-fetch, *semantic_search* answers intent-then-rank. Cold-load posture (~2–4s on first call after a control-plane restart, sub-50ms thereafter) and the capability supersession filter are both surfaced in the tool description so the agent doesn't have to guess.

### Notes

- **Why not a vector DB?** SQLite + JS cosine over an in-memory result set is sufficient at the projected corpus size (hundreds → low thousands of rows). The `embedding BLOB` column shape is already compatible with [`sqlite-vec`](https://github.com/asg017/sqlite-vec)'s `vec0` virtual tables — the swap is a future migration with no row-shape change. Defer until the corpus actually crosses ~10k rows.
- **Why one sidecar, not per-table?** Source-table write disciplines diverge sharply (append-only / replace / append-with-supersession / append-on-version) — that divergence is meaningful at write time but has no equivalent at read time. The agent wants *relevant text*, regardless of which table holds it. One sidecar matches the read shape and lets each write path keep its own discipline; the cost is one extra coordinate (`source_kind`); the benefit is one place to evolve embedding strategy and one tool the agent has to learn.
- **Soft-fail posture.** Embed failures never block the host write: the repo logs and the source row commits without a corresponding embedding entry, and the agent loses recall on that specific row until the next `reindexAll`. The plan accepts this for individual rows (principles / components / compositions) and explicitly for bulk paths (a network blip during inventory replace leaves a whole server's tools un-indexed; the operator re-runs the CLI). Existing rows are NOT deleted on soft failure either — a prior good embedding stays in place even if the latest embed failed, so recall doesn't regress below the previous state.
- **Cold load.** First embed after a control-plane restart pays ~2–4s of model load (the same multilingual-e5-small q8 ONNX that powers bot-side RAG, hoisted in-process via [lib/embedder/local.js](lib/embedder/local.js)). Subsequent calls in the same process are sub-50ms at expected corpus size. The first embed is typically a write-path call (e.g. `meta_context_commit`), not a `semantic_search` — acceptable, both surfaces are deliberation-rate, not run-rate.
- **Explicit non-goals** (these keep the plan durable): not embedding the internal MCP tool registry (Rings 0–6 — small, taxonomic, already loaded via `forward_context`); not embedding conversation data (lives in bot SQLite, `bot-proxy.js`-mediated reads only); not embedding `meta_nodes` / `meta_edges` payloads (predominantly identifiers — low-signal noise; navigable via `meta_context_brief`); not coupling to meta-catalyst evolution (the index keys on stable schema row identifiers, content picks up content changes via `content_hash`).

## [0.5.0] — 2026-05-25

Ring 6 grows from three surfaces to five. The deliberation substrate v0.4.0 introduced (contextmap / inventory / mcp-orbit composer) gains two more first-class surfaces: **capabilities** (vendor knowledge with transactional supersession + asOf history, sibling to inventory's introspection facet — both write through one identity layer per provider) and **primitive binding** (a runtime-introspected composer that fills vendor-agnostic primitive templates with the operator's actual bound tool names + schemas). The vendor-shaped mcp-orbit composer that anchored v0.4.0 stays in place but steps back to seed-reasoning duty; `bind_primitives` is the supported path for MCP-to-MCP composition where the agent has runtime tool-schema knowledge — which is the common case for Claude Code, Codex, and similar hosts.

The composer rewires around a **consolidated provider view** that joins identity + inventory + capabilities into one record per logical MCP, with five composer states per chosen provider (`research` / `seed` / `inventory_only` / `capabilities_only` / `none`) that surface as their own warning tags so the agent routes remediation directly. Vendor curation gets decoupled from build-time, lifecycle-bound seeds: four curated vendor bodies (gmail / notion / linear / google_drive) ship as seeds on first install for cold-start reasoning, with the `research-mcp-vendor` catalyst as the agent-side refresh path. The primitive layer ships four primitives — `document-store`, `structured-record-store` (typed records across issue trackers + CRMs + spreadsheet-databases), `messaging-channel`, `message-thread` — each as body + source-role template + destination-role template, with a deterministic generator that fills the templates against capability snapshots at bind time.

`source` and `destination` lift from component kinds to **composition roles** carried per-entry in `component_refs`. Adding a new MCP to the library is now one `mcp` component declaring its affordances, not two source/destination components, and the same MCP plays both roles in compositions that read and write the same backend (Linear digest → Linear, HubSpot enrichment → HubSpot). Two new starter component kinds — `trigger/signal-polled` and `pattern/routing` — extend the composer past scheduled-aggregation into signal-driven shapes, proven end-to-end against the gmail-support-thread → linear-issue catalyst.

### Composer: source/destination as composition roles

First structural refinement past the 0.4.0 baseline. Surfaced as feedback after merge: the 0.4.0 shape encoded `source` and `destination` as **component kinds**, forcing each MCP that wanted to play either role to ship as two components (`source/gmail` + `destination/gmail`). That cut off real workflows where an MCP needs to be on both sides (Drive folder watcher → digest into another Drive doc; Linear closed issues → enrichment → back to Linear). The fix is structural but cheap: lift source/destination from component-kind to **composition-role**, carried per-entry in `component_refs`. The bones don't change; the unlock roughly doubles the addressable workflow space. Catching this before custom components ship prevents teaching external authors a confusing shape.

#### Changed

- **`mcp_orbit_components.kind` CHECK constraint** in [lib/db/index.js](lib/db/index.js) — drops `'source'` and `'destination'`, adds `'mcp'`. New enum: `('mcp','trigger','pattern','idempotency','render')`. The `MCPOrbitComponentRepository.COMPONENT_KINDS` array in [lib/db/repositories/mcp-orbit.js](lib/db/repositories/mcp-orbit.js) matches. Existing 0.4.0 composition rows that reference the old kinds are not migrated (5 in test fixtures only, none in production); the kinds change is a one-shot.
- **`component_refs` entries gain a `role` field** in [lib/db/repositories/mcp-orbit.js](lib/db/repositories/mcp-orbit.js) — required for `kind: 'mcp'` entries (`'source' | 'destination'`), rejected on non-mcp kinds (the other kinds are singletons in a composition). New `_MCP_ROLES_FOR_TESTS` export mirrors the pattern of the other test seams. Validation throws on missing role for mcp entries with a clear error pointing at the role enum.
- **Two MCP-shaped starter components re-authored** with bidirectional bodies: [mcp-orbit-components/mcp/linear.md](lib/mcp/mcp-orbit-components/mcp/linear.md) (was [mcp-orbit-components/source/linear.md](lib/mcp/mcp-orbit-components/) — now also covers `create_issue` / `update_issue` / `comment_on_issue` for destination-role usage) and [mcp-orbit-components/mcp/gdrive.md](lib/mcp/mcp-orbit-components/mcp/gdrive.md) (was [mcp-orbit-components/destination/gdrive.md](lib/mcp/mcp-orbit-components/) — now also covers `list_recent_files` / `search_files` / `read_file_content` for source-role usage). Each declares an `affordances: { read, write, watch }` map; the recommender uses these to gate which composition role this MCP can play. Bodies grew to ~50–60 lines (one surface/mapping section per role + shared pitfalls) — read-after-write same-MCP loop pitfalls called out explicitly. The legacy `source/` and `destination/` directories are removed.
- **Pattern aggregation frontmatter** in [mcp-orbit-components/pattern/aggregation.md](lib/mcp/mcp-orbit-components/pattern/aggregation.md) updated from `fits.sources / fits.destinations / requires.minSources / requires.minDestinations` to `fits.sourceMcpAffordances / fits.destinationMcpAffordances / requires.minMcpRoles: { source: 1, destination: 1 }` — the wildcard `"*"` framing didn't survive the role refinement; affordance-explicit is sharper.
- **Recommender** ([lib/mcp/tools/mcp-orbit.js](lib/mcp/tools/mcp-orbit.js) `buildCandidateComposition`) — lists `kind: 'mcp'` components once, partitions by affordance into `readMcps` / `writeMcps`, then selects per role with two new heuristics: (1) inventory-matched candidates take precedence; (2) within the pool, the source is ranked by **earliest mention** in the intent text and the destination is ranked by **latest mention** with a preference for a different ref from the chosen source (the natural-language ordering "X digest into Y" almost always names source first and destination second). `priorMaterializationSignal` keys on role-aware `${kind}/${ref}#${role}` so `mcp/linear@source` doesn't conflate with `mcp/linear@destination`. Constraint warnings still surface `source_not_in_inventory:<ref>` / `destination_not_in_inventory:<ref>` and now reflect the role-tagged refs.
- **Meta-catalyst body** at [mcp-orbit-components/meta-catalyst.md](lib/mcp/mcp-orbit-components/meta-catalyst.md) — six-categories table collapsed to five-categories; new "How roles work" subsection with an example `component_refs` JSON literal showing role tags; constraint table reworked (constraint 3 is the affordance/role invariant, constraint 4 references "≥2 distinct mcp entries in role: 'destination'" for branching, etc.); "What to avoid" list grows a bullet calling out the role tag as non-optional for mcp entries. The artifact-scope principle template in the commit-discipline section now writes `mcp/linear@0.1.0 (role=source), mcp/gdrive@0.1.0 (role=destination)` so the durable audit string carries the role.
- **Tool descriptions** in [lib/mcp/tools/mcp-orbit.js](lib/mcp/tools/mcp-orbit.js) — `list_mcp_orbit_components` and `get_mcp_orbit_component` input-schema enums now show `['mcp','trigger','pattern','idempotency','render']`, and descriptions teach the affordances + roles distinction. `recommend_mcp_orbit_compositions` description unchanged (the surface is the same; the inner shape changed).
- **Docs** — [docs/mcp-orbit.md](../docs/mcp-orbit.md) rewritten around the five-category + roles model; CLAUDE.md Ring 6 section, and `forward_context` Ring 6 + orientation-rule entries in [lib/mcp/tools/context.js](lib/mcp/tools/context.js) updated to use the new shape (the three places that listed the six-tuple `(source × destination × ...)` now list the five-tuple `(mcp × ...)` and explain roles inline).
- **Test suite** — repository tests gain coverage for: role validation (missing role on mcp entry, unknown role, role on non-mcp kind, same mcp ref in distinct roles), legacy-kind rejection, and the `MCP_ROLES` export. Loader tests use `mcp/` fixture dirs (the legacy `source/` dir is now skipped as a non-kind); a new test asserts every shipped mcp component declares its affordances map. Tool tests assert the recommender returns the expected role-tagged refs for the weekly-digest fixture (linear=source, gdrive=destination) and the e2e fixture's artifact-scope principle string uses the new `(role=source)` / `(role=destination)` shape. **All 391 lib tests pass.**

### Composer: signal-driven routing shape

The check that the role refinement actually generalizes. 0.4.0's substrate produced exactly one canonical workflow shape (scheduled aggregation: Linear → Drive weekly digest). If the composer can't generalize past that — if "ship more components" produces "more variants of the same canonical shape" — the role refactor's worth questioning. This change ships the components for an orthogonal shape (signal-driven routing: Gmail → Linear support handoff) and proves the composer assembles it end-to-end from the same store. The e2e test asserts the recommender picks `signal-polled / routing / source-side-label` for the gmail-support intent and `scheduled / aggregation / window-key` for the weekly-digest intent without any prompt engineering past the operator's natural-language ask. Composition surface validated.

#### Added

- **Four new starter components** that together compose the gmail-support-thread-to-linear-issue catalyst from typed parts:
  - [mcp-orbit-components/mcp/gmail.md](lib/mcp/mcp-orbit-components/mcp/gmail.md) — Gmail MCP with `affordances: { read: true, write: true, watch: true }`. Source-role surface covers `search_messages` + `get_thread` + `list_history` with the history-id cursor; destination-role covers `send_message` / `create_draft` / `modify_labels` with the draft-first discipline. Pitfalls call out the reply-loop hazard (the `exclude_self` knob is on by default), the history-id horizon (~7 days, fall back to date-window + re-baseline), and labels as the state surface for `idempotency/source-side-label`. Watch affordance declared `true` but the body explicitly notes that polling is the default — Pub/Sub push requires GCP setup almost no operator has done.
  - [mcp-orbit-components/trigger/signal-polled.md](lib/mcp/mcp-orbit-components/trigger/signal-polled.md) — cadence-based polling trigger for source MCPs that don't push. Carries the cursor discipline (advance ONLY after all per-event downstream writes succeed), the first-run cursor default (`now`, never `beginning` — backfill is an explicit opt-in), and the two-part safety constraint (requires source `capabilities.cursor: true` AND an idempotency component; pre-flight checks surface `signal_polled_without_source_cursor` as a warning). Re-entrant polling, cursor-horizon expiry, empty-poll burn, and quota cliffs are all called out as pitfalls with concrete mitigations.
  - [mcp-orbit-components/pattern/routing.md](lib/mcp/mcp-orbit-components/pattern/routing.md) — 1:1 cognitive shape (each source event → one destination record), the complement to `pattern/aggregation`'s N:1. Four knobs (`match_filter`, `routing_target`, `include_source_context`, `reply_to_source`) with prescriptive defaults; pitfalls cover TOCTOU under overlapping polls, reply loops, archived destinations, and PII in routed records. Redirect rules point intent that's actually aggregation / enrichment / branching back to those patterns instead of stretching routing past its shape.
  - [mcp-orbit-components/idempotency/source-side-label.md](lib/mcp/mcp-orbit-components/idempotency/source-side-label.md) — the TOCTOU-safe dedupe strategy for signal-driven workflows. After a successful destination write, apply a marker on the source-side event (Gmail label, Slack reaction, source-MCP-specific affordance) and auto-extend the source query with `-marker:<name>` so subsequent polls exclude processed events. Body explicitly maps the two timing modes (`on_destination_success` is the right default; `on_processing_start` is faster-but-loses-events-on-failure) and is candid about the residual TOCTOU window under overlapping polls — full safety requires either re-entrance prevention at the trigger (default v0 posture) or a destination-side existence check before write. Hard `fits.triggers: ['signal-polled', 'signal-push']` constraint means the recommender doesn't propose this with `scheduled`.
- **`intentKeywords` payload field** added to every shipped non-mcp component (`trigger/scheduled`, `trigger/signal-polled`, `pattern/aggregation`, `pattern/routing`, `idempotency/window-key`, `idempotency/source-side-label`). The recommender uses these to pick the trigger / pattern / idempotency that fit the operator's natural-language ask — "when X happens, file Y" picks `signal-polled + routing + source-side-label`; "weekly X digest into Y" picks `scheduled + aggregation + window-key`. The `mcp/linear`, `mcp/gdrive`, `mcp/gmail` components also gained `intentKeywords` but the mcp selection still uses the existing `intentMentionIndex` (earliest mention = source, latest = destination) — the keywords are additive metadata for future ranking refinements.

#### Changed

- **`buildCandidateComposition`** in [lib/mcp/tools/mcp-orbit.js](lib/mcp/tools/mcp-orbit.js) — generalized past the canonical-shape v0 picker. Two new helpers (`intentKeywordScore`, `pickByIntent`) rank candidates by `intentKeywords` matches in the operator's intent prose, with alphabetical tiebreak for determinism. `fitsTrigger` enforces the per-component `fits.triggers` constraint so a pattern / idempotency that only pairs with `scheduled` doesn't get proposed alongside `signal-polled`. The picking order is now: trigger → pattern (filtered to those that fit the trigger) → idempotency (filtered to those that fit the trigger). When the filter empties the candidate pool (no pattern fits the chosen trigger), the recommender falls back to the unfiltered pool rather than refusing to return a candidate — a candidate with a constraint warning is more useful than a `no_components_available` 4xx.
- **Loader test suite** in [lib/mcp/mcp-orbit-components/loader.test.js](lib/mcp/mcp-orbit-components/loader.test.js) — shipped-components assertion bumped from 5 to ≥9 components and now lists every kind/ref pair across both shapes. New test asserts every non-mcp shipped component declares a non-empty `intentKeywords` array (the recommender depends on this; a missing keyword set silently breaks shape disambiguation).
- **Tool test suite** in [lib/mcp/tools/mcp-orbit.test.js](lib/mcp/tools/mcp-orbit.test.js) — `list_mcp_orbit_components` assertion expanded to cover all 9 shipped refs. Two new test blocks exercise the gmail-support shape end-to-end: one asserts the recommender returns the right role-tagged components (`mcp/gmail@source`, `mcp/linear@destination`, `trigger/signal-polled`, `pattern/routing`, `idempotency/source-side-label`), and the second walks the full seven-step composition flow against this shape (recommend → meta-catalyst → component bodies → knob negotiation → status transitions → audit log entry). The second test also verifies the `mcp/gmail` body carries BOTH a source-role section AND a destination-role section — the role refinement only pays off if mcp bodies actually teach both sides. **All 394 lib tests pass** (391 → 394: +3 for the gmail-support shape coverage).

#### Composition outcomes

The composer now generalizes past the single canonical shape:

- **Weekly Linear digest into Drive** (intent: `"weekly Linear digest into Drive — Monday morning summary so I stop opening Linear every week"`) → composes `mcp/linear (source) + mcp/gdrive (destination) + trigger/scheduled + pattern/aggregation + idempotency/window-key`.
- **Gmail support thread routed into Linear** (intent: `"When a Gmail support thread arrives in the inbox, file a Linear issue with the conversation context"`) → composes `mcp/gmail (source) + mcp/linear (destination) + trigger/signal-polled + pattern/routing + idempotency/source-side-label`.

Both compositions assemble from the same store, validate against the same constraint table, and persist as audit-able rows in the composition log.

### Primitive-binding layer

A second layer parallel to the vendor-shaped mcp-orbit composer: curated **vendor-agnostic primitive bodies** (`document-store`, `structured-record-store`) plus a **deterministic generator** that fills role-specific markdown templates against a capability snapshot the agent introspects from each installed MCP. The two layers coexist intentionally — the vendor composer ships curated vendor-specific knowledge (pitfalls, intent), the primitive layer covers vendor-agnostic tool-shape via introspection. A cauterize gate (`MOJULO_MCP_ORBIT_VENDOR_DISABLED=1`) lets the operator force the agent through the primitive flow without removing the vendor surface — useful for proving end-to-end coverage before retiring vendor curation.

#### Added

- **Two primitives** under [mcp-orbit-components/primitive/](lib/mcp/mcp-orbit-components/primitive/), each as a body + source-role template + destination-role template:
  - `document-store` (Drive, Notion, OneDrive, Dropbox, S3-with-keys) — `find-by-key-in-scope` / `read-content` / `list-recent` / `get-metadata` / `subscribe-to-changes` affordance set. Per-role templates carry slot markers for tool name + schema fill at bind time.
  - `structured-record-store` (issue trackers — Linear, GitHub Issues, Jira; CRMs — HubSpot, Salesforce, Pipedrive; spreadsheet-databases — Airtable, Notion DB) — `find-by-filter` / `read-content` / `list-recent` / `create-record` / `comment-on-record` / `transition-status` / `update-fields` / `upsert-by-key` affordance set. The primitive deliberately spans typed-record backends across all three categories — what unifies them is the typed-record shape and structured-filter query. Cross-primitive overlap with `document-store` is called out in the body so authors of future primitives see when names should rhyme vs diverge.
- **Capability-snapshot generator** in [mcp-orbit-components/generator.js](lib/mcp/mcp-orbit-components/generator.js) — deterministic template fill (no LLM in the generator itself) that takes a primitive body, a role-specific template, and a capability snapshot and produces a session-scoped provider artifact with affordance binding manifest + tool-name resolution + confidence labels per affordance. Three-tier confidence: `tools_list_full` (introspected with schemas) > `names_only` (tool names but no schemas) > `agent_inferred` (agent best-guess from prior knowledge).
- **`mcp_orbit_provider_artifacts` table** in [control/data/mojulo-lite.db](data/) — stores generated artifacts so the agent can reference a stable ref between `bind_primitives` and the subsequent `meta_context_commit`, and so the artifact is auditable as the durable link between primitive + snapshot + bound tool names + confidence. Repository in [lib/db/repositories/mcp-orbit-provider-artifacts.js](lib/db/repositories/mcp-orbit-provider-artifacts.js); columns: `primitive_ref`, `role` (`source` | `destination` CHECK), `server`, `introspected_at`, `snapshot_confidence`, `body_md`, `manifest_json`, `bindings_json`.
- **`bind_primitives` MCP tool** in [lib/mcp/tools/mcp-primitive-binding.js](lib/mcp/tools/mcp-primitive-binding.js) — Ring 6 tool registered LAST. Takes a composition ref + per-primitive-role binding spec, loads each primitive's role-specific template, fetches the live capability snapshot from `meta_mcp_inventory`, runs the generator, persists the artifact, and returns the artifact ref + affordance binding manifest. The split from `get_meta_catalyst` is deliberate: meta-catalyst is the rulebook (cacheable per session), bindings are per-composition synthesis (not cacheable).
- **Extended capability snapshots in `meta_mcp_inventory`** — `input_schema_json` (per-tool JSON schema as introspected) + `introspection_confidence` (the three-tier confidence label) columns added via [migrateInventoryColumns](lib/db/index.js) (backward-compatible — existing rows have NULL, generator treats NULL as `names_only`). The `meta_context_declare_inventory` tool accepts the richer per-tool shape; old shape still works (silently downgrades to `names_only` confidence for those tools).
- **Adapter teaching** in [adapters/claude-code.md](lib/mcp/adapters/claude-code.md), [adapters/codex.md](lib/mcp/adapters/codex.md), [adapters/generic.md](lib/mcp/adapters/generic.md) — each adapter body grows a primitive-binding section explaining the introspection step the host agent is responsible for, the artifact-ref handoff to `meta_context_commit`, and how the artifact's bindings map onto the host's downstream rendering. Combined +266 lines.
- **Cauterize gate** in [lib/mcp/server.js](lib/mcp/server.js) — when `MOJULO_MCP_ORBIT_VENDOR_DISABLED=1`, `registerMCPOrbitTools()` is skipped. The primitive-binding tool registers regardless. Tests don't set the flag and continue to register the full surface. The gate exists for operators who want to force the agent through the primitive flow without removing the vendor composer's commits — a deliberate parallel-track posture during the transition.

#### Changed

- **`meta_context_brief`** in [lib/mcp/tools/meta-context.js](lib/mcp/tools/meta-context.js) — extended +280 lines to surface primitive-binding artifacts on fleet briefs, with corresponding test coverage +250 lines. `forward_context` Ring 6 section gains the primitive-binding flow as the second layer alongside the vendor composer.

### Decuration prep

Forward-declarations against the next change. Adds a fourth vendor body following the same bidirectional shape as the existing three, and a catalyst that defines the agent's research methodology for vendor knowledge. The catalyst references tools (`record_mcp_capabilities`, `get_mcp_capabilities`) that arrive in the next change — committed early as the prose-and-process is stable independent of the persistence side.

#### Added

- [mcp-orbit-components/mcp/notion.md](lib/mcp/mcp-orbit-components/mcp/notion.md) — fourth vendor body. Multi-faceted: page-side surface (`notion-search` / `notion-fetch` / block-tree content model) and data-source-side surface (`notion-query-data-sources` / row-in-data-source writes). Pitfalls cover the API 2025-09-03 `database` → `data_source` rename, search title-only semantics, the 100-block per-children cap, page-vs-data-source-row schema mismatch, and integration-sharing being page-level not workspace-level. The richest of the four vendor bodies — sets the bar for the depth a researcher should target.
- [catalysts/research-mcp-vendor.md](lib/mcp/catalysts/research-mcp-vendor.md) — catalyst defining the agent's methodology for researching an MCP end-to-end via primary web sources: source priority order (server source/README → official monorepo → vendor developer docs → package metadata → registry), the triangulation rule (non-trivial claims need a priority-1 or priority-3 backing), what to extract (tool list with input schemas, affordances, capabilities, intent keywords, pitfalls), the canonical output body shape (matching the four existing vendor bodies), honesty rules (mark unconfirmed claims, refuse training-data priors, cite even single-fact contributors), multi-server-per-vendor handling, behavior contract. Forward-declares against `record_mcp_capabilities` / `get_mcp_capabilities` — the catalyst is shape-stable; the tools land next.

### Decuration: provider identity layer + capabilities persistence

The implementation arrives behind the [research-mcp-vendor catalyst](lib/mcp/catalysts/research-mcp-vendor.md) committed earlier. Two new Ring 6 tables — `meta_mcp_providers` (identity layer) and `meta_mcp_capabilities` (vendor knowledge facet with append-with-supersession semantics) — plus a `provider_id` foreign key on `meta_mcp_inventory` so both paths to knowing an MCP (introspection and research) converge on the same provider row. The supersession invariant is enforced at the DB layer via a unique partial index; a deterministic four-rule canonicalizer derives `provider_ref` from raw server names so the identity layer populates as a side-effect of inventory writes — no `register_mcp_provider` tool needed, by design. This drop is the persistence side only; the MCP tool surface (`record_mcp_capabilities` / `get_mcp_capabilities`), the seed migration that ships the four vendor bodies as starter rows, the composer rewiring that consumes the consolidated view, and the cauterize gate removal land in subsequent drops.

#### Added

- **`meta_mcp_providers` + `meta_mcp_capabilities` tables** in [control/data/mojulo-lite.db](data/), schema in [lib/db/index.js](lib/db/index.js). Providers: one row per logical MCP keyed on canonical lowercase `provider_ref` (e.g. `gmail`, `notion`, `linear`) with first-writer-wins `display_name`. Capabilities: `provider_id` FK + `version_tag` (nullable when docs declare nothing) + `body_md` + `source_urls` (JSON array) + `discovered_at` + `superseded_by`, with a **unique partial index** `idx_meta_mcp_capabilities_current ON meta_mcp_capabilities(provider_id) WHERE superseded_by IS NULL` enforcing at most one current row per provider. Supersession is mandatory, not optional. `ON DELETE CASCADE` from providers so removing a provider row cleans up its capability chain.
- **`provider_id` column on `meta_mcp_inventory`** via the existing `migrateInventoryColumns` pattern, plus `idx_meta_mcp_inventory_provider` index. Backward-compatible — existing rows have NULL provider_id, populated lazily on the next inventory replace. Capabilities indexes follow the `idx_meta_mcp_*` naming convention for consistency with the inventory indexes.
- **Canonicalizer** in [lib/mcp/providers/canonicalize.js](lib/mcp/providers/canonicalize.js) — pure four-rule function (lowercase → strip leading host prefix `claude_ai_` / `claude-` / `@vendor/` scope → strip trailing MCP suffix `-mcp-server` / `_mcp_server` / `-mcp` / `_mcp` → normalize separators to underscore). Genuine ambiguity is the agent's job to disambiguate via explicit `provider_ref` on capability writes; v0 has no inventory-time override (additive v1 if collision rate justifies). Examples: `claude_ai_Gmail` → `gmail`; `claude_ai_Google_Drive` → `google_drive`; `@notionhq/notion-mcp-server` → `notion`; `notion-mcp-server` → `notion`; `linear` → `linear`.
- **Providers repository** in [lib/db/repositories/mcp-providers.js](lib/db/repositories/mcp-providers.js): `upsertByRef` (first-writer-wins on `display_name`; subsequent calls return the existing row without overwriting), `getByRef`, `getById`, `listAll`. No `register_mcp_provider` MCP tool — providers are upsert side-effects only, since a row with no facets is useless. Identity-row corrections (display_name typos, provider_ref splits) deferred to v1 per the plan.
- **Capabilities repository** in [lib/db/repositories/mcp-capabilities.js](lib/db/repositories/mcp-capabilities.js): `insert` (transactional upsert-provider + insert-with-supersession in one txn), `getCurrent`, `getAsOf` (walks the chain to find the row current at a given unix timestamp), `listForProvider`, `consolidatedView` (composer-facing JOIN of provider identity + inventory facet + capabilities facet, with `provenance: 'seed' | 'research'` derived from `sourceUrls[0]` — `mojulo://` prefix marks the row as a build-time seed, anything else as agent-research). The supersession dance is **three statements** (insert new with `superseded_by = prior.id` as non-NULL placeholder → flip prior's `superseded_by` to `new.id` → clear new's `superseded_by` to NULL) because SQLite's unique partial index fires per-statement, not at commit; briefly produces a benign FK cycle. Documented inline in the repository header.

#### Changed

- **`InventoryRepository.replaceInventory`** in [lib/db/repositories/mcp-inventory.js](lib/db/repositories/mcp-inventory.js) — within the existing replace transaction, each server name is canonicalized once and the matching provider row is upserted; `provider_id` is stamped on every tool row. Two install aliases that canonicalize to the same provider (e.g. `claude_ai_Notion` + `notion-mcp-server`) share the same `provider_id`, collapsing into one logical "notion" provider — the identity layer working as designed. The tool's input shape is **unchanged** — provider resolution is purely additive on the write path. Orphan provider rows persist after inventory replace (no cleanup in v0); their capabilities remain queryable for historical `getAsOf` walks, and the next inventory declare reuses them if the alias comes back. `rowToTool` now exposes `providerId` on returned rows.
- **Test suite** — **+100 new tests** across the new modules. 32 for the canonicalizer (example cases + lowercase normalization + leading prefix handling + trailing suffix handling + separator normalization + error cases + idempotency + rule-table invariants). 25 for the providers repository (schema bootstrap + UNIQUE enforcement + upsert idempotency + first-writer-wins + display_name normalization + multi-provider isolation + validation). 37 for the capabilities repository (schema bootstrap + unique partial index + FK cascade + first-insert + supersession chain across three writes + raw-SQL bypass rejection + isolation across providers + `getAsOf` walk + `consolidatedView` across five facet combinations + provenance derivation). 6 added to [lib/db/repositories/mcp-inventory.test.js](lib/db/repositories/mcp-inventory.test.js) (provider row creation + provider_id stamping + alias collapse + `rowToTool.providerId` + orphan persistence + linear edge case). [lib/db/repositories/meta-context.test.js](lib/db/repositories/meta-context.test.js) assertion lists updated for the new tables/indexes. **All 579 lib tests pass.**

### Decuration: capability tools + seed migration

The forward-declared tools land. `record_mcp_capabilities` and `get_mcp_capabilities` ship as Ring 6 MCP tools; the `research-mcp-vendor` catalyst's `mcpTools.mojulo` references are now real. The four curated vendor bodies relocate from `mcp-orbit-components/mcp/` to `seeds/mcp-capabilities/` and ship via a seed migration that materializes them as starter rows on first boot — honestly attributed to mojulo (`source_urls[0]` is `mojulo://CHANGELOG#v0.5.0`, `discovered_at` is the v0.5.0 release sentinel, `provenance` is `seed`). The `'mcp'` kind drops from the component loader's allowlist; vendor knowledge is no longer a composable component, it's a Ring 6 surface. The composer rewiring that consumes the consolidated provider view lands next.

#### Added

- **`record_mcp_capabilities` + `get_mcp_capabilities`** in [lib/mcp/tools/mcp-capabilities.js](lib/mcp/tools/mcp-capabilities.js), registered in [lib/mcp/server.js](lib/mcp/server.js) between `registerInventoryTools()` and the cauterize-gated mcp-orbit composer. Drive the capabilities repository's transactional supersession + `asOf` chain walks; surface a `no_operator_anchor` warning when KYC is missing; return a `hint` pointing at the catalyst when no row exists.
- **Seed migration** at [lib/mcp/seeds/mcp-capabilities-seed.js](lib/mcp/seeds/mcp-capabilities-seed.js) — `seedMcpCapabilities()` parses each seed body's frontmatter for `capabilities.apiVersion` and the `<!-- sources -->` URLs, inserts one starter row per provider where none exists. Per-provider idempotent — agent-research rows are never overwritten. Called lazily from `registerCapabilitiesTools()` so test isolation stays intact.
- **`seeds/mcp-capabilities/{gmail,linear,gdrive,notion}.md`** — the four curated vendor bodies in their new location.

#### Changed

- **`COMPONENT_KINDS` in [lib/db/repositories/mcp-orbit.js](lib/db/repositories/mcp-orbit.js)** drops `'mcp'`; new enum `['trigger', 'pattern', 'idempotency', 'render']`. The SQL `CHECK` constraint is intentionally untouched (v0.4.x DB compat; the loader's `deleteAllBuiltins()` clears any leftover `'mcp'` rows on next boot). Composition `component_refs` validation still recognizes `kind: 'mcp'` entries — those resolve to provider rows under the composer rewiring landing next.
- **Loader + repo tests** updated for the new layout: fixtures switched from `'mcp'` to `'pattern'` (behavior under test is kind-agnostic), shipped-component assertion drops the four `mcp/*` refs (≥9 → ≥6), legacy-kinds-skip test now covers `'mcp'`. **+46 tests across the two new modules (24 capabilities tools + 22 seed migration); 612 lib tests pass, 12 recommender failures expected — they resolve in the next drop.**

### Decuration: composer rewiring + cauterize revert + smoke

The closing chapter. The mcp-orbit composer now reads vendor knowledge through a **consolidated provider view** (`CapabilitiesRepository.consolidatedView`) that joins the identity layer with both facets — inventory introspection and capabilities research — into one record per logical MCP. Five composer states per chosen provider — `research`, `seed`, `inventory_only`, `capabilities_only`, `none` — each with its own warning tag (`seed_capabilities:<ref>` / `no_capabilities_recorded:<ref>` / `not_installed:<ref>`) so the agent routes remediation directly. The `rationale.catalystHint` field surfaces the research-mcp-vendor catalyst by name when at least one chosen provider isn't research-grade. With the composer reading from Ring 6 surfaces end-to-end, the cauterize gate becomes unnecessary and reverts: `MOJULO_MCP_ORBIT_VENDOR_DISABLED` no longer skips the composer, and the `forward_context` banner that warned about it is removed. The forward_context Ring 6 section is rewritten around the new architecture (identity layer + two facets + composer's consolidated read), and the fleet brief gains a `vendorKnowledge` section keyed by provider with `provenance` + freshness.

#### Added

- **Catalyst smoke tests** in [lib/mcp/tools/mcp-capabilities.test.js](lib/mcp/tools/mcp-capabilities.test.js) — five end-to-end scenarios exercising the full vertical: seed → tool surface → composer re-read. Verifies notion starts as `provenance: 'seed'`, the catalyst's `record_mcp_capabilities` call supersedes the seed and flips provenance to `'research'`, `asOf` walks back to the seed row from before the supersession, the composer drops the `seed_capabilities:notion` warning after the research write, and re-running the seed migration after research is a no-op (agent rows are never clobbered).
- **`vendorKnowledge` section on `meta_context_brief({kind:'fleet'})`** — keyed by provider, surfaces `{ provider_ref, display_name, hasInventory, hasCapabilities, capabilitiesVersionTag, capabilitiesDiscoveredAt, ageSeconds, capabilitiesProvenance }`. `provenance: 'seed' | 'research'` distinguishes build-time seed bodies from agent-research; `ageSeconds` computed at read time. Agents read this to decide when to invoke the research catalyst.

#### Changed

- **Composer in [lib/mcp/tools/mcp-orbit.js](lib/mcp/tools/mcp-orbit.js)** rewired around the providers identity layer. `buildCandidateComposition` enumerates providers via `ProvidersRepository.listAll()`, reads each through `CapabilitiesRepository.consolidatedView`, and collapses the result into a `providerProfile` (state + affordances + intent-matching hints + installed flag). Source/destination selection prefers installed providers, breaks ties on earliest/latest intent mention. The five composer states gate the warning vocabulary; `not_installed:<ref>` / `seed_capabilities:<ref>` / `no_capabilities_recorded:<ref>` replace the prior `source_not_in_inventory:` / `destination_not_in_inventory:` pattern. `listComponentsHandler({kind:'mcp'})` and `getComponentHandler({kind:'mcp'})` now serve from the providers identity layer (capabilities body + frontmatter parsed as payload) so the agent-facing API stays consistent across kinds without exposing the storage shift. The pre-decuration `inventoryMatchesHints` helper is removed — provider identity collapses install aliases at the canonicalizer step, so the composer no longer fuzzy-matches server names at recommendation time. The `inventory` input param to `recommend_mcp_orbit_compositions` is also removed — the composer reads providers directly.
- **`gdrive` → `google_drive` rename** in [seeds/mcp-capabilities/google_drive.md](lib/mcp/seeds/mcp-capabilities/google_drive.md) and the seed migration's `DISPLAY_NAMES` map. Aligns the seed body's `provider_ref` with what the canonicalizer produces for `claude_ai_Google_Drive` (the standard Claude Code MCP namespace for the Drive vendor), so seeded research-grade knowledge and operator inventory converge on the same provider row instead of fragmenting into `gdrive` + `google_drive`. Test fixtures and audit-string examples updated to match.
- **Cauterize gate reverted** — `MOJULO_MCP_ORBIT_VENDOR_DISABLED` env flag check in [lib/mcp/server.js](lib/mcp/server.js) removed; `registerMCPOrbitTools()` always registers now. The conditional banner in [lib/mcp/tools/context.js](lib/mcp/tools/context.js) that announced "vendor-shaped composer is disabled" is removed entirely. The composer is the supported primary path; the primitive-binding layer ([lib/mcp/tools/mcp-primitive-binding.js](lib/mcp/tools/mcp-primitive-binding.js)) continues to ship alongside it as the runtime-introspected alternative.
- **`forward_context` Ring 6 section** rewritten to introduce the providers identity layer + the two facets + the seeding posture + the research-mcp-vendor catalyst as the refresh path. Heading updated to "Deliberation (Ring 6 — the substrate for structural reasoning: contextmap, inventory, capabilities, composer)"; new `record_mcp_capabilities` / `get_mcp_capabilities` bullet; composer bullet rewritten around the five-state taxonomy and the warning tag vocabulary that drives the agent's remediation routing.

#### Composition outcomes

Identity layer in production. **All 629 lib tests pass across 26 files**: +5 from the catalyst smoke and the test suite updates that exercise the consolidated view, the new warning tags, and the catalyst hint. The 12 recommender failures from the previous drop resolve. The decuration arc closes: identity + facets + tools + seeds + composer + catalyst all wired together; vendor knowledge moves from build-time curation through agent research at the operator's own clock, with full audit chain via supersession.

### Primitive domain expansion + posture shift

With the primitive-binding architecture and the four-primitive ambition validated against `document-store` and the renamed `structured-record-store`, the next move was to push the primitive layer past the two original shapes and prove the generator + binding flow generalizes. This release also flips the recommended-composer posture: `bind_primitives` is now the supported path for MCP-to-MCP composition (the path most MCP-capable agents will take, since runtime tool-schema knowledge is the common case), and the vendor-shaped `recommend_mcp_orbit_compositions` flow steps back to seed-reasoning duty for first-encounter scaffolding.

#### Added

- **Two new primitives** under [mcp-orbit-components/primitive/](lib/mcp/mcp-orbit-components/primitive/), each as body + source-role template + destination-role template:
  - `messaging-channel` (Slack, Discord, Teams) — scope-addressable chat with thread sub-grouping, audience is scope members. `list-recent-in-scope` / `read-content` / `find-by-filter` / `get-metadata` / `subscribe-to-changes` source-role; `post-to-scope` / `post-to-thread` / `react-to-message` / `post-ephemeral` destination-role. The `-in-scope` suffix on `list-recent-in-scope` is load-bearing: messaging-channel reads require a scope id, unlike `document-store`'s flat `list-recent`. Cross-primitive overlap is called out per affordance — names rhyme across primitives only where the underlying shape genuinely transfers.
  - `message-thread` (Gmail, Outlook) — directed mail semantics with reply identity, audience is *named recipients*, threads grow by reply. `search-threads` / `read-thread` / `list-recent-in-mailbox` / `get-thread-metadata` / `subscribe-to-new-messages` source-role; `send-thread-message` / `create-draft` / `apply-label` destination-role. The audience model is what distinguishes this from `messaging-channel`: scope-broadcast (channel) vs recipient-directed (thread). The two primitives deliberately stay separate.
- **Capability-generator integration with all four primitives** — [generator.js](lib/mcp/mcp-orbit-components/generator.js) and [primitive-binding.js](lib/mcp/tools/mcp-primitive-binding.js) tool description now name all four primitives explicitly. Generator tests cover Linear and GitHub fixtures binding `structured-record-store` (typed-record shape across issue-tracker-flavored backends) to validate the generator + slot vocabulary survive a second primitive without changes; the test block frames the validation explicitly as "the gate before plumbing a tool surface around the architecture." CRM (HubSpot) and spreadsheet-database (Airtable, Notion DB) fixtures are deferred as future coverage.

#### Changed

- **`issue-tracker` → `structured-record-store` rename, with broadened backing scope.** The `issue-tracker` primitive (Linear / GitHub Issues / Jira / Asana / Shortcut) is renamed and generalized to `structured-record-store` — same affordance vocabulary, but the primitive now spans **issue trackers + CRMs (HubSpot, Salesforce, Pipedrive) + spreadsheet-databases (Airtable, Notion DB)**. The unifying shape is **typed records with stable ids, structured-field queries, and optional status / comment / upsert workflows**; what varies — status workflow vs stage-as-field, native upsert vs simulate, threading vs flat comments — is captured per-affordance in the support taxonomy. Affordances renamed to match the broader scope: `create-issue` → `create-record`, `comment-on-issue` → `comment-on-record`, `update-issue-fields` → `update-fields`, plus a new `upsert-by-key` affordance for CRM / spreadsheet-DB sync workflows (rare on issue trackers, defining on CRMs). Old primitive files (`primitive/issue-tracker.*`) deleted; mcpInventoryCategory `issue_tracker` → `structured_record_store` propagated through the linear seed body, the three mcp-orbit catalysts (`gmail-support-thread-to-linear-issue`, `linear-issue-closed-branched-notification`, `weekly-linear-digest-to-drive`), the `research-mcp-vendor` author guide, the mcp-orbit doc example, and the recommender test fixtures. Real-world descriptive uses of "issue tracker" (e.g. "Linear is an issue tracker") stay — those describe the world; the primitive name is what changed.
- **`bind_primitives` reframed as the recommended composer for MCP-to-MCP workflows.** The tool description in [mcp-primitive-binding.js](lib/mcp/tools/mcp-primitive-binding.js), the `forward_context` Ring 6 bullet in [context.js](lib/mcp/tools/context.js), and the three adapter docs (`adapters/claude-code.md`, `adapters/codex.md`, `adapters/generic.md`) all drop the "experimental / validating in parallel / parallel-track" framing and reframe as: primitive binding is the supported path; the vendor-shaped `recommend_mcp_orbit_compositions` flow remains as a seed-reasoning surface for first-encounter scaffolding when runtime tool-schema knowledge is missing. Section headings updated from "Primitive binding flow (parallel path, runtime-introspected)" → "Primitive binding flow (no-bot composition)" across all three adapters.
- **Doc orientation rewrite for the v0.5.0 surface.** [CLAUDE.md](../CLAUDE.md) Ring 6 section moves from three deliberation surfaces (contextmap / inventory / mcp-orbit composer) to **five** (adds capabilities and primitive-binding as distinct first-class surfaces with their own bullets), and the data-layout section now names every Ring 6 table including `meta_mcp_providers`, `meta_mcp_capabilities`, and `mcp_orbit_provider_artifacts`. [docs/mcp-orbit.md](../docs/mcp-orbit.md) gains a "Primitive-binding layer" section with the four-primitive table + the generator's deterministic-fill semantics + the artifact persistence + the `primitive_artifact_materialization` commit flow; the schema section adds the `mcp_orbit_provider_artifacts` DDL. [docs/meta-context.md](../docs/meta-context.md) documents the third `meta_context_commit` type (`primitive_artifact_materialization`) with full payload shape + behavior + audit-chain semantics, and the "What sits on top" section grows from one composer to three Ring 6 surfaces (capabilities + vendor-shaped composer + primitive-binding). [docs/mcp-integration.md](../docs/mcp-integration.md) Recipe 5 splits into "Primitive-binding flow (recommended)" + "Vendor-shaped composer flow (seed-reasoning fallback)" to teach the choice between the two paths.

### CI

#### Added

- **[.github/workflows/publish-release.yml](../.github/workflows/publish-release.yml)** — fires on `v*` tag push (e.g. `v0.4.0`), slices the matching `## [X.Y.Z]` section out of [CHANGELOG.md](CHANGELOG.md), and creates a GitHub Release with that body marked as `--latest`. Fails loudly if the section is missing — won't push a release tag with no changelog entry. `bot-v*` tags are unaffected — those start with `b` and are handled by `publish-bot-image.yml`.

## [0.4.0] — 2026-05-23

Ring 6 — the deliberation substrate — comes online. Three structurally-distinct surfaces (contextmap, inventory, mcp-orbit composer) decenter mojulo from the bot: the bot factory becomes one capability bay, Ring 6 becomes the hull. The release also activates the non-bot axis — operators can now use mojulo to compose MCP-orchestrated workflows over their installed MCPs (Gmail/Drive/Calendar/Linear/etc.) without deploying a chatbot at all, with the contextmap as the durable audit trail and the mcp-orbit composer as the synthesis surface.

`meta_context` ships as **Ring 6** — a writeable, durable deliberation surface that records *why* structural decisions were made, not just *what* happened. Two MVP write triggers (operator KYC and artifact materialization) with adapter-delegated verification, a graph schema of bots / catalysts / adapters / artifacts / mcp_tools / operator nodes plus seeded / materialized_by / runs_for / binds edges, and principles (markdown rationale) attached to either nodes or edges. The bright line is operational: writes happen at **structural** events (operator pivots, artifact materializations) — never at **outcome** events (conversations, automation runs). That asymmetry is what makes the layer auditable; outcomes happen at run-rate, structural decisions at deliberation-rate. The graph is **append-only by design** — no deprecation events, no tombstones, no auto-pruning. Operator owns manual cleanup via SQL. See [docs/meta-context.md](../docs/meta-context.md).

This release also closes a synthesis ↔ deliberation loop the design called out: `recommend_catalysts` now consults the contextmap automatically and surfaces both the operator anchor (`operatorAnchor` / `suggest_kyc`) and per-catalyst `priorMaterializations`, so the agent can triage overlap / synergy / orthogonality at the recommendation surface without remembering to call `meta_context_brief` first.

Building on the spine, this release also ships **`meta_context_declare_inventory`** — the entry point for using mojulo *without* deploying a chatbot. Mojulo's mainline tooling is heavily bot-shaped (build → deploy → operate → catalyst-against-a-bot); the inventory primitive activates the other axis: MCP-orchestrated workflows synthesized over the user's installed MCPs (Gmail/Drive/Calendar/Linear/HubSpot/etc.) directly, with mojulo as the deliberation anchor and audit trail rather than the conversational runtime. The connecting agent declares which MCPs are connected and which tools each exposes; once inventory is on record, the operator's broader environment is part of mojulo's worldmodel. The bright line gets a second axis at this surface: contextmap writes are sealed structural decisions (append-only); inventory writes are current environment state (replace). Mixing them would let the graph slowly diverge from reality — so inventory lives in its own table with **replace semantics** (DELETE + INSERT in one transaction), separate from `meta_nodes` / `meta_edges` / `meta_principles`. See [lite-template/integration/MCP_INVENTORY_PLAN.md](../lite-template/integration/MCP_INVENTORY_PLAN.md) for the design.

Sitting on top of inventory, this release also opens the **mcp-orbit component store** — the next infrastructure layer past hand-written mcp-orbit catalysts. Three monolithic mcp-orbit recipes gave us the vocabulary, but ~30% of every body was identical scaffolding and ~40% was pattern-shared with recipe-specific content; continuing down that path means hand-authoring N×M×T×K recipes for N sources × M destinations × T triggers × K patterns. The right move is to decompose: a constrained set of **typed components that combine multiplicatively** — `source` × `destination` × `trigger` × `pattern` × `idempotency` × `render` — that the agent assembles under the meta-catalyst's discipline. Server-stored (typed rows with validation), agent-composed (judgment under uncertainty). Each composition is logged as a first-class row so the recommendation itself is auditable, and the existing `meta_context_commit({type:'artifact_materialization', ...})` carries the composition ref forward as the durable link between the materialized artifact and the components it was built from. See [lite-template/integration/MCP_ORBIT_COMPONENT_STORE_PLAN.md](../lite-template/integration/MCP_ORBIT_COMPONENT_STORE_PLAN.md) for the design.

### Added
- **`meta_nodes` / `meta_edges` / `meta_principles` tables** in [control/data/mojulo-lite.db](data/) — three tables, six node kinds (`bot`, `mcp_tool`, `catalyst`, `adapter`, `artifact`, `operator`), four edge kinds (`binds`, `seeded`, `materialized_by`, `runs_for`), and principle scopes (`node` | `edge`) keyed by `(scope_kind, scope_id)`. `operator` is a singleton (`ref='self'`). Schema lives in [lib/db/index.js](lib/db/index.js); repository in [lib/db/repositories/meta-context.js](lib/db/repositories/meta-context.js). Sync methods (not async-by-convention like sibling repos) because better-sqlite3 transactions require sync work, and `MetaContextRepository.commit(fn)` is the entry point for atomic multi-row writes.
- **Ring 6 MCP tools** in [lib/mcp/tools/meta-context.js](lib/mcp/tools/meta-context.js):
  - `meta_context_brief({ scope: { kind, ref? } })` — read the contextmap subgraph + principles. `kind: 'fleet'` returns the whole graph (capped at 500 nodes; response carries `meta.capped: true` when hit); per-scope kinds return a 1-hop neighborhood. Empty fleet brief surfaces `meta: { empty: true, suggest_kyc: true }` so the agent knows to offer the operator KYC. Brief returns the contextmap as *recorded*, not as *currently active* — stale rows from operator-deleted artifacts are not auto-pruned (append-only by design); description tells the agent to cross-reference with `list_deployments` / filesystem before treating a binding as live.
  - `meta_context_commit({ type, ... })` — seal a structural decision. Two event types in MVP: `operator_kyc` (optional one-time bootstrap; `revise: true` stacks a new principle on the same operator node, old one stays for audit) and `artifact_materialization` (atomic per-materialization seal that upserts bot / adapter / catalyst / artifact / mcp_tool nodes, the four edges between them, and any principles attached to specific scopes — `'artifact' | 'catalyst' | 'adapter' | 'bot'` for nodes; `'seeded' | 'materialized_by' | 'runs_for' | 'binds' | 'binds:<mcp_tool_ref>'` for edges).
- **Adapter-delegated artifact verification** in [lib/mcp/meta-context/verification.js](lib/mcp/meta-context/verification.js) — runs BEFORE any DB write during `artifact_materialization`. `claude-code` and `generic` require `existsSync(locator)`. `codex` requires `existsSync` for filesystem-shaped locators (absolute / `./` / `../`) but **accepts opaque automation handles on the agent's assertion** with a `note: 'codex_accept_on_assertion'` in the response — deliberate MVP relaxation since the control plane can't round-trip to Codex from here. Unknown adapter ids are rejected (the adapter loader is the source of truth).
- **Operator anchor surfacing in `recommend_catalysts`** — both single-bot and fleet responses now carry either `operatorAnchor: { role, latestPrinciple }` (when the operator node exists) or `suggest_kyc: true` (when it's missing). Agent uses locked-in constraints to self-clamp suggestions; automated clamping is explicitly deferred to a post-MVP arbiter.
- **`priorMaterializations` per catalyst in `recommend_catalysts`** — every recommendation carries `[{ botRef, botName, artifactRef, artifactLabel, adapterId, materializedAt, latestArtifactPrinciple }]` listing every prior materialization of THAT catalyst anywhere in the fleet, most-recent-first. Reading rule (in tool description): empty → orthogonal pattern; prior on a *different* bot → fleet pattern, align with prior binding choices unless intentionally diverging; prior on the *same* bot → likely duplicate, confirm intent before re-materializing. Closes the synthesis ↔ deliberation loop without coupling `get_catalyst` to the graph.
- **`forward_context` Deliberation section** — new Ring 6 entry in the tool index documenting both meta_context tools, plus a "why was X bound this way?" entry in Quick orientation rules distinguishing the deliberation surface from operational rollups (`fleet_*`) and content reads (`operate.*`).
- **[docs/meta-context.md](../docs/meta-context.md)** — public-facing doc covering the bright line, two-layer (contextmap + principles) model, schema, both event types, adapter-delegated verification (including the codex accept-on-assertion relaxation), cross-ring integration, worked example end-to-end, append-only-by-design policy with the manual cleanup escape hatch, and explicitly-deferred extensions (arbiter, curation, passive writes, audit chain on principles, dashboard). Now also covers the **Inventory (current-state cache, alongside the contextmap)** section explaining why inventory got its own table with replace semantics instead of being shoehorned into the append-only graph.
- Lazy `DB_PATH` resolution in [lib/db/index.js](lib/db/index.js) — `process.env.SQLITE_PATH` is now read at first `getDb()` call instead of at module load, unblocking `:memory:` test isolation for the new repository tests (and any future DB-touching tests). Production behavior unchanged.
- **`meta_mcp_inventory` table** in [control/data/mojulo-lite.db](data/) — single table with `(server, tool_name, tool_ref, description, declared_at)` columns and `UNIQUE(server, tool_name)`. Sits alongside the append-only contextmap on purpose: inventory is the operator's present environment, not a sealed decision, so it gets replace semantics instead of append. Schema lives in [lib/db/index.js](lib/db/index.js); repository in [lib/db/repositories/mcp-inventory.js](lib/db/repositories/mcp-inventory.js). Sync methods matching the meta-context repository pattern.
- **`meta_context_declare_inventory` MCP tool** in [lib/mcp/tools/mcp-inventory.js](lib/mcp/tools/mcp-inventory.js) — atomic `DELETE FROM meta_mcp_inventory; INSERT` in one transaction; latest declaration wins. Returns `{ ok, serversSeen, toolsSeen, replaced, declaredAt, warnings? }`. `warnings: ['no_operator_anchor']` is appended when no operator KYC has been committed yet (inventory still saves; cue to surface KYC inline). Slotted into Ring 6 registration order in [lib/mcp/server.js](lib/mcp/server.js) immediately after `meta_context_commit` so the third Ring 6 surface (current-environment cache) sits next to the two contextmap surfaces. Tool description leads with the non-bot framing: *"Register the operator's broader MCP environment so mojulo can compose solutions that don't require deploying a chatbot."*
- **Inventory snapshot rides on fleet briefs** — `meta_context_brief({kind:'fleet'})` now returns `inventory: { servers, declaredAt, ageSeconds, toolCount }` alongside the contextmap subgraph. When never declared: `{ servers: [], declaredAt: null, ageSeconds: null, toolCount: 0 }`. Per-scope briefs do NOT include `inventory` — it's a fleet-level fact, not a neighborhood property. `ageSeconds` is computed at read time so consumers can decide freshness without re-querying.
- **`forward_context` quick-orientation rule for the non-bot axis** — new rule routing "user wants to automate something that doesn't involve a deployed chatbot" (operator-side workflows, MCP-to-MCP wiring, scheduled digests, signal-triggered automations) to `meta_context_declare_inventory` + direct synthesis, sitting next to the cross-bot catalyst rule for natural disambiguation. The Ring 6 glossary section is also re-framed as three distinct knowledge categories (what fired / why bound / what's available) rather than three flavors of audit tool.
- **[lite-template/integration/MCP_INVENTORY_PLAN.md](../lite-template/integration/MCP_INVENTORY_PLAN.md)** — design plan covering the philosophical move (mojulo decentered from the bot, two-tier epistemics for decisions vs environment, situated within the agent's broader ecosystem), the why-not-the-append-only-graph argument, the inventory tool surface, freshness mitigations, cross-ring touchpoints, and what's deferred for the broader MCP-orbit phase.
- **`mcp_orbit_components` and `mcp_orbit_compositions` tables** in [control/data/mojulo-lite.db](data/) — two-table substrate for the component store. Components: `(kind, ref, version, body_md, payload_json, source)` with `UNIQUE(kind, ref, version)`, six allowed kinds (`source`, `destination`, `trigger`, `pattern`, `idempotency`, `render`), `source` enum `builtin | custom` (schema accommodates user-registered custom components when `register_mcp_orbit_component` ships in v1). Compositions: `(ref, intent_md, component_refs, knobs_json, ranking_score, status, artifact_ref)` with status enum `proposed | dry_run | materialized | retired` — every recommendation persists as a `proposed` row so the recommendation itself is auditable, then state-machines forward as the agent dry-runs and materializes. Schema lives in [lib/db/index.js](lib/db/index.js); repositories in [lib/db/repositories/mcp-orbit.js](lib/db/repositories/mcp-orbit.js) with sync methods matching the meta-context pattern.
- **mcp-orbit component loader** in [lib/mcp/mcp-orbit-components/loader.js](lib/mcp/mcp-orbit-components/loader.js) — components ship as `.md` files under `<kind>/<ref>.md` with JSON frontmatter (required: `ref`, `version`, `summary`; optional: `requires`, `capabilities`, `constraints`, `exposesKnobs`, etc., all rolled into `payload_json` on the row). The filename basename must match the frontmatter `ref` so the file path is a stable typed identifier. `seedComponents()` drops all builtin rows and re-upserts on each call; the loader's once-flag short-circuits repeat calls in normal operation. Validation faults throw — the library is curated, not user input.
- **Five starter components** under [lib/mcp/mcp-orbit-components/](lib/mcp/mcp-orbit-components/) covering the weekly-digest assembly path: [source/linear.md](lib/mcp/mcp-orbit-components/source/linear.md) (cursor on `updated_at`, cost-based rate limit, pagination contract, PII-in-titles pitfall), [destination/gdrive.md](lib/mcp/mcp-orbit-components/destination/gdrive.md) (create-or-append, folder-scoped dedupe, draft posture, trash-isn't-delete pitfall), [trigger/scheduled.md](lib/mcp/mcp-orbit-components/trigger/scheduled.md) (cadence vocabulary, timezone resolution, **non-negotiable idempotency-required constraint**, DST drift), [idempotency/window-key.md](lib/mcp/mcp-orbit-components/idempotency/window-key.md) (composite key `${dest}-${period}`, ISO week disambiguation, search-before-create with exact-match verification), and [pattern/aggregation.md](lib/mcp/mcp-orbit-components/pattern/aggregation.md) (cognitive shape: many events → one summary, four knobs `window`/`grouping`/`depth`/`quiet_mode`, redirect rules to `routing` / `forwarding` / `enrichment` when this pattern doesn't fit).
- **Meta-catalyst body** at [lib/mcp/mcp-orbit-components/meta-catalyst.md](lib/mcp/mcp-orbit-components/meta-catalyst.md) — the composer's rulebook the agent reads once per session before assembling. Carries the six-category map, the hard constraint table (`trigger: scheduled` requires idempotency; `pattern: branching` requires ≥2 destinations; KYC PII constraint forbids body-summarizing render components; etc.), the ranking heuristic (inventory fit × 0.7 + KYC alignment × 0.2 + prior-materialization signal × 0.1), the seven-step composition flow (recognize → recommend → meta-catalyst → get_component per ref → negotiate knobs → dry-run → promote + meta_context_commit), the dry-run discipline (resolve → render → write one real reversible artifact), and the commit discipline (composition ref recorded in an artifact-scope principle as the durable link between artifact and components).
- **Four Ring 6 MCP tools** in [lib/mcp/tools/mcp-orbit.js](lib/mcp/tools/mcp-orbit.js):
  - `list_mcp_orbit_components({ kind?, ref_pattern? })` — discovery surface; returns kind/ref/version/summary per (kind, ref) — max-version row only so older versions don't pollute discovery. Bodies omitted on purpose; fetched via `get_mcp_orbit_component`.
  - `get_mcp_orbit_component({ kind, ref, version? })` — fetch one row with full `body_md` + structured payload (constraints, capabilities, `exposesKnobs`). Omitted `version` returns the highest semver string for that ref.
  - `get_meta_catalyst()` — singleton; returns the meta-catalyst body as plain-text content. Agents read it once per session before composing.
  - `recommend_mcp_orbit_compositions({ intent, inventory? })` — server-side does only the deterministic part: filters available components by the declared MCP inventory and the operator's KYC anchor, scores candidates, writes each as a `proposed` composition row, returns 1-3 ranked candidates with component refs + scoring rationale + constraint warnings (e.g. `scheduled_without_idempotency`, `source_not_in_inventory:linear`). The agent does the composition — pulls component bodies, negotiates knobs, dry-runs, materializes via host adapter, seals via `meta_context_commit`. Response also surfaces `operatorAnchor` / `nextSteps` walking the rest of the flow, and `warnings` (`no_operator_anchor`, `inventory_empty`, `inventory_stale`) when the recommendation is weaker than it could be.
- **mcp-orbit tools registered LAST within Ring 6** in [lib/mcp/server.js](lib/mcp/server.js) — the natural reading order is append-only contextmap → current-state inventory → composer (on top of both). `forward_context` tool index gains an entry routing mcp-orbit intents to `recommend_mcp_orbit_compositions` first, and the "automate something that doesn't involve a deployed chatbot" orientation rule now flows `meta_context_declare_inventory` → `recommend_mcp_orbit_compositions` instead of "declare inventory then synthesize a skill directly."
- **[lite-template/integration/MCP_ORBIT_COMPONENT_STORE_PLAN.md](../lite-template/integration/MCP_ORBIT_COMPONENT_STORE_PLAN.md)** — design plan covering the architectural lesson from meta-context applied forward (typed server-side store with disciplined write rules turns into queryable infrastructure), why typed-store-not-markdown, the six-category model with composition constraint examples, both table schemas with the option-(b) rationale for first-class compositions, the v0 validation slice exercised by this release, and what's deferred (user-custom components via `register_mcp_orbit_component`, composition templates, usage analytics, cross-operator sharing, composition arbiter).

### Changed
- **Tool registration order** in [lib/mcp/server.js](lib/mcp/server.js) — `registerMetaContextTools()` runs last, after `registerCatalystTools()`. Ring 6 sits at the bottom of `tools/list` so the natural reading order surfaces orientation → per-bot → fleet → outcome → deliberation. `forward_context` first, deliberation last.
- **`recommend_catalysts` tool description** rewritten to teach the agent how to consume the new `operatorAnchor` / `suggest_kyc` / `priorMaterializations` fields. The reading rule for prior materializations is in-description so the framing sits next to the data it applies to.
- **CLAUDE.md** updated with the Ring 6 paragraph in the MCP control surface ring list, plus `meta_nodes` / `meta_edges` / `meta_principles` named in the Data layout note.
- Test suite expanded by **104 new tests** across the new files: 44 for the repository, 15 for verification, 31 for the Ring 6 tools, and 14 for cross-ring integration in `catalysts.test.js`. Inventory adds **32 more**: 22 for [lib/db/repositories/mcp-inventory.test.js](lib/db/repositories/mcp-inventory.test.js) (schema, replace semantics, validation, atomicity), 8 for [lib/mcp/tools/mcp-inventory.test.js](lib/mcp/tools/mcp-inventory.test.js) (handler shape + no-operator warnings), and 2 added to [lib/db/repositories/meta-context.test.js](lib/db/repositories/meta-context.test.js) (inventory on fleet brief; absent on per-scope briefs). mcp-orbit adds **45 more**: 24 for [lib/db/repositories/mcp-orbit.test.js](lib/db/repositories/mcp-orbit.test.js) (schema + both repositories — kind/status CHECK enforcement, version coexistence, custom-row preservation on `deleteAllBuiltins`, composition state transitions), 9 for [lib/mcp/mcp-orbit-components/loader.test.js](lib/mcp/mcp-orbit-components/loader.test.js) (frontmatter parsing, filename-ref invariant, drop-on-reseed, bundled-components parse), and 12 for [lib/mcp/tools/mcp-orbit.test.js](lib/mcp/tools/mcp-orbit.test.js) including a **full seven-step e2e flow** (recommend → meta-catalyst → component bodies → state transitions → commit) that asserts the composed candidate matches the five components in the hand-written weekly-digest recipe. Total: **384 lib tests passing**.

## [0.3.0] — 2026-05-22

Catalysts go host-neutral. Until now, every catalyst body assumed the
synthesizing agent was Claude Code and would write a `.claude/skills/<...>/SKILL.md`
file. That assumption is unbundled into a separate **host adapter** layer, so
the same catalyst recipe can materialize as a Claude Code skill, a Codex
automation, or a generic `workflow.md` + runner depending on which agent is
connected. See [docs/catalysts.md](../docs/catalysts.md) and the per-host
prose in [control/lib/mcp/adapters/](lib/mcp/adapters/).

### Added
- **Host adapters** — three ship in [lib/mcp/adapters/](lib/mcp/adapters/),
  symmetric to the catalysts loader: `claude-code` (skill under
  `.claude/skills/`, scheduled via `/schedule`, secrets-guarded via
  `.claude/settings.json` deny rules), `codex` (Codex automation via
  `automation_update` for recurrence, or a workspace `./mojulo-workflows/<slug>/`
  workflow file Codex follows interactively), and `generic` (`workflow.md` +
  runner script for any other agent, scheduling out-of-band). Each adapter
  declares its artifact target, scheduling mechanism, state location, secrets
  posture, and `supportsClientInfoHint` list. The MCP server captures
  `clientInfo` at `initialize` ([client-bindings.js](lib/mcp/client-bindings.js))
  and auto-resolves the adapter for that session; pass `host` explicitly to
  `get_catalyst` / `get_adapter` to override.
- `list_adapters` / `get_adapter` MCP tools (Ring 0, registered next to
  `forward_context` so they show up at the top of `tools/list`). The
  connecting agent reads its bound adapter once per session before
  synthesizing from any catalyst.
- [AGENTS.md](../AGENTS.md) at repo root — orientation for non-Claude agents
  (Codex, future hosts) before mojulo's MCP is connected. Covers the dev MCP
  endpoint, the Codex `~/.codex/config.toml` snippet, and cross-host
  pointers. Claude Code's [CLAUDE.md](../CLAUDE.md) is host-neutral and
  remains the primary architecture doc; AGENTS.md only covers what other
  hosts need *before* the MCP handshake.
- Optional `outputContract` field on catalyst frontmatter — a structured
  description of the per-run output shape, so adapters can render reporting
  without parsing prose. All three shipped adapters read it (see the "Output
  reporting" section in each adapter body). Optional during migration;
  required for new catalysts after the Phase 2 cutover.
- Language packs for new locales: Arabic (ar), Danish (da), Estonian (et),
  Farsi (fa), Filipino (fil), Hindi (hi), Indonesian (id), Kiswahili (sw),
  Malay (ms), Swedish (sv), Thai (th), Turkish (tr), Urdu (ur), and
  Vietnamese (vi). UI strings are now internationalized across 27 languages
  total.

### Changed
- **Every shipped catalyst body rewritten to be host-neutral.** Claude-specific
  phrasing ("synthesize the skill", literal `.claude/skills/<...>/SKILL.md`
  paths, "the skill prints…") is replaced with "materialize the runnable
  artifact" delegated to the bound host adapter. Mapping intent, qualifying
  logic, idempotency strategy, and pitfalls — the *portable* contract — stay
  in the catalyst body. Artifact path, scheduling, dry-run encoding, state
  location, and output reporting move to the adapter. Touched:
  `appointment-to-calendar`, `conversations-to-channel-digest`,
  `document-extract-to-store`, `knowledge-gap-miner`, `qualify-lead-to-crm`,
  `scan-conversations-for-signal`, `submission-to-ticket`,
  `submissions-to-warehouse`, `weekly-submissions-digest`.
- `get_catalyst` response now composes three sections in order: the
  host-neutral **`CATALYST_CORE_PREAMBLE`** (renamed from
  `SYNTHESIZER_BRIEFING` — posture, vocabulary, safety defaults), the bound
  **host adapter body** (artifact target, scheduling, dry-run as a concrete
  step, state, secrets, output reporting), then the **catalyst body**
  itself. Response payload also includes a resolved
  `adapter: { id, name, artifactTarget }` block so callers can surface the
  materialization target in confirmation dialogs.
- `forward_context` rewritten around the host-neutral model: new **Host
  adapter** glossary entry next to the existing **Catalyst** entry,
  `list_adapters` / `get_adapter` added to the Orientation ring of the tool
  index, updated catalyst lifecycle text ("read your adapter once before
  synthesizing"), and the verification posture generalized from "synthesized
  skills" to "runnable workflow artifacts materialized via host adapters
  (Claude Code skills, Codex automations, generic workflow files)."
- `forward_context` tool now surfaces the embed URL of the widget.
- npm package description and keywords broadened from "MCP server for
  building self-hosted chatbots from inside Claude" to "from any MCP-capable
  agent (Claude Code, Codex, and friends)." Keywords add `mcp-server`,
  `codex`, `openai`.
- [docs/catalysts.md](../docs/catalysts.md) and
  [docs/mcp-integration.md](../docs/mcp-integration.md) rewritten around the
  catalyst/adapter split. The concepts table grows a fourth row (host
  adapter) and the "runnable artifact" row replaces the
  Claude-specific "Claude Code skill" row.
- Top-level [README.md](../README.md) and [control/README.md](README.md)
  updated for the multi-host story — host adapters are mentioned next to the
  `forward_context` orientation pointer.

### Security
- `get_deployment` credential redaction now actually redacts. The deployment
  config serializes its per-provider entries under `config.llm.*`, but
  `redactConfigCredentials` in [operate.js](lib/mcp/tools/operate.js) was
  walking `config.llmConfig.*` — a key that doesn't exist — and silently
  returning the config untouched. Anthropic / OpenAI / AWS / Fly API-key
  fields are now redacted before the tool returns. No control-plane DB
  change; the encrypted-at-rest copy in `api_keys` was never affected.
  Users on 0.2.x who routinely call `get_deployment` over MCP should
  assume any provider keys present in those responses were transmitted in
  the clear to the connected agent's session.

## [0.2.2] — 2026-05-21

Discoverability patch on top of 0.2.1. The `mojulo-ui` bin shipped in 0.2.0,
got fixed in 0.2.1, but no surface was telling users (or connecting agents)
it existed — the npm-page README actively said the dashboard wasn't shipped
yet, the MCP `initialize` preamble didn't mention it, and `forward_context`
had no framing for when to suggest it.

### Changed
- [README.md](README.md) — Quickstart adds step 4 for `npx -y -p mojulo
  mojulo-ui`; the top-of-fold lists the three bins (`mojulo`, `mojulo-ui`,
  `mojulo-config`); the "Dashboard" section flips from "clone the repo to
  run it" (the stale 0.1.x instruction) to actual `npx` commands with the
  bin's flags and concrete reasons to reach for it.
- `SERVER_INSTRUCTIONS` (MCP `initialize` preamble) — adds a short
  "There's also a dashboard" paragraph next to the existing orientation
  pointer and the secrets standing rule. Every connecting agent now sees
  the affordance on handshake without having to call `forward_context`
  first.
- `forward_context` — adds a "Two faces, one state" subsection near the
  top of orientation. Frames `mojulo` (MCP) and `mojulo-ui` (dashboard) as
  two faces of the same `~/.mojulo/` state, with concrete decision
  triggers (browse interactively, mint via wizard, fleet analytics as
  charts, click-through deploy management) and an explicit "default is
  still MCP" boundary so the agent doesn't push the dashboard for tasks
  that work fine in chat.

## [0.2.1] — 2026-05-21

Patch on top of 0.2.0. `0.2.0` shipped the Next.js standalone bundle without
its client static assets — the dashboard HTML served fine but every browser
request for `/_next/static/*` (CSS, font, JS chunks) hit 404, leaving the
page unstyled and non-interactive. `0.2.0` is deprecated on the registry
with a pointer to this version.

### Fixed
- `mojulo-ui` now serves the dashboard's client static assets. Root cause:
  Next.js's `output: 'standalone'` deliberately emits `.next/static/` and
  `public/` *outside* the standalone bundle, leaving each deployer
  responsible for copying them in. v0.2.0 packed both trees at the package
  root, which never made them reachable from the standalone server's cwd.
  v0.2.1 fixes this in `prepack` with [stage-standalone.mjs](scripts/stage-standalone.mjs),
  which copies `.next/static → .next/standalone/.next/static` and
  `public → .next/standalone/public` before the pack runs. The top-level
  `.next/static/**` and `public/**` entries are dropped from the `files`
  allowlist (now redundant — the standalone copy is what the server actually
  reads).

### Lesson logged for future Next.js standalone changes
- A `mojulo-ui` smoke that only checks the dashboard HTML returns `200` is
  not sufficient — the browser also has to be able to fetch at least one
  `/_next/static/*` URL successfully. Future smoke tests should `curl` a
  CSS chunk and a woff2 from the running server before declaring a UI
  change validated.

## [0.2.0] — 2026-05-20

Adds the Next.js dashboard as a second binary in the same npm package. The
launch story becomes: build the bot via Claude → operate the fleet via
dashboard → both shipped via one `npx -y mojulo` install. See
[lite-template/integration/UI_PACKAGE_PLAN.md](../lite-template/integration/UI_PACKAGE_PLAN.md).

### Added
- `mojulo-ui` bin — boots the bundled dashboard on a free local port and opens
  the browser ([scripts/mcp-ui.mjs](scripts/mcp-ui.mjs)). Flags: `--port <n>`,
  `--no-open`, `--help`. Binds 127.0.0.1 only. Shares `~/.mojulo/` state with
  the `mojulo` stdio bin, so a bot minted via MCP shows up immediately in the
  UI's fleet view.
- `version` MCP tool (Ring 0) — reports server version, MCP protocol version,
  Node version, platform os/arch, the pinned bot container image tag, the
  `MOJULO_OFFLINE_BUILD` flag, and the active `MOJULO_HOME`. Use to diagnose
  version mismatches between a user-reported issue and what their control
  plane is actually running.
- `inspect_bot_env` MCP tool (Ring 3) — read a bot's container `.env` safely.
  Returns `{ key, value, masked, valueLength? }` entries with sensitive values
  (Anthropic / OpenAI / AWS / Fly / GitHub / Slack tokens, and the
  auto-generated `MOJULO_API_KEY`) masked to first-4 + last-4. Non-sensitive
  entries (`LLM_PROVIDER`, ports, plain webhook URLs) come through clear.
  Takes either `deploymentId` (resolves under `MOJULO_HOME`) or an explicit
  `path` (basename must start with `.env`). The standing rule lives in the
  `initialize` preamble and the new "Secrets handling" section of
  `forward_context`: do not `cat`/`Read` `.env` files of mojulo bots — use this
  tool. Defense-in-depth: a recommended `.claude/settings.json` deny snippet
  is documented in `forward_context` so the harness can block the routine
  `cat .env` path even if an agent forgets the rule. Control-plane provider
  keys are unaffected — those already live encrypted in the `api_keys` table,
  managed via the `mojulo-config` CLI.
- `save_modular_bot` response now includes `artifactPath`, the absolute on-disk
  path to the compiled zip. Stdio MCP callers (which have no HTTP server to hit
  `downloadUrl` against) can surface this directly to the user.
- `open` runtime dep (~120 KB) — used only by the `mojulo-ui` shim for browser
  launch.

### Changed
- Next.js builds emit `output: 'standalone'`. The `mojulo-ui` bin imports the
  resulting `.next/standalone/server.js` directly; the pack ships the pruned
  standalone tree instead of the source app.
- `prepack` runs `stage-lite-template && next build --webpack`. The webpack
  build path is load-bearing — Turbopack's standalone output hashes external
  module names (e.g. `@huggingface/transformers-31f28a0eb9b916d1`), which
  Node's resolver can't find when standalone runs from inside `node_modules/`.
- `lite-template/` is bundled into the package again so the wizard preview
  routes (`/api/preview/bot/*`, `/api/preview/chat`, `/api/preview/extract`)
  resolve under bundled-`lite-template/` conditions. The `mojulo-ui` shim sets
  `LITE_TEMPLATE_PATH` to the bundled copy before booting the standalone
  server.
- `SERVER_VERSION` in the MCP `initialize` handshake reads from `package.json`
  via `getServerVersion()` instead of being a hardcoded constant. Both the
  `initialize` response and the new `version` tool will track future bumps
  automatically.
- `forward_context` tool index updated for the new `version` tool, the
  `artifactPath` field on `save_modular_bot`, and to steer stdio clients away
  from the legacy `downloadUrl` (which is a Next.js-route path, unreachable
  over stdio).
- `files` allowlist expanded with negations to exclude developer state from the
  pack: `.next/standalone/.env*`, `.next/standalone/data/**`,
  `.next/standalone/lib/embedder/models/**`, the duplicate
  `.next/standalone/lite-template/**`, stale `.tgz` artifacts, and test files
  inside the standalone bundle.

### Implementation notes
- Pack size moved from ~600 KB (0.1.0, stdio-only) to ~52 MB (0.2.0, includes
  Next.js standalone + lite-template + bundled deps). Webpack adds ~30 MB over
  the broken Turbopack pack but is the only build path that actually works
  from an `npm install` location.
- The bundled `lite-template/models/tokenizer.json` is 17 MB. Tokenizer cache
  sharing between the control-plane embedder and the bot-runtime embedder is
  deferred to v0.3.0 — currently each pulls from a different cache dir.

## [0.1.0] — 2026-05-19

Initial npm publish. Stdio-only MCP server for driving Mojulo bot design,
deploy, and operate workflows from Claude Code.

### Added
- `mojulo` bin — stdio MCP entrypoint ([scripts/mcp-stdio.mjs](scripts/mcp-stdio.mjs)).
- `mojulo-config` bin — config helper ([scripts/mcp-config.mjs](scripts/mcp-config.mjs)).
- Embedder cold-start: `preloadModel()` fires in the background on bin start so
  the first RAG bot mint avoids a cold ~113MB ONNX download.
- `LITE_TEMPLATE_PATH` env defaults to the bundled lite-template copy resolved
  at runtime from the install location.

### Changed
- `DockerDeployer` skips template file copying in prebuilt-image mode (the
  default). Previously it shipped `.gitignore` and test fixtures into every
  artifact. Offline-build mode (`MOJULO_OFFLINE_BUILD=1`) is unaffected.
- `TEMPLATE_EXCLUDES` excludes test and integration paths from offline-build
  artifacts.

### Removed
- `postinstall` hook. Model download is lazy on first use (with eager
  background preload on bin start) instead of running at `npm install` time.
