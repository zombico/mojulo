/**
 * brickster skin — raster = world, overlay = communication.
 *
 * The raster carries ONLY the world: the well frame, the settled
 * stack, the active piece, and its landing ghost. There is not one
 * glyph tile in the bank — SCORE / LINES / LEVEL, the HOLD/NEXT
 * labels, and the GAME OVER interruption live in the OVERLAY, a pure
 * view-model (resolveOverlay) rendered as real text: native
 * resolution, screen-readable, selectable, i18n-ready. The hold/next
 * previews stay diegetic (they ARE pieces) but as their own tiny
 * world rasters, placed by the communication layer beside their text
 * labels. buildWorldRecipe(state) is pure and a live frame passes
 * validatePixelRecipe like any minted recipe; emitComposedSvg bakes
 * both layers into one SVG — chunky 8-bit world beside crisp system
 * text — as the visible proof of the split.
 */

import { emitPixelSvg } from './pixelizer.js';
import { WELL_W, WELL_H, HIDDEN, ROTATIONS, cellsOf, dropDistance, levelOf } from './brickster-core.js';

const COLS = WELL_W + 2; // wall + 10 well + wall
const ROWS = WELL_H - HIDDEN + 2; // top wall + 20 visible + bottom wall

const bevel = (palette) => ({
  size: [8, 8],
  palette,
  cells: [
    '11111113',
    '12222223',
    '12222223',
    '12222223',
    '12222223',
    '12222223',
    '12222223',
    '13333333',
  ],
});

export const BANK = {
  'block-i': bevel(['#a0f8f8', '#00b8c8', '#006870']),
  'block-j': bevel(['#a8c0f8', '#2048d8', '#102478']),
  'block-l': bevel(['#f8d0a0', '#e08000', '#7c4400']),
  'block-o': bevel(['#f8f8a8', '#e0c000', '#887400']),
  'block-s': bevel(['#b8f8a8', '#38c020', '#187010']),
  'block-t': bevel(['#e0a8f8', '#a038d8', '#581878']),
  'block-z': bevel(['#f8a8a8', '#d82020', '#781010']),
  wall: bevel(['#b8b8c8', '#68687c', '#38383f']),
  ghost: {
    size: [8, 8],
    palette: ['#5c6470'],
    cells: [
      '11111111',
      '1......1',
      '1......1',
      '1......1',
      '1......1',
      '1......1',
      '1......1',
      '11111111',
    ],
  },
};

const LEGEND = {
  i: 'block-i',
  j: 'block-j',
  l: 'block-l',
  o: 'block-o',
  s: 'block-s',
  t: 'block-t',
  z: 'block-z',
  '#': 'wall',
  g: 'ghost',
};

/** rot-0 cells normalized to a 4×2 char grid — the hold/next preview. */
export function previewRows(type) {
  const cells = ROTATIONS[type][0];
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  const grid = [Array(4).fill('.'), Array(4).fill('.')];
  for (const [x, y] of cells) grid[y - minY][x - minX] = type.toLowerCase();
  return grid.map((row) => row.join(''));
}

export const pad = (n, w) => String(n).padStart(w, '0').slice(-w);

/**
 * Pure state → the world raster: the well and nothing else. No glyphs,
 * no side panel, no GAME OVER text — those are the overlay's job.
 */
export function buildWorldRecipe(state) {
  const well = [];
  for (let y = HIDDEN; y < WELL_H; y++) well.push([...state.board[y]]);
  const put = (cells, ch) => {
    for (const [x, y] of cells) {
      if (y >= HIDDEN && well[y - HIDDEN][x] === '.') well[y - HIDDEN][x] = ch;
    }
  };
  if (state.active) {
    const { type, rot, x, y } = state.active;
    put(cellsOf(type, rot, x, y + dropDistance(state)), 'g');
    // active overrides its own ghost cells
    for (const [cx, cy] of cellsOf(type, rot, x, y)) {
      if (cy >= HIDDEN) well[cy - HIDDEN][cx] = type.toLowerCase();
    }
  }
  const wellRows = well.map((row) => row.join(''));
  const rows = [
    '#'.repeat(COLS),
    ...wellRows.map((row) => `#${row}#`),
    '#'.repeat(COLS),
  ];

  return {
    kind: 'pixel-map',
    register: '8bit',
    size: [COLS * 8, ROWS * 8],
    background: '#0c0c14',
    tiles: { tileSize: [8, 8], bank: BANK, legend: LEGEND, rows },
    sprites: {},
    placements: [],
  };
}

export const renderWorldSvg = (state, scale = 4) => emitPixelSvg(buildWorldRecipe(state), 0, { scale });

/** A single piece as its own 4×2 world raster — the diegetic hold/next preview. */
export function buildPreviewRecipe(type) {
  const rows = type ? previewRows(type) : ['....', '....'];
  return {
    kind: 'pixel-map',
    register: '8bit',
    size: [4 * 8, 2 * 8],
    background: null,
    tiles: { tileSize: [8, 8], bank: BANK, legend: LEGEND, rows },
    sprites: {},
    placements: [],
  };
}

export const renderPreviewSvg = (type, scale = 4) => emitPixelSvg(buildPreviewRecipe(type), 0, { scale });

/** The communication layer as a pure view-model — no pixels, just facts. */
export function resolveOverlay(state) {
  return {
    title: 'BRICKSTER',
    score: pad(state.score, 6),
    lines: pad(state.lines, 4),
    level: pad(levelOf(state), 2),
    hold: state.hold ?? null,
    next: state.queue[0] ?? null,
    status: state.over ? 'over' : 'playing',
    message: state.over ? 'GAME OVER' : null,
  };
}

const FONT_STACK = "'SF Mono', Menlo, Consolas, monospace";

/**
 * Both layers in one SVG: the world raster plus a real-text overlay.
 * Register-independent — pass renderWorld/renderPreview to compose the
 * same accessible HUD over any skin's world (the 16-bit skin reuses
 * this verbatim), which is the render seam made a single picture.
 */
export function emitComposedSvg(state, {
  scale = 4,
  renderWorld = renderWorldSvg,
  renderPreview = renderPreviewSvg,
  bg = '#14141f',
} = {}) {
  const o = resolveOverlay(state);
  const worldW = COLS * 8 * scale;
  const worldH = ROWS * 8 * scale;
  const panelW = 200;
  const W = 16 + worldW + panelW + 16;
  const H = worldH + 24;
  const px = 16 + worldW + 28;
  const previewScale = Math.max(2, Math.round(scale * 0.6));

  const label = (text, y) =>
    `  <text x="${px}" y="${y}" font-family=${JSON.stringify(FONT_STACK)} font-size="11" letter-spacing="3" fill="#7e8698">${text}</text>`;
  const stat = (name, value, y) => `${label(name, y)}
  <text x="${px}" y="${y + 26}" font-family=${JSON.stringify(FONT_STACK)} font-size="24" fill="#f2f4f8">${value}</text>`;
  const preview = (type, y) =>
    renderPreview(type, previewScale).replace('<svg ', `<svg x="${px}" y="${y}" `);

  const message = o.message
    ? `
  <g>
    <rect x="${16 + worldW / 2 - 130}" y="${H / 2 - 32}" width="260" height="64" rx="8" fill="#0c0c16" opacity="0.94" stroke="#3a4258"/>
    <text x="${16 + worldW / 2}" y="${H / 2 - 2}" text-anchor="middle" font-family=${JSON.stringify(FONT_STACK)} font-size="18" fill="#f2f4f8">${o.message}</text>
    <text x="${16 + worldW / 2}" y="${H / 2 + 22}" text-anchor="middle" font-family=${JSON.stringify(FONT_STACK)} font-size="11" fill="#7e8698">enter to restart</text>
  </g>`
    : '';

  const world = renderWorld(state, scale).replace('<svg ', '<svg x="16" y="12" ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  ${world}
  <text x="${px}" y="40" font-family=${JSON.stringify(FONT_STACK)} font-size="15" letter-spacing="4" fill="#e8b040">${o.title}</text>
${label('NEXT', 78)}
  ${preview(o.next, 86)}
${stat('SCORE', o.score, 180)}
${stat('LINES', o.lines, 246)}
${stat('LEVEL', o.level, 312)}
${label('HOLD', H - 116)}
  ${preview(o.hold, H - 108)}
  <text x="${px}" y="${H - 20}" font-family=${JSON.stringify(FONT_STACK)} font-size="11" fill="#565e70">clear the lines</text>
  ${message}
</svg>`;
}
