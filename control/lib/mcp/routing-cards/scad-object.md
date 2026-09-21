---
{
  "id": "scad-object",
  "name": "Write a hard-edged part in OpenSCAD",
  "summary": "An OpenSCAD program as the recipe: exact booleans, sharp edges, modules and variables, meshed in-process.",
  "when": "\"write it in OpenSCAD\", \"a .scad of this\", \"a bracket / enclosure / flange / case with exact holes\", \"a machined part with sharp edges\", \"I have OpenSCAD code, bring it into mojulo\", \"CSG this\", \"difference() / hull() the parts\"",
  "entry": "mint_solid",
  "form": "object"
}
---
→ `mint_solid({ kind: 'scad', spec: { source, parts?, units?, movers? } })` — the OpenSCAD source IS the recipe, meshed on every read by OpenSCAD running in-process (WASM, pinned), served on the measured studio at `/world` + `/scene`, exported to `.glb` / engines / STL at true size, and handed back verbatim by `export_model format:'scad'`. `color()` is the tint; `parts: { name: 'module();' }` names render groups a `movers` hinge can swing. Reach for it when the edge must be SHARP (a bore, a chamfer, a slot: `difference()` is exact) or the part is naturally code (modules, loops, a parts table). Organic, blended, sculpted or noisy forms → the workbench's `fields` (`kind: 'workbench'`); a figure, creature, vehicle or building → its own kind. A toleranced / threaded mating part is still a B-rep tool's → `translate_modeler_lingo({ lingo: 'precision cad' })`. Read the contract first: `get_solid_vocab({ id: 'scad' })`. Full family → `get_creative_toolset({ form: 'object' })`.
