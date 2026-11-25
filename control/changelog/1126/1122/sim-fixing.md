### Flight and the roadway races load again: the ground's grid and index sized to what they hold

A flight level and a roadway race (the kart oval, Race of Champions) never drew a first frame: the page's memory grew
past 3 GB and the tab died. Two indexes that let a ray test only the surfaces under it were sized for a walked level, not
for a flight's land 16 km across (hundreds of terrain chunks streaming in) or a race's 12 km backdrop.

- **The ground grid sized to its mesh** (`scene/channels/controllable/ground-grid.js`). `gridFit` began every big mesh
  at 2 m cells over its whole extent: 36 to 67 million cells for a backdrop or a land of a few thousand big triangles. It
  now starts at 2 m as before and coarsens, doubling, while the grid would hold more than 16 cells a triangle or list its
  triangles more than 32 times a triangle; then it halves toward a quarter metre while its fullest cell is crowded, as
  before, within the same limits. A town's ground, a room or a track keeps the grid it had.
- **A ray that misses a mesh tests nothing** (the same file). The grid raycast replaced three's own and skipped its
  first step, the bounding sphere: every ray tested against the land built the grid of every chunk, near or far. It now
  returns at once, as three does, when the ray misses the mesh's sphere or meets it past its far. A flight's page grids
  about 20 chunks, not about 500.
- **The ground's index sized to its items** (`ground-index.js`). The walker's ground probe buckets every surface at 4 m
  over the plan of them all, and is rebuilt when the set changes; a flight's chunks spread over 16 km made it millions of
  cells, rebuilt as each chunk streamed in, and it held hundreds of megabytes. `indexBuckets` now doubles its cell while
  it would hold more than 64 cells an item or list its items more than 256 times an item.
- Each of the three only chooses which surfaces a ray tests, so what a ray finds, and every page's play, is as it was.
  The flight level's heap, collected, sits near 60 MB where it climbed past 3 GB; the kart race's near 40 MB.
- **Pinned.** The grid's and the index's tests build a 16 km land of 341 m triangles, a 12 km backdrop and a flight's
  quadtree of chunks, and hold them within the limits with every ray and probe finding what it found before; a browser
  test on the e2e tier (`big-ground.chrome.test.js`) loads a flight level and a kart oval in headless Chrome and holds
  each one's collected heap under a ceiling (it fails on the old code: the page never comes up). The world pages that
  embed the controllable runtime carry the new code by its source and were re-pinned.
