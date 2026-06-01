---
{ "id": "donut-ring", "name": "Donut / ring", "summary": "proportions of a whole — 2 to 6 segments; the ring center holds a headline stat", "when": "part-to-whole breakdown where the segments sum to 100%; pick ring (not pie) when you want a number in the middle", "marks": ["wedge", "text", "rect"], "phase": "p1" }
---

A donut is one `wedge` mark per segment sharing the same `cx`/`cy`/`r`/`rInner`.
**You never write arc paths** — the `wedge` mark takes `start`/`end` as
fractions of the circle (0–1, clockwise from 12 o'clock) and the renderer
computes the annular segment. A center `text` holds the headline; a legend
column sits to the right.

## Marks
- segments: one `wedge` per slice; `start`/`end` are the running cumulative fractions
- separators: give each wedge `stroke` = the panel/background color, `strokeWidth: 2`
- center value: `text` size ~30 weight 700 at (cx, cy), `anchor: "middle"`
- center caption: `text` size 11 at (cx, cy+22), `fill: "#5f6b7a"`, `anchor: "middle"`
- legend rows: `rect` swatch (14×14, rx 3) + label `text` + right-aligned percent `text`

## Layout math
- `cx, cy` = center of the ring zone; `r = min(zoneW, zoneH)/2 * 0.9`; `rInner = r * 0.6`
- cumulative fractions: start the first wedge at 0, each next `start` = previous `end`;
  `end = start + value/total`. The last wedge ends at 1.0.
- legend: `x = cx + r + 32`; rows stride 54px; swatch then label at +24, percent right-aligned

## Recommended categorical palette
teal `#14b8a6` · purple `#a855f7` · amber `#f59e0b` · blue `#3b82f6`

## Example (ring at cx 200 cy 200 r 130 rInner 78 — 42% / 28% / 18% / 12%)
```json
{ "kind": "wedge", "cx": 200, "cy": 200, "r": 130, "rInner": 78, "start": 0.00, "end": 0.42, "fill": "#14b8a6", "stroke": "#0b0f16", "strokeWidth": 2 }
{ "kind": "wedge", "cx": 200, "cy": 200, "r": 130, "rInner": 78, "start": 0.42, "end": 0.70, "fill": "#a855f7", "stroke": "#0b0f16", "strokeWidth": 2 }
{ "kind": "wedge", "cx": 200, "cy": 200, "r": 130, "rInner": 78, "start": 0.70, "end": 0.88, "fill": "#f59e0b", "stroke": "#0b0f16", "strokeWidth": 2 }
{ "kind": "wedge", "cx": 200, "cy": 200, "r": 130, "rInner": 78, "start": 0.88, "end": 1.00, "fill": "#3b82f6", "stroke": "#0b0f16", "strokeWidth": 2 }
{ "kind": "text", "x": 200, "y": 196, "value": "1,284", "size": 30, "weight": 700, "color": "#e6edf3", "anchor": "middle" }
```

For a **pie** (no hole), omit `rInner`. For a single full-circle stat, use one
wedge with `start: 0, end: 1`.
