### The world map: maps linked at their borders, each loaded as it is walked into

- **A planned map built a segment a page.** `level.zone: '<segment>'` (level/zones.js) builds one segment of a planned
  glyph map as its own page: its tiles stand where they stand on the whole map (the level's frame, its one land, the same
  seeds), so the ground at a border is the ground the neighbour's page lays there. An apron of the neighbours' tiles
  (`apron`, one by default) is built round it and never walked, so the land past a border reads as the next zone's; the
  rim rises past the apron. Walls stand on the zone's square, open only at its gates; the page reads out its ways (each
  gate's crossing, an exit just inside it and an arrival further in, facing in), and a law, `zone-ways`, says each is open.
- **Joins: a world map with loops.** A plan may join neighbours its walk does not step between (`plan.joins: [['A',
  'C'], …]`), each a gate on their shared side like the walk's; a segment off the walk, reached by joins, is a pocket. A
  planned map is still walked along its route (its pieces, its start and its goal), a join never its way on.
- **A zoned level is a game's world map.** `glyphs.zoned: true` on a gameworld's planned glyph level (a world travelled:
  `topology: 'interconnected'`) makes it a stage a segment: the walk's first first, the segments off it last. Each zone is
  left by its gates (`gate-<side>` reach-exits on its border, toward the zone across) and arrived in by the zone come from,
  set down at that gate's arrival; the shell's travel, keys and flags work as they are. A zone holding the walk's goal keeps
  it beside its gates: reaching it is the game's win.
- **A test bed with no game round it.** `node scripts/worldmap.mjs` builds a world map (the sample: four 3 × 3-tile zones
  of 24 m round a square, or `--world <file>`) straight to a folder with no database and no design loop: a page a zone,
  the play shell over them. `--serve` to walk it by hand; `--walk` walks every gate in headless Chrome, timing each swap and
  measuring where the walker is set down against the gate's arrival; `--shots <dir>` a picture at each arrival. On the
  sample: a zone of 16 tiles (9 its own) builds in 3-5 s and is 10-13 MB; each crossing loads in about 2-3 s, set down on
  its gate's arrival.
- Not yet: an arrival sets the walker's place, not its facing (a zone's page sets out facing in from its way in along the
  walk; arrivals by its other gates keep that heading); a crossing is at a gate, not anywhere along a border (the zones'
  shared frame makes carrying the walker's place along the border the next step); each crossing is a whole page swapped
  behind the veil, never streamed or fetched ahead; a megaworld's rings do not yet take a zoned map as one of their zones.
- **The world map in miniature.** `level/worldmap-view.js` draws a zoned map from its recipe alone, no page built (a
  moment, against seconds a zone): the WORLD (each zone's square on the shaded land, its name and role, the walk and the
  joins, every gate), a ZONE (its tiles, its apron veiled, its paths, places and pieces, where its page sets out and where
  each gate sets one down, each gate a link sideways to the zone across) and a TILE (its ground, its path's shape, its
  place and door, what of the game lies on it, its gate), each a view drilled into by its address and back out by its
  crumbs. HTML and CSS alone, as the game book's pages are, so it can join the book as it stands. The test bed writes it
  beside the game (`map.html`, each zone's walk a link to its page); `--map-only` writes it alone.
- **The world map as a model.** `level/worldmap-model.js` lays the same recipe as a greybox diorama on a plinth (the
  land's rise lifted to read at table scale and lit in its colours, each zone's ground faintly its tint, its border broken
  at its gates, the paths, the places as blocks, a post either side of every gate, the pieces, where each page sets out),
  orbited on its own page with a bookmark over the whole and one over each zone, each zone named. The test bed writes it
  as `model.html`, linked from the miniature's world view.
