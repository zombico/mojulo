---
{
  "id": "claude-code",
  "name": "Claude Code",
  "summary": "Materializes catalysts as user-owned skills under .claude/skills/, scheduled via /schedule, secrets-guarded via .claude/settings.json deny rules.",
  "version": 1,
  "artifactTarget": ".claude/skills/<slug>/SKILL.md",
  "schedulingMechanism": "/schedule",
  "secretsPosture": ".claude/settings.json deny rules + inspect_bot_env",
  "supportsClientInfoHint": ["claude-code", "claude-ai", "claude"]
}
---

# Claude Code adapter

Your host is **Claude Code**. The runnable artifact this catalyst materializes is a **user-owned skill** at `.claude/skills/<slug>/SKILL.md`. Once written, it belongs entirely to the user — they edit, version-control, and iterate on it; mojulo does not host, execute, or store skills.

## Artifact target

- Path: `.claude/skills/<slug>/SKILL.md`
- Slug pattern: `<bot-slug>-<short-purpose>` (e.g. `acme-crm-sync`, `acme-scan-churn-intent`). Multiple catalysts can materialize against one bot — they get distinct slugs so they don't collide.
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

Translate mojulo's "never `cat` `.env`" standing rule into a defense-in-depth deny rule the harness enforces. Suggest the user add this to `.claude/settings.json` on first connect:

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

Inside the skill itself: never `cat` or `Read` a bot's `.env` directly — always go through the `inspect_bot_env` MCP tool, which returns masked sensitive values plus clear non-sensitive ones. Skill prompts should reference `inspect_bot_env` by name when they need to read bot configuration.

## Hand-off to the user

When you finish synthesizing, tell the user:

- Where the skill was written (`.claude/skills/<slug>/SKILL.md`).
- That the skill is theirs — mojulo doesn't see it, doesn't execute it, doesn't update it. Re-run the catalyst flow if the bot's form schema or protocols change later.
- The first-invocation dry-run pattern is baked in; explain how to flip to live mode when they're satisfied.
- That `/schedule` is the way to make it recurring if they want that.
