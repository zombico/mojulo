### Recorded sound library

- **In progress.** Games and worlds can play recorded sound effects alongside the synthesized ones: a library of
  realistic sounds recorded with ElevenLabs, installed on demand and never part of the npm package. A sound keeps its
  synthesized voice, which still plays wherever the library is not installed.
- The SFX shelf plays its recordings: where the library is installed, a realistic one-shot it records (a gunshot by
  its cartridge, a footstep by its surface, an impact, a creature) plays one of its recorded takes per hit, and a
  creature the realistic style had no voice for gets one. A page carries only the recordings its level plays, as MP3.
  Other styles, sounds asked for at their own dials, held voices and machines without the library are unchanged.
- Music can play recorded instruments. A recorded piece plays one of its takes per hit and falls back to the
  synthesized piece it stands in for where the library is not installed; recipes without recorded pieces are
  unchanged to the byte. The first recorded drum kit lost to the synthesized 90s rock kit by ear, so no recorded
  instrument is offered yet.
