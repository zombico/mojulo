---
{
  "id": "scad-object",
  "name": "Write a hard-edged part in OpenSCAD",
  "summary": "An OpenSCAD program as the recipe: exact booleans, sharp edges, modules and variables, meshed in-process.",
  "when": "\"write it in OpenSCAD\", \"a .scad of this\", \"a bracket / enclosure / flange / case with exact holes\", \"a threaded knob\", \"a wall hook\", \"a phone stand\", \"a box with a lid\", \"a machined part with sharp edges\", \"I have OpenSCAD code, bring it into mojulo\", \"CSG this\", \"difference() / hull() the parts\"",
  "entry": "mint_solid",
  "form": "object"
}
---
→ `mint_solid({ kind: 'scad', spec: { source | part, … } })`; a recipe-book `part` (a hook, a stand, a box) is named, not written — the OpenSCAD source IS the recipe, meshed on every read by OpenSCAD running in-process (WASM, pinned), served at `/world` + `/scene`, exported to `.glb` / engines / STL at true size and back verbatim as `format:'scad'`. `color()` is the tint; `parts: { name: 'module();' }` names render groups a `movers` hinge can swing. Reach for it when the edge must be SHARP (a bore, a chamfer, a slot: `difference()` is exact) or the part is naturally code (modules, loops, a parts table). Which standard parts it needs (bolts, bearings, seals) → `fabricate_solid`. Organic, blended, sculpted or noisy forms → the workbench's `fields` (`kind: 'workbench'`); a figure, creature, vehicle or building → its own kind. Threads, fits, gears, enclosures: its `mj_*` library; only STEP or GD&T → `translate_modeler_lingo({ lingo: 'precision cad' })`. Read the contract first: `get_solid_vocab({ id: 'scad' })`. Full family → `get_creative_toolset({ form: 'object' })`.
