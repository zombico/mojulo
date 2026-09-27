---
{ "id": "store", "name": "store / mall — shops fit out from retail concept cards", "summary": "a walkable shop (kind 'store') or a mall whose bays are shops (kind 'mall'), each fit out from a concept card: pure JSON naming cells, zones and fixtures, graded by a retail assessor and scaled down to small units with every change stamped", "when": "making a shop, store, boutique, cafe, bar, wine bar, bookstore, showroom, food counter, department store or shopping mall interior — or authoring a new kind of store as a card rather than placing fixtures by hand", "tier": "recipe" }
---

A store is a **concept card**: plain JSON the interpreter reads. A new kind of
store is a new card, never new code. One interpreter fits any card into any unit
(a standalone shop, a narrow mall bay, a wide anchor). One assessor grades the
result, and a degrade pass scales it down to small units.

## Manifests

```json
{ "kind": "store", "title": "Vintner", "card": "wine-bar", "width": 26, "depth": 44, "seed": 1 }
{ "kind": "store", "title": "My shop", "card": { …an inline card… } }
{ "kind": "mall", "title": "Arcade", "cards": { "cafe": "wine-bar", "3": { …inline… } }, "levels": 1 }
```

- `store`: `card` (required) is a seeded id or an inline card. `width` × `depth` (ft, default 24 × 40) is the
  lot, with the storefront on the south edge. `degrade: false` grades the raw card. `cast: false` drops the card's
  mannequins.
- `mall`: every bay takes the seeded card for its store type (tenants cycle `apparel`, `electronics`, `cafe`,
  `bookstore`, `homewares`; the food court is `food`; both anchors are `department`). `cards` overrides by store
  type or by bay index; `cards: false` leaves the bays bare. `levels: 2` builds the atrium mall.
- Seeded cards: `apparel`, `electronics`, `cafe`, `bookstore`, `homewares`, `department`, `food`, `wine-bar`.
  Start from one of these and edit it; that is the fastest route to a new store.

## The card

Positions are fractions in the **sales floor's own frame**: `depth` runs 0 at the storefront glass to 1 at the
back, and `lateral` runs 0 at the left to 1 at your right hand as you walk in. So one card fits any size or
orientation.

```json
{
  "id": "wine-bar", "label": "Wine bar",
  "finishes": { "floor": "floorboards", "floorTint": "#5e4331", "wall": "brick", "sign": "#6a2e38", "trim": "#a8864a" },
  "palette": { "merch": ["#7a2f3a", "#c9a06a", "#4f6f4a"] },
  "entry": { "at": 0.22 },
  "cells": [{ "archetype": "stockRoom" }, { "archetype": "booth", "count": 2 }, { "archetype": "restroom" }],
  "zones": [
    { "role": "window", "depth": [0, 0.12] }, { "role": "browse", "depth": [0.12, 0.5] },
    { "role": "service", "depth": [0.5, 0.84] }, { "role": "back", "depth": [0.84, 1] }
  ],
  "fixtures": [
    { "archetype": "counter", "zone": "service", "run": [0.34, 0.9], "depth": 0.5, "bar": true },
    { "archetype": "stool", "along": "counter", "pitch": 2.4 },
    { "archetype": "backBar", "zone": "back", "run": [0.3, 0.66] },
    { "archetype": "fridgeCase", "zone": "back", "run": [0.68, 0.98] },
    { "archetype": "tableSet", "zone": "browse", "grid": [2, 1], "run": [0.45, 0.95] },
    { "archetype": "banquette", "zone": "browse", "wall": "left", "run": [0.3, 0.95] }
  ],
  "cast": [{ "archetype": "mannequin", "zone": "window", "at": 0.6, "sex": "female", "outfit": { "layers": ["fittedShirt", "trousersSlim"] } }]
}
```

- **finishes.** `floor`: `floorboards` | `marble` | `plain`. `wall`: `paint` | `wainscot` | `wallpaper` | `brick`.
  Hex values: `floorTint`, `paint`, `sign`, `trim`.
- **cells** are real rooms cut across the back of the unit, in card order from left to right: `fittingRoom`,
  `stockRoom` (staff side: it needs a path from behind the counter, not a customer aisle), `booth`, `restroom`.
  Take `count` for repeats and `minArea` for size. Cells that do not fit are shed in the order booth → restroom →
  fittingRoom.
- **zones** are the exposure gradient over the open floor: `window`, `browse`, `service`, `back`, in that order and
  without overlap.
- **fixtures.** A run takes `run: [l0, l1]` plus an optional `rows` and `depth` (0–1 within the zone). A wall-backed
  run takes `wall: 'left' | 'right' | 'back'`. A point takes `at` (one lateral or a list) or `grid: [cols, rows]`
  over `run`. `stool` takes `along: 'counter'` and `pitch`. `tableSet` takes `size: 'four' | 'two'`. `tint`
  overrides a body colour, and `bar: true` makes a counter a railed bar.
  Run archetypes: `counter`, `backBar`, `rackRun`, `gondola`, `hangerRun`, `shelfWall`, `fridgeCase`, `banquette`,
  `queueRail`, `pendantRow`, `wallArt`. Point archetypes: `podium`, `tableSet`, `stool`, `plant`, `tillPoint`.
- **cast** (optional): a `mannequin` takes `zone`, `at`, `sex`, `pose` (`display` | `hipHand` | a pose object),
  `outfit`, `form` (a hex tint) and `cast` (a proportion preset).

## What comes back

The scene's `store` report carries `assessment.findings` in the evaluateBuilding shape (register `retail`), plus
`fitted` (grid and row counts reduced to fit), `degraded` (each split, trim, shift, downsize or shed, with the
finding that caused it) and `shedCells`. None of these refuse. Read the invariants as authoring feedback:
`entry-decompression`, `aisle-to-*`, `staff-to-*`, `aisle-through`, `cashwrap-sightline`, `fixture-overlap`,
`pierces-glass`, `exposure-gradient`, `cashwrap-missing`. The gradients are `power-wall-right`,
`window-feature`, `browse-density` and `seats-near-counter`.
