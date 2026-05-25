# Provider artifact — message-thread (source role) on {{server}}

*Runtime-generated from primitive `message-thread@0.1.0` (source role) and a capability snapshot of `{{server}}` introspected at `{{introspected_at}}` (snapshot confidence: `{{snapshot_confidence}}`). This artifact is session-scoped — its assertions about tool names and schemas reflect the bound MCP **at introspection time**, not curated training data.*

## Affordance bindings

| Affordance | Bound tool | Confidence |
|---|---|---|
| `list-recent-in-mailbox` | `{{tool:list-recent-in-mailbox}}` | `{{confidence:list-recent-in-mailbox}}` |
| `read-thread` | `{{tool:read-thread}}` | `{{confidence:read-thread}}` |
| `find-by-filter` | `{{tool:find-by-filter}}` | `{{confidence:find-by-filter}}` |
| `get-metadata` | `{{tool:get-metadata}}` | `{{confidence:get-metadata}}` |
| `read-label-state` | `{{tool:read-label-state}}` | `{{confidence:read-label-state}}` |
| `subscribe-to-mailbox` | `{{tool:subscribe-to-mailbox}}` | `{{confidence:subscribe-to-mailbox}}` |

**Unbound affordances:** {{unbound_affordances}}

## How to read this MCP

The catch-up pattern is `list-recent-in-mailbox` (cursor on the vendor-specific incremental token — history-id, delta-token, or modified-time) → for each new thread, decide whether the workflow needs the full reply tree (call `read-thread` on the thread id) or just metadata (call `get-metadata` to read participants and label state without pulling bodies). Use `find-by-filter` for targeted queries — "threads from sender@domain.com since YYYY-MM-DD," "threads with label X," "threads in subject matching keyword" — when the workflow is reactive rather than scanning the cursor.

The unit of processing is the **thread**, not the individual message. Idempotency anchors on thread id; replies that arrive into an already-processed thread either re-trigger the workflow at thread granularity or are filtered out depending on the composition's intent (digest-style: process once per thread; reply-style: process every new reply within a thread).

Normalize recipient and sender email addresses before dedupe or audit. Email gets aliased (operator-side `name+tag@domain`), forwarded through aliases, and case-folded inconsistently — the canonical lowercase form of the local-part-and-domain is the stable key.

{{if-bound:subscribe-to-mailbox}}
This MCP exposes `subscribe-to-mailbox` — push delivery is available for new threads / thread updates. Prefer `trigger: signal-push` over polling. Confirm the underlying subscription is actually established during dry-run — the MCP tool's presence does not imply the push channel (Gmail Pub/Sub topic, Microsoft Graph webhook registration) is wired and receiving events. Push trigger fires immediately on new mail; polling trigger fires at operator-chosen intervals.
{{/if-bound:subscribe-to-mailbox}}
{{if-unbound:subscribe-to-mailbox}}
This MCP does **not** expose `subscribe-to-mailbox`. Compositions over this source must use `trigger: signal-polled` with the incremental cursor from `list-recent-in-mailbox`. Polling cadence is operator-chosen; default to a value the bound MCP's quota / rate limits comfortably tolerate (typical: 5–15 minutes for active inboxes).
{{/if-unbound:subscribe-to-mailbox}}

{{if-bound:read-label-state}}
This MCP also exposes `read-label-state` — label / category state on a thread is readable as a separate call. Label-based source-side dedupe (`exclude threads tagged 'mojulo-processed'`) is available; treat labels as operator-mutable signals, not authoritative state. Pair label-based dedupe with a state-ledger fallback for compositions whose correctness depends on processed-once semantics.
{{/if-bound:read-label-state}}

## Bound tool schemas

The following schemas are reproduced from the snapshot. Bind composition parameters to these schemas directly — do not infer parameter names from tool names, and do not assume one mail MCP's query syntax works on another even when both back the same platform.

### `list-recent-in-mailbox` → `{{tool:list-recent-in-mailbox}}`

```json
{{schema:list-recent-in-mailbox}}
```

### `read-thread` → `{{tool:read-thread}}`

```json
{{schema:read-thread}}
```

### `find-by-filter` → `{{tool:find-by-filter}}`

```json
{{schema:find-by-filter}}
```

{{if-bound:get-metadata}}
### `get-metadata` → `{{tool:get-metadata}}`

```json
{{schema:get-metadata}}
```
{{/if-bound:get-metadata}}

{{if-bound:read-label-state}}
### `read-label-state` → `{{tool:read-label-state}}`

```json
{{schema:read-label-state}}
```
{{/if-bound:read-label-state}}

{{if-bound:subscribe-to-mailbox}}
### `subscribe-to-mailbox` → `{{tool:subscribe-to-mailbox}}`

```json
{{schema:subscribe-to-mailbox}}
```
{{/if-bound:subscribe-to-mailbox}}

## Cross-vendor pitfalls (inherited from primitive)

These hold for any message-thread source, including this one. Vendor-specific quirks (Gmail's 7-day history_id horizon, Outlook's delta-token lifetime, Apple Mail's flag-color enum vs Gmail's string labels), if any, are in `adapter/{{server}}.md` (loaded separately when present).

- **Audience is the operator's mailbox.** The cursor scopes to the operator's inbox / account. Reading "all mail across all accounts" is not a supported pattern — bind one account per source artifact.
- **Cursor field varies.** The cursor field is exposed by `list-recent-in-mailbox`'s schema above. Do not assume it is named `history_id`, `delta_token`, `since`, `cursor`, or `modified_time` — discover from the schema.
- **Cursor horizons.** Incremental cursors expire (Gmail: ~7 days; Outlook: bounded delta-token life). Catch `INVALID_CURSOR`-class errors, fall back to date-windowed `find-by-filter` (`after:YYYY-MM-DD`), and re-baseline the cursor.
- **Thread-as-unit.** Compositions process threads, not individual messages. A single thread can contain hundreds of replies; treat it as a unit unless the workflow is explicitly reply-granular.
- **Self-reply loops.** Filter sender-self in source query (default-on `exclude_self`), or persist source-event-id in a custom header on outbound and dedupe at search-time. Without one of these, read-inbound + send-outbound compositions infinitely loop.
- **Label state is operator-mutable.** If the workflow uses labels for marking-processed, the operator can remove the label by opening the thread in the native client. Pair label-based source-side dedupe with a state-ledger fallback.
- **Canonical recipient identity.** Normalize sender and recipient addresses (lowercase, strip `+tag` suffix on local part) before using as dedupe keys or audit identifiers.
- **Subject-line PII.** Subject lines frequently contain customer names, account numbers, and order ids. Redact subjects before passing thread content through LLM render layers — KYC's no-PII-in-summaries constraint applies.
- **First-poll backfill blast.** Initialize the cursor to the current top-of-mailbox on first run. The cursor's epoch is not "the start of the operator's inbox."
- **Attachment shape.** Some MCPs expose attachments inline as base64 on `read-thread`; others expose attachment ids requiring a separate fetch. Discover at bind time; do not assume.
