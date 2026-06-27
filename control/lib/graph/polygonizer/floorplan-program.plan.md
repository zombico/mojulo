# floorplan program generator — open-space-first layout intelligence

Status: IN PROGRESS. New generator `generateProgramPlan` in `floorplan-glyphs.js`,
wired into `structurizeHouse` as the default house generator (the fractal BSP
`generatePlan` stays as a fallback via `input.bsp:true` / `corridors:true`).

## Why

The BSP `generatePlan` tiles the footprint by recursive random splits, then sorts
rooms by area to label them. It has no notion of OPEN SPACE — every adjacency
becomes a wall. Real houses are organised the other way round: an open public
core is the organising void, and private rooms hang off it.

## The model (the operator's three principles)

1. **Open space is the seed, not a leftover.** Reserve a contiguous public core
   (living + kitchen + dining) as ONE wall-less cell. The structurizer emits no
   interior walls within a single cell, so "living + kitchen, no wall" is free.
2. **Rooms connect to the open space.** Private rooms (bed/bath/office/storage)
   are carved against the core, each doored straight onto it.
3. **Halls + doors balance the surface-area budget.** A hall is spent only when a
   room can't reach the core; doors are one-per-room onto the core or hall.

## Decisions (operator)

- **Open at every size.** The public core is always one open cell; bigger house =
  bigger core AND bigger rooms (budget raises both core depth and min room size).
  Walls only ever appear around private rooms.
- **Direct off core, hall as needed.** Ground privates sit in one row touching the
  core (direct doors). Upper floors are bedrooms off a hall/landing (the hall IS
  the open circulation upstairs).

## House tiers — read as a house, not a dorm (operator)

The furniture-budget allocator, left unbounded, fills the back band with as many
bedrooms as the footprint affords — a big floor becomes a long ROW of bedrooms,
which reads as a dorm/motel, not a house. So the program is bounded by a **tier**
(`HOUSE_TIERS` in `floorplan-glyphs.js`):

| tier | beds | study | core | max rooms/row | default footprint |
|---|---|---|---|---|---|
| cottage | 1 | no | L+K | 2 | 30×26 |
| house (default) | 3 | yes | L+K+D | 3 | 44×32 |
| villa | 4 | yes | L+K+D | 4 | 56×40 |

- **Beds are a house total, not a per-floor count.** Single-storey → the tier's beds
  hang off the ground core; multi-storey → ground keeps only service rooms and the
  beds live upstairs (`nBed` is hard-capped at `tier.beds`, was capped at 6). Either
  way the house has the same bed count.
- **A bigger footprint grows rooms, never adds a row.** `chosen.slice(0, maxPerRow)`
  caps the private row; surplus depth/width inflates the open core and the rooms.
  Verified: `house` tier at 44, 70, and 100 ft wide all yield 3 beds / 3 private rooms.
- **Floors stay caller-specified** (`input.levels`); the tier only bounds the program
  and supplies a default footprint when width/height are omitted. Explicit dims win.
- **Realistic ceilings.** `FLOORPLAN_DEFAULTS.wallHeight` dropped 12→10 ft (main floor,
  still a touch generous), upper storeys 8 ft, basements 7.5 — house massing, not loft.

## Exterior doors lead to entrances or terraces only (operator)

An envelope (perimeter) door may only be cut where it leads somewhere real — an
**entrance** or a **terrace/deck** — never onto open air (which matters most upstairs,
where an exterior door would otherwise open to a drop). Each exterior door carries
`leadsTo: 'entrance' | 'terrace'`; `placeOpenings` REFUSES any perimeter door without
one (interior partition doors are unrestricted). The open core's front door is the
`entrance`; `generateProgramPlan` also reserves a `terraceZone` (a deck anchor off the
front exterior wall, set to one side of the entry) and, only when `terrace:true`, cuts
its `terrace` door. The deck geometry itself is NOT built yet — the zone + the door
rule are the logic; a future deck attaches at `terraceZone`.

## Furniture-derived room budgets (the "fractal" part)

Room sizes are NOT arbitrary fractions — they're budgeted from WHAT EACH ROOM HOLDS.
The presets in `room-scene-elements.js` carry only relative `areaShare`/`aspect`, so
we ground each furniture `type` in an absolute floor FOOTPRINT (sqft) in
`FURNITURE_FT` (refining the existing aspect metadata with a real depth). Summed over
an archetype's `fill()` list and divided by a per-room packing target (circulation),
`archetypeArea(glyph)` gives the area a room of that kind WANTS:

| glyph | room | furniture | budget (sqft) |
|---|---|---|---|
| L | living | sofa + coffee table + armchair + bookshelf | ~117 |
| K | kitchen | cabinet + sideboard | ~64 |
| D | dining | dining table + 4 chairs + sideboard | ~93 |
| B | bedroom | bed + nightstand + dresser | ~113 |
| O | office | desk + chair + 2 shelves | ~72 |
| S | storage | dresser + cabinet + rack-shelf | ~48 |

These budgets drive the layout:
- **Open core depth** = (living + kitchen [+ dining]) budget; the core SOAKS leftover
  depth so it grows with the house while bedrooms stay near their budget.
- **Room count** = how many wishlist rooms the back band's area affords (`chooseRooms`).
- **Room widths** = proportional to each room's budget (`partitionWeighted`) — a bedroom
  is wider than a closet, an office narrower than a bedroom (visible in the renders).
- **Upper bedroom count** = `(floor area − hall) ÷ ~1.7× bedroom budget`, capped at 6,
  so a mansion gets a few big bedrooms rather than a warren.

`coreZones(area)` folds dining into the living/kitchen core below ~900 sqft (small
house: no separate dining). Multi-floor ground sheds bedrooms upstairs and keeps only
service rooms (office/storage) beside the core.

## Role-aware floors

- **ground / single / basement** → open-core builder: a public core band on the
  entry side, one row of private rooms across the back, doored onto the core.
- **upper** → hall builder: a landing/hall strip with bedroom rows on each side,
  every bedroom doored onto the hall.

## Stairs land in open zones (the operator's hard rule)

Start and end must be open, non-wall, non-occupied. The GROUND plan picks a
`stairZone` rect inside its open core and returns it; every other floor is
generated with that rect as `reservedOpen`, and its open zone (core / hall) is
placed to COVER it. So the flight's bottom lands in the ground core and its top in
the upper landing — both open by construction. The flight runs along the long
(spine) axis where there's length for the run.

**Stair clearance (operator rule: never against a wall or a door).** The `stairZone`
is inset by `clear` (2 ft) from the spine-end walls, the front exterior wall, AND the
core/private partition (whose private-room doors line the core's back edge) — so the
flight has a gap to every surrounding surface, not the old ~0.5 ft. It is also kept off
the ENTRY door: the entry splits the open core's spine, and the run is seated on
whichever clear side of it is longer (a `PROGRAM_HALL`-wide halo around the door), with
a centred fallback only if neither side fits. Net: you enter, the open core greets you,
and the stair sits to one side rather than blocking the way in.

## Exact tiling

All cells tile the usable rect [inset..W-inset]×[inset..H-inset] exactly (strips +
perpendicular cuts), so shared edges become real interior partitions and no
misaligned-wall artifact appears.

## Plan-quality rules

- **No furniture in circulation.** Furniture is only placed in `plan.rooms` (the open
  core + private cells), never in `plan.halls` (the upper landing). Additionally each
  level's STAIR footprint is passed as `furnishExclude`, and `furnishCell` drops any
  piece whose footprint overlaps it — so nothing lands on the flight rising through the
  open core.
- **No room furnished shut (open-concept walkability).** `doorClearanceRects` turns every
  door in the plan into a doorway-width × `doorClearance` (2.5 ft) box straddling the wall,
  merged into `furnishExclude` alongside the stair slots. `furnishCell` then drops any piece
  whose footprint overlaps a doorway — so the private-room doors onto the open core, and the
  entry door, stay clear of the living / kitchen / dining zones. The open plan reads as one
  walkable space, not a set of furniture-blocked alcoves. (Verified: doorway-intruding
  furniture faces drop ~5–12× across seeds with the rule on.)
- **No 'broom closet' rooms.** `balanceWeights` raises every room's width weight to ≥ ½
  the largest before `partitionWeighted`, and the upper hall is CENTRED (the ground
  stair is centred in floor depth so the hall can be) so the two bedroom rows share an
  equal depth. Net: every private room is ≥ ½ the area of the largest (verified 0.57–
  0.68 across seeds), excluding the open public core which is intentionally the biggest.

## Furniture (DONE — `furnish:true`)

Each registered room is populated with furniture via the room-spike pipeline
(`furnishElements` → `extractRoomSceneFaces`), merged into the house faces in
`structurizeFloorplan`. The generated cell IS the room basis, so furniture lands in
world coords directly. The OPEN CORE carries `core.zones` (living/kitchen[/dining])
and is split along its long axis (weighted by furniture budget) so each zone is
furnished as itself — open plan, distinct zones. Structural window/door elements are
dropped (the house cuts real ones).

### Geometry-aware arrangers (with LIBRARY ASSETS)

`furnishElements(glyph, seed, {w,h})` dispatches kitchen/living/dining/bedroom/office to
dedicated arrangers that read the room's real feet, compose RELATED pieces, and use the
real `room-assets.js` library models where they exist (storage/entry keep their flat
archetype `fill()` list):
- **`arrangeKitchen`** — real `kitchen-*` assets: a base-counter run along the longest
  wall with a **fridge + sink + stove** worked in (the work triangle), an island when
  the zone is ≥12×13 ft, else a parallel galley run when very deep.
- **`arrangeLiving`** — `modern-couch` asset across from the focal (back) wall, media
  unit + bookshelf on the wall, coffee table between, two box-net armchairs flanking
  (each `facing` the centre), rug underneath.
- **`arrangeDining`** — a table centred with box-net chairs arrayed around it, each
  ORIENTED to point at the table (`facing`), plus a sideboard. (The library `chair` is
  non-local → not rotatable, so dining keeps box-net chairs which `facing` can orient.)
- **`arrangeBedroom`** — bed + nightstand + (room permitting) dresser; larger rooms get
  a study nook: a real desk asset + chair facing it. Always ≥2 pieces, scaled to fit.
- **`arrangeOffice`** — a real desk asset against the back wall (working side into the
  room) + chair facing it + bookshelf (+ rack-shelf when there's room).

**Deterministic assets:** asset selection is already deterministic (keyed by
`element.asset`); where there's a choice (desk = study-table | computer-table |
standing-desk) the variant is picked with the room's seeded `rng`, so the same house
always furnishes identically.

**`facing` (room-scene-elements.js):** an optional element field that cyclically
rotates which footprint edge is the FRONT — spin 0→−y, 1→+x, 2→+y, 3→−x. For `local`
library assets (kitchen units, desks) the corner order is mapped through
`localToFootprint`, so `facing` truly ROTATES them; box-net cards rotate which slot is
front. Assets model front as +y vs box-net −y, so an asset's spin is flipped 180° to
keep `facing` a consistent physical direction either way. No-op when unset → every
existing scene unchanged (verified: 58 asset/room-scene/css3d tests still pass).
Non-local assets (`chair`, `modern-couch`) build axis-aligned and ignore rotation —
they're oriented by placement.

The arrangers only affect furniture geometry, not room sizing (budgets still come from
the archetype lists), so the two layers stay decoupled.

## Fast-follow (not in v1)

- Ground "hall as needed" two-row split for very deep footprints (core + front
  row + hall + back row). v1 keeps ground to a single private row off the core.
