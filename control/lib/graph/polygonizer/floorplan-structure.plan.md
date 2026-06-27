# floorplan-structure — turning a floorplan into a real house

Status: IMPLEMENTED — `floorplan-structure.js` + `floorplan-structure.test.js`
(15 tests passing). Verified: Stage-1 blueprint SVG, Stage-2 3D scene, Stage-3
elevation/section SVG.

Landed so far:
  - Single-floor structurize: wall graph (relate) + thick extruded walls
    (structurize) + door/window openings + 2D plan + 3D scene.
  - THE MERU (vertical ruler): `houseMeru` places storeys flush along the axis;
    `structurizeFloorplan` takes a `baseZ` so a level sits at any height.
  - Multi-level house: `structurizeHouse({ levels:[…] })` reuses the SAME glyphs
    to plan a basement (index −1) / ground (0) / second floor (+1), shared
    footprint → the wall shell stacks into one multi-storey envelope.
  - Ground level HELPER LINE (terrain stays OUT): `groundDatumFaces` draws a
    glowing z=0 frame + a faint meru axis; the elevation SVG draws the dashed
    `ground · z=0` datum across the stack.
  - STAIRS PRIMITIVE + OPEN SLOT: `buildStairFlight` is a straight stepped-solid
    flight (the bar/extrude move × N steps) that climbs flush from one meru level
    to the next; `placeStairs` tucks it just inside a perimeter wall and returns
    the stairwell `slot`. `structurizeHouse({ stairs:{from,to} })` cuts that slot
    through the destination floor slab (`slabFaces` + `subtractRect`) so the upper
    floor is genuinely open over the flight. Plan SVG marks the void; elevation
    SVG draws the stepped flight `stair L0→L1`.

  - REAL-WORLD SCALE: one world unit = one FOOT. Defaults sized to a standard
    bungalow — 8 ft main ceiling, 6 in walls, 32×80 in doors, 36 in windows,
    ~9 ft min room (footprint ~42×30 ft ≈ 1260 sq ft). Stairs ~7 in rise / 10 in
    going, 3 ft wide. `floorplan-glyphs` MIN_ROOM/HALL are feet; `minRoom` is a
    `generatePlan` option.
  - PER-LEVEL STOREY HEIGHTS: the meru no longer assumes one pitch. `houseMeru`
    gains `heightFor(index)` + `resolveStack(levels)` that accumulates real floor
    heights, so a basement (default 7 ft) sits LOWER than the 8 ft main floor and
    everything still stacks flush. Stairs resolve their from/to floor z from the
    stack and cut the slot in the UPPER level (a basement stair descends through
    the ground slab).
  - MERU AS A FLOORPLAN FEATURE: `structurizeHouse` generates each level's plan
    up front, then `chooseStairCore` seats the stair INSIDE a room of the served
    floor (entry-first, else central), against a wall, with the well fully within
    that room — the way a bungalow's basement stair sits in a room, not a raw
    footprint corner. `meru.core` records the host. The three.js house renders the
    levels CONNECTED (flush) so the flight descends through the slot, plus an
    `explode` read of both layouts. Datum/axis faces tagged `helper` + filtered
    from the 3D building.

  - REALISM PASS (proportions + openings + ceilings): defaults retuned to a modern
    house — 9 ft main / 8 ft upper / 7.5 ft basement, exterior envelope (~8 in) built
    heavier than interior partitions (~5 in), and a single shared HEAD LINE (6 ft 10 in)
    that every door and window top aligns to. Openings are now dressed rather than
    punched: windows get a painted casing (+ a centre mullion past 4.5 ft) and a tinted
    TRANSLUCENT glass pane (rendered through the World's water/alpha pass, and as an
    `rgba()` background in CSS-3D); interior doors get a casing + a stained leaf swung
    90° open against the wall (axis-aligned, so the doorway stays legible/passable in
    walk). Ceilings are OPT-IN (`ceilings:true`) — a downward `shell:ceiling` plane with
    an inward normal, so the World's immersive cutaway FADES it for an above camera (the
    open-roof doll-house read is preserved by default) but SHOWS it from below in walk.
    A level's ceiling opens over the stairwell rising to the floor above.
  - X-RAY OUTER WALLS (`xrayWalls:true`): tags the perimeter envelope into a
    `shell:exterior` group flagged `wireframe`; the three.js World renders that group
    as a see-through EdgesGeometry cage (fill hidden), so the whole interior reads at
    once. Interior partitions/floors/doors stay solid and glass keeps its pane. A live
    `x-ray` HUD button flips the envelope between cage and solid fill. CSS-3D ignores
    the flag (renders the envelope solid) — three.js-path feature.

  - STAIR RAILINGS + SWITCHBACK: every flight now carries railings (`rails!==false`) —
    a wall-side handrail (sloped `railBeam`) and an open-side BANISTER (a baluster at
    each tread + bottom/top newel posts), via `flightRail`. `buildSwitchbackFlight` adds
    a U-RETURN stair: two equal half-flights with a half-landing where you turn 180°, the
    second doubling back OVER the first's footprint — the whole climb criss-crosses one
    compact area (≈ half the run, double the width), banisters lining the central well.
    Program houses default to switchback (`switchback ?? useProgram`); the generator
    reserves a wider `stairSpan` (2×width + wellGap) so the flight fits and the upper
    landing covers it. `placeStairs({switchback})` selects the builder.
  - INTERIOR WALL FINISHES (`wallDecor:true`): `interiorWallDecor` dresses the room-facing
    side of each wall SEGMENT (so it respects door/window openings — it piggybacks on the
    piers/lintels/sills, not the whole wall) with a finish chosen deterministically from the
    wall's geometry: mostly PAINT (a soft colour swath + baseboard), some WOOD WAINSCOT
    (baseboard + paneled dado with stiles + chair rail + paint above) and some WALLPAPER (a
    repeating motif over a base colour). Bands clip to the segment's z-range and lay just
    proud of the wall with staggered lift (the same anti-z-fight trick as the card layers).
    Applied after x-ray tagging so the finish stays solid even when the envelope is a cage.
  - FURNITURE (`furnish:true`): each registered room is populated with its archetype
    furniture (`fillRoom` → `extractRoomSceneFaces`, the room-spike pipeline), merged
    into the house faces. The open core is split into its living/kitchen/dining zones
    and each furnished as itself (open plan). See floorplan-program.plan.md.

Remaining: MCP/recipe exposure (a `create_house`-style tool mirroring
`create_fractal_city`).

Design simplifications vs the plan below: (1) mitering is unnecessary — walls
straddle their centerline by ±t/2, so perpendicular runs OVERLAP at corners and
fill them (no gap to miter); (2) each run emits a full 6-face box rather than
selectively-faced walls — the classification still drives color, openings, and
the 2D glyph, but a partition is correctly just a thin double-faced slab.

Expands the room primitive to a **house concern**: take the
surface-area budget the floorplan hands to rooms, give the walls real thickness,
and derive the **exterior** of the perimeter walls so the plan reads as a built
structure — not facaded (no roof/door styling yet), just honest extruded mass.

This is the same move the **bar** primitive already makes: a 2D footprint →
`extrudeToFaces` → a solid with an outer face, an inner cavity face, and a rim
cap. Rooms never got that; walls today are zero-thickness inward planes
(`buildRoomShellFaces`). We give rooms the bar's structurize step, scaled up from
one box to a *graph* of walls, and add the **relate** step the bar didn't need:
which walls are shared partitions and which are the house envelope.

## What's there now (do not rebuild)

- `floorplan-glyphs.js` — fractal BSP generator. `generatePlan(seed,{width,height})`
  → `{rooms:[{x,y,w,h,glyph}], halls, doors}`. Room **content** glyphs
  (H/E/L/D/K/B/O/S). **Orphan — nothing imports it.** This plan wires it in.
- `extrude-faces.js` — `extrudeToFaces(spec)`: 2D profile swept along an axis,
  `wallThickness` → shell with outer + inner + rim faces. The structurize engine.
- `scene-css3d.js` — `buildRoomShellFaces` (one interior box, thin walls,
  doorway split into left/right/lintel/sill) + `extractRoomSceneFaces` (furniture).
- `suite-layout.js` — composes several volumes' shells + furniture into one
  `emitPreserve3dScene`. The precedent for multi-room → one scene, interior-only.
- `recipe-compiler.js` — `roomScene` kind. `house`/`architecturalConstruction` is
  a *facade prompt-grammar*, unrelated to plan geometry; do not fold into it.

## The gap

Nothing turns the floorplan footprint into walls with an outside. Archetypes say
what's *in* a room; no glyph describes the walls *between and around* rooms. That
wall layer — derived once, deduped, exterior-vs-interior classified — is the
house concern.

## Two glyph layers

Keep the existing **content** glyphs untouched. Add a **structural** glyph
alphabet — the wall graph that relates rooms. Glyphs are data specs (like the
bar's face-cards), each resolving to extruded geometry.

| glyph | meaning | resolves to |
|---|---|---|
| `═` `║` | wall run, interior partition | thick wall, **two** interior faces (shared by the 2 rooms it divides) |
| `▓` | wall run, perimeter | thick wall, interior face + **exterior face** (= the house skin) |
| `╬ ╠ ╣ ╦ ╩ ╗ ╝ ╔ ╚` | junction / corner | mitered thickness so the join reads solid, no gap or overlap |
| `▯` door | opening in any wall | gap cut in the run (reuse lintel/sill split logic) + jamb returns |
| `▭` window | opening, **perimeter only** | gap with sill band; only valid on `▓` glyphs |

The classification (`▓` vs `═`/`║`) **is** the "relate the rooms into a house"
operation. A perimeter edge belongs to the envelope; an interior edge is one
shared wall, not two abutting ones.

## The structurize pipeline

```
generatePlan(seed)            // existing — or explicit rooms[]
  → buildWallGraph(rooms)     // NEW — dedup edges, classify perimeter/interior
  → placeOpenings(graph,doors)// NEW — doors onto interior runs, windows onto perimeter
  → extrudeWalls(graph)       // NEW — each run → thick wall via extrude-faces math
  → emit: 2D plan + 3D faces  // top-down blueprint AND lifted structure
```

### 1. `buildWallGraph(rooms, opts)` — the relate step

- Collect all 4 edges of every room rect as axis-aligned segments
  `{axis:'x'|'y', along:[a,b], at:c, rooms:Set}`.
- **Dedup + merge**: segments sharing an axis line and overlapping/touching merge;
  track which room(s) each final run borders.
- **Classify**: a run bordering 2 rooms → interior partition (`═`/`║`). A run
  bordering exactly 1 room → perimeter (`▓`). (Equivalent to: edge on the union
  boundary of the footprint.)
- **Junctions**: at every wall endpoint, record incident runs so the extrude step
  can miter — perimeter T-into-interior and L-corners both handled by extending
  each run by half-thickness into the joint (cheap miter; good enough without CSG).
- Output: `{runs:[{glyph,axis,along,at,thickness,rooms}], junctions:[…]}`.

### 2. `placeOpenings(graph, doors)`

- `doors` from `generatePlan` sit on hall edges → map each to the interior run it
  lands on, as `{run, u0, u1}` in run-local frame. Reuse the door's midpoint.
- Windows: optional, sprinkle onto perimeter runs of `L`/`D`/`B`/`K` rooms (the
  archetypes that already request `window` fixtures) at a seeded share of the run.
- An opening carries through to extrude as a hole spec.

### 3. `extrudeWalls(graph)` — the bar move, per run

For each run, build a thin rectangular prism the bar way (don't call
`extrudeToFaces` blindly — its `perpBasis` is axis-driven; a wall is a known
vertical box, so emit the 6 quads directly, mirroring extrude-faces' face/normal
conventions so vexar shading matches):

- footprint = run length × `thickness`, extruded `z0→z1` (wall height).
- **Perimeter `▓`**: outer face normal points *away* from the bordering room
  (outward = the house skin), inner face toward the room, plus top cap + the two
  end caps where the run terminates at the envelope (not at a junction).
- **Interior `═`/`║`**: both long faces point toward their respective rooms; no
  exterior; top cap only.
- **Openings**: split the run into segments around each hole (same left/right
  /lintel/sill split `buildRoomShellFaces` already does, lifted to 3D), and add
  jamb-return faces on the cut so the wall thickness shows in the doorway.
- Floor: one slab over the footprint union (`▓`-bounded), giving the structure a
  base; ceilings stay off so the 3D view reads as an open-roof dollhouse.

### Output

- **2D plan** (Stage 1): top-down SVG/marks — room rects tinted by archetype,
  walls drawn at true thickness, glyphs labeling runs/openings. A readable
  blueprint. Reuse the sketch `marks` path.
- **3D structure** (Stage 2): the extruded face list → `emitPreserve3dScene`,
  same as `suite-layout`. Perimeter exterior faces make it a real house from a
  slight overhead angle.

## New module + wiring

- New: `control/lib/graph/polygonizer/floorplan-structure.js` — `buildWallGraph`,
  `placeOpenings`, `extrudeWalls`, and `structurizeFloorplan(plan, opts)` that
  runs the pipeline and returns `{plan2d, faces, wallGraph}`.
- New structural glyph table lives beside the content `ARCHETYPES` (either in
  `floorplan-glyphs.js` or a small `STRUCTURAL_GLYPHS` export here).
- Wire a recipe kind `floorplan` (alias `house-plan`) in `recipe-compiler.js` that
  takes `{seed,width,height}` **or** explicit `rooms[]`, calls
  `structurizeFloorplan`, emits both stages. Keep `roomScene` and the facade
  `house` kinds as-is.
- Furniture is optional phase 2: per room, `fillRoom(room,seed)` already yields
  `roomConcept.elements`; feed through `extractRoomSceneFaces` per room basis and
  merge into the 3D faces (the `suite-layout` pattern). Land walls first.

## Test plan

- `floorplan-structure.test.js`:
  - wall-graph dedup: a 2-room split shares exactly one interior run; the outer
    boundary is all perimeter; run count = expected for a known seed.
  - classification: every perimeter run borders 1 room, every interior run 2.
  - extrude: perimeter run emits an outward face whose normal·(awayFromRoom) > 0;
    interior run emits no outward-only face; face counts per run match.
  - openings: a door splits its run into 4 strips + 2 jambs; window only on `▓`.
- `node --check` the new module; keep faces engine-agnostic (no three/DOM).

## Open questions / deferrals

- Mitering is half-thickness extension (cheap). If corners visibly overlap/gap at
  thick walls, revisit with a proper segment-join, not CSG.
- Hall volumes: treat halls as rooms for envelope purposes, or as negative space?
  Lean: halls are rooms (they have walls + doors already), so include them.
- Roof / facade: explicitly out of scope per request. The exterior is bare
  extruded mass; styling is a later facade-card pass if wanted.

## Exterior view + roof (2026-06)

The doll-house is a *view*, not the artifact. The full house wants a roof; add an
`exterior` view as a COMPANION to the existing cutaway, selectable at render time
(a `?view=exterior` toggle, like `?wire`/`?explode`) — same recipe, regenerated.

Two composable additions, both in the shared `structurizeFloorplan` core so the
single-floor `kind:'floorplan'` sketch AND multi-level `structurizeHouse` get them:

- **roof** — opt-in `roof` option (`true` | `<style>` | `{ style, form, ... }`),
  caps the envelope footprint at the TOP storey's wall-top via `buildRoof`
  (roof.js, already built: 10 forms / 10 ROOF_STYLES). Default OFF (cutaway keeps
  the open top). `buildRoof` faces carry a flat `fill` so they read in CSS-3D and
  three.js even without tiles; `textureKeys` resolve via `surfaceTexture()` into
  `payload.textures` for the World's tiled read.
- **view** — `'cutaway'` (default, unchanged) | `'exterior'`. Exterior:
  auto-enables the roof, caps the top storey's ceiling (no see-in), HIDES the
  basement (omit levels with meru index < 0 + their stairs), shows a real GROUND
  plane at `groundZ`, drops the cyan datum helper + explode, and frames an
  exterior orbit camera with walk OFF.

`structurizeFloorplan` owns roof+ground when it owns the whole envelope
(`_envelope !== false`); `structurizeHouse` passes `_envelope:false` per level and
adds ONE roof at the top storey + ONE ground plane itself. Plumbing threads `view`
through `/world` + `/scene` routes → `world-scene.resolveWorldScene(sketch, {view})`
/ `scene-html.renderSceneHtml(sketch, {view})` → the assemblers. `view` may also
be a manifest default; the query param overrides.
