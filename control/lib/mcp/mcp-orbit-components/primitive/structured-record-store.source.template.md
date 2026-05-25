# Provider artifact — structured-record-store (source role) on {{server}}

*Runtime-generated from primitive `structured-record-store@0.1.0` (source role) and a capability snapshot of `{{server}}` introspected at `{{introspected_at}}` (snapshot confidence: `{{snapshot_confidence}}`). This artifact is session-scoped — its assertions about tool names and schemas reflect the bound MCP **at introspection time**, not curated training data.*

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

The catch-up pattern is `list-recent` (cursor on update-time) → `get-metadata` per hit to filter by status / owner / labels / custom fields → `read-content` only on hits that need the full field payload (and, where the backend supports them, associated comments / activities / attachments). Do not call `read-content` per hit — record payloads can be large, especially on backends that bundle comment threads or activity logs into the read response, and most filtering decisions can be made on metadata alone.

For targeted queries (e.g. "open records assigned to alice@" or "deals in stage `negotiation` updated this week"), use `find-by-filter` with structured fields. The filter shape is per-backend — discover the accepted fields from the bound tool's input schema below; do not assume Linear-style filters apply to HubSpot or Airtable, or vice versa.

Scope every call to the operator-confirmed collection (project / team / pipeline / table / base). Querying the operator's whole org is the wrong default and may cross trust boundaries.

{{if-bound:subscribe-to-changes}}
This MCP exposes `subscribe-to-changes` — push delivery is available. Prefer `trigger: signal-push` over polling, but confirm the webhook is actually registered in the backend's UI during dry-run (the MCP tool's presence does not imply the webhook is wired).
{{/if-bound:subscribe-to-changes}}
{{if-unbound:subscribe-to-changes}}
This MCP does **not** expose `subscribe-to-changes`. Compositions over this source must use `trigger: signal-polled` with the cursor field from `list-recent`, or `trigger: scheduled` with a window-key idempotency component.
{{/if-unbound:subscribe-to-changes}}

## Bound tool schemas

The following schemas are reproduced from the snapshot. Bind composition parameters to these schemas directly — do not infer parameter names from tool names, and do not assume one backend's filter syntax works on another. **The schema is also the field vocabulary** — what shows up in `find-by-filter`'s properties tells you what the operator's records actually carry (status field names, custom-field ids, label vocabularies).

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

These hold for any structured-record-store source, including this one. Vendor-specific quirks, if any, are in `adapter/{{server}}.md` (loaded separately when present).

- **Soft-delete retention.** When `find-by-filter` is used to detect existing records, scope the filter by archived / trashed / closed status, or check the relevant status field on every hit. A dormant duplicate is still a duplicate, but you'll often want to file a new one anyway — make that decision explicitly, not by accident.
- **First-run backfill blast.** Bound the first run's window via the trigger's `first_run_window` knob, or scope the source filter to an updated-since cursor.
- **Read-after-write same-store loops.** If the destination role of this composition also binds to `{{server}}`, use a source-side marker (label, custom field, external_ref pattern) to exclude prior writes from the source read.
- **System id over display key.** Bind dedupe and idempotency to the system id from the tool schemas above, not to URLs and not to operator-facing display keys (issue numbers, customer codes — both can be mutable depending on backend).
- **Permission scope at collection level.** The MCP's auth token may not cover every project / pipeline / table the operator names verbally — probe the source scope via `find-by-filter (limit 1)` during dry-run.
- **Schema drift.** This snapshot's schema is a snapshot at `{{introspected_at}}`. If the workflow runs over weeks or months, the operator may add / rename / delete fields. Re-introspect when writes start failing with schema-shaped errors.
- **Pagination model varies.** Cursor-based, offset-based, and page-number-with-cap models all show up across backends. The schema above tells you which one this MCP uses — bake that posture into the composition.
