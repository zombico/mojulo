/**
 * The record for Old Kingdom Giza, Lower Egypt — the 4th Dynasty pyramid field (c. 2600–2490 BCE), read
 * at the reign of Menkaure, the last of the three Giza pyramid kings. Format and checks: ../record.js.
 *
 * `confidence` says how far each entry is checked: 'read' = the cited source was read directly;
 * 'secondary' = reached through a page that names the source, or through a search summary of one;
 * 'unverified' = the standard account, not yet confirmed. Dimensions: building dims in m.
 *
 * CHRONOLOGY. The Old Kingdom has no fixed dates and the schemes in use differ by up to ~80 years. This
 * record puts years on the Oxford History (Shaw 2000) scale, the one Wikipedia uses (approx: true):
 *   Sneferu 2613–2589 · Khufu 2589–2566 · Djedefre 2566–2558 · Khafre 2558–2532 · Menkaure 2532–2503 ·
 *   Shepseskaf 2503–2498 (GIZA_REIGNS below).
 * AERA's web pages use Lehner's older scheme (Khufu 2551–2528, Khafre 2520–2494, Menkaure 2490–2472);
 * AERA's 2019 AERAGRAM uses Hornung et al. 2006 (Shepseskaf 2441–2436). On Shaw's scale "c. 2500 BCE" is
 * the end of Menkaure's reign / Shepseskaf; on Lehner's it is late Khafre. A scene "in Menkaure's reign"
 * should read the record at about −2515 on this scale, not at −2500.
 *
 * Anachronisms the generator must not use for Menkaure's Giza (each is in the record with its real date,
 * so `inUseAt` excludes it): the Sphinx's beard (18th Dynasty); the Dream Stele of Thutmose IV (c. 1401
 * BCE) and the New Kingdom mudbrick walls round the Sphinx; Amenhotep II's Sphinx temple; the stelae and
 * restorations of Ramesses II's time (Khaemwaset); Saite and Roman restoration masonry on the Sphinx;
 * the stripped, stepped look of the pyramids (casing loosened by the 1303 CE earthquake and carried off
 * to Cairo; Khafre's cap of casing is what survived). Mud-brick completion of Menkaure's temples by
 * Shepseskaf is dated from 2503 BCE: AFTER a mid-reign Menkaure scene, at the edge of "c. 2500". A gilded
 * pyramidion on Khufu's pyramid is NOT attested at any date: no entry gives one (see khufu-satellite-pyramid).
 */

// ── sources ──────────────────────────────────────────────────────────────────────────────────────────
const S = {
  harrell: { author: 'J. A. Harrell', title: 'Building Stones (UCLA Encyclopedia of Egyptology)', year: 2012, url: 'https://escholarship.org/uc/item/3fd124g0' },
  lehnerHarbors: { author: 'M. Lehner', title: 'On the Waterfront: Canals and Harbors in the Time of Giza Pyramid-Building (AERAGRAM 15-1&2)', year: 2014, url: 'https://aeraweb.org/wp-content/uploads/2022/08/aeragram15_1-2.pdf' },
  aeraKKTBasin: { author: 'AERA (M. Lehner et al.)', title: 'Construction Hub to Cult Center: Re-purposing, Old Kingdom Style (AERAGRAM 15-1&2)', year: 2014, url: 'https://aeraweb.org/wp-content/uploads/2022/08/aeragram15_1-2.pdf' },
  aeraMVT: { author: 'AERA (M. Lehner et al.)', title: 'Return to the Menkaure Valley Temple (AERAGRAM 20-1)', year: 2019, url: 'https://www.aeraweb.org/wp-content/uploads/2021/11/AG-20-1.pdf' },
  aeraWall: { author: 'AERA', title: 'The Wall of the Crow (web page; year = accessed)', year: 2026, url: 'https://aeraweb.org/wall-of-the-crow/' },
  aeraLostCity: { author: 'AERA', title: 'The Lost City of the Pyramid Builders (web page; year = accessed)', year: 2026, url: 'https://aeraweb.org/projects/lost-city/' },
  aeraRAB: { author: 'AERA', title: 'A Royal Building (web page; year = accessed)', year: 2026, url: 'https://aeraweb.org/royal-building/' },
  aeraKhafre: { author: 'AERA (M. Lehner)', title: 'Khafre\'s Monuments as a Unit (web page; year = accessed)', year: 2026, url: 'https://aeraweb.org/khafres-monuments/' },
  aeraWhoSphinx: { author: 'AERA (M. Lehner)', title: 'Who Built the Sphinx? (web page; year = accessed)', year: 2026, url: 'https://aeraweb.org/projects/who-built-the-sphinx/' },
  hawassTemples: { author: 'Z. Hawass', title: 'The Development of the Ancient Egyptian Royal Mortuary Complex (web text)', year: 2026, url: 'https://www.guardians.net/hawass/mortuary1.htm' },
  hawassSphinx: { author: 'Z. Hawass', title: 'History of the Conservation of the Sphinx (web text)', year: 2026, url: 'https://www.guardians.net/hawass/sphinx2.htm' },
  manuelian: { author: 'P. Der Manuelian', title: 'A Re-examination of Reisner\'s Nucleus Cemetery Concept at Giza (Old Kingdom Art and Archaeology, Prague)', year: 2006, url: 'https://www.gizapyramids.org/pdf_library/manuelian_okaa_2006.pdf' },
  // reached through Wikipedia (which cites Lehner, Reisner, Tallet, Hawass, Arnold et al.) or search summaries
  wikiKhufu: { author: 'Wikipedia', title: 'Great Pyramid of Giza', year: 2026, url: 'https://en.wikipedia.org/wiki/Great_Pyramid_of_Giza', via: 'read; secondary to the works it cites' },
  wikiKhafre: { author: 'Wikipedia', title: 'Pyramid of Khafre', year: 2026, url: 'https://en.wikipedia.org/wiki/Pyramid_of_Khafre', via: 'read; secondary to the works it cites' },
  wikiMenkaure: { author: 'Wikipedia', title: 'Pyramid of Menkaure (citing Reisner, Mycerinus, 1931; Lehner)', year: 2026, url: 'https://en.wikipedia.org/wiki/Pyramid_of_Menkaure', via: 'read; secondary to the works it cites' },
  wikiSphinx: { author: 'Wikipedia', title: 'Great Sphinx of Giza', year: 2026, url: 'https://en.wikipedia.org/wiki/Great_Sphinx_of_Giza', via: 'read; secondary to the works it cites' },
  wikiEastField: { author: 'Wikipedia', title: 'Giza East Field (citing Reisner)', year: 2026, url: 'https://en.wikipedia.org/wiki/Giza_East_Field', via: 'read; secondary to the works it cites' },
  wikiShip: { author: 'Wikipedia', title: 'Khufu ship', year: 2026, url: 'https://en.wikipedia.org/wiki/Khufu_ship', via: 'read; secondary to the works it cites' },
  wikiDream: { author: 'Wikipedia', title: 'Dream Stele', year: 2026, url: 'https://en.wikipedia.org/wiki/Dream_Stele', via: 'read; secondary to the works it cites' },
  wikiWidan: { author: 'Wikipedia', title: 'Widan el Faras Basalt (citing Harrell & Bown 1995)', year: 2026, url: 'https://en.wikipedia.org/wiki/Widan_el_Faras_Basalt', via: 'read; secondary to the works it cites' },
  tallet: { author: 'P. Tallet', title: 'Les papyrus de la mer Rouge I: le « journal de Merer » (papyrus Jarf A et B)', year: 2017, via: 'Wikipedia "Diary of Merer" (read)' },
  harrellBown: { author: 'J. A. Harrell, T. M. Bown', title: 'An Old Kingdom Basalt Quarry at Widan el-Faras and the Quarry Road to Lake Moeris (JARCE 32, 71–91)', year: 1995, via: 'Wikipedia and search-result summary; not read' },
  khufuTemple: { author: 'Wikipedia', title: 'Giza pyramid complex (Khufu\'s pyramid temple)', year: 2026, url: 'https://en.wikipedia.org/wiki/Giza_pyramid_complex', via: 'search-result summary only' },
  galleries: { author: 'M. Lehner', title: 'Labor and the Pyramids: The Heit el-Ghurab "Workers Town" at Giza', year: 2015, via: 'search-result summary only (ResearchGate)' },
  junkerG4000: { author: 'H. Junker', title: 'Gîza I (mastaba G 4000 of Hemiunu)', year: 1929, via: 'search-result summary of a secondary paper' },
  khafreVT: { author: 'U. Hölscher', title: 'Das Grabdenkmal des Königs Chephren', year: 1912, via: 'not read; dimensions from popular pages and search summaries' },
  bmBeard: { author: 'British Museum', title: 'Fragment of the beard of the Great Sphinx, EA 58', year: 2026, via: 'search-result summary only' },
  lehnerDiag: { author: 'M. Lehner', title: 'The Development of the Giza Necropolis: The Khufu Project (MDAIK 41)', year: 1985, via: 'standard account; not read' },
  arnold: { author: 'D. Arnold', title: 'Building in Egypt: Pharaonic Stone Masonry', year: 1991, via: 'standard account; not read' },
  quake1303: { author: 'Wikipedia', title: '1303 Crete earthquake (damage in Cairo)', year: 2026, url: 'https://en.wikipedia.org/wiki/1303_Crete_earthquake', via: 'search-result summary only' },
};

/** Reign spans on the record's year scale (Shaw 2000; BCE negative). */
export const GIZA_REIGNS = {
  sneferu: { from: -2613, to: -2589 }, khufu: { from: -2589, to: -2566 }, djedefre: { from: -2566, to: -2558 },
  khafre: { from: -2558, to: -2532 }, menkaure: { from: -2532, to: -2503 }, shepseskaf: { from: -2503, to: -2498 },
};

// ── materials ────────────────────────────────────────────────────────────────────────────────────────
const MATERIALS = [
  {
    id: 'giza-limestone', kind: 'material', name: 'local Giza limestone (Mokattam Group, Observatory Formation; nummulitic)', confidence: 'read',
    attested: { from: -2589, to: null, approx: true, where: ['quarries on the Giza plateau (Central Field; beside Khafre\'s pyramid)', 'pyramid cores', 'mastaba cores', 'the Sphinx'] },
    supply: 'quarried on the plateau itself, a few hundred metres from the work',
    role: ['structure', 'wall', 'foundation'], colour: ['#c9b48a', '#bfa77c', '#d4c29c'],
    notes: 'Medium- to coarse-grained packstone to fine mudstone with foraminifera, often nummulitids; occasionally dolomitic, gypsiferous or marly. Harrell lists the Giza quarry as OK:4 (4th Dynasty), large. The Sphinx is carved in three members of it: Member I a hard grey reef bed, Member II soft yellowish marl-clay layers, Member III a massive fine bed forming the head (AERA). The plateau rock tilts ~6° down from NW to SE. Colours are estimates of weathered buff stone, not measured.',
    sources: [S.harrell, S.aeraWhoSphinx, S.lehnerHarbors],
  },
  {
    id: 'tura-limestone', kind: 'material', name: 'fine white Tura-Masara limestone (casing)', confidence: 'read',
    attested: { from: -2589, to: null, approx: true, where: ['Gebel Tura and Gebel Hof (el-Masara), east bank opposite Giza', 'pyramid and mastaba casings, passage linings'] },
    supply: 'cave-like galleries in the east-bank cliffs; shipped across the floodplain by boat',
    role: ['finish', 'wall'], colour: ['#efeadf', '#f4f0e6', '#e6dfcf'],
    notes: 'Egyptian "fine white stone of Tura-Masara". Large fracture-free blocks of uniform colour and texture, used for the exterior casing of Old and Middle Kingdom pyramids and mastabas in the Memphite necropolis and to line interior passages and burial chambers. The cap of casing surviving at the top of Khafre\'s pyramid is of it. Same Mokattam Group as Giza stone, but finer. Colour an estimate of fresh dressed stone (it would have read near white in sun).',
    sources: [S.harrell, S.wikiKhufu],
  },
  {
    id: 'aswan-granite', kind: 'material', name: 'Aswan red (rose) granite, and dark granodiorite', confidence: 'read',
    attested: { from: -2589, to: null, approx: true, where: ['Aswan quarries, ~900 km upriver', 'Khufu\'s King\'s Chamber', 'Khafre\'s lowest casing course, temples', 'Menkaure\'s lower casing courses'] },
    supply: 'quarried at Aswan and floated downstream',
    role: ['finish', 'structure', 'paving'], colour: ['#a86e5c', '#8e5b4b', '#b07a66', '#3b3836'],
    notes: 'Harrell\'s figure of Menkaure\'s pyramid shows tumbled blocks of both Aswan granite and granodiorite from its lower courses (read). Khufu\'s King\'s Chamber blocks weigh up to ~80 t (secondary). Khafre\'s temples are limestone-cored and faced with granite. The dark hex is granodiorite.',
    sources: [S.harrell, S.wikiKhufu, S.hawassTemples],
  },
  {
    id: 'basalt-widan', kind: 'material', name: 'black basalt of Widan el-Faras (northern Faiyum)', confidence: 'read',
    attested: { from: -2589, to: -2345, approx: true, where: ['Widan el-Faras quarry, north of Birket Qarun', 'Khufu\'s pyramid temple court', 'Khufu\'s valley temple', 'Zaghloul Street wall (Khufu\'s harbour)'] },
    supply: 'quarried at Widan el-Faras, dragged ~11–12 km on a paved quarry road to Lake Moeris (Qasr el-Sagha), then by water',
    role: ['paving', 'wall'], colour: ['#2b2a28', '#3a3936', '#24282a'],
    notes: 'Harrell names basalt among Old Kingdom ornamental building stones (read). Widan el-Faras basalt paved 4th–5th Dynasty mortuary temples at Giza and Abusir (secondary). Lehner: Khufu\'s valley-temple pavement is "black-green" basalt (Hawass) and the Zaghloul Street wall\'s basalt matches the upper temple, causeway and valley temple (read). End date = end of the 5th Dynasty, approx.',
    sources: [S.harrell, S.lehnerHarbors, S.hawassTemples, S.wikiWidan, S.harrellBown],
  },
  {
    id: 'travertine', kind: 'material', name: 'travertine ("Egyptian alabaster", calcite)', confidence: 'secondary',
    attested: { from: -2589, to: null, approx: true, where: ['Khafre\'s valley temple floor', 'Khafre\'s mortuary temple floor'] },
    supply: 'Middle Egyptian quarries (Hatnub and others)',
    role: ['paving', 'finish'], colour: ['#efe6d2', '#e2d5b8', '#f3ecdc'],
    notes: 'Harrell: travertine was an Old Kingdom building stone; "Egyptian alabaster" is a misnomer for it (read). Its use as the floor of Khafre\'s valley temple (T-hall) and in the mortuary temple is from Wikipedia and popular pages (secondary). Which quarry supplied Giza is not confirmed here.',
    sources: [S.harrell, S.wikiKhafre],
  },
  {
    id: 'gypsum-mortar', kind: 'material', name: 'gypsum-sand mortar and gypsum plaster', confidence: 'read',
    attested: { from: -2613, to: null, approx: true, where: ['Old Kingdom pyramids and mastabas'] }, supply: 'rock gypsum (Faiyum, e.g. Umm el-Sawan) burnt at 100–200 °C, mixed with sand and water',
    role: ['mortar', 'finish'], colour: ['#ece6d8', '#e4dccb'],
    notes: '"A mixture of gypsum and sand aggregate was commonly used for mortar between stone blocks, especially in Old Kingdom pyramids and mastabas" (Harrell). Lime mortar and lime plaster are Ptolemaic: never use them at Giza. Wikipedia describes the Great Pyramid mortar as limestone-based with organic inclusions; not reconciled here.',
    disputes: ['Harrell (gypsum-sand mortar) vs Wikipedia (limestone-based mortar with organic inclusions) for the Great Pyramid.'],
    sources: [S.harrell, S.wikiKhufu],
  },
  {
    id: 'mudbrick-ok', kind: 'material', name: 'sun-dried Nile-silt mudbrick', confidence: 'read',
    attested: { from: -2613, to: null, approx: true, where: ['Heit el-Ghurab town', 'Khentkawes basin and town', 'Menkaure\'s temples as finished by Shepseskaf', 'silos'] },
    supply: 'Nile silt, moulded and sun-dried near the work',
    role: ['wall', 'structure'], colour: ['#6b5a47', '#7a6852', '#5e5040'],
    notes: 'AERA: the Khentkawes basin edges were cased with mudbrick; RAB silos were mudbrick; mudbricks and timbers were robbed from the Lost City for reuse; Shepseskaf completed Menkaure\'s temples in mudbrick (read). Brick unit size at Giza not confirmed here. Colours are estimates.',
    sources: [S.aeraKKTBasin, S.aeraRAB, S.aeraLostCity, S.aeraMVT],
  },
  {
    id: 'limestone-debris', kind: 'material', name: 'limestone quarry debris and compacted chip (terraces, ramps, fill)', confidence: 'read',
    attested: { from: -2589, to: null, approx: true, where: ['Khentkawes basin terraces', 'terrace north of the Wall of the Crow', 'Menkaure valley temple foundation'] },
    supply: 'waste from the plateau quarries',
    role: ['foundation'], colour: ['#d8c9a8', '#cdbd99'],
    notes: 'Workers terraced the Khentkawes basin perimeter with quarry debris; a 4th Dynasty terrace of compacted limestone debris lies north of the Wall of the Crow; Shepseskaf filled between Menkaure\'s core blocks with crushed limestone (read).',
    sources: [S.aeraKKTBasin, S.lehnerHarbors, S.aeraMVT],
  },
  {
    id: 'cedar', kind: 'material', name: 'imported Lebanese cedar (boat and large timber)', confidence: 'secondary',
    attested: { from: -2613, to: null, approx: true, where: ['Khufu\'s boat pits'] }, supply: 'shipped from the Levant',
    role: ['structure'], colour: ['#9b6a46', '#8a5a3a'],
    notes: 'Khufu\'s ship is largely Lebanon cedar, with tenons of Christ\'s-thorn and lashings of halfa grass. Use of cedar in Giza buildings (roofs, doors) is not confirmed here.',
    sources: [S.wikiShip],
  },
];

// ── methods ──────────────────────────────────────────────────────────────────────────────────────────
const METHODS = [
  {
    id: 'plateau-quarrying', kind: 'method', name: 'open quarrying of the plateau beside the work', confidence: 'read',
    attested: { from: -2589, to: null, approx: true }, materials: ['giza-limestone', 'limestone-debris'],
    notes: 'Core stone came from quarries on the plateau (one beside Khafre\'s pyramid). The bedrock was cut more than 10 m deep for Khafre\'s pyramid platform and the central wadi between the Moqattam and Maadi formations was quarried more than 30 m deep (Lehner). Quarried pits and faces are part of the landscape at c. 2500 BCE.',
    sources: [S.harrell, S.lehnerHarbors],
  },
  {
    id: 'boat-transport', kind: 'method', name: 'boat transport of stone on the flood, through dug canals and harbour basins', confidence: 'read',
    attested: { from: -2589, to: null, approx: true }, materials: ['tura-limestone', 'aswan-granite', 'basalt-widan'],
    notes: 'Merer\'s logbook (Wadi el-Jarf papyri, year 26/27 of Khufu): a crew of ~40 boatmen shipped Tura limestone to Akhet-Khufu (the pyramid), roughly 30 blocks of 2–3 t per ~10-day round trip, via a harbour/administrative centre Ro-She-Khufu ("entrance of the Lake of Khufu") under the vizier Ankhhaf (secondary). Lehner (read): the Nile flood rose 7 m; builders dug canals and basins into the floodplain so heavy cargo boats could reach the plateau foot at flood peak (13.5–14 m asl).',
    sources: [S.tallet, S.lehnerHarbors],
  },
  {
    id: 'gypsum-bedding', kind: 'method', name: 'blocks set in gypsum-sand mortar', confidence: 'read',
    attested: { from: -2589, to: null, approx: true }, materials: ['gypsum-mortar', 'giza-limestone', 'tura-limestone'],
    notes: 'Per Harrell, standard in Old Kingdom pyramids and mastabas.', sources: [S.harrell],
  },
  {
    id: 'dress-after-setting', kind: 'method', name: 'casing set rough and dressed after setting, top-down', confidence: 'secondary',
    attested: { from: -2589, to: null, approx: true }, materials: ['tura-limestone', 'aswan-granite'],
    notes: 'Faces were cut to the slope and smoothed after the blocks were laid; Menkaure\'s granite casing shows what happens when the work stops: much of it was never smoothed (Wikipedia, citing Reisner). Dressing from the apex downward as the ramps came down is the standard account (Arnold), not confirmed here.',
    sources: [S.wikiMenkaure, S.wikiKhufu, S.arnold],
  },
  {
    id: 'construction-ramps', kind: 'method', name: 'construction ramps (form debated)', confidence: 'unverified',
    attested: { from: -2589, to: null, approx: true }, materials: ['limestone-debris', 'mudbrick-ok'],
    notes: 'Ramps of rubble, debris and mudbrick were certainly used, but whether straight, spiral, zig-zag or internal is debated. They were removed on completion: a finished pyramid shows none. A pyramid under construction (Menkaure\'s at c. 2515 BCE) might. Sledges hauled on wetted ground (secondary).',
    disputes: ['Straight frontal ramp vs spiral/accretion ramps vs internal ramp: no consensus.'],
    sources: [S.arnold, S.khufuTemple],
  },
  {
    id: 'corbelling', kind: 'method', name: 'corbelled stone roofing', confidence: 'secondary',
    attested: { from: -2589, to: null, approx: true }, materials: ['giza-limestone', 'tura-limestone'],
    notes: 'The Grand Gallery of Khufu\'s pyramid has a corbelled ceiling. Interior only: nothing corbelled shows on the outside. Older than Giza (Sneferu); dated here from the start of work at Giza, like the other methods.',
    sources: [S.wikiKhufu],
  },
  {
    id: 'granite-casing-over-core', kind: 'method', name: 'limestone core faced (sheathed) with granite', confidence: 'read',
    attested: { from: -2558, to: null, approx: true }, materials: ['giza-limestone', 'aswan-granite'],
    notes: 'Khafre\'s mortuary temple: local limestone with its outer wall faced with granite (Hawass). Khafre\'s valley temple: megalithic limestone core sheathed in red granite. Menkaure laid limestone core blocks for his valley temple that were to be sheathed in granite (AERA).',
    sources: [S.hawassTemples, S.aeraMVT],
  },
  {
    id: 'rubble-mastaba', kind: 'method', name: 'mastaba core: stepped retaining wall of small limestone blocks, filled with rubble', confidence: 'read',
    attested: { from: -2589, to: null, approx: true }, materials: ['giza-limestone', 'limestone-debris', 'tura-limestone'],
    notes: 'Reisner type IIa (quoted by Manuelian): a filled mastaba with a retaining wall of small drab limestone blocks in low-stepped courses, filled with sand, gravel, rocks and rubbish; no niches; slab stela; one shaft cased above with stone. Type IIb filled solid with small blocks. Many cores were later given a smooth fine-limestone casing and an exterior stone chapel with a false door.',
    sources: [S.manuelian],
  },
  {
    id: 'mudbrick-walling', kind: 'method', name: 'mudbrick walling and vaulting', confidence: 'secondary',
    attested: { from: -2613, to: null, approx: true }, materials: ['mudbrick-ok'],
    notes: 'Town walls, silos, basin revetments and enclosure walls. AERA suggests barrel-vaulted roofs for some gallery complexes (read, tentatively). Bond and course details not confirmed here.',
    sources: [S.aeraLostCity, S.aeraKKTBasin],
  },
  {
    id: 'lashed-boatbuilding', kind: 'method', name: 'shell-first boatbuilding: planks on unpegged tenons, lashed', confidence: 'secondary',
    attested: { from: -2589, to: null, approx: true }, materials: ['cedar'],
    notes: 'Khufu\'s ship: flat bottom of several planks, no keel, lashed with halfa grass.', sources: [S.wikiShip],
  },
];

// ── building types ───────────────────────────────────────────────────────────────────────────────────
const P4 = ['giza-limestone', 'tura-limestone', 'aswan-granite', 'gypsum-mortar'];
const PM = ['plateau-quarrying', 'boat-transport', 'gypsum-bedding', 'dress-after-setting', 'construction-ramps'];
const TYPES = [
  {
    id: 'khufu-pyramid', kind: 'type', name: 'Great Pyramid of Khufu (G1), fully cased in white Tura limestone', confidence: 'secondary',
    built: { from: -2589, to: null, approx: true }, materials: P4, methods: [...PM, 'corbelling'],
    dims: { base: 230.33, height: 146.6, slopeDeg: 51.844, heightToday: 138.5 },
    notes: 'Slope 51°50\'40". Core of local limestone, casing of Tura limestone set with mortar, faces cut to the slope and polished; granite King\'s Chamber. At c. 2500 BCE: a smooth white pyramid with a sharp apex. Capstone lost; no evidence of gilding (the only 4th-Dynasty pyramidion found, from G1d, is plain limestone).',
    sources: [S.wikiKhufu, S.harrell],
  },
  {
    id: 'khafre-pyramid', kind: 'type', name: 'Pyramid of Khafre (G2), granite lowest course, Tura limestone above', confidence: 'secondary',
    built: { from: -2558, to: null, approx: true }, materials: P4, methods: PM,
    dims: { base: 215.25, height: 143.5, slopeDeg: 53.13, heightToday: 136.4, platformCutDepth: 10 },
    notes: 'Slope ~53°08\' (Wikipedia) — steeper than Khufu\'s; stands on higher ground and was cut >10 m into the bedrock on one side (Lehner, read). Lowest casing of pink Aswan granite, the rest Tura limestone. At c. 2500 BCE the whole pyramid was cased: the surviving cap near the top is a post-medieval state (see casing-stripped).',
    disputes: ['Original height 143.5 m (Lehner) vs 143.9 / 148.5 m in other summaries; slope 53°08\' vs 53°10\'.'],
    sources: [S.wikiKhafre, S.harrell, S.lehnerHarbors],
  },
  {
    id: 'menkaure-pyramid', kind: 'type', name: 'Pyramid of Menkaure (G3): lower 16 courses Aswan granite, partly undressed; Tura limestone above', confidence: 'secondary',
    built: { from: -2532, to: null, approx: true }, materials: P4, methods: PM,
    dims: { base: [102.2, 104.6], height: 65, slopeDeg: 51.34, graniteCourses: 16, graniteHeight: 20 },
    notes: 'Slope 51°20\'25". The lowest sixteen courses (over 20 m) were red granite; above, fine limestone to the apex. Menkaure died before it was finished and much of the granite was never smoothed: render the granite band as rough, bossed blocks, with dressed patches (e.g. around the entrance). Possibly begun as a stepped core. Harrell (read) shows tumbled granite and granodiorite from its lower courses.',
    disputes: ['Base 102.2 × 104.6 m vs "103.4 m square"; whether the upper limestone casing was ever completed is not confirmed here.'],
    sources: [S.wikiMenkaure, S.harrell],
  },
  {
    id: 'khufu-queens-pyramids', kind: 'type', name: 'Khufu\'s queens\' pyramids G1a, G1b, G1c', confidence: 'secondary',
    built: { from: -2574, to: null, approx: true }, materials: P4, methods: PM,
    dims: { base: [45, 49], slopeDeg: 51.84, count: 3 },
    notes: 'In a north–south row east of the Great Pyramid; base about 45–49 m, angle about 51°50\'. G1a and G1b likely begun in years 15–17 of Khufu (Reisner, via Wikipedia).',
    sources: [S.wikiEastField],
  },
  {
    id: 'khufu-satellite-pyramid', kind: 'type', name: 'Khufu\'s cult (satellite) pyramid G1d, with a limestone pyramidion', confidence: 'unverified',
    built: { from: -2589, to: null, approx: true }, materials: ['giza-limestone', 'tura-limestone'],
    dims: { base: 21.75 },
    notes: 'Small pyramid at the SE corner of the Great Pyramid, found in 1991–92 with fragments of its limestone capstone — the oldest pyramidion known. It is the evidence against gilded 4th-Dynasty pyramidia: gold capping is attested on pyramidia only from the 5th Dynasty (see gilded-pyramidion) and on New Kingdom obelisks, not on Giza pyramids.',
    sources: [S.wikiKhufu],
  },
  {
    id: 'gilded-pyramidion', kind: 'type', name: 'A pyramidion cased in electrum or gold', confidence: 'read',
    built: { from: -2487, to: null, approx: true }, materials: ['tura-limestone'],
    notes: 'Attested from the 5th Dynasty on, not at Giza: Hawass reports an inscription he found at Abusir saying its pyramidion was cased with white gold (electrum), and an inscription from the pyramid of Queen Udjebten (6th Dynasty, found by Jéquier) suggesting gold. Dated here from Sahure\'s accession (Shaw). For a 4th-Dynasty Giza scene a gilded cap is a CONJECTURE: the only Giza pyramidion found (G1d) is plain limestone.',
    sources: [S.hawassTemples],
  },
  {
    id: 'khafre-satellite-pyramid', kind: 'type', name: 'Khafre\'s satellite pyramid (south side, on the axis)', confidence: 'secondary',
    built: { from: -2558, to: null, approx: true }, materials: P4,
    notes: 'Only remnants survive; two descending passages. Size not confirmed here.', sources: [S.wikiKhafre],
  },
  {
    id: 'menkaure-queens-pyramids', kind: 'type', name: 'Menkaure\'s three subsidiary pyramids G3a–c (south side)', confidence: 'read',
    built: { from: -2532, to: null, approx: true }, materials: P4, methods: PM,
    notes: 'Three small pyramids on an east–west line south of Menkaure\'s pyramid, each with a mudbrick temple on its east side (Hawass, read: those brick temples are later finishing — see menkaure-brick-completion). G3a the most elaborate. Dimensions not confirmed here.',
    sources: [S.hawassTemples, S.wikiMenkaure],
  },
  {
    id: 'khufu-mortuary-temple', kind: 'type', name: 'Khufu\'s pyramid (mortuary) temple: basalt-paved court, granite pillars', confidence: 'secondary',
    built: { from: -2589, to: null, approx: true }, materials: ['giza-limestone', 'basalt-widan', 'aswan-granite'], methods: ['gypsum-bedding'],
    dims: { plan: [52.2, 40] },
    notes: 'East face of the Great Pyramid. Basalt base/pavement (Hawass, read); open court paved in black basalt with sockets for the granite pillars of a surrounding colonnade, about 52.2 m N–S by 40 m E–W, a basalt threshold at the causeway end (search summary). Today only the basalt pavement survives.',
    sources: [S.hawassTemples, S.khufuTemple],
  },
  {
    id: 'khufu-causeway', kind: 'type', name: 'Khufu\'s causeway', confidence: 'read',
    built: { from: -2589, to: null, approx: true }, materials: ['giza-limestone', 'basalt-widan'],
    dims: { length: 810 },
    notes: 'About 810 m from the pyramid temple down to the valley temple, with a change of direction as it nears the escarpment (Hawass). Its basalt and limestone match the Zaghloul Street harbour wall (Lehner). Roofing and decoration not confirmed here.',
    sources: [S.hawassTemples, S.lehnerHarbors],
  },
  {
    id: 'khufu-valley-temple', kind: 'type', name: 'Khufu\'s valley temple (under modern Nazlet el-Samman)', confidence: 'read',
    built: { from: -2589, to: null, approx: true }, materials: ['giza-limestone', 'basalt-widan', 'mudbrick-ok'],
    dims: { pavementLength: 56, platformElevationAsl: 14.5, distanceFromPlateauEdge: 400 },
    notes: 'Known only from a black-green basalt pavement 56 m long at ~14 m asl and part of a mudbrick wall perhaps 8 m wide (Hawass); stood on the low desert ~400 m from the plateau edge, fronting a marina (Lehner). Plan unknown: do not invent one in detail.',
    sources: [S.hawassTemples, S.lehnerHarbors],
  },
  {
    id: 'khafre-mortuary-temple', kind: 'type', name: 'Khafre\'s mortuary temple (limestone, faced with granite)', confidence: 'read',
    built: { from: -2558, to: null, approx: true }, materials: ['giza-limestone', 'aswan-granite', 'travertine'], methods: ['granite-casing-over-core'],
    notes: 'The most complete Old Kingdom temple plan: entrance hall, pillared hall, two long narrow rooms, open court, five statue niches, magazines, sanctuary (Hawass). Court with 14 square pillars and ~52 life-size statues; travertine floor (popular page, unconfirmed). The Dream Stele\'s granite slab was a door lintel reused from this temple.',
    sources: [S.hawassTemples, S.wikiKhafre, S.wikiDream],
  },
  {
    id: 'khafre-causeway', kind: 'type', name: 'Khafre\'s causeway', confidence: 'read',
    built: { from: -2558, to: null, approx: true }, materials: ['giza-limestone'],
    dims: { length: 494.6 },
    notes: 'About 494.6 m long; Hawass: no evidence that it was roofed or decorated — render it open. It passes just south of the Sphinx enclosure.',
    sources: [S.hawassTemples, S.wikiKhafre],
  },
  {
    id: 'khafre-valley-temple', kind: 'type', name: 'Khafre\'s valley temple: granite-sheathed block, T-shaped hall of granite pillars, travertine floor', confidence: 'secondary',
    built: { from: -2558, to: null, approx: true }, materials: ['giza-limestone', 'aswan-granite', 'travertine'], methods: ['granite-casing-over-core'],
    dims: { plan: [45, 45], pillars: 16, pillarHeight: 4.15, doors: 2, statueSockets: 23 },
    notes: 'Megalithic limestone core blocks sheathed in polished red granite, battered outer walls, flat roof. Two doorways in the east façade (north and south) lead to a transverse vestibule, then west into a T-shaped hall with sixteen square monolithic granite pillars carrying granite architraves; travertine floor; sockets for 23 statues along the walls. Four colossal sphinxes, each >8.5 m long, may have stood at the doors (Hawass, read). Built together with the Sphinx Temple from blocks cut out of the Sphinx ditch (AERA, read).',
    disputes: ['Plan size: ~45 m square is the usual figure (Hölscher via popular accounts) — not confirmed; one summary gives 55 × 30 m.'],
    sources: [S.hawassTemples, S.aeraKhafre, S.wikiKhafre, S.khafreVT],
  },
  {
    id: 'great-sphinx', kind: 'type', name: 'Great Sphinx: lion with royal (nemes) head, carved from the bedrock (no beard)', confidence: 'secondary',
    built: { from: -2558, to: null, approx: true }, materials: ['giza-limestone'], methods: ['plateau-quarrying'],
    dims: { length: 73, height: 20, width: 19 },
    notes: 'Carved from a knoll left in a quarry: Member I (hard grey) at the base, soft Member II body, Member III head (AERA, read). Most scholars attribute it to Khafre: the Sphinx Temple and Khafre\'s valley temple were built together from blocks cut out of the Sphinx ditch, which the quarrymen never finished (AERA, read); a Khufu attribution is argued but tenuous. Wikipedia: evidence it was once painted. At c. 2500 BCE: no beard, no stele between the paws, no restoration casing; nose intact.',
    disputes: ['Khafre (most scholars, AERA) vs Khufu (minority); Wikipedia: "a consensus has not been reached".'],
    sources: [S.wikiSphinx, S.aeraWhoSphinx, S.aeraKhafre],
  },
  {
    id: 'sphinx-temple', kind: 'type', name: 'Sphinx Temple (Khafre, unfinished: no granite casing)', confidence: 'read',
    built: { from: -2558, to: null, approx: true }, materials: ['giza-limestone', 'aswan-granite'],
    notes: 'East of the Sphinx, beside Khafre\'s valley temple, with a court ringed by granite pillars and colossal statues; left incomplete "without its exterior granite casing", core blocks exposed at three corners (AERA). Render its outside as rough limestone core masonry.',
    sources: [S.aeraKhafre, S.aeraWhoSphinx],
  },
  {
    id: 'menkaure-mortuary-temple', kind: 'type', name: 'Menkaure\'s mortuary and valley temples, stone phase (limestone cores meant for granite sheathing)', confidence: 'read',
    built: { from: -2532, to: null, approx: true }, materials: ['giza-limestone', 'aswan-granite'], methods: ['granite-casing-over-core'],
    notes: 'Menkaure began both temples in massive limestone core blocks that were to be sheathed in granite; he died after only a couple of courses of the valley temple had been laid (AERA citing Reisner). For a scene in his reign: a building site of big core blocks, partial granite facing, debris fill, no brick.',
    sources: [S.aeraMVT, S.hawassTemples, S.wikiMenkaure],
  },
  {
    id: 'menkaure-causeway', kind: 'type', name: 'Menkaure\'s causeway', confidence: 'secondary',
    built: { from: -2532, to: null, approx: true }, materials: ['giza-limestone', 'mudbrick-ok'],
    dims: { length: 600 },
    notes: 'Over 600 m; like the temples, stone foundations under Menkaure and mudbrick finishing under Shepseskaf.', sources: [S.wikiMenkaure],
  },
  {
    id: 'menkaure-brick-completion', kind: 'type', name: 'Menkaure\'s temples completed in mudbrick by Shepseskaf — AFTER Menkaure', confidence: 'read',
    built: { from: -2503, to: null, approx: true }, materials: ['mudbrick-ok', 'limestone-debris', 'gypsum-mortar'], methods: ['mudbrick-walling'],
    notes: 'Shepseskaf (Shaw 2503–2498 BCE; Lehner 2472–2467; Hornung 2441–2436) finished the valley temple, mortuary temple, causeway and queens\' temples cheaply in (whitewashed) mudbrick over crushed-limestone fill. Exclude from a Menkaure-reign scene; at exactly −2500 on this scale it is in progress. The valley temple was flood-damaged and rebuilt as a "Second Temple" over 200 years later (probably Pepi II).',
    sources: [S.aeraMVT, S.hawassTemples, S.wikiMenkaure],
  },
  {
    id: 'khentkawes-town', kind: 'type', name: 'Khentkawes town (L-shaped, attached to Menkaure\'s valley temple) — Shepseskaf', confidence: 'read',
    built: { from: -2503, to: null, approx: true }, materials: ['mudbrick-ok', 'limestone-debris'], methods: ['mudbrick-walling'],
    notes: 'Built by Shepseskaf for the queen mother Khentkawes I, incorporating earlier mudbrick buildings of Menkaure\'s time on the basin\'s west bank (AERA). Not part of a Menkaure-reign scene; those earlier buildings are (see khentkawes-basin).',
    sources: [S.aeraKKTBasin],
  },
  {
    id: 'khufu-boat-pits', kind: 'type', name: 'boat pits round Khufu\'s pyramid, two sealed with dismantled ships', confidence: 'secondary',
    built: { from: -2566, to: null, approx: true }, materials: ['giza-limestone', 'tura-limestone', 'cedar'], methods: ['lashed-boatbuilding'],
    dims: { shipLength: 43.4, shipBeam: 5.9, shipDepth: 1.78, shipPieces: 1224 },
    notes: 'Rock-cut pits; the two on the south side held dismantled cedar ships under roofing slabs (Khufu ship found 1954). Boat-shaped pits also by the temple and queens\' pyramids. Count of pits (3 vs 5) varies between summaries. Sealed at Khufu\'s burial: from outside a scene shows only the slab-covered pits.',
    disputes: ['Number of Khufu boat pits: summaries give three or five.'],
    sources: [S.wikiShip, S.khufuTemple],
  },
  {
    id: 'mastaba-east-twin', kind: 'type', name: 'Eastern Cemetery (G 7000) twin (double) mastabas of Khufu\'s family', confidence: 'secondary',
    built: { from: -2572, to: null, approx: true }, materials: ['giza-limestone', 'tura-limestone', 'gypsum-mortar'], methods: ['rubble-mastaba', 'gypsum-bedding'],
    dims: { rows: 3, perRow: 4, twinsInNucleus: 8 },
    notes: 'East of the queens\' pyramids: twelve mastabas built as double mastabas in three rows of four (e.g. G 7110–7120 Kawab and Hetepheres II; G 7130–7140 Khufukhaf I), later merged into eight twin-mastabas; dated to about years 17–24 of Khufu (Reisner via Wikipedia). G 7510 of the vizier Ankhhaf (overseer of Ro-She-Khufu in Merer\'s papyri) stands out for size. Individual dimensions not confirmed here.',
    sources: [S.wikiEastField, S.tallet],
  },
  {
    id: 'mastaba-west-nucleus', kind: 'type', name: 'Western Cemetery nucleus mastabas (G 1200, G 2100, G 4000) in street grids', confidence: 'read',
    built: { from: -2589, to: null, approx: true }, materials: ['giza-limestone', 'limestone-debris', 'tura-limestone', 'gypsum-mortar'], methods: ['rubble-mastaba', 'gypsum-bedding'],
    dims: { hemiunuG4000: [53.2, 26.77], hemiunuG4000Original: [47, 21.45], length: [20, 25], width: [8, 11], batterDeg: [75, 80] },
    notes: 'Khufu-era cores laid out in north–south rows whose ends align into ordered streets and avenues, open at first and filled with later small tombs after Khufu (Manuelian, read). Rubble-filled, stepped retaining walls of small drab limestone; slab stela on the east face; some later cased in fine limestone with exterior chapels and monolithic false doors. G 2000 is the largest in the Western Field, matched only by Ankhhaf\'s G 7510. G 4000 (Hemiunu) 53.2 × 26.77 m as enlarged, 47 × 21.45 m at first (Junker, via a summary).',
    disputes: ['Typical core size (20–25 × 8–11 m) and batter (75–80°) are unverified estimates, not from a source read; only G 4000 is measured here.'],
    sources: [S.manuelian, S.junkerG4000],
  },
  {
    id: 'wall-of-the-crow', kind: 'type', name: 'Wall of the Crow (Heit el-Ghurab): stone wall with a tunnel-like gate', confidence: 'read',
    built: { from: -2558, to: null, approx: true }, materials: ['giza-limestone'],
    dims: { length: 200, height: 10, baseThickness: 10, gateWidth: 2.6, gateHeight: 7 },
    notes: 'Massive limestone wall at the mouth of the central wadi, north edge of the workers\' town; its gate (5 cubits wide) passes through 10 m of wall like a short tunnel. The town\'s Main Street led to it. Gallery Set I predates it; built in the 4th Dynasty (exact king not confirmed: Khafre placed here as the earliest likely).',
    disputes: ['Exact date within the 4th Dynasty unknown; postdates Gallery Set I.'],
    sources: [S.aeraWall, S.aeraLostCity],
  },
  {
    id: 'gallery-complex', kind: 'type', name: 'gallery barracks (Heit el-Ghurab): long narrow halls in blocks separated by streets', confidence: 'secondary',
    built: { from: -2558, to: -2498, approx: true }, materials: ['mudbrick-ok', 'giza-limestone', 'gypsum-mortar'], methods: ['mudbrick-walling'],
    dims: { length: 34.5, width: 5, blocks: 4 },
    notes: 'Four large blocks of long galleries (~34.5–35 m by ~5 m) separated by streets, interpreted as barracks for rotating crews, with bakeries and kitchens attached; perhaps barrel-vaulted (AERA, read). Sealings name Khafre and Menkaure, probably Khufu too; abandoned and robbed of brick and timber by the end of the 4th Dynasty. Gallery dims from a search summary.',
    sources: [S.aeraLostCity, S.galleries],
  },
  {
    id: 'royal-admin-building', kind: 'type', name: 'Royal Administrative Building with sunken court of round silos', confidence: 'read',
    built: { from: -2558, to: -2498, approx: true }, materials: ['giza-limestone', 'mudbrick-ok', 'aswan-granite'], methods: ['mudbrick-walling'],
    dims: { width: 45, lengthMin: 35, lengthEst: 100, siloDiameter: 2.62, silos: 10 },
    notes: 'Thick-walled enclosure (limestone, some granite) 45 m wide, >35 m N–S, perhaps 100 m long; sunken court of mudbrick silos each 5 cubits (2.62 m) across, at least seven exposed, ten in all; sealings of Khafre and Menkaure; demolished before the end of the 4th Dynasty.',
    sources: [S.aeraRAB, S.aeraLostCity],
  },
  {
    id: 'heg-house', kind: 'type', name: 'workers\'-town houses, bakeries and workshops', confidence: 'read',
    built: { from: -2558, to: -2498, approx: true }, materials: ['mudbrick-ok', 'giza-limestone'], methods: ['mudbrick-walling'],
    notes: 'Streets and alleys lined with craft workshops, industrial yards, bakeries, commissaries, kitchens, warehouses, small houses and larger houses/offices (e.g. House Unit 1: bedroom, reception hall, stores). Over 7 ha, ~400 m south of the Sphinx. House sizes not confirmed here.',
    sources: [S.aeraLostCity],
  },
  {
    id: 'khufu-marina', kind: 'type', name: 'Khufu\'s walled marina before his valley temple (reconstruction)', confidence: 'read',
    built: { from: -2589, to: null, approx: true }, materials: ['giza-limestone', 'basalt-widan'],
    dims: { enclosure: [400, 475], wallSegment: 70, floodplainAsl: 12, floodPeakAsl: [13.5, 14] },
    notes: 'Three segments of a limestone-and-basalt wall (Zaghloul Street) and the valley-temple pavement define an enclosure ~400 m N–S × 475 m E–W; Lehner reconstructs a marina for small craft, opened to a western Nile channel (~500 m wide, modelled). Dry at low water, brimming at flood. A model, not an excavated plan.',
    sources: [S.lehnerHarbors],
  },
  {
    id: 'central-canal-basin', kind: 'type', name: 'central canal basin, T-shaped at its west end before the Sphinx and Khafre\'s valley temple', confidence: 'read',
    built: { from: -2589, to: null, approx: true }, materials: ['limestone-debris'],
    dims: { bedrockTerraceAsl: 15.93 },
    notes: 'The main construction harbour, entering between two settlement mounds (Nazlet el-Sissi and Nazlet el-Batran East) and ending ~50–70 m east of the Sphinx Temple at a bedrock terrace; its crossbar ran north toward the Khufu and Khafre platforms. Khafre and Menkaure turned its west end into marinas fronting their valley temples. The Lost City sits on its southern spoil bank. Reconstruction from cores (Lehner).',
    sources: [S.lehnerHarbors],
  },
  {
    id: 'khentkawes-basin', kind: 'type', name: 'basin before the Menkaure valley temple / Khentkawes town (Menkaure\'s builders)', confidence: 'read',
    built: { from: -2532, to: null, approx: true }, materials: ['mudbrick-ok', 'limestone-debris'], methods: ['mudbrick-walling'],
    dims: { width: 26.6, depth: [3, 4], floodLevelAsl: 14 },
    notes: 'Menkaure\'s workers dug a spur off the extended waterway to deliver material; terraced with quarry debris, edges cased in mudbrick (sloping on the west, vertical on north and east), ramps at the corners; mudbrick buildings and a massive north wall framed it. Fills 2.5–3 m at flood, dry at low water. Repurposed for the Khentkawes cult under Shepseskaf.',
    sources: [S.aeraKKTBasin, S.lehnerHarbors],
  },

  // ── anachronisms: later than the 4th Dynasty ──
  {
    id: 'sphinx-beard', kind: 'type', name: 'the Sphinx\'s plaited divine beard — NOT Old Kingdom', confidence: 'secondary',
    built: { from: -1550, to: null, approx: true }, materials: ['giza-limestone'],
    notes: 'Fragments in the British Museum (EA 58) and Cairo; probably added in 18th-Dynasty restoration, of the plaited "divine" type, and fallen in antiquity. Never put a beard on a 4th-Dynasty Sphinx.',
    sources: [S.bmBeard, S.wikiSphinx],
  },
  {
    id: 'amenhotep-ii-sphinx-temple', kind: 'type', name: 'Amenhotep II\'s temple of Horemakhet NE of the Sphinx — NOT Old Kingdom', confidence: 'secondary',
    built: { from: -1427, to: null, approx: true }, materials: ['mudbrick-ok', 'giza-limestone'],
    notes: '18th Dynasty (1427–1401/1397 BCE), nearly 1,000 years after the Sphinx.', sources: [S.bmBeard],
  },
  {
    id: 'dream-stele', kind: 'type', name: 'Dream Stele of Thutmose IV between the paws — NOT Old Kingdom', confidence: 'secondary',
    built: { from: -1401, to: null, approx: true }, materials: ['aswan-granite'],
    dims: { height: 3.6 },
    notes: 'Year 1 of Thutmose IV (c. 1401 BCE); a reused granite door lintel from Khafre\'s mortuary temple; back wall of a small open-air chapel between the paws.',
    sources: [S.wikiDream, S.hawassSphinx],
  },
  {
    id: 'sphinx-nk-enclosure', kind: 'type', name: 'New Kingdom mudbrick walls round the Sphinx hollow, and resetting of fallen casing — NOT Old Kingdom', confidence: 'read',
    built: { from: -1401, to: null, approx: true }, materials: ['mudbrick-ok', 'giza-limestone'],
    notes: 'Thutmose IV cleared the sand, built protective mudbrick walls inscribed with his name and reset fallen casing stones (Hawass, AERA).',
    sources: [S.hawassSphinx, S.aeraKhafre],
  },
  {
    id: 'ramesside-sphinx-stelae', kind: 'type', name: 'stelae and restorations of Ramesses II / Khaemwaset at the Sphinx — NOT Old Kingdom', confidence: 'read',
    built: { from: -1279, to: null, approx: true }, materials: ['giza-limestone', 'aswan-granite'],
    notes: 'Ramesses II and his son Khaemwaset left stelae between the paws and probably reset fallen stones (Hawass, undated there; reign of Ramesses II 1279–1213 BCE).',
    sources: [S.hawassSphinx],
  },
  {
    id: 'saite-sphinx-repairs', kind: 'type', name: 'Saite (26th Dynasty) small restoration slabs on the Sphinx — NOT Old Kingdom', confidence: 'read',
    built: { from: -664, to: null, approx: true }, materials: ['giza-limestone'],
    notes: 'Smaller slabs on the south side of the upper body, tail and nemes.', sources: [S.hawassSphinx],
  },
  {
    id: 'roman-sphinx-restoration', kind: 'type', name: 'Roman stone cladding of the Sphinx\'s paws and sides, paved sanctuary — NOT Old Kingdom', confidence: 'read',
    built: { from: -30, to: null, approx: true }, materials: ['giza-limestone'],
    notes: 'Roman period (30 BCE – end of the 2nd century CE): protective stone layers on paws and flanks; the largest ancient restoration. The small-block masonry seen on the paws today is not 4th Dynasty.',
    sources: [S.hawassSphinx],
  },
];

// ── urban form ───────────────────────────────────────────────────────────────────────────────────────
const FORMS = [
  {
    id: 'plateau-above-floodplain', kind: 'form', name: 'the pyramid plateau standing ~45 m above a 4th Dynasty floodplain at ~12 m asl', confidence: 'secondary',
    attested: { from: -2589, to: null, approx: true },
    notes: 'Lehner (read): OK floodplain ~12 m asl, flood peak 13.5–14 m asl, low water ~7 m asl; Khufu\'s valley-temple platform 14.5 m asl; the Moqattam formation tilts 6° down NW→SE into the central wadi, the only practical haul route up; today\'s ground is 4–5 m above the OK floodplain. The plateau top at the Great Pyramid is ~60 m asl (standard figure, unconfirmed), so the step is ~45 m, not 40.',
    sources: [S.lehnerHarbors],
  },
  {
    id: 'giza-diagonal', kind: 'form', name: 'the three pyramids stepped NE→SW along a diagonal, each on the plateau\'s rising ground', confidence: 'unverified',
    attested: { from: -2532, to: null, approx: true },
    notes: 'Khufu NE, Khafre centre (on ground ~10 m higher), Menkaure SW; their SE corners roughly on one line (Lehner\'s "Giza diagonal"). Each faces cardinally. Not confirmed in a source read here.',
    sources: [S.lehnerDiag],
  },
  {
    id: 'pyramid-complex-axis', kind: 'form', name: 'complex sequence: pyramid → enclosure → mortuary temple (east) → causeway → valley temple → harbour basin', confidence: 'read',
    attested: { from: -2589, to: null, approx: true },
    notes: 'Upper temple against the pyramid\'s east face, causeway down the escarpment (Khufu ~810 m, bending; Khafre 494.6 m; Menkaure >600 m) to a valley temple on the low desert edge, fronting a dug basin or marina reached by canal from a Nile channel (Hawass; Lehner). Satellite pyramid on the south; queens\' pyramids east (Khufu) or south (Menkaure).',
    sources: [S.hawassTemples, S.lehnerHarbors],
  },
  {
    id: 'cemetery-street-grid', kind: 'form', name: 'mastaba cemeteries in planned rows with streets and avenues', confidence: 'read',
    attested: { from: -2589, to: null, approx: true },
    notes: 'West of Khufu\'s pyramid: nucleus cemeteries G 1200, G 2100, G 4000 of N–S rows whose ends align into streets (Manuelian); east of it: the G 7000 twin-mastaba grid of three rows of four (Wikipedia). Streets were open in Khufu\'s and Khafre\'s day; small later tombs choked them afterwards. For c. 2515 BCE: the grid largely open, some cores uncased or unfinished.',
    sources: [S.manuelian, S.wikiEastField],
  },
  {
    id: 'workers-town-south', kind: 'form', name: 'workers\' town and port south of the Wall of the Crow, on the canal basin\'s spoil bank', confidence: 'read',
    attested: { from: -2558, to: -2498, approx: true },
    notes: 'Heit el-Ghurab: >7 ha, ~400 m south of the Sphinx, galleries in four blocks with streets, Main Street to the gate in the Wall of the Crow, RAB, houses; a put-in bay ("Lagoon 1") on its south for commodity boats (Lehner). A port as well as a workers\' town.',
    sources: [S.aeraLostCity, S.lehnerHarbors, S.aeraWall],
  },
  {
    id: 'casing-stripped', kind: 'form', name: 'pyramids stripped to their stepped cores (Khafre keeps a cap of casing) — NOT ancient', confidence: 'secondary',
    attested: { from: 1303, to: null, approx: true },
    notes: 'The earthquake of 8 August 1303 CE loosened the Great Pyramid\'s casing; Mamluk builders hauled it to Cairo (e.g. Sultan Hasan, 1356 CE); Muhammad Ali took more in the 19th century. Any 2500 BCE scene shows all three pyramids fully cased and smooth.',
    disputes: ['Some stripping (especially of Menkaure\'s pyramid) is earlier medieval; 1303 CE is the date for the bulk of Khufu\'s casing.'],
    sources: [S.quake1303, S.wikiKhufu],
  },
];

export const GIZA_RECORD = [...MATERIALS, ...METHODS, ...TYPES, ...FORMS];
export const GIZA_SOURCES = S;
