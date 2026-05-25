# Provider artifact — message-thread (destination role) on {{server}}

*Runtime-generated from primitive `message-thread@0.1.0` (destination role) and a capability snapshot of `{{server}}` introspected at `{{introspected_at}}` (snapshot confidence: `{{snapshot_confidence}}`). This artifact is session-scoped — its assertions about tool names and schemas reflect the bound MCP **at introspection time**, not curated training data.*

## Affordance bindings

| Affordance | Bound tool | Confidence |
|---|---|---|
| `send-to-recipients` | `{{tool:send-to-recipients}}` | `{{confidence:send-to-recipients}}` |
| `reply-in-thread` | `{{tool:reply-in-thread}}` | `{{confidence:reply-in-thread}}` |
| `create-draft` | `{{tool:create-draft}}` | `{{confidence:create-draft}}` |
| `find-by-filter` | `{{tool:find-by-filter}}` | `{{confidence:find-by-filter}}` |
| `apply-label-state` | `{{tool:apply-label-state}}` | `{{confidence:apply-label-state}}` |
| `forward-thread` | `{{tool:forward-thread}}` | `{{confidence:forward-thread}}` |

**Unbound affordances:** {{unbound_affordances}}

## How to write to this MCP

The write pattern is: (1) resolve operator-named recipients to canonical email addresses (lowercase, no `+tag` suffix), (2) decide between `send-to-recipients` (new outbound to fresh recipients) and `reply-in-thread` (continue an existing conversation, audience defaults to thread participants), (3) for compositions that fire more than once per source signal, use `find-by-filter` to search the Sent folder for prior outbound carrying the same `X-Mojulo-Source-Ref` header before calling the send tool, (4) optionally call `apply-label-state` after a successful send to tag the thread as processed.

For reply-style compositions, the in-reply-to header (and the matching thread id) is what stitches the reply into the conversation in recipient clients. Do not assume that posting with the thread id alone is enough — the in-reply-to anchor matters, especially on Outlook clients.

Recipient address validity is best-effort. The MCP will not block sends to typo'd addresses (`alce@domain.com` instead of `alice@domain.com`); those bounce back to the operator's inbox as bounces. For high-stakes outbound, validate recipient addresses against an operator-confirmed list or against the source-thread's participant list before sending.

{{if-bound:reply-in-thread}}
This MCP exposes `reply-in-thread` — thread-anchored replies are available. Reply-style compositions (responding to a source message) should anchor to the source thread, not start a new outbound via `send-to-recipients`. Surface the `reply_all_vs_sender` knob to distinguish whether the reply audience is the full thread participant list or just the original sender.
{{/if-bound:reply-in-thread}}
{{if-unbound:reply-in-thread}}
This MCP does **not** expose a distinct `reply-in-thread` — all sends route through `send-to-recipients`. Replies must be constructed by passing the thread id and the in-reply-to header explicitly via `send-to-recipients`'s optional fields. Check that schema for an `inReplyToId` / `threadId` / equivalent parameter before composing reply-style workflows.
{{/if-unbound:reply-in-thread}}

## Draft posture

This primitive treats `create-draft` as **first-class** — the canonical dry-run posture. Unlike messaging-channel, where draft posture has to be improvised, message-thread surfaces nearly always expose a native Drafts folder.

1. **Drafts folder.** Write the intended send to Drafts via `create-draft`. The operator reviews in the native client (Gmail / Outlook / Apple Mail UI) and manually promotes to Sent. This is the safest posture for outbound to external recipients.
2. **Self-send dry-run.** For composition development, send a real outbound to the operator's own address. Auditable but produces inbox clutter.
3. **Label-tagged immediate send.** For workflows where the operator wants "send immediately, but auditably," pair `send-to-recipients` with `apply-label-state` to tag the outbound thread with the composition's source-ref. This is not a dry-run; it is an audit posture.

**Send is irreversible.** Recall features on some clients (Outlook's "recall this message") are best-effort and recipient-cooperative. For any composition that sends to external recipients in its first execution, default to draft-then-confirm.

{{if-unbound:create-draft}}
This MCP does **not** expose `create-draft`. The canonical dry-run posture is unavailable on this binding. Fall back to: (a) a structured-render preview component that accumulates intended sends and requires operator approval, or (b) self-send dry-run to the operator's own address, or (c) refuse to compose dry-run for this destination and require the operator to acknowledge the irreversibility.
{{/if-unbound:create-draft}}

## Bound tool schemas

The following schemas are reproduced from the snapshot. Bind composition parameters to these schemas directly — do not infer parameter names from tool names, and do not assume one mail MCP's body field is named the same as another's even when they back the same platform.

### `send-to-recipients` → `{{tool:send-to-recipients}}`

```json
{{schema:send-to-recipients}}
```

{{if-bound:reply-in-thread}}
### `reply-in-thread` → `{{tool:reply-in-thread}}`

```json
{{schema:reply-in-thread}}
```
{{/if-bound:reply-in-thread}}

{{if-bound:create-draft}}
### `create-draft` → `{{tool:create-draft}}`

```json
{{schema:create-draft}}
```
{{/if-bound:create-draft}}

### `find-by-filter` → `{{tool:find-by-filter}}`

```json
{{schema:find-by-filter}}
```

{{if-bound:apply-label-state}}
### `apply-label-state` → `{{tool:apply-label-state}}`

```json
{{schema:apply-label-state}}
```
{{/if-bound:apply-label-state}}

{{if-bound:forward-thread}}
### `forward-thread` → `{{tool:forward-thread}}`

```json
{{schema:forward-thread}}
```
{{/if-bound:forward-thread}}

## Cross-vendor pitfalls (inherited from primitive)

These hold for any message-thread destination, including this one. Vendor-specific quirks (Gmail's mrkdwn-free body model, Outlook's adaptive-card support, ProtonMail's body-encryption constraints), if any, are in `adapter/{{server}}.md` (loaded separately when present).

- **Audience is named recipients.** Every send captures to/cc/bcc explicitly. There is no "channel" stand-in — mis-addressing leaks to the wrong human.
- **Reply identity is the in-reply-to header.** For thread continuity in recipient clients, set the in-reply-to anchor in addition to the thread id. Some clients (Outlook) are strict about this.
- **Send is irreversible.** Default to drafts for dry-run; promotion is an explicit operator step.
- **Search-before-send needs a stable anchor.** Include a custom header (`X-Mojulo-Source-Ref: <source-uri>`) on every outbound so `find-by-filter` against the Sent folder can find prior sends. Subject lines drift; date matching is unreliable; the header is the stable key.
- **Subject lines should NOT pull customer body content.** Subjects appear in inbox previews and forwarded threads. Use a stable template naming the source event, not quoted source content. PII redaction applies.
- **Canonical recipient identity.** Normalize before dedupe and audit. `Alice@DOMAIN.com` and `alice+tag@domain.com` are the same recipient for dedupe purposes; do not treat the raw input string as the key.
- **Mime multipart.** Prefer multipart/alternative with plain-text and HTML; HTML-only renders fragile across recipient clients. The bound send tool may construct this for you or may require explicit construction.
- **Label application after send.** Tag the outbound thread with `apply-label-state` *after* the send completes — if the send fails, the label is not orphaned; if the label fails after a successful send, the message is already delivered (acceptable; label failure is non-critical).
- **Mention / @-references.** If the body content references operator-internal aliases, resolve to canonical email addresses at compose time. Storing `@alice` in a template breaks silently when Alice's address changes.
- **Drafts that never get sent.** Compositions that dry-run via `create-draft` can accumulate stale drafts when the operator forgets to confirm. Surface "drafts pending approval > N days" as a workflow health signal; offer "discard stale drafts" as a manual step.
- **First-run noise floor.** A composition that fires on every source signal will, on first run, send once per historical match. Cap first-run output via the trigger's `first_run_window` knob, or scope the source filter to a recent date window.
