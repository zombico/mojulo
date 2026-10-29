### Compose geotown: a neighbourhood evoked on a cube's hills, its map first and levelled

A town on a geocube's own land (the geocube kind's `show: 'geotown'`, `lib/graph/geotown/`): its map comes first, and
it is LEVELLED: its streets keep the land's grade, each house a level pad over its walk. A game evokes a neighbourhood
rather than laying it out, so the default is a few houses designed one by one; every plot to scale is `metro`.

- **The map** (`geotown/design.js`): a frame of blocks on the board (A1 the south-west), the right-of-way round each
  (road, kerb, boulevard, walk; a road cross and walked corners at each crossing), each block two rows of plots back
  to back, semis in pairs about their party wall and detached houses by the pattern's mix, a corner plot wider for its
  flank. Each plot's surface is allocated: front yard (the setback a block face holds), path, the house's envelope,
  side yards, back yard. Every square metre of the frame is one surface and the LEDGER sums them per block and for
  the town; a block's plots roll their own dice, so a block changed moves no other. A block may be a park (its paths
  across the land as it lies) or laid but not built.
- **Levelled on the land**: the cube's hills read from a painted landscape (`hills: { height, span }`), smoothed into
  the streets' ground so they keep its grade; each house a pad over the walk at its front, in risers, a semi pair one
  pad. The front yard is a bank from the walk to the pad, its path's steps set in it; a retaining face stands where
  pads meet (along a row, at a corner's flank, at a block's back line). The land under the town is never drawn: a
  pad is one quad.
- **Evoked** (`evoke`: `low`, the default, one block of six or eight houses back to back; `mid` two blocks across a
  street; `high` four round a crossing; `metro` every plot to scale): an evoked row is cut by a count of houses, its
  block as long as its rows make it, on a window of the town to scale's land; its `evokes` law holds its plots'
  shares (house, front, side, back, the semis' share) to that town's. Each house is a TYPE of its pattern's
  (`geotown/houses.js`: the pattern's style changed, spoken as its own language, its material words laid as tiles
  whatever the cube's grit), never its neighbour's, a semi pair one building mirrored; its FRONT a canted or square
  bay with framed lights and a porch at the door or across the house (`geotown/fronts.js`). Each back yard its own
  program (`geotown/yards.js`: a lawn, garden beds, a patio and its table, a deck and its rail, a shed, a sandbox and
  swing), never its neighbour's, behind its own fence (board, picket, hedge).
- **What grows where** (`geotown/pattern.js` SURFACES): street trees on the boulevards at their stride, trees in back
  yards and parks, none on a road, walk, path or side yard; the trees grown variants stamped as repeats under a
  budget, each species its share.
- **The pattern** `bay-and-gable` (a Victorian and Edwardian streetcar suburb, a Toronto Annex) and its style, the
  `bay-and-gable` starter (`era/arch-style.js`): red brick, a steep slate gable to the street, sash lights on stone
  sills under stone lintels, a panelled door under its transom. Its house types: the gable, the Annex house (a
  sandstone ground storey with round-arched lights under a hip, a porch across it, an oriel over), the Edwardian (buff
  brick under a low hip), shingle over brick, painted brick.
- **The laws** advise, never refuse: the budget closes, a back yard every plot, coverage, frontage, the setback held,
  the street's grade, the pad's step, the green share (to scale), `evokes`, nothing growing on a hard surface, the
  faces under their budget.
- **The sheet** (`geotown/sheet.js`): the surface-area map from above, each pad shaded by its height, the crossings'
  heights, the ledger and the laws: the town map judged before anything is built. `scripts/spikes/geotown/geotown.mjs`
  writes it and captures the town at each hour (a street from its walk, a house, the back yards, over the block).
- `city/plan/look.js` now holds `hourSky` (the city scene imports it from there, unchanged).
