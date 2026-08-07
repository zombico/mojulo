import { describe, it, expect } from 'vitest';

import { newGame, step, gravityMs, levelOf, ROTATIONS, PIECES, WELL_H } from './brickster-core.js';
import { buildWorldRecipe, renderWorldSvg, resolveOverlay, emitComposedSvg, BANK } from './brickster-skin.js';
import { validatePixelRecipe } from './pixelizer.js';

const play = (state, actions) => actions.reduce(step, state);

describe('brickster core — rotation system', () => {
  it('generates SRS rotations: I rot-1 is the vertical bar in column 2, O never turns', () => {
    expect(ROTATIONS.I[1]).toEqual([[2, 0], [2, 1], [2, 2], [2, 3]]);
    expect(ROTATIONS.O[1]).toEqual(ROTATIONS.O[0]);
    expect(ROTATIONS.O[3]).toEqual(ROTATIONS.O[0]);
  });

  it('wall-kicks a T off the left wall: rot 1→2 at x=-1 lands at x=0 via kick (+1,0)', () => {
    const state = { ...newGame(1), active: { type: 'T', rot: 1, x: -1, y: 5 } };
    const turned = step(state, 'cw');
    expect(turned.active.rot).toBe(2);
    expect(turned.active.x).toBe(0);
    expect(turned.active.y).toBe(5);
  });

  it('refuses an impossible rotation without changing state', () => {
    // I pinned vertically in a 1-wide slot between filled columns
    const board = newGame(1).board.map((row, y) => (y > 4 ? 'zz.zzzzzzz' : row));
    const state = { ...newGame(1), board, active: { type: 'I', rot: 1, x: 0, y: 6 } };
    const turned = step(state, 'cw');
    expect(turned.active).toEqual(state.active);
  });
});

describe('brickster core — bag, movement, gravity', () => {
  it('deals 7-bags: the first seven pieces are a permutation of all seven', () => {
    const state = newGame(42);
    const first7 = [state.active.type, ...state.queue.slice(0, 6)].sort();
    const second7 = state.queue.slice(6, 13).sort();
    expect(first7).toEqual([...PIECES].sort());
    expect(second7).toEqual([...PIECES].sort());
  });

  it('clamps movement at the wall', () => {
    const state = { ...newGame(1), active: { type: 'T', rot: 0, x: 3, y: 2 } };
    const walled = play(state, Array(10).fill('left'));
    expect(walled.active.x).toBe(0);
  });

  it('speeds up with level', () => {
    const l0 = newGame(1);
    expect(gravityMs(l0)).toBe(800);
    expect(gravityMs({ ...l0, lines: 10 })).toBe(600);
  });
});

describe('brickster core — lock, clear, hold, game over', () => {
  it('clears a completed line: O dropped into the gap scores and the stack shifts down', () => {
    const base = newGame(9);
    const board = base.board.map((row, y) => (y === WELL_H - 1 ? 'zzzzzzzz..' : row));
    const state = { ...base, board, active: { type: 'O', rot: 0, x: 7, y: 2 }, score: 0, lines: 0 };
    const after = step(state, 'hardDrop');
    expect(after.lines).toBe(1);
    expect(after.score).toBe(100 + 2 * 18); // one clear at level 0 + hard drop distance
    expect(after.board[WELL_H - 1]).toBe('........oo'); // O remnant fell into the cleared row
    expect(after.board[WELL_H - 2]).toBe('..........');
  });

  it('holds once per drop, swaps after a lock', () => {
    const state = newGame(3);
    const first = state.active.type;
    const upNext = state.queue[0];
    const held = step(state, 'hold');
    expect(held.hold).toBe(first);
    expect(held.active.type).toBe(upNext);
    expect(step(held, 'hold')).toBe(held); // second hold refused, state unchanged
    const afterLock = step(held, 'hardDrop');
    expect(afterLock.holdUsed).toBe(false);
    const swapped = step(afterLock, 'hold');
    expect(swapped.active.type).toBe(first); // the stashed piece comes back
  });

  it('tops out when a piece locks in the hidden rows', () => {
    const base = newGame(5);
    const board = base.board.map((row, y) => (y >= 2 ? 'ooooooooo.' : row));
    const state = { ...base, board, active: { type: 'O', rot: 0, x: 3, y: 0 } };
    const after = step(state, 'hardDrop');
    expect(after.over).toBe(true);
    expect(step(after, 'left')).toBe(after); // inputs ignored after top-out
    expect(step(after, 'restart').over).toBe(false);
  });
});

describe('brickster — determinism and the world seam', () => {
  const SCRIPT = ['left', 'cw', 'hardDrop', 'right', 'right', 'hold', 'softDrop', 'ccw', 'hardDrop', 'tick', 'hardDrop'];

  it('same seed + same actions → byte-identical state and world raster', () => {
    const a = play(newGame(77), SCRIPT);
    const b = play(newGame(77), SCRIPT);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(renderWorldSvg(a)).toBe(renderWorldSvg(b));
  });

  it('a live world raster passes the pixelizer mint gate', () => {
    expect(validatePixelRecipe(buildWorldRecipe(newGame(11)))).toEqual([]);
    expect(validatePixelRecipe(buildWorldRecipe(play(newGame(11), SCRIPT)))).toEqual([]);
  });

  it('the world raster carries only the world: pieces, wall, ghost — not one glyph tile', () => {
    // The bank is the whole closed vocabulary; no text lives in the raster.
    const bankIds = Object.keys(BANK);
    expect(bankIds.every((id) => id.startsWith('block-') || id === 'wall' || id === 'ghost')).toBe(true);
    const recipe = buildWorldRecipe(newGame(11));
    expect(recipe.tiles.rows.some((row) => row.includes('g'))).toBe(true); // the landing ghost
    // legend only maps piece/wall/ghost chars — a stray letter row would fail the mint gate
    expect(Object.keys(recipe.tiles.legend).sort()).toEqual(['#', 'g', 'i', 'j', 'l', 'o', 's', 't', 'z']);
  });
});

describe('brickster — the overlay is readable text, not rendered pixels', () => {
  it('resolveOverlay is a pure view-model: score/lines/level as facts, no pixels', () => {
    const o = resolveOverlay({ ...newGame(11), score: 1234, lines: 27 });
    expect(o).toMatchObject({ title: 'BRICKSTER', score: '001234', lines: '0027', level: '02', status: 'playing', message: null });
    expect(o.next).toBe(newGame(11).queue[0]); // the diegetic next piece, by type
  });

  it('carries the current level into the overlay', () => {
    expect(resolveOverlay({ ...newGame(11), lines: 42 }).level).toBe(String(levelOf({ ...newGame(11), lines: 42 })).padStart(2, '0'));
  });

  it('GAME OVER is an overlay message, and never enters the world raster', () => {
    const over = { ...newGame(11), over: true, active: null };
    expect(resolveOverlay(over).message).toBe('GAME OVER');
    expect(resolveOverlay(over).status).toBe('over');
    // the world raster still mints clean and contains no text at all
    expect(validatePixelRecipe(buildWorldRecipe(over))).toEqual([]);
    expect(renderWorldSvg(over)).not.toContain('<text');
  });

  it('the composed still renders the overlay as real <text> beside the raster world', () => {
    const state = { ...newGame(11), score: 500, lines: 3 };
    const svg = emitComposedSvg(state);
    expect(svg).toContain('<text'); // native-resolution, selectable, screen-readable
    expect(svg).toContain('BRICKSTER');
    expect(svg).toContain('000500');
    expect(svg).toContain('SCORE');
    // the world raster on its own has none of that
    expect(renderWorldSvg(state)).not.toContain('SCORE');
  });
});

describe('brickster — the 16-bit skin over the same reducer', () => {
  const SCRIPT = ['left', 'cw', 'hardDrop', 'right', 'hold', 'hardDrop', 'ccw', 'hardDrop'];

  it('a live world raster passes the mint gate in the 16bit register', async () => {
    const { buildWorldRecipe16 } = await import('./test-fixtures/brickster-skin-16.js');
    expect(validatePixelRecipe(buildWorldRecipe16(newGame(11)))).toEqual([]);
    expect(validatePixelRecipe(buildWorldRecipe16(SCRIPT.reduce(step, newGame(11))))).toEqual([]);
    const over = { ...newGame(11), over: true, active: null };
    expect(validatePixelRecipe(buildWorldRecipe16(over))).toEqual([]);
  });

  it('same state resolves byte-stable through both worlds independently', async () => {
    const { renderWorldSvg16 } = await import('./test-fixtures/brickster-skin-16.js');
    const state = SCRIPT.reduce(step, newGame(77));
    expect(renderWorldSvg16(state)).toBe(renderWorldSvg16(state));
    expect(renderWorldSvg(state)).toBe(renderWorldSvg(state));
    expect(renderWorldSvg16(state)).not.toBe(renderWorldSvg(state)); // different registers, same truth
  });

  it('shares the register-independent overlay: the text HUD is identical across skins', async () => {
    const { resolveOverlay: overlay16 } = await import('./test-fixtures/brickster-skin-16.js');
    const state = SCRIPT.reduce(step, newGame(77));
    expect(overlay16(state)).toEqual(resolveOverlay(state)); // communication is not a pixel budget
  });
});
