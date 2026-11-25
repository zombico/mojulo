### Mech Battle Kai interiors: a smelter hall a frame fights through, lit by its own lamps and furnaces

Enclosed fields at a frame's scale. The first is a steelworks' melt shop half a kilometre across. It has no sky: its
light is the place's own and its background a smoky void. It stays in the seventh generation's form render, so its
steel, concrete and slag are lit as materials. Its materials are the field's own floor: the land's layers re-dressed,
so everything the land does (bands, wear, sections, stochastic tiling, rubble) works on them.

- **The land's materials** (`form/land-materials.js`, a geocube's `outside.materials`, opt-in).
  - A set dresses the four natural layers in a works' cuts, each with its tile, its cube colour and how metal it is:
    `foundry` (riveted steel plate, black slag, slabbed concrete, settled ash), `refinery` (tread plate, gravel,
    concrete pads, oily grime) and `hangar` (wall plate, a sealed epoxy floor, grit).
  - The page blends each layer's metalness and roughness by its weights, and the metal reflects the place's
    environment.
  - Absent, the land is byte-identical.
- **The interior's light** (`form/interior-light.js`, a geocube's `light.interior`, opt-in).
  - A land under a roof has no sky: it has a void, a smoke haze, high-bay lamps and the glow of what burns.
  - The lamps are the works' own (hung from the trusses' bottom chords) or rows under the roof. The page hangs the
    nearest the middle as point lights, with the furnaces' and ladles' glows.
  - The cube's sun stays as the high-bay field's overhead key, at a third of a sun, so decks still throw shadows.
  - The metal reflects an interior environment, never a sky: a dark hall, the lamp rows a band overhead, the glow low
    down. World-scene drops the page's sky and sets its background to the void.
- **The works** (`local-meru/works.js`, a local meru island's `works`, a geocube's `outside.works`, opt-in). An
  industrial interior built over the land, everything a height grid cannot draw:
  - the hall's walls;
  - its roof on lattice trusses (top and bottom chords, verticals and Pratt diagonals, purlins between) and the
    column lines under them;
  - a bridge crane on its rails;
  - operating decks on legs with ramps up to them;
  - furnaces under their hoods and stacks, their mouths glowing;
  - tanks on concrete footings, ladles of molten metal, pipe runs on supports.
  - **Wire scaffolds** are towers of tube in bays, with standards, ledgers and braces. Each lift is a floor of open
    grating, a lattice of bars a frame sees through, stacked a frame's height apart, with guard rails and a barred ramp
    up to the first lift. Under each floor lies a plate a frame stands on (`works:floor`), ray-cast and never drawn
    (the land's `ghosts`).
  - Its faces take the land's own classes, so the materials and the light reach them: steel is the rock layer,
    concrete the soil, and what glows (`works:glow`) keeps its own fill.
  - It gives the page its lamps and glows, its decks, and what stops a body.
- **The smelter hall** (`assault-frame/geocubes.js` `smelter-hall`, the field's form `smelter`).
  - The foundry's materials and colours under the interior light, with the smelter works on the `smelter` massif
    card's floor: slag heaps at their repose, concrete plinths, casting pits.
  - Steel is blackened low by soot, panels have their own tones, rust runs from the seams.
  - Slag rubble; stochastic tiling.
- **A frame under a roof.**
  - On an indoor field a frame looks for its ground from a step over its feet (`rule.probe`), not from 60 m up, so
    it walks under a deck or a scaffold floor and lands on one it jumps or ramps onto.
  - The frame rule stops at what the world's colliders stand (`resolveBlocking`, when its rule names a body): the
    works' walls, columns, furnaces, tanks and ladles, and the decks' slabs, walked under and stood on.
  - The level carries the works' colliders (`frameField` `indoor`, `colliders`).
  - A frame that names no body moves as it always did.
- **A refinery superstructure** (`assault-frame/geocubes.js` `refinery-works`, the field's form `refinery`). A place
  built up, not out, under a 140 m enclosure on deep trusses, its new works words:
  - **process frames** (`frames`): heavy steel in 12 m bays, a grating floor at each level a frame's height apart,
    girders, braces, a ramp to the first; lamps hung under each level's corners; the columns stop a body, and every
    level is a deck walked under and stood on;
  - **columns** (`vessels`): distillation columns and reactors on concrete footings, a platform ringing each at each
    height a frame can stand on, its rail and a lamp;
  - **spheres** on their legs, **pipe racks** (`racks`, a bent every 12 m and four pipes on each tier) carrying the
    spine between the units, **walkways** (`bridges`) of grating from a frame's level to another or to a column's ring,
    and fired heaters glowing at the edges.
  - Scaffolds and process frames share one tower builder: a scaffold is the light one.
  - The `refinery` massif card is its floor: gravel between low concrete pads, bunds round the storage, oily sumps.
  - The refinery's materials, sodium lamps, and a fill as warm as its lamps (`HALL_LIGHT` takes a sky), so the floor
    is never shaded blue.
- **Every unit lit, and racks that stop a frame.**
  - A place with more lamps than a page hangs has them pooled, not cut: every lamp joins its nearest pool, and each
    pool hangs at its members' centre with their reach, as strong as their mean grown by the root of their number.
    The outer units and the far walls are lit, not only the middle (`form/interior-light.js`).
  - A pipe rack's posts stop a body, each tier's bundle is a slab a frame walks under below the lowest tier and is
    stopped by above it, and the top tier's crowns are a plate a frame lands on and walks along.
- **The works' floor, designed from above** (`local-meru/works-floor.js`, a works card's `floor`, opt-in; drawn by
  `scene/channels/works-floor-glsl.js` in the land's shader). The floor is a plant's plan, not one tile repeated.
  - Its zones are read off the works:
    - a pad poured under every frame, scaffold, deck, column, tank and sphere, bunded by a kerb round what stores;
    - a footing under each column of the hall's lines and each rack post, a rack's footings stepped along it;
    - steel plate round the furnaces and ladles;
    - a trench along each frame and each rack.
  - Only the lanes and the yard are designed: lanes along the axes and one round the hall `ring` metres in, and a
    gravel or concrete yard.
  - Each zone is drawn its own way:
    - a pad is sawcut at its own spacing from its own corner;
    - an apron is laid in steel plates of three sizes, welded and bolted;
    - a lane is lined in paint, dashed down its middle and worn in two tracks;
    - a trench is grating over a pit seen in parallax;
    - the yard is domed gravel stones, or concrete in long strip pours sawcut at no rhythm (no running bond).
  - Kibble lies over the pads and the yard: manhole covers, drain grates over their own pits (parallax), bolted anchor
    plates, oil stains. One at most per cell, kept off a zone's edge.
  - Near, the floor's relief (joints, kerbs, bolts, plates, stones) turns its normal; far off, only its tones.
  - It is drawn only on the floor, within 1.5 m of the floor at the centre, so a deck's top and a pipe's crown are not.
  - The page reads it as two small textures: the zones, and a grid of cells naming the zones over each.
  - The foundry's and the refinery's concrete layers became a jointless grain, since the plan draws the joints.
  - Absent, the land and its page are byte-identical.
