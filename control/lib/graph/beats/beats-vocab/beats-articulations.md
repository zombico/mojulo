---
{ "id": "beats-articulations", "name": "Articulations", "summary": "Per-note articulations on a beats-composition event (art): legato runs without retrigger, staccato, tenuto, marcato/sfz/fp/swell shapes, pizz, col legno, tremolo and rolls, trills, portamento, glissando (a slide, or a harp run), con sordino, flutter-tongue; and for guitars and leads: bends (with release, pre-bends), slides, a whammy dive, per-note vibrato, palm mute, the pinch harmonic, a slap pop. Each lowers to note overrides or scheduled notes, seeded and deterministic; hammer-ons and pull-offs, taps, natural harmonics, rakes and the rest stroke.", "when": "string ensemble with pizzicato, legato phrasing, staccato notes, accents, sforzando, fortepiano, a swell on a held note, tremolo strings, a drum roll or timpani roll, a trill, a glissando or harp gliss, portamento between notes, muted brass or strings con sordino, flutter-tongue flute, col legno, a guitar bend, bend and release, a pre-bend, guitar vibrato, a slide into a note, a whammy bar dive, palm-muted chugs, a pinch harmonic squeal, a slap bass pop, a guitar solo that sounds played" }
---

Put `art` on an event: the tuple's 5th slot (`["0:0:0", "A4", "0:1:0", 0.7,
"pizz"]`) or an object event (`{ "at": 0, "n": "A4", "d": 1, "art": "legato" }`).
`art` is a name, or `{ type, …params }`.

| art | what it does |
|---|---|
| `legato` | Consecutive single-note legato events become ONE note whose pitch moves (60 ms, or the part's `glide`). There is no retrigger and no envelope dip. |
| `staccato` / `staccatissimo` | The note is cut to 45 % / 25 % of its length, with a short release. |
| `tenuto` | Held to the next onset, leaning in a little. |
| `marcato` / `accent`, `sfz`, `fp`, `swell` | A per-note gain shape: an attack boost that falls back, forte-then-piano, or a swell up and down. |
| `pizz` | A plucked, tuned string with a short ring (T60 well under 0.6 s). Any bowed part. |
| `col-legno` | A short wooden knock and tick. |
| `trem` | Bowed tremolo: seeded retriggers (~14/s, `rate`), or `{ type: 'trem', mode: 'lfo' }` for an amplitude tremolo. |
| `roll` | Retriggers ~18/s (`rate`). `cresc: 2` swells from the first stroke to the last: a snare or timpani roll. |
| `trill` | Alternates with the upper neighbour. `interval` (default 2 semitones), `rate` notes per second (default 12). |
| `port` | Slides in from the previous note (`time`, default 0.12 s). |
| `gliss` | A plucked or struck part (harp, piano, guitar, mallets) runs the scale to the next note or `to`. `scale` gives pitch classes; the default is major. Other parts slide. |
| `mute` | Con sordino. Strings get darker and softer. Brass gets nasal (a 1.6 kHz peak, thinned lows). |
| `flutter-tongue` | A ~24 Hz amplitude buzz plus breath. |

An articulation's gain shape replaces a hairpin's on that note. Retriggers and
jitter are seeded, so the same recipe plays the same roll every time.

```json
{ "name": "vc", "instrument": "cello-2", "players": 5, "events": [
  { "at": "0:0:0", "n": "C3", "d": "1:0:0", "art": "trem" },
  { "at": "1:0:0", "n": "G2", "d": "0:2:0", "art": "sfz" },
  { "at": "2:0:0", "n": "E3", "d": "0:1:0", "art": "pizz" },
  { "at": "3:0:0", "n": "D3", "d": "1:0:0", "art": { "type": "trill", "interval": 1 } } ] }
```

## Guitar and lead (anthem styles)

These work on the string voice (every guitar and bass) and on osc and supersaw
leads. Times are seconds from the onset, and pitch moves are in semitones.

| art | what it does |
|---|---|
| `{ type: 'bend', to: 2, at, over, release?, pre? }` | Bends up `to` semitones from `at` over `over` (defaults: 2, 0.06 s, 0.12 s). `release: true` or `{ at, over }` comes back down. `pre: true` starts bent and releases. |
| `{ type: 'slide', in: -3, out?: -12, over? }` | Slides in from `in` semitones, and/or away to `out` at the end. |
| `{ type: 'dive', to: -24, at?, over? }` | A whammy-bar dive. |
| `{ type: 'vib', depth: 35, rate?, delay? }` | Per-note vibrato in cents: wider than a patch LFO, and it can wait for the note. |
| `pm` | Palm mute: a short, dark string (it rings under 0.25 s). A chart part's `art: 'pm'` chugs every hit. |
| `{ type: 'harm', k? }` | The pinch harmonic. The string sounds its k-th partial (a seeded 3–5 by default) over a whisper of the note, and squeals through an amp. |
| `pop` | The slap pop: no pick smoothing and a bright snap (with `slap-bass`). |
| `hammer` / `pull` | A hammer-on or pull-off: no new pick. The note before sounds on and steps to this pitch; chain them for legato runs (3 notes a string: pick, hammer, hammer). Single notes only. |
| `tap` | A tapped note: struck by a fingertip, bright, with no pick click. Pair with `pull` for tapped arpeggios. |
| `{ type: 'nat', k? }` | A natural harmonic: the string's k-th partial alone, bell-like (k 2 = the 12th fret, 3 = the 7th, 4 = the 5th; default 2). Write the string's note; it sounds k times higher. |
| `{ type: 'rake', n? }` | 1–4 muted grace notes (default 2) raked into the note from the strings below, a sixteenth of a beat apart. |
| `rest` | The rest stroke: the classical and flamenco melody stroke, louder and held to the next note. |

Any of `bend`, `slide`, `dive`, `harm`, `pm`, `pop` and `rake` can also carry `vib`
(a depth, or `{ depth, rate, delay }`): the vibrato at the top of a bend.

A part's `power: true` turns every single note into root + fifth + octave, its
phrases included. Legato runs on a supersaw or pulse lead glide (portamento).

```json
{ "name": "solo", "instrument": "rock-lead", "events": [
  ["28:0:0", "F#5", "0:1:2", 0.95, { "type": "bend", "to": 2, "vib": { "depth": 35, "delay": 0.25 } }],
  ["28:3:0", "G#5", "0:1:0", 0.9, { "type": "harm", "k": 3 }],
  ["30:0:0", "C#6", "0:2:0", 0.95, { "type": "bend", "to": 2, "release": { "at": 0.6, "over": 0.15 } }],
  ["31:0:0", "E5", "0:1:0", 0.9, { "type": "slide", "in": -2 }] ] }
```
