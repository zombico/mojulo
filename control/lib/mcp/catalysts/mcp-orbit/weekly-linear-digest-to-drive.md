---
{
  "id": "weekly-linear-digest-to-drive",
  "name": "Weekly Linear digest → Drive doc",
  "subject": "mcp-orbit",
  "trigger": "scheduled",
  "summary": "Once a week, summarize the past week of Linear issue activity and append it to a Drive doc the operator can scan in a few minutes.",
  "valueHook": "Stop opening Linear every Monday morning to remember what shipped last week.",
  "requires": {
    "sources": [
      { "category": "structured_record_store", "examples": ["linear", "github_issues", "jira"] }
    ],
    "destinations": [
      { "category": "document_store", "examples": ["gdrive", "notion", "confluence"] }
    ]
  }
}
---

# Weekly Linear digest → Drive doc

> Mojulo is the deliberation layer here, **not the data source**. The issue tracker holds the source data; the document store holds the destination. Mojulo's role is to anchor the synthesis decision — what counts as "the digest," what's clamped by operator constraints, what's already been materialized for this operator — so the synthesized skill is auditable and re-derivable.

## When this fits

The operator wants a recurring, lightweight read-out of issue-tracker activity into a place they actually look on Monday mornings. The pattern reads as **scheduled aggregation**: many small events (issue created / closed / updated through the week) → one summary in a stable destination.

**Reject this catalyst when:**

- No structured-record-store MCP is in the declared inventory. Call `meta_context_brief({ scope: { kind: 'fleet' } })` first — `inventory.servers` is the truth.
- No document-store MCP is in the declared inventory.
- The user wants signal-driven response ("when issue X happens, do Y immediately") — that's a different pattern; redirect them to a signal-shaped meta-catalyst.
- The user wants the digest delivered to chat (Slack, Discord) — redirect them to a chat-destination variant.

## Materialization

### Step 1 — Read mojulo's substantial anchors

The substantial side of this catalyst is mojulo's own state, not the bot anatomy that bot catalysts get to lean on. Read it first, before touching either MCP.

1. `meta_context_brief({ scope: { kind: 'fleet' } })` — pulls the operator anchor, current inventory, and the contextmap subgraph in one call.
2. **Check `inventory.ageSeconds`.** If `> 604800` (one week), ask the user to re-declare via `meta_context_declare_inventory` before continuing. Inventory IS the schema for this catalyst; stale inventory is the equivalent of a stale bot config.
3. **Check prior materializations of this catalyst.** Call `meta_context_brief({ scope: { kind: 'catalyst', ref: 'weekly-linear-digest-to-drive' } })`. If a prior artifact exists for this operator:
   - Same destination doc → likely duplicate. Confirm with the user before re-materializing; offer to *update* the existing artifact instead.
   - Different destination doc → ask whether this is a replacement or a parallel digest (latter usually means a different team).
4. **Read the operator anchor's locked-in constraints.** If any name a preferred document store (e.g., "all weekly reports go to Notion") or forbid one ("no Google services for compliance reasons"), clamp the destination at synthesis time. **Operator KYC overrides catalyst defaults — never the other way around.**

### Step 2 — Probe the source MCP at synthesis time

Don't assume Linear. Read inventory and pick whichever structured-record-store MCP the operator declared. Then probe it — the same way `qualify-lead-to-crm` probes the CRM destination instead of assuming HubSpot.

Per common MCP, look for:

- **Linear**: `list_issues` (or equivalent) with date filter. Confirm `updated_at` is returned per issue — without it there's no way to define "the past week." Pagination is cursor-based; rate limit is cost-based.
- **GitHub issues**: `list_repository_issues` with `since` parameter. Pagination is page+per_page; rate limit is request-based.
- **Jira**: `search_issues` with JQL (`updated >= -7d`). Pagination is startAt+maxResults.

In each case identify:
- The "everything that changed in the last N days" query shape.
- The pagination contract.
- The rate-limit posture (matters for first run, which may need to paginate further back).

### Step 3 — Probe the destination MCP at synthesis time

Same discipline on the destination side. Per common MCP:

- **Google Drive**: typically one Google Doc per week, named `Linear digest — YYYY-W##`, in a folder the operator names. Probe `create_file` and `append_to_doc`.
- **Notion**: a database with one row per week, or a single page with a `## Week of YYYY-MM-DD` header per entry. Probe the page-create / database-row-create surface.
- **Confluence**: one page per week under a parent space.

Identify:
- The create-or-append affordance the destination prefers (per-week new doc vs rolling append).
- The naming convention the operator's KYC implies — look for `naming conventions` in constraints.
- Whether the destination supports drafts (Google Docs: yes; Notion: yes via unpublished pages; Confluence: yes via draft revisions). The dry-run depends on this.

### Step 4 — Negotiate the digest shape with the operator

Ask in **one round** before synthesizing:

1. **Window** — past 7 days from run time? Calendar week (Mon–Sun)? Sprint-aligned?
2. **Grouping** — by team / by status / by assignee / flat?
3. **Depth** — title + URL only? Title + URL + one-line summary? Title + URL + summary + key comments?
4. **Quiet mode** — skip the run entirely when no issues changed, or always produce a doc that says "no activity"?

These four knobs turn this catalyst from synthesis pretext into a usable digest. Don't synthesize without them.

### Step 5 — Resolve idempotency before scheduling

A weekly digest has two ways to misfire under `trigger: scheduled`:

1. **Double-write on the same week** — the schedule fires twice, two digest docs land. Idempotency key: `${destination_doc_id_or_title}-${YYYY-W##}`. Before creating, search the destination for one with that key in the title; if present, skip the create (or append to the existing, depending on Step 4).
2. **Re-summarize already-summarized issues** — only relevant if the operator chose continuous rolling rather than weekly slices. In that case, store the last-processed `updated_at` cursor in the adapter's state location (see adapter section) and only process issues with `updated_at > cursor`.

A `trigger: scheduled` artifact with no idempotency story is a bug, not a feature. **Reject the synthesis** if neither idempotency strategy applies and the user has not explicitly accepted the double-write risk.

### Step 6 — Dry-run shape (mandatory)

The dry-run for this catalyst is one real week, on one real source project, writing to a **draft** destination doc:

1. Pull the past 7 days from the configured source — show the count to the user.
2. Render the digest body to a markdown string — show the rendered text in the conversation.
3. Create the destination doc as a **draft** (Google Docs: leave unpublished; Notion: leave un-shared; Confluence: draft revision).
4. Surface the draft URL and ask: "Promote to live, or adjust?"

A dry-run that skips step 3 is not a dry-run — it's a preview. The point is to exercise the destination MCP's actual write path against a real (if reversible) artifact, because that's where permissions / quotas / field validation actually fail.

### Step 7 — Hand to the host adapter for packaging

Once promoted, hand the resolved composition to the bound host adapter. The adapter section in `get_adapter()`'s response is the contract; what the adapter packages is uniform across catalysts:

- **claude-code**: `.claude/skills/weekly-linear-digest-to-drive/SKILL.md` scheduled via `/schedule weekly`.
- **codex**: a Codex automation with a cron rule, or a workspace workflow file.
- **generic**: `workflow.md` + runner script the operator schedules out-of-band.

This catalyst's payload to the adapter is: the source query, the destination resolver, the rendering template, the idempotency key, the schedule cadence, and the operator's promotion confirmation.

### Step 8 — Seal the materialization

After the artifact is on disk / in the host substrate:

```jsonc
meta_context_commit({
  type: 'artifact_materialization',
  adapter_id: '<bound adapter>',
  artifact: { locator: '<…>', label: 'Weekly Linear digest → Drive' },
  // bot_ref omitted — this artifact runs against MCP inventory, not a bot.
  catalyst_ref: 'weekly-linear-digest-to-drive',
  bindings: [
    { mcp_tool: 'linear.list_issues', fields_bound: ['updated_at', 'team', 'status'] },
    { mcp_tool: 'gdrive.create_file', fields_bound: ['title', 'body'] }
  ],
  principles: [
    {
      scope: 'artifact',
      body_md: 'Window: past 7 calendar days. Grouping: by team. Quiet mode: skip empty weeks. Destination: <doc URL>.\n\n**Context:** Operator confirmed at synthesis time.\n\n**Applies to:** This artifact only.'
    }
  ]
})
```

**For mcp-orbit catalysts, this commit IS the audit chain.** There's no `verify_chain` because there's no bot turn history; the only durable record of *why this skill exists and what it's configured to do* is this commit. **Don't skip it.** If the commit fails, roll the artifact back via the adapter's own affordance (delete the SKILL.md / cancel the automation).

## Pitfalls

- **Inventory drift between sessions.** The destination MCP may have rotated permissions or removed scopes since the operator last declared inventory. Verify by reading one real doc from the destination during the dry-run, not just probing.
- **PII in issue titles.** If source issues contain customer PII (support tickets, sales prospects), the digest body will too. Honor any `no PII in summaries` constraint in the operator KYC.
- **Scheduling drift across timezones.** "Every Monday morning" depends on whose Monday. The adapter section names the timezone source; if unspecified, default to UTC and surface that choice in the dry-run.
- **Quiet-mode silence hiding outages.** "Skip empty weeks" can mask source-MCP failures. After two consecutive skipped weeks, produce a doc that says "No activity recorded — verify the source connection is healthy."
- **First-run backfill blast.** The first scheduled run on a long-existing project may pull thousands of issues. Cap the first run at the past week regardless of how far back the cursor goes, and surface the deferred backfill as a follow-up the operator can opt into.
