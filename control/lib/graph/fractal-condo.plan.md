# fractal-condo — auto-generative condo complexes

Status: SPIKE PLAN. The current `condo-entrance.js` spike proves the renderer vocabulary:
central lobby, wings, satellite towers, unit halls, curtain walls, floor-2 plate, egress
stairs, livability checks, and feng-shui flow. This spike turns that fixed composition into
a `fractal-city`-class generator: one tiny recipe plus a seed produces varied condo
complexes with different building counts, lobby graphs, unit sizes, layouts, and facades.

## Goal

Make the condo world as generative as `fractal-city`, but at residential-complex scale.

The stored manifest remains a tiny deterministic recipe:

```js
{
  kind: 'condo-complex',
  seed: 7,
  pattern: 'auto',       // auto | paired | three-wing | courtyard | podium-towers | garden-campus | spine
  density: 0.55,
  unitMix: 'auto',       // auto | compact | family | luxury | mixed
  facade: 'auto',        // auto | curtain-wall | balcony-grid | masonry-punched | concrete-frame
  amenities: true,
  floors: 'auto',
}
```

Render-time assembly regenerates the whole complex. No baked geometry is persisted.

## Core Model

```txt
planFractalCondoComplex(spec)
  -> {
       site,
       pattern,
       buildings: [{ id, rect, floors, core, facade, lobby, floorPlates }],
       concourses: [{ from, to, hall, units, storefronts }],
       courtyards: [],
       amenities: [],
       assessments
     }
  -> buildFractalCondoFaces(plan, opts)
  -> assembleFractalCondoScene(spec, opts)
  -> /world and .glb via resolveWorldScene()
```

The plan is the single source of truth. Rendering, egress, livability, and flow all read
from it so visual geometry and checks cannot drift.

Every entity in the plan carries a STABLE ID from slice 1 on — `buildings[].id`,
`concourses[].id`, and per-concourse `units[].id` — even though nothing picks or inspects
them yet. IDs cost nothing now; retrofitting them later is exactly the kind of change that
breaks seed stability (they seed the local RNG streams below).

## Fractal Axes

### Buildings Per Complex

The generator should vary the number and arrangement of residential buildings:

- one tower with a richer podium lobby
- paired towers sharing a central address
- three-wing or T-shaped complex
- courtyard ring around an outdoor garden
- podium with towers above
- garden-campus pavilions connected by glazed concourses
- linear amenity spine with buildings branching off it

This replaces the current fixed `central + W/E/N wings` assumption.

### Room And Unit Size

Unit dimensions become sampled distributions, not constants:

- compact studios
- wide shallow one-bed units
- deep two-bed family units
- corner premium units
- loft/duplex variants when floor height permits
- leftover sliver absorption so plans fill without dead bays

Ground-floor frontage can vary between unfinished amenity shells, retail shells, lobby
lounges, mail/package rooms, co-working rooms, and glass-front residential amenities.

### Layout Grammar

Each building gets a layout type:

- double-loaded corridor
- single-loaded daylight corridor
- corner-core plate
- central-core plate
- courtyard-facing corridor
- podium amenity plate
- tower-on-podium repeated floor plate

Layouts must produce actual circulation: entry -> lobby -> lift/stair core -> floor
corridor -> units.

### Facades

Facade style becomes a seeded registry:

- `curtain-wall`: current glass-and-mullion language
- `balcony-grid`: repeating balcony/loggia cells, like city condo slabs
- `masonry-punched`: warm masonry with regular punched windows
- `concrete-frame`: expressed structural piers with glass infill
- `podium-retail`: ground-floor storefronts with residential tower above
- `mixed`: podium facade differs from tower facade

Facade choice should be per building, with a complex-level palette keeping the ensemble
coherent.

### Amenities

Amenities are optional, additive, and position-seeded:

- concierge desk
- mail wall
- package room
- lounge seating
- co-working room
- gym
- garden courtyard
- water feature
- art wall
- roof terrace or podium deck

Turning amenities on should not scramble the core site/building seed stream. Use local RNGs
for additive amenities, following `fractal-city`'s pedestrian/cyclist pattern.

## Reuse Existing Pieces

Do not rebuild the proven geometry vocabulary. Reuse or extract from:

- `architecture/condo-entrance.js`
  - chamber/lobby language
  - hallway + unit-slot logic
  - curtain walls
  - floor-2 plate and ceiling articulation
  - flow/livability/egress assessments
- `architecture/condo-unit-fitout.js`
  - unit and apartment furnishing
- `polygonizer/floorplan-building-assets.js`
  - lobby sofas, benches, plants, feature table, medallion, glass entrance, lift banks
- `architecture/building-facade.js`
  - city-scale condo facade ideas, especially balcony/loggia rhythm
- `worlds/movement-flow.js`
  - poison-arrow / desire-line checks
- `scene/scene-css3d.js` and `scene/scene-three.js`
  - shared World payload, cameras, walk mode, signage, .glb export path

Extraction plan, corrected for slice 1: `fractal-condo.js` IS the second caller, so the seam
must open in slice 1 — but the cheap, low-risk form of the seam is EXPORTING the needed
private helpers from `condo-entrance.js` (`chamberFaces`, `hallwayFaces`, `unitSlots`,
`coreBankLayout`, `facadeColumnFaces`) rather than moving 700 lines into new files while the
generator is still forming. The module split happens in slice 2, when the facade registry
makes `condo-entrance.js` genuinely unmanageable. Candidate modules for that split:

```txt
architecture/condo-lobby.js       chamber/lobby/furnishing helpers
architecture/condo-facades.js     curtain wall + balcony/masonry/concrete variants
architecture/condo-layouts.js     unit slot and floor-plate planners
architecture/condo-assess.js      flow/livability/egress checks
architecture/fractal-condo.js     generator orchestration
```

## Determinism Rules

- Same `spec + seed` must produce byte-stable geometry.
- EVERY sampled axis draws from its own LABELLED sub-stream derived from
  `(seed, stableLabel)` — not just decorative layers, and never one shared sequential
  stream. Adding a new knob in a later slice must not reshuffle what existing seeds
  render. (`condoStream(seed, 'lobby')`, `condoStream(seed, buildingId, 'facade')`, …)
- `pattern: 'auto'` is only seed-stable WITHIN a release: growing the auto pool in a later
  slice changes what existing `auto` seeds resolve to. This is accepted (recipes are cheap,
  nothing is baked), and mitigated: the RESOLVED pattern is recorded in the plan output, so
  a caller who wants to pin a complex copies the resolved value into the recipe.
- A recipe naming an unimplemented or unknown pattern/facade FAILS LOUDLY. No silent
  fallback — a recipe that renders as something other than what it names is worse than an
  error.
- New feature flags should be additive whenever possible.
- Existing `condo-entrance` tests should remain green.
- The generator should store only the recipe, never faces.

## Assessment Contract

Every generated complex should carry assessment payloads, not just geometry:

- `flow`: no entry axis spears a lift bank or hard obstruction.
- `livability`: every residential unit has at least one exterior/daylight wall.
- `egress`: every building has a lift plus accessible stair route.
- `reachability`: every public area, core, amenity, and unit corridor is connected.
- `facade`: every unit requiring daylight maps to a valid facade/window segment.

Necessary impairments fail the spike tests. Preferential issues can be reported but should not
block the first slice.

## First Slice

Build a minimal `condo-complex` world kind using the existing condo renderer vocabulary.

Scope:

- new file `architecture/fractal-condo.js`
- `planFractalCondoComplex({ seed, pattern:'auto' })`
- sample `buildingCount` in `[1..4]`
- choose one of three patterns:
  - paired towers
  - three-wing complex
  - courtyard complex
- vary:
  - central lobby size
  - hall length/width
  - units per side
  - unit depth/back depth
  - satellite size
  - facade style at least between `curtain-wall` and `concrete-frame`
- assemble through existing face builders
- expose `assembleFractalCondoScene()`
- wire `kind:'condo-complex'` into `WORLD_RENDER_KINDS` and `resolveWorldScene()`

Acceptance:

- two seeds produce different building counts or site patterns
- same seed is stable (byte-identical plan and faces)
- every scene has faces, cameras, walk spawn, and assessment payloads
- default seeds pass flow/livability/egress
- reachability: the walk spawn can reach every building's lobby (the concourse graph is
  connected from the entrance building) — multi-building circulation is real geometry from
  slice 1, not a slice-3 retrofit
- an unimplemented pattern (`spine`, `garden-campus`, `podium-towers`) throws
- `/world` and `.glb` resolve through the same world-scene payload

## Structure Completion (BIM Skin) — landed with slice 1

The open shells didn't read as finished buildings, and the concrete-frame column march ran
around the SITE bounding box — leaving free-standing piers in open air wherever the box
crossed nothing. Both fixed by making the solid masses explicit:

- `structureEnvelopes(plan)`: each building footprint plus each concourse's hall+unit strip
  — ONE source for the column march, the roof skin, and the no-straggler test invariant
  (no baked face may stand off every envelope).
- Facade columns march each envelope, never the site bounds.
- BIM completion skin (`structure: true` in the recipe, on by default; plan views opt out):
  - roof plate + parapet ring on every envelope (underside doubles as the interior ceiling)
  - lift-overrun bulkhead over every building's bank footprint (the shaft has to end
    somewhere)
  - rooftop HVAC unit + stub vents per building, jitter-placed via `condoStream(seed, id,
    'roof')` with bounded deterministic rejection off the bulkhead
  - a washroom stub vent through the wing roof over every unit's WC corner
- Toggling the skin never perturbs the site/building seed streams (labelled streams).

## Tower Stacking — landed with slice 1

The "repeated with selected floors furnished" answer, realized: every building carries a
`floors` count and rises as REPEATED FLOOR GRAMMAR above its furnished ground chamber.

- Recipe knob `floors`: `'auto'` (default) samples a tier per building from
  `condoStream(seed, buildingId, 'floors')` over `FLOOR_TIERS = [12, 20, 30]`; an integer
  pins every building; anything else throws. Pinning floors cannot reshuffle the site
  (labelled streams).
- The shell (`towerShellFaces`): per upper storey, a solid projecting floor-plate band
  (underside seals the storey below — floor 1's band is the lobby ceiling) with glazing
  slid in behind it. Curtain-wall keeps glass at the wall plane; concrete-frame recesses
  it behind the expressed piers, which now run the full tower height.
- The BIM skin (roof plate, parapet, lift-overrun bulkhead, HVAC, vents) caps each
  envelope's ACTUAL top (`buildingTopZ`), not the ground plane. Wing strips stay 1 storey.
- Upper floors are massing + facade only; furnishing selected upper floors is the slice-2/3
  follow-on (daylight assessment for repeated floors is already queued in slice 2).
- Cameras: the plan camera clears the tallest tower; a `skyline` camera joins plan + lobby.
- LOBBY CROWN: the middle section (role `lobby`, which always carries the shared lift core)
  expresses that core as a stylized stepped GLAZED LANTERN on its roofline — base tier,
  clerestory glass, projecting cornice, finial + spire — where towers keep the plain
  lift-overrun bulkhead. Applies at any height (podium or tower), gated on
  `elevators > 0`, pure deterministic geometry off the bank footprint.

## Balcony Primitive — landed early (first slice-2 facade)

`balconyFaces` is the life-sized port of fractal-city's balcony grammar (building-facade.js
`addBalcony`, which works in city box units): a 4.6ft cantilevered floor slab off the wall
plane with a 42-inch code guard (BIM), in two styles — `glass` (panel + top rail between
corner posts) and `rail` (balusters). Exported as a standalone primitive for reuse.

The `balcony-grid` facade joins the registry: towers hang one balcony row per repeated floor
on their two BROAD faces (slab-condo massing); the resolved guard style is sampled per
complex from `condoStream(seed, 'balcony', 'guard')` and recorded in the plan. The
no-straggler invariant runs balcony-grid with a 5ft margin (the cantilever).

## Building Variations — landed with slice 1

Three sampled variation axes, each on its own labelled stream, each pinnable in the recipe:

- `form: 'auto' | 'rect' | 'round'` — per building (~1 in 3 auto towers goes round). A round
  building keeps its RECT ground podium (the proven furnished chamber, openings, lift bank)
  and rises as a glazed CYLINDER: per-storey band discs + a mullioned glass drum, capped by a
  disc roof with a circular parapet. Its rooftop core expression CENTRES on the disc (round
  towers have central cores). Round towers skip balcony rows for now (curved balconies are a
  queued follow-on). Assessments are untouched — the plan rect stays the footprint.
- `glass: 'auto' | ice | steel | forest | bronze | midnight` — the window palette
  (GLASS_TINTS), one entry per complex for ensemble coherence, resolved name recorded.
- `clearGlass: 'auto' | true | false` — translucent panes (alpha 0.45 via the renderer's
  per-group translucent pass): curtain-wall vision glass, unit storefronts, balcony glass
  guards, and round-tower drums all join a `glass` render group, so the FURNISHED ground
  floor layouts read through the windows. Solid by default ~60% of auto seeds.

## Second Slice

Add richer facades and unit variation.

- facade registry with `curtain-wall`, `balcony-grid` (done), `masonry-punched`, `concrete-frame`
- per-building facade choice with complex-level palette
- unit mix distributions
- corner/premium units
- single-loaded corridor option for daylight/courtyard buildings
- assessment checks that floor-2 and repeated-floor units have daylight, not only ground units

## Third Slice

Add amenities and podium logic.

- generated mail/package/concierge/lounge/gym spaces
- courtyard garden with seeded paths, trees, water, seating
- podium deck / roof terrace
- podium + tower massing
- signage anchors for lobby, tower names, amenities
- richer cameras: site plan, lobby, courtyard, facade, floor plate

## Fourth Slice

Make the condo generator a first-class creation surface.

- MCP tool or `compose_world` base adapter
- view-vocab entry
- examples/seeds in tests
- optional maker/gallery category entry
- docs explaining the recipe knobs

## Non-Goals For The Spike

- No zoning/code simulator beyond the existing assessment contract.
- No full high-rise stack with hundreds of unique floors in slice 1.
- No PBR/material rewrite; keep baked vertex-color faces.
- No destructive rewrite of `condo-entrance.js`; extract only when the second caller proves the seam.
- No UI-first builder. The operator creates it through recipe/MCP paths.

## Open Questions

- Should `condo-entrance` remain a specific world kind, or become a preset of
  `condo-complex`?
  ANSWER: preset of condo complex
- Should tower floors be represented explicitly per floor, or by repeated facade/floor
  grammar with only selected floors furnished?
  ANSWER: repeated with selected
- How much of `building-facade.js` should be reused directly versus mirrored into
  condo-specific facade cells?
  ANSWER: only what is necessary
- Should courtyards be outdoor walkable worlds with landscape/fog channels, or simple
  ground/face geometry at first?
  ANSWER: worlds should always be walkable
- Should generated units be inspectable/pickable groups by building/floor/unit id?
  ANSWER (split): stable ids by building/concourse/unit land in the plan model in slice 1
  (they cost nothing and cannot be retrofitted without breaking seeds); any
  picking/inspection UI is deferred indefinitely.

## Spike Output Targets

- `condo-complex-paired`
- `condo-complex-courtyard`
- `condo-complex-podium`
- `condo-complex-facades`
- `condo-complex-lobby`
- `condo-complex-floorplate`

Each target should be generated from a tiny recipe and seed, not from stored geometry.
