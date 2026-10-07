/**
 * The FORUM style card: how the Forum Romanum should LOOK on a summer day of 79 CE, at walking scale, where the
 * detail is in the buildings. Principles, the kit's design language (the orders' proportions every part is built
 * from: ../assets/orders.js) and the light and sky. The design brief: docs/historic/forum/README.md. The facts behind
 * the numbers: ../record/forum.js. Machine checks in ../style.test.js, measured on the built parts.
 *
 * The palette is estimated from the record's stones until the reference swatch sheet is made; it is not sampled.
 */
export const FORUM_STYLE = Object.freeze({
  id: 'forum',
  principles: Object.freeze([
    'Columns keep their order: a Corinthian column about ten lower diameters (Castor 10.2), its base half a diameter, its capital a little over one; Ionic about nine; Tuscan about seven. The shaft narrows to about five sixths above its lower third.',
    'The entablature is about a quarter of the column: architrave, frieze and cornice, the cornice the largest, its modillions spaced to the columns below.',
    'Temples stand on podia, high above the eye, entered by a stair at the front only; columns stand close (one and a half to two and a quarter diameters apart), so a temple front reads as a screen of stone.',
    'Marble is white but never flat: Luna marble brightest, then travertine, tufa, the speckled grey peperino, and the street\'s basalt darkest; gilt bronze and painted lettering are the few colours, and a face turned from the sun is cool, never black.',
    'The square is open: its middle holds only low monuments (the Lacus Curtius, the fig and Marsyas, the tribunal, letters in the paving); the honorary columns and statues stand at its edges and the buildings round it; its long axis runs from the Rostra to Divus Julius.',
    'The sky is a Roman summer\'s: clear, deep overhead, warm at the horizon over the Palatine.',
  ]),
  // the value order principle 4 measures, brightest first
  values: Object.freeze(['luna', 'travertine', 'tufa', 'peperino', 'selce']),
  // the design language: every part of the orders is built from these (in lower diameters D unless said)
  kit: Object.freeze({
    order: Object.freeze({
      // column: overall height in D; base and capital heights in D; taper: the upper diameter as a fraction of the lower
      corinthian: { column: 10, base: 0.5, capital: 1.15, taper: 0.85, flutes: 24 },
      ionic: { column: 9, base: 0.5, capital: 0.55, taper: 0.85, flutes: 24 },
      tuscan: { column: 7, base: 0.5, capital: 0.5, taper: 0.8, flutes: 0 },
    }),
    // entablature height as a fraction of the column (Castor: 3.75 / 14.8 = 0.25)
    entablature: { corinthian: [0.21, 0.27], ionic: [0.18, 0.24], tuscan: [0.15, 0.25] },
    // clear space between columns, in D (Vitruvius III.3: pycnostyle 1.5, systyle 2, eustyle 2.25)
    spacing: [1.5, 2.25],
    podium: { h: [3, 9], stair: 'front' },
    square: { w: 50, d: 130 },
  }),
  palette: Object.freeze({
    luna: '#ece9e2', travertine: '#d9cdb0', peperino: '#7f8073', tufa: '#a69a7c', selce: '#4b4a47',
    brick: '#a5553a', tile: '#b4623c', bronze: '#8a6d3b', gilt: '#c9a64a', minium: '#a3321f',
    giallo: '#c9a24a', africano: '#5a3b3a', cipollino: '#a9b79f', portasanta: '#b46f6a',
    sky: '#cfdde6',
  }),
  light: { shade: { color: '#4f5f88', alpha: 0.44, soft: 0.4 }, ao: { radius: 5, alpha: 0.3 } },
  sky: { preset: 'day', sunElev: 0.8, palette: { highlight: [236, 230, 216], shadow: [26, 90, 186] }, sun: false, horizonY: 0.5 },
});
