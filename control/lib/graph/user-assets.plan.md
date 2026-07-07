# user-assets — persist operator-authored themes and cards without touching the repo

Status: planned, not started. (Revised 2026-07-05 against the `visualization-layer`
tree: card families grew from 3 to 7, the world-kinds registry landed, and
`resolveMojuloPaths` / the export-import plan changed the storage-location answer.)

Files: [theme-registry.js](theme-registry.js) (gains a user-pack union), new
`control/lib/db/repositories/user-themes.js` + a `user_themes` table in
[db/index.js](../db/index.js), a new shared `user-cards.js` scan helper applied to the
card loaders (7 families now: [manji-programs/](manji-programs/loader.js),
[sketch-vocab/](sketch-vocab/loader.js),
[painted-landscape-cards/](painted-landscape-cards/loader.js),
[views/view-vocab/](views/view-vocab/loader.js),
[beats/beats-vocab/](beats/beats-vocab/loader.js),
[game/slice-cards/](game/slice-cards/loader.js),
[game/mechanic-cards/](game/mechanic-cards/loader.js)),
[embeddings.js](../db/repositories/embeddings.js) (indexes user cards), new MCP tools in
[mcp/tools/](../mcp/tools/), and a new on-disk content root `$MOJULO_DATA_DIR/cards/`
resolved through the [mojulo-paths.mjs](../../scripts/mojulo-paths.mjs) layering.

## The problem, precisely

Every visual vocabulary in the substrate is curator-only. The creator extends it by
committing files; an operator on a separate install cannot:

1. **Theme packs** are a static in-memory Map seeded from explicit JS imports
   ([theme-registry.js:57-64](theme-registry.js)). Adding `dwarven-hold` means editing
   the repo — even though a pack is *pure data* (`{ id, family, label, description,
   slots }`, no functions) and the registry header itself promises "new families are new
   packs, not forked generators."
2. **Cards** are directory scans of markdown inside `control/lib/graph/` —
   content-extensible by dropping a file, but only into the repo. The family count has
   grown to seven (shelf / sketch-vocab / painted-landscape / view-vocab / beats-vocab /
   game slice + mechanic cards), each with its own memoizing loader
   (`let _catalog = null`) and its own embeddings source kind (`manji_program`,
   `sketch_vocab`, `painted_landscape`, `view_vocab`, `beats_vocab`, `game_vocab`,
   `game_mechanic`). All loaders assume curated input — validation failures are loader
   bugs that should fail a PR loudly.
3. **Worlds themselves are already fine.** `compose_world` mints a self-contained recipe
   into the `sketches` table (theme slots resolve into concrete params *before* mint), so
   a saved world survives its theme being deleted. What the operator cannot save is the
   *reusable composition* — the `{base, theme, overrides}` they iterated to — as a named
   theme they can re-mint with new seeds.

So the gap is not world persistence; it is user-authored **vocabulary** persistence, in
two grains: theme packs (small JSON, tool-driven) and cards (markdown files, already
file-shaped). With seven card families and counting (beats and games arrived in one
branch), the mechanism must be a shared seam, not seven bespoke loader edits.

## Where user content lives (the storage answer)

[mojulo-paths.mjs](../../scripts/mojulo-paths.mjs) already funnels all workshop state
under one root: `MOJULO_HOME` → `MOJULO_DATA_DIR` (default `$MOJULO_HOME/data`) →
`SQLITE_PATH` / `ARTIFACTS_DIR` / `STORAGE_ROOT`. The repo's `control/data/` is only the
dev fallback when those env vars are unset. User assets follow the same layering:

- **User themes** → rows in the control SQLite (`SQLITE_PATH`), so they ride wherever
  the DB lives.
- **User cards** → `$MOJULO_DATA_DIR/cards/<family>/` (dev fallback `control/data/cards/`
  via the same default chain the DB uses).

This means the planned full-workshop `npx mojulo export` / `import`
([export-import.plan.md](../../scripts/export-import.plan.md)) covers user assets **for
free** — both grains live under the one root it bundles. Do not invent a separate
backup story; do add `cards/` to that plan's per-bay manifest counts when either lands.

## Target shape

### Layer 1 — user theme packs (DB-backed, unioned into the registry)

New table, following the `sketches`/`stashes` ref discipline:

```sql
user_themes( id INTEGER PK, theme_id TEXT UNIQUE, family TEXT, label TEXT,
             description TEXT, slots_json TEXT, created_at INTEGER, updated_at INTEGER )
```

`theme-registry.js` keeps the built-in Map untouched and gains a hydration seam:

```js
// user-themes bridge — called lazily on first registry access and after every
// save/delete. Built-in ids win: saving a user pack whose id collides with a shipped
// pack is rejected at the repository layer, so hydration can registerTheme() blindly
// (replace semantics only ever replace an older version of the same user pack).
export function hydrateUserThemes(rows) {
  for (const row of rows) registerTheme({ ...row, slots: JSON.parse(row.slots_json), source: 'user' });
}
```

`listThemes()` summaries grow a `source: 'builtin' | 'user'` field (default `'builtin'`);
`list_world_themes` passes it through so the agent can tell the operator what is theirs.
`resolveTheme` / `composeWorld` need **zero changes** — a user pack is just a pack, and
it flavors every base (`city`, `transport-hub`, `controllable`, `action`, `operator`,
`planetary`, `painted-landscape`, `math`) exactly as a shipped pack would.

New MCP tools (registered in server.js — `instrumentedInvoke` wraps them automatically —
with rows added to `TOOL_INDEX` / `ROUTING_INDEX`; the registry-sweep test in
`context.test.js` enforces this):

- `save_world_theme({ id, family, label, description?, slots })` — runs the existing
  `registerTheme` shape validation *as a user-facing rejection* (not a throw-through),
  refuses built-in id collisions, upserts the row, re-hydrates. The "save this world as a
  theme" flow is just the agent passing back the same `overrides` object it composed
  with — no new plumbing, since the agent holds `{base, theme, overrides}` in-hand at
  compose time.
- `delete_world_theme({ id })` — user packs only. Deleting never breaks an existing
  world (recipes are self-contained — see invariant below).

### Layer 2 — user card directories (filesystem, unioned into the loaders)

New content root: `$MOJULO_DATA_DIR/cards/<family>/`. One shared helper —
`graph/user-cards.js` — owns the mechanism; each loader keeps owning its meaning:

- `scanUserCards(family, validateFn)` reads the family's user dir, parses frontmatter,
  and applies the loader's own validator with a **defensive posture**: a malformed card
  is skipped and reported (`warnings: [{ file, reason }]`), never thrown. Built-in dirs
  keep the loud-fail posture unchanged.
- Loaders union built-ins + user cards into their existing `_catalog` memo; card
  summaries grow `source: 'builtin' | 'user'`. Id collisions: built-in wins, user card
  skipped with a warning (no silent shadowing of curated geometry).
- The existing `_catalog = null` memo seam is the cache-invalidation hook: save/delete
  tools reset the family's catalog so the next read rescans.

**Family enablement is a whitelist, not all-seven-at-once.** The mechanism is generic,
but user authoring only makes sense where the card's payload is pure data the substrate
executes: start with `manji-programs` (the "polygonized patterns" ask — shelf geometry)
and `painted-landscape-cards` (glyph trios/profiles). Vocab-manual families
(`view-vocab`, `beats-vocab`, `sketch-vocab` chart tiers, game cards) document *code*
kinds — a user card there describes nothing the install can execute — so they stay
curator-only until a concrete need shows up. The whitelist lives in `user-cards.js`.

`reindexAll` in [embeddings.js](../db/repositories/embeddings.js) indexes user cards
under the family's existing source kind so `semantic_search` and the polygonizer
card-router pick them up transparently, with the provenance flag carried in metadata.
Reindex of the affected kind is triggered on save/delete — the operator never runs
`reindex-embeddings.js` by hand for this.

New MCP tools: `save_card({ family, markdown })` and `delete_card({ family, id })`.
`save_card` validates in three stages before any write:

1. Family whitelist check, then frontmatter parse + the family's `REQUIRED_FIELDS` /
   payload-field checks (same rules the loader applies, returned as user-facing errors).
2. Built-in id collision → reject with the existing card's identity.
3. **Dry-run mint** for shelf cards: invoke the card once through its `programRef` path
   with a fixed seed and catch throws — a card that cannot produce geometry is rejected,
   not persisted. This is the same posture `create_game` established as G4
   (verification-as-promotion-gate: refuse the artifact until a dry-run proves it works);
   no `allow_unaudited` escape here — a broken card has no salvage value.

Because cards stay plain markdown files, export/import between installs is free: copy
the file (or move the whole workshop via `mojulo export`). That is the whole
community-asset story for now (see non-goals).

## Invariant to seal (docs)

**Mint-time resolution, never render-time.** Worlds are self-contained because
`composeWorld` resolves `theme.slots ⊕ overrides` into concrete params before minting;
the stored recipe holds resolved values, not registry references. User registries must
never be consulted on the render path — `resolveWorldScene` and the
[worlds/world-kinds.js](worlds/world-kinds.js) descriptors, `/svg`, `/scene` — so
deleting a user theme or card can never break a previously minted world. State this in
POLYGONIZER-SYNTHESIS.md and the theme-registry header when Layer 1 lands. (Card-invoking
recipes that store a `programRef` need a check here: if any stored manifest re-reads a
card at render time, that card family either snapshots the payload into the manifest at
mint, or user deletion of an in-use card is blocked — decide per family in phase 3.)

## Decisions

- **DB for themes, files for cards.** Slightly inconsistent, deliberately: themes are
  small JSON saved from a tool-driven flow (DB row is the natural grain, no file
  lifecycle to manage); cards are markdown the loaders already scan and that users will
  want to hand-copy between installs. Forcing either into the other's shape adds a sync
  problem for no gain. Both grains live under the `MOJULO_DATA_DIR` root, so the
  export/import bundle covers them identically.
- **Shared scan helper, per-family validators, whitelist enablement.** Seven loaders is
  too many for bespoke edits and too few for a framework; one helper owning
  scan/skip/warn/collide, with each family opting in only when user authoring of its
  payload is meaningful.
- **Built-in always wins on id collision.** The curated library is a determinism
  contract (e.g. `earth-temperate` must reproduce a bare city byte-for-byte); letting a
  user pack shadow it would make the same recipe render differently across installs.
- **No new UI surface.** Consistent with world-composer.plan.md's audience: the operator
  drives this from their host MCP agent. Dashboard involvement is at most render-only
  (a `source` badge in the Maker gallery), added later if wanted.
- **Single-user, loopback-only.** No auth, no quotas, no per-user namespacing — the
  golden rules already forbid multi-tenant assumptions. "User" here means "the operator
  of this install," not an account.

## Build phases

1. **`user_themes` table + repository + registry hydration.** Migration in db/index.js,
   `UserThemeRepository` (create/update/delete/list, built-in-collision guard), lazy
   `hydrateUserThemes` seam in theme-registry.js, `source` field through `listThemes` and
   `list_world_themes`. Test: registry union order, collision rejection, compose_world
   with a user theme minting identically to the same slots passed as overrides.
2. **`save_world_theme` / `delete_world_theme` MCP tools.** Registration in server.js +
   `TOOL_INDEX`/`ROUTING_INDEX` rows in context.js (registry-sweep test enforces).
   Test: save → list → compose → delete → previously minted world still renders.
3. **`user-cards.js` + whitelist union into the two starter families.** The shared scan
   helper, `$MOJULO_DATA_DIR/cards/` root via the paths layering, defensive posture,
   `source` + `warnings` in loader results, collision skip, `_catalog` invalidation
   hook. Resolve the render-time `programRef` question per family (snapshot vs
   delete-block). Test: tmp user dir fixtures — valid card surfaces, malformed card
   warns without throwing, colliding card is skipped, memo resets on invalidation.
4. **`save_card` / `delete_card` MCP tools + reindex-on-save.** Three-stage validation
   including the dry-run mint; targeted `meta_embeddings` reindex (insert on save,
   delete stale vectors on delete). Test: rejected card writes nothing; saved card is
   immediately visible to `semantic_search`; deleted card's vector is gone.
5. **Docs + verify.** Mint-time-resolution invariant into POLYGONIZER-SYNTHESIS.md and
   the theme-registry header; STATUS.md §8's "content-extensible by dropping a card"
   line updated to name the operator-facing path; CLAUDE.md architecture-map pointer;
   a `cards/` line item for export-import.plan.md's manifest. `npx vitest run` on new
   tests + existing theme/loader/compose coverage; `node --check` on touched files.

## Non-goals

- **New bases, card families, or world kinds.** The "code-extensible only for new
  families" boundary stays exactly where STATUS.md draws it. The world-kinds registry
  ([worlds/world-kinds.js](worlds/world-kinds.js), landed) is the seam a plugin-style
  family story would build on; out of scope here.
- **User authoring for the vocab-manual families** (view-vocab, beats-vocab, game
  cards, sketch-vocab chart tiers). Their cards document code kinds; nothing to author
  until user payloads mean something there.
- **Sharing / marketplace / import tooling.** Copying a card file between installs (or
  the full-workshop `mojulo export`) is the mechanism. A curated "community shelf" is a
  later, separate decision.
- **A card/theme editor UI.** Authoring happens through the agent; the dashboard renders
  state at most.
- **User-authored code** (custom assemblers, wave kernels, shaders, kernels stringified
  into pages). Everything here is data flowing through existing curated code paths —
  that is what keeps validation tractable, the determinism contract intact, and the
  emit-channel char net untouched (user assets must never alter emitted page bytes for a
  recipe that doesn't use them).
- **Merge/reconcile semantics across installs.** Same posture as export-import v1:
  refs are install-local; collisions on import are that plan's problem, not this one's.

## Risks

- **Dry-run mint is one seed, not a proof.** A user shelf card can validate, mint once,
  and still produce degenerate geometry at other seeds or in composition. Acceptable:
  the failure is contained to that operator's install and their own card; the warning
  surface makes it debuggable. Do not chase exhaustive validation (G4's traversal-gate
  depth is for games, not cards).
- **Stale embedding vectors.** Delete paths must remove the card's rows from
  `meta_embeddings`, or `semantic_search` will route to ghosts. The targeted-reindex
  helper in phase 4 owns both directions; add a test that deletion removes the vector.
- **Memo/DB divergence across processes.** Registry Map and loader `_catalog` memos are
  per-process; Next.js dev hot-reload and the route/MCP split mean hydration and
  invalidation must be idempotent and cheap (they are: `registerTheme` replaces,
  `_catalog = null` rescans). Hydrate lazily on first access, never at import, so db
  availability ordering can't bite. A stale memo in a *different* process after a save
  is acceptable staleness for a single-user tool — next process restart or invalidation
  catches it; do not build cross-process cache coherence.
- **Paths layering drift.** The card root must resolve through the same
  `MOJULO_DATA_DIR` chain as the DB — hardcoding `control/data/` would strand installed
  users' cards outside the export bundle. One resolver, used by both the loaders and the
  save tools.
