---
{ "id": "beats-effects", "name": "Effects: the era rack, gate, duck, stutter, vocoder", "summary": "Chain effects for the 90s/00s rack, native WebAudio: phaser, flanger, bbd chorus, tape wow/flutter, autopan, bitcrush, ring mod, tube/fuzz/fold drive, dub delay, gated and reverse reverb, a channel vocoder; and the scheduled transforms on a row: trance gate, sidechain duck, stutter / beat-repeat.", "when": "phaser, flanger, chorus like a Juno, tape wobble / wow and flutter, auto-pan, bitcrusher / lo-fi, ring modulator, fuzz / tube / wavefolder distortion, dub delay, gated reverb, reverse reverb, vocoder / robot voice, sidechain pumping, ducking to the kick, trance gate, stutter / beat repeat, glitch" }
---

## Chain effects (in a row's `chain`, in order)

| type | params |
|---|---|
| `phaser` | `stages` (2–12), `rate`, `depth` (octaves swept), `freq`, `mix` |
| `flanger` | `rate`, `delay` (ms, 3–20), `depth` (ms), `feedback`, `mix` |
| `chorus` + `model: 'bbd'` | `mode: 'I' \| 'II' \| 'I+II'`, `mix`. The bucket-brigade ensemble (the Juno idiom): opposite-phase delays hard L/R over a darkened wet. |
| `tape` | `wow`, `flutter` (0..1), `drive`, `bump` (dB at 90 Hz), `tone` |
| `autopan` | `rate` or `sync` (`'1/4'`), `depth` |
| `crush` | `bits` (1–16), `mix`. Rate reduction isn't built. |
| `ringmod` | `hz`, `mix` |
| `drive` + `model` | `'tube'` (even harmonics), `'fuzz'` (hard clip), `'fold'` (wavefolder) |
| `delay` + `model: 'dub'` | `filter` (Hz), `drive`. Each repeat is darker and dirtier. |
| `reverb` + `model` | `'gated'` + `gate` (s): the room is cut there. `'reverse'`: the impulse is played backwards (a swell after the hit). The shared `room` takes these models too. |
| `vocoder` | `modulator` (another row), `bands` (4–24), `hide`, `gain`, `smooth` |

About the vocoder:

- This row is the carrier: use a bright, sustained saw pad.
- The modulator row is tapped before its fader. `hide: true` silences its own
  fader, so only the robot is heard.
- A sung part (`patch: 'voice'`) can be the modulator, but it renders only in
  the WAV export.

## Scheduled transforms (on a row, composition or pattern)

- **`gate: { mask, smooth?, depth? }`**: the trance gate. `mask` gives a level
  per sixteenth (0..1, wrapping).
- **`duck: { by, depth?, attack?, release? }`**: the sidechain pump. The gain
  dips `depth` dB (default 9) at every onset of row `by` and recovers over
  `release`. It lines up with the kick by construction.
- **`stutter: [{ at, len, repeats }]`**: beat-repeat. The slice at `at` plays
  `repeats` times and replaces what those repeats cover. On a row it acts on
  that row; at manifest level it acts on every row.

Gate and duck shape each note of the row before its chain, and multiply with
hairpins and articulation shapes.

## Worked examples

- **Trance**: a `supersaw-lead` chord track with
  `"gate": { "mask": [1,0,1,1,0,1,1,0,1,0,1,1,0,1,0,1] }` and
  `"duck": { "by": "kick", "depth": 10 }`.
- **French house at 124**: a saw chord loop with a synced `lfo` on its filter
  (`sync: '4/1'`, triangle), a `phaser`, a `compress` and `duck` by the kick.
  A robot voice: a saw pad with `vocoder` whose modulator is a sung part,
  hidden. The ears question is whether the vocoder is intelligible.
