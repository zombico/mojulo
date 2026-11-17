### The producer's rails: the size and the template picked before anything is built


- **The rail roster** (`gameworld/rails.js`): one row per game type mojulo builds, under the name the producer says:
  the house titles (Fallen Angel, Fable of Artesia, Jumping Giuseppe, Steel Serpents, Mech Battle Kai, Mojulo Fighter
  and the rest of the feel templates) and the types that have no title yet (racing, sports, the board game simulator,
  the side-scroll beat-em-up, the run and gun, the work sim, farming, tower defense, strategy, rhythm, puzzle, flight,
  the table RPG). A rail is a template, never the game: a
  person's game starts from it and is theirs. A row names into the tables that measure it (its feel template, the genre
  cubes it starts a designed game from, its quick goals, its pixelizer games) and copies no number; it says how much of
  mojulo makes it (a pixelizer game, a quick game, a table game, a designed game: `SIZES`, least first), what its first
  level is, and what it lacks. `railShape` is the producer's one line a rail; `seenOf`, `railWords` and `railLacks`
  read the rest from the tables. `NOT_YET` names what is built apart and makes no game yet (the shared kitchen),
  with what it waits on. The side-scroll beat-em-up and the run and gun are rails: they were listed as not yet until
  the street genres were made from a sentence, and the roster's guard failed until each had its row.
- **Held to what is built** (`rails.test.js`): every feel template, quick goal and pixelizer game belongs to a row, a
  row's sizes are what the tables say (a designed size only where the book lays one of its genres today), and a type
  listed as not yet fails the day it can be made, so it moves. A new game type is a row first.
- **The size call** (`sizeCall(rail, wants)`): how much of mojulo an ask needs, the producer's first decision. From a
  rail and what the agent infers the person wants (`levels`, what is theirs to design: `OWN`, `simple`), it calls the
  least size that answers it, with that door and the rail's keys for it (its quick goals, its pixelizer games, the
  genres a designed game starts from), why, and the next size up the rail reaches. A designed game is the only size
  the Game Brief is asked for (`brief`). It never refuses: an ask for more than a rail reaches (a fighting game of
  many levels) is called at the rail's largest, and what the larger one waits on is said (`short`), before anything is
  built. With no rail it calls quick or designed by the wants alone.
- **The two depths** (`railShapes`, `railSheet`). The shape is a line a rail and a line a type not made yet: the whole
  of what the producer holds before an ask. A rail's sheet is pulled once it is picked: its sizes with their doors and
  keys, its four tunings read from its tables (level: the cube's space; action: its feel template and the cube's
  power; character: the cube's soul; world: the cube's reality), what the cube asks of a world, the Game Brief's
  labours that suit it, the chain of tools that builds it at each size with the card to pull at each step, and what it
  does not do yet. Nothing is copied: a sheet is a fresh read of the tables.
- **Two cards served by id** from `get_game_vocab` (not listed): `gameworld-rails`, the shape and the size call's
  rule, and `gameworld-rail-<id>`, one rail's sheet. Both generated from the roster; both the intent chapter's.
- **One reader of a brief's words** (`nearestRails(text)`): the rails whose words the text uses, most first, over a
  rail's own words, its feel template's and its genres'. A heuristic, said to be one: the agent picks or asks.
  `notYetFor(text)` names a type not made yet that the text asks for, so it is said before anything is built.
- **A rail may be seen more than one way** (`seenOf` is a list, the template's way first, then its cubes'). More than
  one is a choice the producer asks (side-on, or in the round?), so a template and its cube never disagree unsaid.
  A rail's first genre is its OWN cube, what the template is: its tunings are read from it, built or not, and the
  sheet says what of it is not built yet (`gaps`) and the cube a designed game starts from today (`starts`). Steel
  Serpents' own cube is `tactical-espionage` (seen from above, as its template is; a designed game starts from
  `stealth` today). Fallen Angel is stylish action and no longer claims the arena brawler's words.
- **The pitch** (a gameworld's `rail`, the intent chapter's): `{ from, size?, departs?, locked? }`. The template the
  person's game starts from, the size the producer called, where their game leaves the template (a line a tuning:
  level, action, character, world) and whether the structure is agreed. A record, never a page: it lays nothing on a
  level, and a world without one is unchanged. `design_game`'s readout says it back (`rail`): the template, what the
  game keeps of it and where it departs, the cube it starts from, what its own cube lacks, its sheet's card. It never
  refuses: a size the rail does not reach is said (`short`), and a locked pitch moved to another rail is a re-plan,
  said to the creator (`replanned`).
- **Nothing is asked twice** (`goalposts.js`). A picked rail makes "what game it is" partial and its question "where
  does their game leave the template?"; its move is the cube the rail starts from, and the play goalpost's move the
  rail's feel. A written Game Brief has decided the stakes and the structure, so the shape goalpost says what it
  decided and asks only its length and whether its spine reads right. The start readout (a book with no level yet)
  says the pitch back with its rail's sheet to pull.
- **Steel Serpents is seen in the third person.** A rail row may say how it is seen outright (`seen`) where its
  tables' cameras are not the game's (its template's lab view is from overhead); its own cube is `stealth`, which the
  book lays today, with `tactical-espionage` beside it.
- **A locked pitch is kept** (`gameworld/pitch-start.js`). A gameworld begins with its first level, so a pitch the
  person agreed to used to live only in the session that made it. `design_game({ world: { rail: { from, locked: true },
  … } })` on a book with no level now lays the rail's STARTER first level under what the creator wrote (every key of
  theirs wins) and stores it, saying so (`pitch: { stored, by, levels, says }`): the platformer's own first level and
  the flow that plays it for a platformer's rail, else one level of the genre the rail starts from, read by the
  sentence door's composer without its review, mode or brief. Nothing is built. Only the lock asks for it; a rail
  with no starter yet, or a pitch of a smaller size, is answered and said (`pitch: { stored: false, why }`).
- **The producer leads the readout** (`goalposts.js` `producerSteps`, `producerSays`). The client talks to the
  producer: a book with no level is answered with the producer's steps before the goalposts, each with the ONE
  question it asks: `intake` (what was brought), `rail` (what kind of game and how big, with the templates the book's
  own words point at and any type not made yet), `lock` (the pitch said back: is this the game?), and for a designed
  game `brief`. The readout's `producer` says the seat and the one question this turn asks; the rest of `next` waits.
  A stored game with a pitch carries its `lock` and `brief` steps ahead of its goalpost and the same `producer` word.
  A stored game with no pitch reads as it always did.
- **The hand-off** (`gameworld/hand-off.js`): where the producer's work ends and the director's begins. Once the pitch
  is locked and a designed game's brief is written, the readout offers `next: hand-off`: the chain's first unit as a
  req the ledger takes, ready to raise. Its unit is the main quest's first built beat, else the world's first level;
  its remit is filled from what the producer settled: the template it starts from and that the game is theirs, what
  it keeps and where it departs, and for a level with no quest behind it its place (the game's start, early), what it
  shows (the rail's first level) and the brief's first order. It proposes and raises nothing: the agent raises it
  with its own ticket (`ask: { intent }`), and the ledger runs as it always has (what the unit reads and has not
  settled is asked for first). It leads ahead of a goalpost, and is gone once the ledger holds a level.
- **The producer's card, rewritten around its loop** (`gameworld-producer`): the seat that faces the creator, one
  agent in both seats (as producer it asks and shapes, as director it builds), one question a turn. Five steps, each
  the readout's own step: hear (the intake, its rows the table's), place (the rail, a template never the game, and
  the size called), lock (the pitch said back; a lock on a book with no level stores it on the rail's starter), deepen
  (the rail's sheet and the Game Brief, a real plan recommended only here) and hand off (the first level's req, raised
  as the director). Its intake example now patches with the door's own op, `set` (it said `add`, which the door
  refuses). The studio card's seats line says the same.
- **Said where an agent first meets a game.** The `initialize` preamble: for a game of their own the agent is its
  producer first (a one-level game asked for outright is still made at once),
  `design_game({ world: { name } })` builds nothing and answers the one question to ask, the game is placed on a rail
  (a template their game starts from) and its size called. The `game-design` routing card points at `producer.ask`
  and the `gameworld-rails` card, inside its byte ceiling.
- **Docs**: `docs/zero-to-level-one.md` says the producer's steps as the path's first step; `CLAUDE.md` says the
  rails and the producer's loop and points at their modules.
