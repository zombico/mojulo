---
{ "id": "box-net", "name": "boxNet — furniture/object as a 5-face sticker box", "summary": "a cuboid skinned with data face-cards (center + 4 cardinals), transparent elsewhere, legs at the planner's support pins, height in meru world-units", "when": "placing furniture, floor textiles, wall fixtures, or box-shaped room objects into a two-point room or scene — when you want a 3D piece projected in perspective from a simple placement spec rather than hand-built faces", "tier": "render-primitive", "marks": ["boxNet"], "phase": "p1" }
---

`boxNet` renders a furniture/object as a box-net: a cuboid skinned with sticker
"face-cards" on its five visible faces (center = top, plus front/back/left/right),
**transparent wherever a card doesn't paint** — so the legs at the support pins
show through. You give a placement spec; the room planner resolves the footprint,
support pins, and meru height, and the renderer embeds each face card in
perspective. It is the furniture twin of the vehicle face-net.

## Shape

```
boxNet{
  type,                 // "table" | "chair" | "cabinet" | "bed" | "sofa" | ...
  anchor:[u,v],         // placement on the surface, 0..1 (default [0.5,0.5])
  surface?,             // "floor" (default) | "backWall" | …
  w?, h?,               // footprint as fractions of the surface (else preset)
  heightWorld?,         // height in meru world-units (else preset)
  supportPattern?,      // "four-corner" | "block-corners" | "none" (legs)
  supportRadius?,       // leg radius in world units
  style?,               // "shaded" (default) | "flat" | "wireframe"
  role?, z?
}
```

## What it expands into

The planner places the element (footprint quad on the surface, top quad lifted by
`heightWorld`, support pins from `supportPattern`). Each face slot is skinned by a
data face-card (`band`/`rect`/`repeat`/`line`/`circle` parts in a normalized
(u,v) frame) and embedded onto the box face via the shared surface-quad embed,
then projected by the scene's two-point camera. Output is ordinary `polygon` /
`line` marks; legs are drawn at the support pins. A `table` paints only its apron
band, so the legs show through; a `cabinet` paints full faces and has no legs.

Registered base types: `rug`, `runner`, `table`, `standing-desk`,
`standingDesk`, `bed`, `sofa`, `bench`, `stool`, `chair`, `computer-chair`,
`computerChair`, `armchair`, `cabinet`, `bookshelf`, `rack-shelf`, `rackShelf`,
`rackShelves`, `dresser`, `nightstand`, `sideboard`, `window`, `door`,
`picture`, `sconce`.

## How to place it

- **Standalone:** declare a two-point `cameraPrimitive` (with `roomBasis`) and add
  `boxNet` marks. The camera + room basis position the box in world space.
- **In a room (preferred):** declare `polygonizer.roomConcept.elements` as an
  array of these specs — the room renderer synthesizes one `boxNet` per element,
  bound to the room's own basis, so furniture lands on the room's floor. The
  element array is the only thing that changes between an empty and a furnished
  room.

```json
"roomConcept": { "kind": "interior-room", "elements": [
  { "type": "table",   "anchor": [0.5, 0.6],  "heightWorld": 3.6 },
  { "type": "chair",   "anchor": [0.34, 0.74] },
  { "type": "standing-desk", "anchor": [0.70, 0.30] },
  { "type": "computer-chair", "anchor": [0.70, 0.43] },
  { "type": "rack-shelf", "anchor": [0.20, 0.36] },
  { "type": "sofa",    "anchor": [0.70, 0.42] },
  { "type": "window",  "surface": "backWall", "anchor": [0.55, 0.45] },
  { "type": "cabinet", "anchor": [0.22, 0.32], "supportPattern": "none" }
] }
```

## When to reach for it

- Furnishing a two-point interior (tables, standing desks, computer chairs,
  sofas, beds, cabinets, nightstands, repeated rack shelves, rugs, windows,
  doors, wall art, sconces).
- Any upright box-shaped object that should read in perspective from a placement
  spec rather than enumerated faces.

For a vehicle, use the vehicle face-net language instead. For the room envelope
itself (walls/floor/ceiling), see `room-concept-interior`. For the matching
camera, see `camera-two-point`. New furniture types/skins are added as data
face-cards (see the box-net plan); they don't require new mark kinds.
