# Male head fit (frozen data)

The male humanoid head's source surface. `../head-fit.mjs` resamples it into the landmark head's rows and slots,
then builds the cheek planes and the jaw's meeting with the ear. Nothing here is solved at read time.

- `head-source.json`: one exactly symmetric head, 96 named points and 96 named polygon faces. It also carries
  the fit's corrected triangulation (`occluderTriangles`: concave faces split properly, mirrored exactly), which
  the sampler uses. Fit units, +x right, +y front, +z up.
- `landmarks.json`: hand-placed pixel targets on the two 600 px references (three-quarter, side).
- `fit-report.json`: the fitted orthographic camera per reference (yaw about 40° and 74°) and each landmark's
  residual.

## How it was made

One screenshot holding two views was cropped (uniformly scaled, never warped) into the three-quarter and side
references. The points and both cameras were fitted jointly with bounded robust least squares. The half-head is
parameterized once and mirrored, so the symmetry is exact. Mean residuals are 2.4 / 2.1 px, in-sample distances to
hand-placed landmarks rather than anatomical accuracy.

**There is no front reference.** The head's width across the face, and the balance of width against depth, rest
on the template and its priors more than on the images. The front view in the review render is a 0° projection
of the same head, marked inferred and never scored. Hair and neck are not modelled; the ear patches are open
flaps and are not sampled.

The reference crops are the operator's and are not in the repo. `../render-head-fit.mjs` reads them from
`MOJULO_FIT_REFS/male/`.

## Changing it

A new fit replaces all three files together. Re-pin their hashes in `../test-humanoid.mjs`, re-render, and look.
