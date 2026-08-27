# Godot handoff — the engine leg of interchange

Status: **DRAFTED 2026-08-27; G0 in progress.** Successor to the deferred I5
"asset-pack export" of `interchange.plan.md` (plan-archive), made Godot-shaped.
Drafted from a two-sided investigation: mojulo's export/worker seams and
Godot 4.7's automation surface.

## Posture (read before adding scope)

Same doctrine as interchange: **a side door, sized like one.** Mojulo's
center of gravity is the sovereign-recipe loop; nothing here changes it.
Godot is an *edge consumer* — like Blender, an optional operator-hosted
tool the agent drives, never a dependency, never a runtime the substrate
supervises. The one law carries over: *mojulo authors truth at home; the
edge tool consumes it and never guesses at the seam.*

What the door buys beyond Blender's: Blender proved *admissibility* (a
practitioner can open the thing); Godot proves **playability** — "a
conversation produced a game a stock engine can open, walk, and build"
becomes a demonstrable fact, not testimony inside our own shell.

Carried invariants:

- Recipes stay sovereign. Everything emitted here is a **derived
  artifact** — a generated Godot *project as text* is the deterministic
  derived form; a PCK/web build is a render of that.
- Additive only. No existing export bytes change; `export_model` /
  `export_game` behavior is untouched unless a phase says otherwise.
- Two-gate discipline (docs/bicycles.md): machine gate = headless
  import/build exit + scripted assertions; eyes gate = a rendered
  screenshot judged by the operator. Never conflated.
- No durable queue in v1 — the blender-mcp finding transfers: the agent
  driving Godot (headless one-shots, or a community godot-mcp) IS the
  worker. The render-handoff bicycle graduates only if unattended
  workers appear.
- Tool-description payload is at ceiling (~380.9k / 381k). New MCP
  surface must be byte-frugal; prefer scripts + catalysts over new tools
  where possible.

## Current state (what already crosses, from the investigation)

- `export_model` → `.glb` is **near-perfect Godot input already**:
  `KHR_materials_unlit` imports as `shading_mode = Unshaded`, `COLOR_0`
  lands in `ARRAY_COLOR` — the baked vertex-colour look survives
  untouched. Rig clips (FK TRS, no skins, 1 s/cycle, K+1 loop keys) play
  on a stock AnimationPlayer. `moj:*` extras survive as node metadata
  but nothing consumes them — an operator gets a mesh, not a level.
- The I4 gate named "import into Blender **and Godot**"; only the
  Blender half ever ran. The Godot half is the owed debt G0 pays.
- `export_beats` WAV (16-bit PCM 44.1/48k) drops straight into
  `AudioStreamWAV`. The MIDI leg serves DAWs, not Godot (no built-in
  MIDI playback) — do not chase it.
- `bake_sprite_sheet` bakes **JSON quantized rasters** (palette+cells),
  not a PNG atlas — the one format gap (G2).
- `bind_mesh_render`'s machine gate (`glbToFaces` full decode) should
  accept Godot's runtime `GLTFDocument` re-export — assumed, unverified
  (G5 spike).
- Blender-worker pattern is the template throughout:
  `scripts/bake-world-gi.mjs` / `blender-bake.mjs` (env-located binary,
  headless one-shot, JSON handback, machine+eyes gates, sidecar
  provenance).

## Load-bearing Godot facts (pin these; verified 2026-08 unless noted)

- Current stable **4.7.2** (`brew install --cask godot`; binary at
  `/Applications/Godot.app/Contents/MacOS/Godot`). Locate via
  **`MOJULO_GODOT`** env, same convention as `MOJULO_BLENDER`.
- Headless pipeline is fully unattended: write `project.godot` + assets
  + `.tscn` text + `export_presets.cfg`, then
  `godot --headless --path . --import` and
  `--export-release <preset> <out>`. Export implies import; requires
  export templates installed (a `.tpz` unpacked to a known dir —
  scriptable, MIT-licensed, redistributable).
- **`.godot/` import cache**: a generated project is inert until
  `--import` runs; binary assets (PNG/WAV/GLB) are load-remapped through
  `.godot/imported/`. Never commit `.godot/`. Text `.tscn/.tres/.gd`
  need no import.
- Known wart: first `--import` into a fresh project has exited 1
  despite succeeding (upstream #83449, unverified-fixed) — run import
  twice or tolerate the first exit code.
- `.tscn`/`.tres` text format is documented and hand-writable
  (`format=3` for all 4.x). Hand-write wrappers, materials
  (`vertex_color_use_as_albedo`), `AtlasTexture`, `SpriteFrames`,
  nodes; do NOT hand-write ArrayMesh `vertex_data` blobs — ship
  geometry as glTF, or have a `--script` GDScript build meshes via
  `add_surface_from_arrays` and `ResourceSaver.save()`.
- **uids**: every resource has `uid://` identity (+ `.uid` sidecars for
  scripts since 4.4). For deterministic re-mints either omit `uid=` on
  ext_resources (path fallback works; editor backfills on save) or mint
  our own uids deterministically. Prefer deterministic minting —
  regenerated projects stay diff-clean.
- glTF vertex-colour import had a real bug in 4.4.1 (black/corrupt with
  use-as-albedo; fixed by ~4.5) — capability ladder pins **≥4.5**.
- Runtime `GLTFDocument.append_from_file → generate_scene()` works in
  exported games (a generated player could load mojulo GLBs at
  runtime); `AudioStreamWAV.load_from_file` since 4.4.
- `--script <file>` runs a standalone GDScript extending
  SceneTree/MainLoop headlessly — the machine-gate assertion vehicle.
- Web export: healthy since 4.3 (single-threaded, no SAB requirement),
  GDScript only, ~30–50 MB wasm.
- Byte-identical *exports* (PCK) are not promised upstream; generated
  project *text* is where determinism lives. This matches doctrine.
- Godot MCP servers exist (best known: Coding-Solo/godot-mcp — CLI
  wrapper, npx, no addon). Record via `record_mcp_capabilities` when an
  operator installs one; none is required by this plan.
- Watch, don't build: **LibGodot** (4.6+, engine-as-library) is the
  path if mojulo ever wants Godot as a live renderer instead of an
  export target.

## Phases

### G0 — Close the owed I4 Godot gate

Repeat the Blender verification against Godot, scripted and repeatable:
`control/scripts/godot-verify.mjs` (driver, mirrors `bake-world-gi.mjs`:
`MOJULO_GODOT` lookup, tmpdir project, JSON handback) + a `--script`
GDScript that imports `data/outcomes/sk_ms_tutorial_rising/model.glb`
and asserts:

- animation count (351) and probe clip `g_multi:forward` — track count,
  key count (K+1 = 13), duration exactly 1.0 s;
- `cam:view 0` imported as a Camera3D-equivalent glTF camera;
- `moj:entity` / `moj:rule` / `moj:body` readable as extras/metadata on
  entity-claimed wrapper nodes; scene-level `moj:spawn` /
  `moj:colliders` / `moj:game` present;
- COLOR_0 + unlit materials survive (probe a known face colour).

Eyes gate: headless screenshot of the imported scene from `cam:view 0`
(viewport render to PNG via the same GDScript), operator judges walk
pose / palette. Expect the two recorded Blender findings to reproduce
(roster figures stacked at origin; drawn+stowed weapons both visible) —
log them here; their fix belongs to the export side, not to G0.

**G0 build log (2026-08-27, gate CLOSED).** Godot 4.7.2 installed
(`brew install --cask godot`); `control/scripts/godot-verify.mjs` +
`godot-verify.gd` landed and ran against the real
`sk_ms_tutorial_rising` export (66 MB, the same GLB the Blender gate
used).

- **Machine gate PASSED** (runtime `GLTFDocument.append_from_file` —
  the same API an exported Godot game would use): all **351
  animations** import; probe clip `g_multi_forward` length exactly
  1.0 s; **13 keys confirmed in the file** (sampler input accessor);
  `cam_view 0` imports as a Camera3D; scene extras `moj:spawn`
  ([-300,0,0]) / `moj:colliders` (86 boxes) / `moj:game` (contract
  digest) all present; both entity wrappers carry
  `moj:entity`/`moj:rule`/`moj:body`; COLOR_0 present on every probed
  mesh; all materials import Unshaded.
- **Finding 1 — the vertex-colour gap (the headline).** NEITHER Godot
  import path (runtime GLTFDocument, editor `--import` — spiked
  separately, identical result) sets `vertex_color_use_as_albedo`, so
  every vertex-coloured-only face renders WHITE out of the box; only
  embedded-texture faces (cobble deck, grass) survive unfixed. Remedy
  proven in the same gate: **one flag per material**
  (`vertex_color_use_as_albedo = true`; `vertex_color_is_srgb` stays
  false — mojulo COLOR_0 is linear) restores the full baked palette
  (city blocks / farmland / pond / road markings all read correct in
  the eyes-gate still). **G1 contract: every generated project MUST
  carry this fixup** (generated material overrides in the `.tscn`, or
  an `EditorScenePostImport` script on the GLB).
- **Finding 2 — clip resampling.** Godot bakes imported animations at
  30 fps: the 13-key 1.0 s clip becomes 31 keys / 42 tracks
  (rotation+position per bone) in the scene. Data-lossless for our
  LINEAR samplers; recorded so nobody chases a phantom key mismatch.
- **Finding 3 — extras land as ONE meta key.** glTF node extras arrive
  as a single `extras` Dictionary meta (`node.get_meta("extras")["moj:entity"]`),
  not as per-key metadata. Scene-level extras are reachable only via
  `GLTFState.json` at runtime (raw JSON) — another reason G1 promotes
  extras to real nodes at generation time instead of asking Godot-side
  code to parse them.
- **Eyes gate PASSED** (windowed run — headless Godot is a dummy
  renderer and cannot rasterize; the driver's `--screenshot` pass runs
  windowed): still at
  `data/outcomes/sk_ms_tutorial_rising/godot-import.png` from the
  imported `cam_view 0`, palette correct after the fixup. Both
  recorded Blender findings REPRODUCE in Godot as predicted: unplaced
  roster figures clump at the origin, and drawn+stowed weapon meshes
  render simultaneously — their fix stays on the export side (the I4
  follow-up), not in this gate.
- Ergonomics worth keeping: the throwaway `--script` project needs
  only a two-line `project.godot`; first `--import` on it exits 0
  (the fresh-project wart did not reproduce on an assets-free
  project); `OS.get_cmdline_user_args()` carries the GLB path after
  `--`; glTF names sanitize on import (`g_multi:forward` →
  `g_multi_forward`, `cam:view 0` → `cam_view 0`) — compare through a
  normalizer, never literally.

### G1 — `export_godot`: the generated-project handoff (the prize)

The I5 asset-pack, emitted as a **ready-to-open Godot project**, all
plain text + copied assets. New script-first surface (a
`control/scripts/` driver + emitter module under `lib/graph/scene/`);
MCP tool exposure decided later against the payload ceiling.

Emit into `data/outcomes/<ref>/godot/`:

- `project.godot`, `export_presets.cfg` (web + macOS presets), README
  (provenance: refs, manifest sha256/16, re-mint note) + `recipe/*.json`
  — parity with `export_game`.
- Per level: the exported `.glb` (reusing `export_model` output) + a
  hand-written `.tscn` that instances it and **promotes `moj:*` extras
  to real nodes at generation time** (the emitter has the resolved
  payload — it never parses its own extras): `StaticBody3D` +
  `BoxShape3D` per AABB collider, `Marker3D` at spawn, `Camera3D` per
  `worldFraming` (reuse the `lookAtRotation` solve in
  scene-gltf-level.js), `AudioStreamPlayer` per beats WAV
  (`music.battle` arrays may ride `AudioStreamInteractive` later).
- **The G0 vertex-colour fixup, mandatory**: generated material
  overrides (or an `EditorScenePostImport` script on the GLB) setting
  `vertex_color_use_as_albedo = true` per material — without it the
  whole world renders white (G0 Finding 1).
- One small generated `CharacterBody3D` walker `.gd` (spawn, eye
  height, collide with the promoted static bodies) so the level is
  **playable on open** — the demo moment.
- Determinism: stable file ordering, deterministically minted uids,
  no timestamps in emitted text (provenance dates live in README only).

Machine gate: `--headless --import` (twice, per the wart) exit 0, then
`--export-release Web` builds. Eyes gate: run the project headed once,
walk the level, screenshot.

### G2 — Sprite atlas leg

`bake_sprite_sheet` additionally emits a PNG atlas (from the quantized
`baked.sprites` cells — pure pixel blit, no new deps) + `SpriteFrames`
/ `AtlasTexture` `.tres` text. Rides into G1's project for 2D/HUD use.
Small; sequence after G1 proves the project emitter.

### G3 — Package the workflow (catalyst + capability ladder)

- `godot-handoff` catalyst (template: `render-image-outcome-locally.md`
  — capability ladder, numbered loop, two-gate audit, "what you DON'T
  do"): export → generate project → import-gate → play/eyes-gate →
  optional web build → bind build provenance.
- Capability ladder rungs: (0) no Godot — stop at the generated project
  text; (1) `MOJULO_GODOT` binary — headless gates + builds; (2) a
  godot-mcp server — live editor driving; record via
  `record_mcp_capabilities`.
- Studio-wing gating only (`three` marker) — no new install axis;
  binary presence is a runtime env lookup, the Blender precedent.

### G4 — Authored normals (un-defer; now two consumers)

The mirror-normal investigation's "real fix" — author outward normals
in the geometry layer (lathe/assembler parts have a well-defined
outward from their axis) and emit the glTF `NORMAL` attribute. Blender
bakes stop guessing from winding, AND Godot operators who enable
backface culling or relight a world stop hitting asymmetric breakage.
Scope: geometry-layer change with its own char-safety story — plan and
land as its own batch; G1 does not block on it (unlit double-sided
hides it for the default path).

### G5 — Bind-back spike + build provenance (demand-gated)

- One-time spike: Godot runtime `GLTFDocument` re-export of a mojulo
  GLB → `bind_mesh_render` (does `glbToFaces` accept it, does COLOR_0
  survive, as it did Blender's round trip?). Record the finding here.
- If operators keep finished builds: a `bind_game_build` following the
  append-only sidecar store pattern (`*-store.js`, sha256, source,
  note). Only on demand.

## Rejected

- **Godot editor addon/plugin shipped into projects** — text + headless
  covers generation with zero project footprint.
- **Per-engine adapter abstraction** — one engine, one emitter;
  generalize only when a second engine shows real demand.
- **GDScript port of beats synth / pixelizer reducers** — the web
  export already carries them; `AudioStreamGenerator` re-synthesis is a
  curiosity, not a need.
- **MIDI-in-Godot** — no engine support; the MIDI export leg serves
  DAWs.
- **Durable godot request queue in v1** — blender-mcp finding
  transfers; agent-driven one-shots suffice.
- **LibGodot embedding** — watch upstream; nothing here depends on it.

## Sequencing & hygiene

Order: **G0 → G1 → G2 → G3**, each with machine + eyes gates closed
before moving on; G4 is its own parallel batch; G5 demand-gated. Build
logs accrete per phase in this file, interchange-plan style. Commits on
explicit instruction only.
