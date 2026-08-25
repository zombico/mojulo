---
{
  "id": "pythagoras",
  "name": "Pythagorean Theorem",
  "family": "math",
  "entry": "create_view",
  "summary": "Mint an interactive GEOMETRY explainer — the iconic a² + b² = c² figure, rendered as a live traversable three.js World.",
  "when": "Reach for this on framing like 'Pythagorean theorem / Pythagoras / a squared plus b squared / right triangle proof'.",
  "retired_tool": "create_pythagoras_view"
}
---

Mint an interactive GEOMETRY explainer — the iconic a² + b² = c² figure, rendered as a live traversable three.js World. A right triangle sits with a coloured SQUARE built outward on each of its sides; the two scenarios show the theorem two complementary ways. 'squares' draws the blue square on leg a, the green square on leg b and the orange square on hypotenuse c so you SEE the two leg-squares' areas add up to exactly the hypotenuse square — a² + b² = c² as visible tilework. 'dissection' is the one-figure proof: four copies of the triangle packed around a tilted c² square, all sitting inside a big (a+b)² square — slide the triangles and the same area rearranges into an a² square plus a b² square. The `a` and `b` knobs set the two legs so it becomes ANY right triangle (3-4-5, 5-12-13, or your own). Part of mojulo's EDUCATION module (math explainers, sibling to the science views). Served at `/api/sketches/<ref>/world`; the substrate stores ONLY the recipe (`manifest.kind === 'pythagoras-view'`) and regenerates on render. ORBIT-ONLY: no CSS-3D /scene form. Reach for this on framing like 'Pythagorean theorem / Pythagoras / a squared plus b squared / right triangle proof'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — Which figure (default 'squares'): 'squares' (the coloured square built on each side — blue a², green b², orange c²), 'dissection' (the one-figure proof — four triangles around a tilted c² square inside an (a+b)² square).
- `a` (number) — Length of leg a (sets the right triangle).
- `b` (number) — Length of leg b (sets the right triangle).
- `scale` (number) — Overall size multiplier (default 1).
- `viewBox` (object) — Optional render size { width, height }.
- `scene` (object) — Optional scene options, e.g. { bg: "#0b1020" }.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
