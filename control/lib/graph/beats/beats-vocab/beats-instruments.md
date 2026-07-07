---
{ "id": "beats-instruments", "name": "Instruments, guitars & feel (B6)", "summary": "The layered instrument model: named instruments (electric-guitar, acoustic-guitar, …) that expand to patch + color chain + performance feel; the Karplus-Strong string voice and its guitar patches; the body and drive chain effects; and feel presets (strum, palm-mute, fingerpick) that humanize a part so it stops sounding like MIDI.", "when": "add a guitar (acoustic / electric / distorted / nylon / lead), pick an instrument by name, make a part sound played rather than quantized, strum chords, palm-muted or fingerpicked feel, dial in overdrive/distortion, warm a plucked tone with body resonance, humanize a beats-composition or beats-pattern" }
---

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

Put `instrument` on a composition part instead of `patch`; it expands to
`{ patch, chain, feel }` at mint time. Any explicit `patch` / `chain` / `feel`
on the part **overrides** the instrument's default (feel shallow-merges, so you
can tweak one param).

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

Shelf: `acoustic-guitar`, `nylon-guitar`, `electric-guitar`, `electric-clean`,
`distorted-guitar`, `lead-guitar`, `muted-guitar`. (More families land as their
voices do — bells/mallets when the modal voice ships; see beats.plan.md B6.)

## The guitar patches (string voice)

If you want the raw voice without an instrument's color/feel, reference these
patch names directly (like any patch):

- `guitarClean` — steel-string acoustic / clean electric.
- `guitarNylon` — warm classical nylon (darkest, softest attack).
- `guitarMuted` — palm-muted chug (short ring).
- `guitarLead` — driven lead through a resonant cabinet filter.
- `guitarElectric` — bright, long-sustaining raw pickup; pair with a `drive`
  chain (it has no baked cabinet — the amp supplies the tone).

String-voice patch knobs (beyond ADSR): `pluckDamping` 0→1 (bright steel →
dark nylon), `pluckDecay` ~0.98→0.999 (ring length), `pick` 0→1 (attack
roundness), `maxRing` (buffer cap seconds).

## Color effects

- **body** — acoustic body resonance: parallel bandpass resonators (air / top
  plate / box) under the dry string = hollow wooden warmth. `{ "type":"body",
  "mix":0.3 }`. Optional `resonances: [{ freq, q, gain }]`.
- **drive** — electric overdrive: a computed soft-clip + cabinet low-pass.
  `{ "type":"drive", "amount":0.6, "tone":3400 }`. `amount` 0→1 (clean→fuzzy),
  `tone` = cabinet cutoff Hz (`null` to skip the cabinet), `level` = dB makeup.
  Both effects are instrument-agnostic — `drive` fattens a bass or lead too.

**Distortion wants power chords, not triads.** Under `drive`, a major/minor
third intermodulates into mud; use root–fifth–octave (e.g. `["A2","E3","A3"]`).

## Feel — the anti-MIDI layer

`feel` on a part fans chords into strums and gives every note its own micro
timing / velocity / attack, deterministically (seeded — the humanized take
replays identically). Value is a **preset name** or an inline params object.

Presets: `robotic` (quantized/null), `strum-down`, `strum-alt`, `fingerpick`,
`alt-pick`, `palm-mute`, `ensemble`, `staccato`.

Params: `strum` (seconds a chord fans across, 0 = block chord), `strumUp` /
`strumAlternate` (stroke direction), `jitterTime`, `jitterVel`, `jitterTimbre`
(per-note ± wobble). Tight downstroke metal ≈ `{ "strum":0.008 }`; loose
acoustic ≈ `{ "strum":0.022, "strumAlternate":true }`.

Applies in `beats-composition` and `beats-pattern`. A `null`/absent feel is
exactly quantized playback (zero change from before B6).
