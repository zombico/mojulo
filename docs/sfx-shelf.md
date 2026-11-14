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
  | `trace` | a sound traced into numbers and synthesized back: band levels, voicing, pitch and pan, frame by frame (mouth foley, below) |

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

A **trace** is how a sound made elsewhere joins the shelf without becoming a sample. `sfx-shelf/trace.js` reads a
rendered sound frame by frame (10 ms) into the levels of twelve bands, how voiced each frame is and at what pitch, and
where it sits left to right; the kernel's `trace` gesture plays those numbers back through a bank of band filters over
seeded noise and, where voiced, a sawtooth. The tracer closes the loop: it renders its trace, reads the render the same
way, and corrects each level by what it missed, so what is stored is what the synth needs, not what the analysis saw.

Randomness is always seeded from the recipe: the same recipe makes the same sound, and a per-hit variant changes the
seed a little each time.

## Styles

A row is voiced in styles (`styles.js`). Four are the palettes (`arcade`, `foley`, `orchestral`, `synth`, from
`beats/sfx-palettes.js`). `realistic` is the shelf's own: several voices sounding as one, each in its own band. It
falls back to `foley` where it has no voice yet. The palettes are frozen behind the roster: every palette cue id is
exactly one row, so their recipes never change.

`mouth` is **mouth foley**: the sounds a voice makes better, made the way a vocal sound-effect performer makes them. The
local voice worker (Kokoro) says a sound word that already sounds like the thing, mostly Japanese manga words (シュッ
shu' for a swing, ザシュッ zashu' for a slash, ブン bun for a heavy swing, スパッ supa' for a clean swish), a chain cuts
the vowel out and sweeps, pans and layers the breath, and the result is traced (`sets/mouth.js`). It voices `swing`,
`blade-swing`, `katana-swing` (the katana's own cue with the traced voice 6 dB under it), `net-swish` and `swell-in` (a
reversed swish), and falls back to `realistic` for the rest. The katana has no heavy cut in this style: the air a blade
cuts sounds the same light or hard, so `katana-heavy-swing` is the swing's sound. A voiced hum pitched down and traced
reads as a lightsaber rather than a heavy blade; those takes stay in the bake as alternates. The traces are
generated (`sets/mouth-traces.js`) by `node scripts/mouth-foley/bake.mjs`, the only step that needs the worker: the
recipes (word, voice, speed, chain) are in the script, and `--check` says whether the page is stale.

Mouth foley also builds sounds from a word's syllables (`scripts/mouth-foley/body.py`). It cuts each syllable once,
then holds and layers it the way a throat, a voice, a mouth and a diaphragm make a creature's growl, snarl or roar.
Or it strikes it under about 150 ms, where a voice stops being a voice and becomes motion: a punch, a kick, a staff,
nunchaku. Or it takes a word's own bursts and clicks: the ch sounds, a latch カチャ, a coin チャリン, a spark パチッ.
A ring is not traced. The bake strikes it with the kernel's own `ring` gesture over the traced dry part.

`sfxSound(word, { style, dials })` finds a sound's voice in this order:

1. the row's own (a set's cue, or its family's build at its dials and yours);
2. the palette's, for a palette row in a palette style;
3. its stand-in's (a beam rifle's shot stands in as a `shoot`);
4. the style's fallback.

A held voice comes back as `{ sustain }`, a spec, rather than gestures.

## The families

| kind | families |
|---|---|
| combat and its world | `gunshot` (a small arm by its cartridge: pistol, smg, magnum, rifle, shotgun, sniper; suppressed), `explosion` (size, debris, metal), `impact` (material × weight), `footstep` (surface × body, a person to a giant), `melee`, `handling` (magazines, racking, switching, dry fire), `projectile` (flybys, ricochets, casings), `breakage`, `elemental`, `shield`, `launch`, `katana` (a stylized slash, light or heavy; draw, sheathe, jostle) |
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

A level's `audio.engine` (`{ voice, top, level?, idle? }`) drives a held voice from the pilot's travel speed over
`top`: a ride's engine.

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

## Finding a sound

A row says what it is for as well as what it is (`facets.js`):

- **`matter`:** what sounds (metal, wood, water, air, creature…).
- **`weight`:** light, mid or heavy.
- **`genres`:** the game types that use it (the cosmos genre ids).

Each facet is set once on a family, read off the dials a row is built at (an impact's `material`, a blast's `size`),
or written on a row where neither says it. A row's `say` holds its sound words, in kana with romaji and in English
(`カチャ`, `kacha`, `clink`). They are the words mouth foley scores with, so the word that makes a sound also finds it.

`find.js` searches by intent, as the vehicle registry does:

- **`findSounds({ words, category, slot, matter, weight, genre, style })`:** words rank and facets filter. A word
  that names two things is read by the rest of the phrase: "a crackling fire" is the fire, and "fire" alone is the
  shot. Ties go to the newest voices.
- **`solveSound(words)`:** sets the dials the words name: "heavy footsteps on gravel" is `step-gravel` at
  `body: heavy`.
- **`suggestSounds(word)`:** the tail a refusal throws with.

## A game's sound sheet

A game's sounds are solved from what the game is (`gameworld/sound-sheet.js`, the game book's `sound` chapter):

- **Its weapon:** the first weapon of its arsenal, by its words: a staff, nunchaku, a katana, a blade or a fist.
- **Its whole arsenal**, where the game has one (its own, or its feel's kit): every weapon's swing and blow by the
  move's weight (light, heavy, finisher), the guard's block, parry and break, the bow's draw and loose, the weapon
  cycle, a foe's swing and fall, a blow taken. These are the practice room's words (`MOVE_SOUND_WORDS`), so a level
  plays what the room played, with a weapon read by its words where the shelf has its own (a katana's heavy cut).
- **Its guns:** each gun a shooter's player carries (the kit, or the one rifle the goal hands them) sounds as what
  it is, by the firing range's procedure: a shot by its cartridge (pistol, submachine gun, magnum, rifle, sniper,
  shotgun; a launcher's round away), a reload spread over the gun's own reload time, a round landing, the draw.
  Guns play realistic whatever the sheet's style, since no other style voices a gunshot by its cartridge.
- **Its ride:** a level driven in a vehicle hears its engine, a held voice by the words of what is ridden (a
  motorbike, a kart, a truck's diesel, a tank, a boat; else a car). It follows the ride's own speed from an idle up
  to its top speed, which is read from the ride's rule (its governed speed, or where its power meets its drag).
  `sound.ride` is the game's own held voice, or `false` for none.
- **Its ground:** what the level's place says. Its words first (snow, sand, mud, dry leaves, gravel: from its kit's
  name and its weather), else grass on a stage grown on a nature, jungle or isekai kit, else stone. A composed
  game's stages carry no kit of their own, so the place is read from the world's style (its kit and weather), the
  level's climate and its look's title. One ground a level: it does not change where the surface does.
- **Its bed:** the environment under the score, from the same words: rain, a cave, a swamp, a farm, night, a wood.
  The world's default meadow lays none, since it is under a desert and a city too.
- **Its foes:** a beast's voice by its species, heard when it spots the hero and each time it attacks; a big cat
  also grunts when struck. A foe drawn as a person shouts on its attack, grunts on a blow and cries out as it falls.
  A pack's attacks are held apart, so five wolves never say one snarl at once. A foe that is neither is listed as
  owed: it sounds only by the blows it gives and takes.
- **Its doors:** a door opens on a latch.

**The newest voices come first.** The sheet's style is `mouth` unless the game says otherwise, so a sound the mouth
doesn't voice plays realistic. A game overrides any of it with `sound: { style?, slots?, on?, weapons?, moves?, guns?, foes? }`, each a shelf word: `weapons` is
`{ <weapon id>: { swing?, heavy?, hit?, finisher? } }` `moves` is `{ block?, parry?, break?, draw?, loose?, arrow?,
felled?, cycle?, foeSwing?, hurt? }`, `guns` is `{ <gun's name>: { shot?, reload?, hit?, draw? } }`, and `foes` is
`{ <foe id>: { attack?, hurt?, down? } }`.
A game that writes a `sound` of its own, even an empty one, hears the sheet on every level it builds; a quick game's
levels also hear it with `sfx: 'sheet'`, and a quick game that names another `sfx` keeps that. A game with neither
builds its levels as it did. A stage that wrote its own `audio` keeps it under the sheet. `beats-world.js` voices `sfx: { sheet }`, wiring each event
the level's mechanics emit as `auto` wires a palette. `auto` and the palettes are as they were.

**The sound book** (`gameworld/sound-book.js`, `/api/sketches/<ref>/bible?book=sound`) is the sheet read and heard:
every sound the game plays, the shelf word that plays it and why, each with a button that sounds it on the kernel
the game ships (a held voice is revved). It lists the hero, the arsenal, the guns, the ride, the foes, the game's
events, the beds and what is owed. A game on no sheet is shown the sheet it would have and told how to take it.
It is where a person listens: the ears gate is theirs.

## Who plays it

A fight game (the versus kind, under its register) sounds its blows from the families: `versus/versus-sfx.js` builds
one cue for each thing a fight does (a fist by its weight, a foot, a blade, a counter, a spark, a block, a throw, a
knockout) from the families at their dials. The arena's page carries them on its audio channel, and the fight plays the
cue for what landed.

## Where a game hears it

The firing range (`gameworld/combat/range-sound.js`) is the first to read the shelf by its words: each weapon's shot
by its cartridge (the `gunshot` family) or its fire type (a launcher's `missile launch`), its reload as one cue over
its own reload time (`mag out`, `mag in`, `rack`), its hit (`flesh impact`), its draw (`weapon switch`), a blade's
`blade swing` and `blade hit`, a rocket's `explosion`, footsteps on `step concrete`, on a mix in the open. A game
names its own word for any of them.

## Not yet

Beyond the sheet, the fight and the firing range, a level reads the shelf by its words only by hand so far: the practice rooms
(`gameworld/practice-room.js`) name their sounds by word and wire them to a moveset's events (`audio.moves`, the
world-audio card); made levels do not yet. To come: wiring weapon roles, explosion presets, body sizes,
surfaces and vehicles to their sounds by word, a level's held voices on its `hold` slot (an engine on a vehicle's
throttle), and WAVs in the engine handoff.
