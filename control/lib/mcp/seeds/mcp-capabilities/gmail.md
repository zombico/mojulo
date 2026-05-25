---
{
  "ref": "gmail",
  "version": "0.1.0",
  "summary": "Gmail MCP: read (search threads via query language, fetch thread/message history, cursor-based incremental) and write (send / draft / modify labels) affordances. Supports both polling and Pub/Sub push triggers.",
  "requires": {
    "mcpInventoryCategory": "email",
    "inventoryServerHints": ["gmail", "google_mail", "claude_ai_Gmail"]
  },
  "affordances": {
    "read": true,
    "write": true,
    "watch": true
  },
  "capabilities": {
    "cursor": true,
    "cursorField": "history_id",
    "pagination": "pageToken",
    "rateLimit": "quota-units",
    "rateLimitDetails": "15 billion quota units per day per user. Search: 5 units. Thread get: 5 units. History delta: 1 unit. Send/draft: 100 units. 429 responses include Retry-After header.",
    "supportsSearchOperators": true,
    "searchOperators": ["label:", "from:", "to:", "subject:", "has:", "is:", "before:", "after:", "filename:"],
    "writeShapes": ["send_message", "create_draft", "modify_labels"],
    "readShapes": ["search_messages", "get_thread", "list_history", "get_message"],
    "contentModel": "MIME (multipart, inline attachments)",
    "requestLimits": {
      "messageBytes": 33554432,
      "recipientsPerMessage": 10000,
      "labelNameChars": 225
    },
    "supportsDelete": false,
    "supportsDrafts": true
  },
  "intentKeywords": ["gmail", "email", "inbox", "thread", "message", "support", "send", "draft"],
  "exposesKnobs": [
    { "name": "match_query", "prompt": "Gmail search query that defines the matching threads (e.g. 'label:support -label:linear-filed is:unread', 'to:help@example.com from:customer@domain.com'). Must include at least one positive filter beyond the recipient address to avoid spam matches.", "default": null },
    { "name": "exclude_self", "prompt": "Exclude messages sent from your own address to prevent reply loops?", "default": true },
    { "name": "label_to_apply", "prompt": "When this MCP plays the source role with idempotency/source-side-label, which Gmail label gets applied to processed threads?", "default": "mojulo-processed" },
    { "name": "use_push_trigger", "prompt": "Use Cloud Pub/Sub push (requires GCP setup) or poll instead? Most operators use polling.", "default": false }
  ]
}
---

# mcp: Gmail

Gmail is an email account. Its MCP surface is **bidirectional and push-capable** — usable as a composition source (search and watch matching threads) and as a composition destination (send messages, create drafts). The thread is the operator's natural unit (not individual messages); idempotency and cursor semantics track at thread granularity. One MCP, two roles, two trigger modes (poll or push); this component teaches both.

## Source-role surface (when `role: 'source'` in the composition)

- **Discovery calls.**
  - `search_messages` — Gmail query language (`label:`, `from:`, `to:`, `subject:`, `is:`, `before:`, `after:`, `has:`, `filename:` operators). Returns thread ids matching the query. Searches are case-insensitive and support `-` (exclude) prefix. Does NOT do body full-text on common operators — `subject:` matches subject line only.
  - `get_thread` — retrieves a thread by id; returns all messages in the thread (with headers + MIME structure). Optional `format` parameter (`minimal`, `full`; `full` includes decoded payloads).
  - `list_history` — incremental read via `history_id` cursor; returns messages and label changes since the cursor. Cheap operation (1 quota unit).
  - `get_message` — individual message by id (rarely used; `get_thread` is the standard entry point).
- **Cursor.** Gmail's incremental read is **`history_id`-based, not timestamp-based**. `history_id` is a monotonic token — persist the last successfully-processed id as the cursor. On next run, call `list_history(startHistoryId: <cursor>)` to fetch only new activity. If the gap between cursor and now exceeds Gmail's history retention window (~7 days), the cursor is stale and `list_history` will fail with a `INVALID_CURSOR` error — catch it, fall back to `search_messages` with a date filter (`after:YYYY-MM-DD`), and re-baseline the cursor.
- **Watch surface.** Gmail can push via Cloud Pub/Sub if the operator wired it up at the MCP level (rare). The GCP setup is complex — most operators poll. Default trigger is `trigger/signal-polled` at an operator-chosen cadence; use `trigger/signal-push` only if the operator confirms Pub/Sub is configured and the MCP declares `support_push: true`.
- **Rate limit.** 15 billion quota units per day per user. Search costs 5 units. Thread fetch costs 5 units. History delta costs 1 unit. A typical poll (search + history delta) uses ~20 units. Long backfills with high-volume searches will burn quota — clamp first runs to the configured polling window (e.g., last 24 hours), never "all email ever."

### Mapping intent for source role (load-bearing)

- **Thread-id is the primary key, not message id.** A "thread" is the operator's mental unit — a conversation with one or more participants. Idempotency and digests track at thread granularity. A thread can contain hundreds of messages; the composition processes it as a unit.
- **The match query MUST include at least one positive filter beyond the recipient address.** `to:support@` alone matches spam and auto-replies. Require `label:` or `subject:` or `from:domain.com` discrimination in the knob's default or in composition validation.
- **Always include `-from:<operator's own send address>` to prevent reply loops.** When the composition reads inbound mail and sends outbound (e.g., file support tickets to Linear), the operator's own replies to customers can trigger a loop if not filtered. The `exclude_self` knob enforces this by default; turning it off requires operator override.
- **`is:unread` is tempting as a "what's new" cursor but is mutable.** Anything that marks the thread read (operator opens it in Gmail UI, an auto-responder processes it, the composition itself marks it read) silently removes it from subsequent searches. Use `history_id` for true incremental semantics; use `is:unread` only as a filter within the composed query, not as the source of truth for "new."
- **Subject lines often contain PII.** Customer threads frequently include names, account numbers, or order ids in the subject. KYC's `no PII in summaries` constraint applies — render layers must redact or hash subjects before passing through the LLM.
- **Label-based state is mutable and operator-dependent.** Labels like `support/pending` or `customer/vip` carry semantic weight but can be renamed or removed by the operator at any time. Use them for filtering at composition-bind time, but don't hard-code them into run-time logic.

## Destination-role surface (when `role: 'destination'` in the composition)

- **Discovery calls.**
  - `send_message` — immediate send. Required: `to`, `subject`, `body`. Optional: `cc`, `bcc`, `replyTo`, `inReplyToId` (for threaded replies). Irreversible.
  - `create_draft` — writes to Drafts folder; operator publishes manually. Same schema as `send_message`. Used for dry-runs and "confirm before send" workflows.
  - `modify_labels` — add/remove labels on a thread (idempotent set operation). Used for marking processed, categorization, etc.
- **Required fields for send.** `to` (array), `subject`, `body`. Most MCPs accept either plain text or HTML; default to plain text + a one-line trace footer naming the composition ref. HTML opens enough rendering and injection pitfalls that "use it on purpose" is the right discipline.
- **Dedupe surface.** Gmail does NOT dedupe outbound messages — duplicate `send_message` calls produce duplicate sends (same email sent twice). Pair this destination with `idempotency/destination-search` (search Sent folder for a matching thread before sending) or `idempotency/state-ledger` (cursor on source signal ids) whenever the composition fires more than once per source signal. For reply workflows, use `inReplyToId` to anchor the send to a specific message in the thread.
- **Draft posture.** First-class. Drafts are private to the operator and live in the Drafts folder; "promotion" is a manual send by the operator. For dry-runs of `send_message` workflows, **ALWAYS write to Drafts first**, then ask the operator to confirm sending.

### Mapping intent for destination role (load-bearing)

- **Use a stable header for dedupe, not subject lines.** Persist the source-event's stable id as a custom header (`X-Mojulo-Source-Ref: <source-uri>`) so dedupe-on-replay can find prior sends without parsing subject lines or relying on date matching. Subject lines drift, reply-to behavior mutates — custom headers are stable.
- **Subject lines should NOT pull customer body content.** They go into the operator's inbox preview (and into forwarded threads). Avoid PII leakage — use a stable template naming the source event, not quoting source content.
- **For reply workflows, include the full thread context.** When composing a reply in a multi-turn thread, render prior messages so the operator sees the full conversation history before confirming send.
- **Label application after send is safer than before.** Send first, then apply labels (`modify_labels`). If send fails, the label won't be orphaned; if send succeeds but label fails, the message is already sent (acceptable; label failure is non-critical).

## Watch-role usage

The `affordances.watch: true` declaration means push-based triggers are *possible* if the operator has set up Cloud Pub/Sub. In practice, this is rare — GCP configuration, MCP-level Pub/Sub wiring, and webhook infrastructure deter most operators. **Default trigger is polling** (`trigger/signal-polled`); the composition should present polling as the standard path and ask the operator to confirm if they've set up Pub/Sub before offering `trigger/signal-push`. A push trigger fires immediately on new mail; a poll trigger fires at operator-chosen intervals (e.g., every 15 minutes). Polling is simpler and covers most use cases.

## Pitfalls (apply across both roles)

- **Reply loops from self-replies.** A composition that reads inbound and sends outbound to the same inbox WILL loop if the operator's own replies match the search query. The `exclude_self` knob is on by default; turning it off requires explicit operator override captured in the composition intent.
- **History-id horizon is ~7 days.** Gmail expires history beyond ~7 days. If the workflow is paused or broken longer than that, the cursor's gap exceeds the retention window and `list_history` will fail with `INVALID_CURSOR`. Catch the failure, fall back to `search_messages` with a date filter (`after:YYYY-MM-DD`), and re-baseline the cursor. This is a load-bearing error handler — without it, a paused composition becomes permanently stuck.
- **Labels as source-side state are operator-mutable.** When using `idempotency/source-side-label`, the label MUST be a label the operator doesn't touch in the Gmail UI. `mojulo-processed` is a defensible default; let the operator override. If the operator renames or deletes the label, idempotency breaks silently — surface label health as a workflow diagnostic.
- **First-poll history-id backfill.** The first poll with `history_id = 0` (or unset) will sweep the entire inbox matching the filter. This can return thousands of threads. Initialize the cursor to the current `history_id` on first run and surface the deferred backfill ("do you also want to process the prior 30 days?") as an opt-in step, not automatic.
- **Subject-line PII in forwarded threads.** Support-driven workflows paste customer names / emails into subjects. If the composition forwards or exports threads (to Slack, to a digest, etc.), KYC's `no PII in summaries` constraint applies — render layers must redact or hash subjects before downstream publishing.
- **Drafts that never get sent.** When a composition writes drafts and the operator never confirms, the drafts sit in the Drafts folder forever. Surface drafts pending approval for more than N days (e.g., 7) as a workflow health signal; offer "discard stale drafts" as a manual step.
- **Message size limits on send.** Each message (with attachments) cannot exceed 33 MB. Compositions that attach large files or concatenate long threads inline WILL hit this limit. Clamp message size before sending; offer "too large, split into multiple messages" as a fallback.
- **Attachment handling is MCP-variant.** Some Gmail MCPs expose attachments as base64 on `get_message`; others expose file ids that require a separate download. Discover the MCP's attachment shape at bind time; don't hard-code the read shape.
- **UTF-8 encoding in headers.** Non-ASCII characters in headers (e.g., subject lines in other languages) require RFC 2047 encoding. Most MCPs handle this transparently, but raw MIME construction can fail. When composing subjects with non-ASCII, test with a sample before committing.

<!-- sources
  - https://developers.google.com/gmail/api/guides/threading (thread model, history_id, cursor lifecycle)
  - https://developers.google.com/gmail/api/guides/labels (label model, list, create, modify)
  - https://developers.google.com/gmail/api/reference/rest/v1/users/messages/search (search operators, query syntax)
  - https://developers.google.com/gmail/api/guides/manage-messages (send, draft, modify lifecycle)
  - https://developers.google.com/gmail/api/guides/push-notifications (Pub/Sub setup, rare)
  - https://developers.google.com/gmail/api/guides/quota (15B units/day, quota costs per operation)
  - https://tools.ietf.org/html/rfc2047 (MIME header encoding for non-ASCII)
-->
