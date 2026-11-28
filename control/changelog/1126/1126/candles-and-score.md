### A plume for a prop's drive, and the frames' score

- A prop's plume (`scene/channels/plume.js` `PLUME`; a frame operation's prop's `plume`, on a card with a `bell`): the
  frames' plasma boost at a ship's scale. As the level's bus says `ignite:<id>` the bell lights: a white-hot core
  inside layers of the plasma's colour, soft (brightest at the bell and fading along it, thin at its edges), flickering;
  pulse beads running up it; a ring of plasma bits thrown out across the ground at the moment it lights, and a flash; a
  light of its colour on the ground round it. Heard: the ignition's roar (a noise swept down over a deep rumble) and the
  burn held under it. The Roman Candle's card has its bell. A page whose level names none carries none of it.
- The frames' score (`gameworld/frame-score.js` `FRAME_SCORE`): two loops in D minor with a Phrygian edge, the fight
  some 3 LU over the quiet. Regolith (84 bpm, half time: Dm, B♭, Gm, A), while the field is quiet, is a heavy band in one
  room: a gated stadium kit, a reese bass kept low and dark under it, a string machine, crotales and a tam-tam. Hardpoint
  (134 bpm: Dm, B♭, C, A) once the shooting starts, a techno machine: a 909 four on the floor (its trance drive the second
  pass), an acid line driven hard in sixteenths, rave stabs on the offbeats, a poly-string pad, and in the second pass a
  sixteenth arpeggio and a supersaw hook. Changed on the bar line by the fight's tension (hits and falls raise it). Every
  frame level plays it. Regolith is recorded (`recorded: true`): its strings are the sound library's where it is
  installed; Hardpoint's machines have no recorded twins.
- A recorded score on a World page (`scene/channels/audio.js`): a soundtrack, a combat score, a boss score or an
  event's music whose `recorded` puts a part on its twin now carries that twin's takes (they had been read only off the
  cues), and every engine that plays a score is handed them, each its own copy. Before this the twin always fell back
  to its synthesized patch on a page. Without the library a page carries nothing of it, byte for byte as before.
- A retry says "Restart at Checkpoint"; a frame stood up again is cleared of its stagger (the frame HUD had flashed
  STAGGER over the restart).
