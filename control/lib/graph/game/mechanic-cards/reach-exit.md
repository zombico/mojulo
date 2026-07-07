---
{ "id": "reach-exit", "name": "Reach the exit (terminal)", "summary": "Walk into a goal zone to win. A success-terminal mechanic: entering the zone ends the level in success. Its completability audit IS the walkability check (compile a walk to the exit).", "when": "reach the exit, get to the goal, escape the room, touch the flag, walk to the end, finish/beat the level by getting somewhere, an exit door" }
---

## Role

**terminal** (ends in `success`). Satisfies the level's ≥1-success-terminal rule.

## Params

```json
{ "kind": "reach-exit", "at": [20, 0, 0], "radius": 2 }
```

- `at` — the goal position `[x, y, z]` (required).
- `radius` — sphere trigger radius (default 2). OR `half: [hx, hy, hz]` for a box zone.
- `planar` — default `true`: the zone ignores Z, so a jump over the footprint still counts (a
  floor goal). Set `false` to require the exact height.

## Lowers to

- world: a `zone` fact source at `at` watching the player, + a reaction emitting `goal:reached`.
- contract: `on: { "goal:reached": { end: "success" } }`.
- audit: `{ kind: "walkto", target: at }` — the completability gate compiles a walk to the exit.

Requires no store slice. Pair with `collect`/`hazard-damage` emitters and optionally
`fail-on-death` for a lose condition.
