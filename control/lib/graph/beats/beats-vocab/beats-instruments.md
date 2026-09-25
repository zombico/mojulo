---
{ "id": "beats-instruments", "name": "Instruments, guitars, keyboards & feel (B6)", "summary": "The layered instrument model: named instruments (electric-guitar, acoustic-guitar, rock-guitar, rock-lead, piano, rhodes, organ, …) that expand to patch + color chain + performance feel; the Karplus-Strong string voice and its guitar/keyboard patches; the body, drive, and amp chain effects; and feel presets (strum, palm-mute, fingerpick, keys) that humanize a part so it stops sounding like MIDI.", "when": "add a guitar (acoustic / electric / distorted / nylon / lead), metal or hard rock, a heavy riff, a rhythm guitar with a lead over it, high-gain amp distortion, a drum kit / acoustic drums / toms / ride / crash / 808 hats, a grand piano in tune, a string section that doesn't wobble in lockstep, brass that gets brighter when played harder, portamento / glide / slides, stereo width and panning, add a piano or keyboard (piano / rhodes / e-piano / harpsichord / clavinet / celesta / music box / organ), pick an instrument by name, make a part sound played rather than quantized, strum chords, palm-muted or fingerpicked feel, dial in overdrive/distortion, warm a plucked tone with body resonance, velocity-sensitive brightness, humanize a beats-composition or beats-pattern, drop-tuned chugging guitar, nu-metal riff, picked bass, slap bass, an orchestra hit / orch stab" }
---

More families live in their own manuals: `beats-orchestra` (woodwinds, harp,
mallets, timpani), `beats-percussion` (drum machines, latin, orchestral
percussion, the arena kit), `beats-synth` (acid, reese, hoover, supersaw, FM).

## The model — four layers

An instrument is a composition of four independent layers. You never need all
four explicitly: name an instrument and you get the whole stack; override any
layer per part.

- **voice** — the synthesis topology (kernel). `osc | fm | noise | membrane |
  string`. `string` is Karplus-Strong: a plucked/struck string.
- **patch** — timbre params over a voice (a name; see below).
- **color** — chain effects that shape the tone after the voice (`body`,
  `drive`, plus the existing `filter/delay/pingpong/chorus/reverb`).
- **feel** — how notes are triggered and humanized (strum + jitter).

## Instruments — the fast path

Put `instrument` on a composition part, a pattern track, or an ambient channel
instead of `patch`; it expands to `{ patch, chain, feel }` at mint time. Any
explicit `patch` / `chain` / `feel` on the part **overrides** the instrument's
default (feel shallow-merges, so you can tweak one param). Ambient channels are
the world-soundtrack door: `{ "role": "harmony", "instrument": "piano" }` seats
the piano in a world's orchestra alongside string and brass channels.

**Pick these first for new work.** They're the fidelity shelf: tuned,
de-locked and dynamic, per "Fidelity opt-ins" below.
- Keys: `grand-piano`.
- Strings: `violin-2`, `viola-2`, `cello-2`, `contrabass-2`.
- Brass: `trumpet-2`, `french-horn-2`, `trombone-2`, `tuba-2`.
- Drums: `drum-kit`.
- Plucked strings: an existing guitar with `patchParams: { "tune": "exact" }`
  (in tune at every register).
- Placement: give each part a `pan`. The mix shares one `room` via row `send`
  (composition card).

The unsuffixed names below are **legacy, kept for existing recipes**. They
still render exactly as before; pick one only when no fidelity name exists
(e.g. guitars, rhodes, organ) or when matching an older piece.

```json
{
  "kind": "beats-composition",
  "title": "Power Chords",
  "bpm": 132,
  "parts": [
    { "name": "rhythm", "instrument": "distorted-guitar",
      "events": [["0:0:0", ["A2","E3","A3"], 0.5, 0.95]] },
    { "name": "lead", "instrument": "lead-guitar", "feel": { "strum": 0 },
      "events": [["0:0:0", "A4", 1, 0.9]] }
  ]
}
```

Legacy / 2.1 shelf — guitars: `acoustic-guitar`, `nylon-guitar`, `electric-guitar`,
`electric-clean`, `distorted-guitar`, `lead-guitar`, `muted-guitar`,
`rock-guitar`, `rock-lead` (the metal/hard-rock pair — see the `amp` effect
below; rhythm wall + a lead voiced 12dB cooler with delay so it sings on top;
reach for these when the ask is metal, hard rock, a heavy riff, or "a rhythm
guitar with a lead over it"). Strings:
`violin`, `viola`, `cello`, `contrabass`, `erhu`. Brass: `trumpet`,
`french-horn`, `trombone`, `tuba`. World/mallet: `shamisen`, `steel-drum`.
Keyboards (B6.2b): `piano`, `rhodes`, `harpsichord`, `clavinet`, `celesta`,
`music-box`, `organ`. Fidelity shelf (new names; the originals are
unchanged): `grand-piano`, `violin-2`, `viola-2`, `cello-2`, `contrabass-2`,
`trumpet-2`, `french-horn-2`, `trombone-2`, `tuba-2`, `drum-kit` — see
"Fidelity opt-ins" below.

## Keyboards — no new voice, three existing ones

The keyboard family is pure shelf data over voices that already exist:

- **`piano`** — a MODELED acoustic (no samples, per doctrine): hammer-struck KS
  string + hammer-knock attackNoise + a soundboard `body` chain + `velToFilter`
  (velocity opens the cutoff — harder is *brighter*, not just louder, which is
  the piano's expressive axis) + `pluckDetune` unison courses (two strings a
  few cents apart — the slow beat is the shimmer and the bloom-then-sing
  two-stage decay) with a long `maxRing` so bass notes ring out.
- **`rhodes`** — FM tine (bark that mellows to sine) through the suitcase-amp
  chorus. For a DX-style e-piano, override toward `fmBell`.
- **`harpsichord`** — the string voice with `pick: 0` (a quill) and NO velocity
  jitter: every note the same weight — that flatness is the instrument.
- **`clavinet`** — short funky string through a light `drive`; staccato idiom.
- **`celesta` / `music-box`** — modal partial sets (struck plate / comb tine).
  The music box keeps the `robotic` feel — it *is* a machine.
- **`organ`** — gate-envelope triangle unison + rotary-ish chorus; binary keys,
  no velocity, `robotic` feel.

## The guitar patches (string voice)

If you want the raw voice without an instrument's color/feel, reference these
patch names directly (like any patch):

- `guitarClean` — steel-string acoustic / clean electric.
- `guitarNylon` — warm classical nylon (darkest, softest attack).
- `guitarMuted` — palm-muted chug (short ring).
- `guitarLead` — driven lead through a resonant cabinet filter.
- `guitarElectric` — bright, long-sustaining raw pickup; pair with a `drive`
  chain (it has no baked cabinet — the amp supplies the tone).

- `guitarAmp` — guitarElectric with two detuned plucks (`pluckDetune`) and a
  longer ring; the feedstock for an `amp` chain (rock-guitar's patch).

String-voice patch knobs (beyond ADSR): `pluckDamping` 0→1 (bright steel →
dark nylon), `pluckDecay` ~0.98→0.999 (ring length), `pick` 0→1 (attack
roundness), `maxRing` (buffer cap seconds), `pluckDetune` (cents between two
unison plucks — piano-course shimmer dry, intermodulation growl under `amp`).

Any patch with a static `filter` can add `velToFilter: k` (B6.2b): note
velocity scales the cutoff by `(vel/0.8)^k`, so harder hits are brighter, not
just louder. Neutral at the default velocity 0.8; k ≈ 1–2 is musical. This is
what makes `keys`-feel velocity jitter read as touch on piano/rhodes/clav.

## Color effects

- **body** — acoustic body resonance: parallel bandpass resonators (air / top
  plate / box) under the dry string = hollow wooden warmth. `{ "type":"body",
  "mix":0.3 }`. Optional `resonances: [{ freq, q, gain }]`.
- **drive** — electric overdrive: a computed soft-clip + cabinet low-pass.
  `{ "type":"drive", "amount":0.6, "tone":3400 }`. `amount` 0→1 (clean→fuzzy),
  `tone` = cabinet cutoff Hz (`null` to skip the cabinet), `level` = dB makeup.
  Both effects are instrument-agnostic — `drive` fattens a bass or lead too.
- **amp** — the high-gain amp (B6.2c). `drive` colors a string; `amp` replaces
  its envelope: enough gain staging that the clip stays saturated for most of
  the note's life, so loudness holds while *brightness* decays — the
  string→amp identity switch. `{ "type":"amp", "gain":40 }` — `gain` (dB, up
  to 50) is the identity knob; `stages` (2–4 cascaded asymmetric clips),
  `bias` (asymmetry → even harmonics), `edge` (per-stage hardness),
  `presence` (dB at 3.2kHz), `cut` (cabinet cliff Hz), `level` (dB makeup,
  default −10). Rhythm wants gain ≈ 40+; a lead stays a voice at gain ≈ 30
  with `level` trimmed. Pair with `guitarAmp` (dual detuned plucks — the
  beating feeds the intermodulation growl; a lone harmonic string gives the
  clip nothing to chew).

**Distortion wants power chords, not triads.** Under `drive`, a major/minor
third intermodulates into mud; use root–fifth–octave (e.g. `["A2","E3","A3"]`).

## Feel — the anti-MIDI layer

`feel` on a part fans chords into strums and gives every note its own micro
timing / velocity / attack, deterministically (seeded — the humanized take
replays identically). Value is a **preset name** or an inline params object.

Presets: `robotic` (quantized/null), `strum-down`, `strum-alt`, `fingerpick`,
`alt-pick`, `palm-mute`, `ensemble`, `staccato`, `keys` (two hands on a
keyboard: whisper of chord roll + touch variation).

Params: `strum` (seconds a chord fans across, 0 = block chord), `strumUp` /
`strumAlternate` (stroke direction), `jitterTime`, `jitterVel`, `jitterTimbre`
(per-note ± wobble). Tight downstroke metal ≈ `{ "strum":0.008 }`; loose
acoustic ≈ `{ "strum":0.022, "strumAlternate":true }`.

Applies in `beats-composition`, `beats-pattern`, and `beats-ambient` (per-bar
evolving, seeded). A `null`/absent feel is exactly quantized playback (zero
change from before B6).

## Fidelity opt-ins (the default for new work)

Every one of these is opt-in: a part that doesn't ask renders exactly as before.

**New names.** `grand-piano` (patch `pianoGrand`) is the piano on the tuned
string: exact pitch at every register, ring time in seconds, stretched upper
partials. `violin-2` … `tuba-2` are the section patches with de-locked
per-voice vibrato, a slow pitch drift, bow/breath air under the note,
brightness that follows register, and (brass) velocity that opens the filter
sweep. `drum-kit` (patch `drumKit`) plays GM drum notes, C4 = 60: `C2` kick,
`D2` snare, `F#2` closed hat, `A#2` open hat, `F2`/`A2`/`C3` toms, `C#3`
crash, `D#3` ride. Each piece is also a patch (`kick2`, `snare2`, `tomLo`,
`tomMid`, `tomHi`, `hat808`, `hatOpen`, `ride`, `crash`). On a pattern track,
use `notes` (chords hit several pieces: `["C2","F#2"]`).

**Row fields** (part / track / channel):
- `pan` −1..1 places the row in the stereo field.
- `glide` (seconds, osc voices) slides each note in from the row's previous
  note. For erhu, trombone, violin slides and mono leads.
- `patchParams: {…}` merges over the named patch, so you can turn on any
  voice-level opt-in without a new patch name:
  - `curve: 'exp'` for exponential decay/release instead of linear.
  - `vary: true` makes noise layers differ per hit (no machine-gun hats).
  - `width` 0..1 spreads unison voices or modal partials across stereo.
  - `tune: 'exact'` tunes the string voice to within 2 cents at every register
    (the default loop runs up to +40 cents sharp in the treble).
  - `ringT60` (seconds, or `[at C2, at C7]`) sets how long a string rings.
    `maxRing` then defaults to 1.1 × T60, and the tail fades out instead of
    being cut off.
  - `stiffness` 0..1 stretches a string's upper partials (~0.5 = grand piano).
  - `keyTrack` 0..2 scales the filter cutoff by (pitch / C4)^k. At 1, the
    brightness follows the note.
  - `velToFilter` now also drives a `filterEnv` target.
  - `decayTrack` makes high modal notes ring shorter.
  - `drift` (cents) is a slow seeded pitch walk.
  - `breath: { level, tone, q }` lays filtered air under the note.
  - `vibrato: { rate, depth, delay, spread }`: `spread` 0..1 gives each unison
    voice its own seeded rate and phase.

```json
{ "name": "gtr", "instrument": "acoustic-guitar", "pan": -0.3,
  "patchParams": { "tune": "exact", "ringT60": [5, 1.2] }, "events": [...] }
```

Mix and export blocks (`room` + `send`, `master`, `export`) are on the
composition card.

## The band (anthem styles)

| instrument | what it is |
|---|---|
| `drop-guitar` | A drop-tuned chug: dual pluck, tight lows, an amp hotter than `rock-guitar`. Pair it with `art: 'pm'` and `power: true`. |
| `picked-bass` | A bright pick on a long string with a little drive. The driving 8ths and octave fills (chart mode `octaves`). |
| `slap-bass` | Brighter still; `art: 'pop'` snaps. |
| `orchestra-hit` | The classic orchestra hit, synthesized: a detuned saw stack with a fast filter fall, a sub, a noise bloom and a slight pitch drop, 250 ms, into a hall. Play it as a stacked chord (`{ at, chord: 'i', voicing: 'spread' }`) on section changes. |
| `drum-kit-90s-rock` | The tight, bright 90s kit on a plate (card `beats-percussion`). |

Guitar articulations (bends, slides, dives, vibrato, palm mute, pinch
harmonics) are in `beats-articulations`.
