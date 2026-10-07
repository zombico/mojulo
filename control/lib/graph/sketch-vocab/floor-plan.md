---
{ "id": "floor-plan", "name": "floorPlan — a house in steps (index)", "summary": "index of the house cards: a walkable furnished house, apartment or room from a seed, built up in steps — layout, dwelling, storeys, construction, BIM — each with its own card", "when": "generating a whole multi-room building, house, apartment, or office floor plan, or one furnished room — start here or at house-layout, then read only the card for the step you are adding", "tier": "render-primitive", "marks": ["boxNet"], "phase": "p1" }
---

A house is one recipe that gains depth. Mint it with `mint_building({ title, manifest })`
(`create_sketch` with `kind: 'floorplan'` mints the same row); its reply's `next` names the steps
open from here and the card for each. Read only the card for the step you are adding:

| step | card | covers |
| --- | --- | --- |
| layout | `house-layout` | seed + footprint, explicit `rooms[]` and glyphs, one-room plans, `view` |
| dwelling | `house-dwelling` | `furnish`, furniture sizing and built pieces, your own `items`, finishes, pot lights, house styles |
| storeys | `house-storeys` | `storeys`, `levels[]`, stairs, the walkway `design` check |
| construction | `house-construction` | `framing` (system, stage, tradition, detail), `roof` covering, `drainage` |
| BIM | `house-bim` | `export_model` as IFC4, glTF, engine-lit |

```json
{ "seed": 7, "width": 40, "height": 30, "furnish": true, "view": "cutaway" }
```

Iterate with `update_sketch({ ref, patch })`; re-mint only for a side-by-side variant. A bespoke
institutional building is `mint_solid` kind `edifice`; a city or campus is `compose_world`.
