### Recorded instruments, note by note

- An instrument can be played note by note from recorded takes. The sound library measures each take's real pitch to
  the cent (the generator gets a note's letter right but its octave by chance) and, for an instrument that holds, a
  seamless loop on a whole number of its periods. A page then plays each note on the take nearest it, bent the rest of
  the way, and holds it on its loop for as long as the note lasts. The synth's modulators carry over: its unison
  detune, its pitch lanes and vibrato, a pitch LFO, and, as before, its filter, envelope and tremolo.
- The first is a recorded electric drawbar organ (`organRec`, played as the organ with its own chain), heard beside the
  synthesized organ; on a machine without the library it is the synthesized organ, byte for byte. It is not on the
  instrument shelf until it is chosen by ear.
