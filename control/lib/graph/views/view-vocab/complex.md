---
{
  "id": "complex",
  "name": "Complex",
  "family": "math",
  "entry": "create_view",
  "summary": "Mint an interactive COMPLEX-ANALYSIS explainer — a complex function f(z) rendered as an ANALYTIC LANDSCAPE (domain colouring lifted into 3-D), a live traversable three.js World.",
  "when": "Reach for this on framing like 'complex function / domain colouring / poles and zeros / complex analysis / Riemann'.",
  "retired_tool": "create_complex_view"
}
---

Mint an interactive COMPLEX-ANALYSIS explainer — a complex function f(z) rendered as an ANALYTIC LANDSCAPE (domain colouring lifted into 3-D), a live traversable three.js World. The HEIGHT of the terrain is log|f| so the function's ZEROS sink into pits and its POLES erupt into spikes, while the COLOUR is the phase arg(f) swept round a full hue wheel — so a zero of order n shows the colour wheel turning n times around its pit, and a pole turns it the other way. You orbit the surface and READ the function off the land: where it vanishes, where it blows up, how its phase circulates. Five scenarios, one idea worn many ways: 'square' (z² — a double zero at the origin, the phase wheel goes round TWICE), 'reciprocal' (1/z — a single pole spiking at the origin), 'rational' ((z²−1)/(z²+1) — zeros at ±1 AND poles at ±i sharing one landscape), 'exp' (eᶻ — the modulus ramps off to infinity, the phase reads as horizontal colour bands), 'mobius' ((z−1)/(z+1) — a zero at 1 and a pole at −1, the Möbius staple). Part of mojulo's EDUCATION module (math explainers, sibling to the science views). Served at `/api/sketches/<ref>/world`; the substrate stores ONLY the recipe (`manifest.kind === 'complex-view'`) and regenerates on render. ORBIT-ONLY: no CSS-3D /scene form. Reach for this on framing like 'complex function / domain colouring / poles and zeros / complex analysis / Riemann'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — Which function (default 'square'): 'square' (z², double zero — phase wheel twice), 'reciprocal' (1/z, a pole at the origin), 'rational' ((z²−1)/(z²+1), zeros at ±1 and poles at ±i together), 'exp' (eᶻ, modulus ramps, phase = colour bands), 'mobius' ((z−1)/(z+1)).
- `scale` (number) — Overall size multiplier (default 1).
- `viewBox` (object) — Optional render size { width, height }.
- `scene` (object) — Optional scene options, e.g. { bg: "#0b1020" }.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
