/**
 * New Kingdom Thebes (Egypt, c. 1550–1070 BCE; read at c. 1250, the Ramesside town) as a composition of
 * shared patterns (../patterns.js): what it builds, in what colours, at what scale. A big visual read —
 * the cited notes behind it live in ../record/egypt.js. Laid out by ../layouts/thebes.js ('river-axis'):
 * the Nile along the town, the temple of Amun on an axis from its river quay.
 *
 * Kept to what a New Kingdom town had (../record/egypt.js): no pan-bedded (wavy-course) brick and no
 * Karnak first pylon or great enclosure wall (Late Period / 30th Dynasty); no lime whitewash (Ptolemaic —
 * gypsum here); masonry in courses of varying height, not uniform ashlar. The temple's sequence —
 * pylon with obelisks and colossi, court, second pylon, hypostyle, sanctuary — is Luxor's under
 * Ramesses II; the ram-sphinx avenue before it is Karnak's.
 */
import { EGYPT_ASSETS } from '../assets/egypt.js';
import { EGYPT_RECORD, EGYPT_SOURCES } from '../record/egypt.js';
import { EGYPT_INDUSTRY_RECORD } from '../record/egypt-industry.js';

export const THEBES = {
  label: 'New Kingdom Thebes',
  years: [-1550, -1070],
  readAt: -1250,                 // the Ramesside town (header)
  period: 'New Kingdom',
  place: 'Thebes, Upper Egypt',
  region: 'egypt',
  land: 'egypt',                  // its farm and works: New Kingdom Egypt's (../farmstead.js, ../workshops.js)
  // history (../lineage.js): the Egyptian building tradition a millennium on from Giza's
  draws: [{ from: 'giza', kind: 'continues', parts: ['patterns', 'skins', 'record'], note: 'the same land and building tradition, a millennium later' }],
  aliases: ['waset', 'luxor', 'karnak', 'ramesside', 'ramesses', 'pharaoh', 'temple of amun'],   // what people call it (search)
  // what its town, land, farm and works stand on (the encyclopedia entry's basis)
  record: { id: 'egypt', entries: [...EGYPT_RECORD, ...EGYPT_INDUSTRY_RECORD], sources: EGYPT_SOURCES },
  layout: 'river-axis',
  palette: {
    ground: '#c9b48e',            // the desert-edge earth under the town
    lane: '#b9a07c',              // beaten Nile mud, paler with traffic
    street: '#c2ab84',            // the processional ways, packed and swept
    paving: '#d6c29a',            // sandstone flags: the temple courts, the quay
    court: '#cdb892',
    field: ['#6f8f45', '#86a050', '#9aab5c', '#b8b06a'],   // flood-plain fields, green to stubble
    water: '#4f7f86',             // the Nile, silty green-blue
    bank: '#7d6a50',              // the wet mud of the river bank
    reed: '#c8ad62',
    mud: '#7a6650',               // Nile mud brick: darker and greyer than the alluvium of Sumer
    earth: ['#8a7458', '#7f6a52', '#94806a', '#857058'],   // mud brick houses, bare or mud-rendered
    whitewash: ['#ece6d8', '#e6dfcf'],
    sandstone: '#cdb48a',         // Gebel el-Silsila sandstone: the temples of Thebes
    limestone: '#ddd3bd',
    granite: '#8a5f55',           // Aswan red granite: obelisks, colossi
    blackGranite: '#3c3a3a',
    gold: '#d8b04a',              // electrum and gold leaf: obelisk caps, flagstaff tips
    blue: '#2f5f9e',              // Egyptian blue
    red: '#a8442e',               // red ochre
    yellow: '#d2a23c',            // yellow ochre
    green: '#3f7a5a',             // malachite green
    cedar: '#8a5a3a',             // flagstaffs, ship hulls
    linen: '#efe6d0',             // sails, pennants
    palmwood: '#7a6448',
    bridge: '#6e5a42',            // timber (the shared granary's pegs)
    stair: '#d0bc94',
    platform: '#cdb48a',
    wall: '#7a6650',
    precinctFloor: '#d6c29a',
    stone: '#cdb48a',             // what the shared art pieces carve in here (stelae)
    copper: '#a8653a', patina: '#6e8c77', alabaster: '#e9e2cf', lapis: '#2f4f8f', mosaic: ['#a8442e', '#2b2724', '#efe9dc'],
  },
  // what each mass is made of, read on its face (../ground.js WALL_SKINS): temples in sandstone ashlar,
  // their pylons and walls carved and painted, obelisks and colossi in granite, the enclosure and the
  // town in Nile mud brick, houses rendered or whitewashed
  skins: {
    kinds: {
      pylon: 'pylon-relief', 'temple-wall': 'painted-relief', 'gate-frame': 'sandstone', cornice: 'sandstone', torus: 'sandstone',
      column: 'painted-bands', 'column-capital': 'painted-bands', abacus: 'sandstone', architrave: 'painted-bands', 'temple-roof': 'sandstone', clerestory: 'sandstone',
      sanctuary: 'painted-relief', 'shrine-wall': 'painted-relief', pedestal: 'sandstone', plinth: 'sandstone', quay: 'sandstone', 'quay-stair': 'sandstone', 'lake-wall': 'sandstone',
      'temenos-wall': 'nile-brick', 'storeroom': 'nile-brick', silo: 'mud-plaster', 'yard-wall': 'nile-brick', 'garden-wall': 'nile-brick',
      house: 'mud-plaster', 'house-parapet': 'mud-plaster', 'house-roof': 'mud-plaster', 'villa': 'gypsum-wash', 'villa-hall': 'gypsum-wash',
      'stair-cheek': 'sandstone', terrace: 'sandstone',
    },
    whitewash: 'gypsum-wash',   // gypsum: lime plaster is Ptolemaic
    bare: { share: 0.25, from: 'mud-plaster', skin: 'nile-brick' },
  },
  patterns: ['sun-dried-earth', 'whitewash', 'flat-roof-cube', 'courtyard-house', 'blank-wall', 'sacred-precinct', 'grove-fringe',
    'stone-ashlar', 'painted-relief', 'pylon-gate', 'obelisk', 'colonnade', 'hypostyle', 'processional-axis', 'river-front', 'sacred-lake',
    'guardians', 'door-emblem', 'colossus', 'stele', 'altar', 'granary', 'boat', 'shaduf'],
  // scale, metres
  house: { size: [7, 14], height: [4.5, 8.5], villaMin: 13, gap: 0.45, whitewash: 0.3 },
  lanes: { main: 3, alley: 1, block: [6, 8] },
  river: { width: 70, sink: 2.6, bank: 9 },        // the Nile strip in frame; the water lies `sink` below the town; sloped bank `bank` m
  temenos: { size: [210, 150], wall: 6, height: 10 },
  temple: { pylon: [62, 11, 24], court: [46, 40], pylon2: [44, 9, 18], hypostyle: [46, 34], sanctuary: [24, 30], clear: 8 },   // the Luxor pylon ≈ 65 × 24 m; the rest a reduced big read
  avenue: { width: 12, sphinxEvery: 4.2 },
  lake: [40, 26],
  groves: { density: 0.6, max: 160 },
  assets: EGYPT_ASSETS,
};
