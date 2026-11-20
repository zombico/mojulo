### Facility pieces: buildings to move through

A building laid from its use alone was a corridor of five-metre rooms, each stocked along its walls: hallways and empty
boxes to a sneaking body. Two new pieces make it a ground, and a walled-core dungeon's layer can name one.

- **Room layouts** (`era/room-layouts.js`): a room's floor laid in a figure from the dressing's own pieces: `aisles`
  (rack rows, cross aisles aligned or staggered), `machines` (plant on a staggered grid), `islands` (desk or bench pods),
  `stockpile` (crate clumps stacked by the dice), `chicane` (blocks against a corridor's walls by turns, each slid to a
  stretch no doorway takes) and `rows`. A program's `layouts: { <room or role>: <layout> | { layout, …dials } }` asks for
  them; compose-dress.js lays them in place of the room's stock, keeping a body's way through each doorway (not the
  dressing's whole approach, nor a doorway's sightline), and falls back to the stock where nothing fits.
- **Their laws** (advisory, the stage's `compose.layouts`): doorways joined, a way round, the gaze broken (from a hall's
  doorways; down a corridor's length), cover in reach. A room smaller than a hall is held to its doorways and cover.
- **Facilities** (`era/facilities.js`): `depot`, `power-plant`, `motor-pool`, `research-wing`, `field-hq`: a use, its
  fighting dials (rings, wide corridors, a catwalk), its layouts and its own construction and palette (utility, bunker,
  military, science, everyday). A level's `building: { facility }`, a WCD space's `facility`; the recipe's own look, fight
  and layouts over it. A complex's buildings take `layouts`.
- **Proved**: `scripts/spikes/mission/facilities.mjs --plan` crosses each hall by the route search under a watcher
  walking it: the depot's shed and the power plant's generator hall have no way across unseen bare and one laid.
  `--svg` draws each ground storey; `--out` builds the page. docs/facility-pieces.md; the `gameworld-wcd` card names them.
- **In the game book**: the facility maps, `/bible?book=facilities` (`gameworld/facility-maps.js`): this game's
  building levels and the whole shelf, each storey from above (rooms, doorways, ways out, stairs, every piece by what it
  hides) with its laid rooms' laws, its materials, its moves and the recipe line that names it. `design_game`'s readout
  offers it to a world with a building level, a dungeon or a rail of interiors; the world book draws a facility level
  the same way, and the spike's plans are drawn by it.
