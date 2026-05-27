# Provider artifact — document-store (destination role) on {{server}}

*Runtime-generated from primitive `document-store@0.1.0` (destination role) and a capability snapshot of `{{server}}` introspected at `{{introspected_at}}` (snapshot confidence: `{{snapshot_confidence}}`). This artifact is session-scoped — its assertions about tool names and schemas reflect the bound MCP **at introspection time**, not curated training data.*

## Affordance bindings

| Affordance | Bound tool | Confidence |
|---|---|---|
| `create-with-mime` | `{{tool:create-with-mime}}` | `{{confidence:create-with-mime}}` |
| `find-by-key-in-scope` | `{{tool:find-by-key-in-scope}}` | `{{confidence:find-by-key-in-scope}}` |
| `append-to-existing` | `{{tool:append-to-existing}}` | `{{confidence:append-to-existing}}` |
| `move-to-folder` | `{{tool:move-to-folder}}` | `{{confidence:move-to-folder}}` |

**Unbound affordances:** {{unbound_affordances}}

## How to write to this MCP

The write pattern is: (1) compute the dedupe key from the operator's window/period knobs, (2) call `find-by-key-in-scope` over the destination scope using the dedupe key, (3) if no existing document matches exactly (filter trashed; confirm exact title match), call `create-with-mime` to create a new document, (4) otherwise either skip (if the workflow is "once per period") or call `append-to-existing` (if the workflow is "rolling document").

Scope every call — both the search and the create — to the operator-confirmed folder/label/prefix. Searching the operator's whole namespace will surface false-positive duplicates from unrelated documents; creating into root will silently scatter artifacts outside the intended scope.

{{if-path-prefix}}
## Write scope (path prefix)

This binding is **constrained to `{{path_prefix}}`**. Every write — both the dedupe search and the create — must operate within that prefix. Writes outside the prefix are out of contract; the contextmap recorded the prefix as part of this binding's audit chain, so a downstream review can compare the actual writes to the declared scope.

When the underlying MCP can't enforce the constraint (e.g. the filesystem MCP only enforces its launch-time allowed root, not arbitrary sub-paths), the constraint is a *guidance* boundary — the agent honors it; the MCP doesn't. Operators relying on the audit trail to certify "nothing was written outside `{{path_prefix}}`" should pair this binding with regular contextmap reviews, not assume the runtime blocks escape.
{{/if-path-prefix}}

{{if-bound:append-to-existing}}
This MCP exposes `append-to-existing` — both "one document per period" and "rolling document" strategies are available. Surface the `doc_strategy` knob to the operator at composition time.
{{/if-bound:append-to-existing}}
{{if-unbound:append-to-existing}}
This MCP does **not** expose `append-to-existing`. Only the "one document per period" strategy is supported on this destination — rolling-document compositions require either a different MCP or a read-modify-write pattern using `read-content` (source role) + `create-with-mime` to overwrite, which loses revision history.
{{/if-unbound:append-to-existing}}

## Draft posture

Newly-created documents on this MCP are private to the creator by default unless permissions or sharing are explicitly added. Treat the bare `create-with-mime` call as the draft posture for dry-run — the destination write is reversible by leaving share permissions absent. Promotion is either an explicit share-add step or, when `move-to-folder` is bound, a move from a draft scope to a shared scope.

{{if-bound:move-to-folder}}
This MCP exposes `move-to-folder` — promotion via "draft folder → shared folder" is available. Dry-run writes into a `mojulo-dryrun` scope; promotion moves to the operator's primary scope.
{{/if-bound:move-to-folder}}
{{if-unbound:move-to-folder}}
This MCP does **not** expose `move-to-folder`. Promotion must be a permissions-add step (specifics vary by MCP — consult the bound MCP's permissions/sharing tools, which are not part of this primitive's affordance map).
{{/if-unbound:move-to-folder}}

## Bound tool schemas

The following schemas are reproduced from the snapshot. Bind composition parameters to these schemas directly — do not infer parameter names from tool names.

### `create-with-mime` → `{{tool:create-with-mime}}`

```json
{{schema:create-with-mime}}
```

### `find-by-key-in-scope` → `{{tool:find-by-key-in-scope}}`

```json
{{schema:find-by-key-in-scope}}
```

{{if-bound:append-to-existing}}
### `append-to-existing` → `{{tool:append-to-existing}}`

```json
{{schema:append-to-existing}}
```
{{/if-bound:append-to-existing}}

{{if-bound:move-to-folder}}
### `move-to-folder` → `{{tool:move-to-folder}}`

```json
{{schema:move-to-folder}}
```
{{/if-bound:move-to-folder}}

## Cross-vendor pitfalls (inherited from primitive)

These hold for any document-store destination, including this one. Vendor-specific quirks, if any, are in `adapter/{{server}}.md` (loaded separately when present).

- **Soft-delete retention.** `find-by-key-in-scope` results may include trashed items. Filter them before treating a hit as an existing document — otherwise the dedupe check silently skips a real new write.
- **Fuzzy search.** Confirm exact title/key match on `find-by-key-in-scope` hits before treating them as duplicates. A fuzzy hit on a similar title is not a duplicate.
- **Scope non-existence.** Probe the destination scope exists during dry-run. `create-with-mime` against a non-existent parent silently lands in root on most MCPs.
- **First-run backfill blast.** A first run with no idempotency state creates one document per historical period back to the cursor's epoch. Cap the first-run window explicitly or sequence with quota-respecting delays (e.g. 200ms between creates).
- **Identifier instability.** Bind the artifact's idempotency record to the id returned by `create-with-mime`, not to the title. Operators rename documents; ids don't change.
- **Mojulo trace in body.** Include the composition ref, run timestamp, and source query window in every created document's body. Without it, an operator scrolling back through a year of artifacts cannot tell which composition produced which document.
