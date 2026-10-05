/**
 * Old Kingdom Giza (Egypt, the 4th Dynasty, c. 2600–2470 BCE; read at c. 2515, mid-way through Menkaure's reign — Shaw's dates, ../record/giza.js) as a
 * composition of shared patterns (../patterns.js). The pyramids are shown NEW:
 *  - cased smooth in white Tura limestone to the apex, not the stepped core stripped in the Middle Ages;
 *  - the Sphinx freshly carved, with no beard (a later addition);
 *  - the workers' town south of the Wall of the Crow in use.
 * The cited notes live in ../record/giza.js. Laid out by ../layouts/giza.js ('plateau'): the desert
 * plateau above the valley, the three pyramid complexes, causeways down the escarpment to the harbours.
 */
import { GIZA_ASSETS } from '../assets/giza.js';

export const GIZA = {
  label: 'Old Kingdom Giza',
  years: [-2600, -2470],
  layout: 'plateau',
  palette: {
    ground: '#d6bf92',            // the plateau: desert gravel and sand over limestone
    valley: '#8d7a5c',            // the floodplain's dark Nile mud
    lane: '#a68f6c',              // the town's beaten lanes
    street: '#b39a74',
    paving: '#e2d8c2',            // limestone pavement round the pyramids
    court: '#d8cdb5',
    field: ['#6f8f45', '#86a050', '#9aab5c', '#b8b06a'],
    water: '#4f7f86',
    bank: '#7d6a50',
    tura: '#efeadf',              // Tura limestone, fine and white: the casing
    limestone: '#c9b48a',         // the local Giza limestone: cores, walls, mastabas left uncased
    bedrock: '#c7ae84',           // the plateau's beds, as the Sphinx was carved from them
    granite: '#a86e5c',           // Aswan red granite
    basalt: '#2b2a28',            // the black basalt pavement of Khufu's mortuary temple
    electrum: '#e6c65c',          // a gold–silver alloy: the CONJECTURAL sheathing of a pyramidion (attested only from the 5th Dynasty)
    ochreFace: '#b07a5a',         // the Sphinx's face, with traces of red paint (conjectural colour)
    mud: '#6b5a47',               // mud brick
    palmwood: '#7a6448', cedar: '#8a5a3a', linen: '#efe6d0',
    whitewash: ['#ece6d8'], stone: '#cdb894', copper: '#a8653a',
  },
  skins: {
    kinds: {
      pyramid: 'tura-casing', 'pyramid-granite': 'granite', 'pyramid-rough': 'granite-rough', chapel: 'tura-casing', enclosure: 'giza-core',
      'temple-wall': 'giza-core', 'temple-roof': 'giza-core', pillar: 'granite', 'granite-casing': 'granite', terrace: 'giza-core',
      sphinx: 'bedrock', nemes: 'bedrock', quarry: 'bedrock', pyramidion: 'tura-casing', block: 'giza-core',
      mastaba: 'tura-casing', 'mastaba-core': 'giza-core', 'crow-wall': 'giza-core', causeway: 'tura-casing',
      gallery: 'mud-plaster', house: 'mud-plaster', 'house-parapet': 'mud-plaster', 'yard-wall': 'nile-brick', bakery: 'nile-brick',
    },
  },
  patterns: ['pyramid', 'mastaba', 'royal-necropolis', 'stone-ashlar', 'sun-dried-earth', 'flat-roof-cube', 'courtyard-house', 'blank-wall', 'colonnade', 'guardians', 'colossus', 'river-front', 'boat', 'grove-fringe'],
  // scale, metres
  plateau: { height: 45 },   // the plateau stands ~45 m over the Old Kingdom floodplain (~12 m above sea level)
  pyramids: {
    khufu: { base: 230.3, slope: 51.84 },
    khafre: { base: 215.3, slope: 53.13, granite: 0.03 },
    menkaure: { base: 104.6, slope: 51.34, granite: 0.31, rough: true },   // 16 courses (>20 m of 65) of granite, left undressed
  },
  house: { size: [6, 12], gap: 0.4 },
  lanes: { block: [5, 7] },
  canal: { width: 34, sink: 1.5 },
  groves: { density: 0.5, max: 140 },
  assets: GIZA_ASSETS,
};
