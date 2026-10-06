/**
 * The record for Hellenistic LINDOS on Rhodes — the town under the sanctuary of Athena Lindia, read at
 * c. 180 BCE (LINDOS_YEAR = −180). Format and checks: ../record.js.
 *
 * `confidence` says how far each entry is checked: 'read' = the cited source was read directly (for web
 * pages: fetched and read through a page summary); 'secondary' = reached through a page that names the
 * source, or a search summary of one; 'unverified' = the standard account, not confirmed here. None of the
 * excavation reports (Blinkenberg & Kinch, Lindos I–II; Dyggve, Lindos III, 1960; Lippolis 1988) was read:
 * every figure attributed to them comes through later pages. Building dims in m; colours are estimates.
 *
 * WHY −180. Every main monument of the sanctuary stands by then: the temple of Athena Lindia rebuilt
 * after the fire of 392/391 BCE (c. 300 BCE), the propylaia and grand stair (first half / mid 3rd c BCE),
 * the great Hellenistic stoa with its two wings (late 3rd c, "c. 200 BCE"), the theatre on the west slope
 * (4th c BCE), the Archokrateion (c. 225 BCE) — and Pythokritos' ship relief and the rock-cut exedra are
 * dated "c. 180 BCE", so −180 is the first year the whole climb looks as the generator should draw it.
 * Later years only add things that are wrong for a Hellenistic scene (the vaulted terrace extension of the
 * late 1st c BCE, the Lindian Chronicle of 99 BCE, Roman shrines); earlier years lose the ship relief.
 * Note −180 sits on approximate dates: the relief's "c. 180" is a scholarly estimate.
 *
 * CHRONOLOGY (approx: true throughout): archaic temple and walls under Kleoboulos, mid 6th c BCE · Pindar
 * Olympian 7 (fireless sacrifices) 464 BCE · synoikism of Rhodes city 408/7 BCE · temple fire 392/391 BCE
 * (Lindian Chronicle; Wikipedia's temple page says 342 — disputed) · new temple c. 300 · propylaia and
 * stair first half of the 3rd c (Pakkanen: mid 3rd c) · Hellenistic walls 3rd c · earthquake of c. 227/226
 * (Lippolis: cleared the summit for the stoa) · great stoa late 3rd c / c. 200 · ship relief and exedra c.
 * 180 · Roman alliance 164 · Lindian Chronicle 99 BCE · terrace vaults late 1st c BCE.
 *
 * ANACHRONISMS the generator must not use at −180 (each is in the record with its real date, so `inUseAt`
 * excludes it): the Lindian Chronicle stele (99 BCE); the vaulted SE extension of the stoa terrace (late
 * 1st c BCE); the Ionic stoa of Psithyros (2nd c CE); the Roman temple of the imperial cult (c. 300 CE);
 * the Byzantine church of St John on the acropolis (12th–14th c CE); the Knights' castle and its walls and
 * towers (before 1317 CE) and Ottoman bastions; the white cubic village houses, the 16th–17th c captains'
 * houses and their black-and-white pebble ("choklaki") courtyards; WHITEWASH as a town colour (modern
 * Lindos is white; no ancient evidence makes Hellenistic Lindos white — do not whitewash it); the Italian
 * restorations of 1936–40 (re-erected stoa columns, concrete and steel joints, rebuilt temple walls) and
 * the restoration since 1985. And: NO FIRE ON ATHENA'S ALTAR (see apyra-hiera).
 */

// ── sources ──────────────────────────────────────────────────────────────────────────────────────────
import { GREEK_DRESS } from './dress-greek.js';
const S = {
  wikiLindos: { author: 'Wikipedia', title: 'Lindos', year: 2026, url: 'https://en.wikipedia.org/wiki/Lindos', via: 'read; secondary to the works it cites' },
  wikiTemple: { author: 'Wikipedia', title: 'Temple of Athena Lindia (citing Strabo 14.2.10–11, Pindar Ol. 7, Philostratus Imagines 2.27)', year: 2026, url: 'https://en.wikipedia.org/wiki/Temple_of_Athena_Lindia', via: 'read; secondary to the works it cites' },
  wikiChronicle: { author: 'Wikipedia', title: 'Lindos Chronicle (citing Blinkenberg 1912; Higbie 2003)', year: 2026, url: 'https://en.wikipedia.org/wiki/Lindos_Chronicle', via: 'read; secondary to the works it cites' },
  pindar: { author: 'Pindar', title: 'Olympian 7 (for Diagoras of Rhodes), lines c. 39–53, Perseus Digital Library text', year: -464, url: 'https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.01.0162:book=O.:poem=7', via: 'read (through a page summary)' },
  philostratus: { author: 'Philostratus the Elder', title: 'Imagines 2.27 (the birth of Athena: Rhodian fireless sacrifices)', year: 220, via: 'Wikipedia "Temple of Athena Lindia" and a search summary; not read' },
  pakkanen: { author: 'J. Pakkanen', title: 'The Column Shafts of the Propylaia and Stoa in the Sanctuary of Athena at Lindos (Proceedings of the Danish Institute at Athens 2, 146–159)', year: 1998, url: 'https://tidsskrift.dk/pdia/article/view/17245', via: 'abstract read' },
  dyggve: { author: 'E. Dyggve', title: 'Lindos III: Le sanctuaire d\'Athana Lindia et l\'architecture lindienne', year: 1960, via: 'not read; through Pakkanen 1998 and web summaries' },
  blinkenberg: { author: 'C. Blinkenberg, K. F. Kinch', title: 'Lindos: fouilles et recherches 1902–1914, I–II', year: 1931, via: 'not read; through Wikipedia and web summaries' },
  lippolis: { author: 'E. Lippolis', title: 'Il santuario di Athana a Lindo (ASAtene 66–67)', year: 1988, via: 'search summary only' },
  agOrg: { author: 'ancient-greece.org', title: 'Lindos Acropolis (web page; year = accessed)', year: 2026, url: 'https://ancient-greece.org/archaeology/lindos-acropolis/', via: 'read' },
  madain: { author: 'Madain Project', title: 'Acropolis of Lindos (web page; year = accessed)', year: 2026, url: 'https://madainproject.com/acropolis_of_lindos', via: 'read; secondary to the Greek Ministry of Culture texts it follows' },
  roamin: { author: 'Roamin\' the Empire', title: 'Lindus, Asiana — Part I (web page; year = accessed)', year: 2026, url: 'https://www.roamintheempire.com/index.php/2022/09/07/lindus-part-i/', via: 'read' },
  lrStair: { author: 'lindos-rhodes.gr', title: 'Lindos Acropolis Staircase (web page; year = accessed)', year: 2026, url: 'https://lindos-rhodes.gr/lindos-acropolis/lindos-acropolis-staircase/', via: 'read' },
  lrPropylaia: { author: 'lindos-rhodes.gr', title: 'The Propylaia at Lindos Acropolis (web page; year = accessed)', year: 2026, url: 'https://lindos-rhodes.gr/lindos-acropolis/the-propylaia-at-lindos-acropolis/', via: 'read' },
  goldenTheatre: { author: 'golden-greece.gr', title: 'Ancient Theater of Lindos (web page, after the Ministry of Culture text; year = accessed)', year: 2026, url: 'https://golden-greece.gr/en/archaeological/dodekanisa/rodos/arxaio-theatro-lindou', via: 'read' },
  theatreSummary: { author: 'Greek Ministry of Culture (Odysseus)', title: 'Ancient theatre of Lindos', year: 2026, via: 'search summary only (odysseus.culture.gr unreachable)' },
  kastra: { author: 'kastra.eu', title: 'Acropolis of Lindos — Greek Castles (web page; year = accessed)', year: 2026, url: 'https://www.kastra.eu/castleen.php?kastro=lindos', via: 'read' },
  mcgilchrist: { author: 'N. McGilchrist', title: 'McGilchrist\'s Greek Islands: Rhodes (via ToposText "Kleoboulos tomb")', year: 2010, url: 'https://topostext.org/place/361281FKle', via: 'read' },
  archokrateion: { author: 'travel-rhodes.com', title: 'The Archokrateion (web page; year = accessed)', year: 2026, url: 'https://www.travel-rhodes.com/page.php?page_id=33', via: 'read' },
  archokrateionDate: { author: 'Greek Ministry of Culture (via tourism pages)', title: 'Archokrateion, Lindos', year: 2026, via: 'search summary only' },
  restoration: { author: 'Archaeology Wiki', title: 'Reconstruction work on the Acropolis of Lindos in Rhodes', year: 2026, url: 'https://www.archaeology.wiki/blog/issue/reconstruction-work-on-the-acropolis-of-lindos-in-rhodes/', via: 'read' },
  rhodesHouses: { author: 'various (Austrian Academy volume on Hellenistic house decoration; Rhodes mosaic summaries)', title: 'Hellenistic houses and pebble mosaics of Rhodes city and Ialysos', year: 2026, url: 'https://www.austriaca.at/0xc1aa5576_0x00245272.pdf', via: 'search summary only' },
  plateau: { author: 'various tourism pages (rhodestravelguide.gr, aegeanislands.gr)', title: 'Acropolis of Lindos: 116 m, c. 8400 m²', year: 2026, via: 'search summary only' },
  lrZeus: { author: 'lindos-rhodes.gr', title: 'The Acropolis of Lindos and its divine role in ancient Greek religion', year: 2026, url: 'https://lindos-rhodes.gr/acropolis-of-lindos-and-greek-religion/', via: 'search summary only' },
  shipWarships: { author: 'Wikipedia', title: 'Hellenistic-era warships (trihemiolia; Lindos relief)', year: 2026, url: 'https://en.wikipedia.org/wiki/Hellenistic-era_warships', via: 'search summary only' },
  standard: { author: 'standard account', title: 'Greek Hellenistic building practice (Doric order, stucco over poros, tiled timber roofs)', year: 2026, via: 'not confirmed for Lindos in any source in hand' },
};

/** The year the scene reads the record at (BCE negative). */
export const LINDOS_YEAR = -180;

// ── materials ────────────────────────────────────────────────────────────────────────────────────────
const MATERIALS = [
  {
    id: 'lindian-limestone', kind: 'material', name: 'local Lindian limestone (the acropolis rock and the building stone)', confidence: 'secondary',
    attested: { from: -900, to: null, approx: true, where: ['the acropolis headland itself', 'temple, propylaia, stoa, stair, walls', 'rock-cut theatre seats and tombs'] },
    supply: 'quarried and cut on the spot: the stair, the theatre, the ship relief and the tombs are cut in the living rock',
    role: ['structure', 'wall', 'foundation', 'paving'], colour: ['#c9b996', '#b8a685', '#d8cba9', '#a49a88'],
    notes: 'The acropolis is a steep limestone headland (search summaries). The stair is described as of poros limestone blocks and rock-cut steps (lindos-rhodes.gr, read). Whether the temple and stoa used the hard grey rock or a softer local poros is not confirmed here; the hexes are estimates — warm buff for dressed building stone, the last one the weathered grey of the cliff.',
    sources: [S.lrStair, S.agOrg, S.blinkenberg],
  },
  {
    id: 'lardos-stone', kind: 'material', name: 'Lardian stone ("Lardos marble"): fine blue-grey limestone from Lardos, ~6 km SW', confidence: 'secondary',
    attested: { from: -350, to: null, approx: true, where: ['the round "Tomb of Kleoboulos"', 'statue bases and inscribed blocks (standard account)'] },
    supply: 'quarried at Lardos and carted to Lindos',
    role: ['finish', 'ornament', 'wall'], colour: ['#8f9398', '#a2a5a8', '#7e848b'],
    notes: 'McGilchrist (read): the Kleoboulos tomb is of well-finished blocks of Lardos "marble". That Rhodian statue bases and inscriptions are commonly of this stone is the standard account, unconfirmed here. Start date ties to the earliest dating of the tomb.',
    sources: [S.mcgilchrist],
  },
  {
    id: 'imported-marble', kind: 'material', name: 'imported white marble (statuary, inscribed slabs, fine details)', confidence: 'unverified',
    attested: { from: -550, to: null, approx: true, where: ['statues and votives of the sanctuary', 'inscribed slabs (the Lindian Chronicle of 99 BCE is a marble slab)'] },
    supply: 'shipped from the Aegean marble islands (source quarries not confirmed)',
    role: ['ornament', 'finish'], colour: ['#ece9e2', '#f3f0e9', '#e0dbd0'],
    notes: 'Marble is attested at Lindos for the Chronicle stele (Wikipedia, read) — an anachronism at −180 as a monument, but proof of the material. lindos-rhodes.gr says the propylaia is "of limestone and marble" (read) without saying which parts. Treat marble as for statues, votives and inscriptions; do NOT build the temple or stoa of marble. Use for architectural members is conjecture.',
    sources: [S.wikiChronicle, S.lrPropylaia],
  },
  {
    id: 'lime-stucco', kind: 'material', name: 'lime plaster / fine stucco over limestone', confidence: 'unverified',
    attested: { from: -550, to: null, approx: true, where: ['Archokrateion interior (plaster panels between pillars)', 'stuccoed column shafts and walls (standard Greek practice)'] },
    supply: 'lime burnt in kilns from local limestone',
    role: ['finish'], colour: ['#ece5d4', '#f1ebdf', '#e3dac6'],
    notes: 'The Archokrateion\'s chamber has pillars alternating with plaster panels (travel-rhodes, read). Stuccoing the sanctuary\'s Doric members is the standard account for Hellenistic limestone architecture, unconfirmed at Lindos. Stucco is warm off-white, not modern whitewash white.',
    sources: [S.archokrateion, S.standard],
  },
  {
    id: 'terracotta-tile', kind: 'material', name: 'terracotta roof tiles (Corinthian/Laconian type uncertain)', confidence: 'unverified',
    attested: { from: -600, to: null, approx: true, where: ['temple, stoa and propylaia roofs (assumed)', 'house roofs'] },
    supply: 'local kilns',
    role: ['roof'], colour: ['#b0623e', '#9c5434', '#c27352'],
    notes: 'No source in hand describes the roofs of the Lindos buildings. Pitched tiled roofs over Doric buildings are the standard account; the tile system (Corinthian pan-and-cover vs Laconian) is unknown. Marble tiles on the temple are not attested — do not use.',
    sources: [S.standard],
  },
  {
    id: 'timber', kind: 'material', name: 'timber roof framing, doors, ceilings', confidence: 'unverified',
    attested: { from: -900, to: null, approx: true, where: ['roofs of temple, stoa, propylaia and houses'] },
    supply: 'Rhodian pine and imported timber (not confirmed)',
    role: ['structure', 'roof'], colour: ['#7a5a3c', '#8b6a48'],
    notes: 'Standard account; nothing survives. Rhodes was famous for shipbuilding timber, unconfirmed here.',
    sources: [S.standard],
  },
  {
    id: 'bronze', kind: 'material', name: 'bronze (portrait statues, dedicated arms, fittings)', confidence: 'secondary',
    attested: { from: -900, to: null, approx: true, where: ['bronze statue of Hagesandros on the ship relief', 'statues on the acropolis bases and exedrae', 'Geometric bronze oxen at the Boukopion'] },
    supply: 'cast in Rhodian workshops',
    role: ['ornament'], colour: ['#8c6a3a', '#6f7a5a', '#a3804a'],
    notes: 'The ship relief was the base for a bronze statue of Hagesandros son of Mikion (ancient-greece.org, read). The acropolis carried many statue bases; most of those statues were bronze (standard account). Hexes: fresh bronze, green patina, polished.',
    sources: [S.agOrg, S.madain],
  },
  {
    id: 'mudbrick-socle', kind: 'material', name: 'sun-dried mud brick on stone socles (house walls)', confidence: 'secondary',
    attested: { from: -900, to: null, approx: true, where: ['Hellenistic houses of Rhodes city and Ialysos (analogy for Lindos)'] },
    supply: 'local clay; stone socle of rubble or ashlar',
    role: ['wall'], colour: ['#9a7c5a', '#a88a66'],
    notes: 'Search summary on Rhodian Hellenistic houses: stone foundations, upper parts of sun-dried brick, walls plastered in plain colours, often two storeys. No Hellenistic house at Lindos itself is described in any source in hand — Lindos houses are by analogy.',
    sources: [S.rhodesHouses],
  },
  {
    id: 'pebble-mosaic', kind: 'material', name: 'Hellenistic pebble mosaic floors (white figures on dark ground)', confidence: 'secondary',
    attested: { from: -350, to: null, approx: true, where: ['andrones of Hellenistic houses in Rhodes city'] },
    supply: 'beach pebbles set in mortar, outlines sometimes in lead strip',
    role: ['paving', 'ornament'], colour: ['#e8e4da', '#3d4650', '#8a6a4a'],
    notes: 'Rhodes is known for Hellenistic pebble mosaics: white pebbles on a dark bluish ground, mostly in men\'s dining rooms (search summary). For a rich Lindos house only, inside, not in streets. NOT the post-medieval Lindian "choklaki" pebble courtyards (see choklaki-courtyards).',
    sources: [S.rhodesHouses],
  },
  {
    id: 'whitewash-modern', kind: 'material', name: 'lime whitewash over whole house fronts — MODERN Lindos, not Hellenistic', confidence: 'unverified',
    attested: { from: 1600, to: null, approx: true, where: ['the modern village'] },
    supply: 'lime wash',
    role: ['finish'], colour: ['#f7f7f4'],
    notes: 'The white village is the modern image of Lindos. No source in hand gives whitewashed house exteriors for the Hellenistic town; dated here (approx, conjecturally) with the post-medieval village. ANACHRONISM TRAP at −180.',
    sources: [S.standard],
  },
  {
    id: 'reinforced-concrete', kind: 'material', name: 'reinforced concrete and steel dowels (Italian restoration)', confidence: 'read',
    attested: { from: 1936, to: null, where: ['joints of re-erected stoa columns and temple walls'] },
    supply: 'modern',
    role: ['structure'], colour: ['#9e9b94'],
    notes: 'Italian restorers used reinforced concrete in the joints; the corroding iron damaged the stones (Archaeology Wiki, read). ANACHRONISM.',
    sources: [S.restoration],
  },
];

// ── methods ──────────────────────────────────────────────────────────────────────────────────────────
const METHODS = [
  {
    id: 'ashlar-masonry', kind: 'method', name: 'squared ashlar masonry (isodomic / pseudo-isodomic courses)', confidence: 'unverified',
    attested: { from: -550, to: null, approx: true }, materials: ['lindian-limestone'],
    notes: 'The Kleoboulos tomb is of "well-finished blocks, regular in form, but not of identical size" with drafted corners (McGilchrist, read) — i.e. carefully coursed ashlar. That the sanctuary buildings are isodomic or pseudo-isodomic is the standard account, not confirmed.',
    sources: [S.mcgilchrist, S.standard],
  },
  {
    id: 'rock-cutting', kind: 'method', name: 'cutting into the living rock (steps, seats, reliefs, tombs, cisterns)', confidence: 'read',
    attested: { from: -900, to: null, approx: true }, materials: ['lindian-limestone'],
    notes: 'Read: the grand stair\'s 35 steps cut into the natural rock (lindos-rhodes.gr); most theatre seats carved in the rock, some built (golden-greece/Ministry); the ship relief and semicircular exedra rock-cut (Madain, Roamin); the Archokrateion a rock-cut false-façade tomb (travel-rhodes). Inscriptions cut on the rocks of the Boukopion.',
    sources: [S.lrStair, S.goldenTheatre, S.madain, S.archokrateion],
  },
  {
    id: 'stucco-over-poros', kind: 'method', name: 'stucco skin over limestone members', confidence: 'unverified',
    attested: { from: -550, to: null, approx: true }, materials: ['lime-stucco', 'lindian-limestone'],
    notes: 'Standard for Doric architecture in coarse local stone; attested at Lindos only as plaster panels in the Archokrateion. Conjecture for the temple and stoa.',
    sources: [S.archokrateion, S.standard],
  },
  {
    id: 'terracing-analemmata', kind: 'method', name: 'terracing on retaining walls (analemmata) and vaulted substructures', confidence: 'secondary',
    attested: { from: -550, to: null, approx: true }, materials: ['lindian-limestone'],
    notes: 'The sanctuary rises in terraces: stoa terrace, stair, upper court. Below the stoa terrace lie two cistern complexes (Madain). The vaulted terrace extension (14 vaults, ~45 m) is late 1st c BCE (see terrace-vaults) — at −180 the lower terrace is held by retaining walls, not by those vaults. The theatre\'s side retaining walls are built (golden-greece).',
    sources: [S.madain, S.roamin, S.goldenTheatre],
  },
  {
    id: 'doric-order', kind: 'method', name: 'the Doric order (fluted shafts with entasis, triglyph-and-metope frieze)', confidence: 'read',
    attested: { from: -550, to: null, approx: true }, materials: ['lindian-limestone'],
    notes: 'Temple Doric (ancient-greece.org, Wikipedia, read); stoa Doric (Madain, read); propylaia Doric, two orders of ~4.9 m (façade) and ~4.6 m (courtyard) (Pakkanen, read); the stoa shafts have slight entasis (Pakkanen). The Archokrateion façade carries triglyphs and metopes. The Ionic order on the acropolis is Roman (Psithyros stoa): keep the Hellenistic sanctuary Doric.',
    sources: [S.agOrg, S.wikiTemple, S.madain, S.pakkanen, S.archokrateion],
  },
  {
    id: 'tiled-timber-roof', kind: 'method', name: 'pitched timber roof covered with terracotta tiles', confidence: 'unverified',
    attested: { from: -600, to: null, approx: true }, materials: ['timber', 'terracotta-tile'],
    notes: 'Standard account for temple, stoa wings, propylaia and houses; unconfirmed at Lindos.',
    sources: [S.standard],
  },
  {
    id: 'mudbrick-on-socle', kind: 'method', name: 'house walls of mud brick on a stone socle, plastered', confidence: 'secondary',
    attested: { from: -550, to: null, approx: true }, materials: ['mudbrick-socle', 'lindian-limestone', 'lime-stucco'],
    notes: 'By analogy with Rhodes city and Ialysos (search summary).',
    sources: [S.rhodesHouses],
  },
  {
    id: 'apyra-hiera', kind: 'method', name: 'FIRELESS sacrifices (apyra hiera) to Athena Lindia — no fire on her altar', confidence: 'read',
    attested: { from: -464, to: null, approx: true }, materials: [],
    notes: 'Pindar, Olympian 7 (464 BCE, read through a summary): the Heliadai founded the precinct on the acropolis with fireless offerings, having forgotten to bring fire up; Zeus rained gold on them. Philostratus (Imagines 2.27, secondary) contrasts Rhodian fireless offerings with Athenian burnt ones. GENERATOR RULE: put fire in house hearths, kitchens, lamps, kilns and forges — never a burning fire or smoke on Athena\'s altar. The date is Pindar\'s; the rite is older by the myth. Other cults may differ: Zeus Polieus shared the acropolis (cult said to date from the 3rd c BCE; his rites are not described in any source in hand), and the Boukopion ("ox-slaughter place") below was a sacrificial site — fire there is neither attested nor excluded.',
    disputes: ['Whether "fireless" meant bloodless offerings (cakes, fruit) or animal sacrifice without burning; one Wikipedia summary muddles Philostratus as describing burnt entrails. Either way: no fire on Athena\'s altar.'],
    sources: [S.pindar, S.philostratus, S.wikiTemple],
  },
];

// ── building types ───────────────────────────────────────────────────────────────────────────────────
const STONE = ['lindian-limestone'];
const TYPES = [
  {
    id: 'athena-temple', kind: 'type', name: 'temple of Athena Lindia (amphiprostyle tetrastyle Doric, rebuilt after the fire of 392/391 BCE)', confidence: 'secondary',
    built: { from: -300, to: null, approx: true }, materials: ['lindian-limestone', 'lime-stucco', 'timber', 'terracotta-tile'], methods: ['ashlar-masonry', 'doric-order', 'stucco-over-poros', 'tiled-timber-roof'],
    dims: { length: 21.65, width: 7.75, frontColumns: 4, porches: 2 },
    notes: 'Four Doric columns at each end (amphiprostyle tetrastyle): pronaos, cella, opisthodomos (Madain). 21.65 × 7.75 m (Wikipedia) ≈ "22 × 8 m" (ancient-greece.org, Madain). Stands at the highest point of the summit at its southern cliff edge, over St Paul\'s bay. Column height not found: any value is conjecture. Cult statue: a standing Athena with shield and polos (4th c), probably over life-size (Wikipedia). Its predecessor was the Archaic temple of Kleoboulos (see archaic-temple).',
    disputes: ['Fire: 392/391 BCE (Lindian Chronicle via Wikipedia "Lindos Chronicle") vs 342 BCE (Wikipedia "Temple of Athena Lindia").', 'New temple "c. 300 BCE" (Wikipedia Lindos) vs "4th or early 3rd c" (ancient-greece.org) vs "late 4th c" (Madain).'],
    sources: [S.wikiTemple, S.wikiLindos, S.agOrg, S.madain, S.dyggve],
  },
  {
    id: 'athena-altar', kind: 'type', name: 'altar of Athena Lindia in the temple court — UNLIT (fireless rite)', confidence: 'unverified',
    built: { from: -464, to: null, approx: true }, materials: STONE, methods: ['apyra-hiera'],
    notes: 'The altar\'s position and form are not described in any source in hand (conjecture: in the upper court before the temple\'s east front). It carries offerings, garlands and votives, never flame or smoke. See apyra-hiera.',
    sources: [S.pindar, S.wikiTemple],
  },
  {
    id: 'archaic-temple', kind: 'type', name: 'Archaic temple of Athena (Kleoboulos) — burned 392/391 BCE', confidence: 'secondary',
    built: { from: -550, to: -392, approx: true }, materials: STONE,
    notes: 'Built in the 6th c BCE, probably under Kleoboulos; destroyed by fire 392/391 BCE (Lindian Chronicle via Wikipedia). Not standing at −180.',
    disputes: ['Fire 392/391 vs 342 BCE (see athena-temple).'],
    sources: [S.wikiTemple, S.wikiChronicle],
  },
  {
    id: 'propylaia', kind: 'type', name: 'propylaia: Π-shaped Doric portico with five doorways into the temple court', confidence: 'secondary',
    built: { from: -275, to: null, approx: true }, materials: ['lindian-limestone', 'imported-marble', 'timber', 'terracotta-tile'], methods: ['ashlar-masonry', 'doric-order', 'tiled-timber-roof'],
    dims: { facadeColumnHeight: 4.9, courtColumnHeight: 4.6, doorways: 5, northColumns: 22, southColumns: 17 },
    notes: 'At the head of the grand stair; a Π-shaped portico of 22 columns on the north, 17 columns making a γ-shaped stoa on the south, a wall with five doorways into the temenos (lindos-rhodes.gr, read). Two Doric orders: façade ~4.9 m, courtyard ~4.6 m (Pakkanen, read; ~0.3 m above Dyggve). Overall width not found: take it from the stair (~21 m), conjecture.',
    disputes: ['Date: 4th c BCE (Wikipedia Lindos) vs first half of the 3rd c (Madain/Ministry) vs mid 3rd c (Pakkanen). Here −275.', 'Plan described as "D-shaped", "U-shaped" and "Π-shaped" in different summaries.'],
    sources: [S.lrPropylaia, S.pakkanen, S.madain, S.wikiLindos, S.dyggve],
  },
  {
    id: 'grand-stair', kind: 'type', name: 'grand stairway from the stoa terrace up to the propylaia', confidence: 'secondary',
    built: { from: -275, to: null, approx: true }, materials: STONE, methods: ['rock-cutting', 'terracing-analemmata'],
    dims: { width: 21, steps: 35 },
    notes: '21 m wide, 35 steps, partly cut in the rock, partly of poros blocks (lindos-rhodes.gr, read). Rises through the middle of the great stoa, whose column line continues across its foot (search summary). Riser height not found (conjecture ~0.25–0.3 m).',
    disputes: ['Built with the propylaia (first half 3rd c) or with the stoa (c. 200; kastra.eu says "2nd c BCE")?'],
    sources: [S.lrStair, S.madain, S.kastra],
  },
  {
    id: 'great-stoa', kind: 'type', name: 'great Hellenistic stoa with two projecting wings, flanking the grand stair', confidence: 'secondary',
    built: { from: -200, to: null, approx: true }, materials: ['lindian-limestone', 'lime-stucco', 'timber', 'terracotta-tile'], methods: ['ashlar-masonry', 'doric-order', 'stucco-over-poros', 'tiled-timber-roof', 'terracing-analemmata'],
    dims: { length: 87, columns: 42, wings: 2 },
    notes: 'Doric, 42 columns, about 87 m long (Wikipedia; Madain says ~89 m); a long front with lateral projecting wings, the two roofed halves symmetrical either side of the stair, the colonnade carried across the stair\'s foot. Shafts with slight entasis (Pakkanen). Depth, column height and wing extents are NOT in any source in hand — conjecture. At −180 it is twenty years old; the vaulted terrace to the SE is not yet built.',
    disputes: ['Length 87 m vs ~89 m.', 'Date: "c. 200" (Wikipedia) vs "late 3rd c" (Madain, Pakkanen); Lippolis ties it to rebuilding after the earthquake of c. 227/226.'],
    sources: [S.wikiLindos, S.madain, S.kastra, S.pakkanen, S.lippolis],
  },
  {
    id: 'stoa-cisterns', kind: 'type', name: 'cisterns under the stoa terrace (two groups of five)', confidence: 'secondary',
    built: { from: -200, to: null, approx: true }, materials: ['lindian-limestone', 'lime-stucco'], methods: ['rock-cutting'],
    dims: { groups: 2, perGroup: 5, capacityM3: 300 },
    notes: 'Two complexes of five cisterns each, ~300 m³ in all (Madain); hidden below the lower terrace (Roamin). Date assumed with the stoa terrace (conjecture). Invisible in a view except for draw-heads.',
    sources: [S.madain, S.roamin],
  },
  {
    id: 'ship-relief', kind: 'type', name: 'rock-cut relief of a warship\'s stern (trihemiolia) by Pythokritos, base of the bronze statue of Hagesandros', confidence: 'secondary',
    built: { from: -180, to: null, approx: true }, materials: ['lindian-limestone', 'bronze'], methods: ['rock-cutting'],
    dims: { length: 5 },
    notes: 'Cut in the rock face at the foot of the stair up to the acropolis; signed by Pythokritos son of Timocharis; carried a bronze statue of Hagesandros son of Mikion (ancient-greece.org, read). Usually called a trireme; the ship is a trihemiolia (Roamin, Madain). ~5 m long (search summary). Traces of red paint (Madain): render the stern painted. Height not found.',
    disputes: ['"c. 180 BCE" (Wikipedia, Madain) vs "2nd c BCE" (ancient-greece.org).', 'Trireme vs trihemiolia.'],
    sources: [S.agOrg, S.wikiLindos, S.madain, S.roamin, S.shipWarships],
  },
  {
    id: 'rock-exedra', kind: 'type', name: 'rock-cut semicircular votive exedra beside the ascent', confidence: 'secondary',
    built: { from: -180, to: null, approx: true }, materials: STONE, methods: ['rock-cutting'],
    notes: 'c. 180 BCE (Madain); a metrical inscription for Aglochartos was added in the 3rd–4th c CE — omit that text at −180. Size not found.',
    sources: [S.madain, S.roamin],
  },
  {
    id: 'statue-bases', kind: 'type', name: 'statue bases and exedrae crowding the terraces', confidence: 'unverified',
    built: { from: -550, to: null, approx: true }, materials: ['lindian-limestone', 'bronze', 'imported-marble'],
    notes: 'The acropolis is full of inscribed bases for bronze honorific and votive statues (standard account; Blinkenberg\'s Lindos II publishes the inscriptions). Later (4th c on) bases are often of Lardian stone (see lardos-stone; standard account). Numbers and positions at −180 are conjecture: scatter them along the climb and terraces.',
    sources: [S.blinkenberg, S.madain],
  },
  {
    id: 'acropolis-walls-hellenistic', kind: 'type', name: 'Hellenistic circuit wall of the acropolis with rectangular towers', confidence: 'secondary',
    built: { from: -250, to: null, approx: true }, materials: STONE, methods: ['ashlar-masonry'],
    notes: 'A Hellenistic wall with rectangular towers, c. 3rd c BCE (Madain); fortifications of the 3rd c BCE (Roamin). Line and height not found: follow the cliff edge where the rock is not sheer, and the landward (NW/W) approach. The present walls are the Knights\' (see knights-castle).',
    disputes: ['Exact date within the 3rd c BCE unknown.'],
    sources: [S.madain, S.roamin],
  },
  {
    id: 'acropolis-walls-archaic', kind: 'type', name: 'Archaic fortification of the acropolis (Kleoboulos)', confidence: 'secondary',
    built: { from: -550, to: null, approx: true }, materials: STONE,
    notes: 'Mid 6th c BCE, attributed to the tyrant Kleoboulos (Madain, Roamin). Probably incorporated into or replaced by the Hellenistic wall; render only the Hellenistic circuit.',
    sources: [S.madain, S.roamin],
  },
  {
    id: 'theatre', kind: 'type', name: 'theatre at the foot of the acropolis\' west slope, seats mostly rock-cut', confidence: 'read',
    built: { from: -350, to: null, approx: true }, materials: STONE, methods: ['rock-cutting', 'terracing-analemmata'],
    dims: { lowerRows: 19, upperRows: [6, 7], cunei: 9, stairs: 8, diazomaWidth: 2.15, capacity: [1800, 2000] },
    notes: 'Below the temple, on the (south)west side. 19 rows in the lower cavea, most rock-cut, some built with the end cunei and side retaining walls; a 2.15 m passage (diazoma); an upper cavea of 6 (or 7) more steeply raked rows; nine cunei, eight stairs; circular orchestra; 1,800–2,000 spectators; 4th c BCE; tied to the Sminthia festival of Dionysos Smintheus (Ministry text via golden-greece, read). Diameter not found: conjecture from rows.',
    disputes: ['Upper cavea 6 rows (Ministry summary) vs 7 (golden-greece).'],
    sources: [S.goldenTheatre, S.theatreSummary],
  },
  {
    id: 'tetrastoon', kind: 'type', name: 'tetrastoon by the theatre: rectangular court colonnaded on four sides', confidence: 'secondary',
    built: { from: -250, to: null, approx: true }, materials: ['lindian-limestone', 'timber', 'terracotta-tile'], methods: ['ashlar-masonry', 'tiled-timber-roof'],
    notes: '3rd c BCE; columns on four sides round an open court, a pedimented/arched entrance on the NW; perhaps for the cult of Dionysos Smintheus; held ~1,600 people (golden-greece, read; "four-story" there is a mistranslation of tetrastoon). The arch is suspect for a 3rd-c date — omit it (conjecture). Dimensions not found.',
    sources: [S.goldenTheatre],
  },
  {
    id: 'boukopion', kind: 'type', name: 'Boukopion: open-air sacrificial place on the rocks NE of the acropolis', confidence: 'secondary',
    built: { from: -900, to: null, approx: true }, materials: STONE, methods: ['rock-cutting'],
    notes: 'Identified by 38 rock-cut inscriptions; votives from the 10th–9th c BCE including bronze and clay oxen (search summary). No building: inscribed rock, perhaps a small enclosure. Whether fire was used here is not stated.',
    sources: [S.madain, S.blinkenberg],
  },
  {
    id: 'kleoboulos-tomb', kind: 'type', name: '"Tomb of Kleoboulos": Hellenistic round drum tomb on the cape of the great northern harbour', confidence: 'read',
    built: { from: -300, to: null, approx: true }, materials: ['lardos-stone'], methods: ['ashlar-masonry'],
    dims: { diameter: 9, heightPreserved: 1.7 },
    notes: 'A circular monument ~9 m across, ~1.7 m preserved, of fine Lardian-stone ashlar with drafted corners at the entrance; 4th or 3rd c BCE by its masonry — nothing to do with the Archaic sage (McGilchrist, read). A vaulted roof and rock-cut burial bed inside are reported (search summary). Later the church of Agios Aimilianos (cross over the door — omit at −180). Original height unknown: conjecture a drum with a low conical or stepped cover.',
    disputes: ['Date 4th–3rd c BCE (McGilchrist) vs 2nd–1st c BCE (other summaries); if the later date is right it is absent at −180.', 'Tomb vs tower base/lighthouse (McGilchrist notes the resemblance).'],
    sources: [S.mcgilchrist],
  },
  {
    id: 'archokrateion', kind: 'type', name: 'Archokrateion: two-storey rock-cut false-façade family tomb at Krana, west of the acropolis', confidence: 'secondary',
    built: { from: -225, to: null, approx: true }, materials: ['lindian-limestone', 'lime-stucco'], methods: ['rock-cutting', 'doric-order', 'stucco-over-poros'],
    dims: { storeys: 2, graves: 19 },
    notes: 'Ground storey: Doric half-columns, architrave, triglyphs and metopes; upper storey: pillars alternating with blind openings; inscribed altars on the façade; inside a ritual chamber with pillars and plaster panels, 19 graves (travel-rhodes, read). Built for Archokrates, priest of Athena in 225 BCE; last quarter of the 3rd c (search summary). Present at −180. Façade size not found. Its medieval name "Frangokklesia" (a Knights-era church) is later.',
    sources: [S.archokrateion, S.archokrateionDate],
  },
  {
    id: 'lindos-house', kind: 'type', name: 'Hellenistic courtyard house (peristyle for the rich) on terraces below the acropolis', confidence: 'unverified',
    built: { from: -350, to: null, approx: true }, materials: ['mudbrick-socle', 'lindian-limestone', 'lime-stucco', 'timber', 'terracotta-tile', 'pebble-mosaic'], methods: ['mudbrick-on-socle', 'tiled-timber-roof', 'terracing-analemmata'],
    notes: 'No excavated Hellenistic house at Lindos in any source in hand. By analogy with Rhodes city and Ialysos: compact peristyle with an emphasised rear portico (the "Rhodian peristyle"), often two storeys, mud-brick upper walls on stone footings, plastered in plain colours, pebble mosaics in the andron (search summary). Ordinary houses: a court with rooms on one or two sides. Plaster colours and sizes are conjecture. Hearths, braziers and lamps go here.',
    sources: [S.rhodesHouses],
  },
  {
    id: 'harbour-installations', kind: 'type', name: 'harbour beaches and landings in the two bays', confidence: 'unverified',
    built: { from: -900, to: null, approx: true }, materials: STONE,
    notes: 'No harbour works are described in any source in hand. Ships were drawn up or moored in the great northern bay and the small southern bay (St Paul\'s). Any mole or quay is conjecture.',
    sources: [S.wikiLindos],
  },

  // ── anachronisms: later than −180 ──
  {
    id: 'terrace-vaults', kind: 'type', name: 'vaulted SE extension of the stoa terrace (14 vaults) — NOT at −180', confidence: 'secondary',
    built: { from: -25, to: null, approx: true }, materials: STONE, methods: ['terracing-analemmata'],
    dims: { length: 45, vaults: 14 },
    notes: 'Late 1st c BCE: vaults running ~45 m to the SE, with a break ~15 m along for a staircase (Roamin); terrace extension with fourteen vaults, 1st c BCE (Madain).',
    sources: [S.roamin, S.madain],
  },
  {
    id: 'lindian-chronicle', kind: 'type', name: 'the Lindian Chronicle stele — NOT at −180', confidence: 'read',
    built: { from: -99, to: null }, materials: ['imported-marble'],
    dims: { height: 2.4, width: 0.9 },
    notes: 'Inscribed marble slab of 99 BCE, ~8 × 3 ft, listing past dedications to Athena and her epiphanies; set up in the sanctuary; found 1904 reused as paving in the Byzantine church of St Stephen near the theatre (Wikipedia, read).',
    sources: [S.wikiChronicle],
  },
  {
    id: 'psithyros-stoa', kind: 'type', name: 'Ionic stoa/shrine of Psithyros in the upper court — Roman, NOT at −180', confidence: 'secondary',
    built: { from: 150, to: null, approx: true }, materials: STONE,
    dims: { depth: [4, 4.6], columns: [5, 7], columnHeight: 4.26 },
    notes: '2nd c CE; south edge of the upper court between propylaia and temple; Ionic; an inscribed base of c. 200 CE names Seleukos, who built a temple of the oracular daimon Psithyros (search summary, Madain).',
    sources: [S.madain],
  },
  {
    id: 'roman-temple', kind: 'type', name: 'Roman temple of the imperial cult (Diocletian?) — NOT at −180', confidence: 'secondary',
    built: { from: 300, to: null, approx: true }, materials: STONE,
    notes: 'c. 300 CE, possibly for Diocletian (Wikipedia Lindos; Roamin says 3rd c CE).',
    sources: [S.wikiLindos, S.roamin],
  },
  {
    id: 'church-st-john', kind: 'type', name: 'Byzantine church of St John on the acropolis — NOT ancient', confidence: 'secondary',
    built: { from: 1200, to: null, approx: true }, materials: STONE,
    notes: 'Cross-in-square church; 12th–13th c (Madain) or 13th–14th c (Wikipedia); perhaps over a 6th c basilica.',
    disputes: ['12th/13th vs 13th/14th c CE.'],
    sources: [S.madain, S.wikiLindos],
  },
  {
    id: 'knights-castle', kind: 'type', name: 'castle of the Knights of St John: walls and towers round the summit — NOT ancient', confidence: 'read',
    built: { from: 1309, to: null, approx: true }, materials: STONE,
    notes: 'Built 1309–1317 on Byzantine foundations: pentagonal tower on the south over the harbour, large round tower on the east, two more on the NE (kastra.eu, read). Ottoman bastions added 16th–17th c (Madain). Its walls and the Grand Master\'s palace now frame the stair — none of it exists at −180.',
    sources: [S.kastra, S.wikiLindos, S.madain],
  },
  {
    id: 'captains-houses', kind: 'type', name: 'white cubic village houses and 16th–17th c captains\' houses — NOT ancient', confidence: 'unverified',
    built: { from: 1600, to: null, approx: true }, materials: ['whitewash-modern', 'lindian-limestone'],
    notes: 'The post-medieval village with its whitewashed walls, carved stone doorways and sea-captains\' mansions (standard account; dates not confirmed here). ANACHRONISM: do not use their massing, colour or details for the Hellenistic town.',
    sources: [S.standard],
  },
  {
    id: 'choklaki-courtyards', kind: 'type', name: 'black-and-white pebble ("choklaki") courtyards and lanes — NOT ancient', confidence: 'unverified',
    built: { from: 1600, to: null, approx: true }, materials: ['lindian-limestone'],
    notes: 'Post-medieval Lindian paving (standard account). Not the Hellenistic pebble mosaic (see pebble-mosaic), which was an indoor floor.',
    sources: [S.standard],
  },
  {
    id: 'italian-restoration', kind: 'type', name: 'Italian restoration (re-erected stoa columns, rebuilt temple, concrete joints) — NOT ancient', confidence: 'read',
    built: { from: 1936, to: null }, materials: ['reinforced-concrete', 'lindian-limestone'],
    notes: '1936–40 (Laurenzi, Paolini): 21 of 42 stoa columns re-erected, walls completed, terrace and east vaults rebuilt; reinforced concrete and iron; elements of one monument wrongly placed in another (Archaeology Wiki read; search summary). Greek restoration from 1985 (more stoa columns and entablature). The look of today\'s stoa is a restoration.',
    sources: [S.restoration, S.madain],
  },
];

// ── urban form ───────────────────────────────────────────────────────────────────────────────────────
const FORMS = [
  {
    id: 'acropolis-sea-cliff', kind: 'form', name: 'acropolis on a sheer sea cliff ~116 m high, summit plateau ~8,400 m²', confidence: 'secondary',
    attested: { from: -900, to: null, approx: true },
    notes: '116 m (ancient-greece.org, read); ~8,400 m² (search summary). The rock falls sheer to the sea on the east and south; the only approach is from the town on the north-west. Plateau shape roughly triangular (conjecture from plans).',
    sources: [S.agOrg, S.plateau],
  },
  {
    id: 'town-between-harbours', kind: 'form', name: 'town on the saddle and slopes below the acropolis, between a large northern bay and the small enclosed southern bay of St Paul', confidence: 'secondary',
    attested: { from: -900, to: null, approx: true },
    notes: 'Lindos sits on a large bay (Wikipedia); St Paul\'s bay lies on the other side of the acropolis (search summary): a near-circular cove almost closed by rocks. The "Tomb of Kleoboulos" crowns the northern cape of the great harbour (McGilchrist). Bay shapes and the town\'s extent at −180 are conjecture beyond this.',
    sources: [S.wikiLindos, S.mcgilchrist, S.plateau],
  },
  {
    id: 'terraced-streets', kind: 'form', name: 'terraced streets and stepped lanes up the slope', confidence: 'unverified',
    attested: { from: -550, to: null, approx: true },
    notes: 'Implied by the site (houses on a hillside, theatre and tombs cut into slopes); no ancient street plan of Lindos is in hand. Do not copy the modern village lanes.',
    sources: [S.standard],
  },
  {
    id: 'axial-climb', kind: 'form', name: 'axial climb: ship relief at the foot → stoa terrace → grand stair through the stoa → propylaia → upper court → temple at the cliff edge', confidence: 'secondary',
    attested: { from: -200, to: null, approx: true },
    notes: 'The Hellenistic sanctuary is a staged ascent: the ship relief at the foot of the steps, the wide lower terrace with the winged stoa, the 21 m stair rising through the stoa\'s centre, the propylaia\'s five doors, the court (temenos) and the temple on the summit\'s edge above the sea (Madain, Roamin, lindos-rhodes.gr, Wikipedia). Complete from c. 200 BCE.',
    sources: [S.madain, S.lrStair, S.lrPropylaia, S.wikiLindos],
  },
  {
    id: 'necropoleis-west', kind: 'form', name: 'rock-cut tombs on the hills west of the town (Krana)', confidence: 'secondary',
    attested: { from: -300, to: null, approx: true },
    notes: 'The Archokrateion at Krana/Kampana on the hill west of the acropolis (travel-rhodes) — other rock-cut tombs nearby are the standard account.',
    sources: [S.archokrateion],
  },
  {
    id: 'whitewashed-village', kind: 'form', name: 'the white village of tight cubic houses — MODERN, not Hellenistic', confidence: 'unverified',
    attested: { from: 1600, to: null, approx: true },
    notes: 'The present townscape. ANACHRONISM TRAP: Hellenistic Lindos had stone-and-mud-brick houses with plaster in plain colours and tiled roofs (by analogy), not a white flat-roofed cubist village.',
    sources: [S.standard],
  },
];

export const LINDOS_RECORD = [...MATERIALS, ...METHODS, ...TYPES, ...FORMS, ...GREEK_DRESS];
export const LINDOS_SOURCES = S;
