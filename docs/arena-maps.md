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
Ladders are the runtime's own `rungs` climb, set in the foot cell: walked into, or climbed by standing at the foot and
holding jump (the climbable's `hold`: up rung by rung while the key is held, hung where it is let go, back to go down).

`phases.js` `phasesOnMap(brief, map)` places a mission's phases from the map's own measures: arm up, a clear for each
band, hold the heart, get out. Its laws are placed, unseen, two-ways, in-order and banded. A level's `mission.map`
carries the grown blocks, so the level is rebuilt from them and never regrown: a change to the generator cannot move a
level already made.

Gaps:

- There is no ceiling: a jump high enough to reach a slab is not stopped from below (the shooter's jump is not).
- Zones read a place flat, so things to take and places to reach are laid only in cells with no floor above or below.
- The headless gunner can stall on a ladder it takes hold of from above.
- A mind crosses floors by ramps only (`mapFloors`): it climbs no ladder and reaches no floor over a floor.

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

A building's `fight: true | { rings?, stagger?, stairs?, gallery?, cover?, room? }` (`era/programs.js` `FIGHT`, opt-in: absent,
the plan's bytes are as they were) is the plan's answer to the laws it fails.

- **rings:** every room along a wing opens onto its neighbour (the doorways at alternate ends of their wall), the first
  rooms onto the lobby, the lobby a second door into the core.
- **stagger:** of two opposite wings one leaves the core from its back, so the core's side doorways do not face.
- **stairs:** a stair room past each wing's far end with no annex, climbed by the building's switchback.
- **gallery:** the tall annex's catwalk on the wall the wing meets, at the upper storey's floor, entered from that
  storey and climbed to from the hall. Its doorway is floored through the wall's thickness at the deck's height.
- **cover:** the hall's own stock (`stocking.js` `HALL_COVER`), a baffle off each doorway and blocks on a seeded lattice
  of the arena's cells, the doorways, stairs and a lane kept clear.
- **room:** every storey a metre taller and the corridors six metres wide (`program-core.js` `ROOMY`), the lobby with
  them, the core given more floor so its stair still finds its run up the taller storey.

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

## A town or a city, cut as a map

`arena-map/read-town.js` reads a window of a designed geotown or geocity onto the arena grid, as `read-geocube.js` reads
a building. A neighbourhood block is a hundred metres and a city block more, far past an arena's size, so the map is a
**cut**: a window (54 m by default) walled at its edge, named by its middle or its rect, or picked: the window over the
segment and the streets round it with the most edge inside it between open ground and what is not.

```
readTownMap({ segment: 'main-street' }, { seed, block?, at?, size?, cut? })
readCityMap(<geocity recipe>, { seed, on: 'works' | 'storage' | 'quay' | …, at?, size?, cut? })
```

How a design is read (each approximation is said in the map's `read.notes`):

- **One level.** The land's hills and a street's grade are not read.
- **Water is a cell with no floor.** Nothing stands in it and every line crosses it; the blocks needed no new row. Its
  cells are in `read.water`, and the ground (`ground.js`) draws them under the floor's level with a kerb's height kept
  over them, so a body stops at the shore and a round does not.
- **A town's buildings are their envelopes, closed.** The fight is in the streets, the alley and the yards. Hedges,
  gates, parked cars and trees are the scene's and are not read.
- **A city's industry is its block's own plan:** halls, tanks, silos, a stack and containers as masses; gantries, pipe
  racks and pylons are frames a line passes and are left out; a chain-link fence is a low wall with no gate.
- **A city's waterfront is its strip out to its shore and its finger piers.** Pavilions, boats and pontoons are not read.
- **One ground.** A yard no way leads to, or the far side of a fence, is read as mass.

### What the cuts hold

As read, every cut fails the same sight laws: real ground is open, so its lines run the cut's whole length, far past a
close or a mid gun's band. A 36 m cut, the default kit, seed 1:

| cut | as read | grown |
|---|---|---|
| town, houses | 10 | 14 |
| town, main-street | 9 | 13 |
| city, works | 10 | 12 |
| city, storage | 10 | 13 |
| city, tanks | 9 | 13 |
| city, pier | 9 | 13 |
| city, quay | 10 | 14 |
| city, beach | 10 | 14 |

(of the laws' fourteen.) **Grown** is the generator given the cut in place of a template (`growArenaMap({ map })`): what
the place is made of is kept (its masses, its water, its fences) and only what stands on its open ground is grown: wall
panels, low walls, pillars. A given map is never cut in two or opened to hold another law. What stays unheld is the
place's own shape: `loops` on a pier, an alley or a tank farm's lanes (a pier is a dead end, and the law says so), and
`line-cap` down a works' yard the fixed halls leave no way to break.

A mission takes a place as its map (`mission.map: { town } | { city, on }`, [missions.md](missions.md#on-a-place)).

## An industrial yard, designed

A single picked window may not be able to hold the laws; a searched one often can. `arena-map/facility.js`
`designFacility(spec, { seed, on, size })` reads every window on a stride over a city's industrial block, keeps the ones
that are a yard (ground to fight on with the place's own things standing in it: the reader keeps the block's plan in
`read.things`), grows the most varied first under the laws with what the place is made of kept, and answers with the
one that holds the most and where it stands (`at`), which a mission then names:

```
levels.<id>: { mission: { map: { city: true, on: 'tanks', size: 48, at: [3555, 452] } } }
```

The default metro's tank farm at 48 m, seed 1, at that place: four tanks at its corners, a cross of open ground between
them, cover grown in the crossing, all fourteen laws held. It is drawn in the maps' generic dress (`ground-form.js`).

## A place as the geocube builds it

A place drawn as itself, under an hour, a weather and floodlights, is the geocube's own: a base building seated on its
land with its yard (`era/stage-buildings.js`: containers in corrugated steel on a jointed slab, floodlights on masts, a
wet that films the ground and runs down the walls while it rains, nothing falling under a roof) and a walker parked in
its hall. `gameworld/mission-site.js` lays a mission on that place **as it stands**: it resolves the geocube's recipe,
reads the page's own colliders onto the arena grid (`arena-map/read-colliders.js`: a mass a solid, a thin wall an edge
wherever no body's width of it is clear, one ground, its edge open), places the phases from that map's measures and
says the laws as advice. So what is fought over is what is walked, and nothing of the place is drawn twice.

```
node scripts/spikes/shooter/facility.mjs --out mission-facility.html
  [--site '{"use":"warehouse","containers":12,"floods":4,"hour":"night","weather":"rain","parked":["siege-walker"]}']
```

What the first run found (machine gate only; the default site, the shooter feel, seed 1): the ground storey and the
yard read as one ground with the hall in it; the map holds all but `bounded` (its edge is the land's), `line-cap` and
`break-near` (a yard's long lines); the tasks are proved on the bus; played on the place's own colliders the gunner
takes the rounds and clears two phases, then goes down in the hold at 63 s. Said, not tuned.

Said: it is a builder, not yet a level's form (a level of a game does not name a site; the page is made by the script);
it resolves the place twice to stand the walker in the hall, minutes of work; the map is the ground storey and the
yard; the geocube kind now carries a level's page channels (`events`, `audio`, `mission`, `game`, `parked`) and a
camera that is the page's.

## An industrial level

The geocube's visual blocks, laid out by the laws. `levels.<id>: { industrial: true | { use?, depth?, hour?, weather?,
wet?, tower?, walker? }, mission?: { seed?, foes?, hold?, waves? } }` is a level's form
(`gameworld/mission-industrial.js`): a fenced yard before a base building, at sunset on wet ground where it names
neither, a tower to climb in its middle. A walker named (`walker: 'siege-walker'`) is parked in the tower's place; a
weather named wets the ground itself.

- **The blocks are the geocube's** (`era/stage-buildings.js`): the building on its land, its slab in jointed bays,
  shipping containers in corrugated steel, concrete barriers, floodlights on masts (lit once the sun is down),
  chain-link, a steel tower, the hour and the wet. A yard takes a design's own placements as words, in the building's
  plan metres: `yard: { depth, fence, stacks: [{ at, along?, high?, half? }], barriers: [{ at, along? }], masts:
  [[x, y]], towers: [{ at, stairs: [{ way, run?, wide?, off? }], size?, high? }] }`; a building takes the height its
  floor is asked to stand at (`at.floor`).
- **A tower is high ground a body walks**: a steel deck on four posts, its top a level over the floor, railed round but
  where a stair meets it, each stair in steps under a body's step. A body walks under the deck and not under a stair.
  On the map it is a floor a level up with a ramp for each stair, so the laws judge it as any high ground: the level's
  tower has two stairs because `levels-twice` asks two ways onto every upper floor.
- **The layout is the laws'** (`arena-map/yard.js`). A yard is designed piece by piece, never cell by cell: a
  forty-foot container, a twenty-foot one, a barrier on a line. Each pass stands, turns, moves or takes one (or lays a
  container across a line the laws name too long) and keeps the change only when the yard holds its laws no worse and
  stays one ground. The tower's stairs and their feet are kept clear; a walker is a mass the design works round; the
  floodlights stand over the yard's prizes, since the laws already put the best thing in the most seen place; the
  building's door is the way out.
- **Laid before it is built.** The building's seat is the builder's own frame (`buildingSeat`) and its floor is asked
  for, so the yard's pieces and the mission's places are known with nothing resolved: the level is planned in seconds
  and is a pure stage, as any level is. The deck and its stairs are told to the mission's minds (`mission.floors`) and
  to its proof's walker (`frame.stairs`).

Who holds it is a crew (`crew`, a faction of the grunts: private military where it names none): its foes are three of
the crew's rank and file, dressed by the hero door's own words. Said: the crew's other kinds are not stood (one does
not build alone, one is several times the weight on the page).

It is heard: its guns (the range's own), its events each a sound (a task, a wave's alarm, a supply taken), the wind's
bed, and a score in two states that the level's own events move between. Its places sound (the channel's `emitters`): water drips off
the tower's deck and the tallest stacks, the hall hums at its door, the fence rattles along its runs; and the tower's
deck and stairs ring as steel under a boot (the channel's `surfaces`). Said: a placed sound is a cue sounded again,
its loudness set each time it starts, so a held one (the hum) follows the listener in steps.

`bounded` now asks for what stops a body, a wall or a rail, on every floor: a fenced yard is bounded as a walled one is.

What the first run found (machine gate; the shooter feel, seed 1): the default yard, nineteen cells by ten with its
tower, holds twelve of the fourteen laws; `loops` is not held (a pocket of the yard hangs off one way) and `line-cap`
is not (an aisle runs longer than the kit's longest band). Built, its floor stands where it was asked and each piece is
on the page where the design put it; played on the place's own colliders the gunner wins it in 78 s, all five tasks
met; a player walked up the west stair in headless Chrome stands on the deck and is stopped by its far rail. With a
walker in the tower's place the yard holds thirteen.

A mission with floors sends its waves' minds with ledge-keeping paths, and a ledge is asked of the page's ground a
cell at a time, a ray through the scene each: dear on a place this size (the page stalled once a few minds pathed at
once). The level's deck is railed and its yard fenced, so its mission says `ledges: false` and its minds ask nothing.
A building's mission still keeps ledges (its galleries need them); the cost there is unmeasured.

Said: the level's page is about forty megabytes and takes minutes to resolve, the land with it; the fence stops a
mind's sight as a wall does (it is a collider), where the laws read it as a rail; the tower's steel is plain, flat
colour, dark against a low sun; the land is cut deep where the yard meets its cliff; only buildings with a hall take a
yard this way.

## A bout and a push

The laws are put to two more means than a mission's (`arena-map/bout.js`).

- **A bout** (a deathmatch's arena, `gameworld/tunnel-arena.js`): one level; the arena's words say where the laws
  start (lanes, or a court); the kit the laws size it by is the bout's sight; and it is fair: the half the laws liked
  best is turned half round the centre onto the other, the turned map held to the laws again, the best of a few seeds
  kept. The bout's own means stay the tunnel's: spawns out of sight, supplies by risk, towers stood first with the
  panels giving way, crates, and the panels beside a way that is the only one taken.
- **A push** (a quick shooter's cover, `gameworld/lay-concerns.js` `coverBlocks`): a strip from where a body comes on
  to a post that holds it, grown for the near bands, then held to what a push needs: the post's cover a sidestep away,
  its cell and the way on clear, the strip one ground. Its edges are open land.

Said: a bout's map is flat (its high ground is the tunnel's towers); growing costs seconds an arena; the laws a turned
map does not hold are in the tunnel's record (`built.map`), not on the level's readout.

## Next

- **Templates for a long gun.** These four are sized for the mid band; a kit with a long gun wants a longer line
  somewhere, so a bigger court or a yard.
- **A place drawn as itself.** A map and a cut are drawn by the form render in a dress of generic tiles
  (`ground-form.js`): a house is a brick mass, a container a brick block. The place's own render (the geotown's and
  the geocity's scenes: its houses, its tanks, its quay) is not on the map's page.
- **A place's low things.** Hedges, parked cars, planters and bollards are the cover a street already has; they live
  in the scenes, not the designs, so the reader cannot see them and the generator grows panels in their place.
- **A city's other blocks.** Only industry and the waterfront are read at a building's grain; a tower block, a
  mid-rise court and an outskirts block of houses read as open ground.
- **Geocube plans that hold every law.** The fight dials close most of the gap; a gallery round several walls, cover in
  the core, and a gentler stair are not built.
