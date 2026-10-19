---
{ "id": "board", "name": "A battle on the board (terminal)", "summary": "The level is a tactics battle fought on spots laid over its own ground: the party deploys, then takes its turns against the foes. The board says when it is won, and the level ends there; a lost battle (or a draw at the turn cap) fails it.", "when": "tactics battle, a battle on a grid, turn-based tactics, fight it on the map, a strategy battle, deploy the party" }
---

## Role

**terminal** (ends in `success` on `board-won`, `fail` on `board-lost` or `board-draw`).

## Params

```json
{ "kind": "board" }
```

None: the battle is the level's own `board` (its spots, its `battle`: party, foes, deploy, rules), laid over the level's
stage by the world (board/board-scene.js boardOverWorld).

## Lowers to

- contract: `on: { "board-won": { end: "success" }, "board-lost": { end: "fail" }, "board-draw": { end: "fail" } }`.
- the board page pushes the outcome on the level's bus as the battle ends (the events channel carries it).

Compose it with `party` (and `bag`) so the battle's party is the game's and its spoils are carried.
