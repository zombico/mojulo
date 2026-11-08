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

## The layered set: the floor, improved

`sets/mecha-layered.js` is the realistic voice of the same thirteen sounds. Each is its floor, every gesture kept in
order, given what the mixer can do and the layers it lacked:

| layer | what it is |
|---|---|
| transient | a few milliseconds of bright noise, centred and dry: where the ear hears it start |
| body | the floor's own pitched voice |
| harmonics | a copy of the body driven hard and highpassed: only the overtones the drive grows |
| sub | a clean low thump, centred, never driven, never sent |
| grit | grain trains panned apart |
| tail | noise darkening as it fades, sent to the space |
| detail | what it is made of: a plate ringing, a hydraulic hiss, a mechanism's clack |
| duck | the big hits (the charged shot, the bazooka, the landing, the saber) dip the score |

Driving the floor's body itself was tried first and is what not to do: a driven sine thump saturates its sub, so the
sound grows louder, darker, and fills one band. The yardstick caught it on every cue. The harmonics layer is the fix.

## The yardstick

`measure.js` measures one rendered cue, rendered the way an export renders it:

| measure | what it says |
|---|---|
| `layers` | the gestures it stacks: one is a blip, a realistic sound several |
| `ms` | how long it sounds, from the onset to the last sample within 40 dB of the peak |
| `centroidHz` | how bright its attack is (the first 4096 samples from the onset) |
| `crestDb` | peak over RMS: how much punch stands over the body |
| `bands` | its energy's share in sub, low, mid and high across the whole sound (both channels' power) |
| `spread` | how many of the four bands it fills |
| `width` | how wide it is: 1 − the left and right channels' correlation |

`baseline.js` holds every set cue's numbers (`npm run sfx-baseline` writes it; `--wav <dir>` also writes each cue and
two per-hit variants to listen to). `nearBaseline` compares a measure to a baseline within tolerance.

**The floor law** (`meetsFloor`) holds a set that names a `floor` to it, cue for cue, measured dry. Each cue must:

- stack at least as many layers;
- fill at least as many bands, or stay full (2.5 of 4) where the floor was;
- keep its punch: a crest at most 3 dB under the floor's;
- keep at least 80 % of its length;
- stay the same sound: an attack half to twice as bright, at most four times as long.

Every layered cue meets its floor. These are machine gates only: nobody has listened unless the operator says so.
Width stays near zero even with panned layers: the energy is in the low end, which is mono, as it should be.

## The SFX mixer

Cues used to play dry, mono and centred, straight to the master. The mixer (the kernel feature `sfxmix`, opt-in;
`beats-vocab/beats-sfx.md` is its manual) gives a sound what a realistic one needs:

- **Layers.** Any gesture may carry its own `chain` (filter, drive, compress, crush, delay), `pan` and `send`: the
  body saturated, the transient bright and centred, the grit wide.
- **A space.** A world's `audio.sfx.mix` (or a beats-sfx row's `mix`) puts the cues on an SFX bus with one shared
  space: `open`, `interior`, `hangar`, `cavern`, or `vacuum` (no air: the bus dulled, no tail).
- **Ducks.** A `duck` gesture dips the score under a big hit.
- **A voice cap.** `voices` limits the cues sounding at once; a louder cue steals the quietest.
- **Distance.** A combat cue is placed by its source's distance from the pilot: duller and roomier as well as
  quieter. The export takes `far`.

A page that uses none of it is byte-identical to what it was. The thruster and the jump's servo still play in code,
outside the bus.

## Not yet

Nothing in a level reads the shelf yet. To come: the missing families and their designed variations, sustained sounds driven by a control, and wiring weapon roles,
explosion presets, body sizes and surfaces to their sounds, with WAVs in the engine handoff.
