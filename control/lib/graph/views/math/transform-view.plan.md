# transform-view — plan

The **math** sibling to the science views: a depictor for a **linear map** `A: ℝ² → ℝ²` (and ℝ³),
shown the only way it can be honestly shown — as the **deformation of space itself**. A faint
reference grid stays put; the transformed grid, the basis vectors **î/ĵ**, and the unit circle ride
the map. The marquee object that proves the `*_view` scaffold carries from physics to math. Sibling of
vector-match-view (discrete points + arrows + tracer, NOT raymarch); orbit-only, pickable.

This is the "Saturn" of the math explainer: the showcase that forces the one genuinely new design
question — *how a math view embodies an abstract object and states its honesty note* — on the
highest-value example. surface-view and field-flow-view come cheaply afterward because their render
channels (`surfaces`, `fields`) already ship.

## The honesty inversion (vs the science views)

Every science view's stance is "honest structure, **compressed scale**" (Saturn's ring shadows are
real, its spatial scale is a lie it admits to). Math **inverts** this: the object is rendered
**exact** — true grid images, closed-form eigen-decomposition, the real determinant. There is no scale
to compress. The *only* stylization is the **animated path I → A**: we interpolate the identity into
`A` so the deformation reads in motion, and that homotopy is a presentational choice, not part of the
map. We say so in the readout. (Rotations animate along the geodesic `R(t·θ)`, not the straight
lerp, so the unit circle stays a circle mid-morph instead of collapsing through a degenerate.)

## Scenarios (the "hats" — one idea, many faces, with a degenerate control)

Same device as field-view's em-wave/bar-magnet/wire/solenoid: one concept worn several ways, plus a
built-in control case for contrast.

- **`eigenbasis`** *(flagship)* — a general diagonalizable matrix. Its **two real eigenvectors** are
  drawn as the **invariant rays**: a tracer point sent along each one only *stretches*, never leaves
  its line — eigenvalue = the stretch factor. The single clearest "what a matrix *is*" picture.
- **`scale`** — a diagonal matrix. Eigenvectors are the axes; the **determinant is literal** — the
  unit square's image area = `λ₁·λ₂`, painted as a parallelogram whose area is read off on screen.
- **`shear`** — det = 1 (area preserved), a single repeated eigenvalue, **one** eigen-direction. The
  honest **defective / non-diagonalizable** case: we show only one invariant line and say why there
  isn't a second, rather than fabricating one.
- **`rotation`** — orthogonal, det = +1, **complex** eigenvalues `e^{±iθ}`. The control that proves
  eigenvectors aren't guaranteed in ℝ²: **no real invariant axis** — every vector turns. Animated on
  the geodesic.
- **`projection`** — det = 0, rank-deficient. The **degenerate control**: the whole plane collapses
  onto a line, the unit circle becomes a **segment**, one singular value is 0. Makes "determinant = 0
  ⇒ not invertible ⇒ information lost" something you *see*.

Pass an explicit `matrix` instead of (or alongside) a scenario and the view **auto-classifies** it —
computes eigen/det/trace/rank and picks the right readout — the way saturn-view takes a single
`planet` or a `gallery`.

## The math → primitive mapping (exact in value)

All computed in closed form for 2×2 (and numerically for the 3×3 knob), pure and tested:

- **reference grid** — faint static quads (group `grid:ref`, low `alpha`): undeformed space, the
  thing being acted on.
- **image grid** — bright quads (group `grid:img`) under `A_t`, animated I → A. This *is* the map.
- **basis vectors î, ĵ** — two arrows on the **tracer** channel; their tips land on the **columns of
  A** (`A·î` = column 1, `A·ĵ` = column 2) — the standard "columns are where the basis goes" reading.
- **unit square** → **image parallelogram** — a filled, alpha face (group `det`) spanning the column
  vectors; its **signed area = det A**, shown numerically, and **flipped to a warning hue when det <
  0** (orientation reversed — the plane turned over).
- **unit circle** → **image ellipse** — the SVD ellipse; its semi-axes are the **singular values**
  `σ₁ ≥ σ₂` along the left-singular directions. (For `projection`, σ₂ = 0 ⇒ the segment.)
- **eigen-rays** — for real eigenvalues, the invariant lines as long faint rays with a tracer bead
  that rides out to `λ·v`, staying on its line. Omitted (with a readout note) when eigenvalues are
  complex (`rotation`).

## Architecture — mirrors vector-match-view / field-view

New `control/lib/graph/transform-view.js`:
- `classifyMatrix(M)` — pure 2×2 (and 3×3) linear-algebra core: `det`, `trace`, `rank`, real/complex
  **eigenpairs** (closed form via the characteristic quadratic), **singular values** (eig of `MᵀM`).
  Tested against hand-worked cases. This is the whole math engine; everything else is rendering.
- `planTransformScene(recipe)` — pure, deterministic. Resolve scenario (or auto-classify `matrix`);
  build the ref + image grids, the unit-square/parallelogram det face, the circle/ellipse, the
  eigen-rays; lower through the workbench; emit `faces`, `picks`, and the `tracer` payload (the morph,
  the basis arrows, the eigen-beads). Returns `{ faces, picks, tracer, bounds, stats }`.
- `assembleTransformScene(recipe, {title})` — top-down + 3/4 cameras, dark bg, `glow:false`, thread
  `faces` + `picks` + `tracer` into `emitThreeWorld`.

**No new emitThreeWorld channel.** Reuses `faces` (grid quads / det parallelogram / ellipse disk),
the **`tracer` channel** (the I→A morph + basis arrows + eigen-beads, as vector-match already drives),
and `picks` + `.moj-readout`. That's the point of building the math family on this scaffold.

## Manifest (`kind: 'transform-view'`)

```jsonc
{ "kind":"transform-view",
  "scenario":"eigenbasis",            // eigenbasis | scale | shear | rotation | projection
  "matrix":[[2,1],[1,2]],             // OPTIONAL explicit map; auto-classified, overrides scenario preset
  "dim":2,                            // 2 (default) | 3
  "animate":true,                     // play the I→A morph (default true)
  "viewBox":{...}, "scene":{ "bg":"#0b1020" }, "title":"…" }
```

## Touchpoints (registration) — the same six

1. `sketch-manifest.js` — add `'transform-view'` to `WORLD_RENDER_KINDS`.
2. `control/lib/graph/transform-view.js` — NEW builder + `classifyMatrix`.
3. `control/lib/graph/world-scene.js` — dispatch branch → `assembleTransformScene` (orbit-only).
4. `control/app/api/sketches/[ref]/world/route.js` — already routes WORLD_RENDER_KINDS to `/world`
   (no change if registered in 1; listed for parity with the science-view checklist).
5. `control/lib/mcp/tools/transform-view.js` — NEW: `create_transform_view`.
6. `control/lib/mcp/server.js` — register the tool.

(No `scene-three.js` change — `faces` + `tracer` + `picks` already exist.)

## Picks (popups)

- `grid:img` → the matrix `A`, `det`, `trace`, `rank`.
- `eig:<i>` → eigenvalue `λᵢ`, eigenvector `vᵢ`, "invariant line: only stretches by λ" (or, when
  complex, "no real eigenvector — every vector rotates").
- `det` (the parallelogram) → signed area = det, "+ preserves / − reverses orientation; 0 ⇒ singular".
- `svd` (the ellipse) → singular values `σ₁, σ₂`, "circle → ellipse; σ are the stretch radii".

## Readout (static caption)

The matrix `[[a b] [c d]]`, `det`, `trace`, and the invariant being shown — e.g.
`['A = [[2,1],[1,2]]', 'det = 3  trace = 4', 'eigenvalues 3, 1 — real, two invariant axes',
'morph I→A is animation only; the map is exact']`.

## Tests (`transform-view.test.js`)

- `classifyMatrix` against hand-worked cases: `[[2,0],[0,3]]` → det 6, eig {2,3} on the axes;
  `[[1,1],[0,1]]` (shear) → det 1, repeated eig 1, one eigenvector, rank 2; `[[0,-1],[1,0]]`
  (rotation) → complex eigenvalues, **no** real eigenpair; `[[1,0],[0,0]]` (projection) → det 0,
  rank 1, σ₂ = 0.
- Determinism; render-mode routes `transform-view` → world.
- Each scenario emits a readout, the column-image arrows land on the columns of A, and at least one
  pickable element; `eigenbasis`/`scale` emit eigen-rays, `rotation` emits none (and says so).
- det < 0 case (`[[0,1],[1,0]]`) flags orientation reversal in the det pick.

## v1 scope cuts (flagged)

- 2×2 is the showcase; 3×3 (`dim:3`) classifies + renders the grid/parallelepiped but eigen-rays are
  drawn only for real eigenvalues (complex pairs noted, not drawn).
- No interactive matrix dragging — `matrix` is set at mint time (an interactive knob is a fast-follow
  on whatever input affordance the World gets).
- SVD ellipse shown; the full U·Σ·Vᵀ *staged* animation (rotate→scale→rotate in three beats) deferred.
- Complex-eigenvalue spiral (the `e^{±iθ}` rotation-scaling for non-orthogonal complex pairs) noted
  as a knob, not built.
