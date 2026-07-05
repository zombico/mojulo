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
