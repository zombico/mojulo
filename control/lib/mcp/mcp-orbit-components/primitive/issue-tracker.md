---
{
  "ref": "issue-tracker",
  "version": "0.1.0",
  "summary": "Primitive: a project-scoped tracker of work items with status / assignee / labels, queryable by structured filter, supporting comments and status transitions. Backed by Linear, GitHub Issues, Jira, Asana, Shortcut.",
  "affordances": {
    "source": [
      { "name": "find-by-filter", "support": "expected", "summary": "Query issues within a scope (project, team, workspace) by structured filter — status, assignee, label, updated-since, created-since." },
      { "name": "read-content", "support": "expected", "summary": "Open a specific issue and return its body, comments, and current state." },
      { "name": "list-recent", "support": "expected", "summary": "List issues in scope ordered by recent activity, typically with an updated-since cursor." },
      { "name": "get-metadata", "support": "likely", "summary": "Return non-body metadata (status, assignee, labels, urls, timestamps) for a specific issue without pulling comments." },
      { "name": "subscribe-to-changes", "support": "likely", "summary": "Push notification (webhook) on issue create / update / comment. More common on issue trackers than on document stores, but MCP exposure is uneven." }
    ],
    "destination": [
      { "name": "create-issue", "support": "expected", "summary": "Create a new issue in scope with title, body, and optional labels / assignee / status." },
      { "name": "find-by-filter", "support": "expected", "summary": "Used for search-before-create dedupe via structured filter. Same affordance contract as the source-role variant." },
      { "name": "comment-on-issue", "support": "expected", "summary": "Add a comment to an existing issue by id. Comments are addressable, separate entities — not a body append." },
      { "name": "transition-status", "support": "expected", "summary": "Change an issue's status (close, move to in-progress, etc). Workflow shape varies per tracker — discover allowed transitions from the bound tool's schema." },
      { "name": "update-issue-fields", "support": "likely", "summary": "Change non-status fields on an existing issue: labels, assignee, priority, due date. Some trackers fold this into transition-status; others expose it separately." }
    ]
  },
  "pitfalls": [
    "Closed-isn't-deleted. Closed issues remain queryable. Dedupe checks on find-by-filter must either include a status filter ('only open') or check status on each hit, otherwise the workflow re-finds long-closed duplicates of new issues.",
    "Status workflow asymmetry. 'Closed' is not a single state — most trackers have multiple terminal states (done, won't-fix, duplicate, closed-as-completed). When transitioning an issue, confirm the target status exists in the bound tracker's workflow; don't assume 'closed' is universal.",
    "First-run backfill blast. Scheduled compositions that 'route open issues to digest' will, on first run, route every open issue ever filed in the source scope. Cap the first run's window via the trigger's first_run_window knob, OR scope the source filter to a recent updated-since cursor.",
    "Read-after-write same-tracker loops. A composition with this primitive in BOTH roles AND the same backing MCP (e.g. enrich Linear issues by writing back to Linear) must use a source-side label (often 'mojulo-touched') to exclude prior writes from the next source read. Otherwise the workflow infinitely re-processes its own output.",
    "Issue identifier vs URL stability. Issues are identified by stable id (numeric or kebab); the URL is derived and stable per-environment. Bind dedupe and audit trail to the id, not the URL — operators migrating workspaces invalidate URLs but not ids.",
    "Permission scope at the project/team level. Most MCP-bound issue tracker tokens are scoped to a subset of the operator's projects/teams. A destination scope the operator names verbally may not be in the token's reach — probe the destination scope via find-by-filter (limit 1) during dry-run before attempting create-issue.",
    "Comment threading model varies. Some trackers (GitHub) treat all comments as a flat list; others (Jira) support nested threads. Compositions that 'reply' to a comment must check the bound comment-on-issue tool's schema for a thread/parent field — its absence means flat-only.",
    "Webhook-vs-poll tradeoff. When subscribe-to-changes is bound, push delivery is preferable for latency, but webhook configuration usually lives outside the MCP (in the tracker's UI). The composition's dry-run should confirm webhook registration is in place, not just that the tool exists."
  ],
  "rolePairings": {
    "source": {
      "cursorAffordance": "list-recent",
      "cursorFieldHint": "updated-time / updatedAt (discover from the bound tool's schema)",
      "preferredTriggers": ["scheduled", "signal-polled", "signal-push"]
    },
    "destination": {
      "dedupeAffordance": "find-by-filter",
      "draftPosture": "Issue trackers do not have a 'draft' status by convention. Treat dry-run writes as: (a) create the issue with a 'mojulo-dryrun' label that the operator can filter on and bulk-delete, OR (b) write to a designated dry-run project/team if the operator has one provisioned. Some trackers (Linear) support draft issues natively — use the bound create-issue tool's schema to detect."
    }
  }
}
---

# primitive: issue-tracker

An `issue-tracker` is a project-scoped store of work items. The defining shape is **structured queryability**: items live in a project / team / workspace scope, are identified by stable ids, carry typed fields (status, assignee, labels, priority), and are queried by structured filter rather than by full-text title match.

This is the curated, vendor-agnostic shape. The integration specifics — which tool name satisfies which affordance, what the cursor field is actually called, what status values are allowed in transitions — come from the runtime-introspected provider artifact built from the operator's installed MCP. This body teaches the shape; the generator fills the specifics.

## When this primitive fits

- The workflow's source role aggregates issue activity for digests, audit trails, or signal extraction across a project's history.
- The workflow's destination role files new issues from external signals (form submissions, monitoring alerts, parsed inbound), comments on existing issues, or transitions status on issues that match some condition.
- Idempotency anchors on issue id (for comments + transitions) or on a structured filter signature (for create-with-dedupe).

## When it doesn't fit

- The workflow needs unstructured document storage with folder hierarchies (`document-store` — Drive, Notion docs).
- The workflow needs directed mail semantics with reply identity, where audience is named recipients (`message-thread` — Gmail).
- The workflow needs scope-addressable chat with thread sub-grouping, where audience is scope members (`messaging-channel` — Slack, Discord, Teams).
- The workflow needs typed records with arbitrary fields beyond the status/assignee/label vocabulary (`structured-record-store` — Airtable, HubSpot, Notion DBs).

## Affordance map summary

Source role uses `list-recent` + `get-metadata` as the catch-up scan pattern, `find-by-filter` for targeted queries (open issues by label, issues assigned to X, issues updated since cursor), and `read-content` for issues that need full body + comments (e.g. for summarization). `subscribe-to-changes` is more commonly exposed than on document stores, but MCP coverage is uneven.

Destination role uses `create-issue` for filing, `find-by-filter` for search-before-create dedupe, `comment-on-issue` for follow-ups on existing issues, `transition-status` for closing or progressing issues, and `update-issue-fields` for label/assignee changes when separated from status. The dedupe affordance is load-bearing in a different way than document-store's: issue-tracker dedupe uses structured-field filters (project + title + open-status), not title-in-folder fuzzy match.

## Affordance vocabulary — note on cross-primitive overlap

Several affordance names rhyme with `document-store` because the underlying shape is genuinely similar:

- `list-recent`, `read-content`, `get-metadata`, `subscribe-to-changes` — same meaning in both primitives.

Others are deliberately primitive-shaped:

- **`find-by-filter` (issue-tracker)** vs **`find-by-key-in-scope` (document-store)** — issue queries are structured-field filters (status + assignee + label), not title-in-folder fuzzy matches. The shape of the query input is fundamentally different; the affordance name reflects that.
- **`create-issue`** vs `create-with-mime` — issue creation takes title + body + labels + status, no mime type. Different shape.
- **`comment-on-issue`** vs `append-to-existing` — comments are addressable separate entities with their own ids and reply semantics. Not a body append.
- **`transition-status`**, **`update-issue-fields`** — no document-store analog. Issues have a status workflow; documents don't.

The lesson encoded here: affordance vocabulary is per-primitive. Names rhyme across primitives only when the shape genuinely transfers; otherwise the names diverge to make the difference visible in compositions and audit trails.

## Cross-vendor pitfalls — what is true regardless of which MCP backs this primitive

These pitfalls hold for any issue tracker you might bind to this primitive. Vendor-specific quirks (Linear's GraphQL filter shape; GitHub's comment-as-issue-event model; Jira's transition workflow customization) belong in optional `adapter/<server>.md` override files, not here.

1. **Closed-isn't-deleted.** Dedupe via `find-by-filter` must scope by status or check status per hit; closed duplicates of new issues are otherwise re-found.
2. **Status workflow asymmetry.** Confirm target status exists in the bound tracker before issuing `transition-status`.
3. **First-run backfill blast.** Cap the first run's window or scope to a recent cursor.
4. **Read-after-write same-tracker loops.** Use a source-side label to exclude prior writes when source and destination bind to the same tracker.
5. **Issue id vs URL.** Bind dedupe and audit trail to the stable id, not the URL.
6. **Permission scope at project/team level.** Probe the destination scope via `find-by-filter (limit 1)` in dry-run before attempting `create-issue`.
7. **Comment threading model.** Detect flat vs threaded via the bound comment tool's schema.
8. **Webhook-vs-poll tradeoff.** Webhook registration usually lives outside the MCP; confirm registration in dry-run, not just tool presence.
