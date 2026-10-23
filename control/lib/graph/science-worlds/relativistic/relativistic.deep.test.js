import { describe, it, expect } from 'vitest';
import { solveRelativistic } from './solve.js';
import { RELATIVISTIC_LAWS } from './laws.js';

// Every row of the relativistic law table, run on its own worked example: it solves, every gate holds, the same
// model solves the same way twice, and the row carries its sources and review date.
describe('science worlds: every relativistic law on its worked example', () => {
  for (const row of RELATIVISTIC_LAWS) {
    it(row.id, () => {
      expect(row.sources.length).toBeGreaterThan(0);
      expect(row.reviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const a = solveRelativistic({ model: row.example });
      expect(a.gaps).toEqual([]);
      expect(a.gates.filter((g) => !g.ok).map((g) => `${g.id}: ${g.detail}`)).toEqual([]);
      expect(JSON.stringify(solveRelativistic({ model: row.example }))).toBe(JSON.stringify(a));
    });
  }
});
