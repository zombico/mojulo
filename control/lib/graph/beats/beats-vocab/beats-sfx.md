---
{ "id": "beats-sfx", "name": "Sound effects (foley cues)", "summary": "Named foley cues built from four chiptune gestures — sweep, flutter, burst, thump. Pitch-and-volume choreography fired by an event, not a loop. The world-SFX primitive (pickup dings, lasers, impacts, charge-ups).", "when": "a sound effect, foley, a pickup ding / laser zap / explosion / jump sound / charge-up, UI feedback sounds, game event stingers, 'make it go pew'" }
---

## Shape

```json
{
  "kind": "beats-sfx",
  "title": "Range Pack",
  "cues": {
    "pew":    [{ "type": "sweep", "wave": "square", "from": "A5", "to": "A4", "dur": 0.09 }],
    "ding":   [{ "type": "sweep", "wave": "sine", "from": "C6", "to": "E6", "dur": 0.06 },
               { "type": "burst", "at": 0.02, "decay": 0.08, "vol": 0.3, "highpass": 6000 }],
    "impact": [{ "type": "burst", "decay": 0.25 }, { "type": "thump", "from": "G2", "to": "G1", "decay": 0.3 }],
    "charge": [{ "type": "flutter", "rateHz": 30, "hold": 1.6,
                 "tiers": [
                   { "at": 0.0, "table": ["E4","G4","A4","B4"] },
                   { "at": 0.7, "table": ["A4","C5","D5","E5"] },
                   { "at": 1.2, "table": ["E5","G5","A5","E6"] } ] },
               { "type": "sweep", "at": 1.6, "wave": "square", "from": "E6", "to": "E4", "dur": 0.3 },
               { "type": "burst", "at": 1.6, "decay": 0.25 }]
  }
}
```

## The four gestures (the whole 8-bit foley vocabulary)

- **sweep** — pitch ramp: `{ wave?, from, to, dur?, vol?, at? }`. Up = jump /
  power-up; down = laser / fall. This is the classic "pew".
- **flutter** — a pitch table retriggered at `rateHz` (20–30 Hz reads as
  texture, not melody) for `hold` seconds, with `tiers` swapping the table at
  offsets — the charge-up. A tier up is a table swap, never a filter.
- **burst** — enveloped noise: `{ decay?, vol?, highpass?, at? }`. Impacts,
  explosions, scuffs, hats.
- **thump** — pitch-swept sine: `{ from?, to?, decay?, vol?, at? }`. Kicks,
  landings, heavy hits.

A cue is a gesture LIST — layer them with `at` offsets (an impact = burst +
thump at the same instant; a charge = flutter, then a release sweep + burst at
the flutter's end).

## Wiring into worlds

A world binds cues to its live runtime via `manifest.audio.sfx`: bus reactions
and inputs may carry `sound: '<cueId>'`, footsteps ride the gait channel, and
`pickup`/`hitConfirm`-style bus events map to cues by event type. Everything is
a pure function of (params, time) — muted capture runs are byte-identical.

## Revising

Revise with the domain tools, never re-mint: `get_beats` reads the cues +
revision index; `update_beats` validates like create and snapshots a revision;
`annotate_beats` marks a cue (`{ scope: 'cue', cue }`); `diff_beats` reports
added/removed/changed cues. The studio at `/beats/<ref>` fires cues live.
