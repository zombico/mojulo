---
{
  "id": "world",
  "name": "Compose a generated or live world",
  "summary": "Traversable three.js worlds: cities, hubs, drivable/flyable/platformer, planetary, painterly, math, campuses, caves.",
  "when": "\"make a city\", \"an airport\", \"a walkable world\", \"fly a drone\", \"a platformer\", \"a game where…\", \"walk Königsberg\", \"a school campus\", \"a torch-lit cave\"",
  "entry": "compose_world",
  "form": "world"
}
---
→ `compose_world`: a BASE × a THEME. Bases: `city`, `transport-hub`, `controllable` (drive/fly/platform), `action` (games with rules via an `idioms` recipe), `planetary`, `painted-landscape`, `math` (a group as a walkable Cayley city), `school` (a campus), `dungeon` (a cave interior). Read a base's manual via `get_view_vocab({id:'<base>'})`; find one by intent via `semantic_search({kinds:['view_vocab']})`; themes via `list_world_themes`. Served traversable at `/world`. (Contrast: a playable game with a persistent store → `create_game`, which promotes worlds into levels.) Full family → `get_creative_toolset({ form: 'world' })`.
