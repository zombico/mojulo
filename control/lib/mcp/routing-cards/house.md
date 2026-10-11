---
{
  "id": "house",
  "name": "Mint a walkable house, apartment or furnished room",
  "summary": "A house, apartment or furnished room as one recipe with its structure book: massing on a site, a plan that lives well, a drawing set, the frame and trades; walkable, stacked with storeys.",
  "when": "\"design me a two-storey house\", \"a furnished apartment\", \"a 20 by 24 living room with a door on the south wall\", \"an office floor plan\", \"a cottage with a porch\", \"a townhouse I can walk through\", \"add a second floor\", \"draw me the floor plans and elevations\", \"what would it take to frame this house\"",
  "entry": "mint_building",
  "form": "building"
}
---
→ `mint_building({ title, manifest: { seed, width, height, storeys: N, furnish: true } })` — the manifest is the recipe (`kind: 'floorplan'` may be left out); `rooms: [{ x, y, w, h, glyph }]` or `levels[]` author the plan. The house's page is its structure book: Cover, Site, Massing, Plan, Rooms, Elements, Objects, Structure, Services, Quantities, Checks, Walk, Open. Four outcomes, a card each: Concept `house-concept`, Layout `house-livability`, Drawings `house-drawings`, Build `house-build`; ask that card's questions from zero. The result's `next` names what is open by outcome and the field or export for it. Iterate with `update_sketch`; `export_model` ships it (`sheets`, `schedules`, `ifc`, `glb`). (Contrast: an institutional block for a world → `mint_solid` kind `edifice`; a city / campus / cave → `compose_world`; a PICTURE of a facade → `sketch_what_possible` `architecturalConstruction`.) Full family → `get_creative_toolset({ form: 'building' })`.
