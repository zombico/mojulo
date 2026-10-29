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
