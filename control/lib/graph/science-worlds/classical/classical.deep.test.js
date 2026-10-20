import { describe, it, expect } from 'vitest';
import { solveClassical } from './solve.js';
import { CLASSICAL_LAWS } from './laws.js';

// Every row of the classical law table, run on its own worked example (the card's example): it solves, every gate
// holds, and it solves the same way twice. A new row is swept the day it lands.
describe('science worlds: every classical law on its worked example', () => {
  for (const row of CLASSICAL_LAWS) {
    it(row.id, () => {
      const a = solveClassical({ model: row.example });
      expect(a.gaps).toEqual([]);
      expect(a.gates.filter((g) => !g.ok).map((g) => `${g.id}: ${g.detail}`)).toEqual([]);
      expect(JSON.stringify(solveClassical({ model: row.example }))).toBe(JSON.stringify(a));
    });
  }
});
