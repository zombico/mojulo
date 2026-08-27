---
{
  "id": "ftc",
  "name": "Fundamental Theorem of Calculus",
  "family": "math",
  "entry": "create_view",
  "summary": "Mint an interactive CALCULUS explainer — the FUNDAMENTAL THEOREM OF CALCULUS, rendered as a live traversable three.js World in two stacked panels.",
  "when": "Reach for this on framing like 'fundamental theorem of calculus / integral as area / antiderivative / accumulation function / FTC'.",
  "retired_tool": "create_ftc_view"
}
---

Mint an interactive CALCULUS explainer — the FUNDAMENTAL THEOREM OF CALCULUS, rendered as a live traversable three.js World in two stacked panels. The TOP panel shows a function f(t) with the AREA from 0 to x shaded in. The BOTTOM panel plots the area-so-far function A(x) = ∫₀ˣ f, the running total of that shaded area. The punchline the two panels make visible: the RATE at which the area grows equals the HEIGHT of f at x equals the SLOPE of A at x — so A′(x) = f(x), and differentiating the accumulated area hands you the original function straight back. The red height bar up top and the gold tangent slope down below are literally the SAME number. Four scenarios, one idea worn many ways: 'constant' (f = 1 → A = x), 'linear' (f = t → A = x²/2), 'sine' (f = sin t → A = 1 − cos t), 'square' (f = t² → A = x³/3). OR pass `at` to set the sweep position x. Part of mojulo's EDUCATION module (math explainers, sibling to the science views). Served at `/api/sketches/<ref>/world`; the substrate stores ONLY the recipe (`manifest.kind === 'ftc-view'`) and regenerates on render. ORBIT-ONLY: no CSS-3D /scene form. Reach for this on framing like 'fundamental theorem of calculus / integral as area / antiderivative / accumulation function / FTC'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — Which pair (default 'linear'): 'constant' (f = 1 → A = x), 'linear' (f = t → A = x²/2), 'sine' (f = sin t → A = 1 − cos t), 'square' (f = t² → A = x³/3).
- `at` (number) — The sweep position x — sets how far the shaded area runs and where the height/slope are compared.
- `animate` (boolean) — Play the sweep (default true). false bakes the final position statically.
- `scale` (number) — Overall size multiplier (default 1).
- `viewBox` (object) — Optional render size { width, height }.
- `scene` (object) — Optional scene options, e.g. { bg: "#0b1020" }.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
