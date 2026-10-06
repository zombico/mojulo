---
{
  "id": "tangent-blowup",
  "name": "Tangent, escaping to infinity",
  "family": "math",
  "entry": "create_view",
  "summary": "A ready-to-mint trigonometry preset: the unit circle in tangent mode with the rider parked at θ ≈ 78.5° — the extended radius almost vertical, its tangent-line intercept streaking away, showing WHY tan blows up at 90°.",
  "when": "why tangent goes to infinity; tan 90 undefined; asymptote of the tangent function; show the unit circle's tangent line; what tangent actually measures"
}
---

A worked example over the unit-circle kind in its 'tangent' scenario, with
the marker radius parked at `angle: 1.37` rad (≈ 78.5°) — close enough to
90° that the extended radius runs nearly parallel to the tangent line and
the intercept shoots far up the screen. Nudge the angle in your head toward
90° and the intersection point runs off to infinity: that is the asymptote,
seen as geometry instead of a table of values.

This is a Door-1 recipe: pure params, nothing to load. Mint it as-is, or use
it as a starting point — drop `angle` to 0.79 (45°, tan = 1, the calm case)
for the before-picture, or switch `scenario` to 'sine' for the standard
height-becomes-wave opening.

## Recipe

See `recipe.json` beside this card — `kind: 'trig-circle'` with the params
above.

Pass the `kind` and `params` to the study-object mint. The full parameter
manual for the underlying kind is its own card (`id: 'trig-circle'`).
