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
- **The map sketch: a level decided in miniature before it is built.** `level/map-sketch.js` writes a planned map's
  CONCEPT (its pitch and its journey, beat by beat: arrival, traverse, encounter, find, secret, climb, climax…, each on a
  segment) and, a segment at a time, its SKETCH: each tile's ground (forest, grove, meadow, rocks, cliff, water, scrub),
  its height in steps over its region's rise, and its marks (an encounter and who, loot and what, a landmark, a secret, a
  rest, a hazard, someone met), each segment a draft until the creator approves it. Laws advise: the journey covers the
  walk and follows it, a path climbs a step at a time, a gate's two sides stand within a step, no path on water or a
  cliff. Each segment's SUBTASK is its brief (`segmentBriefs`): its beats, its fixed paths and places, its gates and the
  ground across each in metres, what to decide and its laws. Not an RPG's: any action quest's map. A gameworld's zoned
  glyph level carries it as `glyphs.sketch`; the build does not read it yet.
- **The miniature reads the sketch.** The world view numbers the journey over the zones and says each zone's status
  (approved, a draft, not yet planned), lists the journey and the sketch's laws; a zone shows its ground drawn (trees,
  boulders, a cliff's hatching, water, meadow and scrub), its heights, its marks with what each is, its notes and its
  brief; the land is shaded with the sketched heights. The model lays the same in greybox: trees, boulders, a cliff's
  slabs, water, the ground's tints, and a coloured post a mark, told on hover. The test bed writes the briefs
  (`briefs/<segment>.md`), writes the sample out to sketch on (`--save-world`) and approves a segment in a world's file
  (`--approve <segment>`). The sample is a quest to an old keep: the town approved, the fields and the keep drafts, the
  woods not yet planned (its laws say the woods' east gate must rise to meet the keep's).
- **The segments' crew plans in miniature.** `req: { unit: 'level:<id>', segments: true }` raises every segment of a
  planned map, those reached only by joins too, an author each. Each author's brief now carries its segment's sketch
  brief: the level's pitch and the journey's beats here, its land's height and the ground across each gate in metres, what
  to decide (ground, height, marks), the sketch's laws and which of them fail as it stands; its gates say the joins too
  (each a path the segment's law holds it to). An author writes its segment's sketch beside its glyphs
  (`/levels/<id>/glyphs/sketch/segments/<S>`, laid for it when the req is raised), and nothing else; a malformed sketch is
  refused by the world's read with nothing written, and a sketch its author marks approved is refused: the approval is the
  creator's (the director's own patch).
- **Found by the first crew to plan in miniature.** A segment already written is handed what is written there (its
  `written` rows and places), not the plan's default fill as its floor. A law, `beats-marked`: each sketched segment
  stages its journey's beats on marks (a fight on an encounter, a find on loot or a secret, a secret on a secret, a rest on
  a rest; any other beat on some mark).
- **A segment geocubed: its approved sketch lowered into the build.** `levelGrid` (level/map-sketch.js), read by the map's
  page and its ends in place of the plain grid: an APPROVED segment's heights go into its tiles' rise in the level's one
  land (so a zone's apron and its neighbour's own page lay the same ground); its ground into each tile's flora (forest,
  grove, meadow and scrub as the kit's own presets: forest, grove, meadow, upland); its rocks into more boulders on a path
  tile (`tile.boulders`, era/out-tile.js); its marks onto the page, a post each, told on hover, read out on `map.sketch`. A
  cliff, water, and rocks off a path are not laid yet, and the page says which (`unlaid`). A draft is never lowered, and
  a level with no approved segment builds byte for byte as before. The test bed builds one segment's zone alone
  (`--zones A`) and says what of the sketch it lowered.
