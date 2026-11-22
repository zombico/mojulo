### City stalker on the geocity: a superhero's city, swung through in metres

- **The hero swings and climbs a city level.** A hero who starts with the wall climb and the swing line uses them
  on a city district's buildings: hold the swing key in the air to cast a line to a tower's face and swing down the street, press it
  on the ground to zip up to a wall, climb any face to its roof.
- **A swing that looks like one.** A hero on a line now hangs along it the way a trapeze flyer does: arched with
  the legs trailing at the back of the swing, long at the bottom, legs thrown ahead at the front, one arm up the line.
  Let go high and fast and the hero turns a somersault the way the swing was carrying it, tucked through the turn and
  open to land; let go low and it simply rights itself. A hero who starts with the swing line is given these moves
  when it is made; one without the line is unchanged.
- **The line leaves the hand.** A hero's swing line is now drawn from its raised hand, wherever the body is in its
  swing or its turn, where before it left a point above the head.
- **A rest on the wall.** A hero holding still on a wall settles onto it after a moment: feet planted on the wall
  with the knees up, one hand on it above, leaning out, the head turned over the shoulder to look down at the street.
  Moving or jumping ends the rest.
- **The camera no longer dives into a hero on a wall.** When a hero faced a wall it was holding, the chase camera
  could be pushed inside the hero and fill the screen with its back. It now keeps its distance.
- **An elastic swing line.** The line now stretches under the hero's weight at the bottom of a swing and throws
  the hero as it shortens again, so a swing carries more speed than before. Let go while the line is still
  stretched and it flings the hero faster along its way; the low point of the swing is where it is loaded most. A
  line cast low over the street stretches less, so the hero is never dropped onto the road.
- **A heroic way of moving.** A hero's movement can now be described as "heroic": chest up and head steady, a
  long driving stride, the arms pumping, leaning into the run, and the feet landing wide apart with the hips
  square. How wide a hero's feet land is now its own quality of a movement, from narrow to wide, so a run no longer
  has to put one foot in front of the other.
- **A sky for a city level.** A game can say what clouds hang over a city level (clear, fair, overcast, storm,
  haze, high), painted round the sky at the level's hour, so a city at golden hour has lit cloud behind its towers.
- **A wall run.** A hero who meets a wall at speed in the air (off a swing, a leap or a launch) now runs it,
  along the face and up it with the speed it arrived at, where before it stopped dead and clung. Steer with left and
  right, hold forward to stay up; it slows into a cling, runs over the top onto the roof, or jumps off keeping its
  speed along the wall.
- **A point launch.** Press jump while zipping to a building and the hero is carried to the roof's edge and springs
  over it with a somersault, landing on the roof at speed. On a tower too tall to clear, the hero runs up the wall
  from where the zip lands. Tapping the swing key twice in the air zips from mid-air.
- **A dive.** Hold the crouch key in the air and the hero dives head first, falling much harder and faster. Cast a
  line out of a dive and the swing starts with that speed.
- **A camera that feels the speed.** Behind a hero on a swing line the camera now pulls back and widens its view
  as the hero goes faster, and eases back in as it slows, so speed can be seen as well as measured.
- **Wind at speed.** A level with a swinging hero now has a wind that is silent standing still and rises and
  brightens the faster the hero moves, in a swing, a dive or a fall.
- **Either hand.** The swing line now leaves the hand on the side of the building it lands on, and the hands take
  turns when the anchor is straight ahead. A left-hand swing and zip are the mirror of the right.
- **A glide for low ground.** Hold jump while falling and a hero with the swing line spreads out and glides,
  trading height for distance: about five metres forward for each metre down, so 40 m of height carries some 200 m
  over streets with nothing tall enough to swing from. It keeps the speed a swing or launch gave it. Forward dives
  for speed, back flares to slow and float, left and right turn and bank. Casting a line ends the glide into a
  swing with its speed; meeting a wall drops the hero into a wall run or a fall, never a hang.
- **Foes on a city level, in crews.** A city district level can now have foes. They stand on its streets in crews
  of three at spots spread along the street, and each crew fights as one, the way a beat-em-up's crowd does: it
  holds its corner until the hero comes near, rings the hero, then presses in, with only two of the crew attacking
  at a time while the rest keep the ring. The hero always has a moment to act between two attackers' blows.
- **A hero is a kit of parts.** A game's hero can now be described by four choices made apart: how it gets about
  (a line swinger, a leaper, a glider, a flyer, or on foot), how it fights, what it has at range if anything, and
  what its special button does. Swinging is a way of moving, never a way of fighting. Four heroes come ready-made
  (the swinger, the powerhouse, the blaster, the vigilante), and any of them can have one part changed, such as the
  swinger given a heavy hitter's fists.
- **Fighting with one button.** A fighting style is played on a single punch button: press it again as each blow
  lands for the next one, and the last is a finisher. Three styles to start: the brawler (one, two, and a hook that
  floors), the acrobat (four quick blows ending in an uppercut that launches a foe), and the bruiser (two heavy
  blows). Each has its own string in the air. A hero with something at range has one range button for it, and one
  special button is kept for whatever the level asks for where the hero stands.
- **An autoflow on one button.** A fighting style is now a flow of punches and kicks mixed together on the single
  punch button. Press again as each blow lands and the flow plays on to its finisher. What changes the outcome is when
  and how long the button is pressed: pause a breath mid-string and it turns into a different ending; hold the button
  and it becomes a charged heavy blow, from standing, in the middle of a string, or in the air.
- **Kicks.** Heroes can kick: a front kick, a round kick and a knee, thrown from the same guard as the punches so
  they chain with them without a step between.
- **A super on the modifier.** Hold the modifier (left Ctrl, or a pad's right trigger) and punch for the style's
  super, spent from a meter that landed blows fill.
- **The special button finishes a reeling foe.** With a foe in reach staggered or knocked into the air, the special
  button turns the hero to it and lands the style's heaviest blow. With no such foe it is still the level's own
  button for doors, switches and people.
- **Exporting a big level no longer times out.** Exporting a level's page now has the long-render time allowance,
  and a hero's moves build faster because each punch or kick is worked out once and reused.
- The city's crews are people: `CITY_CREWS` in `gameworld/foes.js` is a bestiary a city game takes whole (a street gang's
  bruiser, a crime family's soldier, a private military's rifleman), each made through the hero door in its faction's
  dress on the comic rail and stood on the district in crews. A creature is no longer the stand-in for a city's foe.
- A calm city: a style's `calm: true` draws a metro level lighter (`CITY_CALM` in `gameworld/world.js`: no moving
  traffic, no ambient-occlusion pass, the live shadows at half size; the buildings, parked cars and street kit stay).
  Measured on the district the playable page shows: 5.7 M triangles and 2,400 draws a frame down to 2.2 M and 1,400.
  The occlusion prepass was redrawing the whole district every frame; the foes were not the cost.

#### Started again: Hero City, from Hijack City's map and quests and the beat-em-up's action

- **Hero City, the vigilante rail's starter** (`gameworld/hero-city.js`): a locked pitch on Vigilante Justice now lays a
  superhero's district rather than nothing. It is Hijack City's district and quest spine (a contact's jobs told as
  missions, the journal, the guide's pillar, the phone, the save) with the crime game taken out (no wanted level, police,
  shops or sides) and a hero put in: a kit hero on a line, its jobs the contact's bounties on the street's crews (a
  crew member's fall drops the proof), the last a mastermind who keeps behind the thugs it summons, the beat-em-up
  villain's way of fighting, as the foe shelf's summoner. Drawn calm.
- **The beat-em-up's powers in the open world** (`gameworld/hero-powers.js`): the beam, the ball of force, the barrage
  and the flame, each the street's own card, lowered onto the round runtime's range button. A card's uses are the
  button's magazine, recharged rather than refilled at a fall; its beam names its colour; its joules are its knockback.
  A kit's `ranged` takes a power by name. The arsenal's sidearm takes three new words to carry them: `colour`, `knock`
  and a draw's `splash` (absent, every weapon lowers as before).
- **A hero on foot is guided to its jobs.** A kit hero takes no car: its district's cars stay scenery, and the city's
  guide, which led with "Get into a car", leads straight to the job and teaches the walk alone.
- **One draw a person, faces and all.** A figure with a face used to keep every one of its parts a mesh of its own, about
  sixty, none of them ever culled, so every fighter on a city's street was drawn whole every frame and again into the
  shadow map, on screen or not. Only the part that carries the face's morphs keeps its own mesh now; every other part is
  merged into the one skinned mesh and culled as a whole (`merged-figure.js` `keptPart`). On Hero City's district: 750
  draws to the screen and 487 into the shadow map, down to 293 and 24, the picture the same.
- **The game's interface asks for one frame, not one a view** (mana-ui `kernel.js` `onFrame`): the HUD, the lens, the
  phone, the journal and the map each ran a loop of its own; a page's views now share one, painting in the order they
  were mounted.
- **No blur under a HUD in play** (mana-ui `theme.js`, the glass material): a glass theme's HUD plates blurred the
  world under them again every frame it drew. They keep their glass's three-quarter panel and lose the blur; a window or
  a toast over a held world keeps it.
- **What a city frame costs, measured** (headless Chrome, software GL, counts exact, times not): Hijack City's district
  draws itself twice a frame, once into the contact occlusion's prepass (about 1.2 M triangles) and once to the screen.
  The prepass cannot be trimmed by distance on a city: its triangles are in meshes that span the district. A city in
  play that wants its frame takes `calm`.
