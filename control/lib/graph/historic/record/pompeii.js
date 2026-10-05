/**
 * The record for Pompeii, read on a summer morning of 79 CE, before the eruption. The scene is the town's
 * western half (the forum, the old town, the theatres, the Stabian Baths, Via dell'Abbondanza to Via Stabiana,
 * the Porta Marina climb); the rest is recorded where it bears on that half. Format and checks: ../record.js.
 *
 * `confidence`: 'read' = a page stating the fact was fetched and read (through a model summary of the page, so
 * numbers were read back, not seen in the original); 'secondary' = known through a page that names the source;
 * 'unverified' = a search snippet or the standard account only. The academic papers that would settle several
 * gaps (MDPI, ScienceDirect, Tandfonline, Springer) could not be fetched; Pleiades was blocked. Two aggregators
 * (madainproject.com, pompeionline.net) read as compiled text; their entries say so where they disagree.
 * The design language these feed: docs/historic/pompeii/README.md and ../style/pompeii.js.
 *
 * Settled by the record, read by the layout:
 *  - The town is mid-repair. Seventeen years after the earthquake of 62 (or 63), the Capitolium awaits
 *    restoration, the Macellum's portico is unbuilt, the Temples of Venus and Apollo are unfinished, the
 *    Eumachia building is under restoration, the Central Baths are a building site, and the forum's travertine
 *    colonnade is incomplete. Each type carries its `state` at 79 CE; a scene draws the unfinished as unfinished.
 *  - Only the Temple of Isis was wholly rebuilt; the Forum Baths were the baths still working.
 *  - Marble is a veneer on a few public and elite buildings, much of it stripped or unfinished in 79. The town
 *    is tufa, limestone, concrete and painted stucco, not marble.
 *  - Vesuvius is one broad mountain, its summit flat (Strabo) and its slopes in vines (the Centenary fresco).
 *  - The Doric Temple is an old relic in the Triangular Forum, not a working temple (unverified).
 *
 * Anachronisms the generator must not use for 79 CE, each held with its real date: the eruption itself and
 * the Gran Cono it began (both late 79: a year-resolution record cannot split the morning from the afternoon,
 * so they are held from 80 and a 79 read excludes them); the coast at its modern line; the roofless ruins,
 * the 1943 bomb damage and the post-war rebuilds.
 */

// ── sources ──────────────────────────────────────────────────────────────────────────────────────────
const W = (title, via = 'read') => ({ author: 'Wikipedia', title, year: 2026, url: `https://en.wikipedia.org/wiki/${title.replace(/ /g, '_')}`, via });
const WI = (title, via = 'read') => ({ author: 'Wikipedia (it)', title, year: 2026, url: `https://it.wikipedia.org/wiki/${title.replace(/ /g, '_')}`, via });
const PIP = (title, path) => ({ author: 'Pompeii in Pictures', title, year: 2026, url: `https://pompeiiinpictures.com/pompeiiinpictures/${path}`, via: 'read' });
const S = {
  pompeii: W('Pompeii'),
  jupiter: W('Temple of Jupiter (Pompeii)'),
  apollo: W('Temple of Apollo (Pompeii)'),
  stabian: W('Stabian Baths'),
  isis: W('Temple of Isis (Pompeii)'),
  faun: W('House of the Faun'),
  mysteries: W('Villa of the Mysteries'),
  styles: W('Pompeian Styles'),
  eruption: W('Eruption of Mount Vesuvius in 79 AD'),
  vesuvius: W('Mount Vesuvius'),
  quake: W('62 Pompeii earthquake'),
  macellum: W('Macellum of Pompeii'),
  theatres: W('Theatre Area of Pompeii'),
  centenary: W('House of the Centenary'),
  domus: W('Domus'),
  africanum: W('Opus africanum'),
  concrete: W('Roman concrete'),
  signinum: W('Opus signinum'),
  itBasilica: WI('Basilica (Pompei)'),
  itForum: WI('Foro di Pompei'),
  itTeatroGrande: WI('Teatro Grande (Pompei)'),
  itOdeon: WI('Teatro Piccolo (Pompei)'),
  itTriangular: WI('Foro Triangolare'),
  itEumachia: WI('Edificio di Eumachia'),
  itVenus: WI('Tempio di Venere (Pompei)'),
  itForumBaths: WI('Terme del Foro (Pompei)'),
  parcoForum: { author: 'Parco Archeologico di Pompei', title: 'Civil Forum', year: 2026, url: 'https://pompeiisites.org/en/excavations-plan-en/civil-forum/', via: 'read' },
  pipGates: PIP('Plan of the gates', 'Plans/plan%20gates.htm'),
  pipMarina: PIP('Porta Marina', 'Gates/Gate%20Marine.htm'),
  pipCastellum: PIP('Castellum aquae', 'Fountains/fountain%2061500.htm'),
  pipFountains: PIP('Plan of the fountains', 'Plans/Plan%20Fountains.htm'),
  pipCentral: PIP('Central Baths IX.4.18', 'R9/9%2004%2018.htm'),
  pipDoric: PIP('Doric Temple VIII.7.31 (citing Dobbins & Foss 2008)', 'R8/8%2007%2031%20p2.htm'),
  pipBasilica: PIP('Forum VIII.1.1', 'R8/8%2001%2001%20p1.htm'),
  pipArchNE: PIP('Forum arch, north-east', 'Arches/Arch%20Forum%20NE.htm'),
  dobbinsColonnade: { author: 'J. J. Dobbins (Pompeii Forum Project, citing Maiuri and Fiorelli)', title: 'The date of the forum colonnades', year: 2026, url: 'http://pompeii.iath.virginia.edu/forcol-date/text.html', via: 'read; secondary to Maiuri' },
  dobbinsStreets: { author: 'J. J. Dobbins (Pompeii Perspectives)', title: 'Via dell\'Abbondanza at Via Stabiana', year: 2026, url: 'https://pompeiiperspectives.org/index.php/prof-john-j-dobbins/page-2', via: 'read' },
  romanports: { author: 'Roman Ports', title: 'The port of Pompeii', year: 2026, url: 'https://romanports.org/en/articles/ports-in-focus/625-the-port-of-pompeii.html', via: 'read; secondary to the works it cites' },
  masic2025: { author: 'Masic et al. (Nature Communications), via Archaeology Magazine', title: 'Roman concrete ingredients at Pompeii analyzed (doi:10.1038/s41467-025-66634-7)', year: 2025, url: 'https://archaeology.org/news/2025/12/11/roman-concrete-ingredients-at-pompeii-analyzed/', via: 'read (the news report, not the paper)' },
  euronews2018: { author: 'euronews', title: 'Charcoal inscription points to date change for Pompeii eruption', year: 2018, url: 'https://www.euronews.com/2018/10/16/charcoal-inscription-points-to-date-change-for-pompeii-eruption', via: 'read' },
  madainWalls: { author: 'Madain Project', title: 'Fortifications of ancient Pompeii', year: 2026, url: 'https://madainproject.com/fortifications_of_ancient_pompeii', via: 'read; compiled text, lower trust' },
  madainErcolano: { author: 'Madain Project', title: 'Porta Ercolano', year: 2026, url: 'https://madainproject.com/porta_ercolano', via: 'read; compiled text, lower trust' },
  madainTombs: { author: 'Madain Project', title: 'Necropolis of Porta Ercolano', year: 2026, url: 'https://madainproject.com/necropolis_of_porta_ercolano', via: 'read; compiled text, lower trust' },
  pompeionlineTech: { author: 'pompeionline.net', title: 'Construction techniques in Pompeii', year: 2026, url: 'https://pompeionline.net', via: 'read; compiled text, lower trust' },
  pompeionlineQuad: { author: 'pompeionline.net', title: 'Quadriporticus of the theatres VIII.7.16', year: 2026, url: 'https://pompeionline.net', via: 'read; compiled text, lower trust' },
  snippets: { author: 'various', title: 'search snippets (Museo Galileo, museum.wa.gov.au, pompeiiinpictures pages not fetched, popular guides)', year: 2026, via: 'search snippets only' },
  mdpiCoast: { author: 'MDPI Land 13(8):1198', title: 'the ancient coastline and the Sarno plain near Pompeii', year: 2024, via: 'search snippet only; the paper returned 403' },
  heritageQuakes: { author: 'Heritage 9(7):281', title: 'repeated tremors and repairs at Pompeii between 62 and 79 (doi:10.3390/heritage9070281)', year: 2026, via: 'title only; the paper returned 403' },
};

/** The year a Pompeii scene is read at, and the dates around it (BCE negative). */
export const POMPEII_READ_AT = 79;
export const POMPEII_DATES = { sullanColony: -80, aqueduct: -35, earthquake: 62, eruption: 79 };
/** What a building is at the read year: standing; repaired (done by 79); damaged (awaiting work); under repair; unfinished (new work, not done); relic (old, out of use). */
export const POMPEII_STATES = ['standing', 'repaired', 'damaged', 'under-repair', 'unfinished', 'relic'];

// ── materials ────────────────────────────────────────────────────────────────────────────────────────
const MATERIALS = [
  {
    id: 'pappamonte-tuff', kind: 'material', name: 'pappamonte, a black granular volcanic tuff', confidence: 'unverified',
    attested: { from: -550, to: -425, approx: true, where: ['the first city walls'] },
    supply: 'local volcanic deposits', role: ['wall'], colour: ['#4f4a44'],
    notes: 'The first walls, c. 550–425 BCE (snippet). Old fabric survives inside later walls; no longer quarried for building by the read year.',
    sources: [S.snippets, S.pompeionlineTech],
  },
  {
    id: 'sarno-limestone', kind: 'material', name: 'Sarno limestone (calcare del Sarno), a porous pale calcareous tufa', confidence: 'read',
    attested: { from: -550, to: null, approx: true, where: ['the Doric Temple', 'the walls in opus quadratum', 'the Samnite house façades'] },
    supply: 'the travertine beds of the Sarno plain', role: ['wall', 'structure'], colour: ['#c9b68c'],
    notes: 'Wall blocks of the 4th–3rd c. BCE in opus quadratum (read, aggregator). The Doric Temple of the mid-6th c. BCE is of Sarno limestone (snippet). Colour estimated.',
    disputes: ['One revision dates Sarno-limestone construction to the 2nd c. BCE rather than the 4th (snippet).'],
    sources: [S.madainWalls, S.snippets],
  },
  {
    id: 'nocera-tuff', kind: 'material', name: 'grey tuff from Nocera', confidence: 'read',
    attested: { from: -200, to: null, approx: true, where: ['the Quadriporticus (74 Doric columns)', 'the Temple of Apollo colonnade', 'the Triangular Forum propylon', 'the forum colonnade of Vibius Popidius'] },
    supply: 'quarries round Nuceria', role: ['structure', 'wall', 'ornament'], colour: ['#8d887c'],
    notes: 'Columns, capitals and fine façades. In 79 the Apollo enclosure\'s tuff columns were being replaced with stucco columns with Corinthian capitals.',
    disputes: ['Introduced c. 100 BCE (snippet) against the standard "tufa period" of the 2nd c. BCE, which the 2nd-century tuff propylon of the Triangular Forum supports.'],
    sources: [S.apollo, S.itTriangular, S.pompeionlineQuad, S.pipBasilica],
  },
  {
    id: 'lava-stone', kind: 'material', name: 'Vesuvian lava (basalt): street paving, kerbs, mills', confidence: 'unverified',
    attested: { from: -200, to: null, approx: true, where: ['the streets', 'the bakeries\' mills', 'the Stabian Baths\' changing-room floor border'] },
    supply: 'the lava flows of Vesuvius', role: ['paving', 'structure'], colour: ['#4b4a47'],
    notes: 'Mills of porous lava: a conical meta under an hourglass catillus (snippet). Lava street paving is the standard account; the date the streets were paved was not found. The Stabian apodyterium floor is grey marble bordered by basalt (read).',
    sources: [S.snippets, S.stabian],
  },
  {
    id: 'lime-concrete', kind: 'material', name: 'lime mortar and concrete with pozzolana', confidence: 'read',
    attested: { from: -150, to: null, approx: true, where: ['the cores of every incertum, reticulatum and brick-faced wall', 'the baths\' vaults'] },
    supply: 'lime burnt from limestone; pozzolana from Puteoli, brownish yellow-grey', role: ['mortar', 'structure', 'wall'], colour: ['#b8ab92'],
    notes: 'Widespread from c. 150 BCE. A building site under work in 79 (a bakery and house in Regio IX) shows hot mixing: quicklime dry-mixed with pozzolana, then water (method hot-mixing).',
    sources: [S.concrete, S.masic2025],
  },
  {
    id: 'cocciopesto', kind: 'material', name: 'cocciopesto (opus signinum): lime with crushed pottery', confidence: 'read',
    attested: { from: -100, to: null, approx: true, where: [] },
    supply: 'crushed tile and pottery in lime', role: ['waterproofing', 'paving', 'finish'], colour: ['#b9806a'],
    notes: 'For baths, cisterns, floors and impluvia; spread in Italy from the 1st c. BCE. The page read makes no Pompeii-specific statement.',
    sources: [S.signinum],
  },
  {
    id: 'fired-brick', kind: 'material', name: 'fired brick (later as tile-brick facing)', confidence: 'read',
    attested: { from: -125, to: null, approx: true, where: ['corners, door jambs, pillars and arches', 'the Eumachia façade', 'the repairs after 62'] },
    supply: 'kilns in Campania', role: ['wall', 'structure'], colour: ['#a5553a'],
    notes: 'Limited use from the late 2nd to early 1st c. BCE; increasingly common in the 1st c. CE, especially in the repairs after the earthquake (read, aggregator).',
    sources: [S.pompeionlineTech, S.itEumachia],
  },
  {
    id: 'roof-tile', kind: 'material', name: 'terracotta roof tiles: flat flanged tegulae and half-round imbrices', confidence: 'unverified',
    attested: { from: -300, to: null, approx: true, where: [] },
    supply: 'kilns', role: ['roof'], colour: ['#b4623c'],
    notes: 'The standard Roman roof. No page read gives Pompeian tile sizes or roof pitches; the kit\'s are design numbers (../style/pompeii.js).',
    sources: [S.snippets],
  },
  {
    id: 'tegula-mammata', kind: 'material', name: 'tegulae mammatae: studded tiles that stand a hollow wall off for heating', confidence: 'read',
    attested: { from: -80, to: null, approx: true, where: ['the Forum Baths'] },
    supply: 'kilns', role: ['wall'], colour: ['#a5553a'],
    sources: [S.itForumBaths],
  },
  {
    id: 'painted-plaster', kind: 'material', name: 'lime stucco and painted wall plaster', confidence: 'read',
    attested: { from: -200, to: null, approx: true, where: ['houses, shops, public buildings, tombs'] },
    supply: 'lime, marble dust, mineral pigments', role: ['finish'], colour: ['#ebe3d1', '#9b2f22', '#c79a42', '#2e2b29'],
    notes: 'The Four Styles are recorded as methods. The kit\'s dark socle under a lighter field follows the Third Style\'s plain fields of black, red and yellow; no page read states a red-or-black socle convention as such (the kit\'s reading).',
    sources: [S.styles],
  },
  {
    id: 'marble-veneer', kind: 'material', name: 'marble: veneer, door frames, paving, statue bases', confidence: 'read',
    attested: { from: -27, to: null, approx: true, where: ['the Comitium floor (Augustan)', 'the Odeon orchestra (Augustan)', 'the Eumachia door frame and inner colonnade', 'the Temple of Venus (stripped after 62)'] },
    supply: 'imported', role: ['finish', 'paving', 'ornament'], colour: ['#ece9e2'],
    notes: 'A veneer for a few public and elite buildings, much of it in flux in 79: the Venus marble pillaged after 62, the Central Baths\' pools not yet clad.',
    sources: [S.parcoForum, S.itOdeon, S.itEumachia, S.itVenus, S.pipCentral],
  },
  {
    id: 'travertine', kind: 'material', name: 'travertine slabs and columns', confidence: 'read',
    attested: { from: -27, to: null, approx: true, where: ['the forum paving (Augustan)', 'the forum colonnade\'s replacement (from Tiberius)'] },
    supply: 'quarried', role: ['paving', 'structure'], colour: ['#d8cdb4'],
    notes: 'Replacing the forum\'s tuff paving and colonnade; neither was finished in 79.',
    sources: [S.itForum, S.dobbinsColonnade],
  },
  {
    id: 'window-glass', kind: 'material', name: 'window glass in bronze frames', confidence: 'unverified',
    attested: { from: -80, to: null, approx: true, where: ['the Forum Baths\' tepidarium'] },
    supply: 'cast glass', role: ['finish'],
    notes: 'Fiorelli records a tepidarium window of four panes in a bronze frame; one found in 1824 measured about 0.76 × 0.91 m (snippet; the page fetched did not contain it). The baths only: houses keep shutters.',
    sources: [S.snippets],
  },
  {
    id: 'lead-pipe', kind: 'material', name: 'lead water pipes', confidence: 'unverified',
    attested: { from: -35, to: null, approx: true, where: ['under the pavements, from the castellum'] },
    supply: 'imported lead', role: ['drainage'],
    notes: 'Three main lines from the castellum aquae (snippet).',
    sources: [S.snippets],
  },
  {
    id: 'timber', kind: 'material', name: 'timber: roofs, floors, poles, doors', confidence: 'read',
    attested: { from: -550, to: null, approx: true, where: ['the Macellum\'s roof on twelve poles', 'the Odeon\'s roof', 'Porta Ercolano\'s doors'] },
    supply: 'the Apennines and the slopes of Vesuvius', role: ['roof', 'structure'],
    sources: [S.macellum, S.theatres, S.madainErcolano],
  },
];

// ── methods ──────────────────────────────────────────────────────────────────────────────────────────
const METHODS = [
  { id: 'opus-quadratum', kind: 'method', name: 'opus quadratum: squared blocks in courses', confidence: 'read', attested: { from: -400, to: null, approx: true }, materials: ['sarno-limestone'], notes: 'The walls of the 4th–3rd c. BCE (aggregator).', sources: [S.madainWalls] },
  { id: 'opus-africanum', kind: 'method', name: 'opus africanum: upright and laid blocks framing rubble', confidence: 'read', attested: { from: -400, to: -200, approx: true }, materials: ['sarno-limestone'], notes: 'Side and inner walls of Samnite houses, with ashlar on the façades.', sources: [S.africanum] },
  { id: 'opus-incertum', kind: 'method', name: 'opus incertum: irregular stones faced on a concrete core', confidence: 'read', attested: { from: -150, to: null, approx: true }, materials: ['lime-concrete'], notes: 'Republican to 79. The Large Theatre, Porta Ercolano, tomb cores.', sources: [S.pompeionlineTech, S.itTeatroGrande] },
  { id: 'opus-reticulatum', kind: 'method', name: 'opus reticulatum: a net of square-faced stones on a concrete core', confidence: 'read', attested: { from: -80, to: null, approx: true }, materials: ['lime-concrete'], notes: 'Quasi-reticulatum first, in the 1st c. BCE. The Forum Baths, the castellum aquae.', sources: [S.pompeionlineTech, S.itForumBaths, S.pipCastellum] },
  { id: 'opus-latericium', kind: 'method', name: 'brick facing', confidence: 'read', attested: { from: -125, to: null, approx: true }, materials: ['fired-brick', 'lime-concrete'], notes: 'Corners, jambs, pillars and arches; most visible in the repairs after 62.', sources: [S.pompeionlineTech] },
  { id: 'opus-vittatum', kind: 'method', name: 'opus vittatum mixtum: bands of brick and small blocks', confidence: 'unverified', attested: { from: 1, to: null, approx: true }, materials: ['fired-brick', 'nocera-tuff', 'lime-concrete'], notes: 'Seen in later repairs to Porta Ercolano (aggregator); the date is not stated.', sources: [S.madainErcolano] },
  { id: 'first-style', kind: 'method', name: 'First Style (incrustation): stucco moulded and painted as marble blocks', confidence: 'read', attested: { from: -200, to: -80, approx: true }, materials: ['painted-plaster'], notes: 'Still on many walls in 79 (the House of the Faun, the Basilica).', sources: [S.styles, S.itBasilica] },
  { id: 'second-style', kind: 'method', name: 'Second Style (architectural)', confidence: 'read', attested: { from: -80, to: -20, approx: true }, materials: ['painted-plaster'], notes: 'The Villa of the Mysteries frieze, c. 70–60 BCE.', sources: [S.styles, S.mysteries] },
  { id: 'third-style', kind: 'method', name: 'Third Style (ornamental): large plain fields of black, red and yellow', confidence: 'read', attested: { from: -20, to: 60, approx: true }, materials: ['painted-plaster'], sources: [S.styles] },
  { id: 'fourth-style', kind: 'method', name: 'Fourth Style (intricate): busy, textile-like, narrative panels revived', confidence: 'read', attested: { from: 60, to: null, approx: true }, materials: ['painted-plaster'], notes: 'The new decoration of the read year, in the rooms repainted after the earthquake.', sources: [S.styles] },
  { id: 'tile-roof', kind: 'method', name: 'pitched timber roof under tegulae and imbrices', confidence: 'unverified', attested: { from: -300, to: null, approx: true }, materials: ['roof-tile', 'timber'], notes: 'The Basilica\'s roof was probably double-pitched (read); the Odeon\'s four-pitched (read). No page read gives a pitch.', sources: [S.itBasilica, S.itOdeon, S.snippets] },
  { id: 'compluviate-atrium', kind: 'method', name: 'atrium roof sloping inward to the compluvium over the impluvium', confidence: 'read', attested: { from: -200, to: null, approx: true }, materials: ['roof-tile', 'timber'], sources: [S.domus] },
  { id: 'vault-and-dome', kind: 'method', name: 'concrete barrel vaults and domes', confidence: 'read', attested: { from: -125, to: null, approx: true }, materials: ['lime-concrete'], notes: 'The Stabian Baths: a round frigidarium under a dome with an oculus; tepidarium and caldarium barrel-vaulted.', sources: [S.stabian] },
  { id: 'hypocaust', kind: 'method', name: 'hypocaust: raised floors and hollow walls heated from a furnace', confidence: 'read', attested: { from: -125, to: null, approx: true }, materials: ['fired-brick'], notes: 'The Stabian Baths\' is the earliest surviving; the Forum Baths add tegulae mammatae.', sources: [S.stabian, S.itForumBaths] },
  { id: 'hot-mixing', kind: 'method', name: 'hot-mixed concrete: quicklime dry-mixed with pozzolana', confidence: 'read', attested: { from: 79, to: null, approx: true }, materials: ['lime-concrete'], notes: 'Seen at a building site under work in 79 (Regio IX); dated here by that site, not by its first use.', sources: [S.masic2025] },
  { id: 'kerbed-street', kind: 'method', name: 'lava-paved street between raised pavements, with stepping stones', confidence: 'unverified', attested: { from: -200, to: null, approx: true }, materials: ['lava-stone'], notes: 'Standard account. Via dell\'Abbondanza stands about 0.4 m above Via Stabiana at their crossing, so carts could not turn west (read, Dobbins).', sources: [S.snippets, S.dobbinsStreets] },
  { id: 'aqueduct-supply', kind: 'method', name: 'aqueduct water: castellum, water towers, street fountains', confidence: 'read', attested: { from: -35, to: null, approx: true }, materials: ['lead-pipe'], notes: 'The Augustan Serino aqueduct\'s branch to the castellum at Porta Vesuvio, split three ways (read). Three networks, baths, houses and fountains (snippet).', sources: [S.pipCastellum, S.snippets] },
];

// ── building types ───────────────────────────────────────────────────────────────────────────────────
const TYPES = [
  // the walls and gates
  { id: 'walls-pappamonte', kind: 'type', name: 'the first city walls', confidence: 'unverified', built: { from: -550, to: -425, approx: true }, materials: ['pappamonte-tuff'], state: 'relic', notes: 'Survives only inside later work.', sources: [S.snippets] },
  { id: 'walls-quadratum', kind: 'type', name: 'the city walls in squared limestone', confidence: 'read', built: { from: -400, to: null, approx: true }, materials: ['sarno-limestone'], methods: ['opus-quadratum'], state: 'relic', dims: { length: 3200, thick: [2, 3] }, notes: 'About 3.2 km round, 2–3 m thick. By the 1st c. CE more relic than defence (aggregator).', sources: [S.madainWalls] },
  { id: 'wall-towers', kind: 'type', name: 'the wall towers', confidence: 'unverified', built: { from: -100, to: null, approx: true }, materials: ['nocera-tuff', 'lime-concrete'], methods: ['opus-incertum'], state: 'relic', disputes: ['Twelve towers, numbered I–XII (snippet; the conventional count) against "about 30" (aggregator).'], sources: [S.snippets, S.madainWalls] },
  { id: 'porta-marina', kind: 'type', name: 'Porta Marina: two vaulted passages up a steep ramp', confidence: 'read', built: { from: -100, to: null, approx: true }, materials: ['nocera-tuff', 'lime-concrete'], state: 'standing', dims: { passages: [2.5, 4.5] }, notes: 'A narrow passage for walkers on the north, a wide one for animals and goods on the south (read). Widths about 2.5 and 4.5 m (snippet). Build date not found in the pages read; held at c. 100 BCE for ordering only.', sources: [S.pipMarina, S.snippets] },
  { id: 'porta-ercolano', kind: 'type', name: 'Porta Ercolano: a triple barrel-vaulted gate', confidence: 'read', built: { from: -80, to: null, approx: true }, materials: ['lime-concrete'], methods: ['opus-incertum'], state: 'standing', notes: 'A carriageway between two footways, in opus incertum; later repairs in reticulatum and vittatum (aggregator). Build date not in the pages read; held at the Sullan colony for ordering only. Timber doors.', sources: [S.madainErcolano, S.pipGates] },
  // the forum
  { id: 'forum-square', kind: 'type', name: 'the forum: a long paved square, north–south', confidence: 'read', built: { from: -200, to: null, approx: true }, materials: ['nocera-tuff'], state: 'under-repair', dims: { w: 38, d: 143 }, notes: '143 × 38 m. Tuff paving replaced in travertine under Augustus; the repaving of the whole square could not be completed (snippet). Statues not re-erected after 62 (read).', sources: [S.itForum, S.snippets] },
  { id: 'forum-portico-tuff', kind: 'type', name: 'the forum colonnade of Vibius Popidius: two storeys, Doric under Ionic, in tuff', confidence: 'read', built: { from: -90, to: null, approx: true }, materials: ['nocera-tuff'], state: 'standing', notes: 'After Sulla per the Italian page; early 1st c. BCE per Pompeii in Pictures.', sources: [S.itForum, S.pipBasilica] },
  { id: 'forum-portico-travertine', kind: 'type', name: 'the forum colonnade\'s replacement in travertine', confidence: 'secondary', built: { from: 14, to: null, approx: true }, materials: ['travertine'], state: 'unfinished', notes: 'Begun under Tiberius, interrupted in 62, resumed, and "in large part incomplete" in 79 (Maiuri, via Dobbins).', sources: [S.dobbinsColonnade, S.itForum] },
  { id: 'capitolium', kind: 'type', name: 'the Temple of Jupiter (Capitolium) on its podium at the forum\'s north end', confidence: 'read', built: { from: -150, to: null, approx: true }, materials: ['nocera-tuff', 'lime-concrete'], state: 'damaged', dims: { d: 37, w: 17, podium: 3 }, notes: '121 × 56 × 10 ft (about 37 × 17 × 3 m; the page\'s figure, treat with caution). Much destroyed in 62 and still awaiting restoration in 79; its damage is carved on the Caecilius Iucundus relief.', sources: [S.jupiter, S.quake] },
  { id: 'forum-arches', kind: 'type', name: 'the honorary arches beside the Capitolium', confidence: 'read', built: { from: 20, to: null, approx: true }, materials: ['nocera-tuff', 'marble-veneer'], state: 'standing', notes: 'The north-east arch: a tuff core faced in marble, two fountains on its north side, probably an equestrian statue on top; its inscription names Nero Julius Caesar (6–31 CE). An arch west of the temple (Germanicus\'s) and one to the east (demolished) (snippet). Dated c. 20–22 CE (snippet).', sources: [S.pipArchNE, S.snippets] },
  { id: 'basilica', kind: 'type', name: 'the Basilica', confidence: 'read', built: { from: -130, to: null, approx: true }, materials: ['nocera-tuff', 'painted-plaster', 'timber', 'roof-tile'], methods: ['first-style'], state: 'standing', dims: { w: 24, d: 55, facadeColumn: 11, columns: 28 }, notes: '55 × 24 m; 28 columns round the nave; four Ionic façade columns about 11 m tall; stucco moulded as marble blocks; probably a double-pitched roof. Damage in 62 not stated.', sources: [S.itBasilica] },
  { id: 'temple-apollo', kind: 'type', name: 'the Temple of Apollo in its colonnaded court', confidence: 'read', built: { from: -120, to: null, approx: true }, materials: ['nocera-tuff', 'painted-plaster'], state: 'under-repair', notes: '48 Ionic columns (as the page states). A large part collapsed in 62; the repairs were left incomplete; its tuff columns were being replaced with stucco columns with Corinthian capitals.', sources: [S.apollo] },
  { id: 'temple-venus', kind: 'type', name: 'the Temple of Venus above Porta Marina', confidence: 'read', built: { from: -80, to: null, approx: true }, materials: ['lime-concrete'], state: 'unfinished', dims: { w: 15, d: 29 }, notes: 'Podium about 29 × 15 m; once all decorated in marble, pillaged after 62; a small votive shrine stood in the meantime; unfinished in 79. Build date held at the Sullan colony (Venus was its patron), not stated in the page read.', sources: [S.itVenus] },
  { id: 'macellum', kind: 'type', name: 'the Macellum: market court with a twelve-sided central building', confidence: 'read', built: { from: -130, to: null, approx: true }, materials: ['nocera-tuff', 'timber'], state: 'damaged', notes: 'Twelve bases held the poles of a timber roof over the central structure (fish). Very likely destroyed in 62 and not yet rebuilt; the portico\'s columns not yet erected.', sources: [S.macellum] },
  { id: 'eumachia', kind: 'type', name: 'the Building of Eumachia', confidence: 'read', built: { from: 1, to: null, approx: true }, materials: ['fired-brick', 'marble-veneer'], methods: ['opus-latericium'], state: 'under-repair', notes: 'Brick façade, a carved marble acanthus door frame, a marble inner colonnade. Badly damaged in 62 and under restoration in 79.', disputes: ['Built c. 7 BCE, before 2 CE, or c. 22 CE.'], sources: [S.itEumachia] },
  { id: 'comitium', kind: 'type', name: 'the Comitium, an open voting hall at the forum\'s south-east corner', confidence: 'read', built: { from: -27, to: null, approx: true }, materials: ['marble-veneer'], state: 'standing', notes: 'Floored in white marble slabs (Augustan). Five entrances north and five east (snippet).', disputes: ['Augustan (the floor) against 2nd c. BCE (snippet).'], sources: [S.parcoForum, S.snippets] },
  { id: 'municipal-offices', kind: 'type', name: 'the three municipal halls on the forum\'s south side', confidence: 'unverified', built: { from: -27, to: null, approx: true }, materials: ['lime-concrete'], state: 'standing', notes: 'West to east: tabularium, curia, office of the duoviri (snippet). Date and state not found.', sources: [S.snippets] },
  // baths
  { id: 'forum-baths', kind: 'type', name: 'the Forum Baths', confidence: 'read', built: { from: -80, to: null, approx: true }, materials: ['lime-concrete', 'tegula-mammata', 'window-glass'], methods: ['opus-reticulatum', 'hypocaust'], state: 'standing', dims: { cistern: [15, 5, 9] }, notes: 'A round frigidarium; a cistern of 15 × 5 × 9 m (over 430,000 L). Little damage in 62: the only baths working afterwards.', sources: [S.itForumBaths] },
  { id: 'stabian-baths', kind: 'type', name: 'the Stabian Baths', confidence: 'read', built: { from: -125, to: null, approx: true }, materials: ['lime-concrete', 'fired-brick'], methods: ['vault-and-dome', 'hypocaust'], state: 'repaired', notes: 'A whole insula, with a palaestra. Extended c. 80 BCE; the aqueduct and a swimming pool in the early 1st c. CE; enlarged after 62.', sources: [S.stabian] },
  { id: 'central-baths', kind: 'type', name: 'the Central Baths, building', confidence: 'read', built: { from: 70, to: null, approx: true }, materials: ['lime-concrete', 'fired-brick'], methods: ['opus-latericium'], state: 'unfinished', notes: 'Begun after 62 (perhaps c. 70, snippet). In 79 no marble in the pools and no furnaces; three large windows a room. Outside the frame, east of Via Stabiana.', sources: [S.pipCentral, S.snippets] },
  // the theatre quarter
  { id: 'triangular-forum', kind: 'type', name: 'the Triangular Forum', confidence: 'read', built: { from: -150, to: null, approx: true }, materials: ['nocera-tuff'], state: 'standing', notes: '95 Doric columns; a tuff propylon of six Ionic columns; a tholos of seven Doric tuff columns.', sources: [S.itTriangular] },
  { id: 'doric-temple', kind: 'type', name: 'the Doric Temple (Hercules, later Minerva)', confidence: 'secondary', built: { from: -550, to: null, approx: true }, materials: ['sarno-limestone'], state: 'relic', dims: { columns: [7, 11] }, notes: '7 × 11 columns; refurbished at the end of the 6th c. BCE (Dobbins & Foss, via Pompeii in Pictures). Largely disused or ruinous in Roman times (snippet).', sources: [S.pipDoric, S.snippets] },
  { id: 'large-theatre', kind: 'type', name: 'the Large Theatre, set in the slope', confidence: 'read', built: { from: -150, to: null, approx: true }, materials: ['lime-concrete', 'nocera-tuff'], methods: ['opus-incertum'], state: 'repaired', dims: { seats: 5000 }, notes: 'About 5,000 seats. Samnite origins, a 2nd-century theatre, the cavea enlarged by about 10 m c. 80 BCE, rebuilt by the Holconii c. 2–3 BCE; the stage completely rebuilt after 62. Diameter not found.', sources: [S.itTeatroGrande, S.theatres] },
  { id: 'odeon', kind: 'type', name: 'the Odeon (theatrum tectum)', confidence: 'read', built: { from: -80, to: null, approx: true }, materials: ['lime-concrete', 'timber', 'roof-tile'], methods: ['tile-roof'], state: 'standing', notes: 'Built 80–75 BCE by Quinctius Valgus and M. Porcius; a four-pitched, probably timber roof; a coloured marble orchestra floor (Augustan).', disputes: ['About 1,300 seats (it) against 1,500 (en).'], sources: [S.itOdeon, S.theatres] },
  { id: 'quadriporticus', kind: 'type', name: 'the Quadriporticus behind the stage, the gladiators\' barracks after 62', confidence: 'read', built: { from: -80, to: null, approx: true }, materials: ['nocera-tuff'], state: 'repaired', notes: '74 Doric columns of Nocera tuff (aggregator). Size and build date not found; held with the Odeon.', sources: [S.pompeionlineQuad] },
  { id: 'temple-isis', kind: 'type', name: 'the Temple of Isis', confidence: 'read', built: { from: -27, to: null, approx: true }, materials: ['lime-concrete', 'painted-plaster'], state: 'repaired', notes: 'Augustan; rebuilt after 62 by N. Popidius Ampliatus in his six-year-old son\'s name — the only temple wholly rebuilt by 79, so its paint is the new Fourth Style (method fourth-style, from 60).', sources: [S.isis] },
  // houses, shops, works
  { id: 'atrium-house', kind: 'type', name: 'the atrium-peristyle house (domus)', confidence: 'read', built: { from: -200, to: null, approx: true }, materials: ['sarno-limestone', 'painted-plaster', 'roof-tile', 'timber'], methods: ['compluviate-atrium', 'opus-africanum'], state: 'standing', notes: 'Fauces from the street, the atrium with its compluvium over the impluvium, alae, the tablinum, cubicula, a triclinium, the peristyle garden behind; shops open to the street in the front rooms. Dated by its Samnite form in ashlar and opus africanum; the concrete-cored walls of its later rebuilds come with lime-concrete (from c. 150 BCE).', sources: [S.domus] },
  { id: 'house-of-the-faun', kind: 'type', name: 'the House of the Faun', confidence: 'read', built: { from: -180, to: null, approx: true }, materials: ['sarno-limestone', 'nocera-tuff', 'painted-plaster'], methods: ['compluviate-atrium', 'first-style'], state: 'standing', dims: { area: 3000 }, notes: 'About 3,000 m²; two atria, two peristyles, the Alexander Mosaic.', sources: [S.faun] },
  { id: 'taberna', kind: 'type', name: 'shops and thermopolia opening on the street', confidence: 'read', built: { from: -200, to: null, approx: true }, materials: ['sarno-limestone', 'timber'], state: 'standing', notes: 'Nearly 100 thermopolia in the town.', sources: [S.pompeii, S.domus] },
  { id: 'bakery', kind: 'type', name: 'bakery with lava mills and a vaulted oven', confidence: 'read', built: { from: -100, to: null, approx: true }, materials: ['lava-stone', 'fired-brick'], state: 'standing', notes: 'At least 31 in the town (read; about 35, snippet). Hourglass lava mills; brick-vaulted ovens; 80 loaves found at Modestus\'s (snippet). A fire source.', sources: [S.pompeii, S.snippets] },
  { id: 'fullonica', kind: 'type', name: 'fullery and wool workshops', confidence: 'read', built: { from: -100, to: null, approx: true }, materials: ['lime-concrete'], state: 'standing', notes: '13 raw-wool workshops, 7 spinning, 9 dyeing, 18 washing (read). The fullonica of Stephanus was a house converted after 62, with drying terraces above (snippet).', sources: [S.pompeii, S.snippets] },
  // water
  { id: 'castellum-aquae', kind: 'type', name: 'the castellum aquae at Porta Vesuvio', confidence: 'read', built: { from: -35, to: null, approx: true }, materials: ['lime-concrete', 'lead-pipe'], methods: ['opus-reticulatum', 'aqueduct-supply'], state: 'standing', notes: 'The town\'s highest point, about 43 m above the sea; a domed basin split three ways. Outside the frame, north.', sources: [S.pipCastellum] },
  { id: 'street-fountain', kind: 'type', name: 'street fountains and water towers', confidence: 'unverified', built: { from: -35, to: null, approx: true }, materials: ['lava-stone', 'lead-pipe'], methods: ['aqueduct-supply'], state: 'standing', dims: { tower: 6 }, notes: 'Water towers about 6 m high with lead tanks on top (snippet).', disputes: ['43 fountains and 15 towers (snippet, the 15th found in 2020) against 42 and 14 (snippet) and "more than 25" fountains (en Wikipedia, read).'], sources: [S.snippets, S.pompeii, S.pipFountains] },
  // outside the walls
  { id: 'tombs-ercolano', kind: 'type', name: 'the tombs along the road outside Porta Ercolano', confidence: 'read', built: { from: -80, to: null, approx: true }, materials: ['nocera-tuff', 'lime-concrete', 'painted-plaster'], methods: ['opus-incertum'], state: 'standing', notes: 'Aediculae, semicircular bench tombs (scholae), altar tombs on podiums; c. 80 BCE to 79 CE; tuff stuccoed white. Mamia\'s schola c. 29 CE (snippet). The later tombs add travertine and marble (both from c. 27 BCE).', disputes: ['The Naevoleia Tyche altar: c. 50 BCE (aggregator) against the usual Neronian–Flavian date.'], sources: [S.madainTombs, S.snippets] },
  { id: 'villa-mysteries', kind: 'type', name: 'the Villa of the Mysteries', confidence: 'read', built: { from: -150, to: null, approx: true }, materials: ['lime-concrete', 'painted-plaster'], state: 'standing', notes: 'About 400 m north-west of the walls; over 60 rooms; turned to wine production after 62. The Mysteries frieze is Second Style, c. 70–60 BCE.', disputes: ['Built in the 2nd c. BCE, or in the early 1st (Sullan) per recent research.'], sources: [S.mysteries] },
  { id: 'amphitheatre', kind: 'type', name: 'the amphitheatre in the south-east corner', confidence: 'unverified', built: { from: -70, to: null, approx: true }, materials: ['lime-concrete'], methods: ['opus-incertum'], state: 'standing', notes: 'Built c. 70 BCE by Quinctius Valgus and M. Porcius, the oldest stone amphitheatre known (standard account). Outside the frame: on the horizon at most.', sources: [S.snippets] },
  // anachronisms, held at their dates
  { id: 'maiuri-rebuilds', kind: 'type', name: 'post-war roofs and rebuilt walls at the excavation', confidence: 'unverified', built: { from: 1945, to: null, approx: true }, materials: ['fired-brick'], state: 'standing', notes: 'Maiuri\'s rebuilds (the Large Palaestra, the Houses of Epidius Rufus and of Triptolemus); not in a 79 scene.', sources: [S.snippets] },
  { id: 'theatre-modern-seating', kind: 'type', name: 'the Large Theatre\'s modern restoration and summer-show seating', confidence: 'read', built: { from: 1950, to: null, approx: true }, materials: ['timber'], state: 'standing', sources: [S.itTeatroGrande] },
];

// ── urban form ───────────────────────────────────────────────────────────────────────────────────────
const FORMS = [
  { id: 'walled-town', kind: 'form', name: 'the walled town', confidence: 'read', attested: { from: -400, to: null, approx: true }, notes: '64–67 ha within the walls; nine regiones (Fiorelli\'s, snippet); the insula count not found. Seven gates in use, nine counted (Marina, Stabia, Nocera, Sarno, Nola, Ercolano, Vesuvio, a possible Capua, Occidentalis).', disputes: ['Population: 10,000–20,000 or 11,000–11,500 from household counts (en Wikipedia); 6,400 to 30,000 across the literature, 8,000–12,000 favoured (snippet).'], sources: [S.pompeii, S.pipGates, S.snippets] },
  { id: 'lava-spur', kind: 'form', name: 'a lava plateau about 40 m above the sea', confidence: 'read', attested: { from: -550, to: null, approx: true }, notes: 'About 40 m above the sea; the castellum at about 43 m, the highest point. The height of the south and west bluff was not found: the layout draws it, as Qin\'s tableland was drawn.', sources: [S.pompeii, S.romanports, S.pipCastellum] },
  { id: 'old-town', kind: 'form', name: 'the irregular old town round the forum, the later grid beyond', confidence: 'unverified', attested: { from: -550, to: null, approx: true }, notes: 'Standard account; the boundary of the Altstadt was not read.', sources: [S.snippets] },
  { id: 'via-abbondanza', kind: 'form', name: 'Via dell\'Abbondanza at Via Stabiana', confidence: 'read', attested: { from: -200, to: null, approx: true }, notes: 'About 6.7 m wide east of the crossing; 14.6 m wide west of it, narrowing to about 7.4 m, the widening ending about 60 m west of Via Stabiana; raised about 0.4 m above Via Stabiana, so carts could not turn west. Via Stabiana\'s and Via Marina\'s widths not found.', sources: [S.dobbinsStreets] },
  { id: 'coast-and-port', kind: 'form', name: 'the coast about 1 km south-west; the port unlocated', confidence: 'secondary', attested: { from: -550, to: null, approx: true }, notes: 'Strabo calls Pompeii the port of Nola, Nuceria and Acerrae. The shoreline lay about 1 km south-west of the town, about 1 km inland of today\'s (snippet). The port is unresolved.', disputes: ['The Sarno\'s mouth further north (Stefani & Di Maio 2003); a bay (Cinque & Russo 1986); a lagoon port south-west of the town (Curti 2004); Moregine near Porta Stabia.'], sources: [S.romanports, S.mdpiCoast] },
  { id: 'vesuvius-before', kind: 'form', name: 'Vesuvius before 79: one broad mountain, flat-topped, in vines', confidence: 'read', attested: { from: -550, to: 79, approx: true }, notes: 'Strabo: a mostly flat, barren summit of ash-coloured rock. The lararium fresco of the House of the Centenary: a single vine-covered peak; Martial: shaded green with vines. The Somma caldera was growing up to 79. About 8 km from the town.', sources: [S.vesuvius, S.centenary, S.pompeii] },
  { id: 'post-quake-repairs', kind: 'form', name: 'the town mid-repair after the earthquake', confidence: 'read', attested: { from: 62, to: 79, approx: true }, notes: 'Building sites with scaffolding and raw-material piles (the Regio IX site); see each type\'s state. Repeated tremors between 62 and 79 are argued (title only).', disputes: ['The earthquake: 5 February 62 (Tacitus; the CFTI catalogue) or 63 (Seneca\'s consuls). Magnitude 5.0–6.1.'], sources: [S.quake, S.masic2025, S.heritageQuakes] },
  { id: 'eruption', kind: 'form', name: 'the eruption of Vesuvius', confidence: 'read', attested: { from: 80, to: null, approx: true }, notes: 'Late 79, after the read moment; held from 80 so a 79 read excludes it. A 2018 charcoal inscription (16 days before the Kalends of November, 17 October) in a house under renovation favours October.', disputes: ['24 August (the traditional reading of Pliny) against autumn: 24 October to 1 November (2022 study), with pomegranates, braziers, sealed wine jars and heavy clothing as evidence.'], sources: [S.eruption, S.euronews2018] },
  { id: 'gran-cono', kind: 'form', name: 'the Gran Cono, the modern central cone', confidence: 'read', attested: { from: 80, to: null, approx: true }, notes: 'Built by the 79 eruption and after; no Somma-and-cone twin profile in a 79 scene.', sources: [S.vesuvius] },
  { id: 'modern-coast', kind: 'form', name: 'the coast at its modern line', confidence: 'unverified', attested: { from: 1500, to: null, approx: true }, notes: 'About 700 m from the site today (read, en Wikipedia); the date it reached this line is not recorded here.', sources: [S.pompeii, S.mdpiCoast] },
  { id: 'excavated-ruins', kind: 'form', name: 'the roofless excavated site, stripped of marble', confidence: 'read', attested: { from: 1748, to: null, approx: true }, sources: [S.pompeii] },
  { id: 'bomb-damage-1943', kind: 'form', name: 'the 1943 bomb damage (Porta Marina and elsewhere)', confidence: 'read', attested: { from: 1943, to: null, approx: true }, sources: [S.pipMarina] },
];

export const POMPEII_RECORD = [...MATERIALS, ...METHODS, ...TYPES, ...FORMS];
export const POMPEII_SOURCES = S;
