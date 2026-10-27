import { describe, it, expect } from 'vitest';
import { tableCompile, tableStart, tableLegal, tableApply, tableAct, tableSheetLines } from './table-rpg-kernel.js';
import { systemOf, TABLE_RPG_SYSTEMS, CHECK_KINDS } from './table-rpg-systems.js';
import { readModule } from './table-rpg-module.js';
import { readGear, itemBuildOf, memberGear, foeGear, WEAPON_GEAR, ROLE_ARMS } from './table-rpg-gear.js';
import { tableRpgBook } from './table-rpg-book.js';
import { validateBuild } from '../equipment/expand.js';
import { SUNKEN_CHAPEL } from './fixtures/sunken-chapel.js';

// one system per resolution procedure, picked off the catalog
const BY_KIND = Object.fromEntries(CHECK_KINDS.map((k) => [k, Object.keys(TABLE_RPG_SYSTEMS).find((id) => TABLE_RPG_SYSTEMS[id].check.kind === k)]));
const ARMOURED = Object.keys(TABLE_RPG_SYSTEMS).find((id) => TABLE_RPG_SYSTEMS[id].combat.defence === 'armour');
const UNARMOURED = Object.keys(TABLE_RPG_SYSTEMS).find((id) => TABLE_RPG_SYSTEMS[id].combat.defence !== 'armour' && TABLE_RPG_SYSTEMS[id].combat.foesAct);

// the hall: a gate and a room of guards, the party's arms to hand
const HALL = (extra = {}) => ({
  seed: 3, system: systemOf('target'),
  party: [{ id: 'a', name: 'Ana', role: 'frontline' }, { id: 'b', name: 'Bel', role: 'flanker' }],
  world: { start: 'town', places: [{ id: 'town', dungeon: 'keep' }] },
  dungeons: { keep: { entry: 'gate', rooms: [{ id: 'gate' }, { id: 'hall', foes: ['guard', 'guard'] }], links: [{ a: 'gate', b: 'hall' }] } },
  foes: { guard: { name: 'Guard', rank: 2 } },
  items: {
    blade: { name: 'the old blade', kind: 'weapon', bonus: 2 }, axe: { name: 'an axe', kind: 'weapon' },
    mail: { name: 'a mail shirt', kind: 'armour', bonus: 1 }, crown: { name: 'the crown', kind: 'treasure' },
  },
  goal: { item: 'crown' },
  ...extra,
});
const withBag = (K, S, bag) => ({ ...S, bag });

describe('artifacts in the kernel: a weapon and an armour taken up, their bonus in the blow and the guard', () => {
  it('refuses an artifact it cannot read, teaching', () => {
    expect(() => tableCompile(HALL({ items: { x: { kind: 'relic' } } }))).toThrow(/kind is key, treasure, heal, weapon, armour/);
    expect(() => tableCompile(HALL({ items: { x: { kind: 'treasure', bonus: 1 } } }))).toThrow(/a bonus \(1 to 3\) is a weapon's or an armour's/);
    expect(() => tableCompile(HALL({ items: { x: { kind: 'weapon', bonus: 4 } } }))).toThrow(/a bonus \(1 to 3\)/);
    expect(() => tableCompile(HALL({ items: { x: { kind: 'armour', faculty: 'might' } } }))).toThrow(/a faculty is a weapon's/);
    expect(() => tableCompile(HALL({ party: [{ id: 'a', role: 'frontline', arms: ['crown'] }] }))).toThrow(/starts with 'crown', which is no weapon or armour/);
    expect(() => tableCompile(HALL({ party: [{ id: 'a', role: 'frontline', arms: ['blade', 'axe'] }] }))).toThrow(/two of one kind/);
  });

  it('equip: by the one named or the best at what it asks; the arm it replaces goes back to the bag', () => {
    const K = tableCompile(HALL());
    const S = withBag(K, tableStart(K).S, { blade: 1, axe: 1 });
    expect(tableLegal(K, S).map((m) => m.name)).toEqual(expect.arrayContaining(['equip blade', 'equip axe']));
    const one = tableAct(K, S, 'equip axe by b');
    expect(one.S.party[1].arms).toEqual({ weapon: 'axe' });
    const two = tableAct(K, one.S, 'equip blade by b');
    expect(two.S.party[1].arms).toEqual({ weapon: 'blade' });
    expect(two.S.bag).toMatchObject({ blade: 0, axe: 1 });
    expect(two.lines[0]).toBe('Bel takes up the old blade (+2), and puts an axe by.');
    expect(tableSheetLines(K, two.S)[1]).toContain('in hand: the old blade (+2)');
  });

  it('a weapon in hand adds its bonus to the attack and the harm, named in the roll, for each way the dice read', () => {
    let seen = 0;
    for (const sys of [BY_KIND.target, BY_KIND.bands, BY_KIND.shifts]) {
      const K = tableCompile(HALL({ system: systemOf(sys), party: [{ id: 'a', name: 'Ana', role: 'frontline', arms: ['blade'] }] }));
      let S = tableStart(K).S;
      for (const c of ['enter', 'go hall']) S = tableAct(K, S, c).S;
      const mv = tableLegal(K, S).find((m) => m.verb === 'attack');
      if (!mv) continue;   // the foes struck the party down first
      const said = tableApply(K, S, mv).lines.find((l) => l.startsWith('Ana attacks'));
      expect(said).toContain('with the old blade');
      expect(said).toMatch(/\+2( arms)?\b/);
      seen += 1;
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('an armour adds its bonus to the defence where the card counts one, else turns that much of each blow', () => {
    const at = (sys) => {
      const K = tableCompile(HALL({ system: systemOf(sys), party: [{ id: 'a', name: 'Ana', role: 'frontline', arms: ['mail'] }] }));
      return { K, S: tableStart(K).S };
    };
    const A = at(ARMOURED);
    expect(tableSheetLines(A.K, A.S)[0]).toContain(`defence ${A.K.party[0].defence + 1}`);
    // without a defence, a blow is turned: play until a guard lands one on Ana
    for (let seed = 1; seed < 60; seed++) {
      const K = tableCompile(HALL({ seed, system: systemOf(UNARMOURED), party: [{ id: 'a', name: 'Ana', role: 'frontline', arms: ['mail'] }] }));
      let S = tableStart(K).S, lines = [];
      for (const c of ['enter', 'go hall']) { const r = tableAct(K, S, c); S = r.S; lines.push(...r.lines); }
      for (let n = 0; n < 20 && S.fight && !S.over && !lines.some((l) => /turns \d/.test(l)); n++) { const r = tableApply(K, S, tableLegal(K, S).find((m) => m.verb === 'attack')); S = r.S; lines.push(...r.lines); }
      const at = lines.findIndex((l) => /^A mail shirt turns 1\./.test(l));
      if (at < 0) continue;
      expect(lines[at + 1]).toMatch(/^Ana takes \d+/);
      return;
    }
    throw new Error('no blow landed on Ana under seed 60');
  });
});

describe('the arms as the equipment kernel makes them', () => {
  it('an item\'s build is the equipment kernel\'s words, checked by it; the game\'s style when it names none', () => {
    expect(() => readGear({ items: { x: { build: { item: 'halberd' } } } })).toThrow(/build.item: 'halberd' is not one of/);
    expect(() => readGear({ items: { x: { build: { item: 'sword', glow: 1 } } } })).toThrow(/build.glow is not an equipment word/);
    expect(() => readGear({ gear: { style: 'gothic' } })).toThrow(/gear.style: build.style: 'gothic' is not a sample/);
    const M = { gear: { style: 'elven' }, items: { a: { build: { item: 'sword' } }, b: { build: { item: 'bow', style: 'druid' } }, c: { build: { item: 'pistol' } } } };
    expect(itemBuildOf(M, 'a')).toEqual({ item: 'sword', style: 'elven' });
    expect(itemBuildOf(M, 'b').style).toBe('druid');
    expect(itemBuildOf(M, 'c')).toEqual({ item: 'pistol' });   // a firearm wears its own family's styles
  });

  it('a member holds its class\'s weapon as the kernel makes it, or the artifact it starts with; a cast\'s person its role\'s', () => {
    // one class weapon per builder the table reaches (a blade, a haft, a bow, a firearm), picked off the table
    const builders = [...new Map(Object.values(WEAPON_GEAR).map((b) => [b.item === 'dagger' || b.item === 'greatsword' ? 'sword' : b.item, b])).values()];
    for (const b of builders) expect(validateBuild({ type: 'equipment', ...b, ...(['carbine', 'pistol'].includes(b.item) ? {} : { style: 'dwarven' }) })).toEqual([]);
    const { module, K } = readModule({ ...SUNKEN_CHAPEL, gear: { style: 'dwarven' } });
    const alys = K.party.find((p) => p.id === 'alys');
    expect(memberGear(module, K, alys)).toEqual({ right: { ...WEAPON_GEAR[alys.weapon.name], style: 'dwarven' } });
    const armed = readModule({ ...SUNKEN_CHAPEL, party: [{ id: 'alys', name: 'Alys', role: 'frontline', arms: ['bone-knife'] }] });
    expect(memberGear(armed.module, armed.K, armed.K.party[0]).right).toEqual({ item: 'dagger', style: 'brutal' });
    expect(foeGear({}, { persona: { role: 'ranged' } })).toEqual({ right: { ...ROLE_ARMS.ranged.right, style: 'brutal' } });
    expect(foeGear({}, { persona: { role: 'non-combatant' } })).toBeNull();
  });

  it('a starter keeps an artifact with its key and arms its people in its building\'s style; the module\'s own foes merge by id', () => {
    const { module } = readModule({ starter: { use: 'keep' } });
    const D = Object.values(module.dungeons)[0], keyRoom = D.rooms.find((r) => (r.items ?? []).includes('relic'));
    expect((keyRoom.items ?? []).some((x) => module.items[typeof x === 'string' ? x : x.item]?.kind === 'key')).toBe(true);
    expect(module.items.relic).toMatchObject({ kind: 'armour', build: { item: 'shield' } });
    expect(module.gear).toEqual({ style: 'dwarven' });
    const own = readModule({ starter: { use: 'keep' }, foes: { castellan: { character: 'c1' } }, items: { relic: { artifact: 'i1' } } }).module;
    expect(own.foes.castellan).toMatchObject({ name: 'Castellan', rank: 3, character: 'c1' });
    expect(own.foes['man-at-arms']).toBeTruthy();
    expect(own.items.relic).toMatchObject({ kind: 'armour', artifact: 'i1' });
  });

  it('the book: an Arms chapter, each artifact with its rules, its look in words, where it is found, its photograph', () => {
    const { K } = readModule(SUNKEN_CHAPEL);
    const { html } = tableRpgBook(K, { itemPortraits: { 'bone-knife': { figure: 'data:image/jpeg;base64,KNIFE' } } });
    expect(html).toContain('id="arms"');
    expect(html).toContain('<section class="artifact"><img src="data:image/jpeg;base64,KNIFE" alt="the bone knife">');
    expect(html).toContain('weapon, +1, strikes with agility');
    expect(html).toContain('brutal dagger');
    expect(html).toMatch(/the Ossuary \(the Sunken Chapel\)/);
    const bare = { ...SUNKEN_CHAPEL, items: Object.fromEntries(Object.entries(SUNKEN_CHAPEL.items).filter(([id]) => id !== 'bone-knife')), dungeons: { chapel: { ...SUNKEN_CHAPEL.dungeons.chapel, rooms: SUNKEN_CHAPEL.dungeons.chapel.rooms.map((r) => (r.id === 'ossuary' ? { ...r, items: [{ item: 'silver-ring', hidden: true }] } : r)) } } };
    expect(tableRpgBook(readModule(bare).K).html).not.toContain('id="arms"');
  });
});
