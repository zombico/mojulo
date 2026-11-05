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
- **Its levels are laid from its beats** (`gameworld/main-quest-lay.js`). A beat played as a structure is played on the
  level that holds it: a dungeon space's level, the open world's level, an errand giver's, a story moment's. A beat with
  only a goal is laid its own level at a run, composed from its words, named by its goal, and standing the foes it fields.
  It is laid once, into the recipe, and is the creator's from then on (edited in place; the beat finds it by its id). The
  game plays the beats' levels in the quest's order, then the world's others. A planned beat is laid and made nothing:
  the pre-compile check prices it apart (`estimate.planned`). The readout says what each beat is played on, and what
  the next run will lay.
- **The main quest on the time facet** (`cosmos/facets/time.js`). Three settings say a long game's shape, so the sweep
  prices what it still waits on:
  - `arc`: none, acts (built), chapters (partial: a chapter's turn is said, not yet lowered to its world overlay);
  - `periods`: one, new maps (built), the same maps at another period (absent: it waits on eras);
  - `sides`: none, tight, loose, free (partial: the quest records how loose its side quests are; nothing yet places them
    by it).

  A world's main quest sets them in its cube (`gameworld/intent.js` `cubeOfWorld`), so its intent's verdict says what it
  waits on. A long-RPG probe (a hero's main quest told in chapters, the world turned between them, side quests loose on
  a big map) reads blocked on the same maps and gapped on the chapter turns and the side quests. Two new work packages
  price those gaps, `quest-turns` and `side-quests`; on the regenerated hillclimb page, the side quests lift eleven
  swept worlds.
- **The first session's goalposts** (`gameworld/goalposts.js`, the readout's `goalposts` while any is open). A game is
  not done at the end of a session, but a good first session leaves seven things, each read from what the book already
  says:
  1. what game it is (its intent, and its core loop);
  2. how long it is, where it is set and where its story goes (the main quest and the world);
  3. the hero's look and the world's (the cast and the foes when there are any);
  4. how it feels to play, and the hero's powers;
  5. a plan of what to build (the quest's beats, its first buildable, nothing blocking the build);
  6. a plan of the first level (the first beat's level, written or laid, and settled);
  7. the first level made and proved by the machine gate (whether it plays as the game is the creator's, the eyes gate).

  Each is met, partial or open; an open one says what is missing and asks the question only the creator answers. `next`
  is the first not met, with its chapter and the move to make: where this session goes on, and where the next one
  picks up, read from the recipe. The build chapter's view carries them, and the studio card lists them.
- **A first session, measured** (machine gate, real headless Chrome, the default budget). The book was a long RPG: a
  wind-walker, three wind powers, a main quest told in five chapters (the first chapter's beat built, a climb with its
  ladder; the other four planned), intent `long-rpg`, a feel, and its loop written. It took seven `design_game` calls
  and about six minutes:
  - writing the book met five of the seven goalposts;
  - the levels chapter's proof made the first level's three stages ahead of their approvals;
  - the build kept those three stages and made the hero, the systems, the gear and the game;
  - two checking runs walked all three stages, the climb up its ladder among them: three of three proved, and three
    first frames passed;
  - the last readout left nothing open.

  The quest's laws caught a real slip in the book: its mid-stage power was gained in chapter 2 of 5, which is still
  early. The session also found a bug. The first level's goalpost counted only its first stage, so it read met after
  the first check, which had stopped at its budget before the climb was walked. It now counts each stage of the level.
  Whether the level plays as the game is the eyes gate's, and the creator's to say.
