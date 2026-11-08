# The SFX shelf

The game sounds a game takes instead of inventing its own: one row per sound under the word people say, voiced in
styles, measured on one yardstick. Game effects only: a menu's sounds belong to the interface. The code is
[control/lib/graph/sfx-shelf/](../control/lib/graph/sfx-shelf/).

## What is on it

- **The roster** (`roster.js`): a row is a sound (`beam-rifle-shot`, `step`, `thruster-roar`), its aliases, its
  category, the audio channel slot a level plays it in, its family, and what voices it. A category with no row is a
  gap the shelf owes (`sfxGaps()`); today there is none.
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
| `spread` | how many of the four bands it fills, by energy |
| `heard` | how many it fills as the ear weighs them (A-weighted) |
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

## The families: sounds built, not stored

`families.js` holds the sounds the shelf builds from dials. A family is a procedure over its dials, and a designed
variation is a point on them, not a hand-written cue. Each family speaks the layer words of `layers.js`.

| family | dials | what it makes |
|---|---|---|
| `explosion` | size (small → huge), debris, metal | a blast; `metal` is a machine's wreck coming apart |
| `impact` | material (metal, armor, stone, wood, dirt, flesh, water, energy), weight (light → heavy) | one thing meeting another |
| `footstep` | surface (concrete, metal, dirt, grass, gravel, wood, snow, water), body (human → giant) | one footfall |
| `melee` | act (blade and blunt swings and hits, clash, block, punch, kick), kind (steel, energy) | close combat |
| `handling` | act (mag-out, mag-in, rack, switch, dry-fire), kind (firearm, energy, mech) | a weapon worked, not fired |
| `projectile` | act (flyby, ricochet, casing), kind (bullet, beam, rocket, shell) | a round passing, glancing off, its casing falling |
| `breakage` | material (glass, wood, stone, metal), size | a thing breaking |
| `elemental` | element (fire, ice, lightning, water, wind) | the elements as one-shots |
| `shield` | act (up, down, break) | an energy shield |

A roster row names a family and a dial preset (`make`), under the words people say (`grenade`, `clang`, `parry`,
`shatter`). `sfxSound(word, { dials })` turns the dials further. A build is pure: its grain seeds are hashed from the
family and its dials, never rolled.

How a family is held to account:

- **Pinned.** A build for given dials is a compatibility promise, as a kernel's is: `families.char.test.js` pins
  every row's cue.
- **Ordered dials move their measures.** A bigger blast is longer and darker; a heavier blow longer and darker; a
  bigger body's step longer and darker; a machine's hands slower than a person's (`families.laws.test.js`).
- **Materials are heard as themselves.** Metal rings brighter and longer than earth.
- **Every dial point is in the register** (`register.js`, the deep sweep). The floor is the layered set's own
  weakest: at least its layers, its punch (unless the sound swells, as a gust does), and as many bands **as the ear
  hears them**.

That last measure, `heard`, is A-weighted. A long low thump carries most of a sound's energy and little of what is
heard, so the energy `spread` called every big, heavy sound thin. `spread` still holds a voice to its own floor;
`heard` holds a sound to the register.

## By game type

The genres mojulo makes (`docs/tool-surface/hillclimb.md`, the genre probes) each lacked their own sounds. They are
families too, with the same laws: every one-shot in the register, every held voice under the held law, every row pinned.

| game types | families | some of their words |
|---|---|---|
| athletics, net games, turn sports, team goal games | `ball`, `sport`, `crowd` (held) | `kick ball`, `swish`, `final whistle`, `goal horn`, `starting gun`, `crowd roar` |
| time-trial and kart racing | `tires` (held), `crash`, `motoring`; `engine` kart, boat, helicopter | `skid`, `drift`, `crash`, `nitro`, `honk`, `go kart`, `chopper` |
| dungeon crawlers, RPGs, roguelikes, Metroidvanias, adventures | `magic`, `bow`, `interact` | `heal`, `teleport`, `hex`, `arrow shot`, `bullseye`, `treasure chest`, `unlock`, `quaff`, `creak` |
| platformers, collectathons, runners | `platform` | `coin pickup`, `powerup`, `spring`, `stomp enemy`, `ledge crumble`, `ouch` |
| match-3, block-pushing and arcade puzzles, tabletop | `puzzle`, `tabletop`, `dice` | `match three`, `clear line`, `push block`, `chess move`, `shuffle`, `roll dice` |
| farming and life sims | `work`, `cooking` (held) | `shovel`, `till`, `harvest`, `chop wood`, `pickaxe`, `fishing`, `frying` |
| survival horror, stealth | `heartbeat`, `breath` (held), `horror` | `pulse`, `panting`, `jump scare`, `three knocks`, `dread` |
| tower defence, real-time strategy | `build`, `siege` | `build tower`, `upgrade`, `trebuchet`, `artillery`, `volley`, `battle horn` |
| flight sims, air combat, space shooters | `flight` | `sound barrier`, `fox two`, `afterburners`, `hyperspace`, `chaff` |
| versus fighters, brawlers | `brawl` | `grapple`, `suplex`, `haymaker`, `riposte`, `finishing blow` |

**Tones are swells.** A whistle, a buzzer and a horn are held tones by nature, not strikes, so they are the families'
`swells`: their crest is not held to the register's.

**Chimes need their bands.** A long-ringing bell or chime fills the mid band for as long as it rings, and the ear
hears little else. The puzzle matches, the heals and the bells are kept short and soft. Each carries the two bands it
lacks: `lowBody` (120–500 Hz) and `air` (above 5 kHz), from `layers.js`.

## Held voices: sounds driven by a control

A cue is a one-shot. A held voice (the kernel feature `sustain`, `engine.sustain(spec)`) is a sound that runs while
something drives it with one control in 0..1, every range from the control at 0 to the control at 1. The held
families are in `families/held.js`:

| family | kinds | the control |
|---|---|---|
| `booster` | jet, rocket, ion | thrust |
| `engine` | car, motorbike, jet, prop (idling at 0) | throttle |
| `beam` | laser, plasma | power |
| `servo` | hydraulic | a machine gathering itself |
| `fire` | open (burning at 0) | its size |
| `charge` | energy | its fill |

`sfxSound` gives a held voice as `{ sustain }`, a spec, not gestures. **The game's code-synthesized sounds are ported
into the shelf**:

- **Thruster:** `booster` `jet` is Mobile Suit Arena's boost whine, transcribed from its audio channel range for range.
- **Jump servo:** `servo` is the jump's servo with its piston chuffs, 4 to 13 a second as in the game.
- **Jump release:** the one-shot family `launch` is the piston slam at three powers, plus the register's layers.

A world's `audio.thruster.voice` or `audio.jump.charge.voice` plays the held voice in place of the channel's own
synth. Without one, the page is the same as before, byte for byte. The ports are transcriptions of the code, and only
the machine gates have run on them.

**The held law** (`register.js` `meetsHeld`), measured along the lane (idle, half, full, let go):

- louder at full than at a half by 2 dB or more, and at a half than idle;
- no darker at full;
- silent at idle and after it is let go when it idles silent, audible at idle when it idles running;
- at full, as many bands as the register.

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

Nothing in a level reads the shelf by its words yet (a world gives the thruster a voice as a spec). To come: wiring
weapon roles, explosion presets, body sizes, surfaces and vehicles to their sounds by word, a level's held voices on
its `hold` slot (an engine on a vehicle's throttle), and WAVs in the engine handoff.
