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
  - **The ground in front of a frame**, at its scale:
    - **outcrops**: low ledges of the same rock laid by the dice over the floor, off the blocks and the water, 2.5 to 7
      m high and 15 to 50 m across. Cover and a ledge to step up, stepped by the same beds.
    - **washes**: dry washes wandering across the floor, 1 to 1.7 m deep and never under the sea line, their beds laid
      as gravel (scree).
    - **scatter**: clusters of boulders 3 to 7 m across out on the open floor, off the rock and the water.
  - **Fallen blocks** are mostly small, with a few great slabs: the size's dice are weighted to their low end, up to
    12 m.
  - **Laws**: walls stand (the rise is climbed on faces over 70°), talus at repose, the floor open for a frame.
- **The rock's colour** (`form/rock-colour.js`, a geocube's `outside.rock`, opt-in, read by the form render's land for
  any cube that names it). The colour comes from the beds the rock is made of and the weather that ran down it:
  - **beds**: bands by height, each the stone pulled toward one of the cube's own colours (pale trim for upper beds) and
    lifted or darkened, eased over each contact.
  - **thin**: thin beds, each with its own small tone, so no two ledges are one colour and nothing repeats.
  - **wear**: the rock lit by its own shape. Each corner's standing out of or sitting back in its neighbours, along its
    normal, is read off the land's mesh: edges lifted, creases darkened, so every bulge a massif pushed is its own
    colour.
  - **sections**: the rock in sections, each a cell of jittered points keyed to its own place and never a repeating
    tile. Each takes its own small value and hue toward a cube colour; on a wall their edges are vertical joints.
  - **varnish**: dark streaks down the walls, a function of the plan alone so they run straight down any wall; a slow
    mask leaves some walls clean.
  - It is baked into the land's own corner colours over the rock layer, so a page and an engine handoff get the same.
    Absent, the land's colours are as they were.
  - Each battlefield cube names its column: a dark plinth, the massive red wall, a lighter band, and pale upper beds
    weathered toward its trim (Wadi Rum's Disi over its Umm Ishrin).
- **Rubble at a cube's scale** (a geocube's `outside.rubble: { sizes, density }`, opt-in; `form/land-read.js`): the
  scree's instanced stones at the cube's own sizes. On the battlefield cubes that is 0.8 to 3.6 m across, a frame's
  knee-high rubble where a walker's pebbles would be. Absent, the stones are as they were.
- **Stochastic tiling** (a geocube's `outside.tiling: 'stochastic'`, opt-in; `scene/channels/form-land.js`). The form
  render's natural layers (rock, scree, soil, sand) never repeat in a grid.
  - A slow noise over each tile picks one of eight offsets and the next. Both are sampled with the tile's own
    derivatives, so there is no mip seam, and blended across the noise by their own difference, so the join wanders
    with the texture's shapes.
  - Absent, the page's shader is as it was. The battlefield cubes take it.
- **A massif's rock is bare** (`local-meru/scene.js`, `massif.js` `inside`): anything on the rock itself steeper than a
  near-level bench or top is rock, so its domes and shoulders never wear an apron's soil and scree.
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
