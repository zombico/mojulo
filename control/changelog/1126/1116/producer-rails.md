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

Nothing reads the roster yet: no door, card or readout changes with this step.
