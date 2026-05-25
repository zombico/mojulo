---
{
  "ref": "document-store",
  "version": "0.1.0",
  "summary": "Primitive: a namespace of files/documents that supports create / read / search / append, soft-delete semantics, and folder-or-path scoping. Backed by any of Drive, Notion, OneDrive, Dropbox, S3-with-keys.",
  "affordances": {
    "source": [
      { "name": "find-by-key-in-scope", "support": "expected", "summary": "Search documents within a bounded scope (folder, prefix, label) by title or full-text." },
      { "name": "read-content", "support": "expected", "summary": "Open a specific document and return its body as text." },
      { "name": "list-recent", "support": "expected", "summary": "List documents in scope ordered by recency, typically with a modified-since cursor." },
      { "name": "get-metadata", "support": "likely", "summary": "Return non-body metadata (size, mime, owner, modified-time) for a specific document." },
      { "name": "subscribe-to-changes", "support": "rare", "summary": "Push notification on document create/update. Most document stores don't expose this; fall back to polled list-recent + cursor." }
    ],
    "destination": [
      { "name": "create-with-mime", "support": "expected", "summary": "Create a new document in scope with a specific mime type and body." },
      { "name": "find-by-key-in-scope", "support": "expected", "summary": "Used for search-before-create dedupe. Same affordance contract as the source-role variant." },
      { "name": "append-to-existing", "support": "likely", "summary": "Append content to an existing document by id without rewriting it. Some document stores require read-modify-write instead." },
      { "name": "move-to-folder", "support": "likely", "summary": "Move or copy a document into a different scope (for promotion from draft folder to published)." }
    ]
  },
  "pitfalls": [
    "Soft-delete retention windows. Documents the operator deleted are often still searchable for a retention period (Drive: 30 days; OneDrive: 30 days; Notion: indefinite via trash). Dedupe checks must filter trashed items or they silently skip a real new write.",
    "Fuzzy search semantics. Most document stores' search treats query strings as fuzzy matches, not exact. Tighten dedupe by reading metadata of every search hit and matching exactly, not by trusting the search to be exact.",
    "Folder/scope non-existence. Most document stores do NOT auto-create the folder path on a create call with a non-existent parent — they silently land in root, or fail. Probe the scope exists during dry-run; if missing, surface 'I'll create scope X' as an explicit step.",
    "First-run backfill blast. A scheduled aggregation that creates one document per period will, on first run, create one document per period since the cursor's epoch. Cap the first run to a bounded window or sequence with quota-respecting delays.",
    "Read-after-write same-scope loops. A composition with this primitive in BOTH roles AND the same backing MCP must either (a) scope reads to exclude the destination, or (b) use a source-side label to mark mojulo-created files. Otherwise next run picks up the prior write and re-processes it.",
    "Identifier instability. Document stores identify by stable id, not by title or path. Use id as the dedupe key and idempotency anchor — never title (mutable) or path (often unstable across moves)."
  ],
  "rolePairings": {
    "source": {
      "cursorAffordance": "list-recent",
      "cursorFieldHint": "modified-time (or equivalent — discover from the bound tool's input/output schema)",
      "preferredTriggers": ["scheduled", "signal-polled"]
    },
    "destination": {
      "dedupeAffordance": "find-by-key-in-scope",
      "draftPosture": "Most document stores treat newly-created documents as private to the creator until permissions/share are added. Treat 'create without share' as the draft posture for dry-run; treat 'add share' or 'move to shared folder' as promotion."
    }
  }
}
---

# primitive: document-store

A `document-store` is a namespace of files or documents where individual items can be created, read, searched, and (sometimes) appended in place. The defining shape is **scoped addressability**: items live in a folder/prefix/label scope, are identified by stable ids, and support both directory-style discovery and direct content access.

This primitive is the curated, vendor-agnostic shape. The integration specifics — which tool name satisfies which affordance, what the cursor field is actually called, what the search query syntax is — come from the runtime-introspected provider artifact built from the operator's installed MCP. This body teaches the shape; the generator fills the specifics.

## When this primitive fits

- The workflow's source role reads documents the operator authored, organized by folder or label — knowledge bundles, SOP libraries, briefing notes, contract folders.
- The workflow's destination role writes period-scoped digest documents (weekly/monthly), enrichment artifacts, or generated summaries that humans will later browse.
- Idempotency anchors on title-as-period-identifier (`YYYY-W##`, `YYYY-MM`) backed by `find-by-key-in-scope`.

## When it doesn't fit

- The workflow needs structured records with typed fields and queries (`structured-record-store` is the right primitive — Airtable, HubSpot, Notion DBs).
- The workflow needs message-thread semantics with reply identity (`message-thread` — Gmail, Slack DMs).
- The workflow needs append-only timeline semantics with cursor-based catch-up (`event-stream`).

## Affordance map summary

Source role uses `list-recent` + `read-content` as the catch-up read pattern, `find-by-key-in-scope` for targeted lookups, `get-metadata` for non-body fact extraction, and (rarely) `subscribe-to-changes` for push delivery. When `subscribe-to-changes` is unbound, compositions fall back to `trigger: signal-polled` over the cursor field exposed by `list-recent`.

Destination role uses `create-with-mime` for new documents, `find-by-key-in-scope` for search-before-create dedupe, `append-to-existing` for rolling-document strategies, and `move-to-folder` for draft → published promotion. The dedupe affordance is load-bearing: a destination without a clean way to query-by-title-in-scope cannot safely participate in scheduled compositions.

## Cross-vendor pitfalls — what is true regardless of which MCP backs this primitive

These pitfalls hold for any document store you might bind to this primitive. Vendor-specific quirks (Drive's `parents[]` shortcut behavior; Notion's block-based body model; Dropbox's path-based identity) belong in optional `adapter/<server>.md` override files, not here.

1. **Soft-delete retention.** Deleted-but-not-purged items remain searchable for a retention window. Dedupe must filter trashed items.
2. **Fuzzy search.** Search hits include near-matches. Confirm exact match by reading the hit's metadata, not by trusting the result list.
3. **Scope non-existence.** Creating into a non-existent scope silently lands in root or errors. Probe scope existence in dry-run.
4. **First-run backfill blast.** Scheduled aggregations bound the first run's window explicitly. The cursor's epoch is not "the start of time."
5. **Read-after-write same-scope loops.** Compositions using this primitive in both roles need an excluding read scope or source-side label.
6. **Identifier instability.** Bind dedupe and idempotency to stable ids, not to titles or paths.
