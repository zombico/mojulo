# Planar drawing: spatial SVG construction and rigging

Status: capability proposal, a custom-rest posing correction, and a standalone
wire-SVG reference implementation, and a named-surface attachment experiment. No new MCP tool or native primitive is registered.

## The artifact standard

The primary artifact is a **3D-mappable SVG**, not an independently composed 2D
illustration. Its paths are views of persistent spatial points, edges and surfaces.
The detailed [raccoon head wire example](examples/raccoon-head-wire/README.md) sets
the output fidelity target. See [the SVG contract](planar-drawing-svg.md) for the
construction, projection, visibility and review requirements.

This follows Mojulo's [three representation spaces](POLYGONIZER-SYNTHESIS.md#the-three-representation-spaces):
mandala-space supplies the cardinal scaffold and addressable points; wave-space
supplies geometric form; rendering projects that form. SVG is a primary inspectable
delivery of this construction, while embedded spatial data preserves its meaning
across views. A single attractive silhouette is insufficient evidence of this contract.

## Separate the concerns

| Concern | Owns | Produces | Does not decide |
| --- | --- | --- | --- |
| Spatial scaffold | Named anchors, identity, axes, scale and relationships | Addressable points and local frames | Camera-specific path coordinates |
| Form | Profiles, rings, facial planes, depth and closure | Shared spatial surfaces and edge roles | Line weights or camera composition |
| Projection | Camera position, basis, focal length and viewport | Projected points with positive depth | New geometry for each view |
| Wire visibility and style | Occlusion, contour/feature/plane hierarchy | Clean wire and diagnostic construction SVGs | Hidden depth or anatomical joints |
| Binding | Bone hierarchy, inverse bind transforms and weights | Validated rest skin | Artistic proportions or pose timing |
| Motion | Limits, pose intent, support/contact and clips | Articulated spatial construction | Independent screen-space deformation |
| Export | Units, metadata, stable IDs and serialization | SVG, mesh or animation delivery | Repairing upstream inconsistencies |

The logical flow is scaffold → form → projection/visibility → SVG. Binding and
motion consume the same spatial identities; a posed construction then projects
through the same renderer. SVG metadata includes the source and camera. Standalone
JSON is a convenient equivalent source, not a replacement for the SVG handoff.
Changing a camera never changes source coordinates. Editing geometry invalidates
its projected views and binding evidence; editing strokes does not alter geometry.

The example imports the already authored detailed head. It demonstrates spatial
mapping and output fidelity, not a character generated natively from manji/vajra
constraints. Its region names and source data are study conventions. A native
adapter must explicitly map them to validated Mojulo anchors and forms; proximity
alone must not be treated as identity or attachment. No reusable agent skill has
been installed by this branch.

## Construction contract

A character is a deterministic recipe of anatomy, surfaces, bindings and poses.
Declare spatial anatomy and form together before binding the mesh. Use Mojulo's body frame: +z up, +y forward,
+x right. Store named rest joints in that frame; camera placement never changes them.
Fit segment lengths and joint locations to the character, rather than uniformly
scaling Vajra and assuming its proportions will fit every species.

Build torso and limbs with ordered cross-section rings along anatomical paths.
Use the existing transported loft frames so a small direction change cannot flip
a cross-section. Keep vertex order stable and triangulate nonplanar quads
consistently. Validate finite coordinates, nonzero segments, profile correspondence,
triangle area and winding. Closed shells and intentionally open detail patches
have different boundary expectations; record that distinction.

Draw recognizable facial planes explicitly: brow, cheek, muzzle, jaw, eye sockets,
nose and ear interior. Give the skull a closed rounded back with sparse rings;
flat-shaded triangles supply the faceted appearance. A painted mask or facial
patch should follow the head carrier, while a movable jaw requires its own joint.
Do not infer three-dimensional landmarks from inconsistent painted views and call
that reconstruction. Concept art can guide design; it is not required by this method.

Declare bindings when constructing each region. Use a single carrier for rigid
accessories and deliberate normalized weights around flexible transitions. Every
influence must reference a declared bone, weights must be finite and nonnegative,
and each vertex's weights must sum to one. Do not use nearest-bone assignment as
the authoring contract: a cheek near a shoulder still belongs to the head.
Keep mesh coordinates and inverse bind transforms in the same rest frame.

## Anatomy and posing

Reuse Vajra's named core joints and articulation where they apply. Resolve friendly
pose directions against the same custom rest map supplied to articulation:

```js
const dof = resolvePose({ armL: 'forward', elbowL: 'half' }, restJoints);
const posed = articulateTransforms(dof, restJoints, { rigidUpperBody: true });
```

This branch adds that optional second argument and passes derived unit joints
through `compileUnitPose`. Omitting it retains canonical figure behavior. Raw
angle channels still pass through. The solver retains Vajra's limits and its
existing body-frame direction semantics; this is not a global end-effector solver.
Keyframe/performance APIs are not extended here and still resolve their friendly
poses against the default skeleton. Callers needing custom anatomy must compile
pose intents with their rest map before using raw channels downstream.

A dinosaur's raised heel is not a backward knee. Represent hip → knee → ankle/hock
→ toe base → toe tip explicitly. A two-link hip-to-hock solve can preserve femur
and tibia lengths while a separate metatarsal segment controls heel height. Supply
a knee pole and reject unreachable targets, or expose an explicit clamp policy.
A planted toe target must stay fixed during a crouch; an airborne pose deliberately
releases that contact. Do not silently stretch limbs or replace contact constraints
with a minimum-vertex grounding offset. Mirrored limbs need mirrored pole handling.
A tail is an ordered parented chain with rotations propagated from its base.

## Evidence from the character studies

The raccoon, muscular lion and basketball dinosaur were authored by scripts, not
recovered from SVG or generated concept art. They demonstrate the construction
method outside the native recipe pipeline; their Blender exports are not evidence
that the whole method already exists as a Mojulo capability.

The lion study used Mojulo's custom-rest articulation and a 13-bone skin. Uniform
skeleton scaling left substantial landmark error, motivating segment-level fitting.
The dinosaur study declared the skeleton first, added metatarsal/foot and tail
carriers (21 bones total), and bound details during construction. Its ready,
crouch and jump bake measured approximately 1.3e-6 maximum skin-position error,
1.3e-7 segment-length error and zero planted-toe drift. These are recorded study
results, not tests rerun by this branch. Baked animation is not a live editable IK
rig. The ball remained held; cloth, ball dynamics and seamless deformation were
not demonstrated. The meshes contain overlapping segmented parts.

## Native capability delivery

1. **Custom-rest posing (this branch).** Correct unit pose intent compilation and
   test directional accuracy, determinism and canonical compatibility.
2. **Spatial SVG authoring and handoff.** The included head example establishes
   persistent points, per-view camera metadata, semantic edge roles, clipped edge
   provenance and visible-only line output. Next adapt native manji/vajra or loft
   construction to this boundary, retaining IDs through tessellation. Expose only
   the reusable operations a demonstrated recipe-book builder needs; character
   designs remain recipes rather than new core species. Validate editable spatial
   controls by regenerating all views from one source. Do not substitute separate
   flat SVG illustrations for this test.
3. **Bound surface compilation.** Carry influence data alongside vertices through
   triangulation and packing. Preserve weights when vertices split for flat normals
   or materials. Reuse the existing rig and glTF export path after proving it can
   preserve arbitrary parented extension bones and weighted surfaces. Do not assume
   rigid part packing is a weighted-skin representation.
4. **Extended chains and contact.** Add opt-in tail and metatarsal chains with acyclic
   parent validation, bind transforms, reachability policy and support targets.
   Compare left/right crouches and jumps before introducing generalized locomotion.
5. **Portable recipes.** Ship raccoon head, lion and basketball dinosaur examples
   with manifests and expected metrics. Blender may independently validate exports;
   it must not become a required runtime for native recipe compilation.

Each stage needs a separate reviewable implementation. No existing default recipe
should change merely because the optional capability is installed.

## Acceptance gates

Machine checks: identical input gives identical output; existing default fixtures
retain their geometry; all indices and weights are valid; declared closed shells
have no boundary edges; rest skinning is identity; bone lengths are preserved;
transforms remain orthonormal; planted contacts remain within a declared tolerance.
Test custom A-pose arms, asymmetric proportions, mirrored digitigrade legs, nearly
aligned path segments, tail bends, unreachable targets and invalid bindings.
Reimport an exported skinned GLB and compare sampled world vertices and poses,
not just mesh counts or overall bounds. State unit scale and numerical tolerances.

Human eyes gate: inspect face silhouette and rounded skull from front, side and
back; check eyes, muzzle and clothing at rest and extreme poses; inspect knees,
hocks, feet and tail for inversions and intersections. Automated numerical passes
cannot claim human visual acceptance. OBJ is a static geometry deliverable; GLB
or a native rig file is needed to carry animation.

## Layered detail proof

See the [named attachment experiment](examples/raccoon-layered/README.md) for the
next implemented step: primary form edits regenerate secondary details through
explicit surface frames. A native internal query evaluates the named face and
tangent; the reference compiler keeps geometry, groups and wire policy separate.
The primary shell and muzzle are imported closed parts, not a new station grammar.
The comparison artifacts and tests establish this limited boundary without claiming
that all proposed layered authoring capabilities are now implemented.

The [dragon head](examples/dragon-layered/README.md) is the same loop started from a
station/slot loft instead of a frozen mesh: every primary point is named by station and
slot before it has a coordinate, details pin to named faces, and seven dials regenerate
the whole head with a cast sweep. It is the reference recipe for the native `layered`
solid kind (`mint_solid { kind: 'layered' }`, manual `get_solid_vocab({ id: 'layered' })`): the recipe
is the stored manifest, a dial is an `update_sketch` patch, and the solid lowers to the workbench
studio on every read. The [dragon body](examples/dragon-body/README.md) is the same grammar with more
parts: a hulking humanoid whose digitigrade legs are the explicit hip → knee → hock → toe base → toe
tip chain above, and whose head is the dragon recipe merged onto its neck.

The [head detail example](examples/head-detail/README.md) takes the same grammar down to detail and
expression. It adds surface addresses, skin strips, bone versus skin carriers, an eye with named
sclera, iris and pupil bands under a brow-tucked surround, a cheek web and a tongue, all driven by
species-neutral expressions. The dragon and a bear authored from its own station table share one
species-free core.
