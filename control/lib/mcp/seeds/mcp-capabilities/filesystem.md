---
{
  "ref": "filesystem",
  "version": "0.1.0",
  "summary": "Filesystem MCP: POSIX-ish read/write/list/search against a launch-time allow-list of paths. No auth, no soft-delete, no retention, no fuzzy match beyond name globs. Sub-path scope enforcement is mojulo's discipline (recorded in the binding's `path_prefix`), not the MCP's.",
  "requires": {
    "mcpInventoryCategory": "filesystem",
    "inventoryServerHints": ["filesystem", "claude_ai_Filesystem", "mcp_filesystem", "server-filesystem"]
  },
  "affordances": {
    "read": true,
    "write": true,
    "watch": false
  },
  "capabilities": {
    "cursor": false,
    "cursorField": null,
    "pagination": "none (single-call directory listings; recurse manually)",
    "rateLimit": "none (local I/O — bounded by disk + OS, not vendor)",
    "rateLimitDetails": "Filesystem reads/writes are local I/O. There is no rate limit imposed by the MCP itself; bottlenecks are disk bandwidth, OS file-descriptor caps, and concurrent-write contention if multiple agents share the same allowed-paths root.",
    "writeShapes": ["write_file", "create_directory", "move_file", "edit_file"],
    "readShapes": ["read_file", "list_directory", "search_files", "get_file_info"],
    "contentModel": "raw bytes; tool surface treats most ops as text but binary reads return base64-ish content depending on implementation",
    "supportsDelete": true,
    "supportsDrafts": false
  },
  "intentKeywords": ["filesystem", "folder", "directory", "file", "local", "disk", "scratch", "workspace", "input", "output", "log"],
  "exposesKnobs": [
    { "name": "path_prefix", "prompt": "Sub-path under the MCP's launch-time allowed root that this binding is scoped to. The MCP itself cannot enforce sub-paths smaller than its allow-list — the scope is mojulo's discipline. Pair with regular contextmap reviews if 'nothing was written outside this prefix' is an audit claim.", "default": null },
    { "name": "allowed_paths", "prompt": "The absolute paths the filesystem MCP server is launched with (its allow-list). Sub-folders below these are reachable without relaunch; paths outside them are unreachable. Changing this list requires restarting the MCP server.", "default": null }
  ]
}
---

# mcp: Filesystem

The filesystem MCP exposes a local-disk surface to the agent — read files, write files, list directories, search by name — scoped to an **allow-list of absolute paths set at MCP launch time**. The reference implementation is `@modelcontextprotocol/server-filesystem` from the modelcontextprotocol/servers monorepo; community forks exist with substantially the same interface.

This is the thinnest seed mojulo ships, and deliberately so: a filesystem MCP has none of the rich operational semantics that Gmail (history-id horizons, draft-vs-send), Notion (block model, soft-delete trash), Linear (workflow states, identifier instability), Drive (share permissions, MIME conversions), or Slack (rate-limit tiers, mrkdwn dialect) carry. What it does have — launch-time scoping, the absence of authentication, the absence of retention — is what every mojulo-built or mojulo-bound technique must reason against. The thinness is the value.

## Source-role surface (when `role: 'source'` in the composition)

- **Discovery calls.**
  - `read_file` — read a file by absolute path. Returns the file's bytes (encoding handling varies across implementations; most return UTF-8 text and reject or base64-wrap binary).
  - `list_directory` — list immediate children of a directory. Non-recursive by default; recursion is the caller's responsibility.
  - `search_files` — glob-based name match against the allow-list. Returns matching absolute paths. Most implementations do not full-text search file contents — they search filenames only.
  - `get_file_info` — stat-like metadata: size, modified time, type (file vs directory vs symlink).
- **Cursor.** There is **no native cursor**. The agent's options for "process files added since last run" are: (a) sort by `mtime` from `get_file_info` and persist a high-water timestamp, (b) maintain an in-binding state of processed-paths and diff against the current listing. Option (a) is more idempotent against renames; option (b) handles in-place mutations more honestly. Pick at composition time.
- **Watch surface.** **No subscribe-to-changes affordance on current filesystem MCPs.** The OS provides inotify (Linux) / FSEvents (macOS) / ReadDirectoryChangesW (Windows) but no shipping MCP exposes those as a tool. Compositions over this source must poll. A reasonable cadence is whatever the underlying workflow tolerates — `list_directory` against a sub-folder is microseconds locally, so polling at 1 Hz is cheap; polling at 1 mHz is fine if the data only changes daily.
- **Rate limit.** None imposed by the MCP. Bottlenecks are OS-level (open-file-descriptor caps) and disk-level (concurrent-write contention). Treat as effectively unbounded for sequential workflows.

### Mapping intent for source role (load-bearing)

- **Absolute paths only.** The MCP rejects relative paths because the allow-list it was launched with is absolute. Bindings persist absolute paths; "relative to workspace_root" is mojulo's compute, not a value passed to the MCP.
- **The allow-list is the only enforced scope.** If `path_prefix` on the binding is `/Users/op/workspace/digest-skill` but the MCP was launched with `/Users/op` as its allowed root, an agent that ignored the binding could write anywhere under `/Users/op`. Treat `path_prefix` as guidance for honest agents, not as a sandbox.
- **`search_files` is glob, not regex, not full-text.** Patterns are `*.json`, `**/*.md`, `digest_*`. Compositions that need content-aware matching (find files containing string X) must `list_directory` + `read_file` + filter in the agent layer.
- **`mtime` is the workhorse, `ctime` is not portable.** Modification time is reasonably consistent across OSes; change time, creation time, and access time semantics vary. Build cursors on `mtime`.
- **Symlinks are reachable when launch allow-list includes their target.** A symlink at `/Users/op/workspace/alias` pointing to `/etc/shadow` is unreachable unless `/etc/shadow` is also allowed. The allow-list constrains the resolved target, not just the symlink path. Be skeptical of in-workspace symlinks the operator didn't place themselves.

## Destination-role surface (when `role: 'destination'` in the composition)

- **Discovery calls.**
  - `write_file` — create or overwrite a file at an absolute path. Atomic on most implementations (write to temp, rename), but not guaranteed; do not assume crash-safety.
  - `create_directory` — `mkdir -p` semantics on most implementations; no-op if the directory already exists.
  - `move_file` — rename or move. Cross-device moves may fall back to copy+delete (not atomic across filesystems).
  - `edit_file` — implementation-specific. Some MCPs expose a structured edit affordance (find/replace; line range edit); others omit it and require read+modify+write.
- **Required fields for write.** Absolute path within the launch-time allowed root, and content bytes. No metadata, no auth, no audience.
- **Dedupe surface.** `write_file` overwrites. The MCP doesn't dedupe; the agent's options are (a) check existence with `get_file_info` before writing, (b) use a content-addressed filename (hash-of-content as the basename), or (c) use a timestamped filename and accept proliferation. Pair this destination with `idempotency/window-key` keyed on a workflow-stable identifier (a date-stamp for digests, a source-event id for extractions) — not a UUID, which produces a new path on every run.
- **Draft posture.** Not first-class. The standard substitute is a draft sub-path: write to `<path_prefix>/drafts/<filename>`, review, then `move_file` to the final scope. This is the local analog of Drive's "draft folder → shared folder" pattern; the operator is responsible for the directory convention because the filesystem has no notion of "share" to gate on.

### Mapping intent for destination role (load-bearing)

- **Files don't have audiences; folders do.** A file at `/Users/op/workspace/inbox/secrets.json` is visible to anyone the operator gives shell access to. The audience model for a filesystem destination is "anyone who can read this folder" — set by `chmod`, by group membership, by the share semantics of cloud-sync tools the operator may have layered on (Dropbox, iCloud, Time Machine targets). Bindings should record an audience principle separately if the operator's threat model demands it; the MCP itself has no audience knob.
- **Atomic writes are best-effort.** Most filesystem MCPs implement `write_file` as "write to temp, rename" which is atomic *on the same filesystem*. Cross-filesystem renames degrade to copy+delete, which is not atomic. If the binding's `path_prefix` is on a different mount than the OS tempdir, expect non-atomic behavior on those writes.
- **No undo.** `write_file` overwrites without backup. `move_file` to an existing target overwrites it. There is no soft-delete, no trash, no revision history at the MCP layer. Compositions that need rollback must implement it in the agent (write to a versioned subfolder; promote via `move_file`) or rely on operator-provided backup tooling (Time Machine, restic, etc.) — neither of which the binding can observe.
- **Path collisions are silent.** `write_file` to a path that already exists succeeds and overwrites; there's no 409 / "already exists" affordance on most implementations. The agent must `get_file_info` first if collision-vs-overwrite matters to the composition.
- **Encoding is the agent's problem.** Most MCPs treat content as UTF-8 text. Writing binary (images, archives, parquet) typically requires either a base64-encoded text path with a separate decode step downstream, or a different MCP entirely. The plain `write_file` affordance is text-shaped.

## Watch-role usage

**Not currently bound.** The OS provides change-notification APIs (inotify on Linux, FSEvents on macOS, ReadDirectoryChangesW on Windows) but **no shipping filesystem MCP exposes them as a subscribable tool**. Compositions over filesystem sources use `trigger: signal-polled` against `mtime`-sorted directory listings.

If a future MCP exposes a watch affordance, the appropriate move is the same as for any vendor: re-run the `research-mcp-vendor` catalyst against that MCP and let supersession swap in the new capability row. Until then, polling cadence is the binding's responsibility.

## Pitfalls (apply across roles)

- **Allow-list changes require relaunch.** The launch-time allow-list is fixed for the MCP's process lifetime. Changing `operator.workspace_root` (or adding a second allowed root) requires the operator to relaunch the MCP server with new CLI args. The catalyst body surfaces the new launch command; the operator runs it. There is no in-process reconfiguration tool.
- **Sub-path enforcement is discipline, not sandbox.** This is repeated here because it's the most common misread. `path_prefix` on a binding tells *the agent* where to write; the MCP enforces *only the allow-list*. A binding scoped to `/Users/op/workspace/digest-skill` against an MCP allowed `/Users/op` means an agent that ignored the binding could clobber `/Users/op/.ssh/id_rsa`. The audit chain (the binding row plus the contextmap commit referencing it) is mojulo's evidence that the write was *supposed* to be scoped; it is not a runtime block.
- **Symlink escape.** When `path_prefix` is under a directory the operator controls but the operator placed a symlink pointing outside, writes traverse the symlink. The MCP's allow-list constrains the *resolved* target, but the binding's `path_prefix` is a string prefix — so a symlink-aware enforcement would require walking the path at every write. Treat operator-managed symlinks under the workspace as a known caveat; flag any symlink discovered under a binding's `path_prefix` during dry-run.
- **Concurrent writes from multiple agents.** Two parallel agents writing to the same path race. There is no file lock affordance in the MCP. Compositions that genuinely need concurrent writes must use a different primitive (`local-sql` with its embedded write-lock) or coordinate at the agent layer.
- **No native dedupe key.** Unlike a CRM (record ids), a calendar (event ids), or a doc store (file ids returned from create), the filesystem returns nothing useful for dedupe — just the path, which the agent already knew. Compositions must derive a dedupe key from filename content (date-stamps, content hashes, source-event refs) and persist it on the binding's idempotency state.
- **`get_file_info` includes hidden / system files.** `list_directory` typically does not include dotfiles by default on most implementations; `get_file_info` of an explicit dotfile path works. Workflows that need to ignore `.DS_Store`, `.git/`, `node_modules/`, etc., must filter at the agent layer — the MCP has no concept of "ignore patterns."
- **Workspace as a side channel.** Operators often have personal data in their home directory: SSH keys, password manager exports, browser cookies, financial documents. An MCP launched against `/Users/op` (a common mistake) opens all of this to the bound agent. The technique catalyst's setup step *must* steer the operator toward a dedicated workspace folder, not their home.
- **No retention.** A file written today is there forever unless something deletes it. Workflows that need bounded retention (rolling logs, expired drafts) must implement TTL themselves — a `scheduled-task` technique paired with `local-storage` is the canonical shape, deferred until that technique ships.

## Tool-name divergence note

The reference implementation `@modelcontextprotocol/server-filesystem` exposes snake-cased tools: `read_file`, `write_file`, `list_directory`, `create_directory`, `move_file`, `search_files`, `get_file_info`, `edit_file`. Community forks (server-everything's filesystem subset, third-party rewrites) typically preserve these names but occasionally rename `read_file` → `read_text_file` or split `edit_file` into multiple affordances. The capability row's `readShapes`/`writeShapes` list semantic anchors (`read_file`, `write_file`, etc.); the generator's bind-time discovery resolves them to whatever the bound MCP actually exposes. **Compositions must not hard-code MCP tool names** — they reference affordance names from the primitive (`read`, `write`, `watch` for document-store; `list-recent`, `find-by-key-in-scope`, `create-with-mime` etc. for sub-affordances on richer primitives), and the generator binds them to actual tool names at composition time.

<!-- sources
  - mojulo://CHANGELOG#v0.7.0 (capability body authored as the seed for the `local-storage` technique; thinness is deliberate per the technique's family-template alignment)
  - https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem (reference implementation; canonical tool names and allow-list-at-launch semantics)
-->
