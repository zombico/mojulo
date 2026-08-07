---
{ "id": "fall-policy", "name": "Fall handling (policy)", "summary": "What happens when the player falls off the world. A cross-cutting level policy (game.fall), not a mechanic: a catch-box below the level triggers a respawn. The opt-in penalty clamps hp so a fall can NEVER end the run — only hazards/combat can.", "when": "fell off the edge, fall into the void, walking off the world, respawn after a fall, fall damage, don't die from falling, checkpoint after falling, bottomless pit handling" }
---

## What it is

Not a mechanic — a cross-cutting `fall` field on the `game` channel. A walkable level with
edges/void needs a catch policy; without one, a fall is a bottomless drop. It lowers onto a
**catch-box** below the world (a `zone` at low Z) that the player enters when they fall.

## Modes

```json
"game": { "fall": { "mode": "respawn", "penalty": 10, "floor": 1, "to": [0,0,2] } }
```

- `respawn` (default) — teleport the player back to spawn (or `to`). Optional `penalty` subtracts
  hp on each fall, **clamped at `floor` (default 1)** — so a fall can never reach 0 and therefore
  never trips `fail-on-death`. Falls stay a soft cost, never a run-ender. `penalty` needs a
  `character` slice; omit it (penalty 0) and a fall just costs position.
- `lethal` — a fall sets hp to 0 (→ fail via `fail-on-death` if present). A hardcore platformer.
- `none` — no catch-box; the level has no void (fully enclosed) or handles falls itself.

Shortcut: `"fall": "respawn"` / `"lethal"` / `"none"` for the default of each mode.

## Lowers to

- world: a `__catch__` `zone` box below the level watching the player, + reactions — a clamped
  `inc hp` (respawn+penalty) and/or a `move` warping the player to spawn (respawn), or `set hp 0`
  (lethal). Respawn uses the bus→player teleport bridge; the clamp uses the `min` verb option.

Default is `respawn` with penalty 0 — the humane default: you can fall without dying, you just
lose your progress across the gap.
