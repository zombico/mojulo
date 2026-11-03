### Fighter wiring: the muscular body under the realistic head, and a boxer's basic moves

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
  rear) and `bodyHook`, each `…Left`, beside `jab` and `cross`. Each is one strike of space boxer (`hero-reach.js`) at its
  own target from the guard: an opponent's chin or ribs placed in the striking shoulder's terms, so a longer arm hooks a
  farther chin; the knuckles driven along the family's arc into contact and recovered to the guard, timed by the servos;
  `seconds` stretches the timing. Its laws are its checks on the clip as played (landed within 5 mm, the knuckles square
  to the approach, no servo past a stop, balanced over the feet). `targetDrill` takes `aimed` targets in place of the
  seeded draws; a seeded drill draws as before.
- **The fighter's body rail**: `lowerBody` keeps the `muscular` rail's anime codename under a hero spec that names the
  realistic head (that pair was refused before), and leaves it off the landmark head as before.
- **Seen, not fixed**: the realistic head's neck on the codename's frame is an ordinary man's (386 mm on Toji; the anime
  head's neck form gives Toji 449 mm), and the `guard` stand's lead forearm sinks about 2 cm into Toji's chest (the
  mint's advisory names it).
