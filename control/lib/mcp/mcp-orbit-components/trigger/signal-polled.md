---
{
  "ref": "signal-polled",
  "version": "0.1.0",
  "summary": "Poll the source MCP on a cadence for new events past a cursor. The right trigger when the source has no native push.",
  "deliveryModel": "pull-by-cadence",
  "requires": {
    "sourceCursor": true,
    "idempotency": true
  },
  "constraints": [
    {
      "rule": "requires_source_cursor",
      "message": "trigger: signal-polled requires the source-role mcp to declare capabilities.cursor: true (so the workflow can advance past processed events)."
    },
    {
      "rule": "requires_idempotency",
      "message": "trigger: signal-polled requires an idempotency component — overlapping or re-entrant poll runs WILL otherwise reprocess events."
    }
  ],
  "intentKeywords": ["when", "whenever", "as soon as", "trigger", "signal", "watch", "arrives", "incoming", "new", "matches", "on each"],
  "exposesKnobs": [
    { "name": "poll_interval", "prompt": "How often does the workflow poll? (e.g. '5m', '1h', 'every minute' — match to the operator's tolerance for delay vs. quota burn)", "default": "5m" },
    { "name": "first_run_cursor", "prompt": "On first run, initialize the cursor to 'now' (skip backfill, recommended) or 'beginning' (process all matching history — usually expensive)?", "default": "now" },
    { "name": "max_events_per_poll", "prompt": "Cap on events processed per poll cycle to prevent runaway costs (0 = uncapped)?", "default": 100 }
  ]
}
---

# trigger: signal-polled

The polling trigger. Fires on a fixed cadence; each fire reads the source MCP for events past a persisted cursor, hands them to the rest of the composition, then advances the cursor. The right trigger when the source MCP doesn't push events to you (which is most MCPs in practice).

## Cadence vocabulary

- `poll_interval` accepts the same shorthand the host adapter's scheduler accepts (`5m`, `1h`, `30s`). For Codex/Claude Code adapters, this maps to the adapter's recurrence primitive (cron / `/schedule` / etc.). The host adapter owns the actual scheduling; this component owns the polling discipline.

## Mapping intent (load-bearing)

- **Default poll interval is `5m`** — short enough to feel responsive, long enough to amortize quota across calls. Sub-minute polling burns quota with little perceived latency improvement and almost always indicates the operator should be on a push trigger instead.
- **The cursor is the contract.** Persist `last_processed_cursor_value` to adapter state at the END of every successful poll cycle, AFTER all per-event downstream writes complete. Advancing the cursor before the writes succeed is the most common source of "we filed the issue but lost the cursor and re-filed it" bugs.
- **Initialize the first-run cursor to "now"**, never "beginning." A workflow that fires every 5 minutes and the operator's source has 5 years of matching history WILL try to process all 5 years on first run otherwise. The deferred backfill ("do you want to process the prior N days?") is an explicit opt-in, never the default.

## Safety posture (non-negotiable)

A `signal-polled` composition needs BOTH:

1. **A source-role mcp with `capabilities.cursor: true`** — otherwise "past the cursor" has no semantics. The composer MUST reject a signal-polled trigger paired with a cursor-less source. The constraint above is server-checkable; the recommender flags `signal_polled_without_source_cursor` as a warning.

2. **An idempotency component** — overlapping polls (the prior poll hasn't finished when the next fires) will reprocess the same events otherwise. Pair with:
   - `idempotency/source-side-label` (recommended) — apply a source-side marker after successful destination write; subsequent queries exclude marked events. TOCTOU-safe across re-entry.
   - `idempotency/state-ledger` — keep a local `source_event_id → destination_artifact_id` map. Faster but vulnerable to state loss.
   - `idempotency/destination-search` — search the destination for the source event id before writing. Slow (one search per event) but stateless and TOCTOU-safe.

   The constraint above (`requires_idempotency`) is server-checkable. The composer MUST NOT proceed with no idempotency component AND no explicit `accept_double_write: true` override.

## Pitfalls

- **Re-entrant polling.** A poll that takes longer than the poll interval will overlap with the next poll. Either the cursor advance is atomic (transactional) AND the idempotency is TOCTOU-safe, or you'll re-process events. Default mitigation: log the workflow start; subsequent polls that see "previous poll still running" should skip themselves rather than queueing up.
- **Cursor horizon.** Many source MCPs expire their cursor surface after N days (Gmail history: ~7 days; some MCPs: ~24h). If the workflow is paused longer than the horizon, the cursor becomes invalid and the next poll fails. Catch the failure, fall back to a time-window query, re-baseline the cursor, and surface the gap to the operator ("possible gap in processed events between cursor expiry and re-baseline — recommend manual catch-up").
- **Empty-poll burn.** A poll cycle with zero matches still spends a small quota on the discovery call. Source MCPs with very low matching rates (one event per week, polled every 5 minutes) waste ~2000 polls per match. Suggest a longer `poll_interval` or a push trigger when the operator confirms the source can support one.
- **Quota cliffs.** Polling intervals shorter than ~60s + first-run backfills enabled = burning the daily quota in the first hour. The `max_events_per_poll` knob is the safety valve; the dry-run summary should surface "at your match rate, this would consume ~N quota units per day."
- **Schedule drift across timezones.** The host adapter's scheduler may pause during sleep/suspend on developer machines (less of a concern on hosted automation). For local-machine schedules, surface a "we've been paused for N hours" warning at next wake to the operator.
- **First-poll vs. composition install timing.** The first poll fires on the first scheduled boundary AFTER install, not immediately. An install at 14:57 with poll_interval `5m` first fires at 15:00 (the next boundary). Surface this in the dry-run so operators don't think the workflow is broken.
