# Head detail: articulation, expression and detail in the layered grammar

The [dragon head](../dragon-layered/README.md) proved the layered loop at the scale of a head: named
stations and slots, details pinned to named faces, dials that regenerate everything. This example takes
the same principles down to detail. Doodads become small named lofts. Detail grows from and bounds
itself against the skin. A small set of facial regions articulates. Two heads share one core: the
dragon, and a bear authored from its own station table. It is a reference for what the `layered`
grammar would gain; it registers nothing.

## Rules it holds itself to

1. **Core is capability; the head is data.** `compile.mjs` has a CORE section that names no species
   (a test enforces it) and a HEAD DATA section with everything anatomical: station tables, region
   addresses, skin maps, amplitudes, ornaments and palette.
2. **Named by construction.** Face groups, refined slots, skin maps and surface addresses are names.
   Nothing is selected by proximity or index.
3. **Species-neutral expressions.** One `EXPRESSIONS` table drives both heads. A control a head has no
   region for is a no-op (`earAttitude` on the dragon, `hornCurl` on the bear).
4. **Bone and skin are declared.** Skin maps move the skin copy of L1 only. Teeth, horns, eyes, the
   crest and the tongue ride the bone copy, so a lip can lift over a tooth.

## Core operations

| Operation | What it does |
| --- | --- |
| Surface address `(part, s, t)` | Continuous station (`u`) and slot (`t`) parameters → face, barycentric weights, tangent edge; the left side mirrors by name |
| `refineStation`, `refineSlot` | Insert named stations (`st2_st3_50`) or slot pairs linearly. Parameters freeze before the first insert, so nothing renumbers and every address keeps its meaning |
| `volumize` | Push named slots out of their station ring (runs before refinement, so inserts interpolate the volume) |
| `pinToAddress`, `symmetricFrameAt` | Migrate an authored face pin to a parameter address (so it survives refinement); a midline frame from an address and its mirror |
| Tiles | Detail grown from a carrier. Each cell of an (s,t) window gets a `sides`-gon footprint of addresses on the skin (`coverage` > 1 shingles). The top is inset, raised and leaned; `edgeFade`, `wobble` and `jitter` are seeded per tile id. Tiles yield to regions (see keep-out), and `thin` drops them toward the window border by seeded chance, so a patch has no hard edge |
| Surface strip | A loft whose stations are addresses, each with its own surface frame, so it rides the skin (brows, folds) |
| `sweep` with `curl` | A spine loft in a pin frame; `curl` spreads a rotation over the stations (horns, ears) |
| `projectOnto` | Places a point on a carrier along a direction (the eye surround's outer edge) |
| `ringLoft` | A closed loop of closed sections, a torus (the eye surround) |
| Driven strip | A surface strip whose height is a declared linear combination of controls, `h × (rest + Σ drive·max(0, control))`. It is always present, at its rest height when undriven (wrinkles) |
| `collar` | A raised band round one ring of a loft, built from the loft's own points, so it rides whatever bent the loft (horn ridges) |
| `dish` | A shallow bowl: a raised rim falling to a floor, placed through a map into its host's frame (the bear's inner ear) |
| Whiskers | Thin tapering sweeps rooted at skin addresses. They droop under world gravity read through the right pin frame, so the left set mirrors by name |
| Keep-out | Every placed region claims the skin around it (world points with radii), read from the rest carrier. Grown detail yields to it |
| Sided controls | Values in [-1, 1] per side. Each control's skin map is a list of addresses with falloff radii (authored by landmark name, `st2.brow`), touching that side and the shared midline only |

## Regions

- **Eye.**
  - One eyeball whose ring bands are named `Sclera | Limbus | Iris | Pupil | LidShadow`, plus a
    `Catchlight` facet and gaze.
  - `eye.mode: 'iris' | 'solid'` with `pupil: 'round' | 'slit' | 'none'`. `solid` is the no-iris,
    fully coloured eye. Colour and glow are materials over group names, never geometry.
  - One **surround** ring (lid above, pad below, `LidRim` along the lash line) whose outer edge is on
    the skin and tucked under the **brow** strip. A brow raise opens the eye, a furrow hoods it, and a
    cheek bunch lifts the lower lid.
  - **Clearance rule: no lid or pad vertex is ever inside the eyeball.** The ball's extent is measured
    on its drawn vertices, about a centre that gaze never moves. A vertex inside that radius is lifted
    along the eye's axis onto it, so the lid drapes over the front of the ball. Lifting keeps x and y,
    so the aperture and the brow tuck are unchanged and the two rules hold together. Before this rule,
    a furrowed brow drove the lid up to 11 mm (dragon) and 15 mm (bear) into the ball.
- **Nostril.** A flared rim; `sneer` slides it, `nostrilFlare` widens it.
- **Fold.** A strip from nostril to mouth whose height is driven by `sneer` and `cheekBunch`.
- **Wrinkles (head data over the driven-strip op).** Each head has nose-bridge ridges driven by
  `sneer`, a glabella line driven by `browFurrow`, and crow's feet driven by `cheekBunch`.
- **Whiskers (head data).** The dragon has one long barbel per side, sweeping back from the snout; the
  bear has three short muzzle whiskers. Both ride the skin, so a sneer carries them.
- **Cheek web.** A sheet held between the cranium lip line (skin) and the jaw lip line (bone) over a
  run of stations. It stretches with the jaw, and its front edge is the mouth corner.
- **Density and tiles (head data).** Each head declares where refinement goes. The dragon halves its
  face stations and splits the temple and cheek bands; the bear halves its muzzle stations and splits
  flank and flew. Tile windows use the same op for different results: shingled hex scales on the
  dragon's cheek and jaw side, plates on its snout, and pointed back-leaning fur tufts on the bear's
  cheek ruff and crown.
- **Tongue.** A chain resting on the jaw floor. Its rest spine is the floor's midline sampled by
  address. `tongueOut`, `tongueCurl` and `tongueSway` re-bend it, weighted toward the tip. The tip is
  `round`, `point` or `fork`.
  - **Clearance rule: the tongue never goes below the jaw.** In the jaw's own frame (it rides the
    hinge), the floor is the jaw's underside, its midline `bottom` profile, held at the chin past
    either end.
  - A segment whose drawn ring would dip under it is turned up just enough, by bisection on the ring's
    actual vertices, and later segments inherit the turn. Lengths are kept.
  - The rings are built in exactly the frames that were checked.
  - A fork is one structure: its prongs are never thicker than the body where they leave it, and
    both take the larger of their required lifts.

## Artifacts

Kept here: `compile.mjs` (core, heads, expressions), `render.mjs`, `test-detail.mjs`. Renders land in
the gitignored `lite-template/integration/0924/spike-output/head-detail/`, or in `MOJULO_SPIKE_OUT`:

- `expressions.png`. Rows: dragon face, eye, mouth, profile; bear face, eye, mouth, profile. Columns:
  the expressions.
- `<head>-<expression>-<view>.png` (flat-shaded colour through a small z-buffer rasterizer) and
  `-face.svg` (the native wire emitter).
- `stats.json`: face counts and the per-part closure audit.

## Onto a body

`bakeLayered(head, expression)` turns a built head into a layered-recipe fragment: the refined cranium
and jaw as L1 (the expression's skin; the jaw hinge stays a live dial), every region, ornament and tile
as an L2 part pinned where it was placed, with its geometry as local offsets in that pin's frame; the
head's scale dials with blends extended to the refined stations; creases re-run along the refined
chain; the palette. Every placed part records its `pin` for this. The [dragon body](../dragon-body/README.md)
merges the baked dragon, so the detailed head rides the body's rig (cranium → head bone, jaw → jaw bone,
pinned parts inherit) and every expression is a cast.

## Checks

Machine, in `test-detail.mjs`:
- Every part of both heads is closed and consistently wound in every expression.
- Output is deterministic.
- The core names no species.
- A control without a region is a no-op.
- Bone-carried parts do not move under skin controls.
- In the eye's frame, the upper surround sits `tuck` below the brow's lower edge.
- No lid or pad vertex is inside the eyeball, for every expression and at the extremes (shut, shut and
  furrowed, wide open, gaze at 30°).
- Tiles yield to regions: no tile grows inside a keep-out. Which tiles exist never depends on the
  expression.
- Driven strips rise with their controls and are present at rest.
- Horn ridges stay centred on their horn rings under curl.
- The tongue sits on the jaw floor.
- A one-sided expression never moves the other side's points. The shared midline may move, and it
  bounds anything pinned across it.
- The tongue never goes below the jaw, for every expression and at the controls' extremes (jaw 30°
  open, tongue fully out and curled down, with and without sway), for both heads.
- Refinement keeps addresses: an address names the point on its cell's bilinear patch. The coarse
  two-triangle surface sits up to 6 mm off that patch on the dragon's non-planar cells; refined, every
  tested address is within 1 mm.

Not certified:
- **Other clearance.** The tongue's floor rule and the lids' eyeball rule are enforced. Nothing yet
  stops a strong `tongueCurl` passing up through the palate, or a tooth through the opposite jaw.
  Regions may overlap one another. General self-intersection is not checked.
- **Printability, rigging and weights.** None are covered.
- **Tile patches do not avoid each other.** Tiles yield to regions, but two tile windows may overlap.
  The windows themselves are still placed by hand.

Eyes: the agent looked at the sheets. Human acceptance is separate.

## Reproduce

```sh
node --test docs/examples/head-detail/test-detail.mjs
node docs/examples/head-detail/render.mjs
```
