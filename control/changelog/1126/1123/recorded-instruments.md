### Recorded instruments, note by note

- An instrument can be played note by note from recorded takes. The sound library measures each take's real pitch to
  the cent (the generator gets a note's letter right but its octave by chance) and, for an instrument that holds, a
  seamless loop on a whole number of its periods. A page then plays each note on the take nearest it, bent the rest of
  the way, and holds it on its loop for as long as the note lasts. The synth's modulators carry over: its unison
  detune, its pitch lanes and vibrato, a pitch LFO, and, as before, its filter, envelope and tremolo.
- The first is a recorded electric drawbar organ (`organRec`, played as the organ with its own chain), heard beside the
  synthesized organ; on a machine without the library it is the synthesized organ, byte for byte. It is not on the
  instrument shelf until it is chosen by ear.
- A recorded grand piano (`pianoRec`, played as `grand-piano-3` with its soundboard and room): notes struck once and
  left to ring, each played on its nearest take across F#2 to F#5 and damped when the key is let go; asking each note's
  register in words (a left hand's low notes, a bright treble) lands most takes in their octave. Without the library it
  is the tuned grand, byte for byte; not on the instrument shelf until chosen by ear.
- The robot band's pitched instruments recorded the same way: the celesta, the vibraphone (recorded with its motor off,
  the synthesized one's tremolo laid over it), the steel drum and the picked bass, struck once and left to ring; and the
  organ's low register asked again, reaching down to F#2. Each part matches its synthesized one's loudness and falls back
  to it, byte for byte, without the library. `RECORDED_TWINS` names each synthesized patch's recorded twin, so a band is
  heard recorded by naming the twins as its parts' patches; none is on the instrument shelf until chosen by ear.
- The pitch converter reads a struck note while it rings, not the silence after it: a celesta's bell, gone in a second,
  is measured over that second.
- A song plays its whole band on its recorded instruments with `recorded: true`: every part whose patch has a recorded
  twin is heard on it with its instrument's chain, and a part says `recorded: false` to stay synthesized. Without the
  library the song is exactly the synthesized one. The rest of the robot band is recorded for it: one clean guitar under
  the rhythm and the lead (the amp is each part's chain, its level the amp's makeup), the brass and the strings held on
  their loops (the brass brighter the harder it is played, the strings with the string machine's swell and vibrato), and
  the slap bass. The kit stays synthesized.
- More of the instrument shelf recorded and twinned, each matched to its synthesized one's loudness: the steel-string
  and nylon-string acoustic guitars (the classical guitar on the nylon), the electric guitar (on the band's clean
  guitar), the Rhodes, the harp, the marimba, the xylophone and the glockenspiel, the upright bass, and, held on their
  loops, the violin, the cello, the flute and the trumpet: recorded with no vibrato, the synthesized vibrato laid over
  each as a pitch lfo. A fretted instrument's low notes are asked by string and fret, the way a player names a pitch:
  the guitar now reaches its open low E (E2), where its low asks in words never came below C#3.
