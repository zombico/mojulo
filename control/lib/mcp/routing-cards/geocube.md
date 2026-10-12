---
{
  "id": "geocube",
  "name": "Forge a geocube: a level's look, first",
  "summary": "One style for a level's inside and outside, as data: forge the cube, check its room and island specimens, then build the level on it.",
  "when": "\"a level with its own look\", \"make the inside and the outside match\", \"a style guide for my level\", \"test the lighting before building\", \"a sixth-gen level\", \"an early 2000s 3d level\", \"a gothic castle level and its grounds\", \"a hall and the island outside it\", \"a tavern I walk into down to its cellar\", \"a keep or a crypt to explore\", \"the buildings in my game world\"",
  "entry": "create_sketch",
  "form": "world"
}
---
→ `create_sketch` kind `geocube`: `{ cube: <preset | document | { from: <preset>, …changes } >, show: 'room' | 'land' }`. The cube holds the look and nothing placed: light, key colours, register, surface patterns, inside bones, outside base, principles. `room` shows its bare room, `land` its island lit by polygons. Change the cube with `update_sketch` until both read right.

Then build the level on it: a `stage` recipe with `geocube` and your own rooms (the inside) or `meru` (the outside). Your keys win: vary the cube, never restyle the level. A level copies its cube: re-create it by hand from a new one. Manual: `get_view_vocab({id:'geocube'})`; presets gothic-night, island-noon, jungle-haze.

A building in it (a tavern, keep, crypt, temple, shop): the cube recommends its world's buildings; a `stage` with `program: { use }` lays one in its bones and its builders' language (card `game-building`).

(Contrast: a city, a terrain, a drivable or a campus is a `compose_world` base, not a cube.) Full family → `get_creative_toolset({ form: 'world' })`.
