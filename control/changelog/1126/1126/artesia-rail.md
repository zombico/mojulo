### Artesia's rail: the kingdom of Ceres as a chain of regions, each in its own light

The ground for a rail of Artesia's own: an action RPG in the Link to the Past and Link's Awakening mould, a fixed
chain of regions each opened by the dragon freed in the one before.

- **A village under the hour** (`era/village-look.js` `villageHour`, `VILLAGE_HOUR`): a storybook town's houses take the
  level's hour as its land does. Toward night they are dimmed to a third and drawn toward the night sky's hue, so a
  night town reads as night and its lit windows are the warm things in it. By day (the sky's `day` at 1) every byte is
  as it was. Before, the houses stood at noon's brightness under a night sky.
- **A world map laid as a region** (`gameworld/world-map.js` `worldMapLevel`): three opt-in words, each absent as
  before.
  - `names`: its blocks' names, by their place on the walk.
  - `climax`: the foes its climax stands (a region's dragon).
  - `opening: false`: a region come into later, nothing taught. A breath, then a pair on its way out.
