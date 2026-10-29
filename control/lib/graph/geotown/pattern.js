/**
 * THE GEOTOWN'S CARDS — what a neighbourhood is made of before anything is drawn: its SURFACES (every square metre of
 * the map is one of them, and each says what may grow on it), its SEGMENTS (a block segment: one block, its rows back to
 * back, each row a kind of frontage) and its PATTERNS (a block pattern: the streets' sections by rank, the rows' plots and
 * buildings, the laws' numbers, the finishes of its ground, the neighbourhoods its segments compose). A pattern is data:
 * a new neighbourhood is a card, not code. Its buildings speak its styles (era/arch-style.js): how they look in general
 * (their language: mass, cap, lights, door, socle), the finishes their material words.
 *
 *   SURFACES        { <surface>: { read, grows: [growth…], soft } }: `grows` what the scene may put on it (grass, a
 *                   street tree, a tree, a shrub), none on a hard surface; `soft` whether it counts as green ground
 *   SEGMENTS        { <type>: { read, axis, rows, site?, wide?, span? } }: a block segment's kind: `houses` two rows of
 *                   houses, `main-street` a row of shops on the main street and houses behind, `apartments` a walk-up and
 *                   houses; a SITE given to one program (sites.js): `park`, `school`, `sports`. A `wide` one spans the
 *                   cells its letter fills side by side in a layout (no street between them), and `span` cells alone
 *                   (a school or a sports field is two segments' ground).
 *                   `axis` the way its rows run when no main street turns it ('y': they face the streets east and west)
 *   PATTERNS        { <id>: the pattern }; PATTERN_IDS; DEFAULT_PATTERN. A pattern's STREETSCAPES (its `streetscapes`, the
 *                   first the default) are how close its neighbourhood is to the city, read from the sidewalk: each a
 *                   change to its street section, plots, houses and setback, and its street trees, parking and gates
 *   STREETSCAPE_SETTINGS   what a recipe may change over a streetscape: setback, gates, parking, trees
 *   GATE_SHARES, PARKING_SIDES   the words for gates (none, some, most, all) and the sides a street parks
 *   sectionOf(P, rank)   a street's right-of-way by its rank ('street' or 'main'): { R, kerb, edge, verge, walk, half, row }
 *   rowOf(P)        the residential street's
 *
 * Metres throughout; a street's `road` is its whole carriageway, `verge` and `walk` are each side's.
 */

export const SURFACES = Object.freeze({
  road: { read: 'the carriageway, kerb to kerb', grows: [], soft: false },
  verge: { read: 'the boulevard between the kerb and the walk: grass, and the street\'s trees at their stride', grows: ['grass', 'street-tree'], soft: true },
  walk: { read: 'the sidewalk, and the corners round each crossing', grows: [], soft: false },
  front: { read: 'a front yard: lawn from the walk to the house, a hedge or a shrub at its line', grows: ['grass', 'shrub'], soft: true },
  path: { read: 'the path from the walk to a door, and its steps', grows: [], soft: false },
  house: { read: 'the house\'s footprint: what it may build on', grows: [], soft: false },
  side: { read: 'a side yard: the passage beside a house, to the back', grows: [], soft: false },
  back: { read: 'a back yard: lawn, and a tree or two', grows: ['grass', 'tree', 'shrub'], soft: true },
  park: { read: 'a park: lawn and trees on the land as it lies, eased to the walks round it', grows: ['grass', 'tree'], soft: true },
  'park-path': { read: 'a path across a park', grows: [], soft: false },
  furnish: { read: 'the furnishing strip of a main street\'s walk, by its kerb: paving, its trees in pits under grates', grows: ['street-tree'], soft: false },
  service: { read: 'a service yard or a lot behind a shop or a walk-up: paving, bins, parking', grows: [], soft: false },
  drive: { read: 'a driveway: from the street down a mansion\'s side to its garage, or a parking pad in a front yard', grows: [], soft: false },
  parking: { read: 'a parking lane along the kerb, out of the carriageway: its stalls clear of every drive, cars in most', grows: [], soft: false },
  grounds: { read: 'a school\'s or a sports field\'s lawn: round its fields, before its building, trees along it', grows: ['grass', 'tree', 'shrub'], soft: true },
  field: { read: 'a playing field\'s turf, mown and marked: nothing grows on it but grass', grows: ['grass'], soft: true },
  court: { read: 'a hard court or a schoolyard: asphalt or acrylic, painted', grows: [], soft: false },
  track: { read: 'a running track round a field', grows: [], soft: false },
  infield: { read: 'a ball diamond\'s dirt', grows: [], soft: false },
  play: { read: 'a playground on its chips', grows: [], soft: false },
});
export const SURFACE_IDS = Object.freeze(Object.keys(SURFACES));

export const SEGMENTS = Object.freeze({
  houses: Object.freeze({ read: 'one block of houses, two rows back to back, their back yards meeting', axis: 'y', rows: Object.freeze(['houses', 'houses']) }),
  'main-street': Object.freeze({ read: 'shops built to the main street\'s walk, their service yards behind, houses backing onto them from the street behind', axis: 'x', rows: Object.freeze(['shops', 'houses']), main: true }),
  apartments: Object.freeze({ read: 'a walk-up on its lawn, its lot behind, and a row of houses back to back with it', axis: 'y', rows: Object.freeze(['apartments', 'houses']) }),
  park: Object.freeze({ read: 'a park: the land as it lies, paths across it, a playground and a pavilion', axis: 'y', rows: Object.freeze([]), site: 'park', wide: true, span: 1 }),
  school: Object.freeze({ read: 'a school: its building on its own lot facing its street, a schoolyard behind it, a staff lot beside it, its field and track behind', axis: 'y', rows: Object.freeze([]), site: 'school', wide: true, span: 2 }),
  sports: Object.freeze({ read: 'a local sports field: a ball diamond, a pitch under its lights, tennis courts, a field house and its lot', axis: 'y', rows: Object.freeze([]), site: 'sports', wide: true, span: 2 }),
});
export const SEGMENT_IDS = Object.freeze(Object.keys(SEGMENTS));
// a neighbourhood's layout words: a letter a segment
export const SEGMENT_LETTERS = Object.freeze({ H: 'houses', M: 'main-street', A: 'apartments', P: 'park', S: 'school', F: 'sports' });

export const PATTERNS = Object.freeze({
  'bay-and-gable': {
    read: 'a Victorian and Edwardian streetcar suburb (a Toronto Annex): long blocks of brick semis and detached houses, two and a half storeys with their gables to the street, each behind a front yard and a boulevard of maples, a deep back yard behind',
    // the houses' architectural style (era/arch-style.js): their language and material words, unless the recipe names one
    style: 'bay-and-gable',
    // the right-of-way: the carriageway (two lanes and a parked side), and each side's kerb, boulevard and walk; a MAIN
    // street's wider (four lanes and a parked side each way), its walk paved to the kerb, its trees in pits by it
    street: { road: 8.5, kerb: 0.15, edge: 'verge', verge: 3, walk: 1.8 },
    main: { road: 13, kerb: 0.15, edge: 'furnish', verge: 1.6, walk: 3.4 },
    // what its ground is finished in (era/arch-style.js MATERIAL_WORDS), laid as each word's tiles
    finishes: { road: 'asphalt', walk: 'pavement', furnish: 'brick-paving', path: 'brick-paving', side: 'gravel', service: 'asphalt', 'park-path': 'gravel', step: 'pavement', kerb: 'sawn-stone', drive: 'brick-paving' },
    // a block's length along its houses' street (one per row of blocks), and each row of plots' depth (one per town: the
    // streets run straight); a block is two rows deep, back to back
    block: { long: [150, 210], depth: [34, 40] },
    // a plot's frontage by its house's form; a corner plot is wider by `corner`, its flank a side yard to the cross street
    plot: { semi: [6.2, 7.6], detached: [8.5, 11], mansion: [17, 23], corner: 1.6 },
    mix: { semi: 0.6, detached: 0.4 },
    // the front yard's depth, held along a block face (the street holds it)
    setback: [4.5, 6.5],
    // the house: its depth (a semi pair shares one), its storeys, the side yard a detached house keeps each side and a
    // semi keeps on its outer side (none at its party wall)
    house: { depth: [11, 14.5], storeys: [2, 3], side: [0.6, 1.2] },
    // the least back yard every plot keeps (m)
    back: 7.5,
    // a front path's width, from the walk to the door
    path: 1.2,
    // the share of a plot the house's envelope covers
    coverage: [0.2, 0.5],
    // the steepest street (rise over run): steeper is advice
    grade: 0.08,
    // a pad over the walk at its front: at least `least`, at most `most`, in risers of `riser`; neighbours step at most `step`
    pad: { least: 0.3, most: 2.7, riser: 0.15, step: 1.2 },
    // the least share of the map that is soft (green) ground
    green: 0.35,
    // what grows: street trees at their stride (m), trees per back yard, the share of front yards with a shrub at the
    // line, park trees per hectare; the species each draws from (vegetation/species.js)
    grow: { stride: 9, back: [0, 2], front: 0.4, park: 60, street: ['maple'], trees: ['maple', 'cherry'], shade: 'beech', parkTrees: ['maple', 'beech'] },
    // AN EVOCATION's houses, each designed on its own (no two neighbours of a type; a semi pair one building, mirrored
    // about its party wall): each TYPE a change to the pattern's style (era/arch-style.js { from, … }: its language's
    // elements, its material words, its palette), its storeys, and its FRONT (fronts.js: a bay, `canted` or `square`,
    // rising `bay` storeys or `upper` over a porch; a porch at the `door` or across the `full` front); `weight` its share
    types: {
      gable: { read: 'the street\'s own: red brick under a steep slate gable, a canted bay up both storeys, a porch at the door', weight: 3, front: { bay: 'canted', bayStoreys: 2, porch: 'door' } },
      annex: { read: 'the Annex house: a rough sandstone ground storey with round-arched lights, red brick above under a hip, a porch across its front, an oriel over it', weight: 2, storeys: [2, 3],
        style: { language: { elements: { wall: { storeys: [{ group: 'str:shell', value: 0.45, bond: 'rubble' }, { group: 'str:stone', value: 0.46, bond: 'brick' }] }, roof: { form: 'hip', pitch: 44 }, lights: { form: 'arch' } } }, materials: { shell: 'ashlar' }, palette: { shell: '#9c6a52' } },
        front: { bay: 'square', bayStoreys: 'upper', porch: 'full' } },
      edwardian: { read: 'an Edwardian: buff brick under a low hip, a square bay, a porch across its front', weight: 2,
        style: { language: { elements: { roof: { form: 'hip', pitch: 34 }, lights: { w: 1.1, h: 1.7 } } }, palette: { stone: '#c9a57a' } }, front: { bay: 'square', bayStoreys: 1, porch: 'full' } },
      shingle: { read: 'brick below, painted shingle in the upper storey and its gable, a canted bay, a porch at the door', weight: 2,
        style: { language: { elements: { wall: { storeys: [{ group: 'str:stone', value: 0.48, bond: 'brick' }, { group: 'str:timber', value: 0.62, bond: 'boards' }] } } }, materials: { timber: 'boards' }, palette: { timber: '#5f7480' } },
        front: { bay: 'canted', bayStoreys: 1, porch: 'door' } },
      painted: { read: 'painted brick, cream with dark trim, under a steep gable, a square bay up both storeys', weight: 1,
        style: { palette: { stone: '#e2d6c2', paint: '#3b4a44' } }, front: { bay: 'square', bayStoreys: 2, porch: 'door' } },
    },
    // an evocation's back yards, each its own: a feature a zone (yards.js YARDS), `near` the back door, the yard's `mid`,
    // its `back` fence, each feature's weight its share, never its row neighbour's in that zone; `balcony` the share of
    // houses with one off an upper floor; and the fences between them (yards.js FENCES: board, picket, hedge)
    yards: { near: { patio: 2, deck: 2, lawn: 1 }, mid: { lawn: 2, garden: 1, play: 2, trampoline: 2 }, back: { shed: 2, beds: 1, tree: 2, lawn: 1 }, balcony: 0.4 },
    fences: { board: 3, picket: 1, hedge: 1 },
    // THE ROWS a segment is made of, besides its houses (whose numbers are the pattern's own, above): each its frontage,
    // its plots' depth, its building's depth, its setback, side yards, storeys, its style and its front (fronts.js), what
    // its rear is (`service`: hard), its pad over its walk
    rows: {
      shops: { read: 'shops in a row, party wall to party wall, built to the walk, a flat or two over each', use: 'shop', frontage: [6, 8.5], corner: 1.2, depth: [24, 30], building: [14, 18], setback: [0, 0], side: [0, 0], storeys: [2, 3], style: 'main-street', rear: 'service', front: { shop: true }, pad: { least: 0.15, most: 0.6 }, palettes: ['#a55a42', '#8c4a3a', '#c9a57a', '#d8cbb3', '#6f4a3c'] },
      // (a school's building on its site's own lot: sites.js lays the lot, these are its building's)
      school: { read: 'a three-storey brick school, tall lights in long rows, a canopy over its doors', use: 'dwelling', frontage: [36, 95], corner: 0, depth: [30, 48], building: [13, 18], setback: [5, 9], side: [4, 12], storeys: [3, 3], rear: 'court', front: { canopy: true }, pad: { least: 0.3, most: 1.8 },
        style: { from: 'walk-up', read: 'a collegiate brick school: three storeys of tall lights between stone bands, a deep cornice', language: { elements: { lights: { w: 1.4, h: 2, bay: 3.2 } }, compose: { mass: { w: 44, d: 16 } } }, palette: { stone: '#9a4f3a' } } },
      apartments: { read: 'a brick walk-up, four storeys, its entrance under a canopy, a lawn before it and a lot behind', use: 'dwelling', frontage: [24, 34], corner: 2, depth: [36, 42], building: [12, 15], setback: [5, 7], side: [3, 5], storeys: [4, 4], style: 'walk-up', rear: 'service', front: { canopy: true }, pad: { least: 0.45, most: 1.8 } },
    },
    // AN EVOCATION's counts: houses a row, shops a row, walk-ups a row; a segment's rows recut when what it is composed
    // with stretches them past `stretch`
    evoke: { houses: [3, 4], shops: [8, 11], apartments: [1, 1], mansions: [0, 2], stretch: [0.85, 1.2] },
    // THE MIDTOWN MANSION: a much larger property than its street's, two at most in a block segment (`evoke.mansions`),
    // among its houses: its frontage (`plot.mansion`), its house deeper behind a wider lawn (`setback`, over the face's),
    // three storeys of its own types, a driveway down one side yard to a garage in its back garden, a pool there
    mansion: {
      read: 'a midtown mansion: a big revival house well back on a wide lawn, its drive down one side to a garage in a deep garden',
      setback: [2.5, 4.5], depth: [11, 13.5], side: { drive: [3.8, 4.6], other: [1.6, 2.6] }, drive: 3, garage: { w: 6, d: 6.5, gap: 2 },
      pad: { least: 0.3, most: 0.9 },
      types: {
        tudor: { read: 'a Tudor revival: a stone ground storey, half-timbered stucco above, steep clay-tiled gables, leaded lights', weight: 2, storeys: [3, 3],
          style: { language: { elements: { wall: { storeys: [{ group: 'str:shell', value: 0.5, bond: 'coursed' }, { group: 'str:plaster', value: 0.86, bond: 'none' }] }, roof: { form: 'gable', pitch: 56, eave: 0.5, group: 'str:tile', value: 0.4 }, frame: { member: 0.2, value: 0.2 }, lights: { w: 1.2, h: 1.7, glazing: 'lattice' } }, compose: { mass: { w: 14, d: 16 } } }, materials: { shell: 'ashlar', plaster: 'stucco', roof: 'clay-tile' }, palette: { shell: '#8f8270', plaster: '#ece4d2', timber: '#3b2b22' } },
          front: { bay: 'canted', bayStoreys: 2, porch: 'door' } },
        georgian: { read: 'a Georgian revival: red brick in three even storeys under a low hip, sash lights, a pilastered door under its fanlight, quoins', weight: 2, storeys: [3, 3],
          style: { language: { elements: { roof: { form: 'hip', pitch: 30 }, lights: { w: 1.1, h: 1.9, glazing: 'sash' }, door: { surround: 'pilasters', fanlight: 'arch', leaf: 'panels' }, cornice: { kind: 'cornice', h: 0.4, proud: 0.25, group: 'str:paint', value: 0.9 }, quoins: { kind: 'quoins', w: 0.35, course: 0.3, group: 'str:plaster', value: 0.88 } }, compose: { mass: { w: 15, d: 14 } } }, palette: { stone: '#9c5440' } },
          front: { porch: 'door' } },
        richardsonian: { read: 'an Annex Romanesque: a rough sandstone ground storey, round-arched lights, brick above under a steep hip, a porch across its front', weight: 1, storeys: [3, 3],
          style: { language: { elements: { wall: { storeys: [{ group: 'str:shell', value: 0.45, bond: 'rubble' }, { group: 'str:stone', value: 0.46, bond: 'brick' }] }, roof: { form: 'hip', pitch: 46 }, lights: { form: 'arch', w: 1.1 } }, compose: { mass: { w: 14, d: 16 } } }, materials: { shell: 'ashlar' }, palette: { shell: '#9c6a52' } },
          front: { bay: 'square', bayStoreys: 'upper', porch: 'full' } },
      },
      yards: { near: { patio: 2, deck: 1 }, mid: { pool: 3, lawn: 1 }, back: { tree: 2, beds: 1, shed: 1 }, balcony: 0.6 },
    },
    // THE SITES (sites.js), each PROPORTIONED to the block it is given (its share of the site, the metres a clamp): its
    // `site` rails (metres along its front street and into the block, the town to scale's; an evocation's tuned to its
    // cells), a school's lot (its share of the site's length and depth), its staff lot, its setback and building (shares
    // of its lot), the lawn round its field, its track (a lane band, the least field that holds one); a sports field's
    // front strip, lot, field house, courts (from a site this long, each court's ground, the most); a park's path, its
    // playground and pavilion
    sites: {
      school: { read: 'a public school: a brick building on its street, a schoolyard of courts behind it, a staff lot beside it, a field and a track behind', site: { long: [120, 150], deep: [80, 100] }, lot: { long: 0.48, deep: 0.42 }, parking: 0.18, setback: 0.2, building: { deep: 0.42, side: 0.12 }, margin: 4, track: { band: 5, least: [70, 38] } },
      sports: { read: 'a local sports field: a ball diamond, a pitch under its lights and its bleachers, tennis courts, a field house and its lot', site: { long: [120, 150], deep: [80, 100] }, front: 0.14, parking: 0.2, house: { w: 12, d: 8 }, margin: 3, courts: { from: 110, w: 36, d: 18, most: 3 } },
      park: { read: 'a neighbourhood park: two paths across it, a playground on its chips, a pavilion and its picnic tables, benches along the paths', path: 2.4, playground: { w: 16, d: 12 }, pavilion: { w: 9, d: 6 }, bench: 16 },
    },
    // THE STREETSCAPES: how close the neighbourhood is to the city, read from its sidewalk (the first the default). Each
    // changes the pattern a level deep: its street section, its plots, mix, block, house and setback (how far a house
    // stands from its walk), its back yard's least, its evocation's counts; and says its street TREES (`stride` m between
    // them, `share` of those planted: each still needs room to stand twice a person's height), its PARKING (`sides` of a
    // street parked, a lane `lane` m wide; the `share` of stalls with a car; `pads` the share of deep, near-level front
    // yards with a parking pad; `least` stalls a household, the law's), and its GATES (`share` of fronts behind one, its
    // `kinds` by weight: iron, wall, picket)
    streetscapes: {
      leafy: { read: 'a streetcar suburb: a wide boulevard of maples between the kerb and the walk, deep front lawns, cars parked on one side, a gate here and there',
        trees: { stride: 9, share: 1 }, parking: { sides: 'one', lane: 2.2, share: 0.55, pads: 0.25, least: 0.5 }, gates: { share: 0.2, kinds: { picket: 2, wall: 1, iron: 1 } } },
      snug: { read: 'closer to the city: a narrow strip of grass by the kerb and a tree here and there, narrow lots of semis a few steps from the walk, cars parked both sides, most fronts behind a low railing and its gate',
        street: { verge: 1.2, walk: 1.6 }, plot: { semi: [5.6, 6.4], detached: [6.6, 8.2], corner: 1 }, mix: { semi: 0.7, detached: 0.3 }, block: { depth: [27, 32] }, setback: [2, 3.2], house: { depth: [10, 12.5], side: [0.45, 0.9] }, back: 6,
        evoke: { houses: [4, 5], mansions: [0, 0] },
        trees: { stride: 13, share: 0.45 }, parking: { sides: 'both', lane: 2.1, share: 0.75, pads: 0, least: 0.6 }, gates: { share: 0.65, kinds: { iron: 3, wall: 2, picket: 1 } } },
      urban: { read: 'the city: the walk paved from the kerb to the houses\' steps and no trees on it, row-tight lots of three storeys with stoops a metre or two from the walk, cars parked both sides, every front behind its railing',
        street: { verge: 0, walk: 2.6 }, plot: { semi: [5.6, 6], detached: [6, 7], corner: 0.8 }, mix: { semi: 0.85, detached: 0.15 }, block: { depth: [24, 28] }, setback: [0.8, 1.8], house: { depth: [10, 12], storeys: [3, 3], side: [0.3, 0.6] }, back: 5,
        evoke: { houses: [5, 6], mansions: [0, 0] },
        trees: { stride: 9, share: 0 }, parking: { sides: 'both', lane: 2.1, share: 0.85, pads: 0, least: 0.5 }, gates: { share: 1, kinds: { iron: 3, wall: 1 } } },
    },
    // THE NEIGHBOURHOODS its segments compose: `layout` rows of letters north to south (H houses, M main-street, A
    // apartments, P park: SEGMENT_LETTERS), `main` the streets that are main (ew-0 the southmost east-west, ns-0 the
    // westmost north-south)
    neighbourhoods: {
      annex: { read: 'an Annex: houses on their long streets, a parkette, a walk-up among the houses, the main street\'s shops along the south', layout: ['HHP', 'HAH', 'MMM'], main: ['ew-0'] },
      'main-street': { read: 'a main street of shops both sides, houses behind them', layout: ['MM', 'MM'], main: ['ew-1'] },
      'quiet-streets': { read: 'houses only, a park among them', layout: ['HH', 'HP'], main: [] },
      'school-and-field': { read: 'a school on the main street, its field behind it, houses and a park between it and a sports field to the north', layout: ['FFH', 'HPH', 'SSM'], main: ['ew-0'] },
    },
  },
});
export const PATTERN_IDS = Object.freeze(Object.keys(PATTERNS));
export const STREETSCAPE_SETTINGS = Object.freeze(['setback', 'gates', 'parking', 'trees']);
export const GATE_SHARES = Object.freeze({ none: 0, some: 0.35, most: 0.7, all: 1 });
export const PARKING_SIDES = Object.freeze(['none', 'one', 'both']);
// a gate's kinds (scene.js draws them): an iron railing, a low brick wall and its piers, a picket
export const GATE_KINDS = Object.freeze(['iron', 'wall', 'picket']);
export const DEFAULT_PATTERN = 'bay-and-gable';

/** A street's right-of-way by its rank: its carriageway's half (`R`), the kerb, what stands by the kerb (`edge`: a
 *  verge, or a main street's furnishing strip) and how wide, each side's walk, the half and the whole. */
export function sectionOf(P, rank = 'street') {
  const S = rank === 'main' ? P.main : P.street, R = S.road / 2, half = R + S.verge + S.walk;
  return { rank, R, kerb: S.kerb, edge: S.edge ?? 'verge', verge: S.verge, walk: S.walk, half, row: 2 * half };
}
/** The residential street's right-of-way. */
export const rowOf = (P) => sectionOf(P, 'street');
