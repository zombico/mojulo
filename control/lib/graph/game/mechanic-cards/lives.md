---
{ "id": "lives", "name": "Lives (terminal)", "summary": "A platformer's lives instead of hp: the player starts with a few, each hit it takes and each fall into a pit costs one, a 1-up gives one back, and none left ends the level in failure. On the HUD as Lives.", "when": "lives, extra lives, a life counter, 1-up, three lives, a hit costs a life, falling costs a life, game over when out of lives, mascot platformer lives instead of a health bar" }
---

## Role

**terminal** (ends in `fail`).

## Params

```json
{ "kind": "lives", "start": 3, "max": 9, "falls": ["__course-1-1__"] }
```

- `start` — lives at the start (default 3).
- `max` — the most a 1-up can bring them to (default 9).
- `falls` — the catch zones (a course's pits) a fall into costs a life in; the course itself puts the player back on
  the floor it left.

## Lowers to

- world: a `lives` var; `hit:<player>` (a foe's touch, through its mercy) and each fall zone's `enter` take one, a
  `oneup` gives one (to `max`); a watch that emits `dead` at none; the HUD's Lives.
- contract: `on: { "dead": { end: "fail" } }`.

Requires no store slice. Pair with `coins` (its `oneup`) and `reach-exit`. A level on lives takes no `fail-on-death`.
