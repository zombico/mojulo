---
{ "id": "swimlane-flow", "name": "Swimlane flowchart", "summary": "partition a flowchart into labeled actor lanes; stations auto-pin to their lane × column so you never hand-place boxes", "when": "a cross-functional process where WHO does each step matters — User | System | Store, Frontend | API | DB, a responsibility hand-off", "marks": ["rect"], "phase": "p1" }
---

Swimlanes are a MODIFIER on an ordinary station/edge flowchart: add `lanes[]` and
give each station a `lane` (+ optional `col`). The tool draws a labeled band per
lane (behind the flow) and pins each station's row to its lane and column — you
don't compute x/y.

## Manifest shape
```json
{
  "title": "Ask → Route → Persist → Reply",
  "lanes": [
    { "id": "user",   "label": "User" },
    { "id": "system", "label": "System" },
    { "id": "store",  "label": "Store" }
  ],
  "stations": [
    { "id": "ask",     "kind": "input",    "label": "Ask",     "lane": "user",   "col": 0 },
    { "id": "route",   "kind": "mcp_tool", "label": "Route",   "lane": "system", "col": 1 },
    { "id": "persist", "kind": "db_row",   "label": "Persist", "lane": "store",  "col": 2 },
    { "id": "reply",   "kind": "mcp_tool", "label": "Reply",   "lane": "system", "col": 3 }
  ],
  "edges": [
    { "from": "ask", "to": "route" },
    { "from": "route", "to": "persist" },
    { "from": "persist", "to": "reply" }
  ]
}
```

## How it lays out
- **lanes** — stacked top→down as full-width bands (alternating tint), labeled top-left.
- **`station.lane`** — pins the station's cross-axis (which band it sits in).
- **`station.col`** — 0-based position along the flow axis; advance `col` as the
  process moves forward. Omit ⇒ column 0.
- **edges** — routed by the normal edge router between the pinned stations.

## Notes
- `viewBox` is computed from the lanes + max column.
- A station with explicit `x/y` (no `lane`) keeps its own coordinates.
- Long cross-lane hops can graze an intervening box (the general edge-router
  limitation) — keep the column order monotonic with the flow.
