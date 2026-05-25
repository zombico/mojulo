# Provider artifact — messaging-channel (source role) on {{server}}

*Runtime-generated from primitive `messaging-channel@0.1.0` (source role) and a capability snapshot of `{{server}}` introspected at `{{introspected_at}}` (snapshot confidence: `{{snapshot_confidence}}`). This artifact is session-scoped — its assertions about tool names and schemas reflect the bound MCP **at introspection time**, not curated training data.*

## Affordance bindings

| Affordance | Bound tool | Confidence |
|---|---|---|
| `list-recent-in-scope` | `{{tool:list-recent-in-scope}}` | `{{confidence:list-recent-in-scope}}` |
| `read-thread` | `{{tool:read-thread}}` | `{{confidence:read-thread}}` |
| `find-by-filter` | `{{tool:find-by-filter}}` | `{{confidence:find-by-filter}}` |
| `get-metadata` | `{{tool:get-metadata}}` | `{{confidence:get-metadata}}` |
| `subscribe-to-messages` | `{{tool:subscribe-to-messages}}` | `{{confidence:subscribe-to-messages}}` |
| `subscribe-to-reactions` | `{{tool:subscribe-to-reactions}}` | `{{confidence:subscribe-to-reactions}}` |

**Unbound affordances:** {{unbound_affordances}}

## How to read this MCP

The catch-up pattern is `list-recent-in-scope` (cursor on message timestamp) → for each new message, decide whether it needs thread context (call `read-thread` on the parent ts) or stands alone. Use `find-by-filter` for targeted queries — "messages in #ops from @alice since YYYY-MM-DD," "messages mentioning <@U123>" — when the workflow is reactive rather than scanning.

Scope every call to an operator-confirmed scope id (channel id, DM id, thread parent ts). Operators name scopes by display name (#ops, @alice); resolve display name → id at bind time via `get-metadata` and persist the id. Reading the operator's entire messaging surface is the wrong default and may cross trust boundaries.

{{if-bound:subscribe-to-messages}}
This MCP exposes `subscribe-to-messages` — push delivery is available for new messages. Prefer `trigger: signal-push` over polling. Confirm the push channel (Slack Events subscription, Discord Gateway connection, etc.) is actually wired during dry-run — the MCP tool's presence does not imply the underlying subscription is established.
{{/if-bound:subscribe-to-messages}}
{{if-unbound:subscribe-to-messages}}
This MCP does **not** expose `subscribe-to-messages`. Compositions over this source must use `trigger: signal-polled` with the timestamp cursor from `list-recent-in-scope`. Polling cadence is operator-chosen; default to a value the bound MCP's rate limits comfortably tolerate.
{{/if-unbound:subscribe-to-messages}}

{{if-bound:subscribe-to-reactions}}
This MCP also exposes `subscribe-to-reactions` — reaction events can serve as composition triggers (e.g., a 👀 reaction marks a message for triage). Treat reaction state as operator-mutable; a removed reaction is not a delete signal.
{{/if-bound:subscribe-to-reactions}}

## Bound tool schemas

The following schemas are reproduced from the snapshot. Bind composition parameters to these schemas directly — do not infer parameter names from tool names, and do not assume one MCP's filter syntax works on another even when both back the same platform.

### `list-recent-in-scope` → `{{tool:list-recent-in-scope}}`

```json
{{schema:list-recent-in-scope}}
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

{{if-bound:subscribe-to-messages}}
### `subscribe-to-messages` → `{{tool:subscribe-to-messages}}`

```json
{{schema:subscribe-to-messages}}
```
{{/if-bound:subscribe-to-messages}}

{{if-bound:subscribe-to-reactions}}
### `subscribe-to-reactions` → `{{tool:subscribe-to-reactions}}`

```json
{{schema:subscribe-to-reactions}}
```
{{/if-bound:subscribe-to-reactions}}

## Cross-vendor pitfalls (inherited from primitive)

These hold for any messaging-channel source, including this one. Vendor-specific quirks (Slack's thread_ts vs ts distinction, Discord's snowflake ordering, Teams's adaptive-card-only content), if any, are in `adapter/{{server}}.md` (loaded separately when present).

- **Scope is first-class.** Every read scopes to a channel/DM/thread id. Reading "everything" is the wrong default — both privacy-wise and rate-limit-wise.
- **Cursor field.** The cursor field is exposed by `list-recent-in-scope`'s schema above. Do not assume the field is named `ts`, `timestamp`, `id`, or `cursor` — discover from the schema.
- **Thread vs message identity.** Thread parent id and individual message id are different keys. If the workflow processes threads as units, idempotency anchors on the thread parent — not on each reply's id.
- **Bot must be in scope.** For private scopes (and on most platforms public scopes too), the bot identity must be a member before list/read calls succeed. Probe scope membership via `get-metadata` in dry-run; surface 'invite the bot to #channel' as an explicit operator step when membership is missing.
- **First-poll backfill blast.** Initialize the cursor to the current timestamp on first run. The cursor's epoch is not "the start of the scope's history."
- **Mention disambiguation.** Messages containing @-mentions in body text reference user ids in raw form (e.g., `<@U123>`). Resolve to display names via `get-metadata` only at render time — never store display names as the canonical user reference.
