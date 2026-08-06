/**
 * quiet-call — the anime limited-animation economy as track grammar:
 * a two-scene pantomime (no captions, that's the quiet) where the
 * body is ONE authored bust that never redraws and all the acting is
 * sub-cel overlays — eye sprites (open/half/closed) and mouth sprites
 * (closed/small/open) swapped by step-hold keyframe tracks.
 *
 * This is the image-outcomes keyframe-animation decomposition (base
 * cel + face sub-cels) ported to the sovereign side of the seam: the
 * blink is three cels and a timing chart, the phone talk is mouth
 * flaps in bursts with listening pauses, and the timing chart is
 * diffable data.
 *
 * Storyboard @24fps:
 *   quiet (f0-167)   fade in on a night room; she stands by the
 *                    window; two slow blinks; the phone on the sill
 *                    buzzes twice
 *   call  (f168-383) phone to her ear (an arm overlay painted over
 *                    the same bust); talk burst, listening pause with
 *                    a blink, second burst, a short goodbye; fade out
 */

// pad an authored row out to the sprite width — trailing '.' only,
// so the drawn pixels stay exactly where written
const pad = (w) => (r) => r.padEnd(w, '.');

// ---- the bust (32x48, authored facing W = toward the window) ----
// 1 outline, 2 hair, 3 hair shine, 4 skin, 5 skin shadow,
// 6 sweater, 7 sweater shadow, 8 hair dark
const face = (inner) => `....12${inner}${'2'.repeat(11)}1`;
const GIRL_BASE = {
  size: [32, 48],
  palette: ['#221a2e', '#4e3c72', '#8a72b4', '#f2dcc4', '#d8b697', '#b05c66', '#8a4650', '#372a54'],
  cells: [
    '..........1111111111',
    '........122222222221',
    '.......122333322222221',
    '......12233333322222221',
    '.....12233333333222222221',
    '....122333333332222222221',
    '....12222223333332222222221',
    '...1222222233333222222222221',
    '...1222222222222222222222221',
    '...12222242224222222222222221',
    face('4444444444'),
    face('4444444444'),
    face('4444444444'),
    face('4444444444'),
    face('4444444444'),
    face('4444444445'),
    face('4454444444'),
    face('4444444444'),
    face('4444444444'),
    face('4444444445'),
    '.....144444444512222222222 1'.replace(' ', '2'),
    '......114444441122222222222 1'.replace(' ', '2'),
    '..........155551222222222221',
    '..........144451222222222221',
    '..........14445122222222221',
    '..........1444512222222221',
    '..........144451222222221',
    '.....116661444512222222 81'.replace(' ', '2'),
    '....16666661444512222228821',
    '...1666666614444122222 8821'.replace(' ', '2'),
    '..16666666611441166622 881'.replace(' ', '2'),
    '..1666666666111166666228821',
    '..16666666666666666666128821',
    '..1666666666666666666612 881'.replace(' ', '8'),
    '..16666666666666666666617781',
    '..16666666666666666666667781',
    '..16666666666666666666667781',
    '..16666666666666666666667781',
    '..16666666666666666666667781',
    '..16666666666666666666667781',
    '..16666666666666666666667781',
    '..16666666666666666666667781',
    '..16666666666666666666667781',
    '..16666666666666666666667781',
    '..16666666666666666666667781',
    '..16666666666666666666667781',
    '..16666666666666666666667781',
    '..16666666666666666666667781',
  ].map(pad(32)),
};

// ---- the eye sub-cels (10x4, the face opening's width) ----
// 1 lash, 2 iris, 3 highlight, 4 iris dark
const EYE_PALETTE = ['#221a2e', '#5a78b8', '#f4f7ff'];
const EYES = {
  'eyes-open': ['111..11111', '122..12231', '121..12221', '.1....111.'],
  'eyes-half': ['..........', '111..11111', '122..12231', '.1....111.'],
  'eyes-closed': ['..........', '..........', '111..11111', '..........'],
};

// ---- the mouth sub-cels (6x3) ----
// 1 lip line, 2 interior
const MOUTH_PALETTE = ['#8a4650', '#5e2a34'];
const MOUTHS = {
  'mouth-closed': ['......', '.111..', '......'],
  'mouth-small': ['.11...', '1221..', '.11...'],
  'mouth-open': ['1221..', '1221..', '.11...'],
};

// ---- the phone arm overlay (14x30): hand + phone at the near
// cheek, sleeve falling to the shoulder; painted after the bust ----
// 1 outline, 2 sleeve, 3 sleeve shadow, 4 skin, 5 phone, 6 screen
const ARM_PHONE = {
  size: [14, 30],
  palette: ['#221a2e', '#b05c66', '#8a4650', '#f2dcc4', '#16121f', '#8fa8cc'],
  cells: [
    '..111',
    '.16551',
    '.16551',
    '.16551',
    '.16551',
    '.16551',
    '.14441',
    '.144441',
    '..14441',
    '...14441',
    '...144411',
    '....12211',
    '....122211',
    '....1222211',
    '....12222211',
    '.....1222221',
    '.....12222221',
    '......1222221',
    '......12222221',
    '.......1222221',
    '.......1222221',
    '.......1222321',
    '.......1222321',
    '.......1223321',
    '.......1223321',
    '.......1223321',
    '.......1233321',
    '.......1233321',
    '.......1233321',
    '.......1233321',
  ].map(pad(14)),
};

// ---- room props ----
const MOON = {
  size: [10, 10],
  palette: ['#e6e2cc', '#c9c2a4'],
  cells: ['...1111...', '..111111..', '.11111112.', '1111111122', '1111111122', '1111111222', '1111112222', '.11122222.', '..112222..', '...1122...'],
};
const PHONE_SILL = {
  size: [6, 8],
  palette: ['#0e0b16', '#9fb8dc', '#4a4270'],
  cells: ['.1111.', '132231', '132231', '132231', '132231', '132231', '131131', '.1111.'],
};
const BUZZ_ON = {
  size: [8, 6],
  palette: ['#cfd8f0'],
  cells: ['......1.', '.1...1..', '..1...1.', '.1...1..', '......1.', '........'],
};
const BUZZ_OFF = { size: [8, 6], palette: ['#cfd8f0'], cells: ['........', '........', '........', '........', '........', '........'] };

// ---- room tile bank ----
const solid = (color) => ({ size: [8, 8], palette: [color], cells: Array.from({ length: 8 }, () => '11111111') });
const ROOM_BANK = {
  tileSize: [8, 8],
  bank: {
    wall: {
      size: [8, 8],
      palette: ['#241e33', '#272138'],
      cells: ['11111111', '11111111', '11111111', '11121111', '11111111', '11111111', '11111111', '11111111'],
    },
    frame: solid('#171126'),
    sky: {
      size: [8, 8],
      palette: ['#101a30', '#131e36'],
      cells: ['11111111', '11111111', '11111121', '11111111', '11111111', '11111111', '12111111', '11111111'],
    },
    sill: {
      size: [8, 8],
      palette: ['#171126', '#453a63'],
      cells: ['22222222', '11111111', '11111111', '11111111', '11111111', '11111111', '11111111', '11111111'],
    },
  },
  legend: { w: 'wall', k: 'frame', s: 'sky', l: 'sill' },
};

const ROOM_ROWS = [
  'wwwwwwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwwwwwww',
  'wwkkkkkkkkkwwwwwwwww',
  'wwkssssssskwwwwwwwww',
  'wwkssssssskwwwwwwwww',
  'wwkssssssskwwwwwwwww',
  'wwkssssssskwwwwwwwww',
  'wwkssssssskwwwwwwwww',
  'wwkkkkkkkkkwwwwwwwww',
  'wlllllllllllwwwwwwww',
  'wwwwwwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwwwwwww',
];

const BLINK = (at) => [
  { at, value: 'eyes-half' },
  { at: at + 2, value: 'eyes-closed' },
  { at: at + 5, value: 'eyes-half' },
  { at: at + 7, value: 'eyes-open' },
];

// shared scene furniture — placements are per-scene, so each scene
// redeclares its cast; the sprites are the shared bank
const roomLayers = [{ id: 'room', bank: 'room', parallax: [0, 1], rows: ROOM_ROWS }];
const nightCast = [
  { id: 'moon', sprite: 'moon', cell: [40, 28] },
  { id: 'tw-a', sprite: 'spark', cell: [30, 40] },
  { id: 'tw-b', sprite: 'spark', cell: [58, 30] },
  { id: 'tw-c', sprite: 'spark', cell: [66, 46] },
];
const girlCast = [
  { id: 'girl', sprite: 'girl-base', cell: [102, 48] },
  { id: 'eyes', sprite: 'eyes-open', cell: [108, 59] },
  { id: 'mouth', sprite: 'mouth-closed', cell: [110, 65] },
];
const twinkle = [
  { target: 'tw-a', prop: 'sprite', values: ['spark', 'spark-dim'], every: 16 },
  { target: 'tw-b', prop: 'sprite', values: ['spark-dim', 'spark'], every: 12 },
];

export const QUIET_CALL_RECIPE = {
  kind: 'pixel-cutscene',
  register: '16bit',
  viewport: [160, 96],
  fps: 24,
  sprites: {
    'girl-base': GIRL_BASE,
    ...Object.fromEntries(Object.entries(EYES).map(([id, cells]) => [id, { size: [10, 4], palette: EYE_PALETTE, cells }])),
    ...Object.fromEntries(Object.entries(MOUTHS).map(([id, cells]) => [id, { size: [6, 3], palette: MOUTH_PALETTE, cells }])),
    'arm-phone': ARM_PHONE,
    moon: MOON,
    'phone-sill': PHONE_SILL,
    'buzz-on': BUZZ_ON,
    'buzz-off': BUZZ_OFF,
    spark: { size: [1, 1], palette: ['#dfe6f8'], cells: ['1'] },
    'spark-dim': { size: [1, 1], palette: ['#5a608a'], cells: ['1'] },
  },
  tileBanks: { room: ROOM_BANK },
  fonts: {},
  scenes: [
    {
      id: 'quiet',
      duration: 168,
      background: '#14101f',
      layers: roomLayers,
      placements: [
        ...nightCast,
        ...girlCast,
        { id: 'phone', sprite: 'phone-sill', cell: [89, 64] },
        { id: 'buzz', sprite: 'buzz-off', cell: [94, 55] },
      ],
      tracks: [
        { target: '@fade', prop: 'level', color: '#0a0812', keys: [{ at: 0, value: 8 }, { at: 22, value: 0 }] },
        ...twinkle,
        { target: 'eyes', prop: 'sprite', keys: [{ at: 0, value: 'eyes-open' }, ...BLINK(58), ...BLINK(126)] },
        {
          target: 'phone',
          prop: 'cell',
          keys: [
            { at: 110, value: [89, 64] }, { at: 112, value: [90, 64] }, { at: 114, value: [88, 64] },
            { at: 116, value: [90, 64] }, { at: 118, value: [89, 64] }, { at: 128, value: [90, 64] },
            { at: 130, value: [88, 64] }, { at: 132, value: [90, 64] }, { at: 134, value: [89, 64] },
          ],
        },
        {
          target: 'buzz',
          prop: 'sprite',
          keys: [
            { at: 0, value: 'buzz-off' }, { at: 110, value: 'buzz-on' }, { at: 114, value: 'buzz-off' },
            { at: 118, value: 'buzz-on' }, { at: 122, value: 'buzz-off' }, { at: 128, value: 'buzz-on' },
            { at: 132, value: 'buzz-off' }, { at: 136, value: 'buzz-on' }, { at: 140, value: 'buzz-off' },
          ],
        },
      ],
    },
    {
      id: 'call',
      duration: 216,
      background: '#14101f',
      layers: roomLayers,
      placements: [
        ...nightCast,
        ...girlCast,
        { id: 'arm', sprite: 'arm-phone', cell: [114, 56] },
      ],
      tracks: [
        ...twinkle,
        { target: 'eyes', prop: 'sprite', keys: [{ at: 0, value: 'eyes-open' }, ...BLINK(84), ...BLINK(176)] },
        {
          // mouth flaps in bursts — the anime timing chart as keys:
          // talk, listen (closed, with a blink), talk, a short goodbye
          target: 'mouth',
          prop: 'sprite',
          keys: [
            { at: 0, value: 'mouth-closed' },
            { at: 20, value: 'mouth-small' }, { at: 24, value: 'mouth-open' }, { at: 28, value: 'mouth-small' },
            { at: 32, value: 'mouth-open' }, { at: 36, value: 'mouth-closed' }, { at: 40, value: 'mouth-small' },
            { at: 44, value: 'mouth-open' }, { at: 48, value: 'mouth-small' }, { at: 52, value: 'mouth-closed' },
            { at: 96, value: 'mouth-small' }, { at: 100, value: 'mouth-open' }, { at: 104, value: 'mouth-small' },
            { at: 108, value: 'mouth-closed' }, { at: 112, value: 'mouth-small' }, { at: 116, value: 'mouth-open' },
            { at: 120, value: 'mouth-small' }, { at: 124, value: 'mouth-closed' },
            { at: 156, value: 'mouth-small' }, { at: 160, value: 'mouth-open' }, { at: 164, value: 'mouth-small' },
            { at: 168, value: 'mouth-closed' },
          ],
        },
        { target: '@fade', prop: 'level', color: '#0a0812', keys: [{ at: 192, value: 0 }, { at: 215, value: 8 }] },
      ],
    },
  ],
};
