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
