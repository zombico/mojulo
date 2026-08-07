---
{ "id": "plant", "name": "plant 🌿 — a generative macro for plants (leaves, stems, ferns, flowers, trees)", "summary": "draw a whole plant from a few numbers — the wave-form of a plant falls out of the taiji primitive: spindle taijis are leaves/petals, capsule taijis are stems/branches/tongue-leaves, placed by golden-angle phyllotaxis + self-similar taper, or recursively branched into a tree", "when": "growing or botanical forms: draw a plant, a leafy stem or shoot, a fern frond, a flower or sunflower head, a tree or bush with a trunk and branches, a sprig, a vine, a rosette / snake-plant / agave, leaves arranged on a stalk, phyllotaxis / golden-angle spiral, recursive / fractal branching growth — anywhere you want plant-like wave-form geometry without hand-placing each leaf or branch", "tier": "render-primitive", "marks": ["plant"], "phase": "p1" }
---

For botanical / growing forms, reach for `plant`: a generative MACRO that
draws a whole plant from ~8 numbers. It is **not a new render primitive** —
it compiles to `taiji` specs at mint time and rides the taiji paint pass.
The insight it encodes: a plant's wave-form already lives in the taiji.

- A **spindle** taiji is a leaf or petal — teardrop tips, and the rotating
  partition reads as **venation**.
- A **capsule** taiji is a stem, rachis, or tongue-leaf — blunt and
  constant-width, the partition reading as **nodes / banding**.
- A plant places those by two **deterministic** rules: golden-angle
  divergence around the growth axis (so no two leaves stack) + a
  self-similar `taper` per node (the fractal shrink). No seed — same spec
  renders identically every time.

3D only. Authored as a top-level `plants: [...]` array on the manji-tree
manifest. (v1 axes are inline `{x,y,z}`; endpoint-path axes and an in-tree
`{ kind: "plant" }` leaf are follow-ups.)

## Shape

```
plants: [{
  form?,          // "shoot" (stem + spiral leaves; default) | "frond"
                  //   (arching rachis + alternating pinnae — a fern) |
                  //   "flower" (radiating petals + optional disc) |
                  //   "rosette" (upright capsule tongue-leaves)
  base?, tip?,    // inline {x,y,z} growth axis. default {0,0,0}→{0,0,6}
  center?,        // flower bloom center (alias for base on "flower")
  count?,         // leaves / pinnae / petals. default 13
  divergence?,    // turns per node. default 0.382 (golden ≈ 137.5°);
                  //   0.5 = distichous, 0.333 = tristichous
  leafProfile?,   // "spindle" (pointed; default) | "capsule" (tongue)
  leafTwist?,     // per-leaf curl. default 0.1
  leafLength?, leafWidth?, stemRadius?,  // base sizes
  stemTwist?,     // stem signed chirality / grain. default 2
  taper?,         // per-node shrink ratio (self-similarity). default 0.93
  arch?,          // leaf / rachis bend (off-axis taiji center → Bézier)
  paint?,         // "silhouette" (default, filled solid volume) | "fibers"
                  //   (painterly imperfect-cel matter) | "lines" (wireframe)
  detail?,        // "low" | "medium" (default) | "high" — mesh density
  discCount?, discRadius?,  // flower only — golden-angle disc florets
  crossSections?, samples?, // override the detail preset on every taiji
  style?          // { stem: {...}, leaf: {...} } taiji style palettes
}]
```

## The four forms

- **shoot** — a vertical stem (capsule taiji, `stemTwist` grain) bearing
  `count` spindle leaves on the golden-angle spiral, climbing the axis and
  shrinking by `taper` per node. The canonical leafy sprig.
- **frond** — an arching rachis (capsule taiji whose off-line `center` bends
  it into a Bézier) bearing pinnae on alternating sides, shrinking toward the
  tip. A fern / locust frond. Bipinnate ferns recurse this (follow-up).
- **flower** — `count` spindle petals radiating from `center` in the plane
  perpendicular to the `center`→`tip` normal, plus an optional dense
  golden-angle disc of `discCount` florets. A daisy, an echinacea, or a
  full sunflower head. **Face the bloom at the viewer:** a flower is a flat
  disc, so point its `center`→`tip` normal toward the camera (≈ `+y` in the
  default room basis, e.g. `center: {0,0,0}, tip: {0,3,0}`). Standing it on a
  vertical (`+z`) axis renders it edge-on as a lens/blob.
- **rosette** — upright, gently curling `capsule` tongue-leaves fanned from a
  common base. A snake-plant (Sansevieria) or agave; blunt tips read as
  fleshy straps rather than pointed blades.
- **tree** — RECURSIVE branching. A tapering capsule-taiji trunk forks into
  `branches` children per node, each a scaled, rotated copy growing off the
  parent's tip, recursing to `depth`; optional spindle-leaf clusters sit at
  the terminal twigs. This is the fractal case — `lengthRatio` / `radiusRatio`
  are the self-similarity, `branchAngle` the spread, `crook` the gnarl,
  `upBias` the gravitropism. `foliage: false` gives a bare winter tree (a pure
  branch skeleton). Branching azimuth uses the golden angle (offset per level)
  so it never looks like a flat mirror-symmetric fractal. Tree knobs: `depth`
  (default 4), `branches` (2), `branchAngle` (35°), `lengthRatio` (0.72),
  `radiusRatio` (0.62), `crook` (0.12), `upBias` (0.12), `foliage` (true),
  `leafCount` (5). The recursion is bounded — a spec compiling
  past ~600 taijis is rejected at mint, so increase `depth`/`branches`
  gradually.
  - `foliage` modes: `'leaves'` (individual leaves, `leafCount` each) ·
    `'cluster'`/`'wig'` — ONE round foliage-puff blob per twig (`clusterSize`;
    far fewer objects) · `false` (bare winter skeleton). Default `'leaves'`.
  - **Thick old tree recipe:** large `stemRadius` (~0.6) + high `radiusRatio`
    (~0.8, so limbs stay thick) + high `crook` (~0.25, gnarl) + wide
    `branchAngle` (~50) + sparse `leafCount`.
- **grove** — a landscape / forest **repeater**: scatter `count` trees across a
  `region` (`{width, depth}`) with deterministic NATURAL variation — at
  `variation: 0` the trees are clones; higher mixes **structure** (branch
  count + depth), **thickness** (trunk girth + taper), **foliage cover**
  (cluster mass + leaf count), plus position, height (`sizeRange`), lean,
  branch angle, twist, and a cycled green shade — on an optional sinusoidal
  ground
  (`groundAmplitude`, so trees follow terrain). The per-tree `tree` template
  carries any tree knobs (incl. `foliage:'cluster'` wigs). `variation`
  (0..1) sets how much the trees differ. Bounded for the browser (compose with a
  manifest `waveFields` floor for the actual painted ground).
- **disc** — the **radial golden-circle** capability as its own form: pack
  `count` small taiji waveforms on a disc by the 137.5° golden angle (the same
  rule a sunflower seed-head uses). `dome` bulges the packing into a
  paraboloid (a domed sunflower); `length > 0` turns it into a prolate
  **ovoid** — a pinecone / seed-cone — with `capsule` elements reading as
  overlapping scales. `radius`, `elementProfile`, `elementSize`, `elementTwist`
  tune it. One capability → sunflower heads, seed-heads, succulent crowns, and
  pinecones.

## Dials worth knowing

- `divergence` is the single phyllotaxis knob: the golden default fans leaves
  so none overlap; `0.5` gives strict 2-ranked (distichous) leaves.
- `leafProfile` flips a leaf between pointed (`spindle`) and blunt/tongue
  (`capsule`) — the same flip that turns a leaf into a stem.
- `taper` is the self-similarity ratio — lower = faster shrink toward the apex.
- `detail` controls how heavy the SVG is: each taiji draws a partition mesh
  of ~`crossSections × samples` segments, and a plant has many taijis, so the
  default `medium` is already far lighter than a single hero taiji. Reserve
  `high` for one close-up; `crossSections` / `samples` override the preset.
- **Browser budget (enforced, the "don't go crazy" rule):** if a plant would
  exceed ~6000 line segments and you have NOT pinned `detail` /
  `crossSections` / `samples`, it silently drops to `low` — so the default
  path is always renderable. The whole manji-tree is hard-capped too: a
  manifest past ~30000 segments throws at mint with the fix. You rarely think
  about this; it just keeps pages fast.
- The compiled taijis merge with any hand-authored `taijis` and are bounded
  (≤ 600 per plant).
- `paint` is the **wave→world lowering** — how the forms are rendered, not
  what they are. `'silhouette'` (DEFAULT) fills each form as a solid
  swept-envelope shape — real volume, and *lighter* than wireframe (one polygon
  per form). `'fibers'` fills + loads each form with fibers that lean with the
  taiji twist (pennation) — painterly, imperfect-cel matter, best for a hero
  plant (heaviest). `'brush'` renders each form as thin strand strokes — a
  **brushy / sketchy** look rather than filled shapes. `'lines'` opts back to
  the wireframe vein/banding read.
  The form vectors are identical across all modes; only the print differs. See
  [wave-to-world-paint.plan.md](../../../lite-template/integration/0609/wave-to-world-paint.plan.md).

## When to reach for it

- A **plant, sprig, leaf, fern, flower, sunflower, vine, or rosette** — any
  time you want plant-like geometry without placing each leaf by hand.
- NOT for a single handed coil or double helix with no foliage — that is the
  `taiji` primitive directly (a plant is a *composition* of taijis).
- For a deeply ridged bark trunk or a flared flower tube, pair a plant with a
  `lathe` (angular harmonics carve bark flutes; a profile sweep makes a
  corolla); the plant macro draws the foliage and stems.
