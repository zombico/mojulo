---
{ "id": "beats-ambient", "name": "Ambient soundtrack (generative loop)", "summary": "A seeded generative music loop: tempo/key/swing, a chord progression, and channels of patch → effects chain. Endless non-repeating output from a tiny recipe; the world-presence primitive.", "when": "background music, an ambient soundtrack, a mood loop for a world or scene, lo-fi/chill generative music, 'give this world a hum', a music bed that never exactly repeats" }
---

## Shape

```json
{
  "kind": "beats-ambient",
  "title": "Night Circuit",
  "bpm": 84,
  "swing": 0.12,
  "seed": 20260704,
  "progression": [
    { "chord": ["D3","F3","A3","C4","E4"], "root": "D2" },
    { "chord": ["Bb2","D3","F3","A3"],     "root": "Bb1" },
    { "chord": ["F3","A3","C4","E4"],      "root": "F2" },
    { "chord": ["G2","Bb2","D3","F3"],     "root": "G1" }
  ],
  "channels": [
    { "name": "pads", "role": "harmony", "patch": "pad",
      "chain": [{ "type": "chorus" }, { "type": "reverb", "decay": 8, "wet": 0.55 }] },
    { "name": "bass", "role": "roots", "patch": "bassMono" },
    { "name": "arp",  "role": "melody", "patch": "sinePluck",
      "chain": [{ "type": "pingpong", "time": 0.5, "feedback": 0.35 }, { "type": "reverb", "decay": 6, "wet": 0.4 }],
      "sequence": { "table": ["D4","F4","G4","A4","C5","D5","F5","A5"], "gate": 0.7 } },
    { "name": "kick", "role": "pulse", "patch": "kick", "note": "C1",
      "steps": [1,0,0,0, 0,0,0,0.8, 0,0,0.9,0, 0,0,0,0] },
    { "name": "hats", "role": "pulse", "patch": "hat", "note": "C5", "dropout": 0.15,
      "steps": [0,0.5,0.9,0.4, 0,0.6,0.9,0.4, 0,0.5,0.9,0.4, 0,0.6,0.9,0.5] }
  ]
}
```

## Semantics

- **seed is required and is the whole determinism story**: same recipe + same
  seed replays the identical performance; change the seed to re-roll the dice.
  Every bar reseeds from hash(seed, barIndex), so playback is order-independent.
- **progression** cycles one entry per bar (4/4). Note names are `"A4"` /
  `"Bb1"` / `"F#3"`.
- **channel roles** decide the note derivation:
  - `harmony` — the bar's chord, sustained the whole bar.
  - `roots` — the bar's root: a long note on beat 1, a short echo at `0:2:2`.
  - `melody` — a seeded random walk over `sequence.table`, eighth notes;
    `sequence.gate` (default 0.7) is the play probability — lower = sparser.
  - `pulse` — a 16-slot velocity array (`steps`, 0 = rest, or a 0–1 velocity);
    `note` picks the pitch (kick wants `"C1"`); optional `dropout` humanizes.
- **patch** (see audio-patches.js): `pad`, `bassMono`, `sinePluck`, `chipLead`,
  `fmBell`, `kick`, `hat`, `burstSoft`. Omit to get the role's default.
- **instrument** (B6, instead of `patch`): a channel can name a shelf
  instrument — `piano`, `rhodes`, `acoustic-guitar`, `violin`/`cello`,
  `trumpet`, … — and gets its whole patch + color chain + feel stack; explicit
  channel fields override. This is how the orchestra joins a world soundtrack:
  e.g. `{ "name": "keys", "role": "harmony", "instrument": "piano" }` plays the
  progression as softly rolled piano chords. See the beats-instruments card.
- **chain** effects per channel: `filter` { mode, freq, q } · `delay` /
  `pingpong` { time, feedback, mix } · `chorus` { rate, depth, mix } ·
  `reverb` { decay, wet — impulse is computed from the seed, never sampled }.

## Musical guidance

Slow attack pads + a probability-gated pentatonic melody + sparse drums is the
proven ambient shape. Keep bpm 70–95 for presence beds. For darker moods drop
the progression into minor roots and lower `gate` toward 0.4. A world can carry
one of these inline or by ref: `manifest.audio = { soundtrack: { beatsRef } }`.

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
