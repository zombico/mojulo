# Getting the original SVG right

This is a proposed authoring workflow and handoff contract, not an SVG importer
already implemented in Mojulo. Its output is a resolved drawing that can guide
construction. It must also be useful when no 3D mesh or rig is ever made.

## Start by distinguishing the source artifacts

The earlier `control-v01.svg` study is a projected line/landmark scaffold with a
1024-square viewBox. Its role is correspondence and projection control. The later
body and character scripts authored geometry; they did not demonstrate automatic
conversion of a finished character SVG into an animated mesh.

Keep three artifacts distinct: the reference image or brief; the editable design
SVG; and the measurement scaffold projected over that SVG. A scaffold can be
numerically exact and visually unconvincing. An expressive illustration can be
excellent while providing insufficient evidence to reconstruct its hidden volume.

## 1. Write a visual specification before adding paths

Choose the view and pose deliberately. Use a front or declared three-quarter hero
view for recognition, with separated limbs if the drawing will guide construction.
A dramatic perspective pose is valid artwork, but cannot double as an unqualified
orthographic measurement sheet. Record facing direction and anatomical left/right;
left on the page is not necessarily the subject's left.

Name three to five recognition requirements. For the raccoon these might be broad
cheeks, a tapering muzzle, a continuous dark eye mask, pointed ears and a rounded
cranium. For a basketball dinosaur: a readable snout, substantial bent legs, raised
heels, a balancing tail, and a jersey that leaves the body silhouette clear.
These are design targets, not claims that a particular proportion is correct.

Record ratios rather than copying isolated pixel coordinates: head/body height,
cheek/head width, eye separation/head width, muzzle/head height, shoulder/hip width,
and foot/leg length. Choose the actual values from the reference or the intended
style. Mark each as measured, intentionally designed, or currently uncertain.
Set an explicit detail budget: large silhouette masses first, recognition features
second, small decorative facets last. Polygon count alone does not measure success.

## 2. Fix the canvas and build the silhouette

Use a fixed viewBox and a declared subject bounding box with margins. Keep the
subject centerline, ground line and major height guides on a non-exported layer.
Store measurements in subject-normalized coordinates as well as viewBox units:
`u = (x - subjectLeft) / subjectWidth`,
`v = (y - subjectTop) / subjectHeight`. SVG y increases downward; do not reuse it
as world z without an explicit projection/conversion.

Draw one flat silhouette without internal facets, eyes, shadows or jersey numbers.
Adjust the large masses until the character reads at thumbnail size. Inspect the
negative spaces between arms/torso, legs, tail/body and ears/head. Excess detail
cannot rescue an ambiguous outline. Check cropping and accidental tangencies.

Use a small number of purposeful contour corners. Place corners where direction
or mass changes: ear tip, cheek apex, jaw turn, shoulder, elbow, knee, heel, toe.
Low-poly style does not require every contour segment to be equally short. Long
quiet edges make the important angles easier to read.

For a symmetric front view, author one side against the centerline, mirror it, then
introduce deliberate asymmetry only where wanted. For three-quarter views, symmetry
belongs to the subject, not the canvas: do not mirror screen-space eye or cheek
coordinates and assume perspective will remain convincing.

Gate: review the silhouette alone at intended display size and as a thumbnail.
Record a human decision separately from any agent inspection. Until that decision,
call the drawing a candidate, not an approved design.

## 3. Place features with an explicit landmark hierarchy

Add stable semantic anchors before the facets: skull crown, chin, cheek extrema
for this view, eye centers, nose center, muzzle corners, ear bases/tips, shoulder
centers, pelvis and visible joints. Give every point an ID and a visibility state.
Distinguish a semantic center from a chosen material point or contour observation.
An eye center is not automatically a mesh vertex. A silhouette extremum can slide
along the surface as the camera moves; it is not automatically cross-view identity.

Place the eyes as a pair, then the muzzle/nose relative to them. Check eye-line
height, eye separation, muzzle width and the gap between the mask and outer cheek.
Build the mask as a designed region around those anchors, rather than treating a
random set of dark triangles as a face. Check the expression before adding glints.
A small vertical change to an eye or brow can matter more than many extra facets.

At this stage use a few flat fills: body, facial mask, muzzle, clothing, accessories.
Check grayscale readability and whether adjacent regions merge at thumbnail size.
Keep material colors separate from illustrative lighting. A dark plane may be a
shadow, dark fur, or a recessed surface; record which, because the mesh compiler
must not silently interpret every dark patch as depth or a new material.

## 4. Design the planar language

Break regions along meaningful changes in form: brow to forehead, cheek to muzzle,
front to side of torso, shoulder cap to upper arm. Use broad planes on broad masses
and finer divisions around recognition features. Avoid triangulating the entire
page uniformly and hoping it will look intentional.

Classify every important edge:

| Edge role | Meaning downstream |
| --- | --- |
| Silhouette | Visible outline in this specific view |
| Form crease | Intended change of surface direction; depth still needs authoring |
| Material boundary | Color/texture change that may share a continuous surface |
| Occlusion | One region hides another in this view |
| Graphic shading | Illustration only unless explicitly promoted to geometry |
| Construction guide | Measurement/reference; omitted from finished artwork |

Build neighboring filled regions from shared points where an exact junction is
intended. Avoid slivers, accidental gaps, duplicate overlaps and heavy outlines
that hide poor joins. The visual plane map does not have to be the eventual mesh
triangulation: one drawn plane may contain several coplanar triangles, and one
material patch may span many surface faces.

Review four passes independently: silhouette only; flat material regions; full
facets; and a landmark overlay. This reveals whether the facets improve the form
or merely decorate it. Also inspect at 100% for seams and at a small size for the
face/expression. A pretty full-size render should not conceal a weak silhouette.

## 5. Make the SVG editable and the handoff explicit

Suggested layers: `guides`, `silhouette`, `base-regions`, `features`, `plane-shading`,
`accessories`, `landmarks`, `annotations`. These names are conventions for the
proposal, not reserved engine keywords. Give semantic regions stable IDs such as
`head.cheek.L`, `head.mask.L`, `head.muzzle`, `jersey.front`, `leg.L.hock`.
Do not use path-array indices as persistent identities.

Keep visual geometry in the SVG and structured meaning in an accompanying record.
For example, the proposed sidecar can describe a region without assigning bones:

```json
{
  "version": 1,
  "view": { "kind": "authored-orthographic-front", "svgYAxis": "down" },
  "regions": [
    { "id": "head.mask.L", "svgId": "mask-left", "role": "material-boundary" }
  ],
  "landmarks": [
    { "id": "eye.L.center", "uv": [0.62, 0.22], "visibility": "visible",
      "provenance": "designed", "correspondence": "semantic-center" }
  ]
}
```

The numbers illustrate syntax, not measured raccoon coordinates. A measurement
record additionally needs source hashes, viewBox/subject bounds, uncertainty units
and the projection/calibration evidence appropriate to its view. Keep hidden points
null rather than inventing measurements. A SVG path ID need not map one-to-one to
vertices, regions or bones, so retain a separate mapping at each later boundary.

For a future importer, define a supported SVG subset before promising arbitrary
file support: paths/polygons, fills, transforms and holes require explicit handling;
text, strokes, clipping and filters need declared lowering or clear rejection.
Flatten transforms in a deterministic compilation copy, preserve the editable
source, and define curve sampling error in viewBox units. Rendering an SVG correctly
is a different guarantee from producing a valid closed mesh from it.

## 6. Freeze a design candidate before adding depth

Save the source SVG, sidecar, preview and review notes together with a revision/hash.
Compare silhouette and landmarks to the reference overlay if reproducing an existing
character. Use stated pixel or normalized tolerances based on annotation precision;
there is no universal five-pixel pass threshold. For an invented character, design
approval replaces reference-matching claims.

For multiple views, decide whether they are independent designs or projections of
one shared construction. Front/back should agree on declared heights and widths;
side views constrain depths, but only after pose and projection are reconciled.
Do not average inconsistent drawings into a falsely precise model. Record the
conflict and choose a design revision or an explicit volume assumption.

The back of a head, muzzle projection and hidden ear thickness generally require
authoring beyond one view. Preserve those decisions in the volume recipe, separate
from measured drawing coordinates. Project the proposed volume back onto the frozen
SVG to inspect silhouette and landmark discrepancies. Keep a held-out view where
possible. A fit to one outline can have many valid depth solutions.

Only after volume decisions are accepted should topology and binding take over.
The rig should follow the intended anatomy, while preserving the visual design's
identity; it should not automatically place a joint at every SVG corner.

## First useful native demonstration

Implement an editable raccoon-face SVG with the four review passes and its proposed
sidecar first. Validate ID uniqueness, finite coordinates, reference integrity and
repeatable serialization. Show a change to eye spacing updating the face design
without requiring a rig, and a material-color change leaving the landmarks intact.
Then author a rounded volume, overlay its projection against the frozen design,
and expose the depth decisions. Finally bind the accepted head and demonstrate a
head turn without facial-detail drift. Each step gets its own output and acceptance
record; no single “looks good” render substitutes for all four demonstrations.
