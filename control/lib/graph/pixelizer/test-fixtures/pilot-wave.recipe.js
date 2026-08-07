/**
 * pilot-wave — the double-slit ripple tank (double-slit-view.js)
 * transposed into the pixelizer, animated by PALETTE CYCLING: the
 * era's color-rotation trick carrying the physics exactly.
 *
 * The two-source field cos(k·r1 − ωt) + cos(k·r2 − ωt) factors as
 * 2·cos(k(r1+r2)/2 − ωt) · cos(k(r1−r2)/2 — a STATIC interference
 * envelope (the fringe fan, authored once into the raster: bright
 * band / dim band / transparent nodal lines) times a TRAVELING
 * carrier that is a pure phase shift. The raster never changes
 * between frames; two palette-rotation tracks (bright ramp + dim
 * ramp, in sync) are the propagation — the fourth instance of
 * animation-as-grammar, and the one that closes P6's palette-track
 * item.
 *
 * The pilot-wave reading is the storyboard: the wave floods through
 * both slits, single particles ride it one at a time along guided
 * paths, each lands at ONE spot on the screen — and the hits
 * accumulate into the fringe pattern (positions computed from the
 * same envelope, golden-sequence staggered, no dice).
 *
 * One scene, 288 frames @24fps, 200×120 viewport. Everything below
 * the constants is derived arithmetic — same recipe, same bytes.
 */

import { FONT_3X5 } from '../font-3x5.js';

const TAU = Math.PI * 2;
const VW = 200;
const VH = 120;
const LAM = 9;                 // wavelength in cells
const K = TAU / LAM;
const Y_BARRIER = 30;
const SLIT_X = [82, 118];      // slit centers → d = 36
const Y_SCREEN = 110;
const PHASES = 6;              // carrier quantized to 6 phase colors per band

// cyclic crest→trough→crest ramps; duplicates are deliberate (the
// carrier is symmetric about its extremes)
const BRIGHT = ['#c8f8ff', '#5ecfec', '#1f88b4', '#0b4066', '#1f88b4', '#5ecfec'];
const DIM = ['#2c5a70', '#1d4a60', '#123a50', '#0a2c40', '#123a50', '#1d4a60'];

const phaseChar = (band, pi) => {
  const n = band * PHASES + pi + 1; // 1-12
  return n <= 9 ? String(n) : 'abcdef'[n - 10];
};

// the whole tank as one 200×120 raster: plane wave above the barrier,
// two-source interference below, nodal lines transparent
const fieldCells = Array.from({ length: VH }, (_, y) =>
  Array.from({ length: VW }, (_, x) => {
    if (y >= Y_SCREEN) return '.';
    if (y < 14) return '.'; // dark header band — captions live here
    if (y < Y_BARRIER) {
      const pi = Math.floor((y / LAM) * PHASES) % PHASES;
      return phaseChar(0, pi);
    }
    const r1 = Math.hypot(x - SLIT_X[0], y - Y_BARRIER);
    const r2 = Math.hypot(x - SLIT_X[1], y - Y_BARRIER);
    const env = Math.abs(Math.cos((K * (r1 - r2)) / 2));
    const far = (r1 + r2) / 2 > 96 ? 0.14 : 0; // amplitude decays down-tank
    const avg = (K * (r1 + r2)) / 2;
    const pi = ((Math.floor((avg / TAU) * PHASES) % PHASES) + PHASES) % PHASES;
    if (env > 0.68 + far) return phaseChar(0, pi);
    if (env > 0.32 + far) return phaseChar(1, pi);
    return '.';
  }).join(''));

const FIELD = { size: [VW, VH], palette: [...BRIGHT, ...DIM], cells: fieldCells };

// the barrier occludes the field; the slit gaps are transparent, so
// the wave literally shows through them
const BARRIER = {
  size: [VW, 5],
  palette: ['#38304e', '#241e36'],
  cells: Array.from({ length: 5 }, (_, y) =>
    Array.from({ length: VW }, (_, x) => {
      if (SLIT_X.some((sx) => Math.abs(x - sx) <= 3)) return '.';
      return y === 0 ? '1' : '2';
    }).join('')),
};

const SCREEN = {
  size: [VW, VH - Y_SCREEN],
  palette: ['#38304e', '#141020'],
  cells: Array.from({ length: VH - Y_SCREEN }, (_, y) => (y === 0 ? '1' : '2').repeat(VW)),
};

const PARTICLE = { size: [3, 3], palette: ['#ffd98a'], cells: ['.1.', '111', '.1.'] };
const DOT_ON = { size: [2, 2], palette: ['#ffd98a'], cells: ['11', '11'] };
const DOT_OFF = { size: [2, 2], palette: ['#ffd98a'], cells: ['..', '..'] };

// hits land on the fringe maxima (spacing λL/d), more on the brighter
// central fringes; golden-ratio-free integer stagger, no dice
const FRINGES = [
  { x: 100, hits: 5 }, { x: 120, hits: 4 }, { x: 80, hits: 4 },
  { x: 141, hits: 3 }, { x: 59, hits: 3 }, { x: 162, hits: 2 }, { x: 38, hits: 2 },
];
const hitPlacements = [];
const hitTracks = [];
let hitIndex = 0;
for (const fringe of FRINGES) {
  for (let i = 0; i < fringe.hits; i++) {
    const id = `hit-${hitIndex}`;
    const cell = [fringe.x + (((hitIndex * 13) % 7) - 3), 111 + ((hitIndex * 5) % 4)];
    hitPlacements.push({ id, sprite: 'dot-off', cell });
    hitTracks.push({
      target: id,
      prop: 'sprite',
      keys: [{ at: 0, value: 'dot-off' }, { at: 150 + ((hitIndex * 7) % 23) * 4, value: 'dot-on' }],
    });
    hitIndex++;
  }
}

// palette rotation descending → the carrier travels AWAY from the
// sources (outward down the tank); both bands rotate in sync
const cycle = (range) => ({ target: 'field', prop: 'palette', range, values: [0, 5, 4, 3, 2, 1], every: 2 });

export const PILOT_WAVE_RECIPE = {
  kind: 'pixel-cutscene',
  register: '16bit',
  viewport: [VW, VH],
  fps: 24,
  sprites: {
    field: FIELD,
    barrier: BARRIER,
    screen: SCREEN,
    particle: PARTICLE,
    'dot-on': DOT_ON,
    'dot-off': DOT_OFF,
  },
  tileBanks: {},
  fonts: { micro: FONT_3X5 },
  scenes: [
    {
      id: 'tank',
      duration: 288,
      background: '#040b12',
      placements: [
        { id: 'field', sprite: 'field', cell: [0, 0] },
        { id: 'barrier', sprite: 'barrier', cell: [0, 28] },
        { id: 'screen', sprite: 'screen', cell: [0, Y_SCREEN] },
        { id: 'p1', sprite: 'particle', cell: [81, 30] },
        { id: 'p2', sprite: 'particle', cell: [117, 30] },
        ...hitPlacements,
      ],
      captions: [
        { id: 'title', font: 'micro', text: 'PILOT WAVE', cell: [4, 2], color: '#9adbe8' },
        { id: 'readout', font: 'micro', text: 'EACH HIT LANDS ON A FRINGE OF THE WAVE', cell: [4, 9], color: '#5a8ea0' },
      ],
      tracks: [
        cycle([1, 6]),
        cycle([7, 6]),
        {
          target: '@fade',
          prop: 'level',
          color: '#040b12',
          keys: [{ at: 0, value: 8 }, { at: 16, value: 0 }, { at: 272, value: 0 }, { at: 287, value: 8 }],
        },
        {
          // a guided trajectory: through the left slit, riding the
          // central fringe to the middle of the screen
          target: 'p1',
          prop: 'cell',
          keys: [
            { at: 40, value: [81, 30] }, { at: 80, value: [85, 50] }, { at: 120, value: [91, 74] },
            { at: 150, value: [96, 94] }, { at: 170, value: [98, 108] },
          ],
        },
        {
          // a second particle through the right slit to the first
          // side fringe
          target: 'p2',
          prop: 'cell',
          keys: [
            { at: 96, value: [117, 30] }, { at: 136, value: [114, 52] }, { at: 176, value: [117, 78] },
            { at: 206, value: [119, 108] },
          ],
        },
        ...hitTracks,
        { target: 'readout', prop: 'reveal', keys: [{ at: 180, value: 0 }, { at: 240, value: 38 }] },
      ],
    },
  ],
};
