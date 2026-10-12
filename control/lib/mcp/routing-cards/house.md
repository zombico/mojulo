---
{
  "id": "house",
  "name": "Mint a walkable house, apartment, furnished room, store, restaurant or mall",
  "summary": "A building as one recipe with its structure book: a house's massing on a site, a plan that lives well, a drawing set, the frame and trades; a store, restaurant or mall read by its own program, with its fit-out scheduled; walkable.",
  "when": "\"design me a two-storey house\", \"a furnished apartment\", \"a 20 by 24 living room with a door on the south wall\", \"an office floor plan\", \"a cottage with a porch\", \"a townhouse I can walk through\", \"add a second floor\", \"draw me the floor plans and elevations\", \"what would it take to frame this house\", \"plans and an FF&E schedule for a café\", \"a two-level mall I can walk\"",
  "entry": "mint_building",
  "form": "building"
}
---
→ `mint_building({ title, manifest: { seed, width, height, storeys: N, furnish: true } })` — the manifest is the recipe (`kind: 'floorplan'` may be left out); `rooms: [{ x, y, w, h, glyph }]` or `levels[]` author the plan. Its page is its structure book (a tab per concern). Four outcomes, a card each: Concept `house-concept`, Layout `house-livability`, Drawings `house-drawings`, Build `house-build`; ask its questions. `next` names what is open by outcome. Iterate with `update_sketch`; `export_model` ships it (`sheets`, `schedules`, `ifc`, `glb`). A store (`kind: 'store', card`), restaurant (`kind: 'restaurant', seed`) mall (`kind: 'mall', levels: 1 | 2`) or school (`kind: 'school-complex'`) mints the same way, read and graded as that building, its fit-out scheduled: card `building-commercial`. (Contrast: an institutional block for a world → `mint_solid` kind `edifice`; a city / cave → `compose_world`; a PICTURE of a facade → `sketch_what_possible` `architecturalConstruction`.) Full family → `get_creative_toolset({ form: 'building' })`.
