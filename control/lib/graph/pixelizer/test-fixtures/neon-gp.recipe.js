/**
 * neon-gp — a futuristic racing simulator in the 32-bit register,
 * attract-mode tier, at the era's own FRAME: 320×224 (the PS1-class
 * 2D resolution), not just its color depth. The synthwave grid floor
 * and the perspective road are ONE static painted raster whose motion
 * is entirely palette rotation (the era's racing trick — OutRun's
 * road bands — driven by the cycle grammar), while the palette is
 * deliberately post-era: full-sRGB neons (#00ffe7, #ff2bd6, #b6ff00)
 * RGB555 could never name. Form factor honored; color space unbound.
 *
 * Structure:
 *   world   — generated painter raster (320×224): sky ramp + stars +
 *             scanline sun + two city silhouettes with lit windows +
 *             converging grid floor + perspective road with rails.
 *             Palette laid out in NAMED INDEX BLOCKS so the cycle
 *             tracks rotate exactly the grid-line ramp and the road
 *             stripe ramp — nothing else. Grid lines paint only on
 *             phase TRANSITIONS (thin receding scanlines, not slabs).
 *   ship    — the hand-authored rear-view wedge, integer-doubled to
 *             the new frame; hover-bob cell cycle
 *   exhaust — 3 flicker cels (doubled) + a violet-white glow ramp
 *   HUD     — captions: title, lap, speed, blinking BOOST
 *
 * Motion inventory (all zero pixel data per frame): road bands and
 * grid lines rush toward the viewer (two palette rotations), engines
 * flicker (cel cycle), the craft bobs (cell cycle).
 */

import { FONT_3X5 } from '../font-3x5.js';

const pad = (w) => (r) => r.padEnd(w, '.');
const CH = '123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ch = (i) => CH[i - 1]; // 1-based palette slot → cell char

// ---- the world palette, in named blocks (1-based slots) ----
const SKY = ['#05010f', '#0d0426', '#1c0940', '#33115e', '#571a7a', '#8a1f8f'];          // 1-6
const SUN = ['#ffe95c', '#ffc548', '#ff9440', '#ff6a52', '#ff3f78', '#ff2bd6'];          // 7-12
const CITY = ['#2a1650', '#160a2e', '#00ffe7', '#ff2bd6'];                               // 13-16
const GRID = ['#00ffe7', '#00d8d2', '#00aebc', '#0884a6', '#0e5c8c', '#123a6e', '#152250', '#161238']; // 17-24 ← cycled
const ROAD = ['#3c1470', '#2c0e56', '#220944', '#180634', '#4c1a86', '#ff2bd6'];         // 25-30 ← cycled
const RAIL = ['#ff2bd6', '#c01ea6', '#801670', '#400b3a'];                               // 31-34
const EXTRA = ['#0a0518', '#0a4a6e', '#f8f8ff'];                                         // 35 ground, 36 grid vert, 37 star
const WORLD_PALETTE = [...SKY, ...SUN, ...CITY, ...GRID, ...ROAD, ...RAIL, ...EXTRA];
const GRID_RANGE = [17, 8];
const ROAD_RANGE = [25, 6];

const W = 320;
const H = 224;
const HORIZON = 104;
const CX = 160;

const g = Array.from({ length: H }, () => new Array(W).fill('.'));
const set = (x, y, i) => { if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = ch(i); };

// sky ramp + deterministic stars
for (let y = 0; y < HORIZON; y++) {
  const band = 1 + Math.min(5, Math.floor((y / HORIZON) * 6));
  for (let x = 0; x < W; x++) set(x, y, band);
  for (let x = 0; x < W; x++) if ((x * 7 + y * 13) % 293 === 0 && y < 80) set(x, y, 37);
}

// the scanline sun, rising behind the horizon
for (let y = HORIZON - 56; y < HORIZON; y++) {
  const dy = HORIZON - y;
  const inGap = dy < 30 && dy % 9 < 3; // synthwave scan gaps near the base
  if (inGap) continue;
  const half = Math.floor(Math.sqrt(Math.max(0, 56 * 56 - dy * dy)));
  const tone = 7 + Math.min(5, Math.floor(((56 - dy) / 56) * 6));
  for (let x = CX - half; x <= CX + half; x++) set(x, y, tone);
}

// two city silhouette bands with lit windows (deterministic heights)
for (let b = 0; b < W; b += 14) {
  const hFar = 10 + ((b * 37) % 19);
  for (let y = HORIZON - hFar; y < HORIZON; y++) for (let x = b; x < b + 14; x++) set(x, y, 13);
}
for (let b = 7; b < W; b += 18) {
  const hNear = 7 + ((b * 53) % 15);
  for (let y = HORIZON - hNear; y < HORIZON; y++) {
    for (let x = b; x < b + 18; x++) {
      set(x, y, 14);
      if ((x * 11 + y * 17) % 41 === 0) set(x, y, 15 + ((x + y) % 2)); // cyan/magenta windows
    }
  }
}

// the ground: grid floor + perspective road, phase-indexed for cycling;
// horizontal grid lines paint only on phase TRANSITIONS so they stay
// thin lines instead of plateau slabs
const phases = [];
for (let y = HORIZON; y < H; y++) phases[y] = Math.floor((96 / (y - HORIZON + 1)) * 2.2);
for (let y = HORIZON; y < H; y++) {
  const phase = phases[y];
  const isLine = y === HORIZON || phases[y] !== phases[y - 1];
  const half = Math.floor(7 + (y - HORIZON) * 1.4);
  for (let x = 0; x < W; x++) {
    const dx = Math.abs(x - CX);
    if (dx <= half) {
      if (dx >= half - 2) set(x, y, 31 + (phase % 4));                 // glow rails
      else if (dx < 3 && phase % 3 === 0) set(x, y, 30);               // magenta dashes
      else set(x, y, 25 + (phase % 4));                                // road bands
    } else {
      set(x, y, isLine ? 17 + (phase % 8) : 35);                       // grid lines / ground
    }
  }
}
// converging vertical grid lines over the ground
for (let k = -8; k <= 8; k++) {
  if (Math.abs(k) < 2) continue;
  for (let y = HORIZON + 3; y < H; y++) {
    const x = Math.round(CX + k * 44 * ((y - HORIZON) / (H - HORIZON)));
    const dx = Math.abs(x - CX);
    const half = Math.floor(7 + (y - HORIZON) * 1.4);
    if (dx > half + 2) { set(x, y, 36); set(x + 1, y, 36); }
  }
}

const WORLD = { size: [W, H], palette: WORLD_PALETTE, cells: g.map((r) => r.join('')) };

// ---- the craft (rear view), authored at 36×20 and integer-doubled
// to the era frame ----
// 1 outline, 2 hull dark, 3 hull, 4 hull light, 5 trim magenta,
// 6 trim dim, 7 canopy cyan, 8 canopy deep, 9 white, a engine violet
const SHIP_CELLS = [
  '................1111',
  '...............177771',
  '..............17777771',
  '.............1788888871',
  '............118888888811',
  '.........1112233333322111',
  '.......112223334444333222 11'.replace(' ', '2'),
  '.....12233334444444444333 221'.replace(' ', '3'),
  '....1223334444444444444433 221'.replace(' ', '3'),
  '...122333444444999944444433221',
  '..12233344444499999944444 33221'.replace(' ', '4'),
  '..15533344444444444444444 33551'.replace(' ', '4'),
  '.155333344444444444444444433551',
  '.122333333333333333333333333221',
  '112233333333333333333333333 2211'.replace(' ', '3'),
  '1522333aa33333333333333aa3322 51'.replace(' ', '2'),
  '152233aaaa333333333333aaaa322251',
  '112233aaaa333333333333aaaa332211',
  '.11223aaaa333333333333aaaa32211.',
  '..111111111111111111111111111...',
].map(pad(36));

const double = (rows) => rows.flatMap((row) => {
  const wide = [...row].map((c) => c + c).join('');
  return [wide, wide];
});

const SHIP = {
  size: [72, 40],
  palette: ['#0c0618', '#241848', '#38246e', '#503a96', '#ff2bd6', '#b01e96', '#00ffe7', '#00a8c0', '#ffffff', '#7b2bff'],
  cells: double(SHIP_CELLS),
};

// ---- exhaust flicker cels (doubled to 64×10) ----
// 1 white core, 2 cyan, 3 violet
const EX_PALETTE = ['#ffffff', '#00ffe7', '#7b2bff'];
const exhaust = (cells) => ({ size: [64, 10], palette: EX_PALETTE, cells: double(cells.map(pad(32))) });
const EXHAUSTS = {
  'ex-a': exhaust(['....2112..............2112', '...231132............231132', '....2332..............2332', '.....33................33', '']),
  'ex-b': exhaust(['....2112..............2112', '...231132............231132', '...233332............233332', '....3333..............3333', '.....33................33']),
  'ex-c': exhaust(['....2112..............2112', '....21132.............21132', '....2332..............2332', '....33................33', '']),
};

const BOOST_BLINK = { target: 'boost', prop: 'reveal', values: [5, 5, 0], every: 4 };

export const NEON_GP_RECIPE = {
  kind: 'pixel-cutscene',
  register: '32bit',
  viewport: [W, H],
  fps: 24,
  sprites: { world: WORLD, ship: SHIP, ...EXHAUSTS },
  tileBanks: {},
  fonts: { micro: FONT_3X5 },
  scenes: [
    {
      id: 'attract',
      duration: 240,
      background: '#05010f',
      placements: [
        { id: 'world', sprite: 'world', cell: [0, 0] },
        { id: 'exhaust', sprite: 'ex-a', cell: [128, 206] },
        { id: 'ship', sprite: 'ship', cell: [124, 168] },
      ],
      captions: [
        { id: 'title', font: 'micro', text: 'NEON GP', cell: [8, 8], color: '#ff2bd6', scale: 3 },
        { id: 'lap', font: 'micro', text: 'LAP 02-05', cell: [242, 8], color: '#00ffe7', scale: 2 },
        { id: 'spd', font: 'micro', text: 'SPD 1187', cell: [8, 204], color: '#b6ff00', scale: 2 },
        { id: 'boost', font: 'micro', text: 'BOOST', cell: [274, 204], color: '#ff6b00', scale: 2 },
      ],
      tracks: [
        { target: '@fade', prop: 'level', color: '#05010f', keys: [{ at: 0, value: 8 }, { at: 12, value: 0 }, { at: 228, value: 0 }, { at: 239, value: 8 }] },
        // forward motion: the road and grid ramps rotate toward the viewer
        { target: 'world', prop: 'palette', range: ROAD_RANGE, values: [0, 5, 4, 3, 2, 1], every: 2 },
        { target: 'world', prop: 'palette', range: GRID_RANGE, values: [0, 7, 6, 5, 4, 3, 2, 1], every: 2 },
        // hover bob + engine flicker
        { target: 'ship', prop: 'cell', values: [[124, 168], [124, 166]], every: 10 },
        { target: 'exhaust', prop: 'cell', values: [[128, 206], [128, 204]], every: 10 },
        { target: 'exhaust', prop: 'sprite', values: ['ex-a', 'ex-b', 'ex-c'], every: 2 },
        BOOST_BLINK,
      ],
    },
  ],
};
