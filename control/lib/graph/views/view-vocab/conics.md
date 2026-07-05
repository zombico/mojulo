---
{
  "id": "conics",
  "name": "Conics",
  "family": "math",
  "entry": "create_view",
  "summary": "Mint an interactive GEOMETRY explainer — where the CONIC SECTIONS come from, rendered as a live traversable three.js World.",
  "when": "Reach for this on framing like 'conic sections / circle ellipse parabola hyperbola / slicing a cone / where conics come from'.",
  "retired_tool": "create_conics_view"
}
---

Mint an interactive GEOMETRY explainer — where the CONIC SECTIONS come from, rendered as a live traversable three.js World. Slice a double cone with a flat plane and the cut curve is a circle, ellipse, parabola, or hyperbola — and which one you get is decided by NOTHING but how steeply the plane is tilted compared to the cone's own half-angle. The translucent double cone, the cutting plane, and the bright intersection curve all orbit together so you can see the slice from any side. Four scenarios, one idea worn many ways: 'circle' (plane perpendicular to the axis), 'ellipse' (a gentle tilt — the cut is still a closed loop), 'parabola' (plane exactly parallel to one side of the cone — the curve opens up, one arm running to infinity), 'hyperbola' (a steep tilt — the plane now catches BOTH nappes of the double cone, giving two separate branches). Part of mojulo's EDUCATION module (math explainers, sibling to the science views). Served at `/api/sketches/<ref>/world`; the substrate stores ONLY the recipe (`manifest.kind === 'conics-view'`) and regenerates on render. ORBIT-ONLY: no CSS-3D /scene form. Reach for this on framing like 'conic sections / circle ellipse parabola hyperbola / slicing a cone / where conics come from'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — Which slice (default 'ellipse'): 'circle' (plane ⟂ axis), 'ellipse' (gentle tilt, still closed), 'parabola' (plane parallel to a side, opens with one arm to infinity), 'hyperbola' (steep tilt, catches both nappes, two branches).
- `animate` (boolean) — Play the slicing morph (default true). false bakes the final cut statically.
- `scale` (number) — Overall size multiplier (default 1).
- `viewBox` (object) — Optional render size { width, height }.
- `scene` (object) — Optional scene options, e.g. { bg: "#0b1020" }.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
