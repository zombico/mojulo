---
{
  "ref": "aggregation",
  "version": "0.1.0",
  "summary": "Cognitive shape: many small events over a window → one summary artifact at the window boundary.",
  "fits": {
    "triggers": ["scheduled"],
    "sourceMcpAffordances": ["read"],
    "destinationMcpAffordances": ["write"]
  },
  "requires": {
    "minMcpRoles": { "source": 1, "destination": 1 },
    "needsIdempotency": true
  },
  "intentKeywords": ["digest", "summary", "report", "aggregate", "weekly", "daily", "monthly", "rollup", "consolidate", "summarize", "overview"],
  "exposesKnobs": [
    { "name": "window", "prompt": "How is the aggregation window defined? (past N days from run | calendar week Mon-Sun | sprint-aligned)", "default": "calendar-week" },
    { "name": "grouping", "prompt": "How should events be grouped in the output? (by team | by status | by assignee | flat)", "default": "by status" },
    { "name": "depth", "prompt": "How much per-event detail? (title+url | title+url+one-line | title+url+summary+key-comments)", "default": "title+url+one-line" },
    { "name": "quiet_mode", "prompt": "When the window is empty, skip the artifact entirely or produce a 'no activity' placeholder?", "default": "skip" }
  ]
}
---

# pattern: aggregation

The cognitive shape of "many small events through a period → one summary artifact at the period boundary." Weekly digests, daily reports, monthly retrospectives — they all sit here. This pattern is the **most common** mcp-orbit composition; default to it when the operator says "summarize," "digest," "report," or "weekly read-out."

## When this fits

- Source emits many discrete events with a `updated_at` / `created_at` / `completed_at` field.
- The operator wants to read summary at the boundary, not stream the events.
- The destination supports one artifact per period (a doc, a database row, a chat message).

## When this doesn't fit (redirect)

- **Operator wants signal-driven response.** "When X happens, do Y immediately" — that's `pattern: routing`, not aggregation.
- **Operator wants every event sent through.** "Stream all closed issues to channel C" — that's `pattern: forwarding`, not aggregation.
- **Output is per-record, not per-period.** "One CRM contact per qualified submission" — that's `pattern: enrichment`, not aggregation.

## Mapping intent (load-bearing)

The four knobs (`window`, `grouping`, `depth`, `quiet_mode`) are not optional polish — they're what turn this pattern from a synthesis pretext into a usable digest. **Never compose this pattern without resolving all four with the operator in one round.**

- **`window`.** Past-N-days-from-run is the simplest and works for most. Calendar-week (Mon-Sun in operator's timezone) maps better to operators with a Monday standup ritual. Sprint-aligned is right for engineering teams on a sprint cadence, but requires the operator to declare sprint boundaries — push back if they can't.
- **`grouping`.** "By status" maps to lifecycle questions ("what shipped, what's in flight"). "By team" maps to cross-team digests. "By assignee" is rarely the right default — it surfaces individual workload, which most operators want to read but not write up. "Flat" is for tiny windows (<10 items).
- **`depth`.** `title+url+one-line` is the right default — `title+url` alone is too thin to act on, `title+url+summary+key-comments` is a wall of text. Calibrate after a few real runs.
- **`quiet_mode`.** `skip` is the right default for high-activity sources (an empty week is a real signal). `placeholder` is right for low-activity sources where silence would worry the operator. **Pair `skip` with an "are we still alive" heartbeat doc every N empty periods** — see `trigger/scheduled` pitfalls.

## Render contract

This pattern produces markdown by default. The render component (when chosen) takes:

- `events: Array<{ identifier, title, url, state, group_key, updated_at, summary? }>` after grouping
- `window: { from: ISO, to: ISO, label: 'Past 7 days' | 'Week of 2026-05-19' }`
- `quiet: boolean` — when true, the body is the no-activity placeholder, not the events list
- `trace: { composition_ref, run_at, source_query }` — mojulo trace, baked into every output

Render layers MUST include the trace block. An aggregation artifact with no provenance is unauditable downstream.

## Pitfalls

- **PII through the LLM.** If `depth >= title+url+summary+key-comments`, the summary step reads body text through the LLM. Honor any `no PII in summaries` constraint in the operator KYC — drop to `title+url+one-line` instead, or redact before summarizing.
- **First-run window over-scope.** Operators want "this week's digest" but on the first run, "this week" hasn't started yet. The first run should cover the *prior* period and surface that choice ("first digest covers last week — next run on schedule covers this week").
- **Window edges off-by-one.** Inclusive-vs-exclusive bounds matter: an event at exactly 09:00:00 on Monday belongs to *this* week if the window is `[Mon 09:00, next Mon 09:00)`. Document the convention in the artifact body so operators reading older digests aren't confused by an event "missing" from one and "appearing" in the next.
- **Grouping with empty groups.** When `grouping: by team` and one team had no activity, omit the empty group from the output — don't render `## Platform team\n(no activity)`. Empty headers train operators to skim past content.
- **Trend deltas come later.** Operators sometimes want "this week vs last week." That's a separate `pattern: aggregation` variant (`includeTrendDelta: true`) — don't ship it in the v0 default.
