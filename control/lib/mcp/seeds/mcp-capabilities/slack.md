---
{
  "ref": "slack",
  "version": "0.1.0",
  "summary": "Slack MCP: read (channel/DM/thread history, search, user lookup), write (post, react, update, upload), no watch in current MCPs. Tool surface varies materially between the official hosted MCP (mcp.slack.com/mcp) and community implementations.",
  "requires": {
    "mcpInventoryCategory": "messaging",
    "inventoryServerHints": ["slack", "claude_ai_Slack", "slack_official", "slack-mcp-server"]
  },
  "affordances": {
    "read": true,
    "write": true,
    "watch": false
  },
  "capabilities": {
    "cursor": true,
    "cursorField": "ts",
    "pagination": "cursor (next_cursor)",
    "rateLimit": "tiered (1/2/3/4) per-method × per-workspace × per-app, plus a special tier for chat.postMessage",
    "rateLimitDetails": "Tier 1: 1+/min. Tier 2: 20+/min. Tier 3: 50+/min. Tier 4: 100+/min. chat.postMessage falls into a special tier — 1 message/sec/channel plus a workspace-wide ceiling. conversations.history and conversations.replies face stricter limits for newly-created non-Marketplace apps as of May 29, 2025. 429 responses include a Retry-After header in seconds. Events API delivery (if a future MCP exposes it) caps at 30,000 events/workspace/app/60min.",
    "writeShapes": ["chat.postMessage", "chat.postEphemeral", "chat.update", "chat.delete", "reactions.add", "files.upload"],
    "readShapes": ["conversations.history", "conversations.replies", "conversations.list", "conversations.info", "search.messages", "users.info"],
    "contentModel": "mrkdwn + Block Kit (50 blocks/message, 100 blocks/modal)",
    "requestLimits": {
      "blocksPerMessage": 50,
      "blocksPerModal": 100,
      "eventDeliveriesPerHour": 30000
    },
    "supportsDelete": true,
    "supportsDrafts": false
  },
  "intentKeywords": ["slack", "channel", "thread", "dm", "team", "ops", "support", "post", "notify", "message", "broadcast"],
  "exposesKnobs": [
    { "name": "scope_id", "prompt": "Slack scope id (e.g. 'C0123ABCD' for a public channel, 'G0123ABCD' for a private channel, 'D0123ABCD' for a DM). Audience scope is first-class — the same write tool hits radically different audiences depending on this id. Operators usually name scopes by display (#ops, @alice); resolve to ids at bind time via conversations.list / users.lookupByEmail.", "default": null },
    { "name": "match_query", "prompt": "Slack search query for source-role compositions. Supports operators: 'in:#channel', 'from:@user', 'has:link', 'has:reaction', 'before:YYYY-MM-DD', 'after:YYYY-MM-DD'. Must include at least one positive filter beyond scope membership.", "default": null },
    { "name": "exclude_self", "prompt": "Exclude messages posted by the bot's own user id to prevent reply loops. Recommended on for any composition that both reads from and posts to the same scope.", "default": true },
    { "name": "thread_anchor_required", "prompt": "When this MCP plays the destination role, must writes anchor to a thread (post-to-thread) rather than posting top-level (post-to-scope)? Recommended on for reply-style compositions; off for digests and broadcasts.", "default": false },
    { "name": "use_block_kit", "prompt": "Format outbound messages as Block Kit (richer, structured, gated on 50 blocks/message) vs plain mrkdwn (simpler, universal). Block Kit requires the render component to emit the platform's block schema; mrkdwn requires the render component to emit Slack's markdown flavor (not CommonMark).", "default": false }
  ]
}
---

# mcp: Slack

Slack is a workplace messaging surface. Its MCP surface is **bidirectional and currently web-API-only** — usable as a composition source (read history, search, user/scope metadata) and as a composition destination (post, react, update, upload). The scope (channel / DM / thread) is the operator's audience boundary; idempotency tracks at `(scope_id, ts)` or `thread_ts` granularity. One MCP, two roles, one trigger mode in practice (poll); push exists at the Slack platform level (Events API) but is **unexposed in every shipping Slack MCP today** — the official hosted MCP at `mcp.slack.com/mcp`, korotovsky/slack-mcp-server, and slackapi/slack-mcp-plugin are all web-API-only.

## Source-role surface (when `role: 'source'` in the composition)

- **Discovery calls.**
  - `conversations.history` — channel/DM history with cursor-based pagination. Returns ordered messages newest-first by default; `latest`/`oldest` ts bounds the window. Newly-created non-Marketplace apps face stricter rate limits on this method as of May 29, 2025 *(unconfirmed — confirm against current Slack changelog before relying)*.
  - `conversations.replies` — thread fetch by `(channel, thread_ts)`. Returns the parent plus all replies in order.
  - `search.messages` — full-text search across messages the bot can see. Supports `in:#channel`, `from:@user`, `has:link`, `before:`, `after:` operators. Subject to special-tier rate limits per the docs.
  - `conversations.list` — list scopes the bot has access to; used at bind time to resolve display names to ids.
  - `users.info` / `users.lookupByEmail` — resolve user ids to display names and vice versa.
- **Cursor.** Slack's cursor is the `ts` field — a unix epoch with microsecond precision encoded as a string ("1717000000.123456"). It's lexicographically and numerically ordered, monotonic per scope. **No horizon problem like Gmail's history_id** — old timestamps remain valid as cursors as long as the scope still exists. The failure mode is scope archival (archived channels can become unreadable depending on workspace settings), not cursor expiry.
- **Watch surface.** Slack's Events API supports push at the platform level (`message.channels`, `app_mention`, `reaction_added`, etc., with a 3-second response deadline and 3-retry policy on failure). **No current Slack MCP exposes Events as a tool.** Compositions over this source must use `trigger: signal-polled` with the `ts` cursor. If a future MCP exposes Events as a subscription tool, a superseding capability row should set `affordances.watch: true` and document the bound tool name.
- **Rate limit.** Tiered per-method × per-workspace × per-app. `conversations.history` is Tier 3 (50+/min) baseline; `search.messages` falls in a "special tier" with conservative limits. 429 responses include a `Retry-After` header in seconds. A reasonable poll cadence for a single channel is 30–60 seconds; for many channels, batch via a single `search.messages` query when feasible to amortize tier consumption.

### Mapping intent for source role (load-bearing)

- **Scope id is the primary key, not channel name.** Operators say "#ops"; the MCP works in `C0123ABCD`. Resolve at bind time via `conversations.list` and persist the id. Channels get renamed and the rename does not break workflows that stored the id.
- **The match query MUST include at least one positive filter beyond scope membership.** `in:#general` alone matches every message including bot posts. Require `from:`, `has:`, or text keywords. The `exclude_self` knob enforces "not from the bot's own user id" but is not sufficient by itself.
- **Thread anchor (`thread_ts`) vs message id (`ts`) are different keys.** A composition that processes threads as units stores `thread_ts` as the idempotency anchor. A composition that processes individual messages stores `(channel_id, ts)`. Mixing them produces silent duplicate processing — the same thread gets re-processed every time a new reply lands because each reply's `ts` is new.
- **Bot membership is required for private channels and (on most workspace configs) public channels too.** Probe membership during dry-run via `conversations.info` or by attempting `conversations.history` with a tiny `limit`. If 401/403, surface "invite the bot to #channel" as an explicit operator step before proceeding.
- **Reactions are mutable signals.** `reactions.get` returns the current state — not a stream of reaction events. People add, remove, and change reactions; a `✅` that was there yesterday may not be there today. Treat reaction state as soft, not authoritative.
- **Subject-line PII analog: customer names in channel messages.** Support/sales channels often contain customer names, emails, account numbers in message bodies. Compositions that forward Slack content elsewhere (digests, Linear issues, doc stores) must apply redaction at the render layer.

## Destination-role surface (when `role: 'destination'` in the composition)

- **Discovery calls.**
  - `chat.postMessage` — immediate send to a scope. Required: `channel` (scope id), and one of `text` or `blocks`. Optional: `thread_ts` (turns this into a thread reply), `reply_broadcast` (also surface the reply in the main channel feed), `unfurl_links`, `unfurl_media`. **Irreversible** in the sense that the message is immediately visible — `chat.delete` removes it but the audience may already have seen it.
  - `chat.postEphemeral` — visible to a single user only (the `user` parameter); dismissed by the user means gone forever, no retrieval. Used for transient prompts and previews.
  - `chat.update` — edits an existing message by `(channel, ts)`. Limited to messages the bot posted.
  - `chat.delete` — removes a message by `(channel, ts)`. Limited to messages the bot posted.
  - `reactions.add` — add an emoji reaction to a message by `(channel, ts, name)`. Idempotent (adding an already-present reaction is a no-op error, easily caught).
  - `files.upload` — upload a file (binary or text) into a scope, optionally with an `initial_comment` text body. Renders as a file attachment on the implicit accompanying message.
- **Required fields for post.** `channel` (scope id) and one of `text` or `blocks`. For thread replies, `thread_ts`. Most other fields are optional.
- **Dedupe surface.** Slack does NOT dedupe outbound `chat.postMessage` calls — duplicate calls produce duplicate messages. Pair this destination with `idempotency/window-key` (one composition firing per window, keyed on source-event ts) and include a stable source-event reference in the message body or a structured block so `search.messages` can find prior posts on replay. For reply workflows, use `thread_ts` to anchor the post to a specific source thread — this also gives natural visual grouping.
- **Draft posture.** Not first-class. Three workable substitutes:
  1. Post to a `#mojulo-dryrun` scope the operator provisions.
  2. `chat.postEphemeral` to the operator's own user id as a preview (one-shot, not auditable).
  3. Accumulate intended posts in a structured-log render and require explicit operator approval before sending.

### Mapping intent for destination role (load-bearing)

- **mrkdwn != standard markdown.** Slack uses `*bold*` (single asterisks), `_italic_`, `~strike~`, `<https://url|text>` (angle brackets with pipe), `> blockquote`. Render layers must target mrkdwn explicitly — rendering CommonMark verbatim produces visibly mangled output (literal `**` text, `[]` and `()` characters in body).
- **Mentions by user id.** `<@U123>` is the only stable mention form. Storing `@alice` in templates produces silent breakage when Alice's display name changes. Resolve `email → user_id` (via `users.lookupByEmail`) or `display → user_id` (via `users.list` filter) at bind time; persist the id.
- **Block Kit gates on 50 blocks/message.** Compositions that render a long thread or large digest into Block Kit can exceed this. Choose between (a) clipping to 50 blocks with a "...truncated" footer, (b) splitting across multiple messages, or (c) falling back to mrkdwn (no block limit) when the structured shape isn't load-bearing.
- **Include a stable source-event reference.** Persist the source event's reference (source URL, event id, composition ref) in the posted message body — either inline (as a footer line) or as a Block Kit context block. Without it, `search.messages`-based dedupe on replay can't reliably find prior posts.
- **Reply workflows anchor on `thread_ts`.** When responding to an inbound source message, set `thread_ts` to the source message's `ts` (or its `thread_ts` if the source is itself a thread reply). This keeps the response visually grouped with the trigger and provides natural idempotency.
- **Reactions as acknowledgement after-write.** A common pattern: after posting a response to a source signal, `reactions.add` a 🤖 (or composition-specific emoji) to the source message. This (a) gives visual feedback to channel observers that the bot acted, (b) provides a future source-side dedupe key (search for messages WITHOUT the 🤖 reaction).

## Watch-role usage

**Not currently bound.** Slack's Events API supports push at the platform level — including `message.channels`, `message.im`, `app_mention`, `reaction_added`, `reaction_removed`, `file_created`, `team_join`, and more — with a 3-second handler response deadline and a 3-retry policy (nearly immediate, +1 minute, +5 minutes). Apps face temporary disabling if they fail more than 5% of events in a 60-minute window (with a ≥1000-event floor). Events API delivery caps at 30,000 events per workspace per app per 60 minutes.

None of this is reachable through current Slack MCPs as a tool — they're all web-API-only. If a future MCP exposes Events as a subscription tool, the appropriate move is: (1) re-run the `research-mcp-vendor` catalyst against that MCP, (2) record a new capability row with `affordances.watch: true` and `subscribe-to-messages`/`subscribe-to-reactions` bindings in the body, (3) the prior current row auto-supersedes. Until then, compositions over Slack use `trigger: signal-polled` over the `ts` cursor.

## Pitfalls (apply across roles)

- **`chat.postMessage` 1-message/sec/channel cliff.** A burst of posts to the same channel WILL hit the special-tier rate limit. Batch-or-throttle outbound writes; for digest workflows, prefer one structured message with multiple blocks over N separate messages.
- **`conversations.history` rate-limit shift (May 29, 2025).** Newly-created non-Marketplace apps face stricter limits on this method — exact numbers not in the rate-limits doc *(unconfirmed)*. Existing apps grandfathered to prior limits per the docs. If a composition's polling cadence is suddenly hitting 429s and the bound MCP was registered after this date, this is the likely cause.
- **Tool name divergence across MCPs.** The official hosted MCP at `mcp.slack.com/mcp` (slackapi/slack-mcp-plugin) describes capabilities ("Read channel history", "Send messages") rather than exposing snake_case tools; community implementations like korotovsky/slack-mcp-server expose `conversations_history`, `conversations_add_message`, `conversations_search_messages`. The capability row's `readShapes`/`writeShapes` lists Slack Web API method names as semantic anchors; the generator's bind-time discovery resolves them to whatever the bound MCP actually exposes. **Compositions must not hard-code MCP tool names.**
- **Browser-token (xoxc/xoxd) posture.** Korotovsky's MCP supports xoxc/xoxd tokens extracted from a browser session — the "no app installation, no admin approval" path. This is technically against Slack's TOS, the tokens rotate on session changes (silently breaking the MCP), and the resulting bot identity is the user's identity (every post and reaction appears to come from a real human). Acceptable for personal experimentation; do not use for production workflows. Prefer `xoxb` bot tokens (requires creating a Slack app + workspace admin approval) or the official hosted MCP (OAuth-mediated, admin-managed).
- **Reply loops from self-replies.** A composition that reads inbound messages and posts outbound replies WILL loop if the bot's own replies match the source query. The `exclude_self` knob is on by default; turning it off requires explicit operator override in the composition intent.
- **Block Kit 50-block ceiling.** Compositions rendering long content (extracted thread digests, multi-section reports) into blocks WILL hit this. Decide ceiling-handling at composition-bind time, not at runtime.
- **Ephemeral messages don't audit.** `chat.postEphemeral` posts are not retrievable after the user dismisses them. Don't use them for state-carrying purposes (e.g., "I posted an approval prompt yesterday, let me check if they responded" — there is no such check).
- **Edit history truncation.** `chat.update` replaces the visible body. Slack does show an "edited" indicator but doesn't preserve a public history of prior versions. Compositions that audit-trail their edits must persist their own log.
- **Subject-line analog: channel names with sensitive context.** Channel names like `#customer-acme-incident-q3` themselves leak business context. When compositions forward Slack content elsewhere (digests, doc stores, Linear), the channel name should be redacted or replaced with a scope id depending on the receiving audience.
- **Workspace boundary.** Slack auth tokens are scoped to a single workspace. Multi-workspace compositions need one MCP binding per workspace; the composer should treat each workspace's `slack` MCP as a separate inventory entry.

## Tool-name divergence note

Slack's MCP ecosystem is fragmented across at least three current shapes:

| Implementation | Tool naming | Auth | Push |
|---|---|---|---|
| Official hosted (`mcp.slack.com/mcp`) | Capabilities by description ("Read channel history") | OAuth, workspace admin approval | No |
| korotovsky/slack-mcp-server | Underscored snake (`conversations_history`, `conversations_add_message`) | xoxc/xoxd browser, xoxp user, xoxb bot | No |
| slackapi/slack-mcp-plugin | Same as official hosted | OAuth | No |

The capability row's `readShapes`/`writeShapes` lists Slack Web API method names (`conversations.history`, `chat.postMessage`) as semantic anchors. The generator's bind-time discovery resolves them to whatever the bound MCP actually exposes by introspecting the MCP's tool list. **Compositions must not hard-code MCP tool names** — they must reference affordance names from the primitive, which the generator binds to MCP tool names at composition time.

<!-- sources
  - https://docs.slack.dev/ai/slack-mcp-server/ (official Slack hosted MCP overview)
  - https://github.com/slackapi/slack-mcp-plugin (official MCP config repo)
  - https://github.com/korotovsky/slack-mcp-server (community Slack MCP, v1.3.0 released 2026-05-14)
  - https://docs.slack.dev/reference/methods (Web API method index)
  - https://docs.slack.dev/apis/web-api/rate-limits (tier model, chat.postMessage special tier, conversations.history May 29 2025 note)
  - https://docs.slack.dev/apis/events-api/ (Events API: 3-second deadline, retry policy, 30k/hour delivery cap)
  - https://docs.slack.dev/messaging/formatting-message-text (mrkdwn syntax: *bold*, _italic_, ~strike~, <url|text>, > blockquote)
  - https://docs.slack.dev/block-kit/ (Block Kit: 50 blocks/message, 100 blocks/modal)
-->
