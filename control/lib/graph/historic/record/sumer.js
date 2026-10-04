/**
 * The record for stage 1: Sumer, southern Mesopotamia — from Eridu's first temple (Ubaid, c. 5400 BCE)
 * through Uruk at its height (c. 4000–3100 BCE) and the Early Dynastic city (c. 2900–2350 BCE) to the
 * Ur III ziggurat of Ur (c. 2100 BCE). Format and checks: ../record.js.
 *
 * `confidence` says how far each entry is checked: 'read' = the cited source was read directly;
 * 'secondary' = reached through a secondary page that names the source; 'unverified' = the standard
 * account, not yet confirmed. Period dates are the conventional approximate ones (approx: true).
 * Dimensions: brick units in cm, building dims in m.
 */

// ── sources ──────────────────────────────────────────────────────────────────────────────────────────
const S = {
  delougaz: { author: 'P. Delougaz', title: 'Plano-Convex Bricks and the Methods of Their Employment (SAOC 7)', year: 1933, url: 'https://isac.uchicago.edu/research/publications/saoc/saoc-7-plano-convex-bricks-and-methods-their-employment-ii-treatment-clay' },
  woolley: { author: 'C. L. Woolley', title: 'The Ziggurat of Ur (Museum Journal, Penn Museum)', year: 1924, url: 'https://www.penn.museum/sites/journal/1235/' },
  hnaihen: { author: 'K. H. Hnaihen', title: 'The Appearance of Bricks in Ancient Mesopotamia (Athens Journal of History 6:1)', year: 2020, url: 'https://doi.org/10.30958/ajhis.6-1-4' },
  moorey94: { author: 'P. R. S. Moorey', title: 'Ancient Mesopotamian Materials and Industries', year: 1994, via: 'quoted in Hnaihen 2020' },
  moorey76: { author: 'P. R. S. Moorey', title: 'The Late Prehistoric Administrative Building at Jamdat Nasr (Iraq 38:2)', year: 1976, via: 'Wikipedia "Jemdet Nasr"' },
  berlinCones: { author: 'Vorderasiatisches Museum, Staatliche Museen zu Berlin', title: 'Part of the cone-mosaic façade from the Eanna temple complex (object text)', year: 2024, url: 'https://artsandculture.google.com/asset/part-of-the-cone-mosaic-fa%C3%A7ade-from-the-eana-temple-complex-unknown/8wFpSTsm9v0SSA' },
  mcmahon: { author: 'A. McMahon', title: 'Trash and Toilets in Mesopotamia (ANE Today)', year: 2016, url: 'https://anetoday.org/trash-toilets-mesopotamia/' },
  norton: { author: 'M. Kleiner et al. (W. W. Norton)', title: 'History of Art: A Global View, ch. 3 "Urbanization in the Uruk Period"', year: 2021, url: 'https://nerd.wwnorton.com/ebooks/epub/histartglobal/EPUB/content/1.3.0.2-chapter03.xhtml' },
  eridu: { author: 'F. Safar, M. A. Mustafa, S. Lloyd', title: 'Eridu', year: 1981, via: 'Wikipedia "Eridu"' },
  asor: { author: 'ASOR Blog', title: 'Rebuilding Eden: the land of Eridu', year: 2017, url: 'https://www.asorblog.org/2017/09/12/rebuilding-eden-land-eridu.html' },
  eichmann07: { author: 'R. Eichmann', title: 'Uruk: Architektur I (DAI)', year: 2007, via: 'Wikipedia "Uruk"' },
  artefactsCone: { author: 'Artefacts Berlin for DAI / R. Eichmann', title: 'Uruk: re-constructing the Stone-Cone Building', year: 2012, url: 'https://www.artefacts-berlin.de/portfolio-item/uruk-re-constructing-the-stone-cone-building/' },
  fassbinder: { author: 'J. Fassbinder, H. Becker, M. van Ess', title: 'Venice in the desert: archaeological geophysics on the world\'s first metropolis, Uruk-Warka', year: 2005, via: 'abstract' },
  nissen: { author: 'H. J. Nissen', title: 'The Early History of the Ancient Near East', year: 1988, via: 'Wikipedia "Uruk"' },
  roaf82: { author: 'M. Roaf', title: 'Tell Madhhur excavation reports', year: 1982, via: 'Wikipedia "Tell Madhur"' },
  worldEras: { author: 'World Eras (Gale)', title: 'Gates and Doors; city walls', year: 2001, url: 'https://www.encyclopedia.com/history/news-wires-white-papers-and-books/gates-and-doors' },
  bitumen: { author: 'M. Schwartz, D. Hollander, G. Stein', title: 'Reconstructing Mesopotamian Exchange Networks in the 4th Millennium BC (Paléorient 25:1)', year: 1999, via: 'abstract' },
  connan: { author: 'J. Connan', title: 'An overview of bitumen trade in the Near East (Arabian Archaeology and Epigraphy)', year: 2010, url: 'https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1600-0471.2009.00321.x', via: 'abstract' },
  broadbent: { author: 'G. Broadbent', title: 'The ecology of the mudhif (WIT Press)', year: 2008, url: 'https://www.witpress.com/Secure/elibrary/papers/ARC08/ARC08002FU1.pdf', via: 'summary' },
  bsa6: { author: 'Bulletin on Sumerian Agriculture 6', title: 'Trees and Timber in Mesopotamia', year: 1992, via: 'index entry' },
  habubaRoom: { author: 'DergiPark article', title: '"The Reception Room" in the Tripartite Plan (Habuba Kabira houses)', year: 2021, url: 'https://dergipark.org.tr/en/download/article-file/1715350' },
  sievertsen: { author: 'U. Sievertsen', title: 'Buttress-recess Architecture and Status Symbolism in the Ubaid Period (Beyond the Ubaid, SAOC 63)', year: 2010, via: 'title confirmed, not read' },
};

// ── materials ────────────────────────────────────────────────────────────────────────────────────────
const MATERIALS = [
  {
    id: 'mudbrick-ubaid', kind: 'material', name: 'sun-dried moulded mudbrick, large flat (Ubaid)', confidence: 'read',
    attested: { from: -5400, to: -3600, approx: true, where: ['Eridu', 'Uruk'] }, supply: 'river clay, tempered, moulded and sun-dried',
    role: ['wall', 'foundation'], unit: { l: 47, w: 22, h: 8 }, colour: ['#a58c6c', '#9a8263', '#b29a78'],
    notes: 'Eridu examples 49×26×8, 44×22×8, 47×22×7; foundations 42×18×6. Large and flat until the mid-4th millennium.',
    sources: [S.hnaihen, S.moorey94],
  },
  {
    id: 'mudbrick-uruk', kind: 'material', name: 'sun-dried moulded mudbrick, small (Uruk)', confidence: 'read',
    attested: { from: -4000, to: -2900, approx: true, where: ['Eridu', 'Uruk'] }, supply: 'river clay, moulded and sun-dried',
    role: ['wall'], unit: { l: 23, w: 12, h: 8 }, colour: ['#a58c6c', '#9a8263'],
    notes: 'Eridu Uruk-period bricks 21×12×7 to 26×14×9; sized so two could be handled together.',
    sources: [S.hnaihen, S.moorey94],
  },
  {
    id: 'riemchen', kind: 'material', name: 'Riemchen brick (square-section stick brick)', confidence: 'secondary',
    attested: { from: -3500, to: -3100, approx: true, where: ['Uruk (Eanna)', 'Jemdet Nasr'] }, supply: 'river clay, moulded',
    role: ['wall'], unit: { l: 20, w: 8.5, h: 8 }, colour: ['#a58c6c'],
    notes: 'Depth equals width, about twice as long. Measured example from Jemdet Nasr (20×8.5×8); no primary Eanna measurement in hand.',
    disputes: ['A widely repeated "16×16 cm" fits neither the definition nor the Jemdet Nasr figure; treated as wrong.'],
    sources: [S.moorey76, S.hnaihen],
  },
  {
    id: 'plano-convex', kind: 'material', name: 'plano-convex mudbrick (Early Dynastic)', confidence: 'read',
    attested: { from: -2900, to: -2350, approx: true, where: ['Kish', 'Khafaje', 'Telloh', 'Fara', 'Uruk'] }, supply: 'river clay, hand-finished',
    role: ['wall', 'paving'], unit: { l: 22, w: 15, h: 5 }, colour: ['#a58c6c', '#9a8263'],
    notes: 'One face convex with finger marks; never standardised (Khafaje 18×16 to 31×22, edges 3–6 cm). Laid flat convex-up, or on edge sloping in herringbone rows.',
    sources: [S.delougaz],
  },
  {
    id: 'baked-brick', kind: 'material', name: 'kiln-fired brick', confidence: 'read',
    attested: { from: -3800, to: null, approx: true, where: ['Uruk (Stone-Cone Temple)', 'Kish', 'Telloh', 'Ur'] }, supply: 'river clay fired in kilns (fuel-costly; special uses only)',
    role: ['paving', 'drainage', 'wall', 'waterproofing'], unit: { l: 32, w: 18, h: 9 }, colour: ['#b07a55', '#9c6a48', '#c08a62'],
    notes: 'First kilns in the Uruk period (bricks 32×18×9 under the Stone-Cone Temple). Early Dynastic pavements, wells, platforms; Ur III ziggurat casing 29×29×7.',
    sources: [S.moorey94, S.hnaihen, S.delougaz, S.woolley],
  },
  {
    id: 'clay-mortar', kind: 'material', name: 'clay mortar', confidence: 'read',
    attested: { from: -5400, to: null, approx: true, where: ['southern Mesopotamia'] }, supply: 'the brick clay itself',
    role: ['mortar'], colour: ['#9a8263'], notes: 'Same consistency as the brick clay; thick layers re-level uneven courses.',
    sources: [S.delougaz],
  },
  {
    id: 'bitumen', kind: 'material', name: 'bitumen', confidence: 'secondary',
    attested: { from: -5000, to: null, approx: true, where: ['Hit (middle Euphrates)', 'Mosul area'] }, supply: 'natural seeps; traded downriver',
    role: ['mortar', 'waterproofing'], colour: ['#1c1a18', '#2a2622'],
    notes: 'Traded from the Mosul area from Ubaid 3; Hit worked at scale from the Uruk period. Used mostly with baked brick where work had to be watertight.',
    sources: [S.bitumen, S.connan, S.delougaz],
  },
  {
    id: 'gypsum-plaster', kind: 'material', name: 'gypsum plaster / whitewash', confidence: 'secondary',
    attested: { from: -3300, to: null, approx: true, where: ['Uruk (White Temple)'] }, supply: 'gypsum, burnt and slaked',
    role: ['finish'], colour: ['#ece8dd', '#e2ddcf'], notes: 'The White Temple was coated white.',
    sources: [S.norton],
  },
  {
    id: 'mud-plaster', kind: 'material', name: 'mud plaster, painted', confidence: 'secondary',
    attested: { from: -5000, to: null, approx: true, where: ['Tell Madhhur', 'Uruk (Eanna)'] }, supply: 'clay',
    role: ['finish'], colour: ['#b8a07e', '#a2493a'], notes: 'Plastered walls with red-painted decoration in an Ubaid house; the bed cone mosaics were set into.',
    sources: [S.roaf82, S.berlinCones],
  },
  {
    id: 'lime-plaster', kind: 'material', name: 'lime plaster and lime mortar', confidence: 'read',
    attested: { from: -2900, to: null, approx: true, where: ['Bismaya (Adab)'] }, supply: 'burnt lime',
    role: ['finish', 'mortar'], colour: ['#e6e1d4'], sources: [S.delougaz],
  },
  {
    id: 'reed', kind: 'material', name: 'reed (Phragmites): bundles and mats', confidence: 'secondary',
    attested: { from: -5400, to: null, approx: true, where: ['the southern marshes', 'Eridu', 'Ur'] }, supply: 'marsh reed, cut and bundled or woven',
    role: ['structure', 'roof', 'wall', 'waterproofing'], colour: ['#c9b27a', '#b49c63', '#d6c48f'],
    notes: 'Earliest Eridu dwellers lived in reed huts; at Ur III, pitch-soaked reed mats lay between brick courses. Modern mudhif: bundled arches up to ~10 m high.',
    sources: [S.eridu, S.woolley, S.broadbent],
  },
  {
    id: 'palm-timber', kind: 'material', name: 'local timber: date palm, poplar, willow, tamarisk', confidence: 'unverified',
    attested: { from: -5400, to: null, approx: true, where: ['southern Mesopotamia'] }, supply: 'local groves and riverbanks',
    role: ['structure', 'roof'], colour: ['#7a6146', '#8b7152'],
    notes: 'Standard account: roof beams of palm and poplar. Species and spans for the early periods not confirmed in a primary source.',
    sources: [S.bsa6],
  },
  {
    id: 'imported-timber', kind: 'material', name: 'imported timber: cedar, pine, oak', confidence: 'unverified',
    attested: { from: -2900, to: null, approx: true, where: ['elite and temple buildings'] }, supply: 'from the north, the east and Lebanon',
    role: ['structure', 'roof'], colour: ['#8a5a3a'], notes: 'Start date not confirmed; recorded as a gap.',
    sources: [S.bsa6],
  },
  {
    id: 'limestone', kind: 'material', name: 'limestone (imported, cut blocks)', confidence: 'secondary',
    attested: { from: -3500, to: null, approx: true, where: ['Uruk (Limestone Temple)', 'Uruk (Stone-Cone precinct)'] }, supply: 'from the desert edge, brought from afar; scarce',
    role: ['foundation', 'wall'], colour: ['#d9d2bf', '#cfc7b1'], notes: 'Coursed cut blocks for prestige foundations only.',
    sources: [S.norton, S.eichmann07],
  },
  {
    id: 'clay-cone', kind: 'material', name: 'clay cones (cone mosaic)', confidence: 'read',
    attested: { from: -3500, to: -3100, approx: true, where: ['Uruk (Eanna)'] }, supply: 'fired clay or gypsum cones about 10 cm long, heads painted',
    role: ['ornament', 'finish'], unit: { l: 10, w: 2, h: 2 }, colour: ['#1f1d1b', '#a3392c', '#ece8dd'],
    notes: 'Pressed into a thick mud-plaster bed on walls and columns; heads black, red or white in lozenges, triangles, zigzags imitating matting. Also weatherproofed the wall.',
    disputes: ['One survey names only red and black; the Berlin museum names black, red and white.'],
    sources: [S.berlinCones, S.norton],
  },
  {
    id: 'stone-cone', kind: 'material', name: 'coloured stone cones and layered cement-like walling', confidence: 'read',
    attested: { from: -3600, to: -3300, approx: true, where: ['Uruk (Stone-Cone Building)'] }, supply: 'imported stone cones; a lime-based layered walling',
    role: ['ornament', 'wall'], colour: ['#d9d2bf', '#7c3a2d', '#2b2a28'],
    notes: 'Walls built up in layers with perforated baked slabs between, set with hundreds of thousands of coloured stone cones.',
    sources: [S.artefactsCone],
  },
];

// ── methods ──────────────────────────────────────────────────────────────────────────────────────────
const METHODS = [
  {
    id: 'coursed-mudbrick', kind: 'method', name: 'coursed mudbrick walling in clay mortar', confidence: 'read',
    attested: { from: -5400, to: null, approx: true }, materials: ['mudbrick-ubaid', 'clay-mortar'], sources: [S.delougaz, S.hnaihen],
  },
  {
    id: 'herringbone', kind: 'method', name: 'herringbone courses of plano-convex bricks', confidence: 'read',
    attested: { from: -2900, to: -2350, approx: true }, materials: ['plano-convex', 'clay-mortar'],
    notes: 'On-edge sloping rows alternating left and right, between one or more flat courses; avoids continuous vertical joints.',
    sources: [S.delougaz],
  },
  {
    id: 'buttress-recess', kind: 'method', name: 'buttress-and-recess (niched) facade', confidence: 'secondary',
    attested: { from: -5000, to: null, approx: true }, materials: ['mudbrick-ubaid'],
    notes: 'Hallmark of Ubaid temples (Eridu); the White Temple deeply niched; shallow buttresses on the Ur ziggurat.',
    sources: [S.sievertsen, S.norton, S.woolley],
  },
  {
    id: 'platform-rebuild', kind: 'method', name: 'rebuilding on the levelled ruins of the previous building', confidence: 'secondary',
    attested: { from: -5300, to: null, approx: true }, materials: ['mudbrick-ubaid'],
    notes: 'Eridu temples rebuilt one over another, levels XVIII to I; Uruk IVb debris made the terrace for IVa buildings.',
    sources: [S.eridu, S.eichmann07],
  },
  {
    id: 'flat-roof', kind: 'method', name: 'flat roof: beams, reed matting, packed mud', confidence: 'unverified',
    attested: { from: -5400, to: null, approx: true }, materials: ['palm-timber', 'reed'],
    notes: 'The standard account; not confirmed in a primary source in hand.', sources: [S.bsa6],
  },
  {
    id: 'pivot-door', kind: 'method', name: 'door on a pivot stone', confidence: 'secondary',
    attested: { from: -5000, to: null, approx: true }, materials: ['palm-timber', 'reed'],
    notes: 'Door sockets in the Madhhur Ubaid house; woven reed doors for most, planks for the wealthy.',
    sources: [S.roaf82, S.worldEras],
  },
  {
    id: 'cone-mosaic', kind: 'method', name: 'cone mosaic set in mud plaster', confidence: 'read',
    attested: { from: -3500, to: -3100, approx: true }, materials: ['clay-cone', 'mud-plaster'], sources: [S.berlinCones],
  },
  {
    id: 'whitewash', kind: 'method', name: 'whitewashed gypsum coat', confidence: 'secondary',
    attested: { from: -3300, to: null, approx: true }, materials: ['gypsum-plaster'], sources: [S.norton],
  },
  {
    id: 'clay-pipe-drain', kind: 'method', name: 'interlocking clay-pipe drains from courtyards', confidence: 'read',
    attested: { from: -3500, to: null, approx: true }, materials: ['baked-brick'],
    notes: 'Habuba Kabira: rain and waste water piped out of courts and bathrooms; later toilets over pits of stacked perforated rings; some drains ran into the street.',
    sources: [S.mcmahon],
  },
  {
    id: 'baked-casing', kind: 'method', name: 'baked-brick skin in bitumen over a mudbrick core, reed mats between courses, weeper holes', confidence: 'read',
    attested: { from: -2100, to: null, approx: true }, materials: ['baked-brick', 'bitumen', 'reed', 'mudbrick-uruk'],
    notes: 'The Ur III ziggurat. Weeper holes drain the core through the skin.', sources: [S.woolley],
  },
];

// ── building types ───────────────────────────────────────────────────────────────────────────────────
const TYPES = [
  {
    id: 'reed-house', kind: 'type', name: 'reed house', confidence: 'secondary',
    built: { from: -5400, to: null, approx: true }, materials: ['reed'],
    dims: { length: [6, 30], height: [3, 10] },
    notes: 'Earliest Eridu dwellings. Dimensions from the modern mudhif analogue (bundled arches, mat roof), not from excavation.',
    sources: [S.eridu, S.broadbent],
  },
  {
    id: 'eridu-shrine', kind: 'type', name: 'Eridu shrine (levels XVIII–XVI)', confidence: 'secondary',
    built: { from: -5300, to: -5000, approx: true }, materials: ['mudbrick-ubaid', 'clay-mortar'],
    dims: { plan: [3, 3], niche: true },
    notes: 'A single chamber about 3×3 m with a niche (XVII 2.8×2.8, XVI 3.5×3.5).',
    disputes: ['A 12.10×3.10 m figure with a 1.10×1 m recess also circulates for level XVIII.'],
    sources: [S.eridu],
  },
  {
    id: 'eridu-temple', kind: 'type', name: 'Eridu tripartite temple (levels VII–VI)', confidence: 'secondary',
    built: { from: -4000, to: -3800, approx: true }, materials: ['mudbrick-ubaid', 'clay-mortar'], methods: ['buttress-recess', 'platform-rebuild'],
    dims: { plan: [[17, 12], [22, 9]] }, notes: 'Level VII 17×12 m, VI 22×9 m: long central hall with side rooms, buttressed outer walls, on a platform.',
    sources: [S.eridu],
  },
  {
    id: 'tripartite-house', kind: 'type', name: 'Ubaid tripartite house', confidence: 'secondary',
    built: { from: -5000, to: -3500, approx: true }, materials: ['mudbrick-ubaid', 'clay-mortar', 'mud-plaster'], methods: ['coursed-mudbrick', 'pivot-door'],
    dims: { plan: [14, 14], wallHeight: 3.5 }, notes: 'Long central (later T-shaped) hall with rooms down each side; Madhhur house ~14×14 m, walls once ~3.5 m.',
    sources: [S.roaf82],
  },
  {
    id: 'uruk-courtyard-house', kind: 'type', name: 'Late Uruk house: tripartite unit with inner court and reception room', confidence: 'read',
    built: { from: -3500, to: -3100, approx: true }, materials: ['mudbrick-uruk', 'clay-mortar', 'baked-brick'], methods: ['coursed-mudbrick', 'clay-pipe-drain'],
    dims: { area: [150, 500] }, notes: 'Habuba Kabira houses 2 and 40; Building H ~500 m² around an unroofed court with a hearth. Typical house size unconfirmed.',
    sources: [S.habubaRoom, S.mcmahon],
  },
  {
    id: 'limestone-temple', kind: 'type', name: 'Limestone Temple (Eanna, Uruk V)', confidence: 'read',
    built: { from: -3500, to: -3400, approx: true }, materials: ['limestone', 'mudbrick-uruk'],
    dims: { plan: [76.2, 29.87] }, notes: 'Cut limestone foundations; stood on a rammed-earth podium about 2 m high (secondary only).',
    sources: [S.norton, S.eichmann07],
  },
  {
    id: 'white-temple', kind: 'type', name: 'White Temple on the Anu ziggurat (Kullaba, Uruk)', confidence: 'read',
    built: { from: -3300, to: null, approx: true }, materials: ['mudbrick-uruk', 'gypsum-plaster'], methods: ['buttress-recess', 'whitewash'],
    dims: { plan: [17.53, 22.25], platformHeight: 13 }, notes: 'Tripartite, corners to the cardinal points, deeply niched, coated white. Platform height 13 m is Wikipedia-only.',
    disputes: ['Dated c. 3300 BCE (Norton) or Uruk III, 3100–2900 BCE (Wikipedia).'],
    sources: [S.norton],
  },
  {
    id: 'pillar-hall', kind: 'type', name: 'Pillar Hall (Eanna IVa)', confidence: 'secondary',
    built: { from: -3300, to: -3100, approx: true }, materials: ['mudbrick-uruk', 'clay-cone', 'mud-plaster'], methods: ['cone-mosaic', 'platform-rebuild'],
    dims: { area: 219 }, notes: 'Open court with four pairs of huge free-standing columns and engaged columns, all cone-mosaic, on the terrace with stairs either side. Column size unknown.',
    sources: [S.eichmann07, S.berlinCones],
  },
  {
    id: 'uruk-city-wall', kind: 'type', name: 'city wall of Uruk', confidence: 'secondary',
    built: { from: -2900, to: null, approx: true }, materials: ['plano-convex', 'clay-mortar'], methods: ['herringbone'],
    dims: { length: 9000, thickness: [4, 5], height: [12, 15] },
    notes: 'About 9 km round, 4–5 m thick of plano-convex brick, gates with rectangular towers and many semicircular towers. Height is Wikipedia-only.',
    disputes: ['9 km or 9.5 km; geophysics gives a width of 8–25 m; also dated to Jemdet Nasr (3100–2900 BCE), though the plano-convex bricks favour Early Dynastic I.'],
    sources: [S.fassbinder, S.worldEras, S.delougaz],
  },
  {
    id: 'ur-ziggurat', kind: 'type', name: 'Ziggurat of Ur (Ur-Namma)', confidence: 'read',
    built: { from: -2100, to: null, approx: true }, materials: ['mudbrick-uruk', 'baked-brick', 'bitumen', 'reed'], methods: ['baked-casing', 'buttress-recess'],
    dims: { base: [62, 43], height: 28, stages: 3 },
    notes: 'Three stages, a central stair and two side stairs; slight batter, shallow buttresses, long sides slightly convex. Baked bricks ~29×29×7 cm.',
    disputes: ['Base 64×46 m (Wikipedia) vs 59×40 m lowest stage (Woolley 1924); height 28–30 m. Woolley\'s black/red/blue scheme is the Neo-Babylonian rebuild, not Ur III.'],
    sources: [S.woolley],
  },
];

// ── urban form ───────────────────────────────────────────────────────────────────────────────────────
const FORMS = [
  {
    id: 'eridu-setting', kind: 'form', name: 'Eridu: a temple mound on a dune at the marsh edge', confidence: 'secondary',
    attested: { from: -5400, to: -3800, approx: true },
    notes: 'Founded on a sand dune rising from a ~24 km depression of marsh, then near the Gulf shore and the Euphrates mouth; about 12 ha in the Ubaid period; a cemetery of ~1,000 mudbrick-box graves.',
    sources: [S.eridu, S.asor],
  },
  {
    id: 'uruk-precincts', kind: 'form', name: 'Uruk: two temple precincts as the centres (Eanna, Kullaba/Anu)', confidence: 'secondary',
    attested: { from: -4000, to: -2900, approx: true }, notes: 'Monumental buildings on terraces made from earlier ruins.', sources: [S.eichmann07, S.norton],
  },
  {
    id: 'uruk-canals', kind: 'form', name: 'Uruk: canals through the city', confidence: 'secondary',
    attested: { from: -3500, to: null, approx: true }, notes: 'Magnetometry shows a canal network inside the city, a main canal about 5 m wide.', sources: [S.fassbinder],
  },
  {
    id: 'uruk-extent', kind: 'form', name: 'Uruk: extent and population', confidence: 'secondary',
    attested: { from: -3100, to: -2800, approx: true },
    notes: 'About 250 ha by 3100 BCE, ~550–600 ha inside the Early Dynastic wall by 2800 BCE; roughly 25,000–50,000 people.',
    disputes: ['Population estimates are model-dependent; the lower bound is not tied to a named source.'],
    sources: [S.nissen, S.fassbinder],
  },
  {
    id: 'habuba-planned-town', kind: 'form', name: 'Habuba Kabira: a planned Late Uruk town with a towered wall', confidence: 'secondary',
    attested: { from: -3500, to: -3100, approx: true },
    notes: 'Rectangular planned town ~600×170 m along the Euphrates with planned streets; mudbrick wall ~3 m thick, nearly 50 square towers, two gates on the west.',
    disputes: ['Walled area 10 ha of ~18, or ~20 ha.'],
    sources: [S.worldEras],
  },
  {
    id: 'lanes-and-quarters', kind: 'form', name: 'residential quarters, lanes, harbours, street surfaces', confidence: 'unverified',
    attested: { from: -4000, to: null, approx: true }, notes: 'No specifics confirmed for Uruk itself: a gap to close before the settlement phase.', sources: [S.fassbinder],
  },
];

export const SUMER_RECORD = [...MATERIALS, ...METHODS, ...TYPES, ...FORMS];
export const SUMER_SOURCES = S;
