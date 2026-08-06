# Ground-texture vocabulary (terrain soils + concrete structures)

A seamless, tileable material vocabulary for **landscape terrain** and **built structures**, so a
map reads as a *place* (dirt vs sand vs gravel vs grass vs snow), not one flat tint — even when the
distinction carries no game function. Landed on branch `visualization-layer`; first consumer is the
mobile-suit **nature arena** ground map.

## The seam (how a texture reaches a live World)

A face opts in with `texture: '<key>'` + per-corner `uv` (+ `textureLit: true`). The rest is generic:

1. **Tile** — `surface-textures.js` resolves `<key>` → a seamless `data:image/png` (memoized). Soils
   ride the luminance-led `rockPng` (colour + grain from `base`/DNA); concrete/wildflower/snow are
   their own generators; grasses are the existing `grassPng`.
2. **Collect** — `resolveWorldScene` (world-scene.js) runs a generic **face-texture channel**: scans
   `payload.faces` for `texture` opt-ins → `collectFaceTextures` builds `{ key: dataURL }`, merged over
   any assembler `payload.textures` (workbench wraps) and explicit `manifest.textures` (custom dataURL /
   an image-worker `outcomeRef` PNG). Additive — a face list with no opt-ins leaves the payload untouched.
3. **Bind** — `emitThreeWorld` loads each as a real three.js texture (RepeatWrapping + anisotropy already
   set); `.glb` export mirrors it as `baseColorTexture`.

**Colour model:** the tile carries the material's colour; the face `fill` is a near-white lambert shade
(`shadeHex('#e8e6e2', normal, LIGHT)`), so `texel × fill` = the true colour, lit, with no double-darkening.
The dusk relight (`mint-relit-variant.mjs`) rewrites only `fill`, so textures inherit dusk lighting for free.

## The vocabulary (`surface-textures.js`)

- **`SOIL`** (via `rockPng`): `soil-dirt`, `soil-sand`, `dune-sand`, `soil-mud`, `soil-gravel`, `riverbed`,
  `soil-scree`, `soil-clay`, `red-rock`. All `'repeat'`.
- **`concrete-board`** (`concretePng`): board-form concrete — cement mottle + horizontal form-board seams +
  form-tie dimples + one vertical panel joint. Luminance-led cool grey; `'repeat'`.
- **`wildflower`** (`wildflowerPng`), **`snow`** (`snowPng`): full-colour surfaces; `'repeat'`.
- **grasses** already existed: `grass-lawn`, `grass-meadow`, `grass-dry`.

Look-dev evidence: `lib/graph/worlds/arena-texture.spike.gen.test.js` (16-tile swatch board + a
reconstruction of the arena zoned by soil). Production verification: `arena-real-render.spike.gen.test.js`
(renders the *stored* dusk world through `resolveWorldScene` and asserts the keys bind).
Output PNGs: `lite-template/integration/0726/spike-output/arena-texture/`.

## The ground map (`scripts/mint-nature-arena.mjs`)

- **Terrain** drape faces are zoned by `materialAt(x,y,zc,slope)` — height + slope gate the biome; two
  low-freq noise fields (`nA`/`nB`) make soils meet in **wandering organic patches**, not contour bands.
- **Structures** (canyon walls, mesa, boulders, arch, spire, cover) are skinned in `concrete-board` by
  `boxFaces`; `rockBox` no longer authors rock strata (the form-board seams read as banding).
- Pipeline to make it live in the game (all idempotent, update-in-place):
  `mint-nature-arena.mjs → mint-relit-variant.mjs sk_ms_nature_arena → mint-arena-game.mjs`.

## To extend

- **Add a soil:** one line in `SOIL` (`base` + rock DNA knobs), then reference the key from a terrain face.
- **Add a biome to the arena:** one branch in `materialAt`. Retune the arena look by editing that function only.
- **Swap in a Qwen PNG:** mint via the image worker, then either set `manifest.textures[key] = <bound dataURL>`
  or resolve an `outcomeRef` — the channel already merges explicit textures over the procedural ones.

## Space objects (asteroid field map)

Same seam, extended to the space arena (`sk_ms_space_asteroid_field` → `_noir` → game).

- **Library:** `ASTEROID` (`asteroid`, `asteroid-iron`, `asteroid-ice` via `rockPng` — dark, deep-crack
  cratering), `HULL` (`hull-plate`, `hull-plate-dark` via new `hullPlatePng` — panel grid + recessed
  seams + corner rivets + brushed mottle), `solar-panel` (via `tilePng` — dark-blue PV cell grid).
- **Assembler** (`space-arena.js`): new `texturizeFaces(faces, key, {T, light})` projects per-face uv
  from the dominant axis and drops `fill` to a light `SPACE_LIGHT` shade (survives the space-noir
  relight). Opt-in params: `rockFaces({ texture })` skins a hero rock; `stationFaces({ textures:{hull,
  solar} })` skins the structure in plating and the wings in PV cells (wings are held aside so they
  don't get the hull key). Absent params ⇒ the original vexar look (existing callers unchanged).
- **Mint** (`mint-space-asteroid-field.mjs`): the station passes `textures`, and each of the 8 landmark
  hero-rocks gets a varied asteroid tone.
- **Known limit — instanced field rocks are NOT textured.** The 34 scattered rocks ride the `repeats`
  channel, whose `InstancedMesh` uses a plain vertex-color material (no `map`) in scene-three.js. Only
  the baked static faces (station + landmark rocks) can be textured today. Making instanced rocks
  textured needs a textured-InstancedMesh path (uv attribute + `map` on the instance material) — a real
  renderer follow-up. For now the hero rocks are detailed; distant field rocks stay tinted/smooth.

## Follow-ups (not done)

- **Soft biome edges.** Patches are per-cell (20u), so soils meet with a faint stair-step. Single-texture-
  per-face can't cross-fade; options: finer cells, a dither band at boundaries, or a two-face alpha overlap.
- **Concrete perimeter is an aesthetic choice.** All AABB cover (incl. the outer canyon rims) is now concrete
  → a walled arena rather than a natural canyon. Trivially reverted per-structure by choosing a `soil-*`/rock
  key instead of `concrete-board`.
- **`.glb` export** of the arena inherits the same textures via `scene-gltf.js` but is unverified here.
- **SVG/scene stills** can't show textures, so still renders of this world read pale (the near-white fill).
  The `/world` PNG bake (headless chromium) is the correct still. Fine for a walkable artifact.
