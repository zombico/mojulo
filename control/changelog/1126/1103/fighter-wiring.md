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
- **The fighter's body rail**: `lowerBody` keeps the `muscular` rail's anime codename under a hero spec that names the
  realistic head (that pair was refused before), and leaves it off the landmark head as before.
- **Seen, not fixed**: the realistic head's neck on the codename's frame is an ordinary man's (386 mm on Toji; the anime
  head's neck form gives Toji 449 mm); the `guard` stand's lead forearm sinks about 2 cm into Toji's chest (the mint's
  advisory names it); `jab` and `cross` (stored clips, a laws bump away) aim at the attacker's shoulder height and dig
  the guarding arm up to 6 cm deeper into the trunk than the guard holds it; the pushbox and the knockback live in the
  bout page and the module, not yet in a game's runtime (the versus arena keeps its own).
