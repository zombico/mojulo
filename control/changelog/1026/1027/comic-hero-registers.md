### The comic hero pack in three registers: anime, DCAU, realistic

The pack's look dial (`cosmos/packs/comic-hero/looks.js`) is three registers, each with its own light, in place of the
comic page, the painted cover and the film. The world and the hero take the same one. The eyes gate is the operator's.

- **anime** (`anime-day`): the isekai shell's own light (era/isekai.js). Every colour sits on its ramp; rock and cliff
  are drawn lit or in shade by tile per facet; the grass wears hats; the sky is painted. The cube's outside has no
  polygon land (`outside.land: false`), which drew over all of it: a geocube on the isekai shell with the land on reads
  as flat green ground and bare boulders. A lilac stone and a sand ground, so the grass and the sky carry the hue. Not
  the `cel` register: the anime look is not inked. Its hero direction is the anime tradition (the anime head under its
  character light). Its QA level is a field's trail, since the city kind lights itself and never draws the isekai bake
  (`qaLevel`).
- **dcau** (`dcau-golden`): the gritty look at golden hour, after the operator's reference (a seventh-generation
  western at sunset). A low warm sun behind lit cloud (the `desert-dusk` reference's key), the figures backlit against
  the brightest thing in the frame, dusty ground drawn from relief (`grit` 0.8, `contrast: 'wii'`), a warm haze that
  sinks the distance (`outsideFog` 1.4). The light is baked (gen-6). The colours are the theorist's: rust and ochre lit
  warm, the stone and the shade a cool teal against them, colour where it looks good. The hero is the tiered body.
- **realistic** (`realistic-night`): the seventh generation (`era: 'gen-7'` on the cube), the realistic body. Parked:
  at night there is no sun, so gen-7 draws a night city as gen-6 until its lamps cast live.
- The costume eras tie to the new stops (`ERA_OF_STOP`: anime and dcau the Silver Age's primaries, realistic the
  Movie Hero). Each cube names a look on the new dial, and the resonance laws advise the new stops (`bursts-want-drawn`,
  `night-wants-backlight`).
- **The characters take their stop's light** (`characters.js` `registerOf`, the grunts alike):
  - At the anime stop the sheet is rolled in the anime setting (`egocube/setting.js`, a rule that moves no facet's
    dice), so the egocube's own compiler reads it onto the anime head: its hair families, its expression amounts, anime
    proportions. The hero carries no cube, since a cube on a hero replaces the anime head's character light with its
    cast light.
  - A grunt's cut is drawn in the anime family of its class (`animeHair`: a bun or a braid the hime cut, a crop
    short, a fall long).
  - An armour on the anime head goes bareheaded (`helm: 'none'`), as the egocube's armour looks do: no helm is fitted
    to that head, and the door refused the mastermind's faceplate.
  - At the dcau stop the hero wears the look's cube (`spec.geocube`, the look's `bake`), so it is baked in the same
    golden-hour light as its world, its rim included.
  - The realistic stop is as it was.
- **A cube's rim** (`era/geocube.js` `light.rim`: `{ strength?, power? }`): the cast's rim in the cube's own sky (its
  written or solved horizon, the sky the page draws behind the figure) at its strength and falloff, in place of the
  reference dome's horizon at 0.45 / 3 (`era/cast-light.js`). Drawn by the rig preview's fresnel patch. `dcau-golden`
  wears 0.9 / 2.5, enough to hold a backlit figure's outline: a near-black suit keeps its form against the sky. A cube
  with no rim word wears the rim it did, byte for byte.
- Found and not fixed:
  - A night reference pins a solved cube's sky to its own dark dome (`geocube.js` solveInto), so a night cube's sky is
    always near-black.
  - The micro-town's houses paint at day value under a night sky.
  - The gritty city dress lays its materials' own pale concrete over the cube's value, so a sidewalk stays pale at night.
  - The city's signs burn in the city's own pink, not the cube's accent.
  - The cast light reads no hour: a hero is baked at its cube's reference light whatever hour its level is lit at.
