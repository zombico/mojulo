---
{ "id": "beats-composition", "name": "Composition (explicit score)", "summary": "A literal note-event score: parts with [time, notes, dur, vel] events against one transport. Deterministic by construction — no dice. The MIDI-shaped middle layer between vibe recipe and sound design.", "when": "compose a melody/theme/jingle, write a specific tune, transcribe a musical idea note by note, a fanfare or sting with exact notes, a piece with a beginning and an end" }
---

## Shape

```json
{
  "kind": "beats-composition",
  "title": "Door Fanfare",
  "bpm": 120,
  "swing": 0,
  "loop": false,
  "parts": [
    { "name": "lead", "patch": "fmBell",
      "chain": [{ "type": "reverb", "decay": 4, "wet": 0.35 }],
      "events": [
        ["0:0:0", "C4", "0:0:2", 0.8],
        ["0:0:2", "E4", "0:0:2", 0.8],
        ["0:1:0", "G4", "0:1:0", 0.9],
        ["0:2:0", ["C5","E5","G5"], "0:2:0", 1.0]
      ] },
    { "name": "bass", "patch": "bassMono",
      "events": [["0:0:0", "C2", "1:0:0", 0.9]] }
  ]
}
```

## Semantics

- **events** are `[time, notes, dur?, vel?]` — time and dur in
  `"bar:beat:sixteenth"` (4/4) or a bare number of beats. `notes` is one note
  name or an array (a chord). `vel` is 0–1 (default 0.8).
- **loop: true** restarts the score at its end; default plays once and stops.
- **patch / chain** as in beats-ambient (see that card).
- No seed: a composition has no dice — the same score plays identically every
  time by construction.

## Musical guidance

Compositions are where the agent's music theory does the work: voice-lead the
chords, resolve to the tonic, put the bass on roots and fifths. For a jingle,
2–4 bars is plenty; end on beat 1 of a new bar for a clean button. Melodies sit
well an octave-plus above the bass. `fmBell` and `chipLead` carry melody;
`pad` chords underneath want long durations, not restrikes.

For anything meant to sound *played*, prefer a named `instrument` on the part
over a raw patch (see the beats-instruments card): `piano` is the workhorse —
melody, accompaniment, and bass from one instrument, with velocity as the
expressive axis (harder = brighter). Sections compose: piano + `violin`/
`viola`/`cello`/`contrabass` + brass make an orchestra; give each part its own
register and let the `ensemble`/`keys` feels de-quantize the attacks. Since a
KS piano can't tie across bars, re-strike long melody notes softer.

## Multi-section arrangements

One score can hold a whole song section — verse → pre-chorus → chorus. Events
for bar N sit at `"N:beat:sixteenth"`, so a 10-bar arrangement is events spread
across bars 0–9 with `loop: true` to cycle the section. Four patterns carry it
(an Em-verse → G-chorus soft-rock section is the reference case):

- **Sections are parts + silence, not a section object.** To make a voice
  *enter* at the chorus, give it a part whose earliest event is the chorus
  downbeat — an always-present part that is simply silent until then. A part
  that changes role (melody in the verse, arpeggio in the chorus) is one part
  whose event character shifts at the bar boundary.
- **Lift by key, not just melody.** Modulate the chorus up into the relative
  major (E-minor verse → G-major chorus): re-voice the chord parts and bass
  roots into the new key at the section's first bar. The brightness is
  harmonic; a pre-chorus `bVI → bVII` (C → D into G) is the launch ramp.
- **Build and turn with fills.** A pre-chorus snare crescendo (four rising
  sixteenths on beat 4) pushes into the chorus; a turnaround fill closes the
  loop.
- **No tom on the shelf? Pitch the membrane.** The `kick` patch is a tunable
  drum — higher note names (`"A2"`, `"F2"`, `"D2"`) read as descending toms, so
  a tom fill is a few pitched `kick` events, no new instrument.

At this scale (hundreds of events across 6–8 voices) author the score with a
small generator, not by hand — restating every bar's groove literally is what
the pattern kind exists to avoid, so reserve composition for when the section
structure or the lead line genuinely needs explicit control.

## Performance macros + revising

Every channel/part/track accepts two performance macros (B5.2): `transpose`
(semitones, [-24, 24], applied at schedule time) and `tone` ([0, 1], a low-pass
at the chain head — 1 = open, 0 = dark; delay/reverb tails darken with their
source). Stored values seed the player's sliders and round-trip through the
manifest. In a world, `audio.bindings` drives these macros from sim state
(depth/height/speed/proximity → tone/level/transpose) — read-only, one
direction, so the soundtrack follows the world without ever writing back.

Revise with the domain tools, never re-mint: `get_beats { ref }` reads the
recipe + revision index + open annotations; `update_beats { ref, manifest,
note, resolveAnnotations }` validates like create and snapshots a revision
(`?rev=` plays any of them); `diff_beats { refA, refB }` (accepts `ref@rev`)
reports what changed musically; `annotate_beats` marks bars/tracks/cues. The
studio at `/beats/<ref>` is the listening + marking surface. Hand off to
musicians with `export_beats { format: 'midi' }` (or `/api/beats/<ref>.mid`):
the score as a Standard MIDI File — swing/feel/velocities travel, timbre
ships in the .wav.
