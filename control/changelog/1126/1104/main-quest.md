### The main quest: a game's beginning, middle and end, its core loop, and the first session's goalposts

A long game had no spine. The game book could make every stretch of one: a walled-core dungeon, a quest open world's
regions, errands, wave gauntlets, a tactics book's epochs, the story's moments, quests. Nothing said how the stretches
add up to a game, how long it is, or what comes first. The main quest is that spine. It is not a game type: its outcome
is the flow and the sequence, and the levels and maps are laid from it.

- **The main quest** (a gameworld's `mainQuest`, `gameworld/main-quest.js`). Its acts, each a beat at a time, and each
  beat what it is played as: a level, a walled-core dungeon's space, a quest open world's quest, a gauntlet, an errand,
  an epoch, or a story moment. A beat may be planned and not built yet (`built: false`). The quest also takes its
  length, the periods it spans and how loose its side quests are, and an ending if it has one; a quest still being built
  may have none.
- **Acts or chapters: two progressions.** A quest is shaped as acts, the arc (a beginning, a middle and an end), or as
  chapters, a long game told chapter on chapter that runs past an arc. Each chapter turns the world: its `turn` is what
  a happening changes, carried on (the time facet's chapter overlay), or a new period. Every law holds both shapes to
  the same progression. A chaptered quest is also held to its own two laws: more than three chapters (three or fewer
  read as an arc, and acts tell it), and each chapter after the first turning something.
- **Its laws map it into the book** (advice, never refusing): a beginning, a middle and an end; every power the hero's
  actions name gained on a beat, in the act its progression stage puts it (early, mid, late); foes that rise in rank act
  on act; acts that vary; a first beat that can be built now; a period past the first drawn as the time facet can draw
  it.
- **The core loop** (a gameworld's `loop`, the intent chapter's): what the player does from moment to moment, what an
  encounter is made of, what it rewards, and what one sitting of play is. Written, or read from the book (the hero's
  verbs, the levels' goals, the beats' gains), and held to what the hero can do.
