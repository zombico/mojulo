### Stylish action: fights settled in the room, laid into levels

In progress. Built so far, all in the practice door's game room
([docs/game-room.md](../../../../docs/game-room.md), "A fight"):

- **Built: the brief reads the kit** (`gameroom/needs.js` `kitAsks`). Each move asks something of the place and
  says why: a ring, headroom, a run-up, a perch, a gap, the lock. A kit without the move asks nothing.
- **Built: a fight composed** (`gameroom/fight.js`), in four kinds (a duel, a melee, a gallery, a boss fight), from
  new room pieces (a rift, a perch, an urn, a font, a dais), with its ways, rifts and ring named, and held to its
  own laws beside the room's (ring, headroom, run-up, seen, lock, put-back, asked).
- **Built: a fight played.** The room's menu has a Fight choice (`&fight=<kind>`, `&seed=<n>`). Waves are written
  by role or by a foe's id; the foes stand asleep at the rifts, on the perches and on the dais; the hero is armed
  with the kit. The fight begins when the hero steps into the ring, every way is sealed until the last wave is
  down, and a death begins it again.
- **The wave gauntlet takes two more settings**, each adding nothing where it is not said: an arena that waits to
  be walked into (`enter`) and other ways sealed beside the way out (`seals`).
- **Measured:** the scripted floor player wins a duel, a melee and a boss fight on the stand-in bestiary; one who
  does nothing wins none. It does not win the gallery (it has no answer to a shooter on a perch). Nobody has played
  them yet.
- **Built: a game's own fights.** `fights: { <name>: { kind, seed?, waves? } }` keeps a fight on the world by name;
  the room plays it by that name, and `design_game` says what is kept, the laws each loses and whether together
  they answer everything the kit asks. A world that keeps none is offered one of each kind, never laid unasked.
- **Built: the loadout's first part** (`gameworld/carried.js`). `loadout: { slots?: { melee }, start?: { melee,
  sidearm } }` says what the hero carries of the game's weapons: two melee weapons at once unsaid, in the order
  the weapon switch steps through them, and the sidearm or none. It is laid on every level's hero and in the game
  room's fights. A world that writes none carries its whole kit, as before. Choosing it at points in the game is
  not built yet.
- **Built: the switch cancel.** An arsenal says `switch: 'cancel'` (the stylish kit does): the weapon switch
  pressed mid-swing is held to the move's switch point (its cancel, or the end of its blow for a move with none, a
  finisher), the rest of the move is cut with no rest and no cooldown, the next weapon is in hand, a press that was
  waiting opens its string at once, and the string's count carries on. One weapon's string chains into the
  other's. An arsenal that does not say it switches between moves only, as before. Every page that embeds the
  runtime is re-pinned for the lines this adds.
- **Fixed: a swing trail from a weapon that is put away.** A hero that switches to the fist keeps its other figure,
  blade in hand, animated out of sight, and that hidden blade still left its trail. A body that is not drawn leaves
  none now. Every page that carries swing trails has that one line more.
- **Built: a building to fight through** (`era/programs.js` `citadel`). A pathed plan of four rooms in a chain, each
  sized for a fight of a kind as the stylish kit asks it: a gate court (a duel's), the great hall (a melee's), the
  long gallery (a gallery's), the sanctum (a boss fight's), with the route through its doorways. A new law, `fits`,
  says whether any room a level gives holds a fight (its ring, the way round it, the headroom a launch asks). It
  is built on the seventh-generation basis: the ashlar kit (`gothic-ashlar`), read in `gen-7`.
- **Built: a level's tasks** (`gameworld/tasks.js`). A building level says its fights in order,
  `goal: { tasks: [{ fight, at }] }`, each a fight the world keeps, laid in a room: composed on the square the room
  holds, turned to the doorway the hero comes in by, its pieces standing as the stage's props (new pieces: a pillar,
  a perch, an urn, a font, a dais), its foes asleep until their wave. A fight begins when the hero steps into its
  ring and seals its own room's doorways until its last wave is down; a death begins that fight again at its
  doorway; the last one down ends the level. The wave gauntlet takes an arena's own `seals` and `start` for it, and
  arms the next entered arena at the clear.
- **Built: the action game's first level** (`gameworld/action-first-level.js`): the citadel with a duel, a melee, a
  gallery fight and a boss, against zombies and armed skeletons (the slow dead, the armed skeleton, the archer, the
  armoured dead, the knight).
- **Measured:** the scripted floor player walks the citadel's rooms in order and wins all four fights; one who does
  nothing wins nothing. The scripted player now walks a level that ends on its fights point by point. Nobody has
  played it. Not yet: the task said on the HUD.
- **Made through `design_game`:** the first level as a whole game, Fallen Angel, with made figures: Lucien on the
  realistic body (long dark hair, a long dark coat), the five undead, the citadel, the game; the recipe and how
  to rebuild it are in [docs/examples/fallen-angel](../../../../docs/examples/fallen-angel/README.md). The door's
  own check played it: the floor player won, one who does nothing did not.
- **Built: a fourth sword art, `wild`** (`polygonizer/hero-swing-body.js`): a brawler with a blade. The anime
  sword's reach with none of its composure: the hips spun until the back is to the target, the weight and the off
  arm thrown furthest, a taller, looser, longer stance, the anticipation and the finish held least, the cut
  fastest. Held to the laws every art keeps (the legs reach, the blade clear of the head and the floor). Lucien's
  kit is Fallen Angel's swung in it.
- **Fallen Angel in the seventh generation:** its citadel is dressed by a gothic night cube read in `gen-7` on the
  ashlar bones, and Lucien's coat is pale so he reads against the dark.
- **Built: the style meter's runtime** (`worlds/controllable/style.js`, a game's `styleMeter`). How well the hero
  fights, read off the world each step: it rises on blows landed, more for a move not just used, a blow in the
  air, a launch, a switch mid-string, a parry and a foe felled; it falls with time once nothing lands and drops a
  whole tier on a hit taken. Tiers are letters (D to S) unless the game says its own words. `styleMeter: 'auto'`
  lays it on a game whose feel is the stylish template; a game that writes none carries none, and its pages keep
  every byte. The page says where it stands (`window.__mojStyle`), and the scripted player's readout says the tier
  it peaked at and its longest combo. Not yet: the meter on the HUD, and the rank on a level's results.
- **A building level has its action hero.** A world played under the orbit camera with a hero that strikes now
  gets, in a building as on a trail, the orbit that locks on, movement in the camera's frame and its sheathed
  twin, so the fist is in its hands and the weapon switch has two weapons to switch between. Before, a building
  level's hero carried the blade alone.
- A prop's surface a kit does not carry is painted in the kit's nearest of its own (a pillar in a gothic hall is its
  pilasters' stone); a kit that carries the surface reads as it did.
- Not yet: urns that pay and fonts that heal in play, a fight approved on its own or edited piece by piece, and
  everything below.

What the theme will hold:

- **The room settles the fight.** The practice door's game room reads the hero's kit: a launcher asks for
  headroom, a pack of foes for open floor, a dashing thrust for a run-up, the pistols for a foe out of the blade's
  reach. New room pieces answer them (a place waves come in, a high perch, an urn that breaks and pays, a font
  that heals, a boss's dais), new kinds of fight are composed from them (a duel, a melee, a gallery, a boss
  fight), and the room laws check each. A fight is played there with its waves and its ways sealed, and one the
  creator approves is kept on the world by name.
- **The loadout.** What the hero carries is chosen from the game's weapons: melee weapons switched in play, a
  switch chaining one weapon's string into the other's, the choice made at points in the game (before a level, at a
  rest between fights, when a weapon is earned).
- **Levels stay the geocube's.** A level's fights are laid by the same rules into a building's rooms (a dungeon,
  sealed at its doorways) and onto a trail's ground, in order, the task said on the HUD, a boss in the goal room.
- **Style.** A meter in play that rewards varied strings, the air and a clean run, and a rank on a level's
  results, its best kept.
- **From a sentence.** A stylish action game asked for in a sentence gets its kit, its set-up and a first level:
  an approach that teaches the string on one foe, then a dungeon that tests it.
- **A bigger dungeon.** A walled-core dungeon's fights grow heavier with depth, and its gates are played.
