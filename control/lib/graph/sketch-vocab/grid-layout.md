---
{ "id": "grid-layout", "name": "Grid layout", "summary": "place panels and tiles into named cells instead of hand-computing pixels — coherence by construction", "when": "any multi-panel board (KPI row + a chart + a flow); whenever 'make it look composed' matters more than freehand placement", "marks": ["rect"], "phase": "p1" }
---

The grid is the substrate that makes a board look professional without freehand
pixel math. Declare `grid` on the manifest, then give box-shaped marks (`rect`)
and `stations` a `cell` instead of `x/y/w/h`. The tool expands each `cell` to
pixel coords **before** validation, so the stored manifest is concrete.

In the sketch stack this is the baseline `depiction.display`: a full equal grid
with 1px panel borders. Other panel blocking paradigms grow out of it. Keep the
depiction metadata at the top level, then lower visible panel frames to ordinary
rect/line marks.

```json
"depiction": {
  "paradigm": "depiction",
  "mode": "related-physical-visual",
  "display": { "kind": "full-equal-grid", "panelCount": 4, "borderWidth": 1 },
  "panelBlocking": { "paradigm": "full-equal-grid", "eyeLine": "left-to-right, top-to-bottom" },
  "panels": [
    { "id": "p1", "concern": "scene", "constellation": "applies" },
    { "id": "p2", "concern": "detail", "constellation": "does-not-apply" }
  ]
}
```

This is the FP&A move: the analyst fills cells in a template, they don't redraw
the page. Reach for the grid first, then position chart marks (wedge/line/text)
in absolute coords *inside* the cell rect you laid down.

## Manifest shape
```json
"grid": { "cols": 12, "rows": 8, "gap": 16, "pad": 40 }
```
- `cols`/`rows` required; `gap` defaults 16, `pad` defaults 40 (outer margin)
- cell width = `(viewBox.width - 2*pad - (cols-1)*gap) / cols`; row height similarly

## Placing into cells
A `cell` on a `rect` or `station`:
```json
{ "col": 0, "row": 0, "colSpan": 4, "rowSpan": 2 }
```
- `col`/`row` are 0-based; `colSpan`/`rowSpan` default 1
- the tool computes `x/y/w/h` from the grid; raw `x/y/w/h` still works and WINS if both are given
- `cell` is only honored on box-shaped nodes (`rect`, `station`). Charts placed
  inside a cell use absolute coords — read the expanded rect's bounds and position within.

## Pattern: a board skeleton (12-col)
- header text spans the top; KPI tiles each take `colSpan: 4` across row 0
- a chart panel takes the lower-left (`col 0, row 2, colSpan 5, rowSpan 4`)
- a flow / second chart takes the lower-right (`col 5, row 2, colSpan 7, rowSpan 4`)

## Example (a panel rect spanning 5 cols, 4 rows from row 2)
```json
{ "kind": "rect", "cell": { "col": 0, "row": 2, "colSpan": 5, "rowSpan": 4 }, "rx": 14, "fill": "#0d121a", "stroke": "#1f2a37" }
```
