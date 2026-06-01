---
{ "id": "stacked-bar", "name": "Stacked bar", "summary": "compare a few categories, each split into sub-parts that sum to the bar", "when": "a handful of categories (days, channels, regions) where each total also breaks down by a second dimension; comparison + composition at once", "marks": ["rect", "line", "text"], "phase": "p1" }
---

A stacked bar is pure `rect` marks on a shared baseline, with `line` gridlines
and `text` labels. No parametric helper needed — you compute the segment
rectangles directly. Each bar is a stack of segments (one categorical color per
series) growing UP from the baseline.

## Marks
- gridlines: horizontal `line` marks at each tick, `stroke: "#1b2532"` (baseline `#2b3a4b`)
- y tick labels: `text` size 10, `fill: "#5f6b7a"`, `anchor: "end"`, right of the axis
- segments: `rect` per (bar × series), rx 3, one categorical color per series
- x labels: `text` size 11, `fill: "#93a1b1"`, `anchor: "middle"`, under each bar
- legend: a row of small `rect` swatch + `text` per series, top-right

## Layout math
- pick a plot box: left axis at `x0`, baseline at `yBase`, top at `yTop`; `H = yBase - yTop`
- `scale = H / maxTotal` (maxTotal = the largest bar's sum, rounded up to a tick)
- bars evenly across: `barX(i) = x0 + 20 + i*stride`, bar width 44–56, stride = width + ~46
- a segment of value `v` stacked above cumulative `c`: `{ y: yBase - (c+v)*scale, h: v*scale }`
- stroke each segment with the background (`#0b0f16`, 1–2px) only if segments touch and need separation

## Recommended categorical palette
teal `#14b8a6` · purple `#a855f7` · amber `#f59e0b` · blue `#3b82f6` (assign series in this order)

## Example (one bar at x 100, baseline 340, scale 1.0 — teal 120 / purple 80 / amber 40)
```json
{ "kind": "rect", "x": 100, "y": 220, "w": 56, "h": 120, "rx": 3, "fill": "#14b8a6" }
{ "kind": "rect", "x": 100, "y": 140, "w": 56, "h": 80,  "rx": 3, "fill": "#a855f7" }
{ "kind": "rect", "x": 100, "y": 100, "w": 56, "h": 40,  "rx": 3, "fill": "#f59e0b" }
{ "kind": "line", "x1": 80, "y1": 340, "x2": 610, "y2": 340, "stroke": "#2b3a4b" }
{ "kind": "text", "x": 128, "y": 360, "value": "Mon", "size": 11, "color": "#93a1b1", "anchor": "middle" }
```
