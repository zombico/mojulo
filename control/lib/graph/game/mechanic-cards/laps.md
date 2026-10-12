---
{ "id": "laps", "name": "Checkpoints and laps against the clock (terminal)", "summary": "Pass the checkpoints in order, laps times, to win. The last checkpoint is the finish; one out of order does nothing. A clock runs from the start, and the run's time is the level's kept number: the shell remembers the best.", "when": "race, time trial, lap the track, checkpoints in order, beat your best time, run the course, against the clock" }
---

## Role

**terminal** (ends in `success`). Its time is kept (`game.keep`, best low): the result shows it beside the best.

## Params

```json
{ "kind": "laps", "checkpoints": [{ "at": [10, 0, 0] }, { "at": [40, 5, 0], "radius": 4 }], "laps": 1, "label": "Time" }
```

- `checkpoints`: in order; the last is the finish line. `radius` (3) and `planar` (true) as a zone's.
- `laps`: how many times round (default 1: a point-to-point run). A loop track starts on its finish line.
- `label`: the kept number's name (default "Time").

## Lowers to

- world: a zone per checkpoint, reactions guarded by `if: { var: '__cp_<i>', eq: j }` (only the next one counts),
  a `lap` event at the finish, a tenths clock and a seconds clock (the HUD's), a watch at `laps` emitting `laps:done`.
- contract: `on: { "laps:done": { end: "success" } }`, `keep: [{ var, label, best: 'low', scale: 0.1, unit: 's' }]`.
- audit: walks the checkpoints in order.
