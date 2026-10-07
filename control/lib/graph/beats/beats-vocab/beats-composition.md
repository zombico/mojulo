---
{ "id": "beats-composition", "name": "Composition (explicit score)", "summary": "A literal note-event score: parts with [time, notes, dur, vel] events against one transport. Deterministic by construction — no dice. The MIDI-shaped middle layer between vibe recipe and sound design.", "when": "compose a melody/theme/jingle, write a specific tune, transcribe a musical idea note by note, a fanfare or sting with exact notes, a piece with a beginning and an end, a stereo mix with panning and one shared reverb room, a master limiter, a loudness-normalized / -14 LUFS / 24-bit export, a whole song in a few lines, a chord chart with a groove, an anime opening theme, energetic J-pop, J-rock, shonen rock, eurobeat, trance pop, nu-metal electronic, a power ballad bridge, classic country, honky-tonk, bluegrass, a blues shuffle, a 12-bar blues, a slow blues, a guitar instrumental, classical guitar, flamenco, gypsy jazz" }
---

## Shape

```json
{
  "kind": "beats-composition",
  "title": "Door Fanfare",
  "bpm": 120,
  "swing": 0,
  "loop": false,
  "parts": [
    { "name": "lead", "patch": "fmBell",
      "chain": [{ "type": "reverb", "decay": 4, "wet": 0.35 }],
      "events": [
        ["0:0:0", "C4", "0:0:2", 0.8],
        ["0:0:2", "E4", "0:0:2", 0.8],
        ["0:1:0", "G4", "0:1:0", 0.9],
        ["0:2:0", ["C5","E5","G5"], "0:2:0", 1.0]
      ] },
    { "name": "bass", "patch": "bassMono",
      "events": [["0:0:0", "C2", "1:0:0", 0.9]] }
  ]
}
```

## Semantics

- **events** are `[time, notes, dur?, vel?]` — time and dur in
  `"bar:beat:sixteenth"` (4/4) or a bare number of beats. `notes` is one note
  name or an array (a chord). `vel` is 0–1 (default 0.8).
- **loop: true** restarts the score at its end; default plays once and stops.
- **patch / chain** as in beats-ambient (see that card).
- No seed: a composition has no dice — the same score plays identically every
  time by construction.

## Musical guidance

Compositions are where the agent's music theory does the work: voice-lead the
chords, resolve to the tonic, put the bass on roots and fifths. For a jingle,
2–4 bars is plenty; end on beat 1 of a new bar for a clean button. Melodies sit
well an octave-plus above the bass. `fmBell` and `chipLead` carry melody;
`pad` chords underneath want long durations, not restrikes.

For anything meant to sound *played*, prefer a named `instrument` on the part
over a raw patch (see the beats-instruments card). For new work, lead with the
fidelity names:
- `grand-piano` is the workhorse: melody, accompaniment and bass from one
  instrument, in tune at every register, with velocity as the expressive axis
  (harder = brighter).
- Sections compose: `grand-piano` + `violin-2`/`viola-2`/`cello-2`/
  `contrabass-2` + `trumpet-2`/`trombone-2` make an orchestra, and
  `drum-kit` gives it a kit.
- Give each part its own register and a `pan`, put the band in one `room` with
  per-part `send`, and let the `ensemble`/`keys` feels de-quantize the attacks.
- `piano`, `violin`, `trumpet` … are legacy names kept for existing recipes.
- A string piano can't tie across bars, so re-strike long melody notes softer.

## Multi-section arrangements

One score can hold a whole song section — verse → pre-chorus → chorus. Events
for bar N sit at `"N:beat:sixteenth"`, so a 10-bar arrangement is events spread
across bars 0–9 with `loop: true` to cycle the section. Four patterns carry it
(an Em-verse → G-chorus soft-rock section is the reference case):

- **Sections are parts + silence, not a section object.** To make a voice
  *enter* at the chorus, give it a part whose earliest event is the chorus
  downbeat — an always-present part that is simply silent until then. A part
  that changes role (melody in the verse, arpeggio in the chorus) is one part
  whose event character shifts at the bar boundary.
- **Lift by key, not just melody.** Modulate the chorus up into the relative
  major (E-minor verse → G-major chorus): re-voice the chord parts and bass
  roots into the new key at the section's first bar. The brightness is
  harmonic; a pre-chorus `bVI → bVII` (C → D into G) is the launch ramp.
- **Build and turn with fills.** A pre-chorus snare crescendo (four rising
  sixteenths on beat 4) pushes into the chorus; a turnaround fill closes the
  loop.
- **Toms.** The `drum-kit` instrument has real toms (`F2`/`A2`/`C3`). Older
  scores pitch the `kick` membrane instead: higher note names (`"A2"`, `"F2"`,
  `"D2"`) read as descending toms.

At this scale (hundreds of events across 6–8 voices) author the score with a
small generator, not by hand — restating every bar's groove literally is what
the pattern kind exists to avoid, so reserve composition for when the section
structure or the lead line genuinely needs explicit control.

## Songs in a few lines (anthem styles)

A whole arrangement is compact when it is written the way bands write:
- a chord chart (`key` + `progression`) that parts voice on a rhythm (card
  `beats-harmony`)
- a `groove` per drum part with seeded fills (card `beats-grooves`)
- motifs as `phrases` placed by `form`
- cue parts for the transitions (`cue: [{ type: 'riser', bars: 4 }]`, card
  `beats-sfx`)
- `sweeps` for filter builds, `modulate` for the last chorus, and a `band`
  template for the mix (card `beats-effects`)

The recipe stays compact when stored. `get_beats({ ref, expand: true })` shows
the literal events.

- **`band`** (`anime-rock`, `trance-pop`, `country`, `blues`, `soloist`,
  `nylon`, `orchestra-battle`, `orchestra-processional`, `orchestra-pastoral`, `orchestra-field`) fills pan, send and
  `trim` per role (drums, bass, rhythm, lead, keys, brass, strings, woodwind,
  timpani, synth, pad, vocal, hit, fx) where a part sets none.
  - It adds a room (a plate or a room2) if there is none.
  - It double-tracks the rhythm guitars: a `~double` twin, mirrored and 12 ms
    late. `double: false` opts a part out, and `double: { offset, pan }` works
    on any pitched part.

The recipe book (or your cookbook) may carry whole songs in these styles:
`semantic_search({ kinds: ['beats_vocab'], query })` finds them, and the card's
`recipe` is `{ kind, params }` to pass to `create_beats` and then revise.

Style recipes by trait:
- **Energy trance-pop** (2000s): 140–160 bpm, four-floor / `trance-drive`.
  - The minor epic chart (`i bVI bIII bVII`).
  - Offbeat octave bass (`chordVoice: 'octaves'`, rhythm `[0, 0, 0.95, 0.7]`).
  - Supersaw chords gated in 16ths (`gate`) and ducking to a kick-only part
    (`groove.only: ['kick']`).
  - 16th arps, a portamento lead answering a sung hook, power-chord guitars
    trimmed under the synths.
  - An orchestra hit and an impact on each section, a riser and reverse cymbal
    into choruses, a filter-swept breakdown, the final chorus up a step.
- **The heavier variant**: a darker minor key.
  - A drop-tuned palm-muted 16th riff (`drop-guitar`, `power: true`, `art:
    'pm'`).
  - Scratch accents, a half-time breakdown with a whammy dive.
- **Anime rock opening** (90s/00s): 150–175 bpm, royal-road choruses
  (`IV V iii vi`).
  - A bell or celesta sparkle intro with a string run and a timpani roll.
  - `rock-drive` / `eight-beat` verses, a `double-time-chorus` with a crash on
    every section.
  - Brass stabs on a `push` rhythm, strings doubling the melody an octave up.
  - A solo with bends and pinch harmonics, the last chorus up a half step, an
    ending hit on a held chord.
- **The ballad bridge**: half-time.
  - Piano arpeggios, a clean guitar arpeggio through a bbd chorus, a string
    hairpin, a lead guitar singing with vibrato.
  - A snare roll + riser into the last chorus (`IV V/V V V`: the push).
- **Classic country:** 100–130 bpm, `train` or `two-beat` on `brush-kit`,
  `root-fifth` bass with `walkup`, acoustic strum and a backbeat piano, the
  `twang-guitar` and `pedal-steel` trading (`solo` arcs `call` / `response`),
  a `fiddle` break. `band: 'country'`.
- **Bluegrass:** fast, no drums: a `banjo` on `roll`, the guitar chop on
  `backbeat`, fiddle and guitar breaks.
- **Blues shuffle:** `shuffle: 1`, a twelve-bar chart, `blues-kit` on
  `shuffle`, `walk` bass, `crunch-guitar` on `boogie`, `organ-rotary`, a
  harmonica and a guitar trading. **Slow blues:** `meter: '12/8'`, piano
  triplets, a sparse crying `solo`.
- **The soloist spectrum:** `solo` styles `virtuoso-rock` (a guitar
  instrumental), `classical` (over `pima`), `flamenco` (over `rasgueado` and
  `palmas` on a 12/8 compás), `gypsy-jazz` (over `pompe`, `shuffle: 0.6`).
  Card `beats-soloist`.
- **Field battle** (a strategy-RPG fight that loops for minutes):
  140–160 bpm in a minor or Phrygian key, `band: 'orchestra-battle'`.
  - `orchestral-perc` on `march` and timpani pickups into each section.
  - Tuba and trombone on the downbeats as the kick, low strings on a `pedal`.
  - Inner strings in repeated 8ths or 16ths as the hi-hat.
  - Horns and trumpets doubling the violins' line in parallel triads.
  - bII for danger, an open seam at the loop, the next section a third up.
  Card `beats-field-orchestra`.
- **Open country / world map** (travelling, the plains, a calm field):
  80–100 bpm, often 6/8, a major or Mixolydian key, `band:
  'orchestra-pastoral'`. A harp on `lilt` alone first, a soft low `drone`
  on cello from bar 2, strings entering late on `upper` with hairpins, one
  woodwind melody with rests between phrases
  (a second woodwind answers), `travel` or no percussion. A short loop
  (45–90 s). Card `beats-field-orchestra`.
- **Adventurous fields** (exploring when the road gets dangerous): 100–120
  bpm, `band: 'orchestra-field'`. A staccato string ostinato or a cello riff
  alone first, low brass on the half bar at mp, a horn or trumpet call
  answered by a woodwind, the tonic flip or the Aeolian march, the middle
  section a third or a fifth up, light `processional` / `march` percussion
  with a roll into each section. Card `beats-field-orchestra`.
- **Military march / processional:** `march` at 130–160 bpm for a column on
  the move, or `processional` at 70–90 bpm for a coronation, a funeral or an
  army in review. Brass calls on `dotted`, timpani into the downbeat, a
  `long-roll` into each section, `band: 'orchestra-processional'`.

## Orchestral scoring (opt-in)

A composition can also carry:

- `meter` / `meters` and a `tempo` map (rit. and accel.)
- `phrases` placed by a part's `form` (transposed, inverted, reversed)
- object events `{ at, n, d, v, art, dyn }` and a 5th tuple slot `art`
- a part's `dynamics` (marks and hairpins)
- a part's `shape: 'phrase'` (or `{ bars, arch, contour, contrast, end }`):
  velocity phrasing over its array events, an arch per `bars` (4), higher
  notes a touch louder, long over short, the last note eased, level-neutral
- `players`, `desk`, `seating` and `a4`

The manuals are `beats-orchestra` and `beats-articulations`. Percussion kits
are in `beats-percussion`, the era synths in `beats-synth`, and the rack plus
`gate` / `duck` / `stutter` in `beats-effects`.

## Mix and export (opt-in, every musical kind)

- **`pan`** on a part/track/channel (−1..1) places it in the stereo field.
- **`room: { decay, model?, predelay?, damp?, level? }`** at the manifest level
  is ONE shared reverb for the mix. A row joins it with **`send`** (0..1,
  post-fader). `model: 'room2'` (the default here) adds pre-delay, early
  reflections, and highs that die before lows. `'noise'` is the classic tail.
  Per-row `reverb` chain effects still work, and can take `model: 'room2'` too.
- **`master: { limit?, glue? }`**: `limit` (dBFS) adds a fast limiter after the
  mix compressor. `glue` overrides that compressor's `threshold`, `ratio`,
  `knee`, `attack` and `release`.
- **`export: { bitDepth?, dither?, normalize? }`** shapes the WAV only; the live
  page never uses it. `bitDepth` is 16, 24 or 32 (float). `dither: true` adds
  seeded TPDF dither. `normalize: { peak: -1 }` sets the true peak in dBTP;
  `{ lufs: -14 }` sets integrated loudness and also keeps −1 dBTP. The render
  meta reports the gain, the result, and `ceilingLimited` when the peak ceiling
  stopped the loudness target.

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
