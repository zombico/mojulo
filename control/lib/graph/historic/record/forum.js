/**
 * The record for the Forum Romanum, read on a summer day of 79 CE, the same moment as the Pompeii scene
 * (./pompeii.js): Titus's first weeks after Vespasian's death on 23 June, after the fire of 64 and the burning of the
 * Capitol in 69, before the fire of 80. The scene is the valley from the Tabularium to the Regia and Vesta, about
 * 200 × 120 m; what stands round it (the Capitoline temple, the Palatine edge, the Templum Pacis) is recorded where it
 * shows. Format and checks: ../record.js.
 *
 * `confidence`: 'read' = a page stating the fact was fetched and read (through a model summary of it, so numbers were
 * read back, not seen in the original); 'secondary' = a modern reference work's claim the page reports, or a page
 * naming its source; 'unverified' = a conjecture or a number from a weak page. Platner & Ashby (1929) carry most of
 * the numbers; where a modern page contradicts them the entry says so. Pensabene on Saturn, Claridge, Richardson and
 * the Digitales Forum Romanum could not be read (anti-bot pages, no online text).
 * The design language these feed: docs/historic/forum/README.md and ../style/forum.js.
 *
 * Settled by the record, read by the layout:
 *  - Every building carries its `state` at 79 (Pompeii's states). The east end was rebuilt after 64 (Vesta, the
 *    Atrium Vestae); the Capitoline temple stands newly rebuilt after 69; the rest is Augustan and Tiberian marble.
 *  - The Temple of Vespasian does not exist yet: he was deified after his death, and the temple was begun by Titus
 *    and dedicated by Domitian. Its plot below the Tabularium is open (held from 80, so a 79 read excludes it).
 *  - Each temple carries its order and column numbers (`dims`): the orders are methods with their own dates, so a
 *    building can only use an order Rome had by its build year.
 *
 * Anachronisms held at their real dates, never drawn in 79: the standing Ionic porch of Saturn with its granite
 * shafts and INCENDIO CONSUMPTUM inscription (late antique); the brick Curia and the Basilica Julia's brick piers
 * (Diocletian); the Severan Vesta and its 1930 anastylosis; the Domitianic peristyle of the Atrium Vestae; the
 * Porticus Deorum Consentium in its Flavian form; the Umbilicus; the Equus Domitiani; the Arches of Titus and Septimius
 * Severus; Antoninus and Faustina; the Basilica of Maxentius; the Column of Phocas; the excavated ruin.
 */

// ── sources ──────────────────────────────────────────────────────────────────────────────────────────
const W = (title, via = 'read') => ({ author: 'Wikipedia', title, year: 2026, url: `https://en.wikipedia.org/wiki/${title.replace(/ /g, '_')}`, via });
const WI = (title, via = 'read') => ({ author: 'Wikipedia (it)', title, year: 2026, url: `https://it.wikipedia.org/wiki/${title.replace(/ /g, '_')}`, via });
const PA = (page, title) => ({ author: 'S. B. Platner & T. Ashby (LacusCurtius)', title: `A Topographical Dictionary of Ancient Rome: ${title}`, year: 1929, url: `https://penelope.uchicago.edu/Thayer/E/Gazetteer/Places/Europe/Italy/Lazio/Roma/Rome/_Texts/PLATOP*/${page}.html`, via: 'read; a 1929 reference, its numbers from the excavations then' });
const DAR = (slug, title) => ({ author: 'Digital Augustan Rome', title, year: 2026, url: `https://www.digitalaugustanrome.org/records/${slug}/`, via: 'read' });
const S = {
  paSaturn: PA('Aedes_Saturni', 'Aedes Saturni'),
  paConcord: PA('Concordia', 'Concordia, aedes'),
  paVespasian: PA('Templum_Vespasiani', 'Templum Vespasiani'),
  paTabularium: PA('Tabularium', 'Tabularium'),
  paConsentes: PA('Porticus_Deorum_Consentium', 'Porticus Deorum Consentium'),
  paJulia: PA('Basilica_Julia', 'Basilica Iulia'),
  paAemilia: PA('Basilica_Aemilia', 'Basilica Aemilia'),
  paCastor: PA('Aedes_Castoris', 'Aedes Castoris'),
  paJulius: PA('Aedes_Divi_Juli', 'Aedes Divi Iulii'),
  paArchAugustus: PA('Arcus_Augusti', 'Arcus Augusti'),
  paArchTiberius: PA('Arcus_Tiberii', 'Arcus Tiberii'),
  paCuria: PA('Curia_Julia', 'Curia Iulia'),
  paComitium: PA('Comitium', 'Comitium'),
  paRostra: PA('Rostra_Augusti', 'Rostra Augusti'),
  paUmbilicus: PA('Umbilicus_Romae', 'Umbilicus Romae'),
  paMilliarium: PA('Milliarium_Aureum', 'Milliarium Aureum'),
  paCurtius: PA('Lacus_Curtius', 'Lacus Curtius'),
  paVesta: PA('Vesta', 'Vesta, aedes'),
  paAtrium: PA('Atrium_Vestae', 'Atrium Vestae'),
  paRegia: PA('Regia', 'Regia'),
  paForum: PA('Forum_Romanum', 'Forum Romanum'),
  paSacraVia: PA('Sacra_Via', 'Sacra Via'),
  paTuscus: PA('Vicus_Tuscus', 'Vicus Tuscus'),
  paPacis: PA('Templum_Pacis', 'Templum Pacis'),
  paEquus: PA('Equus_Domitiani', 'Equus Domitiani'),
  paAugustum: PA('Forum_Augustum', 'Forum Augustum'),
  paJupiter: PA('Aedes_Jovis_Capitolini', 'Iuppiter Optimus Maximus Capitolinus, aedes'),
  darTabularium: DAR('tabularium', 'Tabularium'),
  darPaulli: DAR('basilica-paulli', 'Basilica Paulli'),
  darGaiLuci: DAR('porticus-gai-et-luci', 'Porticus Gai et Luci'),
  darJulia: DAR('basilica-iulia', 'Basilica Iulia'),
  darRegia: DAR('regia', 'Regia'),
  darArch: DAR('arcus-augusti', 'Arcus Augusti'),
  saturn: W('Temple of Saturn'), concord: W('Temple of Concord'), vespasian: W('Temple of Vespasian and Titus'),
  tabularium: W('Tabularium'), consentes: W('Portico Dii Consentes'), julia: W('Basilica Julia'), aemilia: W('Basilica Aemilia'),
  castor: W('Temple of Castor and Pollux'), caesar: W('Temple of Caesar'), curia: W('Curia Julia'), rostra: W('Rostra'),
  vesta: W('Temple of Vesta, Rome'), pacis: W('Temple of Peace, Rome'), forum: W('Roman Forum'), corinthian: W('Corinthian order'),
  minium: W('Minium (pigment)'),
  itSaturn: WI('Tempio di Saturno'), itConcord: WI('Tempio della Concordia (Roma)'), itTabularium: WI('Tabularium'),
  itConsentes: WI('Portico degli Dei Consenti'), itAemilia: WI('Basilica Emilia'), itCastor: WI('Tempio dei Castori'),
  itJulius: WI('Tempio del Divo Giulio'), itArch: WI('Arco di Augusto (Foro Romano)'),
  vitruvius3: { author: 'Vitruvius, tr. Gwilt (LacusCurtius)', title: 'De Architectura, book III', year: -25, url: 'https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Vitruvius/3*.html', via: 'read (the extraction partly garbled; standard values checked against Encyclopaedia Romana)' },
  vitruvius4: { author: 'Vitruvius, tr. Gwilt (LacusCurtius)', title: 'De Architectura, book IV', year: -25, url: 'https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Vitruvius/4*.html', via: 'read' },
  romana: { author: 'J. Wayne Thayer / Encyclopaedia Romana', title: 'Temple architecture', year: 2026, url: 'https://penelope.uchicago.edu/encyclopaedia_romana/architecture/templearchitecture.html', via: 'read' },
  romanaPegasus: { author: 'Encyclopaedia Romana', title: 'The Forum of Augustus: Pegasus capitals and the gilded coffers', year: 2026, url: 'https://penelope.uchicago.edu/encyclopaedia_romana/imperialfora/augustus/pegasus.html', via: 'read' },
  seindalSaturn: { author: 'R. Seindal', title: 'Temple of Saturn', year: 2026, url: 'https://sights.seindal.dk/italy/rome/forum-romanum/temple-of-saturn/', via: 'read' },
  seindalCastor: { author: 'R. Seindal', title: 'Temple of Castor and Pollux', year: 2026, url: 'https://sights.seindal.dk/italy/rome/forum-romanum/temple-of-castor-and-pollux/', via: 'read' },
  worldhistSaturn: { author: 'World History Encyclopedia', title: 'Temple of Saturn, Rome', year: 2026, url: 'https://www.worldhistory.org/article/636/temple-of-saturn-rome/', via: 'read' },
  colosseoArch: { author: 'Parco archeologico del Colosseo', title: 'Arch of Augustus', year: 2026, url: 'https://colosseo.it/en/marvels/arch-of-augustus/', via: 'read' },
  colosseoVesta: { author: 'Parco archeologico del Colosseo', title: 'Temple of Vesta', year: 2026, url: 'https://colosseo.it/en/marvels/temple-of-vesta/', via: 'read' },
  vromaVesta: { author: 'B. Spaeth (VRoma)', title: 'The Temple of Vesta: history', year: 2026, url: 'http://vroma.org/vromans/bspaeth/vesta/vestahistory.html', via: 'read' },
  vromaFicus: { author: 'J. Ruebel (VRoma)', title: 'Ficus, olea, vitis', year: 2026, url: 'http://vroma.org/vromans/jruebel/ficus.html', via: 'read' },
  coinsVesta: { author: 'tellmeaboutcoins', title: 'Lost buildings V: the Temple of Vesta on coins', year: 2022, url: 'https://tellmeaboutcoins.wordpress.com/2022/05/20/famous-coin-friday-lost-buildings-part-v-the-temple-of-vesta/comment-page-1/', via: 'read' },
  mqArch: { author: 'Macquarie University ancient history blog', title: 'The Arch of Augustus', year: 2026, url: 'https://ancient-history-blog.mq.edu.au/cityOfRome/ArchofAugustus', via: 'read' },
  arlPiazza: { author: 'Ancient Rome Live', title: 'The forum piazza', year: 2026, url: 'https://ancientromelive.org/forum-piazza/', via: 'read' },
  arlAugustum: { author: 'Ancient Rome Live', title: 'Forum of Augustus', year: 2026, url: 'https://ancientromelive.org/forum-augustum-forum-of-augustus/', via: 'read' },
  stones: { author: 'romeartlover.it', title: 'Stones of ancient Rome', year: 2026, url: 'https://www.romeartlover.it/Stones.html', via: 'read' },
  travertine: { author: 'Engineering Rome', title: 'Travertine: production and use in ancient Rome', year: 2026, url: 'https://engineeringrome.org/travertine-production-process-and-its-use-in-ancient-and-modern-rome/', via: 'read' },
  bondono: { author: 'J. Bondono (Tourist in Rome)', title: 'Temple of Castor and Pollux', year: 2026, url: 'https://www.jeffbondono.com/touristinrome/WaltersTours/TempleOfCastorAndPollux.html', via: 'search snippet only' },
  polychromy: { author: 'Journal (University of Chicago Press) 10.1086/739560', title: 'architectural polychromy in Augustan Italy', year: 2026, via: 'search summary only' },
  snippets: { author: 'various', title: 'search snippets and the standard account', year: 2026, via: 'search snippets only' },
  paStatuae: PA('Statuae', 'Statuae'),
  paDuilius: PA('Columna_Rostrata_C.Duilii', 'Columna Rostrata C. Duilii'),
  paRostrata: PA('Columna_Rostrata', 'Columnae Rostratae'),
  paJanus: PA('Janus_Geminus', 'Ianus Geminus'),
  paCloacina: PA('Sacrum_Cloacinae', 'Sacrum Cloacinae'),
  paLapis: PA('Sepulcrum_Romuli', 'Sepulcrum Romuli (the Lapis Niger)'),
  paPuteal: PA('Puteal_Libonis', 'Puteal Libonis'),
  paTribunal: PA('Tribunal_Praetoris', 'Tribunal Praetoris'),
  velleius: { author: 'Velleius Paterculus (LacusCurtius)', title: 'Roman History 2.61.3', year: 30, url: 'https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Velleius_Paterculus/2C*.html', via: 'read' },
  pliny34: { author: 'Pliny the Elder (LacusCurtius; attalus.org)', title: 'Natural History 34.20–33, 34.93', year: 77, url: 'https://penelope.uchicago.edu/Thayer/L/Roman/Texts/Pliny_the_Elder/34*.html', via: 'read (dedicated 77: what he says "still stands" stood in 79)' },
  pliny19: { author: 'Pliny the Elder (LacusCurtius)', title: 'Natural History 19.23–24 (awnings over the forum)', year: 77, url: 'https://penelope.uchicago.edu/Thayer/L/Roman/Texts/Pliny_the_Elder/19*.html', via: 'read' },
  livy940: { author: 'Livy (Perseus)', title: 'Ab Urbe Condita 9.40.16 (the forum decorated with shields when the tensae are led)', year: 10, url: 'http://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.02.0147:book%3D9:chapter%3D40', via: 'search summary of the passage' },
  janus: W('Temple of Janus (Roman Forum)'), juturna: W('Lacus Juturnae'), vertumnus: W('Vertumnus'), fasti: W('Fasti Capitolini'),
  itAemiliaFrieze: WI('Fregio storico della Basilica Emilia'),
  arlJuturna: { author: 'Ancient Rome Live', title: 'Lacus Iuturnae', year: 2026, url: 'https://ancientromelive.org/lacus-iuturnae/', via: 'search summary' },
  coinCuria: { author: 'Roman coin dealers\' descriptions', title: 'denarius of Octavian, 29–27 BCE: the Curia Julia', year: 2026, url: 'https://www.romancoinshop.com/en/augustus-denarius-curia-julia-o2175/', via: 'search summary' },
};

/** The year a Forum scene is read at (Pompeii's moment) and the dates around it (BCE negative). */
export const FORUM_READ_AT = 79;
export const FORUM_DATES = { neroFire: 64, capitolFire: 69, vespasianDies: 79, fireOf80: 80 };
/** What a building is at the read year: Pompeii's states (./pompeii.js POMPEII_STATES). */
export const FORUM_STATES = ['standing', 'repaired', 'damaged', 'under-repair', 'unfinished', 'relic'];

// ── materials ────────────────────────────────────────────────────────────────────────────────────────
const MATERIALS = [
  {
    id: 'cappellaccio', kind: 'material', name: 'cappellaccio and grotta oscura tufa, the early grey-yellow building stones', confidence: 'secondary',
    attested: { from: -550, to: null, approx: true, where: ['podium cores', 'the Rostra\'s opus quadratum', 'the Regia\'s earlier phases'] },
    supply: 'the hills of Rome and the Veii quarries', role: ['wall', 'foundation'], colour: ['#a69a7c'],
    notes: 'Grey-yellow to brown, porous. In 79 a core and backing stone behind marble, seldom seen.', sources: [S.stones, S.paRostra],
  },
  {
    id: 'anio-tufa', kind: 'material', name: 'Anio tufa', confidence: 'read',
    attested: { from: -200, to: null, approx: true, where: ['the Tabularium\'s inner walls'] },
    supply: 'quarries on the Anio', role: ['wall'], colour: ['#9b8a6a'], sources: [S.paTabularium, S.darTabularium],
  },
  {
    id: 'peperino', kind: 'material', name: 'peperino (lapis Gabinus, sperone): grey-green with black specks', confidence: 'read',
    attested: { from: -200, to: null, approx: true, where: ['the Tabularium\'s façade and Doric half-columns', 'the Temple of Divus Julius\'s walls', 'the Templum Pacis\'s enclosure wall'] },
    supply: 'Gabii and the Alban Hills', role: ['wall', 'structure'], colour: ['#7f8073'], sources: [S.paTabularium, S.paJulius, S.paPacis, S.stones],
  },
  {
    id: 'travertine', kind: 'material', name: 'travertine (lapis Tiburtinus): creamy, warm, pitted', confidence: 'read',
    attested: { from: -150, to: null, approx: true, where: ['the forum\'s paving', 'the Tabularium\'s capitals and imposts', 'Saturn\'s podium facing', 'the Rostra\'s floor and beams'] },
    supply: 'Tibur (Tivoli)', role: ['paving', 'structure', 'wall'], colour: ['#d9cdb0'], sources: [S.paForum, S.paTabularium, S.travertine],
  },
  {
    id: 'luna-marble', kind: 'material', name: 'Luna marble: fine white, blue-grey veined', confidence: 'secondary',
    attested: { from: -48, to: null, approx: true, where: ['Castor', 'the Basilica Julia\'s façade', 'Divus Julius', 'Concord'] },
    supply: 'the Luna quarries (Carrara), opened at scale under Caesar', role: ['structure', 'finish', 'ornament'], colour: ['#ece9e2'],
    notes: 'The date the quarries opened at scale is the standard account (mid-1st c. BCE). The Regia\'s marble of 36 BCE is the earliest dated use here.',
    sources: [S.stones, S.paCastor, S.paJulia],
  },
  {
    id: 'coloured-marble', kind: 'material', name: 'coloured marbles: giallo antico, africano, pavonazzetto, cipollino, porta santa', confidence: 'read',
    attested: { from: -78, to: null, approx: true, where: ['the Basilica Aemilia\'s africano columns and floor', 'the Basilica Julia\'s court pavement', 'Concord\'s porta santa threshold'] },
    supply: 'Numidia, Teos, Phrygia, Euboea, Chios', role: ['finish', 'ornament', 'paving'], colour: ['#c9a24a', '#5a3b3a', '#e7dfe4', '#a9b79f', '#b46f6a'],
    notes: 'Giallo antico from Lepidus\'s threshold of 78 BCE (the standard account); the rest in use by the Augustan rebuilds.', sources: [S.paAemilia, S.paJulia, S.paConcord, S.stones],
  },
  {
    id: 'roman-concrete', kind: 'material', name: 'concrete (opus caementicium)', confidence: 'read',
    attested: { from: -121, to: null, approx: true, where: ['Concord\'s podium core (Opimius, 121 BCE: "probably the oldest known concrete in the city")', 'Castor\'s podium', 'the Tabularium\'s vaults'] },
    supply: 'lime and pozzolana with tufa rubble', role: ['foundation', 'structure'], colour: ['#9c9284'], sources: [S.paConcord, S.paCastor],
  },
  {
    id: 'fired-brick', kind: 'material', name: 'fired brick (facing concrete)', confidence: 'unverified',
    attested: { from: -20, to: null, approx: true, where: ['the Atrium Vestae\'s Neronian rebuild', 'the Basilica Julia\'s inner pillars, faced in marble'] },
    supply: 'the Tiber valley brickyards', role: ['wall'], colour: ['#a5553a'],
    notes: 'Brick-faced concrete from the late Augustan period (standard account). The brick piers visible in the Basilica Julia today are Diocletian\'s.', sources: [S.paJulia, S.snippets],
  },
  {
    id: 'greek-marble', kind: 'material', name: 'imported Greek marble: Pentelic and Parian', confidence: 'unverified',
    attested: { from: -146, to: null, approx: true, where: ['the Basilica Aemilia\'s inner frieze (Pentelic)', 'the Dioscuri at the Lacus Iuturnae', 'the Arch of Augustus\'s dedication block (Parian)'] },
    supply: 'Attica and Paros', role: ['ornament', 'finish'], colour: ['#efece4'],
    notes: 'Imported for sculpture after the sack of Corinth (standard account).', sources: [S.snippets],
  },
  {
    id: 'stucco', kind: 'material', name: 'lime stucco, over travertine or tufa, painted', confidence: 'secondary',
    attested: { from: -200, to: null, approx: true, where: ['Concord\'s columns, per en Wikipedia'] },
    supply: 'lime and marble dust', role: ['finish'], colour: ['#ebe5d6'], sources: [S.concord],
  },
  {
    id: 'bronze', kind: 'material', name: 'bronze, often gilt: beaks, statues, letters, roof tiles', confidence: 'read',
    attested: { from: -600, to: null, approx: true, where: ['the Rostra\'s ships\' beaks', 'the Surdinus inscription\'s letters', 'the Milliarium Aureum', 'the Capitoline temple\'s roof tiles', 'the two-faced Ianus of the Ianus Geminus'] },
    supply: 'cast in Rome', role: ['ornament', 'roof'], colour: ['#8a6d3b', '#c9a64a'],
    notes: 'The beaks from Antium in 338 BCE first gave the Rostra its name. Rome\'s bronze statuary is older: the Ianus statue is ascribed to Numa (Pliny 34.33), held at c. 600 for ordering (unverified).', sources: [S.paRostra, S.paForum, S.paMilliarium, S.paJupiter],
  },
  {
    id: 'roof-tile', kind: 'material', name: 'terracotta roof tile (tegulae and imbrices)', confidence: 'unverified',
    attested: { from: -600, to: null, approx: true, where: ['the basilicas\' timber roofs', 'the temples\' roofs'] },
    supply: 'the Tiber valley', role: ['roof'], colour: ['#b4623c'],
    notes: 'The standard account for Roman timber roofs; marble tiles were also used on the grandest temples (not recorded here).', sources: [S.snippets],
  },
  {
    id: 'timber', kind: 'material', name: 'timber: the basilicas\' trusses, the temples\' roofs', confidence: 'read',
    attested: { from: -600, to: null, approx: true, where: ['the Basilica Julia\'s clerestory-lit nave'] },
    supply: 'fir and oak from the Apennines', role: ['roof', 'structure'], colour: ['#6e5238'], sources: [S.paJulia],
  },
  {
    id: 'selce', kind: 'material', name: 'basalt (selce) polygonal paving for streets', confidence: 'unverified',
    attested: { from: -300, to: null, approx: true, where: ['the Sacra Via (not stated by P&A)'] },
    supply: 'the Alban Hills\' lava flows', role: ['paving'], colour: ['#4b4a47'], sources: [S.snippets],
  },
];

// ── methods ──────────────────────────────────────────────────────────────────────────────────────────
const METHODS = [
  { id: 'opus-quadratum', kind: 'method', name: 'opus quadratum: squared stone in courses', confidence: 'read', attested: { from: -550, to: null, approx: true }, materials: ['cappellaccio'], sources: [S.paRostra] },
  { id: 'opus-caementicium', kind: 'method', name: 'concrete cores, vaults and podia', confidence: 'read', attested: { from: -121, to: null, approx: true }, materials: ['roman-concrete'], sources: [S.paConcord] },
  { id: 'marble-cladding', kind: 'method', name: 'marble cladding over concrete or tufa (incrustation)', confidence: 'read', attested: { from: -48, to: null, approx: true }, materials: ['luna-marble'], notes: 'Castor\'s podium: concrete faced with tufa walls under marble.', sources: [S.paCastor, S.itCastor] },
  { id: 'opus-testaceum', kind: 'method', name: 'brick-faced concrete', confidence: 'unverified', attested: { from: -20, to: null, approx: true }, materials: ['fired-brick', 'roman-concrete'], sources: [S.snippets] },
  // the orders, each with the date Rome first built in it; a building uses only an order it had (record.js)
  { id: 'tuscan-order', kind: 'method', name: 'the Tuscan order (and the Roman Doric): base and capital ½ D each, plain or fluted shaft', confidence: 'read', attested: { from: -509, to: null, approx: true }, materials: ['cappellaccio'], notes: 'Vitruvius IV.7. The Tabularium\'s and the basilicas\' engaged half-columns are called Doric by P&A, Tuscan by some.', sources: [S.vitruvius4, S.paTabularium] },
  { id: 'ionic-order', kind: 'method', name: 'the Ionic order: base and capital ½ D, the volutes', confidence: 'read', attested: { from: -200, to: null, approx: true }, materials: ['peperino'], notes: 'Vitruvius III.5. Date held at the 2nd c. BCE Ionic temples of Rome (standard account).', sources: [S.vitruvius3, S.snippets] },
  { id: 'corinthian-order', kind: 'method', name: 'the Corinthian order: the capital about 1–1.17 D, the column about 10 D', confidence: 'read', attested: { from: -146, to: null, approx: true }, materials: ['travertine'], notes: 'Vitruvius IV.1: the capital 1 D with its abacus, the abacus\'s diagonal twice the capital\'s height. Augustan capitals run taller (1.1–1.17 D). Date held at the Temple of Hercules Victor (standard account).', sources: [S.vitruvius4, S.corinthian] },
  { id: 'painted-marble', kind: 'method', name: 'paint and gilding on marble: mouldings, frieze grounds, letters', confidence: 'secondary', attested: { from: -48, to: null, approx: true }, materials: ['luna-marble'], notes: 'Paint traces on the Ara Pacis (9 BCE); gilt-bronze acroteria and gilded rosettes in Mars Ultor\'s coffers; inscription letters in red minium or set in bronze. Polychromy on Augustan Italian capitals and cornices is rarer than in Asia Minor, so the scene paints selectively.', disputes: ['How much colour on the forum\'s buildings: nothing specific to them was found.'], sources: [S.romanaPegasus, S.minium, S.polychromy] },
];

// ── building types ───────────────────────────────────────────────────────────────────────────────────
// dims in metres: podium { w, d, h }; columns { front, flank, h, D }; `faces`: the side the front looks to (n/e/s/w).
const TYPES = [
  // the temple terrace at the Capitoline foot
  {
    id: 'temple-saturn', kind: 'type', name: 'the Temple of Saturn, Plancus\'s rebuild, the treasury in its podium', confidence: 'secondary',
    built: { from: -42, to: null }, materials: ['travertine', 'peperino', 'roman-concrete', 'luna-marble'], methods: ['corinthian-order', 'marble-cladding'], state: 'standing',
    dims: { podium: { w: 22.5, d: 40, h: 9 }, columns: { front: 6, flank: 2, h: 11, D: 1.43 }, order: 'corinthian' },
    notes: 'Podium 22.5 × 40 m (P&A), 9 m high, faced in travertine (Seindal). Hexastyle prostyle with two more on each flank. The 79 order is drawn Corinthian (unverified: the standing Ionic porch is late antique; the reset modillion cornice is said to be Plancus\'s). Column size from the late porch (11 m, 1.43 m), kept for the 79 temple.',
    disputes: ['Ionic (P&A, Seindal: both describe the late porch) against originally Corinthian (Encyclopaedia Romana).', 'The reset entablature: Plancus\'s (World History) or late 2nd–early 3rd c. (it Wikipedia).'],
    sources: [S.paSaturn, S.seindalSaturn, S.romana, S.worldhistSaturn, S.itSaturn],
  },
  {
    id: 'temple-concord', kind: 'type', name: 'the Temple of Concord: Tiberius\'s, its cella wider than deep', confidence: 'read',
    built: { from: 10, to: null }, materials: ['roman-concrete', 'luna-marble', 'coloured-marble'], methods: ['corinthian-order', 'marble-cladding'], state: 'standing',
    dims: { cella: { w: 45, d: 24 }, pronaos: { w: 34, d: 14 }, columns: { front: 6, flank: 2, h: 14.5, D: 1.45 }, order: 'corinthian' },
    notes: 'Cella 45 × 24 m against the Tabularium, the pronaos 34 × 14 m before it, facing the forum. Hexastyle on the Tiberian sestertius. A two-block porta santa threshold 7 m long with a caduceus. Inside, Greek masterpieces and four obsidian elephants. Column size not found: scaled to the cella (unverified).',
    disputes: ['Six columns (the coin) against eight of travertine in stucco (en Wikipedia).', 'A podium of 40.8 × 30 m (en Wikipedia) does not fit the 45 m cella.'],
    sources: [S.paConcord, S.concord, S.itConcord],
  },
  {
    id: 'tabularium', kind: 'type', name: 'the Tabularium: Catulus\'s substructure of the Capitol, an arcaded gallery facing the forum', confidence: 'read',
    built: { from: -78, to: null }, materials: ['peperino', 'anio-tufa', 'travertine', 'roman-concrete'], methods: ['tuscan-order', 'opus-quadratum'], state: 'standing',
    dims: { length: 73.6, gallery: 15, arches: { n: 11, h: 7.5, w: 3.6 }, wall: 3.43, order: 'tuscan' },
    notes: 'A blank lower wall with small windows, the gallery about 15 m above the forum: 11 arches 7.5 × 3.6 m between engaged peperino half-columns (Doric per P&A) with travertine bases and capitals. The upper Corinthian storey is uncertain for 79 (P&A: added at the end of the 1st c.); the scene stops at the arcade. The fire of 69 burned the bronze tablets; the structure stood.',
    disputes: ['What it was: the Tabularium; the Atrium Libertatis (Purcell); Juno Moneta (Tucci); a Sullan triple temple (Coarelli).', 'Façade 73.6 m (it) or the corridor 67 m (en).'],
    sources: [S.paTabularium, S.darTabularium, S.tabularium, S.itTabularium],
  },
  {
    id: 'consentes-terrace', kind: 'type', name: 'a low terrace below the Tabularium where the Dei Consentes portico will stand', confidence: 'unverified',
    built: { from: -100, to: null, approx: true }, materials: ['cappellaccio'], methods: ['opus-quadratum'], state: 'standing',
    notes: 'The Flavian portico is post-79; an earlier portico\'s form is unknown. Drawn as plain retaining walls along the Clivus Capitolinus.', sources: [S.paConsentes, S.itConsentes],
  },
  // the long sides of the square
  {
    id: 'basilica-julia', kind: 'type', name: 'the Basilica Julia: Augustus\'s rebuild, two arcaded storeys on the south-west side', confidence: 'read',
    built: { from: 12, to: null }, materials: ['luna-marble', 'coloured-marble', 'fired-brick', 'timber', 'roof-tile'], methods: ['tuscan-order', 'marble-cladding'], state: 'standing',
    dims: { w: 101, d: 49, nave: { w: 82, d: 16 }, aisle: 7.5, piers: { long: 18, short: 8 }, storeys: 2, order: 'tuscan' },
    notes: '101 × 49 m; the central hall 82 × 16 m, aisles 7.5 m round it; 18 piers on each long side, 8 on each short; arcades on two storeys with engaged columns (Doric per P&A; the upper order not given). Steps up from the street: seven at the east end, one at the west, as the street falls. Marble façade; coloured-marble court pavement; a clerestory under a timber roof.',
    disputes: ['The 12 CE dedication "problematic" (DAR).', 'The nave 16 m (P&A) or 18 m (en).'],
    sources: [S.paJulia, S.darJulia, S.julia],
  },
  {
    id: 'basilica-aemilia', kind: 'type', name: 'the Basilica Aemilia (Paulli) behind the Tabernae Novae and their two-storey portico', confidence: 'secondary',
    built: { from: -14, to: null }, materials: ['luna-marble', 'coloured-marble', 'timber', 'roof-tile'], methods: ['tuscan-order', 'marble-cladding'], state: 'standing',
    dims: { w: 90, d: 27, shops: 15, order: 'tuscan', inner: { D: [0.85, 0.55] } },
    notes: 'Rebuilt after the fire of 14 BCE, restored c. 22 CE. Pliny counted it among Rome\'s three most beautiful buildings. The forum front: 15 shops behind a two-storey arcade with Doric half-columns, bucrania and paterae in the metopes. Inside, africano columns (0.85 and 0.55 m) in two orders, a clerestory with white pilasters, a frieze of Rome\'s foundation legends.',
    disputes: ['90 × 27 m (P&A), 70 × 29 (it), "nearly 100 × 30" (en): drawn at 90.', 'Whether the front was the Porticus Gai et Luci.'],
    sources: [S.paAemilia, S.darPaulli, S.darGaiLuci, S.aemilia, S.itAemilia],
  },
  // the south-east end
  {
    id: 'temple-castor', kind: 'type', name: 'the Temple of Castor and Pollux: Tiberius\'s, octastyle peripteral on a high podium with a tribunal', confidence: 'read',
    built: { from: 6, to: null }, materials: ['roman-concrete', 'cappellaccio', 'luna-marble'], methods: ['corinthian-order', 'marble-cladding'], state: 'standing',
    dims: { podium: { w: 32, d: 49.5, h: 7 }, tribunal: 3.66, columns: { front: 8, flank: 11, h: 14.8, D: 1.45 }, entablature: 3.75, order: 'corinthian' },
    notes: 'Podium 32 × 49.5 m and 7 m high; a tribunal 3.66 m above the forum in front, used as a speakers\' platform, reached by a stair; chambers in the podium behind metal grilles. 8 × 11 fluted Corinthian columns of Luna marble, 1.45 m in diameter, about 14.8 m tall (10.2 D); entablature 3.75 m, a plain frieze under a rich cornice.',
    disputes: ['Columns 12.5 m (P&A, probably the shaft only) or 14.8 m.', 'The standing columns Tiberian or a later repair.'],
    sources: [S.paCastor, S.castor, S.seindalCastor, S.itCastor, S.bondono],
  },
  {
    id: 'temple-divus-julius', kind: 'type', name: 'the Temple of Divus Julius on its rostra, closing the square\'s south-east end', confidence: 'secondary',
    built: { from: -29, to: null }, materials: ['peperino', 'travertine', 'luna-marble', 'roman-concrete', 'bronze'], methods: ['ionic-order', 'marble-cladding'], state: 'standing',
    dims: { podium: { w: 26.97, d: 30, h: 3.5 }, stylobate: 2.36, niche: 8.3, columns: { front: 6, flank: 0, h: 10.6, D: 1.18 }, order: 'ionic' },
    notes: 'A platform 3.5 m high at the front, 27 × 30 m, projecting 7 m either side as the rostra ad Divi Iuli, its front a semicircular niche 8.3 m across round the altar at the cremation site, with Actian beaks. Hexastyle; drawn Ionic, pycnostyle, 9 D (P&A, after Vitruvius). Frieze of acanthus scrolls; a star in the pediment.',
    disputes: ['Ionic (P&A, coins) against Corinthian (it) or a hybrid of Ionic columns and Corinthian pilasters (en).', 'Whether the niche was walled up by 79.'],
    sources: [S.paJulius, S.caesar, S.itJulius],
  },
  {
    id: 'arch-augustus', kind: 'type', name: 'the Arch of Augustus (Parthian): three bays between Divus Julius and Castor', confidence: 'read',
    built: { from: -19, to: null }, materials: ['luna-marble', 'bronze'], methods: ['corinthian-order'], state: 'standing',
    dims: { w: 17.75, bays: [2.55, 4.05, 2.55], piers: [1.35, 2.95, 2.95, 1.35] },
    notes: 'Total 17.75 m: a vaulted central bay 4.05 m under a quadriga with Augustus, flat-lintelled side bays 2.55 m under pediments, with Parthians offering the standards (the denarii of 16 BCE). The Fasti may have hung in the side bays. Its order is not established: drawn Corinthian (unverified).',
    disputes: ['A separate single-bay Actian arch; the Actian arch enlarged (Rich); the Parthian arch north of the temple (Coarelli).'],
    sources: [S.paArchAugustus, S.darArch, S.colosseoArch, S.mqArch, S.itArch],
  },
  {
    id: 'temple-vesta', kind: 'type', name: 'the round Temple of Vesta, Nero\'s rebuild after 64', confidence: 'read',
    built: { from: 64, to: null }, materials: ['luna-marble', 'roman-concrete', 'bronze'], methods: ['corinthian-order', 'marble-cladding'], state: 'repaired',
    dims: { diameter: 15.05, cella: 8.6, columns: { n: 20, h: 4.45, D: 0.52 }, podium: { h: 3 }, order: 'corinthian' },
    notes: 'Foundation 15.05 m across; 20 columns round a cella 8.6 m inside; a conical roof with a smoke opening over the fire, acroteria (Nero\'s coin). The column numbers are the Severan rebuild\'s, kept for 79; the podium height as it reads today (unverified). The fire of Vesta burned inside.',
    disputes: ['Nero\'s temple Ionic (VRoma) or Corinthian, as the Severan.', 'The roof bronze or tiled.'],
    sources: [S.paVesta, S.vesta, S.vromaVesta, S.coinsVesta, S.colosseoVesta],
  },
  {
    id: 'atrium-vestae', kind: 'type', name: 'the House of the Vestals, Nero\'s rebuild: a court with rooms on three sides', confidence: 'secondary',
    built: { from: 64, to: null }, materials: ['fired-brick', 'roman-concrete'], methods: ['opus-testaceum'], state: 'repaired',
    dims: { court: { w: 24 } },
    notes: 'Rebuilt after 64 on a new orientation; shops and a portico on its north and east. No peristyle colonnade yet (Domitian\'s); the court shorter than the Severan 69 m.', sources: [S.paAtrium],
  },
  {
    id: 'regia', kind: 'type', name: 'the Regia: Calvinus\'s marble rebuild, small and fine', confidence: 'read',
    built: { from: -36, to: null }, materials: ['luna-marble'], methods: ['opus-quadratum'], state: 'standing',
    dims: { w: 22, d: 8 },
    notes: 'Solid white marble blocks, "small but of unusual beauty" (Dio). The trapezoidal main part about 22 × 8 m in an irregular pentagon. Tacitus\'s "destroyed" in 64 is exaggerated (the archaeology). The Fasti on its walls, or on the arch.', sources: [S.paRegia, S.darRegia],
  },
  // the north-west end
  {
    id: 'curia-julia', kind: 'type', name: 'the Curia Julia, Augustus\'s: a tall hall with a columned porch', confidence: 'secondary',
    built: { from: -29, to: null }, materials: ['roman-concrete', 'luna-marble', 'roof-tile'], methods: ['marble-cladding', 'ionic-order'], state: 'standing',
    dims: { w: 17.61, d: 25.2, h: 21 },
    notes: 'The hall 25.2 × 17.6 m (the Diocletianic building on the Augustan footprint). The coin of 28 BCE shows a front with a columned porch and a Victory on the apex. The Victory of Tarentum inside. Height about 21 m (unverified). The brick shell with its painted-block stucco is Diocletian\'s: not drawn. The porch\'s order unknown: drawn Ionic (unverified).',
    sources: [S.paCuria, S.curia],
  },
  {
    id: 'comitium', kind: 'type', name: 'the Comitium: Caesar\'s reduced assembly place, the Lapis Niger', confidence: 'read',
    built: { from: -44, to: null }, materials: ['luna-marble', 'travertine'], state: 'standing',
    notes: 'A Luna-marble pavement at 13.50 m above the sea; the black Lapis Niger in travertine; a screen on pilasters from the forum. The fountain basin and the 4th-c. bases are later.', sources: [S.paComitium],
  },
  {
    id: 'rostra-augusti', kind: 'type', name: 'the Rostra: the speakers\' platform across the square\'s north-west end, bronze beaks in two rows', confidence: 'read',
    built: { from: -42, to: null }, materials: ['cappellaccio', 'luna-marble', 'travertine', 'bronze'], methods: ['opus-quadratum'], state: 'standing',
    dims: { w: 24, d: 10, h: 3 },
    notes: 'Front about 24 m long, 10 m deep, 3 m high; tufa faced with marble, the beaks in two rows; a travertine floor; a marble balustrade with an opening in the middle; a curved stair across the whole back.',
    disputes: ['24 × 10 × 3 m (P&A) or 28.8 × 10 × 3.4 (en).'],
    sources: [S.paRostra, S.rostra],
  },
  { id: 'milliarium-aureum', kind: 'type', name: 'the Golden Milestone: a column cased in gilt bronze at the Rostra\'s end', confidence: 'read', built: { from: -20, to: null }, materials: ['luna-marble', 'bronze'], state: 'standing', dims: { D: 1.17 }, notes: 'Near Saturn, probably at the Rostra\'s south end; a marble shaft 1.17 m across on a round plinth with palmettes.', sources: [S.paMilliarium] },
  { id: 'arch-tiberius', kind: 'type', name: 'the Arch of Tiberius: one bay over the Sacra Via by the Basilica Julia', confidence: 'read', built: { from: 16, to: null }, materials: ['luna-marble'], state: 'standing', dims: { w: 9, d: 6.3 }, notes: 'For Varus\'s standards recovered. Foundations 9 × 6.3 m; reached by steps; its elevation unknown (unverified).', sources: [S.paArchTiberius] },
  // in the square
  { id: 'lacus-curtius', kind: 'type', name: 'the Lacus Curtius: a paved enclosure in the square', confidence: 'read', built: { from: -10, to: null, approx: true }, materials: ['travertine', 'luna-marble'], state: 'relic', dims: { w: 9, d: 10 }, notes: 'Trapezoidal, about 10 × 9 m, with an Augustan kerb; dry, coins thrown in.', sources: [S.paCurtius, S.arlPiazza] },
  { id: 'ficus-olea-vitis', kind: 'type', name: 'the fig, the olive and the vine, with the statue of Marsyas', confidence: 'read', built: { from: -20, to: null, approx: true }, materials: ['luna-marble', 'bronze'], state: 'standing', dims: { w: 4, d: 4 }, notes: 'An unpaved patch about 4 m square in a marble kerb near the Lacus Curtius; fig and vine wild, the olive planted for shade (Pliny); the satyr Marsyas with a wineskin on his shoulder.', sources: [S.vromaFicus] },
  // the edges
  { id: 'capitoline-jupiter', kind: 'type', name: 'the Temple of Jupiter Optimus Maximus on the Capitol, Vespasian\'s rebuild', confidence: 'read', built: { from: 75, to: null, approx: true }, materials: ['luna-marble', 'bronze'], methods: ['corinthian-order'], state: 'repaired', dims: { podium: { w: 55, d: 60 } }, notes: 'Rebuilt after the fire of December 69 on the old plan but taller; gilt-bronze roof tiles; burned again in 80. Hexastyle Corinthian; seen from the forum over the Tabularium.', disputes: ['Pentelic columns 2.1 m across: Vespasian\'s or Domitian\'s.', 'Completion date before 79 (held at 75).'], sources: [S.paJupiter] },
  { id: 'templum-pacis', kind: 'type', name: 'the Templum Pacis behind the Basilica Aemilia', confidence: 'read', built: { from: 75, to: null }, materials: ['peperino', 'luna-marble'], state: 'standing', dims: { w: 97, d: 145 }, notes: 'Dedicated by Vespasian in 75: an enclosure about 145 × 97 m, a garden with pools and statues. Mostly hidden from the forum floor.', sources: [S.paPacis, S.pacis] },
  // the square's furniture at 79: statues, columns, shrines, reliefs (Pliny's "still stands" is the anchor: NH dedicated 77)
  { id: 'octavian-equestrian', kind: 'type', name: 'the equestrian statue of Octavian on the Rostra', confidence: 'read', built: { from: -43, to: null }, materials: ['bronze'], state: 'standing', notes: 'Decreed 43 BCE; Velleius (c. 30 CE): "still standing upon the rostra", its inscription giving his age. Size unknown: drawn about life size and a quarter on a 2 m base (unverified); gilding not in the passage read.', sources: [S.velleius, S.paStatuae] },
  { id: 'sibyls-hercules', kind: 'type', name: 'the three Sibyls and the Hercules in a tunic beside the Rostra', confidence: 'read', built: { from: -66, to: null, approx: true }, materials: ['bronze'], state: 'standing', notes: 'Pliny: three Sibyls iuxta rostra, restored by Pacuvius Taurus and Messalla; the only Hercules in a tunic in Rome, Lucullus\'s booty, "next to the Rostra". Sizes and material unknown: drawn life size in bronze (unverified).', sources: [S.pliny34] },
  { id: 'columna-duilius', kind: 'type', name: 'the rostral column of Duilius', confidence: 'read', built: { from: -260, to: null }, materials: ['cappellaccio', 'bronze'], state: 'repaired', notes: 'A column studded with ships\' beaks, "still in the forum" (Pliny); its archaic inscription restored under Augustus, Tiberius or Claudius. Height unknown: drawn 8 m (unverified); no statue drawn.', disputes: ['Whether it carried a statue.'], sources: [S.paDuilius, S.pliny34] },
  { id: 'columna-octavian', kind: 'type', name: 'Octavian\'s gilded rostral column with his statue', confidence: 'read', built: { from: -36, to: null }, materials: ['luna-marble', 'bronze'], state: 'standing', notes: 'Coins of 35–28 BCE. Servius: Domitian later moved Augustus\'s beak columns to the Capitol, so they stood in the forum before him. Position unknown: drawn at the Rostra\'s south end (unverified).', sources: [S.paRostrata] },
  { id: 'ianus-geminus', kind: 'type', name: 'the shrine of Ianus Geminus at the Argiletum: a bronze passage with its doors shut', confidence: 'read', built: { from: -600, to: null, approx: true }, materials: ['bronze'], state: 'standing', dims: { statue: 2.2 }, notes: 'Small, roofless, rectangular, of bronze: grilled side walls under an entablature, double doors at each end (Procopius; Nero\'s coins); inside the two-faced Ianus, "not less than five cubits". Vespasian shut the doors (71 or 75): shut in 79.', sources: [S.paJanus, S.janus, S.pliny34] },
  { id: 'venus-cloacina', kind: 'type', name: 'the shrine of Venus Cloacina before the Basilica Aemilia', confidence: 'read', built: { from: -300, to: null, approx: true }, materials: ['cappellaccio', 'bronze'], state: 'standing', dims: { diameter: 2.4 }, notes: 'A round marble base 2.40 m across over the drain into the Cloaca Maxima; coins show a metal railing round it and two female statues.', sources: [S.paCloacina] },
  { id: 'lapis-niger', kind: 'type', name: 'the Lapis Niger: black marble paving in the Comitium', confidence: 'read', built: { from: -44, to: null, approx: true }, materials: ['coloured-marble'], state: 'relic', dims: { w: 4, d: 3 }, notes: 'Black marmor Taenarium about 4 × 3 m at the level of the Caesarian paving, edged in white marble, before the Curia\'s door.', disputes: ['Its date: Sulla, Caesar or Maxentius.'], sources: [S.paLapis] },
  { id: 'puteal-libonis', kind: 'type', name: 'the Puteal Libonis: a well-kerb over a lightning strike', confidence: 'read', built: { from: -60, to: null, approx: true }, materials: ['travertine'], state: 'standing', notes: 'Lyres and garlands on its drum (Libo\'s coins). Near the tribunal and the Arch of Fabius; the travertine kerb by the Arch of Augustus is called its remains "without any good reason": drawn there (unverified).', sources: [S.paPuteal] },
  { id: 'tribunal-praetoris', kind: 'type', name: 'the praetor\'s tribunal: a timber platform', confidence: 'read', built: { from: -200, to: null, approx: true }, materials: ['timber', 'cappellaccio'], state: 'standing', notes: '"Not monumental": a wooden platform on a stone foundation, near the Surdinus inscription. Size unknown: drawn 5.6 × 3.6 m (unverified).', sources: [S.paTribunal] },
  { id: 'surdinus-inscription', kind: 'type', name: 'the Surdinus inscription: bronze letters in the paving', confidence: 'read', built: { from: -10, to: null, approx: true }, materials: ['travertine', 'bronze'], state: 'standing', dims: { letter: 0.3 }, notes: 'L·NAEVIVS·L·F·SVRDINVS·PR (CIL VI 1468), bronze letters about 30 cm high in matrices cut into the travertine, before where the Column of Phocas will stand. Drawn as written.', disputes: ['Whether it continues INTER CIVIS ET PEREGRINOS.'], sources: [S.paTribunal, S.paForum] },
  { id: 'curtius-relief', kind: 'type', name: 'the relief of Curtius leaping into the chasm', confidence: 'read', built: { from: -10, to: null, approx: true }, materials: ['luna-marble'], state: 'standing', notes: 'A copy of a 2nd-c. BCE original; Surdinus\'s inscription on its back makes it part of his Augustan works. Mounted on the tribunal\'s or the Lacus\'s enclosure (P&A): drawn on the Lacus Curtius\'s balustrade. Size unknown: drawn 1.8 × 1.25 m (unverified).', disputes: ['Its date and its mounting.'], sources: [S.paCurtius, S.paTribunal] },
  { id: 'concord-statues', kind: 'type', name: 'Hercules and Mercury flanking Concord\'s stair', confidence: 'secondary', built: { from: 10, to: null }, materials: ['bronze'], state: 'standing', notes: 'The Tiberian sestertius of 35/36: the two at the stair, Concord, Pax and Salus on the roof (the roof drawn with its acroteria). Survival to 79 assumed: no loss recorded.', sources: [S.concord] },
  { id: 'curia-statues', kind: 'type', name: 'the Curia\'s Victory on its globe and the statues at the ends of its porch', confidence: 'secondary', built: { from: -29, to: null }, materials: ['bronze'], state: 'standing', notes: 'The denarius of 29–27 BCE: Victory on a globe on the apex, a statue at each end of the architrave.', sources: [S.coinCuria, S.curia] },
  { id: 'aemilia-captives', kind: 'type', name: 'the kneeling captives and the portrait shields on the Basilica Aemilia\'s front', confidence: 'secondary', built: { from: -2, to: null, approx: true }, materials: ['coloured-marble', 'luna-marble'], state: 'standing', notes: 'At least eighteen over-life-size kneeling Orientals in pavonazzetto and giallo antico, portrait shields (imagines clipeatae) in the parapet slabs between them. Drawn along the attic over the arcade (their exact mounting unverified).', sources: [S.aemilia] },
  { id: 'aemilia-doric-frieze', kind: 'type', name: 'the Basilica Aemilia front\'s Doric frieze: ox skulls and libation bowls', confidence: 'read', built: { from: -14, to: null, approx: true }, materials: ['luna-marble'], state: 'standing', notes: 'Bucrania and paterae alternating in the metopes (fragments).', sources: [S.paAemilia] },
  { id: 'aemilia-inner-frieze', kind: 'type', name: 'the Basilica Aemilia\'s inner frieze of Rome\'s founding', confidence: 'read', built: { from: -34, to: null, approx: true }, materials: ['greek-marble'], state: 'standing', dims: { h: 0.74, length: 90 }, notes: 'Pentelic, 74 cm high, about 90 m long, inside over the nave\'s first order: the twins, the founding, the Sabines, Tarpeia. Not seen from the square; the scene does not open the nave.', disputes: ['87–78 BCE, Caesarian or Augustan.'], sources: [S.itAemiliaFrieze, S.aemilia] },
  { id: 'divus-julius-frieze', kind: 'type', name: 'the frieze and dedication of Divus Julius', confidence: 'secondary', built: { from: -29, to: null }, materials: ['luna-marble'], state: 'standing', notes: 'A running scroll with heads, gorgons and winged figures (drawn as an acanthus scroll); DIVO IVLIO on the architrave on Augustan coins (unverified). The dedication is drawn as bronze capitals that spell no text.', sources: [S.caesar, S.paJulius] },
  { id: 'saturn-dedication', kind: 'type', name: 'Plancus\'s dedication on Saturn\'s front', confidence: 'unverified', built: { from: -42, to: null }, materials: ['luna-marble', 'bronze'], state: 'standing', notes: 'The 79 architrave carried Plancus\'s dedication; its wording is not preserved. Drawn as bronze capitals that spell no text.', sources: [S.paSaturn] },
  { id: 'fasti-arch', kind: 'type', name: 'the Fasti: the lists of consuls and triumphs', confidence: 'read', built: { from: -18, to: null, approx: true }, materials: ['luna-marble'], state: 'standing', notes: 'Four large tablets of consuls (483 BCE – 13 CE) and the triumphs on pilasters. Drawn on the Arch of Augustus\'s side bays, where most fragments were found (1546).', disputes: ['On the Regia\'s walls (P&A) or on the Parthian arch.'], sources: [S.fasti, S.paRegia, S.paArchAugustus] },
  { id: 'juturna-dioscuri', kind: 'type', name: 'the Lacus Iuturnae with the Dioscuri and their horses', confidence: 'secondary', built: { from: -117, to: null, approx: true }, materials: ['greek-marble'], state: 'standing', dims: { basin: 10, base: { h: 1.78, w: 3, d: 2 } }, notes: 'The basin about 10 m square south-east of Castor; on its central base the Dioscuri with their horses, archaistic, late 2nd c. BCE.', sources: [S.juturna, S.arlJuturna] },
  { id: 'vortumnus', kind: 'type', name: 'the bronze Vortumnus at the mouth of the Vicus Tuscus', confidence: 'secondary', built: { from: -264, to: null, approx: true }, materials: ['bronze'], state: 'standing', notes: 'By Mamurius, in a simple shrine, dressed for the season (Propertius 4.2).', sources: [S.vertumnus, S.paTuscus] },
  { id: 'caesar-loricata', kind: 'type', name: 'the cuirassed statue of the deified Caesar near his temple', confidence: 'secondary', built: { from: -29, to: null, approx: true }, materials: ['bronze'], state: 'standing', notes: 'Documents fixed to its base: the senate\'s decree for Pallas (52 CE) in bronze (Pliny the Younger). Position near Divus Julius; drawn on the square before it (unverified).', sources: [S.paStatuae] },
  // anachronisms, held at their dates
  { id: 'temple-vespasian', kind: 'type', name: 'the Temple of Vespasian and Titus', confidence: 'read', built: { from: 80, to: null, approx: true }, materials: ['luna-marble'], methods: ['corinthian-order'], state: 'standing', dims: { w: 22, d: 33, columns: { front: 6, h: 15.2, D: 1.57 } }, notes: 'Begun by Titus after the deification (late 79 at the earliest), dedicated by Domitian about 87. Held from 80: its plot below the Tabularium is open in 79.', disputes: ['"Begun 79" (en Wikipedia): not before the consecration.'], sources: [S.paVespasian, S.vespasian] },
  { id: 'consentes-portico', kind: 'type', name: 'the Porticus Deorum Consentium in its Flavian form', confidence: 'secondary', built: { from: 80, to: null, approx: true }, materials: ['coloured-marble', 'fired-brick'], state: 'standing', notes: 'Titus, Domitian or after the fire of 80; restored 367 CE.', sources: [S.paConsentes, S.consentes, S.itConsentes] },
  { id: 'equus-domitiani', kind: 'type', name: 'the equestrian statue of Domitian', confidence: 'read', built: { from: 91, to: null }, materials: ['bronze'], state: 'standing', dims: { w: 5.9, d: 11.8 }, sources: [S.paEquus] },
  { id: 'vesta-severan', kind: 'type', name: 'the Severan Temple of Vesta (the 1930 anastylosis)', confidence: 'read', built: { from: 191, to: null }, materials: ['luna-marble'], state: 'standing', sources: [S.vesta, S.vromaVesta] },
  { id: 'umbilicus', kind: 'type', name: 'the Umbilicus Urbis', confidence: 'read', built: { from: 193, to: null, approx: true }, materials: ['fired-brick'], state: 'standing', notes: '"Not earlier than the time of Severus."', sources: [S.paUmbilicus] },
  { id: 'saturn-late-porch', kind: 'type', name: 'Saturn\'s late-antique porch: granite shafts, four-faced Ionic capitals, INCENDIO CONSUMPTUM', confidence: 'read', built: { from: 283, to: null, approx: true }, materials: ['luna-marble'], state: 'standing', disputes: ['The fire 283 (Carinus) or c. 360–380.'], sources: [S.paSaturn, S.saturn, S.worldhistSaturn] },
  { id: 'curia-diocletian', kind: 'type', name: 'Diocletian\'s brick Curia', confidence: 'read', built: { from: 284, to: null, approx: true }, materials: ['fired-brick'], state: 'standing', sources: [S.paCuria, S.curia] },
  { id: 'julia-brick-piers', kind: 'type', name: 'the Basilica Julia\'s brick piers', confidence: 'read', built: { from: 284, to: null, approx: true }, materials: ['fired-brick'], state: 'standing', sources: [S.paJulia] },
];

// ── urban form ───────────────────────────────────────────────────────────────────────────────────────
const FORMS = [
  { id: 'forum-square', kind: 'form', name: 'the square: about 130 × 50 m, Rostra (north-west) to Divus Julius (south-east)', confidence: 'secondary', attested: { from: -29, to: null, approx: true }, notes: 'Travertine slabs rising from 12.60 m above the sea before Divus Julius to 14.00 m before the Rostra; the Surdinus inscription in bronze letters (c. 10 BCE) dates the paving; the Caesarian galleries under it.', sources: [S.forum, S.paForum, S.arlPiazza] },
  { id: 'sacra-via', kind: 'form', name: 'the Sacra Via, 5 m wide, along the south side of the square', confidence: 'read', attested: { from: -29, to: null, approx: true }, notes: 'Augustan pavement 5 m wide, falling from 28.30 m near the later Arch of Titus to 12.60 m at Divus Julius; past Castor and the Basilica Julia to Saturn and the Clivus Capitolinus. Nero realigned the upper stretch after 64.', sources: [S.paSacraVia] },
  { id: 'vicus-tuscus', kind: 'form', name: 'the Vicus Tuscus, between the Basilica Julia and Castor', confidence: 'read', attested: { from: -500, to: null, approx: true }, notes: 'South toward the Velabrum and the Circus; the Vortumnus statue.', sources: [S.paTuscus] },
  { id: 'vicus-iugarius', kind: 'form', name: 'the Vicus Iugarius, between the Basilica Julia and Saturn', confidence: 'read', attested: { from: -500, to: null, approx: true }, sources: [S.darJulia] },
  { id: 'clivus-capitolinus', kind: 'form', name: 'the Clivus Capitolinus, climbing from the forum past Saturn to the Capitol', confidence: 'secondary', attested: { from: -500, to: null, approx: true }, sources: [S.paSaturn, S.paSacraVia] },
  { id: 'capitoline-backdrop', kind: 'form', name: 'the Capitoline at the west: the Tabularium wall, the Capitolium above it', confidence: 'read', attested: { from: -78, to: null, approx: true }, notes: 'The gallery about 15 m over the forum; the rebuilt Temple of Jupiter above.', sources: [S.paTabularium, S.paJupiter] },
  { id: 'palatine-edge', kind: 'form', name: 'the Palatine slope behind Castor and Vesta', confidence: 'unverified', attested: { from: -500, to: null, approx: true }, notes: 'The Domus Tiberiana substructures and the post-64 terraces along the Clivus Victoriae; the Domus Flavia unbuilt.', sources: [S.snippets] },
  { id: 'festival-dressing', kind: 'form', name: 'the forum dressed for a procession: gilded shields on the bankers\' fronts, garlands', confidence: 'secondary', attested: { from: -308, to: null, approx: true }, notes: 'Livy 9.40.16: the Samnite gilded shields given to the bankers\' shops to adorn the forum, whence the aediles\' custom of decorating it when the tensae are led. A denarius of c. 61 BCE shows the Basilica Aemilia hung with shields. Garlands on temple fronts on feast days (unverified). Awnings over the forum are Republican one-offs (Caesar 46, Marcellus 23 BCE: Pliny 19.23–24): not drawn. Not an ordinary day: the scene draws it only when asked (`festival`). Summer 79 occasions: the Ludi Apollinares (6–13 July), the transvectio equitum past Castor (15 July), Vespasian\'s funeral (after 23 June).', sources: [S.livy940, S.paAemilia, S.pliny19] },
  { id: 'excavated-forum', kind: 'form', name: 'the excavated, roofless forum', confidence: 'read', attested: { from: 1803, to: null, approx: true }, sources: [S.forum] },
];

export const FORUM_RECORD = [...MATERIALS, ...METHODS, ...TYPES, ...FORMS];
export const FORUM_SOURCES = S;
