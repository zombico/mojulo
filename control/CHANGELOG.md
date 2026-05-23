# Changelog

All notable changes to the `mojulo` npm package are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
While in `0.x`, the artifact format and bundled bot image are pinned per
control-plane version — a minor bump may move the pinned bot image tag.

## [Unreleased]

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
