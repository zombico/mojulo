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
