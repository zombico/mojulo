/**
 * New Kingdom Egypt's countryside and works (read at c. 1250 BCE, the Thebes town's date): the Thebes
 * culture (./thebes.js) with what the town lacks, the colours of the farm (../farmstead.js) and the works
 * (../workshops.js) and the skins of their buildings. The town's own colours and skins win where both
 * name a thing, so a farm and the town beside it are the same Nile mud and the same gypsum wash.
 *
 * Kept to what the period had: Nile mud brick, sun-dried and never fired (fired brick is Roman in
 * Egypt); no lime (the wash is gypsum, so no pale tint here reads as lime plaster).
 */
import { THEBES } from './thebes.js';

export const EGYPT_COUNTRY = {
  ...THEBES,
  palette: {
    // the countryside
    flood: '#6f8174',             // the inundation over the basins: grey-green, thick with silt
    marsh: '#6f8a4c',
    papyrus: '#6f8f4a',           // standing papyrus, its umbels a brighter green
    dolerite: '#3f3d3a',          // the pounders that dressed the granite
    bronze: '#b98a4e',
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
    ...THEBES.palette,
  },
  skins: {
    ...THEBES.skins,
    kinds: { 'court-wall': 'nile-brick', 'stable-wall': 'mud-plaster', 'fold-wall': 'nile-brick', kiln: 'mud-plaster', ...THEBES.skins.kinds },
  },
};
