### Geocube sharpening: the joined map's terrain, its ways and its shores

The geocube's terrain, reoriented on the joined map (the glyph map: tiles of one land, built a zone a page). This theme
makes the main world rich, so the level design department's play layer lands on a composition that reads as the map
asked: the cube's look on every tile, ways told apart by what they carry, and water whose edge is a beach or a cliff.

- **The cube paints the joined map.** A glyph map's level may name a `geocube` (with its `terrain`, `hour` and `clouds`).
  Every tile is lowered under it as a trail is (era/geocube.js withGeocube's tile branch): the cube's look on the tile's
  square of the level's one land, its land drawn as the cube's (its shading), its biocube and its wind where the map
  names none. The page's era, contrast and register are the level's cube's (`cubeSpecOf` reads a map's level), so a
  sixth or seventh generation cube paints the map as it paints its trails. A gameworld's glyph level takes its style's
  geocube, terrain and hour (and is lit by it: no `unlit` advice), unless the level names its own kit. `terrain`, `hour`
  or `clouds` without a cube is refused with words. A map with no cube is as it was.
- **A seventh generation map is the form render's.** A glyph map a geocube paints, read in a form era, takes the land
  read a geocube page takes (form/land-read.js: its land as material under the cube's light, the ways' dress, the
  biocube's moss and grass) and its plants grown as form (form/flora-read.js: trees with branches and leaves, bushes,
  shrubs) in the painted ones' place: the map page carries its tiles' plants on the level's frame (`plants`), and the
  land is read framed from the south over the map's middle, as an island's camera frames it. Before, a gen-7 map drew
  the sixth generation's painted trees and land under the live light. The page says what it got (`map.form`: the form
  read, its plants and its far range); a map no geocube paints, read in gen-7, is drawn as paint and says why and how to
  have the form's (name its level's geocube). The era's own record (era/eras.js) names the glyph map among what the form
  render draws.
- **Real mountains round a gen-7 map** (level/far-range.js). The far ring a map took from its first tile (painted
  curtains, scaled out round the whole map) read as the sixth generation's impressionistic backdrop, washed near-white by
  the distance. A map read in the form render is ringed instead by a range of real ground: rising out of the rim at its
  height (the rim is its foot, drawn as the same far land), ridged peaks on the level's frame growing outward over a slow
  lift, out to 800 m past the map. They are the form's far land (`isekai:ridge`): lit in facets, the grass's colour low
  and the stone's toward the peaks. Its own haze (`haze` on the land read: the page's fog at 0.3 of its density, and less
  of the sky's air) lets them read through a morning's air; the haze is emitted only on a page whose land read asks for
  it, so every other gen-7 page is byte for byte as it was. A painted read keeps its ring.
- **A gritty cube's tiles build.** A tile on a polygon land with grit (the cube's `grit`, at 0.35 and over) failed:
  its solid flora read an item off the gritty land's strewn stones, which carry none (they are skipped, as pebbles
  are). And its edge stones were strewn by the trail's line by depth, which a tile's ways do not follow, in rows across
  the tile and over the water: on a tile only those at a way's edge are kept, and none on the map's water or its
  beach.
- **A tile's casters are grown in its own look.** The trees and stones a tile hands its neighbours to cast across a seam
  were grown from `manifest.style`, which a tile never names: under a cube whose card is not the meadow's, the casters were
  the meadow's trees, not the tile's. They are grown in the kit's style, as the stage builds the tile
  (level/grid-scene.js).
- **Ways of rank** (level/path-ranks.js, `ways: 'ranked'`, the default). Each path tile's rank is solved from the
  network, never written tile by tile:
  - a **road** is the trunk through a town (a tile beside a building) or on a way joining two places door to door: 4.2 m,
    setts beside the houses, a stone road out of them, a narrow verge;
  - a **track** is the rest of the trunk (every shortest way between the doors, the start, the gates, and with no goal the
    far end): 2.4 m of beaten earth;
  - a **path** is a branch that leads on (to a door, to a fork, or back to the trunk: a loop round a pond): 1.5 m;
  - a **trace** is a branch to nothing, a game trail: 0.9 m.

  A region says its own (`path`: a rank, or `{ rank?, surface?, width? }`). Widths meet at every edge: an edge is as
  wide as the wider of its two tiles (a road runs on into a track at its own width and narrows inside the track's tile),
  and a way wanders a tenth of its width on the level's frame, so both tiles read one width at their edge
  (era/out-tile.js `way`). The walk's tests against a way's edge stay true: a tile's `trailDist` stands nearer or
  further by how much its way is wider or narrower than its middle, and the stones, shrubs and hero tree set along a way
  read its width where they stand (`pathAlong`'s `h` and `f`). A boulder set off one branch onto another at a fork's
  middle is no longer laid. `map.ways` reads the ranks out. `ways: 'one'` keeps every way the kit's one width.
- **Water across the tiles, its edge a beach or a cliff** (level/map-water.js, era/out-tile-water.js). A grid's `~` (a
  planned segment's too) and an approved sketch's `w` on open land are water tiles, gathered into bodies:
  - **its level**: each body stands under the lowest of the land along its outline, so no shore is under it;
  - **its shoreline**: the water tiles' outline, rounded over a 4 m disc, wandered by two octaves of noise and set in,
    so a lake is never a square;
  - **a beach**: the land eased down to a strand of sand from the waterline to its berm, a shelf falling away under the
    water;
  - **a cliff**: the land held up at least 3.2 m over the water, a sheer face of the cube's stone down to a toe under it;
  - **which edge**: each land tile beside water says it: its region's `shore` (`beach` | `cliff`), else its sketch (a
    cliff `c` or rocks `r`), else its drop (land standing more than 2.6 m over the water a cliff, else a beach); weighed
    along the shore so a beach turns into a cliff and never steps at a seam;
  - **a place beside the water** keeps its land as it lies, so its building stands on the ground it was planned on.

  Every height is a function of the level's frame, so each tile cuts its own square and two tiles meet at one height on
  every seam. The sheets lie only on the water's side of the shoreline (a hollow inland is dry land), each corner over
  dry land clear, so the water's edge is where the land meets it. The bed is sand under any edge, and nothing grows on
  the beach or on a cliff's lip. The rim rises from the water's surface where water runs to the map's edge. `map.water`
  reads the bodies out (their level, tiles and shore). A sketch's `w` and a `c` beside water are laid (`laid.water`,
  `laid.cliffs`); a cliff away from water is still named as not laid.
- **The map's laws read the land as it lies.** `seams` reads a beach's sand and a cliff's rock beside the ground (a shore
  across a seam was read on one side at the lip and on the other at the foot); `seam-shade` reads the soft land (a
  cliff's rock is baked a facet at a time) and, on a map with ranked ways, not the ground under a crossing way's ribbon,
  which is covered and never seen. A new law, `paths-dry`: no way's line lies under a water sheet.
- **Advisory, measured:** under a cube with a contrasty ground ramp (valley-morning's grass), `seam-shade` reads 9 to 11%
  on a wooded map against its 8% tolerance. Traced: a shadow's edge crossing a seam steps a whole ramp stop on that
  ramp, where the meadow's closer stops stay under the 4% a point is counted at; seen from above, the seams read
  continuous. The law advises; the tolerance is the meadow's.
- **The game book's world card** (`gameworld-world`) says the water, the ways and the style's geocube; its ceiling moves
  5248 → 5376.
