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
- **A composed town stands on the metro's land.** A geotown composed into a geocity (a neighbourhood or a block, geocity
  /towns.js) took the metro's natural ground and blurred its own streets' ground from it inside its frame, its edges
  clamped: along its frame it differed from the metro's by 0.05 to 0.09 m on average and up to 0.23 m (lakeshore and
  harbour-island, 56 to 60 m of relief), a step against the metro's walks round it. Its streets' ground is now the
  metro's own (`streets`, geotown/design.js geotownLand, threaded through the town's design and scene), equal to the
  millimetre. A new law on the page as built, `town-seams`, reads each composed town's street-level ground (its roads,
  walks, verges, lanes and margin; never a house's pad, stepped on purpose and closed by its own bank or wall) just inside
  its outline against the metro's green just outside, within 0.3 m (a kerb's): 0.19 m at most now, 0.62 m before.
- **A seventh generation metro is the form render's.** A gen-7 geocity was painted massing and drapes under the form's
  sky: its builder was never told the read was a form read, and none of its ground was the land the form reads. Now
  (ctx.form, worlds/world-kinds.js) its soft ground (parks, medians' lawns, the green round its towns, its lawned pads:
  `FORM_GROUND`) is the form's land, its street trees the form's plants (`plants`, grown as form, form/flora-read.js), and
  its composed towns are built in the form too, their trees, bushes and shrubs carried into the metro's (a block town's
  on its block, its bushes' kinds merged into one list). Its land is read as a town's (lawns mown, no trail's rubble), and
  it says what it got (`geocity.form`). Its buildings keep their own tiers (detail, massing, skyline) under the live
  light: the far structures' cards (channels/far-structures.js) are not baked for a metro (`structures: false` on the land
  read, emitted only when a page asks), since a card reads a painted fill a metro's textured faces do not carry, and they
  stood in black. The form's land read takes a face without a fill at its first corner's colour, where it threw. A
  gen-6 metro is as it was.
- **Uphill and downhill streets: a geotown's streets on profiles.** A geotown's streets rode its land blurred 24 m, so on
  hills a crossing tilted (1.3 m across one on the default hills, 4.5 m on 25 m over 400 m, 13 m on 40 m over 200 m) and
  each block rose and fell with every hummock under it. With `profile` (geotown/profile.js, opt-in: `true` or
  `{ walkable, curve }`) each street is laid as a hill town lays it: its crossings held level at the land's height there,
  each block between two crossings graded on one ramp (the hummock between cut and filled) with its ends eased in vertical
  curves, and past the outermost streets each runs on level to the frame's edge. The streets' ground is the profiles
  filled over each cell of the grid (a Coons patch, its shares eased over each crossing), so every street's line is its
  profile and every crossing is level corner to corner (0.00 m on all three). The town says its profiles (`profile`: each
  street's crossings and stretches, rise and grade), and a new law, `walkable`, names every stretch steeper than a street is
  walked at (20 % by default), too steep to walk (a street's stairs are its buildings' front steps, never the street's
  own): none on 25 m over 400 m (19.5 % at most), two on 40 m over
  200 m (48 % and 31 %). Graded blocks step their pads more than draped ones (25 m over 400 m: 1.47 m against 0.94), so
  `pad-step` advises there. A town composed into a geocity keeps the metro's streets' ground. A town without `profile` is
  laid as before.
- **A geotown parks the registry's cars.** Its parked cars were two painted boxes each (a body and a cabin). They are
  now the vehicle registry's family cars (geotown/cars.js: a sedan, a hatchback, a crossover, an SUV, an estate, a
  minivan, a supermini, each word read through its row to its car shelf card and compiled realistic), at the kerbs (each
  nose the way its side of the street drives), on the front pads, the forecourts, a walk-up's lot, a shop's yard and a
  school's or sports field's lot. A town parks hundreds, so each model is drawn once as an instanced repeat: its painted
  body baked pale and tinted per car by its paint, its trim (glass, tyres, wheels, lamps) a second repeat on the same
  transforms; the town's dice that placed and painted its cars are as they were, a model chosen by its own. A town's
  counts say its `cars` and `carModels`. A page carries about 24,000 faces of templates more, and its box cars' faces
  fewer. In the seventh generation the cars are the studio's bake, not lit by the form's light.
- **Drives and one-car garages: a houses block's `access`.** A geotown's houses blocks reached their cars by a rear lane
  (garages off it for a share), mutual drives between houses, or neither, by the pattern's dice. Now a town may say
  which (`access`, every houses block's) and a block its own (`blocks: { A1: { access } }`), and two more are laid:
  `compact`, each house its own drive from the walk, across its boulevard to the kerb, to a one-car garage beside the
  house, its door a little back of the house's front (its lot a garage's bay wider, a semi's garage on its outer side,
  no mansion on the block, the drive cutting the kerb's stalls, a car on a share of the drives); and `alley`, a rear
  alley, every house a one-car garage at its yard's back off it, behind an apron ramped from its door down (or up) to the
  alley, its sides retained, a car on a share of the aprons and the street's front yards whole. Each garage is solid
  (`<plot>:garage`). The ledger closes over the new drives and garages; the laws read a compact lot's frontage and
  coverage without its bay (a compact row laid to scale fills tight, a building at its least where its roll did not fit,
  and stretches its fewer, wider lots up to a tenth), and the parking law counts a single garage and its drive or apron.
  The pattern's dice take `compact` and `alley` shares, none by default: a town that asks neither is laid byte for byte
  as before (its layout's hash unchanged on seven towns across the evocations, streetscapes and patterns).
- **The slope word: this climbs.** A geotown may say how it climbs (`slope`): `{ toward, grade }` its land rising toward
  a side at a grade over its hills (its streets and its houses' pads with it), and `streets: { 'ns-1': 0.12 }` streets
  that climb at their own grade toward their north or east end (one axis, so no crossing is set twice), laid on their
  profiles (a profile on whether asked or not): each such street's crossings set at its grade from its first, its cross
  streets graded to meet them, and the land under it and its lots lifted to its climb (geotown/profile.js `climbLift`),
  full a third of the way to its parallel neighbours and eased out there, so its houses climb with it; where it outruns
  them its cross streets are too steep to walk, and `walkable` says so (a 14 % climb beside level streets: its cross
  streets at 33 %).
  A town composed into a geocity takes no tilt of its own (its land the metro's).
- **A geocity's streets on profiles.** A geocity may lay its streets as a hill town does (`profile`): its arterials'
  crossings level at the land's height there, each block between them graded on one ramp, the land's edges kept on the
  land's own ground (the shore where it falls to the water, the beyond where a town joins); then inside each
  neighbourhood its collectors and locals the same, the neighbourhood's edges kept on its arterials' ground; and every
  geotown it composes profiled too, unless its recipe says, its perimeter streets kept on the metro's ground so its
  seams hold (`town-seams`: 0.20 m at most on a hilly lakeshore, against 0.27 m draped). A profile keeps lines given as
  the edges it must meet (`keep`), names its lines (`ids`) and climbs the streets asked (`climb`). Arterials that climb at
  their own grade: `slope: { streets: { 'ns-2': 0.04 } }`, the land under them lifted with them. On a hilly lakeshore
  (30 m over 900 m) the arterials' crossings tilted up to 0.77 m and the neighbourhoods' up to 0.47; profiled, 0.00 and
  0.03. The stretches past the walkable grade are said by a new law, `walkable`, the profiles by the page (`geocity.profile`).
  Two crossings whose reaches meet are a step between them, their grade read on the run between their middles. A metro
  that asks neither is designed byte for byte as before.
- **Too steep to walk, said; every street's grade by its rank.** A profile's stretch past its walkable grade is `steep`,
  and the law naming them is `walkable` (in the geotown and the geocity): too steep to walk, never a stair wanted (a
  street's stairs are its buildings' front steps and stoops). The `grade` laws read every street by its rank: a geotown's
  local streets against the pattern's `grade`, its main and major streets against its gentler `grades` (6 % and 5 %; the
  old town's 8 % and 6 %), naming each street over its own most and the steepest; a geocity's arterials against its
  `grade` and, newly, each neighbourhood's collectors and locals along their runs against its `grades` (a recipe's
  `grades: { collector, local }`, by default the gentler of 10 % and 12 % or the arterials'), each measured every 4 m on
  the streets' ground as built (profiled where asked), naming each street over and the steepest of each rank.
- **The metro at a person's height: storefronts, windows, doors.** A geocity's buildings were massing at street level
  (grey and brick boxes without a window, lit panes past dusk only) and an evocation's detailed facades met the walk with
  blank ground floors. Now near a person's eye (each camera within 25 m of the ground) every building's walls are
  dressed (geocity/frontage.js), as the street kit is, by templates the light is baked into (each way a wall faces its
  own) stamped as instanced repeats drawn near the camera: WINDOWS in frames with a stone sill and head on every storey
  (a block of four bays by two storeys where it can be, its windows stretched to the wall's bay and storey, a template
  once each frame's paint); STOREFRONTS on its shopping streets (arterials and collectors in the core and the frame, main
  streets, avenues): glazing over a stall riser between pilasters, a door, a transom, a fascia sign in its shop's colour,
  an awning on nearly half, a band over them; APARTMENT ENTRIES on its residential streets (a pair of doors in a stone
  surround under a canopy, a step), every 18 m or so among ground-floor windows; an office's LOBBY under its canopy among
  shops; BALCONIES on nearly half its residential buildings; a cornice. A mid-rise's courtyard walls and its wings' joins
  are left bare; a tower's shaft takes its ground floor (its skin over it is its own); an outskirts house its windows and
  its door on its street; an evocation's detailed lots their ground floors, stood proud of their piers. The page says how
  many walls and pieces (`counts.fronts`, `frontPieces`): a core neighbourhood about 400 walls in 30,000 pieces, its page
  4.4 MB heavier (36 to 40 MB).
