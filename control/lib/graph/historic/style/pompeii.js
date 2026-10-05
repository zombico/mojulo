/**
 * The POMPEII style card: how the town should LOOK on a summer morning of 79 CE, as principles, as the kit's
 * design language (the numbers every piece is built from) and as the light and sky the page reads. The design
 * brief and the reference drawings: docs/historic/pompeii/README.md. The facts behind the numbers:
 * ../record/pompeii.js. Machine checks in ../style.test.js, on the kit until the layout exists.
 *
 * The palette is estimated from the record's materials until the reference swatch sheet is made; it is not sampled.
 */
export const POMPEII_STYLE = Object.freeze({
  id: 'pompeii',
  principles: Object.freeze([
    'The temple rules the forum from its podium: raised above the eye, entered by one stair at the front only, under a pediment; the forum\'s long axis ends on it.',
    'Walls are painted, not white: a dark socle at the foot, a lighter field above. Stucco is brighter than the limestone, the limestone than the tufa, and the lava street is the darkest thing in the town; a wall turned from the sun is cool, never black.',
    'Roofs are low and red: terracotta tile at a shallow pitch with a short eave. A pediment belongs to a temple, never to a house.',
    'The street is a channel: dark lava paving between raised kerbed pavements, stepping stones at the crossings no higher than the kerb, with gaps a cart\'s wheels pass through.',
    'Columns keep their order\'s proportion: Tuscan and Doric about seven diameters, Corinthian about ten; the upper order of a two-storey portico is the shorter one.',
    'The sky is a place: a clear Campanian summer, deep blue overhead, hazier toward Vesuvius and the bay.',
  ]),
  // the value order principle 2 measures, brightest first
  values: Object.freeze(['stucco', 'limestone', 'tufa', 'lava']),
  // the design language: every Pompeian piece is built from these (metres unless said)
  kit: Object.freeze({
    // shaft height in lower diameters (Vitruvius IV); the upper portico order is `upper` of the lower's height
    order: { tuscan: 7, doric: 7, ionic: 9, corinthian: 10, upper: 0.75 },
    podium: { h: [2.5, 3.5], stair: 'front' },                    // the Capitolium's ~3 m (record: capitolium)
    roof: { pitch: 22, overhang: [0.4, 0.8], pediment: 'temple' }, // design numbers: no Pompeian pitch in the record (record: tile-roof)
    tile: { tegula: [0.6, 0.45], imbrex: 0.16 },
    // kerb and stones are design numbers (record: kerbed-street, unverified); the widths are Via dell'Abbondanza's (record: via-abbondanza)
    street: { kerb: [0.3, 0.5], stone: { h: 0.3, w: 0.9, d: 0.5 }, gauge: 1.4, wheel: 0.12, width: { main: 6.7, forumEnd: 14.6 }, step: 0.4 },
    wall: { socle: [0.9, 1.2], storey: [3.5, 4.5] },
  }),
  palette: Object.freeze({
    stucco: '#ebe3d1', limestone: '#c9b68c', tufa: '#8d887c', lava: '#4b4a47',
    tile: '#b4623c', brick: '#a5553a', cocciopesto: '#b9806a',
    red: '#9b2f22', yellow: '#c79a42', black: '#2e2b29',
    vine: '#6c7a3e', sky: '#cfdde6',
  }),
  light: { shade: { color: '#4f5f88', alpha: 0.44, soft: 0.4 }, ao: { radius: 7, alpha: 0.28 }, palm: { alpha: 0.5, reach: 0.4 } },
  sky: { preset: 'day', sunElev: 0.85, palette: { highlight: [234, 230, 218], shadow: [24, 92, 190] }, sun: false, horizonY: 0.5 },
});
