---
{ "id": "construction-marks", "name": "Construction marks (round, solid, shaded)", "summary": "volumetric shorthand marks — blob / sphere / oval / egg / cylinder / volume cup / form / plane / solid / partition / array / presets — that Rendrant expands into flat polygons before storage, plus sticker shading, gesture placement and perspective", "when": "drawing an object, figure or still life out of shapes rather than flat boxes: a shaded ball, a cup, a crate, a bookshelf, a body blocked in from blobs along a gesture, boxes in one-point perspective", "tier": "mark", "marks": ["blob", "sphere", "oval", "egg", "cylinder", "volume", "form", "plane", "solid", "partition", "array", "planePreset", "solidPreset", "object"], "phase": "p1" }
---

These marks are shorthand. At mint, Rendrant lowers each one to plain
`polygon` / `polyline` / `line` marks (`mark-primitives`), so the stored sketch holds
only flat marks. Coordinates are viewBox pixels, y down, `rotation` in radians.
Before drawing a scene or figure by hand, check whether a recipe family already
covers it (`sketch_what_possible`).

## Round shapes
Position is `anchor: [x,y]` (or `cx, cy`).
- **`blob`**: `rx` (24), `ry` (= rx), `rotation` (0), `wobble` (0.04, max 0.22), `points` (32).
  Instead of an anchor it can take `gestureT` (0–1) along the top-level `gesture`
  (see below). `offset: [lateral, along]` nudges it in the gesture's frame.
- **`sphere`**: `r` (28). **`oval`**: `r`, flattened to ry = 0.72·r.
- **`egg`**: `rx` (32), `ry` (46), `rotation`. It is narrower at the top.
- **`cylinder`**: `rx` (or `r`, or `width/2`, where width defaults to 64), `height` (120), `depth` = cap ry (rx·0.34).
  **The top is closed by default**; `openTop: true` only for an intentional tube.
- **`volume`**: `{ primitive: 'cup', anchor, height (160), rimWidth (124), footWidth (0.56·rim), wallThickness, rings (12) }`.
  A hollow tapered ring-stack cup, open at the top. Prefer it over a cylinder for cups and vases.

## Boxes and repeats
- **`solid`**: `{ x, y, width (80), height (80), depth (40), depthOffset?, faces? }`. One cuboid,
  projected into filled face polygons. `faces` picks a subset of `front back left right top bottom`.
  A role like `tower` / `building` / `facade` hides the back and bottom faces automatically.
- **`partition`**: `{ target: '<role of an earlier solid>', axis: 'y', count, thickness? }`. Splits that
  solid into shelf boards. The target must come earlier in `marks[]`.
- **`array`**: `{ role, count, from: [x,y], to: [x,y], upperFrom?, upperTo?, item: { kind: 'line' | 'solid', … } }`.
  Repeats lines (fence posts, hatching) or solids along a path.
- **`plane`**: either `{ anchor, length (80), width (20), axis ([0,1]) }` or `{ points }`. A flat slab.
- **`cubieLattice`**: has its own card (`cubie-lattice`).
- **`planePreset`** / **`solidPreset`**: `{ ref: 'bookshelf', anchor, w, h, depth?, shelves? }`. A bookshelf
  is the only preset. **`object`**: `{ ref: 'bookshelf-wireframe' }` is legacy wireframe.

## Figures
**`form`**: `{ mode, stock, anchor, scale (1), massTuning, speciesStock? }`. A body stock blocked in from
blobs and solids.
- `stock` must be set: `'bipedal'` (with `mode: 'animated'`), `'full-body-dummy'`, `'lower-body-dummy'` or
  `'plane-object'`.
- `massTuning`: `lean` · `fit` (the default) · `stocky` · `soft` · `slightly-obese`.
- For a real character, use `mint_solid` or a figure recipe instead.

## Sticker painting (shade + highlights)
A closed polygon, blob, sphere, oval, egg, plane or cylinder can be lit:
`shade: { algorithm: 'form-light-stack', intensity? (1) }`, and separately
`highlights: { algorithm: 'form-light-stack', intensity? (0.35) }`. Setting `shade` does not turn on
highlights; set both. The legacy names `convex-value-stack` (shade) and `simple-highlight` (highlights)
still work.

A lit shape:
- loses its stroke;
- gets a default fill;
- is auto-ordered in `z` if it has none;
- casts onto its neighbours (`scene.interBlobShadows: false` turns that off).

The light comes from `scene.light.direction` (default `[-0.6,-0.8]`). `scene.ground.y` adds a ground shadow.

## Placement and camera (top level of the manifest)
- **`gesture: { kind?, points: [[x,y],…] }`**: a line of action. A mark with `gestureT` sits at that
  fraction of the gesture's length and takes its rotation from the tangent.
- **`scene.perspective: { mode: 'one-point', vanishingPoint: [x,y], horizonY?, depthScale? (240) }`**:
  locks solid depth edges to the vanishing point. Without it, solids use a parallel oblique projection.
- **`polygonizer.pureMandala` + `cameraPrimitive: { kind: 'two-point', … }`**: a two-point room
  projection. See `camera-two-point`.

## Example (a lit cup on a crate)
```json
{
  "title": "Cup on crate", "viewBox": { "width": 480, "height": 400 },
  "scene": { "light": { "direction": [-0.6, -0.8] } },
  "marks": [
    { "kind": "solid", "role": "crate", "x": 150, "y": 220, "width": 180, "height": 110, "depth": 60 },
    { "kind": "volume", "primitive": "cup", "anchor": [240, 170], "height": 90, "rimWidth": 80 },
    { "kind": "sphere", "anchor": [360, 196], "r": 24, "fill": "#e07a5f",
      "shade": { "algorithm": "form-light-stack" }, "highlights": { "algorithm": "form-light-stack" } }
  ]
}
```
See also: `mark-primitives`, `cubie-lattice`, `blob-pla`, `camera-two-point`, `organ-form`.
