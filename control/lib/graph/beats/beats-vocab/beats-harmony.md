---
{ "id": "beats-harmony", "name": "Harmony: chord symbols, numerals, a chord chart, key changes", "summary": "Write harmony the way pop and rock are written: chord symbols ('Am7', 'F/G', 'E5'), Roman numerals in a key ('IV', 'bVII', 'V/V'), voicings (close, open, spread, power, guitar) with nearest voice leading, a composition-level chord chart that parts voice on a rhythm (chords, power chords, root bass, octave bass, arpeggios, a boom-chick or walking bass, the blues boogie, a banjo roll, the gypsy-jazz pompe, flamenco rasgueado, classical p-i-m-a, a pedal or an open-fifth drone held under the chart), battle and march harmony (the Phrygian bII, loop-seam cadences, modes ranked by tension), and `modulate` for the final-chorus key change. Stored compact, expanded at render.", "when": "a 12-bar blues, a walking bass, a boom-chick country bass, a walk-up, a boogie rhythm guitar, a banjo roll, the gypsy jazz pompe rhythm, flamenco rasgueado strums, a classical guitar arpeggio, a chord progression, a chord chart, play these chords, Am F C G, I V vi IV, the royal road progression, IV V iii vi, a minor-key i bVI bVII, a ii V i, voice leading, power chords, a strummed rhythm guitar part, a bass that follows the chords, octave bass, an arpeggio over the changes, a key change for the last chorus, modulate up a half step, transpose everything but the drums, a pedal point, a tonic pedal, a drone bass under moving chords, the Phrygian danger chord, bII, a battle theme that loops without resolving, a tactics or RPG battle, a march in a minor key, which mode for tension, a key change between sections, a drone, a bagpipe-like open fifth, a 6/8 lilt, pastoral or open-country harmony, Mixolydian" }
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
- **Roots modes** (each has its own default rhythm):
  - `root-fifth`: the country boom-chick bass, root then fifth (half notes).
    `walkup: true` turns the last hit before a new root into two quarters
    stepping into it through the key's scale (G, A, B into C).
  - `walk`: a walking bass in quarters. The root on each chord's first beat,
    a step or half step into the next root on its last, chord tones and scale
    steps between. Seeded per part: the same seed walks the same line. It
    stays between E1 and G3.
  - `boogie`: the blues rhythm-guitar dyads in 8ths: root with fifth, sixth,
    flat seventh, sixth. Put it under a `shuffle`.
  - `boogie-walk`: the boogie bass line in 8ths: root, third, fifth, sixth,
    flat seventh, sixth, fifth, third.
  - `roll`: a banjo forward roll in 8ths over the root, third, fifth and octave
    (`octave` moves it, default 3).
  - `pompe`: gypsy jazz rhythm guitar in quarters. A short low stroke on 1 and
    3 and a choked full chord on 2 and 4 (the accent). Guitar voicing.
  - `rasgueado`: the flamenco fan. Each hit is 3–5 fast strokes (`strokes`,
    default 4) with the last one held. Guitar voicing.
  - `pima`: classical arpeggio in 8ths. The thumb on the bass, then the
    fingers up the chord and back (p-i-m-a-m-i).
  - `pedal`: the KEY's tonic held in the bass whatever the chord above it
    does, re-struck on the rhythm (default `whole`; `hold: 1` ties it).
    `pedal-5` holds the key's fifth; `drone` holds both, the open fifth (the
    bagpipe's drones). All need `key` and follow `modulate`.
    Put the chords on another part: the upper chords move as inversions over
    a bass that never leaves home.
- **Other fields:**
  - `rhythm`: a name, or velocities per sixteenth that wrap. The names are
    `whole`, `half`, `quarter`, `8ths`, `16ths`, `offbeat`, `gallop`,
    `push`, `backbeat` (2 and 4: the country chick, the bluegrass chop),
    `dotted` (the dotted eighth and its sixteenth on every beat: the march and
    the fanfare), `dotted-quarter` (long-short on every half bar) and `lilt`
    (quarter-eighth, quarter-eighth: the 6/8 travelling figure; it is twelve
    sixteenths long, so use it in 6/8).
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
| the twelve-bar blues | I7 I7 I7 I7 · IV7 IV7 I7 I7 · V7 IV7 I7 V7 | the blues form; bars 11–12 are the turnaround |
| the quick-change twelve-bar | I7 IV7 I7 I7 · IV7 IV7 I7 I7 · V7 IV7 I7 V7 | the same, with a lift in bar 2 |
| the eight-bar blues | I7 V7 IV7 IV7 · I7 V7 I7 V7 | shorter, gospel-leaning |
| the minor blues | i7 i7 i7 i7 · iv7 iv7 i7 i7 · bVI7 V7 i7 V7 | dark and slow |
| the country three-chord | I I IV IV · V V I I (or I IV I V) | honky-tonk and bluegrass; the V7 turnaround home |
| the gypsy minor swing | i6 i6 iv6 iv6 · V7 V7 i6 i6 | minor 6ths and a dominant: the hot-club vamp |
| the Andalusian cadence | iv–bIII–bII–I (in a Phrygian key: Am G F E) | flamenco; the major I is the home chord |
| the Phrygian danger | i–bII–i | the threat chord: a half step above home. Battle and ambush |
| the tonic pedal | i–iv–bII–i over `pedal` | the bass never leaves home, so the loop never ends; strain without arrival |
| the open seam | …–bVII–i, …–bVI–bVII–i or …–bII–i | a battle loop's last bars: home without a V–i full stop, so the restart is not heard |
| the third shift | a section in i, the next a major third up (Cm → Em / G#m) | new energy without a new theme |
| the open road | I–bVII–IV–I (Mixolydian) over a `drone` | travelling, unhurried, never quite resolving: the world map |
| the quiet menu | I–IV–ii–bVII7 | a gentle Mixolydian colour, busy but calm (a save screen at ~89 bpm) |
| the plagal sway | I–IV–I or i–IV (Dorian) | rest without a full stop: open country, a village |
| the tonic flip | i–I–bVII–bVI–iv | the minor home flashes major: adventure with a shadow (a plains battle) |
| the Aeolian march | i–bVII–bVI–bVII | no leading tone, so it walks on forever: a column on the move |
| the victory flash | a minor loop, then I (major) on the last chord | a bright stinger after a dark battle |

## Battle and march harmony (principles)

From battle music written for long, looping fights on a tight voice budget:
- **Tension by mode**, darkest first: Locrian (rage) > Phrygian (danger) >
  Aeolian (struggle) > Dorian (noble ambiguity) > Lydian (heroic wonder).
  Pick the mode from the scene, then the progression from the mode.
- **A loop must not end.** Keep V–i out of the loop's last bars; land on
  bVII–i, bVI–bVII–i or bII–i, or hold a `pedal` under the turnaround.
- **Renew, don't repeat.** Move the next section a major third or a fifth
  (`modulate`), and change the meter with it (6/8 → 5/4, `meters`) before
  writing a new theme.
- **Long loops.** A battle theme that repeats for minutes wants 2.5–4 minutes
  of material before it loops, or a rotation of several themes.

Pair a chart with a groove (card `beats-grooves`) and the whole backing track
is a few lines. See `beats-composition` for style recipes by trait.
