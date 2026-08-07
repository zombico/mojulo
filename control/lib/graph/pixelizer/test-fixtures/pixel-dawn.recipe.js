/**
 * pixel-dawn — the cutscene register proven at intro scale: a four-
 * scene, 576-frame (24s @ 24fps) title sequence where every cinematic
 * verb is closed grammar and no frame is authored.
 *
 * Storyboard:
 *   presents  (f0-95)    fade in from black, "MOJULO PRESENTS"
 *                        typewriter, fade back out
 *   dawn-pan  (f96-335)  a 10s camera pan across a dawn horizon —
 *                        gradient sky (parallax [0,1], sky-locked),
 *                        far mountains [1,4], near ridge [1,2],
 *                        ground [1,1] — while the 8-bit platformer
 *                        hero walks east through the 16-bit scene
 *                        (the vocabulary rides between registers
 *                        unchanged)
 *   title     (f336-431) white impact flash decaying over the star
 *                        field, "PIXEL DAWN" card, subtitle typewriter
 *   credits   (f432-575) credits scroll AS a camera move (captions in
 *                        world coords, '@camera' y track), fade to
 *                        black
 *
 * The dawn banks are built by deterministic helpers (loops, no dice);
 * the sun's 6-color radial ramp is the 16-bit register at work — the
 * same raster refuses to mint under '8bit' (see cutscene.test.js).
 */

import { PLATFORMER_RECIPE } from './platformer.recipe.js';
import { FONT_3X5 } from '../font-3x5.js';

const solidTile = (color) => ({
  size: [8, 8],
  palette: [color],
  cells: Array.from({ length: 8 }, () => '11111111'),
});

// 2x2-block checker between two adjacent ramp colors — the band seam.
const ditherTile = (a, b) => ({
  size: [8, 8],
  palette: [a, b],
  cells: Array.from({ length: 8 }, (_, y) =>
    Array.from({ length: 8 }, (_, x) => ((((x >> 1) + (y >> 1)) % 2) ? '2' : '1')).join('')),
});

const PEAK_L = ['.......1', '......11', '.....111', '....1111', '...11111', '..111111', '.1111111', '11111111'];
const PEAK_R = PEAK_L.map((r) => [...r].reverse().join(''));

const silhouetteBank = (color) => ({
  tileSize: [8, 8],
  bank: {
    peakL: { size: [8, 8], palette: [color], cells: PEAK_L },
    peakR: { size: [8, 8], palette: [color], cells: PEAK_R },
    fill: solidTile(color),
  },
  legend: { l: 'peakL', r: 'peakR', f: 'fill' },
});

// Zenith → horizon dawn ramp; solids '0'-'5', band-seam dithers 'a'-'e'.
const DAWN = ['#141024', '#2a1a4a', '#502a6a', '#8a3a6a', '#c85a4a', '#f0a050'];
const skyBank = {
  tileSize: [8, 8],
  bank: Object.fromEntries([
    ...DAWN.map((c, i) => [`s${i}`, solidTile(c)]),
    ...DAWN.slice(0, -1).map((c, i) => [`d${i}`, ditherTile(c, DAWN[i + 1])]),
  ]),
  legend: Object.fromEntries([
    ...DAWN.map((_, i) => [String(i), `s${i}`]),
    ...DAWN.slice(0, -1).map((_, i) => ['abcde'[i], `d${i}`]),
  ]),
};

const groundBank = {
  tileSize: [8, 8],
  bank: {
    rim: {
      size: [8, 8],
      palette: ['#100c20', '#1c1436', '#e88848'],
      cells: ['33333333', '22222222', '12112112', '11111111', '11211121', '11111111', '11111111', '11111111'],
    },
    deep: {
      size: [8, 8],
      palette: ['#100c20', '#1c1436'],
      cells: ['11111111', '11121112', '11111111', '11111111', '21112111', '11111111', '11111111', '11111111'],
    },
  },
  legend: { g: 'rim', h: 'deep' },
};

// The 16-bit proof raster: a 20x20 sun with a 6-color radial ramp —
// twice the 8-bit budget, half the 16-bit one.
const SUN_RAMP = ['#fff4d0', '#f8dc90', '#f8c060', '#f0a048', '#e08038', '#c86028'];
const SUN_BANDS = [3.2, 4.6, 6.0, 7.4, 8.6, 9.8];
const sunSprite = {
  size: [20, 20],
  palette: SUN_RAMP,
  cells: Array.from({ length: 20 }, (_, y) =>
    Array.from({ length: 20 }, (_, x) => {
      const r = Math.hypot(x - 9.5, y - 9.5);
      const band = SUN_BANDS.findIndex((b) => r < b);
      return band === -1 ? '.' : '123456'[band];
    }).join('')),
};

export const PIXEL_DAWN_RECIPE = {
  kind: 'pixel-cutscene',
  register: '16bit',
  viewport: [160, 96],
  fps: 24,
  sprites: {
    ...PLATFORMER_RECIPE.sprites,
    sun: sunSprite,
    star: { size: [3, 3], palette: ['#f8f4e8'], cells: ['.1.', '111', '.1.'] },
    spark: { size: [1, 1], palette: ['#b8b0d8'], cells: ['1'] },
  },
  tileBanks: {
    sky: skyBank,
    far: silhouetteBank('#241640'),
    near: silhouetteBank('#3a2255'),
    ground: groundBank,
  },
  fonts: { micro: FONT_3X5 },
  scenes: [
    {
      id: 'presents',
      duration: 96,
      background: '#0c0a16',
      captions: [
        { id: 'card', font: 'micro', text: 'MOJULO PRESENTS', cell: [21, 44], color: '#e8e4f0', scale: 2 },
      ],
      tracks: [
        { target: 'card', prop: 'reveal', keys: [{ at: 12, value: 0 }, { at: 72, value: 15 }] },
        { target: '@fade', prop: 'level', color: '#0c0a16', keys: [{ at: 0, value: 8 }, { at: 24, value: 0 }, { at: 78, value: 0 }, { at: 95, value: 8 }] },
      ],
    },
    {
      id: 'dawn-pan',
      duration: 240,
      background: '#141024',
      layers: [
        { id: 'sky', bank: 'sky', parallax: [0, 1], rows: ['0', '1', 'b', '2', 'c', '3', 'd', '4', 'e', '5'].map((ch) => ch.repeat(20)) },
        { id: 'far', bank: 'far', parallax: [1, 4], origin: [0, 56], rows: ['lr....lr.....lr....lr....', 'ff.lr.ff..lr.ff.lr.ff..lr', 'f'.repeat(25)] },
        { id: 'near', bank: 'near', parallax: [1, 2], origin: [0, 64], rows: ['lr..lr.lr...lr.lr..lr..lr.lr..', 'f'.repeat(30)] },
        { id: 'ground', bank: 'ground', parallax: [1, 1], origin: [0, 80], rows: ['g'.repeat(40), 'h'.repeat(40)] },
      ],
      placements: [
        { id: 'sun', sprite: 'sun', cell: [122, 34], fixed: true },
        { id: 'hero', sprite: 'hero-walk', cell: [20, 64], facing: 'E' },
      ],
      tracks: [
        { target: '@camera', prop: 'cell', keys: [{ at: 0, value: [0, 0] }, { at: 239, value: [160, 0] }] },
        { target: 'hero', prop: 'cell', keys: [{ at: 0, value: [20, 64] }, { at: 239, value: [230, 64] }] },
        { target: 'hero', prop: 'sprite', values: ['hero-walk', 'hero-stand'], every: 8 },
      ],
    },
    {
      id: 'title',
      duration: 96,
      background: '#100c22',
      placements: [
        { id: 'star-a', sprite: 'star', cell: [18, 10] },
        { id: 'star-b', sprite: 'star', cell: [74, 6] },
        { id: 'star-c', sprite: 'star', cell: [126, 14] },
        { id: 'star-d', sprite: 'star', cell: [40, 30] },
        { id: 'star-e', sprite: 'star', cell: [142, 34] },
        { id: 'spark-a', sprite: 'spark', cell: [30, 20] },
        { id: 'spark-b', sprite: 'spark', cell: [58, 12] },
        { id: 'spark-c', sprite: 'spark', cell: [96, 24] },
        { id: 'spark-d', sprite: 'spark', cell: [110, 8] },
        { id: 'spark-e', sprite: 'spark', cell: [150, 22] },
        { id: 'spark-f', sprite: 'spark', cell: [10, 36] },
        { id: 'spark-g', sprite: 'spark', cell: [86, 40] },
      ],
      captions: [
        { id: 'title', font: 'micro', text: 'PIXEL DAWN', cell: [21, 34], color: '#f8c058', scale: 3 },
        { id: 'subtitle', font: 'micro', text: 'A MOJULO CUTSCENE', cell: [46, 64], color: '#a89ec8' },
      ],
      tracks: [
        { target: '@fade', prop: 'level', color: '#fcf8f0', keys: [{ at: 0, value: 8 }, { at: 10, value: 0 }] },
        { target: 'subtitle', prop: 'reveal', keys: [{ at: 24, value: 0 }, { at: 60, value: 17 }] },
      ],
    },
    {
      id: 'credits',
      duration: 144,
      background: '#0c0a16',
      captions: [
        { id: 'cr-head', font: 'micro', text: 'PIXEL DAWN', cell: [41, 120], color: '#f8c058', scale: 2, fixed: false },
        { id: 'cr-1', font: 'micro', text: 'DIRECTED BY THE TRACK GRAMMAR', cell: [22, 148], color: '#a89ec8', fixed: false },
        { id: 'cr-2', font: 'micro', text: 'SPRITES FROM THE DREAM LOOP', cell: [26, 164], color: '#a89ec8', fixed: false },
        { id: 'cr-3', font: 'micro', text: 'EVERY FRAME DERIVED', cell: [42, 180], color: '#a89ec8', fixed: false },
        { id: 'cr-4', font: 'micro', text: 'NO FRAME WAS AUTHORED', cell: [38, 204], color: '#e8e4f0', fixed: false },
      ],
      tracks: [
        { target: '@camera', prop: 'cell', keys: [{ at: 0, value: [0, 0] }, { at: 120, value: [0, 140] }] },
        { target: '@fade', prop: 'level', color: '#0c0a16', keys: [{ at: 120, value: 0 }, { at: 143, value: 8 }] },
      ],
    },
  ],
};
