# The SFX shelf

The game sounds a game takes instead of inventing its own: one row per sound under the word people say, voiced in
styles, measured on one yardstick. Game effects only: a menu's sounds belong to the interface. The code is
[control/lib/graph/sfx-shelf/](../control/lib/graph/sfx-shelf/).

## What is on it

- **The roster** (`roster.js`): a row is a sound (`beam-rifle-shot`, `step`, `thruster-roar`), its aliases, its
  category, the audio channel slot a level plays it in, its family, and what voices it. The categories with no row yet
  are the shelf's gaps (`sfxGaps()`): today explosions, destruction and the elements.
- **The styles** (`styles.js`): the four palettes (`arcade`, `foley`, `orchestral`, `synth`, from
  `beats/sfx-palettes.js`) and `realistic`, the shelf's own register: several voices sounding as one, each in its own
  band. `realistic` falls back to `foley` where it has no voice yet.
- **The sets** (`sets.js`, `sets/`): books of cues (beats-sfx gesture lists) that voice rows in a style. A set is a
  valid beats-sfx manifest (`setManifest(name)`), so `create_beats` mints it, the `/beats` studio plays it and the WAV
  export renders it.
- **The resolver** (`resolve.js`): `sfxSound(word, { style })` finds a voice in this order: the row's own (a set), the
  palette's (a palette row in a palette style), its family's (a beam rifle's shot is a `shoot`), then the style's
  fallback. A row with no family (the charge-up) is silent in a style that has no voice for it.

The palettes are frozen behind the roster: every palette cue id is exactly one row, so their recipes do not change by a
byte. A new sound is a row first.

## The mecha set: the floor

`sets/mecha.js` is Mobile Suit Arena's effects (summer 2026, `zombico/mobile-suit-arena`), rescued verbatim: the
footstep, the landing, the roll, the beam rifle (shot, hit, charge-up, charged shot), the bazooka, the machine gun, the
fallback blip, the beam saber (swing, hit). They lived only in the game's rows. A test holds them to their recorded
hash. A better voice of one of them is a new set, never an edit to this one. The game's thruster roar and its jump
servo and piston slam are still synthesized in code (`scene/channels/audio.js`); their rows name that channel slot
until they are cues.

## The yardstick

`measure.js` measures one rendered cue, rendered the way an export renders it:

| measure | what it says |
|---|---|
| `layers` | the gestures it stacks: one is a blip, a realistic sound several |
| `ms` | how long it sounds, from the onset to the last sample within 40 dB of the peak |
| `centroidHz` | how bright its attack is (the first 4096 samples from the onset) |
| `crestDb` | peak over RMS: how much punch stands over the body |
| `bands` | its energy's share in sub, low, mid and high across the whole sound |

`baseline.js` holds every set cue's numbers (`npm run sfx-baseline` writes it; `--wav <dir>` also writes each cue and
two per-hit variants to listen to). `nearBaseline` compares a measure to a baseline within tolerance. These are machine
gates only: nobody has listened unless the operator says so.

## Not yet

The shelf names and measures; nothing in a level reads it yet. To come: per-layer processing and an SFX bus with a
space (the music mixer's effects, which cues bypass today), re-voicing the mecha set through it against this floor, the
missing families and their designed variations, sustained sounds driven by a control, and wiring weapon roles,
explosion presets, body sizes and surfaces to their sounds, with WAVs in the engine handoff.
