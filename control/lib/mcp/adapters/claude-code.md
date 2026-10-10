---
{
  "id": "claude-code",
  "name": "Claude Code",
  "summary": "When the user asks for a workflow, materializes the catalyst as a user-owned skill under .claude/skills/, scheduled via /schedule; secrets never read, with a deny block the user may add to .claude/settings.json if they ask.",
  "version": 1,
  "artifactTarget": ".claude/skills/<slug>/SKILL.md",
  "schedulingMechanism": "/schedule",
  "secretsPosture": "never read a .env; an optional .claude/settings.json deny block the user adds themselves, shown only when they ask",
  "supportsClientInfoHint": ["claude-code", "claude-ai", "claude"]
}
---

# Claude Code adapter

Your host is **Claude Code**. The runnable artifact this catalyst materializes is a **user-owned skill** at `.claude/skills/<slug>/SKILL.md`. Write it **only when the user has asked for this workflow to be set up**: reading a catalyst, or recommending one, is not that request. Tell the user the path before you write, and let Claude Code's own permission prompt cover the write. Once written, the skill belongs entirely to the user — they edit, version-control, and iterate on it; mojulo does not write, host, execute, or store skills.

## Artifact target

- Path: `.claude/skills/<slug>/SKILL.md`
- Slug pattern: `<source-slug>-<short-purpose>` (e.g. `acme-crm-sync`, `acme-weekly-digest`). Multiple catalysts can materialize against one source — they get distinct slugs so they don't collide.
- Helper files (config templates, mapping tables, fixtures) go next to the SKILL.md in the same directory.

## Parameter collection

Ask the catalyst's `parameters` questions in one batched round before writing the skill. Don't drip questions one at a time. Skip questions the user already answered in their intent.

## Tool discovery

You already see which MCP tools are bound in this session. Cross-reference the catalyst's `destinationExamples` against what's available:

- Destination MCP installed → bind it and write a working skill.
- Destination MCP not installed → mention it as a soft upgrade ("you'd need a CRM MCP — HubSpot, Salesforce, Pipedrive, Attio — for the live-write path"). Don't gatekeep. Per the consultation posture, the user opts into upgrades; mojulo doesn't block.

## Dry-run as a concrete skill step

`dryRun: true` defaulting in the contract is not enough on its own — users skip the dry-run under deadline pressure when it's only a default. Bake it into the skill's **first step**:

> First invocation: pull one real record, render the full destination payload to stdout, do not call the destination's write tool, wait for explicit "go live" from the user. Subsequent runs default to `dryRun: false` only after that confirmation.

A skill that defaults `dryRun: true` but doesn't *demonstrate* dry-run as its opening move gets skipped. Don't ship one.

## Scheduling

For recurring execution, instruct the user to combine the skill with the `/schedule` slash command. The skill stays parameterized; `/schedule` provides cadence + bound arguments and persists the schedule in the user's Claude Code state.

## State storage

Two layers, both belong in the skill:

- **Cursor** — the skill prints the new high-water cursor (typically `captured_at`) at end of run. The user passes it back next time, or `/schedule` carries it in the bound arguments.
- **Destination-side dedupe** — search-before-create on the catalyst's named `dedupeKey` is the durable defense, independent of where the cursor lives. Always include it; the cursor is the primary defense, dedupe is the safety net.

## Output reporting

Surface the per-record decision log declared in the catalyst's `outputContract` (or the equivalent prose section) to stdout — Claude Code presents stdout to the user inline. Include the new cursor value in the trailing log line so the user (or `/schedule`) can pick it up.

## Secrets posture

Mojulo's standing rule is "never `cat` `.env`": values are never read. **Only when the user asks** how to keep an agent away from those secrets (or asks you to harden their Claude Code settings), show them this deny rule, which Claude Code's harness enforces, for them to add to `.claude/settings.json` themselves. Do not raise it unprompted and do not edit `.claude/settings.json` yourself: Claude's permission settings are the user's to change.

```json
{
  "permissions": {
    "deny": [
      "Read(~/.mojulo/**/.env)",
      "Read(~/.mojulo/**/.env.*)",
      "Bash(cat ~/.mojulo/**/.env*)"
    ]
  }
}
```

Inside the skill itself: never `cat` or `Read` a `.env` directly.

## Hand-off to the user

When you finish synthesizing, tell the user:

- Where the skill was written (`.claude/skills/<slug>/SKILL.md`).
- That the skill is theirs — mojulo doesn't see it, doesn't execute it, doesn't update it. Re-run the catalyst flow if the source's shape changes later.
- The first-invocation dry-run pattern is baked in; explain how to flip to live mode when they're satisfied.
- That `/schedule` is the way to make it recurring if they want that.

## Handing back an export

Every written export (`export_model`, `export_game`, `cook`) returns a `handoff` for this host — the door, the next move, the caveats — and `fits` against the door's byte limit. Read it; do not improvise from the `download_url`, which is loopback and unreachable from a box. Two surfaces, and `clientInfo` cannot tell them apart, so the note states both when `MOJULO_SURFACE` is unset; you know which machine you are on.

- **On the operator's machine** (Claude Code local, Claude Desktop): the dashboard URL works, and every file is on their disk. Hand over the path.
- **Inside Claude Code on the web** (`MOJULO_SURFACE=box`): the page door is your Artifact tool — publish `world.cdn.html` as one HTML page, ≤ 16 MiB (`export_model({ ref, format: 'html', cdn: true })`). Its three.js comes from the pinned jsdelivr path on your CDN allowlist, which is the ONLY form that runs here: your page CSP refuses inline `data:` scripts at any size, so the default self-contained `world.html` loads and draws nothing there. Ask for `cdn: true` for this door only; the default build is the file that works with no network. The file door is a page: the artifact host serves no archive or model as a supporting file and blocks page-initiated downloads, but a published page may offer a file it generated through the viewer's `downloads` capability (the allowlist carries `zip`, not `glb` / `stl`). So ask for `export_model({ ref, format: 'bundle' })` and publish its `<ref>.courier.html` with `capabilities: { downloads: true }`: its Save button hands the zip over. Or push the outcome folder to the branch and let the PR carry it. The box is reclaimed when the session ends — hand over `recipe.json` too; any host running mojulo re-mints it. One wire note: this host renders a result's `structuredContent` in place of its text block, so mojulo ships the whole body there, never a subset.

---

## Reaching other MCPs and workers

A catalyst that reaches past mojulo (`make-stuffy`: the body from mojulo, the fur from the operator's Blender) runs as a skill under `.claude/skills/<slug>/`, beside the operator's other MCPs: call their tools by name from it. Mojulo hands files out (`export_model` writes the file, and its `handoff` names this host's door) and takes finished work back as outcomes under `data/outcomes/<ref>/`. Record which MCPs this host has with `meta_context_declare_inventory` only when the operator wants mojulo to know, never at session start. Until 3.1.0 this section bound primitives and sealed the composition in the contextmap; that flow left the tool surface with the office wing.
