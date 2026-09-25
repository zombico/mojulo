---
{ "id": "beats-effects", "name": "Effects: the era rack, gate, duck, stutter, vocoder", "summary": "Chain effects for the 90s/00s rack, native WebAudio: phaser, flanger, bbd chorus, tape wow/flutter, autopan, bitcrush, ring mod, tube/fuzz/fold drive, dub delay, gated and reverse reverb, a channel vocoder; and the scheduled transforms on a row: trance gate, sidechain duck, stutter / beat-repeat. And for anthem production: the plate reverb, section sweeps (a filter-swept breakdown, a pre-drop low cut, fades), per-row trims, and master styles that master the export to the loud 2000s or the brighter 90s.", "when": "phaser, flanger, chorus like a Juno, tape wobble / wow and flutter, auto-pan, bitcrusher / lo-fi, ring modulator, fuzz / tube / wavefolder distortion, dub delay, gated reverb, reverse reverb, vocoder / robot voice, sidechain pumping, ducking to the kick, trance gate, stutter / beat repeat, glitch, a plate reverb on the snare or vocal, a filter sweep over a breakdown, filter the whole mix before the drop, fade in over 8 bars, automate the filter, a loud 2000s master, mastered loud, a brighter 90s master, loudness -8 LUFS" }
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

## Anthem production

- **Plate reverb.** `model: 'plate'` on a chain `reverb` or on the recipe's
  `room`. It is dense from the first millisecond, bright, has a short
  pre-delay, and suits a decay of 1.2–2.5 s. The 90s snare and vocal space.
- **Section sweeps** (`beats-composition`). The shape is
  `sweeps: [{ row | 'master', param, from, to, at, over, curve? }]`: a ramp
  over bars on a known param.
  - Params:
    - `tone`: 0..1, the tone-macro scale
    - `lowcut`: Hz of a highpass (20 is open)
    - `level`: dB
    - `send`: 0..1 (the row's room send)
    - `pan`: −1..1
  - `curve: 'exp'` is the default (even in pitch and dB).
  - Before its first sweep a param sits at that sweep's `from`; after a sweep,
    at its `to`.
  - The master sweeps tone, lowcut and level.
  - `tone` and `lowcut` sit at the row's chain head; `level` and `pan` sit
    after the chain.
  - The filter-swept breakdown:
    `{ row: 'pad', param: 'tone', from: 0.2, to: 1, at: '40:0:0', over: '8:0:0' }`.
  - The pre-drop low cut:
    `{ row: 'master', param: 'lowcut', from: 20, to: 700, at: '47:0:0', over: '1:0:0' }`,
    then reset it on the drop with `from: 20, to: 20`.
- **`trim`** (dB) on a row: a gain after its chain, before the fader. It turns
  an amp row down, where a level at the chain head can't.
- **`master.style`.**
  - `'bright-90s'` plays the era's gentler bus (glue compressor, a touch of
    clip, a brickwall limiter, an air shelf). The WAV export masters it to
    about −11 LUFS / −1 dBTP.
  - `'loud-00s'` pushes harder, and the export masters it to about −8 LUFS /
    −0.3 dBTP: the 2000s loudness. It is exciting on a chorus and fatiguing
    over a whole album. It is the authentic-era choice for the energy styles;
    the shipped templates use `bright-90s`.
  - An explicit `export.normalize` still wins.
- **`band: 'anime-rock' | 'trance-pop'`.** A mix template (see
  `beats-composition`).
