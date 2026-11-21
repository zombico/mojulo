### Racing: a track's design language, the runner's segment on a track, the race on the game UI

In progress. Built so far:

- **Built: a track's design language** (`roads/track-language.js`, a roadway's `language`). A card names a small family
  of materials (what each is, its finish, its colour) and the parts drawn in them: the way, its edge, the corners'
  kerbs, the rail, its posts and their caps. Two cards: `candy` (a kart track of moulded plastic: a pale way with a
  cream bead at each edge, striped pillows on the corners, one glossy tube rail on round posts with a ball on each)
  and `grand-prix` (a circuit: the look's own road and painted kerbs, a W-beam guardrail on steel posts). A rail wears
  its tell in stripes round the outside of a corner. A track from words takes its class's language; a track given none
  is drawn as it was.
- **Built: the language's laws** (machine; they advise): a premise said, a small family every part draws from, the
  rail and its post of one stuff, two finishes at most, the kerb read against the way, a tell that is not the rail's
  colour, a class it suits, and nothing drawn outside the family.
- **Built: the chunky look** (`roads/chunky-look.js`, a kit's `pole: 'chunky'`): smooth rounded polygons under a soft
  light, a gloss on plastics. A kart track from words is drawn so unless a word says otherwise ("voxel", "blocky" and
  "cubes" still give the cubes; "chunky", "rounded" and "plastic" name it). Its light is baked: not yet lit by the
  page as the kart is.
- **Built: a language's sky and what is seen to move.** The candy card says its own day (a blue sky over a pale
  horizon, a sun) and its clouds, built as the track is: puffs of rounded chunks in a ring round the course. Its way
  is laid in bands of two tones with a cream dash down the middle, and its verge is mown in stripes across the way,
  so the pavement and its sides are seen to move at speed.
- **Built: a corner told on the way, flags down a straight, trees built as the track is.** Chevrons on the way before
  each corner, pointing into it, on the outside half. Bunting on tall poles down one side of a straight, the side by
  turns. On the chunky look the land's trees are a stout trunk under a crown of balls set off-centre, no two alike, a
  share in blossom. The two sides of a track never mirror.
- **Built: the trackside in the language.** A language names a stand-in for each set piece and paints every surface
  group in its own materials, so the arch, the braking boards, the castle and the bumpers are of the track's family.
  Candy's: a fat hoop on two balls with a stripe and a banner hung off-centre, a lollipop board counting down in bars,
  a cream tower with a band, balls for battlements and a berry roof, a castle whose tall tower stands off its middle,
  bumpers of three rolls. The venue's own buildings take the family's paint too. Two primitives join the block library
  for them: a ball, and a ring with a round section (a square one, as before, unless it says).
- **Built: a kart track lit by the page, its sun casting** (the seventh generation's form render). A chunky track's
  faces are built in their colours alone, every part's normals kept, then baked as the gen 7 town's buildings are
  (`roads/track-form.js`): each corner its base and the day's light apart. The page lays the sun's shadow live: the
  static world into a map fitted to the track, drawn once, and the karts into a map that follows the action, each
  darkening only the sun's share of a corner's light, so a shadow is a soft blue. The sun stands at 36° so the rail,
  the posts, the balls and the arch lay shadows that read from the kart. The palette is held on what lies flat: the way,
  the kerbs and the verge show the card's own colours. A kart track from words is drawn so; "baked" bakes its light as
  before. The outdoor bake (`form/sun-light.js`) gains two opt-ins for it: a normal a corner for what is drawn smooth,
  and a reference face the colours are held on. A world's page keeps a builder's own fitted shadows, the live
  defaults filling what it leaves unsaid. The page weighs more with its per-corner light (about half again).
- **Built: the race's HUD on the game UI runtime** (`gameworld/race-hud.js`, hosted by the level page's HUD channel).
  Every roadway level raced by laps wears it: the place, large, over the field; the lap of the laps, this lap's time
  and the best; the track's map with you and the field on it; the speed on a dial; the final lap and the finish as
  moments. It keeps to the corners and the right edge, the way ahead and the kart left clear. The start is five lights
  on a plate, one a beat, out together for GO: the karts held and the world frozen with the race's clock until they
  go out (the race's time was counted from the page's first frame before). Read off the laps mechanic's own vars; the
  raw widget rows (Time, Lap, Place) stand down beside it. A tall frame lays the place and the lap on one plate at the
  top. Two looks for racing on the theme shelf: Candy Kart (`kart-candy`, the toy family, the candy track's own
  palette) and Pit Wall (`pit-wall`, the clean family: a timing tower, near-black and quiet), worn by a race by its
  track's language or class unless the world names a theme. The minimap gains a `route`: a way drawn under its markers
  as a dotted line, in the place of the blank map.
- **Built: a street circuit, a kart race through a toy town** ("a kart street circuit", "downtown", "through the
  streets"; the course preset `city-blocks`). The lap runs round a few blocks of a grid grown from one, its corners
  square (`roads/course.js` `designStreets`, its blocks kept on the course). Its town is laid from the geocity's ideas
  in the track's design language (`roads/street-frontage.js`, the `candy-city` card's `city`): rows of buildings face
  the way down each side of every straight, past the rail and a sidewalk; they rise toward the town's middle (shops at
  the edge, flats, a few towers at the core), never three of a kind in a row, each in a colour of the family by turns,
  never the one beside it, none standing in another. Lamps down the sidewalks by turns, a signal at the outside of
  every corner, a zebra across the way at each straight's start. The town is planned before the land round it, which
  keeps clear of it; a street circuit has no venue beside it, and its side pieces give way to its fronts. New blocks
  for it: a toy shop, toy flats, a toy tower, a lollipop lamp and a signal of three balls, each held to the block laws.
  A realistic street circuit ("a street circuit") gets the square course and no town yet: only the kart language has
  one.
- **Built: a split and an underpass on a street circuit** (`roads/street-features.js`, the language's `city.split` and
  `city.tunnel`). Before a corner a cobbled alley leaves the way and cuts across the corner's inside to the straight
  after it, leaving and rejoining along the way's own line; either way is the lap: the alley is drawn in the language
  (cobbles in two of its colours) and driven as road (its points join the drive surface), the rail opens at its two
  mouths, and no checkpoint stands between them. It is shorter than the way round but its cobbles drag (a new drive
  surface, `cobbles`), and two lemon boost pads with berry arrows lie down it: a racer over them gains on the turn, one
  who misses them loses (measured: a kart round the corner 11.8 s, down the alley over the pads 10.5 s, down it bare
  12.7 s). **Boost pads** are a track feature any drive can read: the drive rule gains an opt-in boost
  (`rules-drive.js`, through the world's `padAt`: a wheel on a pad lights a boost, its top and its pull past the kart's
  own while the throttle is held), the drive surface table carries a track's pads (`roads/surface.js` `padAt`), and a
  page wires the hook only when its track lays pads: a drive on a track without them is as it was.
  Down another straight a toy building spans the street, the way passing under its ground floor (the `toy-tunnel`
  block: two piers, a deck, the building over it, a berry band and a row of balls over each mouth, lamps along its
  ceiling); the page's shadow darkens it. The town gives way to both: its rows stop at the mouths and the underpass, and
  the alley has fronts and a sidewalk down its far side.
- **Built: a mine, a kart race inside a chocolate mountain** ("a kart race through a gem mine", "underground",
  "tunnels", "caves"; the `candy-mine` card's `mine`, `roads/mine.js`). Laid from what mojulo knew of the underground,
  the trail's caves and caverns (`era/cave.js`, `era/cavern.js`), in the track's family. The whole arena is
  underground: the lap runs round the floor of one great cavern (`mine.cavern`). Its outline is a ring round the lap
  as far out as the lap reaches and a margin, its walls lumpy up to a domed ceiling. Stalactites hang from the ceiling,
  stalagmites stand clear of the way, and the floor is the track's own ground repainted in the family's dust. Lantern
  posts lean over the rail down the lap, crystal clusters glow on the floor each in its own colour, and one skylight
  lets the day down a shaft toward the yard. A language may now lay its verge in one of its materials
  (`verge.material`): here the rock's colour, mown. No meadow, farm or lake surrounds it; the page's haze is the
  cave's dark, and the karts are lit dimmer than the open day. Through rock masses on its floor the lap runs into
  galleries bored under the rock, rising toward each gallery's middle and falling to its mouths as a hillside. A gallery is laid only where the way bends gently enough for its walls, never over the
  grid: the longest first, a short one after it. Each mouth is a biscuit-timber portal with a lemon board of gems. Inside:
  - the miners' sets (log posts and a cap with knees, every eight metres), marking the speed
  - lantern pairs over the kerbs
  - berry, lemon and cream gems glowing in the walls
  - a boarded floor past the way
  - a narrow-gauge cart line on the ledge, with carts heaped with gems

  Outside the longest gallery is the yard: a headframe with a berry wheel, carts and a heap of spoil. It is lit as a
  cave is lit. Under the hill a corner sees the day only through the mouths, less the deeper it is, and the lanterns
  lay warm pools in the cave's torch register and falloff, scaled to the bore's width as a big cave's lamps are. A light
  pass after the bake does it (`mineLight`), on the page-lit track and the baked one alike, with the gems and lanterns
  kept as their own light; in the cavern every corner's sky is the cave's dark and the sun reaches only down the
  skylight's shaft, where a kart casts its live shadow. The rail and its posts are the mine's timber. A mine
  has no venue beside it: the land, the set pieces and the trees keep clear of the hill and the yard.
- **Built: items, and the boxes that drop them** (`roads/kart-items.js`, a track's `items`; a kart track from words
  lays them, a level's roadway may say `items`). Rows of mystery boxes across the way on the straights, never on the
  grid. Each is a rounded golden core with a "?" on every face, inside a glassy shell lit at its rim in colours that
  run round it (a fresnel), turning on a tilted axis and bobbing: a thing to drive at. Driving through one takes an
  item if the kart holds none; the box pops and grows back. Three items in the candy family's words:
  - a sugar rush: a boost, the drive rule's own
  - a toffee: dropped behind, it slows and spins the kart that drives over it
  - a gumball: rolled ahead along the track's line, it knocks the first kart it meets

  What a box hands out depends on where the kart stands (catch-up): the race ranks the field by each kart's progress
  round the lap, and the last mostly draws sugar rushes while the leader mostly draws toffee (`catchup: false` draws
  flat). The pilot uses its item on F (or right Shift, or the pad's left face; the pilot scheme's `useItem`, on the pause
  sheet's controls), and rivals use theirs by judgement. The pause sheet lists the key on a race with boxes, and no
  longer lists the thrusters' F in a vehicle, where they never ran. The race HUD's held item is one large slot at the
  top's middle, there all race and in no words: dashed while empty; holding one, the item's pictogram fills it, its
  frame the accent, its key in the corner. The kart's juice pulses while one is held. Run by one step inlined on the page as the boost pads' is
  (`scene/channels/controllable/kart-items-view.js`), emitted only on a track with boxes. The roadway contract carries the rows.
- **Built: a pictogram for each item.** Three join the game UI's icon shelf (`mana-ui/icons.js`): a wrapped sweet with
  a bolt cut through it, a toffee splat with its droplets and shine, a gumball with its shine. The items name them,
  and the item ids alias them. The held-item slot is the pictogram, filling it. mana-ui's `slot` draws its
  pictogram where the theme has one (it drew initials) and takes a `size` (`l`, a slot read at a glance). Candy Kart now draws its
  pictograms in the chunky style, each in the colour of what it means, each readable on the berry plate: the sweet in
  the accent's lemon, the gumball in the second accent's sky (the gumball rolled on the track is sky now too), the
  splat in the cream ink.
- **Built: screen effects on the game UI** (mana-ui's `effect`, a HUD layer): confetti (falling from the top, popped
  from the centre or fired from the bottom), streamers, sparkles, a burst of stars, petals and a flash. Each plays
  once on a new trigger, or holds while it loops. Its pieces come from its own dice, in the theme's colours. It is pure
  CSS and never touches play: it catches no pointer, is laid out alone, moves transform and opacity only, pauses with
  a held clock, and plays only a fade under reduced motion. A race lays confetti on the finish and sparkles on a lap
  better than the best.
- **Spike: boxless UI** (`scripts/spikes/boxless-ui/`, not shipped). The race HUD drawn with its plates stripped and
  the decoration moved onto the letters, in four letter dresses (candy, sticker, chrome, extrude): a fill, rings, an
  extrusion and a drop, as one SVG filter a size. It covers about a third of the screen the boxed HUD does (18.1% to
  5–7% at the busiest moment). The rings scale with the type, or a small number reads as a chip. The README says what
  shipping it would take: a theme word `letters`, `hud: 'bare'` read by mana-ui's regions, the filters laid at mount,
  and a ring-contrast law.
- **The principles a new map starts from** ([docs/track-design-principles.md](../../../../docs/track-design-principles.md))
  and the agent's card for them (`gameworld-track-language`, read by the levels chapter): a premise first, a small
  family, a quiet way, a corner told three times, things seen to move, asymmetry, chunky, the track's own sky.
- **A roadway level's gate says more.** Its laws now carry the language's and the trackscape's beside the track's
  own, for a kart track and a circuit alike.
- **Fixed:** a world made from a track's words lost the track's drawing (its kit carried no pole).

The plan for the rest:

- A track's design language: one card says what a track is made of and how its parts are shaped (the way, the kerb,
  the rail, the post, the span, the sign), so its rails and its furniture are one family. A card a tuning to start:
  a candy one for a kart track, a grand-prix one for a circuit.
- A kart track's default look in the seventh generation: chunky, rounded, smooth polygons lit as the kart is. The
  voxel look stays, by word.
- The forward runner's segment on a track: the screen's thirds, the slice and its rhythm, the three depths, and a law
  for the least a segment must hold to be interesting.
- The race on the game UI: a race HUD (place, laps, times, speed, the track's outline, the start lights), results
  with the field, kart and track picks, and looks made for racing.
- The gate a made racing game is read by says the language's laws and the segment's, for a kart game and a realistic
  one alike.
