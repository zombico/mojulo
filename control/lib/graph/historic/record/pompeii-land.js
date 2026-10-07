/**
 * The record of Pompeii's land and works, read at 79 CE: the villas of the slopes and the Sarno plain (Villa Regina
 * and the Villa della Pisanella at Boscoreale, the press of the Villa of the Mysteries), the vineyard inside the walls,
 * and the town's workshops (the bakeries and their donkey mills, the fullery, the fish-sauce works, the tannery, the
 * dyers, the potters outside the gates, a building site, a smithy), with the carts and the stable of Civita Giuliana.
 * Format and checks: ../record.js. Spread into Pompeii's record (./pompeii.js); the farm and works scenes read it.
 *
 * `confidence` as Pompeii's: 'read' = a fetched page stated it (through a model summary of the page, so numbers were
 * read back, not seen in the original); 'secondary' = a search snippet or a page citing the source; 'unverified' =
 * the standard account. A building attested IN USE at the eruption whose building date no page gave is held from 79
 * (`built.from: 79`, its notes say so), never back-dated; a conversion after the earthquake is held from 62.
 *
 * Not found on any page (and so not drawn as fact): the threshing floor's area, the press bed's and the lever's
 * sizes, the mills' and ovens' sizes, the Pisanella's dolia, the kilns' sizes, ploughing oxen, a tile works.
 */

// ── sources ─────────────────────────────────────────────────────────────────────────────────────────────────────
const W = (title) => ({ author: 'Wikipedia', title, year: 2026, url: `https://en.wikipedia.org/wiki/${title.replace(/ /g, '_')}`, via: 'read' });
const PIP = (title, path) => ({ author: 'Pompeii in Pictures', title, year: 2026, url: `https://pompeiiinpictures.com/pompeiiinpictures/${path}`, via: 'read' });
const S = {
  sitesRegina: { author: 'Parco Archeologico di Pompei (Pompeii Sites)', title: 'Villa Regina, Boscoreale', year: 2026, url: 'https://pompeiisites.org/en/boscoreale-en/villa-regina-boscoreale/', via: 'read' },
  wesuvio: { author: 'Wesuvio', title: 'Villa Regina, ovvero la villa rustica di Boscoreale', year: 2026, url: 'https://www.wesuvio.it/villa-regina-ovvero-la-villa-rustica-di-boscoreale/', via: 'read' },
  reginaPlan: PIP('Villa Regina, Boscoreale: plan (after De Caro 1994)', 'RV/villa%20regina%20boscoreale%20plan.htm'),
  reginaP8: PIP('Villa Regina, Boscoreale p8', 'RV/villa%20regina%20boscoreale%20p8.htm'),
  boscoreale: W('Villa Boscoreale'),
  pisanella: PIP('Boscoreale, Villa della Pisanella p1', 'VF/Villa_013%20Boscoreale%20Villa%20della%20Pisanella%20p1.htm'),
  mysteries: PIP('Villa of the Mysteries p13', 'rv/villa%20mysteries%20p13.htm'),
  mysteriesW: W('Villa of the Mysteries'),
  vineyardP2: PIP('II.5.5 the vineyard p2', 'R2/2%2005%2005%20p2.htm'),
  vineyardP7: PIP('II.5.5 the vineyard p7', 'R2/2%2005%2005%20p7.htm'),
  conversation: { author: 'The Conversation', title: 'Pompeii is famous for its ruins and bodies, but what about its wine?', year: 2020, url: 'https://theconversation.com/pompeii-is-famous-for-its-ruins-and-bodies-but-what-about-its-wine-147011', via: 'read' },
  pompeii: W('Pompeii'),
  centenary: W('House of the Centenary'),
  modestus: PIP('VII.1.36 Bakery of Modestus', 'R7/7%2001%2036.htm'),
  priscus: PIP('VII.2.22 Bakery of Popidius Priscus', 'R7/7%2002%2022.htm'),
  whMills: { author: 'World History Encyclopedia', title: 'Roman Mills', year: 2026, url: 'https://www.worldhistory.org/article/907/roman-mills/', via: 'read' },
  millstone: W('Millstone'),
  bakeryPrison: PIP('IX.10.1 bakery', 'R9/9%2010%2001.htm'),
  stephanus: { author: 'Pompeii Online', title: 'Fullonica of Stephanus (I.6.7)', year: 2026, url: 'https://www.pompeionline.net/en/buildings-and-places/regio-i/fullonica-of-stephanus-i-6-7', via: 'read' },
  fullo: W('Fullo'),
  garum: PIP('I.12.8 House and workshop of the garum p2', 'R1/1%2012%2008%20p2.htm'),
  scaurus: W('Aulus Umbricius Scaurus'),
  tannery: PIP('I.5.2 Tannery p5', 'R1/1%2005%2002%20p5.htm'),
  tanneryPompei: { author: 'pompei.it', title: 'The tannery', year: 2026, url: 'https://www.pompei.it/excavations/tannery.htm', via: 'read' },
  dyers: PIP('VII.2.11 Dyers\' workshop of Ubonius', 'R7/7%2002%2011.htm'),
  cnrsPotters: { author: 'CNRS News', title: 'Tracing back the potters of Pompeii', year: 2026, url: 'https://news.cnrs.fr/articles/tracing-back-the-potters-of-pompeii', via: 'read' },
  clayFire: { author: 'Clay and Fire (blog)', title: 'The potters of Pompeii', year: 2015, url: 'https://drojkent.wordpress.com/2015/08/22/the-potters-of-pompeii/', via: 'read' },
  mitLime: { author: 'MIT News', title: 'Pompeii offers insights into ancient Roman building technology', year: 2025, url: 'https://news.mit.edu/2025/pompeii-offers-insights-ancient-roman-building-technology-1209', via: 'read' },
  smithy: PIP('I.6.1 workshop of Tyrsus p2', 'R1/1%2006%2001%20p2.htm'),
  pilentum: { author: 'ClassiCult', title: 'Civita Giuliana: ecco il carro cerimoniale dalla villa suburbana', year: 2021, url: 'https://www.classicult.it/civita-giuliana-ecco-il-carro-cerimoniale-dalla-villa-suburbana/', via: 'read' },
  horse: { author: 'Parco Archeologico di Pompei (Pompeii Sites)', title: 'Intact cast of a horse created for the first time at Pompeii', year: 2018, url: 'https://pompeiisites.org/en/press-kit-en/intact-cast-of-a-horse-created-for-the-first-time-at-pompeii/', via: 'read' },
  slaves: { author: 'Parco Archeologico di Pompei (Pompeii Sites)', title: 'The room of the slaves, the latest discovery at Civita Giuliana', year: 2022, url: 'https://pompeiisites.org/en/comunicati/the-room-of-the-slaves-the-latest-discovery-at-civita-giuliana/', via: 'read' },
};

const span = (from, o = {}) => ({ from, to: null, approx: true, ...o });
const t = (id, name, built, confidence, sources, notes, o = {}) => ({ id, name, kind: 'type', built, confidence, sources, notes, state: 'standing', ...o });   // all working at the eruption
const m = (id, name, attested, confidence, sources, notes, o = {}) => ({ id, name, kind: 'method', attested, confidence, sources, notes, ...o });
const f = (id, name, attested, confidence, sources, notes, o = {}) => ({ id, name, kind: 'form', attested, confidence, sources, notes, ...o });

// ── the farm: the villa rustica ────────────────────────────────────────────────────────────────────────────────
const FARM = [
  f('pl-villa-court', 'villa rustica round an open court', span(-100), 'read', [S.sitesRegina, S.reginaPlan],
    'Villa Regina: rooms on three sides of an open courtyard behind a wide arcade, an upper floor, a granary for hay, cereals and beans, and an uncovered barnyard. Built in the 1st c. BCE, enlarged under Augustus and the Julio-Claudians, working in 79.'),
  t('pl-villa-regina', 'Villa Regina, a small wine farm', span(-100), 'read', [S.sitesRegina, S.wesuvio, S.reginaPlan],
    'About 450 m² (one page). Rooms on the plan: I the cella vinaria, IX the treading room with a Bacchus painting, IXbis the press room, XVII the threshing terrace, VIII a barn with a pergola, II the kitchen with a brick oven, the lararium, XIV the entrance.',
    { dims: { area: 450 } }),
  t('pl-cella-vinaria', 'cella vinaria: dolia sunk to the shoulder in the yard', span(-100), 'read', [S.reginaPlan, S.boscoreale, S.sitesRegina],
    'At Villa Regina 18 dolia holding some 10,000 litres together, sunk in the ground under the arcade. (A page summary once gave these to the Pisanella; they are Villa Regina\'s.)',
    { dims: { dolia: 18, litres: 10000 } }),
  t('pl-press-room', 'treading room and press room (calcatorium, torcularium)', span(-100), 'read', [S.reginaPlan, S.sitesRegina, S.mysteries, S.mysteriesW],
    'The grapes trodden in one room, pressed in the next: the remains of the wooden press, a pressing tank and a must vat at Villa Regina. The Villa of the Mysteries\' press beam (a ram\'s head at its end: a lever press) stands reconstructed in place. No page gave the beam\'s or the bed\'s size.'),
  t('pl-threshing-terrace', 'threshing terrace', span(-100), 'read', [S.reginaPlan],
    'Villa Regina\'s XVII. Its area is on no page read: drawn at a conjectured size.'),
  t('pl-villa-vineyard', 'the villa\'s vineyard on stakes', span(-100), 'read', [S.reginaP8],
    'Round Villa Regina some 250 vine-root cavities and 120 stake cavities (Jashemski); the lane beside it rutted at 1.32 m, the gauge of the cart found in the villa.',
    { dims: { vines: 250, stakes: 120, gauge: 1.32 } }),
  t('pl-pisanella', 'Villa della Pisanella, a wine and oil farm with a bakery and a stable', span(-100), 'read', [S.pisanella, S.boscoreale],
    'A 39.70 × 25.50 m rectangle (about 1,000 m²): a pars urbana with baths, the grape press, an olive-press room with a trapetum, the cella vinaria, a bakery with its mill and oven, a stable (horse skeletons), a covered crop store and perhaps an open threshing area; some 24 ha of vines reckoned from its cellar.',
    { dims: { w: 39.7, d: 25.5 }, disputes: 'Some give it to L. Caecilius Iucundus; others do not.' }),
  t('pl-trapetum', 'trapetum: the olive mill', span(-100), 'read', [S.pisanella],
    'Two crushing wheels (orbes) of Vesuvian lava, traces of their wooden hubs, in the Pisanella\'s olive-press room.'),
  t('pl-town-vineyard', 'the vineyard inside the walls (II.5)', span(-100), 'read', [S.vineyardP2, S.vineyardP7, S.conversation],
    'A whole insula of vines on stakes, with two triclinia; at the back a two-room building with a lever press and ten dolia. Not a cattle market (the bones say so).',
    { dims: { vines: 2014, dolia: 10 }, disputes: 'The vines: 2,001 root cavities (p7) or 2,014 vines and as many stakes (p2).' }),
  f('pl-crops', 'the crops of the territory', span(-100), 'read', [S.pompeii, S.centenary],
    'Barley, wheat and millet; wine and oil for export; emmer, chickpeas, broad beans, olives, figs, onions and garlic among the finds. A vine-clad mountain in the House of the Centenary\'s lararium (whether Vesuvius is debated).'),
  m('pl-vines-staked', 'vines trained on stakes', span(-100), 'read', [S.vineyardP2, S.reginaP8],
    'The vineyards inside and outside the walls stood on stakes.'),
  m('pl-arbustum', 'vines trained up trees, fruit trees among them', span(-100), 'secondary', [S.vineyardP7],
    'The trees among the vines of II.5 (57 tree-root cavities); training on trees is from a search snippet only.'),
  m('pl-lever-press', 'the lever press', span(-100), 'read', [S.mysteries, S.conversation],
    'A long beam pulled down onto the bagged pulp; the Villa of the Mysteries\' beam and the town vineyard\'s press.'),
];

// ── the works ───────────────────────────────────────────────────────────────────────────────────────────────────
const WORKS = [
  t('pl-pistrinum', 'pistrinum: a bakery with donkey mills and a domed oven', span(79), 'read', [S.modestus, S.priscus, S.pompeii],
    'Held from 79: baking at the eruption (81 loaves in Modestus\' sealed oven), their building dates not given. Modestus (VII.1.36) and Popidius Priscus (VII.2.22) each had four mills and a stall for the beasts that turned them. At least 31 bakeries in the town.',
    { dims: { mills: 4 }, disputes: 'Popidius Priscus is named from the house next door; an inscription names an Epagatus.' }),
  m('pl-donkey-mill', 'mola asinaria: the hourglass mill turned by a donkey', span(79), 'read', [S.whMills, S.millstone, S.bakeryPrison],
    'An hourglass catillus over a conical meta, both of volcanic stone, turned by a donkey in a wooden frame, or by men. At IX.10.1 notches cut in the paving round each mill paced the beast and the slave. Heights (to 1.5 m) from a snippet only.'),
  t('pl-fullonica', 'fullonica: vats, treading stalls and a press', span(62), 'read', [S.stephanus, S.fullo],
    'Stephanus (I.6.7), a house turned fullery after 62: three rinsing vats and five treading stalls at the back, the impluvium made a basin, the atrium roof a drying terrace, a large cloth press by the door.',
    { dims: { vats: 3, stalls: 5 }, disputes: 'Eleven fulleries (Fullo) or eighteen washing works (Pompeii).' }),
  m('pl-fulling', 'cloth trodden in stalls with urine and earth, rinsed and pressed', span(62), 'read', [S.fullo]),
  t('pl-garum-works', 'fish-sauce works: dolia of garum', span(79), 'read', [S.garum, S.scaurus],
    'I.12.8: six dolia, five in one room and one in the peristyle, five with anchovy bones in them; working in 79. Umbricius Scaurus\' name is on a third of the fish-sauce jars of Pompeii and Herculaneum.',
    { dims: { dolia: 6 } }),
  t('pl-tannery', 'tannery: round vats sunk in the floor', span(62), 'read', [S.tannery, S.tanneryPompei],
    'I.5.2, a house made a tannery after 62: fifteen round vats lined with cocciopesto, 1.25–1.60 m across and 1.40–1.50 m deep, each with a sunk centre and two footholds to climb out.',
    { dims: { vats: 15, across: 1.5, deep: 1.45 }, disputes: 'Named for M. Vesonius Primus; graffiti name a Xulmus.' }),
  t('pl-dyers', 'dyers\' works: lead kettles over fireboxes', span(79), 'read', [S.dyers, S.pompeii],
    'Ubonius (VII.2.11): nine lead kettles set in masonry over fireboxes in the peristyle; nine dyers in the town. Held from 79.',
    { dims: { kettles: 9 } }),
  t('pl-pottery', 'potters\' workshops outside the gates', span(62), 'read', [S.cnrsPotters, S.clayFire],
    'Outside the Herculaneum Gate (cooking pots, goblets) and the Nocera Gate (lamps in moulds, small jars; set up after 62): four kilns between them, rectangular chambers with a projecting firebox and a vaulted, vented top.',
    { dims: { kilns: 4 }, disputes: 'Both working in 79 (CNRS), or the Nocera works under repair (its excavators).' }),
  t('pl-building-site', 'a building site: quicklime heaped with ash, a wall half-built', span(79), 'read', [S.mitLime],
    'Caught in 79: dry heaps of quicklime premixed with volcanic ash, a wall half up, the tools. No lime kiln has been found at Pompeii.'),
  m('pl-hot-mixing', 'hot-mixing: quicklime mixed dry with volcanic ash', span(79), 'read', [S.mitLime]),
  t('pl-smithy', 'a smith\'s forge', span(79), 'read', [S.smithy],
    'I.6.1, a forge with back rooms; the smith\'s name (Tyrsus) is the page\'s title only. Held from 79.'),
];

// ── carts and stables ──────────────────────────────────────────────────────────────────────────────────────────
const TRANSPORT = [
  t('pl-cart', 'the farm cart (plaustrum)', span(-100), 'read', [S.reginaP8],
    'Villa Regina\'s cart, its wheels 1.32 m apart; the town\'s usual gauge 1.42 m (the House of Menander\'s cart) is from snippets. The plaustrum as an ox wagon: a snippet.',
    { dims: { gauge: 1.32 } }),
  t('pl-stable', 'a villa stable with harnessed horses', span(79), 'read', [S.horse, S.slaves],
    'Civita Giuliana: three equids; the cast horse some 150 cm at the withers in an iron harness with bronze studs; the trough of something perishable. Beside it a 16 m² room of three rope beds, a chest of harness and a carriage shaft.'),
  t('pl-pilentum', 'a ceremonial carriage (pilentum)', span(79), 'read', [S.pilentum],
    'Civita Giuliana, 700 m north of the walls, in a portico by the stable: four tall iron wheels, a light box of bronze panels between wood painted red and black.'),
];

export const POMPEII_LAND_RECORD = [...FARM, ...WORKS, ...TRANSPORT];
export const POMPEII_LAND_SOURCES = S;
