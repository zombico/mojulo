### A modern European old town, walked as a game

- **A modern European old town, a geotown pattern** (`geotown/pattern.js` `old-town`). Its streets are narrow setts
  lanes with flagged walks and no verge. Its town houses are rendered terraces three to five storeys high, built to the
  walk party wall to party wall. Its main street has shops on the ground floor, and the blocks behind hold gardens and
  courts. Each house has its own render (ochre, cream, terracotta, rose, stone, grey-blue under slate), its own
  shutters, and wrought balconies on some. It comes with one streetscape, `old-centre`, and two neighbourhoods:
  `old-centre` (terraced lanes round a main street of shops) and `market-street`. Where it does not differ it keeps
  the suburb's own: its fences, sites, furniture and houseplants. The suburb, `bay-and-gable`, is unchanged byte for
  byte (its design and scene hashed before and after) and stays the default.
- **The old-town house style** (`era/arch-style.js` `old-town`): lime render over an ashlar ground storey, tall
  shuttered casements in stone surrounds, a shallow clay-tiled hip behind a deep cornice, setts and flags.
- **A pattern's street furniture can be European.** `furniture.lamps: 'lantern'` lights every street with a lantern on
  a cast-iron post (no wooden pole, no arm, no wires). `furniture.paint: 'none'` leaves the lanes unpainted, with no
  yellow centre line. Neither is set for the suburb.
- **A square, a new site** (`geotown/sites.js` `square`, the segment letter `Q`). It is a paved piazza laid in the
  pattern's `piazza` finish. Its church stands on its own lot across the far side with its door to the square: a
  `church` row in the gothic-parish style, from a site plot that can now name its kind and where it stands (a school's
  lot still stands at its site's front corner, byte for byte). It has a stone fountain in its middle and café tables
  under parasols along its flanks, each parasol coloured from the pattern's awning colours. A square is not a playing
  field to the spacing law. The old town's third neighbourhood, `square`, sets the church and its piazza among the
  terraces. The new `piazza` surface enters a town's ledger only where one lies, so a town without a square keeps its
  ledger's bytes.
- **A game level can be a town.** `levels.<id>.geotown` takes the geocube kind's geotown: its pattern, streetscape, a
  segment or a neighbourhood. The town is the level's only ground, so it takes no walk, building, city, roadway,
  airspace, runner, places, ground or arena. It is drawn on the level's cube (a morning valley unless the style names
  one) and read in the seventh generation unless the cube names its era.
  - **Its stage:** one stage (`levels.js` `gameStages`). Its ends (`stageEnds`, through `geotownEnds`) set the hero
    down at the start of the walk round its first block, facing along it, with the exit at that walk's far side and
    beats along the way. Its ground is the town's ground faces, never a roof, and its colliders are its buildings'.
  - **On the page:** the geotown takes only its own settings, and the level's pilot and game are layered over it with
    no stand-in walker (`world-kinds.js`).
  - **In the books:** the world graph, the bible (the town's sheet), the atlas, the battles page and the review print
    each read it.
- **A quick game can walk a town.** `quick.geotown` is reached, collected along or survived. It refuses a building,
  climb, ride, run, roadway, runner or race beside it. With `hero: { form: 'realistic' }` its pilot is the realistic
  body.
- **Shutters with lines, as relief.** A building language's shutters take three more forms from the design library
  (`era/shutter-leaves.js`):
  - `persiana`: slats in a frame of stiles and rails.
  - `panelled`: two fielded panels.
  - `ledged`: boards, two ledges and a brace.

  Each leaf stays one box on the wall. Its front wears a painted tile of its form, and near the eye the World page marches
  the form's height along the view (parallax, `scene/channels/leaf-relief.js`). A street of shutters costs the faces it
  had. The old town hangs persiane, its rose houses ledged boards and its stone houses panels. `boards` and `louvred`
  draw as they did. A page with no leaf carries none of the channel.
