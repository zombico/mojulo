### One map: a chapter is one level

- **A level laid as a map.** A level's graph may now branch: the `map` layout (level/map.js) lays it as sections
  PLACED on one ground, each with a position and a heading, where `sequential` laid one walk, a page a section. A new
  section, the JUNCTION (`junction: { radius, gates: { <gate>: <bearing°> } }`, level/graph.js), is a hub whose gates
  stand on its edge at compass bearings; an edge off it names its gate. A trail off a gate heads out along its bearing,
  its path's first point on the gate; a trail after a trail carries its frame on by its depth (its recipe `after` the
  one before, as a chain is laid); a trail may arrive at a junction, which is set past its far end with the gate turned
  back to meet it. The ground each section owns (a trail's whole site, a junction's disc) may not lie over another's:
  the layout refuses gates too close for their junction's radius, an arm folded back, and a loop, naming them. A chain
  is a map whose placements all point one way; `sequential` refuses a junction.
- **A map built as one page.** The `map` world kind (level/map-scene.js, `{ kind: 'map', level }`) builds every
  section as its own stage would and places it on the level's ground: its faces, repeats, lights and anchors turned to
  its heading and moved to its place, its heights met at the gate it leaves from (a trail after a trail keeps its
  parent's lift, its seam built in heights already), its walls on a turned frame laid as runs of short boxes so every
  reader of colliders reads them as before. Each trail keeps its band only (the apron its own page lays past it is
  dropped); the junction is a flat disc of paving; THE LAND BETWEEN is filled on a 4 m grid over the whole map, its
  heights from the bands' own edges (the nearest ruling), lying under each band where it reaches into it so a seam has
  no gap and no flicker; and the root's horizon rings the whole map. The sky, light and walk are the root's.
- **The glyph grid.** A map level may be written as a small grid of glyphs, one square tile each (level/grid.js
  `readGrid`: `grid: { tile, rows, key }`, north row first; `#` a path, `.` open land, a letter a place the key names: a
  town block, a building). Every tile is the same square, so tiles sit side by side, never over each other, and a path
  crosses a tile's edge at its middle, so two tiles' paths always meet. A path tile's SHAPE is solved from its path
  neighbours, never written: one edge open an end, two opposite an I, two adjacent an L, three a T, four an X; a place a
  path reaches opens toward it. The paths must be one network, walked end to end.
- **A glyph map built as one page.** Each tile of a glyph grid is built by the kit's own builder from a TILE SITE
  (era/out-tile.js `outTileSite`, a stage's `tile` in place of its `trail`): its square of the level's ONE land (the
  level's height read in the tile's own place, so tiles agree along every shared edge), its path's solved shape from
  each open edge's middle (an I straight through, an L a quarter arc round its corner, a T or an X meeting at the
  middle, an end stopping there), the path's bed eased level as a trail's. The kit's builder lays it as it lays a trail:
  the ribbon along each of the path's polylines (nature.js `trailFaces`), the boulders, gate stones and pebbles along
  the path wherever it runs (`pathAlong`; a trail's stones exactly where they were), grass, rocks and trees round it; a
  tile with no path gets no path. The map's page (level/grid-scene.js, the `map` kind with a `level.grid`) sets every
  tile at its square, clips it there, writes every tile's grass into ONE field over the map, rings the map with the
  first tile's horizon, and spawns at the first path end.
