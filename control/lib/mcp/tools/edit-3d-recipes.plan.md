# Edit-in-place for 3D recipes — closing the mint-once gaps

## Why

Mojulo's thesis is that a minted recipe is a STARTER — the agent iterates it in
place, same ref, and every derived surface (render, bound mesh, Godot pack)
re-derives from the edited recipe. For 3D that promise is mostly true in code
but broken in three places:

1. **Games are mint-once.** The game manifest (kind `'game'`, a `sketches` row)
   is unreachable by any edit tool: `update_game_project` touches project
   metadata only (title/charter/status), and `update_sketch` routes kind
   `'game'` to the diagram fallback, which hard-fails on `viewBox is required`.
   Since games are the Godot shipping vehicle, tweaking a level list, music
   bed, or difficulty means re-minting a new ref and re-binding project
   membership. Repo-dev already routes around this by calling
   `SketchRepository.update` directly (`lib/graph/mobile-suit/scripts/mint-arena-game.mjs:106,433`)
   — the need is proven, the MCP surface just doesn't offer it.

2. **Solids and edifices are editable but advertised as re-mint-only.** Every
   `mint_solid` kind (figure, manji-tree, workbench, carved-solid,
   css3d-turntable, vehicle-instance) plus `edifice` sits in `WORLD_KINDS`, so
   the world branch of `update_sketch` (`sketch-mint.js:465-479`) already
   validates and stores an in-place edit through `resolveWorldScene`. But no
   doc, vocab card, or test says so, and `create_figure`'s description
   explicitly teaches the OPPOSITE ("adjust the dials and re-mint",
   `figure.js:221`). Our primary user reads tool descriptions; an edit path the
   descriptions deny effectively doesn't exist, and agents churn
   near-duplicate refs exactly the way worlds did before the world branch was
   added (the 0813 persona-sims motivation comment).

3. **Motion recipes live outside the sketches table.** `forge_motion` writes
   `recipe.json` into the outcome dir and a copy as a stash `script` item
   (`motion.js:487-556`) — nothing re-renders from either. The recipe comment
   says it right ("a traversal's ticks ARE its recipe — with them stored, the
   run re-renders exactly") but no tool performs that re-render.

Non-goals: voice (deliberate re-mint doctrine, not 3D), covers/cooks (not 3D),
the assembler's monomer freeze (deliberate snapshot semantics,
`assembler.js:162`), and provenance immutability (bound renders stay
append-only; a recipe edit invalidating accepted renders via manifest hash is
correct and unchanged).

## Phase 1 — game branch in `update_sketch`

Add a kind `'game'` branch to `updateSketchHandler` ahead of the diagram
fallback, paying the same gate as `create_game`:

- `validateGameManifest(manifest)` → throw with the validator's errors.
- Resolve every `levels[].world` / `store` ref the way `create_game` does, so
  an update can't store a game whose worlds are gone.
- Store `normalizeGameManifest(finalized)` — same normalized shape as mint.
- Leave `update_game_project` untouched; project metadata and game recipe stay
  separate concerns.

Mirror of the beats/voice guard-rail style: if someone passes a game manifest
whose `store`/`levels` fail resolution, the error names the missing refs, not
"viewBox is required".

Test: `update-sketch.game.test.js` sibling to `update-sketch.world.test.js` —
mint a two-level game, edit difficulty + drop a level in place, assert same
ref re-exports (godot pack assembly reads the edited rows); assert a broken
world ref is refused with a game-level error.

## Phase 2 — say the quiet part: solids + edifice edit path

No new code path; documentation + tests over the existing one.

- Reword `create_figure` (`figure.js:221`), `mint_solid`, `create_edifice`
  descriptions: the iterate verb is `update_sketch { ref, manifest }` (full
  replace, validated by the render contract); re-mint is for VARIANTS you want
  side by side.
- Add the edit path to the solid/edifice entries in the context drawers
  (`context.js` worked examples / `get_solid_vocab`).
- Tests: `update-sketch.solid.test.js` — edit a figure pose dial in place,
  assert same ref re-renders; edit an edifice mass, assert livability advisory
  re-runs; assert a limb value beyond joint LIMITS is refused with a
  world-level error (proves the clamp contract holds on the update path too).

## Phase 3 — motion round-trip (decision)

Options, in order of surgery:

- **A (recommended): re-forge from recipe.** `forge_motion` accepts
  `recipe: {...}` (or `recipe_ref` pointing at an existing motion ref) — the
  stored `recipe.json` shape becomes a legal INPUT. Edit loop: read
  `recipe.json`, tweak ticks/params, re-forge (same or new ref). Keeps the
  outcome-dir storage, honors "ticks ARE the recipe", smallest diff.
- **B: move motion recipes into `sketches`** (kind `motion-shot`), edit via a
  `update_sketch` branch, derive the outcome dir from the row. Aligns storage
  with every other family but is real surgery (ref semantics, outcome-dir
  lifecycle, stash bindings) for the same round-trip A buys.
- **C: document mint-once.** Cheapest, but it's the only 3D family left
  breaking the starter thesis.

Take A unless the chatbot-carveout-era appetite says otherwise; B can layer on
later without wasting A (A's recipe-as-input contract is exactly what B's
branch would validate).

## Build log

- **2026-08-29 — Phases 1–3 landed in one pass.**
  - Phase 1: `updateSketchHandler` gained the `kind:'game'` branch
    (validate → resolveGame → per-level contract dry-run via `auditLevel`
    with `allowUnaudited`; completability stays mint-time — levels newly
    added by an edit are named in the result `note` as unaudited rather
    than silently passing the gate). `update-sketch.game.test.js` pins
    in-place edit, the unaudited note, ghost-ref refusal, and the dry-run
    holding when the store shrinks under existing contracts.
  - Phase 2: `update_sketch` / `mint_solid` / `edit_solid` /
    `create_edifice` / `create_figure` descriptions + the studio drawers
    now teach iterate-in-place; the manji-tree mint's `next` hint stopped
    saying "re-mint to adjust". `update-sketch.solid.test.js` pins figure
    dial + edifice mass edits, the clamp contract (an out-of-range dial is
    accepted — limits clamp at render), and world-level refusal.
  - Phase 3: option A as recommended — `forge_motion` accepts `recipe`
    (edited recipe.json) or `recipe_ref` (existing mo\_ ref) in place of
    subject+shot; title defaults from the recipe. Ticks win over waypoints
    when both are present (exact replay; strip `shot.ticks` to recompile
    edited waypoints). `motion-reforge.test.js` pins deterministic
    re-render, the edited-recipe loop, and both refusals.
  - Ratchet: all description growth compressed to routing grade
    (teach-in-the-drawer); `forge_motion` allowlist re-pinned 1409 → 1560
    and the payload ceiling 255,000 → 256,000 to bless the ~660-byte
    residue, both with dated comments in `tool-descriptions.test.js`.

## Deferred / noted

- HTTP `PATCH /api/sketches/[ref]` runs only the diagram validator — world and
  solid edits via the dashboard route are rejected while the MCP path accepts
  them. Dashboard is not the driving surface, so defer; if touched, lift the
  kind-dispatch out of `updateSketchHandler` into a shared helper both call.
- `SketchRepository.update` is whole-blob, no history. Beats grew
  `beats_revisions` when edits became routine; if solid/game editing takes off,
  a generic `sketch_revisions` table is the same shape. Not now — watch
  telemetry after Phases 1–2.
