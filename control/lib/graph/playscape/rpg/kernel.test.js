import { describe, it, expect } from 'vitest';
import { readRpg } from './rpg.js';
import { rpgInit, rpgStart, rpgOptions, rpgTargets, rpgRound, rpgClose, rpgRest, rpgStatsOf, rpgUsable, rpgClassesOf, rpgSwitchClass, rpgTreeOf, rpgBuy, rpgXpFor, rpgGearOf, rpgEquip, rpgUnequip, rpgSave, rpgLoad, buildRpg } from './kernel.js';

const trio = (extra = {}) => readRpg({ rpg: { party: [{ id: 'ayla', class: 'fighter' }, { id: 'bram', class: 'mage' }, { id: 'cass', class: 'cleric' }], ...extra } });

// a simple mind for the party: the first usable skill of `want` on the first foe, else an attack
function fight(cfg, R, vars, want = {}, rounds = 30) {
  const beats = [];
  for (let r = 0; r < rounds && R.b && R.b.phase === 'command'; r++) {
    const picks = {};
    for (const m of R.b.ids) {
      const o = rpgOptions(cfg, R, m, vars), s = want[m] && o.skills.find((x) => x.id === want[m] && x.ok);
      const pick = s ? { act: 'skill', skill: s.id } : { act: 'attack' };
      const t = rpgTargets(cfg, R, pick);
      picks[m] = { ...pick, target: t.length ? t[0].id : m };
    }
    beats.push(...rpgRound(cfg, R, picks, vars));
  }
  return beats;
}

describe('the battle kernel: a party against an encounter, in rounds', () => {
  it('is pure: the same run and the same picks give the same beats, and its source runs alone (the page emits it)', () => {
    const cfg = trio({ encounters: [{ id: 'pack', foes: ['slime', 'wolf', 'goblin'] }] });
    const once = () => { const R = rpgInit(cfg), v = {}; rpgStart(cfg, R, 'pack', v); return { beats: fight(cfg, R, v, { bram: 'fire' }), v }; };
    expect(once()).toEqual(once());
    const page = new Function(`return (${buildRpg.toString()})();`)();
    const R = page.init(cfg), v = {};
    page.start(cfg, R, 'pack', v);
    expect(page.round(cfg, R, {}, v)).toEqual((() => { const R2 = rpgInit(cfg), v2 = {}; rpgStart(cfg, R2, 'pack', v2); return rpgRound(cfg, R2, {}, v2); })());
  });

  it('a won fight pays out: gold into the var, xp into levels with the class growth, class points into ranks and skills', () => {
    const cfg = trio({ encounters: [{ id: 'pack', foes: ['slime', 'slime', 'wolf'] }] });
    const R = rpgInit(cfg), v = { gold: 5 };
    expect(rpgStart(cfg, R, 'pack', v)[0].text).toBe('Slime A, Slime B and Wolf appear!');
    expect(v['rpg.battle']).toBe(1);
    const before = rpgStatsOf(cfg, R, 'ayla');
    const beats = fight(cfg, R, v, { bram: 'fire' });
    expect(R.b.phase).toBe('won');
    expect(beats.find((b) => b.kind === 'spoils').text).toBe('Victory! 14 XP and 10 gold.');
    expect(v.gold).toBe(15);
    expect(R.m.ayla.level).toBe(2);
    expect(rpgStatsOf(cfg, R, 'ayla').atk).toBeGreaterThan(before.atk);
    expect(R.m.ayla.xp).toBe(14);
    expect(rpgXpFor(cfg, 2)).toBe(10);
    expect(rpgClose(cfg, R, v)).toEqual([{ type: 'rpg-won:pack' }, { type: 'rpg-won' }]);
    expect(v['rpg.battle']).toBe(0);
    expect(v['rpg.won']).toBe(1);
  });

  it('a lost fight ends the party; under retry the party stands up again', () => {
    const lone = (rules) => readRpg({ rpg: { party: [{ id: 'ayla', class: 'mage' }], encounters: [{ id: 'boss', foes: ['drake'] }], rules } });
    for (const rules of [{}, { defeat: 'retry' }]) {
      const cfg = lone(rules), R = rpgInit(cfg), v = {};
      rpgStart(cfg, R, 'boss', v);
      const beats = fight(cfg, R, v);
      expect(R.b.phase).toBe('lost');
      expect(beats.at(-1).text).toBe('The party has fallen…');
      expect(rpgClose(cfg, R, v)).toEqual([{ type: 'rpg-lost:boss' }, { type: 'rpg-lost' }]);
      expect(R.m.ayla.hp > 0).toBe(rules.defeat === 'retry');
    }
  });

  it('elements: a weakness doubles, an absorbed element heals the foe', () => {
    const cfg = trio({ encounters: [{ id: 'a', foes: ['slime'] }, { id: 'b', foes: ['drake'] }] });
    let R = rpgInit(cfg), v = {};
    rpgStart(cfg, R, 'a', v);
    let beats = rpgRound(cfg, R, { bram: { act: 'skill', skill: 'fire', target: 'f0' }, ayla: { act: 'guard' }, cass: { act: 'guard' } }, v);
    expect(beats.some((b) => /super effective/.test(b.text))).toBe(true);
    R = rpgInit(cfg); v = {};
    rpgStart(cfg, R, 'b', v);
    R.b.foes[0].hp = 100;
    beats = rpgRound(cfg, R, { bram: { act: 'skill', skill: 'fire', target: 'f0' }, ayla: { act: 'guard' }, cass: { act: 'guard' } }, v);
    const absorbed = beats.find((b) => /absorbs/.test(b.text));
    expect(absorbed.kind).toBe('heal');
    expect(absorbed.amount).toBeGreaterThan(0);
  });

  it('statuses: a sleeper skips its turn, poison bites at the round\'s end and stays after the fight, silence stops a spell', () => {
    const cfg = readRpg({ rpg: { party: [{ id: 'ayla', class: 'mage' }], encounters: [{ id: 'a', foes: ['golem'] }, { id: 'b', foes: ['spider'] }], skills: { sleep: { mp: 3, target: 'foe', status: { is: 'sleep', chance: 1, rounds: 3 } } } } });
    let R = rpgInit(cfg), v = {};
    rpgStart(cfg, R, 'a', v);
    R.b.foes[0].F = { ...R.b.foes[0].F, immune: [] };
    rpgRound(cfg, R, { ayla: { act: 'skill', skill: 'fire', target: 'f0' } }, v);
    R.b.foes[0].st.sleep = 2;
    const asleep = rpgRound(cfg, R, { ayla: { act: 'guard' } }, v);
    expect(asleep.some((b) => b.text === 'Stone Golem is asleep.')).toBe(true);
    expect(asleep.some((b) => /Stone Golem attacks/.test(b.text))).toBe(false);
    R = rpgInit(cfg); v = {};
    rpgStart(cfg, R, 'b', v);
    R.m.ayla.poison = 1;
    const hp = R.m.ayla.hp, bit = rpgRound(cfg, R, { ayla: { act: 'guard' } }, v).find((b) => /poison damage/.test(b.text));
    expect(bit.amount).toBe(Math.max(1, Math.floor(rpgStatsOf(cfg, R, 'ayla').hp / 10)));
    expect(R.m.ayla.hp).toBeLessThan(hp);
    R.b.side.ayla.st.silence = 2;
    expect(rpgOptions(cfg, R, 'ayla', v).skills.find((s) => s.id === 'fire')).toMatchObject({ ok: false, why: 'silenced' });
    rpgRest(cfg, R);
    expect(R.m.ayla.poison).toBe(0);
  });

  it('flee: a boss has no escape; a plain fight is left in time', () => {
    const cfg = trio({ encounters: [{ id: 'boss', foes: ['drake'] }, { id: 'pack', foes: ['bat', 'bat'] }] });
    let R = rpgInit(cfg), v = {};
    rpgStart(cfg, R, 'boss', v);
    expect(rpgOptions(cfg, R, 'ayla', v).commands.find((c) => c.id === 'flee').ok).toBe(false);
    expect(rpgRound(cfg, R, { ayla: { act: 'flee' } }, v)[0].text).toBe('There is no escape!');
    R = rpgInit(cfg); v = {};
    rpgStart(cfg, R, 'pack', v);
    for (let i = 0; i < 10 && R.b.phase === 'command'; i++) rpgRound(cfg, R, { ayla: { act: 'flee' } }, v);
    expect(R.b.phase).toBe('fled');
    expect(rpgClose(cfg, R, v)).toEqual([{ type: 'rpg-fled:pack' }, { type: 'rpg-fled' }]);
  });

  it('items spend from the bag and do their work; a fallen ally is revived only by a revive', () => {
    const cfg = trio({ encounters: [{ id: 'a', foes: ['slime'] }] });
    const R = rpgInit(cfg), v = { 'held:bag:potion': 1, 'held:bag:feather': 1 };
    rpgStart(cfg, R, 'a', v);
    R.m.cass.hp = 0; R.m.ayla.hp = 5;
    expect(rpgTargets(cfg, R, { act: 'item', item: 'feather' })).toEqual([{ id: 'cass', name: 'Cass' }]);
    expect(rpgOptions(cfg, R, 'ayla', v).items.map((i) => i.id)).toEqual(['potion', 'feather']);
    const beats = rpgRound(cfg, R, { ayla: { act: 'item', item: 'potion', target: 'ayla' }, bram: { act: 'item', item: 'feather', target: 'cass' } }, v);
    expect(v['held:bag:potion']).toBe(0);
    expect(v['held:bag:feather']).toBe(0);
    expect(beats.some((b) => b.text === 'Cass is revived!')).toBe(true);
    expect(R.m.cass.hp).toBeGreaterThan(0);
  });
});

describe('classes you switch between', () => {
  it('stats follow the current class at the member\'s level; learned skills stay; usable skills are the class\'s and the carried', () => {
    const cfg = trio(), R = rpgInit(cfg), v = {};
    R.m.ayla.level = 5;
    const asFighter = rpgStatsOf(cfg, R, 'ayla');
    expect(rpgUsable(cfg, R, 'ayla')).toEqual(['power-strike']);
    expect(rpgSwitchClass(cfg, R, 'ayla', 'mage', v)).toBe('');
    const asMage = rpgStatsOf(cfg, R, 'ayla');
    expect(asMage.mag).toBeGreaterThan(asFighter.mag);
    expect(asMage.hp).toBeLessThan(asFighter.hp);
    expect(R.m.ayla.hp).toBeLessThanOrEqual(asMage.hp);
    expect(v['rpg.ayla.class']).toBe('mage');
    // fire carries (a preset marked carry); power strike does not
    expect(rpgUsable(cfg, R, 'ayla')).toEqual(['fire']);
    expect(rpgSwitchClass(cfg, R, 'ayla', 'fighter', v)).toBe('');
    expect(rpgUsable(cfg, R, 'ayla')).toEqual(['power-strike', 'fire']);
    expect(Object.keys(R.m.ayla.cl)).toEqual(['fighter', 'mage']);
    // carry everything
    const all = trio({ rules: { carry: 'all' } }), R2 = rpgInit(all);
    rpgSwitchClass(all, R2, 'ayla', 'cleric', {});
    expect(rpgUsable(all, R2, 'ayla')).toEqual(['heal', 'power-strike']);
  });

  it('each class keeps its own rank and points; a class opens on its flag; no switching in a fight or under switch: never', () => {
    const cfg = trio({ classes: { fighter: true, mage: true, cleric: true, knight: { ...{}, base: { hp: 40, atk: 9, def: 12 }, skills: [{ skill: 'guard-up' }], opens: 'oath-sworn' } }, encounters: [{ id: 'a', foes: ['slime'] }] });
    const R = rpgInit(cfg), v = {};
    expect(rpgClassesOf(cfg, R, 'ayla', v).find((c) => c.id === 'knight')).toMatchObject({ open: false });
    expect(rpgSwitchClass(cfg, R, 'ayla', 'knight', v)).toBe('locked');
    v['flag-oath-sworn'] = 1;
    expect(rpgSwitchClass(cfg, R, 'ayla', 'knight', v)).toBe('');
    R.m.ayla.cl.knight.cp = 12;
    rpgSwitchClass(cfg, R, 'ayla', 'mage', v);
    expect(R.m.ayla.cl.knight.cp).toBe(12);
    rpgStart(cfg, R, 'a', v);
    expect(rpgSwitchClass(cfg, R, 'ayla', 'fighter', v)).toBe('battle');
    const never = trio({ rules: { switch: 'never' } });
    expect(rpgSwitchClass(never, rpgInit(never), 'ayla', 'mage', {})).toBe('rules');
    const limited = readRpg({ rpg: { party: [{ id: 'ayla', class: 'fighter', classes: ['fighter', 'knight'] }] } });
    expect(rpgClassesOf(limited, rpgInit(limited), 'ayla', {}).map((c) => c.id)).toEqual(['fighter', 'knight']);
  });

  it('the tree: a skill bought with its class\'s points, its requirements first', () => {
    const cfg = trio(), R = rpgInit(cfg);
    const tree = () => Object.fromEntries(rpgTreeOf(cfg, R, 'cass').map((e) => [e.skill, e.state]));
    expect(tree()).toMatchObject({ heal: 'learned', cure: 'later', raise: 'locked', holy: 'locked' });
    expect(rpgBuy(cfg, R, 'cass', 'raise')).toBe('sp');
    R.m.cass.cl.cleric.sp = 5;
    expect(rpgBuy(cfg, R, 'cass', 'holy')).toBe('requires');
    expect(rpgBuy(cfg, R, 'cass', 'raise')).toBe('');
    expect(rpgBuy(cfg, R, 'cass', 'holy')).toBe('');
    expect(R.m.cass.cl.cleric.sp).toBe(0);
    expect(tree()).toMatchObject({ raise: 'learned', holy: 'learned' });
    expect(rpgBuy(cfg, R, 'cass', 'raise')).toBe('learned');
  });

  it('a member who joins on a flag fights once it is set', () => {
    const cfg = readRpg({ rpg: { party: [{ id: 'ayla', class: 'fighter' }, { id: 'mira', class: 'cleric', joins: 'met-mira' }], encounters: [{ id: 'a', foes: ['slime'] }] } });
    let R = rpgInit(cfg);
    rpgStart(cfg, R, 'a', {});
    expect(R.b.ids).toEqual(['ayla']);
    R = rpgInit(cfg);
    rpgStart(cfg, R, 'a', { 'flag-met-mira': 1 });
    expect(R.b.ids).toEqual(['ayla', 'mira']);
  });
});

describe('gear: one item a slot, from the bag and back to it', () => {
  it('a member starts in their class\'s gear, its numbers on theirs; worn from the bag, swapped back to it, taken off', () => {
    const cfg = trio(), R = rpgInit(cfg), v = { 'held:bag:iron-sword': 1, 'held:bag:silver-staff': 1 };
    expect(R.m.ayla.gear).toEqual({ weapon: 'bronze-sword', armor: 'leather-armor' });
    const bare = cfg.classes.fighter.base.atk;
    expect(rpgStatsOf(cfg, R, 'ayla').atk).toBe(bare + 4);
    expect(rpgGearOf(cfg, R, 'ayla', v)[0]).toMatchObject({ slot: 'weapon', item: 'bronze-sword', can: [{ item: 'iron-sword', count: 1 }] });
    expect(rpgEquip(cfg, R, 'ayla', 'silver-staff', v)).toBe('class');
    expect(rpgEquip(cfg, R, 'ayla', 'iron-sword', v)).toBe('');
    expect(rpgStatsOf(cfg, R, 'ayla').atk).toBe(bare + 9);
    expect([v['held:bag:iron-sword'], v['held:bag:bronze-sword']]).toEqual([0, 1]);
    expect(rpgUnequip(cfg, R, 'ayla', 'armor', v)).toBe('');
    expect(v['held:bag:leather-armor']).toBe(1);
    expect(rpgUnequip(cfg, R, 'ayla', 'armor', v)).toBe('empty');
  });

  it('a class switch takes off what the new class forbids; what is worn is carried', () => {
    const cfg = trio(), R = rpgInit(cfg), v = {};
    expect(rpgSwitchClass(cfg, R, 'ayla', 'mage', v)).toBe('');
    expect(R.m.ayla.gear).toEqual({ armor: 'leather-armor' });
    expect(v['held:bag:bronze-sword']).toBe(1);
    const saved = rpgSave(cfg, R).ayla;
    expect(saved['gear.armor.leather-armor']).toBe(1);
    const R2 = rpgInit(cfg);
    rpgLoad(cfg, R2, { ayla: { stats: saved } });
    expect(R2.m.ayla.gear).toEqual({ armor: 'leather-armor' });
  });

  it('no wearing in a fight; a world\'s own gear is read, a wrong slot refused', () => {
    const cfg = trio({ encounters: [{ id: 'a', foes: ['slime'] }] }), R = rpgInit(cfg), v = { 'held:bag:iron-sword': 1 };
    rpgStart(cfg, R, 'a', v);
    expect(rpgEquip(cfg, R, 'ayla', 'iron-sword', v)).toBe('battle');
    const own = trio({ gear: { 'moon-blade': { slot: 'weapon', atk: 12, mag: 4, classes: ['knight'] } } });
    expect(own.gear['moon-blade']).toEqual({ name: 'Moon Blade', slot: 'weapon', mods: { atk: 12, mag: 4 }, classes: ['knight'] });
    expect(() => trio({ gear: { cape: { slot: 'back', def: 1 } } })).toThrow(/slot is weapon, armor, accessory/);
    expect(() => readRpg({ rpg: { party: [{ id: 'a', class: 'fighter', gear: { armor: 'iron-sword' } }] } })).toThrow(/Iron Sword is worn as weapon/);
  });
});
