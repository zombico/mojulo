### Facial mocap simulator: the realistic hero acts

The realistic hero's face as a facial capture session records it: per-frame curves in ARKit's 52 blendshapes, written
by a simulator from a performance described in words (the lines, the beats, the gaze, the intensity), so the hero can
say a line and play a scene, and play a real phone capture through the same controls. The eyes gate is the operator's.

- **The vocabulary** (`face-acting/facs.js`): FACS's action units as the face's controls, each with its muscle, its
  side, its ARKit names (the 52, each read through the AU it captures) and the realistic head's action that makes it,
  or a gap said by name; the basic emotions as FACS's prototypes (EMFACS) at its intensities; `facsActions(state)` turns
  a face's AUs into the head's actions and returns what it cannot make, never another unit in its place.
- **The face's missing muscles** (`head-relational.js` `ACTIONS`): the outer brow raised alone (AU2), the cheek raised
  (AU6), the nose wrinkled (AU9: the nostrils and wings drawn up, the brows' inner ends down), the upper lip raised (AU10),
  the dimple (AU14), the mouth's corners pulled down (AU15), the lower lip drawn down (AU16), the chin raised (AU17: the
  mentalis pushes the lower lip up, the chin's bone stays), the lips stretched (AU20), tightened (AU23) and pressed (AU24),
  each per side where FACS splits it, and the brows lowered, the eyes widened and squinted per side. Every one of FACS's
  basic emotion prototypes now builds on the realistic head. A head with none of them keeps its bytes.
