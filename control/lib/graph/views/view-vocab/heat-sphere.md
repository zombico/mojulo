---
{
  "id": "heat-sphere",
  "name": "Heat Sphere",
  "family": "math",
  "entry": "create_view",
  "summary": "Mint an interactive HEAT-EQUATION explainer — a sphere with a hot (red) top pole and a cold (blue) bottom pole, temperature DIFFUSING across the surface until the ball settles to one lukewarm shade, as a live three.js World.",
  "when": "Reach for this on framing like 'heat equation / diffusion / temperature spreading over a sphere / heat kernel / Laplacian on the sphere / hot pole cold pole'.",
  "retired_tool": "create_heat_sphere_view"
}
---

Mint an interactive HEAT-EQUATION explainer — a sphere with a hot (red) top pole and a cold (blue) bottom pole whose temperature DIFFUSES across the surface until the whole ball settles to one lukewarm shade, rendered as a live, orbit-able three.js World. The single idea intro-PDE students never get to SEE: heat spreads, sharp differences smear out, and the rate is set by curvature — high-frequency lumps vanish almost at once, the broadest imbalance lingers longest. Exact, no fudge: on a sphere the axisymmetric eigenfunctions of the Laplacian are the Legendre polynomials Pₗ(cosθ) with eigenvalue −l(l+1), so any pole-to-pole profile evolves in closed form as T(θ,t) = Σₗ aₗ·Pₗ(cosθ)·e^(−l(l+1)κt). The coefficients aₗ are baked once (a numeric projection of the scenario's initial profile onto the Legendre basis); the browser replays the modal decay live — each mode dies at its own e^(−l(l+1)κt) rate, which is WHY the fine bands wash out in a blink while the single hot-top/cold-bottom split is the last thing standing. Time loops: sharp split → smooth → reset. Four scenarios, one idea worn many ways: 'poles' (a sharp equatorial jump between a hot upper hemisphere and cold lower one — equalises to neutral), 'cap' (one hot polar spot on a cold ball, bleeding outward), 'dipole' (a hot cap and a cold cap with a neutral band between), 'banded' (alternating hot/cold rings — the high modes, which blur away almost instantly). Colour IS temperature (a diverging cool→neutral→warm map). Part of mojulo's EDUCATION module (math explainers, sibling to surface-view and ocean-view). Served at `/api/sketches/<ref>/world`; the substrate stores ONLY the recipe (`manifest.kind === 'heat-sphere-view'`) and regenerates on render. ORBIT-ONLY: no CSS-3D /scene form. Reach for this on framing like 'heat equation / diffusion / temperature spreading over a sphere / heat kernel / hot pole cold pole'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — Which initial temperature profile (default 'poles'): 'poles' (hot top hemisphere / cold bottom, sharp equatorial jump), 'cap' (a hot polar cap on a cold ball), 'dipole' (a hot cap and a cold cap with a neutral band between), 'banded' (alternating hot/cold rings — high modes that decay fastest).
- `kappa` (number) — Thermal diffusivity (default 1, range 0.2–4). Higher κ diffuses faster; the loop's end-time scales so the ball always reaches near-uniform.
- `scale` (number) — Overall size multiplier (default 1).
- `viewBox` (object) — Optional render size { width, height }.
- `scene` (object) — Optional scene options, e.g. { bg: "#0a0d14" }.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
