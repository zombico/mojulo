---
{ "id": "beats-synth", "name": "Synths: virtual analog, 4-op FM and the acid line", "summary": "The 90s/00s synth core, native WebAudio: pulse + PWM, the supersaw, harmonic tables, a sub, patch LFOs (synced to tempo), a resonant 24 dB ladder filter, filter-env depth; 4-operator FM with the eight classic algorithms; pattern accent / slide / ratchet / probability for acid lines. Era instruments: acid, reese, hoover, poly strings, string machine, trance pluck and supersaw lead, rave stab, wobble, FM bass / keys / brass / organ / bell.", "when": "303 acid line, a squelchy resonant bassline, accent and slide, trance supersaw, a JP-8000 style lead, a hoover, 90s rave stab, a reese bass for drum and bass, a wobble bass synced to the beat, Juno style poly strings, a string machine, PWM pads, FM bass like a TX81Z, DX style electric piano / brass / bells, an FM organ, a synth arpeggio, a ratcheting hi-hat, random probability steps" }
---

Every sound here is built from native WebAudio nodes. The machines each idiom
recalls are named in this prose only; the ids describe the sound.

## Instruments

| instrument | the idiom |
|---|---|
| `acid-bass` | A saw into a resonant 24 dB ladder with a fast sweep. Accent and slide ride the pattern (the 303 line). |
| `reese-bass` | Two detuned saws drifting against each other, a slow cutoff sway, a sub. |
| `hoover` | A PWM pulse stack diving in from above, bbd chorus. |
| `poly-strings` / `string-machine` | A slow PWM ensemble (the Juno idiom) / a divide-down string ensemble. |
| `trance-pluck` / `supersaw-lead` | The supersaw: 7 saws on the classic detune curve (the JP-8000 idiom). |
| `rave-stab` | An organ table through a swept filter. |
| `wobble-bass` | The ladder with an LFO on the cutoff, synced to the beat. |
| `fm-bass` / `fm-keys` / `fm-brass` / `fm-organ` / `fm-bell` | 4-op FM (the TX81Z / DX idioms). |

## Patch fields (on a patch, or via a row's `patchParams`)

- `wave: 'pulse'` + `pw` (0.02–0.98; 0.5 has no even harmonics).
- `wave: 'supersaw'` + `supersaw: { detune: 0..1, mix: 0..1 }`.
- `table`: a named harmonic table (`organStab`, `organFull`, `digitalA`,
  `digitalB`) or sine amplitudes `[h1, h2, …]`.
- `sub: { level, octave: 1 | 2 }`, `noise: { level }`.
- `lfo`: 1–2 slots `{ rate | sync, shape, target, depth, delay? }`.
  - `sync` is a note fraction (`'1/8'`, `'1/8t'`, `'1/8.'`, `'4/1'`); it is
    resolved to Hz at the recipe's bpm.
  - `shape`: sine | triangle | square | ramp.
  - `target`: pitch | filter | pw | amp | pan.
  - `depth` is in cents for pitch and filter, 0..1 for pw, amp and pan.
- `filter: { mode, freq, q, slope: 24, drive }`. `slope: 24` on a lowpass is
  the ladder, with the resonance `q` in dB on its last stage. You can also
  write `mode: 'ladder24' | 'hp24' | 'bp' | 'svf12'`.
- `filterEnv: { from, to, decay, amount?, velAmount? }`: the sweep's depth.
  A harder hit sweeps deeper.
- `voice: 'fm4'` + `algorithm` (1–8) + `ops: [{ ratio, level, attack, decay,
  sustain, release, velSens, detune }]` (up to 4) + `feedback` (op 4, 0..1).
  A modulator's `level` is its index in radians. Algorithms:
  1. 4→3→2→1
  2. 3+4→2→1
  3. 3→2→1 with 4→1
  4. 4→3→1 with 2→1
  5. two stacks (2→1, 4→3)
  6. 4 → 1, 2 and 3
  7. 4→3 plus carriers 1 and 2
  8. four carriers

## Pattern step fields (beside `mask`, wrapping like it)

- `accent`: 0/1 or a level. It deepens the filter sweep and lifts the level;
  consecutive accents stack.
- `slide`: holds the step into the track's next note with a 60 ms glide. It is
  one note with no retrigger.
- `ratchet`: retriggers inside the step (2–8).
- `prob`: a seeded coin per loop. The live page and the export make the same
  choice.

## Worked examples

- **Acid at 128**: `acid-bass` over a 32-step mask with
  `accent: [1,0,0,1,0,0,1,0,0,0,1,1,0,0,0,1]` and
  `slide: [0,0,1,0,0,0,0,0,0,0,0,1,0,0,1,0]`, plus a `drum-machine-88` kit and
  a `prob`-thinned rim. The ears question is the slide and accent feel.
- **Rave at 136**: `hoover` hits, a `rave-stab` on the harmony bus
  (`chordVoice`), and a syncopated break from `acoustic-kit` hits (never a
  sample).
- **Drum & bass at 172**: `reese-bass` under a two-step break.
- **Trance at 138**: `supersaw-lead` chords, trance-gated and ducked by the
  kick (`beats-effects`), a `trance-pluck` arp, and an off-beat bass.
- **FM at 108**: `fm-bass` on the chord roots, with `fm-keys`, `fm-brass`,
  `fm-bell` and `fm-organ`.
