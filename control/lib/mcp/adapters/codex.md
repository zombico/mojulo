---
{
  "id": "codex",
  "name": "Codex / OpenAI",
  "summary": "Materializes catalysts as Codex automations or workspace workflow files Codex follows interactively — scheduled via automation_update cron, state in workspace files, MCP preflight required.",
  "version": 1,
  "artifactTarget": "Codex automation (preferred for recurrence) OR workspace ./mojulo-workflows/<slug>/ (workflow + helpers Codex follows interactively)",
  "schedulingMechanism": "automation_update cron",
  "secretsPosture": "automation-level secrets + inspect_bot_env",
  "supportsClientInfoHint": ["codex", "openai-codex", "openai", "codex-cli"]
}
---

# Codex / OpenAI adapter

Your host is **Codex** (OpenAI's agent runtime). The runnable artifact this catalyst materializes is **not** a `.claude/skills/` file — that's Claude Code-specific. Materialize on Codex's substrate.

## Workspace prerequisite

Codex automations and workflow files both need a **workspace path**. Before materializing anything, resolve it explicitly:

1. If the current session has a bound workspace, use it.
2. If not, ask the user for a workspace path (or `cwd`) before continuing. Don't guess; don't materialize without one. A workspace-less artifact has nowhere to land its state file, no place to run a preflight from, and no `cwd` for the automation runtime.

If the user can't or won't provide a workspace, materialize as inline mode (artifact target 3 below) and tell them the recurring-execution path is unavailable until they create one.

## Workspace bootstrap (first time only)

Once you've resolved a workspace path, check for `<workspace>/.codex/mojulo/manifest.json`. If absent, this is a fresh Mojulo workspace — run the bootstrap before materializing any per-catalyst artifact. If present, skip ahead; the substrate is in place. The bootstrap writes only to the workspace; it doesn't touch external systems.

Inline mode (artifact target 3) skips this — no workspace, no substrate.

### Why the substrate exists, what it is NOT

The substrate is **directly-addressed cached state**, not a discovery convention. Codex does not auto-load workspace metadata files when it enters a workspace — an earlier iteration of this adapter wrote `AGENTS.md` and `.codex/procedures/*.md` expecting future Codex sessions to pick them up, and they don't. So the substrate's value is not that a fresh session stumbles across it; the value is that **per-catalyst artifacts the adapter materializes reference these paths directly** — to detect drift on every run, share provenance across catalysts that bind the same bot, and skip re-fetching deployment shape unnecessarily.

The corollary: don't write discovery breadcrumbs (`AGENTS.md`, `.codex/procedures/`, `README.md` stubs). Nothing reads them. The artifact carries its own preamble (see "Standing-moves preamble" below).

### What the bootstrap materializes

1. **`<workspace>/.codex/mojulo/manifest.json`** — workspace-level provenance and the bootstrap-already-ran signal:

   ```json
   {
     "convention": "mojulo-codex-workspace",
     "version": 1,
     "bootstrappedAt": "<ISO timestamp>",
     "mojuloServerVersion": "<from mojulo MCP version tool>",
     "deployments": []
   }
   ```

   `deployments` accumulates bot ids as later catalysts bind them (see "Dock into the workspace substrate" below). Don't re-bootstrap when this file exists.

2. **`<workspace>/.codex/mojulo/deployments/`** — empty directory. Per-deployment slots are created on first bind by per-catalyst materialization, not at bootstrap.

That's the entire bootstrap. Don't pre-create `tools/mojulo/`, `tests/mojulo/`, `verification/`, `AGENTS.md`, or any other stub — none of them pay rent.

### Standing-moves preamble (inline into every materialized artifact)

Because Codex won't auto-load a procedure file from the workspace, the standing moves go **into every artifact's prompt or `workflow.md`** as its opening block. The artifact is the only thing guaranteed to be read at run time, so the preamble has to live there:

```md
## Standing moves — run every time, before this workflow's main steps

1. **Preflight (mojulo MCP).** Verify mojulo MCP tools are visible (e.g. `get_deployment`, `query_submissions`). If missing, log "mojulo MCP not bound" and exit non-zero.
2. **Preflight (destination MCP).** Verify destination MCP tools are visible. If missing, log "destination MCP <name> not bound" and exit non-zero.
3. **Drift check.** Call `get_deployment(deploymentId)`. Compare its `configHash` against `<workspace>/.codex/mojulo/deployments/<id>/provenance.json` `configHash`. If different, refresh `deployment.json`, `schema.json`, and bump `provenance.json` `capturedAt` before continuing — otherwise yesterday's schema bakes into today's writes.
4. **Secrets posture.** Never `cat` or `Read` `~/.mojulo/**/.env*` directly — always go through `inspect_bot_env`. Same rule on error/exception paths.
5. **Dry-run gate.** Read `liveMode` from this artifact's config / parameters. If `false`, render the destination payload to the log and exit. If `true`, proceed to the live write.
```

Bake this exact block (or a near-equivalent matching the artifact mode) into the artifact you materialize. The tool-discovery preflight section below specifies steps 1–2 in deeper detail; the rest are catalyst-independent moves that have to run every time regardless of which catalyst spawned the artifact.

## Artifact target

Pick one of these three, in priority order:

1. **Codex automation** (preferred for recurring work). Create/update via the `automation_update` tool with: a self-contained prompt, the resolved workspace `cwd`, the cadence, and model settings. Right target when the user wants the workflow to run on a schedule without further intervention.
2. **Workspace workflow file** at `./mojulo-workflows/<bot-slug>-<purpose>/` (inside the resolved workspace), containing `workflow.md` plus a small `config.json`. The workflow file is a **procedure Codex follows interactively** in a workspace session — not a standalone script. Codex reads it, makes the mojulo MCP calls and destination MCP calls itself, persists state. Right target for one-shot or version-controlled workflows where the user wants a file they can commit and review.
3. **Inline one-shot** in the current Codex thread. Acceptable for exploration and as the fallback when no workspace is available. Don't default to this for anything the user expects to re-run.

Default to (2) for design-time work, (1) when the user has named a cadence ("nightly", "every Monday morning", "every hour").

### Why a runner script is NOT the workflow file

A plain `run.sh` / `run.ts` / `run.py` cannot call mojulo's MCP tools — local scripts don't speak MCP, they'd need an MCP client runtime that isn't there by default. So **`workflow.md` is the artifact, not a runner**. The workflow file documents the procedure; Codex executes it via its native MCP client. A deterministic helper script (e.g. one that formats a destination payload) can sit alongside `workflow.md` and be invoked by Codex during execution — but the helper is a leaf, not the entry point.

## Dock into the workspace substrate

After picking the artifact target (modes 1 or 2), snapshot the target deployment(s) into `.codex/mojulo/deployments/<id>/` and record this catalyst in their provenance. This is what makes the substrate worth having — without it, the per-catalyst artifact still runs, but a future session has no record of when it was materialized or against what schema.

For each deployment the artifact binds:

1. **Snapshot or refresh.** If `<workspace>/.codex/mojulo/deployments/<id>/` doesn't exist, create it. Either way: call `get_deployment(<id>)` and compare its `configHash` against `provenance.json` `configHash`. If different (or the slot is new), write:
   - `deployment.json` — the full `get_deployment` response.
   - `schema.json` — the bot's form schema lifted out of `deployment.config` for easy diff (formGathering bots only; skip if the protocol isn't enabled).
   - `provenance.json`:

     ```json
     {
       "deploymentId": "<id>",
       "botName": "<name>",
       "capturedAt": "<ISO timestamp>",
       "mojuloServerVersion": "<from version>",
       "botImage": "<from version>",
       "configHash": "<from get_deployment>",
       "schemaFingerprint": "<sha256 of schema.json or null>",
       "enabledProtocols": ["..."],
       "relatedCatalysts": []
     }
     ```

2. **Append this catalyst.** Add the catalyst id to `provenance.json` `relatedCatalysts` if it's not already there. This is the per-deployment audit trail — a future session reads it to know what's been built against this bot.

3. **Register in the workspace manifest.** Add the deployment id to `<workspace>/.codex/mojulo/manifest.json` `deployments` if absent.

`configHash` and `schemaFingerprint` are the staleness signals the standing-moves preamble (above) checks on every run. At materialization time, don't bind against a stale snapshot — refresh first, or you'll bake yesterday's schema into tomorrow's automation.

## Parameter collection

Ask the catalyst's `parameters` questions in one batched round before materializing. Skip questions the user already answered in their intent.

- **Mode 1 (automation):** the answered values get baked into the automation prompt.
- **Mode 2 (workflow file):** they become defaults in `<workspace>/mojulo-workflows/<slug>/config.json` and are referenced by `workflow.md`.

## Tool discovery preflight (required)

**Detached automations may not see your current tool surface.** Codex tool schemas load lazily, destination MCPs may not be wired, and an automation executing on a schedule starts from a fresh tool registry. Bake a preflight into every materialized artifact as its **first step**:

```
1. Verify mojulo MCP tools are visible (e.g. get_deployment, query_submissions). If missing: log "mojulo MCP not bound" and exit non-zero.
2. Verify destination MCP tools are visible (e.g. the CRM's contact-create tool). If missing: log "destination MCP <name> not bound" and exit non-zero.
3. Only then proceed to the workflow.
```

For deferred destination tools, the preflight should also call `tool_search` to load schemas before the first usage. If a catalyst's `destinationExamples` aren't installed at materialization time, surface them as consultation suggestions ("a CRM MCP — HubSpot, Salesforce, Pipedrive, Attio — would unlock the live-write path") rather than blocking — but the preflight in the artifact itself must hard-fail if the bound tools aren't there at run time.

## Dry-run as a concrete artifact step

`dryRun: true` defaulting in the contract is not enough on its own. Bake the dry-run into the artifact and pair it with a **concrete flip mechanism**:

- **Automation (mode 1):** add a parameter to the automation called `liveMode` (default `false`). The automation prompt branches on it: when `false`, render the destination payload to the automation's execution log and exit; when `true`, write to the destination. The user flips the flag by editing the automation's parameters in Codex's automation UI — that's the concrete storage location, not "the user marks it verified."
- **Workflow file (mode 2):** add a `liveMode: false` field to `<workspace>/mojulo-workflows/<slug>/config.json`. Codex reads it at the start of every run; the user edits the file to flip. Document the flip in `workflow.md`.
- **Inline (mode 3):** show the destination payload for one real record, then ask before any live write. No persisted flag — the human is in the loop every time.

A workflow that defaults `liveMode: false` but doesn't *demonstrate* dry-run as its opening move (or doesn't tell the user the exact field to flip) gets skipped under deadline pressure. Don't ship one.

## Scheduling

- **Mode 1 (automation):** cadence is `automation_update`'s native cron. The automation prompt must be self-contained — bot id, mapping table, destination MCP binding, dry-run preflight, parameter references. Codex automations don't carry external state across runs by default; use the workspace state file (below) for anything cross-run.
- **Mode 2 (workflow file):** schedule with the user's preferred system cron / launchd / systemd, which invokes a Codex CLI session against the workspace. Document the recommended cadence in `workflow.md`'s frontmatter.

## State storage

Three layers, used in combination — and a rule about where state should NOT live:

- **Cursor (preferred):** a workspace state file at `<workspace>/mojulo-workflows/<slug>/state.json` (JSON: `{ lastRunAt, highWaterMark }`). Read at the start of each run, write at the end. This is the durable option.
- **Cursor (anti-pattern):** **do not** store the cursor by mutating the automation prompt itself. Model-driven prompt rewriting on each run is fragile, races on concurrent triggers, and silently corrupts state when the model "fixes" or "tidies" the prompt. If no workspace is available, prefer a single-shot run over a recurring automation with prompt-stored cursor.
- **Destination-side dedupe:** search-before-create on the catalyst's named `dedupeKey` is the durable defense regardless of where the cursor lives. Always include it.
- **Last-run timestamp:** for automations, recoverable from the automation's execution log; don't track it separately.

## Output reporting

Surface the per-record decision log declared in the catalyst's `outputContract` (or the equivalent prose section):

- **Automation:** to the automation's execution log. Include the new cursor value in the log footer so the next run picks it up from the state file (the log is for the human reviewer, not the next run).
- **Workflow file:** to stdout in the Codex session, plus persist to `<workspace>/mojulo-workflows/<slug>/runs/<timestamp>.json` so the user has a run history they can grep.
- **Inline:** to the current thread.

Shape: at minimum `recordId`, `action` (`inserted | updated | skipped-* | failed`), `destinationRecordId?`, plus any catalyst-specific fields (`score`, `priority`, `confidence`). End each run with `{ cursor: <new high-water>, totals: { inserted, skipped, failed } }`.

## Secrets posture

Translate mojulo's "never `cat` `.env`" standing rule into Codex behavior:

- Don't `cat` or `Read` `~/.mojulo/**/.env*` directly — always route through the `inspect_bot_env` MCP tool, which returns `{ key, value, masked }`.
- Don't echo secrets into the automation prompt as plain text. If the user has Codex's secret-injection mechanism wired, reference secrets through that interface; otherwise leave secret values out of the prompt entirely and let the destination MCP's auth surface handle them.
- The materialized artifact (automation prompt or workflow file) must never log raw `.env` contents on any execution path, including error/exception paths. Error handlers that dump environment for debugging are a common leak vector — explicitly redact.

## Hand-off to the user

When you finish materializing, tell the user:

- Which mode you picked (automation / workflow file / inline), where the artifact lives, and the resolved workspace path.
- The exact location of the dry-run flip (automation parameter `liveMode` / workflow file `config.json` `liveMode` field).
- For automations: how to view the execution log; how to inspect parameters.
- For workflow files: how to invoke a Codex session against the workspace; the state file location.
- That the preflight will hard-fail if mojulo MCP or destination MCP isn't bound at run time — they should expect to see that message on first run if their automation environment differs from the materialization environment.
- If the bootstrap fired: that you wrote `.codex/mojulo/manifest.json` and the empty `.codex/mojulo/deployments/` directory. Subsequent catalysts materialized into this workspace will dock onto the same substrate and share its per-deployment provenance. Commit it if the workspace is version-controlled. (You did not write `AGENTS.md` or `.codex/procedures/` — Codex doesn't auto-load those, so the procedure prose was inlined into this artifact's standing-moves preamble instead.)
- That `.codex/mojulo/deployments/<id>/provenance.json` records when this catalyst was materialized and against what `configHash` + `schemaFingerprint`. The artifact's standing-moves preamble compares against these on every run — if the bot is rebuilt or its schema is regenerated, the artifact will refresh the snapshot itself before continuing.
