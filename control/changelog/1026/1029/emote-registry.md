### The face's emotes: held states that loop, never cross-eyed

The realistic hero's face past the emotions: emotes, held states that loop and live, each a card any realistic hero
plays, starting with the neutral asymmetric faces of someone looking at nothing. Speaking stays its own loop: an emote
gives the mouth's articulation to whatever drives it. The eyes gate is the operator's.

- **The eyes' law** (`face-acting/gaze.js`): two eyes look at one thing. A gaze is a direction and a distance, and each
  eye's turn is the line from it to the target: the eyes move together, converge no nearer than the near point (0.4 m),
  never diverge and never skew; no distance is the far point, the eyes parallel. `gazeFaults` names a frame crossed,
  wall-eyed or skewed (a capture's, a hand's), `seatGaze` puts it back. The rig's `gazeWeights` turns each eye by the
  law (`eyeWeights`, and `eyesOfWeights` reads a frame's look weights back); every take so far looks at the far point
  and keeps its bytes.
- **The emote registry** (`face-acting/emotes.js` `FACE_EMOTES`): each emote a card (the words people say, what it
  reads as, a held face given side by side, so asymmetric by construction; the regard, at the far point; the blinks'
  rate and pace; the stirs, a moment the face moves and settles; the loop's length). The first: `rest` (the resting
  face, nothing on it but its own unevenness), `vacant`, `daydream`, `absorbed`, `waiting`, `drowsy`. `emoteTake` plays
  one as a seamless loop (every wave a whole number of cycles in it, the blinks, the stirs and the re-fixations laid
  round it: the last frame is the first), `mirror` its sides swapped and its regard to the other side, `intensity` its
  face. Every emote is general: any realistic face plays any of them, and a new one is a card.
- **The mouth's owner** (`face-acting/mouth.js` `MOUTH`): who owns the mouth while a line is spoken, lifted out of the
  performer: the line's driver owns the articulation (the jaw, the lips parted, rounded, rolled, pressed, spread); the
  face's corners are drawn in by a rounded lip and its closing units let go while the line runs; the brows, the eyes
  and the corners' set stay the face's. `speakOver` lays a line (a text, or the phonemes a voice timed) over any take,
  an emote's loop played round as long as the line needs. The performer speaks its beats through it, byte for byte.
- **The emote in the engine** (the hero door's `emote`): a name, a list of names or `{ <clip>: a name | { emote,
  mirror?, intensity?, seconds?, seed? } }` on a realistic hero exports each as a looping face-only clip,
  `emote:<clip>` (a LINEAR weights channel at 30 fps, its last key its first), named in the GLB's `face.emotes`; and
  `face.mouth` says the mouth's ownership in the targets' names (`mouthTargets`), so an engine's runtime lip-sync lays
  a line over the loop as `speakOver` does. Refused by name on another head. `/hero-live` plays `emote:*` as it plays a
  take.
