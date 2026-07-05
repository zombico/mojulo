# renderer ladder — raising the ceiling of the visual substrate

Status: PROPOSED. Sequenced ladder; each phase is independently shippable and
independently valuable. Later phases assume earlier ones only where stated.

The planned work already on the books (world-scene registry, fractal-condo,
dungeon-designer texture tiles) *widens* the substrate — more kinds, cleaner
dispatch. This plan *raises its ceiling* on the three axes the architecture is
currently capped on:

1. **Visual depth** — flat per-face Lambert reads as elegant paper-craft; corners,
   crevices, and object-meets-ground junctions carry no darkening.
2. **Inhabitants** — figures are frame flipbooks; nothing in a world can walk
   somewhere, reach toward, or match gait to velocity.
3. **The agent's loop** — interactivity is a one-way gift to the human. The agent
   mints a walkable world but can never traverse, verify, or narrate it.

## Invariants (unchanged by every phase)

- The stored manifest stays a tiny deterministic recipe. Same recipe →
  byte-identical world. Nothing here persists baked geometry.
- One engine-agnostic face payload out of `resolveWorldScene()`
  ([worlds/world-scene.js](worlds/world-scene.js)), fanned to every emitter.
  No phase may fork the payload per backend.
- Lighting stays **baked**. No runtime lights, no PBR, no per-frame shading.
  The World keeps rendering UNLIT (`MeshBasicMaterial + vertexColors`,
  [scene/scene-three.js](scene/scene-three.js)).
- No asset import, no editor. Geometry and now animation/audio come only from
  mojulo's own generators; recipes remain the single source of truth.
- Live, non-deterministic behavior stays fenced in explicitly-marked channels
  (`nonBakeable`), exactly as physics is today.

## Phase 0 (prerequisite) — land the world-kinds registry

[worlds/world-scene-registry.plan.md](worlds/world-scene-registry.plan.md), already
planned. Phases 1, 3, and 4 each add a per-kind capability (AO participation,
traversal probes, instancing support) that must hang off the kind descriptor —
not off a fourth and fifth side table beside `WALK_KINDS` and
`FOG_OCCLUDER_BOXES`. Do the registry first so this plan never recreates the
problem that plan exists to fix.

## Phase 1 — baked ambient occlusion (vexar-AO)

**Status: LANDED** (first pass). What shipped vs. the design below:

- [effects/ao-bake.js](effects/ao-bake.js) — `bakeAmbientOcclusion(faces, opts)`: deterministic
  SDF normal-tap AO sampled **against the world's own faces** (grid-culled point-to-quad
  distance), not per-kind occluder boxes — so it needs NO registry descriptor and works on every
  mesh kind today. Coplanar neighbours self-cancel by construction (flat floors stay flat).
- Faces gain per-corner `vao` multipliers; [figures/face-mesh.js](figures/face-mesh.js)
  `faceListToMesh` folds them into the vertex colours (quad, clip/radius-bilerp, and lit-texture
  paths) — so the World, PNG/MP4 bakes, and the .glb export all inherit AO from the one edit.
- Opt-in `ao: true | { strength, radius, steps }` manifest channel in
  [worlds/world-scene.js](worlds/world-scene.js), beside `walk`/`fog`. Not defaulted on for any
  kind yet. The channel sets `payload.ao`; the bake itself runs in **emitThreeWorld and
  facesToGlb, after facade-card expansion + de-collision** — baking in world-scene was tried
  first and missed every card-expanded sub-face (city facades showed no AO; the sub-faces don't
  exist pre-expansion). Sample the faces the mesh is actually built from.
- Example output: before/after pairs (room corner, street-level fractal-city) in
  [lite-template/integration/0703/spike-output/ao-bake/](../../../lite-template/integration/0703/spike-output/ao-bake/).
  An aerial condo shot showed nothing — AO's ~1.5-unit reach is invisible from tower-height
  distance; demo it at eye level, where it lives.
- Measured: 7k-face fractal-city ≈ 120ms at the default cap (kPerCell=64); per-cell overflow
  reads lighter-than-truth and is counted in `aoStats` (never silent).
- Known limitation: occlusion is sampled at face CORNERS only, so a crate mid-floor darkens its
  own base but casts no pool onto a single-quad floor (no vertex there to darken). The floors
  that matter (tessellated terrain, tiled interiors) have the vertices; a `subdivide` option for
  large receiver quads is the natural follow-up if the pool matters.
- Follow-ups: face-average `vao` fallback in the CSS-3D/SVG emitters; per-kind `ao` defaults once
  the world-kinds registry (Phase 0) lands.

**Goal.** A second baked lighting term beside Lambert: geometric occlusion
darkening in corners, crevices, and contact junctions. Because it bakes into the
same face colors, it lands in **all backends at once** — SVG stills, CSS-3D,
three.js World, glTF export, MP4 — with zero runtime cost.

**Why this is philosophically free.** The whole system already commits to
server-baked lighting (`makeShade`, [scene/scene-css3d.js:263](scene/scene-css3d.js);
moonlight/tint variants beside it). AO is camera-independent, exactly like the
Lambert term — it depends on geometry only, so it survives orbit, walk, and
capture cameras untouched.

**Model.**

- Occluder field: reuse the grid-culled box-field SDF from
  [effects-occluder.js](effects-occluder.js) (built for the fog overlay) as the
  occlusion query structure. Where a kind already declares fog occluder boxes,
  AO comes for free; the registry descriptor gains `occluders(manifest)` as the
  shared source for both consumers.
- Sampling: per sample point, a small fixed hemisphere kernel (8–16 rays,
  seeded/deterministic, NOT `Math.random`) against the SDF; occlusion factor
  multiplies the baked color. Distance-attenuated so it reads as contact
  darkening + crevice ink, not global gray.
- **Granularity is the real work.** Today color is flat per face. AO wants
  per-vertex: sample at face corners, emit per-vertex colors, let the GPU
  interpolate. The three.js and glTF paths already speak per-vertex `COLOR_0`
  arrays ([scene/scene-gltf.js:152](scene/scene-gltf.js)) — flat shading today is
  a producer convention, not a consumer limitation. CSS-3D and SVG cannot
  gradient per vertex cheaply: they take the face-average AO (flat darkening).
  Payload change: faces gain optional `vcolors` (4×RGB); emitters without
  per-vertex support fall back to `color`.
- Recipe surface: `lighting: { ao: true | { strength, radius } }` on the
  manifest; default on for interior kinds (rooms, dungeons, condos), off for
  open landscapes where it buys little.

**Cost control.** AO runs at geometry-solve time on every render (nothing is
persisted). Budget it: sample only faces within `radius` of another occluder
(grid query), cap kernel size, and profile against the largest fractal-city
manifest before defaulting anything on.

**Verify.** Golden-value tests on a fixture room (corner vertex darker than
face center by expected factor; determinism: two solves byte-identical).
Visual: `/figure-study`-style before/after PNG bake of a dungeon chamber.

**Exit criteria.** A dungeon-designer chamber and a suite-layout room render
with visible corner/contact darkening in World, PNG, and `.glb`, same recipe,
no runtime cost change.

## Phase 2 — smooth figures: frame interpolation, then runtime pose curves

**Goal.** Move figure animation delivery from "select among baked frames" to
"interpolate," so figures can blend gaits with speed, walk somewhere, and hold
procedural poses — without runtime skinning or asset import.

**Today — more exists than "flipbooks" suggests.** The authoring side already
has a real pose system: the mega-boy spike writes locomotion as pose
*functions* returning joint DOFs — `walkPose(p)` / `strafePose(p)` (hip
pitch/yaw, knee flexion, shoulder swing, trunk/pelvis counter-rotation) driving
`buildMegaBoyVajraFaces(pose)`
([figures/megaboy-spike.js:52](figures/megaboy-spike.js)). Server-side FK and
clip authoring are done. The gap is delivery: `bakeMegaBoyClips()` samples each
clip at N discrete frames shipped as `figure-frames` (Uint16 corners + Uint8
color, re-expanded per tick, [scene/scene-three.js:1061](scene/scene-three.js),
:2328), and the controllable rule hard-switches clips by dominant axis
([worlds/controllable-world.js:156](worlds/controllable-world.js)). Frame
stacks are also the size ceiling: ~17k faces/frame puts a naive 24-frame loop
past 75MB (packing comment, [scene/scene-three.js:2664](scene/scene-three.js)).

**Rung 1 — corner interpolation (cheap, no FK in the page). LANDED.** The baked
frames have **fixed topology** — the same corner list every frame; that
invariant is what makes the Uint16 packing work. The page lerps corner
positions between adjacent frames of a clip and crossfades between locomotion
modes (forward↔strafe↔idle, outgoing pose frozen and eased out over ~0.18s).
What shipped:

- Pure math in [worlds/controllable-world.js](worlds/controllable-world.js):
  `gaitFramePair` (continuous wrapping phase → bracketing frame pair + lerp t)
  and `advanceGaitMix` (dt-driven crossfade bookkeeping) — node-tested in
  [worlds/gait-interp.test.js](worlds/gait-interp.test.js), emitted into the
  page via the existing `buildControllable.toString()` single-source pattern.
- The figure body now owns ONE live BufferGeometry; each sync writes the
  blended pose into it (scene-three.js `__figAccum`/`__syncEntity`) instead of
  swapping whole per-frame geometries.
- **Correspondence gate — the discovery of this rung.** Frame-pair lerping
  assumes face index i is the same chip in every frame. FK-posed builders keep
  that (mega-boy: median inter-frame corner displacement ≈ 0.01 of figure
  height) but the protoform render pipeline RE-ORDERS chips per frame
  (≈ 0.19 — a mid-lerp pose shreds into a chip cloud). `packFigureFrames` now
  measures the worst adjacent-pair median displacement and gates the lerp at
  0.05 (`FIG_LERP_MEDIAN_MAX`); gated figures fall back to the legacy frame
  snap, so nothing regresses. Making the protoform bake order-stable (or
  rig-delivered) is exactly rung 2's job.
- Verified headlessly (capture mode + `__mojCtrl.step` at fixed dt): mega-boy
  produces MORE distinct rendered poses than its 8 baked frames (sub-frame
  poses exist — snapping can never exceed frame count); protoform yields
  exactly its 6 frames (gate active, no shredding). Stride samples in
  [lite-template/integration/0703/spike-output/gait-interp/](../../../lite-template/integration/0703/spike-output/gait-interp/).

**Rung 2 — runtime pose curves (bones without skinning).**

- Bake **pose curves**, not frames: per clip, per joint, a few keyed floats
  (the same DOFs `walkPose` already emits, as sparse keys over normalized
  phase) + a `rig` block (joint tree + rest pose + rigid part-geometry).
  Orders of magnitude smaller than frame stacks — this is what lifts the
  24-frame/75MB ceiling, not just smooths it.
- In-page expansion: interpolate joint angles at the current phase, compose
  transforms down the joint tree, transform each rigid part (FK on rigid
  segments, NOT vertex skinning). Slots into the existing per-tick
  re-expansion hook; `figure-frames` remains as the fallback path.
- Procedural overlay (the payoff rung 1 can't reach): head-look-at and
  reach-toward as runtime joint overrides — unlocks NPCs that face the player
  entity, and waypoint locomotion with correct heading.

**Verify.** Node-side FK unit tests (rest pose round-trips; known key →
known joint world position). Headless: drive a walk via `__mojCtrl`, assert
foot-plant height stability across the gait cycle (no foot-sliding regression
vs. flipbooks). MP4 bake of a figure walking a path for eyeball review.

**Exit criteria.** One protoform figure walks a waypoint path in an action
world with speed-blended gait, payload smaller than its flipbook equivalent,
`figure-frames` untouched for existing worlds.

## Phase 3 — traversals: input recordings as recipes

**Status: LANDED.** What shipped vs. the design below:

- **Determinism audit passed cleanly** — the model layer (physics-sim, event-bus, game-idioms,
  controllable rules) had zero wall-clock/random reads to begin with; the only offender was the
  fog overlay's `uTime` (performance.now), now pinned to the traversal clock (`window.__mojClock`)
  in capture runs. Audit is enforced by test: same ticks twice → byte-identical probe streams
  ([../motion/world-traversal.test.js](../motion/world-traversal.test.js), exercising walk +
  held-jump + landing on the platformer rule).
- `__mojCapture` gained `step({dt, input})` (advance the LIVE channels one fixed tick — the
  input-driven sibling of the camera-driven `frame(spec)`) and `probe()` (entity transforms,
  HUD/bus vars, physics bodies) in [scene/scene-three.js](scene/scene-three.js).
- [../motion/world-frames.js](../motion/world-frames.js) `renderWorldTraversal(html, ticks)` →
  `{pngs, probes}`; [../motion/world-motion.js](../motion/world-motion.js)
  `renderWorldTraversalMotion({sketch, ticks, fps, params})` — `params.camera` injects a
  follow/FPV camera entity for worlds that ship without one.
- `forge_motion` accepts `shot.motion:'traversal'` + `shot.ticks` on world subjects: ticks ride
  into the stored recipe (the recipe IS the run), the per-tick probe stream files as
  `probes.json` beside the MP4/GIF, and the final probe returns in the tool result.
  `forward_context` routing + tool index updated.
- Demo: a protoform figure runs a crate course with a follow camera, jumps onto a platform, and
  the final probe confirms it landed ON it (z = platform height) —
  [lite-template/integration/0703/spike-output/traversal/](../../../lite-template/integration/0703/spike-output/traversal/).
- Not built (deliberate): a separate `record_traversal` tool — the ticks-in-shot form already
  stores the recipe; a standalone recorder can come with real demand.

**Goal.** Close the agent's loop on interactivity. A **traversal** is a stored,
deterministic timed input script (WASD/look/jump/action per tick) that can be
(a) replayed headlessly through the live runtime to produce an MP4 of the run,
and (b) asserted against — "after this input, the player is at X; score is 2."
This turns action worlds from demos into testable, narratable artifacts, and
extends the research-science thesis (provenance as the product) from figures to
*behavior*.

**The video renderer already exists; what's missing is the driver.**
`forge_motion` already takes a world subject and renders
turntable/orbit/push_in/dolly_zoom/flythrough to MP4/GIF
([../mcp/tools/motion.js:154](../mcp/tools/motion.js) →
`renderWorldMotion` → `renderWorldFrames` → Chromium). But its capture hook is
**camera-only**: `__mojCapture.frame(spec)` sets camera pos/target/fov and
steps deterministic channels to a sim-time `t`
([scene/scene-three.js:2631](scene/scene-three.js)) — it never feeds input, and
the input-driven paths (`stepControllable`/`stepWalk`) run only in the live
rAF loop. Today's world video is a camera flying over a world whose animation
is a function of time; a traversal is a world *driven* through time by input.
Same pipeline, new driver.

**All three pieces already exist**; this phase is the composition:

- `window.__mojCapture.frame(spec)` drives frame-by-frame capture
  ([../motion/world-frames.js:34](../motion/world-frames.js), scene-three.js).
- `window.__mojCtrl` / `window.__mojSim` expose the controllable/physics
  runtime for headless verification (scene-three.js:1053, :928).
- The controllable runtime consumes a normalized per-frame input snapshot
  (`ZERO_INPUT`, [worlds/controllable-world.js](worlds/controllable-world.js)) —
  an input script is just a timed sequence of those snapshots.

**Determinism first.** Replay only works if the runtime is tick-deterministic.
Audit before building: fixed timestep for sim + controllable channels under
capture (no `requestAnimationFrame` delta dependence), seeded spawns, no
wall-clock reads. This audit is the phase's real risk; do it as step one on the
platformer world, the hardest case.

**Model.**

- Recipe: `{ worldRef, ticks: [{t, input}...], camera: 'first-person'|'chase'|spec }`,
  stored like a motion recipe (small, deterministic, references the world by
  ref — geometry is never copied).
- Replay: extend `__mojCapture` with `step(input)` — advance sim + entities one
  fixed tick with the given snapshot, render, screenshot. `renderWorldFrames`
  grows a traversal mode beside the camera-spec mode.
- Probes: a `probe()` companion returning `{playerPos, hudVars, entityStates}`
  per tick — the assertion surface, and the world-tier sibling of the new
  `measure_view` readback.
- MCP surface: `record_traversal` (store script; the agent authors ticks, or a
  helper compiles "walk to waypoint" into ticks via the walk rule), and replay
  delivered through the existing `forge_motion` family as a new subject
  (world-traversal) rather than a parallel MP4 path — one encoder pipeline.

**Verify.** Same script twice → identical probe streams (determinism proof,
CI-able). A traversal that jumps a platformer gap → assert landing position.
One end-to-end MP4 of a dungeon walkthrough.

**Exit criteria.** The agent can mint a dungeon, record a traversal to its
exit, assert the run reached it, and hand the user an MP4 of the walkthrough —
all from recipes.

## Phase 4 — instancing (`repeats` channel)

**Status: LANDED** (World-path first pass). What shipped vs. the design below:

- Payload channel `repeats: [{ template: faces[], transforms: [{pos, rotZ?, scale?, tint?}],
  group? }]` — plus a generic opt-in manifest passthrough in
  [worlds/world-scene.js](worlds/world-scene.js) (assemblers may set `payload.repeats` natively
  and are never overridden).
- three.js lowering ([scene/scene-three.js](scene/scene-three.js)): each entry packs its
  template ONCE (expand + faceListToMesh + b64) and the page builds a `THREE.InstancedMesh`
  with per-instance matrix (translate + yaw + uniform scale) and optional per-instance
  `instanceColor` tint. Instances are pushed into `solids`, so walk collision, pick occlusion,
  and the wireframe toggle see them as real geometry — verified end-to-end: a platform hero
  jumps ONTO an instanced crate and the traversal probe confirms it stands at the crate-top
  height. The camera-framing bound widens to cover far instances.
- glTF lowering ([scene/scene-gltf.js](scene/scene-gltf.js) `addInstancedNodes`): one shared
  mesh + N thin TRS nodes; a repeats-only payload exports. Per-instance tint is three.js-only
  (glTF per-node color needs per-node materials — deliberately skipped).
- Measured: a 500-tree instanced world emits at less than HALF the bytes of its expanded
  equivalent (test-pinned in [scene/repeats.test.js](scene/repeats.test.js)); a 600-tree
  forest demo (rotation/scale/tint variation) is in
  [lite-template/integration/0703/spike-output/instancing/](../../../lite-template/integration/0703/spike-output/instancing/).
- Known gaps (follow-ups, mirroring the AO pattern): SVG `<use>` / CSS-3D cloned-subtree
  lowerings not yet built (the /scene and /svg tiers ignore `repeats`, as they ignore `walk`/
  `fog`); AO neither casts from nor darkens instanced geometry; generator adoption
  (fractal-city street furniture, condo balcony units) is the intended next consumer — the
  channel landed BEFORE those generators, per this plan's sequencing argument.

**Goal.** Raise the world-size ceiling an order of magnitude before
fractal-city/condo-complex generators collide with the one-face-soup model, and
make the payload *smaller* while doing it.

**Model.**

- Payload: a `repeats` channel — `{ template: faces[], transforms: [...] }` —
  beside the flat `faces` array. Generators opt in per asset class (street
  trees, windows, balcony units, unit-hall furniture): one template + N
  transforms instead of N copies.
- Emitters: three.js → `InstancedMesh` (with per-instance color for baked-light
  variation via `instanceColor`); glTF → one mesh, N nodes; SVG → `<use>`;
  CSS-3D → cloned subtree. Every backend has a natural lowering; none forks
  the payload.
- Interaction seams to respect: walk-mode colliders and the PICK raycaster
  currently assume expanded meshes — raycast against `InstancedMesh` works in
  three.js but pick-readout and walk-collision code must resolve instance ids.
  AO (Phase 1) samples occluders, so instanced occluders enter the SDF as
  boxes-with-transforms — the grid structure already supports this.
- Sequencing: land before fractal-condo's generator work so it emits instances
  natively rather than being retrofitted.

**Verify.** Byte-size and frame-time comparison on the largest fractal-city
fixture (expanded vs. instanced); pick-readout and walk-collision tests on an
instanced world.

**Exit criteria.** Fractal-city at 4× current block count holds 60fps in walk
mode; payload smaller than today's 1×.

## Phase 5 — deterministic ambient audio

**Goal.** Presence. Synthesized — never sampled — WebAudio driven by recipe
parameters, so the self-contained-HTML and zero-asset doctrines hold (no media
bytes, no network).

**Model.**

- An `audio` manifest channel, opt-in like `fog`: `{ wind, footsteps, events }`.
- Wind/ambience: filtered noise shaped by the sky/atmosphere settings the
  recipe already carries.
- Footsteps: triggered off the walk channel's existing head-bob phase (the
  gait signal already exists in-page) — zero new state.
- Event stingers: the event-bus reactions (`pickup`, `hitConfirm`, `emit`)
  gain an optional synth patch id; patches are tiny param sets in one
  `audio-patches.js`, in the spirit of theme packs.
- Determinism note: audio is presentation, not simulation — it reads sim state
  and never feeds back into it, so replay/capture (Phase 3) is unaffected.
  Browser autoplay policy requires a user gesture; the World's existing
  click/pointer-lock entry is the natural unlock.

**Verify.** Mostly by ear; structurally, a unit test that patches are pure
functions of (params, time) and an e2e that a muted capture run is
byte-identical to today's.

**Exit criteria.** Walk mode in a dungeon has footsteps and wind; an action
world's pickup dings; a recipe with `audio` omitted is byte-identical to today.

## Deliberately not on the ladder

- **Runtime lights / PBR / shadow maps** — would fork the five-backend unity
  that baked lighting buys; AO (Phase 1) is the sanctioned path to depth.
- **Asset import (FBX/OBJ/glTF-in)** — recipes stay the only geometry source;
  export-only remains the contract.
- **A visual editor** — a second source of truth beside the recipe. The
  traversal recorder (Phase 3) is as close as this ladder gets, and it stays
  recipe-shaped.
- **Vertex skinning** — Phase 2's rigid-segment FK covers protoform figures;
  smooth-skinned deformation is a different cost class for negligible gain at
  this art style.

## Suggested order and why

`0 → 1 → 3 → 2 → 4 → 5` if forced to serialize. Phase 1 is the highest
visual-return-per-effort and exercises the registry immediately. Phase 3 is
the single biggest capability jump (the agent can verify what it builds) and
its determinism audit should happen *before* Phase 2 adds more in-page
animation state to audit. Phase 4 gates the generative-city plans; Phase 5 is
pure polish and can land anytime after 3 (it hangs off channels 3 stabilizes).
Phases 1+2 and 4+5 pair well if parallelized.
