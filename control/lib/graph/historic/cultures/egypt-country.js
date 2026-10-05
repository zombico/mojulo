/**
 * New Kingdom Egypt's countryside and works (read at c. 1250 BCE, the Thebes town's date): the colours
 * and the wall skins the farm (../farmstead.js) and the works (../workshops.js) build in. A stand-in for
 * the Thebes culture (cultures/thebes.js on the historic-city line), whose palette it follows; once the
 * two lines are joined the sub-scenes take THEBES and this file keeps only what the town lacks.
 *
 * Kept to what the period had: Nile mud brick, sun-dried and never fired (fired brick is Roman in
 * Egypt); no lime (the wash is gypsum, so no pale tint here reads as lime plaster).
 */
export const EGYPT_COUNTRY = {
  label: 'New Kingdom Egypt',
  years: [-1550, -1070],
  palette: {
    ground: '#c3ab84',            // the dry edge of the flood plain
    lane: '#b9a07c',              // beaten Nile mud, paler with traffic
    street: '#c2ab84',
    paving: '#d6c29a',            // sandstone flags
    court: '#cdb892',
    field: ['#6f8f45', '#86a050', '#9aab5c', '#b8b06a'],
    water: '#4f7f86',             // the Nile, silty green-blue
    flood: '#6f8174',             // the inundation over the basins: grey-green, thick with silt
    marsh: '#6f8a4c',
    bank: '#7d6a50',
    reed: '#c8ad62',
    papyrus: '#6f8f4a',           // standing papyrus, its umbels a brighter green
    mud: '#7a6650',
    earth: ['#8a7458', '#7f6a52', '#94806a', '#857058'],   // Nile mud brick: darker and greyer than Sumer's
    whitewash: ['#ece6d8', '#e6dfcf'],
    wall: '#7a6650',
    platform: '#cdb48a',
    stair: '#a89272',
    precinctFloor: '#d6c29a',
    sandstone: '#cdb48a',         // Gebel el-Silsila
    limestone: '#ddd3bd',
    granite: '#8a5f55',           // Aswan red granite
    dolerite: '#3f3d3a',          // the pounders that dressed it
    gold: '#d8b04a',
    blue: '#2f5f9e',              // Egyptian blue
    red: '#a8442e',               // red ochre: the masons' lines
    yellow: '#d2a23c',
    green: '#3f7a5a',
    stone: '#cdb48a',
    copper: '#a8653a',            // pots and jars take this tint, as in Sumer: fired Nile silt reads alike
    bronze: '#b98a4e',
    patina: '#6e8c77', alabaster: '#e9e2cf', lapis: '#2f4f8f', mosaic: ['#a8442e', '#2b2724', '#efe9dc'],
    // the countryside
    wood: '#7a6448',              // acacia, sycamore, palm
    timber: '#8a5a3a',            // imported conifer ("cedar"): the boats, the chariots, the big doors
    cloth: '#efe6d0',             // linen
    wool: '#e3d8bf',
    grain: '#d4b25a',             // ripe emmer and barley
    flax: '#b9a66a',              // flax pulled ripe, before it is retted
    straw: '#c9b27a',
    chaff: '#e2cf96',
    tilled: '#5f4d3c',            // the black silt the flood leaves: kemet, the black land
    fallow: '#9c8666',
    floor: '#a99070',
    garden: '#5f8a42',
    vine: '#5d7a37',
    grape: '#4b3150',
    fodder: '#7f9c4a',            // clover (berseem)
    hive: '#9b7656',
    sycamore: '#56703d',
  },
  // Nile brick reads as mudbrick here; the historic-city line's 'nile-brick' and 'gypsum-wash' skins take
  // over after the join
  skins: {
    kinds: {
      house: 'mud-plaster', 'house-parapet': 'mud-plaster', 'house-roof': 'mud-plaster', 'court-wall': 'mud-plaster',
      silo: 'mud-plaster', 'yard-wall': 'mudbrick', 'stable-wall': 'mud-plaster', 'fold-wall': 'mudbrick', kiln: 'mud-plaster',
    },
  },
  assets: {},
};
