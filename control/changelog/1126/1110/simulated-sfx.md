### Mouth foley: sound effects traced from a voice

- **The `trace` gesture** (kernel feature `trace`, opt-in): a noise vocoder. Fixed bands each follow a lane of levels,
  frame by frame, over seeded noise (`air`) and a sawtooth following a pitch lane (`hum`), with a pan lane (`side`).
  It is how a voice's sound becomes a recipe: numbers traced from it, synthesized on play. The kernel stays
  synthesized, never sampled; a page that uses no trace gets no new bytes.
- **The tracer** (`sfx-shelf/trace.js`, pure): a rendered sound in, a trace gesture out, quantized to whole dB.
- **The `mouth` style and set** (`sfx-shelf/sets/mouth.js`): swishes, swooshes and swings made the way a vocal
  sound-effect performer makes them. Kokoro says a sound word (Japanese manga words: シュッ, ザシュッ, ヒュン, ブン,
  スパッ …), the vowel is cut out, the air is swept, panned and layered, and the result is traced. Voiced: `swing`,
  `blade-swing`, `katana-swing` (the katana's own synth with the traced voice under it), `net-swish`, and a new row,
  `swell-in` (a reversed swish). The katana has no heavy cut here (cut air sounds the same light or hard):
  `katana-heavy-swing` is the swing's sound. Falls back to `realistic`.
- **The bake** (`scripts/mouth-foley/`): renders the recipes through the local voice worker and traces them into the
  generated `sfx-shelf/sets/mouth-traces.js`. Kokoro is needed only to re-bake; playing and exporting never need it.
