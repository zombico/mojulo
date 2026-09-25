---
{ "id": "beats-grooves", "name": "Grooves and fills: whole drum parts in one line", "summary": "A drum-kit part in a beats-composition takes `groove` instead of events: a named style (eight-beat, sixteen-beat, four-floor, half-time, trance-drive, rock-drive, double-time-chorus, blast) over a bar range, with seeded fills (tom run, snare 16ths, flam build, 32nd roll, kick-snare unison) every 2/4/8 bars or before each section, and a crash on section downbeats. One entry per section. Written events override a bar from their first hit. Stored compact, expanded at render.", "when": "a rock beat for the whole song, drums with fills, a tom fill into the chorus, a crash on the downbeat, a driving 8-beat, a 16-beat groove, four on the floor, a half-time breakdown, a double-time chorus, a trance kick with offbeat hats, a blast beat, write 90 bars of drums, an anime rock drum part, a drummer that plays the sections" }
---

Writing ninety bars of drums as literal events is huge and tedious. A kit part
takes a `groove` instead, and its hits are generated when it plays, with GM
drum notes (C2 kick, D2 snare, F#2 hat, A#2 open hat, C#3 crash, D#3 ride,
C3/A2/F2 toms).

## Shape

```json
{ "name": "drums", "instrument": "stadium-kit", "feel": "rock-drummer",
  "groove": [
    { "style": "rock-drive", "bars": [0, 16], "fills": "every-4", "crash": "section" },
    { "style": "half-time", "bars": [16, 24], "fills": "section" },
    { "style": "double-time-chorus", "bars": [24, 40], "fills": "every-8", "crash": "both" }
  ],
  "events": [["39:2:0", "D2", "0:0:1", 1], ["39:3:0", ["C2", "C#3"], "0:0:1", 1]] }
```

- One entry per section. The entry's start is the section downbeat.
- `bars`: `[from, to)`, or a count from bar 0.
- `fills`: `every-2`, `every-4`, `every-8`, `section` (the bar before the next
  section) or `none` (the default).
  - The fill kind is a seeded choice per bar: the same `seed` plays the same
    fills, and a different `seed` on the entry plays others.
  - `fill: 'tom-run'` pins one kind.
- `crash`: `section` (a crash plus kick on the section's downbeat), `fills`
  (after each fill), `both` or `none`.
- `vel` scales the whole entry; `seed` re-rolls its fills.
- Written `events` on the same part win their bar from their first hit on, so
  a hand-written fill replaces the generated one there. Earlier hits in that
  bar stay.
- A kit that lacks a piece falls back: ride to closed hat, crash to open hat,
  extra toms to the nearest one.
- The meter map is respected: a 3/4 bar is twelve sixteenths, and a fill ends
  the bar.

## Styles

| style | the pattern |
|---|---|
| `eight-beat` | hats on 8ths, kick on 1 and 3 (plus the "and" of 3), snare on 2 and 4 |
| `sixteen-beat` | 16th hats with accents, a syncopated kick, ghost snares |
| `rock-drive` | kick on 1, the "and" of 2 and 3; an open-hat lift on the "and" of 4. The anime-rock verse |
| `double-time-chorus` | kick on every beat, snare on every offbeat, ride 8ths. The chorus that runs |
| `half-time` | snare on 3 only. The breakdown and the ballad bridge |
| `four-floor` | kick on every beat, clap on 2 and 4, open hats on the offbeats |
| `trance-drive` | four-floor plus soft 16th hats. The trance-pop engine |
| `blast` | kick and snare alternating 16ths under 8th rides. The heavy variant's burst |

## Fills

`tom-run` (toms falling over the last two beats into a kick), `snare-16ths`
(a crescendo over the last beat), `flam-build` (flammed 8ths building),
`roll-32` (a 32nd-note roll with a crescendo), `unison-8ths` (kick and snare
together).

## Pairs well with

- The `rock-drummer` feel: kick and snare laid back, hats accented, toms
  flammed.
- `stadium-kit` for arena rock, `drum-kit-90s-rock` for the tight 90s sound
  on a plate, and `drum-machine-909` for trance and house.
- A chord chart (card `beats-harmony`) for the rest of the band.
- `get_beats({ ref, expand: true })` shows every generated hit. To change one
  bar, write events there rather than expanding the whole part.
