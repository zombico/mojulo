---
{
  "id": "geocube",
  "name": "Forge a geocube: a level's look, first",
  "summary": "One style for a level's inside and outside, as data: forge the cube, check its room and island specimens, then build the level on it.",
  "when": "\"a level with its own look\", \"make the inside and the outside match\", \"a style guide for my level\", \"test the lighting before building\", \"a sixth-gen level\", \"an early 2000s 3d level\", \"a gothic castle level and its grounds\", \"a hall and the island outside it\", \"a tavern I walk into down to its cellar\", \"a keep or a crypt to explore\", \"the buildings in my game world\", \"several levels in one art style\", \"domain expansion\"",
  "entry": "create_sketch",
  "form": "world"
}
---
→ `create_sketch` kind `geocube`: `{ cube: <preset | document | { from: <preset>, …changes } >, show: 'room' | 'land' }`. The cube holds the look, nothing placed: light, colours, register, surfaces, inside bones, outside land. `hour` (0–24, `dawn`…`night`) lights the land. Revise with `update_sketch` until both read right.

One cube, many levels: its `domains` compose its terrains, interiors, structures and towns at an hour. `domain` (a name, `{ from, …changes }`, or composed) expands one on the kind, a `stage`, a level or a game's `style`, in the cube's one style. Pick the domain whose `reads` fits the task. Manual: `get_sketch_vocab({ id: 'geocube' })`.

Or a `stage` with `geocube` and your own rooms or `meru`: your keys win; vary the cube, never restyle the level. A level copies its cube: re-create it from a new one. A building: `program: { use }` (card `game-building`).

(Contrast: a city, a terrain, a drivable or a campus is a `compose_world` base, not a cube.) Full family → `get_creative_toolset({ form: 'world' })`.
