# condo-entrance — a condo complex ground floor as a chamber graph

Status: SPIKE. New sibling to `subway-building.js` (one building, two levels) and
`polygonizer/floorplan-building.js` (one floor plate). This composes MANY ground floors into
one connected concourse: a **central entrance chamber** linked by **hallways** to **satellite
chambers** — the ground floors of the other condo towers — each with its own elevator core, the
hallways lined with **empty units** (unfinished glass-front shells, "for lease").

## Premise

The single building gave us the lobby vocabulary (a double-loaded-hallway lift core, marble
floor, plants/benches/feature-table, glass+concrete entrance). A condo *complex* is the next
move up: the node-and-corridor graph the dungeon-designer uses for caves, applied to lobbies.
A central node is the shared address; corridors fan out to the other towers; the corridors are
revenue frontage (retail/amenity units) that happens to also be the circulation.

This is its own module, NOT a branch in floorplan-building — the unit of composition is the
whole *graph* (chambers + connecting halls + units), not one plate.

## Model

```
planCondoEntrance(spec) → { central, wings:[{dir, hall, sat, satCoreWall}], bounds, baseZ, height, spawn }

spec = {
  height,                            // storey height (ft)
  central: { w, d, elevators },      // central chamber size + lift count (>4 ⇒ 2 hallways)
  hall:    { length, width },        // each connecting corridor
  units:   { perSide, depth },       // empty units lining each corridor
  sat:     { w, d, elevators },      // each satellite tower's ground floor
  wings:   ['W','E', ...],           // which directions branch off the node (default W+E ⇒ 3 rooms)
}
```

- **Chamber** (`chamberFaces`): marble floor slab, perimeter walls with openings (passages to
  halls + the street entrance), a **lift core** against one wall facing in, and doodads (corner
  plants; the central node also gets the round medallion + feature table + sofas + the
  glass+concrete street entrance). A wall named in `glaze` is built as a **glass curtain-wall
  facade** instead of plaster: the central STREET wall is glazed (the entry facade), and each
  satellite tower glazes every exterior wall (all but the hall passage) — a glass pavilion.
- **Curtain wall** (`curtainWallFaces`): the shared exterior read — floor-to-ceiling vision
  glass split into bays by vertical mullions + a mid transom, banded by opaque spandrel panels
  at the sill and head. Used by both the chamber facades and every unit's exterior back wall.
  Prominent glass is the building's whole exterior register.
- **Lift bank** (`liftBankFaces`): cabs FLUSH in a row against the wall opposite `facing`
  (∈ N|S|E|W = the door direction into the chamber), the workbench `buildElevatorBank` fronting
  them so they read as lifts. Default counts: **3 in the central node, 2 per satellite**.
  **Feng shui**: the bank is OFFSET along its wall (off the perpendicular entry/passage lane)
  so the street entrance and the hall passages never face a lift head-on (no poison-arrow
  straight shot from door to lift); corner plants are kept off the bank footprint.
- **Hallway** (`hallwayFaces`): a marble corridor with two side walls carrying storefront gaps,
  and the **bachelor units** on both sides.
- **Unit** (`unitFaces`): a glass-front apartment off the hall with an enclosed WASHROOM
  carved into a back corner (an L of partition walls + a door + a WC). The hall side is a glass
  storefront; the back (exterior) wall is a GLASS CURTAIN WALL — the unit's WINDOW and its part
  of the repeating facade. The interior is FRACTALLY FURNISHED per unit — `furnishUnit`
  (condo-unit-fitout.js) seeds the fit-out from the unit's world position, picks an apartment
  archetype (studio / one-bed / loft), recursively subdivides the interior into program zones,
  and furnishes each (bed / sofa / galley counter / desk / rug). Deterministic + varied
  unit-to-unit. See condo-unit-fitout.plan.md.
- **Unit slots** (`unitSlots`): where the units sit along a hall (both sides) — ONE source for
  the renderer (`hallwayFaces`), the livability check, and the ceiling articulation.
- **Articulated floor plate → a real 2nd storey** (`floorPlateFaces`, opt-in `plate:true`): a
  full-rectangle plate STACKED over the whole footprint (bounds). Its UNDERSIDE is the ground-
  floor ceiling, articulated per space: a coffered grid + downlights + a pendant chandelier over
  the lobby (`cofferedCeiling` grand) and each satellite (not grand); a dropped soffit run with a
  row of downlights down each hall (`hallCeiling`); a lighter tray + a flush light in each unit
  (`unitCeiling`). Where the plate overhangs a VOID between the arms, the flat soffit reads (the
  entrance canopy / a covered plaza). Above it sits the **2nd storey**: a PROMINENT projecting
  floor band (`plateBand`) with the 2nd-floor **glazing SLID IN behind it** (`curtainWallFaces`
  `inset`/`outSign`), so the floor-plate edge reads proud of a recessed ribbon window — the
  expressed-floor-plate effect — capped by a roof parapet. Default OFF so the open-top
  plan/facade/unit reads are unchanged; on for the ceiling / massing / elevation views.
- **Vertical cores** (the vertical concern): the lift cores are now shafts that RISE THROUGH the
  plate and open on floor 1 — `floorPlateFaces` repeats `liftBankFaces` at the 2nd-storey level
  for every core (central + satellites), so cabs stack into a continuous shaft and the elevators
  actually connect the two levels. `cores` (rect + coreWall + count + voidSides) is collected once
  in `buildCondoEntranceFaces`; it is also the natural home for STAIRS later (same shaft rects).
- **Floor-2 plan — one building per elevator** (`buildingFloorTwo` + `furnishApartment`): an
  elevator core signifies a DISTINCT BUILDING, so each core's footprint on floor 1 is BLOCKED OFF
  (demising walls on `voidSides` — the walls facing the connecting halls) and laid out as an
  apartment floor: a corridor off the core lobby with **1BR and 2BR** units (mixed by a seeded RNG)
  facing the exterior facades. To fill the plate (no dead space), each building's floor-2 footprint
  is EXPANDED (`floor2Rect`) to claim its half of the hall voids — buildings meet at a shared
  demising midline — so the corridor runs the full width with units packed both bands (the packer
  absorbs leftover slivers into the last unit). `furnishApartment` (condo-unit-fitout.js) is the
  flat: entered from the corridor, an enclosed bath + galley kitchen against the entry wall, living
  + bedroom(s) facing the window — reusing the ground-floor room furnishers. `plateRoof:false`
  drops the roof cap so the floor-2 plan reads top-down.
- **Concrete facade columns** (`facadeColumnFaces`, `columns` on by default): exposed structural
  piers marching around the whole envelope, projecting proud of the glass, full building height,
  with rhythmic variety (a broad pier every third bay) — the concrete-frame + glass-infill read.
- **Core lobby + accessible egress stair** (`coreZone` + `stairBlockFaces`): each building's core
  is a lift bank PLUS an accessible switchback stair (`buildSwitchbackFlight` — landings +
  handrails) in a fire-rated enclosure, both THREADING ground → floor 2. `coreZone` is the single
  source of the lobby footprint so the floor-2 unit packing reserves the whole lift+stair block.

Placement: the central chamber sits at the origin; each wing lays a hallway off the matching
wall and a satellite chamber at its end (satellite lift core on the far wall, facing back in).
The central core defaults to the north wall (clear of the W/E passages + south entrance); if an
N wing is present it moves to the south wall.

## Pipeline

```
planCondoEntrance(spec)
  → buildCondoEntranceFaces(spec)        // central chamber + per-wing { hallway+units, satellite }
  → assembleCondoEntranceScene(spec,opts) // + cameras (plan, concourse) + walk spawn
  → renderCondoEntranceToThreeWorld / ...ToHtml
```

Cutaway, open-top (no roof) — the floor-plate read, like the building spike.

## Spike acceptance (condo-entrance.spike.gen.test.js → 0629/spike-output/condo-entrance)

- `condo-plan` — top-down: central node (6-lift core, medallion + feature table, street
  entrance) + two hallways lined with glass-front units + two satellite towers, each with its
  own lift core.
- `condo-concourse` — eye level down a hall: units left/right, a tower's lift bank at the end.
- `condo-plan-3wing` — the W+E+N "T", a third tower off the north hall.
- `condo-units-plan` — top-down tight on the west hall: the fractally-furnished apartments.
- `condo-units` — raised 3/4 bird's-eye over the open unit tops: beds / galleys / washrooms in 3D.
- `condo-facade` — exterior north elevation of the west hall: the repeating glass curtain-wall.
- `condo-plate-massing` — 3/4 of the 2-storey massing (plate on): ground-floor unit bays, the
  prominent floor band, the 2nd-floor glass slid in behind it, roof parapet.
- `condo-plate-elevation` — eye-level north elevation: the floor band proud of the recessed
  2nd-floor ribbon glazing (the expressed-floor-plate effect).
- `condo-ceiling-lobby` / `condo-ceiling-hall` — worm's-eye UP at the articulated ceilings:
  lobby coffers + chandelier + downlights; the hall soffit run + unit ceilings.
- `condo-floor2-lift` — inside the 2nd storey: the lift bank arriving upstairs (the vertical
  concern realized).
- `condo-floor2-plan` / `condo-floor2-central` — floor-2 plan (roof off): each elevator = a
  building, blocked off and laid out with 1BR + 2BR units off a corridor.

The spike runs THREE assessments per world and `expect`s them ok: FENG-SHUI (`assessCondoFlow` —
no poison arrows), LIVABILITY (`assessCondoLivability` — every unit has an exterior window), and
BIM EGRESS (`assessCondoEgress` — every building can host an accessible stair + a lift threading
its floors). A regression on any of the three fails the spike, not just an eyeball.

## Deferrals / open

- The 3-wing central puts the core + street entrance both on the south wall (they crowd); the
  clean default is 2 wings (core north). A freestanding central core island would fix the
  many-wing case — deferred.
- Marble/concrete are flat tints here (no tile texture yet); add `marble-carrara` like
  subway-building if the floors read too plain.
- Feng-shui / movement-flow check IS wired: `assessCondoFlow(plan|spec)` declares the
  circulation graph (each chamber's entry/passage openings + its lift-bank footprint) and runs
  the shared `assessFengShui` (movement-flow.js) — each entry fires a ray into the room and a
  lift bank it pierces is an `axial-through-shot` (poison arrow). The assembled scene carries it
  as `scene.flow`, and the render spike `expect`s `flow.ok` (a poison-arrow layout fails the
  spike instead of being caught by eyeballing) + logs `reportFengShui`. `coreBankLayout` is the
  single source of the bank footprint so the assessor and the renderer can't drift. Deeper
  desire-line / command-position checks (occluded centre, rest-corner) are still TODO; only the
  necessary poison-arrow rule is enforced today.
- Livability check IS wired + FORCED: every unit's back wall is built as an exterior glass
  curtain wall (a guaranteed window), and `assessCondoLivability(plan|spec)` verifies each
  unit's back wall faces open air (a window inside another chamber gives no daylight ⇒ a
  `no-window` necessary impairment). Carried as `scene.livability`; the spike `expect`s
  `livability.ok`. `unitSlots` is the single source of unit placement for renderer + check.
  Only the window rule is enforced; daylight-factor / room-depth livability rules are TODO.
- Floor 2 is a real, filled per-building apartment plan (1BR/2BR, corridor, accessible stair +
  lift core, concrete facade columns), but it is ONE storey; a true multi-storey stack
  (`floors: N`) would repeat `buildingFloorTwo` + the ceiling articulation + the core (lift/stair)
  per level. The stair currently threads only ground → floor 2; a taller stack extends it. Floor-2
  units get an exterior facade by construction but don't yet run through `assessCondoLivability`
  (it targets the ground-floor `unitSlots`) — wiring the window check to floor 2 is a TODO. Ceiling
  styling is coffers/soffit/tray; cove lighting + a lobby dome are the natural next articulations.
