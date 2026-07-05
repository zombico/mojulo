---
{
  "id": "design-object-workbench",
  "name": "Design a measured object with the workbench",
  "summary": "Compose a single everyday object (candlestick, bottle, mug, dumbbell, box, phone case, labeled can) by bonding primitive solids — lathe (revolution), extrude (prism/shell), sweep (bent tube) — on a measured grid at literal real-world scale, then mint it with create_workbench.",
  "valueHook": "Turn 'a coffee mug' or 'a soda can with this label' into a real, orbitable 3D object study at literal scale — and a watertight, 3D-printable mesh.",
  "version": 1,
  "category": "object-design",
  "requires": { "protocols": [] },
  "parameters": [
    { "name": "objectIntent", "prompt": "What object are you designing? (e.g. 'a brass candlestick', 'a coffee mug', 'a 355mL soda can with a red label')" },
    { "name": "units", "prompt": "Real-world units for literal scale: cm | mm | in | ft (default cm)", "default": "cm" }
  ],
  "mcpTools": { "mojulo": ["create_workbench", "semantic_search"] },
  "outputContract": { "summary": "A minted workbench sketch ref + its /world (orbit) and /scene URLs, plus the monomer recipe used.", "fields": ["ref", "worldUrl", "stats"] }
}
---

# Design a measured object with the workbench

`create_workbench` is the OBJECT-scale sibling of `compose_world`'s `city` base: it renders ONE everyday
object on a measured grid at **literal real-world scale** (cm/in/ft), for form accuracy. The whole
discipline is: **model each object by the manufacturing process that makes it.**

## 1. Decompose the object into monomers (by process)

| monomer | process | makes |
|---|---|---|
| `lathe` | turning (revolution) | candlestick, bottle, vase, lamp, wheel, cup body, knob |
| `extrude` | extrusion / molding | box, slab, bracket (solid); tray, case, enclosure (+ `wallThickness`) |
| `sweep` | bending | mug/basket handle, frame, hook, cable, coil spring |

Worked decompositions:
- **mug** = a `lathe` cup body (a hollow profile) + a `sweep` C-handle (path embeds into the wall).
- **candlestick** = three `lathe`s stacked on one axis (foot + knopped stem + cup).
- **dumbbell** = a `lathe` bar + two `lathe` bells.
- **phone case** = one `extrude` rect profile + `wallThickness` + `openFace:'to'` (a recessed shell).
- **labeled can** = one `lathe` cylinder + a `wrap` (see §3).

## 2. Author each monomer (all coordinates resolved, z up)

- **lathe**: `{ axisFrom, axisTo, profile:[{t,radius}…] (t 0→1 along the axis), tint?, harmonics? }`.
  Ends at radius→0 self-close; ends with real radius get a flat cap. `harmonics` flute/thread.
- **extrude**: `{ profile:{ rect:{w,h,r?} } | { points:[[u,v]…] }, axisFrom, axisTo, wallThickness?,
  floorThickness?, openFace?, tint? }`. With `wallThickness` it becomes a recessed shell.
- **sweep**: `{ path:[[x,y,z]…] (≥2 pts), radius, sides?, tint?, caps? }`. Set `caps:false` when both
  ends embed in another monomer (a handle into a wall).

Bond monomers by literal placement of their axes/paths (the workbench has no walker). They may
overlap freely — the World's depth buffer resolves it.

## 3. Package design (label wrap)

A `lathe` can carry a `wrap` — a label mapped around its wall (a can/bottle/cup):
`wrap: { source: { svg:"<svg…>" | dataUrl:"data:…" | sketchRef:"sk_…" }, band?:{tFrom,tTo}, seam? }`.
A cylinder is a perfect developable surface → no distortion. The label shows in the `/world` view.
Tip: make a full-wrap label whose art includes the metal top/bottom so it reads like a real can.
Mint the label as a `create_sketch` first and pass its ref as `sketchRef` to keep provenance.

## 4. Mint + iterate

`create_workbench({ lathes:[…], extrudes:[…], sweeps:[…], units:'cm', title:'…' })` → returns a
`/sketches/<ref>/world` (free orbit) + `/scene` (preset turntable shots), at literal scale on a 5-unit
grid, plus a size/face stat readout. Re-mint with a new `ref` for a variant; designs are immutable.

## Pitfalls
- **Scale is literal** (unlike the abstract-scale world builders). Set `units` to match your reference.
- **No boolean cuts yet** — no true holes/slots. Plan the profile, or fake a cutout with a dark patch.
- **Grazing-angle z-fight** where two coaxial monomers run tangent (a dumbbell bar↔bell). The object
  is solid; weld/union is the deferred fix. Single + lightly-stacked objects never show it.
- For a WORLD asset (a prop at meru scale, not a measured object), use `design-world-asset` instead.
