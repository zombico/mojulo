// THE BOSS LAW: the round's boss is a fight, measured. Its battles are deterministic, so a party walks the round's ladder
// for real (battles.js PACKS in order, resting between fights as at an inn), earning its levels, class points and skills
// as it goes, then meets the boss with what it earned, on many seeds, played four ways: careful (it braces when the boss
// gathers a charged blow, mends the hurt, strikes the boss's weakness as it stands, drinks an ether when the mage runs
// dry), the same never bracing, the same striking the weakness the boss first showed after it has changed, and careless
// (it only attacks). The careful party wins nearly always and the careless one mostly falls; a party that skipped the
// ladder's last fights wins less often (a level check); bracing for the telegraphed blow and reading the second form
// are each worth winning; and the fight lasts like a boss fight, neither a stroll nor a slog.
import { describe, it, expect } from 'vitest';
import { PACKS } from './battles.js';
import { FOE_PRESETS } from '../playscape/rpg/presets.js';
import { readRpg } from '../playscape/rpg/rpg.js';
import { rpgInit, rpgStart, rpgOptions, rpgRound, rpgStatsOf, rpgRest, rpgClose } from '../playscape/rpg/kernel.js';

// (the round's party as a party RPG composes it: the hero a mage, its joiners the rest; the round's turns the timeline's)
const PARTY = [['hero', 'mage'], ['party-1', 'rogue'], ['party-2', 'cleric'], ['party-3', 'fighter']];
// (the mage's spell for each element; what the party carries in: a few ethers, as the citadel's shops sell)
const ELEMENT_SPELL = [['ice', 'blizzard'], ['thunder', 'thunder'], ['fire', 'fire']];
const BAG = { 'held:bag:ether': 3 };
const SEEDS = Array.from({ length: 16 }, (_, k) => (k + 1) * 97);
const cfgOf = (seed) => readRpg({ rpg: {
  party: PARTY.map(([id, c]) => ({ id, class: c })),
  encounters: [...PACKS.map((foes, k) => ({ id: `pack-${k}`, foes })), { id: 'boss', foes: ['drake'], flee: false }],
  rules: { turns: 'timeline', seed },
} });

function fight(cfg, R, v, enc, way) {
  rpgStart(cfg, R, enc, v);
  let turns = 0;
  const share = (m) => R.m[m].hp / rpgStatsOf(cfg, R, m).hp;
  while (R.b.phase === 'command' && turns < 300) {
    const who = R.b.turn, ok = (id) => rpgOptions(cfg, R, who, v).skills.some((s) => s.id === id && s.ok);
    const hurt = R.b.ids.filter((m) => R.m[m].hp > 0).sort((a, b) => share(a) - share(b))[0];
    const foe = R.b.foes.find((f) => f.hp > 0);
    let pick = { act: 'attack', target: foe.uid };
    if (way !== 'careless') {
      if (way !== 'unbraced' && R.b.foes.some((f) => f.charged)) pick = { act: 'guard' };
      else if (ok('heal') && share(hurt) < 0.6) pick = { act: 'skill', skill: 'heal', target: hurt };
      else {
        // (its weakness struck: as it stands now, or, unread, the one it showed first)
        const weak = way === 'unread' ? FOE_PRESETS[foe.kind].weak ?? [] : foe.F.weak, spell = ELEMENT_SPELL.find(([el, k]) => weak.includes(el) && ok(k));
        if (spell) pick = { act: 'skill', skill: spell[1], target: foe.uid };
        else if (who === 'hero' && enc === 'boss' && R.m.hero.mp < 6 && v['held:bag:ether'] > 0) pick = { act: 'item', item: 'ether', target: who };
      }
    }
    rpgRound(cfg, R, { [who]: pick }, v);
    turns++;
  }
  const won = R.b.phase === 'won';
  rpgClose(cfg, R, v);
  return { won, turns };
}
// (the ladder walked with care, a rest after each fight; then the boss, played the given way)
function run(seed, way, packs = PACKS.length) {
  const cfg = cfgOf(seed), R = rpgInit(cfg), v = { ...BAG };
  for (let k = 0; k < packs; k++) { fight(cfg, R, v, `pack-${k}`, 'careful'); rpgRest(cfg, R, v); }
  return { ...fight(cfg, R, v, 'boss', way), level: R.m.hero.level, R, cfg };
}
const runs = (way, packs) => SEEDS.map((s) => run(s, way, packs));
const count = (rs) => rs.filter((r) => r.won).length;

describe('the round\'s boss, measured', () => {
  const careful = runs('careful');

  it('the ladder brings the party to the level the boss is tuned for, its skills earned', () => {
    expect(careful[0].level).toBeGreaterThanOrEqual(5);
    expect(careful[0].R.m.hero.learned).toMatchObject({ blizzard: 1, thunder: 1 });
  });

  it('a careful party wins nearly always, a careless one mostly falls; one short of the ladder\'s end wins less', () => {
    expect(count(careful)).toBeGreaterThanOrEqual(13);
    expect(count(runs('careless'))).toBeLessThanOrEqual(8);
    expect(count(runs('careful', PACKS.length - 2))).toBeLessThan(count(careful));
  });

  it('bracing for the telegraphed blow is worth winning', () => {
    expect(count(runs('unbraced'))).toBeLessThan(count(careful));
  });

  it('it changes under half its HP, and reading the change is worth winning (its old weakness now feeds it)', () => {
    const cfg = cfgOf(SEEDS[0]), R = rpgInit(cfg), v = {};
    rpgStart(cfg, R, 'boss', v);
    R.b.foes[0].hp = Math.floor(R.b.foes[0].max * 0.49);
    const beats = rpgRound(cfg, R, { [R.b.turn]: { act: 'guard' } }, v);
    expect(beats.find((b) => b.kind === 'phase')).toMatchObject({ who: 'f0', phase: 1 });
    expect(R.b.foes[0].F.absorb).toContain('ice');
    expect(cfg.foes.drake.absorb).not.toContain('ice');
    expect(count(runs('unread'))).toBeLessThan(count(careful));
  });

  it('lasts like a boss fight: neither a stroll nor a slog (the party\'s own turns, four a round)', () => {
    const t = careful.map((r) => r.turns).sort((a, b) => a - b), mid = t[t.length >> 1];
    expect(mid).toBeGreaterThanOrEqual(32);
    expect(mid).toBeLessThanOrEqual(80);
  });
});
