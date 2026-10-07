/**
 * The record behind the Sumerian countryside (../assets/sumer-farm.js): the tools a temple estate
 * farmed with and the buildings it raised in the fields. Same format and checks as ./sumer.js
 * (../record.js); it builds on that record's materials, so check the two together.
 *
 * Every entry here is 'unverified' or 'secondary': these are the standard accounts, and no source was
 * read for this pass. The gaps are the point of recording them; checkRecord reports each one.
 */
import { SUMER_SOURCES as S0 } from './sumer.js';

const S = {
  ...S0,
  civil94: { author: 'M. Civil', title: 'The Farmer\'s Instructions: A Sumerian Agricultural Manual (Aula Orientalis Supplementa 5)', year: 1994 },
  postgate92: { author: 'J. N. Postgate', title: 'Early Mesopotamia: Society and Economy at the Dawn of History', year: 1992 },
  littauer79: { author: 'M. A. Littauer, J. H. Crouwel', title: 'Wheeled Vehicles and Ridden Animals in the Ancient Near East', year: 1979 },
  hoePlough: { author: 'ETCSL (Oxford)', title: 'The debate between Hoe and Plough (ETCSL 5.3.1)', year: 2006, url: 'https://etcsl.orinst.ox.ac.uk/section5/tr531.htm' },
  standardUr: { author: 'British Museum', title: 'The Standard of Ur (object text)', year: 2024, url: 'https://www.britishmuseum.org/collection/object/W_1928-1010-3' },
  ubaidFrieze: { author: 'H. R. Hall, C. L. Woolley', title: 'Ur Excavations I: Al-\'Ubaid', year: 1927 },
  urukTrough: { author: 'British Museum', title: 'Stone trough with a reed byre, cattle and ringed reed posts (Uruk period)', year: 2024 },
  benco92: { author: 'N. Benco', title: 'Manufacture and use of clay sickles from the Uruk mound, Abu Salabikh, Iraq (Paléorient 18:1)', year: 1992 },
};

// ── materials the countryside adds to the town's ──
const MATERIALS = [
  {
    id: 'fired-clay', kind: 'material', name: 'fired clay (pottery fabric): sickles, jars, measures, sealings', confidence: 'secondary',
    attested: { from: -5400, to: null, approx: true, where: ['Ubaid and Uruk sites across southern Mesopotamia'] }, supply: 'river clay, tempered, fired in kilns',
    role: ['structure', 'ornament'], colour: ['#b0744c', '#a8653a'],
    notes: 'Clay sickles are the commonest harvest tool of the Ubaid and Uruk periods; jars and measures carried and counted the grain.',
    sources: [S.benco92, S.moorey94],
  },
  {
    id: 'flint', kind: 'material', name: 'flint and chert blades', confidence: 'unverified',
    attested: { from: -5400, to: null, approx: true, where: ['southern Mesopotamia (imported stone)'] }, supply: 'imported nodules, knapped into blades and teeth',
    role: ['structure'], notes: 'Sickle teeth and the chips set into the underside of a threshing sledge.', sources: [S.moorey94],
  },
  {
    id: 'copper', kind: 'material', name: 'copper (cast and hammered)', confidence: 'unverified',
    attested: { from: -3500, to: null, approx: true, where: ['Uruk', 'Ur'] }, supply: 'imported ore and ingots',
    role: ['structure', 'ornament'], colour: ['#a8653a'], notes: 'Hoe and sickle blades in the Early Dynastic period; wheel-tyre nails on the Ur wagons.', sources: [S.moorey94],
  },
];

// ── methods ──
const METHODS = [
  {
    id: 'basin-irrigation', kind: 'method', name: 'irrigation by gravity from canal levees through sluiced channels', confidence: 'unverified',
    attested: { from: -5000, to: null, approx: true }, materials: ['palm-timber', 'reed'],
    notes: 'Branch canals on raised levees feed field channels through regulators of timber and reed; long strip fields run back from the canal. The baked-brick sluice is later, once kilns are in use (from c. 3800 BCE).',
    sources: [S.postgate92],
  },
  {
    id: 'sledge-threshing', kind: 'method', name: 'threshing by sledge on a beaten floor, winnowing, heaping and sealing', confidence: 'unverified',
    attested: { from: -3500, to: null, approx: true }, materials: ['palm-timber', 'flint', 'fired-clay'],
    notes: 'Sheaves trodden or sledged on a round floor; the threshed grain heaped, its heap capped in mud and sealed until measured out.',
    sources: [S.civil94, S.postgate92],
  },
];

// ── tools and farm buildings, as types ──
const TYPES = [
  {
    id: 'ard-plough', kind: 'type', name: 'ard plough (apin), ox-drawn', confidence: 'unverified',
    built: { from: -3500, to: null, approx: true }, materials: ['palm-timber'],
    notes: 'The APIN sign of the archaic Uruk tablets is a plough; drawn by an ox pair under a neck yoke.', sources: [S.postgate92, S.hoePlough],
  },
  {
    id: 'seeder-plough', kind: 'type', name: 'seeder plough: an ard with a seed funnel', confidence: 'unverified',
    built: { from: -2500, to: null, approx: true }, materials: ['palm-timber'], methods: ['basin-irrigation'],
    notes: 'Seed dropped down a tube behind the share; described in the Farmer\'s Instructions, shown on later seals. Its first date is disputed.',
    disputes: ['Some place the seeder plough in the Uruk period from the archaic signs; the clear depictions are later.'],
    sources: [S.civil94, S.postgate92],
  },
  {
    id: 'clay-sickle', kind: 'type', name: 'sickle of fired clay (later flint-toothed, then copper)', confidence: 'secondary',
    built: { from: -5000, to: -3000, approx: true }, materials: ['fired-clay'],
    notes: 'Crescent sickles of hard-fired clay, by the thousand on Ubaid and Uruk sites. Sumer reaped with sickles; the scythe is Iron Age.',
    sources: [S.benco92],
  },
  {
    id: 'hoe', kind: 'type', name: 'hoe and mattock', confidence: 'unverified',
    built: { from: -5000, to: null, approx: true }, materials: ['palm-timber', 'flint'],
    notes: 'The hoe broke the ground the plough could not and cleaned the channels — the hero of the Sumerian debate between Hoe and Plough. Stone- and wood-bladed first; copper blades from the 3rd millennium.',
    sources: [S.hoePlough],
  },
  {
    id: 'solid-wheel-cart', kind: 'type', name: 'cart and wagon on solid three-plank wheels', confidence: 'secondary',
    built: { from: -2900, to: null, approx: true }, materials: ['imported-timber', 'palm-timber', 'copper'],
    notes: 'Two- and four-wheeled vehicles on tripartite disc wheels, a tall front board on the wagon; drawn by donkeys, onager hybrids and oxen.',
    sources: [S.littauer79, S.standardUr],
  },
  {
    id: 'threshing-sledge', kind: 'type', name: 'threshing sledge', confidence: 'unverified',
    built: { from: -3500, to: null, approx: true }, materials: ['palm-timber', 'flint'], methods: ['sledge-threshing'],
    notes: 'A heavy board, front curled up, its underside set with flint chips; weighted with stones and dragged round the floor.',
    sources: [S.civil94],
  },
  {
    id: 'shaduf', kind: 'type', name: 'shaduf (counterweighted lifting sweep)', confidence: 'unverified',
    built: { from: -2350, to: null, approx: true }, materials: ['palm-timber', 'mudbrick-uruk'], methods: ['basin-irrigation'],
    notes: 'First shown on Akkadian seals — at the very end of the Sumerian span; kept as the tool the countryside was about to have.',
    sources: [S.postgate92],
  },
  {
    id: 'reed-byre', kind: 'type', name: 'reed byre with its dairy', confidence: 'secondary',
    built: { from: -3300, to: null, approx: true }, materials: ['reed'],
    notes: 'A reed barrel with ringed reed posts through its roof, calves at the door (the Uruk trough); milking and churning before a reed byre (the al-Ubaid frieze, c. 2500 BCE).',
    sources: [S.urukTrough, S.ubaidFrieze],
  },
  {
    id: 'storehouse', kind: 'type', name: 'grain storehouse filled from the roof', confidence: 'unverified',
    built: { from: -3500, to: null, approx: true }, materials: ['mudbrick-uruk', 'mud-plaster', 'fired-clay'], methods: ['flat-roof'],
    notes: 'Blind mud-brick stores, their doors sealed with clay sealings over a peg; grain carried up and poured in through the roof.',
    sources: [S.postgate92],
  },
  {
    id: 'farmstead', kind: 'type', name: 'estate farmstead: house and yard, stable, fold, threshing floor', confidence: 'unverified',
    built: { from: -3000, to: null, approx: true }, materials: ['mudbrick-uruk', 'mud-plaster', 'reed', 'palm-timber'],
    notes: 'The temple and palace estates worked the land in units with their own yards, stores and draught animals; no farmstead plan is in hand.',
    sources: [S.postgate92],
  },
];

const FORMS = [
  {
    id: 'strip-fields', kind: 'form', name: 'long strip fields running back from a canal', confidence: 'unverified',
    attested: { from: -3000, to: null, approx: true }, notes: 'Fields many times longer than wide, each with its head on a watercourse; a biennial fallow left half of them resting.',
    sources: [S.postgate92, S.civil94],
  },
];

export const SUMER_FARM_RECORD = [...MATERIALS, ...METHODS, ...TYPES, ...FORMS];
