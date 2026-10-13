---
{ "id": "score", "name": "A score, kept best (emitter)", "summary": "A number the level counts up from bus events, shown on the HUD and kept: the result shows it beside the best this save has seen. best high for points, low for a count to keep down.", "when": "score points, high score, beat your best, count kills or coins, arcade score, keep a record" }
---

## Role

**emitter**. Not a terminal: the level still needs one to end. Its var is kept (`game.keep`).

## Params

```json
{ "kind": "score", "var": "score", "label": "Score", "best": "high", "points": [{ "on": "enemy:down", "by": 100 }, { "on": "pickup:coin", "by": 10 }] }
```

- `var`: the bus var (default `score`); other reactions may add to it too.
- `points`: bus events that score (the exact type), `by` each (default 1), with an optional `match`.
- `best`: `high` (default) or `low`. A low best counts only a cleared run.

## Lowers to

- world: the var at 0, an `inc` reaction per point rule, a counter readout.
- contract: `keep: [{ var, label, best }]`: the level's end reads it off the bus and sends it as `stats.kept`.
