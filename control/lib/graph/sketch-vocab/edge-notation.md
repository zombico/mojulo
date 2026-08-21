---
{ "id": "edge-notation", "name": "Edge notation (typed heads / self-loops)", "summary": "typed arrowheads + endpoint labels + self-loops on edges and line/polyline marks — the notation ERD, UML, and state machines are built from", "when": "any diagram where the arrow END carries meaning — inheritance, aggregation/composition, ERD cardinality, a state self-transition, or a labeled from→to relationship", "marks": ["line", "polyline"], "phase": "p1" }
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
