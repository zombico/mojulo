---
{
  "id": "area-remembers",
  "name": "The area remembers the curve",
  "family": "math",
  "entry": "create_view",
  "summary": "A ready-to-mint calculus preset: the Fundamental Theorem explainer on f = sin t with the sweep at x = π — the shaded hump complete, the accumulation curve cresting at its maximum exactly where sin returns to zero.",
  "when": "fundamental theorem of calculus demo; integral of sine; area under one hump of sin; accumulation function for class; why the derivative of the area is the function"
}
---

A worked example over the FTC kind on its 'sine' pair (f = sin t →
A = 1 − cos x), swept to `at: 3.14` — one full hump. Two things land at
once at that position: the shaded area completes its first arch (A = 2, a
number students can check), and the bottom panel's accumulation curve
crests flat exactly where the top panel's sin crosses zero — the slope of
the area IS the height of the curve, caught at the moment both hit a
landmark value.

This is a Door-1 recipe: pure params, nothing to load. Mint it as-is, or use
it as a starting point — pull `at` back to 1.57 (π/2) to freeze the moment
the area is growing fastest, or switch `scenario` to 'square' for the
t² → x³/3 version.

## Recipe

See `recipe.json` beside this card — `kind: 'ftc'` with the params above.

Pass the `kind` and `params` to the study-object mint. The full parameter
manual for the underlying kind is its own card (`id: 'ftc'`).
