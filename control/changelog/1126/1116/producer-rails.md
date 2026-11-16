### The producer's rails: the size and the template picked before anything is built

In progress. Each line is added as its phase lands.

- **The rail roster** (`gameworld/rails.js`): one row per game type mojulo builds, under the name the producer says:
  the house titles (Fallen Angel, Fable of Artesia, Jumping Giuseppe, Steel Serpents, Mech Battle Kai, Mojulo Fighter
  and the rest of the feel templates) and the types that have no title yet (racing, sports, the board game simulator,
  the work sim, farming, tower defense, strategy, rhythm, puzzle, flight, the table RPG). A rail is a template, never the game: a
  person's game starts from it and is theirs. A row names into the tables that measure it (its feel template, the genre
  cubes it starts a designed game from, its quick goals, its pixelizer games) and copies no number; it says how much of
  mojulo makes it (a pixelizer game, a quick game, a table game, a designed game: `SIZES`, least first), what its first
  level is, and what it lacks. `railShape` is the producer's one line a rail; `seenOf`, `railWords` and `railLacks`
  read the rest from the tables. `NOT_YET` names what is built apart and makes no game yet (the side-scroll
  beat-em-up, the shared kitchen), with what each waits on.
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

No readout, routing card or listed card changes yet: the producer's own card and the start readout take these next.
