### A walked map's hero climbs only what it means to: never a tree, never the map's edge, never by walking

- **Fixed: the hero rode up trees and walls as it walked.** A hero with the wall move (`actions.moves: ['wall']`, the
  city stalker's, worlds/controllable/wall.js) takes hold of any collider face at least 1 m wide and taller than it,
  pressed into from the ground. On a glyph map that was a broad tree's trunk (its collider past the wall's `minFace`,
  mantled onto its 3.5 m top into the crown), a house's wall and the map's own invisible walls. Driven headless on The
  Old Keep's town page, walking only: a 1 m trunk climbed from three sides of four, up to 6.6 m; houses and the zone's
  walls up to 9 m.
- **A map's edge is not a wall to climb.** A glyph map's edge walls, a zone's walls and its apron's are `hold: false`
  (level/grid-scene.js), as a city level's edge is.
- **Nor is a tree.** A solid tile's trunks are `hold: false` (era/isekai.js), slim or broad; a boulder is still held, a
  rock climbed.
- **An action hero climbs from a jump.** The orbit camera's hero with a blow (gameworld/levels.js `actionWall`) takes
  hold of a wall only from a jump (the wall's `ground: false`): walking into a house stops at it, a jump at it climbs.
  `ground: false` now means what it says, a leap since the body last stood (its own, or off a wall): a step off a lip
  beside a face, a frame in the air, no longer takes hold of it. The city stalker's wall, taken from the ground, is as it
  was. Measured on the same page and the same 70 walked approaches: 16 took hold of a wall before, none after.
