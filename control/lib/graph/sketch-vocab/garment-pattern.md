---
{ "id": "garment-pattern", "name": "recipe.kind = \"garmentPattern\"", "summary": "garment/textile authoring shorthand — blueprint, tartan, houndstooth, victorian wallpaper, mandala fabric", "when": "garment patterns, textile swatches, or fabric construction sheets where composition, repeat, alignment, and edge-to-edge cadence must be explicit before marks", "tier": "recipe", "marks": [], "phase": "p1" }
---

`recipe.kind = "garmentPattern"` is authoring shorthand. It lowers to
ordinary marks. For textile patterns, make composition, repeat spacing,
alignment, and edge-to-edge cadence explicit in `polygonizer` metadata.
**Never emit `tartan`/`houndstooth`/`wallpaper` as mark kinds.**

## Shape

```
recipe{
  kind: "garmentPattern",
  style?: "blueprint",
  patternKind: "blueprint"|"tartan"|"houndstooth"|"victorian wallpaper"|"mandala fabric",
  ...
}
```

## Pattern kinds

- `"blueprint"` — CAD-like sketch sheet for the garment pattern: 1px
  linework, dimension ticks, labels, scaled mandala coordinates.
- `"tartan"` — orthogonal stripe grids; declare the stripe set, sett
  count, and alignment to the swatch edge.
- `"houndstooth"` — paired notched-tooth glyph repeated on a regular grid;
  declare the tooth size and grid pitch.
- `"victorian wallpaper"` — repeating ornamental motif on a regular grid;
  declare the motif anchor, repeat spacing, and rotation.
- `"mandala fabric"` — symmetric mandala-based repeat; declare the
  rotational symmetry and tile size.

The compiler lowers each pattern to repeated polygon/line/rect marks. The
audit fields (`polygonizer.realityFacts`, `polygonizer.minimalAbstractions`)
stay intact so the construction reasoning is preserved.
