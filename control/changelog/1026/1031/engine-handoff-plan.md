### Engine handoff plan (temporary: the working plan, parked here; delete before release)

**Status:** phase 0 built (its Godot job awaiting its first CI run); phase 1's first slice built (1031). Branch `1031-gen7-export`, cut from `1026-consolidated`. Theme file
`control/changelog/1026/1031/engine-handoff.md`. No release has carried the engine game runtimes this plan removes, so
nothing here needs a deprecation path.

**Outcome.** Two outcomes, said plainly everywhere:
- **The web: the whole game, end to end.** `export_game` (`web`, `desktop`): every department, playable in the browser or
  as the Electron desktop app. Unchanged.
- **The engines: a handoff of assets, animation and levels at the polygon level.** One export, `export_model { engine }`,
  gives Godot, Unity, Unreal and Blender as much as mojulo can make: every surface as a gen-7 material, every rig with
  its clips and faces, every level as layout, light, colliders and named markers, for a developer to wire and finish
  there. It supersedes every prior engine export. The game runtimes ported into the engines (Godot's GDScript kernel,
  Unity's C# runtime, Roblox's Luau kernel) are culled, and Roblox is dropped as a target.

#### Why, and why now

Mojulo changes and coalesces; it goes where the water wants to go. The engine legs grew game runtimes because a game in
an engine seemed to need its rules there, and the hillclimb sweep grew "plays in Godot" and "plays in Roblox" columns to
measure them. A game's rules are the web's, end to end; what an engine developer wants from upstream is the work that is
hardest to make by hand (the materials, the rigs, the levels) in their engine's own terms.

The runtimes cost more than they return:
- About 14,000 lines of GDScript and shaders in `godot-kernel/` and `godot-arcade-kernel/`.
- About 10,500 lines of Luau in `roblox-kernel/` and `roblox-place/`.
- Unity's C# mirror (`Runtime/`).
- Conformance corpora and probes to hold every port equal to the web, most of which no CI machine can run.
- Every change on the web needs a re-port. `1025-godot-recoup` spent about 3,700 lines moving one number (near the genre
  probes, 192 to 270 of 500 worlds playing in Godot), never ran in a real Godot, and is now stranded.
- The result: Godot plays 48 of 500 random worlds, Roblox 3.

`1025-unreal-recoup` already made the turn for Unreal ("Unreal takes assets, not games or levels") and ran the first real
engine gate. This plan makes that the rule for every engine, adds levels to it, and raises it to gen 7.

#### Why gen 7 is the bridge

`era/eras.js` names gen-6's surface `paint` (the light held in the colour) and gen-7's `form` (material and geometry, lit
by the renderer). Form is the engines' own model; paint is a web trick an engine either draws unlit or lights twice.

The form render's content is already engine-neutral data:
- `form/land-read.js` is pure and seeded, and its `formPayload` is "plain data, JSON-safe": the land's vertices, the
  solved light, the layers' weights and their base / normal / ORM atlases, the path mask, the sea's depth, the scree's
  stones, the rock's relief, the grass map.
- `form/flora-read.js` returns the plants' templates and instances.
- `form/bark-material.js` and `form/relief-material.js` return glTF's metal-rough set. `matte-paint/dressed.js` already
  calls `reliefMaterial`.
- `form/land-layers.js` calls itself "the engine's terrain primitive: Unreal's landscape layers, Godot's splat … a
  renderer, or an engine pack, owns the materials".

The World page's `channels/form-*.js` is only the web's adapter of `payload.form`. Today the engine path skips it
(`resolveLevel` reads `paint: true`; `export_game` refuses an era for engine targets). This plan writes the engines'
adapters of the same data.

#### What exists (keep and build on)

- **The GLB writer, `scene/scene-gltf.js`:** meshes, PBR materials with base, normal and ORM textures (today for figures:
  the realistic head's normal bake, cloth relief, the beast-kin cover), `extras.mojulo` for what glTF has no slot for,
  skinning, clips, face morphs, the engine skeleton and its VRM T-pose re-rest, a realistic hero's recorded takes. The
  asset and animation handoff, already built.
- **`scene/scene-usd.js`:** the second container, beside the GLB.
- **`scene/engine-score.js`:** a level's entities, bus and posture. Becomes the level's markers.
- **`scene/engine-audio.js`, `engine-sound.js`:** the soundtrack and sound effects as files.
- **`scene/operator-guide.js`:** the import guides, already shared by Unity, Unreal and Blender.
- **The importers:**
  - Godot's import and material binding in `level.gd` (`_fix_materials`, `figure_parallax.gdshader`), `sky.gdshader`,
    `water.gdshader`, `tone.gdshader`.
  - Unity's `Editor/MojuloImport.cs` (builds and saves the scenes; deterministic `.meta` GUIDs).
  - Unreal's `import_mojulo.py` (meshes, lights, a skinned figure's clips and face morphs, a humanoid's IK Rig and
    retargeter, a preview map; proven against UE 5.8.0).
  - Blender's art-pass pack, importer and Cycles bake (`blender-pack.js`, `blender-project.js`, `blender-bake.*`).
- **The import gates:** `export-godot.mjs`'s headless import, one frame, the materials probe and the figure probe;
  `godot-verify.mjs --screenshot`; Unreal's verify mode (`mojulo-gate.json`); `MOJULO_BLENDER`'s importer run.
- **From `1025-godot-recoup`, taken as ideas, not merged:**
  - Effects as data beside their fragment (`composeCloudDeck` returns `deck`).
  - The Chrome fragment-parity harness (a `.gdshader` rewritten as GLSL ES 3.00, rendered against the page's fragment
    into float targets, a drifted variant that must disagree), for any engine shader this plan keeps.

#### What goes

- **Godot's game runtime:** the kernel's game scripts (`bus.gd`, `store.gd`, `mind.gd`, `rules.gd`, `combat.gd`,
  `cast.gd`, `quests.gd`, `hud.gd`, `menu.gd`, `game.gd`, `scenes.gd`, `walker.gd`, `stats.gd`, `nav.gd`, `beat.gd`,
  `sound.gd` and the rest that run a game), `godot-arcade-kernel/` and `godot-arcade.js`, `godot-harness.js`. The
  importer half of `level.gd` and the graphics shaders move into the Godot adapter.
- **The conformance machinery for runtimes:** `*-conformance.js` under `scene/`, `engines/conformance.js`,
  `scripts/conformance.mjs`, `scripts/conformance/`, the game probes (`godot-game-probe.gd`, `godot-bus-probe.gd`,
  `godot-combat-probe.gd`, `godot-level-sim.gd`, `godot-keys-probe.gd`, `godot-sound-conformance.*`,
  `godot-fixture-matrix.mjs`), and their tests. `science-conformance.mjs` holds the science views' shaders to their
  model and stays.
- **Unity's runtime:** `Runtime/` (`MojuloGame`, `MojuloLevel`, `MojuloMenu`, `MojuloWalker`, `MojuloWeather`).
  `MojuloImport.cs` stays.
- **Roblox, entirely:** `roblox-*.js`, `roblox-kernel/`, `roblox-place/`, `scripts/roblox/`, `export-roblox.mjs`,
  `engines/roblox-*.test.js`, `MOJULO_ROJO` and `MOJULO_LUNE` in `workers/find.js`, its registry entry and marks.
- **`export_game`'s engine targets** (`godot`, `unity`, `roblox`): they move to `export_model { engine }`.
- **"Plays in an engine" as a measure:** the hillclimb page's "plays in Godot" and "plays in Roblox" columns, the
  cosmos facets' engine readings (`cosmos/read-sources.js`, `cosmos.js`, `facets/power.js`, `space.js`, `reality.js`,
  `soul.js`, `mind.js`), and the per-engine marks. They become one handoff ledger: what a level, an asset or a figure
  carried into each engine and what it left behind.
- **`1025-godot-recoup`:** closed unmerged.

#### The contract

`scene/handoff.js` (new): `resolveHandoff(sketch, { what })` → one engine-neutral handoff, written once, read by every
adapter. Plain data, seeded, byte-stable.

1. **Assets.**
   - Every surface as a glTF metal-rough material: `baseColor` (the material's own colour, no light), `normal`, `orm`.
   - What glTF has no slot for in `extras.mojulo`: `height` and `depth` for parallax, a layered ground's `splat`, a
     plant's `sway`.
   - A surface not yet built as form leaves as **albedo unlit**: the unshaded payload's colour as the material's, its
     cavity kept, no light (the gen-7 cast convention `albedo-unlit`, today `planned`).
   - Instances: stones, plants and grass drifts as a template mesh and its transforms.
   - Characters, props and vehicles as their own assets, by ref, as well as placed in a level.
2. **Animation.** What the GLB already carries: the skeleton (and the engine skeleton, VRM-named, T-posed), the clips,
   the face morphs, the recorded takes with their voice.
3. **Levels.**
   - The layout as meshes in the level's own frame (z-up metres, each adapter converting once).
   - Colliders: walkable ground and walls, as the web's own traversal reads them.
   - The environment at the level's hour: the sun's direction, colour and strength (`era/cube-light.js`), the ambient,
     the sky, fog and haze, the shadow tier, occlusion on or off, a room's lamps, the cloud deck's numbers.
   - **Markers**, named, with their data: the spawn, each foe's place, role and tier, triggers and their events, doors
     and their keys, exits, the critical path, pickups, the cameras and the shoot plan's shots, sound emitters.
   - The soundtrack and the sound effects as files beside it.
   - A ledger: what the level carried and what stayed the web's (its rules, its HUD, its effects with no engine
     feature).

Each engine is an **adapter**, an importer and nothing more:
- **Godot:** an import script that builds a `.tscn`: `StandardMaterial3D` with normal, ORM and `heightmap_enabled`;
  `MultiMeshInstance3D` for instances; `DirectionalLight3D` with shadows, `OmniLight3D`, `WorldEnvironment` (fog, SSAO,
  tone) and the sky shader; `StaticBody3D` collision; `Marker3D` nodes with their data as metadata.
- **Unity:** `MojuloImport.cs` builds the scene from the same: URP Lit materials, lights and a Volume, mesh colliders,
  empty GameObjects with a component holding each marker's data.
- **Unreal:** `import_mojulo.py` grows from one asset to a level: a map with the meshes on the master material, lights,
  sky and fog, collision, empty actors tagged as markers.
- **Blender:** the art-pass pack on Principled BSDF, a World, lights, collection instances, empties as markers.

#### Phases

0. **Freeze and gates.** No new runtime ports; close `1025-godot-recoup`. Pin a Godot 4 download the CI gate can fetch
   (this container's proxy refuses GitHub releases; CI can). Unity's and Unreal's gates stay local and advisory
   (licensing). Check that the form data is byte-stable run to run and across the reference CPUs (`land-read.js` paints
   its layer textures once per process) before anything pins it.
1. **The contract, assets first.** `handoff.js`; read the world in form (`paint: false`, `unshaded: true`, so
   `payload.form` is computed); every surface leaves as albedo unlit or as its form material; dressed faces and bark as
   textured PBR with height in the extras; instances for plants and stones. The meru island first, then a trail.
2. **The land and the rooms.** The layered ground **bake-first**: the layer blend baked into per-chunk base, normal and
   ORM textures that every adapter reads as plain glTF, with `splat` and the layer atlases in the extras for a terrain
   shader later. The rock relief's displacement moves from page script to the build side, so the displaced cliff is
   geometry. Rooms: `room-form.js` tiles as materials, the lamps as lights, the baked indirect (`aLit`) as a second
   vertex colour.
3. **Levels.** The environment record, colliders and markers from `engine-score.js` and the level's own data; the
   soundtrack and effects as files; the ledger.
4. **The Godot adapter.** The import script and its gate: import, one frame, a materials probe (normal and ORM bound, no
   vertex colour forced over a coloured material), an environment probe, a markers probe (every marker present, named,
   carrying its data).
5. **One door.** `export_model { engine: 'godot' | 'unity' | 'unreal' | 'blender', what: 'asset' | 'level' }`;
   `format: 'unreal'` folds into `engine: 'unreal'`; `export_game` keeps `web` and `desktop`. Every pointer to the old
   targets rewritten (`tool-lines.js`, the routing cards and `routing-eval.fixture.js`, the export dispatch in
   `context.js`, the vocab drawers), the descriptions re-pinned with a comment saying why.
6. **The cull.** One commit per engine: Godot's runtime, Unity's runtime, Roblox. The marks become the handoff ledger;
   the cosmos facets stop reading engines; the hillclimb page loses its engine columns (`npm run tool-surface`);
   `workers/find.js` loses Rojo and Lune; `desktop-shell.js`'s `ENGINE_OUT_DIRS` keeps the remaining engines' folders.
   Byte pins that move say so in the same commit.
7. **Unity, Unreal levels, Blender** on the same contract, each an adapter; the contract grows for every engine at once
   when one finds a gap.
8. **The visual gate.** The level's shoot-plan cameras render the same shots on the page and in each engine that can
   run headless (Godot, Blender); a similarity score per shot, reported, never refusing.
9. **The copy.** `get_substrate`'s honesty paragraph (the web is the game, an engine gets a handoff; the ladder becomes
   what each adapter carries), the README's opening and "Where it goes" (no "Godot project", no Roblox), its kart-racer
   example's export paragraph, `CLAUDE.md`'s engine-legs line and architecture map, `docs/AGENT-REFERENCE.md`,
   `docs/tech-requirements.md`, the plugin and manifest descriptions where they name engines.

#### Gates

**Machine.**
- Determinism: a handoff exports byte-identical twice on the reference runtime; `payload.form` is identical run to run.
- The web is untouched: every web and desktop byte pin stays.
- The GLB validates; every surface carries baseColor + normal + ORM or is albedo unlit, counted in the ledger; every
  marker in the level's data reaches the handoff.
- Godot (CI, when `MOJULO_GODOT`): import, one frame, the materials, environment and markers probes.
- Blender (`MOJULO_BLENDER`): the importer runs headless and the same probes read the scene.
- Unity and Unreal: their verify modes, run locally, reported.
- Any engine shader kept (the sky, water, a terrain shader) is held to the page's fragment in Chrome, with a drifted
  variant that must disagree.
- The visual gate's per-shot similarity, reported.

**Eyes.** The operator opens the meru island, a trail, a lit room and a walled-core base in Godot, then in Unity, Unreal
and Blender, beside the World page at the same camera, and says what reads wrong and whether the markers are what a
developer would want to wire. Never claimed by a machine.

#### Out of scope

- A game's rules in any engine, now or later: the web is the game.
- Roblox.
- A moving sun (a level is lit at one hour), HDR and image-based lighting beyond what each engine's environment gives
  from the record, engine-baked lightmaps (a later option for rooms).
- Changing the web's look, or making gen-7 the web's default.

#### Open questions

1. Which Godot 4 minor, and the CI download's source and checksum?
2. The layered ground: is bake-first's texture budget acceptable for a chunked island, or does Godot go straight to a
   splat terrain shader?
3. Instances: do the targeted importers read `EXT_mesh_gpu_instancing`, or do the adapters build instances from the
   transforms in the extras?
4. Albedo unlit: is the unshaded payload's colour a fair material colour for every gen-6 surface, or do painted tiles
   with light in them need their own unlit read?
5. Colliders: the walkable mesh as one trimesh, or boxes and convex pieces from the builders' own parts?
6. Markers: a fixed vocabulary (spawn, foe, trigger, door, key, exit, path, pickup, camera, emitter), or the score's
   entity kinds as they are?
7. Should `export_model { engine, what: 'game' }` exist at all, as "every level and every asset of a game, handed off
   together", or is a game handed off as its levels?

#### Log

- 1031: plan written. `1025-godot-recoup` read: three commits on 10-25, unmerged, 528 commits behind, conflicting in the
  changelog, the live registry, the marks and the hillclimb page; never run in a real Godot. `1025-unreal-recoup` read:
  merged, Unreal already assets only, the first real engine gate. The form modules confirmed pure and seeded, and
  `payload.form` confirmed plain data the engine path skips under `paint: true`. Reframed from "gen-7 as Godot's
  graphics" to the engine handoff: the runtimes culled, Roblox dropped, the desktop app kept under `export_game`.
- 1031, phase 0:
  - Frozen: `CLAUDE.md`'s engine-legs line says the engine game runtimes take no new ports and give way to the handoff.
    `1025-godot-recoup` has no pull request; it stays unmerged (the branch itself is kept until the operator says).
  - CI's `godot` job (`.github/workflows/test.yml`): Godot 4.7.2 (the version the gate was last verified against; the
    repository variable `GODOT_VERSION` overrides it) fetched from `godotengine/godot-builds`, checked against the
    release's `SHA512-SUMS.txt`, cached, named as `MOJULO_GODOT`, and `godot-humanoid-pack.test.js` (a figure's import,
    its engine skeleton, BoneMap and retarget, its clips) run against it. Not yet run: this container cannot reach
    GitHub's release downloads, so the job's first run is on CI (a pull request or the workflow's manual run). If the
    builds repository does not carry the version or its sums file, the first run says so.
  - The form data is byte-stable: `form/land-read.char.test.js` hashes `formPayload` for a small meru island with its
    grass map, painted fresh and then memoized, the two equal and the hash pinned; two separate runs gave the same hash
    here (Node 22, x86_64). The pin runs on every reference leg, so the macOS leg is the cross-CPU check.
  - Open question 1 answered in part: Godot 4.7.2 from the builds repository; a literal checksum pin can replace the
    sums-file check once the first run prints it.
- 1031, phase 1, first slice (the contract, the albedo floor, the stones):
  - `scene/handoff.js`: `resolveHandoff(sketch, { what })` reads the world unshaded in gen-7 with `handoff: true` (a new
    view option: `worlds/world-scene.js` lets the form render's land read run under the unshaded read only for it; absent,
    every byte as before), writes the GLB lit (glTF metal-rough; the water lit too, a smooth translucent dielectric, under
    `facesToGlb`'s new `handoff` flag), and returns `{ kind, payload, exported, instances, ledger }`. The ledger: the
    version (`handoff/0`), the era, what was handed off, what it carried (faces, instances by set), and what stays the
    web's (the land's layers, the stones' skin, the plants and grass, the light).
  - The scree's stones as instances: `stoneInstances(payload.form.land.stones)`, one set per shape, size (near or far,
    the page's `CAST_R` split) and tone (to 0.1), each stone a node standing +Z onto its ground's normal and yawed by its
    index, as wide and as deep as `channels/form-land.js` draws it (the page's own jitter hash). `facesToGlb`'s new
    `instances` option writes them (`GlbBuilder.addFormInstances`: a template with its normals and a node per instance
    with a full TRS); absent, no bytes.
  - `scene/handoff.test.js`: a gen-7 trail (`island-noon`, `show: 'trail'`) hands off lit, every material metal-rough,
    its stones as instance nodes equal to the land's count, the same bytes twice; a stone stands on its normal; a
    workbench piece hands off its albedo with no instances.
  - Found on the way: `island-noon`'s default read is a room (`form.room`); its island is `show: 'land'` (about 30 s to
    read), its trail `show: 'trail'` (about 8 s). Of 32 materials in the trail's handoff, only the water was unlit before
    the `handoff` flag.
  - The jitter hash is the page's `Math.sin` hash: deterministic per runtime, but V8's `Math.sin` may round its last bit
    differently by CPU; if the macOS leg disagrees with a pin of a stone's scale, move the jitter into the land read's
    stone pack (both the page and the handoff then read it).
- Next slice, the plants (mapped, not built): a forest path (`{ kind: 'geocube', cube: 'limestone-crags', biocube: {
  from: 'forest' }, show: 'path', seed: 1 }`, about 130 s to read: test the plants from `floraRead` directly, not through
  a whole world) carries `payload.form.flora` = `{ templates, barks, trees, n, lod, leafRef }`:
  - A template: `wood` and `woodFar` as `{ pos, nrm, uv, idx }` (metres; uv in bark tiles, u round the trunk, v up it),
    `clumps` (b64 transforms of `clumpGeo`'s variants), `sites` and `sprayGeo` (sprays near the eye), `farGeo`, `bark`
    (a key into `barks`), `trunk`, `cross`, `litter`.
  - `barks[key]` = `{ metres, depth, base, normal, orm, … }`: PNG data URLs, glTF's metal-rough set already
    (`form/bark-material.js`); the wood's uv is in tiles, so a repeating sampler takes it as it is, the height and depth
    to `extras.mojulo` for parallax.
  - `trees`: b64 Float32, `FLORA_STRIDE` (13) per plant (its template, place, turn, scale and tint: read the layout off
    `channels/form-flora.js` before writing it).
  - Plan: per template one wood mesh on its bark's textured PBR material and one foliage mesh (the clumps baked into the
    template, its leaf tint as the material's colour), each tree a node referencing both. The sprays near the eye stay the
    web's (a level of detail an engine makes its own).
- After the plants: the dressed faces' relief (`matte-paint/dressed.js` already calls `reliefMaterial`) as textured PBR,
  then phase 2.

