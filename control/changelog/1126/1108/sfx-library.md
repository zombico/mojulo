### The SFX shelf: a library of game sound effects

- **A library of game sounds** (`lib/graph/sfx-shelf/`, `docs/sfx-shelf.md`): one row per sound under the words
  people say (`clang`, `grenade`, `swish`, `skid`, `heal`, `match three`, `chess move`, `shovel`, `jump scare`,
  `trebuchet`, `suplex` …). Each row has a category, the slot a level plays it in, the palette sound it stands in
  for, and what voices it. Game effects only; a menu's sounds are the interface's.
  `sfxSound(word, { style, dials })` gives its cue, or a held voice's spec.
- **Recipes, not samples.** Nothing is stored as audio:
  - a **cue** is a stack of gesture layers;
  - a **held voice** is a set of layers whose every setting runs with one control in 0..1;
  - a **family** builds either from dials, so a designed variation is a dial point.

  Builds are pure (seeds hashed from the family and its dials) and pinned.
- **The styles are kept.** The four palettes (arcade, foley, orchestral, synth) are styles of the shelf, frozen behind
  it: every palette cue id is exactly one row, so no recipe changes by a byte. `realistic` is the shelf's own style,
  several voices sounding as one, and falls back to foley where it has no voice yet.
- **Thirty-eight families, 477 dial points, 217 rows.**
  - **Combat and its world:** explosions by size, impacts by material and weight, footsteps by surface and body,
    melee, weapon handling, projectiles, breakage, the elements, shields, a launch.
  - **Held voices:** boosters, engines (car, motorbike, jet, prop, kart, boat, helicopter), beams, a servo, fire, a
    charge, a crowd, tyres, cooking, a heartbeat, breath.
  - **For each game type mojulo makes:** sports (ball, sport, crowd), racing (tires, crash, motoring), adventures
    (magic, bow, interact), platformers, puzzles and tables (platform, puzzle, tabletop, dice), life sims (work,
    cooking), horror (heartbeat, breath, horror), strategy, flight and brawlers (build, siege, flight, brawl).
  - **Sets of fixed cues** where a sound is better written than built: `mecha` (mech combat) and `mecha-layered`, its
    realistic voice.
- **The SFX mixer** (the kernel feature `sfxmix`, opt-in). Any gesture can be a layer with its own `chain` (filter,
  drive, compress, crush, delay), `pan` and `send`. A world's `audio.sfx.mix: { space?, send?, voices?, distance? }`
  puts its cues on an SFX bus in one shared space (`open`, `interior`, `hangar`, `cavern`, or `vacuum`: the bus dulled,
  no tail). A `duck` gesture dips the score under a big hit, on both scores of an adaptive pair. `voices` caps the cues
  sounding at once: a quieter new cue is dropped, a louder one steals the quietest. `distance` (on unless false) places
  a combat cue by its source's distance from the pilot: duller and roomier, not only quieter. A beats-sfx row takes
  `mix` too, and its WAV takes `?far=`.
- **Held voices** (the kernel feature `sustain`, opt-in): `engine.sustain(spec)` returns `set(x)` and `stop()`, gliding
  on ramps it plans itself. The spec is noise and oscillator layers with ranges for pitch, cutoff and gain, and an LFO
  on the gain, the cutoff or the pitch (a sawtooth on the gain is a train of chuffs). A beats-sfx row's `sustains`
  holds them, and its WAV renders them along a control lane. A world's `audio.thruster.voice` and
  `audio.jump.charge.voice` play one in place of the channel's own synth. The shelf's `booster` `jet` and `servo` are
  ports of that synth.
- **One yardstick** (`measure.js`): a sound rendered as an export renders it, measured by its layers, length, attack
  brightness, crest, energy by band, `spread`, `heard` (bands as the ear weighs them, A-weighted) and `width`. The laws:
  - every realistic one-shot is in the register (`register.js`: at least 4 layers, 1.31 bands heard, 8 dB of crest
    unless it swells);
  - every held voice follows its control (`meetsHeld`);
  - ordered dials move their measures (bigger blasts and heavier blows longer and darker);
  - a set that names a `floor` meets it cue for cue (`meetsFloor`).

  A deep sweep renders every dial point; `npm run sfx-baseline` writes the sets' numbers and, with `--wav <dir>`,
  their WAVs. These are machine gates; the ears are the operator's.
- **Fixed: ramps re-set mid-glide.** A held voice or a duck re-set while a ramp was running lost that ramp, and
  offline the part already played went too. The partial ramp is laid again up to that moment.
- A recipe that uses none of the mixer or the held voices emits the same kernel and the same page, byte for byte.
- **A katana** (`families/blades.js`). Its swing is a stylized slash, light or heavy: an approach whoosh crossing the
  stereo field, a bright noise cut falling from the top of the band, the edge ringing (struck metal and a noise-excited
  plate), a spray of grit, a push of air underneath, and no held tone, which reads as a whistle. With a draw, a
  sheathe and a jostle at the hip (`katana-swing`, `katana-heavy-swing`, `katana-draw`, `katana-sheathe`,
  `katana-jostle`). A heavier cut is longer and darker.
- Nothing in a level reads the shelf by its words yet: the wiring comes next.
