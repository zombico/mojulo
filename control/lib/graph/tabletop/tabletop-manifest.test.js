import { describe, it, expect } from 'vitest';
import { resolveTabletop, tabletopManifestHtml, TABLETOP_GAMES } from './tabletop-manifest.js';

describe('tabletop manifest', () => {
  it('a game from the book, with its page options', () => {
    const { G, opts } = resolveTabletop({ kind: 'tabletop', game: 'chess', human: 'black', level: 'hard', clock: { base: 300, inc: 2 } });
    expect(G.title).toBe('Chess');
    expect(G.clock).toEqual({ base: 300000, inc: 2000, delay: 0 });
    expect(opts).toMatchObject({ human: 'black', level: 'hard', seed: 1 });
    expect(Object.keys(TABLETOP_GAMES)).toEqual(['chess', 'checkers']);
  });

  it('the book holds only games nobody owns; an economy is written out, its deal done from the seed', async () => {
    const { islandEconomy } = await import('./fixtures/island-economy.js');
    expect(() => resolveTabletop({ game: 'settlers' })).toThrow(/no game 'settlers'/);
    const { deal, seed, ...rules } = islandEconomy({ players: 3 });
    const a = resolveTabletop({ game: { ...rules, deal }, seed: 3 }).G;
    expect(a.deal).toBeUndefined();
    expect(Object.keys(a.numbers)).toHaveLength(18);
    expect(resolveTabletop({ game: { ...rules, deal }, seed: 4 }).G.numbers).not.toEqual(a.numbers);
  });

  it('a game written out is played as written', () => {
    const tiny = {
      board: { shape: 'square', cols: 3, rows: 3 },
      players: [{ id: 'a', facing: 'N' }, { id: 'b', facing: 'S' }],
      royal: true,
      pieces: { K: { royal: true, glyph: 'K', rules: [{ vec: ['N', 'NE'] }] }, R: { value: 5, glyph: 'R', rules: [{ vec: 'N', range: 'any' }] } },
      setup: { a: { K: ['A1'], R: ['C1'] }, b: { K: ['A3'] } },
    };
    const html = tabletopManifestHtml({ kind: 'tabletop', game: tiny, title: 'Rook endgame' });
    expect(html).toContain('<title>Rook endgame</title>');
  });

  it('refuses what it cannot play, at minting', () => {
    expect(() => resolveTabletop({ game: 'go' })).toThrow(/no game 'go'/);
    expect(() => resolveTabletop({ game: 'chess', players: 4 })).toThrow(/unknown key 'players'/);
    expect(() => resolveTabletop({ game: 'chess', colour: 'red' })).toThrow(/unknown key 'colour'/);
    expect(() => resolveTabletop({ game: { board: { shape: 'square', cols: 2, rows: 2 }, players: [{ id: 'a', facing: 'NNE' }], pieces: {} } })).toThrow(/no way 'NNE'/);
  });
});
