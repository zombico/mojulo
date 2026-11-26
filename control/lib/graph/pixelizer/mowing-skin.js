/**
 * mowing skin — raster = world, overlay = communication (as fishing-skin.js). The raster is the lawn from above in its
 * frame: long grass, each pass of the deck a stripe (light one way, dark the other), the paths, the trees and the park's
 * things, the flowerbeds (trampled ones bare earth) and the mower turned the way it goes; the share cut, the clock and
 * the word for what just happened are the overlay's view-model. buildWorldRecipe(state) is pure and a live frame passes
 * validatePixelRecipe like any minted recipe.
 */
import { emitPixelSvg } from './pixelizer.js';

const solid = (hex) => ({ size: [4, 4], palette: [hex], cells: ['1111', '1111', '1111', '1111'] });
const MOWER = ['#c8402a', '#1e1e22', '#9aa0a6'];

export const BANK = {
  frame: solid('#5b4a3a'),
  grass: { size: [4, 4], palette: ['#3f6e2a', '#4f8634'], cells: ['1211', '1121', '2111', '1112'] },
  light: { size: [4, 4], palette: ['#8cc55a', '#97cd64'], cells: ['1111', '2222', '1111', '2222'] },
  dark: { size: [4, 4], palette: ['#679f40', '#5f963a'], cells: ['1111', '2222', '1111', '2222'] },
  path: { size: [4, 4], palette: ['#cdbb94', '#bfac84'], cells: ['1112', '1111', '2111', '1111'] },
  tree: { size: [4, 4], palette: ['#2b5a22', '#1d4318', '#6fae45'], cells: ['3113', '1221', '1221', '3113'] },
  thing: { size: [4, 4], palette: ['#8b8f95', '#6c7076'], cells: ['2222', '2112', '2112', '2222'] },
  flowers: { size: [4, 4], palette: ['#4f8634', '#e85a8a', '#f2d24b'], cells: ['1213', '2111', '1131', '3112'] },
  earth: { size: [4, 4], palette: ['#7a5a3a', '#5e4430'], cells: ['1211', '1112', '2111', '1121'] },
  'mower-e': { size: [4, 4], palette: MOWER, cells: ['.11.', '1213', '1113', '.11.'] },
  'mower-w': { size: [4, 4], palette: MOWER, cells: ['.11.', '3121', '3111', '.11.'] },
  'mower-n': { size: [4, 4], palette: MOWER, cells: ['.33.', '1211', '1111', '.11.'] },
  'mower-s': { size: [4, 4], palette: MOWER, cells: ['.11.', '1111', '1121', '.33.'] },
};
export const LEGEND = { '#': 'frame', g: 'grass', l: 'light', d: 'dark', '=': 'path', T: 'tree', o: 'thing', '*': 'flowers', x: 'earth', E: 'mower-e', W: 'mower-w', N: 'mower-n', S: 'mower-s' };

// (the mower's tile by the way it faces, nearest of the four)
const faceOf = (h) => { const a = ((h % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), k = Math.round(a / (Math.PI / 2)) % 4; return ['E', 'S', 'W', 'N'][k]; };

/** Pure state → the world raster. */
export function buildWorldRecipe(state) {
  const mi = Math.floor(state.mower.x), mj = Math.floor(state.mower.y), face = faceOf(state.mower.h);
  const rows = ['#'.repeat(state.W + 2)];
  for (let j = 0; j < state.H; j++) {
    let r = '#';
    for (let i = 0; i < state.W; i++) {
      const t = state.rows[j][i], c = state.cut[j][i];
      r += i === mi && j === mj ? face : t === '.' ? (c === 1 ? 'l' : c === 2 ? 'd' : 'g') : t === '*' ? (c === 3 ? 'x' : '*') : t === '#' ? 'o' : t;
    }
    rows.push(r + '#');
  }
  rows.push('#'.repeat(state.W + 2));
  return {
    kind: 'pixel-map',
    register: '8bit',
    size: [(state.W + 2) * 4, (state.H + 2) * 4],
    background: '#7fb84e',
    tiles: { tileSize: [4, 4], bank: BANK, legend: LEGEND, rows },
    sprites: {},
    placements: [],
  };
}

export const renderWorldSvg = (state, scale = 4) => emitPixelSvg(buildWorldRecipe(state), 0, { scale });

/** The communication layer as a pure view-model. */
export function resolveOverlay(state) {
  const pct = Math.floor((100 * state.mown) / Math.max(1, state.total));
  return {
    title: 'MOWING',
    score: String(state.score).padStart(4, '0'),
    mown: `${pct}%`,
    time: `${Math.ceil(state.left / 1000)}s`,
    trampled: state.trampled,
    status: state.over ? 'over' : 'playing',
    message: state.over ? (state.mown >= state.total ? 'Every blade cut' : 'Out of time') : state.bump > 0 ? 'Bump! Steer round it' : state.trampled ? 'Mind the flowerbeds' : 'Cut the long grass in stripes',
  };
}
