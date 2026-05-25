---
{
  "ref": "messaging-channel",
  "version": "0.1.0",
  "summary": "Primitive: a scope-addressable messaging surface where posts are ordered, ephemeral by default, and grouped into threads. Backed by Slack, Discord, Microsoft Teams, Mattermost, Matrix.",
  "affordances": {
    "source": [
      { "name": "list-recent-in-scope", "support": "expected", "summary": "Fetch recent messages from a channel/DM/thread scope with a timestamp cursor." },
      { "name": "read-thread", "support": "expected", "summary": "Fetch all replies in a thread by parent timestamp / parent message id." },
      { "name": "find-by-filter", "support": "expected", "summary": "Search messages by query — text, user, channel, time range." },
      { "name": "get-metadata", "support": "likely", "summary": "Return non-body metadata: channel info, member list, user profiles. Required to resolve operator-named scopes (#ops) to ids." },
      { "name": "subscribe-to-messages", "support": "rare", "summary": "Push notification on new messages in scope. Surfaces in MCPs that wrap a platform push protocol (Slack Events API, Discord Gateway); most MCPs are web-API-only today." },
      { "name": "subscribe-to-reactions", "support": "rare", "summary": "Push notification on reactions added/removed. Same coverage as subscribe-to-messages — uneven across MCPs." }
    ],
    "destination": [
      { "name": "post-to-scope", "support": "expected", "summary": "Post a new message to a channel/DM scope. The most basic write affordance." },
      { "name": "post-to-thread", "support": "expected", "summary": "Reply in a thread by parent timestamp. Same shape as post-to-scope plus thread anchor; on most platforms it is the same underlying tool with a thread parameter." },
      { "name": "find-by-filter", "support": "expected", "summary": "Used for search-before-post dedupe. Same contract as the source-role variant." },
      { "name": "react-to-message", "support": "likely", "summary": "Add an emoji reaction to an existing message — lightweight acknowledgement signal." },
      { "name": "update-message", "support": "likely", "summary": "Edit a previously posted message in place. Most chat platforms allow this only for messages the bot itself authored." },
      { "name": "upload-file-to-scope", "support": "likely", "summary": "Upload a file (image, doc, snippet) into a scope. May render as an attachment on a message." },
      { "name": "post-ephemeral", "support": "likely", "summary": "Post a message visible to only one user in a scope. Not retrievable after dismissal — transient by design." }
    ]
  },
  "pitfalls": [
    "Scope is first-class. A channel id, a DM id, and a thread anchor are three different audiences. Compositions MUST capture audience scope explicitly; 'post to a channel' without scoping is a privacy bug, not a missing default.",
    "Reactions as signals are operator-mutable. People use ✅/👀/❌ as workflow primitives but the same person can change or remove their reaction at any time. subscribe-to-reactions is a legitimate trigger, but treat it like Gmail's labels — operator-mutable, not authoritative state.",
    "Push affordances exist on the underlying platform but are uneven on MCPs. Chat platforms have push protocols (Events API, Gateway, webhooks), but most shipping MCPs are web-API-only. Don't assume subscribe-to-messages is bound just because the platform has push. Probe at bind time; fall back to signal-polled over the timestamp cursor.",
    "Thread vs message identity. Thread parent timestamp ('thread_ts' in Slack, parent message id elsewhere) and individual message timestamp ('ts') are different identifiers. Idempotency in thread-scoped compositions anchors on the thread parent; idempotency in scope-scoped compositions anchors on (scope_id, message_ts). Mixing them produces silent duplicate posts.",
    "Ephemeral messages don't persist. Posts made via post-ephemeral are not retrievable after the user dismisses them — they cannot be used for search-before-post dedupe. Use post-ephemeral only for transient prompts, never as a state-carrying surface.",
    "Edit-history truncation. update-message replaces the visible body but most chat platforms don't preserve a public history. Compositions that audit-trail their own writes must persist their own log; don't rely on the platform's edit history for audit.",
    "Mention syntax is platform-specific and IDs are the only stable form. Slack uses <@U123>, Discord uses <@user_id>, Teams uses adaptive cards. Compositions that mention a user must resolve display name → user id via get-metadata before posting; storing @display-name in templates produces silent breakage when users change names.",
    "Markdown is not standard markdown. Chat platforms use bespoke flavors (Slack's mrkdwn: *bold* not **bold**, <url|text> not [text](url); Discord's flavor differs again). Render layers must target the bound platform's flavor; rendering CommonMark verbatim produces visibly mangled output.",
    "Bot must be in scope to read it. For private channels and (on most platforms) public channels too, the bot identity must be a member of the scope before list-recent-in-scope or read-thread succeeds. Probe scope membership in dry-run via get-metadata; surface 'invite the bot to #channel' as an explicit operator step when missing.",
    "First-poll backfill blast. The first poll with no cursor will sweep the entire scope history matching the filter. Initialize the cursor to the current timestamp on first run; surface 'do you also want to process prior history?' as an opt-in step, not automatic.",
    "Scope id vs scope name. Operators identify scopes by name (#ops, @alice); MCPs work in stable ids. Resolve name → id at bind time via get-metadata and persist the id, not the name — names get renamed, ids don't."
  ],
  "rolePairings": {
    "source": {
      "cursorAffordance": "list-recent-in-scope",
      "cursorFieldHint": "timestamp ('ts' in Slack, snowflake id in Discord — discover from the bound tool's schema)",
      "preferredTriggers": ["signal-polled", "signal-push"]
    },
    "destination": {
      "dedupeAffordance": "find-by-filter",
      "draftPosture": "Chat platforms don't have 'draft' as a native posture for bot-posted messages — there is no Drafts folder analog. Dry-run options: (a) post to a designated #mojulo-dryrun scope the operator provisions, (b) post-ephemeral to the operator's own user id (one-shot, not auditable), or (c) accumulate intended posts to a structured-log render and require explicit operator approval before sending."
    }
  }
}
---

# primitive: messaging-channel

A `messaging-channel` is a scope-addressable messaging surface where posts are **ordered**, **ephemeral by default**, and **grouped into threads**. The defining shape is **audience-scoped writes**: every message goes to a scope (channel, DM, or thread), and that scope determines who can see it — there is no global namespace and no per-recipient addressing.

This is the curated, vendor-agnostic shape. The integration specifics — which tool name satisfies which affordance, what the cursor field is actually called, what the search query syntax is, what the message format flavor is — come from the runtime-introspected provider artifact built from the operator's installed MCP. This body teaches the shape; the generator fills the specifics.

## When this primitive fits

- The workflow's source role watches a channel or DM for incoming signals — keywords, mentions, reactions, file uploads — and extracts them as composition triggers.
- The workflow's destination role posts notifications, digests, or status updates into an operator-named scope, with threading or reactions for structured acknowledgement.
- Audience scope is meaningful to the workflow — "post to #ops" and "DM @alice" are categorically different operations the operator distinguishes intentionally.
- Idempotency anchors on `(scope_id, message_ts)` for scope-level dedupe or on `thread_ts` for thread-level dedupe.

## When it doesn't fit

- The workflow needs durable named artifacts with folder organization (`document-store` — Drive, Notion docs).
- The workflow needs typed records with structured queries — issue trackers, CRMs, or spreadsheet-databases (`structured-record-store` — Linear, GitHub Issues, HubSpot, Airtable).
- The workflow needs directed mail semantics where audience is *named recipients* and threads grow by reply (`message-thread` — Gmail, Outlook). The audience model differs: messaging-channel is scope-broadcast with self-selecting audience; message-thread is recipient-directed with reply-tree audience.

## Affordance map summary

Source role uses `list-recent-in-scope` (cursor on timestamp) as the catch-up read pattern, `read-thread` for fetching sub-conversations, `find-by-filter` for targeted queries, and `get-metadata` for scope/user resolution. `subscribe-to-messages` and `subscribe-to-reactions` are rare on shipping MCPs — even when the underlying platform supports push, the MCP layer rarely exposes it as a tool. Compositions fall back to `trigger: signal-polled` over the cursor field.

Destination role uses `post-to-scope` for top-level posts and `post-to-thread` for replies — on most platforms these are the same underlying tool with a thread parameter, but the primitive splits them because the operator's intent ("notify channel" vs "reply in thread") is genuinely different. Dedupe uses `find-by-filter` for search-before-post. Auxiliary writes — `react-to-message`, `update-message`, `upload-file-to-scope`, `post-ephemeral` — cover acknowledgement, correction, attachment, and transient-prompt patterns.

## Affordance vocabulary — note on cross-primitive overlap

Several affordance names rhyme across primitives because the underlying shape is genuinely similar:

- `find-by-filter` (messaging-channel) ↔ `find-by-filter` (structured-record-store) — both are structured-field queries with scope + predicates. The shape transfers; the field vocabulary varies per backing platform.
- `get-metadata` (messaging-channel) ↔ `get-metadata` (document-store, structured-record-store) — same meaning across primitives: fetch non-body facts about a resource.

Others are deliberately primitive-shaped:

- **`list-recent-in-scope` (messaging-channel)** vs **`list-recent` (document-store, structured-record-store)** — the `-in-scope` suffix is load-bearing: messaging-channel reads require a scope id, unlike document-store's "list recent across this folder" or structured-record-store's "list recent across this project / table / pipeline." Listing across the operator's entire messaging surface is a different category of operation (most platforms require it via a search method, not a list method) and is intentionally not part of this primitive's affordance map.
- **`post-to-scope`** vs `create-with-mime` (document-store) vs `create-record` (structured-record-store) — chat messages are not mime-typed documents and not typed records with workflows. They're ordered, addressed-by-scope, optionally-threaded posts. The affordance name reflects that.
- **`react-to-message`**, **`subscribe-to-reactions`** — no analog in document-store or structured-record-store. Reactions are messaging-channel-native; the primitive names them explicitly because they're a real source-side signal surface, not a vestigial UI affordance.
- **`post-ephemeral`** — no analog elsewhere. Ephemerals are a chat-specific affordance with non-trivial pitfalls (no audit trail, no dedupe surface) that the primitive must teach.

The lesson encoded here: affordance vocabulary is per-primitive. Names rhyme across primitives only when the shape genuinely transfers; otherwise the names diverge to make the difference visible in compositions and audit trails.

## Cross-vendor pitfalls — what is true regardless of which MCP backs this primitive

These pitfalls hold for any messaging channel you might bind to this primitive. Vendor-specific quirks (Slack's mrkdwn flavor; Discord's snowflake ids; Teams's adaptive cards; Slack's thread_ts horizon behavior) belong in optional `adapter/<server>.md` override files, not here.

1. **Scope is first-class.** Compositions capture audience scope explicitly — 'post to a channel' without scoping is a privacy bug.
2. **Reactions are operator-mutable.** Treat reaction-driven signals as soft state, not authoritative.
3. **Push affordances are uneven on MCPs.** Even when the platform has Events / Gateway / webhooks, the MCP layer rarely exposes them. Probe; fall back to polling.
4. **Thread vs message identity.** Thread parent id and individual message id are different keys. Idempotency must pick one explicitly per composition.
5. **Ephemeral messages don't persist.** Don't use them as state-carrying surfaces.
6. **Edit history truncation.** Persist your own audit log for compositions that update messages.
7. **Mentions by id, not display name.** Resolve names → ids at bind time; store ids.
8. **Markdown flavor is platform-specific.** Render to the bound platform's flavor; CommonMark verbatim mangles.
9. **Bot must be in scope.** Probe membership in dry-run; surface invite-the-bot as an explicit step.
10. **First-poll backfill blast.** Initialize cursor to current timestamp; surface "process prior history?" as opt-in.
11. **Scope ids over scope names.** Resolve and persist ids — names get renamed.
