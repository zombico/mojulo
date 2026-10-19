---
{ "id": "map", "name": "An epoch's map (terminal)", "summary": "The level is the map a tactics game is travelled from: a diorama with its dots (battles, skirmishes, towns, story stops) and the roads between them. The party walks an open road to a dot and the level is left by that dot's exit, the game travelling to its level; a road opens when the dot it waits on is won.", "when": "world map, the map between battles, choose where to go, travel between battles, an epoch's map, a campaign map" }
---

## Role

**terminal** (ends in `success`, by the exit of the dot chosen).

## Params

```json
{ "kind": "map", "dots": ["gate", "mill", "keep"], "slice": "campaign" }
```

- `dots`: the ids of the map's dots (the world's `map`, board/board-map.js), each a way out of the level.
- `slice`: the progression slice the map reads its cleared dots from.

## Lowers to

- contract: `on: { "map-go:<dot>": { end: "success", exit: "<dot>" } }` for each dot; `consumes: [{ slice }]`.
- the game's levels: the map's exits, one a dot, to the dot's level, gated on the dot it waits on; each dot's level
  leaves by its own `map` exit, back to the map.
