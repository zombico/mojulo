# Changelog

All notable changes to the `mojulo` npm package are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
While in `0.x`, the artifact format and bundled bot image are pinned per
control-plane version — a minor bump may move the pinned bot image tag.

## [0.6.0] — 2026-05-25

Ring 6 gains a **semantic recall surface** over the durable app state it already accumulates. The structured readers (`meta_context_brief`, `get_mcp_orbit_component`, `get_catalyst`, `get_mcp_capabilities`, …) answer "give me the full row at this ref"; the new `semantic_search` answers the other direction — "which refs are relevant to this intent at all?" One unified sidecar (`meta_embeddings`) covers seven source kinds — principles, declared MCP inventory tools, current capability bodies, mcp-orbit components / compositions / provider artifacts, and the shipped catalyst markdown — keyed on `(source_kind, source_ref)` with `content_hash`-based skip on re-embed. Embeddings are computed by the already-in-process multilingual-e5-small ONNX model that powers bot-side RAG; no new native dependency, no external API. The plan that motivates the shape lives in [lite-template/integration/SEMANTIC_INDEX_PLAN.md](../lite-template/integration/SEMANTIC_INDEX_PLAN.md).

### Added

- **`meta_embeddings` table** in [lib/db/index.js](lib/db/index.js) — single sidecar, `(source_kind, source_ref)` unique, raw little-endian `float32[384]` BLOB embedding, `content_hash` sha256 of the body, `model` column reserved for future model swaps without a destructive rebuild. CHECK constraint pins the seven source kinds. Backed by a per-kind index on `source_kind`.
- **`EmbeddingsRepository`** at [lib/db/repositories/embeddings.js](lib/db/repositories/embeddings.js) — split sync/async API forced by better-sqlite3's "transaction fn must be synchronous" rule against `generateEmbeddings(...)` being async. The contract every source-row write path follows: *compose body text → `await embed(...)` outside the txn → enter the sync `db.transaction(fn)` that writes the source row + `upsertSync` the embedding row together*. Atomicity is preserved end-to-end: if the host write rolls back, the embedding write rolls back with it. `embed` / `embedMany` are hash-skip-aware (existing row, same hash → returns `vector: null` so the upsert no-ops); pass `{ skipUnchanged: false }` from write paths whose host txn deletes the prior embedding row first (inventory replace) where the skip would silently lose the vector. `deleteByRefSync` and `deleteByRefPrefixSync` cover the deletion paths (the prefix variant LIKE-escapes wildcards so a server name containing `_` or `%` doesn't widen the delete). `search(query, { kinds, limit })` runs the query through the existing `generateEmbeddings(..., { inputType: 'search_query' })` (which owns the e5 `query: ` prefix), loads the optionally-kind-filtered rows, scores cosine in JS, sorts, slices — sub-50ms at expected corpus size after model warm-up.
- **Capability supersession filter on search** — `search` joins against `meta_mcp_capabilities` + `meta_mcp_providers` and quietly drops any `mcp_capability` row whose backing capability is no longer the current one for its provider. A row in `meta_embeddings` without a current capability entry is never returned. This is the load-bearing property pinned by the embeddings test suite — a regression here would let the agent recall stale vendor knowledge.
- **`semantic_search` MCP tool** at [lib/mcp/tools/semantic-search.js](lib/mcp/tools/semantic-search.js) — Ring 6, registered LAST so the reading order is *orientation → action → deliberation (structured walks: brief, inventory, capabilities, composer, primitive-binding) → deliberation (fuzzy recall: semantic_search)*. Returns `{ results: [{ source_kind, source_ref, score, snippet }] }` with snippets capped at ~280 chars — the contract is *retrieve, don't resolve*; the agent pairs results with the structured readers to pull full bodies for any row worth the context cost. Optional `kinds` filter restricts to one or more of the seven source kinds; default returns all. Read-only.
- **`reindexAll()` helper + `scripts/reindex-embeddings.js` CLI** at [scripts/reindex-embeddings.js](scripts/reindex-embeddings.js) — one-shot backfill across every source kind (`SELECT` per source table → compose body via the kind's `BodyComposition` helper → batched `embedMany` → single sync `db.transaction(fn)` of `upsertSync` calls). Idempotent (hash-skip on every row). Use when body-composition logic changes (e.g. mcp_tool body shape evolves) so existing rows recompute their hashes against the new shape, or when first-boot auto-run failed and the operator wants to retry manually, or when catalyst markdown was updated in-place without a source-row write to trigger the per-write hook.
- **First-boot auto-backfill** via `maybeBackfillEmbeddings(db)` in [lib/db/index.js](lib/db/index.js) — runs after `migrateInventoryColumns` + `reapStaleMcpJobs`. Short-circuits when `meta_embeddings` already has rows; further short-circuits when *no source-row exists yet across the entire corpus* (catalysts are filesystem-only and small; reindexing them on every fresh boot pre-source-write is wasteful). Fires the reindex as fire-and-forget so `getDb()` isn't blocked on model load. `MOJULO_SEMANTIC_INDEX_DISABLED=1` skips the auto-run; the CLI ignores that flag (it's the manual recovery path).
- **Body composition helpers** exported alongside the repo: `composeMcpToolRef`, `composeMcpToolBody`, `composeOrbitComponentRef`, and the per-kind `BodyComposition` map (`principle` / `capability` / `orbitComponent` / `orbitComposition` / `orbitArtifact` / `catalyst`). Centralizing composition keeps the index consistent across the per-write hooks and the bulk reindex — the canonical body shape per source kind is defined once.
- **Test suites** for every source kind's write-path integration with the sidecar: [embeddings.test.js](lib/db/repositories/embeddings.test.js), [mcp-capabilities-embedding.test.js](lib/db/repositories/mcp-capabilities-embedding.test.js), [mcp-inventory-embedding.test.js](lib/db/repositories/mcp-inventory-embedding.test.js), [mcp-orbit-embedding.test.js](lib/db/repositories/mcp-orbit-embedding.test.js), [mcp-orbit-provider-artifacts-embedding.test.js](lib/db/repositories/mcp-orbit-provider-artifacts-embedding.test.js), [meta-context-embedding.test.js](lib/mcp/tools/meta-context-embedding.test.js), and the cross-kind [semantic-search.integration.test.js](lib/mcp/tools/semantic-search.integration.test.js). Coverage pins: per-source upsert on insert, hash-skip on unchanged body, replace-semantic deletion of stale tool rows on inventory replace, current-row-only recall on capability supersession, soft-fail posture (host write commits even if the embed fails), and cross-kind cosine recall against a populated corpus.

### Changed

- **Source-row write paths upsert into the sidecar.** Per the plan's pre-embed-then-sync-txn discipline, every write that lands new body text in a source table now mirrors into `meta_embeddings` atomically:
  - **`meta_context_commit`** in [lib/mcp/tools/meta-context.js](lib/mcp/tools/meta-context.js) — pre-embeds every principle's `body_md` in one `embedMany` batch before opening the commit txn; inside the sync txn, `upsertSync('principle', String(insertedId), ...)` rides alongside each `INSERT INTO meta_principles`. A `meta_context_commit` that writes 10+ principles for an artifact materialization pays one batched embed call before the txn opens.
  - **`InventoryRepository.replaceInventory`** in [lib/db/repositories/mcp-inventory.js](lib/db/repositories/mcp-inventory.js) — batched `embedMany({ skipUnchanged: false })` for every tool body across all servers, then in the sync txn each server's prior tool embeddings are dropped via `deleteByRefPrefixSync('mcp_tool', `${server}::`)` and the new ones inserted. `skipUnchanged: false` is load-bearing — the prefix delete would otherwise lose any vector that hash-matched a since-deleted row.
  - **`CapabilitiesRepository.record`** in [lib/db/repositories/mcp-capabilities.js](lib/db/repositories/mcp-capabilities.js) — embed the new row's `body_md` before the 3-statement supersession dance; inside the sync txn, `upsertSync('mcp_capability', provider_ref, ...)` writes the new vector and the prior superseded row's embedding stays in place (search filters by `superseded_by IS NULL` so it never surfaces). No churn on supersession; full history walks (`asOf`) still work against the source table.
  - **`MCPOrbitComponentRepository.upsert` / `MCPOrbitCompositionRepository.create` / `MCPOrbitProviderArtifactRepository.create`** in [lib/db/repositories/mcp-orbit.js](lib/db/repositories/mcp-orbit.js) + [lib/db/repositories/mcp-orbit-provider-artifacts.js](lib/db/repositories/mcp-orbit-provider-artifacts.js) — embed `body_md` / `intent_md` / `body_md` (respectively) before the insert; `upsertSync` inside the txn under the kind's composed ref (`${kind}/${ref}@${version}` for components, raw `ref` for compositions, raw `ref` for provider artifacts).
  - **Catalyst seeds** in [lib/mcp/seeds/mcp-capabilities-seed.js](lib/mcp/seeds/mcp-capabilities-seed.js) — first-install seeding through the same `CapabilitiesRepository.record` path mirrors into the sidecar, so the four shipped vendor bodies (gmail / notion / linear / google_drive) are searchable from the first session without an explicit reindex.
  - **Catalyst markdown library** — no per-write hook (catalysts are filesystem-immutable per install). The auto-backfill on first boot picks them up via the `BodyComposition.catalyst` helper (full markdown recomposed from the loader's structured form); operators who hand-edit catalysts re-run `scripts/reindex-embeddings.js`.
- **`forward_context` Ring 6 tool index** in [lib/mcp/tools/context.js](lib/mcp/tools/context.js) gains a `semantic_search` entry that names the read-side relationship explicitly: *brief* / structured readers answer ref-then-fetch, *semantic_search* answers intent-then-rank. Cold-load posture (~2–4s on first call after a control-plane restart, sub-50ms thereafter) and the capability supersession filter are both surfaced in the tool description so the agent doesn't have to guess.

### Notes

- **Why not a vector DB?** SQLite + JS cosine over an in-memory result set is sufficient at the projected corpus size (hundreds → low thousands of rows). The `embedding BLOB` column shape is already compatible with [`sqlite-vec`](https://github.com/asg017/sqlite-vec)'s `vec0` virtual tables — the swap is a future migration with no row-shape change. Defer until the corpus actually crosses ~10k rows.
- **Why one sidecar, not per-table?** Source-table write disciplines diverge sharply (append-only / replace / append-with-supersession / append-on-version) — that divergence is meaningful at write time but has no equivalent at read time. The agent wants *relevant text*, regardless of which table holds it. One sidecar matches the read shape and lets each write path keep its own discipline; the cost is one extra coordinate (`source_kind`); the benefit is one place to evolve embedding strategy and one tool the agent has to learn.
- **Soft-fail posture.** Embed failures never block the host write: the repo logs and the source row commits without a corresponding embedding entry, and the agent loses recall on that specific row until the next `reindexAll`. The plan accepts this for individual rows (principles / components / compositions) and explicitly for bulk paths (a network blip during inventory replace leaves a whole server's tools un-indexed; the operator re-runs the CLI). Existing rows are NOT deleted on soft failure either — a prior good embedding stays in place even if the latest embed failed, so recall doesn't regress below the previous state.
- **Cold load.** First embed after a control-plane restart pays ~2–4s of model load (the same multilingual-e5-small q8 ONNX that powers bot-side RAG, hoisted in-process via [lib/embedder/local.js](lib/embedder/local.js)). Subsequent calls in the same process are sub-50ms at expected corpus size. The first embed is typically a write-path call (e.g. `meta_context_commit`), not a `semantic_search` — acceptable, both surfaces are deliberation-rate, not run-rate.
- **Explicit non-goals** (these keep the plan durable): not embedding the internal MCP tool registry (Rings 0–6 — small, taxonomic, already loaded via `forward_context`); not embedding conversation data (lives in bot SQLite, `bot-proxy.js`-mediated reads only); not embedding `meta_nodes` / `meta_edges` payloads (predominantly identifiers — low-signal noise; navigable via `meta_context_brief`); not coupling to meta-catalyst evolution (the index keys on stable schema row identifiers, content picks up content changes via `content_hash`).

## [0.5.0] — 2026-05-25

Ring 6 grows from three surfaces to five. The deliberation substrate v0.4.0 introduced (contextmap / inventory / mcp-orbit composer) gains two more first-class surfaces: **capabilities** (vendor knowledge with transactional supersession + asOf history, sibling to inventory's introspection facet — both write through one identity layer per provider) and **primitive binding** (a runtime-introspected composer that fills vendor-agnostic primitive templates with the operator's actual bound tool names + schemas). The vendor-shaped mcp-orbit composer that anchored v0.4.0 stays in place but steps back to seed-reasoning duty; `bind_primitives` is the supported path for MCP-to-MCP composition where the agent has runtime tool-schema knowledge — which is the common case for Claude Code, Codex, and similar hosts.

The composer rewires around a **consolidated provider view** that joins identity + inventory + capabilities into one record per logical MCP, with five composer states per chosen provider (`research` / `seed` / `inventory_only` / `capabilities_only` / `none`) that surface as their own warning tags so the agent routes remediation directly. Vendor curation gets decoupled from build-time, lifecycle-bound seeds: four curated vendor bodies (gmail / notion / linear / google_drive) ship as seeds on first install for cold-start reasoning, with the `research-mcp-vendor` catalyst as the agent-side refresh path. The primitive layer ships four primitives — `document-store`, `structured-record-store` (typed records across issue trackers + CRMs + spreadsheet-databases), `messaging-channel`, `message-thread` — each as body + source-role template + destination-role template, with a deterministic generator that fills the templates against capability snapshots at bind time.

`source` and `destination` lift from component kinds to **composition roles** carried per-entry in `component_refs`. Adding a new MCP to the library is now one `mcp` component declaring its affordances, not two source/destination components, and the same MCP plays both roles in compositions that read and write the same backend (Linear digest → Linear, HubSpot enrichment → HubSpot). Two new starter component kinds — `trigger/signal-polled` and `pattern/routing` — extend the composer past scheduled-aggregation into signal-driven shapes, proven end-to-end against the gmail-support-thread → linear-issue catalyst.

### Composer: source/destination as composition roles

First structural refinement past the 0.4.0 baseline. Surfaced as feedback after merge: the 0.4.0 shape encoded `source` and `destination` as **component kinds**, forcing each MCP that wanted to play either role to ship as two components (`source/gmail` + `destination/gmail`). That cut off real workflows where an MCP needs to be on both sides (Drive folder watcher → digest into another Drive doc; Linear closed issues → enrichment → back to Linear). The fix is structural but cheap: lift source/destination from component-kind to **composition-role**, carried per-entry in `component_refs`. The bones don't change; the unlock roughly doubles the addressable workflow space. Catching this before custom components ship prevents teaching external authors a confusing shape.

#### Changed

- **`mcp_orbit_components.kind` CHECK constraint** in [lib/db/index.js](lib/db/index.js) — drops `'source'` and `'destination'`, adds `'mcp'`. New enum: `('mcp','trigger','pattern','idempotency','render')`. The `MCPOrbitComponentRepository.COMPONENT_KINDS` array in [lib/db/repositories/mcp-orbit.js](lib/db/repositories/mcp-orbit.js) matches. Existing 0.4.0 composition rows that reference the old kinds are not migrated (5 in test fixtures only, none in production); the kinds change is a one-shot.
- **`component_refs` entries gain a `role` field** in [lib/db/repositories/mcp-orbit.js](lib/db/repositories/mcp-orbit.js) — required for `kind: 'mcp'` entries (`'source' | 'destination'`), rejected on non-mcp kinds (the other kinds are singletons in a composition). New `_MCP_ROLES_FOR_TESTS` export mirrors the pattern of the other test seams. Validation throws on missing role for mcp entries with a clear error pointing at the role enum.
- **Two MCP-shaped starter components re-authored** with bidirectional bodies: [mcp-orbit-components/mcp/linear.md](lib/mcp/mcp-orbit-components/mcp/linear.md) (was [mcp-orbit-components/source/linear.md](lib/mcp/mcp-orbit-components/) — now also covers `create_issue` / `update_issue` / `comment_on_issue` for destination-role usage) and [mcp-orbit-components/mcp/gdrive.md](lib/mcp/mcp-orbit-components/mcp/gdrive.md) (was [mcp-orbit-components/destination/gdrive.md](lib/mcp/mcp-orbit-components/) — now also covers `list_recent_files` / `search_files` / `read_file_content` for source-role usage). Each declares an `affordances: { read, write, watch }` map; the recommender uses these to gate which composition role this MCP can play. Bodies grew to ~50–60 lines (one surface/mapping section per role + shared pitfalls) — read-after-write same-MCP loop pitfalls called out explicitly. The legacy `source/` and `destination/` directories are removed.
- **Pattern aggregation frontmatter** in [mcp-orbit-components/pattern/aggregation.md](lib/mcp/mcp-orbit-components/pattern/aggregation.md) updated from `fits.sources / fits.destinations / requires.minSources / requires.minDestinations` to `fits.sourceMcpAffordances / fits.destinationMcpAffordances / requires.minMcpRoles: { source: 1, destination: 1 }` — the wildcard `"*"` framing didn't survive the role refinement; affordance-explicit is sharper.
- **Recommender** ([lib/mcp/tools/mcp-orbit.js](lib/mcp/tools/mcp-orbit.js) `buildCandidateComposition`) — lists `kind: 'mcp'` components once, partitions by affordance into `readMcps` / `writeMcps`, then selects per role with two new heuristics: (1) inventory-matched candidates take precedence; (2) within the pool, the source is ranked by **earliest mention** in the intent text and the destination is ranked by **latest mention** with a preference for a different ref from the chosen source (the natural-language ordering "X digest into Y" almost always names source first and destination second). `priorMaterializationSignal` keys on role-aware `${kind}/${ref}#${role}` so `mcp/linear@source` doesn't conflate with `mcp/linear@destination`. Constraint warnings still surface `source_not_in_inventory:<ref>` / `destination_not_in_inventory:<ref>` and now reflect the role-tagged refs.
- **Meta-catalyst body** at [mcp-orbit-components/meta-catalyst.md](lib/mcp/mcp-orbit-components/meta-catalyst.md) — six-categories table collapsed to five-categories; new "How roles work" subsection with an example `component_refs` JSON literal showing role tags; constraint table reworked (constraint 3 is the affordance/role invariant, constraint 4 references "≥2 distinct mcp entries in role: 'destination'" for branching, etc.); "What to avoid" list grows a bullet calling out the role tag as non-optional for mcp entries. The artifact-scope principle template in the commit-discipline section now writes `mcp/linear@0.1.0 (role=source), mcp/gdrive@0.1.0 (role=destination)` so the durable audit string carries the role.
- **Tool descriptions** in [lib/mcp/tools/mcp-orbit.js](lib/mcp/tools/mcp-orbit.js) — `list_mcp_orbit_components` and `get_mcp_orbit_component` input-schema enums now show `['mcp','trigger','pattern','idempotency','render']`, and descriptions teach the affordances + roles distinction. `recommend_mcp_orbit_compositions` description unchanged (the surface is the same; the inner shape changed).
- **Docs** — [docs/mcp-orbit.md](../docs/mcp-orbit.md) rewritten around the five-category + roles model; CLAUDE.md Ring 6 section, and `forward_context` Ring 6 + orientation-rule entries in [lib/mcp/tools/context.js](lib/mcp/tools/context.js) updated to use the new shape (the three places that listed the six-tuple `(source × destination × ...)` now list the five-tuple `(mcp × ...)` and explain roles inline).
- **Test suite** — repository tests gain coverage for: role validation (missing role on mcp entry, unknown role, role on non-mcp kind, same mcp ref in distinct roles), legacy-kind rejection, and the `MCP_ROLES` export. Loader tests use `mcp/` fixture dirs (the legacy `source/` dir is now skipped as a non-kind); a new test asserts every shipped mcp component declares its affordances map. Tool tests assert the recommender returns the expected role-tagged refs for the weekly-digest fixture (linear=source, gdrive=destination) and the e2e fixture's artifact-scope principle string uses the new `(role=source)` / `(role=destination)` shape. **All 391 lib tests pass.**

### Composer: signal-driven routing shape

The check that the role refinement actually generalizes. 0.4.0's substrate produced exactly one canonical workflow shape (scheduled aggregation: Linear → Drive weekly digest). If the composer can't generalize past that — if "ship more components" produces "more variants of the same canonical shape" — the role refactor's worth questioning. This change ships the components for an orthogonal shape (signal-driven routing: Gmail → Linear support handoff) and proves the composer assembles it end-to-end from the same store. The e2e test asserts the recommender picks `signal-polled / routing / source-side-label` for the gmail-support intent and `scheduled / aggregation / window-key` for the weekly-digest intent without any prompt engineering past the operator's natural-language ask. Composition surface validated.

#### Added

- **Four new starter components** that together compose the gmail-support-thread-to-linear-issue catalyst from typed parts:
  - [mcp-orbit-components/mcp/gmail.md](lib/mcp/mcp-orbit-components/mcp/gmail.md) — Gmail MCP with `affordances: { read: true, write: true, watch: true }`. Source-role surface covers `search_messages` + `get_thread` + `list_history` with the history-id cursor; destination-role covers `send_message` / `create_draft` / `modify_labels` with the draft-first discipline. Pitfalls call out the reply-loop hazard (the `exclude_self` knob is on by default), the history-id horizon (~7 days, fall back to date-window + re-baseline), and labels as the state surface for `idempotency/source-side-label`. Watch affordance declared `true` but the body explicitly notes that polling is the default — Pub/Sub push requires GCP setup almost no operator has done.
  - [mcp-orbit-components/trigger/signal-polled.md](lib/mcp/mcp-orbit-components/trigger/signal-polled.md) — cadence-based polling trigger for source MCPs that don't push. Carries the cursor discipline (advance ONLY after all per-event downstream writes succeed), the first-run cursor default (`now`, never `beginning` — backfill is an explicit opt-in), and the two-part safety constraint (requires source `capabilities.cursor: true` AND an idempotency component; pre-flight checks surface `signal_polled_without_source_cursor` as a warning). Re-entrant polling, cursor-horizon expiry, empty-poll burn, and quota cliffs are all called out as pitfalls with concrete mitigations.
  - [mcp-orbit-components/pattern/routing.md](lib/mcp/mcp-orbit-components/pattern/routing.md) — 1:1 cognitive shape (each source event → one destination record), the complement to `pattern/aggregation`'s N:1. Four knobs (`match_filter`, `routing_target`, `include_source_context`, `reply_to_source`) with prescriptive defaults; pitfalls cover TOCTOU under overlapping polls, reply loops, archived destinations, and PII in routed records. Redirect rules point intent that's actually aggregation / enrichment / branching back to those patterns instead of stretching routing past its shape.
  - [mcp-orbit-components/idempotency/source-side-label.md](lib/mcp/mcp-orbit-components/idempotency/source-side-label.md) — the TOCTOU-safe dedupe strategy for signal-driven workflows. After a successful destination write, apply a marker on the source-side event (Gmail label, Slack reaction, source-MCP-specific affordance) and auto-extend the source query with `-marker:<name>` so subsequent polls exclude processed events. Body explicitly maps the two timing modes (`on_destination_success` is the right default; `on_processing_start` is faster-but-loses-events-on-failure) and is candid about the residual TOCTOU window under overlapping polls — full safety requires either re-entrance prevention at the trigger (default v0 posture) or a destination-side existence check before write. Hard `fits.triggers: ['signal-polled', 'signal-push']` constraint means the recommender doesn't propose this with `scheduled`.
- **`intentKeywords` payload field** added to every shipped non-mcp component (`trigger/scheduled`, `trigger/signal-polled`, `pattern/aggregation`, `pattern/routing`, `idempotency/window-key`, `idempotency/source-side-label`). The recommender uses these to pick the trigger / pattern / idempotency that fit the operator's natural-language ask — "when X happens, file Y" picks `signal-polled + routing + source-side-label`; "weekly X digest into Y" picks `scheduled + aggregation + window-key`. The `mcp/linear`, `mcp/gdrive`, `mcp/gmail` components also gained `intentKeywords` but the mcp selection still uses the existing `intentMentionIndex` (earliest mention = source, latest = destination) — the keywords are additive metadata for future ranking refinements.

#### Changed

- **`buildCandidateComposition`** in [lib/mcp/tools/mcp-orbit.js](lib/mcp/tools/mcp-orbit.js) — generalized past the canonical-shape v0 picker. Two new helpers (`intentKeywordScore`, `pickByIntent`) rank candidates by `intentKeywords` matches in the operator's intent prose, with alphabetical tiebreak for determinism. `fitsTrigger` enforces the per-component `fits.triggers` constraint so a pattern / idempotency that only pairs with `scheduled` doesn't get proposed alongside `signal-polled`. The picking order is now: trigger → pattern (filtered to those that fit the trigger) → idempotency (filtered to those that fit the trigger). When the filter empties the candidate pool (no pattern fits the chosen trigger), the recommender falls back to the unfiltered pool rather than refusing to return a candidate — a candidate with a constraint warning is more useful than a `no_components_available` 4xx.
- **Loader test suite** in [lib/mcp/mcp-orbit-components/loader.test.js](lib/mcp/mcp-orbit-components/loader.test.js) — shipped-components assertion bumped from 5 to ≥9 components and now lists every kind/ref pair across both shapes. New test asserts every non-mcp shipped component declares a non-empty `intentKeywords` array (the recommender depends on this; a missing keyword set silently breaks shape disambiguation).
- **Tool test suite** in [lib/mcp/tools/mcp-orbit.test.js](lib/mcp/tools/mcp-orbit.test.js) — `list_mcp_orbit_components` assertion expanded to cover all 9 shipped refs. Two new test blocks exercise the gmail-support shape end-to-end: one asserts the recommender returns the right role-tagged components (`mcp/gmail@source`, `mcp/linear@destination`, `trigger/signal-polled`, `pattern/routing`, `idempotency/source-side-label`), and the second walks the full seven-step composition flow against this shape (recommend → meta-catalyst → component bodies → knob negotiation → status transitions → audit log entry). The second test also verifies the `mcp/gmail` body carries BOTH a source-role section AND a destination-role section — the role refinement only pays off if mcp bodies actually teach both sides. **All 394 lib tests pass** (391 → 394: +3 for the gmail-support shape coverage).

#### Composition outcomes

The composer now generalizes past the single canonical shape:

- **Weekly Linear digest into Drive** (intent: `"weekly Linear digest into Drive — Monday morning summary so I stop opening Linear every week"`) → composes `mcp/linear (source) + mcp/gdrive (destination) + trigger/scheduled + pattern/aggregation + idempotency/window-key`.
- **Gmail support thread routed into Linear** (intent: `"When a Gmail support thread arrives in the inbox, file a Linear issue with the conversation context"`) → composes `mcp/gmail (source) + mcp/linear (destination) + trigger/signal-polled + pattern/routing + idempotency/source-side-label`.

Both compositions assemble from the same store, validate against the same constraint table, and persist as audit-able rows in the composition log.

### Primitive-binding layer

A second layer parallel to the vendor-shaped mcp-orbit composer: curated **vendor-agnostic primitive bodies** (`document-store`, `structured-record-store`) plus a **deterministic generator** that fills role-specific markdown templates against a capability snapshot the agent introspects from each installed MCP. The two layers coexist intentionally — the vendor composer ships curated vendor-specific knowledge (pitfalls, intent), the primitive layer covers vendor-agnostic tool-shape via introspection. A cauterize gate (`MOJULO_MCP_ORBIT_VENDOR_DISABLED=1`) lets the operator force the agent through the primitive flow without removing the vendor surface — useful for proving end-to-end coverage before retiring vendor curation.

#### Added

- **Two primitives** under [mcp-orbit-components/primitive/](lib/mcp/mcp-orbit-components/primitive/), each as a body + source-role template + destination-role template:
  - `document-store` (Drive, Notion, OneDrive, Dropbox, S3-with-keys) — `find-by-key-in-scope` / `read-content` / `list-recent` / `get-metadata` / `subscribe-to-changes` affordance set. Per-role templates carry slot markers for tool name + schema fill at bind time.
  - `structured-record-store` (issue trackers — Linear, GitHub Issues, Jira; CRMs — HubSpot, Salesforce, Pipedrive; spreadsheet-databases — Airtable, Notion DB) — `find-by-filter` / `read-content` / `list-recent` / `create-record` / `comment-on-record` / `transition-status` / `update-fields` / `upsert-by-key` affordance set. The primitive deliberately spans typed-record backends across all three categories — what unifies them is the typed-record shape and structured-filter query. Cross-primitive overlap with `document-store` is called out in the body so authors of future primitives see when names should rhyme vs diverge.
- **Capability-snapshot generator** in [mcp-orbit-components/generator.js](lib/mcp/mcp-orbit-components/generator.js) — deterministic template fill (no LLM in the generator itself) that takes a primitive body, a role-specific template, and a capability snapshot and produces a session-scoped provider artifact with affordance binding manifest + tool-name resolution + confidence labels per affordance. Three-tier confidence: `tools_list_full` (introspected with schemas) > `names_only` (tool names but no schemas) > `agent_inferred` (agent best-guess from prior knowledge).
- **`mcp_orbit_provider_artifacts` table** in [control/data/mojulo-lite.db](data/) — stores generated artifacts so the agent can reference a stable ref between `bind_primitives` and the subsequent `meta_context_commit`, and so the artifact is auditable as the durable link between primitive + snapshot + bound tool names + confidence. Repository in [lib/db/repositories/mcp-orbit-provider-artifacts.js](lib/db/repositories/mcp-orbit-provider-artifacts.js); columns: `primitive_ref`, `role` (`source` | `destination` CHECK), `server`, `introspected_at`, `snapshot_confidence`, `body_md`, `manifest_json`, `bindings_json`.
- **`bind_primitives` MCP tool** in [lib/mcp/tools/mcp-primitive-binding.js](lib/mcp/tools/mcp-primitive-binding.js) — Ring 6 tool registered LAST. Takes a composition ref + per-primitive-role binding spec, loads each primitive's role-specific template, fetches the live capability snapshot from `meta_mcp_inventory`, runs the generator, persists the artifact, and returns the artifact ref + affordance binding manifest. The split from `get_meta_catalyst` is deliberate: meta-catalyst is the rulebook (cacheable per session), bindings are per-composition synthesis (not cacheable).
- **Extended capability snapshots in `meta_mcp_inventory`** — `input_schema_json` (per-tool JSON schema as introspected) + `introspection_confidence` (the three-tier confidence label) columns added via [migrateInventoryColumns](lib/db/index.js) (backward-compatible — existing rows have NULL, generator treats NULL as `names_only`). The `meta_context_declare_inventory` tool accepts the richer per-tool shape; old shape still works (silently downgrades to `names_only` confidence for those tools).
- **Adapter teaching** in [adapters/claude-code.md](lib/mcp/adapters/claude-code.md), [adapters/codex.md](lib/mcp/adapters/codex.md), [adapters/generic.md](lib/mcp/adapters/generic.md) — each adapter body grows a primitive-binding section explaining the introspection step the host agent is responsible for, the artifact-ref handoff to `meta_context_commit`, and how the artifact's bindings map onto the host's downstream rendering. Combined +266 lines.
- **Cauterize gate** in [lib/mcp/server.js](lib/mcp/server.js) — when `MOJULO_MCP_ORBIT_VENDOR_DISABLED=1`, `registerMCPOrbitTools()` is skipped. The primitive-binding tool registers regardless. Tests don't set the flag and continue to register the full surface. The gate exists for operators who want to force the agent through the primitive flow without removing the vendor composer's commits — a deliberate parallel-track posture during the transition.

#### Changed

- **`meta_context_brief`** in [lib/mcp/tools/meta-context.js](lib/mcp/tools/meta-context.js) — extended +280 lines to surface primitive-binding artifacts on fleet briefs, with corresponding test coverage +250 lines. `forward_context` Ring 6 section gains the primitive-binding flow as the second layer alongside the vendor composer.

### Decuration prep

Forward-declarations against the next change. Adds a fourth vendor body following the same bidirectional shape as the existing three, and a catalyst that defines the agent's research methodology for vendor knowledge. The catalyst references tools (`record_mcp_capabilities`, `get_mcp_capabilities`) that arrive in the next change — committed early as the prose-and-process is stable independent of the persistence side.

#### Added

- [mcp-orbit-components/mcp/notion.md](lib/mcp/mcp-orbit-components/mcp/notion.md) — fourth vendor body. Multi-faceted: page-side surface (`notion-search` / `notion-fetch` / block-tree content model) and data-source-side surface (`notion-query-data-sources` / row-in-data-source writes). Pitfalls cover the API 2025-09-03 `database` → `data_source` rename, search title-only semantics, the 100-block per-children cap, page-vs-data-source-row schema mismatch, and integration-sharing being page-level not workspace-level. The richest of the four vendor bodies — sets the bar for the depth a researcher should target.
- [catalysts/research-mcp-vendor.md](lib/mcp/catalysts/research-mcp-vendor.md) — catalyst defining the agent's methodology for researching an MCP end-to-end via primary web sources: source priority order (server source/README → official monorepo → vendor developer docs → package metadata → registry), the triangulation rule (non-trivial claims need a priority-1 or priority-3 backing), what to extract (tool list with input schemas, affordances, capabilities, intent keywords, pitfalls), the canonical output body shape (matching the four existing vendor bodies), honesty rules (mark unconfirmed claims, refuse training-data priors, cite even single-fact contributors), multi-server-per-vendor handling, behavior contract. Forward-declares against `record_mcp_capabilities` / `get_mcp_capabilities` — the catalyst is shape-stable; the tools land next.

### Decuration: provider identity layer + capabilities persistence

The implementation arrives behind the [research-mcp-vendor catalyst](lib/mcp/catalysts/research-mcp-vendor.md) committed earlier. Two new Ring 6 tables — `meta_mcp_providers` (identity layer) and `meta_mcp_capabilities` (vendor knowledge facet with append-with-supersession semantics) — plus a `provider_id` foreign key on `meta_mcp_inventory` so both paths to knowing an MCP (introspection and research) converge on the same provider row. The supersession invariant is enforced at the DB layer via a unique partial index; a deterministic four-rule canonicalizer derives `provider_ref` from raw server names so the identity layer populates as a side-effect of inventory writes — no `register_mcp_provider` tool needed, by design. This drop is the persistence side only; the MCP tool surface (`record_mcp_capabilities` / `get_mcp_capabilities`), the seed migration that ships the four vendor bodies as starter rows, the composer rewiring that consumes the consolidated view, and the cauterize gate removal land in subsequent drops.

#### Added

- **`meta_mcp_providers` + `meta_mcp_capabilities` tables** in [control/data/mojulo-lite.db](data/), schema in [lib/db/index.js](lib/db/index.js). Providers: one row per logical MCP keyed on canonical lowercase `provider_ref` (e.g. `gmail`, `notion`, `linear`) with first-writer-wins `display_name`. Capabilities: `provider_id` FK + `version_tag` (nullable when docs declare nothing) + `body_md` + `source_urls` (JSON array) + `discovered_at` + `superseded_by`, with a **unique partial index** `idx_meta_mcp_capabilities_current ON meta_mcp_capabilities(provider_id) WHERE superseded_by IS NULL` enforcing at most one current row per provider. Supersession is mandatory, not optional. `ON DELETE CASCADE` from providers so removing a provider row cleans up its capability chain.
- **`provider_id` column on `meta_mcp_inventory`** via the existing `migrateInventoryColumns` pattern, plus `idx_meta_mcp_inventory_provider` index. Backward-compatible — existing rows have NULL provider_id, populated lazily on the next inventory replace. Capabilities indexes follow the `idx_meta_mcp_*` naming convention for consistency with the inventory indexes.
- **Canonicalizer** in [lib/mcp/providers/canonicalize.js](lib/mcp/providers/canonicalize.js) — pure four-rule function (lowercase → strip leading host prefix `claude_ai_` / `claude-` / `@vendor/` scope → strip trailing MCP suffix `-mcp-server` / `_mcp_server` / `-mcp` / `_mcp` → normalize separators to underscore). Genuine ambiguity is the agent's job to disambiguate via explicit `provider_ref` on capability writes; v0 has no inventory-time override (additive v1 if collision rate justifies). Examples: `claude_ai_Gmail` → `gmail`; `claude_ai_Google_Drive` → `google_drive`; `@notionhq/notion-mcp-server` → `notion`; `notion-mcp-server` → `notion`; `linear` → `linear`.
- **Providers repository** in [lib/db/repositories/mcp-providers.js](lib/db/repositories/mcp-providers.js): `upsertByRef` (first-writer-wins on `display_name`; subsequent calls return the existing row without overwriting), `getByRef`, `getById`, `listAll`. No `register_mcp_provider` MCP tool — providers are upsert side-effects only, since a row with no facets is useless. Identity-row corrections (display_name typos, provider_ref splits) deferred to v1 per the plan.
- **Capabilities repository** in [lib/db/repositories/mcp-capabilities.js](lib/db/repositories/mcp-capabilities.js): `insert` (transactional upsert-provider + insert-with-supersession in one txn), `getCurrent`, `getAsOf` (walks the chain to find the row current at a given unix timestamp), `listForProvider`, `consolidatedView` (composer-facing JOIN of provider identity + inventory facet + capabilities facet, with `provenance: 'seed' | 'research'` derived from `sourceUrls[0]` — `mojulo://` prefix marks the row as a build-time seed, anything else as agent-research). The supersession dance is **three statements** (insert new with `superseded_by = prior.id` as non-NULL placeholder → flip prior's `superseded_by` to `new.id` → clear new's `superseded_by` to NULL) because SQLite's unique partial index fires per-statement, not at commit; briefly produces a benign FK cycle. Documented inline in the repository header.

#### Changed

- **`InventoryRepository.replaceInventory`** in [lib/db/repositories/mcp-inventory.js](lib/db/repositories/mcp-inventory.js) — within the existing replace transaction, each server name is canonicalized once and the matching provider row is upserted; `provider_id` is stamped on every tool row. Two install aliases that canonicalize to the same provider (e.g. `claude_ai_Notion` + `notion-mcp-server`) share the same `provider_id`, collapsing into one logical "notion" provider — the identity layer working as designed. The tool's input shape is **unchanged** — provider resolution is purely additive on the write path. Orphan provider rows persist after inventory replace (no cleanup in v0); their capabilities remain queryable for historical `getAsOf` walks, and the next inventory declare reuses them if the alias comes back. `rowToTool` now exposes `providerId` on returned rows.
- **Test suite** — **+100 new tests** across the new modules. 32 for the canonicalizer (example cases + lowercase normalization + leading prefix handling + trailing suffix handling + separator normalization + error cases + idempotency + rule-table invariants). 25 for the providers repository (schema bootstrap + UNIQUE enforcement + upsert idempotency + first-writer-wins + display_name normalization + multi-provider isolation + validation). 37 for the capabilities repository (schema bootstrap + unique partial index + FK cascade + first-insert + supersession chain across three writes + raw-SQL bypass rejection + isolation across providers + `getAsOf` walk + `consolidatedView` across five facet combinations + provenance derivation). 6 added to [lib/db/repositories/mcp-inventory.test.js](lib/db/repositories/mcp-inventory.test.js) (provider row creation + provider_id stamping + alias collapse + `rowToTool.providerId` + orphan persistence + linear edge case). [lib/db/repositories/meta-context.test.js](lib/db/repositories/meta-context.test.js) assertion lists updated for the new tables/indexes. **All 579 lib tests pass.**

### Decuration: capability tools + seed migration

The forward-declared tools land. `record_mcp_capabilities` and `get_mcp_capabilities` ship as Ring 6 MCP tools; the `research-mcp-vendor` catalyst's `mcpTools.mojulo` references are now real. The four curated vendor bodies relocate from `mcp-orbit-components/mcp/` to `seeds/mcp-capabilities/` and ship via a seed migration that materializes them as starter rows on first boot — honestly attributed to mojulo (`source_urls[0]` is `mojulo://CHANGELOG#v0.5.0`, `discovered_at` is the v0.5.0 release sentinel, `provenance` is `seed`). The `'mcp'` kind drops from the component loader's allowlist; vendor knowledge is no longer a composable component, it's a Ring 6 surface. The composer rewiring that consumes the consolidated provider view lands next.

#### Added

- **`record_mcp_capabilities` + `get_mcp_capabilities`** in [lib/mcp/tools/mcp-capabilities.js](lib/mcp/tools/mcp-capabilities.js), registered in [lib/mcp/server.js](lib/mcp/server.js) between `registerInventoryTools()` and the cauterize-gated mcp-orbit composer. Drive the capabilities repository's transactional supersession + `asOf` chain walks; surface a `no_operator_anchor` warning when KYC is missing; return a `hint` pointing at the catalyst when no row exists.
- **Seed migration** at [lib/mcp/seeds/mcp-capabilities-seed.js](lib/mcp/seeds/mcp-capabilities-seed.js) — `seedMcpCapabilities()` parses each seed body's frontmatter for `capabilities.apiVersion` and the `<!-- sources -->` URLs, inserts one starter row per provider where none exists. Per-provider idempotent — agent-research rows are never overwritten. Called lazily from `registerCapabilitiesTools()` so test isolation stays intact.
- **`seeds/mcp-capabilities/{gmail,linear,gdrive,notion}.md`** — the four curated vendor bodies in their new location.

#### Changed

- **`COMPONENT_KINDS` in [lib/db/repositories/mcp-orbit.js](lib/db/repositories/mcp-orbit.js)** drops `'mcp'`; new enum `['trigger', 'pattern', 'idempotency', 'render']`. The SQL `CHECK` constraint is intentionally untouched (v0.4.x DB compat; the loader's `deleteAllBuiltins()` clears any leftover `'mcp'` rows on next boot). Composition `component_refs` validation still recognizes `kind: 'mcp'` entries — those resolve to provider rows under the composer rewiring landing next.
- **Loader + repo tests** updated for the new layout: fixtures switched from `'mcp'` to `'pattern'` (behavior under test is kind-agnostic), shipped-component assertion drops the four `mcp/*` refs (≥9 → ≥6), legacy-kinds-skip test now covers `'mcp'`. **+46 tests across the two new modules (24 capabilities tools + 22 seed migration); 612 lib tests pass, 12 recommender failures expected — they resolve in the next drop.**

### Decuration: composer rewiring + cauterize revert + smoke

The closing chapter. The mcp-orbit composer now reads vendor knowledge through a **consolidated provider view** (`CapabilitiesRepository.consolidatedView`) that joins the identity layer with both facets — inventory introspection and capabilities research — into one record per logical MCP. Five composer states per chosen provider — `research`, `seed`, `inventory_only`, `capabilities_only`, `none` — each with its own warning tag (`seed_capabilities:<ref>` / `no_capabilities_recorded:<ref>` / `not_installed:<ref>`) so the agent routes remediation directly. The `rationale.catalystHint` field surfaces the research-mcp-vendor catalyst by name when at least one chosen provider isn't research-grade. With the composer reading from Ring 6 surfaces end-to-end, the cauterize gate becomes unnecessary and reverts: `MOJULO_MCP_ORBIT_VENDOR_DISABLED` no longer skips the composer, and the `forward_context` banner that warned about it is removed. The forward_context Ring 6 section is rewritten around the new architecture (identity layer + two facets + composer's consolidated read), and the fleet brief gains a `vendorKnowledge` section keyed by provider with `provenance` + freshness.

#### Added

- **Catalyst smoke tests** in [lib/mcp/tools/mcp-capabilities.test.js](lib/mcp/tools/mcp-capabilities.test.js) — five end-to-end scenarios exercising the full vertical: seed → tool surface → composer re-read. Verifies notion starts as `provenance: 'seed'`, the catalyst's `record_mcp_capabilities` call supersedes the seed and flips provenance to `'research'`, `asOf` walks back to the seed row from before the supersession, the composer drops the `seed_capabilities:notion` warning after the research write, and re-running the seed migration after research is a no-op (agent rows are never clobbered).
- **`vendorKnowledge` section on `meta_context_brief({kind:'fleet'})`** — keyed by provider, surfaces `{ provider_ref, display_name, hasInventory, hasCapabilities, capabilitiesVersionTag, capabilitiesDiscoveredAt, ageSeconds, capabilitiesProvenance }`. `provenance: 'seed' | 'research'` distinguishes build-time seed bodies from agent-research; `ageSeconds` computed at read time. Agents read this to decide when to invoke the research catalyst.

#### Changed

- **Composer in [lib/mcp/tools/mcp-orbit.js](lib/mcp/tools/mcp-orbit.js)** rewired around the providers identity layer. `buildCandidateComposition` enumerates providers via `ProvidersRepository.listAll()`, reads each through `CapabilitiesRepository.consolidatedView`, and collapses the result into a `providerProfile` (state + affordances + intent-matching hints + installed flag). Source/destination selection prefers installed providers, breaks ties on earliest/latest intent mention. The five composer states gate the warning vocabulary; `not_installed:<ref>` / `seed_capabilities:<ref>` / `no_capabilities_recorded:<ref>` replace the prior `source_not_in_inventory:` / `destination_not_in_inventory:` pattern. `listComponentsHandler({kind:'mcp'})` and `getComponentHandler({kind:'mcp'})` now serve from the providers identity layer (capabilities body + frontmatter parsed as payload) so the agent-facing API stays consistent across kinds without exposing the storage shift. The pre-decuration `inventoryMatchesHints` helper is removed — provider identity collapses install aliases at the canonicalizer step, so the composer no longer fuzzy-matches server names at recommendation time. The `inventory` input param to `recommend_mcp_orbit_compositions` is also removed — the composer reads providers directly.
- **`gdrive` → `google_drive` rename** in [seeds/mcp-capabilities/google_drive.md](lib/mcp/seeds/mcp-capabilities/google_drive.md) and the seed migration's `DISPLAY_NAMES` map. Aligns the seed body's `provider_ref` with what the canonicalizer produces for `claude_ai_Google_Drive` (the standard Claude Code MCP namespace for the Drive vendor), so seeded research-grade knowledge and operator inventory converge on the same provider row instead of fragmenting into `gdrive` + `google_drive`. Test fixtures and audit-string examples updated to match.
- **Cauterize gate reverted** — `MOJULO_MCP_ORBIT_VENDOR_DISABLED` env flag check in [lib/mcp/server.js](lib/mcp/server.js) removed; `registerMCPOrbitTools()` always registers now. The conditional banner in [lib/mcp/tools/context.js](lib/mcp/tools/context.js) that announced "vendor-shaped composer is disabled" is removed entirely. The composer is the supported primary path; the primitive-binding layer ([lib/mcp/tools/mcp-primitive-binding.js](lib/mcp/tools/mcp-primitive-binding.js)) continues to ship alongside it as the runtime-introspected alternative.
- **`forward_context` Ring 6 section** rewritten to introduce the providers identity layer + the two facets + the seeding posture + the research-mcp-vendor catalyst as the refresh path. Heading updated to "Deliberation (Ring 6 — the substrate for structural reasoning: contextmap, inventory, capabilities, composer)"; new `record_mcp_capabilities` / `get_mcp_capabilities` bullet; composer bullet rewritten around the five-state taxonomy and the warning tag vocabulary that drives the agent's remediation routing.

#### Composition outcomes

Identity layer in production. **All 629 lib tests pass across 26 files**: +5 from the catalyst smoke and the test suite updates that exercise the consolidated view, the new warning tags, and the catalyst hint. The 12 recommender failures from the previous drop resolve. The decuration arc closes: identity + facets + tools + seeds + composer + catalyst all wired together; vendor knowledge moves from build-time curation through agent research at the operator's own clock, with full audit chain via supersession.

### Primitive domain expansion + posture shift

With the primitive-binding architecture and the four-primitive ambition validated against `document-store` and the renamed `structured-record-store`, the next move was to push the primitive layer past the two original shapes and prove the generator + binding flow generalizes. This release also flips the recommended-composer posture: `bind_primitives` is now the supported path for MCP-to-MCP composition (the path most MCP-capable agents will take, since runtime tool-schema knowledge is the common case), and the vendor-shaped `recommend_mcp_orbit_compositions` flow steps back to seed-reasoning duty for first-encounter scaffolding.

#### Added

- **Two new primitives** under [mcp-orbit-components/primitive/](lib/mcp/mcp-orbit-components/primitive/), each as body + source-role template + destination-role template:
  - `messaging-channel` (Slack, Discord, Teams) — scope-addressable chat with thread sub-grouping, audience is scope members. `list-recent-in-scope` / `read-content` / `find-by-filter` / `get-metadata` / `subscribe-to-changes` source-role; `post-to-scope` / `post-to-thread` / `react-to-message` / `post-ephemeral` destination-role. The `-in-scope` suffix on `list-recent-in-scope` is load-bearing: messaging-channel reads require a scope id, unlike `document-store`'s flat `list-recent`. Cross-primitive overlap is called out per affordance — names rhyme across primitives only where the underlying shape genuinely transfers.
  - `message-thread` (Gmail, Outlook) — directed mail semantics with reply identity, audience is *named recipients*, threads grow by reply. `search-threads` / `read-thread` / `list-recent-in-mailbox` / `get-thread-metadata` / `subscribe-to-new-messages` source-role; `send-thread-message` / `create-draft` / `apply-label` destination-role. The audience model is what distinguishes this from `messaging-channel`: scope-broadcast (channel) vs recipient-directed (thread). The two primitives deliberately stay separate.
- **Capability-generator integration with all four primitives** — [generator.js](lib/mcp/mcp-orbit-components/generator.js) and [primitive-binding.js](lib/mcp/tools/mcp-primitive-binding.js) tool description now name all four primitives explicitly. Generator tests cover Linear and GitHub fixtures binding `structured-record-store` (typed-record shape across issue-tracker-flavored backends) to validate the generator + slot vocabulary survive a second primitive without changes; the test block frames the validation explicitly as "the gate before plumbing a tool surface around the architecture." CRM (HubSpot) and spreadsheet-database (Airtable, Notion DB) fixtures are deferred as future coverage.

#### Changed

- **`issue-tracker` → `structured-record-store` rename, with broadened backing scope.** The `issue-tracker` primitive (Linear / GitHub Issues / Jira / Asana / Shortcut) is renamed and generalized to `structured-record-store` — same affordance vocabulary, but the primitive now spans **issue trackers + CRMs (HubSpot, Salesforce, Pipedrive) + spreadsheet-databases (Airtable, Notion DB)**. The unifying shape is **typed records with stable ids, structured-field queries, and optional status / comment / upsert workflows**; what varies — status workflow vs stage-as-field, native upsert vs simulate, threading vs flat comments — is captured per-affordance in the support taxonomy. Affordances renamed to match the broader scope: `create-issue` → `create-record`, `comment-on-issue` → `comment-on-record`, `update-issue-fields` → `update-fields`, plus a new `upsert-by-key` affordance for CRM / spreadsheet-DB sync workflows (rare on issue trackers, defining on CRMs). Old primitive files (`primitive/issue-tracker.*`) deleted; mcpInventoryCategory `issue_tracker` → `structured_record_store` propagated through the linear seed body, the three mcp-orbit catalysts (`gmail-support-thread-to-linear-issue`, `linear-issue-closed-branched-notification`, `weekly-linear-digest-to-drive`), the `research-mcp-vendor` author guide, the mcp-orbit doc example, and the recommender test fixtures. Real-world descriptive uses of "issue tracker" (e.g. "Linear is an issue tracker") stay — those describe the world; the primitive name is what changed.
- **`bind_primitives` reframed as the recommended composer for MCP-to-MCP workflows.** The tool description in [mcp-primitive-binding.js](lib/mcp/tools/mcp-primitive-binding.js), the `forward_context` Ring 6 bullet in [context.js](lib/mcp/tools/context.js), and the three adapter docs (`adapters/claude-code.md`, `adapters/codex.md`, `adapters/generic.md`) all drop the "experimental / validating in parallel / parallel-track" framing and reframe as: primitive binding is the supported path; the vendor-shaped `recommend_mcp_orbit_compositions` flow remains as a seed-reasoning surface for first-encounter scaffolding when runtime tool-schema knowledge is missing. Section headings updated from "Primitive binding flow (parallel path, runtime-introspected)" → "Primitive binding flow (no-bot composition)" across all three adapters.
- **Doc orientation rewrite for the v0.5.0 surface.** [CLAUDE.md](../CLAUDE.md) Ring 6 section moves from three deliberation surfaces (contextmap / inventory / mcp-orbit composer) to **five** (adds capabilities and primitive-binding as distinct first-class surfaces with their own bullets), and the data-layout section now names every Ring 6 table including `meta_mcp_providers`, `meta_mcp_capabilities`, and `mcp_orbit_provider_artifacts`. [docs/mcp-orbit.md](../docs/mcp-orbit.md) gains a "Primitive-binding layer" section with the four-primitive table + the generator's deterministic-fill semantics + the artifact persistence + the `primitive_artifact_materialization` commit flow; the schema section adds the `mcp_orbit_provider_artifacts` DDL. [docs/meta-context.md](../docs/meta-context.md) documents the third `meta_context_commit` type (`primitive_artifact_materialization`) with full payload shape + behavior + audit-chain semantics, and the "What sits on top" section grows from one composer to three Ring 6 surfaces (capabilities + vendor-shaped composer + primitive-binding). [docs/mcp-integration.md](../docs/mcp-integration.md) Recipe 5 splits into "Primitive-binding flow (recommended)" + "Vendor-shaped composer flow (seed-reasoning fallback)" to teach the choice between the two paths.

### CI

#### Added

- **[.github/workflows/publish-release.yml](../.github/workflows/publish-release.yml)** — fires on `v*` tag push (e.g. `v0.4.0`), slices the matching `## [X.Y.Z]` section out of [CHANGELOG.md](CHANGELOG.md), and creates a GitHub Release with that body marked as `--latest`. Fails loudly if the section is missing — won't push a release tag with no changelog entry. `bot-v*` tags are unaffected — those start with `b` and are handled by `publish-bot-image.yml`.

## [0.4.0] — 2026-05-23

Ring 6 — the deliberation substrate — comes online. Three structurally-distinct surfaces (contextmap, inventory, mcp-orbit composer) decenter mojulo from the bot: the bot factory becomes one capability bay, Ring 6 becomes the hull. The release also activates the non-bot axis — operators can now use mojulo to compose MCP-orchestrated workflows over their installed MCPs (Gmail/Drive/Calendar/Linear/etc.) without deploying a chatbot at all, with the contextmap as the durable audit trail and the mcp-orbit composer as the synthesis surface.

`meta_context` ships as **Ring 6** — a writeable, durable deliberation surface that records *why* structural decisions were made, not just *what* happened. Two MVP write triggers (operator KYC and artifact materialization) with adapter-delegated verification, a graph schema of bots / catalysts / adapters / artifacts / mcp_tools / operator nodes plus seeded / materialized_by / runs_for / binds edges, and principles (markdown rationale) attached to either nodes or edges. The bright line is operational: writes happen at **structural** events (operator pivots, artifact materializations) — never at **outcome** events (conversations, automation runs). That asymmetry is what makes the layer auditable; outcomes happen at run-rate, structural decisions at deliberation-rate. The graph is **append-only by design** — no deprecation events, no tombstones, no auto-pruning. Operator owns manual cleanup via SQL. See [docs/meta-context.md](../docs/meta-context.md).

This release also closes a synthesis ↔ deliberation loop the design called out: `recommend_catalysts` now consults the contextmap automatically and surfaces both the operator anchor (`operatorAnchor` / `suggest_kyc`) and per-catalyst `priorMaterializations`, so the agent can triage overlap / synergy / orthogonality at the recommendation surface without remembering to call `meta_context_brief` first.

Building on the spine, this release also ships **`meta_context_declare_inventory`** — the entry point for using mojulo *without* deploying a chatbot. Mojulo's mainline tooling is heavily bot-shaped (build → deploy → operate → catalyst-against-a-bot); the inventory primitive activates the other axis: MCP-orchestrated workflows synthesized over the user's installed MCPs (Gmail/Drive/Calendar/Linear/HubSpot/etc.) directly, with mojulo as the deliberation anchor and audit trail rather than the conversational runtime. The connecting agent declares which MCPs are connected and which tools each exposes; once inventory is on record, the operator's broader environment is part of mojulo's worldmodel. The bright line gets a second axis at this surface: contextmap writes are sealed structural decisions (append-only); inventory writes are current environment state (replace). Mixing them would let the graph slowly diverge from reality — so inventory lives in its own table with **replace semantics** (DELETE + INSERT in one transaction), separate from `meta_nodes` / `meta_edges` / `meta_principles`. See [lite-template/integration/MCP_INVENTORY_PLAN.md](../lite-template/integration/MCP_INVENTORY_PLAN.md) for the design.

Sitting on top of inventory, this release also opens the **mcp-orbit component store** — the next infrastructure layer past hand-written mcp-orbit catalysts. Three monolithic mcp-orbit recipes gave us the vocabulary, but ~30% of every body was identical scaffolding and ~40% was pattern-shared with recipe-specific content; continuing down that path means hand-authoring N×M×T×K recipes for N sources × M destinations × T triggers × K patterns. The right move is to decompose: a constrained set of **typed components that combine multiplicatively** — `source` × `destination` × `trigger` × `pattern` × `idempotency` × `render` — that the agent assembles under the meta-catalyst's discipline. Server-stored (typed rows with validation), agent-composed (judgment under uncertainty). Each composition is logged as a first-class row so the recommendation itself is auditable, and the existing `meta_context_commit({type:'artifact_materialization', ...})` carries the composition ref forward as the durable link between the materialized artifact and the components it was built from. See [lite-template/integration/MCP_ORBIT_COMPONENT_STORE_PLAN.md](../lite-template/integration/MCP_ORBIT_COMPONENT_STORE_PLAN.md) for the design.

### Added
- **`meta_nodes` / `meta_edges` / `meta_principles` tables** in [control/data/mojulo-lite.db](data/) — three tables, six node kinds (`bot`, `mcp_tool`, `catalyst`, `adapter`, `artifact`, `operator`), four edge kinds (`binds`, `seeded`, `materialized_by`, `runs_for`), and principle scopes (`node` | `edge`) keyed by `(scope_kind, scope_id)`. `operator` is a singleton (`ref='self'`). Schema lives in [lib/db/index.js](lib/db/index.js); repository in [lib/db/repositories/meta-context.js](lib/db/repositories/meta-context.js). Sync methods (not async-by-convention like sibling repos) because better-sqlite3 transactions require sync work, and `MetaContextRepository.commit(fn)` is the entry point for atomic multi-row writes.
- **Ring 6 MCP tools** in [lib/mcp/tools/meta-context.js](lib/mcp/tools/meta-context.js):
  - `meta_context_brief({ scope: { kind, ref? } })` — read the contextmap subgraph + principles. `kind: 'fleet'` returns the whole graph (capped at 500 nodes; response carries `meta.capped: true` when hit); per-scope kinds return a 1-hop neighborhood. Empty fleet brief surfaces `meta: { empty: true, suggest_kyc: true }` so the agent knows to offer the operator KYC. Brief returns the contextmap as *recorded*, not as *currently active* — stale rows from operator-deleted artifacts are not auto-pruned (append-only by design); description tells the agent to cross-reference with `list_deployments` / filesystem before treating a binding as live.
  - `meta_context_commit({ type, ... })` — seal a structural decision. Two event types in MVP: `operator_kyc` (optional one-time bootstrap; `revise: true` stacks a new principle on the same operator node, old one stays for audit) and `artifact_materialization` (atomic per-materialization seal that upserts bot / adapter / catalyst / artifact / mcp_tool nodes, the four edges between them, and any principles attached to specific scopes — `'artifact' | 'catalyst' | 'adapter' | 'bot'` for nodes; `'seeded' | 'materialized_by' | 'runs_for' | 'binds' | 'binds:<mcp_tool_ref>'` for edges).
- **Adapter-delegated artifact verification** in [lib/mcp/meta-context/verification.js](lib/mcp/meta-context/verification.js) — runs BEFORE any DB write during `artifact_materialization`. `claude-code` and `generic` require `existsSync(locator)`. `codex` requires `existsSync` for filesystem-shaped locators (absolute / `./` / `../`) but **accepts opaque automation handles on the agent's assertion** with a `note: 'codex_accept_on_assertion'` in the response — deliberate MVP relaxation since the control plane can't round-trip to Codex from here. Unknown adapter ids are rejected (the adapter loader is the source of truth).
- **Operator anchor surfacing in `recommend_catalysts`** — both single-bot and fleet responses now carry either `operatorAnchor: { role, latestPrinciple }` (when the operator node exists) or `suggest_kyc: true` (when it's missing). Agent uses locked-in constraints to self-clamp suggestions; automated clamping is explicitly deferred to a post-MVP arbiter.
- **`priorMaterializations` per catalyst in `recommend_catalysts`** — every recommendation carries `[{ botRef, botName, artifactRef, artifactLabel, adapterId, materializedAt, latestArtifactPrinciple }]` listing every prior materialization of THAT catalyst anywhere in the fleet, most-recent-first. Reading rule (in tool description): empty → orthogonal pattern; prior on a *different* bot → fleet pattern, align with prior binding choices unless intentionally diverging; prior on the *same* bot → likely duplicate, confirm intent before re-materializing. Closes the synthesis ↔ deliberation loop without coupling `get_catalyst` to the graph.
- **`forward_context` Deliberation section** — new Ring 6 entry in the tool index documenting both meta_context tools, plus a "why was X bound this way?" entry in Quick orientation rules distinguishing the deliberation surface from operational rollups (`fleet_*`) and content reads (`operate.*`).
- **[docs/meta-context.md](../docs/meta-context.md)** — public-facing doc covering the bright line, two-layer (contextmap + principles) model, schema, both event types, adapter-delegated verification (including the codex accept-on-assertion relaxation), cross-ring integration, worked example end-to-end, append-only-by-design policy with the manual cleanup escape hatch, and explicitly-deferred extensions (arbiter, curation, passive writes, audit chain on principles, dashboard). Now also covers the **Inventory (current-state cache, alongside the contextmap)** section explaining why inventory got its own table with replace semantics instead of being shoehorned into the append-only graph.
- Lazy `DB_PATH` resolution in [lib/db/index.js](lib/db/index.js) — `process.env.SQLITE_PATH` is now read at first `getDb()` call instead of at module load, unblocking `:memory:` test isolation for the new repository tests (and any future DB-touching tests). Production behavior unchanged.
- **`meta_mcp_inventory` table** in [control/data/mojulo-lite.db](data/) — single table with `(server, tool_name, tool_ref, description, declared_at)` columns and `UNIQUE(server, tool_name)`. Sits alongside the append-only contextmap on purpose: inventory is the operator's present environment, not a sealed decision, so it gets replace semantics instead of append. Schema lives in [lib/db/index.js](lib/db/index.js); repository in [lib/db/repositories/mcp-inventory.js](lib/db/repositories/mcp-inventory.js). Sync methods matching the meta-context repository pattern.
- **`meta_context_declare_inventory` MCP tool** in [lib/mcp/tools/mcp-inventory.js](lib/mcp/tools/mcp-inventory.js) — atomic `DELETE FROM meta_mcp_inventory; INSERT` in one transaction; latest declaration wins. Returns `{ ok, serversSeen, toolsSeen, replaced, declaredAt, warnings? }`. `warnings: ['no_operator_anchor']` is appended when no operator KYC has been committed yet (inventory still saves; cue to surface KYC inline). Slotted into Ring 6 registration order in [lib/mcp/server.js](lib/mcp/server.js) immediately after `meta_context_commit` so the third Ring 6 surface (current-environment cache) sits next to the two contextmap surfaces. Tool description leads with the non-bot framing: *"Register the operator's broader MCP environment so mojulo can compose solutions that don't require deploying a chatbot."*
- **Inventory snapshot rides on fleet briefs** — `meta_context_brief({kind:'fleet'})` now returns `inventory: { servers, declaredAt, ageSeconds, toolCount }` alongside the contextmap subgraph. When never declared: `{ servers: [], declaredAt: null, ageSeconds: null, toolCount: 0 }`. Per-scope briefs do NOT include `inventory` — it's a fleet-level fact, not a neighborhood property. `ageSeconds` is computed at read time so consumers can decide freshness without re-querying.
- **`forward_context` quick-orientation rule for the non-bot axis** — new rule routing "user wants to automate something that doesn't involve a deployed chatbot" (operator-side workflows, MCP-to-MCP wiring, scheduled digests, signal-triggered automations) to `meta_context_declare_inventory` + direct synthesis, sitting next to the cross-bot catalyst rule for natural disambiguation. The Ring 6 glossary section is also re-framed as three distinct knowledge categories (what fired / why bound / what's available) rather than three flavors of audit tool.
- **[lite-template/integration/MCP_INVENTORY_PLAN.md](../lite-template/integration/MCP_INVENTORY_PLAN.md)** — design plan covering the philosophical move (mojulo decentered from the bot, two-tier epistemics for decisions vs environment, situated within the agent's broader ecosystem), the why-not-the-append-only-graph argument, the inventory tool surface, freshness mitigations, cross-ring touchpoints, and what's deferred for the broader MCP-orbit phase.
- **`mcp_orbit_components` and `mcp_orbit_compositions` tables** in [control/data/mojulo-lite.db](data/) — two-table substrate for the component store. Components: `(kind, ref, version, body_md, payload_json, source)` with `UNIQUE(kind, ref, version)`, six allowed kinds (`source`, `destination`, `trigger`, `pattern`, `idempotency`, `render`), `source` enum `builtin | custom` (schema accommodates user-registered custom components when `register_mcp_orbit_component` ships in v1). Compositions: `(ref, intent_md, component_refs, knobs_json, ranking_score, status, artifact_ref)` with status enum `proposed | dry_run | materialized | retired` — every recommendation persists as a `proposed` row so the recommendation itself is auditable, then state-machines forward as the agent dry-runs and materializes. Schema lives in [lib/db/index.js](lib/db/index.js); repositories in [lib/db/repositories/mcp-orbit.js](lib/db/repositories/mcp-orbit.js) with sync methods matching the meta-context pattern.
- **mcp-orbit component loader** in [lib/mcp/mcp-orbit-components/loader.js](lib/mcp/mcp-orbit-components/loader.js) — components ship as `.md` files under `<kind>/<ref>.md` with JSON frontmatter (required: `ref`, `version`, `summary`; optional: `requires`, `capabilities`, `constraints`, `exposesKnobs`, etc., all rolled into `payload_json` on the row). The filename basename must match the frontmatter `ref` so the file path is a stable typed identifier. `seedComponents()` drops all builtin rows and re-upserts on each call; the loader's once-flag short-circuits repeat calls in normal operation. Validation faults throw — the library is curated, not user input.
- **Five starter components** under [lib/mcp/mcp-orbit-components/](lib/mcp/mcp-orbit-components/) covering the weekly-digest assembly path: [source/linear.md](lib/mcp/mcp-orbit-components/source/linear.md) (cursor on `updated_at`, cost-based rate limit, pagination contract, PII-in-titles pitfall), [destination/gdrive.md](lib/mcp/mcp-orbit-components/destination/gdrive.md) (create-or-append, folder-scoped dedupe, draft posture, trash-isn't-delete pitfall), [trigger/scheduled.md](lib/mcp/mcp-orbit-components/trigger/scheduled.md) (cadence vocabulary, timezone resolution, **non-negotiable idempotency-required constraint**, DST drift), [idempotency/window-key.md](lib/mcp/mcp-orbit-components/idempotency/window-key.md) (composite key `${dest}-${period}`, ISO week disambiguation, search-before-create with exact-match verification), and [pattern/aggregation.md](lib/mcp/mcp-orbit-components/pattern/aggregation.md) (cognitive shape: many events → one summary, four knobs `window`/`grouping`/`depth`/`quiet_mode`, redirect rules to `routing` / `forwarding` / `enrichment` when this pattern doesn't fit).
- **Meta-catalyst body** at [lib/mcp/mcp-orbit-components/meta-catalyst.md](lib/mcp/mcp-orbit-components/meta-catalyst.md) — the composer's rulebook the agent reads once per session before assembling. Carries the six-category map, the hard constraint table (`trigger: scheduled` requires idempotency; `pattern: branching` requires ≥2 destinations; KYC PII constraint forbids body-summarizing render components; etc.), the ranking heuristic (inventory fit × 0.7 + KYC alignment × 0.2 + prior-materialization signal × 0.1), the seven-step composition flow (recognize → recommend → meta-catalyst → get_component per ref → negotiate knobs → dry-run → promote + meta_context_commit), the dry-run discipline (resolve → render → write one real reversible artifact), and the commit discipline (composition ref recorded in an artifact-scope principle as the durable link between artifact and components).
- **Four Ring 6 MCP tools** in [lib/mcp/tools/mcp-orbit.js](lib/mcp/tools/mcp-orbit.js):
  - `list_mcp_orbit_components({ kind?, ref_pattern? })` — discovery surface; returns kind/ref/version/summary per (kind, ref) — max-version row only so older versions don't pollute discovery. Bodies omitted on purpose; fetched via `get_mcp_orbit_component`.
  - `get_mcp_orbit_component({ kind, ref, version? })` — fetch one row with full `body_md` + structured payload (constraints, capabilities, `exposesKnobs`). Omitted `version` returns the highest semver string for that ref.
  - `get_meta_catalyst()` — singleton; returns the meta-catalyst body as plain-text content. Agents read it once per session before composing.
  - `recommend_mcp_orbit_compositions({ intent, inventory? })` — server-side does only the deterministic part: filters available components by the declared MCP inventory and the operator's KYC anchor, scores candidates, writes each as a `proposed` composition row, returns 1-3 ranked candidates with component refs + scoring rationale + constraint warnings (e.g. `scheduled_without_idempotency`, `source_not_in_inventory:linear`). The agent does the composition — pulls component bodies, negotiates knobs, dry-runs, materializes via host adapter, seals via `meta_context_commit`. Response also surfaces `operatorAnchor` / `nextSteps` walking the rest of the flow, and `warnings` (`no_operator_anchor`, `inventory_empty`, `inventory_stale`) when the recommendation is weaker than it could be.
- **mcp-orbit tools registered LAST within Ring 6** in [lib/mcp/server.js](lib/mcp/server.js) — the natural reading order is append-only contextmap → current-state inventory → composer (on top of both). `forward_context` tool index gains an entry routing mcp-orbit intents to `recommend_mcp_orbit_compositions` first, and the "automate something that doesn't involve a deployed chatbot" orientation rule now flows `meta_context_declare_inventory` → `recommend_mcp_orbit_compositions` instead of "declare inventory then synthesize a skill directly."
- **[lite-template/integration/MCP_ORBIT_COMPONENT_STORE_PLAN.md](../lite-template/integration/MCP_ORBIT_COMPONENT_STORE_PLAN.md)** — design plan covering the architectural lesson from meta-context applied forward (typed server-side store with disciplined write rules turns into queryable infrastructure), why typed-store-not-markdown, the six-category model with composition constraint examples, both table schemas with the option-(b) rationale for first-class compositions, the v0 validation slice exercised by this release, and what's deferred (user-custom components via `register_mcp_orbit_component`, composition templates, usage analytics, cross-operator sharing, composition arbiter).

### Changed
- **Tool registration order** in [lib/mcp/server.js](lib/mcp/server.js) — `registerMetaContextTools()` runs last, after `registerCatalystTools()`. Ring 6 sits at the bottom of `tools/list` so the natural reading order surfaces orientation → per-bot → fleet → outcome → deliberation. `forward_context` first, deliberation last.
- **`recommend_catalysts` tool description** rewritten to teach the agent how to consume the new `operatorAnchor` / `suggest_kyc` / `priorMaterializations` fields. The reading rule for prior materializations is in-description so the framing sits next to the data it applies to.
- **CLAUDE.md** updated with the Ring 6 paragraph in the MCP control surface ring list, plus `meta_nodes` / `meta_edges` / `meta_principles` named in the Data layout note.
- Test suite expanded by **104 new tests** across the new files: 44 for the repository, 15 for verification, 31 for the Ring 6 tools, and 14 for cross-ring integration in `catalysts.test.js`. Inventory adds **32 more**: 22 for [lib/db/repositories/mcp-inventory.test.js](lib/db/repositories/mcp-inventory.test.js) (schema, replace semantics, validation, atomicity), 8 for [lib/mcp/tools/mcp-inventory.test.js](lib/mcp/tools/mcp-inventory.test.js) (handler shape + no-operator warnings), and 2 added to [lib/db/repositories/meta-context.test.js](lib/db/repositories/meta-context.test.js) (inventory on fleet brief; absent on per-scope briefs). mcp-orbit adds **45 more**: 24 for [lib/db/repositories/mcp-orbit.test.js](lib/db/repositories/mcp-orbit.test.js) (schema + both repositories — kind/status CHECK enforcement, version coexistence, custom-row preservation on `deleteAllBuiltins`, composition state transitions), 9 for [lib/mcp/mcp-orbit-components/loader.test.js](lib/mcp/mcp-orbit-components/loader.test.js) (frontmatter parsing, filename-ref invariant, drop-on-reseed, bundled-components parse), and 12 for [lib/mcp/tools/mcp-orbit.test.js](lib/mcp/tools/mcp-orbit.test.js) including a **full seven-step e2e flow** (recommend → meta-catalyst → component bodies → state transitions → commit) that asserts the composed candidate matches the five components in the hand-written weekly-digest recipe. Total: **384 lib tests passing**.

## [0.3.0] — 2026-05-22

Catalysts go host-neutral. Until now, every catalyst body assumed the
synthesizing agent was Claude Code and would write a `.claude/skills/<...>/SKILL.md`
file. That assumption is unbundled into a separate **host adapter** layer, so
the same catalyst recipe can materialize as a Claude Code skill, a Codex
automation, or a generic `workflow.md` + runner depending on which agent is
connected. See [docs/catalysts.md](../docs/catalysts.md) and the per-host
prose in [control/lib/mcp/adapters/](lib/mcp/adapters/).

### Added
- **Host adapters** — three ship in [lib/mcp/adapters/](lib/mcp/adapters/),
  symmetric to the catalysts loader: `claude-code` (skill under
  `.claude/skills/`, scheduled via `/schedule`, secrets-guarded via
  `.claude/settings.json` deny rules), `codex` (Codex automation via
  `automation_update` for recurrence, or a workspace `./mojulo-workflows/<slug>/`
  workflow file Codex follows interactively), and `generic` (`workflow.md` +
  runner script for any other agent, scheduling out-of-band). Each adapter
  declares its artifact target, scheduling mechanism, state location, secrets
  posture, and `supportsClientInfoHint` list. The MCP server captures
  `clientInfo` at `initialize` ([client-bindings.js](lib/mcp/client-bindings.js))
  and auto-resolves the adapter for that session; pass `host` explicitly to
  `get_catalyst` / `get_adapter` to override.
- `list_adapters` / `get_adapter` MCP tools (Ring 0, registered next to
  `forward_context` so they show up at the top of `tools/list`). The
  connecting agent reads its bound adapter once per session before
  synthesizing from any catalyst.
- [AGENTS.md](../AGENTS.md) at repo root — orientation for non-Claude agents
  (Codex, future hosts) before mojulo's MCP is connected. Covers the dev MCP
  endpoint, the Codex `~/.codex/config.toml` snippet, and cross-host
  pointers. Claude Code's [CLAUDE.md](../CLAUDE.md) is host-neutral and
  remains the primary architecture doc; AGENTS.md only covers what other
  hosts need *before* the MCP handshake.
- Optional `outputContract` field on catalyst frontmatter — a structured
  description of the per-run output shape, so adapters can render reporting
  without parsing prose. All three shipped adapters read it (see the "Output
  reporting" section in each adapter body). Optional during migration;
  required for new catalysts after the Phase 2 cutover.
- Language packs for new locales: Arabic (ar), Danish (da), Estonian (et),
  Farsi (fa), Filipino (fil), Hindi (hi), Indonesian (id), Kiswahili (sw),
  Malay (ms), Swedish (sv), Thai (th), Turkish (tr), Urdu (ur), and
  Vietnamese (vi). UI strings are now internationalized across 27 languages
  total.

### Changed
- **Every shipped catalyst body rewritten to be host-neutral.** Claude-specific
  phrasing ("synthesize the skill", literal `.claude/skills/<...>/SKILL.md`
  paths, "the skill prints…") is replaced with "materialize the runnable
  artifact" delegated to the bound host adapter. Mapping intent, qualifying
  logic, idempotency strategy, and pitfalls — the *portable* contract — stay
  in the catalyst body. Artifact path, scheduling, dry-run encoding, state
  location, and output reporting move to the adapter. Touched:
  `appointment-to-calendar`, `conversations-to-channel-digest`,
  `document-extract-to-store`, `knowledge-gap-miner`, `qualify-lead-to-crm`,
  `scan-conversations-for-signal`, `submission-to-ticket`,
  `submissions-to-warehouse`, `weekly-submissions-digest`.
- `get_catalyst` response now composes three sections in order: the
  host-neutral **`CATALYST_CORE_PREAMBLE`** (renamed from
  `SYNTHESIZER_BRIEFING` — posture, vocabulary, safety defaults), the bound
  **host adapter body** (artifact target, scheduling, dry-run as a concrete
  step, state, secrets, output reporting), then the **catalyst body**
  itself. Response payload also includes a resolved
  `adapter: { id, name, artifactTarget }` block so callers can surface the
  materialization target in confirmation dialogs.
- `forward_context` rewritten around the host-neutral model: new **Host
  adapter** glossary entry next to the existing **Catalyst** entry,
  `list_adapters` / `get_adapter` added to the Orientation ring of the tool
  index, updated catalyst lifecycle text ("read your adapter once before
  synthesizing"), and the verification posture generalized from "synthesized
  skills" to "runnable workflow artifacts materialized via host adapters
  (Claude Code skills, Codex automations, generic workflow files)."
- `forward_context` tool now surfaces the embed URL of the widget.
- npm package description and keywords broadened from "MCP server for
  building self-hosted chatbots from inside Claude" to "from any MCP-capable
  agent (Claude Code, Codex, and friends)." Keywords add `mcp-server`,
  `codex`, `openai`.
- [docs/catalysts.md](../docs/catalysts.md) and
  [docs/mcp-integration.md](../docs/mcp-integration.md) rewritten around the
  catalyst/adapter split. The concepts table grows a fourth row (host
  adapter) and the "runnable artifact" row replaces the
  Claude-specific "Claude Code skill" row.
- Top-level [README.md](../README.md) and [control/README.md](README.md)
  updated for the multi-host story — host adapters are mentioned next to the
  `forward_context` orientation pointer.

### Security
- `get_deployment` credential redaction now actually redacts. The deployment
  config serializes its per-provider entries under `config.llm.*`, but
  `redactConfigCredentials` in [operate.js](lib/mcp/tools/operate.js) was
  walking `config.llmConfig.*` — a key that doesn't exist — and silently
  returning the config untouched. Anthropic / OpenAI / AWS / Fly API-key
  fields are now redacted before the tool returns. No control-plane DB
  change; the encrypted-at-rest copy in `api_keys` was never affected.
  Users on 0.2.x who routinely call `get_deployment` over MCP should
  assume any provider keys present in those responses were transmitted in
  the clear to the connected agent's session.

## [0.2.2] — 2026-05-21

Discoverability patch on top of 0.2.1. The `mojulo-ui` bin shipped in 0.2.0,
got fixed in 0.2.1, but no surface was telling users (or connecting agents)
it existed — the npm-page README actively said the dashboard wasn't shipped
yet, the MCP `initialize` preamble didn't mention it, and `forward_context`
had no framing for when to suggest it.

### Changed
- [README.md](README.md) — Quickstart adds step 4 for `npx -y -p mojulo
  mojulo-ui`; the top-of-fold lists the three bins (`mojulo`, `mojulo-ui`,
  `mojulo-config`); the "Dashboard" section flips from "clone the repo to
  run it" (the stale 0.1.x instruction) to actual `npx` commands with the
  bin's flags and concrete reasons to reach for it.
- `SERVER_INSTRUCTIONS` (MCP `initialize` preamble) — adds a short
  "There's also a dashboard" paragraph next to the existing orientation
  pointer and the secrets standing rule. Every connecting agent now sees
  the affordance on handshake without having to call `forward_context`
  first.
- `forward_context` — adds a "Two faces, one state" subsection near the
  top of orientation. Frames `mojulo` (MCP) and `mojulo-ui` (dashboard) as
  two faces of the same `~/.mojulo/` state, with concrete decision
  triggers (browse interactively, mint via wizard, fleet analytics as
  charts, click-through deploy management) and an explicit "default is
  still MCP" boundary so the agent doesn't push the dashboard for tasks
  that work fine in chat.

## [0.2.1] — 2026-05-21

Patch on top of 0.2.0. `0.2.0` shipped the Next.js standalone bundle without
its client static assets — the dashboard HTML served fine but every browser
request for `/_next/static/*` (CSS, font, JS chunks) hit 404, leaving the
page unstyled and non-interactive. `0.2.0` is deprecated on the registry
with a pointer to this version.

### Fixed
- `mojulo-ui` now serves the dashboard's client static assets. Root cause:
  Next.js's `output: 'standalone'` deliberately emits `.next/static/` and
  `public/` *outside* the standalone bundle, leaving each deployer
  responsible for copying them in. v0.2.0 packed both trees at the package
  root, which never made them reachable from the standalone server's cwd.
  v0.2.1 fixes this in `prepack` with [stage-standalone.mjs](scripts/stage-standalone.mjs),
  which copies `.next/static → .next/standalone/.next/static` and
  `public → .next/standalone/public` before the pack runs. The top-level
  `.next/static/**` and `public/**` entries are dropped from the `files`
  allowlist (now redundant — the standalone copy is what the server actually
  reads).

### Lesson logged for future Next.js standalone changes
- A `mojulo-ui` smoke that only checks the dashboard HTML returns `200` is
  not sufficient — the browser also has to be able to fetch at least one
  `/_next/static/*` URL successfully. Future smoke tests should `curl` a
  CSS chunk and a woff2 from the running server before declaring a UI
  change validated.

## [0.2.0] — 2026-05-20

Adds the Next.js dashboard as a second binary in the same npm package. The
launch story becomes: build the bot via Claude → operate the fleet via
dashboard → both shipped via one `npx -y mojulo` install. See
[lite-template/integration/UI_PACKAGE_PLAN.md](../lite-template/integration/UI_PACKAGE_PLAN.md).

### Added
- `mojulo-ui` bin — boots the bundled dashboard on a free local port and opens
  the browser ([scripts/mcp-ui.mjs](scripts/mcp-ui.mjs)). Flags: `--port <n>`,
  `--no-open`, `--help`. Binds 127.0.0.1 only. Shares `~/.mojulo/` state with
  the `mojulo` stdio bin, so a bot minted via MCP shows up immediately in the
  UI's fleet view.
- `version` MCP tool (Ring 0) — reports server version, MCP protocol version,
  Node version, platform os/arch, the pinned bot container image tag, the
  `MOJULO_OFFLINE_BUILD` flag, and the active `MOJULO_HOME`. Use to diagnose
  version mismatches between a user-reported issue and what their control
  plane is actually running.
- `inspect_bot_env` MCP tool (Ring 3) — read a bot's container `.env` safely.
  Returns `{ key, value, masked, valueLength? }` entries with sensitive values
  (Anthropic / OpenAI / AWS / Fly / GitHub / Slack tokens, and the
  auto-generated `MOJULO_API_KEY`) masked to first-4 + last-4. Non-sensitive
  entries (`LLM_PROVIDER`, ports, plain webhook URLs) come through clear.
  Takes either `deploymentId` (resolves under `MOJULO_HOME`) or an explicit
  `path` (basename must start with `.env`). The standing rule lives in the
  `initialize` preamble and the new "Secrets handling" section of
  `forward_context`: do not `cat`/`Read` `.env` files of mojulo bots — use this
  tool. Defense-in-depth: a recommended `.claude/settings.json` deny snippet
  is documented in `forward_context` so the harness can block the routine
  `cat .env` path even if an agent forgets the rule. Control-plane provider
  keys are unaffected — those already live encrypted in the `api_keys` table,
  managed via the `mojulo-config` CLI.
- `save_modular_bot` response now includes `artifactPath`, the absolute on-disk
  path to the compiled zip. Stdio MCP callers (which have no HTTP server to hit
  `downloadUrl` against) can surface this directly to the user.
- `open` runtime dep (~120 KB) — used only by the `mojulo-ui` shim for browser
  launch.

### Changed
- Next.js builds emit `output: 'standalone'`. The `mojulo-ui` bin imports the
  resulting `.next/standalone/server.js` directly; the pack ships the pruned
  standalone tree instead of the source app.
- `prepack` runs `stage-lite-template && next build --webpack`. The webpack
  build path is load-bearing — Turbopack's standalone output hashes external
  module names (e.g. `@huggingface/transformers-31f28a0eb9b916d1`), which
  Node's resolver can't find when standalone runs from inside `node_modules/`.
- `lite-template/` is bundled into the package again so the wizard preview
  routes (`/api/preview/bot/*`, `/api/preview/chat`, `/api/preview/extract`)
  resolve under bundled-`lite-template/` conditions. The `mojulo-ui` shim sets
  `LITE_TEMPLATE_PATH` to the bundled copy before booting the standalone
  server.
- `SERVER_VERSION` in the MCP `initialize` handshake reads from `package.json`
  via `getServerVersion()` instead of being a hardcoded constant. Both the
  `initialize` response and the new `version` tool will track future bumps
  automatically.
- `forward_context` tool index updated for the new `version` tool, the
  `artifactPath` field on `save_modular_bot`, and to steer stdio clients away
  from the legacy `downloadUrl` (which is a Next.js-route path, unreachable
  over stdio).
- `files` allowlist expanded with negations to exclude developer state from the
  pack: `.next/standalone/.env*`, `.next/standalone/data/**`,
  `.next/standalone/lib/embedder/models/**`, the duplicate
  `.next/standalone/lite-template/**`, stale `.tgz` artifacts, and test files
  inside the standalone bundle.

### Implementation notes
- Pack size moved from ~600 KB (0.1.0, stdio-only) to ~52 MB (0.2.0, includes
  Next.js standalone + lite-template + bundled deps). Webpack adds ~30 MB over
  the broken Turbopack pack but is the only build path that actually works
  from an `npm install` location.
- The bundled `lite-template/models/tokenizer.json` is 17 MB. Tokenizer cache
  sharing between the control-plane embedder and the bot-runtime embedder is
  deferred to v0.3.0 — currently each pulls from a different cache dir.

## [0.1.0] — 2026-05-19

Initial npm publish. Stdio-only MCP server for driving Mojulo bot design,
deploy, and operate workflows from Claude Code.

### Added
- `mojulo` bin — stdio MCP entrypoint ([scripts/mcp-stdio.mjs](scripts/mcp-stdio.mjs)).
- `mojulo-config` bin — config helper ([scripts/mcp-config.mjs](scripts/mcp-config.mjs)).
- Embedder cold-start: `preloadModel()` fires in the background on bin start so
  the first RAG bot mint avoids a cold ~113MB ONNX download.
- `LITE_TEMPLATE_PATH` env defaults to the bundled lite-template copy resolved
  at runtime from the install location.

### Changed
- `DockerDeployer` skips template file copying in prebuilt-image mode (the
  default). Previously it shipped `.gitignore` and test fixtures into every
  artifact. Offline-build mode (`MOJULO_OFFLINE_BUILD=1`) is unaffected.
- `TEMPLATE_EXCLUDES` excludes test and integration paths from offline-build
  artifacts.

### Removed
- `postinstall` hook. Model download is lazy on first use (with eager
  background preload on bin start) instead of running at `npm install` time.
