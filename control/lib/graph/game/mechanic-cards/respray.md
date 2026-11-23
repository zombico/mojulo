---
{"id": "respray", "name": "Respray: a garage that loses the law (emitter)", "summary": "A garage on a city street: drive in with stars and the price and the car comes out a new colour, the police lose you (the wanted level cleared). With no stars there is nothing to hide; short of the price it says so.", "when": "a respray shop, pay and spray, lose the cops, change the car's colour, clear the wanted level, a body shop"}
---

## Role

**emitter** (requires the bag). Laid by a played city with `shops.respray` (gameworld/shops.js), beside the law's `wanted`.

## Params

```json
{"kind": "respray", "at": [40, 0, 0], "price": 40, "radius": 4, "watch": "car-*"}
```

- `at`, `radius` — the garage's door on the street; `watch` the cars that drive in (their ids).
- `price` — the coin a respray costs; `tints` its colours (linear rgb), each car the next.

## Lowers to

- world: a zone at `at` watching the cars; entered with `wanted` ≥ 1 → the price taken → `respray:done`: `ctrl repaint` the car the player drives, `cleared:wanted` (the wanted level's reset); short → `respray:short`; with no stars → `respray:clean`.
- hud: a toast for each.
