---
{ "id": "runner", "name": "The run, scored (terminal)", "summary": "An endless runner's end and score: ten metres and each coin score on the bus, the distance, coins and score shown and the best kept. Endless, the crash ends the run and its score is the result; with a distance, reaching it wins and a crash fails.", "when": "endless runner, run until you crash, lanes, swipe to dodge, distance run, coins on the way, beat your best run" }
---

## Role

**terminal** (success and fail). It ends the level: the run's crash, or the distance reached.

## Params

```json
{ "kind": "runner", "distance": 1000, "coin": 25, "metres": 10 }
```

- `distance`: the metres a run is won at, a whole number of 10 or more. Absent: endless (the crash ends the run as its result).
- `coin`: the score a coin adds (default 25); `metres`: what each ten metres adds (default 10).

## Needs

A level whose world carries `runner` (worlds/controllable/runner.js): the pilot runs on its own, its rows laid as it
plays, and the bus hears `runner:run` (each ten metres), `runner:coin` and `runner:crash`. design_game's quick goal
`runner`, or a level's `runner`, lays both.

## Lowers to

- world: `distance`, `coins` and `score` at 0, an `inc` reaction per fact, a counter for the score and readouts for the
  metres and the coins; with a distance, a watch on it.
- contract: `on: { 'runner:crash': … }` (and `run-won`), `keep: [score, distance]`, the best of each kept.
