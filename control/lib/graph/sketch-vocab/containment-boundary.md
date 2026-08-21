---
{ "id": "containment-boundary", "name": "Containment / C4 boundary", "summary": "wrap a group of stations in an auto-sized labeled dashed box — 'these live inside this boundary'", "when": "showing a system boundary or grouping — a C4 container, a trust / deployment / process boundary, services inside a control plane, what's local vs external", "marks": ["rect"], "phase": "p1" }
---

A boundary wraps a set of stations in a labeled dashed box, auto-sized to its
members. Add a `boundaries[]` array naming the member station ids — the tool
computes the bounding box + padding and draws the box behind them. You never
size the box by hand.

## Manifest shape
```json
{
  "title": "Control plane topology",
  "stations": [
    { "id": "mcp",   "kind": "mcp_tool",   "label": "MCP server",    "x": 100, "y": 120, "w": 150, "h": 56 },
    { "id": "reg",   "kind": "filesystem", "label": "Tool registry", "x": 300, "y": 120, "w": 150, "h": 56 },
    { "id": "db",    "kind": "db_row",     "label": "SQLite",        "x": 200, "y": 220, "w": 150, "h": 56 },
    { "id": "agent", "kind": "input",      "label": "Host agent",    "x": 600, "y": 160, "w": 150, "h": 56 }
  ],
  "edges": [{ "from": "agent", "to": "mcp", "label": "stdio/http" }],
  "boundaries": [
    { "label": "Control plane (localhost)", "contains": ["mcp", "reg", "db"] }
  ]
}
```

## Fields
- **`contains`** — station ids to wrap (must already have resolved coords: explicit
  `x/y`, or a `lane`/`cell`). The box is their bbox + padding.
- **`label`** — drawn top-left inside the box (optional).
- **`style`** — optional `{ fill?, stroke?, dash? }` override; default is a faint
  fill + a dashed neutral stroke.

## Notes
- Members outside the boundary (e.g. an external `agent`) just sit outside it; an
  edge crossing in reads as the boundary interface.
- Boundaries only ADD a background box — they never move a station, so they compose
  with `grid-layout` and `swimlane-flow` placement.
- Nesting: declare an inner boundary with a subset of members; author outer-first.
