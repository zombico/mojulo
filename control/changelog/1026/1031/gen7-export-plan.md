### Form export plan (temporary: the working plan, parked here; delete before release)

**Status:** planned (1031). Branch `1031-gen7-export`, cut from `1026-consolidated` at af0046fe+. Theme file
`control/changelog/1026/1031/gen7-export.md`.

**Outcome.** For graphics, the form export supersedes every prior Godot export: a level reaches Godot as what its
surfaces ARE (materials, relief, the land's layers, the plants grown as form) and how the level is LIT (its sun at its
hour, its sky, fog and occlusion), and Godot lights it. The paint export (light baked into vertex colour, drawn unlit)
retires as Godot's graphics path. The binding is one engine-neutral contract that Blender, Unity and Unreal's asset leg
read through their own adapters, so the second engine costs an adapter, not a port.

#### The thesis, corrected

"In gen 7 everything is polygons" is half right. What makes gen 7 the bridge is that **nothing in it is light**:
`era/eras.js` names gen-6's surface `paint` (the light held in the colour) and gen-7's `form` (material and geometry,
lit by the renderer). That is the engines' own model. Gen-6 ports trivially but wrongly (an engine either draws it
unlit or lights it twice); gen-7 is what an engine expects.

What is not yet true: most of gen-7's LOOK is drawn in the World page's own GLSL and page script (layered-ground
blending, parallax occlusion on rooms, bark and litter, screen-space creases and occlusion, patched shadows, grass and
flora wind), and the engine path excludes the form render on purpose (`resolveLevel` reads `paint: true`;
`export_game` refuses an era for engine packs, "until the form render gives them materials").

What makes it cheap: **the form render's content is already engine-neutral data.** `form/land-read.js` is pure and
seeded and its `formPayload` is "plain data, JSON-safe": the land's vertices, the solved light, the layers' weights and
their base / normal / ORM atlases, the path mask, the sea's depth, the scree's stones, the rock's relief, the grass map.
`form/flora-read.js` returns the plants' templates and instances; `form/bark-material.js` and `form/relief-material.js`
return glTF's metal-rough set. `form/land-layers.js` calls itself "the engine's terrain primitive: Unreal's landscape
layers, Godot's splat … a renderer, or an engine pack, owns the materials". The page's `channels/form-*.js` is the web's
ADAPTER of `payload.form`. This plan writes the others.

#### What exists (reuse, don't design)

- **The shared seam.** `engines/pack.js` `resolveLevel` → `facesToGlb` → each engine's score. Godot, Unity, Unreal and
  Roblox read that GLB; Blender resolves its own and writes through `facesToGlb` too; USD writes beside it from the
  payload. One change to the payload and the GLB reaches every leg.
- **The lit path.** `resolveLevel({ lit: true })`: the unshaded payload and real PBR (`scene-gltf.js` `pbrMaterial`,
  `surfaceMaterial`). The CLI has it (`export-godot.mjs --lit`); the MCP path never sets it.
- **glTF textures, for figures.** `pbrMaterial({ baseColorTexture, normalTexture, ormTexture, extras })`, `coverMaterial`
  (the beast-kin's cover: base, normal, ORM, and the height in `extras.mojulo`). "What glTF has no slot for, an engine's
  importer to bind" rides `extras.mojulo`; Godot binds a figure's parallax depth with `figure_parallax.gdshader`
  (`level.gd`). That is the extension mechanism, already used.
- **Form data.** `payload.form.land` (`formPayload(landRead(…))`), `payload.form.flora` (`floraRead`), dunes and snow
  under it; `form/room-form.js` + `form/room-light.js` (a room's tiles as material, its light solved and baked, `aLit`);
  `era/solid.js` (roof slabs, cut doorways: already geometry, already in the GLB); `ctx.form` (the island's boulders
  and rims: already geometry).
- **Godot's side.** `level.gd` `_fix_materials` (vertex colour as albedo, every material), `sky.gdshader`, `tone.gdshader`,
  `water.gdshader`, a fallback sun; `godot-marks.js` (form absent, shadows absent, fog absent but weather, creases and
  occlusion absent, liveGrass, splats, snowPrints, sway absent, sky and terrain approximated): the work list, written.
- **Gates.** `export-godot.mjs`'s machine gate (headless import, one frame, the materials probe, the figure probe);
  `godot-verify.mjs --screenshot` (a PNG for the operator). No web-vs-engine pixel comparison anywhere.
- **From `1025-godot-recoup` (unmerged; see below):** effects as data beside their fragment (`composeCloudDeck` returns
  `deck`, the numbers both renderers read); the Chrome fragment-parity harness (`godot-clouds.chrome.test.js`,
  `godot-juice.chrome.test.js`: a `.gdshader` rewritten as GLSL ES 3.00 and rendered against the page's own fragment into
  float targets, plus a drifted variant that must disagree); corpora with planted bugs for logic ports.

#### What `1025-godot-recoup` teaches

The recoup branch caught Godot's GAMEPLAY up (near the genre probes 192 → 270 of 500 worlds playing; no fixture game
losing anything on export) in three commits. What it did:

1. **Hand ports, held to the web.** Each web behaviour got a GDScript or `.gdshader` twin: `vehicle.gd` (427 lines),
   `juice.gd` (822), `mind.gd`'s frag player, `rules.gd`'s glide and movers, `clouds_sky.gdshader`, `wet_road.gdshader`,
   `beam.gdshader`, `sfx.gd`. Each is held equal by a conformance corpus (the web's own emitted functions run against
   the port, 1e-9) with a planted bug per port, or, for a shader, by the Chrome fragment-parity harness.
2. **Data beside the effect.** The cloud deck's numbers left the fragment as data (`deck`) so the port reads the same
   numbers instead of re-deriving them.
3. **Marks kept honest.** Every new port moved its mark from absent to approximated, never built, because "no one has
   looked at them in a Godot window yet".

Where it fell short, and what this plan does instead:

| Recoup | Consequence | This plan |
|---|---|---|
| A port per effect per engine (`juice.gd` is 822 lines of the page's juice, again) | Every web change is re-ported; Unity would need the same in C#; drift | Translate DATA into engine-native features (materials, lights, environment, instances); port a shader only where no native feature exists, and then hold it with the parity harness |
| Never run in a real Godot ("neither this branch's machine nor CI has") | The equality corpora have not run; the shaders were checked as GLSL in Chrome only | Phase 0 puts a Godot binary in a gate (a CI job or a pinned download) before graphics claims anything beyond approximated |
| One branch, three large commits, left on 10-25 | 528 commits behind `1026-consolidated`; conflicts in `CHANGELOG.md` (pre-theme-file), the deleted `registry.generated.js` (the live registry), `godot-marks.js`, `hillclimb.md`, `vitest.config.js` | Small slices, each landing on the candidate through its PR; a theme file, never `CHANGELOG.md` |
| Its visuals (cloud deck, wet road, beams, glows, juice cards) are a second graphics path beside the paint export | Two graphics paths to supersede, not one | Its sky and screen effects fold into the environment record (phase 2) and the effects descriptors (phase 6) |

Its gameplay work is valuable and orthogonal: graphics make Godot exports LOOK right, recoup makes more of them PLAY.
Recovering it is its own branch (rebase onto the candidate, its log as a theme file, the marks and the hillclimb page
regenerated over the live registry), recommended before phase 6.

#### The contract (engine-neutral)

`scene/form-export.js` (new): `formExport(payload, { engine })` → what every adapter reads. Three parts, all plain data,
seeded, byte-stable:

1. **Materials in the GLB.** Every surface as glTF metal-rough: `baseColor` (the material's colour, no light),
   `normal`, `orm`; what glTF has no slot for in `extras.mojulo` (`height` and `depth` for parallax, a layered ground's
   `splat`, a plant's `sway`). Paint-only surfaces (any not yet built as form) go as **albedo unlit**: the unshaded
   payload's colour as the material's, its cavity kept, no light (the gen-7 cast convention `albedo-unlit`, today
   `planned`).
2. **Instances.** Stones, plants, grass drifts: a template mesh and its transforms (`extras.mojulo.instances`, or
   `EXT_mesh_gpu_instancing` where the importers read it: an open question per engine).
3. **The environment record** in the score (`score.environment`): the sun's direction, colour and strength at the
   level's hour (the cube's solved light, `era/cube-light.js`), the ambient, the sky (today's `sky.gdshader` inputs),
   fog and haze, the shadow tier (`liveLightDefaults`), occlusion on or off, lamps (a room's), the cloud deck's numbers
   (recoup's `deck`). The web's World page reads the same numbers it already reads; nothing new is decided per engine.

Each engine leg is an ADAPTER of the contract: Godot binds it to `StandardMaterial3D` (normal, ORM, `heightmap_enabled`
for parallax), `DirectionalLight3D` with shadows, `WorldEnvironment` (fog, SSAO, tone), `OmniLight3D`,
`MultiMeshInstance3D`; Blender to Principled BSDF, a World, sun and point lights, collection instances; Unity to URP Lit
and a Volume; Unreal's asset leg to its master material. Roblox stays paint (out of scope).

#### Phases

0. **A real Godot in a gate.** Pin a Godot 4 binary the gate can fetch (or a CI job with it) so `MOJULO_GODOT` is set
   somewhere that runs. This container cannot fetch it (GitHub releases answer 403 through the proxy); CI can. Without
   it every Godot claim here stays approximated. Also: the form data must be byte-stable across runs before anything pins
   it (`land-read.js` paints its layer textures "once per process"; check they are identical run to run and across the
   reference CPUs).
1. **The contract and the floor.** `form-export.js`; `resolveLevel` reads `{ paint: false, unshaded: true }` for the
   form export and computes `payload.form` (today skipped for `paint: true`); every surface leaves as albedo unlit or as
   its form material; `level.gd` `_fix_materials` stops forcing vertex colour as albedo on a material that carries its
   own colour. `export_game` accepts the form export for Godot (the era refusal lifted for it). Godot marks: `form`
   partial. One island first (the meru island), then a trail.
2. **Light and environment.** `score.environment` written from the level's hour; `level.gd` builds the sun with shadows,
   the ambient, the `WorldEnvironment` (fog, SSAO, tone), and keeps `sky.gdshader`. Marks: shadows, fog, occlusion move
   off absent. The cheapest, most visible step.
3. **The form surfaces.** Dressed faces (`matte-paint/dressed.js` already calls `reliefMaterial`) and bark
   (`barkMaterial`) into the GLB as textured PBR with height in the extras, bound to Godot's parallax. The land's layered
   ground: **bake-first** (the layer blend baked into per-chunk base / normal / ORM textures: engine-neutral, every
   adapter reads plain glTF) with a `splat` + layer-atlas path behind it for a Godot terrain shader, held to the page's
   layered-ground fragment in Chrome (recoup's harness). Rooms: `room-form.js` tiles as materials, the lamps as lights,
   the baked indirect (`aLit`) carried as a second vertex colour the room's material reads.
4. **The plants and the stones.** `payload.form.flora` and the scree's stones as instances: templates once, transforms
   per plant, `MultiMeshInstance3D` in Godot. The page builds the same from the same data (so the web and the engine
   draw one source). The rock relief's displacement (today page script over `form/rock-relief.js`) moves to the build
   side so the displaced cliff is geometry in the GLB.
5. **Supersede.** The form export becomes Godot's only graphics path: `resolveLevel` for Godot reads form; the paint
   export and the CLI's `--lit` fold into it; a gen-6 recipe exported to Godot leaves as albedo unlit under its hour's
   light. Every Godot byte pin that moves says so in the same commit (an emission change, declared). The kernel's
   VERSION bumps.
6. **Effects that have no native feature.** Grass and flora wind (`sway`), needles, snow prints, creases: each a small
   `.gdshader` reading the contract's numbers, each held to the page's fragment in Chrome, or left off and named in the
   marks. Recoup's cloud deck, wet road, beams and glows join here as effects of the environment record, not a second
   path.
7. **The visual gate.** The level's shoot-plan cameras (they already land as `Camera3D`) render the same shots on the
   page and in Godot; a similarity score per shot (SSIM, ΔE on the mean) reported beside the import gate. Advisory, never
   refusing; the eyes gate stays the operator's.
8. **The second engine.** Blender on the same contract (it already has a gate, `MOJULO_BLENDER`, and glTF → Principled
   is the shortest adapter), to prove the binding is reusable; then Unity. Each a new adapter; no change to the contract
   unless an adapter finds a gap, and then the contract grows for every engine at once.

#### Gates

**Machine.**
- Determinism: the same level exports byte-identical twice, on the reference runtime; `payload.form` is identical run
  to run.
- A gen-6 web read is unchanged (every web byte pin stays); only engine pins move, declared.
- The GLB validates; every form surface carries baseColor + normal + ORM (or is albedo unlit), counted by the export's
  own ledger.
- Godot (when `MOJULO_GODOT`): headless import and one frame; a materials probe asserting the normal and ORM slots are
  bound and vertex colour is not forced over a coloured material; the environment probe (a sun with shadows, the
  `WorldEnvironment`'s fog and SSAO as the record says).
- Every ported shader held to the page's fragment in Chrome, with a drifted variant that must disagree.
- The visual gate's per-shot similarity, reported, never refusing.

**Eyes.** The operator opens the meru island, a trail and a lit room in a Godot window beside the World page at the same
camera and says what reads wrong. Never claimed by a machine.

#### Out of scope

- Gameplay parity (recoup's, and its rebase).
- A moving sun (eras.js: a level is lit at one hour), HDR and image-based lighting beyond what `WorldEnvironment` gives
  from the record, lightmaps baked by Godot (a later option for rooms).
- Roblox graphics; Unreal games or levels (assets only, unchanged).
- Changing the web's gen-6 look or making gen-7 the web's default.

#### Open questions

1. Godot in CI: a pinned download in the workflow, or a self-hosted runner? Which Godot 4 minor do the kernel's scripts
   target?
2. The land's layered ground: is the bake-first texture budget acceptable (a chunked island at the layer atlases' texel
   density), or should Godot go straight to a splat terrain shader?
3. Instances: does Godot's glTF importer read `EXT_mesh_gpu_instancing` in the targeted version, or does the score carry
   the transforms for `level.gd` to build `MultiMeshInstance3D`?
4. Paint surfaces as albedo unlit: is the unshaded payload's colour a fair material colour for every gen-6 surface, or do
   some (painted tiles with light in them) need their own unlit read?
5. Should a stylized "paint" export stay available as an explicit option for engines (a deliberate gen-6 look), or does
   superseding mean removing it?
6. Recoup: rebase it before this branch's phase 6, or after?

#### Log

- 1031: plan written; `1025-godot-recoup` read (three commits, 10-25, unmerged, 528 commits behind, conflicting in the
  changelog, the live registry, the marks and the hillclimb page); the form modules confirmed pure and seeded, and
  `payload.form` confirmed plain data the export path skips under `paint: true`.
