---
{
  "id": "house",
  "name": "Mint a walkable house, apartment or furnished room",
  "summary": "Furnished multi-room dwellings from a seed or an explicit room plan — top-down plan, dollhouse cutaway or exterior; walkable; stacked with storeys.",
  "when": "\"design me a two-storey house\", \"a furnished apartment\", \"a 20 by 24 living room with a door on the south wall\", \"an office floor plan\", \"a cottage with a porch\", \"a townhouse I can walk through\", \"add a second floor\"",
  "entry": "create_sketch",
  "form": "diagram"
}
---
→ `create_sketch({ title, manifest: { kind: 'floorplan', seed, width, height, furnish: true, view: 'cutaway' | 'exterior', storeys: N } })` — the manifest is the recipe. `rooms: [{ x, y, w, h, glyph }]` replaces the seed (glyphs E L D K B O S), `levels[]` is the authored stack; `windows` / `porch` / `entryDoor` / `potLights` / `furnishScale: 'share'` are opt-in. Read `get_sketch_vocab({ id: 'floor-plan' })` before minting; iterate with `update_sketch`. Walkable at `/world`; `export_model` ships it (`lit: true` for engine-lit PBR). (Contrast: an institutional one-off → `mint_solid` kind `edifice`; a city / campus / cave → `compose_world`; a PICTURE of a house facade → `sketch_what_possible` `architecturalConstruction`.) Full family → `get_creative_toolset({ form: 'diagram' })`.
