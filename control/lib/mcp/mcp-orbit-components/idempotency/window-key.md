---
{
  "ref": "window-key",
  "version": "0.1.0",
  "summary": "Dedupe-on-period: composite key '${destination_id}-${period_token}' searched at destination before create.",
  "satisfies": ["requires_idempotency"],
  "fits": {
    "triggers": ["scheduled"],
    "patterns": ["aggregation"]
  },
  "intentKeywords": ["weekly", "daily", "monthly", "period", "digest", "summary", "report"],
  "exposesKnobs": [
    { "name": "period_format", "prompt": "How does the period get encoded in titles? (YYYY-W##, YYYY-MM, YYYY-MM-DD)", "default": "YYYY-W##" }
  ]
}
---

# idempotency: window-key

The right idempotency strategy for **periodic aggregation** — anything where one period produces one destination artifact. Builds a composite key from the destination identifier and the period token, then searches the destination for an existing artifact with that key BEFORE creating.

## Key shape

`${destination_id_or_title_prefix}-${period_token}`

Examples (the period_format knob controls the second half):

- `Linear digest — 2026-W21` (weekly, ISO week)
- `Submissions digest — 2026-05` (monthly)
- `Daily summary — 2026-05-23` (daily)

The destination identifier should be **stable across runs** — title prefix is fine if the destination doesn't have a stable handle; the title's period suffix is what does the dedupe work.

## Mapping intent (load-bearing)

- **Period token IS the dedupe primitive.** ISO week (`YYYY-W##`) is the right default for weekly cadences because it disambiguates the year-boundary cases that `YYYY-MM-DD` of the week's Monday does not (e.g. the week of Dec 30 2024 → Jan 5 2025 has issues on both sides of the year boundary; ISO week notates it cleanly as `2025-W01`).
- **Search-before-create, not create-with-conflict.** Most destination MCPs don't surface "this title already exists" as a structured conflict — they happily create a duplicate. The check has to be explicit, before the write.
- **Match exact, not fuzzy.** Most destination `search_files` shapes do prefix or substring matching. Verify exact-equality on the returned hit's title; never trust the search to be tight.
- **Found a match? Two strategies, both valid:**
  - **Skip the write.** Right for digests-as-snapshot ("Monday's digest is whatever Monday says").
  - **Append to the existing artifact.** Right for living docs the operator wants to grow over the period (less common, but appears in monthly retrospectives).

  Surface the choice to the operator at composition time; default to skip.

## Pitfalls

- **Title-prefix collisions across compositions.** If two different mcp-orbit compositions both write to the same folder with title prefixes `Linear digest` and `Linear digest summary`, a prefix-match search will conflate them. Make the prefix opinionated enough to be unambiguous (`Linear digest — ` with the em-dash trailing space).
- **Trashed-but-not-deleted destinations.** See `mcp/gdrive` (destination-role pitfalls) — searches return trashed items by default in many MCPs. Filter them out before treating a hit as a duplicate; otherwise the workflow silently skips a real new write.
- **Clock skew between scheduler and destination.** A run that fires at 23:58 may compute period token `2026-W20` while the destination, queried at 00:01, has all its time-stamped artifacts under `2026-W21`. Compute the period from the run's *scheduled* time, not the destination's clock.
- **Cursor cohabitation.** This strategy is the right choice when "one period → one artifact" is the model. For "every new record → one destination row" use a different idempotency component (state-ledger or destination-search). Don't combine without a clear reason.
- **Operator-initiated re-run.** When the operator manually re-runs the workflow for a past period, the search-before-create silently skips. Surface "an artifact for this period already exists — overwrite, append, or skip?" rather than failing silently.
