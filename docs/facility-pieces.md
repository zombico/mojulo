# Facility pieces

A building laid from its use alone (`era/programs.js`, the `core` shape) is a lobby, a stair core, corridors and
five-metre rooms off them, each stocked along its walls (`era/stocking.js`). To a body sneaking through it that is a
hallway and empty boxes: one way through each room, every gaze unbroken, nothing to hide behind but a doorway. The
pieces here make the same building a ground to move through. They compose: a walled-core dungeon's layer is a facility,
a facility is a use with its rooms' floors laid in figures, and a figure is the dressing's own pieces placed by a rule.

## Room to move: a building laid larger

A building's plan is sized for a walker: corridors three metres, rooms and bays six, a 10 × 12 stair core, storeys of
three and a half, a stair two metres wide with two of floor at each end. Under a third-person camera that is cramped:
the camera has no room behind the body, a stair's turn scrapes the rail, an aisle between racks is a slot. A core
building's `scale` (1 to 2, opt-in; `era/program-core.js`) lays its rooms' depth and its bays' width, its corridors, its
core, its lobby and its annex's floor that many times larger, and every storey the square root of it taller. Its stair
becomes the `hall` profile (`construction/circulation.js`): flights three metres wide on a shallower going, three
metres of floor at the foot, at the head and on the landing, and a wider well. Scale 1 is the plan as it was, byte for
byte, so buildings already made are untouched. A stealth or action game's building is laid at 1.5: rooms 8.5 m across,
corridors 4.5, storeys about 4.3. Every facility is, and the Steel Serpents interiors (the holding block, level 1's
barracks and hangar) are. A level's building, a geocube's building and a complex's building all take it.

The layouts' own widths are a body's with a camera behind it: aisles 2.2 m, lanes between machines 2.2, between desk
pods 2, between rows 1.6, a centre aisle 2.4.

## Room layouts: a room's floor in a figure

`control/lib/graph/era/room-layouts.js`. A layout lays the dressing's pieces (`compose-dress.js` `PIECES`: racks,
shelves, crates, drums, desks, cabinets, generators, pumps, switchgear, benches and the rest) across a room's floor,
not only along its walls.

| layout | what it lays | what a body does there |
|---|---|---|
| `aisles` | rows of tall racks or shelves down the room's length, back to back, broken by cross aisles (`cross: 'aligned'` a grid, `'staggered'` a maze) | walks an aisle out of sight of the next, crosses at the breaks |
| `machines` | big plant on a staggered grid, lanes between | goes machine to machine; the tall ones stop a standing gaze, the low ones a crouch's |
| `islands` | pods of desks or benches back to back, a cabinet at one end | crouches or crawls behind a pod; a watcher sees over it |
| `stockpile` | clumps of crates (squares, Ls, lines, Ts) on a jittered grid, stacked by the dice | weaves between clumps, crouches behind a stack or climbs it |
| `chicane` | blocks of crates against a corridor's long walls by turns, each slid along to a stretch no doorway takes | never seen down the corridor's length; the way through is a weave |
| `rows` | benches or bunks in rows from each long wall, a centre aisle down the room | ducks between the rows |

Each takes its dials (`LAYOUTS.<id>.dials`: the piece, the aisle or lane width, the margin to the walls, and so on).
A program asks for them by room id or by role:

```js
building: { use: 'warehouse', look: { construction: 'utility', palette: 'utility' },
  layouts: { shed: { layout: 'aisles', cross: 'staggered' }, corridor: 'chicane', dispatch: { layout: 'islands', per: 1 } } }
```

A room's own id wins over its role. A room given a layout lays it in place of its stock (an extinguisher still stands
by each doorway). A piece keeps a body's way through each doorway clear, not the dressing's whole approach, and never
a doorway's sightline: breaking that is the point. A loose figure's piece (machines, islands, stockpile) is moved up to
a metre and a half to clear a doorway; an aligned figure's (aisles, rows, chicane) is dropped, since a rack shoved out of
its aisle reads as litter. A room that holds none of its layout keeps its stock, and the report says `stocked`.

### The laws

Every room given a layout is held to them (`layoutLaws`); the stage's `compose.layouts` reports them room by room
(`compose-dress.js` `layoutReport`). They advise; none refuses.

- **doors-joined**: every doorway reaches every other over the floor left, a body's width.
- **a-way-round**: a piece or a clump stands clear of the walls, so a body can circle it (a hall's, not a corridor's).
- **sight-broken**: from no doorway does a watcher see three quarters of the floor a standing body stands on (a hall);
  from neither end of a corridor does one see three fifths of it.
- **cover-in-reach**: nine tenths of the floor lies within three metres of a piece a crouch hides behind.

A room smaller than a hall (100 m², ten metres square; a corridor, three times as long as it is wide, is held to the gaze down it) is held to the first and the last
only: it is crossed in a breath and its doorway is its cover. That is the finding behind facilities: a layout cannot make
a five-metre room a place to sneak through, so the ground is in the halls, the wide corridors and the loops between rooms.

Low pieces stop a crouch only close behind them. A corridor's chicane of single crates breaks a crouched gaze near each
block; to stop a standing gaze down its length, stack them (crates stack by the dice in the stage) or lay `shelves`.

## Facilities: a building designed to move through

`control/lib/graph/era/facilities.js`. A facility is a row: a use, its plan's fighting dials (`programs.js` `FIGHT`:
`rings` a second doorway to every room, `room` wide corridors and taller storeys, `gallery` a catwalk round the tall
hall, `stagger` the core's doorways offset), its rooms' layouts and its look, a construction and a palette
(`era/style/bay-axes.js`), laid at `scale` 1.5. Each is built in its own materials.

| facility | use | built in | its ground |
|---|---|---|---|
| `depot` | warehouse | utility: concrete block, sealed floors | the shed a staggered maze of rack aisles under a catwalk; corridors a chicane |
| `power-plant` | plant | bunker: poured concrete | the generator hall a field of sets, switchgear and pumps under the gallery; drums by turns down the corridors |
| `motor-pool` | hangar-bay | military: steel plate, epoxy | the hangar a yard of crate clumps; parts rooms shelved; shops bench islands |
| `research-wing` | lab-building | science: panels, glazing, terrazzo | the instrument bay a grid of rack aisles; labs bench islands |
| `field-hq` | command | everyday: carpet, gypsum, veneer | offices desk pods behind cabinets; briefing rooms desks in rows; no hall, its rooms rung |

A level's building or a dungeon's space names one: `building: { facility: 'depot' }`, or
`wcd.spaces.<id>.facility: 'power-plant'` (its use and look the facility's; the space's own look wins, so the layers of
a dungeon still differ in construction and palette, the WCD principle). The recipe's own `look`, `fight` and `layouts`
lay over the facility's. A complex's buildings (`network/complex.js`) take `layouts` too, so a dungeon's spaces stood on
one yard keep their floors.

A new facility is a row: pick a use whose rooms carry the place (an annex hall is the most to work with), the dials that
give it loops, a layout for each role that should be ground rather than box, and a construction not yet used next to it.

## Crawl spaces: vents

A building's `vents` (`control/lib/graph/era/vents.js`; `true` or `{ depth?, clear?, rooms? }`) lays a duct along the back
wall of each row of rooms off a corridor (two rooms side by side or more): through a hole in each wall they share, under
a lid 0.75 m up that a body lying (0.45 m) passes beneath and one standing does not, with a hatch 1.4 m wide into each
room. The way in and out of a room is never the corridor, so the guards walking it never see a body in the duct, and
none of them can follow it in. The stage cuts the holes, builds the ducts' walls and lids as colliders, keeps every piece
off their floors and hatches, and hands the page their insides as crawl spaces (the same `under` a truck's chassis is).
A body lying cannot stand up under a lid (headroom, `worlds/controllable/stance.js`), and the route search passes a crawl
space lying only, so a level's laws count a vent as a way (the holding block's `a-vent-to-the-kit`). A building with
vents rings its rooms (`fight.rings`) by doorways at the corridor's end and the middle of their shared walls, by turns,
so the back walls stay the ducts'. Every facility has vents; the maps draw each duct's floor dashed and its hatches as
bars.

A duct is dark. The room's light reaches every surface of a room alike (its shade level and its lamps' bounce are not
tested against what stands between), so a duct is lined with its own floor and back plates and what lies inside it
keeps 0.3 of its baked light, more within 1.4 m of a hatch (`shadeDucts`, `DUCT_DARK`); no lamp is seated on the wall
over a duct under 2.5 m.

## In the game book: the facility maps

The book of maps a stealth or action game's interiors are read in, `/api/sketches/<ref>/bible?book=facilities`
(`control/lib/graph/gameworld/facility-maps.js`). It draws this game's building levels first, then the whole shelf of
facilities, each storey from above as a level designer reads it: rooms, doorways (gold), ways out (green), stairs
(dashed), and every piece coloured by what it hides (red stops a standing gaze, amber hides a crouch, blue hides a body
lying down). Beside each map are its laid rooms' laws, and for each facility its materials, what a body does there and
the recipe line that names it. The readout offers it (`design_game`'s exits, `facilities`) to a world with a building
level, a walled-core dungeon, or a rail whose level kinds are interiors. The world's own book draws a level that names a
facility or layouts the same way. `facilityMapSvg` draws any laid plan; the spike below draws its plans with it.

## Proved and played

`node scripts/spikes/mission/facilities.mjs --plan [--svg dir]` lays each facility, prints every laid room's laws and
crosses its hall with the route search (`gameworld/stealth-routes.js`) under a watcher walking it, beside the same
building bare. On seed 1 the depot's shed and the power plant's generator hall have no way across unseen bare and one
laid; the motor pool's hangar has one either way (it is wide enough to skirt the watcher) and the laid one keeps a body
two metres further off. `--svg` draws each ground storey from above: rooms, doorways, pieces by what they hide, the way
across unseen. `--out dir --facility <id>` builds the page: the operative at the way in, a guard walking the hall and a
sentry each ground corridor. The page is a designer's walk: it starts in invisible mode (`worlds/controllable/ghost.js`,
no guard sees the operative; I toggles it, `--seen` starts seen), so the layout and the guards' rounds are read on foot.

## What is not yet

- No piece is see-through: glass and mesh stop a gaze as a wall does (`sightBlocked` treats every collider as opaque).
- A crawl space is a duct behind a row of rooms; a raised floor under a room, or a duct over a corridor, is not laid.
- In-room level changes are the hall's gallery alone; a mezzanine over a room, a pit or a ramp is not a layout.
- A five-metre room stays a room. Fewer, larger rooms would need a program shape that is not a corridor of bays.
