---
{
  "ref": "message-thread",
  "version": "0.1.0",
  "summary": "Primitive: a directed messaging surface where audience is named recipients (to/cc/bcc), threads grow by reply with stable in-reply-to identity, and labels are operator-mutable per-thread state. Backed by Gmail, Outlook, Apple Mail, ProtonMail, Fastmail.",
  "affordances": {
    "source": [
      { "name": "list-recent-in-mailbox", "support": "expected", "summary": "Fetch recent threads in a mailbox scope with an incremental cursor (history-id, delta token, or modified-time depending on vendor)." },
      { "name": "read-thread", "support": "expected", "summary": "Fetch all messages in a thread by thread id; returns ordered messages with headers, bodies, and attachments." },
      { "name": "find-by-filter", "support": "expected", "summary": "Search threads by query — recipient, sender, subject, label/category, date range. Query syntax varies per vendor; the affordance shape (predicate filter over threads) is stable." },
      { "name": "get-metadata", "support": "likely", "summary": "Return non-body metadata for a thread: participant list, label/category state, attachment list, message count — without pulling full bodies." },
      { "name": "read-label-state", "support": "likely", "summary": "Read operator-applied labels/categories on a thread for source-side filtering and source-side dedupe (e.g. exclude threads tagged 'mojulo-processed')." },
      { "name": "subscribe-to-mailbox", "support": "rare", "summary": "Push notification on new threads or thread updates. Exists at the platform level (Gmail Pub/Sub, Microsoft Graph subscriptions) but uneven in shipping MCPs; fall back to signal-polled over the cursor." }
    ],
    "destination": [
      { "name": "send-to-recipients", "support": "expected", "summary": "Compose and send a new outbound message to named recipients. Required: to (array), subject, body. Optional: cc, bcc, replyTo. Irreversible — see draftPosture for dry-run." },
      { "name": "reply-in-thread", "support": "expected", "summary": "Reply within an existing thread, anchored by in-reply-to identity to preserve threading in recipient clients. Audience defaults to thread participants; explicit reply-all vs reply-sender is operator intent." },
      { "name": "create-draft", "support": "expected", "summary": "Write to the Drafts folder for operator manual send. First-class across every plausible backing vendor; the canonical dry-run posture for send-to-recipients and reply-in-thread." },
      { "name": "find-by-filter", "support": "expected", "summary": "Used for search-before-send dedupe — typically searches the Sent folder for prior outbound to the same recipient with the same source-ref header. Same contract as the source-role variant." },
      { "name": "apply-label-state", "support": "likely", "summary": "Set or remove operator-mutable thread state — Gmail labels, Outlook categories, Apple Mail flags. Idempotent set semantics. Used both for marking-processed (source-side dedupe) and for outbound categorization." },
      { "name": "forward-thread", "support": "likely", "summary": "Forward an existing thread to new recipients, preserving prior message history. Common workflow surface for escalation and handoff. Some vendors require constructing a new send with quoted bodies rather than exposing a native forward op." }
    ]
  },
  "pitfalls": [
    "Audience is named recipients, not scope. Every outbound write must capture to/cc/bcc explicitly; there is no 'channel' as a stand-in for audience. Compositions that mis-address an outbound leak content to the wrong human — recoverable only via the recipient's discretion.",
    "Reply identity is the in-reply-to header, not just the thread id. The header is what stitches replies into a single conversation in recipient clients; posting with the right thread id but missing the in-reply-to anchor produces orphaned-looking messages in some clients (Outlook is particularly strict here).",
    "Cursor horizons are real. Incremental-cursor reads on thread-mail surfaces have retention windows (Gmail: ~7 days on history_id; Outlook: bounded delta-token life). A paused or broken workflow that exceeds the window becomes permanently stuck without an explicit fallback to date-windowed re-baseline.",
    "Self-reply loops. A composition that reads inbound and sends outbound to the same mailbox WILL loop if the operator's own sends match the source query. Filter sender-self in source query (default-on), OR persist source-event-id in a custom header on outbound and dedupe at search-time.",
    "Label / category state is operator-mutable. The same label the workflow writes can be removed by the operator opening the thread in the native client. Don't treat labels as authoritative state — treat them as operator-readable signals that the workflow may also have written. Source-side dedupe via label is fragile across operator activity; pair it with a state-ledger fallback.",
    "Drafts that never get sent. Compositions that write to Drafts as dry-run posture can accumulate stale drafts when the operator forgets to confirm. Surface 'drafts pending approval > N days' as a workflow health signal; offer 'discard stale drafts' as an explicit operator step.",
    "Subject lines often carry PII. Customer-driven threads frequently include names, account numbers, or order ids in the subject. Compositions that forward, digest, or render thread content downstream must redact subjects before passing through LLM render layers — KYC's no-PII-in-summaries constraint applies.",
    "Recipient identity by canonical address. Email addresses get aliased on the operator side (name+tag@domain), forwarded through aliases, and case-normalized inconsistently across clients. Dedupe and audit must use the canonical normalized form, not the raw input string.",
    "Attachment shape is MCP-variant. Some MCPs expose attachments inline as base64 on the thread read; others expose attachment ids requiring a separate fetch call. Discover the bound MCP's attachment shape at bind time; don't hard-code one shape into the composition.",
    "Mime multipart matters. Outbound messages render across many clients (mobile, desktop, web, vintage). Best practice is multipart/alternative with both plain-text and HTML bodies; HTML-only sends render fragile or stripped in many clients. The bound send tool may handle this transparently or may require explicit construction.",
    "Send is irreversible. Unlike messaging-channel's update-message or document-store's overwrite, a sent email cannot be recalled (Outlook's 'recall' feature is best-effort and recipient-cooperative). Dry-run via Drafts is load-bearing for any composition that sends to external recipients; promotion from Drafts to Sent is an explicit operator step, not a default.",
    "First-poll backfill blast. The first source read with no cursor will sweep the entire matching mailbox history. Initialize the cursor to the current top-of-mailbox on first run; surface 'do you also want to process prior threads?' as an opt-in step."
  ],
  "rolePairings": {
    "source": {
      "cursorAffordance": "list-recent-in-mailbox",
      "cursorFieldHint": "history-id / delta-token / modified-time (discover from the bound tool's schema)",
      "preferredTriggers": ["signal-polled", "signal-push"]
    },
    "destination": {
      "dedupeAffordance": "find-by-filter",
      "draftPosture": "First-class across every plausible backing vendor. The canonical dry-run posture: write the intended send to Drafts via create-draft, then require explicit operator confirmation before promoting to send-to-recipients or reply-in-thread. Drafts are private to the operator's account; they appear in the native client's Drafts folder for review. For workflows where the operator wants 'send immediately, but auditably,' pair send-to-recipients with apply-label-state to tag outbound with the source-ref."
    }
  }
}
---

# primitive: message-thread

A `message-thread` is a directed messaging surface where audience is **named recipients** (to/cc/bcc), threads grow by **reply** with stable in-reply-to identity, and labels are **operator-mutable per-thread state**. The defining shape is **recipient-directed writes**: every outbound message names its audience explicitly, and there is no scope-broadcast affordance.

This is the curated, vendor-agnostic shape. The integration specifics — which tool name satisfies which affordance, what the cursor field is actually called, what the search query syntax is, what label vocabulary the operator's account has — come from the runtime-introspected provider artifact built from the operator's installed MCP. This body teaches the shape; the generator fills the specifics.

## When this primitive fits

- The workflow's source role triages inbound mail — keywords in subject or body, label state, sender identity — and extracts threads as composition triggers.
- The workflow's destination role sends outbound notifications, replies, or escalations to named human recipients (customers, internal stakeholders, vendor support).
- Audience is named recipients, not scope members — "email alice@" and "email the support team distribution list" are recipient-directed, not scope-broadcast.
- The workflow uses label/category state as a state machine — `support/triaged`, `mojulo-processed`, `customer/vip` — and reads or writes that state as part of its idempotency posture.
- Idempotency anchors on thread id (for replies and label writes) or on (recipient + source-ref-header) for search-before-send dedupe.

## When it doesn't fit

- The workflow needs scope-broadcast messaging where audience is scope members (`messaging-channel` — Slack, Discord, Teams). The audience model differs: messaging-channel is scope-broadcast with self-selecting audience; message-thread is recipient-directed with reply-tree audience.
- The workflow needs durable named artifacts organized by folder or label, where content outlives the conversation (`document-store` — Drive, Notion docs).
- The workflow needs typed records with structured queries — issue trackers, CRMs, or spreadsheet-databases (`structured-record-store` — Linear, GitHub Issues, HubSpot, Airtable).
- The workflow needs append-only timeline semantics with cursor-based catch-up where individual events are the unit (`event-stream`). Message-thread treats the *thread* as the unit, not the individual message.

## Affordance map summary

Source role uses `list-recent-in-mailbox` (cursor on history-id / delta-token / modified-time depending on vendor) as the catch-up read pattern, `read-thread` for fetching the full reply tree of a specific thread, `find-by-filter` for targeted queries (threads from sender X, threads with label Y, threads since date Z), `get-metadata` for participant lists and label state without pulling bodies, and `read-label-state` as the source-side dedupe primitive when the workflow marks-processed via labels. `subscribe-to-mailbox` is rare on shipping MCPs even when the platform supports push (Gmail Pub/Sub, Microsoft Graph subscriptions); compositions fall back to `trigger: signal-polled` over the cursor field.

Destination role uses `send-to-recipients` for new outbound messages and `reply-in-thread` for thread-anchored replies — on most platforms these route through the same underlying tool with different in-reply-to semantics, but the primitive splits them because the operator's intent (notify new recipient vs continue an existing conversation) is genuinely different. `create-draft` is the canonical dry-run posture and is first-class on every plausible backing vendor. Dedupe uses `find-by-filter` against the Sent folder with a stable source-ref header. `apply-label-state` covers both source-side marking-processed (idempotent set-semantics) and outbound categorization. `forward-thread` covers escalation and handoff patterns; some vendors require constructing a new send with quoted prior bodies rather than exposing a native forward op.

## Affordance vocabulary — note on cross-primitive overlap

Several affordance names rhyme across primitives because the underlying shape is genuinely similar:

- `find-by-filter` (message-thread) ↔ `find-by-filter` (messaging-channel, structured-record-store) — structured-predicate query over the surface's records. The shape transfers; the field vocabulary varies per backing platform.
- `get-metadata` (message-thread) ↔ `get-metadata` (messaging-channel, document-store, structured-record-store) — same meaning across primitives: fetch non-body facts about a resource.
- `read-thread` (message-thread) ↔ `read-thread` (messaging-channel) — same meaning: fetch the ordered messages anchored to a thread parent.

Others are deliberately primitive-shaped:

- **`list-recent-in-mailbox` (message-thread)** vs **`list-recent-in-scope` (messaging-channel)** vs **`list-recent` (document-store, structured-record-store)** — the `-in-mailbox` suffix is load-bearing in a different way than messaging-channel's `-in-scope`: mailbox is the *cursor scope* (the operator's inbox/account), not a write target. Outbound writes are to named recipients, not to "this mailbox." Messaging-channel's `-in-scope` doubles as both read cursor scope AND write target; that conflation does not hold here.
- **`send-to-recipients` (message-thread)** vs **`post-to-scope` (messaging-channel)** vs **`create-with-mime` (document-store)** vs **`create-record` (structured-record-store)** — the affordance name carries the audience model. "Send" with recipients is a directed verb; "post" without recipients is a scope verb; "create" without either is a typed-payload verb. The vocabulary makes the audience-and-shape differences visible in compositions and audit trails.
- **`reply-in-thread` (message-thread)** vs **`post-to-thread` (messaging-channel)** — both are thread-anchored writes, but the audience semantics differ: messaging-channel's `post-to-thread` broadcasts to thread observers (anyone watching the scope sees it); message-thread's `reply-in-thread` defaults to the thread's participant list with explicit reply-all vs reply-sender as operator intent. The name change reflects the audience-default difference.
- **`create-draft`** — no analog in messaging-channel (no native drafts on chat platforms); not equivalent to document-store's "unshared document" notion. First-class across every plausible backing vendor for this primitive, and load-bearing for the destination's draftPosture contract.
- **`apply-label-state`** — rhymes in shape with messaging-channel's `react-to-message` (operator-mutable per-item state) but the *audience semantics* differ: reactions are public-to-scope; labels are private-to-mailbox. The primitive name reflects that, and the pitfalls layer treats label state as operator-readable workflow signal, not authoritative state.
- **`read-label-state`** — paired source-side primitive for the same reason. Reading label state is the canonical source-side dedupe primitive when the workflow's idempotency posture is "tag-and-skip."
- **`forward-thread`** — no analog elsewhere. Forwarding (redirecting a thread's audience while preserving prior content) is message-thread-native; scope-broadcast surfaces don't have the directed-audience-redirect operation.

The lesson encoded here: affordance vocabulary is per-primitive. Names rhyme across primitives only when the shape genuinely transfers; otherwise the names diverge to make the difference visible in compositions and audit trails.

## Cross-vendor pitfalls — what is true regardless of which MCP backs this primitive

These pitfalls hold for any message-thread surface you might bind to this primitive. Vendor-specific quirks (Gmail's 7-day history_id horizon; Outlook's delta-token lifetime; Apple Mail's flag-color enum vs Gmail's string labels; ProtonMail's encrypted-side body access constraints), if any, belong in optional `adapter/<server>.md` override files or in the capability body, not here.

1. **Audience is named recipients.** Every outbound captures to/cc/bcc explicitly. There is no implicit scope.
2. **Reply identity is the in-reply-to header.** Just having the thread id is not enough on every client; the header is what stitches replies into a single conversation.
3. **Cursor horizons are real.** Incremental-cursor reads have retention windows. Implement date-windowed re-baseline as the fallback.
4. **Self-reply loops.** Filter sender-self in source query, or persist a source-event-id custom header on outbound and dedupe at search-time.
5. **Label state is operator-mutable.** Don't trust labels as authoritative; pair label-based dedupe with a state-ledger fallback.
6. **Drafts that never get sent.** Surface stale-draft age as a workflow health signal.
7. **Subject-line PII.** Redact subjects before downstream LLM rendering — KYC's no-PII-in-summaries constraint applies.
8. **Canonical recipient identity.** Normalize email addresses before dedupe and audit; aliases and case-folding differ across clients.
9. **Attachment shape is MCP-variant.** Discover at bind time; don't hard-code base64-inline vs id+fetch.
10. **Mime multipart.** Prefer multipart/alternative with plain-text fallback; HTML-only renders fragile across clients.
11. **Send is irreversible.** Dry-run via Drafts is load-bearing, not optional. Promotion from Drafts to Sent is an explicit operator step.
12. **First-poll backfill blast.** Initialize cursor to current top-of-mailbox; surface "process prior threads?" as an opt-in step.
