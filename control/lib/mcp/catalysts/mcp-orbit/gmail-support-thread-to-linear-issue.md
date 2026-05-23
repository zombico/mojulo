---
{
  "id": "gmail-support-thread-to-linear-issue",
  "name": "Gmail support thread → Linear issue",
  "subject": "mcp-orbit",
  "trigger": "signal",
  "summary": "When a Gmail thread matches a support filter, file a Linear issue with the conversation context attached, so support requests don't sit in someone's inbox waiting to be triaged manually.",
  "valueHook": "Stop losing customer support emails to whoever's inbox they happened to land in.",
  "requires": {
    "sources": [
      { "category": "email", "examples": ["gmail", "outlook", "fastmail"] }
    ],
    "destinations": [
      { "category": "issue_tracker", "examples": ["linear", "github_issues", "jira"] }
    ]
  }
}
---

# Gmail support thread → Linear issue

> Mojulo is the deliberation layer here, **not the data source**. The email provider is the source of incoming support signal; the issue tracker is the destination. Mojulo's role is to anchor the synthesis decision — what counts as "a support thread," what routing rules apply, what the operator's KYC says about destination team and reply behavior — so the synthesized skill is auditable and re-derivable.

## When this fits

The operator receives support requests via email that today get triaged by hand (forwarded to the right person, copy-pasted into the issue tracker, etc.). The pattern reads as **signal-driven routing**: each matching message → one tracked work item in the issue system.

**Reject this catalyst when:**

- No email MCP is in the declared inventory. Call `meta_context_brief({ scope: { kind: 'fleet' } })` first — `inventory.servers` is the truth.
- No issue-tracker MCP is in the declared inventory.
- The user wants conversational triage (back-and-forth with the sender) — that's bot-shaped, not signal-shaped; redirect to a bot catalyst.
- The user wants aggregation ("weekly digest of support volume") rather than per-message routing — redirect to `weekly-linear-digest-to-drive` or a similar scheduled-aggregation catalyst.

## Materialization

### Step 1 — Read mojulo's substantial anchors

1. `meta_context_brief({ scope: { kind: 'fleet' } })` — operator anchor, current inventory, and the contextmap subgraph in one call.
2. **Check `inventory.ageSeconds`.** If `> 604800` (one week), ask the user to re-declare via `meta_context_declare_inventory` before continuing. Stale inventory means we may probe an MCP that's no longer connected, or miss one that just was.
3. **Check prior materializations.** `meta_context_brief({ scope: { kind: 'catalyst', ref: 'gmail-support-thread-to-linear-issue' } })`. If an existing artifact files into the same destination project, that's a duplicate — confirm before re-materializing. If it files into a different project, ask whether this is a replacement or a parallel rule for a different inbox/label.
4. **Read the operator KYC.** Any constraint naming a preferred ticketing system (e.g., "support tickets go to HelpScout, not Linear") or forbidding LLM access to customer PII overrides catalyst defaults at synthesis time.

### Step 2 — Probe the email MCP at synthesis time

Don't assume Gmail. Read inventory.

Per common MCP, identify:

- **Gmail**: `search_messages` and `get_thread`. Query shape uses Gmail search operators (`label:`, `from:`, `subject:`, `is:unread`). Incremental fetch is history-token based (cheap) or polling (simple). Watch surface is Pub/Sub-backed push if the operator wired it; most agents poll.
- **Outlook**: `list_messages` with `$filter`. Subscription-based push is available via Microsoft Graph; polling works otherwise.
- **Fastmail / IMAP-shaped**: polling-only typically; `search` and `fetch` by message id.

In each case identify:
- The search/filter shape (don't process all email — only matched threads).
- Per-thread fetch contract (one call returns the whole thread, or paginate messages within it?).
- The "what's new" cursor: history token (Gmail) / delta link (Outlook) / last-processed message id (IMAP-style).

### Step 3 — Probe the issue-tracker MCP at synthesis time

Don't assume Linear.

Per common MCP:

- **Linear**: `create_issue`. Required: title, team. Recommended: project, label, priority. Probe `list_teams` and `list_labels` so you can surface options to the operator at negotiate-time rather than guess.
- **GitHub issues**: `create_issue` on a specific repo. Required: title. Recommended: labels, assignees, milestone.
- **Jira**: `create_issue` on a project. Required: project, issuetype, summary. Custom fields are per-workspace — must probe.

Identify the create-issue affordance, the routing surface (team/project/repo), and any tagging that maps to operator classification.

### Step 4 — Negotiate the knobs with the operator

Ask in **one round**:

1. **Match query** — what's the filter that defines "a support thread"? (e.g., `label:support`, `to:help@example.com`, `subject:"[Support]"`)
2. **Issue template** — title format (`"[Support] {gmail_subject}"`), body content (full thread / first message only / auto-summary).
3. **Routing rules** — fixed team/project, or rule-based (e.g., subject contains "billing" → billing team)?
4. **Reply behavior** — auto-reply to the sender confirming receipt? Forward the issue URL internally? Silent file?

These knobs turn this catalyst from synthesis pretext into a deployable rule. Don't synthesize without them.

### Step 5 — Resolve idempotency

Signal-driven catalysts have a different idempotency story than scheduled aggregation. The risk isn't double-write of an aggregate, it's filing the same source thread N times.

**Dedupe on source id.** Every Gmail thread has a stable id (`Thread-Id`). Pick one strategy:

- **Source-side label** (most reliable): after successful issue creation, apply a Gmail label like `linear-filed` to the thread. Subsequent polls exclude `-label:linear-filed`. Survives local state loss; survives the agent re-installing on a new machine.
- **State-side ledger**: maintain a local `thread_id → issue_url` ledger in the adapter's state location. Faster but vulnerable to state loss; not recommended unless source-side labeling is unavailable.
- **Destination-side search**: search Linear for an issue containing the thread id in its body before creating. Slow (one search per match) but stateless.

**Polling cursor**: maintain `last_processed_history_token` (Gmail) / `last_processed_timestamp` (IMAP) in adapter state. Only fetch messages newer than the cursor on each poll cycle.

A signal-driven catalyst with no dedupe story will file duplicate issues on every poll. **Reject the synthesis** if no strategy is chosen.

### Step 6 — Dry-run shape (mandatory)

The signal-driven dry-run shape: one real matching thread, with the issue created in a verifiable "draft" state in the destination — for issue trackers without a true draft, this means unassigned + with a `dry-run` label the operator removes manually to promote.

1. Pull the most recent thread matching the configured filter — show it to the user.
2. Render the proposed issue (title, body, team, labels) — show it.
3. Create the issue in Linear with a `dry-run` label and unassigned status (do NOT apply the dedupe label on the Gmail side yet).
4. Surface the issue URL: "Promote (remove dry-run label, assign, and apply Gmail dedupe label) or adjust?"

A dry-run that skips actual creation misses the real failure modes: permissions on team/project, validation on required custom fields, label availability. Always exercise the real destination write path.

### Step 7 — Hand to the host adapter for packaging

- **claude-code**: `.claude/skills/gmail-support-thread-to-linear-issue/SKILL.md` polled via `/schedule "every 5 minutes"` (or whatever cadence the operator's volume justifies).
- **codex**: a Codex automation with a polling rule, or a workspace workflow file.
- **generic**: `workflow.md` + runner script the operator runs out-of-band on a cron.

This catalyst's payload to the adapter: source query, destination resolver, issue template, dedupe strategy, polling cadence, reply behavior.

### Step 8 — Seal the materialization

```jsonc
meta_context_commit({
  type: 'artifact_materialization',
  adapter_id: '<bound adapter>',
  artifact: { locator: '<…>', label: 'Gmail support → Linear' },
  // bot_ref omitted — this artifact runs against MCP inventory, not a bot.
  catalyst_ref: 'gmail-support-thread-to-linear-issue',
  bindings: [
    { mcp_tool: 'gmail.search_messages', fields_bound: ['label', 'subject'] },
    { mcp_tool: 'gmail.modify_labels', fields_bound: ['linear-filed'] },
    { mcp_tool: 'linear.create_issue', fields_bound: ['title', 'team', 'labels', 'body'] }
  ],
  principles: [
    {
      scope: 'artifact',
      body_md: 'Filter: label:support -label:linear-filed. Routes to <team>. Dedupe via source-side label `linear-filed`. Auto-reply: yes, from support@.\n\n**Context:** Operator confirmed at synthesis time.\n\n**Applies to:** This artifact only.'
    }
  ]
})
```

**For mcp-orbit catalysts, this commit IS the audit chain.** Don't skip it. If the commit fails, roll the artifact back via the adapter's own affordance.

## Pitfalls

- **Email loops.** If auto-reply triggers another inbound that matches the filter, you've created a loop. Always exclude `from:<your-own-sender-address>` from the match filter, even if the operator forgets to.
- **Spam matching naive filters.** `to:support@` will match spam. Require at least one positive filter (label, sender domain, subject keyword) beyond the recipient address.
- **TOCTOU between poll and dedupe.** Two parallel poll runs (overlapping schedules / re-entry) may both see the same thread. Source-side label or destination-side search are TOCTOU-safe; state-side ledgers are not.
- **PII in customer support emails.** Filter or summarize before sending the body through the LLM if the operator KYC has a PII constraint.
- **Issue tracker team/project archival.** A team that existed at synthesis time may be archived by the next poll. Surface a clear failure rather than letting issues fall into a void.
- **First-poll backfill blast.** If the cursor is initialized to "everything," the first poll will file every historical thread matching the filter. Initialize the cursor to "now" on first run and surface the deferred backfill as a follow-up the operator opts into.
