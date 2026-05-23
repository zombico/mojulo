---
{
  "ref": "gdrive",
  "version": "0.1.0",
  "summary": "Google Drive destination: create-or-append per-period Google Doc, supports drafts, folder-scoped.",
  "requires": {
    "mcpInventoryCategory": "document_store",
    "inventoryServerHints": ["gdrive", "google_drive", "claude_ai_Google_Drive"]
  },
  "capabilities": {
    "writeShapes": ["create_doc", "append_to_doc"],
    "supportsDrafts": true,
    "supportsFolders": true,
    "dedupeSurface": "title_search_in_folder"
  },
  "exposesKnobs": [
    { "name": "folder", "prompt": "Drive folder path to write into (e.g. 'mojulo/weekly-digests').", "default": null },
    { "name": "doc_strategy", "prompt": "One doc per period (separate files) or one rolling doc that gets appended to?", "default": "per-period" }
  ]
}
---

# destination: Google Drive

Google Drive's MCP surface offers per-document create-or-append. The two viable shapes for periodic writes are (a) one fresh Doc per period named with the period key, or (b) one rolling Doc that gets appended to. Both are first-class — the choice is operator preference, surfaced as the `doc_strategy` knob.

## Surface shape

- **Discovery calls.** `create_file` (with mime `application/vnd.google-apps.document`), `read_file_content`, `download_file_content`, `get_file_metadata`, `search_files`, `list_recent_files`. Exact tool names vary by MCP install — check inventory before binding.
- **Folder targeting.** All writes scope to the folder named in the `folder` knob. Search-before-create runs over that folder, not the whole Drive — operators conflate "no duplicate in this folder" with "no duplicate anywhere," and the former is what's actually checked.
- **Draft posture.** Newly-created Docs are private to the operator by default — that IS the draft posture. No explicit "publish" step exists; "promotion" in this MCP means moving to a shared folder OR adding a permission.

## Mapping intent (load-bearing)

- The Doc title carries the dedupe key (typically the period identifier — `YYYY-W##` for weekly, `YYYY-MM` for monthly, `YYYY-MM-DD` for daily). The `idempotency/window-key` component generates this; this destination just consumes it.
- Body shape: markdown — Drive renders it as rich-text on first load. Don't try to write Drive's native XML; markdown round-trips well enough and is what the source-side render components produce.
- Include the **mojulo trace** in the doc body (composition ref, run timestamp, source query window). Without it, an operator scrolling back through a year of digests can't tell which composition produced which doc.

## Pitfalls

- **Permission drift between sessions.** The destination MCP may have rotated permissions or removed scopes since the operator last declared inventory. Verify by reading one real doc from the destination during the dry-run, not just probing `search_files`.
- **`search_files` does fuzzy matching.** Searching for `Linear digest — 2026-W21` may also surface `Linear digest — 2026-W211` (typo) or older `Linear digest 2026-W21` (no em-dash). Tighten dedupe by reading metadata of every hit and matching exactly, not by trusting the search to be exact.
- **Folder doesn't exist.** Drive does not auto-create the folder path — `create_file` with a non-existent parent silently lands in the root. Probe the folder exists during the dry-run; if missing, surface "I'll create folder X" as an explicit step, not a side effect.
- **Trash isn't delete.** A doc the operator "deleted" is still searchable for 30 days. Dedupe checks must filter `trashed: true` out of `search_files` results, otherwise the workflow silently skips a real new write.
- **Quotas on rapid-fire creates.** First-run backfills that create 52 weeks of docs in one pass will hit per-second quotas. Sequence creates with at least 200ms between them, or batch into one larger doc.
