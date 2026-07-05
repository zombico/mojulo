---
{
  "id": "series",
  "name": "Series",
  "family": "math",
  "entry": "create_view",
  "summary": "Mint an interactive ANALYSIS explainer — APPROXIMATION made visible, rendered as a live traversable three.js World.",
  "when": "Reach for this on framing like 'Taylor series / Fourier series / convergence / approximation / partial sums'.",
  "retired_tool": "create_series_view"
}
---

Mint an interactive ANALYSIS explainer — APPROXIMATION made visible, rendered as a live traversable three.js World. A true curve f(x) is drawn in white and a whole FAMILY of partial sums rides beside it (cool = few terms → warm = many terms) so you watch each partial sum HUG the target more closely as terms accrete. This is the heart of Taylor & Fourier series: convergence, and the INTERVAL where it actually holds. Five scenarios, one idea worn many ways with a degenerate control: 'taylor-sin' (a polynomial chasing a wave — good near 0, drifts off far away), 'taylor-exp' (converges EVERYWHERE — infinite radius), 'geometric' (the control: 1/(1−x) DIVERGES past x = 1 — the partial sums fly apart, the interval of convergence made dramatic), 'fourier-square' (smooth sines summing to a square wave — and the GIBBS overshoot ears that never go away at the jump), 'fourier-saw' (sines building a sawtooth). Part of mojulo's EDUCATION module (math explainers, sibling to the science views). Served at `/api/sketches/<ref>/world`; the substrate stores ONLY the recipe (`manifest.kind === 'series-view'`) and regenerates on render. ORBIT-ONLY: no CSS-3D /scene form. Reach for this on framing like 'Taylor series / Fourier series / convergence / approximation / partial sums'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — Which series (default 'taylor-sin'): 'taylor-sin' (a polynomial chasing a wave), 'taylor-exp' (converges everywhere), 'geometric' (the control: 1/(1−x) diverges past x=1 — interval of convergence), 'fourier-square' (smooth sines build a jump — the Gibbs overshoot), 'fourier-saw' (sines building a sawtooth).
- `scale` (number) — Overall size multiplier (default 1).
- `viewBox` (object) — Optional render size { width, height }.
- `scene` (object) — Optional scene options, e.g. { bg: "#0b1020" }.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
