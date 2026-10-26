// The arcade rules, every card: it reads through the kernel, and a short variant of it (a net game to three, a goal or
// a carry game one short period, a bat-and-ball game one innings) plays an exhibition between the minds to its end in an
// arcade register, the kernel's end.
import { describe, it, expect } from 'vitest';
import { ARCADE_SPORTS, ARCADE_SPORT_IDS, composeArcade } from './arcade-rules.js';
import { contestRead } from './contest-kernel.js';
import { matchArenaData } from './match-arena.js';
import { matchContext, newMatch, stepMatch } from './match-sim.js';
import { teamArenaData } from './team-arena.js';
import { teamContext, newTeam, stepTeam } from './team-sim.js';
import { inningsArenaData } from './innings-arena.js';
import { batContext, newBat, stepBat } from './bat-sim.js';

// each shape's arena and sim, and the family's short variant
const ARENA = {
  match: (sport) => { const ctx = matchContext(matchArenaData({ sport, players: 0, register: 'action', seed: 3 })); return { ctx, S: newMatch(ctx), step: stepMatch }; },
  team: (sport) => { const ctx = teamContext(teamArenaData({ sport, players: 0, register: 'action', seed: 3 })); return { ctx, S: newTeam(ctx), step: stepTeam }; },
  innings: (sport) => { const ctx = batContext(inningsArenaData({ sport, players: 0, register: 'action', seed: 3 })); return { ctx, S: newBat(ctx), step: stepBat }; },
};
const SHORT = { net: { score: { to: 3, by: 1 } }, goal: { score: { periods: 1, seconds: 30 } }, carry: { score: { periods: 1, seconds: 30 } }, innings: { innings: { innings: 1 } } };

describe('every arcade card', () => {
  for (const id of ARCADE_SPORT_IDS) {
    it(`${id}: reads through the kernel, and its short variant plays an exhibition to the end`, () => {
      const card = ARCADE_SPORTS[id], s = composeArcade(card, id);
      expect(() => contestRead(s.spec())).not.toThrow();
      const short = Object.fromEntries(Object.entries(SHORT[card.family]).map(([k, w]) => [k, { ...card[k], ...w }]));
      const { ctx, S, step } = ARENA[s.shape]({ id: `${id}-short`, from: id, ...short });
      for (let i = 0; i < 60 * 600 && !S.over; i++) step(S, [], ctx);
      expect(S.over, id).toBe(true);
      expect(S.calls.some((c) => c.kind === 'over')).toBe(true);
    }, 60000);
  }
});
