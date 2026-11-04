### Destructible physics in Godot: the energy slice and its conformance corpus

- **A Godot kernel for breakables under physics** (`kernel/rupa.gd`): a blow is joules and a block holds its matter's
  toughness times its volume; a burst's share goes by the solid angle a block fills, scaled by the world's power; what
  loses its hold falls; a landing is an impact on what it lands on; and the load is worked out again (crushing, and a
  hung span in bending at its bond).
- **The `rupa` conformance corpus**: seven scenarios over brick, concrete, stone and glass (a burst over four matters, a
  giant monster's blast, a lintel losing a jamb, a cantilever past its bond, a stone dropped on glass, rounds wearing a
  wall, a column whose base is broken). Each one is run on the web and in Godot, and the two are compared frame by frame:
  `node scripts/conformance.mjs --engine godot --corpus rupa` (needs `MOJULO_GODOT`).
- Not yet wired into an exported level: the exported game still holds breakables whole. Dents, cuts, heat, fire, wind,
  the ground and water are later slices.
