---
{
  "ref": "source-side-label",
  "version": "0.1.0",
  "summary": "Apply a label/marker on the source-side event after successful destination write; subsequent queries exclude marked events. TOCTOU-safe.",
  "satisfies": ["requires_idempotency"],
  "fits": {
    "triggers": ["signal-polled", "signal-push"],
    "patterns": ["routing", "branching", "enrichment"]
  },
  "requires": {
    "sourceMcpAffordance": "write"
  },
  "intentKeywords": ["signal", "label", "tag", "marker", "when", "watch", "incoming", "thread", "message", "event", "filed"],
  "exposesKnobs": [
    { "name": "marker_name", "prompt": "What label/tag/flag is applied to processed source events? (must be a marker the operator doesn't touch in the source UI; defensible default 'mojulo-processed')", "default": "mojulo-processed" },
    { "name": "exclude_in_filter", "prompt": "Auto-extend the source match query with '-marker:<marker_name>' so the next poll excludes already-processed events?", "default": true },
    { "name": "marker_action", "prompt": "When to apply the marker — 'on_destination_success' (recommended) or 'on_processing_start' (faster but riskier)?", "default": "on_destination_success" }
  ]
}
---

# idempotency: source-side-label

The right idempotency strategy for **signal-driven workflows** — anything where source events flow through one at a time and you need each event processed exactly once. Applies a stable marker on the source after the destination write succeeds; subsequent polls filter out marked events.

This is the **TOCTOU-safe** strategy. Both `idempotency/window-key` (for periodic aggregation) and this component (for signal routing) are TOCTOU-safe; the difference is the failure mode they prevent. `window-key` prevents same-period double-writes; `source-side-label` prevents same-event double-routes.

## Marker shape

The marker is a source-side property that's queryable in the source's match-filter syntax. Examples:

- **Gmail.** Apply a label (e.g. `mojulo-processed` or `linear-filed`). Extends the search query with `-label:mojulo-processed`.
- **Linear (when source).** Apply a label on the issue. Extends with `-label:mojulo-processed`.
- **Slack.** React with a marker emoji. Extends with `-has:reaction:<emoji>` (when the MCP supports it; not all do).
- **Generic.** Some source MCPs have a "mark as processed" affordance; others don't have any source-side write surface — in which case this idempotency component DOES NOT FIT (see pitfalls).

The `marker_name` knob picks the specific marker; the `exclude_in_filter` knob auto-extends the source query so the operator doesn't have to remember to manually add the exclusion.

## Mapping intent (load-bearing)

- **`on_destination_success` marker timing is right by default.** The sequence is: pull event → write destination → ON SUCCESS, apply marker → advance cursor. If the destination write fails, the marker is NOT applied and the event is retried on next poll. The marker IS the "destination write succeeded" receipt.
- **`on_processing_start` is faster but riskier.** It applies the marker before the destination write. If the write then fails, the marker is still applied and the event is silently lost. Only use when the operator has confirmed they'd rather skip than retry (e.g. very high-volume sources where occasional silent drops are acceptable).
- **The marker MUST be a marker the operator doesn't touch in the source UI.** Picking `important` or `starred` would conflict with the operator's own usage. `mojulo-processed` is defensible; `<workflow-name>-filed` (e.g. `linear-filed` when routing to Linear) is also good — it self-documents what the marker means.
- **Source MCPs without a write affordance can't use this component.** The composition validator must check that the source-role mcp declares `affordances.write: true` (it needs to write the marker back to the source). When false, redirect to `idempotency/destination-search` or `idempotency/state-ledger`.

## TOCTOU safety property

The window between "we decided to process this event" and "the marker is applied" is narrow but non-zero. The key property: **the marker-apply call is itself idempotent in the source MCP** — applying the same label twice is a no-op, not a failure. So if two overlapping poll runs both decide to process the same event:

1. Run A reads the event, writes the destination, applies the marker.
2. Run B reads the event (it was not yet marked when run B's discovery query fired), writes the destination, applies the marker.

Result: **two destination records exist** (the bug we're trying to prevent). The marker doesn't help here because both runs already passed their discovery query.

The **actual** TOCTOU safety requires one of:

- **A) Re-entrant poll prevention at the trigger.** The poll trigger skips itself if the previous poll is still running. Pairs with the `trigger/signal-polled` re-entrance pitfall guidance.
- **B) Destination-side existence check before write.** The composition reads the destination to check "is there already a record for source event id X" before writing. This adds latency (one destination read per event) but is the only TOCTOU-safe shape under parallel polls.

For v0, this component documents (A) as the safe default — re-entrance prevention at the trigger keeps the design simple. The composer should set `accept_double_write: false` (default) and the dry-run summary should note "this composition assumes polls do not overlap; if your poll interval may be longer than the configured cadence, add a destination-search check at the routing step."

## Pitfalls

- **Operator-applied marker conflict.** If the operator marks a thread with the same label manually, the workflow will think it processed it and skip. Pick a marker namespace the operator wouldn't naturally use (`mojulo-` prefix is defensible).
- **Marker rate limit on source MCP.** Some source MCPs throttle label-apply calls. A first-run backfill processing 500 events fires 500 label-apply calls in addition to the destination writes — surface the doubled call volume to the operator.
- **Marker that doesn't survive thread merges.** When the source MCP merges two threads (Gmail's "this is a reply to X"), the marker may transfer or may not — depends on the MCP. Test marker behavior across thread operations during the dry-run.
- **Lost marker due to source-side bulk operation.** An operator who clears all labels on the inbox will lose the markers and the next poll will reprocess every historical event. This is rare but devastating; surface a "I noticed marker count dropped by N — possible bulk operation" warning when running.
- **Source MCP changes label semantics.** A label rename or deletion at the source side breaks the filter exclusion silently. The dry-run summary should name the exact marker the workflow depends on; the operator's KYC should include "don't touch labels with `mojulo-` prefix" as a self-binding constraint.
