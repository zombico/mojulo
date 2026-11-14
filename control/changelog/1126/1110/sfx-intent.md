### The SFX shelf by intent, and a game's sounds solved from the game

- **Mouth foley's bodies join the shelf** (`sets/mouth.js`, traced by `scripts/mouth-foley/bake.mjs`). A new
  renderer (`scripts/mouth-foley/body.py`) builds a sound from syllables cut once, then held, layered or struck
  under ~150 ms. It renders the takes the operator passed by ear sample for sample. Eighteen new rows in its first
  round, all voiced only by the mouth:
  - creatures (a new category, `creature`): `growl`, `snarl`, and `roar-lion`, `roar-bear`, `roar-monster` (a
    first vowel opening into A, rising; the monster's I starts high and ends higher);
  - martial arts: `staff-swing`, `staff-twirl` ("whop whop"), `nunchaku`;
  - the ch sounds: `sword-guard` チャキッ, `latch` カチャ, `armour-clank` ガチャ, `spark` パチッ,
    `electric-crackle` バチバチ, `drip` ピチャ, `scissors` チョキン, `ticking` カチカチ;
  - `wade` バシャッ and `fire-crackle` パチパチ.

  The mouth also voices five rows already on the shelf: `step-grass`, `punch`, `kick`, `ricochet` and `coin-drop`.
  A second round adds:
  - new rows: `slide`, `stab`, `shuriken`, `sparkle`, `eat`, and two short lion roars (`roar-lion-short`,
    `roar-lion-rough`);
  - a mouth voice for `jump`, `bounce-pad`, `land`, `dodge`, `hit`, `uppercut`, `down`, `katana-draw`,
    `katana-sheathe`, `blade-clash`, `arrow-hit` and `potion-drink`.
  A third round adds:
  - new rows: `power-up-rings`, `power-up-glass`, `bubbles`, `bubbling`, `button`, `rattle`, `bucket-splash` and
    `horse-neigh`;
  - a mouth voice for `power-up`, `door-creak`, `lever`, `wood-impact` and `metal-impact`;
  - the giant monster's roar, now traced as air: one voiced trace carries one pitch and lost the screech.

  A whistle is stored as its cue, the kernel's own tones, with nothing traced: `bird-chirp`, `sparrow`, `bird-trill`
  and `bird-warble`. `step-wood` and `step-metal` gain a heel-and-toe mouth voice. Each ring is placed from the
  trace's onset, not its time in the file, so a ring sounds with its click (it had sounded about 0.1 s late). A
  `tone`'s `to` takes Hz, as `hz` does. `dog-bark` and `cat-hiss` are two bird calls the operator heard as those.
  `traceSound` takes `maxHz`, the highest pitch it looks for a hum at (500 by default, a voice's, so every existing
  trace is unchanged). A recipe raises it for a bird's buzz, which as air traced as band noise and sounded like
  sandpaper.
  A ring is never traced, since the tracer would hear it as hiss. The bake traces the dry part and strikes each ring
  with the kernel's own `ring` gesture, at its modes, time, level and length. The round 5 traces are byte for byte
  as they were.
- **Searchable by intent** (`sfx-shelf/facets.js`, `sfx-shelf/find.js`):
  - **Facets:** what a sound is made of (`matter`), how big it is (`weight`) and which games use it (`genres`, the
    cosmos genre ids). Each is set once on a family, read off the dials a row is built at, or written on a row
    where neither says it.
  - **Sound words:** a row's `say` holds its onomatopoeia, in kana with romaji and in English, so カチャ, kacha and
    clink each find their sound.
  - **`findSounds`** ranks by words and filters by facets. A word that names two things is read by the rest of the
    phrase: "a crackling fire" is the fire, and "fire" alone is still the shot.
  - **`solveSound`** sets a family's dials from the words: "heavy footsteps on gravel" is `step-gravel` at
    `body: heavy`.
  - **`suggestSounds`** gives the shelf's rows as a refusal's tail.
  - Ties go to the newest voices.
- **The sound sheet** (`gameworld/sound-sheet.js`, the game book's new `sound` chapter in the play department). A
  game's sounds are solved from what the game is:
  - its first weapon by its words (a staff's `staff-swing`, nunchaku, a katana's swing, a blade's, a fist's);
  - its level's ground (grass on a nature or jungle stage);
  - its beasts' voices by species (a wolf's `snarl` when it spots the hero);
  - a door's `latch`.

  The newest voices come first: the sheet's style is `mouth` unless the game says otherwise, so a sound the mouth
  doesn't voice plays realistic. A game overrides any of it with `sound: { style?, slots?, on? }`, each a shelf word.
  A quick game hears it with `sfx: 'sheet'`. `beats-world.js` voices `sfx: { sheet }`, wiring the level's mechanics'
  events as `auto` wires a palette. `auto` and the palettes are unchanged, so every game made before this sounds as
  it did.
- **A bird's call in the kernel** (feature `syrinx`, opt-in, absent from a page that uses none). A `syrinx` gesture
  synthesizes a call whole: a sawtooth on a pitch path, its period jittered, an octave under it for a caw's
  harshness, a rattle, and a breath of noise, through the bird's moving resonances (`beats-sfx` manual). A tonal
  call traced through the vocoder sounded like sandpaper or a trumpet; this one is played as it was built. The birds on the shelf are syrinx cues: `crow`, `raven`,
  `eagle`, `goose`, `geese`, `duck` and `chicken`. A game's sound sheet voices a fielded animal by its species (a
  dog barks, a horse neighs, a crow caws, a snake rattles). What a game's environments need most:
  - footsteps on gravel, snow, dirt, sand, mud, a puddle and dry leaves;
  - a raindrop, thunder near and far;
  - a cricket, a frog, an owl and a fly;
  - a siren.

  A sound sheet reads a stage kit's ground from its name (a snowy stage walks on snow).
- **Played as a performer plays them.**
  - **Per-hit variation reaches traces and the syrinx.** Each hit's noise, bands, hum, pace and level move a
    little, seeded per hit, so a combo or a walk never repeats one sound. An older page's kernel is unchanged.
  - **Beds** (`sfx-shelf/beds.js`): rain, night, forest, cave, swamp and farm, as patterns of the shelf's one-shots.
    Every hit is a variant, and so is every loop pass.
  - **One breath across a sheet game's hits** (`audio.breath`): a fast combo lightens and a rest refills it. A level
    without a sheet carries none of it.
  - **The firing range and the practice rooms vary every shot and swing** for a game on the sound sheet, or one whose
    `sound.vary` says so: a sword combo, a burst of fire, a beam rifle's shots. A game made before is unchanged.
  - **A level plays its environment's bed under its score** (`audio.bed`, on its own engine). A game on the sound
    sheet lays one from its stage, by the stage kit's name, its weather and its hour: rain, a cave, a swamp, a farm,
    night, a forest.
- **The voice protoform** (`families/voice.js`): a person's efforts composed for any voice from its dials (body,
  sex, age, rough, breathy), never recorded voice by voice. A glottal buzz goes through the vocal tract's formants,
  scaled by its length, with its breath through the same tract. Rows: a jump's hup, a grunt on a hit, a heavy hit's
  cry, a landing's oof, an attack's shout and a strain. The kernel's `syrinx` takes `buzz` (0: breath alone, a pressed
  effort's hiss).
