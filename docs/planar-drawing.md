# Planar drawing: skeleton-first low-poly characters

Status: capability proposal with a first posing correction. This is not yet a new
MCP tool, recipe kind, live IK system, or complete native character exporter.

## Construction contract

A character is a deterministic recipe of anatomy, surfaces, bindings and poses.
Declare anatomy before drawing the mesh. Use Mojulo's body frame: +z up, +y forward,
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
2. **Authoring surface.** Demonstrate a recipe-book character builder using existing
   loft faces, caps and explicit face lists. Expose only the reusable operations it
   needs through an append-only toolkit extension; characters stay book recipes,
   not a growing core species roster. Specify stable anatomy/region IDs, local
   frames, material groups and explicit bindings. Fail invalid recipes with useful
   region/joint paths instead of silently repairing them.
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
