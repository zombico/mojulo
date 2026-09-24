# Spatial wire SVG: authoring and fidelity contract

The target is the [detailed raccoon head wire artifact](examples/raccoon-head-wire/head-three-quarter.svg):
a clear vector drawing that remains attached to one spatial construction under
camera rotation. SVG is the primary inspectable artifact. A flattened, single-view
illustration without source coordinates and projection information does not meet
this contract, however readable it is.

## Reference implementation and scope

[The example](examples/raccoon-head-wire/README.md) includes a portable generator,
source data, the canonical three-quarter SVG and numerical tests; the generator
regenerates the other views, a construction view and a turntable preview into the
gitignored spike output tree rather than storing renders in docs. It imports the existing authored head and preserves its geometry.
It demonstrates a rendering/mapping boundary; it does not implement a new native
Mojulo primitive, automatic image reconstruction, an SVG importer, or rigging.

The original landmark study established projected point identity and camera
consistency with a known ring-loft control. Its twelve points did not contain the
later detailed head. Do not claim the new facial points were recovered from that
control, or identify them with old landmarks merely because they are nearby.
The reference head is authored geometry, with its own persistent point identities.

## 1. Author a spatial scaffold, not disconnected views

Use Mojulo's cardinal frame, named anchors and per-part frames to locate the form.
Declare origin, scale, facing, anatomical left/right, and the meaning of each anchor.
Distinguish measured observations from authored points and inferred construction.
Undefined depth stays unresolved until explicitly designed or supported by evidence.

A head needs meaningful spatial control over skull width/depth, brow/cheek planes,
eye centers, muzzle projection, jaw, ear bases/tips and the rear skull. Rings and
profiles can supply the rounded back, while explicit planes supply recognizable
facial structure. Preserve the same anchors when moving the camera. Never redesign
the profile or back independently to make an isolated view look better.

Native construction should consume existing mechanisms where applicable:
addressable manji slots, line-between endpoints, wave-field pins, singularity-relative
wave forms, or declared loft/ring profiles. These mechanisms require explicit
frames and connectivity. An SVG that looks plausible does not infer those inputs.
The reference's bounded region centers are labeled as such, not anatomical joints.

## 2. Separate form edges from triangulation

Keep semantic region identity through surface compilation. Classify edges as:

| Role | Meaning | Reference output |
| --- | --- | --- |
| Contour | Surface boundary or camera-dependent silhouette | Strongest visible line |
| Feature | Eye, nose, mask, muzzle or inner-ear structure | Medium line |
| Form plane | Meaningful change in surface direction | Light line |
| Tessellation | Internal division without meaningful form change | Suppressed |
| Hidden construction | A real edge occluded by another surface | Absent in clean mode; faint/dashed in diagnostic mode |

The example derives candidate edges from original polygon connectivity. It
suppresses nearly coplanar neighbors below seven degrees, except region boundaries
or silhouettes. It uses a named feature-region set and surface facing for line
hierarchy. Those are explicit reference policies, not universal anatomy rules.
A native adapter should carry intentional crease/material/feature roles where they
exist rather than guessing all semantics from normals. Internal diagonals added
only to triangulate an n-gon must not automatically become feature lines.

Do not add facets just to increase apparent detail. Eye and muzzle intersections
must remain readable, and larger forehead/skull planes should stay quieter.
Review silhouette, facial structure and construction density independently, all
from the same spatial source. These are rendering passes, not separately drawn art.

## 3. Project through an explicit camera

Record camera azimuth/elevation or a complete basis/position, target, distance,
focal length, principal point and viewport. State the basis convention and SVG's
downward y direction. Reject points behind the camera unless a near-plane clipping
policy is implemented. Do not silently resize or warp one view to make landmarks fit.

The reference uses a physical perspective camera with world z up, +y front for the
authored head, and pixel y down. The four cameras use the same framing parameters;
only azimuth changes. Stable source IDs remain identical through the full orbit.

A screen-space point along an edge is not generally the same linear parameter on
its spatial edge. With endpoint depths z0/z1 and projected interpolation s, store
`t = (s/z1) / ((1-s)/z0 + s/z1)` for the original 3D segment. The example includes
`data-source-t` on every visible/hidden run and tests reprojection. This makes a
clipped SVG stroke traceable to more than just a pair of point names.

## 4. Resolve visibility before styling

Surface geometry may be used as an invisible occluder without painting filled
polygons. Compare an edge's perspective-correct depth against covering triangles
at the exact same projected sample position. Comparing to a neighboring raster
pixel can incorrectly break a continuous silhouette into dashed fragments.

The reference samples at half-pixel intervals in its 900-square viewBox, with a
1e-5 world-unit depth tolerance. It splits visible and hidden runs and omits runs
shorter than 0.7 viewBox units. Consequently transition positions and tiny details
have a sampling limit. It is not an exact analytic segment-clipping implementation.
Tolerance must scale appropriately if world units change; these values are tied
to the supplied head. Intersecting or coincident surfaces need explicit policies.

Clean mode draws only visible runs. Construction mode draws hidden runs faintly
and dashed, behind visible lines. Never present an x-ray wireframe as hidden-line
removal, and never make the clean output depend on surface fills hiding bad edges.

## 5. Apply deliberate line hierarchy

The supplied 900-square reference uses 2.7-unit contours, 2.0-unit feature edges and
1.05-unit plane edges, with rounded caps on a light neutral ground. Construction
lines use 0.8 units and a 3/5 dash pattern. Keep these defaults together as a style
policy. Alternate palettes or scaling should preserve hierarchy and legibility.

This is an output-fidelity baseline, not a demand to copy one palette. Assess the
actual displayed/export size. At thumbnail size the ears, eyes, muzzle, cheeks and
rounded cranium should read; at full size joins and visibility transitions should
be clean. A dense all-edges mesh screenshot is not an equivalent deliverable.

## 6. Preserve spatial meaning in the SVG

Each primary SVG includes:

- Versioned source metadata with the same 3D coordinates, faces, region identity,
  frame and source provenance as every other view.
- Separate projection metadata describing the exact camera and visibility policy.
- Unique path IDs, a stable source edge pair, spatial parameter interval, edge role
  and visibility state for every rendered run.
- Vector paths, not a raster screenshot embedded inside an SVG wrapper.

The path's run number can change when occlusion changes. Persistent identity lives
in the source edge pair and spatial interval, not its position in the painter list.
Editing a projected `d` attribute alone is a view override, not an edit to spatial
form. Edit the source and regenerate the projections. A native spatial editor must
make this distinction explicit and preserve point IDs when changing coordinates.

The reference stores point identity as indices in a frozen source array. A native
editable recipe must provide durable IDs across insertions/deletions and maintain
an explicit mapping through tessellation. Do not promote array indices to an
unqualified cross-version identity guarantee.

## 7. Ship a reviewable artifact set

Minimum delivery: spatial source, clean front/quarter/profile/back SVGs, a diagnostic
construction SVG, a turntable of the same source, and regeneration instructions.
Include machine checks and an explicit statement of implementation limits. The
turntable preview may be raster; the primary fixed views must remain editable
vectors with embedded spatial meaning.

Machine gate: deterministic SVG generation; valid finite coordinates and indices;
positive camera depth; identical source metadata in all views; unique path IDs;
known visible/occluded/coplanar fixtures; perspective depth correctness; clipped
stroke reprojection onto its original spatial edge. Native integration must also
test persistence through primitive edits and compare emitted points to the engine.

Human eyes gate: inspect front, side, back and the complete orbit. Check uninterrupted
contours, readable eyes/muzzle, no rear-edge leaks, no artificial line flicker, and
clear hierarchy. Machine tests and agent inspection do not substitute for this gate.

## Next native step

Adapt one existing spatial head recipe to the reference renderer contract. Show a
single anchor/profile edit updating every SVG, while a camera edit changes no
geometry and a line-style edit changes no coordinates. Only then expose the reusable
operation through the appropriate existing capability surface. Binding and animation
remain separate consumers of the same spatial construction, not prerequisites for
high-fidelity wire SVG output.

## Named attachment experiment

The [layered head example](examples/raccoon-layered/README.md) exercises the next
boundary: a native pure named-surface-frame query drives a standalone compiler.
Baseline and widened-skull/lengthened-muzzle views use the same attachment recipe.
Eyes, ears and nose retain local offsets; brow creases reuse L1 edges. Explicit
point and face keys survive property reordering, and unresolved pins fail. The
example preserves the previous head rather than introducing a station-loft schema.
Native recipe-book exposure, generalized topology-edit migration and rigging remain
separate follow-up work.
