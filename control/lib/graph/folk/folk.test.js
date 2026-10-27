import { describe, it, expect } from 'vitest';
import { folkOfTown, readFolk, lotKey, placeholderLine, FOLK_CAP } from './folk.js';
import { ROLES, ROOTS, RELATIONS } from './roles.js';
import { SERVICES } from './services.js';
import { MENU_KINDS } from '../playscape/ui/menus.js';
import { CAST_THEN } from '../playscape/ui/cast.js';
import { MOTIVATIONS } from '../mind/vocab.js';
import { PROGRAMS } from '../era/programs.js';
import { structureStyle } from '../era/out-structures.js';
import { designTown } from '../era/out-town.js';

// the smallest town that roots every procedure: a lot per use, along one lane
const lot = (use, s, band = [2, 3]) => ({ use, route: 'lane', side: 'left', s, band });
const LOTS = [lot('dwelling', 1), lot('shop', 8), lot('workshop', 15), lot('barn', 22), lot('hall', 30), lot('tower', 40)];
const town = (lots = LOTS) => ({ seed: 8, heartbeat: 'market', lots });
const firstOf = (F, use) => F.people.find((p) => p.use === use && !p.parent);

describe('folk: the words', () => {
  it('reads true or absent as every default, and refuses an unknown word naming the known ones', () => {
    expect(readFolk()).toEqual({ cap: FOLK_CAP.default });
    expect(readFolk(true)).toEqual({ cap: FOLK_CAP.default });
    expect(() => readFolk({ crowd: 3 })).toThrow(/'crowd' is not a folk word \(seed, cap\)/);
    expect(() => readFolk({ cap: 0 })).toThrow(/cap is a whole number/);
  });
});

describe('folk: a town grown from its lots', () => {
  const F = folkOfTown(town());

  it('roots each lot in the role its use is for, and grows its people under that first person', () => {
    for (const l of LOTS) expect(firstOf(F, l.use).role).toBe(ROOTS[l.use]);
    const grown = F.people.filter((p) => p.parent);
    expect(grown.length).toBeGreaterThan(0);
    for (const p of grown) expect(p.path.startsWith(`${p.parent}/${p.as}-`)).toBe(true);
    expect(new Set(F.people.map((p) => p.path)).size).toBe(F.people.length);
  });

  it('asks each role its combat role and leaves the rest to the seed', () => {
    const watch = F.people.filter((p) => p.service === 'watch');
    expect(watch.length).toBeGreaterThan(1);
    for (const p of watch) expect(p.sheet.facets.role).toBe('frontline');
    for (const p of F.people.filter((x) => x.service !== 'watch')) expect(p.sheet.facets.role).toBe('non-combatant');
    for (const p of F.people) expect([...p.sheet.given].sort()).toEqual(Object.keys({ ...ROLES[p.role].facets, ...(p.as && RELATIONS[p.as].born ? { ancestry: 1 } : {}) }).sort());
  });

  it('gives kin their household\'s ancestry, the born channel', () => {
    const kin = F.people.filter((p) => p.as && RELATIONS[p.as].born);
    expect(kin.length).toBeGreaterThan(0);
    for (const k of kin) expect(k.sheet.facets.ancestry).toBe(F.people.find((p) => p.path === k.parent).sheet.facets.ancestry);
  });

  it('stands a service where its lot\'s inside has the room for it', () => {
    for (const p of F.people.filter((x) => x.room)) expect(PROGRAMS[p.use].rooms.map((r) => r.role)).toContain(p.room);
  });

  it('dresses a service\'s people as one when the service is a uniform', () => {
    const shop = firstOf(F, 'shop'), kin = F.people.find((p) => p.parent === shop.path);
    expect(shop.uniform).toBe('merchant');
    expect(kin.uniform).toBeNull();   // the household over the counter wears its own
  });

  it('is the same sheet for the same town and seed, byte for byte', () => {
    expect(JSON.stringify(folkOfTown(town()))).toBe(JSON.stringify(F));
  });
});

describe('folk: the fractal', () => {
  it('only grows: a lot added moves no one already there', () => {
    const before = folkOfTown(town(LOTS.slice(0, 3))), after = folkOfTown(town([...LOTS.slice(0, 3), lot('dwelling', 50)]));
    expect(JSON.stringify(after.people.slice(0, before.people.length))).toBe(JSON.stringify(before.people));
    expect(after.people.length).toBeGreaterThan(before.people.length);
  });

  it('caps households before it leaves a lot empty, each person kept as they were, and counts who it left out', () => {
    const all = folkOfTown(town()), firsts = all.people.filter((p) => !p.parent);
    const tight = folkOfTown(town(), { folk: { cap: LOTS.length } });
    expect(JSON.stringify(tight.people)).toBe(JSON.stringify(firsts));
    expect(tight.capped).toBe(all.people.length - LOTS.length);
    const three = folkOfTown(town(), { folk: { cap: 3 } });
    expect(JSON.stringify(three.people)).toBe(JSON.stringify(firsts.slice(0, 3)));
    expect(three.capped).toBe(all.people.length - 3);
  });

  it('keys a person by their lot, not by the lot\'s place in the list', () => {
    const a = folkOfTown(town([LOTS[1], LOTS[0]]));
    expect(firstOf(a, 'dwelling').sheet).toEqual(firstOf(folkOfTown(town()), 'dwelling').sheet);
    expect(lotKey(LOTS[0])).toBe('lane:left:1');
    expect(lotKey({ route: 'farm', side: 'farm', front: [3, -40] })).toBe('farm:farm:3,-40');
  });
});

describe('folk: what the town is missing', () => {
  it('says the open need a lone counter has, and meets it when someone grows what it sells', () => {
    const lone = folkOfTown(town([lot('shop', 1)]));
    const supplier = lone.needs.find((n) => n.role === 'keeper' && n.need === 'supplier');
    expect(supplier.met).toBe(false);
    expect(supplier.who).toEqual([firstOf(lone, 'shop').path]);
    expect(folkOfTown(town([lot('shop', 1), lot('barn', 9)])).needs.find((n) => n.need === 'supplier').met).toBe(true);
  });

  it('lists a service whose work nothing runs yet, with who stands in for it', () => {
    const F = folkOfTown(town([lot('workshop', 1)]));
    const smith = F.gaps.find((g) => g.service === 'smith');
    expect(smith.missing).toMatch(/no menu/);
    expect(smith.who).toEqual(F.people.filter((p) => p.service === 'smith').map((p) => p.path));
  });

  it('roots no one on a lot whose use has no role, and says so', () => {
    const F = folkOfTown(town([{ use: 'keep', route: 'castle', side: 'in', s: 2 }]));
    expect(F.people).toEqual([]);
    expect(F.unrooted).toEqual([{ lot: 'castle:in:2', use: 'keep' }]);
  });
});

describe('folk: lines are slots, never words', () => {
  it('names a line by its speaker\'s title and slot, a service adding its own', () => {
    const keeper = firstOf(folkOfTown(town([lot('shop', 1)])), 'shop');
    expect(keeper.slots).toEqual([...ROLES.keeper.slots, ...SERVICES.merchant.slots]);
    expect(keeper.slots.map((s) => placeholderLine(keeper, s))).toEqual(['[Keeper: greeting]', '[Keeper: farewell]', '[Keeper: the shop]']);
  });
});

describe('folk: services lower onto what the game runs', () => {
  it('names a built menu, effect or mind, or is a gap that says what is missing', () => {
    for (const [id, s] of Object.entries(SERVICES)) {
      if (s.status === 'gap') { expect(s.lowers, id).toBeNull(); expect(s.missing, id).toBeTruthy(); continue; }
      expect(s.status, id).toBe('built');
      if (s.lowers.menu) expect(MENU_KINDS[s.lowers.menu], id).toBeTruthy();
      if (s.lowers.then) expect(CAST_THEN[s.lowers.then], id).toBeTruthy();
      if (s.lowers.mind) expect(MOTIVATIONS[s.lowers.mind], id).toBeTruthy();
    }
  });
});

describe('folk: on a designed town', () => {
  it('accounts for every lot: its people, or unrooted', () => {
    const T = designTown(structureStyle('isekai-meadow', 8), 8, {});
    const F = folkOfTown(T, { folk: { cap: FOLK_CAP.max } });
    const rooted = new Set(F.people.filter((p) => !p.parent).map((p) => p.lot));
    for (const l of T.lots) expect(rooted.has(lotKey(l)) || F.unrooted.some((u) => u.lot === lotKey(l))).toBe(true);
    expect(new Set(T.lots.map(lotKey)).size).toBe(T.lots.length);
    expect(F.heartbeat).toBe(T.heartbeat);
  });
});
