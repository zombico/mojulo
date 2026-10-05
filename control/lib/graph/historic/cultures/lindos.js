/**
 * Hellenistic Lindos (Rhodes, read at c. 180 BCE — ../record/lindos.js `LINDOS_YEAR`) as a composition of
 * shared patterns (../patterns.js). The first culture on a SEA CLIFF: the sanctuary of Athena Lindia on a
 * rock ~116 m over the water, the town on the saddle below between two bays. Read as it stood:
 *  - the temple, the propylaia, the stoa and the great stair in stuccoed Lindian limestone under red tile
 *    roofs (stucco and tile are standard Greek practice, not confirmed at Lindos: conjecture);
 *  - the town of plastered courtyard houses on terraces, NOT the white cubic village (whitewash is modern);
 *  - NO fire on Athena's altar: her sacrifices were fireless (apyra hiera). Fire burns in the town.
 * Laid out by ../layouts/lindos.js ('acropolis'). The same layout with `site.cliff: false` is the
 * generic Hellenistic polis (`polis` below): a town under a gentle acropolis hill.
 */
import { LINDOS_ASSETS } from '../assets/lindos.js';
import { LINDOS_YEAR, LINDOS_RECORD, LINDOS_SOURCES } from '../record/lindos.js';

const PALETTE = {
  ground: '#b9a684',            // the hillside: thin stony soil over limestone, garrigue
  rock: '#c9b996',              // Lindian limestone, the summit and the cut rock
  sand: '#d6c49a',              // the beaches
  cliff: '#a49a88',             // the same rock weathered grey on the cliff faces
  scree: '#bdb29c',             // the fallen rock at the cliffs' feet
  lane: '#a9967a',              // the town's streets: beaten earth and rock
  street: '#b5a283',
  paving: '#cbbf9f',            // the sanctuary's paving
  court: '#d3c8ad',
  field: ['#9c9a5a', '#a7a064', '#b0a86e', '#8f8c50'],
  olive: '#6f7a4c',
  sea: '#1f5f86',               // the open Aegean
  shallows: '#3f9aa0',          // over sand and rock by the shore
  stucco: '#ece5d4',            // fine lime stucco over the limestone (the temple, the stoa: conjecture)
  limestone: '#c9b996', lardos: '#8f9398', marble: '#ece9e2',
  plaster: '#d9cdb2',           // the houses' lime plaster: warm, not white
  socle: '#b8a685',
  tile: '#b0623e', tileDark: '#9c5434',
  timber: '#6e5038', bronze: '#8c6a3a', linen: '#e9e0c8',
  triglyph: '#3d4f74',          // painted Doric detail (conjecture: colour as at better-preserved sites)
  red: '#9a3b2b',
  hull: '#3a3530', ram: '#8c6a3a',
  door: '#2a2420',
};

export const LINDOS = {
  label: 'Hellenistic Lindos',
  years: [-200, -150],
  readAt: LINDOS_YEAR,           // c. 180 BCE (../record/lindos.js)
  period: 'Hellenistic',
  place: 'Lindos, Rhodes',
  region: 'greece',
  aliases: ['rhodes', 'acropolis', 'athena lindia', 'aegean town'],   // what people call it (search)
  record: { id: 'lindos', entries: LINDOS_RECORD, sources: LINDOS_SOURCES },   // the encyclopedia entry's basis
  layout: 'acropolis',
  palette: PALETTE,
  skins: {
    kinds: {
      cliff: 'bedrock', 'terrace-wall': 'drystone', 'rock-cut': 'bedrock',
      crepis: 'isodomic', cella: 'poros-stucco', entablature: 'poros-stucco', 'door-wall': 'poros-stucco', 'stoa-wall': 'isodomic',
      'retaining-wall': 'isodomic', 'acropolis-wall': 'isodomic', tower: 'isodomic', skene: 'isodomic', analemma: 'isodomic',
      house: 'lime-plaster', socle: 'drystone', tomb: 'isodomic', kiln: 'mud-plaster',
    },
  },
  patterns: ['acropolis', 'sea-cliff', 'terraced-hillside', 'classical-order', 'tile-roof', 'stoa', 'propylon', 'theatre', 'peristyle', 'courtyard-house', 'blank-wall', 'stone-ashlar', 'rock-relief', 'statue-base', 'round-tomb', 'altar', 'kiln', 'boat'],
  // the site, metres: the rock, its two levels, the sea
  site: { cliff: true, summit: 106, upper: 116, sea: -6, waterZ: -0.4, terrace: 3 },
  // the orders and the buildings (../record/lindos.js; heights not in the record are conjecture, marked so)
  temple: { w: 7.75, d: 21.65, column: 5.2 },        // 21.65 × 7.75 (record); column height conjecture
  propylaia: { w: 54, d: 20, column: 4.9 },          // Π-shaped, 5 doors; façade columns 4.9 m (Pakkanen); plan size conjecture
  stoa: { w: 87, d: 12, wing: 8, columns: 42, column: 4.6 },   // 87 m, 42 columns (record); depth, wings and column height conjecture
  stair: { w: 21, steps: 35 },                       // 21 m wide, 35 steps (record)
  theatre: { rows: 26, w: 56, d: 40 },               // 19 + 7 rows (record); diameter conjecture
  house: { size: [9, 15], gap: 0.4 },
  // the sea on the World page: clear Aegean water (the native aqua look), turquoise where it is thin over sand
  water: { look: { kind: 'lagoon', tint: '#3fb0bd', nAmp: 0.2, shore: 0.8 }, bed: '#c9b48a' },
  groves: { density: 0.35, max: 160 },
  assets: LINDOS_ASSETS,
};

/**
 * The generic Hellenistic polis: Lindos' kit and layout on a gentle acropolis hill with no cliff — the
 * shape most Greek towns had. Its landmarks (the ship relief, the round tomb) stay Lindos' own.
 */
export const POLIS = {
  ...LINDOS,
  label: 'A Hellenistic polis (generic)',
  place: null,                   // invented: Lindos' kit on a gentle hill, no real town
  region: 'greece',
  aliases: ['greek town', 'polis', 'hellenistic city'],
  // history (../lineage.js): the generic town of Lindos' world, on its layout and kit
  draws: [{ from: 'lindos', kind: 'variant', parts: ['palette', 'skins', 'patterns', 'assets', 'layout', 'record'], note: 'a generic Hellenistic town on Lindos\' layout and kit' }],
  site: { ...LINDOS.site, cliff: false, summit: 46, upper: 52 },
  landmarks: false,
};
