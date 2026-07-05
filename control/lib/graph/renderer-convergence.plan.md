# renderer convergence — make the landed rungs compose, then add inhabitants

Status: LANDED (first pass, 2026-07-04) — all steps below shipped in one sequence; per-step
"what shipped" notes are inline. The composed demo (overall exit criterion) renders via
[renderer-convergence.spike.gen.test.js](renderer-convergence.spike.gen.test.js) with PNG +
probes evidence in `lite-template/integration/0704/spike-output/renderer-convergence/`.
Known deviations, recorded per step: SVG-tier vao + repeats lowerings deferred (1d — the SVG
tier has no shared face painter); condo-complex not AO-defaulted (1c — 692ms/74k faces +
kPerCell overflow); entity rules have no lateral wall collision, so the waypoint compiler's
"unreachable" means NO STABLE FOOTING (void/fall), not a wall (step 3).

Sequel to [renderer-ladder.plan.md](renderer-ladder.plan.md), written after
its Phases 1–4 landed as first passes on `visualization-layer`. This plan does not add a new
rung; it sequences the follow-ups those rungs each deferred, so that the four capabilities
(AO, gait interp, traversals, instancing) stop being mutually blind — and then spends the
composed substrate on the one ceiling still untouched: **worlds have no inhabitants**.

The ladder's invariants carry over unchanged (tiny deterministic recipes, one engine-agnostic
payload, baked lighting only, no asset import, live behavior fenced in `nonBakeable`).

## Why convergence before a new rung

Each landed rung shipped with a "known gaps" list, and the gaps all point at each other:

- AO neither casts from nor darkens instanced geometry ([renderer-ladder Phase 4 notes](renderer-ladder.plan.md)).
- `repeats` landed **before** its intended consumers — fractal-city street furniture and
  condo balcony units still emit expanded face soup.
- Gait interpolation is gated OFF for the protoform family (chip re-ordering, median
  displacement ≈ 0.19 vs the 0.05 gate) — the main figure family can't use rung 1.
- AO samples at face corners only, so a crate on a single-quad floor casts no contact pool.
- CSS-3D and SVG ignore `vao` and `repeats` — the /scene and /svg tiers are drifting behind
  the "no backend forks the payload" doctrine.

Individually these are polish items; together they are the difference between four demos and
one renderer. Everything below is ordered so no step retrofits a previous one.

## Step 0 — land the world-kinds registry (prerequisite, already fully planned)

**Status: LANDED** — see the status note atop
[worlds/world-scene-registry.plan.md](worlds/world-scene-registry.plan.md) for what shipped
vs. its design (build phases 2+3 combined under the characterization net; `WALK_KINDS`
derived bit-for-bit; graph suite 187 files green).

Execute [worlds/world-scene-registry.plan.md](worlds/world-scene-registry.plan.md) as written
(characterization snapshots first, then extract `world-kinds.js`, then fold `WALK_KINDS` /
`FOG_OCCLUDER_BOXES` into descriptors). Nothing here re-plans it.

This plan adds one requirement to that one: the descriptor shape must leave room for the
per-kind fields the later steps introduce — `ao` defaults (step 1c) and instancing adoption
notes (step 1b) hang off the kind descriptor, not off new side tables. No code change beyond
what that plan already specifies; just don't close the descriptor to extension.

Gate: steps 1c and 2 SHOULD NOT land before this (they'd each add a side table the registry
plan exists to delete). Steps 1a/1b/1d don't depend on it and may proceed in parallel.

## Step 1 — the convergence pass

### 1a. AO × instancing (cast, then receive)

Files: [effects/ao-bake.js](effects/ao-bake.js), [scene/scene-three.js](scene/scene-three.js)
(the bake call sites in `emitThreeWorld` / `facesToGlb`), [scene/scene-gltf.js](scene/scene-gltf.js),
[scene/repeats.test.js](scene/repeats.test.js).

- **Cast (do first, mechanically simple):** the bake currently samples against the flat
  `faces` array, after facade-card expansion. Extend the occluder field build to also ingest
  `repeats`: for each entry, transform the template's faces by each instance TRS and feed the
  resulting quads into the same grid. Do NOT expand into the render payload — expansion is
  bake-time-only, into the sampling grid. A 600-tree forest should darken the terrain
  vertices under each canopy.
- **Receive (approximate, honest):** per-vertex AO inside one shared `InstancedMesh` template
  is impossible without forking geometry per instance — deliberately out. Two sanctioned
  levels instead:
  1. **Template self-AO**: bake the template's own faces against themselves once (a crate
     darkens its own underside/creases identically in every instance). Free and exact for
     self-occlusion.
  2. **Per-instance ambient level**: one occlusion sample per instance (at its footprint
     center, small kernel) multiplied into the existing `instanceColor` tint. Contact
     darkening reads at instance granularity — a tree between towers is dimmer than one in
     the open. Document the approximation in the ao-bake header.
- `aoStats` grows `{ instanceCasters, instanceSamples }` so overflow/clipping is never silent.

Verify: golden-value test — a fixture floor with one instanced crate shows darkened floor
vertices near the crate (cast) and a dimmer instance tint when boxed in by walls (receive);
determinism (two bakes byte-identical). Before/after PNG pair into
`lite-template/integration/<date>/spike-output/ao-instancing/`.

### 1b. Generator adoption of `repeats` (the payoff the channel was built for)

Files: [city/fractal-city.js](city/fractal-city.js), [architecture/fractal-condo.js](architecture/fractal-condo.js),
[worlds/world-scene.js](worlds/world-scene.js) (assembler-native `payload.repeats` is already
honored, [worlds/world-scene.js:296](worlds/world-scene.js)), [scene/repeats.test.js](scene/repeats.test.js).

- Fractal-city: street furniture first (trees, hydrants, traffic lights, bins — the asset
  classes with the highest copy counts), windows/facade cards explicitly NOT in scope (they
  ride the facade-card expansion path; instancing them is a different, riskier seam).
- Fractal-condo: balcony units and repeated upper-floor fitout assets. The floor-slab
  `repeats` usage from the Phase-4 first pass is the pattern to follow.
- Adoption rule: a generator opts an asset class in only when (template faces × copies)
  clears a byte threshold — pin the threshold in the test, mirroring the "less than HALF the
  bytes" assertion in repeats.test.js.
- Walk collision, pick, and camera-framing already treat instances as real geometry (Phase-4
  first pass) — re-run those assertions on the adopted generators, don't re-derive them.

Verify: byte-size + face-count comparison on the largest fractal-city fixture (expanded vs
adopted); one traversal probe on a city street asserting collision against an instanced
street object. Exit: fractal-city at 4× block count holds 60fps in walk mode (the ladder's
Phase-4 exit criterion, now actually reachable).

### 1c. AO contact pools + per-kind defaults

Files: [effects/ao-bake.js](effects/ao-bake.js), `worlds/world-kinds.js` (from step 0),
[worlds/world-scene.js](worlds/world-scene.js).

- `subdivide` option on the bake: receiver quads larger than ~2× the AO radius get virtual
  grid vertices (bake-time tessellation of large single-quad floors so a mid-floor crate
  casts a pool). Cap the subdivision count and count overflow in `aoStats`.
- Per-kind `ao` defaults move onto the registry descriptor: ON for interior kinds
  (dungeon-designer, suite-layout/floorplan family, condo interiors, subway), OFF for open
  landscapes and views. Manifest `ao:` continues to override either way.

Verify: the ladder Phase-1 exit criterion re-run (dungeon chamber + suite room, World + PNG +
.glb from one recipe) now WITHOUT an explicit `ao:` flag; crate-on-floor golden test gains a
pool assertion at a subdivided vertex.

### 1d. Backend parity (bounded, not a crusade)

Files: [scene/scene-css3d.js](scene/scene-css3d.js), the SVG emit path in
[sketch/](sketch/) (stored-sketch flatten), [figures/face-mesh.js](figures/face-mesh.js).

- Face-average `vao` fallback in the CSS-3D and SVG emitters (flat per-face darkening — the
  fallback the ladder's Phase-1 design already specified). Cheap, closes the doctrine gap.
- `repeats` lowering for SVG (`<use>`) and CSS-3D (cloned subtree): **deferred** unless a
  concrete /scene or /svg consumer of an instanced world shows up first. Record the deferral
  in the code comment beside the channel, not silently.

Verify: CSS-3D room PNG before/after shows corner darkening; payload without `vao` renders
byte-identical to today in both emitters.

## Step 2 — rung 2: pose curves + rigs (inhabitants, part 1)

The single biggest capability item. Design is [renderer-ladder Phase 2 rung 2](renderer-ladder.plan.md)
— this section only concretizes files, sequencing, and what "done" means.

Files: [polygonizer/figure-rig.js](polygonizer/figure-rig.js) (already exists — a seed rig;
audit and extend rather than re-create), [figures/megaboy-spike.js](figures/megaboy-spike.js)
(`walkPose`/`strafePose` are the DOF source), [polygonizer/figure-render.js](polygonizer/figure-render.js)
(protoform chip emission — the order-stability offender), [scene/scene-three.js](scene/scene-three.js)
(`packFigureFrames`, `__figAccum`/`__syncEntity`, the per-tick expansion hook),
[worlds/controllable-world.js](worlds/controllable-world.js) (`gaitFramePair`/`advanceGaitMix`
stay; the pose-curve path slots in beside them).

Sequenced rungs within the step:

1. **Bake format**: per clip, per joint, sparse keys over normalized phase (the floats
   `walkPose` already computes) + a `rig` block: joint tree, rest pose, rigid part-geometry
   segments. New payload channel beside `figure-frames`; `figure-frames` remains untouched as
   the fallback for existing worlds (exactly the compatibility posture rung 1 took with the
   lerp gate).
2. **In-page FK expansion**: interpolate joint angles at current phase, compose transforms
   down the tree, transform rigid parts into the ONE live BufferGeometry rung 1 established.
   No vertex skinning (out per the ladder's "deliberately not" list).
3. **Protoform delivery**: rig-delivered parts are order-stable by construction — this is
   what retires the `FIG_LERP_MEDIAN_MAX` gate for protoform, not a bake-order fix in
   figure-render.js. Keep the gate code; it now simply never trips for rig-delivered figures.
4. **Procedural overlays**: head-look-at and reach-toward as runtime joint overrides (live
   channel, `nonBakeable`-fenced like physics). This is the NPC-facing payoff.

Verify (from the ladder, made concrete): FK unit tests in node (rest-pose round-trip; known
key → known joint world position); headless `__mojCtrl` walk with foot-plant height assertion
(no sliding vs flipbook baseline); payload-size assertion — one protoform walk clip as pose
curves is smaller than its 6-frame flipbook; MP4 bake of a waypoint walk for eyeball review.

Exit: one protoform figure walks a waypoint path in an action world with speed-blended gait
and head-look-at toward the player entity, payload smaller than its flipbook equivalent.

## Step 3 — waypoint compiler (inhabitants, part 2 + the agent's loop)

Closes the gap between Phase 3's "replay ticks" and an agent that can cheaply USE traversal.
Today the agent hand-authors `{t, input}` snapshots; the compiler makes "walk to X" the unit
of authorship. Also the delivery mechanism for step 2's NPC locomotion — one steering core,
two consumers (player-traversal compilation, NPC waypoint following).

Decision (made here, not left open): **compile in-page, store the result as ticks.** Steering
needs the world's collision and the walk/controllable rule, which live in-page; a server-side
re-implementation would fork the rule. Extend `__mojCapture` with
`compileWalkTo({target, maxTicks}) → ticks[]` — deterministic greedy steering (seek heading +
the existing wall-slide from the walk rule; no pathfinding graph in v1, document that stuck
runs return `{stuck: true, atTick}` rather than looping). The stored recipe stays exactly
what Phase 3 defined — a tick script; the compiler is authorship sugar, so replay/determinism
guarantees are untouched by construction.

Files: [scene/scene-three.js](scene/scene-three.js) (`__mojCapture.step/probe` grow
`compileWalkTo`), [../motion/world-frames.js](../motion/world-frames.js) /
[../motion/world-motion.js](../motion/world-motion.js) (accept `waypoints` and resolve them to
ticks before the frame loop), [../mcp/tools/motion.js](../mcp/tools/motion.js) (`forge_motion`
world shots accept `shot.waypoints` as an alternative to `shot.ticks`; compiled ticks are
written back into the stored recipe so the recipe remains the run),
[../mcp/tools/context.js](../mcp/tools/context.js) (ROUTING_INDEX row; TOOL_INDEX only if a
tool signature changes).

**Walkability audit (the loop, closed):** a compiled entrance→exit traversal whose final
probe asserts arrival becomes a one-call check the agent can run on any freshly minted
walkable world. Ship it as the compiler's flagship verify case (dungeon-designer fixture:
mint → compile walk to exit chamber → assert final probe position), and add a routing-index
row for the framing "verify this world is walkable." NOT a new MCP tool in v1 — it's
`forge_motion` with waypoints + a probe assertion; mint a dedicated tool only if real usage
shows the composition is too many steps.

Verify: same waypoints compiled twice → identical ticks (determinism); compiled run through a
dungeon reaches the exit (probe-asserted); a deliberately blocked target returns
`{stuck: true}` rather than hanging; one MP4 of a compiled dungeon walkthrough.

## The composed demo (overall exit criterion)

One recipe, no hand-tuning, exercising every step: **a fractal-city block at 4× current
density — street furniture instanced (1b), AO-lit including instance cast/receive (1a/1c),
with one rigged NPC walking a waypoint loop with head-look-at (2, 3) — traversal-verified by
a compiled walk across the block (3), rendered to World + MP4 + .glb from the same recipe.**
PNG/MP4 evidence into `lite-template/integration/<date>/spike-output/renderer-convergence/`.

## Deliberately out (unchanged from the ladder, plus)

- Runtime lights / PBR / shadows; asset import; visual editor; vertex skinning — per the
  ladder's list.
- Phase 5 audio — still polish; hangs off channels this plan stabilizes; land any time after.
- New view kinds / landmarks / world families — widening, not ceiling-raising; different
  threads.
- Facade-card instancing (1b) and SVG/CSS-3D repeats lowerings (1d) — explicitly deferred
  with recorded markers, not forgotten.
- A pathfinding graph (step 3 is greedy steering + stuck-reporting; navmesh only with real
  demand).

## Order and parallelization

Serialized: `0 → 1a → 1b → 1c → 1d → 2 → 3`. In practice:

- **0 ∥ 1a ∥ 1b** — independent seams (registry refactor; ao-bake; generators).
- **1c after 0 and 1a** (needs descriptors + the bake extensions).
- **1d any time** after 1a's `vao` shape settles.
- **2 after 0** (rig/pose channel should be registry-aware from birth), independent of 1x.
- **3 after 2's rung 1–2** for the NPC consumer, though `compileWalkTo` for the PLAYER
  traversal path could land right after 1b against the existing walk rule if a walkability
  audit is wanted early.

Each step is independently shippable and independently valuable, per the ladder's contract.
