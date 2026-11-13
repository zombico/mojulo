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

The quick door (`goal: 'work'`) does these things:

1. tunes the card (a starter or the creator's) for one player at the challenge (beginner by default);
2. lays the line on flat ground beside the trail, facing north, so under the overhead camera the work flows up the
   screen;
3. stands a counter under each place (a level's blocks), each place's marker a dome in its colour on top
   (`counters: true`), with E reached from a counter's side;
4. shows the work (`show: true`): the pips over the stations and shelves, and what is in hand on the HUD, a counter for
   each item that appears only while one is held;
5. sees it from overhead and works it with a mascot, unless the creator names a camera, a hero, or no hero
   (`hero: false`, first person);
6. writes the tuned card into the level's recipe.

### The work room

A shift is tried before its level, as an action game's feel is: in the practice door's **work room**
(`gameworld/work-room.js`, served at `bible?book=practice&room=work`).

These are high-concept games. The room's fidelity is in showing the work and its process, not in the characters, so
it is a conceptual space:

- **The space:** a pale plane ruled every two metres, seen by the ¾ overhead camera with north up the screen. The work
  flows up the screen: crates at the bottom, then the line, then the shelves, then the hand-in at the top. W walks up
  the screen.
- **The floor is the flowchart.** The card's recipe is drawn as arrows from where each thing is had (a crate, a shelf,
  a station that makes it) to where it goes next. Each arrow is coloured by the work it feeds: shovel work warm
  (active), bucket work cool (sorting, storing, handing in). On a site, a product's arrow runs to the climb and on from
  its foot.
- **The work shows where it happens** (the mechanic's `show`). Over each station slot, five pips fill as it is worked
  (in its verb's colour), fill again as it runs alone (violet), then stand full in red and go out one by one toward the
  burn. Over each shelf, a gold pip for every unit it holds.
- **The line:** counters coloured by verb, with crates, shelves and the hand-in in neutrals. E is reached from a
  counter's side.
- **The worker is a mascot**, rolled from a form chosen from the presets (`orb`, `sprout`, `toon`: the mascot forms)
  and piloted by its own body. It is carried inline: a figure may hold its layered recipe (`layered`) instead of a
  stored ref, regenerated on read as a stored one is, so nothing is minted. The world's own hero is used where one is
  made.
- **The movement:** a feel template, the world's own or else the everyday walker (the realistic template that runs
  slowest). The page lists every template with its run speed, and each one is a link that reopens the room with it.
- **The shift:** the card tuned for one player at the world's challenge, measured by the work proof at the template's
  own run.

Movement is a lever, and it shows where travel is what is short. The kitchen measured at three templates' runs:

| kitchen      | slowest (3.1 m/s) | middle (5.5 m/s) | fastest (12 m/s) |
|--------------|-------------------|------------------|------------------|
| beginner     | 10 of 11          | 10 of 11         | 10 of 11         |
| advanced     | 13 of 25 (goal 13)| 17 of 25         | 19 of 25         |

At beginner the order pace rules, so movement does not decide the shift. At advanced the slowest walker barely makes
the goal. The goal comes from the simulator, which does not know the template, so a chosen movement makes the same
shift easier or harder: a capacity lever the presets now expose.

### A site: the roof and its ladder

A card may stand its line on a deck: `site: { up, climb? }`, the line `up` metres over the ground (a roof, a scaffold),
the hand-in on the ground below, joined by a real climb from the playscape's ladder object (a lean `ladder` by
default, or `rungs`, `rope`, `net`). The card reads the climb's seconds from the object itself (its length at its speed,
and the step off at the lip) and adds them both ways to the hand-in's reach, so the simulator and the solver walk it too.

In the work room the climb is built:

- **The deck:** a block as high as the site under the line.
- **The ladder:** its rails and rungs, standing at the deck's far corner, and its climbable surface, climbed by the
  hero's own rule. Walk into its face to take hold, W climbs, and the lip steps you off.
- **The bin:** on the ground, a few steps out from the ladder's foot.

The hero starts on the roof. The proof walks the route: to the ladder at the template's run, down it in the ladder's own
seconds, on to the bin, and back up.

The starter roof is 4 m up on a lean ladder: 4.12 m of climb at 2.2 m/s and the step off, 2.37 s each way. On the page
in headless Chromium the stand-in, holding W at the ladder's foot, climbed from 0.6 m to 3.8 m in about two seconds and
stepped off onto the roof at 4 m. Measured at three templates' runs, the advanced roof serves 9, 10 and 11 of 12 bags.
The climb runs at the same speed for every template, so on a roof the ladder, not the run, is most of the cost. A faster
climb (a better ladder) or a lower roof is the lever there.

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
- **The look.** The work room stands the line as greybox counters; a level still draws markers. A station's dress (a hob, a board, a field, a mixer) belongs on the
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
