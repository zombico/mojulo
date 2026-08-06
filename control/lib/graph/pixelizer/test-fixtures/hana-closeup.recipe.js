/**
 * hana-closeup — the animeness test: Hana (pilot-hana, sk_e2kv7qsn2s)
 * at dialogue-portrait resolution, the era's own close-up register
 * (the RPG talking bust / fighting-game portrait). The face is ~4× the
 * full-body sprite's, which is exactly where the anime signifiers
 * become authorable: thick lash lines, a two-tone warm-brown iris
 * with white highlights, the lid-shadow half blink, dithered blush,
 * and the closed-∪ smile eye.
 *
 * The head is built by a deterministic PAINTER (pure module-load
 * code, no dice): ellipse skull + shine crescent + side-lock rects +
 * face ellipse, then derived passes — under-fringe shadow, lock-rim
 * shadow, and an auto-outline around the whole silhouette (cel
 * lineart for free). The fringe, the most identity-carrying shape, is
 * hand-drawn and blitted over. Eyes and mouth stay hand-authored
 * sub-cel overlays: the sub-cel economy again, at portrait scale.
 *
 * Storyboard (192f @24): fade in → blink → she speaks (one span,
 * 8 flaps/sec) → blink → the warm beat: smile-eyes + closed smile
 * hold → back to calm, last blink out.
 */

import { FONT_3X5 } from '../font-3x5.js';

// 1 outline, 2 hair, 3 hair shine, 4 skin, 5 skin shadow, 6 suit,
// 7 blush, 8 orange, 9 silver, a silver shine
const PALETTE = [
  '#262130', '#4a3626', '#70543a', '#f2d6bc', '#d8b294', '#8e939e',
  '#eab09e', '#e87c28', '#ccd2dc', '#f0f4fa',
];

const W = 64;
const H = 88;
const g = Array.from({ length: H }, () => new Array(W).fill('.'));
const set = (x, y, c) => { if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c; };
const ellipse = (cx, cy, rx, ry, c) => {
  for (let y = Math.ceil(cy - ry); y <= cy + ry; y++) {
    const t = (y - cy) / ry;
    const dx = rx * Math.sqrt(Math.max(0, 1 - t * t));
    for (let x = Math.ceil(cx - dx); x <= Math.floor(cx + dx); x++) set(x, y, c);
  }
};
const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c); };
const blit = (x0, y0, rows) => rows.forEach((row, dy) => [...row].forEach((ch, dx) => { if (ch !== '.') set(x0 + dx, y0 + dy, ch); }));

// skull + bob mass; crown shine is hand-drawn arcs, not a crescent —
// generated crescents leave phantom bands at this scale
ellipse(32, 32, 26, 29, '2');
blit(22, 8, [
  '.....333333333......',
  '...3333333333333....',
  '..33333.....33333...',
]);
rect(7, 32, 16, 64, '2');
rect(48, 32, 57, 64, '2');
blit(7, 65, ['2222222222', '.22222222.', '..2222.22.', '...222..2.']);
blit(48, 65, ['2222222222', '.22222222.', '.22.2222..', '.2..222...']);
// the face
ellipse(32, 44, 17, 22, '4');

// hand-drawn fringe (37 wide at x14), scalloped anime bangs with
// shine streaks — the identity-carrying silhouette
blit(14, 22, [
  '2222222222222222222222222222222222222',
  '2222233322222222222222233332222222222',
  '2222333322222222222222223333222222222',
  '2222233222222222222222222332222222222',
  '2222222222222222222222222222222222222',
  '2222222222222222222222222222222222222',
  '.222222222222222222222222222222222222',
  '.22222222.22222222222222222222222222.',
  '..2222222..2222222222.222222.2222222.',
  '..222222....22222222...22222...22222.',
  '...22222.....222222.....2222....222..',
  '....222.......2222.......22......2...',
  '.....2.........22........2...........',
]);

// derived cel passes: under-fringe shadow, then lock-rim shadow
for (let x = 0; x < W; x++) {
  for (let y = 1; y < H; y++) {
    if (g[y][x] === '4' && (g[y - 1][x] === '2' || g[y - 1][x] === '3')) { set(x, y, '5'); break; }
    if (g[y][x] === '4') break;
  }
}
for (let y = 0; y < H; y++) {
  for (let x = 1; x < W - 1; x++) {
    if (g[y][x] === '4' && (g[y][x - 1] === '2' || g[y][x + 1] === '2')) set(x, y, '5');
  }
}

// brows, nose, dithered blush
blit(20, 34, ['.111111.']);
blit(37, 34, ['.111111.']);
set(33, 54, '5');
set(34, 55, '5');
blit(18, 53, ['7.7.7']);
blit(41, 53, ['7.7.7']);

// neck with under-chin shadow, then the collar/shoulder crop with
// pauldron corners and the harness strap tops
rect(26, 66, 38, 79, '4');
rect(26, 66, 38, 69, '5');
blit(2, 78, [
  '......................666666666666666.....................',
  '..................66666666666666666666666..................',
  '..............6666666666666666666666666666666..............',
  '..........a9666666666888666666666888666666666 9a..........'.replace(' ', '6'),
  '.......a99996666666668886666666668886666666666 9999a.......'.replace(' ', '6'),
  '......a999996666666668886666666668886666666666 99999a......'.replace(' ', '6'),
  '.....99999966666666668886666666668886666666666 6999999.....'.replace(' ', '6'),
  '.....99999666666666668886666666668886666666666 6669999.....'.replace(' ', '6'),
  '....999996666666666668886666666668886666666666 66669999....'.replace(' ', '6'),
  '....999966666666666668886666666668886666666666 66666999....'.replace(' ', '6'),
]);

// auto-outline: cel lineart around the whole silhouette
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (g[y][x] !== '.') continue;
    const n = [g[y - 1]?.[x], g[y + 1]?.[x], g[y][x - 1], g[y][x + 1]];
    if (n.some((c) => c && c !== '.' && c !== '1')) set(x, y, '1');
  }
}

const HANA_PORTRAIT = { size: [W, H], palette: PALETTE, cells: g.map((row) => row.join('')) };

// ---- the eyes: where the animeness lives (30×11, both eyes) ----
// 1 lash, 2 iris light, 3 iris dark, 4 white, 5 highlight, 6 lid shadow
const EYE_PALETTE = ['#262130', '#a06a38', '#5a3a22', '#f6f4ee', '#ffffff', '#d8b294'];
const GAP = '.....';
const eyePair = (far, near) => far.map((row, i) => row + GAP + near[i]);
const EYES = {
  'eyes-open': eyePair([
    '..111111..',
    '.11111111.',
    '1433333341',
    '1435533341',
    '1435533341',
    '1433333341',
    '1432222341',
    '.14222241.',
    '..122221..',
    '..111111..',
    '..........',
  ], [
    '..11111111...',
    '.1111111111..',
    '143333333341.',
    '1435533333341',
    '1435533333341',
    '1433333333341',
    '1432222223341',
    '.142222222 1.'.replace(' ', '4'),
    '..12222221...',
    '..11111111...',
    '.............',
  ]),
  'eyes-half': eyePair([
    '..........',
    '..111111..',
    '.16666661.',
    '1433333341',
    '1435533341',
    '1433333341',
    '1432222341',
    '.14222241.',
    '..122221..',
    '..111111..',
    '..........',
  ], [
    '.............',
    '..11111111...',
    '.1666666661..',
    '143333333341.',
    '1435533333341',
    '1433333333341',
    '1432222223341',
    '.1422222241..',
    '..12222221...',
    '..11111111...',
    '.............',
  ]),
  'eyes-closed': eyePair([
    '..........',
    '..........',
    '..........',
    '..........',
    '.11111111.',
    '..1....1..',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
  ], [
    '.............',
    '.............',
    '.............',
    '.............',
    '.1111111111..',
    '..1......1...',
    '.............',
    '.............',
    '.............',
    '.............',
    '.............',
  ]),
  'eyes-smile': eyePair([
    '..........',
    '..........',
    '.11....11.',
    '..111111..',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
  ], [
    '.............',
    '.............',
    '.11......11..',
    '..11111111...',
    '.............',
    '.............',
    '.............',
    '.............',
    '.............',
    '.............',
    '.............',
  ]),
};

// ---- the mouth (10×6) ----
// 1 lip line, 2 interior, 3 lower lip light
const MOUTH_PALETTE = ['#b06a5a', '#5e2a34', '#e0968a'];
const MOUTHS = {
  'mouth-closed': ['..........', '.1......1.', '..111111..', '..........', '..........', '..........'],
  'mouth-small': ['..........', '..11111...', '.1222221..', '..11111...', '...333....', '..........'],
  'mouth-open': ['..1111....', '.122221...', '.122221...', '.122221...', '..1111....', '...33.....'],
};

const BLINK = (at) => [
  { at, value: 'eyes-half' },
  { at: at + 2, value: 'eyes-closed' },
  { at: at + 5, value: 'eyes-half' },
  { at: at + 7, value: 'eyes-open' },
];

// one speech span (f48-90), 8 flaps/sec → a swap every 3 frames
const mouthKeys = [{ at: 0, value: 'mouth-closed' }];
for (let t = 48, i = 0; t < 90; t += 3, i++) mouthKeys.push({ at: t, value: i % 2 ? 'mouth-small' : 'mouth-open' });
mouthKeys.push({ at: 90, value: 'mouth-closed' });

export const HANA_CLOSEUP_RECIPE = {
  kind: 'pixel-cutscene',
  register: '16bit',
  viewport: [128, 96],
  fps: 24,
  sprites: {
    portrait: HANA_PORTRAIT,
    ...Object.fromEntries(Object.entries(EYES).map(([id, cells]) => [id, { size: [28, 11], palette: EYE_PALETTE, cells }])),
    ...Object.fromEntries(Object.entries(MOUTHS).map(([id, cells]) => [id, { size: [10, 6], palette: MOUTH_PALETTE, cells }])),
  },
  tileBanks: {},
  fonts: { micro: FONT_3X5 },
  scenes: [
    {
      id: 'portrait',
      duration: 192,
      background: '#a9c9e9',
      placements: [
        { id: 'hana', sprite: 'portrait', cell: [32, 8] },
        { id: 'eyes', sprite: 'eyes-open', cell: [50, 48] },
        { id: 'mouth', sprite: 'mouth-closed', cell: [58, 66] },
      ],
      captions: [
        { id: 'title', font: 'micro', text: 'HANA', cell: [6, 6], color: '#33506e', scale: 2 },
      ],
      tracks: [
        { target: '@fade', prop: 'level', color: '#a9c9e9', keys: [{ at: 0, value: 8 }, { at: 12, value: 0 }] },
        {
          target: 'eyes',
          prop: 'sprite',
          keys: [
            { at: 0, value: 'eyes-open' },
            ...BLINK(28),
            ...BLINK(100),
            { at: 120, value: 'eyes-smile' },  // the warm beat
            { at: 152, value: 'eyes-open' },
            ...BLINK(172),
          ],
        },
        { target: 'mouth', prop: 'sprite', keys: mouthKeys },
        { target: 'title', prop: 'reveal', keys: [{ at: 16, value: 0 }, { at: 40, value: 4 }] },
      ],
    },
  ],
};
