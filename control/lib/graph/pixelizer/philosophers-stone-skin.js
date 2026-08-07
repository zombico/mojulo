/**
 * philosophers stone skin — raster = world, overlay = communication.
 *
 * The board is a tile lattice: one 16×16 beveled gem per cell, palette-swapped
 * across the six reagents, with distinct marks for the three alchemical
 * products (Aqua Vitae line, Athanor area, the Philosopher's Stone). The gem
 * shape is generated once (a lit round gem, top-left highlight) and reused for
 * every reagent + product — the doctor-pill "one cells array × N palettes" move.
 * Score / moves / Stones / the reagent legend live in the OVERLAY, a pure
 * view-model (resolveOverlay) rendered as real text.
 *
 * Register note: the cabinet is labelled '32bit' (its era), but the SVG raster
 * engine (pixelizer.js) tops out at the 16-bit budget — 15 colors + transparent
 * per tile. Each gem carries its own 6-shade ramp, so a 6-reagent board shows
 * 30-40 colors at once: SNES-grade, well past the NES 3-color register. This is
 * exactly neon-gp's posture (32bit label, 16bit rasters underneath).
 */

import { emitPixelSvg } from './pixelizer.js';

const TILE = 16;

// Six reagent ramps (dark rim → gleam), cute-alchemy hues.
const REAGENTS = [
  ['#5c1414', '#8f1f1f', '#c8342f', '#e8564a', '#f59182', '#ffd9cf'], // 0 Cinnabar
  ['#5c4a08', '#8f7412', '#d0a41c', '#e8c840', '#f5e58a', '#fff8d0'], // 1 Sulfur
  ['#08484a', '#0f6f72', '#17a0a4', '#2fcbc8', '#7ce6e0', '#d6fbf6'], // 2 Vitriol
  ['#0c4a1e', '#14702f', '#1fa047', '#33c866', '#7ae69a', '#d6f8e2'], // 3 Verdigris
  ['#141a5c', '#1f2f8f', '#2f4fc8', '#4a6fe8', '#8aa2f5', '#d0d9ff'], // 4 Azurite
  ['#3a1150', '#5c1f7f', '#8a2fb8', '#b04ae0', '#d18af5', '#f0d6ff'], // 5 Amethyst
];
const REAGENT_NAMES = ['Cinnabar', 'Sulfur', 'Vitriol', 'Verdigris', 'Azurite', 'Amethyst'];
const STONE_PALETTE = ['#5c0c14', '#a81f1f', '#e0342f', '#f5a03a', '#ffd066', '#fff2c0']; // rubedo red→gold
const FLASH = '#fff6c0'; // the product mark colour (palette index 7 on line/area tiles)

/** A lit round gem as shade indices 1(rim)..6(gleam); '.' outside the disc. */
function gemField() {
  const R = 7.7;
  const cx = 7.5;
  const cy = 7.5;
  const rows = [];
  for (let y = 0; y < TILE; y++) {
    let row = '';
    for (let x = 0; x < TILE; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { row += '.'; continue; }
      if (d > R - 1.05) { row += '1'; continue; }
      const lit = -(dx + dy) / (R * 1.15); // top-left brightest
      row += String(lit > 0.6 ? 6 : lit > 0.28 ? 5 : lit > -0.05 ? 4 : lit > -0.42 ? 3 : 2);
    }
    rows.push(row);
  }
  const set = (x, y, v) => { if (rows[y][x] !== '.') rows[y] = rows[y].slice(0, x) + v + rows[y].slice(x + 1); };
  set(5, 4, '6'); set(6, 4, '6'); set(5, 5, '6'); set(4, 5, '6'); // crisp gleam
  return rows;
}
const GEM = gemField();

const stamp = (base, on, ch) => base.map((row, y) =>
  [...row].map((c, x) => (c !== '.' && on(x, y) ? ch : c)).join(''));

// Aqua Vitae: a bright bar across the middle (its clearing axis).
const withBar = (axis) => stamp(GEM, (x, y) => (axis === 'h' ? y === 7 || y === 8 : x === 7 || x === 8), '7');
// Athanor: a bright diamond core (the furnace).
const withCore = () => stamp(GEM, (x, y) => Math.abs(x - 7.5) + Math.abs(y - 7.5) <= 3, '7');
// The Stone: a four-point sparkle in gleam along the centre cross.
const withSparkle = () => stamp(GEM, (x, y) => (x >= 6 && x <= 9 && (y === 7 || y === 8)) || (y >= 6 && y <= 9 && (x === 7 || x === 8)), '6');

const raster = (palette, cells) => ({ size: [TILE, TILE], palette, cells });

// Build the tile bank + legend + a (kind,color,axis) → legend-char lookup.
const BANK = {};
const LEGEND = {};
let nextCh = 0x61; // 'a'
const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const claim = (id, tile) => { const ch = CHARS[nextCh - 0x61]; nextCh++; BANK[id] = tile; LEGEND[ch] = id; return ch; };

const gemCh = [];
const barHCh = [];
const barVCh = [];
const coreCh = [];
for (let r = 0; r < REAGENTS.length; r++) {
  gemCh[r] = claim(`gem-${r}`, raster(REAGENTS[r], GEM));
  barHCh[r] = claim(`lh-${r}`, raster([...REAGENTS[r], FLASH], withBar('h')));
  barVCh[r] = claim(`lv-${r}`, raster([...REAGENTS[r], FLASH], withBar('v')));
  coreCh[r] = claim(`ar-${r}`, raster([...REAGENTS[r], FLASH], withCore()));
}
const stoneCh = claim('stone', raster(STONE_PALETTE, withSparkle()));

const SEL_SPRITE = raster(['#fff2a0'], [
  '1111111111111111',
  '1..............1',
  '1..............1',
  '1..............1',
  '1..............1',
  '1..............1',
  '1..............1',
  '1..............1',
  '1..............1',
  '1..............1',
  '1..............1',
  '1..............1',
  '1..............1',
  '1..............1',
  '1..............1',
  '1111111111111111',
]);

const cellChar = (cell) => {
  if (!cell) return '.';
  if (cell.kind === 'stone') return stoneCh;
  if (cell.kind === 'line') return cell.axis === 'v' ? barVCh[cell.c] : barHCh[cell.c];
  if (cell.kind === 'area') return coreCh[cell.c];
  return gemCh[cell.c];
};

const tileIdOf = (cell) => (cell.kind === 'stone' ? 'stone'
  : cell.kind === 'line' ? `l${cell.axis === 'v' ? 'v' : 'h'}-${cell.c}`
    : cell.kind === 'area' ? `ar-${cell.c}`
      : `gem-${cell.c}`);

/** One cell as its own tiny SVG sprite — the shell's per-gem animation layer draws these. */
export function renderCellSvg(cell, scale = 4) {
  if (!cell) return '';
  return emitPixelSvg({
    kind: 'pixel-map', register: '16bit', size: [TILE, TILE], background: null,
    tiles: { tileSize: [TILE, TILE], bank: { s: BANK[tileIdOf(cell)] }, legend: { a: 's' }, rows: ['a'] },
    sprites: {}, placements: [],
  }, 0, { scale });
}

/** Pure state → raster recipe: the gem board, plus the armed-cell frame. */
export function buildWorldRecipe(state) {
  const rows = state.grid.map((row) => row.map(cellChar).join(''));
  const placements = state.sel
    ? [{ id: 'sel', sprite: 'sel', cell: [state.sel.x * TILE, state.sel.y * TILE] }]
    : [];
  return {
    kind: 'pixel-map',
    register: '16bit',
    size: [state.W * TILE, state.H * TILE],
    background: '#161022',
    tiles: { tileSize: [TILE, TILE], bank: BANK, legend: LEGEND, rows },
    sprites: { sel: SEL_SPRITE },
    placements,
  };
}

export const renderWorldSvg = (state, scale = 3) => emitPixelSvg(buildWorldRecipe(state), 0, { scale });

/** The communication layer as a pure view-model — no pixels, just facts. */
export function resolveOverlay(state) {
  const timed = state.mode === 'timed';
  return {
    title: "PHILOSOPHER'S STONE",
    mode: state.mode,
    score: String(Math.min(state.score, 9999999)).padStart(7, '0'),
    moves: state.moves,
    stones: state.stones,
    chain: (state.lastTrace || []).length,
    level: state.level,
    target: state.target,
    progress: timed ? Math.max(0, state.score - state.levelStartScore) : 0,
    timeSec: timed ? Math.ceil(Math.max(0, state.timeLeft) / 1000) : null,
    timeFrac: timed ? Math.max(0, Math.min(1, state.timeLeft / state.timeCap)) : 0,
    status: state.over ? 'over' : 'playing',
    message: state.over ? "TIME'S UP" : null,
  };
}

const FONT_STACK = "'SF Mono', Menlo, Consolas, monospace";
export { REAGENTS, REAGENT_NAMES };

/** Both layers in one SVG: the gem world + a real-text stat panel + legend. */
export function emitComposedSvg(state, { scale = 3 } = {}) {
  const o = resolveOverlay(state);
  const F = JSON.stringify(FONT_STACK);
  const worldW = state.W * TILE * scale;
  const worldH = state.H * TILE * scale;
  const panelW = 224;
  const W = 16 + worldW + panelW + 16;
  const H = Math.max(worldH + 24, 400);
  const px = 16 + worldW + 28;
  const stat = (label, value, y, color = '#f2eefb') => `
  <text x="${px}" y="${y}" font-family=${F} font-size="12" letter-spacing="3" fill="#7e6f96">${label}</text>
  <text x="${px}" y="${y + 24}" font-family=${F} font-size="22" fill="${color}">${value}</text>`;

  let panel = `<text x="${px}" y="38" font-family=${F} font-size="14" letter-spacing="2" fill="#c9a227">${o.title}</text>`;
  let y = 76;
  if (o.mode === 'timed') {
    const barW = 168;
    const barColor = o.timeFrac > 0.5 ? '#33c866' : o.timeFrac > 0.25 ? '#e8c840' : '#e8564a';
    panel += stat('LEVEL', o.level, y); y += 56;
    panel += `
  <text x="${px}" y="${y}" font-family=${F} font-size="12" letter-spacing="3" fill="#7e6f96">TIME</text>
  <text x="${px + barW}" y="${y}" text-anchor="end" font-family=${F} font-size="12" fill="${barColor}">${o.timeSec}s</text>
  <rect x="${px}" y="${y + 8}" width="${barW}" height="10" rx="5" fill="#241a30"/>
  <rect x="${px}" y="${y + 8}" width="${Math.round(barW * o.timeFrac)}" height="10" rx="5" fill="${barColor}"/>`;
    y += 46;
    panel += stat('SCORE', o.score, y); y += 56;
    panel += stat('TARGET', `${o.progress} / ${o.target}`, y); y += 56;
    panel += stat('STONES', o.stones, y); y += 48;
  } else {
    panel += stat('SCORE', o.score, y); y += 56;
    panel += stat('MOVES', o.moves, y); y += 56;
    panel += stat('STONES', o.stones, y); y += 48;
  }
  const legend = REAGENT_NAMES.map((name, i) => `
  <rect x="${px}" y="${y + i * 16}" width="10" height="10" rx="2" fill="${REAGENTS[i][3]}"/>
  <text x="${px + 18}" y="${y + 9 + i * 16}" font-family=${F} font-size="11" fill="#8a7ea6">${name}</text>`).join('');
  const world = renderWorldSvg(state, scale).replace('<svg ', '<svg x="16" y="12" ');
  const msg = o.message ? `
  <rect x="16" y="${H / 2 - 30}" width="${worldW}" height="60" fill="#0c0812" opacity="0.92"/>
  <text x="${16 + worldW / 2}" y="${H / 2 + 6}" text-anchor="middle" font-family=${F} font-size="20" fill="#e8564a">${o.message} · reached level ${o.level}</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#120c1c"/>
  ${world}
  ${panel}
  ${legend}
  ${msg}
</svg>`;
}
