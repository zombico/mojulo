---
{ "id": "board", "name": "A battle, a defence or a skirmish on the board (terminal)", "summary": "The level is played on spots laid over its own ground: a tactics battle (the party deploys, then takes its turns against the foes) a tower defence (towers on free spots, the waves walking round them) or a real-time skirmish (units ordered, workers mining, a barracks training, against a mind). The board says when it is won, and the level ends there; a lost battle, an overrun or fallen base (or a draw at the turn cap) fails it.", "when": "tactics battle, a battle on a grid, turn-based tactics, fight it on the map, a strategy battle, deploy the party, tower defence on a grid, a maze defence, towers that block the path, real-time strategy, order units, a skirmish against the computer" }
---

## Role

**terminal** (ends in `success` on `board-won`, `fail` on `board-lost` or `board-draw`).

## Params

```json
{ "kind": "board", "exit": "map" }
```

- `exit`: the way the level is left when won (a map game's: back to its epoch's map). The battle is the level's own `board` (its spots, its `battle`: party, foes, deploy, rules), laid over the level's
stage by the world (board/board-scene.js boardOverWorld). A defence is the board's `td` instead (spawns, base, waves, gold,
lives, towers: board/board-td.js), won when every wave is turned back. A skirmish is its `rts` (bases, nodes, gold,
workers, army, the enemy's start, the mind: board/board-rts.js), won when the enemy's base falls; its `sides` are
civilizations in their own words (board/board-rts-look.js), each fielding and drawn as what its technology crafts.

## Lowers to

- contract: `on: { "board-won": { end: "success", exit? }, "board-lost": { end: "fail" }, "board-draw": { end: "fail" } }`.
- the board page pushes the outcome on the level's bus as the battle (or the defence, or the skirmish) ends (the events channel carries it).

## A book's battles on boards

A gameworld's `battles: { on: 'board', board? }` lays each stage that meets packs as a tactics battle on its own ground,
the whole level: spots over the stage (inside or out), the party (cap 4) on the near rows, the packs on the far rows,
turns by speed (move, act, face); a blow from the side or behind hits harder. Won on the board; the hero falling loses.
The game is EPOCHS, each a MAP (a diorama, a dot a stage, a road opening as each is won, each level back to it; its last
stage on to the next map, the final one ending the game); each area has a skirmish to fight again.
`board: { cols?, rows?, cap?, skirmish?: false, epochs?: [{ name?, levels }] (default: each level its own), talk?: {
portrait?: true } (a scene told on the board: the words over the speaker, a close portrait beside), rules?: { win?:
{ leader | survive }, lose?, permadeath? } }`. Every act plays on the map (a spell its element's effect); a SUMMONER
(party.<id>.class) calls beings in 3D (inferno, glacier, tempest, colossus, wyrm). A world whose intent fights tactics
is laid with board battles.

Its story's SLOTS: a moment's `when: { slot: 'before' | 'after' }` plays on a level, ahead of its battle and after its
win (a walked stage: its start, its exit); `where: { epoch: <n or name> }, when: { slot: 'begin' | 'end' }` on an epoch
(its map opening, once a game; after its last stage). An empty slot plays nothing. On a board a shot's `on` is a unit, a
dot or a spot: the camera cuts to them from the front, and the words float over whoever speaks. A beat's
`do: { emit: 'fx:<effect>:<who>' }` plays an effect there (quake, meteor, flare, bolt, a summon's name…).

Compose a battle with `party` (and `bag`) so the battle's party is the game's and its spoils are carried.
