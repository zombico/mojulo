/**
 * The record for New Kingdom Thebes, Upper Egypt — from the start of the 18th Dynasty (c. 1550 BCE) to
 * the end of the 20th (c. 1070 BCE), focused on the Ramesside city of c. 1300–1200 BCE (Sety I,
 * Ramesses II, Merenptah, Sety II). Format and checks: ../record.js.
 *
 * `confidence` says how far each entry is checked: 'read' = the cited source was read directly;
 * 'secondary' = reached through a page that names the source, or through a search summary of one;
 * 'unverified' = the standard account, not yet confirmed. Reign dates are the conventional ones
 * (approx: true). Dimensions: brick and block units in cm, building dims in m.
 *
 * Anachronisms the generator must not use for a c. 1250 BCE town (each is in the record with its real
 * date, so `inUseAt` excludes it): Karnak's First Pylon and great pan-bedded enclosure wall (30th Dynasty,
 * c. 380–362 BCE); pan-bedded (undulating) mudbrick walls in general (Late Period); the human-headed
 * sphinx avenue between Karnak and Luxor as it stands (Nectanebo I); standardized-course ashlar
 * (from the 25th Dynasty); lime plaster and lime whitewash (Ptolemaic). In c. 1250 BCE Karnak's front
 * door was the Second Pylon (Horemheb), approached from the west by a ram-sphinx avenue from a quay.
 */

// ── sources ──────────────────────────────────────────────────────────────────────────────────────────
import { NEW_KINGDOM_DRESS } from './dress-egypt.js';
const S = {
  emeryArch: { author: 'V. L. Emery', title: 'Mud-Brick Architecture (UCLA Encyclopedia of Egyptology)', year: 2011, url: 'https://escholarship.org/uc/item/4983w678' },
  emeryBrick: { author: 'V. L. Emery', title: 'Mud-Brick (UCLA Encyclopedia of Egyptology)', year: 2011, url: 'https://escholarship.org/uc/item/7v84d6rh' },
  harrell: { author: 'J. A. Harrell', title: 'Building Stones (UCLA Encyclopedia of Egyptology)', year: 2012, url: 'https://escholarship.org/uc/item/3fd124g0' },
  toivari: { author: 'J. Toivari-Viitala', title: 'Deir el-Medina (Development) (UCLA Encyclopedia of Egyptology)', year: 2011, url: 'https://escholarship.org/uc/item/6kt9m29r' },
  stevens: { author: 'A. Stevens', title: 'Tell el-Amarna (UCLA Encyclopedia of Egyptology)', year: 2016, url: 'https://escholarship.org/uc/item/1k66566f' },
  millet: { author: 'M. Millet, A. Masson', title: 'Karnak: Settlements (UCLA Encyclopedia of Egyptology)', year: 2011, url: 'https://escholarship.org/uc/item/1q346284' },
  dkArch: { author: 'E. Sullivan', title: 'Architectural Features (Digital Karnak, UCLA)', year: 2008, url: 'https://digitalkarnak.ucsc.edu/wp-content/uploads/2020/11/architecturalfeatures.pdf' },
  dkCons: { author: 'E. Sullivan', title: 'Construction Methods and Building Materials (Digital Karnak, UCLA)', year: 2008, url: 'https://digitalkarnak.ucsc.edu/wp-content/uploads/2020/11/Construction.pdf' },
  dkHypo: { author: 'Digital Karnak (UCLA)', title: 'Hypostyle Hall', year: 2008, url: 'https://digitalkarnak.ucsc.edu/hypostyle-hall/' },
  dkPylon1: { author: 'Digital Karnak (UCLA)', title: '1st Pylon', year: 2008, url: 'https://digitalkarnak.ucsc.edu/1st-pylon/' },
  dkPylon2: { author: 'Digital Karnak (UCLA)', title: '2nd Pylon', year: 2008, url: 'https://digitalkarnak.ucsc.edu/2nd-pylon/' },
  dkLake: { author: 'Digital Karnak (UCLA)', title: 'Sacred Lake', year: 2008, url: 'https://digitalkarnak.ucsc.edu/sacred-lake/' },
  dkQuay: { author: 'Digital Karnak (UCLA)', title: 'Quay (citing Traunecker 1972, Gitton 1974, Lauffray 1975)', year: 2008, url: 'https://digitalkarnak.ucsc.edu/quay/' },
  brandMurnane: { author: 'P. J. Brand, W. J. Murnane', title: 'The Great Hypostyle Hall in the Temple of Amun at Karnak, vol. I part 2: Translation and Commentary', year: 2018, url: 'https://www.memphis.edu/hypostyle/pdfs/commentary.pdf' },
  ghhp: { author: 'Karnak Great Hypostyle Hall Project (Lipscomb University)', title: 'About Karnak and the Hypostyle Hall (web page; year = accessed)', year: 2026, url: 'https://archaeology.lipscomb.edu/excavations/karnak-great-hypostyle-hall-project/about-the-hypostyle-hall' },
  memphisSphinx: { author: 'Institute of Egyptian Art & Archaeology, University of Memphis', title: 'Luxor – Avenue of Sphinxes (colour tour; year = accessed)', year: 2026, url: 'https://www.memphis.edu/egypt/resources/colortour/luxor3.php' },
  amarnaNorth: { author: 'Amarna Project (B. Kemp et al.)', title: 'North Suburb (web page; year = accessed)', year: 2026, url: 'https://www.amarnaproject.com/amarna-the-place/north-suburb/' },
  amarnaMain: { author: 'Amarna Project (B. Kemp et al.)', title: 'Main City (web page; year = accessed)', year: 2026, url: 'https://www.amarnaproject.com/amarna-the-place/main-city/' },
  oakesMcDowell: { author: 'L. Oakes; A. G. McDowell', title: 'Pyramids, Temples and Tombs of Ancient Egypt; Village Life in Ancient Egypt', year: 2003, via: 'Wikipedia "Deir el-Medina"' },
  shedid: { author: 'A. G. Shedid', title: 'Stil der Grabmalereien in der Zeit Amenophis\' II. (publication of TT104)', year: 1988, via: 'Wikipedia "TT104"' },
  kemp2012: { author: 'B. Kemp; C. L. Woolley', title: 'The City of Akhenaten and Nefertiti (2012); excavation report on the house of Nakht (JEA 8, 1922)', year: 2012, via: 'Wikipedia "Nakhtpaaten"' },
  metBrick: { author: 'Metropolitan Museum of Art', title: 'Mud Brick of Senimen (Dynasty 18, Thebes), catalogue entry', year: 2026, url: 'https://www.metmuseum.org/art/collection/search/554353', via: 'search-result summary; page not read (rate-limited)' },
  obeliskList: { author: 'Wikipedia', title: 'Egyptian obelisks (table of heights)', year: 2026, url: 'https://en.wikipedia.org/wiki/Egyptian_obelisks', via: 'search-result summary only; a pointer, not a source' },
  luxorPylon: { author: 'Discovering Egypt', title: 'Luxor Temple pylon of Ramses II', year: 2026, url: 'https://discoveringegypt.com/luxor-temple/luxor-temple-pylon-of-ramses-ii/', via: 'search-result summary; popular page' },
  ramesseumColossus: { author: 'Wikipedia', title: 'Ramesseum (the Ozymandias colossus)', year: 2026, url: 'https://en.wikipedia.org/wiki/Ramesseum', via: 'search-result summary only' },
  amunPrecinct: { author: 'Wikipedia', title: 'Precinct of Amun-Re (quay, ram sphinxes, Nile Level Texts)', year: 2026, url: 'https://en.wikipedia.org/wiki/Precinct_of_Amun-Re', via: 'search-result summary only' },
  ipuy: { author: 'N. de G. Davies (facsimile), Metropolitan Museum 30.4.115', title: 'Garden Scene, Tomb of Ipuy (TT217, reign of Ramesses II)', year: 1930, via: 'Wikipedia "TT217" and Wikimedia Commons, search summary' },
  shadoofWiki: { author: 'Wikipedia', title: 'Shadoof', year: 2026, url: 'https://en.wikipedia.org/wiki/Shadoof', via: 'read; the Egyptian claims carry no specific citation' },
  menna: { author: 'M. Hartwig (ed.)', title: 'The Tomb Chapel of Menna (TT 69): The Art, Culture and Science of Painting in an Egyptian Tomb', year: 2013, via: 'title and search-result summary only' },
};

// ── materials ────────────────────────────────────────────────────────────────────────────────────────
const MATERIALS = [
  {
    id: 'mudbrick-nk', kind: 'material', name: 'sun-dried Nile-silt mudbrick (New Kingdom), often stamped', confidence: 'secondary',
    attested: { from: -1550, to: null, approx: true, where: ['Thebes, both banks', 'Deir el-Medina', 'Karnak', 'Amarna'] },
    supply: 'Nile silt with sand and/or chopped straw, moulded in wooden frames near the site and sun-dried',
    role: ['wall', 'foundation'], unit: { l: 34, w: 17, h: 11.5 }, colour: ['#6b5a47', '#7a6852', '#5e5040'],
    notes: 'Far older than the New Kingdom; the span here is the format in use. Sizes were never standardised: average size grew through the MK and NK; public/royal bricks larger than domestic ones (royal vs standard cubit). Royal-name stamping from Ahmose, regular in the 18th–19th Dynasties, sporadic to the 26th; most 18th-Dynasty stamped bricks are Theban west-bank memorial temples, later reused in houses. Unit is one Met example (Dyn. 18, Thebes), seen only in a search summary.',
    disputes: ['No measured Ramesside Theban brick in hand; the 34×17×11.5 cm unit is a single 18th-Dynasty example.'],
    sources: [S.emeryBrick, S.millet, S.metBrick],
  },
  {
    id: 'mud-mortar', kind: 'material', name: 'mud mortar', confidence: 'read',
    attested: { from: -1550, to: null, approx: true, where: ['Egypt'] }, supply: 'silt like the brick itself, rarely straw-tempered, mixed at the wall',
    role: ['mortar'], colour: ['#6b5a47'], notes: 'Usually only in the horizontal bed joints, not the vertical joints between bricks in a course.',
    sources: [S.emeryArch],
  },
  {
    id: 'sand-bed', kind: 'material', name: 'clean sand (foundation bed and fill)', confidence: 'read',
    attested: { from: -1550, to: null, approx: true, where: ['Egypt'] }, supply: 'desert sand',
    role: ['foundation'], colour: ['#d9c49a'], notes: 'Brick footings laid in trenches on a bed of sand (best recorded for Late Period temenos walls).',
    sources: [S.emeryArch],
  },
  {
    id: 'silsila-sandstone', kind: 'material', name: 'sandstone of Gebel el-Silsila (the New Kingdom Theban temple stone)', confidence: 'read',
    attested: { from: -1550, to: null, approx: true, where: ['Gebel el-Silsila, ~160 km upriver of Thebes', 'Karnak', 'Luxor', 'Ramesseum', 'Medinet Habu'] },
    supply: 'open-cut quarries; large fracture-free blocks of uniform colour, floated downstream to Thebes',
    role: ['wall', 'structure', 'foundation', 'paving'], colour: ['#cbb08a', '#d6c09c', '#b9986f'],
    notes: 'From the start of the NK most Theban temples were largely or wholly sandstone (exception: Hatshepsut\'s limestone temple at Deir el-Bahri); by Thutmose III it replaced limestone at Karnak. Egyptian name "fine light-coloured hard stone". Inscriptions of Sety I\'s early years send Silsila blocks to Thebes, probably for the hypostyle hall. Drab stone was usually painted. Colours are an estimate of a light buff sandstone, not measured.',
    sources: [S.harrell, S.dkCons],
  },
  {
    id: 'limestone', kind: 'material', name: 'limestone (local Theban and fine Tura limestone)', confidence: 'read',
    attested: { from: -1550, to: null, approx: true, where: ['Deir el-Bahri', 'Karnak (early 18th Dynasty)', 'Tura-Masara (fine)'] },
    supply: 'local hills; the finest shipped from Tura near Memphis',
    role: ['wall', 'ornament'], colour: ['#e4dccb', '#d8cfba'],
    notes: 'Material of choice at Karnak in the MK and early 18th Dynasty, then replaced by sandstone because it decayed in the damp; after Thutmose III used at Karnak mainly for statuary.',
    sources: [S.harrell, S.dkCons],
  },
  {
    id: 'aswan-granite', kind: 'material', name: 'red (rose) granite of Aswan', confidence: 'read',
    attested: { from: -1550, to: null, approx: true, where: ['Aswan quarries', 'Karnak', 'Luxor', 'Ramesseum'] }, supply: 'quarried at Aswan, shipped downstream',
    role: ['ornament', 'structure', 'paving'], colour: ['#a86e5c', '#8e5b4b', '#3b3836'],
    notes: 'At Karnak: obelisks, lintels, thresholds, colossal statues, and the thick blocks that bore the flagstaffs before the Second Pylon. Grey-black granite, red quartzite and calcite used in smaller quantities.',
    sources: [S.dkCons, S.dkArch, S.harrell],
  },
  {
    id: 'calcite', kind: 'material', name: 'travertine ("Egyptian alabaster", calcite) from Hatnub', confidence: 'read',
    attested: { from: -1550, to: null, approx: true, where: ['Karnak (chapels of Amenhotep I and II)'] }, supply: 'Hatnub, Middle Egypt',
    role: ['ornament', 'wall'], colour: ['#efe6d2', '#e2d5b8'], notes: 'Small barque shrines and chapels.', sources: [S.dkCons],
  },
  {
    id: 'talatat', kind: 'material', name: 'talatat blocks (Akhenaten\'s small standard sandstone blocks)', confidence: 'read',
    attested: { from: -1353, to: -1336, approx: true, where: ['East Karnak (Gempaaten)', 'Amarna'] }, supply: 'Silsila sandstone (limestone at Amarna), cut to one-man size',
    role: ['wall'], unit: { l: 52, w: 26, h: 26 }, colour: ['#cbb08a'],
    notes: 'Only under Amenhotep IV/Akhenaten; immediately discontinued. Tens of thousands reused as core fill in Horemheb\'s Second, Ninth and Tenth Pylons. A Ramesside town shows them only as hidden fill.',
    sources: [S.harrell, S.dkCons],
  },
  {
    id: 'gypsum-plaster', kind: 'material', name: 'gypsum plaster (burnt gypsum) and gypsum-sand mortar', confidence: 'read',
    attested: { from: -1550, to: null, approx: true, where: ['Egypt'] }, supply: 'rock gypsum heated to 100–200 °C, mixed with water',
    role: ['finish', 'mortar'], colour: ['#efeae0', '#e6e0d2'],
    notes: 'Used from late Predynastic times to fill cracks in temple and tomb walls and ceilings and to coat mudbrick; firm enough to carve and paint. Gypsum-sand mortar between stone blocks is recorded especially for the Old Kingdom.',
    sources: [S.harrell],
  },
  {
    id: 'lime-plaster', kind: 'material', name: 'lime plaster / lime mortar (NOT New Kingdom)', confidence: 'read',
    attested: { from: -305, to: null, approx: true, where: ['Egypt'] }, supply: 'burnt limestone (900–1000 °C), slaked',
    role: ['finish', 'mortar'], colour: ['#ece8dc'],
    notes: 'First appears in Egypt in the Ptolemaic Period. Recorded so the generator never whitewashes a New Kingdom wall with lime: use gypsum or chalk.',
    sources: [S.harrell],
  },
  {
    id: 'mud-plaster', kind: 'material', name: 'mud plaster with chopped straw', confidence: 'read',
    attested: { from: -1550, to: null, approx: true, where: ['Egypt'] }, supply: 'silt and chopped straw',
    role: ['finish', 'roof'], colour: ['#8a7660', '#9a8670'],
    notes: 'Spread over roof matting; first coat on house walls and on rough tomb rock before finer gypsum layers.',
    sources: [S.emeryArch, S.menna],
  },
  {
    id: 'paint-pigments', kind: 'material', name: 'mineral paints: Egyptian blue, Egyptian green, red and yellow ochre, orpiment, carbon black, gypsum/chalk/huntite white', confidence: 'secondary',
    attested: { from: -1550, to: null, approx: true, where: ['Theban temples and tombs'] }, supply: 'Egyptian blue a fired frit of silica, lime and copper; ochres and orpiment mined; black from soot',
    role: ['finish', 'ornament'], colour: ['#1f5fa8', '#2f7f6a', '#a8432a', '#c99a3b', '#e3b52c', '#1d1b19', '#f2efe6'],
    notes: 'NK palette: blue, green, red, yellow, black, white, plus mixed orange, pink, grey. Ochre layered with orpiment in royal tombs (Thutmose II, Amenhotep II, Amenhotep III). Painted stone reliefs covered walls, architraves and columns at Karnak (read). Hex values are estimates of fresh pigment, not measured.',
    sources: [S.menna, S.dkArch, S.harrell],
  },
  {
    id: 'cedar-timber', kind: 'material', name: 'imported conifer timber ("cedar") from Lebanon / northern Syria', confidence: 'read',
    attested: { from: -1550, to: null, approx: true, where: ['temple flagstaffs, doors, ships'] }, supply: 'shipped from the Levant',
    role: ['structure', 'ornament'], colour: ['#8a5a3a', '#9b6a46'],
    notes: 'The pylon flagstaffs at Karnak were of wood from Lebanon or northern Syria. Use for doors and ship hulls is the standard account (unconfirmed here).',
    sources: [S.dkCons],
  },
  {
    id: 'local-timber', kind: 'material', name: 'local timber: acacia, sycamore fig, tamarisk; imported dark hardwood for cramps', confidence: 'unverified',
    attested: { from: -1550, to: null, approx: true, where: ['Egypt'] }, supply: 'native trees, short lengths',
    role: ['structure', 'roof'], colour: ['#9a6b45', '#7d5a3c'],
    notes: 'Roof beams, columns in houses, door leaves, window grilles, cramps. Species-for-use not confirmed in a source read here.',
    sources: [S.emeryArch],
  },
  {
    id: 'palm', kind: 'material', name: 'date palm: ribs (and trunks)', confidence: 'secondary',
    attested: { from: -1550, to: null, approx: true, where: ['Egypt'] }, supply: 'local groves',
    role: ['roof', 'structure'], colour: ['#7a6146', '#8b7152'],
    notes: 'Palm ribs laid beam to beam in flat roofs (read). Palm trunks as beams is the standard account, unconfirmed.',
    sources: [S.emeryArch],
  },
  {
    id: 'reed', kind: 'material', name: 'reed bundles and reed matting', confidence: 'read',
    attested: { from: -1550, to: null, approx: true, where: ['Egypt'] }, supply: 'river and marsh reed',
    role: ['roof', 'structure'], colour: ['#c9b27a', '#b49c63'],
    notes: 'Roof matting between beams; loose reeds or mats laid every few courses in massive brick walls.',
    sources: [S.emeryArch, S.dkCons],
  },
  {
    id: 'gold-electrum', kind: 'material', name: 'gold and electrum sheet (gilding)', confidence: 'read',
    attested: { from: -1550, to: null, approx: true, where: ['Karnak obelisk tips', 'temple doors'] }, supply: 'Nubian and Eastern Desert gold',
    role: ['ornament'], colour: ['#d4af37', '#e6c55a'],
    notes: 'Several Karnak obelisk pyramidia were capped with gold or electrum sheet; great pylon doors gilded, usually with copper or bronze, sometimes silver, gold or electrum; Hatshepsut\'s pine columns in the Wadjet hall gilded.',
    sources: [S.dkArch],
  },
];

// ── methods ──────────────────────────────────────────────────────────────────────────────────────────
const METHODS = [
  {
    id: 'coursed-mudbrick', kind: 'method', name: 'coursed mudbrick walling, mud mortar in bed joints only', confidence: 'read',
    attested: { from: -1550, to: null, approx: true }, materials: ['mudbrick-nk', 'mud-mortar', 'sand-bed', 'reed'],
    notes: 'Brick footings in trenches on sand; stone footings or quoins where traffic or water undercut walls; in thick town and temple walls, timber beams and reed layers every set number of courses.',
    sources: [S.emeryArch],
  },
  {
    id: 'stamped-brick', kind: 'method', name: 'stamping bricks with the royal name', confidence: 'read',
    attested: { from: -1550, to: -600, approx: true }, materials: ['mudbrick-nk'],
    notes: 'From Ahmose; regular in the 18th and 19th Dynasties; sporadic to the 26th. King\'s name in an oval or cartouche; 21st-Dynasty high priests\' names and building names in rectangles. Deir el-Medina\'s first enclosure wall carries Thutmose I\'s stamped cartouche.',
    sources: [S.emeryBrick, S.toivari],
  },
  {
    id: 'pan-bedding', kind: 'method', name: 'pan-bedded (undulating) mudbrick courses in alternating sections — NOT New Kingdom', confidence: 'read',
    attested: { from: -700, to: -30, approx: true }, materials: ['mudbrick-nk', 'reed', 'local-timber'],
    notes: 'Massive temenos walls built in short sections whose courses lie on alternately concave and convex (or concave and level) beds, with reed layers between courses and cross-timbers every twelve to fifteen courses: a Late Period practice (Karnak, Elkab, Dendera), above all Nectanebo I\'s Karnak wall. Exclude from a c. 1250 BCE town.',
    disputes: ['Some accounts put the first pan-bedded walls in the 21st Dynasty (c. 1070–945 BCE); not confirmed here. Either date post-dates the Ramesside town.'],
    sources: [S.emeryArch, S.dkCons],
  },
  {
    id: 'flat-roof', kind: 'method', name: 'flat roof: beams, palm ribs or reed mats, mud plaster', confidence: 'read',
    attested: { from: -1550, to: null, approx: true }, materials: ['local-timber', 'palm', 'reed', 'mud-plaster'],
    notes: 'Beams from wall to wall or wall to architrave on columns; in the best rooms (Malqata) the ceiling underside plastered smooth and painted.',
    sources: [S.emeryArch],
  },
  {
    id: 'brick-vault', kind: 'method', name: 'mudbrick barrel vault (pitched, without centring)', confidence: 'read',
    attested: { from: -1550, to: null, approx: true }, materials: ['mudbrick-nk', 'mud-mortar'],
    notes: 'The Ramesseum storage magazines. Thinner, sometimes wedge-shaped, finger-scored vaulting bricks; inclined vaults leaning on an end wall were the more common kind.',
    sources: [S.emeryArch],
  },
  {
    id: 'nk-stone-masonry', kind: 'method', name: 'New Kingdom temple masonry: large blocks, irregular joints, courses of varying height, cased core', confidence: 'read',
    attested: { from: -1550, to: null, approx: true }, materials: ['silsila-sandstone', 'gypsum-plaster', 'mudbrick-nk'],
    notes: '18th–19th Dynasty walls and pylons at Karnak: rectangular blocks of slightly differing size set with irregular (often oblique) joints in courses of varying height; walls and pylons often two separate skins of good stone around a core of poorer or reused blocks; mudbrick ramps raised against the work; faces dressed only after setting, top-down. True uniform-course ashlar was occasional (Hatshepsut\'s Red Chapel) until the 25th Dynasty.',
    sources: [S.dkCons],
  },
  {
    id: 'gypsum-mortar-bed', kind: 'method', name: 'thin gypsum mortar between stone blocks', confidence: 'unverified',
    attested: { from: -1550, to: null, approx: true }, materials: ['gypsum-plaster', 'silsila-sandstone'],
    notes: 'Standard account (Arnold, Building in Egypt, 1991, not read): thin gypsum mortar as a bed and slide for blocks. The source read records gypsum-sand mortar mainly for the Old Kingdom.',
    sources: [S.harrell],
  },
  {
    id: 'standardized-courses', kind: 'method', name: 'standardized-course ashlar (uniform block heights) — NOT Ramesside', confidence: 'read',
    attested: { from: -747, to: null, approx: true }, materials: ['silsila-sandstone'],
    notes: 'Taken up at Karnak from the 25th Dynasty (Taharqo) with larger blocks in uniform courses; Ptolemaic builders added liquid-plaster beds. Do not use for a c. 1250 BCE temple.',
    sources: [S.dkCons],
  },
  {
    id: 'dovetail-cramp', kind: 'method', name: 'wooden dovetail cramps across block joints', confidence: 'read',
    attested: { from: -1550, to: null, approx: true }, materials: ['local-timber', 'silsila-sandstone'],
    notes: 'Hourglass-shaped wooden cramps in notches where a joint was thought strained; at Karnak in the architraves and column drums of the hypostyle hall and the colonnade of the first court.',
    sources: [S.dkCons],
  },
  {
    id: 'battered-pylon', kind: 'method', name: 'battered pylon towers with torus moulding, cavetto cornice and flagstaff recesses', confidence: 'read',
    attested: { from: -1550, to: null, approx: true }, materials: ['silsila-sandstone', 'cedar-timber', 'aswan-granite'],
    notes: 'Two trapezoidal battered towers split by a gateway; torus roll on the corners, cavetto cornice on top; vertical recesses on the façade let flagstaffs stand flush, held by giant wooden clamps through holes higher up. Cased core with reused fill (see nk-stone-masonry).',
    sources: [S.dkArch, S.dkCons],
  },
  {
    id: 'clerestory', kind: 'method', name: 'clerestory lighting through stone grilles', confidence: 'read',
    attested: { from: -1550, to: null, approx: true }, materials: ['silsila-sandstone'],
    notes: 'One roof section raised above its neighbours and lined with windows; Karnak hypostyle central nave, Akhmenu and Wadjet hall of Thutmose III; also common in NK houses.',
    sources: [S.dkArch],
  },
  {
    id: 'raised-relief', kind: 'method', name: 'raised (bas) relief, painted', confidence: 'read',
    attested: { from: -1550, to: null, approx: true }, materials: ['silsila-sandstone', 'paint-pigments'],
    notes: 'Background cut away; finer and slower. Sety I\'s north half of the hypostyle hall; Ramesses II began in raised relief.',
    sources: [S.dkHypo, S.brandMurnane, S.dkArch],
  },
  {
    id: 'sunk-relief', kind: 'method', name: 'sunk relief, painted', confidence: 'read',
    attested: { from: -1550, to: null, approx: true }, materials: ['silsila-sandstone', 'paint-pigments'],
    notes: 'Background left flat, figure cut into it; faster and bold in strong sun. Horemheb used it on the Second Pylon; Ramesses II switched to it early in his reign and recut his own and some of Sety\'s raised relief as sunk relief (south half of the hypostyle hall). The Ramesside default.',
    sources: [S.dkHypo, S.brandMurnane, S.ghhp],
  },
  {
    id: 'plaster-and-paint', kind: 'method', name: 'mud plaster, gypsum coats, then painting', confidence: 'secondary',
    attested: { from: -1550, to: null, approx: true }, materials: ['mud-plaster', 'gypsum-plaster', 'paint-pigments'],
    notes: 'Tomb chapels (Menna TT69): mud-straw plaster, grainy gypsum, fine gypsum skin, paint. Gypsum filled flaws in temple stone before carving and painting (read).',
    sources: [S.menna, S.harrell],
  },
  {
    id: 'whitewash', kind: 'method', name: 'whitewashing (gypsum or chalk, never lime)', confidence: 'secondary',
    attested: { from: -1550, to: null, approx: true }, materials: ['gypsum-plaster', 'mud-plaster'],
    notes: 'Deir el-Medina houses mud-plastered and painted white outside, some interiors whitewashed to about 1 m; Nakht\'s Amarna house had whitewashed walls and deep-blue ceilings. Lime is Ptolemaic.',
    sources: [S.oakesMcDowell, S.kemp2012, S.harrell],
  },
];

// ── building types ───────────────────────────────────────────────────────────────────────────────────
const TYPES = [
  {
    id: 'karnak-second-pylon', kind: 'type', name: 'temple pylon (Karnak Second Pylon, Horemheb; the Ramesside front gate)', confidence: 'read',
    built: { from: -1320, to: null, approx: true }, materials: ['silsila-sandstone', 'talatat', 'cedar-timber', 'aswan-granite', 'paint-pigments'],
    methods: ['battered-pylon', 'nk-stone-masonry', 'sunk-relief'],
    dims: { base: [46.4, 14.6], gatewayHeight: 29.5 },
    notes: 'Built by Horemheb (1323–1295 BCE), decorated by him and Ramesses I, re-carved by Sety I and Ramesses II; the temple\'s main entrance until Shoshenq I\'s court and gate. Core filled with Akhenaten\'s talatat. Original tower height unknown. Flagstaffs on thick granite bases in front.',
    disputes: ['Digital Karnak\'s "base 46.4 m long, 14.6 m wide" reads as one tower or a truncated figure; the overall width is not confirmed here.'],
    sources: [S.dkPylon2, S.brandMurnane, S.dkCons],
  },
  {
    id: 'luxor-pylon', kind: 'type', name: 'Luxor Temple pylon of Ramesses II, with obelisks and seated colossi', confidence: 'unverified',
    built: { from: -1275, to: null, approx: true }, materials: ['silsila-sandstone', 'aswan-granite', 'cedar-timber', 'paint-pigments'],
    methods: ['battered-pylon', 'nk-stone-masonry', 'sunk-relief'],
    dims: { width: 65, height: 24 },
    notes: 'Towers carved in sunk relief with the battle of Qadesh. Two obelisks (one now in Paris) and seated colossi before it.',
    sources: [S.luxorPylon],
  },
  {
    id: 'pylon-flagstaff', kind: 'type', name: 'pylon flagstaff (tall wooden mast with banners)', confidence: 'read',
    built: { from: -1550, to: null, approx: true }, materials: ['cedar-timber', 'aswan-granite'],
    dims: { baseDiameter: 1, aboveTower: true },
    notes: 'Poles of Levantine conifer on stone bases, standing in façade recesses, clamped through holes in the upper pylon; depicted taller than the towers, tapering, with coloured cloth banners. A Ninth-Pylon pole base measured over a metre across.',
    sources: [S.dkArch, S.dkCons, S.dkPylon2],
  },
  {
    id: 'obelisk', kind: 'type', name: 'granite obelisk, pyramidion sheathed in gold or electrum', confidence: 'secondary',
    built: { from: -1504, to: null, approx: true }, materials: ['aswan-granite', 'gold-electrum'],
    dims: { height: [21.2, 32.2], hatshepsutKarnak: 29.56, thutmoseIKarnak: 21.2, lateran: 32.18, luxorWest: 25, luxorParis: 22.83 },
    notes: 'Monoliths of Aswan granite, usually in pairs before a gateway; pyramidia capped with gold or electrum (read). Hatshepsut\'s standing Karnak obelisk ~29.6 m, Thutmose I\'s ~21.2 m; the Lateran obelisk (Thutmose III/IV, from Karnak) ~32.2 m; Ramesses II\'s pair at Luxor ~25 m and ~22.8 m (Paris). Ramesses II\'s overseer Bakenkhonsu raised a pair in east Karnak (read). Heights from a list, not from the monuments\' publications.',
    sources: [S.dkArch, S.dkCons, S.obeliskList],
  },
  {
    id: 'hypostyle-hall', kind: 'type', name: 'Great Hypostyle Hall, Karnak (Sety I and Ramesses II)', confidence: 'read',
    built: { from: -1294, to: null, approx: true }, materials: ['silsila-sandstone', 'gypsum-plaster', 'paint-pigments', 'local-timber'],
    methods: ['nk-stone-masonry', 'dovetail-cramp', 'clerestory', 'raised-relief', 'sunk-relief'],
    dims: { plan: [103, 52], area: 5000, columns: 134, naveColumns: 12, naveColumnHeight: 21, naveCapitalDiameter: 5.4, sideColumns: 122, sideColumnHeight: 15, sideShaftHeight: 12, clerestoryHeight: 24, rows: 16 },
    notes: 'Between the Second and Third Pylons. Twelve open-papyrus columns line the raised central nave; 122 closed-bud papyrus columns (61 each side). Sety I built walls and columns and decorated the north half in raised relief; Ramesses II finished the south half, mostly in sunk relief. Every surface carved and painted. Architraves to ~7 m, multi-block.',
    disputes: ['103×52 m (Digital Karnak) vs the often-quoted 102×53 m; abacus 1.4 m in one reading.'],
    sources: [S.dkHypo, S.ghhp, S.brandMurnane, S.dkArch, S.dkCons],
  },
  {
    id: 'open-court', kind: 'type', name: 'open forecourt / peristyle court', confidence: 'secondary',
    built: { from: -1550, to: null, approx: true }, materials: ['silsila-sandstone', 'paint-pigments'],
    methods: ['nk-stone-masonry', 'sunk-relief'],
    notes: 'Open to the sky behind the pylon, in front of the columned hall; the only part of the temple where the public might enter on feast days. Colonnades along its sides; Ramesses III\'s Karnak temple has Osiride royal-statue pillars. Ramesside courts are narrower, hemmed in by squat columns. No court dimensions confirmed.',
    sources: [S.dkArch],
  },
  {
    id: 'barque-sanctuary', kind: 'type', name: 'sanctuary and barque shrine', confidence: 'read',
    built: { from: -1550, to: null, approx: true }, materials: ['silsila-sandstone', 'calcite', 'aswan-granite', 'gold-electrum'],
    methods: ['nk-stone-masonry', 'raised-relief'],
    notes: 'Innermost, darkest room: floor rising and ceiling falling toward it. A naos with doors held the statue; a stone stand held the portable barque. Way-station barque shrines stood on processional routes (e.g. Sety II\'s triple shrine, later inside the first court).',
    sources: [S.dkArch],
  },
  {
    id: 'sacred-lake', kind: 'type', name: 'sacred lake (Karnak, Thutmose III)', confidence: 'read',
    built: { from: -1479, to: null, approx: true }, materials: ['silsila-sandstone'],
    dims: { plan: [128, 83] },
    notes: 'Thutmose III records digging a new sacred lake for Amun, perhaps replacing an older one; stepped access; priests\' purification. Taharqo modified it, how far is unknown. Stone lining material not confirmed here.',
    disputes: ['Digital Karnak gives 128×83 m; popular sources give 120×77 m and ~4 m deep.'],
    sources: [S.dkLake, S.dkArch],
  },
  {
    id: 'ram-sphinx-dromos', kind: 'type', name: 'avenue of ram-headed sphinxes (criosphinxes) from the quay to the Second Pylon', confidence: 'unverified',
    built: { from: -1279, to: null, approx: true }, materials: ['silsila-sandstone', 'paint-pigments'],
    notes: 'Lion-bodied, ram-headed sphinxes each sheltering a standing statue of Ramesses II; usurped c. 1050 BCE by the high priest Pinedjem; pushed aside into today\'s first court when the First Pylon was built. They led from the Ramesside quay to the Second Pylon.',
    sources: [S.amunPrecinct],
  },
  {
    id: 'nectanebo-sphinx-avenue', kind: 'type', name: 'the Karnak–Luxor avenue of human-headed sphinxes as it stands (Nectanebo I) — NOT Ramesside', confidence: 'read',
    built: { from: -380, to: null, approx: true }, materials: ['silsila-sandstone'],
    notes: 'Lion bodies with the head of Nectanebo I (380–362 BCE), carved and painted sandstone, replacing deteriorated New Kingdom processional sphinxes. For c. 1250 BCE use the processional way, not these.',
    sources: [S.memphisSphinx],
  },
  {
    id: 'seated-colossus', kind: 'type', name: 'seated royal colossus', confidence: 'unverified',
    built: { from: -1390, to: null, approx: true }, materials: ['aswan-granite', 'silsila-sandstone'],
    dims: { height: [16, 20] },
    notes: 'Pairs flank pylon gates (Luxor). The Ramesseum\'s "Ozymandias" granite colossus of Ramesses II, ~16–20 m high, ~1,000 t.',
    sources: [S.ramesseumColossus, S.luxorPylon],
  },
  {
    id: 'temple-enclosure-nk', kind: 'type', name: 'New Kingdom temple enclosure wall (mudbrick, straight-coursed)', confidence: 'read',
    built: { from: -1550, to: null, approx: true }, materials: ['mudbrick-nk', 'mud-mortar', 'sand-bed'], methods: ['coursed-mudbrick', 'stamped-brick'],
    notes: 'A New Kingdom enclosure wall of the Amun temple is excavated at the south-east corner of the sacred lake, with a priests\' quarter built square to it; smaller than and inside Nectanebo\'s. Its height, thickness and full line are not confirmed. Coursing assumed straight (pan-bedding is Late Period).',
    sources: [S.millet],
  },
  {
    id: 'nectanebo-enclosure', kind: 'type', name: 'great pan-bedded enclosure wall of Karnak (Nectanebo I) — NOT Ramesside', confidence: 'read',
    built: { from: -380, to: null, approx: true }, materials: ['mudbrick-nk', 'reed', 'local-timber'], methods: ['pan-bedding'],
    notes: 'Huge irregular-trapezoid mudbrick temenos of the 30th Dynasty, built with the First Pylon; wavy courses. It defines the precinct visitors see today; do not draw it around a New Kingdom Karnak.',
    sources: [S.dkCons, S.dkPylon1, S.millet],
  },
  {
    id: 'karnak-first-pylon', kind: 'type', name: 'Karnak First Pylon (Nectanebo I, unfinished) — NOT Ramesside', confidence: 'read',
    built: { from: -380, to: null, approx: true }, materials: ['silsila-sandstone', 'mudbrick-nk'], methods: ['standardized-courses'],
    dims: { width: 113, thickness: 14.5, heightNorth: 21.7, heightSouth: 31.65, gatewayHeight: 27.5, gatewayWidth: 7.4 },
    notes: 'Never finished; its mudbrick construction ramp still stands in the court behind. Towers would have reached ~38–40 m.',
    sources: [S.dkPylon1, S.dkCons],
  },
  {
    id: 'temple-quay', kind: 'type', name: 'temple quay with tribune and ramp to the water (Karnak)', confidence: 'unverified',
    built: { from: -1279, to: null, approx: true }, materials: ['silsila-sandstone'],
    notes: 'A cult terrace ("tribune") west of the Amun temple on the river or canal; attributed to Ramesses II, with Third Intermediate Period Nile-level texts cut in it and a ramp decorated under Taharqo. Digital Karnak confirms quays, ramps and revetments west of the temple but gives no date.',
    disputes: ['The Nile has migrated west since the New Kingdom; where the Ramesside landing lay relative to today\'s quay is not settled here.'],
    sources: [S.amunPrecinct, S.dkQuay, S.millet],
  },
  {
    id: 'deir-el-medina-house', kind: 'type', name: 'workmen\'s row house (Deir el-Medina)', confidence: 'read',
    built: { from: -1504, to: -1070, approx: true }, materials: ['mudbrick-nk', 'mud-mortar', 'limestone', 'mud-plaster', 'gypsum-plaster', 'local-timber', 'palm', 'reed'],
    methods: ['coursed-mudbrick', 'flat-roof', 'whitewash'],
    dims: { area: [50, 70], width: 5, rooms: [4, 5], stairToRoof: true },
    notes: 'Narrow terraced plan off the street: outer room with a plastered, painted brick lit-clos in a corner; main room with a column carrying the roof and a bench; a smaller room behind; corridor to a kitchen at the back (cellar); stair to the roof. Mudbrick on stone footings, mud-plastered, painted white outside. Households of three to five or more.',
    disputes: ['Average floor ~70 m² (Wikipedia, citing Oakes/McDowell) vs "about 5 by 10 m" in another summary.'],
    sources: [S.toivari, S.oakesMcDowell],
  },
  {
    id: 'theban-town-house', kind: 'type', name: 'multi-storey Theban town house (as in the tomb of Djehutynefer, TT104)', confidence: 'secondary',
    built: { from: -1427, to: null, approx: true }, materials: ['mudbrick-nk', 'mud-mortar', 'local-timber', 'palm', 'reed', 'mud-plaster', 'gypsum-plaster'],
    methods: ['coursed-mudbrick', 'flat-roof', 'whitewash'],
    dims: { storeys: [2, 3] },
    notes: 'Thebes was less systematically planned than the workmen\'s villages; plots were tight and houses rose two or more storeys (read, Emery). TT104 (Amenhotep II) shows a three-level house with stairs, the owner on the upper floor, scribes below, weaving on the lowest level, and conical grain silos and food work on the flat roof (secondary). Painting conventions may stack rooms that lay one behind another.',
    sources: [S.emeryArch, S.shedid],
  },
  {
    id: 'amarna-villa', kind: 'type', name: 'elite villa in a walled compound (Amarna model)', confidence: 'secondary',
    built: { from: -1347, to: -1332, approx: true }, materials: ['mudbrick-nk', 'mud-mortar', 'local-timber', 'limestone', 'gypsum-plaster', 'paint-pigments', 'palm', 'reed'],
    methods: ['coursed-mudbrick', 'flat-roof', 'clerestory', 'whitewash'],
    dims: { centralHall: [8, 8] },
    notes: 'Large focal central room from which the rest opened, roof on painted wooden columns, clerestory lighting (NK houses, read); staircase to roof or upper storey; external courtyards with substantial mudbrick granaries, sometimes ponds and shrines, inside an enclosure wall; stone door frames inscribed with the owner\'s name in elite houses (read). Nakht\'s house: ~30 ground-floor rooms, central hall ~8 m square (secondary). Amarna is the evidence; for Ramesside Thebes it is an analogue.',
    sources: [S.stevens, S.amarnaNorth, S.dkArch, S.emeryArch, S.kemp2012],
  },
  {
    id: 'granary-silo', kind: 'type', name: 'circular mudbrick grain silo', confidence: 'secondary',
    built: { from: -1550, to: null, approx: true }, materials: ['mudbrick-nk', 'mud-plaster'], methods: ['coursed-mudbrick'],
    notes: 'Batteries in villa courtyards (an Amarna North Suburb house had eleven, read); conical silos on a Theban roof in TT104 (secondary); silos in Karnak settlement layers (read). Diameter and height not confirmed.',
    sources: [S.stevens, S.amarnaNorth, S.millet, S.shedid],
  },
  {
    id: 'brick-magazines', kind: 'type', name: 'vaulted mudbrick storage magazines (Ramesseum)', confidence: 'read',
    built: { from: -1279, to: null, approx: true }, materials: ['mudbrick-nk', 'mud-mortar'], methods: ['brick-vault', 'stamped-brick'],
    notes: 'Long barrel-vaulted rooms round the Ramesseum temple.', sources: [S.emeryArch, S.emeryBrick],
  },
  {
    id: 'shaduf', kind: 'type', name: 'shaduf (counterweighted water-lifting pole)', confidence: 'unverified',
    built: { from: -1400, to: null, approx: true }, materials: ['local-timber', 'mud-plaster'],
    dims: { height: [3, 4] },
    notes: 'Appears in Egypt after 2000 BCE, most likely in the 18th Dynasty; depicted in Theban tombs, e.g. the garden scene of Ipuy (TT217, reign of Ramesses II). Height a guess from depictions, unmeasured.',
    disputes: ['Commonly said to be first shown in Amarna-period tombs; not confirmed here.'],
    sources: [S.shadoofWiki, S.ipuy],
  },
  {
    id: 'nile-ship', kind: 'type', name: 'Nile ship: sail upstream, row or drift downstream', confidence: 'secondary',
    built: { from: -1550, to: null, approx: true }, materials: ['cedar-timber', 'local-timber', 'reed'],
    notes: 'Stone came to Thebes by boat: heavy loads floated down from Silsila and Aswan; going upstream needed the sail and the northerly wind (read). Rig, hull form and sizes not confirmed here.',
    sources: [S.harrell],
  },
];

// ── urban form ───────────────────────────────────────────────────────────────────────────────────────
const FORMS = [
  {
    id: 'temple-axis-to-nile', kind: 'form', name: 'temple axes perpendicular to the Nile', confidence: 'read',
    attested: { from: -1550, to: null, approx: true },
    notes: 'Most Theban temples sit square to the river, which set Karnak\'s east–west axis; Karnak\'s second, north–south axis (Seventh to Tenth Pylons) bends toward the Mut temple; Luxor\'s core is square to the river but its northern courts skew to face Karnak.',
    sources: [S.dkArch],
  },
  {
    id: 'karnak-front-in-ramesside', kind: 'form', name: 'Karnak in c. 1250 BCE: front at the Second Pylon, growth westward toward the river', confidence: 'read',
    attested: { from: -1320, to: -945, approx: true },
    notes: 'The Second Pylon was the main gate until Shoshenq I (c. 945 BCE) built the court and gate in front; the temple grew westward as the Nile migrated west. Houses in front of today\'s First Pylon date only from the late 3rd century BCE.',
    sources: [S.dkPylon2, S.millet],
  },
  {
    id: 'temple-basin-canal', kind: 'form', name: 'T-shaped basin and canal before the temple entrance, lined with trees', confidence: 'read',
    attested: { from: -1330, to: null, approx: true },
    notes: 'The tomb of Neferhotep (TT49, late 18th Dynasty) paints what is probably Karnak\'s western entrance: a T-shaped basin and canal before the pylon, four rows of trees, more trees behind the pylon.',
    sources: [S.dkArch],
  },
  {
    id: 'processional-way', kind: 'form', name: 'processional way Karnak–Luxor (Opet), sphinx-lined', confidence: 'secondary',
    attested: { from: -1390, to: null, approx: true },
    notes: 'A New Kingdom processional route with sphinxes already joined the two temples (read: the Nectanebo sphinxes replaced deteriorated New Kingdom ones); length ~2.7 km. Use earlier sphinx types (ram-headed or royal) and way-station barque shrines, not Nectanebo\'s.',
    disputes: ['Start under Amenhotep III and the land/river split of the Opet procession are the standard account, unconfirmed here.'],
    sources: [S.memphisSphinx, S.amunPrecinct],
  },
  {
    id: 'east-west-bank', kind: 'form', name: 'east bank: town and state temples; west bank: memorial temples, tomb-builders\' village, necropolis', confidence: 'secondary',
    attested: { from: -1550, to: -1070, approx: true },
    notes: 'West bank: royal memorial temples (Ramesseum, Medinet Habu) with stamped-brick precincts and magazines, Deir el-Medina, the private tombs. East bank: Karnak, Luxor and the living city. The bank split is the standard account; the source read places the royal memorial complexes and Deir el-Medina on the west bank.',
    sources: [S.emeryBrick, S.toivari, S.millet],
  },
  {
    id: 'thebes-town', kind: 'form', name: 'the east-bank town: unplanned, dense, multi-storey, poorly known', confidence: 'read',
    attested: { from: -1550, to: -1070, approx: true },
    notes: 'Thebes was a less systematically planned town than the workmen\'s villages, with multi-storey houses on tight plots. As Karnak grew in the NK the old town beside it was largely covered by temple buildings; NK settlement at east Karnak is known only from Ramesside houses and stores. The NK town itself remains very poorly known: a gap for the settlement phase.',
    sources: [S.emeryArch, S.millet],
  },
  {
    id: 'deir-el-medina-village', kind: 'form', name: 'Deir el-Medina: walled workmen\'s village on a central street', confidence: 'read',
    attested: { from: -1504, to: -1070, approx: true },
    notes: 'Rectangular, NE–SW, ~5,600 m² in its late phase, ~68 houses either side of a central road, enclosure wall of stamped brick (Thutmose I); about a dozen houses at first, ~40 after Horemheb\'s reorganisation, twelve modifications in all; water-jar store outside the NE end; some houses outside the wall; abandoned under Ramesses XI.',
    sources: [S.toivari, S.oakesMcDowell],
  },
  {
    id: 'amarna-workmen-village', kind: 'form', name: 'Amarna workmen\'s village: 73 equal plots in a wall', confidence: 'read',
    attested: { from: -1347, to: -1332, approx: true },
    notes: 'Rows of 73 equal house plots and one larger house, perimeter wall ~80 cm thick with two entrances; tripartite houses with a stair to the roof or upper storey.',
    sources: [S.stevens],
  },
  {
    id: 'amarna-loose-layout', kind: 'form', name: 'Amarna: piecemeal suburbs, small houses clustered round large estates', confidence: 'read',
    attested: { from: -1347, to: -1332, approx: true },
    notes: 'Residential areas grew piecemeal, small houses abutting in cramped spaces; thoroughfares formed between them; three north–south roads in the Main City, not straight or parallel; wells in private compounds and open spaces; few public spaces. Ground-floor areas graded smoothly, without sharp class breaks.',
    sources: [S.stevens, S.amarnaMain],
  },
];

export const EGYPT_RECORD = [...MATERIALS, ...METHODS, ...TYPES, ...FORMS, ...NEW_KINGDOM_DRESS];
export const EGYPT_SOURCES = S;
