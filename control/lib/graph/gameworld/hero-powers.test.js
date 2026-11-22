import { describe, it, expect } from 'vitest';
import { CITY_POWERS, POWER_IDS, powerSidearm } from './hero-powers.js';
import { POWERS } from '../brawl/brawl-powers.js';
import { BEAMS } from '../playscape/elements/beams.js';
import { readHeroKit, kitArsenal, kitLegendOf } from './hero-kits.js';
import { readArsenal, lowerSidearm } from './combos.js';

describe('the street\'s powers in the round', () => {
  it('lower each card onto the range button: its uses a magazine that recharges, its beam\'s colour, its joules', () => {
    // one hitscan and one lob: the two ways the round slot plays a power
    for (const mode of ['auto', 'draw']) {
      const id = POWER_IDS.find((k) => CITY_POWERS[k].play.mode === mode), S = powerSidearm(id), card = POWERS[id], c = BEAMS[card.beam].color;
      if (mode === 'auto') { expect(S.magazine).toBe(card.stock * (CITY_POWERS[id].play.perUse ?? 1)); expect(S.reload).toBe(CITY_POWERS[id].recharge); }
      else expect(S.nock * card.stock).toBeCloseTo(CITY_POWERS[id].recharge, 1);
      expect(S.colour).toBe(c.reduce((n, v) => n * 256 + Math.round(v * 255), 0));
      // the sidearm's own reader takes it, and its lowering carries the tint and the joules to the runtime
      const A = readArsenal({ ...kitArsenal(readHeroKit('swinger')), ranged: [S] });
      const W = lowerSidearm(A.ranged[0]);
      expect(W.fxColor).toBe(S.colour);
      if (card.knock) expect(W.knock).toEqual({ ...card.knock });
      if (S.splash) expect(W.splashRadius).toBe(S.splash);
      expect(S).not.toHaveProperty('perUse');
    }
    expect(() => powerSidearm('wall')).toThrow(/beam, nova/);
  });
  it('ride a hero kit\'s range button, said in its legend', () => {
    const K = readHeroKit({ from: 'swinger', ranged: 'nova' });
    expect(kitArsenal(K).ranged[0]).toEqual(powerSidearm('nova'));
    expect(kitLegendOf(K)).toMatch(/Q {2}nova/);
    expect(() => readHeroKit({ from: 'swinger', ranged: 'storm' })).toThrow(/or a power/);
  });
});
