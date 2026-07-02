# subway-building — the subway as a stacked "building view"

Migrate the single-hall [subway-station.js](subway-station.js) diorama into a
multi-level **building view**: each level is its own sketched plate, stacked
vertically over a shared **vertical-circulation core** (stair + elevator +
escalator) that descends through a slab void.

This is the **new-sibling, shared-stacking** path (operator decision): a new
`subway-building.js` that *reuses the building view's stacking primitives*
([houseMeru](polygonizer/floorplan-structure.js), `buildSwitchbackFlight`, the
slab-void idea) while keeping **subway-specific level geometry**. The commercial
[floorplan-building.js](polygonizer/floorplan-building.js) (tenancy-wraps-a-core)
is left untouched — its envelope/slab/marble model fights an open track-trough
hall, so we compose the *stacker*, not the *plate*.

## The two levels

```
            ┌───────────────────────────────────────┐  z = mezzCeil (~10.6)
            │  MEZZANINE / CONCOURSE  (level 1)       │
            │   slab + void + fare gates              │
   void ────┼──►  ▓▓▓ stair  ║ elevator  ╱ escalator  │  z = mezzZ  (~6.1, via meru)
            │     (descend through the slab void)     │
            ├───────────────────────────────────────┤  z = zCeil (5.0)  platform ceiling
            │  PLATFORM HALL  (level 0)               │
            │   island platform · twin track troughs  │
            │   · broadside train · columns · figures │  z = zPlat (0)
            └───────────────────────────────────────┘  z = zFloor (-1.1) trough bed
```

- **Level 0 — platform.** Today's `planSubwayStation` hall verbatim. Composed,
  not forked: `subway-building.js` calls it (`forWorld: true`, near wall omitted)
  and lifts every face by `baseZ` (0 this pass). Zero edits to `subway-station.js`.
- **Level 1 — mezzanine.** New plate: a slab capping the hall with a **void**
  punched over the island, perimeter walls (near `x0` wall omitted to match the
  platform cutaway), a ceiling, and a row of **fare gates** at the paid/unpaid line.

`houseMeru({ groundZ: 0 }).resolveStack([{index:0, height: zCeil}, {index:1, height: mezzHeight}])`
places the mezzanine floor at `zCeil + floorDrop` for free — the same move the
commercial building uses for a double-height lobby.

## Vertical circulation (through the void, platform z=0 → mezzZ)  [BUILT — pass 2]

| element   | status                                                                 |
|-----------|------------------------------------------------------------------------|
| stair     | **real** straight `buildStairFlight` climbing onto the concourse edge   |
| elevator  | **real** glass shaft spanning both levels, cab + landing doors + head   |
| escalator | **`buildEscalator` — the new kernel**: inclined truss (deck/soffit/     |
|           | sides), cleated steps, balustrades + moving-handrail bands, green/amber |
|           | nosing for the up/down pair                                            |

The **escalator was the one primitive the codebase lacked** (it had stairs and
elevators, no escalator). `buildEscalator` is a sibling to `buildStairFlight`; a
later pass can promote it next to the stairs primitive in floorplan-structure.js
so other kernels reach it.

No-collision invariants: the four climb lanes are non-overlapping (the stair anchors
at its lane's RIGHT edge because `buildStairFlight('+y')` grows along −x), and the
building passes the VOID as `columnExclude` to `planSubwayStation` so no platform
pillar pokes up through the circulation. Both are regression-tested.

## Paths — the flow adapter ("feng shui")  [BUILT — pass 2]

Circulation is laid out by the desire lines a rider walks, over `movement-flow.js`
(the shared circulation field), not by magic numbers. `planSubwayFlow` builds the
graph — tunnel mouths → platform spine → foot of climb → concourse → fare line →
street mouth — and `assessSubwayFlow` diagnoses it in movement-flow's shared fault
vocabulary (best-effort, advisory — flow biases a layout, never gates it):

- **`axial-through-shot`** (the "poison arrow"): the street mouth is offset off the
  descent axis so a sightline can't shoot straight from the street down onto the
  live tracks. Drag it back on-axis and the assessment trips `impairment:true`.
- **`desire-line-blockage`**: platform columns are checked against the walked spine.
- **`entry-choke`**: the fare line must give an ample paid/unpaid throat.

The bright concourse ("明堂") sits between the fare line and the street; the climb
discharges onto the one open void edge so riders step off toward the gates.

## Scope — this pass (skeleton first)

Goal: nail the **stack + cutaway read**, not the detailing.

1. `subway-building.js`
   - `stackSubway(recipe)` → `{ meru, levels, circulation, faces, footprint, voidRect, stats }`
   - `assembleSubwayBuildingScene(recipe, opts)` → World payload (+ `explode` to
     pull the plates apart, mirroring the building) with corner/aerial cameras
     framing both levels through the omitted near wall + the slab void.
   - `renderSubwayBuildingToHtml` / `renderSubwayBuildingToThreeWorld` (mirror the
     building's CSS-3D + three.js emitters).
2. Wiring
   - add `'subway-building'` to `WORLD_RENDER_KINDS` in [sketch-manifest.js](sketch-manifest.js)
     (navigable, like `floorplan` / `restaurant` — *not* a preset-shot scene kind).
   - add the dispatch branch in [world-scene.js](world-scene.js).
3. `subway-building.test.js` — deterministic by seed; two levels; mezzanine floor
   above the platform ceiling; void present; circulation faces present.

Recipe (skeleton): `{ seed, line, density, cars, mezzanine: { gates, height }, explode }`.

## Done in pass 2

- **Escalator kernel** `buildEscalator` (up/down pair, cleated truss + balustrades
  + handrail bands + green/amber nosing).
- **Real elevator** (glass shaft both levels) and **real straight stair**.
- **Flow adapter** `planSubwayFlow` + `assessSubwayFlow` over `movement-flow.js`.
- **Dressing**: fare-gate turnstile units (cabinets + paddles + green lamps),
  void-head wayfinding pylon, station frieze band, the split street mouth.

## Upper-level detail — concourse doodads  [BUILT]

`subway-concourse-assets.js` builds STRUCTURED props from the workbench part
vocabulary (`buildSlab` rounded-rect extrudes + `buildLeg` turned lathes), not
crude boxes — the "use the assembler/workbench to give the doodads structure" move.
Everything is metric (the subway world is metric — a figure is 1.74 m), so parts
compose with no unit conversion, and each is baked under the scene's own light via
`workbenchAssetFaces` so it shades like the rest of the world.

Props: ticket-machine bank, slatted bench, turned waste bin, **info booth** (the
most assembled — base + posts + glazing + counter + roof + "i" sign), wayfinding
totem. Placed by flow: the booth takes the **commanding position** over the fare
line (`commandCell` — off the central desire axis, facing the gates); the TVM bank
lines the unpaid wall; benches sit on the paid side facing the gates; totems mark
the void-head→exit and street→trains decision points.

A later pass can promote these to the assembler proper (multi-part gravity seating)
or to shared furniture builders if other transit kinds want them.

### Fare barrier — the path to the stairs is FULLY GATED

`buildFareBarrier({ fp, y, z, turnstiles })` closes the whole paid/unpaid line
wall-to-wall: a turnstile bank (cabinets + waist paddles + green lamps), one wide
accessible gate (swing arm), and fixed waist railings filling every other span up to
both walls. The only passable openings are the gated lanes — a regression test
projects the barrier onto x and asserts the widest gap is one turnstile lane and the
coverage reaches the far wall, so there's no walk-around to the stairs. The OPERATOR
BOOTH (`buildInfoKiosk`) straddles the line on the returned `boothCenterX`, its window
facing the unpaid concourse; the ticket-machine bank lines the unpaid east wall.

## Trainset — accurate cars + interior  [BUILT]

`subway-trainset.js` `buildTrainset({...}) → { faces, cars, hero }` replaces the old
two-box car: chamfered (rounded) roof, end caps, platform-side skirt, door leaves +
window band, and a real INTERIOR — longitudinal bench seats down both walls, grab
poles, floor, and a lit far wall so the windows read as a lit car. `subway-station.js`
now uses it (so the accurate train shows in BOTH the standalone diorama and the
building view, which composes it); `recipe.train:false` suppresses it, `recipe.heroCar`
picks the open car.

Reveal: the HERO car opens its platform-facing wall (doll-house) for the full
interior; the rest keep the near wall with the window band cut out, so seats read
through the windows.

We went CUSTOM (not the `streetcar` vehicle primitive) because the ask was a laid-out
interior — the swept vehicle shell is a closed body with card-texture windows, no 3D
seats. The vehicle `streetcar` remains an option if a moving/curved exterior is wanted
later (its faces are a direct drop-in via `vehicleFaces`/`tramsOnTrack`).

## Surface detail — multiply-lit textures  [BUILT]

Real surfaces that read in `/world` (WebGL), not just the CSS scene: a face opts in
with `texture:'<key>'` + `textureLit:true` + `uv`, the scene collects the data-URL
tiles via `collectFaceTextures()` into `payload.textures`, and the World draws
texel × the lit `fill` (the CSS path keeps `fill`). See `surface-textures.js`.

- **Tiled pillars** — a new `tilePng` ceramic-tile generator (`tile-white`/`tile-cream`,
  'repeat' family) in `surface-textures.js`; `subway-station.js` clads the platform
  columns via `tiledColumn` (4 side faces with face-authored uv).
- **Marble concourse floor** — the mezzanine walking surface opts into `marble-carrara`
  (world-XY repeat uv, 3 m tiles) in `slabWithHole`.
- **Platform segment lines** — paving-joint geometry across the island + a centre joint
  (plain `fill`, reads in both renderers).

- **Mezzanine wall tile** — `tilePng` gained a running-bond option; a new `tile-subway`
  key (rectangular brick-bond, a DIFFERENT pattern from the square pillar tile) clads the
  concourse walls via a `tiledWall` helper.

Both subway scenes now return `textures` in their payload (`assembleSubwayBuildingScene`,
`assembleSubwayStationScene`). The platform CSS tile-gradient walls (`shellTiled`) are still
CSS-only — a later pass could move them onto the same texture path.

## Upstairs furnishings  [BUILT]

`subway-concourse-assets.js` gained wall-mounted props (a `wallPanelSlab` helper for
anything thin against a wall): `buildWallMap` (framed system map — light backing +
crossing route lines + station dots) and `buildPoster` (framed ad sheet). The mezzanine
mounts a system map on the east wall (paid side, read before descending), ad posters on
the east + north walls, and more waste bins by the gates / map / street.

## Ceilings + glass  [BUILT]

- **Coffered platform ceiling** — `subway-station.js` hangs two longitudinal beams
  flanking the platform (outside the void's x-band, so they never cross the opening)
  plus transverse ribs; a rib whose footprint lands in the `columnExclude` void is
  skipped so none hangs over the circulation hole. The full-hall ceiling quad is left
  intact (the building's `punchCeiling` still finds + holes it).
- **Shadows** — `decal:'shadow'` floor decals, which `emitThreeWorld` renders with a
  soft radial `CanvasTexture` (darkest centre, fading to transparent — the bar-world
  technique; CSS paints the `bg`). Two uses: (a) **tunnel/AO** darkening in the recessed
  troughs (bed + platform-overhang band + tunnel-mouth pools), and (b) **per-object
  contact shadows** grounding each piece — every column, bench, bin, figure, train car,
  and concourse doodad gets its own small expanded-footprint decal so the radial reads as
  a crisp grounded blob (not one stretched gradient). The contact/AO complement to the
  directional cast — the negative of the diffuse. Helpers: `contactShadow` /
  `contactShadowFace`.
- **Glass** — the World renderer draws faces tagged `water:true` with an `rgba()` fill
  in a translucent pass (`collectWaterMesh`, per-vertex alpha). The elevator shaft
  walls, the glazed train cars' window band, and every door window are now real glass
  (cab/seats/interior read *through* them). The CSS path keeps the rgba fill, so they're
  translucent there too. Hero car stays open (its cutaway is the showcase).

## Atmospheric lighting (opt-in)  [BUILT]

`recipe.atmosphere: true` swaps the bright even diorama for the bar-world's traced-
diffusion chiaroscuro (`subway-atmosphere.js` over `light-diffusion-3d.js`): the base
is dimmed to low ambient, warm point sources sit at the platform's ceiling fixtures
(cooler ones over the concourse), and a ray trace bakes bright light POOLS onto the
faces they hit (distance falloff + occlusion) + CAST shadows where objects block the
light. Off by default; both looks ship.

Two things made it work in `/world`:
- The light bakes into the hex `fill` (the flat term, which survives), not the soft
  CSS `bg` pools (ignored by WebGL); cast shadows ride as `shadowDecal` (→
  `collectShadowDecals`).
- The tracer assumes the floor at z≈0, so each LEVEL is baked in a frame shifted to
  put its floor at 0 (then shifted back) — cast shadows land on the platform AND the
  raised concourse. And the floor receivers are **tessellated** into a tile grid first
  (UV carried bilinearly so the marble survives), so each object casts its own shadow
  instead of all of them averaging onto one huge floor panel.

Bake cost is ~0.15 s/level (the per-level split keeps each trace small). The directional
cast is the complement to the per-object contact shadows, which still ground objects.

## Deferred to pass 3+

- **Unify lighting**: the platform keeps `subway-station`'s internal light, the
  mezzanine/circulation use their own `makeLight`; bake the whole stack under one.
- **Share hall dimensions**: `HALL` is re-declared here; export it from
  `subway-station.js` (or a shared `subway-dims.js`) so the two can't drift.
- **Promote `buildEscalator`** next to the stairs primitive in
  `floorplan-structure.js` so other kernels (building, dungeon) can reach it.
- **`levels: []` recipe** — a real per-level sketch array (street headhouse,
  N platform levels, transfer mezzanines) instead of the fixed 2-level shape.
- **Street headhouse / entry stair** up out of the mezzanine to the sidewalk.
- **`flowField` layer**: bias figure scatter + light pools by the diffuse flow
  field (movement-flow's optional layer), not just the desire-line checks.
- **`/scene` thumbnail** path if the gallery needs a baked PNG (world kinds may
  skip it — see the note by `SCENE_RENDER_KINDS`).

## Interchange variation (perpendicular two-line crossing)

`layout: 'interchange'` on the `subway-building` recipe mints a Bloor-Yonge / St George style crossing:
a N-S platform on the lower level, a second station **rotated 90°** into an E-W platform stacked above
it (`rotateFacesZ90`), and escalators bridging the two. Two lines (`line` + `lineB`), two trains,
crossing at right angles.

Circulation (so it reads right): a clean **parallel up/down escalator bank** climbs along the **upper
island's long (x) axis** (`escalatorX` — the shared kernel built +y then rotated) so riders land ON
the platform, never the tracks. The two run side-by-side (no scissor) and share **one stairwell
opening + landing**; the bank's FOOT lands at x=10 — dead-centre of the lower island *and* the upper
platform's span — so the down-stairs discharge squarely into the middle, not the edge (feng-shui
clean: `assessInterchangeFlow` → traversable, impairment 0). The platform is solid on the entry side.
A **glass balustrade** (`railOpening`) rings the opening, open on the landing edge, and a matching
**lower-ceiling hole** lets the escalators read from the platform below. The upper platform sits
`HALL.zCeil + 3.5` above — a wider gap so the bank lands cleanly with room. Both stations are passed a
**`furnishExclude`** rect (the crossing, in each frame) so no bench / bin / sign / rider lands on the
escalators or in the landing — verified zero obstacles in the crossing on either level.

The platform floor is **multi-piece** and its finish sits ~1 mm proud of the slab, so the hole is cut
with `punchFloorFaces` (clips *every* overlapping flat floor face, at the face's own z within a
tolerance) — `punchCeiling` only holes a single full quad and silently no-ops on a segmented floor.

- Builders: `planSubwayInterchange` / `assembleSubwayInterchangeScene` in subway-building.js.
- Dispatch: `assembleSubwayBuildingScene` early-returns to the interchange when `recipe.layout === 'interchange'`,
  so the existing `subway-building` /world kind + world-scene.js dispatch render it unchanged.
- MCP: `create_transportation_hub` gains `layout: 'standard' | 'interchange'` (+ `line_b`) — [scene-transport-hub.js](../mcp/tools/scene-transport-hub.js).
- Escalators reuse the shared stepped `buildEscalator` kernel with `balustrade: 'glass'`.
- Render spike: [subway-interchange.spike.gen.test.js](./subway-interchange.spike.gen.test.js).
