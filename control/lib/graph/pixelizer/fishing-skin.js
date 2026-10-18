/**
 * fishing skin — raster = world, overlay = communication (as brickster-skin.js). The raster is the water column in its
 * frame, the catch zone, the fish (coloured by its kind) and the catch meter beside it; the score, the casts and the
 * word for what just happened are the overlay's view-model. buildWorldRecipe(state) is pure and a live frame passes
 * validatePixelRecipe like any minted recipe.
 */
import { emitPixelSvg } from './pixelizer.js';
import { ZONE, FISH } from './fishing-core.js';

const WATER_W = 6, ROWS = 30;            // the column: 6 tiles wide, 30 tall (4 px tiles)
const COLS = 1 + WATER_W + 1 + 2 + 1;    // frame, water, frame, meter, frame

const solid = (hex) => ({ size: [4, 4], palette: [hex], cells: ['1111', '1111', '1111', '1111'] });
const fish = (body, fin) => ({ size: [4, 4], palette: [body, fin], cells: ['....', '1112', '1112', '....'] });

export const BANK = {
  frame: solid('#5b4a3a'),
  water: { size: [4, 4], palette: ['#16324f', '#1d4166'], cells: ['1111', '1211', '1111', '1112'] },
  zone: { size: [4, 4], palette: ['#4fbf6a', '#2f8a4a'], cells: ['1111', '2112', '2112', '1111'] },
  meter: solid('#e8b040'),
  empty: solid('#2a2a34'),
  'fish-minnow': fish('#c8d0d8', '#8a96a2'),
  'fish-trout': fish('#c87a5a', '#7a4a3a'),
  'fish-bass': fish('#6a8a3a', '#3a5a22'),
  'fish-pike': fish('#9ab060', '#5a6a30'),
  'fish-koi': fish('#f0b020', '#d05a10'),
};
export const LEGEND = { '#': 'frame', '~': 'water', z: 'zone', m: 'meter', o: 'empty', a: 'fish-minnow', b: 'fish-trout', c: 'fish-bass', d: 'fish-pike', e: 'fish-koi' };
const FISH_CHAR = Object.fromEntries(FISH.map((f, i) => [f.id, 'abcde'[i]]));

/** The row (0 the top) a height in the column (0 the bottom … 1 the surface) falls in. */
const rowOf = (h) => Math.max(0, Math.min(ROWS - 1, ROWS - 1 - Math.floor(h * ROWS)));

/** Pure state → the world raster. */
export function buildWorldRecipe(state) {
  const zoneRows = new Set();
  for (let r = rowOf(state.zone.z + ZONE); r <= rowOf(state.zone.z); r++) zoneRows.add(r);
  const fishRow = state.fish ? rowOf(state.fish.f) : -1, fishChar = state.fish ? FISH_CHAR[state.fish.id] : '.';
  const filled = Math.round(state.progress * ROWS);
  const rows = ['#'.repeat(COLS)];
  for (let r = 0; r < ROWS; r++) {
    const water = Array.from({ length: WATER_W }, (_, x) => (r === fishRow && (x === 2 || x === 3) ? fishChar : zoneRows.has(r) ? 'z' : '~'));
    const meter = ROWS - r <= filled ? 'mm' : 'oo';
    rows.push(`#${water.join('')}#${meter}#`);
  }
  rows.push('#'.repeat(COLS));
  return {
    kind: 'pixel-map',
    register: '8bit',
    size: [COLS * 4, (ROWS + 2) * 4],
    background: '#0c0c14',
    tiles: { tileSize: [4, 4], bank: BANK, legend: LEGEND, rows },
    sprites: {},
    placements: [],
  };
}

export const renderWorldSvg = (state, scale = 4) => emitPixelSvg(buildWorldRecipe(state), 0, { scale });

const nameOf = (id) => FISH.find((f) => f.id === id)?.name ?? id;

/** The communication layer as a pure view-model. */
export function resolveOverlay(state) {
  const said = state.phase === 'caught' ? `Caught a ${nameOf(state.last)}!` : state.phase === 'escaped' ? `The ${nameOf(state.last)} got away` : 'Hold SPACE to keep it in the green';
  return {
    title: 'FISHING',
    score: String(state.score).padStart(4, '0'),
    casts: `${Math.min(state.cast + (state.phase === 'reel' ? 1 : 0), state.casts)}/${state.casts}`,
    caught: state.caught.length,
    status: state.over ? 'over' : 'playing',
    message: state.over ? `Done: ${state.caught.length} caught` : said,
  };
}
