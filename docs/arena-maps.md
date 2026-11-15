# Arena maps: the principles, as laws on a grid

A fighting map is not a trail. A trail asks whether you reach the end; a map asks where you choose to stand and what it
costs. `control/lib/graph/arena-map/` holds that as data: a map is blocks on one grid, the principles of line-of-sight
combat are laws measured on it, and a generator grows a template a block at a time and keeps only what the laws allow.
The rules of the fight (the run, the bands the guns are for) come from the firing range; the map is sized from them.

Status: the blocks, the reading, the laws, four templates and the generator are built and tested, and a grown map is
laid as a mission's ground. Geocube buildings are
read against the laws (below).

## First principles

1. Damage needs a line: the map's content is what sees what.
2. Seeing is mutual, advantage is not: it comes from exposure, from who must watch more ways, from who breaks the line
   sooner.
3. Time in a line is the cost of a route or a place.
4. Range picks the gun: the shape sets the range a fight starts at.
5. Attention is finite: each way in more halves a place's safety.
6. Equal starts: advantage is earned on the map (a place, a thing picked up), never carried in.

The horizontal follows from 1 to 5 (the plan is a circuit of rooms and connectors with its lines broken). The vertical
follows from 2 and 3 (height sees more and shows less, and dropping is free where climbing costs), so height must be
paid for.

## The blocks

`blocks.js`, a closed table on a grid of cells `CELL` metres square and levels `RISE` metres apart:

| block | sits on | to a body | to a line |
|---|---|---|---|
| floor | a cell at a level | stood on | stops a line through its level |
| wall | an edge between two cells | stops it | stops it |
| low wall, rail | an edge | stops it, and a fall | stops it only below its top |
| solid | a cell | stops it | stops it |
| ramp | a run of cells, a level to the next | walked both ways | none |
| ladder | a cell and the side of its ledge | climbed both ways, slowly | none |

A drop is not a block: it is what an open edge of an upper floor is, one way down.

## The laws

`laws.js` `PRINCIPLES` (each row carries its why and what it asks) and `mapLaws(map, kit)`. Advice, never a refusal: a
law not held says what, where and what mends it.

| group | law | what it asks |
|---|---|---|
| structure | `bounded` | a wall round the ground, a wall or rail round upper floors at the map's edge |
| structure | `connected` | every standing place reaches every other and comes back |
| structure | `loops` | nothing hangs off a single way (a small alcove aside) |
| access | `ramps` | landings that lead on, cells clear of mass, no floor over them, no wall across the line, a walked slope |
| access | `ladders` | a floor at the foot, an open shaft, a ledge that leads on, no wall along it |
| access | `drops` | every open upper edge over a place to land, a body's drop or less |
| access | `levels-twice` | two ways up to every upper floor, one of them a ramp |
| sight | `line-cap` | the longest clear line within the longest carried band |
| sight | `range-mix` | floor for each band the kit carries a gun for |
| sight | `break-near` | a step out of sight within a second's run |
| sight | `height-paid` | upper floors seen from as many places as the ground |
| economy | `spawns` | out of each other's sight and the prizes', two ways on |
| economy | `items` | the prizes apart, the first where the most see it |
| economy | `lap` | the round of the prizes in a quarter to three quarters of a minute |

### Ramps and ladders run into nothing

The access laws are exact, on the grid's own numbers (`map.js` `rampFaults`, `ladderFaults`):

- **A ramp** rises one level over its run. Its slope is `RISE` over the run, `SLOPE` at most. The cell before it is its
  foot landing and the cell after it, a level up, its head landing: both stood on, both with a way on that is not the
  ramp. Its cells hold no mass and no other ramp, and no floor lies over them: the cells over a ramp are its opening. At
  each edge along its line the surface is so high: a wall of the lower level is in the way while the surface is under
  its top, a wall of the upper level while a head reaches it.
- **A ladder** stands in one cell and steps onto the ledge beside it a level up. Its foot is stood on, the cell over
  the foot is its shaft (no floor, no mass), the ledge is stood on and leads on, and no wall or rail stands along the
  ledge where the body steps.
- **A way with a fault joins nothing.** The reader does not link it, so the laws that count ways (`connected`,
  `levels-twice`) see the map as it would be played, and the fault names what was run into.

## Where things go

Nothing is placed by hand (`furnish`): the least seen places on the ground with two ways on are the spawns, each next
one the farthest the others do not see; the first prize stands where the most see it, the others as far from it and
each other as the map allows; the small things lie in the quiet places.

## Templates and the generator

`templates.js`: a few starting shapes, each one idea of circulation (a court under a gallery, two rings sharing a
middle, three rooms in a row with a bridge, a tower round a well). A template is a start, sound as written (bounded,
joined, its ramps and ladders clear), never a finished map.

`generate.js` `growArenaMap({ template, seed, passes, drift, kit })`: each pass tries one change on the seed's dice and
keeps it only when the laws are held no worse. A change is either free (a wall panel set, lowered or taken; a pillar; a
floor panel; a ladder; a ramp; a rail) or a repair of what a law names (`mapLaws(...).mend`): a line broken by a panel
across it or a pillar in it (through open air, a pillar from the ground or a wall at the edge of the floor it leaves),
an open edge railed, a ramp cut up to a floor that has none (the floor over the ramp opened for it). It stops once
every law is held and it has drifted from its template; another seed is another map. `mapAscii` draws it a level at a
time; `mapPieces` lists every block in metres for what will build it.

## What the first runs found

Machine gate only; nobody has played one.

- Every template grows to every law held, on each seed tried, in one to three seconds, for a kit of close and mid
  guns: the longest line under the kit's band, most lines broken within a second's run, a lap of the prizes of 18 to 32 s.
- A way one cell wide and longer than the kit's longest band cannot be mended: the only block that breaks its line also
  cuts its loop. Two templates were written that way at first and never finished; a gallery is now no longer than the
  band, and a bridge is two cells wide so panels stagger along it. A template is sized to the kit it is for.
- The templates as written are too open (their lines run past the band); the growing is what closes them.

## Laid as a level

`ground.js` `mapGround(map)` lays the blocks as a controllable page's faces and colliders. Floors become slabs, which a
body stands on and walks under. Walls and rails stop a body. Ramps are slopes the platform rule walks, up and down.
Ladders are the runtime's own `rungs` climb, set in the foot cell.

`phases.js` `phasesOnMap(brief, map)` places a mission's phases from the map's own measures: arm up, a clear for each
band, hold the heart, get out. Its laws are placed, unseen, two-ways, in-order and banded. A level's `mission.map`
carries the grown blocks, so the level is rebuilt from them and never regrown: a change to the generator cannot move a
level already made.

Gaps:

- There is no ceiling: a jump high enough to reach a slab is not stopped from below (the shooter's jump is not).
- Zones read a place flat, so things to take and places to reach are laid only in cells with no floor above or below.
- The headless gunner can stall on a ladder it takes hold of from above.

## Geocube buildings read against the laws

`arena-map/read-geocube.js` reads a building's plan onto the grid: each room's floor at its storey, its walls snapped to
the grid, each doorway one open edge, its stock as solids and low walls, each stair as the nearest straight two-cell run
(else a ladder). `readSiteMap` puts buildings on a flat yard. Read on the machine gate only, every program holds
`bounded`, `connected`, `ramps`, `ladders` and `drops`, and none holds `loops`: each room has one door. The core
buildings fail `line-cap` because their core's doors line up across the spine, and `levels-twice` and `height-paid`
because each has one stair and its storeys look onto nothing. The fixes belong to the plan: a second door per room,
staggered core doors, a second stair, a gallery over the tall annex, and cover in the middle of the halls. No stair is a
ramp of 1:2 or gentler (the switchback is about 1:1.5, the keep's flight 1:1). The reading keeps which rooms a stair
joins, not its slope. A real trail's placed buildings are not read yet: their anchors carry rooms but not doorways,
stairs or turns, and the land is not flat.

## Geocube plans designed as fighting maps

A building's `fight: true | { rings?, stagger?, stairs?, gallery?, cover? }` (`era/programs.js` `FIGHT`, opt-in: absent,
the plan's bytes are as they were) is the plan's answer to the laws it fails.

- **rings:** every room along a wing opens onto its neighbour (the doorways at alternate ends of their wall), the first
  rooms onto the lobby, the lobby a second door into the core.
- **stagger:** of two opposite wings one leaves the core from its back, so the core's side doorways do not face.
- **stairs:** a stair room past each wing's far end with no annex, climbed by the building's switchback.
- **gallery:** the tall annex's catwalk on the wall the wing meets, at the upper storey's floor, entered from that
  storey and climbed to from the hall.
- **cover:** the hall's own stock (`stocking.js` `HALL_COVER`), a baffle off each doorway and blocks on a seeded lattice
  of the arena's cells, the doorways, stairs and a lane kept clear.

On house-shape plans only rings and cover apply. The reader reads a gallery as its deck at the upper level, railed, its
stairs as ramps. Machine gate only: with every dial the warehouse holds two laws short of all for a kit of close and mid
guns, one short for a long gun. Still failing: `height-paid`, because the law averages the whole upper storey and the
gallery is one railed column of it; `line-cap` for close and mid guns, because a corridor runs straight into the core;
and no stair is gentler than about 1:1.5. A keep gains nothing: its packer cannot lay a second stair.

### A mission inside a building

A building designed as a fighting map can hold a mission: `levels.<id>: { building: { use, fight? }, mission }`
(`gameworld/mission-building.js`). The plan is read onto the grid (`readBuildingMap`), the phases are placed on it
(`phasesOnMap`, with `start` the building's way in and `exits` its doors), and every place is taken back to the plan's
metres. Because the grid snaps walls by up to half a cell, each place is held to the real plan: in its room, on its
floor, clear of walls, stairs and stock. A place that fails is moved within its room; one with nowhere free is left out
and said (`placed-in-plan`). The grid's ramps are a reading, not where the stairs are: the gunner takes a stair by its
own way. The level is a building's stage, so read in the seventh generation it is drawn by the form render
([docs/missions.md](missions.md), "In a building").

## Next

- **Templates for a long gun.** These four are sized for the mid band; a kit with a long gun wants a longer line
  somewhere, so a bigger court or a yard.
- **Geocube plans that hold every law.** The fight dials close most of the gap; a gallery round several walls, cover in
  the core, and a gentler stair are not built.
