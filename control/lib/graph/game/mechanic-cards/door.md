---
{ "id": "door", "name": "A door to another level (scene change)", "summary": "Walk into a door zone to leave this level by it: the game shell loads the level the door is linked to and stands you at the door it pairs with, facing in. Not an end: what the session gathered carries over. Linked in the game's `links`.", "when": "enter a building, go through a door into another scene, a house you go inside of, a cave entrance that loads the cave, step out the door back outside, a portal between levels, an RPG building interior" }
---

## Role

**emitter** (never ends the level). A level with doors still needs its own success terminal.

## Params

```json
{ "kind": "door", "id": "front", "at": [20, 4, 0], "radius": 1.2, "spawn": [20, 6.5, 0], "heading": 1.57 }
```

- `id` is the door's name in this level (required; unique per level).
- `at` is the door zone's middle. `radius` (default 1.2) or `half: [hx, hy, hz]` sizes it. `planar` (default
  `true`) ignores Z.
- `spawn` and `heading` say where a walker entering *by* this door stands and which way it faces: inside, a step
  past the zone, facing away from the door, so arriving never walks straight back out.

## Linked in the game

The game manifest pairs door ends, both ways:

```json
{ "links": [{ "from": { "ref": "<outside level>", "door": "inn" }, "to": { "ref": "<inn level>", "door": "out" } }] }
```

- Walking into `inn` outside loads the inn level at its `out` door's spawn.
- Walking into `out` loads the outside at `inn`'s spawn.
- `create_game` checks that every linked door exists in its level.
- A linked level's `gate` still holds, so a locked door says so.

## Lowers to

- **world:** a `zone` source at `at` watching the player, and a reaction emitting `door:<id>`.
- **contract:**
  - `on: { "door:<id>": { door: "<id>" } }`;
  - `doors: [{ id, at, spawn, heading }]`.
- **page:** the level posts `game-door` with the session's events so far (result `transit`, applied to the store),
  and a level entered by a door (`game-init` `params.__entry`) stands its pilot at that door's spawn.

Opened alone (no game shell), a door stays shut.
