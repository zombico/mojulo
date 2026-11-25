### Mech Battle Kai terrain: sandstone cliffs, gorges, talus and water for a frame's field

The land a frame fights on raised from rolling dunes round a mound to sandstone country: sheer jebels stepped by their
beds, gorges and siqs between them, talus and fallen blocks at their feet, and water the suits hover over. It is pure
terrain with no trail and no seam, since the field is read off its radar and its beacons. It is tied back to the game
book's map: a frame level's plate is now its operation map. Buildings come after.

- **The massif** (`local-meru/massif.js`, a local meru island's opt-in `massif`, a geocube's `outside.massif`). A field's
  standing rock as words: a card (`wadi`, `gorge`, `scree`, `oasis`) or `{ from?, … }`. Absent, a land is as it was.
  - **Blocks** (jebels, buttes, the plateau a canyon is cut through). Each block's plan is a superellipse warped into
    lobes and fluted into vertical ribs.
  - **Beds.** One column of beds runs through the whole massif, so every block's walls step at the same heights and the
    country reads as one rock cut apart. Each riser is sheer at its foot with a rounded shoulder; a bench's run wanders
    along the wall. A cap tops the block: domes, beehive knobs, or flat.
  - **Cuts** (gorges and canyons) take the same wall profile from the other side. **Clefts** are slots cut into every
    block from its edge, Wadi Rum's siqs.
  - **Talus** lies at the angle of repose, lobed into fans, with fallen blocks strewn on it as boulders.
  - **Water**: river beds and pools carved under the floor's datum, so the island's sea fills them with no water of
    their own.
  - **The face** (`face: { beds, bulge, undercut, grain }`): the walls' own relief at a mech's scale.
    - The column is parted again into thin beds 5 to 10 m thick, each with its own hardness.
    - Every wall is cut at those partings and at each bed's middle. Each corner is pushed along the wall, out of the
      rock: a hard bed bulges, a parting recesses, a massive bed's foot is undercut, and a grain of noise in all three
      directions keeps any two walls from matching.
    - The push swings over a few hundred metres, so one jebel stands massive and smooth and the next is ledged bed on
      bed.
    - The push is a function of place alone, so faces that share a corner still meet. It adds no faces beyond the cuts.
  - **Fallen blocks** are mostly small, with a few great slabs: the size's dice are weighted to their low end, up to
    12 m.
  - **Laws**: walls stand (the rise is climbed on faces over 70°), talus at repose, the floor open for a frame.
- **The battlefield cubes** (`assault-frame/geocubes.js`, in `GEOCUBE_PRESETS` with their palettes and outposts).
  - `sandstone-wadi`, `sandstone-gorge`, `scree-scarp` and `wadi-oasis`, sized for a frame 7.5 to 9 m tall: walls 40
    to 120 m, gorges 25 to 200 m, talus 10 to 40 m out, blocks 3 to 7 m.
  - Each is red sandstone over an orange sand floor under a hard desert sun and a clear sky with no stars by day.
  - Each cube's outside is a field: an open island with no geology, its floor long low dunes, its rock the massif's card.
- **The field's forms** (`assault-frame/field.js`): `wadi`, `gorge`, `scree` and `oasis` beside `plain` and `basin`.
  - A massif form is its own cube's unless a world is named; Warlords can lay Mars's dust on a wadi's shape.
  - A frame level's map may name one: the flight map checks the rest (`gameworld/world.js`).
  - The level reads its geocube through `frameLevelManifest` (`gameworld/levels.js`).
  - Its walls are drawn as their bands stand, without the page's rock relief, which cracks walls this tall.
- **Water under a frame.** `frameField` returns the ground a frame stands on: the land, or the water's sheet where the
  land lies under it, since a frame hovers and never goes under. `landAt`, `waterAt` and `sea` are kept for the hover's
  effects to come. The page's ground probe already finds the water's mesh.
- **The operation map** (`gameworld/frame-map.js`): a frame level's plate in the game book, in place of the flight map's
  rectangle.
  - The field from above, shaded from the north-west: rock by its height, walls dark, water blue.
  - The square a frame keeps to, the drop and the exit.
  - Every group of the operation where the level lays it, marked by kind, and each reach task's beacon with its radius
    and its order.
  - The radar's ring round the drop.
- **Fixed on the way.**
  - A wall on a 4 m grid is cut into bands at fixed heights (a massif's thin beds' partings and middles; 6 m
    elsewhere), so the scree at its foot stays in its lowest band rather than smearing up the face. On a massif, every
    face is cut at the same heights, so shared edges agree.
  - The land's layers take even dice (`form/land-layers.js` `even`, opt-in, on for a massif land). Their wander and
    scree patches no longer run in bars along y, which read as stripes from a frame's height. Absent, the dice are as
    they were.
