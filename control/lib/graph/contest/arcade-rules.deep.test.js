// The arcade rules, every card: it reads through the kernel, and a short variant of it (to three, one game) plays an
// exhibition between two minds to its end in an arcade register, the kernel's winner named.
import { describe, it, expect } from 'vitest';
import { ARCADE_SPORTS, ARCADE_SPORT_IDS, composeArcade } from './arcade-rules.js';
import { contestRead } from './contest-kernel.js';
import { matchArenaData } from './match-arena.js';
import { matchContext, newMatch, stepMatch } from './match-sim.js';

const ARENA = { match: (sport) => { const ctx = matchContext(matchArenaData({ sport, players: 0, register: 'action', seed: 3 })); return { ctx, S: newMatch(ctx), step: stepMatch }; } };

describe('every arcade card', () => {
  for (const id of ARCADE_SPORT_IDS) {
    it(`${id}: reads through the kernel, and its short variant plays an exhibition to the end`, () => {
      const s = composeArcade(ARCADE_SPORTS[id], id);
      expect(() => contestRead(s.spec())).not.toThrow();
      const { ctx, S, step } = ARENA[s.shape]({ id: `${id}-3`, from: id, score: { to: 3, by: 1 } });
      for (let i = 0; i < 60 * 600 && !S.over; i++) step(S, [], ctx);
      expect(S.over, id).toBe(true);
      expect(['a', 'b']).toContain(S.winner);
    }, 60000);
  }
});
