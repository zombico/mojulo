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
- Not yet: urns that pay and fonts that heal in play, fights kept on the world by name and approved, and
  everything below.

What the theme will hold:

- **The room settles the fight.** The practice door's game room reads the hero's kit: a launcher asks for
  headroom, a pack of foes for open floor, a dashing thrust for a run-up, the pistols for a foe out of the blade's
  reach. New room pieces answer them (a place waves come in, a high perch, an urn that breaks and pays, a font
  that heals, a boss's dais), new kinds of fight are composed from them (a duel, a melee, a gallery, a boss
  fight), and the room laws check each. A fight is played there with its waves and its ways sealed, and one the
  creator approves is kept on the world by name.
- **Levels stay the geocube's.** A level's fights are laid by the same rules into a building's rooms (a dungeon,
  sealed at its doorways) and onto a trail's ground, in order, the task said on the HUD, a boss in the goal room.
- **Style.** A meter in play that rewards varied strings, the air and a clean run, and a rank on a level's
  results, its best kept.
- **From a sentence.** A stylish action game asked for in a sentence gets its kit, its set-up and a first level:
  an approach that teaches the string on one foe, then a dungeon that tests it.
- **A bigger dungeon.** A walled-core dungeon's fights grow heavier with depth, and its gates are played.
