---
{
  "id": "surface",
  "name": "Surface",
  "family": "math",
  "entry": "create_view",
  "summary": "Mint an interactive MULTIVARIABLE-CALCULUS explainer — the graph of z = f(x,y) rendered as a 3-D LANDSCAPE you can traverse, with a ball that ROLLS DOWNHILL (gradient descent) and traces its path as a live three.js World.",
  "when": "Reach for this on framing like 'multivariable calculus / gradient descent / critical points / saddle / local minima / surface plot'.",
  "retired_tool": "create_surface_view"
}
---

Mint an interactive MULTIVARIABLE-CALCULUS explainer — the graph of z = f(x,y) rendered as a 3-D LANDSCAPE you can traverse, with a ball that ROLLS DOWNHILL (gradient descent) and traces its path as a live three.js World. Critical points (where ∇f = 0) become readable terrain: hilltops, valleys and saddles; optimization becomes a ball finding the bottom of a basin. Five scenarios, one idea worn many ways: 'bowl' (one global minimum — the ball always finds it), 'saddle' (∇f = 0 but NO optimum — the ball rolls away, the control), 'monkey' (three valleys meeting at a degenerate critical point), 'wells' (two basins → two LOCAL minima, where you drop the ball decides which one it falls into), 'ripple' (many local minima — a bumpy bowl where the starting point determines where descent stops). Multivariable calculus made a place: the surface IS the function and the ball's path IS the optimizer. Part of mojulo's EDUCATION module (math explainers, sibling to the science views). Served at `/api/sketches/<ref>/world`; the substrate stores ONLY the recipe (`manifest.kind === 'surface-view'`) and regenerates on render. ORBIT-ONLY: no CSS-3D /scene form. Reach for this on framing like 'multivariable calculus / gradient descent / critical points / saddle / local minima / surface plot'.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — Which surface (default 'bowl'): 'bowl' (one global min), 'saddle' (∇f=0 but no optimum — the ball rolls away), 'monkey' (three valleys), 'wells' (two basins → local minima), 'ripple' (many local minima — where you start decides where you stop).
- `scale` (number) — Overall size multiplier (default 1).
- `viewBox` (object) — Optional render size { width, height }.
- `scene` (object) — Optional scene options, e.g. { bg: "#0b1020" }.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.
