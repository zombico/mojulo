---
{
  "id": "field-flow",
  "name": "Vector Field Flow",
  "family": "math",
  "entry": "create_view",
  "summary": "Mint an interactive VECTOR-CALCULUS explainer — a VECTOR FIELD on the plane, an arrow at every point showing which way a particle is PUSHED, rendered as a live traversable three.js World.",
  "when": "Reach for this on framing like 'vector field / phase portrait / differential equations / divergence and curl / gradient field'.",
  "retired_tool": "create_field_flow_view"
}
---

Mint an interactive VECTOR-CALCULUS explainer — a VECTOR FIELD on the plane, an arrow at every point showing which way a particle is PUSHED, rendered as a live traversable three.js World. Streamlines thread the arrows and tracer beads DRIFT along the flow so you watch the field move. Every scenario is a LINEAR field F = A·x, so its phase-portrait type is decided entirely by the EIGENVALUES of A: the DIVERGENCE is the trace (do arrows spread or gather?) and the CURL is A21 − A12 (does the flow rotate?). Five scenarios, one idea worn many ways with a degenerate control: 'source' (arrows out, unstable node — positive eigenvalues), 'sink' (arrows in, curl-free GRADIENT field — negative eigenvalues), 'vortex' (circulating centre — pure imaginary eigenvalues, no spread), 'saddle' (hyperbolic, the control — one axis attracts, one repels), 'spiral' (rotate AND decay — complex eigenvalues). OR pass an explicit `matrix` (any 2×2) and the linear field F = A·x is auto-classified by its divergence, curl and eigenvalues. Part of mojulo's EDUCATION module (math explainers, sibling to the science views). Served at `/api/sketches/<ref>/world`; the substrate stores ONLY the recipe (`manifest.kind === 'field-flow-view'`) and regenerates on render. ORBIT-ONLY: no CSS-3D /scene form. Reach for this on framing like 'vector field / phase portrait / differential equations / divergence and curl / gradient field'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — Which field (default 'spiral'): 'source' (arrows out, unstable node), 'sink' (arrows in, curl-free gradient field), 'vortex' (circulating centre), 'saddle' (hyperbolic — the control), 'spiral' (rotate & decay, complex eigenvalues).
- `matrix` (array) — Optional explicit 2×2 matrix [[a,b],[c,d]]; the linear field F = A·x is auto-classified (divergence / curl / eigenvalues) and overrides the scenario preset.
- `scale` (number) — Overall size multiplier (default 1).
- `viewBox` (object) — Optional render size { width, height }.
- `scene` (object) — Optional scene options, e.g. { bg: "#0b1020" }.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
