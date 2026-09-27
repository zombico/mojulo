# Female polygonal head — iteration principles

The runtime female head is no longer authored from this target. Its rings are resampled from a head fitted to
three references (`head-fit.mjs`, `female-head-fit/`). The rules below still govern the head-map study, and
rules 1–3 and 7 hold for the fitted head by construction.

This file records the visual and construction rules for the independent female head target. It is the durable
review contract for `render-female-head-map.mjs`. Update a rule here when visual review changes the target;
update the owning control in the renderer; regenerate all three views; then record the outcome in the planar
humanoid integration log. Do not repair one projection with view-specific points.

## Construction principles

1. **One source, three views.** Front, three-quarter and profile are physical-camera projections of one named
   point field. A point may move only in shared Meru space. The views never own corrective offsets.
2. **Meru owns scale and depth.** `+x` is character-right, `+y` is forward and `+z` is up. Cranial shell,
   facial field, feature field and nasal projection remain explicit depth bands under one world-unit ruler.
3. **Mandala owns the correspondence.** The axis-mundi fixes crown-to-chin order. Bilateral bars fix the eye,
   cheek, nose-base, mouth, jaw and ear relationships. Start bilaterally, then add an authored asymmetry such as
   the side-swept fringe after the mirrored scaffold exists.
4. **Silhouette precedes features.** Accept the cranium, facial mask, jaw, ear, neck and ponytail silhouettes at
   128 px in all three views before tuning eyes, nostrils, lips or seam styling.
5. **Width and projection are independent.** A human nose widens downward in `x` while remaining compact in
   `y`. The alar base must stay at least 2.5 times the root half-width, while root-to-tip projection stays at or
   below 0.045 m for this target. Never create the wider base by pushing the entire lower nose forward.
6. **The upper mouth belongs to the nose.** Columella, nostril, alar-base, philtrum, cupid and mouth-corner
   points form one descending construction. Nose-width iteration carries the philtrum and mouth span with it.
7. **Eyes are surfaces in orbits.** The almond, iris and pupil sit inside the brow/lower-orbit field and obey
   camera occlusion. The far eye narrows at three-quarter and disappears behind the profile; feature layers do
   not bypass depth to force it visible.
8. **Cheek volume bridges orbit and jaw.** The malar crest is broad and slightly forward. Lower-cheek planes
   should carry that volume toward a soft mandibular taper rather than producing one long gaunt diagonal.
9. **Hair, ear and ponytail are one closed silhouette system.** Hair wraps the cranial shell with convex
   presentation faces, the ear remains legible in front and profile, and the ponytail has front/back depth at
   every station. An open ribbon or detached tail fails the silhouette gate.
10. **Presentation and construction are separate.** The beauty SVG uses filled facets and subtle shared seams.
    Hidden edges, labels and strong line hierarchy belong to the construction SVG.
11. **Prefer stable semantic planes.** Keep point and plane ids when tuning proportions. Add topology only when
    a named region cannot express the required surface. Presentation polygons should be convex or split into
    convex patches so camera projection cannot create spikes or self-intersections.
12. **Machine gates support the human gate.** Determinism, ids, flare ratio, nose projection, ear clearance,
    ponytail volume and required cameras are audited automatically. Likeness and style acceptance remain a
    visual decision against the independent target sheet.

## Updatable controls

`DESIGN_CONTROLS` is the first iteration surface. It is embedded in the JSON recipe and copied beside every
render.

| Control | Owns | Primary review views |
| --- | --- | --- |
| `proportions.positiveHeadHeight` | Crown-to-chin compactness | Front, profile |
| `proportions.upperSkullWidth` | Parietal, temple, hair and ear span | Front, profile |
| `proportions.malarWidth` | Eye, brow, cheek and zygomatic span | Front, three-quarter |
| `proportions.jawWidth` | Gonion, jaw-front and chin taper | Front, three-quarter |
| `proportions.neckTopWidth` | Neck attachment beneath the jaw | Front, profile |
| `nose.rootHalfWidth` | Narrow facial attachment | Front |
| `nose.bridgeHalfWidth` | Dorsal plane width | Front, three-quarter |
| `nose.tipHalfWidth` | Supratip and tip breadth | Front, three-quarter |
| `nose.alarHalfWidth` | Bottom flare and nostril span | Front, underside read |
| `nose.rootY`, `bridgeY`, `tipY`, `alarY`, `columellaY` | Profile depth sequence | Three-quarter, profile |
| `eyes.width`, `eyes.height`, iris radii | Almond and iris proportions | Front, three-quarter |
| `mouth.halfWidth`, lip heights | Quiet mouth span and thickness | Front, profile |
| `presentation.*` | Facet seam strength and light range | All beauty views |

## Iteration procedure

1. State the visual discrepancy by region and view.
2. Change the smallest owning control. Regenerate front, three-quarter, profile and construction SVGs together.
3. Inspect the 128 px silhouettes before enlarged feature detail.
4. Run the embedded audit and the humanoid/hero tests.
5. If controls cannot solve the discrepancy, add stable named points and convex semantic planes to the shared
   source. Record the new ownership here.
6. Update the integration plan with what changed and what remains a human visual gate.

Current target-specific decisions: compact rounded cranium; broad orbital/malar field; soft jaw and short chin;
large almond eyes; short nasal projection with a clearly wider base; shallow upper lip; visible polygonal ear;
asymmetrical swept fringe; closed low ponytail; minimal blue shoulder yoke for headshot framing; warm facets with
restrained seams.
