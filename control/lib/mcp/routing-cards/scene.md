---
{
  "id": "scene",
  "name": "A scene to walk: a place, not a game",
  "summary": "A landscape or an outdoor place from words, walkable, nobody in it and nothing to play: the geocube's land, the way through it, its flora, sky and hour.",
  "when": "\"create a walkable scene of a grassy field\", \"a meadow path I can walk\", \"a forest walk in the morning\", \"a nature scene\", \"a landscape\", \"a hillside at sunset\", \"paint a valley at dusk\", \"a quiet place to wander, no game\", \"a field of wildflowers\", \"a snowy path through the hills\"",
  "entry": "create_sketch",
  "form": "world"
}
---
→ `create_sketch` kind `geocube`, `show: 'path'`: the way through the cube's land, walked by a stand-in, nobody on it. `{ cube: { from: <preset>, …changes }, show: 'path', hour?, clouds?, biocube?, path?, seed? }`. Only the place is asked for (the look, the land, what grows, the sky, the hour): no hero, rules, levels, story or minds, so no game. Any of those voiced → `design_game`.

Words → the cube: an open field or plain, no cliff → `outside: { cliff: false }`; grassy, a meadow → `from: 'island-noon'` (the meadow); wildflowers, colourful → `biocube: { from: 'meadow', flora: { flowers: { share } } }`; a forest, a grove, an upland → that biocube; the time of day → `hour` (`dawn`…`night`); misty, stormy → `clouds`; snowy → the cube's `snow`. Revise with `update_sketch`: each change re-makes the place from its recipe. Manual: `get_sketch_vocab({ id: 'geocube' })`.

(Contrast: a game → `design_game`; a city, terrain or campus → `compose_world`.) Full family → `get_creative_toolset({ form: 'world' })`.
