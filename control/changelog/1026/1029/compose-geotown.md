### Compose geotown: block segments composed into neighbourhoods on a cube's hills, map first and levelled

A town on a geocube's own land (the geocube kind's `show: 'geotown'`, `lib/graph/geotown/`): its map comes first, and
it is LEVELLED: its streets keep the land's grade, each building a level pad over its walk. A game evokes a town
rather than laying it out: a BLOCK SEGMENT is the unit (a few buildings, each designed on its own), four or more make a
NEIGHBOURHOOD, and neighbourhoods are a geocity graph's nodes (each one's `ports`); every plot to scale is `metro`.

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
- **Evoked** (`evoke`: `segment`, the default, one block segment; `neighbourhood`, four or more composed; `metro`
  every plot to scale): an evoked row is cut by a count of its buildings, on a window of the town to scale's land; its
  `evokes` law holds its houses' plot shares (house, front, side, back, the semis' share) to that town's. A segment's
  kind (`segment`, pattern.js SEGMENTS): `houses` six or eight back to back; `main-street` shops built to the main
  street's walk, their service yards behind, houses backing onto them; `apartments` a walk-up and its lot among houses;
  `park`. Each house is a TYPE of its pattern's (`geotown/houses.js`: the pattern's style changed, spoken as its own
  language, its material words laid as tiles whatever the cube's grit), never its neighbour's, a semi pair one building
  mirrored; its FRONT a canted or square bay with framed lights and a porch at the door or across the house
  (`geotown/fronts.js`). Each shop its own brick, sign and awning over a mullioned shopfront; the walk-up a canopy over
  its door. Each back yard its own PLAN (`geotown/yards.js`), a feature in each of three zones, each given its depth
  in order from the house and never its row neighbour's in that zone: by the back door a patio (a table under a
  parasol, or a grill and loungers) or a deck (its rail, steps and planters); in its middle a lawn and its tree, garden
  beds, a swing with a sandbox or a slide, a trampoline (its mat, padded rim and net posts), a mansion's pool; by its
  back fence a shed, a kitchen garden and compost bin, or a large shade tree (the pattern's `grow.shade`) ringed in
  mulch over a bench. A feature without its room is lawn, the back fence's first. A share of houses (`yards.balcony`)
  keep a balcony off an upper floor at the back, its rail and brackets, its reach the house's in the trees' room. Each
  yard behind its own fence (board, picket, hedge); a shop's service yard its bins and now and then a car, a walk-up's
  lot its painted stalls and cars.
- **The midtown mansion** (`pattern.mansion`): a houses segment holds at most two (`evoke.mansions`), each a much
  larger property taking houses' frontage: set back further on a wide lawn, its drive (the pattern's `drive` finish)
  along one side yard to a garage at the back, its yard a pool in its coping and terrace, a garden or a lawn behind a
  hedge, its house a revival of its own (`mansion.types`: Tudor, half-timbered over a stone ground storey under clay
  tiles; Georgian, brick under a hip with a fanlight and quoins; Richardsonian, rubble stone round-arched under a
  porch), three storeys, never its neighbour's. Its `mansions` law holds each at least twice a house's plot, at most
  two a block; the ledger counts the garage's footprint; a `mansion` view.
- **A neighbourhood** (`neighbourhood`: the pattern's `annex`, `main-street`, `quiet-streets`, or a written `{ layout,
  main }`, rows of letters north to south): its streets ranked, a MAIN street wider with its walk paved to the kerb and
  its trees in pits (`pattern.main`); each segment's rows turned to their streets (a main-street segment's shops face
  its main street) and TUNED to its cell: each column as wide and each row of cells as long as its segments need, a row
  its cell stretches past the pattern's `evoke.stretch` recut by count, then spread to fill it, its rows' depths shared
  out (its `fits` law). The ledger counts the buildings' footprints by use; `ports` are its perimeter streets, their
  ranks and their ends' heights, where a geocity graph joins neighbourhoods.
- **Sites** (`geotown/sites.js`): a block given to one program, evoked as the houses are. `school` (letter S) a brick
  school of three storeys on its own lot facing its street (a canopy over its doors, a flagpole), a schoolyard of
  courts and hoops behind it, a staff lot beside it, its field behind round a track where the field holds one;
  `sports` (F) a local field: a softball diamond (its dirt, bases, mound, backstop, outfield fence), a pitch under its
  lights and beside its bleachers, tennis courts in their fence, a field house and a lot; `park` (P) now its playground
  on its chips, a pavilion and its picnic tables, benches along its paths. A school or a sports field is two segments'
  ground: `segment: 'school'` lays two cells as one block, and in a layout wide letters side by side are one block, no
  street through it (its crossings walk across). Each site is proportioned to the block it is given: alone it takes
  its pattern's rails (`pattern.sites`), composed it yields to its neighbours' cells, to scale it takes the block it is
  laid on, fronting its long side or a main street; its `sites` law holds it near its rails and its grounds' shares
  (building, lot, playing ground, green, paved) near the site to scale's. Its ground is one level (the land under it,
  held to its walks), retaining faces round it and its school's lot; its fields and courts grow nothing, its lawns
  their trees, each held to its room. Every square metre is still one surface: the new `grounds`, `field`, `court`,
  `track`, `infield`, `play`; a part drawn round (a track, a diamond's dirt) carries its own area. The `apart` law: two
  playing fields never side by side across one street. The pattern's neighbourhood `school-and-field`.
- **The edge** (letter E, `segment: 'edge'`): a neighbourhood's edge on a MAJOR street (the pattern's `major` section:
  four lanes, a narrower walk, its trees in pits, sparse; a layout's `major` lines, a lone edge's south street). Its
  AVENUE row faces the major street: two-storey buildings each a type (`rows.avenue.types`: a shop with a flat over it, a
  small office under its canopy, a shop behind its forecourt of parking, a house turned to business on its lawn), no two
  neighbours alike, each at its type's setback and frontage; a public LANE behind them (the `lane` surface), and the
  houses behind it facing their quiet street, some with a garage off the lane (counted in `parking`). The pattern's
  neighbourhood `edges`: quiet streets between two major ones.
- **Low-rise apartments** (letter L, `segment: 'lowrise'`): rows of four-storey low-rises on their lawns, each its own
  brick, balconies stacked over their fronts (`fronts.js` `balconies`), a canopy at the door, their lots behind.
- **Alleys behind storefronts**: a main-street segment's shops back onto a narrow alley (the `lane` surface, the
  pattern's `alley` width), not a parking yard: their lots shallower, a strip for bins behind each; the houses behind
  back onto the alley too.
- **Mansions away from the main street**: none on a block that touches a main or major street (the `mansions` law).
- **The pad's step** is measured past the walk's own fall between two fronts: a long frontage on a slope falls with its
  street.
- **Street furniture** (`d.traffic`, parametric): streetlights at a stride along each block-facing walk (both sides of a
  main or major street, staggered on a local one), clear of drives; each crossing controlled by its streets' ranks:
  signals every `signals` crossings along a main or major street (two-way stops on the minor street between them),
  all-way stops at a share (`stops`) of the local crossings; crosswalks at every controlled crossing (zebras at
  signals, two lines at stops), stop lines, stop signs, signal poles with their heads (a mast arm over a wide road).
  A streetscape sets them and a recipe changes them: `streetscape: { lights: m, signals: n, stops: share }`.
- **Streetscapes** (`streetscape`, the pattern's `streetscapes`): how close a neighbourhood is to the city, read from
  its sidewalk. `leafy` (the default) the Annex: a wide boulevard of maples, deep front lawns, a parked side, a gate
  here and there; `snug` closer to the city: a narrow strip of grass by the kerb and a tree here and there, narrow
  lots of semis near their walks, more of them to a segment, cars both sides, most fronts gated; `urban` the walk
  paved to the kerb, no street trees, row-tight lots with stoops a metre or two from the walk, every front behind its
  railing. Each changes the street's section, the street trees' stride and share, the plots' and houses' sizes, the
  SETBACK (how far a house stands from its walk; a deeper one asked deepens the block), PARKING and GATES; a recipe
  changes those four over its streetscape (`{ from, setback, gates, parking, trees }`). Parking is surface: a lane
  along the kerb on one side or both (the ledger's `parking`, out of the road), its stalls clear of every drive and
  cars parked in most, a front pad (the `drive` surface) where a front yard is deep and near level, a car on it now
  and then; the `parking` law counts stalls a household. A gated front: an iron railing, a low brick wall with its
  piers, or a picket, along the front line, a gate at the path; a mansion's stone piers and iron gates at its drive.
  A house's front is fitted to its setback (a porch across it where the yard holds one, else at the door, else a
  stoop; a bay raised over the door where it would stand on the walk); every street tree still stands twice a
  person's height or is not planted, so a tight street loses trees rather than growing short ones. A dense
  evocation's face budget is at least a building's share a building.
- **Finishes** (`pattern.finishes`): the ground laid in material words as tiles: the road's asphalt, the walk's scored
  concrete, a main street's brick furnishing strip and its trees' grates, brick paths, gravel side yards, a stone kerb.
- **Trees only in the town, held to their room**: no belt round the town and none on a perimeter street's outer side
  (the margin is a bare border); each tree's CROWN starts at least twice a person's height up (the geocube's walk,
  `era/out-ikebana.js` WALK.body): its crown raised as a street tree's is (`vegetation/pool.js` `clear`, opt-in: the
  whole crown carried up a clear trunk to that share of its height), so a tree stands at least as tall as that asks;
  held lower where its crown (its species' widest over its height, measured on its raised variants) would reach within
  0.6 m of a building's footprint, porches, bays and awnings in it; one without room to stand that tall is not planted
  (the `room` law), so a tight street loses trees rather than growing low ones.
- **What grows where** (`geotown/pattern.js` SURFACES): street trees on the boulevards at their stride, trees in back
  yards and parks, none on a road, walk, path or side yard; the trees grown variants stamped as repeats under a
  budget, each species its share.
- **The pattern** `bay-and-gable` (a Victorian and Edwardian streetcar suburb, a Toronto Annex) and its styles, three
  starters (`era/arch-style.js`): `bay-and-gable` (red brick, a steep slate gable to the street, sash lights on stone
  sills under stone lintels, a panelled door under its transom), `main-street` (brick shops, a cornice over a flat roof)
  and `walk-up` (four banded storeys under a deep cornice). Its house types: the gable, the Annex house (a
  sandstone ground storey with round-arched lights under a hip, a porch across it, an oriel over), the Edwardian (buff
  brick under a low hip), shingle over brick, painted brick.
- **The laws** advise, never refuse: the budget closes, a back yard every house, coverage (its rail's low end eased
  for an evoked row run deeper to fill its cell), frontage, the setback held, the street's grade, the pad's step, the
  green share (to scale), `fits`, `evokes`, nothing growing on a hard surface, `room`, the faces under their budget (to
  scale one budget; an evocation's a segment's times its segments).
- **The sheet** (`geotown/sheet.js`): the surface-area map from above, each pad shaded by its height, the crossings'
  heights, the ledger and the laws: the town map judged before anything is built. `scripts/spikes/geotown/geotown.mjs`
  writes it and captures the town at each hour (a street from its walk, a house, the back yards, a yard from its
  house's back window, over the block).
- `city/plan/look.js` now holds `hourSky` (the city scene imports it from there, unchanged).
