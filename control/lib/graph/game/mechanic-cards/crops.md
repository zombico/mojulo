---
{ "id": "crops", "name": "Plots to plant and harvest (emitter)", "summary": "Plots the walker uses (E): an empty one is planted for a cost, a crop grows a stage each dawn on the clock, a ripe one is harvested for gold. by: a day it all must be done by (fail after). Win it with win-when on the purse. The farming loop.", "when": "farming, plant seeds, grow crops, harvest, sell the harvest, a garden, tend the fields" }
---

## Role

**emitter** (with `by`, it can end the level in `fail`). Needs the `clock` (its `dawn`).

## Params

```json
{ "kind": "crops", "plots": [{ "at": [10, 4, 0.5] }], "cost": 2, "price": 6, "days": 2, "purse": { "var": "gold", "start": 6 }, "by": 6 }
```

- `plots`: where each lies. `cost` (2) to plant, `price` (6) a harvest, `days` (2) dawns to ripen.
- `purse`: { var, start, label? } the gold it takes and pays. `by`: the last day (fail after).

## Lowers to

- world: a usable zone per plot (E: plant or harvest, `use-plot-<i>-<n>`), its stage a var, a marker per stage (soil,
  the growing crop, the ripe one); guarded reactions plant (empty, enough gold), grow (each dawn) and harvest (ripe);
  toasts; the purse's readout.
- contract: with `by`, `on: { "crops:late": { end: "fail" } }`. Pair with `{ kind: 'win-when', when: { var: 'gold',
  gte: 40 } }` for the goal.
