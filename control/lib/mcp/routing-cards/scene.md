---
{
  "id": "scene",
  "name": "A scene to walk: a place, not a game",
  "summary": "A landscape or an outdoor place from words, walkable, nobody in it and nothing to play: the geocube's land, the way through it, its flora, sky and hour.",
  "when": "\"create a walkable scene of a grassy field\", \"a meadow path I can walk\", \"a forest walk in the morning\", \"a nature scene\", \"a landscape\", \"a hillside at sunset\", \"paint a valley at dusk\", \"a quiet place to wander, no game\", \"a field of wildflowers\", \"a snowy path through the hills\", \"a lake in the hills\", \"a beach by the sea\", \"a waterfall in a valley\", \"desert dunes at sunset\"",
  "entry": "create_sketch",
  "form": "world"
}
---
→ `create_sketch` kind `geocube` with the person's `words`: `{ kind: 'geocube', words: 'a colorful grassy field in the daytime' }`. Mojulo reads them into the cube and `show: 'path'` (the way through its land, nobody on it), with the game's own word table: field → no far cliff, colourful → wildflowers, lake, beach, river, waterfall → water, desert, alpine, coast → a biome, a time of day → `hour`, misty → `clouds`, snowy → snow. The reply's `brief` says what each word decided and what went unread. Only the place: no hero, rules, levels, story or minds; any of those voiced → `design_game`.

Revise with `update_sketch`: new `words` read again, a key you set (`hour`, `cube`, `trail`, `clouds`) stands. Colours: `cube.palette: { heat, weight, activity }` (pick_palette's axes); the color theorist solves them over the cube's own. Manual: `get_sketch_vocab({ id: 'geocube' })`.

(Contrast: a game → `design_game`; a city, terrain or campus → `compose_world`.) Full family → `get_creative_toolset({ form: 'world' })`.
