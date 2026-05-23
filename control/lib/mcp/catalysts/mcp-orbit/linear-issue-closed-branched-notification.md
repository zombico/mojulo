---
{
  "id": "linear-issue-closed-branched-notification",
  "name": "Linear issue closed → branched notification",
  "subject": "mcp-orbit",
  "trigger": "signal",
  "summary": "When a Linear issue is closed, classify it as customer-facing or internal, then either draft a customer email update or append to an internal changelog — so closures get the right follow-through without manual sorting.",
  "valueHook": "Stop sorting closed tickets into 'tell the customer' and 'just log it' by hand.",
  "requires": {
    "sources": [
      { "category": "issue_tracker", "examples": ["linear", "github_issues", "jira"] }
    ],
    "destinations": [
      { "category": "email", "examples": ["gmail", "outlook"] },
      { "category": "document_store", "examples": ["gdrive", "notion"] }
    ]
  },
  "chain": [
    { "step": "detect-close", "describe": "Poll source for issues transitioning to closed state" },
    { "step": "classify", "describe": "Decide customer-facing vs internal from labels / project / customer field" },
    { "step": "branch:customer-facing", "destination": "email", "action": "draft" },
    { "step": "branch:internal", "destination": "document_store", "action": "append" }
  ]
}
---

# Linear issue closed → branched notification

> Mojulo is the deliberation layer. The issue tracker is the source of signal (closures); two distinct destinations (email for customer-facing, document store for internal) get different content based on classification. The catalyst's value-add is the branch logic and per-branch templating — mojulo anchors why the branch criteria exist and what each side renders.

## When this fits

The operator's team closes Linear issues that fall into two categories: ones the customer cares about (bug they reported, feature they asked for) and ones that are internal (refactors, infra, internal tools). Today, closing the issue is the end of the workflow — communication and logging happen by hand or not at all.

**Reject this catalyst when:**

- No issue-tracker MCP, OR no email MCP, OR no document-store MCP is in declared inventory. **Branching catalysts need ALL required destinations present**; partial inventory means refuse with a clear "install X to unlock this" message rather than degrade silently to a single branch.
- The operator's team doesn't actually have a customer-facing / internal distinction (e.g., pure internal product). Redirect to a single-destination catalyst.
- The classification criteria are too fuzzy ("just kind of know"). Without a deterministic rule, the classifier becomes a per-event LLM call — expensive, hard to audit, and breaks on edge cases. Push back to make the rule explicit (label, project, customer field). If the operator genuinely can't articulate one, escalate to a higher-touch flow (manual triage of every close) instead of synthesizing brittle automation.

## Materialization

### Step 1 — Read mojulo's substantial anchors

1. `meta_context_brief({ scope: { kind: 'fleet' } })` — operator anchor, current inventory, contextmap subgraph.
2. **Check `inventory.ageSeconds`.** If `> 604800`, re-declare before continuing. Branching catalysts are especially sensitive to inventory drift since they require multiple MCPs simultaneously.
3. **Check prior materializations.** A prior `linear-issue-closed-branched-notification` artifact suggests this is a re-synthesis (likely after a classifier-drift incident or a destination change). Read the prior artifact's principle to recover what classification rule was used last time before proposing a new one.
4. **Read the operator KYC.** Likely-clamping constraints: a preferred email-sender identity ("customer comms always go from support@"), a preferred internal log location ("eng changelogs live at notion://eng/changelog"), a PII handling rule, an approval-before-send rule (which for this catalyst means the email branch should always draft rather than send).

### Step 2 — Probe the source MCP at synthesis time

Issue-tracker probing is the same as in [weekly-linear-digest-to-drive](./weekly-linear-digest-to-drive.md), with the close-event specifics:

- **Linear**: `list_issues` with `state.name = 'Done'` and `completedAt > cursor`. Webhook subscriptions for close events are available; polling is simpler for v0 — start there, escalate to webhooks if the cadence is too slow.
- **GitHub issues**: `list_issues` with `state=closed` and `since=<cursor>`. Webhooks via repository settings for push.
- **Jira**: `search_issues` with JQL `status = Done AND resolutiondate >= -X` plus cursor logic.

### Step 3 — Probe BOTH destination MCPs at synthesis time

Branching catalysts probe each destination independently because each branch uses different affordances.

**Email destination (customer-facing branch):**
- **Gmail**: `create_draft`. Probe the operator's identity (`from:` address) — for customer-facing comms it's almost always a shared alias (support@, hello@) not a personal address.
- **Outlook**: `create_draft_message`. Same identity consideration.

**Document store destination (internal branch):**
- **Google Drive**: `append_to_doc` against a stable "Eng changelog" doc; operator names which doc at negotiate time. Probe whether the doc exists; if not, offer to create.
- **Notion**: `append_to_page` or `create_database_row`. If the operator wants a database row per close (filterable, sortable), surface that as the preferred shape.

Probe both surfaces before negotiating knobs. If either fails to probe (missing scopes, doc doesn't exist), surface the gap explicitly — don't paper over it.

### Step 4 — Negotiate the knobs

Ask in **one round**:

1. **Classification rule.** What makes an issue customer-facing? Options to surface:
   - A specific label (`customer-facing`, `reported-by-customer`).
   - A specific project (issues in the "Customer Bugs" project).
   - Presence of a "Customer" custom field.
   - Combination.
   - **Refuse to proceed if the operator can't name a deterministic rule.** "I'll let the LLM decide" is not an acceptable answer here — it makes the catalyst un-auditable and unpredictable in production.
2. **Customer-facing template.**
   - Recipient resolution — `customer_email` custom field on the issue? Original reporter via a related submission? Operator-provided lookup function?
   - Subject and body template.
3. **Internal template.** Destination doc/page identifier, entry format (date + title + URL + closer? more detail?).
4. **Both branches always run?** Or skip the internal log when the customer email is drafted (assume the email covers it)?

### Step 5 — Resolve idempotency PER BRANCH

Branching catalysts have one source-side dedupe + per-branch destination-side dedupe.

**Source dedupe** (single rule for the whole catalyst): Linear issue id. Don't re-process a closed issue once you've already routed it. Strategies:
- Source-side label (`notified` applied after processing, matched via `-label:notified` on the next poll).
- State-side ledger (issue_id → outcome).

**Per-branch destination dedupe**:
- **Email branch**: drafts are inherently single-create — if source dedupe holds, you won't double-create. If you escalate to send-and-mark-complete, add a sent-flag on the source so a re-fire doesn't re-send.
- **Document store branch**: appending to a doc is **non-idempotent by default** — re-runs append again. Either search the doc body for the issue URL before appending, or rely on source-side label.

**Branching catalysts MUST resolve dedupe per branch.** Reject the synthesis if either branch lacks a strategy. The source-side dedupe alone is not enough — re-running the catalyst with cleared state would re-process every closed issue, and each branch needs to know how to avoid re-writing on the destination side.

### Step 6 — Dry-run shape (mandatory, dual-branch)

The dry-run for branching catalysts has to exercise both branches. Pick one recently-closed customer-facing issue AND one recently-closed internal issue (operator names them):

**Customer-facing case:**
1. Run classification on the issue — confirm it routes to the customer-facing branch.
2. Render the proposed email — show it.
3. Create the Gmail draft (unsent) — surface the draft URL.

**Internal case:**
1. Run classification — confirm it routes to the internal branch.
2. Render the proposed changelog entry — show it.
3. Append to the destination doc with a `[DRY-RUN]` prefix on the entry the operator can manually remove.

Surface both artifacts and ask: "Promote, or adjust the classification rule / templates?"

A dry-run that exercises only one branch can't validate the classifier. The whole point of a branching catalyst is the routing decision — test it.

### Step 7 — Hand to the host adapter

The adapter wraps the polling loop, the dedupe state, AND the per-branch destinations into a single artifact:

- **claude-code**: one `SKILL.md` containing both branches as conditional logic; `/schedule "every 15 minutes"` for polling.
- **codex**: one Codex automation with the branch logic in its handler.
- **generic**: one `workflow.md` + runner.

The adapter doesn't care about branching shape — it packages the resolved logic. The branching lives inside the artifact, not across multiple artifacts.

### Step 8 — Seal the materialization

```jsonc
meta_context_commit({
  type: 'artifact_materialization',
  adapter_id: '<bound adapter>',
  artifact: { locator: '<…>', label: 'Linear closed → branched notification' },
  // bot_ref omitted.
  catalyst_ref: 'linear-issue-closed-branched-notification',
  bindings: [
    { mcp_tool: 'linear.list_issues', fields_bound: ['state', 'completedAt', 'labels', 'project'] },
    { mcp_tool: 'gmail.create_draft', fields_bound: ['to', 'subject', 'body'] },
    { mcp_tool: 'gdrive.append_to_doc', fields_bound: ['doc_id', 'entry'] }
  ],
  principles: [
    {
      scope: 'artifact',
      body_md: 'Classification: label `customer-facing` → email; otherwise → Drive doc. Email drafts from support@. Internal entry: date + title + URL + closer. Both branches always run.\n\n**Context:** Operator confirmed at synthesis time. Classification rule was the friction point — operator initially asked for LLM-based classification; pushed back to a label-based rule for auditability.\n\n**Applies to:** This artifact only.'
    }
  ]
})
```

**For mcp-orbit catalysts, this commit IS the audit chain.** For branching catalysts especially, the principle should capture *which classification rule was chosen and why* — that's the most likely thing to need re-litigation six months later.

## Pitfalls

- **Classifier drift.** Label conventions evolve. A `customer-facing` label used consistently three months ago may have quietly fallen out of use. Re-validate the classifier on real recent data at re-synthesis time, not just at original synthesis.
- **Draft staleness.** Gmail drafts accumulate. Without a follow-up flow that asks "did you send that draft?", drafts can pile up unsent and the customer never hears back. Consider escalating un-sent drafts to a daily digest after N days.
- **Append-only doc growth.** The internal changelog doc grows forever. After a year it becomes hard to scan. Bake a rolling-period header convention (`## YYYY-Q#`) into the entry format from day one rather than restructuring later.
- **Asymmetric misclassification cost.** Mis-routing an internal issue to the customer branch is much worse than the reverse (you may email a customer about a refactor they don't care about). When the classifier is uncertain, default to internal and let the operator manually re-route — the asymmetry favors false-negatives on the customer side.
- **Partial inventory at run time.** If one destination MCP becomes unreachable mid-flight (Gmail token expired, Drive rate-limited), the catalyst should fail the affected branch loudly without silently completing the other branch. Half-run is worse than not-run because the source-dedupe label will still be applied.
