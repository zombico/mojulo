/**
 * platformer — the visual language of a mario-like 8-bit platformer,
 * proven at scene scale: a tile vocabulary (nametable tier), a hero
 * with stand/walk/jump variants, and a stompable enemy whose stomp is
 * pure track grammar — walk frames swap to a squashed variant on the
 * impact frame while the hero's cell track draws the jump arc.
 *
 * The whole scene — vocabulary, layout, and an 8-frame stomp
 * storyboard — is this one declarative file. Every frame derives; no
 * frame is authored.
 *
 * Storyboard (fps 4, 2s loop):
 *   f0-f1  hero walks right toward the chomper
 *   f2-f4  jump arc (sprite → hero-jump, cell track rises and falls)
 *   f5     impact: hero lands on the chomper; chomper → squashed
 *   f6     bounce off the stomp
 *   f7     hero lands past the pancake; second chomper patrols the
 *          pipe top untouched, walk frames alternating throughout
 *
 * Palettes hold the NES budget: 3 colors + transparent per raster.
 */

const HERO_PALETTE = ['#101018', '#d82818', '#f8d0a0'];
const CHOMPER_PALETTE = ['#0f0f10', '#a05018', '#fce8c0'];
const EARTH_PALETTE = ['#881400', '#c84c0c', '#fc9838'];
const PIPE_PALETTE = ['#0f0f10', '#00a800', '#80e080'];

const HERO_HEAD = [
  '.....111111.....',
  '...1122222211...',
  '..122222222221..',
  '..122111111221..',
  '..123333333321..',
  '..123133313321..',
  '..123133313321..',
  '..123331133321..',
  '....13333331....',
];

const CHOMPER_BODY = [
  '................',
  '......1111......',
  '....11222211....',
  '...1222222221...',
  '..122222222221..',
  '..122222222221..',
  '.12233222233221.',
  '.12231222213221.',
  '.12222222222221.',
  '.12222222222221.',
  '..122222222221..',
  '..112222222211..',
  '...1122222211...',
];

export const PLATFORMER_RECIPE = {
  kind: 'pixel-map',
  size: [120, 72],
  background: '#5c94fc',
  tiles: {
    tileSize: [8, 8],
    bank: {
      ground: {
        size: [8, 8],
        palette: EARTH_PALETTE,
        cells: [
          '33333331',
          '32222221',
          '32222221',
          '32222221',
          '32222221',
          '32222221',
          '32222221',
          '11111111',
        ],
      },
      brick: {
        size: [8, 8],
        palette: EARTH_PALETTE,
        cells: [
          '22212221',
          '22212221',
          '22212221',
          '11111111',
          '21222122',
          '21222122',
          '21222122',
          '11111111',
        ],
      },
      qblock: {
        size: [8, 8],
        palette: ['#0f0f10', '#fcbc00', '#fcfcfc'],
        cells: [
          '12222221',
          '22111122',
          '22222122',
          '22221122',
          '22211222',
          '22222222',
          '22211222',
          '12222221',
        ],
      },
      'pipe-top-l': {
        size: [8, 8],
        palette: PIPE_PALETTE,
        cells: [
          '11111111',
          '13322222',
          '13322222',
          '13322222',
          '13322222',
          '13322222',
          '13322222',
          '11111111',
        ],
      },
      'pipe-top-r': {
        size: [8, 8],
        palette: PIPE_PALETTE,
        cells: [
          '11111111',
          '22222221',
          '22222221',
          '22222221',
          '22222221',
          '22222221',
          '22222221',
          '11111111',
        ],
      },
      'pipe-l': {
        size: [8, 8],
        palette: PIPE_PALETTE,
        cells: [
          '.1332222',
          '.1332222',
          '.1332222',
          '.1332222',
          '.1332222',
          '.1332222',
          '.1332222',
          '.1332222',
        ],
      },
      'pipe-r': {
        size: [8, 8],
        palette: PIPE_PALETTE,
        cells: [
          '2222221.',
          '2222221.',
          '2222221.',
          '2222221.',
          '2222221.',
          '2222221.',
          '2222221.',
          '2222221.',
        ],
      },
      cloud: {
        size: [8, 8],
        palette: ['#a0d8f8', '#fcfcfc'],
        cells: [
          '..2222..',
          '.222222.',
          '22222222',
          '22222222',
          '.111111.',
          '........',
          '........',
          '........',
        ],
      },
    },
    legend: {
      G: 'ground',
      B: 'brick',
      Q: 'qblock',
      C: 'cloud',
      '<': 'pipe-top-l',
      '>': 'pipe-top-r',
      '(': 'pipe-l',
      ')': 'pipe-r',
    },
    rows: [
      '...............',
      '..C......CC....',
      '...............',
      '..BQB..........',
      '...............',
      '............<>.',
      '............().',
      'GGGGGGGGGGGGGGG',
      'GGGGGGGGGGGGGGG',
    ],
  },
  sprites: {
    'hero-stand': {
      size: [16, 16],
      palette: HERO_PALETTE,
      cells: [
        ...HERO_HEAD,
        '...122222221....',
        '..121222222121..',
        '..121222222121..',
        '..111222222111..',
        '....122..122....',
        '...1222..1222...',
        '...1111..1111...',
      ],
    },
    'hero-walk': {
      size: [16, 16],
      palette: HERO_PALETTE,
      cells: [
        ...HERO_HEAD,
        '...122222221....',
        '..121222222121..',
        '..121222222121..',
        '..111222222111..',
        '...122...122....',
        '..1222...1222...',
        '..1111...1111...',
      ],
    },
    'hero-jump': {
      size: [16, 16],
      palette: HERO_PALETTE,
      cells: [
        ...HERO_HEAD,
        '..11222222211...',
        '..121222222121..',
        '..121222222121..',
        '..111222222111..',
        '.....122122.....',
        '.....111111.....',
        '................',
      ],
    },
    'chomper-walk-1': {
      size: [16, 16],
      palette: CHOMPER_PALETTE,
      cells: [
        ...CHOMPER_BODY,
        '..1331...1331...',
        '..1331...1331...',
        '..1111...1111...',
      ],
    },
    'chomper-walk-2': {
      size: [16, 16],
      palette: CHOMPER_PALETTE,
      cells: [
        ...CHOMPER_BODY,
        '...1331...1331..',
        '...1331...1331..',
        '...1111...1111..',
      ],
    },
    'chomper-squashed': {
      size: [16, 16],
      palette: CHOMPER_PALETTE,
      cells: [
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '..111111111111..',
        '.12222222222221.',
        '.12222222222221.',
        '.13311111111331.',
        '.11111111111111.',
      ],
    },
  },
  placements: [
    { id: 'hero', sprite: 'hero-stand', cell: [16, 40], facing: 'E' },
    { id: 'chomper-a', sprite: 'chomper-walk-1', cell: [56, 40] },
    { id: 'chomper-b', sprite: 'chomper-walk-1', cell: [95, 24] },
  ],
  animation: {
    fps: 4,
    tracks: [
      {
        target: 'hero',
        prop: 'sprite',
        values: ['hero-stand', 'hero-walk', 'hero-jump', 'hero-jump', 'hero-jump', 'hero-jump', 'hero-jump', 'hero-stand'],
      },
      {
        target: 'hero',
        prop: 'cell',
        values: [[16, 40], [24, 40], [32, 33], [42, 27], [50, 32], [56, 35], [62, 31], [70, 40]],
      },
      {
        target: 'chomper-a',
        prop: 'sprite',
        values: ['chomper-walk-1', 'chomper-walk-2', 'chomper-walk-1', 'chomper-walk-2', 'chomper-walk-1', 'chomper-squashed', 'chomper-squashed', 'chomper-squashed'],
      },
      {
        target: 'chomper-a',
        prop: 'cell',
        values: [[56, 40], [54, 40], [52, 40], [54, 40], [56, 40], [56, 40], [56, 40], [56, 40]],
      },
      {
        target: 'chomper-b',
        prop: 'sprite',
        values: ['chomper-walk-1', 'chomper-walk-2'],
      },
      {
        target: 'chomper-b',
        prop: 'cell',
        values: [[93, 24], [95, 24], [97, 24], [95, 24]],
      },
    ],
  },
};
