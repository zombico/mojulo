---
{ "id": "mark-primitives", "name": "Mark primitives & stations", "summary": "the flat 2D vocabulary every sketch lowers to — rect / circle / wedge / line / polyline / polygon / text marks, their style fields, and flow-chart stations", "when": "a flow chart from just boxes and arrows (auto-placed), or hand-building a chart, board or any drawing out of raw marks or boxes-and-arrows; checking a mark's fields, units or defaults", "tier": "mark", "marks": ["rect", "circle", "wedge", "line", "polyline", "polygon", "text"], "phase": "p1" }
---

Coordinates are viewBox pixels, y down. A diagram manifest needs `title` and at
least one of `stations[]` / `marks[]`, plus `viewBox { width, height }` unless
its stations are auto-placed. Prefer a higher-level door when one fits, so you
are not placing pixels by hand: auto-placed stations (below), `grid` + `cell`
(`grid-layout`), `lanes[]` (`swimlane-flow`), `kind: 'sequence'` / `'gantt'`, or
a chart card (`stacked-bar`, `donut-ring`, `stat-tile`).

## Marks
| kind | required | optional (default) |
|---|---|---|
| `rect` | `x,y,w,h` — or `cell` + top-level `grid` | `rx` (0) |
| `circle` | `cx,cy,r` | |
| `wedge` | `cx,cy,r,start,end` (`end ≥ start`) | `rInner` (none = pie slice; > 0 = ring segment) |
| `line` | `x1,y1,x2,y2` | `stroke` (#5f6b7a), `strokeWidth` (1), `head`/`tail` |
| `polyline` | `points: [[x,y],…]` (≥ 2) | `stroke` (#5f6b7a), `strokeWidth` (2), `closed` (fill only when true), `head`/`tail` |
| `polygon` | `points` (≥ 3), always closed | `strokeWidth` (0) |
| `text` | `x,y,value` | `size` (13), `weight` (400), `anchor` (`start` · `middle` · `end`), `color` (falls back to `fill`), `family` (`'mono'`, else sans) |

`wedge` `start`/`end` are **fractions 0–1 of the circle, clockwise from 12
o'clock**; a span of ~1 draws a full disc or ring. `head`/`tail` kinds are in
`edge-notation`.

## Style fields (any mark)
`fill`, `stroke` (unset = none unless the table says otherwise), `strokeWidth`,
`opacity`, `dash` (an SVG dasharray, e.g. `"4 4"`), `blend` (CSS mix-blend-mode),
`blur` (px), `elevate: true` (drop shadow), `z` (paint order, ascending, shared
with stations — `z-layering`), `role` (a name later marks can target). Text takes
only `opacity` of these.

## Stations (boxes for flow charts)
`{ id, kind, label, sublabel?, items?: [string], x,y,w,h | cell, z? }`.
**Leave the position out on every station and they are auto-placed**: ranked
along the edges (a cycle's back edge doesn't set a rank), ordered to keep edges
short, sized to their text (a station's own `w`/`h` win), with the viewBox fitted
(a given one only grows). `layout: { direction: 'LR' }` (the default: ranks are
columns) or `'TB'` (rows). Edges that would cross a box are routed round it
(`via` + `channel`); an edge with its own `via` / `curvature` is left alone. Place
one station and you place them all: then give `x,y,w,h` or a grid `cell` (or
pin them with `lanes[]`). `kind` is one of `input` · `mcp_tool` · `filesystem` · `db_row`; pick
the closest fit — `mcp_tool` for any callable / process, `filesystem` for
files / payloads / messages in motion, `db_row` for durable records, `input` for
parameters / preconditions. `items` are bullet rows inside the box. Connect
stations with `edges[] { from, to, label? }` (`label` is the verb: "writes",
"reads", "triggers"); routing around boxes and typed heads are in `edge-notation`.

## Example (auto-placed: no coordinates, no viewBox)
```json
{
  "title": "Ingest",
  "stations": [
    { "id": "upload", "kind": "input", "label": "Upload" },
    { "id": "parse", "kind": "mcp_tool", "label": "Parse", "items": ["csv", "json"] },
    { "id": "validate", "kind": "mcp_tool", "label": "Validate" },
    { "id": "rows", "kind": "db_row", "label": "rows" }
  ],
  "edges": [
    { "from": "upload", "to": "parse", "label": "sends" },
    { "from": "parse", "to": "validate" },
    { "from": "validate", "to": "rows", "label": "writes" },
    { "from": "upload", "to": "rows", "label": "fast path" }
  ]
}
```
A chart is still placed by hand, in a viewBox:
```json
{ "title": "Share", "viewBox": { "width": 240, "height": 240 }, "marks": [
  { "kind": "wedge", "cx": 120, "cy": 120, "r": 90, "rInner": 56, "start": 0, "end": 0.7, "fill": "#5eead4" },
  { "kind": "text", "x": 120, "y": 126, "value": "70%", "size": 18, "weight": 600, "anchor": "middle" }
] }
```
See also: `construction-marks` (shapes that lower to these), `grid-layout`, `edge-notation`, `z-layering`.
