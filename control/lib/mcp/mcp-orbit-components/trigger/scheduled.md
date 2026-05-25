---
{
  "ref": "scheduled",
  "version": "0.1.0",
  "summary": "Recurring time-based trigger (cron-shaped cadence). Requires an idempotency component or explicit accept-double-write.",
  "deliveryModel": "pull-by-schedule",
  "requires": {
    "idempotency": true
  },
  "constraints": [
    {
      "rule": "requires_idempotency",
      "message": "trigger: scheduled requires an idempotency component OR a knobs.accept_double_write: true override."
    }
  ],
  "intentKeywords": ["weekly", "daily", "monthly", "every", "schedule", "cadence", "recurring", "morning", "digest", "summary", "report", "periodic"],
  "exposesKnobs": [
    { "name": "cadence", "prompt": "How often does this run? (daily, weekly, monthly, custom cron)", "default": "weekly" },
    { "name": "day_of_week", "prompt": "When cadence=weekly, which day fires it? (Mon | Tue | ... | Sun)", "default": "Mon" },
    { "name": "time_of_day", "prompt": "What local time should it fire? (24h, e.g. 09:00)", "default": "09:00" },
    { "name": "timezone", "prompt": "Which timezone anchors the schedule? (IANA name, e.g. America/New_York). Default UTC.", "default": "UTC" }
  ]
}
---

# trigger: scheduled

Recurring time-based trigger. The host adapter owns the actual scheduling primitive (cron expression for Codex, `/schedule` for Claude Code, an OS-level cron for generic) — this component owns the cadence vocabulary and the safety posture every scheduled composition must obey.

## Cadence vocabulary

- `daily` — every 24h at `time_of_day` in `timezone`.
- `weekly` — every 7 days at `day_of_week` + `time_of_day`.
- `monthly` — first occurrence of `day_of_week` of the month, OR a fixed day-of-month if the operator names one.
- `custom cron` — operator-supplied cron expression. Surface "what does this do in plain English" back to the operator before committing.

## Mapping intent (load-bearing)

- **Default to weekly Monday morning local-time** when the operator says "regularly" without a cadence. That's the cadence that aligns with most operators' working rhythm; it's not a tiebreaker but a defensible default.
- **Time-of-day matters.** A digest delivered at 03:00 is invisible; the operator reads it Monday morning. Default `09:00` in the operator's timezone, not UTC.
- **Compute the run window from the schedule, not from "now."** A weekly run that fires every Monday 09:00 covers Monday 09:00 last week → Monday 09:00 this week. Computing from `now()` shifts the window and double-counts edge issues on schedule drift.

## Safety posture (non-negotiable)

A `trigger: scheduled` composition with no idempotency story IS a bug, not a feature. The composer MUST pair this with one of:

- `idempotency: window-key` — dedupe-on-period (recommended for digests / reports).
- `idempotency: state-ledger` — cursor advances on success (recommended for incremental syncs).
- `idempotency: destination-search` — search-before-create (recommended when the destination is the source of truth).
- A `knobs.accept_double_write: true` explicit override, with operator confirmation captured in the composition's intent_md.

If none apply and the override isn't set, the composer MUST reject the composition. **Double-writes from missed idempotency are the single most common scheduled-workflow failure** — surface this in the dry-run summary, not as a footnote.

## Pitfalls

- **Timezone source ambiguity.** "Every Monday morning" depends on whose Monday. Always resolve to an explicit IANA timezone before commit; default UTC and SURFACE that choice to the operator if they didn't pick one.
- **DST drift.** A `09:00 America/New_York` schedule will silently move by an hour twice a year. Note this to the operator if their workflow is time-sensitive (e.g. a market-open digest).
- **First-run backfill.** The first scheduled fire on a long-existing source may pull a huge window. Clamp first-run to the configured cadence regardless of how far back the cursor goes; surface the deferred backfill as opt-in.
- **Schedule-vs-execution skew.** The host adapter may run the job N minutes late. Compute the window from the *scheduled* time, not `now()`, otherwise consecutive runs cover overlapping or gappy windows.
- **Outage hiding.** A successful empty-run looks identical to a failed silent-run. Pair `quiet_mode: true` digests with at least one "we're still here" doc per N empty periods — see `pattern/aggregation`.
