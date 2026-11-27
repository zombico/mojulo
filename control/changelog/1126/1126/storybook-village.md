### Artesia's towns: a fantasy village, level and open, its streets of brick lined with houses in their own palette

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
- **Its streets: the geocube's street town laid on a flat map** (`era/stage-buildings.js` `town.places`,
  `era/village-look.js` `villagePlaces`, `VILLAGE_LANGUAGE`):
  - **Places, not a trail:** the geocube's street town (its lots, each house spoken in a building language) now takes its
    lots' places as well as laying them along a trail. A lot stands at a given door and facing, and may stand past its
    map tile's edge over the open land beside it. Laid on places, it leaves its hall and its civic uses to the map's own
    places.
  - **The map's street:** a town region's straight way lays a house each side, facing the street, wherever the land
    beside it is open (never against a place, another way or the map's edge).
  - **The language:** its houses are spoken in a fantasy language written as its elements. A stone ground storey under a
    timber-framed plaster one; a steep gable with gold finials, a cornice and painted bands; round-headed windows on
    sills under keystones; an arched door; quoins, shutters and a chimney.
  - **The paint:** each house in the village's palette by its groups (`villagePaint`).
- **Brick roads** (`VILLAGE_WAY`): a town's ways are paved in brick (`brick-paving`, herringbone) and are at least a
  street wide. On a clean land too, the paving's tile is laid on the way at the least grit, so its bricks read as
  bricks and not a colour. A region's own `path` surface wins.
- **More fantasy, less 18th-century** (`villageTurret`, `turreted`, the palette):
  - **Turrets:** a round turret at a front corner of the hall, the tavern and two houses in five, its shaft past the
    eaves, a cone roof in the building's hue, and a gold finial.
  - **Pastel walls:** cream, blush, lavender or butter, by each building's dice.
- **Its surfaces textured** (`VILLAGE_TEXTURE`, a town dress laid by `era/town-dress.js` `dressTownFace`): each surface
  carries its relief over its own colour, so the palette stays the village's and the material shows.
  - **Plaster:** a clean stucco.
  - **Stone:** tooled in courses.
  - **Footing:** long pitched blocks.
  - **Roofs:** every roof (a street house's, the hall's and the tavern's, a turret's cone) its tiles in lapped courses.
  - **Brick roads:** the herringbone laid at more grit, so each brick stands in relief.
- **Each house its own door and windows** (`villageVariant`, a street place's `anchor`): a house's dice pick its door
  from `VILLAGE_DOORS`:
  - an arched boarded door in a frame;
  - a panelled one under a hood with a radial fanlight;
  - an arched glazed one;
  - a boarded one between pilasters under a square fanlight;
  - a panelled one in a frame.

  They also pick its windows from `VILLAGE_WINDOWS` (arched lattice, casement or sash; square casement or ornamental),
  their trim, and its shutters (boarded, louvred or flat). A round window wears a keystone, a square one a flat lintel.
  - **The door's paint:** its boards' joints a shade under the leaf, its raised panels a shade over, its surround the
    white trim, its hood and pilasters the stone.
  - **The doorstep:** kept clear of grass, and the house's socle stops at the door's jambs. Without that it ran the
    wall's length over the door's foot. This is speak's `doorway` option; absent, a house is byte for byte as it was.
