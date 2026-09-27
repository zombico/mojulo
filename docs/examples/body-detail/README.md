# Body detail: the head's principles on the body's segments

The [head detail example](../head-detail/README.md) grew detail from the skin and articulated a face. This example
applies the same principles one scale over, to the [dragon body](../dragon-body/README.md)'s segments. It is a
post-compile layer over the body recipe; it never edits the recipe.

The passes are core since the hero became their second body: `control/lib/graph/polygonizer/station-loft-body.js`
holds them species-free, and `body-detail.mjs` is the dragon's BODY DATA over them (the lift was byte-identical). The
hero wears the same passes with its own parameters (`hero-dress.js`, `detail: 'clothed'`), baked into its recipe
through the plan's `body` block, so there they ride the dials and the rig. Two core fixes came with the second body
and changed this example's render (not a stored recipe): a refined ring's left-side slot next to the front midline
was inserted before its neighbour instead of after it (a fold on every refined left limb), and a pad's inner faces
now keep their `PadInner` group.

## The fact it is built on

Each segment's bind already declares where the body bends and where it is rigid: a limb's end stations are 50/50
blends with the neighbouring bone, its middle belongs to its own bone. Every pass reads that.

## Passes

| Pass | Head principle | On the body |
| --- | --- | --- |
| Density | polygons where the face moves | every limb, the tail and the torso refined (stations halved, limb rings 6 → 12 slots); claw pins migrated by address |
| Volume | `volumize` by name | chest, biceps, quadriceps, calf |
| Bend creases | driven strips | two rows either side of each of 25 joints, one strip per ring quadrant; height = how much the quadrant faces the INSIDE of the bend × the bend angle, both read from the compiled mesh, so a dial or pose raises them |
| Rigid detail | tiles yield to regions | belly and tail scutes, forearm and shin scales, thigh and shoulder plates, grown only where ONE bone dominates the whole footprint (≥ 0.8), so skinning can never shear them |
| Pads | the inner-ear dish | palm and fingertip pads on the side the joint FLEXES toward (the bend read at the drive's extreme, turned into a pose-free address), sole pads on the ground side |
| Spurs, spines, rings | sweeps and collars | elbow and hock spurs on the outside of the bend, a dorsal spine row on symmetric midline frames, tail rings |

## Rules

1. Core is capability; the body is data (joint table, tile windows, pad and spur placement, spine rows).
2. Rigid on rigid: a rigid detail sits where its dominant bone's weight is at least 0.8 over its footprint. Decided at
   rest, so no dial or pose changes the detail set.
3. Driven by declared inputs only: creases rise with the bend the dials make; nothing is keyed per pose.
4. A joint's inside is the side its drive flexes toward, not the rest shape (the knuckles are nearly straight at rest,
   so the rest bend is noise).
5. Clearance is judged on drawn vertices: at full grip no claw vertex is inside a hand.

## Checks

`test-body-detail.mjs`: closure at rest and posed; determinism and a pose-independent detail set; the rigid rule;
the palm pad faces the flex direction; claws clear the hands at full grip.

Not certified: the limb creases are faint at rest (shallow bends; a `floor` in the data raises them, the hero's
sleeve folds use one); forearm and thigh scale patches are small (the rigid zone of a 3-station limb is its middle).

## Reproduce

```sh
node --test docs/examples/body-detail/test-body-detail.mjs
node docs/examples/body-detail/body-detail.mjs   # body-detail.png + stats.json in the spike tree (or MOJULO_SPIKE_OUT)
```
