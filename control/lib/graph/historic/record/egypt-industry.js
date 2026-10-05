/**
 * The record behind New Kingdom Egypt's countryside and works (../assets/egypt-farm.js,
 * ../assets/egypt-works.js), read at c. 1250 BCE. Same format and checks as ./sumer.js (../record.js).
 *
 * It stands alone for now. Its ids carry an `eg-` prefix so they never clash with the Thebes record
 * on the historic-city line (record/egypt.js). Once the two lines are joined, the materials both
 * records hold (Nile mud, sandstone, granite, cedar, reed) fold into that record's entries.
 *
 * Every entry here is 'unverified': these are the standard accounts, and no source was read for this
 * pass. checkRecord reports each one.
 */
const S = {
  lucas62: { author: 'A. Lucas and J. R. Harris', title: 'Ancient Egyptian Materials and Industries (4th edition)', year: 1962 },
  nicholson00: { author: 'P. T. Nicholson and I. Shaw (eds)', title: 'Ancient Egyptian Materials and Technology', year: 2000 },
  davies43: { author: 'N. de G. Davies', title: 'The Tomb of Rekh-mi-Rē\' at Thebes', year: 1943 },
  davies27: { author: 'N. de G. Davies', title: 'Two Ramesside Tombs at Thebes (Userhēt and Ipuy)', year: 1927 },
  winlock55: { author: 'H. E. Winlock', title: 'Models of Daily Life in Ancient Egypt from the Tomb of Meket-Rē\' at Thebes', year: 1955 },
  klemm08: { author: 'R. Klemm and D. D. Klemm', title: 'Stones and Quarries in Ancient Egypt', year: 2008 },
  arnold91: { author: 'D. Arnold', title: 'Building in Egypt: Pharaonic Stone Masonry', year: 1991 },
  littauer85: { author: 'M. A. Littauer and J. H. Crouwel', title: 'Chariots and Related Equipment from the Tomb of Tut\'ankhamūn', year: 1985 },
  ward00: { author: 'C. A. Ward', title: 'Sacred and Secular: Ancient Egyptian Ships and Boats', year: 2000 },
  nicholson07: { author: 'P. T. Nicholson', title: 'Brilliant Things for Akhenaten: The Production of Glass, Vitreous Materials and Pottery at Amarna Site O45.1', year: 2007 },
  rehren05: { author: 'Th. Rehren and E. B. Pusch', title: 'Late Bronze Age glass production at Qantir-Piramesses, Egypt (Science 308)', year: 2005 },
  butzer76: { author: 'K. W. Butzer', title: 'Early Hydraulic Civilization in Egypt', year: 1976 },
  kemp06: { author: 'B. J. Kemp', title: 'Ancient Egypt: Anatomy of a Civilization (2nd edition)', year: 2006 },
  crane99: { author: 'E. Crane', title: 'The World History of Beekeeping and Honey Hunting', year: 1999 },
  lesko77: { author: 'L. H. Lesko', title: 'King Tut\'s Wine Cellar', year: 1977 },
  murray00: { author: 'M. A. Murray', title: 'Cereal production and processing (in Nicholson and Shaw, Ancient Egyptian Materials and Technology)', year: 2000 },
  ogden00: { author: 'J. Ogden', title: 'Metals (in Nicholson and Shaw, Ancient Egyptian Materials and Technology)', year: 2000 },
};
const span = (from, o = {}) => ({ from, to: null, approx: true, ...o });

// ── materials ──
const MATERIALS = [
  { id: 'eg-nile-silt', kind: 'material', name: 'Nile silt: mud brick, mortar, plaster and the red-brown pottery fabric', confidence: 'unverified', attested: span(-5000, { where: ['the whole valley'] }), supply: 'dug by the river and the canals, tempered with straw or dung', role: ['wall', 'mortar', 'finish'], colour: ['#7a6650', '#a5603e'], notes: 'Moulded and sun-dried; Egypt did not fire brick in any number until the Roman period.', sources: [S.lucas62, S.nicholson00] },
  { id: 'eg-sandstone', kind: 'material', name: 'sandstone of Gebel el-Silsila', confidence: 'unverified', attested: span(-1990, { where: ['Gebel el-Silsila', 'the Theban temples'] }), supply: 'quarried in the cliffs on both banks at Silsila and floated down to Thebes', role: ['wall', 'structure', 'paving'], colour: ['#cdb48a'], notes: 'The temple stone of New Kingdom Thebes.', sources: [S.klemm08, S.arnold91] },
  { id: 'eg-granite', kind: 'material', name: 'red granite of Aswan', confidence: 'unverified', attested: span(-2900, { where: ['Aswan'] }), supply: 'quarried at Aswan by pounding with dolerite balls; obelisks, colossi, door frames', role: ['structure', 'ornament'], colour: ['#8a5f55'], sources: [S.klemm08, S.arnold91] },
  { id: 'eg-dolerite', kind: 'material', name: 'dolerite pounders', confidence: 'unverified', attested: span(-2600, { where: ['Aswan', 'the Eastern Desert'] }), supply: 'balls of the hard stone, worn round by use', role: ['structure'], colour: ['#3f3d3a'], sources: [S.klemm08] },
  { id: 'eg-bronze', kind: 'material', name: 'tin bronze', confidence: 'unverified', attested: span(-2000, { where: ['Middle Kingdom onward; general in the New Kingdom'] }), supply: 'copper from Sinai, the Eastern Desert and Cyprus, alloyed with imported tin', role: ['structure', 'ornament'], colour: ['#b98a4e'], disputes: ['Where Egypt\'s tin came from is not settled.'], sources: [S.ogden00] },
  { id: 'eg-oxhide-ingot', kind: 'material', name: 'oxhide copper ingots', confidence: 'unverified', attested: span(-1600, { to: -1100, where: ['the eastern Mediterranean trade; shown in Theban tombs as tribute'] }), supply: 'four-cornered slabs, mostly Cypriot copper', role: ['structure'], colour: ['#b98a4e'], sources: [S.ogden00, S.davies43] },
  { id: 'eg-glass', kind: 'material', name: 'glass (cobalt blue, copper turquoise, opaque colours)', confidence: 'unverified', attested: span(-1500, { where: ['Thebes (Thutmose III)', 'Amarna', 'Qantir-Piramesse'] }), supply: 'made from crushed quartz and plant ash in cylindrical crucibles, coloured with cobalt or copper', role: ['ornament'], colour: ['#2f5fae', '#3fa3a0'], notes: 'New in the New Kingdom: before it Egypt had faience and glazes, not glass.', sources: [S.nicholson07, S.rehren05] },
  { id: 'eg-faience', kind: 'material', name: 'Egyptian faience', confidence: 'unverified', attested: span(-4000), supply: 'crushed quartz with a glaze, moulded and fired', role: ['ornament'], colour: ['#3fa3a0'], sources: [S.nicholson00] },
  { id: 'eg-cedar', kind: 'material', name: 'imported conifer timber ("cedar") from the Lebanon', confidence: 'unverified', attested: span(-3000, { where: ['by sea from Byblos'] }), supply: 'long timbers for hulls, chariots, flagstaffs, great doors', role: ['structure'], colour: ['#8a5a3a'], sources: [S.nicholson00, S.ward00] },
  { id: 'eg-local-wood', kind: 'material', name: 'local wood: acacia, sycamore fig, tamarisk, palm', confidence: 'unverified', attested: span(-5000), supply: 'short and knotty: ploughs, hoes, tools, small boats, roofs', role: ['structure', 'roof'], colour: ['#7a6448'], sources: [S.nicholson00] },
  { id: 'eg-papyrus', kind: 'material', name: 'papyrus (Cyperus papyrus)', confidence: 'unverified', attested: span(-3000), supply: 'cut in the marshes: sheets, rope, mats, sandals, light skiffs', role: ['structure', 'finish'], colour: ['#6f8f4a', '#e6dcc0'], sources: [S.lucas62, S.nicholson00] },
  { id: 'eg-flax', kind: 'material', name: 'flax and linen', confidence: 'unverified', attested: span(-5000), supply: 'pulled, retted, spun and woven: the linen of all Egypt', role: ['finish'], colour: ['#b9a66a', '#efe6d0'], sources: [S.nicholson00] },
  { id: 'eg-flint', kind: 'material', name: 'flint (sickle teeth, knives)', confidence: 'unverified', attested: span(-5000), supply: 'nodules in the limestone of the desert edges', role: ['structure'], colour: ['#8a8376'], notes: 'Flint-toothed sickles were still in use in the New Kingdom beside bronze ones.', sources: [S.nicholson00] },
  { id: 'eg-charcoal', kind: 'material', name: 'charcoal', confidence: 'unverified', attested: span(-4000), supply: 'acacia and tamarisk charred in clamps', role: ['structure'], colour: ['#2f2b28'], sources: [S.ogden00] },
];

// ── methods ──
const METHODS = [
  { id: 'eg-basin-irrigation', kind: 'method', name: 'basin irrigation: the flood held in earth-banked basins, then let go', confidence: 'unverified', attested: span(-3000), materials: ['eg-nile-silt'], notes: 'The year ran in three seasons: akhet, the inundation; peret, the growing; shemu, the harvest.', sources: [S.butzer76] },
  { id: 'eg-broadcast-sowing', kind: 'method', name: 'seed broadcast on the wet silt and trodden in by the flock, or ploughed in', confidence: 'unverified', attested: span(-2500), materials: [], sources: [S.murray00] },
  { id: 'eg-high-reaping', kind: 'method', name: 'reaping high under the ear, the straw left standing', confidence: 'unverified', attested: span(-2500), materials: ['eg-local-wood', 'eg-flint'], sources: [S.murray00] },
  { id: 'eg-trampling', kind: 'method', name: 'threshing by cattle treading the ears on a walled floor; winnowing with scoops', confidence: 'unverified', attested: span(-2500), materials: [], sources: [S.murray00] },
  { id: 'eg-trench-quarrying', kind: 'method', name: 'quarrying by trenches round the block, then levering or wedging it free at the base', confidence: 'unverified', attested: span(-2600), materials: ['eg-local-wood'], disputes: ['Rows of wedge holes for splitting granite are mostly Late Period and after; whether wooden wedges were swelled with water is disputed.'], sources: [S.klemm08, S.arnold91] },
  { id: 'eg-pounding', kind: 'method', name: 'dressing granite by pounding with dolerite', confidence: 'unverified', attested: span(-2600), materials: ['eg-granite', 'eg-dolerite'], sources: [S.klemm08] },
  { id: 'eg-sledge-hauling', kind: 'method', name: 'hauling on sledges over timber sleepers, the way wetted', confidence: 'unverified', attested: span(-2600), materials: ['eg-local-wood'], notes: 'Djehutihotep\'s tomb shows a man pouring water before the runners of a colossus\'s sledge.', sources: [S.arnold91] },
  { id: 'eg-pot-bellows', kind: 'method', name: 'pot bellows: pottery bowls with leather tops, trodden in pairs', confidence: 'unverified', attested: span(-1500), materials: ['eg-nile-silt', 'eg-charcoal'], notes: 'Rekhmire\'s tomb. Before them Egypt\'s smiths blew through reed pipes, as Sumer\'s did.', sources: [S.davies43, S.ogden00] },
  { id: 'eg-bronze-casting', kind: 'method', name: 'casting bronze: crucibles lifted on withy rods, open and multi-funnel moulds', confidence: 'unverified', attested: span(-2000), materials: ['eg-bronze', 'eg-charcoal'], sources: [S.davies43, S.ogden00] },
  { id: 'eg-glassmaking', kind: 'method', name: 'glassmaking from quartz and plant ash in cylindrical crucibles', confidence: 'unverified', attested: span(-1500), materials: ['eg-glass'], disputes: ['Whether Egypt made raw glass from the start or only worked imported glass at first is argued; Qantir shows it was made there by the Ramesside period.'], sources: [S.rehren05, S.nicholson07] },
  { id: 'eg-faience-moulding', kind: 'method', name: 'faience pressed into open clay moulds (amulets, beads, inlays)', confidence: 'unverified', attested: span(-2000), materials: ['eg-faience'], sources: [S.nicholson07] },
  { id: 'eg-post-sawing', kind: 'method', name: 'sawing a plank from a log lashed upright to a post, a weighted lever opening the cut', confidence: 'unverified', attested: span(-2500), materials: ['eg-cedar', 'eg-local-wood'], notes: 'The saw is copper, later bronze.', sources: [S.davies43] },
  { id: 'eg-shell-first', kind: 'method', name: 'boats built shell first: planks joined edge to edge by mortise and tenon, beams after', confidence: 'unverified', attested: span(-3000), materials: ['eg-cedar', 'eg-local-wood'], sources: [S.ward00] },
  { id: 'eg-spoked-wheel', kind: 'method', name: 'spoked wheels and bent-wood chariot frames, lashed with rawhide', confidence: 'unverified', attested: span(-1600), materials: ['eg-local-wood', 'eg-cedar'], notes: 'The chariot came into Egypt in the Second Intermediate Period.', sources: [S.littauer85] },
  { id: 'eg-wheel-pottery', kind: 'method', name: 'pottery on a turned wheel; bread moulds and beer jars in mass', confidence: 'unverified', attested: span(-2500), materials: ['eg-nile-silt'], sources: [S.nicholson00] },
  { id: 'eg-papyrus-making', kind: 'method', name: 'papyrus sheets: pith strips laid crosswise and pressed', confidence: 'unverified', attested: span(-2900), materials: ['eg-papyrus'], sources: [S.lucas62] },
  { id: 'eg-upright-loom', kind: 'method', name: 'weaving on the upright two-beam loom', confidence: 'unverified', attested: span(-1550), materials: ['eg-flax', 'eg-local-wood'], notes: 'New in the New Kingdom; before it Egypt wove on the horizontal ground loom, as Sumer did.', sources: [S.nicholson00] },
  { id: 'eg-wine-treading', kind: 'method', name: 'grapes trodden in a vat, the treaders holding ropes from a beam; the must run off into jars', confidence: 'unverified', attested: span(-2600), materials: ['eg-nile-silt', 'eg-local-wood'], sources: [S.lesko77] },
  { id: 'eg-beekeeping', kind: 'method', name: 'bees kept in horizontal pottery hives, stacked; honey taken with smoke', confidence: 'unverified', attested: span(-2400), materials: ['eg-nile-silt'], notes: 'First shown in Niuserre\'s sun temple; again in Rekhmire\'s tomb.', sources: [S.crane99, S.davies43] },
];

// ── types ──
const TYPES = [
  { id: 'eg-ard', kind: 'type', name: 'ard plough with a horn yoke and two handles', confidence: 'unverified', built: span(-3000), materials: ['eg-local-wood'], sources: [S.murray00] },
  { id: 'eg-sickle', kind: 'type', name: 'wooden sickle set with flint teeth', confidence: 'unverified', built: span(-5000), materials: ['eg-local-wood', 'eg-flint'], sources: [S.murray00] },
  { id: 'eg-a-hoe', kind: 'type', name: 'A-shaped hoe: handle and blade joined at an angle, bound with rope', confidence: 'unverified', built: span(-3000), materials: ['eg-local-wood'], sources: [S.murray00] },
  { id: 'eg-shaduf', kind: 'type', name: 'shaduf on a mud pillar', confidence: 'unverified', built: span(-1350), materials: ['eg-local-wood', 'eg-nile-silt'], notes: 'Shown in Egypt from the Amarna period on (Ipuy\'s garden); for gardens, not the grain basins.', sources: [S.davies27, S.butzer76] },
  { id: 'eg-silo-court', kind: 'type', name: 'granary court of domed mud-brick silos filled from the top', confidence: 'unverified', built: span(-2000), materials: ['eg-nile-silt'], sources: [S.winlock55, S.kemp06] },
  { id: 'eg-cattle-stall', kind: 'type', name: 'cattle stall with a portico and mangers', confidence: 'unverified', built: span(-2000), materials: ['eg-nile-silt', 'eg-local-wood'], sources: [S.winlock55] },
  { id: 'eg-threshing-floor', kind: 'type', name: 'walled round threshing floor', confidence: 'unverified', built: span(-2500), materials: ['eg-nile-silt'], sources: [S.murray00] },
  { id: 'eg-farmhouse', kind: 'type', name: 'mud-brick house round a yard: roof loggia, wind-catcher, ovens', confidence: 'unverified', built: span(-1350), materials: ['eg-nile-silt', 'eg-local-wood'], notes: 'After the small houses of Amarna and the Deir el-Medina houses.', sources: [S.kemp06] },
  { id: 'eg-wine-press', kind: 'type', name: 'treading vat with its beam and spout', confidence: 'unverified', built: span(-2600), materials: ['eg-nile-silt', 'eg-local-wood'], methods: ['eg-wine-treading'], sources: [S.lesko77] },
  { id: 'eg-hive-stack', kind: 'type', name: 'stacked cylinder hives', confidence: 'unverified', built: span(-2400), materials: ['eg-nile-silt'], methods: ['eg-beekeeping'], sources: [S.crane99] },
  { id: 'eg-garden', kind: 'type', name: 'garden of square beds round a pool, with sycamores', confidence: 'unverified', built: span(-1500), materials: ['eg-nile-silt'], sources: [S.kemp06] },
  { id: 'eg-quarry-face', kind: 'type', name: 'stepped sandstone quarry face (Gebel el-Silsila)', confidence: 'unverified', built: span(-1550), materials: ['eg-sandstone'], methods: ['eg-trench-quarrying'], sources: [S.klemm08] },
  { id: 'eg-stone-sledge', kind: 'type', name: 'stone sledge', confidence: 'unverified', built: span(-2600), materials: ['eg-local-wood'], methods: ['eg-sledge-hauling'], sources: [S.arnold91] },
  { id: 'eg-sculptors-yard', kind: 'type', name: 'masons\' and sculptors\' yard: a colossus in its scaffold', confidence: 'unverified', built: span(-1450), materials: ['eg-sandstone', 'eg-bronze'], sources: [S.davies43] },
  { id: 'eg-stone-barge', kind: 'type', name: 'stone barge (Hatshepsut\'s obelisk barge)', confidence: 'unverified', built: span(-1470), materials: ['eg-cedar', 'eg-granite'], methods: ['eg-shell-first'], sources: [S.ward00] },
  { id: 'eg-foundry', kind: 'type', name: 'bronze foundry with pot bellows', confidence: 'unverified', built: span(-1450), materials: ['eg-bronze', 'eg-oxhide-ingot', 'eg-charcoal'], methods: ['eg-pot-bellows', 'eg-bronze-casting'], sources: [S.davies43] },
  { id: 'eg-glass-works', kind: 'type', name: 'glass and faience works', confidence: 'unverified', built: span(-1350), materials: ['eg-glass', 'eg-faience'], methods: ['eg-glassmaking', 'eg-faience-moulding'], sources: [S.nicholson07, S.rehren05] },
  { id: 'eg-chariot', kind: 'type', name: 'chariot on six-spoked wheels', confidence: 'unverified', built: span(-1600), materials: ['eg-local-wood', 'eg-cedar'], methods: ['eg-spoked-wheel'], sources: [S.littauer85] },
  { id: 'eg-plank-boat', kind: 'type', name: 'plank-built Nile boat', confidence: 'unverified', built: span(-3000), materials: ['eg-cedar', 'eg-local-wood'], methods: ['eg-shell-first'], sources: [S.ward00] },
  { id: 'eg-pottery-kiln', kind: 'type', name: 'tall cylindrical updraft pottery kiln', confidence: 'unverified', built: span(-2500), materials: ['eg-nile-silt'], methods: ['eg-wheel-pottery'], sources: [S.nicholson00] },
];

// ── forms ──
const FORMS = [
  { id: 'eg-basin-land', kind: 'form', name: 'the flood plain in basins between dykes, a feeder canal along them', confidence: 'unverified', attested: span(-3000), sources: [S.butzer76] },
  { id: 'eg-temple-estate', kind: 'form', name: 'a temple estate\'s farm: fields, threshing floor, granary court, scribes', confidence: 'unverified', attested: span(-1550), sources: [S.kemp06] },
  { id: 'eg-riverside-works', kind: 'form', name: 'works along the river: quarry, quay, boatyard, crafts behind', confidence: 'unverified', attested: span(-1550), sources: [S.kemp06, S.klemm08] },
];

export const EGYPT_INDUSTRY_RECORD = [...MATERIALS, ...METHODS, ...TYPES, ...FORMS];
export const EGYPT_INDUSTRY_SOURCES = S;
