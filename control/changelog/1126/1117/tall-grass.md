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
- **A lean ground** (a geocube page's `parallax: false`, channels/form-land.js): none of the ground's height marched near
  the eye (the scree's, the clay's, the undergrowth's and the rock's parallax, the procedural pebbles' and cracks'), the
  pebbles and cracks on the trail alone. Measured by hiding each kind of thing on level 0's page in turn, the ground was
  over half its frame (the jungle a tenth); lean, the frame fell about a fifth. Absent, every byte as it was.
- **A page's pixel density** (a geocube page's `density`, 0.75 to 2): the pixel budget's cap, 1.5 unless said (the same
  bytes). Level 0 asks for 1, so its full window on a high-DPI screen shades fewer pixels than a boxed page at 1.5.
- **Level 0 on open ground**: the jungle haze's look over the upland's flora (lone trees, short grass) with no cliff walling
  the trail, so the land is a field both sides and every patch of tall grass stands wholly on level ground. Its laws hold;
  the checkpoint's first unseen way now crouches through the truck's grass.
- **The spike's bench** (scripts/spikes/mission/bench.mjs): pages timed side by side in headless Chromium at one window
  and one density, a relative yardstick. Hangar 229 ms a frame; level 0 as it was 283, open and lean 199.
- **Tall grass among a field's grass** (`tallGrass.elsewhere: 'grass'`): the patches the tall sward and the stand, the land's
  own grass round them the short sward, thinned (six bristles a cell, no dark twin: form/tall-grass.js `fieldOf`), so grass
  that hides nothing is never drawn as grass that does. Until now the field took the stand's clump at every distance.
- **Level 0's checkpoint a line** across the whole field (wire to both edges, sandbags and a gate on the trail, the tower,
  the truck on the line) with two ways through besides the gate: the slot by the truck, screened by grass both sides and
  in it, and a cut in the west wire behind its grass, the line's patrol walking past it. All eight laws hold. The field's
  grass back, real out to 10 m (the view cone), painted past it: bench 246 ms a frame against the hangar's 236.
- **A lean ground keeps its cliffs plain** (`parallax: false`): no relief cut into a cliff's faces (each steep triangle
  was cut into 36) and a third of its scree's stones stood up (form/land-read.js `stones`, a share of them). Benched at a
  quarter of the window, a cliff's cost was its geometry more than its pixels.
- **Level 0 boxed in a gorge** (the spike's `gorge`: a cliff face down each side of the field, 14 m, the high side out,
  as the trail's ground edits): the field between them as it was, every law holding. Bench: hangar 231 ms a frame, the
  open field 237, the gorge 248 (with relief and the full scree it was 345).
- **The bench** opens each page in a browser of its own (one opened after another ran slower) and counts draws only
  after the frames are timed.
- **Level 0 cut again** (the spike's `performance`): its real grass out to 6 m, not 10 (painted past it), and its pixel
  density 0.85. Bench, each page its own density (`bench.mjs --dpr page`, new): 219 ms a frame as it was, 195 now; the
  hangar 259 on the same run. The live light off was tried and bought nothing (its bodies cast blob shadows, so the map
  draws next to nothing). The opening view side by side reads the same. `level0.mjs --perf '{…}'` tries a setting over
  the recipe's without editing it.
- **Grass is cover, and only cover** (a geocube's `tallGrass.elsewhere: 'paint'`, form/tall-grass.js): the land's own grass
  kept as its colour on the ground from the eye out (the far field's blanket brought to the feet, channels/far-field.js;
  the short sward's tier built no blade, channels/form-grass.js), so the field reads as grass and only the patches, the
  cover, stand. Level 0 laid so: no short grass anywhere (`none` left the field bare earth, dark under where the blades
  had been).
- **Far figures** (a geocube level's `farFigures: { at?, budget? }`, worlds/world-scene.js, controllable/merged-figure.js
  `farFigureScript`): each body no player pilots baked a second time coarse (figures/figure-lod.js `loose`: welded by
  position alone, no edge locked, so a dressed figure's seams and hems no longer hold it: the guard 39070 triangles to
  4498) and drawn past `at` metres from the eye (24; two metres' grace back), the same bones posed each frame, shown only
  while its body is. Level 0 asks for it, and its haze drawn in (visibility 180 m, clear 30) so the far land and what
  stands on it fade and the far flora is culled. Bench, all at one density: 199 ms a frame (the last cut) to 176, its
  triangles 0.95M to 0.60M; in play the six guards past 24 m are drawn at 4498 each.
- **Level 0's middle** (after level 1 was measured beside it: the yard 372 ms a frame, the hangar 251, level 0 171): what
  the cut had overdone given back where it shows. The gorge's walls rock again (a geocube's `parallax: 'cliffs'`: the
  ground lean, its rock kept: the fractured plates over it, `wK2`, the blocks a wall reads by; the rock's own march near
  the eye; its cliffs' relief at a 3 x 3 cut, not 6 x 6, a quarter of its triangles: channels/form-land.js,
  worlds/world-scene.js). Found by elimination: the relief alone at any cut and the march alone left the walls plaster;
  the plates are the look. The operative's own live shadow, every guard a pool at its feet (a page's
  `shadows.actors: 'pilot'`: scene/live-light.js, controllable/index.js `__pilotCasts`, suit-shadows.js `others`).
  Density 1; the haze out to 250 m, the base seen at the trail's end. Bench at one density: 247 ms a frame (172 lean,
  264 with the whole ground's relief), the hangar 265.
- **The bench corrected** (scripts/spikes/mission/bench.mjs): a page runs several animation loops (the game's, its
  HUD's, its readouts'), each called with the frame's one timestamp, and the bench counted every call a frame, so every
  page read faster than it ran and a page with more loops faster still. Frames are now counted by their distinct
  timestamps. Read again at one density: the hangar 2.66 s a frame in software, level 0 lean 3.67, the yard 4.61, level 0
  as committed 6.17 (the middle above read 247 ms against the hangar's 265: wrong). Taken apart, the ground's material is
  about three quarters of level 0's frame; the plates and the rock's march about a twentieth; the live shadows' passes,
  the figures' light and the grass next to nothing.
- **Layers** (scripts/spikes/mission/layers.mjs): a built page with a panel that takes it apart on the machine it is played
  on: each layer of the scene on or off (the ground, the grass, stones and plants, trees and far sheets, structures,
  characters, the rest, each with its triangles), the ground as plain paint, the live shadows' passes, the haze, the HUD,
  the pixel density, and a frame readout that counts each frame once; a line to copy back. The level is not changed.
- **What made level 0 slow was its rays, not its pixels** (channels/controllable/index.js): with every layer of the page
  off (the layers panel, played on the person's own machine) it still ran at 8 frames a second. Profiled, seven tenths of
  its time was rays tested against triangles: the ground probe under each walker every frame, the camera's pull-in.
  The ground grid (ground-grid.js, a straight-down ray testing only the cells it crosses) indexed the big static meshes
  once, at the first probe, before the gen-7 land was built, so the land the walkers stand on (43k and 32k triangles)
  took three's own raycast, every triangle, every probe; it now indexes again whenever the scene's top changes and every
  120 probes (ray time over eight seconds 242 ms to 27). And every ray through the world leaves the bodies out
  (`__rayRoots`), whose hits each threw away after testing their every triangle, a skinned body's posed by its bones
  first. What each ray finds is as it was.
- **What a frame costs, by side** (`window.__mojCost`, channels/controllable/index.js, scene-three.js's frame loop): a page
  with controllable bodies keeps the game's logic a frame (its step), its rays alone (the ground probe, the camera's) and
  the render call's own time, each a running mean; the spike's corner readout, the layers panel and the bench say them
  (a level slow with nothing drawn is its logic, not its looks). And each big mesh a ray tested triangle by triangle, by
  name (`slow`: the grid's slow path, only where a ray reached the mesh).
- **The ray budget, guarded** (controllable/ray-budget.chrome.test.js, the e2e tier): a walker on a gen-7 land in headless
  Chrome; no ray may test a big mesh triangle by triangle. With the grid indexed once, as before, it names the land's two
  meshes and fails.
- **The ground's index** (channels/controllable/ground-index.js): the ground probe under each walker reads the surfaces over
  its own 4 m cell and tests those alone (a big static one through its own triangle grid), never a ray through the whole
  scene. Every mesh a world ray would test is baked into the index with the grid, and again when the scene's surfaces
  change; one wider than the index (a far land's ring) is in every cell; a surface that moves after the bake is noticed
  once a frame and tested wherever it stands. What it finds is what the full-scene ray found (tested point by point
  against it in three: a floor on its grid, a deck by a transform, instanced steps, a decoration that is no footing, a
  body, a far plane, the deck moved).
