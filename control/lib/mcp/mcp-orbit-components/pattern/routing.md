---
{
  "ref": "routing",
  "version": "0.1.0",
  "summary": "Cognitive shape: per matching source event → one destination record. 1:1, not N:1.",
  "fits": {
    "triggers": ["signal-polled", "signal-push"],
    "sourceMcpAffordances": ["read"],
    "destinationMcpAffordances": ["write"]
  },
  "requires": {
    "minMcpRoles": { "source": 1, "destination": 1 },
    "needsIdempotency": true
  },
  "intentKeywords": ["route", "file", "create", "open", "log", "forward", "send to", "ticket", "issue", "each", "per", "when"],
  "exposesKnobs": [
    { "name": "match_filter", "prompt": "What defines a 'matching event' on the source? (typically the same filter as the source MCP's match_query knob, restated here for clarity)", "default": null },
    { "name": "routing_target", "prompt": "How does the destination record get routed? (fixed team/project/channel | by source field | rule-based)", "default": "fixed" },
    { "name": "include_source_context", "prompt": "Embed the source event's content in the destination record? (full body | quoted excerpt | link only)", "default": "quoted excerpt" },
    { "name": "reply_to_source", "prompt": "After routing succeeds, take a follow-up action on the source? (none | apply a label | send acknowledgment | both)", "default": "none" }
  ]
}
---

# pattern: routing

The cognitive shape of "each matching event from the source becomes one record in the destination." 1:1, not N:1 (which is aggregation). When the operator says "when X happens, file a Y" — that's routing. Support email → issue, signal event → alert, alert → ticket — all sit here.

## When this fits

- Source emits discrete events that map naturally to one downstream record each.
- The operator wants timely (sub-window) handoff, not periodic summarization.
- The destination supports per-record creation (issues, tickets, drafts, rows).

## When this doesn't fit (redirect)

- **Operator wants periodic summarization.** "Weekly digest of support volume" — that's `pattern: aggregation`, not routing.
- **Operator wants the SAME record updated each time (running state, not new records).** That's `pattern: enrichment`, not routing.
- **Operator wants the event sent to MULTIPLE destinations conditionally.** That's `pattern: branching`, not routing.

## Mapping intent (load-bearing)

The four knobs (`match_filter`, `routing_target`, `include_source_context`, `reply_to_source`) are not optional polish — they're what turn this pattern from a synthesis pretext into a deployable routing rule. **Never compose this pattern without resolving all four with the operator in one round.**

- **`match_filter`.** Routing without a filter routes everything. Restate the source-side query here even if it duplicates the source MCP's knob — the operator should see "what fires this" in one place at the composition level, not have to mentally compose source-filter + pattern-condition.
- **`routing_target`.** "Fixed" (everything goes to one team/project) is the simplest and right for most v0 setups. "By source field" (subject contains 'billing' → billing team) is operator-fragile; the synthesizer must surface the exhaustive rule list at promote time so the operator can audit it. "Rule-based" with overlap/precedence concerns gets complicated fast — push back when an operator proposes more than ~5 rules.
- **`include_source_context`.** `quoted excerpt` is the right default — full body bloats destination records and surfaces PII risks, link-only loses the context that makes the record useful at triage time. `quoted excerpt` means: first ~500 chars of the source event + a link back to the full source.
- **`reply_to_source`.** `none` is the right default for routing rules the operator hasn't explicitly opted into. `apply a label` is the most common "yes I want feedback to the source" choice — it's idempotent and visible in the source UI. `send acknowledgment` opens a reply-loop pitfall (covered below) — only enable when the source MCP supports `exclude_self` filtering.

## Render contract

Routing produces ONE destination artifact per matched source event. The render component (when chosen) takes:

- `source_event: { id, title, url, body_excerpt, sender, received_at, source_ref }`
- `routing_decision: { target, rule_applied, confidence? }`
- `trace: { composition_ref, run_at, source_event_id }` — mojulo trace, baked into every destination record

Render layers MUST include the trace block (in the record body, as a footer or `X-Mojulo-Source-Ref` header style depending on destination shape). A routed record with no provenance is unauditable downstream.

## Pitfalls

- **TOCTOU on idempotency.** Two overlapping poll runs see the same source event before either has written its destination record. State-side ledgers are vulnerable here; pair routing with `idempotency/source-side-label` or `idempotency/destination-search` instead — both are TOCTOU-safe.
- **Reply loops.** If `reply_to_source` is `send acknowledgment` and the source filter doesn't exclude the operator's own sends, the workflow's own reply matches the filter, files another destination record, replies again... loops forever within an hour. Always pair with the source MCP's `exclude_self` posture.
- **Routing to archived destinations.** A team / project / repo that existed at composition time may be archived by next poll. Surface a clear failure (the routed event goes into a workflow-error queue the operator can see) rather than letting destinations fall into a void.
- **PII in routed records.** If `include_source_context >= 'quoted excerpt'`, the destination record contains source body text. KYC's `no PII in summaries` constraint applies; drop to `link only` rendering or filter PII at the source before passing through.
- **First-poll backfill blast.** Paired with `trigger/signal-polled`, a first poll with the cursor at "beginning" routes every historical match — for a popular support inbox, this is hundreds or thousands of issues at once. The `first_run_cursor: now` default on signal-polled is the safety valve; routing's pitfall framing should reinforce it.
- **Destination archival between poll and write.** A poll picks up a match; the destination MCP archives the target team between read and write. Catch the failure, leave the source unmarked (so it'll be retried next poll), and surface to the operator after N consecutive failures.
- **Operator opens the source thread manually.** Operators sometimes process source events by hand in parallel with the workflow. The TOCTOU-safe idempotency strategy (source-side label) catches this — operator's manual action and workflow's auto-action both apply the same label and the duplicate write is prevented at the label-apply step.
