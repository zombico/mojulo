import { describe, it, expect } from 'vitest';

import { validatePixelRecipe, resolveFrame, emitPixelSvg, reflectCellsEW } from './pixelizer.js';
import { RED_ROBOT_RECIPE } from './test-fixtures/red-robot.recipe.js';
import { PLATFORMER_RECIPE } from './test-fixtures/platformer.recipe.js';
import { CRIMSON_DUSK_RECIPE } from './test-fixtures/crimson-dusk.recipe.js';

const tinyRecipe = (over = {}) => ({
  kind: 'pixel-map',
  size: [8, 8],
  background: null,
  sprites: {
    arrow: {
      size: [3, 3],
      palette: ['#101018', '#d82818'],
      cells: ['1..', '12.', '1..'], // asymmetric on purpose — the flip must read
    },
  },
  placements: [{ id: 'a', sprite: 'arrow', cell: [2, 2], facing: 'W' }],
  animation: { fps: 2, tracks: [{ target: 'a', prop: 'facing', values: ['W', 'E'] }] },
  ...over,
});

describe('validatePixelRecipe — the mint gate', () => {
  it('accepts the tiny recipe and the red robot', () => {
    expect(validatePixelRecipe(tinyRecipe())).toEqual([]);
    expect(validatePixelRecipe(RED_ROBOT_RECIPE)).toEqual([]);
  });

  it('refuses a palette over the 3+transparent budget', () => {
    const r = tinyRecipe();
    r.sprites.arrow.palette = ['#000000', '#111111', '#222222', '#333333'];
    expect(validatePixelRecipe(r).some((e) => e.includes('palette must hold 1-3'))).toBe(true);
  });

  it('refuses a cell char outside the palette', () => {
    const r = tinyRecipe();
    r.sprites.arrow.cells = ['1..', '13.', '1..']; // '3' but palette holds 2
    expect(validatePixelRecipe(r).some((e) => e.includes('outside palette budget'))).toBe(true);
  });

  it('refuses ragged rows, off-map placements, and dangling refs', () => {
    const ragged = tinyRecipe();
    ragged.sprites.arrow.cells = ['1..', '12', '1..'];
    expect(validatePixelRecipe(ragged).some((e) => e.includes('3-char string'))).toBe(true);

    const offMap = tinyRecipe({ placements: [{ id: 'a', sprite: 'arrow', cell: [7, 7] }] });
    expect(validatePixelRecipe(offMap).some((e) => e.includes('leaves the 8x8 map'))).toBe(true);

    const dangling = tinyRecipe({ placements: [{ id: 'a', sprite: 'ghost', cell: [2, 2] }] });
    expect(validatePixelRecipe(dangling).some((e) => e.includes('unknown sprite'))).toBe(true);
  });

  it('refuses non-integer cells — integer cells are an invariant, not a preference', () => {
    const r = tinyRecipe({ placements: [{ id: 'a', sprite: 'arrow', cell: [2.5, 2] }] });
    expect(validatePixelRecipe(r).some((e) => e.includes('two integers'))).toBe(true);
  });

  it('refuses tracks aimed at nothing', () => {
    const r = tinyRecipe();
    r.animation.tracks = [{ target: 'nobody', prop: 'facing', values: ['W', 'E'] }];
    expect(validatePixelRecipe(r).some((e) => e.includes('matches no placement'))).toBe(true);
  });
});

describe('resolveFrame — declarative frame resolution', () => {
  it('is byte-identical across calls: same recipe + same t → same SVG', () => {
    const a = emitPixelSvg(RED_ROBOT_RECIPE, 0);
    const b = emitPixelSvg(RED_ROBOT_RECIPE, 0);
    expect(a).toBe(b);
  });

  it('resolves the facing track by t: frame 0 faces W, frame 1 faces E, frame 2 is frame 0 again', () => {
    expect(emitPixelSvg(tinyRecipe(), 0)).not.toBe(emitPixelSvg(tinyRecipe(), 1));
    expect(emitPixelSvg(tinyRecipe(), 2)).toBe(emitPixelSvg(tinyRecipe(), 0));
    expect(emitPixelSvg(RED_ROBOT_RECIPE, 2)).toBe(emitPixelSvg(RED_ROBOT_RECIPE, 0));
  });

  it('paints the E frame as the exact E-W reflect of the W frame — grammar, not data', () => {
    const w = resolveFrame(tinyRecipe(), 0);
    const e = resolveFrame(tinyRecipe(), 1);
    // sprite spans cells x 2..4; the flipped raster mirrors within that span
    for (let y = 2; y < 5; y++) {
      for (let x = 2; x < 5; x++) {
        expect(e.grid[y][x]).toBe(w.grid[y][2 + (4 - x)]);
      }
    }
  });

  it('reflectCellsEW reverses rows and is its own inverse', () => {
    const cells = ['1..', '12.', '1..'];
    expect(reflectCellsEW(cells)).toEqual(['..1', '.21', '..1']);
    expect(reflectCellsEW(reflectCellsEW(cells))).toEqual(cells);
  });

  it('refuses non-integer frame indices', () => {
    expect(() => resolveFrame(tinyRecipe(), 0.5)).toThrow(/non-negative integer/);
  });

  it('emits one merged path per color, crisp edges, cell-space viewBox', () => {
    const svg = emitPixelSvg(RED_ROBOT_RECIPE, 0);
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain('viewBox="0 0 24 20"');
    expect(svg).toContain('<rect'); // background is one rect, not per-cell paths
    expect(svg.match(/<path /g)).toHaveLength(3); // 3 sprite colors
  });
});

describe('tile lattice — the nametable tier', () => {
  it('accepts the platformer scene', () => {
    expect(validatePixelRecipe(PLATFORMER_RECIPE)).toEqual([]);
  });

  it('paints tiles first: ground tile top-left lands at map cell (0,56)', () => {
    const { grid } = resolveFrame(PLATFORMER_RECIPE, 0);
    expect(grid[56][0]).toBe('#fc9838'); // ground r0c0 = '3' light earth
  });

  it('refuses a row char missing from the legend, a bank ref missing from the bank, and a tile off tileSize', () => {
    const bad = structuredClone(PLATFORMER_RECIPE);
    bad.tiles.rows[0] = 'X..............';
    expect(validatePixelRecipe(bad).some((e) => e.includes('not in the legend'))).toBe(true);

    const dangling = structuredClone(PLATFORMER_RECIPE);
    dangling.tiles.legend.G = 'ghost';
    expect(validatePixelRecipe(dangling).some((e) => e.includes('unknown tile'))).toBe(true);

    const offSize = structuredClone(PLATFORMER_RECIPE);
    offSize.tiles.bank.cloud.size = [8, 4];
    expect(validatePixelRecipe(offSize).some((e) => e.includes('must match tileSize') || e.includes('exactly'))).toBe(true);
  });
});

describe('track grammar — sprite variants and cell paths', () => {
  it('refuses a variant whose size differs from the base sprite', () => {
    const bad = structuredClone(PLATFORMER_RECIPE);
    bad.sprites['chomper-squashed'].size = [16, 5];
    bad.sprites['chomper-squashed'].cells = bad.sprites['chomper-squashed'].cells.slice(11);
    expect(validatePixelRecipe(bad).some((e) => e.includes('variants share the base size'))).toBe(true);
  });

  it('refuses a cell track value that leaves the map', () => {
    const bad = structuredClone(PLATFORMER_RECIPE);
    bad.animation.tracks[1].values[3] = [110, 40]; // hero 16 wide off the 120 map
    expect(validatePixelRecipe(bad).some((e) => e.includes('leaves the 120x72 map'))).toBe(true);
  });

  it('resolves the stomp: chomper-a dome stands at f4, is gone at f5, pancake present', () => {
    const f4 = resolveFrame(PLATFORMER_RECIPE, 4);
    const f5 = resolveFrame(PLATFORMER_RECIPE, 5);
    // probes sit below/beside the landing hero so only the chomper answers
    expect(f4.grid[49][58]).toBe('#a05018'); // body row 9 at f4
    expect(f5.grid[49][58]).toBe(null); // body gone on impact frame
    expect(f5.grid[52][58]).toBe('#a05018'); // pancake body where walk frame was transparent
    expect(f4.grid[52][58]).toBe(null);
    expect(f5.grid[54][58]).toBe('#fce8c0'); // squashed pancake foot row
  });

  it('the storyboard loops: every track length divides 8, so frame 8 byte-equals frame 0', () => {
    expect(emitPixelSvg(PLATFORMER_RECIPE, 8)).toBe(emitPixelSvg(PLATFORMER_RECIPE, 0));
    expect(emitPixelSvg(PLATFORMER_RECIPE, 5)).not.toBe(emitPixelSvg(PLATFORMER_RECIPE, 4));
  });
});

describe('16bit register + layered lattices', () => {
  it('accepts the crimson-dusk screen and renders it byte-stable', () => {
    expect(validatePixelRecipe(CRIMSON_DUSK_RECIPE)).toEqual([]);
    expect(emitPixelSvg(CRIMSON_DUSK_RECIPE, 0)).toBe(emitPixelSvg(CRIMSON_DUSK_RECIPE, 0));
  });

  it('raises the budget to 15 and resolves hex cell chars to the upper palette', () => {
    const swatch = {
      kind: 'pixel-map',
      register: '16bit',
      size: [15, 1],
      background: null,
      sprites: {
        ramp: {
          size: [15, 1],
          palette: Array.from({ length: 15 }, (_, i) => `#0000${(10 + i).toString(16).padStart(2, '0')}`),
          cells: ['123456789abcdef'],
        },
      },
      placements: [{ id: 'r', sprite: 'ramp', cell: [0, 0] }],
    };
    expect(validatePixelRecipe(swatch)).toEqual([]);
    const { grid } = resolveFrame(swatch, 0);
    expect(grid[0][0]).toBe('#00000a'); // '1' -> palette[0]
    expect(grid[0][14]).toBe('#000018'); // 'f' -> palette[14]
  });

  it('refuses a 16th color in 16bit, and hex chars beyond budget in 8bit', () => {
    const over = structuredClone(CRIMSON_DUSK_RECIPE);
    over.sprites.hero.palette = Array.from({ length: 16 }, (_, i) => `#0000${(10 + i).toString(16).padStart(2, '0')}`);
    expect(validatePixelRecipe(over).some((e) => e.includes('palette must hold 1-15'))).toBe(true);

    const eight = {
      kind: 'pixel-map',
      size: [4, 1],
      background: null,
      sprites: { s: { size: [4, 1], palette: ['#111111', '#222222', '#333333'], cells: ['12a.'] } },
      placements: [{ id: 's', sprite: 's', cell: [0, 0] }],
    };
    expect(validatePixelRecipe(eight).some((e) => e.includes('outside palette budget 1-3'))).toBe(true);
  });

  it('paints tile layers in order: a later layer overpaints only where it is opaque', () => {
    const solid = (color) => ({ size: [2, 2], palette: [color], cells: ['11', '11'] });
    const half = { size: [2, 2], palette: ['#00ff00'], cells: ['1.', '.1'] };
    const r = {
      kind: 'pixel-map',
      size: [2, 2],
      background: null,
      tiles: [
        { tileSize: [2, 2], bank: { base: solid('#ff0000') }, legend: { b: 'base' }, rows: ['b'] },
        { tileSize: [2, 2], bank: { top: half }, legend: { t: 'top' }, rows: ['t'] },
      ],
      sprites: {},
      placements: [],
    };
    expect(validatePixelRecipe(r)).toEqual([]);
    const { grid } = resolveFrame(r, 0);
    expect(grid[0][0]).toBe('#00ff00'); // top layer opaque cell
    expect(grid[0][1]).toBe('#ff0000'); // top layer transparent -> base shows
  });
});
