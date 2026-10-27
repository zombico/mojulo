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
import { AGES } from '../egocube/facets.js';
import { SHAPES } from './domicile.js';

// the smallest town that roots every procedure: a lot per use, along one lane
const lot = (use, s, band = [2, 3]) => ({ use, route: 'lane', side: 'left', s, band });
const LOTS = [lot('dwelling', 1), lot('shop', 8), lot('workshop', 15), lot('barn', 22), lot('hall', 30), lot('tower', 40)];
const town = (lots = LOTS) => ({ seed: 8, heartbeat: 'market', lots });
const firstOf = (F, use) => F.people.find((p) => p.use === use && !p.parent);
const firstOfPath = (F, path) => F.people.find((p) => p.path === path);
const BANDS = Object.keys(AGES);

describe('folk: the words', () => {
  it('reads true or absent as every default, and refuses an unknown word naming the known ones', () => {
    expect(readFolk()).toEqual({ cap: FOLK_CAP.default, pool: 3 });
    expect(readFolk(true)).toEqual({ cap: FOLK_CAP.default, pool: 3 });
    expect(() => readFolk({ crowd: 3 })).toThrow(/'crowd' is not a folk word \(seed, cap, domicile, domiciles, pool, say\)/);
    expect(() => readFolk({ domicile: 'D + Q' })).toThrow(/a domicile is/);
    expect(() => readFolk({ cap: 0 })).toThrow(/cap is a whole number/);
  });
});

describe('folk: a town grown from its lots', () => {
  const F = folkOfTown(town());

  it('roots each lot in the role its use is for, and grows its people under that first person', () => {
    for (const l of LOTS) expect(firstOf(F, l.use).role).toBe(ROOTS[l.use]);
    const grown = F.people.filter((p) => p.parent);
    expect(grown.length).toBeGreaterThan(0);
    for (const p of grown) expect(p.path === `${p.parent}/partner` || p.path.startsWith(`${p.parent}/${p.as}-`)).toBe(true);
    expect(new Set(F.people.map((p) => p.path)).size).toBe(F.people.length);
  });

  it('asks each role its combat role and leaves the rest to the seed', () => {
    const watch = F.people.filter((p) => p.service === 'watch');
    expect(watch.length).toBeGreaterThan(1);
    for (const p of watch) expect(p.sheet.facets.role).toBe('frontline');
    for (const p of F.people.filter((x) => x.service !== 'watch')) expect(p.sheet.facets.role).toBe('non-combatant');
    for (const p of F.people) expect([...p.sheet.given].sort()).toEqual(Object.keys({ ...ROLES[p.role].facets, ...(p.as && RELATIONS[p.as].born ? { ancestry: 1 } : {}) }).sort());
  });

  it('gives children their dweller\'s ancestry, the born channel', () => {
    const fam = folkOfTown(town(), { folk: { domicile: 'D of F (P + C2)' } });
    const kids = fam.people.filter((p) => p.as === 'child');
    expect(kids.length).toBeGreaterThan(0);
    for (const k of kids) expect(k.sheet.facets.ancestry).toBe(fam.people.find((p) => p.path === k.parent).sheet.facets.ancestry);
  });

  it('stands a service where its lot\'s inside has the room for it', () => {
    for (const p of F.people.filter((x) => x.room)) expect(PROGRAMS[p.use].rooms.map((r) => r.role)).toContain(p.room);
  });

  it('dresses a service\'s people as one when the service is a uniform', () => {
    const G = folkOfTown(town(), { folk: { domicile: 'D + P' } });
    const shop = firstOf(G, 'shop'), kin = G.people.find((p) => p.parent === shop.path);
    expect(shop.uniform).toBe('merchant');
    expect(kin.uniform).toBeNull();   // the household over the counter wears its own
  });

  it('is the same sheet for the same town and seed, byte for byte', () => {
    expect(JSON.stringify(folkOfTown(town()))).toBe(JSON.stringify(F));
  });
});

describe('folk: the domicile, a house round its dweller', () => {
  const F = folkOfTown(town());

  it('heads a house with the lot\'s first person and keys its people under them', () => {
    const houses = F.people.filter((p) => !p.parent && ROLES[p.role].house).map((p) => p.path);
    expect(F.domiciles.map((d) => d.dweller)).toEqual(houses);
    for (const d of F.domiciles) {
      expect(d.notation).toMatch(/^D (\+ 0|\+ P|of F \(P \+ C\d\)|\+ C\d)$/);
      expect(d.partner === null).toBe(!SHAPES[d.shape].partner);
      if (d.partner) expect(d.partner).toBe(`${d.dweller}/partner`);
      d.children.forEach((c, i) => expect(c).toBe(`${d.dweller}/child-${i + 1}`));
    }
  });

  it('never has a house headed by a child, and every child is younger than its dweller', () => {
    const big = folkOfTown(town(Array.from({ length: 12 }, (_, i) => lot('dwelling', 1 + i * 7))), { folk: { cap: FOLK_CAP.max } });
    const band = (p) => BANDS.indexOf(p.sheet.facets.age), at = (path) => big.people.find((p) => p.path === path);
    for (const d of big.domiciles) {
      expect(at(d.dweller).sheet.facets.age).not.toBe('child');
      for (const c of d.children) expect(band(at(c))).toBeLessThan(band(at(d.dweller)));
    }
    expect(big.domiciles.some((d) => d.shape === 'family')).toBe(true);
  });

  it('keeps a single parent\'s house without a partner', () => {
    const one = folkOfTown(town([lot('dwelling', 1)]), { folk: { domicile: 'D + C2' } });
    expect(one.domiciles[0]).toMatchObject({ shape: 'single', notation: 'D + C2', partner: null });
    expect(one.domiciles[0].children.length).toBe(2);
  });

  it('keeps a shape the operator asked, for every house or for one', () => {
    const alone = folkOfTown(town(), { folk: { domicile: 'D + 0' } });
    expect(alone.domiciles.every((d) => d.shape === 'alone' && d.asked)).toBe(true);
    expect(alone.people.some((p) => p.as === 'partner' || p.as === 'child')).toBe(false);
    const key = lotKey(LOTS[0]), one = folkOfTown(town(), { folk: { domicile: 'D + 0', domiciles: { [key]: 'D of F (P + C3)' } } });
    expect(one.domiciles.find((d) => d.lot === key)).toMatchObject({ notation: 'D of F (P + C3)', asked: true });
    expect(one.domiciles.find((d) => d.lot === key).children.length).toBe(3);
    expect(one.domiciles.filter((d) => d.lot !== key).every((d) => d.shape === 'alone')).toBe(true);
  });

  it('rolls the dweller the same whatever shape their house is asked to be', () => {
    const a = folkOfTown(town(), { folk: { domicile: 'D + 0' } }), b = folkOfTown(town(), { folk: { domicile: 'D of F (P + C2)' } });
    expect(a.domiciles.map((d) => firstOfPath(a, d.dweller).sheet)).toEqual(b.domiciles.map((d) => firstOfPath(b, d.dweller).sheet));
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
