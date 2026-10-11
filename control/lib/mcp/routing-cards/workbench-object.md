---
{
  "id": "workbench-object",
  "name": "Render an everyday object or mechanical part",
  "summary": "One measured object at literal scale, built from lathes, extrudes, sweeps, lofts, shells and fields.",
  "when": "\"render/turntable a candlestick / bottle / dumbbell / vase / lamp\", \"block out an object in solids\", \"a mechanical part\", \"model a wheel / plate / spindle\", \"turn this concept image into a 3D object\"",
  "entry": "mint_solid",
  "form": "object"
}
---
→ `mint_solid({ kind: 'workbench', spec })`: a polygomer of lathes, extrudes, sweeps, lofts, shells and `fields` (bores, pockets, blends, sculpted bumps) → a measured object at `/world` + preset shots at `/scene`. Form accuracy over mood. Assemble finished parts into one worldspace → kind `assembler`. Rebuilding a COMPLEX object from a dreamed/concept image, segment by segment → `get_catalyst({ id: 'reconstruct-from-dream' })`. A spinning convex solid in CSS-3D → kind `solid-turntable`; a vehicle-family instance → kind `vehicle`. Materials-handling feasibility verdicts → `verify_machina`. A part whose value is its FIT (threads, toleranced holes, gears, an enclosure with screw posts) → kind `scad` and its `mj_*` library; which standard parts it takes → `fabricate_solid`. Only STEP, GD&T or a constraint solver is a B-rep handoff (`translate_modeler_lingo({ lingo: 'precision cad' })`). Manual: `get_solid_vocab({ id: 'workbench' })`. Full family → `get_creative_toolset({ form: 'object' })`.
