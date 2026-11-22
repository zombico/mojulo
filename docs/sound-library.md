# The recorded sound library

Mojulo's sounds are synthesized: every one is a recipe of numbers played the same way on every machine. The recorded
sound library is the one opt-in exception: realistic sound effects recorded with ElevenLabs (made on a paid account,
distributed with ElevenLabs' written permission, for use inside mojulo's experiences only), installed on a machine
that wants them and never part of the npm package. Where it is installed, the SFX shelf's realistic one-shots it
records play their recordings; where it is not, everything sounds exactly as it did. The code is
[control/lib/graph/sound-library/](../control/lib/graph/sound-library/).

## What it holds

An index and its masters, in one directory:

- `library.json`: `{ version, cards: { <card>: { shelf | band, role, loop, prompt, variants: [ { id, take, seconds,
  rate, channels, peakDb, lufs, seam?, source } ] } } }`. A **card** is one sound as it was asked for (its prompt and
  settings, `scripts/sound-library/cards/`), naming the shelf row it voices (`shelf`). Its **variants** are its takes,
  each named by its bytes' hash: a game plays them in turn, one per hit.
- `masters/<id>.wav`: each variant level-matched (one-shots peaked at -1 dBFS, beds at -24 LUFS, 16-bit 44.1 kHz),
  read by an offline render; `masters/<id>.mp3` beside it, a tenth of the size, inlined by a page.

The library is looked for at `$MOJULO_SOUNDS_DIR`, else `<$MOJULO_HOME or ~/.mojulo>/sounds`. To install a release's
tarball by hand (until `mojulo install sounds` lands):

```bash
mkdir -p ~/.mojulo/sounds
```

```bash
tar -xf sounds-spike-v2.tar -C ~/.mojulo/sounds
```

## Where it plays

- **The SFX shelf** ([sfx-shelf.md](sfx-shelf.md#recorded-voices)): a realistic one-shot the library records resolves to
  one `sample` gesture carrying its synthesized gestures as the fallback. Every page that plays the shelf (a world's
  audio channel, the sound book, a beats-sfx page) inlines the samples its cues use and decodes them when sound is
  unlocked; a cue before then plays its fallback. An offline render (an export's WAV) decodes them first.
- **The band**: a `voice: 'sample'` patch names a card and plays its variants as an instrument piece, falling back to
  the synthesized piece it names. The first recorded kit (`recRockKit`) lost to the synthesized 90s kit by ear and is
  not on the instrument shelf; it stays as the sampler's proving patch.
- Not yet: held voices and beds (the library's loops), the engine handoffs.

The kernel's `sampler` slice carries all of it; a recipe without recorded sounds emits none of it, and a page or a
render on a machine without the library is byte for byte what it was. Under test the library is never the
developer's (`vitest.setup.js` points `MOJULO_SOUNDS_DIR` at nothing); a suite that tests it builds its own.

## Making it

Maintainer tooling in [control/scripts/sound-library/](../control/scripts/sound-library/), never shipped and never
called by mojulo itself (mojulo calls no generation API):

1. **Cards** (`cards/<set>.js`): one per sound, the shelf row it voices, its prompt, length, prompt influence, loop and
   how many takes. Sets load together (`--cards spike,batch2`), each card id once.
2. **Generate** (`generate.mjs --cards <sets> --out <dir> --budget <credits> [--dry]`): the takes, from the ElevenLabs
   sound-generation API (`eleven_text_to_sound_v3`, which cost 10 credits a second), into `<dir>/takes`, every call in
   `<dir>/ledger.jsonl`; a take already made is skipped, and a call that would cross the budget is not made. The key
   is the operator's (`ELEVENLABS_API_KEY`, or a proxy that adds it; Node's fetch behind a proxy needs
   `NODE_USE_ENV_PROXY=1`), never in a file.
3. **Audition** (`board.mjs`): every take on one page with its measures, for the ears gate, which is the operator's.
4. **Condition** (`condition.mjs`, needs ffmpeg): every take kept as a variant (leaving one out is the pick), trimmed,
   level-matched, a loop's seam measured, the masters and `library.json` written; a re-run is byte-identical.

The takes, the masters and the ledger are the operator's, outside the repo; a release carries them as a tarball.
