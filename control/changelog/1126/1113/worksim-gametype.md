### Shovels & Buckets: a work-sim primitive, its difficulty solver, and a shift to play

A primitive for work sims (cooking, farming, construction, chores). Each card's labour is shovel work or bucket work:

- **Shovel work** is active processing. The hands are on it, it may then run alone, and it burns if left.
- **Bucket work** is sorting, to storage or to the next step: fetch, collect, combine, shelve, carry, serve.

A solver tunes a card to a challenge, and the `work` mechanic plays it on a level. Design notes:
[docs/worksim.md](../../../../docs/worksim.md).

- **The card** (`lib/graph/worksim/card.js`) is stations, a crew and a demand, in seconds of play. Its difficulty
  levers are capacity (workers, slots, storage), output (batch, work) and demand (pace, patience, mix, rushes, a
  chore's backlog), and nothing else. Several stations may give one item, its routes (a hoe or a leveller): the
  cheapest is preferred, and the crew takes another when that one is busy. A malformed card is taught, never guessed.
- **The closed form** (`analyze.js`) reads the card as a network of queues: each order's labour as shovel, bucket and
  travel, the loads, the bottleneck, the critical path and each route's labour a unit.
- **The simulator** (`sim.js`) plays a seeded session:
  - The crew rescues, then hands in, then collects, then runs: what runs alone first, then the step nearest an order.
  - Stock is allotted by due time.
  - The crew's foresight is the player the session is measured against.
  - Its orders are rolled once (`arrivalsOf`), and the page plays the same list.
- **The solver** (`solve.js`) has three presets:
  - beginner, measured against a newcomer;
  - intermediate;
  - advanced, measured against an expert.

  A challenge number from 0 to 1 sits between them. The solver bisects pace and patience for its bands, adds a slot
  where a station is full, and records every move with its family and reason. When the bands cannot all be met, it
  returns the closest result and says so.
- **The `work` mechanic** (`lib/graph/game/work-mechanics.js`, a terminal) lowers a card onto the bus's verbs alone.
  Crates are taken with E. A station is worked by standing at it, and its progress is kept when the worker walks off.
  What runs alone burns past its hold. Shelves have a put pad and a take pad. Orders take a ticket at a hand-in, and
  one press serves one order. At the bell, the goal (four fifths of what one player who knows the card serves) wins
  or loses it. It has a mechanic card, sounds for each event, and a date in the cosmos registry
  (`power.mechanics=work`).
- **The quick door:** `design_game({ quick: { goal: 'work', card?, challenge?, serve? } })` tunes the card for one
  player, lays the line on flat ground beside the trail, and makes the game.
- **The work proof** (`worksim/work-proof.js`, a machine gate) plays a level on the page's bus as a player who knows
  the card would. The kitchen, the farm and the roof are won near what the simulator serves. The site, a crew's job
  played alone, falls short, and the proof says so. On the exported page in headless Chromium, one whole order was
  played by hand and served.
- **Starter cards** (`scenarios.js`): a sushi counter, a wheat farm, a building site (a spade or an excavator) and
  leaves off a roof. The board `scripts/spikes/worksim/solve.mjs` solves each at each preset.
- The gates are machine gates only: whether a shift is fun is for someone playing it to judge. The stations are
  greybox markers.
