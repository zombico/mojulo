---
{ "id": "edge-notation", "name": "Edge notation (typed heads / self-loops)", "summary": "typed arrowheads + endpoint labels + self-loops + side-channel routing (via / curvature) on edges and line/polyline marks — the notation ERD, UML, and state machines are built from", "when": "an arrow cuts through a box and needs to route around it, or any diagram where the arrow END carries meaning — inheritance, aggregation/composition, ERD cardinality, a state self-transition, or a labeled from→to relationship", "marks": ["line", "polyline"], "phase": "p1" }
---

The default edge is a single filled arrow. To say something with the *ends* —
UML inheritance, ERD cardinality, a state self-loop — set a typed `head` (the
`to`-end) and/or `tail` (the `from`-end). The renderer lowers each to an SVG
marker; nothing to draw by hand.

## Head/tail kinds
`arrow` (default) · `triangle-open` (UML inheritance) · `diamond` (aggregation) ·
`diamond-filled` (composition) · `crowsfoot-one` / `crowsfoot-many` (ERD "one" /
"many") · `dot` (bullet / pseudostate) · `none`.

## Where it applies
- **`edges`** — `{ from, to, head?, tail?, dashed?, label?, fromLabel?, toLabel? }`.
  `label` is centered on the edge; `fromLabel`/`toLabel` pin at each end (ERD
  multiplicities like `1` / `0..*`). `dashed:true` for a dependency / return.
- **`line` / `polyline` marks** — the SAME `head`/`tail` on an absolute-coordinate
  line, when you need an arrow that isn't between two stations. The head paints in
  the line's own `stroke` color.

## Routing (`via`, `curvature`)
The default edge is an S-curve between the two stations. It is fine when the
straight line is clear, but it slices through any station sitting between the
endpoints.
- **`via: 'right' | 'left' | 'top' | 'bottom'`** exits the source on that side,
  runs along a channel just outside both stations' extents on that side, and
  re-enters the target from the same side. Pick the side opposite to whatever is
  in the way: `right`/`left` for a vertical lane (an edge skipping stations stacked
  vertically), `top`/`bottom` for a horizontal lane.
- **`curvature`** (0.2–3, default 1) multiplies the S-curve's control-point
  offset: > 1 swoops harder to clear territory near the straight line, < 1
  flattens toward straight (good for a short hop where a tight S looks awkward).
  Ignored when `via` is set.

```json
"edges": [
  { "from": "ingest", "to": "archive", "via": "right", "label": "skips review" },
  { "from": "a", "to": "b", "curvature": 0.4 }
]
```

## Self-loop
An edge with `from === to` draws a real loopback off the top of the box (a state
self-transition / "retry"). No extra fields.

## Example (a UML is-a + an ERD 1→many + a self-loop)
```json
"edges": [
  { "from": "child", "to": "parent", "head": "triangle-open", "label": "is-a" },
  { "from": "user", "to": "order", "head": "crowsfoot-many", "tail": "crowsfoot-one", "fromLabel": "1", "toLabel": "0..*" },
  { "from": "deployed", "to": "deployed", "head": "arrow", "label": "redeploy" }
]
```
```json
"marks": [{ "kind": "line", "x1": 40, "y1": 60, "x2": 200, "y2": 60, "stroke": "#5eead4", "tail": "dot", "head": "arrow" }]
```
See also: `erd-entity`, `sequence-diagram` (both build on this).
