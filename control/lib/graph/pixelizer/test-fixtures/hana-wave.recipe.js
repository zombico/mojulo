/**
 * hana-wave — the ACTUAL pilot wave: sk_bd626zr5b3 "Hana — hangar
 * wave" (keyframe-animation, character pilot-hana ref sk_e2kv7qsn2s),
 * the Qwen local worker's first minted animation, transposed from the
 * painted-cel register to the sovereign one.
 *
 * The source manifest's channels map one-to-one onto track grammar:
 *   6 keys on twos @12fps × 3 cycles  →  a 6-entry arm-cel sequence at
 *                                        4-frame steps (@24fps), 24f
 *                                        per cycle, three cycles
 *   blink { meanGapSec: 2.2 }         →  BLINK timing charts ~2.2s apart
 *   speech { spans, flapsPerSec: 8 }  →  mouth sub-cel keys every 3
 *                                        frames inside each span
 *
 * The figure is the dream loop closing: the worker's painted Hana is
 * the DREAM; this file is the re-authoring into the closed vocabulary
 * (a 40×84 base at 13 of the 16-bit register's 15 colors — graphite
 * suit, orange piping + harness, silver pauldrons and shin plates,
 * black gloves, the bob with fringe); the raster stays behind as the
 * reference it always was. Sub-cel economy throughout: the body never
 * redraws — the right arm, eyes, and mouth are overlay placements.
 */

import { FONT_3X5 } from '../font-3x5.js';

const pad = (w) => (r) => r.padEnd(w, '.');

// 1 outline, 2 hair, 3 hair shine, 4 skin, 5 skin shadow, 6 suit,
// 7 suit shadow, 8 suit light, 9 orange, a orange bright, b silver,
// c silver shine, d glove/boot dark
const PALETTE = [
  '#262130', '#4a3626', '#70543a', '#f2d6bc', '#d8b294', '#8e939e',
  '#686d76', '#b6bcc6', '#e87c28', '#f8a850', '#ccd2dc', '#f0f4fa', '#35323e',
];

const face = (f) => `.........12${f}2222221`;
const HANA_BASE = {
  size: [40, 84],
  palette: PALETTE,
  cells: [
    '.............111111111',
    '...........1122222222211',
    '..........1222223322222221',
    '..........12222333322222221',
    '.........1222223333322222221',
    '.........1222223333222222221',
    '.........1222222222222222221',
    '.........1222222222222222221',
    face('2224222242'),
    face('4444444444'),
    face('4444444444'),
    face('4444444444'),
    face('4444444445'),
    '..........14444444451222221',
    '...........1144451122222221',
    '.............14451..122221',
    '............11444511..11',
    '....1bcb1...166666661...1bcb1',
    '...1bcbbb1.166666666661.1bcbbb1',
    '...1bbbbb116666666666611bbbbb1',
    '...1bbbb11669966669966611bbbb1',
    '....16611' + '669966669966' + '71',
    '....16611' + '669966669966' + '71',
    '....16611' + '669966669966' + '71',
    '....16611' + '669b66669b66' + '71',
    '....16611' + '669966669966' + '71',
    '....16611' + '669966669966' + '71',
    '....16611' + '669966669966' + '71',
    '....16611' + '669966669966' + '71',
    '....16611' + '669966669966' + '71',
    '....16611' + '669966669966' + '71',
    '....16611' + '669966669966' + '71',
    '....1d611' + '669966669966' + '71',
    '....1dd11' + '669966669966' + '71',
    '....1dd11' + '999999999999' + '71',
    '....1dd11' + '9aaaabaaaaa9' + '71',
    '....11dd1.1666666666671',
    '.....1dd1.1666666666671',
    '.....1dd1.1666666666671',
    '.....1dd111667766776671',
    '......1d111667766776671',
    '........11667766776611',
    '..........1667711667711',
    '..........1966711966711',
    '..........1966711966711',
    '..........196671196671 1'.replace(' ', '1'),
    '..........19667119667 11'.replace(' ', '1'),
    '..........1966711966711',
    '..........1966711966711',
    '..........1966711966711',
    '..........1966711966711',
    '..........1966711966711',
    '..........1966711966711',
    '..........1966711966711',
    '..........1966711966711',
    '..........1bcb711bcb711',
    '..........1bbb711bbb711',
    '..........1bbb711bbb711',
    '..........1bcb711bcb711',
    '..........1966711966711',
    '..........1966711966711',
    '..........1966711966711',
    '..........1966711966711',
    '..........1966711966711',
    '..........1966711966711',
    '..........1966711966711',
    '..........1966711966711',
    '..........1966711966711',
    '..........1966711966711',
    '..........1966711966711',
    '..........1dbc711dbc711',
    '..........1dbb711dbb711',
    '..........1dbb711dbb711',
    '..........1dbb711dbb711',
    '..........1dbb711dbb711',
    '..........1dbb711dbb711',
    '..........1ddd711ddd711',
    '..........1ddd711ddd711',
    '..........1ddd711ddd711',
    '..........1ddd711ddd711',
    '.........1dddd711dddd711',
    '.........1dddd711dddd711',
    '........1ddddd711ddddd711',
    '........1111111111111111 1'.replace(' ', '1'),
  ].map(pad(40)),
};

// ---- eye and mouth sub-cels (face is x11-20 of the base) ----
const EYE_PALETTE = ['#262130', '#5a3a22', '#ffffff'];
const EYES = {
  'eyes-open': ['11..11..', '12..12..', '........'],
  'eyes-half': ['........', '11..11..', '12..12..'],
  'eyes-closed': ['........', '........', '11..11..'],
};
const MOUTH_PALETTE = ['#a45a4e', '#5e2a34'];
const MOUTHS = {
  'mouth-closed': ['.11.', '....'],
  'mouth-small': ['1221', '.11.'],
  'mouth-open': ['1221', '1221'],
};

// ---- the right-arm overlay (18×52 at base cols 22-39, rows 4-55) ----
// every variant shares the size; the base has no right arm below the
// pauldron, so each variant paints the whole limb for its pose
const ARM_PALETTE = ['#262130', '#8e939e', '#686d76', '#f2d6bc', '#35323e', '#e87c28'];
// 1 outline, 2 suit, 3 suit shadow, 4 skin, 5 glove, 6 orange
const armSprite = (cells) => ({
  size: [18, 52],
  palette: ARM_PALETTE,
  cells: [...cells, ...Array(52 - cells.length).fill('')].map(pad(18)),
});
const ARM_REST = armSprite([
  ...Array(16).fill(''),
  '.....1221',           // r16 — hangs from under the right pauldron
  '.....12321',
  '.....12321',
  '......12321',
  '......12321',
  '......12321',
  '.......12321',
  '.......12321',
  '.......12321',
  '.......12321',
  '........1231',
  '........1231',
  '........1231',
  '........1231',
  '........1231',
  '........1231',
  '........15551',
  '........15551',
  '........15551',
  '........15551',
  '.........1551',
  '.........1551',
  '..........11',
]);
const ARM_RAISE = armSprite([
  ...Array(6).fill(''),
  '............11',
  '...........1551',
  '...........15551',
  '...........1551',
  '..........12321',
  '.........12321',
  '.........12321',
  '........12321',
  '.......12321',
  '......12321',
  '.....112321',        // elbow roots under the pauldron
  '.....12321',
  '.....1221',
  '......11',
]);
// the three wave cels: the forearm stands vertical, clear of the
// head; only the hand tilts (outward / vertical / inward), and the
// 6-key on-twos cycle plays a,b,c,c,b,a
const ARM_FOREARM = [
  '..........1231',      // vertical forearm...
  '..........1231',
  '..........1231',
  '..........1231',
  '..........1231',
  '..........1231',
  '..........1231',
  '..........1231',
  '..........1231',
  '.....122222231',      // ...into a horizontal upper arm — a sharp L
  '.....122222231',
  '.....11111111',
];
const ARM_WAVE_A = armSprite([
  '...........11',
  '...........1551',
  '..........15551',
  '..........1551',
  '..........1551',
  ...ARM_FOREARM,
]);
const ARM_WAVE_B = armSprite([
  '..........11',
  '..........1551',
  '..........15551',
  '..........1551',
  '..........1551',
  ...ARM_FOREARM,
]);
const ARM_WAVE_C = armSprite([
  '.........11',
  '.........1551',
  '.........15551',
  '..........1551',
  '..........1551',
  ...ARM_FOREARM,
]);

const SHADOW = {
  size: [30, 4],
  palette: ['#86a9cc', '#93b4d5'],
  cells: ['......111111111111111111......', '...1112222222222222222111.....', '.11222222222222222222222211...', '...1111111111111111111111.....'],
};

const BLINK = (at) => [
  { at, value: 'eyes-half' },
  { at: at + 2, value: 'eyes-closed' },
  { at: at + 5, value: 'eyes-half' },
  { at: at + 7, value: 'eyes-open' },
];

// the source clip's wave channel: 6 keys on twos ×3 cycles → 4-frame
// cel steps from f32, 24f per cycle
const WAVE_CYCLE = ['arm-wave-a', 'arm-wave-b', 'arm-wave-c', 'arm-wave-c', 'arm-wave-b', 'arm-wave-a'];
const armKeys = [{ at: 0, value: 'arm-rest' }, { at: 24, value: 'arm-raise' }];
for (let c = 0; c < 3; c++) {
  WAVE_CYCLE.forEach((cel, i) => armKeys.push({ at: 32 + c * 24 + i * 4, value: cel }));
}
armKeys.push({ at: 104, value: 'arm-raise' }, { at: 112, value: 'arm-rest' });

// the speech channel: spans mapped to the wave section, 8 flaps/sec →
// a mouth swap every 3 frames inside each span
const mouthKeys = [{ at: 0, value: 'mouth-closed' }];
for (const [s, e] of [[34, 48], [58, 72], [82, 96]]) {
  for (let t = s, i = 0; t < e; t += 3, i++) mouthKeys.push({ at: t, value: i % 2 ? 'mouth-small' : 'mouth-open' });
  mouthKeys.push({ at: e, value: 'mouth-closed' });
}

export const HANA_WAVE_RECIPE = {
  kind: 'pixel-cutscene',
  register: '16bit',
  viewport: [128, 96],
  fps: 24,
  sprites: {
    'hana-base': HANA_BASE,
    ...Object.fromEntries(Object.entries(EYES).map(([id, cells]) => [id, { size: [8, 3], palette: EYE_PALETTE, cells }])),
    ...Object.fromEntries(Object.entries(MOUTHS).map(([id, cells]) => [id, { size: [4, 2], palette: MOUTH_PALETTE, cells }])),
    'arm-rest': ARM_REST,
    'arm-raise': ARM_RAISE,
    'arm-wave-a': ARM_WAVE_A,
    'arm-wave-b': ARM_WAVE_B,
    'arm-wave-c': ARM_WAVE_C,
    shadow: SHADOW,
  },
  tileBanks: {},
  fonts: { micro: FONT_3X5 },
  scenes: [
    {
      id: 'hangar-wave',
      duration: 192,
      background: '#a9c9e9',
      placements: [
        { id: 'shadow', sprite: 'shadow', cell: [49, 89] },
        { id: 'hana', sprite: 'hana-base', cell: [44, 8] },
        { id: 'arm', sprite: 'arm-rest', cell: [66, 12] },
        { id: 'eyes', sprite: 'eyes-open', cell: [56, 17] },
        { id: 'mouth', sprite: 'mouth-closed', cell: [58, 21] },
      ],
      captions: [
        { id: 'title', font: 'micro', text: 'HANA - HANGAR WAVE', cell: [4, 88], color: '#33506e' },
      ],
      tracks: [
        { target: '@fade', prop: 'level', color: '#a9c9e9', keys: [{ at: 0, value: 8 }, { at: 12, value: 0 }] },
        { target: 'arm', prop: 'sprite', keys: armKeys },
        { target: 'mouth', prop: 'sprite', keys: mouthKeys },
        { target: 'eyes', prop: 'sprite', keys: [{ at: 0, value: 'eyes-open' }, ...BLINK(30), ...BLINK(110), ...BLINK(170)] },
        { target: 'title', prop: 'reveal', keys: [{ at: 24, value: 0 }, { at: 72, value: 18 }] },
      ],
    },
  ],
};
