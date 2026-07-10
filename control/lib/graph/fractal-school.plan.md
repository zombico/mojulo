# fractal-school — auto-generative school campuses

Status: SLICE 1 LANDED + SLICE 2 FIT-OUT/PRINCIPLES POLISH (2026-07-07).
`architecture/fractal-school.js` + `fractal-school.test.js` exist and the `school-complex` world
kind is wired into `worlds/world-kinds.js` and `sketch/sketch-manifest.js` (`WORLD_RENDER_KINDS`).

Landed so far:
- Slice 1: `courtyard`/`spine`/`cluster` patterns, `elementary`/`middle`/`high-school` programs,
  labelled streams, stable IDs, structural completion skin, `repeats`-channel desks, and the
  reachability/daylight/egress/site assessments.
- Slice 2 polish (this pass): desk **with chair** templates; wall-mounted teaching **boards**
  (chalkboard, or whiteboard for lab/media rooms) on the glare-free wall opposite the windows;
  real **gymnasiums** (sprung court, center line + jump circle, a backboard/rim at each end,
  bleachers); a visible **stair core** per building (treads); denser, geometry-derived classroom
  layout (fixed a bug where classrooms overhung the north shell wall).
- **Doors / ways in** (this pass): shell curtain-wall glazing is now broken around every opening
  (a doorway reads as a void, not a pane); the main entrance building gets a legible glass-transom
  **portal under a projecting canopy** with a genuinely open, walkable threshold; every room carries
  a **doorway** carved into its corridor-facing wall (with the teaching board offset clear of it).
  A walkability test probes eye height at the entrance + a classroom door to guard against re-sealing.
- **Parking + driveways + vehicles** (this pass): two `parking-lot` zones on the front arrival edge
  (painted stalls in two rows off a central aisle), asphalt **driveways** linking them to the bus
  loop + dropoff + street entrance, and real **registry vehicles** — `vehicles-css3d.vehicleAntFaces`
  weighted 'lot' sampling (sedans/SUVs/taxis/vans) nosed into the stalls, `cityBus` shuttles on the
  bus loop, a car at the dropoff. Scale pinned to `VEHICLE_SCALE = 8.5` (a ~15ft sedan → a 9×18ft
  stall), asserted by test. Lots placed clear of the athletics ring (verified clash-free).
  **Door clearance**: `doorClearanceZones` reserves a keep-clear apron in front of every exterior
  doorway + the entry-walk corridor; parked cars, bus shuttles, and the dropoff car are all filtered
  against it, so no vehicle ever blocks a way in. A flood-fill test confirms the entrance apron +
  entry corridor stay open at eye height across all patterns/seeds.
- **Facade cards** (this pass): building walls are now the shared detail-as-geometry facade
  primitive (`facade-card.buildFacadeCard`, the same mark-card system fractal-city + the airport
  terminal use, auto-expanded by scene-three's `expandSurfaceCards`). Each solid wall segment
  carries a full-height card floated just proud of the wall body: `brick-civic`/`timber-warm` →
  masonry body with punched windows, `glass-modern` → tinted panes in a curtain-wall frame,
  `concrete-frame` → pier/pilaster rhythm. Cards split around door openings (the entrance stays a
  void); floor-line trim bands articulate the storeys. Replaced the flat wall + single glazing
  ribbon and the per-floor curtain-wall glazing.
- **Landscape + pathing** (this pass): reuses the shared plant primitive (`plant-faces.plantBoxToFaces`,
  the same branched taiji trees fractal-city plants) for a tree ring around the built core, a scatter
  of shade trees in the open green, and trees in the courtyard garden — no more ad-hoc box trees.
  A paved perimeter walkway + entry walk (flat `#b3ada0` pavers, ground-flat so walkability is
  unaffected) give the campus its circulation "pathing". Every render carries `walk` by default
  (the `school-complex` world-kind descriptor + the spike samples).
- **Baked shadows** (this pass): the campus grounds itself with the primitives' contact/cast
  shadow decals (`contactShadowDecals` → `decal:'shadow'` faces, the subway/city/condo lineage) —
  a cast shadow per building + connector (offset downstream of the sun so it reads as a cast) and
  soft contact blobs under the free-standing outdoor structures (hoop poles, goals, backstop, play
  tower, trees). Ground-flat, so they never affect walkability; `shadows:false` drops them.
- **Athletics mandala** (this pass): every campus is ringed by real sport fields, not flat colour
  patches — a `soccer-field` (lines, halfway line, centre circle, goals), a `baseball-diamond`
  (dirt infield, base paths, four bases, backstop), a full `basketball-court` (two hoops) + a
  `playground` (tower + slide + swing set), plus the close-in courts/garden/amphitheatre. Placed by
  `athleticsZones(seed, occ, entrance)` around the built core (soccer behind, diamond + court +
  playground on the flanks) as an additive labelled-stream layer that never perturbs the building
  streams and is asserted clash-free against buildings. Rendered by an `OUTDOOR_FEATURES` registry
  (markings + equipment) that also upgrades the per-pattern `hardcourt`/`field`/`playground` zones.
- **Walkability proof** (this pass): `assessSchoolWalkability` floods the open space at eye height
  from the outdoor spawn — through real doorways only (glazing/walls block) — and asserts every
  occupiable room interior is reachable. This is the geometry-level "walkable with an entrance"
  guarantee (not the building-graph proxy); verified 0-unreachable across all patterns × seeds,
  exposed on the scene as `walkability`, and folded into the `code` register of the roll-up.
- Every building is roofed by default (`structure:true`): `structureEnvelopes` → roof slab +
  parapet + mechanical block per envelope; a programmatic sweep confirms no unroofed building.
- Principle registers: the campus now speaks the shared `floorplan-principles` REGISTERS —
  `assessSchoolLivability` (livability), `assessSchoolFengShui` (reuses
  `movement-flow.assessFengShui`: a door facing a stair core = poison arrow), `schoolBim`
  (element/room/area/seat schedule = the BIM projection), and `assessSchoolPrinciples` (the
  register-aware roll-up mirroring `evaluateBuilding`). Exposed on the scene as
  `livability` / `fengshui` / `bim` / `principles`.

Creatable as a world: `school` is now a `compose_world` BASE (`lib/mcp/tools/scene-school.js`
`mintSchoolComplex` + a `school` row in `compose-world.js` BASES + a `family:'world'` view-vocab
card `views/view-vocab/school.md`). Mint via `compose_world({ base:'school', seed, overrides:{
pattern, program, facade, floors } })` → a walkable `/world` + `.glb`, stored as a tiny
`kind:'school-complex'` recipe. (Run `node scripts/reindex-embeddings.js` so the new vocab card is
discoverable via `semantic_search({ kinds:['view_vocab'] })`.)

Still open from the original plan: `campus`/`stacked-urban`/`barbell` patterns and
`mixed`/`vocational` programs remain PLANNED (fail loudly); richer facades, site systems (bus
loop/dropoff crossings, fences/gates, playground age zones), and the `compose_world` adapter are
future slices. This plan continues to target the concrete world-kind/channel seams below.

`fractal-city` already has a small civic `school` block: one schoolhouse band plus a green yard
and playground. This spike promotes that idea into its own World kind: a seed-driven
school/campus generator with varied campus patterns, classroom wings, room sizes, specialty
spaces, yards, bus/dropoff circulation, facades, and safety/daylight assessments.

The intent mirrors `fractal-condo`: a tiny recipe regenerates a coherent built complex at
render time. The school is not a static prop inside a city anymore; it is a walkable, inspectable
institutional world.

## Goal

Make a school complex as fractal as `fractal-city`, but at education-campus scale.

The stored manifest remains a tiny deterministic recipe:

```js
{
  kind: 'school-complex',
  seed: 11,
  pattern: 'auto',       // auto | courtyard | spine | cluster | campus | stacked-urban
  program: 'auto',       // auto | elementary | middle | high-school | mixed | vocational
  density: 0.52,
  classroomMix: 'auto',  // auto | compact | standard | large | lab-heavy | arts-heavy
  facade: 'auto',        // auto | brick-civic | glass-modern | concrete-frame | timber-warm
  outdoor: true,
  floors: 'auto',
}
```

Render-time assembly regenerates all geometry. No baked faces are stored.

## Core Model

```txt
planFractalSchoolComplex(spec)
  -> {
       site,
       pattern,
       program,
       buildings: [{ id, role, rect, floors, core, facade }],
       wings: [{ id, role, axis, classrooms, specialtyRooms, corridor }],
       commons: [{ id, kind, rect }],
       outdoor: [{ id, kind, rect }],
       circulation: { entrances, corridors, stairs, dropoff, busLoop },
       assessments
     }
  -> buildFractalSchoolFaces(plan, opts)
  -> assembleFractalSchoolScene(spec, opts)
  -> /world and .glb via the world-kind registry
```

The plan is the single source of truth. Rendering, egress, daylight, supervision, and
circulation assessments all read from it.

Every entity carries a stable ID from slice 1: `building:main`, `wing:north`, `room:math-03`,
`outdoor:yard`, `entry:bus`, etc. IDs seed local RNG streams and later give signage/picking a
place to bind.

## Current Repo Baseline

- `control/lib/graph/worlds/world-kinds.js` is now the world dispatch seam. Add a
  `school-complex` descriptor there; do not add bespoke `resolveWorldScene()` branching.
- `control/lib/graph/sketch/sketch-manifest.js` still owns `WORLD_RENDER_KINDS`; add
  `school-complex` when the kind becomes renderable.
- `control/lib/graph/scene/channels.js` owns runtime channels. The school generator should emit
  through the existing `faces`, `grounds`, `cameras`, `walk`, `repeats`, AO, and capture contract.
- `architecture/fractal-condo.js` is the closest implementation precedent: labelled RNG streams,
  resolved option recording, stable IDs, structure envelopes, repeated floor grammar, loud
  failures, reachability tests, and no-straggler structural assertions.
- AO defaults now live on world-kind descriptors. Keep `school-complex` AO opt-in until the first
  implementation is profiled; large campuses can have the same cost/quality risks as
  `condo-complex`.
- `compose_world` is available as a base x theme entry point, but no school base exists today.
  Land the standalone world kind first, then add a compose adapter once the generator shape is
  stable.

## Fractal Axes

### Campus Pattern

The generator should vary the spatial organization:

- **courtyard**: classroom wings around a protected central outdoor court
- **spine**: a main indoor street with rooms and shared spaces branching off
- **cluster**: grade-level pods around small commons
- **campus**: separate buildings connected by covered walks
- **stacked-urban**: multi-floor compact school on a tight site
- **barbell**: academic wing and gym/auditorium wing joined by cafeteria/library commons

The first slice should implement three: `courtyard`, `spine`, and `cluster`.

### School Program

The program changes the room grammar:

- **elementary**: classroom pods, small gym, library, admin, play yard
- **middle**: grade clusters, science rooms, cafeteria, gym, art/music
- **high-school**: departments, labs, auditorium, gym/fieldhouse, shop/vocational rooms
- **mixed**: K-8 or 6-12 with separated age zones
- **vocational**: labs/shops/studios with larger service bays

`program:'auto'` samples from the implemented set. Named but unimplemented programs fail
loudly.

### Room Size And Layout

Rooms become sampled distributions, not fixed rectangles:

- standard classrooms
- kindergarten / early-years larger rooms with direct yard access
- science labs with prep/storage rooms
- art/music rooms with wider proportions
- makerspace/shop rooms with service doors
- library/media center
- cafeteria and kitchen/service back-of-house
- gym, stage/auditorium, locker rooms
- admin suite, nurse, counseling, staff room

Corridors must remain real geometry: entry -> admin/commons -> wings -> classrooms/specialty
rooms -> stairs/exits.

### Facades

Facade style becomes a seeded registry:

- `brick-civic`: brick walls, punched windows, entry canopy, school-sign band
- `glass-modern`: curtain wall commons, classroom ribbon windows
- `concrete-frame`: expressed structure with infill panels
- `timber-warm`: warm panels, deep overhangs, courtyard-facing glazing
- `mixed`: public commons facade differs from classroom wing facades

Facade choice is per building/wing, with a campus-level palette keeping the school coherent.

### Outdoor And Site Systems

The site matters as much as the building:

- playgrounds by age group
- sports field or hardcourt
- courtyard garden
- outdoor classroom / amphitheater
- bus loop
- parent dropoff lane
- bike racks
- parking/service yard
- fenced secure perimeter with controlled gates
- tree/shade bands

Outdoor features are additive and use labelled local RNG streams so enabling them does not
reshuffle the building layout.

## Reuse Existing Pieces

Do not rebuild proven primitives. Reuse or extract from:

- `city/fractal-city.js`
  - existing civic `school` footprint logic
  - playground pieces, benches, lamps, trees, hard/green ground patches
  - deterministic civic placement ideas
- `polygonizer/floorplan-building.js`
  - floor/use stacking pattern
  - core sizing and egress/lift/stair vocabulary
  - program fit-out pattern for open floor plates
- `polygonizer/floorplan-structure.js`
  - walls, openings, stairs, doors, floor plates
- `polygonizer/floorplan-building-assets.js`
  - benches, plants, tables, entrance/lobby pieces, elevators/stairs where relevant
- `architecture/room-assets.js`
  - desks, tables, chairs, laptops, tabletop props
- `scene/scene-css3d.js` and `scene/scene-three.js`
  - shared World payload, walk mode, cameras, signage, .glb path
- `worlds/movement-flow.js`
  - desire-line and entry-axis checks
- `architecture/fractal-condo.js`
  - labelled stream discipline, resolved-pattern recording, loud failures
  - structure envelopes, tower/floor repetition, stable IDs, and no-straggler tests

Start with one generator file, then extract once a second caller or real complexity proves the
boundary. Candidate modules:

```txt
architecture/school-campus.js       pattern planners and site graph
architecture/school-rooms.js        classroom/lab/gym/library/cafeteria room emitters
architecture/school-facades.js      facade registry
architecture/school-site.js         yards, courts, loops, fences, gates
architecture/school-assess.js       daylight/egress/supervision/reachability checks
architecture/fractal-school.js      generator orchestration
```

## Determinism Rules

- Same `spec + seed` produces byte-stable plan and faces.
- Every sampled axis draws from a labelled sub-stream:
  - `schoolStream(seed, 'pattern')`
  - `schoolStream(seed, wingId, 'classrooms')`
  - `schoolStream(seed, roomId, 'fitout')`
  - `schoolStream(seed, 'site', 'yard')`
- `pattern:'auto'`, `program:'auto'`, and `facade:'auto'` are stable only within a release.
  The resolved values are recorded in the plan so a caller can pin them.
- Unknown or planned-but-unimplemented patterns/programs/facades fail loudly.
- Outdoor/decorative layers are additive and must not perturb building/program streams.
- Stored manifest is only the recipe, never the generated faces.

## Structure And Rendering Contract

The first slice should include the building-completion discipline learned from
`fractal-condo`, not defer it:

- `structureEnvelopes(plan)` returns the actual envelopes used by wings, gyms, cafeterias,
  admin blocks, and multi-floor bars.
- Structural skin is on by default with `structure:true`: roof slabs, parapets, columns,
  overhangs, entry canopies, mechanical blocks, service doors, and vents should march the
  generated envelopes, not the site bounds.
- A no-straggler test checks that structural objects stay attached to an envelope.
- Multi-floor schools repeat facade/floor grammar and furnish selected representative floors
  rather than instantiating every classroom on every level.
- Use the `repeats` channel early for repeated classroom windows, lockers, desks, roof units,
  play equipment, bollards, bike racks, trees, and fence segments.
- Facade/glazing options should mirror the condo pattern: `facade:'auto'`, palette recording,
  and a later `clearGlass` option for commons/classroom glazing if the renderer path supports it
  cleanly.
- Keep AO manifest-opt-in at first. Promote `ao:true` to the registry descriptor only after a
  representative campus is profiled and checked for visible quality.

## Assessment Contract

Every generated school scene carries assessment payloads:

- `reachability`: every classroom, specialty room, commons, outdoor zone, and exit is connected.
- `egress`: every occupied zone has a route to at least two exits when the plan size requires it.
- `daylight`: classrooms and common learning spaces have exterior windows or courtyard glazing.
- `supervision`: primary entries, bus loop, playground, and commons are visible from admin or staff zones.
- `separation`: bus/dropoff/service paths do not cross main student pedestrian paths without a marked crossing.
- `accessibility`: at least one step-free route connects entry, commons, classroom wings, and yard.

Necessary impairments fail the spike tests. Preferential issues can be reported as diagnostics.

## First Slice

Build a minimal `school-complex` world kind using simple box/floorplate geometry plus existing
room and site primitives.

Scope:

- new file `architecture/fractal-school.js`
- `planFractalSchoolComplex({ seed, pattern:'auto', program:'auto' })`
- `schoolStream(seed, ...labels)` with stable, named streams
- `SCHOOL_PATTERNS`, `PLANNED_PATTERNS`, `SCHOOL_PROGRAMS`, and `SCHOOL_FACADES` registries
- implement patterns:
  - `courtyard`
  - `spine`
  - `cluster`
- implement programs:
  - `elementary`
  - `middle`
  - `high-school`
- vary:
  - building count or wing count
  - classroom count
  - classroom dimensions
  - shared-space mix
  - floors
  - yard/playfield size
  - facade style at least between `brick-civic` and `glass-modern`
- assemble `faces`, `grounds`, `cameras`, `walk`, and assessment payloads
- emit `repeats` where repeated geometry is cheap and deterministic
- implement `structureEnvelopes(plan)` and default structural completion
- expose `assembleFractalSchoolScene()`
- wire `kind:'school-complex'` into `WORLD_KINDS` in `worlds/world-kinds.js`
- wire `school-complex` into `WORLD_RENDER_KINDS` in `sketch/sketch-manifest.js`
- add a world-kind characterization fixture/snapshot
- leave AO off by default unless profiling shows it is cheap and clean

Acceptance:

- two seeds produce different campus patterns or room/program mixes
- same seed is byte-stable for plan and faces
- stable IDs exist for buildings, wings, rooms, commons, entries, outdoor zones, and repeats
- every scene has faces, grounds, cameras, walk spawn, and assessments
- default seeds pass reachability/daylight/egress for implemented patterns
- structural completion has no detached stragglers outside `structureEnvelopes(plan)`
- when stable for the kind, a capture/walkability fixture can compile a route from entry to
  commons, yard, and at least one classroom/exit
- an unimplemented named pattern (`campus`, `stacked-urban`, `barbell`) throws
- `/world` and `.glb` resolve through the same registry-backed world-scene payload

## Second Slice

Add real room fit-out and richer facades.

- desks/chairs/tables in classrooms from room/workbench assets
- lab benches, sinks, storage, fume-hood-like massing for science rooms
- library stacks and reading tables
- cafeteria tables and kitchen block
- gym court markings, hoops, stage/auditorium option
- facade registry with `brick-civic`, `glass-modern`, `concrete-frame`, `timber-warm`
- repeated facade/window/classroom furniture emission through the `repeats` channel
- optional transparent/clear glazing path for commons and classroom bands if it survives export
- stable signage groups for room labels and wayfinding

## Third Slice

Add full site behavior.

- bus loop + parent dropoff with pedestrian crossings
- parking/service yard
- bike racks and covered entry
- fenced secure perimeter with gates
- playground age zones
- sports field / hardcourt / outdoor classroom
- supervision assessment over outdoor zones
- cameras: site plan, entry, courtyard, classroom wing, gym/cafeteria

## Fourth Slice

Make the school generator first-class.

- `compose_world` base adapter after the standalone kind is stable
- view-vocab entry
- maker/gallery category entry if appropriate
- example recipes/seeds in tests
- docs explaining recipe knobs and assessment payloads

## Non-Goals For The Spike

- No school-code simulator beyond the assessment contract.
- No schedule/timetable/student-agent simulation.
- No detailed MEP/security systems.
- No PBR/material rewrite; keep baked vertex-color faces.
- No UI-first builder.
- No destructive rewrite of `fractal-city` civic `school`; it remains the small city-block prop.

## Open Questions

- Answered for this spike: `school-complex` should be a standalone world kind first, with a
  `compose_world` adapter later.
- Answered for this spike: rooms should be explicit from slice 1, but only selected rooms/floors
  need full furniture until the grammar matures.
- Answered for this spike: multi-floor schools should repeat facade/floor grammar and furnish
  selected floors, following the `fractal-condo` tower-stacking precedent.
- Still open: should bus/dropoff circulation stay geometry-only at first, or carry a simple
  motion layer?
- Still open: how should school scale map to real-world programs without implying code
  compliance beyond the declared assessment payloads?

## Spike Output Targets

- `school-complex-courtyard`
- `school-complex-spine`
- `school-complex-cluster`
- `school-complex-elementary`
- `school-complex-high-school`
- `school-complex-yard`
- `school-complex-facades`

Each target is generated from a tiny recipe and seed, not stored geometry.
