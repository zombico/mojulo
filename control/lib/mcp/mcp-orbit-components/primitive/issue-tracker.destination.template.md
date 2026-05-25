# Provider artifact — issue-tracker (destination role) on {{server}}

*Runtime-generated from primitive `issue-tracker@0.1.0` (destination role) and a capability snapshot of `{{server}}` introspected at `{{introspected_at}}` (snapshot confidence: `{{snapshot_confidence}}`). This artifact is session-scoped — its assertions about tool names and schemas reflect the bound MCP **at introspection time**, not curated training data.*

## Affordance bindings

| Affordance | Bound tool | Confidence |
|---|---|---|
| `create-issue` | `{{tool:create-issue}}` | `{{confidence:create-issue}}` |
| `find-by-filter` | `{{tool:find-by-filter}}` | `{{confidence:find-by-filter}}` |
| `comment-on-issue` | `{{tool:comment-on-issue}}` | `{{confidence:comment-on-issue}}` |
| `transition-status` | `{{tool:transition-status}}` | `{{confidence:transition-status}}` |
| `update-issue-fields` | `{{tool:update-issue-fields}}` | `{{confidence:update-issue-fields}}` |

**Unbound affordances:** {{unbound_affordances}}

## How to write to this MCP

The standard write pattern for a "file new issue from signal" composition: (1) compute the dedupe key from the signal (typically the signal's source id, e.g. a Gmail thread id or a form submission id), (2) call `find-by-filter` over the destination scope with a filter matching the dedupe key (often encoded into a `mojulo:source-id:<id>` label or into the issue title), (3) if no existing issue matches, call `create-issue` to file a new one, (4) otherwise either skip or call `comment-on-issue` to add a follow-up.

For "transition issues that match X" compositions, use `find-by-filter` to enumerate the candidate set, then `transition-status` (and optionally `update-issue-fields`) on each match. Confirm the target status exists in the bound tracker's workflow before iterating — `transition-status` will fail per-issue with an opaque error otherwise.

Scope every call to the operator-confirmed project / team. Creating into the wrong project is hard to clean up; `find-by-filter` against the wrong scope will surface false-positive duplicates.

{{if-bound:transition-status}}
This MCP exposes `transition-status` — issue lifecycle transitions are available. Confirm the operator's target status (e.g. `closed`, `won't-fix`, `done`) exists in the bound tracker's workflow before composing transitions; not every status name is portable across trackers.
{{/if-bound:transition-status}}
{{if-unbound:transition-status}}
This MCP does **not** expose `transition-status`. Compositions cannot close or progress issues on this destination — file-and-forget only, OR use `update-issue-fields` if it covers the status field on this tracker.
{{/if-unbound:transition-status}}

{{if-bound:update-issue-fields}}
This MCP exposes `update-issue-fields` separately from `transition-status` — label / assignee / priority changes can be made without a status transition. Discover the updatable field set from the schema below.
{{/if-bound:update-issue-fields}}
{{if-unbound:update-issue-fields}}
This MCP does **not** expose `update-issue-fields` separately. Field changes must go through `transition-status` (if it accepts a fields payload) or through `comment-on-issue` (as a textual change request, not a structured field write).
{{/if-unbound:update-issue-fields}}

## Draft posture

Issue trackers do not have a "draft" status by convention. For dry-run writes:

- **Preferred:** create the issue with a `mojulo-dryrun` label that the operator can filter on and bulk-delete after review. The bound `create-issue` schema below tells you whether labels are accepted as a creation parameter.
- **Alternative:** write into a designated dry-run project / team if the operator has one provisioned. Specify the dry-run scope at composition time via the operator's `dry_run_scope` knob.
- **Detect native draft support:** some trackers (Linear) support draft issues as a first-class state. Check the `create-issue` schema for a `draft` or `state: draft` parameter — if present, prefer it over the label workaround.

## Bound tool schemas

The following schemas are reproduced from the snapshot. Bind composition parameters to these schemas directly — do not infer parameter names from tool names, and do not assume one tracker's create-issue payload shape works on another.

### `create-issue` → `{{tool:create-issue}}`

```json
{{schema:create-issue}}
```

### `find-by-filter` → `{{tool:find-by-filter}}`

```json
{{schema:find-by-filter}}
```

### `comment-on-issue` → `{{tool:comment-on-issue}}`

```json
{{schema:comment-on-issue}}
```

{{if-bound:transition-status}}
### `transition-status` → `{{tool:transition-status}}`

```json
{{schema:transition-status}}
```
{{/if-bound:transition-status}}

{{if-bound:update-issue-fields}}
### `update-issue-fields` → `{{tool:update-issue-fields}}`

```json
{{schema:update-issue-fields}}
```
{{/if-bound:update-issue-fields}}

## Cross-vendor pitfalls (inherited from primitive)

These hold for any issue-tracker destination, including this one. Vendor-specific quirks, if any, are in `adapter/{{server}}.md` (loaded separately when present).

- **Closed-isn't-deleted.** `find-by-filter` for dedupe must scope by status or check status per hit; otherwise the workflow re-creates issues that already exist in closed state.
- **Status workflow asymmetry.** Confirm the target status of any `transition-status` call exists in the bound tracker's workflow before iterating. `transition-status` failures are usually opaque ("invalid state transition") with no hint about valid alternatives.
- **First-run backfill blast.** A first run with no idempotency state will route every matching signal back to the cursor's epoch. Cap the first-run window explicitly.
- **Read-after-write same-tracker loops.** Apply the `mojulo-touched` source-side label pattern when the source role of this composition also binds to `{{server}}`.
- **Issue id vs URL.** Bind audit-trail entries to the id from `create-issue`'s response schema, not to the URL.
- **Permission scope at project/team level.** Probe destination scope via `find-by-filter (limit 1)` during dry-run before attempting `create-issue` — token may not cover the named project.
- **Comment threading model.** Check the `comment-on-issue` schema for a `thread_id` / `parent_id` field. Its absence means flat-only commenting; threaded-reply compositions fall back to inlining the parent reference in body text.
- **Mojulo trace.** Include the composition ref, run timestamp, and source signal id in every created issue's body (or as a structured label). Operators auditing a year of automated issues need to trace each back to its composition.
