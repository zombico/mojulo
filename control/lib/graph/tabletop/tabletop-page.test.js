import { describe, it, expect } from 'vitest';
import { tabletopPageHtml } from './tabletop-page.js';
import { CHESS } from './games/chess.js';
import { CHECKERS } from './games/checkers.js';

// The page's play is driven in a browser by hand; here, what it carries and that it is the same page twice.
const DATA = /const DATA = (\{.*?\});\n/s;

describe('tabletop page', () => {
  it('carries the board, the game, the kernel and the mind, and nothing closes its script early', () => {
    const html = tabletopPageHtml({ ...CHESS, title: 'Chess </script><b>' });
    expect(html).toContain('function buildTabletop()');
    expect(html).toContain('function buildTabletopMind(T)');
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    const data = JSON.parse(html.match(DATA)[1]);
    expect(data.L.cells).toHaveLength(64);
    expect(data.G.pieces.N.rules[0].vec).toEqual([1, 2]);
    expect(data.table.tokens).toHaveLength(64);
    expect(data.table.faces.filter((f) => f.cell >= 0)).toHaveLength(64);
  });

  it('seats the person at their own side: black turns the plan and the table half way', () => {
    const white = JSON.parse(tabletopPageHtml(CHECKERS).match(DATA)[1]);
    const red = JSON.parse(tabletopPageHtml(CHECKERS, { human: 'white' }).match(DATA)[1]);
    expect(white.plan.turn).toBe(0);
    expect(Math.abs(red.plan.turn)).toBe(180);
    expect(red.table.cams[0].matrix).not.toBe(white.table.cams[0].matrix);
  });

  it('is the same page twice, and refuses what it cannot seat', () => {
    expect(tabletopPageHtml(CHESS, { level: 'hard' })).toBe(tabletopPageHtml(CHESS, { level: 'hard' }));
    expect(() => tabletopPageHtml(CHESS, { human: 'red' })).toThrow(/'red' is not a player/);
    expect(() => tabletopPageHtml(CHESS, { level: 'grandmaster' })).toThrow(/level is easy, fair, hard/);
  });
});
