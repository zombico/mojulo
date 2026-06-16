---
{ "id": "room-concept-interior", "name": "polygonizer.roomConcept — interior room contract", "summary": "first-class room planning contract: camera vector, room-local CCA, projected envelope, support plane, required pins", "when": "interior rooms where the whole room envelope is the subject — especially \"full frame\" room shots — and you need camera/envelope/support/pinned-roles resolved before visible skins are accepted", "tier": "render-primitive", "marks": [], "phase": "p1" }
---

`polygonizer.roomConcept` is the first-class room planning contract. Use it
for interior rooms where the whole room envelope is the subject, especially
"full frame" shots. It binds a predetermined camera vector, room-local CCA
space, projected room envelope, support plane, and required pinned roles
before visible skins are accepted.

## Shape

```
polygonizer.roomConcept = {
  kind: "interior-room",
  camera: {
    mode: "predetermined-vector",
    primitive: "two-point-straight-doorway" | <other two-point primitive>,
    subjectFraming: "full-frame-room"
  },
  pureMandala: { /* room layout, top-down */ },
  pinnedElements: [
    { role, anchor, mandalaSlot, ... }
  ],
  supportPlane: { ... }
}
```

## Required setup

For full-frame room interiors, do not hand-author a one-point room if the
straight doorway/two-point room grammar applies. Declare:

- `polygonizer.roomConcept.kind = "interior-room"`
- `camera.mode = "predetermined-vector"`
- `camera.primitive = "two-point-straight-doorway"` (or another two-point
  primitive)
- `camera.subjectFraming = "full-frame-room"`
- `polygonizer.pureMandala.room` plus `pinnedElements` for the required
  furniture/figures.

The room envelope is the subject frame; furniture is placed in room-local
coordinates and only projected after planning resolves.

## Camera window

For shot-constrained planning, include
`polygonizer.mandalaPatternLayer.cameraWindow` with two terminator vectors.
The planning goal is to fit required content between the left and right
terminator vectors in metamandala/top-down space, then project only that
solved wedge into visible marks.

## Composes with

- See `camera-two-point` for the matching `cameraPrimitive` primitive.
- See `metamandala-light` if room lighting is deterministic.
