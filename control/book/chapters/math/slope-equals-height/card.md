---
{
  "id": "slope-equals-height",
  "name": "The curve that is its own slope",
  "family": "math",
  "entry": "create_view",
  "summary": "A ready-to-mint calculus preset: the derivative explainer parked on f = eˣ at x = 1 — the one curve whose tangent slope always equals its own height, watched as the secant fan collapses onto the tangent.",
  "when": "why e is special; the function that is its own derivative; show my student what makes eˣ different; a derivative demo with a punchline; exponential growth rate equals value"
}
---

A worked example over the derivative kind, parked on its best punchline: the
exponential. The secant through P swings down onto the tangent as h shrinks,
and the rise/run triangle reads off the slope — which, uniquely for f = eˣ,
is the same number as the curve's height at that point. At `at: 1` both are
e ≈ 2.718, so the limit demo and the "why e is special" story land in one
scene.

This is a Door-1 recipe: pure params, nothing to load. Mint it as-is, or use
it as a starting point — move `at` to 0 (slope = height = 1) for the
gentlest version of the same fact, or switch `scenario` to 'sine' and the
punchline becomes the tangent reading off cos x.

## Recipe

See `recipe.json` beside this card — `kind: 'derivative'` with the params
above.

Pass the `kind` and `params` to the study-object mint. The full parameter
manual for the underlying kind is its own card (`id: 'derivative'`).
