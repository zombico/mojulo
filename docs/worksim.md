# Shovels & Buckets: the work-sim primitive

Status: spike (`control/lib/graph/worksim/`). Pure and seeded, with tests. Not yet in the cosmos registry or on any door,
and nothing plays it yet. This page is its design notes.

## The paradigm

A work sim (a kitchen, a farm, a building site, a chore) is stations that turn things into other things, a crew that
works them, and a demand that asks for what comes out. Every second of labour is one of two kinds:

- **Shovel: active processing.** A worker's hands are on it for its `work` (chop the fish, plough the field, dig the
  trench, rake the roof). A shovel may then **run alone** for a `wait` (the pot cooks, the crop grows, the concrete
  mixes) while the hands are free, and its output keeps on the station for a `hold` before it burns, rots or sets.
- **Bucket: passive sorting, to storage or to the next step.** Short, attention-light handling: fetching from a crate,
  collecting what ran alone, combining (plating, bagging, pouring), carrying and serving.

Two consequences fall straight out of the model:

1. **Collecting what ran alone is always bucket work.** Harvesting is the bucket half of the tractor's shovel, and
   taking the rice off the hob is the bucket half of cooking it. The farm's "tractor is shovel, harvest is bucket" is
   not a special case.
2. **The shovel needs two states: attended and unattended.** Most of a kitchen sim's tension comes from juggling the
   unattended shovels (one running, one about to burn) while the hands are on an attended one. The simulator measures
   this as `juggle`.

The dichotomy also hides a third cost: **travel**. In the starter cards it is a third to a half of all labour, and in a
chore (the trip down the ladder) it dominates. Travel is where a level's layout becomes a difficulty lever.

## Difficulty is three families of levers

| family   | levers (card paths)                                                                |
|----------|------------------------------------------------------------------------------------|
| capacity | `crew.workers`, a station's `slots` (hobs, fields), an item's `store` (the shelf, the silo) |
| output   | a station's `batch` (`gives`: a bigger pot, a wider plough), its `work` (a better tool) |
| demand   | `demand.every`, `demand.patience`, the order mix, `demand.rush`, a chore's `demand.backlog` |

Nothing else tunes it. The list is `LEVERS` in `card.js`.

## The solver

`solve(card, target)` searches the levers toward a target. The target is either a preset or a challenge number from
0 (beginner) to 1 (advanced) that interpolates between the presets. A target has two parts:

- **a shape of demand:** cadence (steady or random), rushes, the mix (orders ranked by labour) and patience as a
  multiple of the mix's critical path;
- **bands** for what a session measures: `pressure` (the crew's busy fraction), `miss` (orders lost ÷ orders closed),
  `juggle` (stations running alone at once) and `slack` (the patience a served order had left).

| preset       | demand                                                         | pressure  | miss       |
|--------------|----------------------------------------------------------------|-----------|------------|
| beginner     | even beat, the simpler half of the mix, 3 × the critical path   | 0.45–0.65 | 0–5%       |
| intermediate | random, mild rush (×1.5), all but the hardest order, 2 ×        | 0.65–0.82 | 3–15%      |
| advanced     | random, rush ×2, the whole mix, 1.4 ×                          | 0.82–0.97 | 8–25%      |

The search runs in three layers:

1. **The closed form** (`analyze.js`) treats the card as a network of queues. It reads labour per order (split into
   shovel, bucket and travel), the crew's load and each station's load (ρ, the share of capacity the demand asks for),
   the bottleneck, and the critical path. It gives the starting estimate.
2. **The simulator** (`sim.js`) plays a seeded session in quarter-second ticks with a competent crew, and is the
   judge. Each idle worker takes the first of these, in order:
   - rescue an output about to burn;
   - hand in the order due soonest that the shelf can fill (stock is allotted by due time);
   - collect any finished output;
   - start the run with the longest chain behind it.
3. **The search** first sets the demand's shape. It then bisects the rate lever (`every`, or a chore's backlog) for
   the middle of the pressure band, then bisects patience for the middle of the miss band. It adds a slot where a
   station is full, or a better tool to a chore's busiest shovel. Every move is recorded with its lever, its family
   and the reason for it. When the bands cannot all be met, it returns the closest result and says so; it never
   refuses.

Board: `node control/scripts/spikes/worksim/solve.mjs [card…] [--challenge 0.7] [--card file.json] [--json]`.

### What the board taught

- **Advanced is demand above capacity, in bursts.** At advanced, the closed form's crew load passes 1 (the kitchen
  just over 1, the farm and the site well past it). A session is survivable only by what was made ahead, so storage
  (`store`) becomes strategy rather than chores, and `spoil` and `hold` are its price.
- **Difficulty is measured against a player.** The crew's `foresight` (0 to 1) is the player model:
  - at 1 it keeps made ahead what the coming orders will want (the farmer sows before the order arrives);
  - at 0 it only answers orders already open.

  A reactive crew on the farm sat idle while crops grew and orders piled up, and its busy fraction misread the
  difficulty. Presets measure against the expert (1). Measuring the same card against both players would show the
  card's skill ceiling.
- **A card's structure sets its range.** The levers move a card within a range that the shape of its recipe tree
  decides. A card whose intermediate and advanced come out alike needs a structural change (another order, a station
  that runs alone), not a lever change.
- **The closed form reads close where work is unbatched** (the kitchen, the site and the roof, at beginner and
  intermediate). Batches and long grows make it read high, as on the farm. The simulator is the judge.

## Gates

Machine gate only: the solver measures challenge. Whether a card is fun at that challenge is the eyes gate's call,
which means someone has to play it.

## How it joins (not built)

- **Runtime.** A shovel is a station zone the hero holds `use` at for its `work` (a progress cue), and its `wait` and
  `hold` are timers on the bus. A bucket is the bag's guarded transfer from the errand mechanics
  (`game/errand-mechanics.js`): `trade` is a raw crate, `cargo`'s perishable is `spoil`, `deliver` is the hand-in.
  Two pieces are missing: a held-work station and a combine that takes several inputs (plating).
- **Travel from the level.** The flat `crew.travel` hop gives way to path lengths on the level's own layout, so the
  layout becomes a lever the solver can read.
- **Cosmos.** The co-op kitchen probe is blocked on `soul.dependence=handoff`, and a handoff is a bucket between two
  seats: one seat chops, the other plates. Seats map to `crew.workers`. A chores fixture and a construction fixture
  would join the farming one.
- **The book.** A gameworld's `work` key would carry the card, its solved target and the solver's readout as the
  audit, in the game design and production chapter.
- **The management ladder.** The card stays the same, but the player stops being a worker and becomes the dispatcher
  and the investor. The solver's moves (add a slot, hire a worker, buy a bigger pot) become the player's purchases,
  and the simulator's dispatch order becomes the player's staffing rules. In a management sim the player plays the
  solver. That needs a price and an income on each lever, and workers of different skill (foresight per worker).
