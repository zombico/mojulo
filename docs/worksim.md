# Shovels & Buckets: the work-sim primitive

Status: spike, now playable. The card, the closed form, the simulator and the solver live in
`control/lib/graph/worksim/`. The runtime is the `work` mechanic (`control/lib/graph/game/work-mechanics.js`), and the
quick door is `design_game({ quick: { goal: 'work', card?, challenge?, serve? } })`. The machine gate is the work proof
(`worksim/work-proof.js`). Nobody has played a shift yet, so the eyes gate has not run.

## The paradigm

Work here means output-driven work: something is made to an intent. A work sim (a kitchen, a farm, a building site, a
chore) is stations that turn things into other things, a crew that works them, and a demand that asks for what comes
out. Marketing and logistics are left out. Each abstracts to its own shovels and buckets, but neither carries the
intent of production that these two verbs do.

Every second of labour is one of two kinds:

- **Shovel: active processing.** A worker's hands are on it for its `work` (chop the fish, plough the field, dig the
  trench, rake the roof). A shovel may then **run alone** for a `wait` (the pot cooks, the crop grows, the concrete
  mixes) while the hands are free, and its output keeps on the station for a `hold` before it burns, rots or sets.
- **Bucket: passive sorting, to storage or to the next step.** Short, attention-light handling: fetching from a crate,
  collecting what ran alone, combining (plating, bagging, pouring), shelving, carrying and serving.

Several consequences fall out of the model:

1. **Collecting what ran alone is always bucket work.** Harvesting is the bucket half of the tractor's shovel, and
   taking the rice off the hob is the bucket half of cooking it.
2. **The shovel needs two states: attended and unattended.** Juggling the unattended shovels against an attended one is
   where a kitchen's tension comes from. The simulator measures this as `juggle`.
3. **Travel is a third cost** that the two verbs hide. In the starter cards it is a third to a half of all labour, and
   in a chore it dominates. On a level, travel is the walk, so the layout is a lever.
4. **Storage is a bucket.** The runtime made this concrete. A worker whose hands are full can neither take the rice
   off nor fetch the next thing. A shelf, where something can be put down and taken up again, is what keeps the line
   moving.

## The puzzle is never one solution

The environment lays out situations in which solutions are found. On the card this takes two forms:

- **Routes.** Several stations may give the same item: land is graded with a hoe or a leveller, a trench dug with a
  spade or an excavator. The preferred route is the one whose unit costs the least labour. The crew takes another when
  the preferred one is busy or its inputs are not there (`readCard(…).routes` lists each route's labour a unit).
- **A degree of done.** On the page, a station's work is done by standing at it. Walk off and the work waits with its
  progress kept; come back and E resumes it. A job can be left at whatever point suits the worker and the moment.

## Difficulty is three families of levers, measured against a player

| family   | levers (card paths)                                                                |
|----------|------------------------------------------------------------------------------------|
| capacity | `crew.workers`, a station's `slots` (hobs, fields), an item's `store` (the shelf, the silo) |
| output   | a station's `batch` (`gives`: a bigger pot, a wider plough), its `work` (a better tool) |
| demand   | `demand.every`, `demand.patience`, the order mix, `demand.rush`, a chore's `demand.backlog` |

Nothing else tunes it (`LEVERS` in `card.js`). Who plays is not a lever. A target names its **player** as the crew's
`foresight`:

- **0, a newcomer:** answers only orders that are already open.
- **1, an expert:** keeps made ahead what the coming orders will want within each order's critical path. The farmer
  sows before the order, not after.

A reactive crew misreads growth-heavy cards: it stands idle while crops grow and orders pile up.

| preset       | player       | demand                                                       | pressure  | miss  |
|--------------|--------------|--------------------------------------------------------------|-----------|-------|
| beginner     | newcomer (0) | even beat, the simpler half of the mix, 3 × the critical path | 0.45–0.65 | 0–5%  |
| intermediate | 0.5          | random, mild rush (×1.5), all but the hardest order, 2 ×      | 0.65–0.82 | 3–15% |
| advanced     | expert (1)   | random, rush ×2, the whole mix, 1.4 ×                        | 0.82–0.97 | 8–25% |

A challenge number from 0 to 1 interpolates between the presets, the player included.

## The solver

`solve(card, target)` works in three layers:

1. **The closed form** (`analyze.js`) reads the card as a network of queues. It gives labour per order (split into
   shovel, bucket and travel), the crew's and each station's load, the bottleneck and the critical path.
2. **The simulator** (`sim.js`) is the judge. It plays a seeded session in quarter-second ticks. Each idle worker takes
   the first of these, in order:
   1. rescue an output about to burn;
   2. hand in the order due soonest that the shelf can fill (stock is allotted by due time, so a cabin's two frames are
      not taken one at a time by sheds);
   3. collect;
   4. start a run: what runs alone first, then the step nearest an order (bag the piles before raking more), and among
      an item's routes the quickest.
3. **The search** sets the demand's shape, then bisects pace for the pressure band and patience for the miss band. It
   adds a slot where a station is full, or a better tool to a chore's busiest shovel. Each move is recorded with its
   family and reason. When the bands cannot all be met it returns the closest result and says so; it never refuses.

`arrivalsOf(card, seed)` rolls a session's orders once. The simulator and the page play the same list, so the page's
orders are the ones the solver measured.

Board: `node control/scripts/spikes/worksim/solve.mjs [card…] [--challenge 0.7] [--card file.json] [--json]`.

## The runtime: the `work` mechanic

Everything below lowers onto the event bus's existing verbs. There is no runtime code of its own.

| piece     | what the player does                                                                                  |
|-----------|-------------------------------------------------------------------------------------------------------|
| crate     | E takes a raw item into the bag while the hands have room                                             |
| station   | E with its takes in the bag starts it; standing there works it; walking off pauses it; E resumes it. One that runs alone then cooks by itself and burns past its hold, and E takes it off. One with no wait puts its output in the hands, or leaves it on the station when they are full |
| shelf     | every made item a station takes, and every item the card stores: two pads, put down and take          |
| hand-in   | each order holds a ticket for its patience; one press serves one ticket the bag can fill               |
| the bell  | at the session's end: the goal served wins, anything short is lost                                    |

The goal defaults to four fifths of what one player who knows the card serves in the simulator. The HUD shows served
(of the goal), lost, time and hands. Stations are markers coloured by their verb, with markers for busy and ready.
Tickets show at the hand-in, coloured by order.

The quick door (`goal: 'work'`) does three things:

1. tunes the card (a starter or the creator's) for one player at the challenge (beginner by default);
2. lays the line on flat ground beside the trail, turned along it;
3. writes the tuned card into the level's recipe.

### What the proof found

The work proof (`work-proof.js`) plays a level on the bus the way the simulator's crew works: it walks straight
between places, presses E on arriving, and stands at a station while it works. Each starter, played on its own level,
beside the simulator with one crew member:

| card    | the walker on the page's bus | the simulator, one hand |
|---------|------------------------------|-------------------------|
| kitchen | won, 12 of 12 served         | 12 served               |
| farm    | won, 10 of 12                | 12                      |
| roof    | won, 11 of 13                | 10                      |
| site    | lost, 2 of 6                 | 4                       |

The site is a crew's job, and one person falls short of it. A shift made by the quick door (the kitchen at beginner)
was won by the walker with 10 of 11 served. On the exported page in headless Chromium, one whole order was played by
hand: rice in the pot, fish chopped, rice taken off, plated and handed in. Served went to 1 with no page errors.

What the proof does not cover: walls (the walk is straight), the hero's own speed, a newcomer, and the fun.

## How it joins next (not built)

- **Seats.** Two to four players on one kitchen: `crew.workers` as seats, a handoff as a bucket between seats. This is
  what the co-op kitchen probe is blocked on (`soul.dependence=handoff`).
- **The look.** The stations are greybox markers. A station's dress (a hob, a board, a field, a mixer) belongs on the
  prop and furniture shelves, read by the verb and the item.
- **The book.** A gameworld's `work` page in the game design and production chapter: the card, its target and the
  solver's readout. Fixtures for chores and construction would join the farming fixture in the cosmos.
- **The management ladder.** The card stays the same, but the player becomes the dispatcher and the investor. The
  solver's moves (a slot, a hand, a bigger pot) become purchases, and the crew's run order becomes the player's
  staffing rules. In a management sim the player plays the solver. That needs a price and an income on each lever,
  and workers of different foresight.

## Gates

Machine: `worksim.test.js` (the card, routes, determinism, absence, the solver's targets), `work-mechanics.test.js`
(the mechanic on the bus) and `work-proof.test.js` (a level won by a walker who knows the card, near the simulator).
Eyes: not run.
