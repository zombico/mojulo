# Provider artifact — issue-tracker (source role) on {{server}}

*Runtime-generated from primitive `issue-tracker@0.1.0` (source role) and a capability snapshot of `{{server}}` introspected at `{{introspected_at}}` (snapshot confidence: `{{snapshot_confidence}}`). This artifact is session-scoped — its assertions about tool names and schemas reflect the bound MCP **at introspection time**, not curated training data.*

## Affordance bindings

| Affordance | Bound tool | Confidence |
|---|---|---|
| `find-by-filter` | `{{tool:find-by-filter}}` | `{{confidence:find-by-filter}}` |
| `read-content` | `{{tool:read-content}}` | `{{confidence:read-content}}` |
| `list-recent` | `{{tool:list-recent}}` | `{{confidence:list-recent}}` |
| `get-metadata` | `{{tool:get-metadata}}` | `{{confidence:get-metadata}}` |
| `subscribe-to-changes` | `{{tool:subscribe-to-changes}}` | `{{confidence:subscribe-to-changes}}` |

**Unbound affordances:** {{unbound_affordances}}

## How to read this MCP

The catch-up pattern is `list-recent` (cursor on update-time) → `get-metadata` per hit to filter by status / assignee / label → `read-content` only on hits that need full body + comments. Do not call `read-content` per hit — issue bodies and comment threads can be large, and most filtering decisions can be made on metadata alone.

For targeted queries (e.g. "open issues labeled `bug` in project `core`"), use `find-by-filter` with structured fields. The filter shape is per-tracker — discover the accepted fields from the bound tool schema below; do not assume Linear-style filters apply to GitHub or vice versa.

Scope every call to the operator-confirmed project / team / workspace. Querying the operator's whole org is the wrong default and may cross trust boundaries.

{{if-bound:subscribe-to-changes}}
This MCP exposes `subscribe-to-changes` — push delivery is available. Prefer `trigger: signal-push` over polling, but confirm the webhook is actually registered in the tracker's UI during dry-run (the MCP tool's presence does not imply the webhook is wired).
{{/if-bound:subscribe-to-changes}}
{{if-unbound:subscribe-to-changes}}
This MCP does **not** expose `subscribe-to-changes`. Compositions over this source must use `trigger: signal-polled` with the cursor field from `list-recent`, or `trigger: scheduled` with a window-key idempotency component.
{{/if-unbound:subscribe-to-changes}}

## Bound tool schemas

The following schemas are reproduced from the snapshot. Bind composition parameters to these schemas directly — do not infer parameter names from tool names, and do not assume Linear-style filter syntax works on a tracker that's actually GitHub.

### `find-by-filter` → `{{tool:find-by-filter}}`

```json
{{schema:find-by-filter}}
```

### `read-content` → `{{tool:read-content}}`

```json
{{schema:read-content}}
```

### `list-recent` → `{{tool:list-recent}}`

```json
{{schema:list-recent}}
```

{{if-bound:get-metadata}}
### `get-metadata` → `{{tool:get-metadata}}`

```json
{{schema:get-metadata}}
```
{{/if-bound:get-metadata}}

{{if-bound:subscribe-to-changes}}
### `subscribe-to-changes` → `{{tool:subscribe-to-changes}}`

```json
{{schema:subscribe-to-changes}}
```
{{/if-bound:subscribe-to-changes}}

## Cross-vendor pitfalls (inherited from primitive)

These hold for any issue-tracker source, including this one. Vendor-specific quirks, if any, are in `adapter/{{server}}.md` (loaded separately when present).

- **Closed-isn't-deleted.** When `find-by-filter` is used to detect existing issues, scope the filter by status (`open`, or the tracker's equivalent) or check status on every hit. A closed duplicate is still a duplicate, but you'll often want to file a new one anyway — make that decision explicitly, not by accident.
- **First-run backfill blast.** Bound the first run's window via the trigger's `first_run_window` knob, or scope the source filter to an updated-since cursor.
- **Read-after-write same-tracker loops.** If the destination role of this composition also binds to `{{server}}`, use a source-side label like `mojulo-touched` to exclude prior writes from the source read.
- **Issue id vs URL.** Bind dedupe and idempotency to the id field from the tool schemas above, not to URLs (URLs are stable per-environment but operators migrate environments).
- **Permission scope at project/team level.** The MCP's auth token may not cover every project the operator names verbally — probe the source scope via `find-by-filter (limit 1)` during dry-run.
