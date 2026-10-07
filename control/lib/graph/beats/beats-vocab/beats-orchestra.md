---
{ "id": "beats-orchestra", "name": "Orchestra: the score substrate and the orchestral shelf", "summary": "Orchestral writing in a beats-composition: meters and meter changes, a tempo map with rit./accel., motifs written once and placed by form (transposed, inverted, reversed), object events with dynamics, hairpins; woodwinds, harp, mallets, timpani, section size (players), depth (desk), seating presets and a4 tuning. Game field and battle scores have their own manual, beats-field-orchestra. Every sound is synthesized.", "when": "orchestral, a film score, a string ensemble, a symphonic cue, a waltz in 3/4, 6/8 or changing meters, a ritardando / accelerando / tempo ramp, a motif that recurs transposed, a crescendo or diminuendo hairpin, pp to ff dynamics, flute / clarinet / oboe / bassoon, woodwinds, harp, glockenspiel / xylophone / marimba / vibraphone / tubular bells / crotales, timpani with pedal glissando, a big string section vs a solo player, an orchestra seated left to right, orchestral tuning at 442" }
---

All of this is opt-in on `beats-composition`. A recipe that uses none of it
renders exactly as before.

## Meter and tempo

- **`meter`**: `'3/4'`, `'6/8'`, `'5/4'`, `'7/8'` … Addresses stay
  `'bar:beat:sixteenth'`. The beat is always a quarter note and `bpm` counts
  quarters; the meter only sets the bar length (3/4 and 6/8 = 3 quarters,
  7/8 = 3.5).
- **`meters: [{ at: bar, meter }]`** changes the meter from that bar on.
- **`tempo: [{ at, bpm, ramp? }]`** is a tempo map. A point with
  `ramp: 'linear' | 'exp'` arrives at its bpm by `at` (rit. or accel.). A point
  without `ramp` is a step. Delay note-fractions follow the base `bpm`.

## Phrases and form (write a motif once)

```json
"phrases": { "A": [["0:0:0", "E5", "0:1:0", 0.7], ["0:1:0", "G5", "0:1:0"]] },
"parts": [{ "name": "vn1", "instrument": "violin-2",
  "form": [{ "phrase": "A", "at": "4:0:0" },
           { "phrase": "A", "at": "8:0:0", "transpose": 5, "vel": 0.8 },
           { "phrase": "A", "at": "12:0:0", "invert": true, "retro": true }] }]
```

Phrase times are relative to the phrase. A part may have `form`, `events`, or
both. `invert` mirrors pitches about the phrase's first note. `retro` plays the
phrase backwards. A motif stated twelve times costs its events once.

## Events and dynamics

- An event is a tuple `[at, notes, dur?, vel?, art?]` or an object
  `{ at, n, d?, v?, art?, dyn? }`. `dyn` is `ppp … fff` and replaces `v`.
  `art` is an articulation (see `beats-articulations`).
- **`dynamics: [{ at, to, over?, from? }]`** on a part is a level lane: marks
  (`over` absent) and hairpins (`over` = the span). A note without its own `dyn`
  plays at the lane level × v/0.8. A note held through a hairpin swells with it.
- Instruments carry a playable `range`. A note outside it mints with a
  **warning**, never an error.

## The orchestral shelf

- Woodwinds: `flute`, `clarinet`, `oboe`, `bassoon`, and `-2` ensembles.
- `harp` is the tuned string.
- Mallets: `glockenspiel`, `xylophone`, `marimba`, `vibraphone` (motor
  tremolo), `tubular-bells`, `crotales`. `celesta` already existed.
- `timpani`: give its part `glide` and the pedal bends every mode.
- Strings and brass are the `-2` sections (`violin-2` … `tuba-2`).
- Orchestral percussion: `orchestral-perc` (see `beats-percussion`).

## Section, depth, seating, tuning

- **`players: n`** on a part is the section size: one voice per player (up to 8
  sound), de-locked onsets and vibrato.
- **`desk: 'front' | 'back'`** is depth. A back desk is darker, ~12 ms later and
  sends more to the room.
- **`seating: 'american' | 'european' | 'film'`** at manifest level fills `pan`
  and `desk` per family wherever a part sets neither. The first violin part
  sits as the firsts, the next as the seconds.
- Pair seating with a manifest `room` so depth has a space to sit in.
- **`a4`** is the reference pitch (440 default, 442 orchestral, 415 baroque).

## Worked example: the orchestra lab

About 44 bars at 96 bpm. Bars 0–11 audition one family at a time: a legato
violin line, pizz, tremolo, sfz and a trill; winds; horn swell into a mute;
trumpet marcato / staccato / fp; a timpani roll with `cresc`, then the pedal
glide; a harp gliss; mallets. Then a 32-bar tutti: `seating: 'american'`,
`a4: 442`, one `room`, motif A and its answer B placed by `form`, hairpins on
the firsts, and a four-bar `tempo` ramp from 96 to 66. The ears question:
does the tutti read as an orchestra, or as a synth string patch?

## Game scores for open country and battle

The style manual `beats-field-orchestra` covers writing a game's field,
travel and battle music for this orchestra.
