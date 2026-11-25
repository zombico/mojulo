// THE BOSS LAW, EVERY STORY'S BOSS (round-bosses.js): each held to the shape the drake is held to (boss-law.test.js),
// as its design asks: a careful party wins nearly always, a careless one mostly falls, the fight lasts 8 to 20 rounds, a
// party short of the ladder's last two fights wins less; where it telegraphs a charged blow, bracing is worth winning;
// where its second form turns its weaknesses round, reading the change is worth winning.
import { describe, it, expect } from 'vitest';
import { PACKS } from './battles.js';
import { ROUND_BOSS_IDS } from './round-bosses.js';
import { lawRuns, lawWins, lawMid, lawShape, LAW } from './boss-law.fixture.js';

describe('every story\'s boss, measured', () => {
  for (const boss of ROUND_BOSS_IDS) {
    it(`${boss} is a boss fight`, () => {
      const careful = lawRuns(boss, 'careful'), won = lawWins(careful), shape = lawShape(boss);
      expect(won, 'careful').toBeGreaterThanOrEqual(LAW.careful);
      expect(lawWins(lawRuns(boss, 'careless')), 'careless').toBeLessThanOrEqual(LAW.careless);
      expect(lawMid(careful), 'length').toBeGreaterThanOrEqual(LAW.mid[0]);
      expect(lawMid(careful), 'length').toBeLessThanOrEqual(LAW.mid[1]);
      expect(lawWins(lawRuns(boss, 'careful', { packs: PACKS.length - 2 })), 'a level short').toBeLessThan(won);
      if (shape.charges) expect(lawWins(lawRuns(boss, 'unbraced')), 'unbraced').toBeLessThan(won);
      if (shape.turns) expect(lawWins(lawRuns(boss, 'unread')), 'unread').toBeLessThan(won);
    });
  }
});
