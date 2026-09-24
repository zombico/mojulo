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
| Surface address `(part, s, t)` | Continuous station and slot parameters → face, barycentric weights, tangent edge; the left side mirrors by name |
| `refineSlot`, `volumize` | Insert a named slot pair between two slots on every station, then push named slots out of their station ring |
| Surface strip | A loft whose stations are addresses, each with its own surface frame, so it rides the skin (brows, folds) |
| `sweep` with `curl` | A spine loft in a pin frame; `curl` spreads a rotation over the stations (horns, ears) |
| `projectOnto` | Places a point on a carrier along a direction (the eye surround's outer edge) |
| `ringLoft` | A closed loop of closed sections, a torus (the eye surround) |
| Sided controls | Values in [-1, 1] per side; each control declares a named skin map with an amplitude |

## Regions

- **Eye.**
  - One eyeball whose ring bands are named `Sclera | Limbus | Iris | Pupil | LidShadow`, plus a
    `Catchlight` facet and gaze.
  - `eye.mode: 'iris' | 'solid'` with `pupil: 'round' | 'slit' | 'none'`. `solid` is the no-iris,
    fully coloured eye. Colour and glow are materials over group names, never geometry.
  - One **surround** ring (lid above, pad below, `LidRim` along the lash line) whose outer edge is on
    the skin and tucked under the **brow** strip. A brow raise opens the eye, a furrow hoods it, and a
    cheek bunch lifts the lower lid.
- **Nostril.** A flared rim; `sneer` slides it, `nostrilFlare` widens it.
- **Fold.** A strip from nostril to mouth whose height is driven by `sneer` and `cheekBunch`.
- **Cheek web.** A sheet held between the cranium lip line (skin) and the jaw lip line (bone) over a
  run of stations. It stretches with the jaw, and its front edge is the mouth corner.
- **Tongue.** A chain resting on the jaw floor. Its rest spine is the floor's midline sampled by
  address. `tongueOut`, `tongueCurl` and `tongueSway` re-bend it, weighted toward the tip. The tip is
  `round`, `point` or `fork`.

## Artifacts

Kept here: `compile.mjs` (core, heads, expressions), `render.mjs`, `test-detail.mjs`. Renders land in
the gitignored `lite-template/integration/0924/spike-output/head-detail/`, or in `MOJULO_SPIKE_OUT`:

- `expressions.png`. Rows: dragon face, eye, mouth, profile; bear face, eye, mouth, profile. Columns:
  the expressions.
- `<head>-<expression>-<view>.png` (flat-shaded colour through a small z-buffer rasterizer) and
  `-face.svg` (the native wire emitter).
- `stats.json`: face counts and the per-part closure audit.

## Checks

Machine, in `test-detail.mjs`:
- Every part of both heads is closed and consistently wound in every expression.
- Output is deterministic.
- The core names no species.
- A control without a region is a no-op.
- Bone-carried parts do not move under skin controls.
- A one-sided expression leaves the other side untouched.
- In the eye's frame, the upper surround sits `tuck` below the brow's lower edge.
- The tongue sits on the jaw floor.

Not certified:
- **Self-intersection and clearance.** A strong `tongueCurl` with a half-open jaw can pass through
  the palate; lids and teeth have the same exposure.
- **Printability, rigging and weights.** None are covered.
- **Skin maps keyed by station and slot**, rather than by address plus falloff, do not survive
  refinement.

Eyes: the agent looked at the sheets. Human acceptance is separate.

## Reproduce

```sh
node --test docs/examples/head-detail/test-detail.mjs
node docs/examples/head-detail/render.mjs
```
