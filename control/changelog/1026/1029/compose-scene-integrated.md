### Compose scene, integrated: a designed building stands in an outdoor map

A building the scene composer designs (a military base's barracks, armoury or comms building) seated on an outdoor
map and walked into on the same map, its windows open on the land and its rooms lit by the land's own sun. The look and
the placement first; no game in it yet.

- **A base's building on the land is composed** (`era/stage-buildings.js`): a base use on an outdoor stage's
  `buildings`, or any bay building given `look: { construction?, palette? }`, is built on its bay kit and composed as
  a building level is, so its rooms are stocked (`era/stocking.js`), its `tone` laid, its plan's `storeys`, `wings`,
  `loading` and `bays` its own, its program's own ways out kept beside the front. Entered by its door, its inside is
  composed too (`gameworld/levels.js` `interiorStage`). Every other building is laid as it was.
- **Its windows open on the land**: the shell is cut at each glazed opening, with a reveal across to the room's wall,
  where the room on its own stood a painted sky card; the land shows through the glass and the open door. The land's
  sun at its hour lays the windows' sun patches (`_sun`, turned into the plan's frame); a sky with no sun (a dusk under
  its moon, a night) lays none, and its day dims the daylight at the windows.
- **It wears its construction outside** (`era/style/bay-exterior.js`): corrugated sheeting under a low standing-seam
  roof (military), board-formed concrete to a parapet (the bunker), painted block (utility), sheet panels (science)
  or a floated coat (everyday), coloured by the palette unless the material keeps its own; a flat roof behind a
  parapet; a wall rising over a lower room's roof where they meet.
- **A yard before its front** (8 m) is kept clear of what grows; a building that finds no place clear of the trail's
  beats, the stage's edge and the other buildings says so.
- **The game-building card** says it; `scripts/spikes/outpost/outpost.mjs` captures one on a cube's trail at each
  hour, from the approach, wide, the yard and inside looking out.
- **A building set into its slope** (`embed: true | { up }` on an outdoor stage's building): its way in a walkout on the
  low land, a door out of its upper storey's back onto the high land behind (a way out of an upper storey is allowed
  now: `stage.js` `ways`, each storey taking its own), placed where the land falls most nearly a storey across it,
  every way round, clear of the trail, its landmark and the stage's edge with room to walk round it. The land is graded
  to it (`era/grade.js`: pads and ramps on a trail's grid, laid before anything grows, the walk kept; each eases out
  over its own fall) and the building stands where the first pass placed it. Beside it a concrete stair between cheek
  walls climbs the land (`era/outdoor-stair.js`), its other side a bank; paths of slabs run from the trail to the
  walkout, to the stair and on to the upper door, no grass through them; no window is laid under the land
  (`bay.js`, the land against its walls). Inside, its own stairs join its two doors. The anchor's `embed` says its
  doors, its stair, the way `through` and the way `round`; a finding says how far the land was cut and filled.
- **Room on a trail's ground** (`trail.ground.room`, 0 to 80 m): open ground past the trail's far side, the site that much
  wider and the trail where it was; a coast takes none.
- **A composed building stands inside the bounds' walls**, not wholly past one (any building only checked crossing a wall).
- **The outpost spike** takes `--embed` and `--trail`, and shoots a set-in building from the low yard, the high ground,
  the stair's foot and along its bank.
