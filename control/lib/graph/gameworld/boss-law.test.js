// THE BOSS LAW: the round's boss is a fight, measured. Its battles are deterministic, so the party the ladder brings to it
// (battles.js PACKS walked in order, every member taking each fight's XP whole) fights it over many seeds, three ways:
// careful (it guards when the boss gathers a charged blow, mends the hurt, strikes its weakness), the same but never
// guarding, and careless (it only attacks). At the level the ladder brings it to, the careful party wins nearly always and
// the careless one mostly falls; a level short, the careful party wins less often (a level check); bracing for the
// telegraphed blow is worth winning; and the fight lasts like a boss fight, neither a stroll nor a slog.
import { describe, it, expect } from 'vitest';
import { PACKS } from './battles.js';
import { FOE_PRESETS } from '../playscape/rpg/presets.js';
import { readRpg } from '../playscape/rpg/rpg.js';
import { rpgInit, rpgStart, rpgOptions, rpgRound, rpgStatsOf, rpgXpFor } from '../playscape/rpg/kernel.js';

// (the round's party as a party RPG composes it: the hero a mage, its joiners the rest; the round's turns the timeline's)
const PARTY = [['hero', 'mage'], ['party-1', 'rogue'], ['party-2', 'cleric'], ['party-3', 'fighter']];
const SEEDS = Array.from({ length: 16 }, (_, k) => (k + 1) * 97);
const cfgAt = (level, seed) => readRpg({ rpg: { party: PARTY.map(([id, c]) => ({ id, class: c, level })), encounters: [{ id: 'boss', foes: ['drake'], flee: false }], rules: { turns: 'timeline', seed } } });

// (the level the ladder brings the party to: every pack's XP, each member's whole)
function ladderLevel() {
  const cfg = cfgAt(1, 1), xp = PACKS.flat().reduce((a, k) => a + FOE_PRESETS[k].xp, 0);
  let L = 1;
  while (rpgXpFor(cfg, L + 1) <= xp) L++;
  return L;
}

function fight(level, seed, way) {
  const cfg = cfgAt(level, seed), R = rpgInit(cfg), v = {};
  rpgStart(cfg, R, 'boss', v);
  let turns = 0;
  const share = (m) => R.m[m].hp / rpgStatsOf(cfg, R, m).hp;
  while (R.b.phase === 'command' && turns < 300) {
    const who = R.b.turn, ok = (id) => rpgOptions(cfg, R, who, v).skills.some((s) => s.id === id && s.ok);
    const hurt = R.b.ids.filter((m) => R.m[m].hp > 0).sort((a, b) => share(a) - share(b))[0];
    let pick = { act: 'attack', target: 'f0' };
    if (way !== 'careless') {
      if (way === 'careful' && R.b.foes.some((f) => f.charged)) pick = { act: 'guard' };
      else if (ok('heal') && share(hurt) < 0.6) pick = { act: 'skill', skill: 'heal', target: hurt };
      else if (ok('blizzard')) pick = { act: 'skill', skill: 'blizzard', target: 'f0' };
    }
    rpgRound(cfg, R, { [who]: pick }, v);
    turns++;
  }
  return { won: R.b.phase === 'won', turns };
}
const wins = (level, way) => SEEDS.map((s) => fight(level, s, way));
const count = (rs) => rs.filter((r) => r.won).length;

describe('the round\'s boss, measured', () => {
  const L = ladderLevel(), careful = wins(L, 'careful'), careless = wins(L, 'careless');

  it('the ladder brings the party to a level the boss is tuned for', () => {
    expect(L).toBeGreaterThanOrEqual(5);
  });

  it('at that level a careful party wins nearly always, a careless one mostly falls; a level short is a level check', () => {
    expect(count(careful)).toBeGreaterThanOrEqual(13);
    expect(count(careless)).toBeLessThanOrEqual(8);
    expect(count(wins(L - 1, 'careful'))).toBeLessThan(count(careful));
  });

  it('bracing for the telegraphed blow is worth winning', () => {
    expect(count(wins(L, 'unbraced'))).toBeLessThan(count(careful));
  });

  it('lasts like a boss fight: neither a stroll nor a slog (the party\'s own turns, four a round)', () => {
    const t = careful.map((r) => r.turns).sort((a, b) => a - b), mid = t[t.length >> 1];
    expect(mid).toBeGreaterThanOrEqual(32);
    expect(mid).toBeLessThanOrEqual(80);
  });
});
