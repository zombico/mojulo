---
{ "id": "beats-harmony", "name": "Harmony: chord symbols, numerals, a chord chart, key changes", "summary": "Write harmony the way pop and rock are written: chord symbols ('Am7', 'F/G', 'E5'), Roman numerals in a key ('IV', 'bVII', 'V/V'), voicings (close, open, spread, power, guitar) with nearest voice leading, a composition-level chord chart that parts voice on a rhythm (chords, power chords, root bass, octave bass, arpeggios), and `modulate` for the final-chorus key change. Stored compact, expanded at render.", "when": "a chord progression, a chord chart, play these chords, Am F C G, I V vi IV, the royal road progression, IV V iii vi, a minor-key i bVI bVII, a ii V i, voice leading, power chords, a strummed rhythm guitar part, a bass that follows the chords, octave bass, an arpeggio over the changes, a key change for the last chorus, modulate up a half step, transpose everything but the drums" }
---

Harmony in a `beats-composition` is written as chords, not note lists. Every
field here is compact: the stored recipe keeps what you wrote, and it is
expanded to literal notes when it plays or exports (`get_beats` shows the
compact form; `get_beats({ ref, expand: true })` returns the expanded one).

## Chord symbols

An object event takes `chord` instead of `n`:
`{ at: '0:0:0', chord: 'Am7', d: '1:0:0', v: 0.7, voicing?: 'open', octave?: 3 }`.

- Root `A`–`G` with `#`/`b`, then a quality: `m`, `7`, `maj7`, `m7`, `dim`,
  `dim7`, `m7b5`, `aug`, `sus2`, `sus4`, `7sus4`, `6`, `m6`, `9`, `maj9`, `m9`,
  `add9`, `madd9`, `11`, `13`, `7b9`, `7#9`, and `5` (a power chord).
- A slash bass: `'F/G'`, `'C/E'`.
- `E5` as a chord is a power chord. `n: 'E5'` is still the note E5, so the
  two never collide.

## Roman numerals

Set the recipe's `key` (`'E'`, `'F#m'`, `'Bb'`), then write numerals anywhere
a chord symbol goes.

- Upper case is a major triad, lower case is minor. `°` is diminished, `ø`
  half-diminished, `+` augmented.
- Extensions: `7` (on an upper numeral, the dominant 7th), `maj7`, `9`, `6`,
  `add9`, `sus4`, `sus2`, `5`.
- A secondary: `'V/V'`, `'V7/vi'`.
- Degrees count from the tonic's major scale. In a minor key write `i`,
  `bIII`, `iv`, `v`, `bVI`, `bVII`.

## Voicings

| voicing | what it plays (Am7) |
|---|---|
| `close` (default) | root position within an octave: A3 C4 E4 G4 |
| `open` | root, fifth, the rest an octave up: A3 E4 C5 G5 |
| `spread` | root and fifth an octave down, the rest above: A2 E3 C4 G4 |
| `power` | root, fifth, octave (the third dropped) |
| `guitar` | a barre shape on the low strings |

`octave` sets where the root sits. On a part, `lead: true` voice-leads each
chord from the last one, taking the inversion that moves the voices least.

## The chart: `progression` + chart parts

A composition-level `progression` is the song's chord chart. By default each
chord lasts one bar.

```json
"key": "E",
"progression": [
  { "chords": "I V vi IV", "repeat": 2 },
  { "chords": "IV V iii vi", "bars": 1 },
  ["IV", 2], ["V", 2]
]
```

Each entry is one of:
- a chord (one bar)
- `[chord, bars]`
- `{ chords: 'a b c' | [...], bars?: per chord, repeat?, at?: bar }` (an `at`
  jumps the cursor)

A part with `chordVoice` plays the chart:
- **Modes:**
  - `chord` / `strum` / `block`: the voicing. The part's feel strums it.
  - `power`: power chords.
  - `upper`: the voicing without its root.
  - `root`: the root, or the slash bass.
  - `octaves`: the root alternating with its octave. This is the driving
    picked bass.
  - `arp`: one voicing note per hit (`arp: 'up' | 'down' | 'updown'`).
- **Other fields:**
  - `rhythm`: a name, or velocities per sixteenth that wrap. The names are
    `whole`, `half`, `quarter`, `8ths`, `16ths`, `offbeat`, `gallop` and
    `push`.
  - `hold`: how much of the gap to the next hit a hit holds (default 0.92).
    A row `gate` is still the trance gate, and `duck` still pumps.
  - `art`: an articulation on every hit (`'pm'` chugs, `'staccato'` stabs).
  - `vel`: scales velocity.
  - `voicing`, `octave` and `lead`, as above.
  - `bars: [from, to]` or `[[0, 8], [16, 32]]`: where the part plays.
- Explicit `events` on the same part play too.

```json
{ "name": "rhythm", "instrument": "rock-guitar", "chordVoice": "power", "rhythm": "8ths", "bars": [8, 40] },
{ "name": "bass", "instrument": "picked-bass", "chordVoice": "octaves", "rhythm": "8ths", "octave": 1 },
{ "name": "keys", "instrument": "grand-piano", "chordVoice": "chord", "voicing": "open", "lead": true, "rhythm": "half" }
```

A `beats-pattern` chord dictionary takes symbols and numerals too:
`"key": "Am", "chords": { "a": "i", "b": "bVI", "c": "bVII" }`. The optional
manifest `voicing` and `octave` apply to it.

## Key change: `modulate`

`modulate: [{ at: '64:0:0', semitones: 1 }]` transposes every pitched part
from `at` on. Entries add up.
- Kits, cue parts and a part with `modulate: false` keep their notes.
- A `form` entry moves by where it starts.
- The genre's final-chorus lift is up a half step (1) or a whole step (2),
  often after a bar of silence or a drum fill.

## Progression vocabulary (by trait)

| progression | numerals | the feel |
|---|---|---|
| the royal road | IV–V–iii–vi | bittersweet lift. It never lands on I, so it keeps pulling forward (the anime and J-pop chorus workhorse) |
| royal road, resolved | IV–V–iii–vi–ii–V–I | the same pull, with an ending |
| the four-chord loop | I–V–vi–IV | the stadium singalong |
| the sad four | vi–IV–I–V | the same loop starting on the minor chord |
| the doo-wop turn | I–vi–IV–V | 50s innocence |
| the falling-bass cycle | I–V–vi–iii–IV–I–IV–V | stately; the bass walks down step by step |
| the minor epic | i–bVI–bVII–i | trance anthems and the heavier variant: dark, then heroic |
| the minor rise | i–bVI–bIII–bVII | the cinematic climb |
| anime minor ii–V–i | iiø7–V7–i | tense and resolving; the minor-key verse |
| the Andalusian descent | i–bVII–bVI–V | a flamenco-tinged fall onto a major V |
| the Dorian vamp | i–IV | a hypnotic two-chord groove |
| the pre-chorus climb | IV–V–IV–V or ii–iii–IV–V | builds; lands on the chorus |
| the push | IV–V/V–V | a secondary dominant that shoves into the chorus |

Pair a chart with a groove (card `beats-grooves`) and the whole backing track
is a few lines. See `beats-composition` for style recipes by trait.
