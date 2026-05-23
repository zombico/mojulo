---
{
  "ref": "linear",
  "version": "0.1.0",
  "summary": "Linear issue-tracker source: cursor on updated_at, cost-based rate limiting, pagination via cursor.",
  "requires": {
    "mcpInventoryCategory": "issue_tracker",
    "inventoryServerHints": ["linear"]
  },
  "capabilities": {
    "cursor": true,
    "cursorField": "updated_at",
    "pagination": "cursor",
    "rateLimit": "cost-based",
    "supportsSinceQuery": true
  },
  "exposesKnobs": [
    { "name": "team_filter", "prompt": "Restrict to a specific Linear team, or pull across the workspace?", "default": "workspace" },
    { "name": "state_filter", "prompt": "Limit to issues in particular states (e.g. completed, cancelled, in-progress), or include all?", "default": "all" }
  ]
}
---

# source: Linear

Linear's MCP surface treats issue activity as a cursor-paginated stream keyed on `updated_at`. Read it through `list_issues` (or whichever tool name the operator's installed Linear MCP exposes — discover by name, not assumption) with a date filter.

## Surface shape

- **Discovery call.** `list_issues` returning items with at minimum `id`, `identifier` (e.g. `ENG-123`), `title`, `url`, `state`, `team`, `assignee`, `updated_at`, `created_at`, `completed_at`. Without `updated_at`, "the past week" is undefined — reject the composition before binding.
- **Window query.** Date filter on `updated_at >= <ISO>`. Most installs also accept a `since` cursor; both shapes work for the same intent.
- **Pagination.** Cursor-based (`after: <cursor>` / `endCursor` in the response). First page returns 50 by default — bump to 250 when the operator's KYC tolerates it.
- **Rate limit.** **Cost-based**, not request-based. Each query costs credits proportional to the requested item count + field depth. Large `updated_at >= -30d` first-run sweeps WILL burn the operator's budget — clamp first runs to 7 days regardless of intent (the deferred backfill is a follow-up).

## Mapping intent (load-bearing)

- The natural primary key for digesting is `identifier` (e.g. `ENG-123`), not `id`. Operators read identifiers, not UUIDs.
- `state.type` (`backlog` / `unstarted` / `started` / `completed` / `cancelled`) is the right grouping axis for digests by default — it maps to the lifecycle question "what shipped, what's in flight, what got cancelled."
- `team` is the right secondary grouping for cross-team digests; flat order is fine for single-team.
- Treat issues in `cancelled` state as signal, not noise — operators almost always want to see what was scoped out of the week.

## Pitfalls

- **PII in titles.** Support-driven Linear teams paste customer names / emails into issue titles. If the destination is operator-facing this is fine; if it leaves the operator's tenancy (a digest forwarded to Slack, an export to a public doc), the KYC `no PII in summaries` constraint applies.
- **Updated-at lies during bulk edits.** A workspace-wide label rename touches every issue's `updated_at` even though nothing meaningful changed. Render layers should filter out `updated_at` events that don't correspond to a state or title change.
- **First-run backfill blast.** See rate-limit clamp above.
- **Self-hosted Linear (rare).** A few enterprise installs proxy via custom MCP — surface name and field discovery still need to be done at composition time. Don't hard-code tool names.
