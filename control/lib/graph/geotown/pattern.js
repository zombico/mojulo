/**
 * THE GEOTOWN'S CARDS — what a neighbourhood is made of before anything is drawn: its SURFACES (every square metre of
 * the map is one of them, and each says what may grow on it) and its PATTERNS (a block pattern: the street's section, the
 * block's length and depth, the plots it is cut into and the houses' share of each, the laws' numbers). A pattern is
 * data: a new neighbourhood is a card, not code. Its houses speak its `style` (era/arch-style.js): how they look in
 * general (their language: mass, cap, lights, door, socle), the finishes their material words.
 *
 *   SURFACES        { <surface>: { read, grows: [growth…], soft } }: `grows` what the scene may put on it (grass, a
 *                   street tree, a tree, a shrub), none on a hard surface; `soft` whether it counts as green ground
 *   PATTERNS        { <id>: the pattern }; PATTERN_IDS; DEFAULT_PATTERN
 *   rowOf(P)        the pattern's right-of-way: { road, kerb, verge, walk, half, row }
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
});
export const SURFACE_IDS = Object.freeze(Object.keys(SURFACES));

export const PATTERNS = Object.freeze({
  'bay-and-gable': {
    read: 'a Victorian and Edwardian streetcar suburb (a Toronto Annex): long blocks of brick semis and detached houses, two and a half storeys with their gables to the street, each behind a front yard and a boulevard of maples, a deep back yard behind',
    // the houses' architectural style (era/arch-style.js): their language and material words, unless the recipe names one
    style: 'bay-and-gable',
    // the right-of-way: the carriageway (two lanes and a parked side), and each side's kerb, boulevard and walk
    street: { road: 8.5, kerb: 0.15, verge: 3, walk: 1.8 },
    // a block's length along its houses' street (one per row of blocks), and each row of plots' depth (one per town: the
    // streets run straight); a block is two rows deep, back to back
    block: { long: [150, 210], depth: [34, 40] },
    // a plot's frontage by its house's form; a corner plot is wider by `corner`, its flank a side yard to the cross street
    plot: { semi: [6.2, 7.6], detached: [8.5, 11], corner: 1.6 },
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
    // a park's paths: a cross through its middle
    parkPath: 2.4,
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
    grow: { stride: 9, back: [0, 2], front: 0.4, park: 60, street: ['maple'], trees: ['maple', 'cherry'], parkTrees: ['maple', 'beech'] },
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
    // an evocation's back yards, each its own (yards.js YARDS: lawn, garden, patio, deck, shed, play), and the fences
    // between them (yards.js FENCES: board, picket, hedge); `weight` each one's share
    yards: { lawn: 2, garden: 2, patio: 2, deck: 2, shed: 2, play: 1 },
    fences: { board: 3, picket: 1, hedge: 1 },
  },
});
export const PATTERN_IDS = Object.freeze(Object.keys(PATTERNS));
export const DEFAULT_PATTERN = 'bay-and-gable';

/** The pattern's right-of-way: its carriageway's half (`R`), the kerb, each side's verge and walk, the half and the whole. */
export function rowOf(P) {
  const S = P.street, R = S.road / 2, half = R + S.verge + S.walk;
  return { R, kerb: S.kerb, verge: S.verge, walk: S.walk, half, row: 2 * half };
}
