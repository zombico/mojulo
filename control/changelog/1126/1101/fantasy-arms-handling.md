### Fantasy arms: truer proportions, hilts apart from ends, a held idle that clears the body

A sweep of the fantasy arms (every item in its styles, side and front three-quarter, through the workbench's own scene
so a barked shaft shows) found oversized crescent and winged guards on short blades, polearm heads too small for their
poles, pommels that outgrew their grips and a grip band floating off a grown staff. Equipment laws 2 fixes them and
separates what the hand holds from what does the work; the hero holds laws-2 gear without wearing it through the body.
Rows minted under laws 1 keep their bytes (their pins hold, now stamped). The eyes gate is the operator's.

- **Hilts and ends** (`control/lib/graph/equipment/compose.js`): `parts.hilt` (dagger, one-hand, hand-and-half,
  two-hand; wand, arm, long, pole) and `parts.end` (a blade of any outline, or any staff head), with `hiltLength` and
  `endLength` in cm. The item names are presets of the two, so a glaive, a longsword, a sword-hilted mace or a long axe
  is a word away. The staff's heads are now one function any hilt carries (`items.js staffHead`).
- **Laws 8–11** (`principles.js`): the grip counted in hands; the guard sized by its blade and its rise bounded by its
  span; the pommel balancing the blade within the grip's bounds; a head sized by its haft, a band and a collar on the
  shaft however it wanders.
- **Handling** (`control/lib/graph/polygonizer/hero-hold.js`): each laws-2 item (and every arm) is fitted in the hand
  so it clears the body's capsules at rest and through the poses it rides (a haft rolls out past the head, a blade or a
  gun turns off the thigh, a shield stands off the arm); the idle breathes through the weapon by its class and a haft
  stays upright by its wrist; every key of the stand, the idle and the walk is solved clear. The readout's
  `hero.gear.<slot>.clearance` says how near each item comes per clip.
- **A frozen copy of a held staff** (the World page, `scene-three.js`): a hero playing its clips hides its static solid,
  but the solid's textured faces (a barked staff, a printed board) kept no group tag and stayed, so a hero holding a
  barked staff stood beside a still copy of it. A previewed figure's hidden group now hides its textured faces too (a
  page with no textured face in that group is byte for byte as before). The live figure draws held gear in its colours,
  not its bark: a limit kept.
- **Review:** `scripts/render-arms.mjs` now draws through the workbench scene (textures included) and turns every
  hilted item flat to the camera.
