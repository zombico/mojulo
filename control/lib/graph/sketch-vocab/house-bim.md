---
{ "id": "house-bim", "name": "House BIM and export — IFC4, glTF, engine-lit", "summary": "a house out of mojulo: IFC4 for Bonsai, Revit or ArchiCAD with storeys, spaces, walls, openings, slabs, the roof and (when framed) every member and circuit; or a GLB, unlit or engine-lit", "when": "exporting a house to BIM tools as IFC, to Blender / Godot / Unreal / three.js as glTF, or asking what a framed or drained house carries into the model", "tier": "render-primitive", "marks": [], "phase": "p1" }
---

## IFC — the house as a building model

`export_model({ ref, format: 'ifc' })` writes a house (with `storeys` or `levels`, card
`house-storeys`) as IFC4 for Bonsai, Revit or ArchiCAD: storeys, rooms as spaces, walls voided by
their openings with the doors and windows in them, slabs and the roof. A framed house (card
`house-construction`) carries every member as its section along its centreline, its linings,
boxes, cable and circuits, and its roof as built. A drained house's gutters and drains ride a
rainwater system (a framed house has them only in the `cutaway` view at the `frame` stage).
GlobalIds hold across re-exports.

## glTF and engines

`export_model({ ref })` writes a GLB of the walkable house (unlit vertex colours, as the World
draws it). `lit: true` adds real pbrMetallicRoughness materials so Blender, Godot, Unity and
three.js light it on import; pot lights (card `house-dwelling`) ride as `KHR_lights_punctual`
spots. The plan is authored in feet; the GLB root scales by `metersPerUnit` 0.3048 so an engine
walker reads the rooms at life size.
