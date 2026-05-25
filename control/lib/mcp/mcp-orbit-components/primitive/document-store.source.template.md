# Provider artifact — document-store (source role) on {{server}}

*Runtime-generated from primitive `document-store@0.1.0` (source role) and a capability snapshot of `{{server}}` introspected at `{{introspected_at}}` (snapshot confidence: `{{snapshot_confidence}}`). This artifact is session-scoped — its assertions about tool names and schemas reflect the bound MCP **at introspection time**, not curated training data.*

## Affordance bindings

| Affordance | Bound tool | Confidence |
|---|---|---|
| `find-by-key-in-scope` | `{{tool:find-by-key-in-scope}}` | `{{confidence:find-by-key-in-scope}}` |
| `read-content` | `{{tool:read-content}}` | `{{confidence:read-content}}` |
| `list-recent` | `{{tool:list-recent}}` | `{{confidence:list-recent}}` |
| `get-metadata` | `{{tool:get-metadata}}` | `{{confidence:get-metadata}}` |
| `subscribe-to-changes` | `{{tool:subscribe-to-changes}}` | `{{confidence:subscribe-to-changes}}` |

**Unbound affordances:** {{unbound_affordances}}

## How to read this MCP

The catch-up pattern is `list-recent` → for each new item, `get-metadata` to filter, then `read-content` on items that pass the filter. The cursor is exposed by the `list-recent` tool's input or output — discover the cursor field by inspecting the tool schema below; do not assume a name like `modifiedTime` or `updatedAt` without confirming.

For targeted lookups (e.g. "find this week's digest by title in this folder"), use `find-by-key-in-scope`. For all reads, scope to the operator-confirmed folder/label/prefix — reading the operator's whole namespace is the wrong default and may cross trust boundaries.

{{if-bound:subscribe-to-changes}}
This MCP exposes `subscribe-to-changes` — push delivery is available. Prefer `trigger: signal-push` over polling.
{{/if-bound:subscribe-to-changes}}
{{if-unbound:subscribe-to-changes}}
This MCP does **not** expose `subscribe-to-changes`. Compositions over this source must use `trigger: signal-polled` with the cursor field from `list-recent`, or `trigger: scheduled` with a window-key idempotency component.
{{/if-unbound:subscribe-to-changes}}

## Bound tool schemas

The following schemas are reproduced from the snapshot. Bind composition parameters to these schemas directly — do not infer parameter names from tool names.

### `find-by-key-in-scope` → `{{tool:find-by-key-in-scope}}`

```json
{{schema:find-by-key-in-scope}}
```

### `read-content` → `{{tool:read-content}}`

```json
{{schema:read-content}}
```

### `list-recent` → `{{tool:list-recent}}`

```json
{{schema:list-recent}}
```

### `get-metadata` → `{{tool:get-metadata}}`

```json
{{schema:get-metadata}}
```

{{if-bound:subscribe-to-changes}}
### `subscribe-to-changes` → `{{tool:subscribe-to-changes}}`

```json
{{schema:subscribe-to-changes}}
```
{{/if-bound:subscribe-to-changes}}

## Cross-vendor pitfalls (inherited from primitive)

These hold for any document-store source, including this one. Vendor-specific quirks, if any, are in `adapter/{{server}}.md` (loaded separately when present).

- **Soft-delete retention.** When `find-by-key-in-scope` returns results, filter trashed items before treating a hit as an existing document. Check the tool's response schema above for a `trashed` / `deleted` / `inTrash` field.
- **Fuzzy search.** Treat `find-by-key-in-scope` results as candidates, not exact matches. Confirm the title or id matches the expected key before using.
- **First-run backfill blast.** Bound the first run's window explicitly via the trigger component's `first_run_window` knob. The cursor's epoch is not "the start of time."
- **Read-after-write same-scope loops.** If the destination role of this composition also binds to `{{server}}` in the same scope, use a source-side label to exclude mojulo-created files, or restrict the source read scope to exclude the destination folder.
- **Identifier instability.** Bind dedupe and idempotency to the id field from the tool schemas above, not to titles or paths.
