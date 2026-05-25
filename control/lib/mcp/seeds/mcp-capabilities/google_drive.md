---
{
  "ref": "gdrive",
  "version": "0.1.0",
  "summary": "Google Drive MCP: read (search / read / download files across document types) and write (create / append) Google Docs, folder-scoped, supports drafts. Multi-faceted surface — native Docs and binary formats (PDF, DOCX) require different read shapes.",
  "requires": {
    "mcpInventoryCategory": "document_store",
    "inventoryServerHints": ["gdrive", "google_drive", "claude_ai_Google_Drive"]
  },
  "affordances": {
    "read": true,
    "write": true,
    "watch": false
  },
  "capabilities": {
    "cursor": true,
    "cursorField": "modifiedTime",
    "pagination": "pageToken",
    "rateLimit": "quota-units",
    "rateLimitDetails": "1,000,000 quota units per day per user; most read operations 1 unit, batch operations variable; 429 responses include Retry-After header.",
    "supportsSearchOperators": true,
    "searchFilterValues": ["mimeType", "trashed", "modifiedTime", "name"],
    "writeShapes": ["create_doc", "append_to_doc"],
    "readShapes": ["search_files", "read_file_content", "download_file_content", "get_file_metadata", "list_recent_files"],
    "contentModel": "rich-text (native) / binary (PDF, DOCX, etc.)",
    "requestLimits": {
      "fileUploadBytes": 5368709120,
      "docContentChars": 1000000,
      "batchOperationsMax": 100
    },
    "supportsDrafts": true,
    "supportsFolders": true,
    "supportsDelete": false,
    "dedupeSurface": "title_search_in_folder"
  },
  "intentKeywords": ["drive", "doc", "document", "google", "folder", "spreadsheet", "sheet", "shared", "pdf", "word"],
  "exposesKnobs": [
    { "name": "folder", "prompt": "Drive folder path to read/write into (e.g. 'mojulo/weekly-digests'). Folder must exist and be shared with the integration.", "default": null },
    { "name": "doc_strategy", "prompt": "When this MCP plays the destination role: one doc per period (separate files) or one rolling doc that gets appended to?", "default": "per-period" },
    { "name": "read_scope", "prompt": "When this MCP plays the source role: which folder/file glob defines the corpus to read? Or 'workspace' for all accessible files?", "default": null }
  ]
}
---

# mcp: Google Drive

Google Drive is a document store. Its MCP surface is **bidirectional and multi-faceted** — usable as a composition source (read SOP docs, contract folders, knowledge bundles) and as a composition destination (create periodic digest docs, append to rolling logs). The two faces differ in mime type handling: native Docs read cleanly as rich text; PDFs and DOCX files require binary download + downstream extraction. One MCP, two roles; this component teaches both.

## Source-role surface (when `role: 'source'` in the composition)

- **Discovery calls.**
  - `search_files` — fulltext search over the folder, filter by `mimeType`, `trashed`, `modifiedTime`. Supports operators like `name contains 'report'`.
  - `list_recent_files` — folder-scoped, sorted by `modifiedTime`, supports date filters.
  - `get_file_metadata` — retrieves id, name, mimeType, parents, modifiedTime, size, webViewLink.
  - `read_file_content` — for native Google Docs (`application/vnd.google-apps.document`); returns plain text.
  - `download_file_content` — for binaries (PDF, DOCX, XLSX, images); returns base64.
- **Folder-scoped read.** All reads scope to the folder named in the `read_scope` knob. Reading the operator's whole Drive is the wrong default — surface the folder choice to the operator before binding.
- **Cursor.** Drive exposes `modifiedTime` (ISO 8601) on every file. Use it as the cursor for incremental reads — first run sweeps the whole folder, subsequent runs only pick up files modified after the prior cursor. Pagination is `pageToken` / `nextPageToken` with optional page size (default 10, max 1000).
- **Watch surface.** **None.** Drive has no webhook API in the public surface. Poll-only. The composer should pair this source with `trigger/signal-polled`.
- **Rate limit.** 1,000,000 quota units per day per user. Most read operations cost 1 unit; batch operations cost more. A 50-file search + metadata fetch uses ~100 units total. Workspace-wide backfills (500+ files) will burn quota — clamp first runs to the `read_scope` folder and a recent time window.

### Mapping intent for source role (load-bearing)

- **A file's mime type determines the read shape.** `application/vnd.google-apps.document` (native Doc) → `read_file_content` (returns markdown). `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (DOCX) → `download_file_content` (returns base64) + downstream extraction. Spreadsheets (`application/vnd.google-apps.spreadsheet`) require the export endpoint. The composer must branch on mime before deciding read shape; blind `read_file_content` on a PDF fails.
- **File id is the stable primary key, not the name.** Drive allows the same file to exist in multiple folders via shortcuts, and titles drift. Use `id` (UUID) as the source-event ref for idempotency, not title.
- **Folder hierarchy via `parents[]`, not string names.** Don't trust folder hierarchy in `name`. Resolve "is this file in folder X" by walking `parents[]`, not by comparing path strings — shortcuts and symlink-like behavior make string matching unreliable.
- **`modifiedTime` granularity is seconds (ISO 8601).** Persisting the exact value as the cursor works; rounding down loses precision on high-frequency edits. Two edits within the same second both have the same `modifiedTime` — on replay, fetch both and dedupe by `id`.

## Destination-role surface (when `role: 'destination'` in the composition)

- **Discovery calls.**
  - `create_file` — with mime `application/vnd.google-apps.document`. Required: `title`, `parentId` (folder id). Optional: initial `textContent`.
  - `read_file_content`, `get_file_metadata`, `search_files` — for dry-runs and dedupe checks.
- **Folder targeting.** All writes scope to the folder named in the `folder` knob. Search-before-create runs over that folder, not the whole Drive — operators conflate "no duplicate in this folder" with "no duplicate anywhere," and the former is what's actually checked. The folder must exist and be writable by the integration.
- **Draft posture.** Newly-created Docs are private to the operator by default (shared only with the integration account). That IS the draft posture. No explicit "publish" step; "promotion" means moving to a shared folder OR adding a permission.
- **Append shape.** Use `update_file` to append `textContent` to an existing Doc (Docs handle append cleanly; other formats do not). Batching multiple writes to one doc avoids quota burn and clutter.

### Mapping intent for destination role (load-bearing)

- **Doc title carries the dedupe key.** Typically a period identifier — `YYYY-W##` for weekly, `YYYY-MM` for monthly, `YYYY-MM-DD` for daily. The `idempotency/window-key` component generates this; the destination consumes it. Search-before-create must match on the full title (since fuzzy matching can return stale files), then verify the match is NOT in trash.
- **Body shape is markdown.** Drive renders it as rich-text on first load. Don't try to write Drive's native XML structure; markdown round-trips well enough and is what the source-side render components produce. Line breaks, lists, and inline formatting all survive; tables and embeds require per-doc conversion logic.
- **Include the mojulo trace.** Write composition ref + run timestamp + source query window as a callout block or footer comment in the doc. Without it, an operator scrolling back through a year of digests can't tell which composition produced which doc, and rerun decisions are guesswork.
- **Respect quota for backfill creates.** First-run backfills that create 52 weeks of docs in one pass will hit daily quotas. Sequence creates with at least 200ms between them if parallel, or batch into one larger doc if sequential.

## Pitfalls (apply across both roles)

- **Permission drift between sessions.** The Drive MCP may have rotated permissions or removed scopes since the operator last declared inventory. Verify by reading one real doc from the folder during dry-run, not just probing `search_files` — a successful search with zero results means "integration is connected but not shared into matching content," not "no content exists."
- **`search_files` does fuzzy matching.** Searching for `Linear digest — 2026-W21` may also surface `Linear digest — 2026-W211` (typo) or older `Linear digest 2026-W21` (no em-dash). Tighten dedupe by fetching metadata of every hit and matching title exactly, AND checking `trashed: false` to exclude soft-deleted docs.
- **Folder doesn't exist or isn't accessible.** Drive does not auto-create the folder path — `create_file` with a non-existent or unshared parent silently lands in the root (or fails). Probe the folder exists and is writable during dry-run; if missing, surface "I'll need you to share the folder first" explicitly, not as a side effect.
- **Trash isn't immediate delete.** A doc the operator "deleted" stays searchable for 30 days (in trash). Dedupe checks must filter `trashed: true` out of `search_files` results, otherwise the workflow silently skips a real new write and assumes it already exists.
- **Shortcut files complicate hierarchy.** Folders can contain shortcuts to files in other locations. `search_files` returns both originals and shortcuts; if the composition writes based on shortcut metadata, it may dedupe incorrectly or write to the wrong parent.
- **Quota burn on rapid-file creates.** Each `create_file` costs quota units; first-run backfills with 52 weekly docs or 365 daily docs will hit limits. Sequence with delays or batch into fewer, denser docs.
- **Read-after-write same-folder loops.** A composition with `mcp/gdrive` in BOTH roles (read SOP folder → enrich → write back to same folder) MUST scope the read with a path / label filter that excludes the destination folder, OR use `idempotency/source-side-label` to mark mojulo-created files. Otherwise, next run picks up the prior write and re-processes it, inflating the corpus.
- **DOCX/PDF extraction quality varies.** `download_file_content` returns base64; downstream extraction tooling (pdf2json, etc.) may drop metadata, images, or complex formatting. Test extraction on a sample before committing a composition that depends on high-fidelity DOCX/PDF reads.
- **Mime type proliferation.** Google Sheets, Slides, Forms, and Drawings are all distinct mime types. Compositions that assume "anything with 'google-apps' in the mime is readable as text" will fail. Branch explicitly on mime type; skip unsupported types with a clear log message.

<!-- sources
  - https://developers.google.com/drive/api/guides/search-files (search operators, filters, pagination)
  - https://developers.google.com/drive/api/guides/manage-downloads (MIME types, export endpoints)
  - https://developers.google.com/drive/api/reference/rest/v3/files/list (modifiedTime, pageToken, rate limits)
  - https://developers.google.com/drive/api/guides/quotas (1M units/day, quota costs per operation)
  - https://developers.google.com/drive/api/guides/file-create (create_file, permissions, trash lifecycle)
  - https://support.google.com/drive/answer/2375102 (sharing, shortcuts, parents array)
-->
