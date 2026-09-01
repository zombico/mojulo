# MCP integration

How to connect your own agent (Claude Code, Claude Desktop, Codex CLI, or any other MCP HTTP client) to mojulo, what it can reach once connected, and how mojulo's tools compose with the other MCP servers already in your loop.

This is the primary way mojulo is driven. The `npx mojulo init` flow wires stdio automatically; the HTTP route below is for remote clients and is **opt-in** — with `CONTROL_PLANE_MCP_KEY` unset (the default), `/api/mcp` returns 404 and the surface is invisible. Set the key and it comes online with bearer auth.

Architecture behind this surface: [MCP-ARCHITECTURE.md](MCP-ARCHITECTURE.md). The **optional chatbot pack**'s tool surface and its own composition recipes live at [docs/chatbot/AGENT-REFERENCE.md](chatbot/AGENT-REFERENCE.md).

---

## What you get

When `/api/mcp` is enabled, the user's MCP-capable agent becomes the agent loop and the control plane becomes a tool host. The same `builderToolHandlers` that power the in-app chat builder are exposed as MCP tools, plus a few read tools for inspecting deployed bots.

- Build a bot from a fresh agent session: *"build me a triage bot for my dental practice"*.
- Reasoning bill moves to the user's agent subscription (Claude Pro/Max, ChatGPT, etc.). The control plane does not need a provider key for builder-time work.
- Mix mojulo tools with other MCP servers in one agent loop (Linear, GitHub, Notion, etc.).
- Read deployed bot state (deployments, conversations, submissions, chain verification) — without copying transcript data into the control-plane DB.

---

## Enabling the server

1. Pick a long random string for the bearer token. Anything ≥32 chars from `openssl rand -hex 32` is fine.
2. Add to your control plane env (`control/.env`):

   ```bash
   CONTROL_PLANE_MCP_KEY=<your-random-token>
   ```

3. Restart the control plane (`cd control && npm run dev`).

The route is now live at `POST /api/mcp`. The middleware ([control/middleware.js](../control/middleware.js)) skips session-cookie checks for `/api/mcp`; bearer auth is enforced inside the route.

---

## Connecting an agent

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```jsonc
{
  "mcpServers": {
    "mojulo": {
      "url": "http://localhost:3001/api/mcp",
      "headers": {
        "Authorization": "Bearer <CONTROL_PLANE_MCP_KEY>"
      }
    }
  }
}
```

Restart Claude Desktop. The tools appear in the picker.

### Claude Code

```bash
claude mcp add --transport http mojulo http://localhost:3001/api/mcp \
  --header "Authorization: Bearer <CONTROL_PLANE_MCP_KEY>"
```

### Codex CLI

Edit `~/.codex/config.toml`:

```toml
[mcp_servers.mojulo]
url = "http://localhost:3001/api/mcp"
headers = { Authorization = "Bearer <CONTROL_PLANE_MCP_KEY>" }
```

Restart the Codex session. See [AGENTS.md](../AGENTS.md) for the Codex-specific orientation (host adapter, catalyst materialization target, secrets posture).

### mcp-inspector (debugging)

```bash
npx @modelcontextprotocol/inspector http://localhost:3001/api/mcp \
  --header "Authorization: Bearer <CONTROL_PLANE_MCP_KEY>"
```

---

## Tool surface

### Studio — make something (creative packs)

The mint tools are re-cut by FORM behind one reader rather than listed flat: call `get_creative_toolset` with no argument for the form map, or `{ form }` for that form's tools.

| Form | Entry tool | Ships as |
| --- | --- | --- |
| diagram | `mint_diagram` (kernel) / `create_sketch` | SVG, PNG |
| illustration | `create_sketch` | SVG, CSS-3D scene |
| reference | `capture_reference` | a reusable visual reference from a photo |
| image-render | `request_image_render` | a composition-locked scaffold an external model paints, bound back with provenance |
| object | `mint_solid` / `edit_solid`, `edifice` | `.glb`, print-ready `.stl` at true scale |
| world | `compose_world` | CSS-3D scene, traversable WebGL, `.glb`, Godot project |
| view | `create_view` | animated science / math / bio study objects |
| motion | `forge_motion` / `stitch_motion` | GIF, MP4 |
| audio | `create_beats` | WAV, MIDI |
| voice | `create_voice` | WAV narration |
| game | `create_game` | a standalone playable artifact, or an exported folder |

Every one of these mints a **recipe** — params plus a kind — into the `sketches` table and returns a `ref`. Iterate in place with `update_sketch` on the same ref rather than re-minting. Export with `export_model` (`.glb` / `.stl`), `export_game`, or `export_beats`. Keep a tuned setting with `save_recipe({ ref, id, when })` — it lands in your cookbook and becomes recallable by intent through `semantic_search`.

Creative packs are install-gated (`mojulo install creative`, on by default); `mint_diagram` is kernel and always present.

### Operate and deliberate

| Tool | Notes |
| --- | --- |
| `meta_context_declare_inventory` | Cache the connecting agent's own MCP servers and tools — the input to composition. |
| `recommend_mcp_orbit_compositions` / `bind_primitives` | The two composers (see recipe 5). |
| `meta_context_brief` / `meta_context_commit` | The contextmap: durable structural decisions and the audit trail. |
| `semantic_search` | Retrieve across vocab cards, routing cards, catalysts, and your own saved recipes. |
| `install_scaffold` / `start_app` / `stop_app` / `status_app` | App lifecycle. |
| `forge_plan` / `compile_plan` / `execute_plan` | Plan mode — proposed work that compiles against the live registry. |

### Chatbot pack (opt-in)

The bot builder and per-bot operate tables are **not** part of a default install. `mojulo install chatbot` adds them; their tool surface and the four bot-shaped composition recipes live at [docs/chatbot/AGENT-REFERENCE.md](chatbot/AGENT-REFERENCE.md#mcp-tool-surface-pack).

### Catalysts

| Tool              | Returns                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `list_catalysts`  | The curated library: `id`, `name`, `summary`, `category`, `requires` per catalyst. Optional `category` filter. |
| `get_catalyst`    | Full catalyst body for one `id` — the host-neutral prose recipe the agent reads at synthesis time. |
| `get_adapter`     | Host adapter rules for the current client (`claude-code`, `codex`, or `generic`) — tells the agent where to write the materialized artifact and how to bake in the dry-run pattern. |

Catalysts are curated workflow patterns. The user's agent pulls a catalyst, reads the shape of whatever it is operating on, picks a destination MCP from what's installed locally, and materializes a runnable artifact through the host adapter for its client — a Claude Code skill under `.claude/skills/`, a Codex automation, or a generic `workflow.md` + runner script. The "catalyst" name is literal — each file enables one phase transition from intent + subject shape + destination MCP into a structured artifact, without itself appearing in the result. The bare name (not "skill catalyst") is deliberate: catalysts **produce** runnable artifacts, they are not themselves artifacts. See [docs/catalysts.md](catalysts.md) for the author spec.

The catalyst library is repo-only — there is no user-writable catalyst directory. Custom patterns are the agent's responsibility (synthesize from scratch, or maintain catalyst-shaped markdown locally). New patterns worth promoting to the canonical library are added by PR to [control/lib/mcp/catalysts/](../control/lib/mcp/catalysts/).

### Technique catalysts

Technique catalysts (`kind: technique`) live under [control/lib/mcp/catalysts/techniques/](../control/lib/mcp/catalysts/techniques/) and are pulled with the same `get_catalyst` call as workflow catalysts. They differ in what they produce: a workflow catalyst materializes a runnable artifact through a host adapter; a technique catalyst binds a runtime substrate (filesystem, a future http-api, a future local-sql) to an artifact, with the binding recorded as a contextmap principle. `list_catalysts({ kind: 'technique' })` filters to just the technique shelf; `recommend_catalysts` returns only workflow catalysts (techniques don't recommend against a subject's shape).

The first technique is **`local-storage`** — bind a folder on the operator's machine to an artifact as a `document-store` primitive against the filesystem MCP. It requires the filesystem MCP to be installed in the operator's agent.

#### Setting up the filesystem MCP

The `local-storage` technique binds against the official `@modelcontextprotocol/server-filesystem` MCP. Install it once per agent before applying the technique:

**Claude Code.** Pick a workspace path (a dedicated subdirectory under your home, not your home root) and:

```
claude mcp add filesystem npx -y @modelcontextprotocol/server-filesystem <workspace_root>
```

For example: `claude mcp add filesystem npx -y @modelcontextprotocol/server-filesystem /Users/you/mojulo-workspace`. The `<workspace_root>` you pass becomes the MCP's launch-time allowed root — every sub-folder mojulo's `local-storage` bindings materialize underneath it is reachable without relaunching.

**Other agents.** Codex CLI, Claude Desktop, and other MCP-aware agents have their own `add` syntax for `npx`-based MCP servers — consult their docs for the exact command. The server binary (`@modelcontextprotocol/server-filesystem`) and the workspace-root-as-launch-arg model are the same regardless.

After install, run a session against mojulo and the technique catalyst (`get_catalyst("technique-local-storage")`) will walk your agent through the rest: setting `operator.workspace_root` if not already set, picking a sub-path for the artifact, binding the primitive, sealing the audit chain.

**Changing the workspace root.** The allow-list is fixed for the MCP server's lifetime. Moving to a new workspace root requires relaunching the filesystem MCP with new CLI args (run `claude mcp remove filesystem` then re-add with the new path). In-flight artifacts whose addressing was baked at the old path require manual re-materialization in v0; surface stale bindings to the operator when you observe them.

---

## Recipes — composing mojulo tools with your other MCP servers

The point of MCP exposure isn't a second way to drive the dashboard. It's that mojulo's tools sit in the same agent loop as your other MCP servers (Drive, Gmail, Linear, GitHub, Notion, filesystem). None of the recipes below are reachable from any in-app surface, because it can't see your other tools.

### 1. A reference photo → a world you can walk

**You need:** the filesystem MCP (or Drive) pointed at wherever your photos live.

**Prompt:** *"Read the site photos in `~/refs/warehouse/`, pull a visual reference off them, and build me a walkable interior in that palette and massing."*

**Flow:** the filesystem MCP lists + reads the images → `capture_reference` extracts a reusable reference (palette, massing, material read) → `compose_world` mints the world with that reference bound → open `/sketches/<ref>` and walk it → `update_sketch` to iterate in place on the same ref.

**Why it composes.** Mojulo never fetches anything at runtime; the photo arrives because another MCP in your loop handed it over. The reference becomes part of the recipe, so the world regenerates identically without the photo.

### 2. Project state → a diagram that regenerates

**You need:** Linear, GitHub, or any tracker MCP as the data source, plus a destination (Drive, Notion, Slack, or the filesystem).

**Prompt:** *"Pull the open epics in SUPPORT with their blocking edges and draw me the dependency graph; refresh it every Monday."*

**Flow:** the tracker MCP queries issues + relations → your agent shapes them into stations and edges → `mint_diagram` (kernel — no creative pack needed) returns `/sketches/<ref>` → fetch the SVG from `/api/sketches/<ref>/svg` → the destination MCP posts or commits it.

**Why it composes.** The diagram is a recipe, not an image. Next Monday's run is `update_sketch` on the same ref with fresh edges — the URL is stable, the diff is readable, and the old version is still in the row's history.

### 3. An exported game or model → a repo you host

**You need:** the filesystem MCP, and GitHub if you want it pushed.

**Prompt:** *"Export the harbour level as a Godot project and a `.glb`, check the portability flags first, and commit it to the `levels/` repo."*

**Flow:** read the advisory portability assessment (which gameplay lives inside the shared mechanics vocabulary, and the honest ledger of what will *not* travel) → `export_game` writes a plain folder, or `export_model` writes `.glb` / print-ready `.stl` → the filesystem MCP places it → GitHub commits and, for a web build, publishes to Pages.

**Be deliberate about the ledger.** Movers, live physics, fx, and the game shell don't cross the seam. The export says so explicitly rather than silently dropping them — put that list in the commit message so whoever opens the project in Godot knows what to re-orchestrate.

### 4. A kept recipe → a set, on demand

**You need:** nothing but mojulo — but a destination MCP (Drive, Notion, your LMS) makes it worth automating.

**Example.** You tuned a study object once and saved it: `save_recipe({ ref, id: 'tuesday-pendulum', when: 'the pendulum setup for my Tuesday class' })`. Months later you want it at five latitudes, exported as GIFs, filed in a shared folder.

**Prompt:** *"Recall my Tuesday pendulum setup and mint it at 15°, 35°, 45°, 60° and 75° north, turntable each one, and drop the GIFs in the class Drive folder."*

**Flow:** `semantic_search({ kinds: ['view_vocab'], query: 'the pendulum setup for my Tuesday class' })` recalls the saved card by *meaning*, not by filename → read its `recipe.json` → `create_view` once per latitude → `forge_motion` per ref → the destination MCP files the outputs.

**Why the `when` line is the whole trick.** Paraphrased recall works because the agent wrote that line from the original conversation. This is the loop the cookbook exists for: mint → tweak → keep → recall. See [CONTRIBUTING.md](../CONTRIBUTING.md) for keeping and publishing your own book.

Recipes 1 and 2 use another MCP server as the *data source* and mojulo as the artifact producer. Recipes 3 and 4 invert that: mojulo's own state is the source and the downstream MCPs are the actuators. In both directions your agent is the glue — and the ones worth promoting from ad-hoc prompts to versioned artifacts (a skill, an automation, a workflow file) are those whose inputs parameterize cleanly: a folder path, a project key, a recalled recipe id.

### 5. Wiring two of your own MCPs together, with no mojulo artifact at all

**You need:** any pair of installed MCPs — one with read affordances (Linear, Gmail, GitHub, etc.), one with write affordances (Drive, Notion, Slack, etc.). No mojulo bot. Mojulo offers two composers under mcp-orbit; both end at the same `meta_context_commit` audit surface.

**Example.** Every Monday morning, summarize the past week of Linear issue activity into a Google Doc the operator can scan in a few minutes.

**Primitive-binding flow (recommended).** When the agent has runtime-introspected tool-schema knowledge (which Claude Code, Codex, and similar hosts surface natively): `meta_context_declare_inventory` in **richer-snapshot mode** (per-tool `inputSchema` + `introspectionConfidence`) → `bind_primitives` once per primitive slot in the composition (e.g. `structured-record-store/source` on Linear, `document-store/destination` on Drive) — each call returns a `prov_<id>` artifact whose body is the primitive's role template filled with the operator's actual bound tool names and schemas → assemble + dry-run against a draft destination doc → promote → host-adapter materialization → `meta_context_commit({ type: 'primitive_artifact_materialization', adapter_id, artifact, composition_intent, provider_artifact_refs: [...] })`. The four primitives — `document-store`, `structured-record-store`, `messaging-channel`, `message-thread` — cover the typed-shape space across vendors.

**Vendor-shaped composer flow (seed-reasoning fallback).** When the agent doesn't have confident tool-schema knowledge yet, or wants curated vendor-specific pitfalls and intent baked into the body: `meta_context_declare_inventory` (thin-snapshot mode is fine) → `recommend_mcp_orbit_compositions({ intent: "weekly Linear digest into Drive..." })` (server returns 1–3 ranked candidate compositions from the typed component store — `mcp` × `trigger` × `pattern` × `idempotency` × `render`, each mcp entry carrying a `role: 'source' | 'destination'`) → `get_meta_catalyst` (composition rulebook, read once per session) → `get_mcp_orbit_component` per component the candidate uses → assemble + dry-run + promote → host-adapter materialization → `meta_context_commit({ type: 'artifact_materialization', ... })`.

**Why this surface, not a catalyst.** Recipes 1–4 all end in a mojulo artifact. Recipe 5 produces none — it's MCP-to-MCP wiring with mojulo as the deliberation anchor (operator KYC, composition log, contextmap commit) rather than the conversational runtime. Both composers above add a new MCP to the library with O(1) marginal work, and combinations across triggers / patterns / idempotency strategies come for free.

See [docs/mcp-orbit.md](mcp-orbit.md) for both composers' full specs, the five typed component kinds, the four primitives + their affordance vocabularies, the constraint table, and the authoring guide.

---

## Catalysts — synthesizing a runnable artifact from a curated pattern

Recipes 3 and 4 above are the **prototype**. Catalysts are the **productized** version. A catalyst is a reusable pattern shipped with mojulo (`qualify-lead-to-crm`, `submission-to-ticket`, `appointment-to-calendar`, `weekly-submissions-digest`, `scan-conversations-for-signal`, `knowledge-gap-miner`) that your agent reads and uses to synthesize a concrete runnable artifact specific to one of your bots. The catalyst body is host-neutral; the **host adapter** for your client (`claude-code`, `codex`, or `generic`) tells the agent what shape that artifact takes — a `.claude/skills/<name>/SKILL.md`, a Codex automation, or a generic `workflow.md`. The name is literal — each catalyst enables one phase transition from your intent + the bot's shape + a destination MCP into a structured artifact, without itself appearing in the result.

The synthesis sequence:

1. **Discover.** *"What catalysts are available?"* — your agent calls `list_catalysts`. You can ask for a specific one (*"use the qualify-lead-to-crm catalyst for my dental intake bot"*) or have your agent pick by description.
2. **Read the catalyst.** Your agent calls `get_catalyst(id)` to pull the full body — the workflow logic, mapping intent, pitfalls, and artifact contract. The body opens with a synthesizer briefing that licenses the agent to adapt, combine catalysts, or write from scratch if the catalog doesn't fit.
3. **Read the host adapter.** Your agent calls `get_adapter` to pull the rules for materializing into its client's artifact shape (auto-resolved from `clientInfo.name` on first connect; pass `host` explicitly to override).
4. **Read the bot shape.** Your agent calls `get_deployment(deploymentId)` to read your bot's form schema, enabled protocols, triage routes, and identity. The catalyst's mapping is derived from this — never guessed.
5. **Bind a destination MCP.** Your agent scans the MCPs you have installed in its host (HubSpot, Linear, Notion, Slack, whatever), finds the candidates that match the catalyst's destination category, and asks you to confirm: *"You have `hubspot-mcp` and `pipedrive-mcp` — which one is this for?"* The chosen MCP gets hard-coded into the synthesized artifact.
6. **Answer parameter prompts.** Your agent asks the questions the catalyst declares (qualifying rubric, score threshold, dedupe key, etc.) in one round.
7. **Write the artifact.** Your agent writes the host-specific output — `.claude/skills/<bot-slug>-<purpose>/SKILL.md` for Claude Code, a Codex automation (or workspace workflow file) for Codex, or a generic `workflow.md` + runner script for any other agent. The artifact defaults to `--dry-run` for any catalyst that writes externally; you opt into live writes explicitly.

From this point you own the artifact. Edit, version-control, share. The catalyst is not a live link — if the canonical catalyst later improves, your existing artifact doesn't auto-update. Re-run the flow if you want to regenerate.

**Credentials never touch mojulo.** Destination-system auth lives entirely in your agent's host (the destination MCP's own config). Mojulo only knows that *some* CRM-shaped MCP exists; it never sees your HubSpot key.

**No user-writable catalyst library.** Custom or one-off workflows that don't merit a canonical catalyst are the agent host's responsibility — either let your agent synthesize without a catalyst, or maintain catalyst-shaped markdown locally and feed it inline. New patterns worth promoting to the canonical library are added by PR to [control/lib/mcp/catalysts/](../control/lib/mcp/catalysts/); see [docs/catalysts.md](catalysts.md) for the author spec.

---

## Node-driven fulfillment

The App paradigm's inference path (apps POSTing to `/api/app-inference/envelope`) is fulfilled by an agent in worker mode — by default, the operator's Claude Code session running `/loop /get_catalyst run-inference-worker`. That works, but it ties up the operator's session and surfaces every task as visible turns in their transcript.

The control plane can also fulfill these tasks **itself**, spawning a one-shot headless Claude Code subprocess per task. The operator's main session stays free; mojulo handles fulfillment in the background.

This is opt-in. Set the env var, restart the control plane, done:

```bash
# control/.env
MOJULO_AGENT_RUNTIME=claude-code-headless
```

What happens with it set:

- On boot, the control plane starts a long-lived in-process poller (see [control/lib/agent-tasks/node-fulfiller.js](../control/lib/agent-tasks/node-fulfiller.js)).
- For each parked `envelope_inference` task, the poller invokes the configured runtime adapter (today: `claude-code-headless` — spawns `claude --print --output-format json`).
- The adapter's envelope output is validated against the canonical envelope schema **inside the queue itself** (see `validateEnvelopeOrThrow` in [control/lib/mcp/agent-tasks/queue.js](../control/lib/mcp/agent-tasks/queue.js)) — the same gate that protects the /loop path.
- The audit principle on the calling app's artifact node records a `fulfiller` block: `{ kind: 'node-driven-runtime', runtime: 'claude-code-headless', model: <model> }`. The contextmap stays honest about who did the work.

Coexistence with `/loop` is intentional. The agent-tasks queue is FIFO single-claim — whichever puller pulls first wins. You can run both at once (the Node fulfiller in the control plane, and `/loop /get_catalyst run-inference-worker` in a Claude Code session) and each task lands on exactly one of them. The audit principle's `fulfiller.kind` is the source of truth for which.

**Cost picture stays equivalent.** Each Node-fulfilled task still spends Claude Code minutes — the subprocess invokes the operator's installed `claude` CLI under their default auth. The trade is operational: subprocesses are headless and short-lived; the operator's session is free. Phase 1 has no rate-cap knob — set `MOJULO_AGENT_RUNTIME=disabled` (or unset the var) to stop accepting Node-fulfilled tasks immediately.

**Vision support.** Today the `claude-code-headless` adapter inlines images as base64 data URLs in the user prompt; native MCP image content blocks via stdin aren't wired up yet. Works for the spike; revisit if `claude --print` exposes a cleaner channel.

### How work enters the queue (the parkTask seam)

The agent-tasks queue is the **unification seam** for every autonomous run in mojulo. Whatever fulfiller pulls a task — the operator's `/loop` worker or the headless Node fulfiller — works the same way against the same queue. The seam is the `parkTask` family of entry points in [queue.js](../control/lib/mcp/agent-tasks/queue.js). Phase 1 has two entry points:

| Entry point | Function | Caller | Awaits result? |
|---|---|---|---|
| HTTP POST `/api/app-inference/envelope` | `parkRequest(payload, opts)` | A running app's MCP sidecar (the app's process awaits the response to resume its own work). | Yes — HTTP request blocks on the envelope. |
| Scheduler daemon fire | `parkRequestForTrigger(payload, opts)` | The scheduler daemon at a cron tick (no HTTP request waiting; the fire is audited via `trigger_firing` and the operator reads results out-of-band). | No — fire-and-forget; eventual rejection is consumed internally. |

Both end up as the same entry shape on the queue. The fulfiller doesn't know — and shouldn't need to know — which path put a task there; only the audit principles distinguish (the `trigger_firing` principle is written when the scheduler fires; the `app_inference` principle is written when the fulfiller delivers, regardless of how the task was parked).

Future entry points slot into the same shape:

- **Webhook receiver** (Phase 2). Same `parkRequestForTrigger` call from a new Next.js route handler at `/api/triggers/<trigger_ref>`. Requires a deployment-posture decision (tunnels for localhost operators) before shipping.
- **Watch daemon** (Phase 3). Same `parkRequestForTrigger` call from a polling daemon that detects deltas on a source MCP and fires per-delta.

When you add a new entry point, the test is: can the existing fulfiller stack pick up the parked task without changes? If yes, the entry point belongs. If no, you've introduced a parallel queue.

### Status surface

Ephemeral fulfillment is invisible by default — that's the operational win, but the operator still wants a live signal. Mojulo serves a single tiny endpoint:

```
GET /api/agent-tasks/status
Authorization: Bearer <CONTROL_PLANE_MCP_KEY>
```

Plain-text response suitable for a terminal status bar:

```
mojulo[claude-code-headless]: ✓ delivered (node, 1.4s, 3s ago)
mojulo[claude-code-headless]: 1 in-flight · 2 queued
mojulo: idle
```

Pass `?format=json` for structured data (pending/in-flight counts, last event, recent-event ring buffer).

### Claude Code status line

Drop into your Claude Code `settings.json` so the line refreshes every two seconds in your status bar:

```jsonc
{
  "statusLine": {
    "type": "command",
    "command": "curl -sS http://localhost:3001/api/agent-tasks/status -H \"Authorization: Bearer $MOJULO_KEY\"",
    "refreshInterval": 2000
  }
}
```

Set `MOJULO_KEY` in your shell env to your `CONTROL_PLANE_MCP_KEY` so the command resolves it at run time.

### Cross-client guidance

Mojulo serves one uniform endpoint; each MCP client wires it into its native status surface:

- **Claude Code** — status line via the snippet above.
- **Codex CLI** — Codex's own status conventions (consult its current docs); the endpoint shape is the contract.
- **VS Code MCP clients (Continue, Cline, Cursor, etc.)** — each has its own surface. The endpoint is BYO-integration, but the response format stays stable.

The framing: your Claude Code session is for you, your status line is for mojulo, both update independently.

---

## Session model

A single MCP connection lazily binds one `modular_sessions` row on its first build-ring tool call. Subsequent build calls reuse it. To build a second bot in the same connection, call `start_new_bot` — the next build tool will create a fresh session.

On control-plane restart, the in-memory binding map is lost. The bot row stays in SQLite; the user's agent effectively starts a new session.

Jobs are reaped on startup: anything left in `pending` / `running` is marked `error` so polls on stale jobIds return a clear failure.

---

## Security posture

- One token per user. By default there is a single operator token — god-mode for the control plane's build / read tools. With the opt-in roles pack, the operator can mint additional scoped bearer keys (pack-granted, revocable, expiring) for their own delegates; the operator's token remains god-mode.
- Don't expose `/api/mcp` to the public internet. Same advice as `CONTROL_PLANE_USER` / `CONTROL_PLANE_PASSWORD`. Run locally, on a tailnet, or behind a reverse proxy you control.
- Conversation data never lives in the control-plane DB. Read tools that surface conversations proxy through `bot-proxy.js` to the bot's own SQLite.
- The bot runtime ([lite-template/](../lite-template/)) is untouched by MCP — there's no MCP path into runtime turn data that bypasses the existing proxy boundary.

---

## Troubleshooting

- **`/api/mcp` returns 404.** `CONTROL_PLANE_MCP_KEY` is unset. Set it and restart.
- **`/api/mcp` returns 401.** The bearer token doesn't match. Check for trailing whitespace / a leading `Bearer ` doubled in the header.
- **`No LLM provider key configured` from a build tool.** The control plane needs at least one provider key on `/settings` — the bot under construction inherits the default provider/model for in-loop LLM calls (form generation, identity composition, summary). The user's agent is the *agent loop*, but the *builder pipeline* still calls an LLM for these structured generations.
- **`Bot is not connected` from a read tool.** The deployment row has no URL. Connect the bot via the dashboard or `gh` the bot's URL first.
- **A job stays at `pending` forever.** Control plane probably restarted mid-flight. Start the operation again — the stale job is marked errored automatically on next launch.
