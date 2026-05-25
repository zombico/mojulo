---
{
  "ref": "notion",
  "version": "0.1.0",
  "summary": "Notion MCP: read (search / fetch pages + data sources, last_edited_time cursor) and write (create page, update page, query data source, create comment) affordances. Multi-faceted surface — page-side and database-side are distinct read/write shapes.",
  "requires": {
    "mcpInventoryCategory": "knowledge_base",
    "inventoryServerHints": ["notion", "notionhq", "makenotion", "claude_ai_Notion"]
  },
  "affordances": {
    "read": true,
    "write": true,
    "watch": false
  },
  "capabilities": {
    "cursor": true,
    "cursorField": "last_edited_time",
    "pagination": "start_cursor",
    "rateLimit": "requests-per-second",
    "rateLimitDetails": "Average 3 req/sec per integration; bursts permitted; 429 returns Retry-After header (seconds).",
    "supportsSearchOperators": false,
    "searchFilterValues": ["page", "data_source"],
    "writeShapes": ["create_page", "update_page", "create_comment", "create_data_source", "update_data_source", "move_page"],
    "readShapes": ["notion-search", "notion-fetch", "notion-query-data-sources", "notion-query-database-view", "notion-get-comments"],
    "contentModel": "block-tree",
    "requestLimits": {
      "blocksPerRequest": 1000,
      "payloadBytes": 500000,
      "richTextChars": 2000,
      "blockArrayElements": 100
    },
    "supportsDelete": false,
    "supportsDrafts": false,
    "apiVersion": "2025-09-03"
  },
  "intentKeywords": ["notion", "page", "database", "wiki", "doc", "knowledge", "workspace", "data source", "teamspace"],
  "exposesKnobs": [
    { "name": "scope", "prompt": "Notion scope for reads — a specific data source / database id, a parent page id, or 'workspace' (search-all). Workspace-wide reads return everything the integration is shared into.", "default": null },
    { "name": "object_filter", "prompt": "Restrict search to 'page', 'data_source', or both? ('database' is not a valid filter value as of API 2025-09-03 — databases are addressed via data sources.)", "default": "both" },
    { "name": "write_parent", "prompt": "When this MCP plays the destination role: parent id (a page_id for a sub-page, or a data_source_id for a database row). Required — Notion will not create top-level pages without a parent.", "default": null },
    { "name": "write_shape", "prompt": "Destination write shape: 'page-under-page' (create_page with page_id parent — free-form sub-page), 'row-in-data-source' (create_page with data_source_id parent — schema-bound row), or 'comment' (create_comment on an existing page/block).", "default": "page-under-page" },
    { "name": "promote_via_share", "prompt": "Notion has no 'publish' affordance — newly created pages inherit the parent's sharing. If a dry-run posture is needed, set this to false and target a private parent page; promotion is then a manual move/share by the operator.", "default": true }
  ]
}
---

# mcp: Notion

Notion is a knowledge-base / workspace product whose MCP surface is **bidirectional and multi-faceted** — it exposes both a *page* surface (free-form documents arranged in a tree) and a *data source* surface (schema-bound rows in databases). The two are addressed by different parent ids and have different write shapes, and the composer MUST decide which one the composition is targeting before binding. One MCP, two roles, two surfaces per role.

The canonical implementation is the official `makenotion/notion-mcp-server` (npm `@notionhq/notion-mcp-server`), shipped in both a Notion-hosted remote variant (OAuth, recommended by Notion) and a self-run local variant (integration token, may be sunset). Tool names below reflect the remote variant — the local OpenAPI-bridged variant exposes lower-level names like `v1/search`, `query-data-source`, `retrieve-a-data-source` that map 1:1 to the same Notion REST endpoints.

## Source-role surface (when `role: 'source'` in the composition)

- **Discovery calls.**
  - `notion-search` — title-prefix search across pages and data sources the integration is shared into. Filter values: `"page"` or `"data_source"` (NOT `"database"` — that filter was removed in API 2025-09-03). Sort by `last_edited_time` (asc/desc) or `relevance`. **Notion search does NOT support body/full-text operators** — it matches titles only. If the composition needs body match, the agent must fetch and grep client-side.
  - `notion-fetch` — retrieves a page, database, or data source by id or URL. Returns schema + properties. For pages with nested content, returns top-level blocks; deeper blocks require a follow-up walk via `has_children` (each child block is a separate retrieve, NOT one flat tree).
  - `notion-query-data-sources` — structured query over a database's data source (filter / sort / group). Returns rows (each row is itself a page). **Plan-gated:** Enterprise + Notion AI as of the remote-server docs. The local server's `query-data-source` has no such gating.
  - `notion-query-database-view` — query using an existing saved view's filters/sorts. Plan-gated: Business + Notion AI.
  - `notion-get-comments` — list comments and discussion threads on a page or block.
- **Cursor.** `last_edited_time` (ISO 8601), exposed on every page and data source. Persist the last successfully-processed value as the cursor; on next poll, search with `sort.timestamp = "last_edited_time"` descending and walk back to the cursor. Pagination is `start_cursor` / `page_size` (default 100, max 100) with `next_cursor` + `has_more` in the response.
- **Watch surface.** **None.** Notion has no webhook or change-feed in the public API as of 2026. Poll-only. The composer should always pair this source with `trigger/signal-polled`.
- **Rate limit.** Average 3 requests/sec per integration; bursts permitted. 429 returns a `Retry-After` header (integer seconds) — respect it. A page fetch that walks a deeply nested block tree can easily fan out to dozens of `retrieve_block_children` calls; clamp tree-walks by depth, not by call-count guesswork.

### Mapping intent for source role (load-bearing)

- **A page is NOT a flat document.** It's a tree of block objects (`paragraph`, `heading_1..4`, `bulleted_list_item`, `toggle`, `callout`, `code`, `table`, `column_list`, ~30 types total). `notion-fetch` on a page returns the top-level blocks with `has_children: true|false`; rendering full content requires recursive child fetches. The render component must either flatten-to-markdown (lossy on columns/tables) or preserve structure (verbose). Either is defensible; pick one in the composition and document it.
- **The natural primary key for idempotency is the page `id` (UUID)** — NOT the title. Notion freely allows duplicate titles, and the URL slug embeds the title with hyphenation that changes whenever the title is edited (URL changes, id is stable).
- **`last_edited_time` lies during cascading edits.** Editing a parent block updates the parent's `last_edited_time` but may also touch children's depending on the edit. For "what changed this week" semantics, treat the field as a cursor floor, not a delta marker; dedupe downstream by page id.
- **Data source rows ARE pages.** A row in a Notion database is itself a page object — it has a parent (`data_source_id`), schema-bound properties, and optional page-body blocks. When the composition reads "rows from a CRM database," it's reading pages whose parent is a data source. This is the same shape as reading free-form pages, just with structured properties on top.
- **The `database` filter value no longer exists.** API 2025-09-03 introduced "data sources" as the primary abstraction; the search filter values are `"page"` and `"data_source"`. A composition written against pre-2025 examples that filters for `"database"` will silently return zero results.
- **Search is title-only.** Operators expect Notion search to behave like Notion's in-app search (which does body match). The API search does not. Set this expectation in the composition's `intent` rather than failing silently at runtime.

## Destination-role surface (when `role: 'destination'` in the composition)

- **Discovery calls.**
  - `notion-create-pages` — creates one or more pages. Required: a `parent` (either `page_id` for a sub-page or `data_source_id` for a database row) and `properties` (title for page-under-page, schema-bound for row-in-data-source). Optional: `icon`, `cover`, `children` (block array, max 100 per request), `template` id.
  - `notion-update-page` — patches page properties, icon, cover, and content. Use this for "append a section" by passing `children` (Notion appends them as a block update).
  - `notion-create-comment` — adds a comment to a page or block, or replies to an existing discussion.
  - `notion-create-database` / `notion-create-data-source` — schema-creating writes; rare in normal compositions, used when the workflow itself provisions the destination.
  - `notion-move-pages` — re-parents pages or databases. Useful for the "promote from private draft to shared folder" pattern.
- **Two distinct write shapes.**
  1. **page-under-page** — `parent = { page_id }`. The destination is a sub-page in a free-form tree. The page's title is operator-chosen prose; body is a block array. Closest analog to the gdrive `create_doc` pattern.
  2. **row-in-data-source** — `parent = { data_source_id }`. The destination is a row in a database. `properties` MUST match the data source's schema (call `notion-fetch` on the data source first to discover the schema). Closest analog to Linear `create_issue` — schema-bound, validated on the server.
- **Dedupe surface.** Notion has **no native idempotency key on create** — duplicate `notion-create-pages` calls produce duplicate pages or rows. Pair this destination with `idempotency/destination-search` (search-before-create on title + parent) or `idempotency/state-ledger` (cursor on source signal ids). The title-only search means destination-search dedupe is only reliable when the title is itself the dedupe key (e.g., `YYYY-W##`-style period titles); for arbitrary content, prefer state-ledger.
- **Draft posture.** **None.** Notion has no "draft" or "publish" affordance — a created page is immediately visible to whoever has access to its parent. The substitute pattern is *target a private parent*: create into a parent page the integration is shared into but no human collaborators are, then surface "promote by moving / sharing" as the operator's manual step. The `promote_via_share` knob captures this choice.

### Mapping intent for destination role (load-bearing)

- **Choose the write shape before composing.** "Write a summary to Notion" is under-specified — does it mean a new sub-page under a wiki home, or a new row in the meeting-notes database? Surface this to the operator at composition time; the two shapes have different parent requirements, different idempotency keys, and different downstream renders.
- **For row-in-data-source: discover the schema first.** Call `notion-fetch` on the `data_source_id` to enumerate property names + types. Do not hard-code property names from a sample; data source schemas drift, and a stale property name fails the write with a `validation_error`.
- **Include the mojulo trace in a stable place.** Write composition ref + run timestamp + source query as either (a) a `Source` rich-text property on the data source row, or (b) a callout block at the top of the created page body. Without it, an operator looking at an mcp-orbit-created page six months later can't tell which composition produced it.
- **Respect the 100-block-per-`children` cap.** Long renders (a 200-block weekly digest) must either be split across a `create_pages` + one or more `update_page` (append) calls, OR the render must be compressed to fewer, denser blocks. The composer should hint at the limit in the destination's render contract.
- **No delete via MCP.** The official server explicitly does not expose database deletion (page archive is supported via `update_page` setting `in_trash: true`). Compositions that depend on cleanup must surface the manual step.

## Watch-role usage

Notion has no push surface. `affordances.watch: false` is intentional. Compositions that need near-real-time response to Notion changes will need to poll at a cadence the operator picks (the 3 req/sec limit comfortably supports a 30s poll over a small set of pages, but a workspace-wide search every 30s will saturate the rate limit fast — clamp to minutes for broad scopes).

## Pitfalls (apply across both roles and both surfaces)

- **Integration sharing is page-level, not workspace-level.** A fresh integration sees nothing until the operator explicitly shares pages with it (via the page's `...` menu → Connections). Sharing a parent page DOES cascade to children, but private pages and teamspace-roots may not be visible at all. A composition's first dry-run MUST probe a real page read; a successful `notion-search` with zero results means "the integration is connected but not shared into any matching content," not "no content exists."
- **Page vs data-source-row schema mismatch.** A `create_page` against a `data_source_id` parent with a `properties` object that doesn't match the data source's schema returns `validation_error` with a field-level message. Surface that error verbatim — operators frequently mis-name properties (`"Status"` vs `"status"` vs `"State"`) and the error names the offender.
- **Block model is lossy in both directions.** Rendering a Notion page to markdown drops column layouts, synced blocks, and embeds. Rendering markdown INTO Notion via `create_page`'s `children` lands as paragraph + heading + list blocks but loses tables (markdown tables don't round-trip to Notion's `table` block without explicit conversion). Pick a lossy direction and document it in the composition's render contract — don't pretend it's lossless.
- **"Database" terminology drift.** Pre-2025 docs, examples, and most blog posts use `database_id`; API 2025-09-03 onward uses `data_source_id`. A database now contains one or more data sources (most contain exactly one, but the API requires the id of the data source, not the database). `notion-fetch` on a database returns the data source ids as a field; the agent must walk that indirection.
- **Rich-text 2000-char cap per block.** A single paragraph block cannot hold more than 2000 characters. Renders that paste long source bodies verbatim will either be truncated or rejected. Split into multiple paragraph blocks at sentence boundaries before writing.
- **Comments are not page content.** `notion-create-comment` writes to the comment thread, NOT the page body. A composition that intended "add a note to the page" but wrote a comment will silently produce a side-channel that doesn't show up in the page's main view. Disambiguate at composition time.
- **Rate-limit fanout from block-tree walks.** A single "fetch this page" intent can cascade to dozens of `retrieve_block_children` calls. Compositions reading many pages per poll WILL hit the 3 req/sec limit — back off on `Retry-After`, and prefer flattening at fetch time over deep tree preservation when the render doesn't need structure.
- **Plan-gating on the remote server.** `notion-query-data-sources` (Enterprise) and `notion-query-database-view` (Business+) are gated by the operator's Notion plan tier when using the Notion-hosted remote MCP. The local self-run server exposes equivalent functionality without gating (via the underlying REST API). Composer should check inventory hints to decide which surface is live before recommending a query-heavy composition.
- **Workspace-search surface area.** A workspace-wide `notion-search` with no scope returns everything the integration is shared into, which for a power-user operator can be thousands of pages. First-run backfill clamp applies: scope to a known parent or to a date window before sweeping.

<!-- sources
  - https://github.com/makenotion/notion-mcp-server (official local server README)
  - https://developers.notion.com/guides/mcp/mcp-supported-tools (remote MCP tool list)
  - https://developers.notion.com/docs/common-mcp-clients (remote vs local distinction)
  - https://developers.notion.com/reference/post-search (search filter values, pagination, sort)
  - https://developers.notion.com/reference/request-limits (3 req/sec, 100 block array cap, 1000 blocks/req, 2000-char rich-text cap, 429+Retry-After)
  - https://developers.notion.com/reference/block (block model, has_children, in_trash/archived)
  - https://developers.notion.com/docs/create-a-notion-integration (page-level share-to-grant, parent-to-child propagation)
-->
