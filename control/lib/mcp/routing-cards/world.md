---
{
  "id": "world",
  "name": "Compose a generated or live world",
  "summary": "Traversable three.js worlds: cities, hubs, drivable/flyable/platformer, planetary, painterly, math.",
  "when": "\"make a city\", \"an airport\", \"a walkable world\", \"fly a drone\", \"a platformer\", \"a game where…\", \"show me my services as a world\", \"walk Königsberg\"",
  "entry": "compose_world",
  "form": "world"
}
---
→ `compose_world`: a BASE × a THEME. Bases: `city`, `transport-hub`, `controllable` (drive/fly/platform), `action` (games with rules via an `idioms` recipe), `operator` (mojulo's own state), `planetary`, `painted-landscape`, `math` (a group as a walkable Cayley city). Read a base's manual via `get_view_vocab({id:'<base>'})`; find one by intent via `semantic_search({kinds:['view_vocab']})`; themes via `list_world_themes`. Served traversable at `/world`. (Contrast: a playable game with a persistent store → `create_game`, which promotes worlds into levels.) Full family → `get_creative_toolset({ form: 'world' })`.
