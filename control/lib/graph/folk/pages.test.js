// A PERSON'S PAGES (pages.js): what a townsperson says as the story moves on, the first page whose `if` holds. The
// concept: the pages' branches are exclusive and complete (on any state exactly one page is said, the first that holds),
// and each condition has its opposite.
import { describe, it, expect } from 'vitest';
import { isPaged, readPages, pageConds, defaultLines, notCond } from './pages.js';

// a condition read on a state of the bus's vars (the scenes' reading: scenes.js readCond)
const varOf = (c) => (c.flag !== undefined || c.not !== undefined ? `flag-${c.flag ?? c.not}` : c.has !== undefined ? `has-${c.has}` : c.done !== undefined ? `done-${c.done}` : c.chapter !== undefined ? `chapter-${c.chapter}` : c.var);
const holds = (c, st) => {
  const v = st[varOf(c)] ?? 0;
  if (c.not !== undefined) return v !== 1;
  if (c.flag !== undefined || c.has !== undefined || c.done !== undefined || c.chapter !== undefined) return v === 1;
  const op = ['gte', 'gt', 'lte', 'lt', 'eq', 'ne'].find((k) => Number.isFinite(c[k])), n = c[op];
  return { gte: v >= n, gt: v > n, lte: v <= n, lt: v < n, eq: v === n, ne: v !== n }[op];
};

describe('a person\'s pages', () => {
  const pages = readPages([
    { if: [{ has: 'crypt-key' }, { flag: 'met-king' }], say: 'You have the key, and the king\'s word.' },
    { if: { var: 'gold', gte: 50 }, say: ['A rich traveller.', 'The inn is that way.'] },
    { say: 'The crypt is sealed.' },
  ]);

  it('reads pages, refuses what is not one, and says the default page where no condition is read', () => {
    expect(isPaged([{ say: 'hi' }])).toBe(true);
    expect(isPaged(['hi'])).toBe(false);
    expect(pages.map((p) => p.lines.length)).toEqual([1, 2, 1]);
    expect(defaultLines(pages)).toEqual(['The crypt is sealed.']);
    expect(() => readPages([{ if: { has: 'key' } }])).toThrow(/say is text/);
    expect(() => readPages([{ if: { wins: 'x' }, say: 'hi' }])).toThrow(/a scene's condition/);
    expect(() => readPages([{ say: 'hi', when: 'later' }])).toThrow(/not a page's/);
  });

  it('each condition has its opposite', () => {
    const st = { 'flag-a': 1, 'has-k': 0, 'done-l': 1, 'chapter-c': 0, gold: 40 };
    for (const c of [{ flag: 'a' }, { not: 'a' }, { has: 'k' }, { done: 'l' }, { chapter: 'c' }, { var: 'gold', gte: 50 }, { var: 'gold', eq: 40 }]) expect(holds(notCond(c), st)).toBe(!holds(c, st));
  });

  it('on any state exactly one page is said: the first whose if holds', () => {
    const conds = pageConds(pages);
    // (every state of the three things the pages read)
    for (const key of [0, 1]) for (const met of [0, 1]) for (const gold of [0, 49, 50, 80]) {
      const st = { 'has-crypt-key': key, 'flag-met-king': met, gold };
      const said = conds.map((branches) => branches.filter((b) => b.every((c) => holds(c, st))).length);
      expect(said.reduce((a, b) => a + b, 0)).toBe(1);
      const first = pages.findIndex((p) => p.if.every((c) => holds(c, st)));
      expect(said[first]).toBe(1);
    }
    // (a page under one with no if is never said)
    expect(pageConds(readPages([{ say: 'always' }, { if: { flag: 'x' }, say: 'never' }]))[1]).toEqual([]);
  });
});
