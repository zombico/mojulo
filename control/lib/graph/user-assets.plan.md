# user-assets — persist operator-authored themes and cards without touching the repo

Status: planned, not started.

Files: [theme-registry.js](theme-registry.js) (gains a user-pack union), new
`control/lib/db/repositories/user-themes.js` + a `user_themes` table in
[db/index.js](../db/index.js), the three card loaders
([manji-programs/loader.js](manji-programs/loader.js),
[sketch-vocab/loader.js](sketch-vocab/loader.js),
[painted-landscape-cards/loader.js](painted-landscape-cards/loader.js)) (each gains a
user-dir scan), [embeddings.js](../db/repositories/embeddings.js) (indexes user cards),
new MCP tools in [mcp/tools/](../mcp/tools/), and a new on-disk content root
`control/data/cards/`.

## The problem, precisely

Every visual vocabulary in the substrate is curator-only. The creator extends it by
committing files; an operator on a separate install cannot:

1. **Theme packs** are a static in-memory Map seeded from explicit JS imports
   ([theme-registry.js:57-64](theme-registry.js)). Adding `dwarven-hold` means editing
   the repo — even though a pack is *pure data* (`{ id, family, label, description,
   slots }`, no functions) and the registry header itself promises "new families are new
   packs, not forked generators."
2. **Cards** (shelf / sketch-vocab / painted-landscape) are directory scans of markdown
   inside `control/lib/graph/` — content-extensible by dropping a file, but only into the
   repo. The loaders treat validation failures as loader bugs ("should fail a PR
   loudly"), i.e. they assume curated input.
3. **Worlds themselves are already fine.** `compose_world` mints a self-contained recipe
   into the `sketches` table (theme slots resolve into concrete params *before* mint), so
   a saved world survives its theme being deleted. What the operator cannot save is the
   *reusable composition* — the `{base, theme, overrides}` they iterated to — as a named
   theme they can re-mint with new seeds.

So the gap is not world persistence; it is user-authored **vocabulary** persistence, in
two grains: theme packs (small JSON, tool-driven) and cards (markdown files, already
file-shaped).

## Target shape

### Layer 1 — user theme packs (DB-backed, unioned into the registry)

New table, following the `sketches`/`stashes` ref discipline:

```sql
user_themes( id INTEGER PK, theme_id TEXT UNIQUE, family TEXT, label TEXT,
             description TEXT, slots_json TEXT, created_at INTEGER, updated_at INTEGER )
```

`theme-registry.js` keeps the built-in Map untouched and gains a hydration seam:

```js
// user-themes bridge — called once at first registry access and after every save/delete.
// Built-in ids win: saving a user pack whose id collides with a shipped pack is rejected
// at the repository layer, so hydration can registerTheme() blindly (replace semantics
// only ever replace an older version of the same user pack).
export function hydrateUserThemes(rows) {
  for (const row of rows) registerTheme({ ...row, slots: JSON.parse(row.slots_json), source: 'user' });
}
```

`listThemes()` summaries grow a `source: 'builtin' | 'user'` field (default `'builtin'`);
`list_world_themes` passes it through so the agent can tell the operator what is theirs.
`resolveTheme` / `composeWorld` need **zero changes** — a user pack is just a pack.

New MCP tools (registered in server.js, rows added to `TOOL_INDEX` / `ROUTING_INDEX` per
the forward_context golden rule):

- `save_world_theme({ id, family, label, description?, slots })` — runs the existing
  `registerTheme` shape validation *as a user-facing rejection* (not a throw-through),
  refuses built-in id collisions, upserts the row, re-hydrates. The "save this world as a
  theme" flow is just the agent passing back the same `overrides` object it composed
  with — no new plumbing, since the agent holds `{base, theme, overrides}` in-hand at
  compose time.
- `delete_world_theme({ id })` — user packs only. Deleting never breaks an existing
  world (recipes are self-contained — see invariant below).

### Layer 2 — user card directory (filesystem, unioned into the loaders)

New content root: `control/data/cards/{manji-programs,sketch-vocab,painted-landscape}/`,
following the established "generated/authored content lives under `control/data/`"
convention (`outcomes/`, `exports/`, `storage/`). `$MOJULO_HOME` stays reserved for
runtime state and secrets.

Each loader scans its user dir *after* its built-in dir with a different failure
posture:

- Built-in dir: unchanged — malformed card = loader bug, fail loudly.
- User dir: defensive — malformed card is **skipped and reported**, never thrown. The
  loader result grows a `warnings` array (`{ file, reason }`) surfaced by the save tools
  and `get_sketch_vocab`-family listings.
- Card summaries grow `source: 'builtin' | 'user'`. Id collisions: built-in wins; the
  user card is skipped with a warning (no silent shadowing of curated geometry).

`reindexAll` in [embeddings.js](../db/repositories/embeddings.js) indexes user cards
under the same source kinds (`manji_program`, `sketch_vocab`, painted glyphs) so
`semantic_search` and the polygonizer card-router pick them up transparently, with the
provenance flag carried in metadata. Reindex of the affected kind is triggered on
save/delete — the operator never runs `reindex-embeddings.js` by hand for this.

New MCP tools: `save_card({ family, markdown })` and `delete_card({ family, id })`.
`save_card` validates in three stages before any write:

1. Frontmatter parse + the family's `REQUIRED_FIELDS` / payload-field checks (same rules
   the loader applies, returned as user-facing errors).
2. Built-in id collision → reject with the existing card's identity.
3. **Dry-run mint** for shelf cards: invoke the card once through its `programRef` path
   with a fixed seed and catch throws — a card that cannot produce geometry is rejected,
   not persisted.

Because cards stay plain markdown files, export/import between installs is free: copy
the file. That is the whole community-asset story for now (see non-goals).

## Invariant to seal (docs)

**Mint-time resolution, never render-time.** Worlds are self-contained because
`composeWorld` resolves `theme.slots ⊕ overrides` into concrete params before minting;
the stored recipe holds resolved values, not registry references. User registries must
never be consulted on the render path (`resolveWorldScene`, `/svg`, `/scene`) — deleting
a user theme or card must not be able to break a previously minted world. State this in
POLYGONIZER-SYNTHESIS.md and the theme-registry header when Layer 1 lands. (Card-invoking
recipes that store a `programRef` need a check here: if any stored manifest re-reads a
card at render time, that card family either snapshots the payload into the manifest at
mint, or user deletion of an in-use card is blocked — decide per family in phase 3.)

## Decisions

- **DB for themes, files for cards.** Slightly inconsistent, deliberately: themes are
  small JSON saved from a tool-driven flow (DB row is the natural grain, no file
  lifecycle to manage); cards are markdown the loaders already scan and that users will
  want to hand-copy between installs. Forcing either into the other's shape adds a sync
  problem for no gain.
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
   `UserThemeRepository` (create/update/delete/list, built-in-collision guard),
   `hydrateUserThemes` seam in theme-registry.js, `source` field through `listThemes` and
   `list_world_themes`. Test: registry union order, collision rejection, compose_world
   with a user theme minting identically to the same slots passed as overrides.
2. **`save_world_theme` / `delete_world_theme` MCP tools.** Registration in server.js +
   `TOOL_INDEX`/`ROUTING_INDEX` rows in context.js. Test: save → list → compose → delete
   → previously minted world still renders.
3. **User card dirs + defensive loader union.** `control/data/cards/` root, per-family
   scan with skip-and-warn posture, `source` + `warnings` in loader results, collision
   skip. Resolve the render-time `programRef` question per family (snapshot vs
   delete-block). Test: tmp user dir fixtures — valid card surfaces, malformed card warns
   without throwing, colliding card is skipped.
4. **`save_card` / `delete_card` MCP tools + reindex-on-save.** Three-stage validation
   including the dry-run mint; targeted `meta_embeddings` reindex (insert on save, delete
   stale vectors on delete). Test: rejected card writes nothing; saved card is
   immediately visible to `semantic_search`.
5. **Docs + verify.** Mint-time-resolution invariant into POLYGONIZER-SYNTHESIS.md and
   the theme-registry header; STATUS.md line 105 ("content-extensible by dropping a
   card") updated to name the operator-facing path; CLAUDE.md architecture map pointer.
   `npx vitest run` on new tests + existing theme/loader/compose coverage; `node --check`
   on touched files.

## Non-goals

- **New bases, card families, or world kinds.** The "code-extensible only for new
  families" boundary stays exactly where STATUS.md draws it. The world-kinds registry
  ([world-scene-registry.plan.md](worlds/world-scene-registry.plan.md)) is the eventual
  seam if that ever changes; out of scope here.
- **Sharing / marketplace / import tooling.** Copying a card file between installs is
  the mechanism. A curated "community shelf" is a later, separate decision.
- **A card/theme editor UI.** Authoring happens through the agent; the dashboard renders
  state at most.
- **User-authored code** (custom assemblers, wave kernels, shaders). Everything here is
  data flowing through existing curated code paths — that is what keeps validation
  tractable and the determinism contract intact.

## Risks

- **Dry-run mint is one seed, not a proof.** A user shelf card can validate, mint once,
  and still produce degenerate geometry at other seeds or in composition. Acceptable:
  the failure is contained to that operator's install and their own card; the warning
  surface makes it debuggable. Do not chase exhaustive validation.
- **Stale embedding vectors.** Delete paths must remove the card's rows from
  `meta_embeddings`, or `semantic_search` will route to ghosts. The targeted-reindex
  helper in phase 4 owns both directions; add a test that deletion removes the vector.
- **Map hydration vs process lifecycle.** The registry Map is per-process; Next.js dev
  hot-reload and the route/MCP split mean hydration must be idempotent and cheap (it is:
  `registerTheme` replaces). Hydrate lazily on first registry access rather than at
  import, so db availability ordering can't bite.
- **`control/data/cards` vs cleanup tooling.** `cleanup-stale-artifacts.js` and any
  backup guidance must treat `cards/` as durable user content, not regenerable output —
  check the script's scope in phase 3 before creating the dir.
