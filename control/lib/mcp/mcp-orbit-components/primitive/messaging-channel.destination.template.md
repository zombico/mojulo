# Provider artifact — messaging-channel (destination role) on {{server}}

*Runtime-generated from primitive `messaging-channel@0.1.0` (destination role) and a capability snapshot of `{{server}}` introspected at `{{introspected_at}}` (snapshot confidence: `{{snapshot_confidence}}`). This artifact is session-scoped — its assertions about tool names and schemas reflect the bound MCP **at introspection time**, not curated training data.*

## Affordance bindings

| Affordance | Bound tool | Confidence |
|---|---|---|
| `post-to-scope` | `{{tool:post-to-scope}}` | `{{confidence:post-to-scope}}` |
| `post-to-thread` | `{{tool:post-to-thread}}` | `{{confidence:post-to-thread}}` |
| `find-by-filter` | `{{tool:find-by-filter}}` | `{{confidence:find-by-filter}}` |
| `react-to-message` | `{{tool:react-to-message}}` | `{{confidence:react-to-message}}` |
| `update-message` | `{{tool:update-message}}` | `{{confidence:update-message}}` |
| `upload-file-to-scope` | `{{tool:upload-file-to-scope}}` | `{{confidence:upload-file-to-scope}}` |
| `post-ephemeral` | `{{tool:post-ephemeral}}` | `{{confidence:post-ephemeral}}` |

**Unbound affordances:** {{unbound_affordances}}

## How to write to this MCP

The write pattern is: (1) resolve the operator-named scope to a scope id via the bound MCP's metadata surface, (2) decide between `post-to-scope` (new top-level message) and `post-to-thread` (reply in an existing thread) based on composition intent, (3) for compositions that fire more than once per source signal, use `find-by-filter` to search-before-post over a stable dedupe anchor before calling the post tool, (4) optionally call `react-to-message` to acknowledge the source signal as processed.

Scope every call to an operator-confirmed scope id. Posting to a scope the operator did not explicitly name is a privacy bug — the message reaches an audience the composition did not authorize.

{{if-bound:post-to-thread}}
This MCP exposes `post-to-thread` — both "broadcast to channel" and "reply in thread" patterns are available. Surface the `thread_anchor_required` knob to distinguish; reply-style compositions (responding to a source message) should anchor to the source thread, not post top-level into the channel.
{{/if-bound:post-to-thread}}
{{if-unbound:post-to-thread}}
This MCP does **not** expose `post-to-thread`. All writes go to scope top-level via `post-to-scope`. Reply-style compositions on this destination must either accept top-level broadcasts as the post pattern or bind to a different MCP that supports threading.
{{/if-unbound:post-to-thread}}

## Draft posture

Chat platforms do not have a "draft" posture for bot-posted messages — there is no Drafts folder analog. Dry-run options:

1. **Designated dry-run scope.** Post to a `#mojulo-dryrun` channel the operator provisions. Visible to the operator only; promotion is a re-run pointed at the production scope.

{{if-bound:post-ephemeral}}
2. **Ephemeral preview.** Use `post-ephemeral` to deliver a preview visible only to the operator. One-shot, not auditable, but useful for "does this look right?" confirmation before sending the real post.
{{/if-bound:post-ephemeral}}

3. **Structured render preview.** Accumulate intended posts in a structured-log render component and require explicit operator approval before calling `post-to-scope`. This is the safest posture for high-stakes compositions (e.g., outbound customer-facing notifications).

## Bound tool schemas

The following schemas are reproduced from the snapshot. Bind composition parameters to these schemas directly — do not infer parameter names from tool names, and do not assume one MCP's message-body field is named the same as another's even when they back the same platform.

### `post-to-scope` → `{{tool:post-to-scope}}`

```json
{{schema:post-to-scope}}
```

{{if-bound:post-to-thread}}
### `post-to-thread` → `{{tool:post-to-thread}}`

```json
{{schema:post-to-thread}}
```
{{/if-bound:post-to-thread}}

### `find-by-filter` → `{{tool:find-by-filter}}`

```json
{{schema:find-by-filter}}
```

{{if-bound:react-to-message}}
### `react-to-message` → `{{tool:react-to-message}}`

```json
{{schema:react-to-message}}
```
{{/if-bound:react-to-message}}

{{if-bound:update-message}}
### `update-message` → `{{tool:update-message}}`

```json
{{schema:update-message}}
```
{{/if-bound:update-message}}

{{if-bound:upload-file-to-scope}}
### `upload-file-to-scope` → `{{tool:upload-file-to-scope}}`

```json
{{schema:upload-file-to-scope}}
```
{{/if-bound:upload-file-to-scope}}

{{if-bound:post-ephemeral}}
### `post-ephemeral` → `{{tool:post-ephemeral}}`

```json
{{schema:post-ephemeral}}
```
{{/if-bound:post-ephemeral}}

## Cross-vendor pitfalls (inherited from primitive)

These hold for any messaging-channel destination, including this one. Vendor-specific quirks (Slack's mrkdwn flavor, Discord's content-vs-embeds split, Teams's adaptive cards), if any, are in `adapter/{{server}}.md` (loaded separately when present).

- **Scope is first-class.** Every post scopes to a channel/DM/thread id. Posting without an explicit scope is a privacy bug.
- **Markdown flavor is platform-specific.** Render to the bound platform's flavor — not CommonMark verbatim. The render component for this composition must target the same platform the destination binds to.
- **Mentions by id, not display name.** Resolve display names to user ids at bind time; store ids in templates. Storing `@alice` produces silent breakage when Alice changes her display name.
- **Search-before-post dedupe needs a stable anchor.** Compositions that fire more than once per source signal must include a stable identifier (the source event id, the composition ref, a hash of the payload) in the posted message so `find-by-filter` can find prior posts. A bare timestamp comparison is not enough — timestamps drift.
- **Edit history truncation.** `update-message` replaces the visible body without preserving a public history. If audit is load-bearing, persist your own log of edits — do not rely on the platform.
- **Ephemerals don't dedupe.** `post-ephemeral` messages are not retrievable after dismissal — they cannot be used as a dedupe anchor.
- **Mojulo trace in body.** Include the composition ref and source-event reference in every posted message's body (or as a structured field). Without it, an operator scrolling back through a channel cannot tell which composition produced which message.
- **First-run noise floor.** A composition that fires on every matching source event will, on first run, post once per historical match. Cap first-run output via the trigger's `first_run_window` knob.
