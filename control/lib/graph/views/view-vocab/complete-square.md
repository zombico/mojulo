---
{
  "id": "complete-square",
  "name": "Complete Square",
  "family": "math",
  "entry": "create_view",
  "summary": "Mint an interactive ALGEBRA explainer — COMPLETING THE SQUARE, the geometric move behind the quadratic formula, rendered as a live traversable three.js World.",
  "when": "Reach for this on framing like 'completing the square / quadratic formula derivation / perfect square / algebra tiles'.",
  "retired_tool": "create_complete_square_view"
}
---

Mint an interactive ALGEBRA explainer — COMPLETING THE SQUARE, the geometric move behind the quadratic formula, rendered as a live traversable three.js World. x² + bx is a square of side x plus a b-by-x rectangle; split that rectangle in two and wrap the halves around the square and you get an L-shape that is ALMOST a bigger square (x + b/2)² — short by exactly one missing corner of (b/2)². So x² + bx = (x + b/2)² − (b/2)², and 'completing' the square literally means adding the orange corner tile that fills the gap. Colour-coded algebra tiles ride the rearrangement: teal is the x² square, amber strips are the bx rectangle halves, orange is the (b/2)² completion. Three scenarios, one idea worn many ways: 'narrow' (b=2), 'square' (b=4), 'wide' (b=6). OR pass explicit `x` and `b` to drive the tiling yourself. Part of mojulo's EDUCATION module (math explainers, sibling to the science views). Served at `/api/sketches/<ref>/world`; the substrate stores ONLY the recipe (`manifest.kind === 'complete-square-view'`) and regenerates on render. ORBIT-ONLY: no CSS-3D /scene form. Reach for this on framing like 'completing the square / quadratic formula derivation / perfect square / algebra tiles'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — Which tiling (default 'square'): 'narrow' (b=2), 'square' (b=4), 'wide' (b=6).
- `x` (number) — Optional explicit side length x of the teal square.
- `b` (number) — Optional explicit linear coefficient b; the amber strips total b·x and the orange corner is (b/2)².
- `animate` (boolean) — Play the rearrangement morph (default true). false bakes the completed square statically.
- `scale` (number) — Overall size multiplier (default 1).
- `viewBox` (object) — Optional render size { width, height }.
- `scene` (object) — Optional scene options, e.g. { bg: "#0b1020" }.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
