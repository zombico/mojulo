---
{
  "id": "codex",
  "name": "Codex / OpenAI",
  "summary": "Materializes catalysts as Codex automations or workspace workflow files Codex follows interactively — scheduled via automation_update cron, state in workspace files, MCP preflight required.",
  "version": 1,
  "artifactTarget": "Codex automation (preferred for recurrence) OR workspace ./mojulo-workflows/<slug>/ (workflow + helpers Codex follows interactively)",
  "schedulingMechanism": "automation_update cron",
  "secretsPosture": "automation-level secrets; never read a .env",
  "supportsClientInfoHint": ["codex", "openai-codex", "codex-cli"]
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

The substrate is **directly-addressed cached state**, not a discovery convention. Codex does not auto-load workspace metadata files when it enters a workspace — an earlier iteration of this adapter wrote `AGENTS.md` and `.codex/procedures/*.md` expecting future Codex sessions to pick them up, and they don't. So the substrate's value is not that a fresh session stumbles across it; the value is that **the artifacts the adapter materializes reference these paths directly** — to detect drift on every run and share provenance across artifacts built in the same workspace.

The corollary: don't write discovery breadcrumbs (`AGENTS.md`, `.codex/procedures/`, `README.md` stubs). Nothing reads them. The artifact carries its own preamble (see "Standing-moves preamble" below).

### What the bootstrap materializes

1. **`<workspace>/.codex/mojulo/manifest.json`** — workspace-level provenance and the bootstrap-already-ran signal:

   ```json
   {
     "convention": "mojulo-codex-workspace",
     "version": 1,
     "bootstrappedAt": "<ISO timestamp>",
     "mojuloServerVersion": "<from mojulo MCP version tool>"
   }
   ```

   Don't re-bootstrap when this file exists.

That's the entire bootstrap. Don't pre-create `tools/mojulo/`, `tests/mojulo/`, `verification/`, `AGENTS.md`, or any other stub — none of them pay rent.

### Standing-moves preamble (inline into every materialized artifact)

Because Codex won't auto-load a procedure file from the workspace, the standing moves go **into every artifact's prompt or `workflow.md`** as its opening block. The artifact is the only thing guaranteed to be read at run time, so the preamble has to live there:

```md
## Standing moves — run every time, before this workflow's main steps

1. **Preflight (mojulo MCP).** Verify mojulo MCP tools are visible (e.g. `version`, `get_stash`). If missing, log "mojulo MCP not bound" and exit non-zero.
2. **Preflight (destination MCP).** Verify destination MCP tools are visible. If missing, log "destination MCP <name> not bound" and exit non-zero.
3. **Drift check.** Re-read the source's shape (the mojulo read tool this artifact names) and compare it against this artifact's `provenance.json`. If different, refresh the snapshot and bump `capturedAt` before continuing — otherwise yesterday's schema bakes into today's writes.
4. **Secrets posture.** Never `cat` or `Read` `~/.mojulo/**/.env*` or an app's `.env` directly. Same rule on error/exception paths.
5. **Dry-run gate.** Read `liveMode` from this artifact's config / parameters. If `false`, render the destination payload to the log and exit. If `true`, proceed to the live write.
```

Bake this exact block (or a near-equivalent matching the artifact mode) into the artifact you materialize. The tool-discovery preflight section below specifies steps 1–2 in deeper detail; the rest are catalyst-independent moves that have to run every time regardless of which catalyst spawned the artifact.

## Artifact target

Pick one of these three, in priority order:

1. **Codex automation** (preferred for recurring work). Create/update via the `automation_update` tool with: a self-contained prompt, the resolved workspace `cwd`, the cadence, and model settings. Right target when the user wants the workflow to run on a schedule without further intervention.
2. **Workspace workflow file** at `./mojulo-workflows/<slug>-<purpose>/` (inside the resolved workspace), containing `workflow.md` plus a small `config.json`. The workflow file is a **procedure Codex follows interactively** in a workspace session — not a standalone script. Codex reads it, makes the mojulo MCP calls and destination MCP calls itself, persists state. Right target for one-shot or version-controlled workflows where the user wants a file they can commit and review.
3. **Inline one-shot** in the current Codex thread. Acceptable for exploration and as the fallback when no workspace is available. Don't default to this for anything the user expects to re-run.

Default to (2) for design-time work, (1) when the user has named a cadence ("nightly", "every Monday morning", "every hour").

### Why a runner script is NOT the workflow file

A plain `run.sh` / `run.ts` / `run.py` cannot call mojulo's MCP tools — local scripts don't speak MCP, they'd need an MCP client runtime that isn't there by default. So **`workflow.md` is the artifact, not a runner**. The workflow file documents the procedure; Codex executes it via its native MCP client. A deterministic helper script (e.g. one that formats a destination payload) can sit alongside `workflow.md` and be invoked by Codex during execution — but the helper is a leaf, not the entry point.

## Record provenance

For modes 1 and 2, record what the artifact was built against in a `provenance.json` beside it (`<workspace>/mojulo-workflows/<slug>/provenance.json`, or the automation's parameters): the catalyst id, `capturedAt`, `mojuloServerVersion` (from `version`) and the source shape the mapping reads. The standing-moves drift check compares against it on every run. Don't bind against a stale snapshot — refresh first, or you'll bake yesterday's schema into tomorrow's automation.

## Parameter collection

Ask the catalyst's `parameters` questions in one batched round before materializing. Skip questions the user already answered in their intent.

- **Mode 1 (automation):** the answered values get baked into the automation prompt.
- **Mode 2 (workflow file):** they become defaults in `<workspace>/mojulo-workflows/<slug>/config.json` and are referenced by `workflow.md`.

## Tool discovery preflight (required)

**Detached automations may not see your current tool surface.** Codex tool schemas load lazily, destination MCPs may not be wired, and an automation executing on a schedule starts from a fresh tool registry. Bake a preflight into every materialized artifact as its **first step**:

```
1. Verify mojulo MCP tools are visible (e.g. version, get_stash). If missing: log "mojulo MCP not bound" and exit non-zero.
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

- **Mode 1 (automation):** cadence is `automation_update`'s native cron. The automation prompt must be self-contained — source handle, mapping table, destination MCP binding, dry-run preflight, parameter references. Codex automations don't carry external state across runs by default; use the workspace state file (below) for anything cross-run.
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

- Don't `cat` or `Read` `~/.mojulo/**/.env*` or an app's `.env` directly; the values stay where the operator set them.
- Don't echo secrets into the automation prompt as plain text. If the user has Codex's secret-injection mechanism wired, reference secrets through that interface; otherwise leave secret values out of the prompt entirely and let the destination MCP's auth surface handle them.
- The materialized artifact (automation prompt or workflow file) must never log raw `.env` contents on any execution path, including error/exception paths. Error handlers that dump environment for debugging are a common leak vector — explicitly redact.

## Hand-off to the user

When you finish materializing, tell the user:

- Which mode you picked (automation / workflow file / inline), where the artifact lives, and the resolved workspace path.
- The exact location of the dry-run flip (automation parameter `liveMode` / workflow file `config.json` `liveMode` field).
- For automations: how to view the execution log; how to inspect parameters.
- For workflow files: how to invoke a Codex session against the workspace; the state file location.
- That the preflight will hard-fail if mojulo MCP or destination MCP isn't bound at run time — they should expect to see that message on first run if their automation environment differs from the materialization environment.
- If the bootstrap fired: that you wrote `.codex/mojulo/manifest.json`. Later artifacts materialized into this workspace share the same substrate. Commit it if the workspace is version-controlled. (You did not write `AGENTS.md` or `.codex/procedures/` — Codex doesn't auto-load those, so the procedure prose was inlined into this artifact's standing-moves preamble instead.)
- That the artifact's `provenance.json` records when it was materialized and against what source shape. The standing-moves preamble compares against it on every run — if the source changes, the artifact refreshes the snapshot itself before continuing.

## Handing back an export

Every written export (`export_model`, `export_game`, `cook`) returns a `handoff` for this host and `fits` against its byte limit; read it instead of quoting the loopback `download_url`.

- **Codex CLI / desktop on the operator's machine**: the desktop app previews `world.html`; every file is on their disk. Hand over the path. That page carries its own three.js, so the preview draws with no network; `cdn: true` writes `world.cdn.html`, which loads three.js from the pinned jsdelivr CDN instead.
- **A Codex cloud task** (`MOJULO_SURFACE=box`): there is no page door — the PR is the handoff. Commit the outcome folder (`data/outcomes/<ref>/`) to the branch; `export_model({ ref, format: 'bundle' })` makes it one binary (`<ref>.zip`: page, mesh, STL for literal kinds, recipe, README) when a folder of files is the wrong shape. The box is reclaimed after the task — the recipe in the folder is what re-mints.

---

## Reaching other MCPs and workers

A catalyst that reaches past mojulo (`make-stuffy`: the body from mojulo, the fur from the operator's Blender) runs as the automation this card describes, beside the operator's other MCPs: call their tools by name from it. Mojulo hands files out (`export_model` writes the file, and its `handoff` names this host's door) and takes finished work back as outcomes under `data/outcomes/<ref>/`. Record which MCPs this host has with `meta_context_declare_inventory` only when the operator wants mojulo to know, never at session start. Until 3.1.0 this section bound primitives and sealed the composition in the contextmap; that flow left the tool surface with the office wing.
