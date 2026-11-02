---
{ "id": "escape-room", "name": "Escape room (terminal)", "summary": "A space you are held in, its way out sealed, until N locks are open: each by a key found inside it (carried to the lock) or by a step (a bus var reaching a value). The sealed exit says so and puts you back; every lock open lifts the seal, and the way out wins. Lowered onto zones, guarded reactions and watches; its keys, locks and seal are named markers.", "when": "an escape room, locked in until you find the keys, a sealed door with locks, find the keys to get out, a room you cannot leave, a vault door with three locks, locks opened by keys or switches, a cell to break out of, emblem doors" }
---

## Role

**terminal** (ends in `success`). In place of `reach-exit`: its exit is the level's way out, sealed.

## Params

```json
{ "kind": "escape-room", "id": "cell", "locks": [
  { "id": "red", "at": [12, 0, 0], "key": { "item": "red-key", "at": [4, 3, 0] } },
  { "id": "blue", "at": [13, 0, 0], "key": { "item": "blue-key", "at": [6, -3, 0] } }
], "at": [16, 0, 0], "back": [10, 0, 0] }
```

- `id` — the room's name (default `room`): every name it gives is derived from it.
- `locks` — one to eight. A **keyed** lock `{ id?, at, radius?, key: { item?, at, radius?, planar? } }`: its key lies
  at `key.at` (taken once), the lock stands at `at` and opens when walked into with its key. A **step** lock
  `{ id?, when: { var, gte|gt|lte|lt|eq|ne }, at? }`: it opens itself when the predicate holds (a `push`'s plates, a
  `defeat-all`'s downs, a var your reactions set).
- `at`, `radius` (2) | `half`, `planar`, `via` — the way out, as `reach-exit`'s. `back`: where a walker turned away at
  the seal is put (so walking in again is a new try). `via`: the waypoints to it, after the locks.
- `audit` — optional, hand-named `{ kind: 'walkto', target, via? }`.

## Lowers to

- world, per keyed lock: zones `<room>-key-<lock>` and `<room>-lock-<lock>` with markers of the same names (`key`,
  `lock`), toggled off when taken and opened; `key:<item>` and `lock:opened` (its `room` and `lock` on the event);
  `lock:locked` when tried without its key. A step lock: a watch on its predicate.
- world: the `<room>-seal` marker on the way out, lifted at `escape:open:<room>` (every lock open); the
  `<room>-exit` zone: `escape:out:<room>` when open, else `escape:sealed:<room>` (and the move back). HUD: a `Locks`
  counter and the toasts.
- contract: `on: { "escape:out:<room>": { end: "success" } }`.
- audit: `{ kind: "walkto", target: at, via: [each key, each lock, …via] }`: keys reachable, then the
  locks, then the way out. With a step lock and no hand `audit`, none (its producer is not known here): promotion stays
  manual, as for `win-when`.

## In a world

A level's `goal: { escape: true | 1…4 }` lays one on its last stage (the room its id): keys along the trail's beats or
on a building's route through its rooms, locks at the way out. A walled-core dungeon's door `gate: { keys: true }` is
opened by the keys found in the space it leaves.
