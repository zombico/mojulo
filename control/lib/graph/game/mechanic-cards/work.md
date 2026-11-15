---
{ "id": "work", "name": "A work shift: stations, orders and the bell (terminal)", "summary": "A Shovels & Buckets card played on the level: crates to take raw things from, stations worked by standing at them (walk off and the work waits, kept), stations that run alone and burn if left, shelves to put things down, orders at a hand-in waiting their patience. Serve the goal by the bell or it is lost. The cooking, farming, building and chores loop.", "when": "cooking game, kitchen, serve orders, farming shift, harvest and ship, a building site, chores, clear the roof, a work sim, a job against the clock, overcooked-like" }
---

## Role

**terminal**: ends in `success` (`work:won`, the goal served by the bell) or `fail` (`work:lost`).

## Params

```json
{ "kind": "work", "card": "kitchen", "at": [0, 6, 0] }
```

- `card`: a Shovels & Buckets card (`lib/graph/worksim/card.js`) or a starter by name (`lib/graph/worksim/scenarios.js`).
  Tune it first with the solver (`lib/graph/worksim/solve.js`) and write the tuned card here: the recipe holds it.
- `at`: the origin it is laid around (a line kitchen: crates behind, the stations, the shelves, the hand-in in front),
  or `{ origin?, stations?: { <id>: [x,y,z] | [[x,y,z] a slot] }, crates?, shelves?, serve? }`. `heading`: radians.
- `hands`: how many units the bag holds (the most any one step puts in or asks of it). `goal`: orders to serve by the
  bell (four fifths of what the simulator's one player serves). `seed`: the roll of the orders (the solver's).

## Lowers to

- world: a use zone per crate, station slot, shelf pad (put, take) and the hand-in; each slot's phase, progress, wait
  and hold as vars on one quarter-second tick; the orders as watches on the session's clock, each into its ticket
  slot; markers (a station by its verb, busy, ready; the tickets by order); toasts; served, lost, time and hands on the
  HUD.
- contract: `on: { "work:won": { end: "success" }, "work:lost": { end: "fail" } }`.
- proof: `lib/graph/worksim/work-proof.js` plays it on the bus as a player who knows the card would.
