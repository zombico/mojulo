import { describe, it, expect } from 'vitest';
import { readRpg } from './rpg.js';
import { rpgInit, rpgStart, rpgOptions, rpgTargets, rpgRound, rpgClose, rpgRest, rpgStatsOf, rpgUsable, rpgClassesOf, rpgSwitchClass, rpgTreeOf, rpgBuy, rpgXpFor, rpgGearOf, rpgEquip, rpgUnequip, rpgSave, rpgLoad, rpgPreview, rpgFieldUse, rpgSwap, rpgPartyOf, rpgRaise, buildRpg } from './kernel.js';

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

describe('the timeline (rules.turns: timeline): each acts when its gauge fills', () => {
  const tl = (party, foes) => readRpg({ rpg: { party, encounters: [{ id: 'a', foes }], rules: { turns: 'timeline' } } });

  it('one member picks at a time; the turns go as the preview said; the quick act more often; it replays the same', () => {
    const cfg = tl([{ id: 'ayla', class: 'fighter' }, { id: 'dane', class: 'rogue', bonus: { spd: 20 } }], ['golem']);
    const run = () => {
      const R = rpgInit(cfg), v = {}, order = [];
      rpgStart(cfg, R, 'a', v);
      for (let t = 0; t < 8 && R.b.phase === 'command'; t++) {
        const seen = rpgPreview(cfg, R, 3).map((x) => x.who);
        expect(seen[0]).toBe(R.b.turn);
        order.push(R.b.turn);
        rpgRound(cfg, R, { [R.b.turn]: { act: 'guard' } }, v);
      }
      return order;
    };
    const order = run();
    expect(order).toEqual(run());
    const n = (who) => order.filter((x) => x === who).length;
    expect(n('dane')).toBeGreaterThan(n('ayla'));
  });

  it('a pick only for the one whose turn it is; the foes between turns act in the same call', () => {
    const cfg = tl([{ id: 'ayla', class: 'fighter' }], ['wolf', 'bat']);
    const R = rpgInit(cfg), v = {};
    rpgStart(cfg, R, 'a', v);
    expect(R.b.turn).toBe('ayla');
    const beats = rpgRound(cfg, R, { ayla: { act: 'attack', target: 'f0' } }, v);
    expect(beats[0].text).toBe('Ayla attacks!');
    expect(beats.some((b) => /^(Wolf|Bat) (attacks|uses)/.test(b.text)) || R.b.turn === 'ayla').toBe(true);
    expect(() => readRpg({ rpg: { party: [{ id: 'a', class: 'fighter' }], rules: { turns: 'atb' } } })).toThrow(/turns is rounds or timeline/);
  });
});

describe('a familiar: a party member that picks for itself (auto)', () => {
  const pair = (fam, extra = {}) => readRpg({ rpg: { party: [{ id: 'ayla', class: 'fighter' }, { id: 'kit', class: fam, auto: { keeper: 'ayla' } }], ...extra } });

  it('mends its keeper first when hurt, and asks the player for no command', () => {
    const cfg = pair('cleric', { encounters: [{ id: 'pack', foes: ['golem'] }] });
    const R = rpgInit(cfg), v = {};
    rpgStart(cfg, R, 'pack', v);
    R.m.ayla.hp = 3;
    const beats = rpgRound(cfg, R, { ayla: { act: 'guard' } }, v);
    expect(beats).toContainEqual(expect.objectContaining({ kind: 'cast', who: 'kit', skill: 'heal', target: 'ayla' }));
    expect(buildRpg.toString()).toContain('allyPick');
  });

  it('strikes a weakness when it can, and plays its own turns on the timeline', () => {
    const cfg = pair('mage', { encounters: [{ id: 'pack', foes: ['slime'] }], rules: { turns: 'timeline' } });
    const R = rpgInit(cfg), v = {};
    const beats = rpgStart(cfg, R, 'pack', v);
    for (let t = 0; t < 6 && R.b.phase === 'command'; t++) { expect(R.b.turn).not.toBe('kit'); beats.push(...rpgRound(cfg, R, { ayla: { act: 'guard' } }, v)); }
    expect(beats).toContainEqual(expect.objectContaining({ who: 'kit', skill: 'fire' }));
  });

  it('is read and refused by name', () => {
    expect(() => readRpg({ rpg: { party: [{ id: 'kit', class: 'mage', auto: true }] } })).toThrow(/someone takes the player's commands/);
    expect(() => pair('mage').party && readRpg({ rpg: { party: [{ id: 'ayla', class: 'fighter' }, { id: 'kit', class: 'mage', auto: { keeper: 'zed' } }] } })).toThrow(/keeper 'zed' is not in the party/);
    expect(trio().party.every((p) => !('auto' in p))).toBe(true);   // absent, the cfg is as it was
  });
});

// A FOE'S ACTION PATTERN (foes.<id>.pattern): on its turn a row whose `when` holds and that it can pay for, by weight;
// none, the rule every foe keeps. The concept on one foe: a row by its turn, by every nth, by its HP; and a foe without
// one carries nothing of it
describe('a foe\'s action pattern', () => {
  const warden = { name: 'Warden', hp: 400, mp: 99, atk: 6, def: 30, mag: 8, spd: 1, xp: 1, gold: 1, boss: true,
    pattern: [{ use: 'guard', when: { turn: 1 } }, { use: 'fire', when: { every: 2 } }, { use: 'heal', when: { hpBelow: 0.5 }, weight: 9 }] };
  const cfg = trio({ foes: { warden, slime: true }, encounters: [{ id: 'keep', foes: ['warden'] }, { id: 'pack', foes: ['slime'] }] });
  const said = (beats) => beats.filter((x) => x.who === 'f0').map((x) => x.text);

  it('is read whole and taught; a foe without one carries none of it', () => {
    expect(cfg.foes.warden.pattern).toEqual([{ use: 'guard', when: { turn: 1 }, weight: 5 }, { use: 'fire', when: { every: 2 }, weight: 5 }, { use: 'heal', when: { hpBelow: 0.5 }, weight: 9 }]);
    expect(cfg.skills.heal).toBeTruthy();
    expect('pattern' in cfg.foes.slime).toBe(false);
    expect(() => trio({ foes: { warden: { ...warden, pattern: [{ use: 'fire', when: { hpBelow: 2 } }] } } })).toThrow(/a share of its HP/);
    expect(() => trio({ foes: { warden: { ...warden, pattern: [{ use: 'fire', weight: 12 }] } } })).toThrow(/1 to 9/);
  });

  it('does what its rows say when they hold: guards its first turn, casts every second, mends when low', () => {
    const R = rpgInit(cfg), v = {};
    rpgStart(cfg, R, 'keep', v);
    // (the party guards each round: no picks)
    expect(said(rpgRound(cfg, R, {}, v))).toEqual(['Warden guards.']);
    expect(said(rpgRound(cfg, R, {}, v))[0]).toBe('Warden uses Fire!');
    // (its third turn, low: only the mend holds)
    R.b.foes[0].hp = 120;
    expect(said(rpgRound(cfg, R, {}, v))[0]).toBe('Warden uses Heal!');
    // (its fifth, full again and no row holding: the rule every foe keeps, a skill by chance or an attack)
    R.b.foes[0].hp = 400;
    rpgRound(cfg, R, {}, v);
    expect(said(rpgRound(cfg, R, {}, v))[0]).toMatch(/^Warden (attacks!|uses (Fire|Heal)!)$/);
  });
});

// TRAITS (rpg.js readTraits): a member's rates (hit, eva, crit) from its class, its gear and the states it is in, a foe's
// its own; a plain blow carrying its weapon's element and the status it leaves where it lands; a skill granted while
// the gear is worn. The concept on the rates' ends (a share of 1 always or never), so no die decides the test
describe('traits', () => {
  const dummy = { name: 'Dummy', hp: 999, mp: 0, atk: 30, def: 0, mag: 1, spd: 1, xp: 1, gold: 1, weak: ['fire'] };
  const one = (gear, foes = {}, extra = {}) => readRpg({ rpg: { party: [{ id: 'ayla', class: 'fighter', level: 5, gear }], foes: { dummy, ...foes }, gear: { 'bronze-sword': true, 'leather-armor': true, 'flame-sword': true, 'ember-ring': true,
    'sure-blade': { slot: 'weapon', atk: 4, hit: 1, crit: 1, inflict: { is: 'poison', chance: 1 } }, 'ghost-veil': { slot: 'armor', eva: 1 }, pricker: { slot: 'weapon', atk: 4, inflict: { is: 'poison', chance: 1 } } }, encounters: [{ id: 'yard', foes: ['dummy'] }], ...extra } });
  const round = (cfg, R, v, pick) => rpgRound(cfg, R, { ayla: pick }, v);
  const begin = (cfg) => { const R = rpgInit(cfg), v = {}; rpgStart(cfg, R, 'yard', v); return [R, v]; };

  it('a rate of one is always: a sure blow lands critical and leaves its poison; a veil of evasion is never struck', () => {
    const cfg = one({ weapon: 'sure-blade', armor: 'ghost-veil' }), [R, v] = begin(cfg);
    for (let k = 0; k < 4; k++) {
      const out = round(cfg, R, v, { act: 'attack', target: 'f0' });
      expect(out.find((x) => x.kind === 'hurt' && x.target === 'f0')).toMatchObject({ crit: true });
      expect(out.some((x) => x.kind === 'hurt' && x.target === 'ayla')).toBe(false);
    }
    expect(R.b.foes[0].st.poison).toBeTruthy();
  });

  it('a blow\'s status is left only where it lands: a foe that evades it keeps clear', () => {
    // (a blade that only carries the poison: a sure one's hit would cancel the evasion, as the rates sum)
    const cfg = one({ weapon: 'pricker' }, { dummy: { ...dummy, eva: 1 } }), [R, v] = begin(cfg);
    for (let k = 0; k < 3; k++) expect(round(cfg, R, v, { act: 'attack', target: 'f0' }).some((x) => x.kind === 'hurt' && x.target === 'f0')).toBe(false);
    expect(R.b.foes[0].st.poison).toBeFalsy();
  });

  it('a weapon\'s element is its plain blow\'s: the flame sword strikes the fire a foe is weak to', () => {
    const cfg = one({ weapon: 'flame-sword' }), [R, v] = begin(cfg);
    let hit;
    for (let k = 0; k < 6 && !hit; k++) hit = round(cfg, R, v, { act: 'attack', target: 'f0' }).find((x) => x.kind === 'hurt' && x.target === 'f0');
    expect(hit).toMatchObject({ element: 'fire', mul: 2 });
  });

  it('a skill granted while the gear is worn, and not once it is off', () => {
    const cfg = one({ weapon: 'bronze-sword', accessory: 'ember-ring' }), R = rpgInit(cfg);
    expect(rpgUsable(cfg, R, 'ayla')).toContain('fire');
    const bare = one({ weapon: 'bronze-sword' });
    expect(rpgUsable(bare, rpgInit(bare), 'ayla')).not.toContain('fire');
  });

  it('a state carries rates too; each is read and taught', () => {
    const cfg = one({ weapon: 'bronze-sword' }, {}, { states: { haze: { said: 'hazed', eva: 1, rounds: 9 } }, skills: { mist: { mp: 0, target: 'self', status: { is: 'haze', chance: 1 } } }, classes: { fighter: { skills: [{ skill: 'mist' }] } } });
    const [R, v] = begin(cfg);
    round(cfg, R, v, { act: 'skill', skill: 'mist', target: 'ayla' });
    for (let k = 0; k < 3; k++) expect(round(cfg, R, v, { act: 'guard' }).some((x) => x.kind === 'hurt' && x.target === 'ayla')).toBe(false);
    expect(() => one({}, {}, { gear: { bad: { slot: 'accessory', crit: 2 } } })).toThrow(/crit is how much more often/);
    expect(() => one({}, {}, { gear: { bad: { slot: 'weapon', inflict: { is: 'gloom' } } } })).toThrow(/inflict is \{ is:/);
    expect(cfg.gear['flame-sword'].traits).toEqual({ element: 'fire' });
  });
});

// EFFECTS (rpg.js readSkill, readItem): a blow that strikes more than once, damage in another form (a share of the HP
// as it stands, an exact sum, through the guard, from the MP), a drain back to the striker, a theft into the bag; an
// item that leaves a status or gives a buff. A sure hand (hit 1) so no swing goes wide; a dummy that stands
describe('effects', () => {
  const dummy = { name: 'Dummy', hp: 400, mp: 40, atk: 1, def: 60, mag: 40, spd: 1, xp: 1, gold: 1, drops: [{ item: 'ether', chance: 0.1 }] };
  const learned = ['twin-cut', 'armor-pierce', 'power-strike', 'gravity', 'drain', 'osmose', 'steal'].map((skill) => ({ skill }));
  const cfgOf = (foes = {}) => readRpg({ rpg: { party: [{ id: 'ayla', class: 'fighter', level: 9, gear: { weapon: 'sure' } }], classes: { fighter: { skills: learned } }, foes: { dummy, ...foes },
    gear: { sure: { slot: 'weapon', atk: 6, hit: 1 } }, encounters: [{ id: 'yard', foes: [Object.keys(foes)[0] ?? 'dummy'] }] } });
  const begin = (cfg) => { const R = rpgInit(cfg), v = {}; rpgStart(cfg, R, 'yard', v); R.m.ayla.mp = 99; return [R, v]; };
  const use = (cfg, R, v, skill) => rpgRound(cfg, R, { ayla: { act: 'skill', skill, target: 'f0' } }, v).filter((x) => x.by === 'ayla' || x.target === 'ayla');

  it('strikes as many times as it says; a blow through armour lands harder on the armoured than the same blow against it', () => {
    const cfg = cfgOf(), [R, v] = begin(cfg);
    expect(use(cfg, R, v, 'twin-cut').filter((x) => x.kind === 'hurt' && x.target === 'f0')).toHaveLength(2);
    const pierce = use(cfg, R, v, 'armor-pierce').find((x) => x.kind === 'hurt').amount, plain = use(cfg, R, v, 'power-strike').find((x) => x.kind === 'hurt').amount;
    expect(pierce).toBeGreaterThan(plain);
  });

  it('gravity takes a share of the HP as it stands, never a boss\'s; drain gives back a share; osmose takes MP, not HP', () => {
    const cfg = cfgOf(), [R, v] = begin(cfg), f = R.b.foes[0];
    f.hp = 200;
    expect(use(cfg, R, v, 'gravity').find((x) => x.kind === 'hurt').amount).toBe(50);
    R.m.ayla.hp = 10;
    const d = use(cfg, R, v, 'drain');
    expect(d.find((x) => x.drain)).toMatchObject({ kind: 'heal', target: 'ayla' });
    const hp = f.hp, o = use(cfg, R, v, 'osmose').find((x) => x.kind === 'hurt');
    expect(o).toMatchObject({ pool: 'mp' });
    expect(f.hp).toBe(hp);
    expect(f.mp).toBeLessThan(40);
    const boss = cfgOf({ drake: true }), [RB, vB] = begin(boss);
    expect(use(boss, RB, vB, 'gravity').find((x) => x.target === 'f0')).toMatchObject({ kind: 'miss' });
  });

  it('a theft takes the foe\'s first drop into the bag, once a foe', () => {
    const cfg = cfgOf(), [R, v] = begin(cfg);
    let took;
    for (let k = 0; k < 6 && !took; k++) took = use(cfg, R, v, 'steal').find((x) => x.kind === 'steal');
    expect(took).toMatchObject({ item: 'ether' });
    expect(v['held:bag:ether']).toBe(1);
    expect(use(cfg, R, v, 'steal').find((x) => x.target === 'f0').text).toMatch(/nothing to steal/);
  });

  it('an item may leave a status on the foes or give an ally a buff; each is read and taught', () => {
    const cfg = cfgOf(), [R, v] = begin(cfg);
    v['held:bag:power-tonic'] = 1;
    rpgRound(cfg, R, { ayla: { act: 'item', item: 'power-tonic', target: 'ayla' } }, v);
    expect(R.b.side.ayla.buffs).toEqual([expect.objectContaining({ stat: 'atk', pct: 0.3 })]);
    expect(cfg.items['sleep-powder']).toMatchObject({ target: 'foes', status: { is: 'sleep' } });
    const bad = (skills) => () => readRpg({ rpg: { party: [{ id: 'ayla', class: 'fighter' }], skills } });
    expect(bad({ x: { mp: 1, power: 2, hits: 12 } })).toThrow(/2 to 8/);
    expect(bad({ x: { mp: 1, power: 3, damage: 'gravity' } })).toThrow(/share of the target's HP/);
    expect(bad({ x: { mp: 1, heal: true, power: 3, drain: 0.5 } })).toThrow(/shape a harmful skill/);
  });
});

// A CHARGED BLOW (a pattern row's `charge`): the foe's turn spent gathering, said, so the party can brace; its next turn
// the blow let go at twice its power; a guard takes half of it like any blow
describe('a charged blow', () => {
  const ogre = { name: 'Ogre', hp: 999, mp: 0, atk: 20, def: 1, mag: 1, spd: 1, xp: 1, gold: 1,
    pattern: [{ use: 'attack', when: { turn: 1 }, charge: '{name} winds up…' }, { use: 'attack', when: { after: 2 } }] };
  const lone = () => readRpg({ rpg: { party: [{ id: 'ayla', class: 'knight', level: 9 }], foes: { ogre }, encounters: [{ id: 'den', foes: ['ogre'] }] } });
  const taken = (beats) => beats.filter((x) => x.kind === 'hurt' && x.target === 'ayla').reduce((a, x) => a + x.amount, 0);
  const play = (brace) => {
    const cfg = lone(), R = rpgInit(cfg), v = {};
    rpgStart(cfg, R, 'den', v);
    const hit = { ayla: { act: 'attack', target: 'f0' } };
    return [rpgRound(cfg, R, hit, v), rpgRound(cfg, R, brace ? { ayla: { act: 'guard' } } : hit, v), rpgRound(cfg, R, hit, v)];
  };

  it('is said as it gathers, then let go at twice a blow\'s power; braced for, half of it', () => {
    const [one, two, three] = play(false);
    expect(one.find((x) => x.kind === 'charge')).toMatchObject({ text: 'Ogre winds up…', who: 'f0' });
    expect(taken(one)).toBe(0);
    expect(two.find((x) => x.charged)).toMatchObject({ text: 'Ogre unleashes its full strength!' });
    expect(taken(two)).toBeGreaterThan(1.5 * taken(three));
    expect(taken(play(true)[1])).toBeLessThan(0.6 * taken(two));
  });

  it('is read and taught: a line or true, never on a guard', () => {
    expect(lone().foes.ogre.pattern[0]).toEqual({ use: 'attack', when: { turn: 1 }, weight: 5, charge: '{name} winds up…' });
    expect(() => readRpg({ rpg: { party: [{ id: 'ayla', class: 'knight' }], foes: { ogre: { ...ogre, pattern: [{ use: 'guard', charge: true }] } } } })).toThrow(/a guard has nothing to gather/);
    expect(() => readRpg({ rpg: { party: [{ id: 'ayla', class: 'knight' }], foes: { ogre: { ...ogre, pattern: [{ use: 'attack', charge: 3 }] } } } })).toThrow(/charge is true or the line/);
  });
});

// A FOE'S PHASES (foes.<id>.phases): the first time its HP falls under each phase's share, in order, it takes that form,
// what the phase names replacing its own on its own copy, said as it comes (a beat of kind 'phase')
describe('a foe\'s phases', () => {
  const hydra = { name: 'Hydra', hp: 100, mp: 0, atk: 5, def: 1, mag: 1, spd: 1, xp: 1, gold: 1, weak: ['ice'],
    phases: [{ below: 0.6, say: '{name} grows a second head!', weak: ['thunder'], absorb: ['ice'], atk: 9 }, { below: 0.3, pattern: [{ use: 'guard' }] }] };
  const cfg = readRpg({ rpg: { party: [{ id: 'ayla', class: 'knight', level: 9 }], foes: { hydra }, encounters: [{ id: 'lake', foes: ['hydra'] }] } });

  it('takes each form once, in order, on its own copy; a hit past two shares brings both', () => {
    const R = rpgInit(cfg), v = {};
    rpgStart(cfg, R, 'lake', v);
    const f = R.b.foes[0];
    f.hp = 59;
    const one = rpgRound(cfg, R, { ayla: { act: 'guard' } }, v).filter((x) => x.kind === 'phase');
    expect(one).toEqual([{ text: 'Hydra grows a second head!', kind: 'phase', who: 'f0', phase: 1 }]);
    expect(f.F).toMatchObject({ weak: ['thunder'], absorb: ['ice'] });
    expect(f.F.base.atk).toBe(9);
    expect(cfg.foes.hydra.weak).toEqual(['ice']);
    expect(rpgRound(cfg, R, { ayla: { act: 'guard' } }, v).some((x) => x.kind === 'phase')).toBe(false);
    f.hp = 10;
    expect(rpgRound(cfg, R, { ayla: { act: 'guard' } }, v).filter((x) => x.kind === 'phase')).toEqual([{ text: 'Hydra changes!', kind: 'phase', who: 'f0', phase: 2 }]);
    // (a fresh fight starts it in its first form; a hit through both shares at once brings both, in order)
    const R2 = rpgInit(cfg);
    rpgStart(cfg, R2, 'lake', v);
    R2.b.foes[0].hp = 5;
    expect(rpgRound(cfg, R2, { ayla: { act: 'guard' } }, v).filter((x) => x.kind === 'phase').map((x) => x.phase)).toEqual([1, 2]);
  });

  it('is read and taught: each under the one before, and changing something', () => {
    expect(cfg.foes.hydra.phases[1]).toEqual({ below: 0.3, pattern: [{ use: 'guard', weight: 5 }] });
    const bad = (phases) => () => readRpg({ rpg: { party: [{ id: 'ayla', class: 'knight' }], foes: { hydra: { ...hydra, phases } } } });
    expect(bad([{ below: 0.3, atk: 1 }, { below: 0.6, atk: 2 }])).toThrow(/under the one before/);
    expect(bad([{ below: 0.5 }])).toThrow(/changes nothing/);
  });
});

// A FIGHT'S OWN PAGES (encounters[].pages): each said once, the first time its moment holds (begun, a foe under a share
// of its HP, its nth round), a beat of kind 'page' carrying its flag
describe('a fight\'s own pages', () => {
  const warden = { name: 'Warden', hp: 400, mp: 0, atk: 1, def: 30, mag: 1, spd: 1, xp: 1, gold: 1, boss: true };
  const cfg = trio({ foes: { warden }, encounters: [{ id: 'keep', foes: ['warden'], pages: [
    { when: { start: true }, who: 'Warden', say: 'None pass the crypt.' },
    { when: { foe: 'warden', hpBelow: 0.5 }, who: 'Warden', say: ['You are stronger than they said.', 'Then come.'], sets: 'warden-halved' },
    { when: { round: 3 }, say: 'The torches gutter.' },
  ] }] });
  const pagesOf = (beats) => beats.filter((x) => x.kind === 'page');

  it('is read and taught: a moment named, a foe of the fight\'s', () => {
    expect(cfg.encounters.keep.pages).toHaveLength(3);
    expect(() => trio({ foes: { warden }, encounters: [{ id: 'keep', foes: ['warden'], pages: [{ when: { foe: 'slime', hpBelow: 0.5 }, say: 'x' }] }] })).toThrow(/one of the fight's foes/);
    expect(() => trio({ foes: { warden }, encounters: [{ id: 'keep', foes: ['warden'], pages: [{ when: {}, say: 'x' }] }] })).toThrow(/names its moment/);
  });

  it('says each page once, when its moment first holds, the halfway one with its flag', () => {
    const R = rpgInit(cfg), v = {};
    expect(pagesOf(rpgStart(cfg, R, 'keep', v)).map((x) => x.text)).toEqual(['Warden: None pass the crypt.']);
    expect(pagesOf(rpgRound(cfg, R, {}, v))).toEqual([]);
    R.b.foes[0].hp = 150;
    const half = pagesOf(rpgRound(cfg, R, {}, v));
    expect(half.map((x) => x.text)).toEqual(['Warden: You are stronger than they said.', 'Warden: Then come.']);
    expect(half.map((x) => x.sets ?? null)).toEqual([null, 'warden-halved']);
    expect(half[0].who).toBe('f0');
    // (round three: the torches; then nothing again)
    expect(pagesOf(rpgRound(cfg, R, {}, v)).map((x) => x.text)).toEqual(['The torches gutter.']);
    expect(pagesOf(rpgRound(cfg, R, {}, v))).toEqual([]);
  });
});

// A PAGE THAT ACTS (a page's summon and heal): the foe it names given back a share of its HP; foes called in after the
// fight's own, fought and counted in the spoils like them; six fight at most
describe('a fight\'s page that acts', () => {
  const warden = { name: 'Warden', hp: 400, mp: 0, atk: 1, def: 30, mag: 1, spd: 1, xp: 10, gold: 1, boss: true }, slime = { name: 'Slime', hp: 14, atk: 1, def: 3, mag: 1, spd: 1, xp: 4, gold: 3 };
  const cfg = trio({ foes: { warden, slime }, encounters: [{ id: 'keep', foes: ['warden'], at: [0, 0], who: ['warden-fig', 'slime-fig', 'slime-fig2'], pages: [
    { when: { foe: 'warden', hpBelow: 0.5 }, who: 'Warden', say: 'Rise, my wards!', heal: 0.25, summon: ['slime', 'slime'] },
  ] }] });

  it('is read and taught: foes of the book, a share, six at most, a figure each at most', () => {
    expect(cfg.encounters.keep.pages[0]).toMatchObject({ heal: 0.25, summon: ['slime', 'slime'] });
    const one = (p, extra = {}) => () => trio({ foes: { warden, slime }, encounters: [{ id: 'keep', foes: ['warden'], pages: [{ when: { round: 2 }, say: 'x', ...p }], ...extra }] });
    expect(one({ summon: ['dragonx'] })).toThrow(/summon is a list of foes/);
    expect(one({ heal: 2 })).toThrow(/heal is a share/);
    expect(one({ summon: ['slime', 'slime', 'slime', 'slime', 'slime', 'slime'] })).toThrow(/six fight at most/);
    expect(one({ summon: ['slime'] }, { at: [0, 0], who: ['a', 'b', 'c'] })).toThrow(/who is the entity/);
  });

  it('gives back the share to the foe its moment names, and calls the foes in: fought, and counted in the spoils', () => {
    const R = rpgInit(cfg), v = {};
    rpgStart(cfg, R, 'keep', v);
    R.b.foes[0].hp = 150;
    const beats = rpgRound(cfg, R, {}, v), heal = beats.find((x) => x.kind === 'heal' && x.target === 'f0');
    expect(heal.amount).toBe(100);
    expect(beats.filter((x) => x.kind === 'summon').map((x) => [x.who, x.text])).toEqual([['f1', 'Slime A appears!'], ['f2', 'Slime B appears!']]);
    expect(R.b.foes.map((f) => f.kind)).toEqual(['warden', 'slime', 'slime']);
    // (the warden's fall leaves the fight on while the called foes stand)
    R.b.foes[0].hp = 0;
    rpgRound(cfg, R, {}, v);
    expect(R.b.phase).toBe('command');
    for (const f of R.b.foes) f.hp = 0;
    rpgRound(cfg, R, {}, v);
    expect(R.b.phase).toBe('won');
  });

  it('a fight whose pages only speak calls no one', () => {
    const quiet = trio({ foes: { warden, slime }, encounters: [{ id: 'keep', foes: ['warden'], pages: [{ when: { start: true }, say: 'x' }] }] });
    const R = rpgInit(quiet), v = {};
    expect(rpgStart(quiet, R, 'keep', v).some((x) => x.kind === 'summon' || x.kind === 'heal')).toBe(false);
    expect(R.b.foes).toHaveLength(1);
  });
});

// THE WORLD'S OWN STATES (play.rpg.states, presets.js STATE_PRESETS): each by what it does. The concept on one of each
// kind of effect; and a fight that meets none carries none of it
describe('the world\'s own states', () => {
  const base = { foes: { dummy: { name: 'Dummy', hp: 999, mp: 99, atk: 1, def: 1, mag: 1, spd: 1, xp: 1, gold: 1 } }, encounters: [{ id: 'yard', foes: ['dummy'] }] };
  const skills = { zap: { mp: 1, target: 'foe', power: 1, status: { is: 'paralysis' } }, mend: { mp: 1, target: 'ally', heal: true, cure: ['paralysis', 'burn'] } };

  it('is read: the world\'s own and the presets a skill names; a fight with none has no table', () => {
    const cfg = trio({ ...base, skills, states: { bog: { said: 'bogged', noCast: true, rounds: 2 } } });
    expect(Object.keys(cfg.states)).toEqual(['bog', 'burn', 'paralysis']);
    expect(cfg.states.paralysis).toMatchObject({ said: 'paralysed', rounds: 2, skip: true });
    expect(cfg.skills.zap.status).toMatchObject({ is: 'paralysis', rounds: 2 });
    expect('states' in trio(base)).toBe(false);
    expect(() => trio({ ...base, states: { sleep: { said: 'x', skip: true } } })).toThrow(/the kernel's own status/);
    expect(() => trio({ ...base, states: { nap: { said: 'napping' } } })).toThrow(/does nothing/);
    expect(() => trio({ ...base, skills: { x: { mp: 1, target: 'foe', status: { is: 'gloom' } } } })).toThrow(/is not|status is/);
  });

  it('does what it says: a held turn, no casting, blows wide, at anyone, HP each turn, a blow ending it, worn off', () => {
    const states = { paralysis: true, bog: { said: 'bogged', noCast: true, rounds: 5 }, blind: { said: 'blinded', miss: 0.99, rounds: 5 }, burn: true, confusion: true };
    const cfg = trio({ ...base, skills: { ...skills, fire: true }, states });
    const R = rpgInit(cfg), v = {};
    rpgStart(cfg, R, 'yard', v);
    const st = R.b.side.ayla.st, said = (beats, who = 'ayla') => beats.filter((x) => x.who === who || x.target === who || x.by === who).map((x) => x.text);
    // paralysed: the turn held (its picks unread), worn off in two
    st.paralysis = 2;
    expect(said(rpgRound(cfg, R, { ayla: { act: 'attack', target: 'f0' } }, v))).toContain('Ayla is paralysed.');
    // bogged: no MP skill (Bram, the mage)
    R.b.side.bram.st.bog = 3;
    expect(said(rpgRound(cfg, R, { bram: { act: 'skill', skill: 'fire', target: 'f0' } }, v), 'bram')).toContain('Bram cannot cast.');
    // blinded: its blows go wide
    st.paralysis = 0; st.blind = 3;
    expect(said(rpgRound(cfg, R, { ayla: { act: 'attack', target: 'f0' } }, v))).toContain('Ayla misses Dummy.');
    // burning: HP each turn, and worn off in its rounds
    st.blind = 0; st.burn = 1;
    const burnt = said(rpgRound(cfg, R, {}, v));
    expect(burnt.some((t) => /takes \d+ damage from being burning/.test(t))).toBe(true);
    expect(burnt).toContain('Ayla is no longer burning.');
    // confused: a blow at anyone at all; a blow on it ends it
    st.confusion = 3;
    expect(said(rpgRound(cfg, R, { ayla: { act: 'attack', target: 'f0' } }, v))).toContain('Ayla lashes out wildly!');
  });
});

// THE PARTY MENU'S ITEM AND FORMATION: a battle item used outside a fight (on a member, or all of an allies item's
// party), and two members trading places in the order fought in, carried by the save
describe('the party menu\'s item and formation', () => {
  it('an item out of a fight mends who it is used on, spends one from the bag, and does nothing it cannot', () => {
    const cfg = trio(), R = rpgInit(cfg), v = { 'held:bag:potion': 2 };
    expect(rpgFieldUse(cfg, R, 'potion', 'ayla', v)).toBe('useless');
    expect(v['held:bag:potion']).toBe(2);
    R.m.ayla.hp = 5;
    expect(rpgFieldUse(cfg, R, 'potion', 'ayla', v)).toBe('');
    expect(R.m.ayla.hp).toBeGreaterThan(5);
    expect(v['held:bag:potion']).toBe(1);
    expect(rpgFieldUse(cfg, R, 'ether', 'ayla', v)).toBe('none');
  });

  it('two members trade places: the order fought in, who of it fights, carried through a save', () => {
    const cfg = trio({ rules: { size: 2 } }), R = rpgInit(cfg);
    expect(rpgPartyOf(cfg, R, {})).toEqual(['ayla', 'bram']);
    expect(rpgSwap(cfg, R, 'ayla', 'cass')).toBe('');
    expect(rpgPartyOf(cfg, R, {})).toEqual(['cass', 'bram']);
    const roster = Object.fromEntries(Object.entries(rpgSave(cfg, R)).map(([id, stats]) => [id, { stats }]));
    const R2 = rpgInit(cfg);
    rpgLoad(cfg, R2, roster);
    expect(rpgPartyOf(cfg, R2, {})).toEqual(['cass', 'bram']);
    // (a save that never set one carries no place)
    expect('ord' in rpgSave(cfg, rpgInit(cfg)).ayla).toBe(false);
  });
});

// TRAITS (a class's or a piece of gear's resist, immune, ward): the elements its wearer takes half of or none of, the
// states it wards off; gathered from its class and what it wears
describe('traits on gear and classes', () => {
  const caster = { name: 'Caster', hp: 999, mp: 999, atk: 1, def: 1, mag: 40, spd: 1, xp: 1, gold: 1, skills: ['fire', 'sleep'], pattern: [{ use: 'fire', when: { every: 2 } }, { use: 'sleep', when: { turn: 1 } }] };
  const base = { foes: { caster }, encounters: [{ id: 'yard', foes: ['caster'] }], party: [{ id: 'ayla', class: 'fighter', gear: { accessory: 'ember-ring' } }] };
  const gear = { 'ember-ring': { slot: 'accessory', resist: ['fire'], ward: ['sleep'] }, 'bronze-sword': true, 'leather-armor': true };

  it('are read on gear and on classes; one that names none carries none', () => {
    const cfg = readRpg({ rpg: { ...base, gear } });
    expect(cfg.gear['ember-ring'].traits).toEqual({ resist: ['fire'], ward: ['sleep'] });
    expect('traits' in cfg.gear['bronze-sword']).toBe(false);
    const c2 = readRpg({ rpg: { ...base, gear, classes: { fighter: { base: { hp: 40, mp: 0, atk: 10, def: 8, mag: 2, spd: 6 }, growth: { hp: 8, mp: 0, atk: 2, def: 2, mag: 0, spd: 1 }, immune: ['fire'] } } } });
    expect(c2.classes.fighter.traits).toEqual({ immune: ['fire'] });
  });

  it('ward a state off and halve an element\'s blow; worn off with the gear', () => {
    const cfg = readRpg({ rpg: { ...base, gear } }), R = rpgInit(cfg), v = {};
    rpgStart(cfg, R, 'yard', v);
    const first = rpgRound(cfg, R, {}, v);
    expect(first.some((x) => x.text === 'Ayla is unaffected.')).toBe(true);
    const warded = rpgRound(cfg, R, {}, v).find((x) => x.kind === 'hurt' && x.target === 'ayla').amount;
    // (the ring taken off: the same caster's fire, at full)
    const bare = readRpg({ rpg: { ...base, gear, party: [{ id: 'ayla', class: 'fighter' }] } }), R2 = rpgInit(bare), v2 = {};
    rpgStart(bare, R2, 'yard', v2); rpgRound(bare, R2, {}, v2);
    const full = rpgRound(bare, R2, {}, v2).find((x) => x.kind === 'hurt' && x.target === 'ayla').amount;
    expect(warded).toBeLessThan(full);
  });
});

// THE TEMPLE (a shop's raise): every fallen member raised, healed and cured, for its gold each
describe('a temple\'s rite', () => {
  it('raises the fallen for their gold; says why not when none has fallen or the gold is short', () => {
    const cfg = trio({ shops: { temple: { raise: 20 } } }), R = rpgInit(cfg), v = { gold: 30 };
    expect(cfg.shops.temple).toMatchObject({ name: 'Temple', raise: 20 });
    expect(rpgRaise(cfg, R, 'temple', v)).toBe('fine');
    R.m.bram.hp = 0; R.m.cass.hp = 0;
    expect(rpgRaise(cfg, R, 'temple', v)).toBe('gold');
    v.gold = 50;
    expect(rpgRaise(cfg, R, 'temple', v)).toBe('');
    expect(v.gold).toBe(10);
    expect(R.m.bram.hp).toBe(rpgStatsOf(cfg, R, 'bram').hp);
  });
});
