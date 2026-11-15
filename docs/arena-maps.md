# Arena maps: the principles, as laws on a grid

A fighting map is not a trail. A trail asks whether you reach the end; a map asks where you choose to stand and what it
costs. `control/lib/graph/arena-map/` holds that as data: a map is blocks on one grid, the principles of line-of-sight
combat are laws measured on it, and a generator grows a template a block at a time and keeps only what the laws allow.
The rules of the fight (the run, the bands the guns are for) come from the firing range; the map is sized from them.

Status: the blocks, the reading, the laws, four templates and the generator are built and tested, pure. Nothing builds
a map into a scene yet, and no geocube building or town is read against the laws yet (see the end).

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

## Next

- **Templates for a long gun.** These four are sized for the mid band; a kit with a long gun wants a longer line
  somewhere, so a bigger court or a yard.
- **Built into a scene.** `mapPieces` is the hand-off; nothing lays its panels, ramps and ladders as a level yet.
- **A geocube map read against the laws.** A building's rooms, doorways and stairs, or a terrain with buildings, read
  onto this grid so the same laws say what it holds and what a design must change.
- **The mission on it.** The firing range's phases (arm up, clear by band, hold the heart, get out) placed on a map that
  holds the laws.
