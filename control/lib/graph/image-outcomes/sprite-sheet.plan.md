# sprite-sheet — image-worker → pixelizer 2D sprite pipeline

**Status:** P0 + P1 landed (the request→paint→accept→bake loop works, tests green).
P2 (pixelizer game consuming baked sprites) + P3 machine gate deferred — see below.

Landed:
- `sprite-sheet` image-outcomes kind: `normalizeSpriteSheetManifest`, per-frame
  `renderTargets` (base first), `parseSpriteTarget`, `spriteGridLayout`, grid
  scaffold (`renderSpriteSheetSvg`, whole-grid + per-cell crop), instructions
  (`spriteSheetInstructions`), diffusion params (`sprite` preserve tier). Registered
  in `isImageOutcomesKind`, `SVG_RENDER_KINDS`, `ILLUSTRATION_KINDS`.
- `create_sprite_sheet` + `bake_sprite_sheet` MCP tools ([tools/sprite-sheet.js](../../mcp/tools/sprite-sheet.js)),
  registered in server.js. Mint decision: a DEDICATED tool (not create_sketch reuse)
  — more ergonomic/discoverable, consistent with `create_pixelizer_game`.
- Bake writes the sovereign payload IN-PLACE onto the sketch manifest as `baked`
  (`{ register, grid, budget, base, palette, sprites, provenance, changedRatios }`),
  preserved across re-normalization. Gates on accepted-only frames (eyes gate).
- Tests: [sprite-sheet-manifest.test.js](sprite-sheet-manifest.test.js) (pure pipeline)
  + [tools/sprite-sheet.test.js](../../mcp/tools/sprite-sheet.test.js) (cold-driven
  request→pull→submit→accept→bake with real PNGs). Routing card updated ([pixel-art.md](../../mcp/routing-cards/pixel-art.md)).

The render-handoff loop needed NO changes — it is kind-agnostic; sprite-sheet uses
the lighter still/comic accept path (not the keyframe/scene two-eyes contract).

The bridge between two subsystems that already exist and are already mature:

1. The kind-generic **image-worker handoff loop** (`request → pull → submit → accept/reject`
   in [render-handoff.js](../../mcp/tools/render-handoff.js), dispatching on `manifest.kind`,
   durable rows in `image_render_requests`, append-only PNG store at `data/outcomes/<ref>/`,
   two-gate doctrine: machine gate at submit, eyes gate at accept).
2. The tested-but-unconsumed **PNG → pixelizer-cell intake**
   ([quantize.js](../pixelizer/quantize.js): `quantizeRgba` / `diffRasters` / `jointPalette`;
   [pixel-actor.js](../pixelizer/pixel-actor.js): `bakeActor`). Zero MCP callers today.

A sprite sheet is NOT new machinery. It is a new render **kind** on loop (1) whose accepted
PNGs are baked by (2) into a sovereign pixelizer sprite payload. No new request/pull/submit
surface — those tools are kind-agnostic and get reused for free.

## Decisions (locked)

- **Render targets: per-frame.** Each frame is its own target (`frame-<action>-<dir>-<n>`),
  mirroring keyframe-animation cels. Gives per-frame accept/reject, parallel workers, and —
  crucially — lets `bakeActor` diff-extract sub-cels: ONE base render + tiny per-state edit
  renders buys an actor; every animation frame after that costs zero renders (timing charts
  over extracted cels via the pixelizer track grammar). Cross-frame identity is held by the
  same meru-lock / face-hold audit already built for keyframes.
- **Target register: pixelizer 2D.** Baked cells drop straight into the pixelizer
  `{size,palette,cells}` grammar ([cutscene.js](../pixelizer/cutscene.js) `validateRaster`,
  register budgets `8bit:3 / 16bit:15 / 32bit:61`). 3D billboards are explicitly out of scope
  for v1.

## Doctrine fit

- Grid + frame metadata live in the **sovereign manifest** (recipe, re-derivable forever).
- Each painted cell PNG is a **bound derived render** with its own `worker_audit`/`accept_audit`/
  `source`, stored append-only under `data/outcomes/<ref>/`.
- Baked cells stay **re-derivable from the archived source** (quantize is a pure function of
  bytes+params) — machine-baked but sovereign, carried with dream-audit provenance.
- A baked sprite sheet binds to a game project under the existing `graphic` role
  ([game-projects.js:263](../../mcp/tools/game-projects.js)) — no schema change to group them.

## Phases

### P0 — the `sprite-sheet` render kind (rides the existing handoff loop)
- [manifest.js](manifest.js): `KIND_SPRITE_SHEET='sprite-sheet'` + `/v1` contract; add to
  `isImageOutcomesKind`; `normalizeSpriteSheetManifest` capturing
  `{ cols, rows, cellW, cellH, gutter, register, frames:[{ id, action, direction, base? }] }`;
  wire into `normalizeImageOutcomesManifest`; **`renderTargets` → one `frame-<id>` per frame**
  (+ a `parseSpriteTarget` helper like `parseKeyframeTarget`). Flag one frame `base:true`; the
  rest are edit-of-base variants (the bakeActor economy).
- [scaffold.js](scaffold.js): `renderSpriteSheetSvg` branch — one cell's registration box +
  action/direction label + rig placeholder; `control:true` variant strips labels so the
  conditioner sees only cell geometry.
- [instructions.js](instructions.js) + [local-render-params.js](local-render-params.js):
  sprite branch — transparent bg, tight cell registration, per-frame action/pose/direction
  brief, `size` from `cellW×cellH`. Reuse the keyframe preserve-tier language for variants.
- [sketches.js:844](../../mcp/tools/sketches.js) `getImageRenderPacketHandler`: scaffold-URL
  switch gains a sprite branch returning per-frame `pngUrl`/`controlPngUrl` (add `&frame=<id>`
  to the `/api/sketches/[ref]/png` route, like the existing `&panel=` / `&key=`).
- **A mint entry** for the kind: either extend `create_sketch` normalization or a thin
  `create_sprite_sheet` tool that writes the `kind:'sprite-sheet'` sketch. (create_sketch reuse
  preferred if the kind normalizes cleanly.)

### P1 — the bake tool (the one genuinely new MCP surface — fills the bakeActor gap)
- New `control/lib/mcp/tools/sprite-sheet.js` → `bake_sprite_sheet({ ref })`.
- Precondition: all frame targets `accepted` (reuse the loop's status check).
- Decode accepted frame PNGs (sharp, injected like `bakeActor`'s `decode`), then:
  - `jointPalette` over base + all variants → one register-budget palette pinned everywhere.
  - `quantizeRgba` the base → base raster; `diffRasters` each variant vs base → sub-cel groups
    with placement offsets (this is literally `bakeActor`'s output shape).
- Write the baked **sovereign sprite payload** onto the recipe:
  `{ sprites:{<id>:{size,palette,cells}}, groups:{...}, provenance, changedRatios }`.
  Provenance links back to each source render's `irq_` row + on-disk slot.
- Refuse loudly past the drift ceiling (bakeActor `DRIFT_CEILING=0.5`) — a smeared variant is
  a re-render, not a bake.

### P2 — pixelizer game consumes the payload
- [pixelizer-games.js:43](../pixelizer/pixelizer-games.js) `buildPixelizerGameManifest`: today the
  manifest carries NO asset payload (sprites hardcoded in each reducer's `*-skin.js`). Add a
  data-driven `sprites` field so a pixelizer game reads the baked payload.
- Thread a `sprites`/`sprite_sheet_ref` param through
  [pixelizer-game.js](../../mcp/tools/pixelizer-game.js) `createPixelizerGameHandler` + inputSchema.
- Reducer `emit` shells read the payload instead of embedding rasters. Pick one reducer
  (or a new data-driven "actor sandbox" reducer) as the first consumer.
- [export-game.js:155](../../mcp/tools/export-game.js) pixelizer branch: if sprites become a
  separate asset file, bake them into the single-file export.

### P3 — discoverability + gates
- **Machine gate (optional, submit-time):** `spriteFrameAuditPng` in
  [render-handoff.js](../../mcp/tools/render-handoff.js) mirroring the keyframe/scene blocks —
  exact `cellW×cellH`, transparent gutter, crown-to-ground registration consistency across
  frames. Grid/frame index rides `worker_audit`. Decide whether sprite frames need the enforced
  two-eyes contract (externally generated → yes: require `invoked_generator` + differing
  `source`).
- **Vocab:** add a sprite/asset card family to `get_game_vocab`
  ([create-game.js:132](../../mcp/tools/create-game.js)) via a generated loader like
  [kit-cards/loader.js](../game/kit-cards/loader.js), and a routing card update to
  [pixel-art.md](../../mcp/routing-cards/pixel-art.md).

## Files touched (summary)
- **New:** `control/lib/mcp/tools/sprite-sheet.js` (the bake tool).
- **Primary edits:** `manifest.js`, `scaffold.js`, `instructions.js`, `local-render-params.js`
  (the new kind); `pixelizer-games.js`, `pixelizer-game.js` (consumption).
- **Reused unchanged:** `render-handoff.js` loop (except optional P3 gate),
  `render-requests.js`, `render-store.js`, `quantize.js`, `pixel-actor.js`.

## Open questions
- Mint via `create_sketch` reuse vs. a dedicated `create_sprite_sheet` tool (P0).
- Frame id grammar: `<action>-<dir>-<n>` vs a flat index. Directions from the pixelizer
  facing grammar (E/W reflect) — a west variant may be a free flip, not a painted frame.
- Whether the bake writes back into the same sketch's manifest (in-place) or mints a linked
  pixelizer-sprite sketch that the game references by ref.
