import { describe, it, expect } from 'vitest';
import { solveQuantum } from './solve.js';
import { QUANTUM_LAWS } from './laws.js';

// Every row of the quantum law table, run on its own worked example: it solves, every gate holds, for two seeds,
// the same seed solves the same way twice, and the row carries its sources and review date.
describe('science worlds: every quantum law on its worked example', () => {
  for (const row of QUANTUM_LAWS) {
    it(row.id, () => {
      expect(row.sources.length).toBeGreaterThan(0);
      expect(row.reviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const seed of [1, 2]) {
        const a = solveQuantum({ model: { ...row.example, seed } });
        expect(a.gaps).toEqual([]);
        expect(a.gates.filter((g) => !g.ok).map((g) => `${g.id}: ${g.detail}`)).toEqual([]);
        if (seed === 1) expect(JSON.stringify(solveQuantum({ model: { ...row.example, seed } }))).toBe(JSON.stringify(a));
      }
    });
  }
});
