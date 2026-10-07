---
{
  "id": "house",
  "name": "Mint a walkable house, apartment or furnished room",
  "summary": "Furnished multi-room dwellings from a seed or an explicit room plan — top-down plan, dollhouse cutaway or exterior; walkable; stacked with storeys.",
  "when": "\"design me a two-storey house\", \"a furnished apartment\", \"a 20 by 24 living room with a door on the south wall\", \"an office floor plan\", \"a cottage with a porch\", \"a townhouse I can walk through\", \"add a second floor\"",
  "entry": "mint_building",
  "form": "building"
}
---
→ `mint_building({ title, manifest: { seed, width, height, furnish: true, view: 'cutaway' | 'exterior', storeys: N } })` — the manifest is the recipe (`kind: 'floorplan'` may be left out). `rooms: [{ x, y, w, h, glyph }]` replaces the seed (glyphs E L D K B O S), `levels[]` is the authored stack. The result's `next` names the steps open from here — furnishing, storeys, framing, roof, drainage, the IFC export — and the card for each; read it before adding that step. Iterate with `update_sketch`. Walkable at `/world`; `export_model` ships it (`format: 'ifc'` for BIM tools, `lit: true` for engine-lit PBR). (Contrast: an institutional one-off → `mint_solid` kind `edifice`; a city / campus / cave → `compose_world`; a PICTURE of a house facade → `sketch_what_possible` `architecturalConstruction`.) Full family → `get_creative_toolset({ form: 'building' })`.
