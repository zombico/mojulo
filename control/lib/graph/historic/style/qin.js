/**
 * The QIN style card: how Xianyang and the Lishan works should LOOK (c. 212 BCE), as principles, as the
 * kit's design language (the numbers every piece is built from) and as the light and sky the page reads.
 * The reference drawings and what each one contributes: docs/historic/qin/README.md. Machine checks in
 * ../style.test.js; the town-plan checks join them when the Qin layout exists.
 */
export const QIN_STYLE = Object.freeze({
  id: 'qin',
  principles: Object.freeze([
    'Earth lifts and encloses: terrace, gate tower and wall are one material with one batter, pounded in thin courses that show.',
    'Timber stands on earth: red columns on square stone bases, one plain bracket block per column, plaster between them.',
    'Roofs are grey, heavy and straight: a hip or a gable with a deep overhang, a dark row of round eave tiles, and no curve at the eave.',
    'Plaster reads against the loess, and paint is rare: the plastered wall is lighter than the ground, the lacquered column the one strong colour of the town; a wall turned from the sun is cool, never black.',
    'The sky is a place: pale and dusty over the loess, bluer overhead.',
  ]),
  values: Object.freeze([]),
  // the design language: every Qin piece is built from these (metres unless said)
  kit: Object.freeze({
    earth: { batter: 4.5, course: [0.06, 0.1] },                  // a face rises 4.5 for every 1 it steps in (≈77°); pounded courses 6–10 cm (record: rammed-earth-formwork)
    column: { d: 0.5, h: [3.2, 3.6], plinth: 0.8 },               // red-lacquered post on a square stone base 0.8 m on a side
    bracket: { perColumn: 1, form: 'block-and-arms' },            // one block with short crossing arms; no stacked sets
    roof: { forms: ['hip', 'gable'], pitch: 30, overhang: [2.5, 2.9], eaveCurve: 0 },   // pitch in degrees; eaveCurve 0 = a straight eave
    tile: { row: 0.25, wadang: 0.16, motif: 'cloud-a', motifs: ['cloud-a', 'cloud-b', 'cloud-c', 'kui', 'deer', 'plain'] },
    wall: { ward: { elite: 5, common: 3 }, city: { h: 8, base: 10 }, cap: 'tile' },
  }),
  palette: Object.freeze({   // sampled from the reference swatches (docs/historic/qin/refs/qin-lishan-pit-palette.webp); plaster pushed warmer and lighter than the loess
    loess: '#d7b589', hangtu: '#b79065', ochrePlaster: '#e6c9a0', whitePlaster: '#ede6d8', tile: '#7f796f',
    lacquerRed: '#9a3d2a', lacquerBlack: '#363635', river: '#879f95', millet: '#c1994f', wheat: '#d8b575',
    poplar: '#6f7958', sky: '#d0d9da',
  }),
  light: { shade: { color: '#5c6684', alpha: 0.4, soft: 0.35 }, ao: { radius: 7, alpha: 0.3 }, palm: { alpha: 0.5, reach: 0.4 } },
  sky: { preset: 'day', sunElev: 0.8, palette: { highlight: [228, 222, 204], shadow: [44, 104, 168] }, sun: false, horizonY: 0.5 },
});
