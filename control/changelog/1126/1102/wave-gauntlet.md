### Wave Gauntlet: sealed in until nothing is left alive

The action game's held room: sealed in an arena until every foe of every wave is down, each wave coming when the last is
cleared, arenas one after another (N arenas × N waves). Static (the elevator fight, the arena lock, a Bloody Palace of a
hundred floors) or moving (a lockdown along the way). Named `wave-gauntlet`, its rooms `arenas`, apart from the gauntlet
that is a glove. Built so far:

- **The mechanic** `wave-gauntlet` (`game/wave-gauntlet.js`, its card), a terminal on the bus `waves` already uses (foes
  minted dormant, woken by the cast's spawn; a count of downs a wave and a watch on it; a sequence for each pause), no
  runtime of its own: `arenas: [{ waves: [{ foes, after? }] }]`, each wave woken only when the last is all down, arena
  after arena ("Arena a of A · Wave w of W"); the way out (`at`) sealed until the last wave is down, a walker turned
  away put `back`; without a way out, the clear wins at once (the elevator). Death (the gauntlet owns the player's `hp`,
  `hits` a hit) begins the arena again (its foes put away, its counts zeroed, hp full, the walker at `start`), or from
  the last `checkpoint` (every N arenas); `death: 'fail'` loses instead. Sounds and an engine sample.
- **A level goal** `goal: { gauntlet: { arenas: [{ waves: [{ <bestiary id>: <count> }], after? }], checkpoint? } }`
  (`gameworld/gauntlet.js`, `gameworld/gauntlet-cast.js`): the level's last stage an arena on the approach to its exit,
  the exit its sealed way out, in place of reach-exit. Its foes are the bestiary's, stood asleep in a ring round the arena
  (`foe-<id>-g<n>`, each as every hostile is: its class, figure and hp) and woken with their wave; they are fielded, so a
  run makes their figures. Refused beside a boss or health (the gauntlet owns the hero's hp and ends the level), and on a
  building (its arena is to come).
- **Laws, book and words**: its principles measured on the recipe, advice in `design_game`'s readout
  (`advice.gauntlet`, each named by its level): `escalates` (no wave lighter than the last in its arena, no arena
  lighter than the last), `breathes` (a pause before each arena after the first), `varied` (no three arenas in a row
  alike), `checkpointed` (more than ten arenas, a checkpoint). The book's wave gauntlets section
  (`gameworld/gauntlet-page.js`) draws each as its grid, arenas by waves, each cell its mix, the checkpoints marked, its
  laws beside. The foes card names the goal. A prompt's `horde` or `onslaught` holds the last level a boss does not end
  in a default gauntlet of two arenas (its last stage a trail, no health beside it); `gauntlet` and `waves` are not read
  from a prompt (a glove, a tower defence).
- **Proved** (machine gates, standing in for eyes): after a run, `design_game`'s readout carries `gauntlet_proof`
  (`gameworld/gauntlet-proof.js`): each gauntlet played on the bus on the level the run made, every foe given its fall
  as it wakes (said as assumed: the proof cannot fight). And in an exported page: a `design_game` world of one level, two
  arenas, three waves (2 walkers; 2 walkers and a charger; 2 walkers and 2 chargers), exported by `export_game` and
  played headless through its shell: the way out tried first was sealed and turned the walker back to the arena; each
  wave woke its own foes and no others until the cast's own kill downed them; after the ninth fall the seal lifted, the
  way out won (`success`) and the shell showed it cleared.
