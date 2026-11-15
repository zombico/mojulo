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
- **Measured:** a zone's page of the world map is heavier for its bigger blocks: the goal's zone 42 tiles (25 its own)
  and about 217,000 faces, where it was 20 tiles and about 89,000.
