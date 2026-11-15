### Geocube refinements: a trail library, an open world map, cliffs that make sense

- **The trail library** (level/block-fills.js). A block of a planned map (level/plan.js) was laid one way before its
  author wrote it: a line from gate to gate through its middle. A plan may now name a template for each block
  (`key.<S>.fill`), each a procedure over the block's size and gates, turned to whichever sides its gates are on:
  `through` (the way it always was, and still the default), `round` (the way goes round the middle by one side),
  `loop` (a ring round the middle, every gate on it: two ways round), `spur` (through, and a dead end off the middle
  toward a side with no gate), `crossroads` (through, a branch toward every such side) and `switchback` (lanes back and
  forth between two opposite gates). A ring lies a tile in from the border, so a template never joins a neighbour where
  the plan did not. A template the block has no room or gates for is laid as the nearest that fits; a goal still stands
  at the block's middle with a way at its door. A plan that names no template is laid byte for byte as before.
- **The game door's world map is an open world** (gameworld/world-map.js). It was blocks in a snake, each a corridor.
  Now its blocks are 5 × 5 tiles laid by the library (the village its street, the road a ring, the ruins and the town
  crossroads with dead ends for their finds, the zones after in turn, the goal ringed by a way), and wherever two blocks
  lie side by side off the walk a side way joins them (the plan's `joins`), so the map has loops and the goal is reached
  two ways. The opening keeps its one way out. Fights stand at each block's heart, on its ways; finds beside them. The
  walk itself (map-items.js `mapWay`) keeps to its route where a join would shortcut it, so every block still holds its
  pack and the guide leads the long way. The world's bible draws the side ways, dotted, on its map.
- **A shortcut costs more.** A side way that skips blocks of the walk is held: a band stands at its gate in the block
  it comes out in (five of the rank and file and two elites by default, `WORLD_MAP.shortcut`, against a block's own
  fight of three), off the walk, so only a player who takes the short way meets them. The long way stays the taught way.
- **Cliffs that make sense** (level/map-cliffs.js, era/out-tile.js `riseAt`). A sketch may say `cliffs: true`: where its
  approved heights stand 6 m or more apart between two tiles side by side and no way crosses that edge, the land no
  longer eases from one to the other across both tiles (a long ramp nobody asked for): each holds its height to their
  shared edge and steps there, a rock face 2.4 m wide whose line wanders, drawn as the kit draws any steep ground. Where
  a way crosses, there is never a cliff: the way keeps its eased climb. So a cliff is always the edge of somewhere
  higher that nobody walks over, and a trail is where it is passed. The scarps ride in the level's rise, so the page,
  its ends, its zones and its far view read one land. The world map lays its blocks as terraces that climb a step a
  block to the goal's heights, each way a step a tile at most (cut down into the higher terrace where a side way comes
  up from low ground), and asks for the cliffs. A sketch that does not ask, or whose heights never step that far, is
  read as before.
- **A terraced land rolls less.** The level's own hills (about 5 m either way) lost a 3 m terrace in their roll: on the
  world map the ruins' high ground stood over the river town's low ground a step above it. A map that asks for its
  cliffs lays its hills at 2 m (`MAP_CLIFF.hills`, riding in the rise), so each terrace reads as one: the blocks' land
  now stands in order with little overlap (ruins 1.2 to 4.6 m, river town 3.7 to 7.2 m, castle heights up to 9.3 m).
- **Fewer bushes by a tile's way.** The world map asks five bushes a tile (`WORLD_MAP.shrubs`) where the kit's card
  gave a tile a whole trail's fourteen.
- **The map designer draws the cliffs.** The world map in miniature and its greybox model (level/worldmap-view.js,
  worldmap-model.js) read the same scarps the pages lay, so a map is looked at with its cliffs before it is built.
- **A map is looked at before it is made.** A gameworld's planned map is served in miniature as a book
  (`/api/sketches/<ref>/bible?book=map[&level=<id>]`, gameworld/map-designer.js): its blocks, ways, side ways, heights,
  cliffs and beats from the recipe alone, no tile built. `design_game`'s `worldmap` step carries it as `look`, and the
  next-moves card says to open it and show the creator first, before a block is written or a page built, and after each
  change; the card's ceiling moves 4864 → 5120.
- **The world map test bed walks a page of several blocks.** Its gate walk (gameworld/worldmap-bed.js `crossings`)
  read a page's gates by side alone and stopped at a page of two blocks, whose gates are named by block and side.
- **Measured:** a zone's page of the world map is heavier for its bigger blocks, as payload: the opening 40 MB, the
  first zone (two blocks) 70 MB, the goal's zone 52 MB (42 tiles, 25 its own, about 162,000 faces), where the goal's
  zone was 34 MB (20 tiles, about 89,000 faces).
