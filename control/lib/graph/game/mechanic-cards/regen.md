---
{ "id": "regen", "name": "Regen: hp that mends (emitter)", "summary": "The player's hp comes back once it has gone a few seconds unhurt, a rate a second, to its max; a body at 0 does not mend. The stylized shooter's breather.", "when": "health regen, regenerate, heal over time, recover when out of combat, hp comes back, self heal" }
---

## Role

**emitter**. Pair it with what owns `hp` (`frags`, `fail-on-death`).

## Params

```json
{ "kind": "regen", "after": 4, "rate": 25, "max": 200 }
```

- `after`: seconds unhurt (no `hit:<player>`) before it mends (4). `rate`: hp a second (20). `max`: the hp it mends to (100).

## Lowers to

- world: a quarter-second timer, a calm var reset by every hit on the player, and a guarded `inc` of `hp` (to `max`)
  once calm, only while hp is above 0. Every verb is one Godot's bus performs.
