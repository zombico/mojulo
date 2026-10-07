---
{
  "id": "two-branches",
  "name": "The slice that catches both cones",
  "family": "math",
  "entry": "create_view",
  "summary": "A ready-to-mint geometry preset: the conic-sections explainer in hyperbola mode — the cutting plane tilted steeply enough to pierce BOTH nappes of the double cone, so the two branches appear as one cut.",
  "when": "why a hyperbola has two branches; hyperbola from slicing a cone; the double cone and the cutting plane; conic sections demo for class; where the two arms come from"
}
---

A worked example over the conics kind in its 'hyperbola' scenario — the one
slice that answers the question every student asks: why does this curve come
in TWO pieces? Because the plane is tilted steeper than the cone's own side,
it cannot exit through one nappe; it runs on and cuts the mirror cone too,
and the two branches are simply the two intersections of one plane with one
double cone. Orbit the scene and the "two separate curves" merge into a
single geometric act.

This is a Door-1 recipe: pure params, nothing to load. Mint it as-is, or use
it as a starting point — play the scenarios in sequence (circle → ellipse →
parabola → hyperbola) as one lesson: the only thing that ever changes is the
tilt of the plane.

## Recipe

See `recipe.json` beside this card — `kind: 'conics'` with the params above.

Pass the `kind` and `params` to the study-object mint. The full parameter
manual for the underlying kind is its own card (`id: 'conics'`).
