# fractal-school — auto-generative school campuses

Status: SPIKE PLAN. `fractal-city` already has a small civic `school` block: one schoolhouse
band plus a green yard and playground. This spike promotes that idea into its own World kind:
a seed-driven school/campus generator with varied campus patterns, classroom wings, room sizes,
specialty spaces, yards, bus/dropoff circulation, facades, and safety/daylight assessments.

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
  -> /world and .glb via resolveWorldScene()
```

The plan is the single source of truth. Rendering, egress, daylight, supervision, and
circulation assessments all read from it.

Every entity carries a stable ID from slice 1: `building:main`, `wing:north`, `room:math-03`,
`outdoor:yard`, `entry:bus`, etc. IDs seed local RNG streams and later give signage/picking a
place to bind.

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

Candidate extraction/modules once a second caller proves them:

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
- expose `assembleFractalSchoolScene()`
- wire `kind:'school-complex'` into `WORLD_RENDER_KINDS` and `resolveWorldScene()` or the
  world-kind registry if that refactor has landed

Acceptance:

- two seeds produce different campus patterns or room/program mixes
- same seed is byte-stable
- every scene has faces, grounds, cameras, walk spawn, and assessments
- default seeds pass reachability/daylight/egress for implemented patterns
- an unimplemented named pattern (`campus`, `stacked-urban`, `barbell`) throws
- `/world` and `.glb` resolve through the same world-scene payload

## Second Slice

Add real room fit-out and richer facades.

- desks/chairs/tables in classrooms from room/workbench assets
- lab benches, sinks, storage, fume-hood-like massing for science rooms
- library stacks and reading tables
- cafeteria tables and kitchen block
- gym court markings, hoops, stage/auditorium option
- facade registry with `brick-civic`, `glass-modern`, `concrete-frame`, `timber-warm`
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

- MCP tool or `compose_world` base adapter
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

- Should `school-complex` be a standalone kind, or a `compose_world` base from day one?
- Should classrooms be explicit inspectable rooms from slice 1, or facades plus representative
  furnished rooms until the floorplate grammar matures?
- Should multi-floor schools instantiate every floor, or repeat facade grammar and furnish
  selected floors like `fractal-condo` tower stacking?
- Should bus/dropoff circulation be geometry-only at first, or carry a simple motion layer?
- How should school scale map to real-world programs without implying code compliance beyond
  the declared assessment payloads?

## Spike Output Targets

- `school-complex-courtyard`
- `school-complex-spine`
- `school-complex-cluster`
- `school-complex-elementary`
- `school-complex-high-school`
- `school-complex-yard`
- `school-complex-facades`

Each target is generated from a tiny recipe and seed, not stored geometry.
