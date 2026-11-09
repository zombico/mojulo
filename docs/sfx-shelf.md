# The SFX shelf

Mojulo's library of game sound effects: the sounds a game takes instead of inventing its own. One row per sound,
under the words people say for it, voiced in styles and measured on one yardstick. Game effects only: a menu's
sounds belong to the interface. The code is [control/lib/graph/sfx-shelf/](../control/lib/graph/sfx-shelf/).

## How a sound is stored

Nothing on the shelf is stored as audio. Every sound is a small recipe of numbers, synthesized whenever it is played
or exported, the same way in a game page and in a WAV. There are three kinds of recipe:

- **A cue** (a one-shot) is a list of gestures, each a simple way to make sound:

  | gesture | what it makes |
  |---|---|
  | `thump` | a sine falling in pitch: a body, a low end |
  | `burst` | enveloped noise through filters: a crack, a slap, a tail |
  | `grain` | a seeded scatter of tiny noise grains: grit, debris, crackle |
  | `ring` | a struck material's resonances: metal, glass, wood, a bell |
  | `sweep`, `tone`, `flutter` | oscillators that ramp, hold or trill |

  A realistic cue stacks several of them, each a layer at its own time, pitch and level, with its own effects,
  stereo place and room send (the SFX mixer, below).
- **A held voice** is a sound that runs while one control in 0..1 drives it: an engine by its throttle, a crowd by its
  excitement, a heartbeat by fear. It is a list of noise and oscillator layers, every setting a range from the
  control at 0 to the control at 1.
- **A family** (`families.js`) is a procedure that builds cues or held voices from dials: an impact's material and
  weight, a footstep's surface and body, an explosion's size. Most of the shelf is built this way. A designed
  variation is a point on the dials, not a hand-written cue.

**The roster** (`roster.js`) is the index over all of it: one row per sound (`clang`, `whistle`, `car-engine`), its
aliases, its category, the slot a level plays it in, its family, and what voices it in each style. A sound with its
own fixed cues lives in a **set** (`sets/`): a book of cues that is also a valid beats-sfx manifest (`setManifest`),
so the beats tools mint, play and render it as it is.

Randomness is always seeded from the recipe: the same recipe makes the same sound, and a per-hit variant changes the
seed a little each time.

## Styles

A row is voiced in styles (`styles.js`). Four are the palettes (`arcade`, `foley`, `orchestral`, `synth`, from
`beats/sfx-palettes.js`). `realistic` is the shelf's own: several voices sounding as one, each in its own band. It
falls back to `foley` where it has no voice yet. The palettes are frozen behind the roster: every palette cue id is
exactly one row, so their recipes never change.

`sfxSound(word, { style, dials })` finds a sound's voice in this order:

1. the row's own (a set's cue, or its family's build at its dials and yours);
2. the palette's, for a palette row in a palette style;
3. its stand-in's (a beam rifle's shot stands in as a `shoot`);
4. the style's fallback.

A held voice comes back as `{ sustain }`, a spec, rather than gestures.

## The families

| kind | families |
|---|---|
| combat and its world | `explosion` (size, debris, metal), `impact` (material × weight), `footstep` (surface × body, a person to a giant), `melee`, `handling` (magazines, racking, switching, dry fire), `projectile` (flybys, ricochets, casings), `breakage`, `elemental`, `shield`, `launch`, `katana` (a stylized slash, light or heavy; draw, sheathe, jostle) |
| held voices | `booster` (jet, rocket, ion), `engine` (car, motorbike, jet, prop, kart, boat, helicopter), `beam`, `servo`, `fire`, `charge`, `crowd`, `tires`, `cooking`, `heartbeat`, `breath` |
| by game type | see below |

The genres mojulo makes (`docs/tool-surface/hillclimb.md`, the genre probes) each have their own:

| game types | families | some of their words |
|---|---|---|
| athletics, net games, turn sports, team goal games | `ball`, `sport`, `crowd` | `kick ball`, `swish`, `final whistle`, `goal horn`, `starting gun`, `crowd roar` |
| time-trial and kart racing | `tires`, `crash`, `motoring`, `engine` | `skid`, `drift`, `crash`, `nitro`, `honk`, `go kart`, `chopper` |
| dungeon crawlers, RPGs, roguelikes, Metroidvanias, adventures | `magic`, `bow`, `interact` | `heal`, `teleport`, `hex`, `arrow shot`, `bullseye`, `treasure chest`, `unlock`, `quaff`, `creak` |
| platformers, collectathons, runners | `platform` | `coin pickup`, `powerup`, `spring`, `stomp enemy`, `ledge crumble`, `ouch` |
| match-3, block-pushing and arcade puzzles, tabletop | `puzzle`, `tabletop`, `dice` | `match three`, `clear line`, `push block`, `chess move`, `shuffle`, `roll dice` |
| farming and life sims | `work`, `cooking` | `shovel`, `till`, `harvest`, `chop wood`, `pickaxe`, `fishing`, `frying` |
| survival horror, stealth | `heartbeat`, `breath`, `horror` | `pulse`, `panting`, `jump scare`, `three knocks`, `dread` |
| tower defence, real-time strategy | `build`, `siege` | `build tower`, `upgrade`, `trebuchet`, `artillery`, `volley`, `battle horn` |
| flight sims, air combat, space shooters | `flight`, `booster` | `sound barrier`, `fox two`, `afterburners`, `hyperspace`, `chaff` |
| versus fighters, brawlers | `brawl`, `melee` | `grapple`, `suplex`, `haymaker`, `riposte`, `finishing blow` |

The sets add fixed cues where a sound is better written than built. The `mecha` set is mech combat's beam rifle,
bazooka, machine gun, beam saber, footstep, landing and roll. `mecha-layered` voices the same sounds in the realistic
style.

## How a realistic sound is layered

The families speak the same layer words (`layers.js`):

| layer | what it is |
|---|---|
| transient | a few milliseconds of bright noise, centred and dry: where the ear hears it start |
| body | the sound's pitched voice |
| harmonics | a copy of the body driven hard and highpassed: only the overtones the drive grows |
| sub | a clean low thump, centred, never driven, never sent |
| grit | grain trains panned apart |
| tail | noise darkening as it fades, sent to the space |
| detail | what it is made of: a plate ringing, a hydraulic hiss, a mechanism's clack |
| lowBody, air | the low band (120–500 Hz) and the air (above 5 kHz) a tonal sound lacks |
| duck | no sound: the score dips under a big hit |

Two lessons the measurements taught:

- **Drive a copy, not the body.** A driven sine thump saturates its sub: the sound grows louder and darker and fills
  one band. Drive a highpassed copy instead (`harmonics`).
- **Keep chimes short.** A long-ringing bell fills the mid band for as long as it rings, and the ear hears little
  else. Keep chimes short and soft, and give them `lowBody` and `air`.

## The SFX mixer

The mixer is the kernel feature `sfxmix`, opt-in; its manual is `beats-vocab/beats-sfx.md`. It gives a sound what a
realistic one needs:

- **Layers.** Any gesture may carry its own `chain` (filter, drive, compress, crush, delay), `pan` and `send`.
- **A space.** A world's `audio.sfx.mix` (or a beats-sfx row's `mix`) puts the cues on an SFX bus with one shared
  space: `open`, `interior`, `hangar`, `cavern`, or `vacuum` (no air: the bus dulled, no tail).
- **Ducks.** A `duck` gesture dips the score under a big hit.
- **A voice cap.** `voices` limits the cues sounding at once. A louder cue steals the quietest.
- **Distance.** A combat cue is placed by its source's distance from the pilot: duller and roomier as well as
  quieter. The export takes `far`.

Held voices are the kernel feature `sustain`: `engine.sustain(spec)` gives `set(x)` and `stop()`. A beats-sfx row's
`sustains` holds them, and its WAV renders them along a control lane. In a world, `audio.thruster.voice` and
`audio.jump.charge.voice` drive one from the pilot's thrust and jump charge. The shelf's `booster` `jet` and `servo`
are ports of the channel's own synth for those slots, range for range.

A page that uses none of this is byte-identical to what it was.

## How a sound is held to account

Every sound is rendered the way an export renders it and measured (`measure.js`):

| measure | what it says |
|---|---|
| `layers` | the gestures it stacks |
| `ms` | how long it sounds, from the onset to the last sample within 40 dB of the peak |
| `centroidHz` | how bright its attack is |
| `crestDb` | peak over RMS: how much punch stands over the body |
| `bands` | its energy's share in sub, low, mid and high |
| `spread` | how many of the four bands it fills, by energy |
| `heard` | how many it fills as the ear weighs them (A-weighted) |
| `width` | how wide it is: 1 − the left and right channels' correlation |

The laws:

- **The register** (`register.js` `REGISTER`, `meetsRegister`). Every realistic one-shot stacks at least 4 layers,
  fills at least 1.31 bands as heard, and has a crest of at least 8 dB unless it swells rather than strikes (a gust,
  a whistle, a horn).
- **The held law** (`meetsHeld`), measured along the lane (idle, half, full, let go). A held voice is louder at full
  than at half by 2 dB or more, and at half than idle. It is no darker at full. It is silent at idle and after it is
  let go if it idles silent, and audible at idle if it idles running. At full it fills as many bands as the register.
- **Ordered dials** move their measures (`families.laws.test.js`). A bigger blast, a heavier blow, a bigger body's
  step and a harder crash are each longer and darker. A puzzle combo climbs brighter. A spell's power and a dice
  throw's count last longer. Metal rings brighter and longer than earth.
- **Pins.** A family's build for given dials is a compatibility promise, as a kernel's is: `families.char.test.js`
  pins every row's build, so a level that names `explosion` today hears the same blast tomorrow.
- **Floors.** A set may name a `floor`: another set it improves on, cue for cue (`mecha-layered` stands on `mecha`).
  `meetsFloor` holds it there: at least as many layers and bands, its punch within 3 dB, its length kept, the same
  sound. `baseline.js` holds every set's numbers (`npm run sfx-baseline`; `--wav <dir>` also writes each cue to
  listen to).

A deep sweep renders every dial point of every family. These are machine gates only: whether a sound sounds right is
a person's ears.

## Making a new sound

- **A variation:** turn a family's dials, as in `sfxSound('explosion', { dials: { size: 'huge' } })`. Nothing new is
  written.
- **A named sound:** add a roster row naming a family and its dials (`make`), under the words people say. Then add
  its pin.
- **A new kind of sound:** write a family, a function of its dials over the layer words, with its `ordered` dials
  and the measures they move.
- **A fixed set of cues:** write a set under `sets/`. Name a `floor` if it improves on another set.
- **A one-off for one game:** write the gestures in that game's own audio recipe.
- **A stylized sound** (a game's slash, not a recording of air): build it from noise and struck material, short, moving
  across the stereo field. A held tone reads as a whistle. `families/blades.js` (`katana`) is the example: an approach
  whoosh crossing left to right, a bright noise cut falling from the top of the band, the edge's struck ring, a spray
  of grit, a push of air underneath.

A new sound is a row first.

## Not yet

A level reads the shelf by its words only by hand so far: the practice room
(`control/scripts/spikes/practice-room/`) names its sounds by word and wires them to a moveset's events (`audio.moves`,
the world-audio card). To come: wiring weapon roles, explosion presets, body sizes,
surfaces and vehicles to their sounds by word, a level's held voices on its `hold` slot (an engine on a vehicle's
throttle), and WAVs in the engine handoff.
