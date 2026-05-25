---
{
  "ref": "linear",
  "version": "0.1.0",
  "summary": "Linear issue-tracker MCP: read (cursor on updated_at, cost-based rate limit, GraphQL query) and write (create / update / comment on issues) affordances. Bidirectional with team/project scoping.",
  "requires": {
    "mcpInventoryCategory": "structured_record_store",
    "inventoryServerHints": ["linear"]
  },
  "affordances": {
    "read": true,
    "write": true,
    "watch": false
  },
  "capabilities": {
    "cursor": true,
    "cursorField": "updated_at",
    "pagination": "cursor",
    "rateLimit": "cost-based",
    "rateLimitDetails": "Quota-units per query, cost proportional to result set size + field depth. Large date-window queries (30+ days) on big teams cost 100s of units. Daily quota depends on plan; most teams have 1000s available. 429 includes Retry-After.",
    "supportsSearchOperators": false,
    "supportsSinceQuery": true,
    "queryLanguage": "GraphQL",
    "writeShapes": ["create_issue", "update_issue", "comment_on_issue"],
    "readShapes": ["list_issues", "get_issue", "list_comments"],
    "contentModel": "markdown (description + comments)",
    "requestLimits": {
      "descriptionChars": 4000,
      "issuesPerQuery": 250,
      "queryComplexity": "cost-based"
    },
    "supportsDelete": false,
    "supportsDrafts": false
  },
  "intentKeywords": ["linear", "issue", "ticket", "engineering", "bug", "feature", "sprint", "project", "backlog"],
  "exposesKnobs": [
    { "name": "team_filter", "prompt": "Restrict to a specific Linear team id (e.g. 'ENG', 'DESIGN'), or pull across the workspace ('*')? Team id filters the source; each team has its own namespace.", "default": "*" },
    { "name": "state_filter", "prompt": "Limit to issues in particular states (e.g. 'completed', 'cancelled', 'in-progress', 'todo'), or include all? Comma-separated list or empty for all.", "default": "all" },
    { "name": "write_project", "prompt": "When this MCP plays the destination role, which Linear team receives the writes? Required. Format: team_id or 'team_name'.", "default": null }
  ]
}
---

# mcp: Linear

Linear is an issue tracker and project management system. Its MCP surface is **bidirectional and team-scoped** — usable as a composition source (read issue activity as a cursor-paginated stream) and as a composition destination (create / update / comment on issues). Linear exposes a GraphQL API; the MCP abstracts query complexity. One MCP, two roles; this component teaches both. Note: Linear has no public webhook API, so watch is not supported.

## Source-role surface (when `role: 'source'` in the composition)

- **Discovery calls.**
  - `list_issues` — cursor-paginated GraphQL query returning issues matching filters. Returns (at minimum) `id`, `identifier` (e.g. `ENG-123`), `title`, `url`, `state` (with `type`, e.g. `backlog` / `unstarted` / `started` / `completed` / `cancelled`), `team`, `assignee`, `updated_at`, `created_at`, `completed_at`, `description`. Without `updated_at`, the notion of "the past week" is undefined — reject the composition if `updated_at` is not in the response schema.
  - `get_issue` — fetch a single issue by id or identifier. Detailed schema including comments, linked issues, attachment refs.
  - `list_comments` — fetch comments on an issue thread (cursor-paginated).
- **Window query.** Date filter on `updated_at >= <ISO>` (most installs call it `sinceUpdatedAt` or `since`). Supports cursor-based pagination — first page returns 50-250 depending on query depth; use `endCursor` for next page. Linear does **not** support offset-based pagination (the cursor is opaque).
- **Pagination.** Cursor-based (`after: <cursor>` / `endCursor` in the response). First page defaults to 50 items; request 250 when the operator's KYC tolerates higher quota cost. `hasNextPage` indicates more results; stop when it's `false`.
- **Rate limit.** **Cost-based, not request-based.** Each query costs quota units proportional to the result set size + field depth. A lean `list_issues(first: 50, since: -7d)` with 10 fields costs ~50 units. A fat `list_issues(first: 250, since: -30d)` with 30 fields costs 500+ units. Large first-run sweeps (30+ days on a big team) WILL burn the operator's daily budget — clamp first runs to 7 days regardless of intent, and surface the deferred backfill ("do you also want to process the prior 30 days?") as an opt-in follow-up.
- **Watch surface.** **None.** Linear has no public webhook or change-feed API. Poll-only. The composer should always pair this source with `trigger/signal-polled`.

### Mapping intent for source role (load-bearing)

- **`identifier` (e.g. `ENG-123`) is the natural primary key for digests, not `id` (UUID).** Operators read and reference identifiers in Slack, PRs, and retrospectives. UUIDs are opaque to humans — use `identifier` as the source event's stable ref for idempotency and render surfaces.
- **`state.type` is the right grouping axis for lifecycle digests.** The five state types (`backlog`, `unstarted`, `started`, `completed`, `cancelled`) map to the question "what shipped, what's in flight, what got deprioritized." Group by state type by default; secondary sort is `team` (for cross-team digests) or creation order (for single-team).
- **Treat `cancelled` state as signal, not noise.** Operators almost always want to see what was scoped out of the week — it's a business decision, not a typo. Include cancelled issues in digests; render them distinctly (e.g., struck-through or in a separate section).
- **`updated_at` lies during bulk operations.** A workspace-wide label rename or state migration touches every matching issue's `updated_at` even though the issue itself didn't change. Render layers should filter out `updated_at` events that don't correspond to a meaningful state or title change. (Check if `status_before` → `status_after` actually changed, not just that the timestamp did.)
- **Team is the namespace boundary.** Issues in team A have identifiers (e.g., `ENG-123`) that are unique within the team only. A workspace digest combining multiple teams can have id collisions — always include team context when rendering to avoid ambiguity (e.g., render as `ENG-123 (eng team)` or `DESIGN-123 (design team)`).
- **Cursor retention is operator-dependent.** Linear's cursor for `list_issues` is valid indefinitely, but for real-time digests, persist the `updated_at` timestamp as the cursor, not the opaque cursor string. On next poll, query `updated_at >= <timestamp>` to sweep forward; if a long gap exists (days or weeks), you may need to re-baseline due to API changes or backfill constraints.

## Destination-role surface (when `role: 'destination'` in the composition)

- **Discovery calls.**
  - `create_issue` — required: `team_id` (resolved by the `write_project` knob), `title`. Optional: `description` (markdown), `assignee_id`, `priority` (0-4; 1=urgent), `state_id`, `labels` (array of label ids). The team must exist and the caller must have write access.
  - `update_issue` — issue `id` + delta (title, description, assignee, state, priority, labels). Idempotent — updating an issue with no changes is a no-op.
  - `comment_on_issue` — issue id + body (markdown). Creates a new comment thread on the issue.
  - `archive_issue` — soft-delete (moves to archive). Not all MCPs expose this.
- **Required fields.** Every create needs `team_id` (from `write_project` knob) and `title`. Description is markdown and is rendered cleanly by Linear. Priority is optional (defaults to 0 = no priority). State can be set on create, or left to Linear's default (usually `backlog`).
- **Dedupe surface.** Linear has no native idempotency key on create — duplicate `create_issue` calls produce duplicate issues. Pair this destination with `idempotency/destination-search` (search-before-create on title prefix + team) or `idempotency/state-ledger` (cursor on source signal ids) whenever the composition fires more than once. For state-ledger, persist the source event's stable id (not Linear's id) as the anchor.
- **Draft posture.** Linear has no "draft" affordance — created issues are immediately visible to the team. For dry-runs, write to a dedicated team (e.g., `mojulo-staging`) or to a `mojulo-dryrun` label that the operator has nominated, and confirm cleanup is acceptable before promoting to the real team.

### Mapping intent for destination role (load-bearing)

- **Use the source-event's stable id as a label or description annotation, not the title.** Write a `source_ref` label (e.g., `source:gmail-thread-123`) on every created issue so dedupe-on-replay can find the prior write without parsing the title. If labels aren't available, include the source ref in the description as a metadata line (e.g., `_mojulo source: gmail-thread-123_`).
- **Include the mojulo trace in the description.** Composition ref, source query, run timestamp. Without it, an operator looking at a Linear issue six months later can't tell which composition produced it, and rerun decisions become guesswork. Format: `_Created by mojulo composition: <ref> | source query: <window> | timestamp: <ISO>_`.
- **Don't paste raw source bodies into Linear titles — they get long fast and break the UI.** Use the source's identifier + short summary in the title (max 80 chars); full context goes in the description. Example: `Gmail: support ticket from acme@customer.com re: invoice` (title) vs. the full email body (description).
- **Priority and state should be set intentionally, not defaulted.** Don't auto-create issues in `completed` state or with priority 4 (urgent) unless that's the explicit composition intent. Most digests create backlog items at default priority — surface this as a KYC decision, not a silent assumption.
- **Description markdown round-trips cleanly.** Lists, bold, italics, code blocks, and links all survive. Tables and embeds may require post-processing. Link to source artifacts (the Google Doc, the Gmail thread, the Notion page) so operators can trace back without re-reading the composition.

## Watch-role usage

Linear has no public webhook API as of 2026. `affordances.watch: false` is intentional. Compositions that need near-real-time response to Linear changes will need to poll. The composer should default to `trigger/signal-polled` at an operator-chosen cadence (e.g., every 30 minutes for high-velocity teams, every 4 hours for backlog reviews). Cost-based rate limits make high-frequency polling expensive — advise the operator to balance freshness against quota burn.

## Pitfalls (apply across both roles)

- **First-run backfill blast hits quota hard.** A first poll with `since: -30d` on a large team (1000+ issues) can cost 1000+ quota units in a single query. Clamp first runs to 7 days; offer "do you want the prior 30 days?" as a follow-up step. For teams that ran high-velocity (100+ issues/week), even 7 days may be expensive — start with 3 days and let the operator extend.
- **Cost-based limits require monitoring.** Unlike request-rate limits, cost-based limits are opaque until you hit them. Budget monitoring tools vary by Linear tier. Advise operators to check their quota usage weekly; a composition that was cheap during low-season can become expensive when the team ramps up.
- **PII in titles and descriptions.** Support-driven teams paste customer names, emails, or account numbers into issue titles and descriptions. If the destination is operator-facing this is fine; if it leaves the operator's tenancy (a digest forwarded to Slack, a report to stakeholders), KYC's `no PII in summaries` constraint applies — render layers must redact or hash.
- **Updated-at lies during bulk edits.** Workspace-wide label renames or state migrations touch every issue's `updated_at` even though nothing meaningful changed. Render layers should filter out `updated_at` events that don't correspond to an actual state or title change. Check `state_before` vs `state_after`; if they're identical, skip.
- **Write-after-read same-MCP loops.** A composition with `mcp/linear` in BOTH roles (read closed issues → enrich → write back to Linear) MUST use an idempotency component that filters the destination writes out of subsequent reads. Otherwise, the destination's write triggers a fresh source event on next poll (the issue was just updated), and the loop runs forever. The `idempotency/state-ledger` component is the right pairing — persist the source signal id, not the Linear issue id, to break the cycle.
- **Identifier collisions in multi-team reads.** Workspace digests combining multiple teams can surface `ENG-123` and `DESIGN-123` (different issues, same number). Always include team context when rendering — render as `[ENG] ENG-123` or split by team in the digest structure. Raw identifier alone is ambiguous.
- **Linked issues and blocked-by relationships don't auto-cascade.** Creating an issue with a link to another doesn't update the linked issue's `blocked_by` or `related` counts until Linear's backend processes the link. If the composition immediately reads the linked issue, it won't see the new relationship. Don't rely on link creation for real-time downstream logic.
- **Self-hosted Linear (rare enterprise).** A few customers self-host Linear or proxy via custom API wrapper. Tool names, field availability, and pagination behavior can diverge. Discover at bind time; don't hard-code query shapes or tool names.
- **Label id stability during team migrations.** If the operator renames or reorganizes teams, label ids may be rotated or deleted. A composition that hard-coded label ids for filtering will silently start returning zero results. Use label names (which are stable) where possible; if you must use ids, rediscover them at composition re-run time.

<!-- sources
  - https://developers.linear.app/docs/graphql/working-with-the-graphql-api (GraphQL query language, cost model)
  - https://developers.linear.app/docs/graphql/working-with-pagination (cursor pagination, hasNextPage)
  - https://developers.linear.app/docs/graphql/issues/queries (list_issues, since filters, state types)
  - https://developers.linear.app/docs/graphql/issues/mutations (create, update, comment, archive)
  - https://developers.linear.app/docs/api-reference/issues#update-issue (batch update, linked issues)
  - https://linear.app/docs/manage-team-settings (team scoping, label management)
-->
