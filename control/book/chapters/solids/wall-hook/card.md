---
{
  "id": "wall-hook",
  "name": "Wall hook (a part by name)",
  "entry": "mint_solid",
  "family": "object",
  "summary": "A screw-on wall hook printed at true size: a back plate with countersunk holes, an arm and an upturned lip, filleted inside. Name it and get one; give the reach, the width or the screw to fit it.",
  "when": "a wall hook; a coat hook; a hook for my keys / towel / headphones / bag; a hook that screws to the wall; print me a hook; a hook with a 50 mm reach; a hook for a 30 mm strap"
}
---

A recipe-book part: name it and the part's builder writes the OpenSCAD program from its params. Mint with
`kind: 'scad'` and `spec: { part: 'wall-hook', params? }`; every param has a default, so `{ part: 'wall-hook' }` alone
is a finished hook. The row stores the program beside `part` and `params`; patch `/params` to change it, and the
program is written again. A hand edit under `/source` detaches the row into a plain scad part.

## Params

| param | default | range | what it sets |
|---|---|---|---|
| `reach` | 40 | 15–120 mm | wall to the outer face of the lip; the opening is `reach − 2 × thickness` |
| `lip` | 14 | 0–60 mm | how far the tip turns up past the arm (0: a flat peg) |
| `width` | 20 | 10–80 mm | across the hook |
| `thickness` | 6 | 3–15 mm | the section of plate, arm and lip |
| `plate` | 60 | 30–180 mm | height of the back plate: two screws above 50 mm or so, one below |
| `screw` | `M4` | M3, M4, M5, none | countersunk ISO screws through the plate |

## Sizing the ask

- **A look:** `{ part: 'wall-hook' }`.
- **A fit:** name what it holds. A towel or a coat needs `reach` 45–60. For a strap or loop, the opening (`reach − 2 × thickness`) must clear it.
- **A function:** a coat or a bag loads the arm as a cantilever. Add `strength` (`{ material, checks: [{ element: 'cantilever', … }] }`, the scad card's `strength` section). The ladder names it once `ask` is `function`.

Print it lying on its side, the profile flat on the bed, so the layers run along the arm and the lip. Printed
standing, the arm breaks off between layers.
