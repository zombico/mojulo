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
- **The take in the engine** (the hero door's `perform`, `relational-face-rig.js` `performanceTrack`, `scene-gltf.js`):
  a realistic hero's `perform: { <take>: a performance }` exports each take as a face-only clip, `face:<take>`, a LINEAR
  weights channel keyed at 30 fps that an engine layers over a body clip (the face's weights masked from it). The gaze
  plays on ARKit's look targets (`eyeLookUp/Down/In/Out`, each eye's globe turned 25° about its centre), so the eyes move
  with no bone; the jaw (a bone) is said apart. Refused by name on another head. `/hero-live` plays a take as a take of
  its own over the body's idle.
- **The globes in the face rig**: the one skin's globes were outside the rig, so the blink's sink behind the shut lid
  never applied (a speck of iris could show through a shut lid). They are in it now: still, but for the gaze's turn and
  the blink's sink.
- **Speech over the acting face** (`face-acting/speech.js`, a beat's `say`): a beat may speak a line (a text, `*word*`
  emphasized; or phonemes, ARPAbet or the IPA a speech engine writes, timed by their own audio where they carry times).
  The words become phonemes by rule (a short list of the words the rules get wrong first), the phonemes the fifteen
  visemes of the industry's lip-sync set, each holding the units it needs against its neighbours by its dominance
  (Cohen and Massaro's coarticulation: the lips round ahead of an oo, a vowel's jaw gives way); every m, b and p shut, the
  f and the v the lower lip under the teeth. `rate`, `articulation` (mumbled … enunciated), `jaw` and `lips`. The line
  lays its units over the face: a rounded lip draws the smile in, a pressed or tightened mouth lets go while it speaks,
  the brows and the eyes keep the emotion, an emphasized word lifts the brows, a sentence's close may take a blink.
- **The mouth's speech shapes** (`head-relational.js` `ACTIONS`): `pucker` (AU18), `funnel` (AU22), `rollUpper` and
  `rollLower` (AU28 by lip, `AU28T` and `AU28B`), `lipsPart` (AU25), each a morph target on the realistic face.
- **The jaw in a take** (`relational-face-rig.js` `jawOpen`): the jaw bone's own turn (25°, the clips' range end) as
  ARKit's `jawOpen` target over everything the bone moves, so a take or a capture opens the mouth with no bone and
  layers over any body clip; the clips still turn the bone. The face store is `v7`.
- **The realistic face's mouth, cleaner** (`hero-relational-head.js` `oneSkinFollow`): each lip carried by its own
  muscles about the mouth, so the lips part (carried by both, the upper and the lower moved as one); the nose held still
  by its own beads where an action leaves it; and the settle onto the moved skin kept to the eyes and the brows, where it
  was tuned: about the mouth and the nose it stood points out in spikes, the smile's and the frown's among them. The
  smile, the frown and every mouth target rebuild cleaner on the next export.
