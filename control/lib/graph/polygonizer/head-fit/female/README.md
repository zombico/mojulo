# Female head fit (frozen data)

The female humanoid head's source surface. `../../humanoid-head-fit.js` resamples it into the landmark head's rows and slots,
then builds the cheek planes and the jaw's meeting with the ear. Nothing here is solved at read time.

- `head-source.json`: one exactly symmetric head, 110 named points (a midline plus mirrored `…R` / `…L` pairs)
  and 118 named polygon faces in regions (face planes, nose, mouth, eye surface, ear inset, ear attachment,
  skull). The mesh is closed. It also carries the fit's corrected triangulation (`occluderTriangles`), which the
  sampler uses. Fit units, +x right, +y front, +z up.
- `landmarks.json`: the hand-placed pixel targets on the three 600 px references (front, three-quarter, side).
- `fit-report.json`: the fitted orthographic camera per reference (yaw about 0°, 40° and 74°) and each
  landmark's residual.

## How it was made

A spike outside the repo fitted the points and all three cameras jointly with bounded robust least squares
against 119 hand-placed landmarks. The half-head is parameterized once and mirrored, so the symmetry is exact.
Soft cheek, jaw and ear-root marks were down-weighted, and points no image sees are held near a seed. There is
no per-view geometry: each view differs only by its camera. Mean residuals are 2.8 / 2.8 / 2.4 px. Those
distances are in-sample, measured to landmarks the same author placed, not anatomical accuracy.

This is the refined pass of that fit. The 52 distinct measured landmark positions and all three cameras are kept
exactly. Around them the spike repaired the topology (duplicate nose faces removed, consistent winding, concave
faces split and mirrored), added a small cheek transition, jaw sweep points and a raised socket floor, and joined
the ears to the skull through root faces.

Hair, ponytail and neck are not modelled. The cranium under the hair is a prior, not a measurement. The ears and
their roots are not sampled; the skull openings the roots plug into are patched for sampling.

The reference images are the operator's and are not in the repo. `docs/examples/humanoid/render-head-fit.mjs` reads them from
`MOJULO_FIT_REFS/female/` for overlays.

## Changing it

A new fit replaces all three files together. Re-pin their hashes in `../../humanoid-head.test.js`, then re-render
the overlays and look. The data pins exist so the female head cannot drift silently.
