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
  face?, mirror?, intensity?, seconds?, seed? } }` on a realistic hero exports each as a looping face-only clip,
  `emote:<clip>` (a LINEAR weights channel at 30 fps, its last key its first), named in the GLB's `face.emotes`; and
  `face.mouth` says the mouth's ownership in the targets' names (`mouthTargets`), so an engine's runtime lip-sync lays
  a line over the loop as `speakOver` does. Refused by name on another head. `/hero-live` plays `emote:*` as it plays a
  take.
- **The emote as the base layer** (`emotes.js` `emoteState`): an emote's `face` lays an emotion over it (`{ emote:
  'rest', face: 'worried' }`), the emotion's units added to the emote's, so the face's own unevenness shows through the
  expression; the loop, the door and a beat take it.
- **A performance's beats hold emotes** (`perform.js`, a beat's `emote`): the beat settles into the emote's face over
  the performer's onsets (the brows and the eyes leading), looks at its regard where it names no gaze, re-fixates and
  drifts as the card says, blinks at its rate and pace but while speaking, and stirs as it stirs; its `face` the emotion
  over it. A performance is emotes and the moments that break them. A take with no emote keeps its bytes.
- **A pulse on a lid held by side shuts it once**: a blink, a stir or a flash on a whole unit a face holds side by side
  (an emote's heavier lid) lays onto each side, the greater of the two, where the rig summed the whole's target and the
  side's past shut.
- **The face's machine read** (`face-acting/emote-read.js`): a face clip held at its median key on the hero's own
  mesh, each side's move in millimetres and the asymmetry's, measured as the face against its own mirror (its sides'
  weights swapped: a symmetric face reads nought exactly, where pairing vertices across the midline read three
  millimetres of noise on the one skin's layered lids and lips), `shows` from half a millimetre, and by region (the
  brows, the lids, the mouth). It found `absorbed`'s unevenness too faint (0.48 mm), `drowsy`'s stir summing past shut
  and `vacant`'s lips showing teeth: the cards are retuned.
- **Tuning the face without a mint** (`/hero-live` `face.mjs`): emotes and performances recomputed over a hero already
  minted, in seconds, beside its GLB (`<id>.face.json`, the viewer playing each over the GLB's own clip of its name),
  read, and shot as a contact sheet (the face close, each moment moved to the nearest frame off a blink).
- **The face as parts** (`face-acting/parts.js` `PARTS`): the brows, the lids, the cheeks and the mouth each move on
  their own timing (the brows lead a thought, the lids go quickest, the cheeks lag the smile by a tenth of a second and
  settle slowest) and live in a hold their own way (the brows' slow drift, the lids' faint flutter, the cheeks' slow
  settle). The performer and the emotes time each unit by its part; every take's curves change (face acting is
  unreleased).
- **The parts pull on each other** (`COUPLINGS`, `couple`): the cheek raised bunches its own lower lid up, the brow
  lowered bears on the lid, the outer brow raised lifts the lid's skin; side by side, frame by frame, so a coupled move
  rides its cause's timing; a floor under the lid, never a sum.
- **The upper face's gestures** (`UPPER_GESTURES`): `oneBrow`, `eyeSmile`, `appraise`, `knit`, `wince`, `widen`,
  `attend`, each a card of a few units (a side its own), a rise, a hold and a fall: a beat's `tell` (a name, `{ gesture,
  at?, mirror?, intensity? }` or a list) lays one over the face, and an emote's stir may be one (`{ tell, every }`:
  `daydream` smiles in its eyes now and then, `absorbed` knits its brow). The expression the face keeps while a line
  owns the mouth.
- **Each part alone** (`face.mjs --parts brows,lids,cheeks`): every clip again with one part moving and the rest at rest
  (`<clip>·<part>`), read, played and shot beside the whole; the read's regions are the parts (the cheeks their own).
  Part by part it found the cheeks idle in most emotes and `daydream`'s cheek, `absorbed`'s narrowed lid and `drowsy`'s
  propping brow under the line: the cards are retuned.
- **The eyes focus** (`gaze.js` `distanceOf`, `EYES.verge`; a take's `gaze.vergence`): every fixation carries a focus,
  the eyes' convergence on its distance, and the rig turns each eye by it (`performanceTrack`); the focus follows a
  saccade slowly, over a quarter of a second. The performer's `listener` is a face across a conversation (1.1 m), a
  beat's gaze may name its own `distance`, and a thinking look away or a glance off relaxes the eyes to the far point.
  Every take now converges where it looks at the listener.
- **Listening** (the `listening` emote): the idle gaze of someone listening close by: the eyes focused on a speaker's
  face, moving between their eyes and their mouth on short dwells (a scan, `eyes.scan`: points, weights, dwell, never the
  same point twice running), glancing away now and then unfocused (`eyes.away`), the brows a little lifted, a smile in
  the eyes at times. A regard's fixations (`regardFixations`) are shared by the loop and a performance's beat that holds
  an emote.
