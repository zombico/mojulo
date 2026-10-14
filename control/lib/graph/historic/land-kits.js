/**
 * historic/land-kits — the kits the land is worked with, per land (a culture card's `land`, else its id): the FARM
 * (the estate's house, stores, floors, the tools of the season) and the WORKS (the crafts: brick, pottery, stone,
 * metal, boats). Each names its culture card, its assets and its palette, and what its scenes read (a canal's
 * width, the seasons' fields). The solver (./solver/) places their pieces as a town's ACTIVITIES; nothing here lays
 * anything out.
 */
import { SUMER } from './cultures/sumer.js';
import { SUMER_FARM_ASSETS } from './assets/sumer-farm.js';
import { SUMER_WORKS_ASSETS } from './assets/sumer-works.js';
import { EGYPT_COUNTRY } from './cultures/egypt-country.js';
import { EGYPT_FARM_ASSETS } from './assets/egypt-farm.js';
import { EGYPT_WORKS_ASSETS } from './assets/egypt-works.js';
import { POMPEII } from './cultures/pompeii.js';
import { POMPEII_FARM_ASSETS } from './assets/pompeii-land.js';

export const FARM_CULTURES = {
  sumer: {
    culture: SUMER,
    label: 'a Sumerian temple estate',
    assets: { ...SUMER.assets, ...SUMER_FARM_ASSETS },
    palette: {
      ...SUMER.palette,
      wool: '#e3d8bf',
      cloth: '#d8cdb2',                         // undyed wool and linen
      wood: '#7a6146',                          // poplar, tamarisk, palm
      grain: '#d8b65e',                         // ripe barley
      straw: '#c9b27a',
      chaff: '#e2cf96',
      tilled: '#8d7454',                        // fresh-turned alluvium
      fallow: '#b39c78',
      floor: '#b8a27c',                         // the threshing floor's beaten earth
      garden: '#6f8a45',
    },
    canal: { width: 10, sink: 1.0 },            // the branch canal the estate draws from; water 1 m under its banks
    fields: { channels: 6, pitch: 34, bank: 1.2, channel: 1.4 },   // field channels across the canal's line, their spacing (m)
  },
  egypt: {
    culture: EGYPT_COUNTRY,
    label: 'an estate of Amun on the Theban flood plain',
    assets: { stook: SUMER_FARM_ASSETS.stook, ...EGYPT_FARM_ASSETS },
    palette: EGYPT_COUNTRY.palette,
    canal: { width: 12, sink: 1.4 },            // a feeder canal off the Nile, deeper: it must still run when the river falls
    fields: { channels: 6, pitch: 34, bank: 1.4, channel: 1.4 },   // basin dykes with their channels
    roles: {
      plough: 'eg-ard', harvest: 'eg-harvest-edge', cart: 'eg-grain-packs', wagon: 'eg-scribes-shade', store: 'eg-silo-court', stable: 'eg-stable', byre: 'eg-cattle-shed',
      floor: 'eg-threshing-floor', fold: 'eg-fold', house: 'eg-farmhouse', shed: 'eg-tool-shed', shaduf: 'eg-pillar-shaduf', sluice: 'eg-sluice',
    },
    highCut: 0.45,                              // Egypt reaped under the ear: the straw stands this high after the sickle
    seasons: {
      // shemu: the grain cut high and carried off on donkeys, the flax pulled; no ploughing until the water has come and gone
      harvest: [{ crop: 'ripe', reapers: true }, { crop: 'stubble', stooks: true, cart: true }, { crop: 'flax' }, { crop: 'ripe' }, { crop: 'stubble', stooks: true }],
      // peret: the water gone, the seed broadcast on the wet silt and ploughed or trodden in
      sowing: [{ crop: 'furrows', plough: 'seeder' }, { crop: 'sown' }, { crop: 'mud' }, { crop: 'sown' }, { crop: 'furrows' }],
      // akhet: the basins under the flood
      flood: [{ crop: 'flood' }, { crop: 'flood' }, { crop: 'flood' }, { crop: 'flood' }, { crop: 'flood' }],
    },
    garden: true,                               // the garden south of the fold: beds and pool, vines and press, the bees
  },
};
// Pompeii's farm is not a flood plain: a villa rustica on the Vesuvian slope at the vintage, from its own record
// (./record/pompeii-land.js) and kit (./assets/pompeii-land.js)
FARM_CULTURES.pompeii = {
  culture: POMPEII,
  label: 'a villa rustica on the slopes of Vesuvius',
  assets: POMPEII_FARM_ASSETS,
  palette: {
    ...POMPEII.palette,
    tilled: '#8a7458', fallow: '#a99a74', grain: '#d8b65e', chaff: '#e2cf96', straw: '#c9b27a',
    vine: '#4f6a32', grapes: '#4a2f45', must: '#5a2a3a',     // the leaves, the ripe bunches, the trodden must
    dolium: '#b06a44', cocciopesto: '#b98c74',               // fired clay; the crushed-tile floors of the press and the floor
    reed: '#b8a070', wood: '#6e5238',
  },
  seasons: { vintage: 1 },                                   // September: the grapes picked, trodden and pressed
};

export const WORKS_CULTURES = {
  sumer: {
    culture: SUMER,
    label: 'the works of a Sumerian town',
    assets: { ...SUMER.assets, ...SUMER_FARM_ASSETS, ...SUMER_WORKS_ASSETS },
    palette: {
      ...FARM_CULTURES.sumer.palette,
      clay: '#94795a',                          // wet river clay
      greenware: '#b39a78',                     // pots formed, not yet fired
      sherd: '#b9714a',
      charcoal: '#2f2b28',
      ember: '#d0612e',
      molten: '#f0a040',
      crucible: '#8f877c',
      slag: '#4d4743',
      ash: '#a7a29a',
      metal: '#c27b46',                         // fresh-cast copper
      bitumen: '#262220',
      flint: '#8a8376',
      basalt: '#55534f',
      limestone: '#cfc6ab',
      timber: '#6b4f36',                        // imported hardwood, darker than palm
      chips: '#cdb388',
      reedStand: '#a09a5c',                     // standing reed, green going gold
    },
    canal: { width: 12, sink: 1.0 },
  },
  egypt: {
    culture: EGYPT_COUNTRY,
    label: 'the works of New Kingdom Thebes',
    // the Sumerian brick pieces and the charcoal clamp, in Nile colours; everything else Egypt's own
    assets: Object.fromEntries([...['clay-pit', 'clay-mixing', 'brick-field', 'brick-hacks', 'charcoal-clamp'].map((id) => [id, SUMER_WORKS_ASSETS[id]]), ...Object.entries(EGYPT_WORKS_ASSETS)]),
    palette: {
      ...EGYPT_COUNTRY.palette,
      clay: '#6e5a46',                          // wet Nile silt
      greenware: '#8f7a62',
      sherd: '#a5603e',                         // fired Nile silt: red-brown
      charcoal: '#2f2b28', ember: '#d0612e', molten: '#f0a040', crucible: '#8f877c', slag: '#4d4743', ash: '#a7a29a',
      metal: '#b98a4e',                         // bronze
      flint: '#8a8376',
      basalt: '#55534f',
      chips: '#d9c49a',
      glass: '#2f5fae',                         // cobalt blue
      faience: '#3fa3a0',                       // copper turquoise
      quartz: '#ece8de',
      reedStand: '#6f8f4a',                     // standing papyrus
    },
    canal: { width: 30, sink: 1.6 },            // a Nile channel along the north
  },
};
