# Changelog

All notable changes to the `mojulo` npm package are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
While in `0.x`, the artifact format and bundled bot image are pinned per
control-plane version — a minor bump may move the pinned bot image tag.

## [Unreleased]

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
