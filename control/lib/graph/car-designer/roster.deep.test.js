// The roster's sweep: balance holds over drawn fields of every size, two to eight, across seeds (roster.test.js holds
// the concepts on one field each).
import { describe, it, expect } from 'vitest';
import { solveRoster } from './roster.js';

describe('the roster, swept', () => {
  it('holds balance over drawn fields of 2 to 8, ten seeds each', () => {
    const failing = [];
    for (let n = 2; n <= 8; n++) for (let seed = 1; seed <= 10; seed++) {
      const F = solveRoster(n, { seed });
      if (!F.balance.holds) failing.push({ n, seed, bettered: F.balance.bettered, everything: F.balance.everything });
    }
    expect(failing).toEqual([]);
  }, 120_000);
});
