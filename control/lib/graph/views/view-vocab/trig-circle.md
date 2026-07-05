---
{
  "id": "trig-circle",
  "name": "Trig Circle",
  "family": "math",
  "entry": "create_view",
  "summary": "Mint an interactive TRIGONOMETRY explainer — the UNIT CIRCLE, the one machine all of trig comes from, rendered as a live traversable three.js World.",
  "when": "Reach for this on framing like 'unit circle / sine cosine wave / trigonometry / radians / SOH CAH TOA'.",
  "retired_tool": "create_trig_circle_view"
}
---

Mint an interactive TRIGONOMETRY explainer — the UNIT CIRCLE, the one machine all of trig comes from, rendered as a live traversable three.js World. A point rides around the circle of radius 1; its HEIGHT above the axis is sin θ and its WIDTH across is cos θ, so the two functions are just the two shadows of one spinning radius. To the right of the circle the angle is UNWRAPPED into the wave — the circle literally becomes the wave — and synced beads ride the circle and the wave together so you watch one value flow into the other. Three scenarios, one idea worn many ways: 'sine' (the HEIGHT traces the sine wave), 'cosine' (the WIDTH traces the cosine wave), 'tangent' (the radius is extended to the tangent line and its intercept is tan θ — shooting off to infinity as θ → 90°). The `angle` knob places the marker radius at θ₀ (in radians) so you can park it on a particular angle. Part of mojulo's EDUCATION module (math explainers, sibling to the science views). Served at `/api/sketches/<ref>/world`; the substrate stores ONLY the recipe (`manifest.kind === 'trig-circle-view'`) and regenerates on render. ORBIT-ONLY: no CSS-3D /scene form. Reach for this on framing like 'unit circle / sine cosine wave / trigonometry / radians / SOH CAH TOA'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — Which function (default 'sine'): 'sine' (height → the sine wave), 'cosine' (width → the cosine wave), 'tangent' (radius extended to the tangent line, intercept = tan θ).
- `angle` (number) — Marker angle θ₀ in radians (where the rider radius is parked).
- `scale` (number) — Overall size multiplier (default 1).
- `viewBox` (object) — Optional render size { width, height }.
- `scene` (object) — Optional scene options, e.g. { bg: "#0b1020" }.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
