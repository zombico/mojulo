---
{ "id": "beats-pattern", "name": "Pattern (step-sequencer groove)", "summary": "A groove loop authored as a step grid: tracks × sixteenth-step velocity masks with optional per-step note contours. Deterministic, no dice — the drum-machine / groovebox kind. A track's instrument is a synth patch OR a foley gesture (the gesture vocabulary doubles as the drum kit).", "when": "make a beat, a drum pattern, a groove, a house/garage/techno/hip-hop loop, program a drum machine, a bassline with a step sequencer feel, four-to-the-floor, a 2-step or breakbeat pattern" }
---

## Shape

```json
{
  "kind": "beats-pattern",
  "title": "Night Bus",
  "bpm": 132,
  "swing": 0.34,
  "steps": 32,
  "tracks": [
    { "name": "kick", "gesture": { "type": "thump", "from": "G2", "to": "G0", "decay": 0.35 },
      "mask": [1,0,0,0, 0.9,0,0,0, 1,0,0,0, 0.9,0,0,0, 1,0,0,0, 0.9,0,0,0, 0,0,0.85,0, 0.9,0,0,0] },
    { "name": "clap", "cue": [
        { "type": "burst", "decay": 0.05, "highpass": 1200 },
        { "type": "burst", "at": 0.013, "decay": 0.05, "highpass": 1200 },
        { "type": "burst", "at": 0.027, "decay": 0.24, "highpass": 1200 } ],
      "mask": [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0] },
    { "name": "hats", "patch": "hat",
      "mask": [0,0,1,0, 0,0,1,0.45, 0,0,1,0, 0,0,1,0.45] },
    { "name": "bass", "patch": "bassMono",
      "mask":  [1,0,0,0.8, 0,0,0.9,0, 0,0,0.9,0, 0,0,0.8,0],
      "notes": ["F1","F1","F1","F1","F1","F1","Ab1","Ab1","F1","F1","C2","C2","F1","F1","Eb2","Eb2"] },
    { "name": "stab", "patch": "sawStab",
      "chain": [{ "type": "delay", "time": "3/16", "feedback": 0.34, "mix": 0.16 }],
      "mask":  [0,0,0,0, 0,0,0,0.9, 0,0,0,0, 0,0.7,0,0],
      "notes": ["F3","F3","F3","F3","F3","F3","F3","F3","Ab3","Ab3","Ab3","Ab3","Ab3","Ab3","Ab3","Ab3"] }
  ]
}
```

## Semantics

- **steps** — sixteenths per loop, 8–64 (default 32 = two bars of 4/4). The
  pattern loops forever; there is no end and no seed — a pattern is
  deterministic by construction.
- **mask** — one velocity per sixteenth: `0` = rest, `0..1` = hit strength,
  `true` = 0.9. A mask shorter than `steps` **wraps** (a 16-slot mask over 32
  steps repeats each bar), so author only the variation you need. Stored
  manifests are normalized to full length — the manifest IS the grid.
- **notes** — optional per-step note contour, wraps like the mask. An entry is
  one note name OR an array — a chord (`[["F3","Ab3","C4","G4"]]` stabs Fm9 on
  every active step). Only the steps the mask activates sound, but every step
  carries a note, so editing the mask never lands on a note-less cell. Falls
  back to single `note`, then `'C3'`.
- **Instrument — exactly one of `patch | instrument | gesture | cue`:**
  - `patch` — a shelf patch name (`sawStab` is the detuned-saw garage/house
    stab with a swept filter); the base patch shelf is listed in the
    beats-ambient card.
  - `instrument` — a named shelf instrument (`clav`, `rhodes`, `muted-guitar`,
    `trumpet`, …) that expands to patch + color + feel. Reach here for the
    funk/soul kit (clav, rhodes, guitars) and the horn/string sections — the
    full shelf is far larger than the eight base patches and lives in the
    beats-instruments card.
  - `gesture` — one foley gesture object (`sweep | flutter | burst | thump`).
    The step's mask velocity scales the gesture's volume.
  - `cue` — a gesture list fired together (the three-burst clap above).
- **feel** — a track can carry a `feel` (preset name or params) to de-quantize
  the groove: strum chord stabs, add per-hit timing/velocity jitter. The
  anti-MIDI layer; see the beats-instruments card.
- **swing** — 0–0.5; odd sixteenths land late by `swing × sixteenth × 2/3`.
  0.3–0.4 is the UK garage pocket.
- **chain** — per-track effects as in beats-ambient. `delay`/`pingpong`
  `time` accepts a note fraction (`"3/16"` = dotted eighth) resolved against
  bpm, so the echo stays in the pocket at any tempo.

## Musical guidance

- Four-to-the-floor house: kick on every 4th sixteenth; UK garage 2-step:
  drop beat 3 and hit its "and" (see the bar-2 kick above). Claps/snares on
  beats 2 and 4 (steps 4 and 12 of each bar).
- Shuffled hats: offbeat eighths at full velocity plus ghost sixteenths at
  ~0.45, with swing ≥ 0.3.
- Keep basslines in one octave of a pentatonic/minor scale via `notes`; the
  contour-wraps behavior means an 8-note contour walks the whole loop.
- Use a `"3/16"` delay on stabs/plucks at 0.15–0.2 mix for the dub tail.
- A pattern makes a world soundtrack: `audio: { soundtrack: { beatsRef } }`
  loops it by construction.

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
