/**
 * The LINDOS style card: how the Hellenistic town on its sea cliff should LOOK, as principles and as the
 * numbers the light bake (../light.js) and the page's sky read. The first card whose land casts: the rock
 * stands in the bake (`light.terrain`), so the cliff throws its shade on the sea. The `polis` (the same
 * plan on a gentle hill) reads this card too, less its cliff. Machine checks in ../lindos.test.js.
 */
export const LINDOS_STYLE = Object.freeze({
  id: 'lindos',
  principles: Object.freeze([
    'Hard Aegean sun, measured: the stuccoed temple is the brightest thing on the rock, the town\'s plaster next, the sunlit rock after it, and a cliff turned from the sun the darkest — a cool grey, never black.',
    'The rock holds its own shade: the cliffs turned from the sun stand in shadow and throw it on the sea at their foot, while the open water lies in sun.',
    'The climb is the town\'s great way: from the harbour through the town, up the rock-cut stair, the stoa\'s terrace, the great stair, to the temple\'s floor — each higher than the last, and nothing built stands higher than the goddess.',
    'A terraced hillside: every house stands on one level, its street at the foot of a dry-stone terrace wall no taller than a storey; only the rock stands in cliffs.',
    'The sea is a place: turquoise over the shallows by the shore, deep blue offshore; the sky clear and blue overhead, paler at the horizon.',
    'Fire where the town lives, never on Athena\'s altar: hearths in the courts and the potters\' kilns burn; her sacrifices were fireless.',
  ]),
  // the value order principle 1 measures, brightest first
  values: Object.freeze(['stucco', 'plaster', 'rock', 'cliff']),
  light: { terrain: true, shade: { color: '#4a5d86', alpha: 0.46, soft: 0.5 }, ao: { radius: 8, alpha: 0.26 }, palm: { alpha: 0.5, reach: 0.4 } },
  // principle 2: the sea within `foot` m of a lee cliff at least `footShade` in shade; open water (beyond `open` m of any land) at most `openShade`
  sea: { foot: 25, footShade: 0.45, open: 120, openShade: 0.02 },
  // principle 4: a terrace wall at most `wall` m (a storey)
  terrace: { wall: 4 },
  sky: { preset: 'day', sunElev: 0.9, palette: { highlight: [236, 232, 220], shadow: [18, 88, 196] }, sun: false, horizonY: 0.5 },
});

/** The generic polis reads Lindos' card: the same sun, sea and town, on a hill with no cliff to cast. */
export const POLIS_STYLE = Object.freeze({ ...LINDOS_STYLE, id: 'polis' });
