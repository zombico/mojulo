---
{ "id": "beats-soloist", "name": "The soloist: a seeded solo over the chord chart", "summary": "A pitched part in a beats-composition takes `solo` instead of events: a style (blues, country, virtuoso-rock, classical, flamenco, gypsy-jazz) plays a seeded solo over the chart with that style's scales, licks and articulations. It lands chord tones on strong beats, breathes between licks, repeats an idea with a variation, climbs with the arc and ends home with vibrato. The same seed is the same solo. Stored compact, expanded at render.", "when": "a guitar solo, a blues solo over a 12-bar, a country lead break, a shred solo, an instrumental guitar piece, legato runs and tapping, sweep arpeggios, a whammy dive, a classical guitar study, a tremolo melody, flamenco picado runs, a gypsy jazz solo, a fiddle break, a harmonica solo, two instruments trading fours, call and response, improvise over these chords" }
---

Writing a solo note by note is the one part of a song that stays long when
everything else is compact. A pitched part takes `solo` instead, and plays
over the composition's chord chart (`key` + `progression`, card
`beats-harmony`).

## Shape

```json
{ "key": "A", "progression": [{ "chords": "I7 I7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7", "repeat": 3 }],
  "shuffle": 1,
  "parts": [
    { "name": "lead", "instrument": "lead-guitar", "solo": { "style": "blues", "bars": [12, 36] } },
    { "name": "bass", "instrument": "picked-bass", "chordVoice": "walk" }
  ] }
```

- `style` (required): `blues`, `country`, `virtuoso-rock`, `classical`,
  `flamenco` or `gypsy-jazz`.
- `bars`: `[from, to)`, or a count from bar 0.
- `scale`: `auto` (the style's choice) or one of `minor-pent`, `major-pent`,
  `blues`, `major`, `mixolydian`, `dorian`, `aeolian`, `lydian`, `phrygian`,
  `phrygian-dominant`, `harmonic-minor`, `melodic-minor`, `diminished`,
  `whole-tone`. The scale sits on the key's tonic.
- `arc`: `build` (the default: sparse and low, then denser and higher, a peak
  in the last quarter), `flat`, `call` or `response` (two bars on, two off;
  give one part `call` and another `response` to trade).
- `density` (0–1), `seed` (another seed, another solo), `register`
  (`['G3', 'A5']`), `licks` (narrow the vocabulary to a list).
- Written `events` on the same part win their bar from their first onset, so a
  hand-written phrase replaces the generated one there.
- `get_beats({ ref, expand: true })` shows every generated note.

## The styles

| style | scale (auto) | what it plays |
|---|---|---|
| `blues` | blues | bends to the 5th, the b3 → 3 curl, pedal licks, descending runs to the root, double stops, held notes with wide vibrato |
| `country` | major pentatonic | chicken-pickin' snaps (palm-muted and open), steel-style bends under a held note, runs sliding in, sixths |
| `virtuoso-rock` | aeolian in a minor key, lydian in a major | legato runs (3 notes a string, hammer and pull), tapped arpeggios, sweeps, octave climbs, whammy dives and flutters, pinch and natural harmonics, slow wide vibrato |
| `classical` | harmonic minor / major | rest-stroke melody, scale runs, broken-chord figures, the tremolo (a bass note then three repeats), campanella; metrical, no bends |
| `flamenco` | phrygian dominant | picado runs in sextuplets, the fall to the cadence, rest-stroke melody with slides |
| `gypsy-jazz` | harmonic minor / major | arpeggios with a chromatic approach from below, diminished runs, chromatic runs, rakes into a note with a fast narrow vibrato |

Flamenco writes its chart in the Phrygian spelling: `key: 'E'` and
`iv bIII bII I` is Am G F E, with the major I as home. Gypsy jazz swings: put
`shuffle: 0.6` on the composition and the solo's eighths swing with the band.

## Other instruments

A fiddle (`violin-2`), an organ or a lead synth plays the same solo with what
it can do: hammer-ons and pull-offs glide (legato), and the pluck-only
articulations (palm mute, harmonics, taps, rakes) drop out. Licks that need a
plucked string are skipped.

## The phrasing rules

- Strong beats land on chord tones; a bent note and a chromatic approach are
  allowed to pass.
- A rest after each lick, shorter as the solo heats up.
- Sometimes the last lick again, a step up or down (the ear's anchor).
- The ending is home (the key's root or third) held with vibrato. When the
  chord under it is not the tonic (a twelve-bar's turnaround V), it lands on
  that chord's root or third instead and leads home.
