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
