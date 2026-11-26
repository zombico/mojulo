---
{"id": "shift", "name": "Shift: a driving job in a city vehicle, from its depot and back (emitter)", "summary": "A job done in one of the city's own vehicles (Jobsified: a garbage truck's bin round, a bus route). Taken on the phone, the hero gets into one of the depot's vehicles, drives its stops in it (on foot they do not count) and brings it back to the depot to be paid; a standing shift opens its round again.", "when": "garbage truck job, bin round, bus route, drive a city vehicle, depot job, return the truck, work shift in a vehicle, city driving jobs, jobsified"}
---

## Role

**emitter**. Beside the task that gives it (its `after` the task's flag). Its pay is a grant into the bag.

## Params

```json
{"kind": "shift", "id": "bin-round", "depot": [68, 410, 32], "radius": 18, "cabs": ["car-121", "car-122"], "stops": [{"at": [210, 380, 30], "place": "bakery"}], "reward": [{"item": "coin", "n": 40}], "repeat": true, "after": "took-bin-round", "vehicle": "garbage truck", "yard": "works yard", "done": "Bins emptied"}
```

- `depot`, `half` or `radius` — the yard: where its vehicle is had and brought back to, its box (`[hx, hy]`) or a circle.
- `cabs` — the ids of the depot's vehicles (gameworld/cars.js `car-<i>`): getting into one clocks in.
- `stops` — the round, each `{ at, radius? (7), place? }`, done once a round, only in the vehicle.
- `reward`, `repeat` — what a round pays; a standing shift is driven again.
- `after` — the flag taking the job sets (its task's, lowerTask).
- `vehicle`, `yard`, `done` — the words its toasts say.

## Lowers to

- world: `mounted` on a cab (after the job is taken, or the job taken while in one) → `shift:in:<id>`, `in-<id>` set, the first time `flag:on-<id>`; `dismounted` clears it. Entering stop k's zone in the vehicle, once → `flag:stop-<id>-<k>`, `n-<id>` counted. The depot's zone in the vehicle with every stop done → the reward into the bag, `flag:done-<id>`, `errand:done:<id>`; a standing shift's stops open again. Toasts for each.
