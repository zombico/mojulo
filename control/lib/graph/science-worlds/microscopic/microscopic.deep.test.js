import { describe, it, expect } from 'vitest';
import { solveMicroscopic } from './solve.js';
import { MICROSCOPIC_LAWS } from './laws.js';

// Every row of the microscopic law table, run on its own worked example: it solves, every gate holds, for two seeds,
// and the same seed solves the same way twice.
describe('science worlds: every microscopic law on its worked example', () => {
  for (const row of MICROSCOPIC_LAWS) {
    it(row.id, () => {
      for (const seed of [1, 2]) {
        const a = solveMicroscopic({ model: { ...row.example, seed } });
        expect(a.gaps).toEqual([]);
        expect(a.gates.filter((g) => !g.ok).map((g) => `${g.id}: ${g.detail}`)).toEqual([]);
        if (seed === 1) expect(JSON.stringify(solveMicroscopic({ model: { ...row.example, seed } }))).toBe(JSON.stringify(a));
      }
    });
  }
});
