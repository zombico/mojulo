# floorplan-building — the commercial floor as a stackable primitive

Status: PLANNED. New sibling to the house concern. Reuses the structure concern
(`buildWallGraph → placeOpenings → extrudeWalls`) and the MERU stack from
`floorplan-structure.js`; swaps the dwelling program for a commercial floor program
and adds the persistent vertical CORE. Spike target: two floor uses — a standard
cafe/bistro floor and a double-height office lobby (security desk + elevator columns) —
stacked over one core.

## Premise

A house and a commercial building are the SAME vertical-stacking move with two
concerns swapped. `structurizeHouse` already stacks levels flush along the meru with
per-floor heights and a stair seated per floor-pair. A building inverts the floor
plate's shape: instead of rooms laid out by a privacy gradient, one large open
TENANCY wraps a fixed CORE. So this is a new sibling generator, NOT a branch inside
`generateProgramPlan` — folding "cafe" into the livability machinery would violate the
no-paradigm-branches rule.

The unit of composition is ONE FLOOR PLATE. A floor of any *use* (concern) is the
primitive; a building is a stack of plates over a shared core. This is what lets us
"stack other floors of various concerns later" without each floor re-deciding where
the elevators are.

## What's reused (do not rebuild)

From `floorplan-structure.js`:
- **Structure concern** — `buildWallGraph` (relate), `placeOpenings` (doors/windows),
  `extrudeWalls` (thick 6-face boxes, jambs/lintels/sills). A floor plate still has a
  perimeter envelope + interior partitions (restrooms, back-of-house, core walls).
- **The MERU** — `houseMeru` + `resolveStack(levels)`. Per-floor heights already
  accumulate and stack flush, so a double-height lobby is just `height: ~20`; the
  floor above lands at the right z for FREE. No new vertical math.
- **Slab + slab holes** — `structurizeFloorplan`'s `slabHoles` / `ceilingHoles` cut
  the stair/shaft void through the floor above (the precedent the core generalizes).
- **Stair primitive** — `placeStairs` / the stepped-solid flight, for the egress stair
  inside the core.
- **Fit-out as boxes** — the room-furniture face pipeline (`extractRoomSceneFaces` /
  the box extrude). Massing elements are just boxes with a `heightWorld` budget.
- **View modes + emit** — cutaway (open-top) / xray, CSS-3D + three.js, via the same
  `assembleFloorWorldScene` / world-scene seam.

`FLOORPLAN_DEFAULTS` (wall thickness, head line, finishes) carry over unchanged.

## What's new

### 1. The CORE — persistent vertical column

The real new primitive. Declared ONCE at the building level and threaded into every
floor so it lines up vertically:

```
core = { x, y, w, h,        // fixed footprint, same on every plate
         elevators: n,      // n cabs in a bank
         stair: true,       // egress stair
         services: true }   // riser / utility closet
```

Each floor RESERVES the core rect (the `reservedOpen` precedent from
`generateProgramPlan`, generalized from "stair zone" to "core") and the tenancy wraps
around it. The core renders as ACCURATE MASSING BOXES (per the fidelity call):
- elevator bank → one box per cab + a shared shaft wall, with door faces on the
  tenancy side (no cab cabin / animation — refine in workbench later);
- egress stair → the existing flight primitive (or a boxed stair for the spike);
- services → a closed box on the core wall.

The core's footprint cuts the slab hole on every plate (shaft continuity), the same
`slabHoles` move stairs already use.

### 2. Floor USE table — sibling to ARCHETYPES / HOUSE_TIERS

Each *use* declares its storey height, whether the core is exposed or walled, and its
fit-out. Open/extensible — cafe + office lobby now, retail/etc. later.

| use | height (ft) | core read | fit-out |
|---|---|---|---|
| `cafe` / `bistro` | ~11 | walled (doors only) | a SURFACE-AREA BUDGET allocated to bar / counter / seating (see below) |
| `lobby` (concierge) | ~20 (double) | exposed (the elevator hall is the anchor) | a CONCIERGE LOBBY: concierge desk + lounge + plants + art around the entry and the elevator hall (see below) |

Fit-out elements are `{ footprint, heightWorld, tint }` massing boxes — surface-area +
height budget, blocked in to occupy the space accurately, not furnished in detail.

### 2a. Surface-area BUDGET allocation (the cafe model)

The commercial analogue of the house's `archetypeArea` budgeting. Rather than hand-placing
boxes, a use declares a PROGRAM: a `circulation` reserve + weighted zones. `allocateAreas`
splits the tenancy's usable surface area — reserve circulation, then divide the rest by
weight — and each zone is sized to CONSUME its budget:

- `cafe`: `circulation 0.34` + `bar 0.22 · counter 0.13 · seating 0.65`.
- **bar** → a linear element on the back wall; length = barArea / BAR_DEPTH (back bar +
  die + stools).
- **counter** → a linear element on the core-side wall; length = counterArea / COUNTER_DEPTH.
- **seating** → table modules filling the central region; count = seatingArea / TABLE_MODULE,
  so SEATS SCALE WITH THE PLATE (a bigger floor seats more, not bigger tables).

`buildFloor` returns the `program` report (`{ usable, areas, seats }`) so the budget is
introspectable/testable. Other uses plug in their own program; the office lobby skips the
allocator (one desk over an open floor).

### 2b. Plan coherence FIRST, then items (the "mandala")

Items are allocated into a coherent plan, not scattered. `buildFloor` seats the street entry
deterministically (tenancy centre) and derives a CLEARANCE CONTEXT — the negative space items
must respect:
- the **elevator-lobby opening** (so the cabs stay reachable), and
- the **entry throat** (a clear lane in front of the door), when the floor has a street entry.

The fit-out adds its own zone clearances (the bar + stool service strip; the order-counter
queue) and only then tiles the seating FIELD with aisles, skipping any table whose footprint
(table + chairs) overlaps a clearance. So the doorways and the elevator approach always read
as clear circulation. The order counter is forced into the front segment of the core wall so it
never blocks the elevator opening; the security desk is set back beyond the entry throat.

### 2b-bis. The CONCIERGE LOBBY (ground-floor rebuild, FENG-SHUI layout)

The lobby fit-out was rebuilt from the spare security-desk placeholder into a coherent
concierge floor (`conciergeLobbyFitOut`), laid out by feng-shui principles around the two
fixed givens — the street ENTRY (south, the mouth of qi) and the ELEVATOR HALL (the cab bank
on the core wall):

- **Bright hall (ming-tang)** — the space just inside the doors is kept open; the deep central
  aisle clearance is RELAXED for the lobby so qi gathers and meanders. A round FLOOR MEDALLION
  (flush inlay) + a round FEATURE TABLE with blooms anchor it (round shapes circulate qi; flow
  passes AROUND the centrepiece).
- **Water fountain** in the foyer on the lift side, clear of the door lane and lift hall —
  moving water draws prosperity inward.
- **Concierge desk in the COMMANDING POSITION** — set off the far wall (solid back for support,
  clear sightline to the entrance), front third, facing into the room; never blocking the door.
- **Entry screens** flank the doors as a threshold buffer (qi should not rush straight in).
- **Lifts that READ** — the cabs front onto the opening plane (shaft + services behind), fronted
  by the workbench `buildElevatorBank`: a flush bright face whose doors are outlined by a dark
  recessed JAMB + a crisp centre SEAM (so each cab reads as a centre-opening sliding pair),
  with a header lintel, sill, indicator and call panel. Read at eye level via a "concourse"
  camera — lift doors live on a vertical face, so the aerial can't show them.
- **The lift core is DOUBLE-LOADED HALLWAYS** (the "E"/comb read in PLAN, top-down). For an
  open lobby (`eHallwayLiftFaces`) hallway slots are cut into the core from the lobby; each is
  lined with a lift band on BOTH walls (workbench bank doors facing into the slot), so you walk
  a corridor with lifts left and right. ≤4 lifts → one hallway (2 a side); >4 → TWO parallel
  hallways sharing a back-to-back MIDDLE bank — the canonical "8 lifts in 2 hallways" (3 banks,
  2 slots). `coreLayout` derives `nHalls`/`liftsPerSide` from the cab count and reserves the
  assembly span; it scales with the building. A walled core (cafe) keeps the packed
  `liftBankFaces`. Read top-down via a "plan" camera.
- **Glass + concrete street ENTRANCE** — the lobby cuts a grand CASED opening (no swung leaf;
  `placeEntryDoor` now propagates `kind`) filled by the workbench `buildGlassEntrance`: a
  concrete portal (jambs + header), paired framed-glass doors with a centre stile + pull bars,
  a glass transom, a cantilevered concrete canopy, and a threshold step — modern glass/concrete.
- **Waiting lounge** at the back (away from the entrance current): a ROW of sofas scaling with
  width, a plant between pairs, art over each; **marble benches** down the far wall behind the
  desk; **houseplants** activating the corners + framing the lift hall.
- **Five elements**: WATER (fountain) · WOOD (plants) · METAL (lifts) · EARTH (marble) · FIRE
  (warm art + indicator lamps). Stone register throughout — **no wood** underfoot (the café
  above keeps its floorboards; the contrast reads in the stack).
- New items in `floorplan-building-assets.js`: `buildConciergeDesk`, `buildLobbySofa`,
  `buildLobbyBench`, `buildHousePlant`, `buildFountain`, `buildFeatureTable`,
  `buildFloorMedallion`, `buildEntryScreen` (+ the `MARBLE` palette). Placement uses clearance
  checks so the door throat and lift hall always read as open circulation.

**Elevators scale with building size.** `sizedElevatorCount({floors, fpDepth})` drives the cab
count off population (a pair per ~2 floors, +1), bounded by what the core depth can hold and
clamped to `[elevatorMin, elevatorMax]`. Resolved once at the building level and lined up
identically on every plate — bigger building ⇒ more cabs ⇒ a wider elevator hall.

### 2c. Item size variation

Bistro tables come in several sizes (`TABLE_KINDS`: a 2-top + larger tops), each declaring the
floor area it consumes; the seating budget is spent down table-by-table, so a plate mixes sizes
and the count still tracks the area budget. Items themselves are workbench-authored
(floorplan-building-assets.js): bistro table, café chair, bar stool, bar die, back bar — each a
parametric monomer manifest sized to its box, baked via `assetFaces`.

### 2d. Wall styling (facade + interior, brick spans both)

`stackBuilding` / `buildFloor` accept `facade` (exterior skin: `'siding'|'brick'|'tofu'`),
`interiorWall` (interior finish: `'paint'|'wainscot'|'wallpaper'|'brick'`), and the
`material:'brick'` shorthand that sets BOTH — exposed brick inside, brick facade out, via
the shared `floorplan-structure.js` decorators (`facadeDecor` + the `interiorWallStyle`
override on `interiorWallDecor`). Same knobs as the restaurant.

### 3. NO ROOF (spike scope)

`stackBuilding` does NOT cap the top storey — open-top cutaway read, just the floors.
Roof/facade is explicitly out of scope for this spike.

## The primitive boundary

- `buildFloor({ use, height, core, footprint, seed })` → `{ faces, plan, tenancy }`
  — sibling to `structurizeFloorplan`. Reserves the core, lays the tenancy partitions
  (restrooms / BOH), runs the structure concern, then fits out the tenancy with massing
  boxes and drops in the core boxes.
- `stackBuilding({ floors:[{ use, seed }], core, footprint })` → `{ meru, levels, faces }`
  — sibling to `structurizeHouse`. Resolves the meru stack from per-use heights, calls
  `buildFloor` per level with the shared core, stacks flush, cuts the shaft slab holes.
  No roof, no perimeter for the spike.

## Pipeline

```
stackBuilding({ floors, core, footprint })
  → meru.resolveStack(floors)              // per-use heights; lobby double-height stacks next floor higher
  → for each floor:
      buildFloor(use, footprint, core, seed)
        ├─ reserveCore(core)               // reservedOpen, generalized to the core rect
        ├─ tenancyPartitions(use)          // restrooms / BOH walls (few — plate is open)
        ├─ buildWallGraph → placeOpenings → extrudeWalls   // REUSED structure concern
        ├─ fitOut(use, tenancyArea, core, seed)            // accurate massing boxes
        └─ coreFaces(core)                 // elevator boxes + egress stair + services
  → stack flush via meru, cut shaft slabHoles through every plate
  → emit cutaway (open-top, NO roof)
```

## Spike acceptance

Two floors stacked over one core:
1. `lobby` on the ground (double-height) — security desk, open lobby, elevator columns.
2. `cafe` above — tables, counter, BOH, restrooms wrapping the core.

Proves: the core lines up vertically and its shaft punches both slabs; per-use heights
stack flush (the cafe floor sits at the lobby's full height); each plate's fit-out
reads as accurate blocked-in massing; cutaway open-top read with no roof.

## Where it wires in

- New `control/lib/graph/polygonizer/floorplan-building.js` — `buildFloor`,
  `stackBuilding`, the `FLOOR_USES` table, `fitOut`, `coreFaces`. Imports the structure
  concern + meru from `floorplan-structure.js`; does not modify the house path.
- New `floorplan-building.test.js` — core lines up across floors (same x,y,w,h);
  shaft slab hole cut on every plate; per-use heights resolve (lobby > cafe); fit-out
  box count + footprint-within-tenancy per use; `node --check` the module.
- Recipe/world-scene exposure (a `building` kind) — deferred until the geometry reads.

## Open questions / deferrals

- Mezzanine / balcony overlooking the double-height lobby — POLISH, deferred.
- Egress stair: reuse the full flight primitive, or a boxed placeholder for the spike?
  Lean: real flight (already built), boxed only if seating it in the core fights the
  reserved rect.
- Tenancy partitioning: hand-tuned fit-out per use is enough for the spike (block in
  accurately); a generator driving partitions is a later refinement.
- Exterior view + roof + facade: out of scope; add later as the house already does.
