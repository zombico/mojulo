# Local catalysts — a mintable, DB-persisted shelf beside the curated library

> **Status:** all six slices landed (validator extraction, schema + repository,
> merged catalog + `mint_catalyst`, guide fork, embeddings integration,
> docs/tool-index). Uncommitted on `visualization-layer`.

## Intent

Today the catalyst library is maintainer-only: a filesystem scan of curated `.md`
files at boot ([loader.js](loader.js)), with `custom_catalyst` returning an
author's guide whose only exit is a PR against the repo. The loader header says
it outright: "there is no user-writable catalyst directory."

This plan adds a **local shelf**: the operator (through their host agent) can
mint a catalyst over MCP, have it persist in the control-plane DB, and from that
moment use it *as if it shipped with mojulo* — it appears in `list_catalysts`,
composes the preamble + host adapter in `get_catalyst`, participates in
`recommend_catalysts`, and is discoverable via `semantic_search`. The curated
shelf stays curated; the PR path stays alive as the graduation gate.

What this deliberately does NOT change: the catalyst *spec*. The three levels of
opinionation hold —

1. **Machine-enforced spec** (frontmatter contract, required fields, kind rules,
   non-empty body) — enforced identically on local mints, by the same validator.
2. **Editorial template** (six-section body, mapping-insight bar, idempotency
   rubric) — advisory locally. The mint tool does not grade prose. The operator
   owns their shelf quality; the editorial bar is enforced only at PR
   graduation, same as today.
3. **Runtime composition** (`CATALYST_CORE_PREAMBLE` + adapter section for
   `workflow`, bare body for `technique`) — applies unchanged by `kind`.

## Design decisions

### D1 — DB rows, not a user file directory

Catalysts-as-rows matches the substrate's sovereignty doctrine (things that keep
existing live in the DB) and buys two things files can't: per-write embedding
hooks (fixing, for the local shelf, the known "edited in place, never reindexed"
gap the curated shelf has) and a revision history. Export back to `.md` is a
cheap serialization (D7), so nothing is lost vs. files.

### D2 — Head + revisions, the beats pattern

Mirror `beats_revisions` ([../../db/repositories/beats.js](../../db/repositories/beats.js),
schema in db/index.js): the head row is the live pointer, every write appends a
revision, `note` is the commit message.

```sql
-- Local catalysts: the operator-minted shelf beside the curated library.
-- The row is the HEAD (list/get/recommend read it directly); revisions are
-- history, never the live pointer. frontmatter_json holds the validated meta
-- (id, name, summary, valueHook, kind, category, requires, parameters,
-- mcpTools, outputContract) — same shape parseCatalystFile() produces, so the
-- tool layer composes curated + local rows through one code path.
CREATE TABLE IF NOT EXISTS local_catalysts (
  id TEXT PRIMARY KEY,                 -- kebab-case slug, same conventions as curated
  frontmatter_json TEXT NOT NULL,
  body_md TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('workflow','technique')) DEFAULT 'workflow',
  rev INTEGER NOT NULL DEFAULT 1,      -- head revision number (= version served)
  status TEXT NOT NULL CHECK(status IN ('active','archived')) DEFAULT 'active',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS local_catalyst_revisions (
  id INTEGER PRIMARY KEY,
  catalyst_id TEXT NOT NULL REFERENCES local_catalysts(id) ON DELETE CASCADE,
  rev INTEGER NOT NULL,
  frontmatter_json TEXT NOT NULL,
  body_md TEXT NOT NULL,
  note TEXT,                           -- the revision's commit message
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(catalyst_id, rev)
);
CREATE INDEX IF NOT EXISTS idx_local_catalyst_revisions
  ON local_catalyst_revisions(catalyst_id, rev DESC);
```

Versioning consequence: for local catalysts the frontmatter `version` field is
**derived** — it is always the head `rev`. `mint_catalyst` ignores a supplied
`version` (curated files keep their advisory git-versioned field untouched).
This resolves the "versioning is the incomplete opinion" gap: local catalysts
get real history (append-only, with notes) instead of an honor-system number.

### D3 — One validator, shared by loader and mint

Extract the object-level checks out of `parseCatalystFile()` (loader.js:66)
into `validateCatalystMeta(meta, body, { kind })` that both the file loader and
the mint tool call. Same errors, same required fields, same kind rules.

Two deltas while we're here:

- **Promote the `destinationExamples` rule into the validator.** Today
  "`requires.destinationExamples` required when `destinationMcpCategory` is
  set" lives only in loader.test.js as a curation guardrail. Local mints have
  no PR review, so the rule must be mechanical. All curated files already pass
  it (the test enforces that), so promoting it is safe for the curated shelf
  too.
- **Kind is explicit for local catalysts.** The curated shelf infers kind from
  directory placement; rows have no shelf, so `kind` is a mint parameter
  (default `'workflow'`). Both kinds are allowed — a technique catalyst is just
  as mintable as a workflow one.

### D4 — Catalog merge and id policy

`getCatalystCatalog()` stays the memoized curated map. Add
`getMergedCatalog()` in the tool layer (or loader) = memoized curated map +
**read-through** query of active `local_catalysts` rows (no cache — the table
is tens of rows in a local SQLite; a dirty-flag cache is premature). All four
tools switch to the merged view. Each merged entry carries
`origin: 'curated' | 'local'`, surfaced in `list_catalysts` / `get_catalyst` /
`buildRecommendation()` output so the agent can phrase provenance honestly
("your minted catalyst" vs "shipped with mojulo").

Id collisions, two directions:

- **Mint time**: refuse to mint an id that exists on the curated shelf (or as
  another local row — that's the upsert path instead). Error names the curated
  file, suggests re-sluging.
- **Upgrade time** (a future curated catalyst ships with an id the operator
  already minted): curated wins the bare id; the local row is kept, flagged
  `eclipsed: true` in `list_catalysts`, and excluded from `get_catalyst`
  resolution until the operator re-slugs it via `mint_catalyst` (rename = mint
  under new id + archive old). Never silently drop operator data; never let a
  local row shadow a shipped one.

### D5 — Tool surface

- **`mint_catalyst`** (new, Ring 3, matches the `mint_stash` / `mint_drawer`
  idiom). Upsert semantics keyed on `id`:
  - id absent from local shelf → validate, insert head at rev 1, write
    revision 1, embed.
  - id exists on local shelf → validate, append revision (`note` required on
    updates — it's the commit message), bump head, re-embed.
  - `archive: true` → flip status, delete the embedding row, keep revisions.
  - Response includes the canonical serialized `.md` (frontmatter + fences +
    body) — the graduation affordance (D7).
- **`get_catalyst`** gains optional `rev` (local ids only): read a historical
  revision. Head behavior unchanged. Local `workflow` bodies compose preamble +
  adapter exactly like curated ones; local `technique` bodies return bare, per
  the existing branch.
- **`list_catalysts` / `recommend_catalysts`**: merged catalog, `origin`
  annotated, otherwise unchanged. Techniques stay excluded from
  recommendations, same as today.
- **`custom_catalyst`** guide forks its ending: Step 4/6 currently end at "save
  to a working dir and PR." New posture — **default endpoint is
  `mint_catalyst`** ("it's on your shelf now, usable immediately"); the PR
  hand-off becomes the *graduation* path for catalysts that prove out and are
  worth contributing. The posture-check (Step 1) stays word-for-word: a thin
  catalyst is still the wrong artifact even on a private shelf, but the
  pushback softens from "the library is curated, don't dilute it" to "this
  won't pay rent even for you — consider a plain skill."

### D6 — Embeddings

Per-write hook mirroring `GameProjectRepository.createWithEmbedding` /
`updateWithEmbedding` ([../../db/repositories/game-projects.js](../../db/repositories/game-projects.js)):
embed `BodyComposition.catalyst(cat)` under the existing `sourceKind:
'catalyst'`, `sourceRef: id`. Embed failures are soft (the mint succeeds,
search finds it after the next reindex) — same posture as game projects.

`reindexAll()` section 7 (embeddings.js:971) switches from
`getCatalystCatalog()` to the merged catalog so a from-scratch reindex includes
the local shelf. Archived rows are skipped there and their embedding rows
deleted at archive time.

No new `SOURCE_KINDS` entry — local and curated catalysts are the same kind of
thing to search; `origin` lives in the payload, not the taxonomy.

### D7 — Graduation path (local → curated)

`mint_catalyst` returns (and `get_catalyst` on a local id can reconstruct) the
exact `.md` file text the curated shelf would hold. The contribution flow
becomes: mint → use for real → when it proves out, take the serialized file,
strip nothing, PR it under `control/lib/mcp/catalysts/`, then archive the local
row once the curated version ships (the upgrade-collision rule in D4 nudges
this). The editorial bar (level 2) is enforced exactly where it can be — at the
PR.

## Non-goals

- No renderer / view-kind / theme minting — that is the separate "custom kinds"
  design (data-defined kinds over existing primitives) and is out of scope here.
- No dashboard surface. The shelf is headless; a gallery page can come later.
- No auto-sync between the local shelf and the repo, in either direction.
- No prose-quality gating in the mint tool (level 2 stays advisory locally).
- No `forward_context` routing rows — `mint_catalyst` is reachable through the
  existing catalyst drawer; only `TOOL_INDEX` / `ROUTING_INDEX` registration
  per the golden rule.

## Slices

1. **Validator extraction.** Pull `validateCatalystMeta()` out of
   `parseCatalystFile()`; promote the `destinationExamples` rule; loader tests
   keep passing; new unit tests for the object-level validator.
2. **Schema + repository.** `local_catalysts` + `local_catalyst_revisions`
   migrations in db/index.js; `LocalCatalystRepository` with
   `createWithEmbedding` / `updateWithEmbedding` / `archive` / `get` /
   `getRevision` / `listRevisions` / `listActive`, beats-style.
3. **Merged catalog + tool surface.** `getMergedCatalog()`; wire the four
   existing tools to it (`origin`, `eclipsed`, `rev` on get); register
   `mint_catalyst`; collision rules from D4.
4. **Guide fork.** Rewrite `CUSTOM_CATALYST_GUIDE` Steps 4–6 around the
   mint-first / PR-as-graduation posture; update the `custom_catalyst` tool
   description; rewrite the loader header comment (its "no user-writable
   catalyst directory" doctrine is superseded by this plan).
5. **Embeddings integration.** Write hooks (slice 2 lands them repository-side;
   this slice covers `reindexAll` merged-catalog sourcing + archive cleanup +
   tests against the embeddings test harness).
6. **Docs + index.** New "Local catalysts" section in docs/catalysts.md
   (revising the maintainer-only stance); `TOOL_INDEX` / `ROUTING_INDEX` entry
   for `mint_catalyst`; STATUS.md at commit time.

## Test focus

- Validator: parity between file-parsed and mint-supplied meta; the promoted
  `destinationExamples` rule; kind explicitness.
- Repository: rev append ordering, head/revision consistency, archive keeps
  history, UNIQUE(catalyst_id, rev).
- Tools: mint→list→get→recommend round trip; curated-id mint refusal; eclipse
  behavior; `rev` reads; technique kind skips preamble/adapter and
  recommendations; update requires `note`.
- Embeddings: minted catalyst is searchable under `kinds: ['catalyst']`;
  update re-embeds (hash change); archive removes the row; `reindexAll`
  includes local shelf.
