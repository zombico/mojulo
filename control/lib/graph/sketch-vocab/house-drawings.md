---
{ "id": "house-drawings", "name": "House drawings — a set to show or hand on", "summary": "the Drawings outcome of a house: a dimensioned NCS set (site, plans, elevations, a section, door, window, room and object schedules) as SVG sheets, and every schedule as CSV and JSON; what opens each sheet", "when": "someone wants plans, elevations, sections, schedules or a drawing set of a house, to print, show or hand to someone; or a mint_building `next` names outcome 'drawings'", "tier": "render-primitive", "marks": [], "phase": "p1" }
---

**Drawings** answers *can I show or hand this on*. The structure book's Elements tab, and every
sheet at drawing grade, in NCS order: C (civil), S (structural), A (architectural), P
(plumbing), E (electrical). A discipline appears only when the recipe has it.

## From zero, ask

1. **Which drawings?** Plans, elevations and a section each way come with any house, dimensioned
   in feet and inches. The site plan needs `perimeter: true`.
2. **For whom?** A client reads the A-sheets; a builder wants the S-, P- and E-sheets too (outcome
   `house-build`).

## What opens each sheet

- **A-10x** plans, one per storey; **A-20x** elevations; **A-301** sections, both ways; **A-60x**
  schedules (doors, windows, rooms, wall types, objects): any house.
- **C-101** site: `perimeter: true`.
- **S-10x** framing plans and **E-10x** electrical plans: `framing`.
- **P-101** roof drainage: `drainage: true`.

## Getting them out

- `export_model({ ref, format: 'sheets' })` writes one SVG per sheet and an index.
- `export_model({ ref, format: 'schedules' })` writes every table as CSV, and all of them as JSON.
- The book itself is the house's dashboard page, downloadable as one HTML file.

```json
{ "seed": 7, "storeys": 2, "windows": true, "perimeter": true, "furnish": true }
```

## Laws

- Every sheet is a projection of the recipe; nothing is stored, so a sheet follows every edit.
- The sheets are advisory drawings, not an engineered design.

Next outcome: can it be built, `house-build`.
