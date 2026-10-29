### The voice's timeline: the realistic hero speaks with Kokoro's voice

The optional local voice worker now says when it spoke each phoneme, and a realistic hero's face speaks a line on that
timeline, the recording playing with the take.

- **The timed worker** (`scripts/voicegen-speak.py --timings`, `install-local-voicegen.sh --timed`): Kokoro predicts
  every phoneme's length before it renders, but the release's model keeps that inside. The first timed run derives a
  copy that exposes it as a `duration` output (`models/kokoro-v1.0.timed.onnx`, the `onnx` package's doing), and
  `kokoro-onnx` 0.6.1 turns it into each phoneme's span. Beside the WAV, `<out>.timings.json`: `{ ok, audio, seconds,
  sample_rate, voice, model, phonemes: [{ p, t, dur }] }`, each symbol as the engine spoke it. The timed rung needs
  only GitHub and PyPI (the JS rung's weights are on HuggingFace). The voice tool's worker hint and its vocabulary drawer
  say so.
- **A face that speaks a recording** (`face-acting/speech.js` `givenPhonemes`): a beat's `say: { phonemes, audio }` takes
  the sidecar as written: an engine's two-letter sounds (aɪ, oʊ, tʃ) one phoneme, a stress mark's time the vowel's it
  stresses (an unstressed vowel reduced, as the text's are), a length mark or a space the sound's before, punctuation a
  pause; the times kept whole, so the lips close for the m where the voice said it. An ASCII symbol that is no phoneme is
  refused by its index; an engine's own symbol with no reading is folded into the one before.
- **The recording with the take**: the line's `audio` rides the take (`perform`'s `events.lines`, `performanceTrack`
  `audio`) into the GLB, named in `face.performances[].audio` (`{ at, file }`, not embedded), and `/hero-live` copies it
  beside the page (inlined when published) and plays it from its beat with the take, at its speed, silent when paused,
  held or muted (a Sound toggle).
