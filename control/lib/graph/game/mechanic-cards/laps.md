---
{ "id": "laps", "name": "Checkpoints and laps against the clock (terminal)", "summary": "Pass the checkpoints in order, laps times, to win. The last checkpoint is the finish; one out of order does nothing. A clock runs from the start, and the run's time is the level's kept number: the shell remembers the best.", "when": "race, time trial, lap the track, checkpoints in order, beat your best time, run the course, against the clock, race rivals, finish on the podium" }
---

## Role

**terminal** (ends in `success`; with rivals, in `success` or `fail` by the place). Its time is kept (`game.keep`, best
low): the result shows it beside the best; with rivals the place is kept too.

## Params

```json
{ "kind": "laps", "checkpoints": [{ "at": [10, 0, 0] }, { "at": [40, 5, 0], "radius": 4 }], "laps": 1, "label": "Time" }
```

- `checkpoints`: in order; the last is the finish line. `radius` (3) and `planar` (true) as a zone's.
- `laps`: how many times round (default 1: a point-to-point run). A loop track starts on its finish line.
- `label`: the kept number's name (default "Time").
- `rivals`: entity ids racing the same checkpoints (cars on the `racer` rule). Their zones watch what the ids share
  (`rival-1`, `rival-2` → `rival-*`). The HUD shows `Place n / N`; a tie goes to whoever passed first.
- `win`: the place that wins (default 1): finishing there or better is `race:won`, else `race:lost`.

## Lowers to

- world: a zone per checkpoint, reactions guarded by `if: { var: '__cp_<i>', eq: j }` (only the next one counts),
  a `lap` event at the finish, a tenths clock and a seconds clock (the HUD's), a watch at `laps` emitting `laps:done`.
- contract: `on: { "laps:done": { end: "success" } }`, `keep: [{ var, label, best: 'low', scale: 0.1, unit: 's' }]`.
- rivals: per rival a zone per checkpoint and its own next one; a lead (the player's passes less the rival's) and an
  ahead flag that flips as the lead crosses zero, moving `__place_<i>`; the contract becomes
  `on: { "race:won": { end: "success" }, "race:lost": { end: "fail" } }` and keeps the place (best low).
- audit: walks the checkpoints in order.
