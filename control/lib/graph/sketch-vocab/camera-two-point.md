---
{ "id": "camera-two-point", "name": "cameraPrimitive kind:\"two-point\"", "summary": "deterministic two-point camera with paired floor/ceiling perspective for adult-eye room shots", "when": "adult-eye room shots with paired floor/ceiling perspective, room interiors that need floor and ceiling grids, or any two-vanishing-point construction", "tier": "render-primitive", "marks": ["cameraPrimitive"], "phase": "p1" }
---

`cameraPrimitive.kind = "two-point"` plus `polygonizer.pureMandala` gives a
deterministic camera grammar for adult-eye room shots with paired
floor/ceiling perspective.

## Shape

```
cameraPrimitive{
  kind: "two-point",
  vanishingPoints: { left:[x,y], right:[x,y] },
  horizonY?,
  cropBox?,
  showFullMandala?
}
```

## Required setup

For room interiors that need floor and ceiling grids:

- Set `cameraPrimitive.kind = "two-point"`.
- Provide `vanishingPoints.left` and `vanishingPoints.right`.
- Provide `polygonizer.pureMandala.room` plus `pinnedElements`.
- When the prompt asks for a full room, pair this with
  `polygonizer.roomConcept` (see `room-concept-interior`) so Rendrant
  validates the projected room envelope and required pins as planning
  facts.

## Composes with

- `polygonizer.roomConcept` for full-frame room contracts.
- `polygonizer.pureMandala.room` for top-down room layout.
- `polygonizer.mandalaPatternLayer.cameraWindow` for terminator-vector
  wedge planning.

## Why not hand-author the perspective

A two-point room with paired floor/ceiling grids has many invisible
constraints (vanishing-point convergence, baseline, eye-line, support
plane). Declaring the primitive lets Rendrant validate them all at once
instead of catching errors mark-by-mark.
