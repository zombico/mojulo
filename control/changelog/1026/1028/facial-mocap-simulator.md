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
- **Their targets** (`relational-face-rig.js`): the realistic face's morph targets grow from 9 to one per unit and side
  (each unit's build, a sided one split across the midline, the smile and the eyes' too), and `facsWeights(state)`
  weighs a FACS state onto them, the jaw (a bone) said apart. The rig is rebuilt for every realistic hero on its next
  export (the store is `v4`).
- **The emotions** (`face-acting/emotions.js`): the basic seven and the nuances an actor plays (amused, wry, skeptical,
  worried, embarrassed, determined, tender, pained, stifled, irritated, hopeful, smug, pensive, shocked), and
  `composeFace`: an intensity, a BLEND (the upper face from one emotion, the lower from another: bittersweet), a MASK (a
  shown emotion's mouth over a felt one that leaks through the brows and the eyes: the polite smile over worry), a lean
  to a side, and an eye look as the upper face.
- **The performer** (`face-acting/perform.js`): a performance in beats (a face from the emotions, an onset spontaneous or
  posed, a gaze, a state: listening, speaking, thinking, attentive; a brow flash; a micro-expression) becomes a take as
  a capture records it: each unit's curve at 60 fps, the gaze, and the events. The changes ease in and out over FACS's
  onsets and offsets, jittered per unit so none move in lockstep; the brows and the eyes lead the mouth by a little over
  a tenth of a second; a held expression lives (the moving hold); a micro-expression leaks for a fifth of a second; the
  blinks come at the state's rate (more speaking than attending), at a thought's close and with a large gaze shift,
  never through a brow flash; the eyes fixate, drift and jump on the main sequence, look away while thinking and glance
  off while speaking. Seeded: the same performance plays the same take; `captureFrame` reads a frame as a FACS state.
