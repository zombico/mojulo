---
{"id": "shift", "name": "Shift: a driving job in a city vehicle (emitter)", "summary": "A job done in one of the city's own vehicles (Jobsified): a garbage truck's piles held at until it is full and emptied at the dump (collect), a bus's stops held at in order while its riders board and get off (route), a heavy truck driven across the district to a building site (haul). Taken on the phone, it counts only in its vehicle; each pays, and a standing one is worked again.", "when": "garbage truck job, collect garbage, dump, bus route, bus stops, riders, heavy truck, haul to a building site, drive a city vehicle, depot job, city driving jobs, jobsified, hold a key to collect"}
---

## Role

**emitter**. Beside the task that gives it (its `after` the task's flag). Its pay is a grant into the bag.

## Params

```json
{"kind": "shift", "mode": "collect", "id": "bin-round", "depot": [85, 413, 32], "half": [20, 12], "cabs": ["car-121"], "stops": [{"at": [183, 287, 16]}], "load": 4, "hold": 1.5, "unload": {"at": [688, 431, 22], "half": [17, 10]}, "reward": [{"item": "coin", "n": 40}], "repeat": true, "after": "took-bin-round", "vehicle": "garbage truck", "yard": "works yard", "done": "Garbage collected"}
```

- `mode` — `collect` (piles held at until `load` fill it, emptied at `unload`, the depot where none), `route` (its `stops` held at in order; the last pays), `haul` (driven to its `site`; got out there, warped back to `back`; several `calls` in turn), `dig` (an operated machine: the page says `shift:scoop:<id>` and `shift:tip:<id>`, `loads` of them pay).
- `depot`, `half` or `radius` — where its vehicle is had.
- `cabs` — the ids of the vehicles it is done in (gameworld/cars.js `car-<i>`): getting into one clocks in.
- `stops` — a collect's piles or a route's stops, each `{ at, radius? (7) }`.
- `hold` — the seconds a pile or a stop is held at (the page presses `shift:hold:<id>` and `shift:let:<id>`: scene/channels/job-stops.js, key F).
- `reward`, `repeat` — what it pays; a standing one is worked again.
- `after` — the flag taking the job sets (its task's, lowerTask).
- `vehicle`, `yard`, `done` — the words its toasts say.

## Lowers to

- world: `mounted` on a cab (after the job is taken, or the job taken while in one) → `shift:in:<id>`, `in-<id>` set, the first time `flag:on-<id>`; `dismounted` clears it. Held at a pile or the next stop in the vehicle (`at-<id>`, `prog-<id>` on a 0.1 s timer) → `flag:stop-<id>-<k>`. A collect full → `flag:full-<id>`; emptied → paid. A route's last stop → paid. A haul's site → paid; got out there → `move` the cab to `back`. Paid: the reward into the bag, `flag:done-<id>`, `errand:done:<id>`, a banner. Toasts for each.
