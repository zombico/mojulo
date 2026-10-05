/**
 * Sumer (southern Mesopotamia, Uruk period into Early Dynastic) as a composition of shared patterns
 * (../patterns.js): what it builds, in what colours, at what scale. A big visual read — the precise
 * notes behind it live in ../record/sumer.js.
 */
import { SUMER_ASSETS } from '../assets/sumer.js';
import { SUMER_RECORD, SUMER_SOURCES } from '../record/sumer.js';
import { SUMER_FARM_RECORD } from '../record/sumer-farm.js';
import { SUMER_WORKS_RECORD } from '../record/sumer-works.js';

export const SUMER = {
  label: 'Sumer (Uruk period)',
  years: [-4000, -2350],
  readAt: null,                  // not chosen: the card spans its periods (a general depiction)
  period: 'Uruk into Early Dynastic',
  place: 'southern Mesopotamia',
  region: 'mesopotamia',
  aliases: ['sumerian', 'uruk', 'eridu', 'ziggurat', 'shumer', 'early dynastic'],   // what people call it (search)
  // what its town, land, farm and works stand on (the encyclopedia entry's basis)
  record: { id: 'sumer', entries: [...SUMER_RECORD, ...SUMER_FARM_RECORD, ...SUMER_WORKS_RECORD], sources: SUMER_SOURCES },
  palette: {
    ground: '#c2ab84',            // dry alluvium
    lane: '#d2bf98',              // beaten mud, paler with traffic
    street: '#c9b48c',            // the main streets, packed with rubble and sherds
    paving: '#c6a27a',            // baked brick, laid at the quays and the precinct
    bridge: '#6e5a42',
    court: '#c8b28c',
    field: ['#8f9a5a', '#a3a865', '#b5a76c'],
    water: '#5f7f78',
    marsh: '#7d8a55',
    reed: '#c8ad62',              // bundled reed and mat
    copper: '#a8653a',            // beaten copper
    patina: '#6e8c77',            // copper gone green-bronze (the bulls, the lion-headed eagle)
    alabaster: '#e9e2cf',
    stone: '#8b9583',             // imported stone, greenish grey (stelae, statues)
    mosaic: ['#b8432f', '#2b2724', '#efe9dc'],   // clay cone heads: red, black, white
    lapis: '#2f4f8f',             // inlaid eyes, a temple's blue
    earth: ['#b49b76', '#a98f6a', '#bda482', '#9f8662', '#b8a07a'],   // sun-dried brick under mud render
    whitewash: ['#ece6d8', '#e4dccb'],
    wall: '#8f7553',
    platform: '#a4896a',
    stair: '#b39b78',
    precinctFloor: '#d6c7a5',
  },
  // what each mass is made of, read on its face (../ground.js WALL_SKINS): houses rendered in mud,
  // the wall and the platforms in bare sun-dried brick, the ziggurat cased in baked brick laid in
  // bitumen, anything whitewashed in lime. A kind not listed wears no skin (doors, reed, copper, stone).
  skins: {
    kinds: {
      house: 'mud-plaster', 'house-parapet': 'mud-plaster', 'house-roof': 'mud-plaster', 'court-wall': 'mud-plaster', cornice: 'mud-plaster', 'stair-head': 'mud-plaster',
      'tower-chamber': 'mud-plaster', kiln: 'mud-plaster', silo: 'mud-plaster', court: 'mud-plaster',
      'city-wall': 'mudbrick', 'wall-tower': 'mudbrick', 'gate-tower': 'mudbrick', 'gate-block': 'mudbrick', 'precinct-wall': 'mudbrick', parapet: 'mudbrick',
      platform: 'mudbrick', rib: 'mudbrick', merlon: 'mudbrick', 'stair-cheek': 'mudbrick', mass: 'mudbrick',
      'gate-frame': 'baked-brick', terrace: 'baked-brick', 'well-head': 'baked-brick', revetment: 'baked-brick',
      'bridge-pier': 'baked-brick', 'bridge-corbel': 'baked-brick', 'bridge-lintel': 'baked-brick', 'bridge-parapet': 'baked-brick',
      temple: 'lime-plaster', shrine: 'lime-plaster',
    },
    assets: { ziggurat: { platform: 'baked-brick', rib: 'baked-brick', merlon: 'baked-brick', 'stair-cheek': 'baked-brick' }, 'canal-bridge': { 'stair-cheek': 'baked-brick' } },
    whitewash: 'lime-plaster',   // a skinned mass in a pale tint is whitewashed, whatever its kind
    bare: { share: 0.3, from: 'mud-plaster', skin: 'mudbrick' },   // a share of houses stand in bare brick, unrendered
  },
  patterns: ['sun-dried-earth', 'whitewash', 'flat-roof-cube', 'courtyard-house', 'blank-wall', 'niched-wall', 'stepped-platform', 'terrace', 'organic-lanes', 'sacred-precinct', 'towered-wall', 'canal-through', 'grove-fringe', 'reed',
    'votive-figures', 'stele', 'door-emblem', 'guardians', 'frieze', 'mosaic-skin', 'ritual-vessel', 'altar', 'well', 'kiln', 'granary', 'boat'],
  // scale, metres
  house: { size: [8, 17], height: [3.4, 6.2], courtyardMin: 11, whitewash: 0.08, gap: 0.45 },   // gap: each house set in from its lot line (metres)
  lanes: { main: 3, alley: 1, branches: 40, branchLen: [5, 18], block: [7, 9] },   // widths in grid cells; block: the alley lattice's spacing (rows, cols)
  wall: { thickness: 6, height: 12, towerEvery: 26, tower: 8, towerHeight: 15.5, strip: 4 },
  precinct: { size: [124, 90], wall: 2.2, wallHeight: 5, platform: [52, 38], platformHeight: 20, stages: 3, temple: [18, 22], hall: [22, 18], clear: 9, templeHeight: 6.5 },   // clear: open court kept between the ziggurat (with its stair) and its neighbours
  canal: { width: 9, sink: 1.5 },   // sink: the water lies this far below the quays
  groves: { density: 0.5, max: 140 },
  assets: SUMER_ASSETS,   // the kit that builds each slot the layout asks for
};
