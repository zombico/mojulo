// Every base building (programs.js BASE_USES), swept: planned on its own kit with no finding (every room seated and
// reached, none too deep, a goal on the top storey), and walked as a level from its way in to its goal.
import { describe, expect, it } from 'vitest';
import { planProgram, PROGRAMS, BASE_USES } from './programs.js';
import { withBuildingLevel } from '../structure/level.js';

describe('every base building plans clean and plays as a level', () => {
  for (const use of BASE_USES) {
    it(use, () => {
      const P = planProgram({ use, seed: 1 }, PROGRAMS[use].kit);
      expect(P.findings, use).toEqual([]);
      expect(P.goal, use).toBe(PROGRAMS[use].goal);
      const m = withBuildingLevel({ kind: 'stage', kit: PROGRAMS[use].kit, program: { use, seed: 1 }, level: {} }, 'lv');
      expect(m.game.mechanics.length, use).toBeGreaterThan(0);
    });
  }
});
