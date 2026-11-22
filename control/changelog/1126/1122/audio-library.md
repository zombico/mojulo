### Recorded sound library

- **In progress.** Games and worlds can play recorded sound effects alongside the synthesized ones: a library of
  realistic sounds recorded with ElevenLabs, installed on demand and never part of the npm package. A sound keeps its
  synthesized voice, which still plays wherever the library is not installed.
- The SFX shelf plays its recordings: where the library is installed, a realistic one-shot it records (a gunshot by
  its cartridge, a footstep by its surface, an impact, a creature) plays one of its recorded takes per hit, and a
  creature the realistic style had no voice for gets one. A page carries only the recordings its level plays, as MP3.
  Other styles, sounds asked for at their own dials and machines without the library are unchanged.
- Cars sound recorded: an engine is a set of loops recorded at steady revs, crossfaded and bent in pitch as it revs, so
  it climbs smoothly; tyres screech and the road roars from recordings too. The open city's car and a racing car share
  the recordings and drive them their own ways (the city's through a small speaker, short of its redline; the racer's
  over the whole range). The first engine is a small hatchback.
- Music can play recorded instruments. A recorded piece plays one of its takes per hit and falls back to the
  synthesized piece it stands in for where the library is not installed; recipes without recorded pieces are
  unchanged to the byte. The first recorded drum kit lost to the synthesized 90s rock kit by ear, so no recorded
  instrument is offered yet.
