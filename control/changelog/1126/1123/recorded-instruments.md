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
- The orchestra recorded: the French horn, the trombone and the tuba, the viola and the bowed contrabass, the clarinet,
  the oboe and the bassoon held on their loops (their synthesized vibrato laid over them), the timpani and the tubular
  bells struck. Every orchestral patch's second and third tiers are heard on their first tier's recording, each matched
  to its own patch's loudness, so a score written on any tier of the orchestra is heard recorded with `recorded: true`.
- The setting colours recorded: the harpsichord, the music box, the banjo, the harmonica (held, its vibrato laid over it),
  the shamisen and the pedal steel. The erhu was recorded too but stays synthesized: its takes came back as a drone.
- The pitch converter reads every recorded instrument better: it searches round the note asked (a hum or a bell's odd
  partial no longer reads as the note), reads six stretches of the sounding note and keeps the largest agreeing group
  (one slipped read no longer throws a good take away), and loops a held note inside the part that still sounds. Nearly
  every instrument now keeps all its takes: the music box went from 2 to 40, the glockenspiel from 15 to 47.
- The recorded piano and Rhodes have velocity layers: each note recorded soft and hard beside the medium takes, so a
  note played gently is a gentle note (darker, rounder) and one struck hard is a hard one (brighter, its hammer heard),
  not the same take turned down or up. Each note plays the take nearest it in pitch and in strength; its level still
  follows its velocity. An instrument without layers is played exactly as before.
- A recorded instrument now moves as its synthesized one does: a glide in from the previous note, a portamento, a
  glissando that slides (a struck one still runs the scale), and a legato run, one take whose pitch walks its notes with
  no retrigger. The take's playback rate rides the same ramps the oscillator's frequency would.
- A key let go is heard on the recorded piano and organ: the piano's felt damper falling back onto its strings (low,
  middle and high registers) and the organ's key click, played when the note's key is released, under the note's level
  and softer the softer it was played. The harpsichord's and the Rhodes' recorded releases came back with a buzz at one
  fixed pitch, so their notes still simply fade.
- The recorded violin reaches its upper register: its notes asked "on its upper strings" had all come back an octave
  low (nothing above B4, so a melody at E5 was a lower take stretched up as much as an octave, thin and screechy). Asked
  again by string and position (up the E string, up the A string), it now reaches A#5, every note of a high melody within
  a few semitones of a real take. The erhu, asked the same way, still came back on its open strings, so it stays synthesized.
- The recorded violin is one violin: its takes from separate passes in different words played as different violins side
  by side (a high run heard as another instrument). It is recorded again as one set, every note asked the same way up its
  four strings, and its earlier passes are kept but set aside.
- The Rhodes' release is heard: its recorded key-off carries a tick at one pitch, so it is tuned to each note let go
  (a release with a pitch of its own is measured, and a patch can ask for it to follow the note).
- The harp, the marimba and the vibraphone have velocity layers, soft and hard beside their medium takes.
