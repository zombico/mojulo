/**
 * historic/form/towns — each culture's town as a FORM (./schema.js): the principles its town is laid out by, read off
 * its record's urban forms (`cites`) and the measures its card already carried. One entry per culture; a variant is
 * `{ from, …changes }` (the polis is Lindos on a gentle hill). The solver (../solver/) lays any of them at any frame.
 * Numbers are metres.
 */
import { readForm } from './schema.js';

const SUMER = {
  label: 'an Uruk-period city on its canal',
  frame: { town: [380, 290], region: [900, 660] },
  site: { landform: 'flat' },
  water: { kind: 'canal', width: 9, sink: 1.5, bridge: 'canal-bridge' },
  armature: { kind: 'heart', monument: 'anu-ziggurat', at: [0.5, 0.36], precinct: { margin: 34, back: 6, thickness: 2.2, height: 5, terrace: 1.2, floor: 'brick' } },
  enclosure: { kind: 'ring', thickness: 6, towerEvery: 26, gates: 4, strip: 4, extent: [0.8, 0.8] },
  streets: { pattern: 'meander', main: 9, alley: 3, block: [27, 21], jog: 0.08, branches: 40, surface: { main: 'rubble', alley: 'mud' } },
  density: { lot: [8, 17], gap: 0.45 },
  houses: [{ asset: 'house-court', minSide: 11 }, { asset: 'house-tall', minArea: 120 }, { asset: 'house-small' }],
  walls: { run: 'wall-run', tower: 'wall-tower', gate: 'city-gate' },
  placement: [
    { asset: 'white-temple', where: 'precinct', size: [18, 22] },
    { asset: 'pillar-hall', where: 'precinct', size: [22, 18] },
    { asset: 'ritual-vase', where: 'monument-front', size: [14, 1.4] },
    { asset: 'guardians', where: 'monument-front', size: [22, 3.4] },
    { asset: 'altar', where: 'monument-front', size: [6, 6] },
    { asset: 'votive-row', where: 'precinct', size: [24, 2.6] },
    { asset: 'door-posts', where: 'precinct-gate', size: [11, 1.4] },
    { asset: 'stele', where: 'precinct-gate', size: [2.8, 2.2] },
    { asset: 'granary', where: 'near-monument', max: 2 },
    { asset: 'well', where: 'crossing', max: 7, every: 55, size: [2.9, 2.9] },
    { asset: 'pottery-kiln', where: 'wall-strip', max: 5, size: [4, 4] },
    { asset: 'reed-house', where: 'bank', max: 24, every: 14, size: [6, 11] },
    { asset: 'reed-boat', where: 'water', max: 10, every: 30, size: [10, 2.2] },
  ],
  hinterland: { fields: 0.35, trees: 0.6, tree: 'palm', max: 160 },
  activities: [
    { id: 'farmstead', read: 'an estate farmstead: house and yard, stores, the threshing floor, byre and fold', kit: 'farm', where: 'fields', pieces: ['farmhouse', 'storehouse', 'threshing-floor', 'reed-byre', 'sheepfold', 'plough'] },
    { id: 'brickworks', read: 'clay pits, brick fields and kilns where the clay is good', kit: 'works', where: 'upstream', pieces: ['clay-pit', 'brick-field', 'brick-kiln', 'potters-yard'] },
    { id: 'harbour', read: 'the kar: stone and bitumen landed, stores, smiths', kit: 'works', where: 'downstream', pieces: ['stone-landing', 'bitumen-works', 'reed-store', 'copper-workshop'], cites: ['sumer/kar'] },
  ],
  cites: { water: ['sumer/uruk-canals'], armature: ['sumer/uruk-precincts'], streets: ['sumer/lanes-and-quarters'], hinterland: ['sumer/irrigated-hinterland'], activities: ['sumer/craft-quarter'] },
};

const THEBES = {
  label: 'a New Kingdom temple town on the Nile',
  frame: { town: [440, 330], region: [900, 680] },
  site: { landform: 'flat' },
  water: { kind: 'river', side: 'w', width: 70, sink: 2.6, bank: 9, flows: 'n' },   // the Nile runs north: upstream is south
  armature: {
    kind: 'axis', monument: 'luxor-temple', at: [0.56, 0.5],
    approach: { width: 12, flank: 'eg-sphinx-row', flankDepth: 6, quay: 'eg-quay', quaySize: [26, 16], way: 12 },
    precinct: { margin: 36, back: 10, wall: 'eg-temenos-wall', gate: 'eg-temenos-gate', thickness: 6, floor: 'dry-earth' },
  },
  enclosure: { kind: 'none', extent: [0.95, 1] },
  streets: { pattern: 'lattice', main: 6, alley: 3, block: [24, 18], jog: 0.03, surface: { main: 'rubble', alley: 'mud' } },
  density: { lot: [7, 14], gap: 0.45 },
  houses: [{ asset: 'eg-villa', minSide: 16 }, { asset: 'eg-house' }],
  placement: [
    { asset: 'eg-sacred-lake', where: 'precinct', size: [40, 26] },
    { asset: 'granary', where: 'precinct', size: [16, 14] },
    { asset: 'granary', where: 'precinct', size: [16, 14] },
    { asset: 'well', where: 'crossing', max: 6, every: 60, size: [2.9, 2.9] },
    { asset: 'eg-shaduf', where: 'bank', max: 10, every: 22, size: [2.8, 6.5] },
    { asset: 'eg-nile-ship', where: 'water', max: 6, every: 40, size: [20, 11] },
  ],
  hinterland: { fields: 0.72, trees: 0.5, tree: 'palm', max: 160, band: 42 },
  activities: [
    { id: 'farmstead', read: 'a farm on the flood plain: the house, the silo court, the threshing floor, the cattle shed and garden', kit: 'farm', where: 'fields', pieces: ['eg-farmhouse', 'eg-silo-court', 'eg-threshing-floor', 'eg-cattle-shed', 'eg-garden'] },
    { id: 'potters', read: 'potters and brickmakers by the river, upstream', kit: 'works', where: 'upstream', pieces: ['clay-pit', 'brick-field', 'eg-potters-yard', 'eg-pottery-kiln'] },
    { id: 'stoneyard', read: 'the stone landed from upriver: the quay, the masons\' yard, the boatyard', kit: 'works', where: 'downstream', pieces: ['eg-stone-quay', 'eg-masons-yard', 'eg-boatyard', 'eg-carpenters'] },
  ],
  cites: { water: ['egypt/east-west-bank'], armature: ['egypt/temple-axis-to-nile', 'egypt/processional-way'], streets: ['egypt/thebes-town'], hinterland: ['egypt/eg-basin-land'], activities: ['egypt/eg-riverside-works', 'egypt/eg-temple-estate'] },
};

const GIZA = {
  label: 'the pyramid plateau and the workers\' town below it',
  frame: { town: [760, 460], region: [1200, 820] },
  site: { landform: 'plateau', high: 'w', relief: 45, edge: 0.5, town: 'low' },
  water: { kind: 'canal', width: 20, sink: 1.5 },
  armature: { kind: 'summit', monument: 'khufu-pyramid', at: [0.26, 0.5], approach: { way: 8 }, precinct: { margin: 36, floor: 'dry-earth' } },
  enclosure: { kind: 'none', extent: [0.9, 0.9] },
  streets: { pattern: 'grid', main: 5, alley: 3, block: [36, 22], surface: { main: 'rubble', alley: 'mud' } },
  density: { lot: [7, 12], gap: 0.4 },
  houses: [{ asset: 'eg-house' }],
  placement: [
    { asset: 'gz-queen-pyramid', where: 'precinct', size: [26, 26] },
    { asset: 'gz-queen-pyramid', where: 'precinct', size: [26, 26] },
    { asset: 'gz-boat-pit', where: 'precinct', size: [44, 6] },
    { monument: 'great-sphinx', where: 'approach' },
  ],
  hinterland: { fields: 0.6, trees: 0.5, tree: 'palm', max: 140 },
  borrow: ['thebes'],
  cites: { site: ['giza/plateau-above-floodplain'], armature: ['giza/pyramid-complex-axis'], streets: ['giza/workers-town-south', 'giza/cemetery-street-grid'] },
};

const LINDOS = {
  label: 'a Hellenistic town under its acropolis, between two harbours',
  frame: { town: [520, 400], region: [900, 700] },
  site: { landform: 'hill', high: 'w', relief: 40, terraces: 3, rock: 106, cliff: true, town: 'both' },
  water: { kind: 'sea', side: 'e', width: 60, sink: 0.4 },
  armature: {
    kind: 'summit', monument: 'athena-lindia', at: [0.8, 0.55], approach: { way: 6 },
    precinct: { margin: 34, back: 30, wall: 'ln-wall', thickness: 2, floor: 'flagstone' },
  },
  enclosure: { kind: 'none', extent: [0.75, 0.85] },
  streets: { pattern: 'contour', main: 4, alley: 2.5, block: [27, 30], jog: 0.1, stairs: 'ln-steps', surface: { main: 'rubble', alley: 'rubble' } },
  density: { lot: [9, 15], gap: 0.4 },
  houses: [{ asset: 'ln-house' }],
  placement: [
    { asset: 'ln-stoa', where: 'precinct', size: [60, 16] },
    { asset: 'ln-propylaia', where: 'precinct', size: [40, 16] },
    { asset: 'ln-statue', where: 'approach', max: 14, every: 7, size: [1.6, 1.6] },
    { asset: 'ln-theatre', where: 'town-edge', max: 1, size: [56, 40] },
    { asset: 'ln-kiln', where: 'town-edge', max: 4, every: 30, size: [5, 5] },
    { asset: 'ln-tomb', where: 'town-edge', max: 2, every: 80, size: [10, 10] },
    { asset: 'ln-boat', where: 'water', max: 8, every: 18, size: [7, 2] },
    { asset: 'ln-trireme', where: 'water', max: 2, every: 60, size: [30, 5] },
  ],
  hinterland: { fields: 0.6, trees: 0.35, tree: 'olive', max: 160 },
  cites: { site: ['lindos/acropolis-sea-cliff'], water: ['lindos/town-between-harbours'], armature: ['lindos/axial-climb'], streets: ['lindos/terraced-streets'] },
};

const QIN = {
  label: 'the Qin capital: a palace on the tableland, walled wards down to the Wei',
  frame: { town: [600, 560], region: [1000, 860] },
  site: { landform: 'bluff', high: 'n', relief: 10, edge: 0.72, town: 'both' },
  water: { kind: 'river', side: 's', width: 80, sink: 2, bank: 4, bridge: 'qn-bridge' },
  armature: {
    kind: 'axis', monument: 'palace-no-1', at: [0.5, 0.17], approach: { width: 20 },
    precinct: { margin: 40, back: 10, wall: 'qn-wall', gate: 'qn-que', thickness: 4, height: 6, floor: 'mud' },
  },
  enclosure: { kind: 'wards', ward: [84, 86], thickness: 2, market: 'qn-market', extent: [0.92, 0.95] },
  streets: { pattern: 'grid', main: 20, alley: 3, block: [33, 24], surface: { main: 'dry-earth', alley: 'mud' } },
  density: { lot: [12, 18], gap: 0.4 },
  houses: [{ asset: 'qn-house' }],
  walls: { run: 'qn-wall', wardGate: 'qn-ward-gate' },
  placement: [
    { asset: 'qn-hall', where: 'precinct', size: [44, 34] },
    { asset: 'qn-hall', where: 'precinct', size: [44, 34] },
    { asset: 'qn-terrace-works', where: 'bank', max: 1, size: [120, 40] },
  ],
  hinterland: { fields: 0.7, trees: 0.5, tree: 'poplar', max: 220 },
  cites: { site: ['qin/xianyang-tableland'], water: ['qin/wei-braided'], armature: ['qin/xianyang-capital'], hinterland: ['qin/dryland-millet-wheat'] },
};

const POMPEII = {
  label: 'a walled Campanian town on its lava spur, round its forum',
  frame: { town: [520, 420], region: [900, 700] },
  site: { landform: 'bluff', high: 'n', relief: 18, edge: 0.12, town: 'high' },
  water: { kind: 'none' },
  armature: { kind: 'forum', monument: 'capitolium', square: [38, 143], at: [0.42, 0.5] },
  enclosure: { kind: 'ring', thickness: 4, towerEvery: 90, gates: 4, strip: 3, extent: [0.86, 0.84] },
  streets: { pattern: 'grid', main: 7.4, alley: 4.5, block: [36, 42], surface: { main: 'flagstone', alley: 'flagstone' } },
  density: { lot: [12, 24], gap: 0.3 },
  houses: [{ asset: 'pp-faun-house', minSide: 32, minArea: 2600 }, { asset: 'pp-shop-house', onMain: true }, { asset: 'pp-house' }],
  walls: { run: 'pp-wall', tower: 'pp-tower', gate: 'pp-gate' },
  placement: [
    { asset: 'pp-arch', where: 'monument-front', size: [8, 3] },
    { asset: 'pp-altar', where: 'monument-front', size: [3, 2] },
    { asset: 'pp-portico', where: 'square-edge', max: 2, size: [143, 6] },
    { asset: 'pp-hall', where: 'square-edge', max: 2, size: [56, 26] },
    { asset: 'pp-equestrian', where: 'square-edge', max: 8, size: [3.5, 1.5] },
    { asset: 'pp-fountain', where: 'crossing', max: 12, every: 60, size: [2, 2] },
    { asset: 'pp-theatre', where: 'town-edge', max: 1, size: [56, 40] },
  ],
  hinterland: { fields: 0.7, trees: 0.3, tree: 'olive', max: 160 },
  activities: [
    { id: 'villa', read: 'a wine farm: the villa, its cellar, the press room, the threshing terrace and the vines', kit: 'farm', where: 'fields', pieces: ['pl-villa', 'pl-cella-vinaria', 'pl-press-room', 'pl-threshing-terrace', 'pl-vine-block'] },
  ],
  cites: { site: ['pompeii/lava-spur'], enclosure: ['pompeii/walled-town'], streets: ['pompeii/old-town', 'pompeii/via-abbondanza'], armature: ['pompeii/forum-square'] },
};

const FORUM = {
  label: 'Rome at its forum in 79 CE',
  frame: { town: [320, 240], region: [700, 520] },
  site: { landform: 'flat' },
  water: { kind: 'none' },
  armature: { kind: 'forum', monument: 'temple-of-castor', square: [122, 52], at: [0.5, 0.5] },
  enclosure: { kind: 'none', extent: [1, 1] },
  streets: { pattern: 'grid', main: 5.5, alley: 4, block: [30, 40], surface: { main: 'flagstone', alley: 'flagstone' } },
  density: { lot: [10, 20], gap: 0.3 },
  houses: [{ asset: 'pp-shop-house', onMain: true }, { asset: 'pp-house' }],
  placement: [
    { monument: 'curia-julia', where: 'square-edge' },
    { asset: 'pp-equestrian', where: 'square-edge', max: 4, size: [3.5, 1.5] },
    { asset: 'pp-fountain', where: 'crossing', max: 8, every: 60, size: [2, 2] },
  ],
  hinterland: { fields: 0, trees: 0.2, tree: 'round', max: 60 },
  borrow: ['pompeii'],
  cites: { armature: ['forum/forum-square'], streets: ['forum/sacra-via', 'forum/vicus-tuscus', 'forum/vicus-iugarius'] },
};

const base = Object.freeze({ sumer: SUMER, thebes: THEBES, giza: GIZA, lindos: LINDOS, qin: QIN, pompeii: POMPEII, forum: FORUM });
/** A form read through another culture's: the culture it starts `from` (depth reads it: the polis's form is Lindos's). */
export const FORM_FROM = Object.freeze({ polis: 'lindos' });
/** Every culture's form, checked; a variant read through its base. */
export const FORMS = Object.freeze({
  ...Object.fromEntries(Object.entries(base).map(([id, f]) => [id, Object.freeze(readForm(f, base))])),
  polis: Object.freeze(readForm({ from: 'lindos', label: 'a Hellenistic polis under its acropolis hill', site: { cliff: false, rock: 46 } }, base)),
});
