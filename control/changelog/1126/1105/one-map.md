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
- **Places and edges on a glyph map.** A place's key may name a building (`{ use: <program>, door? }`: a dwelling, a
  shop, a tavern, a temple…, era/stage-buildings.js): it stands on its tile with ONE door, the side its key names, else
  toward its main road (the path with the most paths round it), and a path opens toward a place only where its door
  faces it, so no road runs into a building's back. A tile clips only its outdoor dress to its square; a building is
  kept whole. The map is closed: walls along its border, and beyond it a rim of land rising 18 m over 70, from the
  land's own height there, so the world's edge reads as the valley's sides; its horizon rings past it all.
- **A glyph map's laws.** A map built from a glyph grid measures itself (`map.laws`): `one-page` every tile in one
  payload; `seams` each shared edge's ground at one height from both tiles (each tile's own corners on the edge line);
  `paths-clear` no collider on any path (sampled every half metre at a walker's height); `doors-clear` every place's
  door clear; `one-network` the paths one network. A whole map built through the kit's builder is held to them in the
  e2e tier (level/grid-scene.e2e.test.js).
- **Regions on a glyph map.** A grid may carry a second layer of glyphs the map's own shape, `regions: { rows, key }`
  ('.' the level's own): each region names a part of the map (the town, the meadows, the larch woods, the pass) and
  dresses its tiles with the stage's own words (`style`, `biocube`, `shrubs`, `grass`, `wind`, `snow`, `palette`) over
  the level's, and RISES over the level's land (`rise`, metres, −24 to 60), each tile's rise at its centre eased to its
  neighbours' between (era/out-tile.js `riseAt`), so the land stays one height across every seam however the regions
  climb. The page reads them back (`map.regions`: each its name, rise and tiles; each cell its `region`).
- **A glyph map's ground runs on across its seams.** A tile's ground patches are the level's, read on the level's
  frame, never its own; a tile's shadows include its neighbours' trees and boulders within reach (placed first, as
  their own builds place them, `isekaiTileCasters`; a place's tile built first and its grown things handed on as
  built), and its own casters are only those standing in its square. Bushes on a tile stand beside its own path,
  whichever way it runs. A law holds it: `seam-shade`, the share of points along the seams whose baked shade steps.
