// THE BOSS LAW'S FIGHTS (boss-law.test.js, boss-law.deep.test.js): a party walks the round's ladder for real
// (battles.js PACKS in order, resting between fights as at an inn), earning its levels, class points and spells as it
// goes, then meets a boss with what it earned, played one of four ways:
//   careful   it braces when the boss gathers a charged blow, mends the hurt, strikes the boss's weakness as it stands,
//             and drinks an ether when the mage runs dry
//   unbraced  the same, never bracing
//   unread    the same, striking the weakness the boss first showed after it has changed
//   careless  it only attacks
// A boss's battles are deterministic, so each way is measured on many seeds.
import { PACKS } from './battles.js';
import { FOE_PRESETS } from '../playscape/rpg/presets.js';
import { readRpg } from '../playscape/rpg/rpg.js';
import { rpgInit, rpgStart, rpgOptions, rpgRound, rpgStatsOf, rpgRest, rpgClose } from '../playscape/rpg/kernel.js';

// (the round's party as a party RPG composes it: the hero a mage, its joiners the rest; the round's turns the timeline's)
export const LAW_PARTY = Object.freeze([['hero', 'mage'], ['party-1', 'rogue'], ['party-2', 'cleric'], ['party-3', 'fighter']]);
// (the mage's spell for each element; what the party carries in: a few ethers, as the citadel's shops sell)
const ELEMENT_SPELL = [['ice', 'blizzard'], ['thunder', 'thunder'], ['fire', 'fire']];
const BAG = { 'held:bag:ether': 3 };
export const LAW_SEEDS = Object.freeze(Array.from({ length: 16 }, (_, k) => (k + 1) * 97));

export const lawCfg = (boss, seed, foes = {}) => readRpg({ rpg: {
  party: LAW_PARTY.map(([id, c]) => ({ id, class: c })), foes,
  encounters: [...PACKS.map((f, k) => ({ id: `pack-${k}`, foes: f })), { id: 'boss', foes: [boss], flee: false }],
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
        const weak = way === 'unread' ? cfg.foes[foe.kind].weak : foe.F.weak, spell = ELEMENT_SPELL.find(([el, k]) => weak.includes(el) && ok(k));
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

/** One seed: the ladder walked with care (its first `packs`), a rest after each fight; then the boss, played `way`. */
export function lawRun(boss, seed, way, { packs = PACKS.length, foes = {} } = {}) {
  const cfg = lawCfg(boss, seed, foes), R = rpgInit(cfg), v = { ...BAG };
  for (let k = 0; k < packs; k++) { fight(cfg, R, v, `pack-${k}`, 'careful'); rpgRest(cfg, R, v); }
  return { ...fight(cfg, R, v, 'boss', way), level: R.m.hero.level, R, cfg };
}
export const lawRuns = (boss, way, opts) => LAW_SEEDS.map((s) => lawRun(boss, s, way, opts));
export const lawWins = (rs) => rs.filter((r) => r.won).length;
export const lawMid = (rs) => { const t = rs.map((r) => r.turns).sort((a, b) => a - b); return t[t.length >> 1]; };

/** What the law asks of a boss, by its design: a charge it braces for, a second form that turns its weaknesses. */
export function lawShape(boss) {
  const F = FOE_PRESETS[boss], rows = [...(F.pattern ?? []), ...(F.phases ?? []).flatMap((p) => p.pattern ?? [])];
  const turns = (F.phases ?? []).some((p) => ['weak', 'absorb'].some((k) => p[k] && JSON.stringify(p[k]) !== JSON.stringify(F[k] ?? [])));
  return { charges: rows.some((r) => r.charge), turns };
}
// (the shape a boss is held to: the careful party wins nearly always, the careless one mostly falls, the fight lasts
// 8 to 20 rounds, a party short of the ladder's last two fights wins less)
export const LAW = Object.freeze({ careful: 13, careless: 8, mid: [32, 80] });
