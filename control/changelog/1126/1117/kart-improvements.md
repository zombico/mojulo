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
