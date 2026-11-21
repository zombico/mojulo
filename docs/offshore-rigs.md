# Offshore rigs: decks in the open

A facility ([facility-pieces.md](facility-pieces.md)) is a stealth level of walls: rooms, doorways, a gaze stopped at
every corner. A rig is the other pole: open decks stacked over the sea, where a body is seen across a whole deck
unless something stands in the way. `control/lib/graph/offshore/` builds one from three tiles and the modules laid on
them, holds it to the laws a sneaking body needs, and builds it as a played page.

## The three tiles

`offshore/tiles.js`. A rig is laid on a grid of cells three metres square.

| tile | rows | what it does |
|---|---|---|
| floor | `plate` (`#`), `grating` (`=`), `helideck` (`H`) | what a body stands on. A deck is a map of these glyphs, `.` where it has none |
| rail | `guard`, `bulwark`, `screen` | what keeps a body from the drop. A guard rail stops a body and no gaze (a barrier, `worlds/controllable/barrier.js`); a bulwark (1.1 m of plate) hides a crouch; a wind screen (2.8 m) a standing body |
| pillar | `leg`, `column` | what carries the deck above: the cover a body has in the open. A leg runs from the sea bed through every deck it meets; a column carries one deck from the next one down |

The modules (`MODULES`) stand on the tiles: containers, skids, tanks, pipe racks, drums, the quarters, the driller's
cabin, the drawworks, the derrick, a crane, the flare boom and the lifeboats. What a piece hides comes from its height
(`stopsOf`: a standing body from 1.6 m, a crouch from 0.85), never from a second word beside it. A new look is a row.

## A rig in words

`offshore/rigs.js` holds the rigs on the shelf; `offshore/plan.js` reads one:

```js
{ id: 'drilling-platform', seed: 3,
  decks: [
    { id: 'cellar', z: 12, columns: { every: 3 }, map: ['................', '.==============.', …] },
    { id: 'main', z: 20, inner: 'bulwark', walls: { '+y': 'bulwark' }, map: ['################', …] },
  ],
  legs: [[1, 1], [15, 1], [1, 11], [15, 11]],
  stairs: [{ from: 'cellar', to: 'main', at: [12, 10], dir: '-x', side: '-y' }],
  modules: [{ kind: 'container', deck: 'main', at: [6.5, 1] }, { kind: 'crane', deck: 'main', at: [0, 5.5], toward: '-x' }],
  start: { deck: 'landing', at: [5.5, 7.6] }, goal: { deck: 'top', at: [31.5, 19.6] },
  watch: [{ id: 'yard-round', deck: 'main', at: [27, 10.5], to: [44, 10.5], look: 4 }] }
```

A map's first row is the deck's far (+y) edge, and every deck's map is the same size. The rails and the columns are
not written: the plan finds them.

- **Rails** run along every edge of a floor that falls away, merged end to end, except a stair's head. The deck's
  `rail` kind goes on its outer edges, its `walls` kind on an outer edge facing that way (the weather side's wind
  wall), and its `inner` kind round a hole in it (a moonpool, a stair's well).
- **Columns** stand at every `columns.every`-th node a deck's floor touches. Each one stands on the highest deck under
  it whose floor touches that node, or on the sea bed. A column never drops through a hole in a deck below (a
  moonpool), never stands in a stair's flight (one on the edge of the flight's footprint stands just clear of it), and
  never stands on a leg's node.
- **Stairs** are switchbacks, three cells along `dir` by two across toward `side`, standing on the lower deck. The
  first flight climbs the near lane, a landing crosses the far cell, and the second flight climbs back up the other
  lane to the upper deck, whose floor over the stair is cut. Decks a stair joins are 5 to 9 m apart; at 8 m a flight
  has 21 risers of 0.19 on goings of 0.3.

## The laws

`offshore/laws.js` (`rigLaws`). They advise; none refuses.

- **railed**: every open edge carries a rail except a stair's head.
- **joined**: every deck reaches every other by its stairs. On each deck, every way on and off (a stair's foot or
  head, the start, the goal) reaches every other over the floor, a body's width wide.
- **carried**: every tile stands within 7.5 m of a pillar that carries it.
- **stairs-clear**: no pillar or module stands in the body's width of floor at a stair's foot or head.
- **modules-placed**: each standing module is wholly on its deck's floor and clear of the pillars and the stairs.
- **sight-broken**: on a deck of 150 m² or more, a watcher standing at the head or foot of a stair sees no more than
  three quarters of the floor a standing body stands on.
- **cover-in-reach**: nine tenths of every deck lies within 3 m of a piece a crouch hides behind.

A floor that is bare by its use (`open`: the helideck's pad) is left out of the last two: it is crossed, never hidden on.

## Built and played

`offshore/build.js` (`rigWorld`) builds the World page's static world:

- **Decks** are slabs, a tone each, and gratings show their bars. **Rails** have posts, a top rail, a knee rail and a
  toe board. **Legs** are octagons banded at the splash zone. **Columns** have cap plates.
- **The jacket** is X-braced between the pillars that stand in the sea.
- **Stairs** have stringers, treads and rails.
- **The sea** is one sheet of ocean water over a dark bed. A body that goes over a rail lands on the bed.

Every face is shaded once, by the sky, by the sun as it turns to it, and by the shadow of any deck above it. The
cellar deck lies in the main deck's shadow, and the jacket in the cellar's.

Decks, pillars, walls, modules and stairs are colliders. Guard rails, and a stair's sides and divider, are barriers.

A stair tread's collider stands a quarter metre under the tread drawn over it. The footing is the drawn tread's. The
reason: a body's footprint (0.3 m in radius) spans two goings of 0.3, and two risers are more than the 0.35 m a body
steps up.

`node scripts/spikes/mission/rig.mjs --plan [--svg dir] [--deck id]` lays the rig, prints its laws, and crosses each
deck with the route search under its rounds, from the way onto it to the way off. `--svg` draws each deck.

`--out dir` builds the page on the `controllable` world. It puts the operative at the boat landing, the guards on
their rounds and the goal at the driller's cabin. It starts in invisible mode (I toggles it, `--seen` starts seen).

On the drilling platform, a way across unseen is found on every deck. Each straight way is seen: on the cellar after
9 s, on the main deck at once, and on the drill floor after 7 s.

## In the game book

The facility maps book (`?book=facilities`, `gameworld/facility-maps.js`) draws the rigs after the facilities. It
shows each deck from above (`offshore/map.js`, `rigMapSvg`) with the rounds that watch it, and the rig's laws beside
them.

The map is drawn as follows:

- **Tiles** are drawn by kind, with the deck below shown faint where this one has no floor.
- **Rails** are coloured by kind: gold for a guard rail, grey for a bulwark, light for a screen.
- **Pillars and modules** are coloured by what they hide: red for a standing body, amber for a crouch.
- **Stairs** are dashed, with their way up.
- **Ways on and off** are green, and the goal is gold.

## What is not yet

- A rig is not yet a level kind a `design_game` world names. The spike builds it, and the book shows the shelf.
- Grating is a solid floor to the gaze and the route search. A body on the deck below is never seen through it.
- Ladders, a deck's catwalks over the sea, and a body going over a rail into the water are not laid.
