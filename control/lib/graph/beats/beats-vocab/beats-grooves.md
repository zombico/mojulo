---
{ "id": "beats-grooves", "name": "Grooves and fills: whole drum parts in one line", "summary": "A drum-kit part in a beats-composition takes `groove` instead of events: a named style (eight-beat, sixteen-beat, four-floor, half-time, trance-drive, rock-drive, double-time-chorus, blast, shuffle, shuffle-boogie, train, two-beat, slow-twelve-eight) over a bar range, with seeded fills (tom run, snare 16ths, flam build, 32nd roll, kick-snare unison, triplet) every 2/4/8 bars or before each section, and a crash on section downbeats. One entry per section. Written events override a bar from their first hit. Stored compact, expanded at render.", "when": "a rock beat for the whole song, drums with fills, a tom fill into the chorus, a crash on the downbeat, a driving 8-beat, a 16-beat groove, four on the floor, a half-time breakdown, a double-time chorus, a trance kick with offbeat hats, a blast beat, write 90 bars of drums, an anime rock drum part, a drummer that plays the sections, a blues shuffle, a Texas shuffle, a swing feel, triplet feel, a country train beat, brushes, a two-beat country groove, a slow blues in 12/8, a triplet fill" }
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
- `vel` scales the whole entry; `seed` re-rolls its fills; `shuffle` (0..1)
  swings this entry alone.
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
| `shuffle` | the blues shuffle: swung 8th hats, kick on 1 and 3, backbeat. Swings on its own (a full triplet) |
| `shuffle-boogie` | the driving shuffle: kick on every beat, ghosted offbeat snares. Swings on its own |
| `train` | the country train beat: snare (brushes) on every 16th, accents on 2 and 4, kick on 1 and 3 |
| `two-beat` | the country two-beat: kick on 1 and 3, cross-stick on 2 and 4, light hats. Pairs with a root-fifth bass |
| `slow-twelve-eight` | the slow blues: needs `meter: '12/8'`; ride on all twelve eighths, backbeat on the 2nd and 4th dotted beats |

## The shuffle

A composition's `shuffle` (0..1) moves every offbeat EIGHTH toward the
triplet: 1 puts it at 2/3 of the beat (the full shuffle), about 0.6 is a lazy
swing. It warps written events, chart parts, phrases and grooves alike, and a
held note's end moves with it, so the long-short pair still connects.
- A part's `shuffle` overrides it; `shuffle: false` plays that part straight
  (a straight organ over a shuffle).
- The `shuffle` and `shuffle-boogie` grooves swing a full triplet even when the
  composition sets none.
- `swing` is a different, older knob: it nudges offbeat SIXTEENTHS. Use
  `shuffle` for the blues, country swing and gypsy jazz.
- 12/8 needs no shuffle: its eighths are already the triplets.

## Fills

`tom-run` (toms falling over the last two beats into a kick), `snare-16ths`
(a crescendo over the last beat), `flam-build` (flammed 8ths building),
`roll-32` (a 32nd-note roll with a crescendo), `unison-8ths` (kick and snare
together), `triplet` (triplets over the last two beats, snare into toms; the
shuffle family's fill). The shuffle grooves pick from triplet, tom run and snare
16ths; the 12/8 groove from unison 8ths, tom run and snare 16ths; the straight
grooves from the first five.

## Pairs well with

- The `rock-drummer` feel: kick and snare laid back, hats accented, toms
  flammed.
- `acoustic-kit` for the train and the two-beat.
- `stadium-kit` for arena rock, `drum-kit-90s-rock` for the tight 90s sound
  on a plate, and `drum-machine-909` for trance and house.
- A chord chart (card `beats-harmony`) for the rest of the band.
- `get_beats({ ref, expand: true })` shows every generated hit. To change one
  bar, write events there rather than expanding the whole part.
