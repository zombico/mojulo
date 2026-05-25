---
{
  "id": "generic",
  "name": "Generic agent",
  "summary": "Baseline contract for agents without a specific adapter — materializes catalysts as a workflow.md + runner script, scheduled out-of-band, state in a local file.",
  "version": 1,
  "artifactTarget": "./workflow.md + ./run.<ext>",
  "schedulingMechanism": "out-of-band (system cron, scheduler of user's choice)",
  "secretsPosture": "inspect_bot_env only — never read .env directly",
  "supportsClientInfoHint": []
}
---

# Generic agent adapter

This is the **baseline contract** for any host without a more specific adapter. If you're reading this, mojulo couldn't match your `clientInfo` against `claude-code`, `codex`, or another registered adapter — and the user didn't pass an explicit `host` parameter to `get_catalyst`. The contract below works for any agent runtime; you can layer host-specific behavior on top if you know more about your own substrate than this adapter assumes.

## Artifact target

Materialize the workflow as **two files** in a directory the user picks:

- `<dir>/workflow.md` — a markdown description of the workflow: inputs, mapping table, idempotency strategy, output contract. Human-readable; the user can review and version-control it.
- `<dir>/run.<ext>` — a runner script (shell, Python, TypeScript, whatever the user prefers) that wires the mojulo MCP calls + destination MCP calls. The script reads parameters from CLI args or a sibling `config.json`.

If your host runtime has a more native artifact format and you're confident the user expects that format, prefer it. The two-file pattern is the fallback when nothing else fits.

## Parameter collection

Ask the catalyst's `parameters` questions in one batched round before materializing. Skip questions the user already answered in their intent. Write the resolved values into a `config.json` next to the workflow files, or inline at the top of `workflow.md` as YAML/JSON frontmatter.

## Tool discovery

Inspect your tool surface for:

- **Required mojulo tools** named in the catalyst's `mcpTools.mojulo` array (`get_deployment`, `query_submissions`, `query_conversations`, `get_conversation`, etc.).
- **Destination MCP** matching the catalyst's `requires.destinationMcpCategory`. Cross-reference `requires.destinationExamples` against what's available.

If the destination MCP isn't installed, surface it as a soft suggestion ("a CRM MCP — HubSpot, Salesforce, Pipedrive, Attio — would unlock the live-write path"), not a blocker. Per the catalyst-core consultation posture, the user opts into upgrades.

## Dry-run as a concrete artifact step

`dryRun: true` defaulting in the contract is not enough on its own. Bake it into the runner script's first step:

> First invocation: pull one real record from mojulo, render the full destination payload to stdout, exit without writing. Subsequent runs accept a `--live` flag (or equivalent) to enable destination writes.

A workflow that defaults `dryRun: true` but doesn't *demonstrate* dry-run as its opening move gets skipped under deadline pressure. Don't ship one.

## Scheduling

Out-of-band. Document the recommended cadence in `workflow.md`'s frontmatter and let the user wire it to their scheduler of choice (`cron`, `launchd`, `systemd`, GitHub Actions, whatever they run). Don't try to be clever about scheduling — that's the user's environment to own.

## State storage

Two layers:

- **Cursor** — a local state file at `<dir>/state.json` (`{ lastRunAt, highWaterMark }`). The runner reads it at start, writes it at end.
- **Destination-side dedupe** — search-before-create on the catalyst's named `dedupeKey` is the durable defense regardless of where the cursor lives. Always include it.

## Output reporting

The runner prints the per-record decision log declared in the catalyst's `outputContract` to stdout. Persist a copy to `<dir>/runs/<timestamp>.json` so the user has a run history.

Shape: at minimum `recordId`, `action` (`inserted | updated | skipped-* | failed`), `destinationRecordId?`, plus any catalyst-specific fields. End with `{ cursor, totals }`.

## Secrets posture

- Never `cat` or `Read` `~/.mojulo/**/.env*` directly — always route through the `inspect_bot_env` MCP tool.
- The runner script should never log raw `.env` contents on any path, including error paths.
- If your runtime has a secrets-injection mechanism, prefer it over inlining secret values in `config.json` or the runner script.

## Hand-off to the user

When you finish materializing, tell the user:

- Where the workflow files live and how to invoke the runner.
- The first-invocation dry-run pattern is baked in; explain how to flip to live mode.
- The scheduling decision is theirs — point at the recommended cadence in `workflow.md` but don't try to wire the scheduler from inside the workflow.
- Re-run the catalyst flow if the bot's form schema or protocols change later.

---

## Primitive binding flow (no-bot composition)

Everything above describes the **catalyst** flow. There's a parallel flow mojulo supports for **no-bot, primitive-shaped** workflows: the agent declares its installed MCPs as a richer-snapshot inventory, calls `bind_primitives` per primitive slot, materializes the workflow as a `workflow.md` + runner script, and seals via `meta_context_commit({type: 'primitive_artifact_materialization', ...})`. This is the supported path when the user wants outcomes without a chatbot in the picture — the generated provider artifact reflects the operator's actual installed MCP (tool names, schemas) rather than a curated guess. The vendor-shaped `recommend_mcp_orbit_compositions` flow remains as a seed-reasoning surface for first-encounter scaffolding when runtime tool-schema knowledge is missing.

Since this is the baseline generic adapter — your host doesn't have a specific introspection affordance the way Claude Code or Codex do — the introspection step is the part where you'll have to improvise based on what your runtime exposes.

### Step 1 — Enumerate MCPs (use whatever client-native affordance you have)

In order of preference:

1. **If your runtime exposes a `tools/list` call** against connected MCPs — use it. Walk each server, collect tool names + descriptions + input schemas.
2. **If your runtime surfaces installed MCPs in a discoverable way** (config file, environment variable, agent context block) — read that surface and group tools by server.
3. **If neither** — ask the operator. "Which MCPs do you have connected? For each, what tools does it expose?" Capture what they tell you; mark each tool's `introspectionConfidence` honestly (`names_only` if you have just names; `agent_inferred` if you're filling in schema details from prior API knowledge they're not directly providing).

Don't fabricate tool surfaces you can't verify. A `names_only` snapshot still lets `bind_primitives` produce a working generated body — it just downgrades schema slots to "(no schema available)" and forces downstream consumers to treat bindings as approximate. That's honest and usable. A fabricated `tools_list_full` snapshot lies to the contextmap and makes the audit trail unreliable.

### Step 2 — Load schemas where you can

Same intent as Step 1. For each tool you'll cite in `bind_primitives`, load its input schema if your runtime supports schema discovery. If not, the binding's confidence drops to `agent_inferred` (you knew the name, you guessed the schema) or `names_only`.

### Step 3 — Ship the snapshot via `meta_context_declare_inventory` in richer-snapshot mode

Same call shape as the other adapters document. REPLACE semantics; include every MCP + tool that could play a primitive role this session.

### Step 4 — Bind primitives per composition slot

Call `bind_primitives` once per primitive slot. Read each returned `body` in full before incorporating it into the runner script.

### Step 5 — Materialize as `workflow.md` + runner script (same two-file pattern as the catalyst flow)

Same artifact target as catalyst materialization on this adapter: `<dir>/workflow.md` + `<dir>/run.<ext>`. Differences for primitive composition artifacts:

- The runner calls the **bound tool names from the snapshot directly** (e.g. `search_files`, `create_file`) — not affordance names. Affordance names are mojulo-side abstractions.
- Copy the relevant mapping intent + pitfalls from each `bind_primitives` body into `workflow.md`. The provider body is session-scoped; the file has to be self-contained at run time.
- The runner's first step is a tool-discovery preflight: for each bound tool name, verify it's accessible via the runtime's MCP client; exit non-zero with a clear message if any are missing.
- The dry-run pattern (first invocation prints destination payload + exits; `--live` flag flips to writes) still applies unchanged.

### Step 6 — Seal with `meta_context_commit` (primitive_artifact_materialization)

After the two files exist on disk:

```json
{
  "type": "primitive_artifact_materialization",
  "adapter_id": "generic",
  "artifact": { "locator": "<absolute path to workflow.md>", "label": "..." },
  "composition_intent": "...",
  "provider_artifact_refs": ["<every prov_xxx>"]
}
```

The generic adapter's verification runs `existsSync` on the locator — verify the file is actually on disk before committing. If commit fails, delete the workflow files before retrying.

### Inventory freshness

The `snapshot_stale` warning from `bind_primitives` (snapshot > 24h old) is your cue to re-run steps 1–3. Document in the materialized `workflow.md`'s frontmatter when the snapshot was captured — operators reading the file later need to know how fresh the bound tool list was at materialization time.
