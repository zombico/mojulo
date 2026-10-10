---
{
  "id": "generic",
  "name": "Generic agent",
  "summary": "Baseline contract for agents without a specific adapter — materializes catalysts as a workflow.md + runner script, scheduled out-of-band, state in a local file.",
  "version": 1,
  "artifactTarget": "./workflow.md + ./run.<ext>",
  "schedulingMechanism": "out-of-band (system cron, scheduler of user's choice)",
  "secretsPosture": "never read a .env directly",
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

- **Required mojulo tools** named in the catalyst's `mcpTools.mojulo` array (e.g. `create_character`, `get_stash`, `semantic_search`).
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

- Never `cat` or `Read` `~/.mojulo/**/.env*` or an app's `.env` directly.
- The runner script should never log raw `.env` contents on any path, including error paths.
- If your runtime has a secrets-injection mechanism, prefer it over inlining secret values in `config.json` or the runner script.

## Hand-off to the user

When you finish materializing, tell the user:

- Where the workflow files live and how to invoke the runner.
- The first-invocation dry-run pattern is baked in; explain how to flip to live mode.
- The scheduling decision is theirs — point at the recommended cadence in `workflow.md` but don't try to wire the scheduler from inside the workflow.
- Re-run the catalyst flow if the source's shape changes later.

## Handing back an export

Every written export (`export_model`, `export_game`, `cook`) returns a `handoff`: with no host profile resolved it is the generic sentence — the file is at `path`, `world.html` opens straight from `file://` with no server and no network (`cdn: true` writes `world.cdn.html`, which loads three.js from the pinned jsdelivr CDN, for a page door whose CSP refuses inline scripts), and the `download_url` is reachable only from the machine mojulo runs on. If your host has a door of its own (an artifact tool, a file card, a PR), that is the move; `export_model({ ref, format: 'bundle' })` gives you one zip (page, mesh, STL for literal kinds, recipe, README) for a door that takes one file. Set `MOJULO_HOST=<profile id>` when a shipped profile in `control/lib/mcp/hosts/` matches your surface and the note will name that host's door.

---

## Reaching other MCPs and workers

A catalyst that reaches past mojulo (`make-stuffy`: the body from mojulo, the fur from the operator's Blender) runs as the runnable artifact this card describes, beside the operator's other MCPs: call their tools by name from it. Mojulo hands files out (`export_model` writes the file, and its `handoff` names this host's door) and takes finished work back as outcomes under `data/outcomes/<ref>/`. Record which MCPs this host has with `meta_context_declare_inventory` only when the operator wants mojulo to know, never at session start. Until 3.1.0 this section bound primitives and sealed the composition in the contextmap; that flow left the tool surface with the office wing.
