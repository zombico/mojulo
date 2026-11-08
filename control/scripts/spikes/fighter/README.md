# The test fighter

A fighting game's character from the hero door alone: the Toji muscular body (the `toji` codename and its muscle
shirt, on the anime frame it was drawn on), the realistic head (`head: 'relational'`, its rolled face, its skin painted
in the export), boxing trunks, gloves and boxing shoes, standing in the guard and throwing a boxer's basic punches
(`jab`, `cross` from hero-strike; `hook`, `uppercut`, `bodyHook` from hero-box, space boxer's strikes at an opponent's
chin and ribs) and taking a blow (`hitHigh`).

`test-fighter.json` is the spec, the door's own words. Play it as an engine gets it (the skinned GLB, every clip, the
face's morphs) under the viewer's key, fill and rim lights with shadows:

```bash
node .claude/skills/hero-live/live.mjs --hero "$(cat control/scripts/spikes/fighter/test-fighter.json)" --clips none --out /tmp/fighter
node .claude/skills/hero-live/live.mjs --out /tmp/fighter --reuse --serve      # http://127.0.0.1:8765/
# the punches at contact, side on (a punch's contact is its clip's `moj:move` contact over its seconds)
node .claude/skills/hero-live/shot.mjs --out /tmp/fighter \
     --shots '[{"variant":"bare","take":"jab","look":{"az":80,"el":5,"dist":3.4},"phase":0.44},{"variant":"bare","take":"hook","look":{"az":-30,"el":10,"dist":3.4},"phase":0.48}]'
```

A mint takes about two minutes (the realistic head and its face rig). The body alone, in its sections and girths:

```bash
node .claude/skills/body-study/body.mjs male --hero '{"head":"relational","animeBody":"toji","muscleShirt":{"definition":1},"face":{"seed":7}}' --crop arm
```

The machine gate is each punch's own (`heroBox(...).checks.laws`: landed within 5 mm, the knuckles square to the
approach, no servo past a stop, balanced) and the mint's warnings; the eyes gate is the operator's.

## Against each other: the bout

`test-opponent.json` is a second fighter (Satoru, the slim codename, another face, blue trunks) who takes blows in his
guard (`guardHitHigh`, `guardHitBody`, …). `bout.mjs` squares the two GLBs up on one page; each exchange is one of the
attacker's punches into the defender's reaction, the defender stepped in until the glove's travel into contact meets
the first of his skin (his guard included), holding his stand until then and reacting from that frame. `bout-shot.mjs`
prints what each punch lands on, the range, the glove off his head's height and its speed, and shoots a sheet.

```bash
node .claude/skills/hero-live/live.mjs --hero "$(cat control/scripts/spikes/fighter/test-opponent.json)" --clips none --out /tmp/opponent
node control/scripts/spikes/fighter/bout.mjs --a /tmp/fighter/bare.glb --b /tmp/opponent/bare.glb --out /tmp/bout --serve
node control/scripts/spikes/fighter/bout-shot.mjs --out /tmp/bout --views side,close --at '[-0.06,0,0.05,0.2]'
```

A punch that lands on his glove or forearm plays his `block`, one on his body his hit (`guardHitBody`). He gives a
knockback on contact, and the pushbox (`lib/graph/polygonizer/hero-pushbox.js`: capsules on each skeleton, the forearms
and the gloves left out) pushes him back as far again as keeps the two bodies apart, never letting him back in;
`bout-shot.mjs --push off` shoots the knockback alone. What it reads today: every head punch blocked on his gloves,
the body hook clean on his chest; the uppercut's bodies would pass 4 cm into each other, the body hook's 2 cm.

## Gameplay recordings

- `gameplay.mjs`: the versus game's own page (the fight drawn flat, stick figures), the two characters fighting with
  their own strikes (`moves: 'hero'`), CPU against CPU, recorded to an MP4 and a GIF (`--boxes` shows the boxes).
- `arena-gameplay.mjs`: the same fight on a 3D arena (a stage set's World page), the characters minted through the hero
  door into a scratch store; the arena hosted by a small page that sends it the picks, CPU against CPU. The page runs
  on a virtual clock the script steps a sixtieth of a second at a time, each other frame read from its canvases, so
  the video plays at the game's own pace whatever the rendering costs. A character throwing its own strikes is drawn as
  it was made: its skinned, painted, lit body, played from its own clips by the fight's state; one fighting with a
  tradition's moves (`--moves tradition --ta karate --tb kung-fu`, with `test-karate.json` and `test-kungfu.json`) is
  its own body posed by the fight, segment by segment. `--cpu regular` sets the CPUs' level. `--set ring` puts the
  fight in the ring (the default arena of a fight made now); `--reemit` rebuilds the page from the run's baked scene
  after a change to the arena's own code, without minting or baking again.

## Every style in the arena

`styles.mjs` puts a body of every art style a game can pick into the arena: one new character per style, each made
from the body rails (`gameworld/game-bodies.js`: `gameBody` → `lowerBody`, the words a game's style lays on a hero),
minted into a scratch store, paired into matchups on greybox fight levels (a different preset each: flat, turned,
rooftop, alley), CPU against CPU. The cases: the anime frame (Toji muscled, Kale), the realistic head on the Saikyo
body (a boxer throwing its own punches), the realistic body, comic ink, Shonen High, the chibi and the lowpoly mascot.

```bash
node control/scripts/spikes/fighter/styles.mjs --out /tmp/fighter-styles          # mint, bake, play, read, shoot
node control/scripts/spikes/fighter/styles.mjs --out /tmp/fighter-styles --reuse  # re-shoot, the characters and arenas kept
node control/scripts/spikes/fighter/styles.mjs --out /tmp/fighter-styles --reuse --level training  # every matchup on the training ground
```

Each body's top is its roster colour, so a matchup's two sides read apart.

The machine read (`report.json`, advisory): each body bakes and plays without a page error, stands on the lane's floor
and on its line (its posed mesh's bounds against the lane), and what it weighs in the page (triangles, megabytes). The
eyes gate is the operator's: `sheet.png`, two moments of each matchup.

## Weapons: usable, and where the blade is a hurtbox

`weapons.mjs` arms one all-rounder with each weapon on the shelf (`versus-library.js` WEAPONS) and reads it in the sim,
no page: how far the grip hand's standing normal lands armed and bare; its armed hits in a CPU match; whether two blades
clash; on which frames the blade adds a hurtbox (each armed move against the same fighter compiled with `hurt: 'none'`,
by startup, active and recovery, and the idle stances against the bare fighter's); and the sim's own answer, a jab into
a whiffed armed swing as it recovers, at each distance, where only the blade could have been hit. It also reads off the
arena client which of its bodies draw the blade.

```bash
node control/scripts/spikes/fighter/weapons.mjs --out /tmp/fighter-weapons
```

What it reads today: every weapon is usable (the sword's jab lands to 1.85 m, the bare jab to 1.13 m) and blades
clash. A held blade adds nothing at rest, and none in startup or active frames, except the staff (`hurt: 'always'`).
Every other weapon's default is `hurt: 'recovery'`, so its blade is a hurtbox through the whole of a swing's recovery,
whiff or not: a jab can land on the blade alone (the sword's, from 1.68 to 2.33 m). `hurt: 'none'` takes the blade
out. The 3D arena draws the blade only on the stick figure: a character's own body, posed or played, holds none.

## Joints and the body's own parts

`joints.mjs` poses every frame of every move of a fighter of each archetype in each tradition, the stances and the
reactions, in the round (`versus-figure.js` figurePose on the sim's own skeleton), and reads each bend against its limit
(the elbow's and the knee's fold, the spine's twist, the neck, the ankle in its hinge's plane, how far an arm reaches
behind the back: `FIG_LIMITS`, `RIG_LIMITS`) and how deep each pair of the body's own parts passes into each other
(the trunk an ellipse, the head, the limbs capsules: `FIG_BULK`). Pure, no browser; a few seconds.

```bash
node control/scripts/spikes/fighter/joints.mjs --out /tmp/fighter-joints
```

What it reads today, over about 29,600 poses: no elbow past 150°, no knee past 155°, no ankle past its range, no arm
further than 60° behind the back, the spine twisted no further than 60° (to the degree its turns are whole); the
forearms out of the trunk and the head, the legs out of each other. What is left: an arm hanging straight beside a
raised knee in a few crouching kicks (its hand cannot move in depth, nor the chest turn enough to free it: about one
pose in a hundred and fifty), and two forearms crossing by a few millimetres more than the skin allows.
