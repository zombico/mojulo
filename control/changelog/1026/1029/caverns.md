### Caverns: building into the rock

A cave is the room of building against the rock: two cliffs with a ceiling. Cut into a trail's cliff on the geocube's own
rock (its walls the cliff's rock, its floor scree, a ceiling under the land), lit by what its mouth lets in.

- **The cave** (`era/cave.js`, a trail's `ground.caves: [{ y, depth?, width?, height?, along?, mouth? }]`): a centreline
  from the cliff's foot at station `y` into the rock, then along behind its face (a gallery), held inside the site's back
  edge. The trail's grid is cut to its floor (rising a little inward) and only cut, the land before the cliff left as it
  lay; its sides fall steep, so its walls are the cliff's own rock faces, and its floor is the land's soil with rock at the
  walls' feet, nothing growing on it. A LID of rock is laid over it wherever the land stood above its ceiling: the
  ceiling under it (a dome springing at the walls), the land as it stood on top, a skirt where its edge shows, the cells
  at its edge cut along the line the land meets the ceiling on. The mouth is where the cliff's face falls below the
  ceiling; `mouth` a taller entrance, the ceiling flaring down from it over a width in, opening as a cleft where it
  stands taller than the rock over it. Each cave an anchor (`kind: 'cave'`).
- **Its light** (`caveLight`): each face under a lid lit by what it sees of the day against what an open face of its tilt
  would: the sky through the mouth (the polygon form factor, strip by strip where the line to it stays in the cave), the
  sunlit land before the mouth, and the glow of its cross-sections (every half its width along it, each giving back the
  rock's share of what reaches it), so light is carried in and round a bend and a big cave lights as a small one of its
  shape does; the sun its own (the lid casts with the land), its share kept for the live sun; never darker than a floor.
- **Lined with the geocube's rock** (`caveRocks`): the land's own boulders (`isekai.js` boulderFaces, broken edges and
  all) along each wall and across its far end in two staggered rows up to where its ceiling springs, and slabs hung
  upside down across its ceiling from where a taller mouth has come down; the cut and the lid behind them the rock they
  are set in. No grass hat on any; never in the walkway (at a bend a wall of one leg is the way into the next).
- **Rock behind the cliff** (`trail.ground.behind`, 0 to 80 m): the land over the far cliff that much deeper, the cliff
  where it was, for a deep cave or a mountain's base; with `ground.cliff.height` a cave big enough to drive an elephant
  through (22 m wide, a 24 m mouth, in a 34 m cliff) lights and lines as a small one does.
- **Its register** (a cave's `light`, `CAVE_LIGHTS`): the same rock a base's, a temple's or a grotto's by what lights it
  past its daylight. `fluorescent` hangs tubes along its crown (two rows in a wide cave), cold white; `torch` sets
  sconces on both walls in front of their rock, warm; `bio` grows glowing clusters at the walls' feet and from the
  ceiling, cyan-green, faint. Each fixture is drawn bright, its own light; each lamp lays its colour on the faces that
  can see it (in the cave, under its ceiling), falling with the square past its near distance, added to what the day
  lays, the same at any hour (against a darker hour's bake, the more). A register is laid for a cave 8 m across and
  scaled with the cave (`lampScale`): in a hall its tubes are high-bay floods and its sconces braziers.
- **The cavern** (`era/cavern.js`, a trail's `ground.cavern: true | { height?, skylight?, formations?, light?, cracks?,
  ends? }`): a whole trail underground, a level could be set in one. The land is the geocube's, closed in: the open side
  and the ends raised to the far cliff's top, the walk's notch through each end kept, under a pretend ceiling of the
  cliff's rock (a lumped dome over the site, its rim over the walls' tops, a skirt round its edge down into the land, or
  to a lintel over the walk with `ends: 'open'`, a passage out). Nothing grows in it: no grass, no tree, no far layers,
  no biocube flora; its floor soil and scree, its water a trail's. Its formations stand off the walk and out of the
  water: stalagmites, stalactites hung over them and on their own, columns where a pair nearly meets, the land's rock.
  It is lit by its dark (the page's sky a room's), the CRACKS in its ceiling (`cracks`: jagged slits of day drawn bright,
  their light falling to the floor), a `skylight` (a hole over the walk: the day's sky through it, the sun's shaft), its
  register's lamps along the walk (`light`: torch by default) and the bounce of all of it round the hall (the rock's share
  of the mean light on its floor). An anchor (`kind: 'cavern'`); `scripts/spikes/caves/cavern.mjs` captures it.
- **Its floor, soil and scree** (`floorKind`, `floorDress`): a cavern's ground is soil, its walk packed earth and the
  floor off it a darker dirt; scree lies round its rocks (its walls' feet, its formations, its boulders, the bigger
  stones strewn on it; a pebble sheds none), rubble nearest; its walk is broken by stretches of the rock it runs through
  (worn bedrock, a limestone pavement; natural flagstones; plates) and patched with gravel, its edge frayed face by face
  into the dirt; each surface a tile in the cube's own soil or rock, each face lit by the cavern's own light at its corners
  (`cavernLightAt`). Only the hall's floor: the walls' tops and the plateau under the ceiling stay the rock's. Its edges
  are strewn as a dirt trail's are (`local-meru/broken-land.js` strewEdge, now taking its numbers, EDGE's by default),
  heaped evenly both sides with more and bigger stones reaching further out and in (`CAVERN_EDGE`), so no line shows
  between the walk and the floor; no grass hat on any stone underground. It is still a trail: its beats and its walk as
  any trail's, a level's section as any is.
- **Its wall rocks** (`wallRocks`): small rocks (0.3 to 1.1 m, most small) heaped along the foot of every wall, the far
  cliff's and the open side's, one to three a step, found where the land lies level past the wall's face, out of the
  walk: the land's boulders, no hat.
- **The meru's rock**: a trail with caves, or a cavern, wears the meru's gen-7 rock fabric, strata and joints near the eye, inside and
  out.
- **The geocube card** says it; `scripts/spikes/caves/cave.mjs` captures a cave from the approach, wide, at the mouth,
  from its far end and up at its ceiling.
