# The recorded sound library

Mojulo's sounds are synthesized: every one is a recipe of numbers played the same way on every machine. The recorded
sound library is the one opt-in exception: realistic sound effects recorded with ElevenLabs, installed on a machine
that wants them and never part of the npm package. Where it is installed, the SFX shelf's realistic one-shots it
records play their recordings; where it is not, everything sounds exactly as it did. The code is
[control/lib/graph/sound-library/](../control/lib/graph/sound-library/).

## What it holds

An index and its masters, in one directory:

- `library.json`: `{ version, cards: { <card>: { shelf | band, role, loop, prompt, variants: [ { id, take, seconds,
  rate, channels, peakDb, lufs, seam?, source } ] } } }`. A **card** is one sound as it was asked for (its prompt and
  settings, `scripts/sound-library/cards/`), naming the shelf row it voices (`shelf`). Its **variants** are its takes,
  each named by its bytes' hash: a game plays them in turn, one per hit.
- `masters/<id>.wav`: each variant level-matched (one-shots peaked at -1 dBFS, beds at -24 LUFS, 16-bit 44.1 kHz),
  read by an offline render; `masters/<id>.mp3` beside it, a tenth of the size, inlined by a page.

The library is looked for at `$MOJULO_SOUNDS_DIR`, else `<$MOJULO_HOME or ~/.mojulo>/sounds`. A release carries its
source (the original takes, `library.json` and the ledger); its masters are rebuilt from it, byte for byte, by the
conditioner, which needs ffmpeg. To install one by hand (until `mojulo install sounds` lands), from `control/`:

```bash
mkdir -p ~/.mojulo/sounds
```

```bash
tar -xf sounds-v3-source.tar -C ~/.mojulo/sounds
```

```bash
node scripts/sound-library/condition.mjs --cards spike,batch2,vehicles,registry --out ~/.mojulo/sounds
```

## Where it plays

- **The SFX shelf** ([sfx-shelf.md](sfx-shelf.md#recorded-voices)): a realistic one-shot the library records resolves to
  one `sample` gesture carrying its synthesized gestures as the fallback. Every page that plays the shelf (a world's
  audio channel, the sound book, a beats-sfx page) inlines the samples its cues use and decodes them when sound is
  unlocked; a cue before then plays its fallback. An offline render (an export's WAV) decodes them first.
- **The band**: a `voice: 'sample'` patch names a card and plays its variants as an instrument piece, falling back to
  the synthesized piece it names. The first recorded kit (`recRockKit`) lost to the synthesized 90s kit by ear and is
  not on the instrument shelf; it stays as the sampler's proving patch.
- **Held voices** (`sfx-shelf/recorded-held.js`): an engine is a set of steady loops recorded at known revs (cards with
  `engine` and `rpm`); a held row with a tuning plays them crossfaded by its control, each bent in pitch by the revs over
  its own, its synthesized spec the fallback. The recordings are shared and the tuning is the row's: the open city's
  car at the wheel (`road-car-engine`: short of its redline, through a small speaker) and a racing car (`car-engine`:
  the whole range, open) drive the same loops their own ways. Tyres and the road are one loop each. ElevenLabs takes a
  prompt's revs as a mood, not a number, so a loop's `rpm` is what it was asked for until it is calibrated by ear.
- **A mobile suit's kit** (`sfx-shelf/suit-sounds.js`, recorded from Mech Battle Kai's cards, `cards/mech-battle-kai.js`):
  not a flavor, since a suit's machine sounds are any mech game's. A suit is heard by its weight (light, medium, heavy:
  footfall, landing, servos), its drive (rocket, jet, ion: the booster held by the thrust, its ignition, the quick
  boost) and its loadout (beam rifle and charge, beam cannon, railgun, vulcan, machine gun, bazooka, missiles, beam
  saber, heat axe), plus what every suit shares (roll, jump and its gathering, overheat alarm and vent, transform both
  ways, lock-on, power-up). The variants (a light suit's step, an ion boost) are rows of their own, heard as their
  `standIn` without the library. A game designs its suit with `sound: { suit: { weight, drive, arms } }`; a feel with a
  mech (Mech Battle Kai's) is heard as its weight implies where the library records it; the firing range's walking
  frames by their mass. Each card's `tags` name its axis (`suit`, `light`, `rocket`, `arms`…).
- **Magic's kit** (`sfx-shelf/magic-sounds.js`, recorded from `cards/magic.js`): every element (fire, ice, thunder,
  water, wind, earth, light, dark, poison, nature, arcane) as its cast and its three tiers (bolt, burst, cataclysm), the
  statuses taken and what they share, the spells, a battle's moments, and what magic does to a world (terrain shifting,
  the sky turning, lava and portals held). Not a flavor. A game that lays party battles (Isekai Party's) hears each of
  its fights' happenings by it where the library is installed: each elemental skill at its tier, the statuses, the heals,
  a crit or a weakness over the blow, a foe dissolving, a level gained. Tags: `magic`, the element, `status`, `spell`,
  `battle`, `world`, `terrain`, the tier.
- **The animals** (`sfx-shelf/animal-voices.js` and `animal-sounds.js`, recorded from `cards/animals.js`): each voice
  class's call, alert, hurt and death, and what moves without a voice. Every animal mojulo makes lands on a class by
  its family, its order or its own way of being heard; foes are heard by them where the library is installed (an action
  level's foe attacking, hurt and falling; a party battle's foe falling), the mount lane's horse (its hooves by its
  pace, a neigh as the hero is up, a snort at the gallop), and a biocube's field and herds (crows over the site, gnats
  at their clouds, ducks on the stream, mice and roaches by the walls, each herd calling from its ground). Tags:
  `animal`, the class, the call.
- **Vehicles** (`sfx-shelf/vehicle-sounds.js`): each vehicle in the registry
  ([vehicles.md](vehicles.md)) sounds as its kind (realm and role: a road hauler is a diesel with air brakes and a
  reverse beeper) unless it is named for its own (a muscle car's V8, a tram's bell, a bicycle's freewheel): its
  engine, what it runs on and the events it is known by, all shelf rows. A ride the sound sheet's words leave to the
  car's engine asks the registry (`rideSound`), so a helicopter is heard by its rotor. Rows with no synthesized voice
  of their own (a siren, a bus door, a lock's chirp) are `recorded` rows: their palette stand-in, or silence, without
  the library.
- **The open city's car taken** (Hijack City; `citySounds` in `gameworld/sound-sheet.js`): where the library records a
  car's own engine, the city names it for that car's model (`modelEngines()`: the car shelf's cards and the traffic's
  lofts, through the registry), heard from the cab whatever the engine (`CAB` in `recorded-held.js`: short of its
  redline, through a small speaker), and the page starts the engine the driven car's model names. A car whose engine is
  the city's own keeps the hatchback. Each engine a page carries is its loops (about 0.6 MB of MP3 an engine: a city
  page with the V8, the V12, the electric motor and the diesel beside the hatchback carries about 3.5 MB of sound).
- **The car taken's own events** (the same `citySounds`): each car model's registry vehicle's events, where the library
  records them, are its cues under `<cue>@<set>` (`engine.cueOf` naming a model's set, `engine.mute` the city's cues a
  set has none of): a V8's start, a truck's air horn, air brakes and reverse beeper, a bus's doors, a backfire off the
  pedal, the lock's chirp as its driver walks away, a police car's siren on N; an electric car has no starter. A car
  whose events are all the city car's has no set.
- **A racing car's own events** (`rideEvents` in `gameworld/sound-sheet.js`, the runner's beside `rideSound`): a ride on
  the ground, by its words through the registry (a ride it does not know is the vehicle its engine is: a 'car' is a
  sedan), where the library records them: its start as the level begins, its revs through its gears and a gear changed
  up, its brakes, its horn on H, a backfire off the pedal, a reverse beeper, and its tyres' roar and screech beside the
  engine. A ride with none recorded is as it was.
- **A game's own sounds, its FLAVOR** (a card's `flavor`, the game's feel's pole: Galaxy Boy's `galaxy-boy`): a game
  whose flavor the library holds names it on its sound sheet (`flavor`, `soundSheet`), and every word it plays is
  asked for that flavor first (`sfxSound(word, { flavor })`): a flavored card voices its row for that game in any style,
  ahead of the row's realistic recording, and a game without the flavor never hears it; a held tuning may belong to a
  flavor (the buster's charge). Galaxy Boy's own: its buster's three shots and its charge, its robot hero's dash, wall
  kick, wall slide, hurt, jump and landing, its robot foes' shots, hits, armour and wrecks, its bosses blowing apart, a
  robot waking, the stomp, the boulder lifted and thrown, the boss room's blast door.
- **Jumping Giuseppe** (`jumping-giuseppe`): its steps, jump and landing, its mechanics' cues (a coin, an extra life, a
  bump, a foe knocked out, death, a checkpoint, the goal), and its hero's own moves, which a platformer (a feel on the
  platformer's base whose charge is no shot) hears through the run channel only where its flavor is recorded
  (`PLATFORM_RUN` in `gameworld/sound-sheet.js`: the wall kick, the wall slide, a blow taken, a foe stomped on, the
  double jump, `air`, e.airJumpsUsed up). A flavored card on a palette row voices every row that stands on it, for its
  flavor: one cartoon step on any floor. The ground pound is the feel lab's and not yet the runtime's, so it is silent.
- **Steel Serpents** (`steel-serpents`): its quiet steps (any floor, a steel catwalk), its vault, drop and roll, its
  knife and its takedown, a keycard door and a security door, a keycard picked up, and its guards' shout, grunt and fall
  where its foes are drawn as people. Nothing of the rail's code: its flavor answers every word its sheet plays. Being
  spotted and the extraction are its own cues (an alarm stinger, a success stinger), named as sounds only: the first
  takes, asked for over a radio, came back saying words. The sneak goal's patrolling guards have no voice of their own yet.
- **The menus** (the game UI runtime's cues, `beats/ui-sounds.js`): a recording is PINNED to mana-ui's sound sets (a
  card's `ui` cues on its `uiSets`), so every page whose theme plays that set hears it over the set's synthesized cue
  (`uiSoundAudio` carries the recordings as `samples`; the wireframe board and a preview decode them, `samplesScript`).
  A game's menus (the play shell's title, set-up, pause and result) play the set its rail, its genre or its look names
  (`menuSoundSet`, `MENU_SOUNDS` in `playscape/ui/interface-look.js`), where the library records that set (the game's
  `ui.sounds`; without it its menus are silent, as before). The themes: `crypt` gothic (stone, bells, heavy doors, a
  high echo: Fallen Angel's), `robot` clean app-like chimes, brighter and quicker than Steel Serpents' (Galaxy Boy's;
  a new synthesized set beside the others, its recordings the chimes), `glass` and `terminal` subtle app-like chimes (Steel Serpents', its toast the extraction chime), and `console`,
  `chip`, `paper` and `party` light and bouncy (every other game's).
- **A recording reused** (its metadata): `also` (more rows the same takes voice: Steel Serpents' extraction chime is
  its checkpoint and its chime too), `ui` and `uiSets` (the menu cues and sets it voices), `tags` (what it is, for
  finding it again: `recordingsTagged('success')`).
- Not yet: the beds (the library's ambience loops), the traffic heard by its own engines, the engine handoffs.

The kernel's `sampler` slice carries all of it; a recipe without recorded sounds emits none of it, and a page or a
render on a machine without the library is byte for byte what it was. Under test the library is never the
developer's (`vitest.setup.js` points `MOJULO_SOUNDS_DIR` at nothing); a suite that tests it builds its own.

## Making it

Maintainer tooling in [control/scripts/sound-library/](../control/scripts/sound-library/), never shipped and never
called by mojulo itself (mojulo calls no generation API):

1. **Cards** (`cards/<set>.js`): one per sound, the shelf row it voices (or, for an engine's loop, the `engine` and the
   `rpm`), its prompt, length, prompt influence, loop and how many takes. Sets load together (`--cards spike,batch2`), each card id once.
2. **Generate** (`generate.mjs --cards <sets> --out <dir> --budget <credits> [--dry]`): the takes, from the ElevenLabs
   sound-generation API (`eleven_text_to_sound_v3`, which cost 10 credits a second), into `<dir>/takes`, every call in
   `<dir>/ledger.jsonl`; a take already made is skipped, and a call that would cross the budget is not made. The key
   is the operator's (`ELEVENLABS_API_KEY`, or a proxy that adds it; Node's fetch behind a proxy needs
   `NODE_USE_ENV_PROXY=1`), never in a file.
3. **Hear for speech** (`check-speech.mjs --cards <sets> --out <dir>`): every take of a card that is not a voice through
   ElevenLabs' speech-to-text (about a credit a take, in the ledger); a take that says words is left out by the
   conditioner. The sound model reads a prompt aloud as readily as it makes the sound: a cue asked for as "an intruder
   spotted … over a radio" came back saying "No intruder spotted". So a card's prompt **names the sound, never the
   scene**: its sources and their character (three fast rising beeps over a synth swell, a door's pneumatic hiss), with
   no message, no sayer (radio, announcer, intercom, speaker), no outcome said as words (spotted, reached, complete) and
   no quoted words; the generator refuses those before a credit is spent (`SPEECH_WORDS`). A **cue** (a stinger: being
   spotted, an objective done, a checkpoint) is `role: 'cue'` and follows its prompt closely (prompt influence 0.85). A
   card that is meant to be a voice (a guard's wordless grunt) says `voice: true`.
4. **Audition** (`board.mjs`): every take on one page with its measures, for the ears gate, which is the operator's.
5. **Condition** (`condition.mjs`, needs ffmpeg): every take kept as a variant (leaving one out is the pick; a take that speaks is left out), trimmed,
   level-matched (one-shots by peak, beds at -24 LUFS, a vehicle's loops at -14), a loop's seam measured, the masters and `library.json` written; a re-run is byte-identical.

The takes, the masters and the ledger are the operator's, outside the repo; a release carries them as a tarball.
