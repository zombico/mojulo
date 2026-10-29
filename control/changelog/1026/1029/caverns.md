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
- **The meru's rock**: a trail with caves wears the meru's gen-7 rock fabric, strata and joints near the eye, inside and
  out.
- **The geocube card** says it; `scripts/spikes/caves/cave.mjs` captures a cave from the approach, wide, at the mouth,
  from its far end and up at its ceiling.
