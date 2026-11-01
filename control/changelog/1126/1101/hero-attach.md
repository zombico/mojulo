### Worn objects of your own: anything made, worn on a bone

The hero wears what no catalogue has. `attach: [{ object | ref, at, … }]` on the hero door
(`control/lib/graph/polygonizer/hero-attach.js`) puts an object of the operator's own on a bone: a workbench recipe
inline (lathes, extrudes, sweeps, lofts, fields, shells, a program, cuts: the workbench's whole language), or a solid
already made with `mint_solid { kind: 'workbench' }` by its `ref`, copied in at the door so the hero stays its own recipe
(a later edit of the solid never moves it until the ref is set again). It is the protoform figure's attachment seam,
brought to the hero and carried the way held gear is.

- **Placed by words**: `at` a rig joint or a pair with `t` along it, riding the bone that starts there (or `bone` by id);
  `size` in metres along `fit`, or the object's own size; `anchor`, `rotate`, `align: 'bone'`, `offset`; `mirror: true`
  wears a reflected twin on the other side.
- **Carried everywhere gear is**: rigid on its bone at rest, so the stand, the clips, the rig preview and the skinned GLB
  carry it; the spend counts it with the gear; the readout's `hero.attach` names each object's bone, length and share of
  the figure's height. It layers over whatever the hero wears.
- **Refused clearly, never broken**: an attachment is checked at the door (one object or ref, a joint, the placing
  words; an object that draws nothing, or a ref that is not a workbench solid, is refused); at render a joint the rig lacks
  wears nothing. A hero without `attach` is byte for byte as it was. Manual: the layered card's `hero-attach` section.
