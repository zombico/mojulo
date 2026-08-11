# match-modes — game modes as a substrate primitive (post-mortem of the arena mode abstraction)

Status: M1–M4 LANDED (2026-08-10, uncommitted); M5 (seat-by-reference) and M6 (derivation
chains) remain open, in that order of pull. What landed:
- **M1** — `mapRef` accepted + validated in the controllable mint (merged-form renderability +
  figure checks, [mcp/tools/scene-controllable.js](../../mcp/tools/scene-controllable.js)); taught
  in the controllable view-vocab card and the game mechanics-guide card. Gate:
  `scene-controllable.test.js` mints a two-light-level toy game over one map end-to-end.
- **M2** — export terrain hoisting ([export-game.js](../../mcp/tools/export-game.js)
  `hoistGeometry`): big `GROUPS`/`REPEATS`/`TEXTURES` literals hoist into content-hashed
  `assets/geometry/` files (256KB threshold, env-overridable), deduped across pages — mode
  variants of one map ship its terrain once. Gate: `export-game.test.js` proves one shared
  groups file across two mapRef levels + the map recipe shipped once.
- **M3** — the suit-agnostic core promoted to [worlds/match-modes.js](match-modes.js) (beside
  `controllable/`, not inside — it's mint-time authoring, not emitted engine code; open decision
  2 resolved): all five builders + arenaGeometry/seatRule/matchLayer/spectator camera +
  lightenMatchLevel, parameterized by `prelude(m)`/`nameOf(id)` hooks with per-call knobs
  (killTarget/rivals/teamNames/…). [mobile-suit/arena-modes.js](../mobile-suit/arena-modes.js)
  shrank to NAMES + the two arena preludes + the registry. Zero imports from packs. Gate: all 35
  arena dry-run hashes byte-identical to the stored rows; `worlds/match-modes.test.js` is the
  pack-absent tripwire.
- **M4** — surface decision (operator, 2026-08-10): EXTEND compose_world (zero tools/list cost —
  the manual rides the controllable view-vocab card; the payload ceiling stays untouched). The
  controllable base takes `match: { mode, space?, killTarget?, rivals?, teamNames?, allyCount?,
  foeCount?, side? }` + `mapRef` + an explicit `ref`; the mode authors seats/match/contract via
  the generic `MATCH_MODES` registry and stores the LIGHT form. Guards: requires mapRef + ref;
  refuses entities/game/camera/faces alongside. `KNOWN_RULES` grew `'ai'` (the engine's
  combatant-brain rule). Gate: mint ffa + watch over a toy map → promote via create_game →
  resolve plays on the map terrain.

Original proposal below. Groundwork had LANDED the same day (uncommitted, see
[docs/STATUS.md](../../../../docs/STATUS.md) branch state 2026-08-10): the arena's mode builders
are extracted into the pack-side registry
[mobile-suit/arena-modes.js](../mobile-suit/arena-modes.js) (`ARENA_MODES`,
`composeArenaLevel`, `lightenArenaLevel`), terrain inheritance is a tracked engine seam
([worlds/map-ref.js](map-ref.js) `applyMapRef`, resolved at the top of
[worlds/world-scene.js](world-scene.js) `resolveWorldScene`), and the 35-level matrix is
re-minted in light form (`sk_ms_arena_*` rows 80.6MB → 19.8MB; the 35 matrix rows total
1.59MB). This plan is what that cycle TAUGHT — the threads that generalize the arena's
bespoke machinery into base game-composition capability, ordered by pull.

Siblings: [mobile-suit/arena-compose.plan.md](../mobile-suit/arena-compose.plan.md) (the
"suits onto any map" seam this is the mode twin of),
[worlds/controllable-split.plan.md](controllable-split.plan.md) (the engine decomposition
that made the match layer generic), the archived
`lite-template/integration/archive-mobile-suit/plans/mobile-suit-arena.plan.md` (the
original mode/win-condition design record), and
[game/platformer.plan.md](../game/platformer.plan.md) (the same "showcase → pattern"
promotion, for a different genre).

## What the arena cycle proved

1. **A game mode is a pure transform over any world with pilotable entities.** The five
   builders (solo / practice / ffa / team / watch×3) read almost nothing suit-specific:
   they filter the map's own `pilotable` roster ("never count suits"), derive spawn
   geometry from the map's faces/bounds (or its curated `arena`/`arenaSpawns` hints),
   author AI seats with a target policy (`undefined` = hunt pilot, `'all'` = ffa,
   `'enemy'` = team-aware), attach the engine's already-generic `match` layer
   ([controllable/combat-match.js](controllable/combat-match.js)), and emit a `game:`
   contract. The suit-SPECIFIC part is a thin prelude (liveries, contrast stamp, the mk2
   aim patch, display names).
2. **Once variants are cheap, materializing the matrix is fine.** We considered a runtime
   `params.mode`; pre-minted mode-variant levels won. The cost was never the matrix — it
   was the terrain duplication. At ~46KB/variant, 7 modes × N maps is nearly free, each
   variant stays an auditable, contract-carrying level row, and the shell/menu/audit
   machinery needs zero changes.
3. **Manifest inheritance wants exactly one idiom**: spread-merge with level-wins-wholesale
   and `null` as a tombstone that DELETES an inherited key (how a level sheds the map's
   pinned `ai:'off'`/`pilot`). Anything cleverer (deep merges, per-key knowledge) is where
   equivalence proofs die.
4. **Refactors of mint chains are provable, cheaply**: dry-run content hashes per minted
   row (`mhash` in [mobile-suit/scripts/mint-arena-game.mjs](../mobile-suit/scripts/mint-arena-game.mjs)),
   a lighten→merge round-trip gate, and a resolved-payload byte-diff pre/post re-mint.
   The whole conversion shipped with byte-identical proof at every step.

## M1 — teach `mapRef` at the tool surface (cheap, immediate)

The engine seam is tracked and general, but nothing OFFERS it: an operator-built
multi-level game still photocopies its map into every level, because neither the
controllable mint path nor the game vocabulary knows `mapRef` exists.

- Accept + validate `mapRef` in the controllable world mint
  ([mcp/tools/scene-controllable.js](../../mcp/tools/scene-controllable.js)): ref must
  exist, kind `controllable`; teach the `null`-tombstone semantics in the same breath.
- Teach it in `get_game_vocab` / the level-contract orientation as THE way to mint level
  variants over one map ("one map row, N light levels"), with the arena as the worked
  example.
- Gate: mint a two-level toy game through the MCP path where both levels carry `mapRef`;
  resolve + audit both; confirm the stored rows carry no `faces`.

## M2 — export terrain hoisting (cheap, mechanical, same proven pattern)

[export-game.js](../../mcp/tools/export-game.js) already hoists the rigged-figure bank out
of every emitted page into content-hashed shared files (149MB → ~4MB/page). But each of a
map's 7 mode-variant pages still inlines that map's GEOMETRY. With levels sharing maps by
construction, the fix is the same string-level hoist applied to the world-geometry
literal: shared `assets/maps/<ref>-<hash8>.json` + a fetch shim, deduped across pages.

- Expected: the published arena export (~900MB) drops to roughly 5 maps + shells —
  likely under 200MB. The file:// trade-off is already paid (the figure bank made the
  folder HTTP-only).
- Gate: exported folder plays over a static server; byte-count report per folder; the
  README's size table regenerated.

## M3 — promote the suit-agnostic mode core into the engine

Move the generic 90% of [mobile-suit/arena-modes.js](../mobile-suit/arena-modes.js) into
tracked engine code — `worlds/controllable/match-modes.js` beside `combat-match.js`:

- **Moves**: `arenaGeometry` (bounds/ring/arc seating + `arena`/`arenaSpawns` hints),
  `seatRule` (ai-ambient derivation + target policy + boost/juke defaults), `matchLayer`,
  the spectator camera, and mode builders parameterized by a roster predicate — everything
  that reads only generic entity fields.
- **Stays pack-side**: the arena prelude (liveries, contrast stamp, `NAMES`, the mk2 aim
  patch) — passed in as an optional `prelude(manifest)` hook, exactly how
  `arena-compose.js` treatments already compose. `arena-modes.js` becomes a thin
  registry: engine builders + arena prelude + arena menu placement.
- **Invariants**: pack-absent test run stays green (the engine module imports nothing
  from `mobile-suit/`); deterministic, no dice; "never count suits" — builders derive
  from the roster, never enumerate; a re-run of the arena mint stays hash-identical
  (the M-cycle's `mhash` gate is the proof harness, already in place).
- Gate: `arena-modes.test.js` splits — generic cases move to a
  `worlds/controllable/match-modes.test.js` twin; arena dry-run hashes unchanged.

## M4 — expose "make it a match" at the MCP surface

The operator-facing capability M3 unlocks: **any walkable world with pilotable bodies →
a playable scored match**, without a bespoke mint script. A dreamed polygomer hero, a
vehicle world, a compose_world terrain with two rigged walkers — all become 1v1/FFA/team/
spectate compositions.

- Surface decision (operator call, see Open decisions): extend `compose_world` with a
  `match: { mode, killTarget?, teams? }` channel, vs. a dedicated tool that takes
  `{ mapRef, modes: [...] }` and mints the light-level set + contracts in one call.
- Ships with: a routing-card row + game-vocab teaching; presets derived from the roster
  (the arena's `presets.default` discipline); `spectate: true` contracts for watch modes.
- Deliberately OUT of scope: menu derivation sugar in `create_game` (the arena derives
  its menu in the mint script from the registry — fine to leave authored per game until
  a second consumer exists).
- Gate: the completability gate must hold — a minted match level passes the audit runner
  (practice/watch modes carry their non-career contracts as the arena's do).

## M5 — seat-by-reference (completes the chain)

Seats still `clone(suit.body)`/`clone(rule)` from the roster at mint, so terrain now
flows but a rebalance (hp/loadout tuning) still re-runs the game mint across 35 rows.
The completion: a seat names its roster entity (`from: '<entity id>'`) and inherits
`body`/`rule` at resolve, the entity twin of `mapRef`.

- Invasive: touches the entity normalization path every controllable world runs —
  needs the full equivalence harness (payload byte-diff on sample levels, char-net,
  golden traces) before any re-mint.
- Only worth doing AFTER M3/M4, when generated match levels exist that would otherwise
  bake stale snapshots.

## M6 — derivation chains as recipes (directional, parked)

The arena's map pipeline (`loadout world → nature arena → relit dusk → game`)
materializes every stage as a full row — the standing "a tuning change must flow the
WHOLE chain" footgun. `mapRef` broke the last link; the general form stores derivations
(`{ mapRef, relight: 'dusk' }`, `{ mapRef, roster: {...} }`) applied at resolve.
Maximally on-doctrine (recipes, not renders) but NOT free: relighting regrades every
face fill, so it's paid per resolve or needs a bake cache keyed on the chain hash.
Parked until resolve-time cost is measured on the city map (the heaviest). Do not start
here — it is the deep end of what M1–M5 approach incrementally.

## Process patterns to standardize (independent of the M-threads)

- **Dry-run content hashes** on every mint script (and plausibly a `create_game` dry-run
  mode): `sha256/12` per would-be row. Turns "did this refactor change anything?" into a
  diff. Cost: three lines.
- **The equivalence harness** for storage-format changes: (a) build-form round-trip
  (`merge(JSON(lighten(x))) ≡ x` over every cell), (b) resolved-payload byte-diff on
  samples pre/post re-mint, (c) live-route smoke. All three ran in the M-cycle; reuse
  the shape.
- **Null-tombstone merge** ([map-ref.js](map-ref.js)) as the one inheritance idiom — any
  future overlay layer reuses `applyMapRef`'s semantics rather than inventing a merge.

## Open decisions (operator)

1. **M4 surface**: extend `compose_world` vs. a dedicated match-mint tool. (Tool-count
   pressure says extend; the `{ mapRef, modes: [...] }` batch shape says dedicated.)
2. **M3 naming/home**: `worlds/controllable/match-modes.js` proposed — confirm it should
   sit inside the emission-composed `controllable/` dir or beside it (it is mint-time
   authoring, not emitted engine code; beside is likely cleaner).
3. Whether M2's map hoist should also apply to the non-game `/world?download=1` single-page
   export (probably not — a single page has no sharing to exploit).
