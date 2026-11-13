### Shovels & Buckets: a work-sim primitive and its difficulty solver (spike)

A spike for work sims (cooking, farming, construction, chores). Each card's labour is shovel work (active processing:
the hands are on it, and it may then run alone and burn if left) or bucket work (sorting to storage or to the next
step: fetch, collect, combine, carry, serve). It is pure and seeded, is not on any door or in the cosmos registry, and
nothing plays it yet. Design notes: [docs/worksim.md](../../../../docs/worksim.md).

- **The card** (`lib/graph/worksim/card.js`) is stations, a crew and a demand, in seconds of play. Its difficulty
  levers are capacity (workers, slots, storage), output (batch, work) and demand (pace, patience, mix, rushes, a
  chore's backlog), and nothing else. A malformed card is taught, never guessed.
- **The closed form** (`analyze.js`) reads the card as a network of queues. It gives each order's labour split into
  shovel, bucket and travel, the crew's and each station's load, the bottleneck, and the critical path.
- **The simulator** (`sim.js`) plays a seeded session with a competent crew:
  - it rescues what is about to burn first, then hands in the order due soonest, then collects, then runs the longest
    chain first;
  - it allots stock by due time;
  - its foresight is the player it is measured against.

  It measures pressure, orders lost, slack, juggle (stations running alone at once), and what burned or spoiled.
- **The solver** (`solve.js`) tunes a card to one of three presets (beginner, intermediate, advanced) or to a
  challenge from 0 to 1 between them. It bisects pace for the pressure band and patience for the loss band, adds a
  slot where a station is full, and gives a chore a better tool. Each move is recorded with its family and reason,
  and when the bands cannot all be met it returns the closest result and says so.
- **Starter cards** (`scenarios.js`): a sushi counter, a wheat farm, a building site and leaves off a roof. The board
  `scripts/spikes/worksim/solve.mjs` solves each at each preset.
- Machine gate only: the solver measures challenge, and whether that challenge is fun is for someone playing it to
  judge.
