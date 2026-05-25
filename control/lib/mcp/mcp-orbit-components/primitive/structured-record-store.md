---
{
  "ref": "structured-record-store",
  "version": "0.1.0",
  "summary": "Primitive: a scope-addressable store of typed records with stable ids, structured-field queries, create / read / update affordances, and optional status / comment / upsert surfaces. Backed by issue trackers (Linear, GitHub Issues, Jira), CRMs (HubSpot, Salesforce, Pipedrive), spreadsheet-databases (Airtable, Notion DB), and similar typed-record systems.",
  "affordances": {
    "source": [
      { "name": "find-by-filter", "support": "expected", "summary": "Query records within a scope (project, team, table, base, pipeline) by structured filter — typed field equality, ranges, set membership, updated-since." },
      { "name": "read-content", "support": "expected", "summary": "Open a specific record and return its full field payload — and, where the backend supports them, its associated comments / activities / attachments." },
      { "name": "list-recent", "support": "expected", "summary": "List records in scope ordered by recent activity, typically with an updated-since cursor." },
      { "name": "get-metadata", "support": "likely", "summary": "Return non-body metadata (status, owner, labels, urls, timestamps) for a specific record without pulling related entities. On record stores where the record IS the metadata (e.g. Airtable), this folds into `read-content`." },
      { "name": "subscribe-to-changes", "support": "likely", "summary": "Push notification (webhook) on record create / update / status-change. More common on issue trackers and CRMs than on spreadsheet-databases, but MCP exposure is uneven." }
    ],
    "destination": [
      { "name": "create-record", "support": "expected", "summary": "Create a new record in scope with a typed-field payload. Required fields are per-table; discover from the bound tool's input schema." },
      { "name": "find-by-filter", "support": "expected", "summary": "Used for search-before-create dedupe via structured filter. Same affordance contract as the source-role variant." },
      { "name": "update-fields", "support": "expected", "summary": "Change one or more non-status fields on an existing record by id — labels, owner, priority, custom fields. Some backends fold this into status transitions; others expose it separately." },
      { "name": "upsert-by-key", "support": "likely", "summary": "Find-or-create by an operator-defined external key (email, customer_id, external_ref). The defining affordance for sync workflows — present on most CRMs and spreadsheet-databases, rare on issue trackers." },
      { "name": "transition-status", "support": "likely", "summary": "Change a record's status / stage / state by transition rather than by raw field write. Workflow shape varies — issue trackers have explicit transition graphs, CRMs treat stage as a field, spreadsheet-databases typically have no workflow at all." },
      { "name": "comment-on-record", "support": "likely", "summary": "Add a comment / note / activity to an existing record by id. Comments are addressable, separate entities on most backends — not a body append. Spreadsheet-databases generally don't expose this." }
    ]
  },
  "pitfalls": [
    "Soft-delete retention. Closed, archived, or trashed records remain queryable on most backends for a retention window (or indefinitely). Dedupe checks via `find-by-filter` must either include a status / archived filter or check the relevant field on every hit, otherwise the workflow re-finds long-closed duplicates of new records.",
    "Status workflow asymmetry (when transition-status is bound). 'Closed' is not a single state — issue trackers have multiple terminal states (done, won't-fix, duplicate), CRMs encode stage as a field value, spreadsheet-databases often have no workflow. Confirm the target status exists in the bound backend's workflow before issuing transitions; the operation is opaque on failure ('invalid transition') with no hint about valid alternatives.",
    "First-run backfill blast. A scheduled aggregation 'route open records to digest' will, on first run, route every open record ever filed in the source scope. Cap the first run's window via the trigger's `first_run_window` knob, OR scope the source filter to a recent updated-since cursor.",
    "Read-after-write same-store loops. A composition with this primitive in BOTH roles AND the same backing MCP (e.g. enrich Linear issues by writing back to Linear, or upsert HubSpot contacts read from HubSpot) must use a source-side marker (often a 'mojulo-touched' label, a custom field, or an external_ref pattern) to exclude prior writes from the next source read. Otherwise the workflow infinitely re-processes its own output.",
    "Record identifier vs URL vs display key. Records are identified by stable system id (numeric, kebab, or UUID); the URL is derived and stable per-environment; the operator's display key (email, customer_id, issue-number) may be unique-per-table but is mutable on many backends. Bind dedupe and audit trail to the system id, not the URL (URLs invalidate across env migrations) and not the display key (mutable on many backends, sometimes by the operator).",
    "Permission scope at the collection level. Most MCP tokens are scoped to a subset of the operator's collections (projects/teams in issue trackers; pipelines/portals in CRMs; bases/tables in spreadsheet-databases). A scope the operator names verbally may not be in the token's reach — probe via `find-by-filter (limit 1)` during dry-run before attempting `create-record`.",
    "Comment/activity model varies widely (when comment-on-record is bound). Issue trackers expose first-class comments with their own ids and (sometimes) threading. CRMs expose 'activities' or 'engagements' that are typed entities (notes, calls, emails). Spreadsheet-databases usually expose nothing. Detect from the bound `comment-on-record` tool's schema; compositions that 'reply' to a comment must check for a thread / parent field — its absence means flat-only.",
    "Webhook-vs-poll tradeoff (when subscribe-to-changes is bound). Push delivery beats polling for latency, but webhook registration usually lives outside the MCP (in the backend's UI). The composition's dry-run should confirm the webhook is actually registered, not just that the subscription tool exists.",
    "Upsert race conditions (when upsert-by-key is used). Concurrent compositions with the same external key can both create. When a native `upsert-by-key` is bound, prefer it over find-then-create (the backend can serialize). When unavailable and the workflow simulates upsert with `find-by-filter` + `create-record`, document the race in the composition's intent_md and either accept the race or rely on a backend-level unique constraint on the external-key field.",
    "Field-type and required-field mismatch. Record stores enforce field types and required fields per table / object / pipeline schema. Discover the schema from the bound `create-record` and `update-fields` input schemas; do not infer types from intent text. A composition that tries to write a string into a numeric field, or omits a required field, gets a per-call error that's hard to recover from at run-time.",
    "Schema drift between sessions. Operators add fields, rename fields, delete fields, and change field types between sessions — especially on CRMs (where ops/sales teams iterate on the data model) and spreadsheet-databases (where the operator is often the schema owner). The bound `create-record` schema is a snapshot at introspection time; re-introspect when inventory ages beyond freshness threshold (24h) or when a write starts failing with a schema-shaped error.",
    "Pagination model varies. Cursor-based (Linear, modern HubSpot), offset-based (legacy HubSpot), page-number with hard cap (Airtable 100/page, 100k records/base soft cap). Discover from the bound `list-recent` and `find-by-filter` schemas; bake the pagination posture into the composition rather than assuming any single shape."
  ],
  "rolePairings": {
    "source": {
      "cursorAffordance": "list-recent",
      "cursorFieldHint": "update-time / updatedAt / last_modified_time (discover from the bound tool's schema — name varies per backend)",
      "preferredTriggers": ["scheduled", "signal-polled", "signal-push"]
    },
    "destination": {
      "dedupeAffordance": "find-by-filter",
      "draftPosture": "Record stores generally do not have a 'draft' status by convention. Treat dry-run writes as: (a) create the record with a 'mojulo-dryrun' label / custom-field-tag that the operator can filter on and bulk-delete after review, OR (b) write to a designated dry-run scope (a `mojulo-dryrun` project, pipeline, or table) if the operator has one provisioned, OR (c) detect native draft support from the bound `create-record` tool's schema — some backends (Linear, Notion DB) expose a `draft` flag or status. Spreadsheet-databases without a status concept fall back to options (a) or (b)."
    }
  }
}
---

# primitive: structured-record-store

A `structured-record-store` is a scope-addressable namespace of **typed records** — items with stable ids, a typed-field payload, and a structured-filter query surface. The defining shape is **typed addressability**: records live in a project / team / table / base / pipeline scope, are identified by stable system ids, carry typed fields whose schema is discoverable, and are queried by structured-field filter rather than by full-text title match.

The primitive covers a wide span of backends: **issue trackers** (Linear, GitHub Issues, Jira) where records are work items with status workflows; **CRMs** (HubSpot, Salesforce, Pipedrive) where records are contacts / companies / deals with pipeline stages; **spreadsheet-databases** (Airtable, Notion DB) where records are rows with operator-defined fields and no workflow. What unifies them is the typed-record shape and the structured-filter query; what varies — status workflows, comments, upsert affordances — is captured per-affordance in the support taxonomy.

This is the curated, vendor-agnostic shape. The integration specifics — which tool name satisfies which affordance, what the cursor field is actually called, what status values are allowed in transitions, what required fields the schema enforces — come from the runtime-introspected provider artifact built from the operator's installed MCP. This body teaches the shape; the generator fills the specifics.

## When this primitive fits

- The workflow's source role aggregates record activity for digests, audit trails, or signal extraction across a scope's history (open issues, recently-updated deals, this week's new contacts).
- The workflow's destination role files new records from external signals (form submissions, monitoring alerts, parsed inbound), updates existing records' fields, transitions status / stage on records matching a condition, or upserts records keyed by an operator-defined external key (email, customer_id) for sync workflows.
- Idempotency anchors on the record's system id (for updates + transitions + comments) or on a structured-filter signature (for create-with-dedupe), or on the external key (for upsert-by-key compositions).

## When it doesn't fit

- The workflow needs unstructured document storage with folder hierarchies and full-text body content (`document-store` — Drive, Notion docs, OneDrive).
- The workflow needs scope-addressable chat with thread sub-grouping, where audience is scope members (`messaging-channel` — Slack, Discord, Teams).
- The workflow needs directed mail semantics where audience is *named recipients* and threads grow by reply (`message-thread` — Gmail). The audience model differs: structured-record-store has owners / assignees as fields, not as audience.

## Affordance map summary

**Source role.** Uses `list-recent` + `get-metadata` as the catch-up scan pattern, `find-by-filter` for targeted queries (open records by status, records assigned to X, records updated since cursor), and `read-content` for records that need full payload (e.g. for summarization, or when the backend separates body / comments / activities from metadata). `subscribe-to-changes` is more commonly exposed than on document-stores or messaging-channels, but MCP coverage is uneven — fall back to `signal-polled` over the cursor field when unbound.

**Destination role.** Uses `create-record` for filing, `find-by-filter` for search-before-create dedupe, `update-fields` for typed-field changes (labels, owner, priority, custom fields), `upsert-by-key` for sync workflows keyed on an external identifier, `transition-status` for status / stage workflow moves, and `comment-on-record` for follow-ups on existing records. The dedupe affordance is load-bearing: a destination without a clean way to query-by-structured-key cannot safely participate in scheduled compositions.

Which affordances are actually bound on a given backend depends on the backend's shape:

| Backend shape | Typical bindings (destination) |
|---|---|
| Issue tracker (Linear, GitHub Issues) | `create-record` + `find-by-filter` + `update-fields` + `transition-status` + `comment-on-record`; `upsert-by-key` usually unbound |
| CRM (HubSpot, Salesforce) | `create-record` + `find-by-filter` + `update-fields` + `upsert-by-key` + `comment-on-record` (activity/note); `transition-status` may bind to stage updates |
| Spreadsheet-database (Airtable, Notion DB) | `create-record` + `find-by-filter` + `update-fields` + `upsert-by-key`; `transition-status` and `comment-on-record` usually unbound |

The composer reads the bound manifest and the runtime-introspected schemas to decide which affordances are actually available; the primitive's `support` labels (`expected` / `likely` / `rare`) are priors, not assertions.

## Affordance vocabulary — note on cross-primitive overlap

Several affordance names rhyme across primitives because the underlying shape is genuinely similar:

- `find-by-filter` — same meaning across `structured-record-store` and `messaging-channel`: structured-field query with scope + predicates.
- `list-recent`, `read-content`, `get-metadata`, `subscribe-to-changes` — same meaning across `document-store` and `structured-record-store`.

Others are deliberately primitive-shaped:

- **`find-by-filter` (structured-record-store)** vs **`find-by-key-in-scope` (document-store)** — record queries are structured-field filters (status + owner + label + custom-field) with typed operators (eq, in, gte). Document-store queries are title-or-fulltext-in-folder fuzzy matches. The query input shape is fundamentally different.
- **`create-record`** vs `create-with-mime` (document-store) vs `post-to-scope` (messaging-channel) — record creation takes a typed-field payload against a discoverable schema. Documents take mime + body + parents; messages take text + scope + thread. Three primitives, three distinct create shapes.
- **`comment-on-record`** vs `append-to-existing` (document-store) — comments / notes / activities are addressable separate entities with their own ids and (sometimes) reply semantics. Document append is body mutation in place. Different shape, different idempotency model.
- **`update-fields`**, **`transition-status`**, **`upsert-by-key`** — no analog in document-store or messaging-channel. Records have typed fields with workflows and external keys; documents and messages don't.

The lesson encoded here: affordance vocabulary is per-primitive. Names rhyme across primitives only when the shape genuinely transfers; otherwise the names diverge to make the difference visible in compositions and audit trails.

## Cross-vendor pitfalls — what is true regardless of which MCP backs this primitive

These pitfalls hold for any record store you might bind to this primitive. Vendor-specific quirks (Linear's GraphQL filter shape; GitHub's comment-as-issue-event model; HubSpot's offset pagination; Airtable's 100/page hard cap; Notion DB's block-based record body) belong in optional `adapter/<server>.md` override files, not here.

1. **Soft-delete retention.** Dedupe via `find-by-filter` must scope by archived / trashed / closed status or check per-hit; otherwise dormant duplicates of new records are re-found.
2. **Status workflow asymmetry (when transition-status is bound).** Confirm target status exists in the bound backend before issuing `transition-status`. Spreadsheet-databases without workflows leave this affordance unbound.
3. **First-run backfill blast.** Cap the first run's window or scope to a recent cursor.
4. **Read-after-write same-store loops.** Use a source-side marker (label, custom field, external_ref pattern) to exclude prior writes when source and destination bind to the same backend.
5. **Identity by stable system id.** Bind dedupe and audit trail to the system id, not the URL, not the display key.
6. **Permission scope at collection level.** Probe destination scope via `find-by-filter (limit 1)` in dry-run before attempting `create-record`.
7. **Comment/activity model varies (when comment-on-record is bound).** Detect threading vs flat from the bound tool's schema; spreadsheet-databases generally leave this affordance unbound entirely.
8. **Webhook-vs-poll tradeoff (when subscribe-to-changes is bound).** Webhook registration usually lives outside the MCP; confirm registration in dry-run, not just tool presence.
9. **Upsert race on `upsert-by-key`.** Prefer native upsert when bound; document the race when simulating with find-then-create.
10. **Field-type and required-field mismatch.** Discover schema from the bound tool's input schema; never assume field types from intent text.
11. **Schema drift between sessions.** Re-introspect when inventory ages beyond freshness threshold or when writes fail with schema-shaped errors.
12. **Pagination model varies.** Discover from the bound `list-recent` / `find-by-filter` schemas; bake the pagination posture into the composition.
