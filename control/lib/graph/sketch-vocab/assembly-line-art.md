---
{ "id": "assembly-line-art", "name": "Assembly line art (exploded isometric)", "summary": "IKEA-style furniture-assembly diagram grammar — stroked-only rect/line/polygon marks on a shared 30°/150°/up isometric axis, parts pulled apart along parallel explosion vectors with dashed alignment guides, hardware (screws/dowels/cam locks) drawn at fixed glyph sizes, zero fill", "when": "instruction-manual / assembly-step / how-to-build / exploded-view diagrams: show how flat-pack parts fit together, an exploded view of a shelf, frame, cabinet or device, an 'insert dowel A into hole B' step, a tools-and-hardware inventory plate, any line-only single-perspective technical assembly illustration", "tier": "mark", "marks": ["rect", "line", "polygon", "polyline", "circle"], "phase": "p1" }
---

This card is a **drawing grammar**, not a parts catalog. An assembly diagram
reads when every part sits on one shared isometric grid, the explosion vectors
are parallel, and the only ink is line — no fill, no shading, no color. These
three rules are non-negotiable; the specific furniture doesn't matter.

## The isometric frame (do this first)

Pick ONE axis triad and never deviate inside a diagram. Working in screen space
(y grows downward):

- **right edge** runs at +30° below horizontal → unit vector `rAxis = (0.866, 0.5)`
- **left edge** runs at +150° (−30° mirrored) → `lAxis = (-0.866, 0.5)`
- **vertical edge** runs straight up → `up = (0, -1)`

Every board is three parallelograms (a visible top + two visible sides). For a
board of size `W × D × T` (W along rAxis, D along lAxis, T along up) anchored at
corner `P`:

```
right face : P, P + W·rAxis, P + W·rAxis + T·up, P + T·up
left  face : P, P + D·lAxis, P + D·lAxis + T·up, P + T·up
top   face : P + T·up, +W·rAxis, +W·rAxis + D·lAxis, +D·lAxis
```

Render each face as a `polygon` with `fill: "none"`, `stroke: "#1a1a1a"`. Weight
the ink so the form reads: outer silhouette edges heavier (`strokeWidth: 3`),
interior seam edges lighter (`strokeWidth: 1.25`). **Never fill** — fill kills
the blueprint read instantly.

## Explosion (the "pulled apart" look)

1. Establish ONE **assembly axis** for the step — usually `up` for stacking, or
   one horizontal axis for a sliding/dowel join.
2. Offset each part's anchor by `k · axis`, with `k` growing in stacking order:
   part 0 at 0, part 1 at `+gap`, part 2 at `+2·gap`. Use
   `gap ≈ 0.4 × the largest part dimension` so parts read as clearly separated
   but obviously aligned.
3. Draw a **dashed alignment guide** from each part's join point to the mating
   part's join point, ALONG the explosion axis — a `line` with
   `"stroke-dasharray": "4 4"`, `strokeWidth: 1`, `stroke: "#9a9a9a"`. These
   guides are what tell the viewer "this goes there."
4. Put a small **motion arrowhead** (a 2-segment `polyline`) at the moving end of
   one guide per part, pointing toward the seated position.

## Hardware & callouts (fixed glyph sizes)

Hardware is drawn at a CONSTANT on-canvas size regardless of part scale, so a
dowel reads the same on every page:

- **dowel**: a `rect` ~6×26px on the insert axis (round the ends with two short
  `line` caps), or a thin parallelogram if you want it on the iso axis.
- **screw**: a vertical `line` shaft (~22px) + 3–4 short diagonal thread ticks +
  a `circle` r≈4 head.
- **cam lock**: `circle` r≈8 with one chord `line` (the slot).
- **callout bubble**: `circle` r≈11, `stroke: "#1a1a1a"`, `fill: "none"`, with a
  centered `text` label (the part letter/number) and a leader `line` to the part.

## Page composition math

- Reserve a **6% margin** all sides. Compute the post-explosion bounding box,
  then fit it into the central 88% with a single uniform scale
  `s = min(innerW / bboxW, innerH / bboxH)`.
- Author **stroke widths in screen px, not scaled** — compute geometry in model
  units, apply `s`, but keep strokes at the target px so thin parts don't vanish.
- One diagram = ONE step's worth of parts: typically 2–5 boards + ≤6 hardware
  glyphs. More than that and you've drawn two steps; split them.
- Assembly diagrams are mostly white. If the page looks busy, you've over-drawn.

## Worked fragment (two boards + a dowel join, exploded along `up`)

```json
{ "kind": "polygon", "points": "120,260 268,346 268,300 120,214", "fill": "none", "stroke": "#1a1a1a", "strokeWidth": 3 }
{ "kind": "polygon", "points": "120,160 268,246 268,200 120,114", "fill": "none", "stroke": "#1a1a1a", "strokeWidth": 3 }
{ "kind": "line", "x1": 194, "y1": 230, "x2": 194, "y2": 188, "stroke": "#9a9a9a", "strokeWidth": 1, "stroke-dasharray": "4 4" }
{ "kind": "rect", "x": 191, "y": 196, "width": 6, "height": 26, "fill": "none", "stroke": "#1a1a1a", "strokeWidth": 2 }
{ "kind": "circle", "cx": 300, "cy": 205, "r": 11, "fill": "none", "stroke": "#1a1a1a", "strokeWidth": 1.5 }
{ "kind": "text", "x": 300, "y": 205, "text": "A", "fontSize": 12, "textAnchor": "middle" }
{ "kind": "line", "x1": 289, "y1": 205, "x2": 200, "y2": 209, "stroke": "#1a1a1a", "strokeWidth": 1 }
```

The lower board sits seated; the upper board is exploded `+gap` along `up`; the
dashed guide and dowel glyph show the join; bubble "A" calls out the dowel.

The art quality is a first draft to refine later — but the **shared isometric
axis triad, parallel explosion vectors, and stroke-only ink** are what make a
drawing read as an assembly diagram rather than a generic sketch. Get those
right before adding detail. Pairs with [[compositional-balance]] when a plate
needs its mass checked.
