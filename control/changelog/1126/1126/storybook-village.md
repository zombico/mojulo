### Artesia's towns: a storybook village, level and open, its buildings in their own palette

- **A town's region** (`level/grid.js` region word `town`, `era/village-look.js`): a glyph map's region that says
  `town: 'storybook'` is built as an anime game's village. Absent, every byte is as it was.
  - **Level ground:** its land is laid level. The map's rise carries a mask (`rise.flat`), so every reader of the land
    reads the same ground, and the level's hills ease back in half a tile past its edge (`TOWN_LAND`).
  - **Open meadow:** its tiles keep one grove and one boulder, the meadow and its flowers left. Each building's ground is
    kept clear of trees 7 m out and laid as the land's own levelled ground, never a poured slab.
- **Its buildings in a palette of their own** (`VILLAGE_LOOKS.storybook`), apart from the land's grass, leaves, rock and
  soil:
  - **Walls and footing:** warm lime plaster, dark warm timber, a cool blue-grey stone footing.
  - **Roofs:** hues the meadow never wears. The hall is cobalt and the tavern terracotta. A home draws teal, plum,
    indigo, amber or slate blue by its dice, never a hue beside the tavern's.
  - **Paint:** shutters and doors are the roof's hue taken deeper, window frames white.
  - **Light:** each face is lit cleanly, its shade side lifted and never grey (`villageLight`).
- **Each building dressed** (`villageDress`, `gableDress`):
  - **On the walls:** a stone footing; timber at the corners, under the eaves and at the upper floor of a tall wall;
    studs between the windows; a white frame and a pair of opened shutters by each window, set on the shell's own face;
    a timber frame round the door.
  - **On the gables:** barge boards, a tie beam and a king post.
  - **By use:** a chimney on a home or a tavern, a hanging sign by the tavern's door, banners either side of the hall's.
- **The action RPG's world map asks for it** (`gameworld/world-map.js` `town`, `gameworld/compose.js`): the village's
  block and the first town's say `town: 'storybook'`. A world designed before keeps its stored plan, and takes the look by
  adding `town: 'storybook'` to those blocks' keys.
