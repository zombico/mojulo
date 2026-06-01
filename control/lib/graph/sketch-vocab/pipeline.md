---
{ "id": "pipeline", "name": "Flow / pipeline", "summary": "boxes and arrows — a workflow, data flow, decision chain, or architecture", "when": "the structure is a sequence or graph of steps connected by directed actions; 'how does X work', 'what flows where'", "marks": [], "phase": "p1" }
---

The original sketch vocabulary: typed `stations` (boxes) connected by directed
`edges` (labeled arrows). This is the right tool when the answer is a *flow*, not
a *quantity*. Stations and the chart `marks` can coexist in one manifest — a flow
on one side of a grid, a chart on the other.

## Station kinds (style only — pick the closest fit)
- `input` — dashed neutral: a user, agent, external system, parameter, precondition
- `mcp_tool` — teal accent: a callable / API / function / black-box process
- `filesystem` — slate: a file, message, payload, queue item — data in motion
- `db_row` — purple: a durable record, persistent state, config

Each station: `{ id, kind, label, sublabel?, items?, x, y, w, h }` (or a `cell`
instead of x/y/w/h when a `grid` is declared).

## Edges
`{ from, to, label?, via?, curvature? }` — `label` is a lowercase verb
("writes", "reads", "triggers"). The default is an S-curve between the two boxes.
If a straight line would pierce a third station, set `via` to the side to route
around (`right`/`left` for vertical lanes, `top`/`bottom` for horizontal).
`curvature` (0.2–3) swoops (>1) or flattens (<1) the default curve.

## Layout patterns
- left→right pipeline: single lane, 3–5 stations, even x stride
- two-lane vertical: parallel branches, left lane + right lane (the /graph shape)
- hub-and-spoke: one central station, satellites around it
- top-down stack: layered architecture (UI → API → DB)

## Example (two stations + an edge)
```json
{ "id": "user", "kind": "input", "label": "User", "x": 24, "y": 60, "w": 200, "h": 90 }
{ "id": "bot",  "kind": "mcp_tool", "label": "Triage bot", "x": 320, "y": 60, "w": 200, "h": 90 }
edge: { "from": "user", "to": "bot", "label": "asks" }
```
