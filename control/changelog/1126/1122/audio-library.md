### Recorded sound library

- **In progress.** Games and worlds can play recorded sound effects alongside the synthesized ones: a library of
  realistic sounds recorded with ElevenLabs, installed on demand and never part of the npm package. A sound keeps its
  synthesized voice, which still plays wherever the library is not installed.
- Music can play recorded instruments. A recorded piece plays one of its takes per hit and falls back to the
  synthesized piece it stands in for where the library is not installed; recipes without recorded pieces are
  unchanged to the byte. The first recorded drum kit lost to the synthesized 90s rock kit by ear, so no recorded
  instrument is offered yet.
