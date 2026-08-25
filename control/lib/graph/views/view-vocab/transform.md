---
{
  "id": "transform",
  "name": "Linear Transformation",
  "family": "math",
  "entry": "create_view",
  "summary": "Mint an interactive LINEAR-ALGEBRA explainer — a 2×2 LINEAR MAP shown as the deformation of space itself, rendered as a live traversable three.js World.",
  "when": "Reach for this on framing like 'linear transformation / eigenvectors / determinant / matrix as a deformation / what does this matrix do to the plane'.",
  "retired_tool": "create_transform_view"
}
---

Mint an interactive LINEAR-ALGEBRA explainer — a 2×2 LINEAR MAP shown as the deformation of space itself, rendered as a live traversable three.js World. A faint reference grid stays put while the bright IMAGE grid, the basis vectors î/ĵ (their tips = the COLUMNS of A), the unit square (→ a parallelogram whose signed area = the DETERMINANT) and the unit circle (→ the SVD ellipse, semi-axes = the singular values) all ride the map. EIGENVECTORS show as the invariant purple axes — directions that only stretch by their eigenvalue and never turn. The view animates identity → A so you watch space FLOW into the map. Five scenarios, one idea worn many ways with degenerate controls: 'eigenbasis' (two real invariant axes), 'scale' (det = area), 'shear' (defective — one axis), 'rotation' (complex eigenvalues — NO real axis), 'projection' (det 0 — the plane collapses to a line). OR pass an explicit `matrix` (any 2×2) and it is auto-classified (eigenvalues / det / trace / rank / SVD) — 'show me what [[1,2],[3,4]] does to space'. Part of mojulo's EDUCATION module (math explainers, sibling to the science views). Served at `/api/sketches/<ref>/world`; the substrate stores ONLY the recipe (`manifest.kind === 'transform-view'`) and regenerates on render. ORBIT-ONLY: no CSS-3D /scene form. Reach for this on framing like 'linear transformation / eigenvectors / determinant / matrix as a deformation / what does this matrix do to the plane'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — Which map (default 'eigenbasis'): 'eigenbasis' (two real invariant axes), 'scale' (diagonal, det = area), 'shear' (defective, one axis), 'rotation' (complex eigenvalues, no real axis), 'projection' (det 0, collapses to a line).
- `matrix` (array) — Optional explicit 2×2 matrix [[a,b],[c,d]]; auto-classified and overrides the scenario preset.
- `dim` (number) — 2 (default) or 3 (3×3 grid; eigen-rays drawn only for real eigenvalues).
- `animate` (boolean) — Play the identity→A morph (default true). false bakes the final A statically.
- `scale` (number) — Overall size multiplier (default 1).
- `viewBox` (object) — Optional render size { width, height }.
- `scene` (object) — Optional scene options, e.g. { bg: "#0b1020" }.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
