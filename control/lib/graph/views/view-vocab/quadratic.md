---
{
  "id": "quadratic",
  "name": "Quadratic Function",
  "family": "math",
  "entry": "create_view",
  "summary": "Mint an interactive ALGEBRA explainer — the PARABOLA y = ax²+bx+c, rendered as a live traversable three.js World.",
  "when": "Reach for this on framing like 'quadratic / parabola / roots / discriminant / quadratic formula / x-intercepts'.",
  "retired_tool": "create_quadratic_view"
}
---

Mint an interactive ALGEBRA explainer — the PARABOLA y = ax²+bx+c, rendered as a live traversable three.js World. The curve is drawn with its ROOTS marked in red where it crosses the x-axis, its VERTEX marked in gold at the turning point, and the DISCRIMINANT Δ = b²−4ac called out as the quantity under the square root in the quadratic formula — the single number that decides HOW MANY real roots exist. Four scenarios tell the degenerate-control story as Δ slides through zero: 'two' (Δ>0 — two distinct real roots, the parabola cuts the axis twice), 'double' (Δ=0 — the knife-edge where the two roots MERGE into one and the vertex just kisses the axis), 'none' (Δ<0 — the roots VANISH from the reals as the parabola lifts entirely off the axis), 'down' (a<0 — the parabola opens downward). The `a`, `b`, `c` knobs set the coefficients so it becomes ANY quadratic, and the markers recompute the roots, vertex and discriminant live. Part of mojulo's EDUCATION module (math explainers, sibling to the science views). Served at `/api/sketches/<ref>/world`; the substrate stores ONLY the recipe (`manifest.kind === 'quadratic-view'`) and regenerates on render. ORBIT-ONLY: no CSS-3D /scene form. Reach for this on framing like 'quadratic / parabola / roots / discriminant / quadratic formula / x-intercepts'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — Which case (default 'two'): 'two' (Δ>0, two real roots), 'double' (Δ=0, the knife-edge where the roots merge into one), 'none' (Δ<0, no real roots — parabola lifts off the axis), 'down' (a<0, opens downward).
- `a` (number) — Coefficient a of ax²+bx+c (the leading/quadratic term).
- `b` (number) — Coefficient b of ax²+bx+c (the linear term).
- `c` (number) — Coefficient c of ax²+bx+c (the constant term).
- `scale` (number) — Overall size multiplier (default 1).
- `viewBox` (object) — Optional render size { width, height }.
- `scene` (object) — Optional scene options, e.g. { bg: "#0b1020" }.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
