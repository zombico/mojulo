# Interchange — standard formats at the edge, recipes at home

Status: **PROPOSED** (I0 landed). Drafted 2026-08-10 from the 3D-pipeline
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
