### Gen 7: form, not light (continued)

- **Fixed: the walk dropped you inside the island.** The walk's spawn and the `seam` camera stood at the stage's join,
  1.7 m over its own height, under the meru island's high side (13.5 m up at the join): walking began 11.8 m inside the
  land and fell through it. On an island the spawn now stands on the island's own ground at the join, dropped from a
  hand over it (`SPAWN_CLEAR`, so the walk's ground ray starts above the faces), in both eras.
- **Fixed in the gen-7 channel, found looking at the trail, path and town shows:** a face with no natural layer (the
  trail's own ribbons and the walls of its shelves) took no material at all and drew black; it takes the path's. The
  scree's stones kept by their dice scattered as pale flakes far from any scree (the noise nudged a share that was a
  trace); the noise now nudges only as far as there is scree. And the rock's relief only carves: its highest point at
  the land as built, so nothing set against a cliff (a house, a stair) is overgrown and the walker never stands inside
  the rock.
- **Gen-7 flora, phase 0: the tricks out, moss in.** A read in the form render draws no fringe over a cliff's lip or a
  boulder's rim and no grass cap on a boulder (era/isekai.js, `ctx.form`): painted cards and painted tops. A form page
  drops the gen-6 grass's blade cards and its live grass (world-scene): the form render's grass is its own. In their
  place, optional moss: the biocube's `flora.moss` (0–1, none unless asked), drawn by the form channel on rock whose
  relief faces up, in patches, in the undergrowth's cushions under the palette's grass. Gen-6 is as it was.
- **Gen-7 grass on the World page, and its sward.** A form page draws its grass as polygons
  (`scene/channels/form-grass.js`): clumps of blades instanced on grids that walk with the camera, the brush's rows
  grown on the page from the land read's ground map (`grass: 'map'`: height, where grass grows, and the sward, so no
  rows ride the payload). The sward is a mood's word, the biocube's `flora.grass.sward`: `'tall'` (a meadow, the
  default), `'short'` (a lawn, a pasture: fewer, lower blades in crossed pairs, turned away from the trail) or
  `{ short: 0–1 }`, that share of the land's grass laid as short areas a couple of dozen metres across, each wholly one
  or the other and eased over a seam, never sprinkled together. The card's gen-6 grass is as it was.
- **The short sward is a bed, and the grass has drifts.** A short sward is drawn as a bed of bristles (a triangle each,
  scattered over the whole cell, near one height, lit as one pile), so it reads as a toothbrush's even pile, not as
  tufts. Drifts stand in areas of their own inside the sward (`form/grass-drifts.js`): the biocube's
  `flora.grass.drifts` { <grass kind>: share } (at most three) and `flora.flowers` (now drawn by the form render too),
  each its share of the land's grass, no two in one cell. Their plants are the library's, grown before light: the grass
  library's two new kinds, `wheat` (stiff culms over few blades, bowed gold spikes, mostly straw) and `chaff` (short
  broken straw lying splayed), or any other kind, by `grassTuft`; the wildflowers by `wildflower`; near grown full, far
  plain. A kind taller than the short sward stands in the blades' place, a lower one and the flowers among them; their
  colours the library's carried into the cube's light by the ratio its grass was solved by.
- **The grass's carpet, its density and its wind.** Nothing sprouts from nothing: wherever grass grows a carpet stands to
  the sward's height, the ground drawn again as thin shells (a grid that walks with the camera, ten shells near, half
  far off), each keeping its slice of the strands: blades seen wide (wide along their facing, thin across, leaning,
  the blades' base-to-tip shade, the short sward's dark twin), two to a coarser cell, so it covers widely with less
  detail; its height derived from the blades' (its strands' mean top at their mean top: 0.825 m tall, 0.265 m short),
  so a blade hands over at its own height; a standing drift's colour and height over it and a low one's tint;
  it thins far off and flattens into the ground's lines. The blades stand inside it and dissolve into it past their
  reach at most of their height, never shrinking out. The far brush's rows (fins three ways, their lines wandering) are
  gone. The tall sward is denser (its grids 0.34 m and 0.17 m
  apart, from 0.42 and 0.21); each short bristle has a darker twin just behind it, a line of shade that gives the pile
  its depth. Grass, points and drifts bend in the page's one gust field (channels/terrain-wind.js): a form page keeps
  the gen-6 live grass's wind and its crowns' sway with its blades off (`field: false`, channels/stage-grass.js; a
  gen-6 page as it was), so the grass waves as one with the trees, a gust's band a shade brighter as it passes. A
  drift's forms draw its kind's one grid (a sparse kind a wide grid), so the drifts cost a fifth of what they did.
- **Gen-7 trees, first look: grown wood, clumps with near sprays, bark by parallax** (a spike:
  `scripts/spikes/form/tree.mjs`, one tree near, mid and far under a sun you turn). A grown tree (vegetation/grow.js) read
  as form, no light baked in (`form/tree-form.js`): its wood the grower's axes as tubes with smooth normals, cut at 6 cm,
  a ring every few radii, the bark's coordinates in tiles; its foliage gathered from the leafy shoots into CLUMPS (cells
  1.5 m wide) and spray SITES (0.6 m), each facing out of the crown, scaled to hold its cell's leaf area (× a crown fill),
  the crown's own shade as occlusion, a rank. The crown is clumps everywhere (`vegetation/sprays.js` leafClump: a rosette
  of six oversized leaves of the species' outline, simplified and blunt, 36 triangles), and near the eye the SPRAYS come
  in inside them, each whole at its own distance, as the clumps draw in: the grass's carpet and blades, nothing from
  nothing; a clump and the sprays of its cell hold the same leaf area (leafHolds). A spray: a twig and its leaves as its
  species carries them, the architecture's phyllotaxis (the golden angle, or two ranks level either side) and the leaf's
  outline (an oak's lobes, an ovate or a broad blade), each leaf folded on its midrib. Every leaf's normal bent toward the
  crown's outside, a little light through it. Far off a crown keeps fewer clumps, the kept ones grown to hold the cover:
  never a ball, never a swap. The oak (13 m) draws 6.9k leaf triangles at mid and 2.6k far, against the sprays' 41k and
  19k; its wood 8.2k. The bark (`form/bark-material.js`): the fracture model's own colour, its relief's normal, the
  fissures' occlusion and the relief, marched by parallax near.
- **Gen-7 trees stand mature.** The grower's age costs past youth (an oak's 20 years grow in seconds, 30 in a minute, 40
  run out of nodes), so a tree is grown young and re-stood mature (vegetation/grow.js `restand`: scaled ×1.45, its
  girth's thickening ×2.2, settled under its own weight: the oak 19 m with a trunk 1.1 m across, from 13 m and 0.36 m),
  its crown carrying leaves over its larger surface (the fill by the scale squared), its clumps' cells and the wood's cut
  grown with it. A cell past its cap takes more clumps or sprays, not a bigger one, so a leaf stays near its size. Its
  leaves sitting on its newest shoots only, its crown is filled to a dome: the envelope the leafy shoots outline round
  the crown's axis (slice by slice, sector by sector, smoothed), a clump wherever its surface has none near, every clump
  of a shoot kept. The oak draws 15k leaf triangles at mid and 8k far; its wood 6.9k. The re-standing aims each species
  at the top of its height range (`heights`, within ×1–2): the beech 17 m, the umbrella tree 7 m.
- **Gen-7 conifers and evergreens.** The conifers (vegetation/conifer.js: spruce, silver fir, Scots pine, grown by rule
  at their age, not re-stood) read as form with their slender limbs drawn, cheaply (rings far apart, four sides), and
  their foliage needles (`vegetation/sprays.js` needleHabit, from conifer-mesh.js HABIT: no cut-out, so a needle is a
  tooth on a strip's edge): near, a spruce's shoots bristling all round, a silver fir's flat two-ranked fronds, a pine's
  whorls of bare shoots ending in bursts of long needles; the crown's mass a fir's or a spruce's drooping toothed pads
  lying along their branches, a pine's spiky tufts; clumps on finer cells (a conifer's crown is narrow) and a fuller fill.
  A needled broadleaf row (the fir) takes the conifers' rules; an evergreen broadleaf (the umbrella tree) and the figs
  (their own rows, vegetation/ficus.js) the trees'. The spruce draws 5.6k needle triangles at mid, the pine 6.9k.
- **Gen-7 bushes, first look** (`form/bush-form.js`, on the tree page: `scripts/spikes/form/tree.mjs --bushes`). A bush kind
  (era/thickets.js: a leaf form with the trunk taken away) drawn from the trees' parts, no grower: a few thin stems from
  its foot as tubes (form/tree-form.js pushTube, lifted out of the tree's wood), its foliage the trees' clumps laid over the
  outline its habit draws, a layer inside for depth, and its sprays coming in inside them close by (3 to 8 m: a bush is
  small and stands by the walk). Each leaf form a habit (BUSH_HABITS): a dome of small leaves (box, laurel), a low wide
  mound of needle pads (juniper), arches from the foot with leaves along their outer half (forsythia), a vase of upright
  stems with spiky brushes (broom, heather), long leaves in rings from the ground (hosta, fern), a small cone (a dwarf
  conifer). The sprays take a bush's LEAF where they took a species (`vegetation/sprays.js`: its size, outline and
  phyllotaxis, or a needle habit at a bush's scale); a tree's sprays, clumps and form are as they were. A bush's clumps
  draw 0.2k to 2.2k triangles; far, its outline from clumps alone.
- **Gen-7 bushes in their season** (`bushForm(kind, { adorn: 'bloom' | 'fruit' })`, the page's season buttons). In flower:
  blossoms, five petals round an eye, on the outer clumps facing out; in fruit: glossy berry clusters hanging under the
  outer, lower ones (an inner clump carries neither). Each habit its colours (BUSH_ADORN: the laurel white with red
  berries, the forsythia gold, the broom yellow, the hosta lilac, the juniper's berries blue), at most 90 blossoms and 24
  clusters a bush (about 1.4k and 1k triangles), drawn 2.4 times their size so they read at a walker's distance, as the
  grass's flowers are. Green unless asked: the same bush, nothing added.
- **Gen-7 trees and bushes on the trail** (a geocube's `show: 'path'` at `?era=gen-7`). The trail's placement says where
  each plant stands as data on a form read (`era/isekai.js` plantItems, ctx.form: trees with their kind, height, band,
  hero and cluster; thicket bushes with their kind and walk; shrubs with their season), taken off the payload once read:
  every other page byte-identical. `form/flora-read.js` grows them: a tree kind's leaf form names its species
  (FLORA_SPECIES: spray beech, plate cherry, weep willow, tuft oak, whorl pine, spire spruce; a level naming no kinds,
  beech and oak by cluster), a bush kind its habit, a shrub the dome in its season; one template a species at the level's
  own height for it (a broadleaf re-stood to it, `treeForm`'s `mature.aim`; a conifer grown to the age that stands that
  tall), every plant a copy, turned and scaled. Colours the cube's: the foliage's and the floor's solved bases, a kind's
  pick from the theorist's offer solved the same way, the bark tinted half-way toward the level's. On the page
  (`scene/channels/form-flora.js`, inside the land's block, under its sun): each template's wood in its bark (parallax
  near), its crown its clumps merged, a far crown and far wood (the thick axes, `treeForm`'s `far`), its sprays merged;
  copies sorted by distance (whole to 25 m, sprays on the six nearest inside the detail range), the painted crowns,
  trunks, shrubs, brush and stamped stock trees hidden, the land no longer reading its crowns as form. The wind: the
  grass's gust field; a trunk stands (each vertex weighted by its distance off the trunk's skin over 1.2 m), the leaves
  ride their limbs and flutter, a bush bends from its foot; a walked-through bush shakes as the walker brushes it,
  settling over 1.2 s. The crowns and wood cast into the land's sun shadow. Measured on island-noon's forest trail (71
  plants: beech, oak, 14 shrubs): 0.57M triangles at the trailhead, 0.41M from the cliff top; 20% of the view darker with
  the trees' shadows; the wood held still 41% of a beech's, 14% of an oak's (its trunk's share), the leaves 85 to 93% at
  full sway. The weeping willow a new species row (Troll's limbs, its narrow `lance` leaf, `weep`: curtains of clumps
  hanging from the crown's rim). On the way: the re-standing's settling composed as one turn a node (the oak's tree
  build 14 s to 7 s, its output unchanged), the young tree grown once a process; the land read's bounds by a loop (a
  land with its bushes' lobes overflowed a spread's arguments).
- **The switch keeps the silhouette.** Near the eye a crown's sprays came in as its clumps drew in to 0.4, so a bush kept
  half its outline at the switch (0.5 to 0.65, overlap over union) and a cherry 0.8. Now the clumps hold their size and
  the sprays come in over them as detail: a bush's sprays from each clump's heart, radiating in its plane to inside its
  rim (their reach the clump's radius × `reach`, BUSH_FORM), a tree's in their own cells (the page's `LOD.draw` 1). The
  tree page's gate, `window.silhouette()`: the plant from one camera drawn far (clumps alone) and as drawn, each outline
  against white with its leaves' gaps closed, their overlap over union. Every bush and tree measured holds 0.91 to 1.0,
  nothing of the far outline lost (the near adds at most a sliver past it). The juniper's pads smaller and closer (its
  near read as big dark discs over the sprays).
- **The trunks stand in the wind.** The live wind (scene/channels/stage-grass.js CROWNS) bent a tree's wood by its height
  alone, so a trunk bowed with its crown. Each built tree's stems now ship with the crowns (`liveGrass.crowns.trunks`,
  era/isekai.js trunkSway: foot to top with their radii, a sakura's too) and the page weighs every wood vertex by how far
  it stands off its trunk: none on the trunk's skin, all of it a metre out, so the limbs bend from where they leave it
  and the leaves sway as they did. Both renders of a trail take it (the form render keeps the crowns' sway). A stamped
  stock tree never swayed and still does not; bamboo's culms, which flex, keep bending.
- **Fixed: the far clumps came back.** With the form's plants on a trail the land read left out every crown and trunk,
  the skirt's distant tree clumps among them (the same group). Now only the trees and bushes inside the plants' own box
  (`form/flora-read.js` floraBox, landRead's `grown`) are left out; the skirt's clumps read and draw lit as before.
