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
  `city.tunnel`). The way divides down its longest straight round an island of shops, on the side away from the town's
  middle, and comes back before the corner; either way is the lap: the branch is drawn in the language and driven as
  road (its points join the drive surface), the rail opens at its two mouths, and no checkpoint stands between them.
  Down another straight a toy building spans the street, the way passing under its ground floor (the `toy-tunnel`
  block: two piers, a deck, the building over it, a berry band and a row of balls over each mouth, lamps along its
  ceiling); the page's shadow darkens it. The town gives way to both: its rows stop at the mouths and the underpass, the
  island has a row of shops facing the way, and the branch has fronts down its far side.
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
