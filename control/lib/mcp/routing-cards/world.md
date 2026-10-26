---
{
  "id": "world",
  "name": "Compose a generated or live world",
  "summary": "Traversable three.js worlds: cities, hubs, drivable/flyable/platformer, planetary, painterly, terrain, math, campuses, caves.",
  "when": "\"make a city\", \"a little town I can wander around\", \"an airport\", \"a walkable world\", \"fly a drone\", \"a platformer\", \"a game where…\", \"walk Königsberg\", \"a school campus\", \"a torch-lit cave\", \"a campfire in a meadow\", \"a fireball trap\", \"a grass fire\", \"mountains I can walk and fly over\", \"a continent with a great river\"",
  "entry": "compose_world",
  "form": "world"
}
---
→ `compose_world`: a BASE × a THEME. Bases: `city`, `transport-hub`, `controllable` (drive/fly/platform), `action` (games with rules via an `idioms` recipe), `planetary`, `math` (a group as a walkable Cayley city), `school` (a campus; its plans and book → `mint_building`), `dungeon` (a cave interior), `terrain` (real-scale ground from a painted landscape or composed features — a great river, a range, a huge lake — with cities on its hills). Read a base's manual via `get_view_vocab({id:'<base>'})`; find one by intent via `semantic_search({kinds:['view_vocab']})`; themes via `list_world_themes`. Served traversable at `/world`. (A playable game → `create_game`, its levels from worlds.) Full family → `get_creative_toolset({ form: 'world' })`.

Fire in a world (a campfire, torches, a fireball, a grass fire, coloured flame) → `overrides.fire`, the 'Fire' section of the dungeon and terrain cards; prefer it to carved-solid `flame` or sketch fire.

A level with its own look (rooms, an island) → card `geocube`: forge it first. An empty place to walk, no game → card `scene`.
