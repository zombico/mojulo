---
{ "id": "lock", "name": "A lock across the way (a gated door met in play)", "summary": "A seal standing in a doorway: walking into it opens it for good where the bag holds its key (the key kept), else it says what opens it and puts the walker back where it came from. Not an end: the way on is only barred.", "when": "a locked door inside a dungeon, the vault door that needs the vault key, a walled core's gated door met in play, a gate a guard's key opens, a sealed passage that a key carried in the bag opens" }
---

## Role

**emitter** (never ends the level). A level with locks still needs its own success terminal.

## Params

```json
{ "kind": "lock", "id": "vault", "key": "vault-key", "name": "Vault Key", "at": [12, 25, 1.7], "back": [9, 25, 1.7], "radius": 1.2, "planar": false }
```

- `id` names it (a lower-case word; its seal is `lock-<id>`, its flag `lock-<id>`).
- `key` is the bag item that opens it (`held:bag:<key>` at 1 or more); `name` is what its words call the key.
- `at` is where it stands, a doorway the way on must pass; `radius` (default 1.2) sizes its zone, `planar` (default
  `true`) ignores Z.
- `back` is where a walker without its key is put: a step back the way it came.

## Lowers to

- **world:** a `zone` at `at` watching the player; a `seal` marker `lock-<id>`; the flag `lock-<id>` at 0; reactions:
  entering while shut tries it; with the key held the flag is set and `lock:open:<id>` emitted (the seal off), else
  `lock:shut:<id>` and the walker moved to `back`.
- **hud:** a toast as it opens, another saying which key opens it when it is shut.

The key is never spent: it stays in the bag (the party menu's Key tab). A party RPG's citadel lays its walled core's
gated doors as locks, each key carried by the guard before it (`gameworld/battles.js` `citadelLocks`).
