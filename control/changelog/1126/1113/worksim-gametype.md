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
- **The work room** (`gameworld/work-room.js`, the practice door's `work`) tries a shift before its level, the way the
  action rooms try a feel. It stands the line as greybox counters coloured by verb. The hero is the world's own or a
  stand-in (male or female), and its movement is a feel template: the world's own, or the everyday walker (the
  realistic template that runs slowest). Every template and both bodies are offered on its page, and each reopens the
  room. The shift is measured by the work proof at the template's run, and the movement shows: the kitchen at advanced
  serves 13 of 25 at the slowest template's run (its goal 13) and 19 at the fastest; at beginner every template serves
  10 of 11. The room has its own rail icon.
- **The work room is a conceptual space.** The fidelity is in showing the work, not the characters:
  - **The view:** a pale plane ruled every two metres under the ¾ overhead camera, the work flowing up the screen.
  - **The floor is the recipe:** arrows from each crate, shelf and station to where its thing goes next, coloured by
    the work they feed (shovel work warm, bucket work cool).
  - **Pips show the work:** they fill over a station as it is worked, fill again as it runs alone, and go out toward
    the burn. A shelf shows a pip a unit (the mechanic's `show: true`; absent, nothing of it is laid).
  - **The worker is a mascot** of a form chosen on the page (orb, sprout, toon), piloted by its own body.
- **An inline character.** A figure may carry its layered recipe inline (`layered`) instead of a stored ref, a
  mascot's plan or a hero, regenerated on read and held to the same pilot check. Absent, nothing changes.
- **A site, a real climb.** A card may stand its line on a deck: `site: { up, climb? }`, a roof `up` metres high with
  the hand-in on the ground below, joined by the playscape's ladder (a lean ladder, rungs, a rope or a net). The card
  reads the climb's seconds from the ladder object and walks them both ways on every hand-in. The work room builds the
  deck, the ladder (its rails, rungs and climbable surface, climbed by the hero's own rule) and the bin below. The hero
  starts on the roof, and the proof walks the route through the ladder at the climb's own speed. The roof starter is
  4 m up on a lean ladder in place of a fixed 8 s trip. On the page, the hero climbed from the foot to the roof in
  about two seconds, and the advanced roof serves 9, 10 and 11 of 12 bags at three templates' runs.
- **The work proof** (`worksim/work-proof.js`, a machine gate) plays a level on the page's bus as a player who knows
  the card would. The kitchen, the farm and the roof are won near what the simulator serves. The site, a crew's job
  played alone, falls short, and the proof says so. On the exported page in headless Chromium, one whole order was
  played by hand and served. The proof walks a route when one is given (a room's climb), each leg at its own speed.
- **Starter cards** (`scenarios.js`): a sushi counter, a wheat farm, a building site (a spade or an excavator) and
  leaves off a roof (4 m up a lean ladder). The board `scripts/spikes/worksim/solve.mjs` solves each at each preset.
- The gates are machine gates only: whether a shift is fun is for someone playing it to judge. On a level the
  stations are still markers; the work room draws them as counters.
