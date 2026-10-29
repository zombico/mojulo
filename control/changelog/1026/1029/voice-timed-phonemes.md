### The recorded take: a realistic hero's acting saved with its voice

A realistic hero's take is recorded whole: the face's acting and the line's audio, kept as mojulo's own outcome and
carried by the export, whether the voice came from the local voice worker, another speech engine or a person.

- **The recording kept** (`face-acting/recordings.js`): a beat's `say: { text, audio: '<a WAV>' }` at the character door
  (`create_character`, `update_character`) saves the recording under the outcomes directory, content-addressed (its id
  its bytes' hash: the same audio one recording, the same id on every machine that holds it), and the beat keeps the
  id, its length and its timing. The take needs no worker after it is made. A WAV of any depth and any channels is read;
  a performance given a path instead of a saved recording is refused by name.
- **Timed three ways, by what the line carries**: by its engine (`speak.py --timings` beside the WAV, or `phonemes`
  given); else by its text ALIGNED to the recording (`face-acting/align.js`: the recording's voiced stretches found by
  its loudness, the text's pauses laid on its longest silences, each phrase's phonemes spread over the voice's own time
  by the rules' durations, the words timed with them so an emphasized one still lifts the brows); else, no text, by its
  LOUDNESS (the jaw and the lips opening with the voice). A person's narration is a take as a voice worker's is.
- **The take with its sound in the file**: the skinned GLB embeds each line's recording in its own buffer
  (`face.performances[].audio`: `{ at, recording, mimeType, bufferView }`; `missing` where the exporting machine holds no
  such recording), and `/hero-live` plays it from the file with the take (a Sound toggle), published pages too.
- **The timed worker** (`scripts/voicegen-speak.py --timings`, `install-local-voicegen.sh --timed`): Kokoro predicts every
  phoneme's length before it renders, but the release's model keeps that inside. The first timed run derives a copy that
  exposes it as a `duration` output (`models/kokoro-v1.0.timed.onnx`), and `kokoro-onnx` 0.6.1 turns it into each
  phoneme's span: `<out>.timings.json` beside the WAV, each symbol as the engine spoke it. The timed rung needs only
  GitHub and PyPI. `face-acting/speech.js` `givenPhonemes` reads the engine's symbols as written (its two-letter sounds
  one phoneme, a stress mark its vowel's, a space folded in, a mark a pause). The voice tool's worker hint and its
  vocabulary drawer say how to hand a recording to a hero.
