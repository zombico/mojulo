# Interchange — standard formats at the edge, recipes at home

Status: **I0–I4 LANDED (in working tree); I5 deferred/demand-gated.** The
planned sequence is complete — remaining open items are the standing
Blender/Godot gates recorded per phase. Drafted 2026-08-10 from the 3D-pipeline
analysis + blender-mcp research session. This is the boundary-layer plan:
doors cut into the closed loop so mojulo's 3D artifacts can be received,
verified, and helped by conventional 3D tooling — without the substrate
becoming conventional itself.

## Posture (read this before adding scope)

Interchange is a **side door, sized like one**. Mojulo's center of gravity
is the one-shot authoring loop — recipes, determinism, agent-yoked
composition. None of that survives export: a `.glb` is a snapshot, the
recipe stays sovereign. What the door buys is *admissibility* — the claim
"a conversation produced this rigged, walking, playable thing" becomes a
file any practitioner can open, instead of testimony inside our own
renderers. The latent bigger idea is the round-trip pattern itself:
**idiosyncratic sovereign substrate at home, standard formats at the
edges, the agent as the bilingual courier.** Build the pattern cleanly;
resist building a conventional-pipeline wing. Every phase below should
stay small enough that killing it would not hurt.

Doctrine carried over unchanged:

- Recipes, not renders, in the DB. Anything imported is a **bound derived
  artifact** — append-only under `data/outcomes/<ref>/`, with provenance,
  never a row that competes with the recipe. (Same posture as painted
  skins, image renders, voice WAVs.)
- Additive only. No existing emitted bytes change; char-net snapshots are
  re-pinned only for intended changes, and no phase here intends one.
- Seeded determinism everywhere mojulo authors; external tools' output is
  by definition non-deterministic and therefore always lands on the
  derived side of the line.
- Tool-description payload is nearly at ceiling (~379.8k / 381k in the
  current tree). New tool surface must be byte-frugal: thin schemas,
  manuals behind vocab cards / drawers.

## Current state (what already crosses the boundary)

- `export_model` (`lib/mcp/tools/sketches.js:955`) → **static** `.glb`
  (`lib/graph/scene/scene-gltf.js` `facesToGlb`: KHR_materials_unlit +
  COLOR_0 vertex colours, named per-group nodes, instanced repeats,
  embedded textures, PBR-tagged faces) and `.stl` (print soup). Eligibility
  = `WORLD_KINDS` membership (`lib/graph/worlds/world-kinds.js:221`).
- `export_game` → self-contained playable folder **plus `recipe/*.json`**,
  the sovereign re-mint format. This is already the best interchange
  artifact we ship and the provenance pattern the rest of this plan copies.
- Not crossing today: **rigs/clips** (GLB is a frozen frame), **figures**
  (excluded from eligibility; acknowledged follow-up at
  `sketches.js:~1281`), **carved-solid / css3d-turntable** (SVG/CSS
  dead-ends), **anything inbound**, **level semantics** (entities, spawn,
  colliders don't ride the GLB).

## The blender-mcp finding (why the plan is smaller than first proposed)

blender-mcp (PyPI v1.8.0, addon socket on `localhost:9876`) lets the
operator's agent drive Blender directly: `execute_blender_code` (arbitrary
`bpy`), `get_object_info`, `get_viewport_screenshot`. Consequences:

1. **The mesh-worker queue is unnecessary in v1.** The original proposal
   mirrored the image-render bicycle (request/pull/submit/accept). But the
   worker already exists — the agent itself, driving Blender synchronously
   over shared local paths. Only the **bind half** is missing (I3). The
   durable queue graduates only if unattended workers ever show up.
2. **Blender is the standing verification rig** for every phase: machine
   gate = import + scripted introspection via `execute_blender_code`;
   eyes gate = `get_viewport_screenshot`. Both without leaving the chat.
3. Operational cautions, recorded once: telemetry is **on by default** and
   uploads prompts/code/screenshots (`DISABLE_TELEMETRY=true` day one);
   the 9876 socket is unauthenticated code-exec — loopback only, same rule
   as the mojulo transport; 180s socket timeout + main-thread execution
   means heavy batch work goes through headless `blender -b -P script.py`
   runs, not the MCP socket.

## Phases

### I0 — Dungeon world kind · **LANDED (in working tree, pre-plan easy win)**

`kind:'dungeon'` wired into `WORLD_KINDS` (+`assembleDungeonScene` in
`architecture/dungeon-designer.js`), `compose_world` base `dungeon`
(identityAdapter, mint-time validation, advisory-never-gated flow checks),
view-vocab card `views/view-vocab/dungeon.md`, `scene-dungeon.js` mint +
6 tests. Export eligibility followed free from registry membership.
Not interchange per se — recorded here because it shipped from the same
analysis and is the template for "wire what's already built first."

### I1 — Animated GLB (the flagship)

Bake rig clips into glTF animation channels on `export_model`.

Why this is cheap here and nowhere else: the rigs are **rigid parts under
FK**, not skinned meshes (`figures/rig-bake.js`, `worlds/unit-rig.js`).
The runtime formula `M = T(head)·R(q)·T(-restHead)` decomposes *exactly*
into glTF node TRS: re-express each part's vertices relative to its bone's
`restHead` at export, then per key emit `translation = head`,
`rotation = q`. No skins, no inverse-bind matrices, no approximation.
The packed clip format (`unit-rig.js:~1691` — per-bone `[qx,qy,qz,qw,
hx,hy,hz]` at K keys) maps 1:1 onto rotation/translation samplers
(LINEAR; glTF normalizes lerped quaternions). One exporter covers all
three rig families (protoform figure, unit/suit, vehicle) — they share
the packed shape by construction.

Surface: `export_model({ ref, clips: ['walk','swing_n', ...] })` —
opt-in param, absent ⇒ byte-identical static export (char-safe).
`_all` sugar acceptable if description stays thin.

- Machine gate: Blender import + scripted assertion that expected
  animation channels exist with expected key counts and durations; or a
  glTF-validator pass. Codify as a repeatable script.
- Eyes gate: viewport screenshot mid-clip (does the suit *walk*, do the
  parts stay attached, does the saber swing read).

**I1 build log (2026-08-11, in working tree).** Landed as designed — the
FK→TRS decomposition held with no approximation. `facesToGlb` takes an
opt-in `clips` (names array or `'_all'`); each packed rig figure on
`payload.figures` (all three families — the static export had always
ignored `figures`, so this is purely additive geometry, no
double-export) becomes a wrapper node + one bone-local mesh node per
part (vertices − restHead, node `translation = restHead` at rest, both
part encodings decoded — legacy f32 soup and the indexed+quantized
`packRigMesh` form, the latter exporting real glTF indices), plus one
animation per clip: rotation + translation channel per boned bone,
LINEAR samplers over ONE shared input accessor. Decisions worth
remembering: **clip period = 1 s/cycle** (the ambient clock rule's
`rate ?? 1` in `worlds/controllable/rules-basic.js` — gait clips are
phase-normalized, distance-driven live, so there is no intrinsic
period; Blender retimes trivially); **looping clips emit K+1 keys**
(key 0 repeated at t=1s — glTF has no loop flag, and K keys alone would
drop the runtime's wrap segment K−1→0, a visible hitch at K=8); `once`
clips (baked 0..1 inclusive) export their K keys clamped, as-is;
**hemisphere continuity** enforced per bone at export (the runtime
corrects per-sample nlerp; packed curves do carry sign flips —
covered by a crafted-flip test); per-vertex specular + runtime-only
extras (armOverlays, muzzle, thrusters, head-look) deliberately
dropped. Surface: `export_model({ ref, clips })`, absent ⇒
byte-identical (pinned by a regression test), result gains
`animations` + `animated_figures` only when asked. Files:
`scene/scene-gltf.js` (decoders + `addRigFigure`/`addRigClip` +
`indexAccessor`), `mcp/tools/sketches.js` (param + thin schema/desc),
`scene/scene-gltf.rig.test.js` (15 tests incl. protoform end-to-end),
`tool-descriptions.test.js` (export_model allowlist 2104→2228, dated;
payload measured 379,944 / 381,000). Gates still owed before I2: the
Blender machine gate (import + channel/key assertion script) and the
mid-clip viewport eyes gate.

### I2 — Export eligibility widening

1. **`figure` as an exportable kind** — the acknowledged follow-up. Route
   the figure's flesh (ring-stacks → faces) through the standard payload
   so `export_model` covers it; with I1, an emoting figure exports
   animated. This is also the substrate piece the skin-to-3D follow-up
   (`get_skin_packet` "then" note) has been waiting on.
2. **`carved-solid` through the face list** — `extrudeProfile` already
   emits caps + bevel/side quads; the work item is cap triangulation
   (contours with holes). Check for an existing ear-clip/tessellation
   helper in the substrate before writing one.
3. `css3d-turntable`: only if free after (2) — single convex solids are
   the trivial case.

Gates: spike SVG/screenshot comparison per kind (exported GLB in Blender
vs the live render — same silhouette, same palette), plus the standing
export tests.

**I2 build log (2026-08-11, in working tree).** All three kinds landed —
`css3d-turntable` did fall out nearly free. Approach as designed: one
`WORLD_KINDS` row per kind (`worlds/world-kinds.js`, deliberately NOT
`walk` — object studies, the workbench/vehicle-instance posture; the
kinds test's WALK_KINDS literal pin is untouched), each row a thin
`resolve` over a new assembler:

- **figure** → `figures/figure-world.js` `assembleFigureScene`: one
  payload carries BOTH the static posed mesh (`figureRigSamples`' rest
  faces — the same buildPosedFigure+litFaces solve /svg renders, so
  pose/proto/garment/fluffs/setup dials all bind; garments DO have 3D
  form, no flesh-only limitation needed) and the packed FK rig
  (`bakeRigFigure` over the same samples' balanced-armature nodeFrames —
  NOT `bakeProtoformRig`, which drops pose/fluffs) with one `forward`
  clip from the stored motion vocabulary (walk/sprint/wave/emote/
  keyframes; no motion stored → default walk). The `/svg` camera rides
  along via a new `figureWorldCamera` export (figure-render.js). The
  double-export problem (static body + animated rig = a frozen ghost
  inside the walking figure) is solved data-driven: the rig declares
  `embodies:'body'` and `facesToGlb` drops that static face group ONLY
  on the clips path (clips absent ⇒ `rigFigs` empty ⇒ byte-identical —
  the char-safety line holds). Known limits, noted in code: rigid parts
  approximate the spine warp; the /svg screen-x mirror can't apply in
  3D; the bound painted skin is NOT yet baked into the GLB
  (get_skin_packet's `then` string updated to say exactly that).
- **carved-solid** → `effects/carved-solid-world.js`
  `assembleCarvedSolidScene`: replicates renderFrame's geometry +
  shading kernels exactly (same contours/extrusion/`place`/material
  math incl. cel/specular/emissive/inner-glow at the still's phase, vs
  the exported `CARVE_VIEW` frame) so the GLB matches the SVG palette;
  cap tessellation reuses the EXISTING ear-clipper
  (`polygonizer/triangulate.js` `triangulateRings`, relief-faces'
  helper — none written). Outer `fx` layers + halo dropped (screen
  embellishments, billboard doctrine). Backfacing walls kept (closed
  solid). Text shapes inherit the SVG path's system-font dependence.
- **css3d-turntable** → `assembleSolidTurntableScene` beside
  `planSolidTurntable` (worlds/solid-turntable.js): plan faces remapped
  CSS→z-up by the proper rotation [x,z,−y], first-frame vexar shade
  baked.

Shared gotcha worth remembering: `faceListToMesh` consumes QUADS only
(3-corner faces are silently skipped, n-gons truncated to 4) — cap
triangles and pentagon faces pad/lower to `[a,b,c,c]` quads
(`padTrianglesForWorld`'s convention, the dungeon precedent). Also
pinned in tests: `triangulateRings` has a known ear-clip degeneracy when
two holes share an exact max-x with bridge segments collinear on hole
edges (axis-aligned synthetic squares) — real glyph contours never
produce it (O/A/B/BO pins pass); left unfixed because relief-faces'
emitted bytes ride the same code.

Files: `worlds/world-kinds.js` (+3 rows), `figures/figure-world.js`
(new), `effects/carved-solid-world.js` (new), `worlds/solid-turntable.js`
(+assembler), `polygonizer/figure-render.js` (+`figureWorldCamera`),
`scene/scene-gltf.js` (`embodies` ghost-drop, clips-gated),
`mcp/tools/sketches.js` (eligibility copy: description now names the
three kinds; refusal reason + skin-packet `then` updated). Tests:
`polygonizer/triangulate.test.js` (8), `worlds/world-scene.export-kinds.
test.js` (10 — incl. figure animated-GLB end-to-end + static
byte-identity, carved caps-with-holes closure, turntable). Standing nets
green: scene-gltf 10 static + 17 rig, world-scene.kinds 6 (no pin
extended — the new kinds are fixture-less like dungeon/edifice),
emit-channels char 47, context 44. `tool-descriptions.test.js`:
export_model allowlist re-pinned 2228 → 2285 (dated); payload measured
**380,001 / 381,000**. Side effect worth knowing: the three kinds now
also serve `/world` (live orbit) — additive, nothing consumed
`WORLD_KINDS` membership for refusals besides export. Gates still owed
(with I1's): Blender import + channel assertions, mid-clip screenshot,
and the per-kind GLB-vs-SVG palette comparison.

### I3 — The bind-back door (inbound derived geometry)

Mirror the image loop's direct-bind tool, not its queue:

- **`bind_mesh_render(ref, glb_path)`** — accepts an externally refined
  GLB as a bound derived artifact: append-only copy under
  `data/outcomes/<ref>/mesh-<n>.glb`, provenance (source tool, date,
  content hash) beside it. Naming/shape parallel to `bind_image_render`.
- **`meshRef` body source** in world `figures{}`
  (`worlds/world-scene.js:~273`, beside `figureRef`/`unitRef`/
  `vehicleRef`): places a bound mesh in a world as static (or
  rigid-transform) geometry. The recipe stores only the ref.
- Deferred until demand: request/pull/submit/accept queue for unattended
  workers; re-rigging imported meshes (an imported mesh is scenery/prop
  first, a body later if ever).

Gates: round-trip spike — export a suit (I1), refine in Blender via
blender-mcp (e.g. bevel a shoulder), bind back, place via `meshRef`,
walk the world, screenshot. Machine: content-hash + GLB parse on bind.

**I3 build log (2026-08-11, in working tree).** Both halves landed as
designed. **`bind_mesh_render(ref, glb_path, note?)`** rides sketches.js
beside its direct-bind siblings: append-only `data/outcomes/<ref>/
mesh-<n>.glb` (`scene/mesh-store.js`, the render-store pattern —
timeless `n` from disk) + provenance sidecar `mesh-<n>.glb.json`
(source path, ISO date, sha256, byte size, note). The machine gate at
the door is not just structural (magic / version / declared length /
chunk layout / JSON parse — all with distinct loud errors) but a FULL
geometry decode: a compressed, quantized, sparse, or triangle-less GLB
is refused before anything touches disk. **`meshRef`** is the sixth
figures-map body source (world-scene.js, beside figureRef / unitRef /
vehicleRef / polygomerRef) — but deliberately NOT a body: the bound GLB
is lowered SERVER-SIDE at resolve time into `payload.faces` (static
scenery; re-rigging stays deferred per the plan), so no runtime GLB
loader ships and zero emitted bytes change — the char line holds by
construction. The lowering is the new reader `scene/scene-gltf-read.js`
(pure Buffer, no deps, the writer's mirror): indexed + soup TRIANGLES →
padded `[a,b,c,c]` quads (padTrianglesForWorld's convention), COLOR_0
(float / normalized u8/u16) else material baseColorFactor → `fill` +
per-corner `cornerFills` (linear→sRGB, the exact inverse of face-mesh's
srgbToLinear — flat hexes round-trip byte-exact), node TRS *and*
`matrix` applied down the scene tree, then the global y-up→z-up inverse
of the writer's root rotation. Placement `transform` ({ pos, rotZ,
scale } — the instanced-repeats convention; position/rotation accepted
as aliases) bakes into the corners; decode is LRU-memoized per
(path, mtime, size) with clone-on-read (the AO_CACHE discipline —
cached templates never leak into mutating channels). Because the block
runs BEFORE the material/AO/texture channels, a bound mesh picks up
`ao:true` etc. for free, and because it lands in `payload.faces` it
rides every consumer (svg / scene / world / export) unchanged. v1
limitations noted in code, not solved: textures dropped (baseColor
only), animations/skins/morphs ignored, PBR flattened to baked colour.
Finding worth remembering: the writer's `decollideFaces` staggers a
padded quad's two coplanar split tris by ~1.5e-3 on RE-export, so the
double round trip is stagger-tolerant while the primary writer→reader
gate is exact to float32. Files: `scene/scene-gltf-read.js` (new),
`scene/mesh-store.js` (new), `mcp/tools/sketches.js` (handler + thin
schema), `worlds/world-scene.js` (meshRef block + body-loop skip),
`mcp/tools/context.js` (world form-drawer row) + `context.test.js`
(RING10 partition). Tests: `scene-gltf-read.test.js` (8 — round-trip
fidelity incl. cornerFills, hand-built indexed/TRS/matrix fixtures,
normalized colours, baseColor fallback, corruption + Draco refusals,
LRU isolation), `bind-mesh-render.test.js` (9 — bind + sidecar +
append-only numbering, non-GLB/truncated/missing-sketch refusals,
meshRef end-to-end through resolveWorldScene + export_model, refusal
pointers). Standing nets green: scene-gltf 10 + 17, export-kinds 10,
world-scene.kinds 6, emit-channels char 47, context 44 (registry
sweep), controllable-world 262. `tool-descriptions.test.js`: the new
tool cost 889 bytes (494-char description) and FIT the existing pin —
payload measured **380,891 / 381,000**, no ceiling re-pin, no trims.
Gates still owed (with I1/I2's): the live Blender round trip —
export → blender-mcp bevel → bind → walk → screenshot.

### I4 — Level-as-layout (semantic GLB)

Make an exported world legible as a *scene*, not just a mesh:

- glTF `cameras` from the payload's camera list (Blender opens with
  mojulo's framing).
- Named nodes per entity/figure placement.
- Namespaced `extras` (`moj:*`): spawn point, collider boxes, entity
  rule/body refs, game-contract summary.
- Ship `recipe.json` beside the `.glb` in the outcome folder + a
  provenance README — parity with `export_game`'s pattern.
- A short Blender/Godot import note in the README rather than bespoke
  importer plugins; blender-mcp consumers get agent-authored import
  scripts live, engines get the documented convention.

Gate: import an arena/dungeon level into Blender and into Godot; verify
placements and spawn land where the live world puts them.

**I4 build log (2026-08-11, in working tree).** Landed as designed, with one
deliberate posture decision: the enrichment is **default-on, no new tool
parameter** (payload headroom was 109 bytes; and a GLB is a derived snapshot
regenerated on demand, not a pinned surface — enriching it is a conscious,
documented output change of the EXPORT, never of any emitted world page; the
emit-channels char net stayed untouched-green). Semantics derivation is the
pure sibling `scene/scene-gltf-level.js`; `facesToGlb` consumes it after the
geometry pass:

- **Cameras**: every payload camera with a two-point `worldFraming`
  ({ cameraPosition, lookAt, horizontalFov }) becomes a glTF perspective
  camera on a posed `cam:<name>` node in the pre-root z-up frame (the y-up
  root rotation converts it like geometry). Pose is a lookAt solve (local −Z
  at the target, +Z-world up with a +Y fallback when looking straight
  up/down); `yfov` is the /world horizontal→vertical solve (scene-three
  `verticalFov`) at the payload viewBox aspect, in radians; near/far mirror
  the world camera (0.1 → 8000). Malformed entries are skipped.
- **Entity nodes**: one identifiable node per `payload.entities` placement.
  Where the entity's body is a rig this export actually baked (the clips
  path), the I1 wrapper node IS the placement — it gains the entity TRS
  (translation = pos, rotation = heading + the runtime's `yawOffset ?? −π/2`
  facing convention) and the extras, so the figure imports standing at its
  spawn facing its heading; every other entity (static path, non-rig body, a
  rig already claimed by an earlier entity sharing the figure) becomes an
  empty TRS `entity:<id>` node. Extras per node: `moj:entity` (id),
  `moj:rule` (rule.type), `moj:body` — the manifest-level source ref when one
  exists (a new `payload.figureSources` map recorded by world-scene.js:
  `unitRef:`/`figureRef:`/`vehicleRef:`/`polygomerRef:`/`meshRef:` — payload-
  only metadata, ignored by emitThreeWorld's destructuring, zero page bytes).
- **Scene extras** (`scenes[0].extras`, small + JSON-plain): `moj:spawn`
  (walk.spawn wins, else the piloted entity — pilot > pilotable > first),
  `moj:colliders` (the analytic AABB `{min,max}` list), `moj:game` (contract
  digest: levelRef, results, `type→slice` event signatures, consumed slices).
- **Provenance parity**: `export_model` with `write:true` now writes into the
  sketch's OUTCOME folder — `data/outcomes/<ref>/model.<format>` beside
  `recipe.json` (the sovereign manifest, export_game's exact writeRecipe +
  sha256/16 hash pattern) and a short `README.md` (refs/kind/hash/date,
  re-mint note, and the Blender/Godot import note: y-up root over z-up
  recipes, 1 s/cycle clip timing, the `moj:` extras namespace). All three
  overwrite in place on re-export — the model file was always an
  overwrite-in-place snapshot (previously at `data/exports/<ref>.glb`) and
  its provenance pair tracks it; the folder's append-only convention applies
  to BOUND artifacts (`mesh-<n>.glb`, `render-<n>.png`), whose names never
  collide. Result gains `dir`, `download_url` (`/outcomes/<ref>/model.glb`),
  and `cameras`/`entity_nodes` counts; the only description spend was
  rewording export_model's `write` param (payload 380,891 → **380,882 /
  381,000** — net negative, no ceiling re-pin).

Regression-test rationale: I1's clips-absent regressions pin RELATIVE byte
identity (payload with rig vs rig stripped), not literal static bytes, so
they hold verbatim under enrichment — both sides enrich identically. The
invariant is additionally restated under enriched output in
`scene-gltf.level.test.js` (entities + cameras + rig, clips absent ⇒ no
animations, no wrapper node, byte-identical to the rig-stripped payload,
placement still present as an empty node). The I3 reader needed no change —
camera/empty nodes carry no `mesh` and extras are never read — and the
enriched round trip is pinned in the same file. Files:
`scene/scene-gltf-level.js` (new), `scene/scene-gltf.js` (addCameraNode +
rigWrappers reuse + the I4 block), `worlds/world-scene.js` (figureSources),
`mcp/tools/sketches.js` (outcome-folder write + recipe/README + result
fields), `mcp/tools/exports-dir.js` (comment: beats-only now). Tests:
`scene/scene-gltf.level.test.js` (12), `mcp/tools/
export-model-provenance.test.js` (6). Standing nets green: scene-gltf 10 +
17, scene-gltf-read 8, bind-mesh-render 9, export-kinds 10, world-scene.kinds
6, emit-channels char 47, context 44, controllable-world 262, export-game +
tool-descriptions untouched-green. Gate still owed (with I1–I3's): the live
Blender + Godot level import — verify placements/spawn land where the live
world puts them.

### Gates closed — live Blender verification (2026-08-11)

Blender 5.2 LTS installed on the host; all owed I1/I3/I4 gates ran
headlessly (`blender -b -P`, no blender-mcp needed) against the real
`sk_ms_tutorial_rising` export (66 MB, 14 roster figures, 351 clips).

- **I1 machine gate PASSED**: Blender imported all **351 animations**;
  probe clip `g_multi:forward` shows 21 bone tracks, **13 keys (the
  designed K+1 wrap key)**, duration **exactly 1.0 s** (the 1 s/cycle
  mapping). One Blender-5.x note for future scripts: `Action.fcurves`
  is gone (layered actions) — walk `layers→strips→channelbags`.
- **I4 machine gate PASSED**: `cam:view 0` imported as a real camera;
  `moj:entity`/`moj:rule`/`moj:body` readable as custom properties on
  the entity-claimed wrapper nodes (`unitRef:` provenance intact);
  scene-level `moj:spawn`/`moj:colliders`/`moj:game` present. Entity
  wrappers stand at their spawns with correct facing.
- **Eyes gate PASSED** (headless Workbench render, FLAT + VERTEX
  colour = the faithful baked look): the mk2 renders mid-stride in the
  depot — walk pose correct, parts attached, shield re-grip and pink
  V78 saber legible. Candidate site hero shot at
  `docs/images/blender-import-mk2.png` (untracked).
- **I3 round trip PASSED**: Blender edit (shoulder-cap scale) →
  Blender's own GLB re-export → `glbToFaces` decodes it cleanly
  (101,100 padded faces, 660 distinct fills — COLOR_0 survived
  Blender's round trip), i.e. the exact decode `bind_mesh_render`
  gates on accepts real Blender output.

Two findings for a small I4 follow-up pass (recorded, not yet built):

1. **Unplaced roster figures stack at the origin.** A hangar-roster
   world exports every figure in the bank; entity-claimed ones stand
   at their spawns, the rest pile up at (0,0,0) as a visual clump.
   Candidate fix: space unclaimed figures in a `moj:` lineup row
   (hangar-style) or default `clips` exports to placed-entities-only
   with an explicit roster opt-in.
2. **All weapon meshes render simultaneously** (drawn + stowed forms):
   draw/stow visibility is runtime state the export doesn't carry.
   Candidate fix: honour the rig's initial visibility state at export,
   or tag stow variants for importer-side hiding via extras.

**Premium-render spike (2026-08-11, evidence toward I5's blender leg).**
A headless Cycles studio portrait of the mk2, rendered straight from the
export (materials rebuilt as one Principled BSDF over each mesh's
COLOR_0, three-area-light rig, Metal GPU, ~1 min): the identical asset
reads as box-art — soft shadows, floor reflection, rim separation —
with zero pipeline changes. Proves the "Blender as premium bake/render
worker" direction: existing PNG slots (hangar portraits, menu art,
covers) can carry Cycles renders of the real suits today; the
whole-level GI-bake-to-vertex-colour overlay remains the candidate
feature. Candidate asset: `docs/images/cycles-portrait-mk2.png`
(untracked); script pattern in the session scratchpad (`portrait.py` —
parameterize ref/figure/clip/frame if promoted to a repo script or
catalyst). Note for such scripts: stow-form weapon meshes must be
hidden by name (the runtime-visibility finding above) — the "extra box
at the pelvis" an operator sees in Blender is the stowed saber/bazooka
parked at the resting right hand, confirmed by node inspection.

**Local Blender worker — hero-object leg LANDED (2026-08-11).** The premium-bake
round trip is now one repeatable command, not scratchpad scripting:
`control/scripts/blender-bake.mjs` (driver, mirrors `voicegen-speak.mjs`) +
`blender-bake.py` (headless Cycles worker) + `docs/local-blender-worker.md`.
Same posture as the local image/voice workers: optional, operator-hosted,
produces bound derived artifacts, holds no substrate state. Flow: `export_model`
→ blender-bake (Cycles diffuse GI → vertex colours) → mesh-store slot (the
`bind_mesh_render` machine gate, `glbToFaces`, runs before the bind) → `meshRef`
placement. Verified end to end on the mk2: `--glb <tutorial world> --hero
gframe_mk2_multi --clip gframe_mk2_multi:forward --bind-to
sk_gframe_mk2_unit_v1_multi` → `mesh-5.glb` bound with `worker: blender-bake`
provenance; flat vertex-colour preview (what mojulo renders) shows clean white
armor + baked plinth shadow. The `statue` preset bakes in the two eyes-gate
findings: (1) ambient fill 1.0 + no-cast `shoulderCap`/`shield` fixes the black
biceps (occlusion wells + double-lighting; **not** the arena `contrast` stamp —
that was investigated and cleared); (2) a dense grid plinth so the vertex-baked
shadow has vertices to live in. Owed next increments (not this leg): a resolver
touch so a sketch renders its baked binding AS a display variant (today you place
it via `meshRef` in a world — see the `sk_ou67r4rwxx` exhibit); a `--preset
turntable`; and the whole-level unshaded-export (the flat-light substrate change
— the real prize, deferred per the scope call). Adjacent substrate bug found:
`update_sketch` spins the event loop when handed a world-kind (`controllable`)
manifest — it should refuse world kinds with a pointer to `compose_world`.

**Unshaded export mode LANDED (2026-08-11) — the flat-light substrate change, the real prize.**
A GLB can now be exported carrying RAW ALBEDO (no Lambert shading, no AO, no
procedural-material/weathering darkening) as a clean base for Blender GI baking, via
`resolveWorldScene(sketch, { unshaded:true })`. The whole thing rides ONE mechanism: a
`FLAT_LIGHT = makeLight({ ambient:1, diffuse:0 })` in `vexar.js` — litFactor ≡ 1 for every
normal, so `shadeHex`/`shadeFace` return the base albedo untouched. `resolveWorldScene` accepts
`viewOpts.unshaded`: it puts `light: FLAT_LIGHT` on `ctx` (object-kind assemblers shade flat),
and SKIPS the three darkening channels (`resolveFaceMaterials`, the `payload.ao` bake, and
`weatherRigParts`). All additive + guarded — absent the flag every output byte is identical (the
emit-channels char net, world-scene.kinds/export-kinds, scene-gltf static+rig, all untouched-green;
no snapshot re-pins). The mk2 (unitRef rig) path is the load-bearing thread: `bakeUnitRig` gained a
`light` opt threaded into `lowerAssemblerBuild → walkAssembler → bakeOriented`, which had HARDCODED
`WORKBENCH_LIGHT` (default preserved → byte-identical); the world-scene unitRef path additionally
forces `ao:false, shade:false, contrast:null, material:null` into the bake opts so the rig's own
baked darkening is off. Light-seam widenings needed: `workbench.js`
(`assembleWorkbenchScene`/`studioSceneFromFaces`/`bakeBoundSkinFaces` now thread the passed light),
`workbench-assembler.js` (`bakeOriented`/`walkAssembler`/`lowerAssemblerFaces`/`lowerAssemblerBuild`/
`assembleAssemblerScene`), `polygomer-world.js` (`assembleManjiTreeWorld`), and the six object-kind
wrappers in `world-kinds.js` (pass `light: ctx.light`). Consumer: `blender-bake.mjs` gained
`--unshaded` (default ON; `--shaded` opts out) — when unshaded + `--ref` it GENERATES the unshaded
source GLB itself (`resolveWorldScene({unshaded:true})` → `facesToGlb({clips:'_all'})`, under the
`@/` alias loader the stdio entry uses) instead of reading the sketch's shaded
`data/outcomes/<ref>/model.glb`; the `--glb` operator path is used as-is (pass an unshaded export).
The `statue` preset's ambient-fill/no-cast double-lighting compensation is no longer strictly needed
with an unshaded input (noted in a comment; kept — still fills deep wells). DELIBERATELY NOT added to
the `export_model` MCP tool schema — the tool-description payload ceiling has ~118 bytes free
(380,882/381,000) and a schema field would blow it; the capability lives in
resolveWorldScene/facesToGlb + the worker only (tool-descriptions.test.js untouched-green, payload
still 380,882). Environment-kind honesty: rooms/suites/cities/floorplans/dungeons shade through
scene-css3d's baked traced-diffusion model that FLAT_LIGHT can't reach, and the other object studies
(figure/carved-solid/css3d-turntable) bake their own lighting internally — for all of these unshaded
is a silent no-op, surfaced as a non-fatal `payload.unshadedWarning` (not chased here; a separate,
larger change). New test: `control/lib/graph/worlds/unshaded-export.test.js` (7 green — raw-albedo
object + rig faces, AO/material skip, and default-path identity).

**Mirror-normal fix (2026-08-11) — the real root cause of the "dark/recolored parts".**
The mk2's black chest + asymmetric foot wedges/ankles/knees were NOT the diffuse-GI
albedo-crush first theorized (the ambient-boost fix failed, which was the tell). Root
cause: the suit is **mirror-built**, and mirroring **flips face normals**; a Cycles
diffuse bake shades by normal, so flipped-normal parts baked their unlit BACK → black,
asymmetric per part (one wedge red, its mirror black). mojulo's own renderer tolerates
this (clamped Lambert → dim-but-right-hue), which is why the flat mk2 looks fine and
only the bake broke. Two-part deterministic fix, both landed:
1. **Export (`vexar.js`)**: `FLAT_LIGHT` gains a `flat:true` marker; `shadeHex`/
   `shadeHexMat` short-circuit to raw albedo under it. Previously material faces
   (the wedges/ankles carry a per-part `material`) kept a normal-dependent term even
   under unshaded (a material's ambient/diffuse OVERRIDE the light), so mirror-flipped
   normals exported asymmetric albedo (bright red vs dark maroon). Now unshaded emits
   true mirror-symmetric albedo. Char-safe: only the `light.flat` path changes
   (FLAT_LIGHT = unshaded only); emit char-net + materials tests green.
2. **Bake (`blender-bake.py`)**: the deeper root cause — mojulo faces are DOUBLE-SIDED
   with NO authored normals, and `facesToGlb` writes no NORMAL attribute, so Blender
   reconstructs normals from WINDING; mirror-built parts wind backwards → flipped
   normals. A camera render hides this (Cycles auto-orients toward the camera) but a
   BAKE cannot, so flipped faces bake their unlit back → black. **No Blender-side fix is
   universal** — three were tried: `normals_make_consistent` (REJECTED: propagates
   across topology, mangles non-manifold parts), a per-face centroid flip (fixes the
   chest, leaves the LEGS black), and a Backfacing-driven shader normal (fixes the legs,
   leaves the CHEST black). The two working methods fix COMPLEMENTARY halves — proof the
   geometry has no consistent "outward" to key off. `blender-bake.py` now carries NO
   normal handling (documented there); `mesh-8` (bound, per-face variant: blue chest,
   dark legs) is the last state on `sk_gframe_mk2_unit_v1_multi`.

**The real fix (deferred, deterministic):** author outward normals in mojulo's geometry
layer (lathe/assembler parts have a well-defined outward from their axis) and export
them as the GLB NORMAL attribute, so Blender never guesses. That fixes ALL parts and ALL
mirror-built suits at once. Until then, the RENDER path (portrait.py) is robust to this
(renders auto-orient normals) and is the right tool for premium suit STILLS; baking is
best reserved for static scenery. The export fix #1 (FLAT_LIGHT flattening material
faces) is kept — it is correct and char-safe regardless. Correction to the record: the
earlier "unshaded strips tone passes / albedo dynamic-range crush" framing was wrong —
the dark parts are flipped normals, and reliably fixing them needs authored normals.

### I5 — Deferred / demand-gated

- **Motion interchange**: BVH / glTF-animation import → per-frame DOF fit
  against the biped bone table → stored clip recipe (sparse keys, like
  `emote_figure` mints). Inbound mocap then works on every biped body by
  construction. Reverse (clip → BVH) nearly free after I1.
- **Asset-pack export** for a game project: batch I1/I4 outputs + WAVs +
  baked sprites into one provenance-stamped engine-handoff folder.
- **`blender-refine` catalyst**: ship the I1→I3 round-trip as a curated
  workflow once the bind tool exists; record blender-mcp in the
  capability registry (`record_mcp_capabilities`) at the same time.

## Rejected

- **OBJ export** — GLB + STL cover DCC, engines, and print; OBJ adds
  surface without audience.
- **Mesh-worker durable queue in v1** — superseded by agent-driven
  Blender (see finding above).
- **Skinned-mesh export** — the substrate deliberately has no vertex
  skinning; exporting fake skins would misrepresent the artifact.
- **Any inbound path that writes into recipes** — imported geometry is
  derived, full stop.
- **Texture-atlas skin export** (re-projecting `skin_polygomer`'s
  screen-space registration into UVs at export) — genuinely valuable but
  parked behind I1–I3: it serves the same audience and can ride a later
  pass once the door is proven used.

## Sequencing & batch hygiene

Order: **I1 → I2 → I3 → I4**, each its own reviewable batch, each with
its machine + eyes gate before moving on. I0 is already in the tree and
should be committed (or folded) consciously — note the working tree
currently mixes it with the motion-comic M0 and arena batches, and
`tool-descriptions.test.js` carries one pre-existing unblessed failure
(`export_game` description 1411 > 1253) belonging to the arena batch.

Committing any batch supersedes its branch-state section in
`docs/STATUS.md` — rewriting STATUS is part of that commit, per repo
contract.
