### Game audio: the sound sheet on every level, and a score by request

- **A game on the sound sheet hears it on every level** (`gameworld/sound-sheet.js` `levelSheet`, `onSheet`). A game
  that writes a `sound` of its own, even an empty one, now gets the sheet's sounds and its stage's bed on every level
  it builds: the designed game's levels and a world walked before its people, which were built with no audio at all,
  as well as a quick game's. A quick game that names another `sfx` keeps that. A stage that wrote its own soundtrack,
  `sfx` or bed keeps each. A game with no `sound` builds the levels it built.
- **The whole arsenal on the sheet.** A game with an arsenal (its own, or its feel's kit) hears every weapon on its
  levels, not its first: each weapon's swing and blow by the move's weight, the guard's block, parry and break, the
  bow, the weapon cycle, a foe's swing and fall, a blow taken. The words are the practice room's (one table,
  `MOVE_SOUND_WORDS`, read by both), and a weapon is read by its words where the shelf has its own. A game overrides a
  weapon with `sound.weapons` and an event with `sound.moves`. A game with no arsenal keeps its two slots.
- **Guns by cartridge.** On a sheet game's shooter levels (the shoot and deathmatch goals), each gun the player
  carries sounds as what it is, by the firing range's procedure: its shot by its cartridge, its reload over its own
  reload time, a round landing, the draw. A game overrides a gun with `sound.guns`. Not on the sheet yet: a
  dogfight's craft, guns picked up off the floor, the bots' guns, and a rocket's blast.
- **Foes sound on what they do.** Each foe of a sheet game's bestiary sounds on its attack, on a blow taken and as
  it falls, placed where it stands: a beast in its species' voice (a big cat grunts when struck), a foe drawn as a
  person with a shout, a grunt and a cry. A pack's attacks are held apart. A game overrides a foe with `sound.foes`;
  a foe with no voice of its own is listed as owed. Before this a foe's voice played only when it spotted the hero.
- **A ride's engine.** A sheet game's driven level hears its vehicle: a held voice of the shelf by what is ridden,
  following the ride's speed from an idle up to its top (a level's new `audio.engine`, and the page's engine
  channel). `sound.ride` names another held voice, or `false`. A transformer's forms are not on the sheet yet.
- **The sound book** (`/bible?book=sound`, `gameworld/sound-book.js`). A game's sound sheet as a page: every sound
  it plays, the shelf word and why, each with a button that plays it on the game's own kernel; the beds by level
  and what is owed. A game on no sheet sees the sheet it would have.
- **The music department and the audio direction** (`gameworld/audio-direction.js`; the book's new `music`
  department, its chapters `audio-direction` and `score`; the recipe's new `music` key). The direction is the
  game's taste in sound, what the art direction is to the picture: `music.direction: { style?, identity?, cast?,
  sfx?, space?, ui? }`, solved from the game's words where it writes none (the orchestra unless they say
  electronic). Play keeps the SFX and reads it: the sound sheet speaks the direction's `sfx` where `sound.style`
  says none, and each level of a game with a `music` is heard in a space (the direction's, else its place: a cave a
  cavern). Taste is advice: the department says where the sheet sits badly with the score (the sound book shows
  it) and changes nothing. A game with no `music` builds what it built.
- **Fixed: a composed game's ground and bed.** A composed game's stages carry no stage kit (the world's style
  holds it), so the sheet gave a forest stone footsteps and no bed. A level's place is now read from the world's
  kit and weather, the level's climate and its look's title: grass in a grove, sand in a desert, snow in the alps,
  the night or the wood as its bed.
- **Fixed: a game's `sound` reached no level.** The world reader checked `sound` and did not carry it, so a quick
  game on the sheet played the solved sheet and ignored the game's own style, slots and cues.
- Planned, not built yet: the ground changing within a level; the music department's score, a cue sheet that answers each
  department's request for music (the flow's screens, the levels, the fights, the cinematics, the outcomes) on the
  game's one score identity; a title theme (the menu and the credits the same tune at another energy) and a cue
  that ends, written to a cinematic's length.
