# material response — a per-surface material channel for the baked lighting solve

Status: Phases 1–5 LANDED 2026-07-07 (shelf promotion + vexar extension + first
consumers; face `spec` channel + live World specular; .glb pbrMetallicRoughness
mapping; operator-facing manifest surface; prior-surface-library plug-in). Deviations
recorded at the bottom.

Provenance: the TRELLIS/TRELLIS.2 study (2026-07-06) — their O-Voxel result showed
per-surface material response (rough vs. metallic vs. translucent) is what separates
"geometry with color" from "an object made of something". Their mechanism (a 4B-param
generative model) is unusable here; the *observation* lowers cleanly into the baked
pipeline. Nothing neural, nothing runtime: material is a different **response curve**
per surface under the same baked light.

## The insight this plan promotes, not invents

[effects/carved-solid.js](effects/carved-solid.js) already proved the model: a closed
`MATERIALS` shelf (`{ base, ambient, diffuse, specular?, shininess?, emissive?, cel?,
opacity? }` — gold / steel / chrome / stone / wood / rubber / glass / neon / cel …)
and a shade that is vexar Lambert with material-owned ambient/diffuse plus an optional
Blinn-Phong half-vector highlight against its FIXED hero camera. That table is trapped
in one renderer. This plan graduates it to a polygonizer primitive — the same
accretion move as vexar itself (spike → named primitive → default).

## Doctrine (all phases)

- **Opt-in, identity by default.** No `material` argument → byte-identical output
  everywhere. The invariant every landed channel (`vao`, `audio`, `fog`) holds.
- **Closed vocabulary.** Materials are named rows of pure params in ONE shelf —
  content-extensible by adding a row, never by forking a shade function.
- **Lighting stays baked** (renderer-ladder invariant). Material response is computed
  at geometry-solve time into the face `fill`, so every backend inherits it from one
  edit, like AO.
- **Specular is honest about cameras.** The face payload is camera-independent by
  design; a baked highlight would pin one camera into every view. So:
  - *camera-independent* terms (ambient/diffuse reshaping, cel quantization,
    emissive) may enter the shared face payload;
  - *view-dependent* specular is allowed only where a camera is fixed at bake time
    (carved-solid's hero shot; any single-camera SVG study). The live-World specular
    term is Phase 2 and needs its own doctrine call.

## Phase 1 — promote the shelf, extend vexar, first consumers (this pass)

1. **`polygonizer/materials.js`** — the shelf. `MATERIALS` + `MATERIAL_NAMES` +
   `resolveMaterial` move here verbatim from carved-solid (which re-exports them, so
   [effects/carved-motion.js](effects/carved-motion.js) and every other importer is
   untouched). Data only; imports nothing.
2. **vexar gains material-aware shading** ([polygonizer/vexar.js](polygonizer/vexar.js)):
   `shadeHexMat(hex, normal, material, { light, viewFrom, at })` and
   `shadeFaceMat(corners, hex, material, { light, inside, viewFrom })`.
   `material` null/absent → exact `shadeHex` path (identity, unit-tested byte-equal).
   With a material: Lambert with `mat.ambient`/`mat.diffuse` (falling back to the
   light's), `cel` quantization, `emissive` blend; the Blinn-Phong `specular` term is
   added ONLY when the caller passes `viewFrom` + `at` (i.e. declares a fixed camera).
   Same math as carved-solid's `matRgb`, pinned by a parity test.
3. **First consumers** (where material visibly earns its keep):
   - [polygonizer/lathe-faces.js](polygonizer/lathe-faces.js) and
     [polygonizer/extrude-faces.js](polygonizer/extrude-faces.js) accept
     `opts.material` — workbench polygomers and assemblies can be wood / steel /
     stone instead of uniformly matte. Camera-independent terms only (these feed the
     shared face payload).
   - carved-solid keeps its own shade (it layers inner-glow emission in rgb space)
     but now reads the shelf from the primitive.
4. **Evidence**: `polygonizer/material-response.spike.gen.test.js` → a labeled
   material-matrix study (one form × shelf rows, fixed camera so the spec term shows)
   into `lite-template/integration/0707/spike-output/material-response/`, eyeballed
   via /view-svg. Plus unit tests: identity, cel, spec gating, resolveMaterial forms.

Non-goals for Phase 1: no manifest channel, no MCP surface, no TOOL_INDEX change, no
emitter edits, no char-net re-pin. Faces do not yet carry a `mat` key.

## Phase 2 (LANDED) — the face channel + live World specular

Faces gain `spec: [strength, power]` (`tagFacesWithMaterial` in the shelf, applied by
lathe/extrude when `opts.material` is passed); `faceListToMesh` packs a per-vertex
2-component attribute (null when no face asks); `emitThreeWorld` splices
`specularChannelScript` — a Blinn-Phong term `spec · pow(max(0, N·H), power)` patched
into the group's MeshBasicMaterial via onBeforeCompile, against the FIXED baked light
direction and the LIVE camera. Flat normals come from `dFdx × dFdy` of the world
position, so the triangle-soup geometry needs no normal attribute. Doctrine call on
"no per-frame shading": resolved as the AO posture — baked *solve* (light fixed at
recipe time), live *reconstruction* (the camera term the page already owns).

Evidence: `scene/material-specular.spike.gen.test.js` → two-camera PNGs of the same
goblet trio (plain / chrome / gold) in
`lite-template/integration/0707/spike-output/material-specular/` — the highlight sits
on a different part of the form per camera; the plain goblet is unchanged. Contract
tests in `scene/material-channels.test.js`.

## Phase 3 (LANDED) — .glb PBR mapping

Faces tagged `pbr: [metallicFactor, roughnessFactor]` (`materialPbr`: metalness is
the shelf family flag; roughness inverts specular strength, floored at 0.08) split
into their own glTF node per distinct factor pair with a REAL `pbrMetallicRoughness`
material — no `KHR_materials_unlit`, so importers light it. Plain faces keep the
unlit path byte-identically. A face carrying both `texture` and `pbr` stays on the
texture path (the label wrap outranks its material).

## Phase 4 (LANDED) — the operator-facing manifest surface

Every workbench monomer spec (lathe / extrude / sweep / relief — sweep-faces and
relief-faces gained the same `opts.material` as lathe/extrude) accepts `material`,
threaded by `lowerObjectFaces`; `assembly` parts pass it through the existing
`...rest` lowering, and the assembler inherits it for free (it re-lowers frozen
workbench monomers). No new tool, no TOOL_INDEX change — `material` is a schema
property on `create_workbench` plus a MATERIALS paragraph in its description.
Ergonomics decisions:
- **`material` without `tint` uses the shelf row's own `base` albedo** — `'gold'`
  LOOKS gold out of the box; an explicit tint still wins (tint = albedo, material =
  response).
- **Typos fail loudly at mint**: `validateMaterialRef` runs in `planWorkbench`, so
  `material:'golden'` is a listed-names error instead of resolveMaterial's silent
  steel fallback (which remains the render-path posture for stored manifests).
- **The World's specular direction now follows the payload's own light** when the
  assembled scene carries a vexar makeLight (the workbench studio does) — highlight
  and diffuse agree; DEFAULT_LIGHT stays the fallback.

Evidence: `worlds/workbench-material.spike.gen.test.js` → the same candlestick
manifest minted plain vs `material:'gold'` (+ a chrome swept handle), captured live
from the unlit and lit sides in
`lite-template/integration/0707/spike-output/workbench-material/`. Contract tests in
`worlds/workbench-material.test.js`.

## Phase 5 (LANDED) — plugging in the prior surface libraries

The pattern layer and the response layer are orthogonal — texture answers "what is
ON the surface" (albedo), material answers "how does it MEET light" — and this phase
made them compose:

- **Texture × material on one face.** `faceListToMesh` now packs `specs` per texture
  group (kept only for groups a spec face touches); the specular channel patches the
  textured sub-meshes too, re-finding each by its exact position buffer (the static
  loop gives them no name handle — both sides decode the same base64, so float
  equality is exact); `facesToGlb` exports a textured `pbr` face as a REAL lit
  pbrMetallicRoughness material carrying the tile as `baseColorTexture` (no unlit
  extension). The subway's `marble-carrara` floors can now carry a satin sheen.
- **Vehicle paint (sticker livery × material).** `buildSweptSceneShapes` takes a
  `material`: the sticker card keeps supplying the albedo, the material the response.
  The Blinn-Phong term bakes ONLY on the culled fixed-camera painter path (the
  carved-solid tier); the `cull:false` shell takes camera-independent terms and
  `sweptFaces({ material })` tags body + fascia faces (`spec`/`pbr` — wheels and
  accessories stay untagged) for the World's live channel and the .glb export.

Evidence: `scene/material-texture.spike.gen.test.js` → satin-marble floor + glossy
sedan beside their plain controls, two cameras, in
`lite-template/integration/0707/spike-output/material-texture/`. Contract tests in
`scene/material-channels.test.js` (texture-group spec packing, textured-material
emission, lit textured .glb material, vehicle paint tagging).

## Deviations / recorded limits

- `matte` the preset ≠ identity: it carries its own ambient/diffuse (0.44/0.60) vs
  `DEFAULT_LIGHT` (0.46/0.6). Identity is the ABSENT material, not the matte row.
- Gradient-painted faces (facades, clouds) are out of scope — material applies where
  vexar shades solids.
- `opacity` (glass) is honored today only by renderers that already composite alpha
  (carved-solid); the face payload's translucency path (`water`) is not unified here.
- **The specular block is a one-shot setup splice (glow/shadow/pick posture), NOT a
  `RUNTIME_CHANNELS` row.** A registry row emits its comment header into every page
  (an all-fixture re-pin, which would have entangled this thread with the branch's
  pending bus/game/audio re-pins); the one-shot class exists for setup-only blocks
  and keeps material-free worlds byte-for-byte unchanged. If specular ever needs a
  per-frame step, graduate it to a registry row and take the re-pin then.
- The World's specular light direction is pinned to `DEFAULT_LIGHT.toLight` at emit;
  a generator shading under a custom vexar light gets a highlight consistent with the
  default sun, not its own. Thread the light through the payload when a consumer
  actually needs it.
- Per-vertex spec is not packed for instanced `repeats` templates or the SVG/CSS-3D
  lowerings (same deferral as `vao`). ~~Textured faces~~ — lifted in Phase 5.
- Vehicle paint reaches `sweptFaces` (the world-asset path) and the painter builders;
  the fuselage net (planes/trains) and the vehicle MCP manifests don't thread
  `material` yet — same one-line pattern when a consumer asks.
- No texture→material default pairing table yet ('marble-carrara' → satin, wood
  panels → wood): authors say both words today.
- .glb PBR nodes keep baked Lambert in COLOR_0, so a lit importer shades over the
  baked shading. Accepted: albedo-with-baked-light is how every mojulo export reads,
  and stripping it would desaturate the form.
