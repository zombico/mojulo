---
{ "id": "stat-tile", "name": "KPI / stat tile", "summary": "a big headline number with a caption and a trend delta, in a card", "when": "one or a few standalone metrics to feature — totals, counts, rates; the 'top of the dashboard' numbers", "marks": ["rect", "text"], "phase": "p1" }
---

A KPI tile is the cheapest, highest-leverage paradigm: a panel `rect`, a left
accent bar `rect`, a caption `text`, a big value `text`, and a small delta `text`.
Lay several in a row on a grid (see the `grid-layout` card) so they read as a set.

## Marks (per tile)
- panel: `rect` rounded (rx 14), `fill: "#0e141c"`, `stroke: "#1f2a37"`
- accent: thin `rect` (w 5, rx 2.5) flush to the panel's left edge — one categorical color
- caption: `text` size 12, `fill: "#5f6b7a"`, near the top
- value: `text` size ~38 weight 700, `fill: "#e6edf3"`, the headline number
- delta: `text` size 13 — green `#22c55e` up, rose `#f43f5e` down, muted `#5f6b7a` flat

## Layout math (tile of w×h, top-left at x,y)
- accent: `{ x, y, w: 5, h }`
- caption baseline: `y + 34`, value baseline: `y + 80`, delta baseline: `y + 106`
- all text x = `x + 22`
- a tile reads well at w 200–290, h 120–140; in a row, stride = w + 25

## Recommended categorical palette
teal `#14b8a6` · purple `#a855f7` · amber `#f59e0b` · blue `#3b82f6` · rose `#f43f5e` · green `#22c55e`

## Example (one tile at 40,90 — 290×120)
```json
{ "kind": "rect", "x": 40, "y": 90, "w": 290, "h": 120, "rx": 14, "fill": "#0e141c", "stroke": "#1f2a37" }
{ "kind": "rect", "x": 40, "y": 90, "w": 5, "h": 120, "rx": 2.5, "fill": "#14b8a6" }
{ "kind": "text", "x": 62, "y": 124, "value": "Conversations", "size": 12, "color": "#5f6b7a" }
{ "kind": "text", "x": 62, "y": 170, "value": "1,284", "size": 38, "weight": 700, "color": "#e6edf3" }
{ "kind": "text", "x": 62, "y": 196, "value": "▲ 12.4% this week", "size": 13, "color": "#22c55e" }
```
