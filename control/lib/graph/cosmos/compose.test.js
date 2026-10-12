import { describe, it, expect } from 'vitest';

import { composeCandidates } from './compose.js';
import { sweep } from './sweep.js';

// What to build together, over the sweep's own rolls: it must count the same worlds the sweep does.
describe('composeCandidates', () => {
  const opts = { n: 300, seed: 7 };
  const c = composeCandidates(opts), s = sweep(opts);

  it('is seeded: the same arguments give the same report', () => {
    expect(composeCandidates(opts)).toEqual(c);
  });

  it('every world short of makeable waits on exactly one recipe; the recipes count what the sweep counts', () => {
    expect(c.recipes.reduce((n, r) => n + r.worlds, 0)).toBe(s.verdicts.gaps + s.verdicts.blocked);
    for (const r of c.recipes) expect([...r.packages].sort()).toEqual(r.packages);
  });

  it('a one-package recipe is the worlds that package makes on its own, as the sweep ranks them', () => {
    const made = Object.fromEntries(s.unlock.packages.map((p) => [p.id, p.makeable]));
    for (const r of c.recipes.filter((x) => x.packages.length === 1)) expect(made[r.packages[0]]).toBeGreaterThanOrEqual(r.worlds);
  });

  it('a pair splits its worlds into made by one alone and made only together; synergy comes from two-package recipes', () => {
    for (const p of c.pairs) expect(p.alone + p.synergy).toBe(p.worlds);
    const twoOf = (a, b) => c.recipes.some((r) => r.packages.includes(a) && r.packages.includes(b));
    for (const p of c.pairs.filter((x) => x.synergy)) expect(twoOf(p.a, p.b)).toBe(true);
    const ranked = c.pairs.map((p) => p.synergy);
    expect(ranked).toEqual([...ranked].sort((a, b) => b - a));
  });
});
