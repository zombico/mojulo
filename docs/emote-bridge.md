# emote-bridge — common-parlance emotes on the vajra figure (research spike)

**Status:** research spike, no code. Branch `1005-emote-bridge` (from
`1005-figure-work`).

**Question:** can modders and animators drive mojulo figures with the emote and
animation libraries they already use (Mixamo, VRM/VRMA, BVH mocap, Godot/Unity
humanoid clips, Emotecraft) without hand-rigging a bridge themselves?

**Answer: yes, through one hub.** The **VRM 1.0 humanoid** bone set (the same names Godot's
`SkeletonProfileHumanoid` uses, in PascalCase) is that hub. Every outside format
translates to and from the hub. The hub translates to and from the vajra posing
API (`dof` / pose words). Most of the export half is already in place: the
[figure-humanoid-map.js](../control/lib/graph/polygonizer/figure-humanoid-map.js)
names and the `VRMC_vrm` extension on GLB export. The import half (clips coming
in) does not exist. That half is the spike's real subject.

---

## 1. What we have today

| Piece | Where | Notes |
|---|---|---|
| Joint graph (17 nodes) | [figure-vajra.js](../control/lib/graph/polygonizer/figure-vajra.js) `FIGURE_NODES`, `STAND` | Z-up, +Y front, +X figure-right. STAND units: ×1.8 → metres on the hero. |
| Rest pose | `STAND` + `buildRig` (6° knee, 12° elbow flex) | A relaxed **A-pose**. A T-pose exists only as the landmark vocabulary in [figure-landmarks.js](../control/lib/graph/polygonizer/figure-landmarks.js). |
| Posing API | [figure-posing.js](../control/lib/graph/polygonizer/figure-posing.js) `resolvePose` → `articulate(dof)` | Per-joint world-axis Euler steps (yaw → pitch → hinge → roll), degrees, clamped by `LIMITS`. |
| Pose words | same | Limb aim (`'forward'`, `{x,y,z}`, IK via `aimSwivel`), bend words (`slight`…`full`), spine words (`curl arch lean sideBend twist`). |
| Emotes | [figure-emotes.js](../control/lib/graph/polygonizer/figure-emotes.js) `EMOTES` | `nod headshake bow shrug cheer point clap think`. Keyframed raw dof plus a `performance` layer. `intensity` sets exaggerate. MCP: `emote_figure`. |
| Hero clips | [hero-gesture.js](../control/lib/graph/polygonizer/hero-gesture.js), [hero-form.js](../control/lib/graph/polygonizer/hero-form.js) | `idle walk wave` plus gestures `relaxed hand-on-hip guard`. Hand words `relaxed open fist point grip`. |
| VRM names | [figure-humanoid-map.js](../control/lib/graph/polygonizer/figure-humanoid-map.js) | `BONE_TO_VRM` (biped, 11), `HERO_BONE_TO_VRM` (hands, feet, jaw, fingers), `JOINT_TO_VRM` (inverse). |
| Export | [scene-gltf.js](../control/lib/graph/scene/scene-gltf.js) | Per-clip glTF animation `<figure>:<clip>`. Skinned joints are **flat**, with absolute rotations. `VRMC_vrm` is written when `humanoid:true`. |
| Godot | [godot-project.js](../control/lib/graph/scene/godot-project.js) | AnimationPlayer over the GLB clips, plus a blink layer through AnimationTree. |
| Face | [anime-face-rig.js](../control/lib/graph/polygonizer/anime-face-rig.js), [humanoid-head.js](../control/lib/graph/polygonizer/humanoid-head.js) | Morphs `blink blinkLeft/Right smile mouthOpen browInnerRaise/Lower`, and the `jaw` bone. |
| **Import** | [scene-gltf-read.js](../control/lib/graph/scene/scene-gltf-read.js) | Ignores animations, skins and morphs. **No BVH, VRMA, Mixamo or retarget code.** |

### Gaps that matter for emotes

1. **The rest is an A-pose, and the exported skeleton is flat.** Unity Humanoid and
   strict VRM validators expect parent-local rotations from a T-pose. Today our
   names make the figure *addressable*, but outside clips cannot simply play on it.
   **Decision: the T-pose mold (§3.6)** re-rests the exported figure in a T-pose.
2. **The head has no axial turn.** `head.yaw` is a lateral tilt, and `headshake`
   fakes "no" with a spine twist. A large share of real emote clips (look-around,
   headshake, taunt) carry neck/head Y-rotation. **Decision: add it.** The design is
   in §3.5.
3. **No eyes or gaze DOF.** VRM `lookAt` and the `lookUp/Down/Left/Right`
   expressions have nowhere to land.
4. **Spine resolution: no rig change needed.** We have 3 pivots (pelvisHub →
   navel → neckHub). Those already line up with the formats in scope:

   | Format | Spine bones | Fit |
   |---|---|---|
   | Mixamo | `Spine Spine1 Spine2` | 1:1 |
   | VRM | `spine chest upperChest?` | 1:1 |
   | CMU BVH | 2–3 | Collapses cleanly |
   | R15 / Emotecraft | 1 torso | Spread over 3 |

   Adding pivots would re-split `SPINE_CAP` and change every spine-driven pose
   render. It would also break 17-landmark cast bases passed to
   `articulate(dof, base)` and add spheres to every joint-graph render. It touches
   the 32 non-test modules that import figure-vajra (animals, landmarks, garments,
   world poses). **Decision: keep the vajra spine as is.** The retargeter
   distributes or collapses rotations instead.
5. **Name collision: already handled.** `HERO_BONE_TO_VRM` maps both `lumbar` and
   `torso` to `spine`, but `humanoidBonesFor` names the `torso` `chest` whenever a
   `lumbar` carries the spine.
6. **The biped has no hands or feet**, only weightless leaf joints. Finger tracks
   from Mixamo or VRMA can only land on the hero rig.

---

## 2. The outside landscape (what modders already use)

| Ecosystem | Skeleton / naming | Format | Rest | Bridge cost to hub | Licence for *shipping* clips |
|---|---|---|---|---|---|
| **VRM 1.0 / VRMA** | `hips spine chest upperChest neck head`, `leftUpperArm`… (15 required, the rest optional) | glTF + `VRMC_vrm_animation` | T-pose (mandated) | **Trivial**: it *is* the hub | Spec open; per-model metadata |
| **Godot 4** `SkeletonProfileHumanoid` | `Hips Spine Chest UpperChest Neck Head LeftUpperArm`… (56) | `.glb` + `BoneMap` `.tres` | Rest Fixer normalises | **Trivial** (case rename) | n/a |
| **Mixamo** | `mixamorig:Hips Spine Spine1 Spine2 Neck Head LeftArm LeftForeArm…` | FBX (cm) | T-pose | Low (name map + ×0.01) | **Royalty-free in a project; never redistribute raw clips.** User-supplied only. |
| **CMU mocap (cgspeed BVH)** | `Hips LeftUpLeg LeftLeg Spine Spine1 Neck Head LeftArm…` | BVH text | T-pose on frame 1 | Medium (Euler order per channel) | **Unrestricted. Safe to bundle.** |
| **Quaternius Universal Animation Library 1+2** | Universal humanoid rig (~250 clips) | glTF / FBX | T-pose | Low | **CC0. Best bundled default set.** |
| **Unity Humanoid / VRChat** | Avatar mapping, 15 required (VRM 0.x was derived from it) | FBX + `.anim` (muscle space) | T-pose | Low *via VRM*: export VRM and UniVRM does the rest | n/a |
| UE5 Manny / UEFN | `pelvis spine_01..05 clavicle_l upperarm_l…` | FBX | A-pose | **Out of scope** (§6): A→T correction, 5→3 spine, closed Fortnite emotes | — |
| **Minecraft Emotecraft** | 6 parts: head, torso, arms, legs, plus `bend` | Blockbench JSON / `.emotecraft` | n/a | **Easy to export to** (lossy projection) | User content |
| **Roblox R15** | `LowerTorso UpperTorso LeftUpperArm…` (15 rigid parts) | FBX → CurveAnimation | I-ish pose | Medium; Roblox owns distribution | Platform-moderated |
| **Second Life / OpenSim** | `hip abdomen chest lShldr lForeArm…` | BVH / `.anim` | T-pose | Medium | User content |
| Source / Skyrim | ValveBiped / Bethesda + Havok HKX | compiled | — | **Hard** (proprietary toolchains) | EULA questions. Out of scope. |

### Licence red flags (do not bundle; do not train shipped models on)

- **Bandai Namco Research** (CC BY-NC)
- **AMASS / SMPL** (non-commercial research)
- **HumanML3D motion** (derived from AMASS; its captions are fine as a vocabulary reference)
- **ActorCore** (games need a separate distribution licence)
- **Truebones** "free" packs (terms unclear per pack)

Rokoko free packs can be used in a project but must not be re-hosted.

**Mixamo:** the bridge must be a *user-side* import. The user brings their own
file and it is retargeted into their project. We never ship an "emote pack" of
Mixamo-derived clips.

---

## 3. Proposed architecture

```
 Mixamo FBX ─┐                         ┌─► GLB clips (VRM names)  ─► Godot AnimationLibrary + BoneMap
 CMU BVH  ───┤                         ├─► .vrma                  ─► three-vrm / VRChat (UniVRM)
 VRMA / GLB ─┼─► [adapter] ─► HUB ─────┼─► Emotecraft JSON        ─► Minecraft
 Quaternius ─┘   name map     humanoid ├─► BVH (SL / Blender)
                 rest fix     clip     │
                 scale                 └─► vajra lane:  solve → dof keyframes → emoteMotion()
                                          (authorable, clamped, performance layer)
```

### 3.1 The hub clip (internal, VRMA-shaped)

```js
// one humanoid clip, format-neutral
{
  name: 'wave',                       // emote id (common-parlance taxonomy, §4)
  seconds: 2, loop: false, fps: 30,
  rest: 'vrm-tpose',                  // rotations are LOCAL deltas from the VRM T-pose
  bones: { hips: { rot: [[x,y,z,w],…], pos: [[x,y,z],…] },   // only hips translates (VRMA rule)
           leftUpperArm: { rot: [...] }, … },
  expressions: { happy: [0, .8, .8, 0], blink: […] },          // VRM preset weights 0–1
  source: { kind: 'mixamo' | 'bvh' | 'vrma' | 'mojulo', licence: 'user-supplied' | 'CC0' | … },
}
```

`source.licence` travels with the clip. Exporters refuse to bundle
`user-supplied` clips into anything shareable (a pack or a publication), while still
baking them into the user's own game export.

### 3.2 Retargeting (the ~200-line core)

Use one formula per bone, transferring the local rotation delta from rest
across rest frames:

```
q_target = R_t · R_s⁻¹ · q_src · R_s · R_t⁻¹      (R = world-space rest orientation)
```

- **Name map:** a preset per source (`mixamo`, `cmu-bvh`, `sl-bvh`, `quaternius`,
  `godot`, `vrm`). Auto-detect by stripping `mixamorig\d*:` and normalising `L/Left/_l/l`.
- **Rest fix:** build R_s from the source's frame 0 (or its declared T-pose).
  Build R_t from the **vajra T-pose**, which we compute once from `STAND` by swinging
  the arms to horizontal. Store the A-pose↔T-pose offset per bone so the round trip
  is exact.
- **Spine:** map the source spine onto our 3 pivots. Mixamo and VRM map 1:1. Sources
  with fewer bones are split across the pivots in proportion to `SPINE_CAP` (the same
  weights the `spine` drive uses), so an imported bend lands where a native
  one would.
- **Scale and root:** convert cm→m and scale by the hip-height ratio. Hips translation
  only. Split XZ off as root motion for Godot `root_motion_track`.
- **Missing bones:** if the source has no fingers, the hero keeps its hand word.
  If the target has no fingers (biped), finger tracks are dropped.

Don't depend on three.js `SkeletonUtils.retargetClip`; it is known to break on
Mixamo rest orientations. The formula above is the same one
Godot's "Overwrite Axis" applies.

### 3.3 Two lanes onto the figure

**Lane A, solve to dof (authoring lane).** Convert each hub frame into vajra `dof`.

1. Limb direction comes from the bone's rotated rest vector, fed to the existing
   `aimSwivel`.
2. Roll is the residual twist about the bone.
3. Elbows and knees are the angle between segments.
4. The spine sagittal/lateral/axial values come from a swing-twist decomposition
   of the chest relative to the hips.
5. The output is a `keyframes` array in exactly the shape `EMOTES` already uses.

Payoff: imported motion becomes **editable, clamped and performable**:
`intensity`, anticipation, follow-through and idle breath all apply. A modder can
import a Mixamo wave and say "bigger, with more anticipation". The clip is also
copy-pastable into `create_figure { pose }`.

Costs:
- It is lossy where the vajra figure has no matching joint (axial head turn,
  wrist on the SVG figure).
- `LIMITS` will clip extreme mocap.
- Reduce keyframes by curvature: we keep ~5–12 keys, not 30 fps.

**Lane B, pass-through (fidelity lane).** Feed hub rotations straight into the
bake as `[q, head]` frames on the hero's layered rig, skipping
`articulate`. This gives the exact motion for game export, but the clip is
opaque to the posing API.

**Recommendation:** use Lane A by default for emotes, since they are short, stylised,
and benefit from the performance layer. Use Lane B for locomotion and dance mocap, where fidelity
matters more than editability.

### 3.4 Face

Map the VRM expression presets onto the morphs we already have:

| VRM preset | anime-face-rig | humanoid-head |
|---|---|---|
| `happy` | `smile` | `EXPRESSIONS.smile` |
| `angry` | `browInnerLower` + `-smile` | `determined` |
| `sad` | `browInnerRaise` + `-smile` | (new) |
| `surprised` | `browInnerRaise` + `mouthOpen` | `surprised` |
| `aa` `oh` `ou` | `mouthOpen` (scaled) | `jawOpen` |
| `blink` / `blinkLeft` / `blinkRight` | same names | — |
| `lookUp/Down/Left/Right` | **gap** (no gaze) | **gap** |

ARKit-52 inputs and the 15 Meta visemes collapse onto these presets through a fixed table.
Each emote id carries an optional default expression (`laugh → happy`,
`cry → sad`), so one word drives body and face together.

### 3.5 Head turn (axial neck/head rotation)

**Why it is cheap.** The neck and head are lines on the vajra graph:
`neckHub → headBase → headTop`, all on the z-axis at rest. A turn about a line's own
axis moves neither of its end points. So `articulate()`'s node output, and everything built on it
(the joint graph, SVG figures, gait, garments, balance, animals), cannot change. The
turn is only visible where a bone has an **orientation**: rigid armor
(`articulateTransforms`), the hero's layered rig, and the baked/exported
skeleton. With the turn at 0, every path is byte-identical by construction.

**The DOF.** Add a `turn` key to the existing neck and head swivels:

```js
dof.neck = { yaw, pitch, turn }   // C3–C7: the column turns about neckHub → headBase
dof.head = { yaw, pitch, turn }   // C1–C2 (atlanto-axial): the skull turns about headBase → headTop
LIMITS.neckTurn = 35; LIMITS.headTurn = 45;   // ≈ 80° total, a real cervical rotation
```

- **Sign:** `+` turns the face to the figure's **left**. This is the right-hand sense
  about +Z, the same as the `'ZN'` axis and `dof.shoulders`.
- **Order:** applied last in each swivel (yaw → pitch → turn), so the turn happens
  about the *posed* axis. A nodded head still turns about its own tilted axis.
- **Clamp:** each key is clamped separately. The turn is not part of the yaw/pitch
  cone, because axial rotation is an independent budget on a real neck.

**Pose words** ([figure-posing.js](../control/lib/graph/polygonizer/figure-posing.js)):

- `glance: 'left' | 'right' | 'ahead' | degrees` splits a total turn across the neck and head,
  40 / 60. The atlas carries most of a glance.
- The existing `head: 'forward'` style aim words keep meaning nod/tilt. The
  `no turn` note at :141 goes away.
- Hero gestures and clips: add `glance` to `GESTURE_KEYS`, and let `neck` / `head`
  angle objects take `turn`. `RANGE.look = 90` already exists in
  [hero-gesture.js](../control/lib/graph/polygonizer/hero-gesture.js) and covers it.

**How each consumer sees it:**

1. **`articulate()`.** No node of an un-nodded head moves (a nodded crown swings with
   the face). When a turn is non-zero, the posed map also carries a **twist pair**
   per span (`TWIST_REFS` in [figure-vajra.js](../control/lib/graph/polygonizer/figure-vajra.js)):
   - `neck` (neckHub → headBase), `head` (headBase → headTop) and `crown`
     (neckHub → headTop, the packed biped's head, which has no neck bone).
   - `<span>FaceSwing` is the bone's forward carried by the shortest arc, the frame
     every bone has today. `<span>Face` is the rigid turn applied to that forward.
     Both sit a short reach in front of the bone head, inside the neck and skull.
   - With no turn, no key is added, and the output map is unchanged key for key.
2. **`articulateTransforms()`** (rigid armor). The head carrier turns with the
   same rotation about the neck line, and its nodes stay equal to `articulate()`'s.
3. **Bone frames: derived from the joints, not stored.**
   - A bone spanning one of those joint pairs gets its twist pair from
     `twistPairFor(head, tail)`, so no recipe gains a byte.
   - `boneFrame` in [station-loft-rig.js](../control/lib/graph/polygonizer/station-loft-rig.js)
     and the frame step in [rig-bake.js](../control/lib/graph/figures/rig-bake.js)
     compute the frame as today. *Only if* the pair is present, they post-rotate about
     the posed bone axis by the signed angle between the pair (`twistQuat`).
   - Reading an angle between two posed points keeps the twist exact under the
     bake's world transform. The frame it builds equals the rigid turn of today's frame.
   - This deliberately does **not** use `aux`: a two-vector frame would re-derive
     every hero head under tilt+nod and re-baseline every pin.
   - Nodes that carry the head by a list carry the pair too: the balance solver's
     body list, and the hero rig's core copy and crouch drop.
   - The protoform skull ([figure-head.js](../control/lib/graph/polygonizer/figure-head.js)
     `headRings`) reads the same pair, so the `create_figure` / `emote_figure`
     renders show the turn.
4. **Jaw, face and hair.** The jaw joints ride the `head` bone, and the jaw bone's `aux` is the
   head axis. A turned head frame carries both, so the jaw-seam fix on
   `1005-figure-work` holds. Anything else that `rides: 'head'` (hair, helm,
   horns, face plate, eyes) follows for free. The ambient blink and face morph tracks are unaffected.
5. **Export.** Turned frames bake into the existing per-bone quaternion keys
   (`[q, head]`). The glTF and Godot exports need no change. VRM `neck` / `head` local
   rotations now carry a twist component.
6. **Retargeting (§3.3).** Swing-twist a source `neck` / `head` local rotation about
   its bone axis: twist goes to `turn`, and swing goes to `yaw` / `pitch` through `aimSwivel`.

**Emote fixes it unlocks:**
- `headshake` becomes a true "no": `head: { turn: ±30 }, neck: { turn: ±12 }`,
  damping, with no torso twist.
- `think` adds a slight look-away.
- `look_around` and `taunt` become authorable.
- `gait`'s `headLevel` counter-yaw can become a counter-turn. That is a separate
  change, because it alters gait renders.

**Machine gates:**
- Every existing `*.char.test.js` and the byte-identical re-render pass untouched,
  since no turn is the default.
- A new `figure-vajra.test.js` case: node positions are identical with and without
  a turn. `headFace` measures the turn within ε on a nodded and tilted head.
- `articulateTransforms` parity holds.
- Clamps: a 720° turn is clamped, not refused. A gesture's turn outside `RANGE.look`
  is refused by name.
- The jaw seam stays shut on a turned and opened jaw (extend `hero-jaw.test.js`).

**Eyes gate:** render the herobot and an anime hero at turn −45 / 0 / +45, front and
three-quarter (`docs/examples/humanoid/view-animations.mjs`), plus the new
`headshake`.

### 3.6 The T-pose mold

**What it is.** An export-time step that takes any humanoid mojulo character and re-rests it in the
VRM T-pose that Godot, Unity/VRChat and VRM tooling retarget from. It is not a new character,
and no recipe changes. It has two paths, chosen by how the character's mesh is made:

- **Skinned meshes (the hero, and any other humanoid pack): the packed mold**
  ([rig-tpose.js](../control/lib/graph/figures/rig-tpose.js)). It runs on the **packed rig**
  (`packLayeredRig`, `bakeRigFigure`), so it serves any humanoid kind, including future ones. The
  mesh is moved to T by its own skin weights.
- **The flat figure: a rebuild** ([figure-tpose.js](../control/lib/graph/polygonizer/figure-tpose.js)).
  Its flesh is procedural and packed as rigid per-bone parts. Skinning those 80° tears the shoulder:
  the deltoid and lat pieces bound to the arm swing out as flaps, and blending the trunk in pulls the
  chest into spikes. So `figure-world` instead builds the rest on a T armature (the same landmarks
  and bone lengths, the arms placed straight along ±x and the legs straight down). The clip frames
  are the authored motion as ever, and the bake measures them from the T rest, so they play the
  same with no re-expression.

**Inputs and outputs.** In: a packed rig with `bones: [{ id, head, tail }]`, parts (rigid, or
skinned with `jnt`/`wgt`) and clips (per key, per bone, a world rotation from rest plus the posed head).
Out: the same shape, with:
- **A T-pose rest.** Each bone keeps its length. Its new head comes by FK from its parent's T frame.
- **Mesh parts moved to T.** Rigid parts move rigidly; skinned parts move by their own weights.
- **Clips re-expressed on the new rest.** `q' = q · qT⁻¹`, and posed heads are unchanged, so every
  clip plays the same motion. This is exact for rigid vertices; blended vertices re-bind the usual
  way any T-pose rebind does.
- **The per-bone offset `qT`**, the A↔T delta that importers and the keyframe lane need.

**Bone roles, by VRM name** (`humanoidBonesFor`):

| Role | Bones | In the T-pose |
|---|---|---|
| aim sideways | upper arm, lower arm, hand | Straight along the figure's ±x (left −x). The shortest arc from a hanging arm turns the palms down, as VRM wants. The lower arm's aim also removes the elbow flex and the carrying angle, which the posing API cannot (the elbow only folds forward). |
| aim down | upper leg, lower leg | Straight down. |
| keep world | hips, spine, chest, neck, head, foot, toes | The rest orientation, moved only by FK, so the feet stay flat and the head stays where the face rig expects it. |
| ride | fingers, thumb, jaw, eyes, unnamed bones (bust) | Rigid with the parent: fingers keep their rest curl. |

Parents come from the VRM humanoid tree (the nearest present ancestor). Unnamed bones take the
bone whose segment is nearest their head.

**Where it plugs in.** `export_model { …, skinned: true, humanoid: true, rest: 'tpose' }` resolves the
sketch with `tpose` (the flat figure rebuilds), then runs the packed mold on every other humanoid
figure before the GLB is written. A non-humanoid rig is left as authored, and the result says so.

**The engine skeleton (phase 4).** With `rest: 'tpose'`, the skinned writer nests the joints on the
VRM tree (`humanoidParents`), parent-local, and writes the pack in the VRM space (`vrmSpacePack`:
y up, facing +z, the figure's left on +x). The wrapper cancels the root's z-up → y-up, so the
skeleton space an engine builds (Godot's `Skeleton3D` lives in the joints' parent space) *is* that
space. The biped's hand and foot leaves become weightless bones, and so does a clavicle each side
(`withClavicles`). Godot's profile hangs the upper arm off `LeftShoulder`, whose rest is about a
quarter-turn, so a skeleton without one bent every arm track from a rig that has it. The
Quaternius `Dance_Loop` landed 100–120° off on our arms until the clavicles went in. Clips are
written parent-local (`localClip`, keys normalized first).

**A library clip on our figures** (Quaternius Universal Animation Library, the free CC0 version,
hand-mapped to the profile with a `BoneMap`). With the clavicles, `Dance_Loop`'s segments track the
source:
- the hero within 10° (the arms), and the trunk within 9°;
- the flat figure within 21° (the arms), and the trunk within 12°;
- the legs within 4.6° on both.

The remainder followed the trunk: the source has spine, chest, upper chest and neck, the hero lacks
the upper chest, and the flat figure has one spine bone.

**The trunk joints** (`withTrunkJoints`) close it. The top trunk bone is *split*: chest and upper
chest joints are placed along it, and its skin is spread over the chain with piecewise-linear
weights by height. A retargeted chest or upper-chest turn then bends the torso's flesh along with
the arms and head instead of shearing against it. The joints ride the split bone in every key, so
mojulo's own clips are unchanged. With them, `Dance_Loop` lands:
- arms within 1.0° on the flat figure, the hero, and the heroine (a full anime hero minted at the
  door and exported by the real `export_model { rest: 'tpose' }`);
- trunk within 5–8° (the flat figure still has no neck);
- legs within 4.6°.

**Two import traps, both fixed in the export.**
- Godot's rest fixer bakes a skeleton's ancestor nodes into it and resets them. With the figure
  under mojulo's z-up root, that stripped the root's rotation from every sibling: the World floor
  stood on edge as a 20 m wall, and the World cameras tipped over. So the engine figure is a
  scene-level node, beside the root, with no transform of its own.
- Godot imports a vertex-coloured GLB white (no `vertex_color_use_as_albedo`). So a post-import
  script, `mojulo_import.gd`, ships beside the GLB and applies the kernel's G0 material contract.

A GLB's own cameras can become the current camera in a scene that adds them first; a viewer should
set its own camera current.

**Godot.** Beside the GLB, `export_model` writes a `BoneMap` per figure (`godot-humanoid.js`: the
profile names are the VRM names capitalised; Godot names a joint `<figure>:<vrm>` as the bone
`<figure>_<vrm>`) and the GLB's `.import` naming it on `mojulo/<figure>/Skeleton3D`. Because an
`.import` names a resource by `res://` path, the folder goes at `res://mojulo/<ref>/`. On import,
Godot renames the bones to its profile, makes the skeleton `%GeneralSkeleton`, rewrites the rests to
the profile's axes, and drops all position tracks except the hips'.
[godot-retarget.mjs](examples/humanoid/godot-retarget.mjs) is the gate. Godot 4.7 headless plays the
flat figure's `bow` (15 bones) on the anime hero's skeleton (49 bones):
- the hero moves 82.5° from its rest;
- its limbs and trunk track the figure's within 3.3° at every sampled frame;
- the remainder is the trunk: one spine bone against spine, chest and neck.

**Gates.**
- *Machine:*
  - Arms and legs on their axes within ε.
  - Bone lengths unchanged.
  - Every clip's posed rigid vertices unchanged by the mold (to float precision).
  - A mold with every `qT` = identity is a no-op.
  - `rest` absent leaves the GLB byte-identical.
- *Eyes:* a flat figure, the lead hero and the herobot in T. Watch the shoulders and armpits, the
  herobot's pauldrons, and long hair over the arms. On the first pass, the flat figure skinned into T
  tore at the shoulder, which is why it is rebuilt instead.

---

## 4. The common-parlance emote vocabulary

This is the user-facing layer: one stable id set that modders recognise, aliased
across ecosystems.

| Emote id | Today | Source when missing | Aliases (match on import) |
|---|---|---|---|
| `nod` | ✅ EMOTES | — | yes, agree |
| `headshake` | ✅ (spine-faked) | needs axial head | no, disagree, head_shake |
| `bow` | ✅ | — | greet_formal |
| `shrug` | ✅ | — | idk |
| `cheer` | ✅ | — | celebrate, victory, hooray |
| `point` | ✅ | — | look_there |
| `clap` | ✅ | — | applause |
| `think` | ✅ | — | ponder, hmm |
| `wave` | ✅ hero clip | lift into EMOTES | hello, hi, bye |
| `idle` | ✅ hero clip | — | breathe, stand |
| `salute` | — | author (keyframes) | — |
| `thumbs_up` | — | author + hand word | like, ok |
| `facepalm` | — | author | — |
| `laugh` | — | author + `happy` | lol |
| `cry` | — | author + `sad` | sob |
| `dance_*` | — | Quaternius / CMU, Lane B | dance, groove |
| `sit`, `sit_ground`, `kneel`, `lie` | partial (crouch/support) | Quaternius | — |
| `jump`, `taunt`, `blow_kiss`, `peace_sign`, `hug`, `yawn`, `stomp` | — | author or Quaternius | — |

Hand-authored ids stay as `EMOTES` keyframes, which are tiny, deterministic and
recipe-friendly. Library ids are imported clips bound to the figure.

---

## 5. Prototype path (phases)

Each phase stands alone and ends with a machine gate and an eyes gate (render the
clip through `docs/examples/humanoid/view-animations.mjs`).

1. **Head turn (§3.5).** Add the `turn` DOF, the `glance` word, and the twist pairs that
   bones spanning the neck read. Re-author `headshake` as a real turn.
   This is first because it is a kernel change best landed alone behind its
   byte-identical gate, and every later phase (authored emotes, retarget,
   export) uses it.
   *Gates:* see §3.5.
2. **Vocabulary and alias table.** Add `EMOTE_ALIASES` and lift `wave` into `EMOTES`.
   Author `salute thumbs_up facepalm laugh cry look_around` as keyframes. Make
   `emote_figure` accept aliases.
   *Gate:* every alias resolves and every emote articulates (extend `figure-emotes.test.js`).
3. **The T-pose mold (§3.6).** An export-time re-rest of any humanoid packed rig into a VRM
   T-pose, carrying the per-bone A↔T offset. `export_model { rest: 'tpose' }`.
   *Gates:* see §3.6.
4. **Export to the ecosystem.** Re-root the skinned skeleton into a parent-local hierarchy (on
   the mold's T rest, every local rotation is the identity). Bake `EMOTES` as named clips with VRM
   bone names. Emit a Godot `BoneMap` `.tres` (names only: the rest is already a T-pose, so
   Godot's "Fix Silhouette" is not needed) and an `AnimationLibrary`. A strict VRM 1.0 export, and
   `.vrma` clips of our emotes, become possible.
   Optionally emit `.vrma`. Write an Emotecraft JSON exporter (6-part projection).
   *Gate:* a Godot project plays a mojulo `bow` on a stock Godot humanoid, and a
   Quaternius clip plays on the mojulo figure through Godot's own retargeter.
   This is the cheapest end-to-end proof, because Godot does the retarget.
5. **BVH import (CMU).** Text format, no dependencies. Run the adapter, the hub,
   then Lane A to dof keyframes. With the mold, a T-pose source's local rotations land on our
   T rest almost directly (Lane B is mostly a rename). Lane A turns them into dof through the
   mold's stored `qT` instead of guessing a rest.
   *Gate:* a CMU wave solves to keyframes, and the residual joint error is reported.
6. **glTF/VRMA import.** Extend `scene-gltf-read.js` to read animations and skins.
   Add an MCP door, e.g. `bind_motion_clip { ref, path, clip, source, lane }`.
   This covers Quaternius and VRMA directly.
7. **Mixamo, user-supplied.** FBX is not worth a JS parser. Route it through the
   existing [local Blender worker](local-blender-worker.md) (FBX→GLB through Blender's
   own importer; the worker does not do this yet, so it needs a new job type), then into
   phase 6. Tag the result `licence: 'user-supplied'`, and show the redistribution
   notice in the tool result.
8. **Gaze.** Add eye bones or a lookAt on the faced heads for the VRM `lookAt`
   and `look*` expressions. This builds on phase 1's `headFace` frame.

**Smallest proof of value:** phase 4 alone gets you most of the user-visible result.
Once our GLB exports with Godot-profile names and a BoneMap, every humanoid
animation a Godot modder already owns plays on mojulo figures, and every mojulo
emote plays on theirs, with no mojulo import code at all.

---

## 6. Out of scope

- **Unreal (UE5 Manny/Quinn, UEFN).** The cost is high: an A-pose rest, a 5-bone spine,
  the IK Retargeter as the only practical path, and Fortnite player emotes are closed.
  Mixamo, VRM, Godot and BVH cover the audience. Revisit on demand. The hub design does
  not preclude it: a `ue5` name-map preset plus an A→T reference pose.
- **More vajra spine pivots.** Not needed (§1, gap 4).
- **Source (ValveBiped) and Skyrim (HKX).** These need proprietary compile toolchains
  and raise EULA questions.

## 7. Open questions

1. Should imported clips land as **recipes** (Lane A keyframes, which are deterministic
   and small) or as **binary assets** bound by reference (Lane B)? This changes
   what "the recipe is the source" means for mocap.
2. Should the skinned export move to a parent-local hierarchy with a T-pose rest
   by default, or only under `humanoid:true`? Making it the default changes every
   existing GLB.
3. Should we bundle a CC0 starter set (Quaternius UAL), or ship the bridge only and
   point to it? Bundling adds weight; pointing adds friction.
4. Should `LIMITS` clamp imported mocap (keeping the vajra figure's anatomy honest)
   or be relaxed per clip (keeping the motion faithful)?
5. Is the SVG/vajra figure (`create_figure`) or the hero (layered rig) the main
   emote target? The hero has hands, jaw and face; the vajra figure has the
   performance layer.
