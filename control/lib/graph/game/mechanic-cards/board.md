---
{ "id": "board", "name": "A battle or a defence on the board (terminal)", "summary": "The level is played on spots laid over its own ground: a tactics battle (the party deploys, then takes its turns against the foes) or a tower defence (towers on free spots, the waves walking round them). The board says when it is won, and the level ends there; a lost battle or an overrun base (or a draw at the turn cap) fails it.", "when": "tactics battle, a battle on a grid, turn-based tactics, fight it on the map, a strategy battle, deploy the party, tower defence on a grid, a maze defence, towers that block the path" }
---

## Role

**terminal** (ends in `success` on `board-won`, `fail` on `board-lost` or `board-draw`).

## Params

```json
{ "kind": "board", "exit": "map" }
```

- `exit`: the way the level is left when won (a map game's: back to its epoch's map). The battle is the level's own `board` (its spots, its `battle`: party, foes, deploy, rules), laid over the level's
stage by the world (board/board-scene.js boardOverWorld). A defence is the board's `td` instead (spawns, base, waves, gold,
lives, towers: board/board-td.js), won when every wave is turned back.

## Lowers to

- contract: `on: { "board-won": { end: "success", exit? }, "board-lost": { end: "fail" }, "board-draw": { end: "fail" } }`.
- the board page pushes the outcome on the level's bus as the battle (or the defence) ends (the events channel carries it).

Compose a battle with `party` (and `bag`) so the battle's party is the game's and its spoils are carried.
