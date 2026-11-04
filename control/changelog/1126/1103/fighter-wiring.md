### Fighter wiring: the muscular body under the realistic head, a boxer's basic moves, and a bout

The seams between the studio's fighter pieces, stitched so a fighting game's character can be made from the hero door: a
body codename and its muscle shirt under the realistic head, its skin painted and its face rigged, dressed, throwing a
boxer's basic punches. The test fighter is `control/scripts/spikes/fighter/` (its spec and how to play it in hero-live).
Every hero naming none of the new words is the hero it was. The eyes gate is the operator's.

- **A body codename under another head** (`anime-bodies.js`, `layered.js`): `animeBody` (Toji, Mizuki, Satoru, Maki,
  Armstrong, Kale, Shonen High) is worn under the landmark or the realistic head on the lofted body, as under the anime
  head: its tune laid under the hero's own, `muscleShirt` its card. It is worn on the frame it was drawn on (the anime
  frame, `proportions: 'anime'` stamped at mint unless the spec names proportions), since its ratios on the hero cast's
  thicker baseline stood a tenth heavier, the forearm a club over a narrow wrist and a hand not sized to it; the head
  keeps the hero cast's size, and the stamp's fit is null (no anime style sizes it). The realistic body refuses a
  codename by name (its build is its physique); a blank head refuses it.
- **The realistic head on the lofted body**: `head: 'relational'` without `form: 'realistic'` is swapped in on the
  lofted body as it stands after the muscle shirt (`relationalHeadWorn`, the realistic body's own swap, refactored out),
  with its face words, its `skin`, its scalp, its face's hair and its piercings; its realistic laws stamped as `headLaws`.
  The lofted neck (a dozen slots) stood as a faceted post under the head, whose skin is joined to the neck's column, so
  it is densified first on its smooth cage at the muscle shirt's grain (`musculature/passes.js densify`). Its skin is
  painted in an export and on the World page, its face rig plays, and it is lit as the realistic body is (the gates in
  `world-kinds.js` read the realistic skin, not the form).
- **A boxer's arced punches** (`polygonizer/hero-box.js`, the door's `motion`): `hook` (the lead hand), `uppercut` (the
  rear) and `bodyHook`, each `…Left`, beside `jab` and `cross`. Each is one strike of space boxer (`hero-reach.js`) at a
  MARK on an opponent from the guard: his chin or his ribs on the line between the fighters at the attacker's own
  heights, as far ahead as a share of the striking arm's reach (aimed off the shoulder instead, a bladed guard's turned
  trunk put the uppercut beside the opponent's head). The knuckles are driven along the family's arc into contact and
  carried 6 cm through it (`follow`), at the hero's own strike speed, a move between keys as short as 12 ms (`step`):
  the drill's touch held on the target and its 40 ms floor capped a hand at 2 m/s, so the hook had landed at a seventh
  of the jab's speed; it lands at about 6 m/s now. `seconds` stretches the timing. Its laws are its checks on the clip as
  played: landed within 5 mm, the knuckles square to the approach, no servo past a stop, balanced over the feet, the hand
  at contact two thirds of its fastest over its drive, the guarding arm out of the trunk. `targetDrill` takes `aimed`
  targets (a direction or a point), `follow` and `step`; a seeded drill draws and times as before.
- **Blows taken in the guard** (`hero-react.js`): `guardHitHigh`, `guardHitBody`, `guardHitLow`, `guardStagger`, the same
  blows out of the `guard` stance's held pose and back to it (its feet, its sink, its fists), the blow's shoulders whole;
  the plain words start and end on the relaxed stand, so a fighter dropped its hands before the punch landed.
- **Blocks** (`hero-react.js`): `block` (the high guard absorbing a punch: the gloves driven back toward the face, the
  chin tucked, the body rocked back, the knees giving) and `blockBody` (the elbows dropped onto the ribs, the trunk
  curled over them), each a change over the hero's own guard and home to it, as the fight's block is; with the guard's
  blows, their laws `solid`, `planted`, `ends`. A bout plays a block where a punch lands on a glove or a forearm.
- **Two bodies kept apart** (`polygonizer/hero-pushbox.js`, a fighting game's pushbox in the round): each fighter's body
  as capsules on its skeleton (the trunk, the head, the thighs, the shins, the upper arms; never the forearms and the
  gloves, which are meant to meet), each radius read off its own skin, and the least one must be pushed back along the
  line so none passes into the other's. No imports, so a page or an engine's runtime loads it as it is. The bout gives
  the defender a knockback on contact (less on a block) and the pushbox's push on top, never coming back in (folding
  over the body hook, his head had gone into the attacker's shoulder).
- **The body kept solid under its arms** (`polygonizer/hero-solid.js`): a clip's arm is never let deeper into the trunk
  than the stance it starts from holds it; past that, its shoulder is turned the least that brings it back, frame by
  frame (curved on their own, a shoulder's angles took a flung arm through the chest: the operator saw it in a bout).
  Worn by the blows taken in the guard and the arced punches' guarding arm, each with the law `solid`. The arm's
  clearance and the solver moved to a leaf module (`hero-lm.js`, re-exported by `hero-grip.js`) so the motion library
  can load it.
- **The bout** (`control/scripts/spikes/fighter/bout.mjs`, `bout-shot.mjs`): two minted fighters' GLBs squared up on one
  page, each punch into the defender's reaction, the defender stepped in until the glove's travel into contact meets
  his skin, his block or his hit by what it lands on, the knockback and the pushbox through the exchange (`--push off`
  to compare); the read says what each punch lands on, the range, the height, the speed, the reaction and how far the
  bodies would have passed into each other. A second fighter's spec:
  `test-opponent.json`.
- **A character's own strikes in the fight** (`versus/versus-hero.js`, the versus roster's `moves`): a fighter who is a
  character (`{ hero: { ref }, moves: 'hero' }`, or `{ <slot>: a strike }`) throws the punches it was made with in the
  fight sim's slots (the boxer's: `stand.L` the jab, `stand.M` the cross, `stand.H` the hook, `crouch.M` the body hook,
  `crouch.H` the uppercut) and stands in its own guard. Each strike is solved on the character's rig where it is
  measured, its skeleton seen from the side in the fight plane and read back as the sim's own pose angles (a segment
  seen end-on, the hook's forearm crossing the body, filled from where it is seen), and carried as a track; the
  compiler (`compileHeroNormal`) RETIMES it to the slot's frame data, as a fighting game's animation is authored to its
  frames, and lays its boxes on the fighter's body (the hurtboxes, the fist's hit box on the active frames). In the sim
  its jab hits a standing opponent and is blocked by one holding back, at the advantage it records. A fighter's walk is
  its guard's, the legs striding. Without `moves`, every fighter is compiled as before. The frame-data sheet:
  `control/scripts/spikes/fighter/frames.mjs` (each move's key frames, its boxes and its frame data, the tradition's
  keyed move beside the character's own).
- **The real models in the arena** (`versus-character.js` `characterBody`, `versus-arena.client.js`): a fighter throwing
  its own strikes is drawn as it was made, not as the arena's stand-in (rigid parts in flat vertex colours posed from the
  plane, inked; a realistic skin came out white). Its body is PLAYED: one skinned mesh of its parts (their joints and
  weights), its painted skin over it (the atlas and each part's UVs), and its own clips (the strikes, the guard, the
  blows and blocks taken in it, the knockdown and the rise), solved on its rig from the door's motion words laid onto
  its record for the bake (the row is not changed). Each frame the sim's state names the clip and its moment: a move
  its own clip at the share its compiled frame records (`u`, the retiming's), a blow or a block through the stun, a
  knockdown, else the guard held. A fighter with the tradition's moves keeps the posed figure.
- **The ring: an arena that shows its fighters as they were made** (`versus-arena.js` `set: 'ring'`, ARENA_SETS): a
  boxing ring the arena builds on its floor (a raised canvas, its apron, four corner posts and their pads, the ropes on
  three sides, the camera's side open as a ring is shot) in a nave fallen into the dark (a veil behind the far ropes:
  the hall's surfaces are baked and take no fog), the fight's walls the ropes' and its floor the canvas, the camera in
  close (a fighter near two thirds of the picture). A fight made now opens in it, before the plaza and the nave.
- **Fighters lit as an engine lights them**: a played fighter's pack is the lit export's (its albedo unshaded, each
  corner's normal, the skin's relief and its full-size atlas, `lit`), drawn in a lit material under the fighters' own
  lights (a warm key, a cool fill, a rim, a sky; on the ring a spot over the canvas); the page's pack had baked a studio
  light into its colours and drawn it unlit, so the muscles read flat and the seams between its parts showed.
- **A fighting game with your own characters, by default** (the quick `fight` goal's `strikes`): a fight made now is
  stamped `strikes: 'own'`, so every fighter, a sheet the run makes into a character or one already made, throws its
  own punches (`moves: 'hero'` on its entry in the game's roster and each arena's) and is played in its own body;
  `strikes: 'tradition'` keeps the keyed moves, a fighter's own `moves` win, and a fight minted before carries none and
  fights as it did. The fight goal's card says it.
- **The fighter's body rail**: `lowerBody` keeps the `muscular` rail's anime codename under a hero spec that names the
  realistic head (that pair was refused before), and leaves it off the landmark head as before.
- **Seen, not fixed**: the realistic head's neck on the codename's frame is an ordinary man's (386 mm on Toji; the anime
  head's neck form gives Toji 449 mm); the `guard` stand's lead forearm sinks about 2 cm into Toji's chest (the mint's
  advisory names it); `jab` and `cross` (stored clips, a laws bump away) aim at the attacker's shoulder height and dig
  the guarding arm up to 6 cm deeper into the trunk than the guard holds it; the pushbox and the knockback live in the
  bout page and the module, not yet in a game's runtime (the versus arena keeps its own); in the fight, a character's
  own strikes pay no reach tax yet (the tradition's keyed jab is a frame slower) and its crouch slots' strikes are
  thrown standing (it is drawn standing in a crouch too); a move it has no clip of (a throw, a special) plays its
  strength's punch.
