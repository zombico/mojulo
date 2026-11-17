### Tall grass: cover a body hides in

- **A geocube's tall grass** (`tallGrass: { patches: [{ at, r, h? }], elsewhere?: 'none' | 'grass' }`, form/tall-grass.js):
  grass in tight clumps only where the level lays it, standing to its height (1.2 m), drawn at every distance; no blades
  anywhere else, so a gen-7 land keeps its look at a fraction of the grass's cost.
- **It hides** (worlds/controllable/veil.js, an opt-in runtime module; the engine hands minds a world's `veils`): each patch is a VEIL, a column of grass a watcher's
  sight reads. A line from a watcher's eye to a body's that runs `through` metres (1.2) of grass under its top does not
  see it, so a body crouched or lying in a patch, or low behind one, is unseen; standing, its eye is over the grass; within
  `near` (2 m) it is seen whatever; a lookout on a tower looks down into the grass and sees a crouch, not one lying flat.
  The world carries `veils`; the minds' `perceive` asks them.
- **The route search reads them too** (gameworld/stealth-routes.js `place.veils`), so a sneak's level is proved with its
  grass.
- **It stands where it grows.** The land read says how each patch stands (its share of level green ground, where its
  grass grows, and that ground's height); the veil stands on that ground, and a patch with under half of it grown is no
  veil, so the page never hides a body where it shows no grass.
- **Level 0 laid with it** (the spike's `level0.json` `grass`): a practice patch by the trail with its hint, a belt
  along the checkpoint truck's south face and behind it, and one down the camp's west side; no grass anywhere else. The
  checkpoint's second way now crouches through the grass at the truck. The build says each patch's share of level
  ground, and the plan draws the land's relief (a bank's cells lit and shaded) so a patch is not laid on one.
- **The geocube card** (`sketch-vocab/geocube.md`) teaches `tallGrass`.
- **Thinner**: the stand's clumps set 0.336 m apart, not 0.26 (three fifths as many a square metre).
- **A road whose rocks are drawn** (a geocube's `path.rubble: 'parallax'`, era/trail-dress.js): no stone stood up on the
  trail or its verge (none strewn by the stage, none of the form render's, its scree's kept off it too:
  form/land-stones.js `offTrail`); its pebbles marched in the ground's parallax instead, in clusters over a third of it
  (form/land-read.js ROAD_PEBBLES), the verge's scree texture lighter. Level 0's trail is laid so.
