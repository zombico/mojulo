---
{
  "id": "derivative",
  "name": "Derivative",
  "family": "math",
  "entry": "create_view",
  "summary": "Mint an interactive CALCULUS explainer — the DERIVATIVE as the slope of the tangent line, reached as a LIMIT, rendered as a live traversable three.js World.",
  "when": "Reach for this on framing like 'derivative / tangent line / slope / limit / secant / rate of change / differentiation'.",
  "retired_tool": "create_derivative_view"
}
---

Mint an interactive CALCULUS explainer — the DERIVATIVE as the slope of the tangent line, reached as a LIMIT, rendered as a live traversable three.js World. A second point Q slides down the curve toward a fixed point P, and the SECANT line drawn through P and Q swings around until it settles into the TANGENT at P. The whole fan of secants for shrinking step h converges visibly on that one line, and the secant slope Δy/Δx converges on the derivative f′(a) — a rise/run triangle reads the slope straight off. This is the idea every intro-calculus student trips on, made visible. Four scenarios, one idea worn many ways: 'parabola' (f = x²), 'cubic' (f = x³), 'sine' (f = sin x), 'exp' (f = eˣ, the curve whose slope always equals its own height). OR pass `at` to set the x where the tangent is taken. Part of mojulo's EDUCATION module (math explainers, sibling to the science views). Served at `/api/sketches/<ref>/world`; the substrate stores ONLY the recipe (`manifest.kind === 'derivative-view'`) and regenerates on render. ORBIT-ONLY: no CSS-3D /scene form. Reach for this on framing like 'derivative / tangent line / slope / limit / secant / rate of change / differentiation'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — Which curve (default 'parabola'): 'parabola' (f = x²), 'cubic' (f = x³), 'sine' (f = sin x), 'exp' (f = eˣ, slope = height).
- `at` (number) — The x where the tangent point P is taken (and where f′(a) is read off).
- `animate` (boolean) — Play the secant→tangent limit (default true). false bakes the final tangent statically.
- `scale` (number) — Overall size multiplier (default 1).
- `viewBox` (object) — Optional render size { width, height }.
- `scene` (object) — Optional scene options, e.g. { bg: "#0b1020" }.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
