// THE BOSS LAW: the round's boss is a fight, measured (boss-law.fixture.js: a party walks the round's ladder for real,
// earning its levels, class points and spells, then meets the boss played four ways on sixteen seeds). The default
// round's boss, the Ember Drake, held to a boss's shape: the careful party wins nearly always and the careless one mostly
// falls; a party that skipped the ladder's last fights wins less often (a level check); bracing for the telegraphed blow
// and reading the second form are each worth winning; the fight lasts like a boss fight, neither a stroll nor a slog.
// Every story's boss is held to the same law in boss-law.deep.test.js.
import { describe, it, expect } from 'vitest';
import { PACKS } from './battles.js';
import { rpgInit, rpgStart, rpgRound } from '../playscape/rpg/kernel.js';
import { lawCfg, lawRuns, lawWins, lawMid, LAW, LAW_SEEDS } from './boss-law.fixture.js';

describe('the round\'s boss, measured', () => {
  const careful = lawRuns('drake', 'careful');

  it('the ladder brings the party to the level the boss is tuned for, its spells earned', () => {
    expect(careful[0].level).toBeGreaterThanOrEqual(5);
    expect(careful[0].R.m.hero.learned).toMatchObject({ blizzard: 1, thunder: 1 });
  });

  it('a careful party wins nearly always, a careless one mostly falls; one short of the ladder\'s end wins less', () => {
    expect(lawWins(careful)).toBeGreaterThanOrEqual(LAW.careful);
    expect(lawWins(lawRuns('drake', 'careless'))).toBeLessThanOrEqual(LAW.careless);
    expect(lawWins(lawRuns('drake', 'careful', { packs: PACKS.length - 2 }))).toBeLessThan(lawWins(careful));
  });

  it('bracing for the telegraphed blow is worth winning', () => {
    expect(lawWins(lawRuns('drake', 'unbraced'))).toBeLessThan(lawWins(careful));
  });

  it('it changes under half its HP, and reading the change is worth winning (its old weakness now feeds it)', () => {
    const cfg = lawCfg('drake', LAW_SEEDS[0]), R = rpgInit(cfg), v = {};
    rpgStart(cfg, R, 'boss', v);
    R.b.foes[0].hp = Math.floor(R.b.foes[0].max * 0.49);
    const beats = rpgRound(cfg, R, { [R.b.turn]: { act: 'guard' } }, v);
    expect(beats.find((b) => b.kind === 'phase')).toMatchObject({ who: 'f0', phase: 1 });
    expect(R.b.foes[0].F.absorb).toContain('ice');
    expect(cfg.foes.drake.absorb).not.toContain('ice');
    expect(lawWins(lawRuns('drake', 'unread'))).toBeLessThan(lawWins(careful));
  });

  it('lasts like a boss fight: neither a stroll nor a slog (the party\'s own turns, four a round)', () => {
    expect(lawMid(careful)).toBeGreaterThanOrEqual(LAW.mid[0]);
    expect(lawMid(careful)).toBeLessThanOrEqual(LAW.mid[1]);
  });
});
