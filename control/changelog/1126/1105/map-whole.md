### The map, whole: planned as one, written in segments, consolidated into one page

- **A map's tiles are built with the world's whole context.** The map kind handed its sections the page's title alone,
  so a tile never had what a stage page has: the live sun's share (an actor's shadow darkened baked shade twice), the
  form render's read, and the unshaded export (a map handed to an engine was built shaded). Each section is now built
  with the context the stage kind is.
- **What a tile's page says beside its faces reaches the map's.** The groups walked through (`soft`, a bush's, an
  arrangement's) of every tile; the cloud deck (`effects`), one a map; the fauna of every tile on the level's frame (its
  swarms laid together kind by kind, its birds one flock over the whole map, its herds each named for its tile); and the
  live wind's trunks and the petals' crowns of every tile, so the wood on every tile is held by its own trunks and not
  swayed as leaves (`oneGrass`).
- **One hero tree a region, one horizon a map.** Every path tile grew the card's hero tree near its north seam, and
  every tile built its own far ridges for the map to drop. A tile now lays a hero only where its map names one (a
  region's straight or bending path tile nearest its middle: `tile.hero`, beside its path's middle and clear of its
  seams, `heroSpot`), and its far layers only on the first tile and on a place's (`tile.backdrop: false` on the rest; a
  building is seated on the land they lay). The first tile's horizon rings the map with its heights scaled as it is,
  so the skyline stands at the angle its stage drew it at, over the map's rim.
- **Snow on a map is refused by name.** Snow lies on a polygon land (a stage's `shading`), which no tile of a map is
  built on yet; a level's or a region's `snow` says so, where the stage threw from inside its kit.
- **A map planned as segments, written in them.** A glyph map may be written as a PLAN (`grid.plan: { size, rows,
  route, key }`: its segments laid out, the walk through them, each segment's name, role, rise and words) and its
  SEGMENTS (`grid.segments.<S>: { rows, key }`, each size × size), in place of one grid's rows (level/plan.js). The plan
  fixes where the way crosses each seam before any segment is written: a GATE at the middle of each border the route
  steps across. A segment not yet written is laid from the plan (gate to gate by its middle; the first from an end, the
  last to its goal place), so the map is one whole level at every moment. A written one is held to its law: a path at
  each of its gates and none on a side a neighbour lies beyond but there, every path reached from its gates, the plan's
  goal held. `readGrid` stitches them into one grid, each segment its region and a place glyph two segments share
  renamed, so the page, its ends, the game's battles and its quest all read one map; a quest's beat plays a segment by
  its letter. The roles are the scene composer's: the route's first segment the arrival, its last the climax, the rest
  passages, a segment's own pinned. A grid written as rows is read as before.
- **A planned map written by a crew, an author a segment.** `req: { unit: 'level:<id>', segments: true }` raises one req
  for every segment of a planned map: its first segment the unit (`level:<id>/<segment>`), the rest its crew, an author
  each in its own seat. A segment's author is handed its plan's remit (its role, its words, its gates and the neighbour
  each joins, the quest beats played on it, the floor the plan's fill lays, its law) and writes its segment only
  (`/levels/<id>/glyphs/segments/<S>`): a write past it, or a segment its law refuses, is refused before anything is
  stored, the job issued to report again. The map stays whole between reports (the rest laid from the plan), is
  played once by the probe however many segments its crew writes, and a segment's precedent is its own kind's.
- **A glyph-map level is a section of the world's graph.** The world's graph read every level as a walk, so a patch to
  any world holding a glyph-map level was refused at the door; it is now one section, the map.
- **A planned map's pieces: the composer's set pieces at the map's scale.** Each segment's role places its piece on the
  map as stitched (level/map-items.js): a pack on each passage's way, the boss on the climax's way before its goal, the
  hero tree beside the landmark's way (the arrival's, without a landmark). Read from the map's own structure, so a
  segment rewritten by its author still holds its pieces; the plan pins any piece by its id (`plan.props`: moved to a
  tile of its segment, or none), a pin off its ground refused. The page stands its hero tree there and the battles
  their packs; its laws say every passage holds its pack and the climax its boss, and it reads its pieces out.
- **A world's writes one at a time.** A crew's authors report at once, and each kept patch is applied onto the recipe as
  it is stored; the update reads the recipe and awaits its gates before it writes, so two kept together could write
  over each other. design_game now takes a world's writes (a req's reports, the director's patch) one after another.
- **A planned map sets out from its arrival.** A glyph map's walk starts at its path end farthest from its goal, else
  at its first path tile in reading order; a map whose ways all end at doors set its hero down wherever that tile lay
  (in the demo, the woods' lookout, heading into the map's edge). A planned map's walk sets out from its route's first
  segment (its path end farthest from the goal, else its path tile farthest from it), facing the next tile on the way.
- **A path's grade across a seam.** A map's laws measure where a path crosses between tiles whose regions rise apart
  (`path-grade`: the rise eased between tile centres climbs at most 1.5 × its step over a tile), walkable to 30%.
- **A loader for a world still being baked.** A big map takes minutes before the route has a byte to send, so a world
  opened in a tab sat blank with nothing said. A tab that asks for a world not yet baked is now answered at once with a small
  page saying so and counting, which asks for the bake (`built=1`, under the same cache key) and then opens the world
  (worlds/world-loader.js). A frame, a download, a script and a bake already held are answered as ever, and the world's
  own page is untouched. In a game, the shell's veil holds until its level's frame has loaded and says why, where it
  used to lift at 45 seconds onto a blank frame.
