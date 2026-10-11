---
{ "id": "floor-plan", "name": "floorPlan — a house in steps (index)", "summary": "index of the house cards: a walkable furnished house, apartment or room with its structure book; four outcome cards (concept, layout, drawings, build) and a manual per field", "when": "generating a whole multi-room building, house, apartment, or office floor plan, or one furnished room — start here or at house-layout, then read only the card for the step you are adding", "tier": "render-primitive", "marks": ["boxNet"], "phase": "p1" }
---

A house is one recipe that gains depth, read as its structure book. Mint it with
`mint_building({ title, manifest })`; its reply's `next` names what is open by outcome and the card
for each. Start from the outcome asked for, and ask that card's questions from zero:

| outcome | card | the question |
| --- | --- | --- |
| Concept | `house-concept` | what does it look like, and does it sit right |
| Layout | `house-livability` | does it live well |
| Drawings | `house-drawings` | can I show or hand this on |
| Build | `house-build` | can it be built, and what does it take |

The manuals, one per part of the recipe:

| part | card | covers |
| --- | --- | --- |
| layout | `house-layout` | seed + footprint, explicit `rooms[]` and glyphs, one-room plans, `view` |
| dwelling | `house-dwelling` | `furnish`, furniture sizing and built pieces, your own `items`, finishes, pot lights, house styles |
| storeys | `house-storeys` | `storeys`, `levels[]`, stairs, the walkway `design` check |
| construction | `house-construction` | `framing` (system, stage, tradition, detail), `roof` covering, `drainage` |
| BIM | `house-bim` | `export_model` as IFC4, glTF, engine-lit |

```json
{ "seed": 7, "width": 40, "height": 30, "furnish": true, "view": "cutaway" }
```

Every number in a house recipe is a plan coordinate in feet, as the plan card draws it: x east, y
south (N is the y0 wall), authored `cameras` and `walk.spawn` included. The World, the stills and
every export build the house north-up from them, the way round the plan reads.

Iterate with `update_sketch({ ref, patch })`; re-mint only for a side-by-side variant. An institutional
block for a world is `mint_solid` kind `edifice`; a city or campus is `compose_world`.
