---
{ "id": "beats-articulations", "name": "Articulations", "summary": "Per-note articulations on a beats-composition event (art): legato runs without retrigger, staccato, tenuto, marcato/sfz/fp/swell shapes, pizz, col legno, tremolo and rolls, trills, portamento, glissando (a slide, or a harp run), con sordino, flutter-tongue. Each lowers to note overrides or scheduled notes, seeded and deterministic.", "when": "string ensemble with pizzicato, legato phrasing, staccato notes, accents, sforzando, fortepiano, a swell on a held note, tremolo strings, a drum roll or timpani roll, a trill, a glissando or harp gliss, portamento between notes, muted brass or strings con sordino, flutter-tongue flute, col legno" }
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
