import { describe, it, expect } from 'vitest';
import { resolveTabletop, tabletopManifestHtml, TABLETOP_GAMES } from './tabletop-manifest.js';

describe('tabletop manifest', () => {
  it('a game from the book, with its page options', () => {
    const { G, opts } = resolveTabletop({ kind: 'tabletop', game: 'chess', human: 'black', level: 'hard', clock: { base: 300, inc: 2 } });
    expect(G.title).toBe('Chess');
    expect(G.clock).toEqual({ base: 300000, inc: 2000, delay: 0 });
    expect(opts).toMatchObject({ human: 'black', level: 'hard', seed: 1 });
    expect(Object.keys(TABLETOP_GAMES)).toEqual(['chess', 'checkers', 'settlers']);
  });

  it('settlers dealt by the seed, for three or four, its bank exchange an option', () => {
    const a = resolveTabletop({ game: 'settlers', seed: 3, players: 3 }).G;
    expect(a.players).toHaveLength(3);
    expect(a.exchange).toBeUndefined();
    expect(resolveTabletop({ game: 'settlers', seed: 3, exchange: 4 }).G.exchange).toEqual({ rate: 4 });
    expect(resolveTabletop({ game: 'settlers', seed: 4 }).G.numbers).not.toEqual(a.numbers);
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
    expect(() => resolveTabletop({ game: 'chess', players: 4 })).toThrow(/players is settlers/);
    expect(() => resolveTabletop({ game: 'settlers', clock: { base: 60 } })).toThrow(/clock is for a game of moves/);
    expect(() => resolveTabletop({ game: 'chess', colour: 'red' })).toThrow(/unknown key 'colour'/);
    expect(() => resolveTabletop({ game: { board: { shape: 'square', cols: 2, rows: 2 }, players: [{ id: 'a', facing: 'NNE' }], pieces: {} } })).toThrow(/no way 'NNE'/);
  });
});
