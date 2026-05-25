# Provider artifact — structured-record-store (destination role) on {{server}}

*Runtime-generated from primitive `structured-record-store@0.1.0` (destination role) and a capability snapshot of `{{server}}` introspected at `{{introspected_at}}` (snapshot confidence: `{{snapshot_confidence}}`). This artifact is session-scoped — its assertions about tool names and schemas reflect the bound MCP **at introspection time**, not curated training data.*

## Affordance bindings

| Affordance | Bound tool | Confidence |
|---|---|---|
| `create-record` | `{{tool:create-record}}` | `{{confidence:create-record}}` |
| `find-by-filter` | `{{tool:find-by-filter}}` | `{{confidence:find-by-filter}}` |
| `update-fields` | `{{tool:update-fields}}` | `{{confidence:update-fields}}` |
| `upsert-by-key` | `{{tool:upsert-by-key}}` | `{{confidence:upsert-by-key}}` |
| `transition-status` | `{{tool:transition-status}}` | `{{confidence:transition-status}}` |
| `comment-on-record` | `{{tool:comment-on-record}}` | `{{confidence:comment-on-record}}` |

**Unbound affordances:** {{unbound_affordances}}

## How to write to this MCP

The standard write pattern for a "file new record from signal" composition: (1) compute the dedupe key from the signal (typically the signal's source id, e.g. a Gmail thread id, a form submission id, or an external system's customer_id), (2) call `find-by-filter` over the destination scope with a filter matching the dedupe key (encoded into a custom field, label, or external_ref), (3) if no existing record matches, call `create-record` to file a new one, (4) otherwise either skip or call `comment-on-record` / `update-fields` to extend the existing record.

{{if-bound:upsert-by-key}}
This MCP exposes `upsert-by-key` natively — for sync workflows keyed on an external identifier (email, customer_id, external_ref), **prefer the native upsert over the find-then-create pattern**. The backend serializes the operation, eliminating the upsert race that plagues simulated upserts under concurrency. Discover the accepted key field(s) from the schema below.
{{/if-bound:upsert-by-key}}
{{if-unbound:upsert-by-key}}
This MCP does **not** expose `upsert-by-key` natively. Sync compositions keyed on an external identifier must simulate upsert with `find-by-filter` + `create-record` / `update-fields`. Document the race in the composition's intent_md, or rely on a backend-level unique constraint on the external-key field if available.
{{/if-unbound:upsert-by-key}}

For "transition records that match X" compositions, use `find-by-filter` to enumerate the candidate set, then `transition-status` (and optionally `update-fields`) on each match. Confirm the target status exists in the bound backend's workflow before iterating — `transition-status` will fail per-record with an opaque error otherwise.

Scope every call to the operator-confirmed collection. Creating into the wrong project / pipeline / table is hard to clean up; `find-by-filter` against the wrong scope will surface false-positive duplicates.

{{if-bound:transition-status}}
This MCP exposes `transition-status` — record lifecycle transitions are available. Confirm the operator's target status (e.g. `closed`, `won-deal`, `lost-deal`, `done`) exists in the bound backend's workflow before composing transitions; not every status name is portable across backends.
{{/if-bound:transition-status}}
{{if-unbound:transition-status}}
This MCP does **not** expose `transition-status`. Compositions cannot transition records through workflow states on this destination — file-and-forget only, OR use `update-fields` if it covers the status / stage field as a writable property on this backend.
{{/if-unbound:transition-status}}

{{if-bound:update-fields}}
This MCP exposes `update-fields` for non-status field changes — labels, owner, custom fields. Discover the updatable field set from the schema below.
{{/if-bound:update-fields}}
{{if-unbound:update-fields}}
This MCP does **not** expose `update-fields` separately. Field changes must go through `transition-status` (if it accepts a fields payload), through `upsert-by-key` (if bound and the operator's key is stable), or through `comment-on-record` as a textual change request, not a structured field write.
{{/if-unbound:update-fields}}

{{if-bound:comment-on-record}}
This MCP exposes `comment-on-record` — addressable comments / notes / activities can be attached to existing records. Discover the entity shape (flat vs threaded; plain-text body vs typed payload) from the schema below.
{{/if-bound:comment-on-record}}
{{if-unbound:comment-on-record}}
This MCP does **not** expose `comment-on-record`. Follow-up content on existing records must go through `update-fields` (e.g. appending to a notes field) — there is no addressable comment surface.
{{/if-unbound:comment-on-record}}

## Draft posture

Record stores generally do not have a "draft" status by convention. For dry-run writes:

- **Preferred:** create the record with a `mojulo-dryrun` label / tag / custom-field-value that the operator can filter on and bulk-delete after review. The bound `create-record` schema below tells you whether labels are accepted as a creation parameter.
- **Alternative:** write into a designated dry-run scope (project, pipeline, or table) if the operator has one provisioned. Specify the dry-run scope at composition time via the operator's `dry_run_scope` knob.
- **Detect native draft support:** some backends (Linear, Notion DB) support draft records as a first-class state. Check the `create-record` schema for a `draft` flag, `state: draft`, or equivalent — if present, prefer it over the label workaround.

## Bound tool schemas

The following schemas are reproduced from the snapshot. Bind composition parameters to these schemas directly — do not infer parameter names from tool names, and do not assume one backend's create-record payload shape works on another.

### `create-record` → `{{tool:create-record}}`

```json
{{schema:create-record}}
```

### `find-by-filter` → `{{tool:find-by-filter}}`

```json
{{schema:find-by-filter}}
```

{{if-bound:update-fields}}
### `update-fields` → `{{tool:update-fields}}`

```json
{{schema:update-fields}}
```
{{/if-bound:update-fields}}

{{if-bound:upsert-by-key}}
### `upsert-by-key` → `{{tool:upsert-by-key}}`

```json
{{schema:upsert-by-key}}
```
{{/if-bound:upsert-by-key}}

{{if-bound:transition-status}}
### `transition-status` → `{{tool:transition-status}}`

```json
{{schema:transition-status}}
```
{{/if-bound:transition-status}}

{{if-bound:comment-on-record}}
### `comment-on-record` → `{{tool:comment-on-record}}`

```json
{{schema:comment-on-record}}
```
{{/if-bound:comment-on-record}}

## Cross-vendor pitfalls (inherited from primitive)

These hold for any structured-record-store destination, including this one. Vendor-specific quirks, if any, are in `adapter/{{server}}.md` (loaded separately when present).

- **Soft-delete retention.** `find-by-filter` for dedupe must scope by archived / trashed / closed status or check per-hit; otherwise the workflow re-creates records that already exist in dormant state.
- **Status workflow asymmetry.** Confirm the target status of any `transition-status` call exists in the bound backend's workflow before iterating. Failures are usually opaque ("invalid transition") with no hint about valid alternatives.
- **First-run backfill blast.** A first run with no idempotency state will route every matching signal back to the cursor's epoch. Cap the first-run window explicitly.
- **Read-after-write same-store loops.** Apply the source-side marker pattern (label / custom field / external_ref) when the source role of this composition also binds to `{{server}}`.
- **System id over display key.** Bind audit-trail entries to the system id from `create-record`'s response schema, not to URLs or operator-facing display keys.
- **Permission scope at collection level.** Probe destination scope via `find-by-filter (limit 1)` during dry-run before attempting `create-record` — token may not cover the named collection.
- **Field-type and required-field mismatch.** Discover types and required fields from the `create-record` schema above; type errors fail per-call at run-time with hard-to-recover messages.
- **Schema drift.** This snapshot's schema is from `{{introspected_at}}`. If writes start failing with schema-shaped errors, re-introspect.
- **Mojulo trace.** Include the composition ref, run timestamp, and source signal id in every created record (typically in a custom field or label). Operators auditing automated record activity need to trace each row back to its composition.
